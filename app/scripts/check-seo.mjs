#!/usr/bin/env node
/**
 * The SEO contract audit.
 *
 * Crawls every URL in the sitemap and asserts the per-page contract from
 * docs/SEO-CHECKLIST.md §2. This exists because the contract is impossible to
 * hold by hand across ~90 pages, and because the failures are invisible — a
 * doubled title, an og:image pointing at a 404, or a private project leaking
 * into the sitemap all render perfectly fine in a browser.
 *
 * Usage:
 *   node scripts/check-seo.mjs                 against http://localhost:3000
 *   BASE_URL=http://localhost:3001 npm run check:seo
 *
 * Needs a running server (dev or `next start`). It is deliberately NOT part of
 * `npm run check`, which must work with nothing running.
 */

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const TITLE_MAX = 60;
const DESC_MIN = 110;
const DESC_MAX = 160;

/** Resources that must never appear in the sitemap or be publicly indexable. */
const MUST_BE_ABSENT = [
  "attendance-face-recognition", // PRIVATE project
  "microplastic-optical-detection", // project at an unverified college
  "soil-moisture-irrigation-control", // unapproved proposal
  "zoya-khan", // PRIVATE profile
  "greenfield-institute", // unverified college
  "brightpath", // unverified company's opportunity
  "/style-guide", // internal tool
];

const failures = [];
const warnings = [];
const seenTitles = new Map();
const seenDescriptions = new Map();

function fail(url, message) {
  failures.push(`${url}\n      ${message}`);
}

function attr(html, re) {
  const m = html.match(re);
  return m ? m[1] : null;
}

function decode(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'");
}

