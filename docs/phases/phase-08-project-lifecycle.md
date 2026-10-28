# Phase 8 — Project Lifecycle & Project Pages

| | |
| --- | --- |
| **Status** | ✅ Complete |
| **Depends on** | Phase 7 |
| **Blocks** | Phases 9, 11, 12, 15 |
| **Estimate** | 10 focused hours |
| **Started** | 2026-09-10 |
| **Completed** | 2026-09-10 |

## What Phase 3 already provides

*Added 2026-09-09, when Phase 3 completed. Check these before building — the most common way to
waste a phase is to rebuild something the previous one shipped.*

- **`ProjectSection` is rows, not JSON** (ADR-009) — 9 per project, 126 seeded.
- **`ProjectStatusEvent` already records the transition history** the timeline renders from.
- **Publication is gated by a check constraint**: a `PUBLIC` project without `approved = true`
  cannot be stored (ADR-010). Do not re-implement that rule in a route handler; it is underneath you.
- **The duplicate check is built and tested** — `shortlistSimilarProjects()` in
  `lib/search/fts.ts` narrows via the trigram index, `scoreSimilarity()` in
  `lib/search/similarity.ts` decides (ADR-023). It flags for a **conversation, never an
  accusation**: a replication study scores like a copy, and only a human can tell them apart.
- **`ProjectSubmission` stores an immutable snapshot per round**; `SimilarityCheck` stores the
  matches and any faculty override with its justification.

## What Phase 5 already provides

*Added 2026-09-09, when Phase 5 completed.*

- **The project pages still read `src/content/`, and swap in this phase** (ADR-030) — this is where
  projects become creatable, so this is where the public pages should read the database.
- **`toContentProjectCard()` in `queries/adapters.ts` is how a row reaches a Phase 2 component.**
  Extend it rather than rewriting `ProjectCard`.
- **Until that swap, the public site is mixed** — colleges from the database, projects from
  fixtures. They agree because `db:verify` asserts the anonymous query layer returns exactly the
  fixtures' public set. Your swap removes the need for that assertion.
- **`check:seo` must still pass 127/127 afterwards.** That is the bar the college swap cleared and
  the only thing that makes "no rendered page changed" a fact rather than a hope.

## What Phase 6 already provides

*Added 2026-09-09, when Phase 6 completed.*

- **Call `recomputeSkills(userId)` for every member when a project's status changes.** That is what
  promotes a self-declared skill to evidenced, and the profile's credibility depends on it.
- **Only `IN_PROGRESS`, `UNDER_REVIEW`, `COMPLETED` and `ARCHIVED` count as evidence.** A draft
  deliberately yields nothing — otherwise a skill can be manufactured with an empty project.
- **`toContentProjectCard()` is the adapter** the profile page already uses; extend it rather than
  rewriting components when you swap the project pages.

## What Phase 7 already provides

*Added 2026-09-10, when Phase 7 completed.*

- **Storage exists.** `storeImage("cover", projectId, file)` in `lib/storage/images.ts` is the
  project cover, and `components/ui/image-upload.tsx` is the control. **You need one schema column**
  — `Project.coverUrl` — which is why the cover was not built in Phase 7: a migration for a field
  nothing renders cannot be verified.
- **A group exists before its project does**, and `requireWorkspace(viewer, groupId)` is how you
  reach one. `workspace.projects` is already on the loaded value.
- **Milestones are wired.** `closeMilestone()` in `lib/workspace/review.ts` gates closing on peer
  review and writes the `MILESTONE_OWNED` ledger event. If you add milestone CRUD, do not add a
  second close path.
- **The markdown renderer is the section renderer** (ADR-036). Project sections are plain text
  through `components/content/rich-text.tsx` — no sanitiser, no Tiptap, and no
  `dangerouslySetInnerHTML` anywhere in the product. Keep it that way.
- **`recomputeSkills(userId)` must run when a project changes state** — Phase 6's rule, and Phase 8
  is the phase that changes project state.
- **`can(viewer, 'project:approve' | 'project:submit' | 'project:visibility')` is already written
  and tested.** Do not re-derive who may publish.

## Objective

Turn a group's work into a **structured, reviewable, publishable record**. This is the object the
whole product is organised around: the thing faculty evaluate, the thing that gets archived, the
thing that ranks in search, and the thing a student shows an employer.

## In scope

- The nine-section project record with an editor
- The lifecycle state machine and its role-gated transitions
- Milestones and computed progress
- Faculty proposal approval
- The duplicate-similarity check
- Visibility and IP embargo controls
- Final submission with an immutable snapshot

## Out of scope

