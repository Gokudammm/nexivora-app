# Architecture

## Stack

| Concern | Technology | Version |
| --- | --- | --- |
| Runtime | Node.js | 22 LTS (dev on 24) |
| Framework | Next.js, App Router | 16.3.4 |
| Language | TypeScript, `strict` + `noUncheckedIndexedAccess` | 5.x |
| Styling | Tailwind CSS | 4.x |
| Primitives | Radix UI | latest |
| ORM | Prisma | 7.x, pinned — see ADR-002 |
| Database | PostgreSQL (dev **and** prod) | 16 |
| Extensions | `pg_trgm`, `unaccent`, `citext` | — |
| Auth | Auth.js (NextAuth) v5, credentials + JWT | 5.x |
| Validation | Zod | 4.x |
| Realtime | Server-Sent Events (native), polling fallback | — |
| Charts | Recharts, dynamically imported | 3.x |
| PDF | @react-pdf/renderer | latest |
| QR | qrcode | latest |
| Email | Nodemailer (console transport in dev) | latest |
| Rich text | Tiptap (headless, ProseMirror) + server-side sanitisation | 2.x |
| Tests | Vitest (unit), Playwright (e2e) | latest |

Everything is free and self-hostable. Nothing in this list can expire, rate-limit us, or start
charging mid-project.

## Directory layout

```
Nexivora/
├── docs/                        the plan; read CONTEXT.md first
└── app/
    ├── prisma/
    │   ├── schema.prisma        single source of truth for the data model
    │   ├── migrations/
    │   └── seed/                hierarchy · taxonomy · people · projects · activity · index
    ├── public/
    │   ├── icon.svg  favicon.ico  apple-touch-icon.png
    │   └── manifest.webmanifest
    ├── scripts/
    │   ├── check-contrast.mjs   WCAG audit over the token file — wired into `npm run check`
    │   ├── check-seo.mjs        crawls the route table, asserts the per-page SEO contract
    │   └── verify-db.mjs        integrity assertions over the seeded world
    ├── src/
    │   ├── app/
    │   │   ├── (marketing)/     Public, SEO-critical, all Server Components
    │   │   ├── (public)/        /explore, /projects, /p, /colleges, /topics, /sdg, /ideas
    │   │   ├── (auth)/          login, register, verify, reset — minimal layout
    │   │   ├── (app)/           Authenticated product, role-segmented, noindex
    │   │   │   ├── feed/  workspace/  projects/  faculty/  admin/  settings/
    │   │   ├── api/             Route handlers: auth, uploads, sse, search, health, og
    │   │   ├── layout.tsx       Root: fonts, theme, Organization JSON-LD, base metadata
    │   │   ├── sitemap.ts  robots.ts  opengraph-image.tsx
    │   │   └── not-found.tsx  error.tsx  global-error.tsx
    │   ├── components/
    │   │   ├── ui/              Primitives. Built in Phase 1. Never duplicated.
    │   │   ├── layout/          Header, Footer, Container, Section, PageHeader, AppShell
    │   │   ├── marketing/       Hero, FeatureGrid, Stats, CTA, LogoWall
    │   │   ├── project/         ProjectCard, ProjectSection, LineageTree, StatusPill
    │   │   ├── workspace/       TaskBoard, FileList, Thread, MeetingCard, LedgerTable
    │   │   ├── feed/            PostCard, Composer, EngagementBar
    │   │   ├── icons/           Inline SVG icon components
    │   │   └── illustrations/   Inline SVG scene components
    │   ├── content/             Typed fixtures (Phase 2) — the contract Phase 3 satisfies
    │   ├── config/              site.ts · navigation.ts · roles.ts · taxonomy.ts
    │   ├── lib/
    │   │   ├── seo/             metadata.ts · jsonld.ts
    │   │   ├── auth/            config.ts · guards.ts · password.ts · session.ts
    │   │   ├── db/              client.ts (singleton) · queries/ by domain
    │   │   ├── authz/           policy.ts — the permission matrix, one place
    │   │   ├── search/          fts.ts · similarity.ts · facets.ts
    │   │   ├── ledger/          contribution scoring, peer review aggregation
    │   │   ├── feed/            ranking.ts — deterministic, unit-tested
    │   │   ├── matching/        teammate scoring + explanation
    │   │   ├── notifications/   dispatch.ts · templates.ts
    │   │   ├── realtime/        sse.ts — the transport boundary
    │   │   ├── storage/         provider.ts · local.ts · (r2.ts later)
    │   │   ├── analytics/       queries.ts — every metric defined exactly once
    │   │   ├── ai/              provider.ts + NullProvider (Phase 18)
    │   │   ├── validators/      Zod schemas, shared client and server
    │   │   └── utils/
    │   ├── styles/globals.css   Tailwind entry + the complete token system
    │   └── types/
    └── tests/{unit,e2e}
```

## The five architectural rules

### 1. Server-first rendering

A component is a Server Component unless it needs state, effects or event handlers. `'use client'`
is pushed to the leaf — a page is never a client component just because one button inside it is.
This is what makes the public surface crawlable without a rendering queue, and it is the reason the
SEO plan works at all.

