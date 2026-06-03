/**
 * Sprint S2 — Transcript / Notetaker Intake.
 *
 * Deterministic transcript segmentation. Pure function. No DB, no AI,
 * no I/O. Same input always returns same output. Safe to run in either
 * server or client context; the operator UI runs it client-side for
 * instant preview.
 *
 * Strategy (in priority order):
 *
 *   1. SPEAKER-TURN split. If at least two distinct speaker labels are
 *      detected (e.g. "Speaker 1:", "Alex:", "John Doe (Operations):"),
 *      we split on each new speaker turn. This is the highest-quality
 *      signal because each segment then has a known source attribution
 *      the operator can map to a stakeholder.
 *
 *   2. PARAGRAPH split. If no speaker labels are detected, we split on
 *      blank lines (paragraph boundaries). This preserves operator-
 *      authored paragraph structure from pasted notes.
 *
 *   3. SENTENCE-CHUNK split. If a single paragraph exceeds the
 *      max-chars threshold, we break it on sentence boundaries until
 *      each chunk fits.
 *
 *   4. HARD-WRAP. If a single sentence still exceeds the max, we
 *      hard-wrap at the threshold so no segment is unreviewable.
 *
 * Segments preserve source order (every segment carries its `index`).
 * Empty segments are filtered. Whitespace is trimmed but internal
 * formatting is preserved.
 *
 * Canon references:
 *   - `docs/39` § 4.2 — transcripts are a SECONDARY input lane.
 *   - `docs/41` § 2 — transcript model spec.
 *   - `docs/37` § 3.2 — `stakeholder_responses.answer_text` cap is
 *     20,000 chars; this segmenter enforces a much smaller per-segment
 *     cap (default 1500) so reviewable chunks fit in the UI and one
 *     transcript segment maps to one response row.
 *
 * Limits:
 *   - DEFAULT_MAX_SEGMENT_CHARS = 1500. Larger transcripts produce more
 *     segments; the operator reviews each one individually.
 *   - DEFAULT_MAX_SEGMENTS = 200. Hard cap so a runaway paste doesn't
 *     produce thousands of UI rows. Transcripts that would exceed this
 *     get truncated with a `truncatedAtIndex` marker on the result.
 *
 * Non-goals:
 *   - No AI / LLM segmentation.
 *   - No semantic chunking.
 *   - No speaker-identity inference beyond label matching.
 *   - No language-aware sentence splitting (English heuristics only;
 *     fine for the AdvisoryOps Sprint scope, can be revisited later).
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TranscriptSegment {
  /** 0-based position in source order. */
  index: number;
  /** Trimmed segment text. */
  text: string;
  /**
   * Speaker label if detected (e.g. "Speaker 1", "Alex", "John Doe").
   * Null when no speaker label was associated with this segment (i.e.
   * we fell back to paragraph/sentence split).
   */
  speaker: string | null;
  /** Strategy that produced this segment, for operator transparency. */
  strategy: "speaker-turn" | "paragraph" | "sentence-chunk" | "hard-wrap";
}

export interface SegmentTranscriptOptions {
  /** Maximum chars per segment. Defaults to `DEFAULT_MAX_SEGMENT_CHARS`. */
  maxSegmentChars?: number;
  /** Maximum number of segments to emit. Defaults to `DEFAULT_MAX_SEGMENTS`. */
  maxSegments?: number;
}

