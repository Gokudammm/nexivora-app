import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { BlobNotFoundError, del, get, head, put } from "@vercel/blob";

import type { StorageProvider, StoredObject } from "./provider";

export const blobStorage: StorageProvider = {
  name: "blob",

  async put(key, data): Promise<StoredObject> {
    await put(key, Buffer.from(data), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
    });

    return {
      key,
      sizeBytes: data.byteLength,
      checksum: createHash("sha256").update(data).digest("hex"),
    };
  },

  async get(key): Promise<Uint8Array | null> {
    const blob = await get(key, { access: "private" });
    if (!blob || blob.statusCode !== 200 || !blob.stream) return null;

    return new Uint8Array(await new Response(blob.stream).arrayBuffer());
  },

  async size(key): Promise<number | null> {
    try {
      return (await head(key)).size;
    } catch (error) {
      if (error instanceof BlobNotFoundError) return null;
      throw error;
    }
  },

  async delete(key): Promise<void> {
    await del(key);
  },
};
