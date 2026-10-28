"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { currentViewer } from "@/lib/auth/session";
import {
  checkUsername,
  normaliseUsername,
  usernameIsChangeable,
  usernameLockDate,
} from "@/config/reserved-usernames";
import { db } from "@/lib/db/client";
import { inferSkills, skillSlug, type ProjectEvidence } from "@/lib/skills/infer";
import { forgetImage, storeImage } from "@/lib/storage/images";

/**
 * Profile editing.
 *
 * Two things here are more consequential than they look.
 *
 * **The username.** It is a public URL that other people cite, so it is
 * changeable for thirty days and then fixed. Both halves matter: locking it
 * immediately makes a signup typo permanent, and never locking it makes every
 * link to a profile provisional.
 *
 * **Privacy defaults.** Every toggle starts at the most private useful setting,
 * and this module never widens one implicitly. A student who discovers their
 * roll number was public will not forgive it, and under the DPDP Act consent
 * has to be specific and opt-in rather than inferred from a saved form.
 */

export type ProfileResult =
  { ok: true; message: string } | { ok: false; error: string; field?: string };

async function requireOwner() {
  const viewer = await currentViewer();
  if (!viewer.userId) throw new Error("Sign in first.");
  return viewer as typeof viewer & { userId: string };
}

const fail = (error: unknown): ProfileResult => ({
  ok: false,
  error: error instanceof Error ? error.message : "Something went wrong.",
});

/* ---------------------------------------------------------------- basics */

const basicsSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name.").max(80),
  headline: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(2000).optional(),
  pronouns: z.string().trim().max(30).optional(),
  location: z.string().trim().max(80).optional(),
});

export async function saveBasics(
  _previous: ProfileResult | null,
  formData: FormData,
): Promise<ProfileResult> {
  try {
    const viewer = await requireOwner();
    const input = basicsSchema.parse(Object.fromEntries(formData));

    const user = await db.user.update({
      where: { id: viewer.userId },
      data: {
        name: input.name,
        headline: input.headline || null,
        bio: input.bio || null,
        pronouns: input.pronouns || null,
        location: input.location || null,
      },
      select: { username: true },
    });

    revalidatePath("/settings/profile");
    revalidatePath(`/p/${user.username}`);

    return { ok: true, message: "Saved." };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      return {
        ok: false,
        error: issue?.message ?? "Check the form.",
        field: String(issue?.path[0]),
      };
    }
    return fail(error);
  }
}

/* -------------------------------------------------------------- username */

export async function changeUsername(
  _previous: ProfileResult | null,
  formData: FormData,
): Promise<ProfileResult> {
  try {
    const viewer = await requireOwner();

    const user = await db.user.findUnique({
      where: { id: viewer.userId },
      select: { username: true, usernameLockedAt: true, createdAt: true },
    });

    if (!user) return { ok: false, error: "Sign in first." };

    const lockDate = user.usernameLockedAt ?? usernameLockDate(user.createdAt);

    if (!usernameIsChangeable(lockDate)) {
      return {
        ok: false,
        error:
          "Your username is now fixed. It is a public link other people have saved and cited, so it stops changing after the first thirty days.",
        field: "username",
      };
    }

    // Normalise, then validate what will actually be stored. Validating the raw
    // input and storing a folded one is how a case-collision gets through.
    const candidate = normaliseUsername(String(formData.get("username") ?? ""));

    if (candidate === user.username) return { ok: true, message: "That is already your username." };

    const shape = checkUsername(candidate);
    if (!shape.ok) return { ok: false, error: shape.reason, field: "username" };

    const taken = await db.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (taken) return { ok: false, error: "That username is taken.", field: "username" };

    await db.user.update({
      where: { id: viewer.userId },
      data: { username: candidate, usernameLockedAt: lockDate },
    });

    revalidatePath("/settings/profile");
    revalidatePath(`/p/${user.username}`);
    revalidatePath(`/p/${candidate}`);

    return {
      ok: true,
      message: `You are now /p/${candidate}. It becomes fixed on ${lockDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.`,
    };
  } catch (error) {
    return fail(error);
  }
}

