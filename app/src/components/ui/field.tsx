"use client";

import { createContext, useContext, useId } from "react";

import { AlertIcon } from "@/components/icons";
import { cn } from "@/lib/utils/cn";

/**
 * Field — label, hint, error and the full `aria-describedby` wiring.
 *
 * **Every form control in this product is used inside a Field.** A bare Input
 * outside one is a review failure: it means the label, the hint and the error
 * are not programmatically associated, which fails WCAG 1.3.1 and 3.3.2 and
 * makes the form unusable with a screen reader.
 *
 * The control reads its ids from context, so a call site never wires them by
 * hand and therefore cannot get them wrong.
 */

type FieldContextValue = {
  id: string;
  hintId?: string;
  errorId?: string;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

/** Used by every control to pick up its wiring. Safe outside a Field. */
export function useFieldControl() {
  const ctx = useContext(FieldContext);
  if (!ctx) return {} as Partial<FieldContextValue> & { describedBy?: string };
  const describedBy = [ctx.hintId, ctx.errorId].filter(Boolean).join(" ") || undefined;
  return { ...ctx, describedBy };
}

export type FieldProps = {
  label: string;
  /** Guidance shown before the user makes a mistake — always better than an error. */
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /** Hides the label visually but keeps it for assistive technology. */
  labelHidden?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function Field({
  label,
  hint,
  error,
  required = false,
  disabled = false,
  labelHidden = false,
  className,
  children,
}: FieldProps) {
  const base = useId();
  const id = `${base}-control`;
  const hintId = hint ? `${base}-hint` : undefined;
  const errorId = error ? `${base}-error` : undefined;

  return (
    <FieldContext.Provider
      value={{ id, hintId, errorId, invalid: Boolean(error), required, disabled }}
    >
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label
          htmlFor={id}
          className={cn(
            "text-sm leading-none font-medium text-fg",
            labelHidden && "sr-only",
            disabled && "opacity-60",
          )}
        >
          {label}
          {required ? (
            <>
              <span aria-hidden className="ml-0.5 text-danger">
                *
              </span>
              <span className="sr-only"> (required)</span>
            </>
          ) : null}
        </label>

        {hint ? (
          <p id={hintId} className="text-sm text-fg-subtle">
            {hint}
          </p>
        ) : null}

        {children}

        {error ? (
          // aria-live so the error is announced when it appears, not only when
          // focus happens to land on the control.
          <p
            id={errorId}
            role="alert"
            aria-live="polite"
            className="flex items-start gap-1.5 text-sm text-danger"
          >
            <AlertIcon size={16} className="mt-0.5" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}
