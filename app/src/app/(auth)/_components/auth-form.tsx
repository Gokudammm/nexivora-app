"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/auth/actions";

/**
 * The shared shell for every auth form.
 *
 * `useActionState` keeps these forms working with JavaScript disabled: the
 * form posts, the action runs on the server, and the result comes back. That is
 * not a checkbox for its own sake — a student on a bad connection at the wrong
 * moment in a form submission is a real scenario, and an auth form that needs
 * hydration to work is an auth form that sometimes does not.
 */

type AuthFormProps = {
  action: (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  pendingLabel: string;
  children: React.ReactNode;
  /** Rendered under the submit button. */
  footer?: React.ReactNode;
};

export function AuthForm({ action, submitLabel, pendingLabel, children, footer }: AuthFormProps) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      {state && !state.ok ? (
        // role="alert" so the message is announced, and the message is placed
        // before the fields so screen-reader users meet it on the way in.
        <Alert tone="danger" title="That did not work">
          {state.error}
        </Alert>
      ) : null}

      {state?.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}

      {children}

      <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />

      {footer}
    </form>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {/* The label changes rather than only a spinner appearing: password
          hashing deliberately takes a few hundred milliseconds, and silence is
          how people end up submitting twice. */}
      {pending ? pendingLabel : label}
    </Button>
  );
}
