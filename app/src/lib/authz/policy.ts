import type { $Enums } from "@prisma/client";

import {
  belongsTo,
  canWriteAt,
  enrolledInClass,
  hasRoleAt,
  isGroupLead,
  isGroupMember,
  isGuestAt,
  isSuspendedAt,
  teachesClass,
  teachesSubject,
  type Viewer,
} from "./viewer";

/**
 * THE PERMISSION MATRIX — the single source of authorisation truth.
 *
 * `docs/ROLES-PERMISSIONS.md` is the contract; this file is its implementation;
 * `policy.test.ts` asserts the two agree, role by role and scope by scope. If
 * the three ever disagree, the document is the specification and this file is
 * the bug.
 *
 * **No feature re-implements a permission check.** Not "should not" — the whole
 * value of this file is that there is exactly one place to look when asking
 * "who can do this", and exactly one place to fix when the answer is wrong. A
 * second check somewhere in a route handler is how a permission model rots:
 * the two drift, and the more permissive one wins silently.
 *
 * Two rules that are easy to get backwards, from the same document:
 *
 * - **A denied read returns `null`, not a 403.** A 403 confirms the resource
 *   exists, which leaks the existence of private projects and private profiles.
 * - **A denied write throws.** The user already knew the resource existed;
 *   telling them they may not change it is correct and more useful than a
 *   silent no-op.
 *
 * `can()` itself only ever returns a boolean. Turning `false` into a null or an
 * error is the caller's job, because only the caller knows whether it is
 * reading or writing.
 */

/* ----------------------------------------------------------------- actions */

export type Action =
  // Projects
  | "project:create"
  | "project:read"
  | "project:edit"
  | "project:approve"
  | "project:visibility"
  | "project:embargo"
  | "project:submit"
  | "project:evaluate"
  | "project:archive"
  | "project:delete"
  | "project:fork"
  | "project:comment"
  // Group workspace
  | "group:create"
  | "group:join"
  | "group:invite"
  | "workspace:read"
  | "task:write"
  | "file:upload"
  | "file:delete"
  | "discussion:post"
  | "meeting:schedule"
  | "ledger:read"
  | "peerreview:submit"
  | "peerreview:read:individual"
  // Institution administration
  | "college:manage"
  | "class:manage"
  | "roster:manage"
  | "invite:issue"
  | "member:suspend"
  | "college:edit"
  | "college:verify:request"
  | "college:verify:grant"
  | "audit:read"
  | "export:generate"
  // Social, feed and network
  | "post:create"
  | "comment:create"
  | "follow:create"
  | "collab:request"
  | "mentorship:offer"
  | "opportunity:post"
  | "student:contact"
  | "report:create"
  | "report:moderate";

/**
 * Actions that only read. Everything else is a write, and a write additionally
 * requires a verified email and a non-suspended membership.
 *
 * Listed explicitly rather than inferred from the action name: `project:read`
 * and `workspace:read` are obvious, `ledger:read` less so, and a naming
 * convention that silently decides security policy is a convention waiting to
 * be broken by a plausible-looking new action.
 */
const READ_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  "project:read",
  "workspace:read",
  "ledger:read",
  "peerreview:read:individual",
  "audit:read",
  // Forking reads the source and creates nothing here — the new project is a
  // separate project:create check against the forker's own group. Gating it on
  // the SOURCE college would make cross-college lineage impossible, which is
  // most of the point of recording lineage at all.
  "project:fork",
]);

/* --------------------------------------------------------------- resources */

export type ProjectResource = {
  kind: "project";
  collegeId: string;
  /** The owning group, when it has one. */
  groupId: string | null;
  /** The subject this project sits under — the faculty scope. */
  subjectId: string | null;
  classId: string | null;
  visibility: $Enums.Visibility;
  approved: boolean;
  status: $Enums.ProjectStatus;
  /** True when the owning college has completed verification. */
  collegeVerified: boolean;
  embargoUntil: Date | null;
  /** Members credited on the project. */
  memberIds: readonly string[];
};

export type GroupResource = {
  kind: "group";
  collegeId: string;
  groupId: string;
  classId: string | null;
  subjectId: string | null;
};

export type CollegeResource = {
  kind: "college";
  collegeId: string;
};

export type ClassResource = {
  kind: "class";
  collegeId: string;
  classId: string;
  subjectId: string;
};

