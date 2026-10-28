import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DUPLICATE_THRESHOLD,
  PROBLEM_CORROBORATION_FLOOR,
  RELATED_THRESHOLD,
} from "@/config/search";
import { projects } from "@/content/projects";

import {
  jaccard,
  normalise,
  normaliseForTrigrams,
  rankSimilar,
  scoreSimilarity,
  tokenise,
  problemSimilarity,
  trigramSimilarity,
  trigrams,
  verdictFor,
  type SimilarityInput,
} from "./similarity";

/**
 * These are the cases the scorer exists to get right. Each one is a real
 * scenario from the corpus in `src/content/projects.ts`, not a synthetic
 * string — a heuristic tested only against made-up input tells you nothing
 * about how it behaves on the thing it will actually see.
 */

/* ------------------------------------------------------------- primitives */

describe("normalise", () => {
  it("lowercases, strips punctuation and collapses whitespace", () => {
    assert.equal(normalise("  Soil-Moisture,   SENSING! "), "soil moisture sensing");
  });

  it("strips accents, matching Postgres unaccent()", () => {
    assert.equal(normalise("Café Ürün naïve"), "cafe urun naive");
  });

  it("returns an empty string for input with no alphanumerics", () => {
    assert.equal(normalise("—  !!! ***"), "");
  });
});

describe("tokenise", () => {
  it("removes the domain noise words that make everything look similar", () => {
    // "smart", "system", "using" and "based" appear in a large share of student
    // project titles. Leaving them in was the main source of false positives.
    assert.deepEqual(tokenise("A smart irrigation system using IoT based sensors"), [
      "irrigation",
      "iot",
      "sensors",
    ]);
  });

  it("drops single characters", () => {
    assert.deepEqual(tokenise("a b crop yield"), ["crop", "yield"]);
  });
});

describe("trigrams", () => {
  it("reproduces pg_trgm's padding exactly", () => {
    // show_trgm('word') = {"  w"," wo",wor,ord,"rd "}
    assert.deepEqual([...trigrams("word")].sort(), ["  w", " wo", "ord", "rd ", "wor"].sort());
  });

  it("treats each word separately", () => {
    const both = trigrams("crop yield");
    assert.ok(both.has("  c"));
    assert.ok(both.has("  y"));
  });

  it("is empty for empty input", () => {
    assert.equal(trigrams("").size, 0);
  });
});

describe("jaccard", () => {
  it("is 1 for identical sets and 0 for disjoint ones", () => {
    assert.equal(jaccard(["a", "b"], ["a", "b"]), 1);
    assert.equal(jaccard(["a"], ["b"]), 0);
  });

  it("is 0 rather than NaN for two empty sets", () => {
    assert.equal(jaccard([], []), 0);
  });

  it("computes the standard ratio", () => {
    // {a,b,c} ∩ {b,c,d} = 2, ∪ = 4
    assert.equal(jaccard(["a", "b", "c"], ["b", "c", "d"]), 0.5);
  });

  it("is symmetric", () => {
    const a = ["x", "y", "z"];
    const b = ["y", "w"];
    assert.equal(jaccard(a, b), jaccard(b, a));
  });
});

describe("trigramSimilarity", () => {
  it("scores an identical statement at 1", () => {
    const text = "Farmers irrigate on a fixed schedule and waste water";
    assert.equal(trigramSimilarity(text, text), 1);
  });

  it("scores unrelated statements near 0", () => {
    const score = trigramSimilarity(
      "Farmers irrigate on a fixed schedule and waste water",
      "Lecture attendance is recorded on paper and takes ten minutes",
    );
    assert.ok(score < 0.15, `expected < 0.15, got ${score}`);
  });

  it("tolerates the misspellings students actually type", () => {
    const score = trigramSimilarity("soil moisture irrigation", "soil moisure irigation");
    assert.ok(score > 0.5, `expected > 0.5, got ${score}`);
  });
});

