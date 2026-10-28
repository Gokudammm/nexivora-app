"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { currentViewer } from "@/lib/auth/session";
import { can } from "@/lib/authz/policy";
import { db } from "@/lib/db/client";
import { recordLedgerEvent } from "@/lib/ledger/record";

import { loadForAction, type WorkspaceResult } from "./actions";

/**
 * PEER REVIEW.
 *
 * ADR-008, and it is the reason honest peer review is possible at all:
 *
 * > **A member sees only the aggregate about themselves, never who said what.
 * > Faculty see full detail. A member always sees their own submitted reviews.**
 *
 * The asymmetry is one-directional and it is enforced *at the query*, in
 * `queries/review.ts`, not by omitting a column from a page. A leak here does
 * not degrade the feature — it destroys it permanently, because the next round
 * of reviews will all be 4s and "worked well with the team", and a mechanism
 * nobody answers honestly is worse than no mechanism.
 *
 * The comment is required, and that is deliberate. Three sliders with no words
 * take eight seconds and say nothing; being made to write one sentence is the
 * difference between a rating and a review. It is also the thing a faculty
 * member can actually act on.
 */

const fail = (error: unknown): WorkspaceResult => ({
  ok: false,
  error: error instanceof Error ? error.message : "Something went wrong.",
});

async function actor() {
  const viewer = await currentViewer();
  if (!viewer.userId) throw new Error("Sign in first.");
  return viewer as typeof viewer & { userId: string };
}

const rating = z.coerce.number().int().min(1).max(5);

const reviewSchema = z.object({
  groupId: z.string().min(1),
  milestoneId: z.string().optional(),
  subjectId: z.string().min(1),
  contribution: rating,
  reliability: rating,
  communication: rating,
  comment: z
    .string()
    .trim()
    .min(15, "Write at least a sentence — a rating with no reason is not a review.")
    .max(2000),
});

export async function submitPeerReview(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = reviewSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, input.groupId);

    if (!can(viewer, "peerreview:submit", resource)) {
      return { ok: false, error: "Only group members can submit peer reviews." };
    }

    // Nobody reviews themselves. Also a database check constraint — this is the
    // friendly version of the same rule, so the user gets a sentence rather
    // than a 500.
    if (input.subjectId === viewer.userId) {
      return { ok: false, error: "You cannot review yourself." };
    }

    const subject = workspace.members.find((member) => member.user.id === input.subjectId);
    if (!subject) return { ok: false, error: "That person is not in this group." };

    const milestoneId = input.milestoneId || null;

    if (milestoneId) {
      const milestone = await db.milestone.findFirst({
        where: { id: milestoneId, project: { groupId: workspace.id } },
        select: { id: true },
      });
      if (!milestone) return { ok: false, error: "That milestone is not in this group." };
    }

    const existing = await db.peerReview.findFirst({
      where: {
        groupId: workspace.id,
        milestoneId,
        authorId: viewer.userId,
        subjectId: input.subjectId,
      },
      select: { id: true },
    });

    /**
     * A review may be revised until the milestone closes, but revising it is
     * an update to a row the author owns — not to somebody else's record. The
     * *ledger* event is written once, on first submission, because REVIEW_GIVEN
     * credits the act of reviewing and editing your wording is not a second act.
     */
    if (existing) {
      await db.peerReview.update({
        where: { id: existing.id },
        data: {
          contribution: input.contribution,
          reliability: input.reliability,
          communication: input.communication,
          comment: input.comment,
        },
      });

      revalidatePath(`/groups/${workspace.id}/ledger`);
      return { ok: true, message: `Your review of ${subject.user.name} has been updated.` };
    }

    await db.$transaction(async (tx) => {
      const review = await tx.peerReview.create({
        data: {
          groupId: workspace.id,
          milestoneId,
          authorId: viewer.userId,
          subjectId: input.subjectId,
          contribution: input.contribution,
          reliability: input.reliability,
          communication: input.communication,
          comment: input.comment,
        },
        select: { id: true },
      });

      await recordLedgerEvent(tx, {
        groupId: workspace.id,
        userId: viewer.userId,
        kind: "REVIEW_GIVEN",
        subjectType: "PeerReview",
        subjectId: review.id,
        // Deliberately no subject id in the metadata. A ledger row is visible to
        // the whole group, and "Ananya submitted a review of Rahul" reconstructs
        // exactly the attribution ADR-008 exists to withhold.
        metadata: milestoneId ? { milestoneId } : {},
      });
    });

    revalidatePath(`/groups/${workspace.id}/ledger`);
    return { ok: true, message: `Your review of ${subject.user.name} has been recorded.` };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Close a milestone.
 *
 * Peer review is **required first**, and skippable by the lead with a recorded
 * reason. Both halves matter: without the requirement almost nobody reviews,
 * and without the escape hatch a group whose member has dropped out cannot
 * close their milestone at all — so they stop using the milestone feature, and
 * the requirement has achieved nothing.
 *
 * The recorded reason is what keeps the escape hatch honest.
 */
