import type { Metadata } from "next";
import Link from "next/link";

import { NoResultsScene } from "@/components/illustrations";
import { Container, PageHeader } from "@/components/layout/primitives";
import { ProjectCard } from "@/components/project/project-card";
import { Badge } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/navigation";
import { DOMAINS, SDGS, TOPIC_BY_SLUG } from "@/config/taxonomy";
import { publicCollegeList } from "@/content";
import { projectYears, publicProjects } from "@/lib/db/queries/public-projects";
import type { Project } from "@/content/types";
import { JsonLd, itemList } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { resolveFacetedUrl } from "@/lib/seo/visibility";
import { cn } from "@/lib/utils/cn";

/**
 * `/explore` — the public project archive, and the acquisition engine.
 *
 * Three properties matter more than anything visual here:
 *
 *  1. **Filtering is server-side.** The facets are read from `searchParams` and
 *     applied before render, so every filter combination is a real URL that
 *     works with JavaScript disabled and can be shared or crawled.
 *  2. **Pagination renders real anchors** (the Phase 1 `Pagination`), so page 2
 *     onward is reachable by a crawler.
 *  3. **Indexability is computed, not chosen.** `resolveFacetedUrl()` decides:
 *     the bare hub and single-facet URLs are indexable, single-facet URLs
 *     canonicalise to their editorial hub, and multi-facet permutations are
 *     `noindex, follow` — crawlable for discovery, never indexed. Without that
 *     rule six facet dimensions generate a combinatorial explosion of thin,
 *     near-duplicate pages that eat the crawl budget (docs/SEO-CHECKLIST.md §5).
 */

const PER_PAGE = 12;

type SearchParams = Record<string, string | string[] | undefined>;

