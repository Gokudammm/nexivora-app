/**
 * Visibility → indexability.
 *
 * ADR-010: visibility is **data**; indexability is **derived**. No page sets a
 * robots directive or decides sitemap membership on its own, because the moment
 * two places make that decision they will disagree — and the failure mode is a
 * private student project leaking into the sitemap. That is a privacy incident
 * first and an SEO problem second.
 *
 * Everything public flows through `resolveVisibility()`, and
 * `scripts/check-seo.mjs` crawls the sitemap to assert nothing non-public
 * appears in it.
 */

/** Mirrors the `Visibility` enum Phase 3's schema will declare. */
export type Visibility = "PRIVATE" | "GROUP" | "CLASS" | "COLLEGE" | "PUBLIC";

export type VisibilityInput = {
  visibility: Visibility;
  /** ISO date. While in the future, content is listed but not disclosed. */
  embargoUntil?: string | null;
  /**
   * Unverified colleges are never publicly indexable — the anti-abuse gate
   * from Phase 5. Defaults to true so fixtures do not have to opt in.
   */
  collegeVerified?: boolean;
  /** A project is only public once faculty approved publication (Phase 8). */
  approved?: boolean;
};

export type ResolvedVisibility = {
  /** May a logged-out visitor read the full content? */
  publiclyReadable: boolean;
  /** Should search engines index it? Feeds `buildMetadata({ index })`. */
  indexable: boolean;
  /** Should it appear in a sitemap? Never true when `indexable` is false. */
  inSitemap: boolean;
  /** Title, team and abstract are visible; sections and files are not. */
  embargoed: boolean;
  /** Why it is not indexable — surfaced in the audit output, not to users. */
  reason?: string;
};

export function isEmbargoed(embargoUntil?: string | null, now = new Date()): boolean {
  if (!embargoUntil) return false;
  const until = new Date(embargoUntil);
  return Number.isFinite(until.getTime()) && until > now;
}

export function resolveVisibility(input: VisibilityInput, now = new Date()): ResolvedVisibility {
  const { visibility, embargoUntil, collegeVerified = true, approved = true } = input;
  const embargoed = isEmbargoed(embargoUntil, now);

  const deny = (reason: string): ResolvedVisibility => ({
    publiclyReadable: false,
    indexable: false,
    inSitemap: false,
    embargoed,
    reason,
  });

  if (visibility !== "PUBLIC") return deny(`visibility is ${visibility}`);
  if (!collegeVerified) return deny("college is not verified");
  if (!approved) return deny("publication not approved by faculty");

  // An embargoed project IS indexable and IS listed: the point of an embargo is
  // that the work can be *cited* without being *disclosed*. Only the body is
  // withheld, and the page says so.
  return {
    publiclyReadable: true,
    indexable: true,
    inSitemap: true,
    embargoed,
  };
}

/**
 * Faceted-URL indexability (docs/SEO-CHECKLIST.md §5).
 *
 * An explore page with six filter dimensions generates a combinatorial
 * explosion of thin, near-duplicate URLs. Only a curated set is indexable:
 *
 *   no facets      → indexable (the hub)
 *   one facet      → indexable, canonical points at the facet's own hub page
 *   two or more    → `noindex, follow` — crawlable for discovery, never indexed
 *
 * Sort and view are presentation, not content, so they never make a URL
 * non-indexable on their own, but they do force a canonical to the clean URL.
 */
export const FACET_KEYS = ["domain", "sdg", "status", "year", "college", "tech"] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

const PRESENTATION_KEYS = ["sort", "view", "page"] as const;

/** Hub pages that a single-facet filter should canonicalise to. */
const FACET_HUB: Partial<Record<FacetKey, (value: string) => string>> = {
  domain: (value) => `/topics/${value}`,
  sdg: (value) => `/sdg/${value}`,
};

export type FacetResolution = {
  indexable: boolean;
  /** Absolute-path canonical this URL should declare. */
  canonicalPath: string;
  activeFacets: number;
  reason?: string;
};

export function resolveFacetedUrl(
  basePath: string,
  params: Record<string, string | string[] | undefined>,
): FacetResolution {
  const active = FACET_KEYS.filter((key) => {
    const value = params[key];
    return typeof value === "string" ? value.length > 0 : Array.isArray(value) && value.length > 0;
  });

  const page = typeof params.page === "string" ? Number(params.page) : 1;
  const pageSuffix = Number.isFinite(page) && page > 1 ? `?page=${page}` : "";

  if (active.length === 0) {
    return { indexable: true, canonicalPath: `${basePath}${pageSuffix}`, activeFacets: 0 };
  }

  if (active.length === 1) {
    const key = active[0]!;
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const values = (value ?? "").split(",").filter(Boolean);

    // A single facet with a single value has an editorial hub page; send the
    // canonical there rather than competing with it.
    if (values.length === 1 && FACET_HUB[key]) {
      return {
        indexable: true,
        canonicalPath: FACET_HUB[key]!(values[0]!),
        activeFacets: 1,
      };
    }

    return {
      indexable: true,
      canonicalPath: `${basePath}?${key}=${value}${pageSuffix ? `&page=${page}` : ""}`,
      activeFacets: 1,
    };
  }

  return {
    indexable: false,
    canonicalPath: basePath,
    activeFacets: active.length,
    reason: `${active.length} active facets — multi-facet permutations are noindex, follow`,
  };
}

/** True when only presentation params are set, so the canonical is the clean path. */
export function hasOnlyPresentationParams(
  params: Record<string, string | string[] | undefined>,
): boolean {
  return Object.keys(params).every((key) => (PRESENTATION_KEYS as readonly string[]).includes(key));
}
