"use client";

import { TooltipProvider } from "@radix-ui/react-tooltip";

import { CommandPaletteProvider } from "@/components/layout/command-palette";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";

/**
 * Every client-side provider, composed once.
 *
 * This is a single `'use client'` boundary near the root. Everything inside it
 * can still be a Server Component — `children` is passed through, so wrapping
 * the tree here does not make the tree a client tree. That distinction is what
 * keeps the server-first rule intact.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={300} skipDelayDuration={200}>
        <ToastProvider>
          <CommandPaletteProvider>{children}</CommandPaletteProvider>
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
