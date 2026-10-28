import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";

import { currentViewer } from "@/lib/auth/session";
import { can } from "@/lib/authz/policy";
import { GROUP_QUOTA_BYTES } from "@/config/storage";
import { db } from "@/lib/db/client";
import { groupResource, requireWorkspace } from "@/lib/db/queries/group";
import { env } from "@/lib/env";
import { extensionOf } from "@/lib/storage/file-types";
import { isWorkspaceFileKey, sanitiseFilename } from "@/lib/storage/provider";

class UploadAuthorizationError extends Error {}

const uploadPayloadSchema = z.object({
  groupId: z.string().min(1),
  uploaderId: z.string().min(1),
  filename: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive(),
});

const bodySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("blob.generate-client-token"),
    payload: z.object({
      pathname: z.string().min(1),
      multipart: z.boolean(),
      clientPayload: z.string().nullable(),
    }),
  }),
  z.object({
    type: z.literal("blob.upload-completed"),
    payload: z.object({
      blob: z
        .object({
          pathname: z.string(),
          contentType: z.string(),
          contentDisposition: z.string(),
          url: z.string(),
          downloadUrl: z.string(),
          etag: z.string(),
        })
        .passthrough(),
      tokenPayload: z.string().nullable().optional(),
    }),
  }),
]);

export async function POST(request: Request): Promise<Response> {
  let body: HandleUploadBody;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid upload request." }, { status: 400 });
  }

  if (env.STORAGE_DRIVER !== "blob") {
    return Response.json({ error: "Blob uploads are not enabled." }, { status: 503 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload: z.infer<typeof uploadPayloadSchema>;
        try {
          payload = uploadPayloadSchema.parse(
            clientPayload ? JSON.parse(clientPayload) : undefined,
          );
        } catch {
          throw new UploadAuthorizationError("The upload request is not valid.");
        }

        const viewer = await currentViewer();
        if (!viewer.userId || viewer.userId !== payload.uploaderId) {
          throw new UploadAuthorizationError("Sign in again before uploading.");
        }
        if (payload.sizeBytes > env.MAX_UPLOAD_BYTES) {
          throw new UploadAuthorizationError("This file exceeds the upload limit.");
        }

        const workspace = await requireWorkspace(viewer, payload.groupId);
        if (!workspace) {
          throw new UploadAuthorizationError("That group is not available.");
        }
        const resource = groupResource({ ...workspace, id: workspace.id });
        if (!can(viewer, "file:upload", resource)) {
          throw new UploadAuthorizationError("You cannot upload files to this group.");
        }

        const filename = sanitiseFilename(payload.filename);
        if (!isWorkspaceFileKey(pathname, workspace.id, viewer.userId, extensionOf(filename))) {
          throw new UploadAuthorizationError("The upload path is not valid.");
        }

        const used = await db.fileAsset.aggregate({
          where: { groupId: workspace.id, deletedAt: null },
          _sum: { sizeBytes: true },
        });
        if ((used._sum.sizeBytes ?? 0) + payload.sizeBytes > GROUP_QUOTA_BYTES) {
          throw new UploadAuthorizationError(
            "This group has used its 2 GB of storage. Remove something first.",
          );
        }

        return {
          maximumSizeInBytes: payload.sizeBytes,
          validUntil: Date.now() + 15 * 60 * 1000,
          addRandomSuffix: false,
          allowOverwrite: false,
        };
      },
    });

    return Response.json(result);
  } catch (error) {
    if (error instanceof UploadAuthorizationError) {
      return Response.json({ error: error.message }, { status: 403 });
    }

    console.error("[blob-upload] Failed to authorize a Blob upload.", error);
    return Response.json({ error: "The upload could not be authorized." }, { status: 500 });
  }
}