describe("problemSimilarity", () => {
  it("is 1 for an identical statement and 0 when one side is empty", () => {
    const text = "Farmers irrigate on a fixed schedule and waste a third of the water they draw";
    assert.equal(problemSimilarity(text, text), 1);
    assert.equal(problemSimilarity(text, ""), 0);
  });

  it("survives the length asymmetry that plain Jaccard cannot", () => {
    // This is the property the whole measure exists for. A short summary of a
    // problem and a long description of the same problem must score high;
    // Jaccard scores them low purely because the long text has more trigrams.
    const long =
      "The campus farm irrigates on a fixed timer: forty minutes, twice a day, every day. " +
      "It runs during rainfall and it runs when the soil is already saturated. The farm " +
      "supervisor estimated the waste at roughly a third of total water drawn, and nobody " +
      "has measured it directly because there is no instrumentation on the line at all.";
    const short =
      "Field irrigation runs on a fixed timer and waters regardless of rainfall or how wet " +
      "the soil already is, wasting a significant share of the water used.";

    const blended = problemSimilarity(long, short);
    const plain = trigramSimilarity(long, short);

    assert.ok(
      blended > plain,
      `blended ${blended.toFixed(3)} should exceed jaccard ${plain.toFixed(3)}`,
    );
    assert.ok(blended > 0.4, `expected a strong match, got ${blended.toFixed(3)}`);
  });

  it("ignores containment for statements too short to be evidence", () => {
    // A handful of words is "contained in" almost any longer document. Below
    // the floor the measure falls back to Dice, so a fragment cannot claim a
    // high score against an essay.
    const fragment = "the system is slow";
    const essay =
      "The system is slow to respond under load because every request re-reads the whole " +
      "roster from disk, and the roster grows with each term that passes without archival.";

    assert.ok(
      trigrams(normaliseForTrigrams(fragment)).size < 60,
      "the fragment should sit below the containment floor",
    );
    assert.ok(problemSimilarity(fragment, essay) < 0.3);
  });

  it("is symmetric", () => {
    const a = "Attendance is taken on paper and aggregated by hand at the end of term";
    const b = "Lecture attendance uses a paper register that somebody totals up later";
    assert.equal(problemSimilarity(a, b), problemSimilarity(b, a));
  });
});

/* ------------------------------------------------- the cases that matter */

/**
 * The pairs below come from the real corpus, not from prose written to make the
 * test pass.
 *
 * This matters: the first version of this file used invented statements of
 * similar length, scored the near-duplicate at 0.562, and passed comfortably.
 * The actual fixture pair scored 0.420 and failed, because real problem
 * statements differ enormously in length — an archived project has a full
 * section, a proposed one has two sentences. A test easier than production
 * tells you nothing. Reading the fixtures directly means it cannot drift back.
 */
function fromFixture(slug: string): SimilarityInput {
  const project = projects.find((candidate) => candidate.slug === slug);
  assert.ok(project, `fixture project "${slug}" is missing — the test cannot run`);

  const problem = project.sections.find((section) => section.kind === "PROBLEM");
  assert.ok(problem, `fixture project "${slug}" has no PROBLEM section`);

  return { problem: problem.body, topics: project.topics, techStack: project.techStack };
}

/** Archived. The original, with a full problem section. */
const irrigation = fromFixture("smart-irrigation-soil-moisture");
/** Proposed, unapproved, and deliberately covering the same ground in two sentences. */
const irrigationNearDuplicate = fromFixture("soil-moisture-irrigation-control");
/** Unrelated in every respect except that both are student projects. */
const attendance = fromFixture("attendance-face-recognition");

