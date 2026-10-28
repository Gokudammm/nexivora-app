# Nexivora

**The Global Academic Collaboration Network.**
*Projects. People. Opportunities.*

[Open the live Nexivora app](https://nexivora1in.vercel.app/explore)

[Deploy Nexivora with Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FGokudammm%2Fnexivora-app&root-directory=app)
— set the project root to `app` and configure the production environment variables
described in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md#vercel--full-application).

Nexivora is the system of record for academic project work — and the network that grows on top of
it. It connects students, faculty, colleges, alumni, companies and researchers around the thing
that actually matters in academic life: **the projects people build.**

---

## Why this exists

Student project work today lives in WhatsApp groups, personal Drive folders and printed reports.
Faculty see progress only at submission. Group members cannot prove what they individually
contributed. Finished projects vanish the day they are graded, so the next batch rebuilds the same
thing and the college loses its own institutional memory. Students graduate with four years of real
building and nothing verifiable to show for it.

None of that is a technology problem. It is a missing system of record.

## What makes it different

Nexivora is **project-first**, not person-first. Four things nobody else builds:

- **The Contribution Ledger** — an automatic, transparent record of who actually did what inside a
  group, written in the same transaction as the work itself.
- **Faculty attestation** — a three-tier proof model: self-claimed → workspace-evidenced →
  faculty-attested.
- **The Academic Archive with lineage** — completed projects get a permanent citation ID and a
  public page, and a future group can formally *build on* one, with the lineage recorded and drawn.
- **Accreditation export** — NAAC, NBA, NIRF and AICTE evidence generated from data the platform
  already holds, replacing weeks of manual faculty work.

## Status

**Phase 9 of 20 complete.** The public site (127 indexable pages), the schema and demo world, auth
and RBAC, the institution backbone, profiles, the group workspace with the **Contribution Ledger**,
the **project record** — nine sections, a role-gated lifecycle, computed progress, the archive
similarity check and immutable submission snapshots — and the **faculty desk**: a dashboard that
ranks what needs attention today, group health signals the group can see too, versioned rubrics,
per-member evaluation with the ledger beside the score, and **attestation** — a named human vouching
for work, verifiable by anyone at [`/verify`](https://nexivora.com/verify) without an account.
Next: Phase 10, the academic feed and notifications.

Live status board: [`PROGRESS.md`](PROGRESS.md).

---

## Read this in order

| # | File | What it gives you |
| --- | --- | --- |
| 1 | **[`CONTEXT.md`](CONTEXT.md)** | **Start here.** What the product is, why, the constraints, the working rhythm. |
| 2 | [`PROGRESS.md`](PROGRESS.md) | Where the build currently is. |
| 3 | [`PLAN.md`](PLAN.md) | The twenty phases, the stack decisions, the risk register. |
| 4 | `docs/phases/phase-NN-*.md` | The spec for the phase you are working on. |

Reference material, as needed:

| File | Covers |
| --- | --- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Stack, folder layout, request lifecycle, realtime, testing |
| [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) | Entities, the hierarchy, search, seed requirements |
| [`docs/ROLES-PERMISSIONS.md`](docs/ROLES-PERMISSIONS.md) | The authorisation matrix — seven roles, four scopes |
| [`docs/DESIGN-SYSTEM.md`](docs/DESIGN-SYSTEM.md) | Brand, logo, tokens, component rules, accessibility |
| [`docs/SEO-CHECKLIST.md`](docs/SEO-CHECKLIST.md) | The per-page SEO contract, from the Google Search docs |
| [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) | Budgets and the techniques that meet them |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Authz, uploads, privacy, DPDP alignment, moderation |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | localhost → Vercel, Render or Hostinger VPS |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Every non-obvious choice and its reasoning |
| [`docs/SITEMAP.md`](docs/SITEMAP.md) | Every route, its gate, its indexability, its phase |
| [`docs/BUSINESS-MODEL.md`](docs/BUSINESS-MODEL.md) | Pricing, unit economics, go-to-market |
| [`docs/PITCH.md`](docs/PITCH.md) | The deck content |

---

## Running it locally

Prerequisites: **Node 22+** and **PostgreSQL 16** (Docker or the Windows installer — both paths are
in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)).

```bash
cd app
npm install
cp .env.example .env          # fill in DATABASE_URL and AUTH_SECRET
npm run db:reset              # migrate + seed the demo college (~3.4s)
npm run db:verify             # 26 integrity assertions over the seeded data
npm run dev                   # http://localhost:3000
```

Two commands worth knowing:

```bash
npm run db:reset    # rebuild the demo world from scratch
npm run db:verify   # assert the data is actually coherent
npm run test        # unit tests (node --test, no framework)
npm run check:auth  # sign-in, gating and sign-out in a real browser
npm run check:admin # the admin console, end to end
npm run check:privacy # profile privacy, asserted on the bytes a stranger receives
npm run check:workspace # the workspace in a real browser — the board BY KEYBOARD, files, ledger
npm run check:project # the whole project lifecycle in a real browser: create, write, propose
npm run check:seo   # crawls the sitemap and asserts the whole per-page SEO contract
npm run bench:import # 500-row import against the 10s budget (rolls back)
npm run check       # typecheck + lint + format + test + contrast + chart-palette audits
```

---

## The stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Radix UI · Prisma · PostgreSQL 16 ·
Auth.js v5 · Zod · Server-Sent Events · Recharts · Vitest + Playwright.

The app is self-hostable and can also run on Vercel with managed PostgreSQL, private Blob storage
and SMTP. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the provider setup and deployment steps.

## The rules that apply everywhere

1. Reuse before you write — one `Button`, one `Header`, one `Card`.
2. Server Components by default; `'use client'` is a decision, pushed to the leaf.
3. Every page ships a unique title, description, canonical and OG tags.
4. Every image is SVG. No raster assets anywhere.
5. Every list has an empty state, a loading skeleton and an error state.
6. Authorisation is checked at the data layer, not only in middleware.
7. Update the phase file as you go, and write its summary before starting the next one.

---

*An individual startup project by an Integrated M.Tech AI/ML student.*
