import Link from "next/link";

import { Avatar, Badge } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/auth/guards";
import { listSubmissionQueue } from "@/lib/db/queries/faculty";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Submissions",
  description: "Projects awaiting review, oldest first, with how long each has been waiting.",
  index: false,
  path: "/faculty/submissions",
});

/**
 * `/faculty/submissions` — the queue.
 *
 * **Oldest first, and the wait is the prominent number.** A newest-first queue
 * buries the submission that has been sitting for three weeks, which is the one
 * that matters — both to the group waiting on it and to whether this product is
 * worth opening.
 *
 * A row that already has a draft says so. Coming back to a half-marked
 * evaluation and not knowing it exists is how two conflicting drafts get made.
 */
export default async function SubmissionsPage() {
  const viewer = await requireAuth("/faculty/submissions");
  const queue = await listSubmissionQueue(viewer);
  const now = new Date();

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h2 className="font-medium">Awaiting review</h2>
        <p className="text-sm text-fg-muted">
          {queue.length === 0
            ? "Nothing waiting."
            : `${queue.length} ${queue.length === 1 ? "submission" : "submissions"}, longest wait first.`}
        </p>
      </div>

      {queue.length === 0 ? (
        <EmptyState
          title="Nothing to review"
          description="When a group submits a project for review it appears here, with the record and the rubric side by side and the contribution ledger beside the per-member marks."
          action={
            <Button asChild variant="secondary">
              <Link href="/faculty/groups">See how the groups are doing</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3">
          {queue.map((project) => {
            const since = project.statusEvents[0]?.createdAt ?? project.updatedAt;
            const days = Math.floor((now.getTime() - since.getTime()) / 86_400_000);
            const draft = project.evaluations[0] && !project.evaluations[0].releasedAt;
            const round = project.submissions[0]?.round ?? 1;

            return (
              <li key={project.id} className="grid gap-3 rounded-xl border border-border p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <h3 className="flex flex-wrap items-center gap-2 font-medium">
                      <Link
                        href={`/projects/${project.slug}/review`}
                        className="hover:text-primary underline underline-offset-4"
                      >
                        {project.title}
                      </Link>
                      {round > 1 ? <Badge tone="neutral">round {round}</Badge> : null}
                      {draft ? <Badge tone="info">draft saved</Badge> : null}
                    </h3>

                    <p className="text-xs text-fg-muted">
                      {project.group?.name ?? "No group"} · waiting{" "}
                      <span className={days >= 7 ? "font-medium text-warning" : undefined}>
                        {days === 0 ? "since today" : `${days} ${days === 1 ? "day" : "days"}`}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {(project.group?.members ?? []).slice(0, 5).map((member) => (
                      <Avatar
                        key={member.user.id}
                        name={member.user.name}
                        src={member.user.avatarUrl}
                        seed={member.user.id}
                        size="xs"
                      />
                    ))}
                  </div>
                </div>

                <p className="text-sm text-fg-muted">{project.summary}</p>

                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href={`/projects/${project.slug}/review`}>
                      {draft ? "Continue marking" : "Review"}
                    </Link>
                  </Button>
                  {project.group ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/groups/${project.group.id}/ledger`}>Ledger</Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
