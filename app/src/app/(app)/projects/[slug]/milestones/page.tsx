import { notFound } from "next/navigation";

import { Milestones } from "@/components/project/milestones";
import { requireAuth } from "@/lib/auth/guards";
import { capabilities, requireEditableProject } from "@/lib/db/queries/project-edit";
import { db } from "@/lib/db/client";
import { isEditable } from "@/lib/project/lifecycle";
import { milestoneState } from "@/lib/project/progress";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Milestones",
  description:
    "Dated checkpoints for a project, each owned by a member and closed with a peer review.",
  index: false,
  path: "/projects",
});

/**
 * `/projects/[slug]/milestones`.
 *
 * The at-risk state is **computed against now**, never read from the stored
 * enum: a milestone marked at-risk in March is still marked at-risk in June
 * whatever happened in between. The state a milestone is *in* is data; whether
 * it is late is a fact about today.
 */
export default async function MilestonesPage({ params }: PageProps<"/projects/[slug]/milestones">) {
  const { slug } = await params;
  const viewer = await requireAuth(`/projects/${slug}/milestones`);
  const project = await requireEditableProject(viewer, slug);

  if (!project) notFound();

  const caps = capabilities(viewer, project);
  const readOnly = !caps.edit || !isEditable(project.status);
  const now = new Date();

  // Tasks per milestone, so a milestone shows what it is actually made of.
  const tasks = project.groupId
    ? await db.task.findMany({
        where: { groupId: project.groupId, deletedAt: null, milestoneId: { not: null } },
        select: { id: true, title: true, status: true, milestoneId: true },
        orderBy: { position: "asc" },
      })
    : [];

  const members = (project.group?.members ?? []).map((member) => ({
    id: member.user.id,
    name: member.user.name,
    avatarUrl: member.user.avatarUrl,
  }));

  return (
    <Milestones
      slug={project.slug}
      groupId={project.groupId}
      readOnly={readOnly}
      members={members}
      milestones={project.milestones.map((milestone) => ({
        id: milestone.id,
        title: milestone.title,
        description: milestone.description,
        dueDate: milestone.dueDate,
        completedAt: milestone.completedAt,
        ownerId: milestone.ownerId,
        // Derived here, once, so every consumer sees the same answer.
        state: milestoneState(milestone, now),
        tasks: tasks
          .filter((task) => task.milestoneId === milestone.id)
          .map((task) => ({ id: task.id, title: task.title, status: task.status })),
      }))}
    />
  );
}
