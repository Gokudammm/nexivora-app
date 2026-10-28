import type { $Enums } from "@prisma/client";

/**
 * COMPUTED PROGRESS.
 *
 * *"A self-reported percentage is meaningless and every faculty member knows
 * it."* — the phase spec, and it is the whole argument. A number a group types
 * in is a number the group chose; a number derived from sections written,
 * milestones closed and tasks finished is a number about the work.
 *
 * This is a pure function over counts, which matters for two reasons beyond
 * testability. It cannot be stored, so it cannot go stale — there is no
 * `project.progress` column to forget to update. And because the weights live
 * in one object, "why is this 40%?" has an answer anybody can read.
 *
 * The three components are weighted unevenly on purpose. **Sections carry the
 * most** because the written record is the deliverable — a project with every
 * task closed and nothing written is not nearly finished, whatever the board
 * says. **Tasks carry the least** because a group can create and close as many
 * as it likes; they are the component most easily inflated, and weighting them
 * heavily would reward busywork.
 */

export const PROGRESS_WEIGHTS = {
  sections: 0.5,
  milestones: 0.3,
  tasks: 0.2,
} as const;

export type ProgressInput = {
  sections: readonly { kind: $Enums.SectionKind; complete: boolean }[];
  /** Required kinds only — an optional section left empty must not depress progress. */
  requiredSections: readonly $Enums.SectionKind[];
  milestones: readonly { state: $Enums.MilestoneState }[];
  tasks: readonly { status: $Enums.TaskStatus }[];
};

export type ProgressComponent = {
  done: number;
  total: number;
  /** 0–1. Zero total means 0, never 1 — see the note in `ratio`. */
  fraction: number;
};

export type Progress = {
  /** 0–100, rounded. */
  percent: number;
  sections: ProgressComponent;
  milestones: ProgressComponent;
  tasks: ProgressComponent;
  /** Weights actually applied, after redistributing away from empty components. */
  applied: { sections: number; milestones: number; tasks: number };
};

/**
 * An empty component is 0%, not 100%.
 *
 * The tempting alternative — "no milestones, so milestones are complete" —
 * makes a project with nothing in it read as finished, which is exactly
 * backwards. Instead an empty component is **excluded from the weighting**
 * below, so a group that does not use milestones is scored on sections and
 * tasks rather than being penalised for a feature they did not adopt.
 */
const ratio = (done: number, total: number): ProgressComponent => ({
  done,
  total,
  fraction: total === 0 ? 0 : done / total,
});

export function computeProgress(input: ProgressInput): Progress {
  const required = new Set(input.requiredSections);

  const requiredSections = input.sections.filter((section) => required.has(section.kind));
  const sections = ratio(
    requiredSections.filter((section) => section.complete).length,
    // The denominator is the required list, not the rows present: a section row
    // that has not been created yet is an incomplete section, not an absent one.
    required.size,
  );

  const milestones = ratio(
    input.milestones.filter((milestone) => milestone.state === "COMPLETE").length,
    input.milestones.length,
  );

  const tasks = ratio(
    input.tasks.filter((task) => task.status === "DONE").length,
    input.tasks.length,
  );

  // Redistribute the weight of any component that has nothing in it, so the
  // remaining components still sum to 1. Without this, a group with no
  // milestones could never exceed 70% however finished they were.
  const present = {
    sections: sections.total > 0,
    milestones: milestones.total > 0,
    tasks: tasks.total > 0,
  };

  const totalWeight =
    (present.sections ? PROGRESS_WEIGHTS.sections : 0) +
    (present.milestones ? PROGRESS_WEIGHTS.milestones : 0) +
    (present.tasks ? PROGRESS_WEIGHTS.tasks : 0);

  const applied = {
    sections: present.sections && totalWeight > 0 ? PROGRESS_WEIGHTS.sections / totalWeight : 0,
    milestones:
      present.milestones && totalWeight > 0 ? PROGRESS_WEIGHTS.milestones / totalWeight : 0,
    tasks: present.tasks && totalWeight > 0 ? PROGRESS_WEIGHTS.tasks / totalWeight : 0,
  };

  const percent = Math.round(
    (sections.fraction * applied.sections +
      milestones.fraction * applied.milestones +
      tasks.fraction * applied.tasks) *
      100,
  );

  return { percent, sections, milestones, tasks, applied };
}

/* ------------------------------------------------------------ at risk */

/**
 * Whether a milestone is behind, derived rather than stored.
 *
 * `AT_RISK` exists in the enum, but a stored at-risk flag is wrong the morning
 * after it is set. The state a milestone is *in* is data; whether it is late is
 * a fact about today, so it is computed against `now` at read time.
 */
export function milestoneState(
  milestone: { state: $Enums.MilestoneState; dueDate: Date | null },
  now = new Date(),
): $Enums.MilestoneState {
  if (milestone.state === "COMPLETE") return "COMPLETE";
  if (milestone.dueDate && milestone.dueDate < now) return "AT_RISK";
  return milestone.state;
}

export type RiskSignal = {
  kind: "slipped-milestone" | "stalled" | "unwritten";
  message: string;
};

/**
 * Why a project is behind, in sentences rather than a flag.
 *
 * Consumed by Phase 9's faculty dashboard. Same discipline as the group health
 * signals: it states what the data shows and stops there. "Three milestones are
 * past their due date" is a prompt to ask; "this group is failing" is a
 * conclusion the system is not entitled to draw.
 */
export function riskSignals(
  input: Omit<ProgressInput, "milestones"> & {
    /** Dated, because "late" is a fact about today and cannot be read off a stored state. */
    milestones: readonly { title: string; state: $Enums.MilestoneState; dueDate: Date | null }[];
    lastActivityAt: Date | null;
  },
  now = new Date(),
): RiskSignal[] {
  const signals: RiskSignal[] = [];
  const progress = computeProgress(input);

  const slipped = input.milestones.filter(
    (milestone) => milestoneState(milestone, now) === "AT_RISK",
  );

  if (slipped.length > 0) {
    signals.push({
      kind: "slipped-milestone",
      message:
        slipped.length === 1
          ? `"${slipped[0]!.title}" is past its due date.`
          : `${slipped.length} milestones are past their due date.`,
    });
  }

  if (input.lastActivityAt) {
    const days = Math.floor((now.getTime() - input.lastActivityAt.getTime()) / 86_400_000);
    if (days > 21) {
      signals.push({ kind: "stalled", message: `No recorded activity for ${days} days.` });
    }
  }

  // The specific shape worth flagging: the board looks finished and nothing is
  // written. It is the most common way a project arrives at review unusable.
  if (progress.tasks.fraction > 0.7 && progress.sections.fraction < 0.3) {
    signals.push({
      kind: "unwritten",
      message: `${Math.round(progress.tasks.fraction * 100)}% of tasks are closed but only ${Math.round(
        progress.sections.fraction * 100,
      )}% of the required sections are written.`,
    });
  }

  return signals;
}
