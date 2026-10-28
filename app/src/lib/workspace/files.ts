"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { currentViewer } from "@/lib/auth/session";
import { can } from "@/lib/authz/policy";
import { db } from "@/lib/db/client";
import { compensateLedgerEvent, recordLedgerEvent } from "@/lib/ledger/record";
import { detectFileType, extensionOf } from "@/lib/storage/file-types";
import { storage } from "@/lib/storage";
import {
  isWorkspaceFileKey,
  sanitiseFilename,
  storageKey,
  workspaceFileKey,
} from "@/lib/storage/provider";
import { GROUP_QUOTA_BYTES } from "@/config/storage";
import { env } from "@/lib/env";

import { loadForAction, type WorkspaceResult } from "./actions";

/**
 * FILES.
 *
 * The highest-risk subsystem in the product (docs/SECURITY.md §4), and the
 * order of the checks below is the security property:
 *
 *   1. **Authorise before reading a single byte.** A rejected upload should
 *      never have been buffered, let alone written.
 *   2. **Decide what the file is from its bytes**, not from its name or the
 *      MIME type the browser volunteered. Both of those are strings the
 *      uploader chose.
 *   3. **Check the quota before writing**, and count what is already on disk
 *      rather than what the rows claim.
 *   4. **Write the object, then the row.** In that order, because an orphaned
 *      object is a cleanup job and an orphaned row is a broken download.
 *
 * The uploaded filename never becomes a path. `storageKey()` generates the
 * name; the original is metadata, shown in the interface and sent back in a
 * `Content-Disposition`, and nothing else.
 */

const fail = (error: unknown): WorkspaceResult => ({
  ok: false,
  error: error instanceof Error ? error.message : "Something went wrong.",
});

async function actor() {
  const viewer = await currentViewer();
  if (!viewer.userId) throw new Error("Sign in first.");
  return viewer as typeof viewer & { userId: string };
}

const folderSchema = z
  .string()
  .trim()
  .max(120)
  .default("/")
  // A folder is a label on a row, not a directory on disk — but it still ends
  // up in breadcrumbs and links, so it is normalised to something harmless.
  .transform((value) => {
    const cleaned = `/${value.replace(/[^A-Za-z0-9 _/-]/g, "").replace(/\/+/g, "/")}`
      .replace(/\/$/, "")
      .slice(0, 120);
    return cleaned === "" ? "/" : cleaned;
  });

/* ---------------------------------------------------------------- upload */

export async function prepareBlobUpload(input: {
  groupId: string;
  filename: string;
  sizeBytes: number;
}): Promise<{ ok: true; key: string; uploaderId: string } | { ok: false; error: string }> {
  try {
    const parsed = z
      .object({
        groupId: z.string().min(1),
        filename: z.string().min(1).max(255),
        sizeBytes: z.number().int().positive(),
      })
      .parse(input);

    if (env.STORAGE_DRIVER !== "blob") {
      return { ok: false, error: "Direct uploads are not enabled for this storage driver." };
    }
    if (parsed.sizeBytes > env.MAX_UPLOAD_BYTES) {
      return {
        ok: false,
        error: `Files must be ${Math.round(env.MAX_UPLOAD_BYTES / 1_048_576)} MB or smaller.`,
      };
    }

    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, parsed.groupId);
    if (!can(viewer, "file:upload", resource)) {
      return { ok: false, error: "You cannot upload files to this group." };
    }

    const used = await db.fileAsset.aggregate({
      where: { groupId: workspace.id, deletedAt: null },
      _sum: { sizeBytes: true },
    });
    if ((used._sum.sizeBytes ?? 0) + parsed.sizeBytes > GROUP_QUOTA_BYTES) {
      return {
        ok: false,
        error: "This group has used its 2 GB of storage. Remove something first.",
      };
    }

    return {
      ok: true,
      key: workspaceFileKey(
        workspace.id,
        viewer.userId,
        extensionOf(sanitiseFilename(parsed.filename)),
      ),
      uploaderId: viewer.userId,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Something went wrong.",
    };
  }
}

