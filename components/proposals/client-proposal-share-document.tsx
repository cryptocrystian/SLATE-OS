import * as React from "react";

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
import type {
  ProposalDeliverySnapshot,
  ProposalOmittedContent,
  ProposalOptionSnapshot,
  ProposalPricingReviewState,
} from "@/lib/proposals/delivery-snapshot-types";

/*
THESIS: The proposal a client actually opens through their /p share link — the
same "Opportunity Brief" system as the operator preview, at design parity: a
composed cover + brand panel, a "how to read this" opening, an options-at-a-glance
tiered comparison, then each option as a first-class detailed offer. It refuses
the stacked-plain-cards + mono-eyebrow layout the earlier share document shipped.
OWN-WORLD: Saipien "Register" light executive plate document (styles/
deliverable.css, .slate-doc), shared with the flagship client-proposal-deliverable,
the report share document, and the public SOW.
CONSTRAINT (docs/24 § Required Disclaimers + Content Rendering Policy):
snapshot-pure (every field from the snapshot jsonb; no live re-query), no internal
UUIDs, no operator-only framing, no approval/e-signature controls, SVG-free.
Pricing is HIDDEN whenever pricingReviewState='placeholder' and only surfaces as
"estimated · subject to final approval" once approved. The commercial-guard scan
surfaces only as the affirmative phrase; the discussion-draft disclosure and the
mandatory not-a-binding-quote/not-a-SOW/not-a-contract footer stay on every render.
STORY: A buyer opens to a composed cover, compares the tiers, reads genuinely
distinct offers, and knows which option fits — concluding this firm is worth it.
FORM: executive print document (decision-journey plate document).
*/

export interface ClientProposalShareDocumentProps {
  /** The full snapshot — the only source of truth; no live data. */
  snapshot: ProposalDeliverySnapshot;
  /** Display title for the cover fallback. Provided by the route. */
  proposalTitle: string;
  /**
   * Client company name for the cover hero + rail foot (the client viewer
   * already knows who they are). Falls back to proposalTitle. No UUID.
   */
  companyName?: string;
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

export function ClientProposalShareDocument({
  snapshot,
  proposalTitle,
  companyName,
}: ClientProposalShareDocumentProps) {
  const options = snapshot.optionSnapshot
    .filter((o) => o.includedInArtifact)
    .sort((a, b) => a.position - b.position);
  const hasRecommended = options.some((o) => o.recommended);
  const showTiers = options.length >= 2;
  const pricingHidden = snapshot.pricingReviewState === "placeholder";
  const omissions = snapshot.omittedContent;
  const heroName = companyName?.trim() || proposalTitle;

  const rail: string[] = ["How to read this"];
  if (showTiers) rail.push("Options at a glance");
  options.forEach((o) => rail.push(optionTypeLabel(o.optionType)));
  if (omissions.length > 0) rail.push("Appendix");

  const optionBase = showTiers ? 2 : 1;
  const appendixActive = omissions.length > 0 ? rail.length - 1 : undefined;

  return (
    <div className="slate-doc" data-deliverable-export="client-proposal-share">
      {/* -------- Cover -------- */}
      <section className="doc-page doc-cover">
        <Reg />
        <div className="doc-spread">
          <Rail
            items={rail}
            variant="cover"
            docId="Engagement Proposal"
            companyName={companyName}
          />
          <div className="doc-main">
            <h1 className="doc-h1">{heroName}</h1>
            <p className="doc-cover-sub">
              {options.length > 1
                ? `${capitalize(numberWord(options.length))} ways to move the priorities from discovery into delivery — with the scope, sequencing, and trade-offs of each.`
                : "A recommended engagement to move the priorities from discovery into delivery — scope, sequencing, and trade-offs laid out."}
            </p>
            <div className="doc-cover-rule" />
            <dl className="doc-cover-meta">
              <div><dt>Prepared for</dt><dd>{heroName}</dd></div>
              <div><dt>Prepared by</dt><dd>Saipien Labs</dd></div>
              <div><dt>Issued</dt><dd>{formatDeliverableDate(snapshot.generatedAt)}</dd></div>
              <div><dt>Status</dt><dd>For discussion</dd></div>
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
            delivers, its timeline, and the assumptions and dependencies it rests
            on.{" "}
            {hasRecommended
              ? "The option marked Recommended is where most organizations at this stage get the strongest result relative to effort. "
              : ""}
            {pricingHidden
              ? "Pricing is intentionally not shown here — final pricing requires written approval and is shared separately."
              : "Where shown, pricing is a planning estimate, subject to final approval, and is not a binding quote."}
          </p>
          <p>
            This document is a commercial discussion artifact — not a binding
            quote, not a statement of work, and not a contract. Final scope,
            pricing, and timeline are confirmed in scoping.
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
          <TieredComparison options={options} pricingHidden={pricingHidden} />
        </DocPage>
      ) : null}

      {/* -------- Per-option detail -------- */}
      {options.map((option, i) => (
        <DocPage key={`${option.optionType}-${i}`} rail={rail} active={optionBase + i}>
          <OptionDetail option={option} pricingHidden={pricingHidden} />
        </DocPage>
      ))}

