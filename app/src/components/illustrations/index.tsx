import { cn } from "@/lib/utils/cn";

/**
 * Scene illustrations.
 *
 * Geometric and structural — nodes, edges, cards, arcs, grids — built from the
 * same visual language as the logo. Abstract rather than figurative: cheaper to
 * draw, ages better, avoids the generic-corporate-illustration look, and never
 * has to depict a person of a particular appearance.
 *
 * Theme-aware through CSS variables, so one file serves both themes. All are
 * decorative (`aria-hidden`) — the surrounding EmptyState carries the meaning.
 */

type SceneProps = { className?: string; width?: number };

function Scene({
  className,
  width = 220,
  viewBox = "0 0 220 160",
  children,
}: SceneProps & { viewBox?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox={viewBox}
      width={width}
      height={(width * 160) / 220}
      fill="none"
      aria-hidden
      focusable="false"
      className={cn("shrink-0", className)}
    >
      {children}
    </svg>
  );
}

const stroke = "var(--color-border-strong)";
const faint = "var(--color-border)";
const brand = "var(--color-primary-600)";
const accent = "var(--color-accent-600)";
const surfaceRaised = "var(--color-surface-raised)";

/** Empty workspace — a board with no cards yet. */
export function EmptyWorkspaceScene(p: SceneProps) {
  return (
    <Scene {...p}>
      <rect x="18" y="24" width="56" height="112" rx="8" fill={surfaceRaised} stroke={faint} />
      <rect x="82" y="24" width="56" height="112" rx="8" fill={surfaceRaised} stroke={faint} />
      <rect x="146" y="24" width="56" height="112" rx="8" fill={surfaceRaised} stroke={faint} />
      <path
        d="M30 40h32M94 40h28M158 40h32"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect
        x="28"
        y="56"
        width="36"
        height="22"
        rx="5"
        fill="none"
        stroke={brand}
        strokeWidth="2"
        strokeDasharray="5 4"
      />
      <rect
        x="92"
        y="56"
        width="36"
        height="22"
        rx="5"
        fill="none"
        stroke={faint}
        strokeWidth="2"
        strokeDasharray="5 4"
      />
      <circle cx="174" cy="72" r="13" fill="none" stroke={accent} strokeWidth="2.5" />
      <path d="M174 66v12M168 72h12" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
    </Scene>
  );
}

/** Empty feed — cards waiting for activity. */
export function EmptyFeedScene(p: SceneProps) {
  return (
    <Scene {...p}>
      <rect x="30" y="18" width="160" height="46" rx="10" fill={surfaceRaised} stroke={faint} />
      <circle cx="52" cy="41" r="11" fill="none" stroke={brand} strokeWidth="2.5" />
      <path d="M72 34h84M72 46h56" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      <rect
        x="30"
        y="74"
        width="160"
        height="46"
        rx="10"
        fill="none"
        stroke={faint}
        strokeDasharray="6 5"
      />
      <circle cx="52" cy="97" r="11" fill="none" stroke={faint} strokeWidth="2.5" />
      <path d="M72 90h64M72 102h40" stroke={faint} strokeWidth="3" strokeLinecap="round" />
      <path d="M78 136h64" stroke={accent} strokeWidth="3" strokeLinecap="round" />
      <circle cx="110" cy="136" r="5" fill={accent} />
    </Scene>
  );
}

/** No results — a search that found nothing. */
export function NoResultsScene(p: SceneProps) {
  return (
    <Scene {...p}>
      <circle cx="96" cy="72" r="42" fill={surfaceRaised} stroke={stroke} strokeWidth="3" />
      <path d="m128 104 26 26" stroke={stroke} strokeWidth="6" strokeLinecap="round" />
      <path d="M80 60h32M80 74h20" stroke={faint} strokeWidth="4" strokeLinecap="round" />
      <path d="m84 86 24 0" stroke={faint} strokeWidth="4" strokeLinecap="round" />
      <circle cx="168" cy="40" r="6" fill={accent} opacity="0.5" />
      <circle cx="42" cy="128" r="4" fill={brand} opacity="0.4" />
    </Scene>
  );
}

/** Collaboration — the nexus motif at scene scale. */
export function CollaborationScene(p: SceneProps) {
  return (
    <Scene {...p}>
      <path d="M62 116 110 44l48 72" stroke={faint} strokeWidth="2.5" />
      <path d="M62 116h96" stroke={faint} strokeWidth="2.5" />
      <path d="M110 44v72" stroke={faint} strokeWidth="2.5" strokeDasharray="6 5" />
      <circle cx="110" cy="44" r="16" fill={surfaceRaised} stroke={brand} strokeWidth="3" />
      <circle cx="62" cy="116" r="13" fill={surfaceRaised} stroke={stroke} strokeWidth="3" />
      <circle cx="158" cy="116" r="13" fill={surfaceRaised} stroke={stroke} strokeWidth="3" />
      <circle cx="110" cy="116" r="9" fill={accent} />
      <circle cx="34" cy="60" r="5" fill={brand} opacity="0.35" />
      <circle cx="188" cy="66" r="6" fill={accent} opacity="0.35" />
    </Scene>
  );
}

