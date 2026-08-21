import * as React from "react";

/**
 * Phase 2 / T10 — shared deliverable document kit.
 *
 * The reusable `.slate-doc` scaffolding (Saipien "Register" skin) that the
 * client report / proposal / SOW deliverables compose. Presentation only;
 * all visual tokens live in `styles/deliverable.css` under `.slate-doc`.
 * Brand skin is swappable via the `--doc-*` tokens.
 *
 * Pure server components.
 */

/** Corner registration ticks — plate furniture on every page. */
export function Reg() {
  return (
    <>
      <span className="doc-reg tl" />
      <span className="doc-reg tr" />
      <span className="doc-reg bl" />
      <span className="doc-reg br" />
    </>
  );
}

/**
 * Wordmark — the Saipien "Register" typographic lockup: "Saipien" set in
 * Archivo with a mint period. Reverses to paper + bright mint on the dark
 * brand panel. Swap for the final logo asset via the same slot.
 */
export function Wordmark({ tone = "ink" }: { tone?: "ink" | "light" }) {
  const light = tone === "light";
  return (
    <div className={`doc-wordmark${light ? " doc-wordmark--light" : ""}`}>
      <span className="wm-word">
        Saipien<span className="wm-dot">.</span>
      </span>
    </div>
  );
}

/**
 * Decision-journey rail. On the cover (`variant="cover"`) it renders as
 * the committed warm-dark brand panel with a document-id label and a
 * confidential foot; on content pages it is the light contents rail with
 * the active item highlighted.
 */
export function Rail({
  items,
  activeIndex,
  variant,
  docId,
  companyName,
}: {
  items: string[];
  activeIndex?: number;
  variant?: "cover";
  docId?: string;
  companyName?: string;
}) {
  const cover = variant === "cover";
  return (
    <aside className="doc-rail">
      <div className="doc-rail-top">
        <Wordmark tone={cover ? "light" : "ink"} />
        {cover && docId ? <div className="doc-railid">{docId}</div> : null}
      </div>
      <div className="doc-toc-h">In this brief</div>
      <ol className="doc-toc">
        {items.map((label, i) => (
          <li
            key={`${i}-${label}`}
            className={i === activeIndex ? "active" : undefined}
          >
            <span className="num">{String(i + 1).padStart(2, "0")}</span>
            <span className="nm">{label}</span>
            <span className="pg" />
          </li>
        ))}
      </ol>
      {cover ? (
        <>
          <div className="doc-rail-spacer" />
          <div className="doc-rail-foot">
            Confidential · prepared for {companyName ?? "the leadership team"}
          </div>
        </>
      ) : null}
    </aside>
  );
}

/** A content page: registration ticks + the rail + the reading column. */
export function DocPage({
  rail,
  active,
  children,
}: {
  rail: string[];
  active?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="doc-page">
      <Reg />
      <div className="doc-spread">
        <Rail items={rail} activeIndex={active} />
        <div className="doc-main">{children}</div>
      </div>
    </section>
  );
}

/** Slug → human label: "workflow-friction" → "Workflow Friction". */
export function humanizeSectionType(sectionType: string): string {
  return sectionType
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAi\b/g, "AI")
    .replace(/\bSow\b/g, "SOW")
    .replace(/\bRoi\b/g, "ROI")
    .replace(/\bKpi\b/g, "KPI");
}

/**
 * Section-head category note — renders the humanized section type, but
 * only when it adds information beyond the section's own title (avoids
 * "Executive Summary · Executive Summary" duplication).
 */
export function SecNote({
  sectionType,
  title,
}: {
  sectionType: string;
  title: string;
}) {
  const label = humanizeSectionType(sectionType);
  if (label.toLowerCase() === title.trim().toLowerCase()) return null;
  return <div className="doc-sec-note">{label}</div>;
}

/** Long-form date: "August 2026" style day-month-year. */
export function formatDeliverableDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
