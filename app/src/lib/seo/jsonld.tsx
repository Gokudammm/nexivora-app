import { siteConfig } from "@/config/site";
import { absoluteUrl } from "@/lib/seo/metadata";

/**
 * Typed structured-data builders. The map they implement is in
 * docs/SEO-CHECKLIST.md §3.
 *
 * Two rules govern every builder here:
 *
 * 1. **Structured data must match the visible text.** `AI Overviews.txt` calls
 *    this out explicitly, and it is one of the few concrete requirements in
 *    that document. Never emit a value the reader cannot also see on the page.
 * 2. **Never emit an empty or invented field.** `undefined` values are stripped
 *    before serialising, because a `JobPosting` with `baseSalary: null` is worse
 *    than one without the property.
 */

export type JsonLdObject = Record<string, unknown>;

/** Removes undefined/null/empty-array values, recursively. */
function prune<T>(value: T): T {
  if (Array.isArray(value)) {
    const cleaned = value.map(prune).filter((v) => v !== undefined && v !== null);
    return (cleaned.length ? cleaned : undefined) as T;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => [k, prune(v)] as const)
      .filter(([, v]) => v !== undefined && v !== null && v !== "");
    return (entries.length ? Object.fromEntries(entries) : undefined) as T;
  }
  return value;
}

/**
 * Renders a JSON-LD script tag.
 *
 * `<` is escaped so a string containing `</script>` cannot break out of the
 * tag. That matters here because later phases feed this user-authored project
 * titles and profile bios.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const json = JSON.stringify(prune(data)).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

const CTX = "https://schema.org";

/* ------------------------------------------------------------ Organization */

export function organization(): JsonLdObject {
  return {
    "@context": CTX,
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: siteConfig.name,
    legalName: siteConfig.legalName,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/icon-512.png"),
    description: siteConfig.description,
    foundingDate: siteConfig.organization.foundingDate,
    founder: { "@type": "Person", name: siteConfig.organization.founderName },
    address: { "@type": "PostalAddress", addressCountry: siteConfig.organization.country },
    sameAs: [siteConfig.social.linkedin, siteConfig.social.github].filter(Boolean),
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: siteConfig.contact.support,
      availableLanguage: ["English", "Hindi"],
    },
  };
}

/* ------------------------------------------------- WebSite + SearchAction */

/** Wires up the sitelinks search box. The target must be a real, working URL. */
export function website(): JsonLdObject {
  return {
    "@context": CTX,
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: siteConfig.name,
    url: absoluteUrl("/"),
    description: siteConfig.description,
    publisher: { "@id": absoluteUrl("/#organization") },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/explore")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/* --------------------------------------------------------- BreadcrumbList */

export type Crumb = { label: string; href: string };

export function breadcrumbList(crumbs: Crumb[]): JsonLdObject {
  return {
    "@context": CTX,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.label,
      item: absoluteUrl(crumb.href),
    })),
  };
}

/* ------------------------------------------------------------ CreativeWork */

export type CreativeWorkInput = {
  title: string;
  slug: string;
  abstract: string;
  datePublished?: string;
  dateModified?: string;
  authors: { name: string; username?: string }[];
  college?: { name: string; slug: string };
  topics?: string[];
  keywords?: string[];
  license?: string;
  citationId?: string;
  repositoryUrl?: string;
  /** Set for research-shaped projects, which get ScholarlyArticle instead. */
  scholarly?: boolean;
};

/**
 * The highest-value type in this product — a project page.
 *
 * `CreativeWork` rather than `Article`: a student project is a work, not a news
 * item. Research-shaped projects upgrade to `ScholarlyArticle`.
 */
