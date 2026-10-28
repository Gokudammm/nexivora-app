# Architecture Decision Record

Every non-obvious choice, with its reasoning and what it costs. Append, never rewrite. If a
decision is reversed, add a new ADR that supersedes it and mark the old one.

Format: **Context → Decision → Consequences.**

---

## ADR-001 — Next.js 16 App Router with TypeScript

**Status:** Accepted · 2026-09-08

**Context.** SEO is a hard requirement and most of the product is dynamic. A client-rendered SPA
would put every public page into Google's rendering queue, which `SEO Basic.txt` describes as a
separate, deferred phase of indexing.

**Decision.** Next.js 16 App Router, TypeScript strict with `noUncheckedIndexedAccess`, Server
Components by default.

**Consequences.** Public pages ship real HTML on the first response. Route-level code splitting,
per-route metadata and image/font optimisation come free. The cost is the mental overhead of the
server/client boundary, which is real but is exactly the boundary we want to think about anyway.
`noUncheckedIndexedAccess` will occasionally be irritating and will catch the class of bug that
breaks a demo.

---

## ADR-002 — Prisma as the ORM, pinned

**Status:** Accepted · 2026-09-08

**Context.** Sixty models, real migration history, and a seed script that must rebuild a demo world
reliably.

**Decision.** Prisma, with the version pinned exactly in `package.json` — not a caret range.

**Consequences.** Type-safe queries and a real migration history. **Pinning is deliberate:**
Prisma's `latest` dist-tag has previously pointed at a release candidate, and a major version has
moved the datasource URL and required a driver adapter. An ORM upgrade should be an intentional
piece of work, never something `npm install` does to you on a Tuesday. Raw SQL is used for the
full-text search path, where Prisma's query builder cannot reach the GIN index.

---

## ADR-003 — PostgreSQL in development *and* production, not SQLite-then-MySQL

**Status:** Accepted · 2026-09-08 · **Supersedes the pattern used in the KaushalSetu project**

**Context.** The reference project used SQLite in development and MySQL in production, abstracted
by Prisma. That works when the database is a plain store. It does not work here, because two of
Nexivora's core features are database features:

1. **Global search** across projects, people, ideas and posts, which needs `tsvector` + GIN.
2. **Duplicate-project detection**, which needs `pg_trgm` trigram similarity.

Neither exists in SQLite. Developing against SQLite would mean the two most important queries in
the product are stubbed locally and first executed in production.

**Decision.** PostgreSQL 16 everywhere. Local via Docker or the Windows installer.

**Consequences.** One more setup step for a new developer, documented in `docs/DEPLOYMENT.md` with
two paths. In exchange: search and similarity are real from Phase 3, dev matches production, and
`ILIKE`, `unaccent`, JSONB, arrays, partial indexes and `LISTEN/NOTIFY` are all available. The
`LISTEN/NOTIFY` point matters later — it is the multi-process upgrade path for realtime without
adding Redis.

**Rejected:** Supabase and Firebase — both are excellent until the pricing cliff arrives exactly
when the product succeeds, and both make the "self-hosted on a cheap VPS" story impossible.

---

## ADR-004 — Auth.js v5 with credentials, not a hosted identity provider

**Status:** Accepted · 2026-09-08

**Context.** Auth0, Clerk and WorkOS all price per monthly active user. A college pilot is
thousands of MAU on day one, which is precisely the audience these products charge for.

**Decision.** Auth.js v5, credentials provider, JWT sessions, bcrypt. Institutional email domain
verification is the trust mechanism. Google OAuth is deferred to Phase 16 as a convenience.

**Consequences.** No per-user cost, ever, and no external dependency in the login path. We own
password storage, reset flows and rate limiting — all specified in `docs/SECURITY.md`. Deferring
OAuth is deliberate: allowing any Gmail account to sign in would undermine the institutional trust
gate, which is the thing that makes the network credible.

---

## ADR-005 — Server-Sent Events for realtime, not WebSockets

**Status:** Accepted · 2026-09-08

**Context.** Notifications, presence and new-message indicators need to reach the client without a
refresh. The obvious answer is Socket.io.

**Decision.** SSE (one long-lived `GET /api/sse` per user) for server→client, ordinary server
actions for client→server, and polling for chat message lists. All behind `lib/realtime/`.

**Consequences.** No second server process, no sticky-session configuration, no extra dependency,
and it survives a plain Nginx reverse proxy — *provided* `proxy_buffering off` is set on that
route, which is the classic way this breaks and is therefore in the runbook. SSE is
unidirectional, which is fine because every client→server action already has a server action.
The upgrade path, if it is ever needed, is one file: swap the in-process emitter for Postgres
`LISTEN/NOTIFY`, then for Socket.io if genuinely required.

---

## ADR-006 — The feed is anchored, not free-form

**Status:** Accepted · 2026-09-08 · **This is a product decision with architectural consequences**

**Context.** The brief asks for an "academic feed" where users post updates, ideas, achievements
and questions. Every student-network product that has shipped this has watched it die: without the
social pressure of a consumer network, nobody posts, the feed is empty, and an empty feed makes the
whole product feel abandoned.

**Decision.** Every post **must** reference an anchor — a project, an idea, a question or a
resource — enforced by a database check constraint, not by convention. And posts are created two
ways: authored by a user, or **generated** from a domain event (milestone closed, prototype
uploaded, project published) through the same `createPost()` path.

**Consequences.** The feed is never empty, because using the product fills it. Content is
inherently about something, so it is inherently useful and inherently linkable. The cost is that
"just saying something" is impossible — and that is the point. If we later want a discussion
surface, it is the Questions type, which is already an anchor.

---

## ADR-007 — The Contribution Ledger is append-only and transactional

**Status:** Accepted · 2026-09-08

**Context.** The ledger's entire value is that it can be trusted. A record that can drift from the
actions that produced it is worse than no record, because it looks authoritative.

**Decision.** `LedgerEvent` is append-only, and every event is written **inside the same database
transaction** as the action that produced it. Closing a task writes the task update and the ledger
event together, or neither happens. Event weights live in `config/ledger.ts`, never at the call
site.

**Consequences.** The ledger cannot be retroactively edited, and it cannot disagree with the
workspace. Corrections are new compensating events, not mutations — the same discipline
accounting uses, for the same reason. Weights being configuration means they can be tuned against
real usage without a migration, which they will need to be.

---

## ADR-008 — Peer reviews are private in one direction

**Status:** Accepted · 2026-09-08

**Context.** Peer review of group members is the mechanism for surfacing free-riding. It only
works if people answer honestly, and people do not answer honestly when the person they are rating
will read it tomorrow.

**Decision.** A member sees **only the aggregate** of reviews about them, and never who said what.
Faculty see the full detail. A member always sees their own submitted reviews.

**Consequences.** Honest reviews become possible. The cost is that a malicious low rating is harder
for the rated member to contest — mitigated because faculty see the detail and the ledger provides
an objective cross-check that does not depend on anyone's opinion.

---

## ADR-009 — Project sections are rows, not a JSON blob

**Status:** Accepted · 2026-09-08

**Context.** A project record has nine sections. The easy schema is one `content` JSON column.

**Decision.** One `ProjectSection` row per section, with an enum for the section kind.

**Consequences.** Faculty can leave feedback on a single section. Each section has its own edit
history, word count and completion state, so "project progress" is computable rather than guessed.
The public page renders real `<h2>` blocks, which is what makes a project page eligible for
featured snippets. And a half-finished project is a partial set of rows rather than an
unparseable object. The cost is more joins, handled with a single `include`.

---

## ADR-010 — Visibility is data; indexability is derived

**Status:** Accepted · 2026-09-08

**Context.** A student project can be private, group-only, class-only, college-only or public, and
can additionally be under an IP embargo. Search-engine indexability must follow from that, and it
must be impossible for the two to disagree.

**Decision.** `noindex` and sitemap inclusion are **computed** from `visibility` and `embargoUntil`
by one function, `resolveVisibility()`. No page sets robots directives independently.

**Consequences.** A private project cannot leak into the sitemap through a forgotten flag, which is
a privacy failure as much as an SEO one. The cost is that every public page must call the resolver
— enforced by `scripts/check-seo.mjs`, which crawls the sitemap and asserts nothing non-public
appears in it.

---

## ADR-011 — All imagery is SVG, including avatars and project covers

**Status:** Accepted · 2026-09-08

**Context.** A network product wants imagery everywhere, and imagery normally means uploads,
storage, resizing, CDN cost and licensing.

**Decision.** Every image is SVG. Icons are inline components. Illustrations are components.
**Avatars default to a deterministic SVG identicon generated from the user id.** **Project covers
are generated SVG** from the project's domain colour, title and SDG icons. OG images are generated
at request time from the same visual language.

**Consequences.** Zero raster assets, zero image-optimisation pipeline, zero licence risk, zero
CLS, perfect scaling, and free theming through `currentColor`. Critically, **every project looks
intentional with no upload effort** — which removes the single biggest reason a student would leave
a project page looking half-finished. The cost is that the illustration style must be geometric
rather than figurative, which is a constraint the design system embraces rather than fights.

