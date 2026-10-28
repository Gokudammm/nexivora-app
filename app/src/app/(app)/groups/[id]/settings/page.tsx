import { notFound } from "next/navigation";

import { GroupSettings } from "@/components/workspace/group-settings";
import { requireAuth } from "@/lib/auth/guards";
import { can } from "@/lib/authz/policy";
import { groupResource, isLead, requireWorkspace } from "@/lib/db/queries/group";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Group settings",
  description: "Group details, membership, join policy and archiving.",
  index: false,
  path: "/groups",
});

/**
 * `/groups/[id]/settings`.
 *
 * Reachable by any member — the tab is hidden from non-leads, but hiding a door
 * is not locking it, and a member who types the URL should see the page and
 * find the controls unavailable rather than get a 404 that suggests the group
 * does not exist. Every mutation re-checks on the server regardless.
 */
export default async function GroupSettingsPage({ params }: PageProps<"/groups/[id]/settings">) {
  const { id } = await params;
  const viewer = await requireAuth(`/groups/${id}/settings`);
  const workspace = await requireWorkspace(viewer, id);

  if (!workspace) notFound();

  const lead = isLead(workspace, viewer.userId);

  return (
    <GroupSettings
      workspace={{
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        sizeLimit: workspace.sizeLimit,
        visibility: workspace.visibility,
        joinPolicy: workspace.joinPolicy,
        archivedAt: workspace.archivedAt,
        members: workspace.members.map((member) => ({
          id: member.id,
          role: member.role,
          user: member.user,
        })),
      }}
      viewerId={viewer.userId}
      isLead={lead}
      canInvite={can(viewer, "group:invite", groupResource(workspace))}
    />
  );
}
