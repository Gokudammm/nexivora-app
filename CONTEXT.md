# CONTEXT.md — Read This First

> **Purpose of this file:** this is the single entry point that restores full project context for
> any developer (or AI session) that picks up this repository. If you read nothing else, read this
> file, then `PROGRESS.md`, then the phase file you are working on.

---

## 1. What this project is

**Nexivora** — *The Global Academic Collaboration Network.*

A modern academic social and collaboration platform that connects **students, faculty, colleges,
alumni, companies and researchers** in one ecosystem. Its purpose is to make academic work
**organised, collaborative, discoverable and opportunity-driven**.

**This is an individual startup project.** It is not a DTIL project, not a Group 14 project, and
not a hackathon submission. It is built by an Integrated M.Tech AI/ML student as a real product
with a real business model behind it.

**The core identity of the platform, in three words:**

```
Projects  →  People  →  Opportunities
```

Everything on Nexivora hangs off a **project**. That is the deliberate difference from every
adjacent product: LinkedIn is person-first, Instagram is post-first, GitHub is code-first.
Nexivora is **project-first**, with the academic hierarchy as its structural spine and the
institution as its trust anchor.

```
College → Departments → Subjects → Faculty → Classes → Groups → Students → Projects
```

## 2. The name and brand

| Field | Value |
| --- | --- |
| Product name | **Nexivora** |
| Reading | *Nexi* (nexus — a connection, a junction of many things) + *vora* (a forward, generative ending) |
| Primary tagline | **Projects. People. Opportunities.** |
| Descriptor line | The global academic collaboration network. |
| Positioning line | Where student work becomes a permanent academic record. |
| Preferred domain | `nexivora.com` (fallbacks: `nexivora.in`, `nexivora.org`) |
| Handle | `@nexivora` everywhere |

Why the name works: it is invented, so it is trademarkable and the domain is very likely free; it
is pronounceable in one pass; it carries "nexus" without being literal; it does not contain
"edu", "campus", "student" or "connect", so it does not age into a single market segment.

## 3. The problem, in one paragraph

Academic project work in colleges is scattered across WhatsApp groups, personal Drive folders,
email threads and printed reports. Faculty see progress only at submission. Group members cannot
prove what they individually contributed. Finished projects vanish the day they are graded, so the
next batch rebuilds the same thing from zero and the college loses its own institutional memory.
Students end four years with no verifiable portfolio of what they actually built. Alumni and
companies have no window into student work, so mentorship and opportunity flow depend entirely on
personal contacts. **None of this is a technology problem — it is a missing system of record.**
Nexivora is that system of record, and the network that grows on top of it.

## 4. Our differentiators — why this is not "LinkedIn for students"

The brief as originally written has four quiet weaknesses. Each one is a feature we ship, and each
one is what makes the product defensible.

| Weakness | Our answer | Phase |
| --- | --- | --- |
| **An "academic feed" of free-form posts is an engagement trap.** It gets abandoned in three weeks because there is nothing to post about. | **The feed is generated from real project activity.** Every post is anchored to a project, an idea, a question or a resource. There is no standalone status update. The feed is therefore never empty and never noise. | 10 |
| **Nothing survives the semester.** Completed projects die at grading. | **Academic Archive + Project Lineage.** Every completed project gets a permanent citable ID and a stable public URL, and a new group can formally **Build On** a previous project — lineage is recorded and rendered as a visible tree. This turns four years of student work into a compounding institutional asset. | 12 |
| **Every claim is self-declared.** "I built the ML model" is unverifiable. | **Three-tier contribution proof:** self-claimed → workspace-evidenced (derived from real tasks, files and commits in the group workspace) → faculty-attested (a named faculty member signed it). Recruiters and alumni can filter to attested only. | 7, 9, 12 |
| **The free-rider problem in group projects is the number-one real pain of student teamwork, and the brief does not address it at all.** | **The Contribution Ledger.** Every workspace maintains a transparent, automatic per-member contribution view — tasks closed, files contributed, commits linked, milestones owned — plus a structured peer review at each milestone close. Visible to the group and to faculty. This single feature is the strongest adoption driver we have. | 7, 9 |

Additional differentiators, all shipped:

- **Duplicate / similarity detection** — a new project's problem statement is checked against the
  college archive before approval. Deterministic (trigram + token similarity), no AI needed.
- **Accreditation export (NAAC / NBA / NIRF / AICTE)** — Indian institutions spend enormous manual
  effort compiling project, research and student-activity data for accreditation. Nexivora already
  holds it, structured. One-click export. **This is the institutional business model.**
- **SDG alignment as a first-class dimension** — filterable, reportable, and a public showcase.
- **Academic IP and embargo controls** — a group can keep a patentable project private, or
  time-embargoed, while still proving it exists. A faculty panel will ask about this.
- **Skill graph inferred from projects**, not self-declared — your skills are what your verified
  project work demonstrates.
- **Public project pages that are genuinely useful to the open web** — see section 5.

