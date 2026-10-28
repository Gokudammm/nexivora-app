# Deployment Guide

The full deliverable checklist is in `docs/phases/phase-17-deployment.md`. This is the runbook.

---

## Read this first: hosting options

**Hostinger shared hosting (Premium / Business web hosting) runs PHP and MySQL only. It cannot run
a Node.js process.** A server-rendered Next.js application will not work there. This is not a
configuration problem to solve — it is what those plans are.

For self-hosting, production needs a Hostinger VPS. Managed Node platforms such as Vercel and
Render are also options; Vercel's full-stack setup is described below.

| Plan                        | Spec                   | Verdict                                                              |
| --------------------------- | ---------------------- | -------------------------------------------------------------------- |
| Shared (Premium / Business) | PHP + MySQL            | ❌ Cannot run Nexivora                                               |
| **VPS KVM 1**               | 1 vCPU · 4 GB · 50 GB  | Works. Tight once Postgres, Node and Nginx share it.                 |
| **VPS KVM 2**               | 2 vCPU · 8 GB · 100 GB | ✅ **The recommendation.** Comfortable headroom for a pilot college. |
| VPS KVM 4                   | 4 vCPU · 16 GB         | Only once there are several colleges.                                |

Free alternatives that _do_ run Node, if a VPS is not possible:

| Option      | Free tier                      | Notes                                                                                        |
| ----------- | ------------------------------ | -------------------------------------------------------------------------------------------- |
| **Render**  | 750 h/month web service        | Sleeps when idle, ~30s cold start. Fine for a shared demo link. Pair with Neon for Postgres. |
| **Vercel**  | Managed Next.js hosting        | Pair with Marketplace PostgreSQL, private Blob storage and SMTP for the full application.     |
| **Railway** | Trial credit, then usage-based | Simplest deploy of the four; includes Postgres.                                              |
| **Fly.io**  | Small free allowance           | Global, more configuration, real Postgres.                                                   |
| **Koyeb**   | One free service               | Simple, generous enough for a demo.                                                          |
| **Neon**    | Free Postgres, 0.5 GB          | The database half of any of the above. Serverless, scales to zero.                           |

**Render + Neon is set up as a one-click blueprint** — `render.yaml` at the repo root, walkthrough
and honest free-tier caveats (ephemeral file storage, console-only email until SMTP is added) in
`deploy/nexivora-space/README.md`.

Last resort — static-exporting the public site onto shared hosting while the app runs elsewhere.
This splits the product, breaks shared navigation and session, and is not recommended. `nexivora.space`
currently carries a small on-brand holding page for exactly this reason (not the application) —
see `deploy/nexivora-space/`.

## Vercel — full application

Vercel can host the Next.js application, but the database and uploaded files must live outside the
function filesystem. Use a PostgreSQL provider from the Vercel Marketplace (Neon is the recommended
choice), a **private** Vercel Blob store, and an SMTP sender for account email. Vercel does not
provide a built-in PostgreSQL database.

### 1. Import the project

Import `Gokudammm/nexivora-app` in Vercel and set **Root Directory** to `app`. Vercel should detect
Next.js automatically. Keep `npm ci` as the install command and use the build command from
[`app/vercel.json`](../app/vercel.json): it generates Prisma Client, applies migrations using
`DIRECT_DATABASE_URL`, then builds the app. Do not override that command with just `npm run build`.
The project keeps `output: "standalone"` for self-hosting and disables it for Vercel builds.

Set the database environment variables before the first deployment; static pages read the database
during the build. Connect a separate Neon branch/database to Preview deployments, and never run
preview migrations against the production database.

### 2. Connect PostgreSQL

From the Vercel project, add PostgreSQL through the Marketplace and connect it to the Production
environment. Set `DATABASE_URL` to the provider's pooled PostgreSQL connection string for application traffic.
Set `DIRECT_DATABASE_URL` to its unpooled connection string for Prisma migrations. If the integration
supplies differently named variables, map its pooled URI to `DATABASE_URL` and its direct URI to
`DIRECT_DATABASE_URL`. The first deployment runs migrations only; do not seed demo data into
production.

### 3. Create durable, private file storage

