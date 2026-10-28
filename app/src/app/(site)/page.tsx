import type { Metadata } from "next";
import Link from "next/link";

import {
  ArchiveIcon,
  ArrowRightIcon,
  AttestIcon,
  BoardIcon,
  LedgerIcon,
  LineageIcon,
} from "@/components/icons";
import { HeroGraphic } from "@/components/illustrations";
import { Container, Section } from "@/components/layout/primitives";
import { ProjectCard } from "@/components/project/project-card";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/display";
import { Accordion } from "@/components/ui/overlay";
import { siteConfig } from "@/config/site";
import { generalFaqs } from "@/content/faqs";
import { publicProjects } from "@/lib/db/queries/public-projects";
import { JsonLd, faqPage, organization, website } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * The home page.
 *
 * It opens on the **problem**, not the product, because everyone in the target
 * audience already knows the answers to those three questions and is nodding
 * before anything has been shown. That structure comes straight from
 * docs/PITCH.md and it is the one that works in the room.
 */
export const metadata: Metadata = buildMetadata({
  title: `${siteConfig.name} — ${siteConfig.descriptor}`,
  description:
    "The system of record for academic project work: a workspace where work happens, a ledger of who did what, and an archive of projects that can be cited.",
  path: "/",
  absoluteTitle: true,
});

const LAYERS = [
  {
    icon: <BoardIcon size={22} />,
    title: "The workspace",
    body: "Tasks, files, discussion, meetings and deadlines — one place, private to the group. Useful to five students on day one with nobody else on the platform.",
    href: "/features/workspace",
  },
  {
    icon: <LedgerIcon size={22} />,
    title: "The ledger",
    body: "An automatic, transparent record of who did what, written in the same transaction as the work itself. Visible to the group, not only to faculty.",
    href: "/features/contribution-ledger",
  },
  {
    icon: <AttestIcon size={22} />,
    title: "The record",
    body: "Problem, research, methodology, results — reviewed against a rubric and attested by a named faculty member, then archived with a permanent citation ID.",
    href: "/features/archive",
  },
  {
    icon: <LineageIcon size={22} />,
    title: "The network",
    body: "A feed generated from real project activity, discovery across colleges, teammate matching, alumni mentorship and companies who can see what you actually built.",
    href: "/features",
  },
];

const QUESTIONS = [
  {
    q: "Where does a student project live while it is being built?",
    a: "A WhatsApp group, someone's Drive folder, and a laptop.",
  },
  {
    q: "When does a faculty member first see whether it is going well?",
    a: "At submission. Sometimes at the viva.",
  },
  {
    q: "Where is the project your college's best group built four years ago?",
    a: "Nobody knows. It is gone.",
  },
];

