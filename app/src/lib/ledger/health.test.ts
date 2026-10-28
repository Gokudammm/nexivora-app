import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HEALTH_DEFAULTS, SIGNAL_RANK, thresholdsFor } from "@/config/health";

import { AUDIENCE_FRAMING, groupHealth, healthLevel, type HealthInput } from "./health";
import { scoreMembers, type LedgerRow, type Member } from "./score";

/**
 * The health signals are what a faculty member reads on a Tuesday with fifteen
 * minutes, and what a group reads about a named teammate. Both audiences make
 * the wording as load-bearing as the arithmetic, so these tests assert both —
 * including that a message never concludes anything about a person.
 */

const member = (id: string, name: string): Member => ({ id, name, username: id, avatarUrl: null });

const ananya = member("u1", "Ananya Sharma");
const rahul = member("u2", "Rahul Verma");
const meera = member("u3", "Meera Iyer");
const TEAM = [ananya, rahul, meera];

const day = (n: number) => new Date(Date.UTC(2026, 0, n, 12, 0, 0));
const NOW = day(40);

const events = (userId: string, count: number, on: number): LedgerRow[] =>
  Array.from({ length: count }, () => ({
    userId,
    kind: "TASK_CLOSED" as const,
    weight: 5,
    createdAt: day(on),
  }));

const input = (rows: LedgerRow[], overrides: Partial<HealthInput> = {}): HealthInput => ({
  scores: scoreMembers(TEAM, rows),
  totalEvents: rows.length,
  overdueTasks: [],
  slippedMilestones: [],
  openBlockers: [],
  lastActivityAt: day(39),
  ...overrides,
});

/* -------------------------------------------------------------- thresholds */

describe("thresholds", () => {
  it("returns the defaults when no college is named", () => {
    assert.deepEqual(thresholdsFor(), HEALTH_DEFAULTS);
    assert.deepEqual(thresholdsFor(null), HEALTH_DEFAULTS);
  });

  it("returns the defaults for a college with no override", () => {
    assert.deepEqual(thresholdsFor("some-college-id"), HEALTH_DEFAULTS);
  });

  it("ranks a blocker above everything else", () => {
    // Somebody has already asked for help and nobody answered. Nothing in this
    // file outranks that.
    for (const kind of Object.keys(SIGNAL_RANK) as (keyof typeof SIGNAL_RANK)[]) {
      if (kind === "unresolved-blocker") continue;
      assert.ok(
        SIGNAL_RANK["unresolved-blocker"] < SIGNAL_RANK[kind],
        `blocker should outrank ${kind}`,
      );
    }
  });
});

/* ------------------------------------------------------------ the thin gate */

describe("the evidence gate", () => {
  it("fires no member-level signal on thin data, however lopsided", () => {
    const rows = events("u1", HEALTH_DEFAULTS.minEvents - 1, 39);
    const signals = groupHealth(input(rows), NOW);

    assert.equal(
      signals.filter((s) => s.kind === "silent-member" || s.kind === "imbalance").length,
      0,
    );
  });

  it("still reports a blocker on thin data — that gate is deliberate", () => {
    // A group that says "we are stuck" in week one deserves an answer in week
    // one, and their event count is beside the point.
    const signals = groupHealth(
      input(events("u1", 3, 39), {
        openBlockers: [{ id: "b1", title: "Sensor calibration drift", openedAt: day(20) }],
      }),
      NOW,
    );

    assert.equal(signals.length, 1);
    assert.equal(signals[0]!.kind, "unresolved-blocker");
  });

  it("still reports a stalled workspace on thin data", () => {
    const signals = groupHealth(input(events("u1", 3, 1), { lastActivityAt: day(1) }), NOW);

    assert.ok(signals.some((s) => s.kind === "stalled"));
  });
});

/* ---------------------------------------------------------------- signals */

