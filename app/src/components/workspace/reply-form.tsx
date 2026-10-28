"use client";

import { useState } from "react";

import { Field } from "@/components/ui/field";
import { Checkbox, Textarea } from "@/components/ui/input";
import { replyToThread } from "@/lib/workspace/discussion";

import { ActionForm } from "./action-form";

/**
 * Reply, and optionally mark this as the reply that settled it.
 *
 * The resolve checkbox sits on the reply rather than being a separate button on
 * the thread, because resolving without saying what resolved it leaves the next
 * person reading a closed thread with no answer in it.
 */
export function ReplyForm({
  groupId,
  threadId,
  canResolve,
  handles,
}: {
  groupId: string;
  threadId: string;
  canResolve: boolean;
  handles: string[];
}) {
  const [resolves, setResolves] = useState(false);

  return (
    <ActionForm
      action={replyToThread}
      hidden={{ groupId, threadId, resolves: resolves ? "true" : "false" }}
      submitLabel={resolves ? "Reply and resolve" : "Reply"}
      quiet
    >
      <Field
        label="Reply"
        hint={
          handles.length > 0
            ? `Mention a teammate with @${handles[0]}. Only people in this group can be mentioned.`
            : undefined
        }
      >
        <Textarea name="body" rows={4} required maxLength={8000} placeholder="Write a reply…" />
      </Field>

      {canResolve ? (
        <Checkbox
          label="This reply resolves the thread"
          description="It gets marked, so anybody reading later sees the answer rather than the argument."
          checked={resolves}
          onCheckedChange={(checked) => setResolves(checked === true)}
        />
      ) : null}
    </ActionForm>
  );
}
