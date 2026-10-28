import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { after, before, describe, it } from "node:test";

import "dotenv/config";

import { db } from "@/lib/db/client";

import { hashPassword, needsRehash, verifyPassword } from "./password";
import { checkPassword, passwordStrength } from "./policy-password";
import { consumeToken, issueToken } from "./tokens";

/**
 * Token lifecycle and password handling.
 *
 * Acceptance criterion 6 — "a reset token cannot be used twice and expires
 * after 30 minutes" — is the reason this file exists. Both halves are asserted
 * against the real table, because both are enforced by a conditional update
 * rather than by application logic, and only a real database exercises that.
 */

let userId: string;

before(async () => {
  const user = await db.user.findFirst({
    where: { username: "ananya-sharma" },
    select: { id: true },
  });

  assert.ok(user, "seed the database first: npm run db:reset");
  userId = user.id;
});

after(async () => {
  await db.verificationToken.deleteMany({
    where: { userId, identifier: "token-test@example.com" },
  });
  await db.$disconnect();
});

describe("one-time tokens", () => {
  it("can be consumed once", async () => {
    const token = await issueToken(userId, "token-test@example.com", "password-reset");

    const first = await consumeToken(token, "password-reset");
    assert.ok(first, "the first use should succeed");
    assert.equal(first.userId, userId);
  });

  it("cannot be consumed twice", async () => {
    const token = await issueToken(userId, "token-test@example.com", "password-reset");

    await consumeToken(token, "password-reset");
    const second = await consumeToken(token, "password-reset");

    assert.equal(second, null, "a consumed token must not work again");
  });

  it("cannot be consumed twice concurrently", async () => {
    // The realistic version of the previous test: a double-clicked link, or a
    // mail client that prefetches while the user also clicks. The conditional
    // update is what makes exactly one of these win.
    const token = await issueToken(userId, "token-test@example.com", "password-reset");

    const [a, b] = await Promise.all([
      consumeToken(token, "password-reset"),
      consumeToken(token, "password-reset"),
    ]);

    const succeeded = [a, b].filter(Boolean).length;
    assert.equal(succeeded, 1, `expected exactly one to succeed, ${succeeded} did`);
  });

  it("rejects an expired token", async () => {
    const token = await issueToken(userId, "token-test@example.com", "password-reset");

    // Age it past the 30-minute window rather than waiting for it.
    await db.verificationToken.updateMany({
      where: { userId, purpose: "password-reset", usedAt: null },
      data: { expires: new Date(Date.now() - 1000) },
    });

    assert.equal(await consumeToken(token, "password-reset"), null);
  });

  it("rejects a token used for the wrong purpose", async () => {
    // A verification link must not double as a password reset. Without the
    // purpose check, anyone who saw a verification email could take the account.
    const token = await issueToken(userId, "token-test@example.com", "email-verification");

    assert.equal(await consumeToken(token, "password-reset"), null);
    assert.ok(await consumeToken(token, "email-verification"));
  });

  it("rejects an unknown token", async () => {
    assert.equal(await consumeToken("not-a-real-token", "password-reset"), null);
  });

  it("invalidates the previous token when a new one is issued", async () => {
    // Clicking "resend" three times must not leave three live links in an inbox.
    const first = await issueToken(userId, "token-test@example.com", "password-reset");
    const second = await issueToken(userId, "token-test@example.com", "password-reset");

    assert.equal(await consumeToken(first, "password-reset"), null, "the old link should be dead");
    assert.ok(await consumeToken(second, "password-reset"), "the new link should work");
  });

  it("stores the token hashed, never in the clear", async () => {
    const token = await issueToken(userId, "token-test@example.com", "password-reset");

    const rows = await db.verificationToken.findMany({
      where: { userId, purpose: "password-reset", usedAt: null },
      select: { tokenHash: true },
    });

    assert.ok(rows.length > 0);
    assert.ok(
      rows.every((row) => row.tokenHash !== token),
      "a database dump must not hand over live tokens",
    );
  });
});

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const stored = await hashPassword("a-perfectly-fine-passphrase");

    assert.equal(await verifyPassword("a-perfectly-fine-passphrase", stored), true);
    assert.equal(await verifyPassword("a-perfectly-fine-passphras", stored), false);
  });

  it("produces a different hash for the same password", async () => {
    // Distinct salts. Identical hashes would reveal which accounts share a
    // password, which is exactly what a leaked table should not tell anyone.
    const a = await hashPassword("the-same-password-twice");
    const b = await hashPassword("the-same-password-twice");

    assert.notEqual(a, b);
    assert.equal(await verifyPassword("the-same-password-twice", a), true);
    assert.equal(await verifyPassword("the-same-password-twice", b), true);
  });

  it("reads the four-field hashes Phase 3 seeded, and flags them for upgrade", () => {
    // Built here rather than read from a seeded row on purpose. A row is not a
    // stable fixture for this: signing in *upgrades* it to the six-field form,
    // so a test that reads one passes until the flow it is protecting actually
    // runs, and then fails for the right reason at the worst moment. (It did.)
    const salt = Buffer.from("nexivora-demo-seed-salt-01", "utf8").subarray(0, 16);
    const legacy = [
      "scrypt",
      16384,
      salt.toString("base64url"),
      scryptSync("nexivora-demo", salt, 32, { N: 16384, r: 8, p: 1 }).toString("base64url"),
    ].join("$");

    assert.equal(legacy.split("$").length, 4, "the seeded form is scrypt$N$salt$hash");
    assert.equal(needsRehash(legacy), true, "the seeded parameters are weaker than current");

    return verifyPassword("nexivora-demo", legacy).then((ok) => {
      assert.equal(ok, true, "the seeded 87 accounts must still be able to sign in");
    });
  });

  it("does not flag a current hash for upgrade", async () => {
    assert.equal(needsRehash(await hashPassword("something-long-enough")), false);
  });

  it("does not throw on a malformed stored hash", async () => {
    // A corrupted row must fail the login, not crash the endpoint.
    assert.equal(await verifyPassword("anything", ""), false);
    assert.equal(await verifyPassword("anything", "not-a-hash"), false);
    assert.equal(await verifyPassword("anything", "scrypt$abc$def$ghi"), false);
    assert.equal(await verifyPassword("anything", "scrypt$999999999$8$1$aa$bb"), false);
  });
});

describe("password policy", () => {
  it("requires length rather than character classes", () => {
    assert.equal(checkPassword("Ab1!xY").ok, false, "short but complex should fail");
    assert.equal(
      checkPassword("correct horse battery staple").ok,
      true,
      "long and plain should pass",
    );
  });

  it("rejects the passwords that appear in every breach list", () => {
    for (const bad of ["password123", "qwertyuiop", "nexivora123", "college123"]) {
      assert.equal(checkPassword(bad).ok, false, `"${bad}" should be rejected`);
    }
  });

  it("sees through numbers appended to a common word", () => {
    assert.equal(checkPassword("nexivora2026").ok, false);
  });

  it("rejects a password built from the account itself", () => {
    const result = checkPassword("ananya-sharma-2026", {
      email: "ananya@nit.edu.in",
      name: "Ananya Sharma",
      username: "ananya-sharma",
    });

    assert.equal(result.ok, false);
  });

  it("caps the length, because unbounded input into a slow KDF is a lever", () => {
    assert.equal(checkPassword("x".repeat(5000)).ok, false);
  });

  it("scores a passphrase above a short password", () => {
    assert.ok(passwordStrength("correct horse battery staple") > passwordStrength("Passw0rd!!"));
  });
});