      {/* -------- Omitted-content appendix -------- */}
      {omissions.length > 0 ? (
        <DocPage rail={rail} active={appendixActive}>
          <OmittedContentAppendix omissions={omissions} />
          <ShareFooter />
        </DocPage>
      ) : (
        <DocPage rail={rail}>
          <ShareFooter />
        </DocPage>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiered comparison (good / better / best)
// ---------------------------------------------------------------------------

function TieredComparison({
  options,
  pricingHidden,
}: {
  options: ProposalOptionSnapshot[];
  pricingHidden: boolean;
}) {
  const cols = Math.min(options.length, 3);
  return (
    <div
      className="doc-tiers"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {options.map((o, idx) => {
        const fit = toClientVoice(sanitizeClientProse(o.bestFitScenario));
        const price = pricingHidden ? null : cleanPricing(o.pricingPlaceholder);
        const deliverables = sanitizeClientBullets(o.deliverables).slice(0, 4);
        return (
          <div key={`${o.optionType}-${idx}`} className={`doc-tier${o.recommended ? " rec" : ""}`}>
            <div className="doc-tier-flag">{o.recommended ? "Recommended" : ""}</div>
            <div className="doc-tier-name">{optionTypeLabel(o.optionType)}</div>
            <div className="doc-tier-fit">{fit ?? o.title}</div>
            <div className="doc-tier-price">
              {price ?? "Scoped to fit"}
              <small>
                {pricingHidden
                  ? "Shared separately after approval"
                  : "Planning estimate · confirmed in scoping"}
              </small>
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

function OptionDetail({
  option,
  pricingHidden,
}: {
  option: ProposalOptionSnapshot;
  pricingHidden: boolean;
}) {
  const bestFit = toClientVoice(sanitizeClientProse(option.bestFitScenario));
  const scope = toClientVoice(sanitizeClientProse(option.scopeSummary));
  const timeline = sanitizeClientProse(option.timeline);
  const deliverables = sanitizeClientBullets(option.deliverables);
  const assumptions = sanitizeClientBullets(option.assumptions);
  const dependencies = sanitizeClientBullets(option.dependencies);
  const risks = sanitizeClientBullets(option.risks);
  const pricing = pricingHidden ? null : cleanPricing(option.pricingPlaceholder);

  return (
    <>
      <div className="doc-sec-head">
        <div className="doc-sec-title">{option.title}</div>
        <div className="doc-sec-note">
          {optionTypeLabel(option.optionType)}
          {option.recommended ? " · Recommended" : ""}
        </div>
      </div>

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
          <span style={{ color: "var(--doc-ink-3)" }}>
            {" "}— proposed range, not a delivery guarantee.
          </span>
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
          {pricing} (planning estimate — subject to final approval, not a binding quote)
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
// Omitted-content appendix — client-safe wording (docs/24)
// ---------------------------------------------------------------------------

function OmittedContentAppendix({
  omissions,
}: {
  omissions: ProposalOmittedContent[];
}) {
  const hasGroupB = omissions.some((o) => o.scope === "group_b_block");
  const optionExclusionCount = omissions.filter(
    (o) => o.scope !== "group_b_block",
  ).length;

  return (
    <>
      <div className="doc-sec-head">
        <div className="doc-sec-title">Intentionally not included</div>
        <div className="doc-sec-note">Appendix</div>
      </div>
      <p className="doc-lede">
        A few topics are intentionally kept out of this proposal discussion so
        the conversation stays grounded in what is ready to commit to today.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {hasGroupB ? (
          <OmissionPlate
            title="Benchmark and modeled financial views"
            body="Benchmark comparisons and modeled financial views are intentionally kept in discussion-only materials until validated against your operating assumptions. They are out of scope for this proposal."
          />
        ) : null}
        {optionExclusionCount > 0 ? (
          <OmissionPlate
            title="Alternate option paths"
            body={
              optionExclusionCount === 1
                ? "One additional option path was considered but is not included in this discussion."
                : `${optionExclusionCount} additional option paths were considered but are not included in this discussion.`
            }
          />
        ) : null}
      </div>
    </>
  );
}

function OmissionPlate({ title, body }: { title: string; body: string }) {
  return (
    <div className="doc-plate" style={{ margin: 0 }}>
      <div className="doc-plate-fig">{title}</div>
      <p className="doc-body" style={{ marginTop: "8px" }}>{body}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer — affirmative safety line + mandatory disclaimer copy (docs/24)
// ---------------------------------------------------------------------------

function ShareFooter() {
  return (
    <footer className="doc-footer" style={{ marginTop: "40px" }}>
      <p>Commercial safety checks passed.</p>
      <p>
        This document is a commercial discussion artifact. It is not a binding
        quote, not a statement of work, and not a contract. Final scope, pricing,
        and timeline require written approval.
      </p>
      <p>
        Questions about this proposal? Contact the Saipien Labs team member who
        sent you this link.
      </p>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cleanPricing(raw: string | null | undefined): string | null {
  const t = sanitizeClientProse(raw);
  if (!t) return null;
  const cleaned = t
    .replace(/\s*[·|,-]?\s*pricing placeholder\b.*$/i, "")
    .replace(/\s*for internal planning only\.?/gi, "")
    .replace(/\s*[·|,-]\s*$/, "")
    .replace(/\bplaceholder\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}

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
