"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Avatar, Badge } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import type { ReviewAggregate, ReviewDetail } from "@/lib/db/queries/workspace";
import { closeMilestone, submitPeerReview } from "@/lib/workspace/review";

import { ActionForm } from "./action-form";

/**
 * PEER REVIEW (ADR-008).
 *
 * Three audiences, three different screens, and the reason they differ is the
 * only thing that makes honest review possible:
 *
 *  · **Faculty** see every review with its author. They are who acts on it.
 *  · **A member** sees the aggregate about themselves — averages and comments
 *    with the authorship removed — plus the reviews they wrote, which are
 *    theirs. They never see who said what about them, and they never see
 *    anything about a teammate.
 *  · The distinction is enforced in `getReviews()`, at the query. This
 *    component renders what it is handed; it has no branch that could leak
 *    something the query withheld, because the query never read it.
 *
 * Note what this component is NOT given: the viewer's id. It does not need one,
 * because it never filters anything — `getReviews()` already returned exactly
 * what this person is entitled to. A component that had to decide "is this row
 * mine" would be a second place the privacy rule lives, and the second copy is
 * always the one that drifts.
 *
 * The aggregate is withheld below two reviews, and that is deliberate: with one
 * review, "the average about you" and "what that one person said" are the same
 * sentence, and the anonymity would be decorative.
 */

type Member = { id: string; name: string; username: string | null; avatarUrl: string | null };

