import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RichText } from "@/components/content/rich-text";
import {
  ArchiveIcon,
  CalendarIcon,
  CitationIcon,
  CodeIcon,
  ExternalIcon,
  FacultyIcon,
  LineageIcon,
  LockIcon,
  SdgIcon,
} from "@/components/icons";
import { GeneratedProjectCover } from "@/components/illustrations/generated";
import { Container } from "@/components/layout/primitives";
import { ProjectRow } from "@/components/project/project-card";
import { Avatar, Badge, Card, Divider, StatusPill, TierBadge } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import { Breadcrumbs } from "@/components/ui/navigation";
import { CopyButton } from "@/components/ui/combobox";
import { DOMAIN_BY_KEY, SDG_BY_NUMBER, TOPIC_BY_SLUG, sdgPath } from "@/config/taxonomy";
import { collegeBySlug } from "@/content/colleges";
import { personByUsername } from "@/content/people";
import { projectVisibility } from "@/content";
import {
  descendantCount,
  publicLineage,
  publicProject,
  publicProjectCorpus,
  relatedProjects,
} from "@/lib/db/queries/public-projects";
import { SECTION_LABEL } from "@/content/types";
import { JsonLd, breadcrumbList, creativeWork } from "@/lib/seo/jsonld";
import { buildMetadata, ensureDescription } from "@/lib/seo/metadata";

/**
 * The public project page — **the highest-value template in the product**.
 *
 * It is what ranks, what gets shared, and what a company sees. Three decisions
 * shape it:
 *
 *  1. **Every section is a real `<h2>` block.** This is what makes the page
 *     eligible for featured snippets, and it is why Phase 3 models sections as
 *     rows rather than one JSON blob (ADR-009).
 *  2. **An embargoed project renders its head and withholds its body.** The
 *     work can be *cited* without being *disclosed* — the whole point of the
 *     embargo control.
 *  3. **Structured data mirrors the visible text**, never more.
 */

export const dynamicParams = false;

