# Design System

The full component checklist lives in `docs/phases/phase-01-design-system.md`. This file is the
reference: the brand, the tokens, and the rules.

## Brand

**Nexivora** — *Projects. People. Opportunities.*

**Design intent:** *credible academic infrastructure that a 20-year-old actually wants to open.*
Not a government portal, not a consumer social app, not a SaaS dashboard clone. Think of the
register of a well-designed research platform crossed with the clarity of a modern product tool:
generous whitespace, confident typography, restrained colour, and content that is legible before it
is decorated.

Three words to design against: **structured, alive, trustworthy.**

### The logo

**The mark** is a *nexus*: three nodes joined by two strokes that together imply a capital **N**
while reading as a small connection graph. The left node sits low, the right node sits high — an
ascent — and the middle stroke crosses between them.

- Built from one path plus three circles, so it stays legible at 16px in a browser tab.
- Node radii differ slightly (the top-right node is largest) so the mark has a focal point and does
  not read as a symmetrical decoration.
- Colour comes from `currentColor` for the strokes and the accent token for the leading node, so it
  themes for free and has a mono variant with no extra file.

**Variants**, all from one component: `<Logo variant="lockup|stacked|mark" size="sm|md|lg" />`

| Variant | Use |
| --- | --- |
| `lockup` | Default. Mark + wordmark, horizontal. Header, footer, OG images. |
| `stacked` | Mark above wordmark. Auth pages, splash, square placements. |
| `mark` | Mark only. Favicon, avatar fallback, app icon, tight spaces. |
| `mono` (prop) | Single-colour, for print, watermarks and the PDF exports. |
| `reversed` (prop) | For dark or coloured backgrounds. |

**Wordmark:** the product name set in the display face at a tightened tracking, with the *N*
carrying a subtle relationship to the mark. Never re-typed by hand in a component — it is a path in
the `Logo` component so it cannot drift.

### Brand usage rules

| Rule | Value |
| --- | --- |
| **Clear space** | One node-diameter (the largest node) on every side. Nothing sits inside it. |
| **Minimum size — mark** | 16px. Verified by rendering, not assumed: `favicon.ico` carries 16/32/48 and the mark stays legible at all three. |
| **Minimum size — lockup** | 96px wide. Below that, use the mark. |
| **Minimum size — stacked** | 44px wide. |
| **Backgrounds** | `surface`, `surface-raised`, `surface-inverse`, or a solid brand colour. Never a photograph, never a busy pattern, never a gradient that competes with the mark. |
| **On dark** | Pass `reversed`. Do not hand-recolour. |
| **Single colour** | Pass `mono`. Used by the PDF exports and any print piece. |

**Never:**

- Stretch, squash, rotate or skew it — the SVG has a fixed `viewBox` and a computed width so this
  cannot happen accidentally, but do not defeat it with a CSS `transform`.
- Add a gradient, shadow, outline or glow it does not have.
- Recolour the mark outside the token set, or swap which node carries the accent.
- Re-type the wordmark in a live font. It is a path in `Logo.tsx` precisely so it cannot drift.
- Place the lockup on a busy background, or lock it up with another logo without clear space.
- Use the mark as an avatar for a user or a college — those have their own generated marks.

**Geometry, if the artwork is ever revised:** the mark is drawn on a 32x32 grid and the same
geometry exists in three places — `src/components/Logo.tsx`, `public/icon.svg`, and
`scripts/generate-icons.mjs`. Change one, change all three, then run `npm run gen:icons`.

## Colour tokens

Declared as CSS custom properties in `src/styles/globals.css` under `@theme`. **Never write a hex
value in a component.**

**Filled controls use the explicit `*-fill` tokens, never a ramp step** (ADR-015). White on
`accent-600` measures 3.68:1 and white on `highlight-600` measures 3.19:1 — both fail AA, and
neither failure is visible to the eye. A highlight fill additionally requires
`--color-highlight-fill-border`, because bright amber cannot define its own edge on white.

| Role | Token | Light base | Meaning |
| --- | --- | --- | --- |
| Primary — identity, links, primary actions | `--color-primary-*` | Iris `#4F46E5` | The product itself |
| Accent — verified, growth, SDG, success-adjacent | `--color-accent-*` | Cyan-teal `#0891B2` | Progress and proof |
| Highlight — opportunity, spotlight, CTA emphasis | `--color-highlight-*` | Amber `#D97706` | "Look here" |
| Surface | `--color-surface`, `--color-surface-raised`, `--color-surface-sunken` | white / slate-50 / slate-100 | |
| Text | `--color-fg`, `--color-fg-muted`, `--color-fg-subtle` | slate-900 / 600 / 500 | |
| Border | `--color-border`, `--color-border-strong` | slate-200 / slate-300 | |
| Semantic | `--color-{success,warning,danger,info}` + `-fg` + `-bg` | each AA-verified | |

