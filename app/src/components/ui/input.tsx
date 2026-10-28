"use client";

import * as RadixCheckbox from "@radix-ui/react-checkbox";
import * as RadixRadio from "@radix-ui/react-radio-group";
import * as RadixSlider from "@radix-ui/react-slider";
import * as RadixSwitch from "@radix-ui/react-switch";
import { forwardRef, useCallback, useEffect, useRef } from "react";

import { CheckIcon, ChevronDownIcon } from "@/components/icons";
import { useFieldControl } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";

/**
 * Form controls. Each picks up its id, description and invalid state from the
 * surrounding <Field> via context, so no call site wires ARIA by hand.
 */

const controlBase = [
  "w-full rounded-md border bg-surface text-fg",
  "placeholder:text-fg-subtle",
  "transition-[border-color,box-shadow] duration-[var(--duration-state)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
  "focus-visible:border-border-focus",
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-surface-sunken",
].join(" ");

const sizing = "h-11 px-3 text-sm";

/* ------------------------------------------------------------------- Input */

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  /** Rendered inside the control, before the text. Decorative. */
  leadingIcon?: React.ReactNode;
  trailing?: React.ReactNode;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leadingIcon, trailing, ...props },
  ref,
) {
  const field = useFieldControl();

  const input = (
    <input
      ref={ref}
      id={field.id}
      aria-describedby={field.describedBy}
      aria-invalid={field.invalid || undefined}
      required={field.required}
      disabled={field.disabled || props.disabled}
      className={cn(
        controlBase,
        sizing,
        field.invalid ? "border-danger" : "border-border-strong",
        leadingIcon && "pl-10",
        trailing && "pr-10",
        className,
      )}
      {...props}
    />
  );

  if (!leadingIcon && !trailing) return input;

  return (
    <div className="relative">
      {leadingIcon ? (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle">
          {leadingIcon}
        </span>
      ) : null}
      {input}
      {trailing ? (
        <span className="absolute top-1/2 right-2 -translate-y-1/2">{trailing}</span>
      ) : null}
    </div>
  );
});

/* ---------------------------------------------------------------- Textarea */

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Grows with its content instead of scrolling. */
  autoResize?: boolean;
  maxRows?: number;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, autoResize = true, maxRows = 12, rows = 3, onInput, ...props },
  ref,
) {
  const field = useFieldControl();
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  const resize = useCallback(
    (el: HTMLTextAreaElement) => {
      if (!autoResize) return;
      el.style.height = "auto";
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight || "24");
      const max = lineHeight * maxRows;
      el.style.height = `${Math.min(el.scrollHeight, max)}px`;
      el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
    },
    [autoResize, maxRows],
  );

  useEffect(() => {
    if (innerRef.current) resize(innerRef.current);
  }, [resize, props.value, props.defaultValue]);

  return (
    <textarea
      ref={(node) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      id={field.id}
      rows={rows}
      aria-describedby={field.describedBy}
      aria-invalid={field.invalid || undefined}
      required={field.required}
      disabled={field.disabled || props.disabled}
      onInput={(e) => {
        resize(e.currentTarget);
        onInput?.(e);
      }}
      className={cn(
        controlBase,
        "min-h-[5.5rem] resize-y px-3 py-2.5 text-sm",
        field.invalid ? "border-danger" : "border-border-strong",
        className,
      )}
      {...props}
    />
  );
});