/** Archive — stacked, permanent records. */
export function ArchiveScene(p: SceneProps) {
  return (
    <Scene {...p}>
      <rect
        x="40"
        y="102"
        width="140"
        height="30"
        rx="7"
        fill={surfaceRaised}
        stroke={stroke}
        strokeWidth="2.5"
      />
      <rect
        x="48"
        y="70"
        width="124"
        height="30"
        rx="7"
        fill={surfaceRaised}
        stroke={faint}
        strokeWidth="2.5"
      />
      <rect
        x="56"
        y="38"
        width="108"
        height="30"
        rx="7"
        fill={surfaceRaised}
        stroke={faint}
        strokeWidth="2.5"
      />
      <path d="M68 53h44M60 85h52M52 117h60" stroke={faint} strokeWidth="3" strokeLinecap="round" />
      <circle cx="150" cy="117" r="9" fill="none" stroke={accent} strokeWidth="2.5" />
      <path
        d="m146 117 3 3 5.5-5.5"
        stroke={accent}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M142 53h10M138 85h18" stroke={brand} strokeWidth="3" strokeLinecap="round" />
    </Scene>
  );
}

/** 404 — a broken edge in the graph. */
export function NotFoundScene(p: SceneProps) {
  return (
    <Scene {...p}>
      <path
        d="M46 108V52l38 40"
        stroke={stroke}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M136 92V52l38 56"
        stroke={stroke}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.4"
      />
      <circle cx="46" cy="108" r="8" fill={brand} />
      <circle cx="174" cy="108" r="8" fill={faint} />
      <path d="M92 80h12M116 80h12" stroke={accent} strokeWidth="4" strokeLinecap="round" />
      <circle cx="110" cy="80" r="3" fill={accent} opacity="0.4" />
      <path d="M64 132h92" stroke={faint} strokeWidth="2.5" strokeDasharray="6 6" />
    </Scene>
  );
}

/** 500 — something on our side came apart. */
export function ServerErrorScene(p: SceneProps) {
  return (
    <Scene {...p}>
      <rect x="42" y="34" width="136" height="34" rx="8" fill={surfaceRaised} stroke={faint} />
      <rect
        x="42"
        y="78"
        width="136"
        height="34"
        rx="8"
        fill={surfaceRaised}
        stroke="var(--color-danger)"
        strokeWidth="2.5"
      />
      <circle cx="62" cy="51" r="5" fill={accent} />
      <circle cx="62" cy="95" r="5" fill="var(--color-danger)" />
      <path d="M84 51h68" stroke={faint} strokeWidth="3" strokeLinecap="round" />
      <path
        d="M84 95h44"
        stroke="var(--color-danger)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M110 122v10M110 138h.01"
        stroke="var(--color-danger)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </Scene>
  );
}

/** Success — a milestone closed. */
export function SuccessScene(p: SceneProps) {
  return (
    <Scene {...p}>
      <circle cx="110" cy="80" r="44" fill={surfaceRaised} stroke={accent} strokeWidth="3" />
      <path
        d="m92 80 13 13 26-28"
        stroke={accent}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="44" cy="42" r="5" fill={brand} opacity="0.5" />
      <circle cx="180" cy="52" r="7" fill={accent} opacity="0.35" />
      <circle cx="168" cy="126" r="5" fill={brand} opacity="0.35" />
      <path d="M34 108h14M172 96h14" stroke={faint} strokeWidth="3" strokeLinecap="round" />
    </Scene>
  );
}

/**
 * The home page's primary graphic: the Projects → People → Opportunities
 * pipeline as a connection graph.
 *
 * The pulse animates only under `prefers-reduced-motion: no-preference`, which
 * is enforced globally in globals.css (durations collapse to 0.01ms) — but the
 * animation is also declared conditionally here so nothing moves by default in
 * a reduced-motion context.
 */
export function HeroGraphic({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 300"
      fill="none"
      aria-hidden
      focusable="false"
      className={cn("h-auto w-full", className)}
    >
      <defs>
        <linearGradient id="nx-hero-edge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-primary-600)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--color-accent-600)" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      {/* the graph */}
      <g stroke="url(#nx-hero-edge)" strokeWidth="2">
        <path d="M78 214 210 74l132 140" />
        <path d="M78 214h264" />
        <path d="M210 74v140" />
        <path d="M78 214 210 74" />
      </g>

      {/* project cards feeding the graph */}
      <g>
        <rect x="24" y="46" width="86" height="52" rx="10" fill={surfaceRaised} stroke={faint} />
        <path d="M38 64h50M38 78h32" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <rect x="310" y="46" width="86" height="52" rx="10" fill={surfaceRaised} stroke={faint} />
        <path d="M324 64h50M324 78h38" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
        <rect x="167" y="238" width="86" height="42" rx="10" fill={surfaceRaised} stroke={faint} />
        <path d="M181 254h50M181 266h30" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
      </g>

      {/* nodes — mirroring the logo's low-left / high-right ascent */}
      <circle
        cx="78"
        cy="214"
        r="15"
        fill="var(--color-surface)"
        stroke="var(--color-primary-600)"
        strokeWidth="4"
      />
      <circle cx="210" cy="74" r="21" fill="var(--color-accent-fill)" />
      <circle
        cx="342"
        cy="214"
        r="15"
        fill="var(--color-surface)"
        stroke="var(--color-primary-600)"
        strokeWidth="4"
      />
      <circle cx="210" cy="214" r="11" fill="var(--color-primary-600)" />

      {/* verification seal on the lead node */}
      <path
        d="m202 74 5.5 5.5L221 66"
        stroke="var(--color-fg-on-accent)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .nx-pulse { animation: nx-pulse 3.2s var(--ease-out) infinite; transform-origin: center; }
        }
        @keyframes nx-pulse { 0%,100% { opacity: .28 } 50% { opacity: .06 } }
      `}</style>
      <circle
        className="nx-pulse"
        cx="210"
        cy="74"
        r="34"
        fill="var(--color-accent-600)"
        opacity="0.18"
      />
    </svg>
  );
}
