import Link from "next/link";
import { notFound } from "next/navigation";

import { DeadlineIcon, FileIcon, MeetingIcon, PlusIcon, TaskIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Avatar, Badge } from "@/components/ui/display";
import { EmptyState, Progress } from "@/components/ui/feedback";
import { ActivityList } from "@/components/workspace/activity-list";
import { DeadlineStrip } from "@/components/workspace/deadline-strip";
import { requireAuth } from "@/lib/auth/guards";
import { getWorkspaceHome, requireWorkspace } from "@/lib/db/queries/group";
import { TASK_COLUMN_LABEL } from "@/config/tasks";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Workspace",
  description:
    "Your group's workspace — progress at a glance, what is due next, your open tasks and everything the team has been doing.",
  index: false,
  path: "/groups",
});

/**
 * The workspace home.
 *
 * Answers three questions in the order people actually ask them: *where is the
 * project*, *what is due*, and *what is waiting on me*. Everything else is
 * below the fold.
 *
 * All the reads happen in one `Promise.all` inside `getWorkspaceHome`, because
 * acceptance criterion 9 puts this page under 800ms with the seed data and a
 * waterfall of eight sequential queries would not make it.
 */
export default async function WorkspacePage({ params }: PageProps<"/groups/[id]">) {
  const { id } = await params;
  const viewer = await requireAuth(`/groups/${id}`);
  const workspace = await requireWorkspace(viewer, id);

  if (!workspace) notFound();

  const home = await getWorkspaceHome(viewer, workspace);
  const now = new Date();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="grid gap-6 lg:col-span-2">
        {/* ------------------------------------------------------ progress */}

        <section className="grid gap-4 rounded-xl border border-border p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-medium">Progress</h2>
            <p className="text-sm text-fg-muted">
              {home.progress.done} of {home.progress.total} tasks done
            </p>
          </div>

          <Progress value={home.progress.percent} label="Tasks completed" />

          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-fg-muted">
            {home.statusCounts.map((row) => (
              <li key={row.status}>
                <span className="font-medium text-fg">{row._count._all}</span>{" "}
                {TASK_COLUMN_LABEL[row.status].toLowerCase()}
              </li>
            ))}
          </ul>
        </section>

        {/* ---------------------------------------------------- deadlines */}

        <section className="grid gap-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium">Coming up</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/groups/${workspace.id}/meetings`}>Meetings</Link>
            </Button>
          </div>

          <DeadlineStrip
            now={now}
            tasks={home.upcomingTasks.map((task) => ({
              id: task.id,
              title: task.title,
              at: task.dueDate!,
              href: `/groups/${workspace.id}/tasks/${task.id}`,
            }))}
            meetings={home.meetings.map((meeting) => ({
              id: meeting.id,
              title: meeting.title,
              at: meeting.startsAt,
              href: `/groups/${workspace.id}/meetings`,
            }))}
          />
        </section>

        {/* ----------------------------------------------------- activity */}

        <section className="grid gap-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium">Recent activity</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/groups/${workspace.id}/activity`}>All activity</Link>
            </Button>
          </div>

          {home.activity.length === 0 ? (
            <EmptyState
              title="Nothing has happened yet"
              description="Close a task, upload a file or start a discussion — every contribution shows up here and in the ledger."
              action={
                <Button asChild size="sm">
                  <Link href={`/groups/${workspace.id}/tasks`}>Open the board</Link>
                </Button>
              }
            />
          ) : (
            <ActivityList events={home.activity} now={now} />
          )}
        </section>
      </div>

      {/* -------------------------------------------------------- sidebar */}

      <aside className="grid content-start gap-6">
        <section className="grid gap-3 rounded-xl border border-border p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-medium">
              <TaskIcon />
              My open tasks
            </h2>
            <Button asChild variant="ghost" size="sm" iconOnly aria-label="Add a task">
              <Link href={`/groups/${workspace.id}/tasks`}>
                <PlusIcon />
              </Link>
            </Button>
          </div>

          {home.myTasks.length === 0 ? (
            <p className="text-sm text-fg-muted">
              Nothing is assigned to you. That is either very good news or worth checking.
            </p>
          ) : (
            <ul className="grid gap-2">
              {home.myTasks.map((task) => {
                const overdue = task.dueDate !== null && task.dueDate < now;

                return (
                  <li key={task.id}>
                    <Link
                      href={`/groups/${workspace.id}/tasks/${task.id}`}
                      className="focus-visible:outline-primary flex items-start justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-sunken focus-visible:outline-2"
                    >
                      <span className="min-w-0 flex-1 truncate">{task.title}</span>
                      {task.dueDate ? (
                        <span
                          className={
                            overdue
                              ? "shrink-0 text-xs text-danger"
                              : "shrink-0 text-xs text-fg-subtle"
                          }
                        >
                          {task.dueDate.toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="grid gap-3 rounded-xl border border-border p-5">
          <h2 className="font-medium">Team</h2>
          <ul className="grid gap-2">
            {workspace.members.map((member) => (
              <li key={member.id} className="flex items-center gap-2.5">
                <Avatar
                  name={member.user.name}
                  src={member.user.avatarUrl}
                  seed={member.user.id}
                  size="sm"
                />
                <span className="min-w-0 flex-1 truncate text-sm">{member.user.name}</span>
                {member.role === "LEAD" ? <Badge tone="outline">lead</Badge> : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-3 rounded-xl border border-border p-5">
          <h2 className="font-medium">Shortcuts</h2>
          <ul className="grid gap-1 text-sm">
            <li>
              <Link
                href={`/groups/${workspace.id}/files`}
                className="flex items-center gap-2 py-1 text-fg-muted hover:text-fg"
              >
                <FileIcon />
                {home.fileCount} {home.fileCount === 1 ? "file" : "files"}
              </Link>
            </li>
            <li>
              <Link
                href={`/groups/${workspace.id}/discussion`}
                className="flex items-center gap-2 py-1 text-fg-muted hover:text-fg"
              >
                <DeadlineIcon />
                {home.threads.length} recent {home.threads.length === 1 ? "thread" : "threads"}
              </Link>
            </li>
            <li>
              <Link
                href={`/groups/${workspace.id}/meetings`}
                className="flex items-center gap-2 py-1 text-fg-muted hover:text-fg"
              >
                <MeetingIcon />
                {home.meetings.length} upcoming{" "}
                {home.meetings.length === 1 ? "meeting" : "meetings"}
              </Link>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
