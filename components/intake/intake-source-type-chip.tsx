import * as React from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type {
  IntakeDocumentSourceType,
  IntakeSourceType,
} from "@/lib/intake/types";

/**
 * Sprint I3 — Reusable chip for displaying intake source-type on
 * stakeholder cards, response rows, and document rows.
 *
 * Canon: docs/37 § 4. Labels are operator-facing copy chosen to make
 * the offline-vs-live distinction obvious without implying SLATE
 * collected the content itself.
 */

type SourceTypeUnion = IntakeSourceType | IntakeDocumentSourceType;

const TONE_BY_SOURCE: Record<SourceTypeUnion, BadgeTone> = {
  live_link: "info",
  operator_entered: "neutral",
  meeting_notes: "neutral",
  transcript: "neutral",
  email_paste: "neutral",
  document_upload: "neutral",
  external_link: "neutral",
};

const LABEL_BY_SOURCE: Record<SourceTypeUnion, string> = {
  live_link: "Live link",
  operator_entered: "Operator-entered",
  meeting_notes: "Meeting notes",
  transcript: "Transcript",
  email_paste: "Email paste",
  document_upload: "Document upload",
  external_link: "External link",
};

const TITLE_BY_SOURCE: Record<SourceTypeUnion, string> = {
  live_link:
    "Stakeholder completed intake via the public token-gated /intake/[token] route.",
  operator_entered:
    "Operator typed the response directly from notes or memory. SLATE did not collect this content.",
  meeting_notes:
    "Operator collected notes during a meeting or call and staged them here. SLATE did not collect this content.",
  transcript:
    "Operator pasted a transcript excerpt from a call or recording. SLATE did not collect this content.",
  email_paste:
    "Operator pasted the answer from an email thread. SLATE did not send or receive this email.",
  document_upload:
    "Operator attached a document as supporting evidence. SLATE did not collect this document directly.",
  external_link:
    "Operator linked to an externally-hosted document. SLATE did not fetch or scrape this URL.",
};

export interface IntakeSourceTypeChipProps {
  sourceType: SourceTypeUnion;
  /** Optional override; otherwise the canonical operator-facing label. */
  label?: string;
}

export function IntakeSourceTypeChip({
  sourceType,
  label,
}: IntakeSourceTypeChipProps) {
  return (
    <Badge
      tone={TONE_BY_SOURCE[sourceType]}
      variant="outline"
      title={TITLE_BY_SOURCE[sourceType]}
    >
      {label ?? LABEL_BY_SOURCE[sourceType]}
    </Badge>
  );
}
