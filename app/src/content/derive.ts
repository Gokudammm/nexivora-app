import type { LineageKind, Project } from "@/content/types";

/**
 * DERIVED PROJECT VIEWS — pure, over a corpus you supply.
 *
 * Lineage, related work, the explore facets. Every one of these was written in
 * Phase 2 as a function that internally called `publicProjects()`, which was
 * exactly right while the fixtures were the only source.
 *
 * Phase 8 gives them a second source — the database — and the tempting move is
 * to write a database version of each. That is how two implementations of
 * "related projects" end up disagreeing about what related means.
 *
 * So the logic moved here and takes its corpus as a parameter. `content/index.ts`
 * calls these with the fixtures; `queries/public-projects.ts` calls them with
 * rows adapted to the same `Project` shape. **One implementation, two sources**,
 * and `src/content/types.ts` stays the contract in both directions.
 */

export type LineageLink = { project: Project; kind: LineageKind; note: string };

/**
 * A project's readable parents and children.
 *
 * A private parent is **omitted, not shown as a broken link**. The lineage is
 * real, but a visitor has no business learning that a private project exists —
 * and a greyed-out "restricted" entry would tell them precisely that.
 */
export function lineageOf(
  project: Project,
  corpus: readonly Project[],
): { parents: LineageLink[]; children: LineageLink[] } {
  const bySlug = new Map(corpus.map((entry) => [entry.slug, entry]));

  const parents = (project.buildsOn ?? [])
    .map((link) => {
      const parent = bySlug.get(link.slug);
      return parent ? { project: parent, kind: link.kind, note: link.note } : null;
    })
    .filter((entry): entry is LineageLink => entry !== null);

  const children = corpus
    .filter((candidate) => candidate.buildsOn?.some((link) => link.slug === project.slug))
    .map((child) => {
      const link = child.buildsOn!.find((entry) => entry.slug === project.slug)!;
      return { project: child, kind: link.kind, note: link.note };
    });

  return { parents, children };
}

/**
 * How many projects descend from this one, transitively.
 *
 * The "N groups have built on this" signal. `seen` guards against a cycle: the
 * data model does not forbid one, and an unguarded recursion would hang the
 * request rather than render a wrong number.
 */
export function descendantsOf(
  slug: string,
  corpus: readonly Project[],
  seen = new Set<string>(),
): number {
  if (seen.has(slug)) return 0;
  seen.add(slug);

  return corpus
    .filter((project) => project.buildsOn?.some((link) => link.slug === slug))
    .reduce((total, child) => total + 1 + descendantsOf(child.slug, corpus, seen), 0);
}

/**
 * Related projects — shared topics and SDGs, excluding the project itself and
 * anything already in its lineage.
 *
 * Deterministic and explainable, which is why the tie-break is on slug rather
 * than left to the sort's stability: a "related" list that reshuffles between
 * two renders of the same page looks broken even when both orders are correct.
 *
 * Phase 11 replaces the scoring with trigram similarity over the real corpus.
 * The signature stays.
 */
export function relatedTo(project: Project, corpus: readonly Project[], limit = 3): Project[] {
  const lineage = lineageOf(project, corpus);
  const exclude = new Set([
    project.slug,
    ...(project.buildsOn ?? []).map((link) => link.slug),
    ...lineage.children.map((child) => child.project.slug),
  ]);

  return corpus
    .filter((candidate) => !exclude.has(candidate.slug))
    .map((candidate) => ({
      candidate,
      score:
        candidate.topics.filter((topic) => project.topics.includes(topic)).length * 3 +
        candidate.sdgs.filter((goal) => project.sdgs.includes(goal)).length * 2 +
        (candidate.domain === project.domain ? 1 : 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.slug.localeCompare(b.candidate.slug))
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

/** Every year that has a project, newest first — an explore facet. */
export function yearsIn(corpus: readonly Project[]): number[] {
  const years = new Set(
    corpus.map((project) => new Date(project.publishedOn ?? project.startedOn).getFullYear()),
  );

  return [...years].sort((a, b) => b - a);
}

/** Distinct tech stack entries across a corpus — an explore facet. */
export function techStackIn(corpus: readonly Project[]): string[] {
  return [...new Set(corpus.flatMap((project) => project.techStack))].sort((a, b) =>
    a.localeCompare(b),
  );
}
