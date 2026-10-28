import {
  DUPLICATE_THRESHOLD,
  MIN_CONTAINMENT_TRIGRAMS,
  PROBLEM_CORROBORATION_FLOOR,
  RELATED_THRESHOLD,
  SEARCH_STOPWORDS,
  SIMILARITY_WEIGHTS,
} from "@/config/search";

/**
 * THE DUPLICATE DETECTOR.
 *
 * Why this exists: the single most common failure in college project work is a
 * batch unknowingly rebuilding what a previous batch already built, badly, from
 * scratch. The institution loses the compounding it should have had. This
 * scorer is what makes `docs/CONTEXT.md`'s lineage feature possible — you
 * cannot offer to build on prior work if you cannot find it.
 *
 * What it deliberately is NOT: a plagiarism detector. It flags for a
 * conversation, never for an accusation. A replication study is good science
 * and scores identically to copying; only a human can tell them apart.
 *
 * Pure functions, no database, no I/O — so it is unit-testable against known
 * pairs, which is the only way to have any confidence in a heuristic.
 */

/* --------------------------------------------------------------- normalise */

/**
 * Mirrors the `nexivora_normalise` SQL function plus stopword removal.
 *
 * It must stay in step with the SQL: the database shortlists candidates using
 * a trigram index over the normalised problem statement, and this scores them
 * exactly. If the two disagree, the shortlist silently omits real matches and
 * the whole feature quietly under-reports.
 */
export function normalise(text: string): string {
  return (
    text
      .normalize("NFKD")
      // Strip combining marks — the JS equivalent of Postgres unaccent().
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  );
}

/** Normalised, stopword-stripped tokens. */
export function tokenise(text: string): string[] {
  return normalise(text)
    .split(" ")
    .filter((word) => word.length > 1 && !SEARCH_STOPWORDS.has(word));
}

/** Normalisation as the trigram comparison sees it: stopwords removed. */
export function normaliseForTrigrams(text: string): string {
  return tokenise(text).join(" ");
}

/* --------------------------------------------------------------- trigrams */

/**
 * pg_trgm's exact tokenisation: each word is padded with two leading spaces and
 * one trailing space before slicing. `show_trgm('word')` returns
 * {"  w"," wo",wor,ord,"rd "} and so does this.
 *
 * Reproducing it precisely is the point — a scorer that approximates the index
 * it queries will rank differently from the shortlist that fed it.
 */
export function trigrams(text: string): Set<string> {
  const out = new Set<string>();

  for (const word of normalise(text).split(" ")) {
    if (!word) continue;

    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i += 1) {
      out.add(padded.slice(i, i + 3));
    }
  }

  return out;
}

/* ------------------------------------------------------------------ scores */

/** |A ∩ B| / |A ∪ B|. Returns 0 for two empty sets rather than NaN. */
export function jaccard<T>(a: Iterable<T>, b: Iterable<T>): number {
  const setA = a instanceof Set ? a : new Set(a);
  const setB = b instanceof Set ? b : new Set(b);

  if (setA.size === 0 && setB.size === 0) return 0;

  let shared = 0;
  // Iterate the smaller set — the comparison is symmetric, the cost is not.
  const [small, large] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  for (const value of small) {
    if (large.has(value)) shared += 1;
  }

  return shared / (setA.size + setB.size - shared);
}

/**
 * Raw trigram Jaccard, matching `similarity()` from pg_trgm — which is Jaccard
 * over trigram sets, not the cosine measure the name might suggest.
 *
 * Exported because the SQL shortlist uses exactly this, so tests can assert the
 * two agree. It is NOT what `scoreSimilarity` uses; see below for why.
 */
export function trigramSimilarity(a: string, b: string): number {
  return jaccard(trigrams(normaliseForTrigrams(a)), trigrams(normaliseForTrigrams(b)));
}

