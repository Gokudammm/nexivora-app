import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RichText } from "@/components/content/rich-text";
import { Container } from "@/components/layout/primitives";
import { Alert } from "@/components/ui/feedback";
import { Breadcrumbs } from "@/components/ui/navigation";
import { legalBySlug, legalDocuments } from "@/content/legal";
import { JsonLd, breadcrumbList } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * The legal set.
 *
 * Each document opens with a **plain-language summary**, because a policy
 * nobody reads protects nobody. The formal text follows.
 *
 * These are indexable deliberately: an institution evaluating the platform
 * reads the privacy policy and the IP policy before anything else, and they
 * should be findable.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return legalDocuments.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata(props: PageProps<"/legal/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const doc = legalBySlug[slug];
  if (!doc) {
    return buildMetadata({
      title: "Document not found",
      description: "This legal document does not exist on Nexivora.",
      path: `/legal/${slug}`,
      index: false,
    });
  }

  return buildMetadata({
    title: doc.title,
    description: doc.description,
    path: `/legal/${slug}`,
  });
}

export default async function LegalPage(props: PageProps<"/legal/[slug]">) {
  const { slug } = await props.params;
  const doc = legalBySlug[slug];
  if (!doc) notFound();

  const crumbs = [
    { label: "Legal", href: "/legal/terms" },
    { label: doc.title, href: `/legal/${slug}` },
  ];

  return (
    <>
      <JsonLd data={breadcrumbList(crumbs)} />
      <Container width="reading" className="py-10 md:py-12">
        <Breadcrumbs crumbs={crumbs} className="mb-6" />

        <h1 className="font-display text-3xl font-bold md:text-4xl">{doc.title}</h1>
        <p className="mt-3 text-sm text-fg-subtle">
          Last updated{" "}
          <time dateTime={doc.updatedOn}>
            {new Date(doc.updatedOn).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
        </p>

        <Alert tone="info" title="In plain language" className="mt-6">
          {doc.summary}
        </Alert>

        <RichText body={doc.body} className="mt-8" />

        <nav aria-label="Other legal documents" className="mt-12 border-t border-border pt-6">
          <h2 className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">
            Other documents
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {legalDocuments
              .filter((d) => d.slug !== slug)
              .map((d) => (
                <li key={d.slug}>
                  <Link
                    href={`/legal/${d.slug}`}
                    className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline"
                  >
                    {d.title}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      </Container>
    </>
  );
}
