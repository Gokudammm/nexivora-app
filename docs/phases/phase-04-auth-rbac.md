# Phase 4 — Authentication, Roles & RBAC

| | |
| --- | --- |
| **Status** | ✅ Complete |
| **Depends on** | Phase 3 ✅ complete 2026-09-09 |
| **Blocks** | Phases 5–15 |
| **Estimate** | 7 focused hours |
| **Started** | 2026-09-09 |
| **Completed** | 2026-09-09 |

## What Phase 3 already provides

*Added 2026-09-09, when Phase 3 completed. Check these before building — the most common way to
waste a phase is to rebuild something the previous one shipped.*

- **The models exist**: `User`, `Account`, `Session`, `VerificationToken`, `Membership`,
  `PrivacySetting`, `ConsentRecord`, `AuditLog`. `Account` is already Auth.js-shaped, so
  adding OAuth in a later phase needs no migration.
- **Seeded passwords are scrypt** (`node:crypto`, no dependency), stored as `scrypt$N$salt$hash`.
  Every seeded account uses **`nexivora-demo`**. Either verify this scheme or re-seed — do not add
  bcrypt and leave 87 accounts unable to sign in.
- **`Viewer` already exists** in `src/lib/db/queries/viewer.ts` and is the contract every query
  takes first. Phase 4's job is to produce one from the session. `loadViewer()` is written but
  returns an empty `groupIds` — completing it is a Phase 4 deliverable.
- **Roles are per-membership, never global.** `Membership.role` plus `Membership.state`
  (`INVITED · ACTIVE · SUSPENDED · ALUMNI · GUEST`). A user can hold different roles at different
  colleges, so RBAC must resolve against a college, not against the user.
- **`GUEST` memberships exist and are load-bearing** (ADR-022). They must not grant college-wide
  access — only the groups the guest was added to.
- **`AuditLog` is append-only** and already modelled. Every administrative action writes one.

## Objective

Every user can get in, and nobody can see anything they should not. This phase builds the
authorisation layer that **every subsequent phase depends on**, so it is worth over-building
slightly: a permission bug found in Phase 12 is a rewrite of six phases.

Reference: `docs/ROLES-PERMISSIONS.md`, `docs/SECURITY.md` §1–2.

## In scope

- Registration, login, logout, email verification, password reset
- The seven roles and per-membership role resolution
- `lib/authz/policy.ts` — the permission matrix, implemented once
- Proxy (`src/proxy.ts`) route gating and data-layer enforcement
- Per-role onboarding wizards
- Account, security and session settings

## Out of scope

- Google OAuth (deferred to Phase 16, ADR-004) · 2FA (Phase 16) · Institution management (Phase 5)

## Deliverables

*`[x]` delivered · `[~]` delivered differently or in part, with a note saying how*

### Authentication
- [x] Auth.js v5 configured, credentials provider, JWT sessions
      — **Superseded (ADR-027).** Database-backed sessions instead: Auth.js v5 is still a beta and its Credentials provider cannot use database sessions, which two acceptance criteria here require.
- [x] JWT carries `userId`, `memberships[]` (college, role, state) — enough to authorise without a
      database round-trip on every request
      — `Viewer` carries `userId`, `memberships[]`, groups, taught and enrolled classes. `membershipVersion()` exists for a future JWT fast path.
- [x] bcrypt cost 12; password policy: 10+ characters, checked against a common-password list
      — **scrypt at OWASP parameters instead (ADR-026)**, with upgrade-on-sign-in. Policy: 10+ characters against a common-password list.
- [x] `/register` role chooser → `/register/[role]` with role-specific fields
- [x] **Institutional email domain verification** — a registrant on a college's declared domain is
      auto-associated with that college as `INVITED`
- [x] Email verification required before any content can be created
- [x] `/login` with the identical-response rule for unknown accounts
      — Plus a decoy hash, so a missing account does not answer measurably faster than a wrong password.
- [x] `/forgot-password` → `/reset-password/[token]`; single-use, 30-minute expiry, hashed at rest
- [x] Nodemailer with the console transport in dev; templates for verify, reset, invite, digest
      — Console transport with five templates. **No Nodemailer** — SMTP lands in Phase 17 with the domain and SPF/DKIM; sending fails loudly until then rather than dropping mail silently.
- [x] Rate limiting: 5 login attempts / 15 min per IP+email, lockout at 10 with a notification email
- [x] Session invalidation on password change
- [x] `/settings/security` — active sessions with per-device revoke, password change