/* ------------------------------------------------------------------ Select */

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...props },
  ref,
) {
  const field = useFieldControl();
  return (
    <div className="relative">
      <select
        ref={ref}
        id={field.id}
        aria-describedby={field.describedBy}
        aria-invalid={field.invalid || undefined}
        required={field.required}
        disabled={field.disabled || props.disabled}
        className={cn(
          controlBase,
          sizing,
          "cursor-pointer appearance-none pr-10",
          field.invalid ? "border-danger" : "border-border-strong",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon
        size={18}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-subtle"
      />
    </div>
  );
});

/* -------------------------------------------------------------- DatePicker */

/**
 * A styled native date input.
 *
 * Deliberate: the native control is fully keyboard-accessible, localised by the
 * OS, and works with every screen reader — none of which is true of a custom
 * calendar widget without weeks of work. If a range picker is ever genuinely
 * needed, that is the phase that should build it.
 */
export const DatePicker = forwardRef<HTMLInputElement, Omit<InputProps, "type">>(
  function DatePicker(props, ref) {
    return <Input ref={ref} type="date" {...props} />;
  },
);

/* ---------------------------------------------------------------- Checkbox */

export function Checkbox({
  label,
  description,
  className,
  ...props
}: RadixCheckbox.CheckboxProps & { label: string; description?: string }) {
  const id = props.id ?? `cb-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <RadixCheckbox.Root
        id={id}
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-[5px] border border-border-strong",
          "transition-colors duration-[var(--duration-state)]",
          "data-[state=checked]:border-primary-fill data-[state=checked]:bg-primary-fill",
          "data-[state=indeterminate]:border-primary-fill data-[state=indeterminate]:bg-primary-fill",
          "focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
        {...props}
      >
        <RadixCheckbox.Indicator className="text-fg-on-primary">
          <CheckIcon size={14} />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      <div className="grid gap-0.5">
        <label htmlFor={id} className="cursor-pointer text-sm leading-tight font-medium">
          {label}
        </label>
        {description ? <p className="text-sm text-fg-subtle">{description}</p> : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- RadioGroup */

export function RadioGroup({
  options,
  className,
  ...props
}: RadixRadio.RadioGroupProps & {
  options: { value: string; label: string; description?: string }[];
}) {
  return (
    <RadixRadio.Root className={cn("grid gap-2.5", className)} {...props}>
      {options.map((option) => (
        <div key={option.value} className="flex items-start gap-2.5">
          <RadixRadio.Item
            id={`radio-${option.value}`}
            value={option.value}
            className={cn(
              "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-border-strong",
              "transition-colors duration-[var(--duration-state)]",
              "data-[state=checked]:border-primary-fill",
              "focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            <RadixRadio.Indicator className="size-2.5 rounded-full bg-primary-fill" />
          </RadixRadio.Item>
          <div className="grid gap-0.5">
            <label
              htmlFor={`radio-${option.value}`}
              className="cursor-pointer text-sm leading-tight font-medium"
            >
              {option.label}
            </label>
            {option.description ? (
              <p className="text-sm text-fg-subtle">{option.description}</p>
            ) : null}
          </div>
        </div>
      ))}
    </RadixRadio.Root>
  );
}

/* ------------------------------------------------------------------ Switch */

export function Switch({
  label,
  description,
  className,
  ...props
}: RadixSwitch.SwitchProps & { label: string; description?: string }) {
  const id = props.id ?? `sw-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="grid gap-0.5">
        <label htmlFor={id} className="cursor-pointer text-sm leading-tight font-medium">
          {label}
        </label>
        {description ? <p className="text-sm text-fg-subtle">{description}</p> : null}
      </div>
      <RadixSwitch.Root
        id={id}
        className={cn(
          "bg-neutral-300 dark:bg-neutral-700",
          "relative h-6 w-11 shrink-0 cursor-pointer rounded-full",
          "transition-colors duration-[var(--duration-state)]",
          "data-[state=checked]:bg-primary-fill",
          "focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
        {...props}
      >
        <RadixSwitch.Thumb
          className={cn(
            "block size-5 translate-x-0.5 rounded-full bg-white shadow-sm",
            "transition-transform duration-[var(--duration-state)] will-change-transform",
            "data-[state=checked]:translate-x-[1.375rem]",
          )}
        />
      </RadixSwitch.Root>
    </div>
  );
}

/* ------------------------------------------------------------------ Slider */

export function Slider({ className, ...props }: RadixSlider.SliderProps) {
  const field = useFieldControl();
  return (
    <RadixSlider.Root
      className={cn("relative flex h-5 w-full touch-none items-center select-none", className)}
      aria-describedby={field.describedBy}
      {...props}
    >
      <RadixSlider.Track className="relative h-1.5 w-full grow rounded-full border border-border bg-surface-sunken">
        <RadixSlider.Range className="absolute h-full rounded-full bg-primary-fill" />
      </RadixSlider.Track>
      <RadixSlider.Thumb
        className={cn(
          "block size-5 rounded-full border-2 border-primary-fill bg-surface shadow-sm",
          "focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:outline-none",
          "disabled:opacity-60",
        )}
        aria-label="Value"
      />
    </RadixSlider.Root>
  );
}
