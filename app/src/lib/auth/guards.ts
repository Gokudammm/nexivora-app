import { forbidden, redirect, unauthorized } from "next/navigation";

import { can, type Action, type Resource } from "@/lib/authz/policy";
import { hasRoleAt, type Viewer } from "@/lib/authz/viewer";
import type { $Enums } from "@prisma/client";

import { currentViewer } from "./session";

/**
 * Route guards.
 *
 * These are the **convenience** layer, not the security layer. The security
 * layer is the query: `visibleTo(viewer)` and `can()` decide what a request may
 * see, and they do so whether or not a guard ran.
 *
 * That ordering matters and is easy to get backwards. A guard protects a page;
 * it does not protect data. A Server Action reached directly, a route handler
 * someone adds later, a query called from a component the guard does not
 * wrap — none of those go past a guard, and all of them go past the query. If
 * these ever become the only check, the boundary has moved to the wrong place.
 *
 * Phase 4's acceptance criterion 3 is the test of exactly this: cross-college
 * reads must return null **with the proxy disabled**.
 */

/** The signed-in viewer, or a redirect to sign in and come back. */
export async function requireAuth(returnTo?: string): Promise<Viewer & { userId: string }> {
  const viewer = await currentViewer();

  if (viewer.userId === null) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/login${next}`);
  }

  return viewer as Viewer & { userId: string };
}

/**
 * A verified account. Unverified users may browse; they may not create
 * anything (acceptance criterion 9).
 */
export async function requireVerified(returnTo?: string): Promise<Viewer & { userId: string }> {
  const viewer = await requireAuth(returnTo);
  if (!viewer.emailVerified) redirect("/verify-email");

  return viewer;
}

/**
 * A role at a specific college. There is no college-less variant on purpose:
 * roles are per-membership, so "is this person faculty" is not a question with
 * an answer — only "are they faculty *here*" is.
 */
export async function requireRoleAt(
  collegeId: string,
  role: $Enums.Role,
  returnTo?: string,
): Promise<Viewer & { userId: string }> {
  const viewer = await requireAuth(returnTo);
  if (!hasRoleAt(viewer, collegeId, role)) forbidden();

  return viewer;
}

/**
 * Assert a permission for a page.
 *
 * `notFound` rather than `forbidden` for reads is the caller's decision, not
 * this function's — see `requireReadable` below.
 */
export async function requirePermission(
  action: Action,
  resource?: Resource,
): Promise<Viewer & { userId: string }> {
  const viewer = await requireAuth();
  if (!can(viewer, action, resource)) forbidden();

  return viewer;
}

/**
 * For pages that must not confirm a resource exists.
 *
 * Returns a boolean so the caller can `notFound()` itself — a 403 on a private
 * project tells an attacker the project is there, which is precisely what the
 * visibility model exists to avoid.
 */
export async function canRead(action: Action, resource?: Resource): Promise<boolean> {
  const viewer = await currentViewer();
  return can(viewer, action, resource);
}

/** For unauthenticated API routes that should answer 401 rather than redirect. */
export async function requireApiAuth(): Promise<Viewer & { userId: string }> {
  const viewer = await currentViewer();
  if (viewer.userId === null) unauthorized();

  return viewer as Viewer & { userId: string };
}
