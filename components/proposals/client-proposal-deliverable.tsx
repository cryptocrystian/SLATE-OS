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
import { deliverableSerif } from "@/lib/deliverable-fonts";

/** Serif display face for deliverable headings (see lib/deliverable-fonts). */
const SERIF = "[font-family:var(--font-deliverable-serif)]";

/*
THESIS: A client-facing engagement proposal that reads as top-firm output — a
composed cover, a short "how to read this" opening, and each commercial option
presented as a first-class, comparable offer with a clear "choose this when",
scoped workstreams, and honest planning caveats. It refuses the
stacked-identical-cards + mono-eyebrow "app screen" arrangement.
OWN-WORLD: Light executive document. White ground, slate ink, one confident
indigo accent (--color-brand-primary) as hairline rules and option numerals.
Matches ClientReportDeliverable so a client sees one coherent Saipien Labs house style.
STORY: A buyer opens to a composed cover, understands how the options differ,
and reads three genuinely distinct offers — concluding this firm is worth the
engagement and knowing which option fits.
FORM: executive print document.
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
  // Accept either the hyphenated union form or the underscored DB form.
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

  return (
    <article
      data-deliverable-export="client-proposal"
      className={`${deliverableSerif.variable} mx-auto w-full max-w-[52rem] text-text-primary`}
    >
      <Cover
        engagement={engagement}
        generatedAt={snapshot.generatedAt}
        optionCount={options.length}
      />

      <ProposalOpening
        engagement={engagement}
        optionCount={options.length}
        hasRecommended={hasRecommended}
      />

      {options.length > 0 ? (
        <section aria-label="Engagement options" className="mt-14 print:mt-10">
          <SectionRule label="Engagement options" />
          <div className="mt-8 flex flex-col gap-12 print:gap-10">
            {options.map((option, i) => (
              <OptionPlate
                key={option.optionId}
                index={i + 1}
                option={option}
              />
            ))}
          </div>
        </section>
      ) : null}

      <DeliverableFooter companyName={engagement.companyName} />
    </article>
  );
}

// ---------------------------------------------------------------------------
// Cover
// ---------------------------------------------------------------------------

function Cover({
  engagement,
  generatedAt,
  optionCount,
}: {
  engagement: Engagement;
  generatedAt: string;
  optionCount: number;
}) {
  return (
    <header className="flex min-h-[34rem] flex-col justify-between gap-16 pb-16 print:min-h-0 print:break-after-page">
      <div className="flex items-center justify-between border-t-2 border-brand-primary pt-4">
        <span className="text-[0.9rem] font-semibold tracking-[0.02em] text-text-primary">
          Saipien&nbsp;Labs
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
          Confidential
        </span>
      </div>

      <div className="flex flex-col gap-7">
        <h1
          className={`${SERIF} text-[3.25rem] font-semibold leading-[0.98] tracking-[-0.02em] text-text-primary sm:text-[4.25rem]`}
        >
          {engagement.companyName}
        </h1>
        <div className="flex flex-col gap-4">
          <div className="h-px w-16 bg-brand-primary" aria-hidden />
          <p className="text-[0.8rem] font-medium uppercase tracking-[0.2em] text-text-secondary">
            AI Opportunity Sprint · Engagement Proposal
          </p>
          <p className="max-w-xl text-base leading-relaxed text-text-muted">
            {optionCount > 1
              ? `${capitalize(numberWord(optionCount))} ways to move the priorities from discovery into delivery — with the scope, sequencing, and trade-offs of each laid out so ${engagement.companyName} can choose the right fit.`
              : `A recommended engagement to move the priorities from discovery into delivery, with the scope, sequencing, and trade-offs laid out for ${engagement.companyName}.`}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-10 gap-y-4 border-t border-border-subtle pt-6 sm:grid-cols-4">
        <CoverFact label="Prepared for" value={engagement.companyName} />
        <CoverFact label="Engagement" value={engagement.engagementType} />
        <CoverFact label="Prepared by" value="Saipien Labs" />
        <CoverFact label="Issued" value={formatDate(generatedAt)} />
      </dl>
    </header>
  );
}

function CoverFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
        {label}
      </dt>
      <dd className="text-sm font-medium text-text-primary">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Opening
// ---------------------------------------------------------------------------

function ProposalOpening({
  engagement,
  optionCount,
  hasRecommended,
}: {
  engagement: Engagement;
  optionCount: number;
  hasRecommended: boolean;
}) {
  return (
    <section aria-label="How to read this proposal" className="mt-4">
      <SectionRule label="How to read this" />
      <p className="mt-6 max-w-[42rem] text-xl font-normal leading-[1.5] text-text-primary">
        {optionCount === 1
          ? "The option below turns the priorities identified during discovery into a delivery engagement."
          : `The ${numberWord(optionCount)} options below each turn the priorities identified during discovery into a delivery engagement — they differ in depth, commitment, and how much Saipien Labs owns over time.`}
      </p>
      <p className="mt-5 max-w-[38rem] text-[0.975rem] leading-[1.75] text-text-secondary">
        Each option lists the situation it best fits, what the engagement
        delivers, its timeline, and the assumptions and dependencies it rests
        on.{" "}
        {hasRecommended
          ? "The option marked Recommended is where most organizations at this stage get the strongest result relative to effort."
          : ""}{" "}
        Pricing and final scope are confirmed during scoping.
      </p>
      <p className="mt-6 max-w-[38rem] text-sm leading-relaxed text-text-muted">
        Prepared for the leadership team at {engagement.companyName} and reviewed
        by a Saipien Labs consultant before release.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Option
// ---------------------------------------------------------------------------

function OptionPlate({
  index,
  option,
}: {
  index: number;
  option: ProposalOptionSnapshot;
}) {
  const bestFit = sanitizeClientProse(option.bestFitScenario);
  const scope = sanitizeClientProse(option.scopeSummary);
  const timeline = sanitizeClientProse(option.timeline);
  const deliverables = sanitizeClientBullets(option.deliverables);
  const assumptions = sanitizeClientBullets(option.assumptions);
  const dependencies = sanitizeClientBullets(option.dependencies);
  const risks = sanitizeClientBullets(option.risks);
  const pricing = sanitizeClientProse(option.pricingPlaceholder);

  return (
    <section className="print:break-inside-avoid-page">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] font-medium tabular-nums tracking-[0.1em] text-brand-primary">
          Option&nbsp;{String(index).padStart(2, "0")}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
          {optionTypeLabel(option.optionType)}
        </span>
        {option.recommended ? (
          <span className="rounded-sm border border-brand-primary px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.14em] text-brand-primary">
            Recommended
          </span>
        ) : null}
      </div>

      <h3
        className={`${SERIF} mt-2 text-[1.55rem] font-semibold leading-[1.12] tracking-[-0.015em] text-text-primary`}
      >
        {option.title}
      </h3>

      {bestFit ? (
        <p className="mt-3 max-w-[42rem] text-[1.05rem] font-medium leading-[1.55] text-text-primary">
          {bestFit}
        </p>
      ) : null}

      {scope ? (
        <div className="mt-3 max-w-[38rem] whitespace-pre-line text-[0.975rem] leading-[1.75] text-text-secondary">
          {scope}
        </div>
      ) : null}

      {timeline ? (
        <p className="mt-4 max-w-[38rem] text-[0.9rem] leading-relaxed text-text-secondary">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
            Timeline&nbsp;·&nbsp;
          </span>
          {timeline}
        </p>
      ) : null}

      {deliverables.length > 0 ? (
        <div className="mt-5 max-w-[40rem]">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
            What it delivers
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {deliverables.map((d, i) => (
              <li
                key={i}
                className="flex gap-2.5 text-[0.925rem] leading-relaxed text-text-secondary"
              >
                <span
                  aria-hidden
                  className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-brand-primary"
                />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {assumptions.length > 0 || dependencies.length > 0 || risks.length > 0 ? (
        <div className="mt-5 grid max-w-[42rem] gap-x-8 gap-y-4 border-l border-brand-primary/40 pl-4 sm:grid-cols-3">
          <OptionAside label="Assumptions" items={assumptions} />
          <OptionAside label="Dependencies" items={dependencies} />
          <OptionAside label="Risks" items={risks} />
        </div>
      ) : null}

      {pricing ? (
        <p className="mt-5 max-w-[38rem] text-[0.85rem] leading-relaxed text-text-muted">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
            Investment&nbsp;·&nbsp;
          </span>
          {pricing}{" "}
          <span className="text-text-disabled">
            (planning estimate — confirmed during scoping)
          </span>
        </p>
      ) : null}
    </section>
  );
}

function OptionAside({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
        {label}
      </p>
      <ul className="flex flex-col gap-1">
        {items.map((it, i) => (
          <li
            key={i}
            className="text-[0.8rem] leading-relaxed text-text-muted"
          >
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function SectionRule({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px w-8 bg-brand-primary" aria-hidden />
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-primary">
        {label}
      </span>
    </div>
  );
}

function DeliverableFooter({ companyName }: { companyName: string }) {
  return (
    <footer className="mt-16 border-t border-border-subtle pt-6 print:mt-12 print:break-inside-avoid">
      <p className="max-w-[42rem] text-[0.8rem] leading-relaxed text-text-muted">
        This proposal is a planning document. It is not a statement of work, a
        binding quote, or a contract. Scope, timeline, and pricing are
        directional and are confirmed during scoping before any engagement
        begins.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <span className="text-sm font-semibold tracking-[0.02em] text-text-primary">
          Saipien&nbsp;Labs
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
          Confidential · Prepared for {companyName}
        </span>
      </div>
    </footer>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function numberWord(n: number): string {
  const words = ["zero", "one", "two", "three", "four", "five", "six"];
  return words[n] ?? String(n);
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