export function creativeWork(input: CreativeWorkInput): JsonLdObject {
  const url = absoluteUrl(`/projects/${input.slug}`);
  return {
    "@context": CTX,
    "@type": input.scholarly ? "ScholarlyArticle" : "CreativeWork",
    "@id": `${url}#project`,
    name: input.title,
    headline: input.title,
    abstract: input.abstract,
    description: input.abstract,
    url,
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    inLanguage: siteConfig.lang,
    license: input.license,
    identifier: input.citationId,
    keywords: input.keywords?.length ? input.keywords.join(", ") : undefined,
    about: input.topics?.map((topic) => ({ "@type": "Thing", name: topic })),
    author: input.authors.map((author) => ({
      "@type": "Person",
      name: author.name,
      url: author.username ? absoluteUrl(`/p/${author.username}`) : undefined,
    })),
    sourceOrganization: input.college
      ? {
          "@type": "CollegeOrUniversity",
          name: input.college.name,
          url: absoluteUrl(`/colleges/${input.college.slug}`),
        }
      : undefined,
    codeRepository: input.repositoryUrl,
    publisher: { "@id": absoluteUrl("/#organization") },
    isPartOf: { "@id": absoluteUrl("/#website") },
  };
}

/* ----------------------------------------------------------------ItemList */

export function itemList(
  items: { name: string; url: string }[],
  options: { name?: string } = {},
): JsonLdObject {
  return {
    "@context": CTX,
    "@type": "ItemList",
    name: options.name,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.url),
    })),
  };
}

/* --------------------------------------------------- Person + ProfilePage */

export type PersonInput = {
  name: string;
  username: string;
  headline?: string;
  bio?: string;
  college?: { name: string; slug: string };
  skills?: string[];
  links?: string[];
  role?: string;
};

export function personProfile(input: PersonInput): JsonLdObject[] {
  const url = absoluteUrl(`/p/${input.username}`);
  const person: JsonLdObject = {
    "@context": CTX,
    "@type": "Person",
    "@id": `${url}#person`,
    name: input.name,
    url,
    description: input.bio ?? input.headline,
    jobTitle: input.role,
    knowsAbout: input.skills,
    sameAs: input.links,
    affiliation: input.college
      ? {
          "@type": "CollegeOrUniversity",
          name: input.college.name,
          url: absoluteUrl(`/colleges/${input.college.slug}`),
        }
      : undefined,
  };

  const page: JsonLdObject = {
    "@context": CTX,
    "@type": "ProfilePage",
    "@id": `${url}#profilepage`,
    mainEntity: { "@id": `${url}#person` },
    url,
    name: `${input.name} · ${siteConfig.name}`,
  };

  return [person, page];
}

/* --------------------------------------------------- CollegeOrUniversity */

export type CollegeInput = {
  name: string;
  slug: string;
  description: string;
  city?: string;
  state?: string;
  website?: string;
  foundingDate?: string;
};

export function collegeOrUniversity(input: CollegeInput): JsonLdObject {
  return {
    "@context": CTX,
    "@type": "CollegeOrUniversity",
    "@id": `${absoluteUrl(`/colleges/${input.slug}`)}#college`,
    name: input.name,
    description: input.description,
    url: absoluteUrl(`/colleges/${input.slug}`),
    sameAs: input.website,
    foundingDate: input.foundingDate,
    address: {
      "@type": "PostalAddress",
      addressLocality: input.city,
      addressRegion: input.state,
      addressCountry: "IN",
    },
  };
}

/* ---------------------------------------------------------------- Article */

export type ArticleInput = {
  title: string;
  slug: string;
  description: string;
  datePublished: string;
  dateModified?: string;
  author: string;
  section?: string;
  keywords?: string[];
  wordCount?: number;
};

export function article(input: ArticleInput): JsonLdObject {
  const url = absoluteUrl(`/knowledge/${input.slug}`);
  return {
    "@context": CTX,
    "@type": "Article",
    "@id": `${url}#article`,
    headline: input.title,
    description: input.description,
    url,
    mainEntityOfPage: url,
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    author: { "@type": "Person", name: input.author },
    publisher: { "@id": absoluteUrl("/#organization") },
    articleSection: input.section,
    keywords: input.keywords?.length ? input.keywords.join(", ") : undefined,
    wordCount: input.wordCount,
    inLanguage: siteConfig.lang,
  };
}

