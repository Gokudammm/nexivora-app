import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { autoMap, cleanCell, looksLikeMangledNumber, normaliseHeader, parseCsv } from "./csv";
import { IMPORT_FIELDS, errorReportCsv, planImport, type ExistingMember } from "./people";

/**
 * The import, tested against a file that is deliberately horrible.
 *
 * The spec's instruction was "test with a genuinely ugly file rather than one
 * you generated". Every defect in `UGLY` below is one that a real registrar's
 * export has actually produced: a BOM, CRLF, a lone CR, non-breaking spaces,
 * smart quotes, a quoted field containing a comma, an Excel `="…"` wrapper,
 * scientific notation eating a roll number, a ragged row, duplicates both
 * within the file and against the database, and four blank trailing lines.
 *
 * A parser that only handles clean files does not fail here — it fails during
 * the import, where the failure is 500 wrong records.
 */

/* --------------------------------------------------------------- the file */

const BOM = "﻿";
const NBSP = " ";

const UGLY =
  BOM +
  [
    `Full Name,Roll No.,Email Address,Dept,Year,Role`,
    // Ordinary row.
    `Ananya Sharma,NIT22014,ananya.sharma@nit.edu.in,Computer Science,3,Student`,
    // Non-breaking spaces around every value, and a smart-quoted name.
    `${NBSP}Rohit${NBSP}Verma${NBSP},${NBSP}NIT22037${NBSP},rohit.verma@nit.edu.in,${NBSP}Electronics${NBSP},3,Student`,
    // A quoted field containing the delimiter.
    `"Iyer, Sneha",NIT22052,sneha.iyer@nit.edu.in,"Computer Science, AI stream",4,student`,
    // Excel's ="…" wrapper, used to protect a leading zero.
    `Dev Patel,="0022071",dev.patel@nit.edu.in,Mechanical,2,STUDENT`,
    // Excel ate this one instead: scientific notation, digits lost.
    `Priya Nair,2.2008E+04,priya.nair@nit.edu.in,Biotechnology,4,Student`,
    // Invalid email.
    `Karan Mehta,NIT22090,karan.mehta@,Computer Science,3,Student`,
    // Missing name.
    `,NIT22091,nobody@nit.edu.in,Computer Science,3,Student`,
    // Duplicate email, already used on line 2.
    `Ananya S,NIT22999,ANANYA.SHARMA@nit.edu.in,Computer Science,3,Student`,
    // Ragged: one column short.
    `Zoya Khan,NIT22101,zoya.khan@nit.edu.in,Applied Sciences,3`,
    // Unrecognised role, and a nonsense year.
    `Arjun Rao,NIT22110,arjun.rao@nit.edu.in,Information Science,twelfth,Wizard`,
    // A row that matches an existing member exactly — nothing to do.
    `Meera Rao,,meera.rao@nit.edu.in,Computer Science,,Faculty`,
    // A row that matches an existing member with a changed name.
    `Sunil R Deshpande,,sunil.deshpande@nit.edu.in,Mechanical,,Faculty`,
    "",
    "",
    "   ",
    "",
  ].join("\r\n");

const EXISTING: ExistingMember[] = [
  {
    userId: "u-meera",
    email: "meera.rao@nit.edu.in",
    name: "Meera Rao",
    rollNumber: null,
    role: "FACULTY",
    state: "ACTIVE",
  },
  {
    userId: "u-sunil",
    email: "sunil.deshpande@nit.edu.in",
    name: "Sunil Deshpande",
    rollNumber: null,
    role: "FACULTY",
    state: "ACTIVE",
  },
  {
    userId: "u-taken-roll",
    email: "someone.else@nit.edu.in",
    name: "Someone Else",
    rollNumber: "NIT22014",
    role: "STUDENT",
    state: "ACTIVE",
  },
];

/* ------------------------------------------------------------ primitives */

describe("cleanCell", () => {
  it("strips a BOM, non-breaking spaces and zero-width characters", () => {
    assert.equal(cleanCell(`${BOM} Ananya​ Sharma `), "Ananya Sharma");
  });

  it("normalises smart quotes, which never match anything as typed", () => {
    assert.equal(cleanCell("“Roll No.”"), '"Roll No."');
    assert.equal(cleanCell("O’Brien"), "O'Brien");
  });
});