Each colour carries a full 50 → 950 ramp. **Every token is defined on bare `:root` first**, then
redefined under `[data-theme="dark"]` and under `@media (prefers-color-scheme: dark)`. A colour
whose only definition sits inside a media query is a bug and the contrast script will not see it.

Dark mode is not an inversion. Surfaces lift rather than darken (`#0B1020` base, raised panels
lighter), primary and accent are lightened for contrast against a dark ground, and shadows are
replaced by borders because shadows are invisible on dark surfaces.

### Contribution-proof tier colours (load-bearing — see Phase 12)

These three must be distinguishable at a glance, **and distinguishable in greyscale print**,
because they appear on exported portfolio PDFs.

| Tier | Token | Treatment |
| --- | --- | --- |
| Self-claimed | `--color-tier-self` → `fg-subtle` | Grey outline chip, no icon |
| Workspace-evidenced | `--color-tier-evidenced` → `primary-600` | Iris fill, activity icon, links to the evidence |
| Faculty-attested | `--color-tier-attested` → `accent-600` | Teal fill, seal icon, **names the attesting faculty member** |

### Project status colours

Draft (subtle) · Proposed (info) · Approved (primary) · In Progress (highlight) · Under Review
(warning) · Completed (success) · Archived (muted). One `<StatusPill status={...} />` renders all
of them; no page picks its own colour.

### Domain / topic colours

Each top-level domain (AI/ML, Software, Hardware, Healthcare, Education, Sustainability, Social
Impact, Research) gets one hue from a generated, contrast-checked 8-colour categorical set. Defined
once in `config/taxonomy.ts` alongside the domain, never chosen at the call site.

## Typography

| Token | Family | Use |
| --- | --- | --- |
| `--font-display` | **Plus Jakarta Sans**, variable | Headings, the wordmark, stat numbers |
| `--font-sans` | **Inter**, variable | Body, UI, everything else |
| `--font-mono` | **JetBrains Mono** | Citation IDs, verification codes, code blocks, IDs |

All three self-hosted through `next/font`, latin subset only, `display: swap`, preloaded for the
faces actually used above the fold. Three families is the ceiling — no fourth, no decorative face.

Scale, 1.200 minor third: `xs 12 · sm 14 · base 16 · lg 18 · xl 20 · 2xl 24 · 3xl 30 · 4xl 36 ·
5xl 48 · 6xl 60 · 7xl 72`. Line height 1.6 for body, 1.5 for UI, 1.15 for display. Body copy caps
at **68ch**. Headings use `text-balance`; lead paragraphs use `text-pretty`.

### Usage ceiling — measured, not assumed

The scale defines what *exists*; this table defines what pages may *use*. Set after measuring the
rendered output at 390 / 768 / 1280 / 1536 with `npm run audit:layout` (ADR-018).

| Role | Mobile | md | lg+ | Tailwind |
| --- | --- | --- | --- | --- |
| **Hero h1** (home, landing pages) | 30 | 36 | **48** | `text-3xl md:text-4xl lg:text-5xl` |
| **Page h1** (`PageHeader`, every other page) | 30 | 36 | 36 | `text-3xl md:text-4xl` |
| **Section h2** | 20 | 24 | 24 | `text-xl md:text-2xl` |
| **Card / block h3** | 18 | 18 | 18 | `text-lg` |
| **Lead paragraph** | 16 | 18 | 18 | `text-base md:text-lg` |
| **Body** | 16 | 16 | 16 | `text-base` |
| **Meta / caption** | 14 | 14 | 14 | `text-sm` |

**`6xl` and `7xl` are not used by any page.** They exist for a future display treatment and a
deliberate editorial moment; reaching for them by default produces a consumer-marketing register,
which is the opposite of the stated design intent. An h1 above 48px needs a reason.

**Vertical rhythm.** `Section` is `py-12 md:py-16 lg:py-20` (48 / 64 / 80). The hero overrides to a
tighter top so the first line of content is not pushed below the fold on a phone. Anything above
80px of section padding needs a reason too.

## Spacing, shape, depth, motion

- **Spacing:** 4px base — `0.5 1 1.5 2 3 4 5 6 8 10 12 16 20 24 32`. Section padding
  `py-16 md:py-24 lg:py-32`. Card padding `p-5 md:p-6`.
- **Radius:** `sm 6 · md 10 (default) · lg 14 (cards) · xl 20 (panels, modals) · full (pills,
  avatars)`. Nexivora reads slightly softer than a typical dashboard; this is intentional.
