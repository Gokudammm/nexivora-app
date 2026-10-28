import Link from "next/link";

import { Avatar, Badge } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { EmptyState, Progress } from "@/components/ui/feedback";
import { HealthSignals } from "@/components/faculty/health-signals";
import { requireAuth } from "@/lib/auth/guards";
import { listSupervisedGroups } from "@/lib/db/queries/faculty";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Groups",
  description:
    "Every group you supervise, with progress, contribution balance and the signals worth acting on.",
  index: false,
  path: "/faculty/groups",
});

/**
 * `/faculty/groups`.
 *
 * The promise this phase exists to keep, from the spec: *"you will be able to
 * see what every group is actually doing, and who in each group is actually
 * doing it, without having to ask."*
 *
 * So each row carries the contribution share per member inline. Not behind a
 * click — the whole point is that the answer to "who is actually doing it" is
 * visible while scanning, and a faculty member with fifteen minutes does not
 * open fifteen ledgers.
 *
 * Ordered worst first, so the list is a work queue rather than an alphabet.
 */
export default async function FacultyGroupsPage({ searchParams }: PageProps<"/faculty/groups">) {
  const viewer = await requireAuth("/faculty/groups");
  const query = await searchParams;
  const filter = typeof query.show === "string" ? query.show : "all";

  const groups = await listSupervisedGroups(viewer);

  const ranked = [...groups].sort((a, b) => {
    const rank = { attention: 0, watch: 1, ok: 2 } as const;
    return rank[a.level] - rank[b.level] || a.progress - b.progress;
  });

  const shown =
    filter === "attention"
      ? ranked.filter((group) => group.level === "attention")
      : filter === "behind"
        ? ranked.filter((group) => group.progress < 40)
        : ranked;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="font-medium">Groups</h2>
          <p className="text-sm text-fg-muted">
            {groups.length} supervised ·{" "}
            {groups.filter((group) => group.level === "attention").length} showing a warning
          </p>
        </div>

        <nav aria-label="Filter groups" className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "All"],
              ["attention", "Needs attention"],
              ["behind", "Under 40%"],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={value}
              href={value === "all" ? "/faculty/groups" : `/faculty/groups?show=${value}`}
              aria-current={filter === value ? "true" : undefined}
              className={
                filter === value
                  ? "border-primary rounded-full border bg-primary-50 px-3 py-1 text-xs font-medium dark:bg-primary-950"
                  : "rounded-full border border-border px-3 py-1 text-xs text-fg-muted hover:text-fg"
              }
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={groups.length === 0 ? "No groups yet" : "Nothing matches that filter"}
          description={
            groups.length === 0
              ? "Groups form inside the classes you teach. When students create one, it appears here with its progress and its contribution balance."
              : "Every group is either on track or above 40%. Clear the filter to see them all."
          }
          action={
            groups.length > 0 ? (
              <Button asChild variant="secondary">
                <Link href="/faculty/groups">Show all</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <ul className="grid gap-4">
          {shown.map((group) => (
            <li key={group.id} className="grid gap-4 rounded-xl border border-border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-1">
                  <h3 className="flex flex-wrap items-center gap-2 font-medium">
                    <Link
                      href={`/groups/${group.id}`}
                      className="hover:text-primary underline underline-offset-4"
                    >
                      {group.name}
                    </Link>
                    {group.level === "attention" ? (
                      <Badge tone="warning">needs attention</Badge>
                    ) : group.level === "watch" ? (
                      <Badge tone="neutral">watch</Badge>
                    ) : null}
                  </h3>

                  <p className="text-xs text-fg-muted">
                    {group.className ?? "No class"}
                    {group.project ? ` · ${group.project.title}` : " · no project yet"}
                  </p>
                </div>

                <div className="grid gap-1 text-right">
                  <span className="text-sm tabular-nums">{group.progress}%</span>
                  <span className="text-xs text-fg-subtle">
                    {group.lastActivityAt
                      ? `active ${group.lastActivityAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                      : "no activity"}
                  </span>
                </div>
              </div>

              <Progress value={group.progress} label={`${group.name} progress`} />

              {/* Who is actually doing it — visible while scanning, not a click away. */}
              <ul className="flex flex-wrap gap-x-4 gap-y-2">
                {group.members.map((member) => {
                  const share = group.signals.find(
                    (signal) => signal.userId === member.id && signal.kind === "imbalance",
                  );
                  const silent = group.signals.find(
                    (signal) => signal.userId === member.id && signal.kind === "silent-member",
                  );

                  return (
                    <li key={member.id} className="flex items-center gap-1.5 text-xs">
                      <Avatar
                        name={member.name}
                        src={member.avatarUrl}
                        seed={member.id}
                        size="xs"
                      />
                      <span className={silent ? "text-warning" : "text-fg-muted"}>
                        {member.name.split(" ")[0]}
                      </span>
                      {silent ? (
                        <Badge tone="warning">silent</Badge>
                      ) : share ? (
                        <Badge tone="neutral">low share</Badge>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              {group.signals.length > 0 ? (
                <HealthSignals signals={group.signals} groupId={group.id} limit={3} />
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/groups/${group.id}/ledger`}>Ledger</Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/groups/${group.id}`}>Workspace</Link>
                </Button>
                {group.project ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/projects/${group.project.slug}/review`}>Review</Link>
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
