"use client";

import { useActionState, useState, useTransition } from "react";

import { PlusIcon, TrashIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/display";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { SCORE_MAX, validateRubric, versionNotice } from "@/lib/evaluation/rubric";
import { archiveRubric, saveRubric } from "@/lib/evaluation/actions";
import { cn } from "@/lib/utils/cn";

/**
 * Build and version rubrics.
 *
 * The weight total is shown live and the save button is disabled until it
 * reaches 100 — a rubric summing to 94 has a maximum achievable mark of 94, and
 * nobody notices until two students compare totals. Validating on submit alone
 * would let somebody build the whole thing before being told.
 *
 * Templates exist for the same reason Phase 8's section prompts do: a faculty
 * member facing an empty builder writes four vague criteria and moves on; one
 * starting from a template edits it, which produces a better rubric in less
 * time.
 */

type Criterion = { id?: string; name: string; weight: number; descriptors: string[] };

type Rubric = {
  id: string;
  name: string;
  version: number;
  subjectId: string | null;
  subjectLabel: string | null;
  creatorName: string;
  evaluationCount: number;
  criteria: Criterion[];
};

type Template = {
  key: string;
  name: string;
  description: string;
  criteria: { name: string; weight: number; descriptors: string[] }[];
};

export function RubricManager({
  collegeId,
  subjects,
  templates,
  rubrics,
}: {
  collegeId: string;
  subjects: { id: string; name: string; code: string }[];
  templates: Template[];
  rubrics: Rubric[];
}) {
  const [editing, setEditing] = useState<Rubric | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h2 className="font-medium">Rubrics</h2>
          <p className="text-sm text-fg-muted">
            {rubrics.length === 0
              ? "None yet. A rubric is what makes a mark explainable."
              : `${rubrics.length} available to you.`}
          </p>
        </div>

        {creating || editing ? null : (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
          >
            <PlusIcon />
            New rubric
          </Button>
        )}
      </div>

      {creating || editing ? (
        <RubricForm
          collegeId={collegeId}
          subjects={subjects}
          templates={templates}
          rubric={editing}
          onDone={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      ) : rubrics.length === 0 ? (
        <EmptyState
          title="No rubrics yet"
          description="Named criteria with weights that sum to 100, and a descriptor per level so two markers mean the same thing by a 4. Start from a template — editing one produces a better rubric than facing a blank builder."
          action={<Button onClick={() => setCreating(true)}>Create one</Button>}
        />
      ) : (
        <ul className="grid gap-3">
          {rubrics.map((rubric) => (
            <li key={rubric.id} className="grid gap-3 rounded-xl border border-border p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-1">
                  <h3 className="flex flex-wrap items-center gap-2 font-medium">
                    {rubric.name}
                    <Badge tone="outline">v{rubric.version}</Badge>
                    {rubric.evaluationCount > 0 ? (
                      <Badge tone="neutral">
                        used in {rubric.evaluationCount}{" "}
                        {rubric.evaluationCount === 1 ? "evaluation" : "evaluations"}
                      </Badge>
                    ) : null}
                  </h3>
                  <p className="text-xs text-fg-muted">
                    {rubric.subjectLabel ?? "Available to every subject"} · created by{" "}
                    {rubric.creatorName}
                  </p>
                </div>

                <div className="flex gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(rubric)}>
                    {rubric.evaluationCount > 0 ? "New version" : "Edit"}
                  </Button>
                  <ArchiveButton rubricId={rubric.id} name={rubric.name} />
                </div>
              </div>

              <ul className="grid gap-1">
                {rubric.criteria.map((criterion) => (
                  <li
                    key={criterion.id ?? criterion.name}
                    className="flex justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-fg-muted">{criterion.name}</span>
                    <span className="shrink-0 tabular-nums">{criterion.weight}%</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ form */

function RubricForm({
  collegeId,
  subjects,
  templates,
  rubric,
  onDone,
}: {
  collegeId: string;
  subjects: { id: string; name: string; code: string }[];
  templates: Template[];
  rubric: Rubric | null;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(saveRubric, null);
  const [name, setName] = useState(rubric?.name ?? "");
  const [subjectId, setSubjectId] = useState(rubric?.subjectId ?? "");
  const [criteria, setCriteria] = useState<Criterion[]>(
    rubric?.criteria ?? [{ name: "", weight: 100, descriptors: [] }],
  );

  const total = criteria.reduce((sum, criterion) => sum + (criterion.weight || 0), 0);
  const valid = validateRubric(name || "placeholder", criteria);
  const versioning = (rubric?.evaluationCount ?? 0) > 0;

  const update = (index: number, patch: Partial<Criterion>) =>
    setCriteria((current) =>
      current.map((criterion, i) => (i === index ? { ...criterion, ...patch } : criterion)),
    );

  if (state?.ok) {
    queueMicrotask(onDone);
  }

  return (
    <form action={formAction} className="grid gap-5 rounded-xl border border-border p-5">
      <input type="hidden" name="collegeId" value={collegeId} />
      {rubric ? <input type="hidden" name="rubricId" value={rubric.id} /> : null}
      <input type="hidden" name="criteria" value={JSON.stringify(criteria.map(toPayload))} />

      <h3 className="font-medium">{rubric ? `Edit ${rubric.name}` : "New rubric"}</h3>

      {versioning ? (
        <Alert tone="info" title="This rubric has been used to mark work">
          {versionNotice(rubric!.version)}
        </Alert>
      ) : null}

      {rubric ? null : (
        <Field label="Start from a template" hint="Optional. Editing one beats a blank builder.">
          <Select
            defaultValue=""
            onChange={(event) => {
              const template = templates.find((entry) => entry.key === event.target.value);
              if (!template) return;
              setName((current) => current || template.name);
              setCriteria(template.criteria.map((criterion) => ({ ...criterion })));
            }}
          >
            <option value="">Blank</option>
            {templates.map((template) => (
              <option key={template.key} value={template.key}>
                {template.name} — {template.description}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Name" required>
        <Input
          name="name"
          required
          maxLength={160}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Major project — final evaluation"
        />
      </Field>

      <Field
        label="Subject"
        hint="Leave blank to make it available across every subject you teach."
      >
        <Select
          name="subjectId"
          value={subjectId}
          onChange={(event) => setSubjectId(event.target.value)}
        >
          <option value="">Every subject</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.code} {subject.name}
            </option>
          ))}
        </Select>
      </Field>

      {/* ------------------------------------------------ criteria */}

      <fieldset className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <legend className="text-sm font-medium">Criteria</legend>
          <span
            className={cn("text-sm tabular-nums", total === 100 ? "text-success" : "text-warning")}
          >
            {total}% of 100
          </span>
        </div>

        {criteria.map((criterion, index) => (
          <div key={index} className="grid gap-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap gap-2">
              <Input
                aria-label={`Criterion ${index + 1} name`}
                value={criterion.name}
                maxLength={120}
                placeholder="Technical approach"
                onChange={(event) => update(index, { name: event.target.value })}
                className="min-w-40 flex-1"
              />
              <Input
                aria-label={`Criterion ${index + 1} weight`}
                type="number"
                min={1}
                max={100}
                value={criterion.weight}
                onChange={(event) => update(index, { weight: Number(event.target.value) })}
                className="w-24"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                iconOnly
                aria-label={`Remove criterion ${index + 1}`}
                onClick={() => setCriteria((current) => current.filter((_, i) => i !== index))}
              >
                <TrashIcon />
              </Button>
            </div>

            <Textarea
              aria-label={`Criterion ${index + 1} level descriptors`}
              rows={3}
              value={criterion.descriptors.join("\n")}
              placeholder={`One line per level, worst first — ${SCORE_MAX} lines.\nA descriptor is what stops two markers meaning different things by a 4.`}
              onChange={(event) => update(index, { descriptors: event.target.value.split("\n") })}
              className="text-xs"
            />
          </div>
        ))}

        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setCriteria((current) => [...current, { name: "", weight: 0, descriptors: [] }])
            }
          >
            <PlusIcon />
            Add criterion
          </Button>
        </div>
      </fieldset>

      {!valid.ok && name.length > 0 ? <Alert tone="warning">{valid.error}</Alert> : null}
      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={total !== 100 || name.trim().length < 3}>
          {versioning ? `Save as version ${rubric!.version + 1}` : "Save rubric"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

const toPayload = (criterion: Criterion) => ({
  id: criterion.id,
  name: criterion.name,
  weight: criterion.weight,
  descriptors: criterion.descriptors.filter(Boolean).join("\n"),
});

function ArchiveButton({ rubricId, name }: { rubricId: string; name: string }) {
  const [, formAction] = useActionState(archiveRubric, null);
  const [, startTransition] = useTransition();

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Archive "${name}"? Existing evaluations keep referencing it — it just stops appearing in the picker.`,
          )
        ) {
          event.preventDefault();
        } else {
          startTransition(() => {});
        }
      }}
    >
      <input type="hidden" name="rubricId" value={rubricId} />
      <Button type="submit" variant="ghost" size="sm">
        Archive
      </Button>
    </form>
  );
}
