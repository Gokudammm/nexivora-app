# Phase 0 — Foundation & Project Setup

| | |
| --- | --- |
| **Status** | ✅ Complete |
| **Depends on** | Nothing |
| **Blocks** | Every other phase |
| **Estimate** | 4 focused hours |
| **Started** | 2026-09-08 |
| **Completed** | 2026-09-08 |

## Objective

Stand up the repository, the toolchain and the documentation system so that every later phase has
somewhere obvious to put its work, and so no context is ever lost between sessions. Nothing
user-facing ships beyond a styled placeholder — that is correct and intentional.

## In scope

- Next.js 16 App Router + TypeScript scaffold
- Tailwind CSS v4 with the complete design token system declared
- ESLint, Prettier, TypeScript strict mode, path aliases
- Folder architecture for all twenty phases
- Environment variable handling with runtime validation
- PostgreSQL running locally and reachable (no schema yet)
- Git repository with correct ignores and a first commit
- The complete documentation set and the phase-tracking system

## Out of scope

- Any component beyond a placeholder (Phase 1)
- Any page content (Phase 2)
- The Prisma schema (Phase 3) — no ORM dependency is installed yet

## Deliverables

### Repository & tooling
- [x] `app/` scaffolded with Next.js 16 (App Router), TypeScript, Tailwind v4, `src/` directory, `@/*` alias
- [x] `tsconfig.json` on `strict: true` with `noUncheckedIndexedAccess`
- [x] ESLint configured (`next/core-web-vitals` + TypeScript rules)
- [x] Prettier with the Tailwind class-sorting plugin
- [x] `package.json` scripts: `dev`, `build`, `start`, `lint`, `format`, `typecheck`, `check`
- [x] `.gitignore` covering `node_modules`, `.next`, `.env*`, `.uploads`, build output
- [x] Git repository initialised at `Nexivora/`, first commit made
- [x] `.editorconfig` and `.nvmrc` (Node 22)

### Architecture
- [x] Folder skeleton created with a `.gitkeep` carrying a one-line purpose comment:
      `src/app/{(marketing),(public),(auth),(app),api}`,
      `src/components/{ui,layout,marketing,project,workspace,feed,icons,illustrations}`,
      `src/lib/{seo,auth,authz,db,search,ledger,feed,matching,notifications,realtime,storage,analytics,ai,validators,utils}`,
      `src/{config,content,types,styles}`, `prisma`, `public`, `scripts`, `tests/{unit,e2e}`
- [x] `src/config/site.ts` — single source of truth for name, tagline, URLs, social, contact
- [x] `src/config/navigation.ts` — every nav item with a `planned` flag so nav never links to a 404
- [x] `src/lib/env.ts` — Zod-validated environment access, fails loudly at boot naming the variable
- [x] `.env.example` committed with every variable the project will need, each documented
- [x] `src/app/layout.tsx` root layout: fonts, theme class, skip link, base metadata, icons
- [x] `src/app/page.tsx` placeholder that proves the token system and fonts work
- [x] `src/lib/seo/metadata.ts` — `buildMetadata()` helper (unused this phase, used by every page after)
- [x] `src/lib/utils/cn.ts`
- [x] `next.config.ts` with `output: 'standalone'` and the security headers from `docs/SECURITY.md`
- [x] `src/styles/globals.css` — the **complete** token system: colour ramps, semantic layer, tier
      colours, typography scale, spacing, radius, shadow, motion, z-index; light, dark and
      `prefers-reduced-motion`

### Database (setup only)
- [ ] PostgreSQL 16 running locally, `nexivora` database created — **BLOCKED: neither
      PostgreSQL nor Docker is installed on this machine. Not needed until Phase 3.**
- [ ] `pg_trgm` and `unaccent` extensions installed and verified with a query — **BLOCKED, as above**
- [x] `DATABASE_URL` in `.env` and validated by `lib/env.ts` (optional until Phase 3)
- [ ] Both setup paths verified — **written into `docs/DEPLOYMENT.md` but NOT yet executed**

