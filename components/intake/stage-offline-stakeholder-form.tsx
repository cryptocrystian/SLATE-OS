"use client";

import * as React from "react";
import { Inbox, ShieldOff } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABEL } from "@/lib/intake/helpers";
import { createOfflineStakeholderIntakeSessionAction } from "@/lib/intake/offline-actions";
import type {
  CreateOfflineStakeholderResult,
  IntakeSourceConfidence,
  IntakeSourceType,
  StakeholderRole,
} from "@/lib/intake/types";

/**
 * Sprint I3 — Stage Offline Stakeholder Form.
 *
 * Canon: docs/37 § 3.1 + § 4. Operator captures a stakeholder whose
 * intake was conducted outside SLATE (meeting notes, transcript, email
 * thread, document review, or operator-typed answers from memory).
 *
 * Critical boundary copy: this form never mints a token, never sends a
 * message, and never lands the stakeholder on a public route. The
 * "Save without sending" affirmation chip is rendered above the submit
 * button to make this contract obvious to the operator at the moment
 * of action.
 */

const OFFLINE_SOURCE_OPTIONS: Array<{
  value: Exclude<IntakeSourceType, "live_link">;
  label: string;
  helper: string;
}> = [
  {
    value: "operator_entered",
    label: "Operator-entered",
    helper: "You are typing the answer directly from notes or memory.",
  },
  {
    value: "meeting_notes",
    label: "Meeting notes",
    helper: "Notes collected during a meeting or working session.",
  },
  {
    value: "transcript",
    label: "Transcript",
    helper: "Excerpt from a recorded call or transcript file.",
  },
  {
    value: "email_paste",
    label: "Email paste",
    helper:
      "Pasted from an email thread. SLATE did not send or receive this email.",
  },
  {
    value: "document_upload",
    label: "Document upload",
    helper:
      "Stakeholder shared a document. Attach the document separately as supporting evidence.",
  },
];

const CONFIDENCE_OPTIONS: Array<{
  value: IntakeSourceConfidence;
  label: string;
  helper: string;
}> = [
  {
    value: "first_hand",
    label: "First-hand",
    helper: "Stakeholder spoke or wrote this themselves.",
  },
  {
    value: "second_hand",
    label: "Second-hand",
    helper: "Operator relayed the stakeholder's perspective from memory or notes.",
  },
  {
    value: "inferred",
    label: "Inferred",
    helper:
      "Operator inferred this from indirect signal — flag the synthesis review.",
  },
];

const ROLE_OPTIONS: StakeholderRole[] = [
  "executive",
  "operations",
  "sales",
  "marketing",
  "finance",
  "it",
  "frontline",
  "customer-success",
  "other",
];

export interface StageOfflineStakeholderFormProps {
  engagementId: string;
}

