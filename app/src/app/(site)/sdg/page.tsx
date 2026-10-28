import type { Metadata } from "next";
import Link from "next/link";

import { Container, PageHeader } from "@/components/layout/primitives";
import { Card } from "@/components/ui/display";
import { Breadcrumbs } from "@/components/ui/navigation";
import { SDGS, sdgPath } from "@/config/taxonomy";
import { publicProjectCorpus } from "@/lib/db/queries/public-projects";
import { JsonLd, breadcrumbList, itemList } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Student projects by SDG",
  description:
    "Student project work mapped to the 17 UN Sustainable Development Goals — with the honest, specific tagging that makes SDG reporting mean something.",
  path: "/sdg",
});

export default async function SdgIndexPage() {
  // One corpus read; seventeen goals counted from it.
  const corpus = await publicProjectCorpus();
  const countFor = (goal: number) => corpus.filter((project) => project.sdgs.includes(goal)).length;

  const crumbs = [{ label: "SDG showcase", href: "/sdg" }];

  return (
    <>
      <JsonLd
        data={[
          itemList(
            SDGS.map((s) => ({ name: `SDG ${s.number}: ${s.title}`, url: sdgPath(s.number) })),
            { name: "Sustainable Development Goals" },
          ),
          breadcrumbList(crumbs),
        ]}
      />
      <Container className="py-10 md:py-12">
        <Breadcrumbs crumbs={crumbs} className="mb-6" />
        <PageHeader
          eyebrow="Impact"
          title="Projects by Sustainable Development Goal"
          description="Institutions now report formally on how student work contributes to the SDGs. This is that data, tagged at the project level — and tagged honestly."
        />

        <p className="mt-6 max-w-2xl text-sm text-fg-muted">
          Most projects here claim one primary goal and one or two genuine secondary ones. Claiming
          six goals for a project that touches one is why SDG reporting has a credibility problem,
          and it makes every other tag less useful.{" "}
          <Link
            href="/knowledge/sdg-alignment-for-student-projects"
            className="text-primary-600 hover:underline"
          >
            How we map projects to goals
          </Link>
          .
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SDGS.map((sdg) => {
            const count = countFor(sdg.number);
            return (
              <Card key={sdg.number} interactive className="relative flex gap-4 p-5">
                <span
                  aria-hidden
                  className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent-fill font-display text-lg font-bold text-fg-on-accent"
                >
                  {sdg.number}
                </span>
                <span className="min-w-0">
                  <h2 className="font-display text-base leading-snug font-semibold">
                    <Link href={sdgPath(sdg.number)} className="after:absolute after:inset-0">
                      {sdg.title}
                    </Link>
                  </h2>
                  <p className="mt-1.5 text-sm text-fg-muted">{sdg.summary}</p>
                  <p className="mt-2 text-xs text-fg-subtle">
                    {count} {count === 1 ? "project" : "projects"}
                  </p>
                </span>
              </Card>
            );
          })}
        </div>
      </Container>
    </>
  );
}