### 2. Authorisation lives at the data layer

Proxy (`src/proxy.ts` — Next 16's rename of Middleware, ADR-014) gates routes as a convenience and
for a good redirect. **The query is the boundary.**
Every query function that touches institution-scoped data takes a `viewer` context
(`{ userId, role, collegeId, memberships }`) as its first argument, and `lib/authz/policy.ts`
decides. A page that forgets its guard still cannot read another college's data, because the query
will not return it.

```ts
// the shape every scoped query takes
export async function getProject(viewer: Viewer, slug: string) {
  const project = await db.project.findUnique({ where: { slug }, include: {...} });
  if (!project) return null;
  if (!can(viewer, 'project:read', project)) return null;   // not 403 — not found
  return project;
}
```

Returning `null` rather than throwing 403 on a read is deliberate: a 403 confirms the resource
exists, which leaks the existence of private projects.

### 3. One definition per concept

- Every metric is defined once in `lib/analytics/queries.ts` and imported. Two dashboards showing
  different numbers for "active projects" is the failure mode we are designing against.
- Every permission is decided once in `lib/authz/policy.ts`.
- Every notification type is declared once in `lib/notifications/templates.ts`.
- Every route is declared once in `config/navigation.ts` with a `planned` flag, so navigation never
  links to a 404.

### 4. The realtime boundary

Notifications and presence go through `lib/realtime/sse.ts`. Today that is a single
`GET /api/sse` route holding an SSE stream per connected user, fed by an in-process event emitter.
When there is more than one Node process, that emitter is replaced by Postgres `LISTEN/NOTIFY` —
a change confined to one file. Nothing in a feature imports the transport directly.

Nginx must have `proxy_buffering off` on the SSE route or messages arrive in batches. That line is
in the Phase 17 runbook and is the classic way this breaks in production.

### 5. Content before schema

Phase 2 writes the public site against typed fixtures in `src/content/`. Phase 3's Prisma schema
must satisfy those types — **`src/content/types.ts` now exists and is that contract**; anything it
declares that the schema cannot represent is a schema bug, not a fixture bug. This forces the data model to be shaped by what the product actually
renders rather than by what felt tidy in the abstract, and it means the public site is finished and
demonstrable before the database exists.

## Request lifecycle, public page

```
GET /projects/smart-irrigation-iot
  → middleware: public route, no session needed, security headers applied
  → app/(public)/projects/[slug]/page.tsx  (Server Component)
      generateMetadata()  → buildMetadata()  → title, description, canonical, OG
      getPublicProject(slug)  → Prisma → visibility check → null if not public
      renders sections + <JsonLd> CreativeWork + BreadcrumbList
  → HTML streamed, fully populated, zero client JS required to read it
  → client components hydrate only: share menu, lineage tree pan/zoom, save button
```

## Request lifecycle, authenticated mutation

```
POST (server action) closeTask({ taskId })
  → auth(): session or redirect
  → Zod parse of the payload — always, regardless of client validation
  → can(viewer, 'task:close', task) — throws if false
  → transaction: update task · append LedgerEvent · append ActivityEvent
  → emit notification to group members (SSE + notification row)
  → revalidatePath() for the affected routes
```

The `LedgerEvent` append inside the same transaction as the task update is what makes the
Contribution Ledger trustworthy — a contribution record cannot drift from the action that produced
it, because they commit together.

## Data flow for the feed

The feed is **not** a query over a `Post` table alone. Posts are created two ways:

1. **Authored** — a user composes a typed post that must reference a project, idea, question or
   resource.
2. **Generated** — a domain event (milestone closed, project published, prototype uploaded) writes
   a post through the same `createPost()` path, attributed to the group or the actor.

Both land in one table with a `source` discriminator. Ranking is a deterministic scoring function
in `lib/feed/ranking.ts` — recency decay, engagement, affinity (do you follow the author, the
project, the topic, the college) and a diversity penalty so one active group cannot flood a feed.
It is unit-tested and explainable, which matters when someone asks why they saw something.

## Environment

`lib/env.ts` validates every variable with Zod at module load. A missing or malformed variable
fails the boot with a message naming it, rather than producing a mystery runtime error three
screens into the app. `.env.example` is the committed contract.

## Testing strategy

| Layer | Tool | What it covers |
| --- | --- | --- |
| Unit | Vitest | `lib/authz/policy.ts` permission matrix · `lib/ledger` scoring · `lib/feed/ranking` · `lib/search/similarity` · `lib/matching` · every Zod schema |
| Integration | Vitest + a test database | Scoped queries actually deny cross-college reads |
| E2E | Playwright | (1) student registers → joins a class → creates a group → runs a task to done; (2) faculty reviews and attests a submission; (3) a project is published and its public page is crawlable; (4) a visitor finds a project through explore and lands on the college page |
| Contract | `scripts/check-seo.mjs` | Every route in the sitemap returns 200 with a unique title, description and canonical |
| Accessibility | `scripts/check-contrast.mjs` + axe in Playwright | Token contrast in both themes; no axe violations on key routes |
