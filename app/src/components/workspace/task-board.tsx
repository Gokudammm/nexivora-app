"use client";

import { useOptimistic, useState, useTransition } from "react";

import { DragIcon, MoreIcon } from "@/components/icons";
import { Avatar, Badge } from "@/components/ui/display";
import { useToast } from "@/components/ui/toast";
import { TASK_COLUMNS, TASK_COLUMN_LABEL } from "@/config/tasks";
import { setTaskStatus } from "@/lib/workspace/tasks";
import { cn } from "@/lib/utils/cn";

import { TaskSheet } from "./task-sheet";

/**
 * THE BOARD.
 *
 * Two requirements pull in opposite directions and both are non-negotiable.
 *
 * **1 · A drag must feel instantaneous** (acceptance criterion 4). A board that
 * waits 300ms for a server round trip before the card moves feels broken, and a
 * workspace that feels broken loses to a WhatsApp group on day one. So the move
 * is optimistic: `useOptimistic` puts the card in its new column at 0ms, the
 * action runs behind it, and a failure **reverts the card visibly and says
 * why** — a silent revert is worse than no optimism, because the user believes
 * the move happened.
 *
 * **2 · The whole board must work with no dragging at all** (acceptance
 * criterion 3). Drag-and-drop is unusable with a keyboard, unreliable with a
 * screen reader and awkward on a phone. So every card carries a **"Move to"
 * menu** that does exactly what a drag does. This is an accessibility
 * requirement first — and it is also the reason the board needs no drag library
 * whatsoever: the HTML5 drag events are a progressive enhancement over a
 * control that already works.
 *
 * The drag implementation is deliberately the native one. A 40 KB library for
 * five columns would be the largest dependency in the product, and it would
 * still need the menu built beside it.
 */

export type BoardTask = {
  id: string;
  title: string;
  status: (typeof TASK_COLUMNS)[number];
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: Date | null;
  position: number;
  labels: { id: string; name: string; color: string | null }[];
  assignees: { user: { id: string; name: string; avatarUrl: string | null } }[];
  commentCount: number;
};

type Move = { taskId: string; status: BoardTask["status"] };

const PRIORITY_TONE = {
  URGENT: "danger",
  HIGH: "warning",
  MEDIUM: "neutral",
  LOW: "neutral",
} as const;

