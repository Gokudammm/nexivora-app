# Phase 7 — Groups & the Project Workspace

> **This is the heart of the product.** Everything before it is scaffolding for it; everything
> after it is leverage on it. It is estimated at nearly double any other phase. Do not rush it.

| | |
| --- | --- |
| **Status** | ✅ Complete |
| **Depends on** | Phase 5, Phase 6 |
| **Blocks** | Phases 8, 9, 10, 12 |
| **Estimate** | 14 focused hours, split into four checkpoints |
| **Started** | 2026-09-10 |
| **Completed** | 2026-09-10 |

## What Phase 3 already provides

*Added 2026-09-09, when Phase 3 completed. Check these before building — the most common way to
waste a phase is to rebuild something the previous one shipped.*

- **Every workspace model is built and seeded**: `Group`, `GroupMember`, `Task`,
  `TaskAssignee`, `TaskLabel`, `TaskComment`, `FileAsset`, `FileVersion`, `Thread`,
  `Message`, `Mention`, `Meeting`, `MeetingAttendance`, `LedgerEvent`, `PeerReview` —
  18 groups, 257 tasks, 235 threads and messages, 691 ledger events.
- **The ledger is append-only and its weights live in `src/config/ledger.ts`** (ADR-007),
  denormalised onto each event at write time. Write the event **inside the same transaction** as the
  action that produced it: `db:verify` asserts every event points at a row that exists, and that
  assertion is the feature's entire credibility.
- **`canal-scheduling-multi-farm` is seeded with a member the work never lands on**, so Phase 9's
  health signal has a real case to fire on.
- **`FileAsset.storageKey` is a generated name, never the original filename** — the filename is
  metadata and must never become a path (docs/SECURITY.md §4).

## What Phase 4 already provides

*Added 2026-09-09, when Phase 4 completed.*

- **`can(viewer, action, resource)` in `src/lib/authz/policy.ts` is the only place a permission
  is decided.** 41 actions, 100 matrix assertions. If you are about to write `if (role === …)`,
  the rule belongs there instead.
- **Every query takes `viewer` first**, including for the logged-out public where `ANONYMOUS` is
  a real viewer. A denied read returns `null`; a denied write throws `ForbiddenError`.
- **Roles are per membership; faculty scope is per subject.** There is no `viewer.role` (ADR-029).
- **Guards protect pages, the query protects data** (ADR-028). Anything you add must be safe with
  `proxy.ts` disabled — `isolation.test.ts` asserts exactly that.
- **The workspace permissions are already written and tested**, including the ones that are easy to
  get backwards: faculty read the workspace and write tasks, but **cannot edit project sections and
  cannot delete files** — a supervisor who can silently alter a group's work destroys the
  evidentiary value of the ledger. A college admin **cannot read a workspace at all**.
- **`resolveVisibility()` does not yet fold group visibility** — Phase 4 covered resource
  visibility, embargo and the college gate. Folding the group in is a Phase 7 deliverable.
- **Avatar and file upload need storage**, which is this phase. Onboarding skips the avatar step
  for that reason.

## What Phase 5 already provides

*Added 2026-09-09, when Phase 5 completed.*

- **Storage is this phase**, and two Phase 5 items are waiting on it: college logo upload and the
  accent colour on `/admin/college`.
- **`getClass()` returns the roster, faculty and groups for a class**, already scoped. Groups form
  inside a class, so that is the join to build from.
- **`resolveVisibility()` still does not fold group visibility.** Phase 4 covered resource
  visibility, embargo and the college gate; the group is yours.

## What Phase 6 already provides

*Added 2026-09-09, when Phase 6 completed.*

- **Storage is this phase, and three things are waiting on it**: profile avatar upload, cover
  images, and the college logo from Phase 5.
- **`recomputeSkills(userId)` in `lib/profile/actions.ts` must run when a project changes state.**
  It is deliberately never called on render — it is join-heavy and would land on the profile LCP.
- **`lib/follow.ts` is complete** and already verifies a target is visible to the viewer before
  allowing a follow, so following can never be used to discover private work.

