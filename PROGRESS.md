# PROGRESS — Nexivora Live Status Board

**Last updated:** 2026-09-11 · **Current phase:** Phase 10 — Academic Feed & Notifications

> This file is the source of truth for *where we are*. Update it at the end of every work session.
> Detail lives in `docs/phases/`; this is the dashboard.

---

## Overall

```
MVP CONTRACT  (Phases 0-12)
Phase  0  ██████████████████████████  ✅ Complete
Phase  1  ██████████████████████████  ✅ Complete
Phase  2  ██████████████████████████  ✅ Complete
Phase  3  ██████████████████████████  ✅ Complete
Phase  4  ██████████████████████████  ✅ Complete
Phase  5  ██████████████████████████  ✅ Complete
Phase  6  ██████████████████████████  ✅ Complete
Phase  7  ██████████████████████████  ✅ Complete
Phase  8  ██████████████████████████  ✅ Complete
Phase  9  ██████████████████████████  ✅ Complete
Phase 10  ░░░░░░░░░░░░░░░░░░░░░░░░░░  ⬜ Not Started   <- next
Phase 11  ░░░░░░░░░░░░░░░░░░░░░░░░░░  ⬜ Not Started
Phase 12  ░░░░░░░░░░░░░░░░░░░░░░░░░░  ⬜ Not Started

EXPANSION
Phase 13  ░░░░░░░░░░░░░░░░░░░░░░░░░░  ⬜ Not Started
Phase 14  ░░░░░░░░░░░░░░░░░░░░░░░░░░  ⬜ Not Started
Phase 15  ░░░░░░░░░░░░░░░░░░░░░░░░░░  ⬜ Not Started

PRODUCTION
Phase 16  ░░░░░░░░░░░░░░░░░░░░░░░░░░  ⬜ Not Started
Phase 17  ░░░░░░░░░░░░░░░░░░░░░░░░░░  ⬜ Not Started

AI + LAUNCH
Phase 18  ░░░░░░░░░░░░░░░░░░░░░░░░░░  ⬜ Not Started
Phase 19  ░░░░░░░░░░░░░░░░░░░░░░░░░░  ⬜ Not Started
```

**Completed:** 10 / 20 phases · **MVP progress:** 10 / 13 phases

---

## Status table

| # | Phase | Status | Started | Completed | Summary written | Spec |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | Foundation & Project Setup | ✅ Complete | 2026-09-08 | 2026-09-08 | ✅ | [spec](docs/phases/phase-00-foundation.md) |
| 1 | Design System & Brand | ✅ Complete | 2026-09-08 | 2026-09-08 | ✅ | [spec](docs/phases/phase-01-design-system.md) |
| 2 | Public Site & SEO Core | ✅ Complete | 2026-09-09 | 2026-09-09 | ✅ | [spec](docs/phases/phase-02-public-seo.md) |
| 3 | Data Model, Taxonomy & Seed | ✅ Complete | 2026-09-09 | 2026-09-09 | ✅ | [spec](docs/phases/phase-03-data-model.md) |
| 4 | Auth, Roles & RBAC | ✅ Complete | 2026-09-09 | 2026-09-09 | ✅ | [spec](docs/phases/phase-04-auth-rbac.md) |
| 5 | Institution Backbone | ✅ Complete | 2026-09-09 | 2026-09-09 | ✅ | [spec](docs/phases/phase-05-institution.md) |
| 6 | Profiles & Academic Identity | ✅ Complete | 2026-09-09 | 2026-09-09 | ✅ | [spec](docs/phases/phase-06-profiles.md) |
| 7 | Groups & Project Workspace | ✅ Complete | 2026-09-10 | 2026-09-10 | ✅ | [spec](docs/phases/phase-07-workspace.md) |
| 8 | Project Lifecycle & Pages | ✅ Complete | 2026-09-10 | 2026-09-10 | ✅ | [spec](docs/phases/phase-08-project-lifecycle.md) |
| 9 | Faculty Review & Evaluation | ✅ Complete | 2026-09-11 | 2026-09-11 | ✅ | [spec](docs/phases/phase-09-faculty.md) |
| 10 | Academic Feed & Notifications | 🟦 Next | — | — | ⬜ | [spec](docs/phases/phase-10-feed.md) |
| 11 | Discovery, Ideas & Matching | ⬜ Not Started | — | — | ⬜ | [spec](docs/phases/phase-11-discovery.md) |
| 12 | Showcase, Archive & Portfolio | ⬜ Not Started | — | — | ⬜ | [spec](docs/phases/phase-12-showcase-archive.md) |
| 13 | Alumni & Company Network | ⬜ Not Started | — | — | ⬜ | [spec](docs/phases/phase-13-alumni-companies.md) |
| 14 | Inter-College, Events & Global | ⬜ Not Started | — | — | ⬜ | [spec](docs/phases/phase-14-intercollege-events.md) |
| 15 | Analytics & Accreditation | ⬜ Not Started | — | — | ⬜ | [spec](docs/phases/phase-15-analytics.md) |
| 16 | Hardening | ⬜ Not Started | — | — | ⬜ | [spec](docs/phases/phase-16-hardening.md) |
| 17 | Deployment & Operations | ⬜ Not Started | — | — | ⬜ | [spec](docs/phases/phase-17-deployment.md) |
| 18 | AI Assistant Layer | ⬜ Not Started | — | — | ⬜ | [spec](docs/phases/phase-18-ai-assistant.md) |
| 19 | Launch & Pitch Pack | ⬜ Not Started | — | — | ⬜ | [spec](docs/phases/phase-19-launch-pack.md) |

---

## Session log

Append one entry per working session. Newest first.

### 2026-09-11 — Session 12

**Phase 9 — Faculty Review & Evaluation. Complete.**

Eight faculty routes, the evaluation screen, the credential mechanism, the public verifier, and the
student-facing half that turned out to be missing.

**Built.**

- `config/health.ts` — five thresholds as configuration with a per-college override map.
  `SIGNAL_RANK` makes the panel a work queue rather than an inventory.
- `lib/ledger/health.ts` rewritten — ranked `HealthSignal[]`, each with a message that concludes
  nothing about a person, the evidence behind it, and an action. `AUDIENCE_FRAMING` gives faculty
  and the group different headings over identical data (**ADR-045**).
- `lib/evaluation/{rubric,score,attestation}.ts` — 48 unit tests. `totalFor()` normalises by weight
  actually scored, so a partial evaluation is not a fail; `canRelease()` returns **every** problem
  at once rather than one per round trip.
