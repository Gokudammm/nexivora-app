"use client";

import { useState } from "react";

import { Field } from "@/components/ui/field";
import { Checkbox, DatePicker, Input, Select, Textarea } from "@/components/ui/input";
import { createTask, updateTask } from "@/lib/workspace/tasks";

import { ActionForm } from "./action-form";

/**
 * One form, create and edit.
 *
 * Assignees are checkboxes rather than a multi-select, because a group is
 * between two and twelve people and a checkbox list is faster, obvious, and
 * works with a keyboard and a screen reader without any work. A combobox would
 * be the right answer at fifty people and the wrong one here.
 *
 * Assignee ids and labels are sent as comma-joined strings in one hidden field
 * apiece. `FormData` can carry repeated keys, but `Object.fromEntries` on the
 * server keeps only the last — so a repeated field would silently assign
 * exactly one person, which is the kind of bug that looks like a database
 * problem for an hour.
 */

export type TaskFormMember = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
};

export type TaskDraft = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  assigneeIds: string[];
  labels: string[];
};

const iso = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : "");

export function TaskForm({
  groupId,
  taskId,
  task,
  members,
  canWrite,
  defaultStatus = "TODO",
  onSaved,
}: {
  groupId: string;
  taskId?: string;
  task?: TaskDraft;
  members: TaskFormMember[];
  canWrite: boolean;
  defaultStatus?: string;
  onSaved?: () => void;
}) {
  const [assignees, setAssignees] = useState<string[]>(task?.assigneeIds ?? []);

  if (!canWrite) {
    return (
      <p className="text-sm text-fg-muted">
        You can read this workspace but not change it. Faculty comment on work; they do not edit it.
      </p>
    );
  }

  return (
    <ActionForm
      action={task || taskId ? updateTask : createTask}
      hidden={{
        groupId,
        taskId: task?.id ?? taskId,
        assigneeIds: assignees.join(","),
        status: task?.status ?? defaultStatus,
      }}
      submitLabel={task || taskId ? "Save task" : "Add task"}
      quiet
      onDone={onSaved}
    >
      <Field label="Title" required>
        <Input name="title" required maxLength={160} defaultValue={task?.title} autoFocus />
      </Field>

      <Field label="Description" hint="Markdown works: headings, lists, `code`, **bold**.">
        <Textarea
          name="description"
          rows={4}
          maxLength={4000}
          defaultValue={task?.description ?? ""}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Due date">
          <DatePicker name="dueDate" defaultValue={iso(task?.dueDate ?? null)} />
        </Field>

        <Field label="Priority">
          <Select name="priority" defaultValue={task?.priority ?? "MEDIUM"}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </Select>
        </Field>
      </div>

      <Field label="Labels" hint="Comma separated. Six at most.">
        <Input
          name="labels"
          defaultValue={task?.labels.join(", ") ?? ""}
          placeholder="hardware, report"
        />
      </Field>

      <fieldset className="grid gap-2">
        <legend className="text-sm leading-none font-medium">Assigned to</legend>
        <p className="text-xs text-fg-muted">
          Whoever is assigned gets the ledger credit when this task is closed.
        </p>

        <div className="grid gap-1.5 sm:grid-cols-2">
          {members.map((member) => (
            <Checkbox
              key={member.id}
              label={member.name}
              checked={assignees.includes(member.id)}
              onCheckedChange={(checked) =>
                setAssignees((current) =>
                  checked ? [...current, member.id] : current.filter((id) => id !== member.id),
                )
              }
            />
          ))}
        </div>
      </fieldset>
    </ActionForm>
  );
}
