"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Checkbox, Input, Textarea } from "@/components/ui/input";
import {
  changeUsername,
  saveAlumniProfile,
  saveBasics,
  saveFacultyProfile,
  saveLinks,
  saveSkills,
  saveStudentProfile,
  type ProfileResult,
} from "@/lib/profile/actions";

/**
 * The profile forms.
 *
 * One shell, several field sets — the same reasoning as the admin console's
 * `ResourceForm`. Each form saves independently rather than there being one
 * enormous save button: a person who edits their headline should not have to
 * re-submit their skills, and a validation error in one section should not
 * discard work in another.
 */

function Shell({
  action,
  submitLabel,
  children,
}: {
  action: (previous: ProfileResult | null, formData: FormData) => Promise<ProfileResult>;
  submitLabel: string;
  children: (state: ProfileResult | null) => React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}

      {children(state)}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

const fieldError = (state: ProfileResult | null, name: string) =>
  state && !state.ok && state.field === name ? state.error : undefined;

/* ---------------------------------------------------------------- basics */

export function BasicsForm({
  profile,
}: {
  profile: {
    name: string;
    headline: string | null;
    bio: string | null;
    pronouns: string | null;
    location: string | null;
  };
}) {
  return (
    <Shell action={saveBasics} submitLabel="Save">
      {(state) => (
        <>
          <Field label="Display name" error={fieldError(state, "name")}>
            <Input name="name" defaultValue={profile.name} required />
          </Field>

          <Field
            label="Headline"
            hint="One line on what you actually work on. It is the first thing anyone reads."
          >
            <Input
              name="headline"
              defaultValue={profile.headline ?? ""}
              maxLength={120}
              placeholder="Third-year, building things that work offline first"
            />
          </Field>

          <Field label="Bio" hint="A short paragraph. What you are interested in, and why.">
            <Textarea name="bio" rows={4} defaultValue={profile.bio ?? ""} maxLength={2000} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Pronouns">
              <Input name="pronouns" defaultValue={profile.pronouns ?? ""} placeholder="she/her" />
            </Field>

            <Field label="Location">
              <Input
                name="location"
                defaultValue={profile.location ?? ""}
                placeholder="Bengaluru"
              />
            </Field>
          </div>
        </>
      )}
    </Shell>
  );
}

/* -------------------------------------------------------------- username */

export function UsernameForm({ username }: { username: string }) {
  return (
    <Shell action={changeUsername} submitLabel="Change username">
      {(state) => (
        <Field
          label="Username"
          error={fieldError(state, "username")}
          hint="Lowercase letters, numbers and hyphens. This is your public URL."
        >
          <div className="flex items-center gap-1">
            <span className="text-sm text-fg-subtle">/p/</span>
            <Input name="username" defaultValue={username} required />
          </div>
        </Field>
      )}
    </Shell>
  );
}

/* ---------------------------------------------------------------- skills */

export function SkillsForm({
  skills,
}: {
  skills: Array<{ source: string; skill: { name: string } }>;
}) {
  // Only the claimed ones are editable here. An evidenced skill comes from
  // projects and an attested one from a faculty signature — neither is the
  // owner's to type in or delete.
  const editable = skills.filter((entry) => entry.source !== "ATTESTED");
  const attested = skills.filter((entry) => entry.source === "ATTESTED");

  return (
    <Shell action={saveSkills} submitLabel="Save skills">
      {() => (
        <>
          <Field
            label="Skills"
            hint="Separated by commas. Anything your finished projects back up is promoted to evidenced automatically."
          >
            <Textarea
              name="skills"
              rows={3}
              defaultValue={editable.map((entry) => entry.skill.name).join(", ")}
              placeholder="Python, PCB design, technical writing"
            />
          </Field>

          {attested.length > 0 ? (
            <Alert tone="info" title="Attested skills are not editable here">
              {attested.map((entry) => entry.skill.name).join(", ")} — a faculty member signed for
              these, so only they can withdraw them.
            </Alert>
          ) : null}
        </>
      )}
    </Shell>
  );
}

/* ----------------------------------------------------------------- links */

export function LinksForm({ links }: { links: Array<{ id: string; label: string; url: string }> }) {
  const [rows, setRows] = useState(() =>
    links.length > 0 ? links : [{ id: "new-0", label: "", url: "" }],
  );

  return (
    <Shell action={saveLinks} submitLabel="Save links">
      {() => (
        <>
          <div className="grid gap-3">
            {rows.map((row, index) => (
              <div key={row.id} className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                <Field label={index === 0 ? "Label" : ""} labelHidden={index > 0}>
                  <Input name="linkLabel" defaultValue={row.label} placeholder="GitHub" />
                </Field>
                <Field label={index === 0 ? "URL" : ""} labelHidden={index > 0}>
                  <Input
                    name="linkUrl"
                    type="url"
                    defaultValue={row.url}
                    placeholder="https://github.com/…"
                  />
                </Field>
              </div>
            ))}
          </div>

          {rows.length < 8 ? (
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setRows((current) => [
                    ...current,
                    { id: `new-${current.length}`, label: "", url: "" },
                  ])
                }
              >
                Add another link
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------ role forms */

type RoleProfile = {
  studentProfile: {
    year: number | null;
    rollNumber: string | null;
    interests: string[];
    availableForTeams: boolean;
  } | null;
  facultyProfile: {
    designation: string | null;
    expertise: string[];
    qualifications: string[];
    researchInterests: string[];
    officeHours: string | null;
    mentorshipAvailable: boolean;
    mentorshipCapacity: number;
  } | null;
  alumniProfile: {
    graduationYear: number;
    programme: string | null;
    currentRole: string | null;
    organisation: string | null;
    industry: string | null;
    mentorshipAvailable: boolean;
    mentorshipCapacity: number;
  } | null;
};

export function RoleForm({ role, profile }: { role: string; profile: RoleProfile }) {
  if (role === "FACULTY") {
    const faculty = profile.facultyProfile;

    return (
      <Shell action={saveFacultyProfile} submitLabel="Save">
        {() => (
          <>
            <Field label="Designation">
              <Input
                name="designation"
                defaultValue={faculty?.designation ?? ""}
                placeholder="Associate Professor"
              />
            </Field>

            <Field label="Areas of expertise" hint="Separated by commas.">
              <Textarea
                name="expertise"
                rows={2}
                defaultValue={faculty?.expertise.join(", ") ?? ""}
              />
            </Field>

            <Field label="Research interests" hint="Separated by commas.">
              <Textarea
                name="researchInterests"
                rows={2}
                defaultValue={faculty?.researchInterests.join(", ") ?? ""}
              />
            </Field>

            <Field label="Qualifications" hint="Separated by commas.">
              <Input
                name="qualifications"
                defaultValue={faculty?.qualifications.join(", ") ?? ""}
              />
            </Field>

            <Field label="Office hours">
              <Input
                name="officeHours"
                defaultValue={faculty?.officeHours ?? ""}
                placeholder="Thursdays, 15:00–17:00"
              />
            </Field>

            <Checkbox
              name="mentorshipAvailable"
              defaultChecked={faculty?.mentorshipAvailable ?? false}
              label="Open to mentoring students"
            />

            <Field label="How many at a time">
              <Input
                name="mentorshipCapacity"
                type="number"
                min={0}
                max={20}
                defaultValue={faculty?.mentorshipCapacity ?? 0}
              />
            </Field>
          </>
        )}
      </Shell>
    );
  }

  if (role === "ALUMNI") {
    const alumni = profile.alumniProfile;

    return (
      <Shell action={saveAlumniProfile} submitLabel="Save">
        {(state) => (
          <>
            <Field label="Graduation year" error={fieldError(state, "graduationYear")}>
              <Input
                name="graduationYear"
                type="number"
                min={1950}
                max={2100}
                defaultValue={alumni?.graduationYear ?? ""}
                required
              />
            </Field>

            <Field label="Programme">
              <Input name="programme" defaultValue={alumni?.programme ?? ""} />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Current role">
                <Input name="currentRole" defaultValue={alumni?.currentRole ?? ""} />
              </Field>
              <Field label="Organisation">
                <Input name="organisation" defaultValue={alumni?.organisation ?? ""} />
              </Field>
            </div>

            <Checkbox
              name="mentorshipAvailable"
              defaultChecked={alumni?.mentorshipAvailable ?? false}
              label="Open to mentoring students at your college"
            />
          </>
        )}
      </Shell>
    );
  }

  const student = profile.studentProfile;

  return (
    <Shell action={saveStudentProfile} submitLabel="Save">
      {() => (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Year of study">
              <Input name="year" type="number" min={1} max={8} defaultValue={student?.year ?? ""} />
            </Field>

            <Field
              label="Roll number"
              hint="Private unless you turn it on, and never shown to the open internet."
            >
              <Input name="rollNumber" defaultValue={student?.rollNumber ?? ""} />
            </Field>
          </div>

          <Field
            label="Interests"
            hint="Separated by commas. Drives your feed and teammate suggestions."
          >
            <Textarea
              name="interests"
              rows={2}
              defaultValue={student?.interests.join(", ") ?? ""}
              placeholder="embedded systems, water, accessibility"
            />
          </Field>

          <Checkbox
            name="availableForTeams"
            defaultChecked={student?.availableForTeams ?? true}
            label="Open to joining a team"
          />
        </>
      )}
    </Shell>
  );
}