/* --------------------------------------------------------- role profiles */

const studentSchema = z.object({
  year: z.coerce.number().int().min(1).max(8).optional(),
  rollNumber: z.string().trim().max(40).optional(),
  interests: z.string().trim().max(400).optional(),
  availableForTeams: z.string().optional(),
});

export async function saveStudentProfile(
  _previous: ProfileResult | null,
  formData: FormData,
): Promise<ProfileResult> {
  try {
    const viewer = await requireOwner();
    const raw = Object.fromEntries(formData);
    const input = studentSchema.parse({ ...raw, year: raw.year || undefined });

    const membership = viewer.memberships.find((m) => m.role === "STUDENT");
    if (!membership) return { ok: false, error: "You are not a student at any college." };

    const interests = splitList(input.interests);

    await db.studentProfile.upsert({
      where: { userId: viewer.userId },
      create: {
        userId: viewer.userId,
        collegeId: membership.collegeId,
        year: input.year ?? null,
        rollNumber: input.rollNumber || null,
        interests,
        availableForTeams: input.availableForTeams === "on",
      },
      update: {
        year: input.year ?? null,
        rollNumber: input.rollNumber || null,
        interests,
        availableForTeams: input.availableForTeams === "on",
      },
    });

    revalidatePath("/settings/profile");
    return { ok: true, message: "Saved." };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      return {
        ok: false,
        error: issue?.message ?? "Check the form.",
        field: String(issue?.path[0]),
      };
    }
    return fail(error);
  }
}

export async function saveFacultyProfile(
  _previous: ProfileResult | null,
  formData: FormData,
): Promise<ProfileResult> {
  try {
    const viewer = await requireOwner();
    const membership = viewer.memberships.find((m) => m.role === "FACULTY");
    if (!membership) return { ok: false, error: "You are not faculty at any college." };

    const data = {
      designation: String(formData.get("designation") ?? "").trim() || null,
      qualifications: splitList(String(formData.get("qualifications") ?? "")),
      expertise: splitList(String(formData.get("expertise") ?? "")),
      researchInterests: splitList(String(formData.get("researchInterests") ?? "")),
      officeHours: String(formData.get("officeHours") ?? "").trim() || null,
      mentorshipAvailable: formData.get("mentorshipAvailable") === "on",
      mentorshipCapacity: Number(formData.get("mentorshipCapacity") ?? 0) || 0,
    };

    await db.facultyProfile.upsert({
      where: { userId: viewer.userId },
      create: { userId: viewer.userId, collegeId: membership.collegeId, ...data },
      update: data,
    });

    revalidatePath("/settings/profile");
    return { ok: true, message: "Saved." };
  } catch (error) {
    return fail(error);
  }
}

export async function saveAlumniProfile(
  _previous: ProfileResult | null,
  formData: FormData,
): Promise<ProfileResult> {
  try {
    const viewer = await requireOwner();
    const membership = viewer.memberships.find((m) => m.role === "ALUMNI");
    if (!membership) return { ok: false, error: "You are not registered as an alumnus." };

    const year = Number(formData.get("graduationYear") ?? 0);
    if (!Number.isInteger(year) || year < 1950 || year > 2100) {
      return { ok: false, error: "Give the year you graduated.", field: "graduationYear" };
    }

    const data = {
      graduationYear: year,
      programme: String(formData.get("programme") ?? "").trim() || null,
      currentRole: String(formData.get("currentRole") ?? "").trim() || null,
      organisation: String(formData.get("organisation") ?? "").trim() || null,
      industry: String(formData.get("industry") ?? "").trim() || null,
      mentorshipAvailable: formData.get("mentorshipAvailable") === "on",
      mentorshipCapacity: Number(formData.get("mentorshipCapacity") ?? 0) || 0,
    };

    await db.alumniProfile.upsert({
      where: { userId: viewer.userId },
      create: { userId: viewer.userId, collegeId: membership.collegeId, ...data },
      update: data,
    });

    revalidatePath("/settings/profile");
    return { ok: true, message: "Saved." };
  } catch (error) {
    return fail(error);
  }
}

