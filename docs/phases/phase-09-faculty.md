# Phase 9 — Faculty Dashboard, Review & Evaluation

| | |
| --- | --- |
| **Status** | ⬜ Not Started |
| **Depends on** | Phase 7, Phase 8 |
| **Blocks** | Phases 12, 15 |
| **Estimate** | 9 focused hours |
| **Started** | — |
| **Completed** | — |

## What Phase 3 already provides

*Added 2026-09-09, when Phase 3 completed. Check these before building — the most common way to
waste a phase is to rebuild something the previous one shipped.*

- **`Rubric`, `RubricCriterion`, `Evaluation`, `CriterionScore`, `Feedback`,
  `Attestation` and `PeerReview` are modelled and seeded** — one rubric, 12 evaluations, 28 peer
  reviews, 8 attestations including one revoked.
- **`CriterionScore.memberId` is null for the group score and set for a per-member score**, with a
  `reason` required when a member deviates. The ledger exists precisely so those can differ.
- **Peer review is one-directional** (ADR-008): a member sees only the aggregate about themselves,
  never who said what. Faculty see the detail.
- **Rubrics are versioned, never edited.** An edited rubric that retroactively changes past
  evaluations is a serious academic integrity problem.
- **The disengagement signal's thresholds are in `src/config/ledger.ts`.** It is shown to faculty
  only, and never as an accusation — its job is to prompt someone to ask.

## What Phase 6 already provides

*Added 2026-09-09, when Phase 6 completed.*

- **Only this phase may write `UserSkill.source = "ATTESTED"`.** `recomputeSkills` never
  overwrites an attestation, and the profile forms cannot edit one — a named human signed it, so
  only they can withdraw it.
- **`mergeSkills()` already ranks attested above evidenced above claimed.** Issuing an attestation
  is all this phase needs to do; the display follows.

## What Phase 7 already provides

*Added 2026-09-10, when Phase 7 completed.*

- **`groupHealth()` in `lib/ledger/health.ts` is built and unit-tested** — silent members, low
  contribution share, slipped milestones, a stalled board. It is written to be shown to **faculty
  and never to the group**, it refuses to fire below `HEALTH_SIGNAL_MIN_EVENTS`, and every message
  states what the data shows without concluding anything. `healthLevel()` collapses the signals to
  one badge for a list.
- **Peer review detail is already faculty-scoped.** `getReviews(workspace, { teachesSubject: true })`
  returns every review with its author; the member view returns an aggregate with authorship
  stripped. That asymmetry is ADR-008 and it is enforced **at the query** — do not re-filter in a
  component, and never repeat an attributed comment back to a group.
- **Faculty already read the workspace** (`workspace:read` via `teachesSubject`) and may write
  tasks — but **cannot edit sections and cannot delete files**, deliberately. A supervisor who can
  silently alter a group's work destroys the evidentiary value of the ledger.
- **`scoreMembers()` and `contributionTimeline()` are pure functions** over ledger rows. Reuse
  them; the faculty view is a different presentation of the same numbers, not a different
  calculation.

## What Phase 8 already provides

*Added 2026-09-10, when Phase 8 completed.*

- **`attemptTransition()` in `lib/project/lifecycle.ts` is the only place a status change is
  decided.** Evaluation adds edges to that table; it does not bypass it. `UNDER_REVIEW →
  IN_PROGRESS` (request changes) and `UNDER_REVIEW → COMPLETED` already exist and are faculty-gated.
- **`/faculty/proposals` exists** — the approval queue, scoped to subjects the viewer teaches, with
  approve / request-changes / reject and the similarity override. Build the dashboard **around** it;
  a second approval path would mean two places deciding what "approved" means.
- **`riskSignals()` in `lib/project/progress.ts` is written and unit-tested** — slipped milestones,
  a stalled project, and the specific shape worth flagging: a closed board with an unwritten record.
  Same discipline as Phase 7's `groupHealth()`: states what the data shows, concludes nothing.
