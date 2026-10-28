/**
 * CSV PARSING AND NORMALISATION.
 *
 * Written by hand rather than with a parser dependency, because the hard part
 * of this problem is not RFC 4180 — it is that **real CSVs are messy** and the
 * mess is specific:
 *
 *   · Excel writes a UTF-8 BOM, which turns the first header into `﻿Name`
 *     and makes column mapping fail on exactly one column, invisibly.
 *   · Excel also writes CRLF, and sometimes a lone CR from an old Mac export.
 *   · Copy-paste from a browser or Word brings non-breaking spaces (U+00A0) and
 *     smart quotes, so `"Roll No."` never equals `Roll No.`.
 *   · Indian rolls and phone numbers arrive as `="22001"` because someone
 *     fought Excel's number formatting, or as `2.2001E+04` because they lost.
 *   · There are always blank trailing rows. Usually several.
 *   · Headers vary: `Roll No.`, `RollNo`, `roll_number`, `Roll Number`.
 *
 * Every one of those is handled here and covered in `csv.test.ts` against a
 * deliberately ugly fixture. A parser that only handles clean files moves the
 * failure from this module into the import, where it becomes 500 wrong rows.
 */

export type CsvRow = Record<string, string>;

export type ParsedCsv = {
  headers: string[];
  /** Header as written, before normalisation — shown in the mapping UI. */
  rawHeaders: string[];
  rows: CsvRow[];
  /** Rows that were skipped because they were entirely empty. */
  blankRows: number;
  /** Rows whose column count did not match the header. */
  raggedRows: Array<{ line: number; got: number; expected: number }>;
};

/* ------------------------------------------------------------ normalising */

/**
 * Strip the things that make two identical-looking strings unequal.
 *
 * Non-breaking spaces and zero-width characters survive copy-paste and are
 * invisible in every editor, which is what makes them expensive: the value
 * looks right, matches nothing, and nobody can see why.
 */
export function cleanCell(value: string): string {
  return value
    .replace(/^﻿/, "")
    .replace(/[   ]/g, " ")
    .replace(/[​-‍⁠]/g, "")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .trim();
}

/**
 * A header reduced to something two spellings can agree on.
 * `Roll No.`, `RollNo`, `roll_number` and `Roll Number` all become `rollno` /
 * `rollnumber`, which is what makes automatic mapping possible at all.
 */
export function normaliseHeader(header: string): string {
  return cleanCell(header)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Undo the two things Excel does to identifiers.
 *
 * `="22001"` is what someone types to stop Excel eating a leading zero;
 * `2.2001E+04` is what Excel produces when they do not. The second is
 * genuinely lossy — a roll number that has been through it may have lost
 * digits — so it is surfaced as a warning rather than silently converted.
 */
export function looksLikeMangledNumber(value: string): boolean {
  return /^-?\d(\.\d+)?[eE][+-]?\d+$/.test(value.trim());
}

function unwrapExcelFormula(value: string): string {
  const match = /^="(.*)"$/.exec(value.trim());
  return match?.[1] ?? value;
}

/* ---------------------------------------------------------------- parsing */

/**
 * RFC 4180 with the real-world tolerances: BOM, CRLF, lone CR, quoted fields
 * containing commas and newlines, and doubled quotes as an escape.
 */
export function parseCsv(input: string, delimiter = ","): ParsedCsv {
  const text = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");

  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  /** True until the first character of the current field is consumed. */
  let atFieldStart = true;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    // A quote only delimits when it *opens* a field. Mid-field it is data —
    // which is what makes Excel's `="0022071"` wrapper survive intact, to be
    // unwrapped below with its leading zero. Treating every quote as a
    // delimiter silently turned that into `=0022071`.
    if (char === '"' && atFieldStart) {
      inQuotes = true;
      atFieldStart = false;
      continue;
    }

    atFieldStart = false;

    if (char === delimiter) {
      atFieldStart = true;
      record.push(field);
      field = "";
    } else if (char === "\n") {
      atFieldStart = true;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }

  // The last record, when the file does not end with a newline.
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const headerRecord = records.shift() ?? [];
  const rawHeaders = headerRecord.map((header) => cleanCell(header));
  const headers = rawHeaders.map((header) => normaliseHeader(header));

  const rows: CsvRow[] = [];
  const raggedRows: ParsedCsv["raggedRows"] = [];
  let blankRows = 0;

  records.forEach((values, index) => {
    const cleaned = values.map((value) => cleanCell(unwrapExcelFormula(value)));

    // There are always blank trailing rows. Usually several.
    if (cleaned.every((value) => value === "")) {
      blankRows += 1;
      return;
    }

    if (cleaned.length !== headers.length) {
      raggedRows.push({ line: index + 2, got: cleaned.length, expected: headers.length });
    }

    const row: CsvRow = {};
    headers.forEach((header, column) => {
      if (!header) return;
      row[header] = cleaned[column] ?? "";
    });

    rows.push(row);
  });

  return { headers, rawHeaders, rows, blankRows, raggedRows };
}

/**
 * Guess which CSV column feeds which field.
 *
 * A guess, not a decision — the mapping UI shows what was guessed and lets it
 * be corrected, because no alias list survives contact with a real registrar's
 * spreadsheet. Getting this right most of the time turns a tedious screen into
 * a confirmation.
 */
export function autoMap(
  headers: readonly string[],
  fields: readonly { key: string; aliases: readonly string[] }[],
): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  const taken = new Set<string>();

  for (const field of fields) {
    const candidates = [field.key, ...field.aliases].map(normaliseHeader);

    const exact = headers.find((header) => candidates.includes(header) && !taken.has(header));
    if (exact) {
      mapping[field.key] = exact;
      taken.add(exact);
      continue;
    }

    // Fall back to a containment match: `studentemailaddress` for `email`.
    const partial = headers.find(
      (header) =>
        !taken.has(header) &&
        candidates.some((candidate) => candidate.length >= 4 && header.includes(candidate)),
    );

    mapping[field.key] = partial ?? null;
    if (partial) taken.add(partial);
  }

  return mapping;
}
