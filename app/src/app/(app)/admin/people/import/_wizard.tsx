"use client";

import { useActionState, useMemo, useState } from "react";

import { Badge } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/input";
import { commitImport } from "@/lib/admin/actions";
import { autoMap, parseCsv } from "@/lib/import/csv";
import {
  IMPORT_FIELDS,
  errorReportCsv,
  planImport,
  type ExistingMember,
} from "@/lib/import/people";

/**
 * THE IMPORT WIZARD.
 *
 * Read the file, map the columns, **see exactly what will happen**, then commit.
 * The third step is the one that matters: a bulk import that silently creates
 * 500 wrong records is the fastest way to lose a college's trust permanently,
 * and without a database restore it is unrecoverable.
 *
 * The preview is computed in the browser so it is instant and costs nothing —
 * but the commit **recomputes the plan on the server** from the same file. A
 * preview the client could edit before committing would be theatre.
 */

type WizardProps = {
  collegeId: string;
  existing: ExistingMember[];
  classes: Array<{ id: string; label: string }>;
  templateCsv: string;
};

export function ImportWizard({ collegeId, existing, classes, templateCsv }: WizardProps) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [classId, setClassId] = useState("");
  const [state, formAction, pending] = useActionState(commitImport, null);

  const parsed = useMemo(() => (csv ? parseCsv(csv) : null), [csv]);

  const plan = useMemo(() => {
    if (!parsed) return null;
    return planImport(parsed.rows, mapping, existing);
  }, [parsed, mapping, existing]);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const next = parseCsv(text);

    setCsv(text);
    setFileName(file.name);
    // Guessed, not decided — every column stays changeable below.
    setMapping(autoMap(next.headers, IMPORT_FIELDS));
  }

  if (state?.ok) {
    return (
      <div className="grid gap-4">
        <Alert tone="success" title="Imported">
          {state.message}
        </Alert>
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setCsv("");
              setFileName(null);
            }}
          >
            Import another file
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      {/* ---------------------------------------------------------- step 1 */}
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">1. Choose a file</h2>
        <p className="text-sm text-fg-muted">
          A CSV exported from anywhere. Spreadsheet quirks — a byte-order mark, non-breaking spaces,
          smart quotes, <code>=&quot;00221&quot;</code> wrappers — are handled.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            className="file:bg-bg-subtle text-sm file:mr-3 file:rounded-md file:border file:border-border file:px-3 file:py-2 file:text-sm file:font-medium"
          />
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv)}`}
            download="nexivora-people-template.csv"
            className="text-sm underline underline-offset-4"
          >
            Download the template
          </a>
        </div>

        {parsed ? (
          <p className="text-sm text-fg-muted">
            <strong className="text-fg">{fileName}</strong> — {parsed.rows.length} rows
            {parsed.blankRows > 0 ? `, ${parsed.blankRows} blank rows skipped` : ""}
            {parsed.raggedRows.length > 0
              ? `, ${parsed.raggedRows.length} row(s) with the wrong number of columns`
              : ""}
          </p>
        ) : null}
      </section>

      {/* ---------------------------------------------------------- step 2 */}
      {parsed ? (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">2. Match the columns</h2>
          <p className="text-sm text-fg-muted">
            Guessed from the headers. Correct anything that is wrong — real spreadsheets never match
            a template exactly.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {IMPORT_FIELDS.map((field) => (
              <Field
                key={field.key}
                label={field.label}
                required={field.required}
                hint={field.required ? undefined : "Optional"}
              >
                <Select
                  value={mapping[field.key] ?? ""}
                  onChange={(event) =>
                    setMapping((current) => ({
                      ...current,
                      [field.key]: event.target.value || null,
                    }))
                  }
                >
                  <option value="">Not imported</option>
                  {parsed.headers.map((header, index) => (
                    <option key={header || index} value={header}>
                      {parsed.rawHeaders[index] || header}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>

          {classes.length > 0 ? (
            <Field
              label="Also enrol everyone in a class"
              hint="Optional. Useful when the file is one class's roster."
            >
              <Select value={classId} onChange={(event) => setClassId(event.target.value)}>
                <option value="">Do not enrol</option>
                {classes.map((klass) => (
                  <option key={klass.id} value={klass.id}>
                    {klass.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </section>
      ) : null}

      {/* ---------------------------------------------------------- step 3 */}
      {plan ? (
        <section className="grid gap-4">
          <h2 className="text-lg font-semibold">3. Check what will happen</h2>

          {plan.fileErrors.length > 0 ? (
            <Alert tone="danger" title="Not ready to import">
              <ul className="grid gap-1">
                {plan.fileErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          <ul className="flex flex-wrap gap-2">
            <Badge tone="accent">{plan.counts.create} to create</Badge>
            <Badge tone="outline">{plan.counts.update} to update</Badge>
            <Badge tone="outline">{plan.counts.skip} unchanged</Badge>
            <Badge tone={plan.counts.error > 0 ? "danger" : "outline"}>
              {plan.counts.error} with errors
            </Badge>
          </ul>

          {plan.counts.error > 0 ? (
            <Alert tone="warning" title={`${plan.counts.error} rows will be skipped`}>
              Everything else can still be imported.{" "}
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(errorReportCsv(plan))}`}
                download="import-errors.csv"
                className="font-medium underline underline-offset-4"
              >
                Download the error report
              </a>{" "}
              — the line numbers match your file.
            </Alert>
          ) : null}

          <div className="max-h-96 overflow-auto rounded-lg border border-border">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-bg sticky top-0">
                <tr className="border-b border-border text-left text-xs tracking-wide text-fg-subtle uppercase">
                  <th className="px-3 py-2 font-medium">Line</th>
                  <th className="px-3 py-2 font-medium">Outcome</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((row) => (
                  <tr key={row.line} className="border-b border-border/60 align-top">
                    <td className="px-3 py-2 font-mono text-xs text-fg-subtle">{row.line}</td>
                    <td className="px-3 py-2">
                      <Badge
                        tone={
                          row.outcome === "error"
                            ? "danger"
                            : row.outcome === "create"
                              ? "accent"
                              : "outline"
                        }
                      >
                        {row.outcome}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {row.name || <span className="text-fg-subtle">—</span>}
                    </td>
                    <td className="px-3 py-2 text-fg-muted">{row.email || "—"}</td>
                    <td className="px-3 py-2 text-xs text-fg-muted">
                      {[...row.errors, ...row.warnings].join(" ")}
                      {row.changes
                        ? Object.entries(row.changes)
                            .map(
                              ([key, change]) =>
                                `${key}: ${String(change.from)} → ${String(change.to)}`,
                            )
                            .join("; ")
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ------------------------------------------------------- step 4 */}
          <form action={formAction} className="grid gap-3">
            <input type="hidden" name="collegeId" value={collegeId} />
            <input type="hidden" name="csv" value={csv} />
            <input type="hidden" name="mapping" value={JSON.stringify(mapping)} />
            <input type="hidden" name="classId" value={classId} />

            {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}

            <div className="flex items-center gap-3">
              <Button
                type="submit"
                size="lg"
                disabled={pending || plan.empty || plan.fileErrors.length > 0}
              >
                {pending
                  ? "Importing…"
                  : `Import ${plan.counts.create + plan.counts.update} ${plan.counts.create + plan.counts.update === 1 ? "person" : "people"}`}
              </Button>
              <p className="text-sm text-fg-muted">
                Everything happens in one transaction. If any part fails, nothing is written.
              </p>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