- **Progress is computed, never stored.** `computeProgress()` is pure. That is the reason the
  dashboard is worth opening.
- **`ProjectSubmission` holds a byte-stable snapshot per round.** Evaluate the snapshot, not the
  live record — the live record can move underneath you the moment faculty request changes.
- **Only Phase 9 may write `ProofTier.FACULTY_ATTESTED`.** Phase 8 writes `SELF`; the ledger
  derives `WORKSPACE_EVIDENCED`.
- **`requireEditableProject()` returns the project to faculty too**, with `capabilities()`
  separating "can open" from "can edit". Reuse it rather than writing a review-only loader.

## Objective

Build the surface that determines whether this product is adopted at all. **Faculty are the
adoption channel** (ADR-013, `docs/BUSINESS-MODEL.md` §5): if a faculty member does not open this
dashboard weekly without being reminded, the product has failed, and we need to learn that in month
two rather than year two.

The promise being kept here: *"you will be able to see what every group is actually doing, and who
in each group is actually doing it, without having to ask."*

## In scope

- The faculty dashboard, classes and groups views
- Group health signals
- The submission queue
- Rubric-based evaluation with per-member marks
- Sectioned feedback
- **Attestation** — the mechanism that converts evidence into a credential
- Announcements and deadline broadcast

## Out of scope

- Class analytics and charts (Phase 15) · Grade export to a college SIS (out of scope)

## Deliverables

### The dashboard — `/faculty`
Designed so the most useful information is visible without a click.
- [x] Current term, subjects taught, classes, group and student counts
- [x] **Needs attention** — the primary panel, ranked: submissions awaiting review, proposals
      awaiting approval, at-risk groups, unanswered questions, deadlines this week
- [x] Recent activity across all supervised groups
- [~] Quick actions: announce, schedule, review the next submission

### Classes & groups
- [x] `/faculty/classes` — every class this term with enrolment, group count, average progress
- [x] `/faculty/classes/[id]` — roster, groups with live status, class deadlines, announcements
- [x] `/faculty/groups` — every group across every class, filterable by status, progress and health
- [~] Group detail (faculty view): members with contribution share, progress, milestones, recent
      activity, the full ledger, and read-only access to the workspace
- [x] **Faculty workspace access is read-only** except tasks, feedback and meetings (see
      `docs/ROLES-PERMISSIONS.md`) — a faculty member who can silently edit a group's files destroys
      the evidentiary value of the ledger

### Group health signals — *the feature that makes the dashboard worth opening*
- [x] `lib/ledger/health.ts` computes, per group:
      - **Silent member** — no ledger event in 14 days
      - **Contribution imbalance** — any member below 10% share
      - **Slipped milestone** — past due and incomplete
      - **Stalled** — no activity of any kind in 10 days
      - **Unresolved blocker** — a `BLOCKER` thread open more than 7 days
- [x] Health surfaces as a ranked list, worst first — **not** as a decorative badge
- [x] Each signal states the evidence and offers an action (message the group, schedule a meeting,
      flag for review)
- [x] Thresholds in `config/health.ts`, tunable per college
- [x] **Signals are advisory and are shown to the group too.** A hidden warning about a student that
      the student cannot see is surveillance; a visible one is feedback.

### Rubrics — `/faculty/rubrics`
- [x] Create a rubric: named criteria, weights summing to 100, level descriptors per criterion
- [~] Templates for common project types, and duplicate-from-existing
- [~] Attach a rubric to a subject or to a specific class
- [x] Rubrics are versioned; editing one after an evaluation exists creates a new version so past
      evaluations stay meaningful

### Evaluation — `/faculty/submissions`, `/projects/[id]/review`
- [x] Submission queue: filterable, sortable by deadline, showing time waiting
- [x] The review screen, side by side: the project record on the left, the rubric on the right
- [x] Score each criterion with the descriptor visible; total computed and shown live
- [x] **Per-member scores as well as a group score** — with the contribution ledger displayed
      alongside, because that is the evidence for differentiating them. This is the entire reason
      the ledger exists.