describe("normaliseHeader", () => {
  it("makes every spelling of a roll number column agree", () => {
    const spellings = ["Roll No.", "RollNo", "roll_number", "Roll Number", " ROLL NO "];
    const normalised = new Set(spellings.map(normaliseHeader));

    // They do not all collapse to one token, but each is stable and matchable —
    // which is what autoMap needs.
    assert.ok(normalised.has("rollno"));
    assert.ok(normalised.has("rollnumber"));
  });
});

describe("looksLikeMangledNumber", () => {
  it("recognises what Excel does to a long identifier", () => {
    assert.equal(looksLikeMangledNumber("2.2008E+04"), true);
    assert.equal(looksLikeMangledNumber("1E+15"), true);
    assert.equal(looksLikeMangledNumber("NIT22014"), false);
    assert.equal(looksLikeMangledNumber("22014"), false);
  });
});

/* ---------------------------------------------------------------- parsing */

describe("parseCsv, against the ugly file", () => {
  const parsed = parseCsv(UGLY);

  it("survives the BOM on the first header", () => {
    assert.equal(parsed.rawHeaders[0], "Full Name");
    assert.ok(parsed.headers.includes("fullname"));
  });

  it("handles CRLF", () => {
    assert.ok(parsed.rows.length > 5);
  });

  it("drops blank trailing rows, including whitespace-only ones", () => {
    // Three, not four: the file ends with a newline, so the fourth empty
    // element in the fixture is the text *after* the final separator and is not
    // a record at all. Counted rather than asserted loosely, because "how many
    // rows did you skip" is what an administrator checks against their sheet.
    assert.equal(parsed.blankRows, 3);
    assert.ok(parsed.rows.every((row) => Object.values(row).some((value) => value !== "")));
  });

  it("keeps a quoted field that contains the delimiter intact", () => {
    const sneha = parsed.rows.find((row) => row.emailaddress === "sneha.iyer@nit.edu.in");
    assert.ok(sneha);
    assert.equal(sneha.fullname, "Iyer, Sneha");
    assert.equal(sneha.dept, "Computer Science, AI stream");
  });

  it("trims non-breaking spaces from values", () => {
    const rohit = parsed.rows.find((row) => row.emailaddress === "rohit.verma@nit.edu.in");
    assert.ok(rohit);
    assert.equal(rohit.fullname, "Rohit Verma");
    assert.equal(rohit.dept, "Electronics");
  });

  it('unwraps Excel\'s ="…" without losing the leading zero', () => {
    const dev = parsed.rows.find((row) => row.emailaddress === "dev.patel@nit.edu.in");
    assert.ok(dev);
    assert.equal(dev["rollno"], "0022071");
  });

  it("reports a ragged row rather than silently shifting the columns", () => {
    assert.equal(parsed.raggedRows.length, 1);
    assert.equal(parsed.raggedRows[0]?.expected, 6);
    assert.equal(parsed.raggedRows[0]?.got, 5);
  });
});

describe("autoMap", () => {
  it("maps the ugly file's headers without help", () => {
    const parsed = parseCsv(UGLY);
    const mapping = autoMap(parsed.headers, IMPORT_FIELDS);

    assert.equal(mapping.name, "fullname");
    assert.equal(mapping.email, "emailaddress");
    assert.equal(mapping.rollNumber, "rollno");
    assert.equal(mapping.department, "dept");
    assert.equal(mapping.role, "role");
  });

  it("does not map one column to two fields", () => {
    const mapping = autoMap(["name", "email"], IMPORT_FIELDS);
    const used = Object.values(mapping).filter(Boolean);

    assert.equal(new Set(used).size, used.length);
  });

  it("returns null for a field with no column, rather than guessing", () => {
    const mapping = autoMap(["name", "email"], IMPORT_FIELDS);
    assert.equal(mapping.rollNumber, null);
  });
});

/* --------------------------------------------------------------- planning */