In the Vercel project **Storage** page, create a Blob store with **Private** access and connect it
to Production (and to Preview/Development if those environments need uploads). Set
`STORAGE_DRIVER=blob`. Vercel supplies the Blob store credentials to the connected project; keep
them in Vercel's environment settings, never in source control.

Group files are uploaded directly from the browser to Blob, then verified by the app before their
database rows are created. This preserves the 25 MB file limit without routing file bodies through
a Vercel Function. Group downloads still pass through the app's membership and permission checks;
the private Blob URLs are never exposed. Public profile images are also stored privately and
served through the app's image route.

### 4. Configure application environment

Set these variables for the relevant Vercel environments:

| Variable | Production value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Pooled PostgreSQL URI from the connected provider |
| `DIRECT_DATABASE_URL` | Direct (unpooled) PostgreSQL URI for migrations |
| `STORAGE_DRIVER` | `blob` |
| `AUTH_SECRET` | Unique random secret (at least 32 characters) |
| `AUTH_URL` | The production `https://` URL |
| `NEXT_PUBLIC_SITE_URL` | The production `https://` URL |
| `EMAIL_TRANSPORT` | `smtp` |
| `EMAIL_FROM` | Address on a sender domain verified by your email provider |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | SMTP credentials from your email provider |
| `RATE_LIMIT_ENABLED` | `true` |
| `AI_ENABLED` | `false` |

Generate an `AUTH_SECRET` locally with Node, then paste it into Vercel's environment settings:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Do not paste database, SMTP, or Blob credentials into chat or commit them. Set
`NEXT_PUBLIC_SITE_URL` and `AUTH_URL` to the final host before the production build; update them
and redeploy after adding a custom domain.

### 5. Deploy and verify

Deploy from the Vercel dashboard after connecting the repository, or use the Vercel CLI from the
`app` directory after signing in. Verify registration and SMTP delivery, upload and download a
25 MB file, and confirm a non-member receives the same 404 as a missing group file. Also check
`/robots.txt`, `/sitemap.xml`, canonical URLs, and the health route after deployment.

---

## Stage 1 — Local development (and the demo)

**This is where the demo runs.** Local Postgres, seeded data, no network dependency, nothing on
venue wifi to fail.

```bash
cd Nexivora/app
npm install
cp .env.example .env          # fill in the values
npm run db:reset              # migrate + seed the demo college (~3.4s)
npm run db:verify             # 26 integrity assertions — should be 26/26
npm run dev                   # http://localhost:3000
```

### PostgreSQL — nothing to install

```bash
npm run db:up
```

That downloads the **official PostgreSQL 16 binaries-only build** (once, ~300 MB), initialises a
cluster under `app/.postgres/`, starts it on **port 5433** as an ordinary user process, creates the
`nexivora` database and installs `pg_trgm`, `unaccent` and `citext`. No installer, no admin rights,
no Docker (ADR-021).

It verifies rather than assumes: `db:up` runs `similarity('nexivora','nexivore')` and fails if the
extension is not genuinely working.

| Command                            | Does                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run db:up`                    | Download if needed, init if needed, start, ensure database and extensions                                      |
| `npm run db:status`                | Is it running, what version, does `pg_trgm` work, how many tables                                              |
| `npm run db:down`                  | Stop it                                                                                                        |
| `npm run db:destroy`               | Delete the data directory and start over (keeps the binaries)                                                  |
| `npm run db:reset`                 | Drop the schema, migrate, seed the demo world. **~3.4s.** Refuses any non-local host or `NODE_ENV=production`. |
| `npm run db:seed`                  | Seed only — assumes the schema is current                                                                      |
| `npm run db:migrate` / `db:deploy` | Create-and-apply (dev) / apply-only (production)                                                               |
| `npm run db:verify`                | 26 integrity assertions over the seeded database                                                               |
| `npm run db:studio`                | Prisma Studio                                                                                                  |

**Never run `npx prisma`.** Outside `app/` it silently downloads Prisma 8.0.0-rc, whose
`migrate` command no longer exists. The npm scripts always resolve the pinned local 7.10.0.

If `db:reset` reports **P1002, "timed out trying to acquire a postgres advisory lock"**, a killed
`migrate` has left an orphaned backend holding it. Find it in `pg_stat_activity` and terminate
that one backend.

Port **5433** deliberately, so it can never collide with an existing PostgreSQL install, and
`listen_addresses = 'localhost'` because a development database has no business accepting network
connections.

**macOS and Linux:** the script is Windows-only and says so. Use your package manager, or:

```bash
docker run --name nexivora-db -e POSTGRES_PASSWORD=nexivora -e POSTGRES_DB=nexivora -p 5433:5432 -d postgres:16
```

then, once:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS citext;
```

