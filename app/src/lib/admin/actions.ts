"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logAudit, logChange } from "@/lib/audit";
import { currentViewer } from "@/lib/auth/session";
import { assertCan, type Action } from "@/lib/authz/policy";
import { db } from "@/lib/db/client";
import { canAdminister } from "@/lib/db/queries/institution";
import { hashPassword } from "@/lib/auth/password";
import { forgetImage, storeImage } from "@/lib/storage/images";
import { randomBytes } from "node:crypto";

/**
 * ADMINISTRATIVE MUTATIONS.
 *
 * Three rules hold for every function here, without exception:
 *
 * 1. **Authorise against the college, then act.** `guard()` resolves the viewer
 *    and refuses anything outside the college being changed. A college admin
 *    passing another college's id gets a refusal, not a silent no-op.
 * 2. **Audit inside the transaction.** The entry and the change commit or fail
 *    together. An audit row that survives a rolled-back change is a lie; one
 *    lost when the change succeeds is worse.
 * 3. **Archive, never delete.** A deleted subject orphans projects, evaluations
 *    and history. Archiving hides it from pickers and keeps every reference
 *    intact — which is the whole point of an archive that people cite.
 */

export type AdminResult =
  { ok: true; message: string; id?: string } | { ok: false; error: string; field?: string };

/** Resolve the viewer and refuse anything outside the college being changed. */
async function guard(collegeId: string, action: Action) {
  const viewer = await currentViewer();

  if (!viewer.userId) throw new Error("Sign in first.");
  if (!canAdminister(viewer, collegeId)) {
    // Same refusal whether the college exists or not.
    throw new Error("You do not administer this college.");
  }

  assertCan(viewer, action, { kind: "college", collegeId });

  return viewer as typeof viewer & { userId: string };
}

const fail = (error: unknown): AdminResult => ({
  ok: false,
  error: error instanceof Error ? error.message : "Something went wrong.",
});

/* ------------------------------------------------------------ hierarchy */

const departmentSchema = z.object({
  collegeId: z.string().min(1),
  id: z.string().optional(),
  name: z.string().trim().min(2, "Give the department a name.").max(120),
  code: z.string().trim().min(1, "Give it a short code.").max(12).toUpperCase(),
});

export async function saveDepartment(
  _previous: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  try {
    const input = departmentSchema.parse(Object.fromEntries(formData));
    const viewer = await guard(input.collegeId, "college:manage");

    if (input.id) {
      const before = await db.department.findFirst({
        where: { id: input.id, collegeId: input.collegeId },
      });
      if (!before) return { ok: false, error: "That department no longer exists." };

      const after = await db.$transaction(async (tx) => {
        const updated = await tx.department.update({
          where: { id: input.id },
          data: { name: input.name, code: input.code },
        });

        await logChange(
          {
            actorId: viewer.userId,
            collegeId: input.collegeId,
            action: "department.update",
            subjectType: "Department",
            subjectId: updated.id,
            before: { name: before.name, code: before.code },
            after: { name: updated.name, code: updated.code },
          },
          tx,
        );

        return updated;
      });

      revalidatePath("/admin/departments");
      return { ok: true, message: `Updated ${after.name}.`, id: after.id };
    }

    const created = await db.$transaction(async (tx) => {
      const row = await tx.department.create({
        data: { collegeId: input.collegeId, name: input.name, code: input.code },
      });

      await logAudit(
        {
          actorId: viewer.userId,
          collegeId: input.collegeId,
          action: "department.create",
          subjectType: "Department",
          subjectId: row.id,
          after: { name: row.name, code: row.code },
        },
        tx,
      );

      return row;
    });

    revalidatePath("/admin/departments");
    return { ok: true, message: `Created ${created.name}.`, id: created.id };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      return {
        ok: false,
        error: issue?.message ?? "Check the form.",
        field: String(issue?.path[0]),
      };
    }
    // A duplicate code is the common one and deserves a real message.
    if (String(error).includes("Unique constraint")) {
      return {
        ok: false,
        error: "That code is already used by another department.",
        field: "code",
      };
    }
    return fail(error);
  }
}

/**
 * Archive rather than delete, and refuse when children would be orphaned.
 *
 * The refusal is deliberate: silently archiving a department along with its six
 * programmes is the kind of cascade nobody expects and everybody regrets.
 */
