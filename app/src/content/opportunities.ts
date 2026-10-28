import type { Opportunity } from "@/content/types";

/**
 * Opportunity listings.
 *
 * `JobPosting` is the highest-value structured-data type available to this
 * product — it makes a listing eligible for Google's job experience, which is a
 * real, nameable distribution advantage. So every field the schema supports is
 * populated here, and `validThrough` is accurate (an expired posting still in
 * the index is a quality problem Google notices).
 *
 * All organisations are fictional. One is deliberately **unverified**: an
 * unverified company cannot post, cannot contact a student, and does not appear
 * in search (docs/SECURITY.md §8). Fake internship listings that charge a
 * "certificate fee" are a real and widespread scam targeting exactly these
 * students, so this gate is not a formality.
 */
export const opportunities: Opportunity[] = [
  {
    slug: "ml-engineering-intern-hydrosense",
    title: "ML Engineering Intern",
    summary: "Six-month internship on time-series forecasting for agricultural water systems.",
    description:
      "You will work on demand forecasting for irrigation networks: cleaning sensor data that is often gappy, building and evaluating models, and — the part most interns are surprised by — going to the field to understand why a sensor reads what it reads. We want someone who is suspicious of a good validation score.",
    type: "internship",
    employmentType: "INTERN",
    organisation: {
      name: "HydroSense Systems",
      website: "https://example.com/hydrosense",
      verified: true,
    },
    location: { city: "Pune", state: "Maharashtra" },
    remote: false,
    postedOn: "2026-08-20",
    validThrough: "2026-11-30",
    openings: 3,
    stipend: { min: 25000, max: 35000, unit: "MONTH", currency: "INR" },
    skills: ["Python", "Time-series forecasting", "Pandas", "PyTorch or TensorFlow"],
    eligibility: "Third or final-year undergraduate in any engineering discipline.",
    responsibilities: [
      "Clean and validate sensor time-series from field deployments",
      "Build and evaluate forecasting models with honest held-out testing",
      "Visit deployment sites to understand data quality at source",
      "Document methods so the next person can reproduce them",
    ],
  },
  {
    slug: "embedded-systems-intern-terravolt",
    title: "Embedded Systems Intern, Energy Storage",
    summary: "Firmware and instrumentation for battery management, on real hardware from week one.",
    description:
      "Firmware for battery management systems: cell balancing, state-of-charge estimation and the test instrumentation around them. You will have hardware on your desk in the first week and you will break some of it, which is expected.",
    type: "internship",
    employmentType: "INTERN",
    organisation: {
      name: "TerraVolt Energy",
      website: "https://example.com/terravolt",
      verified: true,
    },
    location: { city: "Bengaluru", state: "Karnataka" },
    remote: false,
    postedOn: "2026-08-12",
    validThrough: "2026-10-31",
    openings: 2,
    stipend: { min: 20000, max: 30000, unit: "MONTH", currency: "INR" },
    skills: ["Embedded C", "RTOS", "Oscilloscope and bench instrumentation", "Git"],
    eligibility:
      "Electronics, Electrical or Instrumentation students in their third or final year.",
    responsibilities: [
      "Write and test firmware for battery management boards",
      "Build test rigs for cell characterisation",
      "Debug on real hardware with a scope and a logic analyser",
    ],
  },
  {
    slug: "research-assistant-water-quality",
    title: "Research Assistant, Water Quality",
    summary: "A one-year funded research position on low-cost water quality sensing.",
    description:
      "A funded position on a research programme developing low-cost water quality sensing for rural distribution networks. Substantial field work in Maharashtra and Madhya Pradesh. Suited to someone considering postgraduate research who wants to find out what field research is actually like first.",
    type: "research",
    employmentType: "CONTRACTOR",
    organisation: {
      name: "Centre for Applied Water Research",
      website: "https://example.org/cawr",
      verified: true,
    },
    location: { city: "Pune", state: "Maharashtra" },
    remote: false,
    postedOn: "2026-07-28",
    validThrough: "2026-10-15",
    openings: 1,
    stipend: { min: 420000, max: 540000, unit: "YEAR", currency: "INR" },
    skills: ["Analytical chemistry or environmental engineering", "Data analysis", "Field work"],
    eligibility:
      "Recent graduates in environmental engineering, chemistry or a related discipline.",
    responsibilities: [
      "Field sampling and sensor deployment across rural sites",
      "Laboratory validation of sensor readings",
      "Statistical analysis and contribution to publications",
    ],
  },
  {
    slug: "frontend-engineer-lumen-learning",
    title: "Frontend Engineer, Accessibility",
    summary:
      "A graduate role building education software where accessibility is a requirement, not a retrofit.",
    description:
      "Building learning tools used in schools, where accessibility is a hard requirement rather than a later ticket. You will work in TypeScript and React, and you will be expected to test with a screen reader as a matter of course.",
    type: "job",
    employmentType: "FULL_TIME",
    organisation: {
      name: "Lumen Learning Technologies",
      website: "https://example.com/lumen",
      verified: true,
    },
    location: { city: "Hyderabad", state: "Telangana" },
    remote: true,
    postedOn: "2026-08-25",
    validThrough: "2026-12-15",
    openings: 2,
    stipend: { min: 700000, max: 1100000, unit: "YEAR", currency: "INR" },
    skills: ["TypeScript", "React", "WCAG 2.1", "Screen reader testing"],
    eligibility: "Graduating students and candidates with up to two years of experience.",
    responsibilities: [
      "Build accessible interfaces to WCAG 2.1 AA",
      "Test with screen readers and keyboard-only navigation",
      "Work with teachers to validate designs against real classroom use",
    ],
  },
  {
    slug: "sustainability-hackathon-2026",
    title: "Open Water Challenge 2026",
    summary: "A 48-hour hackathon on water conservation, open to teams from any college.",
    description:
      "A 48-hour challenge on water conservation and monitoring, open to cross-college teams. Problem statements are released one week ahead and are drawn from real municipal requirements rather than invented for the event. Working prototypes are judged over pitch decks.",
    type: "hackathon",
    employmentType: "TEMPORARY",
    organisation: {
      name: "HydroSense Systems",
      website: "https://example.com/hydrosense",
      verified: true,
    },
    location: { city: "Pune", state: "Maharashtra" },
    remote: false,
    postedOn: "2026-09-01",
    validThrough: "2026-11-05",
    openings: 40,
    skills: ["Any engineering discipline", "Prototyping"],
    eligibility: "Teams of 2 to 4 currently enrolled students. Cross-college teams welcome.",
    responsibilities: [
      "Form a team of 2 to 4 and register before the deadline",
      "Build a working prototype within 48 hours",
      "Present to a panel including municipal water engineers",
    ],
  },
  {
    slug: "data-analyst-intern-brightpath",
    title: "Data Analyst Intern",
    summary:
      "An unverified listing — held back from every public surface until the company is verified.",
    description:
      "A listing from an organisation that has registered but not completed verification. It is included in the fixtures specifically to demonstrate that an unverified company cannot reach students: it does not appear in search, cannot be applied to, and is excluded from the sitemap.",
    type: "internship",
    employmentType: "INTERN",
    organisation: { name: "BrightPath Consulting", verified: false },
    location: { city: "Delhi", state: "Delhi" },
    remote: true,
    postedOn: "2026-08-30",
    validThrough: "2026-12-31",
    openings: 10,
    skills: ["Excel", "SQL"],
    eligibility: "Any student.",
    responsibilities: ["Data entry and reporting"],
  },
];

export const opportunityBySlug = Object.fromEntries(
  opportunities.map((o) => [o.slug, o]),
) as Record<string, Opportunity>;

/** Verified organisations only, and not past `validThrough`. */
export function publicOpportunities(now = new Date()): Opportunity[] {
  return opportunities.filter((o) => o.organisation.verified && new Date(o.validThrough) > now);
}

export const OPPORTUNITY_TYPE_LABEL: Record<Opportunity["type"], string> = {
  internship: "Internship",
  job: "Job",
  research: "Research position",
  hackathon: "Hackathon",
};
