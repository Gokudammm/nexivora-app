"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Select } from "@/components/ui/input";
import { restoreSectionVersion } from "@/lib/project/actions";

/**
 * Restore a previous version of a section.
 *
 * Restoring is an append, not a rewind: the version being replaced is kept, so
 * the history reads "v1, v2, v3 (restored from v1)" rather than losing v2. Same
 * discipline as the ledger's compensating events, for the same reason — a
 * record that can quietly lose a state is not a record.
 *
 * The restored section is marked incomplete on purpose. Bringing back an older
 * body is not an assertion that it is finished, and silently keeping the
 * completion flag would let a section pass the submission check on text
 * somebody has just decided was wrong.
 */
export function RestoreVersion({
  slug,
  versions,
}: {
  slug: string;
  versions: { id: string; version: number; editorName: string }[];
}) {
  const [state, formAction] = useActionState(restoreSectionVersion, null);
  const [open, setOpen] = useState(false);

  if (versions.length === 0) return null;

  if (!open) {
    return (
      <div className="grid gap-2">
        {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
          Restore a version
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="slug" value={slug} />

      <label htmlFor="restore-version" className="text-xs font-medium">
        Restore
      </label>
      <Select id="restore-version" name="versionId" defaultValue={versions[0]!.id}>
        {versions.map((version) => (
          <option key={version.id} value={version.id}>
            v{version.version} — {version.editorName}
          </option>
        ))}
      </Select>

      <p className="text-xs text-fg-subtle">
        The current text is kept as a new version, and the section is marked incomplete so you can
        read it through before saying it is done.
      </p>

      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}

      <div className="flex gap-2">
        <Restore />
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Restore() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" variant="secondary" loading={pending} disabled={pending}>
      Restore
    </Button>
  );
}
