# Phase 15 — Analytics, Accreditation & Reports

| | |
| --- | --- |
| **Status** | ⬜ Not Started |
| **Depends on** | Phases 8, 9, 12, 14 |
| **Blocks** | Phase 19 |
| **Estimate** | 9 focused hours |
| **Started** | — |
| **Completed** | — |

## What Phase 5 already provides

*Added 2026-09-09, when Phase 5 completed.*

- **`Term` is a real model and exactly one is active at a time**, enforced in a transaction. Every
  roll-up you write can depend on that.
- **The audit log is append-only and already populated** by every administrative mutation, with the
  actor, the diff and a reason where one was required.
- **CSV generation belongs here.** Phase 5 deliberately left the audit-log export out rather than
  writing a second CSV writer — `errorReportCsv()` in `lib/import/people.ts` shows the escaping
  the export will need.

## What Phase 8 already provides

*Added 2026-09-10, when Phase 8 completed.*

- **The accreditation export's source data is now real.** Projects, sections, SDG alignment,
  milestones, status history and submissions are all database rows created through the interface.
- **`ProjectStatusEvent` is a complete audit trail** — actor, timestamp and reason for every
  transition, written in the same transaction as the change.
- **Progress and risk are computed** (`lib/project/progress.ts`), so a report never has to trust a
  stored percentage.
- **The submission receipt has a digest but is not a downloadable file.** `lib/pdf/` is this
  phase's; the receipt is the obvious first thing to render through it.

## What Phase 9 already provides

*Added 2026-09-11, when Phase 9 completed.*

- **`groupHealth()` in `lib/ledger/health.ts` is the one place a signal is decided**, and it is
  pure. Analytics should aggregate its output rather than re-deriving "at risk" from the ledger — a
  second definition is a second number for the same question, and the dashboard and the report will
  eventually disagree in front of a head of department.
- **`HealthInput.active` matters more than it looks** (ADR-046). A signal that fires on the
  *absence* of activity needs to know whether activity was still expected; `COMPLETED` and
  `ARCHIVED` groups are not stalled. Any time-window metric Phase 15 adds — "active this week",
  streaks, response times — needs the same distinction or it will report a delivered cohort as a
  failing one.
- **Thresholds are configuration, per college** (`config/health.ts`, with an override map that is
  empty today). Any chart with a threshold line must read it from there, not hard-code 14 days.
- **`config/ledger.ts` holds the weights and `LedgerEvent.weight` is denormalised at write time**,
  so retuning the weights never retroactively changes what past work was worth. A trend chart over
  the ledger is therefore honest by construction — and must not re-weight historic rows to "fix" a
  discontinuity, because the discontinuity is the truth.
- **`lib/db/queries/faculty.ts` shows the batching shape.** `listSupervisedGroups` loads the ledger
  once for every supervised group and then runs pure functions over it. Fifteen groups cost one
  round trip. Analytics over a whole college should follow the same shape rather than one query per
  group.
- **`facultyDashboard()` already computes most of the per-class aggregates** — counts, at-risk
  ranking, queue depth, unanswered questions. Phase 15's class report should extend it, not fork it.
- **Average progress is computed, never stored** (`computeProgress`, ADR-041: a project's tasks
  count only via its own milestones). Any stored aggregate Phase 15 introduces needs a stated
  refresh policy, because everything upstream of it is derived on read.
- **The demo world's in-flight activity is rebased on every seed** (ADR-047, `activityAnchor()` in
  `prisma/seed/workspace.ts`). Time-series charts will look plausible in the demo because of that
  and not by accident — use the same anchor rather than inventing a second one.

## Objective

Turn the data the platform has been accumulating into the thing an institution will actually pay
for. **The accreditation export is the business model** (`docs/BUSINESS-MODEL.md` §3) — it replaces
weeks of manual faculty work with a button, using data the platform generated as a by-product of
ordinary use.

## In scope

- Dashboards for every role
- The metric layer, defined exactly once
- Department and college analytics
- The SDG impact report
- **NAAC / NBA / NIRF / AICTE accreditation exports**
- CSV and PDF export throughout
- The platform admin view

## Out of scope

- Predictive analytics (Phase 18, and only with a deterministic baseline)

## Deliverables

### The metric layer — build this first
- [ ] `lib/analytics/queries.ts` — **every metric defined exactly once** and imported everywhere.
      Two dashboards disagreeing about "active projects" is the failure mode this prevents, and it
      is fatal in a report an institution submits to a regulator.
- [ ] Metrics: projects by status, completion rate, average duration, on-time submission rate,
      group health distribution, contribution distribution, faculty review turnaround, engagement
      rate, skill coverage, SDG coverage, publication rate, build-on rate, cross-college
      collaboration count, mentorship count, opportunity conversion
- [ ] Every metric documented with its exact definition and the term or date range it uses
- [ ] Aggregates materialised nightly where a live query would be slow; the freshness timestamp is
      shown so nobody misreads stale data as live

### Student dashboard
- [ ] Progress across projects, upcoming deadlines, my contribution over time, skills gained with
      evidence, engagement received, attestations earned
- [ ] Frame it as **growth**, not as a scoreboard. A student ranked against classmates is a
      demotivation engine, and it is not what this data is for.

