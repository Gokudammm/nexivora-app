import { storage } from "@/lib/storage";

/**
 * PUBLIC IMAGES — avatars, cover images, college logos.
 *
 * **Deliberately unauthenticated**, which is the opposite of `/api/files/[id]`
 * and worth stating plainly rather than leaving to be discovered.
 *
 * An avatar appears beside its owner's name wherever they appear, including on
 * a public project page a logged-out visitor is reading. Gating it would break
 * every public surface in the product, and gating it *conditionally* would mean
 * a second visibility rule living next to the one in `getProfile()` — which is
 * exactly the drift ADR-033 exists to prevent.
 *
 * What makes that acceptable is what is on the other side of the URL:
 *
 *  · The key is a **128-bit random name** (`storageKey()`), so these are not
 *    enumerable. Somebody who has the URL was given it by a page they were
 *    entitled to read.
 *  · Only verified image types are ever written here, and **SVG is refused at
 *    upload** — so nothing served from this path is markup.
 *  · The response is still `nosniff` and sandboxed, so a byte sequence that
 *    somehow got here cannot be re-interpreted as a document.
 *
 * A private profile does not render its avatar to anyone, so the URL is not
 * disclosed. That is the same protection a private project's cover has, and it
 * is honestly weaker than an authorisation check — which is why nothing
 * sensitive is ever stored through this path.
 */

const notFound = () =>
  new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
  });

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> },
): Promise<Response> {
  const { key: raw } = await context.params;
  const key = decodeURIComponent(raw);

  // Shape check before touching the disk. The storage driver refuses a key that
  // escapes the upload root, but refusing an implausible one here means a
  // malformed request never becomes a filesystem call at all.
  if (!/^(avatars|covers|logos)\/[A-Za-z0-9_-]+\/[0-9a-f]{32}\.[a-z0-9]{2,8}$/.test(key)) {
    return notFound();
  }

  const extension = key.slice(key.lastIndexOf(".") + 1);
  const mime = MIME_BY_EXTENSION[extension];
  if (!mime) return notFound();

  const bytes = await storage().get(key);
  if (!bytes) return notFound();

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
      // Immutable: a replaced image gets a new random key, so this URL's bytes
      // never change and there is nothing to invalidate.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