export type UserResource = {
  kind: "user";
  userId: string;
  collegeId: string | null;
  /** The subject's own opt-in. Off by default (DPDP). */
  contactable: boolean;
};

export type CompanyResource = {
  kind: "company";
  companyUserId: string;
  verified: boolean;
};

export type ReportResource = {
  kind: "report";
  collegeId: string | null;
  subjectId: string | null;
};

export type Resource =
  | ProjectResource
  | GroupResource
  | CollegeResource
  | ClassResource
  | UserResource
  | CompanyResource
  | ReportResource;

/* ------------------------------------------------------------------- can() */

/**
 * The only place a permission is decided.
 *
 * Returns false for anything not explicitly allowed — the default is denial,
 * so a new action added to the union without a case here is refused rather
 * than permitted. That is the safe direction for the mistake to fall in.
 */
export function can(viewer: Viewer, action: Action, resource?: Resource): boolean {
  // Platform admin bypasses the matrix. Every action it takes is written to the
  // append-only AuditLog, which is the check that replaces this one.
  if (viewer.isPlatformAdmin) return allowedForPlatformAdmin(action);

  // The logged-out public reads genuinely public work and does nothing else.
  // Routing it through the same predicate as everyone else is the point of
  // ANONYMOUS being a real viewer: one code path, not two.
  if (viewer.userId === null) {
    return action === "project:read" && canReadProject(viewer, resource);
  }

  const collegeId = collegeOf(resource);

  // Suspended is read-only on everything, and a write needs a verified email.
  if (!READ_ACTIONS.has(action)) {
    if (!viewer.emailVerified) return false;
    if (collegeId && isSuspendedAt(viewer, collegeId)) return false;
    if (collegeId && !canWriteAt(viewer, collegeId)) return false;
  }

  switch (action) {
    /* ------------------------------------------------------------ projects */

    case "project:read":
      return canReadProject(viewer, resource);

    case "project:create": {
      // Students create within a group they are in; faculty within a subject
      // they teach.
      if (resource?.kind === "group") {
        return (
          isGroupMember(viewer, resource.groupId) || teachesSubject(viewer, resource.subjectId)
        );
      }
      if (resource?.kind === "class") {
        return enrolledInClass(viewer, resource.classId) || teachesClass(viewer, resource.classId);
      }
      return false;
    }

    case "project:edit":
      // Faculty comment, they do not edit. A faculty member who can silently
      // rewrite a group's work destroys the evidentiary value of the ledger.
      return resource?.kind === "project" && isGroupMember(viewer, resource.groupId);

    case "project:comment":
      return (
        resource?.kind === "project" &&
        (isGroupMember(viewer, resource.groupId) || teachesSubject(viewer, resource.subjectId))
      );

    case "project:approve":
    case "project:evaluate":
      return resource?.kind === "project" && teachesSubject(viewer, resource.subjectId);

    case "project:submit":
      return resource?.kind === "project" && isGroupLead(viewer, resource.groupId);

    case "project:visibility":
      if (resource?.kind !== "project") return false;
      return (
        isGroupLead(viewer, resource.groupId) ||
        teachesSubject(viewer, resource.subjectId) ||
        hasRoleAt(viewer, resource.collegeId, "COLLEGE_ADMIN")
      );

    case "project:embargo":
      if (resource?.kind !== "project") return false;
      return (
        isGroupLead(viewer, resource.groupId) ||
        teachesSubject(viewer, resource.subjectId) ||
        hasRoleAt(viewer, resource.collegeId, "COLLEGE_ADMIN")
      );

    case "project:archive":
      if (resource?.kind !== "project") return false;
      return (
        teachesSubject(viewer, resource.subjectId) ||
        hasRoleAt(viewer, resource.collegeId, "COLLEGE_ADMIN")
      );

    case "project:delete":
      // Own draft only. Once work is proposed it belongs to the record, and the
      // archive is the point of the product.
      if (resource?.kind !== "project") return false;
      return (
        resource.status === "DRAFT" &&
        isGroupMember(viewer, resource.groupId) &&
        resource.memberIds.includes(viewer.userId)
      );

    case "project:fork":
      // You may build on anything you can read.
      return canReadProject(viewer, resource);

    /* ----------------------------------------------------------- workspace */

    case "group:create":
      if (resource?.kind === "class") {
        return enrolledInClass(viewer, resource.classId) || teachesClass(viewer, resource.classId);
      }
      if (resource?.kind === "college") {
        return hasRoleAt(viewer, resource.collegeId, "COLLEGE_ADMIN");
      }
      return false;

    case "group:join":
      // Joining is about yourself, so only college membership is required.
      return resource?.kind === "group" && belongsTo(viewer, resource.collegeId);

    case "group:invite":
      if (resource?.kind !== "group") return false;
      return (
        isGroupLead(viewer, resource.groupId) ||
        teachesSubject(viewer, resource.subjectId) ||
        hasRoleAt(viewer, resource.collegeId, "COLLEGE_ADMIN")
      );

    case "workspace:read":
      if (resource?.kind !== "group") return false;
      // Deliberately NOT college admin: an administrator does not get to read a
      // team's working discussions. They see reports, not the room.
      return isGroupMember(viewer, resource.groupId) || teachesSubject(viewer, resource.subjectId);

    case "task:write":
    case "discussion:post":
    case "meeting:schedule":
      if (resource?.kind !== "group") return false;
      return isGroupMember(viewer, resource.groupId) || teachesSubject(viewer, resource.subjectId);

    case "file:upload":
      if (resource?.kind !== "group") return false;
      return isGroupMember(viewer, resource.groupId) || teachesSubject(viewer, resource.subjectId);

    case "file:delete":
      // Faculty may add material, never remove it — see the note on read-only
      // faculty access. Deletion by a supervisor is indistinguishable from
      // tampering after the fact.
      return resource?.kind === "group" && isGroupMember(viewer, resource.groupId);

    case "ledger:read":
      if (resource?.kind !== "group") return false;
      return (
        isGroupMember(viewer, resource.groupId) ||
        teachesSubject(viewer, resource.subjectId) ||
        // Aggregate only — enforced by the query, which never returns per-member
        // rows to an administrator.
        hasRoleAt(viewer, resource.collegeId, "COLLEGE_ADMIN")
      );

    case "peerreview:submit":
      return resource?.kind === "group" && isGroupMember(viewer, resource.groupId);

    case "peerreview:read:individual":
      // ADR-008, and the reason honest peer review is possible at all: a member
      // sees only the aggregate about themselves, never who said what.
      return resource?.kind === "group" && teachesSubject(viewer, resource.subjectId);

    /* ------------------------------------------------------- institutional */

    case "college:manage":
    case "class:manage":
    case "roster:manage":
    case "invite:issue":
    case "member:suspend":
    case "college:edit":
    case "college:verify:request":
    case "audit:read":
    case "export:generate":
      return (
        collegeId !== null &&
        !isGuestAt(viewer, collegeId) &&
        hasRoleAt(viewer, collegeId, "COLLEGE_ADMIN")
      );

    case "college:verify:grant":
      // Only us. A college that could verify itself is not a trust gate.
      return false;

    /* -------------------------------------------------------------- social */

    case "post:create":
      // A company posts about its own opportunities, nothing else.
      if (resource?.kind === "company") return resource.companyUserId === viewer.userId;
      return hasAnyActiveMembership(viewer) && !isCompanyOnly(viewer);

    case "comment:create":
    case "follow:create":
    case "report:create":
      return hasAnyActiveMembership(viewer);

    case "collab:request":
      // Alumni and companies do not initiate collaboration requests; they offer
      // mentorship and post opportunities instead.
      return (
        hasAnyActiveMembership(viewer) &&
        (hasAnyRoleIn(viewer, ["STUDENT", "FACULTY", "RESEARCHER"]) as boolean)
      );

    case "mentorship:offer":
      return hasAnyRoleIn(viewer, ["FACULTY", "ALUMNI", "COMPANY", "RESEARCHER"]);

    case "opportunity:post":
      // The anti-abuse gate. An unverified company cannot post, cannot contact a
      // student, and does not appear in search — fake internships that charge a
      // "certificate fee" are a real scam aimed at exactly these students.
      if (resource?.kind !== "company") return false;
      return resource.verified && resource.companyUserId === viewer.userId;

    case "student:contact":
      return canContact(viewer, resource);

    case "report:moderate":
      if (resource?.kind !== "report") return false;
      if (resource.subjectId && teachesSubject(viewer, resource.subjectId)) return true;
      return resource.collegeId !== null && hasRoleAt(viewer, resource.collegeId, "COLLEGE_ADMIN");

    default:
      return false;
  }
}

