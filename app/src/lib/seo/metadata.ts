import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

/**
 * The metadata builder. Every page in the product goes through this.
 *
 * No page hand-writes a <title>, a canonical, a robots tag or an OG image — the
 * per-page SEO contract in docs/SEO-CHECKLIST.md §2 is enforced here by
 * construction, and `scripts/check-seo.mjs` crawls the sitemap to prove it.
 *
 * Length limits come from the Google Search Central docs in ../SEO IMPs:
 *   - Titles: specific, under ~60 characters, never boilerplate (Title.txt)
 *   - Descriptions: a human summary of THIS page, 110-160 characters
 */

export const TITLE_MAX = 60;
export const DESCRIPTION_MIN = 110;
export const DESCRIPTION_MAX = 160;

export type OgAccent =
  | "default"
  | "ai"
  | "software"
  | "hardware"
  | "healthcare"
  | "education"
  | "sustainability"
  | "social"
  | "research";

export type BuildMetadataInput = {
  /** The page-specific part. The site name is appended when it fits. */
  title: string;
  /** Written for this page. Never templated — a templated description is a duplicate. */
  description: string;
  /** Path only, e.g. "/explore". The canonical is built from NEXT_PUBLIC_SITE_URL. */
  path: string;
  /** OpenGraph type. "article" for knowledge posts, "profile" for people. */
  type?: "website" | "article" | "profile";
  /**
   * Set false for anything private, personal or a filter permutation.
   * Derived from a resource's visibility via resolveVisibility(), never guessed.
   */
  index?: boolean;
  /** Suppresses the "· Nexivora" suffix. Used only by the home page. */
  absoluteTitle?: boolean;
  keywords?: string[];
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  /** Overrides for the generated OG card. Defaults derive from title/description. */
  og?: {
    eyebrow?: string;
    /** Defaults to the page description, trimmed. */
    description?: string;
    chips?: string[];
    accent?: OgAccent;
  };
};

/** Absolute URL from a path. Every canonical and OG URL goes through this. */
export function absoluteUrl(path: string): string {
  const base = siteConfig.url.replace(/\/$/, "");
  const suffix = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

/**
 * The OG card URL.
 *
 * A route handler at a stable path, not the file-based `opengraph-image`
 * convention — see the comment in app/api/og/route.tsx for why the convention
 * silently produced no image on every page here.
 */
export function ogUrl(input: {
  title: string;
  eyebrow?: string;
  description?: string;
  chips?: string[];
  accent?: OgAccent;
}): string {
  const params = new URLSearchParams({ title: input.title });
  if (input.eyebrow) params.set("eyebrow", input.eyebrow);
  if (input.description) params.set("description", input.description);
  if (input.chips?.length) params.set("chips", input.chips.join(","));
  if (input.accent && input.accent !== "default") params.set("accent", input.accent);
  return absoluteUrl(`/api/og?${params.toString()}`);
}

export function buildMetadata(input: BuildMetadataInput): Metadata {
  const {
    title,
    description,
    path,
    type = "website",
    index = true,
    absoluteTitle = false,
    keywords,
    publishedTime,
    modifiedTime,
    authors,
    og,
  } = input;

  /*
   * The site-name suffix is dropped when it would push the title past the
   * limit. Content titles — a project name, an article headline — are the
   * signal; the brand is not, and truncating the signal to keep the brand is
   * the wrong trade. Publishers do the same.
   */
  const suffixed = `${title} · ${siteConfig.name}`;
  const fullTitle = absoluteTitle || suffixed.length > TITLE_MAX ? title : suffixed;

  const canonical = absoluteUrl(path);
  const image = ogUrl({
    title,
    eyebrow: og?.eyebrow,
    description: og?.description ?? description,
    chips: og?.chips,
    accent: og?.accent,
  });

  if (process.env.NODE_ENV !== "production") {
    warnOnContractBreach(fullTitle, description, path);
  }

  return {
    // `absolute` is load-bearing: the root layout declares a title TEMPLATE
    // ("%s · Nexivora"), and buildMetadata already appends the site name. A
    // plain string here gets the template applied on top and renders
    // "Style guide · Nexivora · Nexivora". Caught by the Phase 1 crawl.
    title: { absolute: fullTitle },
    description,
    keywords,
    authors: authors?.map((name) => ({ name })),
    alternates: { canonical },
    robots: index
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            // Large image previews are required for Google Discover eligibility.
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        }
      : { index: false, follow: true },
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type,
      images: [{ url: image, width: 1200, height: 630, alt: fullTitle }],
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
      creator: siteConfig.social.twitter,
    },
  };
}

/**
 * Development-time warnings for our own SEO contract.
 *
 * These are warnings rather than errors so a page in progress is not blocked;
 * `scripts/check-seo.mjs` turns the same rules into a hard failure across the
 * whole route table before a phase can be called complete.
 */
function warnOnContractBreach(title: string, description: string, path: string) {
  if (title.length > TITLE_MAX) {
    console.warn(`[seo] Title too long (${title.length} > ${TITLE_MAX}) on ${path}: "${title}"`);
  }
  if (description.length > DESCRIPTION_MAX) {
    console.warn(
      `[seo] Description too long (${description.length} > ${DESCRIPTION_MAX}) on ${path}`,
    );
  }
  if (description.length < DESCRIPTION_MIN) {
    console.warn(
      `[seo] Description too short (${description.length} < ${DESCRIPTION_MIN}) on ${path}`,
    );
  }
}

/**
 * Pads a short description to the contract minimum with a relevant, honest
 * suffix. Used by dynamic pages whose source text is legitimately terse.
 *
 * It appends context that is true of the page rather than filler — a
 * description that says nothing is worse than one that is slightly short.
 */
export function ensureDescription(text: string, suffix: string): string {
  const base = text.trim();
  if (base.length >= DESCRIPTION_MIN) return base.slice(0, DESCRIPTION_MAX);
  const joined = `${base} ${suffix.trim()}`.trim();
  return joined.slice(0, DESCRIPTION_MAX);
}
