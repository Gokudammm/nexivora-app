# Phase 6 — Profiles & Academic Identity

| | |
| --- | --- |
| **Status** | ✅ Complete |
| **Depends on** | Phase 5 |
| **Blocks** | Phases 10, 11, 12, 13 |
| **Estimate** | 7 focused hours |
| **Started** | 2026-09-09 |
| **Completed** | 2026-09-09 |

## What Phase 3 already provides

*Added 2026-09-09, when Phase 3 completed. Check these before building — the most common way to
waste a phase is to rebuild something the previous one shipped.*

- `StudentProfile`, `FacultyProfile`, `AlumniProfile`, `ResearcherProfile`,
  `CompanyProfile`, `Skill`, `UserSkill`, `UserLink`, `Achievement` and `Attestation` are
  all modelled and seeded.
- **`UserSkill.source` is the three-tier proof model**: `SELF` · `PROJECT_INFERRED` ·
  `ATTESTED`. The tier is the whole credibility claim — never display them identically.
- **`db:verify` asserts every `FACULTY_ATTESTED` contribution has a real `Attestation`.** Keep
  it that way: an attested tier with no signature behind it is exactly the inflation the model exists
  to prevent.
- `PrivacySetting` defaults to the most private useful value. Public profiles are opt-in.

## What Phase 4 already provides

*Added 2026-09-09, when Phase 4 completed.*

- **`can(viewer, action, resource)` in `src/lib/authz/policy.ts` is the only place a permission
  is decided.** 41 actions, 100 matrix assertions. If you are about to write `if (role === …)`,
  the rule belongs there instead.
- **Every query takes `viewer` first**, including for the logged-out public where `ANONYMOUS` is
  a real viewer. A denied read returns `null`; a denied write throws `ForbiddenError`.
- **Roles are per membership; faculty scope is per subject.** There is no `viewer.role` (ADR-029).
- **Guards protect pages, the query protects data** (ADR-028). Anything you add must be safe with
  `proxy.ts` disabled — `isolation.test.ts` asserts exactly that.
- **The onboarding wizard already collects the answers** and leaves them in
  `OnboardingProgress.data` as JSON. **Turning them into `StudentProfile` / `FacultyProfile` /
  `AlumniProfile` rows is a Phase 6 deliverable** — deliberately deferred so a half-finished
  wizard cannot produce a half-built profile.
- **Username lock:** `User.usernameLockedAt` exists and the account page tells people the handle
  becomes fixed after 30 days, because it is a public URL other people cite. Enforcing it is yours.
- **`PrivacySetting` defaults to the most private useful value**, and `can('student:contact')`
  already honours `contactable`. Extend `resolveVisibility()` rather than adding a second check.

## What Phase 5 already provides

*Added 2026-09-09, when Phase 5 completed.*

- **The onboarding wizard already collects the answers**, in `OnboardingProgress.data` as JSON.
  Turning them into `StudentProfile` / `FacultyProfile` / `AlumniProfile` rows is yours —
  deliberately deferred so a half-finished wizard cannot produce a half-built profile.
- **`publicDirectory(collegeId)` in `queries/institution.ts` is the public people query.** Three
  gates, all of which must pass: a public profile, discoverable-in-directory, and a real membership
  rather than a guest's. The list is short by design.
- **`/p/[username]` still reads `src/content/`.** It swaps here, because this is the phase that
  makes profiles editable (ADR-030). Use `toContentProjectCard()` as the pattern for the adapter.
- **The roster page has role and suspension controls**, but no per-person detail page — that belongs
  with your profile work rather than being built twice. The bulk alumni transition
  (`transitionToAlumni`) is written and audited; it needs a multi-select to drive it.
- **Add every new scoped query to `institution.test.ts`**, which calls each one as the wrong
  college's administrator and asserts empty.

## Objective

Give every user an academic identity that is worth having: rich enough to be useful, private by
default, and — critically — **backed by evidence rather than self-declaration.**

## In scope

- Student, faculty, alumni, company and researcher profiles
- The public `/p/[username]` page, now database-backed
- Granular privacy controls, all defaulting to private
- The project-inferred skill graph (the inference, not yet the projects)
- The follow model
- Profile completeness and the generated avatar

## Out of scope

- Portfolio export (Phase 12) · Attestations (Phase 9) · Mentorship (Phase 13)

## Deliverables