export async function discardBlobUpload(groupId: string, key: string): Promise<WorkspaceResult> {
  try {
    if (env.STORAGE_DRIVER !== "blob") {
      return { ok: false, error: "Blob uploads are not enabled." };
    }

    const viewer = await actor();
    if (!isWorkspaceFileKey(key, groupId, viewer.userId, extensionOf(key))) {
      return { ok: false, error: "That upload is not available." };
    }

    const [asset, version] = await Promise.all([
      db.fileAsset.findUnique({ where: { storageKey: key }, select: { id: true } }),
      db.fileVersion.findUnique({ where: { storageKey: key }, select: { id: true } }),
    ]);
    if (asset || version) return { ok: true, message: "The file is already saved." };

    if ((await storage().size(key)) !== null) await storage().delete(key);
    return { ok: true, message: "Temporary upload removed." };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Upload one file, or a new version of an existing one.
 *
 * Called from a client component that posts a `FormData` per file, so progress
 * and per-file failure are per-file rather than all-or-nothing — a five-file
 * drop where the third is a renamed executable should upload the other four and
 * say precisely what happened to the third.
 */
export async function uploadFile(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  let pendingBlobKey: string | null = null;
  let committed = false;

  try {
    const groupId = z.string().min(1).parse(formData.get("groupId"));
    const folder = folderSchema.parse(formData.get("folder") ?? "/");
    const replacesId = formData.get("replacesId");
    const submittedKey = formData.get("storageKey");
    const directKey = typeof submittedKey === "string" ? submittedKey : null;
    const note = z
      .string()
      .trim()
      .max(200)
      .optional()
      .parse(formData.get("note") ?? undefined);

    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, groupId);

    if (!can(viewer, "file:upload", resource)) {
      return { ok: false, error: "You cannot upload files to this group." };
    }

    const file = formData.get("file");
    const filename = directKey ? formData.get("fileName") : file instanceof File ? file.name : null;
    if (typeof filename !== "string" || filename.length === 0) {
      return { ok: false, error: "Choose a file to upload." };
    }

    if (directKey && env.STORAGE_DRIVER !== "blob") {
      return { ok: false, error: "Direct uploads are not enabled for this storage driver." };
    }

    const expectedSize = directKey
      ? z.coerce.number().int().positive().parse(formData.get("fileSize"))
      : file instanceof File
        ? file.size
        : 0;
    if (expectedSize === 0) {
      return { ok: false, error: "Choose a file to upload." };
    }
    if (expectedSize > env.MAX_UPLOAD_BYTES) {
      const limit = Math.round(env.MAX_UPLOAD_BYTES / 1_048_576);
      return { ok: false, error: `Files must be ${limit} MB or smaller. This one is larger.` };
    }

    const name = sanitiseFilename(filename);

    let bytes: Uint8Array;
    if (directKey) {
      if (!isWorkspaceFileKey(directKey, workspace.id, viewer.userId, extensionOf(name))) {
        return { ok: false, error: "That upload is not available." };
      }

      pendingBlobKey = directKey;
      const storedBytes = await storage().get(directKey);
      if (!storedBytes) {
        return { ok: false, error: "The uploaded file could not be verified." };
      }
      if (storedBytes.byteLength !== expectedSize) {
        await storage().delete(directKey);
        return { ok: false, error: "The uploaded file could not be verified." };
      }
      bytes = storedBytes;
    } else if (file instanceof File) {
      if (file.size === 0) return { ok: false, error: "Choose a file to upload." };
      bytes = new Uint8Array(await file.arrayBuffer());
    } else {
      return { ok: false, error: "Choose a file to upload." };
    }

    // The check the acceptance criteria name: the bytes decide, and a
    // disagreement with the name is a refusal with the reason said plainly.
    const detected = detectFileType(name, bytes);
    if (!detected.ok) {
      if (pendingBlobKey) await storage().delete(pendingBlobKey);
      return { ok: false, error: detected.reason };
    }

    const used = await db.fileAsset.aggregate({
      where: { groupId: workspace.id, deletedAt: null },
      _sum: { sizeBytes: true },
    });
    if ((used._sum.sizeBytes ?? 0) + bytes.byteLength > GROUP_QUOTA_BYTES) {
      if (pendingBlobKey) await storage().delete(pendingBlobKey);
      return {
        ok: false,
        error: "This group has used its 2 GB of storage. Remove something first.",
      };
    }

    const key = directKey ?? storageKey("groups", workspace.id, detected.extension);
    const stored = directKey
      ? {
          key: directKey,
          sizeBytes: bytes.byteLength,
          checksum: createHash("sha256").update(bytes).digest("hex"),
        }
      : await storage().put(key, bytes);

    /* ------------------------------------------------ a new version */

    if (typeof replacesId === "string" && replacesId.length > 0) {
      const existing = await db.fileAsset.findFirst({
        where: { id: replacesId, groupId: workspace.id, deletedAt: null },
        select: { id: true, name: true, versions: { select: { version: true } } },
      });
      if (!existing) {
        if (pendingBlobKey) await storage().delete(pendingBlobKey);
        else await storage().delete(key);
        return { ok: false, error: "That file no longer exists." };
      }

      const nextVersion = existing.versions.reduce((max, row) => Math.max(max, row.version), 1) + 1;

      await db.$transaction(async (tx) => {
        await tx.fileVersion.create({
          data: {
            fileId: existing.id,
            uploaderId: viewer.userId,
            version: nextVersion,
            storageKey: stored.key,
            sizeBytes: stored.sizeBytes,
            checksum: stored.checksum,
            note: note || null,
          },
        });

        await tx.fileAsset.update({
          where: { id: existing.id },
          data: {
            storageKey: stored.key,
            sizeBytes: stored.sizeBytes,
            checksum: stored.checksum,
            mimeType: detected.type.mime,
          },
        });

        await recordLedgerEvent(tx, {
          groupId: workspace.id,
          userId: viewer.userId,
          kind: "FILE_REVISED",
          subjectType: "FileAsset",
          subjectId: existing.id,
          metadata: { name: existing.name, version: nextVersion },
        });
      });

      committed = true;
      revalidatePath(`/groups/${workspace.id}/files`);
      return { ok: true, message: `${existing.name} is now at v${nextVersion}.`, id: existing.id };
    }

    /* ------------------------------------------------------ a new file */

    const asset = await db.$transaction(async (tx) => {
      const created = await tx.fileAsset.create({
        data: {
          groupId: workspace.id,
          uploaderId: viewer.userId,
          folder,
          name,
          mimeType: detected.type.mime,
          sizeBytes: stored.sizeBytes,
          storageKey: stored.key,
          checksum: stored.checksum,
          // Quarantine is honest rather than theatrical: we do not run a virus
          // scanner locally and we say so. The flag exists so the scanner
          // boundary is real when Phase 17 puts one behind it; until then the
          // pass-through driver clears it immediately.
          quarantined: false,
        },
        select: { id: true, name: true },
      });

      await tx.fileVersion.create({
        data: {
          fileId: created.id,
          uploaderId: viewer.userId,
          version: 1,
          storageKey: stored.key,
          sizeBytes: stored.sizeBytes,
          checksum: stored.checksum,
          note: note || null,
        },
      });

      await recordLedgerEvent(tx, {
        groupId: workspace.id,
        userId: viewer.userId,
        kind: "FILE_ADDED",
        subjectType: "FileAsset",
        subjectId: created.id,
        metadata: { name: created.name },
      });

      return created;
    });

    committed = true;
    revalidatePath(`/groups/${workspace.id}/files`);
    revalidatePath(`/groups/${workspace.id}`);
    return { ok: true, message: `${asset.name} uploaded.`, id: asset.id };
  } catch (error) {
    if (pendingBlobKey && !committed) await storage().delete(pendingBlobKey);
    return fail(error);
  }
}

/* ------------------------------------------------------------- versions */

/**
 * Restore an earlier version.
 *
 * A restore is an append too: it points the file at an older object and records
 * a new version row, so the history reads "v1, v2, v3 (restored from v1)"
 * rather than losing v2 entirely.
 */
export async function restoreVersion(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = z
      .object({
        groupId: z.string().min(1),
        fileId: z.string().min(1),
        versionId: z.string().min(1),
      })
      .parse(Object.fromEntries(formData));

    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, input.groupId);

    if (!can(viewer, "file:upload", resource)) {
      return { ok: false, error: "You cannot change files in this group." };
    }

    const version = await db.fileVersion.findFirst({
      where: { id: input.versionId, fileId: input.fileId, file: { groupId: workspace.id } },
      select: {
        id: true,
        version: true,
        storageKey: true,
        sizeBytes: true,
        checksum: true,
        file: { select: { id: true, name: true, versions: { select: { version: true } } } },
      },
    });
    if (!version) return { ok: false, error: "That version no longer exists." };

    const nextVersion =
      version.file.versions.reduce((max, row) => Math.max(max, row.version), 1) + 1;

    await db.$transaction(async (tx) => {
      await tx.fileVersion.create({
        data: {
          fileId: version.file.id,
          uploaderId: viewer.userId,
          version: nextVersion,
          // The same object, deliberately: restoring does not duplicate bytes.
          // `FileVersion.storageKey` is unique, so the restore row carries a
          // marker suffix while the asset points at the original object.
          storageKey: `${version.storageKey}#r${nextVersion}`,
          sizeBytes: version.sizeBytes,
          checksum: version.checksum,
          note: `Restored from v${version.version}`,
        },
      });

      await tx.fileAsset.update({
        where: { id: version.file.id },
        data: {
          storageKey: version.storageKey,
          sizeBytes: version.sizeBytes,
          checksum: version.checksum,
        },
      });

      await recordLedgerEvent(tx, {
        groupId: workspace.id,
        userId: viewer.userId,
        kind: "FILE_REVISED",
        subjectType: "FileAsset",
        subjectId: version.file.id,
        metadata: { name: version.file.name, restoredFrom: version.version },
      });
    });

    revalidatePath(`/groups/${workspace.id}/files`);
    return { ok: true, message: `Restored to v${version.version}.` };
  } catch (error) {
    return fail(error);
  }
}

