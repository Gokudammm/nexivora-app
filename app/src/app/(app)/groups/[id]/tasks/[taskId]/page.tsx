import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeftIcon } from "@/components/icons";
import { RichText } from "@/components/content/rich-text";
import { Avatar, Badge } from "@/components/ui/display";
import { ActionButton } from "@/components/workspace/action-form";
import { TaskComments } from "@/components/workspace/task-comments";
import { TaskForm } from "@/components/workspace/task-form";
import { requireAuth } from "@/lib/auth/guards";
import { can } from "@/lib/authz/policy";
import { groupResource, requireWorkspace } from "@/lib/db/queries/group";
import { TASK_COLUMNS, TASK_COLUMN_LABEL } from "@/config/tasks";
import { getTask } from "@/lib/db/queries/workspace";
import { buildMetadata } from "@/lib/seo/metadata";
import { setTaskStatus } from "@/lib/workspace/tasks";

export const metadata = buildMetadata({
  title: "Task",
  description: "A single task in a group workspace, with its comments and its history.",
  index: false,
  path: "/groups",
});

/**
 * The task deep link.
 *
 * This page exists so a notification, a mention or a meeting's action item can
 * point at one specific task. Everything on the board is reachable here, plus
 * the two things that do not fit on a card: the full description and the
 * comment thread.
 */
export default async function TaskPage({ params }: PageProps<"/groups/[id]/tasks/[taskId]">) {
  const { id, taskId } = await params;
  const viewer = await requireAuth(`/groups/${id}/tasks/${taskId}`);
  const workspace = await requireWorkspace(viewer, id);

  if (!workspace) notFound();

  const task = await getTask(workspace, taskId);
  if (!task) notFound();

  const canWrite = can(viewer, "task:write", groupResource(workspace));
  const members = workspace.members.map((member) => ({
    id: member.user.id,
    name: member.user.name,
    username: member.user.username,
    avatarUrl: member.user.avatarUrl,
  }));
  const byId = new Map(members.map((member) => [member.id, member]));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="grid content-start gap-6 lg:col-span-2">
        <Link
          href={`/groups/${workspace.id}/tasks`}
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
        >
          <ArrowLeftIcon />
          Back to the board
        </Link>

        <header className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={task.status === "DONE" ? "success" : "neutral"}>
              {TASK_COLUMN_LABEL[task.status]}
            </Badge>
            {task.labels.map((label) => (
              <Badge key={label.id} tone="outline">
                {label.name}
              </Badge>
            ))}
          </div>

          <h2 className="text-xl font-semibold tracking-tight">{task.title}</h2>

          <p className="text-sm text-fg-muted">
            Added by {task.creator.name}
            {task.dueDate
              ? ` · due ${task.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
              : ""}
            {task.closedAt
              ? ` · closed ${task.closedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
              : ""}
          </p>
        </header>

        {task.description ? (
          <RichText body={task.description} />
        ) : (
          <p className="text-sm text-fg-subtle">No description.</p>
        )}

        <TaskComments
          groupId={workspace.id}
          taskId={task.id}
          canWrite={canWrite}
          members={members}
          comments={task.comments.map((comment) => ({
            id: comment.id,
            body: comment.body,
            createdAt: comment.createdAt,
            author: byId.get(comment.authorId) ?? {
              id: comment.authorId,
              name: "A teammate",
              username: null,
              avatarUrl: null,
            },
          }))}
        />
      </div>

      <aside className="grid content-start gap-6">
        {canWrite ? (
          <section className="grid gap-3 rounded-xl border border-border p-5">
            <h3 className="font-medium">Move</h3>
            <div className="flex flex-wrap gap-2">
              {TASK_COLUMNS.filter((status) => status !== task.status).map((status) => (
                <ActionButton
                  key={status}
                  action={setTaskStatus}
                  hidden={{ groupId: workspace.id, taskId: task.id, status }}
                  label={TASK_COLUMN_LABEL[status]}
                  size="sm"
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-3 rounded-xl border border-border p-5">
          <h3 className="font-medium">Assigned to</h3>
          {task.assignees.length === 0 ? (
            <p className="text-sm text-fg-subtle">Nobody yet.</p>
          ) : (
            <ul className="grid gap-2">
              {task.assignees.map((assignee) => (
                <li key={assignee.user.id} className="flex items-center gap-2.5 text-sm">
                  <Avatar
                    name={assignee.user.name}
                    src={assignee.user.avatarUrl}
                    seed={assignee.user.id}
                    size="sm"
                  />
                  {assignee.user.name}
                </li>
              ))}
            </ul>
          )}
        </section>

        {canWrite ? (
          <section className="grid gap-3 rounded-xl border border-border p-5">
            <h3 className="font-medium">Edit</h3>
            <TaskForm
              groupId={workspace.id}
              canWrite={canWrite}
              members={members}
              task={{
                id: task.id,
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                dueDate: task.dueDate,
                assigneeIds: task.assignees.map((assignee) => assignee.user.id),
                labels: task.labels.map((label) => label.name),
              }}
            />
          </section>
        ) : null}
      </aside>
    </div>
  );
}