describe("scoreSimilarity", () => {
  it("flags the deliberate near-duplicate as a duplicate", () => {
    const result = scoreSimilarity(irrigation, irrigationNearDuplicate);

    assert.ok(
      result.score >= DUPLICATE_THRESHOLD,
      `near-duplicate scored ${result.score.toFixed(3)}, below the ${DUPLICATE_THRESHOLD} threshold`,
    );
    assert.equal(result.verdict, "duplicate");
  });

  it("does not flag an unrelated project", () => {
    const result = scoreSimilarity(irrigation, attendance);

    assert.ok(
      result.score < DUPLICATE_THRESHOLD,
      `unrelated pair scored ${result.score.toFixed(3)}, at or above the threshold`,
    );
    assert.notEqual(result.verdict, "duplicate");
  });

  it("does not flag a shared tech stack as duplication", () => {
    // Both use Python. That is not a signal, and treating it as one would make
    // the check cry wolf on every project in the department.
    const a: SimilarityInput = {
      problem: "Bus routes in the city are planned manually and ignore live demand.",
      topics: ["software"],
      techStack: ["Python", "PostgreSQL", "React"],
    };
    const b: SimilarityInput = {
      problem: "Hospital triage queues are ordered by arrival time rather than severity.",
      topics: ["healthcare"],
      techStack: ["Python", "PostgreSQL", "React"],
    };

    const result = scoreSimilarity(a, b);
    assert.equal(result.verdict, "distinct", `scored ${result.score.toFixed(3)}`);
  });

  it("scores identical work at 1", () => {
    assert.equal(scoreSimilarity(irrigation, irrigation).score, 1);
  });

  it("is symmetric", () => {
    const forward = scoreSimilarity(irrigation, attendance).score;
    const backward = scoreSimilarity(attendance, irrigation).score;
    assert.equal(forward, backward);
  });

  it("returns a breakdown that explains the score", () => {
    const { breakdown, score } = scoreSimilarity(irrigation, irrigationNearDuplicate);

    assert.ok(breakdown.problem > 0, "problem component should contribute");
    assert.ok(breakdown.topics > 0, "topic component should contribute");

    // The UI shows this breakdown next to the score, so the two have to agree.
    // Metadata is scaled by how much problem signal corroborates it.
    const corroboration = Math.min(1, breakdown.problem / PROBLEM_CORROBORATION_FLOOR);
    const recomposed =
      breakdown.problem * 0.6 +
      (breakdown.topics * 0.25 + breakdown.techStack * 0.15) * corroboration;

    assert.ok(Math.abs(recomposed - score) < 1e-9, `${recomposed} vs ${score}`);
  });

  it("survives an empty problem statement without throwing", () => {
    const empty: SimilarityInput = { problem: "", topics: [], techStack: [] };
    const result = scoreSimilarity(empty, irrigation);
    assert.equal(result.score, 0);
    assert.equal(result.verdict, "distinct");
  });
});

describe("verdictFor", () => {
  it("uses the configured boundaries inclusively", () => {
    assert.equal(verdictFor(DUPLICATE_THRESHOLD), "duplicate");
    assert.equal(verdictFor(RELATED_THRESHOLD), "related");
    assert.equal(verdictFor(RELATED_THRESHOLD - 0.001), "distinct");
  });
});

describe("rankSimilar", () => {
  it("orders by score and drops distinct candidates", () => {
    const ranked = rankSimilar(irrigation, [attendance, irrigationNearDuplicate]);

    assert.equal(ranked.length, 1, "the unrelated project should be dropped");
    assert.equal(ranked[0]?.verdict, "duplicate");
  });

  it("returns an empty list when nothing is close", () => {
    assert.deepEqual(rankSimilar(attendance, []), []);
  });
});

describe("normaliseForTrigrams", () => {
  it("agrees with the tokeniser, so the SQL shortlist and the scorer match", () => {
    // The database indexes what nexivora_normalise() produces; this function is
    // what the scorer compares. If they diverge, the shortlist silently omits
    // real matches.
    assert.equal(normaliseForTrigrams("A Smart Irrigation System"), "irrigation");
  });
});
