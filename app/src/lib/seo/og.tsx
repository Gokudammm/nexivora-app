import { ImageResponse } from "next/og";

import { siteConfig } from "@/config/site";

/**
 * One OG image template, every page type.
 *
 * Built from the same visual language as the brand — the nexus mark, the iris
 * and cyan palette, the display face — so a shared link is recognisably ours.
 *
 * Two constraints shaped this:
 *
 *  1. **`ImageResponse` uses Satori**, which supports a deliberate subset of
 *     CSS. No CSS custom properties, no `gap` on block layout, no shorthand
 *     `background`. So the palette is repeated here as literals rather than
 *     read from the token file — the one place in the project where that is
 *     correct, and it is why the values carry the token name in a comment.
 *  2. **1200x630 with `max-image-preview:large`** is what makes a link render
 *     as a large card, and it is also the Discover requirement
 *     (`Google Discover.txt`: images at least 1200px wide).
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/* Token values, mirrored. See note 1 above. */
const SURFACE = "#ffffff";
const FG = "#0f172a";
const FG_MUTED = "#475569";
const FG_SUBTLE = "#64748b";
const PRIMARY = "#4f46e5"; // --color-primary-fill
const ACCENT = "#0e7490"; // --color-accent-fill
const BORDER = "#e2e8f0";

export type OgInput = {
  /** The headline. Kept to ~90 characters before it is visually crowded. */
  title: string;
  /** Small label above the title — the section, domain or college. */
  eyebrow?: string;
  /** One line below the title. */
  description?: string;
  /** Bottom-left metadata chips, e.g. status or SDG numbers. */
  chips?: string[];
  /** Overrides the accent colour, e.g. to a project's domain colour. */
  accent?: string;
};

/** The nexus mark, inline. Satori renders SVG children but not external files. */
function Mark({ size = 56, accent = ACCENT }: { size?: number; accent?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <rect width="32" height="32" rx="7" fill={PRIMARY} />
      <path
        d="M9 23.5V9.5L23 22.5V8.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="23.5" r="2.75" fill="#ffffff" />
      <circle cx="23" cy="8.5" r="3.5" fill={accent === ACCENT ? "#67e8f9" : accent} />
    </svg>
  );
}

export function ogImage(input: OgInput) {
  const { title, eyebrow, description, chips = [], accent = ACCENT } = input;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: SURFACE,
        padding: "64px 72px",
        fontFamily: "sans-serif",
        position: "relative",
      }}
    >
      {/* Accent rule along the top — the one piece of chrome that makes the
            card identifiable at thumbnail size. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 10,
          backgroundColor: accent,
          display: "flex",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column" }}>
        {eyebrow ? (
          <div
            style={{
              display: "flex",
              fontSize: 24,
              fontWeight: 600,
              color: accent,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            {eyebrow}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            fontSize: title.length > 60 ? 58 : 68,
            fontWeight: 800,
            color: FG,
            lineHeight: 1.12,
            letterSpacing: "-0.02em",
            maxWidth: 1000,
          }}
        >
          {title}
        </div>

        {description ? (
          <div
            style={{
              display: "flex",
              fontSize: 28,
              color: FG_MUTED,
              lineHeight: 1.4,
              marginTop: 24,
              maxWidth: 900,
            }}
          >
            {description}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          borderTop: `2px solid ${BORDER}`,
          paddingTop: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <Mark accent={accent} />
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 18 }}>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: FG }}>
              {siteConfig.name}
            </div>
            <div style={{ display: "flex", fontSize: 20, color: FG_SUBTLE, marginTop: 2 }}>
              {siteConfig.tagline}
            </div>
          </div>
        </div>

        {chips.length > 0 ? (
          <div style={{ display: "flex" }}>
            {chips.slice(0, 4).map((chip) => (
              <div
                key={chip}
                style={{
                  display: "flex",
                  fontSize: 20,
                  fontWeight: 600,
                  color: FG_MUTED,
                  border: `2px solid ${BORDER}`,
                  borderRadius: 999,
                  padding: "8px 18px",
                  marginLeft: 10,
                }}
              >
                {chip}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>,
    OG_SIZE,
  );
}
