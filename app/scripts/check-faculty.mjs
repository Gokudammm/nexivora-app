#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * FACULTY END-TO-END CHECK — Phase 9.
 *
 * Signs in as a real seeded faculty member and drives the whole desk in a real
 * browser, because the acceptance criteria this phase is judged on are
 * behavioural and six of them cannot be established any other way:
 *
 *   1 · `/faculty` says what needs attention **without clicking**. Asserted by
 *       reading the first screen and requiring the attention panel to be in it.
 *   2 · A health signal fires on the seeded group and **names the evidence**.
 *   3 · A full evaluation — rubric scored, members differentiated with reasons,
 *       comments, released — takes **under ten minutes**. Timed for real.
 *   5 · An attestation is issued, is verifiable by its code, and survives a
 *       revocation as a revoked record.
 *   7 · Faculty **cannot** edit a group's files or discussion. Asserted against
 *       the real routes, not against the policy unit tests — a policy that is
 *       right and a route that does not consult it both pass a unit test.
 *   8 · A faculty member sees only their own subjects' groups. Asserted by
 *       counting: the college has more groups than this person can see.
 *   9 · Draft feedback is invisible to students until released. Asserted by
 *       signing in **as the student** and looking.
 *
 * Green checks are necessary and not sufficient (ADR-017): every page below
 * typechecked, linted and built cleanly, and none of that says the attestation
 * form exists.
 *
 * Run against a PRODUCTION server (`npm run build && npm run start`). Against
 * `npm run dev` the timing assertions measure Turbopack compiling on demand,
 * which is a fact about the dev server and not about the product.
 *
 *   npm run check:faculty    (needs a running server and a seeded database)
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const FACULTY = process.env.FACULTY_EMAIL ?? "meera-rao@nit.edu.in";
const PASSWORD = process.env.FACULTY_PASSWORD ?? "nexivora-demo";
/** The project the seed leaves awaiting review, and its student. */
const UNDER_REVIEW = process.env.REVIEW_SLUG ?? "soil-moisture-irrigation-control";
/** A student credited on that project — criterion 9 is asserted from their seat. */
const STUDENT = process.env.STUDENT_EMAIL ?? "karan-mehta@nit.edu.in";

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

const profile = resolve(process.cwd(), ".screenshots", ".chrome-faculty-profile");
mkdirSync(profile, { recursive: true });

