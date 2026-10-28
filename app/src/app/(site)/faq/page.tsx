import type { Metadata } from "next";

import { Container, PageHeader, Section } from "@/components/layout/primitives";
import { Accordion } from "@/components/ui/overlay";
import { Breadcrumbs } from "@/components/ui/navigation";
import { collegeFaqs, companyFaqs, facultyFaqs, generalFaqs, studentFaqs } from "@/content/faqs";
import { JsonLd, breadcrumbList, faqPage } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Frequently asked questions",
  description:
    "What Nexivora is, how it differs from LinkedIn and an LMS, who owns student work, what it costs, and why the AI layer is deliberately built last.",
  path: "/faq",
});

const GROUPS = [
  { title: "General", faqs: generalFaqs },
  { title: "For students", faqs: studentFaqs },
  { title: "For faculty", faqs: facultyFaqs },
  { title: "For institutions", faqs: collegeFaqs },
  { title: "For companies", faqs: companyFaqs },
];

export default function FaqPage() {
  const crumbs = [{ label: "FAQ", href: "/faq" }];
  const all = GROUPS.flatMap((g) => g.faqs);

  return (
    <>
      <JsonLd data={[faqPage(all), breadcrumbList(crumbs)]} />

      <Section className="pt-10 pb-4 md:pt-12">
        <Container width="reading">
          <Breadcrumbs crumbs={crumbs} className="mb-6" />
          <PageHeader
            eyebrow="FAQ"
            title="Questions, including the awkward ones"
            description="An FAQ that only asks flattering questions is marketing copy. These are the ones people actually ask."
          />
        </Container>
      </Section>

      <Section className="pt-4">
        <Container width="reading">
          <div className="space-y-10">
            {GROUPS.map((group) => (
              <section key={group.title}>
                <h2 className="border-b border-border pb-2 font-display text-xl font-bold">
                  {group.title}
                </h2>
                <Accordion
                  className="mt-2"
                  items={group.faqs.map((faq, i) => ({
                    value: `${group.title}-${i}`,
                    trigger: faq.question,
                    content: faq.answer,
                  }))}
                />
              </section>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