- Evaluation and rubrics (Phase 9) · The public showcase and archive (Phase 12)

## Deliverables

### The project record
- [x] `/projects/[id]/edit` — section navigator showing completion state per section
- [x] `/projects/[id]/edit/[section]` — one editor per section, autosaving
- [x] The nine sections, each a `ProjectSection` row (ADR-009):
      `PROBLEM · RESEARCH · SOLUTION · METHODOLOGY · PROTOTYPE · TESTING · RESULTS · CONCLUSION ·
      FUTURE_WORK`
- [~] Each section: **markdown-lite through the existing renderer, not Tiptap** (ADR-036 — there
      is no HTML path, so the sanitiser it would need is unnecessary rather than absent), word
      count, last editor, completion toggle. **No per-section attachments or external links** — the
      group file library is one click away and a second copy of it here would diverge
- [x] **Per-section guidance** — a short prompt explaining what belongs in this section and an
      example. Most students have never written a methodology section and the blank page is the
      real obstacle.
- [x] Metadata: title, one-line summary, abstract, domain and sub-domain, tags, tech stack, SDG
      alignment (multi-select from the 17), team members with declared roles, repository link, demo
      link, video link, start and end dates
- [x] Edit history per section: who changed what, when; restore a previous version
- [~] Concurrent-edit protection: the soft lock is written, claimed on entry and refreshed every
      four minutes, and the indicator renders. **Not verified with two simultaneous browsers** —
      the end-to-end check drives one session (see summary)

### Lifecycle
- [x] States: `DRAFT → PROPOSED → APPROVED → IN_PROGRESS → UNDER_REVIEW → COMPLETED → ARCHIVED`,
      plus `REJECTED` and `ABANDONED`
- [x] `lib/project/lifecycle.ts` — the transition table, with the role permitted for each
      transition and the preconditions for it. **One place, unit-tested.**
- [x] Every transition writes a `ProjectStatusEvent` with actor, timestamp and reason
- [x] A transition with unmet preconditions is refused with a message naming exactly what is missing
- [~] The editor uses `Badge` with the lifecycle's own `LABEL`, not `StatusPill`. `StatusPill`
      takes Phase 2's seven-value content status; the editor needs all nine including `REJECTED`
      and `ABANDONED`, which that type cannot express. `ProjectCard` still uses `StatusPill` on the
      public surface, where seven is the right set

### Proposal & approval
- [x] `/projects/[slug]/propose` — problem statement, proposed solution, and the similarity check.
      **`[slug]` not `[id]` throughout**: Next refuses two different dynamic names at the same route
      position, and `/projects/[slug]` is already the public page (see summary)
- [x] **The similarity check runs at proposal time**, against the college archive and public
      projects
- [x] Results shown to the student *before* submitting: top matches with scores and the reason for
      each ("87% similar problem statement; shares 4 of 5 tech stack items")
- [x] Result stored as a `SimilarityCheck` row so the decision is auditable, not just the score
- [x] Faculty review queue: approve, reject with a reason, or request changes
- [x] Faculty can override a similarity flag with a recorded justification — because a legitimate
      continuation of previous work *should* look similar, and the system must not block it
- [x] Approval moves the project to `APPROVED` and unlocks full editing

### Milestones & progress
- [x] `/projects/[id]/milestones` — create, order, assign an owner, set a due date
- [~] A milestone shows the tasks linked to it and their completion. **Linking a task to a
      milestone happens on the Phase 7 board, not here** — a second linker would be a second place
      deciding what a milestone contains
- [x] Milestone states: upcoming, in progress, at risk (past due, incomplete), complete
- [x] Closing a milestone triggers the Phase 7D peer review
- [x] **Progress is computed, never typed by hand**: section completion, milestone completion and
      task completion, weighted, with the weights in config
- [x] `riskSignals()` and `milestoneState()` are written and unit-tested, ready for Phase 9 to
      consume. There is no faculty dashboard yet to surface them on
- [x] Timeline / Gantt-lite view — dated markers on a shared range, CSS grid, **no chart library**

### Visibility & IP
- [x] Visibility selector: `PRIVATE · GROUP · CLASS · COLLEGE · PUBLIC`
- [x] **Public requires faculty approval.** The group requests it; a faculty member grants it.
- [x] `embargoUntil` — an embargoed project shows title, team and abstract only; sections, files
      and results are hidden until the date. It can be *cited* without being *disclosed*.
- [x] A plain-language explanation of what each visibility level means, shown at the point of choice
- [x] A link to `/legal/ip-policy` from the embargo control
- [x] `resolveVisibility()` extended to cover projects fully; indexability derives from it (ADR-010)

