"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { currentViewer } from "@/lib/auth/session";
import { teachesSubject, type Viewer } from "@/lib/authz/viewer";
import { db } from "@/lib/db/client";
import { recomputeSkills } from "@/lib/profile/actions";
import { skillSlug } from "@/lib/skills/infer";

import { attestationCode, validateRevocation, validateStatement } from "./attestation";

/**
 * ISSUING AND REVOKING ATTESTATIONS.
 *
 * The credential mechanism, and the file where the product's most consequential
 * claim is written down: **a named human vouched for this**.
 *
 * There is deliberately no automatic path. No threshold, no "attest everybody
 * above 30% share", no bulk action. The ledger writes a draft sentence; a person
 * edits it and signs. `validateStatement` refuses a submission that still
 * contains the draft prompt, which is the one way an automatic attestation could
 * sneak through wearing somebody's name.
 *
 * **Revocation preserves the record.** There is no delete path here at all —
 * the same discipline as the ledger and the audit log, for the same reason: a
 * credential that can vanish silently is not a credential, and a mistake that
 * can be made never to have happened is not a mistake anybody learns from.
 */

export type AttestResult =
  { ok: true; message: string; code?: string } | { ok: false; error: string; field?: string };

const fail = (error: unknown): AttestResult => ({
  ok: false,
  error: error instanceof Error ? error.message : "Something went wrong.",
});

async function actor(): Promise<Viewer & { userId: string }> {
  const viewer = await currentViewer();
  if (!viewer.userId) throw new Error("Sign in first.");
  return viewer as Viewer & { userId: string };
}

const issueSchema = z.object({
  projectSlug: z.string().min(1),
  subjectType: z.enum(["project", "contribution"]),
  /** Required for a contribution; absent for a project outcome. */
  subjectUserId: z.string().optional(),
  statement: z.string().max(4000),
  /** Comma-separated skills to promote to ATTESTED. Contributions only. */
  skills: z.string().optional(),
});

/**
 * Issue an attestation.
 *
 * Scoped to the subject the faculty member teaches — the same per-subject rule
 * as everything else faculty do (ADR-029). A professor cannot vouch for work in
 * a department they have never taught in, which is what makes the credential
 * mean something to a reader outside the college.
 */
