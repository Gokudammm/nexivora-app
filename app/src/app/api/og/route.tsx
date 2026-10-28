import type { NextRequest } from "next/server";

import { ogImage } from "@/lib/seo/og";
import { siteConfig } from "@/config/site";

/**
 * OG image generation at a **stable, predictable URL**.
 *
 * Why a route handler rather than the file-based `opengraph-image.tsx`
 * convention, which is the obvious choice:
 *
 *  1. Next content-hashes generated image filenames (`opengraph-image-umay0l`),
 *     so the URL cannot be constructed by hand — and a hand-written one 404s,
 *     which renders the link preview blank.
 *  2. Setting `openGraph` in a page's exported metadata suppresses the
 *     file-convention image. Every page here goes through `buildMetadata`,
 *     which sets `openGraph`, so the convention was silently doing nothing on
 *     all ~90 pages. The Phase 2 SEO audit is what surfaced it.
 *  3. One route gives every page a tailored card without a co-located file per
 *     route segment.
 *
 * Inputs are capped and treated as display text only — this endpoint renders
 * whatever it is given, so it must never be able to render something enormous.
 */

export const runtime = "nodejs";

const MAX_TITLE = 110;
const MAX_DESCRIPTION = 160;
const MAX_EYEBROW = 40;
const MAX_CHIPS = 4;
const MAX_CHIP = 24;

/** Only colours from our own contrast-checked set may be requested. */
const ACCENTS: Record<string, string> = {
  default: "#0e7490",
  ai: "#4f46e5",
  software: "#0e7490",
  hardware: "#b45309",
  healthcare: "#be123c",
  education: "#7e22ce",
  sustainability: "#047857",
  social: "#c2410c",
  research: "#1d4ed8",
};

function clamp(value: string | null, max: number): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const title =
    clamp(params.get("title"), MAX_TITLE) ?? `${siteConfig.name} — ${siteConfig.descriptor}`;
  const eyebrow = clamp(params.get("eyebrow"), MAX_EYEBROW);
  const description = clamp(params.get("description"), MAX_DESCRIPTION);
  const accent = ACCENTS[params.get("accent") ?? "default"] ?? ACCENTS.default;

  const chips = (params.get("chips") ?? "")
    .split(",")
    .map((chip) => clamp(chip, MAX_CHIP))
    .filter((chip): chip is string => Boolean(chip))
    .slice(0, MAX_CHIPS);

  return ogImage({ title, eyebrow, description, chips, accent });
}