---

## ADR-012 — Deterministic first, AI last

**Status:** Accepted · 2026-09-08

**Context.** AI credits are scarce, and an AI feature that fails takes its whole surface down with
it.

**Decision.** Every intelligent-seeming feature ships a deterministic implementation first:
teammate matching is skill-overlap arithmetic with a visible explanation; search is Postgres FTS;
similarity is trigram plus Jaccard; feed ranking is a scoring function; the assistant is a command
palette over a structured route and help index. Phase 18 layers AI **on top**, behind an
`AIProvider` interface with a `NullProvider` fallback, response caching, per-user quotas and a hard
global budget cap.

**Consequences.** `AI_ENABLED=false` is a fully working product, not a degraded one. Every
recommendation is explainable, which matters enormously when a faculty member asks why a student
was suggested for a team. Running out of credits mid-demo changes quality, not function.

---

## ADR-013 — Go to market as a tool, not as a network

**Status:** Accepted · 2026-09-08 · **The most important non-technical decision here**

**Context.** A social network with no users is worthless to its first user. Nexivora's cold-start
problem is severe: profiles, feed and discovery are all worth nothing on day one.

**Decision.** **We do not launch as a network.** We launch as a tool that a single class uses for a
single semester: the group workspace and the faculty dashboard. Those are valuable to a group of
five people with nobody else on the platform. The feed, discovery, archive and network effects
accumulate as a by-product.

**Consequences.** This is why Phase 7 (workspace) is the largest phase and why Phase 10 (feed)
comes after it rather than before. It is also why the first sales conversation is with one faculty
member and not with a Vice-Chancellor. Full reasoning in `docs/BUSINESS-MODEL.md`.

---

## ADR-014 — Next.js 16 breaking changes, verified against the bundled docs

**Status:** Accepted · 2026-09-08 · Discovered during Phase 0

**Context.** `create-next-app@latest` installed **Next.js 16.3.4** with React 19.2.8, not the 15.x
these plans were written against. The scaffold also writes an `AGENTS.md` warning that "this is NOT
the Next.js you know" and pointing at `node_modules/next/dist/docs/`. Those docs were read rather
than assumed, and they contain four changes that directly affect phases not yet built.

**Decision.** Adopt 16.3.4 and correct the plan now, rather than discovering each change mid-phase.

**The changes that matter to us:**

1. **Middleware is now Proxy.** The file is `src/proxy.ts` and the export is `proxy`. Behaviour is
   unchanged. **A `middleware.ts` file is silently ignored** — which would have looked like a broken
   auth guard in Phase 4 rather than a missing file. `docs/phases/phase-04-auth-rbac.md` and
   `docs/ARCHITECTURE.md` are corrected.
2. **Async request APIs are now mandatory.** `params`, `searchParams`, `cookies()`, `headers()` and
   `draftMode()` are Promises; the synchronous compatibility shim from 15 is gone. This affects
   every dynamic route from Phase 2 onward. `next typegen` generates `PageProps<'/route'>`,
   `LayoutProps` and `RouteContext` helpers — use them rather than hand-writing prop types.
3. **`opengraph-image` and `sitemap` generators also receive Promises** for `params` and `id`.
   Phase 2 builds both, so this is a Phase 2 note, not a footnote.
4. **`next lint` and the `eslint` key in `next.config.ts` are removed.** Linting is a separate step;
   `npm run lint` calls `eslint` directly and `npm run check` chains it. Leaving the config key in
   place is a type error, which is how this was found.

**Consequences.** Turbopack is the default bundler, so builds are fast (41s cold). React 19.2 brings
View Transitions and `useEffectEvent`, neither of which we need yet. The real cost is that training
data and most tutorials describe Next 14/15 conventions — so **read
`node_modules/next/dist/docs/` before writing routing, metadata or proxy code**, in every phase, not
just this one.

---

## ADR-015 — Filled controls use explicit `*-fill` tokens, not ramp steps

**Status:** Accepted · 2026-09-08 · Discovered by measurement in Phase 0

**Context.** The token system originally paired white text with `accent-600` and `highlight-600` for
filled buttons. The contrast audit measured those pairs at **3.68:1** and **3.19:1** — both below the
4.5:1 AA requirement for body text. Then, after correcting them, the amber fill itself measured
**2.15:1** against a white surface, failing the 3:1 requirement for UI boundaries (WCAG 1.4.11).

Neither failure is visible to the eye. Both would have shipped.

**Decision.** Three things:

1. Introduce `--color-primary-fill`, `--color-accent-fill` and `--color-highlight-fill`. **A
   component never picks its own ramp step for a filled background** — it uses these, so a fill and
   its foreground cannot drift apart.
2. Accent fills use the 700 step with white (5.36:1). Highlight fills use the 500 step with a very
   dark brown foreground (7.11:1), which is also the better-looking amber.
3. A highlight-filled control **always** carries `--color-highlight-fill-border`, because a bright
   amber cannot define its own edge against white.

**Consequences.** 94 measured pairs now pass in both themes. The audit runs in `npm run check` and
fails the run on any regression, so this cannot silently come back. The wider lesson is the one the
design system already states and this phase confirmed: **measure contrast, do not eyeball it.**

---

## ADR-016 — The theme is external state, read with `useSyncExternalStore`

**Status:** Accepted · 2026-09-08 · Phase 1

**Context.** The first implementation mirrored `localStorage` into `useState` inside a mount effect.
React 19's `react-hooks/set-state-in-effect` rule rejected it, correctly: that pattern causes a
cascading render on every mount, and it does not react to the theme changing anywhere else.

**Decision.** The theme is read with `useSyncExternalStore`, subscribing to both the `storage` event
and the `prefers-color-scheme` media query. The inline `themeInitScript` still stamps `data-theme`
on `<html>` before first paint — that part is not optional, and it is what prevents the flash.

**Consequences.** No cascading render, and **two open tabs now stay in step**, which the effect
version did not do. The server snapshot is `"system"`, which is safe because the markup it produces
is theme-neutral: the actual theme comes from the init script and from CSS media queries, never from
the React tree.

**The wider lesson**, which applies to Phases 7, 10 and 18: when this lint rule fires, it is usually
pointing at genuinely external state. Suppressing it would have hidden a real defect.

---

## ADR-017 — Verify the design visually, and keep the tool

**Status:** Accepted · 2026-09-08 · Phase 1

**Context.** Phase 1 passed typecheck, lint, the contrast audit and the build on the first attempt.
It still contained four real defects, none of which any of those checks can see:

1. `<title>Style guide · Nexivora · Nexivora</title>` — the root layout's title *template* applying
   on top of `buildMetadata`'s own suffix. **This would have hit all ~45 Phase 2 pages.**
2. `favicon.ico` silently containing one size instead of three — Pillow's ICO writer ignores
   `append_images` and derives entries by downscaling whatever image it is given.
3. The stacked lockup's wordmark off-centre by about six units.
4. The horizontal lockup carrying roughly 24% dead trailing space in its viewBox.

**Decision.** A visual pass is part of a phase's verification, not an optional extra. `npm run shot`
(`scripts/screenshot.mjs`) drives Chrome over the DevTools Protocol and captures a route full-page
in light and dark.

CDP rather than Chrome's `--screenshot` flag, for two reasons that are not preferences: only CDP can
emulate `prefers-color-scheme` (the obvious-looking
`--blink-settings=preferredColorScheme=2` renders a blank page), and only CDP can capture beyond the
viewport.

**Consequences.** Dark mode and long pages are now verifiable, and Phases 2 and 16 both need exactly
this. The cost is a development-only script and a `.screenshots/` directory that is gitignored.

**The rule this sets:** *green checks are necessary, not sufficient.* Look at the thing.

---

## ADR-018 — Type scale has a measured usage ceiling, enforced by an audit script

**Status:** Accepted · 2026-09-09 · Phase 1 correction

**Context.** The Phase 1 home page shipped an h1 at **60px** on desktop (`lg:text-6xl`), a 156px gap
between the header and the first content, and `Section` padding of 112px. Reviewed on a real screen
it read as oversized and brochure-like — the consumer-marketing register, not the "credible academic
infrastructure" the design intent calls for.

The report that surfaced it was a screenshot from a browser running at ~133% zoom, which is exactly
why this needed measuring rather than arguing: a screenshot cannot separate *"the type is too
large"* from *"the browser is zoomed"*. Both were true, and only one was fixable.

**Decision.**

1. `scripts/audit-layout.mjs` (`npm run audit:layout`) drives Chrome over CDP and reports **computed**
   font sizes, section padding, hero offset, document height and horizontal overflow at 390 / 768 /
   1280 / 1536, at a known 100% zoom and dpr 1.
2. `docs/DESIGN-SYSTEM.md` gains a **usage ceiling** table: what the scale defines versus what pages
   may actually use. Hero h1 tops out at 48px; every other h1 at 36px; `6xl` and `7xl` are unused
   and need a stated reason.
