"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { CheckCircleIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import type { Status } from "@/lib/project/lifecycle";
import { submitProject } from "@/lib/project/transitions";
import { cn } from "@/lib/utils/cn";

/**
 * The pre-submission checklist.
 *
 * Everything unmet is shown **at once**. A submission blocked one reason at a
 * time — fix a section, retry, discover a milestone, retry — is the shape that
 * makes people submit at 3am and blame the tool, and it is entirely avoidable
 * because the server already knows every unmet precondition before the first
 * attempt.
 *
 * Advisory items are visually distinct from blocking ones. "No files attached"
 * is worth saying and must not look like a refusal, or people start ignoring
 * the whole list.
 */

type Item = {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
  href?: string;
  /** Worth mentioning; does not block. */
  advisory?: boolean;
};

export function SubmitChecklist({
  slug,
  status,
  canSubmit,
  groupId,
  items,
  submissions,
}: {
  slug: string;
  status: Status;
  canSubmit: boolean;
  groupId: string | null;
  items: Item[];
  submissions: { id: string; round: number; createdAt: Date }[];
}) {
  const [state, formAction] = useActionState(submitProject, null);

  const blocking = items.filter((item) => !item.advisory && !item.ok);
  const ready = blocking.length === 0;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <header className="grid gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Submit for review</h2>
        <p className="text-sm text-fg-muted">
          Submitting locks the record and takes a snapshot of it exactly as it stands. Your faculty
          guide can unlock it by requesting changes.
        </p>
      </header>

      {status === "UNDER_REVIEW" ? (
        <Alert tone="info" title="Already submitted">
          This project is with your faculty guide. Editing is locked until they request changes.
        </Alert>
      ) : null}

      <ul className="grid divide-y divide-border rounded-xl border border-border">
        {items.map((item) => (
          <li key={item.key} className="flex flex-wrap items-start gap-3 px-4 py-3.5">
            <span
              aria-hidden
              className={cn(
                "mt-0.5 shrink-0",
                item.ok ? "text-success" : item.advisory ? "text-fg-subtle" : "text-warning",
              )}
            >
              {item.ok ? <CheckCircleIcon /> : "○"}
            </span>

            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {item.label}
                {item.advisory ? <Badge tone="neutral">advisory</Badge> : null}
              </span>
              <span className="text-xs text-fg-muted">{item.detail}</span>
            </span>

            {item.href && !item.ok ? (
              <Link
                href={item.href}
                className="shrink-0 text-xs underline underline-offset-4 hover:text-fg"
              >
                Fix
              </Link>
            ) : null}
          </li>
        ))}
      </ul>

      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.ok ? (
        <Alert tone="success" title="Submitted">
          {state.message} Keep the receipt — it identifies exactly this version of the record.
        </Alert>
      ) : null}

      {status !== "UNDER_REVIEW" ? (
        canSubmit ? (
          <form action={formAction} className="grid gap-2">
            <input type="hidden" name="slug" value={slug} />
            <Submit ready={ready} />
            {!ready ? (
              <p className="text-xs text-fg-subtle">
                {blocking.length} {blocking.length === 1 ? "item" : "items"} still to do.
              </p>
            ) : null}
          </form>
        ) : (
          <Alert tone="info" title="Your group lead submits">
            Submitting is a commitment on behalf of the whole team, so it is the lead&rsquo;s to
            make.
            {groupId ? (
              <>
                {" "}
                <Link
                  href={`/groups/${groupId}/settings`}
                  className="font-medium underline underline-offset-4"
                >
                  See who leads this group
                </Link>
                .
              </>
            ) : null}
          </Alert>
        )
      ) : null}

      {submissions.length > 0 ? (
        <section className="grid gap-3">
          <h3 className="font-medium">Submission history</h3>
          <ul className="grid gap-2">
            {submissions.map((submission) => (
              <li
                key={submission.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-2.5 text-sm"
              >
                <span>Round {submission.round}</span>
                <time
                  dateTime={submission.createdAt.toISOString()}
                  className="text-xs text-fg-muted"
                >
                  {submission.createdAt.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </li>
            ))}
          </ul>
          <p className="text-xs text-fg-subtle">
            Every round is kept. A resubmission adds a snapshot; it never replaces one.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function Submit({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();

  return (
    <div>
      <Button type="submit" loading={pending} disabled={pending || !ready}>
        Submit for review
      </Button>
    </div>
  );
}
