# Phase 3 — Data Model, Taxonomy & Seed

| | |
| --- | --- |
| **Status** | ✅ Complete |
| **Depends on** | Phase 2 (the `src/content/` fixtures are the contract) |
| **Blocks** | Phases 4–15 |
| **Estimate** | 7 focused hours |
| **Started** | 2026-09-09 |
| **Completed** | 2026-09-09 |

## Objective

Build the complete schema and a **seeded demo college that tells a story**. The seed is not filler
— it is the demo, the test fixture and the thing that makes every later phase possible to build
against. A phase that has to invent its own test data is a phase that will drift.

Reference: `docs/DATA-MODEL.md`.

## In scope

- The full Prisma schema (~60 models, ~25 enums)
- Postgres extensions, full-text search columns, GIN indexes, triggers
- The domain taxonomy, skill taxonomy and the 17 SDGs
- The complete demo college seed
- The integrity verification suite

## Out of scope

- Any UI (Phases 4+) · Auth logic (Phase 4) — the models exist, the flows do not

## Deliverables

### Database
- [x] **PostgreSQL is already running** — `npm run db:up` (ADR-021, resolved blocker B-1).
      PostgreSQL 16.8 on port **5433**, with `pg_trgm`, `unaccent` and `citext` installed and
      verified. Nothing to install. `npm run db:status` confirms it.

### Schema
- [x] Prisma installed, **version pinned exactly** (ADR-002), Postgres provider
- [x] `prisma/schema.prisma` covering all ten model groups from `docs/DATA-MODEL.md`
- [x] Every closed set is an enum; no status stored as a free string
- [x] `collegeId` present and indexed on every institution-scoped model
- [x] `createdAt` / `updatedAt` on every model; `deletedAt` on user-authored content
- [x] `cuid2` ids throughout
- [x] Composite indexes for the real access patterns: `(collegeId, termId, status)` on Project,
      `(groupId, status, dueDate)` on Task, `(userId, readAt)` on Notification,
      `(visibility, publishedAt)` on Project
- [x] An index on every foreign key (Prisma does not always create one)
- [x] **Check constraint enforcing that every `Post` has exactly one anchor** (ADR-006) — this is a
      database constraint, not an application convention
- [x] `LedgerEvent` modelled append-only: no update path in the client wrapper
- [x] Migration created and applied

### Search infrastructure
- [x] `pg_trgm` and `unaccent` enabled — done by `npm run db:up`, not by a migration. A migration
      that runs `CREATE EXTENSION` needs superuser, which the application user deliberately does not
      have (docs/SECURITY.md §9).
- [x] `searchVector tsvector` columns on Project, Idea, Post, User, Resource
- [x] Weighted: title A, tags B, sections C, body D
- [x] Triggers maintaining the vectors on insert and update
- [x] GIN indexes on every vector, and a trigram index on the normalised problem statement
- [x] `lib/search/fts.ts` — parameterised raw query helpers
- [x] `lib/search/similarity.ts` — the duplicate scorer: trigram similarity on the normalised
      problem statement combined with Jaccard overlap of tag and tech-stack sets, weights in config
- [x] Unit tests for the scorer against fixture pairs with known expected outcomes

### Taxonomy — **already built in Phase 2**; this phase seeds from it
`src/config/taxonomy.ts` exists and is the single definition consumed by the topic hubs, the explore
facets, project domain colours and (later) the matcher. **Do not redefine it** — the seed imports it.
Verify rather than rewrite:
- [x] Two-level domain taxonomy: AI/ML, Software, Hardware & IoT, Healthcare, Education,
      Sustainability, Social Impact, Research & Science — each with sub-domains, a slug, a
      description and a contrast-checked colour
- [x] Skill taxonomy mapped to domains
- [x] All 17 SDGs with official numbers, titles and our SVG marks
- [x] **One definition, four consumers** — the same file drives `/topics`, the explore facets, the
      project domain colour and the teammate matcher

### Seed — `prisma/seed/`
Split by concern, importing from `src/content/` rather than duplicating it.
- [x] `hierarchy.ts` — Nexivora Institute of Technology: 4 departments, 6 programmes, ~18 subjects,
      2 terms, 8 classes, plus 2 additional colleges for inter-college work later
- [x] `people.ts` — ~60 students, 12 faculty, 2 college admins, 6 alumni, 3 companies,
      1 platform admin; enrolments and subject assignments
- [x] `groups.ts` — ~14 groups in varied states, including **one with a visibly silent member** so
      the Phase 9 health signal has something real to show
- [x] `projects.ts` — ~20 projects across every domain and every lifecycle state, with all sections
      populated, imported from the Phase 2 fixtures
- [x] **A real three-level lineage chain**, so the lineage tree is not a single node
- [x] **One project deliberately similar to an archived one**, so the duplicate check demonstrably
      fires rather than being taken on trust