export async function archiveDepartment(
  _previous: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  try {
    const id = String(formData.get("id") ?? "");
    const collegeId = String(formData.get("collegeId") ?? "");
    const viewer = await guard(collegeId, "college:manage");

    const department = await db.department.findFirst({
      where: { id, collegeId },
      select: {
        name: true,
        archivedAt: true,
        _count: { select: { programmes: true, subjects: true } },
      },
    });

    if (!department) return { ok: false, error: "That department no longer exists." };

    if (!department.archivedAt && department._count.programmes > 0) {
      return {
        ok: false,
        error: `Archive its ${department._count.programmes} programme${department._count.programmes === 1 ? "" : "s"} first — otherwise they would be left without a department.`,
      };
    }

    const archivedAt = department.archivedAt ? null : new Date();

    await db.$transaction(async (tx) => {
      await tx.department.update({ where: { id }, data: { archivedAt } });

      await logAudit(
        {
          actorId: viewer.userId,
          collegeId,
          action: "department.archive",
          subjectType: "Department",
          subjectId: id,
          before: { archivedAt: department.archivedAt },
          after: { archivedAt },
        },
        tx,
      );
    });

    revalidatePath("/admin/departments");
    return {
      ok: true,
      message: archivedAt ? `Archived ${department.name}.` : `Restored ${department.name}.`,
    };
  } catch (error) {
    return fail(error);
  }
}

const programmeSchema = z.object({
  collegeId: z.string().min(1),
  id: z.string().optional(),
  departmentId: z.string().min(1, "Choose a department."),
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().min(1).max(16).toUpperCase(),
  degreeType: z.string().trim().min(1).max(24),
  durationYears: z.coerce.number().int().min(1).max(8),
});

