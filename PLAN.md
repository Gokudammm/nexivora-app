# Nexivora — Master Build Plan

**Product:** Nexivora — The Global Academic Collaboration Network
**Type:** Individual startup project · **Owner:** achaudhary7@gmail.com
**Plan version:** 1.0 · **Created:** 2026-09-08

> Read `CONTEXT.md` before this file. Track live status in `PROGRESS.md`.
> Each phase has a full spec in `docs/phases/`.

---

## Part A — Decisions taken up front

### A1. The stack, and why

| Layer | Choice | Reasoning |
| --- | --- | --- |
| Framework | **Next.js 16 (App Router) + TypeScript** | Server Components render real HTML on the first response. That is the single biggest SEO lever — the Google JavaScript-SEO doc in `../SEO IMPs/SEO Basic.txt` spends its whole length warning about content that only appears after JS executes. We sidestep it entirely. Also gives file-based routing, per-route metadata, image/font optimisation and route-level code splitting for free. |
| Styling | **Tailwind CSS v4 + CSS custom properties** | Design tokens live in CSS variables, so light/dark and per-college white-labelling are one variable swap. Output is purged to what we actually use — typically under 15 KB gzipped. |
| Components | **Hand-built primitives on Radix UI** | Radix supplies accessible unstyled behaviour (dialog focus trap, combobox keyboard nav, popover positioning). We style each one once in `components/ui/` and never re-implement. No megabyte component library shipped to the browser. |
| Database | **PostgreSQL 16 — dev and production** | Not SQLite. This product needs full-text search across projects, ideas, posts and people (`tsvector` + GIN) and trigram similarity for duplicate-project detection (`pg_trgm`). Both are built into Postgres and free. Doing dev on SQLite and prod on Postgres would mean the two most important queries in the product are untested until deployment. See ADR-003. |
| ORM | **Prisma 7.10.0, pinned** | Type-safe queries, real migration history, and a seed script — which matters enormously for a demo that must be resettable in ten seconds. Raw SQL where Postgres FTS needs it. Pinned because the `latest` tag has pointed at a release candidate (ADR-002); Prisma 7 needs `prisma.config.ts` and the `@prisma/adapter-pg` driver adapter. |
| Auth | **Auth.js v5 (NextAuth), credentials + JWT sessions** | Free, self-hosted, no external identity provider, no per-MAU billing. Role and institution claims in the JWT drive middleware route gating. Google OAuth added later as a convenience, never as the only path. |
| Realtime | **Server-Sent Events for notifications and presence; polling for chat** | SSE is one HTTP response, works behind Nginx, needs no extra service, and costs nothing. Socket.io is deferred until a measured need. All of it sits behind `lib/realtime/` so the transport can change without touching a feature. See ADR-006. |
| File storage | **Local disk in dev and on the VPS, behind a `StorageProvider` interface** | Uploads are served through a signed, authorisation-checked route handler — never a bare static path. Cloudflare R2 (10 GB free) drops in later by implementing one interface. |
| Search | **PostgreSQL full-text + `pg_trgm`** | No Algolia, no Elasticsearch, no cost, no service to expire. Good enough to well past 100k rows. |
| Charts | **Recharts** | React API, SVG output (fits the all-SVG rule), tree-shakeable, dynamically imported only on dashboard routes. |
| PDF / QR | **@react-pdf/renderer + qrcode** | Server-side portfolio PDFs, certificates and accreditation exports. Both MIT, both offline. |
| Validation | **Zod 4** | One schema validates the form on the client and the payload on the server. No drift. |
| Email | **Nodemailer — console transport in dev** | Free. Swaps to Hostinger SMTP or Brevo's free tier (300/day) in production with no code change. |
| Testing | **`node --test` + Playwright** | Node 24 runs TypeScript directly and ships a stable test runner, so the unit tests that matter — the permission matrix, the ledger maths, the similarity scorer — need no framework and no build step (**ADR-024**, revising the original Vitest choice). Playwright still owns the four critical end-to-end journeys. Revisit if component tests need a DOM. |