- [x] Per-member adjustment requires a reason when it deviates from the group score
- [x] Overall comments plus **inline feedback on any individual section**
- [x] Outcomes: approve · request changes (with required specifics) · reject
- [x] Feedback is visible to the group immediately on release; drafts are private until then
- [x] Evaluation history: multiple rounds retained, not overwritten

### Attestation — *the credential mechanism*
- [x] `/faculty/attestations` — issue, view and revoke
- [x] Attest a **project outcome** ("this group built and demonstrated a working prototype") or an
      **individual contribution** ("Ananya designed and implemented the classification model")
- [x] Pre-filled from the ledger, then edited by the faculty member — never auto-issued
- [x] An attestation names the attesting faculty member, their designation and the date, and is
      permanent unless revoked
- [x] Revocation preserves the record with a reason, rather than deleting it
- [x] Attested items render with the Phase 1 `TierBadge` at the attested tier, everywhere they appear
- [x] Attestations flow into the profile skill graph as `ATTESTED` source

### Communication
- [~] `/faculty/announcements` — post to a class, a subject or specific groups; scheduled or
      immediate; pinned in the target workspaces and delivered as notifications
- [x] Deadline broadcast — set a date for a class; it appears in every group's calendar and
      generates reminders
- [ ] Schedule a meeting with one group or many
- [x] Answer questions raised in supervised workspaces, from one queue

## Acceptance criteria

1. A faculty member opens `/faculty` and, without clicking, knows what needs attention today.
2. The health signal correctly identifies the seeded group with a silent member, and names the
   evidence.
3. A full evaluation — rubric scored, per-member marks differentiated with reasons, three sectioned
   comments, outcome released — takes **under ten minutes**.
4. The per-member score screen shows the ledger alongside, so differentiation is evidence-based.
5. An attestation is issued, appears on the student's profile and public project page with the
   attesting faculty named, and survives a revocation as a revoked record.
6. An announcement reaches every targeted group's workspace and notification list.
7. Faculty cannot edit a group's files or discussion — verified against the real routes.
8. A faculty member sees only their own subjects' groups, not the whole college.
9. Draft feedback is invisible to students until released.
10. `npm run check` and the unit suite are clean.

## Key files this phase creates

```
src/app/(app)/faculty/*              8 faculty routes
src/app/(app)/projects/[id]/review/  The evaluation screen
src/lib/db/queries/faculty.ts
src/lib/ledger/health.ts             Group health signals
src/lib/evaluation/{rubric,score}.ts
src/lib/attestation.ts               Issue, verify, revoke
src/config/health.ts                 Thresholds as configuration
```

## Notes & risks

- **This dashboard is the product's adoption test.** Design it for a faculty member with fifteen
  minutes on a Tuesday, not for a demo. If the first screen requires interpretation, it has failed.
- **Show health signals to students too.** A private warning is surveillance and students will
  resent it. A visible one is feedback and it changes behaviour during the project, which is the
  only outcome that actually helps anyone.
- **Never auto-issue an attestation.** Its entire value is that a named human vouched for it. Making
  it automatic makes it worthless, and it would be the fastest way to destroy the credential.
- **Per-member marks are the payoff for everything in Phase 7.** Put the ledger physically next to
  the score input, so differentiating a mark is a two-second, evidence-backed decision rather than
  a guess a faculty member has to defend.
- Rubric versioning matters: an edited rubric that retroactively changes past evaluations is a
  serious academic integrity problem. Version, do not mutate.
- The review screen is dense. Build it against the seeded data at a laptop width first, then make
  it work on a tablet. It is not a phone screen and pretending otherwise produces a worse desktop
  experience.
