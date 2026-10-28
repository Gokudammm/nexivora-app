"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/display";
import type { SectionSpec } from "@/config/sections";
import { countWords } from "@/config/sections";
import { claimSectionLock, saveSection } from "@/lib/project/actions";
import { cn } from "@/lib/utils/cn";

/**
 * THE SECTION EDITOR.
 *
 * Two requirements shape everything here.
 *
 * **Autosave must lose no work** (acceptance criterion 9). The naive version —
 * a debounced save on every keystroke — loses the last edit when somebody types
 * and immediately closes the tab, because the debounce never fires. So there
 * are three triggers: the debounce, `blur`, and `visibilitychange` when the
 * page is being hidden. The last one is what actually catches the tab close,
 * and it is the one people forget.
 *
 * **The guidance is not decoration.** The spec calls the blank page *"the real
 * obstacle"*, and it is right — most students have never written a methodology
 * section. The prompt, the questions and a real example sit beside the textarea
 * permanently rather than behind a tooltip, because guidance you have to go
 * looking for is guidance for people who already know what they are doing.
 */

type Version = {
  id: string;
  version: number;
  wordCount: number;
  createdAt: Date;
  editor: { id: string; name: string; username: string | null; avatarUrl: string | null } | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function SectionEditor({
  slug,
  spec,
  initialBody,
  initialComplete,
  versions,
  activeEditorName,
  readOnly,
  onRestore,
}: {
  slug: string;
  spec: SectionSpec;
  initialBody: string;
  initialComplete: boolean;
  versions: Version[];
  /** Somebody else is in this section right now. A courtesy, not a barrier. */
  activeEditorName: string | null;
  readOnly: boolean;
  onRestore?: React.ReactNode;
}) {
  const [body, setBody] = useState(initialBody);
  const [complete, setComplete] = useState(initialComplete);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // What is on the server. Compared against `body` to decide whether a save is
  // worth making at all — a blur with no edit should not write a version row.
  const saved = useRef(initialBody);
  const savedComplete = useRef(initialComplete);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const words = countWords(body);
  const short = words < spec.minWords;

  const persist = useCallback(
    (nextBody: string, nextComplete: boolean) => {
      if (readOnly) return;
      if (nextBody === saved.current && nextComplete === savedComplete.current) return;

      setState("saving");
      setError(null);

      const data = new FormData();
      data.set("slug", slug);
      data.set("kind", spec.kind);
      data.set("body", nextBody);
      data.set("complete", nextComplete ? "true" : "false");

      startTransition(async () => {
        const result = await saveSection(null, data);

        if (result.ok) {
          saved.current = nextBody;
          savedComplete.current = nextComplete;
          setState("saved");
        } else {
          setState("error");
          setError(result.error);
          // The completion toggle is the only thing the server refuses on its
          // own; roll it back so the control matches what was actually stored.
          if (result.field === "complete") setComplete(savedComplete.current);
        }
      });
    },
    [readOnly, slug, spec.kind],
  );

  /* ------------------------------------------------- the three triggers */

  useEffect(() => {
    if (readOnly) return;
    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(() => persist(body, complete), 1200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [body, complete, persist, readOnly]);

  useEffect(() => {
    if (readOnly) return;

    // The one that catches a closed tab. `beforeunload` cannot await an async
    // action and `visibilitychange` fires reliably on mobile backgrounding,
    // where `beforeunload` does not fire at all.
    const flush = () => {
      if (document.visibilityState === "hidden") persist(body, complete);
    };

    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [body, complete, persist, readOnly]);

  /* ------------------------------------------------------------- the lock */

  useEffect(() => {
    if (readOnly) return;

    const claim = () => {
      const data = new FormData();
      data.set("slug", slug);
      data.set("kind", spec.kind);
      void claimSectionLock(null, data);
    };

    claim();
    const interval = setInterval(claim, 4 * 60_000);
    return () => clearInterval(interval);
  }, [readOnly, slug, spec.kind]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="grid content-start gap-3">
        {activeEditorName ? (
          <Alert tone="warning" title={`${activeEditorName} is editing this section`}>
            You can both type — nothing is blocked. Whoever saves last wins, so it is worth saying
            something in the group discussion first.
          </Alert>
        ) : null}

        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onBlur={() => persist(body, complete)}
          readOnly={readOnly}
          rows={22}
          maxLength={60_000}
          aria-label={spec.label}
          placeholder={readOnly ? "" : spec.example}
          className="font-mono text-sm leading-relaxed"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className={cn("text-fg-subtle", short && words > 0 && "text-warning")}>
            {words} {words === 1 ? "word" : "words"}
            {short ? ` · ${spec.minWords} needed to mark complete` : ""}
          </span>

          <span
            aria-live="polite"
            className={cn(
              "text-fg-subtle",
              state === "saved" && "text-success",
              state === "error" && "text-danger",
            )}
          >
            {readOnly
              ? "Read only"
              : state === "saving"
                ? "Saving…"
                : state === "saved"
                  ? "Saved"
                  : state === "error"
                    ? "Not saved"
                    : " "}
          </span>
        </div>

        {error ? <Alert tone="danger">{error}</Alert> : null}

        {!readOnly ? (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={complete}
                disabled={short}
                onChange={(event) => {
                  setComplete(event.target.checked);
                  persist(body, event.target.checked);
                }}
                className="size-4 rounded border-border-strong"
              />
              Mark this section complete
            </label>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => persist(body, complete)}
              disabled={state === "saving"}
            >
              Save now
            </Button>
          </div>
        ) : null}
      </div>

      {/* ------------------------------------------------------- guidance */}

      <aside className="grid content-start gap-5">
        <section className="grid gap-3 rounded-xl border border-border bg-surface-sunken/40 p-5">
          <h2 className="text-sm font-medium">What goes here</h2>
          <p className="text-sm text-fg-muted">{spec.prompt}</p>

          <h3 className="text-xs font-medium text-fg-muted">A good section answers</h3>
          <ul className="grid gap-1.5">
            {spec.asks.map((ask) => (
              <li key={ask} className="flex gap-2 text-sm text-fg-muted">
                <span aria-hidden className="text-fg-subtle">
                  ·
                </span>
                {ask}
              </li>
            ))}
          </ul>

          <h3 className="text-xs font-medium text-fg-muted">For example</h3>
          <p className="border-l-2 border-border pl-3 text-sm text-fg-subtle italic">
            {spec.example}
          </p>
        </section>

        {versions.length > 0 ? (
          <section className="grid gap-3 rounded-xl border border-border p-5">
            <h2 className="text-sm font-medium">History</h2>
            <ul className="grid gap-2">
              {versions.slice(0, 8).map((version) => (
                <li key={version.id} className="flex items-center gap-2 text-xs">
                  {version.editor ? (
                    <Avatar
                      name={version.editor.name}
                      src={version.editor.avatarUrl}
                      seed={version.editor.id}
                      size="xs"
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate text-fg-muted">
                    v{version.version} · {version.editor?.name ?? "Someone"} · {version.wordCount}w
                  </span>
                  <time
                    dateTime={version.createdAt.toISOString()}
                    className="shrink-0 text-fg-subtle"
                  >
                    {version.createdAt.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </time>
                </li>
              ))}
            </ul>
            {onRestore}
          </section>
        ) : null}
      </aside>
    </div>
  );
}
