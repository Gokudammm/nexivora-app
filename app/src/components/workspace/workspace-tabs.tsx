"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils/cn";

/**
 * Workspace navigation.
 *
 * A client component only because the current tab needs the pathname. The
 * `aria-current="page"` is what actually communicates the selection to a screen
 * reader — the colour is the sighted half of the same statement, and shipping
 * one without the other is the most common way a tab strip fails an audit.
 */

const TABS = [
  { segment: "", label: "Overview" },
  { segment: "tasks", label: "Tasks" },
  { segment: "files", label: "Files" },
  { segment: "discussion", label: "Discussion" },
  { segment: "meetings", label: "Meetings" },
  { segment: "ledger", label: "Ledger" },
  { segment: "activity", label: "Activity" },
] as const;

export function WorkspaceTabs({ groupId, canManage }: { groupId: string; canManage: boolean }) {
  const pathname = usePathname();
  const base = `/groups/${groupId}`;

  const tabs = canManage ? [...TABS, { segment: "settings", label: "Settings" } as const] : TABS;

  return (
    <nav aria-label="Workspace sections" className="overflow-x-auto">
      <ul className="flex min-w-max gap-1 border-b border-border">
        {tabs.map((tab) => {
          const href = tab.segment ? `${base}/${tab.segment}` : base;
          // Overview matches only exactly; every other tab matches its subtree,
          // so a task deep link keeps "Tasks" selected.
          const current = tab.segment === "" ? pathname === base : pathname.startsWith(href);

          return (
            <li key={tab.segment}>
              <Link
                href={href}
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
