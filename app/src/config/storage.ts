/**
 * Storage limits.
 *
 * In `config/` rather than beside the upload action for a reason the build
 * enforces: a `"use server"` module may export **only async functions**, so a
 * constant living there is a build failure, not a style question. The same rule
 * that keeps client components out of query modules applies here in the other
 * direction — a Server Action file exports actions, and nothing else.
 *
 * The per-file cap is `MAX_UPLOAD_BYTES` in the environment, because it is the
 * one a deployment may reasonably want to lower. The per-group quota is here
 * because it is a product decision (docs/SECURITY.md §4), not an operational
 * one, and a college that needs a different number gets it per-college later.
 */

/** 2 GB per group. */
export const GROUP_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;

/** How long a trashed file stays recoverable. */
export const TRASH_RETENTION_DAYS = 30;
