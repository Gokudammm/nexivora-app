import { Avatar } from "@/components/ui/display";
import { LEDGER_VERB } from "@/lib/ledger/score";
import type { LedgerEventKind } from "@/config/ledger";

/**
 * The activity stream.
 *
 * Every row names a person, a verb and a thing, and says when. It is
 * deliberately not a feed of achievements: "Ananya closed a task" is a fact,
 * and dressing it up as "🎉 Ananya crushed a task!" would make the ledger read
 * as a game, which is the failure mode `config/ledger.ts` is written to avoid.
 *
 * A compensating event — a reopened task, a trashed file — carries a negative
 * weight and is shown as a withdrawal rather than hidden. Hiding it would make
 * the stream disagree with the ledger totals, and somebody would eventually
 * notice and stop trusting both.
 */

type Event = {
  id: string;
  kind: LedgerEventKind;
  createdAt: Date;
  subjectType?: string;
  subjectId?: string;
  weight?: number;
  user: { id: string; name: string; username: string | null; avatarUrl: string | null };
};

const ago = (date: Date, now: Date): string => {
  const minutes = Math.round((now.getTime() - date.getTime()) / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export function ActivityList({
  events,
  now,
  title,
}: {
  events: Event[];
  now: Date;
  title?: string;
}) {
  return (
    <ul className="grid gap-1" aria-label={title ?? "Recent activity"}>
      {events.map((event) => {
        const withdrawn = typeof event.weight === "number" && event.weight < 0;

        return (
          <li key={event.id} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm">
            <Avatar
              name={event.user.name}
              src={event.user.avatarUrl}
              seed={event.user.id}
              size="xs"
            />

            <p className="min-w-0 flex-1 text-fg-muted">
              <span className="font-medium text-fg">{event.user.name}</span>{" "}
              {withdrawn ? (
                <span className="line-through">{LEDGER_VERB[event.kind]}</span>
              ) : (
                LEDGER_VERB[event.kind]
              )}
              {withdrawn ? <span className="text-fg-subtle"> — withdrawn</span> : null}
            </p>

            <time
              dateTime={event.createdAt.toISOString()}
              className="shrink-0 text-xs text-fg-subtle"
            >
              {ago(event.createdAt, now)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
