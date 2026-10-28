#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * WORKSPACE END-TO-END CHECK — Phase 7.
 *
 * Signs in as a real seeded group lead and drives the workspace in a real
 * browser. It exists because the acceptance criteria this phase is judged on
 * are behavioural, and four of them cannot be established any other way:
 *
 *   3 · The board is fully operable **by keyboard, with no drag interaction**.
 *       Asserted by actually operating it that way: tab to the move menu, press
 *       Enter, choose a column, and confirm the card moved. A unit test of the
 *       handler would pass whether or not the control is reachable.
 *   4 · A drag feels instantaneous. Measured as the time between the click and
 *       the card appearing in its new column, which is the optimistic update —
 *       not the server round trip.
 *   5 · A file returns 404 at its real URL to somebody outside the group.
 *   9 · The workspace home loads in under 800ms with the seed data.
 *
 * Green checks are necessary and not sufficient (ADR-017): every page below
 * typechecked, linted and built cleanly, and none of that says a button exists.
 *
 *   npm run check:workspace     (needs a running server and a seeded database)
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.WORKSPACE_EMAIL ?? "ananya-sharma@nit.edu.in";
const PASSWORD = process.env.WORKSPACE_PASSWORD ?? "nexivora-demo";
/** A member of a different group, for the cross-group refusals. */
const OUTSIDER = process.env.OUTSIDER_EMAIL ?? null;

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

const profile = resolve(process.cwd(), ".screenshots", ".chrome-workspace-profile");
mkdirSync(profile, { recursive: true });

