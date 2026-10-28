#!/usr/bin/env node
/**
 * CHART PALETTE AUDIT.
 *
 * `check-contrast.mjs` asks "can this colour be read against that surface".
 * That is the right question for text and badges, and the wrong one for a
 * chart: two marks can both pass contrast against the background and still be
 * indistinguishable from **each other** — which is the only thing that matters
 * when they are two members' contribution lines.
 *
 * So this is a second audit with a different question, run over the
 * `--color-series-*` tokens in both themes:
 *
 *   1. Lightness band     — marks too light or too dark stop reading as marks.
 *   2. Chroma floor       — a desaturated hue reads as "grey", i.e. as no data.
 *   3. CVD separation     — adjacent pairs under protanopia and deuteranopia.
 *   4. Normal-vision floor— adjacent pairs under ordinary vision.
 *   5. Contrast vs surface— the mark must be visible at all.
 *
 * The maths is Oklab ΔE on CVD-simulated colours, which is not something to
 * eyeball. It found a real defect on its first run: the existing eight-colour
 * domain palette, already contrast-checked in Phase 1, has a crimson/amber pair
 * at deuteran ΔE 5.7 against a target of 8 — invisible to me, invisible to
 * every check we had, and a chart built on it would have been unreadable to
 * roughly one male reader in twelve.
 *
 * Run: npm run check:chart-palette
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(path.join(root, "src/styles/globals.css"), "utf8");

/* ------------------------------------------------------------- thresholds */

const BAND = { light: [0.43, 0.77], dark: [0.48, 0.67] };
const CHROMA_FLOOR = 0.1;
const CVD_TARGET = 8;
const NORMAL_FLOOR = 15;
const CONTRAST_MIN = 3;

const SURFACE = { light: "#fcfcfb", dark: "#1a1a19" };

/* ------------------------------------------------------------ colour maths */

const srgbToLinear = (value) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
}

/** sRGB → Oklab (Björn Ottosson). */
function oklab(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const chroma = (hex) => {
  const [, a, b] = oklab(hex);
  return Math.hypot(a, b);
};

const lightness = (hex) => oklab(hex)[0];

/**
 * Brettel–Viénot–Mollon dichromat simulation, in linear sRGB.
 *
 * The matrices are the standard published ones. This is a simulation, not a
 * lived experience — its job is to make "these two hues collapse" measurable
 * rather than a matter of opinion.
 */
const CVD = {
  protan: [
    [0.1121, 0.8853, -0.0005],
    [0.1127, 0.8897, -0.0001],
    [0.0045, 0.0, 1.0019],
  ],
  deutan: [
    [0.292, 0.7054, -0.0003],
    [0.2934, 0.7089, 0.0001],
    [-0.0195, 0.0333, 0.9912],
  ],
};

function simulate(hex, kind) {
  const rgb = hexToRgb(hex).map(srgbToLinear);
  const matrix = CVD[kind];

  const out = matrix.map((row) => row.reduce((sum, factor, i) => sum + factor * rgb[i], 0));
  const clamped = out.map((value) => Math.min(1, Math.max(0, value)));

  const toSrgb = (value) =>
    value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;

  return `#${clamped
    .map((value) =>
      Math.round(toSrgb(value) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function deltaE(a, b, kind) {
  const [l1, a1, b1] = oklab(kind ? simulate(a, kind) : a);
  const [l2, a2, b2] = oklab(kind ? simulate(b, kind) : b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2) * 100;
}

function contrast(a, b) {
  const luminance = (hex) => {
    const [r, g, bl] = hexToRgb(hex).map(srgbToLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/* ------------------------------------------------------------ token reading */

/**
 * Read the six series tokens for a theme.
 *
 * The light values come from the first `:root` block; the dark ones from the
 * `[data-theme="dark"]` block. The media-query block is asserted to agree with
 * the latter — they are two spellings of one decision, and a theme that
 * disagrees with itself depending on how it was selected is a bug that only
 * shows up on somebody else's machine.
 */
function readSeries(css) {
  const slots = [1, 2, 3, 4, 5, 6];

  const blockAfter = (marker) => {
    const start = css.indexOf(marker);
    if (start === -1) throw new Error(`Could not find ${marker} in globals.css`);
    return css.slice(start, css.indexOf("\n}", start));
  };

  const pick = (block) =>
    slots.map((slot) => {
      const match = new RegExp(`--color-series-${slot}:\\s*(#[0-9a-f]{6})`, "i").exec(block);
      if (!match) throw new Error(`--color-series-${slot} is missing from a theme block`);
      return match[1].toLowerCase();
    });

  const light = pick(css.slice(0, css.indexOf("@media (prefers-color-scheme: dark)")));
  const dark = pick(blockAfter(':root[data-theme="dark"]'));
  const media = pick(blockAfter("@media (prefers-color-scheme: dark)"));

  return { light, dark, media };
}

