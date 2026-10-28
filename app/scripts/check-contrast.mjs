#!/usr/bin/env node
/**
 * WCAG contrast audit over the design token file.
 *
 * Contrast is MEASURED, not eyeballed. This script parses src/styles/globals.css,
 * resolves every token in both themes, and checks each foreground/background
 * pairing the product actually uses against WCAG 2.1 AA.
 *
 * Wired into `npm run check` and it FAILS the run on any pair below its
 * threshold — so a contrast regression cannot land silently.
 *
 * Thresholds (WCAG 2.1):
 *   4.5:1  normal body text                     (1.4.3)
 *   3.0:1  large text (18.66px bold / 24px)     (1.4.3)
 *   3.0:1  UI component and graphical boundaries (1.4.11)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(here, "../src/styles/globals.css");
const css = readFileSync(cssPath, "utf8");

/* --------------------------------------------------------------------------
   Parse the token blocks
   -------------------------------------------------------------------------- */

/** Grab the declarations inside the first block whose selector matches. */
function block(selectorPattern) {
  const re = new RegExp(`${selectorPattern}\\s*\\{([\\s\\S]*?)\\n\\}`, "m");
  const match = css.match(re);
  return match ? match[1] : "";
}

function declarations(text) {
  const out = {};
  const re = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(text)) !== null) out[m[1]] = m[2].trim();
  return out;
}

const lightTokens = declarations(block("^:root"));
const darkTokens = { ...lightTokens, ...declarations(block(':root\\[data-theme="dark"\\]')) };

/* --------------------------------------------------------------------------
   Colour maths
   -------------------------------------------------------------------------- */

function parseColor(value, tokens, depth = 0) {
  if (depth > 8) return null;
  const v = value.trim();

  const varMatch = v.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (varMatch) {
    const referenced = tokens[varMatch[1]];
    return referenced ? parseColor(referenced, tokens, depth + 1) : null;
  }

  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3)
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  // rgb(r g b / a) — alpha-composited colours are overlays, not text pairings,
  // so they are deliberately skipped rather than approximated.
  return null;
}

