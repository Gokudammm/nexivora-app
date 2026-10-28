"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { savePrivacy } from "@/lib/profile/actions";

/**
 * The privacy controls.
 *
 * Every toggle carries a plain-language line saying **exactly what it exposes
 * and to whom**. That is the whole design: a switch labelled "Discoverable" is
 * not consent, because nobody can consent to something they have to guess at.
 *
 * The live preview below is the other half — it answers "what does a stranger
 * actually see" without making somebody sign out to find out.
 */

type Privacy = {
  profileVisibility: string;
  showEmail: boolean;
  showRollNumber: boolean;
  showProjects: boolean;
  showSkills: boolean;
  discoverableInSearch: boolean;
  contactableByCompany: boolean;
  inCollegeDirectory: boolean;
  showInProjectCredits: boolean;
  emailDigest: boolean;
} | null;

const VISIBILITY = [
  {
    value: "PRIVATE",
    label: "Only me",
    detail: "Nobody else can open your profile. You still appear in your own groups and projects.",
  },
  {
    value: "COLLEGE",
    label: "My college",
    detail:
      "People with an account at your college can see it. The open internet cannot, and it is not indexed.",
  },
  {
    value: "PUBLIC",
    label: "Anyone",
    detail:
      "Anyone on the internet, and search engines. This is what makes your work citable — and it is a real decision.",
  },
] as const;

const TOGGLES = [
  {
    name: "showProjects",
    label: "Show my projects",
    detail: "Your published project work appears on your profile.",
  },
  {
    name: "showSkills",
    label: "Show my skills",
    detail: "Including which projects produced each one.",
  },
  {
    name: "showEmail",
    label: "Show my email address",
    detail:
      "Only ever to people at your college — never to the open internet, whatever else is set.",
  },
  {
    name: "showRollNumber",
    label: "Show my roll number",
    detail: "Institutional data. Only to your own college, and off unless you turn it on.",
  },
  {
    name: "inCollegeDirectory",
    label: "List me in my college directory",
    detail: "Your name and headline appear on your college's public page.",
  },
  {
    name: "discoverableInSearch",
    label: "Let people find me by searching",
    detail: "Your profile can appear in search results on Nexivora.",
  },
  {
    name: "contactableByCompany",
    label: "Let verified companies contact me",
    detail:
      "Off by default. Without this, a company cannot message you at all — that is the difference between a talent platform and a spam channel.",
  },
  {
    name: "showInProjectCredits",
    label: "Credit me on projects I worked on",
    detail: "Your name appears in the team list of projects you are a member of.",
  },
  {
    name: "emailDigest",
    label: "Send me a weekly digest",
    detail: "One email a week about your groups and the people you follow.",
  },
] as const;

export function PrivacyForm({ privacy, username }: { privacy: Privacy; username: string }) {
  const [state, action, pending] = useActionState(savePrivacy, null);
  const [visibility, setVisibility] = useState(privacy?.profileVisibility ?? "COLLEGE");

  return (
    <form action={action} className="grid gap-8">
      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">{state.message}</Alert> : null}

      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold">Profile visibility</legend>

        {VISIBILITY.map((option) => (
          <label
            key={option.value}
            className="has-[:checked]:border-primary has-[:checked]:bg-bg-subtle flex cursor-pointer gap-3 rounded-lg border border-border p-4"
          >
            <input
              type="radio"
              name="profileVisibility"
              value={option.value}
              checked={visibility === option.value}
              onChange={() => setVisibility(option.value)}
              className="mt-1"
            />
            <span className="grid gap-1">
              <span className="font-medium">{option.label}</span>
              <span className="text-sm text-fg-muted">{option.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {/* The live preview. Answers "what does a stranger see" without making
          somebody sign out to find out. */}
      <div className="bg-bg-subtle rounded-lg border border-border p-4">
        <p className="text-sm font-semibold">Right now</p>
        <ul className="mt-2 grid gap-1 text-sm text-fg-muted">
          <li>
            <strong className="text-fg">A logged-out visitor:</strong>{" "}
            {visibility === "PUBLIC"
              ? "sees your profile, and search engines can index it."
              : "sees a page saying the profile is not available — it does not confirm you have an account."}
          </li>
          <li>
            <strong className="text-fg">Someone at your college:</strong>{" "}
            {visibility === "PRIVATE"
              ? "cannot see your profile."
              : "sees your profile and the fields you have turned on below."}
          </li>
          <li>
            <strong className="text-fg">Your sitemap entry:</strong>{" "}
            {visibility === "PUBLIC"
              ? "included, so your work is findable."
              : "absent — private profiles are never listed."}
          </li>
        </ul>

        {visibility === "PUBLIC" ? (
          <p className="mt-3 text-sm">
            <Link href={`/p/${username}`} className="underline underline-offset-4">
              See your public profile
            </Link>
          </p>
        ) : null}
      </div>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold">What is shown</legend>

        {TOGGLES.map((toggle) => (
          <label
            key={toggle.name}
            className="flex cursor-pointer gap-3 rounded-lg border border-border p-4"
          >
            <input
              type="checkbox"
              name={toggle.name}
              defaultChecked={Boolean(privacy?.[toggle.name])}
              className="mt-1"
            />
            <span className="grid gap-1">
              <span className="font-medium">{toggle.label}</span>
              <span className="text-sm text-fg-muted">{toggle.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save privacy settings"}
        </Button>
      </div>
    </form>
  );
}