### Documentation
- [x] `CONTEXT.md` — the read-first orientation file
- [x] `PLAN.md` — the master phase plan
- [x] `PROGRESS.md` — the live status board
- [x] `README.md`
- [x] `docs/ARCHITECTURE.md`
- [x] `docs/DATA-MODEL.md`
- [x] `docs/ROLES-PERMISSIONS.md`
- [x] `docs/DESIGN-SYSTEM.md`
- [x] `docs/SEO-CHECKLIST.md`
- [x] `docs/PERFORMANCE.md`
- [x] `docs/SECURITY.md`
- [x] `docs/DEPLOYMENT.md`
- [x] `docs/DECISIONS.md` with ADR-001 … ADR-013 recorded
- [x] `docs/SITEMAP.md`
- [x] `docs/BUSINESS-MODEL.md`
- [x] `docs/PITCH.md`
- [x] All twenty `docs/phases/phase-NN-*.md` specs

## Acceptance criteria

1. `npm run dev` starts and serves a styled page at `http://localhost:3000` with no console errors.
2. `npm run build` completes with no errors and no type errors.
3. `npm run lint` reports zero problems.
4. Deleting a required variable from `.env` makes the app fail at boot with a message naming that
   variable — not a mystery runtime crash three screens in.
5. `psql $DATABASE_URL -c "SELECT similarity('nexivora','nexivore');"` returns a number, proving
   `pg_trgm` is really installed.
6. Every file listed in `CONTEXT.md` §8 exists.
7. Dark mode inverts correctly on the placeholder page, driven only by tokens.
8. A new reader can open `CONTEXT.md` and know what to do next without asking anyone.

## Key files this phase creates

```
src/config/site.ts          Product identity — imported everywhere, hard-coded nowhere
src/config/navigation.ts    Route registry with planned flags
src/lib/env.ts              Validated environment access
src/lib/seo/metadata.ts     buildMetadata() — no page ever hand-writes SEO tags
src/app/layout.tsx          Root layout, fonts, theme, base metadata
src/styles/globals.css      The complete design token system
next.config.ts              Standalone output, security headers
.env.example                The environment contract
```

## Notes & risks

- **Do not skip `src/config/site.ts`.** Hard-coding the product name in forty files is the single
  most common way a project like this becomes painful to rename or white-label later — and
  white-labelling per college is on the roadmap.
- **Declare the full token system now, not a stub.** Phase 1 builds every component against these
  tokens; half a token system means rewriting each component twice. This is worth the extra hour.
- Tailwind v4 moves configuration into CSS (`@theme`). If the scaffold generates a v3-style
  `tailwind.config.ts`, keeping it for plugin registration is fine, but **tokens live in CSS**.
- Next 16 has breaking changes from 15. Check `node_modules/next/dist/docs/` before writing
  routing or metadata code rather than assuming Next 14/15 conventions.
- Keep the placeholder homepage genuinely minimal. The temptation to start designing here is
  strong; resist it, because Phase 1 replaces it entirely.
- **Deferred installs, each to its own phase:** Radix (1), Prisma (3), Auth.js + bcrypt (4),
  Tiptap (8), Recharts (15), @react-pdf/renderer + qrcode (12), Nodemailer (4), Vitest (4),
  Playwright (16). No dependency arrives before the phase that uses it.

---

## Phase Summary

*Completed 2026-09-08.*

**What was built.** The repository, the toolchain, the complete documentation system and a verified
placeholder page. `Nexivora/` holds the plan and the phase specs; `Nexivora/app/` holds the Next.js
application. The design token system, the site identity module, the route registry, validated
environment access and the SEO metadata helper are all in place, so Phases 1 and 2 have somewhere to
build rather than something to invent.

**Key decisions made.**

- **Next.js 16.3.4, not 15.** `create-next-app@latest` ships 16 with React 19.2.8 and Turbopack as
  the default bundler. The scaffold writes an `AGENTS.md` warning that "this is NOT the Next.js you
  know" and pointing at `node_modules/next/dist/docs/`. **Those docs were read, not assumed**, and
  four changes affect phases not yet built — recorded in full as **ADR-014**. The one that would
  have cost the most time: **Middleware is now Proxy** (`src/proxy.ts`), and a `middleware.ts` file
  is *silently ignored*, which in Phase 4 would have looked like a broken auth guard rather than a
  missing file. `docs/phases/phase-04-auth-rbac.md` and `docs/ARCHITECTURE.md` are corrected.
- **Zod 4**, the current major, matching the plan.
- **The token system is complete, not a stub.** Full colour ramps, the semantic layer, contribution
  tier colours, project status colours, an eight-colour domain set, typography, spacing, radius,
  shadow, motion and the z-index ladder — light, dark, `prefers-reduced-motion` and
  `prefers-contrast`. Phase 1 builds every component against these, and half a token system would
  have meant rewriting each component twice.
