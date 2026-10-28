# nexivora.space — deploy

**This folder does not deploy Nexivora the application.** It uploads one static
holding page. Read why before changing anything here.

## The constraint

The FTP credentials for `nexivora.space` are shared hosting on the same
Hostinger account as `truthordare.fun` (`u836338583.*`, FTP-only, `default.php`
sitting at the root when we first connected). Shared hosting serves static
files and PHP. It has no persistent Node.js process behind it, and Nexivora is
a live Next.js app — server actions, sessions, PostgreSQL, real-time
notifications. None of that runs over FTP, no matter how the upload script is
written. The full reasoning and the recommended path are in
[`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md) at the repo root — this
folder is downstream of that document, not a way around it.

(SSH is open on port 65002 for this Hostinger account, which usually means a
Business/Cloud plan with hPanel's "Setup Node.js App" available. That still
only gives MySQL, not the PostgreSQL Nexivora needs, so it does not change the
conclusion — and in any case we only hold the FTP sub-account password, not
the SSH/hPanel login.)

## What this folder actually does

Uploads `site/` — one real, on-brand HTML page (the actual logo mark, the
actual color tokens, the actual tagline from `src/config/site.ts`) — so
`nexivora.space` shows something intentional instead of Hostinger's default
parking page while the real application is deployed elsewhere.

```bash
cd deploy/nexivora-space
npm install
cp .env.example .env        # fill in FTP_PASSWORD
npm run deploy:dry-run      # see what would upload, uploads nothing
npm run deploy               # upload site/ to nexivora.space
```

Same `basic-ftp` pattern as `TruthOrDare/deploy.js` on this account, minus the
build step — there is nothing to build; `site/index.html` is committed as-is
and edited directly.

## The actual deployment (do this, not more holding-page tweaks)

`docs/DEPLOYMENT.md` §"Stage 3" and the free-tier table above it lay out the
real path: **Render (free, runs Node) + Neon (free Postgres)** is the
fastest route to a fully working Nexivora with no VPS purchase. There is a
[`render.yaml`](../../render.yaml) at the repo root so this is a blueprint
click rather than hand-configuring a service:

1. Create a free account at **neon.tech** → New project → copy the **pooled**
   connection string. Keep the tab open, you need it in step 3.
2. Click **[Deploy to Render](https://render.com/deploy?repo=https://github.com/achaudhary7/nexivora)**.
   Signing in with GitHub is the fastest path (one OAuth click, also grants
   Render the repo access it needs) — no separate signup form.
3. Render reads `render.yaml` from the repo automatically and asks you to
   fill in the values it can't know on its own:
   - `DATABASE_URL` — the Neon string from step 1.
   - `NEXT_PUBLIC_SITE_URL` and `AUTH_URL` — leave a placeholder for the
     first deploy (e.g. `https://nexivora.onrender.com`), then come back and
     set the real `.onrender.com` URL Render assigns you, redeploy once.
     Update both again, once, after the DNS step below.
   - `EMAIL_FROM` and `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
     — credentials from an SMTP mail provider, with `EMAIL_FROM` on a sender
     domain verified by that provider. Do not use the console transport for
     public registrations.
   - Everything else (`AUTH_SECRET`, `NODE_ENV`, etc.) is already set in
     `render.yaml`.
4. First deploy runs migrations automatically (`prisma migrate deploy` is
   part of the build command) and seeds nothing — Render is not the demo
   database, it's meant to hold real data. If you want the demo world on it
   too, run `npm run db:seed` once against the Neon `DATABASE_URL` from your
   own machine.
5. In Hostinger's **hPanel** (not FTP — this needs the account login, which
   this folder does not have) point `nexivora.space` at the Render service:
   a `CNAME` to the `.onrender.com` host, or Render's custom-domain flow for
   an apex domain (Render's dashboard tells you exactly which record to add
   once you type in the domain).

**Two honest limits of the free tier, so they don't surprise you:**

- **Files vanish on redeploy.** `STORAGE_DRIVER=local` writes into the
  container's filesystem, which Render free tier does not persist across
  restarts or redeploys. The R2 storage driver is not implemented yet, so do
  not rely on uploaded files being retained.

Once the real app is live, this holding page is no longer needed — either
leave it as a landing page that links to the app, or stop deploying to it and
let the DNS change take over entirely.
