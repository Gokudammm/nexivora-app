"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { REQUIRED_SECTIONS, SECTION_BY_KIND, SECTION_ORDER } from "@/config/sections";
import { currentViewer } from "@/lib/auth/session";
import { can } from "@/lib/authz/policy";
import { isGroupLead, teachesSubject, type Viewer } from "@/lib/authz/viewer";
import { db } from "@/lib/db/client";
import { requireEditableProject, type EditableProject } from "@/lib/db/queries/project-edit";
import { projectResource } from "@/lib/db/queries/projects";
import { recomputeSkills } from "@/lib/profile/actions";
import { attemptTransition, type Actor, type Status } from "@/lib/project/lifecycle";
import { createSnapshot, type SnapshotInput } from "@/lib/project/snapshot";
import { rankSimilar } from "@/lib/search/similarity";
import { shortlistSimilarProjects } from "@/lib/search/fts";

/**
 * LIFECYCLE TRANSITIONS.
 *
 * Every status change in the product goes through `moveProject`. It does four
 * things in a fixed order, and the order is the design:
 *
 *   1. Load the project through the same gate everything else uses.
 *   2. Ask `lifecycle.ts` whether the edge exists and its preconditions hold.
 *      A refusal comes back as the sentence naming what is missing.
 *   3. Ask `can()` whether *this* viewer may play the actor the edge requires.
 *      Two separate questions — "is this move legal" and "may you make it" —
 *      because conflating them produces "you cannot do that" when the real
 *      answer is "nobody can do that yet, and here is why".
 *   4. Apply the change and its `ProjectStatusEvent` in one transaction.
 *
 * The status event is not optional and not deferred. A project whose history
 * has gaps cannot answer "who approved this, and when", which is the question
 * the whole approval gate exists to make answerable.
 */

export type TransitionResult =
  { ok: true; message: string; status: Status } | { ok: false; error: string };

const fail = (error: unknown): TransitionResult => ({
  ok: false,
  error: error instanceof Error ? error.message : "Something went wrong.",
});

async function actor(): Promise<Viewer & { userId: string }> {
  const viewer = await currentViewer();
  if (!viewer.userId) throw new Error("Sign in first.");
  return viewer as Viewer & { userId: string };
}

/** Does this viewer satisfy the actor the transition requires? */
function playsActor(viewer: Viewer, project: EditableProject, required: Actor): boolean {
  const resource = projectResource(project);

  if (required === "faculty") {
    return teachesSubject(viewer, project.group?.class?.subjectId ?? null);
  }
  if (required === "lead") return isGroupLead(viewer, project.groupId);

  return can(viewer, "project:edit", resource);
}

const ACTOR_REFUSAL: Record<Actor, string> = {
  member: "Only the project's team can do that.",
  lead: "Only the group lead can do that — submitting is a commitment on behalf of the team.",
  faculty: "Only the faculty member who teaches this subject can do that.",
};

/**
 * Gather the facts the preconditions reason about.
 *
 * Assembled here rather than inside `lifecycle.ts` so that file stays pure and
 * unit-testable without a database — the preconditions are the part most likely
 * to be argued about, and an argument about a rule you can read and test is a
 * different conversation.
 */
