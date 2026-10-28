import Link from "next/link";

import { AlertIcon, CheckCircleIcon } from "@/components/icons";
import { CollaborationScene } from "@/components/illustrations";
import { Container, PageHeader, Section } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { Accordion } from "@/components/ui/overlay";
import type { Audience } from "@/content/audiences";
import { JsonLd, breadcrumbList, faqPage } from "@/lib/seo/jsonld";

/**
 * One component renders all five audience landing pages.
 *
 * They share a structure — pain, then answer, then the sentence that lands,
 * then genuine FAQs — because that is the structure that works for this kind of
 * page. The *content* differs entirely; only the scaffolding is shared.
 */
export function AudiencePage({ audience }: { audience: Audience }) {
  const crumbs = [{ label: audience.nav, href: `/${audience.slug}` }];

  return (
    <>
      <JsonLd data={[faqPage(audience.faqs), breadcrumbList(crumbs)]} />

      <Section className="pt-10 pb-4 md:pt-12">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <PageHeader
                eyebrow={audience.eyebrow}
                title={audience.title}
                description={audience.lead}
              />
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href={audience.cta.href}>{audience.cta.label}</Link>
                </Button>
                {audience.secondaryCta ? (
                  <Button asChild size="lg" variant="outline">
                    <Link href={audience.secondaryCta.href}>{audience.secondaryCta.label}</Link>
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="hidden lg:block">
              <CollaborationScene width={260} />
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="raised">
        <Container>
          <h2 className="font-display text-xl font-bold md:text-2xl">What actually goes wrong</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {audience.pains.map((pain) => (
              <Card key={pain.title} className="p-5">
                <AlertIcon size={20} className="text-warning" />
                <h3 className="mt-3 font-display text-base font-semibold">{pain.title}</h3>
                <p className="mt-2 text-sm text-fg-muted">{pain.body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <h2 className="font-display text-xl font-bold md:text-2xl">
            What Nexivora does about it
          </h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {audience.gains.map((gain) => (
              <Card key={gain.title} className="p-5">
                <CheckCircleIcon size={20} className="text-accent-700" />
                <h3 className="mt-3 font-display text-base font-semibold">{gain.title}</h3>
                <p className="mt-2 text-sm text-fg-muted">{gain.body}</p>
              </Card>
            ))}
          </div>

          <blockquote className="mt-12 max-w-2xl border-l-4 border-primary-600 pl-5">
            <p className="font-display text-lg font-semibold md:text-xl">{audience.pitch}</p>
          </blockquote>
        </Container>
      </Section>

      <Section tone="raised">
        <Container width="reading">
          <h2 className="font-display text-xl font-bold md:text-2xl">Questions</h2>
          <Accordion
            className="mt-4"
            items={audience.faqs.map((faq, i) => ({
              value: `faq-${i}`,
              trigger: faq.question,
              content: faq.answer,
            }))}
          />
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={audience.cta.href}>{audience.cta.label}</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/faq">All questions</Link>
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