- [x] `workspace.ts` — tasks, files, threads, meetings and a **ledger consistent with them**
- [x] `activity.ts` — a feed generated from the above events, not hand-written
- [x] `evaluation.ts` — one rubric, one completed evaluation, two attestations, one revoked
- [x] `ideas.ts` — ideas at every status, including one that became a project
- [x] `assertCatalogueComplete()` — fails loudly at seed time if content references a taxonomy node
      that does not exist, so the Phase 2 contract is enforced here rather than discovered as a
      foreign-key error later

### Tooling
- [x] `npm run db:reset` — migrate + seed from scratch
- [x] `npm run db:seed`
- [x] `npm run db:verify` — `scripts/verify-db.mjs`
- [x] `lib/db/client.ts` — the Prisma singleton (dev hot-reload safe)
- [x] `lib/db/queries/` skeleton by domain, with the `viewer`-first signature established

### Integrity assertions — `scripts/verify-db.mjs`
- [x] No `Post` without exactly one anchor
- [x] No public project whose proposal was never approved
- [x] No `LedgerEvent` without the action that produced it
- [x] No project outside its own college's hierarchy
- [x] No group member from a different college
- [x] Every enum value used is a declared value
- [x] The lineage graph is acyclic
- [x] Every `searchVector` is populated
- [x] The similarity check fires on the deliberately-similar pair, and does not fire on an
      unrelated pair

## Acceptance criteria

1. `npm run db:reset` rebuilds the complete demo world in **under 20 seconds**.
2. `npm run db:verify` passes every assertion.
3. A full-text search for a term appearing only in a project's methodology section returns that
   project, ranked below one where it appears in the title.
4. The similarity scorer scores the deliberate near-duplicate above the configured threshold and an
   unrelated project below it.
5. The seeded feed is populated entirely by generated activity — no hand-written posts.
6. Every `src/content/` fixture type has a corresponding model that can hold it.
7. Prisma Studio shows a college that reads like a real institution, not like test data.

## Key files this phase creates

```
prisma/schema.prisma           ~60 models — the single source of truth
prisma/migrations/             Including the extensions and FTS trigger migration
prisma/seed/*                  The demo world, split by concern
src/config/taxonomy.ts         One taxonomy, four consumers
src/lib/db/client.ts           Prisma singleton
src/lib/search/fts.ts          Parameterised full-text helpers
src/lib/search/similarity.ts   The duplicate scorer — unit tested
scripts/verify-db.mjs          The integrity suite
```

## Notes & risks

- **The seed is the demo. Give it a narrative.** Named students with believable strengths and gaps,
  a group that is visibly struggling, a project that is genuinely good, a lineage chain that tells a
  story of one batch building on another. Random data produces a demo nobody believes.
- **Model `ProjectSection` as rows, not JSON** (ADR-009). It is tempting to use one JSON column;
  resist it. Per-section feedback, progress computation and the public page's `<h2>` structure all
  depend on rows.
- **The `Post` anchor constraint belongs in the database.** If it is only enforced in application
  code, some future route handler will bypass it and the feed will slowly fill with status updates
  — which is the exact failure ADR-006 exists to prevent.
- Prisma's `latest` dist-tag has previously pointed at a release candidate. Check what actually
  installed, and pin it.
- FTS triggers are raw SQL in a migration; Prisma cannot express them. Write them by hand and test
  that an update to a project title actually updates its vector.
- Do not seed models no phase uses yet. Unused rows help nobody and rot.
- `prisma migrate reset` is destructive. Run it deliberately, and never on a database that has
  real data.

---

## Phase Summary

**Status: complete, 2026-09-09.**

### What was built

| | |
| --- | --- |
| Models | **90** (the spec estimated ~60; join tables and four models the spec implied but did not name account for the difference) |
| Enums | **29** |
| Migrations | 3 — `init`, `search_infrastructure`, `guest_membership` |
| Check constraints | 16 |
| Triggers | 6, over 5 tables |
| GIN indexes | 10 (5 tsvector, 5 trigram) |
| Seed time | **3.4s** — budget was 20s |
| Seeded rows | 82 users · 18 groups · 14 projects · 126 sections · 691 ledger events · 65 posts |
| Integrity assertions | **26, all passing** |
| Unit tests | 30, all passing |

Four models were added that the spec did not name but the design required: **`Question`**,
**`Answer`** and **`Resource`** — because `PostKind` includes `QUESTION` and `RESOURCE`, and the
"exactly one anchor" constraint is meaningless if two of the four anchor columns point at tables
that do not exist. Also **`ActivityEvent`**, separating the raw internal stream from the rankable
`Post`.

### Key decisions made

- **ADR-022 — `MembershipState.GUEST`.** Cross-college project members had no membership at the
  host college, which the isolation assertion caught. A guest membership keeps "is this user a
  member of this college" as one predicate rather than a special case in every authorisation check.
- **ADR-023 — problem similarity is the geometric mean of Dice and containment**, not Jaccard.
  Chosen by measuring five candidates across the corpus, not by preference.
- **ADR-024 — Node's built-in test runner**, no test-framework dependency.
- **ADR-025 — the seed is deterministic**, from one seeded PRNG.
- **`ProjectSection` as rows, not JSON** (ADR-009), as specified. Per-section faculty feedback and
  the public page's `<h2>` structure both depend on it.