export async function generateStaticParams() {
  // The corpus is already `visibleTo(ANONYMOUS)`, so there is no second filter
  // here — adding one would be a second place deciding what is public, and the
  // two would eventually disagree.
  const corpus = await publicProjectCorpus();
  return corpus.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata(props: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const project = await publicProject(slug);
  if (!project)
    return buildMetadata({
      title: "Project not found",
      description: "This project is not available publicly.",
      path: `/projects/${slug}`,
      index: false,
    });

  const college = collegeBySlug[project.collegeSlug];
  const domain = DOMAIN_BY_KEY[project.domain];

  return buildMetadata({
    // No domain suffix: project titles are long enough on their own, and the
    // content title is the signal.
    title: project.title,
    description: ensureDescription(
      project.summary,
      `A ${domain.name.toLowerCase()} project from ${college?.shortName ?? "a verified college"}, with full methodology and results.`,
    ),
    path: `/projects/${project.slug}`,
    type: "article",
    og: {
      eyebrow: domain.name,
      chips: [college?.shortName ?? "", ...project.sdgs.slice(0, 2).map((n) => `SDG ${n}`)].filter(
        Boolean,
      ),
      accent: project.domain,
    },
    keywords: project.keywords,
    authors: project.members.map((m) => personByUsername[m.username]?.name ?? m.username),
    publishedTime: project.publishedOn,
    modifiedTime: project.completedOn ?? project.publishedOn,
    index: projectVisibility(project).indexable,
  });
}

export default async function ProjectPage(props: PageProps<"/projects/[slug]">) {
  const { slug } = await props.params;
  const project = await publicProject(slug);
  if (!project) notFound();

  const resolved = projectVisibility(project);
  const college = collegeBySlug[project.collegeSlug];
  const domain = DOMAIN_BY_KEY[project.domain];
  const [{ parents, children }, related, builtOn] = await Promise.all([
    publicLineage(project),
    relatedProjects(project),
    descendantCount(project.slug),
  ]);

  const crumbs = [
    { label: "Explore", href: "/explore" },
    { label: domain.name, href: `/topics/${domain.slug}` },
    { label: project.title, href: `/projects/${project.slug}` },
  ];

  const citation = project.citationId
    ? `${project.members.map((m) => personByUsername[m.username]?.name ?? m.username).join(", ")} (${new Date(project.publishedOn ?? project.startedOn).getFullYear()}). ${project.title}. ${college?.name ?? ""}. Nexivora ${project.citationId}.`
    : null;

  return (
    <>
      <JsonLd
        data={[
          creativeWork({
            title: project.title,
            slug: project.slug,
            abstract: project.abstract,
            datePublished: project.publishedOn,
            dateModified: project.completedOn ?? project.publishedOn,
            authors: project.members.map((m) => ({
              name: personByUsername[m.username]?.name ?? m.username,
              username:
                personByUsername[m.username]?.visibility === "PUBLIC" ? m.username : undefined,
            })),
            college: college ? { name: college.name, slug: college.slug } : undefined,
            topics: project.topics.map((t) => TOPIC_BY_SLUG[t]?.name ?? t),
            keywords: project.keywords,
            citationId: project.citationId,
            repositoryUrl: project.repositoryUrl,
            scholarly: project.domain === "research",
          }),
          breadcrumbList(crumbs),
        ]}
      />

      <Container className="py-8 md:py-10">
        <Breadcrumbs crumbs={crumbs} className="mb-6" />

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* ------------------------------------------------------ main */}
          <article className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
              <span
                className="text-sm font-semibold tracking-wide uppercase"
                style={{ color: `var(${domain.colorVar})` }}
              >
                {domain.name}
              </span>
              <StatusPill status={project.status} />
              {resolved.embargoed ? (
                <Badge tone="warning">
                  <LockIcon size={12} /> Under embargo
                </Badge>
              ) : null}
            </div>

            <h1 className="font-display text-3xl font-bold md:text-4xl">{project.title}</h1>
            <p className="mt-4 text-base text-fg-muted md:text-lg">{project.abstract}</p>

            {/* A banner, not a 16:9 block: at full column width a 16:9 cover
                renders ~480px tall and dominates the page above the problem
                statement, which is what the reader is actually here for. */}
            <div className="mt-6 aspect-[3/1] overflow-hidden rounded-lg border border-border">
              <GeneratedProjectCover
                seed={project.slug}
                title={project.title}
                domain={project.domain}
                sdgs={project.sdgs}
                className="h-full w-full"
              />
            </div>

            {project.metrics && project.metrics.length > 0 ? (
              <dl className="mt-6 grid gap-4 rounded-lg border border-border p-5 sm:grid-cols-3">
                {project.metrics.map((metric) => (
                  <div key={metric.label}>
                    <dt className="text-xs tracking-wide text-fg-subtle uppercase">
                      {metric.label}
                    </dt>
                    <dd className="mt-1 font-display text-xl font-bold">{metric.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {resolved.embargoed ? (
              <Alert tone="warning" title="This project is under embargo" className="mt-8">
                The title, team and abstract are public so the work can be cited. The full record —
                methodology, results and files — becomes readable on{" "}
                <strong>
                  {new Date(project.embargoUntil!).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </strong>
                . Embargo exists so patentable work can be proven to exist without being disclosed.
              </Alert>
            ) : null}

            {/* Each section is a real h2 block — the structure that makes this
                page snippet-eligible, and the reason sections are rows. */}
            <div className="mt-10 space-y-10">
              {project.sections.map((section) => (
                <section
                  key={section.kind}
                  id={section.kind.toLowerCase()}
                  className="scroll-mt-24"
                >
                  <h2 className="border-b border-border pb-2 font-display text-xl font-bold md:text-2xl">
                    {SECTION_LABEL[section.kind]}
                  </h2>
                  <RichText body={section.body} className="mt-4 max-w-none" />
                </section>
              ))}
            </div>

            {/* --------------------------------------------------- lineage */}
            {(parents.length > 0 || children.length > 0) && (
              <section className="mt-12">
                <h2 className="border-b border-border pb-2 font-display text-xl font-bold md:text-2xl">
                  Lineage
                </h2>
                <p className="mt-3 text-sm text-fg-muted">
                  Recorded relationships between this project and the work it builds on or that
                  builds on it. This is what turns a college archive from a graveyard into something
                  that compounds.
                </p>

                {parents.length > 0 ? (
                  <div className="mt-5">
                    <h3 className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">
                      Builds on
                    </h3>
                    <div className="mt-2 space-y-1">
                      {parents.map((parent) => (
                        <div key={parent.project.slug}>
                          <ProjectRow project={parent.project} />
                          <p className="mt-1 mb-3 pl-3 text-sm text-fg-subtle italic">
                            {parent.note}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {children.length > 0 ? (
                  <div className="mt-6">
                    <h3 className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">
                      Built on by
                    </h3>
                    <div className="mt-2 space-y-1">
                      {children.map((child) => (
                        <ProjectRow key={child.project.slug} project={child.project} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>
            )}

            {related.length > 0 ? (
              <section className="mt-12">
                <h2 className="border-b border-border pb-2 font-display text-xl font-bold md:text-2xl">
                  Related projects
                </h2>
                <div className="mt-3 space-y-1">
                  {related.map((item) => (
                    <ProjectRow key={item.slug} project={item} />
                  ))}
                </div>
              </section>
            ) : null}
          </article>

          {/* --------------------------------------------------- sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card className="p-5">
              <h2 className="text-sm font-semibold">Team</h2>
              <ul className="mt-3 space-y-3">
                {project.members.map((member) => {
                  const person = personByUsername[member.username];
                  const isPublic = person?.visibility === "PUBLIC";
                  return (
                    <li key={member.username} className="flex items-start gap-3">
                      <Avatar
                        name={person?.name ?? member.username}
                        seed={member.username}
                        size="sm"
                      />
                      <div className="min-w-0">
                        {isPublic ? (
                          <Link
                            href={`/p/${member.username}`}
                            className="text-sm font-medium hover:text-primary-600"
                          >
                            {person.name}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium">
                            {person?.name ?? member.username}
                          </span>
                        )}
                        <p className="text-xs text-fg-subtle">{member.role}</p>
                        <span className="mt-1.5 inline-flex">
                          <TierBadge tier={member.tier} attestedBy={member.attestedBy} />
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {project.facultyGuide ? (
                <>
                  <Divider className="my-4" />
                  <p className="flex items-center gap-2 text-xs text-fg-subtle">
                    <FacultyIcon size={14} />
                    Supervised by {project.facultyGuide}
                  </p>
                </>
              ) : null}
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold">Details</h2>
              <dl className="mt-3 space-y-2.5 text-sm">
                {college ? (
                  <div>
                    <dt className="text-xs text-fg-subtle">College</dt>
                    <dd>
                      <Link href={`/colleges/${college.slug}`} className="hover:text-primary-600">
                        {college.name}
                      </Link>
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-xs text-fg-subtle">Department</dt>
                  <dd>{project.department}</dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-subtle">Term</dt>
                  <dd className="flex items-center gap-1.5">
                    <CalendarIcon size={14} className="text-fg-subtle" />
                    {project.term}
                  </dd>
                </div>
                {project.citationId ? (
                  <div>
                    <dt className="text-xs text-fg-subtle">Citation ID</dt>
                    <dd className="font-mono text-xs">{project.citationId}</dd>
                  </div>
                ) : null}
              </dl>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold">Topics &amp; goals</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {project.topics.map((topic) => (
                  <Link key={topic} href={`/topics/${topic}`}>
                    <Badge tone="outline">{TOPIC_BY_SLUG[topic]?.name ?? topic}</Badge>
                  </Link>
                ))}
              </div>
              {project.sdgs.length > 0 ? (
                <>
                  <Divider className="my-4" />
                  <ul className="space-y-2">
                    {project.sdgs.map((goal) => (
                      <li key={goal}>
                        <Link
                          href={sdgPath(goal)}
                          className="flex items-start gap-2 text-sm text-fg-muted hover:text-fg"
                        >
                          <SdgIcon size={16} className="mt-0.5 shrink-0" />
                          <span>
                            <span className="font-mono text-xs">SDG {goal}</span>{" "}
                            {SDG_BY_NUMBER[goal]?.title}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </Card>

            {!resolved.embargoed && project.techStack.length > 0 ? (
              <Card className="p-5">
                <h2 className="text-sm font-semibold">Built with</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {project.techStack.map((tech) => (
                    <Badge key={tech}>{tech}</Badge>
                  ))}
                </div>
                {(project.repositoryUrl || project.demoUrl) && (
                  <div className="mt-4 space-y-2 text-sm">
                    {project.repositoryUrl ? (
                      <a
                        href={project.repositoryUrl}
                        rel="ugc noopener"
                        className="flex items-center gap-2 text-primary-600 hover:underline"
                      >
                        <CodeIcon size={14} /> Repository <ExternalIcon size={12} />
                      </a>
                    ) : null}
                    {project.demoUrl ? (
                      <a
                        href={project.demoUrl}
                        rel="ugc noopener"
                        className="flex items-center gap-2 text-primary-600 hover:underline"
                      >
                        <ExternalIcon size={14} /> Demo
                      </a>
                    ) : null}
                  </div>
                )}
              </Card>
            ) : null}

            {citation ? (
              <Card className="p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <CitationIcon size={16} /> Cite this project
                </h2>
                <p className="mt-3 font-mono text-xs leading-relaxed text-fg-muted">{citation}</p>
                <div className="mt-3">
                  <CopyButton value={citation} label="Copy citation" className="px-0" />
                </div>
              </Card>
            ) : null}

            {builtOn > 0 ? (
              <Card className="border-accent-600 p-5">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <LineageIcon size={16} className="text-accent-700" />
                  {builtOn} {builtOn === 1 ? "group has" : "groups have"} built on this
                </p>
                <p className="mt-2 text-sm text-fg-muted">
                  The strongest signal that a project mattered.
                </p>
              </Card>
            ) : null}

            {project.status === "archived" ? (
              <p className="flex items-start gap-2 text-xs text-fg-subtle">
                <ArchiveIcon size={14} className="mt-0.5 shrink-0" />
                Archived. This record is permanent and read-only; corrections are appended as an
                erratum rather than edited in.
              </p>
            ) : null}
          </aside>
        </div>
      </Container>
    </>
  );
}