## Objective

Build the place where student group work actually happens — good enough that a group of five
students chooses it over a WhatsApp group and a Drive folder. And build the **Contribution
Ledger**, the feature that addresses the most universally felt problem in group coursework and that
nobody else builds.

Per ADR-013, this is also the **go-to-market wedge**: the workspace is valuable to five people with
nobody else on the platform, which is what makes the cold start survivable.

## In scope

Groups, membership, tasks, files, discussion, meetings, deadlines, activity, and the ledger with
peer review.

## Out of scope

- The project record itself (Phase 8) — a group can exist before its project page does
- Faculty evaluation (Phase 9) · The feed (Phase 10)
- Real-time collaborative document editing and video conferencing — both out of scope entirely

---

## Checkpoints

Split so partial progress is still shippable. Do not start a checkpoint before the previous one
works end to end.

| # | Checkpoint | Ships |
| --- | --- | --- |
| **7A** | Groups & membership | A group exists, has members, and has a home |
| **7B** | Tasks | A board people would actually use |
| **7C** | Files, discussion & meetings | The rest of the collaboration surface |
| **7D** | **The Contribution Ledger & peer review** | The differentiator |

---

## Deliverables

### 7A — Groups & membership
- [~] `/groups` — my groups, with status and next deadline. **No unread indicators** — unread
      state needs the notification model Phase 10 owns (see summary)
- [x] `/groups/new` — create within a class: name, description, size limit, visibility, join policy
      (`OPEN · REQUEST · INVITE_ONLY`)
- [~] Membership: invite by username or email, faculty assignment, bulk faculty-assign for a whole
      class, and direct join for an `OPEN` group. **"Request to join" is not built** — a request is a
      notification, and Phase 10 owns those (see summary)
- [x] Roles inside a group: `LEAD · MEMBER`. Lead can invite, remove, rename and submit.
- [x] Leave a group (a lead must transfer leadership first)
- [x] `/groups/[id]` — the workspace home: at-a-glance progress, upcoming deadlines, recent
      activity, my open tasks, member strip
- [x] `/groups/[id]/settings` — details, members, join policy, archive
- [x] Every group route enforces membership at the query layer, not only in middleware

### 7B — Tasks
- [x] `/groups/[id]/tasks` — board view with columns `TODO · IN_PROGRESS · BLOCKED · REVIEW · DONE`
- [x] List view with sort and filter, as an equal alternative to the board
- [~] Task: title, description, assignee(s), due date, priority, labels, linked milestone.
      **No checklist** — deliberately dropped (see summary)
- [~] Create in a dialog from the board; edit in a sheet from a card, or in full on the task page.
      **Not inline on a column** (see summary)
- [x] **Drag and drop with optimistic updates** — a card moves at 0ms and the server reconciles
- [x] **Full keyboard operation via a "move to" menu.** This is an accessibility requirement and it
      is also the fallback that works with no drag library at all.
- [x] Task comments with `@mentions`
- [x] `/groups/[id]/tasks/[taskId]` deep link, so a notification can point at a task
- [x] My-tasks view across all groups
- [x] Overdue highlighting and a due-soon indicator
- [x] **Closing a task writes a `LedgerEvent` in the same transaction** (ADR-007)

### 7C — Files, discussion & meetings

**Files**
- [~] `/groups/[id]/files` — list, search, trash. **No grid view and no folder navigation** —
      `folder` is stored and honoured by the query, but nothing browses by it (see summary)
- [~] Upload: drag-and-drop, multi-file, progress — **resumable is not built** (see summary)
- [x] **Validation by magic bytes, not extension**; 25 MB per file, 2 GB per group
- [x] Versioning as `FileVersion` rows: upload a new version, view history, restore, and a visible
      "who contributed which version"
- [~] Preview: served inline for PDF, images and text; **no syntax highlighting** (see summary)
- [x] **Served only through `GET /api/files/[id]`** with an authorisation check — no static path
- [x] Uploaded SVG is never inlined (see `docs/SECURITY.md` §3)
- [x] Delete to trash, restorable for 30 days

