import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/auth/guards";
import { requireWorkspace } from "@/lib/db/queries/group";
import { listActivity } from "@/lib/db/queries/workspace";
import { LEDGER_VERB } from "@/lib/ledger/score";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Activity",
  description: "Everything that has happened in this workspace, filterable by member.",
  index: false,
  path: "/groups",
});

/**
 * The activity stream — every workspace event, filterable by member.
 *
 * This is where "every number in the ledger links to its evidence" is actually
 * paid off: a row here names the person, what they did and the thing they did
 * it to, and links to that thing. A contribution score that cannot be traced
 * back to specific actions is an assertion, and an assertion is exactly what
 * this feature exists not to be.
 *
 * Ledger events and activity events are interleaved because they answer the
 * same question from two angles: the ledger records what counted as
 * contribution, activity records what happened. "Who changed the join policy"
 * is not a contribution and is still something a member may need to look up.
 */
export default async function ActivityPage({
  params,
  searchParams,
}: PageProps<"/groups/[id]/activity">) {
  const { id } = await params;
  const query = await searchParams;
  const viewer = await requireAuth(`/groups/${id}/activity`);
  const workspace = await requireWorkspace(viewer, id);

  if (!workspace) notFound();

  const filter = typeof query.member === "string" ? query.member : undefined;
  const { ledger, activity } = await listActivity(workspace, { userId: filter, take: 100 });

  const names = new Map(workspace.members.map((member) => [member.user.id, member.user.name]));
  const now = new Date();

  const rows = [
    ...ledger.map((event) => ({
      id: `l-${event.id}`,
      at: event.createdAt,
      who: event.user.name,
      what: LEDGER_VERB[event.kind],
      withdrawn: event.weight < 0,
      href: linkFor(workspace.id, event.subjectType, event.subjectId),
      weight: event.weight,
    })),
    ...activity.map((event) => ({
      id: `a-${event.id}`,
      at: event.createdAt,
      who: (event.actorId && names.get(event.actorId)) || "Somebody",
      what: describe(event.kind, event.metadata),
      withdrawn: false,
      href: null,
      weight: null,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium">Activity</h2>

        <nav aria-label="Filter by member" className="flex flex-wrap gap-1.5">
          <FilterChip href={`/groups/${workspace.id}/activity`} active={!filter} label="Everyone" />
          {workspace.members.map((member) => (
            <FilterChip
              key={member.user.id}
              href={`/groups/${workspace.id}/activity?member=${member.user.id}`}
              active={filter === member.user.id}
              label={member.user.name.split(" ")[0]!}
            />
          ))}
        </nav>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing recorded"
          description={
            filter
              ? "This member has no recorded activity in this workspace yet."
              : "Nothing has happened here yet. Close a task or upload a file and it will appear."
          }
          action={null}
        />
      ) : (
        <ul className="grid divide-y divide-border rounded-xl border border-border">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{row.who}</span>{" "}
                <span className={row.withdrawn ? "text-fg-muted line-through" : "text-fg-muted"}>
                  {row.what}
                </span>
                {row.withdrawn ? <Badge tone="neutral">withdrawn</Badge> : null}
              </span>

              {row.href ? (
                <Link
                  href={row.href}
                  className="shrink-0 text-xs underline underline-offset-4 hover:text-fg"
                >
                  evidence
                </Link>
              ) : null}

              {row.weight !== null ? (
                <span className="w-10 shrink-0 text-right text-xs text-fg-subtle tabular-nums">
                  {row.weight > 0 ? `+${row.weight}` : row.weight}
                </span>
              ) : (
                <span className="w-10 shrink-0" />
              )}

              <time
                dateTime={row.at.toISOString()}
                className="w-24 shrink-0 text-right text-xs text-fg-subtle"
              >
                {ago(row.at, now)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={
        active
          ? "border-primary rounded-full border bg-primary-50 px-3 py-1 text-xs font-medium dark:bg-primary-950"
          : "rounded-full border border-border px-3 py-1 text-xs text-fg-muted hover:text-fg"
      }
    >
      {label}
    </Link>
  );
}

/**
 * Where a ledger event's evidence lives.
 *
 * Returns null rather than guessing when a subject has no page of its own —
 * a link that 404s is worse than no link, because it makes the evidence look
 * missing rather than simply un-navigable.
 */
function linkFor(groupId: string, subjectType: string, subjectId: string): string | null {
  switch (subjectType) {
    case "Task":
      return `/groups/${groupId}/tasks/${subjectId}`;
    case "Thread":
      return `/groups/${groupId}/discussion/${subjectId}`;
    case "FileAsset":
      return `/groups/${groupId}/files`;
    case "Meeting":
      return `/groups/${groupId}/meetings`;
    default:
      return null;
  }
}

function describe(kind: string, metadata: unknown): string {
  if (kind === "milestone.review.waived") {
    const reason =
      typeof metadata === "object" && metadata !== null && "reason" in metadata
        ? String((metadata as { reason: unknown }).reason)
        : null;
    return reason ? `waived peer review — ${reason}` : "waived peer review for a milestone";
  }

  return kind.replace(/[._]/g, " ");
}

function ago(date: Date, now: Date): string {
  const minutes = Math.round((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 1)}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