3. `Section` padding drops from 64/96/112 to **48/64/80**.

**Measured effect** on the home page:

| | Before | After |
| --- | --- | --- |
| h1 @ 1280 | 60px | **48px** |
| Hero top gap @ 1280 | 156px | **107px** |
| Hero top gap @ 390 | 108px | **76px** |
| Lead @ 390 | 18px | **16px** |
| Document height @ 1280 | 1644px | **1362px** (17% less scrolling) |

**Consequences.** The audit runs on demand rather than in `npm run check`, because it needs a running
dev server. Phase 2 should run it on the home page and one content template before calling itself
done — a type scale that drifts across 45 pages is far more expensive to fix than across two.

**Two process lessons, both worth more than the fix:**

- **Prettier's Tailwind class sorting had already reordered the class strings**, so two of the four
  edits in the first pass silently matched nothing and no-opped. The audit caught it because the
  numbers did not move. *Verify an edit landed by measuring the effect, not by the edit reporting
  success.*
- The same pass exposed an unrelated defect the numbers could not show: with navigation still empty
  in Phase 1, the mobile header rendered **only a theme toggle**, because both auth CTAs were
  `hidden sm:inline-flex`. The primary CTA is now visible at every width.

---

## ADR-019 — OG images come from a route handler, not the file convention

**Status:** Accepted · 2026-09-09 · Phase 2

**Context.** Next's file-based `opengraph-image.tsx` convention is the obvious choice and it failed
here twice, in two different ways:

1. Setting `image: "/projects/{slug}/opengraph-image"` by hand 404s, because **Next content-hashes
   generated image filenames** (`opengraph-image-umay0l`). The URL cannot be constructed.
2. Removing that override and relying on the convention produced **no `og:image` at all on any of
   127 pages** — because `buildMetadata` sets `openGraph`, and setting `openGraph` in a page's
   exported metadata suppresses the file-convention image.

Neither failure is visible in a browser. Both were found by `scripts/check-seo.mjs`.

**Decision.** A route handler at `/api/og` generates the card from query parameters, and
`buildMetadata` constructs that URL for every page. Inputs are length-capped and the accent colour
is restricted to the contrast-checked domain set, because the endpoint renders whatever it is given.

**Consequences.** Every page gets a tailored card with no per-route file, a URL that can be
constructed and asserted, and no hash surprises. The cost is one extra route and losing Next's
automatic image dimensions — so `buildMetadata` states 1200×630 explicitly, which it knows because
the template is fixed.

**The wider rule:** when a framework convention and an explicit API overlap, check which one
actually wins in the rendered output. Both of these looked correct in source.

---

## ADR-020 — Titles drop the brand before they drop the content

**Status:** Accepted · 2026-09-09 · Phase 2

**Context.** The SEO contract caps titles at ~60 characters. Real content titles do not respect
that: *"Scheduling canal water across multiple farms under a shared budget"* is 66 characters before
any suffix, and adding `· Nexivora` costs another 11.

**Decision.** Three rules, in order:

1. **Constructed suffixes are removed.** `{title} — {domain} project`, `{title} — project idea` and
   `{title} — {organisation}` all went. They added no information a reader needed and cost 15–30
   characters each.
2. **`buildMetadata` drops the site-name suffix when it would exceed the limit.** The content title
   is the signal and the brand is not; truncating the signal to keep the brand is the wrong trade,
   and publishers make the same call.
3. **Content titles longer than 60 characters get shortened at the source.** A handful of fixture
   titles were rewritten. This is a content decision, not a technical one, and it belongs in the
   content.

**Consequences.** All 127 titles are unique and within the limit, and the audit enforces it. The
rule that "under ~60 characters" is a display heuristic rather than a penalty is still true — but
having a hard limit and honouring it is more useful than having one and quietly exceeding it.

---

## ADR-021 — Zero-install PostgreSQL for development

**Status:** Accepted · 2026-09-09 · Resolves blocker B-1

**Context.** ADR-003 requires real PostgreSQL in development, because full-text search and `pg_trgm`
duplicate detection are core product features and stubbing them locally means the two most important
queries in the product are first executed in production.

That requirement blocked Phase 3 for three sessions, because every standard way of getting Postgres
onto a Windows machine has friction the owner should not have to absorb:

| Option | Why it was rejected |
| --- | --- |
| EDB installer via `winget` | Needs UAC elevation, cannot run non-interactively, and installs a system service and a Start Menu entry the project did not ask for |
| Docker Desktop | Large install, needs virtualisation enabled in BIOS on some machines, and is a second thing to keep running |
| `embedded-postgres` on npm | A reasonable wrapper around the same binaries, but **every one of its releases is tagged `-beta`**, and a permanently-beta dependency in the dev bootstrap is a risk with no upside |
| SQLite locally | Rejected in ADR-003 and still rejected. It has neither `tsvector` nor `pg_trgm`. |

**Decision.** `scripts/db.mjs` downloads the **official PostgreSQL 16 binaries-only ZIP** — the same
build EDB ships, without the installer — into a gitignored `app/.postgres/`, initialises a cluster,
and runs it as an ordinary user process.

```
npm run db:up        download if needed, init if needed, start, create db + extensions
npm run db:status    is it running, and does pg_trgm actually work
npm run db:down      stop
npm run db:destroy   delete the data directory, keep the binaries
```

Three details that matter:

- **Port 5433, not 5432**, so it can never collide with an existing PostgreSQL install.
- **`listen_addresses = 'localhost'`.** This is a development database on a developer's machine; it
  has no business accepting connections from the network.
- **`db:up` verifies rather than assumes.** It runs `similarity('nexivora','nexivore')` and fails if
  the extension is not genuinely working — a `CREATE EXTENSION` that succeeded is not proof.

**Consequences.** A new developer runs `npm install && npm run db:up && npm run dev` and has real
PostgreSQL 16.8 with real contrib extensions. No installer, no admin rights, no Docker, no beta
dependency. Dev is production, which is the entire point of ADR-003.

The costs, stated plainly: a one-time ~300 MB download, and the script is **Windows-only**. On macOS
and Linux the package manager or the Docker one-liner in `docs/DEPLOYMENT.md` is a better path and
the script says so and exits rather than pretending. Production is unaffected — Phase 17 installs
PostgreSQL normally on the VPS.

**Verified:** PostgreSQL 16.8 running on 5433, database created, `pg_trgm`, `unaccent` and `citext`
installed, and `similarity('nexivora','nexivore') = 0.6363636`.

---

## ADR-022 — Cross-college collaboration uses a GUEST membership, not a membership-shaped hole

**Date:** 2026-09-09 · **Phase:** 3 · **Status:** Accepted

**Context.** `scripts/verify-db.mjs` asserts that every group member holds a membership at that
group's college — the isolation rule, which nearly every authorisation question in the product
reduces to. It failed on three rows.

They were not a seeding bug. The fixtures deliberately contain inter-college work: the campus
air-quality mesh is "built jointly by teams at two colleges", and its backend lead, `arjun-rao`, is
a Meridian student on two Nexivora projects and one Greenfield project. The architecture already
said cross-college work happens "by an explicit partnership plus a per-project guest membership" —
but `MembershipState` had no way to say "guest", so the data said nothing at all.

**Decision.** Add `MembershipState.GUEST`. A guest holds a real `Membership` row at the host
college, so every "is this user a member of this college" check keeps working unchanged, and the
state marks them as belonging elsewhere: never in the college directory, never in its statistics,
visible only in the groups they were added to.

Two things are required together, and `db:verify` asserts both:

1. The guest holds a `GUEST` membership at the host college — nobody holds full membership at two.
2. The two colleges have an **accepted `CollegePartnership`**.

The seed derives the partnerships from the guest memberships rather than hardcoding them, so the two
can never drift apart.

**Alternatives rejected.**

- *Give the guest an ordinary `ACTIVE` membership.* They would appear as a full student of a college
  they do not attend — in its directory, its counts, and its accreditation export.
- *Allow group members with no membership at the group's college.* This is the tempting one, and it
  is the worst: it turns a single predicate into a special case that every future authorisation
  check has to remember. The one that forgets is a data leak.

**Consequences.** Isolation stays one predicate. The exception is explicit, auditable, and requires
a partnership that somebody had to accept. Phase 5's college surfaces must filter guests out of
directories and counts — the state makes that a filter rather than a judgement call.

---

## ADR-023 — Problem similarity is the geometric mean of Dice and containment, not Jaccard

**Date:** 2026-09-09 · **Phase:** 3 · **Status:** Accepted

**Context.** The duplicate detector's unit test used invented problem statements of similar length
and passed comfortably at 0.562. Run against the **actual seeded pair** — an archived project with a
full multi-paragraph PROBLEM section, and the proposed near-duplicate that covers the same ground in
two sentences — it scored **0.420 and failed**, on a pair constructed specifically to be caught.

