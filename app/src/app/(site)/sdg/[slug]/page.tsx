import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NoResultsScene } from "@/components/illustrations";
import { Container, PageHeader } from "@/components/layout/primitives";
import { ProjectCard } from "@/components/project/project-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Breadcrumbs } from "@/components/ui/navigation";
import { SDGS, sdgPath } from "@/config/taxonomy";
import { projectsBySdg } from "@/lib/db/queries/public-projects";
import { JsonLd, breadcrumbList, itemList } from "@/lib/seo/jsonld";
import { buildMetadata, ensureDescription } from "@/lib/seo/metadata";

export const dynamicParams = false;

/** URL shape is `/sdg/6-clean-water` — the number is part of the slug. */
export function generateStaticParams() {
  return SDGS.map((s) => ({ slug: `${s.number}-${s.slug}` }));
}

function sdgFromSlug(slug: string) {
  const number = Number(slug.split("-")[0]);
  return SDGS.find((s) => s.number === number && `${s.number}-${s.slug}` === slug);
}

export async function generateMetadata(props: PageProps<"/sdg/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const sdg = sdgFromSlug(slug);
  if (!sdg)
    return buildMetadata({
      title: "Goal not found",
      description: "This Sustainable Development Goal page does not exist.",
      path: `/sdg/${slug}`,
      index: false,
    });

  const count = (await projectsBySdg(sdg.number)).length;
  return buildMetadata({
    title: `SDG ${sdg.number}: ${sdg.title}`,
    description: ensureDescription(
      `${count} documented student ${count === 1 ? "project" : "projects"} contributing to SDG ${sdg.number}, ${sdg.title}. ${sdg.summary}`,
      "Tagged honestly at project level, so the mapping means something.",
    ),
    path: sdgPath(sdg.number),
    og: { eyebrow: `Sustainable Development Goal ${sdg.number}` },
  });
}

export default async function SdgPage(props: PageProps<"/sdg/[slug]">) {
  const { slug } = await props.params;
  const sdg = sdgFromSlug(slug);
  if (!sdg) notFound();

  const projects = await projectsBySdg(sdg.number);
  const crumbs = [
    { label: "SDG showcase", href: "/sdg" },
    { label: `SDG ${sdg.number}`, href: sdgPath(sdg.number) },
  ];

  return (
    <>
      <JsonLd
        data={[
          itemList(
            projects.map((p) => ({ name: p.title, url: `/projects/${p.slug}` })),
            { name: `Projects contributing to SDG ${sdg.number}` },
          ),
          breadcrumbList(crumbs),
        ]}
      />
      <Container className="py-10 md:py-12">
        <Breadcrumbs crumbs={crumbs} className="mb-6" />
        <div className="flex items-start gap-5">
          <span
            aria-hidden
            className="grid size-16 shrink-0 place-items-center rounded-xl bg-accent-fill font-display text-2xl font-bold text-fg-on-accent"
          >
            {sdg.number}
          </span>
          <PageHeader
            eyebrow={`Sustainable Development Goal ${sdg.number}`}
            title={sdg.title}
            description={sdg.summary}
          />
        </div>

        <section className="mt-10">
          <h2 className="font-display text-xl font-bold md:text-2xl">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </h2>
          {projects.length === 0 ? (
            <EmptyState
              className="mt-5"
              illustration={<NoResultsScene width={200} />}
              title="No published projects tagged to this goal yet"
              description="Nothing has been published against this goal. That is an accurate reflection of the archive rather than a gap in the page."
              action={
                <Button asChild size="sm">
                  <Link href="/sdg">All goals</Link>
                </Button>
              }
              secondaryAction={
                <Button asChild size="sm" variant="ghost">
                  <Link href="/explore">Explore projects</Link>
                </Button>
              }
            />
          ) : (
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard key={project.slug} project={project} />
              ))}
            </div>
          )}
        </section>
      </Container>
    </>
  );
}