*`[x]` delivered · `[~]` delivered differently or in part, with a note saying how*

### Profile editing — `/settings/profile`
- [~] Shared fields: display name, username, headline, bio, avatar, cover, links, location, pronouns
      — Everything except **avatar upload and cover**, which need Phase 7's signed file route. The
      generated avatar is wired and stable.
- [x] **Username rules:** 3–30 characters, lowercase, unique, immutable after 30 days, checked
      against a reserved blocklist (`admin`, `api`, `settings`, `p`, `explore`, …) so a username can
      never shadow a route
      — The test reads the **real route list off the filesystem**, so a route added later without a
      reservation fails rather than shipping. It found five on its first run.
- [x] Student: department, programme, year, roll number (private by default), interests, skills,
      education, achievements, availability for teams
- [x] Faculty: designation, department, subjects taught, expertise areas, qualifications,
      publications, research interests, mentorship availability, office hours
- [x] Alumni: graduation year, programme, current organisation and role, industry, mentorship
      availability
- [~] Company: name, logo, industry, size, website, description, focus areas, locations
      — The model and the public rendering exist; the editing form is Phase 13's, alongside the rest
      of the company surface.
- [~] Researcher: affiliation, field, ORCID, publications, collaboration interests
      — Written by the onboarding wizard and rendered publicly; the editing form follows with the
      collaboration work in Phase 14.
- [~] Autosave with a clear saved indicator; no lost work on navigation
      — **Six independent forms instead.** That solves what autosave was for — an error in one
      section cannot discard another — without a document that saves while you are still deciding.
- [x] Profile completeness meter with the specific next action, not just a percentage

### Privacy — `/settings/privacy`
- [~] Per-field visibility: `PUBLIC · COLLEGE · CONNECTIONS · PRIVATE`
      — Three levels: `PUBLIC · COLLEGE · PRIVATE`. **`CONNECTIONS` needs the follow graph to mean
      something**, and a settled answer to whether a follow is a connection; guessing now would bake
      in the wrong one.
- [x] **Everything defaults to the most private useful setting.** Public profile is opt-in.
- [x] Master toggles: discoverable in search · contactable by companies · appear in college
      directory · show in project credits · email digest
- [x] Plain-language explanation beside each control of exactly what it exposes and to whom
- [x] A live preview: "this is what a logged-out visitor sees" and "this is what a classmate sees"

### The public profile — `/p/[username]`
- [x] Database-backed, replacing the Phase 2 fixtures
- [~] Sections: header, about, skills with evidence, projects, achievements, activity, college
      — All except **activity**, which needs Phase 10's feed to have anything to show.
- [x] `Person` + `ProfilePage` JSON-LD, matching the visible content
- [x] Robots directives derived from privacy settings via `resolveVisibility()` — a private profile
      is `noindex` **and** absent from the sitemap
- [x] `data-nosnippet` on any contact detail
- [x] A private profile renders a dignified "this profile is private" page, not a 404 — and does not
      confirm whether the username exists
- [x] Generated OG image per profile

### The skill graph
- [x] `UserSkill` carries `source`: `SELF · PROJECT_INFERRED · ATTESTED`
- [x] `lib/skills/infer.ts` — derives skills from a user's projects: tech stack, domain, declared
      role in the project, and tasks completed
- [x] Inferred skills link to the evidence: "React — from 3 projects" with the projects named
- [x] Self-declared skills are visually distinct from inferred and attested ones
- [x] Recomputed on project completion, not on every page load
- [~] Skill detail: proficiency signal, source breakdown, and the projects that produced it
      — Every skill carries its evidence inline on the profile. A **dedicated page per skill** needs
      Phase 8's project pages to link into.

### Following
- [x] Polymorphic `Follow` over `USER · PROJECT · TOPIC · COLLEGE · GROUP`
- [~] Follow/unfollow with optimistic UI
      — `lib/follow.ts` is complete and verifies the target is both real *and* visible to the viewer.
      **The control belongs on Phase 10's feed and profile surfaces**; a button with nowhere to
      appear is not a deliverable.
- [x] Followers and following lists, respecting privacy
- [~] Follow counts denormalised on the profile row
      — Counted live by `followCounts()`. Denormalising is a Phase 10 decision, once the read volume
      is real — a cached counter that can drift is worse than a cheap query.
