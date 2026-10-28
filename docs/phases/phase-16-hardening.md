# Phase 16 — Performance, Accessibility, Security & Trust Hardening

| | |
| --- | --- |
| **Status** | ⬜ Not Started |
| **Depends on** | Phases 0–15 |
| **Blocks** | Phase 17 |
| **Estimate** | 8 focused hours |
| **Started** | — |
| **Completed** | — |

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
- **Google OAuth belongs here** (ADR-004). `Account` is already Auth.js-shaped, so adopting
  Auth.js for OAuth needs no migration — and by then v5 may be stable. Read ADR-027 first: its
  Credentials provider cannot do database sessions, so the session layer stays regardless.
- **Left for this phase deliberately:** 2FA, account deletion (the account page describes the
  behaviour already), and a k-anonymity check against Have I Been Pwned to replace the small
  in-repo common-password list.
- **`RATE_LIMIT_ENABLED` must be `true` in production.** It is off in development so local
  iteration is not throttled, which means the limiter is only exercised when someone turns it on.
- **`LoginAttempt` rows are pruned after 24 hours** — they are tied to an identifier and are
  personal data. Confirm the prune actually runs under production traffic.

## Objective

Make the product safe to put real students on. Everything here has been designed for since Phase 4,
so this phase should be **verification and closing gaps**, not rescue. If it feels like rescue,
that is information worth recording in the summary.

References: `docs/PERFORMANCE.md`, `docs/SECURITY.md`.

## In scope

Performance measurement and fixes · the full accessibility pass · security verification ·
moderation and reporting · rate limiting · DPDP data export and deletion · the PWA · audit review.

## Deliverables

### Performance
- [ ] `@next/bundle-analyzer` run; every route measured against the budget
- [ ] Any route over budget fixed or explicitly justified in writing
- [ ] Confirm heavy dependencies are dynamically imported and absent from the shared bundle
- [ ] Lighthouse CI on the key templates: home, explore, project, profile, feed, workspace,
      faculty dashboard
- [ ] **Real measurement, not assertion** — record the actual numbers
- [ ] Prisma query logging on: assert a per-route query ceiling; fix every N+1 found
- [ ] Verify the composite indexes from `docs/PERFORMANCE.md` are present and used (`EXPLAIN`)
- [ ] Virtualise the feed and any list past 50 items
- [ ] `web-vitals` beacon → `/api/vitals` for real field data from Phase 17 onward
- [ ] Verify the caching and revalidation strategy behaves as documented

### Accessibility
- [ ] axe via Playwright on every key route; zero violations
- [ ] Full keyboard pass: every flow completable without a mouse, including the task board
- [ ] Screen reader pass (NVDA on Windows) on: registration, workspace, project editor, feed,
      evaluation
- [ ] Focus management in dialogs, sheets, the command palette and route changes
- [ ] `aria-live` on every async result: toasts, form errors, feed updates, notifications
- [ ] Verify contrast still passes in both themes (the Phase 1 script, re-run)
- [ ] 200% zoom with no horizontal scroll or clipping
- [ ] `prefers-reduced-motion` and `prefers-contrast` honoured everywhere
- [ ] Touch targets 44×44 minimum
- [ ] Every chart has a table fallback; every SVG graph has a text equivalent
- [ ] `/legal/accessibility` updated to state what actually conforms — **honestly.** A false
      conformance claim is worse than an honest partial one.

### Security verification
Work `docs/SECURITY.md` §10 as a checklist. Every item verified, not assumed.
- [ ] Headers and CSP verified with `curl -I` against a running instance
- [ ] CSP has no `unsafe-inline` script and no `unsafe-eval`
- [ ] IDOR attempted on file, task, comment, notification, evaluation and attestation ids
- [ ] Cross-college denial re-verified across every route added since Phase 4
- [ ] Upload rejects: wrong magic bytes, oversize, double extension, an SVG containing `<script>`
- [ ] A file URL from one group returns 404 to another group's member
- [ ] Rate limits verified by script for every surface in `docs/SECURITY.md` §6
- [ ] Rate limiting moved to the Postgres-backed store so it survives a restart
- [ ] CSRF: every non-idempotent route handler verifies origin
- [ ] Rich text sanitisation tested with a payload list
- [ ] `gitleaks` over the **full history**, not just HEAD
- [ ] `npm audit` — no high or critical
- [ ] 2FA (TOTP) for `COLLEGE_ADMIN` and `PLATFORM_ADMIN`
- [ ] Google OAuth added as an additional sign-in method (deferred here from Phase 4, ADR-004) —
      **only for accounts already associated with a verified college**

