"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Avatar, Badge } from "@/components/ui/display";
import { Alert, EmptyState, Progress } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { closeMilestone } from "@/lib/workspace/review";
import { deleteMilestone, saveMilestone } from "@/lib/project/actions";
import { cn } from "@/lib/utils/cn";

/**
 * MILESTONES — the Gantt-lite view.
 *
 * Built from the existing layout primitives with **no chart library**, as the
 * spec insists. A dated bar per milestone laid out against the project's own
 * date range is thirty lines of CSS grid; a Gantt dependency for that would be
 * the largest thing in the bundle and would still need styling to match.
 *
 * Closing a milestone goes through Phase 7's `closeMilestone`, not a second
 * path — it gates on peer review and writes the `MILESTONE_OWNED` ledger event,
 * and a second closer here would let a group skip both by using this screen.
 */

type Milestone = {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  ownerId: string | null;
  state: string;
  tasks: { id: string; title: string; status: string }[];
};

const STATE_TONE: Record<string, "neutral" | "info" | "warning" | "success"> = {
  UPCOMING: "neutral",
  IN_PROGRESS: "info",
  AT_RISK: "warning",
  COMPLETE: "success",
};

const STATE_LABEL: Record<string, string> = {
  UPCOMING: "upcoming",
  IN_PROGRESS: "in progress",
  AT_RISK: "at risk",
  COMPLETE: "complete",
};

