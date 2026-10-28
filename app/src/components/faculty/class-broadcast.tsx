"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { broadcastDeadline, postAnnouncement } from "@/lib/evaluation/announcements";

/**
 * Announce, or set a deadline for every group at once.
 *
 * Two things a faculty member currently does over email, and the deadline is
 * the one that earns its place: it creates a **real task on every group's
 * board**, so the date lands where people already look rather than in a
 * separate calendar nobody opens.
 */
export function ClassBroadcast({ classId, groupCount }: { classId: string; groupCount: number }) {
  const [mode, setMode] = useState<"announce" | "deadline">("announce");

  return (
    <section className="grid gap-4 rounded-xl border border-border p-5">
      <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
        {(
          [
            ["announce", "Announce"],
            ["deadline", "Set a deadline"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
            className={
              mode === value
                ? "focus-visible:outline-primary flex-1 rounded-md bg-surface-sunken px-3 py-1.5 text-sm font-medium focus-visible:outline-2"
                : "focus-visible:outline-primary flex-1 rounded-md px-3 py-1.5 text-sm font-medium text-fg-muted hover:text-fg focus-visible:outline-2"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "announce" ? (
        <AnnounceForm classId={classId} groupCount={groupCount} />
      ) : (
        <DeadlineForm classId={classId} groupCount={groupCount} />
      )}
    </section>
  );
}

function AnnounceForm({ classId, groupCount }: { classId: string; groupCount: number }) {
  const [state, formAction] = useActionState(postAnnouncement, null);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="classId" value={classId} />

      <Field label="Subject" required>
        <Input name="title" required maxLength={160} placeholder="Mid-term review scheduled" />
      </Field>

      <Field label="Message" required>
        <Textarea name="body" rows={4} required maxLength={8000} />
      </Field>

      <Field
        label="Publish"
        hint="Leave blank to post now. A future time stays invisible until then."
      >
        <Input name="publishAt" type="datetime-local" />
      </Field>

      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <Submit label={`Post to ${groupCount} ${groupCount === 1 ? "group" : "groups"}`} />
    </form>
  );
}

function DeadlineForm({ classId, groupCount }: { classId: string; groupCount: number }) {
  const [state, formAction] = useActionState(broadcastDeadline, null);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="classId" value={classId} />

      <Field label="What is due" required>
        <Input name="title" required maxLength={160} placeholder="Mid-term report submitted" />
      </Field>

      <Field label="Due date" required>
        <Input name="dueDate" type="date" required />
      </Field>

      <Field label="Detail" hint="Shown on the task. Optional.">
        <Textarea name="description" rows={2} maxLength={1000} />
      </Field>

      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <Submit label={`Add to ${groupCount} ${groupCount === 1 ? "board" : "boards"}`} />

      <p className="text-xs text-fg-subtle">
        This creates a real task on each group&rsquo;s board, so it counts toward their progress and
        shows in their deadline strip. Running it twice does not duplicate.
      </p>
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <div>
      <Button type="submit" size="sm" loading={pending} disabled={pending}>
        {label}
      </Button>
    </div>
  );
}