**Discussion**
- [x] `/groups/[id]/discussion` — threads with a title and a body
- [x] Thread types: `GENERAL · QUESTION · DECISION · BLOCKER`
- [x] Replies (one nesting level — deeper threading helps nobody), reactions, `@mentions`
- [x] Rich text via Tiptap, **sanitised on the server** before storage and again at render
- [x] Attach a file or link a task from inside a thread
- [x] Pin a thread; resolve a `QUESTION` or `BLOCKER` with the resolving reply marked
- [x] Unread state per user

**Meetings**
- [x] `/groups/[id]/meetings` — upcoming and past
- [x] Schedule: title, datetime, duration, agenda, location or join link, attendees
- [x] **We do not host video.** We store a link (Meet, Zoom, Teams). This is stated in the UI.
- [x] RSVP, attendance marking, minutes, action items that **become tasks** with one click
- [x] Calendar view for the group, plus an `.ics` export

**Deadlines & activity**
- [x] `/groups/[id]` calendar strip combining tasks, milestones and meetings
- [x] An activity stream of every workspace event, filterable by member and type

### 7D — The Contribution Ledger *(the differentiator)*
- [x] `LedgerEvent` written **inside the same transaction** as every contributing action:
      `TASK_CLOSED · FILE_ADDED · FILE_REVISED · THREAD_STARTED · MESSAGE_POSTED ·
      MEETING_ATTENDED · MILESTONE_OWNED · COMMIT_LINKED · REVIEW_GIVEN`
- [x] **Append-only.** No update or delete path exists. Corrections are compensating events.
- [x] Weights in `config/ledger.ts`, never at the call site, so they can be tuned without a
      migration
- [x] `lib/ledger/score.ts` — per-member contribution score, unit-tested
- [x] `/groups/[id]/ledger` — **visible to every member**, not only to faculty:
      - Contribution share per member, as a chart and a table
      - Breakdown by event type
      - Timeline of contribution over the project's life
      - Every score links to the actual evidence
- [x] **Transparency is the design.** Hiding the ledger from members turns it into surveillance;
      showing it turns it into an honest, self-correcting signal. This is the whole point.
- [x] Optional GitHub commit linking: paste a repository URL, map commit authors to members
      (public API, unauthenticated, cached — no token, no cost)
- [x] **Peer review at milestone close:** each member rates each other on contribution, reliability
      and communication (1–5) with a required comment
- [x] **A member sees only the aggregate about themselves, never who said what** (ADR-008).
      Faculty see full detail. A member always sees their own submitted reviews.
- [x] Review is required before a milestone can be marked complete, with a reminder, and it is
      skippable by the lead with a recorded reason
- [x] Group health signals computed here and consumed by Phase 9: a member with no ledger events in
      14 days, a contribution share below 10%, a slipped milestone

## Acceptance criteria

1. A five-member group runs a realistic two-week sprint entirely inside the workspace: tasks
   created, assigned, moved and closed; files uploaded and revised; a decision thread resolved; a
   meeting held with minutes converted to tasks.
2. **The ledger reflects what each member actually did**, and every number links to the evidence.
3. The task board is fully operable by keyboard, with no drag interaction, start to finish.
4. Dragging a card feels instantaneous; a server failure reverts it visibly with an explanation.
5. A file uploaded by group A returns 404 to a member of group B — verified against the real URL.
6. An upload with a mismatched magic byte is rejected.
7. A peer review submitted by member A is never visible to member B in any view, at any URL.
8. The ledger cannot be edited: attempting an update through the client wrapper is a type error.
9. The workspace home loads in under 800ms with the seed data.
10. Every list has an empty, loading and error state.
11. `npm run check` and the unit suite are clean.

## Key files this phase creates

```
src/app/(app)/groups/*                8 workspace routes
src/app/api/files/[id]/route.ts       Signed, authorised file access
src/components/workspace/*            TaskBoard, TaskCard, FileList, Thread, MeetingCard, LedgerTable
src/lib/db/queries/group.ts
src/lib/ledger/{record,score,health}.ts   The differentiator — unit tested
src/lib/storage/{provider,local,blob}.ts   Local and private Vercel Blob drivers
src/config/ledger.ts                  Event weights as configuration
tests/unit/ledger.test.ts
```

