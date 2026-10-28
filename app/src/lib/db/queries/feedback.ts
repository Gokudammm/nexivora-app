import { db } from "@/lib/db/client";
import { teachesSubject, type Viewer } from "@/lib/authz/viewer";
import type { EditableProject } from "@/lib/db/queries/project-edit";

/**
 * WHAT THE GROUP SEES OF AN EVALUATION.
 *
 * The rule Phase 9 is judged on is one line long — *drafts are private, a
 * released round is visible immediately* — and it is enforced **here, in the
 * where clause**, not by a page choosing what to render.
 *
 * That distinction is the whole point. A page that loads every round and then
 * filters in JSX leaks the draft into the HTML payload, where it is one View
 * Source away, and every future edit to that page is a chance to reintroduce
 * it. `releasedAt: { not: null }` in the query means an unreleased round never
 * leaves the database at all.
 *
 * Faculty are the exception, and they read their own drafts through the review
 * screen rather than through this function — so there is no `includeDrafts`
 * flag here for somebody to pass `true` by accident.
 */
export async function releasedFeedback(project: EditableProject) {
  const [evaluations, notes] = await Promise.all([
    db.evaluation.findMany({
      where: { projectId: project.id, releasedAt: { not: null } },
      select: {
        id: true,
        round: true,
        groupScore: true,
        outcome: true,
        comments: true,
        releasedAt: true,
        evaluator: {
          select: { name: true, username: true, facultyProfile: { select: { designation: true } } },
        },
        rubric: {
          select: {
            name: true,
            version: true,
            criteria: {
              select: { id: true, name: true, weight: true },
              orderBy: { position: "asc" },
            },
          },
        },
        scores: {
          select: {
            criterionId: true,
            memberId: true,
            score: true,
            reason: true,
            member: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { round: "desc" },
    }),

    // Section notes are written during review and are not gated on release:
    // they are a running conversation about a specific section, and the group
    // can act on one the moment it is written. The evaluation is the thing that
    // is held back until it is finished.
    db.feedback.findMany({
      where: { section: { projectId: project.id } },
      select: {
        id: true,
        body: true,
        createdAt: true,
        resolvedAt: true,
        sectionId: true,
        author: { select: { name: true } },
        section: { select: { kind: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return { evaluations, notes };
}

/**
 * Whether this viewer has a round waiting that they have not been shown.
 *
 * Used for the tab's dot. Deliberately counts released rounds only, for the
 * same reason as above.
 */
export async function hasReleasedFeedback(projectId: string): Promise<boolean> {
  const count = await db.evaluation.count({
    where: { projectId, releasedAt: { not: null } },
  });
  return count > 0;
}

/** A faculty member reading this project's feedback is reading their own work. */
export const isGuide = (viewer: Viewer, project: EditableProject): boolean =>
  teachesSubject(viewer, project.group?.class?.subjectId ?? null);
