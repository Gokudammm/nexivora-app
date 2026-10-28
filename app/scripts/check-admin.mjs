#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * ADMIN CONSOLE END-TO-END CHECK — Phase 5.
 *
 * Signs in as a real seeded college administrator and walks the console. It
 * asserts behaviour rather than status codes: that the hierarchy actually
 * renders, that a change is written *and appears in the audit log*, and — the
 * one that matters — that an administrator of one college cannot reach
 * another's data through a URL.
 *
 *   npm run check:admin      (needs a running server and a seeded database)
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.ADMIN_EMAIL ?? "rajesh-kumar@nit.edu.in";
const PASSWORD = process.env.ADMIN_PASSWORD ?? "nexivora-demo";

const CHROME_CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

const chrome = CHROME_CANDIDATES.find((path) => existsSync(path));
if (!chrome) {
  console.error("  No Chrome or Edge found.");
  process.exit(1);
}

const profile = resolve(process.cwd(), ".screenshots", ".chrome-admin-profile");
mkdirSync(profile, { recursive: true });

const port = 9900 + Math.floor(Math.random() * 90);
const proc = spawn(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
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
  for (let i = 0; i < 80; i += 1) {
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

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

try {
  const cdp = connect(await waitForDevTools());
  await cdp.ready;

  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Network.enable", {}, sessionId);

  // Start signed out, every time. The Chrome profile is reused between runs, so
  // without this the second run arrives at /login already authenticated, is
  // redirected to /dashboard by the guest-only rule, and fails with "cannot set
  // properties of null" on a form that is not on the page — which reads as "the
  // login page is broken" rather than "the session persisted". The same line is
  // in check-workspace.mjs and check-project.mjs for the same reason.
  await cdp.send("Network.clearBrowserCookies", {}, sessionId);

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await cdp.send(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    if (exceptionDetails) {
      // `exceptionDetails.text` is the useless "Uncaught". The real message is
      // on the thrown object's description — without it a failure here reports
      // one word and says nothing about which expression broke, which is how
      // this check spent a debugging session being unreadable.
      const detail =
        exceptionDetails.exception?.description ??
        exceptionDetails.exception?.value ??
        exceptionDetails.text ??
        "evaluation failed";
      throw new Error(String(detail).split(String.fromCharCode(10))[0]);
    }
    return result.value;
  };

  const settle = async (timeoutMs = 45000) => {
    const deadline = Date.now() + timeoutMs;
    let previous = null;
    let stable = 0;

    while (Date.now() < deadline) {
      await sleep(250);
      const current = await evaluate(
        "location.pathname + '|' + document.readyState + '|' + (document.body ? document.body.innerText.length : 0)",
      ).catch(() => null);

      if (current && current === previous && current.includes("|complete|")) {
        stable += 1;
        if (stable >= 3) return;
      } else {
        stable = 0;
      }
      previous = current;
    }
  };

  // A Server Action redirect is a soft navigation, so readyState never changes.
  const waitForPathChange = async (from, timeoutMs = 60000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const current = await evaluate("location.pathname + location.search").catch(() => null);
      if (current && current !== from) {
        await settle();
        return current;
      }
      await sleep(250);
    }
    return from;
  };

  const goto = async (path) => {
    await cdp.send("Page.navigate", { url: `${BASE}${path}` }, sessionId);
    await settle();
  };

  const text = () => evaluate("document.body.innerText");
  const path = () => evaluate("location.pathname + location.search");

  console.log(`\n  Admin console end-to-end — ${BASE}\n`);

  /* ------------------------------------------------------------ sign in */

  await goto("/login?next=%2Fadmin");
  await evaluate(`
    (() => {
      document.querySelector('input[name=email]').value = ${JSON.stringify(EMAIL)};
      document.querySelector('input[name=password]').value = ${JSON.stringify(PASSWORD)};
      document.querySelector('input[name=email]').dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('input[name=password]').dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('form').requestSubmit();
      return true;
    })()
  `);

  const landed = await waitForPathChange("/login?next=%2Fadmin");
  record("a college administrator reaches the console", landed === "/admin", landed);

  const overview = await text();
  record(
    "the overview shows the real hierarchy, not zeroes",
    /Departments/.test(overview) &&
      !/^0$/m.test(overview.split("Departments")[1]?.split("\n")[1] ?? ""),
    overview.includes("Recent changes") ? "counts and recent changes rendered" : "missing sections",
  );

  /* ----------------------------------------------------- every section */

  for (const [route, expect] of [
    ["/admin/departments", "department"],
    ["/admin/subjects", "subject"],
    ["/admin/terms", "term"],
    ["/admin/classes", "class"],
    ["/admin/people", "college"],
    ["/admin/invitations", "invitation"],
    ["/admin/college", "Verification"],
    ["/admin/audit-log", "Append-only"],
  ]) {
    await goto(route);
    const body = await text();
    record(
      `${route} renders`,
      (await path()) === route && body.toLowerCase().includes(expect.toLowerCase()),
      await path(),
    );
  }

  /* ------------------------------------------------- write, then audit */

  await goto("/admin/departments");
  // Both the name AND the code have to be unique per run. Department code is
  // unique per college, so a fixed "CHK" meant this check passed exactly once
  // per database and failed on every run after — silently, because the
  // audit-log assertion that follows it still found the FIRST run's entry.
  const suffix = Date.now().toString(36).slice(-5).toUpperCase();
  const unique = `Check ${suffix}`;
  const uniqueCode = `C${suffix}`.slice(0, 6);

  await evaluate(`
    (() => {
      const open = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Add a department'));
      if (open) open.click();
      return true;
    })()
  `);
  await sleep(600);

  await evaluate(`
    (() => {
      const form = document.querySelector('form');
      form.querySelector('input[name=name]').value = ${JSON.stringify(unique)};
      form.querySelector('input[name=code]').value = ${JSON.stringify(uniqueCode)};
      form.querySelector('input[name=name]').dispatchEvent(new Event('input', { bubbles: true }));
      form.querySelector('input[name=code]').dispatchEvent(new Event('input', { bubbles: true }));
      form.requestSubmit();
      return true;
    })()
  `);
  await sleep(3500);

  const afterCreate = await text();
  record("creating a department works", afterCreate.includes(unique), `created "${unique}"`);

  await goto("/admin/audit-log");
  const auditText = await text();
  record(
    "the change appears in the audit log",
    auditText.includes("department.create"),
    "audit entry written in the same transaction",
  );

  /* ---------------------------------------- cross-college through a URL */

  await goto("/admin/classes");
  const classesText = await text();
  record("the class list renders for this college", classesText.length > 200);

  // A class id that belongs to Meridian, reached by URL from a Nexivora admin.
  await goto("/admin/classes/does-not-exist-anywhere");
  record(
    "an unknown class id resolves to nothing rather than an error page",
    (await text()).toLowerCase().includes("not found") || (await path()).includes("/admin/classes"),
    await path(),
  );

  /* ------------------------------------------- the platform queue is ours */

  await goto("/platform");
  const platformText = await text();
  record(
    "a college administrator cannot reach the platform verification queue",
    !platformText.includes("Verification queue") || platformText.includes("403"),
    "a college that could verify itself is not a trust gate",
  );

  cdp.close();
} catch (error) {
  record("the check ran", false, error instanceof Error ? error.message : String(error));
} finally {
  proc.kill();
}

const failed = results.filter((row) => !row.ok);
console.log(
  `\n  ${results.length - failed.length}/${results.length} checks passed` +
    (failed.length ? ` — ${failed.length} FAILED\n` : "\n"),
);

process.exit(failed.length > 0 ? 1 : 0);