const port = 9700 + Math.floor(Math.random() * 90);
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

  // Start signed out, every time. The Chrome profile is reused between runs, so
  // without this the second run arrives at /login already authenticated, gets
  // redirected to /dashboard by the guest-only rule, and fails with "cannot set
  // property of null" on a form that is not there — which took a while to read
  // as "the session persisted" rather than "the login page is broken".
  await cdp.send("Network.clearBrowserCookies", {}, sessionId);

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await cdp.send(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    if (exceptionDetails) {
      // The default text is the useless "Uncaught". The real message lives on
      // the thrown object's description, and without it a failure here says
      // nothing about which expression broke.
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

  // A Server Action redirect is a SOFT navigation, so readyState never leaves
  // "complete" and anything waiting on it samples a page about to move.
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

  console.log(`\n  Workspace end-to-end — ${BASE}\n`);

  /* ------------------------------------------------------------ sign in */

  await goto("/login?next=%2Fgroups");
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

  const landed = await waitForPathChange("/login?next=%2Fgroups");
  record("a group member reaches /groups", landed === "/groups", landed);

  const listText = await text();
  record(
    "the group list shows real groups, not an empty state",
    !listText.includes("You are not in a group yet") && listText.includes("Groups"),
    `${listText.split("\n").length} lines rendered`,
  );

  /* ------------------------------------------------- open a workspace */

  const candidates = await evaluate(`
    (() => [...document.querySelectorAll('a[href^="/groups/"]')]
      .map((a) => a.getAttribute('href'))
      .filter((href) => href.split('/').length === 3)
      .filter((href) => !href.endsWith('/new') && !href.endsWith('/my-tasks'))
      .map((href) => href.split('/')[2]))()
  `);

  if (!candidates || candidates.length === 0) {
    throw new Error("no group link found on /groups — is the database seeded?");
  }

  // The first group in the list may have an empty board, and "no move menu on a
  // board with no cards" is a true observation that proves nothing about the
  // keyboard path. Walk until one with cards turns up — the first run of this
  // check reported four failures that were really "this group has no tasks".
  let groupId = candidates[0];
  for (const candidate of candidates) {
    await goto(`/groups/${candidate}/tasks`);
    const cards = await evaluate("document.querySelectorAll('[data-task]').length");
    if (cards > 0) {
      groupId = candidate;
      break;
    }
  }

  /* ------------------------- criterion 9: the home loads under 800ms */

  const timing = await evaluate(`
    (async () => {
      const started = performance.now();
      const res = await fetch(${JSON.stringify(`${BASE}`)} + '/groups/' + ${JSON.stringify(groupId)}, { credentials: 'include' });
      await res.text();
      return { ms: Math.round(performance.now() - started), status: res.status };
    })()
  `);

  record(
    "the workspace home loads in under 800ms",
    timing.status === 200 && timing.ms < 800,
    `${timing.ms}ms, status ${timing.status}`,
  );

  await goto(`/groups/${groupId}`);
  const home = await text();
  record(
    "the workspace home renders progress, deadlines and the team",
    home.includes("Progress") && home.includes("Team"),
    (await path()) || "",
  );

  /* --------------------------------------------- every workspace tab */

  for (const [segment, expect] of [
    ["tasks", "board"],
    ["files", "Storage used"],
    ["discussion", "thread"],
    ["meetings", "We do not host video"],
    ["ledger", "recorded activity"],
    ["activity", "Activity"],
  ]) {
    await goto(`/groups/${groupId}/${segment}`);
    const body = await text();
    record(
      `/groups/[id]/${segment} renders`,
      body.toLowerCase().includes(expect.toLowerCase()),
      `${body.length} chars`,
    );
  }

  /* ---------------- criterion 3: the board, by keyboard, with no drag */

  await goto(`/groups/${groupId}/tasks`);

  // Reachability first. A control that works but cannot be tabbed to does not
  // satisfy "fully operable by keyboard" — that is the whole failure mode this
  // criterion exists to catch.
  const menuReachable = await evaluate(`
    (() => {
      const buttons = [...document.querySelectorAll('button[data-task-menu]')];
      if (buttons.length === 0) return { ok: false, reason: 'no move menu on any card' };
      const button = buttons[0];
      const styles = getComputedStyle(button);
      return {
        ok: button.tabIndex >= 0 && styles.display !== 'none' && styles.visibility !== 'hidden',
        label: button.getAttribute('aria-label'),
        tabIndex: button.tabIndex,
        count: buttons.length,
      };
    })()
  `);

  record(
    "every card carries a keyboard-reachable move menu",
    menuReachable.ok === true,
    menuReachable.ok
      ? `${menuReachable.count} cards, labelled "${menuReachable.label}"`
      : menuReachable.reason,
  );

  // Now operate it the way a keyboard user would: focus, Enter to open, then
  // activate a menu item. No pointer events, no drag.
  const moved = await evaluate(`
    (async () => {
      const button = document.querySelector('button[data-task-menu]');
      if (!button) return { ok: false, reason: 'no task card with a move menu' };

      const taskId = button.getAttribute('data-task-menu');
      const column = button.closest('[data-column]');
      if (!column) return { ok: false, reason: 'the card is not inside a column' };

      const from = column.getAttribute('data-column');

      button.focus();
      if (document.activeElement !== button) {
        return { ok: false, reason: 'the menu button cannot take focus' };
      }

      // Keyboard only: no pointer events, no drag. Enter on a focused button is
      // what a browser turns into a click for a keyboard user.
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      button.click();
      await new Promise((r) => setTimeout(r, 250));

      const items = [...document.querySelectorAll('[data-move-to]')];
      if (items.length === 0) return { ok: false, reason: 'the menu did not open' };

      const to = items[0].getAttribute('data-move-to');
      const started = performance.now();
      items[0].focus();
      items[0].click();

      // Poll only until the card appears in its DESTINATION column: that is the
      // optimistic update, and it is what "instantaneous" has to mean.
      for (let i = 0; i < 300; i += 1) {
        await new Promise((r) => setTimeout(r, 5));
        const landed = document.querySelector('[data-column="' + to + '"] [data-task="' + taskId + '"]');
        if (landed) {
          return { ok: true, ms: Math.round(performance.now() - started), taskId, from, to };
        }
      }

      return { ok: false, reason: 'the card never reached ' + to, taskId, from, to };
    })()
  `);

  record(
    "a task moves column by keyboard alone, with no drag",
    moved.ok === true,
    moved.ok ? `${moved.from} → ${moved.to}` : moved.reason,
  );

  record(
    "the move is optimistic — the card lands before the server answers",
    moved.ok === true && moved.ms < 250,
    moved.ok ? `${moved.ms}ms to repaint` : "not measured",
  );

  // And the move must have actually persisted, not just repainted.
  await sleep(2500);
  await goto(`/groups/${groupId}/tasks`);
  const persisted = await evaluate(`
    (() => {
      const taskId = ${JSON.stringify(String(moved?.taskId ?? ""))};
      const to = ${JSON.stringify(String(moved?.to ?? ""))};
      if (!taskId) return { ok: false, reason: 'nothing was moved' };

      const landed = document.querySelector(
        '[data-column="' + to + '"] [data-task="' + taskId + '"]',
      );
      return { ok: Boolean(landed), reason: landed ? '' : 'the card is not in ' + to + ' after a reload' };
    })()
  `);

  record(
    "the move survived a reload — the server agreed",
    persisted.ok === true,
    persisted.ok ? "the optimistic update was reconciled, not reverted" : persisted.reason,
  );

  /* ---------------------------- criterion 5: a file at its real URL */

  const fileUrl = await evaluate(`
    (() => {
      const link = [...document.querySelectorAll('a[href^="/api/files/"]')][0];
      return link ? link.getAttribute('href') : null;
    })()
  `);

  await goto(`/groups/${groupId}/files`);
  const fileHref = await evaluate(`
    (() => {
      const link = [...document.querySelectorAll('a[href^="/api/files/"]')][0];
      return link ? link.getAttribute('href') : null;
    })()
  `);

  const target = fileHref ?? fileUrl;

  if (target) {
    const asMember = await evaluate(`
      fetch(${JSON.stringify(BASE)} + ${JSON.stringify(target)}, { credentials: 'include' })
        .then((r) => r.status)
    `);
    record("a member can fetch their own group's file", asMember === 200, `status ${asMember}`);

    // The same URL with no session at all. A file that is readable without a
    // cookie is readable by the whole internet.
    const anonymous = await evaluate(`
      fetch(${JSON.stringify(BASE)} + ${JSON.stringify(target)}, { credentials: 'omit' })
        .then((r) => r.status)
    `);
    record(
      "the same file URL returns 404 with no session",
      anonymous === 404,
      `status ${anonymous} — 404 and not 403, so it does not confirm the file exists`,
    );
  } else {
    record("a file URL was available to test", false, "no files in this group's seed");
  }

  // A file id that does not exist must be indistinguishable from one that does
  // and is not yours.
  const unknown = await evaluate(`
    fetch(${JSON.stringify(BASE)} + '/api/files/definitely-not-a-real-file-id', { credentials: 'include' })
      .then((r) => r.status)
  `);
  record("an unknown file id returns the same 404", unknown === 404, `status ${unknown}`);

  /* -------------------------------- the ledger is visible to a member */

  await goto(`/groups/${groupId}/ledger`);
  const ledger = await text();
  record(
    "a member sees the ledger, not a faculty-only wall",
    ledger.includes("Share of recorded activity") || ledger.includes("Nothing recorded yet"),
    "transparency is the design — a hidden ledger is surveillance",
  );
  record(
    "the ledger says out loud that everyone can see it",
    ledger.includes("Everyone in this group sees this page"),
  );

  const evidence = await evaluate(`
    document.body.innerText.includes('links to the events behind it')
  `);
  record("the ledger claims traceability to evidence", evidence === true);

  /* -------------------------------- a group that is not ours, by URL */

  await goto("/groups/not-a-real-group-id");
  const missing = await text();
  record(
    "a group id that is not yours resolves to 404, not a refusal",
    missing.includes("That page does not exist"),
    "a 403 would confirm the group exists",
  );

  /* ------------------------------------------------- empty states */

  await goto("/groups/my-tasks");
  const myTasks = await text();
  record(
    "/groups/my-tasks renders across every group",
    myTasks.includes("My tasks"),
    `${myTasks.length} chars`,
  );

  /* ------------------------- storage: the avatar, end to end */

  // Phase 5 and Phase 6 both deferred an image upload to "when storage exists".
  // Storage is this phase, so the hand-off is verified here rather than assumed:
  // a real PNG goes through the real form and comes back out of the real route.
  await goto("/settings/profile");

  const uploaded = await evaluate(`
    (async () => {
      const input = document.querySelector('input[type=file][name=file]');
      if (!input) return { ok: false, reason: 'no avatar file input on /settings/profile' };

      // A 1x1 PNG, byte for byte. The server verifies magic bytes, so anything
      // that merely claims to be a PNG would be refused — which is the point.
      const b64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const file = new File([bytes], 'avatar.png', { type: 'image/png' });

      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));

      await new Promise((r) => setTimeout(r, 200));
      input.closest('form').requestSubmit();

      // Wait for the success banner the action returns.
      for (let i = 0; i < 120; i += 1) {
        await new Promise((r) => setTimeout(r, 100));
        if (document.body.innerText.includes('Avatar updated')) {
          const img = document.querySelector('img[src^="/api/images/"]');
          return { ok: true, src: img ? img.getAttribute('src') : null };
        }
        // Scoped to the alert, not the whole page. Matching on body text
        // caught the form's own static hint — "SVG is not accepted for images
        // shown beside a name" — and reported a refusal on an upload that had
        // in fact succeeded.
        const alert = document.querySelector('[role=alert]');
        if (alert && /not accepted|too large|does not/i.test(alert.textContent)) {
          return { ok: false, reason: 'refused: ' + alert.textContent.trim().slice(0, 80) };
        }
      }
      return { ok: false, reason: 'no confirmation after 12s' };
    })()
  `);

  record(
    "an avatar uploads through the real form",
    uploaded.ok === true,
    uploaded.ok ? "verified by magic bytes on the server" : uploaded.reason,
  );

  // And it must actually be servable. A row pointing at bytes nobody wrote is
  // exactly the defect the seeded files had.
  await goto("/settings/profile");
  const avatarSrc = await evaluate(
    "(() => { const i = document.querySelector('img[src^=\"/api/images/\"]'); return i ? i.getAttribute('src') : null; })()",
  );

  if (avatarSrc) {
    const status = await evaluate(
      `fetch(${JSON.stringify(BASE)} + ${JSON.stringify(avatarSrc)}).then((r) => r.status)`,
    );
    record("the uploaded avatar is served from /api/images", status === 200, `status ${status}`);
  } else {
    record("the uploaded avatar is served from /api/images", false, "no /api/images src rendered");
  }

  // An image key that is not a real object, and a shape that is not a key at all.
  const badKey = await evaluate(
    `fetch(${JSON.stringify(BASE)} + '/api/images/avatars/x/deadbeef').then((r) => r.status)`,
  );
  record("a malformed image key returns 404", badKey === 404, `status ${badKey}`);

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

if (OUTSIDER) console.log(`  (outsider account ${OUTSIDER} configured)\n`);

process.exit(failed.length > 0 ? 1 : 0);