## 5. The SEO thesis (read this before Phase 2)

Most of this product sits behind a login, which normally means zero organic traffic. We solve that
by making a deliberate, high-value **public surface**.

Queries like *"final year project ideas for CSE"*, *"IoT project report"*, *"SDG student projects"*
and *"machine learning mini project"* have enormous Indian search volume and genuinely terrible
existing content — thin listicles and scraped PDFs. **A public archive of real, fully documented
student projects with problem statement, methodology, results and named team is better content than
anything currently ranking.** And that archive is a by-product of the product simply working.

Public, indexable surfaces in priority order: `/explore` and `/projects/[slug]` → `/topics/[slug]`
→ `/ideas` → `/colleges/[slug]` → `/p/[username]` → `/knowledge/[slug]` → `/opportunities/[slug]`.
Full contract in `docs/SEO-CHECKLIST.md`, full route table in `docs/SITEMAP.md`.

## 6. Hard constraints

| Constraint | Consequence |
| --- | --- |
| **Very limited AI credits** | All AI is deferred to **Phase 18**, the last build phase. Every AI feature has a deterministic fallback that ships first and works alone: command-palette navigation, structured faceted search, rule-based teammate matching (skill overlap + availability + department), template-based summaries. **AI on and AI off must both produce a working product** — the difference is quality, not function. |
| **No Vercel** | Local-first development. Share via Cloudflare Tunnel (free). Production on a **Hostinger VPS** (Node + PostgreSQL + Nginx + PM2). Hostinger *shared* hosting cannot run Node — see `docs/DEPLOYMENT.md`; this is the single easiest thing to get wrong. |
| **SEO is a first-class requirement** | Server-rendered by default, per-page metadata, canonicals, sitemap, robots, JSON-LD. Source: the Google Search Central docs in `../SEO IMPs`. Contract in `docs/SEO-CHECKLIST.md`. |
| **Reusable components everywhere** | One `Header`, one `Footer`, one `Button`, one `Card`. If you are writing a second one, stop. See `docs/DESIGN-SYSTEM.md`. |
| **All imagery is SVG** | Logo, favicon set, icons, illustrations, empty states, OG images, diagrams. No raster assets, no stock photography, no paid licences. |
| **Performance is graded** | Lighthouse 95+ on public pages. LCP under 2.0s, INP under 200ms, CLS under 0.05. Budgets in `docs/PERFORMANCE.md`. |
| **Solo developer** | Phases are ordered so something demonstrable exists from day two, and so that stopping early still leaves a coherent product. Phases 0–12 are the MVP contract. |

## 7. Scope discipline — what the MVP is

The brief explicitly warns against building everything at once. It is right.

| Band | Phases | What it is |
| --- | --- | --- |
| **MVP — one college, end to end** | **0 – 12** | Brand, public site, data model, auth, institution backbone, profiles, group workspace, project lifecycle, faculty review, feed, discovery, showcase and archive. **This is the contract.** |
| Network expansion | 13 – 15 | Alumni, companies, inter-college, events, analytics and accreditation. |
| Production readiness | 16 – 17 | Hardening and deployment. |
| AI layer | 18 | Last, by design. Strictly additive. |
| Launch | 19 | Pitch, demo, seed story, go-to-market. |

If time runs out, **stop after Phase 12 and present 13–19 as roadmap.** A complete small system
beats a broken large one.

## 8. Where everything lives

```
Nexivora/
├── CONTEXT.md              <- you are here; read first
├── PLAN.md                 <- master phase plan, phases 0-19
├── PROGRESS.md             <- live status board; update after every work session
├── README.md
├── docs/
│   ├── ARCHITECTURE.md         stack, folder layout, request lifecycle, realtime
│   ├── DATA-MODEL.md           entities, relationships, the hierarchy
│   ├── ROLES-PERMISSIONS.md    every role x every resource; the authorisation matrix
│   ├── DESIGN-SYSTEM.md        tokens, components, brand, logo
│   ├── SEO-CHECKLIST.md        per-page SEO contract, from the Google docs
│   ├── PERFORMANCE.md          budgets and techniques
│   ├── SECURITY.md             authz model, privacy, moderation, threats
│   ├── DEPLOYMENT.md           localhost -> tunnel -> Hostinger VPS
│   ├── DECISIONS.md            ADR log; every non-obvious choice and why
│   ├── SITEMAP.md              every route, its gate, its indexability, its phase
│   ├── BUSINESS-MODEL.md       pricing, unit economics, go-to-market
│   ├── PITCH.md                problem, solution, market, ask — the deck content
│   └── phases/
│       └── phase-00-foundation.md ... phase-19-launch-pack.md
└── app/                    <- the Next.js application
```

## 8a. What earlier phases already built — read before starting any phase

Phases 0–8 are complete. These are the things a future session most often re-invents or contradicts.

### Commands that already exist

