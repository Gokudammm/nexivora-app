"use client";

import { useRouter } from "next/navigation";

import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { startThread } from "@/lib/workspace/discussion";

import { ActionForm } from "./action-form";

/**
 * Start a thread.
 *
 * The kind is chosen up front rather than inferred, because it changes what the
 * thread *does*: a QUESTION and a BLOCKER can be resolved, a DECISION is what
 * the group will search for later, and GENERAL is neither. Asking once is
 * cheaper than guessing wrong forever.
 */
export function NewThreadForm({ groupId }: { groupId: string }) {
  const router = useRouter();

  return (
    <ActionForm
      action={startThread}
      hidden={{ groupId }}
      submitLabel="Post thread"
      quiet
      onDone={(result) => {
        if (result.ok && result.id) router.push(`/groups/${groupId}/discussion/${result.id}`);
      }}
    >
      <Field label="Kind">
        <Select name="kind" defaultValue="GENERAL">
          <option value="GENERAL">General</option>
          <option value="QUESTION">Question — can be resolved</option>
          <option value="DECISION">Decision — recorded for later</option>
          <option value="BLOCKER">Blocker — something is stuck</option>
        </Select>
      </Field>

      <Field label="Title" required>
        <Input name="title" required maxLength={160} placeholder="Which sensor for the pilot?" />
      </Field>

      <Field label="Body" required hint="Markdown works.">
        <Textarea name="body" rows={5} required maxLength={8000} />
      </Field>
    </ActionForm>
  );
}
