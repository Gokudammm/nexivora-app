"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { RichText } from "@/components/content/rich-text";
import { Button } from "@/components/ui/button";
import { Avatar, Badge } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Select, Textarea } from "@/components/ui/input";
import { OUTCOMES, deviates, deviation, totalFor, type Score } from "@/lib/evaluation/score";
import { SCORE_MAX } from "@/lib/evaluation/rubric";
import { addSectionFeedback, saveEvaluation } from "@/lib/evaluation/actions";
import { cn } from "@/lib/utils/cn";

/**
 * THE REVIEW SCREEN.
 *
 * Record on the left, rubric on the right, ledger under the per-member marks.
 * Acceptance criterion 3 gives it a budget — *a full evaluation in under ten
 * minutes* — and every decision here is spent on that.
 *
 * **Members start identical to the group.** Adjusting is one click per
 * criterion; leaving them the same costs nothing. The opposite default — five
 * blank score sets — makes differentiating expensive and uniform marks free,
 * which produces exactly the undifferentiated marking the ledger exists to fix.
 *
 * **The ledger is beside the input, not a click away.** A share of 6% next to a
 * score box is a two-second decision; the same number on another page is a
 * decision nobody makes.
 *
 * **A deviation demands a reason, in both directions.** Raising somebody needs
 * the same evidence as lowering them, or the form quietly encourages inflating
 * everybody else.
 *
 * It is a laptop screen and does not pretend otherwise — the spec says so, and
 * making a dense two-pane marking tool work on a phone would produce a worse
 * desktop experience for a use case that does not exist.
 */

type Member = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  share: number;
  points: number;
  eventCount: number;
  lastActiveAt: Date | null;
};

type Rubric = {
  id: string;
  name: string;
  version: number;
  criteria: { id: string; name: string; weight: number; descriptors: string[] }[];
};

type Section = {
  id: string;
  kind: string;
  label: string;
  body: string;
  complete: boolean;
  required: boolean;
};

type Note = {
  id: string;
  sectionId: string | null;
  body: string;
  authorName: string;
  resolvedAt: Date | null;
  createdAt: Date;
};