| Command | Does |
| --- | --- |
| `npm run db:up` | **Real PostgreSQL 16.8, nothing to install** (ADR-021). Port 5433, `pg_trgm`/`unaccent`/`citext` verified working. |
| `npm run db:status` / `db:down` / `db:destroy` | Inspect, stop, reset the local cluster |
| `npm run db:reset` | Drop → migrate → seed the whole demo world. **~3.4s.** Refuses any non-local host. |
| `npm run db:seed` / `db:migrate` / `db:deploy` / `db:studio` | The pinned local Prisma CLI — **never `npx prisma`** |
| `npm run db:verify` | 26 integrity assertions over the seeded database. Structural *and* behavioural. |
| `npm run test` | Node's built-in runner (ADR-024). **491 tests**, zero test dependencies. |
| `npm run check:auth` | Drives a real browser through sign-in, gating and sign-out. **Needs a running server.** |
| `npm run check:admin` | The admin console end to end, including a write that round-trips through the audit log. |
| `npm run check:privacy` | Profile privacy asserted on the bytes a logged-out visitor receives. |
| `npm run bench:import` | 500-row import against the 10s acceptance budget. Rolls back. |
| `npm run check` | typecheck (both tsconfigs) + lint + format + **test** + contrast. **The gate.** Works with nothing running. |
| `npm run check:project` | Drives a real browser through the whole lifecycle: create, write, autosave, similarity check, propose. **17/17.** Needs a running server. Creates real projects — `db:reset` clears them. |
| `npm run check:workspace` | Drives a real browser through the workspace: the board **by keyboard with no drag**, the file route, the ledger, the avatar upload. **25/25.** Needs a running server. |
| `npm run check:faculty` | The faculty desk end to end: the dashboard, a **full evaluation timed against the ten-minute criterion**, draft-invisible-then-released asserted *from the student's seat*, attest → verify → revoke. **32/32.** Needs a running server. |
| `npm run check:chart-palette` | The six colour-vision checks over the `--color-series-*` tokens, in both themes. In `npm run check`. |
| `npm run check:seo` | Crawls the sitemap and asserts the whole per-page SEO contract. **Needs a running server.** Found 191 real defects on its first run. |
| `npm run audit:layout [route]` | Computed font sizes, spacing and overflow at 390/768/1280/1536 |
| `npm run shot [route] [--as email]` | Full-page screenshots, light and dark, via CDP. **`--as` signs in first** — from Phase 7 onward, a screenshot without a session is a screenshot of the login page. |
| `npm run gen:icons` | Regenerates the favicon and PWA set from the one mark geometry |

### Conventions that are already settled — extend, never duplicate

- **`src/content/types.ts` is the contract.** Phase 3's schema must represent every field in it.
  Its enums (`SectionKind`, `ProjectStatus`, `ProofTier`, `LineageKind`, `Visibility`, `IdeaStatus`)
  are the ones the schema should declare.
- **`src/content/index.ts` holds the visibility predicate, once.** Pages call `publicProject()`,
  `publicPerson()` and friends — never the raw fixture arrays. Phase 3/4 replace the *bodies* of
  those functions with queries; the pages do not change.
- **`resolveVisibility()` decides indexability** (ADR-010). Extend it; adding a second visibility
  check is exactly how a private project leaks into a sitemap.
- **`buildMetadata()` owns title, canonical, robots and OG.** No page hand-writes them. It drops the
  brand suffix rather than truncating a title (ADR-020), and the OG image comes from `/api/og`
  (ADR-019).
- **`src/config/taxonomy.ts` and `config/navigation.ts` already exist.** One definition, several
  consumers. Navigation flags are still `planned: true`, so Header and Footer render no links yet.
- **The design tokens are complete and contrast-verified.** Never a raw hex. Filled buttons use
  `bg-primary-fill` / `bg-accent-fill` / `bg-highlight-fill` with the matching `text-fg-on-*`, never
  a ramp step (ADR-015). Type has a **usage ceiling** in `docs/DESIGN-SYSTEM.md` (ADR-018).
- **~35 UI primitives, 85 icons, 8 illustrations exist.** If you are about to write a second Button,
  stop. `/style-guide` is the reference.
- **The schema exists: 90 models, 29 enums.** Read `prisma/schema.prisma` before adding a model —
  the thing you need is probably there, including `Question`, `Answer`, `Resource`,
  `ActivityEvent` and the whole evaluation group.
- **`Viewer` is the query contract.** Every function in `src/lib/db/queries/` takes it as its
  first argument, always — including for the logged-out public, where `ANONYMOUS` is a real viewer
  rather than a null. A query without a viewer parameter is a leak waiting to happen.
- **`visibleTo(viewer)` in `queries/projects.ts` is the database-side visibility predicate,
  once.** It mirrors `src/content/index.ts`, and `db:verify` asserts the two return the same
  public set. Compose it; never write a second one.
- **Invariants live in the database.** 16 check constraints enforce the post anchor rule (ADR-006),
  approval-before-publication (ADR-010) and more. If you find yourself validating one of these only
  in a route handler, it is already enforced underneath you.
