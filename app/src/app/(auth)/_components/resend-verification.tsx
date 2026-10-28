"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { resendVerification, type ActionResult } from "@/lib/auth/actions";

export function ResendVerification() {
  const [state, action, pending] = useActionState(
    async (): Promise<ActionResult> => resendVerification(),
    null,
  );

  return (
    <form action={action} className="grid gap-3">
      {state?.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}
      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}

      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Sending…" : "Send it again"}
      </Button>
    </form>
  );
}
