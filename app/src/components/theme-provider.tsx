"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "nexivora-theme";

type ThemeContextValue = {
  theme: Theme;
  /** The theme actually being rendered, with "system" already resolved. */
  resolved: "light" | "dark";
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * The inline script that prevents a flash of the wrong theme.
 *
 * It runs synchronously in <head>, BEFORE first paint, and stamps `data-theme`
 * on <html>. Without it the page paints light, then corrects itself — the
 * classic dark-mode flash.
 *
 * "system" deliberately stamps NOTHING, so the CSS falls through to
 * `@media (prefers-color-scheme: dark)`. That is why globals.css guards its
 * dark block as `:root:not([data-theme="light"])`.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})();`;

/* --------------------------------------------------------------------------
   The theme is external state — it lives in localStorage and in the OS
   preference, not in React. So it is read with useSyncExternalStore rather
   than mirrored into useState from an effect: that avoids a cascading render
   on mount, and it is what the hook exists for.
   -------------------------------------------------------------------------- */

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // `storage` fires when another tab changes the theme, so tabs stay in step.
  window.addEventListener("storage", onChange);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
    mq.removeEventListener("change", onChange);
  };
}

function readTheme(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    // Private browsing or blocked site data — "system" is a fine default.
  }
  return "system";
}

function readResolved(): "light" | "dark" {
  const theme = readTheme();
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Server snapshots. The markup they produce is theme-neutral — the actual
// theme is applied by themeInitScript before paint and by CSS media queries,
// so these never cause a visible mismatch.
const serverTheme = (): Theme => "system";
const serverResolved = (): "light" | "dark" => "light";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);
  const resolved = useSyncExternalStore(subscribe, readResolved, serverResolved);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-fatal: the theme still applies for this session via the attribute.
    }
    const root = document.documentElement;
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
    emit();
  }, []);

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