/* ---------------------------------------------------------------- FAQPage */

export type Faq = { question: string; answer: string };

/**
 * Only for genuine question/answer pairs that are visible on the page. Marking
 * up an FAQ the reader cannot see is exactly the mismatch the guidance warns
 * against, and it is the fastest way to lose rich-result eligibility.
 */
export function faqPage(faqs: Faq[]): JsonLdObject {
  return {
    "@context": CTX,
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

/* ------------------------------------------------------------------ HowTo */

export function howTo(input: {
  name: string;
  description: string;
  steps: { name: string; text: string }[];
}): JsonLdObject {
  return {
    "@context": CTX,
    "@type": "HowTo",
    name: input.name,
    description: input.description,
    step: input.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };
}

/* -------------------------------------------------------- DefinedTermSet */

export function definedTermSet(input: {
  name: string;
  description: string;
  terms: { name: string; description: string; slug: string }[];
}): JsonLdObject {
  return {
    "@context": CTX,
    "@type": "DefinedTermSet",
    name: input.name,
    description: input.description,
    hasDefinedTerm: input.terms.map((term) => ({
      "@type": "DefinedTerm",
      name: term.name,
      description: term.description,
      url: absoluteUrl(`/topics/${term.slug}`),
    })),
  };
}

/* ------------------------------------------------------------- JobPosting */

export type JobPostingInput = {
  title: string;
  slug: string;
  description: string;
  datePosted: string;
  validThrough: string;
  employmentType: "INTERN" | "FULL_TIME" | "PART_TIME" | "CONTRACTOR" | "TEMPORARY";
  organization: { name: string; website?: string };
  location?: { city: string; state: string };
  remote?: boolean;
  salary?: { min: number; max: number; unit: "MONTH" | "YEAR"; currency: string };
  skills?: string[];
  educationRequirements?: string;
  openings?: number;
};

/**
 * The highest-value schema type available to this product — it makes a listing
 * eligible for Google's job experience, which is a real, nameable distribution
 * advantage.
 *
 * `validThrough` must be accurate: an expired posting still in the index is a
 * quality problem Google notices, so Phase 13 must expire these.
 */
export function jobPosting(input: JobPostingInput): JsonLdObject {
  return {
    "@context": CTX,
    "@type": "JobPosting",
    "@id": `${absoluteUrl(`/opportunities/${input.slug}`)}#posting`,
    title: input.title,
    description: input.description,
    datePosted: input.datePosted,
    validThrough: input.validThrough,
    employmentType: input.employmentType,
    hiringOrganization: {
      "@type": "Organization",
      name: input.organization.name,
      sameAs: input.organization.website,
    },
    jobLocation: input.location
      ? {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            addressLocality: input.location.city,
            addressRegion: input.location.state,
            addressCountry: "IN",
          },
        }
      : undefined,
    jobLocationType: input.remote ? "TELECOMMUTE" : undefined,
    applicantLocationRequirements: input.remote ? { "@type": "Country", name: "India" } : undefined,
    baseSalary: input.salary
      ? {
          "@type": "MonetaryAmount",
          currency: input.salary.currency,
          value: {
            "@type": "QuantitativeValue",
            minValue: input.salary.min,
            maxValue: input.salary.max,
            unitText: input.salary.unit,
          },
        }
      : undefined,
    skills: input.skills?.length ? input.skills.join(", ") : undefined,
    educationRequirements: input.educationRequirements,
    totalJobOpenings: input.openings,
    directApply: true,
  };
}

/* ----------------------------------------------------------- ContactPoint */

export function contactPage(): JsonLdObject {
  return {
    "@context": CTX,
    "@type": "ContactPage",
    name: `Contact ${siteConfig.name}`,
    url: absoluteUrl("/contact"),
    mainEntity: {
      "@type": "Organization",
      name: siteConfig.name,
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: siteConfig.contact.support,
        },
        {
          "@type": "ContactPoint",
          contactType: "privacy",
          email: siteConfig.contact.privacy,
        },
      ],
    },
  };
}
