import { createHash, randomBytes } from "node:crypto";

import { db } from "@/lib/db/client";

/**
 * One-time tokens for email verification and password reset.
 *
 * Three properties, all of which the acceptance criteria test:
 *
 * - **Hashed at rest.** A database dump must not hand over the ability to take
 *   over accounts. Plain SHA-256 is right here: the token is 256 bits we
 *   generated, so there is nothing to brute-force.
 * - **Single use.** `usedAt` is set inside the same transaction that consumes
 *   the token, so two simultaneous requests cannot both succeed.
 * - **Short-lived.** 24 hours to verify an address, 30 minutes to reset a
 *   password — a reset link sits in an inbox, which is exactly where a stale
 *   one is dangerous.
 */

export type TokenPurpose = "email-verification" | "password-reset";

const TTL_MS: Record<TokenPurpose, number> = {
  "email-verification": 24 * 60 * 60 * 1000,
  "password-reset": 30 * 60 * 1000,
};

const hash = (token: string) => createHash("sha256").update(token).digest("base64url");

/**
 * Issue a token, invalidating any earlier unused one for the same purpose.
 *
 * Invalidating the previous one matters: a user who clicks "resend" three times
 * should not leave three live reset links in their inbox.
 */
export async function issueToken(
  userId: string,
  identifier: string,
  purpose: TokenPurpose,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");

  await db.$transaction([
    db.verificationToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    }),
    db.verificationToken.create({
      data: {
        userId,
        identifier: identifier.toLowerCase(),
        tokenHash: hash(token),
        purpose,
        expires: new Date(Date.now() + TTL_MS[purpose]),
      },
    }),
  ]);

  return token;
}

export type ConsumedToken = { userId: string; identifier: string };

/**
 * Consume a token, or return null.
 *
 * Null for every failure — unknown, expired, already used, wrong purpose. The
 * caller cannot tell which, and should not: distinguishing "expired" from
 * "never existed" tells an attacker their guess was once real.
 *
 * The update is conditional on `usedAt: null` and reports how many rows it
 * touched, which is what makes double-use impossible rather than merely
 * unlikely under concurrency.
 */
export async function consumeToken(
  token: string,
  purpose: TokenPurpose,
): Promise<ConsumedToken | null> {
  const tokenHash = hash(token);

  const record = await db.verificationToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      identifier: true,
      purpose: true,
      expires: true,
      usedAt: true,
    },
  });

  if (!record) return null;
  if (record.purpose !== purpose) return null;
  if (record.usedAt !== null) return null;
  if (record.expires.getTime() <= Date.now()) return null;
  if (!record.userId) return null;

  const claimed = await db.verificationToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  // Someone else consumed it between the read and the write.
  if (claimed.count !== 1) return null;

  return { userId: record.userId, identifier: record.identifier };
}

/** Expired and used tokens are noise. Called opportunistically. */
export async function pruneTokens(): Promise<void> {
  await db.verificationToken.deleteMany({
    where: {
      OR: [
        { expires: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        { usedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      ],
    },
  });
}
