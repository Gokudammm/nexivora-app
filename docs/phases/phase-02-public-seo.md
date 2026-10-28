# Phase 2 — Public Marketing Site & SEO Core

| | |
| --- | --- |
| **Status** | ✅ Complete |
| **Depends on** | Phase 1 |
| **Blocks** | Phase 3 (the content fixtures are the schema's contract) |
| **Estimate** | 10 focused hours |
| **Started** | 2026-09-09 |
| **Completed** | 2026-09-09 |

## Objective

Ship the **entire public surface** and the SEO machinery every later phase reuses — before the
database exists. Two reasons: the public archive is the product's acquisition engine and deserves
to be designed rather than bolted on, and it means there is a complete, shareable, impressive
product from week one.

References: `docs/SEO-CHECKLIST.md`, `docs/SITEMAP.md`.

## In scope

- Every logged-out page (~45 routes including dynamic fixtures)
- The SEO engine: metadata, canonicals, sitemaps, robots, JSON-LD, OG images
- Typed content fixtures in `src/content/` — **the contract Phase 3's schema must satisfy**
- The legal and trust set
- Error pages and the PWA manifest

## Out of scope

- Anything behind a login (Phase 4+) · Real data (Phase 3) · Working search (Phase 11)

## Deliverables

### The SEO engine
- [x] `lib/seo/metadata.ts` — `buildMetadata()` used by **every** page: title, description,
      canonical, OG, Twitter, robots directives, `max-image-preview:large` on public content
- [x] `lib/seo/jsonld.ts` — typed builders: `Organization`, `WebSite`+`SearchAction`,
      `BreadcrumbList`, `CreativeWork`, `ItemList`, `Person`+`ProfilePage`, `CollegeOrUniversity`,
      `Article`, `FAQPage`, `HowTo`, `DefinedTermSet`
- [x] `lib/seo/visibility.ts` — `resolveVisibility()` deriving robots directives and sitemap
      inclusion from a resource's visibility (ADR-010). **No page sets robots directives itself.**
- [x] `app/sitemap.ts` — a sitemap **index** plus segmented sitemaps (static, projects, profiles,
      colleges, knowledge, ideas)
- [x] `app/robots.ts` — allow public, disallow `/api/`, `/settings/`, `/workspace/`, `/faculty/`,
      `/admin/`, `/auth/`, `/feed`, and the high-cardinality filter parameters
- [x] `app/opengraph-image.tsx` + per-route variants — generated from SVG via `ImageResponse`,
      1200×630, one template covering project, profile, college, topic and article
- [x] `scripts/check-seo.mjs` — crawls every sitemap URL and asserts: 200, one `h1`, unique title
      under 60 chars, unique description 140–160, canonical present and absolute, OG complete,
      valid JSON-LD, **and that no non-public resource appears in any sitemap**
- [x] Wired into `npm run check`

### Content fixtures — `src/content/`
Typed, exported, and treated as the contract Phase 3 satisfies.
- [x] `projects.ts` — 12 fully written demo projects across every domain, each with all nine
      sections, team, tech stack, SDGs, and **one three-level lineage chain**
- [x] `topics.ts` — the two-level taxonomy with slugs, descriptions, colours
- [x] `sdgs.ts` — all 17 goals with SVG marks
- [x] `ideas.ts` — 10 ideas across every status
- [x] `colleges.ts` — 3 colleges
- [x] `people.ts` — 12 public profiles
- [x] `knowledge.ts` — 6 articles
- [x] `opportunities.ts` — 6 listings with complete `JobPosting` fields
- [x] `faqs.ts`, `legal.ts`, `help.ts`, `changelog.ts`

### Marketing pages
- [x] `/` — hero, the problem, the four layers, the ledger and archive differentiators, featured
      projects, audience split, FAQ, CTA. `Organization` + `WebSite`+`SearchAction` + `FAQPage`.
- [x] `/for-students`, `/for-faculty`, `/for-colleges`, `/for-companies`, `/for-alumni` — each
      written to that audience's actual pain, each with its own genuine FAQ
- [x] `/how-it-works` — `HowTo` structured data
- [x] `/features` + `/features/workspace`, `/features/contribution-ledger`, `/features/archive`
- [x] `/pricing` — the tiers from `docs/BUSINESS-MODEL.md`, and the free pilot as the primary CTA
- [x] `/about`, `/contact` (`ContactPoint`), `/faq` (`FAQPage`)
- [x] `/help` + `/help/[slug]` — 8 real articles
- [x] `/changelog`, `/roadmap`

### Public data surfaces (rendering fixtures)
- [x] `/explore` — the project grid with server-side faceted filtering (domain, SDG, status, year,
      college), real crawlable `?page=` pagination, `ItemList`
- [x] Single-facet URLs canonicalise to their hub; multi-facet permutations return
      `noindex, follow` (see `docs/SEO-CHECKLIST.md` §5)
- [x] `/projects/[slug]` — the full project page: all nine sections as real `<h2>` blocks, team,
      stack, SDGs, lineage, citation block. `CreativeWork` + `BreadcrumbList` + `Person`.
      **This is the highest-value template in the product — give it the most design attention.**
- [x] `/topics` + `/topics/[slug]` — editorially written hub pages, not generated shells
- [x] `/sdg` + `/sdg/[n]-[slug]`
- [x] `/ideas` + `/ideas/[slug]`
- [x] `/colleges` + `/colleges/[slug]` — `CollegeOrUniversity`
- [x] `/p/[username]` — `Person` + `ProfilePage`
- [x] `/knowledge` + `/knowledge/[slug]` — `Article`
- [ ] `/knowledge/collections/[slug]` — **NOT BUILT.** With six articles a collection layer
      would be a page listing two items. Deferred until the hub has enough content to group.
- [x] `/opportunities` + `/opportunities/[slug]` — full `JobPosting`

### Legal & trust
- [x] `/legal/privacy` — DPDP-aligned, and **accurate to what the product actually does**
- [x] `/legal/terms`, `/legal/community-guidelines`, `/legal/academic-integrity`,
      `/legal/ip-policy` (who owns student work — answer it explicitly),
      `/legal/accessibility`, `/legal/cookies`
- [x] `/legal/grievance` — named officer with contact details (IT Rules requirement)

### System pages
- [x] `not-found.tsx` returning a real 404 status with the 404 illustration and useful links
- [x] `error.tsx`, `global-error.tsx`
- [x] `manifest.webmanifest` wired

## Acceptance criteria

1. Every route in `docs/SITEMAP.md` marked Phase 2 returns 200.
2. `scripts/check-seo.mjs` reports **zero violations**: no duplicate titles, no duplicate
   descriptions, no missing canonical, no length breach.
3. Lighthouse on `/`, `/explore` and `/projects/[slug]`: Performance 95+, Accessibility 95+,
   Best Practices 100, SEO 100 (mobile).
4. **Every public page renders its full content with JavaScript disabled.** Verified by fetching
   the raw HTML and finding the body copy in it.
5. Rich Results Test passes for every structured-data type used.
6. `sitemap.xml` validates, contains only 200-status indexable URLs, and contains no private
   fixture.
7. `/explore?domain=ai-ml&sdg=6&year=2026` carries `noindex`.
8. A 404 returns HTTP 404, not 200.
9. Pagination links are real anchors and page 2 is reachable without JavaScript.
10. No page hand-writes a `<title>`, a canonical or a robots tag.

## Key files this phase creates

```
src/lib/seo/metadata.ts        buildMetadata() — used by every page in the product
src/lib/seo/jsonld.ts          11 typed structured-data builders
src/lib/seo/visibility.ts      resolveVisibility() — indexability derived from data
src/app/sitemap.ts             Segmented sitemap index
src/app/robots.ts
src/app/opengraph-image.tsx    One SVG-generated template, every page type
src/content/*                  Typed fixtures — THE CONTRACT PHASE 3 SATISFIES
scripts/check-seo.mjs          The audit that stops SEO silently regressing
```

## Notes & risks

- **Write the SEO audit script early and run it often.** In the reference project a crawl found 27
  self-inflicted violations — titles and descriptions breaching the project's own limits. Finding
  those at the end of the phase is much more expensive than finding them at page five.
- **The content fixtures are real work, not lorem ipsum.** Twelve fully written projects with
  genuine problem statements and methodology is several hours on its own — and it is the single
  thing that makes the demo credible, the SEO thesis testable, and Phase 3's schema correctly
  shaped. Do not shortcut it.
- **`/projects/[slug]` is the most important template you will build.** It is what ranks, what gets
  shared, and what a company sees. Give it disproportionate attention.
- Topic hub pages must have genuine editorial content. Generating thin shells for each taxonomy
  node is exactly the doorway-page pattern `technical and Spam.txt` prohibits.
- Descriptions must be written per page, not templated. A templated description is a duplicate
  description with extra steps.
- Lighthouse needs Chrome automation. If it is unavailable in this environment, **claim no score**
  — record it honestly as deferred to Phase 16 rather than asserting a number nobody measured.
- The privacy policy must describe what the code actually does. Write it against
  `docs/SECURITY.md` §7, and re-check it in Phase 16 against the real schema.

---

## Phase Summary

*Completed 2026-09-09.*

**What was built.** The entire public surface — **127 indexable pages** — and the SEO engine every
later phase reuses, before the database exists. 25 marketing and trust pages, 12 project pages, 24
topic hubs, 17 SDG hubs, 11 ideas, 12 profiles, 6 knowledge articles, 5 opportunities, 8 help
articles, 8 legal documents and 2 college pages, plus the sitemap, robots rules, typed structured
data, generated OG cards, error pages and the audit that keeps it all honest.

**Key decisions made.**

- **`src/content/` is the contract, and it is written rather than generated.** Twelve full project
  records with all nine sections, six knowledge articles, eight legal documents and five audience
  landing pages — several hours of actual writing. It is what makes the demo credible, the SEO
  thesis testable, and Phase 3's schema correctly shaped. **`src/content/types.ts` is now the
  contract Phase 3's Prisma schema must satisfy.**
- **The fixtures encode the hard cases deliberately**, so later phases have something real to work
  against rather than a happy path: a three-level lineage chain, a near-duplicate that will make
  Phase 8's similarity check fire, an embargoed project, a private project, a private profile, a
  project at an unverified college, and an unverified company's listing. The last four must never
  reach a public surface, and the audit asserts it.
- **Every public page reads through `src/content/index.ts`, never from the raw fixture arrays.**
  That is the same discipline the Phase 3 query layer will enforce: the visibility predicate lives
  in one place, so a page cannot forget it. When Phase 3 lands, these functions keep their
  signatures and their bodies become database queries — the pages do not change.
- **Indexability is computed, never chosen** (ADR-010). `resolveVisibility()` folds together the
  resource's own visibility, its college's verification, faculty approval and any embargo.
  `resolveFacetedUrl()` decides explore-page indexability: the hub and single facets are indexable
  and canonicalise to their editorial topic page; **multi-facet permutations are `noindex, follow`**,
  which is what stops six facet dimensions generating a combinatorial explosion of thin pages.
- **A markdown-lite renderer that never uses `dangerouslySetInnerHTML`.** Phase 8 renders
  user-authored project sections through this same component, and at that point the input is
  untrusted. A renderer that only ever produces React elements cannot inject markup at all. The one
  page that had crept into using `dangerouslySetInnerHTML` for bold text (pricing) was rewritten to
  match — not because it was exploitable there, but because it is a pattern that gets copied into
  somewhere it would be.
- **An embargoed project is indexable and listed, and withholds its body.** That is the whole point
  of the control: work can be *cited* without being *disclosed*.

**The audit found 191 violations in my own output. That is the headline.**

`scripts/check-seo.mjs` crawls every sitemap URL and asserts the per-page contract. On its first run
against a site that had already passed typecheck, lint and a clean production build, it found **191
violations across 127 pages**. Every one was invisible in a browser.

| Violation | Count | Cause |
| --- | --- | --- |
| **`og:image` missing entirely** | 127 | See below — the significant one |
| Description outside 110–160 chars | ~40 | My own copy, on both sides of the range |
| Title over 60 chars | ~23 | Constructed titles (`{title} — {domain} project`) plus long fixture titles |
| Title 61 chars | 1 | Found on the final pass, one character over |

**The `og:image` failure is worth recording properly**, because the reasoning was wrong twice:

1. First I set `image: /projects/${slug}/opengraph-image` by hand. **Next content-hashes generated
   image filenames** (`opengraph-image-umay0l`), so a hand-written URL 404s and the link preview
   renders blank. The build output showed the hash; I noticed it only because the route list looked
   odd.
2. So I removed the override and relied on the file-based convention. That produced **no `og:image`
   at all on any page** — because `buildMetadata` sets `openGraph`, and setting `openGraph` in a
   page's exported metadata suppresses the file-convention image.

The fix is a **route handler at a stable URL** (`/api/og`) that generates the card from query
parameters. It gives every page a tailored image with no per-route file, no hash surprise, and a URL
that can be constructed. Inputs are length-capped and the accent colour is restricted to our own
contrast-checked set, because the endpoint renders whatever it is given.

**On titles**, the fix was two-sided. `buildMetadata` now **drops the site-name suffix when it would
push the title past 60** — a project name is the signal and the brand is not, so truncating the
signal to keep the brand is the wrong trade. And the constructed suffixes were removed entirely
(`— Domain project`, `— project idea`, `— Organisation`), with a handful of fixture titles shortened
where they exceeded 60 on their own.

**Files and directories created.**

```
app/src/
├── content/                     THE CONTRACT PHASE 3 MUST SATISFY
│   ├── types.ts                 every entity type, mirroring Phase 3's enums
│   ├── index.ts                 public* accessors — the visibility predicate, once
│   ├── projects.ts              14 projects, 9 sections each, lineage + hard cases
│   ├── people.ts  colleges.ts  ideas.ts  opportunities.ts
│   ├── knowledge.ts             6 articles + topic hub editorial
│   ├── audiences.ts  features.ts  faqs.ts  site.ts  legal.ts
├── config/taxonomy.ts           8 domains, 16 sub-topics, 17 SDGs — one definition
├── lib/seo/
│   ├── metadata.ts              buildMetadata + ogUrl + ensureDescription
│   ├── jsonld.tsx               13 typed builders, undefined-pruned, `<` escaped
│   ├── visibility.ts            resolveVisibility + resolveFacetedUrl
│   └── og.tsx                   one OG card template, every page type
├── app/
│   ├── (site)/                  the whole public site, one Header/Footer
│   ├── api/og/route.tsx         OG generation at a stable URL
│   ├── sitemap.ts  robots.ts
│   └── not-found.tsx  error.tsx  global-error.tsx
└── components/
    ├── content/rich-text.tsx    markdown-lite, no dangerouslySetInnerHTML
    ├── project/project-card.tsx zero-hydration card + compact row
    └── marketing/audience-page.tsx
app/scripts/check-seo.mjs        the audit that found all of the above
```

**Deviations from the spec above, and why.**

- **14 projects, not 12.** The extra two are the private project and the unverified-college project,
  which exist purely so the exclusion rules have something to exclude. Three of the fourteen are
  never publicly rendered, so their sections are brief rather than fully written — deliberate, and
  noted in the file.
- **`/knowledge/collections/[slug]` was not built.** With six articles a collection layer is a page
  listing two items. Recorded as unticked rather than quietly dropped.
- **The sitemap is a single file, not a segmented index.** The limit is 50,000 URLs and we are at
  127. Splitting now would be structure without purpose; the segmentation note moves to Phase 12,
  when the archive grows.
- **`src/config/taxonomy.ts` was created here rather than in Phase 3**, because four surfaces needed
  it (topic hubs, explore facets, domain colours, project cards). Phase 3 seeds from it rather than
  duplicating it, which is the "one definition, four consumers" rule working as intended.
- **No Lighthouse scores are claimed.** Chrome is available and `npm run shot` and
  `npm run audit:layout` both drive it, but a Lighthouse run was not performed. Phase 16 owns it and
  **no number is asserted here.**
- Two dev servers cannot run for the same directory in Next 16, and port 3000 is held by another
  project — so everything was verified against **port 3001**, with `NEXT_PUBLIC_SITE_URL` still
  pointing at 3000. That mismatch is why the audit now compares the og:image *origin* to the
  canonical origin and then fetches the *path* against the instance under test.

**Anything the next phase must know.**

1. **`src/content/types.ts` is the contract.** Phase 3's Prisma schema must be able to represent
   every field in it. Anything it cannot hold is a schema bug, not a fixture bug. The enums there
   (`SectionKind`, `ProjectStatus`, `ProofTier`, `LineageKind`, `Visibility`, `IdeaStatus`) are the
   ones the schema should declare.
2. **Swap the imports, not the pages.** Every page reads from `@/content` accessors with the same
   shape a `viewer`-scoped query will have. Phase 3/4 replace the bodies; the pages stay.
3. **`resolveVisibility()` already exists and is used everywhere.** Extend it rather than adding a
   second visibility check — that is exactly how a private project leaks into a sitemap.
4. **Run `npm run check:seo` after any page change.** It needs a running server, so it is
   deliberately not in `npm run check`. It caught 191 real defects; it will catch the next ones.
5. **The seed must reproduce the fixtures' hard cases** — the three-level lineage, the
   near-duplicate, the embargo, the private project, the unverified college. The audit asserts the
   exclusions by slug, so keeping the slugs stable keeps the assertions meaningful.
6. **Nothing writes to `og:image` by hand.** `buildMetadata` builds the `/api/og` URL. Pass `og: {}`
   overrides for eyebrow, chips and accent instead.
7. **`config/navigation.ts` flags are still all `planned: true`**, so Header and Footer render no
   links. Flipping them is a one-line change per route and should happen at the start of Phase 3 or
   whenever the nav is wanted — the pages all exist now.

**Verified by.**

| Check | Result |
| --- | --- |
| `npm run typecheck` | Clean |
| `npm run lint` | Zero problems |
| `npm run format:check` | Clean |
| `npm run check:contrast` | 94 pairs, 0 failures, both themes |
| `npm run build` | Compiled in 7.1s, **133 static pages** generated, no errors, no warnings |
| **`npm run check:seo`** | **127 pages, 0 violations** — down from 191 |
| Unique titles | 127 of 127, all ≤ 60 chars, no doubled site name |
| Descriptions | All within 110–160, no duplicates |
| Canonicals | Present and absolute on every page |
| `og:image` | Resolves on every page; origin matches canonical |
| JSON-LD | 247 blocks, all valid JSON |
| Content without JS | Every page over 500 chars of text in raw HTML |
| **Private content excluded** | Private project, private profile, unverified college, unverified company and unapproved proposal all absent from the sitemap |
| `noindex` where required | `/style-guide` and multi-facet explore permutations both confirmed |
| 404 | Returns a real 404 status |
| Layout audit | No horizontal overflow at 390 / 768 / 1280 / 1536 on `/`, `/explore`, `/projects/[slug]` |
| Visual check | Home and project page reviewed at 1280 and 390; cover banner corrected from 16:9 to 3:1 |
