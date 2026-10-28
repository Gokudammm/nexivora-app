import type { DomainKey, Sdg, Topic } from "@/content/types";

/**
 * The taxonomy. **One definition, four consumers**: `/topics/[slug]`, the
 * explore facets, a project's domain colour, and the Phase 11 teammate matcher.
 *
 * Structural definition lives here in `config/`; the editorial hub-page copy
 * that renders on `/topics/[slug]` lives in `content/topics.ts` and references
 * these slugs. Phase 3 seeds the database from this file rather than
 * duplicating it.
 *
 * Colours come from the eight-colour domain set already contrast-checked in
 * both themes by `scripts/check-contrast.mjs`, so a taxonomy entry can never
 * introduce an unverified colour.
 */

export const DOMAINS: {
  key: DomainKey;
  slug: string;
  name: string;
  summary: string;
  colorVar: string;
}[] = [
  {
    key: "ai",
    slug: "ai-ml",
    name: "AI & Machine Learning",
    summary: "Models, data pipelines, computer vision, NLP and applied inference.",
    colorVar: "--color-domain-ai",
  },
  {
    key: "software",
    slug: "software",
    name: "Software & Systems",
    summary: "Web and mobile applications, platforms, tooling and infrastructure.",
    colorVar: "--color-domain-software",
  },
  {
    key: "hardware",
    slug: "hardware-iot",
    name: "Hardware & IoT",
    summary: "Sensors, embedded systems, robotics, instrumentation and devices.",
    colorVar: "--color-domain-hardware",
  },
  {
    key: "healthcare",
    slug: "healthcare",
    name: "Healthcare & Biotech",
    summary: "Diagnostics, medical devices, health data and biotechnology.",
    colorVar: "--color-domain-healthcare",
  },
  {
    key: "education",
    slug: "education",
    name: "Education Technology",
    summary: "Learning tools, assessment and academic workflow.",
    colorVar: "--color-domain-education",
  },
  {
    key: "sustainability",
    slug: "sustainability",
    name: "Sustainability & Energy",
    summary: "Water, energy, agriculture, climate and the circular economy.",
    colorVar: "--color-domain-sustainability",
  },
  {
    key: "social",
    slug: "social-impact",
    name: "Social Impact",
    summary: "Civic technology, accessibility, rural development and public services.",
    colorVar: "--color-domain-social",
  },
  {
    key: "research",
    slug: "research",
    name: "Research & Science",
    summary: "Applied science, materials, mathematics and experimental work.",
    colorVar: "--color-domain-research",
  },
];

export const DOMAIN_BY_KEY = Object.fromEntries(DOMAINS.map((d) => [d.key, d])) as Record<
  DomainKey,
  (typeof DOMAINS)[number]
>;

export function domainColorVar(domain: DomainKey): string {
  return `var(${DOMAIN_BY_KEY[domain].colorVar})`;
}

/**
 * Sub-topics, two levels deep. Each is a real hub page with editorial copy in
 * `content/topics.ts` — never a generated shell.
 */
export const SUBTOPICS: Topic[] = [
  {
    slug: "computer-vision",
    name: "Computer Vision",
    domain: "ai",
    parent: "ai-ml",
    summary: "Image and video understanding, detection, segmentation and OCR.",
  },
  {
    slug: "nlp",
    name: "Natural Language Processing",
    domain: "ai",
    parent: "ai-ml",
    summary: "Text understanding, translation and summarisation.",
  },
  {
    slug: "predictive-modelling",
    name: "Predictive Modelling",
    domain: "ai",
    parent: "ai-ml",
    summary: "Forecasting, classification and regression on real-world data.",
  },
  {
    slug: "web-platforms",
    name: "Web Platforms",
    domain: "software",
    parent: "software",
    summary: "Full-stack applications, APIs and multi-user systems.",
  },
  {
    slug: "mobile",
    name: "Mobile",
    domain: "software",
    parent: "software",
    summary: "Android, iOS and cross-platform applications.",
  },
  {
    slug: "iot",
    name: "IoT & Sensors",
    domain: "hardware",
    parent: "hardware-iot",
    summary: "Connected sensing, telemetry and low-power devices.",
  },
  {
    slug: "robotics",
    name: "Robotics & Automation",
    domain: "hardware",
    parent: "hardware-iot",
    summary: "Actuation, control systems and autonomous machines.",
  },
  {
    slug: "medical-devices",
    name: "Medical Devices",
    domain: "healthcare",
    parent: "healthcare",
    summary: "Diagnostic and assistive hardware for clinical settings.",
  },
  {
    slug: "health-data",
    name: "Health Data",
    domain: "healthcare",
    parent: "healthcare",
    summary: "Clinical records, epidemiology and health informatics.",
  },
  {
    slug: "assistive-tech",
    name: "Assistive Technology",
    domain: "social",
    parent: "social-impact",
    summary: "Tools that widen access for people with disabilities.",
  },
  {
    slug: "civic-tech",
    name: "Civic Technology",
    domain: "social",
    parent: "social-impact",
    summary: "Public services, governance and community infrastructure.",
  },
  {
    slug: "water",
    name: "Water & Sanitation",
    domain: "sustainability",
    parent: "sustainability",
    summary: "Quality monitoring, treatment, conservation and distribution.",
  },
  {
    slug: "renewable-energy",
    name: "Renewable Energy",
    domain: "sustainability",
    parent: "sustainability",
    summary: "Solar, wind, storage and efficiency.",
  },
  {
    slug: "agritech",
    name: "Agriculture Technology",
    domain: "sustainability",
    parent: "sustainability",
    summary: "Precision farming, soil, irrigation and crop health.",
  },
  {
    slug: "learning-tools",
    name: "Learning Tools",
    domain: "education",
    parent: "education",
    summary: "Teaching aids, assessment and academic workflow.",
  },
  {
    slug: "materials",
    name: "Materials Science",
    domain: "research",
    parent: "research",
    summary: "Composites, coatings, characterisation and testing.",
  },
];

