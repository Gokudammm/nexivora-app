"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Avatar, Badge } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input, Select, Textarea } from "@/components/ui/input";
import {
  addProjectMember,
  removeProjectMember,
  saveProjectCover,
  saveProjectMetadata,
  saveVisibility,
  type ProjectResult,
} from "@/lib/project/actions";

/**
 * The details tab: metadata, team, cover, visibility and the IP embargo.
 *
 * Visibility and the embargo are the part worth care. Both are **explained at
 * the point of choice** rather than in a help article, because the cost of
 * getting them wrong is asymmetric: a project accidentally made public cannot
 * be un-published from somebody's browser history, and a patentable project
 * disclosed before filing cannot be patented at all.
 *
 * `PUBLIC` is deliberately absent from the group's options until faculty have
 * approved publication. The database enforces the same rule with a check
 * constraint (ADR-010); this is the half that explains it.
 */

type Member = {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  tier: string;
};

const TIER_LABEL: Record<string, string> = {
  SELF: "self-declared",
  WORKSPACE_EVIDENCED: "evidenced",
  FACULTY_ATTESTED: "attested",
};

export function ProjectDetailsForm({
  slug,
  readOnly,
  project,
  groupMembers,
  canSetVisibility,
  domains,
  topics,
  sdgs,
}: {
  slug: string;
  readOnly: boolean;
  project: {
    title: string;
    summary: string;
    abstract: string;
    domain: string;
    department: string;
    techStack: string[];
    keywords: string[];
    repositoryUrl: string | null;
    demoUrl: string | null;
    videoUrl: string | null;
    coverUrl: string | null;
    startedOn: Date;
    completedOn: Date | null;
    visibility: string;
    embargoUntil: Date | null;
    approved: boolean;
    topics: string[];
    sdgs: number[];
    primarySdg: number | null;
    members: Member[];
  };
  groupMembers: { id: string; name: string }[];
  canSetVisibility: boolean;
  domains: { key: string; label: string }[];
  topics: { slug: string; name: string }[];
  sdgs: { number: number; title: string }[];
}) {
  const [metaState, metaAction] = useActionState(saveProjectMetadata, null);
  const [selectedTopics, setTopics] = useState<string[]>(project.topics);
  const [selectedSdgs, setSdgs] = useState<number[]>(project.sdgs);
  const [primary, setPrimary] = useState<number | null>(project.primarySdg);

  const iso = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : "");

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="grid content-start gap-8 lg:col-span-2">
        {/* --------------------------------------------------- metadata */}

        <form action={metaAction} className="grid gap-4">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="topics" value={selectedTopics.join(",")} />
          <input type="hidden" name="sdgs" value={selectedSdgs.join(",")} />
          <input type="hidden" name="primarySdg" value={primary ?? ""} />

          <h2 className="font-medium">About the project</h2>

          <Field label="Title" required>
            <Input
              name="title"
              required
              maxLength={160}
              defaultValue={project.title}
              readOnly={readOnly}
            />
          </Field>

          <Field
            label="One-line summary"
            required
            hint="Used in cards, listings and search results."
          >
            <Input
              name="summary"
              required
              maxLength={240}
              defaultValue={project.summary}
              readOnly={readOnly}
            />
          </Field>

          <Field
            label="Abstract"
            hint="Two or three sentences. This is what a reader sees first, and what an embargoed project shows instead of its body."
          >
            <Textarea
              name="abstract"
              rows={4}
              maxLength={2000}
              defaultValue={project.abstract}
              readOnly={readOnly}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Domain" required>
              <Select name="domain" defaultValue={project.domain} disabled={readOnly}>
                {domains.map((domain) => (
                  <option key={domain.key} value={domain.key}>
                    {domain.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Department">
              <Input
                name="department"
                maxLength={120}
                defaultValue={project.department}
                readOnly={readOnly}
              />
            </Field>
          </div>

          <Field label="Tech stack" hint="Comma separated. What you actually used.">
            <Input
              name="techStack"
              defaultValue={project.techStack.join(", ")}
              placeholder="Python, ESP32, LoRaWAN"
              readOnly={readOnly}
            />
          </Field>

          <Field label="Keywords" hint="Comma separated. What somebody would search for.">
            <Input name="keywords" defaultValue={project.keywords.join(", ")} readOnly={readOnly} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Started">
              <Input
                name="startedOn"
                type="date"
                defaultValue={iso(project.startedOn)}
                readOnly={readOnly}
              />
            </Field>
            <Field label="Completed">
              <Input
                name="completedOn"
                type="date"
                defaultValue={iso(project.completedOn)}
                readOnly={readOnly}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ["repositoryUrl", "Repository", project.repositoryUrl],
                ["demoUrl", "Live demo", project.demoUrl],
                ["videoUrl", "Video", project.videoUrl],
              ] as const
            ).map(([name, label, value]) => (
              <Field key={name} label={label}>
                <Input
                  name={name}
                  type="url"
                  maxLength={300}
                  defaultValue={value ?? ""}
                  placeholder="https://…"
                  readOnly={readOnly}
                />
              </Field>
            ))}
          </div>

          {/* ------------------------------------------------ taxonomy */}

          <fieldset className="grid gap-2">
            <legend className="text-sm leading-none font-medium">Topics</legend>
            <p className="text-xs text-fg-muted">
              How people find this. Three or four that genuinely apply beats ten that nearly do.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {topics.map((topic) => {
                const on = selectedTopics.includes(topic.slug);
                return (
                  <button
                    key={topic.slug}
                    type="button"
                    disabled={readOnly}
                    aria-pressed={on}
                    onClick={() =>
                      setTopics((current) =>
                        on
                          ? current.filter((entry) => entry !== topic.slug)
                          : [...current, topic.slug],
                      )
                    }
                    className={
                      on
                        ? "border-primary rounded-full border bg-primary-50 px-3 py-1 text-xs font-medium dark:bg-primary-950"
                        : "rounded-full border border-border px-3 py-1 text-xs text-fg-muted hover:text-fg"
                    }
                  >
                    {topic.name}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="text-sm leading-none font-medium">SDG alignment</legend>
            <p className="text-xs text-fg-muted">
              One primary goal, at most two genuine secondary ones. Over-tagging is why SDG
              reporting has a credibility problem — click a selected goal again to make it primary.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {sdgs.map((sdg) => {
                const on = selectedSdgs.includes(sdg.number);
                const isPrimary = primary === sdg.number;

                return (
                  <button
                    key={sdg.number}
                    type="button"
                    disabled={readOnly}
                    aria-pressed={on}
                    title={sdg.title}
                    onClick={() => {
                      if (on && !isPrimary) {
                        setPrimary(sdg.number);
                        return;
                      }
                      setSdgs((current) =>
                        on
                          ? current.filter((entry) => entry !== sdg.number)
                          : [...current, sdg.number],
                      );
                      if (isPrimary) setPrimary(null);
                    }}
                    className={
                      isPrimary
                        ? "border-accent rounded-full border bg-accent-50 px-3 py-1 text-xs font-medium dark:bg-accent-950"
                        : on
                          ? "border-primary rounded-full border bg-primary-50 px-3 py-1 text-xs dark:bg-primary-950"
                          : "rounded-full border border-border px-3 py-1 text-xs text-fg-muted hover:text-fg"
                    }
                  >
                    {sdg.number}
                    {isPrimary ? " ★" : ""}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {metaState && !metaState.ok ? <Alert tone="danger">{metaState.error}</Alert> : null}
          {metaState?.ok ? <Alert tone="success">{metaState.message}</Alert> : null}

          {readOnly ? null : <Save label="Save details" />}
        </form>

        {/* ------------------------------------------------------- team */}

        <section className="grid gap-4">
          <div className="grid gap-1">
            <h2 className="font-medium">Team</h2>
            <p className="text-xs text-fg-muted">
              Credited members and what each of them did. Only people in the owning group can be
              credited — the ledger that backs an &ldquo;evidenced&rdquo; claim only exists for
              them.
            </p>
          </div>

          <ul className="grid divide-y divide-border rounded-xl border border-border">
            {project.members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar name={member.name} src={member.avatarUrl} seed={member.id} size="sm" />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{member.name}</span>
                  <span className="text-fg-muted"> — {member.role}</span>
                </span>
                <Badge tone={member.tier === "SELF" ? "neutral" : "accent"}>
                  {TIER_LABEL[member.tier] ?? member.tier}
                </Badge>
                {readOnly ? null : (
                  <MemberAction
                    action={removeProjectMember}
                    hidden={{ slug, userId: member.id }}
                    label="Remove"
                  />
                )}
              </li>
            ))}
          </ul>

          {readOnly ? null : (
            <AddMember
              slug={slug}
              candidates={groupMembers.filter(
                (candidate) => !project.members.some((member) => member.id === candidate.id),
              )}
            />
          )}
        </section>
      </div>

      {/* ------------------------------------------------------ sidebar */}

      <aside className="grid content-start gap-6">
        <section className="grid gap-3 rounded-xl border border-border p-5">
          <h2 className="font-medium">Cover image</h2>
          <p className="text-xs text-fg-muted">
            Optional. Without one, a deterministic mark is drawn from the project&rsquo;s slug —
            never a grey rectangle.
          </p>
          <ImageUpload
            action={saveProjectCover}
            hidden={{ slug }}
            currentUrl={project.coverUrl}
            name={project.title}
            label="Cover"
            shape="square"
          />
        </section>

        <VisibilityControl
          slug={slug}
          visibility={project.visibility}
          embargoUntil={project.embargoUntil}
          approved={project.approved}
          canSet={canSetVisibility && !readOnly}
        />
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------- visibility */

function VisibilityControl({
  slug,
  visibility,
  embargoUntil,
  approved,
  canSet,
}: {
  slug: string;
  visibility: string;
  embargoUntil: Date | null;
  approved: boolean;
  canSet: boolean;
}) {
  const [state, formAction] = useActionState(saveVisibility, null);

  const LEVELS = [
    { value: "PRIVATE", label: "Private", note: "Only people credited on the project." },
    {
      value: "GROUP",
      label: "The group",
      note: "Everyone in the owning group, plus your faculty guide.",
    },
    { value: "CLASS", label: "The class", note: "Everyone enrolled in the same class." },
    { value: "COLLEGE", label: "The college", note: "Any verified member of your college." },
    {
      value: "PUBLIC",
      label: "Public",
      note: "Anyone on the internet, and indexable by search engines. Needs faculty approval.",
    },
  ];

  return (
    <section className="grid gap-3 rounded-xl border border-border p-5">
      <h2 className="font-medium">Who can see this</h2>

      <form action={formAction} className="grid gap-3">
        <input type="hidden" name="slug" value={slug} />

        <div className="grid gap-2">
          {LEVELS.map((level) => {
            const blocked = level.value === "PUBLIC" && !approved;

            return (
              <label
                key={level.value}
                className={
                  blocked
                    ? "grid cursor-not-allowed gap-0.5 rounded-lg border border-border p-3 opacity-60"
                    : "has-[:checked]:border-primary grid cursor-pointer gap-0.5 rounded-lg border border-border p-3 has-[:checked]:bg-primary-50 dark:has-[:checked]:bg-primary-950"
                }
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="radio"
                    name="visibility"
                    value={level.value}
                    defaultChecked={visibility === level.value}
                    disabled={!canSet || blocked}
                    className="size-4"
                  />
                  {level.label}
                </span>
                <span className="pl-6 text-xs text-fg-muted">{level.note}</span>
              </label>
            );
          })}
        </div>

        <Field
          label="Embargo until"
          hint="An embargoed project shows its title, team and abstract — and withholds everything else until this date. The work can be cited without being disclosed."
        >
          <Input
            name="embargoUntil"
            type="date"
            defaultValue={embargoUntil ? embargoUntil.toISOString().slice(0, 10) : ""}
            disabled={!canSet}
          />
        </Field>

        <p className="text-xs text-fg-subtle">
          Filing a patent? Do not publish before you file.{" "}
          <Link href="/legal/ip-policy" className="underline underline-offset-4 hover:text-fg">
            Read the IP policy
          </Link>
          .
        </p>

        {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
        {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}

        {canSet ? <Save label="Save visibility" /> : null}
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ bits */

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <div>
      <Button type="submit" loading={pending} disabled={pending}>
        {label}
      </Button>
    </div>
  );
}

function AddMember({
  slug,
  candidates,
}: {
  slug: string;
  candidates: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(addProjectMember, null);

  if (candidates.length === 0) {
    return (
      <p className="text-xs text-fg-subtle">
        Everyone in the group is credited. Add somebody to the group first to credit them here.
      </p>
    );
  }

  return (
    <form
      action={formAction}
      className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
    >
      <input type="hidden" name="slug" value={slug} />

      <Field label="Credit somebody">
        <Select name="userId" defaultValue={candidates[0]!.id}>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="What did they do?">
        <Input name="role" required maxLength={60} placeholder="Hardware and calibration" />
      </Field>

      <Save label="Add" />

      {state && !state.ok ? (
        <div className="sm:col-span-3">
          <Alert tone="danger">{state.error}</Alert>
        </div>
      ) : null}
    </form>
  );
}

function MemberAction({
  action,
  hidden,
  label,
}: {
  action: (previous: ProjectResult | null, formData: FormData) => Promise<ProjectResult>;
  hidden: Record<string, string>;
  label: string;
}) {
  const [, formAction] = useActionState(action, null);

  return (
    <form action={formAction}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" variant="ghost" size="sm">
        {label}
      </Button>
    </form>
  );
}
