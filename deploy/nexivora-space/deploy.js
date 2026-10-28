/**
 * nexivora.space — holding-page deploy
 *
 * WHY THIS EXISTS AND WHAT IT IS NOT.
 *
 * The Hostinger account behind these FTP credentials is shared hosting — the
 * same family as truthordare.fun on this account (`u836338583.*`, default.php
 * sitting at the root, FTP-only). Shared hosting runs PHP/static files; it has
 * no Node.js process behind it, and even where Hostinger's Node.js-App feature
 * exists, the plan gives MySQL, not the PostgreSQL Nexivora needs. See
 * `docs/DEPLOYMENT.md` in the main repo — this is not a workaround for that
 * constraint, it is downstream of it.
 *
 * So this script does NOT deploy the Nexivora application. It uploads one
 * static, on-brand holding page (`site/index.html` + real favicon/OG assets)
 * so the domain shows something real instead of Hostinger's default parking
 * page while the actual app is deployed to a Node-capable host (Render/Neon —
 * see docs/DEPLOYMENT.md) and DNS is pointed at it.
 *
 * Structurally this mirrors TruthOrDare/deploy.js (same account, same
 * `basic-ftp` pattern, same default.php removal) minus the build step — there
 * is nothing to build, `site/` is committed as-is.
 *
 * Usage:
 *   npm run deploy              Upload site/ to nexivora.space
 *   npm run deploy:dry-run      List what would be uploaded, upload nothing
 *   npm run deploy:verbose      Detailed FTP logging
 *
 * Environment (.env in this directory):
 *   FTP_PASSWORD   (required)
 *   FTP_HOST       (optional) default: ftp.nexivora.space
 *   FTP_USER       (optional) default: u836338583.nexivoraspace
 */

require("dotenv").config();

const ftp = require("basic-ftp");
const fs = require("fs");
const path = require("path");

const config = {
  host: process.env.FTP_HOST || "ftp.nexivora.space",
  user: process.env.FTP_USER || "u836338583.nexivoraspace",
  password: process.env.FTP_PASSWORD,
  secure: false,
  remoteDir: process.env.FTP_REMOTE_DIR || "/",
  localDir: path.join(__dirname, "site"),
};

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isVerbose = args.includes("--verbose");

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

const log = (msg, color = "reset") => console.log(`${colors[color]}${msg}${colors.reset}`);
const ok = (msg) => log(`  [PASS] ${msg}`, "green");
const err = (msg) => log(`  [FAIL] ${msg}`, "red");
const info = (msg) => log(`  [INFO] ${msg}`, "cyan");
const warn = (msg) => log(`  [WARN] ${msg}`, "yellow");
const verbose = (msg) => isVerbose && log(`         ${msg}`, "cyan");

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getAllFiles(dirPath, basePath) {
  const files = [];
  for (const item of fs.readdirSync(dirPath)) {
    const fullPath = path.join(dirPath, item);
    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...getAllFiles(fullPath, basePath));
    } else {
      files.push({
        name: path.relative(basePath, fullPath).replace(/\\/g, "/"),
        localPath: fullPath,
        size: stats.size,
      });
    }
  }
  return files;
}

async function deploy() {
  console.log("");
  log("========================================", "magenta");
  log("  nexivora.space — holding page deploy", "bright");
  log("========================================", "magenta");

  if (!fs.existsSync(config.localDir)) {
    err(`${config.localDir} not found.`);
    process.exit(1);
  }

  const files = getAllFiles(config.localDir, config.localDir);
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  info(`Found ${files.length} files to deploy (${formatBytes(totalSize)})`);

  if (isDryRun) {
    log("\n  Files that would be deployed:", "cyan");
    files.forEach((f) => log(`    ${f.name} (${formatBytes(f.size)})`));
    log(`\n  Dry run complete. Nothing uploaded.`, "green");
    return;
  }

  if (!config.password) {
    err("FTP_PASSWORD not set. Create deploy/nexivora-space/.env with FTP_PASSWORD=...");
    process.exit(1);
  }

  const client = new ftp.Client();
  client.ftp.verbose = isVerbose;

  try {
    info(`Connecting to ${config.host}...`);
    await client.access({
      host: config.host,
      user: config.user,
      password: config.password,
      secure: config.secure,
    });
    ok("Connected to FTP server");

    // Hostinger's default parking page — remove it so it stops shadowing index.html.
    try {
      await client.remove("default.php");
      info("Removed default.php");
    } catch {
      verbose("No default.php to remove (OK)");
    }

    let uploaded = 0;
    let failed = 0;

    for (const file of files) {
      try {
        const dir = path.dirname(file.name);
        if (dir && dir !== ".") {
          await client.ensureDir("/" + dir);
          await client.cd("/");
        }
        verbose(`Uploading: ${file.name} (${formatBytes(file.size)})`);
        await client.uploadFrom(file.localPath, file.name);
        uploaded++;
        ok(`Uploaded: ${file.name}`);
      } catch (e) {
        failed++;
        err(`Failed: ${file.name} — ${e.message}`);
      }
    }

    log("\n========================================", "magenta");
    ok(`Uploaded ${uploaded} file(s) (${formatBytes(totalSize)})`);
    if (failed > 0) err(`Failed: ${failed} file(s)`);
    log(`\n  Live at: https://nexivora.space\n`, "green");
  } catch (error) {
    err(`Deployment failed: ${error.message}`);
    if (error.code === 530) err("Authentication failed — check FTP credentials.");
    process.exit(1);
  } finally {
    client.close();
  }
}

deploy().catch((error) => {
  err(`Unexpected error: ${error.message}`);
  process.exit(1);
});
