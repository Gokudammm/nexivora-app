"use client";

import { Sheet, SheetContent } from "@/components/ui/overlay";

import { TaskForm, type TaskFormMember } from "./task-form";

/**
 * The edit sheet.
 *
 * A sheet rather than a page because editing a task is a side errand — you are
 * looking at a board, you change one field, you carry on looking at the board.
 * Sending somebody to a full page for that loses their scroll position and
 * their sense of where they were.
 *
 * The task itself is a deep-linkable page as well (`/tasks/[taskId]`), because
 * a notification has to be able to point at one. Same form, two frames.
 */
export function TaskSheet({
  groupId,
  taskId,
  members,
  canWrite,
  onClose,
}: {
  groupId: string;
  taskId: string;
  members: TaskFormMember[];
  canWrite: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent title="Task" description="Edit the task, or open it in full to comment.">
        <TaskForm
          groupId={groupId}
          taskId={taskId}
          members={members}
          canWrite={canWrite}
          onSaved={onClose}
        />
      </SheetContent>
    </Sheet>
  );
}
