import type { $Enums } from "@prisma/client";

/**
 * The roles a person can register as, in the order they are offered.
 *
 * One definition, several consumers: the register chooser, the onboarding
 * wizard, the dashboard router and the settings page all read this. Adding a
 * role means adding it here, not in four places.
 *
 * `PLATFORM_ADMIN` is deliberately absent — it is granted, never chosen.
 */

export type RoleChoice = {
  role: $Enums.Role;
  /** URL segment, so `/register/student` rather than `/register/STUDENT`. */
  slug: string;
  label: string;
  blurb: string;
  glyph: string;
  /** Where this role lands after signing in. */
  home: string;
  /** The onboarding steps, in order. */
  steps: readonly string[];
};

export const ROLE_CHOICES: readonly RoleChoice[] = [
  {
    role: "STUDENT",
    slug: "student",
    label: "Student",
    blurb:
      "Build projects with your team, keep the record, and leave with a portfolio that proves what you did.",
    glyph: "🎓",
    home: "/dashboard",
    steps: ["college", "programme", "interests", "skills"],
  },
  {
    role: "FACULTY",
    slug: "faculty",
    label: "Faculty",
    blurb:
      "Supervise and evaluate work, see which teams are struggling early, and attest to what students actually contributed.",
    glyph: "📐",
    home: "/dashboard",
    steps: ["college", "department", "subjects", "expertise"],
  },
  {
    role: "ALUMNI",
    slug: "alumni",
    label: "Alumni",
    blurb:
      "Keep your project archive, follow your department, and mentor the students coming after you.",
    glyph: "🧭",
    home: "/dashboard",
    steps: ["college", "graduation", "work", "mentorship"],
  },
  {
    role: "COMPANY",
    slug: "company",
    label: "Company",
    blurb: "Find students by the work they have actually shipped, not by the keywords on a CV.",
    glyph: "🏢",
    home: "/dashboard",
    steps: ["organisation", "focus", "verification"],
  },
  {
    role: "RESEARCHER",
    slug: "researcher",
    label: "Researcher",
    blurb: "Collaborate across institutions and find student work worth building on.",
    glyph: "🔬",
    home: "/dashboard",
    steps: ["affiliation", "field", "interests"],
  },
  {
    role: "COLLEGE_ADMIN",
    slug: "college",
    label: "College administrator",
    blurb:
      "Set up your departments, classes and roster, and generate accreditation reports from work already recorded.",
    glyph: "🏛️",
    home: "/dashboard",
    steps: ["college", "domains", "verification"],
  },
] as const;

export const ROLE_BY_SLUG: Record<string, RoleChoice> = Object.fromEntries(
  ROLE_CHOICES.map((choice) => [choice.slug, choice]),
);

export const ROLE_BY_ENUM: Record<string, RoleChoice> = Object.fromEntries(
  ROLE_CHOICES.map((choice) => [choice.role, choice]),
);

/** Human label for any role, including the one that cannot be chosen. */
export const ROLE_LABEL: Record<$Enums.Role, string> = {
  STUDENT: "Student",
  FACULTY: "Faculty",
  COLLEGE_ADMIN: "College administrator",
  ALUMNI: "Alumni",
  COMPANY: "Company",
  RESEARCHER: "Researcher",
  PLATFORM_ADMIN: "Platform administrator",
};
