import type { $Enums } from "@prisma/client";

/**
 * SKILLS FROM EVIDENCE, NOT FROM CLAIMS.
 *
 * A self-declared skill list is a CV, and everybody's CV says React. A skill
 * that says "React — from 3 projects" with those projects named is evidence,
 * and it is the single thing that makes a Nexivora profile worth more than a
 * LinkedIn one.
 *
 * So this module derives skills from what somebody actually built:
 *
 *   · the **tech stack** of their projects — the strongest signal, because a
 *     project's stack is agreed by the whole team and reviewed by a supervisor;
 *   · the **domain**, which implies working knowledge of its problems;
 *   · their **declared role** on the project, which is what distinguishes the
 *     person who did the firmware from the person who wrote the report;
 *   · **tasks they closed**, which is the ledger's evidence rather than the
 *     team's.
 *
 * Pure functions, no database. That is deliberate: the inference is a heuristic,
 * and a heuristic nobody can test against known inputs is an opinion. The
 * caller loads the projects; this decides what they mean.
 *
 * **Recomputed on project state change, never on render** (see the note in
 * `docs/phases/phase-06`): it is join-heavy and would land squarely on the
 * profile page's LCP.
 */

export type ProjectEvidence = {
  slug: string;
  title: string;
  status: string;
  /** The stack as recorded on the project. */
  techStack: readonly string[];
  domain: string;
  topics: readonly string[];
  /** This person's declared role on this project. */
  role: string;
  /** Titles of tasks this person closed, from the contribution ledger. */
  closedTasks?: readonly string[];
};

export type InferredSkill = {
  name: string;
  slug: string;
  /** Projects that produced it, most recent first. */
  projectSlugs: string[];
  projectTitles: string[];
  /**
   * 1–4. Deliberately coarse: this is "how much evidence is there", not a
   * proficiency rating. Claiming to measure someone's ability from three
   * project rows would be dishonest, and the number would be believed.
   */
  strength: 1 | 2 | 3 | 4;
  /** Why it was inferred, in the person's own project terms. */
  reason: string;
};

export const skillSlug = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Role phrases that imply a skill.
 *
 * Kept small and specific on purpose. A long list of fuzzy mappings produces
 * profiles full of skills nobody would claim, and the moment one obviously
 * wrong entry appears the whole section stops being believed.
 */
const ROLE_SKILLS: ReadonlyArray<{ match: RegExp; skills: readonly string[] }> = [
  { match: /\bfirmware|embedded|microcontroller\b/i, skills: ["Embedded systems"] },
  { match: /\bpcb|circuit|hardware|enclosure\b/i, skills: ["Hardware design"] },
  { match: /\bcalibrat/i, skills: ["Sensor calibration"] },
  { match: /\bfront.?end|interface|ui\b/i, skills: ["Front-end development"] },
  { match: /\bback.?end|api|server\b/i, skills: ["Back-end development"] },
  { match: /\bdata (platform|pipeline|engineering)\b/i, skills: ["Data engineering"] },
  { match: /\b(model|ml|machine learning|training)\b/i, skills: ["Machine learning"] },
  { match: /\banalysis|analytics|statistic/i, skills: ["Data analysis"] },
  { match: /\bfield (test|study|work)|deployment\b/i, skills: ["Field testing"] },
  { match: /\bwrite.?up|report|documentation\b/i, skills: ["Technical writing"] },
  { match: /\blead\b/i, skills: ["Project leadership"] },
];

/** Domains that imply a working familiarity worth naming. */
const DOMAIN_SKILLS: Record<string, string> = {
  ai: "Applied machine learning",
  software: "Software engineering",
  hardware: "Hardware & IoT",
  healthcare: "Health technology",
  education: "Education technology",
  sustainability: "Sustainability engineering",
  social: "Civic technology",
  research: "Research methods",
};

/**
 * Stack entries that are not skills.
 *
 * "SQLite" and "JSON" say nothing about a person. Including them inflates the
 * list with noise, and a skill section that lists twenty things communicates
 * less than one that lists six.
 */
const STACK_NOISE: ReadonlySet<string> = new Set([
  "json",
  "csv",
  "xml",
  "yaml",
  "http",
  "https",
  "rest",
  "markdown",
  "git",
  "github",
  "vscode",
  "excel",
  "word",
  "powerpoint",
  "windows",
  "macos",
  "linux",
]);

function strengthFor(projectCount: number, hasClosedTasks: boolean): 1 | 2 | 3 | 4 {
  if (projectCount >= 3) return 4;
  if (projectCount === 2) return hasClosedTasks ? 4 : 3;
  return hasClosedTasks ? 2 : 1;
}

/**
 * Infer a person's skills from their projects.
 *
 * Only projects that reached a real state count. A draft proves nothing — and
 * counting one would let anybody manufacture a skill by creating an empty
 * project, which is exactly the inflation the three-tier proof model exists to
 * prevent.
 */
