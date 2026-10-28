import { detectFileType } from "./file-types";
import { storage } from "@/lib/storage";
import { storageKey } from "./provider";

/**
 * PROFILE AND BRAND IMAGES — avatars, cover images, college logos.
 *
 * Separate from the workspace file path, and deliberately so. A group's file is
 * private to that group and reached through an authorisation check on every
 * request. An avatar is the opposite: it appears beside its owner's name
 * wherever they appear, including on a public project page that a logged-out
 * visitor is reading, so putting it behind the workspace check would break
 * every public surface in the product.
 *
 * The constraints that make that safe:
 *
 *  · **Images only**, verified by magic bytes like everything else. A `.pdf`
 *    named `avatar.png` is refused here for the same reason it is in a
 *    workspace.
 *  · **SVG is refused outright**, not merely served as an attachment. An avatar
 *    is rendered through `<img>` in dozens of places; an uploaded SVG is markup
 *    that can carry script, and the one thing worse than inlining it would be
 *    inlining it beside somebody's name (docs/SECURITY.md §3).
 *  · **2 MB**, well under the 25 MB workspace cap. An avatar is displayed at
 *    24–80px and a 20 MB one is a mistake, not a requirement.
 *
 * The stored object is served from `/api/images/[id]`, which is public by
 * design and carries a long cache. The key is unguessable, so a replaced image
 * simply stops being referenced rather than needing invalidation.
 */

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export type ImageScope = "avatar" | "cover" | "logo";

export type ImageResult = { ok: true; url: string; key: string } | { ok: false; error: string };

/**
 * Validate and store one image.
 *
 * Returns the URL to persist on the row. The caller owns the database write —
 * this function is deliberately ignorant of what the image is *for*, so the
 * same three lines serve a student's avatar, a project cover and a college
 * logo.
 */
export async function storeImage(
  scope: ImageScope,
  ownerId: string,
  file: File,
): Promise<ImageResult> {
  if (file.size === 0) return { ok: false, error: "That file is empty." };

  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `Images must be 2 MB or smaller. This one is ${(file.size / 1_048_576).toFixed(1)} MB.`,
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectFileType(file.name, bytes);

  if (!detected.ok) return { ok: false, error: detected.reason };

  if (detected.type.mime === "image/svg+xml") {
    return {
      ok: false,
      error:
        "SVG is not accepted for images that appear beside a name. Use PNG, JPEG or WebP — an SVG is markup and can carry script.",
    };
  }

  if (!IMAGE_MIMES.has(detected.type.mime)) {
    return { ok: false, error: "That is not an image. Use PNG, JPEG or WebP." };
  }

  const key = storageKey(`${scope}s`, ownerId, detected.extension);
  await storage().put(key, bytes);

  return { ok: true, key, url: `/api/images/${encodeURIComponent(key)}` };
}

/**
 * Remove a previously stored image.
 *
 * Best-effort: a failure here must never fail the surrounding save. An orphaned
 * object costs a few kilobytes; a save that refuses because the *old* file
 * could not be deleted is a bug the user cannot do anything about.
 */
export async function forgetImage(url: string | null | undefined): Promise<void> {
  if (!url?.startsWith("/api/images/")) return;

  try {
    await storage().delete(decodeURIComponent(url.slice("/api/images/".length)));
  } catch {
    /* best effort, by design */
  }
}
