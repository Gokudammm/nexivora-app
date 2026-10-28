"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import type { Status } from "@/lib/project/lifecycle";
import {
  overrideSimilarity,
  runSimilarityCheck,
  type SimilarityMatch,
} from "@/lib/project/transitions";
import { cn } from "@/lib/utils/cn";

/**
 * The similarity check, and what to do about it.
 *
 * Every word here is chosen to keep a high score from reading as an accusation.
 * The heading is "Similar work in the archive", not "Possible duplicate"; the
 * copy says outright that overlap is often correct; and each match is shown
 * with **the reason for its score** — "87% similar problem statement; shares 4
 * of 5 tech stack items" — because a bare number invites a fight and a reason
 * invites a look.
 *
 * The faculty override is the release valve and it requires a justification.
 * A legitimate continuation of previous work *should* score high, and a system
 * that blocked it would teach groups to disguise their lineage — the exact
 * opposite of what the archive is for.
 */

type Check = {
  id: string;
  topScore: number;
  matches: SimilarityMatch[];
  overrideReason: string | null;
  overriddenBy: string | null;
  createdAt: Date;
};

const VERDICT_TONE = {
  duplicate: "warning",
  related: "info",
  distinct: "neutral",
} as const;

export function ProposalPanel({
  slug,
  status,
  canEdit,
  canFaculty,
  hasProblem,
  check,
}: {
  slug: string;
  status: Status;
  canEdit: boolean;
  canFaculty: boolean;
  hasProblem: boolean;
  check: Check | null;
}) {
  const [runState, runAction] = useActionState(runSimilarityCheck, null);
  const [overrideState, overrideAction] = useActionState(overrideSimilarity, null);

  return (
    <section className="grid gap-4 rounded-xl border border-border p-5">
      <div className="grid gap-1">
        <h2 className="font-medium">Similar work in the archive</h2>
        <p className="text-xs text-fg-muted">
          Checked against your college&rsquo;s archive and public projects, on the problem statement
          rather than the title — two teams solving different problems routinely pick the same name.
        </p>
      </div>

      {check ? (
        <>
          <p className="text-sm text-fg-muted">
            Last checked{" "}
            <time dateTime={check.createdAt.toISOString()}>
              {check.createdAt.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
            .
          </p>

          {check.matches.length === 0 ? (
            <Alert tone="success" title="Nothing close">
              No similar work found. That is a clean result, not a requirement — plenty of good
              projects overlap with something.
            </Alert>
          ) : (
            <ul className="grid gap-2">
              {check.matches.map((match) => (
                <li
                  key={match.slug}
                  className={cn(
                    "grid gap-1 rounded-lg border border-border p-3",
                    match.verdict === "duplicate" && "border-warning/40",
                  )}
                >
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <Link
                      href={`/projects/${match.slug}`}
                      className="font-medium underline underline-offset-4"
                    >
                      {match.title}
                    </Link>
                    <Badge tone={VERDICT_TONE[match.verdict]}>
                      {Math.round(match.score * 100)}% overlap
                    </Badge>
                  </p>
                  <p className="text-xs text-fg-muted">{match.reason}</p>
                </li>
              ))}
            </ul>
          )}

          {check.matches.some((match) => match.verdict === "duplicate") ? (
            <Alert tone="info" title="A high score is not a verdict">
              If you are deliberately continuing or replicating this work, say so in your problem
              statement and record it as lineage — that is the honest version and it earns credit
              rather than losing it. Your faculty guide decides, not the number.
            </Alert>
          ) : null}

          {check.overrideReason ? (
            <div className="border-accent/40 grid gap-1 rounded-lg border bg-accent-50/40 p-3 dark:bg-accent-950/30">
              <p className="text-sm font-medium">
                Cleared by {check.overriddenBy ?? "a faculty member"}
              </p>
              <p className="text-xs text-fg-muted">&ldquo;{check.overrideReason}&rdquo;</p>
            </div>
          ) : canFaculty && check.matches.length > 0 ? (
            <form action={overrideAction} className="grid gap-2 border-t border-border pt-4">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="checkId" value={check.id} />

              <Field
                label="Record that this overlap is acceptable"
                required
                hint="Becomes part of the project's permanent record, visible to the group."
              >
                <Textarea
                  name="reason"
                  rows={2}
                  required
                  minLength={15}
                  maxLength={1000}
                  placeholder="A deliberate replication of last year's study on a second soil type."
                />
              </Field>

              {overrideState && !overrideState.ok ? (
                <Alert tone="danger">{overrideState.error}</Alert>
              ) : null}

              <Submit label="Record and clear" variant="secondary" />
            </form>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-fg-muted">
          Not checked yet. It takes a moment, and it is what the approval conversation starts from.
        </p>
      )}

      {runState && !runState.ok ? <Alert tone="danger">{runState.error}</Alert> : null}
      {runState?.ok ? <Alert tone="info">{runState.message}</Alert> : null}

      {canEdit && status !== "ARCHIVED" ? (
        <form action={runAction}>
          <input type="hidden" name="slug" value={slug} />
          <Submit
            label={check ? "Check again" : "Run the check"}
            variant="secondary"
            disabled={!hasProblem}
          />
          {!hasProblem ? (
            <p className="mt-1.5 text-xs text-fg-subtle">
              Write at least a short problem statement first.
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}

function Submit({
  label,
  variant,
  disabled = false,
}: {
  label: string;
  variant: "primary" | "secondary";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <div>
      <Button
        type="submit"
        size="sm"
        variant={variant}
        loading={pending}
        disabled={pending || disabled}
      >
        {label}
      </Button>
    </div>
  );
}
