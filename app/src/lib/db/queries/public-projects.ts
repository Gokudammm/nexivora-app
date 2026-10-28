import { cache } from "react";

import { lineageOf, descendantsOf, relatedTo, yearsIn, techStackIn } from "@/content/derive";
import type { Project as ContentProject, DomainKey, ProofTier, SectionKind } from "@/content/types";
import { ANONYMOUS } from "@/lib/authz/viewer";
import { db } from "@/lib/db/client";

import { visibleTo } from "./projects";

/**
 * THE PUBLIC PROJECT CORPUS, FROM THE DATABASE.
 *
 * The swap ADR-030 assigns to this phase: projects are created here, so this is
 * where the public pages stop reading `src/content/` and start reading rows.
 *
 * Two rules make it a swap rather than a rewrite.
 *
 * **The signatures are identical to `content/index.ts`.** A page changes one
 * import line and nothing else — which is what makes "no rendered page changed"
 * checkable rather than hoped for (ADR-032). `check:seo` crawls all 127 URLs
 * and asserted the whole contract before and after.
 *
 * **The derived views are not reimplemented.** Lineage, related work and the
 * facets come from `content/derive.ts`, the same pure functions the fixtures
 * use. A database version of "related projects" is how two implementations end
 * up disagreeing about what related means.
 *
 * `visibleTo(ANONYMOUS)` is the predicate, not a hand-written `visibility:
 * PUBLIC` — composing the one that already exists is what keeps a private
 * project out of the sitemap when somebody later adds a visibility level.
 */

const publicSelect = {
  slug: true,
  title: true,
  summary: true,
  abstract: true,
  status: true,
  visibility: true,
  approved: true,
  embargoUntil: true,
  domain: true,
  department: true,
  subject: true,
  techStack: true,
  keywords: true,
  facultyGuide: true,
  citationId: true,
  repositoryUrl: true,
  demoUrl: true,
  startedOn: true,
  completedOn: true,
  publishedOn: true,
  coverUrl: true,
  college: { select: { slug: true } },
  term: { select: { name: true } },
  topics: { select: { topic: { select: { slug: true } } } },
  sdgs: { select: { goal: true } },
  members: {
    select: {
      role: true,
      tier: true,
      user: { select: { username: true } },
    },
  },
  sections: { select: { kind: true, body: true, complete: true } },
  parentLinks: { select: { kind: true, note: true, parent: { select: { slug: true } } } },
} as const;

const STATUS_FROM_DB: Record<string, ContentProject["status"]> = {
  DRAFT: "draft",
  PROPOSED: "proposed",
  APPROVED: "approved",
  IN_PROGRESS: "progress",
  UNDER_REVIEW: "review",
  COMPLETED: "completed",
  ARCHIVED: "archived",
  REJECTED: "draft",
  ABANDONED: "archived",
};

const TIER_FROM_DB: Record<string, ProofTier> = {
  SELF: "self",
  WORKSPACE_EVIDENCED: "evidenced",
  FACULTY_ATTESTED: "attested",
};

const iso = (date: Date | null | undefined) => (date ? date.toISOString().slice(0, 10) : undefined);

/**
 * A row as the Phase 2 components already speak.
 *
 * Fuller than `toContentProjectCard()`, which drops sections and the abstract
 * because a listing does not read them. This one is for the project page, where
 * they are the content.
 *
 * **Incomplete sections are omitted, not rendered empty.** A public page with
 * an empty "Testing" heading looks broken; a page without the heading looks
 * like a project that has not written it yet, which is the truth.
 */
function toContentProject(row: Awaited<ReturnType<typeof loadPublic>>[number]): ContentProject {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    abstract: row.abstract,
    status: STATUS_FROM_DB[row.status] ?? "draft",
    visibility: row.visibility,
    embargoUntil: iso(row.embargoUntil) ?? null,
    approved: row.approved,

    collegeSlug: row.college.slug,
    department: row.department,
    subject: row.subject ?? undefined,
    term: row.term?.name ?? "",

    domain: row.domain as DomainKey,
    topics: row.topics.map((entry) => entry.topic.slug),
    sdgs: row.sdgs.map((entry) => entry.goal),
    techStack: row.techStack,
    keywords: row.keywords,

    members: row.members
      .filter((member) => member.user.username)
      .map((member) => ({
        username: member.user.username!,
        role: member.role,
        tier: TIER_FROM_DB[member.tier] ?? "self",
      })),
    facultyGuide: row.facultyGuide ?? undefined,

    sections: row.sections
      .filter((section) => section.complete && section.body.trim().length > 0)
      .map((section) => ({ kind: section.kind as SectionKind, body: section.body })),

    startedOn: row.startedOn.toISOString().slice(0, 10),
    completedOn: iso(row.completedOn),
    publishedOn: iso(row.publishedOn),

    citationId: row.citationId ?? undefined,
    repositoryUrl: row.repositoryUrl ?? undefined,
    demoUrl: row.demoUrl ?? undefined,

    buildsOn: row.parentLinks.map((link) => ({
      slug: link.parent.slug,
      kind: link.kind,
      note: link.note,
    })),
  };
}

function loadPublic() {
  return db.project.findMany({
    where: visibleTo(ANONYMOUS),
    select: publicSelect,
    orderBy: [{ publishedOn: "desc" }, { startedOn: "desc" }],
  });
}

/**
 * The corpus, once per request.
 *
 * `cache()` is doing real work here rather than being decoration: a project
 * page reads the corpus for the project itself, again for its lineage, again
 * for related work and again for the descendant count. Four identical queries
 * per render is the shape that makes a page mysteriously slow, and the
 * alternative — threading the array through every helper — would change the
 * signatures the swap exists to preserve.
 */
export const publicProjectCorpus = cache(async (): Promise<ContentProject[]> => {
  const rows = await loadPublic();
  return rows.map(toContentProject);
});

/* --------------------------------------- the content/index.ts signatures */

export async function publicProjects(): Promise<ContentProject[]> {
  return publicProjectCorpus();
}

export async function publicProject(slug: string): Promise<ContentProject | null> {
  const corpus = await publicProjectCorpus();
  return corpus.find((project) => project.slug === slug) ?? null;
}

export async function projectsByTopic(topicSlug: string): Promise<ContentProject[]> {
  const corpus = await publicProjectCorpus();
  return corpus.filter((project) => project.topics.includes(topicSlug));
}

export async function projectsBySdg(goal: number): Promise<ContentProject[]> {
  const corpus = await publicProjectCorpus();
  return corpus.filter((project) => project.sdgs.includes(goal));
}

export async function projectsByCollege(collegeSlug: string): Promise<ContentProject[]> {
  const corpus = await publicProjectCorpus();
  return corpus.filter((project) => project.collegeSlug === collegeSlug);
}

export async function projectsByPerson(username: string): Promise<ContentProject[]> {
  const corpus = await publicProjectCorpus();
  return corpus.filter((project) => project.members.some((member) => member.username === username));
}

export async function publicLineage(project: ContentProject) {
  return lineageOf(project, await publicProjectCorpus());
}

export async function descendantCount(slug: string): Promise<number> {
  return descendantsOf(slug, await publicProjectCorpus());
}

export async function relatedProjects(project: ContentProject, limit = 3) {
  return relatedTo(project, await publicProjectCorpus(), limit);
}

export async function projectYears(): Promise<number[]> {
  return yearsIn(await publicProjectCorpus());
}

export async function projectTechStack(): Promise<string[]> {
  return techStackIn(await publicProjectCorpus());
}