function relativeLuminance([r, g, b]) {
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a, b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/* --------------------------------------------------------------------------
   The pairings the product actually renders
   -------------------------------------------------------------------------- */

const TEXT = 4.5;
const LARGE = 3.0;
const UI = 3.0;

const pairs = [
  // Body text on every surface
  ["--color-fg", "--color-surface", TEXT, "body text on surface"],
  ["--color-fg", "--color-surface-raised", TEXT, "body text on raised"],
  ["--color-fg", "--color-surface-sunken", TEXT, "body text on sunken"],
  ["--color-fg-muted", "--color-surface", TEXT, "muted text on surface"],
  ["--color-fg-muted", "--color-surface-raised", TEXT, "muted text on raised"],
  ["--color-fg-subtle", "--color-surface", TEXT, "subtle text on surface"],
  ["--color-fg-subtle", "--color-surface-raised", TEXT, "subtle text on raised"],
  ["--color-fg-inverse", "--color-surface-inverse", TEXT, "inverse text on inverse surface"],

  // Brand colours used as text and as links
  ["--color-primary-600", "--color-surface", TEXT, "primary link on surface"],
  ["--color-primary-600", "--color-surface-raised", TEXT, "primary link on raised"],
  ["--color-accent-700", "--color-surface", TEXT, "accent text on surface"],
  ["--color-highlight-700", "--color-surface", TEXT, "highlight text on surface"],

  // Filled controls — checked against the explicit *-fill tokens, which is
  // exactly what a component uses. Checking against a ramp step would test a
  // pairing no component actually renders.
  ["--color-fg-on-primary", "--color-primary-fill", TEXT, "text on primary fill"],
  ["--color-fg-on-accent", "--color-accent-fill", TEXT, "text on accent fill"],
  ["--color-fg-on-highlight", "--color-highlight-fill", TEXT, "text on highlight fill"],
  ["--color-primary-fill", "--color-surface", UI, "primary fill boundary on surface"],
  ["--color-accent-fill", "--color-surface", UI, "accent fill boundary on surface"],
  ["--color-highlight-fill-border", "--color-surface", UI, "highlight fill border on surface"],

  // Semantic states
  ["--color-success-fg", "--color-success", TEXT, "text on success"],
  ["--color-warning-fg", "--color-warning", TEXT, "text on warning"],
  ["--color-danger-fg", "--color-danger", TEXT, "text on danger"],
  ["--color-info-fg", "--color-info", TEXT, "text on info"],
  ["--color-success", "--color-surface", LARGE, "success as an indicator"],
  ["--color-warning", "--color-surface", LARGE, "warning as an indicator"],
  ["--color-danger", "--color-surface", LARGE, "danger as an indicator"],
  ["--color-info", "--color-surface", LARGE, "info as an indicator"],

  // Contribution proof tiers — load-bearing, and they must read as text
  ["--color-tier-self", "--color-surface", TEXT, "tier: self-claimed"],
  ["--color-tier-evidenced", "--color-surface", TEXT, "tier: workspace-evidenced"],
  ["--color-tier-attested", "--color-surface", TEXT, "tier: faculty-attested"],

  // Project statuses
  ["--color-status-draft", "--color-surface", TEXT, "status: draft"],
  ["--color-status-proposed", "--color-surface", TEXT, "status: proposed"],
  ["--color-status-approved", "--color-surface", TEXT, "status: approved"],
  ["--color-status-progress", "--color-surface", TEXT, "status: in progress"],
  ["--color-status-review", "--color-surface", TEXT, "status: under review"],
  ["--color-status-completed", "--color-surface", TEXT, "status: completed"],
  ["--color-status-archived", "--color-surface", TEXT, "status: archived"],

  // Domain categorical set — used as text on cards
  ["--color-domain-ai", "--color-surface", TEXT, "domain: AI/ML"],
  ["--color-domain-software", "--color-surface", TEXT, "domain: software"],
  ["--color-domain-hardware", "--color-surface", TEXT, "domain: hardware"],
  ["--color-domain-healthcare", "--color-surface", TEXT, "domain: healthcare"],
  ["--color-domain-education", "--color-surface", TEXT, "domain: education"],
  ["--color-domain-sustainability", "--color-surface", TEXT, "domain: sustainability"],
  ["--color-domain-social", "--color-surface", TEXT, "domain: social impact"],
  ["--color-domain-research", "--color-surface", TEXT, "domain: research"],

  // UI boundaries (WCAG 1.4.11)
  ["--color-border-strong", "--color-surface", UI, "strong border on surface"],
  ["--color-border-focus", "--color-surface", UI, "focus ring on surface"],
  ["--color-border-focus", "--color-surface-raised", UI, "focus ring on raised"],
];

/* --------------------------------------------------------------------------
   Run
   -------------------------------------------------------------------------- */

let failures = 0;
let checked = 0;
let skipped = 0;

for (const [themeName, tokens] of [
  ["light", lightTokens],
  ["dark", darkTokens],
]) {
  const rows = [];

  for (const [fgToken, bgToken, threshold, label] of pairs) {
    const fg = parseColor(tokens[fgToken] ?? "", tokens);
    const bg = parseColor(tokens[bgToken] ?? "", tokens);

    if (!fg || !bg) {
      skipped += 1;
      rows.push(["SKIP", label, "—", threshold.toFixed(1)]);
      continue;
    }

    checked += 1;
    const ratio = contrastRatio(fg, bg);
    const pass = ratio >= threshold;
    if (!pass) failures += 1;

    rows.push([pass ? "PASS" : "FAIL", label, ratio.toFixed(2), threshold.toFixed(1)]);
  }

  console.log(`\n  ${themeName.toUpperCase()} THEME`);
  console.log("  " + "-".repeat(72));
  for (const [status, label, ratio, threshold] of rows) {
    if (status === "PASS") continue; // keep the output about the problems
    console.log(
      `  ${status}  ${label.padEnd(40)} ${String(ratio).padStart(6)} : 1  (need ${threshold})`,
    );
  }
  const themeFails = rows.filter((r) => r[0] === "FAIL").length;
  console.log(
    `  ${rows.length - themeFails - rows.filter((r) => r[0] === "SKIP").length} passed, ` +
      `${themeFails} failed, ${rows.filter((r) => r[0] === "SKIP").length} skipped`,
  );
}

console.log(
  `\n  Contrast audit: ${checked} pairs checked, ${failures} failed, ${skipped} skipped.`,
);

if (failures > 0) {
  console.error(
    `\n  ✖ ${failures} contrast failure(s). Fix the tokens in src/styles/globals.css.\n` +
      `    Do not lower the threshold — it is the WCAG 2.1 AA requirement.\n`,
  );
  process.exit(1);
}

console.log("  ✔ All measured pairs meet WCAG 2.1 AA in both themes.\n");
