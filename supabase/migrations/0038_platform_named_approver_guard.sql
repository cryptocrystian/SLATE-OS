-- SLATE — Platform · Named approver guard (GOV 01 / GOV 03)
--
-- Per docs/73 v0.2 GOV 01 ("a named person approves anything consequential")
-- and GOV 03 ("claims point at records"). Layer: SLATE PLATFORM — a
-- domain-agnostic integrity rule applied to the existing approval points.
--
-- Finding (2026-10-24 launch validation): 7 findings and 5 opportunities on
-- the Northpath self-test, and 1 client proposal snapshot, were approved by
-- direct database writes with NO approver recorded. Every approval path in
-- the app runs under a signed-in session and records the reviewer; nothing in
-- the database stopped a write that bypassed it.
--
-- This migration makes the database refuse an approval that has no person
-- behind it:
--   - Moving a row INTO an approved state requires a signed-in session
--     (auth.uid()). Direct SQL / service-role writes without a user are
--     refused with `named_approver_required`.
--   - The approver column is stamped from auth.uid() when the caller left it
--     empty, so every approval names who made it.
--
-- Approval points (status column → approved values → approver column):
--   findings.review_status        approved, report_ready   reviewed_by
--   opportunities.status          selected                 reviewed_by
--   report_sections.status        approved, final          reviewed_by
--   reports.status                approved, final          reviewed_by
--   proposals.status              approved                 reviewed_by
--   proposal_delivery_snapshots.approval_state  approved   approved_by (new)
--
-- Existing rows are NOT rewritten: the historical unattributed approvals stay
-- visible as they are (docs/77 F-7); this guard only governs new approvals.
--
-- Rollback path (manual): drop the six triggers and
-- public.platform_require_named_approver(); the new snapshot columns may stay.
--
-- Idempotent: safe to re-run.

alter table public.proposal_delivery_snapshots
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz;

-- TG_ARGV: [0] status column, [1] approver column, [2..] approved values.
create or replace function public.platform_require_named_approver()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  status_col   text := tg_argv[0];
  approver_col text := tg_argv[1];
  approved     text[] := tg_argv[2:];
  new_status   text := to_jsonb(new) ->> status_col;
  old_status   text := case when tg_op = 'UPDATE' then to_jsonb(old) ->> status_col end;
  uid          uuid := (select auth.uid());
  patch        jsonb;
begin
  if new_status is null or not (new_status = any (approved)) then
    return new;
  end if;
  if tg_op = 'UPDATE' and old_status is not distinct from new_status then
    return new; -- already approved; edits to an approved row are not a new approval
  end if;

  if uid is null then
    raise exception 'named_approver_required: % on % needs a signed-in approver', new_status, tg_table_name
      using errcode = 'P0001',
            hint = 'GOV 01: approve through SLATE, not by a direct database write.';
  end if;

  patch := jsonb_build_object(approver_col, coalesce(to_jsonb(new) ->> approver_col, uid::text));
  if tg_table_name = 'proposal_delivery_snapshots' then
    patch := patch || jsonb_build_object('approved_at', coalesce(to_jsonb(new) ->> 'approved_at', now()::text));
  end if;
  new := jsonb_populate_record(new, patch);
  return new;
end;
$$;
revoke all on function public.platform_require_named_approver() from public, anon, authenticated;

drop trigger if exists findings_named_approver on public.findings;
create trigger findings_named_approver
  before insert or update of review_status on public.findings
  for each row execute function public.platform_require_named_approver('review_status', 'reviewed_by', 'approved', 'report_ready');

drop trigger if exists opportunities_named_approver on public.opportunities;
create trigger opportunities_named_approver
  before insert or update of status on public.opportunities
  for each row execute function public.platform_require_named_approver('status', 'reviewed_by', 'selected');

drop trigger if exists report_sections_named_approver on public.report_sections;
create trigger report_sections_named_approver
  before insert or update of status on public.report_sections
  for each row execute function public.platform_require_named_approver('status', 'reviewed_by', 'approved', 'final');

drop trigger if exists reports_named_approver on public.reports;
create trigger reports_named_approver
  before insert or update of status on public.reports
  for each row execute function public.platform_require_named_approver('status', 'reviewed_by', 'approved', 'final');

drop trigger if exists proposals_named_approver on public.proposals;
create trigger proposals_named_approver
  before insert or update of status on public.proposals
  for each row execute function public.platform_require_named_approver('status', 'reviewed_by', 'approved');

drop trigger if exists proposal_snapshots_named_approver on public.proposal_delivery_snapshots;
create trigger proposal_snapshots_named_approver
  before insert or update of approval_state on public.proposal_delivery_snapshots
  for each row execute function public.platform_require_named_approver('approval_state', 'approved_by', 'approved');
