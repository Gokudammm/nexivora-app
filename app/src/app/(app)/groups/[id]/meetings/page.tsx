import { notFound } from "next/navigation";

import { Meetings } from "@/components/workspace/meetings";
import { requireAuth } from "@/lib/auth/guards";
import { can } from "@/lib/authz/policy";
import { groupResource, requireWorkspace } from "@/lib/db/queries/group";
import { listMeetings } from "@/lib/db/queries/workspace";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Meetings",
  description:
    "The group's meetings — agenda, attendance and minutes, with action items that become tasks. We store a join link; we do not host video.",
  index: false,
  path: "/groups",
});

export default async function MeetingsPage({ params }: PageProps<"/groups/[id]/meetings">) {
  const { id } = await params;
  const viewer = await requireAuth(`/groups/${id}/meetings`);
  const workspace = await requireWorkspace(viewer, id);

  if (!workspace) notFound();

  const { upcoming, past } = await listMeetings(workspace);
  const canSchedule = can(viewer, "meeting:schedule", groupResource(workspace));

  return (
    <Meetings
      groupId={workspace.id}
      upcoming={upcoming}
      past={past}
      viewerId={viewer.userId}
      canSchedule={canSchedule}
      handles={workspace.members
        .map((member) => member.user.username)
        .filter((username): username is string => Boolean(username))}
    />
  );
}
