import type { Metadata } from "next";

import { AudiencePage } from "@/components/marketing/audience-page";
import { audienceBySlug } from "@/content/audiences";
import { buildMetadata } from "@/lib/seo/metadata";

const audience = audienceBySlug["for-students"]!;

export const metadata: Metadata = buildMetadata({
  title: "Nexivora for students",
  description:
    "A permanent record of what you built, contribution backed by evidence, and teammates found by skill rather than by broadcast message.",
  path: "/for-students",
});

export default function Page() {
  return <AudiencePage audience={audience} />;
}
