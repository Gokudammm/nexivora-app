"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Avatar, Badge } from "@/components/ui/display";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { issueAttestation, revokeAttestation } from "@/lib/evaluation/attestation-actions";

/**
 * Issue and revoke attestations.
 *
 * Two things this screen does deliberately, both of them arguments the phase
 * spec makes:
 *
 * 1. **There is no bulk action and no "attest everyone above 30%".** One
 *    project, one subject, one sentence, one signature. An attestation's entire
 *    value is that a named human vouched for it, so the interface never offers
 *    a way to vouch for people in batches.
 * 2. **The draft is pre-filled and marked as a draft.** The server composes it
 *    from the ledger and it ends with a line asking to be replaced; the action
 *    refuses a submission that still contains that line. Fast to write, still
 *    impossible to submit without writing.
 *
 * Revocation lives beside the issued list rather than behind a menu, because a
 * credential you cannot find the withdrawal control for is one that gets
 * withdrawn by emailing somebody instead.
 */

type Member = {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  share: number;
  skills: string[];
  draft: string;
};

type Candidate = {
  slug: string;
  title: string;
  status: string;
  projectDraft: string;
  members: Member[];
};

type Issued = {
  id: string;
  code: string;
  subjectType: string;
  statement: string;
  issuedAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  subjectName: string | null;
  projectTitle: string;
};

