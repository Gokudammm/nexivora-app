import type { Metadata } from "next";

import { AudiencePage } from "@/components/marketing/audience-page";
import { audienceBySlug } from "@/content/audiences";
import { buildMetadata } from "@/lib/seo/metadata";

const audience = audienceBySlug["for-companies"]!;

export const metadata: Metadata = buildMetadata({
  title: "Nexivora for companies",
  description:
    "Hire on evidence rather than a resume bullet: read the real project, the methodology and the results, and filter to faculty-attested work.",
  path: "/for-companies",
});

export default function Page() {
  return <AudiencePage audience={audience} />;
}
