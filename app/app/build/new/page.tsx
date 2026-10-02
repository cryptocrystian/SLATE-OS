import type { Metadata } from "next";
import { Hammer } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateProjectForm } from "@/components/build/forms";
import { requireWorkspaceMember } from "@/lib/auth/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New build project" };
export const dynamic = "force-dynamic";

export default async function NewBuildProjectPage() {
  const member = await requireWorkspaceMember({ roles: ["owner", "operator"] });
  if (!member.ok) {
    return (
      <EmptyState
        icon={<Hammer className="h-4 w-4" />}
        title="Operator role required"
        description="Creating a BuildOS project requires the workspace owner or operator role."
      />
    );
  }
  // Engagement picker for the ConsultOS entry point (lineage only; the DB
  // re-validates the engagement belongs to this workspace and places the hold).
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("engagements")
    .select("id, name")
    .eq("workspace_id", member.actor.workspaceId)
    .order("created_at", { ascending: false })
    .limit(200);
  const engagements = (data ?? []).map((e) => ({ id: e.id as string, name: e.name as string }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="BuildOS · New project"
        title="Start a build project."
        description="A project is one codebase under governed delivery. It starts in intake; work is claimable only once it is marked ready and activated."
      />
      <CreateProjectForm engagements={engagements} />
    </div>
  );
}