- **The contribution ledger is append-only.** Corrections are compensating events, never updates.
  Weights live in `src/config/ledger.ts` and are denormalised onto each event at write time.
- **Search: `lib/search/fts.ts` for queries, `lib/search/similarity.ts` for the duplicate
  scorer.** Vectors are trigger-maintained — never write `searchVector` from application code.
- **`can(viewer, action, resource)` in `lib/authz/policy.ts` is the ONLY place a permission is
  decided.** 41 actions, 100 matrix assertions. If you are about to write `if (role === …)` in a
  route handler, the rule belongs in `policy.ts` — a second check drifts, and the more permissive
  one wins silently.
- **A denied read returns `null`; a denied write throws `ForbiddenError`.** A 403 on a read
  confirms the resource exists, which is itself the leak.
- **There is no `viewer.role`** (ADR-029). Roles are per membership; faculty scope is per
  *subject*, not per college. `hasRoleAt(viewer, collegeId, role)` has no college-less variant on
  purpose.
- **The query is the security boundary; `proxy.ts` is a convenience** (ADR-028). Guards protect
  pages, not data. Anything new must be safe with the proxy disabled — `isolation.test.ts` asserts
  exactly that.
- **`projectResource()` in `queries/projects.ts` builds the shape `can()` expects.** Use it
  rather than assembling one by hand, and add new scoped queries to the agreement test that asserts
  `visibleTo()` and `can()` still say the same thing.
- **Passwords are scrypt with the parameters inside the hash** (ADR-026), upgraded on sign-in.
  Sessions are database rows, not JWTs (ADR-027) — which is what makes per-device revoke possible,
  and why a role change or suspension takes effect on the member's very next request with no cache
  to bust.
- **A page swaps from `src/content/` to the database in the phase that CREATES its data**
  (ADR-030). Editorial copy — changelog, FAQ, legal, knowledge, features, pricing — stays in
  `src/content/` permanently. Do not swap a page ahead of its phase.
- **Adapters carry a swap, not component rewrites** (ADR-032). `toContentProjectCard()` in
  `queries/adapters.ts` maps a database row into the shape Phase 2's components already speak.
- **Every administrative mutation calls `guard(collegeId, action)` and writes `logAudit` inside
  its transaction.** The audit log has no update or delete path, and that is the point.
- **Archive, never delete** anywhere history matters, and refuse when children would be orphaned.
- **Privacy is enforced by NOT querying** (ADR-033). `getProfile()` decides visibility before it
  selects; an unentitled field is never read. Never add a query that reads profile fields directly,
  and never filter a private field in the view.
- **A private profile and a username that does not exist are the same response** (ADR-034). Do not
  add a 404-vs-403 distinction, a different title, or anything else that separates them.
- **Skills: only project evidence promotes a claim, and only Phase 9 may write `ATTESTED`.**
  `recomputeSkills(userId)` runs on project state change, never on render.
- **Every new route needs an entry in `RESERVED_USERNAMES`** — `infer.test.ts` reads the route
  list off the filesystem and will fail otherwise.
- **`checkUsername()` expects an already-normalised string.** Call `normaliseUsername()` first.
- **Auth flows never reveal whether an account exists.** Sign-in, registration and password reset
  all answer identically for a known and an unknown address, and sign-in verifies against a decoy
  hash so a missing account does not answer faster.

- **`requireWorkspace(viewer, groupId)` is the gate for every workspace surface**, and it returns
  `null` for "this group does not exist" and "this group is not yours" alike. Never add a
  distinction — the existence of a named group inside a named class is itself information (the same
  reasoning as ADR-034).
- **Every workspace read takes a `Workspace`, not a group id.** That value can only be obtained from
  `requireWorkspace()`, so a query cannot be called with an id taken straight off the URL. It is a
  safety property, not a convenience.
- **`groupVisibleTo(viewer)` is the group visibility predicate, once**, in `queries/group.ts`. For
  the logged-out public it returns an *impossible* predicate (`{ id: { in: [] } }`) rather than an
  empty object — `{}` would match every group in the database.
- **The ledger has no update path and its transaction boundary is a type** (ADR-038).
  `recordLedgerEvent(tx, …)` accepts only an interactive-transaction client, so
  `recordLedgerEvent(db, …)` does not compile. Corrections are **compensating events** with negative
  weights; `scoreMembers` floors a member at zero so double compensation cannot invert a share.
- **The ledger is visible to every member, not only to faculty.** This is the design, not an
  oversight: a visible ledger changes behaviour during the project, and a hidden one is surveillance
  students will correctly resent. Peer review is the one asymmetry (ADR-008), enforced in
  `getReviews()` at the query — the component is not even given the viewer's id.
- **Peer review withholds the aggregate below two reviews.** With one, "the average about you" and
  "what that person said" are the same sentence.
- **A value a client component needs never lives in a query module.** Importing a runtime constant
  from `lib/db/queries/*` pulls `pg` into the browser bundle and fails the build with a trace that
  points at the component rather than the import. Types are fine (`import type` is erased);
  constants live in `config/`. That is why `config/tasks.ts` exists.