**Rejected, deliberately:** Vercel (owner constraint), Firebase/Supabase (vendor lock-in and a
pricing cliff exactly when the product succeeds), any paid API, any component library that ships a
megabyte of CSS, video conferencing (we schedule and link meetings, we do not host them), and a
real-time collaborative document editor. The last two are integration points, not builds, and we
say so honestly.

### A2. Hosting — the recommendation

Three stages, and the first two cost nothing.

1. **Development and demo — `localhost`.** `npm run dev`, local Postgres, seeded demo college.
   Nothing can fail on stage because nothing leaves the machine. This is the demo path.
2. **Sharing with faculty, testers and investors — Cloudflare Tunnel.**
   `cloudflared tunnel --url http://localhost:3000` gives a public HTTPS URL in about five seconds:
   free, no account, no card. It runs the real app off your machine. Perfect for review rounds and
   for putting a live link in a submission or a pitch email.
3. **Production — Hostinger VPS (KVM 2), not shared hosting.**

   **This is important and easy to get wrong.** Hostinger's *shared* plans (Premium / Business web
   hosting) run PHP and MySQL only. They cannot run a Node.js process, so a server-rendered Next.js
   app will not work there. You need the **VPS** tier — a real Ubuntu box. KVM 1 (1 vCPU / 4 GB)
   will run it; **KVM 2 (2 vCPU / 8 GB) is the recommendation** because Postgres, Node and Nginx on
   one box with 4 GB gets tight once the seed data is real.

   On it: Node 22 + PM2 (process manager, restarts on crash and on boot) + Nginx (reverse proxy,
   brotli, static caching, SSE-safe buffering config) + PostgreSQL 16 + Certbot (free Let's Encrypt
   TLS) + a nightly `pg_dump` to object storage. Full runbook in `docs/DEPLOYMENT.md`.

   *If a VPS is genuinely not possible:* the free alternatives that do run Node are **Render**
   (750 h/month, sleeps when idle), **Railway**, **Fly.io** and **Koyeb**, paired with **Neon**'s
   free Postgres tier. Any of those is a better fallback than splitting the app. Static-exporting
   the public site onto shared hosting while the app lives elsewhere is a last resort — it breaks
   shared navigation and session, and it is not recommended.

**Domain:** buy `nexivora.com` early (Hostinger sells it) and point it at the VPS from Phase 17.
Buy it before the pitch, not after — an invented name is only defensible if you own it.

### A3. What we add to the brief

The brief is ambitious but incomplete. These are the additions, each justified in `CONTEXT.md` §4.

**New features:** the Contribution Ledger and peer review · three-tier contribution proof
(self-claimed / workspace-evidenced / faculty-attested) · project lineage and the **Build On**
mechanism · the permanent citable Academic Archive · duplicate-project similarity detection ·
NAAC/NBA/NIRF accreditation export · academic IP and embargo controls · a project-inferred skill
graph · SDG alignment as a first-class filterable dimension · structured rubric evaluation ·
group health signals for faculty (silent members, slipped milestones) · a public verification page
for archived projects and attestations.

**Missing pages the brief never mentions but a real platform must have** (all specified in
`docs/SITEMAP.md`): a public project explore surface that works logged-out — *this is the SEO
engine of the entire product* · individual public project pages with `CreativeWork` structured
data · topic hubs · SDG hubs · public college pages · public academic profiles · the Idea Hub as a
public surface · a knowledge hub · an opportunity board with `JobPosting` data · an events
calendar with `Event` data · pricing/for-institutions · about, contact, FAQ, help centre, changelog
· privacy policy, terms, community guidelines, academic integrity policy, accessibility statement,
and a named grievance officer contact (mandatory for an Indian consumer platform under the IT Rules
and the DPDP Act) · 404 and 500 pages · `sitemap.xml`, `robots.txt`, manifest, offline page.

### A4. Sequencing logic