describe("groupHealth", () => {
  const thick = () => [...events("u1", 30, 39), ...events("u2", 30, 39)];

  it("is silent on a healthy group", () => {
    const rows = [...events("u1", 20, 39), ...events("u2", 20, 39), ...events("u3", 20, 39)];
    assert.deepEqual(groupHealth(input(rows), NOW), []);
  });

  it("names a member with nothing recorded, and shows the count as evidence", () => {
    const signals = groupHealth(input(thick()), NOW);
    const silent = signals.find((s) => s.userId === "u3");

    assert.ok(silent);
    assert.equal(silent.kind, "silent-member");
    assert.match(silent.message, /Meera Iyer has no recorded activity/);
    assert.match(silent.evidence, /0 of 60 recorded events/);
  });

  it("dates a member who has gone quiet", () => {
    const rows = [...thick(), ...events("u3", 5, 1)];
    const signals = groupHealth(input(rows), NOW);
    const quiet = signals.find((s) => s.userId === "u3");

    assert.ok(quiet);
    assert.match(quiet.message, /recorded nothing in 39 days/);
    assert.match(quiet.evidence, /5 of 65 recorded events/);
  });

  it("does not double-report a silent member as also imbalanced", () => {
    const signals = groupHealth(input(thick()), NOW);
    assert.equal(signals.filter((s) => s.userId === "u3").length, 1);
  });

  it("reports an imbalance only for somebody still active", () => {
    const rows = [...thick(), ...events("u3", 1, 39)];
    const signals = groupHealth(input(rows), NOW);
    const low = signals.find((s) => s.userId === "u3");

    assert.ok(low);
    assert.equal(low.kind, "imbalance");
    assert.equal(low.severity, "info");
    assert.match(low.evidence, /1 of 61 events/);
  });

  it("uses 10% as the imbalance floor, not 8%", () => {
    // Phase 7 used 8% and mostly succeeded in never firing. The Phase 9 spec
    // asks for 10%, which is where the rest of a five-person group has usually
    // already noticed.
    assert.equal(HEALTH_DEFAULTS.imbalanceShare, 0.1);

    // 9% share: fires at 10%, would not have fired at 8%.
    const rows = [...events("u1", 50, 39), ...events("u2", 41, 39), ...events("u3", 9, 39)];
    const signals = groupHealth(input(rows), NOW);

    assert.ok(signals.some((s) => s.userId === "u3" && s.kind === "imbalance"));
  });

  it("reports a slipped milestone with its due date", () => {
    const signals = groupHealth(
      input(thick(), {
        slippedMilestones: [{ id: "m1", title: "Prototype demo", dueOn: day(30) }],
      }),
      NOW,
    );

    const slipped = signals.find((s) => s.kind === "slipped-milestone");
    assert.ok(slipped);
    assert.match(slipped.message, /"Prototype demo" was due 10 days ago/);
  });

  it("does not fire a blocker that is younger than the threshold", () => {
    const signals = groupHealth(
      input(thick(), {
        openBlockers: [{ id: "b1", title: "Fresh problem", openedAt: day(37) }],
      }),
      NOW,
    );

    assert.ok(!signals.some((s) => s.kind === "unresolved-blocker"));
  });

  it("orders worst first — a blocker above a stalled board above an imbalance", () => {
    const rows = [...thick(), ...events("u3", 1, 39)];
    const signals = groupHealth(
      input(rows, {
        lastActivityAt: day(20),
        openBlockers: [{ id: "b1", title: "Stuck", openedAt: day(10) }],
        slippedMilestones: [{ id: "m1", title: "Demo", dueOn: day(30) }],
      }),
      NOW,
    );

    const kinds = signals.map((s) => s.kind);
    assert.equal(kinds[0], "unresolved-blocker");
    assert.ok(kinds.indexOf("stalled") < kinds.indexOf("slipped-milestone"));
    assert.ok(kinds.indexOf("slipped-milestone") < kinds.indexOf("imbalance"));
  });

  it("gives every signal evidence and an action", () => {
    const rows = [...thick(), ...events("u3", 1, 39)];
    const signals = groupHealth(
      input(rows, {
        lastActivityAt: day(20),
        openBlockers: [{ id: "b1", title: "Stuck", openedAt: day(10) }],
        slippedMilestones: [{ id: "m1", title: "Demo", dueOn: day(30) }],
        overdueTasks: [
          { id: "t1", title: "A", dueDate: day(30) },
          { id: "t2", title: "B", dueDate: day(31) },
          { id: "t3", title: "C", dueDate: day(32) },
        ],
      }),
      NOW,
    );

    assert.ok(signals.length >= 4);
    for (const signal of signals) {
      assert.ok(signal.evidence.length > 0, `${signal.kind} has no evidence`);
      assert.ok(signal.action.label.length > 0, `${signal.kind} has no action`);
    }
  });

  it("states what the data shows and concludes nothing about the people", () => {
    const rows = [...thick(), ...events("u3", 1, 39)];
    const signals = groupHealth(
      input(rows, {
        lastActivityAt: day(20),
        openBlockers: [{ id: "b1", title: "Stuck", openedAt: day(10) }],
        slippedMilestones: [{ id: "m1", title: "Demo", dueOn: day(30) }],
      }),
      NOW,
    );

    for (const signal of signals) {
      assert.doesNotMatch(
        `${signal.message} ${signal.evidence}`,
        /lazy|failing|freeload|free-rid|not contributing|poor|slack|underperform/i,
        `"${signal.message}" editorialises`,
      );
    }
  });

  it("honours a per-college override", () => {
    const rows = thick();

    const strict = groupHealth(
      input(rows, { thresholds: { ...HEALTH_DEFAULTS, silentMemberDays: 1 } }),
      NOW,
    );
    const lenient = groupHealth(
      input(rows, { thresholds: { ...HEALTH_DEFAULTS, minEvents: 10_000 } }),
      NOW,
    );

    assert.ok(strict.length > lenient.length);
  });
});