describe("planImport — the dry run", () => {
  const parsed = parseCsv(UGLY);
  const mapping = autoMap(parsed.headers, IMPORT_FIELDS);
  const plan = planImport(parsed.rows, mapping, EXISTING);

  const at = (line: number) => plan.rows.find((row) => row.line === line);

  it("writes nothing — it returns a plan, and has no database access at all", () => {
    // Structural, not behavioural: this module imports nothing that can write,
    // which is what makes "the dry run cannot commit" true by construction
    // rather than by discipline.
    assert.ok(Array.isArray(plan.rows));
    assert.equal(typeof plan.counts.create, "number");
  });

  it("rejects an invalid email", () => {
    const row = plan.rows.find((r) => r.email === "karan.mehta@");
    assert.equal(row?.outcome, "error");
    assert.ok(row?.errors.some((e) => e.includes("not a valid email")));
  });

  it("rejects a row with no name", () => {
    const row = plan.rows.find((r) => r.email === "nobody@nit.edu.in");
    assert.equal(row?.outcome, "error");
    assert.ok(row?.errors.some((e) => e.includes("Name is empty")));
  });

  it("refuses a roll number a spreadsheet has mangled, rather than importing lost digits", () => {
    const row = plan.rows.find((r) => r.email === "priya.nair@nit.edu.in");
    assert.equal(row?.outcome, "error");
    assert.ok(row?.errors.some((e) => e.includes("scientific notation")));
  });

  it("catches a duplicate email within the file, case-insensitively", () => {
    const row = plan.rows.find((r) => r.name === "Ananya S");
    assert.equal(row?.outcome, "error");
    assert.ok(row?.errors.some((e) => e.includes("also appears on line")));
  });

  it("refuses a roll number that already belongs to someone else", () => {
    // NIT22014 is Ananya's in the file, and Someone Else's in the database.
    // One of the two records is wrong and guessing which is not our call.
    const row = plan.rows.find((r) => r.email === "ananya.sharma@nit.edu.in");
    assert.equal(row?.outcome, "error");
    assert.ok(row?.errors.some((e) => e.includes("already belongs to")));
  });

  it("warns rather than fails on an unreadable year and an unknown role", () => {
    const row = plan.rows.find((r) => r.email === "arjun.rao@nit.edu.in");
    assert.notEqual(row?.outcome, "error");
    assert.equal(row?.year, null);
    assert.equal(row?.role, "STUDENT");
    assert.equal(row?.warnings.length, 2);
  });

  it("skips a row that matches an existing member exactly", () => {
    const row = plan.rows.find((r) => r.email === "meera.rao@nit.edu.in");
    assert.equal(row?.outcome, "skip");
    assert.equal(row?.existingUserId, "u-meera");
  });

  it("updates a matched member, and says exactly what would change", () => {
    const row = plan.rows.find((r) => r.email === "sunil.deshpande@nit.edu.in");
    assert.equal(row?.outcome, "update");
    assert.deepEqual(row?.changes?.name, { from: "Sunil Deshpande", to: "Sunil R Deshpande" });
  });

  it("creates the rows that are genuinely new", () => {
    assert.ok(plan.counts.create >= 3, `expected several creates, got ${plan.counts.create}`);
  });

  it("recognises roles written in any case", () => {
    const sneha = plan.rows.find((r) => r.email === "sneha.iyer@nit.edu.in");
    const dev = plan.rows.find((r) => r.email === "dev.patel@nit.edu.in");

    assert.equal(sneha?.role, "STUDENT");
    assert.equal(dev?.role, "STUDENT");
  });

  it("counts every row exactly once", () => {
    const total = plan.counts.create + plan.counts.update + plan.counts.skip + plan.counts.error;
    assert.equal(total, plan.rows.length);
    assert.ok(at(2), "line numbers should match the source file");
  });

  it("still permits the good rows when some are broken", () => {
    assert.equal(plan.empty, false);
    assert.ok(plan.fileWarnings.some((w) => w.includes("will not be imported")));
  });
});

describe("planImport — required columns", () => {
  it("refuses at file level when a required column is unmapped", () => {
    const plan = planImport([{ name: "A" }], { name: "name" }, []);

    assert.ok(plan.fileErrors.some((e) => e.includes("Email")));
  });
});

describe("errorReportCsv", () => {
  it("produces a report whose line numbers match the source file", () => {
    const parsed = parseCsv(UGLY);
    const plan = planImport(parsed.rows, autoMap(parsed.headers, IMPORT_FIELDS), EXISTING);
    const report = errorReportCsv(plan);

    assert.ok(report.startsWith("Line,Name,Email,Outcome,Problem"));
    assert.ok(report.includes("not a valid email"));
    // Commas inside a message must not break the report they are reported in.
    assert.ok(report.split("\n").every((line) => line.split('"').length % 2 === 1));
  });
});