- [x] Suggested follows: classmates, faculty who teach you, projects in your interests — all
      deterministic and explainable

### Avatars
- [x] `generateAvatar(userId)` from Phase 1 wired as the default for every user
- [~] Upload replaces it: SVG or raster, cropped square, size-capped, served through the signed
      file route
      — **Phase 7 owns the signed file route.** Building half of an upload now would mean building it
      twice.
- [x] Faculty and verified accounts carry a verification mark in `Avatar`

## Acceptance criteria

1. A student completes a profile from empty to 100% without documentation.
2. Every privacy toggle is honoured on the public page — verified by fetching `/p/[username]`
   logged out and asserting the hidden fields are absent from the **HTML**, not merely hidden by CSS.
3. A private profile is `noindex` and absent from the sitemap.
4. A public profile renders fully with JavaScript disabled and passes the Rich Results Test.
5. Skills inferred from seeded projects appear with correct evidence links.
6. A username cannot be taken that would shadow an existing route.
7. Follow state updates optimistically and survives a reload.
8. The generated avatar is stable for a given user across reloads and processes.
9. `npm run check` clean.

## Key files this phase creates

```
src/app/(public)/p/[username]/page.tsx    The public profile — indexable, structured
src/app/(app)/settings/profile/page.tsx
src/app/(app)/settings/privacy/page.tsx
src/lib/db/queries/profile.ts
src/lib/skills/infer.ts                   Skills from evidence, not from claims
src/lib/follow.ts
src/config/reserved-usernames.ts
```

## Notes & risks

- **Hidden must mean absent from the HTML.** Rendering a private field and hiding it with CSS is a
  data leak that a crawler and a "view source" both defeat. Filter at the query, not at the view.
- **Do not confirm existence of a private profile.** The private-profile page must be identical for
  "exists but private" and "does not exist", or it becomes a username enumeration oracle.
- The skill graph is the feature that makes profiles credible. A self-declared skill list is a CV;
  a skill that says "from 3 projects" with the projects linked is evidence. Do not let the
  self-declared path dominate the UI.
- Recompute inferred skills on a project state change, not on render. It is a join-heavy query and
  it will show up on the profile page's LCP if it runs inline.
- Privacy defaults matter more than privacy features. A student who discovers their roll number was
  public will not forgive it, and the DPDP position is that consent must be specific and opt-in.
- Username immutability after 30 days protects the public URL, which is a real SEO and sharing
  asset. Say so on the form rather than just enforcing it.

---

## Phase Summary

**Status: complete, 2026-09-09.**

### What was built

| | |
| --- | --- |
| Pages swapped to the database | `/p/[username]` and its sitemap entries |
| New modules | `queries/profile.ts` · `skills/infer.ts` · `follow.ts` · `profile/actions.ts` · `config/reserved-usernames.ts` |
| Settings | `/settings/profile` (six independent forms) · `/settings/privacy` (with a live preview) |
| Tests | **276 total** (+35: privacy on the query, skill inference, username rules) |
| Browser and wire checks | **`check:privacy` 11/11** · `check:auth` 12/12 · `check:admin` 15/15 |
| Reserved usernames | 100+, asserted against the **real route list** rather than against itself |

### Key decisions made

- **ADR-033 — privacy is enforced by not querying, not by not rendering.** An unentitled field is
  never read from the database, so no future page edit can surface it. Separate queries rather than
  conditional spreads, partly because Prisma cannot infer a conditionally-spread `select` and the
  first version compiled to the *full* model type.
- **ADR-034 — a private profile is indistinguishable from one that does not exist.** Same page, same
  title, same `noindex`, same status. Anything else is a username enumeration oracle on a platform
  whose accounts are students at a named institution.
- **ADR-035 — inferred skills come from projects, and the difference is shown.** Drafts do not count,
  stack noise is dropped, strength means "how much evidence" and never "how good", and a claim the
  projects corroborate is promoted rather than shown twice.
- **The username is changeable for thirty days, then fixed.** Both halves matter: locking it
  immediately makes a signup typo permanent, never locking it makes every link to a profile
  provisional.
- **Normalisation is separate from validation.** `normaliseUsername()` folds, `checkUsername()`
  validates what will actually be stored — see the deviation note below for why.

### What the tests found

Three real defects, each caught rather than reasoned about:

