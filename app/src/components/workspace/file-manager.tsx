"use client";

import Link from "next/link";
import { upload as uploadBlob } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { DownloadIcon, FileIcon, TrashIcon, UploadIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Avatar, Badge } from "@/components/ui/display";
import { EmptyState, Progress } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { kindOf } from "@/lib/storage/file-types";
import {
  discardBlobUpload,
  prepareBlobUpload,
  restoreVersion,
  trashFile,
  uploadFile,
} from "@/lib/workspace/files";
import { cn } from "@/lib/utils/cn";

import { ActionButton } from "./action-form";

/**
 * FILES.
 *
 * Two things here are less obvious than they look.
 *
 * **Every file link points at `/api/files/[id]`.** There is no static path to
 * an upload — the handler authorises before it streams, and a link that
 * bypassed it would be a permanent hole no amount of unguessable naming closes.
 *
 * **Upload is one request per file**, not one request for the drop. A five-file
 * drop where the third is a renamed executable should upload the other four and
 * say exactly what happened to the third; a single multipart request would
 * either reject the batch or accept the bad file, and both are worse.
 */

type Version = {
  id: string;
  version: number;
  note: string | null;
  createdAt: Date;
  uploader: { id: string; name: string; avatarUrl: string | null };
};

type FileRow = {
  id: string;
  name: string;
  folder: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  deletedAt: Date | null;
  uploader: { id: string; name: string; username: string | null; avatarUrl: string | null };
  versions: Version[];
};

const bytes = (value: number): string => {
  if (value < 1024) return `${value} B`;
  if (value < 1_048_576) return `${(value / 1024).toFixed(0)} KB`;
  if (value < 1_073_741_824) return `${(value / 1_048_576).toFixed(1)} MB`;
  return `${(value / 1_073_741_824).toFixed(2)} GB`;
};

