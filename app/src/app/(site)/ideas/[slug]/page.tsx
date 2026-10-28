import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container, PageHeader, Prose } from "@/components/layout/primitives";
import { ProjectRow } from "@/components/project/project-card";
import { Avatar, Badge, Card, Divider } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import { Breadcrumbs } from "@/components/ui/navigation";
import { DOMAIN_BY_KEY, SDG_BY_NUMBER, TOPIC_BY_SLUG, sdgPath } from "@/config/taxonomy";
import { collegeBySlug } from "@/content/colleges";
import { IDEA_STATUS_LABEL, ideas } from "@/content/ideas";
import { personByUsername } from "@/content/people";
import { publicIdea, publicProject } from "@/content";
import { JsonLd, breadcrumbList } from "@/lib/seo/jsonld";
import { buildMetadata, ensureDescription } from "@/lib/seo/metadata";

export const dynamicParams = false;

export function generateStaticParams() {
  return ideas.filter((i) => collegeBySlug[i.collegeSlug]?.verified).map((i) => ({ slug: i.slug }));
}

export async function generateMetadata(props: PageProps<"/ideas/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const idea = publicIdea(slug);
  if (!idea) {
    return buildMetadata({
      title: "Idea not found",
      description: "This idea is not available publicly on Nexivora.",
      path: `/ideas/${slug}`,
      index: false,
    });
  }

  return buildMetadata({
    title: idea.title,
    description: ensureDescription(
      `${idea.summary} Posted at a verified college, currently ${IDEA_STATUS_LABEL[idea.status].toLowerCase()}.`,
      `Needs ${idea.skillsNeeded.slice(0, 2).join(" and ")}.`,
    ),
    path: `/ideas/${slug}`,
    og: { eyebrow: IDEA_STATUS_LABEL[idea.status], accent: idea.domain },
  });
}

export default async function IdeaPage(props: PageProps<"/ideas/[slug]">) {
  const { slug } = await props.params;
  const idea = publicIdea(slug);
  if (!idea) notFound();

  const domain = DOMAIN_BY_KEY[idea.domain];
  const poster = personByUsername[idea.postedBy];
  const college = collegeBySlug[idea.collegeSlug];
  const became = idea.becameProject ? publicProject(idea.becameProject) : null;

  const crumbs = [
    { label: "Ideas", href: "/ideas" },
    { label: idea.title, href: `/ideas/${slug}` },
  ];

  return (
    <>
      <JsonLd data={breadcrumbList(crumbs)} />
      <Container className="py-10 md:py-12">
        <Breadcrumbs crumbs={crumbs} className="mb-6" />

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <article className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
              <span
                className="text-sm font-semibold tracking-wide uppercase"
                style={{ color: `var(${domain.colorVar})` }}
              >
                {domain.name}
              </span>
              <Badge tone="primary">{IDEA_STATUS_LABEL[idea.status]}</Badge>
            </div>

            <PageHeader title={idea.title} description={idea.summary} />

            {became ? (
              <Alert tone="success" title="This idea became a project" className="mt-6">
                It is now published as{" "}
                <Link href={`/projects/${became.slug}`} className="font-medium underline">
                  {became.title}
                </Link>
                . The hub shows outcomes, not only intentions.
              </Alert>
            ) : null}

            <section className="mt-8">
              <h2 className="border-b border-border pb-2 font-display text-xl font-bold">
                The problem
              </h2>
              <Prose className="mt-4 max-w-none">
                <p>{idea.problem}</p>
              </Prose>
            </section>

            <section className="mt-8">
              <h2 className="border-b border-border pb-2 font-display text-xl font-bold">
                Proposed approach
              </h2>
              <Prose className="mt-4 max-w-none">
                <p>{idea.approach}</p>
              </Prose>
            </section>

            {became ? (
              <section className="mt-10">
                <h2 className="border-b border-border pb-2 font-display text-xl font-bold">
                  What it became
                </h2>
                <div className="mt-3">
                  <ProjectRow project={became} />
                </div>
              </section>
            ) : null}
          </article>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card className="p-5">
              <h2 className="text-sm font-semibold">Posted by</h2>
              <div className="mt-3 flex items-center gap-3">
                <Avatar name={poster?.name ?? idea.postedBy} seed={idea.postedBy} size="sm" />
                <div>
                  {poster?.visibility === "PUBLIC" ? (
                    <Link
                      href={`/p/${idea.postedBy}`}
                      className="text-sm font-medium hover:text-primary-600"
                    >
                      {poster.name}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium">{poster?.name ?? idea.postedBy}</span>
                  )}
                  {college ? <p className="text-xs text-fg-subtle">{college.shortName}</p> : null}
                </div>
              </div>
              <Divider className="my-4" />
              <dl className="space-y-2.5 text-sm">
                <div>
                  <dt className="text-xs text-fg-subtle">Team size wanted</dt>
                  <dd>{idea.teamSizeWanted} people</dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-subtle">Commitment</dt>
                  <dd className="capitalize">{idea.commitment}</dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-subtle">Interested so far</dt>
                  <dd>{idea.interestedCount} people</dd>
                </div>
              </dl>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold">Skills needed</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {idea.skillsNeeded.map((skill) => (
                  <Badge key={skill} tone="outline">
                    {skill}
                  </Badge>
                ))}
              </div>

              <Divider className="my-4" />
              <h2 className="text-sm font-semibold">Topics</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {idea.topics.map((topic) => (
                  <Link key={topic} href={`/topics/${topic}`}>
                    <Badge tone="outline">{TOPIC_BY_SLUG[topic]?.name ?? topic}</Badge>
                  </Link>
                ))}
              </div>

              {idea.sdgs.length > 0 ? (
                <>
                  <Divider className="my-4" />
                  <h2 className="text-sm font-semibold">Goals</h2>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {idea.sdgs.map((goal) => (
                      <li key={goal}>
                        <Link href={sdgPath(goal)} className="text-fg-muted hover:text-fg">
                          <span className="font-mono text-xs">SDG {goal}</span>{" "}
                          {SDG_BY_NUMBER[goal]?.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </Card>
          </aside>
        </div>
      </Container>
    </>
  );
}
