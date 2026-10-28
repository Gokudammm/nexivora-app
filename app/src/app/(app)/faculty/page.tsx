import Link from "next/link";

import { Avatar, Badge } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { HealthSignals } from "@/components/faculty/health-signals";
import { AUDIENCE_FRAMING } from "@/lib/ledger/health";
import { requireAuth } from "@/lib/auth/guards";
import { facultyDashboard } from "@/lib/db/queries/faculty";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Teaching",
  description:
    "What needs your attention across every group you supervise — submissions, proposals, at-risk groups and this week's deadlines.",
  index: false,
  path: "/faculty",
});

/**
 * `/faculty` — the dashboard.
 *
 * Acceptance criterion 1: *a faculty member opens this and, without clicking,
 * knows what needs attention today.* Everything on this page is subordinate to
 * that sentence.
 *
 * So **Needs attention** is first, ranked, and above the fold; the counts are a
 * strip rather than a wall of cards; and nothing here requires interpretation —
 * every row says what happened and offers the next step. The spec is blunt
 * about the stakes: *"if a faculty member does not open this dashboard weekly
 * without being reminded, the product has failed"*.
 */
export default async function FacultyPage() {
  const viewer = await requireAuth("/faculty");
  const now = new Date();
  const data = await facultyDashboard(viewer, now);

  const nothingToDo =
    data.counts.awaitingReview === 0 &&
    data.counts.awaitingApproval === 0 &&
    data.atRisk.length === 0 &&
    data.unanswered.length === 0;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="grid content-start gap-6 lg:col-span-2">
        {/* ------------------------------------------- needs attention */}

        <section className="grid gap-4">
          <div className="grid gap-1">
            <h2 className="font-medium">{AUDIENCE_FRAMING.faculty.heading}</h2>
            <p className="text-xs text-fg-muted">{AUDIENCE_FRAMING.faculty.note}</p>
          </div>

          {nothingToDo ? (
            <EmptyState
              title="Nothing waiting on you"
              description="No submissions to review, no proposals to approve, and no group showing a signal. That is a good week."
              action={
                <Button asChild variant="secondary">
                  <Link href="/faculty/groups">Look at the groups anyway</Link>
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-3">
              {data.queue.length > 0 ? (
                <Row
                  href="/faculty/submissions"
                  tone="warning"
                  label={`${data.queue.length} ${data.queue.length === 1 ? "submission" : "submissions"} awaiting review`}
                  detail={
                    data.queue[0]
                      ? `Longest waiting: "${data.queue[0].title}" since ${data.queue[0].statusEvents[0]?.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "long" }) ?? "recently"}.`
                      : ""
                  }
                  action="Review the next one"
                />
              ) : null}

              {data.proposals.length > 0 ? (
                <Row
                  href="/faculty/proposals"
                  tone="info"
                  label={`${data.proposals.length} ${data.proposals.length === 1 ? "proposal" : "proposals"} awaiting approval`}
                  detail={
                    data.proposals[0]
                      ? `Oldest: "${data.proposals[0].title}" from ${data.proposals[0].group?.name ?? "a group"}.`
                      : ""
                  }
                  action="Open the queue"
                />
              ) : null}

              {data.unanswered.length > 0 ? (
                <Row
                  href={`/groups/${data.unanswered[0]!.groupId}/discussion/${data.unanswered[0]!.id}`}
                  tone="info"
                  label={`${data.unanswered.length} unanswered ${data.unanswered.length === 1 ? "question" : "questions"}`}
                  detail={`Oldest: "${data.unanswered[0]!.title}" in ${data.unanswered[0]!.group?.name ?? "a group"}.`}
                  action="Answer it"
                />
              ) : null}
            </ul>
          )}
        </section>

        {/* ----------------------------------------------- at-risk groups */}

        {data.atRisk.length > 0 ? (
          <section className="grid gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-medium">Groups showing a signal</h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/faculty/groups">All {data.counts.groups} groups</Link>
              </Button>
            </div>

            <ul className="grid gap-3">
              {data.atRisk.slice(0, 5).map((group) => (
                <li key={group.id} className="grid gap-3 rounded-xl border border-border p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid gap-1">
                      <h3 className="flex flex-wrap items-center gap-2 font-medium">
                        <Link
                          href={`/groups/${group.id}`}
                          className="hover:text-primary underline underline-offset-4"
                        >
                          {group.name}
                        </Link>
                        <Badge tone={group.level === "attention" ? "warning" : "neutral"}>
                          {group.signals.length} {group.signals.length === 1 ? "signal" : "signals"}
                        </Badge>
                      </h3>
                      <p className="text-xs text-fg-muted">
                        {group.className ?? "No class"} · {group.progress}% complete
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {group.members.slice(0, 5).map((member) => (
                        <Avatar
                          key={member.id}
                          name={member.name}
                          src={member.avatarUrl}
                          seed={member.id}
                          size="xs"
                        />
                      ))}
                    </div>
                  </div>

                  <HealthSignals signals={group.signals} groupId={group.id} limit={2} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* -------------------------------------------- recent activity */}

        <section className="grid gap-3">
          <h2 className="font-medium">Recent activity</h2>

          {data.recent.length === 0 ? (
            <p className="text-sm text-fg-subtle">Nothing recorded in your groups yet.</p>
          ) : (
            <ul className="grid gap-1">
              {data.recent.map((event) => (
                <li key={event.id} className="flex items-center gap-3 py-1.5 text-sm">
                  <Avatar
                    name={event.user.name}
                    src={event.user.avatarUrl}
                    seed={event.user.id}
                    size="xs"
                  />
                  <span className="min-w-0 flex-1 truncate text-fg-muted">
                    <span className="font-medium text-fg">{event.user.name}</span> in{" "}
                    <Link
                      href={`/groups/${event.group.id}`}
                      className="underline underline-offset-4 hover:text-fg"
                    >
                      {event.group.name}
                    </Link>
                  </span>
                  <time
                    dateTime={event.createdAt.toISOString()}
                    className="shrink-0 text-xs text-fg-subtle"
                  >
                    {event.createdAt.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* --------------------------------------------------- sidebar */}

      <aside className="grid content-start gap-6">
        <section className="grid gap-3 rounded-xl border border-border p-5">
          <h2 className="font-medium">This term</h2>
          <dl className="grid grid-cols-2 gap-4">
            {(
              [
                ["Groups", data.counts.groups],
                ["Students", data.counts.students],
                ["Classes", data.counts.classes],
                ["Showing a signal", data.counts.atRisk],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="grid gap-0.5">
                <dt className="text-xs text-fg-muted">{label}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="grid gap-3 rounded-xl border border-border p-5">
          <h2 className="font-medium">Due this week</h2>

          {data.deadlines.length === 0 ? (
            <p className="text-sm text-fg-subtle">Nothing due in the next seven days.</p>
          ) : (
            <ul className="grid gap-2">
              {data.deadlines.slice(0, 8).map((task) => (
                <li key={task.id} className="grid gap-0.5 text-sm">
                  <Link
                    href={`/groups/${task.group.id}/tasks`}
                    className="hover:text-primary truncate"
                  >
                    {task.title}
                  </Link>
                  <span className="text-xs text-fg-subtle">
                    {task.group.name} ·{" "}
                    <time dateTime={task.dueDate!.toISOString()}>
                      {task.dueDate!.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </time>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-2 rounded-xl border border-border p-5">
          <h2 className="font-medium">Quick actions</h2>
          <div className="grid gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/faculty/announcements">Post an announcement</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/faculty/rubrics">Manage rubrics</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/faculty/attestations">Issue an attestation</Link>
            </Button>
          </div>
        </section>
      </aside>
    </div>
  );
}

function Row({
  href,
  tone,
  label,
  detail,
  action,
}: {
  href: string;
  tone: "warning" | "info";
  label: string;
  detail: string;
  action: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className={
          tone === "warning"
            ? "focus-visible:outline-primary flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning-bg/30 px-4 py-3.5 transition-colors hover:border-warning focus-visible:outline-2"
            : "focus-visible:outline-primary flex flex-wrap items-center gap-3 rounded-xl border border-border px-4 py-3.5 transition-colors hover:border-border-strong focus-visible:outline-2"
        }
      >
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="text-sm font-medium">{label}</span>
          {detail ? <span className="text-xs text-fg-muted">{detail}</span> : null}
        </span>
        <span className="shrink-0 text-xs underline underline-offset-4">{action}</span>
      </Link>
    </li>
  );
}