/* ------------------------------------------------------------- predicates */

/**
 * Project readability — the most-called predicate in the product, and the one
 * that must agree exactly with `visibleTo()` in the query layer. The query
 * layer expresses this as SQL for lists; this expresses it for a single loaded
 * resource. `policy.test.ts` asserts they agree.
 */
function canReadProject(viewer: Viewer, resource?: Resource): boolean {
  if (resource?.kind !== "project") return false;

  // Public means public — but only from a verified college (ADR-010). An
  // unverified college's work is never publicly reachable; that is the
  // anti-abuse gate that keeps the network credible.
  if (resource.visibility === "PUBLIC" && resource.approved && resource.collegeVerified) {
    return true;
  }

  if (viewer.userId === null) return false;

  // Credited members and the owning group always retain access, at any
  // visibility. Losing sight of your own work would be the worst bug available.
  if (resource.memberIds.includes(viewer.userId)) return true;
  if (isGroupMember(viewer, resource.groupId)) return true;

  // The supervising faculty member.
  if (teachesSubject(viewer, resource.subjectId)) return true;

  // College-wide reach — never for guests, who see only their own groups.
  if (resource.visibility === "COLLEGE" || resource.visibility === "CLASS") {
    if (belongsTo(viewer, resource.collegeId)) {
      if (resource.visibility === "CLASS" && resource.classId) {
        return enrolledInClass(viewer, resource.classId) || teachesClass(viewer, resource.classId);
      }
      return true;
    }
  }

  // A college admin reads everything in their own college.
  if (hasRoleAt(viewer, resource.collegeId, "COLLEGE_ADMIN")) return true;

  return false;
}

