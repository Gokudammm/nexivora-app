import type { Metadata } from "next";

import { StyleGuide } from "@/app/(site)/style-guide/style-guide";
import { buildMetadata } from "@/lib/seo/metadata";

/**
 * The style guide is the reference, the review surface and the regression test.
 * **A component that is not on this page does not exist.**
 *
 * noindex: it is an internal tool, not content. The site layout supplies
 * Header, Footer and the `main` landmark.
 */
export const metadata: Metadata = buildMetadata({
  title: "Style guide",
  description:
    "Every Nexivora component, in every variant and state, rendered in both themes. The design system reference and the regression surface for the whole product.",
  path: "/style-guide",
  index: false,
});

export default function StyleGuidePage() {
  return <StyleGuide />;
}
