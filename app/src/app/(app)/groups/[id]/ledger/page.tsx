import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/feedback";
import { HealthSignals } from "@/components/faculty/health-signals";
import { LedgerView } from "@/components/workspace/ledger-view";
import { requireAuth } from "@/lib/auth/guards";
import { can } from "@/lib/authz/policy";
import { teachesSubject } from "@/lib/authz/viewer";
import { groupResource, requireWorkspace } from "@/lib/db/queries/group";
import { groupSignals } from "@/lib/db/queries/health";
import {
  listLedgerEvents,
  listMilestones,
  getReviews,
  outstandingReviews,
} from "@/lib/db/queries/workspace";
import { AUDIENCE_FRAMING } from "@/lib/ledger/health";
import { contributionTimeline, scoreMembers, balanceSummary } from "@/lib/ledger/score";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Contribution ledger",
  description:
    "Who did what in this group, derived from real workspace activity, with every number linked to the evidence behind it.",
  index: false,
  path: "/groups",
});

/**
 * THE LEDGER.
 *
 * **Visible to every member**, not only to faculty. That is the design decision
 * the whole feature rests on, and it is easy to get backwards:
 *
 *  · A ledger the group can see **changes behaviour during the project**, which
 *    is the entire point. A member watching their own column stay flat in
 *    week three can do something about it in week four.
 *  · A ledger hidden from the group is **surveillance**, students will
 *    correctly resent it, and the first thing they will do is stop using the
 *    workspace — which destroys the data the ledger was made of.
 *
 * The one thing that is *not* symmetric is peer review (ADR-008): a member sees
 * the aggregate about themselves and never who said what. That asymmetry is
 * enforced in `getReviews()`, at the query, not by this page choosing what to
 * render.
 *
 * The **health signals** follow the same argument one step further (ADR-045).
 * They are shown here, to the group, and they are the same signals the faculty
 * dashboard shows — computed by the same function, with only the framing
 * changed. Showing the ledger while hiding the summary derived from it was
 * never coherent: the events are right there, so the group can work the
 * signals out by hand. All the secrecy buys is that they learn it at the
 * review rather than in week four, when it was still fixable.
 */
export default async function LedgerPage({ params }: PageProps<"/groups/[id]/ledger">) {
  const { id } = await params;
  const viewer = await requireAuth(`/groups/${id}/ledger`);
  const workspace = await requireWorkspace(viewer, id);

  if (!workspace) notFound();

  const resource = groupResource(workspace);
  if (!can(viewer, "ledger:read", resource)) notFound();

  const faculty = teachesSubject(viewer, resource.subjectId);

  const [events, milestones, reviews] = await Promise.all([
    listLedgerEvents(workspace),
    listMilestones(workspace),
    getReviews(workspace, { userId: viewer.userId, teachesSubject: faculty }),
  ]);

  const members = workspace.members.map((member) => ({
    id: member.user.id,
    name: member.user.name,
    username: member.user.username,
    avatarUrl: member.user.avatarUrl,
  }));

  const scores = scoreMembers(members, events);
  const timeline = contributionTimeline(members, events);
  const summary = balanceSummary(scores);

  const openMilestone = milestones.find((milestone) => milestone.state !== "COMPLETE") ?? null;
  const owed = await outstandingReviews(workspace, viewer.userId, openMilestone?.id ?? null);

  const lastActivityAt =
    events.length === 0
      ? null
      : events.reduce(
          (latest, event) => (event.createdAt > latest ? event.createdAt : latest),
          events[0]!.createdAt,
        );

  const { signals } = await groupSignals({
    groupId: workspace.id,
    collegeId: workspace.collegeId,
    projectId: workspace.projects[0]?.id ?? null,
    active: !["COMPLETED", "ARCHIVED"].includes(workspace.projects[0]?.status ?? ""),
    scores,
    totalEvents: events.length,
    lastActivityAt,
  });

  return (
    <div className="grid gap-6">
      <Alert tone="info" title="Everyone in this group sees this page">
        The ledger counts recorded activity — tasks closed, files added, discussions started,
        meetings attended. It is not a mark and it is not a judgement of quality. Every number below
        links to the events behind it, so it can be checked rather than argued about.
      </Alert>

      {signals.length > 0 ? (
        <section className="grid gap-3 rounded-xl border border-border p-5">
          <div className="grid gap-1">
            <h2 className="font-medium">{AUDIENCE_FRAMING.group.heading}</h2>
            <p className="text-xs text-fg-muted">{AUDIENCE_FRAMING.group.note}</p>
          </div>
          <HealthSignals signals={signals} groupId={workspace.id} />
        </section>
      ) : null}

      <LedgerView
        groupId={workspace.id}
        scores={scores}
        timeline={timeline}
        summary={summary}
        faculty={faculty}
        reviews={reviews}
        owed={owed}
        milestone={
          openMilestone
            ? {
                id: openMilestone.id,
                title: openMilestone.title,
                dueDate: openMilestone.dueDate,
                state: openMilestone.state,
              }
            : null
        }
      />
    </div>
  );
}
