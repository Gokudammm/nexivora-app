/**
 * Search and duplicate-detection tuning.
 *
 * These numbers are in config rather than in the code or the database because
 * they need to be adjusted against real usage, and adjusting them must never
 * require a migration or a redeploy of the scorer. Every value here is a
 * judgement call, so each one carries the reasoning that produced it.
 */

/**
 * How the duplicate score is composed. Must sum to 1.
 *
 * The problem statement dominates deliberately. Two teams can use the same
 * stack on entirely different problems — that is normal and not duplication.
 * Two teams describing the same problem in the same words is the case worth
 * flagging, and it is the case that actually happens: a junior batch picks the
 * same "smart attendance system" a senior batch already built.
 */
export const SIMILARITY_WEIGHTS = {
  problem: 0.6,
  topics: 0.25,
  techStack: 0.15,
} as const;

/**
 * At or above this, the submission flow shows the matches and asks the student
 * to explain how theirs differs. It does NOT block: the check exists to make a
 * conversation happen, not to make an automated accusation. A legitimate
 * replication study is a good project, and a scorer cannot tell one from
 * plagiarism.
 */
export const DUPLICATE_THRESHOLD = 0.45;

/**
 * Below this, a candidate is not worth showing at all. Between the two numbers
 * the match appears as "related work you might want to read" — which is useful
 * to the student either way.
 */
export const RELATED_THRESHOLD = 0.2;

/** How many candidates the SQL shortlist returns before exact scoring. */
export const SIMILARITY_CANDIDATE_LIMIT = 25;

/**
 * Containment is only consulted when the shorter statement has at least this
 * many trigrams — roughly a dozen content words after stopword removal.
 *
 * Below that it is noise dressed as signal: a six-word statement is "50%
 * contained" in almost any longer document, purely because short English
 * fragments share trigrams. Under the floor the score falls back to Dice
 * overlap alone, which has no such inflation. The seeded near-duplicate's
 * shorter side is 95 trigrams, comfortably clear of this.
 */
export const MIN_CONTAINMENT_TRIGRAMS = 60;

/**
 * Topic and tech-stack overlap corroborate a problem-level match. They cannot
 * create one.
 *
 * Below this much problem similarity, the metadata contribution is scaled down
 * proportionally. Without it, two projects sharing nothing but Python,
 * PostgreSQL and React scored 0.203 — over the "related" line on stack alone,
 * on problems as different as bus routing and hospital triage. Half the
 * department shares a stack; treating that as evidence of duplication would
 * make the check cry wolf constantly, and a check nobody believes is worse than
 * no check.
 *
 * Scaled rather than gated, so there is no cliff where one extra shared word
 * flips a verdict.
 */
export const PROBLEM_CORROBORATION_FLOOR = 0.15;

/**
 * The trigram floor used by the SQL shortlist. Lower than DUPLICATE_THRESHOLD
 * on purpose: the shortlist only has the problem statement to go on, so it must
 * over-fetch and let the full weighted scorer decide.
 */
export const SIMILARITY_SHORTLIST_FLOOR = 0.15;

/**
 * Words carrying no discriminating signal in an academic project corpus.
 *
 * Note what is here beyond ordinary English stopwords: "system", "project",
 * "using", "smart", "based". Nearly every student project title contains at
 * least one, so leaving them in makes unrelated projects look similar — the
 * single largest source of false positives in the first version of this scorer.
 */
export const SEARCH_STOPWORDS: ReadonlySet<string> = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "but",
  "by",
  "can",
  "for",
  "from",
  "has",
  "have",
  "how",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "their",
  "then",
  "there",
  "these",
  "they",
  "this",
  "to",
  "was",
  "we",
  "were",
  "what",
  "when",
  "which",
  "will",
  "with",
  // Domain noise.
  "system",
  "systems",
  "project",
  "projects",
  "approach",
  "based",
  "design",
  "developed",
  "development",
  "implementation",
  "method",
  "model",
  "module",
  "novel",
  "proposed",
  "smart",
  "solution",
  "study",
  "use",
  "used",
  "using",
  "work",
  "application",
  "applications",
  "new",
  "efficient",
  "effective",
]);
