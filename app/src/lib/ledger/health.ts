import {
  SIGNAL_RANK,
  thresholdsFor,
  type HealthThresholds,
  type SignalKind,
} from "@/config/health";

import type { MemberScore } from "./score";

/**
 * GROUP HEALTH SIGNALS.
 *
 * *The feature that makes the faculty dashboard worth opening* — the phase spec's
 * own description, and the reason it is a **ranked list rather than a badge**. A
 * coloured dot tells a faculty member that something is wrong somewhere; a
 * ranked list tells them which group to open first on a Tuesday with fifteen
 * minutes.
 *
 * Four rules govern every signal here, and they are the difference between a
 * useful prompt and an automated accusation.
 *
 *  1. **A signal is a reason to ask, never a conclusion.** Every message states
 *     what the data shows and stops. A student may be carrying work the ledger
 *     cannot see — pair programming, field visits, a sick parent — and the one
 *     thing the system must not do is decide it knows.
 *  2. **Nothing fires on thin data.** Below `minEvents` the group has not done
 *     enough for a share to mean anything, and one noisy finding teaches a
 *     faculty member to skip the panel for good.
 *  3. **Every signal carries its evidence and an action.** "Contribution is
 *     uneven" is a shrug; "Rahul accounts for 6% of 210 recorded events, and
 *     nothing in 19 days" is something to open a conversation with.
 *  4. **The group sees these too** (ADR-045). Phase 7 wrote the opposite, and
 *     the Phase 9 spec is right to reverse it: a private warning about a student
 *     that the student cannot see is surveillance. The ledger the signals are
 *     derived from is already visible to the group, so hiding the summary while
 *     showing the data was never coherent. What changes for the group is the
 *     *framing*, not the content — see `AUDIENCE_FRAMING`.
 */

export type HealthSignal = {
  kind: SignalKind;
  severity: "info" | "warning";
  /** The member this concerns, when it concerns one. */
  userId: string | null;
  /** What the data shows. Never a conclusion about a person. */
  message: string;
  /** The specific numbers behind it, so the message can be checked. */
  evidence: string;
  /** What somebody could usefully do next. */
  action: { label: string; kind: "message" | "meet" | "review" | "open" };
};

export type HealthInput = {
  scores: readonly MemberScore[];
  totalEvents: number;
  /** Open tasks whose due date has passed. */
  overdueTasks: readonly { id: string; title: string; dueDate: Date }[];
  /** Milestones past their due date and not closed. */
  slippedMilestones: readonly { id: string; title: string; dueOn: Date }[];
  /** BLOCKER threads with no resolution. */
  openBlockers: readonly { id: string; title: string; openedAt: Date }[];
  /** The most recent event in the group, of any kind. */
  lastActivityAt: Date | null;
  /**
   * Whether the group's work is still in flight.
   *
   * `false` once the project is complete or archived, and it silences the three
   * signals that are really "nothing is happening here" — because on finished
   * work nothing happening is the correct state. Flagging a delivered project
   * as stalled is not a harmless false positive: it fills the dashboard, and a
   * dashboard where every group is flagged ranks nothing. Found by looking at a
   * screenshot of `/faculty`, where four of four groups carried a warning.
   *
   * An unresolved blocker and a slipped milestone still fire: those are loose
   * ends in the record, and a finished project is exactly when they should be
   * tidied rather than forgotten.
   */
  active?: boolean;
  /** Overrides the defaults. Omit for the standard thresholds. */
  thresholds?: HealthThresholds;
};

const daysBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 86_400_000;
const whole = (from: Date, to: Date) => Math.floor(daysBetween(from, to));

/**
 * Compute the signals, worst first.
 *
 * Ordered by `SIGNAL_RANK` and then by severity, so the list is a work queue
 * rather than an inventory.
 */
