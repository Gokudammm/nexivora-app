import type { MetadataRoute } from "next";

import { DOMAINS, SDGS, SUBTOPICS, sdgPath } from "@/config/taxonomy";
import { publicArticles, publicIdeas } from "@/content";
import { publicProjects } from "@/lib/db/queries/public-projects";
import { publicOpportunities } from "@/content/opportunities";
import { helpArticles } from "@/content/site";
import { legalDocuments } from "@/content/legal";
import { ANONYMOUS } from "@/lib/authz/viewer";
import { publicCollegeSlugs } from "@/lib/db/queries/institution";
import { publicProfileUsernames } from "@/lib/db/queries/profile";
import { absoluteUrl } from "@/lib/seo/metadata";

/**
 * The sitemap.
 *
 * Rules, from docs/SEO-CHECKLIST.md §6 — every one of these is a way sitemaps
 * commonly go wrong:
 *
 *   - **Only canonical, indexable, 200-status URLs.** Never a redirect, never a
 *     `noindex` page, and never a private resource.
 *   - **`lastModified` comes from real data**, not `new Date()`. A sitemap that
 *     claims every page changed today is worse than one with no dates at all.
 *   - Membership is derived from `resolveVisibility()` via the `public*()`
 *     helpers, never decided here — so a private project cannot leak in through
 *     a forgotten condition (ADR-010).
 *
 * `scripts/check-seo.mjs` crawls every URL in here and asserts the private
 * fixtures are absent.
 *
 * Segmentation into a sitemap index (`generateSitemaps`) is deliberately not
 * done yet: the limit is 50,000 URLs and we are at roughly 90. Splitting now
 * would be structure without purpose. Phase 12 splits it when the archive grows.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entry = (
    path: string,
    lastModified: string | Date,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
    priority: number,
  ) => ({
    url: absoluteUrl(path),
    lastModified: new Date(lastModified),
    changeFrequency,
    priority,
  });

  /* Static marketing and trust pages. Dated from the last content change, which
     for fixtures is the phase that wrote them. */
  const staticUpdated = "2026-09-09";
  const staticPages: MetadataRoute.Sitemap = [
    entry("/", staticUpdated, "weekly", 1.0),
    entry("/explore", staticUpdated, "daily", 0.9),
    entry("/ideas", staticUpdated, "daily", 0.8),
    entry("/topics", staticUpdated, "weekly", 0.8),
    entry("/sdg", staticUpdated, "weekly", 0.7),
    entry("/colleges", staticUpdated, "weekly", 0.7),
    entry("/knowledge", staticUpdated, "weekly", 0.8),
    entry("/opportunities", staticUpdated, "daily", 0.8),
    entry("/for-students", staticUpdated, "monthly", 0.8),
    entry("/for-faculty", staticUpdated, "monthly", 0.8),
    entry("/for-colleges", staticUpdated, "monthly", 0.8),
    entry("/for-companies", staticUpdated, "monthly", 0.7),
    entry("/for-alumni", staticUpdated, "monthly", 0.6),
    entry("/how-it-works", staticUpdated, "monthly", 0.7),
    entry("/features", staticUpdated, "monthly", 0.7),
    entry("/features/workspace", staticUpdated, "monthly", 0.6),
    entry("/features/contribution-ledger", staticUpdated, "monthly", 0.7),
    entry("/features/archive", staticUpdated, "monthly", 0.7),
    entry("/pricing", staticUpdated, "monthly", 0.7),
    entry("/about", staticUpdated, "monthly", 0.5),
    entry("/contact", staticUpdated, "yearly", 0.4),
    entry("/faq", staticUpdated, "monthly", 0.6),
    entry("/help", staticUpdated, "monthly", 0.5),
    entry("/changelog", staticUpdated, "weekly", 0.4),
    entry("/roadmap", staticUpdated, "monthly", 0.4),
  ];

  const projectPages = (await publicProjects()).map((project) =>
    entry(
      `/projects/${project.slug}`,
      project.publishedOn ?? project.completedOn ?? project.startedOn,
      "monthly",
      0.9,
    ),
  );

  const topicPages = [
    ...DOMAINS.map((d) => entry(`/topics/${d.slug}`, staticUpdated, "weekly", 0.7)),
    ...SUBTOPICS.map((t) => entry(`/topics/${t.slug}`, staticUpdated, "weekly", 0.6)),
  ];

  const sdgPages = SDGS.map((s) => entry(sdgPath(s.number), staticUpdated, "weekly", 0.6));

  // From the database as of Phase 5, so granting or revoking verification
  // changes the sitemap. The check that matters is that an unverified college is
  // absent — scripts/check-seo.mjs asserts it against a real unverified row.
  const collegeSlugs = await publicCollegeSlugs(ANONYMOUS);
  const collegePages = collegeSlugs.map((slug) =>
    entry(`/colleges/${slug}`, staticUpdated, "weekly", 0.6),
  );

  // From the database as of Phase 6. A private profile is absent by
  // construction — the query only returns public profiles at verified colleges
  // — rather than by a filter someone has to remember (acceptance criterion 3).
  const profileUsernames = await publicProfileUsernames();
  const profilePages = profileUsernames.map((username) =>
    entry(`/p/${username}`, staticUpdated, "weekly", 0.5),
  );

  const ideaPages = publicIdeas().map((idea) =>
    entry(`/ideas/${idea.slug}`, idea.postedOn, "weekly", 0.6),
  );

  const articlePages = publicArticles().map((a) =>
    entry(`/knowledge/${a.slug}`, a.updatedOn ?? a.publishedOn, "monthly", 0.7),
  );

  const opportunityPages = publicOpportunities().map((o) =>
    entry(`/opportunities/${o.slug}`, o.postedOn, "daily", 0.7),
  );

  const helpPages = helpArticles.map((h) =>
    entry(`/help/${h.slug}`, staticUpdated, "monthly", 0.4),
  );

  const legalPages = legalDocuments.map((d) =>
    entry(`/legal/${d.slug}`, d.updatedOn, "yearly", 0.3),
  );

  return [
    ...staticPages,
    ...projectPages,
    ...topicPages,
    ...sdgPages,
    ...collegePages,
    ...profilePages,
    ...ideaPages,
    ...articlePages,
    ...opportunityPages,
    ...helpPages,
    ...legalPages,
  ];
}