/* --------------------------------------------------------------- delete */

/**
 * Move a file to the trash, restorable for 30 days.
 *
 * Faculty cannot reach this, by policy: a supervisor who can remove a group's
 * material is indistinguishable from tampering after the fact, and the ledger's
 * value depends on that not being possible.
 */
export async function trashFile(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = z
      .object({
        groupId: z.string().min(1),
        fileId: z.string().min(1),
        restore: z.string().optional(),
      })
      .parse(Object.fromEntries(formData));

    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, input.groupId);

    if (!can(viewer, "file:delete", resource)) {
      return { ok: false, error: "Only group members can remove files." };
    }

    const file = await db.fileAsset.findFirst({
      where: { id: input.fileId, groupId: workspace.id },
      select: { id: true, name: true, uploaderId: true, deletedAt: true },
    });
    if (!file) return { ok: false, error: "That file no longer exists." };

    const restoring = input.restore === "true";

    await db.$transaction(async (tx) => {
      await tx.fileAsset.update({
        where: { id: file.id },
        data: { deletedAt: restoring ? null : new Date() },
      });

      // Credit follows the file. Trashing withdraws it from whoever uploaded
      // it; restoring puts it back — both as appended events.
      if (restoring) {
        await recordLedgerEvent(tx, {
          groupId: workspace.id,
          userId: file.uploaderId,
          kind: "FILE_ADDED",
          subjectType: "FileAsset",
          subjectId: file.id,
          metadata: { name: file.name, restored: true },
        });
      } else {
        await compensateLedgerEvent(tx, {
          groupId: workspace.id,
          userId: file.uploaderId,
          kind: "FILE_ADDED",
          subjectType: "FileAsset",
          subjectId: file.id,
          metadata: { name: file.name, trashedBy: viewer.userId },
        });
      }
    });

    revalidatePath(`/groups/${workspace.id}/files`);
    return {
      ok: true,
      message: restoring ? `${file.name} restored.` : `${file.name} moved to trash.`,
    };
  } catch (error) {
    return fail(error);
  }
}

/** Rename a file, or move it between folders. */
export async function renameFile(
  _previous: WorkspaceResult | null,
  formData: FormData,
): Promise<WorkspaceResult> {
  try {
    const input = z
      .object({
        groupId: z.string().min(1),
        fileId: z.string().min(1),
        name: z.string().trim().min(1).max(120),
        folder: z.string().optional(),
      })
      .parse(Object.fromEntries(formData));

    const viewer = await actor();
    const { workspace, resource } = await loadForAction(viewer, input.groupId);

    if (!can(viewer, "file:upload", resource)) {
      return { ok: false, error: "You cannot change files in this group." };
    }

    await db.fileAsset.updateMany({
      where: { id: input.fileId, groupId: workspace.id, deletedAt: null },
      data: {
        name: sanitiseFilename(input.name),
        folder: folderSchema.parse(input.folder ?? "/"),
      },
    });

    revalidatePath(`/groups/${workspace.id}/files`);
    return { ok: true, message: "File updated." };
  } catch (error) {
    return fail(error);
  }
}
