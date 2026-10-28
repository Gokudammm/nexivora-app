"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { currentViewer } from "@/lib/auth/session";
import { can } from "@/lib/authz/policy";
import { teachesSubject, type Viewer } from "@/lib/authz/viewer";
import { db } from "@/lib/db/client";
import { requireEditableProject, type EditableProject } from "@/lib/db/queries/project-edit";
import { projectResource } from "@/lib/db/queries/projects";
import { recomputeSkills } from "@/lib/profile/actions";
import { requiresNewVersion, validateRubric, type CriterionDraft } from "./rubric";
import { canRelease, totalFor, type Criterion, type Score } from "./score";

/**
 * EVALUATION MUTATIONS.
 *
 * Three properties, each of which the phase spec calls out by name.
 *
 * **A draft is invisible until released** (acceptance criterion 9). `releasedAt`
 * is the switch, and it is checked in the *query* that students read — not by a
 * component choosing to hide something. A half-written mark visible to a
 * student is worse than no mark.
 *
 * **Rubrics version, never mutate.** Once an evaluation references a rubric,
 * saving an edit creates version n+1 as a new row. An edited rubric that
 * retroactively changes past marks is, in the spec's words, a serious academic
 * integrity problem.
 *
 * **Nothing is auto-issued.** Attestations are elsewhere, but the same rule
 * governs here: an outcome is chosen by a person, and requesting changes without
 * specifics is refused.
 */

export type EvalResult =
  | { ok: true; message: string; id?: string }
  | { ok: false; error: string; problems?: string[]; field?: string };

const fail = (error: unknown): EvalResult => ({
  ok: false,
  error: error instanceof Error ? error.message : "Something went wrong.",
});

async function actor(): Promise<Viewer & { userId: string }> {
  const viewer = await currentViewer();
  if (!viewer.userId) throw new Error("Sign in first.");
  return viewer as Viewer & { userId: string };
}

/**
 * A project this viewer may evaluate, or a refusal.
 *
 * `can(viewer, "project:evaluate")` is the decision — already written and
 * matrix-tested in Phase 4, scoped to the subject rather than the college.
 */
async function loadForEvaluation(
  viewer: Viewer & { userId: string },
  slug: string,
): Promise<EditableProject> {
  const project = await requireEditableProject(viewer, slug);
  if (!project) throw new Error("That project is not available.");

  if (!can(viewer, "project:evaluate", projectResource(project))) {
    throw new Error("Only the faculty member who teaches this subject can evaluate it.");
  }

  return project;
}

/* --------------------------------------------------------------- rubrics */

const criterionSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(120),
  weight: z.coerce.number().int().min(1).max(100),
  descriptors: z.string().optional(),
});

const rubricSchema = z.object({
  rubricId: z.string().optional(),
  collegeId: z.string().min(1),
  subjectId: z.string().optional(),
  name: z.string().trim().min(3, "Give the rubric a name.").max(160),
  /** JSON, because a variable number of criteria does not fit flat form fields. */
  criteria: z.string().min(2),
});

export async function saveRubric(
  _previous: EvalResult | null,
  formData: FormData,
): Promise<EvalResult> {
  try {
    const input = rubricSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();

    let parsed: unknown;
    try {
      parsed = JSON.parse(input.criteria);
    } catch {
      return { ok: false, error: "The criteria could not be read. Reload and try again." };
    }

    const criteria = z.array(criterionSchema).parse(parsed);

    const subjectId = input.subjectId?.trim() || null;
    if (subjectId && !teachesSubject(viewer, subjectId)) {
      return { ok: false, field: "subjectId", error: "You do not teach that subject." };
    }

    const drafts: CriterionDraft[] = criteria.map((criterion) => ({
      id: criterion.id,
      name: criterion.name,
      weight: criterion.weight,
      descriptors: criterion.descriptors
        ? criterion.descriptors.split("\n").filter(Boolean)
        : undefined,
    }));

    const valid = validateRubric(input.name, drafts);
    if (!valid.ok) return { ok: false, error: valid.error, field: valid.field };

    const rows = drafts.map((draft, position) => ({
      name: draft.name,
      weight: draft.weight,
      position,
      descriptors: draft.descriptors ? (draft.descriptors as string[]) : undefined,
    }));

    /* ------------------------------------------------------- a new rubric */

    if (!input.rubricId) {
      const created = await db.rubric.create({
        data: {
          collegeId: input.collegeId,
          subjectId,
          creatorId: viewer.userId,
          name: input.name,
          version: 1,
          criteria: { create: rows },
        },
        select: { id: true },
      });

      revalidatePath("/faculty/rubrics");
      return { ok: true, message: `${input.name} created.`, id: created.id };
    }

    /* ---------------------------------------------------------- an edit */

    const existing = await db.rubric.findUnique({
      where: { id: input.rubricId },
      select: {
        id: true,
        name: true,
        version: true,
        collegeId: true,
        subjectId: true,
        _count: { select: { evaluations: true } },
      },
    });
    if (!existing) return { ok: false, error: "That rubric no longer exists." };

    if (existing.subjectId && !teachesSubject(viewer, existing.subjectId)) {
      return { ok: false, error: "You do not teach that subject." };
    }

    // The integrity rule. One existing evaluation is enough: its total was
    // computed from these weights, and changing them changes a mark that has
    // already been given.
    if (requiresNewVersion(existing._count.evaluations)) {
      const version = await db.rubric.create({
        data: {
          collegeId: existing.collegeId,
          subjectId,
          creatorId: viewer.userId,
          name: input.name,
          version: existing.version + 1,
          criteria: { create: rows },
        },
        select: { id: true, version: true },
      });

      revalidatePath("/faculty/rubrics");
      return {
        ok: true,
        id: version.id,
        message: `Saved as version ${version.version}. Version ${existing.version} keeps the ${existing._count.evaluations} ${
          existing._count.evaluations === 1 ? "evaluation" : "evaluations"
        } scored against it.`,
      };
    }

    await db.$transaction([
      db.rubricCriterion.deleteMany({ where: { rubricId: existing.id } }),
      db.rubric.update({
        where: { id: existing.id },
        data: { name: input.name, subjectId, criteria: { create: rows } },
      }),
    ]);

    revalidatePath("/faculty/rubrics");
    return { ok: true, message: "Rubric saved.", id: existing.id };
  } catch (error) {
    return fail(error);
  }
}