/** Top-level domains and sub-topics as one flat list — what facets iterate. */
export const ALL_TOPICS: Topic[] = [
  ...DOMAINS.map((d): Topic => ({ slug: d.slug, name: d.name, domain: d.key, summary: d.summary })),
  ...SUBTOPICS,
];

export const TOPIC_BY_SLUG = Object.fromEntries(ALL_TOPICS.map((t) => [t.slug, t])) as Record<
  string,
  Topic
>;

/* -------------------------------------------------------------------- SDGs */

/**
 * The 17 UN Sustainable Development Goals.
 *
 * SDG alignment is a first-class, filterable dimension because Indian
 * institutions now report on it formally, and no existing tool captures it at
 * the project level. Each summary describes what *student work* in that goal
 * actually looks like, so the hub pages are useful rather than encyclopaedic.
 */
export const SDGS: Sdg[] = [
  {
    number: 1,
    slug: "no-poverty",
    title: "No Poverty",
    summary: "Livelihood tools, microfinance access and rural income projects.",
  },
  {
    number: 2,
    slug: "zero-hunger",
    title: "Zero Hunger",
    summary: "Crop yield, food distribution, nutrition and agricultural efficiency.",
  },
  {
    number: 3,
    slug: "good-health",
    title: "Good Health & Well-being",
    summary: "Diagnostics, triage, mental health and access to care.",
  },
  {
    number: 4,
    slug: "quality-education",
    title: "Quality Education",
    summary: "Learning tools, accessibility, assessment and academic infrastructure.",
  },
  {
    number: 5,
    slug: "gender-equality",
    title: "Gender Equality",
    summary: "Safety, access, representation and participation.",
  },
  {
    number: 6,
    slug: "clean-water",
    title: "Clean Water & Sanitation",
    summary: "Water quality monitoring, treatment, conservation and irrigation.",
  },
  {
    number: 7,
    slug: "affordable-energy",
    title: "Affordable & Clean Energy",
    summary: "Solar, storage, efficiency and rural electrification.",
  },
  {
    number: 8,
    slug: "decent-work",
    title: "Decent Work & Economic Growth",
    summary: "Employment access, skills, and small-enterprise tooling.",
  },
  {
    number: 9,
    slug: "industry-innovation",
    title: "Industry, Innovation & Infrastructure",
    summary: "Manufacturing, connectivity, transport and resilient systems.",
  },
  {
    number: 10,
    slug: "reduced-inequalities",
    title: "Reduced Inequalities",
    summary: "Assistive technology, language access and rural inclusion.",
  },
  {
    number: 11,
    slug: "sustainable-cities",
    title: "Sustainable Cities & Communities",
    summary: "Urban mobility, waste, air quality and public space.",
  },
  {
    number: 12,
    slug: "responsible-consumption",
    title: "Responsible Consumption & Production",
    summary: "Recycling, circular design and supply-chain transparency.",
  },
  {
    number: 13,
    slug: "climate-action",
    title: "Climate Action",
    summary: "Emissions monitoring, adaptation and climate data.",
  },
  {
    number: 14,
    slug: "life-below-water",
    title: "Life Below Water",
    summary: "Marine monitoring, pollution and aquatic ecosystems.",
  },
  {
    number: 15,
    slug: "life-on-land",
    title: "Life on Land",
    summary: "Biodiversity, forestry, soil health and conservation.",
  },
  {
    number: 16,
    slug: "peace-justice",
    title: "Peace, Justice & Strong Institutions",
    summary: "Transparency, civic participation and public accountability.",
  },
  {
    number: 17,
    slug: "partnerships",
    title: "Partnerships for the Goals",
    summary: "Collaboration platforms, open data and shared infrastructure.",
  },
];

export const SDG_BY_NUMBER = Object.fromEntries(SDGS.map((s) => [s.number, s])) as Record<
  number,
  Sdg
>;

/** URL segment for an SDG hub: `/sdg/6-clean-water`. */
export function sdgPath(number: number): string {
  const sdg = SDG_BY_NUMBER[number];
  return sdg ? `/sdg/${sdg.number}-${sdg.slug}` : "/sdg";
}
