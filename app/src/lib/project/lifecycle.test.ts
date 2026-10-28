import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { REQUIRED_SECTIONS, SECTION_BY_KIND, SECTION_ORDER } from "@/config/sections";

import {
  COUNTS_AS_EVIDENCE,
  LABEL,
  TRANSITIONS,
  attemptTransition,
  isEditable,
  isTerminal,
  transitionsFrom,
  type LifecycleFacts,
  type Status,
} from "./lifecycle";

/**
 * The lifecycle is the file that decides whether a student can submit their
 * project the night before it is due. These tests are written against the ways
 * it could be quietly wrong — a reachable state with no way out, a precondition
 * that refuses without saying why, an edge nobody meant to allow.
 */

const ALL_STATUSES: Status[] = [
  "DRAFT",
  "PROPOSED",
  "APPROVED",
  "IN_PROGRESS",
  "UNDER_REVIEW",
  "COMPLETED",
  "ARCHIVED",
  "REJECTED",
  "ABANDONED",
];

/** A project with everything done. Tests subtract from this rather than build up. */
const complete = (overrides: Partial<LifecycleFacts> = {}): LifecycleFacts => ({
  completeSections: [...SECTION_ORDER],
  requiredSections: REQUIRED_SECTIONS,
  sectionLabel: (kind) => SECTION_BY_KIND[kind].label,
  milestones: [{ title: "Prototype demo", state: "COMPLETE" }],
  outstandingReviewers: [],
  hasTitle: true,
  hasSummary: true,
  hasAbstract: true,
  hasMembers: true,
  hasSimilarityCheck: true,
  ...overrides,
});

/* --------------------------------------------------------------- the table */

describe("the transition table", () => {
  it("has no duplicate edges", () => {
    const seen = new Set<string>();
    for (const transition of TRANSITIONS) {
      const key = `${transition.from}->${transition.to}`;
      assert.ok(!seen.has(key), `${key} is declared twice`);
      seen.add(key);
    }
  });

  it("never declares a self-transition", () => {
    assert.ok(TRANSITIONS.every((transition) => transition.from !== transition.to));
  });

  it("labels every status", () => {
    for (const status of ALL_STATUSES) {
      assert.ok(LABEL[status], `${status} has no label`);
    }
  });

  it("requires a reason wherever a refusal or a stop is recorded", () => {
    // Every transition somebody could later dispute must carry its reason: a
    // rejection with no explanation is the single most demoralising thing this
    // system could produce.
    for (const to of ["REJECTED", "ABANDONED"] as const) {
      for (const transition of TRANSITIONS.filter((t) => t.to === to)) {
        assert.equal(transition.requiresReason, true, `${transition.from}->${to} needs a reason`);
      }
    }

    const requestChanges = TRANSITIONS.filter((t) => t.label === "Request changes");
    assert.ok(requestChanges.length >= 2, "both request-changes edges should exist");
    assert.ok(requestChanges.every((t) => t.requiresReason === true));
  });

  it("leaves ARCHIVED terminal — the archive is the product's whole claim", () => {
    assert.deepEqual(transitionsFrom("ARCHIVED"), []);
    assert.ok(isTerminal("ARCHIVED"));
  });

  it("leaves ABANDONED terminal", () => {
    assert.deepEqual(transitionsFrom("ABANDONED"), []);
    assert.ok(isTerminal("ABANDONED"));
  });

  it("gives every non-terminal state a way forward", () => {
    // A reachable state with no outgoing edge is a project nobody can move,
    // and it presents as "the button does nothing".
    for (const status of ALL_STATUSES) {
      if (isTerminal(status)) continue;
      assert.ok(transitionsFrom(status).length > 0, `${status} is a dead end`);
    }
  });

  it("makes every state reachable from DRAFT", () => {
    const seen = new Set<Status>(["DRAFT"]);
    const queue: Status[] = ["DRAFT"];

    while (queue.length > 0) {
      for (const transition of transitionsFrom(queue.shift()!)) {
        if (!seen.has(transition.to)) {
          seen.add(transition.to);
          queue.push(transition.to);
        }
      }
    }

    for (const status of ALL_STATUSES) {
      assert.ok(seen.has(status), `${status} is unreachable from DRAFT`);
    }
  });

  it("lets a rejected proposal be revised rather than restarted", () => {
    // Forcing a new project would orphan the similarity check and the history,
    // and would teach groups not to propose early.
    assert.ok(transitionsFrom("REJECTED").some((t) => t.to === "DRAFT"));
  });
});

/* ------------------------------------------------------------- the refusals */

