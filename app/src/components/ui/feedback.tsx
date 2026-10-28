"use client";

import * as RadixProgress from "@radix-ui/react-progress";
import { cva, type VariantProps } from "class-variance-authority";

import { AlertIcon, SpinnerIcon } from "@/components/icons";
import { ServerErrorScene } from "@/components/illustrations";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

/**
 * The three states every data view must ship: empty, loading, error.
 * All three, always — a list with only a happy path is a review failure.
 */

/* --------------------------------------------------------------- Skeleton */

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-md bg-surface-sunken",
        // Collapses to a static block under prefers-reduced-motion, via the
        // global rule in globals.css.
        "motion-safe:animate-pulse",
        className,
      )}
      {...props}
    />
  );
}

/** A ready-made card skeleton, so lists do not each invent their own. */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3 rounded-lg border border-border p-5", className)}>
      <Skeleton className="h-32 w-full rounded-md" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Spinner */

export function Spinner({ size = 20, label }: { size?: number; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <SpinnerIcon size={size} />
      <span className={label ? "text-sm text-fg-muted" : "sr-only"}>{label ?? "Loading"}</span>
    </span>
  );
}

/* --------------------------------------------------------------- Progress */

export function Progress({
  value,
  label,
  showValue = false,
  className,
}: {
  value: number;
  label?: string;
  showValue?: boolean;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("grid gap-1.5", className)}>
      {label || showValue ? (
        <div className="flex items-baseline justify-between text-sm">
          {label ? <span className="text-fg-muted">{label}</span> : <span />}
          {showValue ? <span className="font-mono tabular-nums">{clamped}%</span> : null}
        </div>
      ) : null}
      <RadixProgress.Root
        value={clamped}
        aria-label={label ?? "Progress"}
        className="relative h-2 w-full overflow-hidden rounded-full border border-border bg-surface-sunken"
      >
        <RadixProgress.Indicator
          className="h-full bg-primary-fill transition-transform duration-[var(--duration-enter)] ease-[var(--ease-out)]"
          style={{ transform: `translateX(-${100 - clamped}%)` }}
        />
      </RadixProgress.Root>
    </div>
  );
}

/** Ring variant — for a compact completion figure on a card. */
export function ProgressRing({
  value,
  size = 44,
  label,
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span
      role="img"
      aria-label={label ? `${label}: ${clamped}%` : `${clamped}% complete`}
      className="inline-grid place-items-center"
      style={{ width: size, height: size }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="4"
          className="stroke-surface-sunken"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (clamped / 100) * c}
          className="stroke-primary-600 transition-[stroke-dashoffset] duration-[var(--duration-enter)]"
        />
      </svg>
      <span className="absolute font-mono text-[0.625rem] font-semibold tabular-nums">
        {clamped}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------- EmptyState */

/**
 * An empty state without an action is a dead end and does not pass review.
 * `action` is therefore required, not optional.
 */
export function EmptyState({
  illustration,
  title,
  description,
  action,
  secondaryAction,
  className,
}: {
  illustration?: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      {illustration ? <div className="mb-5">{illustration}</div> : null}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-fg-muted">{description}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        {action}
        {secondaryAction}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- ErrorState */

export function ErrorState({
  title = "Something went wrong",
  description = "This is on us, not you. Try again — and if it keeps happening, let us know.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center rounded-lg border border-border px-6 py-12 text-center",
        className,
      )}
    >
      <ServerErrorScene width={180} />
      <h3 className="mt-5 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-fg-muted">{description}</p>
      {onRetry ? (
        <Button onClick={onRetry} variant="outline" className="mt-5">
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Alert */

const alertVariants = cva("flex items-start gap-3 rounded-md border p-4 text-sm", {
  variants: {
    tone: {
      info: "border-info bg-info-bg text-fg",
      success: "border-success bg-success-bg text-fg",
      warning: "border-warning bg-warning-bg text-fg",
      danger: "border-danger bg-danger-bg text-fg",
    },
  },
  defaultVariants: { tone: "info" },
});

export function Alert({
  title,
  children,
  tone,
  className,
}: VariantProps<typeof alertVariants> & {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="note" className={cn(alertVariants({ tone }), className)}>
      <AlertIcon size={18} className="mt-0.5 shrink-0" />
      <div className="grid gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className="text-fg-muted">{children}</div>
      </div>
    </div>
  );
}
