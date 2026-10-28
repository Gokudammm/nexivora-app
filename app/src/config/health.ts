/**
 * GROUP HEALTH THRESHOLDS.
 *
 * Separated from `config/ledger.ts` because the two answer different questions.
 * That file says what a contribution is *worth*; this one says when a pattern
 * is worth *mentioning*. Tuning one should never require thinking about the
 * other, and until Phase 9 they were tangled in the same object.
 *
 * Every number here is a judgement about people, not about software, so each
 * carries the reasoning that produced it. A threshold with no stated reason
 * gets tuned by whoever is annoyed by it that week.
 *
 * **These are shown to the group as well as to faculty** (ADR-045). That is a
 * reversal of what Phase 7 wrote, and the Phase 9 spec is right: a private
 * warning about a student, which the student cannot see, is surveillance. The
 * ledger is already visible to the group, so hiding the *signal* while showing
 * the *data it is derived from* was never coherent anyway.
 */

export type HealthThresholds = {
  /** No ledger event from a member in this many days makes them "silent". */
  silentMemberDays: number;
  /** Below this share of the group's total, a member is surfaced. */
  imbalanceShare: number;
  /** No activity of any kind in the workspace for this many days. */
  stalledDays: number;
  /** A BLOCKER thread open longer than this. */
  blockerDays: number;
  /** Nothing fires until the group has recorded at least this many events. */
  minEvents: number;
};

/**
 * The defaults.
 *
 * **14 days for a silent member** — long enough to survive an exam week, a
 * festival, or a member doing fieldwork the ledger cannot see. Seven days would
 * fire constantly and be ignored within a month, which is worse than not firing
 * at all.
 *
 * **10% share.** With a group of five, an even split is 20%; below 10% means
 * somebody is doing less than half of an even share, which is the point at
 * which the rest of the group has usually already noticed. Phase 7 used 8%; the
 * Phase 9 spec asks for 10% and it is the better number — 8% was chosen to be
 * conservative and mostly succeeded in never firing.
 *
 * **10 days stalled** — shorter than the silent-member window on purpose. One
 * member going quiet is common and often fine; the *whole group* going quiet for
 * a fortnight is the single most reliable predictor of a project that will
 * arrive at review unfinished.
 *
 * **7 days for a blocker.** A thread explicitly labelled BLOCKER is a group
 * saying "we are stuck". A week without resolution is the strongest signal in
 * this file, because it is the only one where somebody has already asked for
 * help.
 *
 * **25 events minimum.** Below that, a group has not done enough for a *share*
 * to mean anything: "a 10% contributor" out of nine total events is noise
 * dressed as a finding, and one of those teaches a faculty member to skip the
 * whole panel.
 */
export const HEALTH_DEFAULTS: HealthThresholds = {
  silentMemberDays: 14,
  imbalanceShare: 0.1,
  stalledDays: 10,
  blockerDays: 7,
  minEvents: 25,
};

/**
 * Per-college overrides.
 *
 * A college on a trimester system has different rhythms from one on semesters,
 * and a research group's fortnight of silence means something different from a
 * first-year class's. The shape exists now so Phase 15's per-college settings
 * have somewhere to write; today it is always empty and `thresholdsFor` returns
 * the defaults.
 */
const OVERRIDES: Record<string, Partial<HealthThresholds>> = {};

export function thresholdsFor(collegeId?: string | null): HealthThresholds {
  if (!collegeId) return HEALTH_DEFAULTS;
  return { ...HEALTH_DEFAULTS, ...(OVERRIDES[collegeId] ?? {}) };
}

/**
 * Ranking, worst first.
 *
 * The spec is explicit that health is **a ranked list, not a decorative
 * badge** — so the order has to be a decision rather than whatever the array
 * happened to be built in. A blocker outranks everything because somebody has
 * already asked for help and nobody answered.
 */
export const SIGNAL_RANK = {
  "unresolved-blocker": 0,
  stalled: 1,
  "slipped-milestone": 2,
  "silent-member": 3,
  imbalance: 4,
  unwritten: 5,
} as const;

export type SignalKind = keyof typeof SIGNAL_RANK;
