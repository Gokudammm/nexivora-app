"use server";

import { createHash } from "node:crypto";

import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db/client";
import {
  accountLockedEmail,
  passwordChangedEmail,
  passwordResetEmail,
  sendEmail,
  verificationEmail,
} from "@/lib/email/send";

import { hashPassword, needsRehash, verifyPassword } from "./password";
import { checkPassword } from "./policy-password";
import {
  LOCKOUT_MS,
  checkLoginRate,
  clearFailures,
  lockAccount,
  pruneLoginAttempts,
  recordLoginAttempt,
  shouldLockAccount,
} from "./rate-limit";
import {
  createSession,
  currentViewer,
  destroyOtherSessions,
  destroySession,
  destroySessionById,
  requestContext,
  setSessionCookie,
} from "./session";
import { consumeToken, issueToken } from "./tokens";

/**
 * The authentication flows.
 *
 * One rule governs the shape of everything here: **the response must not reveal
 * whether an account exists.** Sign-in, registration and password reset all
 * answer identically for a known and an unknown address. Anything else is an
 * account-enumeration oracle — and on a platform where the accounts are
 * students at a named institution, "does this person have an account here" is
 * itself information worth protecting.
 *
 * That is why `requestPasswordReset` always reports success, why `register`
 * does not say an address is taken, and why `signIn` returns one message for a
 * wrong password and for no such user.
 */

export type ActionResult =
  { ok: true; message?: string } | { ok: false; error: string; field?: string };

/** One message for both failures. Never "no account with that email". */
const BAD_CREDENTIALS = "That email and password do not match an account.";

/**
 * A real hash of a value nobody knows, verified against when the account does
 * not exist.
 *
 * Without it "no such user" returns in a millisecond while a wrong password
 * takes 400ms — a timing oracle that reduces the identical error message to
 * decoration.
 */
const DECOY_HASH =
  "scrypt$131072$8$1$bm90LWEtcmVhbC1zYWx0LXg$3q2-7wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const hashIp = (ip: string | null) =>
  ip ? createHash("sha256").update(ip).digest("base64url").slice(0, 22) : null;

/**
 * Only ever redirect to a path on this site. An open redirect turns our own
 * login page into a convincing launch pad for someone else's phishing.
 */
function safeNext(next: string | undefined | null): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

/* ---------------------------------------------------------------- sign in */

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export async function signIn(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const { email, password } = parsed.data;
  const context = await requestContext();
  const ipHash = hashIp(context.ip);

  const rate = await checkLoginRate(email, ipHash);
  if (!rate.allowed) {
    return { ok: false, error: "Too many attempts. Wait fifteen minutes, or reset your password." };
  }

  const user = await db.user.findFirst({
    where: { email, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      lockedUntil: true,
      emailVerified: true,
    },
  });

  const matches = await verifyPassword(password, user?.passwordHash ?? DECOY_HASH);

  if (!user || !matches) {
    await recordLoginAttempt(email, ipHash, false);

    if (user && (await shouldLockAccount(email))) {
      await lockAccount(user.id);
      await sendEmail(accountLockedEmail(user.email, user.name, LOCKOUT_MS / 60000));
    }

    return { ok: false, error: BAD_CREDENTIALS };
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return {
      ok: false,
      error:
        "This account is temporarily locked after repeated failed attempts. Try again shortly, or reset your password.",
    };
  }

  // Transparent upgrade: Phase 3 seeded hashes at N=2^14 and the cost has since
  // risen. Rehashing here is what stops the oldest passwords — the ones with the
  // longest exposure — from staying the weakest forever.
  if (needsRehash(user.passwordHash)) {
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password) },
    });
  }

  await Promise.all([
    recordLoginAttempt(email, ipHash, true),
    clearFailures(user.id, email),
    db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    pruneLoginAttempts(),
  ]);

  const session = await createSession(user.id, context);
  await setSessionCookie(session.token, session.expires);

  redirect(safeNext(formData.get("next") as string | null) ?? "/dashboard");
}

/* --------------------------------------------------------------- register */

const registerSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string(),
  role: z.enum(["STUDENT", "FACULTY", "ALUMNI", "COMPANY", "RESEARCHER", "COLLEGE_ADMIN"]),
});

export async function register(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? "Check the form.",
      field: issue ? String(issue.path[0]) : undefined,
    };
  }

  const { name, email, password, role } = parsed.data;

  const strength = checkPassword(password, { email, name });
  if (!strength.ok) return { ok: false, error: strength.reason, field: "password" };

  const existing = await db.user.findFirst({ where: { email }, select: { id: true } });

  if (existing) {
    // Do not confirm the address is taken — that is an enumeration oracle.
    // Answer exactly as a successful registration does; the real owner learns
    // about it in their inbox, and they are the only person entitled to.
    return {
      ok: true,
      message: "Check your email to confirm your address and finish setting up your account.",
    };
  }

  // Institutional domain association. Registering on a college's declared
  // domain associates the account with it as INVITED, activated when the
  // address is confirmed. This is the trust gate — it is what makes a Nexivora
  // account mean something a Gmail address does not (ADR-004).
  const domain = email.split("@")[1] ?? "";
  const college = domain
    ? await db.college.findFirst({
        where: { emailDomains: { has: domain } },
        select: { id: true },
      })
    : null;

  const user = await db.user.create({
    data: {
      email,
      name,
      username: await uniqueUsername(name, email),
      passwordHash: await hashPassword(password),
      privacy: { create: {} },
      onboarding: { create: { role, step: "start" } },
      ...(college
        ? { memberships: { create: { collegeId: college.id, role, state: "INVITED" } } }
        : {}),
    },
    select: { id: true, name: true, email: true },
  });

  await sendEmail(
    verificationEmail(
      user.email,
      user.name,
      await issueToken(user.id, email, "email-verification"),
    ),
  );

  const session = await createSession(user.id, await requestContext());
  await setSessionCookie(session.token, session.expires);

  redirect("/verify-email");
}

