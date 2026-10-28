/**
 * Contribution ledger weights (ADR-007).
 *
 * These live in config and are denormalised onto each event at write time, so
 * tuning them changes what future contribution looks like without silently
 * rewriting what past contribution looked like. A number here is never a
 * migration.
 *
 * The scale is deliberately flat. A ledger that rewards one action ten times
 * more than another becomes a game, and a gamed ledger is worse than no ledger:
 * it produces a number that looks objective and is not. These weights say
 * "closing a task counts for more than posting a message", and nothing
 * stronger than that.
 */
export const LEDGER_WEIGHTS = {
  TASK_CLOSED: 5,
  MILESTONE_OWNED: 8,
  FILE_ADDED: 3,
  FILE_REVISED: 2,
  COMMIT_LINKED: 3,
  THREAD_STARTED: 2,
  MESSAGE_POSTED: 1,
  MEETING_ATTENDED: 2,
  REVIEW_GIVEN: 3,
} as const;

export type LedgerEventKind = keyof typeof LEDGER_WEIGHTS;

/**
 * Below this share of a group's total, a member is surfaced to faculty as
 * possibly disengaged.
 *
 * It is shown to faculty, never to the group, and never as an accusation. A
 * student may be carrying the work in a way the ledger cannot see — pair
 * programming, field visits, caring for a sick parent. The signal's only job is
 * to prompt someone to ask.
 */
export const DISENGAGEMENT_SHARE = 0.08;

/** A group needs at least this much recorded activity before the signal means anything. */
export const HEALTH_SIGNAL_MIN_EVENTS = 25;