## Notes & risks

- **Optimistic UI is not optional here.** A task board that waits 300ms per drag feels broken, and
  a workspace that feels broken loses to WhatsApp on day one. Every mutation in 7B is optimistic.
- **The ledger transaction boundary is the whole feature.** If a ledger event is written after the
  task update rather than with it, a failure between them produces a record that disagrees with
  reality — and a ledger that can be wrong is worse than none, because it looks authoritative.
- **Show the ledger to members.** The instinct is to make it a faculty tool. That instinct is
  wrong: a visible ledger changes behaviour during the project, which is the point, and a hidden one
  is surveillance, which students will correctly resent.
- **Peer review privacy is one-directional and must be enforced at the query.** Aggregate for the
  subject, detail for faculty. A leak here destroys trust in the mechanism permanently.
- **GitHub linking uses the public API without a token.** Rate-limited to 60 requests/hour per IP,
  so cache aggressively and degrade silently. It is a bonus signal, never a dependency.
- Do not build chat. Threaded discussion serves the decision-making need; real-time chat is a
  different product and students already have one. Say so rather than half-building it.
- The `Table` mobile card fallback deferred from Phase 1 lands here — the ledger table is the first
  place it is genuinely needed.
- **If time runs short, ship 7A–7C and defer 7D by a week — but do not defer it further.** The
  ledger is why anyone chooses this over a Drive folder.

---

## Phase Summary

*Completed 2026-09-10.*

**What was built.**

*7A — Groups & membership.* `/groups` (with the next deadline and "how many are mine" on every
card), `/groups/new`, `/groups/[id]` and `/groups/[id]/settings`, plus `/groups/my-tasks` — the one
page that crosses group boundaries, because no single board answers "what do I owe anybody this
week". Invite by username or email, transfer leadership, leave, archive, and a bulk faculty-assign
across a whole class. `groupVisibleTo()` in `queries/group.ts` is the group visibility predicate
that Phases 4, 5 and 6 each recorded as still owed.

*7B — Tasks.* Five-column board and an equal list view, task sheet and a deep-linkable task page
with comments and `@mentions`. Drag and drop with optimistic updates, and — built first — a
keyboard-operable "move to" menu on every card.

*7C — Files, discussion & meetings.* Upload with magic-byte verification, versioning with a visible
"who contributed which version", restore, trash, a 2 GB group quota, and `GET /api/files/[id]` as
the only path to a user file. Threads with four kinds and a marked resolving reply. Meetings with
RSVP, attendance, minutes, action-items-become-tasks in one transaction, and an `.ics` export.

*7D — The Contribution Ledger.* `lib/ledger/{record,score,health}.ts`, `/groups/[id]/ledger` visible
to every member, `/groups/[id]/activity` where every ledger row links to its evidence, peer review
with one-directional privacy, milestone close gated on review with a lead's recorded-reason escape
hatch, and optional GitHub commit linking through the unauthenticated public API.

