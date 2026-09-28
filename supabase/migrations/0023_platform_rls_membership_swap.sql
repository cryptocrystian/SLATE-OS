-- SLATE — Platform G0 · Existing-table RLS swap: singleton → membership
--
-- Per docs/72_GOVERNANCEOS_INTEGRATION_PLAN.md §3.3.
-- Layer: SLATE PLATFORM.
--
-- Replaces every `workspace_id = (select id from public.workspaces limit 1)`
-- predicate (and the `true` policies on profiles / workspaces / scorecard
-- tables) with membership-aware predicates from 0022. Policy NAMES are kept
-- so the change is reviewable as a like-for-like swap. Generated from the
-- live pg_policies inventory on 2026-09-28 (see docs/74 §3).
--
-- !! APPLY ORDER / PRECONDITION !!
--   Every operator who must keep access needs an ACTIVE row in
--   public.workspace_memberships BEFORE this runs, or they will see an empty
--   app. The guard below aborts the migration if no active membership exists.
--   Timing (Architect decision, 2026-09-25): apply after the founder
--   self-test completes and before any external/client use.
--
-- Not touched: service-role paths (public share routes, public intake,
-- scorecard submit, storage) — they bypass RLS by design.
--
-- Rollback path (manual): re-run the policy blocks from 0002–0021.
--
-- Idempotent: safe to re-run.

do $$
begin
  if not exists (select 1 from public.workspace_memberships where status = 'active') then
    raise exception '0023 precondition failed: no active workspace_memberships rows. Grant operator memberships first (scripts/platform/grant-workspace-membership.cjs).';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tables carrying workspace_id: operator_full → is_workspace_member(workspace_id)
-- -----------------------------------------------------------------------------

drop policy if exists accounts_operator_full on public.accounts;
create policy accounts_operator_full on public.accounts
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists ai_synthesis_runs_operator_full on public.ai_synthesis_runs;
create policy ai_synthesis_runs_operator_full on public.ai_synthesis_runs
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists engagement_intake_documents_operator_full on public.engagement_intake_documents;
create policy engagement_intake_documents_operator_full on public.engagement_intake_documents
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists engagements_operator_full on public.engagements;
create policy engagements_operator_full on public.engagements
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists finding_source_refs_operator_full on public.finding_source_refs;
create policy finding_source_refs_operator_full on public.finding_source_refs
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists findings_operator_full on public.findings;
create policy findings_operator_full on public.findings
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists input_assets_operator_full on public.input_assets;
create policy input_assets_operator_full on public.input_assets
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists leads_operator_full on public.leads;
create policy leads_operator_full on public.leads
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists notes_operator_full on public.notes;
create policy notes_operator_full on public.notes
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists opportunities_operator_full on public.opportunities;
create policy opportunities_operator_full on public.opportunities
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists opportunity_finding_links_operator_full on public.opportunity_finding_links;
create policy opportunity_finding_links_operator_full on public.opportunity_finding_links
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists proposal_delivery_snapshots_operator_full on public.proposal_delivery_snapshots;
create policy proposal_delivery_snapshots_operator_full on public.proposal_delivery_snapshots
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists proposal_option_opportunity_links_operator_full on public.proposal_option_opportunity_links;
create policy proposal_option_opportunity_links_operator_full on public.proposal_option_opportunity_links
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists proposal_option_roadmap_links_operator_full on public.proposal_option_roadmap_links;
create policy proposal_option_roadmap_links_operator_full on public.proposal_option_roadmap_links
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists proposal_options_operator_full on public.proposal_options;
create policy proposal_options_operator_full on public.proposal_options
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists proposal_share_tokens_operator_full on public.proposal_share_tokens;
create policy proposal_share_tokens_operator_full on public.proposal_share_tokens
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists proposals_operator_full on public.proposals;
create policy proposals_operator_full on public.proposals
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists report_delivery_snapshots_operator_full on public.report_delivery_snapshots;
create policy report_delivery_snapshots_operator_full on public.report_delivery_snapshots
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists report_section_finding_links_operator_full on public.report_section_finding_links;
create policy report_section_finding_links_operator_full on public.report_section_finding_links
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists report_section_opportunity_links_operator_full on public.report_section_opportunity_links;
create policy report_section_opportunity_links_operator_full on public.report_section_opportunity_links
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists report_section_roadmap_links_operator_full on public.report_section_roadmap_links;
create policy report_section_roadmap_links_operator_full on public.report_section_roadmap_links
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists report_sections_operator_full on public.report_sections;
create policy report_sections_operator_full on public.report_sections
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists report_share_tokens_operator_full on public.report_share_tokens;
create policy report_share_tokens_operator_full on public.report_share_tokens
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists reports_operator_full on public.reports;
create policy reports_operator_full on public.reports
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists roadmap_items_operator_full on public.roadmap_items;
create policy roadmap_items_operator_full on public.roadmap_items
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists sow_share_tokens_operator_full on public.sow_share_tokens;
create policy sow_share_tokens_operator_full on public.sow_share_tokens
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists stakeholder_intake_sessions_operator_full on public.stakeholder_intake_sessions;
create policy stakeholder_intake_sessions_operator_full on public.stakeholder_intake_sessions
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