### Authorisation — the core of this phase
- [x] `lib/authz/policy.ts` — `can(viewer, action, resource)`, the **only** place a permission is
      decided
- [x] `Action` as a string-literal union covering every action in `docs/ROLES-PERMISSIONS.md`
      — 41 actions.
- [x] `Viewer` type built once from the session
- [~] `resolveVisibility()` — the most-restrictive-wins computation over resource, group, college,
      embargo and privacy settings
      — Project visibility, embargo and the college-verification gate are implemented and tested; group and per-field privacy folding lands with the models that need it in Phases 6–7.
- [x] `lib/auth/guards.ts` — `requireAuth()`, `requireRole()`, `requireMembership()`
      — `requireAuth`, `requireVerified`, `requireRoleAt`, `requirePermission`, `canRead`, `requireApiAuth`.
- [~] **`src/proxy.ts`** — route gating by role, with a correct post-login redirect back to the
      intended destination. **Next 16 renamed Middleware to Proxy** (ADR-014): the file is
      `proxy.ts`, the export is `proxy`, and the behaviour is unchanged. Do not write
      `middleware.ts` — it is silently ignored.
      — Built, with the return path. Gating is by **authentication**, not by role: role gating
      belongs at the data layer (ADR-028), and the proxy may run at a CDN edge with no database.
- [x] **The query-layer convention established and documented:** every scoped query takes `viewer`
      first, a denied read returns `null`, a denied write throws
- [x] Cross-college isolation implemented as a predicate applied inside the query helpers

### Testing — non-negotiable in this phase
- [~] Vitest installed
      — **Not installed.** Node's built-in runner instead (ADR-024, Phase 3) — the spec predates it.
- [x] **The full permission matrix as a table-driven test**: every role × every action × every
      scope, asserted against `docs/ROLES-PERMISSIONS.md`
      — 100 rows, plus a cross-college sweep that is exhaustive over the action union.
- [x] Cross-college denial test: as a member of college B, attempt every scoped query against
      college A's seeded data and assert empty
      — Run against the seeded database with the proxy out of the picture, with a positive control.
- [~] `resolveVisibility()` tested against every combination of resource visibility, group
      visibility and embargo
      — Resource visibility and the college gate are covered by the agreement test; group visibility follows in Phase 7.
- [x] Password reset token: single-use and expiry both tested
      — Including concurrent double-use.

### Onboarding
- [x] `/onboarding/[step]` — a wizard per role, resumable, with progress persisted
      — **`/onboarding`, one route.** The step lives in the database so the wizard resumes on another device; a URL per step would be a second source of truth.
- [~] Student: college → department → programme → year → interests → skills → avatar
      — Steps collect answers into `OnboardingProgress.data`; **writing profile rows lands in Phase 6** with the profile models. Avatar upload is Phase 7 (storage).
- [~] Faculty: college → department → subjects → expertise → profile
      — As above.
- [~] College Admin: college details → domains → verification request
      — As above.
- [~] Alumni: college → graduation year → current role → mentorship availability
      — As above.
- [~] Company: company details → verification request → focus areas
      — As above.
- [~] Researcher: affiliation → field → interests
      — As above.
- [~] Onboarding completion unlocks the dashboard; an incomplete profile is redirected back
      — Redirect works. Every step is skippable on purpose — onboarding that cannot be skipped gets filled with nonsense.

### Dashboards & settings
- [x] `/dashboard` — routes to the correct role dashboard
      — **One dashboard composed from the viewer's memberships**, because a person can hold several roles.
- [~] A placeholder dashboard per role using `AppShell` (real content in later phases)
      — One dashboard, composed from memberships.
- [~] `/settings/account` — email, password, language, timezone, delete account (stub, real in 16)
      — Account details, colleges and sign-out. Language/timezone editing and deletion are Phase 16.
- [x] The user menu in `AppShell` wired: profile, settings, theme, sign out

## Acceptance criteria

1. Every one of the seven roles can register, verify, onboard and reach its own dashboard.
2. The permission matrix test passes for every role × action × scope combination.
3. **A member of college B receives `null` from every scoped query against college A's data**, with
   the proxy disabled — proving the data layer is a real boundary, not a decoration.
4. A student attempting `/faculty` is redirected, not shown a broken page.
5. A denied read returns `null`/404; a denied write throws a handled error with a clear message.
6. A password reset token cannot be used twice and expires after 30 minutes.
7. Changing a password signs out every other session.
8. Six failed logins within 15 minutes are rate-limited.
9. An unverified user can browse but cannot create anything.
10. `npm run check` and the unit suite are clean.

