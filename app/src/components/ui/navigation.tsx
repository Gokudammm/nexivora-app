import Link from "next/link";

import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { breadcrumbList, JsonLd, type Crumb } from "@/lib/seo/jsonld";
import { cn } from "@/lib/utils/cn";

/* ------------------------------------------------------------ Breadcrumbs */

/**
 * Breadcrumbs, which **emit their own `BreadcrumbList` JSON-LD**.
 *
 * Coupling the markup to the component is deliberate: it means a page cannot
 * render a breadcrumb trail and forget the structured data, and the two can
 * never disagree — which is the requirement that structured data match the
 * visible text.
 */
export function Breadcrumbs({ crumbs, className }: { crumbs: Crumb[]; className?: string }) {
  if (crumbs.length === 0) return null;
  const last = crumbs[crumbs.length - 1];

  return (
    <>
      <JsonLd data={breadcrumbList(crumbs)} />
      <nav aria-label="Breadcrumb" className={cn("text-sm", className)}>
        <ol className="flex flex-wrap items-center gap-1.5 text-fg-muted">
          {crumbs.map((crumb, index) => {
            const isLast = crumb === last;
            return (
              <li key={crumb.href} className="flex items-center gap-1.5">
                {index > 0 ? (
                  <ChevronRightIcon size={14} className="shrink-0 text-fg-subtle" />
                ) : null}
                {isLast ? (
                  <span aria-current="page" className="font-medium text-fg">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="rounded-sm underline-offset-4 transition-colors hover:text-fg hover:underline"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

/* -------------------------------------------------------------- Pagination */

/**
 * Pagination that renders **real `<a href>` links**, not buttons.
 *
 * This is an SEO requirement, not a preference: per `links.txt` and
 * `SEO Basic.txt`, Googlebot discovers URLs from `href` attributes, so a
 * button-based pager makes page 2 onward invisible to a crawler. Infinite
 * scroll may be layered on top later, but never as a replacement for these.
 */
export function Pagination({
  page,
  totalPages,
  hrefFor,
  className,
}: {
  page: number;
  totalPages: number;
  /** Builds the URL for a page number, so query state stays with the caller. */
  hrefFor: (page: number) => string;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const windowed: (number | "gap")[] = [];
  for (let p = 1; p <= totalPages; p += 1) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) windowed.push(p);
    else if (windowed[windowed.length - 1] !== "gap") windowed.push("gap");
  }

  const linkClass =
    "grid h-10 min-w-10 place-items-center rounded-md px-3 text-sm transition-colors hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none";

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-center gap-1", className)}
    >
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={cn(linkClass, "gap-1 text-fg-muted")}>
          <ChevronLeftIcon size={16} />
          <span className="sr-only sm:not-sr-only">Previous</span>
        </Link>
      ) : (
        <span className={cn(linkClass, "pointer-events-none gap-1 text-fg-subtle opacity-50")}>
          <ChevronLeftIcon size={16} />
          <span className="sr-only sm:not-sr-only">Previous</span>
        </span>
      )}

      {windowed.map((entry, i) =>
        entry === "gap" ? (
          <span key={`gap-${i}`} className="px-1.5 text-fg-subtle" aria-hidden>
            …
          </span>
        ) : entry === page ? (
          <span
            key={entry}
            aria-current="page"
            className={cn(linkClass, "bg-primary-fill font-semibold text-fg-on-primary")}
          >
            {entry}
          </span>
        ) : (
          <Link key={entry} href={hrefFor(entry)} className={cn(linkClass, "text-fg-muted")}>
            {entry}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} rel="next" className={cn(linkClass, "gap-1 text-fg-muted")}>
          <span className="sr-only sm:not-sr-only">Next</span>
          <ChevronRightIcon size={16} />
        </Link>
      ) : (
        <span className={cn(linkClass, "pointer-events-none gap-1 text-fg-subtle opacity-50")}>
          <span className="sr-only sm:not-sr-only">Next</span>
          <ChevronRightIcon size={16} />
        </span>
      )}
    </nav>
  );
}

/* ----------------------------------------------------------------- Stepper */

export type Step = { label: string; description?: string };

export function Stepper({
  steps,
  current,
  className,
}: {
  steps: Step[];
  /** Zero-based index of the active step. */
  current: number;
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col gap-0 sm:flex-row sm:items-start", className)}>
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step.label} className="flex flex-1 gap-3 sm:flex-col sm:gap-2">
            <div className="flex flex-col items-center sm:w-full sm:flex-row">
              <span
                aria-hidden
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border-2 text-sm font-semibold",
                  done && "border-accent-fill bg-accent-fill text-fg-on-accent",
                  active && "border-primary-fill text-primary-600",
                  !done && !active && "border-border-strong text-fg-subtle",
                )}
              >
                {done ? <CheckIcon size={16} /> : index + 1}
              </span>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "my-1 w-0.5 flex-1 bg-border sm:mx-2 sm:my-0 sm:h-0.5 sm:w-auto",
                    done && "bg-accent-fill",
                  )}
                />
              ) : null}
            </div>
            <div className="pb-6 sm:pb-0">
              <p className={cn("text-sm font-medium", active ? "text-fg" : "text-fg-muted")}>
                {step.label}
                {active ? <span className="sr-only"> (current step)</span> : null}
                {done ? <span className="sr-only"> (completed)</span> : null}
              </p>
              {step.description ? (
                <p className="mt-0.5 text-sm text-fg-subtle">{step.description}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------------------------------------------------------- Timeline */

export type TimelineEntry = {
  title: string;
  meta?: string;
  description?: React.ReactNode;
  tone?: "default" | "accent" | "muted";
};

export function Timeline({ entries, className }: { entries: TimelineEntry[]; className?: string }) {
  return (
    <ol className={cn("relative", className)}>
      {entries.map((entry, index) => (
        <li key={`${entry.title}-${index}`} className="relative flex gap-4 pb-6 last:pb-0">
          <div className="flex flex-col items-center">
            <span
              aria-hidden
              className={cn(
                "mt-1.5 size-3 shrink-0 rounded-full ring-4",
                "ring-surface",
                entry.tone === "accent" && "bg-accent-fill",
                entry.tone === "muted" && "bg-border-strong",
                (!entry.tone || entry.tone === "default") && "bg-primary-fill",
              )}
            />
            {index < entries.length - 1 ? (
              <span aria-hidden className="mt-1 w-0.5 flex-1 bg-border" />
            ) : null}
          </div>
          <div className="flex-1 pb-1">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="text-sm font-medium">{entry.title}</p>
              {entry.meta ? <p className="font-mono text-xs text-fg-subtle">{entry.meta}</p> : null}
            </div>
            {entry.description ? (
              <div className="mt-1 text-sm text-fg-muted">{entry.description}</div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
