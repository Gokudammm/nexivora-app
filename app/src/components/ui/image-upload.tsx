"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";

/**
 * An image upload with a preview.
 *
 * Lives in `ui/` rather than `workspace/`: the avatar, the college logo and
 * Phase 8's project cover are the same interaction in three places.
 *
 * One component for the avatar and the college logo, because they are the same
 * interaction: choose a file, see it before committing, save or remove.
 *
 * The preview is a local `blob:` URL, so it appears the instant a file is
 * chosen rather than after a round trip. It is revoked when replaced — a page
 * where somebody tries six avatars would otherwise hold six decoded images in
 * memory, which is exactly the sort of thing that is invisible until it is a
 * bug report about a slow laptop.
 *
 * Validation is client-side for *speed only*. The server re-checks the magic
 * bytes and the size, and its answer is the one that counts: everything here is
 * a string the browser volunteered.
 */

type Result = { ok: true; message: string } | { ok: false; error: string; field?: string };

export function ImageUpload({
  action,
  hidden = {},
  currentUrl,
  name,
  label,
  hint,
  shape = "circle",
  fileField = "file",
  removeField = "remove",
  children,
}: {
  action: (previous: Result | null, formData: FormData) => Promise<Result>;
  hidden?: Record<string, string | undefined>;
  currentUrl: string | null;
  /** Used for the generated fallback when there is no image. */
  name: string;
  label: string;
  hint?: string;
  shape?: "circle" | "square";
  fileField?: string;
  removeField?: string;
  /** Extra fields saved alongside the image — the accent colour, for instance. */
  children?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const shown = preview ?? (removing ? null : currentUrl);

  return (
    <form action={formAction} className="grid gap-4">
      {Object.entries(hidden).map(([key, value]) =>
        value === undefined ? null : <input key={key} type="hidden" name={key} value={value} />,
      )}
      <input type="hidden" name={removeField} value={removing ? "true" : "false"} />

      <div className="grid gap-1.5">
        <p className="text-sm leading-none font-medium">{label}</p>
        {hint ? <p className="text-xs text-fg-muted">{hint}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {shape === "circle" ? (
          <Avatar name={name} src={shown} size="xl" />
        ) : (
          <span className="grid size-20 place-items-center overflow-hidden rounded-xl border border-border bg-surface-sunken">
            {shown ? (
              /* A blob: URL before upload and a small already-capped image after it — the image
                 optimiser can process neither, so next/image would add a broken round trip. */
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shown} alt="" className="size-full object-contain" />
            ) : (
              <span className="text-xs text-fg-subtle">None</span>
            )}
          </span>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => input.current?.click()}
          >
            Choose image
          </Button>

          {shown ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (preview) URL.revokeObjectURL(preview);
                setPreview(null);
                setRemoving(true);
                if (input.current) input.current.value = "";
              }}
            >
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        name={fileField}
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (preview) URL.revokeObjectURL(preview);
          setPreview(file ? URL.createObjectURL(file) : null);
          setRemoving(false);
        }}
      />

      {children}

      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <Save />

      <p className="text-xs text-fg-subtle">
        PNG, JPEG, WebP or GIF, up to 2 MB. SVG is not accepted for images shown beside a name — it
        is markup and can carry script.
      </p>
    </form>
  );
}

function Save() {
  const { pending } = useFormStatus();

  return (
    <div>
      <Button type="submit" loading={pending} disabled={pending}>
        Save
      </Button>
    </div>
  );
}
