import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { REQUIRED_SECTIONS, SECTION_ORDER } from "@/config/sections";

import {
  PROGRESS_WEIGHTS,
  computeProgress,
  milestoneState,
  riskSignals,
  type ProgressInput,
} from "./progress";

/**
 * Progress is the number a faculty member glances at to decide whether to
 * intervene. These tests pin the properties that make it worth glancing at —
 * chiefly that it cannot reach 100% while the record is unwritten, and that a
 * group who does not use a feature is not punished for it.
 */

const sections = (completeKinds: readonly string[]): ProgressInput["sections"] =>
  SECTION_ORDER.map((kind) => ({ kind, complete: completeKinds.includes(kind) }));

const base = (overrides: Partial<ProgressInput> = {}): ProgressInput => ({
  sections: sections([]),
  requiredSections: REQUIRED_SECTIONS,
  milestones: [],
  tasks: [],
  ...overrides,
});

describe("computeProgress", () => {
  it("is 0 for an empty project", () => {
    assert.equal(computeProgress(base()).percent, 0);
  });

  it("is 100 only when every component is finished", () => {
    const progress = computeProgress(
      base({
        sections: sections(SECTION_ORDER),
        milestones: [{ state: "COMPLETE" }, { state: "COMPLETE" }],
        tasks: [{ status: "DONE" }, { status: "DONE" }],
      }),
    );

    assert.equal(progress.percent, 100);
  });

  it("weights sections heaviest — a closed board with nothing written is not nearly done", () => {
    const allTasks = computeProgress(
      base({ tasks: [{ status: "DONE" }, { status: "DONE" }], sections: sections([]) }),
    );
    const allSections = computeProgress(
      base({ tasks: [{ status: "TODO" }, { status: "TODO" }], sections: sections(SECTION_ORDER) }),
    );

    assert.ok(
      allSections.percent > allTasks.percent,
      `sections ${allSections.percent}% should beat tasks ${allTasks.percent}%`,
    );
  });

  it("counts required sections against the required list, not the rows present", () => {
    // A section row that has not been created is an incomplete section, not an
    // absent one — otherwise a project with one written section reads as 100%.
    const progress = computeProgress(base({ sections: [{ kind: "PROBLEM", complete: true }] }));

    assert.equal(progress.sections.total, REQUIRED_SECTIONS.length);
    assert.equal(progress.sections.done, 1);
    assert.ok(progress.percent < 100);
  });

  it("ignores optional sections entirely", () => {
    const withoutOptional = computeProgress(base({ sections: sections(REQUIRED_SECTIONS) }));

    assert.equal(withoutOptional.sections.fraction, 1);
    assert.equal(withoutOptional.percent, 100);
  });

  it("does not penalise a group for not using milestones", () => {
    // The weight of an empty component is redistributed. Without that, a group
    // with no milestones could never exceed 70% however finished they were.
    const noMilestones = computeProgress(
      base({ sections: sections(SECTION_ORDER), tasks: [{ status: "DONE" }] }),
    );

    assert.equal(noMilestones.percent, 100);
    assert.equal(noMilestones.applied.milestones, 0);
  });

  it("redistributes proportionally rather than arbitrarily", () => {
    const progress = computeProgress(
      base({ sections: sections(SECTION_ORDER), tasks: [{ status: "TODO" }] }),
    );

    // sections 0.5 and tasks 0.2 of a 0.7 total.
    const expected =
      PROGRESS_WEIGHTS.sections / (PROGRESS_WEIGHTS.sections + PROGRESS_WEIGHTS.tasks);
    assert.ok(Math.abs(progress.applied.sections - expected) < 1e-9);
    assert.ok(Math.abs(progress.applied.sections + progress.applied.tasks - 1) < 1e-9);
  });

  it("treats an empty component as 0%, never as complete", () => {
    const progress = computeProgress(base());

    assert.equal(progress.milestones.fraction, 0);
    assert.equal(progress.tasks.fraction, 0);
    assert.equal(progress.sections.fraction, 0);
  });

  it("never exceeds 100 or falls below 0", () => {
    for (const input of [
      base(),
      base({ sections: sections(SECTION_ORDER) }),
      base({ milestones: [{ state: "COMPLETE" }], tasks: [{ status: "DONE" }] }),
    ]) {
      const { percent } = computeProgress(input);
      assert.ok(percent >= 0 && percent <= 100, `got ${percent}`);
    }
  });
});

