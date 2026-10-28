import Link from "next/link";

import { Avatar, Badge } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { RichText } from "@/components/content/rich-text";
import { SCORE_MAX } from "@/lib/evaluation/rubric";
import { totalFor, deviation } from "@/lib/evaluation/score";

/**
 * A released evaluation, as the group reads it.
 *
 * The order is the argument: the **outcome** first, because that is what
 * somebody opening this page needs in two seconds; then the **comments**,
 * because those are what they can act on; then the numbers. A page that leads
 * with a percentage teaches people to read the percentage and stop.
 *
 * Per-member marks show the reason beside them — every member's, not only the
 * reader's. The review screen tells the marker "the group sees this" while they
 * write it, and this is where that is kept. A differentiated mark that only its
 * subject can see is unarguable in precisely the wrong way.
 *
 * A server component: nothing here is interactive, and making it a client
 * component would ship the whole evaluation to the browser bundle for no reason.
 */

type Round = {
  id: string;
  round: number;
  groupScore: number | null;
  outcome: string | null;
  comments: string | null;
  releasedAt: Date;
  evaluatorName: string;
  evaluatorTitle: string | null;
  rubricName: string;
  criteria: { id: string; name: string; weight: number; groupScore: unknown }[];
  members: {
    id: string;
    name: string;
    avatarUrl: string | null;
    scores: { criterionId: string; score: unknown }[];
    reason: string | null;
  }[];
};

type Note = {
  id: string;
  body: string;
  authorName: string;
  createdAt: Date;
  resolvedAt: Date | null;
  sectionLabel: string;
};

const OUTCOME_LABEL: Record<string, { label: string; tone: "success" | "warning" | "danger" }> = {
  ACCEPT: { label: "Accepted", tone: "success" },
  CHANGES: { label: "Changes requested", tone: "warning" },
  REJECT: { label: "Not accepted", tone: "danger" },
};

const num = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

export function FeedbackRounds({
  rounds,
  notes,
  viewerId,
}: {
  rounds: Round[];
  notes: Note[];
  viewerId: string | null;
}) {
  if (rounds.length === 0 && notes.length === 0) {
    return (
      <EmptyState
        title="No feedback yet"
        description="Marks and comments appear here the moment your faculty guide releases them — not while they are still marking. Section notes show up as they are written."
        action={
          <Button asChild variant="secondary">
            <Link href="../edit">Back to the record</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-8">
      {rounds.map((round) => {
        const outcome = round.outcome ? OUTCOME_LABEL[round.outcome] : null;
        const criteria = round.criteria.map((criterion) => ({
          id: criterion.id,
          name: criterion.name,
          weight: criterion.weight,
        }));

        const groupScores = round.criteria
          .filter((criterion) => num(criterion.groupScore) !== null)
          .map((criterion) => ({
            criterionId: criterion.id,
            memberId: null,
            score: num(criterion.groupScore)!,
          }));

        const groupTotal = totalFor(criteria, groupScores, null);

        return (
          <article key={round.id} className="grid gap-5 rounded-xl border border-border p-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div className="grid gap-1">
                <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
                  Round {round.round}
                  {outcome ? <Badge tone={outcome.tone}>{outcome.label}</Badge> : null}
                </h2>
                <p className="text-xs text-fg-muted">
                  {round.evaluatorTitle
                    ? `${round.evaluatorName}, ${round.evaluatorTitle}`
                    : round.evaluatorName}{" "}
                  ·{" "}
                  <time dateTime={round.releasedAt.toISOString()}>
                    {round.releasedAt.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </time>{" "}
                  · {round.rubricName}
                </p>
              </div>

              <p className="text-3xl font-semibold tabular-nums">
                {groupTotal.percent}
                <span className="text-base font-normal text-fg-muted">%</span>
              </p>
            </header>

            {round.comments ? (
              <section className="grid gap-2">
                <h3 className="text-sm font-medium">Comments</h3>
                <RichText body={round.comments} className="text-sm" />
              </section>
            ) : null}

            {/* --------------------------------------------- the rubric */}

            <section className="grid gap-2">
              <h3 className="text-sm font-medium">How it was marked</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-md text-sm">
                  <caption className="sr-only">
                    Criteria, their weights and the group score out of {SCORE_MAX}
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-fg-muted">
                      <th scope="col" className="py-1.5 font-medium">
                        Criterion
                      </th>
                      <th scope="col" className="py-1.5 text-right font-medium">
                        Weight
                      </th>
                      <th scope="col" className="py-1.5 text-right font-medium">
                        Score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {round.criteria.map((criterion) => (
                      <tr key={criterion.id} className="border-b border-border last:border-0">
                        <td className="py-1.5">{criterion.name}</td>
                        <td className="py-1.5 text-right text-fg-muted tabular-nums">
                          {criterion.weight}%
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {num(criterion.groupScore) === null
                            ? "—"
                            : `${num(criterion.groupScore)} / ${SCORE_MAX}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ------------------------------------------ per-member */}

            {round.members.length > 0 ? (
              <section className="grid gap-3">
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium">Per-member marks</h3>
                  <p className="text-xs text-fg-muted">
                    Everyone starts at the group mark. Where one differs, the reason is here — the
                    whole group can see it, which is what makes it something you can argue with.
                  </p>
                </div>

                <ul className="grid gap-3">
                  {round.members.map((member) => {
                    const scores = member.scores
                      .filter((score) => num(score.score) !== null)
                      .map((score) => ({
                        criterionId: score.criterionId,
                        memberId: member.id,
                        score: num(score.score)!,
                      }));

                    const total = totalFor(criteria, scores, member.id);
                    const delta = deviation(groupTotal.percent, total.percent);

                    return (
                      <li
                        key={member.id}
                        className="grid gap-1.5 border-t border-border pt-3 first:border-0 first:pt-0"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Avatar
                            name={member.name}
                            src={member.avatarUrl}
                            seed={member.id}
                            size="xs"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {member.name}
                            {member.id === viewerId ? (
                              <span className="ml-1.5 text-xs font-normal text-fg-subtle">you</span>
                            ) : null}
                          </span>
                          <span className="text-sm tabular-nums">
                            {total.percent}%
                            {delta !== 0 ? (
                              <span
                                className={delta > 0 ? "ml-1 text-success" : "ml-1 text-warning"}
                              >
                                {delta > 0 ? "+" : ""}
                                {delta}
                              </span>
                            ) : null}
                          </span>
                        </div>

                        {member.reason ? (
                          <p className="text-xs text-fg-muted italic">
                            &ldquo;{member.reason}&rdquo;
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </article>
        );
      })}

      {/* ------------------------------------------------ section notes */}

      {notes.length > 0 ? (
        <section className="grid gap-3">
          <div className="grid gap-1">
            <h2 className="font-medium">Notes on sections</h2>
            <p className="text-xs text-fg-muted">
              Written against a specific section as your guide reads it, and not held back until a
              round is released — a note you can act on this week is worth more than one you get in
              three.
            </p>
          </div>

          <ul className="grid gap-2">
            {notes.map((note) => (
              <li key={note.id} className="grid gap-1 rounded-lg border border-border p-4">
                <p className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                  <span className="font-medium text-fg">{note.sectionLabel}</span>
                  {note.resolvedAt ? <Badge tone="success">resolved</Badge> : null}
                  <span>
                    {note.authorName} ·{" "}
                    <time dateTime={note.createdAt.toISOString()}>
                      {note.createdAt.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </time>
                  </span>
                </p>
                <p className="text-sm">{note.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