Phases 0–2 build the shell and the entire public, SEO-visible surface **before** any database work.
That is deliberate: there is something impressive and complete to show from day two, the design
system is settled before feature pressure starts, and every later feature drops into an existing
layout instead of inventing one.

Phases 3–12 are the product and are the **minimum viable demo for one college**. If time runs out,
stop after Phase 12 and present 13–19 as a roadmap.

Phase 7 (Group Workspace) is the heart of the product and the largest single phase. Everything
before it is scaffolding for it; everything after it is leverage on it. Do not rush it.

Phase 18 (AI) is last and strictly additive — every AI feature has a deterministic fallback that is
already shipped and already works.

---

## Part B — The phases

| # | Phase | Outcome | Est. | Status |
| --- | --- | --- | --- | --- |
| 0 | Foundation & Setup | Repo, stack, tooling, docs, tracking, env | 4h | ⬜ |
| 1 | Design System & Brand | Logo, tokens, UI kit, Header/Footer, icons, a11y | 8h | ⬜ |
| 2 | Public Site & SEO Core | 25+ public pages, sitemap, JSON-LD, OG images | 10h | ⬜ |
| 3 | Data Model & Seed | Prisma schema, hierarchy, taxonomy, demo college | 7h | ✅ |
| 4 | Auth, Roles & RBAC | 7 roles, sessions, onboarding, route + data gating | 7h | ✅ |
| 5 | Institution Backbone | College/dept/subject/class admin, invites, imports | 8h | ✅ |
| 6 | Profiles & Academic Identity | Profiles, public `/p/[username]`, privacy, skill graph | 7h | ⬜ |
| 7 | Group Workspace | Groups, tasks, files, discussion, meetings, **ledger** | 14h | ⬜ |
| 8 | Project Lifecycle & Pages | Structured project record, milestones, SDG, submission | 10h | ⬜ |
| 9 | Faculty Review & Evaluation | Dashboard, rubrics, feedback, attestation, health | 9h | ⬜ |
| 10 | Academic Feed & Notifications | Activity-anchored feed, follow, engage, notify | 9h | ⬜ |
| 11 | Discovery, Ideas & Matching | Explore, search, Idea Hub, teammate matching, requests | 9h | ⬜ |
| 12 | Showcase, Archive & Portfolio | Public projects, lineage, citation, portfolio, PDF | 9h | ⬜ |
| 13 | Alumni & Company Network | Verified alumni, mentorship, companies, opportunities | 9h | ⬜ |
| 14 | Inter-College, Events & Global | College network, cross-college collab, events, hackathons | 8h | ⬜ |
| 15 | Analytics & Accreditation | Dashboards, NAAC/NBA/NIRF export, SDG and impact reports | 9h | ⬜ |
| 16 | Hardening | Perf, a11y, security, moderation, rate limits, PWA, audit | 8h | ⬜ |
| 17 | Deployment & Operations | Local, tunnel, Hostinger VPS runbook, backups, CI | 6h | ⬜ |
| 18 | AI Assistant Layer *(last)* | Assistant, summaries, semantic search, suggestions | 8h | ⬜ |
| 19 | Launch & Pitch Pack | Seed story, deck, demo script, GTM, roadmap | 5h | ⬜ |

**Total: ~174 focused hours.** These are focused hours, not calendar time. Phases 0–12 (the MVP
contract) are ~104 of them.

---

### Phase 0 — Foundation & Project Setup
Scaffold Next.js + TypeScript + Tailwind, ESLint/Prettier, path aliases, validated environment
handling, the folder architecture for all twenty phases, git with sensible ignores, and the full
documentation and phase-tracking system.
**Exit:** `npm run dev` serves a styled placeholder; `npm run build`, `lint` and `typecheck` are
clean; every documentation file exists. → `docs/phases/phase-00-foundation.md`

