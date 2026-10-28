import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { cookies, headers } from "next/headers";

import { ANONYMOUS, type Viewer } from "@/lib/authz/viewer";
import { db } from "@/lib/db/client";
import { env, isProduction } from "@/lib/env";

import { loadViewer } from "./viewer";

/**
 * SESSIONS.
 *
 * Opaque random tokens in an httpOnly cookie, hashed at rest, resolved against
 * the `Session` table Phase 3 modelled for exactly this.
 *
 * **Why not Auth.js**, when the Phase 4 spec named it: two facts, both checked
 * rather than assumed (ADR-027).
 *
 * 1. Auth.js v5 is still `5.0.0-beta.32`. ADR-002 exists because Prisma's
 *    `latest` tag once pointed at a release candidate and cost us an afternoon.
 *    Taking a beta for the *authentication* dependency is a worse version of
 *    that bet.
 * 2. More decisively: **Auth.js's Credentials provider does not support
 *    database sessions.** It requires the JWT strategy. That makes two of this
 *    phase's own acceptance criteria — per-device revocation and "changing a
 *    password signs out every other session" — impossible to satisfy without
 *    fighting the library, because a JWT cannot be withdrawn once issued.
 *
 * What is deliberately *not* being reinvented: password hashing is scrypt from
 * `node:crypto`, and the token comparison is `timingSafeEqual`. The surface
 * here is session storage, not cryptography.
 *
 * When Phase 16 adds Google OAuth (ADR-004 defers it), Auth.js may well be the
 * right answer — Phase 3 already shaped the `Account` table for it, so that
 * door stays open.
 */

const COOKIE_NAME = "nexivora_session";

/** Thirty days, matching the cookie. Long enough to be convenient, short
 * enough that an abandoned device stops working. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Re-issue the expiry when a session is more than a day into its life, so an
 * active user is not signed out mid-term, without writing on every request. */
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Tokens are stored hashed for the same reason passwords are: a leaked database
 * dump must not hand over live sessions. SHA-256 without a salt is correct here
 * — the input is 256 bits of entropy we generated, so there is nothing to
 * brute-force and nothing a rainbow table can help with.
 */
const hashToken = (token: string) => createHash("sha256").update(token).digest("base64url");

/**
 * IP addresses are personal data under the DPDP Act. We want to show "signed in
 * from a new location", not to keep a log of where someone lives — so the
 * address is hashed with the app secret and never stored in the clear.
 */
function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash("sha256")
    .update(`${env.AUTH_SECRET ?? "nexivora"}:${ip}`)
    .digest("base64url")
    .slice(0, 22);
}

export type SessionRecord = {
  id: string;
  userId: string;
  expires: Date;
};

/* ------------------------------------------------------------------ create */

export async function createSession(
  userId: string,
  context: { userAgent?: string | null; ip?: string | null } = {},
): Promise<{ token: string; expires: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.create({
    data: {
      userId,
      sessionToken: hashToken(token),
      expires,
      userAgent: context.userAgent?.slice(0, 400) ?? null,
      ipHash: hashIp(context.ip ?? null),
    },
  });

  return { token, expires };
}

export async function setSessionCookie(token: string, expires: Date): Promise<void> {
  const store = await cookies();

  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    // Lax rather than Strict: Strict breaks the click-through from a
    // verification email, which would make the flow look broken. Every mutation
    // is a POST through a Server Action, which carries its own origin check.
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    expires,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function readSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

/* ------------------------------------------------------------------ resolve */

/**
 * The current session, or null.
 *
 * Deletes an expired row on the way past rather than leaving it: the sessions
 * list a user sees should not show devices that can no longer sign in.
 */
export async function getSession(): Promise<SessionRecord | null> {
  const token = await readSessionToken();
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { sessionToken: hashToken(token) },
    select: { id: true, userId: true, expires: true, createdAt: true },
  });

  if (!session) return null;

  if (session.expires.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  // Sliding expiry, written at most once a day per session.
  if (session.expires.getTime() - Date.now() < SESSION_TTL_MS - REFRESH_AFTER_MS) {
    const expires = new Date(Date.now() + SESSION_TTL_MS);
    await db.session
      .update({ where: { id: session.id }, data: { expires } })
      .catch(() => undefined);
    return { id: session.id, userId: session.userId, expires };
  }

  return { id: session.id, userId: session.userId, expires: session.expires };
}

/**
 * The current viewer. **This is the entry point every page and action uses.**
 *
 * Returns `ANONYMOUS` rather than null when signed out, so callers cannot
 * forget to handle the logged-out case — they get a viewer with no permissions
 * instead of an undefined they might skip a check on.
 */
export async function currentViewer(): Promise<Viewer> {
  const session = await getSession();
  if (!session) return ANONYMOUS;

  return loadViewer(session.userId);
}

/* ------------------------------------------------------------------ revoke */

export async function destroySession(): Promise<void> {
  const token = await readSessionToken();

  if (token) {
    await db.session.delete({ where: { sessionToken: hashToken(token) } }).catch(() => undefined);
  }

  await clearSessionCookie();
}

export async function destroySessionById(userId: string, sessionId: string): Promise<void> {
  // Scoped by userId so a stolen session id from another account is a no-op
  // rather than a way to sign other people out.
  await db.session.deleteMany({ where: { id: sessionId, userId } });
}

/**
 * Sign out everywhere else. Called on password change (acceptance criterion 7)
 * and available from the security settings page.
 *
 * If a password was changed because it may have been compromised, leaving the
 * attacker's session alive defeats the entire point of the change.
 */
export async function destroyOtherSessions(userId: string): Promise<number> {
  const token = await readSessionToken();
  const keep = token ? hashToken(token) : null;

  const result = await db.session.deleteMany({
    where: { userId, ...(keep ? { sessionToken: { not: keep } } : {}) },
  });

  return result.count;
}

export async function listSessions(
  userId: string,
): Promise<
  Array<{ id: string; userAgent: string | null; createdAt: Date; expires: Date; current: boolean }>
> {
  const token = await readSessionToken();
  const currentHash = token ? hashToken(token) : null;

  const sessions = await db.session.findMany({
    where: { userId, expires: { gt: new Date() } },
    select: { id: true, sessionToken: true, userAgent: true, createdAt: true, expires: true },
    orderBy: { createdAt: "desc" },
  });

  return sessions.map((session) => ({
    id: session.id,
    userAgent: session.userAgent,
    createdAt: session.createdAt,
    expires: session.expires,
    current: currentHash !== null && safeEqual(session.sessionToken, currentHash),
  }));
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/* ------------------------------------------------------------------ request */

/** Best-effort client address, for the hashed device fingerprint only. */
export async function requestContext(): Promise<{ userAgent: string | null; ip: string | null }> {
  const headerList = await headers();

  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? null;

  return { userAgent: headerList.get("user-agent"), ip };
}