### Moderation & trust
- [ ] Report on every user-generated surface: post, comment, project, profile, idea, opportunity,
      message, file
- [ ] Report reasons: spam · harassment · plagiarism · inappropriate · misinformation ·
      impersonation · other
- [ ] Moderation queues scoped correctly: faculty (their subjects), college admin (their college),
      platform admin (everything)
- [ ] Actions: dismiss · warn · hide · remove · suspend · escalate — each with a required reason
- [ ] Block and mute at the user level
- [ ] Every moderation action in the audit log
- [ ] Automated signals: rapid-fire posting, duplicate content, mass identical requests, new
      accounts posting links
- [ ] `/legal/community-guidelines` finalised and linked from every report dialog

### Privacy & DPDP
- [ ] `/settings/data` — **data export**: everything about the user as JSON plus their files,
      generated on demand, delivered as a download when ready
- [ ] **Account deletion** implementing exactly the model in `docs/SECURITY.md` §7: solely-authored
      content hard-deleted, shared content anonymised, identity hard-deleted, academic records
      pseudonymised
- [ ] **The deletion screen states plainly what will and will not be removed, before confirming.**
      Promising total erasure and not delivering it is worse than explaining the limit.
- [ ] A 7-day grace period with a cancel link
- [ ] Consent records: what was consented to, when, and its version
- [ ] **Read the privacy policy against the schema, line by line.** Correct whichever is wrong.
      This is the check people skip and the one that matters.

### PWA
- [ ] Service worker: cache the shell, static assets and visited public pages
- [ ] `/offline` page with useful cached content, not a dead end
- [ ] Installable: manifest complete, icons correct, install prompt handled
- [ ] Offline read access to cached project pages and the user's own workspace data
- [ ] Cache invalidation on deploy — a stale service worker serving an old build is the classic PWA
      failure

### Error handling & resilience
- [ ] Every route has an error boundary with a useful message and a real recovery action
- [ ] Loading skeletons everywhere a spinner crept in
- [ ] Graceful degradation when SSE, email or storage is unavailable
- [ ] Structured logging with a request id and a redaction list
- [ ] `/api/health` checking process, database and disk

## Acceptance criteria

1. Lighthouse mobile on public templates: Performance 95+, Accessibility 95+, Best Practices 100,
   SEO 100 — **measured and recorded, with the actual numbers in the summary.**
2. Zero axe violations on every key route.
3. Every flow completable by keyboard alone.
4. Every item in `docs/SECURITY.md` §10 verified and ticked.
5. A data export produces a complete, readable archive of everything about the user.
6. Account deletion behaves exactly as documented, verified row by row in the database.
7. The privacy policy matches the code.
8. A report reaches the correct queue and every moderation action is audited.
9. The app is installable and the offline page works.
10. No route exceeds its JS budget without a written justification.

## Notes & risks

- **Measure, do not assert.** If Chrome automation is unavailable in this environment, say so and
  record no score rather than claiming one. A fabricated Lighthouse number is worse than an honest
  gap, and it will be discovered at exactly the wrong moment.
- **Deletion is genuinely hard and the honest answer is the right one.** Read §7 of the security doc
  again before implementing. A student's project work is a shared record; unilaterally deleting it
  would destroy other people's records and break lineage. Explain that on the screen.
- **The privacy-policy-versus-schema read is the highest-value hour in this phase.** Policies drift
  from code silently, and the gap is only ever discovered by someone who is already unhappy.
- The service worker is the most likely source of a confusing production bug. Version the cache,
  invalidate on deploy, and test an upgrade path, not just a first install.
- Moderation queues need to be scoped correctly or a faculty member sees reports from a department
  they have nothing to do with, and stops looking at the queue entirely.
- If this phase turns into rescue rather than verification, **record which phase let the standard
  slip** in the summary. That is the most useful thing this document can capture.

---

## Phase Summary

*Fill this in when the phase is complete.*

**What was built and fixed.**

**Measured results.** *(actual Lighthouse and Web Vitals numbers, or an honest note that no
measurement was possible)*

**Security findings and their fixes.**

**Accessibility findings and their fixes.**

**Deviations from the spec above, and why.**

**Anything the next phase must know.**

**Verified by.**

| Check | Result |
| --- | --- |
| | |