export function ReviewScreen({
  slug,
  title,
  status,
  round,
  submittedAt,
  fromSnapshot,
  sections,
  members,
  rubrics,
  evaluation,
  feedback,
  groupId,
}: {
  slug: string;
  title: string;
  status: string;
  round: number;
  submittedAt: Date | null;
  fromSnapshot: boolean;
  sections: Section[];
  members: Member[];
  rubrics: Rubric[];
  evaluation: {
    rubricId: string;
    outcome: string | null;
    comments: string | null;
    releasedAt: Date | null;
    scores: Score[];
    reasons: Record<string, string>;
  } | null;
  feedback: Note[];
  groupId: string | null;
}) {
  const [rubricId, setRubricId] = useState(evaluation?.rubricId ?? rubrics[0]?.id ?? "");
  const [scores, setScores] = useState<Score[]>(evaluation?.scores ?? []);
  const [reasons, setReasons] = useState<Record<string, string>>(evaluation?.reasons ?? {});
  const [outcome, setOutcome] = useState(evaluation?.outcome ?? "");
  const [comments, setComments] = useState(evaluation?.comments ?? "");
  const [problems, setProblems] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rubric = rubrics.find((entry) => entry.id === rubricId) ?? null;
  // Memoised rather than defaulted inline: `?? []` is a fresh array on every
  // render, which would make every downstream memo recompute for nothing.
  const criteria = useMemo(() => rubric?.criteria ?? [], [rubric]);
  const released = evaluation?.releasedAt !== null && evaluation?.releasedAt !== undefined;

  const groupTotal = useMemo(() => totalFor(criteria, scores, null), [criteria, scores]);

  const setScore = (criterionId: string, memberId: string | null, value: number) => {
    setScores((current) => {
      const others = current.filter(
        (score) => !(score.criterionId === criterionId && score.memberId === memberId),
      );
      const next = [...others, { criterionId, memberId, score: value }];

      // Changing the group's score carries every member who has not been
      // adjusted away from it — the "identical unless you say otherwise"
      // default, maintained live rather than only at first render.
      if (memberId === null) {
        const previous = current.find(
          (score) => score.criterionId === criterionId && score.memberId === null,
        );

        for (const member of members) {
          const own = current.find(
            (score) => score.criterionId === criterionId && score.memberId === member.id,
          );
          const untouched = !own || (previous && own.score === previous.score);
          if (untouched) {
            const index = next.findIndex(
              (score) => score.criterionId === criterionId && score.memberId === member.id,
            );
            if (index >= 0) next[index] = { criterionId, memberId: member.id, score: value };
            else next.push({ criterionId, memberId: member.id, score: value });
          }
        }
      }

      return next;
    });
  };

  const submit = (release: boolean) => {
    setProblems([]);
    setError(null);
    setMessage(null);

    const data = new FormData();
    data.set("slug", slug);
    data.set("rubricId", rubricId);
    data.set("scores", JSON.stringify(scores));
    data.set("reasons", JSON.stringify(reasons));
    data.set("comments", comments);
    if (outcome) data.set("outcome", outcome);
    if (release) data.set("release", "true");

    startTransition(async () => {
      const result = await saveEvaluation(null, data);

      if (result.ok) setMessage(result.message);
      else {
        setError(result.error);
        setProblems(result.problems ?? []);
      }
    });
  };

  if (rubrics.length === 0) {
    return (
      <Alert tone="warning" title="No rubric yet">
        Evaluation needs a rubric — named criteria with weights summing to 100.{" "}
        <Link href="/faculty/rubrics" className="font-medium underline underline-offset-4">
          Create one
        </Link>
        , or start from a template.
      </Alert>
    );
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
            {title}
            <Badge tone={released ? "success" : "neutral"}>
              {released ? "released" : `round ${round} draft`}
            </Badge>
          </h2>
          <p className="text-xs text-fg-muted">
            {submittedAt
              ? `Submitted ${submittedAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
              : `Not yet submitted — currently ${status.toLowerCase().replace("_", " ")}`}
            {fromSnapshot ? " · marking the submitted snapshot" : " · marking the live record"}
          </p>
        </div>

        <div className="flex gap-2">
          {groupId ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/groups/${groupId}/ledger`}>Full ledger</Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="sm">
            <Link href={`/projects/${slug}`}>View page</Link>
          </Button>
        </div>
      </header>

      {released ? (
        <Alert tone="info" title="This round is released">
          The group can see these marks and comments. A revised mark belongs to the next round,
          after they resubmit — rewriting a released mark silently is not something this product
          does.
        </Alert>
      ) : null}

      {!fromSnapshot && submittedAt === null ? (
        <Alert tone="warning" title="Nothing has been submitted yet">
          You are looking at the live record, which the group can still change. Marks saved now are
          a draft.
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_26rem]">
        {/* --------------------------------------------- the record */}

        <div className="grid content-start gap-5">
          <h3 className="font-medium">The record</h3>

          {sections.map((section) => {
            const notes = feedback.filter((note) => note.sectionId === section.id);

            return (
              <section
                key={section.kind}
                className="grid gap-2 rounded-xl border border-border p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="flex items-center gap-2 font-medium">
                    {section.label}
                    {section.complete ? null : <Badge tone="warning">incomplete</Badge>}
                  </h4>
                </div>

                {section.body.trim().length > 0 ? (
                  <RichText body={section.body} className="text-sm" />
                ) : (
                  <p className="text-sm text-fg-subtle">Nothing written.</p>
                )}

                {notes.length > 0 ? (
                  <ul className="grid gap-1.5 border-t border-border pt-3">
                    {notes.map((note) => (
                      <li key={note.id} className="text-xs text-fg-muted">
                        <span className="font-medium text-fg">{note.authorName}:</span> {note.body}
                        {note.resolvedAt ? " · resolved" : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {released ? null : (
                  <SectionNote slug={slug} sectionId={section.id} label={section.label} />
                )}
              </section>
            );
          })}
        </div>

        {/* --------------------------------------------- the rubric */}

        <aside className="grid content-start gap-5">
          <div className="grid gap-2">
            <Field label="Rubric" hint="Marks are stored against the version you choose.">
              <Select
                value={rubricId}
                onChange={(event) => setRubricId(event.target.value)}
                disabled={released}
              >
                {rubrics.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} · v{entry.version}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <section className="grid gap-4 rounded-xl border border-border p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-medium">Group score</h3>
              <p className="text-2xl font-semibold tabular-nums">
                {groupTotal.percent}
                <span className="text-sm font-normal text-fg-muted">%</span>
              </p>
            </div>

            {criteria.map((criterion) => {
              const current = scores.find(
                (score) => score.criterionId === criterion.id && score.memberId === null,
              );

              return (
                <div key={criterion.id} className="grid gap-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <label className="text-sm font-medium">{criterion.name}</label>
                    <span className="text-xs text-fg-subtle">{criterion.weight}%</span>
                  </div>

                  <div className="flex gap-1.5">
                    {Array.from({ length: SCORE_MAX }, (_, index) => index + 1).map((value) => (
                      <button
                        key={value}
                        type="button"
                        disabled={released}
                        aria-pressed={current?.score === value}
                        // Explicit hooks rather than nth-child selectors. Phase 7
                        // lost an afternoon to a check that matched the header's
                        // theme toggle instead of a task card.
                        data-group-score={criterion.id}
                        data-value={value}
                        title={criterion.descriptors[value - 1] ?? `${value} of ${SCORE_MAX}`}
                        onClick={() => setScore(criterion.id, null, value)}
                        className={cn(
                          "focus-visible:outline-primary h-9 flex-1 rounded-lg border text-sm font-medium focus-visible:outline-2",
                          current?.score === value
                            ? "border-primary bg-primary-50 dark:bg-primary-950"
                            : "border-border text-fg-muted hover:text-fg",
                        )}
                      >
                        {value}
                      </button>
                    ))}
                  </div>

                  {current ? (
                    <p className="text-xs text-fg-muted">
                      {criterion.descriptors[current.score - 1] ?? ""}
                    </p>
                  ) : null}
                </div>
              );
            })}

            <p className="text-xs text-fg-subtle">
              {groupTotal.scored} of {groupTotal.of} criteria scored. The total is weighted by what
              you have marked so far, not by the whole rubric.
            </p>
          </section>

          {/* ------------------------- per-member, with the ledger */}

          <section className="grid gap-4 rounded-xl border border-border p-5">
            <div className="grid gap-1">
              <h3 className="font-medium">Per-member marks</h3>
              <p className="text-xs text-fg-muted">
                Everybody starts at the group score. The contribution share beside each name is the
                evidence for changing one.
              </p>
            </div>

            {members.map((member) => {
              const total = totalFor(criteria, scores, member.id);
              const delta = deviation(groupTotal.percent, total.percent);
              const needsReason = deviates(groupTotal.percent, total.percent);

              return (
                <div
                  key={member.id}
                  className="grid gap-2 border-t border-border pt-4 first:border-0 first:pt-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Avatar name={member.name} src={member.avatarUrl} seed={member.id} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {member.name}
                    </span>
                    <span className="text-sm tabular-nums">
                      {total.percent}%
                      {needsReason ? (
                        <span className={delta > 0 ? "ml-1 text-success" : "ml-1 text-warning"}>
                          {delta > 0 ? "+" : ""}
                          {delta}
                        </span>
                      ) : null}
                    </span>
                  </div>

                  {/* The evidence, physically beside the input. */}
                  <p className="text-xs text-fg-muted">
                    {Math.round(member.share * 100)}% of recorded activity · {member.eventCount}{" "}
                    events
                    {member.lastActiveAt
                      ? ` · last ${member.lastActiveAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                      : " · nothing recorded"}
                  </p>

                  <div className="grid gap-1">
                    {criteria.map((criterion) => {
                      const own = scores.find(
                        (score) =>
                          score.criterionId === criterion.id && score.memberId === member.id,
                      );

                      return (
                        <div key={criterion.id} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">
                            {criterion.name}
                          </span>
                          <div className="flex gap-1">
                            {Array.from({ length: SCORE_MAX }, (_, i) => i + 1).map((value) => (
                              <button
                                key={value}
                                type="button"
                                disabled={released}
                                aria-label={`${member.name}, ${criterion.name}, ${value}`}
                                aria-pressed={own?.score === value}
                                data-member-score={member.id}
                                data-criterion={criterion.id}
                                data-value={value}
                                onClick={() => setScore(criterion.id, member.id, value)}
                                className={cn(
                                  "focus-visible:outline-primary size-7 rounded border text-xs focus-visible:outline-2",
                                  own?.score === value
                                    ? "border-primary bg-primary-50 dark:bg-primary-950"
                                    : "border-border text-fg-subtle hover:text-fg",
                                )}
                              >
                                {value}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {needsReason && !released ? (
                    <Field
                      label={`Why is ${member.name.split(" ")[0]}'s mark different?`}
                      required
                      hint="The group sees this. Point at the evidence."
                    >
                      <Textarea
                        rows={2}
                        maxLength={1000}
                        value={reasons[member.id] ?? ""}
                        onChange={(event) =>
                          setReasons((current) => ({ ...current, [member.id]: event.target.value }))
                        }
                      />
                    </Field>
                  ) : needsReason && reasons[member.id] ? (
                    <p className="text-xs text-fg-muted italic">
                      &ldquo;{reasons[member.id]}&rdquo;
                    </p>
                  ) : null}
                </div>
              );
            })}
          </section>

          {/* ------------------------------------------- outcome */}

          <section className="grid gap-3 rounded-xl border border-border p-5">
            <h3 className="font-medium">Outcome</h3>

            <div className="grid gap-2">
              {OUTCOMES.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "grid cursor-pointer gap-0.5 rounded-lg border p-3",
                    outcome === option.value
                      ? "border-primary bg-primary-50 dark:bg-primary-950"
                      : "border-border",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="radio"
                      name="outcome"
                      value={option.value}
                      checked={outcome === option.value}
                      disabled={released}
                      onChange={() => setOutcome(option.value)}
                      className="size-4"
                    />
                    {option.label}
                  </span>
                  <span className="pl-6 text-xs text-fg-muted">{option.description}</span>
                </label>
              ))}
            </div>

            <Field
              label="Overall comments"
              hint="Requesting changes needs specifics — it is the only part the group can act on."
            >
              <Textarea
                rows={4}
                maxLength={8000}
                value={comments}
                disabled={released}
                onChange={(event) => setComments(event.target.value)}
              />
            </Field>

            {error ? <Alert tone="danger">{error}</Alert> : null}

            {problems.length > 0 ? (
              <Alert tone="warning" title="Not ready to release">
                <ul className="mt-1 grid gap-1">
                  {problems.map((problem) => (
                    <li key={problem} className="text-sm">
                      {problem}
                    </li>
                  ))}
                </ul>
              </Alert>
            ) : null}

            {message ? <Alert tone="success">{message}</Alert> : null}

            {released ? null : (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  data-save-draft
                  onClick={() => submit(false)}
                  disabled={pending}
                >
                  Save draft
                </Button>
                <Button
                  data-release
                  onClick={() => submit(true)}
                  loading={pending}
                  disabled={pending}
                >
                  Release to the group
                </Button>
              </div>
            )}

            {released ? null : (
              <p className="text-xs text-fg-subtle">
                A draft is invisible to students. Releasing shows them the marks, the per-member
                reasons and your comments at once.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- section feedback */

function SectionNote({
  slug,
  sectionId,
  label,
}: {
  slug: string;
  sectionId: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (done) return <p className="text-xs text-success">Feedback added.</p>;

  if (!open) {
    return (
      <div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
          Comment on {label.toLowerCase()}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2 border-t border-border pt-3">
      <Field label={`Feedback on ${label.toLowerCase()}`} labelHidden>
        <Textarea
          rows={2}
          value={body}
          maxLength={4000}
          placeholder="What specifically needs changing here?"
          onChange={(event) => setBody(event.target.value)}
          autoFocus
        />
      </Field>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          loading={pending}
          disabled={pending || body.trim().length < 5}
          onClick={() => {
            const data = new FormData();
            data.set("slug", slug);
            data.set("sectionId", sectionId);
            data.set("body", body);

            startTransition(async () => {
              const result = await addSectionFeedback(null, data);
              if (result.ok) {
                setDone(true);
                setOpen(false);
              }
            });
          }}
        >
          Add
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
