#!/usr/bin/env node
/**
 * Generates the raster icon set from the Nexivora mark geometry.
 *
 * Apple and Android require PNG; browsers still want a .ico. Everything else in
 * this product is SVG, and these three files are the documented exception in
 * docs/DESIGN-SYSTEM.md.
 *
 * The geometry is defined ONCE, here and in public/icon.svg, and they must stay
 * in step. Run `npm run gen:icons` after any change to the mark.
 *
 * Requires Python with Pillow (already present in this environment). Node has
 * no rasteriser in stdlib and adding sharp/resvg for three build-time files is
 * a dependency we do not need at runtime.
 */

import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, "../public");

const python = `
import math, os
from PIL import Image, ImageDraw

OUT = r"${publicDir.replace(/\\/g, "\\\\")}"
SS = 8  # supersample factor, then downsample for clean anti-aliasing

IRIS  = (79, 70, 229, 255)    # --color-primary-fill
CYAN  = (103, 232, 249, 255)  # --color-accent-300, the leading node
WHITE = (255, 255, 255, 255)

def draw_mark(size, rounded=True, bg=IRIS):
    """The mark on a 32x32 grid, scaled to \`size\`. Matches public/icon.svg."""
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = s / 32.0  # one grid unit

    if bg is not None:
        radius = int(7 * u) if rounded else 0
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=bg)

    w = max(1, int(round(2.75 * u)))

    def pt(x, y):
        return (x * u, y * u)

    # The N: down-stroke, diagonal, up-stroke. Round joins via circles at the
    # vertices, because PIL's line joins are mitred squares.
    pts = [pt(9, 23.5), pt(9, 9.5), pt(23, 22.5), pt(23, 8.5)]
    d.line([pts[0], pts[1]], fill=WHITE, width=w)
    d.line([pts[1], pts[2]], fill=WHITE, width=w)
    d.line([pts[2], pts[3]], fill=WHITE, width=w)
    for p in pts:
        r = w / 2
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=WHITE)

    # Nodes: low-left white, high-right cyan and largest — the focal point.
    def node(cx, cy, r, fill):
        d.ellipse([(cx - r) * u, (cy - r) * u, (cx + r) * u, (cy + r) * u], fill=fill)

    node(9, 23.5, 2.75, WHITE)
    node(23, 8.5, 3.5, CYAN)

    return img.resize((size, size), Image.LANCZOS)

# favicon.ico — 16/32/48 in one file.
# Pillow's ICO writer does NOT accept append_images: it derives every entry by
# downscaling the image it is given. So save from the LARGEST render and let it
# produce the smaller entries, or the file silently contains one size only.
ico_sizes = [(16, 16), (32, 32), (48, 48)]
draw_mark(48).save(os.path.join(OUT, "favicon.ico"), format="ICO", sizes=ico_sizes)

# apple-touch-icon — 180, no transparency (iOS composites onto black otherwise)
draw_mark(180).convert("RGB").save(os.path.join(OUT, "apple-touch-icon.png"), format="PNG")

# PWA icons
draw_mark(192).save(os.path.join(OUT, "icon-192.png"), format="PNG")
draw_mark(512).save(os.path.join(OUT, "icon-512.png"), format="PNG")

# maskable: Android crops to a circle, so the mark must sit inside the safe
# zone (the middle 80%) or the corners get clipped.
base = draw_mark(512)
maskable = Image.new("RGBA", (512, 512), IRIS)
inner = draw_mark(410, rounded=False, bg=None)
maskable.paste(inner, (51, 51), inner)
maskable.save(os.path.join(OUT, "icon-maskable-512.png"), format="PNG")

for name in ["favicon.ico", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png"]:
    p = os.path.join(OUT, name)
    print("  %-26s %6d bytes" % (name, os.path.getsize(p)))
`;

console.log("\n  Generating brand raster assets from the mark geometry…\n");
execFileSync("python", ["-c", python], { stdio: "inherit" });
console.log("\n  Done. These are the only raster files in the project (see ADR-011).\n");