- `lib/evaluation/{actions,attestation-actions,announcements}.ts` — versioning on save, the
  re-release refusal, attestation issue/revoke, announcements and the class deadline broadcast.
- `lib/db/queries/{faculty,health,feedback}.ts` — one batched read for fifteen groups; a
  single-group shape for the group's own page; and the released-feedback query whose filter is in
  the `where` clause, not the render.
- Routes: `/faculty` · `/submissions` · `/groups` · `/classes` · `/classes/[id]` · `/rubrics` ·
  `/attestations` · `/announcements`, plus `/projects/[slug]/review`.
- `prisma/seed/faculty.ts` — the faculty desk had no data of its own: zero submissions, zero
  announcements, zero open blockers.
- `scripts/check-faculty.mjs` — 32 assertions in a real browser. `npm run check:faculty`.

**Three defects found by looking at the thing, not by a check.**

1. **`forbidden()` returned 500, everywhere, since Phase 5** (**ADR-048**). Twenty-one guards call
   it; `experimental.authInterrupts` was never enabled. Invisible on the happy path, because the
   guard only runs for a user who is denied and that is never the user a check signs in as. Now
   enabled, with `src/app/forbidden.tsx`.
2. **`/faculty` flagged four groups out of four** (**ADR-046**), three of them because their project
   was delivered months ago. Every test passed and the arithmetic was right. `HealthInput.active`
   now silences the "nothing is happening" signals on finished work; blockers and slipped milestones
   still fire. Also **ADR-047**: the seed rebases in-flight activity onto the last ten weeks, because
   a demo world anchored to fixed dates makes any time-sensitive feature look broken.
3. **Eight seeded attestations were unverifiable** (**ADR-050**). The seed issued `NXV-ATT-0001`,
   which `isAttestationCode()` rejects. Now generated in the real format from the seeded RNG.

**And one found by the check, from the right seat.** Criterion 9 is *"draft feedback is invisible to
students until released"*. Asserting it from the student's seat showed that a **released** round was
also invisible — the evaluation existed in the database and in no interface. `/projects/[slug]/feedback`
is the other half (**ADR-049**), and `/verify` is the public half of the attestation code
(**ADR-050**).

**Corrections to my own work.** `check-faculty.mjs` first asserted "faculty cannot upload a file" and
failed against a correct product: the spec says faculty **can** add feedback, comment and create
tasks, and cannot *edit sections* or *delete files*. It had also matched the discussion page's own
empty-state prose rather than any control — the Phase 7 avatar-hint trap again. Both halves of
criterion 7 are now asserted, including the deliberate permission.

**Verified.** typecheck · lint · format · 491 tests · contrast · chart palette · build (174 static
pages) · `db:verify` 26/26 · `check:faculty` 32/32 · `check:privacy` 11/11 · `check:seo` 127/127 ·
`check:project` 17/17 · `check:workspace` 25/25 · `check:auth` 12/12 · `check:admin` 15/15.
Screenshots of six routes in both themes, looked at.

**Two process facts worth more than the code.**

- **The browser checks must run against `npm run start`.** Under `npm run dev` the sitemap sweep
  reported a different random set of 500s on every run (Turbopack compiling on demand under parallel
  load) and the workspace latency budget measured 1294ms against 800ms. All clean in production.
- **Seed before you build.** `/projects/[slug]` uses `generateStaticParams` with
  `dynamicParams = false`, so reseeding after a build leaves prerendered project pages 404ing.

**Fixed along the way.** `check-admin.mjs` never cleared cookies between runs and reported the
resulting failure as the single word "Uncaught" — both fixed, matching `check-workspace.mjs`.
`scripts/screenshot.mjs` gained `--as <email>`, because from Phase 7 onward a screenshot without a
session is a screenshot of the login page.


### 2026-09-10 — Session 11

**Phase 8 complete.** The project record, the lifecycle, and the swap of every public project page
onto the database.

- **The public swap changed nothing observable, which was the whole bar.** Seven pages and the
  sitemap now read rows; `check:seo` returns **127 pages, 247 JSON-LD blocks, 127 unique titles —
  identical to the pre-swap baseline**. What made it a swap rather than a rewrite is **ADR-042**: the
  derived views — lineage, related work, the explore facets — moved to `content/derive.ts` as pure
  functions over a corpus you supply, so the fixtures and the database call **the same
  implementation**. Writing a database version of "related projects" is how two of them end up
  disagreeing about what related means.
- **`check:project` found a real bug on its first run, against a criterion I had written casually.**
  "Progress starts at 0%" — a brand-new project opened at **26%**. A group may own more than one
  project, and the seed contains one that does, so the new project was inheriting its sibling's
  eighteen closed tasks. Tasks now count only through **that project's own milestones**
  (**ADR-041**), which also gives the spec's own phrase — *"a milestone links to the tasks that
  constitute it"* — something to mean.
- **The Prisma client and raw SQL disagree about a scalar list, and it cost an hour** (**ADR-043**).
  The similarity check threw `Cannot read properties of null` the first time it ran against a
  project created through the *interface* rather than the seed. `Project.techStack` is `String[]`;
  Prisma's client returns `[]` when the column holds `NULL`, so every typed read looks fine — but
  **Prisma gives scalar lists no database default**, so a row created without the field really does
  store `NULL`. Phase 3's raw query already coalesced the topics subquery and did not coalesce this
  one. Fixed on both sides: `COALESCE` in the SQL, explicit `[]` on the write.
  - Worth naming: this is the **second** defect found only by exercising a path the seed does not
    produce. The seed is a good demo world and a poor adversary.
- **The lifecycle is a table, and the refusal is the feature.** Nine states, thirteen edges, the
  actor each requires. `moveProject` asks two separate questions in order — *is this move legal*,
  then *may you make it* — because conflating them produces "you cannot do that" when the honest
  answer is "nobody can do that yet, and here is why". A blocked submission names every incomplete
  section, every open milestone and every person who still owes a peer review, **all at once**: a
  submission blocked one reason at a time is the shape that makes people submit at 3am and blame
  the tool.
- **`[slug]`, not `[id]`, under `/projects`** — forced by Next, which refuses two different dynamic
  names at the same route position, and better anyway. `SITEMAP.md` is corrected.
- **Section guidance is the highest-value thing in the phase and it is thirty lines of
  configuration** (**ADR-044**). Each section carries a prompt, two or three questions and a real
  example, sitting beside the textarea permanently. The questions are the load-bearing part: a
  student who answers "Who has this problem, specifically?" has written a problem statement whether
  or not they knew how to start one.