/**
 * Problem-statement similarity: the geometric mean of Dice overlap and
 * containment.
 *
 * Plain Jaccard is wrong for this comparison and it took real data to see why.
 * The statements being compared are wildly different lengths — an archived
 * project carries a full multi-paragraph PROBLEM section, a freshly proposed
 * one carries two sentences. Jaccard divides by the union, so a short statement
 * almost entirely subsumed by a long one still scores low purely because the
 * long one has more trigrams. The seeded near-duplicate scored 0.201 that way,
 * which put the overall verdict at 0.420 — under the threshold, on a pair
 * deliberately constructed to be over it.
 *
 * Containment (|A ∩ B| / min(|A|, |B|)) fixes the length asymmetry but is too
 * generous on its own: a short, generic statement is "contained in" almost
 * anything, and it rated an attendance-recognition project as related to an
 * irrigation controller.
 *
 * Requiring both — their geometric mean — needs genuine shared vocabulary AND
 * subsumption. Measured across the whole seeded corpus:
 *
 *   measure           near-duplicate   worst unrelated pair
 *   jaccard                    0.420                  0.278   ← threshold missed
 *   dice                       0.501                  0.351
 *   containment                0.704                  0.368   ← rates unrelated work "related"
 *   geo(jaccard, cont)         0.521                  0.316
 *   geo(dice, cont)            0.585                  0.359   ← chosen
 *
 * The chosen measure is the only one that puts the designed duplicate clearly
 * above the threshold, keeps genuinely unrelated work below "related", and
 * still surfaces two campus-admin tools as related to each other — which they
 * are. Re-run the comparison if the corpus changes materially.
 */
export function problemSimilarity(a: string, b: string): number {
  const setA = trigrams(normaliseForTrigrams(a));
  const setB = trigrams(normaliseForTrigrams(b));

  if (setA.size === 0 || setB.size === 0) return 0;

  let shared = 0;
  const [small, large] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  for (const value of small) {
    if (large.has(value)) shared += 1;
  }

  const dice = (2 * shared) / (setA.size + setB.size);

  // Containment is unreliable below a certain length — see the constant's note.
  // Falling back to Dice alone there costs nothing, because a statement that
  // short carries too little signal to justify a duplication claim anyway.
  if (small.size < MIN_CONTAINMENT_TRIGRAMS) return dice;

  const containment = shared / small.size;

  return Math.sqrt(dice * containment);
}

/** Case- and whitespace-insensitive set overlap, for tag and stack lists. */
function tagOverlap(a: readonly string[], b: readonly string[]): number {
  const clean = (list: readonly string[]) =>
    new Set(list.map((item) => normalise(item)).filter(Boolean));

  return jaccard(clean(a), clean(b));
}

/* ------------------------------------------------------------------- model */

export type SimilarityInput = {
  /** The PROBLEM section body, or the idea's problem statement. */
  problem: string;
  /** Topic slugs. Titles are deliberately excluded — see the note below. */
  topics: readonly string[];
  techStack: readonly string[];
};

export type SimilarityVerdict = "duplicate" | "related" | "distinct";

export type SimilarityResult = {
  score: number;
  verdict: SimilarityVerdict;
  /** The three components, so the UI can explain the score instead of asserting it. */
  breakdown: {
    problem: number;
    topics: number;
    techStack: number;
  };
};

/**
 * Score two pieces of work against each other.
 *
 * Titles are not an input. Two teams solving genuinely different problems
 * routinely choose near-identical titles ("Smart Attendance System"), and two
 * teams solving the same problem often title it differently. Including titles
 * measured naming convention, not duplication.
 */
export function scoreSimilarity(a: SimilarityInput, b: SimilarityInput): SimilarityResult {
  const breakdown = {
    problem: problemSimilarity(a.problem, b.problem),
    topics: tagOverlap(a.topics, b.topics),
    techStack: tagOverlap(a.techStack, b.techStack),
  };

  // Shared topics and tools corroborate a problem-level match; on their own
  // they mean two teams read the same syllabus. Scaling the metadata by how
  // much problem signal there actually is stops a shared stack from carrying a
  // pair over the line by itself.
  const corroboration = Math.min(1, breakdown.problem / PROBLEM_CORROBORATION_FLOOR);

  const score =
    breakdown.problem * SIMILARITY_WEIGHTS.problem +
    (breakdown.topics * SIMILARITY_WEIGHTS.topics +
      breakdown.techStack * SIMILARITY_WEIGHTS.techStack) *
      corroboration;

  return { score, verdict: verdictFor(score), breakdown };
}

export function verdictFor(score: number): SimilarityVerdict {
  if (score >= DUPLICATE_THRESHOLD) return "duplicate";
  if (score >= RELATED_THRESHOLD) return "related";
  return "distinct";
}

/** Score one candidate against many, best first, dropping the noise. */
export function rankSimilar<T extends SimilarityInput>(
  subject: SimilarityInput,
  candidates: readonly T[],
): Array<{ candidate: T } & SimilarityResult> {
  return candidates
    .map((candidate) => ({ candidate, ...scoreSimilarity(subject, candidate) }))
    .filter((row) => row.verdict !== "distinct")
    .sort((x, y) => y.score - x.score);
}
