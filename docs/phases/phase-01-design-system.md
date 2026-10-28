# Phase 1 — Design System & Brand Identity

| | |
| --- | --- |
| **Status** | ✅ Complete |
| **Depends on** | Phase 0 |
| **Blocks** | Every phase that renders anything |
| **Estimate** | 8 focused hours |
| **Started** | 2026-09-08 |
| **Completed** | 2026-09-08 |

## Objective

Land the brand and the complete component vocabulary **before** feature pressure starts, so that
every later phase assembles existing pieces instead of inventing new ones. This is the phase that
determines whether the product looks professional or looks like nineteen different people built it.

Reference: `docs/DESIGN-SYSTEM.md`.

## In scope

- The Nexivora logo, in SVG, with every variant, plus the full favicon and PWA icon set
- Verification of the token system from Phase 0 (contrast measured, not assumed)
- The complete UI primitive library
- Layout components and both shells (marketing and application)
- The inline SVG icon set and the SVG illustration set
- The generated SVG avatar and project-cover system
- `/style-guide` as the reference and regression surface

## Out of scope

- Page content (Phase 2) · Data (Phase 3) · Charts (Phase 15)

## Deliverables

### Brand
- [x] `components/Logo.tsx` — one component, `variant="lockup|stacked|mark"`, `size="sm|md|lg"`,
      props `mono` and `reversed`. Mark and wordmark are paths, not live text.
- [x] Mark legible at 16px — verified by rendering it at 16px, not by assuming
- [x] `public/icon.svg`, `favicon.ico` (16/32/48), `apple-touch-icon.png` (180), and the
      192/512 PWA icons — all generated from the one SVG, all on stable URLs
- [x] `public/manifest.webmanifest` with name, short name, theme colour, icons
- [x] Brand usage rules written into `docs/DESIGN-SYSTEM.md` (clear space, minimum size, misuse)

### Tokens — verified, not assumed
- [x] `scripts/check-contrast.mjs` parses `globals.css` and computes WCAG ratios for every
      foreground/background pair in both themes
- [x] Wired into `npm run check`; **fails the run on any pair below AA**
- [x] All failures corrected in the token file. Record which pairs failed in the summary — that
      list is genuinely useful information.
- [x] `ThemeProvider` + `ThemeToggle` (light / dark / system), no flash of wrong theme on load

### UI primitives — `src/components/ui/`
Each with every state (default, hover, focus-visible, active, disabled, loading) and a `/style-guide`
entry.

- [x] `Button` — variants `primary · secondary · ghost · outline · danger`, sizes `sm · md · lg`,
      `loading`, `iconOnly`, `asChild`
- [x] `Input`, `Textarea` (auto-resize), `Select`, `Combobox` (searchable, keyboard-navigable),
      `Checkbox`, `RadioGroup`, `Switch`, `Slider`, `DatePicker`
- [x] `Field` — label, hint, error, required marker, full `aria-describedby` wiring.
      **Every form control is used inside a `Field`.**
- [x] `Card` + `CardHeader` / `CardBody` / `CardFooter`
- [x] `Badge`, `Chip` (removable), `StatusPill` (project lifecycle states), `TierBadge`
      (self / evidenced / attested — greyscale-distinguishable)
- [x] `Avatar` (with generated SVG identicon fallback), `AvatarGroup` (with overflow count)
- [x] `Tabs`, `Accordion`, `Dialog`, `Sheet` (side drawer), `Popover`, `DropdownMenu`, `Tooltip`,
      `ContextMenu`
- [x] `Toast` + `useToast`
- [x] `Table` — sortable headers, sticky header, and a **card fallback below `md`**
- [x] `Progress` (bar + ring), `Skeleton`, `Spinner`
- [x] `EmptyState` — illustration, headline, sentence, primary action. **An empty state without an
      action is a dead end and does not pass review.**
- [x] `ErrorState` with a retry action
- [x] `Breadcrumbs` — emits `BreadcrumbList` JSON-LD automatically
- [x] `Pagination` — renders **real `<a href>` links**, not buttons (crawlability, per
      `docs/SEO-CHECKLIST.md` §1)
- [x] `Stepper`, `Timeline`, `Divider`, `Kbd`, `CopyButton`, `VisuallyHidden`