export function PeerReviewPanel({
  groupId,
  faculty,
  reviews,
  owed,
  milestone,
  members,
}: {
  groupId: string;
  faculty: boolean;
  reviews: { aggregate: ReviewAggregate | null; mine: ReviewDetail[]; detail: ReviewDetail[] };
  owed: Member[];
  milestone: { id: string; title: string; dueDate: Date | null; state: string } | null;
  members: Member[];
}) {
  const [reviewing, setReviewing] = useState<Member | null>(null);
  const [skipping, setSkipping] = useState(false);
  const names = new Map(members.map((member) => [member.id, member.name]));

  if (faculty) {
    return <FacultyView reviews={reviews.detail} names={names} />;
  }

  return (
    <div className="grid gap-6">
      <Alert tone="info" title="Reviews you write are never shown with your name">
        Your teammates see the average of what everyone said about them, and the comments with the
        authorship removed. Faculty see the detail. That asymmetry is the whole reason it is worth
        answering honestly.
      </Alert>

      {/* ------------------------------------------------------ owed */}

      {owed.length > 0 ? (
        <section className="grid gap-4 rounded-xl border border-border p-5">
          <div className="grid gap-1">
            <h2 className="font-medium">
              {milestone ? `Review before closing "${milestone.title}"` : "Review your teammates"}
            </h2>
            <p className="text-sm text-fg-muted">
              {owed.length} {owed.length === 1 ? "person" : "people"} left. A comment is required —
              three sliders and no words take eight seconds and say nothing.
            </p>
          </div>

          <ul className="grid gap-2">
            {owed.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
              >
                <span className="flex items-center gap-2.5 text-sm">
                  <Avatar name={member.name} src={member.avatarUrl} seed={member.id} size="sm" />
                  {member.name}
                </span>
                <Button size="sm" variant="secondary" onClick={() => setReviewing(member)}>
                  Review
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : milestone ? (
        <Alert tone="success" title="You have reviewed everyone">
          Nothing outstanding for &ldquo;{milestone.title}&rdquo;.
        </Alert>
      ) : null}

      {reviewing ? (
        <section className="grid gap-4 rounded-xl border border-border p-5">
          <h2 className="font-medium">Reviewing {reviewing.name}</h2>

          <ActionForm
            action={submitPeerReview}
            hidden={{
              groupId,
              subjectId: reviewing.id,
              milestoneId: milestone?.id,
            }}
            submitLabel="Submit review"
            quiet
            onDone={() => setReviewing(null)}
          >
            <Rating
              name="contribution"
              label="Contribution"
              hint="How much of the work they carried."
            />
            <Rating
              name="reliability"
              label="Reliability"
              hint="Did what they said, when they said."
            />
            <Rating
              name="communication"
              label="Communication"
              hint="Kept the group informed and was easy to work with."
            />

            <Field
              label="Comment"
              required
              hint="At least a sentence. Your teammate sees this without your name; faculty see it with."
            >
              <Textarea name="comment" rows={3} required minLength={15} maxLength={2000} />
            </Field>
          </ActionForm>

          <div>
            <Button variant="ghost" size="sm" onClick={() => setReviewing(null)}>
              Cancel
            </Button>
          </div>
        </section>
      ) : null}

      {/* --------------------------------------------------- about me */}

      <section className="grid gap-4">
        <h2 className="font-medium">What your teammates said about you</h2>

        {reviews.aggregate ? (
          <div className="grid gap-4 rounded-xl border border-border p-5">
            <dl className="grid grid-cols-3 gap-4">
              {(
                [
                  ["Contribution", reviews.aggregate.contribution],
                  ["Reliability", reviews.aggregate.reliability],
                  ["Communication", reviews.aggregate.communication],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="grid gap-1">
                  <dt className="text-xs text-fg-muted">{label}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{value.toFixed(1)}</dd>
                </div>
              ))}
            </dl>

            <p className="text-xs text-fg-subtle">
              Averaged across {reviews.aggregate.count} reviews, out of 5.
            </p>

            {reviews.aggregate.comments.length > 0 ? (
              <ul className="grid gap-2 border-t border-border pt-4">
                {reviews.aggregate.comments.map((comment, index) => (
                  <li key={index} className="text-sm text-fg-muted">
                    &ldquo;{comment}&rdquo;
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-fg-muted">
            Nothing to show yet. Your results appear once at least two teammates have reviewed you —
            with one, the average and the person would be the same thing.
          </p>
        )}
      </section>

      {/* ------------------------------------------------ mine */}

      {reviews.mine.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="font-medium">Reviews you have written</h2>
          <ul className="grid gap-3">
            {reviews.mine.map((review) => (
              <li key={review.id} className="grid gap-1.5 rounded-lg border border-border p-4">
                <p className="text-sm font-medium">{names.get(review.subjectId) ?? "A teammate"}</p>
                <p className="flex gap-3 text-xs text-fg-muted">
                  <span>Contribution {review.contribution}</span>
                  <span>Reliability {review.reliability}</span>
                  <span>Communication {review.communication}</span>
                </p>
                <p className="text-sm text-fg-muted">{review.comment}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ----------------------------------------- close milestone */}

      {milestone ? (
        <section className="grid gap-3 rounded-xl border border-border p-5">
          <h2 className="font-medium">Close &ldquo;{milestone.title}&rdquo;</h2>

          {owed.length === 0 ? (
            <ActionForm
              action={closeMilestone}
              hidden={{ groupId, milestoneId: milestone.id }}
              submitLabel="Close milestone"
            />
          ) : skipping ? (
            <ActionForm
              action={closeMilestone}
              hidden={{ groupId, milestoneId: milestone.id }}
              submitLabel="Close without review"
              submitVariant="secondary"
            >
              <Field
                label="Why is review being skipped?"
                required
                hint="Recorded on the milestone. This is what keeps the escape hatch honest."
              >
                <Input
                  name="skipReason"
                  required
                  maxLength={500}
                  placeholder="One member has withdrawn from the course."
                />
              </Field>
            </ActionForm>
          ) : (
            <>
              <p className="text-sm text-fg-muted">
                Review your remaining {owed.length} {owed.length === 1 ? "teammate" : "teammates"}{" "}
                first. The group lead can skip it with a recorded reason — for a member who has left
                the course, say.
              </p>
              <div>
                <Button variant="ghost" size="sm" onClick={() => setSkipping(true)}>
                  Skip review (lead only)
                </Button>
              </div>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- ratings */

/**
 * A 1–5 rating as radio buttons rather than a slider.
 *
 * A slider makes people drag towards the middle and the values cluster at 3. It
 * also has no obvious keyboard story for "pick 4". Five labelled radios are
 * unambiguous, faster, and readable to a screen reader without any ARIA at all.
 */
function Rating({ name, label, hint }: { name: string; label: string; hint: string }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm leading-none font-medium">{label}</legend>
      <p className="text-xs text-fg-muted">{hint}</p>

      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((value) => (
          <label
            key={value}
            className="has-[:checked]:border-primary flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-950"
          >
            <input
              type="radio"
              name={name}
              value={value}
              required
              defaultChecked={value === 4}
              className="sr-only"
            />
            {value}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/* ---------------------------------------------------------------- faculty */

function FacultyView({ reviews, names }: { reviews: ReviewDetail[]; names: Map<string, string> }) {
  if (reviews.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-fg-muted">
        No peer reviews have been submitted in this group yet.
      </p>
    );
  }

  const bySubject = new Map<string, ReviewDetail[]>();
  for (const review of reviews) {
    bySubject.set(review.subjectId, [...(bySubject.get(review.subjectId) ?? []), review]);
  }

  return (
    <div className="grid gap-5">
      <Alert tone="warning" title="You are seeing the detail, including who wrote what">
        Members see only the aggregate about themselves. Repeating an attributed comment back to a
        group is the fastest way to make every future round of reviews useless.
      </Alert>

      {[...bySubject.entries()].map(([subjectId, given]) => (
        <section key={subjectId} className="grid gap-3 rounded-xl border border-border p-5">
          <h3 className="flex items-center gap-2 font-medium">
            {names.get(subjectId) ?? "A member"}
            <Badge tone="neutral">{given.length} reviews</Badge>
          </h3>

          <ul className="grid gap-3">
            {given.map((review) => (
              <li key={review.id} className="grid gap-1 border-l-2 border-border pl-3">
                <p className="text-xs text-fg-muted">
                  <span className="font-medium text-fg">{review.authorName}</span> · contribution{" "}
                  {review.contribution} · reliability {review.reliability} · communication{" "}
                  {review.communication}
                </p>
                <p className="text-sm">{review.comment}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
