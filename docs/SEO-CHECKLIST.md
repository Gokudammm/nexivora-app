# SEO Checklist & Contract

Distilled from the Google Search Central documentation in `../SEO IMPs/`. Every page in Nexivora
must satisfy the per-page contract in section 2 before it is considered done.

Source files referenced: `SEO Basic.txt` (JavaScript SEO), `SEO Fandametal.txt`, `Page and Meta.txt`,
`Title.txt`, `URL.txt`, `Sitemap.txt`, `Robot.txt`, `robots.txt specification.txt`, `Fevicon.txt`,
`Snipet.txt`, `Feature.txt`, `Mobile Indexing.txt`, `links.txt`, `technical and Spam.txt`,
`APM.txt`, `A guide to Ranking.txt`, `Google Search.txt`, `Google Discover.txt`, `AI Overviews.txt`.

---

## 0. The strategic premise

**Nexivora is mostly a logged-in product, and a logged-in product normally has no organic
traffic.** The entire SEO plan rests on one insight:

> The by-product of this product working is a large, structured archive of *real, fully documented
> student projects* — problem statement, methodology, prototype, results, named team, tech stack,
> SDG alignment. That is better content than anything currently ranking for the enormous Indian
> query space around student projects, and nobody else has it.

Existing results for *"final year project ideas for CSE"*, *"IoT project report"*, *"machine
learning mini project"*, *"SDG projects for students"* are thin listicles, scraped PDFs and
ad-heavy blogspam. Real project pages with real methodology, updated over time and internally
linked to topics, colleges and people, beat all of it on every quality signal Google names in
`A guide to Ranking.txt`.

**So the public surface is not a marketing afterthought. It is the acquisition engine, and it is
built in Phase 2 before the product exists.**

---

## 1. The architectural decisions that do most of the work

| Decision | Why, per the source docs |
| --- | --- |
| **Server-render everything public** | `SEO Basic.txt` describes Google's three-phase crawl → render → index pipeline, where rendering is queued separately and may lag. Content present in the initial HTML skips that queue entirely. Marketing pages, project pages, profiles, topic hubs and articles are all Server Components. |
| **Real `<a href>` links only** | `links.txt` and `SEO Basic.txt`: Googlebot discovers URLs from `href` attributes. A `<div onClick={router.push()}>` is invisible to a crawler. Every navigation uses `next/link`, which renders a real anchor. |
| **No content behind fragments** | `URL.txt`: Google does not support URL fragments for content changes. All state that changes content lives in path segments or query parameters — including every explore filter. |
| **No content behind infinite scroll alone** | The explore and feed surfaces paginate with real, linked, crawlable `?page=` URLs. Infinite scroll is a progressive enhancement layered on top of paginated links, never a replacement for them. |
| **Mobile-first** | `Mobile Indexing.txt`: Google indexes the mobile rendering. Content, structured data and metadata must be identical on mobile and desktop. Nothing is hidden on small screens. |
| **One canonical host** | Pick with-`www` or without, redirect the other, and make `NEXT_PUBLIC_SITE_URL` match. Canonicals, sitemap entries and OG URLs all derive from that one variable. |
| **Private by default, public by choice** | Visibility is a data property, and `noindex` is derived from it. A project that is not `PUBLIC` is never in the sitemap and always carries `noindex`. This is a privacy requirement first and an SEO requirement second. |

---

## 2. Per-page contract

No page ships without all of these. `buildMetadata()` in `src/lib/seo/metadata.ts` enforces most of
it by construction — pages pass typed input and never hand-write tags.

- [ ] **Unique `<title>`**, **60 characters maximum**, descriptive and specific.
      Per `Title.txt`: never vague ("Home", "Profile", "Project"), never keyword-stuffed, never
      boilerplate repeated across pages. Pattern: `{Specific Page Title} · Nexivora`, with the home
      page as `Nexivora — The Global Academic Collaboration Network`.
      **Content pages use the content title alone** — `buildMetadata` drops the ` · Nexivora`
      suffix rather than truncating the title, and constructed suffixes like `— {Domain} project`
      were removed for costing characters without adding information (ADR-020).
- [ ] **Unique meta description**, **110–160 characters**, a human summary of *this* page. For a
      project page it is generated from the summary, not from a template. `ensureDescription()`
      appends true, page-specific context to a source string that is legitimately terse — never
      filler.