### Faculty analytics
- [ ] Class overview: group progress distribution, at-risk count, submission and review status
- [ ] Contribution distribution across every group, so imbalance is visible at a glance
- [ ] Review turnaround, feedback volume, attestations issued
- [ ] Subject-level trends across terms
- [ ] Recharts, dynamically imported, SVG output

### Department & college dashboards — `/admin/analytics`
- [ ] Institution: total projects, completion rate, active groups, engagement, publication rate
- [ ] Department comparison — presented as **capability, not competition**
- [ ] Faculty engagement (participation, not a performance ranking — this distinction matters and
      getting it wrong will make faculty hostile to the whole product)
- [ ] Domain distribution and how it shifts over terms
- [ ] SDG coverage and gaps
- [ ] Archive growth and build-on rate — the institutional-memory metric
- [ ] Industry and alumni engagement
- [ ] Every chart filterable by term, department and programme, and every chart exportable

### Accreditation export — `/admin/reports/accreditation`
The commercial centrepiece.
- [ ] **NAAC** — evidence mapped to the relevant criteria: student projects and research
      (Criterion III), extension and community activity, innovation and incubation, student
      participation. Output: a formatted PDF plus a CSV annexure.
- [ ] **NBA** — project-based learning evidence, programme outcome and course outcome attainment
      support, industry interaction, student performance distribution.
- [ ] **NIRF** — the data points NIRF actually asks for: publications, projects, industry
      collaboration, student outcomes.
- [ ] **AICTE** — activity summaries, industry engagement, student development.
- [ ] Each: choose the academic year and scope → preview → export
- [ ] **Every figure traces to a named query, and the report says which.** An institution submitting
      an unverifiable number to a regulator is a serious problem, so provenance is a feature, not a
      nicety.
- [ ] Evidence annexures: project lists with citation IDs, faculty attestations, event records,
      collaboration records — everything an assessor might ask to see
- [ ] The report is watermarked as generated by Nexivora with a timestamp and a verification link

### SDG & impact
- [ ] `/admin/reports/sdg` — projects per goal, trend, department contribution, featured work
- [ ] Public version at `/sdg` — network-wide impact
- [ ] Export as PDF for institutional and sustainability reporting

### Platform admin
- [ ] `/platform/analytics` — colleges, users, growth, activity, verification queue depth,
      moderation queue depth, error rates, performance
- [ ] Per-college health: are they actually using it, and which features

### Export infrastructure
- [ ] `lib/export/{csv,pdf}.ts` — one implementation, used by every report
- [ ] Every table and chart in the product has an export action
- [ ] Large exports generate in the background with a notification when ready
- [ ] Exports are authorisation-checked at generation **and** at download

## Acceptance criteria

1. **A college admin produces a NAAC-ready evidence pack for one academic year, and every number in
   it traces to a named query.** This is the phase's headline acceptance test.
2. The same metric shows the same value on every dashboard it appears on — verified by comparison,
   not by assumption.
3. Charts render as SVG, are keyboard accessible, and have a table fallback carrying the same data.
4. A department-scoped admin sees only their department's data.
5. Export produces valid CSV (opens correctly in Excel, including UTF-8 names) and a well-formatted
   PDF.
6. Analytics for a college with 60 students and 20 projects loads in under two seconds.
7. Materialised aggregates display their freshness timestamp.
8. No dashboard exposes individual peer-review detail to anyone but faculty.
9. `npm run check` clean.

## Key files this phase creates

```
src/lib/analytics/queries.ts              EVERY metric, defined exactly once
src/lib/analytics/aggregates.ts           Nightly materialisation
src/app/(app)/admin/analytics/
src/app/(app)/admin/reports/accreditation/   The commercial centrepiece
src/app/(app)/admin/reports/sdg/
src/app/(app)/faculty/analytics/
src/lib/export/{csv,pdf}.ts
src/components/charts/*                   Recharts wrappers, dynamically imported
```

## Notes & risks

- **Build the metric layer before any chart.** The moment two dashboards compute "active projects"
  independently, they will disagree, and an institution will notice at exactly the wrong moment.
- **The accreditation export is why a college pays.** Give it real effort: research what NAAC
  Criterion III actually asks for, and format the output the way an assessor expects to receive it.
  A generic "project report" PDF will not close a sale; a document that drops into their existing
  submission will.
- **Provenance is a feature.** Every number in an accreditation report must be traceable to a
  definition. Institutions get audited, and a number they cannot explain is worse than no number.
- **Do not rank faculty.** A dashboard that ranks faculty by projects supervised will make faculty
  hostile to the product, and faculty are the adoption channel. Show participation, never a league
  table.
- Charts are heavy. Dynamic import only, dashboard routes only, and check the bundle after adding
  Recharts — this is the phase most likely to breach the JS budget.
- Every chart needs a table fallback. It is an accessibility requirement, and it is also what people
  actually want when they are going to copy the numbers into a document.
- Materialise nightly rather than computing live for anything that scans the whole college, and show
  the freshness so nobody misreads it.

---

## Phase Summary

*Fill this in when the phase is complete.*

**What was built.**

**Key decisions made.**

**The accreditation mapping — which criteria, and what evidence.**

**Deviations from the spec above, and why.**

**Anything the next phase must know.**

**Verified by.**

| Check | Result |
| --- | --- |
| | |
