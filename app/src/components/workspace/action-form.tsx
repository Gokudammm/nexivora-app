"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import type { WorkspaceResult } from "@/lib/workspace/actions";

/**
 * The two shapes every workspace mutation uses.
 *
 * `ActionForm` for anything with fields, `ActionButton` for a one-click verb.
 * Both exist so that the parts that are easy to leave out — the pending state,
 * the error message, the double-submit guard — are present everywhere by
 * default rather than remembered per screen. Phase 5 learned the same lesson
 * across eleven admin pages; this is that lesson applied to twenty more.
 */

export type ServerAction = (
  previous: WorkspaceResult | null,
  formData: FormData,
) => Promise<WorkspaceResult>;

export function ActionForm({
  action,
  hidden = {},
  children,
  submitLabel,
  submitVariant = "primary",
  className,
  onDone,
  quiet = false,
}: {
  action: ServerAction;
  hidden?: Record<string, string | number | undefined>;
  children?: React.ReactNode;
  submitLabel: string;
  submitVariant?: ButtonProps["variant"];
  className?: string;
  onDone?: (result: WorkspaceResult) => void;
  /** Suppress the success banner — for forms whose result is visible anyway. */
  quiet?: boolean;
}) {
  const [state, formAction] = useActionState(
    async (previous: WorkspaceResult | null, formData: FormData) => {
      const result = await action(previous, formData);
      if (result.ok) onDone?.(result);
      return result;
    },
    null,
  );

  return (
    <form action={formAction} className={className ?? "grid gap-4"}>
      {Object.entries(hidden).map(([name, value]) =>
        value === undefined ? null : (
          <input key={name} type="hidden" name={name} value={String(value)} />
        ),
      )}

      {children}

      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.ok && !quiet ? <Alert tone="success">{state.message}</Alert> : null}

      <Submit label={submitLabel} variant={submitVariant} />
    </form>
  );
}

function Submit({ label, variant }: { label: string; variant: ButtonProps["variant"] }) {
  const { pending } = useFormStatus();

  return (
    <div>
      <Button type="submit" variant={variant} loading={pending} disabled={pending}>
        {label}
      </Button>
    </div>
  );
}

/**
 * A single verb with no fields — leave, archive, pin, RSVP.
 *
 * `confirm` is a plain browser confirm on purpose. A custom dialog here would
 * be a third overlay component for a question with two answers, and the native
 * one is keyboard-operable and screen-reader-announced without any work.
 */
export function ActionButton({
  action,
  hidden = {},
  label,
  variant = "secondary",
  size,
  confirm,
  className,
}: {
  action: ServerAction;
  hidden?: Record<string, string | number | undefined>;
  label: React.ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  confirm?: string;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([name, value]) =>
        value === undefined ? null : (
          <input key={name} type="hidden" name={name} value={String(value)} />
        ),
      )}

      <PendingButton label={label} variant={variant} size={size} />

      {state && !state.ok ? (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function PendingButton({
  label,
  variant,
  size,
}: {
  label: React.ReactNode;
  variant: ButtonProps["variant"];
  size: ButtonProps["size"];
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} size={size} loading={pending} disabled={pending}>
      {label}
    </Button>
  );
}
