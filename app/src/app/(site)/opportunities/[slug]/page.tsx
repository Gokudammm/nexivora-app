import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CalendarIcon, CheckIcon, CompanyIcon, ExternalIcon, GlobeIcon } from "@/components/icons";
import { Container, PageHeader } from "@/components/layout/primitives";
import { Badge, Card, Divider } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import { Breadcrumbs } from "@/components/ui/navigation";
import { OPPORTUNITY_TYPE_LABEL, opportunities } from "@/content/opportunities";
import { JsonLd, breadcrumbList, jobPosting } from "@/lib/seo/jsonld";
import { buildMetadata, ensureDescription } from "@/lib/seo/metadata";

/**
 * An opportunity detail page, carrying full `JobPosting` structured data.
 *
 * This is the highest-value schema type available to the product — it makes a
 * listing eligible for Google's job experience. Two things keep that eligibility:
 * every supported field is populated, and **`validThrough` is honoured** — an
 * expired listing is `noindex` rather than left in the index as a stale result.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  // Unverified organisations get no page at all.
  return opportunities.filter((o) => o.organisation.verified).map((o) => ({ slug: o.slug }));
}

function findVerified(slug: string) {
  const opportunity = opportunities.find((o) => o.slug === slug);
  if (!opportunity || !opportunity.organisation.verified) return null;
  return opportunity;
}

export async function generateMetadata(
  props: PageProps<"/opportunities/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const opportunity = findVerified(slug);
  if (!opportunity) {
    return buildMetadata({
      title: "Opportunity not available",
      description: "This opportunity is not publicly listed on Nexivora.",
      path: `/opportunities/${slug}`,
      index: false,
    });
  }

  const expired = new Date(opportunity.validThrough) < new Date();
  return buildMetadata({
    title: opportunity.title,
    description: ensureDescription(
      `${opportunity.summary} ${opportunity.location ? `Based in ${opportunity.location.city}.` : ""}`.trim(),
      `Posted by ${opportunity.organisation.name}, a verified organisation. Apply with your published project work.`,
    ),
    path: `/opportunities/${slug}`,
    og: { eyebrow: opportunity.organisation.name },
    // An expired posting still in the index is a quality problem Google notices.
    index: !expired,
  });
}

export default async function OpportunityPage(props: PageProps<"/opportunities/[slug]">) {
  const { slug } = await props.params;
  const opportunity = findVerified(slug);
  if (!opportunity) notFound();

  const expired = new Date(opportunity.validThrough) < new Date();
  const crumbs = [
    { label: "Opportunities", href: "/opportunities" },
    { label: opportunity.title, href: `/opportunities/${slug}` },
  ];

  return (
    <>
      <JsonLd
        data={[
          jobPosting({
            title: opportunity.title,
            slug: opportunity.slug,
            description: opportunity.description,
            datePosted: opportunity.postedOn,
            validThrough: opportunity.validThrough,
            employmentType: opportunity.employmentType,
            organization: {
              name: opportunity.organisation.name,
              website: opportunity.organisation.website,
            },
            location: opportunity.location,
            remote: opportunity.remote,
            salary: opportunity.stipend,
            skills: opportunity.skills,
            educationRequirements: opportunity.eligibility,
            openings: opportunity.openings,
          }),
          breadcrumbList(crumbs),
        ]}
      />

      <Container className="py-10 md:py-12">
        <Breadcrumbs crumbs={crumbs} className="mb-6" />

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <article className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone="primary">{OPPORTUNITY_TYPE_LABEL[opportunity.type]}</Badge>
              <Badge tone="accent">Verified organisation</Badge>
              {opportunity.remote ? (
                <Badge tone="outline">
                  <GlobeIcon size={12} /> Remote
                </Badge>
              ) : null}
            </div>

            <PageHeader title={opportunity.title} description={opportunity.summary} />

            <p className="mt-4 flex items-center gap-2 text-sm text-fg-muted">
              <CompanyIcon size={16} />
              {opportunity.organisation.name}
              {opportunity.location ? (
                <span>
                  · {opportunity.location.city}, {opportunity.location.state}
                </span>
              ) : null}
            </p>

            {expired ? (
              <Alert tone="warning" title="This opportunity has closed" className="mt-6">
                The application deadline has passed. It is kept for reference and is no longer
                indexed.
              </Alert>
            ) : null}

            <section className="mt-8">
              <h2 className="border-b border-border pb-2 font-display text-xl font-bold">
                About the role
              </h2>
              <p className="mt-4 max-w-[68ch] leading-relaxed text-fg-muted">
                {opportunity.description}
              </p>
            </section>

            <section className="mt-8">
              <h2 className="border-b border-border pb-2 font-display text-xl font-bold">
                What you will do
              </h2>
              <ul className="mt-4 space-y-2.5">
                {opportunity.responsibilities.map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm text-fg-muted">
                    <CheckIcon size={16} className="mt-0.5 shrink-0 text-accent-700" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="border-b border-border pb-2 font-display text-xl font-bold">
                Eligibility
              </h2>
              <p className="mt-4 text-sm text-fg-muted">{opportunity.eligibility}</p>
            </section>
          </article>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card className="p-5">
              {opportunity.stipend ? (
                <>
                  <p className="text-xs tracking-wide text-fg-subtle uppercase">Compensation</p>
                  <p className="mt-1 font-display text-2xl font-bold">
                    ₹{opportunity.stipend.min.toLocaleString("en-IN")} –{" "}
                    {opportunity.stipend.max.toLocaleString("en-IN")}
                  </p>
                  <p className="text-sm text-fg-subtle">
                    per {opportunity.stipend.unit.toLowerCase()}
                  </p>
                  <Divider className="my-4" />
                </>
              ) : null}

              <dl className="space-y-2.5 text-sm">
                <div>
                  <dt className="text-xs text-fg-subtle">Openings</dt>
                  <dd>{opportunity.openings}</dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-subtle">Posted</dt>
                  <dd>{new Date(opportunity.postedOn).toLocaleDateString("en-IN")}</dd>
                </div>
                <div>
                  <dt className="text-xs text-fg-subtle">Closes</dt>
                  <dd className="flex items-center gap-1.5">
                    <CalendarIcon size={14} className="text-fg-subtle" />
                    {new Date(opportunity.validThrough).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </dd>
                </div>
              </dl>

              {opportunity.organisation.website ? (
                <>
                  <Divider className="my-4" />
                  <a
                    href={opportunity.organisation.website}
                    rel="ugc noopener"
                    className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline"
                  >
                    Organisation website <ExternalIcon size={12} />
                  </a>
                </>
              ) : null}
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold">Skills</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {opportunity.skills.map((skill) => (
                  <Badge key={skill} tone="outline">
                    {skill}
                  </Badge>
                ))}
              </div>
            </Card>

            <p className="text-xs text-fg-subtle">
              Applications carry your published project work, so a reviewer sees the methodology and
              results rather than a claim about them.
            </p>
          </aside>
        </div>
      </Container>
    </>
  );
}
