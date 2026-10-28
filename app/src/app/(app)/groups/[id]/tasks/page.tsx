import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/feedback";
import { TasksView } from "@/components/workspace/tasks-view";
import { requireAuth } from "@/lib/auth/guards";
import { can } from "@/lib/authz/policy";
import { groupResource, requireWorkspace } from "@/lib/db/queries/group";
import { listTasks } from "@/lib/db/queries/workspace";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Tasks",
  description:
    "The group's task board — five columns, drag or keyboard, and closing a task records the contribution that produced it.",
  index: false,
  path: "/groups",
});

/**
 * `/groups/[id]/tasks`.
 *
 * Board and list are equal alternatives rather than a primary and a fallback:
 * a board is better for "where is everything" and a list is better for "what is
 * due first", and which one a person wants depends on the day. The choice is
 * client state, so switching it costs nothing and does not reload the page.
 */
export default async function TasksPage({ params }: PageProps<"/groups/[id]/tasks">) {
  const { id } = await params;
  const viewer = await requireAuth(`/groups/${id}/tasks`);
  const workspace = await requireWorkspace(viewer, id);

  if (!workspace) notFound();

  const tasks = await listTasks(workspace);
  const canWrite = can(viewer, "task:write", groupResource(workspace));

  const members = workspace.members.map((member) => ({
    id: member.user.id,
    name: member.user.name,
    username: member.user.username,
    avatarUrl: member.user.avatarUrl,
  }));

  if (tasks.length === 0 && !canWrite) {
    return (
      <EmptyState
        title="No tasks yet"
        description="This group has not put anything on its board. Nothing to see here until they do."
        action={null}
      />
    );
  }

  return (
    <TasksView
      groupId={workspace.id}
      canWrite={canWrite}
      members={members}
      tasks={tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        position: task.position,
        labels: task.labels,
        assignees: task.assignees,
        commentCount: task._count.comments,
      }))}
    />
  );
}
