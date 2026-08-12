"use client";

import * as React from "react";
import { FileText, MicOff, Save, Sparkles } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IntakeSourceTypeChip } from "@/components/intake/intake-source-type-chip";
import { ROLE_LABEL } from "@/lib/intake/helpers";
import { INTAKE_QUESTIONS } from "@/lib/intake/seed-questions";
import {
  createOfflineStakeholderResponseAction,
  createEngagementIntakeDocumentAction,
} from "@/lib/intake/offline-actions";
import {
  segmentTranscript,
  type TranscriptSegment,
  type SegmentTranscriptResult,
  DEFAULT_MAX_SEGMENT_CHARS,
} from "@/lib/intake/transcript-segmentation";
import type {
  CreateIntakeDocumentResult,
  CreateOfflineResponseResult,
  IntakeDocumentSourceType,
} from "@/lib/intake/types";
import type { OfflineStakeholderSession } from "@/lib/intake/offline-queries";

/**
 * Sprint S2 — Transcript / Notetaker Intake panel.
 *
 * Canon: `docs/39` § 4.2 (secondary input lane) + `docs/41` § 2 (model).
 *
 * Operator flow:
 *   1. Paste the transcript (or meeting-note) text.
 *   2. Title + source-type (transcript / meeting_notes).
 *   3. Click "Import transcript" — persists the raw text as an
 *      `engagement_intake_documents` row via the existing I2 server
 *      action; never client-visible.
 *   4. The pasted text is segmented client-side by the pure helper
 *      `segmentTranscript`. Each segment is shown for review.
 *   5. Per segment, operator assigns target stakeholder + intake
 *      question, then saves as a `source_type='transcript'` draft
 *      response (existing I2 server action). Marking ready + voiding
 *      reuses the offline lifecycle actions; this panel does NOT
 *      reimplement them.
 *
 * Boundary copy:
 *   - "No invite sent." + "Client-visible: No" badges above every
 *     save action, matching the offline-intake-panel pattern.
 *   - Transcript chip on every saved row (rendered by the offline
 *     intake panel that lists existing responses).
 *
 * What this component does NOT do:
 *   - No AI segmentation. The split is deterministic per `docs/41` § 2.
 *   - No third-party notetaker webhook (Otter / Fireflies / Granola /
 *     Read.ai) — `docs/41` explicitly defers webhook integration.
 *   - No file binary upload. S2 ships paste-first; a "select .txt file"
 *     affordance is added as a thin wrapper around `FileReader` so the
 *     operator can drag in a plain-text transcript without leaving the
 *     paste paradigm.
 *   - No new server action. All persistence routes through existing I2
 *     actions: `createEngagementIntakeDocumentAction` and
 *     `createOfflineStakeholderResponseAction`.
 *   - No CRM. No findings synthesis. No /r or /p mint. No Send to Client.
 */

const SOURCE_TYPE_OPTIONS: Array<{
  value: Extract<IntakeDocumentSourceType, "transcript" | "meeting_notes">;
  label: string;
  helper: string;
}> = [
  {
    value: "transcript",
    label: "Transcript",
    helper:
      "Verbatim recording transcript. Speaker labels (e.g. 'Casey:') will be auto-detected for segmentation.",
  },
  {
    value: "meeting_notes",
    label: "Meeting notes",
    helper:
      "Operator-collected meeting notes (paraphrased or summarized). Segmented by paragraph if no speaker labels are present.",
  },
];

const MAX_TRANSCRIPT_CHARS = 100_000;
const TITLE_MAX = 200;

export interface TranscriptIntakePanelProps {
  engagementId: string;
  /** Existing offline-mode stakeholder sessions on this engagement.
   *  Transcript segments are assigned to one of these sessions when
   *  saved as a response. If the operator needs a new stakeholder,
   *  they stage one via the StageOfflineStakeholderForm above the
   *  transcript panel and then return here. */
  offlineSessions: OfflineStakeholderSession[];
}

