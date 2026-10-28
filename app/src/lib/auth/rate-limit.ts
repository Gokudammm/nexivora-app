import { db } from "@/lib/db/client";
import { env } from "@/lib/env";

/**
 * RATE LIMITING for the authentication endpoints.
 *
 * Backed by the database rather than by an in-process Map. A Map is faster and
 * completely useless here: the counter would reset on every deploy, and with
 * more than one Node process an attacker gets N times the budget. The write
 * volume is trivial — nobody signs in thousands of times a second — so the
 * simple correct thing costs nothing.
 *
 * Keyed on **IP *and* identifier together**, deliberately. Keying on IP alone
 * locks out a whole college behind one NAT; keying on the email alone lets
 * anyone lock a victim out of their own account by failing their login ten
 * times, which is a denial-of-service dressed as a security feature.
 */

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_ATTEMPTS = 5;
/** Failures against one account before it is locked and the owner told. */
export const LOCKOUT_THRESHOLD = 10;
export const LOCKOUT_MS = 30 * 60 * 1000;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** When the window resets, for the Retry-After header. */
  retryAfterMs: number;
};

/**
 * Count recent failures for this IP+identifier pair and decide.
 *
 * Failures are recorded, successes are not: a busy legitimate user should never
 * approach the limit, and counting successes would penalise exactly the people
 * we want to keep.
 */
export async function checkLoginRate(
  identifier: string,
  ipHash: string | null,
): Promise<RateLimitResult> {
  if (!env.RATE_LIMIT_ENABLED) {
    return { allowed: true, remaining: LOGIN_MAX_ATTEMPTS, retryAfterMs: 0 };
  }

  const since = new Date(Date.now() - LOGIN_WINDOW_MS);

  const attempts = await db.loginAttempt.count({
    where: {
      identifier: identifier.toLowerCase(),
      ipHash,
      succeeded: false,
      createdAt: { gte: since },
    },
  });

  const remaining = Math.max(0, LOGIN_MAX_ATTEMPTS - attempts);

  return {
    allowed: attempts < LOGIN_MAX_ATTEMPTS,
    remaining,
    retryAfterMs: attempts < LOGIN_MAX_ATTEMPTS ? 0 : LOGIN_WINDOW_MS,
  };
}

export async function recordLoginAttempt(
  identifier: string,
  ipHash: string | null,
  succeeded: boolean,
): Promise<void> {
  await db.loginAttempt.create({
    data: { identifier: identifier.toLowerCase(), ipHash, succeeded },
  });
}

/**
 * Sustained failures against one account lock it and notify the owner.
 *
 * Deliberately separate from the window above: the window slows a burst, this
 * catches a slow grind that stays under it. Counted across all addresses,
 * because a distributed attempt is exactly the case the IP-keyed window misses.
 */
export async function shouldLockAccount(identifier: string): Promise<boolean> {
  if (!env.RATE_LIMIT_ENABLED) return false;

  const since = new Date(Date.now() - LOGIN_WINDOW_MS * 4);

  const failures = await db.loginAttempt.count({
    where: { identifier: identifier.toLowerCase(), succeeded: false, createdAt: { gte: since } },
  });

  return failures >= LOCKOUT_THRESHOLD;
}

export async function lockAccount(userId: string): Promise<Date> {
  const lockedUntil = new Date(Date.now() + LOCKOUT_MS);

  await db.user.update({
    where: { id: userId },
    data: { lockedUntil, failedLogins: { increment: 1 } },
  });

  return lockedUntil;
}

export async function clearFailures(userId: string, identifier: string): Promise<void> {
  await Promise.all([
    db.user.update({ where: { id: userId }, data: { failedLogins: 0, lockedUntil: null } }),
    // Clear the window so a successful sign-in restores the full budget —
    // otherwise a user who mistyped four times is still nearly locked out.
    db.loginAttempt.deleteMany({
      where: { identifier: identifier.toLowerCase(), succeeded: false },
    }),
  ]);
}

/**
 * Old attempts are noise and, being tied to an identifier, are personal data we
 * have no reason to keep. Called opportunistically from the login path.
 */
export async function pruneLoginAttempts(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } });
}
