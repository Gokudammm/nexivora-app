import { thresholdsFor } from "@/config/health";
import { db } from "@/lib/db/client";
import { groupHealth, healthLevel, type HealthSignal } from "@/lib/ledger/health";
import type { MemberScore } from "@/lib/ledger/score";
import { milestoneState } from "@/lib/project/progress";

/**
 * HEALTH SIGNALS FOR ONE GROUP.
 *
 * `listSupervisedGroups` computes these in a batch for the faculty dashboard —
 * one ledger read for fifteen groups, because a dashboard that costs fifteen
 * round trips is a dashboard nobody opens. This is the other shape of the same
 * thing: one group, for the page that group is already looking at.
 *
 * They share `groupHealth()` rather than each deriving signals their own way,
 * which is what makes the two views agree by construction. **ADR-045**: the
 * group sees the same signals their faculty guide sees. Only the framing
 * differs (`AUDIENCE_FRAMING`), and the caller supplies that.
 *
 * Hiding the summary while showing the ledger it is computed from was never
 * coherent — the events are already group-visible, so the group could derive
 * every one of these by hand. What withholding it actually achieves is that
 * they find out at the review instead of in week four, when they could still
 * have done something about it.
 */
export async function groupSignals(input: {
  groupId: string;
  collegeId: string;
  /** The open project's milestones come from here; null when there is none. */
  projectId: string | null;
  /** False once the project is complete or archived — see `HealthInput.active`. */
  active?: boolean;
  scores: readonly MemberScore[];
  totalEvents: number;
  lastActivityAt: Date | null;
  now?: Date;
}): Promise<{ signals: HealthSignal[]; level: ReturnType<typeof healthLevel> }> {
  const now = input.now ?? new Date();

  const [blockers, overdue, milestones] = await Promise.all([
    db.thread.findMany({
      where: { groupId: input.groupId, kind: "BLOCKER", resolvedAt: null, deletedAt: null },
      select: { id: true, title: true, createdAt: true },
    }),
    db.task.findMany({
      where: {
        groupId: input.groupId,
        deletedAt: null,
        status: { in: ["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW"] },
        dueDate: { lt: now },
      },
      select: { id: true, title: true, dueDate: true },
    }),
    input.projectId === null
      ? Promise.resolve([])
      : db.milestone.findMany({
          where: { projectId: input.projectId },
          select: { id: true, title: true, state: true, dueDate: true },
        }),
  ]);

  const signals = groupHealth(
    {
      scores: input.scores,
      totalEvents: input.totalEvents,
      overdueTasks: overdue.map((task) => ({
        id: task.id,
        title: task.title,
        dueDate: task.dueDate!,
      })),
      slippedMilestones: milestones
        .filter((milestone) => milestoneState(milestone, now) === "AT_RISK")
        .map((milestone) => ({
          id: milestone.id,
          title: milestone.title,
          dueOn: milestone.dueDate!,
        })),
      openBlockers: blockers.map((thread) => ({
        id: thread.id,
        title: thread.title,
        openedAt: thread.createdAt,
      })),
      lastActivityAt: input.lastActivityAt,
      active: input.active ?? true,
      thresholds: thresholdsFor(input.collegeId),
    },
    now,
  );

  return { signals, level: healthLevel(signals) };
}
