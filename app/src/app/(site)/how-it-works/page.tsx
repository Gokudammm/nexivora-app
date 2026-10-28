import type { Metadata } from "next";
import Link from "next/link";

import { Container, PageHeader, Section } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { Stepper } from "@/components/ui/navigation";
import { Breadcrumbs } from "@/components/ui/navigation";
import { JsonLd, breadcrumbList, howTo } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "How Nexivora works",
  description:
    "From forming a group to a permanently citable published project — the seven steps a piece of academic work goes through on Nexivora, and who does what at each.",
  path: "/how-it-works",
});

const STEPS = [
  {
    name: "A class is set up",
    text: "A college administrator creates the department, subject, term and class, and imports the student roster. Faculty are assigned to the classes they teach.",
    who: "College administrator",
  },
  {
    name: "A group forms",
    text: "Students create a group inside a class, or a faculty member assigns them. The group gets a private workspace immediately.",
    who: "Students, or faculty",
  },
  {
    name: "The project is proposed",
    text: "The group submits a problem statement and proposed solution. A similarity check runs against the college archive and shows the closest matches with reasons — a flag informs the faculty decision, it never blocks anything.",
    who: "Students, approved by faculty",
  },
  {
    name: "The work happens in the workspace",
    text: "Tasks, files, discussion, meetings and milestones. Every contributing action is recorded in the contribution ledger at the same moment it happens, so the record cannot drift from the work.",
    who: "The group",
  },
  {
    name: "Milestones close with peer review",
    text: "At each milestone, members review each other on contribution, reliability and communication. A member sees only the aggregate about themselves, never who said what — which is what makes honest review possible.",
    who: "The group",
  },
  {
    name: "Faculty review and attest",
    text: "The submission is evaluated against a rubric, with the ledger displayed beside the per-member scores so differentiating a mark is evidence-backed. Faculty can attest specific contributions by name.",
    who: "Faculty",
  },
  {
    name: "The project is archived and published",
    text: "A completed project gets a permanent citation ID and, if the group and faculty both agree, a public page. A future group can formally build on it, and the lineage is recorded on both.",
    who: "Group and faculty together",
  },
];

export default function HowItWorksPage() {
  const crumbs = [{ label: "How it works", href: "/how-it-works" }];

  return (
    <>
      <JsonLd
        data={[
          howTo({
            name: "How academic project work runs on Nexivora",
            description:
              "The seven stages a student project passes through, from class setup to a permanently citable published record.",
            steps: STEPS.map((s) => ({ name: s.name, text: s.text })),
          }),
          breadcrumbList(crumbs),
        ]}
      />

      <Section className="pt-10 pb-4 md:pt-12">
        <Container>
          <Breadcrumbs crumbs={crumbs} className="mb-6" />
          <PageHeader
            eyebrow="How it works"
            title="From a group forming to a citable published record"
            description="Seven stages. Each one is useful on its own, which is why a class can adopt this in week one without anything else being in place."
          />
        </Container>
      </Section>

      <Section className="pt-4">
        <Container>
          <Stepper
            className="mb-12 hidden lg:flex"
            current={3}
            steps={STEPS.map((s) => ({ label: s.name }))}
          />

          <ol className="space-y-5">
            {STEPS.map((step, i) => (
              <li key={step.name}>
                <Card className="flex gap-5 p-5 md:p-6">
                  <span
                    aria-hidden
                    className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-fill font-display text-lg font-bold text-fg-on-primary"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-semibold">{step.name}</h2>
                    <p className="mt-0.5 text-xs tracking-wide text-fg-subtle uppercase">
                      {step.who}
                    </p>
                    <p className="mt-2.5 max-w-[68ch] text-sm text-fg-muted">{step.text}</p>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <Section tone="raised">
        <Container>
          <h2 className="font-display text-xl font-bold md:text-2xl">
            What is deliberately not automated
          </h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <Card className="p-5">
              <h3 className="text-base font-semibold">Attestation</h3>
              <p className="mt-2 text-sm text-fg-muted">
                Never issued automatically. Its entire value is that a named human signed it —
                making it automatic would make it worthless.
              </p>
            </Card>
            <Card className="p-5">
              <h3 className="text-base font-semibold">Grading</h3>
              <p className="mt-2 text-sm text-fg-muted">
                No AI-scored rubrics and no AI-written feedback under a faculty member&rsquo;s name.
                An academic assessment must be made and owned by a person. This is an absolute line.
              </p>
            </Card>
            <Card className="p-5">
              <h3 className="text-base font-semibold">Publication</h3>
              <p className="mt-2 text-sm text-fg-muted">
                A project becomes public only when the group requests it and a faculty member
                approves. Nothing is published on anyone&rsquo;s behalf.
              </p>
            </Card>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/explore">See published projects</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/help">Read the guides</Link>
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