- **A `"use server"` file may export only async functions.** A number or an object export is a build
  failure, not a lint warning. That is why `config/storage.ts` exists.
- **Files are served only through `GET /api/files/[id]`**, which authorises and 404s identically for
  absent, unauthorised and quarantined. Images shown beside a name (avatars, logos) go through
  `/api/images/[key]` instead, which is **deliberately public** — an avatar appears on public pages —
  and is safe because keys are 128-bit random and SVG is refused at upload.
- **File type is decided by magic bytes, never by extension or the client's MIME type**
  (`lib/storage/file-types.ts`). A disagreement between bytes and name is a refusal with the reason
  said plainly.
- **Discussion, comments and project sections are plain text rendered through
  `components/content/rich-text.tsx`** (ADR-036). There is no HTML path and therefore no sanitiser.
  Do not add `dangerouslySetInnerHTML` anywhere — it reintroduces a threat class that is currently
  absent.
- **Charts use `--color-series-*`, not the domain palette** (ADR-037). The domain colours are
  contrast-checked against the surface, which is the wrong test for marks that must separate from
  *each other*: two of them collapse under deuteranopia. `npm run check:chart-palette` guards the
  chart set. More than a couple of series means **small multiples with a name per facet** — six hues
  cannot separate on all pairs inside the dark lightness band, and we measured that rather than
  guessing.
- **Drag-and-drop is layered over a keyboard control, never the reverse** (ADR-039). The "move to"
  menu is the primary path; the native drag events are the enhancement. This is why no drag library
  is installed.

- **`attemptTransition()` in `lib/project/lifecycle.ts` is the only place a status change is
  decided.** Nine states, thirteen edges, the actor each requires. Add edges to the table; never
  bypass it. It answers *is this move legal*; `can()` separately answers *may you make it*, and
  conflating the two produces "you cannot do that" when the honest answer is "nobody can yet".
- **A refusal names what is missing, in full.** Every incomplete section, every open milestone,
  every person who still owes a peer review — all at once, never one at a time.
- **`requireEditableProject(viewer, slug)` is the project gate**, and it returns the project for
  faculty too. "Can open" and "can edit" are separate: `capabilities(viewer, project)` answers the
  second, entirely through `can()`.
- **Progress and risk are computed, never stored** (`lib/project/progress.ts`). There is no
  `project.progress` column to go stale. A task counts toward a project **only through that
  project's own milestones** (ADR-041) — a group may own more than one project.
- **The submission snapshot is byte-stable** (`lib/project/snapshot.ts`). Keys sorted at every
  depth, every collection sorted by a declared key, and **no computed field** — a stored percentage
  would be a second copy that can disagree with the first.
- **Section guidance lives in `config/sections.ts`** and renders beside the textarea, never behind a
  tooltip (ADR-044). `minWords` is a completeness floor, never a target.
- **The derived project views are pure functions over a corpus** (`content/derive.ts`, ADR-042).
  Fixtures and the database call the same `lineageOf`, `relatedTo`, `yearsIn`. Never write a
  second implementation for a new source.
- **`publicProjectCorpus()` is wrapped in React `cache()`** — a project page reads it four times
  (itself, lineage, related, descendants) and four identical queries per render is how a page gets
  mysteriously slow.
- **`[slug]`, not `[id]`, under `/projects`.** Next refuses two different dynamic segment names at
  the same position, and `/projects/[slug]` is the public page. A slug is assigned once at creation
  and **never regenerated** — it is a public URL other people cite.
- **The project shell lives at `(app)/projects/[slug]/layout.tsx`**, not under `edit/`, so its tabs
  appear on the pages they link to. The public page is in `(site)` and is unaffected.

- **`can(viewer, …)` lets faculty *add* to a supervised group and never *alter* it.** They post in
  discussion, upload files, create tasks and schedule meetings; `file:delete` is member-only and
  section editing is gated by `capabilities().edit`. Phase 9's acceptance criterion 7 is about
  editing, not adding — a check that asserts "faculty cannot upload" fails against a correct
  product.
- **`forbidden()` and `notFound()` are not interchangeable, and the choice is a privacy decision**
  (ADR-048). `forbidden()` is for a route whose existence is not itself information — `/admin`,
  `/faculty`, `/platform`. Anything addressed by a guessable id uses `notFound()`, because a 403
  there confirms the thing exists.
- **Health thresholds live in `config/health.ts`**, per college, and `groupHealth()` is the only
  place a signal is decided. The group and the faculty dashboard call the same function and differ
  only in `AUDIENCE_FRAMING` (ADR-045).
- **A signal that fires on the *absence* of activity needs `active`** (ADR-046). Silence after
  delivery is the correct state; without the flag a dashboard flags every finished group and ranks
  nothing.
