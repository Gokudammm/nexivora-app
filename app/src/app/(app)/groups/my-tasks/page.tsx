import Link from "next/link";

import { Badge } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/auth/guards";
import { listMyTasks } from "@/lib/db/queries/group";
import { TASK_COLUMN_LABEL } from "@/config/tasks";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "My tasks",
  description:
    "Everything assigned to you across every group you are in, oldest deadline first. One list, not five boards.",
  index: false,
  path: "/groups/my-tasks",
});

/**
 * `/groups/my-tasks`.
 *
 * The one page that crosses group boundaries. A student on four groups has four
 * boards, and no board answers "what do I actually have to do this week" —
 * which is the only question they ask on a Monday morning.
 *
 * Overdue first, then by due date, then undated. Undated goes last on purpose:
 * a task with no date is not urgent, it is unplanned, and floating it to the top
 * would bury everything with a real deadline.
 */
export default async function MyTasksPage() {
  const viewer = await requireAuth("/groups/my-tasks");
  const tasks = await listMyTasks(viewer);
  const now = new Date();

  const overdue = tasks.filter((task) => task.dueDate !== null && task.dueDate < now);
  const dated = tasks.filter((task) => task.dueDate !== null && task.dueDate >= now);
  const undated = tasks.filter((task) => task.dueDate === null);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">My tasks</h1>
          <p className="text-sm text-fg-muted">
            {tasks.length === 0
              ? "Nothing is assigned to you anywhere."
              : `${tasks.length} open across your groups${overdue.length > 0 ? `, ${overdue.length} overdue` : ""}.`}
          </p>
        </div>

        <Button asChild variant="secondary">
          <Link href="/groups">All groups</Link>
        </Button>
      </header>

      {tasks.length === 0 ? (
        <EmptyState
          title="Nothing assigned to you"
          description="That is either very good news, or worth checking with your group — an empty ledger column is the thing faculty notice."
          action={
            <Button asChild>
              <Link href="/groups">Open a group</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6">
          <TaskGroup title="Overdue" tasks={overdue} now={now} tone="danger" />
          <TaskGroup title="Coming up" tasks={dated} now={now} />
          <TaskGroup title="No due date" tasks={undated} now={now} />
        </div>
      )}
    </div>
  );
}

type Row = {
  id: string;
  title: string;
  status: keyof typeof TASK_COLUMN_LABEL;
  priority: string;
  dueDate: Date | null;
  group: { id: string; name: string };
};

function TaskGroup({
  title,
  tasks,
  now,
  tone,
}: {
  title: string;
  tasks: Row[];
  now: Date;
  tone?: "danger";
}) {
  if (tasks.length === 0) return null;

  return (
    <section className="grid gap-3">
      <h2 className={tone === "danger" ? "font-medium text-danger" : "font-medium"}>
        {title}
        <span className="ml-2 text-sm font-normal text-fg-subtle">{tasks.length}</span>
      </h2>

      <ul className="grid divide-y divide-border rounded-xl border border-border">
        {tasks.map((task) => {
          const days =
            task.dueDate === null
              ? null
              : Math.round((task.dueDate.getTime() - now.getTime()) / 86_400_000);

          return (
            <li key={task.id}>
              <Link
                href={`/groups/${task.group.id}/tasks/${task.id}`}
                className="focus-visible:outline-primary flex flex-wrap items-center gap-3 px-4 py-3 text-sm hover:bg-surface-sunken focus-visible:outline-2 focus-visible:-outline-offset-2"
              >
                <Badge tone="neutral">{TASK_COLUMN_LABEL[task.status]}</Badge>

                <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>

                <span className="shrink-0 text-xs text-fg-muted">{task.group.name}</span>

                {days !== null ? (
                  <time
                    dateTime={task.dueDate!.toISOString()}
                    className={
                      days < 0
                        ? "w-24 shrink-0 text-right text-xs font-medium text-danger"
                        : "w-24 shrink-0 text-right text-xs text-fg-subtle"
                    }
                  >
                    {days < 0
                      ? `${Math.abs(days)}d overdue`
                      : days === 0
                        ? "today"
                        : days === 1
                          ? "tomorrow"
                          : task.dueDate!.toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                  </time>
                ) : (
                  <span className="w-24 shrink-0" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
