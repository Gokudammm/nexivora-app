"use client";

import { useMemo, useState } from "react";

import { ChevronDownIcon, ChevronUpIcon, SortIcon } from "@/components/icons";
import { cn } from "@/lib/utils/cn";

/**
 * Table — sortable, sticky-headed, with a **card fallback below `md`**.
 *
 * The card fallback is not a nicety. A wide data table on a phone either
 * overflows the page (breaking the "no horizontal body scroll" rule) or shrinks
 * text below legibility. Below `md` each row becomes a definition list instead,
 * which reads properly and keeps the label/value association for screen readers.
 *
 * Sorting is client-side and intended for the modest tables this product shows
 * (a group's ledger, a class roster). Server-side sorting arrives with the
 * paginated tables in Phase 7 and after; the column API is the same.
 */

export type Column<T> = {
  key: string;
  header: string;
  /** Cell content. Kept as a render function so a cell can be rich. */
  cell: (row: T) => React.ReactNode;
  /** Sort key. Omit to make the column unsortable. */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  /** Hidden in the mobile card view — for purely decorative columns. */
  hideOnMobile?: boolean;
  className?: string;
};

type SortState = { key: string; direction: "asc" | "desc" } | null;

export function Table<T>({
  columns,
  rows,
  caption,
  rowKey,
  empty,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  /** Describes the table for screen readers. Required — tables need context. */
  caption: string;
  rowKey: (row: T, index: number) => string;
  /** Rendered instead of the table when there are no rows. */
  empty?: React.ReactNode;
  className?: string;
}) {
  const [sort, setSort] = useState<SortState>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return rows;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * factor;
    });
  }, [rows, sort, columns]);

  function toggleSort(key: string) {
    setSort((current) => {
      if (current?.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <>
      {/* Desktop: a real table, scrolling inside its own container so the page
          body never scrolls horizontally. */}
      <div
        className={cn("hidden overflow-x-auto rounded-lg border border-border md:block", className)}
      >
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-[1] border-b border-border bg-surface-raised">
            <tr>
              {columns.map((column) => {
                const active = sort?.key === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined
                    }
                    className={cn(
                      "px-4 py-3 text-left font-semibold text-fg-muted",
                      column.align === "right" && "text-right",
                      column.className,
                    )}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-sm transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none",
                          column.align === "right" && "flex-row-reverse",
                        )}
                      >
                        {column.header}
                        {active ? (
                          sort.direction === "asc" ? (
                            <ChevronUpIcon size={14} />
                          ) : (
                            <ChevronDownIcon size={14} />
                          )
                        ) : (
                          <SortIcon size={14} className="opacity-40" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((row, index) => (
              <tr key={rowKey(row, index)} className="transition-colors hover:bg-surface-raised">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn("px-4 py-3", column.align === "right" && "text-right")}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per row, as a definition list so each value keeps its
          label association. */}
      <div className={cn("grid gap-3 md:hidden", className)}>
        <p className="sr-only">{caption}</p>
        {sorted.map((row, index) => (
          <dl
            key={rowKey(row, index)}
            className="grid gap-2 rounded-lg border border-border p-4 text-sm"
          >
            {columns
              .filter((column) => !column.hideOnMobile)
              .map((column) => (
                <div key={column.key} className="flex items-start justify-between gap-4">
                  <dt className="shrink-0 text-fg-subtle">{column.header}</dt>
                  <dd className="text-right font-medium">{column.cell(row)}</dd>
                </div>
              ))}
          </dl>
        ))}
      </div>
    </>
  );
}