## Key files this phase creates

```
src/lib/authz/policy.ts        can() — the single source of authorisation truth
src/lib/auth/config.ts         Auth.js configuration
src/lib/auth/guards.ts         requireAuth / requireRole / requireMembership
src/lib/seo/visibility.ts      resolveVisibility() — extended from Phase 2
src/proxy.ts                   Route gating (Next 16: Middleware is now Proxy)
src/app/(auth)/*               8 auth routes
src/app/(app)/onboarding/*     7 role wizards
tests/unit/policy.test.ts      The permission matrix — the most valuable test in the project
```

## Notes & risks

- **This is the phase to be slow and thorough in.** Every later phase calls `can()`. A permission
  model that is wrong here is wrong in eighteen places later, and permission bugs are the kind that
  ship silently.
- **Test the data layer with the proxy disabled.** A passing proxy check is not evidence the query
  is safe, and the query is what actually protects the data.
- **Roles are per-membership, not global.** Resist the shortcut of a single `user.role` column — the
  alumni transition and the multi-college case both break under it, and unwinding that later touches
  everything.
- The identical-response rule on login and password reset matters: a different message for an
  unknown email is an account-enumeration oracle.
- Email in development is the console transport. Print the verification link to the terminal so the
  flow is testable without an SMTP server.
- Do not add Google OAuth here. Allowing any Gmail account in undermines the institutional trust
  gate, which is what makes the whole network credible (ADR-004).
- The JWT carries memberships to avoid a database hit per request — which means **a membership
  change must force a token refresh.** Handle it now; discovering it in Phase 5 when an admin
  changes a role and nothing happens is a confusing bug.

---

## Phase Summary

**Status: complete, 2026-09-09.**

### What was built

| | |
| --- | --- |
| Permission actions | **41**, one union, one implementation |
| Matrix assertions | **100** role × action × scope rows, plus an exhaustive cross-college sweep |
| Unit + integration tests | **199**, all passing |
| End-to-end browser checks | **12**, all passing |
| New models | `LoginAttempt`, `OnboardingProgress` (migration `auth_login_attempts_onboarding`) |
| Routes | 8 auth · dashboard · onboarding · 2 settings |

The layer everything after this depends on: `can()`, `Viewer`, `visibleTo()`, sessions, and the
flows that get a person in.

### Key decisions made

- **ADR-026 — scrypt, not bcrypt.** The spec said bcrypt; Phase 3 had already seeded 87 accounts
  with scrypt. scrypt is memory-hard where bcrypt is not, ships with Node, and OWASP accepts it.
  Parameters are stored *inside* the hash and upgraded on sign-in — verified working: the seeded
  hash moved from `N=2¹⁴` to `N=2¹⁷` on first login.
- **ADR-027 — a purpose-built session layer, not Auth.js.** Two checked facts: Auth.js v5 is still
  `5.0.0-beta.32`, and **its Credentials provider cannot use database sessions**. That makes two of
  this phase's own acceptance criteria — per-device revoke, and sign-out-everywhere on password
  change — impossible with it, because a JWT cannot be withdrawn.
- **ADR-028 — the query is the boundary; the proxy is a convenience.** Tested with the proxy out of
  the picture entirely.
- **ADR-029 — there is no `viewer.role`.** Roles are per membership, faculty scope is per subject.

### The permission matrix — what the test actually asserts

100 rows, each written to be read against `docs/ROLES-PERMISSIONS.md`. The ones worth naming,
because each encodes a product decision rather than a convention:

| Assertion | Why it is there |
| --- | --- |
| Faculty can comment on a project but **cannot edit** it | A supervisor who can silently rewrite a group's work destroys the evidentiary value of the ledger |
| Faculty can upload files but **cannot delete** them | Deletion by a supervisor is indistinguishable from tampering after the fact |
| A college admin **cannot read a workspace** | An administrator sees reports, not the room |
| A college admin **cannot grade** | An academic judgement belongs to the supervising faculty member |
| **Even a platform admin cannot grade**, or submit a peer review | The second would be a fabricated review |
| A member **cannot read individual peer reviews** about themselves | ADR-008; honest review is impossible without the asymmetry |
| A college admin **cannot grant their own college's verification** | A college that verifies itself is not a trust gate |
| An **unverified company cannot post an opportunity** | Fake internships charging a "certificate fee" are a real scam aimed at these students |
| A company **cannot contact a student who has not opted in** | The difference between a talent platform and a spam channel |
| A **suspended** member reads everything and writes nothing | |
| An **unverified email** browses and creates nothing | Acceptance criterion 9 |
| A **guest** sees their own group and gains no college-wide reach | ADR-022 |
| An **alumnus keeps reading work they are credited on** | Losing your own work on graduation would be the worst possible bug |
| `project:fork` is scoped to the **source** as a read | Gating it on the source college would make cross-college lineage impossible |

