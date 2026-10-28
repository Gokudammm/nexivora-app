import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/feedback";
import { ReviewScreen } from "@/components/faculty/review-screen";
import { SECTION_BY_KIND, SECTION_ORDER } from "@/config/sections";
import { requireAuth } from "@/lib/auth/guards";
import { can } from "@/lib/authz/policy";
import { db } from "@/lib/db/client";
import { listRubrics } from "@/lib/db/queries/faculty";
import { requireEditableProject } from "@/lib/db/queries/project-edit";
import { projectResource } from "@/lib/db/queries/projects";
import { scoreMembers } from "@/lib/ledger/score";
import type { Snapshot } from "@/lib/project/snapshot";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Review",
  description:
    "The project record beside the rubric, with the contribution ledger for per-member marks.",
  index: false,
  path: "/projects",
});

/**
 * `/projects/[slug]/review` — the evaluation screen.
 *
 * Two decisions carry this page.
 *
 * **It evaluates the submitted snapshot, not the live record.** Phase 8 takes a
 * byte-stable snapshot on submission precisely so a mark can be defended six
 * months later; reading the live rows instead would mean the thing being marked
 * can change underneath the marker the moment changes are requested.
 *
 * **The ledger sits beside the score inputs.** The spec calls this *"the entire
 * reason the ledger exists"*, and physical adjacency is the whole mechanism —
 * differentiating a member's mark has to be a two-second evidence-backed
 * decision, not a guess a faculty member has to defend later from memory.
 */
export default async function ReviewPage({ params }: PageProps<"/projects/[slug]/review">) {
  const { slug } = await params;
  const viewer = await requireAuth(`/projects/${slug}/review`);
  const project = await requireEditableProject(viewer, slug);

  if (!project) notFound();

  if (!can(viewer, "project:evaluate", projectResource(project))) {
    return (
      <Alert tone="info" title="Not your subject to evaluate">
        Only the faculty member who teaches this project&rsquo;s subject can review it.{" "}
        <Link href="/faculty/submissions" className="font-medium underline underline-offset-4">
          Back to the queue
        </Link>
        .
      </Alert>
    );
  }

  const round = project.submissions[0]?.round ?? 1;

  const [rubrics, evaluation, ledger, feedback, submission] = await Promise.all([
    listRubrics(viewer, project.collegeId),
    db.evaluation.findUnique({
      where: { projectId_round: { projectId: project.id, round } },
      select: {
        id: true,
        rubricId: true,
        outcome: true,
        comments: true,
        releasedAt: true,
        groupScore: true,
        scores: { select: { criterionId: true, memberId: true, score: true, reason: true } },
      },
    }),
    project.groupId
      ? db.ledgerEvent.findMany({
          where: { groupId: project.groupId },
          select: { userId: true, kind: true, weight: true, createdAt: true },
        })
      : Promise.resolve([]),
    db.feedback.findMany({
      where: { projectId: project.id },
      select: {
        id: true,
        sectionId: true,
        body: true,
        resolvedAt: true,
        createdAt: true,
        author: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.projectSubmission.findFirst({
      where: { projectId: project.id, round },
      select: { snapshot: true, createdAt: true, round: true },
    }),
  ]);

  const members = project.members.map((member) => ({
    id: member.user.id,
    name: member.user.name,
    username: member.user.username,
    avatarUrl: member.user.avatarUrl,
  }));

  const scores = scoreMembers(members, ledger);
  const snapshot = submission?.snapshot as unknown as Snapshot | undefined;

  // The submitted text, from the snapshot. Falls back to the live rows only
  // when nothing has been submitted — which happens when a faculty member opens
  // a project that is still in progress.
  const snapshotSections =
    (snapshot?.record as { sections?: { kind: string; body: string }[] } | undefined)?.sections ??
    null;

  const sections = SECTION_ORDER.map((kind) => {
    const live = project.sections.find((section) => section.kind === kind);
    const frozen = snapshotSections?.find((section) => section.kind === kind);

    return {
      id: live?.id ?? kind,
      kind,
      label: SECTION_BY_KIND[kind].label,
      body: frozen?.body ?? live?.body ?? "",
      complete: live?.complete ?? false,
      required: SECTION_BY_KIND[kind].required,
    };
  }).filter((section) => section.body.trim().length > 0 || section.required);

  return (
    <ReviewScreen
      slug={project.slug}
      title={project.title}
      status={project.status}
      round={round}
      submittedAt={submission?.createdAt ?? null}
      fromSnapshot={snapshotSections !== null}
      sections={sections}
      members={members.map((member) => {
        const score = scores.find((entry) => entry.member.id === member.id);
        return {
          ...member,
          share: score?.share ?? 0,
          points: score?.points ?? 0,
          eventCount: score?.eventCount ?? 0,
          lastActiveAt: score?.lastActiveAt ?? null,
        };
      })}
      rubrics={rubrics.map((rubric) => ({
        id: rubric.id,
        name: rubric.name,
        version: rubric.version,
        criteria: rubric.criteria.map((criterion) => ({
          id: criterion.id,
          name: criterion.name,
          weight: criterion.weight,
          descriptors: Array.isArray(criterion.descriptors)
            ? (criterion.descriptors as string[])
            : [],
        })),
      }))}
      evaluation={
        evaluation
          ? {
              rubricId: evaluation.rubricId,
              outcome: evaluation.outcome,
              comments: evaluation.comments,
              releasedAt: evaluation.releasedAt,
              scores: evaluation.scores.map((score) => ({
                criterionId: score.criterionId,
                memberId: score.memberId,
                score: Number(score.score),
              })),
              reasons: Object.fromEntries(
                evaluation.scores
                  .filter((score) => score.memberId && score.reason)
                  .map((score) => [score.memberId!, score.reason!]),
              ),
            }
          : null
      }
      feedback={feedback.map((note) => ({
        id: note.id,
        sectionId: note.sectionId,
        body: note.body,
        authorName: note.author.name,
        resolvedAt: note.resolvedAt,
        createdAt: note.createdAt,
      }))}
      groupId={project.groupId}
    />
  );
}
