import { SECTION_LOCK_MINUTES } from "@/config/sections";

/**
 * The soft lock, read side.
 *
 * In its own module rather than beside `claimSectionLock` because that file is
 * `"use server"`, and **a Server Action file may export only async functions** —
 * a synchronous helper there is a build failure, not a style question. Phase 7
 * learned this twice; `config/tasks.ts` and `config/storage.ts` exist for the
 * same reason.
 *
 * What the lock is, and is not: it tells the second person that somebody else
 * is in this section right now. It does not prevent the save. CRDT merge is out
 * of scope and a hard lock would be worse than nothing — a lock held by a
 * closed browser tab is an obstruction with no unlock button anybody can find.
 */
export function activeEditorId(
  section: { lockedById: string | null; lockedAt: Date | null },
  viewerId: string,
  now = new Date(),
): string | null {
  if (!section.lockedById || section.lockedById === viewerId || !section.lockedAt) return null;

  const expired = now.getTime() - section.lockedAt.getTime() > SECTION_LOCK_MINUTES * 60_000;
  return expired ? null : section.lockedById;
}