- **Contrast was measured in Phase 0, not deferred to Phase 1** — and it found real failures. See
  below, and **ADR-015**.
- **Explicit `*-fill` tokens for filled controls** (ADR-015), so a component never picks its own
  ramp step for a button background and a fill can never drift from its foreground.
- **Docs live at the repo root, the app lives in `app/`**, so the plan is visible on first open
  rather than buried beside source.
- **The placeholder home page doubles as a token check** and is `noindex`. It renders the semantic
  swatches, the three tier badges, the type scale and the twenty-phase plan, so one glance confirms
  tokens resolve, all three fonts load, and dark mode inverts.

**Contrast failures found and corrected — the reason this was measured rather than eyeballed.**

| Pair | Measured | Required | Fix |
| --- | --- | --- | --- |
| White on `accent-600` | 3.68:1 | 4.5:1 | Accent fills use the 700 step → 5.36:1 |
| White on `highlight-600` | 3.19:1 | 4.5:1 | Highlight fills use the 500 step with a dark foreground → 7.11:1 |
| `highlight-fill` edge on white | 2.15:1 | 3.0:1 (WCAG 1.4.11) | Highlight fills always carry `--color-highlight-fill-border` |

Two further values were set deliberately low in the ramp for the same reason: `fg-subtle` is the 500
step because 400 on white measures 2.85:1, and `border-strong` is the 500 step because 300 measures
1.47:1 against a white surface. **None of these failures is visible to the eye. All would have
shipped.** The audit is now a committed script wired into `npm run check`, so they cannot come back.

**Files and directories created.**

```
Nexivora/
├── CONTEXT.md  PLAN.md  PROGRESS.md  README.md
├── docs/  ARCHITECTURE · DATA-MODEL · ROLES-PERMISSIONS · DESIGN-SYSTEM
│          SEO-CHECKLIST · PERFORMANCE · SECURITY · DEPLOYMENT
│          DECISIONS (15 ADRs) · SITEMAP · BUSINESS-MODEL · PITCH
│   └── phases/  phase-00 … phase-19  (20 specs)
└── app/
    ├── src/config/site.ts          product identity, single source of truth
    ├── src/config/navigation.ts    route registry with `planned` flags
    ├── src/lib/env.ts              Zod-validated env, fails at boot naming the variable
    ├── src/lib/seo/metadata.ts     buildMetadata() — no page hand-writes SEO tags
    ├── src/lib/utils/cn.ts
    ├── src/styles/globals.css      the complete token system, both themes
    ├── src/app/layout.tsx          three fonts, base metadata, skip link, icons
    ├── src/app/page.tsx            placeholder + token check (noindex)
    ├── public/icon.svg             placeholder mark on its permanent URL
    ├── public/manifest.webmanifest
    ├── scripts/check-contrast.mjs  the audit that stops contrast silently regressing
    ├── next.config.ts  .prettierrc.json  tsconfig.json  .env.example  .nvmrc
    └── src/{components,lib,content,types}/…  folder skeleton, one documented .gitkeep each
```

**Deviations from the spec above, and why.**

- **PostgreSQL is not installed and is the one genuinely incomplete deliverable.** Neither
  PostgreSQL nor Docker is present on this machine, so the database could not be created and
  `pg_trgm` could not be verified — which means **acceptance criterion 5 is not met**. Both setup
  paths are documented in `docs/DEPLOYMENT.md` §1 but neither has been executed. This blocks nothing
  before **Phase 3**, so Phases 1 and 2 proceed. It is logged as a blocker in `PROGRESS.md`.
- **The dev server runs on port 3001, not 3000.** Port 3000 is held by the KaushalSetu dev server
  from another project. Verification was done against 3001. Note the canonical still reads
  `http://localhost:3000` because it correctly derives from `NEXT_PUBLIC_SITE_URL` — which is the
  right behaviour, and a useful reminder of how load-bearing that variable is.
- **`apple-touch-icon.png` and `favicon.ico` are not declared in the layout.** They are Phase 1
  deliverables and do not exist yet; a declared icon that 404s is worse than none. `/icon.svg` *is*
  claimed now, because per `Fevicon.txt` the icon URL must be stable forever — Phase 1 replaces the
  artwork in that file, never the URL. The scaffold's Next.js-branded `favicon.ico` and its
  `next.svg` / `vercel.svg` assets were deleted rather than shipped as our brand.
