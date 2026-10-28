/**
 * The single source of truth for product identity.
 *
 * Nothing in this project hard-codes the product name, tagline, URL or contact
 * details. Renaming or white-labelling must be a change to this file alone.
 */

export const siteConfig = {
  name: "Nexivora",
  legalName: "Nexivora",
  tagline: "Projects. People. Opportunities.",
  descriptor: "The Global Academic Collaboration Network",
  positioning: "Where student work becomes a permanent academic record.",

  description:
    "Nexivora is the system of record for academic project work — and the network that grows on top of it. Connect students, faculty, colleges, alumni and companies around the projects people actually build.",

  /** Short description for OG cards and the PWA manifest (under 120 chars). */
  shortDescription:
    "The global academic collaboration network. Build projects, prove contribution, publish your work.",

  /** Derived from NEXT_PUBLIC_SITE_URL — never hard-code a host anywhere else. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  locale: "en_IN",
  lang: "en",
  timezone: "Asia/Kolkata",

  /** Brand colours, mirrored from the token file for the manifest and meta. */
  themeColor: "#4f46e5",
  backgroundColor: "#ffffff",

  contact: {
    general: "hello@nexivora.com",
    support: "support@nexivora.com",
    privacy: "privacy@nexivora.com",
    /** Named grievance officer — required under the Indian IT Rules. */
    grievance: "grievance@nexivora.com",
  },

  social: {
    twitter: "@nexivora",
    github: "https://github.com/achaudhary7",
    linkedin: "https://www.linkedin.com/company/nexivora",
  },

  /** Used by the Organization JSON-LD builder in lib/seo/jsonld.ts. */
  organization: {
    foundingDate: "2026",
    founderName: "Ayush Chaudhary",
    country: "IN",
  },
} as const;

export type SiteConfig = typeof siteConfig;
