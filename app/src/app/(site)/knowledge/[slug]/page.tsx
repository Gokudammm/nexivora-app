import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RichText } from "@/components/content/rich-text";
import { ClockIcon } from "@/components/icons";
import { Container } from "@/components/layout/primitives";
import { Badge, Card } from "@/components/ui/display";
import { Breadcrumbs } from "@/components/ui/navigation";
import { articleBySlug, articles } from "@/content/knowledge";
import { JsonLd, article as articleJsonLd, breadcrumbList } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamicParams = false;

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata(props: PageProps<"/knowledge/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const entry = articleBySlug[slug];
  if (!entry) {
    return buildMetadata({
      title: "Article not found",
      description: "This article does not exist on Nexivora.",
      path: `/knowledge/${slug}`,
      index: false,
    });
  }

  return buildMetadata({
    title: entry.title,
    description: entry.description,
    path: `/knowledge/${slug}`,
    type: "article",
    keywords: entry.keywords,
    authors: [entry.author],
    publishedTime: entry.publishedOn,
    modifiedTime: entry.updatedOn ?? entry.publishedOn,
  });
}

export default async function ArticlePage(props: PageProps<"/knowledge/[slug]">) {
  const { slug } = await props.params;
  const entry = articleBySlug[slug];
  if (!entry) notFound();

  const related = (entry.related ?? [])
    .map((s) => articleBySlug[s])
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const crumbs = [
    { label: "Knowledge", href: "/knowledge" },
    { label: entry.title, href: `/knowledge/${slug}` },
  ];

  return (
    <>
      <JsonLd
        data={[
          articleJsonLd({
            title: entry.title,
            slug: entry.slug,
            description: entry.description,
            datePublished: entry.publishedOn,
            dateModified: entry.updatedOn,
            author: entry.author,
            section: entry.section,
            keywords: entry.keywords,
            wordCount: entry.body.split(/\s+/).length,
          }),
          breadcrumbList(crumbs),
        ]}
      />

      <Container width="reading" className="py-10 md:py-12">
        <Breadcrumbs crumbs={crumbs} className="mb-6" />

        <article>
          <header>
            <Badge tone="primary">{entry.section}</Badge>
            <h1 className="mt-3 font-display text-3xl font-bold md:text-4xl">{entry.title}</h1>
            <p className="mt-4 text-base text-fg-muted md:text-lg">{entry.description}</p>
            <div className="mt-5 flex flex-wrap items-center gap-4 border-b border-border pb-5 text-sm text-fg-subtle">
              <span className="flex items-center gap-1.5">
                <ClockIcon size={14} />
                {entry.readingMinutes} min read
              </span>
              <time dateTime={entry.publishedOn}>
                {new Date(entry.publishedOn).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </time>
              {entry.updatedOn ? <span>Updated {entry.updatedOn}</span> : null}
            </div>
          </header>

          <RichText body={entry.body} className="mt-8" />
        </article>

        {related.length > 0 ? (
          <section className="mt-12 border-t border-border pt-8">
            <h2 className="font-display text-xl font-bold">Related reading</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {related.map((item) => (
                <Card key={item.slug} interactive className="relative p-5">
                  <h3 className="text-base leading-snug font-semibold">
                    <Link href={`/knowledge/${item.slug}`} className="after:absolute after:inset-0">
                      {item.title}
                    </Link>
                  </h3>
                  <p className="mt-2 text-sm text-fg-muted">{item.description}</p>
                </Card>
              ))}
            </div>
          </section>
        ) : null}
      </Container>
    </>
  );
}
