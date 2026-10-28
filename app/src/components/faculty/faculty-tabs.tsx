"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

/**
 * Faculty navigation.
 *
 * A client component only because the current tab needs the pathname. The
 * `aria-current="page"` is what communicates the selection to a screen reader —
 * the colour is the sighted half of the same statement.
 */
const TABS = [
  { href: "/faculty", label: "Overview", exact: true },
  { href: "/faculty/submissions", label: "Submissions" },
  { href: "/faculty/proposals", label: "Proposals" },
  { href: "/faculty/groups", label: "Groups" },
  { href: "/faculty/classes", label: "Classes" },
  { href: "/faculty/rubrics", label: "Rubrics" },
  { href: "/faculty/attestations", label: "Attestations" },
  { href: "/faculty/announcements", label: "Announcements" },
] as const;

export function FacultyTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Teaching sections" className="overflow-x-auto">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {TABS.map((tab) => {
          const current =
            "exact" in tab && tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

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
