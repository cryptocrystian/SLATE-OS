"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, FileText, Plus } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IntakeSourceTypeChip } from "@/components/intake/intake-source-type-chip";
import { IntakeResponseStatusChip } from "@/components/intake/intake-response-status-chip";
import { OfflineResponseForm } from "@/components/intake/offline-response-form";
import { OfflineResponseActions } from "@/components/intake/offline-response-actions";
import { ROLE_LABEL } from "@/lib/intake/helpers";
import type {
  OfflineStakeholderResponse,
  OfflineStakeholderSession,
} from "@/lib/intake/offline-queries";
import type { EngagementIntakeDocument } from "@/lib/intake/types";
import type { IntakeSourceType } from "@/lib/intake/types";

/**
 * Sprint I3 — Offline intake panel.
 *
 * Renders the operator-only offline-intake surface: a list of offline
 * stakeholder sessions, each with its captured responses (showing
 * status chip + source-type chip + lifecycle actions), plus an inline
 * "Capture another response" form per session.
 *
 * Canon: docs/37 § 4 + § 5. The panel is operator-only — nothing on
 * here is rendered into any client-facing route.
 */

export interface OfflineIntakePanelProps {
  sessions: OfflineStakeholderSession[];
  documents: EngagementIntakeDocument[];
}

