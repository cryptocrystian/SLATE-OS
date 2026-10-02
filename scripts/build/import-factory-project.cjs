#!/usr/bin/env node
/**
 * Import a software-factory project into BuildOS (docs/80 §11 B1). BUILDOS MODULE.
 *
 * Emits ONE SQL transaction on stdout — it never connects to a database. Review
 * the SQL, then apply it as a privileged role (service_role / postgres) after
 * migrations 0030–0033 are applied.
 *
 * Sources:
 *   --backlog   the factory's backlog.yml (the LIVE copy is on the factory host)
 *   --journeys  the project's "Canonical Journeys" markdown (titles + Touches: bindings)
 *
 * Mapping (docs/81):
 *   accepted          → accepted (via ready → in_progress → accepted; no run rows —
 *                       run history stays in the factory trace)
 *   superseded        → superseded
 *   every other build → ready (claimable only once an operator ACTIVATES the project)
 *   kind: decision    → not imported (launch-gate ratifications are not build work);
 *                       listed in the SQL header for the operator
 *   depends_on        → build_work_item_deps (between imported items only)
 *   bindings          → the journey's `Touches:` entities (the factory's own rule,
 *                       control-plane/canon.py:bindings); foundations bind '*'
 *
 * The project is created in `ready` (readiness attested by the import). It is NOT
 * activated: activation is an operator act in /app/build once workers and
 * provider accounts exist.
 *
 * Usage:
 *   node scripts/build/import-factory-project.cjs \
 *     --backlog backlog.yml --journeys "canon/Canonical Journeys v2.md" \
 *     --workspace <uuid> --created-by <profile uuid> \
 *     --project-key arxus --name Arxus --repo https://github.com/cryptocrystian/arxus \
 *     --origin-ref arxus [--repo-filter arxus] [--stack next-supabase] [--canon arxus-v2] > arxus-import.sql
 */
