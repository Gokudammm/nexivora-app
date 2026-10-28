"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { moveProject } from "@/lib/project/transitions";

/**
 * Approve, return, or reject a proposal.
 *
 * Three outcomes rather than two, and the middle one matters most: **request
 * changes** returns the proposal to draft without rejecting it. A binary
 * approve/reject forces a faculty member to reject work that is merely
 * unfinished, which reads to a student as a judgement rather than a note.
 *
 * Both refusing paths require a reason, enforced on the server. A rejection
 * with no explanation is the single most demoralising thing this product could
 * produce, and the reason is the only part the group can act on.
 */
export function ProposalDecision({ slug }: { slug: string }) {
  const [state, formAction] = useActionState(moveProject, null);
  const [open, setOpen] = useState<"REJECTED" | "DRAFT" | null>(null);

  if (state?.ok) {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <div className="grid gap-3 border-t border-border pt-4">
      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}

      {open ? (
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="to" value={open} />

          <Field
            label={open === "DRAFT" ? "What needs changing?" : "Why is this being rejected?"}
            required
            hint="The group sees this, and it is what they will work from."
          >
            <Textarea name="reason" rows={3} required maxLength={1000} autoFocus />
          </Field>

          <div className="flex gap-2">
            <Submit label={open === "DRAFT" ? "Return for changes" : "Reject proposal"} />
            <Button type="button" variant="ghost" onClick={() => setOpen(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <form action={formAction}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="to" value="APPROVED" />
            <Submit label="Approve" primary />
          </form>

          <Button variant="secondary" size="sm" onClick={() => setOpen("DRAFT")}>
            Request changes
          </Button>

          <Button variant="ghost" size="sm" onClick={() => setOpen("REJECTED")}>
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}

function Submit({ label, primary = false }: { label: string; primary?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="sm"
      variant={primary ? "primary" : "secondary"}
      loading={pending}
      disabled={pending}
    >
      {label}
    </Button>
  );
}