export function OfflineIntakePanel({
  sessions,
  documents,
}: OfflineIntakePanelProps) {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  function toggleSession(sessionId: string) {
    setExpanded((prev) => ({ ...prev, [sessionId]: !prev[sessionId] }));
  }

  if (sessions.length === 0 && documents.length === 0) {
    return (
      <Card variant="base">
        <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Offline sessions
          </span>
          <p className="text-xs leading-relaxed text-text-muted">
            No offline stakeholder sessions staged yet. Use the form above to
            capture an intake conducted outside SLATE (meeting, transcript,
            email thread, or document review).
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {sessions.length > 0 ? (
        <Card variant="base">
          <CardBody className="flex flex-col gap-3 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                Offline stakeholder sessions ({sessions.length})
              </span>
              <Badge tone="neutral" variant="outline">
                Operator-only
              </Badge>
            </div>

            <ul className="flex flex-col gap-2.5">
              {sessions.map((session) => {
                const isOpen = expanded[session.id] ?? false;
                return (
                  <li
                    key={session.id}
                    className="rounded-md border border-border-subtle bg-bg-elevated/40"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSession(session.id)}
                      className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-bg-elevated/60"
                    >
                      <div className="flex flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-text-primary">
                            {session.name}
                          </span>
                          <Badge tone="neutral" variant="outline">
                            {ROLE_LABEL[session.role]}
                          </Badge>
                          <IntakeSourceTypeChip
                            sourceType={session.sourceType}
                          />
                          {session.sourceConfidence ? (
                            <Badge tone="neutral" variant="outline">
                              {confidenceLabel(session.sourceConfidence)}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                          {session.title ? <span>{session.title}</span> : null}
                          {session.department ? (
                            <span>· {session.department}</span>
                          ) : null}
                          <span>
                            · {session.responses.length} response
                            {session.responses.length === 1 ? "" : "s"}
                          </span>
                          {readyCount(session.responses) > 0 ? (
                            <span className="text-status-success">
                              · {readyCount(session.responses)} ready
                            </span>
                          ) : null}
                          {draftCount(session.responses) > 0 ? (
                            <span className="text-status-warning">
                              · {draftCount(session.responses)} draft
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-text-muted" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-text-muted" />
                      )}
                    </button>

                    {isOpen ? (
                      <div className="flex flex-col gap-3 border-t border-border-subtle p-3">
                        {session.operatorNotes ? (
                          <p className="rounded-md border border-border-subtle bg-bg-page/40 p-2 text-[11px] leading-relaxed text-text-secondary">
                            <span className="uppercase tracking-[0.16em] text-text-muted">
                              Operator notes ·{" "}
                            </span>
                            {session.operatorNotes}
                          </p>
                        ) : null}

                        {session.responses.length > 0 ? (
                          <ul className="flex flex-col gap-2">
                            {session.responses.map((response) => (
                              <ResponseRow
                                key={response.id}
                                response={response}
                              />
                            ))}
                          </ul>
                        ) : (
                          <p className="text-[11px] text-text-muted">
                            No responses captured yet for this stakeholder.
                          </p>
                        )}

                        <details className="rounded-md border border-border-subtle bg-bg-page/30 p-2.5">
                          <summary className="cursor-pointer text-[11px] font-medium text-text-secondary [&::-webkit-details-marker]:hidden flex items-center gap-1.5">
                            <Plus className="h-3.5 w-3.5" />
                            Capture another response
                          </summary>
                          <div className="mt-3">
                            <OfflineResponseForm
                              sessionId={session.id}
                              defaultSourceType={
                                session.sourceType === "live_link"
                                  ? "operator_entered"
                                  : (session.sourceType as Exclude<
                                      IntakeSourceType,
                                      "live_link"
                                    >)
                              }
                            />
                          </div>
                        </details>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      {documents.length > 0 ? (
        <Card variant="base">
          <CardBody className="flex flex-col gap-3 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-text-muted" />
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                  Offline source documents ({documents.length})
                </span>
              </div>
              <Badge tone="neutral" variant="outline">
                Operator-only · never client-visible
              </Badge>
            </div>
            <ul className="flex flex-col gap-2">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-col gap-1 rounded-md border border-border-subtle bg-bg-elevated/40 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">
                      {doc.title}
                    </span>
                    <IntakeSourceTypeChip sourceType={doc.sourceType} />
                    {doc.sourceConfidence ? (
                      <Badge tone="neutral" variant="outline">
                        {confidenceLabel(doc.sourceConfidence)}
                      </Badge>
                    ) : null}
                  </div>
                  {doc.externalUrl ? (
                    <p className="break-all font-mono text-[11px] text-text-muted">
                      {doc.externalUrl}
                    </p>
                  ) : null}
                  {doc.operatorNotes ? (
                    <p className="text-[11px] leading-relaxed text-text-secondary">
                      <span className="uppercase tracking-[0.16em] text-text-muted">
                        Notes ·{" "}
                      </span>
                      {doc.operatorNotes}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="text-[11px] leading-relaxed text-text-muted">
              Documents feed operator-side findings synthesis only. Document
              upload backend (binary attachments) lands in a future sprint.
            </p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function ResponseRow({ response }: { response: OfflineStakeholderResponse }) {
  const isVoidedOrSuperseded =
    response.responseStatus === "voided" ||
    response.responseStatus === "superseded";
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-page/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <IntakeResponseStatusChip status={response.responseStatus} />
        <IntakeSourceTypeChip sourceType={response.sourceType} />
        <span className="text-[11px] text-text-muted">
          {response.questionLabel ?? response.questionId}
        </span>
      </div>
      <p
        className={`whitespace-pre-wrap text-xs leading-relaxed ${
          isVoidedOrSuperseded
            ? "text-text-muted line-through"
            : "text-text-primary"
        }`}
      >
        {response.answerText}
      </p>
      {response.operatorNotes ? (
        <p className="text-[11px] leading-relaxed text-text-secondary">
          <span className="uppercase tracking-[0.16em] text-text-muted">
            Operator notes ·{" "}
          </span>
          {response.operatorNotes}
        </p>
      ) : null}
      <OfflineResponseActions
        responseId={response.id}
        status={response.responseStatus}
      />
    </li>
  );
}

function readyCount(responses: OfflineStakeholderResponse[]): number {
  return responses.filter((r) => r.responseStatus === "ready_for_synthesis")
    .length;
}

function draftCount(responses: OfflineStakeholderResponse[]): number {
  return responses.filter((r) => r.responseStatus === "draft").length;
}

function confidenceLabel(
  value: "first_hand" | "second_hand" | "inferred",
): string {
  switch (value) {
    case "first_hand":
      return "First-hand";
    case "second_hand":
      return "Second-hand";
    case "inferred":
      return "Inferred";
  }
}
