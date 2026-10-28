import { cn } from "@/lib/utils/cn";

/**
 * The Nexivora logo. One component, every variant.
 *
 * THE MARK is a nexus: three nodes joined by two strokes that together imply a
 * capital N while reading as a small connection graph. The left node sits low,
 * the right node sits high — an ascent — and the diagonal crosses between them.
 *
 * Two deliberate details:
 *   - The top-right node is the largest, so the mark has a focal point rather
 *     than reading as symmetrical decoration.
 *   - It is built from one stroked path plus three circles, so it survives being
 *     rendered at 16px in a browser tab. Verified at 16px, not assumed.
 *
 * THE WORDMARK is a path, not live text, so it cannot drift with a font swap or
 * re-flow differently across platforms.
 *
 * Colour comes from `currentColor` for the strokes and the accent token for the
 * leading node, so the logo themes for free and `mono` needs no separate file.
 *
 * Usage rules (clear space, minimum size, misuse) are in docs/DESIGN-SYSTEM.md.
 */

export type LogoVariant = "lockup" | "stacked" | "mark";
export type LogoSize = "sm" | "md" | "lg";

export type LogoProps = {
  variant?: LogoVariant;
  size?: LogoSize;
  /** Single colour throughout — for print, watermarks and the PDF exports. */
  mono?: boolean;
  /** For dark or coloured backgrounds. */
  reversed?: boolean;
  /**
   * The logo is usually decorative because a text site name sits beside it.
   * When it is the only identification of the page, pass a title.
   */
  title?: string;
  className?: string;
};

const markSizes: Record<LogoSize, number> = { sm: 20, md: 28, lg: 40 };
const lockupHeights: Record<LogoSize, number> = { sm: 20, md: 28, lg: 40 };
const stackedHeights: Record<LogoSize, number> = { sm: 44, md: 62, lg: 88 };

/** The mark geometry, shared by every variant. Drawn on a 32x32 grid. */
function MarkPaths({ mono, reversed }: { mono?: boolean; reversed?: boolean }) {
  const nodeLead = mono
    ? "currentColor"
    : reversed
      ? "var(--color-accent-300)"
      : "var(--color-accent-fill)";
  return (
    <>
      <path
        d="M8 24.5V8.5L24 23.5V7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="24.5" r="3.1" fill="currentColor" />
      <circle cx="16" cy="16" r="2.2" fill="currentColor" opacity={mono ? 1 : 0.55} />
      <circle cx="24" cy="7.5" r="4" fill={nodeLead} />
    </>
  );
}

/**
 * "Nexivora" as outlined paths. Geometric grotesque, tightened tracking,
 * drawn on a 132x24 grid with the baseline at y=18.
 */
function Wordmark() {
  return (
    <g fill="currentColor">
      {/* N */}
      <path d="M2 18V6h2.4l5.2 7.8V6H12v12H9.6L4.4 10.2V18H2z" />
      {/* e */}
      <path d="M18.4 18.2c-2.7 0-4.5-1.8-4.5-4.6s1.8-4.7 4.4-4.7c2.5 0 4.2 1.7 4.2 4.4v.8h-6.3c.1 1.4.9 2.2 2.2 2.2.9 0 1.6-.4 1.9-1.1l2 .6c-.6 1.5-2 2.4-3.9 2.4zm-2.1-5.6h4c-.1-1.2-.8-1.9-1.9-1.9s-1.9.7-2.1 1.9z" />
      {/* x */}
      <path d="M23.6 18l3.1-4.4-2.9-4.4h2.5l1.8 2.9 1.8-2.9h2.4l-2.9 4.3 3.1 4.5h-2.5l-2-3-2 3h-2.4z" />
      {/* i */}
      <path d="M34.5 7.8c0-.7.6-1.3 1.3-1.3s1.3.6 1.3 1.3-.6 1.3-1.3 1.3-1.3-.6-1.3-1.3zM34.7 18V9.2h2.2V18h-2.2z" />
      {/* v */}
      <path d="M38.4 9.2h2.4l2.3 6.3 2.3-6.3h2.3L44.2 18h-2.4l-3.4-8.8z" />
      {/* o */}
      <path d="M53 18.2c-2.7 0-4.6-1.9-4.6-4.7s1.9-4.6 4.6-4.6 4.6 1.9 4.6 4.6-1.9 4.7-4.6 4.7zm0-2c1.4 0 2.3-1 2.3-2.7s-.9-2.6-2.3-2.6-2.3 1-2.3 2.6.9 2.7 2.3 2.7z" />
      {/* r */}
      <path d="M59.3 18V9.2h2.1v1.4c.5-1.1 1.4-1.6 2.6-1.6h.5v2.2h-.7c-1.5 0-2.3.9-2.3 2.5V18h-2.2z" />
      {/* a */}
      <path d="M68.1 18.2c-1.8 0-3-1-3-2.6 0-1.7 1.2-2.5 3.6-2.8l2.1-.3v-.3c0-.9-.6-1.4-1.7-1.4-1 0-1.6.4-1.8 1.3l-2-.5c.4-1.6 1.8-2.6 3.9-2.6 2.4 0 3.8 1.2 3.8 3.3V18h-2.1v-1.2c-.6.9-1.6 1.4-2.8 1.4zm.6-1.7c1.3 0 2.1-.8 2.1-2v-.4l-1.8.3c-1.1.2-1.6.5-1.6 1.2s.5 1 1.3 1z" />
    </g>
  );
}

export function Logo({
  variant = "lockup",
  size = "md",
  mono = false,
  reversed = false,
  title,
  className,
}: LogoProps) {
  const a11y = title
    ? ({ role: "img" as const, "aria-label": title } as const)
    : ({ "aria-hidden": true as const, focusable: "false" as const } as const);

  if (variant === "mark") {
    const px = markSizes[size];
    return (
      <svg
        viewBox="0 0 32 32"
        width={px}
        height={px}
        className={cn("shrink-0", className)}
        {...a11y}
      >
        {title ? <title>{title}</title> : null}
        <MarkPaths mono={mono} reversed={reversed} />
      </svg>
    );
  }

  if (variant === "stacked") {
    const h = stackedHeights[size];
    return (
      <svg
        viewBox="0 0 132 76"
        height={h}
        width={(h * 132) / 76}
        className={cn("shrink-0", className)}
        {...a11y}
      >
        {title ? <title>{title}</title> : null}
        <g transform="translate(50 0) scale(1.03)">
          <MarkPaths mono={mono} reversed={reversed} />
        </g>
        <g transform="translate(28.75 50)">
          <Wordmark />
        </g>
      </svg>
    );
  }

  // lockup — the default
  const h = lockupHeights[size];
  return (
    <svg
      viewBox="0 0 113 32"
      height={h}
      width={(h * 113) / 32}
      className={cn("shrink-0", className)}
      {...a11y}
    >
      {title ? <title>{title}</title> : null}
      <MarkPaths mono={mono} reversed={reversed} />
      <g transform="translate(36 4)">
        <Wordmark />
      </g>
    </svg>
  );
}