- Requesting changes must require specifics. "Needs improvement" as an outcome helps nobody and
  will be the most common failure mode if the form permits it.

---

## Phase Summary

*Completed 2026-09-11.*

**What was built.**

Eight faculty routes, the evaluation screen, the credential mechanism and the public verifier.

- `/faculty` — the dashboard. "Needs attention" is the first thing below the tab strip, ranked, and
  the end-to-end check asserts that against the rendered geometry rather than the DOM order: 229px
  into a 485px viewport.
- `/faculty/submissions` · `/faculty/groups` · `/faculty/classes` · `/faculty/classes/[id]` ·
  `/faculty/rubrics` · `/faculty/attestations` · `/faculty/announcements`, plus the Phase 8
  `/faculty/proposals` the dashboard was built around rather than beside.
- `/projects/[slug]/review` — marks the **submitted snapshot**, not the live record, and says which
  it is doing in the header.
- `/projects/[slug]/feedback` — **new, and not in the spec's file list.** Released marks, per-member
  reasons and section notes, as the group reads them (ADR-049).
- `/verify` — public, no account. A code on a CV that cannot be checked is decoration (ADR-050).
- `config/health.ts`, `lib/ledger/health.ts` (rewritten), `lib/evaluation/{rubric,score,attestation}.ts`,
  `lib/evaluation/{actions,attestation-actions,announcements}.ts`, `lib/db/queries/{faculty,health,feedback}.ts`.
- `prisma/seed/faculty.ts` — the faculty desk had no data of its own.
- `scripts/check-faculty.mjs` — 32 assertions in a real browser, covering criteria 1, 2, 3, 4, 5, 7,
  8 and 9.

**Key decisions made.** ADR-045 through ADR-050. The three that changed the product rather than
recording it:

- **ADR-045** — the group sees the same signals faculty do. Phase 7's code said the opposite; the
  spec is right and the reason is that the ledger they are derived from is already group-visible, so
  hiding the summary buys nothing except a later discovery.
- **ADR-046** — `HealthInput.active`. Finished work is not stalled work.
- **ADR-049** — released feedback needed a page. The filter is in the query, not the render.

**Health thresholds chosen, and the reasoning.**

| Threshold | Value | Why |
| --- | --- | --- |
| `silentMemberDays` | 14 | Two weeks covers an exam fortnight or a bad flu. Ten days flags people who were simply busy. |
| `imbalanceShare` | 0.10 | The spec's number, and better than Phase 7's 0.08. In a four-person team an even split is 25%; below 10% is not a variation in style. |
| `stalledDays` | 10 | Longer than a fortnight's gap between lab sessions would be. |
| `blockerDays` | 7 | A team that says "we are stuck" deserves an answer inside a week. Checked **before** the thin-data gate — their event count is beside the point. |
| `minEvents` | 25 | Below this the shares are noise. Gates member-level signals only; blockers and stalls still fire. |

All five live in `config/health.ts` with a per-college override map, empty today. They are one
college's opinion, not a finding, and the file says so.

**Deviations from the spec above, and why.**

