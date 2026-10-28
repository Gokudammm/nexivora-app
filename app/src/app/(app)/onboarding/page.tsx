import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { ROLE_BY_ENUM } from "@/config/roles";
import { requireAuth } from "@/lib/auth/guards";
import {
  getOnboarding,
  goBackOnboarding,
  saveOnboardingStep,
  skipOnboarding,
} from "@/lib/auth/onboarding";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Set up your account",
  description:
    "A few questions to set up your Nexivora profile so your college, your classes and your teammates can find you.",
  index: false,
  path: "/onboarding",
});

/**
 * The onboarding wizard.
 *
 * One route rather than `/onboarding/[step]`: the current step lives in the
 * database, so a URL per step would be a second source of truth for where
 * somebody is — and the two would disagree the moment anyone used the back
 * button. This way the wizard resumes correctly from any device.
 *
 * Every step is skippable. Onboarding that cannot be skipped gets filled with
 * nonsense, and nonsense in a profile is worse than a blank one.
 */
export default async function OnboardingPage() {
  await requireAuth("/onboarding");

  const state = await getOnboarding();
  if (!state) redirect("/dashboard");
  if (state.completed) redirect("/dashboard");

  const choice = ROLE_BY_ENUM[state.role];
  const step = STEPS[state.step];
  const total = state.steps.length;

  if (!step) redirect("/dashboard");

  return (
    <div className="mx-auto grid w-full max-w-xl gap-8">
      <header className="grid gap-3">
        <p className="text-sm font-medium text-fg-muted">
          Step {state.stepIndex + 1} of {total} · {choice?.label}
        </p>
        <Progress value={((state.stepIndex + 1) / total) * 100} />
        <h1 className="text-2xl font-semibold tracking-tight">{step.title}</h1>
        <p className="text-fg-muted">{step.blurb}</p>
      </header>

      <form action={saveOnboardingStep} className="grid gap-5">
        {step.fields.map((field) => (
          <Field key={field.name} label={field.label} hint={field.hint}>
            {field.multiline ? (
              <Textarea
                name={field.name}
                rows={3}
                defaultValue={String(state.data[field.name] ?? "")}
                placeholder={field.placeholder}
              />
            ) : (
              <Input
                name={field.name}
                defaultValue={String(state.data[field.name] ?? "")}
                placeholder={field.placeholder}
              />
            )}
          </Field>
        ))}

        <div className="flex items-center gap-3">
          <Button type="submit" size="lg">
            {state.stepIndex + 1 === total ? "Finish" : "Continue"}
          </Button>

          {state.stepIndex > 0 ? (
            <Button type="submit" variant="ghost" formAction={goBackOnboarding}>
              Back
            </Button>
          ) : null}

          <Button type="submit" variant="ghost" formAction={skipOnboarding} className="ml-auto">
            Skip for now
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ steps */

type StepField = {
  name: string;
  label: string;
  hint?: string;
  placeholder?: string;
  multiline?: boolean;
};

type Step = { title: string; blurb: string; fields: StepField[] };

/**
 * The steps, keyed by the identifiers in `config/roles.ts`.
 *
 * Deliberately short. Every extra question is a chance to abandon setup, and
 * almost everything here can be filled in later from the profile page — where
 * the person can see what it is for.
 */
const STEPS: Record<string, Step> = {
  college: {
    title: "Your college",
    blurb:
      "Registering on your institutional address connects you automatically. Otherwise, tell us where you are.",
    fields: [
      { name: "collegeName", label: "College", placeholder: "Nexivora Institute of Technology" },
      { name: "department", label: "Department", placeholder: "Computer Science & Engineering" },
    ],
  },
  programme: {
    title: "Your programme",
    blurb: "Used to place you in the right classes and to group your work by term.",
    fields: [
      {
        name: "programme",
        label: "Programme",
        placeholder: "B.Tech Computer Science & Engineering",
      },
      { name: "year", label: "Year of study", placeholder: "3" },
      {
        name: "rollNumber",
        label: "Roll number",
        hint: "Only visible to your college, never public.",
      },
    ],
  },
  interests: {
    title: "What are you interested in?",
    blurb: "This drives what appears in your feed and which teammates we suggest.",
    fields: [
      {
        name: "interests",
        label: "Interests",
        hint: "A few words, separated by commas.",
        placeholder: "embedded systems, water, accessibility",
        multiline: true,
      },
    ],
  },
  skills: {
    title: "What can you do?",
    blurb:
      "Claim what you know. As you finish projects, these gain evidence behind them — and that is what makes the profile worth anything.",
    fields: [
      {
        name: "skills",
        label: "Skills",
        hint: "Separated by commas. Nothing here is verified yet, and the profile says so.",
        placeholder: "Python, PCB design, technical writing",
        multiline: true,
      },
    ],
  },
  department: {
    title: "Your department",
    blurb: "Where you teach, so your classes and your students can find you.",
    fields: [
      { name: "department", label: "Department", placeholder: "Electronics & Communication" },
      { name: "designation", label: "Designation", placeholder: "Associate Professor" },
    ],
  },
  subjects: {
    title: "What do you teach?",
    blurb:
      "Your subjects decide which projects you supervise, approve and evaluate. This is the scope of everything you can see.",
    fields: [
      {
        name: "subjects",
        label: "Subjects",
        hint: "Separated by commas.",
        placeholder: "Embedded Systems, Signal Processing",
        multiline: true,
      },
    ],
  },
  expertise: {
    title: "Your expertise",
    blurb: "Shown on your profile and used to match you with students looking for a guide.",
    fields: [
      {
        name: "expertise",
        label: "Areas of expertise",
        multiline: true,
        placeholder: "low-power sensing, calibration",
      },
      { name: "officeHours", label: "Office hours", placeholder: "Thursdays, 15:00–17:00" },
    ],
  },
  graduation: {
    title: "When did you graduate?",
    blurb:
      "Your project archive stays with you. Graduating changes your access, never your authorship.",
    fields: [
      { name: "graduationYear", label: "Graduation year", placeholder: "2022" },
      {
        name: "programme",
        label: "Programme",
        placeholder: "B.Tech Computer Science & Engineering",
      },
    ],
  },
  work: {
    title: "Where are you now?",
    blurb: "Shown to students looking for a mentor in their field.",
    fields: [
      { name: "currentRole", label: "Role", placeholder: "Data Engineer" },
      { name: "organisation", label: "Organisation", placeholder: "HydroSense Systems" },
    ],
  },
  mentorship: {
    title: "Would you mentor?",
    blurb:
      "Entirely optional, and you set the limit. A specific goal from a student beats a general request, so we ask them for one.",
    fields: [
      { name: "mentorshipCapacity", label: "How many students at a time?", placeholder: "2" },
    ],
  },
  organisation: {
    title: "About your organisation",
    blurb: "Students see this before they see a role, so it is worth writing properly.",
    fields: [
      { name: "website", label: "Website", placeholder: "https://example.com" },
      { name: "description", label: "What you do", multiline: true },
    ],
  },
  focus: {
    title: "What do you hire for?",
    blurb:
      "Used to surface students whose actual project work is relevant — not to match keywords on a CV.",
    fields: [
      {
        name: "focusAreas",
        label: "Focus areas",
        multiline: true,
        placeholder: "embedded, data engineering",
      },
    ],
  },
  verification: {
    title: "Verification",
    blurb:
      "Verification is manual and deliberate. Until it completes you can set everything up, but you cannot post an opportunity or contact a student — which is what keeps fake listings off the platform.",
    fields: [
      {
        name: "verificationNote",
        label: "Anything that helps us verify you",
        multiline: true,
        placeholder: "Registration number, a domain we can check, a contact who can confirm.",
      },
    ],
  },
  domains: {
    title: "Your email domains",
    blurb:
      "Anyone registering on these addresses is associated with your college automatically. This is the trust gate the whole network depends on.",
    fields: [
      {
        name: "emailDomains",
        label: "Domains",
        hint: "Separated by commas.",
        placeholder: "nit.edu.in, alumni.nit.edu.in",
      },
    ],
  },
  affiliation: {
    title: "Your affiliation",
    blurb: "Where you research, so collaborators know who they are working with.",
    fields: [
      {
        name: "affiliation",
        label: "Institution or lab",
        placeholder: "Centre for Applied Water Research",
      },
      { name: "orcid", label: "ORCID", placeholder: "0000-0000-0000-0000" },
    ],
  },
  field: {
    title: "Your field",
    blurb: "Used to surface student work worth building on.",
    fields: [{ name: "field", label: "Field", placeholder: "Hydrology" }],
  },
};