- [ ] **Self-referencing canonical**, absolute URL, derived from `NEXT_PUBLIC_SITE_URL`.
- [ ] **One `<h1>`** matching the page subject, with headings in order below it.
- [ ] **OpenGraph + Twitter card** — title, description, 1200×630 image, type, url. The image
      comes from the `/api/og` route handler via `buildMetadata`, **never** the file-based
      `opengraph-image` convention, which silently produced no image at all here (ADR-019).
- [ ] **Robots directives** — explicit `index, follow` for public pages; `noindex, nofollow` for
      everything authenticated, every non-public project, every private profile, and every filter
      permutation we do not want in the index.
- [ ] **`max-image-preview:large`** on public content pages — required for large-image treatment in
      Discover (`Google Discover.txt`) and better snippets.
- [ ] **Structured data** where a type applies (section 3), matching the visible text on the page,
      validated in the Rich Results Test.
- [ ] **Descriptive link text** — never "click here", never "read more" alone. Per `links.txt`,
      anchor text is a ranking and comprehension signal.
- [ ] **Alt text** on meaningful images; `aria-hidden="true"` and no alt on decorative SVG.
- [ ] **Content renders with JavaScript disabled.** The single best test that a page is crawlable —
      and it is in `scripts/check-seo.mjs`, not left to memory.

---

## 3. Structured data map

| Type | Where | Phase |
| --- | --- | --- |
| `Organization` | Root layout, every page | 2 |
| `WebSite` + `SearchAction` | Home — wires up the sitelinks search box | 2 |
| `BreadcrumbList` | Emitted automatically by the `Breadcrumbs` component | 1–2 |
| `CreativeWork` (+ `ScholarlyArticle` where the project is research) | `/projects/[slug]` — the highest-value item on this list | 2 (fixture) → 12 (real) |
| `ItemList` | `/explore`, `/topics/[slug]`, `/sdg/[goal]`, `/ideas` | 2 |
| `Person` + `ProfilePage` | `/p/[username]`, faculty profiles | 2 → 6 |
| `CollegeOrUniversity` | `/colleges/[slug]` | 2 → 14 |
| `Article` | `/knowledge/[slug]`, `/blog/[slug]` | 2 |
| `FAQPage` | `/faq` and genuine FAQ sections on landing pages | 2 |
| `HowTo` | `/how-it-works` | 2 |
| `Event` | `/events/[slug]`, hackathons, workshops, guest lectures | 14 |
| `JobPosting` | `/opportunities/[slug]` — internships and jobs, full payload | 13 |
| `DefinedTerm` / `DefinedTermSet` | Topic and skill taxonomy pages | 11 |
| `SoftwareSourceCode` | Projects that publish a repository link | 12 |

**Rule from `AI Overviews.txt`:** there is no special markup for AI Overviews or AI Mode, and no
"AI text file" to create. Eligibility is ordinary indexing plus snippet eligibility. So the work is
the same work — but it does mean **structured data must match the visible text**, because that is
one of the few things the doc calls out explicitly.

---

## 4. URL rules (`URL.txt`)

- Lowercase, hyphen-separated, no underscores, consistent trailing-slash behaviour.
- Shallow and readable: `/projects/smart-irrigation-using-soil-moisture-sensors`, not `/p?id=8814`.
- Parameters use `key=value` joined by `&`; multiple values for one key use commas. Never brackets,
  never colons as separators. `?domain=ai-ml,iot&sdg=6&status=completed` is the house style.
- Percent-encode reserved characters (IETF STD 66).
- **Slugs are stable and immutable once public.** A project slug is generated at publication from
  the title and never regenerated on edit. If one genuinely must change, 301 to the new URL and
  keep the redirect forever.
- Usernames are the profile URL (`/p/ananya-sharma`) and are reserved against a blocklist so that
  `/p/admin`, `/p/api`, `/p/settings` can never be claimed.
- Filter state lives in query parameters so every combination is shareable — but see section 5 on
  which of those combinations we allow into the index.

### The canonical route table

| Surface | Pattern |
| --- | --- |
| Project | `/projects/[slug]` |
| Public profile | `/p/[username]` |
| College | `/colleges/[slug]` |
| Topic hub | `/topics/[slug]` |
| SDG hub | `/sdg/[number]-[slug]` |
| Idea | `/ideas/[slug]` |
| Knowledge article | `/knowledge/[slug]` |
| Opportunity | `/opportunities/[slug]` |
| Event | `/events/[slug]` |
| Archive citation | `/archive/[citationId]` |

---

## 5. Crawl budget, facets and the duplication trap