### Layout — `src/components/layout/`
- [x] `Container`, `Section`, `PageHeader`, `Prose`
- [x] `Header` — logo, primary nav, mobile drawer, theme toggle, auth CTAs. Reads
      `config/navigation.ts`; **never links to a route whose `planned` flag is true.**
- [x] `Footer` — sitemap columns, legal links, social, copyright. One instance, used everywhere.
- [x] `AppShell` — collapsible sidebar (icon rail at `md`, drawer on mobile), topbar with search,
      notification bell and user menu
- [x] `CommandPalette` shell (⌘K) — registry-driven, empty for now, filled by later phases and
      **the deterministic fallback for the Phase 18 assistant**
- [x] `SkipLink` as the first focusable element on every page

### Icons — `src/components/icons/`
- [x] ~60 inline SVG components on a 24px grid, 1.5px stroke, using `currentColor`
- [x] Coverage for: navigation, projects, groups, tasks, files, calendar, feed, social, status,
      roles, domains, SDG, editorial. No icon library dependency.
- [x] `Icon` wrapper handling size and `aria-hidden`

### Illustrations & generated imagery — `src/components/illustrations/`
- [x] 8 scene illustrations, geometric, theme-aware, built from the logo's visual language:
      empty workspace · empty feed · no results · connection/collaboration · archive ·
      error 404 · error 500 · success
- [x] `generateAvatar(userId)` — deterministic SVG identicon, a node-graph motif in a hashed hue
- [x] `generateProjectCover(project)` — SVG cover from domain colour, title and SDG marks.
      **This is why every project card will look intentional with zero upload effort.**
- [x] `HeroGraphic` — the home page's primary illustration, animated only under
      `prefers-reduced-motion: no-preference`

### The style guide
- [x] `/style-guide` renders every component, every variant, every state, in both themes
- [x] Sections: brand · colour · type · spacing · icons · illustrations · primitives · layout ·
      patterns (empty, loading, error) · accessibility notes
- [x] `noindex`

## Acceptance criteria

1. `/style-guide` renders every component in both themes with no visual defect.
2. `npm run check` passes, including the contrast audit at 100%.
3. The logo mark is legible at 16px and the lockup is legible at 96px wide.
4. Every interactive component is fully operable by keyboard with a visible focus ring.
5. Theme toggle produces no flash of the wrong theme on hard reload.
6. `Header` and `Footer` are used on every page from here on — no page builds its own.
7. CSS bundle under 20 KB gzipped.
8. No raster asset anywhere in `public/` except the two generated PNG icons Apple and Android
   require.
9. `npm run build` clean.

## Key files this phase creates

```
src/components/Logo.tsx              One component, every variant
src/components/ui/*                  ~35 primitives — the vocabulary for 18 more phases
src/components/layout/*              Header, Footer, AppShell, CommandPalette
src/components/icons/*               ~60 inline SVG icons
src/components/illustrations/*       8 scenes + avatar and cover generators
src/app/style-guide/page.tsx         The reference surface
scripts/check-contrast.mjs           The audit that stops contrast silently regressing
public/icon.svg, favicon.ico, …      The full icon set, on stable URLs
```

## Notes & risks

- **Measure contrast, do not eyeball it.** In the reference project four token pairs failed a real
  audit despite looking fine. Expect the same here, and expect `border-strong` and the subtle
  foreground on raised surfaces to be the failures.
- **The `TierBadge` must work in greyscale.** It appears on exported portfolio PDFs, which people
  print. Test it by desaturating a screenshot.
- **`Pagination` renders anchors, not buttons.** This is an SEO requirement, not a preference — a
  button-based pager makes page 2 onwards invisible to a crawler.
- **The `Table` needs a mobile card fallback**, but designing it blind is guesswork. Build the
  desktop table now and note the fallback as a Phase 7 deliverable once there is real data to design
  against.
- Radix is the only component dependency. Do not add a second one, and do not add an icon library —
  the icon set is source code we own.
- The command palette is deliberately built now and left empty. It is the deterministic fallback
  for the AI assistant, and building it in Phase 18 alongside the AI would blur which is which.
- Do not skip the generated avatar and project cover. They are the difference between a product
  that looks alive with seed data and one that looks like a wireframe.

---

## Phase Summary

*Completed 2026-09-08.*