export async function saveProgramme(
  _previous: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  try {
    const input = programmeSchema.parse(Object.fromEntries(formData));
    const viewer = await guard(input.collegeId, "college:manage");

    const data = {
      collegeId: input.collegeId,
      departmentId: input.departmentId,
      name: input.name,
      code: input.code,
      degreeType: input.degreeType,
      durationYears: input.durationYears,
    };

    const row = await db.$transaction(async (tx) => {
      const saved = input.id
        ? await tx.programme.update({ where: { id: input.id }, data })
        : await tx.programme.create({ data });

      await logAudit(
        {
          actorId: viewer.userId,
          collegeId: input.collegeId,
          action: input.id ? "programme.update" : "programme.create",
          subjectType: "Programme",
          subjectId: saved.id,
          after: { name: saved.name, code: saved.code },
        },
        tx,
      );

      return saved;
    });

    revalidatePath("/admin/programmes");
    return { ok: true, message: `Saved ${row.name}.`, id: row.id };
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

const subjectSchema = z.object({
  collegeId: z.string().min(1),
  id: z.string().optional(),
  departmentId: z.string().min(1, "Choose a department."),
  programmeId: z.string().optional(),
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().min(1).max(16).toUpperCase(),
  credits: z.coerce.number().int().min(0).max(20),
  semester: z.coerce.number().int().min(1).max(12).optional(),
});

export async function saveSubject(
  _previous: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  try {
    const raw = Object.fromEntries(formData);
    const input = subjectSchema.parse({
      ...raw,
      programmeId: raw.programmeId || undefined,
      semester: raw.semester || undefined,
    });
    const viewer = await guard(input.collegeId, "college:manage");

    const data = {
      collegeId: input.collegeId,
      departmentId: input.departmentId,
      programmeId: input.programmeId ?? null,
      name: input.name,
      code: input.code,
      credits: input.credits,
      semester: input.semester ?? null,
    };

    const row = await db.$transaction(async (tx) => {
      const saved = input.id
        ? await tx.subject.update({ where: { id: input.id }, data })
        : await tx.subject.create({ data });

      await logAudit(
        {
          actorId: viewer.userId,
          collegeId: input.collegeId,
          action: input.id ? "subject.update" : "subject.create",
          subjectType: "Subject",
          subjectId: saved.id,
          after: { name: saved.name, code: saved.code, credits: saved.credits },
        },
        tx,
      );

      return saved;
    });

    revalidatePath("/admin/subjects");
    return { ok: true, message: `Saved ${row.name}.`, id: row.id };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      return {
        ok: false,
        error: issue?.message ?? "Check the form.",
        field: String(issue?.path[0]),
      };
    }
    if (String(error).includes("Unique constraint")) {
      return { ok: false, error: "That subject code is already in use.", field: "code" };
    }
    return fail(error);
  }
}

const termSchema = z
  .object({
    collegeId: z.string().min(1),
    id: z.string().optional(),
    name: z.string().trim().min(2).max(60),
    startsOn: z.coerce.date(),
    endsOn: z.coerce.date(),
  })
  .refine((value) => value.endsOn > value.startsOn, {
    message: "The term has to end after it starts.",
    path: ["endsOn"],
  });

export async function saveTerm(
  _previous: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  try {
    const input = termSchema.parse(Object.fromEntries(formData));
    const viewer = await guard(input.collegeId, "college:manage");

    const data = {
      collegeId: input.collegeId,
      name: input.name,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
    };

    const row = await db.$transaction(async (tx) => {
      const saved = input.id
        ? await tx.term.update({ where: { id: input.id }, data })
        : await tx.term.create({ data });

      await logAudit(
        {
          actorId: viewer.userId,
          collegeId: input.collegeId,
          action: input.id ? "term.update" : "term.create",
          subjectType: "Term",
          subjectId: saved.id,
          after: { name: saved.name, startsOn: saved.startsOn, endsOn: saved.endsOn },
        },
        tx,
      );

      return saved;
    });

    revalidatePath("/admin/terms");
    return { ok: true, message: `Saved ${row.name}.`, id: row.id };
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

/**
 * Exactly one active term, enforced in a transaction.
 *
 * "Which term is it" is read by the dashboard, the class pickers and every
 * roll-up in Phase 15. Two active terms is not a cosmetic problem — it makes
 * that question unanswerable.
 */
export async function activateTerm(
  _previous: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  try {
    const id = String(formData.get("id") ?? "");
    const collegeId = String(formData.get("collegeId") ?? "");
    const viewer = await guard(collegeId, "college:manage");

    const term = await db.term.findFirst({ where: { id, collegeId }, select: { name: true } });
    if (!term) return { ok: false, error: "That term no longer exists." };

    await db.$transaction(async (tx) => {
      await tx.term.updateMany({ where: { collegeId }, data: { isActive: false } });
      await tx.term.update({ where: { id }, data: { isActive: true } });

      await logAudit(
        {
          actorId: viewer.userId,
          collegeId,
          action: "term.activate",
          subjectType: "Term",
          subjectId: id,
          after: { name: term.name, isActive: true },
        },
        tx,
      );
    });

    revalidatePath("/admin/terms");
    return { ok: true, message: `${term.name} is now the active term.` };
  } catch (error) {
    return fail(error);
  }
}

const classSchema = z.object({
  collegeId: z.string().min(1),
  id: z.string().optional(),
  subjectId: z.string().min(1, "Choose a subject."),
  termId: z.string().min(1, "Choose a term."),
  section: z.string().trim().min(1).max(8).toUpperCase(),
});

export async function saveClass(
  _previous: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  try {
    const input = classSchema.parse(Object.fromEntries(formData));
    const viewer = await guard(input.collegeId, "class:manage");

    // Both parents must belong to this college, or the class would straddle a
    // boundary that every isolation check assumes it never crosses.
    const [subject, term] = await Promise.all([
      db.subject.findFirst({ where: { id: input.subjectId, collegeId: input.collegeId } }),
      db.term.findFirst({ where: { id: input.termId, collegeId: input.collegeId } }),
    ]);

    if (!subject || !term) {
      return { ok: false, error: "That subject or term does not belong to your college." };
    }

    const data = {
      collegeId: input.collegeId,
      subjectId: input.subjectId,
      termId: input.termId,
      section: input.section,
    };

    const row = await db.$transaction(async (tx) => {
      const saved = input.id
        ? await tx.class.update({ where: { id: input.id }, data })
        : await tx.class.create({ data });

      await logAudit(
        {
          actorId: viewer.userId,
          collegeId: input.collegeId,
          action: input.id ? "class.update" : "class.create",
          subjectType: "Class",
          subjectId: saved.id,
          after: { subject: subject.name, term: term.name, section: saved.section },
        },
        tx,
      );

      return saved;
    });

    revalidatePath("/admin/classes");
    return {
      ok: true,
      message: `Saved ${subject.name} — ${term.name} ${row.section}.`,
      id: row.id,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      return {
        ok: false,
        error: issue?.message ?? "Check the form.",
        field: String(issue?.path[0]),
      };
    }
    if (String(error).includes("Unique constraint")) {
      return { ok: false, error: "That section already exists for this subject and term." };
    }
    return fail(error);
  }
}

export async function assignFaculty(
  _previous: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  try {
    const classId = String(formData.get("classId") ?? "");
    const userId = String(formData.get("userId") ?? "");
    const collegeId = String(formData.get("collegeId") ?? "");
    const viewer = await guard(collegeId, "class:manage");

    const [klass, membership] = await Promise.all([
      db.class.findFirst({ where: { id: classId, collegeId }, select: { id: true } }),
      db.membership.findFirst({
        where: { userId, collegeId, role: "FACULTY", state: { in: ["ACTIVE", "INVITED"] } },
        select: { id: true, user: { select: { name: true } } },
      }),
    ]);

    if (!klass) return { ok: false, error: "That class no longer exists." };
    if (!membership) {
      return { ok: false, error: "That person is not faculty at this college." };
    }

    await db.$transaction(async (tx) => {
      await tx.subjectAssignment.upsert({
        where: { classId_userId: { classId, userId } },
        create: { classId, userId },
        update: {},
      });

      await logAudit(
        {
          actorId: viewer.userId,
          collegeId,
          action: "class.faculty.assign",
          subjectType: "Class",
          subjectId: classId,
          after: { faculty: membership.user.name },
        },
        tx,
      );
    });

    revalidatePath(`/admin/classes/${classId}`);
    return { ok: true, message: `${membership.user.name} now teaches this class.` };
  } catch (error) {
    return fail(error);
  }
}

/* --------------------------------------------------------------- people */

const ROLE_VALUES = [
  "STUDENT",
  "FACULTY",
  "COLLEGE_ADMIN",
  "ALUMNI",
  "RESEARCHER",
  "COMPANY",
] as const;

export async function changeRole(
  _previous: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  try {
    const membershipId = String(formData.get("membershipId") ?? "");
    const collegeId = String(formData.get("collegeId") ?? "");
    const role = z.enum(ROLE_VALUES).parse(formData.get("role"));
    const viewer = await guard(collegeId, "roster:manage");

    const membership = await db.membership.findFirst({
      where: { id: membershipId, collegeId },
      select: { id: true, role: true, userId: true, user: { select: { name: true } } },
    });

    if (!membership) return { ok: false, error: "That membership no longer exists." };
    if (membership.role === role) return { ok: true, message: "No change." };

    await db.$transaction(async (tx) => {
      await tx.membership.update({ where: { id: membershipId }, data: { role } });

      await logAudit(
        {
          actorId: viewer.userId,
          collegeId,
          action: "member.role.change",
          subjectType: "Membership",
          subjectId: membershipId,
          before: { role: membership.role },
          after: { role },
        },
        tx,
      );
    });

    // Sessions are database-backed (ADR-027), so the new role is in force on the
    // member's very next request — no token to invalidate, and nothing to
    // explain when an admin changes a role and expects it to take effect.
    revalidatePath("/admin/people");
    return {
      ok: true,
      message: `${membership.user.name} is now ${role.replace("_", " ").toLowerCase()}.`,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function setSuspension(
  _previous: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  try {
    const membershipId = String(formData.get("membershipId") ?? "");
    const collegeId = String(formData.get("collegeId") ?? "");
    const suspend = formData.get("suspend") === "true";
    const reason = String(formData.get("reason") ?? "").trim();
    const viewer = await guard(collegeId, "member:suspend");

    // A suspension without a stated reason is unanswerable later, which is
    // exactly when someone asks.
    if (suspend && reason.length < 8) {
      return {
        ok: false,
        error: "Give a reason. It is recorded and it is what makes this reviewable.",
        field: "reason",
      };
    }

    const membership = await db.membership.findFirst({
      where: { id: membershipId, collegeId },
      select: { id: true, state: true, user: { select: { name: true } } },
    });

    if (!membership) return { ok: false, error: "That membership no longer exists." };

    const state = suspend ? "SUSPENDED" : "ACTIVE";

    await db.$transaction(async (tx) => {
      await tx.membership.update({
        where: { id: membershipId },
        data: { state, suspendedReason: suspend ? reason : null },
      });

      await logAudit(
        {
          actorId: viewer.userId,
          collegeId,
          action: suspend ? "member.suspend" : "member.reinstate",
          subjectType: "Membership",
          subjectId: membershipId,
          before: { state: membership.state },
          after: { state },
          reason: suspend ? reason : undefined,
        },
        tx,
      );
    });

    // Acceptance criterion 8: read-only immediately, without a re-login. The
    // viewer is rebuilt from the database on every request, so the next one
    // already sees SUSPENDED.
    revalidatePath("/admin/people");
    return {
      ok: true,
      message: suspend
        ? `${membership.user.name} is suspended and read-only from their next request.`
        : `${membership.user.name} is active again.`,
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * The alumni transition.
 *
 * A state change on the membership, never a new account and never a deletion.
 * Workspace access ends; **authorship of every past project and the whole
 * portfolio persists forever** — losing your own work on graduation would be
 * the single worst bug this product could have, so nothing here touches
 * `ProjectMember`, `Project` or any authored row.
 */
export async function transitionToAlumni(
  _previous: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  try {
    const collegeId = String(formData.get("collegeId") ?? "");
    const year = Number(formData.get("graduationYear") ?? 0);
    const viewer = await guard(collegeId, "roster:manage");

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return { ok: false, error: "Give a graduating year.", field: "graduationYear" };
    }

    const ids = String(formData.get("membershipIds") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (ids.length === 0) return { ok: false, error: "Select at least one student." };

    const memberships = await db.membership.findMany({
      where: { id: { in: ids }, collegeId, role: "STUDENT" },
      select: { id: true, userId: true },
    });

    if (memberships.length === 0) return { ok: false, error: "None of those are students here." };

    await db.$transaction(async (tx) => {
      await tx.membership.updateMany({
        where: { id: { in: memberships.map((m) => m.id) } },
        data: { role: "ALUMNI", state: "ALUMNI" },
      });

      // Workspace access ends: they leave their groups. The GroupMember row is
      // kept with `leftAt` set, so the contribution ledger still resolves and
      // the record of who was on the team survives.
      await tx.groupMember.updateMany({
        where: { userId: { in: memberships.map((m) => m.userId) }, leftAt: null },
        data: { leftAt: new Date() },
      });

      for (const membership of memberships) {
        await logAudit(
          {
            actorId: viewer.userId,
            collegeId,
            action: "member.alumni.transition",
            subjectType: "Membership",
            subjectId: membership.id,
            after: { role: "ALUMNI", state: "ALUMNI", graduationYear: year },
          },
          tx,
        );
      }
    });

    revalidatePath("/admin/people");
    return {
      ok: true,
      message: `${memberships.length} ${memberships.length === 1 ? "student" : "students"} moved to alumni. Their projects and portfolios are untouched.`,
    };
  } catch (error) {
    return fail(error);
  }
}

/* ---------------------------------------------------------------- college */

const collegeSchema = z.object({
  collegeId: z.string().min(1),
  name: z.string().trim().min(2).max(160),
  shortName: z.string().trim().min(2).max(40),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(1).max(80),
  website: z.string().trim().url().or(z.literal("")).optional(),
  description: z.string().trim().min(1).max(2000),
  emailDomains: z.string().trim().optional(),
  timezone: z.string().trim().min(1).max(60),
});

export async function saveCollege(
  _previous: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  try {
    const input = collegeSchema.parse(Object.fromEntries(formData));
    const viewer = await guard(input.collegeId, "college:edit");

    const before = await db.college.findUnique({ where: { id: input.collegeId } });
    if (!before) return { ok: false, error: "That college no longer exists." };

    // Email domains are the trust gate: anyone registering on one is associated
    // with this college automatically, so they are lowercased, de-duplicated and
    // stripped of anything that is not a hostname.
    const emailDomains = [
      ...new Set(
        (input.emailDomains ?? "")
          .split(/[,\s]+/)
          .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
          .filter((domain) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)),
      ),
    ];

    const after = await db.$transaction(async (tx) => {
      const updated = await tx.college.update({
        where: { id: input.collegeId },
        data: {
          name: input.name,
          shortName: input.shortName,
          city: input.city,
          state: input.state,
          website: input.website || null,
          description: input.description,
          emailDomains,
          timezone: input.timezone,
        },
      });

      await logChange(
        {
          actorId: viewer.userId,
          collegeId: input.collegeId,
          action: "college.update",
          subjectType: "College",
          subjectId: updated.id,
          before: {
            name: before.name,
            shortName: before.shortName,
            city: before.city,
            website: before.website,
            description: before.description,
            emailDomains: before.emailDomains,
          },
          after: {
            name: updated.name,
            shortName: updated.shortName,
            city: updated.city,
            website: updated.website,
            description: updated.description,
            emailDomains: updated.emailDomains,
          },
        },
        tx,
      );

      return updated;
    });

    revalidatePath("/admin/college");
    revalidatePath(`/colleges/${after.slug}`);
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

export async function requestVerification(
  _previous: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  try {
    const collegeId = String(formData.get("collegeId") ?? "");
    const evidence = String(formData.get("evidence") ?? "").trim();
    const viewer = await guard(collegeId, "college:verify:request");

    if (evidence.length < 20) {
      return {
        ok: false,
        error:
          "Tell us something we can actually check — a registration number, an official domain, a contact who can confirm.",
        field: "evidence",
      };
    }

    const college = await db.college.findUnique({
      where: { id: collegeId },
      select: { verification: true, name: true },
    });

    if (!college) return { ok: false, error: "That college no longer exists." };
    if (college.verification === "VERIFIED") {
      return { ok: true, message: "This college is already verified." };
    }

    await db.$transaction(async (tx) => {
      await tx.college.update({ where: { id: collegeId }, data: { verification: "PENDING" } });

      await logAudit(
        {
          actorId: viewer.userId,
          collegeId,
          action: "college.verify.request",
          subjectType: "College",
          subjectId: collegeId,
          before: { verification: college.verification },
          after: { verification: "PENDING" },
          reason: evidence,
        },
        tx,
      );
    });

    revalidatePath("/admin/college");
    return { ok: true, message: "Submitted. We review these by hand, which is the point of them." };
  } catch (error) {
    return fail(error);
  }
}

/* --------------------------------------------------- platform verification */

/**
 * Granting verification. Platform admin only — a college that could verify
 * itself is not a trust gate, which is why `can()` returns false for every
 * college admin regardless of their role.
 */
export async function decideVerification(
  _previous: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  try {
    const viewer = await currentViewer();
    if (!viewer.userId) return { ok: false, error: "Sign in first." };

    const collegeId = String(formData.get("collegeId") ?? "");
    const approve = formData.get("approve") === "true";
    const reason = String(formData.get("reason") ?? "").trim();

    assertCan(viewer, "college:verify:grant", { kind: "college", collegeId });

    if (!approve && reason.length < 8) {
      return {
        ok: false,
        error: "A rejection needs a reason the college can act on.",
        field: "reason",
      };
    }

    const college = await db.college.findUnique({
      where: { id: collegeId },
      select: { name: true, slug: true, verification: true },
    });

    if (!college) return { ok: false, error: "That college no longer exists." };

    const verification = approve ? "VERIFIED" : "REJECTED";

    await db.$transaction(async (tx) => {
      await tx.college.update({
        where: { id: collegeId },
        data: { verification, verifiedAt: approve ? new Date() : null },
      });

      await logAudit(
        {
          actorId: viewer.userId,
          collegeId,
          action: approve ? "college.verify.approve" : "college.verify.reject",
          subjectType: "College",
          subjectId: collegeId,
          before: { verification: college.verification },
          after: { verification },
          reason: reason || undefined,
        },
        tx,
      );
    });

    // Verification changes what the whole internet can see of this college, so
    // the public surfaces have to be rebuilt rather than served from cache.
    revalidatePath("/colleges");
    revalidatePath(`/colleges/${college.slug}`);
    revalidatePath("/sitemap.xml");
    revalidatePath("/platform");

    return {
      ok: true,
      message: approve
        ? `${college.name} is verified and now publicly listed.`
        : `${college.name} was rejected.`,
    };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------ invitations */

const INVITE_DAILY_LIMIT = 200;

export async function issueInvitations(
  _previous: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  try {
    const collegeId = String(formData.get("collegeId") ?? "");
    const role = z.enum(ROLE_VALUES).parse(formData.get("role"));
    const viewer = await guard(collegeId, "invite:issue");

    const emails = [
      ...new Set(
        String(formData.get("emails") ?? "")
          .split(/[,\s;]+/)
          .map((email) => email.trim().toLowerCase())
          .filter((email) => z.string().email().safeParse(email).success),
      ),
    ];

    if (emails.length === 0)
      return { ok: false, error: "No valid email addresses found.", field: "emails" };

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const issuedToday = await db.invitation.count({
      where: { inviterId: viewer.userId, createdAt: { gte: since } },
    });

    if (issuedToday + emails.length > INVITE_DAILY_LIMIT) {
      return {
        ok: false,
        error: `That would exceed the ${INVITE_DAILY_LIMIT}-a-day invitation limit — you have sent ${issuedToday} today.`,
      };
    }

    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const created = await db.$transaction(async (tx) => {
      const rows = [];

      for (const email of emails) {
        const row = await tx.invitation.create({
          data: {
            collegeId,
            inviterId: viewer.userId,
            email,
            role,
            code: randomBytes(16).toString("base64url"),
            expiresAt,
          },
          select: { id: true, email: true, code: true },
        });

        await logAudit(
          {
            actorId: viewer.userId,
            collegeId,
            action: "invitation.issue",
            subjectType: "Invitation",
            subjectId: row.id,
            after: { email: row.email, role },
          },
          tx,
        );

        rows.push(row);
      }

      return rows;
    });

    // Sending happens outside the transaction: a mail failure must not roll back
    // invitations that were genuinely created, and the code can be resent.
    const { sendEmail, invitationEmail } = await import("@/lib/email/send");
    const college = await db.college.findUnique({
      where: { id: collegeId },
      select: { name: true },
    });
    const inviter = await db.user.findUnique({
      where: { id: viewer.userId },
      select: { name: true },
    });

    for (const row of created) {
      await sendEmail(
        invitationEmail(
          row.email,
          college?.name ?? "your college",
          inviter?.name ?? "An administrator",
          row.code,
        ),
      ).catch(() => undefined);
    }

    revalidatePath("/admin/invitations");
    return {
      ok: true,
      message: `Invited ${created.length} ${created.length === 1 ? "person" : "people"}.`,
    };
  } catch (error) {
    return fail(error);
  }
}

export async function revokeInvitation(
  _previous: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  try {
    const id = String(formData.get("id") ?? "");
    const collegeId = String(formData.get("collegeId") ?? "");
    const viewer = await guard(collegeId, "invite:issue");

    const invitation = await db.invitation.findFirst({
      where: { id, collegeId },
      select: { email: true, state: true },
    });

    if (!invitation) return { ok: false, error: "That invitation no longer exists." };

    await db.$transaction(async (tx) => {
      await tx.invitation.update({ where: { id }, data: { state: "WITHDRAWN" } });

      await logAudit(
        {
          actorId: viewer.userId,
          collegeId,
          action: "invitation.revoke",
          subjectType: "Invitation",
          subjectId: id,
          before: { state: invitation.state },
          after: { state: "WITHDRAWN" },
        },
        tx,
      );
    });

    revalidatePath("/admin/invitations");
    return { ok: true, message: `Revoked the invitation to ${invitation.email}.` };
  } catch (error) {
    return fail(error);
  }
}

/* --------------------------------------------------------- import commit */

/**
 * Commit an import.
 *
 * One transaction: a partial failure rolls the whole thing back, because half
 * an imported roster is harder to recover from than none of one. The plan is
 * recomputed here rather than trusted from the client — a dry run the browser
 * could edit before committing would make the preview theatre.
 */
export async function commitImport(
  _previous: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  try {
    const collegeId = String(formData.get("collegeId") ?? "");
    const viewer = await guard(collegeId, "roster:manage");

    const csv = String(formData.get("csv") ?? "");
    const mappingRaw = String(formData.get("mapping") ?? "{}");
    const classId = String(formData.get("classId") ?? "") || null;

    if (!csv.trim()) return { ok: false, error: "No file content was submitted." };

    const { parseCsv } = await import("@/lib/import/csv");
    const { planImport } = await import("@/lib/import/people");

    const parsed = parseCsv(csv);
    const mapping = JSON.parse(mappingRaw) as Record<string, string | null>;

    const existing = await db.membership.findMany({
      where: { collegeId },
      select: {
        userId: true,
        role: true,
        state: true,
        user: {
          select: { email: true, name: true, studentProfile: { select: { rollNumber: true } } },
        },
      },
    });

    const plan = planImport(
      parsed.rows,
      mapping,
      existing.map((member) => ({
        userId: member.userId,
        email: member.user.email,
        name: member.user.name,
        rollNumber: member.user.studentProfile?.rollNumber ?? null,
        role: member.role,
        state: member.state,
      })),
    );

    if (plan.fileErrors.length > 0)
      return { ok: false, error: plan.fileErrors[0] ?? "Check the mapping." };
    if (plan.empty) return { ok: false, error: "Nothing to import." };

    // One shared hash: these accounts have no password until the invitee sets
    // one, and hashing 500 times would dominate the ten-second budget.
    const placeholderHash = await hashPassword(randomBytes(24).toString("base64url"));

    const summary = await db.$transaction(
      async (tx) => {
        let created = 0;
        let updated = 0;
        let enrolled = 0;

        for (const row of plan.rows) {
          if (row.outcome === "error" || row.outcome === "skip") continue;

          let userId = row.existingUserId ?? null;

          if (row.outcome === "create") {
            const existingUser = await tx.user.findUnique({
              where: { email: row.email },
              select: { id: true },
            });

            if (existingUser) {
              userId = existingUser.id;
            } else {
              const user = await tx.user.create({
                data: {
                  email: row.email,
                  name: row.name,
                  username: await uniqueUsernameTx(tx, row.name, row.email),
                  passwordHash: placeholderHash,
                  privacy: { create: {} },
                },
                select: { id: true },
              });
              userId = user.id;
            }

            await tx.membership.upsert({
              where: {
                userId_collegeId_role: { userId, collegeId, role: row.role as never },
              },
              create: { userId, collegeId, role: row.role as never, state: "INVITED" },
              update: {},
            });

            created += 1;
          } else if (row.outcome === "update" && userId) {
            if (row.changes?.name) {
              await tx.user.update({ where: { id: userId }, data: { name: row.name } });
            }
            updated += 1;
          }

          if (userId && classId) {
            await tx.classEnrolment.upsert({
              where: { classId_userId: { classId, userId } },
              create: { classId, userId },
              update: {},
            });
            enrolled += 1;
          }
        }

        await logAudit(
          {
            actorId: viewer.userId,
            collegeId,
            action: "import.commit",
            subjectType: "College",
            subjectId: collegeId,
            after: {
              created,
              updated,
              enrolled,
              skipped: plan.counts.skip,
              errors: plan.counts.error,
            },
          },
          tx,
        );

        return { created, updated, enrolled };
      },
      // 500 rows of inserts needs more than Prisma's 5-second default.
      { timeout: 30_000 },
    );

    revalidatePath("/admin/people");
    return {
      ok: true,
      message: `Imported ${summary.created} new, updated ${summary.updated}${summary.enrolled ? `, enrolled ${summary.enrolled}` : ""}. ${plan.counts.error} row${plan.counts.error === 1 ? "" : "s"} skipped for errors.`,
    };
  } catch (error) {
    return fail(error);
  }
}

async function uniqueUsernameTx(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  name: string,
  email: string,
): Promise<string> {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30) || (email.split("@")[0] ?? "member").replace(/[^a-z0-9]+/g, "-");

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await tx.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }

  return `${base}-${randomBytes(4).toString("hex")}`;
}

/* ------------------------------------------------------- college branding */

/**
 * The college logo and accent colour.
 *
 * Both were written in Phase 5 and left unbuilt because storage did not exist;
 * Phase 7 built it, so this closes that hand-off.
 *
 * Audited like every other administrative mutation, and for a sharper reason
 * than most: the logo and the colour are what a college's public page looks
 * like, so "who changed our branding, and when" is a question somebody will
 * eventually ask with feeling.
 */
const accentSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex colour, like #4f46e5.")
  .optional()
  .or(z.literal(""));

export async function saveCollegeBranding(
  _previous: AdminResult | null,
  formData: FormData,
): Promise<AdminResult> {
  try {
    const collegeId = z.string().min(1).parse(formData.get("collegeId"));
    const accentColor = accentSchema.parse(formData.get("accentColor") ?? "");
    const viewer = await guard(collegeId, "college:edit");

    const before = await db.college.findUnique({
      where: { id: collegeId },
      select: { logoUrl: true, accentColor: true },
    });
    if (!before) return { ok: false, error: "That college no longer exists." };

    const file = formData.get("logo");
    const removing = formData.get("removeLogo") === "true";

    let logoUrl = before.logoUrl;

    if (file instanceof File && file.size > 0) {
      const stored = await storeImage("logo", collegeId, file);
      if (!stored.ok) return { ok: false, error: stored.error, field: "logo" };
      logoUrl = stored.url;
    } else if (removing) {
      logoUrl = null;
    }

    await db.$transaction(async (tx) => {
      const updated = await tx.college.update({
        where: { id: collegeId },
        data: { logoUrl, accentColor: accentColor || null },
      });

      await logChange(
        {
          actorId: viewer.userId,
          collegeId,
          action: "college.update",
          subjectType: "College",
          subjectId: updated.id,
          before: { logoUrl: before.logoUrl, accentColor: before.accentColor },
          after: { logoUrl: updated.logoUrl, accentColor: updated.accentColor },
        },
        tx,
      );
    });

    // The old object goes only after the row is committed. Reversed, a failed
    // update would leave the page pointing at bytes that are already gone —
    // and a broken logo is more visible than an orphaned file.
    if (logoUrl !== before.logoUrl) await forgetImage(before.logoUrl);

    revalidatePath("/admin/college");
    revalidatePath("/colleges");
    return { ok: true, message: "Branding saved." };
  } catch (error) {
    return fail(error);
  }
}
