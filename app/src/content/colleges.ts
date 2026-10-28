import type { College } from "@/content/types";

/**
 * Demo colleges.
 *
 * Three, deliberately: one primary institution that most fixtures belong to,
 * one partner for the Phase 14 inter-college work, and **one unverified**, so
 * the verification gate has something real to exclude. An unverified college's
 * content is never publicly indexable (docs/SECURITY.md §8), and
 * `scripts/check-seo.mjs` asserts it stays out of the sitemap.
 *
 * These are fictional institutions. Using a real college's name and statistics
 * without permission would be a misrepresentation, and the demo does not need it.
 */
export const colleges: College[] = [
  {
    slug: "nexivora-institute-of-technology",
    name: "Nexivora Institute of Technology",
    shortName: "NIT Pune",
    code: "NITP",
    city: "Pune",
    state: "Maharashtra",
    website: "https://example.edu/nit-pune",
    foundingDate: "1998",
    description:
      "A fictional engineering institute used as the primary demo college. Four departments, roughly 3,200 students, with project-based learning across every programme.",
    verified: true,
    departments: [
      "Computer Science & Engineering",
      "Electronics & Communication",
      "Mechanical Engineering",
      "Biotechnology",
    ],
    stats: { students: 3200, projects: 412, faculty: 148 },
  },
  {
    slug: "meridian-college-of-engineering",
    name: "Meridian College of Engineering",
    shortName: "Meridian",
    code: "MCE",
    city: "Bengaluru",
    state: "Karnataka",
    foundingDate: "2004",
    description:
      "A fictional partner institution, used to demonstrate cross-college collaboration and the guest-access model without relaxing college isolation.",
    verified: true,
    departments: ["Computer Science & Engineering", "Information Science", "Civil Engineering"],
    stats: { students: 2100, projects: 187, faculty: 96 },
  },
  {
    slug: "greenfield-institute",
    name: "Greenfield Institute of Science",
    shortName: "Greenfield",
    code: "GIS",
    city: "Indore",
    state: "Madhya Pradesh",
    description:
      "A fictional institution that has registered but not yet completed verification. Its content is intentionally excluded from every public surface — this is the anti-abuse gate working.",
    verified: false,
    departments: ["Applied Sciences", "Computer Applications"],
    stats: { students: 900, projects: 12, faculty: 41 },
  },
];

export const collegeBySlug = Object.fromEntries(colleges.map((c) => [c.slug, c])) as Record<
  string,
  College
>;

/** Only verified colleges appear on any public surface. */
export const publicColleges = colleges.filter((c) => c.verified);
