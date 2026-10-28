import type { Metadata } from "next";
import Link from "next/link";

import { CompanyIcon, GlobeIcon, OpportunityIcon } from "@/components/icons";
import { Container, PageHeader } from "@/components/layout/primitives";
import { Badge, Card } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import { Breadcrumbs } from "@/components/ui/navigation";
import { OPPORTUNITY_TYPE_LABEL, publicOpportunities } from "@/content/opportunities";
import { JsonLd, breadcrumbList, itemList } from "@/lib/seo/jsonld";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * The opportunity board.
 *
 * **Only verified organisations appear.** An unverified company cannot post,
 * cannot contact a student and does not appear here — because fake internship
 * listings that charge a "certificate fee" are a real and widespread scam
 * targeting exactly these students. That gate is not a formality, so the page
 * says what it means.
 */
export const metadata: Metadata = buildMetadata({
  title: "Internships and opportunities",
  description:
    "Internships, jobs, research positions and hackathons from verified organisations — matched to students by the project work they have actually published.",
  path: "/opportunities",
});

export default function OpportunitiesPage() {
  const opportunities = publicOpportunities();
  const crumbs = [{ label: "Opportunities", href: "/opportunities" }];

  return (
    <>
      <JsonLd
        data={[
          itemList(
            opportunities.map((o) => ({ name: o.title, url: `/opportunities/${o.slug}` })),
            { name: "Opportunities on Nexivora" },
          ),
          breadcrumbList(crumbs),
        ]}
      />
      <Container className="py-10 md:py-12">
        <Breadcrumbs crumbs={crumbs} className="mb-6" />
        <PageHeader
          eyebrow="Opportunities"
          title="Internships, roles and research positions"
          description="Posted by organisations that completed verification. Applications carry your published project work, so the reviewer sees what you built rather than a claim about it."
        />

        <Alert tone="info" title="Every organisation here is verified" className="mt-8">
          An organisation cannot post, cannot contact a student and does not appear on this page
          until a business check completes. If anyone asks you to pay a fee for an internship or a
          certificate, that is a scam — report it.
        </Alert>

        <div className="mt-8 space-y-4">
          {opportunities.map((opportunity) => (
            <Card key={opportunity.slug} interactive className="relative p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge tone="primary">{OPPORTUNITY_TYPE_LABEL[opportunity.type]}</Badge>
                    <Badge tone="accent">Verified</Badge>
                    {opportunity.remote ? (
                      <Badge tone="outline">
                        <GlobeIcon size={12} /> Remote
                      </Badge>
                    ) : null}
                  </div>

                  <h2 className="font-display text-lg leading-snug font-semibold">
                    <Link
                      href={`/opportunities/${opportunity.slug}`}
                      className="after:absolute after:inset-0"
                    >
                      {opportunity.title}
                    </Link>
                  </h2>

                  <p className="mt-1 flex items-center gap-1.5 text-sm text-fg-subtle">
                    <CompanyIcon size={14} />
                    {opportunity.organisation.name}
                    {opportunity.location ? ` · ${opportunity.location.city}` : ""}
                  </p>

                  <p className="mt-3 text-sm text-fg-muted">{opportunity.summary}</p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {opportunity.skills.slice(0, 4).map((skill) => (
                      <Badge key={skill} tone="outline">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="text-right">
                  {opportunity.stipend ? (
                    <p className="font-display text-lg font-bold">
                      ₹{(opportunity.stipend.min / 1000).toFixed(0)}k–
                      {(opportunity.stipend.max / 1000).toFixed(0)}k
                      <span className="block text-xs font-normal text-fg-subtle">
                        per {opportunity.stipend.unit.toLowerCase()}
                      </span>
                    </p>
                  ) : (
                    <OpportunityIcon size={24} className="ml-auto text-fg-subtle" />
                  )}
                  <p className="mt-2 text-xs text-fg-subtle">
                    Closes{" "}
                    {new Date(opportunity.validThrough).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </>
  );
}