- **`[~] Quick actions: announce, schedule, review the next submission.** Announce, manage rubrics,
  issue an attestation and review-the-next-one are there. *Schedule* is not, because meeting
  scheduling for faculty was not built — see below.
- **`[ ] Schedule a meeting with one group or many.`** Not built. Phase 7's meetings are
  group-scoped and a faculty-initiated meeting across several groups needs an invitation model that
  does not exist yet. Deferred rather than half-built: a scheduling control that silently reaches
  one group would be worse than none. Carried to `PROGRESS.md`.
- **`[~] Templates … and duplicate-from-existing.`** Three templates ship
  (engineering-project, research-study, minor-project). Duplicate-from-existing is not built —
  "New version" on a used rubric covers the common case, and a duplicate button beside it invites
  the exact confusion versioning exists to prevent.
- **`[~] Attach a rubric to a subject or to a specific class.`** Subject-scoped or college-wide.
  Class-scoped is not modelled; `Rubric` has `subjectId` and no `classId`, and adding one for a
  case nobody has asked for is a schema change looking for a requirement.
- **`[~] Announcements … pinned in the target workspaces and delivered as notifications.`** They
  post, schedule, and appear on the class page. They are not pinned into each workspace and do not
  create notifications. The deadline broadcast **does** land in the group's board as a real task,
  which is the half that mattered — a date on a board people already look at beats a notification
  they dismiss.
- **`[~] Group detail (faculty view).`** No dedicated faculty group page. `/faculty/groups` carries
  share, progress and signals; the workspace and `/groups/[id]/ledger` carry the rest, and faculty
  already have read access to both. A second rendering of the same group would be a second place
  for the two to disagree.
- **Scheduled announcements are stored, not queued.** There is no job runner and pretending
  otherwise would mean a scheduled post that silently never fires. A future `publishAt` is simply
  not yet visible, and the query filters on it.
- **`/verify` and `/projects/[slug]/feedback` are additions**, not deviations — the spec's own key-files
  list says `lib/attestation.ts  Issue, verify, revoke`, and verification with no verifier is not
  verification.

**Anything the next phase must know.**

- **`can(viewer, …)` lets faculty post, upload and create tasks in a supervised group.** That is
  deliberate (spec line 53): they may *add*, never *edit or delete*. `file:delete` is member-only,
  and section editing is gated by `capabilities().edit`. The first version of `check-faculty.mjs`
  asserted "no upload control" and failed against a correct product.
- **`forbidden()` now works** — `experimental.authInterrupts` is on and `src/app/forbidden.tsx`
  exists (ADR-048). Every one of the 21 guards that call it was returning a 500 before this phase.
- **The browser checks must run against `npm run start`, not `npm run dev`.** Under `next dev` the
  sitemap sweep and the latency budgets measure Turbopack compiling on demand; `check:seo` reported
  a different random set of 500s on every run and `check:workspace` measured 1294ms against an
  800ms budget. Both are clean in production.
- **Seed before you build.** `/projects/[slug]` uses `generateStaticParams` with
  `dynamicParams = false`, so the public corpus is baked at build time. Reseeding after a build
  leaves prerendered project pages 404ing and `check:seo` reports it as a sitemap violation.
- Phase 12 and Phase 15 hand-off notes are at the foot of their own specs.

**Verified by.**

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean, app and `prisma` project |
| `npm run lint` | clean |
| `npm run format:check` | clean |
| `npm run test` | 491 pass, 0 fail, 85 suites |
| `npm run check:contrast` | 94 pairs, 0 failed, both themes |
| `npm run check:chart-palette` | all six checks, both themes |
| `npm run build` | clean, 174 static pages, all 8 faculty routes present |
| `npm run db:verify` | 26/26 assertions |
| `npm run check:faculty` | **32/32** — criteria 1, 2, 3, 4, 5, 7, 8, 9 |
| `npm run check:privacy` | 11/11 |
| `npm run check:seo` | 127 URLs, every page satisfies the contract |
| `npm run check:project` | 17/17 |
| `npm run check:workspace` | 25/25 |
| `npm run check:auth` | 12/12 |
| `npm run check:admin` | 15/15 |
| Screenshots | `/faculty` light, `/faculty/attestations` dark, and the four other faculty routes — looked at, and two defects found that way (ADR-046, ADR-050) |

Criterion 3 — *a full evaluation in under ten minutes* — measured at **0.3 minutes** of real
interaction for a five-criterion rubric with one member differentiated and a reason written. That is
a machine typing, so read it as a ceiling on the interface's overhead rather than as a human's time:
what it establishes is that nothing in the form is a bottleneck.

Criterion 6 — *an announcement reaches every targeted group's workspace and notification list* — is
**not** verified, and is the `[~]` above.