An explore page with six filter dimensions generates a combinatorial explosion of URLs, every one
of which is thin and near-duplicate. This is the classic way a site like this wastes its crawl
budget and dilutes its own rankings.

**The rule:** only a curated set of filter combinations is indexable.

| URL shape | Indexable | Why |
| --- | --- | --- |
| `/explore` | ✅ | The hub |
| `/topics/[slug]` | ✅ | Curated, editorially meaningful, one dimension |
| `/sdg/[n]-[slug]` | ✅ | Curated, one dimension |
| `/explore?domain=ai-ml` | ✅, canonical → `/topics/ai-ml` | Single-facet filters canonicalise to their hub page |
| `/explore?domain=ai-ml&sdg=6&year=2026&sort=recent` | ❌ `noindex, follow` | Multi-facet permutation. Crawlable for discovery, never indexed. |
| `/explore?page=2` and beyond | ✅ | Real pagination, self-canonical, not canonicalised to page 1 |

`robots.txt` additionally disallows the highest-cardinality parameter patterns. Remember the
warning in `Robot.txt`: **a `Disallow` prevents crawling, not indexing** of a URL discovered
elsewhere. To keep something *out of the index*, it must carry `noindex` on a page Google is
*allowed* to crawl. So: `noindex` for permutations, `Disallow` only for things that must never be
fetched at all (`/api/`, `/app/`, `/settings/`).

---

## 6. `robots.txt` and sitemaps

**`robots.txt`** — generated by `src/app/robots.ts`:
- Allow the entire public site.
- Disallow `/api/`, `/settings/`, `/workspace/`, `/faculty/`, `/admin/`, `/auth/`, `/feed`, and
  the high-cardinality filter parameter patterns.
- Declare the sitemap index with an absolute URL.

**Sitemaps** — generated by `src/app/sitemap.ts`, segmented into an index as it grows:
- `sitemap-static.xml` — marketing, legal, hubs
- `sitemap-projects.xml` — public projects only
- `sitemap-profiles.xml` — public profiles only
- `sitemap-colleges.xml`, `sitemap-knowledge.xml`, `sitemap-opportunities.xml`, `sitemap-events.xml`

Rules: only canonical, indexable, 200-status URLs. Never a redirect, never a `noindex` page, never a
private project. `lastModified` comes from the real `updatedAt`, not from `new Date()`. Segment
before approaching 50,000 URLs or 50 MB (`Sitemap.txt`).

---

## 7. Favicon (`Fevicon.txt`)

- Square SVG (`/icon.svg`) plus a multi-size `favicon.ico` and a 180×180 `apple-touch-icon`.
- Declared in the root layout on a **stable URL that never changes**.
- Must be crawlable — never blocked by robots.txt.
- A visual representation of the brand — the Nexivora mark, not a generic placeholder.
- Google may take days to weeks to pick it up. It ships in Phase 1, not the week of launch.

---

## 8. Snippets and rich results (`Snipet.txt`, `Feature.txt`)

- Well-structured content with clear headings and direct answers is what becomes a featured
  snippet; there is no markup that requests one. Project pages are therefore written with real
  `<h2>` sections (Problem, Approach, Results) rather than a wall of prose.
- Use `max-snippet`, `max-image-preview:large` and `max-video-preview` deliberately in the robots
  meta on public content.
- `data-nosnippet` on anything that must never appear in a snippet — for us, any personal contact
  detail on a public profile, and any partial content inside an embargoed project.
- FAQ sections written as genuine question/answer pairs serve both users and People-Also-Ask.

---

## 9. Google Discover (`Google Discover.txt`)

Discover is realistic supplemental traffic for the knowledge hub and for showcase stories, and it
is worth a small amount of deliberate effort:

- **`max-image-preview:large` is required** for the large-image treatment, and images should be at
  least 1200px wide. Our OG images are 1200×630, so this is already satisfied.
- Titles must capture the essence without being clickbait. This is a content rule for the knowledge
  hub, and it is the same rule as `Title.txt`.
- Discover explicitly **filters out** job applications, forms and code repositories. So do not
  expect `/opportunities` in Discover — the knowledge hub and project showcase stories are the
  realistic surfaces.
- Treat Discover traffic as volatile and supplemental. Never build a plan on it.

---

## 10. Core Web Vitals (`APM.txt`)

Page experience is measured on real user data, not on a lab run. Budgets and techniques live in
`docs/PERFORMANCE.md`; targets are **LCP < 2.0s, INP < 200ms, CLS < 0.05**, comfortably inside
Google's thresholds. The specific risks in this product are: the explore grid (image and card
count), the feed (list length and hydration), and the task board (drag library weight). Each has a
named mitigation in the performance doc.