const fs = require("node:fs");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function q(v) {
  if (v === null || v === undefined) return "null";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function qArr(arr) {
  return `array[${arr.map(q).join(", ")}]::text[]`;
}

/** Journey id → { title, bindings } from a Canonical Journeys markdown file. */
function parseJourneys(markdown) {
  const out = new Map();
  const blocks = markdown.split(/\n(?=### )/);
  for (const block of blocks) {
    const head = /^### (JRN-[A-Z0-9]+)\s+—\s+(.+?)(?:\s+·\s+P\d.*)?$/m.exec(block);
    if (!head) continue;
    const touches = /\*\*Touches:\*\*\s*([^\n]*)/.exec(block);
    const entityPart = touches ? touches[1].split("·")[0] : "";
    const bindings = [...entityPart.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()).filter((b) => /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(b));
    out.set(head[1], { title: head[2].replace(/\s+`\[.*$/, "").trim(), bindings: [...new Set(bindings)] });
  }
  return out;
}

function itemKey(id) {
  return String(id).toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+/, "").slice(0, 80);
}

function buildImportSql(opts) {
  const { backlog, journeysMarkdown } = opts;
  for (const k of ["workspace", "createdBy"]) {
    if (!UUID_RE.test(opts[k] ?? "")) throw new Error(`--${k === "createdBy" ? "created-by" : k} must be a UUID`);
  }
  if (!/^[a-z][a-z0-9-]{1,39}$/.test(opts.projectKey ?? "")) throw new Error("--project-key must be a lowercase slug");
  if (!/^(https:\/\/|git@)\S+$/.test(opts.repo ?? "")) throw new Error("--repo must be an https:// or git@ URL");
  const journeys = parseJourneys(journeysMarkdown ?? "");
  const items = (backlog?.items ?? []).filter((it) => !opts.repoFilter || !it.repo || it.repo === opts.repoFilter);

  const imported = [];
  const skipped = [];
  for (const it of items) {
    if (it.kind === "decision") {
      skipped.push(`${it.id} (${it.status ?? "?"}): ${it.note ?? ""}`);
      continue;
    }
    const journey = it.journey ? journeys.get(it.journey) : undefined;
    const kind =
      it.kind === "foundation" ? "foundation"
      : it.kind === "journey" ? "journey"
      : it.kind === "remediation" && it.remediates ? "remediation"
      : "chore";
    const bindings = kind === "foundation" ? ["*"] : journey?.bindings ?? [];
    imported.push({
      key: itemKey(it.id),
      sourceId: it.id,
      kind,
      canonRef: it.journey ?? null,
      title: (journey?.title ?? it.title ?? it.note ?? it.id).toString().slice(0, 200),
      brief: [it.note ? `Factory note: ${it.note}` : null, it.run_id ? `Factory run: ${it.run_id}` : null, "Imported from the software factory backlog."]
        .filter(Boolean)
        .join("\n"),
      bindings,
      factoryStatus: it.status ?? "ready",
      dependsOn: (it.depends_on ?? []).map(itemKey),
      remediates: it.remediates ? itemKey(it.remediates) : null,
    });
  }
  const keys = new Set(imported.map((i) => i.key));
  const dupes = imported.map((i) => i.key).filter((k, i, a) => a.indexOf(k) !== i);
  if (dupes.length) throw new Error(`duplicate item keys after normalization: ${[...new Set(dupes)].join(", ")}`);

  const P = `(select id from public.build_projects where workspace_id = ${q(opts.workspace)} and project_key = ${q(opts.projectKey)})`;
  const I = (k) => `(select id from public.build_work_items where project_id = ${P} and item_key = ${q(k)})`;
  const lines = [];
  lines.push(`-- BuildOS import of factory project '${opts.projectKey}' — generated ${new Date().toISOString()}`);
  lines.push(`-- ${imported.length} work items (${imported.filter((i) => i.factoryStatus === "accepted").length} accepted). Apply as service_role/postgres.`);
  if (skipped.length) {
    lines.push(`-- NOT imported (decision items — rule/track them outside the build queue):`);
    for (const s of skipped) lines.push(`--   ${s.replace(/\n/g, " ")}`);
  }
  const unbound = imported.filter((i) => i.kind !== "foundation" && i.bindings.length === 0).map((i) => i.key);
  if (unbound.length) lines.push(`-- WARNING: no Touches: bindings found for ${unbound.join(", ")} — they will not be co-scheduled safely; add bindings before activation.`);
  lines.push("begin;");
  lines.push(
    `insert into public.build_projects (workspace_id, project_key, name, origin_kind, origin_ref, repo_url, default_branch, stack_profile, canon_profile, created_by)
values (${q(opts.workspace)}, ${q(opts.projectKey)}, ${q(opts.name ?? opts.projectKey)}, 'ventureos_venture', ${q(opts.originRef ?? opts.projectKey)}, ${q(opts.repo)}, ${q(opts.branch ?? "main")}, ${q(opts.stack ?? "next-supabase")}, ${q(opts.canon ?? "arxus-v2")}, ${q(opts.createdBy)});`,
  );
  lines.push(
    `update public.build_projects set status = 'ready', readiness_checked_at = now(), readiness_note = ${q("Imported from the software factory; canon package validated by the factory's own readiness checks.")} where id = ${P};`,
  );
  // Items: insert ready, then apply terminal states through allowed transitions.
  for (const i of imported) {
    const remediation = i.kind === "remediation" && keys.has(i.remediates);
    lines.push(
      `insert into public.build_work_items (project_id, workspace_id, item_key, kind, canon_ref, title, brief, bindings, status, remediates_item_id, created_by)
values (${P}, ${q(opts.workspace)}, ${q(i.key)}, ${q(remediation ? "remediation" : i.kind === "remediation" ? "chore" : i.kind)}, ${q(i.canonRef)}, ${q(i.title)}, ${q(i.brief)}, ${qArr(i.bindings)}, 'ready', ${remediation ? I(i.remediates) : "null"}, ${q(opts.createdBy)});`,
    );
  }
  for (const i of imported) {
    for (const d of i.dependsOn.filter((d) => keys.has(d))) {
      lines.push(
        `insert into public.build_work_item_deps (work_item_id, depends_on_id, project_id, workspace_id) values (${I(i.key)}, ${I(d)}, ${P}, ${q(opts.workspace)});`,
      );
    }
  }
  for (const i of imported) {
    if (i.factoryStatus === "accepted") {
      lines.push(`update public.build_work_items set status = 'in_progress' where id = ${I(i.key)};`);
      lines.push(`update public.build_work_items set status = 'accepted' where id = ${I(i.key)};`);
    } else if (i.factoryStatus === "superseded") {
      lines.push(`update public.build_work_items set status = 'superseded' where id = ${I(i.key)};`);
    }
  }
  lines.push("commit;");
  return { sql: lines.join("\n") + "\n", imported: imported.length, skipped: skipped.length };
}

module.exports = { buildImportSql, parseJourneys, itemKey };

if (require.main === module) {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i].replace(/^--/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    args[k] = argv[i + 1];
  }
  try {
    const yaml = require("js-yaml");
    const backlog = yaml.load(fs.readFileSync(args.backlog, "utf8"));
    const journeysMarkdown = fs.readFileSync(args.journeys, "utf8");
    const { sql, imported, skipped } = buildImportSql({ ...args, backlog, journeysMarkdown });
    process.stdout.write(sql);
    console.error(`✓ ${imported} work items, ${skipped} decision items listed (not imported).`);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
}