- **Shadow:** five levels, all low-contrast and colour-tinted with the primary hue at very low
  alpha rather than pure black. Borders do the separating; shadows only signal elevation.
- **Motion:** 120ms state change, 200ms entrance, 260ms overlay. `ease-out` for entrances,
  `ease-in` for exits, a single spring token for the drag interactions on the task board.
  **Everything wrapped in `@media (prefers-reduced-motion: reduce)`**, which disables transforms
  and reduces durations to 0.01ms rather than removing the transition (so callbacks still fire).
- **Z-index ladder:** `base 0 · dropdown 1000 · sticky 1100 · overlay 1200 · modal 1300 ·
  popover 1400 · toast 1500 · commandpalette 1600`. Named tokens only. No arbitrary `z-[9999]`.

## Component rules

1. **Built once, in `src/components/ui/`.** If you are writing a second button, stop.
2. **Variants via props**, never via copied files. `<Button variant intent size>`.
3. **Composition over configuration** — `<Card><CardHeader/><CardBody/><CardFooter/></Card>`,
   not a `Card` with twenty props.
4. **Every interactive element** has default, hover, focus-visible, active, disabled and loading
   states. All six, defined in the component, not at the call site.
5. **Focus rings are never removed.** `focus-visible:ring-2 ring-offset-2` is the house style, and
   the ring colour is a token so it works on every surface.
6. **Every form control pairs with `<Field>`** for label, hint, error and the `aria-describedby`
   wiring. A bare `<Input>` outside a `Field` is a review failure.
7. **Every data view ships loading, empty and error states.** All three. The `EmptyState`
   component takes an illustration, a headline, a sentence and a primary action — an empty state
   without an action is a dead end.
8. **Icons are inline SVG components** using `currentColor`. No icon font, no sprite fetch, no
   icon library dependency.
9. **Never `style={{}}`** for anything a token covers.
10. **Optimistic UI on every workspace mutation.** Closing a task must feel instant; the server
    action reconciles. This is the difference between a tool people use and a tool people tolerate.

## Layout

- `Container` — `max-w-7xl` with responsive padding. Reading content uses `max-w-3xl`.
- `Section` — vertical rhythm plus an optional background treatment.
- `AppShell` — sidebar (collapsible, icon-rail at `md`, drawer on mobile), topbar with search,
  notifications and the user menu, and a content region that owns its own scroll.
- Breakpoints: `sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536`. **Mobile-first, always** — Google
  indexes the mobile rendering, and students will open this on a phone before a laptop.
- Grid: 12 columns desktop, 4 mobile.

## Accessibility floor (WCAG 2.1 AA)

- Contrast 4.5:1 body text, 3:1 large text and UI boundaries — **verified by script in both
  themes**, not by eye. `scripts/check-contrast.mjs` runs in `npm run check`.
- Everything keyboard-operable, logical tab order, visible focus indicator, and a skip-to-content
  link as the first focusable element.
- The task board is drag-and-drop **and** fully operable by keyboard with an explicit "move to
  column" menu. Drag-only is an accessibility failure.
- One `h1` per page, headings in order, real landmarks (`header`, `nav`, `main`, `footer`).
- Errors announced through `aria-live`, associated with their field, never signalled by colour
  alone.
- Touch targets 44 x 44 minimum.
- Usable at 200% zoom with no horizontal scroll.
- `prefers-reduced-motion` and `prefers-contrast` honoured.
- Every meaningful SVG has `role="img"` and a `<title>`; every decorative one has
  `aria-hidden="true"` and no title.

## Illustration and imagery

**Everything is SVG.** No raster assets, no stock photography, no paid licences, no AI-generated
images.

- **Illustration style:** geometric and structural — nodes, edges, cards, arcs, grids — built from
  the same visual language as the logo. Abstract rather than figurative: cheaper to draw, ages
  better, avoids the generic-corporate-illustration look, and never has to depict a person of a
  particular appearance.
- Illustrations are theme-aware through `currentColor` and CSS variables, so one file serves both
  themes.
- **Avatars:** a deterministic SVG identicon generated from the user id (a small node-graph motif
  in the domain colour) is the default. An uploaded image replaces it. Never a grey silhouette.
- **Project cover images:** generated SVG from the project's domain colour, title and SDG icons —
  so every project card looks intentional with zero upload effort.
- Every SVG carries an explicit `viewBox` and a sized wrapper, so CLS stays at zero.
- **OG images** are generated at request time with `ImageResponse` from the same visual language:
  the mark, the title, the college, the domain colour. One template, every page type.

## The style guide route

`/style-guide` renders every component, in every variant and state, in both themes. It is the
reference, the review surface and the regression test. **Keep it current — a component that is not
on that page does not exist.** It is `noindex`.