### Phase 1 — Design System & Brand Identity
The Nexivora SVG logo (mark, wordmark, lockups, full favicon and PWA icon set), the colour, type,
space, radius, shadow, motion and z-index token system with dark mode, and the reusable primitive
library: Button, Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, Field, Card, Badge,
Avatar, AvatarGroup, Tabs, Dialog, Sheet, Popover, Dropdown, Tooltip, Toast, Table, Progress,
Skeleton, EmptyState, ErrorState, Breadcrumbs, Pagination, Stepper, Timeline, Chip. Plus the site
`Header`, `Footer`, `Container`, `Section`, `PageHeader`, and the app shell (`Sidebar`, `Topbar`,
`CommandPalette` shell). A custom inline SVG icon set and an SVG illustration set. WCAG 2.1 AA
contrast verified by script in both themes.
**Exit:** `/style-guide` renders every component in every state in both themes; contrast audit
passes 100%. → `docs/phases/phase-01-design-system.md`

### Phase 2 — Public Marketing Site & SEO Core
Every logged-out page: home, four audience landing pages (students, faculty, colleges, companies),
how-it-works, features, the public **explore** surface and project detail pages, topic hubs, SDG
hubs, the public Idea Hub, knowledge hub index and articles, about, contact, FAQ, help centre,
changelog, pricing for institutions, and the full legal set (privacy under the DPDP Act, terms,
community guidelines, academic integrity policy, accessibility statement, named grievance officer).
Plus the SEO machinery: `buildMetadata()`, canonicals, `sitemap.ts`, `robots.ts`, typed JSON-LD
builders (Organization, WebSite+SearchAction, BreadcrumbList, FAQPage, CreativeWork, Article,
Person, CollegeOrUniversity, Event, JobPosting, ItemList), dynamic SVG-based OG images, and the PWA
manifest. Content lives in `src/content/` as typed fixtures — **this becomes the contract Phase 3's
schema must satisfy.**
**Exit:** Lighthouse 95+/95/100/100 on home; every page has a unique title, description and
canonical; every page renders with JavaScript disabled; sitemap validates.
→ `docs/phases/phase-02-public-seo.md`

### Phase 3 — Data Model, Taxonomy & Seed
**Built: 90 models, 29 enums, 3 migrations, 16 check constraints, 6 triggers, 10 GIN indexes.**
The academic hierarchy for three colleges, the taxonomy and the 17 SDGs seeded from
`src/config/taxonomy.ts`, demo users across all seven roles, groups mid-project, and an archive
with a real three-level lineage chain.

The invariants live in the database rather than in convention: every feed post has exactly one
anchor, and a publicly visible project without faculty approval cannot be stored. Full-text search
is trigger-maintained with A/B/C/D weighting, and the duplicate detector is a tested pure function
over a trigram shortlist.

**Exit — met:** `npm run db:reset` rebuilds the demo world in **3.4s** (budget 20s) and is
byte-for-byte reproducible; `npm run db:verify` passes **26 / 26** assertions, including that the
anonymous query layer returns exactly the same public projects as the Phase 2 fixtures.
→ `docs/phases/phase-03-data-model.md`

### Phase 4 — Authentication, Roles & RBAC
Register, login, logout, password reset, email verification (console transport in dev), the seven
roles (Student, Faculty, College Admin, Alumni, Company, Researcher, Platform Admin), institutional
email domain verification, middleware route gating, per-role onboarding wizards, account and
security settings, session management, and the **authorisation helpers used by every later phase**.
Authorisation is enforced at the data layer, not only in middleware.
**Exit:** every role registers, onboards and lands on its own dashboard; cross-role and
cross-college access is denied at the middleware and again at the query; the permission matrix in
`docs/ROLES-PERMISSIONS.md` is unit-tested. → `docs/phases/phase-04-auth-rbac.md`

### Phase 5 — Institution Backbone
The college administration console: departments, programmes, subjects, academic terms, classes and
sections, faculty assignment, student roster, bulk CSV import with validation and a dry-run
preview, invite links and join codes, role assignment, college profile and branding, verification
request to the platform, and the audit log of every administrative action.
**Exit:** an admin builds a department, a subject, a class and a roster of fifty students from a
CSV in one sitting, and every action is in the audit log.
→ `docs/phases/phase-05-institution.md`

