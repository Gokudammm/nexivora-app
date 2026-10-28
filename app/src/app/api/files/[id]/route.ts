import { currentViewer } from "@/lib/auth/session";
import { can } from "@/lib/authz/policy";
import { db } from "@/lib/db/client";
import { groupResource } from "@/lib/db/queries/group";
import { servedInline } from "@/lib/storage/file-types";
import { storage } from "@/lib/storage";

/**
 * THE ONLY PATH TO A USER FILE.
 *
 * There is no static URL for an upload. Files live outside the web root and
 * reach a browser exclusively through this handler, which resolves the row,
 * asks `can(viewer, 'workspace:read', group)` and only then streams bytes.
 * Acceptance criterion 5 is the test of it: a file uploaded by group A returns
 * 404 to a member of group B, at the real URL.
 *
 * **404, never 403.** A refusal that distinguishes "not yours" from "not there"
 * confirms the file exists, and the existence of a named file inside a named
 * group is itself information — the same reasoning as ADR-034 for profiles.
 * Every failure below returns the identical response.
 *
 * **Reading is `workspace:read`, not a new action.** Reading a group's file
 * *is* reading the workspace. Inventing a `file:read` action would put a second
 * decision next to an existing one, and two permission checks about the same
 * thing drift until the more permissive one wins.
 *
 * Three response rules, each from docs/SECURITY.md:
 *
 *  · `X-Content-Type-Options: nosniff` on everything, so a text file cannot be
 *    re-interpreted as script by a browser being helpful.
 *  · `Content-Disposition: attachment` for anything not previewable — and SVG
 *    is deliberately *not* previewable, because it is markup that can carry
 *    script (§3).
 *  · A restrictive `Content-Security-Policy` on the response itself, so even a
 *    document served inline cannot load or call anything.
 */

const notFound = () =>
  new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" },
  });

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const viewer = await currentViewer();

  if (!viewer.userId) return notFound();

  const file = await db.fileAsset.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      name: true,
      mimeType: true,
      sizeBytes: true,
      storageKey: true,
      quarantined: true,
      group: {
        select: {
          id: true,
          collegeId: true,
          classId: true,
          class: { select: { subjectId: true } },
        },
      },
    },
  });

  if (!file) return notFound();
  if (!can(viewer, "workspace:read", groupResource(file.group))) return notFound();

  // A quarantined file has not cleared the scan boundary. It is not served,
  // and it is not distinguishable from an absent one either — a distinct
  // "pending scan" reply would confirm the upload exists.
  if (file.quarantined) return notFound();

  const bytes = await storage().get(file.storageKey);
  if (!bytes) return notFound();

  const inline = servedInline(file.mimeType);
  const disposition = inline ? "inline" : "attachment";

  // RFC 5987 for the non-ASCII case, with a plain fallback for old clients.
  // The name has already been through `sanitiseFilename`, so it carries no
  // quotes or control characters that could break out of this header.
  const encoded = encodeURIComponent(file.name);

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${disposition}; filename="${file.name}"; filename*=UTF-8''${encoded}`,
      "X-Content-Type-Options": "nosniff",
      // sandbox, and nothing else permitted: an inline PDF or SVG opened from
      // here cannot script, fetch, or frame anything.
      "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'",
      // Private to the requesting session. A shared cache holding a group's
      // coursework would hand it to the next person through the proxy.
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