The cause is structural, not a tuning miss. Jaccard divides by the union, so a short statement almost
entirely subsumed by a long one still scores low purely because the long one has more trigrams. Real
problem statements differ enormously in length; the test's did not.

**Decision.** Measure candidates against the whole corpus and pick on the numbers:

| measure | near-duplicate | worst unrelated pair | |
| --- | --- | --- | --- |
| jaccard | 0.420 | 0.278 | misses the threshold |
| dice | 0.501 | 0.351 | |
| containment | 0.704 | 0.368 | rates unrelated work "related" |
| geo(jaccard, containment) | 0.521 | 0.316 | |
| **geo(dice, containment)** | **0.585** | **0.359** | **chosen** |

Containment (`|A ∩ B| / min(|A|, |B|)`) fixes the length asymmetry but is too generous alone — it
rated an attendance-recognition project as related to an irrigation controller. Requiring **both**,
via their geometric mean, demands genuine shared vocabulary *and* subsumption. It is the only
candidate that gets all three semantic cases right.

Two guards came out of the same exercise:

- **`MIN_CONTAINMENT_TRIGRAMS = 60`.** Below roughly a dozen content words, containment is noise: a
  six-word fragment is "50% contained" in almost any longer document. Under the floor the score
  falls back to Dice alone.
- **`PROBLEM_CORROBORATION_FLOOR = 0.15`.** Topic and stack overlap now *scale with* the problem
  match rather than adding to it. Two projects sharing only Python, PostgreSQL and React scored
  0.203 — over the "related" line on stack alone, on problems as different as bus routing and
  hospital triage. Half a department shares a stack.

**Consequences.** The scorer is more code and needs its comment block. In exchange the seeded
duplicate is caught with a wide margin and unrelated work is left alone. `pg_trgm`'s `similarity()`
is still plain Jaccard, so the SQL shortlist deliberately over-fetches at a low floor and lets the
weighted scorer decide — and `db:verify` asserts the shortlist actually returns the pair the scorer
flags, because an index and a scorer that disagree under-report silently.

**The lesson, recorded because it generalises:** the unit test was easier than production and
therefore told us nothing. It now reads the fixtures directly, so it cannot drift back.

---

## ADR-024 — Node's built-in test runner, not a test framework

**Date:** 2026-09-09 · **Phase:** 3 · **Status:** Accepted

**Context.** Phase 3 needed unit tests for the similarity scorer — a heuristic nobody has tested
against known pairs is just an opinion. The reflex is to add Vitest or Jest.

**Decision.** Use `node --test`. Node 24 ships a stable test runner and executes TypeScript directly,
so the cost is zero dependencies and zero build step. The two gaps — the `@/` path alias and
extensionless imports — are bridged by `scripts/test-resolver.mjs`, about forty lines, registered
via `--import`.

**Alternatives rejected.** *Vitest* is excellent and would bring roughly 30 transitive packages,
a config file and its own transform pipeline, to run pure functions with no DOM. *Writing tests in
plain JS* would mean the tests do not typecheck against the code they test.

**Consequences.** `npm run test` and `npm run test:watch` work with nothing installed. If a later
phase needs component testing with a DOM, that is the point to revisit this — the decision is about
what Phase 3 needed, not a permanent refusal. The resolver hook is the one piece of machinery to
maintain, and it is small enough to read in a sitting.

---

## ADR-025 — The seed is deterministic

**Date:** 2026-09-09 · **Phase:** 3 · **Status:** Accepted

**Context.** The seed makes thousands of choices: who is assigned which task, who attends which
meeting, which students express interest in an idea. With `Math.random()` every `db:reset` produces
a different world.

**Decision.** One `mulberry32` PRNG, seeded with a constant, threaded through every module. Ids are
a SHA-256 of a natural key rather than random cuid2, so rows can reference each other across modules
without threading return values through every function.

Two consecutive resets produce an identical md5 fingerprint over projects, users, ledger events,
posts and follows. This is asserted by hand rather than in CI today; it should become a CI step in
Phase 17.

**Consequences.** Screenshots stay valid. Documentation can name a specific student and still be
right next week. A failing assertion in `db:verify` is reproducible instead of a coin flip. Tests
can reference seeded rows. The cost is that the seed must never call `Math.random()`, `Date.now()`
or `crypto.randomUUID()` — a rule worth stating because one careless line silently removes the
property, and nothing fails loudly when it does.

The ids are deterministic **only in the seed**. Application code always uses the schema's
`cuid(2)` default; a predictable id in production would be an enumeration risk.

---

## ADR-026 — scrypt for passwords, not bcrypt

**Date:** 2026-09-09 · **Phase:** 4 · **Status:** Accepted · **Supersedes** the Phase 4 spec's
"bcrypt cost 12"

**Context.** The Phase 4 spec named bcrypt. It was written before Phase 3 existed, and Phase 3
seeded 87 accounts with scrypt from `node:crypto`. Switching to bcrypt would lock every one of them
out — which on its own is not a reason to keep a weaker algorithm, so the question is whether scrypt
is weaker.

It is not. scrypt is **memory-hard** and bcrypt is not, which is the property that matters against
GPU and ASIC cracking. OWASP's Password Storage guidance lists scrypt as an acceptable choice where
Argon2id is unavailable — and Argon2id would mean a native module, which on Windows is exactly the
kind of dependency ADR-021 exists to avoid. scrypt ships with Node.

**Decision.** scrypt at OWASP's recommended parameters: **N=2¹⁷, r=8, p=1**. Measured on the
development machine at 128 MB and ~400 ms.

Three details, each of which is a trap if reversed:

- **Asynchronous, always.** `scryptSync` at these parameters blocks the event loop for 400 ms —
  every other request on the server waits behind one login. The async form runs on libuv's thread
  pool, so concurrency is bounded by `UV_THREADPOOL_SIZE` (4 by default): 4 × 128 MB, not unbounded.
  This is the reason the memory cost is affordable on a 8 GB VPS at all.
- **The parameters live inside the hash** — `scrypt$N$r$p$salt$hash`. Cost becomes tunable later
  with no migration and no stranded users.
- **Upgrade on sign-in.** `needsRehash()` reports a hash made with weaker parameters and the login
  path silently rehashes. Verified in practice: after the first end-to-end sign-in, the seeded
  account's stored hash moved from `N=16384` (four fields) to `N=131072` (six). Without this,
  tuning the cost only ever protects new accounts and the oldest passwords stay the weakest.

**Consequences.** Zero dependencies, the seeded demo accounts keep working, and the migration path
for future tuning already exists and is tested. The cost is a deliberate ~400 ms per sign-in, which
is the entire point of a password KDF and is bounded by the rate limiter.

---

## ADR-027 — A purpose-built session layer, not Auth.js

**Date:** 2026-09-09 · **Phase:** 4 · **Status:** Accepted · **Supersedes** the Phase 4 spec's
"Auth.js v5, JWT sessions"

**Context.** The spec named Auth.js v5. Two facts, both checked rather than assumed:

1. **Auth.js v5 is still `5.0.0-beta.32`.** `latest` on npm is the v4 line. ADR-002 exists because
   Prisma's `latest` tag once pointed at a release candidate and cost an afternoon; taking a beta
   for the *authentication* dependency is a worse version of that bet.
2. **Decisively: Auth.js's Credentials provider does not support database sessions.** It requires
   the JWT strategy. That makes two of this phase's own acceptance criteria impossible without
   fighting the library — *per-device revocation* and *"changing a password signs out every other
   session"* — because a JWT cannot be withdrawn once issued. Phase 3 had already modelled a
   `Session` table for exactly this.

**Decision.** Opaque 256-bit random tokens in an httpOnly cookie, stored SHA-256-hashed, resolved
against the `Session` table. Sliding 30-day expiry refreshed at most once a day. `sameSite=Lax`
rather than `Strict`, so the click-through from a verification email does not look broken; every
mutation is a POST through a Server Action, which carries its own origin check.

**What is deliberately not reinvented.** Password hashing is scrypt from `node:crypto` (ADR-026) and
token comparison is `timingSafeEqual`. The surface built here is session *storage*, not
cryptography — which is the distinction that makes "do not roll your own auth" good advice rather
than a blanket prohibition.

**Consequences.** Per-device revocation, sign-out-everywhere and a real device list all work,
because the session is a row that can be deleted. No beta dependency. The cost is roughly 200 lines
to own and the loss of Auth.js's OAuth providers — which ADR-004 defers to Phase 16 anyway. Phase 3
already shaped `Account` to Auth.js's schema, so adopting it for OAuth later needs no migration.

**Revisit when:** Phase 16 adds Google OAuth, or Auth.js v5 reaches a stable release with
database-session support for credentials.

---

## ADR-028 — Route gating is a convenience; the query is the boundary

**Date:** 2026-09-09 · **Phase:** 4 · **Status:** Accepted

**Context.** It is natural to think of `proxy.ts` as "the security layer" — it is the thing that sits
in front of every request. That intuition is wrong in a way that ships silently.

The proxy sees a request to a *route*. It cannot see a Server Action invoked directly, a route
handler someone adds next month, or a query called from a component the guard does not wrap. All of
those reach the data; none of them reach the proxy.