export function inferSkills(projects: readonly ProjectEvidence[]): InferredSkill[] {
  const countsAsEvidence = (status: string) =>
    status === "IN_PROGRESS" ||
    status === "UNDER_REVIEW" ||
    status === "COMPLETED" ||
    status === "ARCHIVED";

  const evidence = projects.filter((project) => countsAsEvidence(project.status));

  type Accumulator = {
    name: string;
    projects: Map<string, string>;
    fromStack: boolean;
    fromRole: boolean;
    fromDomain: boolean;
    closedTasks: number;
  };

  const bySlug = new Map<string, Accumulator>();

  const add = (name: string, project: ProjectEvidence, origin: "stack" | "role" | "domain") => {
    const slug = skillSlug(name);
    if (!slug) return;

    const existing = bySlug.get(slug) ?? {
      name,
      projects: new Map<string, string>(),
      fromStack: false,
      fromRole: false,
      fromDomain: false,
      closedTasks: 0,
    };

    existing.projects.set(project.slug, project.title);
    if (origin === "stack") existing.fromStack = true;
    if (origin === "role") existing.fromRole = true;
    if (origin === "domain") existing.fromDomain = true;
    existing.closedTasks += project.closedTasks?.length ?? 0;

    bySlug.set(slug, existing);
  };

  for (const project of evidence) {
    for (const entry of project.techStack) {
      const name = entry.trim();
      if (!name || STACK_NOISE.has(name.toLowerCase())) continue;
      add(name, project, "stack");
    }

    for (const rule of ROLE_SKILLS) {
      if (!rule.match.test(project.role)) continue;
      for (const name of rule.skills) add(name, project, "role");
    }

    const domainSkill = DOMAIN_SKILLS[project.domain];
    if (domainSkill) add(domainSkill, project, "domain");
  }

  return (
    [...bySlug.entries()]
      .map(([slug, item]) => {
        const projectSlugs = [...item.projects.keys()];
        const projectTitles = [...item.projects.values()];
        const count = projectSlugs.length;

        return {
          name: item.name,
          slug,
          projectSlugs,
          projectTitles,
          strength: strengthFor(count, item.closedTasks > 0),
          reason: describe(count, item),
        } satisfies InferredSkill;
      })
      // Most evidence first, then alphabetically so the order is stable across
      // renders — a list that reshuffles looks broken even when it is correct.
      .sort((a, b) => b.projectSlugs.length - a.projectSlugs.length || a.name.localeCompare(b.name))
  );
}

function describe(
  count: number,
  item: { fromStack: boolean; fromRole: boolean; closedTasks: number },
): string {
  const projects = `${count} project${count === 1 ? "" : "s"}`;

  if (item.fromRole && item.closedTasks > 0) {
    return `Your role on ${projects}, and ${item.closedTasks} task${item.closedTasks === 1 ? "" : "s"} you closed`;
  }
  if (item.fromRole) return `Your role on ${projects}`;
  if (item.fromStack) return `Used on ${projects}`;

  return `From the domain of ${projects}`;
}

/**
 * Merge inferred skills with what somebody claimed about themselves.
 *
 * A claim that the projects corroborate is **promoted** to inferred rather than
 * kept as a claim — the evidence is the interesting part, and showing it twice
 * would be worse than showing it once. A claim with no evidence survives,
 * clearly marked, because it is still information; it is just information of a
 * different kind, and the interface must never present the two identically.
 */
export type MergedSkill = {
  name: string;
  slug: string;
  source: $Enums.SkillSource;
  projectSlugs: string[];
  projectTitles: string[];
  strength: 1 | 2 | 3 | 4;
  reason: string;
};

export function mergeSkills(
  declared: ReadonlyArray<{ name: string; slug: string; source: $Enums.SkillSource }>,
  inferred: readonly InferredSkill[],
): MergedSkill[] {
  const inferredBySlug = new Map(inferred.map((skill) => [skill.slug, skill]));
  const merged: MergedSkill[] = [];
  const seen = new Set<string>();

  for (const skill of declared) {
    const evidence = inferredBySlug.get(skill.slug);
    seen.add(skill.slug);

    // An attestation outranks everything: a named human signed it, and that is
    // the strongest claim available (docs/CONTEXT.md §4).
    if (skill.source === "ATTESTED") {
      merged.push({
        name: skill.name,
        slug: skill.slug,
        source: "ATTESTED",
        projectSlugs: evidence?.projectSlugs ?? [],
        projectTitles: evidence?.projectTitles ?? [],
        strength: 4,
        reason: "Attested by a faculty member",
      });
      continue;
    }

    if (evidence) {
      merged.push({
        name: evidence.name,
        slug: evidence.slug,
        source: "PROJECT_INFERRED",
        projectSlugs: evidence.projectSlugs,
        projectTitles: evidence.projectTitles,
        strength: evidence.strength,
        reason: evidence.reason,
      });
      continue;
    }

    merged.push({
      name: skill.name,
      slug: skill.slug,
      source: "SELF",
      projectSlugs: [],
      projectTitles: [],
      strength: 1,
      reason: "Self-declared — no project evidence yet",
    });
  }

  for (const skill of inferred) {
    if (seen.has(skill.slug)) continue;

    merged.push({
      name: skill.name,
      slug: skill.slug,
      source: "PROJECT_INFERRED",
      projectSlugs: skill.projectSlugs,
      projectTitles: skill.projectTitles,
      strength: skill.strength,
      reason: skill.reason,
    });
  }

  // Evidenced first, then attested weight, then alphabetical. Self-declared
  // sinks — deliberately, so the credible half of the list is what a reader
  // meets first.
  const rank: Record<$Enums.SkillSource, number> = {
    ATTESTED: 0,
    PROJECT_INFERRED: 1,
    SELF: 2,
  };

  return merged.sort(
    (a, b) =>
      rank[a.source] - rank[b.source] ||
      b.projectSlugs.length - a.projectSlugs.length ||
      a.name.localeCompare(b.name),
  );
}
