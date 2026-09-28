import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { GOVERNANCE_EVENT_LABELS, type GovernanceEventType } from "@/lib/governance/activity";
import { getProgram, listProgramActivity } from "@/lib/governance/queries";

export const metadata: Metadata = { title: "Activity · GovernanceOS" };
export const dynamic = "force-dynamic";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export default async function ProgramActivityPage({ params }: { params: { programId: string } }) {
  const program = await getProgram(params.programId);
  if (!program) notFound();
  const events = await listProgramActivity(program.id, 100);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-text-primary">Program activity</h2>
        <p className="max-w-2xl text-xs leading-relaxed text-text-muted">
          The governance audit trail, on SLATE&apos;s shared activity log. Visible only to members of this program.
        </p>
      </div>
      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-subtle p-6 text-center text-xs text-text-muted">No activity yet.</p>
      ) : (
        <ol className="relative flex flex-col gap-2 border-l border-border-subtle pl-4">
          {events.map((e) => (
            <li key={e.id} className="flex flex-col gap-1 rounded-xl border border-border-subtle bg-bg-surface p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Badge tone="brand" variant="outline">
                    {GOVERNANCE_EVENT_LABELS[e.eventType as GovernanceEventType] ?? "Event"}
                  </Badge>
                  <span className="text-sm text-text-primary">{e.title}</span>
                </span>
                <span className="text-[11px] text-text-muted">
                  {e.actorName ?? "Operator"} · {fmt(e.createdAt)}
                </span>
              </div>
              {e.summary ? <p className="text-xs leading-relaxed text-text-secondary">{e.summary}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
