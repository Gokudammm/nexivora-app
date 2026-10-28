import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RichText } from "@/components/content/rich-text";
import { AlertIcon, CheckCircleIcon } from "@/components/icons";
import { Container, PageHeader, Section } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/display";
import { Breadcrumbs } from "@/components/ui/navigation";
import { featureBySlug, featureDeepDives } from "@/content/features";
import { JsonLd, breadcrumbList } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamicParams = false;

export function generateStaticParams() {
  return featureDeepDives.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata(props: PageProps<"/features/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const feature = featureBySlug[slug];
  if (!feature) {
    return buildMetadata({
      title: "Feature not found",
      description: "This feature page does not exist on Nexivora.",
      path: `/features/${slug}`,
      index: false,
    });
  }

  return buildMetadata({
    title: feature.title,
    description: feature.description,
    path: `/features/${slug}`,
    keywords: feature.keywords,
  });
}

export default async function FeaturePage(props: PageProps<"/features/[slug]">) {
  const { slug } = await props.params;
  const feature = featureBySlug[slug];
  if (!feature) notFound();

  const others = featureDeepDives.filter((f) => f.slug !== slug);
  const crumbs = [
    { label: "Features", href: "/features" },
    { label: feature.title, href: `/features/${slug}` },
  ];

  return (
    <>
      <JsonLd data={breadcrumbList(crumbs)} />

      <Section className="pt-10 pb-4 md:pt-12">
        <Container width="reading">
          <Breadcrumbs crumbs={crumbs} className="mb-6" />
          <Badge tone="accent">{feature.eyebrow}</Badge>
          <PageHeader title={feature.title} description={feature.lead} className="mt-3" />

          <Card className="mt-8 flex gap-3 border-warning p-5">
            <AlertIcon size={20} className="mt-0.5 shrink-0 text-warning" />
            <div>
              <h2 className="text-sm font-semibold">The problem</h2>
              <p className="mt-1.5 text-sm text-fg-muted">{feature.problem}</p>
            </div>
          </Card>
        </Container>
      </Section>

      <Section className="pt-4">
        <Container width="reading">
          <div className="space-y-10">
            {feature.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="border-b border-border pb-2 font-display text-xl font-bold">
                  {section.heading}
                </h2>
                <RichText body={section.body} className="mt-4" />
              </section>
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="raised">
        <Container width="reading">
          <h2 className="font-display text-xl font-bold md:text-2xl">Decisions worth defending</h2>
          <p className="mt-2 text-sm text-fg-muted">
            The choices that are easy to get wrong, and the reasoning behind each.
          </p>
          <div className="mt-6 space-y-4">
            {feature.decisions.map((decision) => (
              <Card key={decision.title} className="flex gap-3 p-5">
                <CheckCircleIcon size={20} className="mt-0.5 shrink-0 text-accent-700" />
                <div>
                  <h3 className="text-base font-semibold">{decision.title}</h3>
                  <p className="mt-1.5 text-sm text-fg-muted">{decision.body}</p>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-12 border-t border-border pt-8">
            <h2 className="font-display text-lg font-bold">Read next</h2>
            <ul className="mt-3 space-y-2">
              {others.map((other) => (
                <li key={other.slug}>
                  <Link
                    href={`/features/${other.slug}`}
                    className="text-sm text-primary-600 underline-offset-4 hover:underline"
                  >
                    {other.title}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/explore">See it on real projects</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/features">All features</Link>
              </Button>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
