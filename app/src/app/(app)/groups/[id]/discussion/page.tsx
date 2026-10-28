import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { NewThreadForm } from "@/components/workspace/new-thread-form";
import { requireAuth } from "@/lib/auth/guards";
import { can } from "@/lib/authz/policy";
import { groupResource, requireWorkspace } from "@/lib/db/queries/group";
import { listThreads } from "@/lib/db/queries/workspace";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Discussion",
  description:
    "Threaded discussion for the group — questions, decisions and blockers, with the reply that resolved each one marked.",
  index: false,
  path: "/groups",
});

const KIND_TONE = {
  GENERAL: "neutral",
  QUESTION: "info",
  DECISION: "accent",
  BLOCKER: "warning",
} as const;

const KIND_LABEL = {
  GENERAL: "general",
  QUESTION: "question",
  DECISION: "decision",
  BLOCKER: "blocker",
} as const;

/**
 * `/groups/[id]/discussion`.
 *
 * Threads, not chat. The kinds are the point: a `DECISION` thread is the thing
 * a group cannot reconstruct three months later from a WhatsApp scroll, and
 * marking the reply that resolved a `QUESTION` is what makes the archive worth
 * reading rather than re-reading.
 */
export default async function DiscussionPage({ params }: PageProps<"/groups/[id]/discussion">) {
  const { id } = await params;
  const viewer = await requireAuth(`/groups/${id}/discussion`);
  const workspace = await requireWorkspace(viewer, id);

  if (!workspace) notFound();

  const threads = await listThreads(workspace);
  const canPost = can(viewer, "discussion:post", groupResource(workspace));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="grid content-start gap-4 lg:col-span-2">
        {threads.length === 0 ? (
          <EmptyState
            title="No discussion yet"
            description="Ask a question, record a decision, or flag a blocker. Threads stay findable long after a chat scroll would have buried them."
            action={null}
          />
        ) : (
          <ul className="grid divide-y divide-border rounded-xl border border-border">
            {threads.map((thread) => (
              <li key={thread.id}>
                <Link
                  href={`/groups/${workspace.id}/discussion/${thread.id}`}
                  className="focus-visible:outline-primary grid gap-1.5 px-4 py-3.5 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:-outline-offset-2"
                >
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge tone={KIND_TONE[thread.kind]}>{KIND_LABEL[thread.kind]}</Badge>
                    {thread.pinned ? <Badge tone="outline">pinned</Badge> : null}
                    {thread.resolvedAt ? <Badge tone="success">resolved</Badge> : null}
                    <span className="min-w-0 flex-1 truncate font-medium">{thread.title}</span>
                  </p>

                  <p className="text-xs text-fg-muted">
                    {thread.author.name} ·{" "}
                    {thread.createdAt.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {thread._count.messages} {thread._count.messages === 1 ? "reply" : "replies"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="grid content-start gap-4">
        {canPost ? (
          <section className="grid gap-3 rounded-xl border border-border p-5">
            <h2 className="font-medium">Start a thread</h2>
            <NewThreadForm groupId={workspace.id} />
          </section>
        ) : null}

        <section className="grid gap-2 rounded-xl border border-border p-5 text-sm text-fg-muted">
          <h2 className="font-medium text-fg">Why threads and not chat</h2>
          <p>
            You already have a group chat, and it is better than ours would be. What it cannot do is
            answer &ldquo;why did we choose MQTT&rdquo; in March. That is what a decision thread is
            for.
          </p>
        </section>
      </aside>
    </div>
  );
}