describe("milestoneState", () => {
  const now = new Date("2026-03-15T12:00:00Z");
  const past = new Date("2026-03-01T12:00:00Z");
  const future = new Date("2026-04-01T12:00:00Z");

  it("derives AT_RISK from the date rather than trusting the stored state", () => {
    assert.equal(milestoneState({ state: "IN_PROGRESS", dueDate: past }, now), "AT_RISK");
  });

  it("leaves a completed milestone complete, however late it was", () => {
    // A stored AT_RISK would still read as at-risk after the work was finished.
    assert.equal(milestoneState({ state: "COMPLETE", dueDate: past }, now), "COMPLETE");
  });

  it("leaves an undated milestone alone", () => {
    assert.equal(milestoneState({ state: "UPCOMING", dueDate: null }, now), "UPCOMING");
  });

  it("does not flag a milestone that is merely approaching", () => {
    assert.equal(milestoneState({ state: "UPCOMING", dueDate: future }, now), "UPCOMING");
  });
});

describe("riskSignals", () => {
  const now = new Date("2026-03-15T12:00:00Z");
  const overdue = new Date("2026-02-01T12:00:00Z");

  it("is silent on a healthy project", () => {
    const signals = riskSignals(
      {
        ...base({ sections: sections(SECTION_ORDER) }),
        milestones: [{ title: "Demo", state: "COMPLETE", dueDate: overdue }],
        lastActivityAt: new Date("2026-03-14T12:00:00Z"),
      },
      now,
    );

    assert.deepEqual(signals, []);
  });

  it("names a single slipped milestone", () => {
    const signals = riskSignals(
      {
        ...base(),
        milestones: [{ title: "Field trial", state: "IN_PROGRESS", dueDate: overdue }],
        lastActivityAt: now,
      },
      now,
    );

    assert.equal(signals.length, 1);
    assert.match(signals[0]!.message, /"Field trial" is past its due date/);
  });

  it("counts rather than lists several slipped milestones", () => {
    const signals = riskSignals(
      {
        ...base(),
        milestones: [
          { title: "A", state: "IN_PROGRESS", dueDate: overdue },
          { title: "B", state: "UPCOMING", dueDate: overdue },
        ],
        lastActivityAt: now,
      },
      now,
    );

    assert.match(signals[0]!.message, /2 milestones are past their due date/);
  });

  it("flags a stalled project by how long it has been quiet", () => {
    const signals = riskSignals(
      { ...base(), milestones: [], lastActivityAt: new Date("2026-01-01T12:00:00Z") },
      now,
    );

    assert.ok(signals.some((signal) => signal.kind === "stalled"));
    assert.match(
      signals.find((s) => s.kind === "stalled")!.message,
      /No recorded activity for \d+ days/,
    );
  });

  it("flags the specific failure of a closed board and an unwritten record", () => {
    // The most common way a project arrives at review unusable.
    const signals = riskSignals(
      {
        ...base({
          tasks: [{ status: "DONE" }, { status: "DONE" }, { status: "DONE" }, { status: "TODO" }],
        }),
        milestones: [],
        lastActivityAt: now,
      },
      now,
    );

    const unwritten = signals.find((signal) => signal.kind === "unwritten");
    assert.ok(unwritten, "a closed board with nothing written must be flagged");
    assert.match(unwritten.message, /75% of tasks are closed but only 0%/);
  });

  it("states what the data shows without concluding anything about the people", () => {
    const signals = riskSignals(
      {
        ...base(),
        milestones: [{ title: "A", state: "UPCOMING", dueDate: overdue }],
        lastActivityAt: new Date("2026-01-01T12:00:00Z"),
      },
      now,
    );

    for (const signal of signals) {
      assert.doesNotMatch(signal.message, /failing|lazy|poor|bad|behind schedule|at fault/i);
    }
  });
});
