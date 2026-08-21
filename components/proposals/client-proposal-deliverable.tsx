import * as React from "react";

import type { Engagement } from "@/lib/engagements/types";
import type {
  ProposalDeliverySnapshot,
  ProposalOptionSnapshot,
} from "@/lib/proposals/delivery-snapshot-types";
import {
  sanitizeClientProse,
  sanitizeClientBullets,
} from "@/lib/deliverables/client-copy-sanitizer";
import {
  Reg,
  Rail,
  DocPage,
  formatDeliverableDate,
} from "@/components/deliverables/doc-kit";

/*
THESIS: A client-facing engagement proposal as top-firm output — "The
Opportunity Brief" system: a composed cover + brand panel, a short "how to read
this" opening, an options-at-a-glance tiered comparison (good / better / best
with a recommended tier), then each option as a first-class detailed offer. It
refuses the stacked-identical-cards + mono-eyebrow "app screen" arrangement.
OWN-WORLD: Saipien "Register" light executive plate document (styles/
deliverable.css, .slate-doc) — warm ground, committed warm-dark brand panel,
one two-tone mint accent, Archivo display vs JetBrains Mono labels. Shares the
system with the report so a client sees one coherent Saipien house style.
STORY: A buyer opens to a composed cover, sees the tiers side by side, then reads
three genuinely distinct offers — concluding this firm is worth the engagement
and knowing which option fits.
FORM: executive print document (decision-journey plate document). Roll seed f8d282d4.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
*/

export interface ClientProposalDeliverableProps {
  engagement: Engagement;
  snapshot: ProposalDeliverySnapshot;
}

const OPTION_TYPE_LABEL: Record<string, string> = {
  "quick-win-build": "Quick-Win Build",
  "ai-workflow-system": "AI Workflow System",
  "managed-ai-partner": "Managed AI Partner",
};

