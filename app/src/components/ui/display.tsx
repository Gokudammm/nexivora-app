import * as RadixAvatar from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";

import { AttestIcon, CheckIcon, CloseIcon, LedgerIcon, UserIcon } from "@/components/icons";
import { GeneratedAvatar } from "@/components/illustrations/generated";
import { cn } from "@/lib/utils/cn";

/* -------------------------------------------------------------------- Card */

export function Card({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface",
        interactive &&
          "transition-[border-color,box-shadow] duration-[var(--duration-state)] hover:border-border-strong hover:shadow-md",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-1 p-5 pb-3 md:p-6 md:pb-3", className)} {...props} />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-display text-lg font-semibold", className)} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-fg-muted", className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0 md:p-6 md:pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center gap-3 border-t border-border p-5 md:px-6", className)}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------- Badge */

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-surface-sunken text-fg-muted",
        primary: "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-600",
        accent: "bg-accent-50 text-accent-700 dark:bg-accent-950 dark:text-accent-600",
        success: "bg-success-bg text-success",
        warning: "bg-warning-bg text-warning",
        danger: "bg-danger-bg text-danger",
        info: "bg-info-bg text-info",
        outline: "border-border-strong text-fg-muted border bg-transparent",
      },
      size: { sm: "px-2 py-0.5 text-xs", md: "px-2.5 py-1 text-sm" },
    },
    defaultVariants: { tone: "neutral", size: "sm" },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}

/* -------------------------------------------------------------------- Chip */

export function Chip({
  label,
  onRemove,
  className,
}: {
  label: string;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-surface-sunken py-1 pr-1 pl-3 text-sm text-fg",
        className,
      )}
    >
      {label}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="grid size-5 place-items-center rounded-full transition-colors hover:bg-neutral-300 focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none dark:hover:bg-neutral-700"
        >
          <CloseIcon size={12} />
        </button>
      ) : null}
    </span>
  );
}

/* --------------------------------------------------------------- StatusPill */

export type ProjectStatus =
  "draft" | "proposed" | "approved" | "progress" | "review" | "completed" | "archived";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "Draft",
  proposed: "Proposed",
  approved: "Approved",
  progress: "In progress",
  review: "Under review",
  completed: "Completed",
  archived: "Archived",
};

const STATUS_CLASS: Record<ProjectStatus, string> = {
  draft: "text-status-draft border-status-draft",
  proposed: "text-status-proposed border-status-proposed",
  approved: "text-status-approved border-status-approved",
  progress: "text-status-progress border-status-progress",
  review: "text-status-review border-status-review",
  completed: "text-status-completed border-status-completed",
  archived: "text-status-archived border-status-archived",
};

/** One component renders every lifecycle state. No page picks its own colour. */
export function StatusPill({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        STATUS_CLASS[status],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

/* ---------------------------------------------------------------- TierBadge */

export type ProofTier = "self" | "evidenced" | "attested";

/**
 * The contribution-proof badge. Load-bearing — see Phase 12.
 *
 * The three tiers must be distinguishable at a glance **and in greyscale**,
 * because they appear on exported portfolio PDFs that people print. So each
 * tier differs by icon and by fill treatment, not by colour alone:
 *   self      — outline only, no icon
 *   evidenced — solid fill, activity icon
 *   attested  — solid fill, seal icon, and it NAMES the attesting faculty member
 */
export function TierBadge({
  tier,
  attestedBy,
  className,
}: {
  tier: ProofTier;
  /** Required in practice for `attested` — the name is the whole point. */
  attestedBy?: string;
  className?: string;
}) {
  if (tier === "self") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-tier-self px-2.5 py-0.5 text-xs font-medium text-tier-self",
          className,
        )}
      >
        Self-claimed
      </span>
    );
  }

  if (tier === "evidenced") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-tier-evidenced px-2.5 py-0.5 text-xs font-semibold text-fg-on-primary",
          className,
        )}
      >
        <LedgerIcon size={12} />
        Workspace-evidenced
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-tier-attested px-2.5 py-0.5 text-xs font-semibold text-fg-on-accent",
        className,
      )}
    >
      <AttestIcon size={12} />
      {attestedBy ? `Attested by ${attestedBy}` : "Faculty-attested"}
    </span>
  );
}

/* ------------------------------------------------------------------ Avatar */

const avatarSizes = { xs: 24, sm: 32, md: 40, lg: 56, xl: 80 } as const;
export type AvatarSize = keyof typeof avatarSizes;

export function Avatar({
  src,
  name,
  seed,
  size = "md",
  verified = false,
  className,
}: {
  src?: string | null;
  name: string;
  /** Stable id for the generated fallback. Falls back to the name. */
  seed?: string;
  size?: AvatarSize;
  verified?: boolean;
  className?: string;
}) {
  const px = avatarSizes[size];
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <RadixAvatar.Root
        className="inline-flex overflow-hidden rounded-full bg-surface-sunken"
        style={{ width: px, height: px }}
      >
        {src ? <RadixAvatar.Image src={src} alt={name} className="size-full object-cover" /> : null}
        {/* Never a grey silhouette — a deterministic node-graph mark instead. */}
        <RadixAvatar.Fallback delayMs={src ? 300 : 0} className="size-full">
          <GeneratedAvatar seed={seed ?? name} size={px} />
          <span className="sr-only">{name}</span>
        </RadixAvatar.Fallback>
      </RadixAvatar.Root>

      {verified ? (
        <span
          className="absolute -right-0.5 -bottom-0.5 grid place-items-center rounded-full bg-accent-fill text-fg-on-accent ring-2 ring-surface"
          style={{ width: Math.max(12, px * 0.34), height: Math.max(12, px * 0.34) }}
          title={`${name} is verified`}
        >
          <CheckIcon size={Math.max(8, px * 0.22)} strokeWidth={3} />
          <span className="sr-only">Verified</span>
        </span>
      ) : null}
    </span>
  );
}

export function AvatarGroup({
  people,
  max = 4,
  size = "sm",
  className,
}: {
  people: { name: string; src?: string | null; seed?: string }[];
  max?: number;
  size?: AvatarSize;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;
  const px = avatarSizes[size];

  return (
    <div className={cn("flex items-center", className)}>
      {shown.map((person) => (
        <span
          key={person.seed ?? person.name}
          className="-ml-2 rounded-full ring-2 ring-surface first:ml-0"
        >
          <Avatar {...person} size={size} />
        </span>
      ))}
      {overflow > 0 ? (
        <span
          className="-ml-2 grid place-items-center rounded-full bg-surface-sunken text-xs font-semibold text-fg-muted ring-2 ring-surface"
          style={{ width: px, height: px }}
        >
          +{overflow}
          <span className="sr-only">{overflow} more people</span>
        </span>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Others */

export function Divider({ className, label }: { className?: string; label?: string }) {
  if (!label) return <hr className={cn("border-t border-border", className)} />;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <hr className="flex-1 border-t border-border" />
      <span className="text-xs font-medium tracking-wide text-fg-subtle uppercase">{label}</span>
      <hr className="flex-1 border-t border-border" />
    </div>
  );
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface-sunken px-1.5 font-mono text-[0.6875rem] font-medium text-fg-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

export function UserPlaceholder({ size = 20 }: { size?: number }) {
  return <UserIcon size={size} />;
}