**Production is unaffected.** The VPS installs PostgreSQL normally — see §3.3. The bootstrap is a
development convenience, not a deployment strategy.

Reset to a clean demo state at any time:

```bash
npm run db:reset
```

LAN access, to show it on a phone:

```bash
npm run dev -- --hostname 0.0.0.0
# then http://<your-lan-ip>:3000
```

---

## Stage 2 — Sharing before production: Cloudflare Tunnel

Free, no account, no card, no deploy. Gives a public HTTPS URL in about five seconds that serves
the real application from your machine. Perfect for faculty review, testers and a live link in a
pitch email.

```bash
# install once: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel --url http://localhost:3000
# → https://random-words-1234.trycloudflare.com
```

**Set `NEXT_PUBLIC_SITE_URL` to the tunnel URL** before starting the dev server, or every canonical
and OG URL will point at `localhost` and the shared link will look broken to anyone who inspects it.

The URL changes on every run. For a stable one, a named tunnel needs a free Cloudflare account and
a domain — worth doing once `nexivora.com` is bought.

---

## Stage 3 — Production on a Hostinger VPS

### 3.1 Provision

Ubuntu 24.04 LTS. From your machine:

```bash
ssh root@<vps-ip>
adduser nexivora && usermod -aG sudo nexivora
rsync --archive ~/.ssh/authorized_keys /home/nexivora/.ssh/   # key auth for the new user
```

Then harden, before anything else is installed:

```bash
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no
systemctl restart ssh

ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
apt install -y fail2ban unattended-upgrades
```