export function TranscriptIntakePanel({
  engagementId,
  offlineSessions,
}: TranscriptIntakePanelProps) {
  const [title, setTitle] = React.useState("");
  const [sourceType, setSourceType] = React.useState<
    Extract<IntakeDocumentSourceType, "transcript" | "meeting_notes">
  >("transcript");
  const [rawText, setRawText] = React.useState("");
  const [operatorNotes, setOperatorNotes] = React.useState("");
  const [importing, setImporting] = React.useState(false);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [imported, setImported] = React.useState<{
    documentId: string;
    sourceType: IntakeDocumentSourceType;
    title: string;
    segmentation: SegmentTranscriptResult;
  } | null>(null);

  const previewSegmentation = React.useMemo<SegmentTranscriptResult>(
    () => segmentTranscript(rawText),
    [rawText],
  );

  async function onImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setImportError(null);
    const text = rawText.trim();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setImportError("Title is required.");
      return;
    }
    if (trimmedTitle.length > TITLE_MAX) {
      setImportError(`Title exceeds ${TITLE_MAX} chars.`);
      return;
    }
    if (!text) {
      setImportError("Paste the transcript text before importing.");
      return;
    }
    if (text.length > MAX_TRANSCRIPT_CHARS) {
      setImportError(
        `Transcript exceeds ${MAX_TRANSCRIPT_CHARS.toLocaleString()} chars. Split into multiple imports.`,
      );
      return;
    }
    setImporting(true);
    try {
      const result: CreateIntakeDocumentResult =
        await createEngagementIntakeDocumentAction({
          engagementId,
          title: trimmedTitle,
          sourceType,
          contentText: text,
          operatorNotes: operatorNotes.trim() || undefined,
        });
      if (result.ok) {
        setImported({
          documentId: result.documentId,
          sourceType: result.sourceType,
          title: trimmedTitle,
          segmentation: segmentTranscript(text),
        });
        setRawText("");
        setTitle("");
        setOperatorNotes("");
      } else {
        setImportError(translateDocumentError(result.error));
      }
    } catch {
      setImportError("Something went wrong importing the transcript.");
    } finally {
      setImporting(false);
    }
  }

  function onPickTextFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("text/") && !file.name.endsWith(".txt")) {
      setImportError("Only plain-text files (.txt) are supported in this sprint.");
      return;
    }
    if (file.size > MAX_TRANSCRIPT_CHARS) {
      setImportError(
        `File exceeds ${MAX_TRANSCRIPT_CHARS.toLocaleString()} chars. Split before importing.`,
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setRawText(result);
      if (!title) {
        setTitle(file.name.replace(/\.[^.]+$/, ""));
      }
    };
    reader.onerror = () =>
      setImportError("Could not read file. Paste the text instead.");
    reader.readAsText(file);
  }

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 text-text-muted" />
            <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Transcript / notetaker intake
            </span>
            <Badge tone="info" variant="outline">
              Secondary lane
            </Badge>
            <Badge tone="neutral" variant="outline">
              No message sent
            </Badge>
          </div>
          <h2 className="text-base font-semibold tracking-tight text-text-primary">
            Paste or upload meeting notes / transcripts collected outside SLATE
          </h2>
          <p className="text-xs leading-relaxed text-text-muted">
            Operator-side ingest only. Nothing is sent to stakeholders. The
            text is segmented locally for review; you assign each segment to
            a staged stakeholder + intake question, then save as a draft
            transcript-sourced response. Findings synthesis only consumes
            segments you mark ready.
          </p>
        </div>

        <div
          role="note"
          className="flex items-start gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-3 text-xs text-text-secondary"
        >
          <MicOff className="mt-0.5 h-3.5 w-3.5 text-text-muted" />
          <span className="leading-relaxed">
            <span className="font-medium text-text-primary">
              Operator-controlled lane.
            </span>{" "}
            SLATE does not connect to Zoom, Teams, Otter, Fireflies, Granola,
            Read.ai, or any other notetaker. You paste or drop in a plain-text
            transcript you already collected. The transcript document is
            stored privately; segments become draft responses on the
            stakeholders you choose.
          </span>
        </div>

        <form
          onSubmit={onImport}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <Input
            label="Transcript title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Casey discovery call — 2026-06-02"
            required
            autoComplete="off"
            className="sm:col-span-2"
            hint={`${title.length}/${TITLE_MAX} chars`}
          />

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="transcript-source-type"
              className="text-xs font-medium tracking-tight text-text-secondary"
            >
              Source type
            </label>
            <select
              id="transcript-source-type"
              value={sourceType}
              onChange={(e) =>
                setSourceType(
                  e.target.value as Extract<
                    IntakeDocumentSourceType,
                    "transcript" | "meeting_notes"
                  >,
                )
              }
              className="h-10 w-full rounded-md border border-border-subtle bg-bg-elevated/60 px-3 text-sm text-text-primary outline-none transition-[border,box-shadow] focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
            >
              {SOURCE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] leading-relaxed text-text-muted">
              {
                SOURCE_TYPE_OPTIONS.find((o) => o.value === sourceType)
                  ?.helper
              }
            </p>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="transcript-raw-text"
              className="text-xs font-medium tracking-tight text-text-secondary"
            >
              Transcript text
            </label>
            <textarea
              id="transcript-raw-text"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={10}
              maxLength={MAX_TRANSCRIPT_CHARS}
              placeholder={"Speaker 1: We sell AI advisory and implementation services...\nSpeaker 2: Delivery work is tracked across docs and meetings..."}
              className="w-full rounded-md border border-border-subtle bg-bg-elevated/60 px-3 py-2 font-mono text-[11px] leading-relaxed text-text-primary placeholder:text-text-muted outline-none transition-[border,box-shadow] focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-muted">
              <span>
                {rawText.length.toLocaleString()}/
                {MAX_TRANSCRIPT_CHARS.toLocaleString()} chars
              </span>
              <label
                htmlFor="transcript-file"
                className="cursor-pointer text-text-secondary underline decoration-dotted underline-offset-2 hover:text-text-primary"
              >
                or drop in a .txt file
                <input
                  id="transcript-file"
                  type="file"
                  accept="text/plain,.txt"
                  className="hidden"
                  onChange={onPickTextFile}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="transcript-operator-notes"
              className="text-xs font-medium tracking-tight text-text-secondary"
            >
              Operator notes (optional, 1000 chars max)
            </label>
            <textarea
              id="transcript-operator-notes"
              value={operatorNotes}
              onChange={(e) => setOperatorNotes(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Audit context only — not shown to the client. E.g. 'Discovery call with Casey + Riley, 2026-06-02, 45 min'"
              className="w-full rounded-md border border-border-subtle bg-bg-elevated/60 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none transition-[border,box-shadow] focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
            />
            <p className="text-[11px] leading-relaxed text-text-muted">
              {operatorNotes.length}/1000
            </p>
          </div>

          {/* Segmentation preview (only when there's text but no import yet) */}
          {rawText.trim().length > 0 && !imported ? (
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
                Preview ·{" "}
                {previewSegmentation.segments.length} segment
                {previewSegmentation.segments.length === 1 ? "" : "s"}
                {previewSegmentation.speakerSplitDetected
                  ? ` · ${previewSegmentation.detectedSpeakers.length} speaker${previewSegmentation.detectedSpeakers.length === 1 ? "" : "s"} detected`
                  : " · no speaker labels — paragraph split"}
                {previewSegmentation.truncatedAtIndex !== null
                  ? " · truncated"
                  : ""}
              </span>
              <p className="text-[11px] leading-relaxed text-text-muted">
                Segments are deterministic. Speaker labels (e.g.{" "}
                <code className="font-mono">Alex:</code>) split first; falls
                back to paragraph then sentence-chunk. Max{" "}
                {DEFAULT_MAX_SEGMENT_CHARS} chars per segment.
              </p>
            </div>
          ) : null}

          <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-text-muted">
              No invite, no token, no public link. Client-visible: <strong>No</strong>.
            </p>
            <Button
              type="submit"
              variant="primary"
              size="md"
              leadingIcon={<FileText className="h-4 w-4" />}
              disabled={importing || !rawText.trim() || !title.trim()}
            >
              {importing ? "Importing…" : "Import transcript"}
            </Button>
          </div>
        </form>

        {importError ? (
          <p className="rounded-md border border-status-critical/40 bg-status-critical/10 p-3 text-xs text-status-critical">
            {importError}
          </p>
        ) : null}

        {imported ? (
          <ImportedSegmentReview
            engagementId={engagementId}
            documentId={imported.documentId}
            sourceType={imported.sourceType}
            documentTitle={imported.title}
            segmentation={imported.segmentation}
            offlineSessions={offlineSessions}
            onReset={() => setImported(null)}
          />
        ) : null}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Segment review (post-import) — one row per segment, assign + save
// ---------------------------------------------------------------------------

interface ImportedSegmentReviewProps {
  engagementId: string;
  documentId: string;
  sourceType: IntakeDocumentSourceType;
  documentTitle: string;
  segmentation: SegmentTranscriptResult;
  offlineSessions: OfflineStakeholderSession[];
  onReset: () => void;
}

function ImportedSegmentReview({
  engagementId: _engagementId,
  documentId,
  sourceType,
  documentTitle,
  segmentation,
  offlineSessions,
  onReset,
}: ImportedSegmentReviewProps) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-status-success/40 bg-status-success/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-status-success" />
          <span className="text-[11px] uppercase tracking-[0.16em] text-status-success">
            Transcript imported · review segments
          </span>
        </div>
        <Badge tone="success" variant="outline">
          No message sent
        </Badge>
      </div>
      <p className="text-xs leading-relaxed text-text-primary">
        <span className="font-semibold">{documentTitle}</span> stored as{" "}
        {sourceType === "transcript" ? "Transcript" : "Meeting notes"} ·
        document id <code className="font-mono text-[11px]">{documentId}</code>
        . {segmentation.segments.length} segment
        {segmentation.segments.length === 1 ? "" : "s"} ready for review.
        {segmentation.speakerSplitDetected
          ? ` Speakers detected: ${segmentation.detectedSpeakers.join(", ")}.`
          : ""}
        {segmentation.truncatedAtIndex !== null ? (
          <>
            {" "}
            <span className="text-status-warning">
              Truncated at {segmentation.truncatedAtIndex.toLocaleString()}{" "}
              chars; remaining text not segmented in this import.
            </span>
          </>
        ) : null}
      </p>

      {offlineSessions.length === 0 ? (
        <p className="rounded-md border border-status-warning/40 bg-status-warning/10 p-3 text-xs text-status-warning">
          No offline-mode stakeholder sessions exist yet on this engagement.
          Stage at least one stakeholder above (via &quot;Stage offline
          stakeholder&quot;) before assigning transcript segments.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {segmentation.segments.map((segment) => (
            <SegmentRow
              key={segment.index}
              segment={segment}
              offlineSessions={offlineSessions}
              sourceType={sourceType}
            />
          ))}
        </ul>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
        >
          Import another transcript
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-segment row — assign stakeholder + question, save as draft
// ---------------------------------------------------------------------------

interface SegmentRowProps {
  segment: TranscriptSegment;
  offlineSessions: OfflineStakeholderSession[];
  sourceType: IntakeDocumentSourceType;
}

function SegmentRow({
  segment,
  offlineSessions,
  sourceType,
}: SegmentRowProps) {
  const [sessionId, setSessionId] = React.useState<string>(
    offlineSessions[0]?.id ?? "",
  );
  const [questionId, setQuestionId] = React.useState<string>(
    INTAKE_QUESTIONS[0]?.id ?? "",
  );
  const [savedResponseId, setSavedResponseId] = React.useState<string | null>(
    null,
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [voided, setVoided] = React.useState(false);

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      const question = INTAKE_QUESTIONS.find((q) => q.id === questionId);
      // Response source_type must be transcript/meeting_notes (offline subset).
      // We map document source_type to response source_type 1:1 because
      // the response action validates against the offline set.
      const responseSourceType =
        sourceType === "meeting_notes" ? "meeting_notes" : "transcript";
      const result: CreateOfflineResponseResult =
        await createOfflineStakeholderResponseAction({
          sessionId,
          questionId,
          questionLabel: question?.label,
          answerText: segment.text,
          sourceType: responseSourceType,
          operatorNotes: segment.speaker
            ? `Speaker: ${segment.speaker} · segment #${segment.index + 1} · strategy: ${segment.strategy}`
            : `Segment #${segment.index + 1} · strategy: ${segment.strategy}`,
        });
      if (result.ok) {
        setSavedResponseId(result.responseId);
      } else {
        setError(translateResponseError(result.error));
      }
    } catch {
      setError("Couldn't save segment.");
    } finally {
      setSaving(false);
    }
  }

  const stakeholderLabel = (s: OfflineStakeholderSession) =>
    `${s.name} · ${ROLE_LABEL[s.role]}`;

  if (voided) {
    return (
      <li className="rounded-md border border-border-subtle bg-bg-elevated/30 p-3 text-[11px] italic text-text-muted">
        Segment #{segment.index + 1} ignored — not saved.
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
          Segment #{segment.index + 1}
        </span>
        {segment.speaker ? (
          <Badge tone="info" variant="outline">
            {segment.speaker}
          </Badge>
        ) : null}
        <IntakeSourceTypeChip sourceType={sourceType} />
        <Badge tone="neutral" variant="outline">
          {segment.strategy}
        </Badge>
        {savedResponseId ? (
          <Badge tone="success" variant="outline" dot>
            Saved as draft
          </Badge>
        ) : null}
      </div>

      <p className="whitespace-pre-wrap rounded-md border border-border-subtle bg-bg-page/40 p-2 text-xs leading-relaxed text-text-primary">
        {segment.text}
      </p>

      {savedResponseId ? (
        <p className="text-[11px] text-text-muted">
          Saved as draft response{" "}
          <code className="font-mono">{savedResponseId}</code> on the assigned
          stakeholder. Use the &quot;Offline stakeholder sessions&quot; panel
          above to <strong>Mark ready</strong> or <strong>Void</strong> the
          response.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium tracking-tight text-text-secondary">
                Assign to stakeholder
              </label>
              <select
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                disabled={offlineSessions.length === 0}
                className="h-9 w-full rounded-md border border-border-subtle bg-bg-elevated/60 px-2 text-xs text-text-primary outline-none transition-[border,box-shadow] focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
              >
                {offlineSessions.length === 0 ? (
                  <option value="">— stage a stakeholder first —</option>
                ) : (
                  offlineSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {stakeholderLabel(s)}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium tracking-tight text-text-secondary">
                Assign to question
              </label>
              <select
                value={questionId}
                onChange={(e) => setQuestionId(e.target.value)}
                className="h-9 w-full rounded-md border border-border-subtle bg-bg-elevated/60 px-2 text-xs text-text-primary outline-none transition-[border,box-shadow] focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
              >
                {INTAKE_QUESTIONS.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setVoided(true)}
            >
              Ignore segment
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              leadingIcon={<Save className="h-3.5 w-3.5" />}
              onClick={onSave}
              disabled={saving || !sessionId}
            >
              {saving ? "Saving…" : "Save as draft"}
            </Button>
          </div>
        </>
      )}

      {error ? (
        <p className="text-[11px] text-status-critical">{error}</p>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Error translators
// ---------------------------------------------------------------------------

type DocumentFailure = Exclude<CreateIntakeDocumentResult, { ok: true }>["error"];
type ResponseFailure = Exclude<CreateOfflineResponseResult, { ok: true }>["error"];

function translateDocumentError(code: DocumentFailure): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again to import transcripts.";
    case "invalid-engagement":
    case "engagement-not-found":
      return "Engagement could not be found.";
    case "invalid-source-type":
      return "Pick a valid transcript source type.";
    case "invalid-content":
      return "Transcript text is required.";
    case "missing-fields":
      return "Title and transcript text are required.";
    case "field-too-long":
      return "Title, transcript, or operator notes exceeded the length limit.";
    case "service-error":
    default:
      return "Couldn't import the transcript. Please try again.";
  }
}

function translateResponseError(code: ResponseFailure): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "invalid-session":
    case "session-not-found":
      return "Stakeholder session not found.";
    case "session-mode-mismatch":
      return "Transcript segments must target an offline-mode stakeholder, not a live-link session.";
    case "invalid-source-type":
      return "Source type not allowed for transcript segments.";
    case "missing-fields":
      return "Segment text or question is missing.";
    case "field-too-long":
      return "Segment exceeded the response length cap.";
    case "service-error":
    default:
      return "Couldn't save segment.";
  }
}
