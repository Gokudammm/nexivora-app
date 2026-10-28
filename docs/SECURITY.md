# Security

**Phase 4 (2026-09-09) implemented §1–2.** Passwords are scrypt at OWASP parameters with the cost
stored inside the hash and upgraded on sign-in (ADR-026); sessions are opaque tokens in an httpOnly
cookie, hashed at rest, revocable per device (ADR-027); reset and verification tokens are hashed,
single-use and short-lived; and login is rate-limited per IP **and** identifier together. Auth
responses never reveal whether an account exists., Privacy & Trust

Phase 16 owns the hardening pass and this checklist. Everything here is designed for from Phase 4
onward, not retrofitted.

**The framing that matters:** Nexivora holds student data — names, colleges, coursework, grades,
peer reviews. A breach here is not an inconvenience, it is a career and a reputation. Design as if
that is true, because it is.

---

## 1. Authentication

- **Auth.js v5, credentials provider, JWT sessions.** Free, self-hosted, no per-MAU cost.
- Passwords hashed with **bcrypt, cost 12** (or argon2id if the native build is clean on the
  target). Never MD5, never SHA, never a hand-rolled scheme.
- Password policy: minimum 10 characters, checked against a common-password list. No composition
  rules — length beats symbol soup, and NIST agrees.
- **Email verification required** before any content can be created. An unverified account can log
  in and see, but not post, join or submit.
- **Institutional email domain verification** — a college declares its email domains; a registrant
  on that domain is auto-associated with the college as `INVITED`, and a college admin activates
  them. This is the primary trust gate and it is why fake student accounts are hard.
- Password reset tokens: single-use, 30-minute expiry, hashed at rest, invalidated on use and on
  password change. The reset endpoint responds identically for known and unknown emails.
- **Rate limits:** 5 login attempts per 15 minutes per IP+email, exponential backoff, account lock
  after 10 with an email notification. 3 password-reset requests per hour per email.
- Session invalidation on password change, and an active-session list with per-device revoke in
  `/settings/security`.
- 2FA (TOTP) for `COLLEGE_ADMIN` and `PLATFORM_ADMIN` — deferred to Phase 16, but the roles that
  need it are identified now.

## 2. Authorisation

The full matrix is in `docs/ROLES-PERMISSIONS.md`. The security-relevant properties:

- **Defence in depth, deliberately redundant:** middleware gates the route, the query gates the
  data, and integration tests assert the query gate independently of the middleware.
- **A denied read returns `null`, not 403** — a 403 confirms existence and leaks private projects.
- **Every scoped query takes `viewer` as its first argument.** A query function without it is a
  review failure, and this is grep-able.
- **IDOR is the top risk in a product like this.** Every id in a URL is checked against the viewer,
  including file ids, task ids, comment ids and notification ids. Ids are `cuid2`, so they cannot
  be enumerated, but that is a mitigation and not the control.
- Cross-college isolation is tested explicitly: Phase 4 ships a test that attempts every scoped
  query as a member of a different college and asserts empty results.

## 3. Input handling

- **Every mutation validates with Zod on the server**, independently of any client validation.
  The same schema is imported by the form, so they cannot drift.
- Prisma parameterises everything; the only raw SQL is the full-text search path, and it uses
  parameter binding, never string interpolation. This is called out because it is the one place a
  mistake would be exploitable.
- **There is no HTML path for user content, so there is no sanitiser** (**ADR-036**, superseding
  what this section said until Phase 7). Project sections, thread bodies, replies and task comments
  are stored as **plain text** and rendered through `components/content/rich-text.tsx`, which parses
  a small markdown grammar and emits **React elements**. It never calls `dangerouslySetInnerHTML`,
  so markup injection is not mitigated here — it is not representable.

  This is deliberately *stronger* than the sanitiser it replaces. A sanitiser is a filter that has
  to stay correct against every new bypass; a renderer that cannot emit raw HTML has nothing to
  bypass. `dangerouslySetInnerHTML` appears nowhere in the codebase, and adding it anywhere
  reintroduces a threat class that is currently absent.
- **User-uploaded SVG is never inlined.** SVG is markup and can carry script. Uploads are served
  only through `GET /api/files/[id]`, which sets `Content-Security-Policy: sandbox; default-src
  'none'` and `Content-Disposition: attachment` — SVG is deliberately excluded from the previewable
  set, so it downloads rather than rendering. Our own illustration SVGs are source code and are fine.
- Markdown renders with raw HTML disabled, which for the renderer above means "there is no code path
  that would accept it".

## 4. File uploads

The workspace is a file-sharing surface, which makes this the highest-risk subsystem.

- Allow-list of extensions **and** verified magic bytes — never trust the extension or the
  client-supplied MIME type.
- Size caps: 25 MB per file, 2 GB per group, configurable per college.
- Files are stored **outside the web root** with generated names, and served **only** through
  `GET /api/files/[id]`, which resolves the file, checks `can(viewer, 'file:read', file)` and
  streams it. There is no static path to a user file.
- `Content-Disposition: attachment` for everything that is not an image or PDF preview, plus
  `X-Content-Type-Options: nosniff`.
- Uploads land in a quarantine state; a ClamAV scan boundary exists as an interface with a
  pass-through driver in development (honest: we do not run a scanner locally, and we say so).
- Filenames are sanitised and the original is stored as metadata, never used as a path.
- Signed URLs expire in 15 minutes and are bound to the requesting session.

## 5. Web security headers

Set in `next.config.ts` and enforced at Nginx:

| Header | Value |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'`; no `unsafe-eval`; `script-src 'self' 'nonce-…'`; `img-src 'self' data: blob:`; `frame-ancestors 'none'` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | camera, microphone, geolocation, payment all `()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |

CSRF: Next.js server actions carry origin checks; every non-idempotent route handler additionally
verifies `Origin`/`Sec-Fetch-Site`. Cookies are `HttpOnly`, `Secure`, `SameSite=Lax`.

## 6. Rate limiting & abuse

| Surface | Limit |
| --- | --- |
| Login / register / reset | Section 1 |
| Post, comment, message | 30 per hour per user, burst 5 |
| File upload | 20 per hour per user |
| Search | 60 per minute per user |
| Collaboration / mentorship request | 20 per day per user |
| Invitation send | 200 per day per college admin |
| Public API surfaces (`/api/search`, OG) | 100 per minute per IP |

In-process token bucket keyed by user or IP, backed by a Postgres table so it survives a restart
and works if a second process ever appears. Redis is not required at this scale and is not added.

## 7. Privacy — DPDP Act 2023 alignment

India's Digital Personal Data Protection Act is the governing regime, and student data is the
sensitive case. The obligations we design for:

| Obligation | How |
| --- | --- |
| **Purpose limitation** | Each data category has a declared purpose in the privacy policy and in `/settings/privacy`. |
| **Consent, specific and revocable** | Public profile, company contactability, alumni discoverability and email digests are each a separate opt-in, each revocable in one click. **All default to off.** |
| **Data minimisation** | We do not collect date of birth, address, caste, religion, income or ID numbers. Nothing in the product needs them, so nothing asks. |
| **Right to access** | `/settings/data` exports everything about the user as JSON + files, generated on demand. |
| **Right to correction** | Every profile field is editable; project authorship corrections go through faculty. |
| **Right to erasure** | See below — this one is genuinely hard and deserves its own row. |
| **Breach notification** | A documented incident procedure with a named responder, in the Phase 17 runbook. |
| **Grievance officer** | Named, with contact details, at `/legal/grievance`. Mandatory under the IT Rules. |
| **Children's data** | Users must be 16+. Under-18 accounts are created only through a college's verified roster, never by self-registration. |

### Erasure, honestly

A student's project work is a **shared** record: it belongs to a group, was evaluated by a faculty
member, and may be cited by a later project. Deleting it unilaterally would destroy other people's
records and break lineage. So erasure is:

- **Solely-authored content** (posts, comments, ideas, own files) — hard deleted.
- **Shared content** (project sections, group files, tasks) — retained, with the author
  **anonymised** to "Former member". The contribution ledger keeps the events and loses the name.
- **Identity** (user row, email, profile, skills, avatar) — hard deleted.
- **Audit log and evaluation records** — retained with a pseudonymous id, because an institution
  has a lawful basis to keep academic assessment records.

This is stated plainly in the privacy policy and on the deletion screen **before** the user
confirms. Promising total erasure and not delivering it is worse than explaining the limit.

## 8. Content moderation & trust

- **College verification is the primary gate.** An unverified college's content is never publicly
  indexable and never appears in inter-college surfaces.
- **Company verification** before any opportunity is posted or any student is contacted.
- **Faculty approval** before a project becomes publicly visible.
- Report-and-review on every user-generated surface, with a queue for faculty (their subject),
  college admins (their college) and platform admins (everything).
- Block and mute at the user level.
- Every moderation action is in the audit log with an actor and a reason.
- **Academic integrity:** the similarity check at proposal time, the immutable submission snapshot,
  and the ledger together make fabricated contribution claims difficult and detectable. The policy
  is published at `/legal/academic-integrity`.

## 9. Secrets & configuration

- `.env` is never committed; `.env.example` documents every variable.
- `lib/env.ts` validates at boot and fails with the variable's name.
- `AUTH_SECRET` is generated per environment and rotated on any suspicion.
- Database credentials are least-privilege: the app user cannot `DROP` or create extensions;
  migrations run as a separate, elevated user.
- No secret is ever logged. The logger has a redaction list.
- On the VPS: UFW allowing only 22, 80 and 443; SSH key-only with password auth disabled;
  fail2ban; unattended security upgrades; Postgres bound to localhost only.

## 10. Logging & monitoring

- Structured JSON logs with a request id, no PII in the message body.
- `AuditLog` (in the database) for every administrative, evaluative and moderation action —
  separate from application logs and never rotated away.
- Health endpoint at `/api/health` checking process, database and disk.
- Alert on: 5xx rate, failed-login spikes, upload quarantine failures, backup failure.

---

## Phase 16 verification checklist

- [ ] All headers present in production, verified with `curl -I` against the live host
- [ ] CSP has no `unsafe-inline` script and no `unsafe-eval`
- [ ] Every scoped query has a cross-college denial test
- [ ] IDOR attempted on file, task, comment, notification and evaluation ids — all denied
- [ ] Rate limits verified by script, not assumed
- [ ] Upload rejects: wrong magic bytes, oversize, double extension, an SVG containing `<script>`
- [ ] A file URL from one group returns 404 to a member of another group
- [ ] Data export produces a complete, readable archive
- [ ] Data deletion behaves exactly as section 7 describes, verified row by row
- [ ] Password reset token is single-use and expires
- [ ] Sessions invalidate on password change
- [ ] No secret in the repository history (`gitleaks` run over the full history, not just HEAD)
- [ ] Dependency audit clean (`npm audit`, no high or critical)
- [ ] The privacy policy accurately describes what the code actually does — read it against the
      schema, line by line. This is the check people skip and it is the one that matters.