### Phase 6 — Profiles & Academic Identity
The student and faculty profile: avatar (generated SVG identicon by default), bio, department,
year, skills, interests, links, education, achievements, and the **project-inferred skill graph**.
The public `/p/[username]` page with `Person` + `ProfilePage` structured data, granular privacy
controls (public / college-only / connections / private, per field), the follow model, and the
faculty expertise profile.
**Exit:** a profile is complete, its public view respects every privacy toggle, and its indexable
version is verifiably crawlable. → `docs/phases/phase-06-profiles.md`

### Phase 7 — Groups & the Project Workspace *(the heart of the product)*
Group creation and membership (invite, request, faculty-assign), roles inside a group, and the
private workspace: **task board** with assignees, due dates, priorities and statuses; **file
library** with versioning, preview and access control; **threaded discussion** with mentions;
**meeting scheduling** with agenda, notes and attendance; **deadline calendar**; activity stream;
and the **Contribution Ledger** — the automatic per-member record of tasks closed, files
contributed, discussion participation and milestones owned, plus the structured peer review that
closes each milestone.
**Exit:** a five-member group runs a full two-week sprint inside the workspace, and the ledger
reflects what each person actually did. → `docs/phases/phase-07-workspace.md`

### Phase 8 — Project Lifecycle & Project Pages
The structured project record: problem statement, background research, proposed solution,
methodology, prototype, testing and results, conclusion, team and roles, tech stack, SDG alignment,
attachments and links. Lifecycle states (Draft → Proposed → Approved → In Progress → Under Review →
Completed → Archived) with the transitions gated by role. Milestones and progress computation,
faculty approval of the proposal, duplicate-similarity check against the archive at proposal time,
visibility settings (private / group / class / college / public) and the IP embargo control, and
final submission with a versioned snapshot.
**Exit:** a project goes end to end from draft to submitted, the similarity check catches a
deliberate near-duplicate in the seed, and the public view honours visibility.
→ `docs/phases/phase-08-project-lifecycle.md`

### Phase 9 — Faculty Dashboard, Review & Evaluation
The dashboard faculty actually need: subjects and classes they teach, every group and its live
status, progress at a glance, **group health signals** (silent members, slipped milestones, no
commits in fourteen days), submission queue, structured **rubric-based evaluation** with weighted
criteria and per-member marks, inline feedback on any project section, announcements and deadline
broadcast, meeting scheduling with groups, and the **attestation** action that converts a
workspace-evidenced contribution into a faculty-attested one.
**Exit:** a faculty member reviews a submission against a rubric, leaves sectioned feedback,
attests two contributions, and broadcasts a deadline — all in under ten minutes.
→ `docs/phases/phase-09-faculty.md`

### Phase 10 — Academic Feed, Engagement & Notifications
The feed, built the right way: every post is **anchored** to a project, an idea, a question or a
resource — there are no free-form status updates. Post types: project update, milestone reached,
research finding, prototype demo, achievement, question, resource share, project published.
Composer with typed fields per post type, rich text with safe sanitisation, SVG-safe media handling,
like / comment / save / share, follow people, projects, topics and colleges, three feed tabs
(Following, My College, Discover) with a deterministic ranking function, and the notification
system (in-app, SSE-delivered, digest email) with per-category preferences.
**Exit:** the feed is populated entirely by real activity from the seed, ranking is deterministic
and explainable, and notifications arrive without a page refresh.
→ `docs/phases/phase-10-feed.md`

### Phase 11 — Discovery, Idea Hub & Collaboration
Global search across projects, people, ideas, groups, colleges and resources using Postgres FTS,
with faceted filters (domain, tech, SDG, status, year, college). The **Idea Hub**: post an idea,
set its status (Idea → Looking for Team → In Development → Testing → Completed), categorise it, and
attract collaborators. **Deterministic teammate matching** — skill overlap, complementary gaps,
department, availability and interest tags, with a visible explanation of every suggestion.
Collaboration requests with accept/decline, saved searches, and the "projects like this" related
list built from shared tags and trigram similarity.
**Exit:** a student posts an idea, receives ranked teammate suggestions with reasons, sends a
request and forms a group — with no AI involved. → `docs/phases/phase-11-discovery.md`