export function TaskBoard({
  groupId,
  tasks,
  members,
  canWrite,
}: {
  groupId: string;
  tasks: BoardTask[];
  members: { id: string; name: string; username: string | null; avatarUrl: string | null }[];
  canWrite: boolean;
}) {
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [openTask, setOpenTask] = useState<BoardTask | null>(null);
  // Once per mount, not per render. Two cards disagreeing about "today" is a
  // bug that only shows up around midnight, and a ref read during render is
  // the wrong tool for it — that is what the lazy initialiser is for.
  const [now] = useState(() => new Date());

  const [optimistic, applyMove] = useOptimistic(tasks, (current, move: Move) =>
    current.map((task) => (task.id === move.taskId ? { ...task, status: move.status } : task)),
  );

  const move = (task: BoardTask, status: BoardTask["status"]) => {
    if (task.status === status || !canWrite) return;

    startTransition(async () => {
      // The optimistic update must happen inside the transition, or React
      // reverts it the moment the transition starts rather than when the
      // action resolves.
      applyMove({ taskId: task.id, status });

      const data = new FormData();
      data.set("groupId", groupId);
      data.set("taskId", task.id);
      data.set("status", status);

      const result = await setTaskStatus(null, data);

      if (!result.ok) {
        // The card snaps back on its own when the transition ends without a
        // server change. What does not happen on its own is telling the person
        // why — and a card that silently returns to where it was is the single
        // most confusing thing an optimistic interface can do.
        toast({
          tone: "error",
          title: `"${task.title}" did not move`,
          description: result.error,
        });
      }
    });
  };

  const columns = TASK_COLUMNS.map((status) => ({
    status,
    tasks: optimistic
      .filter((task) => task.status === status)
      .sort((a, b) => a.position - b.position),
  }));

  return (
    <>
      {/*
        13rem, not 15: five columns plus their gaps have to fit the content area
        beside the sidebar at a 1440px viewport, or the board opens with "Done"
        half off-screen and the whole point of a board — seeing every column at
        once — is lost to a horizontal scroll nobody performs. It still scrolls
        below that width; the container does, never the page body.
      */}
      <div className="grid gap-3 overflow-x-auto pb-2 md:auto-cols-[minmax(13rem,1fr)] md:grid-flow-col">
        {columns.map((column) => (
          <section
            key={column.status}
            data-column={column.status}
            aria-label={TASK_COLUMN_LABEL[column.status]}
            onDragOver={(event) => {
              if (dragging) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              const task = optimistic.find((row) => row.id === dragging);
              setDragging(null);
              if (task) move(task, column.status);
            }}
            className={cn(
              // A column scrolls internally rather than stretching the board.
              // With 18 done tasks and one in every other column, a grid that
              // sizes to its tallest child made the page 2300px long and left
              // four empty columns two screens tall — which looked broken and
              // buried the ledger link below all of it.
              "flex max-h-[calc(100vh-19rem)] min-h-40 flex-col gap-2 rounded-xl border border-border bg-surface-sunken/40 p-3 transition-colors",
              dragging && "border-dashed border-border-strong",
            )}
          >
            <h3 className="flex shrink-0 items-center justify-between px-1 text-sm font-medium">
              {TASK_COLUMN_LABEL[column.status]}
              <span className="text-xs font-normal text-fg-subtle">{column.tasks.length}</span>
            </h3>

            {column.tasks.length === 0 ? (
              <p className="px-1 py-3 text-xs text-fg-subtle">Nothing here.</p>
            ) : (
              <ul className="-mr-1 grid min-h-0 gap-2 overflow-y-auto pr-1">
                {column.tasks.map((task) => (
                  <li key={task.id} data-task={task.id}>
                    <TaskCard
                      task={task}
                      now={now}
                      canWrite={canWrite}
                      dragging={dragging === task.id}
                      onDragStart={() => setDragging(task.id)}
                      onDragEnd={() => setDragging(null)}
                      onMove={(status) => move(task, status)}
                      onOpen={() => setOpenTask(task)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {openTask ? (
        <TaskSheet
          groupId={groupId}
          taskId={openTask.id}
          members={members}
          canWrite={canWrite}
          onClose={() => setOpenTask(null)}
        />
      ) : null}
    </>
  );
}

function TaskCard({
  task,
  now,
  canWrite,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
  onOpen,
}: {
  task: BoardTask;
  now: Date;
  canWrite: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (status: BoardTask["status"]) => void;
  onOpen: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const overdue = task.dueDate !== null && task.dueDate < now && task.status !== "DONE";

  return (
    <div
      draggable={canWrite}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        // Firefox refuses to start a drag unless something is set.
        event.dataTransfer.setData("text/plain", task.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "grid gap-2 rounded-lg border border-border bg-surface p-3 transition-opacity",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="focus-visible:outline-primary hover:text-primary min-w-0 flex-1 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {task.title}
        </button>

        {canWrite ? (
          <div className="relative shrink-0">
            <button
              type="button"
              data-task-menu={task.id}
              aria-label={`Move "${task.title}" to another column`}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((open) => !open)}
              onBlur={(event) => {
                if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) {
                  setMenuOpen(false);
                }
              }}
              className="focus-visible:outline-primary rounded p-0.5 text-fg-subtle hover:text-fg focus-visible:outline-2"
            >
              <MoreIcon />
            </button>

            {menuOpen ? (
              <ul
                role="menu"
                className="absolute right-0 z-10 mt-1 grid w-44 gap-0.5 rounded-lg border border-border bg-surface p-1 shadow-lg"
              >
                {TASK_COLUMNS.filter((status) => status !== task.status).map((status) => (
                  <li key={status}>
                    <button
                      type="button"
                      role="menuitem"
                      data-move-to={status}
                      onClick={() => {
                        setMenuOpen(false);
                        onMove(status);
                      }}
                      onBlur={(event) => {
                        if (
                          !event.currentTarget
                            .closest("[role='menu']")
                            ?.parentElement?.contains(event.relatedTarget)
                        ) {
                          setMenuOpen(false);
                        }
                      }}
                      className="focus-visible:outline-primary w-full rounded px-2 py-1.5 text-left text-sm hover:bg-surface-sunken focus-visible:outline-2"
                    >
                      Move to {TASK_COLUMN_LABEL[status].toLowerCase()}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {task.labels.length > 0 ? (
        <ul className="flex flex-wrap gap-1">
          {task.labels.map((label) => (
            <li key={label.id}>
              <Badge tone="outline">{label.name}</Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {task.assignees.slice(0, 3).map((assignee) => (
            <Avatar
              key={assignee.user.id}
              name={assignee.user.name}
              src={assignee.user.avatarUrl}
              seed={assignee.user.id}
              size="xs"
            />
          ))}
          {task.assignees.length === 0 ? (
            <span className="text-xs text-fg-subtle">Unassigned</span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {task.priority !== "MEDIUM" && task.priority !== "LOW" ? (
            <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority.toLowerCase()}</Badge>
          ) : null}

          {task.dueDate ? (
            <time
              dateTime={task.dueDate.toISOString()}
              className={cn("text-xs", overdue ? "font-medium text-danger" : "text-fg-subtle")}
            >
              {task.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </time>
          ) : null}

          {canWrite ? (
            <span aria-hidden className="cursor-grab text-fg-subtle">
              <DragIcon />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