**Decision.** Three layers, with an explicit ordering of trust:

1. **`visibleTo(viewer)` in the query layer** — the actual boundary. Every scoped query composes it,
   and a denied read returns `null` rather than a 403, because a 403 confirms the resource exists.
2. **`can(viewer, action, resource)`** — the same rules for a single loaded row and for every write.
   A denied write throws, because the user already knew the resource was there.
3. **`proxy.ts`** — so a signed-out visitor lands on the sign-in page instead of a broken dashboard,
   and returns to where they were going. Nothing more.

`isolation.test.ts` tests layer 1 with the proxy entirely out of the picture, which is Phase 4's
acceptance criterion 3 stated as a test. It also asserts that layers 1 and 2 **agree** on every
seeded project for every viewer — they are written separately, one in SQL and one in TypeScript, and
nothing else would stop them drifting. A drift in one direction leaks; in the other it produces
mystery 404s on work people can legitimately see.

**Consequences.** Guards can be added or forgotten without changing what data is reachable. New
route handlers are safe by default because they cannot query without a viewer. The cost is that
`visibleTo` and `can` express the same rule twice, in two languages — paid for by the agreement test.

---

## ADR-029 — There is no `viewer.role`

**Date:** 2026-09-09 · **Phase:** 4 · **Status:** Accepted

**Context.** Every authorisation system wants a `user.role` column. It makes `can()` a lookup table
and every check a single comparison.

It is wrong here, and wrong in a way that is expensive to undo. A person can be `ALUMNI` at the
college they attended and `COMPANY` at the employer they now work for, simultaneously. A faculty
member can hold a guest membership at a partner college (ADR-022). "What is this person's role" has
no answer; only "what is their role *here*" does.

**Decision.** `Viewer.memberships` is a list of `{ collegeId, role, state }`, and every check
resolves against the membership relevant to the resource. There is deliberately no `viewer.role`,
and `hasRoleAt(viewer, collegeId, role)` has no college-less variant to reach for.

Faculty scope is narrower still: `viewer.teaches` is a list of classes, because a faculty member may
read every project in **their subject**, not every project in the college. That distinction is most
of what the permission matrix is for.

**Consequences.** `can()` is longer than a lookup table and every call needs a resource to resolve
against. In exchange, the alumni transition is a state change rather than a new account, guests
cannot acquire college-wide reach, and the multi-college case works without a special path. The
matrix test covers 100 role × action × scope combinations plus an exhaustive cross-college sweep, so
the added complexity is checked rather than assumed.

---

## ADR-030 — A page swaps to the database when the phase that owns its data lands

**Date:** 2026-09-09 · **Phase:** 5 · **Status:** Accepted

**Context.** Twenty-eight pages import from `src/content/`. The Phase 3 hand-off note said Phase 5's
"real job is the swap", which read as *all of them*. Doing that would mean building query modules
for people, ideas, opportunities and knowledge ahead of the phases that design those models — the
exact inversion the content-first architecture exists to avoid.

Looking at the twenty-eight, they are not one kind of thing.

**Decision.** Three categories, with an explicit rule for each.

1. **Editorial content stays in `src/content/` permanently.** The changelog, the FAQ, the legal
   documents, the knowledge articles, the feature and audience pages, pricing. Nobody administers
   these through a console; they are written, reviewed and committed. Putting them in a database
   would add a migration to every copy edit and buy nothing.

2. **Database-backed pages swap in the phase that creates their data.** Colleges are created and
   managed here, so `/colleges` and `/colleges/[slug]` swap here. Projects are created in Phases
   7–8 and swap there. Profiles are edited in Phase 6 and swap there.

3. **Nothing swaps ahead of its phase.** A page reading the database for data no interface can yet
   create is a page that shows the seed and nothing else — the appearance of progress with none of
   it.

The rule that makes this safe: **no rendered page may change**. `npm run check:seo` crawls all 127
URLs and asserts the whole per-page contract; it passed identically before and after this phase's
swap, which is what turns "should be fine" into evidence.

**Consequences.** The public site is temporarily mixed — colleges from the database, projects from
fixtures. They agree today because the seed is generated from the fixtures, and `db:verify` asserts
the anonymous query layer returns exactly the fixtures' public project set. That assertion is what
keeps them agreeing until Phase 8 removes the need for it.

The honest cost: until projects swap, granting a college verification changes its *college* page and
sitemap entry, but its project pages are still governed by the fixture-side `resolveVisibility()`.
In the seeded state both say the same thing. Phase 8 closes it.

---

## ADR-031 — The import dry run is computed twice, on purpose

**Date:** 2026-09-09 · **Phase:** 5 · **Status:** Accepted

**Context.** The Phase 5 spec is unambiguous: *"The dry-run preview is the single most important
feature in this phase. A bulk import that silently creates 500 wrong records is the fastest way to
lose a college's trust permanently, and it is unrecoverable without a restore."*

That gives the preview two requirements that pull in opposite directions. It has to be **fast** —
an administrator adjusting a column mapping should see the effect immediately, not after a round
trip per change. And it has to be **true** — what the preview promises must be exactly what the
commit does.

**Decision.** Compute it twice.

- **In the browser**, on every mapping change, for the preview. `planImport` is a pure function over
  parsed rows and the existing roster, so this costs nothing: 500 rows plan in **9ms**.
- **On the server**, from the same uploaded file, at commit. The client sends the CSV text and the
  mapping — never the plan.

Sending the plan would make the preview theatre: anything the browser can compute, the browser can
be made to send something else instead, and "the preview said 3 creates" would stop being a
statement about what the server will do.

**Consequences.** One function, two callers, no duplicated logic — `lib/import/people.ts` has no
database access at all, which is what makes "the dry run cannot write" true by construction rather
than by discipline. The commit re-reads the roster, so a member added between preview and commit is
handled correctly rather than double-created.

Measured: parse 13ms, plan 9ms, commit 2.4s for 500 rows in one transaction — **2.9s against a
10-second budget** (`npm run bench:import`, which rolls back so it can be run against the demo
database).

---

## ADR-032 — Adapters carry the swap, not component rewrites

**Date:** 2026-09-09 · **Phase:** 5 · **Status:** Accepted

**Context.** The Phase 2 components take the types in `src/content/types.ts`. The database returns
Prisma payloads. Swapping a page means reconciling the two, and there were two ways to do it.

**Decision.** A thin adapter (`lib/db/queries/adapters.ts`) maps a database row into the shape the
components already speak. The components are not touched.

The alternative — rewriting `ProjectCard` and everything like it to take a Prisma payload — changes
the components and the data source in the same commit. That is precisely the change nobody can
review: if a page renders differently afterwards, nothing tells you which half did it.

**Consequences.** `src/content/types.ts` keeps the role it has had since Phase 2, and gains a second
one: it is now the contract in **both** directions — fixtures satisfy it, and so does the database.
That is what lets `check:seo` compare a swapped page against the same expectations as before.

The adapters are deliberately lossy in one direction: the content types carry exactly what the
public site renders, so anything the database knows and no pixel depends on is dropped rather than
threaded through. A listing that needed the extra field would widen its `select`; today none does.

The cost is one more hop, and the risk that an adapter quietly fills a field with a default the page
then displays. Both are bounded by the fact that the adapters exist only for pages that have already
been swapped, and `check:seo` renders every one of them.

---

## ADR-033 — Privacy is enforced by not querying, not by not rendering

**Date:** 2026-09-09 · **Phase:** 6 · **Status:** Accepted

**Context.** The obvious way to build a profile page with per-field privacy is one query for
everything and a filter in the view. It is shorter, and it is wrong in a way that does not show up
until somebody looks at the page source.

A field that is fetched and not rendered is still in the RSC payload. A field that is fetched and
CSS-hidden is in the HTML. Both defeat "hidden" for a crawler, for `curl`, and for anyone who
presses `Ctrl+U` — and Phase 6's own note says so: *"Hidden must mean absent from the HTML. Filter
at the query, not at the view."*

**Decision.** The visibility decision happens **before** the select, and an unentitled field is
never read from the database at all.

`resolveProfileVisibility()` reads only what it needs to decide — the privacy row, the memberships,
the college verification — and returns null when the viewer may not see the profile. `getProfile()`
then issues the entitled reads as **separate queries**, run only when permitted.

Separate queries rather than conditional spreads inside one `select`, for two reasons, and the
second is what settled it:

- It makes the guarantee literal. An unentitled field is not fetched, so no future edit to the page
  can surface it by accident.
- **Prisma cannot infer a conditionally-spread select.** The first version compiled to the *full*
  model type — precisely the shape that invites somebody to render a field the query was supposed to
  withhold.

**Consequences.** Two or three small indexed queries instead of one, which is a cheap price for a
privacy rule that holds by construction. Asserted at both layers: `profile.test.ts` checks the query
result, and `npm run check:privacy` fetches the real page logged out and asserts the email and roll
number are absent from the bytes.