export async function issueAttestation(
  _previous: AttestResult | null,
  formData: FormData,
): Promise<AttestResult> {
  try {
    const input = issueSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();

    const project = await db.project.findFirst({
      where: { slug: input.projectSlug, deletedAt: null },
      select: {
        id: true,
        slug: true,
        title: true,
        group: {
          select: {
            class: { select: { subjectId: true } },
            members: { where: { leftAt: null }, select: { userId: true } },
          },
        },
        members: { select: { userId: true } },
      },
    });
    if (!project) return { ok: false, error: "That project is not available." };

    if (!teachesSubject(viewer, project.group?.class?.subjectId ?? null)) {
      return {
        ok: false,
        error:
          "You can only attest work in a subject you teach — that is what makes it mean something.",
      };
    }

    const valid = validateStatement(input.statement);
    if (!valid.ok) return { ok: false, field: "statement", error: valid.error };

    /* ------------------------------------------------ a contribution */

    let subjectUserId: string | null = null;

    if (input.subjectType === "contribution") {
      subjectUserId = input.subjectUserId?.trim() || null;
      if (!subjectUserId) {
        return { ok: false, field: "subjectUserId", error: "Choose who this attests." };
      }

      const credited = project.members.some((member) => member.userId === subjectUserId);
      if (!credited) {
        return {
          ok: false,
          field: "subjectUserId",
          error: "That person is not credited on this project.",
        };
      }
    }

    const skills = (input.skills ?? "")
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean)
      .slice(0, 8);

    const code = attestationCode();

    await db.$transaction(async (tx) => {
      await tx.attestation.create({
        data: {
          attesterId: viewer.userId,
          subjectUserId,
          subjectType: input.subjectType,
          subjectId: project.id,
          statement: input.statement.trim(),
          code,
        },
      });

      // A project attestation raises every credited member to the attested
      // tier; a contribution attestation raises exactly one. This is the only
      // place FACULTY_ATTESTED is ever written (Phase 6's rule).
      const raise = subjectUserId
        ? [subjectUserId]
        : project.members.map((member) => member.userId);

      await tx.projectMember.updateMany({
        where: { projectId: project.id, userId: { in: raise } },
        data: { tier: "FACULTY_ATTESTED" },
      });

      if (subjectUserId && skills.length > 0) {
        for (const label of skills) {
          // `Skill` is the shared vocabulary; `UserSkill` is one person's claim
          // on it. Upserting the skill first is how Phase 6 does it, and using
          // the same path keeps one spelling of "LoRaWAN" across the product.
          const skill = await tx.skill.upsert({
            where: { slug: skillSlug(label) },
            create: { slug: skillSlug(label), name: label },
            update: {},
            select: { id: true },
          });

          await tx.userSkill.upsert({
            where: { userId_skillId: { userId: subjectUserId, skillId: skill.id } },
            create: {
              userId: subjectUserId,
              skillId: skill.id,
              source: "ATTESTED",
              projectIds: [project.id],
            },
            // An attestation outranks anything derived. `recomputeSkills` never
            // overwrites it — only the person who signed it can withdraw it.
            update: { source: "ATTESTED" },
          });
        }
      }
    });

    // Outside the transaction: join-heavy, and a slow recompute must not hold a
    // lock on rows a student's profile is reading.
    for (const userId of subjectUserId
      ? [subjectUserId]
      : project.members.map((member) => member.userId)) {
      await recomputeSkills(userId);
    }

    revalidatePath("/faculty/attestations");
    revalidatePath(`/projects/${project.slug}`);

    return { ok: true, code, message: `Attested. The verification code is ${code}.` };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Revoke an attestation.
 *
 * The record stays. It renders as revoked, with the reason and both dates, so
 * a reader who saw the original can find out what happened to it rather than
 * discovering a dead link.
 */
export async function revokeAttestation(
  _previous: AttestResult | null,
  formData: FormData,
): Promise<AttestResult> {
  try {
    const input = z
      .object({
        attestationId: z.string().min(1),
        reason: z.string().trim().max(1000),
      })
      .parse(Object.fromEntries(formData));

    const viewer = await actor();

    const valid = validateRevocation(input.reason);
    if (!valid.ok) return { ok: false, field: "reason", error: valid.error };

    const attestation = await db.attestation.findUnique({
      where: { id: input.attestationId },
      select: {
        id: true,
        attesterId: true,
        revokedAt: true,
        subjectUserId: true,
        subjectType: true,
        subjectId: true,
      },
    });
    if (!attestation) return { ok: false, error: "That attestation no longer exists." };

    // Only the person who signed it. An attestation somebody else can withdraw
    // is not a personal vouching, which is the whole basis of its value.
    if (attestation.attesterId !== viewer.userId) {
      return { ok: false, error: "Only the faculty member who issued it can revoke it." };
    }

    if (attestation.revokedAt) return { ok: true, message: "Already revoked." };

    await db.$transaction(async (tx) => {
      await tx.attestation.update({
        where: { id: attestation.id },
        data: { revokedAt: new Date(), revokedReason: input.reason },
      });

      // The tier drops back to what the evidence alone supports. Which tier
      // that is comes from the ledger, so it is recomputed rather than guessed.
      const affected = attestation.subjectUserId
        ? [attestation.subjectUserId]
        : (
            await tx.projectMember.findMany({
              where: { projectId: attestation.subjectId },
              select: { userId: true },
            })
          ).map((member) => member.userId);

      const stillAttested = await tx.attestation.findMany({
        where: {
          subjectId: attestation.subjectId,
          revokedAt: null,
          OR: [{ subjectUserId: { in: affected } }, { subjectUserId: null }],
        },
        select: { subjectUserId: true },
      });

      const keep = new Set(
        stillAttested.flatMap((row) => (row.subjectUserId ? [row.subjectUserId] : affected)),
      );

      const demote = affected.filter((userId) => !keep.has(userId));
      if (demote.length > 0) {
        await tx.projectMember.updateMany({
          where: { projectId: attestation.subjectId, userId: { in: demote } },
          data: { tier: "SELF" },
        });

        await tx.userSkill.updateMany({
          where: { userId: { in: demote }, source: "ATTESTED" },
          data: { source: "PROJECT_INFERRED" },
        });
      }
    });

    for (const userId of attestation.subjectUserId ? [attestation.subjectUserId] : []) {
      await recomputeSkills(userId);
    }

    revalidatePath("/faculty/attestations");
    return {
      ok: true,
      message: "Revoked. The record is kept and shows as revoked, with your reason.",
    };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Look up an attestation by its printed code.
 *
 * Public by design — a code on a CV is worth nothing if the person reading it
 * needs an account to check it. Returns only what a verifier needs: the
 * statement, who signed it, when, and whether it still stands.
 */
export async function verifyAttestation(code: string) {
  const normalised = code.trim().toUpperCase();

  const attestation = await db.attestation.findUnique({
    where: { code: normalised },
    select: {
      code: true,
      statement: true,
      subjectType: true,
      subjectId: true,
      issuedAt: true,
      revokedAt: true,
      revokedReason: true,
      subject: { select: { name: true, username: true } },
      attester: {
        select: {
          name: true,
          facultyProfile: { select: { designation: true } },
          memberships: {
            where: { role: "FACULTY" },
            select: { college: { select: { name: true } } },
            take: 1,
          },
        },
      },
    },
  });

  return attestation;
}
