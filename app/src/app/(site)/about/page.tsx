import type { Metadata } from "next";
import Link from "next/link";

import { ArchiveScene } from "@/components/illustrations";
import { Container, PageHeader, Prose, Section } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { Breadcrumbs } from "@/components/ui/navigation";
import { siteConfig } from "@/config/site";
import { JsonLd, breadcrumbList, organization } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "About Nexivora",
  description:
    "Why Nexivora exists, who is building it, and the principles it is built on — including the ones that constrain what it will ever do.",
  path: "/about",
});

const PRINCIPLES = [
  {
    title: "Evidence over claims",
    body: "Every contribution claim points at something: a task closed, a file contributed, a faculty member who signed it. A platform where anyone can assert anything is worth nothing to the people reading it.",
  },
  {
    title: "Private by default",
    body: "Nothing about a student is public unless they chose it, and every step outward is separately revocable. Students are the most exposed users here and the least able to bear a mistake.",
  },
  {
    title: "Explainable over clever",
    body: "Matching, search, similarity and ranking are all deterministic and can be explained in a sentence. A faculty member evaluating a student needs an answer they can check, not a model output they must trust.",
  },
  {
    title: "Honest about limits",
    body: "The accessibility statement says what has not been audited. The privacy policy explains what deletion cannot remove and why. A false claim is worse than an admitted gap.",
  },
];

export default function AboutPage() {
  const crumbs = [{ label: "About", href: "/about" }];

  return (
    <>
      <JsonLd data={[organization(), breadcrumbList(crumbs)]} />

      <Section className="pt-10 pb-4 md:pt-12">
        <Container>
          <Breadcrumbs crumbs={crumbs} className="mb-6" />
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
            <PageHeader
              eyebrow="About"
              title="Student work should outlive the semester it was graded in"
              description="Nexivora started from a specific frustration: four years of real building, and nothing at the end that anyone could verify or find."
            />
            <div className="hidden lg:block">
              <ArchiveScene width={240} />
            </div>
          </div>
        </Container>
      </Section>

      <Section className="pt-4">
        <Container width="reading">
          <Prose>
            <h2>Why this exists</h2>
            <p>
              Ask a department for the best project it produced four years ago. In most institutions
              the answer involves a hard drive, a former faculty member, and eventually a shrug.
            </p>
            <p>
              That has three costs, and all three are avoidable. Students rebuild things earlier
              groups already solved. Nothing compounds between batches, so the fifth cohort&rsquo;s
              work is no more advanced than the first&rsquo;s. And every accreditation cycle becomes
              an archaeology exercise, reconstructing evidence from email attachments for work the
              department already did.
            </p>
            <p>
              None of that is a technology gap. The work is happening; it is simply not being
              recorded anywhere it can be found again.{" "}
              <strong>Nexivora is that record, and the network that grows on top of it.</strong>
            </p>

            <h2>Who is building it</h2>
            <p>
              An individual project by an Integrated M.Tech AI/ML student, built in public against a
              published phase plan. It is not a group assignment and not a hackathon submission — it
              is a product with a business model, being built one phase at a time.
            </p>
            <p>
              That has a practical consequence worth stating: the roadmap is honest about what is
              built and what is not, because a solo project cannot afford to promise things it has
              not shipped. <Link href="/roadmap">The roadmap</Link> and{" "}
              <Link href="/changelog">the changelog</Link> both say where it actually is.
            </p>

            <h2>What it will not become</h2>
            <p>
              No ads. No selling student data. No pay-to-rank placement. No charging students or
              faculty. These are on the <Link href="/pricing">pricing page</Link> because they are a
              differentiator, and because breaking any one of them once would destroy the
              institutional trust the whole product depends on.
            </p>
            <p>
              And no automated grading. No AI-scored rubrics, no AI-written feedback issued under a
              faculty member&rsquo;s name. An academic assessment must be made and owned by a named
              human — that is an absolute line, not a current limitation.
            </p>
          </Prose>
        </Container>
      </Section>

      <Section tone="raised">
        <Container>
          <h2 className="font-display text-xl font-bold md:text-2xl">Principles</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {PRINCIPLES.map((principle) => (
              <Card key={principle.title} className="p-5">
                <h3 className="font-display text-base font-semibold">{principle.title}</h3>
                <p className="mt-2 text-sm text-fg-muted">{principle.body}</p>
              </Card>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/contact">Get in touch</Link>
            </Button>
            <Button asChild variant="outline">
              <a href={siteConfig.social.github} rel="noopener">
                Follow the build
              </a>
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
