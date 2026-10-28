import { notFound } from "next/navigation";

import { env } from "@/lib/env";
import { FileManager } from "@/components/workspace/file-manager";
import { requireAuth } from "@/lib/auth/guards";
import { can } from "@/lib/authz/policy";
import { groupResource, requireWorkspace } from "@/lib/db/queries/group";
import { listFiles, storageUsed } from "@/lib/db/queries/workspace";
import { buildMetadata } from "@/lib/seo/metadata";
import { GROUP_QUOTA_BYTES } from "@/config/storage";

export const metadata = buildMetadata({
  title: "Files",
  description:
    "The group's files, with version history and a record of who contributed which version. Served only through an authorised route.",
  index: false,
  path: "/groups",
});

export default async function FilesPage({ params, searchParams }: PageProps<"/groups/[id]/files">) {
  const { id } = await params;
  const query = await searchParams;
  const viewer = await requireAuth(`/groups/${id}/files`);
  const workspace = await requireWorkspace(viewer, id);

  if (!workspace) notFound();

  const trashed = query.view === "trash";
  const search = typeof query.q === "string" ? query.q : undefined;

  const [files, used] = await Promise.all([
    listFiles(workspace, { trashed, q: search }),
    storageUsed(workspace),
  ]);

  return (
    <FileManager
      groupId={workspace.id}
      files={files.map((file) => ({
        id: file.id,
        name: file.name,
        folder: file.folder,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        createdAt: file.createdAt,
        deletedAt: file.deletedAt,
        uploader: file.uploader,
        versions: file.versions.map((version) => ({
          id: version.id,
          version: version.version,
          note: version.note,
          createdAt: version.createdAt,
          uploader: version.uploader,
        })),
      }))}
      used={used}
      quota={GROUP_QUOTA_BYTES}
      trashed={trashed}
      search={search ?? ""}
      canUpload={can(viewer, "file:upload", groupResource(workspace))}
      canDelete={can(viewer, "file:delete", groupResource(workspace))}
      directUploads={env.STORAGE_DRIVER === "blob"}
    />
  );
}