**What was built.** The brand and the complete component vocabulary — the pieces every one of the
next eighteen phases assembles rather than invents. The Nexivora logo as one component with every
variant, the full favicon and PWA icon set generated from that same geometry, ~35 UI primitives on
Radix, the layout and application shells, 60 inline SVG icons, 8 scene illustrations, the generated
avatar and project-cover systems, and `/style-guide` rendering all of it in both themes.

**Key decisions made.**

- **The logo is a nexus that reads as an N.** Three nodes joined by two strokes: the left node low,
  the right node high (an ascent), the top-right node largest so the mark has a focal point rather
  than reading as symmetrical decoration. One stroked path plus three circles, which is what lets it
  survive 16px. The wordmark is **paths, not live text**, so it cannot drift with a font swap.
- **The geometry lives in exactly three files** — `Logo.tsx`, `public/icon.svg` and
  `scripts/generate-icons.mjs` — and `npm run gen:icons` keeps the rasters in step. That is written
  into the brand rules in `docs/DESIGN-SYSTEM.md`, because three copies is exactly the kind of thing
  that silently diverges.
- **The raster icons are generated, not drawn.** `scripts/generate-icons.mjs` renders the mark with
  Pillow at 8x supersampling and downsamples. Node has no rasteriser in stdlib, and adding
  sharp/resvg for three build-time files is a runtime dependency we do not need.
- **`useSyncExternalStore` for the theme, not `useState` + effect.** The theme lives in
  localStorage and in the OS preference — it is external state, and React 19's
  `react-hooks/set-state-in-effect` rule correctly rejected the mirror-into-state version. The store
  also subscribes to the `storage` event, so two open tabs stay in step, which the effect version
  did not do.
- **The command palette was built now and left deliberately empty.** It is the **deterministic
  fallback for the Phase 18 AI assistant** (ADR-012). Building it separately, before any AI exists,
  keeps that boundary honest: with `AI_ENABLED=false` the assistant *is* this palette, and nothing
  is broken. Commands come from a registry, so feature phases add verbs without touching the file.
- **`EmptyState.action` is a required prop, not optional.** An empty state without an action is a
  dead end, and making it optional means half of them will ship without one.
- **`DatePicker` wraps the native date input.** It is fully keyboard-accessible, OS-localised and
  works with every screen reader — none of which is true of a custom calendar without weeks of work.
  Recorded honestly rather than presented as a full picker.
- **No `cmdk`, no icon library, no second component library.** Radix is the only component
  dependency. The 60 icons are source code we own.

**Defects found by looking, that no amount of code review would have caught.**

This is the argument for the visual pass being part of the phase rather than an afterthought:

| Defect | How it was found | Fix |
| --- | --- | --- |
| **`<title>Style guide · Nexivora · Nexivora</title>`** — the root layout's title *template* was applying on top of `buildMetadata`'s own suffix | Crawling the rendered HTML | `buildMetadata` now returns `title: { absolute }`. **This would have hit all ~45 Phase 2 pages.** |
| **`favicon.ico` contained only one size (16px), not 16/32/48** | Reading the generated file back with Pillow | Pillow's ICO writer ignores `append_images` and derives entries by downscaling — so it must be saved from the *largest* render with a `sizes` list |
| **The stacked lockup's wordmark was ~6 units off-centre** | Screenshotting the style guide | Offset corrected from 23 to 28.75 after measuring the wordmark's actual path extent |
| **The horizontal lockup carried ~24% dead trailing space** in its viewBox, so it floated oddly in flex layouts | Same screenshot | viewBox tightened from 148 to 113 wide, mark-to-wordmark gap from 12 to 10 units |

**A reusable tool came out of it.** `scripts/screenshot.mjs` drives Chrome over the DevTools
Protocol — the `--screenshot` flag cannot emulate `prefers-color-scheme` (an attempt via
`--blink-settings=preferredColorScheme=2` rendered a blank page) and cannot capture beyond the
viewport. `npm run shot /style-guide` now produces full-page captures in both themes. Phase 2 and
Phase 16 both need this.

**Files and directories created.**

