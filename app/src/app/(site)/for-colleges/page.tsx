import type { Metadata } from "next";

import { AudiencePage } from "@/components/marketing/audience-page";
import { audienceBySlug } from "@/content/audiences";
import { buildMetadata } from "@/lib/seo/metadata";

const audience = audienceBySlug["for-colleges"]!;

export const metadata: Metadata = buildMetadata({
  title: "Nexivora for colleges",
  description:
    "Accreditation evidence exported rather than reconstructed, an archive that compounds year on year, and project-level SDG reporting you can defend.",
  path: "/for-colleges",
});

export default function Page() {
  return <AudiencePage audience={audience} />;
}
