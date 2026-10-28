import { env } from "@/lib/env";

import { blobStorage } from "./blob";
import { localStorage } from "./local";
import type { StorageProvider } from "./provider";

export function storage(): StorageProvider {
  if (env.STORAGE_DRIVER === "local") return localStorage;
  if (env.STORAGE_DRIVER === "blob") return blobStorage;

  throw new Error(`Unsupported storage driver: ${env.STORAGE_DRIVER}`);
}