---

## ADR-034 — A private profile is indistinguishable from one that does not exist

**Date:** 2026-09-09 · **Phase:** 6 · **Status:** Accepted

**Context.** The natural design is a 404 for an unknown username and a "this profile is private"
page for a real one. That is friendlier, and it is a username enumeration oracle: an attacker walks
a list of plausible handles and learns which are real accounts at a named institution.

**Decision.** Both render the same page, with the same title, the same `noindex`, the same body and
the same status. `getProfile()` returns null for either, and the page cannot tell which happened.

The page says so honestly rather than pretending to be an error: *"Profiles on Nexivora are private
until someone chooses otherwise… There may be no account with this name at all."* That is true in
both cases, which is the point.

**Verified, including one thing that looked like a leak and was not.** Response *sizes* differ
between the two by around 1.2 KB, which initially read as an oracle. It is not: requesting the
**same** URL twice produces different sizes too, for existing and non-existing names alike. Next
streams metadata and the position it lands in varies per request. `check:privacy` therefore compares
the rendered content — title, robots directive, body — and deliberately **does not** compare byte
counts, with a comment saying why, so nobody re-adds that assertion and chases a phantom.

**Consequences.** Slightly worse ergonomics for someone who mistyped their friend's handle. That is
the correct trade for a platform whose accounts are students at a named college.

---

## ADR-035 — Inferred skills are derived from projects, and the difference is shown

**Date:** 2026-09-09 · **Phase:** 6 · **Status:** Accepted

**Context.** A self-declared skill list is a CV, and everybody's CV says React. It is also the
easiest thing to build, and the thing every competitor already has.

`docs/phases/phase-06` is blunt about the stakes: *"The skill graph is the feature that makes
profiles credible… Do not let the self-declared path dominate the UI."*

**Decision.** `lib/skills/infer.ts` derives skills from what somebody actually built — the project's
tech stack, its domain, their declared role on it, and the tasks they closed — and every inferred
skill carries **the projects that produced it, by name**.

Three rules make it honest rather than generous:

- **Drafts do not count.** Only `IN_PROGRESS`, `UNDER_REVIEW`, `COMPLETED` and `ARCHIVED` are
  evidence. Counting a draft would let anybody manufacture a skill by creating an empty project,
  which is the exact inflation the three-tier proof model exists to prevent.
- **Stack noise is dropped.** `JSON`, `Git`, `CSV` say nothing about a person, and a list of twenty
  skills communicates less than a list of six.
- **Strength is 1–4 and means "how much evidence", not "how good".** Claiming to measure ability
  from three project rows would be dishonest, and the number would be believed.

`mergeSkills()` **promotes** a claim the projects corroborate and keeps an uncorroborated one,
clearly marked and sorted below. An attestation outranks both — a named human signed it.

Recomputed on project state change and after a skill edit, **never on render**: it is a join-heavy
query and would land on the profile page's LCP.

**Consequences.** The skill section is shorter than a CV's and means more. `infer.test.ts` runs the
inference over the real seeded corpus, and asserts the properties that matter: that a draft yields
nothing, that two different roles on the same project infer different skills, and that the ordering
is stable so the list does not reshuffle on reload.

The honest limit: the inference is a heuristic over a small rule set. It will miss skills and
occasionally suggest a vague one. That is why nothing is auto-attested, and why the interface never
presents a claim and a piece of evidence identically.

---

## ADR-036 — Discussion is markdown-lite through the existing renderer, not Tiptap

**Status.** Accepted · Phase 7 · 2026-09-10

**Context.** The Phase 7 spec says *"Rich text via Tiptap, sanitised on the server before storage and
again at render"*, and `docs/SECURITY.md` §3 says the same. Both were written in Phase 0, before
Phase 2 built `components/content/rich-text.tsx`.

That renderer changes the calculation. It parses a small markdown grammar and emits **React
elements** — there is no `dangerouslySetInnerHTML` anywhere in it, by construction. Phase 2 removed
the one instance that had crept into the pricing page for bold text, and recorded why: not because
it was exploitable on our own content, but because it is a pattern that gets copied somewhere it
would be.

**Decision.** Thread bodies, replies and task comments are stored as plain text and rendered through
`RichText`. No Tiptap, no `isomorphic-dompurify`, no sanitiser.

The reasoning is that a sanitiser is a mitigation for an HTML path, and we do not have one. Adding
Tiptap would *create* the HTML path — it produces an HTML string — and then require a sanitiser to
close the hole it opened, plus a second sanitiser at render because the first cannot be trusted for
content already in the database. Two libraries, two failure modes, and a class of bug that currently
cannot exist.

The trade is real and it is a downgrade in one respect: no toolbar, no inline images, no tables in a
discussion reply. Students type `**bold**` or they do not.

**Consequences.**

- Three fewer dependencies (`@tiptap/core`, `@tiptap/starter-kit`, `isomorphic-dompurify`) and no
  editor bundle on a page whose job is reading.
- One renderer for project sections, thread bodies, replies and task comments — so a fix to the
  renderer fixes all four.
- **`docs/SECURITY.md` §3 is now wrong in its first two bullets.** It has been corrected rather than
  left to mislead the next person into installing a sanitiser for a threat that is not present.
- If a future phase genuinely needs rich authoring — a project report with embedded figures is the
  plausible case — this decision is revisited *there*, with the sanitiser, and the discussion
  surface stays as it is.

---

## ADR-037 — Chart colours are a separate, CVD-validated set from the domain palette

**Status.** Accepted · Phase 7 · 2026-09-10

**Context.** Phase 1 shipped an eight-colour "domain / topic categorical set", contrast-checked and
wired into `npm run check:contrast`. Building the ledger's contribution chart, the obvious move was
to reuse it.

Measuring first showed why that would have been wrong. `check-contrast.mjs` asks *"can this colour
be read against that surface"* — the right question for a badge. A chart asks a different one:
*"can these two marks be told apart from each other"*, including by the roughly one man in twelve
with a colour-vision deficiency. The domain set fails it: crimson `#be123c` against amber `#b45309`
separates by **ΔE 5.7 under deuteranopia**, against a target of 8. Both pass contrast. Neither
looked wrong to me on screen.

The dark variants fail differently and more completely: every one sits at OKLCH lightness 0.78–0.88,
above the 0.48–0.67 band a chart mark needs on a dark surface. They were tuned to be readable *as
text* on dark, which is a different job.

**Decision.** A separate six-slot `--color-series-*` set, with its own steps per theme, validated by
a committed script (`npm run check:chart-palette`) wired into `npm run check`. Worst adjacent pair:
**ΔE 21.0 light, 19.3 dark**.

Six and not eight, because six is where it stops being achievable. And **adjacent** pairs, not all
pairs: we searched the space and no six-slot set clears the all-pairs target inside the dark band —
the best found reaches 6.3. So any chart with more than a couple of series uses **small multiples
with a name beside each facet**, and colour reinforces identity rather than carrying it.

**Consequences.**

- The ledger's contribution timeline is one row per member rather than six overlaid lines. It reads
  better anyway: "who was carrying this, and from when" is easier stacked than overlaid.
- The domain palette is unchanged. It is used for badges and topic chips, where it is correct.
- The audit also asserts the two dark blocks — the `prefers-color-scheme` media query and
  `[data-theme="dark"]` — declare the same six steps. A theme that disagrees with itself depending
  on how it was selected is a bug that only appears on somebody else's machine.

---

## ADR-038 — The ledger has no update path, enforced by the type system

**Status.** Accepted · Phase 7 · 2026-09-10

**Context.** ADR-007 established that the contribution ledger is append-only and that events are
written in the same transaction as the action that produced them. Phase 7 had to make that true in
code rather than in a comment.

Acceptance criterion 8 states it as a testable property: *"attempting an update through the client
wrapper is a type error."*

**Decision.** `lib/ledger/record.ts` exports `recordLedgerEvent`, `recordLedgerEvents` and
`compensateLedgerEvent`, and nothing else. There is no update, no delete, and no overload that
accepts the global Prisma client.

The transaction requirement is carried by the parameter type. `Tx` is
`Omit<PrismaClient, "$transaction" | …>` — the shape of an *interactive transaction client*, which
is missing `$transaction` precisely because you are already inside one. `db` does not satisfy it, so
`recordLedgerEvent(db, …)` does not compile, and the only way to obtain a value of that type is
`db.$transaction(async (tx) => …)`.

Corrections are compensating events: a second row with a **negative** weight pointing at the same
subject. Reopening a closed task, trashing an uploaded file and deleting a done task all take this
path.

**Consequences.**

- "Closed on Tuesday, reopened on Wednesday" stays readable. An update would have destroyed it.
- `scoreMembers` floors a member's total at zero, so double compensation cannot produce a negative
  share — asserted directly, because the arithmetic otherwise permits it.
- The activity stream shows a withdrawal struck through rather than hiding it. Hiding it would make
  the stream disagree with the totals, and somebody would eventually notice and trust neither.