/* ----------------------------------------------------------------- lists */

const splitList = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);

/**
 * Claimed skills.
 *
 * Written as `SELF` and nothing else. A claim never enters the database as
 * evidenced — only `recomputeSkills` promotes one, and only when the projects
 * actually back it. Letting this path write `PROJECT_INFERRED` would make the
 * whole three-tier model decorative.
 */
export async function saveSkills(
  _previous: ProfileResult | null,
  formData: FormData,
): Promise<ProfileResult> {
  try {
    const viewer = await requireOwner();
    const names = splitList(String(formData.get("skills") ?? ""));

    await db.$transaction(async (tx) => {
      // Attested skills are a faculty member's signature and are not the
      // owner's to remove from this form.
      await tx.userSkill.deleteMany({
        where: { userId: viewer.userId, source: { in: ["SELF", "PROJECT_INFERRED"] } },
      });

      for (const name of names) {
        const slug = skillSlug(name);
        if (!slug) continue;

        const skill = await tx.skill.upsert({
          where: { slug },
          create: { slug, name },
          update: {},
          select: { id: true },
        });

        await tx.userSkill.upsert({
          where: { userId_skillId: { userId: viewer.userId, skillId: skill.id } },
          create: { userId: viewer.userId, skillId: skill.id, source: "SELF", projectIds: [] },
          update: {},
        });
      }
    });

    await recomputeSkills(viewer.userId);

    revalidatePath("/settings/profile");
    return { ok: true, message: "Saved. Projects will add evidence to these as you finish them." };
  } catch (error) {
    return fail(error);
  }
}

export async function saveLinks(
  _previous: ProfileResult | null,
  formData: FormData,
): Promise<ProfileResult> {
  try {
    const viewer = await requireOwner();

    const labels = formData.getAll("linkLabel").map(String);
    const urls = formData.getAll("linkUrl").map(String);

    const links = labels
      .map((label, index) => ({ label: label.trim(), url: (urls[index] ?? "").trim() }))
      .filter((link) => link.label && link.url)
      .filter((link) => z.string().url().safeParse(link.url).success)
      .slice(0, 8);

    await db.$transaction(async (tx) => {
      await tx.userLink.deleteMany({ where: { userId: viewer.userId } });
      if (links.length > 0) {
        await tx.userLink.createMany({
          data: links.map((link) => ({ userId: viewer.userId, ...link })),
        });
      }
    });

    const user = await db.user.findUnique({
      where: { id: viewer.userId },
      select: { username: true },
    });

    revalidatePath("/settings/profile");
    if (user) revalidatePath(`/p/${user.username}`);

    return { ok: true, message: `Saved ${links.length} link${links.length === 1 ? "" : "s"}.` };
  } catch (error) {
    return fail(error);
  }
}

/* --------------------------------------------------------------- privacy */

const PRIVACY_FIELDS = [
  "showEmail",
  "showRollNumber",
  "showProjects",
  "showSkills",
  "discoverableInSearch",
  "contactableByCompany",
  "inCollegeDirectory",
  "showInProjectCredits",
  "emailDigest",
] as const;