function readFacet(params: SearchParams, key: string): string[] {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function applyFacets(all: Project[], params: SearchParams): Project[] {
  const domains = readFacet(params, "domain");
  const sdgs = readFacet(params, "sdg").map(Number).filter(Number.isFinite);
  const statuses = readFacet(params, "status");
  const years = readFacet(params, "year").map(Number).filter(Number.isFinite);
  const collegeSlugs = readFacet(params, "college");
  const tech = readFacet(params, "tech");

  return all.filter((project) => {
    const year = new Date(project.publishedOn ?? project.startedOn).getFullYear();
    if (domains.length && !domains.some((d) => project.topics.includes(d) || d === project.domain))
      return false;
    if (sdgs.length && !sdgs.some((g) => project.sdgs.includes(g))) return false;
    if (statuses.length && !statuses.includes(project.status)) return false;
    if (years.length && !years.includes(year)) return false;
    if (collegeSlugs.length && !collegeSlugs.includes(project.collegeSlug)) return false;
    if (tech.length && !tech.some((t) => project.techStack.includes(t))) return false;
    return true;
  });
}

export async function generateMetadata(props: PageProps<"/explore">): Promise<Metadata> {
  const params = (await props.searchParams) as SearchParams;
  const facets = resolveFacetedUrl("/explore", params);
  const active = readFacet(params, "domain")[0];
  const topicName = active ? TOPIC_BY_SLUG[active]?.name : undefined;

  return buildMetadata({
    title: topicName ? `${topicName} student projects` : "Explore student projects",
    description: topicName
      ? `Documented ${topicName.toLowerCase()} projects from verified colleges — with methodology, results, named teams and faculty attestation.`
      : "Browse real, fully documented student projects: problem, methodology, results and named teams. Filter by domain, SDG, college and year.",
    path: facets.canonicalPath,
    index: facets.indexable,
  });
}

export default async function ExplorePage(props: PageProps<"/explore">) {
  const params = (await props.searchParams) as SearchParams;
  const all = await publicProjects();
  const filtered = applyFacets(all, params);

  const pageParam = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const shown = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const colleges = publicCollegeList();
  const years = await projectYears();

  /** Builds a URL with one facet toggled — every filter stays a shareable URL. */
  function facetHref(key: string, value: string): string {
    const current = readFacet(params, key);
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];

    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k === key || k === "page") continue;
      const single = Array.isArray(v) ? v[0] : v;
      if (single) search.set(k, single);
    }
    if (next.length) search.set(key, next.join(","));
    const qs = search.toString();
    return qs ? `/explore?${qs}` : "/explore";
  }

  function pageHref(target: number): string {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k === "page") continue;
      const single = Array.isArray(v) ? v[0] : v;
      if (single) search.set(k, single);
    }
    if (target > 1) search.set("page", String(target));
    const qs = search.toString();
    return qs ? `/explore?${qs}` : "/explore";
  }

  const activeCount = ["domain", "sdg", "status", "year", "college", "tech"].reduce(
    (n, key) => n + (readFacet(params, key).length ? 1 : 0),
    0,
  );

  return (
    <>
      <JsonLd
        data={itemList(
          shown.map((p) => ({ name: p.title, url: `/projects/${p.slug}` })),
          { name: "Student projects on Nexivora" },
        )}
      />

      <Container className="py-10 md:py-12">
        <PageHeader
          eyebrow="Explore"
          title="Student projects, documented properly"
          description="Real project work from verified colleges — problem statement, methodology, results and named teams. Every published project is permanent and citable."
        />

        <div className="mt-10 grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
          {/* Facets. Every one is a real link, so filtering works with no JS. */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Filter</h2>
              {activeCount > 0 ? (
                <Link href="/explore" className="text-sm text-primary-600 hover:underline">
                  Clear all
                </Link>
              ) : null}
            </div>

            <FacetGroup title="Domain">
              {DOMAINS.map((d) => (
                <FacetLink
                  key={d.slug}
                  href={facetHref("domain", d.slug)}
                  active={readFacet(params, "domain").includes(d.slug)}
                >
                  {d.name}
                </FacetLink>
              ))}
            </FacetGroup>

            <FacetGroup title="SDG">
              <div className="flex flex-wrap gap-1.5">
                {SDGS.map((sdg) => {
                  const active = readFacet(params, "sdg").includes(String(sdg.number));
                  return (
                    <Link
                      key={sdg.number}
                      href={facetHref("sdg", String(sdg.number))}
                      title={sdg.title}
                      className={cn(
                        "grid size-8 place-items-center rounded-md border font-mono text-xs transition-colors",
                        active
                          ? "border-primary-fill bg-primary-fill text-fg-on-primary"
                          : "border-border text-fg-muted hover:border-border-strong",
                      )}
                    >
                      {sdg.number}
                      <span className="sr-only">{sdg.title}</span>
                    </Link>
                  );
                })}
              </div>
            </FacetGroup>

            <FacetGroup title="Status">
              {(["completed", "archived", "progress", "review"] as const).map((status) => (
                <FacetLink
                  key={status}
                  href={facetHref("status", status)}
                  active={readFacet(params, "status").includes(status)}
                >
                  {status === "progress"
                    ? "In progress"
                    : status === "review"
                      ? "Under review"
                      : status[0]!.toUpperCase() + status.slice(1)}
                </FacetLink>
              ))}
            </FacetGroup>

            <FacetGroup title="College">
              {colleges.map((college) => (
                <FacetLink
                  key={college.slug}
                  href={facetHref("college", college.slug)}
                  active={readFacet(params, "college").includes(college.slug)}
                >
                  {college.shortName}
                </FacetLink>
              ))}
            </FacetGroup>

            <FacetGroup title="Year">
              {years.map((year) => (
                <FacetLink
                  key={year}
                  href={facetHref("year", String(year))}
                  active={readFacet(params, "year").includes(String(year))}
                >
                  {year}
                </FacetLink>
              ))}
            </FacetGroup>
          </aside>

          <div className="min-w-0">
            <p className="mb-5 text-sm text-fg-muted" aria-live="polite">
              {filtered.length} {filtered.length === 1 ? "project" : "projects"}
              {activeCount > 0 ? " matching your filters" : ""}
            </p>

            {shown.length === 0 ? (
              <EmptyState
                illustration={<NoResultsScene width={200} />}
                title="No projects match those filters"
                description="Try removing a filter, or browse a topic hub to see what exists in that area."
                action={
                  <Button asChild size="sm">
                    <Link href="/explore">Clear filters</Link>
                  </Button>
                }
                secondaryAction={
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/topics">Browse topics</Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((project) => (
                  <ProjectCard key={project.slug} project={project} />
                ))}
              </div>
            )}

            <Pagination page={page} totalPages={totalPages} hrefFor={pageHref} className="mt-10" />
          </div>
        </div>
      </Container>
    </>
  );
}

function FacetGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 border-t border-border pt-4">
      <h3 className="mb-2.5 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function FacetLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      className={cn(
        "block rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none",
        active ? "font-semibold text-primary-600" : "text-fg-muted",
      )}
    >
      {active ? (
        <Badge tone="primary" className="mr-1.5">
          ✓
        </Badge>
      ) : null}
      {children}
    </Link>
  );
}