### Phase 12 — Showcase, Archive & Portfolio
The public face of student work: the **Innovation Wall** and project showcase, public project pages
with full structured data, the permanent **Academic Archive** with a stable citation ID and a
copyable citation block, the **Build On** flow that records lineage, the lineage tree rendered as
SVG, three-tier contribution badges rendered distinctly, the student and group **portfolio** page,
one-click PDF portfolio and project-report export, and the public verification page for an
attestation or archived project.
**Exit:** a completed project is publicly citable, its lineage tree renders, a recruiter can filter
to faculty-attested work, and a portfolio PDF generates in under three seconds.
→ `docs/phases/phase-12-showcase-archive.md`

---

**⬆ Phases 0–12 are the MVP. Everything below is expansion.** ⬆

---

### Phase 13 — Alumni & Company Network
Verified alumni profiles tied to a college and graduating batch, follow-your-college, alumni
feedback on student projects, mentorship request/accept/session flow with matching on domain,
guest-session scheduling, company profiles with verification gate, the **opportunity board**
(internships, jobs, hackathons, competitions, research positions) with `JobPosting` structured data,
talent discovery filtered by verified project work, and applicant tracking through a simple pipeline.
**Exit:** an alumnus mentors a group through a full cycle; a company posts an internship, discovers
a student by their project work, and moves them through the pipeline.
→ `docs/phases/phase-13-alumni-companies.md`

### Phase 14 — Inter-College Network, Events & Global Collaboration
Verified college profiles and the college-to-college follow graph, cross-college project
collaboration with a permissions model that respects both institutions, cross-college search,
an events system (workshops, guest lectures, hackathons, competitions, conferences) with
registration and `Event` structured data, hackathon and challenge hosting with team formation,
submission and judging, and public leaderboards and college showcases.
**Exit:** two colleges collaborate on one project with correct access on both sides; a hackathon
runs from announcement to judged result. → `docs/phases/phase-14-intercollege-events.md`

### Phase 15 — Analytics, Accreditation & Reports
Dashboards for every role, each metric defined exactly once in `lib/analytics/`. The student
progress view, the faculty class analytics, the department and college dashboards, the SDG impact
report, the innovation and research output report, and the **accreditation export** — NAAC criteria
mapping, NBA project and outcome evidence, NIRF data points, AICTE activity summaries — produced as
CSV and PDF from data the platform already holds. Plus the platform admin view.
**Exit:** an admin produces an accreditation-ready evidence pack for one academic year, and every
number in it traces to a real query. → `docs/phases/phase-15-analytics.md`

### Phase 16 — Performance, Accessibility, Security & Trust Hardening
Core Web Vitals against the budgets, bundle analysis, image and font strategy, list virtualisation,
query N+1 elimination and index review. The full keyboard and screen-reader pass with axe. Then the
trust layer: rate limiting, CSRF, security headers and CSP, upload validation and quarantine,
signed file access, moderation and reporting queues, block/mute, spam controls, audit logging, PII
minimisation and DPDP-aligned data export and deletion. Plus the PWA: service worker, offline page,
installability.
**Exit:** budgets met and measured, axe-clean, the `docs/SECURITY.md` checklist fully ticked, and a
user can export and delete their own data. → `docs/phases/phase-16-hardening.md`

### Phase 17 — Deployment & Operations
Production build configuration, the environment matrix, Postgres provisioning and migration path,
the Cloudflare Tunnel recipe, the full Hostinger VPS runbook (Node, PM2, Nginx with SSE-safe
buffering, PostgreSQL, Certbot, UFW, fail2ban), nightly encrypted backups with a tested restore, a
GitHub Actions CI that typechecks, lints, tests and builds, health checks, structured logging and
uptime monitoring.
**Exit:** a documented, repeatable deploy; a rollback under two minutes; a restore from backup
proven, not assumed. → `docs/phases/phase-17-deployment.md`