async function gatherFacts(project: EditableProject) {
  const outstanding: string[] = [];

  if (project.groupId) {
    const members = project.group?.members ?? [];
    const openMilestone = project.milestones.find((milestone) => milestone.state !== "COMPLETE");

    // Everyone must have reviewed everyone else at the current milestone. The
    // reviewers who owe something are named, never counted — "two people have
    // not reviewed" leaves five people asking each other who.
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

  return {
    completeSections: project.sections.filter((s) => s.complete).map((s) => s.kind),
    requiredSections: REQUIRED_SECTIONS,
    sectionLabel: (kind: keyof typeof SECTION_BY_KIND) => SECTION_BY_KIND[kind].label,
    milestones: project.milestones.map((milestone) => ({
      title: milestone.title,
      state: milestone.state,
    })),
    outstandingReviewers: outstanding,
    hasTitle: project.title.trim().length > 0,
    hasSummary: project.summary.trim().length > 0,
    hasAbstract: project.abstract.trim().length > 0,
    hasMembers: project.members.length > 0,
    hasSimilarityCheck: project.similarityChecks.length > 0,
  };
}

/* ------------------------------------------------------------------ move */

const moveSchema = z.object({
  slug: z.string().min(1),
  to: z.enum([
    "DRAFT",
    "PROPOSED",
    "APPROVED",
    "IN_PROGRESS",
    "UNDER_REVIEW",
    "COMPLETED",
    "ARCHIVED",
    "REJECTED",
    "ABANDONED",
  ]),
  reason: z.string().trim().max(1000).optional(),
});

export async function moveProject(
  _previous: TransitionResult | null,
  formData: FormData,
): Promise<TransitionResult> {
  try {
    const input = moveSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();

    const project = await requireEditableProject(viewer, input.slug);
    if (!project) return { ok: false, error: "That project is not available." };

    const facts = await gatherFacts(project);
    const attempt = attemptTransition(project.status, input.to, facts);

    // Legality first, permission second — so an incomplete project tells the
    // group what is missing rather than telling them they are not allowed.
    if (!attempt.ok) return { ok: false, error: attempt.reason };

    const { transition } = attempt;

    if (!playsActor(viewer, project, transition.actor)) {
      return { ok: false, error: ACTOR_REFUSAL[transition.actor] };
    }

    const reason = input.reason?.trim();
    if (transition.requiresReason && !reason) {
      return {
        ok: false,
        error: "A reason is required. It is what the other side will work from.",
      };
    }

    const now = new Date();

    await db.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: project.id },
        data: {
          status: input.to,
          // Approval is what unlocks publication (ADR-010). A check constraint
          // enforces the same rule underneath, so this is the friendly half.
          ...(input.to === "APPROVED" ? { approved: true, approvedAt: now } : {}),
          ...(input.to === "COMPLETED" ? { completedOn: project.completedOn ?? now } : {}),
          ...(input.to === "ARCHIVED"
            ? { citationId: project.citationId ?? (await mintCitationId(tx, project, now)) }
            : {}),
        },
      });

      await tx.projectStatusEvent.create({
        data: {
          projectId: project.id,
          actorId: viewer.userId,
          from: project.status,
          to: input.to,
          reason: reason || null,
        },
      });
    });

    // Skills are derived from project state, so the state change is what
    // promotes a self-declared skill to evidenced (Phase 6's rule). Outside the
    // transaction deliberately: it is join-heavy, and a slow recompute must not
    // hold a lock on the project row.
    for (const member of project.members) {
      await recomputeSkills(member.user.id);
    }

    revalidatePath(`/projects/${project.slug}`);
    revalidatePath(`/projects/${project.slug}/edit`);
    revalidatePath("/my/projects");
    revalidatePath("/faculty/proposals");
    revalidatePath("/explore");

    return { ok: true, message: `${transition.label} — done.`, status: input.to };
  } catch (error) {
    return fail(error);
  }
}

/**
 * The permanent citation id, assigned once at archive time.
 *
 * Shaped `NEX-<college code>-<year>-<sequence>`. It goes into other people's
 * reference lists, so it is never recomputed from mutable fields — the title
 * can change, the slug can change, this cannot.
 */
