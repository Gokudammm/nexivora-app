import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";

import { SpinnerIcon } from "@/components/icons";
import { cn } from "@/lib/utils/cn";

/**
 * The one Button. If you are writing a second one, stop.
 *
 * Every state is defined here — default, hover, focus-visible, active, disabled
 * and loading — so no call site re-implements them.
 *
 * Note the filled variants use the `*-fill` tokens, never a ramp step (ADR-015):
 * white on `accent-600` measures 3.68:1 and fails AA. `highlight` additionally
 * carries a border because bright amber cannot define its own edge on white.
 */

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2 rounded-md font-medium",
    "whitespace-nowrap select-none",
    "transition-[background-color,color,border-color,box-shadow,opacity]",
    "duration-[var(--duration-state)] ease-[var(--ease-out)]",
    "focus-visible:ring-border-focus focus-visible:ring-2 focus-visible:ring-offset-2",
    "focus-visible:ring-offset-surface focus-visible:outline-none",
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary-fill text-fg-on-primary hover:opacity-90 active:opacity-80 shadow-xs",
        secondary:
          "bg-surface-sunken text-fg hover:bg-neutral-200 active:bg-neutral-300 dark:hover:bg-surface-raised",
        outline:
          "border-border-strong text-fg hover:bg-surface-sunken active:bg-surface-sunken border bg-transparent",
        ghost: "text-fg hover:bg-surface-sunken active:bg-surface-sunken bg-transparent",
        danger: "bg-danger text-danger-fg shadow-xs hover:opacity-90 active:opacity-80",
        accent: "bg-accent-fill text-fg-on-accent shadow-xs hover:opacity-90 active:opacity-80",
        highlight:
          "bg-highlight-fill text-fg-on-highlight border-highlight-fill-border shadow-xs border hover:opacity-90 active:opacity-80",
        link: "text-primary-600 h-auto p-0 underline underline-offset-4 hover:no-underline",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
      /** Square, for a lone icon. Keeps the 44x44 touch target at md and lg. */
      iconOnly: {
        true: "px-0",
        false: "",
      },
      fullWidth: { true: "w-full", false: "" },
    },
    compoundVariants: [
      { iconOnly: true, size: "sm", class: "h-9 w-9" },
      { iconOnly: true, size: "md", class: "h-11 w-11" },
      { iconOnly: true, size: "lg", class: "h-12 w-12" },
    ],
    defaultVariants: { variant: "primary", size: "md", iconOnly: false, fullWidth: false },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    /** Render as the single child element instead of a <button>. */
    asChild?: boolean;
    loading?: boolean;
    /** Announced while `loading`. Defaults to "Loading". */
    loadingLabel?: string;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    iconOnly,
    fullWidth,
    asChild = false,
    loading = false,
    loadingLabel = "Loading",
    disabled,
    children,
    ...props
  },
  ref,
) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size, iconOnly, fullWidth }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          {/* The label stays in the DOM so the button does not change width. */}
          <span className="absolute inset-0 flex items-center justify-center">
            <SpinnerIcon size={size === "lg" ? 20 : 18} />
            <span className="sr-only">{loadingLabel}</span>
          </span>
          <span className="invisible flex items-center gap-2">{children}</span>
        </>
      ) : (
        children
      )}
    </Comp>
  );
});

export { buttonVariants };
