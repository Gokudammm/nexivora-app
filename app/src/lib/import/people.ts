import { z } from "zod";

import { looksLikeMangledNumber, type CsvRow } from "./csv";

/**
 * VALIDATING A PEOPLE IMPORT, AND THE DRY RUN.
 *
 * The dry run is the most important thing in Phase 5. A bulk import that
 * silently creates 500 wrong records is the fastest way to lose a college's
 * trust permanently, and without a restore it is unrecoverable.
 *
 * So this module is deliberately split from anything that writes: it takes rows
 * and existing records, and returns a **plan** — what would be created, what
 * would be updated, what would be skipped, and every per-row error. Nothing
 * here touches the database. The commit step consumes the plan.
 *
 * That separation is also what makes it testable against a genuinely ugly file
 * rather than one we generated to pass.
 */

export const IMPORT_FIELDS = [
  {
    key: "name",
    label: "Full name",
    required: true,
    aliases: ["fullname", "studentname", "student"],
  },
  { key: "email", label: "Email", required: true, aliases: ["emailaddress", "mail", "emailid"] },
  {
    key: "rollNumber",
    label: "Roll number",
    required: false,
    aliases: ["rollno", "roll", "rollnumber", "registrationnumber", "regno", "enrollmentno", "usn"],
  },
  { key: "department", label: "Department", required: false, aliases: ["dept", "branch"] },
  {
    key: "programme",
    label: "Programme",
    required: false,
    aliases: ["program", "course", "degree"],
  },
  {
    key: "year",
    label: "Year",
    required: false,
    aliases: ["yearofstudy", "studyyear", "sem", "semester"],
  },
  { key: "role", label: "Role", required: false, aliases: ["type", "usertype", "memberrole"] },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];

export type ImportOutcome = "create" | "update" | "skip" | "error";

export type PlannedRow = {
  /** 1-based line in the source file, counting the header. */
  line: number;
  outcome: ImportOutcome;
  name: string;
  email: string;
  rollNumber: string | null;
  department: string | null;
  programme: string | null;
  year: number | null;
  role: string;
  /** Set when the row matches an existing member. */
  existingUserId?: string;
  /** What would change on an update. */
  changes?: Record<string, { from: unknown; to: unknown }>;
  errors: string[];
  warnings: string[];
};

export type ImportPlan = {
  rows: PlannedRow[];
  counts: Record<ImportOutcome, number>;
  /** True when nothing would be written — the commit button stays disabled. */
  empty: boolean;
  /** File-level problems that are not attributable to one row. */
  fileErrors: string[];
  fileWarnings: string[];
};

export type ExistingMember = {
  userId: string;
  email: string;
  name: string;
  rollNumber: string | null;
  role: string;
  state: string;
};

const ROLE_ALIASES: Record<string, string> = {
  student: "STUDENT",
  students: "STUDENT",
  faculty: "FACULTY",
  teacher: "FACULTY",
  professor: "FACULTY",
  staff: "FACULTY",
  alumni: "ALUMNI",
  alumnus: "ALUMNI",
  admin: "COLLEGE_ADMIN",
  administrator: "COLLEGE_ADMIN",
  collegeadmin: "COLLEGE_ADMIN",
  researcher: "RESEARCHER",
};

const emailSchema = z.string().email();

/**
 * Build the plan.
 *
 * `existing` is everyone already in the college, keyed however the caller likes
 * — this function does the matching, because duplicate detection is part of the
 * decision and not a detail of the query.
 */