export async function savePrivacy(
  _previous: ProfileResult | null,
  formData: FormData,
): Promise<ProfileResult> {
  try {
    const viewer = await requireOwner();

    const profileVisibility = z
      .enum(["PRIVATE", "COLLEGE", "PUBLIC"])
      .parse(formData.get("profileVisibility"));

    // An unchecked checkbox sends nothing, which is exactly the right default
    // here: absent means off.
    const toggles = Object.fromEntries(
      PRIVACY_FIELDS.map((field) => [field, formData.get(field) === "on"]),
    );

    await db.privacySetting.upsert({
      where: { userId: viewer.userId },
      create: { userId: viewer.userId, profileVisibility, ...toggles },
      update: { profileVisibility, ...toggles },
    });

    const user = await db.user.findUnique({
      where: { id: viewer.userId },
      select: { username: true },
    });

    revalidatePath("/settings/privacy");
    if (user) revalidatePath(`/p/${user.username}`);
    // Visibility decides sitemap membership, so it has to be rebuilt.
    revalidatePath("/sitemap.xml");

    return { ok: true, message: "Saved." };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------- skill inference */

/**
 * Recompute a person's inferred skills from their projects.
 *
 * Called when a project changes state and after a skill edit — **never on
 * render**. It is a join-heavy query and running it inline would land squarely
 * on the profile page's LCP.
 *
 * Self-declared rows are promoted to `PROJECT_INFERRED` when the projects
 * corroborate them, and demoted back to `SELF` when they no longer do. An
 * attestation is never touched: a named human signed it, and only they can
 * withdraw it.
 */
export async function recomputeSkills(userId: string): Promise<number> {
  const memberships = await db.projectMember.findMany({
    where: { userId },
    select: {
      role: true,
      project: {
        select: {
          slug: true,
          title: true,
          status: true,
          techStack: true,
          domain: true,
          deletedAt: true,
          topics: { select: { topic: { select: { slug: true } } } },
        },
      },
    },
  });

  const evidence: ProjectEvidence[] = memberships
    .filter((member) => member.project.deletedAt === null)
    .map((member) => ({
      slug: member.project.slug,
      title: member.project.title,
      status: member.project.status,
      techStack: member.project.techStack,
      domain: member.project.domain,
      topics: member.project.topics.map((entry) => entry.topic.slug),
      role: member.role,
    }));

  const inferred = inferSkills(evidence);
  const inferredBySlug = new Map(inferred.map((skill) => [skill.slug, skill]));

  const existing = await db.userSkill.findMany({
    where: { userId },
    select: { id: true, source: true, skill: { select: { id: true, slug: true } } },
  });

  const existingBySlug = new Map(existing.map((row) => [row.skill.slug, row]));

  await db.$transaction(async (tx) => {
    for (const skill of inferred) {
      const row = existingBySlug.get(skill.slug);

      if (row) {
        // Never overwrite an attestation.
        if (row.source === "ATTESTED") continue;

        await tx.userSkill.update({
          where: { id: row.id },
          data: { source: "PROJECT_INFERRED", projectIds: skill.projectSlugs },
        });
        continue;
      }

      const created = await tx.skill.upsert({
        where: { slug: skill.slug },
        create: { slug: skill.slug, name: skill.name },
        update: {},
        select: { id: true },
      });

      await tx.userSkill.create({
        data: {
          userId,
          skillId: created.id,
          source: "PROJECT_INFERRED",
          projectIds: skill.projectSlugs,
        },
      });
    }

    // A skill that used to be evidenced and no longer is falls back to a claim
    // rather than vanishing — the person did say it about themselves.
    for (const row of existing) {
      if (row.source !== "PROJECT_INFERRED") continue;
      if (inferredBySlug.has(row.skill.slug)) continue;

      await tx.userSkill.update({
        where: { id: row.id },
        data: { source: "SELF", projectIds: [] },
      });
    }
  });

  return inferred.length;
}

/* --------------------------------------------------- onboarding → profile */

/**
 * Turn the onboarding answers into real profile rows.
 *
 * Phase 4 deliberately left the answers in `OnboardingProgress.data` as JSON so
 * a half-finished wizard could not produce a half-built profile. This is the
 * other half: called once, on completion, inside a transaction.
 *
 * It is idempotent — a re-run upserts rather than duplicating — because
 * "completed" is a state somebody can reach twice.
 */
export async function applyOnboarding(userId: string): Promise<void> {
  const progress = await db.onboardingProgress.findUnique({
    where: { userId },
    select: { role: true, data: true, completedAt: true },
  });

  if (!progress?.completedAt) return;

  const answers = (progress.data ?? {}) as Record<string, string>;

  const membership = await db.membership.findFirst({
    where: { userId, role: progress.role },
    select: { collegeId: true },
  });

  if (!membership) return;

  const list = (value: string | undefined) => splitList(value);

  await db.$transaction(async (tx) => {
    if (progress.role === "STUDENT") {
      const data = {
        year: Number(answers.year) || null,
        rollNumber: answers.rollNumber || null,
        interests: list(answers.interests),
      };

      await tx.studentProfile.upsert({
        where: { userId },
        create: { userId, collegeId: membership.collegeId, ...data },
        update: data,
      });
    }

    if (progress.role === "FACULTY") {
      const data = {
        designation: answers.designation || null,
        expertise: list(answers.expertise),
        researchInterests: list(answers.expertise),
        officeHours: answers.officeHours || null,
      };

      await tx.facultyProfile.upsert({
        where: { userId },
        create: { userId, collegeId: membership.collegeId, ...data },
        update: data,
      });
    }

    if (progress.role === "ALUMNI") {
      const data = {
        graduationYear: Number(answers.graduationYear) || new Date().getFullYear(),
        programme: answers.programme || null,
        currentRole: answers.currentRole || null,
        organisation: answers.organisation || null,
        mentorshipCapacity: Number(answers.mentorshipCapacity) || 0,
        mentorshipAvailable: Number(answers.mentorshipCapacity) > 0,
      };

      await tx.alumniProfile.upsert({
        where: { userId },
        create: { userId, collegeId: membership.collegeId, ...data },
        update: data,
      });
    }

    if (progress.role === "RESEARCHER") {
      const data = {
        affiliation: answers.affiliation || null,
        field: answers.field || null,
        orcid: answers.orcid || null,
        interests: list(answers.interests),
      };

      await tx.researcherProfile.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      });
    }
  });

  // Skills claimed during onboarding become SELF rows, then the inference
  // promotes whichever the person's projects already back.
  const claimed = list(answers.skills);

  if (claimed.length > 0) {
    for (const name of claimed) {
      const slug = skillSlug(name);
      if (!slug) continue;

      const skill = await db.skill.upsert({
        where: { slug },
        create: { slug, name },
        update: {},
        select: { id: true },
      });

      await db.userSkill.upsert({
        where: { userId_skillId: { userId, skillId: skill.id } },
        create: { userId, skillId: skill.id, source: "SELF", projectIds: [] },
        update: {},
      });
    }
  }

  await recomputeSkills(userId);
}

