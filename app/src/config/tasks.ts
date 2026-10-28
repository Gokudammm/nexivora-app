import type { $Enums } from "@prisma/client";

/**
 * The board's columns.
 *
 * These live in `config/` rather than beside the task queries for a structural
 * reason, not a tidiness one: the board and the task list are **client**
 * components, and importing a constant from `lib/db/queries/*` pulls that
 * module's `db` import — and therefore `pg`, and therefore `node:util` — into
 * the browser bundle. It builds fine as types, and fails at bundle time with a
 * module-not-found trace that points at the component rather than the import
 * that caused it.
 *
 * The rule that follows: **a value a client component needs never lives in a
 * query module.** Types are fine — `import type` is erased — but a runtime
 * constant has to sit somewhere with no server-only dependencies, and that is
 * what `config/` is for.
 */

export const TASK_COLUMNS: readonly $Enums.TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "REVIEW",
  "DONE",
];

export const TASK_COLUMN_LABEL: Record<$Enums.TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  REVIEW: "In review",
  DONE: "Done",
};

/** Statuses that are not finished — the definition of "open" everywhere. */
export const OPEN_TASK_STATUSES: $Enums.TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "REVIEW"];

export const TASK_PRIORITY_ORDER: Record<$Enums.TaskPriority, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};