- **The `_next/static` Cache-Control override was removed.** Next warns at build time that it can
  break dev behaviour, and Next already sends immutable caching for its own hashed output.
  Production edge caching is Nginx's job (Phase 17).
- **The `eslint` key was removed from `next.config.ts`** — Next 16 removed it along with
  `next lint`. It is a type error in 16, which is how it was found (ADR-014).
- Directory `.gitkeep` files carry a one-line purpose comment rather than a README per directory;
  per-directory READMEs would drift from `docs/ARCHITECTURE.md`.
- `src/lib/db/` exists but is empty. Prisma is not installed until Phase 3 — no dependency arrives
  before the phase that uses it.

**Anything the next phase must know.**

1. **Read `node_modules/next/dist/docs/` before writing routing, metadata or proxy code.** Next 16
   differs from 15 in ways that fail silently. ADR-014 lists the four that affect us; the async
   `params`/`searchParams` change hits every dynamic route from Phase 2 onward, and `next typegen`
   generates `PageProps<'/route'>` and `LayoutProps` helpers to use instead of hand-written types.
2. **Tokens are complete and verified.** Build every Phase 1 component against `var(--color-*)` or
   its Tailwind utility. **Never a raw hex.** For filled buttons use `bg-primary-fill`,
   `bg-accent-fill` or `bg-highlight-fill` with the matching `text-fg-on-*` — never a ramp step.
   A highlight fill must also carry `border-highlight-fill-border`.
3. **`npm run check` is the gate**: typecheck, lint, format and the contrast audit. It fails on any
   contrast regression. Run it before calling anything done.
4. **`buildMetadata()` exists and is used once.** Every Phase 2 page must go through it. It already
   warns in development on a title over 60 characters or a description outside 110–160.
5. **The placeholder `page.tsx` is disposable.** Phase 1 replaces it with `/style-guide`; Phase 2
   replaces it with the real home page. Do not build on it.
6. **The mark in `public/icon.svg` and `PlaceholderMark` in `page.tsx` are first drafts, not the
   logo.** Phase 1 owns the real `components/Logo.tsx`, the favicon set and the icon system.
7. **Navigation is registry-driven.** Everything in `config/navigation.ts` is currently
   `planned: true`, so `Header` and `Footer` will render no links until Phase 2 flips them. That is
   deliberate — nav never points at a 404.
8. **Install PostgreSQL before starting Phase 3.** Docker Desktop or the Windows installer; both
   paths are in `docs/DEPLOYMENT.md` §1.
9. **Deferred installs, each to its own phase:** Radix (1), Prisma (3), Auth.js + bcrypt +
   Nodemailer + Vitest (4), Tiptap (8), @react-pdf/renderer + qrcode (12), Recharts (15),
   Playwright (16).

**Verified by.**

| Check | Result |
| --- | --- |
| `npm run typecheck` | Clean (strict + `noUncheckedIndexedAccess`) |
| `npm run lint` | Zero problems |
| `npm run format:check` | All files match Prettier style |
| `npm run check:contrast` | **94 pairs measured, 0 failures**, both themes |
| `npm run build` | Compiled in 41s, 3 static routes, no errors, no warnings |
| `npm run dev` → `GET /` | 200 |
| `<title>` in response | `Nexivora — The Global Academic Collaboration Network` |
| Canonical | Present, absolute, derived from `NEXT_PUBLIC_SITE_URL` |
| Robots meta | `noindex, follow` — correct for a placeholder |
| OpenGraph | `og:title`, `og:description`, `og:url`, `og:image` all present |
| Security headers | All six present: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `X-DNS-Prefetch-Control` |
| Server-rendered content | Page copy present in raw HTML — **crawlable with JavaScript disabled** |
| Fonts | All three preloaded as woff2 (Jakarta, Inter, JetBrains Mono) |
| Env validation | Invalid `AUTH_SECRET` fails the boot with a message naming the variable |
| `/icon.svg`, `/manifest.webmanifest` | 200 |
| Missing route | Real **404**, not a 200 with an error page |
| **Acceptance criterion 5 (`pg_trgm`)** | **NOT MET — PostgreSQL not installed. See deviations.** |
| Git | Initialised, first commit `8c630dd` |