- **Gate private data in the `where` clause, never in the render.** `releasedFeedback()` filters
  `releasedAt: { not: null }` in the query, so an unreleased evaluation never leaves the database.
  A page that loads everything and filters in JSX ships the draft in the HTML payload.
- **An attestation is never automatic** (the phase spec's words, and `validateStatement()` enforces
  it): the ledger writes a draft ending in a prompt, and a submission still containing that prompt
  is refused. Codes are `NX-XXXX-XXXX-XXXX` over Crockford's alphabet without I, L, O and U, and
  `/verify` resolves them with no account — including revoked ones, which say so.

### Framework facts that fail silently if forgotten

- **Next 16 renamed Middleware to Proxy.** The file is `src/proxy.ts`. A `middleware.ts` is
  *silently ignored* (ADR-014).
- **`params` and `searchParams` are Promises.** So are the params in `sitemap` and image generators.
  Use `next typegen` and the `PageProps<'/route'>` helpers.
- **`next lint` and the `eslint` key in `next.config.ts` are gone.**
- **A Prisma scalar list has NO database default and raw SQL sees the difference** (ADR-043). The
  client returns `[]` for a `String[]` column holding `NULL`, so typed reads look fine — but a row
  created without setting the field really stores `NULL`, and `$queryRaw` returns it. Any raw query
  over a scalar list needs `COALESCE`; any write needs an explicit `[]`.
- **Next refuses two different dynamic segment names at the same route position.** `[id]` in one
  route group and `[slug]` in another, at the same depth, is a build error — not a warning.
- **A layout only wraps what is beneath it.** A shell rendering tabs must sit above every page those
  tabs link to, or the links navigate the user out of the navigation.
- **A stale `next start` is not killed by `pkill` on Windows.** The rebuild succeeds, the new
  server fails to bind, and the **old build keeps answering on port 3000** — which presents as a
  feature that does not work rather than as a stale server. Use
  `Get-NetTCPConnection -LocalPort 3000` and `Stop-Process`, and read the start log. This cost more
  time in Phase 7 than any actual bug.
- **`path.resolve`/`path.join` on a runtime value makes Turbopack trace the whole project** into
  the server bundle, and at module scope it fails the build outright during page-data collection.
  Resolve lazily and annotate with `/* turbopackIgnore: true */`.
- **A Chrome profile left locked by an orphaned headless run makes the next browser check hang
  silently**, producing no output at all rather than an error. `Stop-Process -Name chrome` and
  delete `.screenshots/.chrome-*-profile` before believing a check that printed nothing.
- **`check:seo` cannot run against `next dev`.** The crawler's concurrent first-compile load makes
  Turbopack throw `SyntaxError: Unexpected end of JSON input` on unrelated pages. Build and
  `npm run start` first.
- **`Date.now()` in a component body is a lint error** — React's purity rule, and it is right.
  Compute "has this expired" in the loader function, where it is a fact about when the data was read.
- **Prisma 7 moved the datasource URL out of the schema.** The CLI reads `prisma.config.ts`; the
  runtime needs the `@prisma/adapter-pg` driver adapter (ADR-002).
- **`npx prisma` from outside `app/` silently downloads the 8.0.0 release candidate**, whose
  `migrate` command no longer exists — it is `migration` there. Use the npm scripts.
- **`prisma migrate dev` uses a shadow database created empty**, so a migration that only *asserts*
  an extension exists makes the command permanently unusable. Try `CREATE EXTENSION IF NOT EXISTS`
  and swallow only a privilege error.
- **`prisma migrate reset` is gated behind an interactive consent prompt** in Prisma 7 and cannot
  run unattended. `scripts/db-reset.mjs` does the drop itself.
- **A killed `migrate` leaves an advisory lock held by an orphaned backend.** Symptom: P1002,
  "timed out trying to acquire a postgres advisory lock". Find it in `pg_stat_activity` and
  terminate that one backend.
- **Auth.js v5 is still `5.0.0-beta.32`, and its Credentials provider cannot use database
  sessions** — it requires JWT, so per-device revoke is impossible with it (ADR-027). Check before
  reaching for it again.
- **A `redirect()` inside a Server Action is a *soft* navigation.** `document.readyState` never
  leaves `"complete"`, so any end-to-end check that waits on readyState will sample a page that is
  about to move. Wait for the URL to change instead.
- **A stale Turbopack worker reports `Jest worker encountered 2 child process exceptions` with no
  real error.** It is not your code. Stop the dev server, `rm -rf .next/cache`, restart.
- **ESLint will happily lint whatever lands in the working tree** — the unpacked PostgreSQL
  distribution, a headless Chrome profile's bundled extensions. Both have caused an out-of-memory
  or a wall of `this`-aliasing errors. Ignore new generated directories in `eslint.config.mjs`
  as soon as they appear.

- **`forbidden()` and `unauthorized()` need `experimental.authInterrupts`** in `next.config.ts`.
  Without it they throw *"forbidden() is experimental"* and the person who hit a permission boundary
  gets a **500**. It is invisible on the happy path — the guard only runs for a user who is denied.
