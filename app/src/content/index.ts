import { colleges, collegeBySlug } from "@/content/colleges";
import { descendantsOf, lineageOf, relatedTo, techStackIn, yearsIn } from "@/content/derive";
import { ideas } from "@/content/ideas";
import { articles } from "@/content/knowledge";
import { people, personByUsername } from "@/content/people";
import { projects } from "@/content/projects";
import type { Project } from "@/content/types";
import { resolveVisibility, type ResolvedVisibility } from "@/lib/seo/visibility";

/**
 * The public view of the content set.
 *
 * **Every public page reads from here, never from the raw fixture arrays.**
 * That is the same discipline the Phase 3 query layer will enforce: the
 * visibility predicate lives in one place, so a page cannot forget it.
 *
 * When Phase 3 lands, these functions keep their signatures and their bodies
 * become database queries. The pages do not change.
 */

/** Resolves a project's visibility, folding in its college's verification. */
export function projectVisibility(project: Project, now = new Date()): ResolvedVisibility {
  return resolveVisibility(
    {
      visibility: project.visibility,
      embargoUntil: project.embargoUntil,
      collegeVerified: collegeBySlug[project.collegeSlug]?.verified ?? false,
      approved: project.approved,
    },
    now,
  );
}

/** Projects a logged-out visitor may see. The single source for every listing. */
export function publicProjects(now = new Date()): Project[] {
  return projects
    .filter((project) => projectVisibility(project, now).publiclyReadable)
    .sort((a, b) => (b.publishedOn ?? b.startedOn).localeCompare(a.publishedOn ?? a.startedOn));
}

/** A single public project, or null. Null rather than 403 — see ARCHITECTURE.md §2. */
export function publicProject(slug: string, now = new Date()): Project | null {
  const project = projects.find((p) => p.slug === slug);
  if (!project) return null;
  return projectVisibility(project, now).publiclyReadable ? project : null;
}

/** Public profiles only. A private profile must not appear in any listing. */
export function publicPeopleList() {
  return people.filter((person) => {
    if (person.visibility !== "PUBLIC") return false;
    return collegeBySlug[person.collegeSlug]?.verified ?? false;
  });
}

export function publicPerson(username: string) {
  const person = personByUsername[username];
  if (!person || person.visibility !== "PUBLIC") return null;
  if (!collegeBySlug[person.collegeSlug]?.verified) return null;
  return person;
}

/** Verified colleges only. */
export function publicCollegeList() {
  return colleges.filter((c) => c.verified);
}

export function publicCollege(slug: string) {
  const college = collegeBySlug[slug];
  return college?.verified ? college : null;
}

/** Ideas from verified colleges. */
export function publicIdeas() {
  return ideas
    .filter((idea) => collegeBySlug[idea.collegeSlug]?.verified)
    .sort((a, b) => b.postedOn.localeCompare(a.postedOn));
}

export function publicIdea(slug: string) {
  const idea = ideas.find((i) => i.slug === slug);
  if (!idea) return null;
  return collegeBySlug[idea.collegeSlug]?.verified ? idea : null;
}

export function publicArticles() {
  return [...articles].sort((a, b) => b.publishedOn.localeCompare(a.publishedOn));
}

/* ------------------------------------------------------------- derivations */

export function projectsByTopic(topicSlug: string, now = new Date()): Project[] {
  return publicProjects(now).filter((p) => p.topics.includes(topicSlug));
}

export function projectsBySdg(goal: number, now = new Date()): Project[] {
  return publicProjects(now).filter((p) => p.sdgs.includes(goal));
}

export function projectsByCollege(collegeSlug: string, now = new Date()): Project[] {
  return publicProjects(now).filter((p) => p.collegeSlug === collegeSlug);
}

export function projectsByPerson(username: string, now = new Date()): Project[] {
  return publicProjects(now).filter((p) => p.members.some((m) => m.username === username));
}

export function ideasByPerson(username: string) {
  return publicIdeas().filter((idea) => idea.postedBy === username);
}

/**
 * The derived views, over the fixture corpus.
 *
 * The logic lives in `content/derive.ts` and is shared with
 * `queries/public-projects.ts`, which calls the same functions with rows
 * adapted to the same shape. One implementation, two sources.
 */
export function publicLineage(project: Project, now = new Date()) {
  return lineageOf(project, publicProjects(now));
}

/** Descendant count, for the "N groups have built on this" signal. */
export function descendantCount(slug: string, now = new Date()): number {
  return descendantsOf(slug, publicProjects(now));
}

/** Related projects — shared topics and SDGs, excluding the project's own lineage. */
export function relatedProjects(project: Project, limit = 3, now = new Date()): Project[] {
  return relatedTo(project, publicProjects(now), limit);
}

/** Every year that has a public project, newest first — an explore facet. */
export function projectYears(now = new Date()): number[] {
  return yearsIn(publicProjects(now));
}

/** Distinct tech stack entries across public projects — an explore facet. */
export function projectTechStack(now = new Date()): string[] {
  return techStackIn(publicProjects(now));
}
