"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { BoardIcon, PlusIcon, SortIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Avatar, Badge } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { Select } from "@/components/ui/input";
import { TASK_COLUMNS, TASK_COLUMN_LABEL } from "@/config/tasks";
import { cn } from "@/lib/utils/cn";

import { TaskBoard, type BoardTask } from "./task-board";
import { TaskForm, type TaskFormMember } from "./task-form";

/**
 * Board and list, with the filters shared between them.
 *
 * The view choice lives in client state rather than the URL. That is a
 * deliberate departure from how the public explore pages work: those URLs are
 * shared and indexed, so their state belongs in the query string. A workspace
 * URL is shared to point at a *group*, and "…?view=list&assignee=me" pointing
 * at somebody else's filter is noise.
 */

export type ViewTask = BoardTask & { description: string | null };

export function TasksView({
  groupId,
  tasks,
  members,
  canWrite,
}: {
  groupId: string;
  tasks: ViewTask[];
  members: TaskFormMember[];
  canWrite: boolean;
}) {
  const [view, setView] = useState<"board" | "list">("board");
  const [assignee, setAssignee] = useState<string>("all");
  const [sort, setSort] = useState<"due" | "priority" | "created">("due");
  const [composing, setComposing] = useState(false);

  const filtered = useMemo(
    () =>
      assignee === "all"
        ? tasks
        : assignee === "none"
          ? tasks.filter((task) => task.assignees.length === 0)
          : tasks.filter((task) => task.assignees.some((row) => row.user.id === assignee)),
    [tasks, assignee],
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {(["board", "list"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => setView(option)}
              className={cn(
                "focus-visible:outline-primary rounded-md px-3 py-1.5 text-sm font-medium capitalize focus-visible:outline-2",
                view === option ? "bg-surface-sunken text-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              {option === "board" ? <BoardIcon /> : <SortIcon />}
              <span className="ml-1.5">{option}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="task-assignee">
            Filter by assignee
          </label>
          <Select
            id="task-assignee"
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
            className="w-auto"
          >
            <option value="all">Everyone</option>
            <option value="none">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>

          {view === "list" ? (
            <>
              <label className="sr-only" htmlFor="task-sort">
                Sort tasks
              </label>
              <Select
                id="task-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
                className="w-auto"
              >
                <option value="due">Due date</option>
                <option value="priority">Priority</option>
                <option value="created">Column</option>
              </Select>
            </>
          ) : null}

          {canWrite ? (
            <Button size="sm" onClick={() => setComposing(true)}>
              <PlusIcon />
              New task
            </Button>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={tasks.length === 0 ? "The board is empty" : "Nothing matches that filter"}
          description={
            tasks.length === 0
              ? "Add the first task. Closing one records a contribution against whoever it was assigned to — that is what the ledger is built from."
              : "Try a different assignee, or clear the filter."
          }
          action={
            tasks.length === 0 && canWrite ? (
              <Button onClick={() => setComposing(true)}>Add a task</Button>
            ) : (
              <Button variant="secondary" onClick={() => setAssignee("all")}>
                Show everyone
              </Button>
            )
          }
        />
      ) : view === "board" ? (
        <TaskBoard groupId={groupId} tasks={filtered} members={members} canWrite={canWrite} />
      ) : (
        <TaskList groupId={groupId} tasks={filtered} sort={sort} />
      )}

      {composing ? (
        <Dialog open onOpenChange={(open) => (open ? undefined : setComposing(false))}>
          <DialogContent title="New task" description="It lands in To do. Move it from there.">
            <TaskForm
              groupId={groupId}
              members={members}
              canWrite={canWrite}
              onSaved={() => setComposing(false)}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

function TaskList({
  groupId,
  tasks,
  sort,
}: {
  groupId: string;
  tasks: ViewTask[];
  sort: "due" | "priority" | "created";
}) {
  const now = new Date();

  const sorted = [...tasks].sort((a, b) => {
    if (sort === "priority") return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (sort === "created") {
      return (
        TASK_COLUMNS.indexOf(a.status) - TASK_COLUMNS.indexOf(b.status) || a.position - b.position
      );
    }
    // Due first, undated last — an undated task is not urgent, it is unplanned,
    // and sorting it to the top would bury everything that has a real date.
    if (!a.dueDate && !b.dueDate) return a.position - b.position;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.getTime() - b.dueDate.getTime();
  });

  return (
    <ul className="grid divide-y divide-border rounded-xl border border-border">
      {sorted.map((task) => {
        const overdue = task.dueDate !== null && task.dueDate < now && task.status !== "DONE";

        return (
          <li key={task.id}>
            <Link
              href={`/groups/${groupId}/tasks/${task.id}`}
              className="focus-visible:outline-primary flex flex-wrap items-center gap-3 px-4 py-3 text-sm hover:bg-surface-sunken focus-visible:outline-2 focus-visible:-outline-offset-2"
            >
              <Badge tone={task.status === "DONE" ? "success" : "neutral"}>
                {TASK_COLUMN_LABEL[task.status]}
              </Badge>

              <span
                className={cn(
                  "min-w-0 flex-1 truncate font-medium",
                  task.status === "DONE" && "text-fg-muted line-through",
                )}
              >
                {task.title}
              </span>

              {task.assignees.slice(0, 3).map((assignee) => (
                <Avatar
                  key={assignee.user.id}
                  name={assignee.user.name}
                  src={assignee.user.avatarUrl}
                  seed={assignee.user.id}
                  size="xs"
                />
              ))}

              {task.dueDate ? (
                <time
                  dateTime={task.dueDate.toISOString()}
                  className={cn(
                    "w-20 shrink-0 text-right text-xs",
                    overdue ? "font-medium text-danger" : "text-fg-subtle",
                  )}
                >
                  {task.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </time>
              ) : (
                <span className="w-20 shrink-0 text-right text-xs text-fg-subtle">—</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
