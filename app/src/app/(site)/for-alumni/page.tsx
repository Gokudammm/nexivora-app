import type { Metadata } from "next";

import { AudiencePage } from "@/components/marketing/audience-page";
import { audienceBySlug } from "@/content/audiences";
import { buildMetadata } from "@/lib/seo/metadata";

const audience = audienceBySlug["for-alumni"]!;

export const metadata: Metadata = buildMetadata({
  title: "Nexivora for alumni",
  description:
    "Scoped, specific mentorship with a stated goal and full project context, plus capacity limits so willing mentors do not get buried.",
  path: "/for-alumni",
});

export default function Page() {
  return <AudiencePage audience={audience} />;
}
