"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { LABEL, type Status, type Transition } from "@/lib/project/lifecycle";
import { moveProject, type TransitionResult } from "@/lib/project/transitions";

/**
 * What can happen to this project next.
 *
 * The transitions come from the table, not from this component's idea of the
 * lifecycle, so a state added to `lifecycle.ts` appears here without anybody
 * touching the UI — and one removed disappears.
 *
 * Each button carries its `description` rather than a tooltip: these are the
 * consequential actions in the product, several are irreversible, and the
 * moment to explain "this assigns a permanent citation ID and cannot be undone"
 * is beside the button, not behind a hover nobody performs on a phone.
 *
 * A refusal is rendered in full. The server returns the sentence naming what is
 * missing — three incomplete sections by name, or who still owes a peer review —
 * and truncating that to "Cannot submit" would throw away the only useful part.
 */
export function LifecyclePanel({
  slug,
  status,
  transitions,
  canLead,
  canFaculty,
  canEdit,
}: {
  slug: string;
  status: Status;
  transitions: Transition[];
  canLead: boolean;
  canFaculty: boolean;
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState(moveProject, null);
  const [open, setOpen] = useState<string | null>(null);

  const permitted = (transition: Transition) =>
    transition.actor === "faculty" ? canFaculty : transition.actor === "lead" ? canLead : canEdit;

  const available = transitions.filter(permitted);

  return (
    <section className="grid gap-3 rounded-xl border border-border p-5">
      <div className="grid gap-1">
        <h2 className="font-medium">Status</h2>
        <p className="text-sm text-fg-muted">{LABEL[status]}</p>
      </div>

      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}

      {available.length === 0 ? (
        <p className="text-sm text-fg-subtle">
          {transitions.length === 0
            ? "This project has reached the end of its lifecycle."
            : "The next step is somebody else's to take."}
        </p>
      ) : (
        <ul className="grid gap-3">
          {available.map((transition) => (
            <li key={`${transition.from}-${transition.to}`} className="grid gap-1.5">
              <p className="text-xs text-fg-muted">{transition.description}</p>

              {transition.requiresReason && open !== transition.to ? (
                <div>
                  <Button variant="secondary" size="sm" onClick={() => setOpen(transition.to)}>
                    {transition.label}
                  </Button>
                </div>
              ) : (
                <form action={formAction} className="grid gap-2">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="to" value={transition.to} />

                  {transition.requiresReason ? (
                    <Field
                      label="Reason"
                      required
                      hint="This is what the other side will work from."
                    >
                      <Textarea name="reason" rows={3} required maxLength={1000} autoFocus />
                    </Field>
                  ) : null}

                  <Submit
                    label={transition.label}
                    variant={transition.to === "ARCHIVED" ? "secondary" : "primary"}
                  />
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Submit({ label, variant }: { label: string; variant: "primary" | "secondary" }) {
  const { pending } = useFormStatus();

  return (
    <div>
      <Button type="submit" size="sm" variant={variant} loading={pending} disabled={pending}>
        {label}
      </Button>
    </div>
  );
}

/** Re-exported for pages that render a single transition inline. */
export type { TransitionResult };
