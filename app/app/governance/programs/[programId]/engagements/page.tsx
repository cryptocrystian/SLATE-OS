import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EngagementLinkForm } from "@/components/governance/engagement-link-form";
import { UnlinkEngagementButton } from "@/components/governance/controls";
import { getProgramRole } from "@/lib/governance/authorization";
import { can } from "@/lib/governance/permissions";
import { getProgram, listEngagementLinks, listLinkableEngagements } from "@/lib/governance/queries";
import { humanizeToken } from "@/lib/governance/types";

export const metadata: Metadata = { title: "Engagements · GovernanceOS" };
export const dynamic = "force-dynamic";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function ProgramEngagementsPage({ params }: { params: { programId: string } }) {
  const program = await getProgram(params.programId);
  if (!program) notFound();
  const [links, role, engagements] = await Promise.all([
    listEngagementLinks(program.id),
    getProgramRole(program.id),
    listLinkableEngagements(),
  ]);
  const activeRefs = new Set(links.filter((l) => !l.unlinkedAt).map((l) => l.engagementRef));
  // Client programs link their own account's engagements; internal/venture may link any.
  const candidates = engagements.filter(
    (e) => !activeRefs.has(e.id) && (program.programKind !== "client" || e.accountId === program.accountId),
  );
  const writable = program.status !== "archived";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-text-primary">Linked engagements</h2>
        <p className="max-w-2xl text-xs leading-relaxed text-text-muted">
          ConsultOS engagements are time-bounded delivery containers. They link to this program; they never own it. Completing, unlinking
          or deleting an engagement cannot remove governance state.
        </p>
      </div>

      {writable && can(role, "engagement.link") ? <EngagementLinkForm programId={program.id} engagements={candidates} /> : null}

      {links.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-subtle p-6 text-center text-xs text-text-muted">No engagements linked yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {links.map((l) => (
            <li key={l.id} className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  {l.engagementId ? (
                    <Link href={`/app/engagements/${l.engagementId}`} className="text-sm font-semibold text-text-primary hover:underline">
                      {l.engagementNameSnapshot}
                    </Link>
                  ) : (
                    <span className="text-sm font-semibold text-text-secondary">{l.engagementNameSnapshot}</span>
                  )}
                  <Badge tone="neutral" variant="outline">
                    {humanizeToken(l.relationshipType)}
                  </Badge>
                  {l.unlinkedAt ? (
                    <Badge tone="neutral">Unlinked</Badge>
                  ) : (
                    <Badge tone="success" dot>
                      <ShieldCheck className="mr-1 h-3 w-3" aria-hidden />
                      Linked · retention hold
                    </Badge>
                  )}
                  {!l.engagementId ? <Badge tone="warning" variant="outline">Engagement deleted — snapshot retained</Badge> : null}
                </span>
                <span className="text-[11px] text-text-muted">
                  Linked {fmt(l.linkedAt)}
                  {l.unlinkedAt ? ` · unlinked ${fmt(l.unlinkedAt)}${l.unlinkReason ? ` — ${l.unlinkReason}` : ""}` : ""}
                </span>
              </div>
              {!l.unlinkedAt && writable && can(role, "engagement.unlink") ? (
                <UnlinkEngagementButton programId={program.id} linkId={l.id} name={l.engagementNameSnapshot} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