```
app/
├── src/components/
│   ├── Logo.tsx                     lockup · stacked · mark, + mono and reversed
│   ├── providers.tsx                one client boundary near the root
│   ├── theme-provider.tsx           useSyncExternalStore + the no-flash init script
│   ├── icons/index.tsx              60 inline SVG icons, one Icon wrapper
│   ├── illustrations/
│   │   ├── index.tsx                8 scenes + HeroGraphic
│   │   └── generated.tsx            GeneratedAvatar + GeneratedProjectCover
│   ├── ui/
│   │   ├── button.tsx               8 variants x 3 sizes x 6 states, asChild, loading
│   │   ├── field.tsx                label/hint/error + aria-describedby wiring
│   │   ├── input.tsx                Input, Textarea, Select, DatePicker, Checkbox,
│   │   │                            RadioGroup, Switch, Slider
│   │   ├── combobox.tsx             WAI-ARIA combobox + CopyButton
│   │   ├── display.tsx              Card*, Badge, Chip, StatusPill, TierBadge,
│   │   │                            Avatar, AvatarGroup, Divider, Kbd
│   │   ├── feedback.tsx             Skeleton, Spinner, Progress, ProgressRing,
│   │   │                            EmptyState, ErrorState, Alert
│   │   ├── navigation.tsx           Breadcrumbs (+JSON-LD), Pagination, Stepper, Timeline
│   │   ├── overlay.tsx              Dialog, Sheet, Popover, Dropdown, ContextMenu,
│   │   │                            Tooltip, Tabs, Accordion
│   │   ├── table.tsx                sortable, sticky header, mobile card fallback
│   │   └── toast.tsx                ToastProvider + useToast
│   └── layout/
│       ├── primitives.tsx           Container, Section, PageHeader, Prose, SkipLink
│       ├── header.tsx               Header + ThemeToggle
│       ├── footer.tsx
│       ├── app-shell.tsx            sidebar → icon rail → drawer, topbar
│       └── command-palette.tsx      ⌘K, registry-driven
├── src/lib/seo/jsonld.tsx           JsonLd + breadcrumbList (Phase 2 extends)
├── src/app/style-guide/             the reference surface (noindex)
├── scripts/generate-icons.mjs       npm run gen:icons
├── scripts/screenshot.mjs           npm run shot
└── public/  icon.svg · favicon.ico · apple-touch-icon.png · icon-192 · icon-512
           · icon-maskable-512 · manifest.webmanifest
```

**Deviations from the spec above, and why.**

- **Five raster files, not "the two Apple and Android require".** The spec under-counted what the
  platforms actually need: `favicon.ico` (legacy browsers), `apple-touch-icon.png` 180 (iOS),
  `icon-192.png` and `icon-512.png` (PWA install), and `icon-maskable-512.png` (Android adaptive
  icons crop to a circle, so the mark must sit inside the middle 80% or the corners clip). All five
  are generated from the one geometry; nothing was hand-drawn or downloaded.
- **`Toast` is Radix Toast rather than hand-built.** It supplies the swipe gesture, pause-on-hover
  and the `aria-live` region that announces without stealing focus — all easy to get subtly wrong.
- **The contrast script was written in Phase 0, not here**, so this phase inherited a passing audit
  rather than fixing failures. The three failures and their fixes are recorded in Phase 0's summary
  and ADR-015. The audit was re-run and still passes 94/94.
- **`Table`'s mobile card fallback shipped here**, not deferred to Phase 7 as the Phase 1 spec
  suggested. The ledger table in the style guide gave a real dataset to design against, so there was
  no reason to wait.
- **No axe, screen-reader or keyboard audit.** Contrast is measured; the rest is Phase 16 and is
  **not claimed** — the style guide's accessibility section says so explicitly rather than implying
  conformance.

**Anything the next phase must know.**

1. **Use `buildMetadata()` on every page and never hand-write a title.** It now returns
   `title: { absolute }` — the root layout's template would otherwise double the site name. This
   was a real bug that would have affected all ~45 Phase 2 pages.
2. **The vocabulary exists. Reuse it.** `Header`, `Footer`, `Container`, `Section`, `PageHeader`,
   `Prose`, `Card`, `Button`, `Badge`, `EmptyState`. If you are about to write a second Button, stop.
3. **Flip the `planned` flags in `config/navigation.ts`** as Phase 2 pages land. `Header` and
   `Footer` currently render **no navigation links at all** because every route is still planned —
   that is deliberate, not a bug, and the links appear with no change to either component.
