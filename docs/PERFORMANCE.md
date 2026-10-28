# Performance Budgets & Techniques

Phase 16 owns the measured pass. This document is the standing contract every phase builds against,
so Phase 16 is a verification exercise rather than a rescue.

---

## Budgets

| Metric | Public pages | Authenticated app | Source |
| --- | --- | --- | --- |
| **LCP** | < 2.0s | < 2.5s | `APM.txt` — Google's "good" threshold is 2.5s; we aim below it |
| **INP** | < 200ms | < 200ms | `APM.txt` |
| **CLS** | < 0.05 | < 0.1 | `APM.txt` — "good" is 0.1 |
| TTFB | < 500ms | < 700ms | — |
| First-load JS | < 110 KB gzipped | < 190 KB gzipped | Next.js reports this per route |
| CSS | < 20 KB gzipped | < 20 KB gzipped | Tailwind purged |
| Total page weight | < 400 KB | < 800 KB | All-SVG helps enormously here |
| Lighthouse (mobile) | Perf 95+ · A11y 95+ · BP 100 · SEO 100 | not graded | — |

**These are budgets, not aspirations.** A route that exceeds first-load JS does not ship until it
is explained or fixed.

---

## The four techniques that do 90% of the work

### 1. Server Components by default

The largest single lever. A Server Component ships zero JavaScript. `'use client'` is a decision,
and it is pushed to the leaf: a page with one interactive button does not become a client page —
the button does.

Practical rule: if a component has no `useState`, no `useEffect`, no event handler and no browser
API, it must not be a client component. This is checked at review.

### 2. All-SVG imagery

Every icon is an inline SVG component using `currentColor`: no HTTP request, no icon font, no
sprite, no layout shift, and it themes for free. Illustrations are componentised SVG. Project cover
images and OG images are generated SVG. **There is no raster asset in this product**, which removes
an entire category of performance work.

The one place this needs care: a page rendering 30 project cards each with an inline cover SVG
inflates the HTML. Cover SVGs are therefore small (under 1 KB), and the grid uses a shared `<defs>`
+ `<use>` pattern where the motif repeats.

### 3. Font discipline

Three variable families, self-hosted through `next/font`, latin subset only, `display: swap`, with
`size-adjust` fallback metrics so the swap causes no layout shift. Only the display face used above
the fold is preloaded. No FOIT, no CLS from text.

### 4. Route-level code splitting and dynamic import

Heavy dependencies load only where they are used, never in the shared bundle:

| Dependency | Loaded only on |
| --- | --- |
| Recharts | `/admin/analytics`, `/faculty/classes/[id]`, dashboards |
| Tiptap editor | `/projects/[id]/edit/[section]`, the feed composer |
| Drag-and-drop | `/groups/[id]/tasks` |
| @react-pdf/renderer | Server-only, never in a client bundle |
| QR code | Server-only |

---

## The three specific risks in this product

Named in advance so they are designed around, not discovered.

### Risk 1 — the explore grid

Thirty project cards, each with a cover, badges, tags and an author. The failure modes are HTML
weight and hydration cost.

**Mitigations:** cards are Server Components with no hydration at all (the save button is a tiny
client island); pagination is 24 per page with real crawlable links; cover SVGs share a `<defs>`
block; the "save" and "follow" affordances use server actions rather than a client data layer.

### Risk 2 — the feed

An infinite list of posts, each with engagement state, each potentially interactive.

**Mitigations:** the first page is server-rendered; subsequent pages come from a server action, not
a client fetch library; each post card hydrates only its engagement bar; engagement counts are
denormalised on the row rather than counted per render; the list is virtualised past 50 items.
Ranking is computed in SQL, not in JavaScript over a fetched superset.

### Risk 3 — the task board

Drag-and-drop is the heaviest interaction in the product and the most latency-sensitive.

**Mitigations:** optimistic updates with server reconciliation, so a card moves at 0ms; a
lightweight DnD implementation rather than a large library; the board is fully keyboard-operable
through a "move to" menu, which is both an accessibility requirement and a fallback path that
needs no drag library at all.

---

## Database performance

- **N+1 elimination is not optional.** Every list query uses Prisma `include`/`select` explicitly.
  A list page that issues a query per row is a review failure. Phase 16 runs the app with Prisma
  query logging and asserts a per-route query ceiling.
- **Composite indexes for real access patterns:** `(collegeId, termId, status)` on Project,
  `(groupId, status, dueDate)` on Task, `(userId, readAt)` on Notification,
  `(visibility, publishedAt)` on Project, GIN on every `searchVector`.
- **Denormalise counts** — reaction count, comment count, member count, task-open count live on the
  parent row and are maintained in the same transaction as the change. Counting on read does not
  survive contact with a real feed.
- **`SELECT` only what is rendered.** A project card does not need the project's nine sections.
- The full-text search path uses a raw parameterised query against the `tsvector` column, not a
  Prisma `contains` chain, which cannot use the GIN index.

---

## Caching strategy

| Surface | Strategy |
| --- | --- |
| Marketing pages | Static, revalidated on deploy |
| Topic and SDG hubs | ISR, `revalidate: 3600` |
| Public project pages | ISR, `revalidate: 600`, plus `revalidatePath` on publish and edit |
| Public profiles | ISR, `revalidate: 600`, plus on-demand revalidation |
| Explore listings | ISR, `revalidate: 300` for page 1; dynamic beyond |
| Feed, workspace, dashboards | Dynamic, `no-store`, per-user |
| OG images | Cached immutably by URL, which encodes the content |
| Static assets | `Cache-Control: public, max-age=31536000, immutable` (hashed filenames) |

On-demand `revalidatePath` fires whenever a project's visibility or content changes, so a newly
published project is live and crawlable within seconds rather than at the next interval.

---

## Measurement

| Tool | When | What |
| --- | --- | --- |
| `@next/bundle-analyzer` | Every phase that adds a dependency | Route-level JS budget |
| Lighthouse CI | Phase 16, then per release | The four scores against budget |
| `web-vitals` → `/api/vitals` | Production, from Phase 17 | Real-user LCP, INP, CLS |
| Search Console Core Web Vitals | Post-launch, ongoing | The numbers Google actually uses |
| Prisma query logging | Phase 16 | Per-route query count and slow queries |

**Field data is the truth.** `APM.txt` is explicit that page experience is assessed on real-user
data, so a green Lighthouse run is a necessary but not sufficient signal. The `web-vitals` beacon
ships in Phase 17 precisely so we have our own field data before Search Console accumulates enough.

---

## Anti-patterns — these are review failures

- A `'use client'` at the top of a page file
- Any raster image
- A client-side data-fetching library used where a Server Component would do
- `useEffect` fetching data that the server already had
- A list without a `key` derived from a stable id
- An unbounded query with no `take`
- A count computed by loading rows and calling `.length`
- A component that renders a spinner where a skeleton with the right dimensions belongs (spinners
  cause perceived slowness and skeletons prevent CLS)
- Any `z-[9999]`, any raw hex, any inline `style` for something a token covers
