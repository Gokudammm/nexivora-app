import type { Project as ContentProject, ProjectStatus, ProofTier } from "@/content/types";

import type { ProjectCard } from "./projects";

/**
 * ADAPTERS: database rows into the shapes the Phase 2 components already speak.
 *
 * The alternative was rewriting `ProjectCard`, `ProjectRow` and everything else
 * to take a Prisma payload. That would mean changing the components and the
 * data source in the same commit, which is exactly the change you cannot review
 * — if a page renders differently afterwards, nothing tells you which half did
 * it.
 *
 * With an adapter, the swap is one import per page and the components are
 * provably untouched. `src/content/types.ts` stays what it has been since Phase
 * 2: the contract. It is now the contract in both directions — fixtures satisfy
 * it, and so does the database.
 *
 * These are deliberately lossy in one direction only: the content types carry
 * exactly what the public site renders, so anything the database knows and the
 * page does not need is dropped here rather than threaded through.
 */

const STATUS_FROM_DB: Record<string, ProjectStatus> = {
  DRAFT: "draft",
  PROPOSED: "proposed",
  APPROVED: "approved",
  IN_PROGRESS: "progress",
  UNDER_REVIEW: "review",
  COMPLETED: "completed",
  ARCHIVED: "archived",
  // Neither appears on a public surface; mapping them to `draft` keeps the type
  // total rather than letting an unmapped value reach a component as undefined.
  REJECTED: "draft",
  ABANDONED: "archived",
};

const TIER_FROM_DB: Record<string, ProofTier> = {
  SELF: "self",
  WORKSPACE_EVIDENCED: "evidenced",
  FACULTY_ATTESTED: "attested",
};

/**
 * A database project card as the Phase 2 components expect it.
 *
 * Fields the card does not read are filled with safe defaults rather than
 * queried: widening the select to satisfy a type would make every listing pay
 * for data no pixel depends on.
 */
export function toContentProjectCard(
  row: ProjectCard & { term?: { name: string } | null; department?: string | null },
): ContentProject {
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    abstract: "",
    status: STATUS_FROM_DB[row.status] ?? "draft",
    visibility: row.visibility,
    approved: true,

    collegeSlug: row.college.slug,
    department: row.department ?? "",
    term: row.term?.name ?? "",

    domain: row.domain as ContentProject["domain"],
    topics: row.topics.map((entry) => entry.topic.slug),
    sdgs: row.sdgs.map((entry) => entry.goal),
    techStack: row.techStack,
    keywords: [],

    members: row.members.map((member) => ({
      username: member.user.username,
      role: member.role,
      tier: TIER_FROM_DB[member.tier] ?? "self",
    })),

    sections: [],

    startedOn: row.startedOn.toISOString().slice(0, 10),
    completedOn: row.completedOn?.toISOString().slice(0, 10),
    publishedOn: row.publishedOn?.toISOString().slice(0, 10),
  };
}
