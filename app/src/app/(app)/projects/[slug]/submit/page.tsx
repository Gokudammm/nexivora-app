import { notFound } from "next/navigation";

import { SubmitChecklist } from "@/components/project/submit-checklist";
import { REQUIRED_SECTIONS, SECTION_BY_KIND } from "@/config/sections";
import { requireAuth } from "@/lib/auth/guards";
import { capabilities, requireEditableProject } from "@/lib/db/queries/project-edit";
import { db } from "@/lib/db/client";
import { milestoneState } from "@/lib/project/progress";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Submit for review",
  description:
    "The pre-submission checklist, and the immutable snapshot taken when a project is submitted.",
  index: false,
  path: "/projects",
});

/**
 * `/projects/[slug]/submit`.
 *
 * The checklist is computed from the same facts `lifecycle.ts` uses for its
 * preconditions, and shows **every** unmet item at once rather than the first
 * one. A submission blocked one reason at a time — fix a section, try again,
 * discover a milestone, try again — is the shape that makes people submit at
 * 3am and blame the tool.
 */
export default async function SubmitPage({ params }: PageProps<"/projects/[slug]/submit">) {
  const { slug } = await params;
  const viewer = await requireAuth(`/projects/${slug}/submit`);
  const project = await requireEditableProject(viewer, slug);

  if (!project) notFound();

  const caps = capabilities(viewer, project);
  const now = new Date();

  const completeKinds = new Set(project.sections.filter((s) => s.complete).map((s) => s.kind));
  const missingSections = REQUIRED_SECTIONS.filter((kind) => !completeKinds.has(kind));

  const openMilestones = project.milestones
    .filter((milestone) => milestoneState(milestone, now) !== "COMPLETE")
    .map((milestone) => milestone.title);

  /* Who still owes a peer review — named, never counted. */
  const outstanding: string[] = [];
  if (project.groupId) {
    const members = project.group?.members ?? [];
    const openMilestone = project.milestones.find((m) => m.state !== "COMPLETE");

    for (const member of members) {
      const given = await db.peerReview.count({
        where: {
          groupId: project.groupId,
          authorId: member.user.id,
          milestoneId: openMilestone?.id ?? null,
        },
      });
      if (given < Math.max(0, members.length - 1)) outstanding.push(member.user.name);
    }
  }

  const files = project.groupId
    ? await db.fileAsset.count({ where: { groupId: project.groupId, deletedAt: null } })
    : 0;

  return (
    <SubmitChecklist
      slug={project.slug}
      status={project.status}
      canSubmit={caps.lead}
      groupId={project.groupId}
      items={[
        {
          key: "sections",
          label: "Every required section is complete",
          ok: missingSections.length === 0,
          detail:
            missingSections.length === 0
              ? `All ${REQUIRED_SECTIONS.length} written.`
              : `Incomplete: ${missingSections.map((kind) => SECTION_BY_KIND[kind].label).join(", ")}.`,
          href: `/projects/${project.slug}/edit`,
        },
        {
          key: "abstract",
          label: "The abstract is written",
          ok: project.abstract.trim().length > 0,
          detail:
            project.abstract.trim().length > 0
              ? "Present."
              : "It is what a reader sees first, and what an embargoed project shows instead of its body.",
          href: `/projects/${project.slug}/edit/details`,
        },
        {
          key: "milestones",
          label: "Every milestone is closed",
          ok: openMilestones.length === 0,
          detail:
            openMilestones.length === 0
              ? project.milestones.length === 0
                ? "No milestones on this project."
                : `All ${project.milestones.length} closed.`
              : `Still open: ${openMilestones.join(", ")}.`,
          href: `/projects/${project.slug}/milestones`,
        },
        {
          key: "reviews",
          label: "Everybody has submitted their peer reviews",
          ok: outstanding.length === 0,
          detail:
            outstanding.length === 0
              ? "Nothing outstanding."
              : `Waiting on ${outstanding.join(", ")}.`,
          href: project.groupId ? `/groups/${project.groupId}/ledger` : undefined,
        },
        {
          key: "files",
          label: "Supporting files are attached",
          ok: true,
          detail:
            files === 0
              ? "No files in the group's library. Not required, but a report with no attachments is unusual."
              : `${files} in the group's file library.`,
          href: project.groupId ? `/groups/${project.groupId}/files` : undefined,
          advisory: true,
        },
      ]}
      submissions={project.submissions.map((submission) => ({
        id: submission.id,
        round: submission.round,
        createdAt: submission.createdAt,
      }))}
    />
  );
}
