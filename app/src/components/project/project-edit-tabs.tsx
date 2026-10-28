"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

/**
 * Editor navigation.
 *
 * A client component only because the current tab needs the pathname. The
 * `aria-current="page"` is what communicates the selection to a screen reader —
 * the colour is the sighted half of the same statement, and shipping one
 * without the other is the most common way a tab strip fails an audit.
 */
export function ProjectEditTabs({
  slug,
  canSubmit,
  isFaculty,
  hasFeedback,
}: {
  slug: string;
  canSubmit: boolean;
  isFaculty: boolean;
  /** A released round exists. The tab is hidden until there is something in it. */
  hasFeedback: boolean;
}) {
  const pathname = usePathname();
  const base = `/projects/${slug}`;

  const tabs = [
    { href: `${base}/edit`, label: "Sections", exact: true },
    { href: `${base}/edit/details`, label: "Details" },
    { href: `${base}/milestones`, label: "Milestones" },
    { href: `${base}/propose`, label: "Proposal" },
    // Hidden until a round is released, because a permanently empty "Feedback"
    // tab teaches people that there is never anything in it.
    ...(hasFeedback ? [{ href: `${base}/feedback`, label: "Feedback" }] : []),
    ...(canSubmit || isFaculty ? [{ href: `${base}/submit`, label: "Submit" }] : []),
    { href: base, label: "View page" },
  ];

  return (
    <nav aria-label="Project sections" className="overflow-x-auto">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {tabs.map((tab) => {
          const current = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "focus-visible:outline-primary -mb-px inline-block border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2",
                  current
                    ? "border-primary text-fg"
                    : "border-transparent text-fg-muted hover:border-border hover:text-fg",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
