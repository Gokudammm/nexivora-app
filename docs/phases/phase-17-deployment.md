# Phase 17 — Deployment & Operations

| | |
| --- | --- |
| **Status** | ⬜ Not Started |
| **Depends on** | Phase 16 |
| **Blocks** | Phase 19 |
| **Estimate** | 6 focused hours |
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
- **SMTP is this phase's job.** `EMAIL_TRANSPORT=smtp` currently **throws** rather than silently
  dropping mail. Five templates exist (verify, reset, password-changed, account-locked, invitation);
  they need a real sender, SPF and DKIM.
- **`AUTH_SECRET` is used to salt hashed IP addresses.** Changing it in production invalidates the
  device fingerprints shown on the security page — harmless, but it will look like new devices.
- **Session cookies set `secure` from `NODE_ENV=production`.** Behind Nginx, `X-Forwarded-Proto`
  must reach the app or the cookie will be dropped over what the app thinks is plain HTTP.
- **Add `npm run check:auth` to CI** alongside the build — it needs a running server and a seeded
  database, and it is the only check that exercises the flows end to end.

## Objective

Get Nexivora running on a real domain, reliably, with backups that have actually been restored and
a rollback that takes under two minutes. Everything here is written out in `docs/DEPLOYMENT.md`;
this phase executes it and records what was actually true.

## In scope

- Production build configuration and the environment matrix
- The Cloudflare Tunnel recipe for pre-production sharing
- The full Hostinger VPS setup
- Domain and TLS
- Backups with a **tested** restore
- CI, health checks, structured logging, uptime monitoring

## Out of scope

- Multi-server scaling · Kubernetes · A CDN (Nginx caching is sufficient at this scale)

## Deliverables

### Pre-production
- [ ] `output: 'standalone'` verified; build size recorded
- [ ] Production environment variables documented and set
- [ ] **`NEXT_PUBLIC_SITE_URL` correct** — canonicals, sitemap, OG and auth callbacks all derive
      from it, and getting it wrong is the most damaging single SEO mistake available
- [ ] Cloudflare Tunnel recipe verified end to end, with the `NEXT_PUBLIC_SITE_URL` caveat written
      down
- [ ] Migration path from the development database reviewed

### Domain
- [ ] `nexivora.com` purchased (buy it before the pitch, not after)
- [ ] DNS pointed at the VPS; `www` canonicalisation decided and the other host 301'd
- [ ] TLS via Certbot; auto-renewal **verified with `systemctl list-timers`**, not assumed
- [ ] `NEXT_PUBLIC_SITE_URL` and `AUTH_URL` updated to match exactly

### VPS setup
Follow `docs/DEPLOYMENT.md` §3 exactly, and correct the runbook wherever reality differs.
- [ ] Ubuntu 24.04, non-root user, SSH key-only, root login disabled
- [ ] UFW (22, 80, 443 only), fail2ban, unattended security upgrades
- [ ] Node 22, PM2, Nginx, PostgreSQL 16, Certbot
- [ ] Postgres: database, least-privilege app user, extensions, **bound to localhost only**
- [ ] Separate elevated user for migrations
- [ ] Application deployed, `prisma migrate deploy`, built, `pm2 start`, `pm2 save`, `pm2 startup`
- [ ] Nginx: reverse proxy, gzip/brotli, static caching, `client_max_body_size` above the upload cap
- [ ] **`proxy_buffering off` on `/api/sse`** — verify a notification arrives in real time on the
      live host, because this is the classic production failure and it is silent
- [ ] Security headers verified on the live host with `curl -I`

### Backups
- [ ] Nightly `pg_dump` plus an uploads archive, gzipped
- [ ] 14-day local retention, pushed off-box to Cloudflare R2 via rclone
- [ ] **A restore performed into a scratch database, with the app booted against it.** A backup that
      has not been restored is not a backup.
- [ ] The restore procedure written down with its measured duration
- [ ] Backup failure alerts

### CI
- [ ] GitHub Actions: `npm ci` → typecheck → lint → test → build on every push
- [ ] A Postgres service container for the integration tests
- [ ] Deploy on a tagged release: SSH, pull, `npm ci`, migrate, build, `pm2 reload`
- [ ] Nothing deploys that has not built

### Operations
- [ ] `/api/health` checking process, database and disk, wired to monitoring
- [ ] Uptime monitoring (UptimeRobot free tier) with an alert destination that is actually watched
- [ ] Structured JSON logs, rotated, with the redaction list active
- [ ] PM2 log rotation configured
- [ ] Error alerting on the 5xx rate
- [ ] `web-vitals` beacon receiving real field data
- [ ] A documented incident procedure with a named responder (a DPDP obligation, not optional)

### Post-deploy verification
- [ ] Every public route returns 200 on the live host
- [ ] **`robots.txt` does not contain `Disallow: /`.** Check it twice. Shipping a staging disallow
      to production is the classic launch-day catastrophe.
- [ ] `sitemap.xml` loads, is valid, and contains only public URLs on the production host
- [ ] Every canonical points at the production host, not localhost
- [ ] Registration → verification email → login works with the real SMTP transport
- [ ] A file uploads and downloads
- [ ] SSE delivers a notification live, in two browsers
- [ ] Google Search Console verified, sitemap submitted
- [ ] Rich Results Test run against live URLs
- [ ] A rollback rehearsed and timed

## Acceptance criteria

1. `https://nexivora.com` serves the production application over TLS.
2. Every post-deploy verification item passes on the live host.
3. A backup has been **restored**, and the app booted against the restored database.
4. A rollback completes in under two minutes, timed.
5. CI blocks a broken build from deploying.
6. Health checks and uptime monitoring alert to somewhere a person will see.
7. SSE works through Nginx in production.
8. `docs/DEPLOYMENT.md` matches what was actually done — every deviation corrected in the doc.

## Notes & risks

- **Hostinger shared hosting cannot run this.** If this is discovered at deploy time rather than
  now, the phase stalls. It is in `docs/DEPLOYMENT.md` §0 and in `PLAN.md` §A2 precisely so it is
  known in advance. VPS KVM 2.
- **`proxy_buffering off` on the SSE route.** Without it, notifications arrive in batches or not at
  all, and it looks like an application bug for an hour.
- **Test the restore.** This is the single most-skipped operational step and the one whose absence
  is discovered at the worst possible moment.
- **Check production `robots.txt` after deploying**, on the live host, in a browser. Not the local
  file, not the code.
- Certbot renewal fails silently if a hook is misconfigured. Verify the timer exists and run
  `certbot renew --dry-run` once.
- `pm2 reload` (not `restart`) gives zero downtime.
- Migrations do not roll back automatically. Review every migration before applying it, and take a
  backup immediately before a destructive one.
- Keep the runbook truthful. A deployment doc that describes what you *intended* to do is worse than
  none, because the next deploy will follow it.

---

## Phase Summary

*Fill this in when the phase is complete.*

**What was deployed, and where.**

**Key decisions made.**

**Where reality differed from the runbook, and how the runbook was corrected.**

**Restore test result and timing.**

**Anything the next phase must know.**

**Verified by.**

| Check | Result |
| --- | --- |
| | |
