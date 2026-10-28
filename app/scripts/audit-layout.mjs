#!/usr/bin/env node
/**
 * Layout audit — reports COMPUTED type sizes and spacing at real viewport
 * widths, at 100% zoom.
 *
 * Written because a screenshot cannot distinguish "the type is too big" from
 * "the browser is zoomed". This measures what the CSS actually produces, so the
 * design conversation is about numbers rather than impressions.
 *
 * Usage:
 *   node scripts/audit-layout.mjs /            default widths
 *   node scripts/audit-layout.mjs / 390 1280   specific widths
 *
 * Env: BASE_URL (default http://localhost:3000)
 */

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

const args = process.argv.slice(2);
const route = args.find((a) => a.startsWith("/")) ?? "/";
const widths = args.filter((a) => /^\d+$/.test(a)).map(Number);
const VIEWPORTS = widths.length ? widths : [390, 768, 1280, 1536];
const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.error("  No Chrome or Edge found.");
  process.exit(1);
}

const port = 9222 + Math.floor(Math.random() * 300);
const profile = mkdtempSync(join(tmpdir(), "nx-audit-"));
const proc = spawn(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevTools() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return (await res.json()).webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("Chrome DevTools did not become available");
}

function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  let nextId = 1;
  const ready = new Promise((res, rej) => {
    ws.addEventListener("open", () => res());
    ws.addEventListener("error", rej);
  });
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    const entry = pending.get(msg.id);
    if (entry) {
      pending.delete(msg.id);
      if (msg.error) entry.reject(new Error(msg.error.message));
      else entry.resolve(msg.result);
    }
  });
  return {
    ready,
    send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((res, rej) => {
        pending.set(id, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id, method, params, sessionId }));
      });
    },
    close: () => ws.close(),
  };
}

/** Runs in the page. Reports computed values for the elements that matter. */
const PROBE = `(() => {
  const px = (el, prop) => el ? Math.round(parseFloat(getComputedStyle(el)[prop]) * 10) / 10 : null;
  const h1 = document.querySelector('h1');
  const h2 = document.querySelector('h2');
  const lead = h1 ? h1.parentElement.querySelector('p') : null;
  const body = document.querySelector('main p:not(:first-of-type)') || lead;
  const header = document.querySelector('header');
  const main = document.querySelector('main');
  const section = document.querySelector('main section');
  const btn = document.querySelector('main a[class*="h-12"], main a[class*="h-11"], main button');

  const r = (el) => el ? el.getBoundingClientRect() : null;
  const hr = r(header), sr = r(section), h1r = r(h1);

  return {
    viewport: window.innerWidth,
    dpr: window.devicePixelRatio,
    zoom: Math.round((window.outerWidth / window.innerWidth) * 100) / 100,
    h1_px: px(h1, 'fontSize'),
    h1_lineHeight: px(h1, 'lineHeight'),
    h1_width: h1r ? Math.round(h1r.width) : null,
    h2_px: px(h2, 'fontSize'),
    lead_px: px(lead, 'fontSize'),
    body_px: px(body, 'fontSize'),
    html_px: px(document.documentElement, 'fontSize'),
    headerHeight: hr ? Math.round(hr.height) : null,
    sectionPadTop: px(section, 'paddingTop'),
    sectionPadBottom: px(section, 'paddingBottom'),
    heroTopGap: (h1r && hr) ? Math.round(h1r.top - hr.bottom) : null,
    contentMaxWidth: main ? Math.round(r(main.querySelector('div')) ? r(main.querySelector('div')).width : 0) : null,
    docHeight: Math.round(document.documentElement.scrollHeight),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    scrollWidth: document.documentElement.scrollWidth,
  };
})()`;

try {
  const cdp = connect(await waitForDevTools());
  await cdp.ready;
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);

  console.log(`\n  Layout audit — ${baseUrl}${route}  (100% zoom, dpr 1)\n`);
  const rows = [];

  for (const width of VIEWPORTS) {
    await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 },
      sessionId,
    );
    await cdp.send("Page.navigate", { url: `${baseUrl}${route}` }, sessionId);
    await sleep(1800);
    const { result } = await cdp.send(
      "Runtime.evaluate",
      { expression: PROBE, returnByValue: true },
      sessionId,
    );
    rows.push(result.value);
  }

  const cols = [
    ["viewport", "vw"],
    ["h1_px", "h1"],
    ["h1_lineHeight", "h1 lh"],
    ["h2_px", "h2"],
    ["lead_px", "lead"],
    ["body_px", "body"],
    ["headerHeight", "header"],
    ["sectionPadTop", "sec pt"],
    ["heroTopGap", "hero gap"],
    ["docHeight", "doc h"],
  ];
  console.log("  " + cols.map(([, l]) => String(l).padStart(9)).join(" "));
  console.log("  " + cols.map(() => "-".repeat(9)).join(" "));
  for (const row of rows) {
    console.log("  " + cols.map(([k]) => String(row[k] ?? "—").padStart(9)).join(" "));
  }

  const overflow = rows.filter((r) => r.horizontalOverflow);
  console.log("");
  if (overflow.length) {
    for (const r of overflow) {
      console.log(`  ✖ HORIZONTAL OVERFLOW at ${r.viewport}px (scrollWidth ${r.scrollWidth})`);
    }
    process.exitCode = 1;
  } else {
    console.log("  ✔ No horizontal overflow at any width.");
  }
  console.log("");

  cdp.close();
} finally {
  proc.kill();
}