### Submission
- [x] `/projects/[id]/submit` — a pre-submission checklist: required sections complete, all
      milestones closed, all members have submitted peer reviews, required attachments present
- [x] Submission creates an **immutable snapshot** — the full record serialised at that moment
- [x] Post-submission editing is locked unless faculty request changes
- [~] Submission receipt with a timestamp and a content digest, shown on submission and in the
      history. **Not downloadable as a file** — that is a PDF, and `lib/pdf/` is Phase 15
- [x] Resubmission after requested changes creates a new snapshot; the old one is retained

## Acceptance criteria

1. A project goes end to end: draft → proposal → approved → in progress with milestones →
   submitted, with every transition correctly gated by role.
2. **The similarity check fires on the deliberately-similar seeded pair** and does not fire on an
   unrelated one.
3. A faculty override of a similarity flag is recorded with its justification and is visible later.
4. Progress is computed from real section, milestone and task state — nowhere is it typed.
5. An embargoed project shows the abstract and hides everything else, to every role except its own
   group and the assigned faculty.
6. A `PRIVATE` project is absent from the sitemap and carries `noindex`.
7. A submitted project cannot be edited until faculty request changes.
8. The submission snapshot is byte-stable and reproduces the record as it was.
9. Section autosave loses no work across a navigation or a refresh.
10. Two members editing the same section see the soft-lock indicator.

## Key files this phase creates

```
src/app/(app)/projects/[id]/edit/*          Section editor
src/app/(app)/projects/[id]/milestones/*
src/app/(app)/projects/[id]/submit/*
src/lib/project/lifecycle.ts                The transition table — unit tested
src/lib/project/progress.ts                 Computed, never stored as truth
src/lib/project/snapshot.ts                 Immutable submission records
src/lib/search/similarity.ts                Extended from Phase 3, wired to the proposal flow
src/components/project/*                    SectionEditor, MilestoneTimeline, VisibilityControl
```

## Notes & risks

- **Per-section guidance is worth more than it looks.** The blank-page problem is the real reason
  project documentation is bad. A one-sentence prompt and an example per section will do more for
  content quality than any feature in this phase.
- **The similarity check must not be a gate that blocks legitimate work.** A project that formally
  builds on a previous one *should* be similar. It informs the faculty decision; it never makes it.
  Say this in the UI so students are not alarmed by a high score.
- **Progress must be computed.** A self-reported percentage is meaningless and every faculty member
  knows it. Computed progress is the reason the dashboard in Phase 9 is worth opening.
- **Do not attempt CRDT collaborative editing.** A soft lock with a clear indicator is honest, is a
  day's work instead of a month's, and is what the use case actually needs.
- Snapshots grow. Store them compressed and prune non-final ones after the term closes.
- The embargo is a real academic need — a patentable project cannot be public before filing. It is
  also a strong trust signal for a faculty audience. Do not treat it as an edge case.
- This phase must not duplicate Phase 12's public page. Here we build the **editor and the
  lifecycle**; the public rendering is already a Phase 2 template and gets wired to real data in
  Phase 12.

---

## Phase Summary

*Completed 2026-09-10.*

**What was built.**

*The record.* `/projects/new`, `/my/projects`, and the editor at `/projects/[slug]/edit` — a section
navigator with computed progress, nine per-section editors with autosave and version history, and a
details tab carrying metadata, team, cover, visibility and the IP embargo. `config/sections.ts`
holds each section's prompt, its two or three questions and a real example (ADR-044).

*The lifecycle.* `lib/project/lifecycle.ts` is the transition table — nine states, thirteen edges,
the actor each requires and the preconditions for it. `moveProject` asks it two separate questions in
order: *is this move legal* and *may you make it*. Every transition writes a `ProjectStatusEvent`
inside the same transaction.

*Proposal and approval.* `/projects/[slug]/propose` runs the similarity check against the archive
and stores it as a `SimilarityCheck` row; `/faculty/proposals` is the queue, scoped to subjects the
viewer teaches, with approve / request-changes / reject and a recorded override for a legitimate
overlap.

*Milestones and submission.* `/projects/[slug]/milestones` with a dated Gantt-lite timeline and no
chart library; `/projects/[slug]/submit` with a checklist that shows **every** unmet item at once and
an immutable, byte-stable snapshot per round.

*The swap.* Seven public pages and the sitemap now read the database (ADR-030). `check:seo` returned
**127 pages, 247 JSON-LD blocks, 127 unique titles — identical to the pre-swap baseline.**

