/**
 * RUBRICS.
 *
 * Two rules carry this file, and the second is the one that matters.
 *
 * **Weights sum to 100.** Not "should" — a rubric whose weights sum to 94 has a
 * maximum achievable mark of 94, and nobody notices until a student compares
 * their total with somebody else's from a different rubric. `validateRubric`
 * refuses to save one.
 *
 * **Rubrics are versioned, never edited** (the phase spec calls an edited
 * rubric that retroactively changes past evaluations *"a serious academic
 * integrity problem"*, and it is right). Once an `Evaluation` references a
 * rubric, that rubric is frozen: editing it produces **version n+1**, a new row,
 * and every existing evaluation keeps pointing at the version it was actually
 * scored against.
 *
 * The alternative — mutating in place — means a student who queries their mark
 * six months later is shown a rubric that did not exist when they were marked.
 * That is not a display bug; it is a record that cannot be defended.
 */

export type CriterionDraft = {
  /** Present when editing an existing criterion; absent when adding one. */
  id?: string;
  name: string;
  weight: number;
  /** Level descriptors, worst to best. Optional but strongly encouraged. */
  descriptors?: readonly string[];
};

export type RubricValidation = { ok: true } | { ok: false; error: string; field?: string };

/** The scale every criterion is scored on. Kept here so nothing hard-codes 5. */
export const SCORE_MAX = 5;

/** How many level descriptors a criterion carries when it has them. */
export const DESCRIPTOR_LEVELS = SCORE_MAX;

export function validateRubric(
  name: string,
  criteria: readonly CriterionDraft[],
): RubricValidation {
  if (name.trim().length < 3) {
    return { ok: false, field: "name", error: "Give the rubric a name." };
  }

  if (criteria.length === 0) {
    return { ok: false, field: "criteria", error: "A rubric needs at least one criterion." };
  }

  if (criteria.length > 12) {
    return {
      ok: false,
      field: "criteria",
      error:
        "Twelve criteria is already more than anyone marks consistently. Combine some — a rubric nobody applies the same way twice is worse than a coarse one.",
    };
  }

  for (const criterion of criteria) {
    if (criterion.name.trim().length < 2) {
      return { ok: false, field: "criteria", error: "Every criterion needs a name." };
    }
    if (!Number.isInteger(criterion.weight) || criterion.weight < 1) {
      return {
        ok: false,
        field: "criteria",
        error: `"${criterion.name}" needs a whole-number weight of at least 1.`,
      };
    }
  }

  const total = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  if (total !== 100) {
    return {
      ok: false,
      field: "criteria",
      error: `Weights must sum to 100 — these sum to ${total}. ${
        total < 100
          ? `Add ${100 - total} somewhere, or the highest achievable mark is ${total}%.`
          : `Remove ${total - 100}, or the rubric can award more than 100%.`
      }`,
    };
  }

  const names = criteria.map((criterion) => criterion.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) {
    return { ok: false, field: "criteria", error: "Two criteria have the same name." };
  }

  return { ok: true };
}

/**
 * May this rubric be edited in place, or must the edit create a version?
 *
 * The rule is not "has it been used recently" or "is it old" — it is whether
 * **any evaluation references it**. One is enough: that evaluation's total was
 * computed from these weights, and changing them changes a mark that has
 * already been given.
 */
export function requiresNewVersion(evaluationCount: number): boolean {
  return evaluationCount > 0;
}

/** Human explanation of the versioning rule, shown at the point of editing. */
export const VERSION_NOTICE =
  "This rubric has been used to mark work, so saving creates version {next} rather than changing version {current}. Existing evaluations keep the version they were scored against — a mark has to stay defensible six months later.";

export function versionNotice(current: number): string {
  return VERSION_NOTICE.replace("{next}", String(current + 1)).replace(
    "{current}",
    String(current),
  );
}

/* -------------------------------------------------------------- templates */

/**
 * Starting points, not prescriptions.
 *
 * A faculty member facing an empty rubric builder writes four vague criteria
 * and moves on; one starting from a template edits it, which produces a better
 * rubric in less time. Same argument as Phase 8's section guidance.
 */
export type RubricTemplate = {
  key: string;
  name: string;
  description: string;
  criteria: readonly { name: string; weight: number; descriptors: readonly string[] }[];
};

