import { LEDGER_WEIGHTS, type LedgerEventKind } from "@/config/ledger";

/**
 * SCORING THE LEDGER.
 *
 * Pure functions over rows, deliberately: the scoring rule is the part most
 * likely to be argued about by a student who feels it undercounted them, and an
 * argument about a rule you can read and unit-test is a very different
 * conversation from an argument about a number a database produced.
 *
 * What a score is **not**: a mark, a quality judgement, or a ranking. It is
 * *how much recorded activity this person accounts for*, and every number the
 * interface shows links back to the events that produced it. The chart is
 * evidence with a total attached, not a grade.
 *
 * Three properties the tests pin down, because each is a way this could go
 * quietly wrong:
 *
 *  · Shares always sum to 100% (or to zero when there is nothing to share).
 *  · A member with no events appears with zero, rather than vanishing — the
 *    absence is the signal, and dropping the row hides it.
 *  · Compensating events (negative weights) subtract, and a member can never
 *    fall below a zero share as a result.
 */

export type LedgerRow = {
  userId: string;
  kind: LedgerEventKind;
  weight: number;
  createdAt: Date;
};

export type Member = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
};

export type MemberScore = {
  member: Member;
  /** Sum of event weights. Never negative — compensation can zero it, not invert it. */
  points: number;
  /** 0–1. Sums to 1 across members whenever any member has points. */
  share: number;
  eventCount: number;
  byKind: Record<LedgerEventKind, { count: number; points: number }>;
  lastActiveAt: Date | null;
};

const EMPTY_BY_KIND = (): Record<LedgerEventKind, { count: number; points: number }> =>
  Object.fromEntries(
    (Object.keys(LEDGER_WEIGHTS) as LedgerEventKind[]).map((kind) => [
      kind,
      { count: 0, points: 0 },
    ]),
  ) as Record<LedgerEventKind, { count: number; points: number }>;

/**
 * Score every member of a group.
 *
 * `members` comes first and drives the output, so a member with no events is
 * still a row. That ordering is the whole reason the disengagement signal in
 * `health.ts` has anything to fire on.
 */
export function scoreMembers(
  members: readonly Member[],
  rows: readonly LedgerRow[],
): MemberScore[] {
  const scores = new Map<string, MemberScore>(
    members.map((member) => [
      member.id,
      {
        member,
        points: 0,
        share: 0,
        eventCount: 0,
        byKind: EMPTY_BY_KIND(),
        lastActiveAt: null,
      },
    ]),
  );

  for (const row of rows) {
    const score = scores.get(row.userId);
    // An event from somebody who has since left the group is not attributed to
    // a phantom row. Their contribution happened, but the ledger's job here is
    // to describe the current team's shares, and a departed member's column
    // would be a permanently frozen accusation.
    if (!score) continue;

    score.points += row.weight;
    score.eventCount += 1;

    const bucket = score.byKind[row.kind];
    bucket.count += 1;
    bucket.points += row.weight;

    if (!score.lastActiveAt || row.createdAt > score.lastActiveAt) {
      score.lastActiveAt = row.createdAt;
    }
  }

  const result = [...scores.values()].map((score) => ({
    ...score,
    points: Math.max(0, score.points),
  }));

  const total = result.reduce((sum, score) => sum + score.points, 0);

  return result
    .map((score) => ({ ...score, share: total === 0 ? 0 : score.points / total }))
    .sort((a, b) => b.points - a.points || a.member.name.localeCompare(b.member.name));
}

/* ----------------------------------------------------------------- shapes */

export type TimelinePoint = {
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  /** Cumulative points per member at the end of that day. */
  byMember: Record<string, number>;
  total: number;
};

/**
 * Contribution over the life of the project, cumulatively.
 *
 * Cumulative rather than per-day on purpose: a per-day chart of five students'
 * coursework is mostly zeroes with spikes the night before each deadline, which
 * is true and unreadable. The cumulative view shows the shape people actually
 * want — who was carrying it, and from when.
 */
export function contributionTimeline(
  members: readonly Member[],
  rows: readonly LedgerRow[],
): TimelinePoint[] {
  if (rows.length === 0) return [];

  const day = (date: Date) => date.toISOString().slice(0, 10);
  const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const running: Record<string, number> = Object.fromEntries(
    members.map((member) => [member.id, 0]),
  );

  const points: TimelinePoint[] = [];
  let total = 0;
  let cursor = day(sorted[0]!.createdAt);

  const flush = (date: string) => {
    points.push({ date, byMember: { ...running }, total });
  };

  for (const row of sorted) {
    const rowDay = day(row.createdAt);
    if (rowDay !== cursor) {
      flush(cursor);
      cursor = rowDay;
    }
    if (row.userId in running) {
      running[row.userId] = Math.max(0, (running[row.userId] ?? 0) + row.weight);
      total += row.weight;
    }
  }
  flush(cursor);

  return points;
}

/**
 * The most uneven pair, as a plain sentence.
 *
 * Shown to the group, not only to faculty (ADR-008's transparency half): the
 * point of a visible ledger is that it changes behaviour *during* the project,
 * and a number nobody interprets changes nothing. The wording stays factual —
 * it reports a ratio, it does not accuse anybody of anything.
 */
export function balanceSummary(scores: readonly MemberScore[]): string | null {
  const active = scores.filter((score) => score.points > 0);
  if (scores.length < 2 || active.length === 0) return null;

  const top = scores[0]!;
  const bottom = scores[scores.length - 1]!;

  if (bottom.points === 0) {
    return `${bottom.member.name} has no recorded activity yet. ${top.member.name} accounts for ${Math.round(top.share * 100)}% of the group's.`;
  }

  const ratio = top.points / bottom.points;
  if (ratio < 2) return "Contribution is broadly even across the group.";

  return `${top.member.name} accounts for ${ratio.toFixed(1)}× the recorded activity of ${bottom.member.name}.`;
}

/** Human label for an event kind, used in the breakdown table and the activity list. */
export const LEDGER_LABEL: Record<LedgerEventKind, string> = {
  TASK_CLOSED: "Tasks closed",
  MILESTONE_OWNED: "Milestones owned",
  FILE_ADDED: "Files added",
  FILE_REVISED: "File revisions",
  COMMIT_LINKED: "Commits linked",
  THREAD_STARTED: "Discussions started",
  MESSAGE_POSTED: "Replies posted",
  MEETING_ATTENDED: "Meetings attended",
  REVIEW_GIVEN: "Peer reviews given",
};

/** Past-tense phrasing for a single event, for the activity stream. */
export const LEDGER_VERB: Record<LedgerEventKind, string> = {
  TASK_CLOSED: "closed a task",
  MILESTONE_OWNED: "completed a milestone",
  FILE_ADDED: "added a file",
  FILE_REVISED: "uploaded a new version",
  COMMIT_LINKED: "linked a commit",
  THREAD_STARTED: "started a discussion",
  MESSAGE_POSTED: "replied in a discussion",
  MEETING_ATTENDED: "attended a meeting",
  REVIEW_GIVEN: "submitted a peer review",
};
