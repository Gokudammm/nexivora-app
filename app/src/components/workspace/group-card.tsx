import Link from "next/link";

import { DeadlineIcon, MeetingIcon, TaskIcon } from "@/components/icons";
import { AvatarGroup, Badge } from "@/components/ui/display";
import type { GroupCard as GroupCardData } from "@/lib/db/queries/group";
import { cn } from "@/lib/utils/cn";

/**
 * A group, as a card.
 *
 * The information hierarchy is chosen for one question — *does this need me
 * today?* — so the count of tasks assigned to **you** is the prominent number,
 * not the group's total. A card that leads with "24 open tasks" tells you the
 * group is busy; one that leads with "3 yours" tells you what to do.
 */

const relative = (date: Date, now: Date): { label: string; overdue: boolean } => {
  const days = Math.round((date.getTime() - now.getTime()) / 86_400_000);

  if (days < 0) return { label: `${Math.abs(days)}d overdue`, overdue: true };
  if (days === 0) return { label: "due today", overdue: true };
  if (days === 1) return { label: "due tomorrow", overdue: false };
  if (days <= 14) return { label: `in ${days} days`, overdue: false };

  return {
    label: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    overdue: false,
  };
};

export function GroupCardList({ groups }: { groups: GroupCardData[] }) {
  // `now` is read once here rather than inside each card: React's purity rule
  // forbids Date.now() in a component body, and it is also just wrong — two
  // cards in the same list disagreeing about "today" is a bug waiting for
  // midnight.
  const now = new Date();

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <li key={group.id}>
          <GroupCard group={group} now={now} />
        </li>
      ))}
    </ul>
  );
}

export function GroupCard({ group, now }: { group: GroupCardData; now: Date }) {
  const deadline = group.nextDeadline ? relative(group.nextDeadline.dueDate, now) : null;

  return (
    <Link
      href={`/groups/${group.id}`}
      className={cn(
        "focus-visible:outline-primary group grid h-full gap-4 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2",
        group.archivedAt && "opacity-70",
      )}
    >
      <div className="grid gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="group-hover:text-primary font-medium">{group.name}</h3>
          {group.role === "LEAD" ? <Badge tone="outline">lead</Badge> : null}
          {group.archivedAt ? <Badge tone="neutral">archived</Badge> : null}
        </div>

        {group.className ? (
          <p className="text-xs text-fg-muted">
            {group.className}
            {group.subjectName ? ` · ${group.subjectName}` : ""}
          </p>
        ) : null}

        {group.projectTitle ? (
          <p className="truncate text-sm text-fg-muted">{group.projectTitle}</p>
        ) : (
          <p className="text-sm text-fg-subtle">No project yet</p>
        )}
      </div>

      <dl className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <div className="flex items-center gap-1.5">
          <TaskIcon />
          <dt className="sr-only">Tasks assigned to you</dt>
          <dd>
            <span className={cn("font-medium", group.myOpenTaskCount > 0 && "text-primary")}>
              {group.myOpenTaskCount}
            </span>
            <span className="text-fg-muted"> yours</span>
            <span className="text-fg-subtle"> / {group.openTaskCount} open</span>
          </dd>
        </div>

        {deadline && group.nextDeadline ? (
          <div className="flex items-center gap-1.5">
            {group.nextDeadline.kind === "meeting" ? <MeetingIcon /> : <DeadlineIcon />}
            <dt className="sr-only">Next deadline</dt>
            <dd className={cn("text-fg-muted", deadline.overdue && "font-medium text-danger")}>
              {deadline.label}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="flex items-center justify-between gap-3">
        <AvatarGroup
          max={5}
          people={group.members.map((member) => ({
            name: member.name,
            src: member.avatarUrl,
            seed: member.id,
          }))}
        />
        <span className="text-xs text-fg-subtle">
          {group.memberCount} / {group.sizeLimit}
        </span>
      </div>
    </Link>
  );
}