### Phase 18 — AI Assistant Layer *(built last, by design)*
Only after everything above works. The personal academic assistant: natural-language navigation and
"how do I…" answers grounded in the help content, project summarisation, semantic search layered on
top of the Phase 11 lexical search, teammate suggestions enriched beyond the deterministic score,
literature and resource suggestions, deadline and workload nudges, and draft assistance for project
documentation (always draft, never auto-published). Every feature sits behind an `AIProvider`
interface with a `NullProvider` fallback, aggressive response caching, per-user token quotas and a
hard global budget cap.
**Exit:** with `AI_ENABLED=false` the entire product still works and no UI is broken; with it on,
every AI surface degrades gracefully on error or quota exhaustion.
→ `docs/phases/phase-18-ai-assistant.md`

### Phase 19 — Launch & Pitch Pack
A narrative seed dataset (a believable college, named students, real-looking projects with genuine
lineage), the demo script timed to the slot, the pitch deck built from `docs/PITCH.md`, an SVG
architecture diagram, an honest "what is mocked" slide, the landing-page launch copy, a pilot
proposal document for the first college, and the post-MVP roadmap.
**Exit:** the full demo runs in the allotted minutes without a single off-script keystroke.
→ `docs/phases/phase-19-launch-pack.md`

---

## Part C — Cross-cutting rules that apply in every phase

1. **Reuse before you write.** If a `Button` exists, no phase creates another one. Anything used
   twice moves into `components/ui/` immediately.
2. **Server-first.** A component is a Server Component unless it needs state, effects or event
   handlers. `'use client'` is a decision, not a default, and it is pushed to the leaf.
3. **Every page ships metadata.** Unique title, unique description, canonical, OG and Twitter.
   A page without these does not pass review. See `docs/SEO-CHECKLIST.md`.
4. **Every image is SVG** — inline for icons (no request), componentised for illustrations.
5. **Every list has an empty state, a loading skeleton and an error state.** All three, always.
6. **Authorisation is checked at the data layer**, not only in middleware. Middleware is a
   convenience; the query is the boundary. Every query that reads institution-scoped data takes the
   viewer's context as an argument.
7. **Every mutation is validated with Zod on the server**, regardless of client validation.
8. **No secret in the repo.** `.env.example` is committed, `.env` never is.
9. **Every user-visible string that names the product comes from `config/site.ts`.**
10. **Update the phase file as you go**, not at the end when you have forgotten what you did.

## Part D — Risk register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| **Scope overrun — the vision is enormous** | High | High | Phases 0–12 are the contract; 13–19 are roadmap. Every phase ships something demonstrable on its own. |
| **The feed is empty and the product feels dead** | High | High | The feed is generated from project activity, not from users remembering to post. Phase 3's seed makes it full from day one. |
| **Cold start — a social network with no users** | Certain | High | We do not launch as a network. We launch as a *tool one class uses for one semester* (workspace + faculty dashboard). The network is a by-product. This is the Phase 19 go-to-market. |
| **AI credits exhausted** | High | Low | AI is Phase 18 and strictly additive. The product is complete and demonstrable without it. |
| **Hostinger shared hosting cannot run Node** | Certain | Medium | Documented up front (§A2). VPS or a free Node host. Never discover this at deploy time. |
| **Phase 7 is bigger than estimated** | High | Medium | It is estimated at 14h, double any other phase, and split into four checkpoints in its spec so partial progress is still shippable. |
| **Design drifts across twenty phases** | Medium | Medium | Phase 1 lands the system before features start; `/style-guide` is the reference and the regression test. |
| **Privacy incident with student data** | Low | Severe | DPDP-aligned from Phase 4. Privacy defaults are private. Phase 16 owns export, deletion, moderation and the audit log. |
| **Losing context between sessions** | Medium | High | This plan, `PROGRESS.md`, and the mandatory per-phase summary blocks exist precisely for this. |