drop policy if exists stakeholder_responses_operator_full on public.stakeholder_responses;
create policy stakeholder_responses_operator_full on public.stakeholder_responses
  for all
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- -----------------------------------------------------------------------------
-- activity_events: select + insert only (append-only; no update/delete policy)
-- -----------------------------------------------------------------------------

drop policy if exists activity_events_operator_select on public.activity_events;
create policy activity_events_operator_select on public.activity_events
  for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists activity_events_operator_insert on public.activity_events;
create policy activity_events_operator_insert on public.activity_events
  for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

-- -----------------------------------------------------------------------------
-- Child tables without workspace_id: authorise through the parent
-- -----------------------------------------------------------------------------

drop policy if exists contacts_operator_full on public.contacts;
create policy contacts_operator_full on public.contacts
  for all
  to authenticated
  using (exists (
    select 1 from public.accounts a
    where a.id = contacts.account_id
      and public.is_workspace_member(a.workspace_id)
  ))
  with check (exists (
    select 1 from public.accounts a
    where a.id = contacts.account_id
      and public.is_workspace_member(a.workspace_id)
  ));

drop policy if exists lead_fit_dimensions_operator_full on public.lead_fit_dimensions;
create policy lead_fit_dimensions_operator_full on public.lead_fit_dimensions
  for all
  to authenticated
  using (exists (
    select 1 from public.leads l
    where l.id = lead_fit_dimensions.lead_id
      and public.is_workspace_member(l.workspace_id)
  ))
  with check (exists (
    select 1 from public.leads l
    where l.id = lead_fit_dimensions.lead_id
      and public.is_workspace_member(l.workspace_id)
  ));

drop policy if exists lead_qualification_signals_operator_full on public.lead_qualification_signals;
create policy lead_qualification_signals_operator_full on public.lead_qualification_signals
  for all
  to authenticated
  using (exists (
    select 1 from public.leads l
    where l.id = lead_qualification_signals.lead_id
      and public.is_workspace_member(l.workspace_id)
  ))
  with check (exists (
    select 1 from public.leads l
    where l.id = lead_qualification_signals.lead_id
      and public.is_workspace_member(l.workspace_id)
  ));

-- -----------------------------------------------------------------------------
-- Pre-tenant inbound (scorecard): previously `true` for any authenticated
-- session. Now: any active workspace member. Public submission continues via
-- the service role (app/api/scorecard/*).
-- -----------------------------------------------------------------------------

drop policy if exists scorecard_submissions_operator_read on public.scorecard_submissions;
create policy scorecard_submissions_operator_read on public.scorecard_submissions
  for select
  to authenticated
  using (public.has_any_workspace_membership());

drop policy if exists scorecard_submissions_operator_write on public.scorecard_submissions;
create policy scorecard_submissions_operator_write on public.scorecard_submissions
  for all
  to authenticated
  using (public.has_any_workspace_membership())
  with check (public.has_any_workspace_membership());

drop policy if exists scorecard_answers_operator_read on public.scorecard_answers;
create policy scorecard_answers_operator_read on public.scorecard_answers
  for select
  to authenticated
  using (public.has_any_workspace_membership());

drop policy if exists scorecard_answers_operator_write on public.scorecard_answers;
create policy scorecard_answers_operator_write on public.scorecard_answers
  for all
  to authenticated
  using (public.has_any_workspace_membership())
  with check (public.has_any_workspace_membership());

-- -----------------------------------------------------------------------------
-- workspaces + profiles: previously readable by any authenticated session
-- -----------------------------------------------------------------------------

drop policy if exists workspaces_operator_read on public.workspaces;
create policy workspaces_operator_read on public.workspaces
  for select
  to authenticated
  using (public.is_workspace_member(id));

-- Self stays readable so a signed-in non-member can still render their own
-- identity tile; other profiles only when you share a workspace.
drop policy if exists profiles_operator_read on public.profiles;
create policy profiles_operator_read on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or public.shares_workspace_with(id));