function optionTypeLabel(optionType: string): string {
  const key = optionType.replace(/_/g, "-");
  return (
    OPTION_TYPE_LABEL[key] ??
    optionType.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function ClientProposalDeliverable({
  engagement,
  snapshot,
}: ClientProposalDeliverableProps) {
  const options = snapshot.optionSnapshot
    .filter((o) => o.includedInArtifact)
    .sort((a, b) => a.position - b.position);
  const hasRecommended = options.some((o) => o.recommended);
  // The at-a-glance comparison only makes sense with 2+ options; a single
  // option goes straight to its detail (no "Good · Better · Best" header
  // over one full-width card).
  const showTiers = options.length >= 2;

  const rail: string[] = ["How to read this"];
  if (showTiers) rail.push("Options at a glance");
  options.forEach((o) => rail.push(optionTypeLabel(o.optionType)));

  return (
    <div className="slate-doc" data-deliverable-export="client-proposal">
      {/* -------- Cover -------- */}
      <section className="doc-page doc-cover">
        <Reg />
        <div className="doc-spread">
          <Rail
            items={rail}
            variant="cover"
            docId="Engagement Proposal"
            companyName={engagement.companyName}
          />
          <div className="doc-main">
            <h1 className="doc-h1">{engagement.companyName}</h1>
            <p className="doc-cover-sub">
              {options.length > 1
                ? `${capitalize(numberWord(options.length))} ways to move the priorities from discovery into delivery — with the scope, sequencing, and trade-offs of each.`
                : `A recommended engagement to move the priorities from discovery into delivery — scope, sequencing, and trade-offs laid out.`}
            </p>
            <div className="doc-cover-rule" />
            <dl className="doc-cover-meta">
              <div><dt>Prepared for</dt><dd>{engagement.companyName}</dd></div>
              <div><dt>Prepared by</dt><dd>Saipien Labs</dd></div>
              <div><dt>Issued</dt><dd>{formatDeliverableDate(snapshot.generatedAt)}</dd></div>
              <div><dt>Status</dt><dd>Draft for review</dd></div>
            </dl>
          </div>
        </div>
      </section>

      {/* -------- How to read this -------- */}
      <DocPage rail={rail} active={0}>
        <div className="doc-sec-head">
          <div className="doc-sec-title">How to read this proposal</div>
        </div>
        <p className="doc-lede">
          {options.length === 1
            ? "The option below turns the priorities identified during discovery into a delivery engagement."
            : `The ${numberWord(options.length)} options below each turn the priorities from discovery into a delivery engagement — they differ in depth, commitment, and how much Saipien Labs owns over time.`}
        </p>
        <div className="doc-body">
          <p>
            Each option lists the situation it best fits, what the engagement
            delivers, its timeline, and the assumptions and dependencies it
            rests on.{" "}
            {hasRecommended
              ? "The option marked Recommended is where most organizations at this stage get the strongest result relative to effort. "
              : ""}
            Pricing and final scope are confirmed during scoping.
          </p>
          <p>
            Prepared for the leadership team at {engagement.companyName} and
            reviewed by a Saipien Labs consultant before release.
          </p>
        </div>
      </DocPage>

      {/* -------- Options at a glance — tiered comparison (2+ only) -------- */}
      {showTiers ? (
        <DocPage rail={rail} active={1}>
          <div className="doc-sec-head">
            <div className="doc-sec-title">Options at a glance</div>
            <div className="doc-sec-note">
              {options.length >= 3 ? "Good · Better · Best" : "Compare the options"}
            </div>
          </div>
          <TieredComparison options={options} />
        </DocPage>
      ) : null}

      {/* -------- Per-option detail -------- */}
      {options.map((option, i) => (
        <DocPage
          key={option.optionId}
          rail={rail}
          active={(showTiers ? 2 : 1) + i}
        >
          <OptionDetail option={option} />
        </DocPage>
      ))}

      {/* -------- Footer -------- */}
      <DocPage rail={rail}>
        <DeliverableFooter companyName={engagement.companyName} />
      </DocPage>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiered comparison (good / better / best)
// ---------------------------------------------------------------------------

function TieredComparison({ options }: { options: ProposalOptionSnapshot[] }) {
  const cols = Math.min(options.length, 3);
  return (
    <div
      className="doc-tiers"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const fit = toClientVoice(sanitizeClientProse(o.bestFitScenario));
        const price = cleanPricing(o.pricingPlaceholder);
        const deliverables = sanitizeClientBullets(o.deliverables).slice(0, 4);
        return (
          <div key={o.optionId} className={`doc-tier${o.recommended ? " rec" : ""}`}>
            <div className="doc-tier-flag">
              {o.recommended ? "Recommended" : ""}
            </div>
            <div className="doc-tier-name">{optionTypeLabel(o.optionType)}</div>
            <div className="doc-tier-fit">{fit ?? o.title}</div>
            <div className="doc-tier-price">
              {price ?? "Scoped to fit"}
              <small>Planning estimate · confirmed in scoping</small>
            </div>
            {deliverables.length > 0 ? (
              <ul>
                {deliverables.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-option detail
// ---------------------------------------------------------------------------

function OptionDetail({ option }: { option: ProposalOptionSnapshot }) {
  const bestFit = toClientVoice(sanitizeClientProse(option.bestFitScenario));
  const scope = toClientVoice(sanitizeClientProse(option.scopeSummary));
  const timeline = sanitizeClientProse(option.timeline);
  const deliverables = sanitizeClientBullets(option.deliverables);
  const assumptions = sanitizeClientBullets(option.assumptions);
  const dependencies = sanitizeClientBullets(option.dependencies);
  const risks = sanitizeClientBullets(option.risks);
  const pricing = cleanPricing(option.pricingPlaceholder);

  return (
    <>
      <div className="doc-sec-head">
        <div className="doc-sec-title">{option.title}</div>
        <div className="doc-sec-note">
          {optionTypeLabel(option.optionType)}
          {option.recommended ? " · Recommended" : ""}
        </div>
      </div>

      {/* "Best fit" is the glance-table's line; here it is a compact
          labeled note (not a repeated full lede), and the scope thesis
          carries the page. */}
      {bestFit ? (
        <p
          className="doc-body"
          style={{ marginTop: "2px", fontSize: "15px", fontWeight: 600, color: "var(--doc-ink)", maxWidth: "42rem" }}
        >
          <span className="doc-sec-note">Best fit · </span>
          {bestFit}
        </p>
      ) : null}
      {scope ? (
        <div className="doc-body">
          {scope.split(/\n{2,}/).map((p, i) => (
            <p key={i} style={{ whiteSpace: "pre-line" }}>{p}</p>
          ))}
        </div>
      ) : null}

      {timeline ? (
        <p className="doc-body" style={{ marginTop: "16px" }}>
          <span className="doc-sec-note">Timeline · </span>
          {timeline}
        </p>
      ) : null}

      {deliverables.length > 0 ? (
        <div className="doc-plate">
          <div className="doc-plate-fig">What it delivers</div>
          <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0 }}>
            {deliverables.map((d, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: "10px",
                  fontSize: "13.5px",
                  lineHeight: 1.5,
                  color: "var(--doc-ink-2)",
                  padding: "5px 0",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    marginTop: "7px",
                    width: "5px",
                    height: "5px",
                    flex: "none",
                    borderRadius: "50%",
                    background: "var(--doc-accent)",
                  }}
                />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {assumptions.length > 0 || dependencies.length > 0 || risks.length > 0 ? (
        <div
          style={{
            marginTop: "24px",
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "24px",
          }}
        >
          <OptionAside label="Assumptions" items={assumptions} />
          <OptionAside label="Dependencies" items={dependencies} />
          <OptionAside label="Risks" items={risks} />
        </div>
      ) : null}

      {pricing ? (
        <p className="doc-body" style={{ marginTop: "24px", fontSize: "12.5px", color: "var(--doc-ink-3)" }}>
          <span className="doc-sec-note">Investment · </span>
          {pricing} (planning estimate — confirmed during scoping)
        </p>
      ) : null}
    </>
  );
}

function OptionAside({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="doc-sec-note" style={{ marginBottom: "8px" }}>{label}</div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
        {items.map((it, i) => (
          <li key={i} style={{ fontSize: "12px", lineHeight: 1.5, color: "var(--doc-ink-3)" }}>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function DeliverableFooter({ companyName }: { companyName: string }) {
  return (
    <footer className="doc-footer" style={{ marginTop: 0 }}>
      <p>
        This proposal is a planning document. It is not a statement of work, a
        binding quote, or a contract. Scope, timeline, and pricing are
        directional and confirmed during scoping before any engagement begins.
      </p>
      <p>Saipien Labs · Confidential · Prepared for {companyName}.</p>
    </footer>
  );
}

/**
 * Client-safe pricing: sanitize, then strip operator-internal pricing
 * phrasing ("pricing placeholder for internal planning only", "…placeholder",
 * trailing separators) so only the planning range/label reaches the client.
 * The planning-estimate caveat is added by the caller.
 */
function cleanPricing(raw: string | null | undefined): string | null {
  const t = sanitizeClientProse(raw);
  if (!t) return null;
  const cleaned = t
    .replace(/\s*[·|,-]?\s*pricing placeholder\b.*$/i, "")
    .replace(/\s*for internal planning only\.?/gi, "")
    .replace(/\s*[·|,-]\s*$/,"")
    .replace(/\bplaceholder\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Client voice: the buyer is reading their own document, so operator/third-
 * person "the client" phrasing becomes second person. AI-drafted best-fit
 * copy tends to say "the client"; this keeps it from reading as a template.
 */
function toClientVoice(t: string | null): string | null {
  if (!t) return t;
  return t
    .replace(/\bthe client's\b/gi, "your organization's")
    .replace(/\bthe client\b/gi, "your organization");
}

function numberWord(n: number): string {
  const words = ["zero", "one", "two", "three", "four", "five", "six"];
  return words[n] ?? String(n);
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
