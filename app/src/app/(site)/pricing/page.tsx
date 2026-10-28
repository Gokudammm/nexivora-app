import type { Metadata } from "next";
import Link from "next/link";

import { CheckIcon, CloseIcon } from "@/components/icons";
import { Container, PageHeader, Section } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/display";
import { Accordion } from "@/components/ui/overlay";
import { Breadcrumbs } from "@/components/ui/navigation";
import { collegeFaqs } from "@/content/faqs";
import { JsonLd, breadcrumbList, faqPage } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";
import { cn } from "@/lib/utils/cn";

/**
 * Pricing.
 *
 * Priced from docs/BUSINESS-MODEL.md, with one design constraint that shapes
 * the whole page: **a Head of Department must be able to approve it without a
 * procurement process.** A price that needs a tender adds a year to the sales
 * cycle, so the pilot — free, no card, no purchase decision — is the primary
 * call to action and everything else is secondary.
 */
export const metadata: Metadata = buildMetadata({
  title: "Pricing",
  description:
    "Free forever for students, faculty and alumni. Institutions start with a free one-semester pilot. No ads, no data sale, no billing surprises.",
  path: "/pricing",
});

const TIERS = [
  {
    name: "Pilot",
    price: "Free",
    unit: "one semester",
    for: "One department, up to 300 students",
    highlight: true,
    cta: { label: "Start a pilot", href: "/contact" },
    includes: [
      "The complete product",
      "Group workspaces and the contribution ledger",
      "Faculty dashboards, rubrics and attestation",
      "The project archive with lineage",
      "Setup and support included",
      "No card, no purchase order",
    ],
  },
  {
    name: "Department",
    price: "₹25,000",
    unit: "per year",
    for: "One department, up to 500 students",
    cta: { label: "Talk to us", href: "/contact" },
    includes: [
      "Everything in the pilot",
      "Department analytics",
      "Unlimited projects and archive",
      "CSV and PDF export",
      "Email support",
    ],
  },
  {
    name: "Institution",
    price: "₹1,50,000",
    unit: "per year",
    for: "Whole college, unlimited students",
    popular: true,
    cta: { label: "Talk to us", href: "/contact" },
    includes: [
      "Everything in Department",
      "**Accreditation exports** — NAAC, NBA, NIRF, AICTE",
      "All departments and the admin console",
      "SDG and impact reporting",
      "College branding and public college page",
      "Priority support",
    ],
  },
  {
    name: "Institution+",
    price: "₹3,00,000",
    unit: "per year",
    for: "Multi-campus institutions",
    cta: { label: "Talk to us", href: "/contact" },
    includes: [
      "Everything in Institution",
      "Multi-campus rollup reporting",
      "API access",
      "SSO",
      "Self-hosting option",
      "A named success contact",
    ],
  },
];

const NEVER = [
  "Ads, anywhere",
  "Selling or sharing student data",
  "Pay-to-rank placement in the feed or in search",
  "Charging a student to see who viewed their profile",
  "Charging students or faculty anything, ever",
];

export default function PricingPage() {
  const crumbs = [{ label: "Pricing", href: "/pricing" }];

  return (
    <>
      <JsonLd data={[faqPage(collegeFaqs), breadcrumbList(crumbs)]} />

      <Section className="pt-10 pb-4 md:pt-12">
        <Container>
          <Breadcrumbs crumbs={crumbs} className="mb-6" />
          <PageHeader
            eyebrow="Pricing"
            title="Free for students and faculty. Always."
            description="Institutions pay, because institutions get the thing worth paying for: accreditation evidence generated from data the platform already holds, and an archive that compounds."
          />
        </Container>
      </Section>

      <Section className="pt-4">
        <Container>
          <div className="grid gap-5 lg:grid-cols-4">
            {TIERS.map((tier) => (
              <Card
                key={tier.name}
                className={cn(
                  "flex flex-col p-6",
                  tier.highlight && "border-2 border-accent-600",
                  tier.popular && "border-2 border-primary-600",
                )}
              >
                {tier.highlight ? (
                  <Badge tone="accent" className="mb-3 self-start">
                    Start here
                  </Badge>
                ) : null}
                {tier.popular ? (
                  <Badge tone="primary" className="mb-3 self-start">
                    Most institutions
                  </Badge>
                ) : null}

                <h2 className="font-display text-lg font-semibold">{tier.name}</h2>
                <p className="mt-2 font-display text-3xl font-bold">{tier.price}</p>
                <p className="text-sm text-fg-subtle">{tier.unit}</p>
                <p className="mt-3 text-sm text-fg-muted">{tier.for}</p>

                <ul className="mt-5 flex-1 space-y-2">
                  {tier.includes.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-fg-muted">
                      <CheckIcon size={16} className="mt-0.5 shrink-0 text-accent-700" />
                      <span>{emphasise(item)}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  className="mt-6"
                  variant={tier.highlight || tier.popular ? "primary" : "outline"}
                  fullWidth
                >
                  <Link href={tier.cta.href}>{tier.cta.label}</Link>
                </Button>
              </Card>
            ))}
          </div>

          <p className="mt-6 text-sm text-fg-subtle">
            At ₹1,50,000 for a 3,000-student college that is ₹50 per student per year — less than a
            single printed project report, and a rounding error against the faculty time the
            accreditation export alone replaces.
          </p>
        </Container>
      </Section>

      <Section tone="raised">
        <Container>
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-xl font-bold md:text-2xl">What we will never do</h2>
              <p className="mt-3 text-sm text-fg-muted">
                Stated publicly because it is a differentiator, and because breaking any of these
                once would destroy the institutional trust the whole product depends on.
              </p>
              <ul className="mt-5 space-y-2.5">
                {NEVER.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm">
                    <CloseIcon size={16} className="mt-0.5 shrink-0 text-danger" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="font-display text-xl font-bold md:text-2xl">Questions</h2>
              <Accordion
                className="mt-4"
                items={collegeFaqs.map((faq, i) => ({
                  value: `faq-${i}`,
                  trigger: faq.question,
                  content: faq.answer,
                }))}
              />
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}

/**
 * Renders `**bold**` as React elements rather than an HTML string.
 *
 * Trivial here because the content is ours — but `dangerouslySetInnerHTML` in a
 * page is a pattern that gets copied into one that renders user content, and
 * that is where it becomes a vulnerability. The project has exactly one rule
 * about this (see components/content/rich-text.tsx) and this page follows it.
 */
function emphasise(text: string): React.ReactNode[] {
  return text.split(/(\*\*.+?\*\*)/g).map((part, i) =>
    part.startsWith("**") ? (
      <strong key={i} className="text-fg">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}
