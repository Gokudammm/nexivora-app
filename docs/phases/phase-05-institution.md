# Phase 5 — Institution Backbone

| | |
| --- | --- |
| **Status** | ✅ Complete |
| **Depends on** | Phase 4 ✅ complete 2026-09-09 |
| **Blocks** | Phases 7, 9, 15 |
| **Estimate** | 8 focused hours |
| **Started** | 2026-09-09 |
| **Completed** | 2026-09-09 |

## What Phase 3 already provides

*Added 2026-09-09, when Phase 3 completed. Check these before building — the most common way to
waste a phase is to rebuild something the previous one shipped.*

- **The whole hierarchy is seeded and queryable**: 3 colleges, 9 departments, 7 programmes, 41
  subjects, 12 terms, 82 classes, with enrolments and faculty assignments.
- **This phase's real job is the swap.** Public pages currently import from `@/content/*`; they
  move to `@/lib/db/queries/*`. **No rendered page may change.** `npm run db:verify` already
  asserts the anonymous query layer returns exactly the fixtures' public project set — keep that
  assertion passing and the swap is provably safe.
- **`visibleTo(viewer)` in `queries/projects.ts` is the pattern.** Add `queries/colleges.ts`,
  `queries/people.ts` and `queries/groups.ts` the same way. Never write a second visibility
  predicate.
- **College verification already gates indexability.** Greenfield is seeded unverified precisely so
  this is exercised by a real row.
- **Guests must be excluded from college directories and counts** — filter on
  `Membership.state <> 'GUEST'`.

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
- **Sessions, sign-in, registration and the institutional-domain association all work.** Registering
  on a college's declared `emailDomains` creates an `INVITED` membership; confirming the address
  activates it.
- **`visibleTo()` already covers college, class, faculty-subject and admin scope**, and
  `isolation.test.ts` asserts it agrees with `can()` on every seeded project. **Add each new
  scoped query to that agreement test** or the SQL and the policy can drift silently.
- **Guests must be filtered out of college directories and counts** — `Membership.state = 'GUEST'`.
  `collegeIds(viewer)` already excludes them; a hand-written query will not.

## Objective

Make a real college representable and manageable. Without this, groups have nothing to belong to,
faculty have nothing to teach, and the accreditation export has nothing to report on. It is
unglamorous and it is load-bearing.

## In scope

- The college admin console: departments, programmes, subjects, terms, classes
- Faculty assignment and the student roster
- Bulk CSV import with a dry-run preview
- Invitations, join codes and role assignment
- College profile, branding and the verification request
- The audit log
- The platform admin verification queue

## Out of scope

- Analytics and accreditation exports (Phase 15) · Inter-college anything (Phase 14)

## Deliverables

*`[x]` delivered · `[~]` delivered differently or in part, with a note saying how*

### Hierarchy management — `/admin/*`
- [x] `/admin` — overview: counts, pending invitations, verification state, recent audit entries
- [x] `/admin/departments` — CRUD, head assignment, code and description
- [~] `/admin/programmes` — CRUD, linked to a department, with duration and degree type
      — `saveProgramme` is built and audited; programmes are listed under their department. A
      separate screen would be the eleventh near-identical page this spec warns against.
- [x] `/admin/subjects` — CRUD, code, credits, programme and semester
- [x] `/admin/terms` — academic sessions with start and end dates, and **exactly one active term**
- [x] `/admin/classes` — create a class from (subject × term × section), assign faculty, enrol
      students
      — Enrolment is via the roster import's optional class step rather than a picker on this page.
- [x] `/admin/classes/[id]` — roster, assigned faculty, groups formed, project count
- [x] Cascade rules stated and enforced: a department with programmes cannot be deleted; archive
      instead of delete anywhere history matters

### People management
- [x] `/admin/people` — searchable, filterable roster (role, department, programme, year, state)
- [~] Per-person detail: memberships, enrolments, groups, projects, activity
      — Role, state and controls are on the roster row. A full person page belongs with Phase 6's
      profile work rather than being built twice.