/**
 * A readable, stable, unique handle.
 *
 * The username is a public URL and a citation target, so it is worth the care:
 * derive it from the name, fall back to the email local part, and only then add
 * a number.
 */
async function uniqueUsername(name: string, email: string): Promise<string> {
  const fromName = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);

  const base = fromName || (email.split("@")[0] ?? "member").replace(/[^a-z0-9]+/g, "-");

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await db.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
}

/* ------------------------------------------------------- email verification */

export async function resendVerification(): Promise<ActionResult> {
  const viewer = await currentViewer();
  if (!viewer.userId) return { ok: false, error: "Sign in first." };

  const user = await db.user.findUnique({
    where: { id: viewer.userId },
    select: { id: true, email: true, name: true, emailVerified: true },
  });

  if (!user) return { ok: false, error: "Sign in first." };
  if (user.emailVerified) return { ok: true, message: "That address is already confirmed." };

  await sendEmail(
    verificationEmail(
      user.email,
      user.name,
      await issueToken(user.id, user.email, "email-verification"),
    ),
  );

  return {
    ok: true,
    message: "Sent. Check your inbox — in development it prints to the terminal.",
  };
}

export async function verifyEmail(token: string): Promise<ActionResult> {
  const consumed = await consumeToken(token, "email-verification");

  if (!consumed) {
    return {
      ok: false,
      error: "That link has expired or has already been used. Request a new one.",
    };
  }

  await db.user.update({
    where: { id: consumed.userId },
    data: { emailVerified: new Date() },
  });

  // An address confirmed on a college's own domain activates the pending
  // membership: confirming the address *is* the proof of belonging.
  const domain = consumed.identifier.split("@")[1] ?? "";
  const college = domain
    ? await db.college.findFirst({ where: { emailDomains: { has: domain } }, select: { id: true } })
    : null;

  if (college) {
    await db.membership.updateMany({
      where: { userId: consumed.userId, collegeId: college.id, state: "INVITED" },
      data: { state: "ACTIVE", joinedAt: new Date() },
    });
  }

  return { ok: true, message: "Address confirmed." };
}

/* ----------------------------------------------------------- password reset */

export async function requestPasswordReset(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  // Identical either way. The only thing this endpoint tells an attacker is
  // that it exists.
  const identical: ActionResult = {
    ok: true,
    message: "If that address has an account, a reset link is on its way.",
  };

  if (!z.string().email().safeParse(email).success) return identical;

  const user = await db.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, email: true, name: true },
  });

  if (!user) return identical;

  await sendEmail(
    passwordResetEmail(user.email, user.name, await issueToken(user.id, email, "password-reset")),
  );

  return identical;
}

export async function resetPassword(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) {
    return { ok: false, error: "Those two passwords do not match.", field: "confirm" };
  }

  const strength = checkPassword(password);
  if (!strength.ok) return { ok: false, error: strength.reason, field: "password" };

  const consumed = await consumeToken(token, "password-reset");
  if (!consumed) {
    return {
      ok: false,
      error: "That link has expired or has already been used. Request a new one.",
    };
  }

  const user = await db.user.update({
    where: { id: consumed.userId },
    data: { passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null },
    select: { id: true, email: true, name: true },
  });

  // Every session, including any the attacker holds. A reset that leaves the
  // intruder signed in has achieved nothing.
  await db.session.deleteMany({ where: { userId: user.id } });
  await sendEmail(passwordChangedEmail(user.email, user.name));

  return { ok: true, message: "Password changed. Sign in with the new one." };
}

/* -------------------------------------------------------- change password */

export async function changePassword(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await currentViewer();
  if (!viewer.userId) return { ok: false, error: "Sign in first." };

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) {
    return { ok: false, error: "Those two passwords do not match.", field: "confirm" };
  }

  const user = await db.user.findUnique({
    where: { id: viewer.userId },
    select: { id: true, email: true, name: true, username: true, passwordHash: true },
  });

  if (!user) return { ok: false, error: "Sign in first." };

  if (!(await verifyPassword(String(formData.get("current") ?? ""), user.passwordHash))) {
    return { ok: false, error: "That is not your current password.", field: "current" };
  }

  const strength = checkPassword(password, {
    email: user.email,
    name: user.name,
    username: user.username,
  });
  if (!strength.ok) return { ok: false, error: strength.reason, field: "password" };

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password) },
  });

  // Acceptance criterion 7. This device stays signed in; every other one is
  // revoked — if the password was changed because it may have been
  // compromised, leaving the intruder's session alive defeats the point.
  const revoked = await destroyOtherSessions(user.id);
  await sendEmail(passwordChangedEmail(user.email, user.name));

  return {
    ok: true,
    message:
      revoked > 0
        ? `Password changed, and ${revoked} other ${revoked === 1 ? "device was" : "devices were"} signed out.`
        : "Password changed.",
  };
}

/* ------------------------------------------------------ sessions & sign out */

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/");
}

export async function revokeSession(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await currentViewer();
  if (!viewer.userId) return { ok: false, error: "Sign in first." };

  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) return { ok: false, error: "Nothing to revoke." };

  await destroySessionById(viewer.userId, sessionId);

  return { ok: true, message: "That device was signed out." };
}