export function AttestationManager({
  projects,
  issued,
}: {
  projects: Candidate[];
  issued: Issued[];
}) {
  const [slug, setSlug] = useState(projects[0]?.slug ?? "");
  /** `""` means the project as a whole; otherwise a member id. */
  const [subject, setSubject] = useState("");

  const project = projects.find((entry) => entry.slug === slug) ?? null;
  const member = project?.members.find((entry) => entry.id === subject) ?? null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid content-start gap-6">
        <header className="grid gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Attest work</h2>
          <p className="text-sm text-fg-muted">
            Your name goes on this and it is verifiable by anyone holding the code. The lines below
            come from the workspace record — what you attest is what you can personally vouch for.
          </p>
        </header>

        {projects.length === 0 ? (
          <EmptyState
            title="Nothing to attest yet"
            description="Attestations are for finished work — a project you have reviewed, or a contribution you watched somebody make. Projects appear here once they reach review."
            action={
              <Button asChild variant="secondary">
                <Link href="/faculty/submissions">See the review queue</Link>
              </Button>
            }
          />
        ) : (
          <section className="grid gap-5 rounded-xl border border-border p-5">
            <Field label="Project" required>
              <Select
                value={slug}
                onChange={(event) => {
                  setSlug(event.target.value);
                  setSubject("");
                }}
              >
                {projects.map((entry) => (
                  <option key={entry.slug} value={entry.slug}>
                    {entry.title}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="What are you attesting"
              hint="A project attestation credits everyone on it. A contribution attestation names one person — and that is the one worth more to a reader."
              required
            >
              <Select value={subject} onChange={(event) => setSubject(event.target.value)}>
                <option value="">The project as a whole</option>
                {(project?.members ?? []).map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} — {Math.round(entry.share * 100)}% of recorded activity
                  </option>
                ))}
              </Select>
            </Field>

            {member ? (
              <div className="flex items-center gap-3 rounded-lg bg-surface-sunken p-3">
                <Avatar name={member.name} src={member.avatarUrl} seed={member.id} size="sm" />
                <div className="grid min-w-0 gap-0.5 text-sm">
                  <p className="truncate font-medium">{member.name}</p>
                  <p className="truncate text-xs text-fg-muted">
                    {member.role.toLowerCase().replace(/_/g, " ")} ·{" "}
                    {member.skills.length > 0
                      ? member.skills.join(", ")
                      : "no skills evidenced yet"}
                  </p>
                </div>
              </div>
            ) : null}

            {project ? (
              <IssueForm
                // Remounting on a change of subject is what makes the draft
                // follow the selection. Patching the textarea instead would
                // silently overwrite text the faculty member had already
                // written, which is worse than losing a draft they had not.
                key={`${project.slug}:${subject}`}
                projectSlug={project.slug}
                subjectUserId={subject || null}
                draft={member ? member.draft : project.projectDraft}
                skills={member?.skills ?? []}
              />
            ) : null}
          </section>
        )}
      </div>

      <aside className="grid content-start gap-4">
        <h2 className="font-medium">
          Issued {issued.length > 0 ? <Badge tone="neutral">{issued.length}</Badge> : null}
        </h2>

        {issued.length === 0 ? (
          <p className="text-sm text-fg-subtle">
            Nothing yet. Each one you issue appears here with its verification code.
          </p>
        ) : (
          <ul className="grid gap-3">
            {issued.map((attestation) => (
              <IssuedCard key={attestation.id} attestation={attestation} />
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

/* ----------------------------------------------------------------- issuing */

function IssueForm({
  projectSlug,
  subjectUserId,
  draft,
  skills,
}: {
  projectSlug: string;
  subjectUserId: string | null;
  draft: string;
  skills: string[];
}) {
  const [state, formAction] = useActionState(issueAttestation, null);
  const [statement, setStatement] = useState(draft);

  const untouched = statement.trim() === draft.trim();

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="projectSlug" value={projectSlug} />
      <input type="hidden" name="subjectType" value={subjectUserId ? "contribution" : "project"} />
      {subjectUserId ? <input type="hidden" name="subjectUserId" value={subjectUserId} /> : null}

      <Field
        label="Your attestation"
        required
        error={state && !state.ok && state.field === "statement" ? state.error : undefined}
        hint="Everything above the dashed line is what the record shows. The last paragraph is a prompt — replace it."
      >
        <Textarea
          name="statement"
          rows={10}
          required
          maxLength={2000}
          value={statement}
          onChange={(event) => setStatement(event.target.value)}
          className="text-sm"
        />
      </Field>

      {untouched ? (
        <Alert tone="warning" title="This is still the draft">
          It will be refused as submitted. The counts are a starting point; an attestation is the
          part only you can write — what you saw, and what you would say if somebody rang you about
          it.
        </Alert>
      ) : null}

      {subjectUserId ? (
        <Field
          label="Skills you are vouching for"
          hint="Comma-separated. These become attested on their profile rather than inferred — the difference a reader actually cares about."
        >
          <Input
            name="skills"
            defaultValue={skills.slice(0, 4).join(", ")}
            maxLength={300}
            placeholder="PyTorch, signal processing"
          />
        </Field>
      ) : null}

      {state && !state.ok && !state.field ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.ok ? (
        <Alert tone="success" title="Attested">
          {state.message}
        </Alert>
      ) : null}

      <Submit label={subjectUserId ? "Attest this contribution" : "Attest this project"} />

      <p className="text-xs text-fg-subtle">
        A verification code is printed on issue. Anyone can check it at{" "}
        <code className="font-mono">/verify</code> without an account — which is what makes it worth
        putting on a CV.
      </p>
    </form>
  );
}

/* --------------------------------------------------------------- the list */

function IssuedCard({ attestation }: { attestation: Issued }) {
  const [revoking, setRevoking] = useState(false);

  return (
    <li className="grid gap-2 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <code className="font-mono text-xs tracking-tight">{attestation.code}</code>
        {attestation.revokedAt ? (
          <Badge tone="danger">revoked</Badge>
        ) : (
          <Badge tone="success">valid</Badge>
        )}
      </div>

      <p className="text-sm font-medium">
        {attestation.subjectName ?? attestation.projectTitle}
        {attestation.subjectName ? (
          <span className="font-normal text-fg-muted"> · {attestation.projectTitle}</span>
        ) : null}
      </p>

      <p className="line-clamp-3 text-xs text-fg-muted">{attestation.statement}</p>

      <p className="text-xs text-fg-subtle">
        <time dateTime={attestation.issuedAt.toISOString()}>
          {attestation.issuedAt.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </time>
      </p>

      {attestation.revokedAt ? (
        <p className="text-xs text-danger">
          Revoked {attestation.revokedAt.toLocaleDateString("en-IN", { dateStyle: "medium" })} —{" "}
          {attestation.revokedReason}
        </p>
      ) : revoking ? (
        <RevokeForm attestationId={attestation.id} onCancel={() => setRevoking(false)} />
      ) : (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setRevoking(true)}>
            Revoke
          </Button>
        </div>
      )}
    </li>
  );
}

function RevokeForm({ attestationId, onCancel }: { attestationId: string; onCancel: () => void }) {
  const [state, formAction] = useActionState(revokeAttestation, null);

  return (
    <form action={formAction} className="grid gap-2 border-t border-border pt-3">
      <input type="hidden" name="attestationId" value={attestationId} />

      <Field
        label="Why"
        hint="The record is kept rather than deleted, so this is what makes it readable later."
        error={state && !state.ok ? state.error : undefined}
        required
      >
        <Textarea name="reason" rows={2} required maxLength={1000} className="text-xs" />
      </Field>

      <div className="flex gap-2">
        <Submit label="Revoke" size="sm" variant="danger" />
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Submit({
  label,
  size = "md",
  variant,
}: {
  label: string;
  size?: "sm" | "md";
  variant?: "danger";
}) {
  const { pending } = useFormStatus();

  return (
    <div>
      <Button type="submit" size={size} variant={variant} loading={pending} disabled={pending}>
        {label}
      </Button>
    </div>
  );
}
