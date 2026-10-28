import type { Metadata } from "next";

import { Container, PageHeader, Section } from "@/components/layout/primitives";
import { Badge, Card } from "@/components/ui/display";
import { Breadcrumbs } from "@/components/ui/navigation";
import { changelog } from "@/content/site";
import { JsonLd, breadcrumbList } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Changelog",
  description:
    "What has actually shipped in Nexivora, phase by phase — including the defects found and fixed, because a changelog of only features is marketing.",
  path: "/changelog",
});

const TONE = { added: "success", changed: "primary", fixed: "warning" } as const;

export default function ChangelogPage() {
  const crumbs = [{ label: "Changelog", href: "/changelog" }];

  return (
    <>
      <JsonLd data={breadcrumbList(crumbs)} />

      <Section className="pt-10 pb-4 md:pt-12">
        <Container width="reading">
          <Breadcrumbs crumbs={crumbs} className="mb-6" />
          <PageHeader
            eyebrow="Changelog"
            title="What has actually shipped"
            description="Including the things that were wrong and got fixed. A public changelog builds more credibility with academic users than a polished feature list does."
          />
        </Container>
      </Section>

      <Section className="pt-4">
        <Container width="reading">
          <div className="space-y-6">
            {changelog.map((entry) => (
              <Card key={entry.version} className="p-6">
                <div className="flex flex-wrap items-baseline gap-3">
                  <h2 className="font-display text-lg font-semibold">{entry.title}</h2>
                  <Badge tone="outline">{entry.version}</Badge>
                  <time dateTime={entry.date} className="text-sm text-fg-subtle">
                    {new Date(entry.date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>
                </div>

                <ul className="mt-4 space-y-2.5">
                  {entry.items.map((item) => (
                    <li key={item.text} className="flex gap-3 text-sm">
                      <Badge tone={TONE[item.kind]} className="shrink-0 capitalize">
                        {item.kind}
                      </Badge>
                      <span className="text-fg-muted">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
