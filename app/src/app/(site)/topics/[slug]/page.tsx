import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NoResultsScene } from "@/components/illustrations";
import { Container, PageHeader, Prose } from "@/components/layout/primitives";
import { ProjectCard } from "@/components/project/project-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Accordion } from "@/components/ui/overlay";
import { Breadcrumbs } from "@/components/ui/navigation";
import { ALL_TOPICS, DOMAIN_BY_KEY, SUBTOPICS, TOPIC_BY_SLUG } from "@/config/taxonomy";
import { topicEditorial } from "@/content/knowledge";
import { projectsByTopic } from "@/lib/db/queries/public-projects";
import { JsonLd, breadcrumbList, faqPage, itemList } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * A topic hub.
 *
 * These carry **genuine editorial content** where we have it (`topicEditorial`),
 * because generating a thin shell per taxonomy node is exactly the doorway-page
 * pattern the spam policy prohibits. A topic without editorial copy renders its
 * taxonomy summary and its real project list and nothing else — honest rather
 * than padded.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_TOPICS.map((topic) => ({ slug: topic.slug }));
}

export async function generateMetadata(props: PageProps<"/topics/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const topic = TOPIC_BY_SLUG[slug];
  if (!topic)
    return buildMetadata({
      title: "Topic not found",
      description: "This topic does not exist on Nexivora.",
      path: `/topics/${slug}`,
      index: false,
    });

  const count = (await projectsByTopic(slug)).length;
  return buildMetadata({
    title: `${topic.name} student projects`,
    description: `${topic.summary} Browse ${count} documented ${topic.name.toLowerCase()} ${count === 1 ? "project" : "projects"} with methodology, results and named teams.`,
    path: `/topics/${slug}`,
  });
}

export default async function TopicPage(props: PageProps<"/topics/[slug]">) {
  const { slug } = await props.params;
  const topic = TOPIC_BY_SLUG[slug];
  if (!topic) notFound();

  const editorial = topicEditorial[slug];
  const projects = await projectsByTopic(slug);
  const domain = DOMAIN_BY_KEY[topic.domain];
  const children = SUBTOPICS.filter((t) => t.parent === slug);
  const isDomain = !topic.parent;

  const crumbs = [
    { label: "Topics", href: "/topics" },
    ...(isDomain ? [] : [{ label: domain.name, href: `/topics/${domain.slug}` }]),
    { label: topic.name, href: `/topics/${slug}` },
  ];

  return (
    <>
      <JsonLd
        data={[
          itemList(
            projects.map((p) => ({ name: p.title, url: `/projects/${p.slug}` })),
            { name: `${topic.name} projects` },
          ),
          breadcrumbList(crumbs),
          ...(editorial?.faqs?.length ? [faqPage(editorial.faqs)] : []),
        ]}
      />

      <Container className="py-10 md:py-12">
        <Breadcrumbs crumbs={crumbs} className="mb-6" />
        <PageHeader
          eyebrow={isDomain ? "Domain" : domain.name}
          title={`${topic.name} projects`}
          description={topic.summary}
        />

        {editorial?.intro ? (
          <Prose className="mt-6">
            <p>{editorial.intro}</p>
          </Prose>
        ) : null}

        {children.length > 0 ? (
          <div className="mt-8 flex flex-wrap gap-2">
            {children.map((child) => (
              <Link
                key={child.slug}
                href={`/topics/${child.slug}`}
                className="rounded-full border border-border px-3.5 py-1.5 text-sm text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
              >
                {child.name}
              </Link>
            ))}
          </div>
        ) : null}

        <section className="mt-10">
          <h2 className="font-display text-xl font-bold md:text-2xl">
            {projects.length} published {projects.length === 1 ? "project" : "projects"}
          </h2>

          {projects.length === 0 ? (
            <EmptyState
              className="mt-5"
              illustration={<NoResultsScene width={200} />}
              title="Nothing published here yet"
              description="No project in this topic has been published publicly. Browse the parent domain, or post an idea to start one."
              action={
                <Button asChild size="sm">
                  <Link href="/ideas">Browse ideas</Link>
                </Button>
              }
              secondaryAction={
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/topics/${domain.slug}`}>All {domain.name}</Link>
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

        {editorial?.faqs?.length ? (
          <section className="mt-14 max-w-3xl">
            <h2 className="font-display text-xl font-bold md:text-2xl">Common questions</h2>
            <Accordion
              className="mt-4"
              items={editorial.faqs.map((faq, i) => ({
                value: `faq-${i}`,
                trigger: faq.question,
                content: faq.answer,
              }))}
            />
          </section>
        ) : null}
      </Container>
    </>
  );
}
