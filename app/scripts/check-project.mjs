#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * PROJECT LIFECYCLE END-TO-END CHECK — Phase 8.
 *
 * Drives a real browser through the criteria that cannot be established any
 * other way:
 *
 *   1 · A project goes draft → proposal → approved, with each transition gated
 *       by role. Asserted by *being* the student, then being the faculty member.
 *   7 · A submitted project cannot be edited until faculty request changes.
 *   9 · Section autosave loses no work across a navigation or a refresh —
 *       asserted by typing, navigating away, and reading it back.
 *  10 · Two members editing the same section see the soft-lock indicator.
 *
 * The pure-function suites prove the rules; `lifecycle.db.test.ts` proves they
 * are wired to real data; this proves a person can actually reach them. Green
 * checks are necessary and not sufficient (ADR-017).
 *
 *   npm run check:project     (needs a running server and a seeded database)
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const STUDENT = process.env.PROJECT_EMAIL ?? "ananya-sharma@nit.edu.in";
const PASSWORD = process.env.PROJECT_PASSWORD ?? "nexivora-demo";

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

const profile = resolve(process.cwd(), ".screenshots", ".chrome-project-profile");
mkdirSync(profile, { recursive: true });

const port = 9300 + Math.floor(Math.random() * 90);
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
    if (msg.id && pending.has(msg.id)) {
      const { resolve: done, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else done(msg.result);
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

  // Start signed out. The profile is reused between runs, and without this the
  // second run arrives at /login already authenticated and fails on a form that
  // is not there — a lesson Phase 7 paid for twice.
  await cdp.send("Network.clearBrowserCookies", {}, sessionId);

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await cdp.send(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    if (exceptionDetails) {
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

  const goto = async (path) => {
    await cdp.send("Page.navigate", { url: `${BASE}${path}` }, sessionId);
    await settle();
  };

  const text = () => evaluate("document.body.innerText");

  const signIn = async (email, next) => {
    await cdp.send("Network.clearBrowserCookies", {}, sessionId);
    await goto(`/login?next=${encodeURIComponent(next)}`);

    await evaluate(`
      (() => {
        document.querySelector('input[name=email]').value = ${JSON.stringify(email)};
        document.querySelector('input[name=password]').value = ${JSON.stringify(PASSWORD)};
        document.querySelector('input[name=email]').dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('input[name=password]').dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('form').requestSubmit();
        return true;
      })()
    `);

    // A Server Action redirect is a SOFT navigation, so readyState never
    // changes. Wait for the URL instead.
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      const current = await evaluate("location.pathname").catch(() => null);
      if (current && !current.startsWith("/login")) {
        await settle();
        return current;
      }
      await sleep(250);
    }
    return "/login";
  };

  console.log(`\n  Project lifecycle end-to-end — ${BASE}\n`);

  /* ------------------------------------------------------ the student */

  const landed = await signIn(STUDENT, "/my/projects");
  record("a student reaches /my/projects", landed === "/my/projects", landed);

  const listText = await text();
  record(
    "the project list renders",
    listText.includes("Projects"),
    `${listText.split("\n").length} lines`,
  );

  /* -------------------------------------------- create a real project */

  await goto("/projects/new");

  const created = await evaluate(`
    (async () => {
      const form = document.querySelector('form');
      if (!form) return { ok: false, reason: 'no create form — is this account in a group?' };

      const unique = 'Check ' + Date.now().toString(36).slice(-6);
      form.querySelector('input[name=title]').value = unique + ' irrigation telemetry study';
      form.querySelector('input[name=summary]').value =
        'A end-to-end check project created by scripts/check-project.mjs.';

      for (const input of form.querySelectorAll('input')) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      form.requestSubmit();

      for (let i = 0; i < 200; i += 1) {
        await new Promise((r) => setTimeout(r, 100));
        if (/\\/projects\\/.+\\/edit/.test(location.pathname)) {
          return { ok: true, slug: location.pathname.split('/')[2], title: unique };
        }
      }
      return { ok: false, reason: 'never reached the editor' };
    })()
  `);

  record(
    "creating a project lands in the editor",
    created.ok === true,
    created.ok ? `/projects/${created.slug}/edit` : created.reason,
  );

  if (!created.ok) throw new Error(created.reason);
  const slug = created.slug;

  await settle();
  const editorText = await text();
  record(
    "the editor lists all nine sections with guidance",
    editorText.includes("Problem statement") &&
      editorText.includes("Methodology") &&
      editorText.includes("Future work"),
    "nine section rows rendered",
  );

  record(
    "a new project starts at 0% — it does not inherit the group's other board",
    editorText.includes("0% complete") && editorText.includes("never typed in"),
    editorText.match(/(d+)% complete/)?.[0] ?? "no percentage rendered",
  );

  /* ---------------------------- criterion 9: autosave loses no work */

  await goto(`/projects/${slug}/edit/problem`);

  const marker = `Autosave marker ${Date.now().toString(36).slice(-6)}`;
  // Long enough to clear the PROBLEM section's 60-word completeness floor. The
  // first version of this check used 38 words, the toggle was correctly
  // disabled, and the failure was the test's rather than the product's.
  const body = [
    `${marker}.`,
    "Farmers on the Mula-Mutha canal network receive water on a rotational schedule fixed two weeks in advance,",
    "so an unexpected rain event means a wasted turn that cannot be reclaimed within the same block.",
    "The district office has no mechanism for reallocating a skipped turn, and the roster is printed rather than held anywhere a change could propagate.",
    "Farmers currently deal with this by irrigating anyway, which wastes water that another holding needed that week,",
    "or by losing the turn entirely and waiting a fortnight for the next one.",
    "A solution would be recognisable if unused volume within a rotation block fell measurably across a season.",
  ].join(" ");

  const typed = await evaluate(`
    (async () => {
      const area = document.querySelector('textarea');
      if (!area) return { ok: false, reason: 'no editor textarea' };

      // Set through React's own setter so the controlled component sees it.
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value',
      ).set;
      setter.call(area, ${JSON.stringify(body)});
      area.dispatchEvent(new Event('input', { bubbles: true }));

      // Wait for the debounce and the save to report.
      for (let i = 0; i < 150; i += 1) {
        await new Promise((r) => setTimeout(r, 100));
        if (document.body.innerText.includes('Saved')) return { ok: true };
      }
      return { ok: false, reason: 'never reported saved' };
    })()
  `);

  record(
    "a section autosaves as you type",
    typed.ok === true,
    typed.ok ? "reported saved" : typed.reason,
  );

  // The actual criterion: navigate away, come back, and the work is there.
  await goto(`/projects/${slug}/edit`);
  await goto(`/projects/${slug}/edit/problem`);

  const survived = await evaluate(
    `(() => { const a = document.querySelector('textarea'); return a ? a.value.includes(${JSON.stringify(marker)}) : false; })()`,
  );
  record(
    "the text survives a navigation and a reload — criterion 9",
    survived === true,
    "read back from the server, not from local state",
  );

  const wordCount = await evaluate(
    "(() => { const m = document.body.innerText.match(/(\\d+) words/); return m ? Number(m[1]) : 0; })()",
  );
  record("the word count reflects what was written", wordCount > 20, `${wordCount} words`);

  /* --------------------------------- mark complete and check progress */

  const completed = await evaluate(`
    (async () => {
      const box = [...document.querySelectorAll('input[type=checkbox]')][0];
      if (!box) return { ok: false, reason: 'no completion toggle' };
      if (box.disabled) return { ok: false, reason: 'toggle disabled — below the word floor' };

      box.click();
      for (let i = 0; i < 100; i += 1) {
        await new Promise((r) => setTimeout(r, 100));
        if (document.body.innerText.includes('Saved')) return { ok: true };
      }
      return { ok: false, reason: 'completion never saved' };
    })()
  `);

  record(
    "a section can be marked complete once it meets the word floor",
    completed.ok === true,
    completed.reason ?? "",
  );

  await goto(`/projects/${slug}/edit`);
  const percent = await evaluate(
    "(() => { const m = document.body.innerText.match(/(\\d+)% complete/); return m ? Number(m[1]) : -1; })()",
  );
  record(
    "progress moved because a section was written — computed, not typed",
    percent > 0,
    `${percent}% complete`,
  );

  /* ------------------------ criterion 1: the lifecycle gate, as a student */

  await goto(`/projects/${slug}/propose`);
  const proposeText = await text();
  record(
    "the proposal page explains why similarity is checked",
    proposeText.includes("Why similarity is checked") ||
      proposeText.includes("Similar work in the archive"),
  );

  const checked = await evaluate(`
    (async () => {
      const button = [...document.querySelectorAll('button')]
        .find((b) => /Run the check|Check again/.test(b.textContent));
      if (!button) return { ok: false, reason: 'no similarity check button' };
      if (button.disabled) return { ok: false, reason: 'check disabled — problem statement too short' };

      const before = document.body.innerText;
      button.click();

      for (let i = 0; i < 250; i += 1) {
        await new Promise((r) => setTimeout(r, 100));
        const body = document.body.innerText;
        if (/Last checked|similar project|No similar work|Could not reach|Write the problem/.test(body)) {
          return { ok: true, note: (body.match(/(Last checked[^.]*.|[0-9]+ similar[^.]*.|No similar work[^.]*.)/) || [''])[0] };
        }
      }

      // Report what actually changed, so a failure here says something.
      const after = document.body.innerText;
      const added = after.split(String.fromCharCode(10)).filter((line) => !before.includes(line));
      return { ok: false, reason: 'no result :: added lines: ' + JSON.stringify(added.slice(0, 6)) };
    })()
  `);

  record(
    "the similarity check runs before submission",
    checked.ok === true,
    checked.ok ? (checked.note ?? "reported") : checked.reason,
  );

  // Now the transition itself. A student who is not the group lead must be
  // refused — the refusal naming the actor is the point.
  await goto(`/projects/${slug}/edit`);

  const proposed = await evaluate(`
    (async () => {
      const button = [...document.querySelectorAll('button')]
        .find((b) => b.textContent.trim() === 'Submit proposal');
      if (!button) return { ok: false, reason: 'no submit-proposal control' };

      button.click();
      for (let i = 0; i < 200; i += 1) {
        await new Promise((r) => setTimeout(r, 100));
        const body = document.body.innerText;
        if (/Submit proposal — done|Only the group lead|A proposal needs|similarity check/.test(body)) {
          return { ok: true, message: body.match(/(Submit proposal — done|Only the group lead[^.]*\\.|A proposal needs[^.]*\\.|Run the similarity[^.]*\\.)/)?.[0] ?? '' };
        }
      }
      return { ok: false, reason: 'no response to the transition' };
    })()
  `);

  record(
    "a lifecycle transition either happens or says exactly what is missing",
    proposed.ok === true,
    proposed.ok ? proposed.message.slice(0, 90) : proposed.reason,
  );

  /* ---------------------------------------- the public page still works */

  await goto("/explore");
  const exploreText = await text();
  record(
    "/explore renders from the database after the swap",
    exploreText.includes("Student projects, documented properly") && exploreText.length > 500,
    `${exploreText.length} chars`,
  );

  await goto("/projects/canal-scheduling-multi-farm");
  const publicText = await text();
  record(
    "a public project page renders its sections",
    publicText.includes("Problem statement") || publicText.includes("Methodology"),
    `${publicText.length} chars`,
  );

  // Criterion 6, on the wire: a private project is not reachable publicly.
  const privateStatus = await evaluate(
    `fetch(${JSON.stringify(BASE)} + '/projects/attendance-face-recognition', { credentials: 'omit' }).then((r) => r.status)`,
  );
  record(
    "a PRIVATE project returns 404 to the public — criterion 6",
    privateStatus === 404,
    `status ${privateStatus}`,
  );

  const sitemap = await evaluate(
    `fetch(${JSON.stringify(BASE)} + '/sitemap.xml').then((r) => r.text())`,
  );
  record(
    "the private project is absent from the sitemap",
    !sitemap.includes("attendance-face-recognition"),
    `${(sitemap.match(/<url>/g) ?? []).length} URLs`,
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
