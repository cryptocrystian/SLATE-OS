"use client";

import * as React from "react";
import {
  activatePolicyVersionAction,
  retirePolicyVersionAction,
  transitionAssetAction,
  transitionProgramAction,
  unlinkEngagementAction,
} from "@/lib/governance/actions";
import { LABELS, type LifecycleStatus, type ProgramStatus } from "@/lib/governance/types";
import { ReasonActionButton } from "./reason-action-button";

/** Allowed lifecycle moves — mirrors governed_assets_guard() in 0027. */
export const ASSET_TRANSITIONS: Record<LifecycleStatus, LifecycleStatus[]> = {
  proposed: ["assessment", "active", "retired"],
  assessment: ["proposed", "active", "retired"],
  active: ["assessment", "restricted", "retired"],
  restricted: ["assessment", "active", "retired"],
  retired: [],
};

const ASSET_VERB: Record<LifecycleStatus, string> = {
  proposed: "Return to proposed",
  assessment: "Send to assessment",
  active: "Mark active",
  restricted: "Restrict",
  retired: "Retire",
};

export function AssetLifecycleControls({
  programId,
  assetId,
  status,
  canTransition,
  canRetire,
}: {
  programId: string;
  assetId: string;
  status: LifecycleStatus;
  canTransition: boolean;
  canRetire: boolean;
}) {
  const moves = ASSET_TRANSITIONS[status].filter((to) => (to === "retired" ? canRetire : canTransition));
  if (moves.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {moves.map((to) => (
        <ReasonActionButton
          key={to}
          label={ASSET_VERB[to]}
          variant={to === "retired" ? "ghost" : "secondary"}
          tone={to === "retired" ? "danger" : "default"}
          title={`${ASSET_VERB[to]}?`}
          description={
            to === "active"
              ? "Marks the asset as operating. It will show as “not yet governance-approved” until a human approval decision exists (G3)."
              : to === "retired"
                ? "Retirement is terminal. The asset and its full history remain in the registry."
                : `Moves the asset from ${LABELS.lifecycle[status]} to ${LABELS.lifecycle[to]}.`
          }
          confirmLabel={ASSET_VERB[to]}
          successTitle={`Asset ${LABELS.lifecycle[to].toLowerCase()}`}
          onConfirm={(reason) => transitionAssetAction(programId, assetId, to, reason)}
        />
      ))}
    </div>
  );
}

const PROGRAM_MOVES: Record<ProgramStatus, Array<{ to: ProgramStatus; label: string }>> = {
  draft: [
    { to: "active", label: "Activate program" },
    { to: "archived", label: "Archive" },
  ],
  active: [
    { to: "paused", label: "Pause" },
    { to: "archived", label: "Archive" },
  ],
  paused: [
    { to: "active", label: "Resume" },
    { to: "archived", label: "Archive" },
  ],
  archived: [],
};

export function ProgramStatusControls({ programId, status }: { programId: string; status: ProgramStatus }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PROGRAM_MOVES[status].map((m) => (
        <ReasonActionButton
          key={m.to}
          label={m.label}
          variant={m.to === "archived" ? "ghost" : "primary"}
          tone={m.to === "archived" ? "danger" : "default"}
          title={`${m.label}?`}
          description={
            m.to === "archived"
              ? "Archiving is terminal: the program becomes read-only. Nothing is deleted — history, assets and policies are retained."
              : undefined
          }
          confirmLabel={m.label}
          successTitle={`Program ${LABELS.programStatus[m.to].toLowerCase()}`}
          onConfirm={(reason) => transitionProgramAction(programId, m.to, reason)}
        />
      ))}
    </div>
  );
}

export function PolicyVersionControls({
  programId,
  versionId,
  version,
  status,
  canActivate,
  canRetire,
  hasActive,
}: {
  programId: string;
  versionId: string;
  version: number;
  status: "draft" | "active" | "superseded" | "retired";
  canActivate: boolean;
  canRetire: boolean;
  hasActive: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" && canActivate ? (
        <ReasonActionButton
          label={`Activate v${version}`}
          variant="primary"
          title={`Activate v${version} (advisory)?`}
          description={
            hasActive
              ? "The currently active version will be superseded atomically. Both remain in the version history; neither can be edited afterwards."
              : "Once active, this version's content can never be edited — changes require a new version."
          }
          confirmLabel="Activate"
          successTitle={`v${version} is now active`}
          onConfirm={(reason) => activatePolicyVersionAction(programId, versionId, reason)}
        />
      ) : null}
      {(status === "draft" || status === "active") && canRetire ? (
        <ReasonActionButton
          label={status === "draft" ? "Discard draft" : "Retire policy"}
          variant="ghost"
          tone="danger"
          title={status === "draft" ? `Discard draft v${version}?` : `Retire v${version}?`}
          description="The version is kept in history with status “retired”."
          confirmLabel={status === "draft" ? "Discard" : "Retire"}
          successTitle={`v${version} retired`}
          onConfirm={(reason) => retirePolicyVersionAction(programId, versionId, reason)}
        />
      ) : null}
    </div>
  );
}

export function UnlinkEngagementButton({ programId, linkId, name }: { programId: string; linkId: string; name: string }) {
  return (
    <ReasonActionButton
      label="Unlink"
      variant="ghost"
      title={`Unlink ${name}?`}
      description="Releases the retention hold on the engagement. The link record, its snapshot, and all governance state stay with the program."
      confirmLabel="Unlink"
      successTitle="Engagement unlinked"
      onConfirm={(reason) => unlinkEngagementAction(programId, linkId, reason)}
    />
  );
}
