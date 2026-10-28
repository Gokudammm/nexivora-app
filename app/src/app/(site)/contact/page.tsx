import type { Metadata } from "next";
import Link from "next/link";

import { Container, PageHeader, Section } from "@/components/layout/primitives";
import { Card } from "@/components/ui/display";
import { Breadcrumbs } from "@/components/ui/navigation";
import { siteConfig } from "@/config/site";
import { JsonLd, breadcrumbList, contactPage } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Contact",
  description:
    "How to reach Nexivora about a pilot, support, a privacy request or a formal grievance — with the right address for each, not one general inbox.",
  path: "/contact",
});

const ROUTES = [
  {
    title: "Start a pilot",
    body: "One department, one semester, free. Tell us the college, the department and roughly how many students, and we will set it up.",
    email: siteConfig.contact.general,
  },
  {
    title: "Support",
    body: "Something not working, or a guide that is wrong or missing. We treat documentation gaps as defects.",
    email: siteConfig.contact.support,
  },
  {
    title: "Privacy and data",
    body: "Data access, correction or deletion requests, and any question about how your data is handled.",
    email: siteConfig.contact.privacy,
  },
  {
    title: "Grievance officer",
    body: "Formal complaints about content, conduct or a moderation decision. Acknowledged within 24 hours, resolved within 15 days.",
    email: siteConfig.contact.grievance,
  },
];

export default function ContactPage() {
  const crumbs = [{ label: "Contact", href: "/contact" }];

  return (
    <>
      <JsonLd data={[contactPage(), breadcrumbList(crumbs)]} />

      <Section className="pt-10 pb-4 md:pt-12">
        <Container width="reading">
          <Breadcrumbs crumbs={crumbs} className="mb-6" />
          <PageHeader
            eyebrow="Contact"
            title="Get in touch"
            description="Four addresses, so your message reaches the right place rather than a general inbox."
          />
        </Container>
      </Section>

      <Section className="pt-4">
        <Container width="reading">
          <div className="grid gap-4 sm:grid-cols-2">
            {ROUTES.map((route) => (
              <Card key={route.email} className="p-5">
                <h2 className="font-display text-base font-semibold">{route.title}</h2>
                <p className="mt-2 text-sm text-fg-muted">{route.body}</p>
                <a
                  href={`mailto:${route.email}`}
                  className="mt-3 inline-block text-sm text-primary-600 underline-offset-4 hover:underline"
                >
                  {route.email}
                </a>
              </Card>
            ))}
          </div>

          <p className="mt-8 text-sm text-fg-subtle">
            For the statutory details of the grievance process, see{" "}
            <Link href="/legal/grievance" className="text-primary-600 hover:underline">
              the grievance officer page
            </Link>
            .
          </p>
        </Container>
      </Section>
    </>
  );
}
