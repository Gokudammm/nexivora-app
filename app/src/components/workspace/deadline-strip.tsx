import Link from "next/link";

import { DeadlineIcon, MeetingIcon } from "@/components/icons";
import { cn } from "@/lib/utils/cn";

/**
 * Tasks, milestones and meetings on one timeline.
 *
 * Combined deliberately. A group's week does not sort itself into "task
 * deadlines" and "meeting times" in anybody's head — what they want to know is
 * what happens next, and splitting it into two lists means comparing two dates
 * by eye. Overdue items stay at the top rather than falling off, because an
 * overdue task is more urgent than tomorrow's meeting, not less.
 */

type Entry = { id: string; title: string; at: Date; href: string };

export function DeadlineStrip({
  tasks,
  meetings,
  now,
}: {
  tasks: Entry[];
  meetings: Entry[];
  now: Date;
}) {
  const entries = [
    ...tasks.map((entry) => ({ ...entry, kind: "task" as const })),
    ...meetings.map((entry) => ({ ...entry, kind: "meeting" as const })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-fg-muted">
        Nothing scheduled. Give a task a due date, or put a meeting in the calendar.
      </p>
    );
  }

  return (
    <ul className="grid gap-2">
      {entries.slice(0, 8).map((entry) => {
        const overdue = entry.at < now;
        const days = Math.round((entry.at.getTime() - now.getTime()) / 86_400_000);

        return (
          <li key={`${entry.kind}-${entry.id}`}>
            <Link
              href={entry.href}
              className={cn(
                "focus-visible:outline-primary flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:border-border-strong focus-visible:outline-2",
                overdue && "border-danger/40",
              )}
            >
              <span className={cn("shrink-0", overdue ? "text-danger" : "text-fg-subtle")}>
                {entry.kind === "meeting" ? <MeetingIcon /> : <DeadlineIcon />}
              </span>

              <span className="min-w-0 flex-1 truncate">{entry.title}</span>

              <time
                dateTime={entry.at.toISOString()}
                className={cn(
                  "shrink-0 text-xs",
                  overdue ? "font-medium text-danger" : "text-fg-muted",
                )}
              >
                {overdue
                  ? `${Math.abs(days)}d overdue`
                  : entry.at.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      ...(entry.kind === "meeting"
                        ? ({ hour: "numeric", minute: "2-digit" } as const)
                        : {}),
                    })}
              </time>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