- **Looking at the screenshots found a defect every check had passed** (process lesson 1, again).
  The editor shell sat at `[slug]/edit/`, so the tabs it renders linked to Milestones, Proposal and
  Submit — three pages that then rendered **without the tabs**. Every link navigated the user out of
  the navigation. Moved to `[slug]/`; the public page is in `(site)` and unaffected.
- **Two test-side failures that were mine, not the product's**: the sample problem statement was 38
  words against a 60-word completeness floor, so the toggle was correctly disabled; and the
  `/explore` assertion looked for "Explore", which appears only in the `<title>` that `innerText`
  does not include.
- **The migration was two things the schema lacked**: `Project.coverUrl` (Phase 7's hand-off) and
  `ProjectSectionVersion`, because "restore a previous version" needs versions to exist. A separate
  table rather than a JSON column — a growing blob rewritten on every autosave is what turns a 200ms
  save into a 2s one around week six.
- Verified: `npm run check` clean (**425 tests**), build clean, `check:project` **17/17**,
  `check:seo` **127/127 unchanged**, `check:workspace` 25/25, `check:auth` 12/12, `check:admin`
  15/15, `check:privacy` 11/11, `db:verify` 26/26.
- **Not done and not claimed:** no per-section attachments (the group file library is one click
  away and a second copy would diverge); the soft lock is implemented and **not verified with two
  simultaneous browsers**; task-to-milestone linking stays on the Phase 7 board; the submission
  receipt has a digest but is not a downloadable file (that is a PDF, and `lib/pdf/` is Phase 15);
  and the editor uses `Badge` rather than `StatusPill`, because that component takes Phase 2's
  seven-value status and the editor needs all nine.
- **Next:** Phase 9 — faculty review and evaluation. It consumes `groupHealth()` from Phase 7 and
  `riskSignals()` from this phase, and must add its edges to the transition table rather than
  bypassing it.

### 2026-09-10 — Session 10

**Phase 7 complete.** The workspace, the ledger, and the storage layer three earlier phases were
waiting on.

- **The ledger's transaction boundary is a type, not a convention** (**ADR-038**). `recordLedgerEvent`
  takes an interactive-transaction client — a shape `db` does not satisfy — so writing an event
  outside the transaction that produced it does not compile. There is no update and no delete
  anywhere in the module; reopening a task, trashing a file and deleting a done task all write
  **compensating events** with negative weights. Acceptance criterion 8 falls out of the signature.
- **The board's keyboard menu was built first, and that removed the drag library entirely**
  (**ADR-039**). Every card has a real `<button aria-haspopup="menu">` whose items call the same
  handler a drop calls, so the native HTML5 drag events are ~20 lines layered over a control that
  already works. Measured in a real browser: **66ms** from keypress to the card landing, reconciled
  rather than reverted on reload.
- **The chart palette needed measuring, and measuring found a real defect** (**ADR-037**). Phase 1's
  eight-colour domain set is contrast-checked — the right test for a badge, the wrong one for a
  chart. Two of its colours separate by **ΔE 5.7 under deuteranopia** against a target of 8, which
  is invisible to me and unreadable to roughly one man in twelve. Its dark variants are worse: all
  eight sit above the lightness band a chart mark needs. A separate six-slot `--color-series-*` set
  now clears every check in both themes (**ΔE 21.0 / 19.3**), and `npm run check:chart-palette` is
  wired into `npm run check` so it cannot regress.
  - And a real limit, found by searching the space rather than assuming: **no six-slot palette
    clears the all-pairs target inside the dark band.** The best reaches 6.3. So the contribution
    timeline is **small multiples with a name on every row** rather than six overlaid lines — which
    reads better anyway.
- **Tiptap and the sanitiser were both dropped** (**ADR-036**). The spec and `docs/SECURITY.md` §3
  both called for them, and both predate Phase 2's markdown renderer — which emits React elements
  and has no HTML path at all. Adding Tiptap would *create* the hole a sanitiser then closes. Three
  dependencies avoided, one renderer for four surfaces, and §3 corrected rather than left to mislead.
- **The end-to-end check found four things, and none of them were in the code I had just written:**
  - **The seed had 90 file rows and zero bytes on disk** (**ADR-040**). Every seeded file 404'd. The
    route was right; the demo world was lying. Found because the check asserts its **positive
    control first** — *"a member can fetch their own group's file"* — which is exactly why a denial
    suite needs one. The seed now writes 134 real objects, including a hand-built ZIP with a
    computed CRC-32, because a demo file that would fail our own upload validator is a trap.
  - **`check:auth` had been pointing at port 3001 since blocker B-2** — a leftover from when another
    project held 3000. It was not failing; it was reporting **nothing at all**. Now 3000, matching
    every other script and `NEXT_PUBLIC_SITE_URL`.
  - **The first version of the keyboard assertion selected on `aria-haspopup=menu` and matched the
    header's theme toggle**, reporting a pass against a control with nothing to do with the board.
    It now drives explicit `data-task-menu` / `data-column` / `data-move-to` hooks.
  - **My own hint text failed my own check.** The avatar assertion matched "not accepted" anywhere
    on the page and caught the form's static "SVG is not accepted…" copy, reporting a refusal on an
    upload that had succeeded. Scoped to `[role=alert]`.
- **Looking at screenshots found three defects every check had passed** (process lesson 1, again).
  The board stretched to **2335px** because a grid sizes to its tallest child and "Done" held 18
  cards — four empty columns two screens tall, with the ledger link buried under them. Columns now
  scroll internally. The fifth column also opened half off-screen at 1440px, so `minmax` came down
  from 15rem to 13rem: a board whose whole point is seeing every column at once loses it to a
  horizontal scroll nobody performs. And the ledger's sparklines, at 24px tall stretched to ~930px,
  read as **flat lines while rising through their entire range** — correct, and communicating
  nothing. This is the dataviz procedure's last step, and it earned its place.
- **A stale `next start` cost the most time of anything today** — and it is the trap Phase 5 wrote
  down. `pkill` does not kill it on Windows, so the rebuild ran, the new server failed to bind, and
  the old one kept answering. Four failures looked like a broken board; the DOM had no `data-task`
  attributes because it was a build from an hour earlier. **Use `Get-NetTCPConnection -LocalPort
  3000` and `Stop-Process`, and read the start log before believing a failure.**
- **Two build failures that typecheck cannot catch, both now structural:** a client component
  importing a constant from `lib/db/queries/*` pulls `pg` into the browser bundle, and a
  `"use server"` file may export **only async functions** — a number export fails the build.
  `config/tasks.ts` and `config/storage.ts` exist for those reasons, and the reasons are in the
  files.
- **A test of mine was wrong and the code was right, again.** The workspace fixture searched for
  faculty assigned to the group's own *class*; faculty scope is per **subject** (ADR-029), and the
  seed assigns them through a different class of the same subject — which is what the model intends.
- **`check:admin` only ever passed once per database, and had done since Phase 5.** It creates a
  department with a random name and the **fixed code `CHK`**, which is unique per college — so every
  run after the first collided. It failed quietly, because the assertion that follows it looks for
  `department.create` in the audit log and kept finding the *first* run's entry. Both the name and
  the code are now per-run, and it passes twice in a row.
- **Three earlier phases' hand-offs are closed**: the storage layer, avatar upload (Phase 6), and
  the college logo and accent colour (Phase 5). All three were explicitly deferred to "when storage
  exists", and it does now.
- Verified: `npm run check` clean (**350 tests**), build clean, `check:workspace` **25/25**,
  `check:seo` **127/127** (unchanged), `check:auth` 12/12, `check:admin` 15/15, `check:privacy`
  11/11, `db:verify` 26/26, chart palette clean in both themes.
- **Not done and not claimed:** no unread indicators and no "request to join" — both are
  notifications, which Phase 10 owns. No task checklist, no inline-on-column create, no file grid or
  folder browsing, no resumable upload, no syntax highlighting in previews; all marked `[~]` in the
  phase file rather than ticked. **No cover image** — Phase 6's note assumed `User` had a cover
  column and it does not; that belongs with Phase 8, where a cover is actually rendered.
- **Next:** Phase 8 — the project record itself: sections, lifecycle, approval, lineage and the
  duplicate check Phase 3's scorer was built for.

### 2026-09-09 — Session 9

**Phase 6 complete.** Academic identity, backed by evidence and private by default.

- **Privacy is enforced by not querying** (**ADR-033**). An unentitled field is never read from the
  database, so it cannot reach the markup, the RSC payload or "view source" by any route a later
  page edit might open. Separate queries rather than conditional spreads — partly because **Prisma
  cannot infer a conditionally-spread `select`** and the first version compiled to the *full* model
  type, which is exactly the shape that invites rendering a withheld field.
- **`npm run check:privacy` — 11/11 on the wire.** Acceptance criterion 2 asks for the assertion to
  be made on the HTML a logged-out visitor receives, so it is: email and roll number absent, private
  and unknown usernames indistinguishable, both `noindex`, private absent from the sitemap, and
  going private taking effect on the very next request.
- **A private profile is indistinguishable from one that does not exist** (**ADR-034**) — same page,
  title, robots directive and status. Anything else enumerates the students of a named institution.
- **Skills come from projects, and the difference is shown** (**ADR-035**). Drafts do not count, so a
  skill cannot be manufactured with an empty project; stack noise is dropped; strength means *how
  much evidence*, never *how good*. A claim the projects corroborate is promoted; one they do not is
  kept and clearly marked.
- **The profile page swap changed nothing observable** — `check:seo` still 127/127.
- **The tests found three real defects**, none of which I reasoned my way to:
  - **Five routes were unreservable** (`for-students` and its four siblings). The test reads the
    route list off the filesystem rather than asserting the reserved set against itself, so it will
    catch the next one too.
  - **`checkUsername("Ananya")` passed**, because it lowercased its own input — an unnormalised
    string could then reach the database and collide case-insensitively with an existing `ananya`
    while passing a case-sensitive uniqueness check. Normalisation is now a separate function.
  - **One of my tests was wrong and the code was right.** The indexability test looked for "a public
    profile at an unverified college" and found `arjun-rao`, who also belongs to two verified
    colleges and is therefore legitimately indexable. It now constructs the condition rather than
    hoping the seed contains it.
- **And one thing that looked like a leak and was not.** The private and unknown responses differ by
  ~1.2 KB — but requesting the *same* URL twice differs by as much, for existing and fake names
  alike. Next streams metadata and its position varies per request. `check:privacy` compares
  rendered content and deliberately **does not** compare byte counts, with a comment so nobody
  re-adds that assertion and chases a phantom.
- **The Phase 4 hand-off is closed:** onboarding answers now become real profile rows on completion,
  inside a transaction and idempotently.
- Verified: `npm run check` clean (**276 tests**), build clean, `db:verify` 26/26,
  `check:seo` 127/127, `check:privacy` 11/11, `check:auth` 12/12, `check:admin` 15/15.
- **Not done and not claimed:** avatar and cover upload need Phase 7's signed file route. `Follow`
  is complete and tested but has no UI — the control belongs on Phase 10's feed and profile
  surfaces. `CONNECTIONS` visibility waits for the follow graph to mean something. The company and
  researcher editing forms belong with Phases 13 and 14. No activity section until there is a feed.
- **One consequence worth knowing:** `/p/[username]` is now **dynamic rather than prerendered**.
  Reading the session is what lets a classmate see a college-visible profile the public cannot, and
  `cookies()` forces dynamic rendering. SSR still returns complete HTML and the SEO contract still
  passes.
- **Fixed a false failure in `check:seo` itself.** Inline SVGs carry accessibility `<title>`
  elements, and because Next streams metadata those can arrive *before* the document title — so the
  checker reported a project card's "Cover image for …" as a 63-character page title on a profile
  whose real title is 20. It now strips SVG content before matching, which removes a class of false
  failures on every page with a project card.
- **Next:** Phase 7 — groups and the project workspace. The heart of the product.


### 2026-09-09 — Session 8

**Phase 5 complete.** The institution backbone, and the first pages moved onto the database.

- **The swap changed nothing observable**, which was the whole bar. `/colleges`,
  `/colleges/[slug]` and the sitemap's college entries now read the database; `check:seo` passes
  **127 pages, 0 violations — identical to the pre-swap baseline**.
- **Scoped the swap deliberately (ADR-030).** The 28 pages reading `src/content/` are three
  different things: editorial copy that stays there permanently, database-backed pages that swap in
  the phase that *creates* their data, and nothing swapping ahead of its phase. Building query
  modules for people and ideas now would invert the content-first architecture.
- **Adapters carry the swap, not component rewrites (ADR-032).** Changing the components and the
  data source in one commit is the change nobody can review — if a page renders differently
  afterwards, nothing tells you which half did it.
- **The CSV import is the piece that mattered**, and the ugly-file test earned its keep twice:
  - **A real parser bug.** Excel's `="0022071"` wrapper came out as `=0022071` because the
    parser treated *any* quote as a delimiter. RFC 4180 quotes only at field start. Fixed, leading
    zero intact.
  - **Scientific notation is refused, not converted.** `2.2008E+04` means Excel has already lost
    digits; importing a silently truncated roll number is worse than a failed import, because nobody
    notices it.
- **The dry run is computed twice on purpose (ADR-031)** — in the browser for speed, on the server
  from the same file for truth. Sending the plan would make the preview theatre. Measured: parse
  13ms, plan 9ms, commit 2.4s, **2.9s total for 500 rows against a 10s budget**.
- **Every administrative mutation writes an audit entry inside its own transaction.** An audit row
  that survives a rolled-back change is a lie; one lost when the change succeeds is worse.
  `check:admin` proves the round trip: create a department, find it in the log.
- **A problem the spec anticipated did not exist.** It warned that a role change must invalidate the
  JWT or the bug "will look like a caching problem for an hour". There is no JWT (ADR-027): the
  viewer is rebuilt from the database each request, so role changes and suspensions take effect on
  the very next one. Acceptance criterion 8 falls out of the architecture.
- **`npm run check:admin` — 15/15** in a real browser: the console, every section, a write that
  round-trips through the audit log, and a college admin refused the platform verification queue.
- **The verification gate is real**: unverified Greenfield is absent from the directory, absent from
  the sitemap (2 college URLs, 0 Greenfield), returns null publicly — **and is still visible to its
  own members**, which is what makes it a quality control rather than a barrier to entry.
- **Two traps recorded:** `check:seo` cannot run against `next dev` — the crawler's concurrent
  first-compile load makes Turbopack throw an opaque `Unexpected end of JSON input` on unrelated
  pages. And a stale `next start` silently keeps port 3000, so a "failing" new route was really an
  old server; check the start log before believing a 404.
- Verified: `npm run check` clean (**241 tests**, 0 lint errors, 0 warnings), build clean,
  `db:verify` 26/26, `check:seo` 127/127, `check:auth` 12/12, `check:admin` 15/15,
  `bench:import` 2.9s.
- **Not done and not claimed:** join codes are not built (email invitations cover it; a shared
  rotatable code belongs with Phase 16's abuse controls). No CSV export of the audit log (Phase 15
  owns report generation). Logo upload and accent colour need storage (Phase 7). The alumni
  transition action is written and audited but has no bulk screen — that needs Phase 6's roster
  multi-select. Programmes have no separate CRUD page by choice.
- **Next:** Phase 6 — profiles and academic identity, including turning the onboarding answers that
  Phase 4 collected into real profile rows.


### 2026-09-09 — Session 7

**Phase 4 complete.** The authorisation layer every later phase depends on.

- **`can()` is the whole point of this phase.** 41 actions, one implementation, **100 matrix
  assertions** written to be read against `docs/ROLES-PERMISSIONS.md`, plus a cross-college sweep
  that is **exhaustive over the action union** — so an action added later is covered whether or not
  anyone remembers to add a row.
- **Cross-college isolation is tested at the data layer with the proxy disabled** (acceptance
  criterion 3), against the seeded database. It has a positive control: a policy that denied
  everything would otherwise pass every denial assertion in the file.
- **`visibleTo()` and `can('project:read')` are asserted to agree** on every seeded project for
  every viewer. They are written separately — one in SQL, one in TypeScript — and nothing else would
  stop them drifting. A drift one way leaks; the other way it produces mystery 404s.
- **Two deliberate departures from the spec, both from checking rather than assuming.**
  - *bcrypt → scrypt* (**ADR-026**). Phase 3 had seeded 87 accounts with scrypt; bcrypt would lock
    them all out. And scrypt is not the weaker choice — it is memory-hard, bcrypt is not. Parameters
    live inside the hash and upgrade on sign-in: verified, the seeded hash moved from N=2¹⁴ to
    N=2¹⁷ on first login.
  - *Auth.js → a purpose-built session layer* (**ADR-027**). Auth.js v5 is still
    `5.0.0-beta.32`, and **its Credentials provider cannot use database sessions** — which makes
    per-device revoke and sign-out-everywhere, two of this phase's own acceptance criteria,
    impossible with it. Thirty seconds of `npm view` and one documentation page.
- **`npm run check:auth` drives a real browser** through gating, a wrong password, a correct
  sign-in, the device list and sign-out: **12/12**. It asserts behaviour, not status codes — the
  session cookie is httpOnly, SameSite=Lax and invisible to `document.cookie`.
- **No `viewer.role`** (**ADR-029**). Roles are per membership; faculty scope is per *subject*.
  A single role column would break the alumni transition and the multi-college case.
- **The proxy is a convenience, not the boundary** (**ADR-028**). It gates by authentication and
  carries the return path; role decisions live at the data layer, where a database exists.
- Auth flows never reveal whether an account exists — including a decoy hash on sign-in, so a
  missing account does not answer measurably faster than a wrong password.
- **Three traps recorded for later:** a Server Action `redirect()` is a *soft* navigation so
  `readyState` never changes; a stale Turbopack worker reports an opaque "Jest worker" error that
  is not your code; and ESLint will lint a headless Chrome profile's bundled extensions until you
  ignore the directory.
- **A test of ours was wrong and the feature was right:** the password test asserted the *seeded*
  hash format and failed the moment a real sign-in upgraded it. Fixed by constructing the legacy
  format in the test rather than borrowing a row the system is meant to change.
- Verified: `npm run check` clean (**199 tests**, 0 lint errors, 0 warnings), build clean,
  `db:verify` 26/26, `check:auth` 12/12 against a fresh seed.
- **Not done and not claimed:** the onboarding wizard collects answers into
  `OnboardingProgress.data` but does **not** write profile rows — that needs the Phase 6 profile
  work, and until then a half-finished wizard cannot produce a half-built profile. Dashboards are
  placeholders by design. SMTP is Phase 17; email prints to the terminal and fails loudly if set to
  `smtp`. Account deletion is described, not implemented (Phase 16). Group-visibility folding in
  `resolveVisibility()` waits for Phase 7's models.
- **Next:** Phase 5 — the institution backbone, and the swap of every public page from
  `@/content/*` to `@/lib/db/queries/*` with no rendered page changing.


### 2026-09-09 — Session 6

**Phase 3 complete.** The schema, the search infrastructure, the demo world and the integrity suite.

- **90 models, 29 enums, 3 migrations.** `init`, `search_infrastructure` (hand-written: triggers,
  GIN indexes and 16 check constraints Prisma cannot express) and `guest_membership`.
- **Invariants are database constraints, not conventions.** Every post has exactly one anchor
  (ADR-006); a PUBLIC project without faculty approval is not representable (ADR-010); nobody peer
  reviews themselves; an expired opportunity cannot predate its posting.
- **Full-text search** with A/B/C/D weighting on Project, Idea, Post, User and Resource, maintained
  by triggers. A section edit refreshes its parent project's vector — asserted, because a trigger
  that fires on insert but not update serves stale results silently for months.
- **The demo world seeds in ~3.4s** (budget: 20s) and is byte-for-byte reproducible: the same md5
  fingerprint across runs. 82 users, 18 groups, 14 projects with 126 sections, **691 ledger events
  every one of which points at an action that also exists**, and 65 feed posts, none hand-written.
- **`npm run db:verify` — 26 assertions, all passing.** Including two that are behavioural rather
  than structural: FTS ranking, and the duplicate detector firing on the seeded near-duplicate
  (0.585) while leaving an unrelated project alone (0.106).
- **The duplicate scorer was wrong and real data proved it.** The unit test used invented prose of
  similar length and passed at 0.562; the actual fixture pair scored **0.420 and failed**. Jaccard
  divides by the union, so a two-sentence proposal subsumed by a full problem section scores low
  purely on length. Measured five candidate measures across the corpus and chose the geometric mean
  of Dice and containment (**ADR-023**). The test now reads the fixtures directly, so it can never
  again be easier than production.
- **Two schema gaps found by the verify suite, not by review.** Cross-college project members had no
  membership at the host college — the fixtures deliberately contain inter-college work. Added
  `MembershipState.GUEST` (**ADR-022**) so isolation stays one predicate. And a shared tech stack
  alone was carrying two unrelated projects to "related"; metadata now corroborates a problem match
  rather than creating one.
- **Zero new dependencies for tests.** Node 24 runs TypeScript directly, so `npm run test` is the
  built-in runner plus a 40-line resolver hook (**ADR-024**). 30 tests.
- **`npm run lint` was dying with an out-of-memory error** — ESLint was walking the ~300 MB
  PostgreSQL distribution that `db:up` unpacks. Ignored, and gitignored.
- **Fixed a latent boot bug the query layer exposed:** `.env` cannot express "absent", so the blank
  `AUTH_SECRET=` in `.env.example` failed validation. Empty variables are now treated as unset —
  otherwise copying the example file fails on a Phase 4 variable during Phase 3.
- **Phase 5 is de-risked by an assertion, not by hope:** querying the database as the anonymous
  viewer returns exactly the same public project set as the fixtures, and all 14 projects round-trip
  with sections and members intact.
- Verified: `npm run check` clean (typecheck across both tsconfigs, 0 lint errors, 0 lint warnings,
  Prettier clean, 30 tests, 94 contrast pairs), production build clean, `db:reset` + `db:verify`
  green from empty.
- **Not done and not claimed:** the query layer covers projects and the viewer contract only —
  people, colleges and groups are Phase 5/6 as they are built. No UI reads the database yet; every
  page still renders from `src/content/`, which is the correct state until Phase 5 switches them.
- **Next:** Phase 4 — Auth.js, the session, RBAC, and the `Viewer` this phase established.


### 2026-09-09 — Session 5

- **Completed Phase 2.** The entire public surface — **127 indexable pages** — and the SEO engine
  every later phase reuses, built before the database exists. Marketing, explore, project pages,
  topic and SDG hubs, the Idea Hub, colleges, profiles, knowledge hub, opportunities, help, the full
  legal set, error pages, sitemap, robots and generated OG cards.
- **`src/content/` is written, not generated**, and is now **the contract Phase 3's schema must
  satisfy**. Fourteen full project records with all nine sections, plus deliberate hard cases: a
  three-level lineage chain, a near-duplicate to make Phase 8's similarity check fire, an embargoed
  project, a private project, a private profile, a project at an unverified college, and an
  unverified company's listing.
- **Wrote the SEO audit early and it found 191 violations in my own output** — on a site that had
  already passed typecheck, lint and a clean production build. Every one was invisible in a browser:
  ~40 descriptions outside 110–160, ~24 titles over 60, and **`og:image` missing on all 127 pages**.
- **The og:image failure took two wrong turns and both are worth remembering.** A hand-written
  `/path/opengraph-image` URL 404s because Next content-hashes generated image filenames. Removing
  the override then produced *no* image at all, because setting `openGraph` in a page's metadata
  suppresses the file-based convention. The fix is a route handler at a stable URL (`/api/og`),
  which also gives every page a tailored card with no per-route file.
- Fixed `dangerouslySetInnerHTML` that had crept into the pricing page for bold text — not because
  it was exploitable on our own content, but because it is a pattern that gets copied into somewhere
  it would be. The markdown-lite renderer that Phase 8 will point at untrusted project sections
  produces React elements only.
- Verified: check and build clean, **133 static pages**, **check:seo 0 violations across 127 pages**,
  247 valid JSON-LD blocks, every page renders without JS, no horizontal overflow at any width, and
  the private/unverified fixtures are provably absent from the sitemap.
- **Not done and not claimed:** no Lighthouse score is asserted (Phase 16 owns it), and
  `/knowledge/collections/[slug]` was not built — with six articles it would list two items.
- **Next:** Phase 3 — the Prisma schema against the `src/content/` contract, Postgres FTS and
  `pg_trgm`, and the seeded demo college. **PostgreSQL still needs installing (blocker B-1).**

### 2026-09-09 — Session 4

- **Phase 1 correction: the type scale was too large and the rhythm too airy.** Reported from a real
  screen. The screenshot came from a browser at ~133% zoom, so the first job was separating "the
  type is too large" from "the browser is zoomed" — **both were true**, and only one was fixable.
- Built `scripts/audit-layout.mjs` (`npm run audit:layout`) to settle it with numbers: it drives
  Chrome over CDP and reports **computed** font sizes, section padding, hero offset, document height
  and horizontal overflow at 390 / 768 / 1280 / 1536, at a known 100% zoom.
- Measured and fixed (**ADR-018**): hero h1 **60 → 48px**, hero top gap **156 → 107px** (desktop) and
  **108 → 76px** (mobile), lead **18 → 16px** on mobile, `Section` padding **64/96/112 → 48/64/80**.
  Document height at 1280 fell from 1644 to 1362 — 17% less scrolling for the same content.
- `docs/DESIGN-SYSTEM.md` now carries a **usage ceiling** table — what the scale defines versus what
  pages may use — so this cannot drift back across Phase 2's ~45 pages. `6xl`/`7xl` are unused and
  need a stated reason.
- **Two findings from the same pass, both worth more than the fix itself:**
  - **Prettier's Tailwind class sorting had already reordered the class strings**, so two of the
    four edits in the first attempt silently matched nothing. The audit caught it because the
    numbers did not move. *Verify an edit landed by measuring its effect, not by the edit
    reporting success.*
  - With navigation still empty in Phase 1, the **mobile header rendered only a theme toggle** —
    both auth CTAs were `hidden sm:inline-flex`. The primary CTA is now visible at every width.
- Verified: check and build clean, contrast still 94/94, **no horizontal overflow at any width** on
  either route.
- **Next:** Phase 2 — the public site and SEO engine.

### 2026-09-08 — Session 3

- **Completed Phase 1.** The brand and the full component vocabulary: the Logo as one component
  (lockup / stacked / mark, plus mono and reversed), the complete favicon and PWA icon set generated
  from that same geometry, **~35 UI primitives** on Radix, Header / Footer / AppShell /
  CommandPalette, **60 inline SVG icons**, 8 scene illustrations, the generated avatar and
  project-cover systems, and `/style-guide` rendering all of it in both themes.
- **Fixed three React 19 `set-state-in-effect` errors properly rather than suppressing them.** The
  theme now uses `useSyncExternalStore` (**ADR-016**) — which also means two open tabs stay in step,
  something the effect version did not do. The combobox and command palette reset their active
  option in the change handler, where the filter actually changes.
- **Looked at the result, and found four defects every automated check had passed** (**ADR-017**):
  a **doubled page title** (`Style guide · Nexivora · Nexivora`) caused by the root layout's title
  template stacking on `buildMetadata`'s suffix — **this would have hit all ~45 Phase 2 pages**;
  a `favicon.ico` that silently contained one size instead of three, because Pillow's ICO writer
  ignores `append_images`; the stacked lockup's wordmark off-centre by six units; and ~24% dead
  trailing space in the horizontal lockup's viewBox.
- Built `scripts/screenshot.mjs` (`npm run shot`) to make that pass repeatable — it drives Chrome
  over the DevTools Protocol, because the `--screenshot` flag cannot emulate `prefers-color-scheme`
  or capture beyond the viewport. Phases 2 and 16 both need it.
- Built the command palette now and left it deliberately empty: it is the **deterministic fallback
  for the Phase 18 assistant**, and building it separately keeps that boundary honest.
- Verified: typecheck / lint / format / contrast / build all clean; **CSS 12.0 KB gzipped** against
  a 20 KB budget; the mark rendered and **visually checked at 16px**; `favicon.ico` confirmed to
  carry 16/32/48; full-page captures in both themes; tier badges checked desaturated for the
  greyscale-print requirement.
- **Not done and not claimed:** the axe, screen-reader and keyboard audits are Phase 16. Contrast is
  measured; conformance is not asserted, and the style guide says so.
- **Next:** Phase 2 — the full public site and the SEO engine (~45 indexable pages, `buildMetadata`
  everywhere, `jsonld.ts`, `sitemap.ts`, `robots.ts`, OG images, and the `src/content/` fixtures
  that become Phase 3's schema contract).

### 2026-09-08 — Session 2

- **Completed Phase 0.** Scaffolded on **Next.js 16.3.4** (newer than the planned 15 —
  `create-next-app@latest` ships it) with React 19.2.8, Turbopack, Tailwind v4, TypeScript strict
  plus `noUncheckedIndexedAccess`, ESLint, Prettier, and the folder skeleton for all twenty phases.
- **Read the Next 16 docs bundled in `node_modules/next/dist/docs/` rather than assuming Next 15
  conventions**, and found four breaking changes that affect phases not yet built (**ADR-014**).
  The expensive one: **Middleware is now Proxy** (`src/proxy.ts`), and a `middleware.ts` file is
  *silently ignored* — in Phase 4 that would have presented as a broken auth guard rather than a
  missing file. Phase 4's spec and `docs/ARCHITECTURE.md` are corrected. Also: `params`,
  `searchParams`, `cookies()` and `headers()` are now Promises with no sync shim, `opengraph-image`
  and `sitemap` generators receive Promises too, and the `eslint` key in `next.config.ts` is gone.
- **Built the complete design token system in Phase 0 rather than stubbing it**, because Phase 1
  builds every component against it and half a system means rewriting each component twice.
- **Measured contrast instead of assuming it — three token pairings failed.** White on `accent-600`
  (3.68:1), white on `highlight-600` (3.19:1), and the amber fill's own edge against white
  (2.15:1, below the 3:1 UI-boundary rule). None is visible to the eye; all would have shipped.
  Fixed by introducing explicit `*-fill` tokens so a component never picks its own ramp step, and a
  mandatory border on highlight fills (**ADR-015**). Now **94/94 pairs pass in both themes**, and
  the audit is a committed script wired into `npm run check` so it cannot silently regress.
- Deleted the scaffold's Next.js-branded favicon and its `next.svg` / `vercel.svg` assets rather
  than shipping them as our brand. Claimed `/icon.svg` now with a placeholder mark, because per
  `Fevicon.txt` the icon URL must be stable forever — Phase 1 changes the artwork, never the URL.
- Verified: typecheck / lint / format / contrast / build all clean; `GET /` returns 200 with the
  correct title, canonical, robots and OG tags; all six security headers present; page copy present
  in the raw HTML (crawlable with JavaScript disabled); a missing route returns a real 404; invalid
  env fails the boot naming the variable. Committed as `8c630dd`.
- **One deliverable is genuinely incomplete and is not being claimed:** PostgreSQL is not installed
  on this machine, so acceptance criterion 5 (`pg_trgm`) is unmet. Logged as blocker B-1. It blocks
  nothing before Phase 3.
- **Next:** Phase 1 — logo, favicon set, icon and illustration sets, ~35 UI primitives,
  Header/Footer/AppShell, `/style-guide`.

### 2026-09-08 — Session 1

- Read the Nexivora brief, the Google SEO reference set in `../SEO IMPs`, and the KaushalSetu
  documentation system used as the structural template.
- Locked the product identity: **Nexivora**, tagline *Projects. People. Opportunities.*, positioned
  as **project-first** rather than person-first — the deliberate difference from LinkedIn.
- Named the four weaknesses in the original brief and turned each into a shipped differentiator:
  activity-anchored feed, permanent archive with lineage, three-tier contribution proof, and the
  **Contribution Ledger** that addresses the free-rider problem no competitor touches.
- Added the institutional business case that was missing entirely: **NAAC/NBA/NIRF accreditation
  export** from data the platform already holds. This is the revenue line.
- Chose **PostgreSQL for dev and production, not SQLite** (ADR-003): full-text search and
  `pg_trgm` duplicate detection are core features, and testing them only at deploy time is a trap.
- Resolved hosting: Hostinger *shared* cannot run Node, so production targets a Hostinger **VPS
  KVM 2**; localhost plus Cloudflare Tunnel covers everything before that, free.
- Wrote `CONTEXT.md`, `PLAN.md`, this file, `README.md`, twelve reference docs and twenty phase
  specs.
- **Next:** Phase 0 — scaffold the app, tooling, folder architecture, env validation, token stub.

---

## Blockers

| # | Blocker | Since | Blocks | Owner | Resolution |
| --- | --- | --- | --- | --- | --- |
| ~~B-1~~ | ~~PostgreSQL is not installed on this machine~~ | 2026-09-08 | ~~Phase 3~~ | achaudhary7 | **RESOLVED 2026-09-09.** `npm run db:up` downloads the official PostgreSQL 16 binaries-only build and runs it as an ordinary user process — no installer, no admin, no Docker (**ADR-021**). Verified: PostgreSQL 16.8 on port 5433, `pg_trgm` returning `similarity('nexivora','nexivore') = 0.636`. |
| ~~B-2~~ | ~~Port 3000 is held by the KaushalSetu dev server~~ | 2026-09-08 | ~~Nothing — cosmetic~~ | achaudhary7 | **RESOLVED 2026-09-10.** Port 3000 is free and every script now agrees on it. `check-auth.mjs` had kept a 3001 default, which meant it silently checked a server that was not running and reported nothing rather than failing. A *new* trap replaces it: a stale `next start` is not killed by `pkill` on Windows, so a rebuild binds nothing and the old build keeps answering — use `Get-NetTCPConnection -LocalPort 3000` then `Stop-Process`. |

---

## Deferred items

Things consciously postponed. Never delete a row — move it to a Resolved section.

| Item | Deferred from | Deferred to | Why |
| --- | --- | --- | --- |
| All AI features | Everywhere | Phase 18 | Limited AI credits; every AI surface has a deterministic version that ships first and stands alone. |
| Socket.io / WebSocket transport | Phase 10 | When measured need exists | SSE plus polling covers notifications and chat at MVP scale, costs nothing and survives Nginx. Behind `lib/realtime/` so the swap is one file. |
| Video conferencing | Phase 7 | Out of scope | We schedule meetings and store a join link. Hosting video is a different company. |
| Real-time collaborative document editing | Phase 7 | Out of scope | CRDT editing is a multi-month build. Files plus threaded discussion cover the need. |
| Native mobile apps | — | Post-MVP | PWA (Phase 16) covers installability and offline. |
| Payments / subscription billing | Phase 2 | Post-MVP pilot | The pricing page describes tiers; no gateway until a college actually signs. |
| Cloudflare R2 object storage | Phase 7 | When disk pressure appears | **Shipped as designed.** `StorageProvider` and the local driver exist; `storage()` throws a naming error for `STORAGE_DRIVER=r2` rather than silently falling back, so the gap is a boot failure and not a mystery. |
| Rich-text authoring (Tiptap) | Phase 7 | Out of scope unless a surface needs it | **ADR-036.** Markdown-lite through the existing renderer instead — it has no HTML path, so the sanitiser it would have needed is unnecessary rather than merely absent. Revisit only if a project report needs embedded figures. |
| Unread indicators · "request to join" | Phase 7 | Phase 10 | Both are notifications. Building the delivery decision in two places is how it drifts. |
| Task checklists · inline-on-column create · file grid + folder browsing · resumable upload · syntax-highlighted previews | Phase 7 | When somebody asks | Refinements, not capabilities. Each is marked `[~]` in the phase file rather than ticked. |
| Project cover images | Phase 6 → Phase 7 | Phase 8 | `storeImage("cover", …)` works; `User`/`Project` has no cover column. A migration for a field nothing renders cannot be verified, so it lands where the cover is displayed. |
| Multi-language / `hreflang` | Phase 2 | When Hindi content exists | Emitting hreflang for a single locale is noise. Pattern documented in the SEO checklist. |
| Plagiarism checking against the open web | Phase 8 | Out of scope | We check against the college archive only. External plagiarism is Turnitin's business and it is expensive. |
| Faculty-initiated meeting scheduling (one group or many) | Phase 9 | Phase 10 | Phase 7's meetings are group-scoped; a faculty meeting across several groups needs an invitation model that does not exist. A scheduling control that silently reached one group would be worse than none, so it is `[ ]` in the phase file rather than half-built. |
| Announcements pinned in each workspace, and delivered as notifications | Phase 9 | Phase 10 | Both are notification-delivery decisions, and Phase 10 is where that decision lives once. Announcements post, schedule and render on the class page today; the **deadline broadcast already creates a real task on every group's board**, which is the half that mattered — a date where people already look beats a notification they dismiss. Acceptance criterion 6 is unverified until this lands. |
| Duplicate-a-rubric-from-existing | Phase 9 | When somebody asks | Three templates ship, and "New version" covers the common case. A duplicate button beside a version button invites exactly the confusion versioning exists to prevent. |
| Class-scoped rubrics | Phase 9 | When a college asks | `Rubric` has `subjectId`; subject-scoped and college-wide are both supported. Adding `classId` for a case nobody has raised is a schema change looking for a requirement. |
| A dedicated faculty group-detail page | Phase 9 | Not planned | `/faculty/groups` carries share, progress and signals; the workspace and `/groups/[id]/ledger` carry the rest and faculty can already read both. A second rendering of the same group is a second place for the two to disagree. |
| Seeded demo data ages against the clock | Phase 9 | Partly resolved | **ADR-047** rebases *in-flight* workspace activity on every seed. Completed projects keep their real dates, correctly — but anything later that compares a finished project to `now` needs the `active` distinction from **ADR-046** or it will read delivered work as failing work. |
| Google OAuth sign-in | Phase 4 | Phase 16 | Credentials plus institutional email verification is the trust path. OAuth is a convenience added later, never the only route. |
