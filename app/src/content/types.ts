import type { Visibility } from "@/lib/seo/visibility";

/**
 * THE CONTENT CONTRACT.
 *
 * Phase 2 writes the entire public site against these types, as fixtures.
 * **Phase 3's Prisma schema must satisfy them.** That ordering is deliberate
 * (ADR / ARCHITECTURE.md §5): it forces the data model to be shaped by what the
 * product actually renders, rather than by what felt tidy in the abstract.
 *
 * When Phase 3 lands, the page components do not change — only the import does,
 * from `@/content/*` to `@/lib/db/queries/*`.
 *
 * Anything here that Phase 3 cannot represent is a schema bug, not a fixture bug.
 */

/* ------------------------------------------------------------------ shared */

export type Slug = string;

/** Mirrors Phase 3's `ProjectSectionKind` enum. */
export const SECTION_KINDS = [
  "PROBLEM",
  "RESEARCH",
  "SOLUTION",
  "METHODOLOGY",
  "PROTOTYPE",
  "TESTING",
  "RESULTS",
  "CONCLUSION",
  "FUTURE_WORK",
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const SECTION_LABEL: Record<SectionKind, string> = {
  PROBLEM: "Problem statement",
  RESEARCH: "Background research",
  SOLUTION: "Proposed solution",
  METHODOLOGY: "Methodology",
  PROTOTYPE: "Prototype",
  TESTING: "Testing",
  RESULTS: "Results",
  CONCLUSION: "Conclusion",
  FUTURE_WORK: "Future work",
};

/** Mirrors Phase 3's `ProjectStatus` enum. */
export type ProjectStatus =
  "draft" | "proposed" | "approved" | "progress" | "review" | "completed" | "archived";

/** Mirrors Phase 3's `ProofTier` enum. See docs/CONTEXT.md §4. */
export type ProofTier = "self" | "evidenced" | "attested";

/** Mirrors Phase 3's `LineageKind` enum. */
export type LineageKind = "BUILDS_ON" | "EXTENDS" | "REPLICATES" | "FORKS";

export type DomainKey =
  | "ai"
  | "software"
  | "hardware"
  | "healthcare"
  | "education"
  | "sustainability"
  | "social"
  | "research";

/* --------------------------------------------------------------- taxonomy */

export type Topic = {
  slug: Slug;
  name: string;
  domain: DomainKey;
  /** Present on sub-topics; absent on a top-level domain. */
  parent?: Slug;
  /** One sentence, used in listings and meta descriptions. */
  summary: string;
  /**
   * Editorial hub copy. Genuine content, not a generated shell — a thin hub
   * page is the doorway-page pattern the spam policy prohibits.
   */
  intro?: string;
  /** Real questions students ask about this domain. Feeds FAQPage. */
  faqs?: Faq[];
};

export type Sdg = {
  number: number;
  slug: Slug;
  title: string;
  /** What student work in this goal typically looks like. */
  summary: string;
};

/* ---------------------------------------------------------------- college */

export type College = {
  slug: Slug;
  name: string;
  shortName: string;
  code: string;
  city: string;
  state: string;
  website?: string;
  foundingDate?: string;
  description: string;
  /** Unverified colleges are never publicly indexable (Phase 5 gate). */
  verified: boolean;
  departments: string[];
  stats: { students: number; projects: number; faculty: number };
};

/* ----------------------------------------------------------------- person */

export type Person = {
  username: Slug;
  name: string;
  role: "student" | "faculty" | "alumni" | "researcher";
  headline: string;
  bio: string;
  collegeSlug: Slug;
  department: string;
  /** Students only. */
  programme?: string;
  year?: number;
  /** Faculty only. */
  designation?: string;
  expertise?: string[];
  /** Alumni only. */
  graduationYear?: number;
  currentRole?: string;
  organisation?: string;
  skills: { name: string; tier: ProofTier; fromProjects?: number }[];
  interests: string[];
  links?: { label: string; url: string }[];
  achievements?: { title: string; year: number; detail?: string }[];
  /** Drives resolveVisibility. A private profile is noindex and unlisted. */
  visibility: Visibility;
  /** Opt-in, and off by default everywhere (docs/SECURITY.md §7). */
  contactable: boolean;
};

/* ---------------------------------------------------------------- project */

export type ProjectSection = {
  kind: SectionKind;
  /** Markdown-lite: paragraphs separated by a blank line, `-` for list items. */
  body: string;
};

export type ProjectMember = {
  username: Slug;
  /** Their declared role on THIS project, not their platform role. */
  role: string;
  /** How the contribution claim is backed. See docs/CONTEXT.md §4. */
  tier: ProofTier;
  /** Required when tier is "attested" — the name is the whole point. */
  attestedBy?: string;
};

export type Project = {
  slug: Slug;
  title: string;
  /** One line. Used in cards, listings and the meta description. */
  summary: string;
  /** 2-3 sentences. Shown on the page and used as the CreativeWork abstract. */
  abstract: string;
  status: ProjectStatus;
  visibility: Visibility;
  /** ISO date; while in the future the body is withheld but the page is listed. */
  embargoUntil?: string | null;
  /** Faculty approved publication. False keeps it out of the sitemap. */
  approved: boolean;

  collegeSlug: Slug;
  department: string;
  subject?: string;
  term: string;

  domain: DomainKey;
  topics: Slug[];
  sdgs: number[];
  techStack: string[];
  keywords: string[];

  members: ProjectMember[];
  facultyGuide?: string;

  sections: ProjectSection[];

  startedOn: string;
  completedOn?: string;
  publishedOn?: string;

  /** Assigned once at archive time, immutable, printable. */
  citationId?: string;
  repositoryUrl?: string;
  demoUrl?: string;

  /** Recorded lineage. A project may build on more than one predecessor. */
  buildsOn?: { slug: Slug; kind: LineageKind; note: string }[];

  metrics?: { label: string; value: string }[];
};

/* ------------------------------------------------------------------- idea */

export type IdeaStatus = "IDEA" | "LOOKING_FOR_TEAM" | "IN_DEVELOPMENT" | "TESTING" | "COMPLETED";

export type Idea = {
  slug: Slug;
  title: string;
  summary: string;
  problem: string;
  approach: string;
  status: IdeaStatus;
  domain: DomainKey;
  topics: Slug[];
  sdgs: number[];
  skillsNeeded: string[];
  teamSizeWanted: number;
  commitment: "light" | "moderate" | "intensive";
  postedBy: Slug;
  collegeSlug: Slug;
  postedOn: string;
  interestedCount: number;
  /** Set once the idea became a project — the hub shows outcomes, not intentions. */
  becameProject?: Slug;
};

/* -------------------------------------------------------------- knowledge */

export type Article = {
  slug: Slug;
  title: string;
  description: string;
  /** Editorial grouping, also the `articleSection`. */
  section: string;
  author: string;
  publishedOn: string;
  updatedOn?: string;
  readingMinutes: number;
  keywords: string[];
  /** Markdown-lite, same conventions as ProjectSection.body. */
  body: string;
  related?: Slug[];
};

/* ------------------------------------------------------------ opportunity */

export type Opportunity = {
  slug: Slug;
  title: string;
  summary: string;
  description: string;
  type: "internship" | "job" | "research" | "hackathon";
  employmentType: "INTERN" | "FULL_TIME" | "PART_TIME" | "CONTRACTOR" | "TEMPORARY";
  organisation: { name: string; website?: string; verified: boolean };
  location?: { city: string; state: string };
  remote: boolean;
  postedOn: string;
  validThrough: string;
  openings: number;
  stipend?: { min: number; max: number; unit: "MONTH" | "YEAR"; currency: string };
  skills: string[];
  eligibility: string;
  responsibilities: string[];
};

/* ------------------------------------------------------------------- misc */

export type Faq = { question: string; answer: string };

export type HelpArticle = {
  slug: Slug;
  title: string;
  description: string;
  audience: "student" | "faculty" | "admin" | "everyone";
  body: string;
};

export type ChangelogEntry = {
  date: string;
  version: string;
  title: string;
  items: { kind: "added" | "changed" | "fixed"; text: string }[];
};

export type LegalDocument = {
  slug: Slug;
  title: string;
  description: string;
  updatedOn: string;
  /** Plain-language summary shown before the formal text. */
  summary: string;
  body: string;
};
