import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";

import { db } from "@/lib/db/client";

/**
 * THE AUDIT LOG.
 *
 * Append-only, and deliberately awkward to use any other way: this module
 * exports `logAudit` and nothing that updates or deletes. A log that can be
 * edited is not evidence, and the whole reason an administrator's actions are
 * recorded is so that a disputed suspension, a changed grade or a mass role
 * change can be answered with a fact rather than a recollection.
 *
 * Every administrative mutation in Phase 5 calls this. `logAudit` takes the
 * transaction client so the entry and the change it describes commit or fail
 * together — an audit row that survives a rolled-back change is a lie, and one
 * that is lost when the change succeeds is worse.
 */

export type AuditAction =
  // Hierarchy
  | "department.create"
  | "department.update"
  | "department.archive"
  | "programme.create"
  | "programme.update"
  | "programme.archive"
  | "subject.create"
  | "subject.update"
  | "subject.archive"
  | "term.create"
  | "term.update"
  | "term.activate"
  | "class.create"
  | "class.update"
  | "class.archive"
  | "class.faculty.assign"
  | "class.faculty.remove"
  | "class.enrol"
  | "class.unenrol"
  // People
  | "member.invite"
  | "member.role.change"
  | "member.suspend"
  | "member.reinstate"
  | "member.remove"
  | "member.alumni.transition"
  | "import.dry-run"
  | "import.commit"
  // Invitations
  | "invitation.issue"
  | "invitation.revoke"
  | "invitation.resend"
  | "invitation.accept"
  | "joincode.rotate"
  // College
  | "college.update"
  | "college.verify.request"
  | "college.verify.approve"
  | "college.verify.reject";

export type AuditEntry = {
  /** Null for a system action; every human action names its actor. */
  actorId: string | null;
  collegeId: string | null;
  action: AuditAction;
  subjectType: string;
  subjectId: string;
  /** State before and after. Both optional — a create has no before. */
  before?: unknown;
  after?: unknown;
  /** Required for suspension and rejection; the reason is the point of those. */
  reason?: string;
  ip?: string | null;
};

/** A Prisma client or an interactive transaction — both can write. */
type Writable = PrismaClient | Prisma.TransactionClient;

/**
 * Fields that must never reach the log.
 *
 * An audit entry is read by administrators and exported to CSV, so it is the
 * last place a password hash or a session token should end up. Diffing whole
 * rows is convenient and would otherwise quietly copy them.
 */
const REDACTED = new Set([
  "passwordHash",
  "sessionToken",
  "tokenHash",
  "ipHash",
  "code",
  "accessToken",
  "refreshToken",
  "idToken",
]);

function scrub(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 6) return "[deep]";

  if (Array.isArray(value)) return value.slice(0, 100).map((item) => scrub(item, depth + 1));

  if (value instanceof Date) return value.toISOString();

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, inner]) => [
        key,
        REDACTED.has(key) ? "[redacted]" : scrub(inner, depth + 1),
      ]),
    );
  }

  // Long free text bloats the log without adding to it.
  if (typeof value === "string" && value.length > 2000) return `${value.slice(0, 2000)}…`;

  return value;
}

/**
 * Keep only what actually changed.
 *
 * A full before/after of a 30-column row buries the one field that moved. This
 * is what makes the log readable a year later, which is the only time anybody
 * reads it.
 */
export function diff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  if (!before || !after) return null;

  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};

  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[key];
    const b = after[key];
    if (JSON.stringify(scrub(a)) === JSON.stringify(scrub(b))) continue;

    changedBefore[key] = a;
    changedAfter[key] = b;
  }

  if (Object.keys(changedAfter).length === 0) return null;

  return { before: changedBefore, after: changedAfter };
}

export async function logAudit(entry: AuditEntry, client: Writable = db): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: entry.actorId,
      collegeId: entry.collegeId,
      action: entry.action,
      subjectType: entry.subjectType,
      subjectId: entry.subjectId,
      before:
        entry.before === undefined ? undefined : (scrub(entry.before) as Prisma.InputJsonValue),
      after: entry.after === undefined ? undefined : (scrub(entry.after) as Prisma.InputJsonValue),
      reason: entry.reason ?? null,
      // Hashed, never the raw address (DPDP) — the log answers "was this the
      // same place as last time", not "where does this person live".
      ipHash: entry.ip
        ? createHash("sha256").update(entry.ip).digest("base64url").slice(0, 22)
        : null,
    },
  });
}

/**
 * Convenience for the common shape: log a change and keep only the diff.
 * Returns silently when nothing actually changed, so a no-op save does not fill
 * the log with empty entries.
 */
export async function logChange(
  entry: Omit<AuditEntry, "before" | "after"> & {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  },
  client: Writable = db,
): Promise<void> {
  const changed = diff(entry.before, entry.after);
  if (!changed) return;

  await logAudit({ ...entry, before: changed.before, after: changed.after }, client);
}

/* -------------------------------------------------------------- reading */

export type AuditFilter = {
  collegeId: string;
  actorId?: string;
  action?: string;
  subjectType?: string;
  from?: Date;
  to?: Date;
  take?: number;
  skip?: number;
};

export async function readAudit(filter: AuditFilter) {
  const { collegeId, actorId, action, subjectType, from, to, take = 50, skip = 0 } = filter;

  return db.auditLog.findMany({
    where: {
      collegeId,
      ...(actorId ? { actorId } : {}),
      ...(action ? { action } : {}),
      ...(subjectType ? { subjectType } : {}),
      ...(from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    },
    select: {
      id: true,
      action: true,
      subjectType: true,
      subjectId: true,
      before: true,
      after: true,
      reason: true,
      createdAt: true,
      actor: { select: { id: true, name: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
    skip,
  });
}

export async function countAudit(filter: Pick<AuditFilter, "collegeId" | "action">) {
  return db.auditLog.count({
    where: { collegeId: filter.collegeId, ...(filter.action ? { action: filter.action } : {}) },
  });
}