export function Milestones({
  slug,
  groupId,
  readOnly,
  members,
  milestones,
}: {
  slug: string;
  groupId: string | null;
  readOnly: boolean;
  members: { id: string; name: string; avatarUrl: string | null }[];
  milestones: Milestone[];
}) {
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [creating, setCreating] = useState(false);

  const byId = new Map(members.map((member) => [member.id, member]));

  // The timeline's own range, from the milestones that have dates. Milestones
  // without a date are listed but not placed — inventing a position for them
  // would make the chart assert something nobody said.
  const dated = milestones.filter((milestone) => milestone.dueDate);
  const first = dated.length ? Math.min(...dated.map((m) => m.dueDate!.getTime())) : 0;
  const last = dated.length ? Math.max(...dated.map((m) => m.dueDate!.getTime())) : 0;
  const span = Math.max(1, last - first);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="font-medium">Milestones</h2>
          <p className="text-xs text-fg-muted">
            Dated checkpoints. Closing one asks everybody for a peer review first.
          </p>
        </div>

        {readOnly ? null : (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
          >
            <PlusIcon />
            New milestone
          </Button>
        )}
      </div>

      {milestones.length === 0 ? (
        <EmptyState
          title="No milestones yet"
          description="A milestone is a dated checkpoint somebody owns. They are what make progress mean something more than a task count — and closing one is when peer review happens."
          action={
            readOnly ? null : <Button onClick={() => setCreating(true)}>Add the first one</Button>
          }
        />
      ) : (
        <>
          {dated.length > 1 ? (
            <section className="grid gap-2 rounded-xl border border-border p-5">
              <h3 className="text-sm font-medium">Timeline</h3>
              <ul className="grid gap-2">
                {dated
                  .slice()
                  .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
                  .map((milestone) => {
                    const offset = ((milestone.dueDate!.getTime() - first) / span) * 100;

                    return (
                      <li
                        key={milestone.id}
                        className="grid grid-cols-[8rem_1fr] items-center gap-3"
                      >
                        <span className="truncate text-xs text-fg-muted">{milestone.title}</span>
                        <span className="relative h-2 rounded-full bg-surface-sunken">
                          <span
                            className={cn(
                              "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full",
                              milestone.state === "COMPLETE"
                                ? "bg-success"
                                : milestone.state === "AT_RISK"
                                  ? "bg-warning"
                                  : "bg-primary-fill",
                            )}
                            style={{ left: `${Math.min(98, Math.max(2, offset))}%` }}
                            title={`${milestone.title} — ${milestone.dueDate!.toLocaleDateString("en-IN")}`}
                          />
                        </span>
                      </li>
                    );
                  })}
              </ul>
              <p className="text-xs text-fg-subtle">
                {new Date(first).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} to{" "}
                {new Date(last).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </section>
          ) : null}

          <ul className="grid gap-3">
            {milestones.map((milestone) => {
              const owner = milestone.ownerId ? byId.get(milestone.ownerId) : null;
              const done = milestone.tasks.filter((task) => task.status === "DONE").length;

              return (
                <li key={milestone.id} className="grid gap-3 rounded-xl border border-border p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid gap-1">
                      <h3 className="flex flex-wrap items-center gap-2 font-medium">
                        {milestone.title}
                        <Badge tone={STATE_TONE[milestone.state] ?? "neutral"}>
                          {STATE_LABEL[milestone.state] ?? milestone.state.toLowerCase()}
                        </Badge>
                      </h3>

                      <p className="text-xs text-fg-muted">
                        {milestone.dueDate
                          ? `Due ${milestone.dueDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
                          : "No due date"}
                        {owner ? ` · owned by ${owner.name}` : " · unowned"}
                      </p>
                    </div>

                    {owner ? (
                      <Avatar name={owner.name} src={owner.avatarUrl} seed={owner.id} size="sm" />
                    ) : null}
                  </div>

                  {milestone.description ? (
                    <p className="text-sm text-fg-muted">{milestone.description}</p>
                  ) : null}

                  {milestone.tasks.length > 0 ? (
                    <div className="grid gap-1.5">
                      <Progress
                        value={Math.round((done / milestone.tasks.length) * 100)}
                        label={`${milestone.title} tasks`}
                      />
                      <p className="text-xs text-fg-subtle">
                        {done} of {milestone.tasks.length} linked tasks done
                        {groupId ? (
                          <>
                            {" · "}
                            <Link
                              href={`/groups/${groupId}/tasks`}
                              className="underline underline-offset-4 hover:text-fg"
                            >
                              open the board
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-fg-subtle">
                      No tasks linked yet. Link tasks from the board to make progress countable.
                    </p>
                  )}

                  {readOnly ? null : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCreating(false);
                          setEditing(milestone);
                        }}
                      >
                        Edit
                      </Button>

                      {milestone.state !== "COMPLETE" && groupId ? (
                        <CloseMilestone groupId={groupId} milestoneId={milestone.id} />
                      ) : null}

                      {milestone.state !== "COMPLETE" ? (
                        <Remove slug={slug} milestoneId={milestone.id} title={milestone.title} />
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {creating || editing ? (
        <MilestoneForm
          slug={slug}
          members={members}
          milestone={editing}
          onDone={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ forms */

function MilestoneForm({
  slug,
  members,
  milestone,
  onDone,
}: {
  slug: string;
  members: { id: string; name: string }[];
  milestone: Milestone | null;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(saveMilestone, null);

  if (state?.ok) {
    // Closing on success rather than in a transition keeps the success message
    // visible for the tick before the list re-renders.
    queueMicrotask(onDone);
  }

  return (
    <form action={formAction} className="grid gap-4 rounded-xl border border-border p-5">
      <input type="hidden" name="slug" value={slug} />
      {milestone ? <input type="hidden" name="milestoneId" value={milestone.id} /> : null}

      <h3 className="font-medium">{milestone ? "Edit milestone" : "New milestone"}</h3>

      <Field label="Title" required>
        <Input
          name="title"
          required
          maxLength={160}
          defaultValue={milestone?.title ?? ""}
          placeholder="Field trial complete"
          autoFocus
        />
      </Field>

      <Field label="What does done look like?">
        <Textarea
          name="description"
          rows={2}
          maxLength={1000}
          defaultValue={milestone?.description ?? ""}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Due date">
          <Input
            name="dueDate"
            type="date"
            defaultValue={milestone?.dueDate ? milestone.dueDate.toISOString().slice(0, 10) : ""}
          />
        </Field>

        <Field label="Owner" hint="Who is accountable for this landing.">
          <Select name="ownerId" defaultValue={milestone?.ownerId ?? ""}>
            <option value="">Nobody yet</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}

      <div className="flex gap-2">
        <Save label={milestone ? "Save" : "Add milestone"} />
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function CloseMilestone({ groupId, milestoneId }: { groupId: string; milestoneId: string }) {
  const [state, formAction] = useActionState(closeMilestone, null);

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="milestoneId" value={milestoneId} />

      <div className="grid gap-1">
        <Button type="submit" variant="secondary" size="sm">
          Close milestone
        </Button>
        {state && !state.ok ? (
          <p role="alert" className="text-xs text-danger">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Remove({
  slug,
  milestoneId,
  title,
}: {
  slug: string;
  milestoneId: string;
  title: string;
}) {
  const [state, formAction] = useActionState(deleteMilestone, null);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Remove "${title}"? Its linked tasks stay on the board.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="milestoneId" value={milestoneId} />

      <Button type="submit" variant="ghost" size="sm">
        Remove
      </Button>

      {state && !state.ok ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" loading={pending} disabled={pending}>
      {label}
    </Button>
  );
}
