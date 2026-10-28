import type { $Enums } from "@prisma/client";

/**
 * THE PROJECT LIFECYCLE.
 *
 * One transition table, and everything that changes a project's status goes
 * through `attemptTransition()`. The reason is the same one that put `can()` in
 * a single file: the moment two places decide whether a project may move from
 * `UNDER_REVIEW` to `COMPLETED`, they drift, and the more permissive one wins
 * silently.
 *
 * Three properties this file is written to have:
 *
 * **A refusal names what is missing.** "You cannot submit this project" is a
 * dead end. "Three required sections are incomplete: Methodology, Testing,
 * Results" is something a student can act on without asking anybody. Every
 * precondition below returns the specific sentence, not a boolean.
 *
 * **Who may act is part of the table, not the caller's memory.** Each
 * transition names the actor it requires, and `attemptTransition` checks it
 * against the same `can()` the rest of the product uses.
 *
 * **The terminal states are terminal.** `ARCHIVED` has no outgoing edge, and
 * that is deliberate: the archive is the product's whole claim to being a
 * permanent record. A project that can be quietly un-archived and edited is not
 * a record, and every citation pointing at it becomes provisional.
 */

export type Status = $Enums.ProjectStatus;

/** Who is permitted to make a transition. Checked against `can()` by the caller. */
export type Actor =
  /** Any member of the owning group. */
  | "member"
  /** The group lead only — submission is a commitment on behalf of the team. */
  | "lead"
  /** A faculty member who teaches the project's subject. */
  | "faculty";

export type Transition = {
  from: Status;
  to: Status;
  actor: Actor;
  /** Imperative, for the button. */
  label: string;
  /** What the actor is agreeing to, shown at the point of action. */
  description: string;
  /** A reason is required — for rejections and abandonment. */
  requiresReason?: boolean;
};

/**
 * The table.
 *
 * Read it as a list of the only things that may ever happen to a project. If a
 * transition is not here, it cannot occur — `attemptTransition` refuses
 * anything it does not find, so the default is denial and a new state added to
 * the enum without an edge is unreachable rather than unguarded.
 */
export const TRANSITIONS: readonly Transition[] = [
  {
    from: "DRAFT",
    to: "PROPOSED",
    actor: "lead",
    label: "Submit proposal",
    description:
      "Sends the problem statement and proposed solution to your faculty guide for approval. You can keep editing while it is under consideration.",
  },
  {
    from: "PROPOSED",
    to: "APPROVED",
    actor: "faculty",
    label: "Approve proposal",
    description:
      "Approves the problem as stated and unlocks the full project record for the group.",
  },
  {
    from: "PROPOSED",
    to: "REJECTED",
    actor: "faculty",
    label: "Reject proposal",
    description: "Refuses the proposal. The group sees your reason and can revise and resubmit.",
    requiresReason: true,
  },
  {
    from: "PROPOSED",
    to: "DRAFT",
    actor: "faculty",
    label: "Request changes",
    description:
      "Returns the proposal to the group for revision without rejecting it. Your reason is what they will work from.",
    requiresReason: true,
  },
  {
    // A rejected proposal is revised and resubmitted rather than starting over.
    // Forcing a new project would orphan the similarity check, the status
    // history and anything already written — and would teach groups to avoid
    // proposing early, which is the opposite of what the gate is for.
    from: "REJECTED",
    to: "DRAFT",
    actor: "member",
    label: "Revise proposal",
    description: "Reopens the proposal for editing so you can address the feedback and resubmit.",
  },
  {
    from: "APPROVED",
    to: "IN_PROGRESS",
    actor: "member",
    label: "Start work",
    description: "Marks the project as actively underway. Contribution starts counting from here.",
  },
  {
    from: "IN_PROGRESS",
    to: "UNDER_REVIEW",
    actor: "lead",
    label: "Submit for review",
    description:
      "Locks the record and sends it to your faculty guide. A snapshot is taken exactly as it stands.",
  },
  {
    from: "UNDER_REVIEW",
    to: "IN_PROGRESS",
    actor: "faculty",
    label: "Request changes",
    description:
      "Unlocks the record so the group can revise. Their next submission is a new round.",
    requiresReason: true,
  },
  {
    from: "UNDER_REVIEW",
    to: "COMPLETED",
    actor: "faculty",
    label: "Mark complete",
    description: "Accepts the work as finished. The record stays editable until it is archived.",
  },
  {
    from: "COMPLETED",
    to: "ARCHIVED",
    actor: "faculty",
    label: "Archive",
    description:
      "Assigns a permanent citation ID and makes the record read-only, for good. This cannot be undone.",
  },
  {
    from: "DRAFT",
    to: "ABANDONED",
    actor: "lead",
    label: "Abandon",
    description: "Stops work on this project. Nothing is deleted; it stops appearing as active.",
    requiresReason: true,
  },
  {
    from: "APPROVED",
    to: "ABANDONED",
    actor: "lead",
    label: "Abandon",
    description: "Stops work on this project. Nothing is deleted; it stops appearing as active.",
    requiresReason: true,
  },
  {
    from: "IN_PROGRESS",
    to: "ABANDONED",
    actor: "lead",
    label: "Abandon",
    description: "Stops work on this project. Nothing is deleted; it stops appearing as active.",
    requiresReason: true,
  },
];

/* ------------------------------------------------------------ preconditions */

/**
 * Everything a precondition may look at.
 *
 * Deliberately plain data rather than a Prisma row: the preconditions are pure
 * functions over facts, so they can be unit-tested without a database and the
 * caller is forced to state explicitly what it is asserting.
 */
