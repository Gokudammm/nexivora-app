import type { Metadata } from "next";
import Link from "next/link";

import { CheckCircleIcon, ClockIcon, SparkIcon } from "@/components/icons";
import { Container, PageHeader, Section } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import { Breadcrumbs } from "@/components/ui/navigation";
import { JsonLd, breadcrumbList } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * The public roadmap.
 *
 * Published deliberately, and **honest about what is not built**. A public
 * roadmap builds credibility with academic users, and claiming shipped features
 * that do not exist is the fastest way to lose a pilot — an institution will
 * find out in week one.
 */
export const metadata: Metadata = buildMetadata({
  title: "Roadmap",
  description:
    "What is built in Nexivora today, what is being built next, and what is deliberately not built yet — stated honestly rather than implied.",
  path: "/roadmap",
});

const PHASES = [
  {
    band: "Shipped",
    tone: "done" as const,
    items: [
      {
        title: "Design system and brand",
        body: "Component library, accessibility floor with a contrast audit that fails the build, generated brand assets.",
      },
      {
        title: "Public site and SEO engine",
        body: "The full public surface — explore, project pages, topic and SDG hubs, ideas, colleges, profiles, knowledge hub, opportunities — with structured data and segmented sitemaps.",
      },
    ],
  },
  {
    band: "Next",
    tone: "next" as const,
    items: [
      {
        title: "Data model and seed",
        body: "The schema behind everything above, plus a demo college that rebuilds in seconds.",
      },
      {
        title: "Authentication and roles",
        body: "Seven roles, institutional email verification, and an authorisation matrix enforced at the query layer rather than only in the interface.",
      },
      {
        title: "Institution backbone",
        body: "Departments, subjects, terms, classes, roster import with a dry-run preview, and an audit log.",
      },
      {
        title: "Profiles and academic identity",
        body: "Project-inferred skill graphs, granular privacy controls, and the public profile.",
      },
    ],
  },
  {
    band: "The core product",
    tone: "planned" as const,
    items: [
      {
        title: "Group workspace and the contribution ledger",
        body: "The heart of it. Tasks, files, discussion, meetings, and the append-only contribution record with peer review.",
      },
      {
        title: "Project lifecycle",
        body: "The nine-section record, milestones, similarity checking at proposal, visibility and embargo, and immutable submission snapshots.",
      },
      {
        title: "Faculty review and evaluation",
        body: "Dashboards, group health signals, rubric evaluation with per-member marks, and attestation.",
      },
      {
        title: "Feed, discovery and the archive",
        body: "Activity-anchored feed, search and teammate matching, then the public archive with lineage and portfolio export.",
      },
    ],
  },
  {
    band: "Expansion",
    tone: "later" as const,
    items: [
      {
        title: "Alumni and company network",
        body: "Goal-scoped mentorship, verified company profiles, the opportunity board and a simple applicant pipeline.",
      },
      {
        title: "Inter-college, events and hackathons",
        body: "College partnerships with guest access, cross-college collaboration, and challenge hosting.",
      },
      {
        title: "Analytics and accreditation export",
        body: "NAAC, NBA, NIRF and AICTE evidence packs, with every figure traceable to a named query.",
      },
      {
        title: "AI assistant",
        body: "Last, by design. Everything it does has a deterministic version that ships first and works alone.",
      },
    ],
  },
];

const NOT_BUILT = [
  "Video conferencing — we store a meeting link; hosting video is a different company",
  "Real-time collaborative document editing — files and threaded discussion cover the need",
  "Plagiarism checking against the open web — we check against the college archive only",
  "Native mobile apps — the web app is installable instead",
  "Payments and subscription billing — pricing is published; no gateway until a college signs",
];

const TONE_STYLE = {
  done: { badge: "success", icon: <CheckCircleIcon size={18} /> },
  next: { badge: "primary", icon: <ClockIcon size={18} /> },
  planned: { badge: "outline", icon: <ClockIcon size={18} /> },
  later: { badge: "outline", icon: <SparkIcon size={18} /> },
} as const;

export default function RoadmapPage() {
  const crumbs = [{ label: "Roadmap", href: "/roadmap" }];

  return (
    <>
      <JsonLd data={breadcrumbList(crumbs)} />

      <Section className="pt-10 pb-4 md:pt-12">
        <Container width="reading">
          <Breadcrumbs crumbs={crumbs} className="mb-6" />
          <PageHeader
            eyebrow="Roadmap"
            title="What is built, and what is not"
            description="Published because an institution evaluating this deserves to know where it actually is — and because claiming features that do not exist is the fastest way to lose a pilot."
          />

          <Alert tone="info" title="Where this is today" className="mt-8">
            Nexivora is early. The public surface and the design system are built; the workspace,
            the ledger and the archive are the next phases. Nothing on this page is described as
            shipped unless it is.
          </Alert>
        </Container>
      </Section>

      <Section className="pt-4">
        <Container width="reading">
          <div className="space-y-10">
            {PHASES.map((phase) => {
              const style = TONE_STYLE[phase.tone];
              return (
                <section key={phase.band}>
                  <div className="flex items-center gap-3 border-b border-border pb-2">
                    <span className="text-fg-subtle">{style.icon}</span>
                    <h2 className="font-display text-xl font-bold">{phase.band}</h2>
                    <Badge tone={style.badge}>{phase.items.length}</Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    {phase.items.map((item) => (
                      <Card key={item.title} className="p-5">
                        <h3 className="text-base font-semibold">{item.title}</h3>
                        <p className="mt-1.5 text-sm text-fg-muted">{item.body}</p>
                      </Card>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </Container>
      </Section>

      <Section tone="raised">
        <Container width="reading">
          <h2 className="font-display text-xl font-bold md:text-2xl">
            Deliberately not being built
          </h2>
          <p className="mt-3 text-sm text-fg-muted">
            Each of these was considered and rejected with a reason. Saying so is more useful than
            leaving them implied.
          </p>
          <ul className="mt-5 space-y-2.5">
            {NOT_BUILT.map((item) => (
              <li key={item} className="text-sm text-fg-muted">
                — {item}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/changelog">See what shipped</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact">Ask about something specific</Link>
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
