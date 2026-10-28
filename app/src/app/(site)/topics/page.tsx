import type { Metadata } from "next";
import Link from "next/link";

import { Container, PageHeader } from "@/components/layout/primitives";
import { Card } from "@/components/ui/display";
import { Breadcrumbs } from "@/components/ui/navigation";
import { DOMAINS, SUBTOPICS } from "@/config/taxonomy";
import { publicProjectCorpus } from "@/lib/db/queries/public-projects";
import { JsonLd, breadcrumbList, definedTermSet } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Project topics",
  description:
    "Browse documented student projects by domain — AI, software, hardware, healthcare, education, sustainability, social impact and research.",
  path: "/topics",
});

export default async function TopicsPage() {
  // Counted from a single corpus read rather than one query per domain — the
  // per-domain call inside the loop below would have been eight round trips
  // for a page that needs one.
  const corpus = await publicProjectCorpus();
  const countFor = (slug: string) =>
    corpus.filter((project) => project.topics.includes(slug)).length;

  const crumbs = [{ label: "Topics", href: "/topics" }];

  return (
    <>
      <JsonLd
        data={[
          definedTermSet({
            name: "Nexivora project domains",
            description: "The domain taxonomy used to classify student project work.",
            terms: DOMAINS.map((d) => ({ name: d.name, description: d.summary, slug: d.slug })),
          }),
          breadcrumbList(crumbs),
        ]}
      />
      <Container className="py-10 md:py-12">
        <Breadcrumbs crumbs={crumbs} className="mb-6" />
        <PageHeader
          eyebrow="Topics"
          title="Browse by domain"
          description="Eight domains, each with sub-topics. Every hub lists the real projects published in that area, not a generated shell."
        />

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DOMAINS.map((domain) => {
            const count = countFor(domain.slug);
            const children = SUBTOPICS.filter((t) => t.parent === domain.slug);
            return (
              <Card key={domain.slug} interactive className="relative p-5">
                <span
                  aria-hidden
                  className="mb-3 block h-1 w-10 rounded-full"
                  style={{ backgroundColor: `var(${domain.colorVar})` }}
                />
                <h2 className="font-display text-lg font-semibold">
                  <Link href={`/topics/${domain.slug}`} className="after:absolute after:inset-0">
                    {domain.name}
                  </Link>
                </h2>
                <p className="mt-2 text-sm text-fg-muted">{domain.summary}</p>
                <p className="mt-3 text-xs text-fg-subtle">
                  {count} {count === 1 ? "project" : "projects"} · {children.length} sub-topics
                </p>
              </Card>
            );
          })}
        </div>

        <section className="mt-14">
          <h2 className="font-display text-xl font-bold md:text-2xl">All sub-topics</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {SUBTOPICS.map((topic) => (
              <Link
                key={topic.slug}
                href={`/topics/${topic.slug}`}
                className="rounded-full border border-border px-3.5 py-1.5 text-sm text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
              >
                {topic.name}
              </Link>
            ))}
          </div>
        </section>
      </Container>
    </>
  );
}
