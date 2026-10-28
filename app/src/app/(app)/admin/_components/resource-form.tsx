"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import type { AdminResult } from "@/lib/admin/actions";

/**
 * ONE FORM, ELEVEN SCREENS.
 *
 * Phase 5 is mostly the same form with different fields: a name, a code, a
 * couple of numbers, a parent to belong to. Writing eleven near-identical pages
 * would mean eleven places to fix the next accessibility or error-handling
 * detail, and they would drift within a month.
 *
 * So the shape lives here and each screen supplies a field list. The trade is
 * that a genuinely unusual form has to opt out rather than bend this one — and
 * the import wizard does exactly that, because it is not a resource form.
 */

export type FormField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea";
  hint?: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string | number | null;
  /** Reduce the width for codes and small numbers, so the form reads properly. */
  narrow?: boolean;
};

type ResourceFormProps = {
  action: (previous: AdminResult | null, formData: FormData) => Promise<AdminResult>;
  fields: FormField[];
  /** Sent with every submission — the college id, an edit id, and so on. */
  hidden?: Record<string, string>;
  submitLabel: string;
  /** Collapses the form behind a button until it is needed. */
  collapsible?: { label: string };
  onSaved?: () => void;
};

export function ResourceForm({
  action,
  fields,
  hidden = {},
  submitLabel,
  collapsible,
}: ResourceFormProps) {
  const [state, formAction] = useActionState(action, null);
  const [open, setOpen] = useState(!collapsible);

  if (collapsible && !open) {
    return (
      <div className="grid gap-3">
        {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}
        <div>
          <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
            {collapsible.label}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-5 rounded-xl border border-border p-5" noValidate>
      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}

      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((field) => (
          <Field
            key={field.name}
            label={field.label}
            hint={field.hint}
            required={field.required}
            // The server is the authority on validity; this surfaces which
            // field it objected to rather than duplicating the rule.
            error={state && !state.ok && state.field === field.name ? state.error : undefined}
            className={field.narrow ? "" : "sm:col-span-2"}
          >
            {field.options ? (
              <Select name={field.name} defaultValue={String(field.defaultValue ?? "")}>
                <option value="">Choose…</option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                name={field.name}
                type={field.type === "textarea" ? "text" : (field.type ?? "text")}
                defaultValue={String(field.defaultValue ?? "")}
                placeholder={field.placeholder}
                required={field.required}
              />
            )}
          </Field>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Submit label={submitLabel} />
        {collapsible ? (
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

/**
 * A single-button action with a confirmation for the destructive ones.
 *
 * Archiving, suspending and revoking all share this. The confirmation is a
 * second click rather than a modal: a modal for "archive this department" is
 * ceremony, but doing it by accident on a mis-click is a support ticket.
 */
export function ActionButton({
  action,
  hidden,
  label,
  confirmLabel,
  variant = "secondary",
}: {
  action: (previous: AdminResult | null, formData: FormData) => Promise<AdminResult>;
  hidden: Record<string, string>;
  label: string;
  confirmLabel?: string;
  variant?: "secondary" | "ghost" | "danger";
}) {
  const [state, formAction] = useActionState(action, null);
  const [confirming, setConfirming] = useState(false);

  return (
    <form action={formAction} className="grid gap-2">
      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}

      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      {confirmLabel && !confirming ? (
        <Button type="button" variant={variant} size="sm" onClick={() => setConfirming(true)}>
          {label}
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <Button type="submit" variant={variant} size="sm">
            {confirming ? confirmLabel : label}
          </Button>
          {confirming ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          ) : null}
        </div>
      )}
    </form>
  );
}