export function groupHealth(input: HealthInput, now = new Date()): HealthSignal[] {
  const limits = input.thresholds ?? thresholdsFor();
  const signals: HealthSignal[] = [];

  /* ----------------------------------------------- always worth saying */

  // A blocker outranks everything, and it is checked before the thin-data gate:
  // a group that says "we are stuck" in week one deserves an answer in week one,
  // and their event count is beside the point.
  for (const blocker of input.openBlockers) {
    const days = whole(blocker.openedAt, now);
    if (days < limits.blockerDays) continue;

    signals.push({
      kind: "unresolved-blocker",
      severity: "warning",
      userId: null,
      message: `"${blocker.title}" has been open as a blocker for ${days} days.`,
      evidence: `Raised ${blocker.openedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}, still unresolved.`,
      action: { label: "Open the thread", kind: "open" },
    });
  }

  const active = input.active ?? true;

  if (active && input.lastActivityAt) {
    const quiet = whole(input.lastActivityAt, now);
    if (quiet >= limits.stalledDays) {
      signals.push({
        kind: "stalled",
        severity: "warning",
        userId: null,
        message: `No recorded activity in this workspace for ${quiet} days.`,
        evidence: `Last event ${input.lastActivityAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.`,
        action: { label: "Schedule a check-in", kind: "meet" },
      });
    }
  }

  for (const milestone of input.slippedMilestones) {
    signals.push({
      kind: "slipped-milestone",
      severity: "warning",
      userId: null,
      message: `"${milestone.title}" was due ${whole(milestone.dueOn, now)} days ago and is not closed.`,
      evidence: `Due ${milestone.dueOn.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.`,
      action: { label: "Review the milestone", kind: "review" },
    });
  }

  /* ------------------------------------------- gated on enough evidence */

  // Member-level signals are about a live team: who is carrying the work right
  // now, and who has gone quiet. On finished work neither question has an
  // answer worth acting on.
  if (!active || input.totalEvents < limits.minEvents) return rank(signals);

  for (const score of input.scores) {
    const silentFor = score.lastActiveAt === null ? null : whole(score.lastActiveAt, now);

    if (silentFor === null || silentFor >= limits.silentMemberDays) {
      signals.push({
        kind: "silent-member",
        severity: "warning",
        userId: score.member.id,
        message:
          silentFor === null
            ? `${score.member.name} has no recorded activity in this workspace.`
            : `${score.member.name} has recorded nothing in ${silentFor} days.`,
        evidence:
          silentFor === null
            ? `0 of ${input.totalEvents} recorded events.`
            : `${score.eventCount} of ${input.totalEvents} recorded events; last on ${score.lastActiveAt!.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.`,
        action: { label: "Message the group", kind: "message" },
      });

      // One signal per member. A silent member is also, mechanically, a
      // low-share member, and two rows about the same person read as two
      // problems.
      continue;
    }

    if (score.share < limits.imbalanceShare) {
      signals.push({
        kind: "imbalance",
        severity: "info",
        userId: score.member.id,
        message: `${score.member.name} accounts for ${Math.round(score.share * 100)}% of recorded activity.`,
        evidence: `${score.eventCount} of ${input.totalEvents} events, ${score.points} points.`,
        action: { label: "Message the group", kind: "message" },
      });
    }
  }

  if (input.overdueTasks.length >= 3) {
    signals.push({
      kind: "unwritten",
      severity: "info",
      userId: null,
      message: `${input.overdueTasks.length} tasks are past their due date.`,
      evidence: input.overdueTasks
        .slice(0, 3)
        .map((task) => task.title)
        .join("; "),
      action: { label: "Open the board", kind: "open" },
    });
  }

  return rank(signals);
}

/** Worst first, by kind then by severity. */
function rank(signals: HealthSignal[]): HealthSignal[] {
  return [...signals].sort(
    (a, b) =>
      SIGNAL_RANK[a.kind] - SIGNAL_RANK[b.kind] ||
      (a.severity === b.severity ? 0 : a.severity === "warning" ? -1 : 1),
  );
}

/**
 * A single badge, for a list where a row per signal does not fit.
 *
 * Deliberately three levels and not a percentage. A health *score* invites
 * comparison between groups, which is exactly the thing these signals are not
 * good enough to support.
 */
export function healthLevel(signals: readonly HealthSignal[]): "ok" | "watch" | "attention" {
  if (signals.some((signal) => signal.severity === "warning")) return "attention";
  if (signals.length > 0) return "watch";
  return "ok";
}

/**
 * The same signals, worded for the group rather than for faculty.
 *
 * ADR-045 shows these to both audiences, and the content is identical — but a
 * sentence a faculty member reads as a prompt to check in can read to a group
 * as a public reprimand of a named teammate. So the group's version keeps every
 * number and drops the second-person edge: the faculty framing says what to do
 * *about* the group, the group's framing says what the data shows *to* them.
 *
 * What is never done: softening or withholding a number. If Rahul is at 6%, the
 * ledger already says so on the same screen.
 */
export const AUDIENCE_FRAMING = {
  faculty: {
    heading: "Needs attention",
    note: "Derived from recorded workspace activity. Each is a reason to ask, not a conclusion — a member may be carrying work the ledger cannot see.",
  },
  group: {
    heading: "Worth a look",
    note: "The same signals your faculty guide sees. They are derived from recorded activity and can be wrong about the work — if one is, the fix is usually to record what you are doing, not to argue with the number.",
  },
} as const;