1. **Five routes were unreservable.** `for-students`, `for-faculty`, `for-colleges`, `for-companies`
   and `for-alumni` were missing from the blocklist. The test reads the route list off the
   filesystem rather than asserting against the reserved set, so it found them — and will find the
   next one a later phase adds without a reservation.
2. **`checkUsername("Ananya")` passed.** It lowercased its own input, so an *unnormalised* string
   could reach the database and collide case-insensitively with an existing `ananya` while passing a
   case-sensitive uniqueness check. Normalisation is now a separate function and validation checks
   the exact string.
3. **A test of mine was wrong and the code was right.** The indexability test looked for "a public
   profile at an unverified college" and found `arjun-rao` — who is *also* a member of two verified
   colleges and is therefore legitimately indexable. It now constructs the condition instead of
   hoping the seed contains it, and a second test asserts the inverse.

And one thing that looked like a leak and was not: the private-profile and unknown-username
responses differ by ~1.2 KB. Requesting the **same** URL twice differs by as much — Next streams
metadata and its position varies per request. `check:privacy` compares rendered content and
deliberately does not compare byte counts, with a comment so nobody re-adds that assertion.

### Deviations from the spec above, and why

1. **No avatar upload.** The generated avatar is wired and stable; replacing it needs the signed file
   route, which is Phase 7's storage work. Building half of it now would mean building it twice.
2. **No cover image.** Same reason.
3. **No autosave.** Each section saves independently, which solves the problem autosave was there to
   solve — a validation error in one form does not discard another — without the ambiguity of a
   document that saves itself while you are still deciding.
4. **Per-field visibility is three levels, not four.** `PUBLIC · COLLEGE · PRIVATE`. `CONNECTIONS`
   needs the follow graph to mean something and a settled answer to "is a follow a connection";
   guessing now would bake in the wrong one.
5. **Follow has no UI.** `lib/follow.ts` is complete and tested at the query level — toggling,
   counts, follower lists that respect privacy, and explainable suggestions. The button belongs on
   the feed and profile surfaces Phase 10 builds, and an optimistic control with nowhere to appear
   is not a deliverable.
6. **The skill detail page is not built.** Every skill carries its evidence — the projects, by name,
   with the reason — on the profile itself. A dedicated page per skill needs Phase 8's project pages
   to link into.
7. **`/p/[username]` is now dynamic rather than prerendered.** Reading the session is what lets a
   classmate see a college-visible profile the public cannot, and `cookies()` forces dynamic
   rendering. SSR still returns complete HTML, `check:seo` still passes 127/127, and the alternative
   — a static public shell plus client-side hydration for members — would have traded a correctness
   guarantee for a caching one.

### Anything the next phase must know

- **`getProfile()` is the only way to read a profile.** It decides visibility before selecting, and
  returns null for private-or-absent. Do not add a query that reads profile fields directly.
- **`recomputeSkills(userId)` must be called when a project changes state** — Phase 8 owns those
  transitions. It is deliberately never called on render.
- **`mergeSkills()` never promotes a claim by itself.** Only project evidence promotes, and only an
  attestation outranks evidence. Phase 9 issues attestations; nothing else may write `ATTESTED`.
- **`lib/follow.ts` is ready for a UI.** `toggleFollow` verifies the target is both real *and*
  visible to the viewer, so following cannot be used to discover private work.
- **`checkUsername()` expects a normalised string.** Call `normaliseUsername()` first, always.
- **Add every new route to `RESERVED_USERNAMES`** — or the test will remind you.

### Verified by

| Check | Result |
| --- | --- |
| `npm run check` | Clean — typecheck (both tsconfigs), 0 lint errors, 0 warnings, Prettier clean, **276 tests**, 94 contrast pairs |
| `npm run build` | Clean |
| **`npm run check:seo`** | **127 pages, 0 violations — unchanged by the profile swap** |
| **`npm run check:privacy`** | **11/11 on the wire** — email and roll number absent from the HTML a stranger receives; private and unknown usernames indistinguishable; both `noindex`; private absent from the sitemap; going private takes effect on the next request |
| `npm run check:auth` / `check:admin` | 12/12 · 15/15 |
| `npm run db:verify` | 26/26 |
| Username shadowing | Every top-level route read off the filesystem is reserved (acceptance criterion 6) |
| Skill evidence | Inference run over the real seeded corpus: drafts excluded, noise dropped, two roles on one project infer different skills, ordering stable across calls |
