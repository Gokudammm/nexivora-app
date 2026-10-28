import { SCORE_MAX } from "./rubric";

/**
 * EVALUATION SCORING.
 *
 * Pure arithmetic over criteria and scores, deliberately: a mark is the single
 * most disputable number this product produces, and an argument about a formula
 * somebody can read is a very different conversation from an argument about a
 * number a database returned.
 *
 * **Per-member scores are the payoff for the whole contribution ledger.** A
 * group mark that is the same for five people who did visibly different amounts
 * is the thing every student already knows is unfair and no institution has the
 * evidence to fix. The ledger is that evidence, and `deviation()` below is what
 * turns it into a defensible mark — which is why a member score that departs
 * from the group's requires a reason and the interface puts the ledger beside
 * the input.
 */

export type Criterion = { id: string; name: string; weight: number };

/** A score for one criterion. `memberId` null means the group's own score. */
export type Score = { criterionId: string; memberId: string | null; score: number };

export type Total = {
  /** 0–100, weighted. */
  percent: number;
  /** Criteria that have been scored, out of the total. */
  scored: number;
  of: number;
  /** True when every criterion carries a score. */
  complete: boolean;
};

/**
 * The weighted total.
 *
 * Only scored criteria contribute, and `complete` reports whether that is all
 * of them. An unscored criterion is deliberately **not** treated as zero: a
 * half-marked evaluation showing 38% would read as a fail rather than as
 * unfinished, and somebody would eventually release one.
 */
export function totalFor(
  criteria: readonly Criterion[],
  scores: readonly Score[],
  memberId: string | null = null,
): Total {
  const relevant = new Map(
    scores
      .filter((score) => score.memberId === memberId)
      .map((score) => [score.criterionId, score]),
  );

  let weighted = 0;
  let weightScored = 0;

  for (const criterion of criteria) {
    const score = relevant.get(criterion.id);
    if (!score) continue;

    weighted += (score.score / SCORE_MAX) * criterion.weight;
    weightScored += criterion.weight;
  }

  return {
    // Normalised by the weight actually scored, so a partial evaluation shows
    // "72% of what is marked so far" rather than a misleading fraction of 100.
    percent: weightScored === 0 ? 0 : Math.round((weighted / weightScored) * 100),
    scored: relevant.size,
    of: criteria.length,
    complete: relevant.size === criteria.length && criteria.length > 0,
  };
}

/**
 * How far a member's mark departs from the group's, in percentage points.
 *
 * Positive means above the group. The sign matters in the interface: raising
 * somebody deserves the same evidential standard as lowering them, and a form
 * that only demanded a reason for a penalty would quietly encourage inflating
 * the rest.
 */
export function deviation(groupPercent: number, memberPercent: number): number {
  return memberPercent - groupPercent;
}

/**
 * Below this, a member score is treated as "the same as the group".
 *
 * Rounding two weighted totals to whole percents produces one-point differences
 * out of nothing, and demanding a written justification for a rounding artefact
 * would teach faculty to write "n/a" — which is worse than no requirement, since
 * it makes every real reason look like boilerplate.
 */
export const DEVIATION_TOLERANCE = 2;

export const deviates = (groupPercent: number, memberPercent: number): boolean =>
  Math.abs(deviation(groupPercent, memberPercent)) > DEVIATION_TOLERANCE;

/**
 * Is this evaluation ready to release?
 *
 * Every unmet condition at once, like Phase 8's submission checklist — a
 * release blocked one reason at a time is the shape that makes people give up
 * and mark on paper.
 */
export type ReleaseCheck = { ok: true } | { ok: false; problems: string[] };

export function canRelease(input: {
  criteria: readonly Criterion[];
  scores: readonly Score[];
  members: readonly { id: string; name: string }[];
  /** Reasons keyed by member id, for members whose mark deviates. */
  reasons: Readonly<Record<string, string | null | undefined>>;
  outcome: string | null;
  comments: string | null;
}): ReleaseCheck {
  const problems: string[] = [];

  const group = totalFor(input.criteria, input.scores, null);
  if (!group.complete) {
    const missing = input.criteria.filter(
      (criterion) =>
        !input.scores.some(
          (score) => score.memberId === null && score.criterionId === criterion.id,
        ),
    );
    problems.push(
      `${missing.length} ${missing.length === 1 ? "criterion is" : "criteria are"} unscored: ${missing
        .map((criterion) => criterion.name)
        .join(", ")}.`,
    );
  }

  if (!input.outcome) {
    problems.push("Choose an outcome — accept, request changes, or reject.");
  }

  // The spec is blunt about this: "Needs improvement" as an outcome helps
  // nobody and will be the most common failure mode if the form permits it.
  if (input.outcome === "CHANGES" && (input.comments ?? "").trim().length < 30) {
    problems.push(
      "Requesting changes needs specifics. A sentence naming what to change is the only part the group can act on.",
    );
  }

  for (const member of input.members) {
    const memberTotal = totalFor(input.criteria, input.scores, member.id);
    if (!memberTotal.complete) continue;

    if (deviates(group.percent, memberTotal.percent)) {
      const reason = (input.reasons[member.id] ?? "").trim();
      if (reason.length < 10) {
        const delta = deviation(group.percent, memberTotal.percent);
        problems.push(
          `${member.name}'s mark is ${Math.abs(delta)} points ${delta > 0 ? "above" : "below"} the group's and needs a reason.`,
        );
      }
    }
  }

  return problems.length === 0 ? { ok: true } : { ok: false, problems };
}

/**
 * A member's mark, pre-filled from the group's.
 *
 * Every member starts identical to the group and is adjusted from there — the
 * opposite default (blank, fill in five sets of scores) makes differentiating
 * expensive and identical marks free, which produces exactly the undifferentiated
 * marking the ledger exists to fix.
 */
export function prefillMemberScores(groupScores: readonly Score[], memberId: string): Score[] {
  return groupScores
    .filter((score) => score.memberId === null)
    .map((score) => ({ criterionId: score.criterionId, memberId, score: score.score }));
}

export const OUTCOMES = [
  {
    value: "ACCEPT",
    label: "Accept",
    description: "The work is complete. The project moves to completed and the marks are released.",
  },
  {
    value: "CHANGES",
    label: "Request changes",
    description:
      "Unlocks the record so the group can revise. Requires specifics — this is the only part they can act on.",
  },
  {
    value: "REJECT",
    label: "Reject",
    description:
      "The submission is not acceptable. Requires a reason, and the record stays locked.",
  },
] as const;

export type Outcome = (typeof OUTCOMES)[number]["value"];