export interface SegmentTranscriptResult {
  segments: TranscriptSegment[];
  /** True when at least one speaker-turn split fired. */
  speakerSplitDetected: boolean;
  /** Distinct speaker labels in source order. */
  detectedSpeakers: string[];
  /** Total chars in the trimmed input. */
  totalChars: number;
  /**
   * If the segmenter ran out of segment budget, the source-text byte
   * offset at which it stopped emitting. Null when no truncation
   * occurred.
   */
  truncatedAtIndex: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_MAX_SEGMENT_CHARS = 1500;
export const DEFAULT_MAX_SEGMENTS = 200;

/**
 * Matches a speaker label at the start of a line. Examples that match:
 *   "Speaker 1:"
 *   "Alex:"
 *   "John Doe:"
 *   "Casey (Operations):"
 *   "00:14:33  Alex:"   (timestamp + label)
 *   "[10:14] Alex:"
 *
 * Constraints:
 *   - Up to 60 chars of label (so we don't match arbitrary prose).
 *   - Label must not contain newlines.
 *   - Trailing `:` is required.
 *   - Optional leading timestamp pattern is consumed.
 */
const SPEAKER_LABEL_REGEX =
  /^(?:\s*(?:\d{1,2}:\d{2}(?::\d{2})?|\[\d{1,2}:\d{2}(?::\d{2})?\])\s+)?([A-Za-z][^\n:]{0,59}):\s*/;

// Sentence terminators for the sentence-chunk fallback. Keeps simple,
// English-centric. Does not handle quoted speech or abbreviations.
const SENTENCE_BOUNDARY_REGEX = /(?<=[.!?])\s+(?=[A-Z(])/;

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Deterministically segment a transcript blob into reviewable chunks.
 * Pure function. Same input + options → same output.
 */
export function segmentTranscript(
  raw: string,
  options: SegmentTranscriptOptions = {},
): SegmentTranscriptResult {
  const maxSegmentChars =
    options.maxSegmentChars ?? DEFAULT_MAX_SEGMENT_CHARS;
  const maxSegments = options.maxSegments ?? DEFAULT_MAX_SEGMENTS;

  const trimmed = raw.trim();
  const totalChars = trimmed.length;

  if (totalChars === 0) {
    return {
      segments: [],
      speakerSplitDetected: false,
      detectedSpeakers: [],
      totalChars: 0,
      truncatedAtIndex: null,
    };
  }

  // Phase 1 — try speaker-turn split.
  const speakerTurns = trySpeakerTurnSplit(trimmed);

  let primarySegments: Array<{ text: string; speaker: string | null; strategy: "speaker-turn" | "paragraph" }>;
  let speakerSplitDetected = false;
  const detectedSpeakers: string[] = [];

  if (speakerTurns && speakerTurns.length >= 2) {
    speakerSplitDetected = true;
    primarySegments = speakerTurns.map((t) => ({
      text: t.text,
      speaker: t.speaker,
      strategy: "speaker-turn" as const,
    }));
    for (const t of speakerTurns) {
      if (t.speaker && !detectedSpeakers.includes(t.speaker)) {
        detectedSpeakers.push(t.speaker);
      }
    }
  } else {
    // Phase 2 — paragraph split.
    const paragraphs = trimmed
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    primarySegments = paragraphs.map((p) => ({
      text: p,
      speaker: null,
      strategy: "paragraph" as const,
    }));
  }

  // Phase 3 — enforce max-segment-chars. Break oversized chunks on
  // sentence boundaries, then hard-wrap as last resort.
  const fitted: TranscriptSegment[] = [];
  let truncatedAtIndex: number | null = null;
  let segmentCounter = 0;
  let consumedChars = 0;

  outer: for (const seg of primarySegments) {
    if (fitted.length >= maxSegments) {
      truncatedAtIndex = consumedChars;
      break outer;
    }
    if (seg.text.length <= maxSegmentChars) {
      fitted.push({
        index: segmentCounter++,
        text: seg.text,
        speaker: seg.speaker,
        strategy: seg.strategy,
      });
      consumedChars += seg.text.length;
      continue;
    }

    // Try sentence split.
    const sentences = seg.text
      .split(SENTENCE_BOUNDARY_REGEX)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    let buffer = "";
    const flushBuffer = (strategy: "sentence-chunk" | "hard-wrap") => {
      if (buffer.length === 0) return false;
      if (fitted.length >= maxSegments) {
        truncatedAtIndex = consumedChars;
        return true; // signal: stop outer
      }
      fitted.push({
        index: segmentCounter++,
        text: buffer.trim(),
        speaker: seg.speaker,
        strategy,
      });
      consumedChars += buffer.length;
      buffer = "";
      return false;
    };

    for (const sentence of sentences) {
      if (sentence.length > maxSegmentChars) {
        // Sentence itself exceeds — hard-wrap.
        if (flushBuffer("sentence-chunk")) break outer;
        for (let i = 0; i < sentence.length; i += maxSegmentChars) {
          const slice = sentence.slice(i, i + maxSegmentChars);
          if (fitted.length >= maxSegments) {
            truncatedAtIndex = consumedChars;
            break outer;
          }
          fitted.push({
            index: segmentCounter++,
            text: slice,
            speaker: seg.speaker,
            strategy: "hard-wrap",
          });
          consumedChars += slice.length;
        }
        continue;
      }
      const nextLen = buffer.length === 0 ? sentence.length : buffer.length + 1 + sentence.length;
      if (nextLen > maxSegmentChars) {
        if (flushBuffer("sentence-chunk")) break outer;
        buffer = sentence;
      } else {
        buffer = buffer.length === 0 ? sentence : `${buffer} ${sentence}`;
      }
    }
    if (flushBuffer("sentence-chunk")) break outer;
  }

  return {
    segments: fitted,
    speakerSplitDetected,
    detectedSpeakers,
    totalChars,
    truncatedAtIndex,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface SpeakerTurn {
  speaker: string | null;
  text: string;
}

/**
 * Attempts a speaker-turn split. Returns null when no usable speaker
 * labels are found (so the caller falls back to paragraph split).
 *
 * A "usable" split requires:
 *   - At least 2 distinct speaker labels in the transcript, AND
 *   - At least 2 turn boundaries (otherwise it's a single quote, not
 *     a multi-speaker conversation).
 */
function trySpeakerTurnSplit(trimmed: string): SpeakerTurn[] | null {
  const lines = trimmed.split(/\r?\n/);
  const turns: SpeakerTurn[] = [];
  let current: SpeakerTurn | null = null;

  for (const line of lines) {
    const match = line.match(SPEAKER_LABEL_REGEX);
    if (match) {
      if (current && current.text.trim().length > 0) {
        turns.push({
          speaker: current.speaker,
          text: current.text.trim(),
        });
      }
      const speakerRaw = match[1].trim();
      const speaker = speakerRaw.length > 0 ? speakerRaw : null;
      const remainder = line.slice(match[0].length);
      current = { speaker, text: remainder };
    } else if (current) {
      // Continuation of prior speaker's turn.
      current.text += (current.text.length === 0 ? "" : "\n") + line;
    } else {
      // Pre-amble before any label — treat as null-speaker prelude.
      current = { speaker: null, text: line };
    }
  }
  if (current && current.text.trim().length > 0) {
    turns.push({
      speaker: current.speaker,
      text: current.text.trim(),
    });
  }

  const distinctSpeakers = new Set(turns.map((t) => t.speaker).filter((s): s is string => s !== null));
  if (distinctSpeakers.size < 2 || turns.length < 2) {
    return null;
  }
  return turns;
}