/* ---------------------------------------------------------------- the audit */

function audit(palette, mode) {
  const surface = SURFACE[mode];
  const [lo, hi] = BAND[mode];
  const results = [];

  const offBand = palette.filter((hex) => lightness(hex) < lo || lightness(hex) > hi);
  results.push([
    "Lightness band",
    offBand.length === 0,
    offBand.length
      ? `outside L ${lo}–${hi}: ${offBand.join(", ")}`
      : `all ${palette.length} inside L ${lo}–${hi}`,
  ]);

  const grey = palette.filter((hex) => chroma(hex) < CHROMA_FLOOR);
  results.push([
    "Chroma floor",
    grey.length === 0,
    grey.length ? `reads grey: ${grey.join(", ")}` : `all >= ${CHROMA_FLOOR}`,
  ]);

  // Adjacent pairs: the correct pairlist for bars, stacks and lines. Charts
  // with more series than colours use small multiples instead — see the note
  // on the tokens in globals.css.
  const pairs = palette.slice(0, -1).map((hex, index) => [hex, palette[index + 1]]);

  let worstCvd = { value: Infinity, pair: null, kind: null };
  for (const kind of ["protan", "deutan"]) {
    for (const [a, b] of pairs) {
      const value = deltaE(a, b, kind);
      if (value < worstCvd.value) worstCvd = { value, pair: [a, b], kind };
    }
  }
  results.push([
    "CVD separation",
    worstCvd.value >= CVD_TARGET,
    `worst ${worstCvd.pair?.join(" ↔ ")} ΔE ${worstCvd.value.toFixed(1)} (${worstCvd.kind}), target ${CVD_TARGET}`,
  ]);

  let worstNormal = { value: Infinity, pair: null };
  for (const [a, b] of pairs) {
    const value = deltaE(a, b);
    if (value < worstNormal.value) worstNormal = { value, pair: [a, b] };
  }
  results.push([
    "Normal-vision floor",
    worstNormal.value >= NORMAL_FLOOR,
    `worst ${worstNormal.pair?.join(" ↔ ")} ΔE ${worstNormal.value.toFixed(1)}, floor ${NORMAL_FLOOR}`,
  ]);

  const faint = palette.filter((hex) => contrast(hex, surface) < CONTRAST_MIN);
  results.push([
    "Contrast vs surface",
    faint.length === 0,
    faint.length ? `below ${CONTRAST_MIN}:1: ${faint.join(", ")}` : `all >= ${CONTRAST_MIN}:1`,
  ]);

  return results;
}

/* ----------------------------------------------------------------- reporting */

const { light, dark, media } = readSeries(css);
let failures = 0;

for (const [mode, palette] of [
  ["light", light],
  ["dark", dark],
]) {
  console.log(`\n  ${mode.toUpperCase()} — ${palette.join(", ")}`);
  console.log("  " + "-".repeat(72));

  for (const [name, ok, detail] of audit(palette, mode)) {
    if (!ok) failures += 1;
    console.log(`  ${ok ? "✔" : "✖"} ${name.padEnd(22)} ${detail}`);
  }
}

console.log(`\n  THEME AGREEMENT`);
console.log("  " + "-".repeat(72));

const agree = media.every((hex, index) => hex === dark[index]);
if (!agree) failures += 1;
console.log(
  `  ${agree ? "✔" : "✖"} ${"prefers-color-scheme matches [data-theme]".padEnd(22)} ${
    agree
      ? "both dark blocks declare the same six steps"
      : `media ${media.join(",")} vs theme ${dark.join(",")}`
  }`,
);

if (failures > 0) {
  console.error(`\n  ✖ Chart palette audit: ${failures} check(s) failed.\n`);
  process.exit(1);
}

console.log("\n  ✔ Chart palette: all checks pass in both themes.\n");
