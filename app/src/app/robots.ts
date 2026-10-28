import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo/metadata";

/**
 * robots.txt
 *
 * The rule that governs the shape of this file, from `Robot.txt`:
 *
 * > **A `Disallow` prevents crawling, not indexing.** A URL discovered
 * > elsewhere can still be indexed while blocked — Google simply cannot see
 * > its content, or its `noindex`.
 *
 * So the two mechanisms do different jobs and are used for different things:
 *
 *   - **`Disallow`** for things that must never be *fetched*: the API, the
 *     authenticated application, auth flows. Nothing links to them publicly and
 *     nothing is lost by blocking the crawl.
 *   - **`noindex`** — set in page metadata via `resolveVisibility()` — for
 *     things that may be crawled but must not be *indexed*: multi-facet explore
 *     permutations, private profiles, verification pages. Blocking those in
 *     robots.txt would be counterproductive, because Google would never see
 *     the `noindex` that actually keeps them out.
 *
 * The parameter disallows below are the exception that proves the rule: they
 * are high-cardinality filter permutations that waste crawl budget, and the
 * pages themselves also carry `noindex` so they cannot be indexed from an
 * external link either. Belt and braces, deliberately.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Must never be fetched.
          "/api/",
          "/auth/",
          "/login",
          "/register",
          "/logout",
          "/verify-email",
          "/forgot-password",
          "/reset-password",
          "/onboarding",
          "/join/",

          // The authenticated application.
          "/feed",
          "/dashboard",
          "/groups/",
          "/workspace/",
          "/faculty/",
          "/admin/",
          "/platform/",
          "/settings/",
          "/mentorship/",
          "/company/",
          "/assistant",
          "/search",
          "/notifications",
          "/saved",

          // Crawl-budget protection on high-cardinality filter permutations.
          // These also carry noindex, so an externally linked permutation is
          // still kept out of the index.
          "/explore?*sort=*",
          "/explore?*view=*",
          "/*?*tech=*",
        ],
      },
      {
        // The style guide is an internal tool, not content.
        userAgent: "*",
        disallow: "/style-guide",
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
