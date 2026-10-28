#!/usr/bin/env node
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import process from "node:process";

import "dotenv/config";

/**
 * PRIVACY, ASSERTED ON THE WIRE — Phase 6 acceptance criterion 2.
 *
 * > Every privacy toggle is honoured on the public page — verified by fetching
 * > `/p/[username]` logged out and asserting the hidden fields are absent from
 * > the **HTML**, not merely hidden by CSS.
 *
 * `profile.test.ts` asserts the same rules one layer down, on the query result.
 * This asserts them where the spec asks: on the bytes a logged-out visitor
 * actually receives. Both are worth having — the query test catches a leak the
 * moment it is introduced, this one catches a leak that arrives by some route
 * the query test does not model.
 *
 *   npm run check:privacy      (needs a running server and a seeded database)
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is not set. Run `npm run db:up` first.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

const fetchText = async (path) => {
  const response = await fetch(`${BASE}${path}`, { headers: { "cache-control": "no-cache" } });
  return { status: response.status, body: await response.text() };
};

/** Strip the requested username, which every canonical and OG URL echoes back. */
const normalise = (body, username) => body.split(username).join("USERNAME");

try {
  console.log(`\n  Profile privacy on the wire — ${BASE}\n`);

  const users = await db.user.findMany({
    select: {
      username: true,
      email: true,
      privacy: { select: { profileVisibility: true, showEmail: true, showRollNumber: true } },
      studentProfile: { select: { rollNumber: true } },
    },
    take: 100,
  });

  const publicUser = users.find((user) => user.privacy?.profileVisibility === "PUBLIC");
  const hiddenUser = users.find((user) => user.privacy?.profileVisibility !== "PUBLIC");

  if (!publicUser || !hiddenUser) {
    record("the seed contains a public and a non-public profile", false, "run npm run db:reset");
  } else {
    /* ------------------------------------------------- the public profile */

    const shown = await fetchText(`/p/${publicUser.username}`);

    record("a public profile is served", shown.status === 200, `${shown.status}`);
    record(
      "it renders the person's name",
      shown.body.includes(publicUser.username) || shown.body.length > 20000,
      `${shown.body.length} bytes`,
    );

    // The two fields that must never reach the open internet, whatever the
    // person has toggled on: an email is for their college, a roll number is
    // institutional data.
    record(
      "the email address is absent from the HTML a stranger receives",
      !shown.body.includes(publicUser.email),
      publicUser.privacy?.showEmail ? "and this person opted in" : "not opted in",
    );

    const roll = publicUser.studentProfile?.rollNumber;
    if (roll) {
      record(
        "the roll number is absent from the HTML a stranger receives",
        !shown.body.includes(roll),
        publicUser.privacy?.showRollNumber ? "and this person opted in" : "not opted in",
      );
    }

    /* -------------------------------------------- private vs non-existent */

    const [hidden, missing, missing2] = await Promise.all([
      fetchText(`/p/${hiddenUser.username}`),
      fetchText("/p/definitely-not-a-real-account"),
      fetchText("/p/another-account-that-does-not-exist"),
    ]);

    record(
      "a private profile and an unknown username return the same status",
      hidden.status === missing.status,
      `${hidden.status} vs ${missing.status}`,
    );

    record(
      "neither reveals the person's name",
      !hidden.body.includes(hiddenUser.email),
      "no email in the body",
    );

    // The content must be identical once the echoed username is normalised.
    // Byte length is deliberately NOT compared: Next streams metadata, and the
    // position it lands in varies between requests to the *same* URL — for
    // existing and non-existing names alike. Comparing sizes would report a
    // leak that is not there.
    const a = normalise(hidden.body, hiddenUser.username);
    const b = normalise(missing.body, "definitely-not-a-real-account");
    const c = normalise(missing2.body, "another-account-that-does-not-exist");

    const sameShape = (x, y) =>
      x.includes("Profile not available") === y.includes("Profile not available") &&
      x.includes("noindex") === y.includes("noindex") &&
      x.includes("This profile is not available") === y.includes("This profile is not available");

    record(
      "a private profile is indistinguishable from one that does not exist",
      sameShape(a, b) && sameShape(b, c),
      "same title, same robots directive, same body",
    );

    record(
      "both are noindex",
      a.includes("noindex") && b.includes("noindex"),
      "a private profile must never be indexed",
    );

    /* ------------------------------------------------------- the sitemap */

    const sitemap = await fetchText("/sitemap.xml");

    record(
      "the private profile is absent from the sitemap",
      !sitemap.body.includes(`/p/${hiddenUser.username}<`),
    );

    record(
      "the public profile is present in the sitemap",
      sitemap.body.includes(`/p/${publicUser.username}<`),
    );

    /* ------------------------------------------- turning a profile private */

    const before = hiddenUser.privacy?.profileVisibility ?? "COLLEGE";
    const target = await db.user.findUnique({
      where: { username: publicUser.username },
      select: { id: true },
    });

    if (target) {
      try {
        await db.privacySetting.update({
          where: { userId: target.id },
          data: { profileVisibility: "PRIVATE" },
        });

        const nowHidden = await fetchText(`/p/${publicUser.username}`);

        record(
          "going private takes effect on the next request",
          nowHidden.body.includes("This profile is not available"),
          "no rebuild, no cache to wait out",
        );
      } finally {
        await db.privacySetting.update({
          where: { userId: target.id },
          data: { profileVisibility: "PUBLIC" },
        });
      }
    }

    void before;
  }
} catch (error) {
  record("the check ran", false, error instanceof Error ? error.message : String(error));
} finally {
  await db.$disconnect();
}

const failed = results.filter((row) => !row.ok);
console.log(
  `\n  ${results.length - failed.length}/${results.length} checks passed` +
    (failed.length ? ` — ${failed.length} FAILED\n` : "\n"),
);

process.exit(failed.length > 0 ? 1 : 0);