- [x] Role assignment and change, with a forced token refresh (see the Phase 4 note)
- [x] Suspend and reinstate, with a required reason recorded in the audit log
- [~] Alumni transition — bulk, by graduating batch. **Workspace access ends; project authorship
      and portfolio persist forever.**
      — `transitionToAlumni` is written, audited, and ends workspace access via `leftAt` rather than
      deletion, so the ledger still resolves. Driving it needs Phase 6's roster multi-select.

### Bulk import
- [x] `/admin/people/import` — CSV upload with a downloadable template
- [x] Column mapping UI (real CSVs never match the template)
- [x] **Dry-run preview showing exactly what will be created, updated and skipped, with per-row
      errors, before anything is written.** No import commits without this step.
      — Computed twice on purpose (**ADR-031**): in the browser for speed, on the server for truth.
- [x] Duplicate detection by email and roll number
- [x] Import runs in a transaction; a partial failure rolls back
- [~] Import history with a downloadable error report
      — The error report downloads, with line numbers matching the source file. A persisted history
      of past imports is not built; each commit is recorded in the audit log instead.
- [x] The same pattern reused for the class-enrolment import
      — As an optional step of the people import rather than a second wizard.

### Invitations & joining
- [x] `/admin/invitations` — issue by email (single or bulk), with role and scope
- [x] Invitation states: pending, accepted, expired, revoked; 14-day expiry; resend
- [~] Join codes per class and per college, rotatable, with an optional usage cap
      — **Not built.** Email invitations cover the need; a shared rotatable code is a second, weaker
      way in and belongs with Phase 16's abuse controls.
- [x] `/join/[inviteCode]` — public landing that resolves the code, shows what is being joined, and
      routes to register or login
      — At `/join/[code]`. It shows the college, inviter and role **before** asking for anything: a
      link straight to a signup form is indistinguishable from phishing.
- [x] Rate limit: 200 invitations per day per admin

### College profile & verification
- [~] `/admin/college` — name, code, logo (SVG upload), accent colour, address, website,
      description, email domains, timezone
      — Everything except **logo upload and accent colour**, which need the storage layer (Phase 7).