- The cost is that a genuine mistake — crediting the wrong member — cannot be erased, only offset.
  That is the same trade the audit log makes, for the same reason.

---

## ADR-039 — Drag-and-drop is an enhancement over a keyboard control, not the other way round

**Status.** Accepted · Phase 7 · 2026-09-10

**Context.** A task board wants dragging. The two obvious routes are a library (`dnd-kit`,
`react-beautiful-dnd`) or the native HTML5 drag events, and both leave the same question unanswered:
what does a keyboard user do? Acceptance criterion 3 requires the board to be *fully operable by
keyboard, with no drag interaction, start to finish*.

**Decision.** Build the **"Move to" menu first** and treat dragging as an enhancement layered over
it. Every card carries a real `<button aria-haspopup="menu">` whose items call exactly the same
handler a drop calls.

Two things follow, and the second is the one that made the decision:

- Accessibility is not retrofitted. The keyboard path is the primary path, so it cannot rot.
- **No drag library is needed at all.** The native events are ~20 lines on top of a control that
  already works, where a library would have been the largest dependency in the product and would
  still have needed the menu built beside it.

Moves are optimistic via `useOptimistic`, and a failure surfaces a toast naming the task and the
reason. A card that silently snaps back is the most confusing thing an optimistic interface can do.

**Consequences.**

- Measured in a real browser: **66ms** from keypress to the card appearing in its new column, and
  the move reconciles rather than reverting on reload. `npm run check:workspace` asserts both.
- The board works on a phone, where dragging is awkward, and with a screen reader, where it is
  meaningless.
- The check drives the menu with `data-task-menu` / `data-column` / `data-move-to` hooks rather than
  guessing at roles — the first version selected on `aria-haspopup=menu` and matched the header's
  **theme toggle**, reporting a pass against a control with nothing to do with the board.

---

## ADR-040 — The seed writes real file bytes, not just file rows

**Status.** Accepted · Phase 7 · 2026-09-10

**Context.** Phase 3's seed created 90 `FileAsset` rows with generated storage keys and plausible
random sizes. It wrote nothing to disk.

Nobody noticed for four phases, because nothing served a file until this one. The first run of
`npm run check:workspace` did, and its **positive control** — *"a member can fetch their own group's
file"* — failed with a 404. The route was behaving perfectly: a missing object is a 404. The demo
world was the thing that was wrong.

**Decision.** `prisma/seed/files.ts` writes a real object for every seeded storage key, including
every `FileVersion` key, and the row's `sizeBytes` is set from what was actually written.

The content is generated and small, but it is genuinely of its claimed type: a real `%PDF-` header,
real CSV rows, a hand-built ZIP with a **computed CRC-32**. That last one is not fastidiousness —
the upload path identifies ZIP-family files by their signature, and a demo whose own files would
fail our own validator is a trap for whoever next tests uploading using a seeded file as an example.

**Consequences.**

- 134 objects, 233 KB, written in the seed's existing budget. `.uploads/` is already gitignored.
- Acceptance criterion 5 is now testable against real data. Before this, *"a file returns 404 to
  somebody outside the group"* passed trivially, because it returned 404 to everybody.
- The quota bar and the file list agree with the disk, because the sizes come from it.
- **The general lesson, which cost the most time here:** a denial suite without a positive control
  proves nothing (process lesson 9). This is the second time that rule has earned its place, and the
  first time it caught a defect in the *fixture* rather than in the policy.

---

## ADR-041 — Progress counts tasks only through the project's own milestones

**Status.** Accepted · Phase 8 · 2026-09-10

**Context.** Progress is computed from three components — sections written, milestones closed, tasks
finished. The obvious source for the third is the owning group's task board, and that is what the
first implementation used.

`check:project` failed on its first run against a criterion I had written casually: *"progress
starts at 0%"*. A brand-new project with nothing written opened at **26%**.

The reason is a fact about the data model that is easy to forget: **a group may own more than one
project**, and the seed contains one that does. A newly created project was inheriting the sibling
project's eighteen closed tasks.

**Decision.** A task counts toward a project only when it is linked to one of **that project's**
milestones. Tasks sitting on the group board without a milestone are work the group did; they are
not evidence about this particular project.

The consequence is deliberate and worth stating: a project with no milestones has **no task
component at all**, and `computeProgress` redistributes that weight across sections and milestones.
A group that has not adopted milestones is scored on what it has, not penalised for what it has not.

**Consequences.**

- It gives *"a milestone links to the tasks that constitute it"* — the phase spec's own wording —
  something to mean. Linking a task is now the act that makes it count.
- Progress on a fresh project is 0%, and the first section written moves it to 14%. Both numbers are
  now about the project rather than about its neighbours.
- The honest cost: a group that runs one project and never uses milestones sees progress driven
  entirely by sections. That is the correct answer for them, and the weighting handles it.

---

## ADR-042 — Derived project views are pure functions over a corpus, not per-source implementations

**Status.** Accepted · Phase 8 · 2026-09-10

**Context.** ADR-030 assigns the public project pages' swap to this phase. Seven pages and the
sitemap read `publicProjects()`, `projectsByTopic()`, `relatedProjects()`, `publicLineage()`,
`descendantCount()` and `projectYears()` from `src/content/index.ts`.

Each of those was written in Phase 2 as a function that internally called `publicProjects()` — right
while the fixtures were the only source. Giving them a second source invites writing a database
version of each, which is how two implementations of *"related projects"* end up disagreeing about
what related means.

**Decision.** The logic moved to `src/content/derive.ts` and takes its corpus as a parameter.
`content/index.ts` calls it with the fixtures; `queries/public-projects.ts` calls it with rows
adapted to the same `Project` shape. **One implementation, two sources.**

`src/content/types.ts` stays the contract in both directions, which is what it has been since Phase
2 and what makes the adapter approach (ADR-032) work at all.

**Consequences.**

- The swap was seven one-line import changes plus `await`. No component was touched.
- **`check:seo` returned 127 pages, 247 JSON-LD blocks, 127 unique titles — byte-identical to the
  pre-swap baseline.** That is what turns "no rendered page changed" into evidence.
- `publicProjectCorpus()` is wrapped in React's `cache()`, because a project page reads the corpus
  four times — itself, its lineage, its related work, its descendant count. Four identical queries
  per render is the shape that makes a page mysteriously slow, and threading an array through every
  helper would have changed the signatures the swap exists to preserve.
- Phase 11 replaces `relatedTo`'s scoring with trigram similarity. It changes one function, in one
  file, for both sources.

---

## ADR-043 — A Prisma scalar list has no database default, and raw SQL sees the difference

**Status.** Accepted · Phase 8 · 2026-09-10

**Context.** The similarity check threw `Cannot read properties of null (reading 'map')` the first
time it ran against a project created through the interface rather than the seed.

`Project.techStack` is `String[]`. Prisma's client returns `[]` for such a column when it holds
`NULL`, so every typed read looks fine and the type system reports nothing. But **Prisma does not
give scalar list columns a database default** — `information_schema` shows `column_default: null,
is_nullable: YES` — so a row created without setting the field genuinely stores `NULL`.

`shortlistSimilarProjects` is raw SQL, because it needs `pg_trgm`. Raw SQL returns the `NULL`. The
scorer then called a method on it.

Phase 3's query already had the answer for the adjacent case: it `COALESCE`s the topics subquery.
It did not coalesce `techStack`, and nothing revealed that until a project existed that the seed had
not made.

**Decision.** Both halves, because either alone leaves the trap set.

1. `shortlistSimilarProjects` coalesces `techStack` the way it already coalesced topics. Every raw
   query over a scalar list must do this.
2. `createProject` writes `techStack: []` and `keywords: []` explicitly, so the `NULL` never exists
   in a row this product creates.

**Consequences.**

- The general rule, which belongs in `CONTEXT.md` and now is: **the Prisma client and raw SQL
  disagree about a scalar list.** Anywhere the two touch the same column, the raw side needs a
  `COALESCE` and the write side needs an explicit `[]`.
- This is the second time a defect has been found only by exercising a path the seed does not
  produce. The seed is a good demo world and a poor adversary; the browser check is what supplies
  rows nobody designed.

---

## ADR-044 — Section guidance ships with the section, not in a help article

**Status.** Accepted · Phase 8 · 2026-09-10

**Context.** The phase spec calls per-section guidance *"worth more than it looks"* and identifies
the blank page as the real obstacle to good project documentation. That is a claim about people
rather than software, and it is correct: most students have never written a methodology section and
have no model of what one contains.

**Decision.** `config/sections.ts` carries, for each of the nine sections, a one-sentence `prompt`,
two or three `asks`, and a real `example`. All three sit **beside the textarea, permanently** — not
behind a tooltip, an info icon or a link to documentation.

The `asks` are the load-bearing part. A student who answers "Who has this problem, specifically?",
"What do they do about it now, and why is that inadequate?" and "How would you know if it were
solved?" has written a problem statement, whether or not they knew how to start one.

