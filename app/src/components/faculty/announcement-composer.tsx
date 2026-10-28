"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/display";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import {
  broadcastDeadline,
  deleteAnnouncement,
  postAnnouncement,
} from "@/lib/evaluation/announcements";

/**
 * Compose an announcement, or set one deadline for a whole class.
 *
 * "Scheduled" here means stored with a future `publishAt` — not queued. There
 * is no job runner in this product, and a scheduled post that silently never
 * fires is worse than no scheduling at all; a future timestamp is simply not
 * yet visible to the class, which cannot fail. The list below says so in as
 * many words, because a faculty member who thinks it was sent and finds out on
 * Friday that it was not will not use the feature again.
 *
 * Withdrawal is only offered on something not yet published. Deleting a post
 * people have already read is dishonest, and the server refuses it too — this
 * is the interface agreeing with the rule rather than being the only thing
 * enforcing it.
 */

type Klass = { id: string; label: string; groupCount: number };

type Posted = {
  id: string;
  title: string;
  body: string;
  publishAt: Date;
  classLabel: string;
};

export function AnnouncementComposer({
  classes,
  announcements,
  now,
}: {
  classes: Klass[];
  announcements: Posted[];
  /** Passed in rather than read here: `Date.now()` during render is impure. */
  now: Date;
}) {
  const [mode, setMode] = useState<"announce" | "deadline">("announce");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");

  const klass = classes.find((entry) => entry.id === classId) ?? null;
  const nowMs = now.getTime();

  if (classes.length === 0) {
    return (
      <EmptyState
        title="No classes assigned to you"
        description="Announcements go to a class. Once a coordinator assigns you one, this is where you post to it — and where you set a deadline that lands on every group's board at once."
        action={
          <Button asChild variant="secondary">
            <Link href="/faculty">Back to the overview</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid content-start gap-8">
      <section className="grid gap-5 rounded-xl border border-border p-5">
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

        <Field label="Class" required>
          <Select value={classId} onChange={(event) => setClassId(event.target.value)}>
            {classes.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label} — {entry.groupCount} {entry.groupCount === 1 ? "group" : "groups"}
              </option>
            ))}
          </Select>
        </Field>

        {mode === "announce" ? (
          <AnnounceForm
            key={`a:${classId}`}
            classId={classId}
            groupCount={klass?.groupCount ?? 0}
          />
        ) : (
          <DeadlineForm
            key={`d:${classId}`}
            classId={classId}
            groupCount={klass?.groupCount ?? 0}
          />
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="font-medium">Posted by you</h2>

        {announcements.length === 0 ? (
          <p className="text-sm text-fg-subtle">Nothing yet.</p>
        ) : (
          <ul className="grid gap-3">
            {announcements.map((announcement) => {
              const scheduled = announcement.publishAt.getTime() > nowMs;

              return (
                <li
                  key={announcement.id}
                  className="grid gap-1.5 rounded-xl border border-border p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">
                      {announcement.title}
                    </p>
                    <Badge tone="outline">{announcement.classLabel}</Badge>
                    {scheduled ? <Badge tone="info">scheduled</Badge> : null}
                  </div>

                  <p className="text-xs text-fg-muted">
                    {scheduled ? "Publishes " : "Published "}
                    <time dateTime={announcement.publishAt.toISOString()}>
                      {announcement.publishAt.toLocaleString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </time>
                    {scheduled ? " — nobody can see it until then." : null}
                  </p>

                  <p className="line-clamp-3 text-sm whitespace-pre-wrap text-fg-muted">
                    {announcement.body}
                  </p>

                  {scheduled ? <WithdrawButton announcementId={announcement.id} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ forms */

function AnnounceForm({ classId, groupCount }: { classId: string; groupCount: number }) {
  const [state, formAction] = useActionState(postAnnouncement, null);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="classId" value={classId} />

      <Field label="Subject" required>
        <Input name="title" required maxLength={160} placeholder="Mid-term review scheduled" />
      </Field>

      <Field label="Message" required>
        <Textarea name="body" rows={5} required maxLength={8000} />
      </Field>

      <Field
        label="Publish"
        hint="Leave blank to post now. A future time is stored and simply stays invisible until then — nothing is queued, so nothing can silently fail to send."
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

function WithdrawButton({ announcementId }: { announcementId: string }) {
  const [state, formAction] = useActionState(deleteAnnouncement, null);

  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="announcementId" value={announcementId} />
      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      <div>
        <Button type="submit" variant="ghost" size="sm">
          Withdraw
        </Button>
      </div>
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
