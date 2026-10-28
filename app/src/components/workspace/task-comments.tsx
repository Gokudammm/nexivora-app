"use client";

import { RichText } from "@/components/content/rich-text";
import { Avatar } from "@/components/ui/display";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { commentOnTask } from "@/lib/workspace/tasks";

import { ActionForm } from "./action-form";

/**
 * Task comments.
 *
 * Rendered through the same markdown-lite renderer as project sections
 * (ADR-036), which emits React elements and never `dangerouslySetInnerHTML` —
 * so a comment cannot inject markup regardless of what somebody types into it.
 * There is no sanitiser to keep correct because there is no HTML path to
 * sanitise.
 */

type Comment = {
  id: string;
  body: string;
  createdAt: Date;
  author: { id: string; name: string; username: string | null; avatarUrl: string | null };
};

export function TaskComments({
  groupId,
  taskId,
  comments,
  members,
  canWrite,
}: {
  groupId: string;
  taskId: string;
  comments: Comment[];
  members: { id: string; name: string; username: string | null }[];
  canWrite: boolean;
}) {
  const handles = members
    .map((member) => member.username)
    .filter((username): username is string => Boolean(username));

  return (
    <section className="grid gap-4">
      <h3 className="font-medium">
        {comments.length === 0
          ? "Comments"
          : `${comments.length} ${comments.length === 1 ? "comment" : "comments"}`}
      </h3>

      {comments.length > 0 ? (
        <ul className="grid gap-4">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <Avatar
                name={comment.author.name}
                src={comment.author.avatarUrl}
                seed={comment.author.id}
                size="sm"
              />
              <div className="grid min-w-0 flex-1 gap-1">
                <p className="text-sm">
                  <span className="font-medium">{comment.author.name}</span>{" "}
                  <time
                    dateTime={comment.createdAt.toISOString()}
                    className="text-xs text-fg-subtle"
                  >
                    {comment.createdAt.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </p>
                <RichText body={comment.body} className="text-sm" />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {canWrite ? (
        <ActionForm action={commentOnTask} hidden={{ groupId, taskId }} submitLabel="Comment" quiet>
          <Field
            label="Add a comment"
            labelHidden
            hint={
              handles.length > 0
                ? `Mention a teammate with @${handles[0]}. Only people in this group can be mentioned.`
                : undefined
            }
          >
            <Textarea name="body" rows={3} required maxLength={4000} placeholder="Add a comment…" />
          </Field>
        </ActionForm>
      ) : null}
    </section>
  );
}
