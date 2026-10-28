"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { CommandIcon, SearchIcon } from "@/components/icons";
import { Kbd } from "@/components/ui/display";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { cn } from "@/lib/utils/cn";

/**
 * The command palette (⌘K / Ctrl+K).
 *
 * Built in Phase 1 and deliberately left mostly empty. Two reasons:
 *
 * 1. Later phases register their own commands into it, so the surface exists
 *    before there is anything to put in it.
 * 2. **It is the deterministic fallback for the Phase 18 AI assistant.**
 *    Building it now, separately, keeps the boundary honest: with
 *    `AI_ENABLED=false` the assistant IS this palette, and nothing is broken.
 *    Building both together in Phase 18 would blur which is which.
 *
 * Commands come from a registry rather than being hard-coded, so a feature
 * phase adds its verbs without touching this file.
 */

export type Command = {
  id: string;
  label: string;
  /** Grouping heading in the list. */
  group: string;
  keywords?: string[];
  shortcut?: string;
  icon?: React.ReactNode;
  /** Exactly one of `href` or `run`. */
  href?: string;
  run?: () => void;
};

type CommandContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  register: (commands: Command[]) => () => void;
};

const CommandContext = createContext<CommandContextValue | null>(null);

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [registry, setRegistry] = useState<Command[]>([]);

  const register = useCallback((commands: Command[]) => {
    setRegistry((current) => [...current, ...commands]);
    const ids = new Set(commands.map((c) => c.id));
    return () => setRegistry((current) => current.filter((c) => !ids.has(c.id)));
  }, []);

  // ⌘K / Ctrl+K. Registered once, at the provider, so no page wires it up.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(() => ({ open, setOpen, register }), [open, register]);

  return (
    <CommandContext.Provider value={value}>
      {children}
      <CommandPalette commands={registry} open={open} onOpenChange={setOpen} />
    </CommandContext.Provider>
  );
}

export function useCommandPalette() {
  const ctx = useContext(CommandContext);
  if (!ctx) throw new Error("useCommandPalette must be used inside <CommandPaletteProvider>");
  return ctx;
}

/** Registers commands for the lifetime of the calling component. */
export function useRegisterCommands(commands: Command[]) {
  const { register } = useCommandPalette();
  useEffect(() => register(commands), [register, commands]);
}

function CommandPalette({
  commands,
  open,
  onOpenChange,
}: {
  commands: Command[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q) ||
        c.keywords?.some((k) => k.toLowerCase().includes(q)),
    );
  }, [commands, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const command of filtered) {
      const list = map.get(command.group) ?? [];
      list.push(command);
      map.set(command.group, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const run = useCallback(
    (command: Command) => {
      onOpenChange(false);
      setQuery("");
      if (command.href) router.push(command.href);
      else command.run?.();
    },
    [onOpenChange, router],
  );

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
    } else if (event.key === "Enter") {
      const command = filtered[activeIndex];
      if (command) {
        event.preventDefault();
        run(command);
      }
    }
  }

  let flatIndex = -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Command palette" description="Search and jump anywhere" size="md">
        <div onKeyDown={onKeyDown}>
          <div className="flex items-center gap-2.5 rounded-md border border-border px-3">
            <SearchIcon size={18} className="shrink-0 text-fg-subtle" />
            {/* autoFocus is correct here: a command palette that does not
                focus its input on open is unusable, and it only ever opens on
                an explicit user gesture. */}
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              placeholder="Search commands…"
              aria-label="Search commands"
              role="combobox"
              aria-expanded
              aria-controls="command-list"
              className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-subtle"
            />
            <Kbd>Esc</Kbd>
          </div>

          <ul id="command-list" role="listbox" className="mt-3 max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-2 py-8 text-center text-sm text-fg-subtle">
                {commands.length === 0
                  ? "No commands registered yet — feature phases add them here."
                  : `No commands match “${query}”`}
              </li>
            ) : (
              groups.map(([group, items]) => (
                <li key={group}>
                  <p className="px-2 py-1.5 text-xs font-semibold tracking-wide text-fg-subtle uppercase">
                    {group}
                  </p>
                  <ul>
                    {items.map((command) => {
                      flatIndex += 1;
                      const index = flatIndex;
                      return (
                        <li
                          key={command.id}
                          role="option"
                          aria-selected={index === activeIndex}
                          onPointerEnter={() => setActiveIndex(index)}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            run(command);
                          }}
                          className={cn(
                            "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm",
                            index === activeIndex && "bg-surface-sunken",
                          )}
                        >
                          {command.icon ?? <CommandIcon size={16} className="text-fg-subtle" />}
                          <span className="flex-1">{command.label}</span>
                          {command.shortcut ? <Kbd>{command.shortcut}</Kbd> : null}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))
            )}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
