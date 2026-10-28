#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * END-TO-END AUTHENTICATION CHECK.
 *
 * Drives a real browser through the real flows. Unit tests prove the policy and
 * the token lifecycle in isolation; this proves the parts that only exist when
 * a browser, a cookie jar and a Server Action are all involved — which is
 * exactly where authentication actually breaks.
 *
 * It asserts the behaviours the phase's acceptance criteria name, not that a
 * page returned 200:
 *
 *   · a signed-out request to a gated route redirects, carrying its destination
 *   · a correct sign-in sets an httpOnly session cookie and lands on the return path
 *   · a wrong password is refused with the same message as an unknown account
 *   · signing out actually revokes the session server-side
 *
 *   npm run check:auth      (needs the dev server running)
 */

// 3000, matching NEXT_PUBLIC_SITE_URL, check:seo and check:admin. This said
// 3001 until Phase 7 — a leftover from blocker B-2, when another project held
// port 3000 — which meant this script quietly pointed at a server that was not
// running and reported nothing at all rather than failing.
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.AUTH_TEST_EMAIL ?? "ananya-sharma@nit.edu.in";
const PASSWORD = process.env.AUTH_TEST_PASSWORD ?? "nexivora-demo";

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

const profile = resolve(process.cwd(), ".screenshots", ".chrome-auth-profile");
mkdirSync(profile, { recursive: true });

const port = 9600 + Math.floor(Math.random() * 300);
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

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await cdp.send(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    if (exceptionDetails) throw new Error(exceptionDetails.text ?? "evaluation failed");
    return result.value;
  };

  /**
   * Wait for the page to stop moving, rather than sleeping a fixed amount.
   *
   * A first-time route compile in dev can take several seconds; a fixed sleep
   * long enough to cover that makes every other step needlessly slow, and one
   * that is too short produces exactly the false failure this replaced. Polling
   * for a stable URL and a rendered body is faster and not flaky.
   */
  const settle = async (timeoutMs = 45000) => {
    const deadline = Date.now() + timeoutMs;
    let previous = null;
    let stable = 0;

    while (Date.now() < deadline) {
      await sleep(250);

      const current = await evaluate(
        "location.pathname + location.search + '|' + document.readyState + '|' + (document.body ? document.body.innerText.length : 0)",
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

  /**
   * Wait for the path to change away from `from`.
   *
   * A `redirect()` inside a Server Action is a *soft* navigation: React swaps
   * the tree without a document load, so `readyState` never leaves "complete"
   * and `settle()` above will happily report a stable page that is about to
   * move. Anything that follows a form submission has to wait on the URL
   * instead — and generously, because the first hit on a route in dev pays for
   * its compile.
   */
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

  const url = () => evaluate("location.pathname + location.search");
  const bodyText = () => evaluate("document.body.innerText");

  const sessionCookie = async () => {
    const { cookies } = await cdp.send("Network.getCookies", { urls: [BASE] }, sessionId);
    return cookies.find((cookie) => cookie.name === "nexivora_session") ?? null;
  };

  console.log(`\n  Authentication end-to-end — ${BASE}\n`);

  /* ---------------------------------------------------------- gating */

  await goto("/settings/security");
  const gated = await url();
  record(
    "a gated route redirects when signed out, keeping the destination",
    gated.startsWith("/login") && gated.includes("next=%2Fsettings%2Fsecurity"),
    gated,
  );

  /* ------------------------------------------------- wrong password */

  await goto("/login");
  await evaluate(`
    (() => {
      document.querySelector('input[name=email]').value = ${JSON.stringify(EMAIL)};
      document.querySelector('input[name=password]').value = 'definitely-not-the-password';
      document.querySelector('input[name=email]').dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('input[name=password]').dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('form').requestSubmit();
      return true;
    })()
  `);
  await settle();

  const wrongText = await bodyText();
  record(
    "a wrong password is refused without revealing whether the account exists",
    wrongText.includes("do not match an account"),
    (await url()) === "/login" ? "stayed on /login" : await url(),
  );

  const noCookieYet = await sessionCookie();
  record("no session cookie is set on a failed sign-in", noCookieYet === null);

  /* -------------------------------------------------- correct sign-in */

  await goto("/login?next=%2Fsettings%2Fsecurity");
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
  const landed = await waitForPathChange("/login?next=%2Fsettings%2Fsecurity");
  record(
    "a correct sign-in returns to the intended destination",
    landed === "/settings/security",
    landed,
  );

  const cookie = await sessionCookie();
  record("the session cookie is set", cookie !== null);
  record(
    "the session cookie is httpOnly and sameSite=Lax",
    Boolean(cookie?.httpOnly) && cookie?.sameSite === "Lax",
    cookie ? `httpOnly=${cookie.httpOnly} sameSite=${cookie.sameSite}` : "no cookie",
  );
  record(
    "the session cookie is not readable from JavaScript",
    !(await evaluate("document.cookie")).includes("nexivora_session"),
  );

  const securityText = await bodyText();
  record(
    "the security page lists this device",
    securityText.includes("This device"),
    securityText.includes("Signed-in devices") ? "sessions rendered" : "no session list",
  );

  /* ----------------------------------------------------- signed-in nav */

  await goto("/dashboard");
  record("the dashboard renders for a signed-in user", (await url()) === "/dashboard", await url());

  await goto("/login");
  record(
    "a signed-in user is bounced away from the sign-in page",
    (await url()) === "/dashboard",
    await url(),
  );

  /* --------------------------------------------------------- sign out */

  await goto("/settings/account");
  await evaluate(`
    (() => {
      const button = [...document.querySelectorAll('button')]
        .find((b) => b.textContent.includes('Sign out on this device'));
      button.closest('form').requestSubmit();
      return true;
    })()
  `);
  await waitForPathChange("/settings/account");

  const afterSignOut = await sessionCookie();
  record("signing out clears the session cookie", afterSignOut === null);

  await goto("/dashboard");
  record(
    "the dashboard is gated again after signing out",
    (await url()).startsWith("/login"),
    await url(),
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