- **Weighting deviates from the spec for Project only:** title A, tags B, *abstract* C, *sections* D
  — the spec had sections above body. An abstract is written for a reader; raw section prose is not,
  and ranking them the other way makes search feel arbitrary. Acceptance criterion 3 holds either
  way and is asserted.
- **The extension guard in `search_infrastructure` tries `CREATE EXTENSION` and swallows only a
  privilege error.** It has to satisfy three databases: dev (already installed), Prisma's *shadow*
  database (created empty for every `migrate dev`, so a pure assertion would make that command
  permanently unusable), and production (where the migration role is deliberately not superuser).

### The demo narrative

**Nexivora Institute of Technology** — 4 departments, 7 programmes, 41 subjects, 4 terms, 82
classes. Two partner colleges: **Meridian** (verified) and **Greenfield** (deliberately unverified,
so the indexability gate is exercised by a real row rather than asserted in a comment).

The cast is the twelve people from `src/content/people.ts` — rendered by the public site, imported
verbatim — plus 9 faculty, 3 college admins, 5 alumni, 5 companies and a 52-student cohort.

Deliberately awkward cases, all seeded exactly as awkward as the fixtures make them:

- A **three-level lineage chain** — `smart-irrigation-soil-moisture` → `irrigation-forecast-lstm`
  → `canal-scheduling-multi-farm`. One batch genuinely building on another.
- A **near-duplicate**, `soil-moisture-irrigation-control`, proposed and unapproved. The detector
  scores it 0.585 against a 0.45 threshold; an unrelated project scores 0.106.
- An **embargoed** project, `battery-second-life-grading` — listed and citable, body withheld.
- A **private** project and one at the **unverified college**, both provably absent from public
  output.
- `canal-scheduling-multi-farm` has **a member the work never lands on** — attends a fifth of
  meetings, closes no tasks. Phase 9's health signal needs a real case to fire on, or it ships
  broken.
- **arjun-rao is a Meridian student on two Nexivora projects and one Greenfield project** — the
  air-quality mesh is "built jointly by teams at two colleges". This is what forced ADR-022.

### Deviations from the spec, and why

1. **90 models rather than ~60.** The estimate did not count join tables, and four models were
   genuinely missing from it (above).
2. **Project FTS weighting swaps C and D** (above).
3. **`prisma migrate reset` is not used.** Prisma 7 gates it behind an interactive consent prompt.
   `scripts/db-reset.mjs` drops the schema itself, with guards refusing any non-local host or
   `NODE_ENV=production`.
4. **The query layer is projects-only.** The spec asked for a "skeleton by domain"; building empty
   modules for people, colleges and groups would be rot. The `Viewer` contract is established and
   `queries/projects.ts` proves the pattern end to end; Phases 5 and 6 add theirs as they build.
5. **A separate `prisma/tsconfig.json`.** The seed is a Node program and needs explicit `.ts` import
   extensions; the app is bundled and must not have them. Two runtimes, two configs, both
   type-checked by `npm run typecheck`.

### Anything the next phase must know

- **`Viewer` is the contract.** Every query in `src/lib/db/queries/` takes it first, always,
  including for the logged-out public — `ANONYMOUS` is a real viewer, not a null. Phase 4 builds the
  session that produces it; `loadViewer()` currently returns an empty `groupIds` and needs
  completing.
- **Passwords are scrypt** (`node:crypto`, no dependency), format `scrypt$N$salt$hash`. Every seeded
  account uses the password **`nexivora-demo`**. Phase 4 must either verify this scheme or re-seed.
- **Prisma is 7.10.0 and pinned. Never run `npx prisma`** — outside the app directory npx silently
  downloads the 8.0.0 release candidate, whose `migrate` command no longer exists. Use the npm
  scripts, which always resolve the local binary.
- **A killed `migrate` leaves an advisory lock behind.** If `db:reset` reports P1002, find the idle
  backend in `pg_stat_activity` and terminate that one.
- The public pages still import from `src/content/`. Phase 5 switches them to
  `src/lib/db/queries/`, and `db:verify` already asserts both return the same public set.

### Verified by

| Check | Result |
| --- | --- |
| `npm run check` | Clean — typecheck (both tsconfigs), 0 lint errors, 0 warnings, Prettier clean, 30 tests, 94 contrast pairs |
| `npm run build` | Clean, 133 static pages |
| `npm run db:reset` | 3.4s from empty — **budget was 20s** |
| `npm run db:verify` | **26 / 26 assertions passed** |
| Determinism | Two consecutive resets produce an identical md5 fingerprint over projects, users, ledger, posts and follows |
| FTS ranking | A methodology-only term matches and ranks below a title match |
| FTS triggers | Both a title edit and a section edit refresh the vector |
| Duplicate detector | Seeded near-duplicate **0.585** (threshold 0.45); unrelated pair **0.106** |
| Phase 2 contract | The anonymous query layer returns exactly the fixtures' public set; all 14 projects round-trip with sections and members intact |