const levels = (worst: string, poor: string, fair: string, good: string, best: string) =>
  [worst, poor, fair, good, best] as const;

export const RUBRIC_TEMPLATES: readonly RubricTemplate[] = [
  {
    key: "engineering-project",
    name: "Engineering project",
    description: "For a build-and-test project with a working artefact.",
    criteria: [
      {
        name: "Problem definition",
        weight: 15,
        descriptors: levels(
          "No identifiable problem statement.",
          "A topic rather than a problem; no affected party named.",
          "A problem is stated but its cost and scope are vague.",
          "Specific problem, named stakeholders, some evidence of cost.",
          "Specific, evidenced, and framed so success is measurable.",
        ),
      },
      {
        name: "Technical approach",
        weight: 25,
        descriptors: levels(
          "No coherent approach.",
          "An approach with no justification for choosing it.",
          "Reasonable approach; alternatives not considered.",
          "Justified against at least one alternative.",
          "Justified, with the trade-off stated and the rejected option named.",
        ),
      },
      {
        name: "Implementation",
        weight: 20,
        descriptors: levels(
          "Nothing working.",
          "Fragments that do not run together.",
          "Works in the demonstrated case only.",
          "Works reliably; edge cases acknowledged.",
          "Works reliably, handles failure, and the limits are documented.",
        ),
      },
      {
        name: "Testing and results",
        weight: 20,
        descriptors: levels(
          "No testing.",
          "Anecdotal results, no baseline.",
          "Results with a baseline but no error or sample size.",
          "Quantified against a baseline with sample size stated.",
          "Quantified, with error bars, and a negative result reported honestly.",
        ),
      },
      {
        name: "Documentation",
        weight: 20,
        descriptors: levels(
          "Sections empty.",
          "Sections present but thin.",
          "Complete but hard to follow.",
          "Complete and clear; another group could continue it.",
          "Complete, clear, and the future-work section is genuinely useful.",
        ),
      },
    ],
  },
  {
    key: "research-study",
    name: "Research study",
    description: "For a study whose output is a finding rather than an artefact.",
    criteria: [
      {
        name: "Literature and gap",
        weight: 25,
        descriptors: levels(
          "No engagement with existing work.",
          "Sources listed, not engaged with.",
          "Existing work summarised; the gap is asserted.",
          "The gap is argued from the sources.",
          "The gap is argued, and the framing changed because of what was read.",
        ),
      },
      {
        name: "Method",
        weight: 30,
        descriptors: levels(
          "No described method.",
          "Method described too loosely to repeat.",
          "Repeatable in outline.",
          "Repeatable, with the data source and measures stated.",
          "Repeatable, with the choice of measures justified.",
        ),
      },
      {
        name: "Analysis",
        weight: 25,
        descriptors: levels(
          "No analysis.",
          "Description mistaken for analysis.",
          "Analysis present; limitations unstated.",
          "Analysis with stated limitations.",
          "Analysis, limitations, and an alternative explanation considered.",
        ),
      },
      {
        name: "Communication",
        weight: 20,
        descriptors: levels(
          "Unreadable.",
          "Readable with effort.",
          "Clear.",
          "Clear and well structured.",
          "Clear, well structured, and honest about what is not established.",
        ),
      },
    ],
  },
  {
    key: "minor-project",
    name: "Minor project",
    description: "Coarse and fast, for a short project where four criteria are enough.",
    criteria: [
      {
        name: "Problem and approach",
        weight: 30,
        descriptors: levels("Absent.", "Vague.", "Adequate.", "Clear.", "Clear and justified."),
      },
      {
        name: "Execution",
        weight: 30,
        descriptors: levels(
          "Nothing.",
          "Partial.",
          "Works.",
          "Works well.",
          "Works well and tested.",
        ),
      },
      {
        name: "Results",
        weight: 20,
        descriptors: levels("None.", "Anecdotal.", "Measured.", "Compared.", "Compared honestly."),
      },
      {
        name: "Documentation",
        weight: 20,
        descriptors: levels("Empty.", "Thin.", "Complete.", "Clear.", "Reusable by others."),
      },
    ],
  },
];

export const TEMPLATE_BY_KEY = Object.fromEntries(
  RUBRIC_TEMPLATES.map((template) => [template.key, template]),
) as Record<string, RubricTemplate>;
