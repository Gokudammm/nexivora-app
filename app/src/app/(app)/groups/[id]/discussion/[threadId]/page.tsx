import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeftIcon, CheckCircleIcon } from "@/components/icons";
import { RichText } from "@/components/content/rich-text";
import { Avatar, Badge } from "@/components/ui/display";
import { ActionButton } from "@/components/workspace/action-form";
import { ReplyForm } from "@/components/workspace/reply-form";
import { requireAuth } from "@/lib/auth/guards";
import { can } from "@/lib/authz/policy";
import { groupResource, requireWorkspace } from "@/lib/db/queries/group";
import { getThread } from "@/lib/db/queries/workspace";
import { buildMetadata } from "@/lib/seo/metadata";
import { pinThread, reopenThread } from "@/lib/workspace/discussion";

export const metadata = buildMetadata({
  title: "Thread",
  description: "A discussion thread inside a group workspace.",
  index: false,
  path: "/groups",
});

/**
 * One thread.
 *
 * Replies are flat — one nesting level, as the phase spec insists, because a
 * five-person conversation rendered as a tree becomes something you explore
 * rather than read, and the reply that answered the question ends up three
 * levels down where nobody sees it. Resolution does that job instead: the reply
 * that settled it is marked, at the top of the thread, in the list, everywhere.
 */
export default async function ThreadPage({
  params,
}: PageProps<"/groups/[id]/discussion/[threadId]">) {
  const { id, threadId } = await params;
  const viewer = await requireAuth(`/groups/${id}/discussion/${threadId}`);
  const workspace = await requireWorkspace(viewer, id);

  if (!workspace) notFound();

  const thread = await getThread(workspace, threadId);
  if (!thread) notFound();

  const canPost = can(viewer, "discussion:post", groupResource(workspace));
  const resolvable = thread.kind === "QUESTION" || thread.kind === "BLOCKER";

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <Link
        href={`/groups/${workspace.id}/discussion`}
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeftIcon />
        All threads
      </Link>

      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="outline">{thread.kind.toLowerCase()}</Badge>
          {thread.pinned ? <Badge tone="outline">pinned</Badge> : null}
          {thread.resolvedAt ? <Badge tone="success">resolved</Badge> : null}
        </div>

        <h2 className="text-xl font-semibold tracking-tight">{thread.title}</h2>

        <div className="flex items-center gap-2.5 text-sm text-fg-muted">
          <Avatar
            name={thread.author.name}
            src={thread.author.avatarUrl}
            seed={thread.author.id}
            size="sm"
          />
          {thread.author.name} ·{" "}
          <time dateTime={thread.createdAt.toISOString()}>
            {thread.createdAt.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </time>
        </div>
      </header>

      <RichText body={thread.body} />

      {canPost ? (
        <div className="flex flex-wrap gap-2 border-y border-border py-3">
          <ActionButton
            action={pinThread}
            hidden={{ groupId: workspace.id, threadId: thread.id }}
            label={thread.pinned ? "Unpin" : "Pin"}
            variant="ghost"
            size="sm"
          />
          {thread.resolvedAt ? (
            <ActionButton
              action={reopenThread}
              hidden={{ groupId: workspace.id, threadId: thread.id }}
              label="Reopen"
              variant="ghost"
              size="sm"
            />
          ) : null}
        </div>
      ) : null}

      {thread.messages.length > 0 ? (
        <ul className="grid gap-5">
          {thread.messages.map((message) => {
            const resolving = thread.resolvedByMessageId === message.id;

            return (
              <li
                key={message.id}
                className={
                  resolving ? "rounded-xl border border-success/40 bg-success-bg/30 p-4" : undefined
                }
              >
                <div className="flex gap-3">
                  <Avatar
                    name={message.author.name}
                    src={message.author.avatarUrl}
                    seed={message.author.id}
                    size="sm"
                  />
                  <div className="grid min-w-0 flex-1 gap-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{message.author.name}</span>
                      <time
                        dateTime={message.createdAt.toISOString()}
                        className="text-xs text-fg-subtle"
                      >
                        {message.createdAt.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </time>
                      {resolving ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                          <CheckCircleIcon />
                          This answered it
                        </span>
                      ) : null}
                    </p>
                    <RichText body={message.body} className="text-sm" />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-fg-subtle">No replies yet.</p>
      )}

      {canPost ? (
        <ReplyForm
          groupId={workspace.id}
          threadId={thread.id}
          canResolve={resolvable && thread.resolvedAt === null}
          handles={workspace.members
            .map((member) => member.user.username)
            .filter((username): username is string => Boolean(username))}
        />
      ) : null}
    </div>
  );
}