/* --------------------------------------------------------------- avatar */

/**
 * Upload an avatar.
 *
 * This closes the hand-off Phase 6 left open: onboarding skipped the avatar
 * step because storage did not exist, and it does now.
 *
 * Cover images are **not** here, and the reason is worth recording rather than
 * leaving as a silent omission: `User` has no cover column. Phase 6's note
 * assumed one existed. Adding it belongs with Phase 8, which is where a cover
 * is actually rendered — a migration for a field nothing displays is a schema
 * change with no way to tell whether it works.
 *
 * The previous object is deleted **after** the row is updated, not before. If
 * the order were reversed and the update failed, the profile would point at
 * bytes that are already gone — a broken image is worse than an orphaned one,
 * because only the second is invisible.
 */
export async function saveAvatar(
  _previous: ProfileResult | null,
  formData: FormData,
): Promise<ProfileResult> {
  try {
    const viewer = await requireOwner();
    const file = formData.get("file");

    const user = await db.user.findUniqueOrThrow({
      where: { id: viewer.userId },
      select: { avatarUrl: true },
    });

    const previousUrl = user.avatarUrl;

    // "Remove" is the same action with no file, so the control does not need a
    // second endpoint that could disagree with this one about ownership.
    if (!(file instanceof File) || file.size === 0) {
      if (formData.get("remove") !== "true") {
        return { ok: false, error: "Choose an image to upload." };
      }

      await db.user.update({
        where: { id: viewer.userId },
        data: { avatarUrl: null },
      });
      await forgetImage(previousUrl);

      revalidatePath("/settings/profile");
      return { ok: true, message: "Avatar removed." };
    }

    const stored = await storeImage("avatar", viewer.userId, file);
    if (!stored.ok) return { ok: false, error: stored.error, field: "file" };

    await db.user.update({
      where: { id: viewer.userId },
      data: { avatarUrl: stored.url },
    });

    await forgetImage(previousUrl);

    revalidatePath("/settings/profile");
    revalidatePath("/dashboard");
    return { ok: true, message: "Avatar updated." };
  } catch (error) {
    return fail(error);
  }
}