export async function archiveRubric(
  _previous: EvalResult | null,
  formData: FormData,
): Promise<EvalResult> {
  try {
    const rubricId = z.string().min(1).parse(formData.get("rubricId"));
    const viewer = await actor();

    const rubric = await db.rubric.findUnique({
      where: { id: rubricId },
      select: { id: true, subjectId: true, name: true },
    });
    if (!rubric) return { ok: false, error: "That rubric no longer exists." };

    if (rubric.subjectId && !teachesSubject(viewer, rubric.subjectId)) {
      return { ok: false, error: "You do not teach that subject." };
    }

    // Archive, never delete — an evaluation points at it, and a mark whose
    // rubric has vanished cannot be explained to the student who got it.
    await db.rubric.update({ where: { id: rubric.id }, data: { archivedAt: new Date() } });

    revalidatePath("/faculty/rubrics");
    return {
      ok: true,
      message: `${rubric.name} archived. Existing evaluations still reference it.`,
    };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------ evaluation */

const scoreSchema = z.object({
  slug: z.string().min(1),
  rubricId: z.string().min(1),
  /** JSON: [{ criterionId, memberId, score }] */
  scores: z.string().min(2),
  /** JSON: { [memberId]: reason } */
  reasons: z.string().optional(),
  comments: z.string().trim().max(8000).optional(),
  outcome: z.enum(["ACCEPT", "CHANGES", "REJECT"]).optional(),
  /** "true" releases; anything else saves a private draft. */
  release: z.string().optional(),
});

/**
 * Save an evaluation, and optionally release it.
 *
 * Saving is cheap and frequent; releasing is the consequential act, so the
 * checks live on that side. `canRelease` returns **every** unmet condition at
 * once — the same discipline as Phase 8's submission checklist, because a
 * release blocked one reason at a time is the shape that makes people give up
 * and mark on paper.
 */
export async function saveEvaluation(
  _previous: EvalResult | null,
  formData: FormData,
): Promise<EvalResult> {
  try {
    const input = scoreSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();
    const project = await loadForEvaluation(viewer, input.slug);

    const rubric = await db.rubric.findUnique({
      where: { id: input.rubricId },
      select: {
        id: true,
        criteria: { select: { id: true, name: true, weight: true }, orderBy: { position: "asc" } },
      },
    });
    if (!rubric) return { ok: false, error: "That rubric no longer exists." };

    const scores = z
      .array(
        z.object({
          criterionId: z.string().min(1),
          memberId: z.string().nullable(),
          score: z.coerce.number().min(0).max(5),
        }),
      )
      .parse(JSON.parse(input.scores));

    const reasons = input.reasons
      ? (z.record(z.string(), z.string()).parse(JSON.parse(input.reasons)) as Record<
          string,
          string
        >)
      : {};

    // Only criteria belonging to this rubric, and only members of this project.
    const criterionIds = new Set(rubric.criteria.map((criterion) => criterion.id));
    const memberIds = new Set(project.members.map((member) => member.user.id));
    const clean: Score[] = scores.filter(
      (score) =>
        criterionIds.has(score.criterionId) &&
        (score.memberId === null || memberIds.has(score.memberId)),
    );

    const releasing = input.release === "true";

    if (releasing) {
      const check = canRelease({
        criteria: rubric.criteria as Criterion[],
        scores: clean,
        members: project.members.map((member) => ({
          id: member.user.id,
          name: member.user.name,
        })),
        reasons,
        outcome: input.outcome ?? null,
        comments: input.comments ?? null,
      });

      if (!check.ok) {
        return {
          ok: false,
          error: "This evaluation is not ready to release.",
          problems: check.problems,
        };
      }
    }

    const round = project.submissions[0]?.round ?? 1;
    const groupTotal = totalFor(rubric.criteria as Criterion[], clean, null);
    const now = new Date();

    const evaluationId = await db.$transaction(async (tx) => {
      const existing = await tx.evaluation.findUnique({
        where: { projectId_round: { projectId: project.id, round } },
        select: { id: true, releasedAt: true },
      });

      // A released evaluation is history. Re-releasing would silently rewrite a
      // mark a student has already seen; a revision belongs to the next round,
      // which is created when they resubmit.
      if (existing?.releasedAt) {
        throw new Error(
          `Round ${round} has already been released. A revised mark belongs to the next round, after the group resubmits.`,
        );
      }

      const evaluation = existing
        ? await tx.evaluation.update({
            where: { id: existing.id },
            data: {
              rubricId: rubric.id,
              groupScore: groupTotal.percent,
              outcome: input.outcome ?? null,
              comments: input.comments || null,
              releasedAt: releasing ? now : null,
            },
            select: { id: true },
          })
        : await tx.evaluation.create({
            data: {
              projectId: project.id,
              rubricId: rubric.id,
              evaluatorId: viewer.userId,
              round,
              groupScore: groupTotal.percent,
              outcome: input.outcome ?? null,
              comments: input.comments || null,
              releasedAt: releasing ? now : null,
            },
            select: { id: true },
          });

      await tx.criterionScore.deleteMany({ where: { evaluationId: evaluation.id } });

      await tx.criterionScore.createMany({
        data: clean.map((score) => ({
          evaluationId: evaluation.id,
          criterionId: score.criterionId,
          memberId: score.memberId,
          score: score.score,
          reason: score.memberId ? (reasons[score.memberId] ?? null) : null,
        })),
      });

      return evaluation.id;
    });

    revalidatePath(`/projects/${project.slug}/review`);
    revalidatePath("/faculty/submissions");
    revalidatePath("/faculty");

    return {
      ok: true,
      id: evaluationId,
      message: releasing
        ? `Released. The group can see the marks and your comments now.`
        : "Draft saved. Students cannot see this until you release it.",
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Sectioned feedback.
 *
 * Attached to a `ProjectSection` rather than dumped in one comment box, because
 * "the methodology needs work" on a nine-section report leaves a group guessing
 * which paragraph. Faculty may comment on a section; they still cannot **edit**
 * one — that separation is Phase 4's and it is what keeps the record evidential.
 */
export async function addSectionFeedback(
  _previous: EvalResult | null,
  formData: FormData,
): Promise<EvalResult> {
  try {
    const input = z
      .object({
        slug: z.string().min(1),
        sectionId: z.string().min(1),
        body: z.string().trim().min(5, "Say what needs changing.").max(4000),
      })
      .parse(Object.fromEntries(formData));

    const viewer = await actor();
    const project = await loadForEvaluation(viewer, input.slug);

    const section = await db.projectSection.findFirst({
      where: { id: input.sectionId, projectId: project.id },
      select: { id: true },
    });
    if (!section) return { ok: false, error: "That section no longer exists." };

    await db.feedback.create({
      data: {
        sectionId: section.id,
        projectId: project.id,
        authorId: viewer.userId,
        body: input.body,
      },
    });

    revalidatePath(`/projects/${project.slug}/review`);
    revalidatePath(`/projects/${project.slug}/edit`);
    return { ok: true, message: "Feedback added." };
  } catch (error) {
    return fail(error);
  }
}

export async function resolveFeedback(
  _previous: EvalResult | null,
  formData: FormData,
): Promise<EvalResult> {
  try {
    const input = z
      .object({ slug: z.string().min(1), feedbackId: z.string().min(1) })
      .parse(Object.fromEntries(formData));

    const viewer = await actor();
    const project = await requireEditableProject(viewer, input.slug);
    if (!project) return { ok: false, error: "That project is not available." };

    // Either side may mark a note dealt with: the group when they have acted on
    // it, the faculty member when they are satisfied. Both are members of the
    // conversation.
    if (!can(viewer, "project:comment", projectResource(project))) {
      return { ok: false, error: "You are not on this project." };
    }

    await db.feedback.updateMany({
      where: { id: input.feedbackId, projectId: project.id },
      data: { resolvedAt: new Date() },
    });

    revalidatePath(`/projects/${project.slug}/review`);
    revalidatePath(`/projects/${project.slug}/edit`);
    return { ok: true, message: "Marked resolved." };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Recompute skills for everybody on a project.
 *
 * Exported because the review flow changes a project's status through
 * `moveProject`, which already does this — but releasing an evaluation with an
 * ACCEPT outcome does not, and an attested contribution has to reach the
 * profile.
 */
export async function refreshProjectSkills(projectId: string): Promise<void> {
  const members = await db.projectMember.findMany({
    where: { projectId },
    select: { userId: true },
  });

  for (const member of members) {
    await recomputeSkills(member.userId);
  }
}