Two structural assertions matter more than any individual row:

- **The cross-college sweep is exhaustive over the action union**, not a sample — so an action added
  later is covered whether or not anyone remembers to add a row. The single permitted exception is
  reading and forking genuinely public work.
- **`visibleTo()` and `can('project:read')` are asserted to agree** on every seeded project for
  every viewer. They are written separately, one in SQL and one in TypeScript, and nothing else
  would stop them drifting.

And a positive control: a student *can* read their own group's workspace. Without it, a policy that
denied everything would pass every denial assertion in the file.

### Deviations from the spec above, and why

1. **scrypt rather than bcrypt** (ADR-026).
2. **A purpose-built session layer rather than Auth.js** (ADR-027).
3. **Node's test runner rather than Vitest**, per ADR-024 from Phase 3. The spec predates it.
4. **`/onboarding` is one route, not `/onboarding/[step]`.** The step lives in the database so the
   wizard resumes on another device; a URL per step would be a second source of truth for where
   somebody is, and the two would disagree the first time anyone used the back button.
5. **`/dashboard` is one route, not one per role.** A person can hold several roles, so a per-role
   URL would force them to pick an identity before seeing anything.
6. **Per-role dashboards are placeholders**, as the spec intended — the real panels are Phases 6–12.
   The onboarding wizard collects answers but does **not yet write profile rows**; that lands with
   the profile models in Phase 6, and until then a half-finished wizard cannot produce a half-built
   profile.
7. **Account deletion is described, not implemented** — Phase 16 owns the data controls.

### Anything the next phase must know

- **Every query takes `viewer` first, always** — including for the logged-out public, where
  `ANONYMOUS` is a real viewer rather than a null. A query without a viewer parameter is a leak
  waiting to happen.
- **A denied read returns `null`; a denied write throws `ForbiddenError`.** Never a 403 on a read:
  it confirms the resource exists.
- **`can()` is the only place a permission is decided.** If you are writing `if (role === …)` in a
  route handler, the permission belongs in `policy.ts` instead.
- **Faculty scope is per subject, not per college**, and it resolves Project → Group → Class →
  Subject. `projectResource()` in `queries/projects.ts` builds the shape `can()` expects; use it
  rather than assembling one by hand.
- **Adding a scoped query means adding a row to the agreement test**, or the SQL and the policy can
  drift without anything failing.
- **`membershipVersion()` exists but is not yet wired.** Sessions are database-backed so a
  membership change takes effect on the next request anyway; the helper is there for when Phase 16
  adds a JWT fast path.
- The onboarding answers sit in `OnboardingProgress.data` as JSON, waiting for Phase 6 to turn them
  into profile rows.

### Verified by

| Check | Result |
| --- | --- |
| `npm run check` | Clean — typecheck (both tsconfigs), 0 lint errors, 0 warnings, Prettier clean, **199 tests**, 94 contrast pairs |
| `npm run build` | Clean |
| `npm run db:verify` | 26 / 26 (unchanged by this phase) |
| **Permission matrix** | 100 rows + exhaustive cross-college sweep, all passing |
| **Cross-college isolation, proxy disabled** | No non-public work crosses a college boundary; the inverse control confirms members *do* see their own |
| **`visibleTo()` ≡ `can('project:read')`** | Agree on every seeded project, for anonymous / outsider / member |
| **Unverified college never reaches the public** | Greenfield's work absent from the anonymous list |
| Token single-use | Sequential **and concurrent** double-use both refused |
| Token expiry | Expired, wrong-purpose and superseded tokens all refused |
| Password upgrade | Seeded `N=2¹⁴` hash rehashed to `N=2¹⁷` on first sign-in, confirmed in the database |
| `npm run check:auth` | **12 / 12** in a real browser — gating with return-path, identical failure message, httpOnly + SameSite=Lax cookie invisible to JavaScript, sign-in landing on the intended destination, device list, sign-out revoking server-side |