export function StageOfflineStakeholderForm({
  engagementId,
}: StageOfflineStakeholderFormProps) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [role, setRole] = React.useState<StakeholderRole>("operations");
  const [department, setDepartment] = React.useState("");
  const [sourceType, setSourceType] =
    React.useState<Exclude<IntakeSourceType, "live_link">>("meeting_notes");
  const [sourceConfidence, setSourceConfidence] =
    React.useState<IntakeSourceConfidence | "">("");
  const [collectedAt, setCollectedAt] = React.useState("");
  const [operatorNotes, setOperatorNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<{
    name: string;
    sessionId: string;
    sourceType: IntakeSourceType;
  } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setPending(true);
    try {
      const result: CreateOfflineStakeholderResult =
        await createOfflineStakeholderIntakeSessionAction({
          engagementId,
          name,
          email: email || undefined,
          title: title || undefined,
          role,
          department: department || undefined,
          sourceType,
          sourceConfidence: sourceConfidence || undefined,
          collectedAt: collectedAt || undefined,
          operatorNotes: operatorNotes || undefined,
        });
      if (result.ok) {
        setSuccess({
          name,
          sessionId: result.sessionId,
          sourceType: result.sourceType,
        });
        setName("");
        setEmail("");
        setTitle("");
        setDepartment("");
        setRole("operations");
        setSourceType("meeting_notes");
        setSourceConfidence("");
        setCollectedAt("");
        setOperatorNotes("");
      } else {
        setError(translateError(result.error));
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const selectedSourceHelper = OFFLINE_SOURCE_OPTIONS.find(
    (o) => o.value === sourceType,
  )?.helper;

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Stage offline stakeholder
            </span>
            <Badge tone="neutral" variant="outline">
              No message sent
            </Badge>
          </div>
          <h2 className="text-base font-semibold tracking-tight text-text-primary">
            Capture a stakeholder whose intake happened outside SLATE
          </h2>
          <p className="text-xs leading-relaxed text-text-muted">
            For when the operator already collected the perspective (meeting,
            transcript, email thread, or document review). SLATE will not send
            an invite and will not mint a public link. The response feeds the
            operator-side synthesis only.
          </p>
        </div>

        <div
          role="note"
          className="flex items-start gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-3 text-xs text-text-secondary"
        >
          <ShieldOff className="mt-0.5 h-3.5 w-3.5 text-text-muted" />
          <span className="leading-relaxed">
            <span className="font-medium text-text-primary">
              Save without sending.
            </span>{" "}
            This row is operator-only. It will not appear on any client-facing
            report or proposal until you explicitly clear it through the
            findings-readiness gate.
          </span>
        </div>

        <form
          onSubmit={onSubmit}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <Input
            label="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="VP Operations · Casey M."
            required
            autoComplete="off"
            hint="A real name, role-level label, or pseudonym you'll recognize."
          />
          <Input
            label="Email (optional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="(leave empty if not needed)"
            autoComplete="off"
            hint="No invite is sent. Email is for your records only."
          />
          <Input
            label="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VP Operations"
            autoComplete="off"
          />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="offline-stakeholder-role"
              className="text-xs font-medium tracking-tight text-text-secondary"
            >
              Role
            </label>
            <select
              id="offline-stakeholder-role"
              value={role}
              onChange={(e) => setRole(e.target.value as StakeholderRole)}
              className="h-10 w-full rounded-md border border-border-subtle bg-bg-elevated/60 px-3 text-sm text-text-primary outline-none transition-[border,box-shadow] focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Department (optional)"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="Operations"
            autoComplete="off"
            className="sm:col-span-2"
          />

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="offline-source-type"
              className="text-xs font-medium tracking-tight text-text-secondary"
            >
              Source type
            </label>
            <select
              id="offline-source-type"
              value={sourceType}
              onChange={(e) =>
                setSourceType(
                  e.target.value as Exclude<IntakeSourceType, "live_link">,
                )
              }
              className="h-10 w-full rounded-md border border-border-subtle bg-bg-elevated/60 px-3 text-sm text-text-primary outline-none transition-[border,box-shadow] focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
            >
              {OFFLINE_SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {selectedSourceHelper ? (
              <p className="text-[11px] leading-relaxed text-text-muted">
                {selectedSourceHelper}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="offline-source-confidence"
              className="text-xs font-medium tracking-tight text-text-secondary"
            >
              Source confidence (optional)
            </label>
            <select
              id="offline-source-confidence"
              value={sourceConfidence}
              onChange={(e) =>
                setSourceConfidence(
                  e.target.value as IntakeSourceConfidence | "",
                )
              }
              className="h-10 w-full rounded-md border border-border-subtle bg-bg-elevated/60 px-3 text-sm text-text-primary outline-none transition-[border,box-shadow] focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
            >
              <option value="">— Choose if applicable —</option>
              {CONFIDENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Collected at (optional)"
            type="date"
            value={collectedAt}
            onChange={(e) => setCollectedAt(e.target.value)}
            autoComplete="off"
            hint="When was the offline content actually captured?"
          />

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="offline-operator-notes"
              className="text-xs font-medium tracking-tight text-text-secondary"
            >
              Operator notes (optional, 2000 chars max)
            </label>
            <textarea
              id="offline-operator-notes"
              value={operatorNotes}
              onChange={(e) => setOperatorNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Audit context only — not shown to the client. E.g. 'Captured during Tuesday's leadership sync.'"
              className="w-full rounded-md border border-border-subtle bg-bg-elevated/60 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none transition-[border,box-shadow] focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
            />
            <p className="text-[11px] leading-relaxed text-text-muted">
              {operatorNotes.length}/2000
            </p>
          </div>

          <div className="sm:col-span-2 flex items-center justify-between gap-3">
            <p className="text-[11px] text-text-muted">
              No invite, no token, no public link. Operator-side only.
            </p>
            <Button
              type="submit"
              variant="primary"
              size="md"
              leadingIcon={<Inbox className="h-4 w-4" />}
              disabled={pending || !name.trim()}
            >
              {pending ? "Saving…" : "Save without sending"}
            </Button>
          </div>
        </form>

        {error ? (
          <p className="rounded-md border border-status-critical/40 bg-status-critical/10 p-3 text-xs text-status-critical">
            {error}
          </p>
        ) : null}

        {success ? (
          <div className="flex flex-col gap-2 rounded-md border border-status-success/40 bg-status-success/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-status-success">
                Offline stakeholder staged
              </span>
              <Badge tone="success" variant="outline">
                No message sent
              </Badge>
            </div>
            <p className="text-sm text-text-primary">
              <span className="font-semibold">{success.name}</span> staged as{" "}
              {OFFLINE_SOURCE_OPTIONS.find((o) => o.value === success.sourceType)
                ?.label ?? success.sourceType}
              . Add their responses below — each response stays draft until
              you mark it ready for synthesis.
            </p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

type OfflineStakeholderFailure = Exclude<
  CreateOfflineStakeholderResult,
  { ok: true }
>["error"];

function translateError(code: OfflineStakeholderFailure): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again to stage offline stakeholders.";
    case "invalid-engagement":
    case "engagement-not-found":
      return "This engagement could not be found. Refresh the page and try again.";
    case "invalid-role":
      return "Pick a valid stakeholder role.";
    case "invalid-source-type":
      return "Pick a valid offline source type.";
    case "invalid-source-confidence":
      return "Pick a valid source confidence.";
    case "missing-fields":
      return "Display name is required. Email must be valid if supplied.";
    case "field-too-long":
      return "Operator notes are limited to 2000 characters.";
    case "service-error":
    default:
      return "We couldn't stage this offline stakeholder. Please try again.";
  }
}