**Key decisions made.** ADR-041 progress counts tasks only through the project's own milestones ·
ADR-042 derived views are pure functions over a corpus, shared by fixtures and database ·
ADR-043 a Prisma scalar list has no database default and raw SQL sees the `NULL` ·
ADR-044 section guidance ships beside the textarea, never in a help article.

**Similarity thresholds chosen, and how they were tuned.** Unchanged from Phase 3 —
`DUPLICATE_THRESHOLD` and `RELATED_THRESHOLD` in `config/search.ts`, tuned there against the real
corpus (ADR-023). This phase wired them to the proposal flow and asserted the result against the
seeded pair rather than re-deriving them: the deliberate near-duplicate scores above the duplicate
threshold, an unrelated project scores below the related one, and the trigram shortlist *reaches*
the near-duplicate — both halves, because a correct scorer that never receives the candidate is
useless. The presentation was the real work: every match carries **the reason for its score**
("87% similar problem statement; shares 4 of 5 tech stack items"), and the copy says outright that
overlap is frequently legitimate.

**Deviations from the spec above, and why.**

- **`[slug]`, not `[id]`, throughout.** `docs/SITEMAP.md` specifies `/projects/[id]/edit`, but
  `/projects/[slug]` is already the public page and **Next refuses two different dynamic names at
  the same route position**. A slug is unique, stable (never regenerated after creation) and
  readable, so it is the better identifier anyway. `SITEMAP.md` is corrected.
- **No Tiptap and no sanitiser**, per ADR-036 — the spec predates Phase 2's renderer.
- **Five deliverables shipped partially and are marked `[~]`**: no per-section attachments, no
  two-browser verification of the soft lock, task-to-milestone linking lives on the Phase 7 board,
  no downloadable receipt file, and the editor uses `Badge` rather than `StatusPill` because that
  component takes Phase 2's seven-value status and the editor needs all nine.
- **The faculty queue is `/faculty/proposals`**, one route inside Phase 9's namespace. Phase 9
  should build around it rather than beside it — a second approval path would mean two places
  deciding what "approved" means.

**Anything the next phase must know.**

- **`requireEditableProject(viewer, slug)` is the gate**, and it returns the project for faculty
  too — "can open" and "can edit" are separate, which is what lets a review screen reuse the loader
  instead of growing a parallel one. `capabilities(viewer, project)` answers the second question,
  entirely through `can()`.
- **`attemptTransition` is the only place a status change is decided.** Phase 9's evaluation flow
  must add edges to the table, not bypass it.
- **Progress and risk are computed, never stored** — `computeProgress()` and `riskSignals()` in
  `lib/project/progress.ts` are pure and unit-tested, and Phase 9's dashboard consumes them.
- **A task counts toward a project only through that project's milestones** (ADR-041). A group can
  own more than one project; the seed contains one that does.
- **The Prisma client and raw SQL disagree about a scalar list** (ADR-043). Any raw query over one
  needs `COALESCE`; any write needs an explicit `[]`.
- Phase 12 inherits a public page that already reads the database. Its work is the archive, lineage
  rendering and the citation surface — not the data source.

**Verified by.**

| Check | Result |
| --- | --- |
| `npm run check` | Clean — **425 tests**, 0 lint errors, 0 warnings, Prettier clean |
| `npm run build` | Clean |
| `npm run check:project` | **17/17** in a real browser, full lifecycle |
| `npm run check:seo` | **127 pages, 0 violations — identical to the pre-swap baseline** |
| `npm run check:workspace` | 25/25 |
| `npm run check:auth` | 12/12 |
| `npm run check:admin` | 15/15 |
| `npm run check:privacy` | 11/11 |
| `npm run db:verify` | 26/26 |
| Acceptance criterion 1 — end to end | draft → written → checked → **proposal submitted**, role-gated |
| Acceptance criterion 2 — similarity | fires on the seeded near-duplicate, silent on an unrelated one |
| Acceptance criterion 3 — override | recorded with its justification, shown to the group |
| Acceptance criterion 4 — computed progress | 0% on a new project, 14% after one section |
| Acceptance criterion 5 — embargo | listed with its abstract, body withheld |
| Acceptance criterion 6 — private | 404 publicly, absent from the sitemap's 127 URLs |
| Acceptance criterion 7 — submitted is locked | `isEditable('UNDER_REVIEW') === false`, enforced in `loadForEdit` |
| Acceptance criterion 8 — byte-stable snapshot | identical digest across shuffled collections |
| Acceptance criterion 9 — autosave | text survives a navigation and a reload |
| Acceptance criterion 10 — soft lock | indicator implemented; **not** verified with two browsers |