async function mintCitationId(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  project: EditableProject,
  now: Date,
): Promise<string> {
  const year = now.getFullYear();
  const code = (project.college.shortName || project.college.slug)
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 6);

  const prefix = `NEX-${code}-${year}-`;
  const last = await tx.project.findFirst({
    where: { citationId: { startsWith: prefix } },
    orderBy: { citationId: "desc" },
    select: { citationId: true },
  });

  const sequence = last?.citationId ? Number(last.citationId.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

/* ------------------------------------------------------- similarity check */

export type SimilarityMatch = {
  slug: string;
  title: string;
  score: number;
  verdict: "duplicate" | "related" | "distinct";
  /** Why, in words. A score with no explanation is an accusation. */
  reason: string;
};

/**
 * Run the duplicate check and store it.
 *
 * **This informs a conversation; it never blocks.** A project that formally
 * builds on a previous one *should* score high, and a replication study scores
 * like a copy — only a person can tell those apart. So the result is recorded
 * as a `SimilarityCheck` row and shown to the student *before* they submit,
 * which is the moment it is useful and the moment it is least alarming.
 *
 * Storing the check rather than just the score is what makes a faculty override
 * auditable later: the decision is part of the record, not a number somebody
 * remembers seeing.
 */
export async function runSimilarityCheck(
  _previous: TransitionResult | null,
  formData: FormData,
): Promise<TransitionResult> {
  try {
    const slug = z.string().min(1).parse(formData.get("slug"));
    const viewer = await actor();

    const project = await requireEditableProject(viewer, slug);
    if (!project) return { ok: false, error: "That project is not available." };

    if (!can(viewer, "project:edit", projectResource(project))) {
      return { ok: false, error: "You are not on this project's team." };
    }

    const problem = project.sections.find((section) => section.kind === "PROBLEM")?.body ?? "";
    if (problem.trim().length < 40) {
      return {
        ok: false,
        error: "Write the problem statement first — the check compares problems, not titles.",
      };
    }

    const candidates = await shortlistSimilarProjects(problem, { excludeProjectId: project.id });

    const subject = {
      problem,
      topics: project.topics.map((entry) => entry.topic.slug),
      techStack: project.techStack,
    };

    const ranked = rankSimilar(
      subject,
      candidates.map((candidate) => ({
        ...candidate,
        problem: candidate.problemNormalised,
      })),
    );

    const matches: SimilarityMatch[] = ranked.slice(0, 5).map((row) => ({
      slug: row.candidate.slug,
      title: row.candidate.title,
      score: Number(row.score.toFixed(3)),
      verdict: row.verdict,
      reason: explain(row.breakdown, subject, {
        topics: row.candidate.topics,
        techStack: row.candidate.techStack,
      }),
    }));

    await db.similarityCheck.create({
      data: {
        projectId: project.id,
        matches,
        topScore: matches[0]?.score ?? 0,
      },
    });

    revalidatePath(`/projects/${project.slug}/propose`);

    return {
      ok: true,
      status: project.status,
      message:
        matches.length === 0
          ? "No similar work found in the archive."
          : `${matches.length} similar ${matches.length === 1 ? "project" : "projects"} found. Have a look before you submit — similarity is not a problem in itself.`,
    };
  } catch (error) {
    return fail(error);
  }
}

/** The score, in a sentence. */
function explain(
  breakdown: { problem: number; topics: number; techStack: number },
  subject: { topics: readonly string[]; techStack: readonly string[] },
  candidate: { topics: readonly string[]; techStack: readonly string[] },
): string {
  const parts = [`${Math.round(breakdown.problem * 100)}% similar problem statement`];

  const sharedTech = subject.techStack.filter((tool) =>
    candidate.techStack.some((other) => other.toLowerCase() === tool.toLowerCase()),
  );
  if (sharedTech.length > 0 && subject.techStack.length > 0) {
    parts.push(`shares ${sharedTech.length} of ${subject.techStack.length} tech stack items`);
  }

  const sharedTopics = subject.topics.filter((topic) => candidate.topics.includes(topic));
  if (sharedTopics.length > 0) {
    parts.push(`${sharedTopics.length} topic${sharedTopics.length === 1 ? "" : "s"} in common`);
  }

  return parts.join("; ");
}

/**
 * A faculty member records that a similarity flag is acceptable, and why.
 *
 * The justification is the whole feature. A legitimate continuation of previous
 * work *should* look similar, and a system that blocked it would teach groups
 * to disguise their lineage — the opposite of what the archive is for.
 */
export async function overrideSimilarity(
  _previous: TransitionResult | null,
  formData: FormData,
): Promise<TransitionResult> {
  try {
    const input = z
      .object({
        slug: z.string().min(1),
        checkId: z.string().min(1),
        reason: z
          .string()
          .trim()
          .min(15, "Say why the similarity is acceptable — this becomes part of the record."),
      })
      .parse(Object.fromEntries(formData));

    const viewer = await actor();
    const project = await requireEditableProject(viewer, input.slug);
    if (!project) return { ok: false, error: "That project is not available." };

    if (!teachesSubject(viewer, project.group?.class?.subjectId ?? null)) {
      return { ok: false, error: "Only the faculty member who teaches this subject can do that." };
    }

    const updated = await db.similarityCheck.updateMany({
      where: { id: input.checkId, projectId: project.id },
      data: { overriddenById: viewer.userId, overrideReason: input.reason },
    });

    if (updated.count === 0) return { ok: false, error: "That check no longer exists." };

    revalidatePath(`/projects/${project.slug}/propose`);
    revalidatePath("/faculty/proposals");

    return { ok: true, status: project.status, message: "Recorded." };
  } catch (error) {
    return fail(error);
  }
}

/* -------------------------------------------------------------- submission */

/**
 * Submit for review: the transition, plus an immutable snapshot.
 *
 * One transaction, and it must be. A status change without its snapshot leaves
 * a locked project with no record of what was locked; a snapshot without the
 * status change leaves a receipt for a submission that did not happen. Either
 * is worse than the operation failing.
 */
export async function submitProject(
  _previous: TransitionResult | null,
  formData: FormData,
): Promise<TransitionResult> {
  try {
    const slug = z.string().min(1).parse(formData.get("slug"));
    const viewer = await actor();

    const project = await requireEditableProject(viewer, slug);
    if (!project) return { ok: false, error: "That project is not available." };

    const facts = await gatherFacts(project);
    const attempt = attemptTransition(project.status, "UNDER_REVIEW", facts);
    if (!attempt.ok) return { ok: false, error: attempt.reason };

    if (!isGroupLead(viewer, project.groupId)) {
      return { ok: false, error: ACTOR_REFUSAL.lead };
    }

    const files = project.groupId
      ? await db.fileAsset.findMany({
          where: { groupId: project.groupId, deletedAt: null },
          select: { name: true, sizeBytes: true, checksum: true },
        })
      : [];

    const lastRound = project.submissions[0]?.round ?? 0;
    const now = new Date();

    const input: SnapshotInput = {
      slug: project.slug,
      title: project.title,
      summary: project.summary,
      abstract: project.abstract,
      status: "UNDER_REVIEW",
      visibility: project.visibility,
      domain: project.domain,
      department: project.department,
      subject: project.subject,
      techStack: project.techStack,
      keywords: project.keywords,
      repositoryUrl: project.repositoryUrl,
      demoUrl: project.demoUrl,
      videoUrl: project.videoUrl,
      startedOn: project.startedOn,
      completedOn: project.completedOn,
      embargoUntil: project.embargoUntil,
      sections: project.sections,
      members: project.members.map((member) => ({
        username: member.user.username,
        name: member.user.name,
        role: member.role,
        tier: member.tier,
      })),
      milestones: project.milestones,
      topics: project.topics.map((entry) => entry.topic.slug),
      sdgs: project.sdgs,
      files,
    };

    const snapshot = createSnapshot(
      input,
      { round: lastRound + 1, submittedBy: viewer.userId, submittedAt: now },
      SECTION_ORDER,
    );

    await db.$transaction(async (tx) => {
      await tx.projectSubmission.create({
        data: {
          projectId: project.id,
          submittedById: viewer.userId,
          round: snapshot.round,
          snapshot: JSON.parse(JSON.stringify(snapshot)) as object,
        },
      });

      await tx.project.update({ where: { id: project.id }, data: { status: "UNDER_REVIEW" } });

      await tx.projectStatusEvent.create({
        data: {
          projectId: project.id,
          actorId: viewer.userId,
          from: project.status,
          to: "UNDER_REVIEW",
          reason: `Round ${snapshot.round}`,
        },
      });
    });

    for (const member of project.members) {
      await recomputeSkills(member.user.id);
    }

    revalidatePath(`/projects/${project.slug}`);
    revalidatePath(`/projects/${project.slug}/submit`);
    revalidatePath("/faculty/proposals");

    return {
      ok: true,
      status: "UNDER_REVIEW",
      message: `Submitted — round ${snapshot.round}, receipt ${snapshot.digest}.`,
    };
  } catch (error) {
    return fail(error);
  }
}
