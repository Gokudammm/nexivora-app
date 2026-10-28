"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { CheckIcon, ChevronDownIcon, CopyIcon, SearchIcon } from "@/components/icons";
import { useFieldControl } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";

/**
 * Combobox — a searchable, keyboard-navigable single select.
 *
 * Radix has no combobox primitive, so this is hand-built to the WAI-ARIA
 * combobox pattern: `role="combobox"` on the input with `aria-expanded`,
 * `aria-controls` and `aria-activedescendant`; `role="listbox"` on the popup;
 * `role="option"` with `aria-selected` on each row.
 *
 * Keyboard contract: Down/Up move the active option (wrapping), Enter selects,
 * Escape closes and restores, Home/End jump, Tab closes without selecting.
 * The active option is tracked with `aria-activedescendant` so DOM focus never
 * leaves the input — which is what keeps typing and navigating simultaneous.
 */

export type ComboboxOption = { value: string; label: string; description?: string };

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Search…",
  emptyText = "No matches",
  className,
}: {
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const field = useFieldControl();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q),
    );
  }, [options, query]);

  // Close on an outside click.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function commit(option: ComboboxOption) {
    onChange(option.value);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      setOpen(true);
      event.preventDefault();
      return;
    }
    if (!open) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(Math.max(0, filtered.length - 1));
        break;
      case "Enter": {
        const option = filtered[activeIndex];
        if (option) {
          event.preventDefault();
          commit(option);
        }
        break;
      }
      case "Escape":
        event.preventDefault();
        setOpen(false);
        setQuery("");
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        break;
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <SearchIcon
          size={18}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-subtle"
        />
        <input
          ref={inputRef}
          id={field.id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined
          }
          aria-describedby={field.describedBy}
          aria-invalid={field.invalid || undefined}
          disabled={field.disabled}
          value={open ? query : (selected?.label ?? "")}
          placeholder={selected ? selected.label : placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            // Reset the active option here, where the filter actually changes,
            // rather than in an effect reacting to it — no cascading render.
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn(
            "h-11 w-full rounded-md border bg-surface pr-10 pl-10 text-sm text-fg placeholder:text-fg-subtle",
            "focus-visible:border-border-focus focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60",
            field.invalid ? "border-danger" : "border-border-strong",
          )}
        />
        <ChevronDownIcon
          size={18}
          className={cn(
            "pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-subtle transition-transform",
            open && "rotate-180",
          )}
        />
      </div>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-[var(--z-dropdown)] mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-surface p-1.5 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-2.5 py-3 text-sm text-fg-subtle">{emptyText}</li>
          ) : (
            filtered.map((option, index) => (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === value}
                onPointerDown={(e) => {
                  e.preventDefault();
                  commit(option);
                }}
                onPointerEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-sm",
                  index === activeIndex && "bg-surface-sunken",
                )}
              >
                <span className="grid size-4 shrink-0 place-items-center pt-0.5">
                  {option.value === value ? <CheckIcon size={14} /> : null}
                </span>
                <span className="grid gap-0.5">
                  <span className="font-medium">{option.label}</span>
                  {option.description ? (
                    <span className="text-xs text-fg-subtle">{option.description}</span>
                  ) : null}
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------- CopyButton */

/**
 * Copies text and confirms it inline.
 *
 * The confirmation is announced via `aria-live` because a purely visual tick
 * tells a screen-reader user nothing about whether the copy succeeded.
 */
export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          // Clipboard can be blocked by permissions; failing silently is
          // better than an error toast for a convenience action.
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none",
        className,
      )}
    >
      {copied ? <CheckIcon size={14} className="text-success" /> : <CopyIcon size={14} />}
      <span>{copied ? "Copied" : label}</span>
      <span aria-live="polite" className="sr-only">
        {copied ? `${label} succeeded` : ""}
      </span>
    </button>
  );
}