---

## 11. Content strategy — where organic traffic actually comes from

In order of expected value:

1. **`/projects/[slug]`** — the archive. Long-tail, enormous, genuinely unique, and it grows for
   free as the product is used. This is the whole thesis.
2. **`/topics/[slug]`** — "AI/ML student projects", "IoT projects", "sustainability projects".
   Editorially written hub pages that link to the best real projects in that topic.
3. **`/ideas`** — "final year project ideas for CSE" is one of the highest-volume queries in this
   space and the Idea Hub answers it with real, claimable, in-progress ideas rather than a listicle.
4. **`/sdg/[n]`** — genuinely open ground. Institutions searching for SDG-aligned student work find
   nothing good today.
5. **`/knowledge/[slug]`** — how to write a project report, how to pick a final-year project, how
   to run a student team. Evergreen, and it feeds Discover.
6. **`/colleges/[slug]`** — branded queries for each college on the platform, and a page each
   college will link to from its own site.
7. **`/p/[username]`** — public profiles, shared by students themselves. Low search volume, high
   referral value.

**Internal linking is the multiplier.** Every project links to its topics, its SDGs, its college,
its team members and its lineage parent and children. Every topic links to its best projects.
Every profile links to its projects. This produces a dense, genuinely useful internal graph built
from real data — which is exactly what `links.txt` and `A guide to Ranking.txt` describe as the
thing that works, and it is impossible to fake.

---

## 12. Spam policy compliance (`technical and Spam.txt`)

We are building a real product, so this is mostly about not doing anything stupid:

- **No doorway pages.** Do not generate `/projects-in-{city}` or `/topics/{x}-for-{college}`
  permutations. Every hub page must have genuine editorial content and a real curated set.
- No keyword stuffing in titles, descriptions or body copy.
- No cloaking — the crawler sees exactly what a logged-out user sees.
- **Scaled content abuse is the real risk here**, and it becomes acute in Phase 18. AI-assisted
  project documentation must be a *draft* that the student edits and publishes deliberately. Never
  auto-publish generated text, and never generate project pages that no human wrote.
- **User-generated content is moderated.** Public projects pass a faculty approval gate before
  publication; reporting, moderation queues and the college verification gate are the controls
  (Phase 16).
- `rel="ugc"` on user-submitted outbound links; `rel="nofollow"` on unverified company links.
- No paid links, no link schemes, no reciprocal-link arrangements with other student portals.

---

## 12a. The audit — `npm run check:seo`

The contract above is impossible to hold by hand across ~130 pages, and every way it breaks is
invisible in a browser. `scripts/check-seo.mjs` crawls every sitemap URL and asserts:

- 200 status (a sitemap must never contain a redirect or an error)
- unique `<title>`, ≤ 60 chars, with no doubled site name
- unique meta description, 110–160 chars
- absolute, self-referencing canonical
- exactly one `<h1>`
- no `noindex` page present in the sitemap
- `og:title`, `og:description`, `og:url` present
- **`og:image` resolves**, and its origin matches the canonical origin
- every JSON-LD block parses
- over 500 characters of text in the raw HTML — the crawlable-without-JS test
- **the private fixtures are absent from the sitemap**, by slug
- `/style-guide` and multi-facet explore permutations carry `noindex`
- a missing route returns a real 404

**On its first run in Phase 2 it found 191 violations** on a site that had already passed typecheck,
lint and a clean production build. It is not part of `npm run check` because it needs a running
server — run it after any page change.

---

## 13. Pre-launch verification

- [ ] Google Search Console property verified; all sitemaps submitted
- [ ] Rich Results Test passes for every structured data type in section 3
- [ ] Mobile-friendly rendering confirmed on a real device, not only in DevTools
- [ ] Lighthouse SEO score 100 on every public page template
- [ ] No duplicate titles or descriptions — verified by `scripts/check-seo.mjs` across the full
      route table, not by spot check
- [ ] All canonicals point at the production host, not `localhost`
- [ ] **`robots.txt` in production does not block the site.** Check this twice. Shipping a staging
      `Disallow: /` to production is the classic launch-day catastrophe.
- [ ] Every public page renders fully with JavaScript disabled
- [ ] No private project, non-public profile or authenticated route appears in any sitemap
- [ ] 404 returns a real 404 status, not a 200 with an error page
- [ ] `/explore` multi-facet permutations return `noindex`
