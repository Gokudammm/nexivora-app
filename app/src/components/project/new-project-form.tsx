"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";
import { createProject } from "@/lib/project/actions";

/**
 * Create a project.
 *
 * Four fields, deliberately. Everything else — abstract, tech stack, SDGs,
 * topics, dates — is on the details tab once the project exists, because a
 * twenty-field form at the moment of starting something is how people decide
 * not to start it.
 */
export function NewProjectForm({
  groups,
  domains,
}: {
  groups: { id: string; label: string; projectCount: number }[];
  domains: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    async (previous: Awaited<ReturnType<typeof createProject>> | null, formData: FormData) => {
      const result = await createProject(previous, formData);
      if (result.ok && result.slug) router.push(`/projects/${result.slug}/edit`);
      return result;
    },
    null,
  );

  return (
    <form action={formAction} className="grid gap-4">
      <Field
        label="Group"
        required
        hint="A project belongs to one group, and this cannot change afterwards."
      >
        <Select name="groupId" required defaultValue={groups[0]?.id}>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.label}
              {group.projectCount > 0
                ? ` (${group.projectCount} project${group.projectCount === 1 ? "" : "s"})`
                : ""}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Title" required hint="You can rename it later; the URL stays as first set.">
        <Input
          name="title"
          required
          minLength={4}
          maxLength={160}
          placeholder="Scheduling canal water across multiple farms"
        />
      </Field>

      <Field label="One-line summary" required hint="What it is, for somebody who has ten seconds.">
        <Input
          name="summary"
          required
          minLength={10}
          maxLength={240}
          placeholder="Reallocating unused irrigation turns within a rotation block."
        />
      </Field>

      <Field label="Domain" required>
        <Select name="domain" required defaultValue={domains[0]?.key}>
          {domains.map((domain) => (
            <option key={domain.key} value={domain.key}>
              {domain.label}
            </option>
          ))}
        </Select>
      </Field>

      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}

      <Create />

      <p className="text-xs text-fg-subtle">
        Nine empty sections are created with it, each with a prompt explaining what belongs in it.
        The blank page is the hard part, not the writing.
      </p>
    </form>
  );
}

function Create() {
  const { pending } = useFormStatus();

  return (
    <div>
      <Button type="submit" loading={pending} disabled={pending}>
        Create project
      </Button>
    </div>
  );
}
