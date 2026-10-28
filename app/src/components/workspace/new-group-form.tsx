"use client";

import { useRouter } from "next/navigation";

import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { createGroup } from "@/lib/workspace/actions";

import { ActionForm } from "./action-form";

/**
 * Create a group.
 *
 * The two settings people get wrong are visibility and join policy, so both
 * carry a plain-language hint rather than a label alone. `GROUP` and `REQUEST`
 * are the defaults because they are the safe pair: nothing leaks, and a
 * classmate who wants in has a route that does not depend on catching the lead
 * in the corridor.
 */
export function NewGroupForm({ classes }: { classes: { id: string; label: string }[] }) {
  const router = useRouter();

  return (
    <ActionForm
      action={createGroup}
      submitLabel="Create group"
      quiet
      onDone={(result) => {
        if (result.ok && result.id) router.push(`/groups/${result.id}`);
      }}
    >
      <Field label="Class" required hint="A group belongs to one class, and this cannot change.">
        <Select name="classId" required defaultValue={classes[0]?.id}>
          {classes.map((klass) => (
            <option key={klass.id} value={klass.id}>
              {klass.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Name" required>
        <Input name="name" required maxLength={80} placeholder="Soil moisture sensing" />
      </Field>

      <Field label="What is it for?" hint="One line. You can change it later.">
        <Textarea
          name="description"
          rows={2}
          maxLength={500}
          placeholder="Final-year project on low-cost irrigation monitoring."
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Size limit" hint="Including you.">
          <Input name="sizeLimit" type="number" min={2} max={12} defaultValue={5} />
        </Field>

        <Field
          label="Who can see this group exists"
          hint="Only members ever see inside it. This is about the group being listed."
        >
          <Select name="visibility" defaultValue="GROUP">
            <option value="GROUP">Members only</option>
            <option value="CLASS">The class</option>
            <option value="COLLEGE">The college</option>
            <option value="PRIVATE">Nobody — completely hidden</option>
          </Select>
        </Field>
      </div>

      <Field label="How people join" hint="You can invite by username or email whichever you pick.">
        <Select name="joinPolicy" defaultValue="REQUEST">
          <option value="REQUEST">Ask the lead</option>
          <option value="OPEN">Anyone in the class can join</option>
          <option value="INVITE_ONLY">Invitation only</option>
        </Select>
      </Field>
    </ActionForm>
  );
}