export type LifecycleFacts = {
  /** Section kinds that are marked complete. */
  completeSections: readonly $Enums.SectionKind[];
  /** Required kinds, from `config/sections.ts`. */
  requiredSections: readonly $Enums.SectionKind[];
  /** Human labels for the required kinds, for the refusal message. */
  sectionLabel: (kind: $Enums.SectionKind) => string;
  milestones: readonly { title: string; state: $Enums.MilestoneState }[];
  /** Group members who still owe a peer review at the current milestone. */
  outstandingReviewers: readonly string[];
  hasTitle: boolean;
  hasSummary: boolean;
  hasAbstract: boolean;
  hasMembers: boolean;
  /** A similarity check has been run at proposal time. */
  hasSimilarityCheck: boolean;
};

export type Refusal = { ok: false; reason: string };
export type Allowed = { ok: true; transition: Transition };
export type TransitionResult = Allowed | Refusal;

const list = (items: readonly string[]): string =>
  items.length === 1
    ? items[0]!
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/**
 * The preconditions, per destination state.
 *
 * Returns the sentence explaining what is missing, or null when the transition
 * may proceed. A precondition never returns a bare boolean — the whole point is
 * that a refusal is actionable.
 */
function precondition(to: Status, facts: LifecycleFacts): string | null {
  if (to === "PROPOSED") {
    const missing: string[] = [];
    if (!facts.hasTitle) missing.push("a title");
    if (!facts.hasSummary) missing.push("a one-line summary");
    if (!facts.hasMembers) missing.push("at least one team member");

    const problem = facts.completeSections.includes("PROBLEM");
    if (!problem) missing.push("a completed problem statement");

    if (missing.length > 0) {
      return `A proposal needs ${list(missing)}.`;
    }

    // The similarity check is a precondition of *proposing*, not of approval.
    // Running it afterwards would mean faculty discover a possible duplicate
    // after the group has already been told their proposal is in — which is the
    // worst moment for everybody.
    if (!facts.hasSimilarityCheck) {
      return "Run the similarity check before submitting. It takes a moment and it is what the approval conversation starts from.";
    }

    return null;
  }

  if (to === "UNDER_REVIEW") {
    const incomplete = facts.requiredSections.filter(
      (kind) => !facts.completeSections.includes(kind),
    );

    if (incomplete.length > 0) {
      return `${incomplete.length} required ${incomplete.length === 1 ? "section is" : "sections are"} incomplete: ${list(
        incomplete.map(facts.sectionLabel),
      )}.`;
    }

    const openMilestones = facts.milestones.filter((m) => m.state !== "COMPLETE");
    if (openMilestones.length > 0) {
      return `${openMilestones.length} ${openMilestones.length === 1 ? "milestone is" : "milestones are"} still open: ${list(
        openMilestones.map((m) => m.title),
      )}.`;
    }

    if (facts.outstandingReviewers.length > 0) {
      return `${list(facts.outstandingReviewers)} ${
        facts.outstandingReviewers.length === 1 ? "has" : "have"
      } not submitted peer reviews yet.`;
    }

    if (!facts.hasAbstract)
      return "Write an abstract before submitting — it is what a reader sees first.";

    return null;
  }

  if (to === "ARCHIVED") {
    // Archiving is irreversible and assigns a permanent citation ID, so the
    // record has to be worth citing.
    if (!facts.hasAbstract)
      return "An archived project needs an abstract; it becomes part of the citation.";
    return null;
  }

  return null;
}

/* --------------------------------------------------------------- the gate */

export function transitionsFrom(status: Status): Transition[] {
  return TRANSITIONS.filter((transition) => transition.from === status);
}

export function findTransition(from: Status, to: Status): Transition | undefined {
  return TRANSITIONS.find((transition) => transition.from === from && transition.to === to);
}

/**
 * May this project move from here to there, and if not, exactly why?
 *
 * The single entry point. Note what it does **not** do: it does not check
 * permissions against a viewer, because that is `can()`'s job and duplicating
 * it here would be a second authorisation decision. It returns the `actor` the
 * transition requires, and the caller asks `can()` about that.
 */
export function attemptTransition(
  from: Status,
  to: Status,
  facts: LifecycleFacts,
): TransitionResult {
  const transition = findTransition(from, to);

  if (!transition) {
    return {
      ok: false,
      reason:
        from === to
          ? "The project is already in that state."
          : `A project cannot go from ${LABEL[from].toLowerCase()} to ${LABEL[to].toLowerCase()}.`,
    };
  }

  const missing = precondition(to, facts);
  if (missing) return { ok: false, reason: missing };

  return { ok: true, transition };
}

export const LABEL: Record<Status, string> = {
  DRAFT: "Draft",
  PROPOSED: "Proposed",
  APPROVED: "Approved",
  IN_PROGRESS: "In progress",
  UNDER_REVIEW: "Under review",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
  REJECTED: "Rejected",
  ABANDONED: "Abandoned",
};

/**
 * States in which the group may edit the record.
 *
 * `UNDER_REVIEW` is the interesting exclusion and it is acceptance criterion 7:
 * a submitted project is locked until faculty request changes. Editing after
 * submission would make the snapshot a lie about what was assessed.
 */
const EDITABLE: ReadonlySet<Status> = new Set<Status>([
  "DRAFT",
  "PROPOSED",
  "APPROVED",
  "IN_PROGRESS",
  "REJECTED",
  "COMPLETED",
]);

export const isEditable = (status: Status): boolean => EDITABLE.has(status);

/** States that count as evidence for skill inference (Phase 6's rule). */
export const COUNTS_AS_EVIDENCE: ReadonlySet<Status> = new Set<Status>([
  "IN_PROGRESS",
  "UNDER_REVIEW",
  "COMPLETED",
  "ARCHIVED",
]);

/** A project nobody is working on any more. */
export const isTerminal = (status: Status): boolean =>
  status === "ARCHIVED" || status === "ABANDONED";