`example` is a real sentence rather than a template with blanks. A template produces fill-in-the-blank
prose; a concrete example communicates register and the expected level of specificity.

**Consequences.**

- Guidance you have to go looking for is guidance for people who already know what they are doing,
  so it is not hidden.
- `minWords` is a floor for **completeness**, never a target, and is set low deliberately — a tight
  80-word problem statement beats a padded 300-word one, and a floor that rewarded length would
  produce padding. Its only job is to make "complete" mean something when progress is computed.
- Four of the nine sections are optional (`PROTOTYPE`, `FUTURE_WORK` among them), because not every
  project builds a prototype and a submission gate that demanded one would be lying about what the
  work requires.

---

## ADR-045 — The group sees the same health signals their faculty guide sees

**Status.** Accepted · Phase 9 · 2026-09-11 · supersedes the visibility note in Phase 7's
`lib/ledger/health.ts`

**Context.** Phase 7 wrote the signals with a one-line comment saying *"Faculty see these; the group
does not."* The Phase 9 spec says twice that the group should see them. Both cannot stand, and the
question is not a matter of taste: it decides whether the feature is a management tool or a working
one.

**Decision.** The group sees them, at `/groups/[id]/ledger`, computed by the same `groupHealth()`
call the faculty dashboard uses. Only the **framing** differs, and that difference is data —
`AUDIENCE_FRAMING` in `lib/ledger/health.ts` supplies a heading and a caveat per audience
("Needs attention" / "Worth a look"). The signals themselves are identical.

**Why the spec wins.** The ledger those signals are derived from is *already* group-visible
(ADR-008, and the argument at the top of `groups/[id]/ledger/page.tsx`). Every one of these signals
can be worked out by hand from events the group can already read. Hiding the summary while showing
the data therefore buys no confidentiality at all — what it buys is that the group finds out at the
review instead of in week four, when it was still fixable. That is the opposite of the reason the
ledger exists.

**Consequences.**

- `lib/db/queries/health.ts` exists so the two views cannot drift: `listSupervisedGroups` computes
  signals in a batch for fifteen groups, `groupSignals` computes them for one, and both call the
  same pure function.
- The group-facing note says out loud that a signal can be wrong about the work, and that the fix is
  usually to record what you are doing rather than to argue with the number.
- `severity` stays the same for both audiences. A "warning" softened for the people it is about
  would be a different claim wearing the same word.

---

## ADR-046 — `HealthInput.active`: finished work is not stalled work

**Status.** Accepted · Phase 9 · 2026-09-11

**Context.** Found by taking a screenshot of `/faculty` and looking at it, which is the only way it
could have been found: every unit test passed, the query was correct and the arithmetic was right.
The page showed **four of four groups flagged**, three of them because their project had been
delivered months earlier and nobody had touched the workspace since.

**Decision.** `groupHealth()` takes `active`, defaulting to `true`. When the group's project is
`COMPLETED` or `ARCHIVED` it is `false`, and that silences `stalled` and every member-level signal —
`silent-member`, `imbalance`, `unwritten`. An unresolved blocker and a slipped milestone still fire:
those are loose ends in the record, and a finished project is exactly when they should be tidied.

**Consequences.**

- A dashboard where everything is flagged ranks nothing, and ranking is the entire value of the
  panel. Acceptance criterion 1 — *"knows what needs attention today"* — is unachievable without
  this, however good the signals are individually.
- The general shape is worth naming: **a signal that fires on the absence of activity needs to know
  whether activity was still expected.** Absence of evidence means something different after
  delivery.
- The flag defaults to active, so an omitted argument never silences a live group. Getting it
  backwards would be the dangerous failure; this way the failure mode is noise, which is visible.

---

## ADR-047 — The demo world's in-flight activity is rebased on every seed

**Status.** Accepted · Phase 9 · 2026-09-11

**Context.** The seed derives every workspace event from `project.startedOn`, a fixed date in the
content fixtures. That was fine until Phase 9, which is the first feature to compare seeded data
against `now`. Real time moved past the fixtures and every group in the demo read as abandoned.

**Decision.** `activityAnchor()` in `prisma/seed/workspace.ts` rebases **in-flight** projects
(`proposed`, `progress`) onto the last four and ten weeks respectively. **Finished** projects keep
their real dates: their record is history and should read as history.

**Consequences.**

- Seed output is no longer byte-identical across days — by design, and only in timestamps. The RNG
  stream, and therefore every id, name and choice, is unchanged.
- A demo world that ages out from under a time-sensitive feature is not a neutral fixture; it is a
  fixture that makes the feature look broken. This is the second instance of the Phase 7 lesson that
  **the seed is a good demo world and a poor adversary** — there it produced zero file bytes, here
  it produced activity nobody could have acted on.
- Anything built later that compares seeded data to the clock — reminders, streaks, "active this
  week" — should use the same anchor rather than inventing a second one.

---

## ADR-048 — `forbidden()` needed a flag nobody had turned on

**Status.** Accepted · Phase 9 · 2026-09-11

**Context.** Twenty-one guards across `/admin`, `/faculty` and `/platform` call `forbidden()`. In
Next 16 that is still behind `experimental.authInterrupts`, which was never enabled — so every one
of them threw *"forbidden() is experimental"* and returned a **500** to a person who had simply hit
a permission boundary.

It survived five phases because it is invisible on the happy path: the guard only runs for a user
who is actually denied, and that is never the user an end-to-end check signs in as. It surfaced in a
dev-server log while chasing an unrelated failure.

**Decision.** `experimental: { authInterrupts: true }` in `next.config.ts`, plus
`src/app/forbidden.tsx` so a 403 is a real page with a real status.

**Consequences.**

- **A 403 and a 404 are not interchangeable, and choosing between them is a privacy decision.**
  `forbidden()` is for routes whose existence is not itself information — `/admin`, `/faculty`,
  `/platform`. Anything addressed by a guessable id uses `notFound()`, because a 403 there confirms
  the thing exists. That rule is why `/faculty/classes/[id]` 404s while `forbidden.tsx` exists.
- The general lesson, which belongs with the process notes: **a check that only ever signs in as
  somebody entitled never exercises the refusal path.** `check-faculty.mjs` now asserts both halves
  of criterion 7 — what faculty cannot do *and* what they deliberately can.

---

## ADR-049 — Released feedback needed somewhere to land

**Status.** Accepted · Phase 9 · 2026-09-11

**Context.** The review screen could mark a rubric, differentiate per member with reasons, write
comments and release a round. The group would then see exactly nothing: the evaluation existed in
the database and in no interface, which is the same as not existing. Caught by the end-to-end check
asserting criterion 9 from the student's seat rather than from the faculty's.

**Decision.** `/projects/[slug]/feedback`, fed by `releasedFeedback()` in
`lib/db/queries/feedback.ts`. The tab is hidden until a round is released, because a permanently
empty "Feedback" tab teaches people there is never anything in it.

**The filter is in the query, not the page.** `releasedAt: { not: null }` means an unreleased round
never leaves the database. A page that loaded every round and filtered in JSX would ship the draft
into the HTML payload, where it is one View Source away, and every future edit to that page would be
a chance to reintroduce it. There is deliberately no `includeDrafts` flag for somebody to pass
`true` by accident.

**Consequences.**

- Every member's reason is shown to the whole group, not only to its subject. The review screen
  tells the marker "the group sees this" while they write it; this is where that promise is kept. A
  differentiated mark only its subject can see is unarguable in exactly the wrong way — the person
  best placed to say "that is not what happened" is the teammate whose share it is compared against.
- Section notes are **not** gated on release. They are a running conversation about a specific
  section and the group can act on one the moment it is written; the evaluation is the thing held
  back until it is finished.
- The page leads with the outcome, then the comments, then the numbers. A page that leads with a
  percentage teaches people to read the percentage and stop.

---

## ADR-050 — `/verify` is public, and a revoked attestation still resolves

**Status.** Accepted · Phase 9 · 2026-09-11

**Context.** `attestationCode()` prints `NX-XXXX-XXXX-XXXX` on every attestation and
`verifyAttestation()` could look one up, but nothing called it. A code on a CV that cannot be
checked is decoration.

**Decision.** `/verify` in the `(site)` group — no account, no sign-in, a GET form so a verified
result has its own URL and three candidates can sit in three tabs.

**A revoked attestation still resolves, and says so.** A dead lookup is worse for everybody: the
reader cannot tell a withdrawn credential from a typo, and the person whose attestation it was gets
the same suspicion either way.

**Consequences.**

- `verify` joins `RESERVED_USERNAMES`, as every new top-level route must.
- The alphabet excludes I, L, O and U, and the not-found copy says so — the most likely reason a
  real code fails to resolve is that somebody typed a 1 as an l.
- The seed was issuing `NXV-ATT-0001`, which `isAttestationCode()` rejects, so all eight seeded
  attestations were unverifiable. Fixed in `prisma/seed/evaluation.ts` by generating the real format
  from the seeded RNG rather than importing the crypto-backed generator, which would have made every
  seed run different. Caught by looking at the page, not by a check.