- **`generateStaticParams` with `dynamicParams = false` bakes the corpus at build time.** Reseeding
  after a build leaves prerendered `/projects/[slug]` pages 404ing, and `check:seo` reports it as a
  sitemap violation. **Seed, then build.**
- **A textarea's value is not in `document.body.innerText`.** An end-to-end check that reads body
  text to assert a pre-filled form will report it empty.
- **Inside a JS template literal, `
` is a newline before the browser ever sees it.** A regex built
  that way in a CDP `Runtime.evaluate` string is a syntax error at the far end. Use
  `String.fromCharCode(10)`.
- **`Date.now()` during render is an impure call** and the React compiler's `react-hooks/purity`
  rule is an *error*, not a warning. Pass `now` in as a prop from the server component.

### Process lessons that cost real time

1. **Green checks are necessary, not sufficient — look at the thing** (ADR-017). Phase 1 passed
   typecheck, lint, contrast and a clean build while shipping a doubled `<title>`, a one-size
   favicon and two logo geometry defects.
2. **Verify an edit landed by measuring its effect, not by the edit succeeding.** Prettier's
   Tailwind class sorting silently no-ops string replacements against source you have not re-read.
3. **Write the audit before the content, and run it often.** 191 violations found at once is
   recoverable; 191 found at launch is not.
4. **Test a heuristic against real data, never against data you wrote to test it.** Phase 3's
   duplicate scorer passed its unit test at 0.562 on invented prose and scored 0.420 — a failure —
   on the actual fixture pair, because real problem statements differ wildly in length (ADR-023).
   The tests now read `src/content/` directly so they cannot be easier than production.
5. **Write the integrity suite expecting it to find things.** `db:verify` failed on its first run
   and both failures were genuine gaps in the *schema*, not the seed — one became ADR-022. An
   assertion that has never failed has not yet earned your trust.
6. **Prove the pipeline on something small before building the large thing.** A four-line probe
   schema surfaced the Prisma 7 config change, the shadow-database problem and the migrate flow in
   minutes, rather than in the middle of a 90-model migration.
7. **Check a named dependency before adopting it, even when the plan names it.** The Phase 4 spec
   said "Auth.js v5, JWT sessions". Auth.js v5 is a beta, and its Credentials provider cannot do
   database sessions at all — which two of that same phase's acceptance criteria required. Thirty
   seconds of `npm view` and one documentation page changed the architecture (ADR-027).
8. **A test that reads a mutable row is not a fixture.** Phase 4's password test asserted the
   *seeded* hash format, then failed the moment a real sign-in upgraded it — which was the feature
   working. Construct the input the test needs; do not borrow a row that the system is supposed to
   change.
9. **Every denial suite needs a positive control.** A policy that denied everything would pass every
   cross-college assertion. One row proving a member *can* reach their own group is what makes the
   other ninety-nine mean something.
10. **Test a parser against an ugly file, not a generated one.** Phase 5's CSV tests were written
    with a BOM, CRLF, non-breaking spaces, smart quotes and Excel's `="0022071"` wrapper — and the
    wrapper case found a real bug: the parser treated *any* quote as a delimiter, where RFC 4180
    quotes only at field start.
11. **Refuse data a spreadsheet has already corrupted; do not convert it.** `2.2008E+04` is a roll
    number Excel has truncated. Importing it silently is worse than failing, because nobody notices.
12. **Before believing a failing route, check which server answered.** A stale `next start` keeps
    port 3000 and the new one fails to bind — so a "404 on a route I just built" was an old build.
13. **Assert a rule against the real thing it constrains, not against its own configuration.** The
    reserved-username test reads the route list off the filesystem; asserting the blocklist against
    itself would have proved nothing, and reading the routes found five that were missing.
14. **When a test fails, check the test's premise before the code's logic.** Phase 6's indexability
    test looked for "a public profile at an unverified college", found somebody who was *also* at two
    verified ones, and blamed the code for its own faulty search.
15. **Response size is not evidence of a leak.** Next streams metadata and its position varies
    between requests to the same URL. Compare rendered content, not byte counts.
16. **A denial suite's positive control is what finds the broken fixture.** Phase 7's file check
    asserted "a member CAN fetch their own file" before asserting the refusals — and that is what
    revealed the seed had 90 file rows with no bytes behind them. Every refusal was passing
    trivially, because the file 404'd for everybody. Lesson 9 said a denial suite needs a control;
    this is the first time the control caught a defect in the *fixture* rather than the policy.
17. **An end-to-end check must select on hooks it owns, never on roles it guesses.** The board's
    keyboard assertion selected `button[aria-haspopup=menu]`, matched the header's **theme
    toggle**, and reported a pass. Explicit `data-*` hooks cannot drift onto another component.
18. **Check what your own assertion string also matches.** The avatar check looked for "not
    accepted" anywhere on the page and caught the form's own static hint, reporting a refusal on
    an upload that had succeeded. Scope the match to the element that carries the result.
