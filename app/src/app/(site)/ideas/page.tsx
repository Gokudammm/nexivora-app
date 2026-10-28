import type { Metadata } from "next";
import Link from "next/link";

import { Container, PageHeader } from "@/components/layout/primitives";
import { Avatar, Badge, Card } from "@/components/ui/display";
import { Breadcrumbs } from "@/components/ui/navigation";
import { DOMAIN_BY_KEY } from "@/config/taxonomy";
import { publicIdeas } from "@/content";
import { IDEA_STATUS_LABEL } from "@/content/ideas";
import { personByUsername } from "@/content/people";
import type { Idea } from "@/content/types";
import { JsonLd, breadcrumbList, itemList } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * The Idea Hub.
 *
 * "Final year project ideas" is one of the highest-volume queries in this space,
 * and today it returns thin listicles. This page answers it with **real,
 * claimable ideas** that have a problem statement, a named poster and a live
 * status — a categorically better result, and one that is a by-product of the
 * product working rather than content written to rank.
 */
export const metadata: Metadata = buildMetadata({
  title: "Project ideas looking for teams",
  description:
    "Real student project ideas with a problem statement, the skills needed and a live status — posted by students at verified colleges, and open to join.",
  path: "/ideas",
});

const STATUS_TONE: Record<
  Idea["status"],
  "neutral" | "primary" | "accent" | "success" | "warning"
> = {
  IDEA: "neutral",
  LOOKING_FOR_TEAM: "primary",
  IN_DEVELOPMENT: "warning",
  TESTING: "accent",
  COMPLETED: "success",
};

export default function IdeasPage() {
  const ideas = publicIdeas();
  const crumbs = [{ label: "Ideas", href: "/ideas" }];
  const looking = ideas.filter((i) => i.status === "LOOKING_FOR_TEAM");

  return (
    <>
      <JsonLd
        data={[
          itemList(
            ideas.map((i) => ({ name: i.title, url: `/ideas/${i.slug}` })),
            { name: "Student project ideas" },
          ),
          breadcrumbList(crumbs),
        ]}
      />
      <Container className="py-10 md:py-12">
        <Breadcrumbs crumbs={crumbs} className="mb-6" />
        <PageHeader
          eyebrow="Idea hub"
          title="Project ideas, with a real problem behind them"
          description="Every idea here was posted by a named student at a verified college, states the problem it addresses, and says what skills it needs."
        />

        <p className="mt-6 text-sm text-fg-muted">
          {ideas.length} ideas ·{" "}
          <strong className="text-fg">{looking.length} looking for team</strong>
        </p>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {ideas.map((idea) => {
            const domain = DOMAIN_BY_KEY[idea.domain];
            const poster = personByUsername[idea.postedBy];
            return (
              <Card key={idea.slug} interactive className="relative flex flex-col p-5">
                <div className="mb-2.5 flex flex-wrap items-center gap-2">
                  <span
                    className="text-xs font-semibold tracking-wide uppercase"
                    style={{ color: `var(${domain.colorVar})` }}
                  >
                    {domain.name}
                  </span>
                  <Badge tone={STATUS_TONE[idea.status]}>{IDEA_STATUS_LABEL[idea.status]}</Badge>
                </div>

                <h2 className="font-display text-lg leading-snug font-semibold">
                  <Link href={`/ideas/${idea.slug}`} className="after:absolute after:inset-0">
                    {idea.title}
                  </Link>
                </h2>
                <p className="mt-2 text-sm text-fg-muted">{idea.summary}</p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {idea.skillsNeeded.slice(0, 3).map((skill) => (
                    <Badge key={skill} tone="outline">
                      {skill}
                    </Badge>
                  ))}
                </div>

                <div className="mt-auto flex items-center gap-2 pt-4 text-xs text-fg-subtle">
                  <Avatar name={poster?.name ?? idea.postedBy} seed={idea.postedBy} size="xs" />
                  {poster?.name ?? idea.postedBy} · wants {idea.teamSizeWanted} ·{" "}
                  {idea.interestedCount} interested
                </div>
              </Card>
            );
          })}
        </div>
      </Container>
    </>
  );
}