async function fetchSitemap() {
  const res = await fetch(`${BASE}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap.xml returned ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

async function checkPage(url) {
  const path = url.replace(/^https?:\/\/[^/]+/, "") || "/";
  const target = `${BASE}${path}`;

  let res;
  try {
    res = await fetch(target, { redirect: "manual" });
  } catch (error) {
    fail(path, `request failed: ${error.message}`);
    return;
  }

  if (res.status !== 200) {
    fail(path, `expected 200, got ${res.status} — a sitemap must contain only 200-status URLs`);
    return;
  }

  const html = await res.text();

  /* ---- title ---------------------------------------------------------- */

  /*
   * Inline SVGs carry their own `<title>` for accessibility — "Cover image
   * for …" on every project card — and Next streams metadata, so in the raw
   * response those can arrive *before* the document title. Matching the first
   * `<title>` in the byte stream therefore reports an image's alt text as the
   * page title, which looked like a 63-character title on a profile page whose
   * real title is 20.
   *
   * Strip SVG content first. The document title is the one outside them.
   */
  const withoutSvg = html.replace(/<svg[\s\S]*?<\/svg>/gi, "");
  const rawTitle = attr(withoutSvg, /<title>([^<]*)<\/title>/);
  if (!rawTitle) {
    fail(path, "no <title>");
  } else {
    const title = decode(rawTitle);
    if (title.length > TITLE_MAX) {
      fail(path, `title is ${title.length} chars (max ${TITLE_MAX}): "${title}"`);
    }
    // A doubled site name is the specific bug Phase 1 shipped and Phase 2 fixed.
    const parts = title.split(" · ");
    if (parts.filter((p) => p === "Nexivora").length > 1) {
      fail(path, `site name appears twice in the title: "${title}"`);
    }
    if (seenTitles.has(title)) {
      fail(path, `duplicate title, also on ${seenTitles.get(title)}: "${title}"`);
    } else {
      seenTitles.set(title, path);
    }
  }

  /* ---- description ---------------------------------------------------- */
  const rawDesc = attr(html, /<meta name="description" content="([^"]*)"/);
  if (!rawDesc) {
    fail(path, "no meta description");
  } else {
    const desc = decode(rawDesc);
    if (desc.length > DESC_MAX) fail(path, `description is ${desc.length} chars (max ${DESC_MAX})`);
    if (desc.length < DESC_MIN) fail(path, `description is ${desc.length} chars (min ${DESC_MIN})`);
    if (seenDescriptions.has(desc)) {
      fail(path, `duplicate description, also on ${seenDescriptions.get(desc)}`);
    } else {
      seenDescriptions.set(desc, path);
    }
  }

  /* ---- canonical ------------------------------------------------------ */
  const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/);
  if (!canonical) fail(path, "no canonical link");
  else if (!/^https?:\/\//.test(canonical)) fail(path, `canonical is not absolute: ${canonical}`);

  /* ---- one h1 --------------------------------------------------------- */
  const h1Count = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1Count === 0) fail(path, "no <h1>");
  if (h1Count > 1) fail(path, `${h1Count} <h1> elements — there must be exactly one`);

  /* ---- robots --------------------------------------------------------- */
  const robots = attr(html, /<meta name="robots" content="([^"]*)"/);
  if (robots && /noindex/.test(robots)) {
    fail(path, `page is noindex but appears in the sitemap (robots: ${robots})`);
  }

  /* ---- OpenGraph ------------------------------------------------------ */
  for (const prop of ["og:title", "og:description", "og:url"]) {
    if (!html.includes(`property="${prop}"`)) fail(path, `missing ${prop}`);
  }
  const rawOgImage = attr(html, /<meta property="og:image" content="([^"]*)"/);
  if (!rawOgImage) {
    fail(path, "missing og:image — link previews will render blank");
  } else {
    // HTML-decode first: the attribute escapes & as &amp;, and fetching that
    // literally breaks every query parameter after the first.
    const ogImage = decode(rawOgImage);

    // og:image must be absolute — a relative one is ignored by most scrapers.
    if (!/^https?:\/\//.test(ogImage)) {
      fail(path, `og:image is not absolute: ${ogImage}`);
    } else {
      // The audit runs against one instance, which may be on a different port
      // from NEXT_PUBLIC_SITE_URL. Check the ORIGIN matches the canonical (so a
      // genuinely wrong production host is still caught), then fetch the PATH
      // against the instance actually under test.
      const canonicalOrigin = canonical ? new URL(canonical).origin : null;
      const imageOrigin = new URL(ogImage).origin;
      if (canonicalOrigin && imageOrigin !== canonicalOrigin) {
        fail(path, `og:image origin (${imageOrigin}) differs from canonical (${canonicalOrigin})`);
      }

      const local = `${BASE}${new URL(ogImage).pathname}${new URL(ogImage).search}`;
      // The bug this catches: a hand-written /path/opengraph-image URL, which
      // 404s because Next content-hashes the generated filename.
      const head = await fetch(local, { method: "GET" }).catch(() => null);
      if (!head || !head.ok) {
        fail(
          path,
          `og:image does not resolve (${head ? head.status : "request failed"}): ${local}`,
        );
      }
    }
  }

  /* ---- JSON-LD -------------------------------------------------------- */
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const [, json] of blocks) {
    try {
      JSON.parse(json);
    } catch (error) {
      fail(path, `invalid JSON-LD: ${error.message}`);
    }
  }

  /* ---- content renders without JS ------------------------------------- */
  // The single best test that a page is crawlable. If the body has almost no
  // text in the raw HTML, the content only exists after hydration.
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (bodyText.length < 500) {
    fail(path, `only ${bodyText.length} chars of text in the raw HTML — content may require JS`);
  }

  return { path, jsonLdBlocks: blocks.length };
}

/* -------------------------------------------------------------------------- */

console.log(`\n  SEO contract audit — ${BASE}\n`);

const urls = await fetchSitemap();
console.log(`  ${urls.length} URLs in sitemap\n`);

/* Private resources must not be in the sitemap at all. */
const sitemapText = urls.join("\n");
for (const forbidden of MUST_BE_ABSENT) {
  if (sitemapText.includes(forbidden)) {
    failures.push(`sitemap.xml\n      contains "${forbidden}", which must never be public`);
  }
}

let jsonLdTotal = 0;
let checked = 0;

// Small concurrency: enough to be quick, low enough not to swamp a dev server.
const queue = [...urls];
async function worker() {
  while (queue.length) {
    const url = queue.shift();
    const result = await checkPage(url);
    if (result) {
      jsonLdTotal += result.jsonLdBlocks;
      checked += 1;
    }
    process.stdout.write(".");
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);

/* Routes that must NOT be indexable, checked directly rather than via sitemap. */
const NOINDEX_EXPECTED = ["/style-guide", "/explore?domain=ai-ml&sdg=6&year=2026"];
for (const path of NOINDEX_EXPECTED) {
  const res = await fetch(`${BASE}${path}`);
  const html = await res.text();
  const robots = attr(html, /<meta name="robots" content="([^"]*)"/);
  if (!robots || !/noindex/.test(robots)) {
    failures.push(`${path}\n      expected noindex, got: ${robots ?? "(none)"}`);
  }
}

/* A missing route must return a real 404, not a 200 with an error page. */
const notFound = await fetch(`${BASE}/this-route-does-not-exist-${Date.now()}`);
if (notFound.status !== 404) {
  failures.push(`/404\n      expected 404, got ${notFound.status} — a soft 404 gets indexed`);
}

console.log(
  `\n\n  Checked ${checked} pages · ${jsonLdTotal} JSON-LD blocks · ${seenTitles.size} unique titles\n`,
);

if (warnings.length) {
  console.log("  WARNINGS");
  for (const w of warnings) console.log(`    ! ${w}`);
  console.log("");
}

if (failures.length) {
  console.error(`  ✖ ${failures.length} violation(s):\n`);
  for (const f of failures) console.error(`    ✖ ${f}\n`);
  process.exit(1);
}

console.log("  ✔ Every page satisfies the SEO contract.\n");
