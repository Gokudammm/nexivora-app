"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { decideVerification } from "@/lib/admin/actions";

export function VerificationDecision({ collegeId }: { collegeId: string }) {
  const [state, action] = useActionState(decideVerification, null);
  const [rejecting, setRejecting] = useState(false);

  return (
    <div className="grid gap-3">
      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}

      {rejecting ? (
        <form action={action} className="grid gap-3">
          <input type="hidden" name="collegeId" value={collegeId} />
          <input type="hidden" name="approve" value="false" />
          <input
            name="reason"
            required
            minLength={8}
            placeholder="Why? The college sees this and needs to be able to act on it."
            className="bg-bg h-9 rounded-md border border-border px-3 text-sm"
            aria-label="Reason for rejection"
          />
          <div className="flex gap-2">
            <Button type="submit" variant="danger" size="sm">
              Reject
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <form action={action}>
            <input type="hidden" name="collegeId" value={collegeId} />
            <input type="hidden" name="approve" value="true" />
            <Button type="submit" size="sm">
              Verify this college
            </Button>
          </form>
          <Button type="button" variant="secondary" size="sm" onClick={() => setRejecting(true)}>
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