- [x] Public college page (Phase 2's `/colleges/[slug]`) now reads from the database
      — And `/colleges` and the sitemap's college entries. `check:seo` passes 127/127, unchanged.
- [x] Verification request flow: submit institutional evidence → pending → verified or rejected
- [x] **Until verified: nothing from the college is publicly indexable and it does not appear in
      inter-college surfaces.** This is the anti-abuse gate and it must actually work.
      — Asserted against the seeded unverified college, including its absence from the sitemap.
- [x] `/platform` — the platform admin verification queue: review, approve, reject with a reason

### Audit log
- [x] `lib/audit.ts` — `logAudit(actor, action, subject, before, after)`
- [x] Called from **every** administrative mutation in this phase
- [~] `/admin/audit-log` — filterable by actor, action, subject and date; CSV export
      — Readable and filterable by action. **No CSV export** — that belongs with Phase 15, which
      already builds report generation.
- [x] Append-only: no update or delete path exists in the client wrapper

## Acceptance criteria

1. An admin builds a department, a programme, a subject, a term and a class, and enrols 50 students
   from a CSV, in one sitting without documentation.
2. The CSV dry-run correctly reports errors for a file with three deliberately malformed rows, and
   writes nothing.
3. A committed import of 500 rows completes in under 10 seconds.
4. An invitation email arrives (console transport), the link resolves, and the invitee lands in the
   right college with the right role.
5. An unverified college's projects carry `noindex` and are absent from the sitemap.
6. Every mutation in this phase appears in the audit log with the correct actor and diff.
7. A college admin cannot see or modify another college's data — verified by the Phase 4 test suite
   extended to these routes.
8. Suspending a member makes them read-only immediately, without a re-login.
9. The alumni transition preserves every project and portfolio entry.

## Key files this phase creates

```
src/app/(app)/admin/*            11 admin routes
src/app/(app)/platform/*         Verification queue
src/app/join/[code]/page.tsx     Public invite landing
src/lib/db/queries/institution.ts
src/lib/import/csv.ts            Parse, map, validate, dry-run, commit
src/lib/audit.ts                 logAudit() — called by every admin mutation
src/lib/invitations.ts
```

## Notes & risks

- **The dry-run preview is the single most important feature in this phase.** A bulk import that
  silently creates 500 wrong records is the fastest way to lose a college's trust permanently, and
  it is unrecoverable without a restore.
- **Real CSVs are messy.** Excel exports with a BOM, non-breaking spaces, `Roll No.` vs `RollNo`,
  smart quotes, blank trailing rows. Handle them, and test with a genuinely ugly file rather than
  one you generated.
- **Term is a model, not a string.** Every analytic and every accreditation report rolls up to a
  term; a text field here makes Phase 15 impossible.
- Archive, do not delete. A deleted subject orphans projects, evaluations and history. Archiving
  hides it from pickers while keeping every reference intact.
- The verification gate must be enforced in `resolveVisibility()`, not only in the UI — otherwise
  an unverified college's project leaks into the sitemap.
- A role change must invalidate the JWT. If it does not, an admin will change a role, nothing will
  happen, and the bug will look like a caching problem for an hour.
- This phase has a lot of similar forms. **Build one `ResourceForm` pattern and reuse it** rather
  than writing eleven near-identical pages.

---

## Phase Summary

**Status: complete, 2026-09-09.**

### What was built

| | |
| --- | --- |
| Admin routes | 11, plus the platform verification queue and the public `/join/[code]` landing |
| Query module | `queries/institution.ts` — colleges, hierarchy, roster, public directory |
| Mutations | 15 administrative actions, **every one audited inside its transaction** |
| Audit actions | 30 typed action names; `logAudit` has no update or delete path |
| Tests | **241 total** (+13 this phase: CSV parsing, the dry run, admin isolation, the verification gate) |
| Browser checks | `check:auth` 12/12 · **`check:admin` 15/15** |
| Import benchmark | 500 rows in **2.9s** against a 10s budget |
| Pages swapped to the database | `/colleges`, `/colleges/[slug]`, and the sitemap's college entries |

### Key decisions made

- **ADR-030 — a page swaps to the database when the phase that owns its data lands.** The 28 pages
  reading `src/content/` are three different things: editorial copy that stays there permanently,
  database-backed pages that swap in their owning phase, and nothing swapping ahead of its phase.
- **ADR-031 — the import dry run is computed twice.** In the browser for speed (9ms for 500 rows),
  on the server from the same file for truth. Sending the plan would make the preview theatre.
- **ADR-032 — adapters carry the swap, not component rewrites.** Changing the components and the
  data source in one commit is the change nobody can review.
- **Archive, never delete**, and refuse when children would be orphaned — archiving a department
  silently along with its six programmes is the cascade everybody regrets.
- **Exactly one active term**, enforced in a transaction. "Which term is it" is read by the
  dashboard, the class pickers and every Phase 15 roll-up; two active terms makes it unanswerable.
- **A suspension requires a reason**, recorded in the audit log. A suspension nobody can explain
  later is the one that gets disputed.
- **Sessions being database-backed (ADR-027) removed a problem the spec anticipated.** It warned
  that a role change must invalidate the JWT or "an admin will change a role, nothing will happen,
  and the bug will look like a caching problem for an hour". There is no JWT: the viewer is rebuilt
  from the database each request, so a role change and a suspension are both in force on the
  member's very next request. Acceptance criterion 8 is satisfied by the architecture rather than by
  a cache-busting mechanism.

### Import edge cases found and handled

Tested against a deliberately horrible fixture rather than a generated one, as the spec insisted.
Two of these were **found by the test failing**, not anticipated:

| Case | Handling |
| --- | --- |
| Excel's UTF-8 BOM | Stripped; otherwise the first header silently never matches |
| CRLF and lone CR | Normalised |
| Non-breaking spaces, zero-width characters | Stripped — invisible in every editor, which is what makes them expensive |
| Smart quotes | Normalised, so `"Roll No."` matches `Roll No.` |
| Quoted field containing the delimiter | Parsed correctly |
| **Excel's `="0022071"` wrapper** | **Bug found by the test.** The parser treated *any* quote as a delimiter; RFC 4180 quotes only at field start. Fixed, and the leading zero survives |
| **Scientific notation (`2.2008E+04`)** | **Refused, not converted.** Excel has already lost digits; importing a silently truncated roll number is worse than a failed import because nobody notices |
| Ragged rows | Reported with line numbers rather than shifting columns |
| Blank trailing rows | Counted and skipped (the test's own expectation was off by one — the file ends with a newline) |
| Duplicate email within the file | Rejected, naming the earlier line |
| Roll number already held by a different email | Rejected — one of the two records is wrong and guessing which is not ours to do |
| Unreadable year, unknown role | Warned, not failed; the row still imports |

Errors are per-row, so a file with three bad rows imports the rest and produces a downloadable
report whose **line numbers match the original file** — the only thing that makes it actionable.

### Deviations from the spec above, and why

1. **`/admin/programmes` has no page of its own.** `saveProgramme` exists and is audited, and
   programmes are shown under their department. A separate CRUD screen for the one entity that is
   always viewed in the context of its parent would be the eleventh near-identical page the spec
   itself warned against building.
2. **Join codes per class and per college are not built.** Email invitations, the fourteen-day
   expiry, revocation, the daily limit and `/join/[code]` all are. A rotatable shared code is a
   second, weaker way in, and it is worth designing alongside Phase 16's abuse controls rather than
   bolting on now.
3. **No CSV export of the audit log**, and no filter UI beyond `?action=`. The log is readable and
   queryable; export belongs with the Phase 15 reporting work that already builds CSV generation.
4. **Logo upload and accent colour are not editable.** Both need the storage layer, which is Phase 7.
   Every other college profile field is.
5. **The bulk alumni transition has an action but no dedicated screen.** `transitionToAlumni` is
   written, audited, and preserves group history via `leftAt` rather than deletion; driving it needs
   a roster multi-select, which is Phase 6's people work.
6. **`/admin` is one console for one college.** An administrator of two picks the first; a college
   switcher is genuinely rare and would complicate every page for it.

### Anything the next phase must know

- **`administeredCollegeIds(viewer)` resolves the college once, in the admin layout.** No child page
  asks the question again, so none of them can get a different answer.
- **Every admin mutation goes through `guard(collegeId, action)`** — it refuses anything outside the
  college being changed, identically whether that college exists or not.
- **`logAudit` takes the transaction client.** Pass it. An audit row that survives a rolled-back
  change is a lie; one lost when the change succeeds is worse.
- **Add every new scoped query to `institution.test.ts`.** It calls each one as an administrator of
  the *wrong* college and asserts empty, with a positive control — a predicate that returned nothing
  at all would otherwise pass every isolation assertion in the file.
- **`toContentProjectCard()` is how a database row reaches a Phase 2 component.** When Phase 8 swaps
  the project pages, extend the adapter rather than rewriting the components.
- **The public site is deliberately mixed** — colleges from the database, projects from fixtures.
  They agree because `db:verify` asserts they do. Phase 8 removes the need.

### Verified by

| Check | Result |
| --- | --- |
| `npm run check` | Clean — typecheck (both tsconfigs), 0 lint errors, 0 warnings, Prettier clean, **241 tests**, 94 contrast pairs |
| `npm run build` | Clean |
| `npm run db:reset` / `db:verify` | 3.2s · **26/26** |
| **`npm run check:seo`** | **127 pages, 0 violations — identical to the pre-swap baseline** |
| `npm run check:auth` | 12/12 |
| **`npm run check:admin`** | **15/15** — console reachable, every section renders, a create round-trips *and appears in the audit log*, and a college admin cannot reach the platform queue |
| **`npm run bench:import`** | 500 rows: parse 13ms · dry run 9ms · commit 2.4s · **total 2.9s of a 10s budget**, rolled back |
| Cross-college isolation | Every admin query called as the wrong college's administrator returns empty, with a positive control; a class id from another college resolves to null |
| Guest containment | A `GUEST` membership naming `COLLEGE_ADMIN` grants nothing (ADR-022) |
| Verification gate | Unverified Greenfield: absent from the directory, absent from the sitemap (2 college URLs, 0 Greenfield), `getCollege` returns null publicly — **and still visible to its own members** |
| Route gating | `/admin`, `/platform`, `/admin/people/import` all 307 to sign-in when signed out; `/join/[code]` is public and answers 200 for an unknown code with a real explanation |
