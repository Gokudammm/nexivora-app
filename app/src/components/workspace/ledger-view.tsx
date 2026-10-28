"use client";

import { useState } from "react";

import { Avatar, Badge } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import { Table, type Column } from "@/components/ui/table";
import { LEDGER_LABEL, type MemberScore, type TimelinePoint } from "@/lib/ledger/score";
import { LEDGER_WEIGHTS, type LedgerEventKind } from "@/config/ledger";
import type { ReviewAggregate, ReviewDetail } from "@/lib/db/queries/workspace";

import { PeerReviewPanel } from "./peer-review-panel";

/**
 * THE LEDGER, RENDERED.
 *
 * Three views of one dataset, and the choice of chart form for each is the
 * interesting part.
 *
 * **Share → horizontal bars, one hue.** Share is magnitude against a common
 * baseline with a name on every row, so it is a bar chart, and a bar chart of
 * one measure needs exactly one colour. Giving each member their own hue here
 * would be colour used decoratively, which is the most common way a chart stops
 * being readable.
 *
 * **Timeline → small multiples, not a multi-line chart.** This is the decision
 * worth recording. A six-line chart needs six hues that separate from *each
 * other* under colour-vision deficiency, and inside the dark theme's lightness
 * band that is not achievable — we searched the space and the best six-slot set
 * reaches ΔE 6.3 on all pairs against a target of 8. Rather than ship a chart
 * that is unreadable to roughly one male reader in twelve, each member gets
 * their own row with their **name beside it**. Colour then reinforces identity
 * instead of carrying it, which is the safe use, and "who was carrying this,
 * and from when" is actually easier to read stacked than overlaid.
 *
 * **Breakdown → a table.** Nine event kinds by N members is a lookup, not a
 * shape. `Table` has the mobile card fallback this is the first real use of.
 */

type Reviews = {
  aggregate: ReviewAggregate | null;
  mine: ReviewDetail[];
  detail: ReviewDetail[];
};

const SERIES = [
  "var(--color-series-1)",
  "var(--color-series-2)",
  "var(--color-series-3)",
  "var(--color-series-4)",
  "var(--color-series-5)",
  "var(--color-series-6)",
];

const percent = (value: number) => `${Math.round(value * 100)}%`;