/**
 * A company cannot message a student unless the student has opted in. This is
 * non-negotiable, and it is the difference between a talent platform and a spam
 * channel.
 */
function canContact(viewer: Viewer, resource?: Resource): boolean {
  if (resource?.kind !== "user") return false;
  if (resource.userId === viewer.userId) return false;
  if (!resource.contactable) return false;

  // Within a college, ordinary members may contact each other subject to the
  // same opt-in.
  if (resource.collegeId && belongsTo(viewer, resource.collegeId)) return true;

  // From outside, only roles that have a legitimate reason to reach in.
  return hasAnyRoleIn(viewer, ["COMPANY", "ALUMNI", "RESEARCHER", "FACULTY"]);
}

function hasAnyActiveMembership(viewer: Viewer): boolean {
  return viewer.memberships.some((m) => m.state === "ACTIVE" || m.state === "ALUMNI");
}

function hasAnyRoleIn(viewer: Viewer, roles: readonly $Enums.Role[]): boolean {
  return viewer.memberships.some(
    (m) => roles.includes(m.role) && (m.state === "ACTIVE" || m.state === "ALUMNI"),
  );
}

function isCompanyOnly(viewer: Viewer): boolean {
  const active = viewer.memberships.filter((m) => m.state === "ACTIVE" || m.state === "ALUMNI");
  return active.length > 0 && active.every((m) => m.role === "COMPANY");
}

function collegeOf(resource?: Resource): string | null {
  if (!resource) return null;

  switch (resource.kind) {
    case "project":
    case "group":
    case "college":
    case "class":
      return resource.collegeId;
    case "user":
    case "report":
      return resource.collegeId;
    case "company":
      return null;
  }
}

/**
 * What a platform admin may do.
 *
 * Not simply `true`. Two things are withheld deliberately: grading a project,
 * because an academic judgement belongs to the faculty member who supervised
 * the work and nobody else, and submitting a peer review, because it would be
 * a fabricated one. Both would otherwise be quietly possible.
 */
function allowedForPlatformAdmin(action: Action): boolean {
  return action !== "project:evaluate" && action !== "peerreview:submit";
}

/* --------------------------------------------------------------- helpers */

/**
 * Assert a permission, for write paths.
 *
 * Reads must not use this — a denied read returns `null` so that a private
 * resource is indistinguishable from a missing one.
 */
export class ForbiddenError extends Error {
  readonly action: Action;

  constructor(action: Action, message?: string) {
    super(message ?? `You do not have permission to ${action.replace(/[:.]/g, " ")}.`);
    this.name = "ForbiddenError";
    this.action = action;
  }
}

export function assertCan(viewer: Viewer, action: Action, resource?: Resource): void {
  if (!can(viewer, action, resource)) throw new ForbiddenError(action);
}
