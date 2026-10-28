"use client";

import * as RadixToast from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { AlertIcon, CheckCircleIcon, CloseIcon, ErrorIcon, InfoIcon } from "@/components/icons";
import { cn } from "@/lib/utils/cn";

/**
 * Toasts.
 *
 * Radix handles the part that matters and is easy to get wrong: the swipe
 * gesture, the pause-on-hover timer, and the `aria-live` region that announces
 * a toast without stealing focus.
 *
 * Rule of use: a toast confirms something that already happened. It is never
 * the only place an error is reported — a form error belongs in the Field.
 */

export type ToastTone = "success" | "error" | "warning" | "info";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
  action?: { label: string; onClick: () => void };
};

type ToastRecord = ToastInput & { id: number };

const ToastContext = createContext<{ toast: (input: ToastInput) => void } | null>(null);

const TONE_ICON: Record<ToastTone, React.ComponentType<{ size?: number; className?: string }>> = {
  success: CheckCircleIcon,
  error: ErrorIcon,
  warning: AlertIcon,
  info: InfoIcon,
};

const TONE_CLASS: Record<ToastTone, string> = {
  success: "text-success",
  error: "text-danger",
  warning: "text-warning",
  info: "text-info",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const toast = useCallback((input: ToastInput) => {
    setToasts((current) => [...current, { ...input, id: Date.now() + Math.random() }]);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider swipeDirection="right" duration={5000}>
        {children}

        {toasts.map((item) => {
          const tone = item.tone ?? "info";
          const ToneIcon = TONE_ICON[tone];
          return (
            <RadixToast.Root
              key={item.id}
              duration={item.duration}
              onOpenChange={(open) => {
                if (!open) setToasts((current) => current.filter((t) => t.id !== item.id));
              }}
              className={cn(
                "grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-lg border border-border bg-surface p-4 shadow-lg",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
                "data-[swipe=end]:animate-out",
              )}
            >
              <ToneIcon size={20} className={cn("mt-0.5", TONE_CLASS[tone])} />

              <div className="grid gap-0.5">
                <RadixToast.Title className="text-sm font-semibold">{item.title}</RadixToast.Title>
                {item.description ? (
                  <RadixToast.Description className="text-sm text-fg-muted">
                    {item.description}
                  </RadixToast.Description>
                ) : null}
                {item.action ? (
                  <RadixToast.Action
                    altText={item.action.label}
                    onClick={item.action.onClick}
                    className="mt-1.5 justify-self-start text-sm font-medium text-primary-600 underline underline-offset-4"
                  >
                    {item.action.label}
                  </RadixToast.Action>
                ) : null}
              </div>

              <RadixToast.Close
                aria-label="Dismiss"
                className="grid size-7 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-surface-sunken hover:text-fg focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none"
              >
                <CloseIcon size={16} />
              </RadixToast.Close>
            </RadixToast.Root>
          );
        })}

        <RadixToast.Viewport className="fixed right-0 bottom-0 z-[var(--z-toast)] flex w-[min(24rem,100vw-2rem)] flex-col gap-2 p-4 outline-none" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