describe("attemptTransition", () => {
  it("POSITIVE CONTROL — a complete project may be submitted for review", () => {
    const result = attemptTransition("IN_PROGRESS", "UNDER_REVIEW", complete());
    assert.equal(result.ok, true);
  });

  it("refuses an edge that does not exist, naming both states in words", () => {
    const result = attemptTransition("DRAFT", "COMPLETED", complete());
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.reason, /draft to completed/i);
  });

  it("says so plainly when the project is already in that state", () => {
    const result = attemptTransition("DRAFT", "DRAFT", complete());
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.reason, /already in that state/i);
  });

  it("names every incomplete required section, not just the count", () => {
    const facts = complete({
      completeSections: SECTION_ORDER.filter(
        (kind) => kind !== "METHODOLOGY" && kind !== "TESTING",
      ),
    });

    const result = attemptTransition("IN_PROGRESS", "UNDER_REVIEW", facts);
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.reason, /Methodology/);
    assert.match(result.ok ? "" : result.reason, /Testing/);
    assert.match(result.ok ? "" : result.reason, /2 required sections/);
  });

  it("does not count an optional section against submission", () => {
    // PROTOTYPE and FUTURE_WORK are optional: not every project builds a
    // prototype, and a project should not be blocked for lacking one.
    const facts = complete({
      completeSections: SECTION_ORDER.filter(
        (kind) => kind !== "PROTOTYPE" && kind !== "FUTURE_WORK",
      ),
    });

    assert.equal(attemptTransition("IN_PROGRESS", "UNDER_REVIEW", facts).ok, true);
  });

  it("names the open milestones", () => {
    const facts = complete({
      milestones: [
        { title: "Field trial", state: "IN_PROGRESS" },
        { title: "Prototype demo", state: "COMPLETE" },
      ],
    });

    const result = attemptTransition("IN_PROGRESS", "UNDER_REVIEW", facts);
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.reason, /Field trial/);
    assert.doesNotMatch(result.ok ? "" : result.reason, /Prototype demo/);
  });

  it("names who still owes a peer review", () => {
    const facts = complete({ outstandingReviewers: ["Rahul Verma"] });

    const result = attemptTransition("IN_PROGRESS", "UNDER_REVIEW", facts);
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.reason, /Rahul Verma has not submitted/);
  });

  it("uses a plural verb for several outstanding reviewers", () => {
    const facts = complete({ outstandingReviewers: ["Rahul Verma", "Meera Iyer"] });

    const result = attemptTransition("IN_PROGRESS", "UNDER_REVIEW", facts);
    assert.match(result.ok ? "" : result.reason, /Rahul Verma and Meera Iyer have not/);
  });

  it("requires the similarity check before a proposal, not after approval", () => {
    const facts = complete({ hasSimilarityCheck: false, completeSections: ["PROBLEM"] });

    const result = attemptTransition("DRAFT", "PROPOSED", facts);
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.reason, /similarity check/i);
  });

  it("names every missing proposal field at once, rather than one at a time", () => {
    const facts = complete({
      hasTitle: false,
      hasSummary: false,
      hasMembers: false,
      completeSections: [],
    });

    const result = attemptTransition("DRAFT", "PROPOSED", facts);
    assert.equal(result.ok, false);

    const reason = result.ok ? "" : result.reason;
    assert.match(reason, /a title/);
    assert.match(reason, /a one-line summary/);
    assert.match(reason, /at least one team member/);
    assert.match(reason, /completed problem statement/);
  });

  it("lets a proposal through on the problem statement alone", () => {
    // A proposal is not a finished project. Requiring more than the problem
    // would defeat the point of proposing early.
    const facts = complete({ completeSections: ["PROBLEM"], milestones: [] });
    assert.equal(attemptTransition("DRAFT", "PROPOSED", facts).ok, true);
  });

  it("requires an abstract before archiving, because it becomes the citation", () => {
    const facts = complete({ hasAbstract: false });
    const result = attemptTransition("COMPLETED", "ARCHIVED", facts);

    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.reason, /abstract/i);
  });

  it("puts no preconditions on faculty refusals", () => {
    // A faculty member must always be able to reject or return an incomplete
    // proposal — that is the case for doing it.
    const nothing = complete({
      completeSections: [],
      hasTitle: false,
      hasSummary: false,
      hasAbstract: false,
      hasMembers: false,
      hasSimilarityCheck: false,
    });

    assert.equal(attemptTransition("PROPOSED", "REJECTED", nothing).ok, true);
    assert.equal(attemptTransition("PROPOSED", "DRAFT", nothing).ok, true);
  });
});

/* ------------------------------------------------------------- editability */

describe("isEditable", () => {
  it("locks a submitted project — acceptance criterion 7", () => {
    assert.equal(isEditable("UNDER_REVIEW"), false);
  });

  it("locks an archived project, permanently", () => {
    assert.equal(isEditable("ARCHIVED"), false);
  });

  it("unlocks again when faculty request changes", () => {
    // UNDER_REVIEW -> IN_PROGRESS is the only way out, and IN_PROGRESS edits.
    assert.ok(transitionsFrom("UNDER_REVIEW").some((t) => t.to === "IN_PROGRESS"));
    assert.equal(isEditable("IN_PROGRESS"), true);
  });

  it("allows editing while a proposal is under consideration", () => {
    assert.equal(isEditable("PROPOSED"), true);
  });

  it("does not allow editing an abandoned project", () => {
    assert.equal(isEditable("ABANDONED"), false);
  });
});

describe("COUNTS_AS_EVIDENCE", () => {
  it("excludes DRAFT, so a skill cannot be manufactured with an empty project", () => {
    // Phase 6's rule, restated here because Phase 8 is what changes the state.
    assert.equal(COUNTS_AS_EVIDENCE.has("DRAFT"), false);
    assert.equal(COUNTS_AS_EVIDENCE.has("PROPOSED"), false);
    assert.equal(COUNTS_AS_EVIDENCE.has("IN_PROGRESS"), true);
    assert.equal(COUNTS_AS_EVIDENCE.has("COMPLETED"), true);
    assert.equal(COUNTS_AS_EVIDENCE.has("ARCHIVED"), true);
  });
});