19. **Before believing four failures, check whether one thing explains all four.** A board with no
    `data-task` attributes, in a build that provably contained them, was a stale server — not four
    bugs. When a cluster of assertions fails together, suspect the environment first.
20. **A green check that prints nothing is not a green check.** `check:auth` defaulted to port
    3001 for four phases and exited 0 having tested nothing. Assert that a check *ran*, not only
    that it did not fail.
21. **Run every end-to-end check twice before trusting it.** `check:admin` created a department with
    a fixed code that is unique per college, so it passed exactly once per database and failed on
    every run after — and the *next* assertion masked it by finding the first run's audit entry. A
    check that mutates state must generate everything the schema requires to be unique.
22. **Exercise the path the seed does not produce.** Two defects in two phases were found only by
    creating a row through the interface rather than the fixtures — a file with no bytes behind it,
    and a scalar list stored as NULL. The seed is a good demo world and a poor adversary.
23. **A criterion written casually is still a criterion.** "Progress starts at 0%" went into the
    browser check as an afterthought and caught a real bug: a new project inheriting its sibling
    project's closed tasks. Assert the boring thing.

24. **Run the browser checks against `npm run start`, never `npm run dev`.** Under `next dev` the
    sitemap sweep reported a *different random set* of 500s on every run — Turbopack compiling on
    demand under parallel load, surfacing as `SyntaxError: Unexpected end of JSON input` inside
    Next's own cache — and the workspace latency budget measured 1294ms against 800ms. Every one was
    clean in production. A flaky check trains you to ignore it, which is worse than not having it.
25. **Assert from the other seat.** Criterion 9 is "a draft is invisible to students". Signing in
    *as the student* to check it is what revealed that a **released** evaluation was equally
    invisible: the feature existed in the database and in no interface. Checking it from the faculty
    side would have passed.
26. **When a check disagrees with the product, read the spec before fixing the product.** The
    faculty check first asserted "no upload control" and failed against behaviour the spec
    explicitly wants — faculty *may* add, they may not edit. It had also matched the discussion
    page's own empty-state prose rather than any control, which is the Phase 7 avatar-hint trap in a
    new costume. **Assert against the control, never against the copy.**
27. **A check that reports one word tells you nothing.** `check:admin` failed with "Uncaught" for a
    full debugging round because it used `exceptionDetails.text` instead of the thrown object's
    description — and the underlying cause was the documented stale-cookie trap that
    `check-workspace.mjs` already had a fix and a comment for. **When three scripts share a harness,
    fix the harness in all three.**
28. **Look at the screenshot, then look at the numbers on it.** `/faculty` rendered perfectly and
    said *four of four groups need attention*. Nothing was broken; the ranking was meaningless. Two
    ADRs came out of one image (ADR-046, ADR-047), and a third from the page beside it (ADR-050,
    eight seeded attestations carrying codes the verifier rejects).

---

## 9. The working rhythm (non-negotiable)

1. Open `PROGRESS.md`. Find the first phase not marked ✅ Complete.
2. Open `docs/phases/phase-NN-*.md`. Work the deliverable checklist top to bottom.
3. Tick each deliverable in the phase file as you finish it (`- [ ]` becomes `- [x]`).
4. When every deliverable is ticked and the acceptance criteria pass, **fill in the Phase Summary
   block at the bottom of the phase file.** This block is what a future session reads instead of
   re-deriving the work. It is mandatory.
5. Update the status row and the session log in `PROGRESS.md`, and log any non-obvious choice in
   `docs/DECISIONS.md`.
6. Commit with `phase(NN): <what changed>`.

**Never start phase N+1 while phase N's summary block is empty.** That is exactly how context is
lost, and this whole documentation system exists to prevent it.

## 10. Status legend used everywhere

| Symbol | Meaning |
| --- | --- |
| ⬜ Not Started | No work begun |
| 🟨 In Progress | Actively being built |
| 🟦 Blocked | Waiting on a decision or dependency (state which) |
| 🟧 Review | Built, awaiting verification against acceptance criteria |
| ✅ Complete | All deliverables ticked, acceptance criteria pass, summary written |
| ⏸️ Deferred | Consciously postponed (state to which phase) |

## 11. Vocabulary — use these words consistently

| Term | Means |
| --- | --- |
| **Workspace** | A group's private collaboration space: tasks, files, discussion, meetings, ledger. |
| **Project Page** | The structured record of a project: problem → research → solution → prototype → testing → result. Private, college-only or public. |
| **Milestone** | A dated checkpoint inside a project, owned by a member, closed with a peer review. |
| **Attestation** | A named faculty member vouching for a specific contribution or project outcome. |
| **Lineage** | The recorded parent/child relationship when a group builds on a previous project. |
| **Idea** | A pre-project proposal in the Idea Hub, status Idea → Looking for Team → In Development → Testing → Completed. |
| **Archive** | The permanent, citable, read-only record of a completed project. |
| **Ledger** | The per-member contribution record inside a workspace. |