export default async function Home() {
  const featured = (await publicProjects()).slice(0, 3);

  return (
    <>
      <JsonLd data={[organization(), website(), faqPage(generalFaqs)]} />

      {/* ------------------------------------------------------------ hero */}
      <Section className="pt-8 pb-6 md:pt-10 md:pb-10 lg:pt-12">
        <Container>
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge tone="primary" className="mb-5">
                Projects → People → Opportunities
              </Badge>
              <h1 className="font-display text-3xl font-bold md:text-4xl lg:text-5xl">
                {siteConfig.descriptor}
              </h1>
              <p className="mt-4 max-w-xl text-base text-fg-muted md:text-lg">
                Nexivora is the system of record for academic project work — and the network that
                grows on top of it. {siteConfig.positioning}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/explore">Explore student projects</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/for-colleges">For institutions</Link>
                </Button>
              </div>
            </div>

            <div className="lg:pl-8">
              <HeroGraphic />
            </div>
          </div>
        </Container>
      </Section>

      {/* --------------------------------------------------------- problem */}
      <Section tone="raised">
        <Container>
          <h2 className="font-display text-xl font-bold md:text-2xl">
            Three questions everyone in a college already knows the answer to
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {QUESTIONS.map((item, i) => (
              <div key={item.q}>
                <span className="font-mono text-sm text-fg-subtle">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mt-2 font-display text-base font-semibold">{item.q}</p>
                <p className="mt-2 text-sm text-fg-muted italic">{item.a}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-2xl text-fg-muted">
            Every year, every college produces thousands of projects. Almost all of that work
            disappears within weeks of being graded — the students cannot prove they did it, the
            faculty cannot see it while it matters, and the college cannot find it when an assessor
            asks.{" "}
            <strong className="text-fg">
              That is not a technology gap. It is a missing system of record.
            </strong>
          </p>
        </Container>
      </Section>

      {/* ---------------------------------------------------------- layers */}
      <Section>
        <Container>
          <h2 className="font-display text-xl font-bold md:text-2xl">
            Four layers, in the order they deliver value
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-fg-muted">
            Each one is useful before the next exists. That ordering is deliberate — it is what
            makes the product worth using on day one, when nobody else is on it yet.
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {LAYERS.map((layer, i) => (
              <Card key={layer.title} interactive className="relative flex flex-col p-5">
                <span className="grid size-10 place-items-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-600">
                  {layer.icon}
                </span>
                <span className="mt-4 font-mono text-xs text-fg-subtle">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-1 font-display text-lg font-semibold">
                  <Link href={layer.href} className="after:absolute after:inset-0">
                    {layer.title}
                  </Link>
                </h3>
                <p className="mt-2 text-sm text-fg-muted">{layer.body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* ----------------------------------------------------- differentiator */}
      <Section tone="raised">
        <Container>
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <div>
              <Badge tone="accent" className="mb-4">
                The part nobody else builds
              </Badge>
              <h2 className="font-display text-xl font-bold md:text-2xl">
                Every group has a member who did very little. Nothing has ever surfaced it.
              </h2>
              <p className="mt-4 text-fg-muted">
                It is the most universally felt problem in coursework and the least often addressed,
                because contribution is invisible: work happens in a chat and a shared folder, and
                by submission there is no record of who did what.
              </p>
              <p className="mt-4 text-fg-muted">
                The contribution ledger records it automatically, as it happens — and shows it to{" "}
                <strong className="text-fg">the whole group</strong>, not only to faculty. A group
                that can see the imbalance in week three usually corrects it without anyone
                escalating. The same information in week fourteen is only useful for allocating
                blame.
              </p>
              <Button asChild variant="outline" className="mt-6">
                <Link href="/features/contribution-ledger">
                  How the ledger works <ArrowRightIcon size={16} />
                </Link>
              </Button>
            </div>

            <Card className="p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <ArchiveIcon size={18} className="text-accent-700" />
                And the archive that compounds
              </h3>
              <p className="mt-3 text-sm text-fg-muted">
                A completed project gets a permanent citation ID and a public page, and a future
                group can formally <strong className="text-fg">build on</strong> it — with the
                lineage recorded on both.
              </p>
              <p className="mt-3 text-sm text-fg-muted">
                So a group can start from an existing result rather than from nothing, and a
                department&rsquo;s fourth-year work gets measurably more advanced over time. That is
                the difference between a college that accumulates knowledge and one that resets
                every year.
              </p>
              <Button asChild variant="ghost" size="sm" className="mt-4 px-0">
                <Link href="/features/archive">
                  The archive and lineage <ArrowRightIcon size={14} />
                </Link>
              </Button>
            </Card>
          </div>
        </Container>
      </Section>

      {/* --------------------------------------------------------- featured */}
      {featured.length > 0 ? (
        <Section>
          <Container>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold md:text-2xl">
                  Real projects, documented properly
                </h2>
                <p className="mt-2 text-sm text-fg-muted">
                  Problem statement, methodology, results and named teams — the archive is a
                  by-product of the product working.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/explore">Explore all</Link>
              </Button>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((project) => (
                <ProjectCard key={project.slug} project={project} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      {/* ------------------------------------------------------------- FAQ */}
      <Section tone="raised">
        <Container width="reading">
          <h2 className="font-display text-xl font-bold md:text-2xl">Questions</h2>
          <Accordion
            className="mt-4"
            items={generalFaqs.map((faq, i) => ({
              value: `faq-${i}`,
              trigger: faq.question,
              content: faq.answer,
            }))}
          />
        </Container>
      </Section>

      {/* ------------------------------------------------------------- CTA */}
      <Section>
        <Container>
          <Card className="border-primary-600 p-8 text-center md:p-12">
            <h2 className="font-display text-xl font-bold md:text-2xl">
              Start with one department, for one semester
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-fg-muted">
              Free, no purchase decision, no procurement. If faculty are not opening the dashboard
              by week six, it has not worked and you should stop — we would rather learn that in
              month two than in year two.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/pricing">See the pilot</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/contact">Talk to us</Link>
              </Button>
            </div>
          </Card>
        </Container>
      </Section>
    </>
  );
}
