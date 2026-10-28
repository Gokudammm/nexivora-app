import { randomBytes } from "node:crypto";

/**
 * ATTESTATION — the mechanism that turns evidence into a credential.
 *
 * *"Never auto-issue an attestation. Its entire value is that a named human
 * vouched for it. Making it automatic makes it worthless, and it would be the
 * fastest way to destroy the credential."* — the phase spec, and every design
 * decision in this file follows from it.
 *
 * Which is why this module has no `attestAutomatically`, no threshold, and no
 * rule that promotes a contribution on its own. What it does have is
 * `prefillStatement()`: the ledger writes a **first draft** of the sentence,
 * and a faculty member edits and signs it. Pre-filling is the difference
 * between an attestation taking twenty seconds and taking two minutes, and that
 * difference decides whether the feature gets used at all — but the human is
 * still the one asserting it.
 *
 * **Revocation preserves the record.** A revoked attestation stays visible, is
 * clearly marked, and keeps its reason. Deleting it would let a mistake be made
 * to have never happened, and a credential that can vanish silently is not a
 * credential.
 */

export type AttestationSubjectType = "project" | "contribution";

/**
 * The verification code.
 *
 * Printable, unambiguous and short enough to be typed off a printed CV.
 * Crockford's alphabet without I, L, O and U: no character can be confused with
 * a digit, and none of them can accidentally spell anything.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function attestationCode(): string {
  const bytes = randomBytes(12);
  const body = [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]).join("");
  return `NX-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

export const CODE_PATTERN =
  /^NX-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

export const isAttestationCode = (value: string): boolean =>
  CODE_PATTERN.test(value.trim().toUpperCase());

/* --------------------------------------------------------------- drafting */

export type ContributionEvidence = {
  memberName: string;
  projectTitle: string;
  /** Their declared role on the project. */
  role: string;
  /** Share of the group's recorded activity, 0–1. */
  share: number;
  tasksClosed: number;
  filesContributed: number;
  /** Skills the project evidences, already inferred. */
  skills: readonly string[];
};

export type ProjectEvidence = {
  projectTitle: string;
  memberCount: number;
  /** Section kinds marked complete. */
  completeSections: number;
  totalSections: number;
  milestonesClosed: number;
  hasPrototype: boolean;
  hasResults: boolean;
};

/**
 * A first draft of the sentence, from the ledger.
 *
 * Written to be **edited**, not accepted. It states only what the record
 * actually supports — counts and a share — and deliberately avoids any
 * evaluative adjective, because an adjective the faculty member did not choose
 * is exactly the thing that makes an attestation worthless.
 *
 * "Ananya Sharma designed and implemented the classification model" is a
 * sentence only a person can write. What this produces is the scaffolding
 * around it.
 */
export function prefillContributionStatement(evidence: ContributionEvidence): string {
  const parts: string[] = [
    `${evidence.memberName} worked on "${evidence.projectTitle}" as ${article(evidence.role)}.`,
  ];

  const recorded: string[] = [];
  if (evidence.tasksClosed > 0) {
    recorded.push(
      `${evidence.tasksClosed} closed ${evidence.tasksClosed === 1 ? "task" : "tasks"}`,
    );
  }
  if (evidence.filesContributed > 0) {
    recorded.push(
      `${evidence.filesContributed} ${evidence.filesContributed === 1 ? "file" : "files"} contributed`,
    );
  }

  if (recorded.length > 0) {
    parts.push(
      `The workspace records ${recorded.join(" and ")}, ${Math.round(evidence.share * 100)}% of the group's recorded activity.`,
    );
  }

  if (evidence.skills.length > 0) {
    parts.push(`The work involved ${list(evidence.skills.slice(0, 4))}.`);
  }

  parts.push("");
  parts.push(
    "— Replace this with what you can personally vouch for. The lines above are what the record shows; an attestation is what you know.",
  );

  return parts.join("\n");
}

export function prefillProjectStatement(evidence: ProjectEvidence): string {
  const parts = [
    `A team of ${evidence.memberCount} completed "${evidence.projectTitle}".`,
    `${evidence.completeSections} of ${evidence.totalSections} sections of the record are complete${
      evidence.milestonesClosed > 0
        ? `, with ${evidence.milestonesClosed} ${evidence.milestonesClosed === 1 ? "milestone" : "milestones"} closed`
        : ""
    }.`,
  ];

  if (evidence.hasPrototype && evidence.hasResults) {
    parts.push("The record includes a prototype and measured results.");
  } else if (evidence.hasResults) {
    parts.push("The record includes measured results.");
  }

  parts.push("");
  parts.push(
    "— Replace this with what you personally observed. Did you see it demonstrated? Say so; that is the part nobody else can write.",
  );

  return parts.join("\n");
}

const article = (role: string) => (/^[aeiou]/i.test(role.trim()) ? `an ${role}` : `a ${role}`);

const list = (items: readonly string[]): string =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/* ------------------------------------------------------------ validation */

export type AttestationValidation = { ok: true } | { ok: false; error: string };

/**
 * A statement is refused if it is still the draft.
 *
 * The pre-fill ends with a line asking to be replaced. If that line survives to
 * submission, nobody has vouched for anything and the attestation would be an
 * automatically generated one wearing a human's name — the precise failure the
 * spec warns about.
 */
export const DRAFT_MARKER = "— Replace this with";

export function validateStatement(statement: string): AttestationValidation {
  const trimmed = statement.trim();

  if (trimmed.length < 30) {
    return {
      ok: false,
      error:
        "Write at least a sentence. Your name goes on this, and a one-word attestation vouches for nothing.",
    };
  }

  if (trimmed.includes(DRAFT_MARKER)) {
    return {
      ok: false,
      error:
        "The draft prompt is still in the text. The lines from the ledger are a starting point — an attestation is what you can personally vouch for.",
    };
  }

  if (trimmed.length > 2000) {
    return { ok: false, error: "Keep it under 2000 characters." };
  }

  return { ok: true };
}

export function validateRevocation(reason: string): AttestationValidation {
  if (reason.trim().length < 10) {
    return {
      ok: false,
      error:
        "A revocation needs a reason. The record is kept rather than deleted, so the reason is what makes it readable later.",
    };
  }
  return { ok: true };
}

/** How an attestation is described wherever it appears. */
export function attributionLine(input: {
  attesterName: string;
  designation: string | null;
  collegeName: string;
  issuedAt: Date;
  revokedAt: Date | null;
}): string {
  const who = input.designation
    ? `${input.attesterName}, ${input.designation}, ${input.collegeName}`
    : `${input.attesterName}, ${input.collegeName}`;

  const date = input.issuedAt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return input.revokedAt
    ? `Attested by ${who} on ${date} — revoked ${input.revokedAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
    : `Attested by ${who} on ${date}`;
}