export function planImport(
  rows: CsvRow[],
  mapping: Partial<Record<ImportFieldKey, string | null>>,
  existing: ExistingMember[],
  options: { defaultRole?: string } = {},
): ImportPlan {
  const fileErrors: string[] = [];
  const fileWarnings: string[] = [];

  for (const field of IMPORT_FIELDS) {
    if (field.required && !mapping[field.key]) {
      fileErrors.push(`No column is mapped to “${field.label}”, which is required.`);
    }
  }

  const byEmail = new Map(existing.map((member) => [member.email.toLowerCase(), member]));
  const byRoll = new Map(
    existing.filter((m) => m.rollNumber).map((m) => [m.rollNumber!.toLowerCase(), m]),
  );

  // Duplicates *within the file* are as common as duplicates against the
  // database — two sheets pasted together, or a batch appended twice.
  const seenEmails = new Map<string, number>();
  const seenRolls = new Map<string, number>();

  const planned: PlannedRow[] = rows.map((row, index) => {
    const line = index + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    const read = (key: ImportFieldKey): string => {
      const column = mapping[key];
      return column ? (row[column] ?? "") : "";
    };

    const name = read("name");
    const email = read("email").toLowerCase();
    const rollRaw = read("rollNumber");
    const department = read("department") || null;
    const programme = read("programme") || null;
    const yearRaw = read("year");
    const roleRaw = read("role");

    if (!name) errors.push("Name is empty.");
    if (!email) {
      errors.push("Email is empty.");
    } else if (!emailSchema.safeParse(email).success) {
      errors.push(`“${email}” is not a valid email address.`);
    }

    // Excel turns a long roll number into scientific notation and loses digits
    // doing it. Refusing is right: a silently truncated roll number is worse
    // than a failed import, because nobody notices it.
    if (rollRaw && looksLikeMangledNumber(rollRaw)) {
      errors.push(
        `Roll number “${rollRaw}” has been converted to scientific notation by a spreadsheet and may have lost digits. Format the column as text and export again.`,
      );
    }

    const rollNumber = rollRaw || null;

    let year: number | null = null;
    if (yearRaw) {
      const parsed = Number(yearRaw.replace(/[^0-9]/g, ""));
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 8) {
        warnings.push(`Year “${yearRaw}” was not understood and will be left blank.`);
      } else {
        year = parsed;
      }
    }

    let role = options.defaultRole ?? "STUDENT";
    if (roleRaw) {
      const mapped = ROLE_ALIASES[roleRaw.toLowerCase().replace(/[^a-z]/g, "")];
      if (mapped) {
        role = mapped;
      } else {
        warnings.push(`Role “${roleRaw}” was not recognised; importing as ${role}.`);
      }
    }

    // Duplicates inside the file.
    if (email) {
      const firstSeen = seenEmails.get(email);
      if (firstSeen) {
        errors.push(`This email also appears on line ${firstSeen} of this file.`);
      } else {
        seenEmails.set(email, line);
      }
    }

    if (rollNumber) {
      const key = rollNumber.toLowerCase();
      const firstSeen = seenRolls.get(key);
      if (firstSeen) {
        errors.push(`This roll number also appears on line ${firstSeen} of this file.`);
      } else {
        seenRolls.set(key, line);
      }
    }

    const base: PlannedRow = {
      line,
      outcome: "error",
      name,
      email,
      rollNumber,
      department,
      programme,
      year,
      role,
      errors,
      warnings,
    };

    if (errors.length > 0) return base;

    // Match against the college. Email is authoritative; a roll number that
    // belongs to a *different* email is a conflict worth stopping for, because
    // one of the two records is wrong and guessing which is not our call.
    const byEmailMatch = byEmail.get(email);
    const byRollMatch = rollNumber ? byRoll.get(rollNumber.toLowerCase()) : undefined;

    if (byRollMatch && byEmailMatch && byRollMatch.userId !== byEmailMatch.userId) {
      return {
        ...base,
        errors: [
          `Roll number ${rollNumber} already belongs to ${byRollMatch.email}, but this row gives ${email}. Resolve it before importing.`,
        ],
      };
    }

    if (byRollMatch && !byEmailMatch) {
      return {
        ...base,
        errors: [
          `Roll number ${rollNumber} already belongs to ${byRollMatch.email}. If this person's address has changed, update it first.`,
        ],
      };
    }

    if (!byEmailMatch) return { ...base, outcome: "create" };

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (name && name !== byEmailMatch.name) changes.name = { from: byEmailMatch.name, to: name };
    if (rollNumber && rollNumber !== byEmailMatch.rollNumber) {
      changes.rollNumber = { from: byEmailMatch.rollNumber, to: rollNumber };
    }
    if (role !== byEmailMatch.role) changes.role = { from: byEmailMatch.role, to: role };

    if (Object.keys(changes).length === 0) {
      return {
        ...base,
        outcome: "skip",
        existingUserId: byEmailMatch.userId,
        warnings: [...warnings, "Already a member, with nothing to change."],
      };
    }

    return { ...base, outcome: "update", existingUserId: byEmailMatch.userId, changes };
  });

  const counts: Record<ImportOutcome, number> = { create: 0, update: 0, skip: 0, error: 0 };
  for (const row of planned) counts[row.outcome] += 1;

  if (counts.error > 0) {
    fileWarnings.push(
      `${counts.error} ${counts.error === 1 ? "row has" : "rows have"} errors and will not be imported. Everything else can still proceed.`,
    );
  }

  return {
    rows: planned,
    counts,
    empty: counts.create + counts.update === 0,
    fileErrors,
    fileWarnings,
  };
}

/**
 * The error report an administrator downloads and sends back to whoever
 * produced the file. Line numbers match the original, which is the only thing
 * that makes it actionable.
 */
export function errorReportCsv(plan: ImportPlan): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const lines = ["Line,Name,Email,Outcome,Problem"];

  for (const row of plan.rows) {
    const problems = [...row.errors, ...row.warnings];
    if (problems.length === 0) continue;

    for (const problem of problems) {
      lines.push(
        [row.line, escape(row.name), escape(row.email), row.outcome, escape(problem)].join(","),
      );
    }
  }

  return lines.join("\n");
}

/** The template we hand out, so at least some files arrive already correct. */
export function importTemplateCsv(): string {
  return [
    IMPORT_FIELDS.map((field) => field.label).join(","),
    "Ananya Sharma,ananya.sharma@nit.edu.in,NIT22014,Computer Science & Engineering,B.Tech Computer Science & Engineering,3,Student",
    "Rohit Verma,rohit.verma@nit.edu.in,NIT22037,Electronics & Communication,B.Tech Electronics & Communication,3,Student",
  ].join("\n");
}
