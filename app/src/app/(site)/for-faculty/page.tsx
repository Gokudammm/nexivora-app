import type { Metadata } from "next";

import { AudiencePage } from "@/components/marketing/audience-page";
import { audienceBySlug } from "@/content/audiences";
import { buildMetadata } from "@/lib/seo/metadata";

const audience = audienceBySlug["for-faculty"]!;

export const metadata: Metadata = buildMetadata({
  title: "Nexivora for faculty",
  description:
    "See what every group is actually doing, and who in each group is doing it, without having to ask. Evidence-backed marks and evaluation that compiles itself.",
  path: "/for-faculty",
});

export default function Page() {
  return <AudiencePage audience={audience} />;
}