### 3.2 Runtime

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx postgresql-16 certbot python3-certbot-nginx
sudo npm install -g pm2
```

### 3.3 Database

```bash
sudo -u postgres psql
CREATE DATABASE nexivora;
CREATE USER nexivora_app WITH PASSWORD '<strong>';
GRANT CONNECT ON DATABASE nexivora TO nexivora_app;
\c nexivora
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
GRANT USAGE, CREATE ON SCHEMA public TO nexivora_app;
```

Confirm Postgres listens on localhost only (`listen_addresses = 'localhost'` in
`postgresql.conf`). It must never be reachable from the internet.

Migrations run as a separate elevated user; the application user cannot create extensions or drop
tables. That separation is in `docs/SECURITY.md` §9 and it is worth the five minutes.

### 3.4 Deploy

```bash
sudo -iu nexivora
git clone <repo> /home/nexivora/app && cd /home/nexivora/app/app
npm ci
cp .env.example .env && nano .env      # production values, NODE_ENV=production
npx prisma migrate deploy
npm run build
pm2 start npm --name nexivora -- start
pm2 save && pm2 startup                # survives reboot
```

`next.config.ts` sets `output: 'standalone'`, so the built server carries only what it needs.

### 3.5 Nginx

```nginx
server {
  server_name nexivora.com www.nexivora.com;

  gzip on;  gzip_types text/css application/javascript application/json image/svg+xml;
  client_max_body_size 30M;                 # must exceed the 25MB upload cap

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # Server-Sent Events — buffering here is the classic production bug.
  # Without these three lines notifications arrive in batches, or not at all.
  location /api/sse {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 24h;
  }

  location /_next/static/ {
    proxy_pass http://127.0.0.1:3000;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }
}
```

```bash
sudo certbot --nginx -d nexivora.com -d www.nexivora.com
```

Certbot installs a renewal timer. Verify it with `systemctl list-timers | grep certbot` rather than
assuming.

### 3.6 Backups — and a tested restore

```bash
# /home/nexivora/backup.sh, nightly at 02:00 via cron
pg_dump nexivora | gzip > /home/nexivora/backups/db-$(date +%F).sql.gz
tar czf /home/nexivora/backups/files-$(date +%F).tar.gz /home/nexivora/uploads
find /home/nexivora/backups -mtime +14 -delete
# then push off-box — Cloudflare R2 free tier via rclone
rclone copy /home/nexivora/backups r2:nexivora-backups
```

**A backup you have not restored is not a backup.** Phase 17 is not complete until a restore has
been performed into a scratch database and the app has been booted against it.

---

## Environment matrix

| Variable               | Dev                     | Production                                                     |
| ---------------------- | ----------------------- | -------------------------------------------------------------- |
| `NODE_ENV`             | `development`           | `production`                                                   |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | `https://nexivora.com`                                         |
| `DATABASE_URL`         | local Postgres          | localhost Postgres on the VPS                                  |
| `DIRECT_DATABASE_URL`  | unset (falls back)      | unpooled PostgreSQL URI for Vercel migrations                  |
| `AUTH_SECRET`          | 32+ characters          | 32+ random bytes, unique                                       |
| `AUTH_URL`             | `http://localhost:3000` | `https://nexivora.com`                                         |
| `EMAIL_TRANSPORT`      | `console`               | `smtp`                                                         |
| `SMTP_*`               | unset                   | SMTP host, port, username and password from your mail provider |
| `UPLOAD_DIR`           | `./.uploads`            | `/home/nexivora/uploads`                                       |
| `STORAGE_DRIVER`       | `local`                 | `local` on VPS; `blob` on Vercel                               |
| `AI_ENABLED`           | `false`                 | `false` until Phase 18                                         |
| `ANTHROPIC_API_KEY`    | unset                   | set only when `AI_ENABLED=true`                                |
| `RATE_LIMIT_ENABLED`   | `false`                 | `true`                                                         |

**`NEXT_PUBLIC_SITE_URL` is load-bearing** — canonicals, sitemap entries, OG image URLs and auth
callbacks all derive from it. Getting it wrong in production means every canonical points at
localhost, which is the most damaging single SEO mistake available.

For the Render + Neon blueprint, set `EMAIL_FROM` to an address on a sender domain verified with
your mail provider, and supply `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` and `SMTP_PASSWORD` as secrets.
Production uses SMTP and refuses to start if these settings are missing; verification, password
reset, security-alert and invitation emails must not silently disappear.

On Vercel, `DATABASE_URL` is the pooled PostgreSQL URI and `DIRECT_DATABASE_URL` is the unpooled
URI used by Prisma migrations. Set `STORAGE_DRIVER=blob` and connect a private Blob store.

---

## CI (GitHub Actions, Phase 17)

On every push: `npm ci` → `typecheck` → `lint` → `test` → `build`, plus `db:reset` and
`db:verify` against a service container so the integrity suite and the seed's determinism are both
enforced rather than remembered. On a tagged release, additionally
SSH to the VPS and run the deploy script. Nothing deploys that has not built.

## Deploy checklist

- [ ] `npm run check` clean locally
- [ ] `npm run db:verify` passes against a copy of production data
- [ ] `npm run check:auth` passes against the deployed host
- [ ] `RATE_LIMIT_ENABLED=true` and `EMAIL_TRANSPORT=smtp` are set
- [ ] Migrations reviewed — no destructive change without an explicit, backed-up plan
- [ ] `.env` on the server updated for any new variable
- [ ] `NEXT_PUBLIC_SITE_URL` is the production host
- [ ] **`robots.txt` does not contain `Disallow: /`** — check it after deploy, on the live host
- [ ] `pm2 reload nexivora` (reload, not restart — zero downtime)
- [ ] `/api/health` returns 200
- [ ] Sitemap loads and contains only public URLs
- [ ] SSE connects — open two browsers and verify a notification arrives without a refresh
- [ ] A file upload and download round-trips
- [ ] Backup ran last night and the file is non-trivially sized

## Rollback

```bash
cd /home/nexivora/app && git checkout <previous-tag>
cd app && npm ci && npm run build && pm2 reload nexivora
```

Under two minutes. **Database migrations do not roll back automatically** — a destructive migration
needs the backup, which is why every migration is reviewed before it is applied.