4. **`Breadcrumbs` emits its own `BreadcrumbList` JSON-LD.** Do not add a second one.
5. **`Pagination` renders real anchors.** Keep it that way — a button-based pager is invisible to a
   crawler, and the explore surface is the SEO engine.
6. **`lib/seo/jsonld.tsx` has only `breadcrumbList` so far.** Phase 2 adds Organization,
   WebSite+SearchAction, CreativeWork, ItemList, Person+ProfilePage, CollegeOrUniversity, Article,
   FAQPage and HowTo. `JsonLd` already escapes `<` so user-authored titles cannot break out.
7. **`GeneratedProjectCover` and `GeneratedAvatar` exist and are deterministic.** Phase 2's project
   fixtures should use them — they are the reason seeded data looks alive rather than like a
   wireframe.
8. **`npm run shot /explore` is available** for visual checks. Use it; four real defects in this
   phase were only visible by looking.
9. **Next 16 async APIs still apply** — `params` and `searchParams` are Promises, and Phase 2's
   `opengraph-image` and `sitemap` generators receive Promises too (ADR-014).
10. **`AppShell` is built but unused** until Phase 4 has a session. It takes `nav` and `user` props;
    do not wire it to a fake user in Phase 2.

**Post-completion correction (2026-09-09).**

Reviewed on a real screen, the type scale was too large and the vertical rhythm too airy — the
consumer-marketing register rather than the credible-infrastructure one the design intent calls for.
The report came with a screenshot from a browser at ~133% zoom, so the first job was separating
"the type is too large" from "the browser is zoomed". Both were true.

`scripts/audit-layout.mjs` (`npm run audit:layout`) now reports **computed** sizes at 390 / 768 /
1280 / 1536 at a known 100% zoom, and `docs/DESIGN-SYSTEM.md` carries a **usage ceiling** table so
the scale cannot drift back (ADR-018).

| | Before | After |
| --- | --- | --- |
| Hero h1 @ 1280 | 60px | **48px** |
| Hero top gap @ 1280 | 156px | **107px** |
| Hero top gap @ 390 | 108px | **76px** |
| Lead @ 390 | 18px | **16px** |
| `Section` padding | 64/96/112 | **48/64/80** |
| Document height @ 1280 | 1644px | **1362px** |

Two further findings from the same pass:

- **Prettier's Tailwind class sorting had already reordered the class strings**, so two of the four
  edits in the first attempt matched nothing and silently no-opped. The audit caught it because the
  numbers did not move. Verify an edit landed by measuring its effect, not by the edit succeeding.
- With navigation still empty in Phase 1, the **mobile header rendered only a theme toggle** — both
  auth CTAs were `hidden sm:inline-flex`. The primary CTA is now visible at every width.

**Verified by.**

| Check | Result |
| --- | --- |
| `npm run typecheck` | Clean, first pass |
| `npm run lint` | Zero problems (after fixing 3 real `set-state-in-effect` errors, not suppressing them) |
| `npm run format:check` | All files match Prettier style |
| `npm run check:contrast` | **94 pairs, 0 failures**, both themes |
| `npm run build` | Compiled in 5.8s, 3 static routes, no errors, no warnings |
| **CSS bundle** | **12.0 KB gzipped** (61 KB raw) — budget was 20 KB |
| `/style-guide` | 200, `noindex`, renders every component in both themes |
| Titles | `Nexivora — The Global Academic Collaboration Network` (54 chars), `Style guide · Nexivora` (23) — both unique, both under 60 |
| **Mark at 16px** | Rendered from `favicon.ico` and **visually inspected** — legible; the N and the accent node both read |
| `favicon.ico` | Verified to contain **16, 32 and 48** after fixing the generator |
| Icons served | `/icon.svg`, `/favicon.ico`, `/apple-touch-icon.png`, `/icon-192.png`, `/manifest.webmanifest` all 200 |
| Theme init script | Present inline in `<head>` — no flash of wrong theme |
| **Dark mode** | Full-page capture via CDP with `prefers-color-scheme: dark` emulated — every section correct |
| **Tier badges in greyscale** | Desaturated render checked: all three still distinguishable by fill and icon |
| Raster assets | 5 files, all generated from the one geometry; no other raster anywhere |