export function FileManager({
  groupId,
  files,
  used,
  quota,
  trashed,
  search,
  canUpload,
  canDelete,
  directUploads,
}: {
  groupId: string;
  files: FileRow[];
  used: number;
  quota: number;
  trashed: boolean;
  search: string;
  canUpload: boolean;
  canDelete: boolean;
  directUploads: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [dropping, setDropping] = useState(false);
  const [uploading, setUploading] = useState<{ name: string; done: boolean }[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const send = (list: FileList | null, replacesId?: string) => {
    if (!list || list.length === 0 || !canUpload) return;

    const queue = [...list];
    setUploading(queue.map((file) => ({ name: file.name, done: false })));

    startTransition(async () => {
      for (const file of queue) {
        let result: Awaited<ReturnType<typeof uploadFile>>;
        let directKey: string | null = null;
        try {
          if (directUploads) {
            const prepared = await prepareBlobUpload({
              groupId,
              filename: file.name,
              sizeBytes: file.size,
            });

            if (!prepared.ok) {
              result = prepared;
            } else {
              directKey = prepared.key;
              await uploadBlob(prepared.key, file, {
                access: "private",
                handleUploadUrl: "/api/blob-upload",
                clientPayload: JSON.stringify({
                  groupId,
                  uploaderId: prepared.uploaderId,
                  filename: file.name,
                  sizeBytes: file.size,
                }),
                multipart: file.size > 4_500_000,
              });

              const data = new FormData();
              data.set("groupId", groupId);
              data.set("fileName", file.name);
              data.set("fileSize", String(file.size));
              data.set("storageKey", prepared.key);
              if (replacesId) data.set("replacesId", replacesId);
              result = await uploadFile(null, data);
            }
          } else {
            const data = new FormData();
            data.set("groupId", groupId);
            data.set("file", file);
            if (replacesId) data.set("replacesId", replacesId);
            result = await uploadFile(null, data);
          }
        } catch (error) {
          result = {
            ok: false,
            error: error instanceof Error ? error.message : "The upload failed.",
          };
        }

        if (!result.ok && directKey) {
          try {
            const cleanup = await discardBlobUpload(groupId, directKey);
            if (!cleanup.ok) {
              toast({
                tone: "warning",
                title: `${file.name} cleanup`,
                description: cleanup.error,
              });
            }
          } catch (error) {
            toast({
              tone: "warning",
              title: `${file.name} cleanup`,
              description:
                error instanceof Error
                  ? error.message
                  : "The temporary upload could not be removed.",
            });
          }
        }

        setUploading((current) =>
          current.map((row) => (row.name === file.name ? { ...row, done: true } : row)),
        );

        if (!result.ok) {
          toast({ tone: "error", title: file.name, description: result.error });
        }
      }

      setUploading([]);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form className="flex items-center gap-2" role="search">
          <label htmlFor="file-search" className="sr-only">
            Search files
          </label>
          <Input
            id="file-search"
            name="q"
            defaultValue={search}
            placeholder="Search files…"
            className="w-56"
          />
          {trashed ? <input type="hidden" name="view" value="trash" /> : null}
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link
              href={trashed ? `/groups/${groupId}/files` : `/groups/${groupId}/files?view=trash`}
            >
              {trashed ? "Back to files" : "Trash"}
            </Link>
          </Button>

          {canUpload && !trashed ? (
            <Button size="sm" onClick={() => input.current?.click()}>
              <UploadIcon />
              Upload
            </Button>
          ) : null}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        multiple
        className="sr-only"
        onChange={(event) => {
          send(event.target.files);
          event.target.value = "";
        }}
      />

      <div className="grid gap-1.5">
        <Progress value={Math.round((used / quota) * 100)} label="Storage used" />
        <p className="text-xs text-fg-subtle">
          {bytes(used)} of {bytes(quota)} used · 25 MB per file
        </p>
      </div>

      {uploading.length > 0 ? (
        <ul className="grid gap-1 rounded-lg border border-border p-3 text-sm">
          {uploading.map((row) => (
            <li key={row.name} className="flex items-center justify-between gap-2">
              <span className="truncate">{row.name}</span>
              <span className="shrink-0 text-xs text-fg-subtle">
                {row.done ? "done" : "uploading…"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {canUpload && !trashed ? (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDropping(true);
          }}
          onDragLeave={() => setDropping(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDropping(false);
            send(event.dataTransfer.files);
          }}
          className={cn(
            "rounded-xl border border-dashed px-4 py-6 text-center text-sm transition-colors",
            dropping ? "border-primary bg-primary-50/40" : "border-border text-fg-muted",
          )}
        >
          Drop files here, or use the Upload button. We check what a file actually is, not what it
          is named.
        </div>
      ) : null}

      {files.length === 0 ? (
        <EmptyState
          title={trashed ? "The trash is empty" : "No files yet"}
          description={
            trashed
              ? "Deleted files stay here for 30 days before they go for good."
              : "Reports, datasets, diagrams, slides. Every upload is recorded against whoever added it."
          }
          action={
            canUpload && !trashed ? (
              <Button onClick={() => input.current?.click()}>Upload a file</Button>
            ) : null
          }
        />
      ) : (
        <ul className="grid divide-y divide-border rounded-xl border border-border">
          {files.map((file) => (
            <li key={file.id} className="grid gap-3 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="shrink-0 text-fg-subtle">
                  <FileIcon />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="truncate">{file.name}</span>
                    {file.versions.length > 1 ? (
                      <Badge tone="outline">v{file.versions[0]!.version}</Badge>
                    ) : null}
                    <Badge tone="neutral">{kindOf(file.mimeType)}</Badge>
                  </p>
                  <p className="text-xs text-fg-muted">
                    {bytes(file.sizeBytes)} · {file.uploader.name} ·{" "}
                    {file.createdAt.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {file.versions.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-expanded={expanded === file.id}
                      onClick={() => setExpanded(expanded === file.id ? null : file.id)}
                    >
                      {file.versions.length} versions
                    </Button>
                  ) : null}

                  {file.deletedAt ? null : (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      iconOnly
                      aria-label={`Download ${file.name}`}
                    >
                      {/* The only path to a user file. Never a static URL. */}
                      <a href={`/api/files/${file.id}`}>
                        <DownloadIcon />
                      </a>
                    </Button>
                  )}

                  {canDelete ? (
                    <ActionButton
                      action={trashFile}
                      hidden={{
                        groupId,
                        fileId: file.id,
                        restore: file.deletedAt ? "true" : undefined,
                      }}
                      variant="ghost"
                      size="sm"
                      label={file.deletedAt ? "Restore" : <TrashIcon />}
                      confirm={
                        file.deletedAt
                          ? undefined
                          : `Move "${file.name}" to the trash? It stays recoverable for 30 days.`
                      }
                    />
                  ) : null}
                </div>
              </div>

              {expanded === file.id ? (
                <ol className="grid gap-2 border-l-2 border-border pl-4">
                  {file.versions.map((version) => (
                    <li key={version.id} className="flex flex-wrap items-center gap-2 text-xs">
                      <Avatar
                        name={version.uploader.name}
                        src={version.uploader.avatarUrl}
                        seed={version.uploader.id}
                        size="xs"
                      />
                      <span className="font-medium">v{version.version}</span>
                      <span className="text-fg-muted">{version.uploader.name}</span>
                      <time dateTime={version.createdAt.toISOString()} className="text-fg-subtle">
                        {version.createdAt.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </time>
                      {version.note ? (
                        <span className="text-fg-muted">— {version.note}</span>
                      ) : null}

                      {canUpload && version.version !== file.versions[0]!.version ? (
                        <ActionButton
                          action={restoreVersion}
                          hidden={{ groupId, fileId: file.id, versionId: version.id }}
                          variant="ghost"
                          size="sm"
                          label="Restore"
                        />
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
