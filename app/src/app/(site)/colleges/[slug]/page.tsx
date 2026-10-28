import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CollegeIcon } from "@/components/icons";
import { Container, PageHeader } from "@/components/layout/primitives";
import { ProjectCard } from "@/components/project/project-card";
import { Avatar, Badge, Card } from "@/components/ui/display";
import { Breadcrumbs } from "@/components/ui/navigation";
import { SDG_BY_NUMBER, sdgPath } from "@/config/taxonomy";
import { ANONYMOUS } from "@/lib/authz/viewer";
import { toContentProjectCard } from "@/lib/db/queries/adapters";
import { getCollege, publicCollegeSlugs, publicDirectory } from "@/lib/db/queries/institution";
import { listProjects } from "@/lib/db/queries/projects";
import { JsonLd, breadcrumbList, collegeOrUniversity, itemList } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * A college's public page.
 *
 * Reads the database as of Phase 5, rendered for `ANONYMOUS` — this is what the
 * public and the crawler see. An unverified college resolves to nothing here,
 * which is the anti-abuse gate working: its members reach it through the admin
 * console instead.
 */
export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = await publicCollegeSlugs(ANONYMOUS);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/colleges/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const college = await getCollege(ANONYMOUS, slug);

  if (!college) {
    return buildMetadata({
      title: "College not found",
      description: "This institution is not publicly listed on Nexivora.",
      path: `/colleges/${slug}`,
      index: false,
    });
  }

  const projects = await listProjects(ANONYMOUS, { collegeId: college.id, take: 500 });

  return buildMetadata({
    title: `${college.shortName} student projects`,
    description: `${projects.length} documented student ${projects.length === 1 ? "project" : "projects"} published by ${college.name}, ${college.city} — with methodology, results and faculty attestation.`,
    path: `/colleges/${slug}`,
  });
}

export default async function CollegePage(props: PageProps<"/colleges/[slug]">) {
  const { slug } = await props.params;
  const college = await getCollege(ANONYMOUS, slug);
  if (!college) notFound();

  const [rows, directory] = await Promise.all([
    listProjects(ANONYMOUS, { collegeId: college.id, take: 500 }),
    publicDirectory(college.id, 24),
  ]);

  const projects = rows.map((row) => toContentProjectCard(row));
  const faculty = directory.filter((person) =>
    person.memberships.some((membership) => membership.role === "FACULTY"),
  );

  const sdgCoverage = [...new Set(rows.flatMap((row) => row.sdgs.map((sdg) => sdg.goal)))].sort(
    (a, b) => a - b,
  );

  const crumbs = [
    { label: "Colleges", href: "/colleges" },
    { label: college.shortName, href: `/colleges/${slug}` },
  ];

  return (
    <>
      <JsonLd
        data={[
          collegeOrUniversity({
            name: college.name,
            slug: college.slug,
            description: college.description,
            city: college.city,
            state: college.state,
            website: college.website ?? undefined,
            foundingDate: college.foundingDate ?? undefined,
          }),
          itemList(
            projects.map((p) => ({ name: p.title, url: `/projects/${p.slug}` })),
            { name: `Projects from ${college.name}` },
          ),
          breadcrumbList(crumbs),
        ]}
      />

      <Container className="py-10 md:py-12">
        <Breadcrumbs crumbs={crumbs} className="mb-6" />

        <div className="flex items-start gap-5">
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-600">
            <CollegeIcon size={28} />
          </span>
          <PageHeader
            eyebrow={`${college.city}, ${college.state}`}
            title={college.name}
            description={college.description}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Badge tone="accent">Verified institution</Badge>
          {college.website ? (
            <a href={college.website} rel="ugc noopener">
              <Badge tone="outline">Official website</Badge>
            </a>
          ) : null}
        </div>

        <dl className="mt-8 grid gap-5 rounded-lg border border-border p-5 sm:grid-cols-4">
          <div>
            <dt className="text-xs tracking-wide text-fg-subtle uppercase">Public projects</dt>
            <dd className="mt-1 font-display text-2xl font-bold">{projects.length}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-fg-subtle uppercase">Departments</dt>
            <dd className="mt-1 font-display text-2xl font-bold">{college.departments.length}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-fg-subtle uppercase">SDGs covered</dt>
            <dd className="mt-1 font-display text-2xl font-bold">{sdgCoverage.length}</dd>
          </div>
          <div>
            <dt className="text-xs tracking-wide text-fg-subtle uppercase">Public profiles</dt>
            <dd className="mt-1 font-display text-2xl font-bold">{directory.length}</dd>
          </div>
        </dl>

        <section className="mt-12">
          <h2 className="font-display text-xl font-bold md:text-2xl">Departments</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {college.departments.map((dept) => (
              <Badge key={dept.id} tone="outline" size="md">
                {dept.name}
              </Badge>
            ))}
          </div>
        </section>

        {sdgCoverage.length > 0 ? (
          <section className="mt-12">
            <h2 className="font-display text-xl font-bold md:text-2xl">SDG coverage</h2>
            <p className="mt-2 text-sm text-fg-muted">
              Goals this college&rsquo;s published work contributes to. This is the data an
              accreditation report is built from.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {sdgCoverage.map((goal) => (
                <Link
                  key={goal}
                  href={sdgPath(goal)}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:border-border-strong"
                >
                  <span className="grid size-6 place-items-center rounded bg-accent-fill font-mono text-xs font-bold text-fg-on-accent">
                    {goal}
                  </span>
                  {SDG_BY_NUMBER[goal]?.title}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {faculty.length > 0 ? (
          <section className="mt-12">
            <h2 className="font-display text-xl font-bold md:text-2xl">Faculty</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {faculty.map((person) => (
                <Card key={person.username} interactive className="relative flex gap-3 p-4">
                  <Avatar name={person.name} seed={person.username} size="md" verified />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      <Link href={`/p/${person.username}`} className="after:absolute after:inset-0">
                        {person.name}
                      </Link>
                    </p>
                    <p className="mt-1.5 line-clamp-2 text-xs text-fg-muted">{person.headline}</p>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-12">
          <h2 className="font-display text-xl font-bold md:text-2xl">
            Published projects ({projects.length})
          </h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.slug} project={project} showCollege={false} />
            ))}
          </div>
        </section>
      </Container>
    </>
  );
}