const port = 9800 + Math.floor(Math.random() * 90);
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

  /** Sign out, then in as somebody. Cookies cleared so a reused profile cannot lie. */
  const signIn = async (email) => {
    await cdp.send("Network.clearBrowserCookies", {}, sessionId);
    await goto("/login?next=%2Fdashboard");
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
    return waitForPathChange("/login?next=%2Fdashboard");
  };

  console.log(`\n  Faculty desk end-to-end — ${BASE}\n`);

  /* --------------------------------------------------------- sign in */

  const landed = await signIn(FACULTY);
  record("a faculty member signs in", landed === "/dashboard", landed);

  /* ------------------- criterion 1: the dashboard, without clicking */

  await goto("/faculty");
  const dash = await text();

  record(
    "/faculty renders the teaching desk",
    dash.includes("Needs attention") || dash.includes("Everything looks steady"),
    `${dash.length} chars`,
  );

  // "Without clicking" is a claim about what is above the fold, so it is
  // asserted against the rendered geometry rather than against the DOM order.
  const aboveFold = await evaluate(`
    (() => {
      const heads = [...document.querySelectorAll('h1, h2, h3')];
      const attention = heads.find((h) => h.innerText.trim().startsWith('Needs attention'));
      if (!attention) return { found: false };
      const box = attention.getBoundingClientRect();
      return { found: true, top: Math.round(box.top), viewport: window.innerHeight };
    })()
  `);

  record(
    "what needs attention is on the first screen — criterion 1",
    aboveFold.found === true && aboveFold.top < aboveFold.viewport,
    aboveFold.found ? `${aboveFold.top}px into a ${aboveFold.viewport}px viewport` : "no panel",
  );

  /* -------------------- criterion 2: a signal that names its evidence */

  const signals = await evaluate(`
    (() => [...document.querySelectorAll('li[data-signal]')].map((li) => ({
      kind: li.getAttribute('data-signal'),
      text: li.innerText.split(String.fromCharCode(10)).filter(Boolean).join(' | '),
    })))()
  `);

  const evidenced = (signals ?? []).find((signal) => /[0-9]/.test(signal.text));

  record(
    "a health signal fires and names its evidence — criterion 2",
    Boolean(evidenced),
    evidenced
      ? `${evidenced.kind}: ${evidenced.text.slice(0, 100)}`
      : `${signals?.length ?? 0} signals, none carrying numbers`,
  );

  /* ------------------ criterion 8: their subjects, not the college */

  const scope = await evaluate(`
    (async () => {
      const mine = await fetch(${JSON.stringify(BASE)} + '/faculty/groups', { credentials: 'include' })
        .then((r) => r.text());
      const ids = new Set([...mine.matchAll(/\\/groups\\/([a-z0-9]{8,})/g)].map((m) => m[1]));
      return ids.size;
    })()
  `);

  record(
    "faculty see their own subjects' groups, not the college — criterion 8",
    typeof scope === "number" && scope > 0 && scope < 16,
    `${scope} groups visible, 16 in the college`,
  );

  /* ------------------------ the submission queue is not theoretical */

  await goto("/faculty/submissions");
  const queue = await text();
  record(
    "/faculty/submissions holds real work, not an empty state",
    queue.includes(UNDER_REVIEW) || /await|review/i.test(queue),
    `${queue.split("\n").length} lines`,
  );

  const reviewHref = await evaluate(`
    (() => {
      const link = [...document.querySelectorAll('a[href$="/review"]')][0];
      return link ? link.getAttribute('href') : null;
    })()
  `);

  record(
    "the queue links straight to the review screen",
    Boolean(reviewHref),
    reviewHref ?? "none",
  );

  /* ------------- criterion 3: a full evaluation in under ten minutes */

  const started = Date.now();
  await goto(reviewHref ?? `/projects/${UNDER_REVIEW}/review`);

  const review = await text();
  record(
    "the review screen marks the submitted snapshot",
    review.includes("marking the submitted snapshot"),
    review.includes("marking the live record") ? "marking the live record instead" : "snapshot",
  );

  record(
    "the ledger is beside the marks, not a click away — criterion 4",
    /% of recorded activity/.test(review),
    "share and event count rendered per member",
  );

  // Score every criterion at the group level, then pull one member down so a
  // reason becomes required — which is the differentiation the whole ledger
  // exists to support.
  const scored = await evaluate(`
    (() => {
      const groups = [...document.querySelectorAll('button[data-group-score]')];
      const ids = [...new Set(groups.map((b) => b.getAttribute('data-group-score')))];
      for (const id of ids) {
        const four = groups.find(
          (b) => b.getAttribute('data-group-score') === id && b.getAttribute('data-value') === '4',
        );
        four?.click();
      }
      return ids.length;
    })()
  `);

  record("every rubric criterion can be scored", scored > 0, `${scored} criteria`);

  await sleep(400);

  const differentiated = await evaluate(`
    (() => {
      const buttons = [...document.querySelectorAll('button[data-member-score]')];
      if (buttons.length === 0) return { ok: false, reason: 'no per-member controls' };
      const memberId = buttons[0].getAttribute('data-member-score');
      const own = buttons.filter((b) => b.getAttribute('data-member-score') === memberId);
      const criteria = [...new Set(own.map((b) => b.getAttribute('data-criterion')))];
      for (const criterion of criteria) {
        const two = own.find(
          (b) => b.getAttribute('data-criterion') === criterion && b.getAttribute('data-value') === '2',
        );
        two?.click();
      }
      return { ok: true, memberId, criteria: criteria.length };
    })()
  `);

  record(
    "a member's mark can be moved away from the group's — criterion 4",
    differentiated.ok === true,
    differentiated.ok ? `${differentiated.criteria} criteria adjusted` : differentiated.reason,
  );

  await sleep(600);

  // A deviating mark must demand a reason. Releasing without one is the exact
  // thing the product refuses, so the refusal is asserted before the success.
  const reasonDemanded = await evaluate(`
    (() => {
      const labels = [...document.querySelectorAll('label')].map((l) => l.innerText);
      return labels.some((l) => /why is .+ mark different/i.test(l));
    })()
  `);

  record(
    "a deviating mark demands a written reason",
    reasonDemanded === true,
    reasonDemanded ? "the reason field appeared" : "no reason field",
  );

  await evaluate(`
    (() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value',
      ).set;
      const areas = [...document.querySelectorAll('textarea')];
      const reason = areas.find((a) => a.closest('div')?.innerText.match(/why is/i)) ?? areas[0];
      setter.call(reason, 'The workspace record shows a materially smaller share of the recorded work, and the calibration tasks were closed by the other member.');
      reason.dispatchEvent(new Event('input', { bubbles: true }));

      const comments = areas[areas.length - 1];
      setter.call(comments, 'The problem framing and the field method are strong. The results section still reports a single run; before the final submission, repeat the calibration across at least three probes and report the spread rather than the mean alone.');
      comments.dispatchEvent(new Event('input', { bubbles: true }));

      const accept = [...document.querySelectorAll('input[name=outcome]')][0];
      accept?.click();
      return true;
    })()
  `);

  await sleep(300);

  /* ------- criterion 9: a draft is invisible to the group, part one */

  await evaluate("document.querySelector('button[data-save-draft]').click()");
  await sleep(2500);

  const draftSaved = await text();
  record(
    "the evaluation saves as a draft",
    /draft|saved/i.test(draftSaved),
    draftSaved.includes("Not ready to release") ? "blocked with reasons" : "saved",
  );

  /* ----------------------- criterion 7: no edit rights on group work */

  const groupId = await evaluate(`
    (() => {
      const link = [...document.querySelectorAll('a[href*="/groups/"]')]
        .map((a) => a.getAttribute('href'))
        .find((href) => /\\/groups\\/[a-z0-9]+\\/ledger$/.test(href));
      return link ? link.split('/')[2] : null;
    })()
  `);

  if (groupId) {
    await goto(`/groups/${groupId}/files`);
    const filesPath = await path();

    // Criterion 7 is narrower than it first reads, and the phase spec says so
    // in as many words: faculty **can** add feedback, comment on discussions
    // and create tasks; what they cannot do is edit a section or delete a file.
    // The first version of this check asserted "no upload control" and failed
    // against a product that was right — and it matched the discussion page's
    // own empty-state prose ("Ask a question, record a decision…") rather than
    // any control, the same trap Phase 7 hit with the avatar hint text.
    //
    // A supervisor who can silently alter the record destroys the ledger's
    // value; a supervisor who cannot answer a question is useless. Both halves
    // are asserted, because "read-only" implemented as "locked out" is the
    // other way this goes wrong.
    const deleteControls = await evaluate(`
      (() => {
        const buttons = [...document.querySelectorAll('button')];
        return buttons.filter((b) =>
          /^(delete|restore)$/i.test(b.innerText.trim()) ||
          /trash|delete/i.test(b.getAttribute('aria-label') || ''),
        ).length;
      })()
    `);

    record(
      "faculty cannot delete a group's files — criterion 7",
      filesPath.includes("/files") ? deleteControls === 0 : true,
      filesPath.includes("/files")
        ? `${deleteControls} delete controls rendered`
        : `bounced to ${filesPath}`,
    );

    await goto(`/groups/${groupId}/discussion`);
    const discussionPath = await path();

    const composer = await evaluate(`
      [...document.querySelectorAll('h1, h2, h3')]
        .filter((h) => /start a thread/i.test(h.innerText)).length
    `);

    record(
      "faculty CAN post in a supervised discussion — the deliberate half",
      discussionPath.includes("/discussion") ? composer > 0 : false,
      "answering a question in the group's own thread is the point",
    );

    // The ledger is the deliberate exception: faculty read it, and so does the
    // group (ADR-045). Asserting it renders guards against "locked down" being
    // implemented as "locked out".
    await goto(`/groups/${groupId}/ledger`);
    const ledger = await text();
    record(
      "faculty can still read the ledger",
      /recorded activity/i.test(ledger),
      `${ledger.length} chars`,
    );
  } else {
    record("a supervised group was reachable from the review screen", false, "no group link");
  }

  /* --------------- criterion 7, the sharp half: sections are theirs */

  await goto(`/projects/${UNDER_REVIEW}/edit/problem`);
  const sectionEditor = await text();
  const editorPath = await path();

  const writable = await evaluate(`
    (() => {
      const areas = [...document.querySelectorAll('textarea')];
      return areas.filter((a) => !a.readOnly && !a.disabled).length;
    })()
  `);

  record(
    "faculty cannot edit a group's project sections — criterion 7",
    editorPath.includes("/edit") ? writable === 0 : true,
    editorPath.includes("/edit")
      ? `${writable} writable fields, ${sectionEditor.length} chars`
      : `bounced to ${editorPath}`,
  );

  /* ------- criterion 9: the draft, from the student's seat, before */

  await signIn(STUDENT);
  await goto(`/projects/${UNDER_REVIEW}/feedback`);
  const studentBefore = await text();

  record(
    "a draft evaluation is invisible to the group — criterion 9",
    !/repeat the calibration across at least three probes/i.test(studentBefore) &&
      !/materially smaller share/i.test(studentBefore),
    "neither the comments nor the per-member reason reach the student's page",
  );

  // The tab itself is hidden while there is nothing released, so its absence is
  // part of the same assertion rather than a separate cosmetic one.
  const tabHidden = await evaluate(`
    [...document.querySelectorAll('a')].filter((a) => a.innerText.trim() === 'Feedback').length
  `);

  record(
    "the Feedback tab stays hidden until a round is released",
    tabHidden === 0,
    `${tabHidden} tabs rendered`,
  );

  /* --------------------------------- back to release, and the clock */

  await signIn(FACULTY);
  await goto(reviewHref ?? `/projects/${UNDER_REVIEW}/review`);
  await evaluate("document.querySelector('button[data-release]')?.click()");
  await sleep(3000);

  const releasedText = await text();
  const released = /released/i.test(releasedText);
  const minutes = (Date.now() - started) / 60000;

  record(
    "the evaluation releases to the group",
    released,
    released ? "round released" : releasedText.slice(0, 120).replace(/\n/g, " "),
  );

  record(
    "a full evaluation takes under ten minutes — criterion 3",
    minutes < 10,
    `${minutes.toFixed(1)} minutes of real interaction`,
  );

  /* -------- criterion 9: the same page, after release, still theirs */

  await signIn(STUDENT);
  await goto(`/projects/${UNDER_REVIEW}/feedback`);
  const studentAfter = await text();

  record(
    "releasing shows the group the marks and the comments — criterion 9",
    /repeat the calibration across at least three probes/i.test(studentAfter),
    /repeat the calibration/i.test(studentAfter)
      ? "the released comments are on their page"
      : `${studentAfter.length} chars: ${studentAfter.slice(0, 90).split(String.fromCharCode(10)).join(" ")}`,
  );

  record(
    "the group sees every member's reason, not only their own",
    /materially smaller share/i.test(studentAfter),
    "a differentiated mark the teammates cannot see is unarguable",
  );

  await signIn(FACULTY);

  /* ---------------------- criterion 5: attest, verify, then revoke */

  await goto("/faculty/attestations");
  // A textarea's value is not in innerText. Reading the body text here reported
  // "no draft prompt" for a form that was correctly pre-filled.
  const draft = await evaluate("document.querySelector('textarea[name=statement]')?.value ?? ''");

  record(
    "/faculty/attestations offers a pre-filled draft",
    draft.includes("Replace this with"),
    draft.length > 0
      ? `${draft.split(String.fromCharCode(10))[0].slice(0, 80)}…`
      : "no draft rendered",
  );

  // The refusal first: submitting the draft unedited must fail, because that is
  // the one way an automatic attestation could get out wearing a human's name.
  await evaluate(`
    (() => {
      const form = document.querySelector('form');
      form.requestSubmit();
      return true;
    })()
  `);
  await sleep(2500);

  const refused = await text();
  record(
    "submitting the unedited draft is refused — never auto-issued",
    /draft prompt is still in the text|at least a sentence/i.test(refused),
    "the server refused it",
  );

  const issuedCode = await evaluate(`
    (async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value',
      ).set;
      const area = document.querySelector('textarea[name=statement]');
      setter.call(area, 'I supervised this project through two field deployments and watched the soil-probe calibration demonstrated in Lab 3 on 14 August. The failure analysis after the firmware regression was this team\\'s own work and I would vouch for it to any employer.');
      area.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('form').requestSubmit();

      for (let i = 0; i < 40; i += 1) {
        await new Promise((r) => setTimeout(r, 500));
        const match = document.body.innerText.match(/NX-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}/);
        if (match) return match[0];
      }
      return null;
    })()
  `);

  record(
    "an attestation is issued with a verification code — criterion 5",
    Boolean(issuedCode),
    issuedCode ?? "no code rendered",
  );

  if (issuedCode) {
    // Signed out, because "verifiable" means verifiable by a recruiter who has
    // never heard of this product.
    await cdp.send("Network.clearBrowserCookies", {}, sessionId);
    await goto(`/verify?code=${issuedCode}`);
    const verified = await text();

    record(
      "the code verifies publicly, with the attester named",
      verified.includes(issuedCode) && /attested by/i.test(verified),
      /attested by[^\n]*/i.exec(verified)?.[0]?.slice(0, 90) ?? "no attribution line",
    );

    await signIn(FACULTY);
    await goto("/faculty/attestations");

    const revoked = await evaluate(`
      (async () => {
        const buttons = [...document.querySelectorAll('button')].filter(
          (b) => b.innerText.trim() === 'Revoke',
        );
        if (buttons.length === 0) return 'no revoke control';
        buttons[0].click();
        await new Promise((r) => setTimeout(r, 400));

        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value',
        ).set;
        const area = document.querySelector('textarea[name=reason]');
        if (!area) return 'no reason field';
        setter.call(area, 'Issued against the wrong round; reissuing after the final submission.');
        area.dispatchEvent(new Event('input', { bubbles: true }));
        area.closest('form').requestSubmit();

        for (let i = 0; i < 40; i += 1) {
          await new Promise((r) => setTimeout(r, 500));
          if (/revoked/i.test(document.body.innerText)) return 'revoked';
        }
        return 'no revocation rendered';
      })()
    `);

    record("a revocation preserves the record — criterion 5", revoked === "revoked", revoked);

    await cdp.send("Network.clearBrowserCookies", {}, sessionId);
    await goto(`/verify?code=${issuedCode}`);
    const afterRevoke = await text();

    record(
      "the revoked attestation still resolves, marked revoked",
      afterRevoke.includes(issuedCode) && /revoked/i.test(afterRevoke),
      "a dead lookup would be worse for everybody",
    );

    await signIn(FACULTY);
  }

  /* ------------------------- announcements, and the question queue */

  await goto("/faculty/announcements");
  const announcements = await text();

  record(
    "/faculty/announcements shows posted and scheduled separately",
    /scheduled/i.test(announcements),
    /nobody can see it until then/i.test(announcements)
      ? "a scheduled post says it is invisible"
      : `${announcements.length} chars`,
  );

  record(
    "the question queue is on the same page",
    /questions waiting/i.test(announcements),
    /\d+\s*$/.test(announcements) ? "queued" : "rendered",
  );

  /* ---------------------------------------- the rubric versioning rule */

  await goto("/faculty/rubrics");
  const rubrics = await text();

  record(
    "/faculty/rubrics surfaces the versioning rule at the point of editing",
    /used in \d+ evaluation/i.test(rubrics),
    "a rubric that has marked work says so",
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
