# Route Map

Every planned route, its access gate, its indexability and the phase that builds it.
`buildMetadata()` enforces the SEO columns; this table is the plan of record.

Legend — **Access:** Public · Auth · Role-gated. **Index:** ✅ indexable · ❌ noindex ·
🔶 conditional (derived from the resource's visibility).

---

## Marketing — `(marketing)`

| Route | Access | Index | Structured data | Phase |
| --- | --- | --- | --- | --- |
| `/` | Public | ✅ | Organization, WebSite+SearchAction, FAQPage | 2 |
| `/for-students` | Public | ✅ | FAQPage | 2 |
| `/for-faculty` | Public | ✅ | FAQPage | 2 |
| `/for-colleges` | Public | ✅ | FAQPage | 2 |
| `/for-companies` | Public | ✅ | FAQPage | 2 |
| `/for-alumni` | Public | ✅ | FAQPage | 2 |
| `/how-it-works` | Public | ✅ | HowTo | 2 |
| `/features` | Public | ✅ | — | 2 |
| `/features/workspace` | Public | ✅ | — | 2 |
| `/features/contribution-ledger` | Public | ✅ | — | 2 |
| `/features/archive` | Public | ✅ | — | 2 |
| `/pricing` | Public | ✅ | Offer | 2 |
| `/about` | Public | ✅ | Organization | 2 |
| `/contact` | Public | ✅ | ContactPoint | 2 |
| `/faq` | Public | ✅ | FAQPage | 2 |
| `/help`, `/help/[slug]` | Public | ✅ | Article, BreadcrumbList | 2 |
| `/changelog` | Public | ✅ | — | 2 |
| `/roadmap` | Public | ✅ | — | 2 |
| `/style-guide` | Public | ❌ | — | 1 |

## Public data surfaces — `(public)` · the organic acquisition engine

| Route | Access | Index | Structured data | Phase |
| --- | --- | --- | --- | --- |
| `/explore` | Public | ✅ | ItemList, BreadcrumbList | 2 → 11 |
| `/explore?[single facet]` | Public | ✅ canonical → hub | ItemList | 11 |
| `/explore?[multi facet]` | Public | ❌ noindex, follow | — | 11 |
| `/projects/[slug]` | Public | 🔶 | **CreativeWork**, BreadcrumbList, Person | 2 → 12 |
| `/projects/[slug]/lineage` | Public | 🔶 | — | 12 |
| `/topics`, `/topics/[slug]` | Public | ✅ | DefinedTermSet, ItemList | 2 → 11 |
| `/sdg`, `/sdg/[n]-[slug]` | Public | ✅ | ItemList | 2 |
| `/ideas`, `/ideas/[slug]` | Public | ✅ | ItemList, CreativeWork | 2 → 11 |
| `/colleges`, `/colleges/[slug]` | Public | ✅ | CollegeOrUniversity, ItemList | 2 → 14 |
| `/colleges/[slug]/projects` | Public | ✅ | ItemList | 14 |
| `/p/[username]` | Public (opt-in) | 🔶 | Person, ProfilePage | 2 → 6 |
| `/p/[username]/projects` | Public (opt-in) | 🔶 | ItemList | 12 |
| `/knowledge`, `/knowledge/[slug]` | Public | ✅ | Article, BreadcrumbList | 2 |
| `/knowledge/collections/[slug]` | Public | ✅ | ItemList | 2 |
| `/opportunities`, `/opportunities/[slug]` | Public | ✅ | **JobPosting**, ItemList | 2 → 13 |
| `/events`, `/events/[slug]` | Public | ✅ | **Event**, ItemList | 14 |
| `/challenges`, `/challenges/[slug]` | Public | ✅ | Event | 14 |
| `/archive/[citationId]` | Public | ✅ | CreativeWork | 12 |
| `/verify/[code]` | Public | ❌ personal record | — | 12 |

## Authentication — `(auth)`

| Route | Access | Index | Phase |
| --- | --- | --- | --- |
| `/login` | Public | ❌ | 4 |
| `/register` | Public | ❌ | 4 |
| `/register/[role]` | Public | ❌ | 4 |
| `/verify-email`, `/verify-email/[token]` | Public | ❌ | 4 |
| `/forgot-password`, `/reset-password/[token]` | Public | ❌ | 4 |
| `/onboarding/[step]` | Auth | ❌ | 4 |
| `/join/[inviteCode]` | Public | ❌ | 5 |

## The application — `(app)` · all `noindex`

| Route | Access | Phase |
| --- | --- | --- |
| `/feed` | Auth | 10 |
| `/feed/following`, `/feed/college`, `/feed/discover` | Auth | 10 |
| `/notifications` | Auth | 10 |
| `/search` | Auth | 11 |
| `/dashboard` | Auth · role-routed | 4 |
| `/groups` | Student, Faculty | 7 |
| `/groups/new` | Student | 7 |
| `/groups/[id]` | Group member | 7 |
| `/groups/[id]/tasks` | Group member | 7 |
| `/groups/[id]/files` | Group member | 7 |
| `/groups/[id]/discussion`, `/discussion/[threadId]` | Group member | 7 |
| `/groups/[id]/meetings` | Group member | 7 |
| `/groups/[id]/ledger` | Group member, Faculty | 7 |
| `/groups/[id]/settings` | Group lead | 7 |
| `/projects/[slug]/edit` | Group member | 8 |
| `/projects/[slug]/edit/[section]` | Group member | 8 |
| `/projects/[slug]/milestones` | Group member, Faculty | 8 |
| `/projects/[slug]/submit` | Group lead | 8 |
| `/projects/[slug]/propose` | Group member, Faculty | 8 |
| `/my/projects` | Any signed-in user | 8 |
| `/faculty/proposals` | Faculty | 8 |

> **`[slug]`, not `[id]`, under `/projects`.** Next refuses two different dynamic segment names at
> the same route position, and `/projects/[slug]` is the public page. A slug is unique and is never
> regenerated after creation, so it is a stable identifier as well as a readable one. Corrected in
> Phase 8.

| `/projects/[slug]/review` | Faculty | 9 |
| `/faculty` | Faculty | 9 |
| `/faculty/classes`, `/faculty/classes/[id]` | Faculty | 9 |
| `/faculty/groups` | Faculty | 9 |
| `/faculty/submissions` | Faculty | 9 |
| `/faculty/rubrics`, `/faculty/rubrics/[id]` | Faculty | 9 |
| `/faculty/announcements` | Faculty | 9 |
| `/faculty/attestations` | Faculty | 9 |
| `/admin` | College Admin | 5 |
| `/admin/departments`, `/programmes`, `/subjects`, `/terms` | College Admin | 5 |
| `/admin/classes`, `/admin/classes/[id]` | College Admin | 5 |
| `/admin/people`, `/admin/people/import` | College Admin | 5 |
| `/admin/invitations` | College Admin | 5 |
| `/admin/college` | College Admin | 5 |
| `/admin/audit-log` | College Admin | 5 |
| `/admin/reports`, `/admin/reports/accreditation` | College Admin | 15 |
| `/admin/analytics` | College Admin | 15 |
| `/mentorship`, `/mentorship/[id]` | Alumni, Faculty, Student | 13 |
| `/company`, `/company/opportunities`, `/company/talent`, `/company/pipeline` | Company | 13 |
| `/assistant` | Auth | 18 |
| `/settings/profile` | Auth | 6 |
| `/settings/privacy` | Auth | 6 |
| `/settings/account` | Auth | 4 |
| `/settings/security` | Auth | 4 |
| `/settings/notifications` | Auth | 10 |
| `/settings/data` (export + delete) | Auth | 16 |
| `/platform` (verification queue, moderation, health) | Platform Admin | 5, 16 |

## Legal & trust

| Route | Access | Index | Phase |
| --- | --- | --- | --- |
| `/legal/privacy` | Public | ✅ | 2 |
| `/legal/terms` | Public | ✅ | 2 |
| `/legal/community-guidelines` | Public | ✅ | 2 |
| `/legal/academic-integrity` | Public | ✅ | 2 |
| `/legal/ip-policy` | Public | ✅ | 2 |
| `/legal/accessibility` | Public | ✅ | 2 |
| `/legal/grievance` (named officer, IT Rules) | Public | ✅ | 2 |
| `/legal/cookies` | Public | ✅ | 2 |

## System

| Route | Purpose | Phase |
| --- | --- | --- |
| `/sitemap.xml` (index) + segmented sitemaps | Crawl | 2 |
| `/robots.txt` | Crawl | 2 |
| `/manifest.webmanifest` | PWA | 2 |
| `/opengraph-image` + per-route variants | Social | 2 |
| `/offline` | PWA fallback | 16 |
| `/not-found` (real 404) | — | 2 |
| `/error`, `/global-error` | — | 2 |
| `/api/health` | Monitoring | 17 |
| `/api/sse` | Realtime | 10 |
| `/api/files/[id]` | Signed, authorised file access | 7 |
| `/api/search` | Typeahead | 11 |

---

## What Phase 2 actually shipped

**127 indexable pages**, verified by `npm run check:seo` crawling the sitemap.

| Surface | Pages |
| --- | --- |
| Marketing (home, 5 audience, how-it-works, features + 3, pricing, about, contact, FAQ, changelog, roadmap) | 17 |
| Help centre (index + 8 articles) | 9 |
| Legal (8 documents) | 8 |
| Explore + project pages | 13 |
| Topic hubs (index + 8 domains + 16 sub-topics) | 25 |
| SDG hubs (index + 17 goals) | 18 |
| Idea Hub (index + 11 ideas) | 12 |
| Colleges (index + 2 verified) | 3 |
| Public profiles | 11 |
| Knowledge hub (index + 6 articles) | 7 |
| Opportunities (index + 4 live) | 5 |

**Deliberately excluded and asserted absent:** one private project, one project at an unverified
college, one unapproved proposal, one private profile, the unverified college itself, one unverified
company's listing, and `/style-guide`.

**Not built:** `/knowledge/collections/[slug]` — with six articles a collection layer would list two
items. Deferred.

**Sitemap segmentation** is deferred to Phase 12. The limit is 50,000 URLs; we are at 127, and
splitting now would be structure without purpose.

---

## Route count by phase

| Phase | New public routes | New authenticated routes |
| --- | --- | --- |
| 1 | 1 | 0 |
| 2 | ~45 (incl. dynamic fixtures) | 0 |
| 4 | 0 | 8 |
| 5 | 0 | 11 |
| 6 | 2 | 2 |
| 7 | 0 | 8 |
| 8 | 0 | 5 |
| 9 | 0 | 8 |
| 10 | 0 | 6 |
| 11 | 0 | 2 |
| 12 | 3 | 0 |
| 13 | 2 | 6 |
| 14 | 5 | 0 |
| 15 | 0 | 3 |
| 16 | 1 | 2 |
| 18 | 0 | 1 |

**Phase 2 alone ships roughly 45 indexable pages before a single database row exists.** That is
deliberate — it is the SEO engine, and it means there is a complete, impressive, shareable product
surface from week one.
