import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RichText } from "@/components/content/rich-text";
import { Container } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/display";
import { Breadcrumbs } from "@/components/ui/navigation";
import { helpArticles, helpBySlug } from "@/content/site";
import { siteConfig } from "@/config/site";
import { JsonLd, breadcrumbList } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamicParams = false;

export function generateStaticParams() {
  return helpArticles.map((h) => ({ slug: h.slug }));
}

export async function generateMetadata(props: PageProps<"/help/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const entry = helpBySlug[slug];
  if (!entry) {
    return buildMetadata({
      title: "Help article not found",
      description: "This help article does not exist on Nexivora.",
      path: `/help/${slug}`,
      index: false,
    });
  }

  return buildMetadata({
    title: entry.title,
    description: entry.description,
    path: `/help/${slug}`,
    type: "article",
  });
}

export default async function HelpArticlePage(props: PageProps<"/help/[slug]">) {
  const { slug } = await props.params;
  const entry = helpBySlug[slug];
  if (!entry) notFound();

  const siblings = helpArticles.filter((h) => h.audience === entry.audience && h.slug !== slug);
  const crumbs = [
    { label: "Help", href: "/help" },
    { label: entry.title, href: `/help/${slug}` },
  ];

  return (
    <>
      <JsonLd data={breadcrumbList(crumbs)} />
      <Container width="reading" className="py-10 md:py-12">
        <Breadcrumbs crumbs={crumbs} className="mb-6" />

        <article>
          <Badge tone="primary" className="capitalize">
            {entry.audience === "everyone" ? "Everyone" : entry.audience}
          </Badge>
          <h1 className="mt-3 font-display text-3xl font-bold md:text-4xl">{entry.title}</h1>
          <p className="mt-3 text-base text-fg-muted md:text-lg">{entry.description}</p>

          <RichText body={entry.body} className="mt-8" />
        </article>

        {siblings.length > 0 ? (
          <nav aria-label="Related help" className="mt-12 border-t border-border pt-6">
            <h2 className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">
              More on this
            </h2>
            <ul className="mt-3 space-y-2">
              {siblings.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/help/${item.slug}`}
                    className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <p className="mt-8 text-sm text-fg-subtle">
          Something wrong or missing here?{" "}
          <a
            href={`mailto:${siteConfig.contact.support}`}
            className="text-primary-600 hover:underline"
          >
            Tell us
          </a>
          .
        </p>
      </Container>
    </>
  );
}