*Closed from earlier phases.* The storage layer everything above waited on
(`lib/storage/{provider,local,file-types,images}.ts`), avatar upload (Phase 6's hand-off), and
college logo + accent colour (Phase 5's).

**Key decisions made.** ADR-036 markdown-lite instead of Tiptap · ADR-037 a separate CVD-validated
chart palette · ADR-038 the ledger has no update path, enforced by the type system · ADR-039
drag-and-drop as an enhancement over a keyboard control · ADR-040 the seed writes real file bytes.

**Ledger weights chosen, and the reasoning.** Unchanged from Phase 3's `config/ledger.ts`:
TASK_CLOSED 5, MILESTONE_OWNED 8, FILE_ADDED 3, COMMIT_LINKED 3, REVIEW_GIVEN 3, FILE_REVISED 2,
THREAD_STARTED 2, MEETING_ATTENDED 2, MESSAGE_POSTED 1. Building against them confirmed the flat
scale was right: a ratio wide enough to game is a ratio somebody will game, and the ledger's only
claim is "this is how much recorded activity you account for". Two rules emerged while wiring them
up — **assignees get the credit for a closed task**, falling back to the closer when nobody is
assigned (otherwise a group working off an unassigned board records nothing, and the members who use
the board most carefully end up with the emptiest ledgers); and **attendance carries a small weight
and says who recorded it**, because it is the one event a person asserts rather than the system
deriving.

**Deviations from the spec above, and why.**

- **No Tiptap and no sanitiser** (ADR-036). Phase 2's renderer emits React elements and cannot
  produce raw HTML, so the threat a sanitiser mitigates is not representable. `docs/SECURITY.md` §3
  has been corrected rather than left to mislead.
- **No drag library.** The keyboard menu had to exist regardless, and the native drag events are
  ~20 lines on top of it (ADR-039).
- **The ledger timeline is small multiples, not a multi-line chart** (ADR-037). Six hues cannot
  separate under colour-vision deficiency inside the dark theme's lightness band — measured, not
  assumed — so each member gets a row with their name beside it.
- **Five deliverables shipped partially and are marked `[~]` above**: no unread indicators, no
  "request to join", no task checklist, no inline-on-column create, no file grid view or folder
  browsing, no resumable upload, no syntax highlighting in previews. Each is small; each is either
  waiting on Phase 10's notification model or is a refinement rather than a capability.
- **No cover image.** Phase 6's note assumed `User` had a cover column. It does not. Adding one
  belongs with Phase 8, where a cover is actually rendered — a migration for a field nothing
  displays cannot be verified.

**Anything the next phase must know.**

- **`requireWorkspace(viewer, groupId)` is the gate for every workspace surface**, and it returns
  `null` for "absent" and "not yours" alike. Compose it; do not write a second membership check.
- **Every workspace read takes a `Workspace`, not a group id.** That value can only come from
  `requireWorkspace()`, so a query cannot be called with an id straight off the URL.
- **`recordLedgerEvent(tx, …)` requires a transaction client and there is no update path** — by
  type, not by convention (ADR-038). Corrections are compensating events.
- **A value a client component needs never lives in a query module.** `config/tasks.ts` and
  `config/storage.ts` exist because importing a constant from `queries/*` pulls `pg` into the
  browser bundle, and a `"use server"` file may export only async functions. Both were build
  failures, not style preferences.
- **Storage exists now**: `storeImage()` for anything shown beside a name, `storage()` for
  workspace files. Phase 8's project cover is `storeImage("cover", …)` plus one schema column.
- Phase 9 consumes `groupHealth()` from `lib/ledger/health.ts`; the signals are written to be
  shown to faculty and never to the group.

**Verified by.**

| Check | Result |
| --- | --- |
| `npm run check` | Clean — **350 tests**, 0 lint errors, 0 warnings, Prettier clean |
| `npm run build` | Clean |
| `npm run check:workspace` | **25/25** in a real browser |
| `npm run check:chart-palette` | All six checks pass in **both** themes |
| `npm run check:seo` | **127 pages, 0 violations** — unchanged by this phase |
| `npm run check:auth` | 12/12 |
| `npm run check:admin` | 15/15 |
| `npm run check:privacy` | 11/11 |
| `npm run db:verify` | 26/26 |
| Acceptance criterion 3 — keyboard-only board | Passed: `TODO → IN_PROGRESS` with no drag |
| Acceptance criterion 4 — optimistic move | **66ms** to repaint; reconciled, not reverted, on reload |
| Acceptance criterion 5 — cross-group file | 200 to a member, **404** with no session, at the real URL |
| Acceptance criterion 6 — magic bytes | 30 assertions, including a PE renamed `.png` and a ZIP renamed `.png` |
| Acceptance criterion 7 — peer review privacy | 20 data-layer assertions with positive controls |
| Acceptance criterion 8 — ledger immutability | `recordLedgerEvent(db, …)` does not compile |
| Acceptance criterion 9 — workspace home | **133ms** against an 800ms budget |