export function LedgerView({
  groupId,
  scores,
  timeline,
  summary,
  faculty,
  reviews,
  owed,
  milestone,
}: {
  groupId: string;
  scores: MemberScore[];
  timeline: TimelinePoint[];
  summary: string | null;
  faculty: boolean;
  reviews: Reviews;
  owed: { id: string; name: string; username: string | null; avatarUrl: string | null }[];
  milestone: { id: string; title: string; dueDate: Date | null; state: string } | null;
}) {
  const [tab, setTab] = useState<"share" | "breakdown" | "review">("share");
  const total = scores.reduce((sum, score) => sum + score.points, 0);

  if (total === 0) {
    return (
      <Alert tone="info" title="Nothing recorded yet">
        The ledger fills itself from what the group does — closing a task, adding a file, starting a
        discussion, attending a meeting. Nothing has happened in this workspace yet, so there is
        nothing to show.
      </Alert>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border p-0.5">
        {(
          [
            ["share", "Contribution"],
            ["breakdown", "Breakdown"],
            ["review", "Peer review"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
            className={
              tab === value
                ? "focus-visible:outline-primary rounded-md bg-surface-sunken px-3 py-1.5 text-sm font-medium focus-visible:outline-2"
                : "focus-visible:outline-primary rounded-md px-3 py-1.5 text-sm font-medium text-fg-muted hover:text-fg focus-visible:outline-2"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "share" ? (
        <ShareView
          groupId={groupId}
          scores={scores}
          timeline={timeline}
          summary={summary}
          total={total}
        />
      ) : null}

      {tab === "breakdown" ? <BreakdownTable scores={scores} /> : null}

      {tab === "review" ? (
        <PeerReviewPanel
          groupId={groupId}
          faculty={faculty}
          reviews={reviews}
          owed={owed}
          milestone={milestone}
          members={scores.map((score) => score.member)}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ share */

function ShareView({
  groupId,
  scores,
  timeline,
  summary,
  total,
}: {
  groupId: string;
  scores: MemberScore[];
  timeline: TimelinePoint[];
  summary: string | null;
  total: number;
}) {
  return (
    <div className="grid gap-6">
      {summary ? (
        <p className="rounded-lg border border-border bg-surface-sunken/50 px-4 py-3 text-sm">
          {summary}
        </p>
      ) : null}

      <section className="grid gap-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-medium">Share of recorded activity</h2>
          <p className="text-sm text-fg-subtle">{total} points in total</p>
        </div>

        <ul className="grid gap-3">
          {scores.map((score, index) => (
            <li key={score.member.id} className="grid gap-1.5">
              <div className="flex items-center gap-2.5">
                <Avatar
                  name={score.member.name}
                  src={score.member.avatarUrl}
                  seed={score.member.id}
                  size="xs"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {score.member.name}
                </span>
                {score.points === 0 ? <Badge tone="warning">nothing recorded</Badge> : null}
                {/* The value is direct-labelled rather than left to a tooltip:
                    a number people may dispute should be legible without hover,
                    and hover does not exist on a phone. */}
                <span className="shrink-0 text-sm text-fg-muted tabular-nums">
                  {percent(score.share)}
                  <span className="ml-2 text-xs text-fg-subtle">{score.points} pts</span>
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(score.share * 100, score.points > 0 ? 1.5 : 0)}%`,
                    background: SERIES[index % SERIES.length],
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {timeline.length > 1 ? (
        <section className="grid gap-4">
          <div className="grid gap-1">
            <h2 className="font-medium">Contribution over the project</h2>
            <p className="text-sm text-fg-muted">
              Cumulative, one row per person. All rows share a scale, so a taller curve really is
              more.
            </p>
          </div>

          <ul className="grid gap-3">
            {scores.map((score, index) => (
              <li key={score.member.id} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-xs text-fg-muted sm:w-36">
                  {score.member.name}
                </span>
                <Sparkline
                  points={timeline.map((point) => point.byMember[score.member.id] ?? 0)}
                  max={Math.max(
                    ...scores.map((row) =>
                      Math.max(...timeline.map((point) => point.byMember[row.member.id] ?? 0)),
                    ),
                    1,
                  )}
                  color={SERIES[index % SERIES.length]!}
                  label={`${score.member.name}: ${score.points} points over ${timeline.length} active days`}
                />
                <span className="w-10 shrink-0 text-right text-xs text-fg-subtle tabular-nums">
                  {score.points}
                </span>
              </li>
            ))}
          </ul>

          <p className="text-xs text-fg-subtle">
            {timeline[0]!.date} to {timeline[timeline.length - 1]!.date} ·{" "}
            <a
              href={`/groups/${groupId}/activity`}
              className="underline underline-offset-4 hover:text-fg"
            >
              every event, with its evidence
            </a>
          </p>
        </section>
      ) : null}
    </div>
  );
}

/**
 * One member's cumulative curve.
 *
 * An SVG with no library. A sparkline is a polyline and an area fill; a charting
 * dependency for this would be more bytes than the rest of the page.
 *
 * `preserveAspectRatio="none"` lets one viewBox stretch to whatever width the
 * row gets, which keeps every row on the same horizontal scale without measuring
 * anything. The **aspect ratio is capped** because of what that stretching does
 * otherwise: at 24px tall and ~930px wide, a curve rising through its entire
 * range still reads as a flat line. It was technically correct and told the
 * reader nothing — caught by looking at a screenshot, which no amount of
 * type-checking would have done.
 */
function Sparkline({
  points,
  max,
  color,
  label,
}: {
  points: number[];
  max: number;
  color: string;
  label: string;
}) {
  const width = 100;
  const height = 40;

  const coords = points.map((value, index) => {
    const x = points.length === 1 ? width : (index / (points.length - 1)) * width;
    const y = height - (value / max) * (height - 2) - 1;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className="h-10 w-full max-w-sm min-w-0 shrink overflow-visible"
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* -------------------------------------------------------------- breakdown */

type BreakdownRow = {
  member: MemberScore["member"];
  points: number;
} & Record<LedgerEventKind, number>;

function BreakdownTable({ scores }: { scores: MemberScore[] }) {
  const kinds = Object.keys(LEDGER_WEIGHTS) as LedgerEventKind[];

  // Only kinds anybody has actually done. Nine mostly-zero columns is a table
  // nobody reads, and the zeroes carry no information the totals do not.
  const used = kinds.filter((kind) => scores.some((score) => score.byKind[kind].count > 0));

  const rows: BreakdownRow[] = scores.map((score) => ({
    member: score.member,
    points: score.points,
    ...(Object.fromEntries(kinds.map((kind) => [kind, score.byKind[kind].count])) as Record<
      LedgerEventKind,
      number
    >),
  }));

  const columns: Column<BreakdownRow>[] = [
    {
      key: "member",
      header: "Member",
      cell: (row) => (
        <span className="flex items-center gap-2">
          <Avatar
            name={row.member.name}
            src={row.member.avatarUrl}
            seed={row.member.id}
            size="xs"
          />
          {row.member.name}
        </span>
      ),
      sortValue: (row) => row.member.name,
    },
    ...used.map((kind): Column<BreakdownRow> => ({
      key: kind,
      header: LEDGER_LABEL[kind],
      align: "right",
      cell: (row) => <span className="tabular-nums">{row[kind]}</span>,
      sortValue: (row) => row[kind],
    })),
    {
      key: "points",
      header: "Points",
      align: "right",
      cell: (row) => <span className="font-medium tabular-nums">{row.points}</span>,
      sortValue: (row) => row.points,
    },
  ];

  return (
    <div className="grid gap-4">
      <Table
        columns={columns}
        rows={rows}
        rowKey={(row) => row.member.id}
        caption="Contribution by member and event type"
      />

      <details className="rounded-lg border border-border p-4 text-sm">
        <summary className="cursor-pointer font-medium">How points are counted</summary>
        <ul className="mt-3 grid gap-1 text-fg-muted">
          {(Object.keys(LEDGER_WEIGHTS) as LedgerEventKind[]).map((kind) => (
            <li key={kind} className="flex justify-between gap-4">
              <span>{LEDGER_LABEL[kind]}</span>
              <span className="tabular-nums">{LEDGER_WEIGHTS[kind]} points each</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-fg-subtle">
          The scale is deliberately flat. A ledger that rewards one action ten times more than
          another becomes a game, and a gamed ledger is worse than none — it produces a number that
          looks objective and is not. An event keeps the weight that applied when it happened, so
          tuning these does not rewrite the past.
        </p>
      </details>
    </div>
  );
}
