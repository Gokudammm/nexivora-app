import type { Metadata } from "next";
import Link from "next/link";

import {
  AccreditationIcon,
  ArchiveIcon,
  AttestIcon,
  BoardIcon,
  FeedIcon,
  IdeaIcon,
  LedgerIcon,
  LineageIcon,
  MentorIcon,
  ResearchIcon,
  SdgIcon,
  SearchIcon,
} from "@/components/icons";
import { Container, PageHeader, Section } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/display";
import { Breadcrumbs } from "@/components/ui/navigation";
import { JsonLd, breadcrumbList } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Features",
  description:
    "The workspace, the contribution ledger, faculty attestation, the archive with lineage, and accreditation export — what Nexivora actually does.",
  path: "/features",
});

const SHIPPED = [
  {
    icon: <BoardIcon size={22} />,
    title: "Group workspace",
    body: "Tasks, versioned files, threaded discussion, meetings and a deadline calendar — private to the group, visible read-only to supervising faculty.",
    href: "/features/workspace",
  },
  {
    icon: <LedgerIcon size={22} />,
    title: "Contribution ledger",
    body: "An append-only record of who did what, written in the same transaction as the work. Visible to the whole group, with peer review at each milestone close.",
    href: "/features/contribution-ledger",
  },
  {
    icon: <AttestIcon size={22} />,
    title: "Rubric evaluation and attestation",
    body: "Weighted rubrics, per-member marks with the ledger displayed alongside, sectioned feedback, and attestations signed by a named faculty member.",
  },
  {
    icon: <ArchiveIcon size={22} />,
    title: "Permanent archive",
    body: "Completed projects get an immutable citation ID and a stable public page. Read-only forever; corrections are appended as an erratum.",
    href: "/features/archive",
  },
  {
    icon: <LineageIcon size={22} />,
    title: "Project lineage",
    body: "A group can formally build on a previous project. The relationship is recorded on both, and rendered as a tree — so an archive compounds instead of resetting.",
    href: "/features/archive",
  },
  {
    icon: <ResearchIcon size={22} />,
    title: "Similarity checking",
    body: "A new proposal is checked against the college archive, with the closest matches and the reason for each. It informs a faculty decision; it never blocks one.",
  },
  {
    icon: <SearchIcon size={22} />,
    title: "Discovery and teammate matching",
    body: "Full-text search across projects, people and ideas, with deterministic teammate suggestions that always show their reasoning.",
  },
  {
    icon: <IdeaIcon size={22} />,
    title: "Idea hub",
    body: "Post an idea with the skills it needs and a live status, and attract collaborators. Ideas that become projects link to what they became.",
  },
  {
    icon: <FeedIcon size={22} />,
    title: "Activity-anchored feed",
    body: "Every post references a project, idea, question or resource — and milestones generate posts automatically. The feed cannot be empty and cannot become noise.",
  },
  {
    icon: <SdgIcon size={22} />,
    title: "SDG alignment",
    body: "Honest, specific goal tagging at project level, filterable and reportable, with public hub pages per goal.",
  },
  {
    icon: <AccreditationIcon size={22} />,
    title: "Accreditation export",
    body: "NAAC, NBA, NIRF and AICTE evidence generated from data the platform already holds, with every figure traceable to a named query.",
  },
  {
    icon: <MentorIcon size={22} />,
    title: "Alumni and company network",
    body: "Goal-scoped mentorship, verified company profiles, and opportunities that reach students matched by their published work.",
  },
];

export default function FeaturesPage() {
  const crumbs = [{ label: "Features", href: "/features" }];

  return (
    <>
      <JsonLd data={breadcrumbList(crumbs)} />

      <Section className="pt-10 pb-4 md:pt-12">
        <Container>
          <Breadcrumbs crumbs={crumbs} className="mb-6" />
          <PageHeader
            eyebrow="Features"
            title="What Nexivora actually does"
            description="Four of these are things nobody else builds: the contribution ledger, faculty attestation, the archive with recorded lineage, and accreditation export."
          />
        </Container>
      </Section>

      <Section className="pt-4">
        <Container>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SHIPPED.map((feature) => (
              <Card
                key={feature.title}
                interactive={Boolean(feature.href)}
                className="relative flex flex-col p-5"
              >
                <span className="grid size-10 place-items-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-600">
                  {feature.icon}
                </span>
                <h2 className="mt-4 font-display text-base font-semibold">
                  {feature.href ? (
                    <Link href={feature.href} className="after:absolute after:inset-0">
                      {feature.title}
                    </Link>
                  ) : (
                    feature.title
                  )}
                </h2>
                <p className="mt-2 text-sm text-fg-muted">{feature.body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="raised">
        <Container>
          <Badge tone="warning" className="mb-4">
            Deliberately last
          </Badge>
          <h2 className="font-display text-xl font-bold md:text-2xl">Where the AI is</h2>
          <p className="mt-4 max-w-2xl text-fg-muted">
            Everything above is deterministic and explainable. Matching is skill-overlap arithmetic
            with a stated reason, search is full-text, similarity is trigram comparison, feed
            ranking is a scoring function you could compute by hand.
          </p>
          <p className="mt-4 max-w-2xl text-fg-muted">
            An AI assistant is added on top — navigation, summarisation, semantic search over the
            lexical results — and{" "}
            <strong className="text-fg">the product is complete without it</strong>. With AI
            switched off, nothing breaks and no interface is empty. That is a design decision, not a
            limitation: a faculty member evaluating a student needs an answer they can check.
          </p>
          <p className="mt-4 max-w-2xl text-fg-muted">
            AI may draft. It never publishes, and it never grades.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/how-it-works">How it works</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/roadmap">What is built, and what is not</Link>
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
