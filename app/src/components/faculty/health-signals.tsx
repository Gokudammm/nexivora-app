import Link from "next/link";

import { Badge } from "@/components/ui/display";
import type { HealthSignal } from "@/lib/ledger/health";
import { cn } from "@/lib/utils/cn";

/**
 * Health signals, as a ranked list.
 *
 * The spec insists these are **not a decorative badge**, and the difference is
 * the point: a coloured dot says something is wrong somewhere; a ranked list
 * with evidence and an action says which group to open first.
 *
 * Every row carries three things — what the data shows, the numbers behind it,
 * and what to do next. The evidence line is what stops a signal being an
 * accusation: "Rahul has recorded nothing in 19 days" invites a rebuttal;
 * "3 of 210 recorded events; last on 12 March" invites a look.
 *
 * The same component renders for the group (ADR-045). The content is identical
 * — only the surrounding framing changes, and the caller supplies that.
 */

const TONE: Record<HealthSignal["severity"], string> = {
  warning: "border-warning/40 bg-warning-bg/20",
  info: "border-border",
};

/** Where an action leads. Kept here so a signal never has to know about routes. */
function actionHref(signal: HealthSignal, groupId: string): string {
  switch (signal.action.kind) {
    case "message":
      return `/groups/${groupId}/discussion`;
    case "meet":
      return `/groups/${groupId}/meetings`;
    case "review":
      return `/groups/${groupId}`;
    case "open":
      return signal.kind === "unresolved-blocker"
        ? `/groups/${groupId}/discussion`
        : `/groups/${groupId}/tasks`;
  }
}

export function HealthSignals({
  signals,
  groupId,
  limit,
}: {
  signals: readonly HealthSignal[];
  groupId: string;
  /** Show only the worst few — the dashboard does, a group page does not. */
  limit?: number;
}) {
  if (signals.length === 0) {
    return <p className="text-sm text-fg-subtle">Nothing to flag.</p>;
  }

  const shown = limit ? signals.slice(0, limit) : signals;
  const hidden = signals.length - shown.length;

  return (
    <div className="grid gap-2">
      <ul className="grid gap-2">
        {shown.map((signal, index) => (
          <li
            key={`${signal.kind}-${signal.userId ?? index}`}
            data-signal={signal.kind}
            className={cn("grid gap-1.5 rounded-lg border p-3", TONE[signal.severity])}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-medium">{signal.message}</p>
              {signal.severity === "warning" ? <Badge tone="warning">attention</Badge> : null}
            </div>

            <p className="text-xs text-fg-muted">{signal.evidence}</p>

            <Link
              href={actionHref(signal, groupId)}
              className="justify-self-start text-xs underline underline-offset-4 hover:text-fg"
            >
              {signal.action.label}
            </Link>
          </li>
        ))}
      </ul>

      {hidden > 0 ? (
        <Link
          href={`/groups/${groupId}`}
          className="text-xs text-fg-subtle underline underline-offset-4 hover:text-fg"
        >
          {hidden} more {hidden === 1 ? "signal" : "signals"}
        </Link>
      ) : null}
    </div>
  );
}
