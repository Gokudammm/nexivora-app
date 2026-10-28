import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SECTION_ORDER } from "@/config/sections";

import { createSnapshot, sameContent, stableStringify, type SnapshotInput } from "./snapshot";

/**
 * Acceptance criterion 8: the submission snapshot is byte-stable and reproduces
 * the record as it was.
 *
 * "Byte-stable" is the load-bearing word. `JSON.stringify` preserves insertion
 * order, and a Prisma row's key order follows the shape of its `select` — so
 * without deliberate sorting, two snapshots of an unchanged project can differ
 * because somebody reordered a select clause six months later. A receipt that
 * can change without the work changing is not a receipt.
 */

const input = (overrides: Partial<SnapshotInput> = {}): SnapshotInput => ({
  slug: "canal-scheduling",
  title: "Scheduling canal water across multiple farms",
  summary: "Reallocating unused irrigation turns within a rotation block.",
  abstract: "A sensor network and scheduler for rotational canal irrigation.",
  status: "UNDER_REVIEW",
  visibility: "COLLEGE",
  domain: "hardware-iot",
  department: "Computer Science & Engineering",
  subject: "Major Project",
  techStack: ["Python", "ESP32", "LoRaWAN"],
  keywords: ["irrigation", "sensors"],
  repositoryUrl: "https://github.com/example/canal",
  demoUrl: null,
  videoUrl: null,
  startedOn: new Date("2025-07-28T00:00:00Z"),
  completedOn: null,
  embargoUntil: null,
  sections: [
    { kind: "RESULTS", body: "MAE was 3.1%.", wordCount: 3, complete: true },
    { kind: "PROBLEM", body: "Farmers lose turns.", wordCount: 3, complete: true },
  ],
  members: [
    { username: "rahul-verma", name: "Rahul Verma", role: "Hardware", tier: "SELF" },
    { username: "ananya-sharma", name: "Ananya Sharma", role: "Lead", tier: "WORKSPACE_EVIDENCED" },
  ],
  milestones: [
    {
      title: "Field trial",
      description: null,
      state: "COMPLETE",
      dueDate: new Date("2025-09-01T00:00:00Z"),
      completedAt: new Date("2025-09-03T00:00:00Z"),
    },
  ],
  topics: ["iot", "agriculture"],
  sdgs: [
    { goal: 6, primary: true },
    { goal: 2, primary: false },
  ],
  files: [{ name: "report.pdf", sizeBytes: 1024, checksum: "abc" }],
  ...overrides,
});

const meta = {
  round: 1,
  submittedBy: "ananya-sharma",
  submittedAt: new Date("2026-03-15T10:30:00Z"),
};

const snapshot = (overrides: Partial<SnapshotInput> = {}) =>
  createSnapshot(input(overrides), meta, SECTION_ORDER);

/* ------------------------------------------------------------- stability */

describe("stableStringify", () => {
  it("sorts keys at every depth, so insertion order cannot leak in", () => {
    const a = stableStringify({ b: 1, a: { d: 2, c: 3 } });
    const b = stableStringify({ a: { c: 3, d: 2 }, b: 1 });

    assert.equal(a, b);
    assert.equal(a, '{"a":{"c":3,"d":2},"b":1}');
  });

  it("preserves array order, which is the caller's to decide", () => {
    assert.notEqual(stableStringify([1, 2]), stableStringify([2, 1]));
  });

  it("sorts inside objects held in arrays", () => {
    assert.equal(stableStringify([{ b: 1, a: 2 }]), '[{"a":2,"b":1}]');
  });
});

describe("createSnapshot", () => {
  it("produces an identical digest for the same record, twice", () => {
    assert.equal(snapshot().digest, snapshot().digest);
  });

  it("produces an identical digest when the query's key order differs", () => {
    // The actual failure mode: somebody widens or reorders a `select`, and every
    // snapshot silently starts hashing differently.
    const reordered = createSnapshot(
      {
        ...input(),
        techStack: ["LoRaWAN", "Python", "ESP32"],
        keywords: ["sensors", "irrigation"],
        topics: ["agriculture", "iot"],
        members: [...input().members].reverse(),
        sections: [...input().sections].reverse(),
        sdgs: [...input().sdgs].reverse(),
      },
      meta,
      SECTION_ORDER,
    );

    assert.equal(reordered.digest, snapshot().digest);
  });

  it("changes the digest when the work changes", () => {
    const edited = snapshot({
      sections: [
        { kind: "RESULTS", body: "MAE was 2.9%.", wordCount: 3, complete: true },
        { kind: "PROBLEM", body: "Farmers lose turns.", wordCount: 3, complete: true },
      ],
    });

    assert.notEqual(edited.digest, snapshot().digest);
  });

  it("does not change the digest when only the submission time does", () => {
    // Two submissions of identical work should be recognisable as identical —
    // which is the one question a digest is actually useful for.
    const later = createSnapshot(
      input(),
      { ...meta, submittedAt: new Date("2026-06-01T00:00:00Z") },
      SECTION_ORDER,
    );

    assert.equal(later.digest, snapshot().digest);
    assert.ok(sameContent(later, snapshot()));
  });

  it("orders sections canonically, not alphabetically", () => {
    // A snapshot is also a document somebody may read, and "Conclusion, Future
    // work, Methodology, Problem…" is not a report.
    const record = snapshot().record as { sections: { kind: string }[] };
    assert.deepEqual(
      record.sections.map((section) => section.kind),
      ["PROBLEM", "RESULTS"],
    );
  });

  it("records the round and the submitter", () => {
    const second = createSnapshot(input(), { ...meta, round: 2 }, SECTION_ORDER);

    assert.equal(second.round, 2);
    assert.equal(second.submittedBy, "ananya-sharma");
  });

  it("truncates the timestamp to the second", () => {
    const precise = createSnapshot(
      input(),
      { ...meta, submittedAt: new Date("2026-03-15T10:30:00.472Z") },
      SECTION_ORDER,
    );

    assert.equal(precise.submittedAt, "2026-03-15T10:30:00Z");
  });

  it("stores no computed field — anything derived can be recomputed", () => {
    // A stored progress percentage would be a second copy that can disagree
    // with the first.
    const record = snapshot().record as Record<string, unknown>;

    for (const forbidden of ["progress", "percent", "updatedAt", "createdAt", "id"]) {
      assert.equal(forbidden in record, false, `${forbidden} must not be in a snapshot`);
    }
  });

  it("identifies files by name and checksum, never by id", () => {
    // A snapshot must stay meaningful after the objects behind it are re-keyed.
    const record = snapshot().record as { files: Record<string, unknown>[] };

    assert.deepEqual(Object.keys(record.files[0]!).sort(), ["checksum", "name", "sizeBytes"]);
  });

  it("reproduces the record as it was", () => {
    const record = snapshot().record as Record<string, unknown>;

    assert.equal(record.title, "Scheduling canal water across multiple farms");
    assert.equal(
      record.abstract,
      "A sensor network and scheduler for rotational canal irrigation.",
    );
    assert.deepEqual(record.sdgs, [
      { goal: 2, primary: false },
      { goal: 6, primary: true },
    ]);
  });
});