export async function closeMilestone(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = z
      .object({
        groupId: z.string().min(1),
        milestoneId: z.string().min(1),
        skipReason: z.string().trim().max(500).optional(),
      })
      .parse(Object.fromEntries(formData));

    const viewer = await actor();
    const { workspace } = await loadForAction(viewer, input.groupId);

    const isLead = workspace.members.some(
      (member) => member.user.id === viewer.userId && member.role === "LEAD",
    );

    const milestone = await db.milestone.findFirst({
      where: { id: input.milestoneId, project: { groupId: workspace.id } },
      select: { id: true, title: true, state: true, ownerId: true },
    });
    if (!milestone) return { ok: false, error: "That milestone is not in this group." };
    if (milestone.state === "COMPLETE") return { ok: true, message: "Already closed." };

    const others = workspace.members.filter((member) => member.user.id !== viewer.userId);
    const submitted = await db.peerReview.count({
      where: {
        groupId: workspace.id,
        milestoneId: milestone.id,
        authorId: viewer.userId,
      },
    });

    const outstanding = others.length - submitted;

    if (outstanding > 0) {
      const reason = input.skipReason?.trim();

      if (!isLead || !reason) {
        return {
          ok: false,
          error: `Review your ${outstanding} teammate${outstanding === 1 ? "" : "s"} before closing this milestone.`,
          field: "review",
        };
      }

      await db.$transaction(async (tx) => {
        await tx.milestone.update({
          where: { id: milestone.id },
          data: { state: "COMPLETE", completedAt: new Date() },
        });

        // The waiver and its reason are an activity event, not a field on the
        // milestone. A milestone's own columns describe the work; overwriting
        // one of them with an administrative note would lose the note the next
        // time somebody edits the milestone, and this record has to outlast that.
        await tx.activityEvent.create({
          data: {
            collegeId: workspace.collegeId,
            groupId: workspace.id,
            actorId: viewer.userId,
            kind: "milestone.review.waived",
            subjectType: "Milestone",
            subjectId: milestone.id,
            metadata: { reason, outstanding, title: milestone.title },
          },
        });

        if (milestone.ownerId) {
          await recordLedgerEvent(tx, {
            groupId: workspace.id,
            userId: milestone.ownerId,
            kind: "MILESTONE_OWNED",
            subjectType: "Milestone",
            subjectId: milestone.id,
            metadata: { title: milestone.title, reviewSkipped: true },
          });
        }
      });

      revalidatePath(`/groups/${workspace.id}/ledger`);
      return { ok: true, message: "Milestone closed, review waived and the reason recorded." };
    }

    await db.$transaction(async (tx) => {
      await tx.milestone.update({
        where: { id: milestone.id },
        data: { state: "COMPLETE", completedAt: new Date() },
      });

      if (milestone.ownerId) {
        await recordLedgerEvent(tx, {
          groupId: workspace.id,
          userId: milestone.ownerId,
          kind: "MILESTONE_OWNED",
          subjectType: "Milestone",
          subjectId: milestone.id,
          metadata: { title: milestone.title },
        });
      }
    });

    revalidatePath(`/groups/${workspace.id}/ledger`);
    return { ok: true, message: `"${milestone.title}" is closed.` };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------- github linking */

/**
 * Link a GitHub repository and map its commit authors to group members.
 *
 * Uses the **public API without a token**: 60 requests per hour per IP, so it
 * caches hard and degrades silently. It is a bonus signal, never a dependency —
 * a group with no repository, a private repository, or a rate-limited hour must
 * see a workspace that works exactly as well.
 */
export async function linkRepository(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = z
      .object({
        groupId: z.string().min(1),
        repoUrl: z
          .string()
          .trim()
          .regex(
            /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/i,
            "Paste a repository URL like https://github.com/owner/repo",
          ),
      })
      .parse(Object.fromEntries(formData));

    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, input.groupId);

    if (!can(viewer, "task:write", resource)) {
      return { ok: false, error: "You cannot change this group." };
    }

    const match = /github\.com\/([\w.-]+)\/([\w.-]+?)\/?$/i.exec(input.repoUrl);
    if (!match) return { ok: false, error: "That does not look like a repository URL." };

    const [, owner, repo] = match;
    const { linked, reason } = await importCommits(workspace.id, owner!, repo!, workspace.members);

    revalidatePath(`/groups/${workspace.id}/ledger`);

    return {
      ok: true,
      message:
        linked > 0
          ? `${linked} commits linked from ${owner}/${repo}.`
          : `No new commits linked. ${reason ?? "Commit authors did not match any group member's email or username."}`,
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Fetch and attribute commits.
 *
 * Attribution is by **GitHub login first, then the commit email**, and an
 * unmatched author is simply skipped: guessing that "A. Sharma" is Ananya would
 * put points on somebody's ledger on the strength of a string comparison, and
 * the ledger's whole claim is that every number links to evidence.
 */
async function importCommits(
  groupId: string,
  owner: string,
  repo: string,
  members: readonly { user: { id: string; username: string | null } }[],
): Promise<{ linked: number; reason?: string }> {
  type Commit = {
    sha: string;
    commit: { author: { name?: string; email?: string; date?: string } | null };
    author: { login?: string } | null;
  };

  let commits: Commit[];

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100`,
      {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "nexivora" },
        // Cached for an hour: the unauthenticated limit is 60 requests per hour
        // per IP, and a workspace that refetches on every render would exhaust
        // it for the whole college in a minute.
        next: { revalidate: 3600 },
      },
    );

    if (!response.ok) {
      return {
        linked: 0,
        reason:
          response.status === 404
            ? "That repository is private or does not exist."
            : "GitHub is rate-limiting us right now. Try again later.",
      };
    }

    commits = (await response.json()) as Commit[];
  } catch {
    return { linked: 0, reason: "Could not reach GitHub." };
  }

  const emails = await db.user.findMany({
    where: { id: { in: members.map((member) => member.user.id) } },
    select: { id: true, email: true, username: true },
  });

  const byLogin = new Map(
    emails
      .filter((user) => user.username)
      .map((user) => [user.username!.toLowerCase(), user.id] as const),
  );
  const byEmail = new Map(emails.map((user) => [user.email.toLowerCase(), user.id] as const));

  const existing = await db.ledgerEvent.findMany({
    where: { groupId, kind: "COMMIT_LINKED" },
    select: { subjectId: true },
  });
  const known = new Set(existing.map((row) => row.subjectId));

  const pending: { sha: string; userId: string; date: string | undefined }[] = [];

  for (const commit of commits) {
    if (known.has(commit.sha)) continue;

    const login = commit.author?.login?.toLowerCase();
    const email = commit.commit?.author?.email?.toLowerCase();
    const userId =
      (login ? byLogin.get(login) : undefined) ?? (email ? byEmail.get(email) : undefined);

    // An unmatched author is skipped, never guessed at. Putting points on
    // somebody's ledger because a display name looked similar would break the
    // one promise the ledger makes: every number links to its evidence.
    if (!userId) continue;

    pending.push({ sha: commit.sha, userId, date: commit.commit?.author?.date });
  }

  if (pending.length === 0) return { linked: 0 };

  await db.$transaction(async (tx) => {
    const { recordLedgerEvents } = await import("@/lib/ledger/record");

    await recordLedgerEvents(
      tx,
      pending.map((commit) => ({
        groupId,
        userId: commit.userId,
        kind: "COMMIT_LINKED" as const,
        subjectType: "Commit" as const,
        subjectId: commit.sha,
        metadata: {
          repo: `${owner}/${repo}`,
          url: `https://github.com/${owner}/${repo}/commit/${commit.sha}`,
        },
        ...(commit.date && Number.isFinite(new Date(commit.date).getTime())
          ? { createdAt: new Date(commit.date) }
          : {}),
      })),
    );
  });

  return { linked: pending.length };
}
