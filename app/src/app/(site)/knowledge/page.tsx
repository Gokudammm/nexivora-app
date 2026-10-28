import type { Metadata } from "next";
import Link from "next/link";

import { ClockIcon } from "@/components/icons";
import { Container, PageHeader } from "@/components/layout/primitives";
import { Badge, Card } from "@/components/ui/display";
import { Breadcrumbs } from "@/components/ui/navigation";
import { knowledgeSections } from "@/content/knowledge";
import { publicArticles } from "@/content";
import { JsonLd, breadcrumbList, itemList } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Knowledge hub",
  description:
    "Practical guidance on doing academic project work well — choosing a project, writing it up, working in a team, and publishing work that lasts.",
  path: "/knowledge",
});

export default function KnowledgePage() {
  const articles = publicArticles();
  const crumbs = [{ label: "Knowledge", href: "/knowledge" }];

  return (
    <>
      <JsonLd
        data={[
          itemList(
            articles.map((a) => ({ name: a.title, url: `/knowledge/${a.slug}` })),
            { name: "Nexivora knowledge hub" },
          ),
          breadcrumbList(crumbs),
        ]}
      />
      <Container className="py-10 md:py-12">
        <Breadcrumbs crumbs={crumbs} className="mb-6" />
        <PageHeader
          eyebrow="Knowledge hub"
          title="How to do project work well"
          description="Written from the perspective of the people who supervise and evaluate this work — what actually goes wrong, and what to do instead."
        />

        <div className="mt-10 space-y-12">
          {knowledgeSections.map((section) => {
            const inSection = articles.filter((a) => a.section === section);
            return (
              <section key={section}>
                <h2 className="border-b border-border pb-2 font-display text-xl font-bold">
                  {section}
                </h2>
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  {inSection.map((article) => (
                    <Card key={article.slug} interactive className="relative p-5">
                      <h3 className="font-display text-lg leading-snug font-semibold">
                        <Link
                          href={`/knowledge/${article.slug}`}
                          className="after:absolute after:inset-0"
                        >
                          {article.title}
                        </Link>
                      </h3>
                      <p className="mt-2 text-sm text-fg-muted">{article.description}</p>
                      <p className="mt-4 flex items-center gap-1.5 text-xs text-fg-subtle">
                        <ClockIcon size={14} />
                        {article.readingMinutes} min read
                      </p>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <section className="mt-14">
          <h2 className="font-display text-xl font-bold">Browse by topic</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {[...new Set(articles.flatMap((a) => a.keywords))].slice(0, 16).map((keyword) => (
              <Badge key={keyword} tone="outline" size="md">
                {keyword}
              </Badge>
            ))}
          </div>
        </section>
      </Container>
    </>
  );
}
