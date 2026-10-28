import type { Metadata } from "next";
import Link from "next/link";

import { CollegeIcon } from "@/components/icons";
import { Container, PageHeader } from "@/components/layout/primitives";
import { Badge, Card } from "@/components/ui/display";
import { Breadcrumbs } from "@/components/ui/navigation";
import { ANONYMOUS } from "@/lib/authz/viewer";
import { listColleges } from "@/lib/db/queries/institution";
import { countProjects } from "@/lib/db/queries/projects";
import { JsonLd, breadcrumbList, itemList } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * The college directory.
 *
 * **Only verified colleges appear here.** An institution that has registered
 * but not completed verification works normally for its own members and is
 * absent from every public surface — that gate is what makes the network's
 * trust mean anything (docs/SECURITY.md §8).
 *
 * Reads the database as of Phase 5. It is rendered for `ANONYMOUS` rather than
 * for the signed-in viewer on purpose: this page is what the public and the
 * crawler see, and the counts on it must match the sitemap. A member of an
 * unverified college sees their own college through the admin console, not by
 * having this page quietly differ for them.
 */
export const metadata: Metadata = buildMetadata({
  title: "Colleges on Nexivora",
  description:
    "Verified institutions publishing student project work on Nexivora, with their departments, archives and public project counts.",
  path: "/colleges",
});

export default async function CollegesPage() {
  const colleges = await listColleges(ANONYMOUS);

  // Counted through the same predicate the listings use, so the number on the
  // badge always matches what clicking through actually shows.
  const counts = await Promise.all(
    colleges.map((college) => countProjects(ANONYMOUS, { collegeId: college.id })),
  );

  const crumbs = [{ label: "Colleges", href: "/colleges" }];

  return (
    <>
      <JsonLd
        data={[
          itemList(
            colleges.map((c) => ({ name: c.name, url: `/colleges/${c.slug}` })),
            { name: "Verified colleges" },
          ),
          breadcrumbList(crumbs),
        ]}
      />
      <Container className="py-10 md:py-12">
        <Breadcrumbs crumbs={crumbs} className="mb-6" />
        <PageHeader
          eyebrow="Institutions"
          title="Colleges on Nexivora"
          description="Every institution here has completed verification. Until it does, nothing from a college is publicly visible — which is what keeps the archive trustworthy."
        />

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {colleges.map((college, index) => {
            const projectCount = counts[index] ?? 0;

            return (
              <Card key={college.slug} interactive className="relative p-6">
                <div className="flex items-start gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-600">
                    <CollegeIcon size={24} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-lg leading-snug font-semibold">
                      <Link
                        href={`/colleges/${college.slug}`}
                        className="after:absolute after:inset-0"
                      >
                        {college.name}
                      </Link>
                    </h2>
                    <p className="mt-0.5 text-sm text-fg-subtle">
                      {college.city}, {college.state}
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-sm text-fg-muted">{college.description}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone="accent">Verified</Badge>
                  <Badge tone="outline">
                    {projectCount} public {projectCount === 1 ? "project" : "projects"}
                  </Badge>
                  <Badge tone="outline">{college._count.departments} departments</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      </Container>
    </>
  );
}
