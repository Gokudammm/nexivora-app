import { cn } from "@/lib/utils/cn";

/**
 * Deterministically generated imagery.
 *
 * This is the file that makes seeded data look alive. Every user gets a real
 * avatar and every project gets a real cover with **zero upload effort**, which
 * removes the single biggest reason a project page would look half-finished.
 *
 * Both are inline SVG rather than data-URI images, deliberately: a data URI
 * cannot resolve CSS custom properties, so it would not theme. Inline SVG picks
 * up `var(--color-domain-*)` and re-themes for free.
 *
 * The palette is the eight-colour domain set, which is already contrast-checked
 * in both themes by scripts/check-contrast.mjs — so a generated image can never
 * introduce an unverified colour.
 */

/** FNV-1a. Small, fast, and stable across processes — which matters, because an
 *  avatar that changes between server and client renders is a hydration bug. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export const DOMAIN_COLOR_VARS = [
  "--color-domain-ai",
  "--color-domain-software",
  "--color-domain-hardware",
  "--color-domain-healthcare",
  "--color-domain-education",
  "--color-domain-sustainability",
  "--color-domain-social",
  "--color-domain-research",
] as const;

export type DomainKey =
  | "ai"
  | "software"
  | "hardware"
  | "healthcare"
  | "education"
  | "sustainability"
  | "social"
  | "research";

export function domainColorVar(domain?: DomainKey, seed = ""): string {
  if (domain) return `var(--color-domain-${domain})`;
  const index = hashString(seed) % DOMAIN_COLOR_VARS.length;
  return `var(${DOMAIN_COLOR_VARS[index] ?? DOMAIN_COLOR_VARS[0]})`;
}

/* -------------------------------------------------------------------------- */
/* Avatar                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A deterministic identicon: a small node-graph motif in a hashed domain hue,
 * echoing the logo's language. Never a grey silhouette.
 */
export function GeneratedAvatar({
  seed,
  size = 40,
  className,
}: {
  /** Stable per user — the user id, never the display name. */
  seed: string;
  size?: number;
  className?: string;
}) {
  const h = hashString(seed);
  const color = domainColorVar(undefined, seed);

  // Four node slots on a 40x40 grid; the hash decides which three are filled
  // and where the edges run, giving 8 x 4 x 3 distinct, recognisable marks.
  const slots = [
    { x: 12, y: 12 },
    { x: 28, y: 12 },
    { x: 12, y: 28 },
    { x: 28, y: 28 },
  ] as const;

  const skip = h % 4;
  const nodes = slots.filter((_, i) => i !== skip);
  const big = (h >> 3) % nodes.length;
  const tilt = (h >> 5) % 2 === 0;

  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <rect width="40" height="40" rx="20" fill={color} opacity="0.16" />
      <g stroke={color} strokeWidth="2.4" strokeLinecap="round" fill="none">
        {nodes.length > 1 && nodes[0] && nodes[1] ? (
          <path d={`M${nodes[0].x} ${nodes[0].y}L${nodes[1].x} ${nodes[1].y}`} />
        ) : null}
        {nodes.length > 2 && nodes[1] && nodes[2] ? (
          <path d={`M${nodes[1].x} ${nodes[1].y}L${nodes[2].x} ${nodes[2].y}`} />
        ) : null}
        {tilt && nodes[0] && nodes[2] ? (
          <path d={`M${nodes[0].x} ${nodes[0].y}L${nodes[2].x} ${nodes[2].y}`} opacity="0.45" />
        ) : null}
      </g>
      {nodes.map((n, i) => (
        <circle key={`${n.x}-${n.y}`} cx={n.x} cy={n.y} r={i === big ? 5 : 3.4} fill={color} />
      ))}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Project cover                                                               */
/* -------------------------------------------------------------------------- */

export type ProjectCoverInput = {
  /** Stable per project — the slug or id. */
  seed: string;
  title: string;
  domain?: DomainKey;
  /** SDG goal numbers, 1-17. Up to three are drawn. */
  sdgs?: number[];
};

/**
 * A generated 16:9 cover built from the project's domain colour, a hashed
 * geometric field and its SDG marks. Every project card looks intentional
 * without anyone uploading anything.
 */
export function GeneratedProjectCover({
  seed,
  title,
  domain,
  sdgs = [],
  className,
}: ProjectCoverInput & { className?: string }) {
  const h = hashString(seed);
  const color = domainColorVar(domain, seed);
  const variant = h % 3;

  return (
    <svg
      viewBox="0 0 320 180"
      role="img"
      aria-label={`Cover image for ${title}`}
      className={cn("h-auto w-full", className)}
      /* `slice` fills the container and crops, so a card (16:9) and a detail
         banner (3:1) can share one generated cover without letterboxing. */
      preserveAspectRatio="xMidYMid slice"
    >
      <title>{`Cover image for ${title}`}</title>
      <rect width="320" height="180" fill="var(--color-surface-raised)" />
      <rect width="320" height="180" fill={color} opacity="0.1" />

      {variant === 0 ? (
        <g stroke={color} strokeWidth="2" fill="none" opacity="0.55">
          <path d="M-10 140 90 40l100 100L290 40" />
          <path d="M-10 170 90 70l100 100L290 70" opacity="0.5" />
          <circle cx="90" cy="40" r="7" fill={color} stroke="none" />
          <circle cx="190" cy="140" r="5" fill={color} stroke="none" opacity="0.7" />
        </g>
      ) : null}

      {variant === 1 ? (
        <g fill={color} opacity="0.5">
          {Array.from({ length: 7 }).map((_, col) =>
            Array.from({ length: 4 }).map((__, row) => {
              const on = (hashString(`${seed}${col}${row}`) >> 2) % 3 !== 0;
              return on ? (
                <circle
                  key={`${col}-${row}`}
                  cx={28 + col * 44}
                  cy={30 + row * 40}
                  r={(col + row) % 3 === 0 ? 8 : 4}
                />
              ) : null;
            }),
          )}
        </g>
      ) : null}

      {variant === 2 ? (
        <g stroke={color} strokeWidth="2.5" fill="none" opacity="0.5">
          <circle cx="250" cy="46" r="46" />
          <circle cx="250" cy="46" r="28" opacity="0.6" />
          <path d="M0 132h200M0 152h150" strokeWidth="3" strokeLinecap="round" />
          <circle cx="250" cy="46" r="10" fill={color} stroke="none" />
        </g>
      ) : null}

      {/* SDG marks, up to three, bottom-left */}
      {sdgs.slice(0, 3).map((goal, i) => (
        <g key={goal} transform={`translate(${16 + i * 30} 140)`}>
          <rect width="24" height="24" rx="6" fill={color} opacity="0.9" />
          <text
            x="12"
            y="16.5"
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
            fill="var(--color-surface)"
            fontFamily="var(--font-mono)"
          >
            {goal}
          </text>
        </g>
      ))}
    </svg>
  );
}
