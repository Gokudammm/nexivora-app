import { notFound } from "next/navigation";

import { FeedbackRounds } from "@/components/project/feedback-rounds";
import { SECTION_BY_KIND } from "@/config/sections";
import { requireAuth } from "@/lib/auth/guards";
import { releasedFeedback } from "@/lib/db/queries/feedback";
import { requireEditableProject } from "@/lib/db/queries/project-edit";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Feedback",
  description: "Released marks, per-member reasons and section notes from your faculty guide.",
  index: false,
  path: "/projects",
});

/**
 * `/projects/[slug]/feedback` — the other half of the review screen.
 *
 * Phase 9's deliverable is that *feedback is visible to the group immediately
 * on release*, and until this page existed the release had nowhere to land: a
 * faculty member could mark, differentiate and release a round, and the group
 * would see exactly nothing. The evaluation existed in the database and in no
 * interface — which is the same as not existing.
 *
 * Two things this page does that the review screen deliberately does not.
 *
 * **It shows every member's reason, not only your own.** The review screen
 * warns the marker that "the group sees this" while they are writing it, and
 * this is where that promise is kept. A per-member mark that only its subject
 * can see is unarguable in exactly the wrong way — the person best placed to
 * say "that is not what happened" is the teammate whose share it is being
 * compared against.
 *
 * **Drafts do not reach it.** Not filtered here; filtered in the query
 * (`releasedFeedback`), so an unreleased round is never in the payload.
 */
export default async function FeedbackPage({ params }: PageProps<"/projects/[slug]/feedback">) {
  const { slug } = await params;
  const viewer = await requireAuth(`/projects/${slug}/feedback`);
  const project = await requireEditableProject(viewer, slug);

  if (!project) notFound();

  const { evaluations, notes } = await releasedFeedback(project);

  return (
    <FeedbackRounds
      viewerId={viewer.userId}
      rounds={evaluations.map((evaluation) => ({
        id: evaluation.id,
        round: evaluation.round,
        groupScore: evaluation.groupScore === null ? null : Number(evaluation.groupScore),
        outcome: evaluation.outcome,
        comments: evaluation.comments,
        releasedAt: evaluation.releasedAt!,
        evaluatorName: evaluation.evaluator.name,
        evaluatorTitle: evaluation.evaluator.facultyProfile?.designation ?? null,
        rubricName: `${evaluation.rubric.name} · v${evaluation.rubric.version}`,
        criteria: evaluation.rubric.criteria.map((criterion) => ({
          id: criterion.id,
          name: criterion.name,
          weight: criterion.weight,
          groupScore:
            evaluation.scores.find(
              (score) => score.criterionId === criterion.id && score.memberId === null,
            )?.score ?? null,
        })),
        members: [
          ...new Map(
            evaluation.scores
              .filter((score) => score.member !== null)
              .map((score) => [score.member!.id, score.member!]),
          ).values(),
        ].map((member) => ({
          id: member.id,
          name: member.name,
          avatarUrl: member.avatarUrl,
          scores: evaluation.rubric.criteria.map((criterion) => ({
            criterionId: criterion.id,
            score:
              evaluation.scores.find(
                (score) => score.criterionId === criterion.id && score.memberId === member.id,
              )?.score ?? null,
          })),
          reason:
            evaluation.scores.find((score) => score.memberId === member.id && score.reason)
              ?.reason ?? null,
        })),
      }))}
      notes={notes.map((note) => ({
        id: note.id,
        body: note.body,
        authorName: note.author.name,
        createdAt: note.createdAt,
        resolvedAt: note.resolvedAt,
        sectionLabel: note.section ? SECTION_BY_KIND[note.section.kind].label : "the project",
      }))}
    />
  );
}