describe("healthLevel", () => {
  const signal = (severity: "info" | "warning") => ({
    kind: "imbalance" as const,
    severity,
    userId: "u1",
    message: "",
    evidence: "",
    action: { label: "x", kind: "message" as const },
  });

  it("is ok with no signals, watch on info, attention on a warning", () => {
    assert.equal(healthLevel([]), "ok");
    assert.equal(healthLevel([signal("info")]), "watch");
    assert.equal(healthLevel([signal("info"), signal("warning")]), "attention");
  });
});

describe("audience framing", () => {
  it("gives the group and the faculty different headings, not different data", () => {
    // ADR-045: the content is identical; only the framing changes.
    assert.notEqual(AUDIENCE_FRAMING.faculty.heading, AUDIENCE_FRAMING.group.heading);
    assert.ok(AUDIENCE_FRAMING.group.note.length > 0);
  });

  it("tells the group these can be wrong about the work", () => {
    // The honest caveat, and the actionable one: the fix is usually to record
    // what you are doing rather than to argue with the number.
    assert.match(AUDIENCE_FRAMING.group.note, /can be wrong/i);
  });

  it("tells faculty a signal is a reason to ask, not a conclusion", () => {
    assert.match(AUDIENCE_FRAMING.faculty.note, /reason to ask|not a conclusion/i);
  });
});

/* ------------------------------------------------------- finished work */

describe("a group whose project is finished", () => {
  // Found by looking at a screenshot of /faculty rather than by a failing test:
  // four of four groups carried a warning, three of them because their work was
  // delivered months ago. A panel where everything is flagged ranks nothing.
  const quiet = input([...events("u1", 30, 5), ...events("u2", 2, 5)], {
    lastActivityAt: day(5),
  });

  it("is not stalled — silence after delivery is the correct state", () => {
    const live = groupHealth(quiet, NOW).map((signal) => signal.kind);
    const done = groupHealth({ ...quiet, active: false }, NOW).map((signal) => signal.kind);

    assert.ok(live.includes("stalled"));
    assert.ok(!done.includes("stalled"));
  });

  it("raises no member-level signal, because there is no work left to carry", () => {
    const done = groupHealth({ ...quiet, active: false }, NOW);

    assert.ok(!done.some((signal) => signal.userId !== null));
  });

  it("still reports an unresolved blocker — a loose end is a loose end", () => {
    const done = groupHealth(
      {
        ...quiet,
        active: false,
        openBlockers: [{ id: "t1", title: "Probes read zero", openedAt: day(10) }],
      },
      NOW,
    );

    assert.deepEqual(
      done.map((signal) => signal.kind),
      ["unresolved-blocker"],
    );
  });

  it("defaults to active, so an omitted flag never silences a live group", () => {
    assert.deepEqual(groupHealth(quiet, NOW), groupHealth({ ...quiet, active: true }, NOW));
  });
});
