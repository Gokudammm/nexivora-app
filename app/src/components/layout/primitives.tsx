import { cn } from "@/lib/utils/cn";

/* -------------------------------------------------------------- Container */

export function Container({
  className,
  width = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { width?: "default" | "reading" | "wide" }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-6 lg:px-8",
        width === "default" && "max-w-7xl",
        // Reading width caps body copy near 68ch — see docs/DESIGN-SYSTEM.md.
        width === "reading" && "max-w-3xl",
        width === "wide" && "max-w-[90rem]",
        className,
      )}
      {...props}
    />
  );
}

/* ---------------------------------------------------------------- Section */

export function Section({
  className,
  tone = "default",
  ...props
}: React.HTMLAttributes<HTMLElement> & { tone?: "default" | "raised" | "sunken" }) {
  return (
    <section
      className={cn(
        "py-12 md:py-16 lg:py-20",
        tone === "raised" && "bg-surface-raised",
        tone === "sunken" && "bg-surface-sunken",
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------- PageHeader */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-2 text-sm font-semibold tracking-wide text-primary-600 uppercase">
            {eyebrow}
          </p>
        ) : null}
        {/* One h1 per page — this is it. */}
        <h1 className="font-display text-3xl font-bold md:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-3 text-base text-fg-muted md:text-lg">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
    </header>
  );
}

/* ------------------------------------------------------------------ Prose */

/**
 * Long-form content. Styles descendants directly, because this wraps rendered
 * markdown and rich text where we do not control the element classes.
 */
export function Prose({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "max-w-[68ch] text-base leading-[1.7]",
        "[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold",
        "[&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-semibold",
        "[&_p]:my-4 [&_p]:text-fg-muted",
        "[&_li]:my-1.5 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-fg-muted",
        "[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:text-fg-muted",
        "[&_a]:text-primary-600 [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:no-underline",
        "[&_strong]:font-semibold [&_strong]:text-fg",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-primary-600 [&_blockquote]:pl-4 [&_blockquote]:italic",
        "[&_code]:rounded [&_code]:bg-surface-sunken [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm",
        "[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-surface-sunken [&_pre]:p-4",
        "[&_hr]:my-8 [&_hr]:border-border",
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------- SkipLink */

/** The first focusable element on every page. Styled in globals.css. */
export function SkipLink({ href = "#main" }: { href?: string }) {
  return (
    <a href={href} className="skip-link">
      Skip to content
    </a>
  );
}
