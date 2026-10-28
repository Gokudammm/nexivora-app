"use server";

import { redirect } from "next/navigation";

import { ROLE_BY_ENUM } from "@/config/roles";
import { db } from "@/lib/db/client";

import { currentViewer } from "./session";

/**
 * The onboarding wizard's state.
 *
 * Progress lives in the database, not the session, so a closed tab or a
 * different device resumes where it left off. Answers accumulate in `data` and
 * become profile rows **only on completion** — a half-finished onboarding
 * therefore never produces a half-built profile, which is the failure that
 * makes a directory full of blank entries.
 */

export type OnboardingState = {
  role: string;
  step: string;
  stepIndex: number;
  steps: readonly string[];
  data: Record<string, unknown>;
  completed: boolean;
};

export async function getOnboarding(): Promise<OnboardingState | null> {
  const viewer = await currentViewer();
  if (!viewer.userId) return null;

  const progress = await db.onboardingProgress.findUnique({
    where: { userId: viewer.userId },
    select: { role: true, step: true, data: true, completedAt: true },
  });

  if (!progress) return null;

  const steps = ROLE_BY_ENUM[progress.role]?.steps ?? [];
  const index = steps.indexOf(progress.step);

  return {
    role: progress.role,
    step: progress.step,
    stepIndex: index < 0 ? 0 : index,
    steps,
    data: (progress.data as Record<string, unknown>) ?? {},
    completed: progress.completedAt !== null,
  };
}

/** Save this step's answers and advance. The last step completes the wizard. */
export async function saveOnboardingStep(formData: FormData): Promise<void> {
  const viewer = await currentViewer();
  if (!viewer.userId) redirect("/login");

  const progress = await db.onboardingProgress.findUnique({
    where: { userId: viewer.userId },
    select: { role: true, step: true, data: true },
  });

  if (!progress) redirect("/dashboard");

  const steps = ROLE_BY_ENUM[progress.role]?.steps ?? [];
  const current = steps.indexOf(progress.step);
  const answers = { ...((progress.data as Record<string, unknown>) ?? {}) };

  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$")) continue; // React internals
    if (typeof value !== "string") continue;
    answers[key] = value;
  }

  const nextIndex = current + 1;
  const finished = nextIndex >= steps.length;

  await db.onboardingProgress.update({
    where: { userId: viewer.userId },
    data: {
      data: answers as never,
      step: finished ? "done" : (steps[nextIndex] ?? "done"),
      completedAt: finished ? new Date() : null,
    },
  });

  // Phase 6: completion is what turns the collected answers into profile rows.
  // Deferred to here on purpose — a half-finished wizard must never produce a
  // half-built profile.
  if (finished) {
    const { applyOnboarding } = await import("@/lib/profile/actions");
    await applyOnboarding(viewer.userId);
  }

  redirect(finished ? "/dashboard" : "/onboarding");
}

/** Step back without losing what was typed. */
export async function goBackOnboarding(): Promise<void> {
  const viewer = await currentViewer();
  if (!viewer.userId) redirect("/login");

  const progress = await db.onboardingProgress.findUnique({
    where: { userId: viewer.userId },
    select: { role: true, step: true },
  });

  if (!progress) redirect("/dashboard");

  const steps = ROLE_BY_ENUM[progress.role]?.steps ?? [];
  const previous = Math.max(0, steps.indexOf(progress.step) - 1);

  await db.onboardingProgress.update({
    where: { userId: viewer.userId },
    data: { step: steps[previous] ?? "start" },
  });

  redirect("/onboarding");
}

/**
 * Skip the rest.
 *
 * Offered deliberately. Onboarding that cannot be skipped is onboarding people
 * fill with nonsense to get past, and nonsense in a profile is worse than a
 * blank one — the profile is supposed to be evidence.
 */
export async function skipOnboarding(): Promise<void> {
  const viewer = await currentViewer();
  if (!viewer.userId) redirect("/login");

  await db.onboardingProgress.updateMany({
    where: { userId: viewer.userId },
    data: { step: "done", completedAt: new Date() },
  });

  redirect("/dashboard");
}
