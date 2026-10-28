import { createHash } from "node:crypto";

import type { $Enums } from "@prisma/client";

/**
 * THE SUBMISSION SNAPSHOT.
 *
 * What was submitted, exactly as it was, frozen. Acceptance criterion 8 asks
 * for it to be **byte-stable** — serialise the same record twice and get
 * identical bytes — and that is a stronger requirement than it first looks,
 * because `JSON.stringify` preserves *insertion order*, and a Prisma row's key
 * order depends on the shape of the `select`. Two snapshots of an unchanged
 * project could differ purely because somebody reordered a select clause.
 *
 * So `serialise()` sorts keys at every level and sorts every collection by a
 * declared key. The digest is then a fact about the content rather than about
 * how the query happened to be written, which is the only way a receipt saying
 * "this is what you submitted" means anything.
 *
 * The other half is what is deliberately **not** in a snapshot: no
 * `updatedAt`, no progress percentage, no computed field of any kind. A
 * snapshot records what the group wrote. Anything derived can be recomputed,
 * and storing it would create a second copy that can disagree with the first.
 */

export type SnapshotInput = {
  slug: string;
  title: string;
  summary: string;
  abstract: string;
  status: $Enums.ProjectStatus;
  visibility: $Enums.Visibility;
  domain: string;
  department: string;
  subject: string | null;
  techStack: readonly string[];
  keywords: readonly string[];
  repositoryUrl: string | null;
  demoUrl: string | null;
  videoUrl: string | null;
  startedOn: Date;
  completedOn: Date | null;
  embargoUntil: Date | null;
  sections: readonly {
    kind: $Enums.SectionKind;
    body: string;
    wordCount: number;
    complete: boolean;
  }[];
  members: readonly {
    username: string | null;
    name: string;
    role: string;
    tier: $Enums.ProofTier;
  }[];
  milestones: readonly {
    title: string;
    description: string | null;
    state: $Enums.MilestoneState;
    dueDate: Date | null;
    completedAt: Date | null;
  }[];
  topics: readonly string[];
  sdgs: readonly { goal: number; primary: boolean }[];
  files: readonly { name: string; sizeBytes: number; checksum: string | null }[];
};

export type Snapshot = {
  /** Bumped when the shape changes, so an old snapshot is still readable. */
  version: 1;
  submittedAt: string;
  round: number;
  submittedBy: string;
  digest: string;
  record: Record<string, unknown>;
};

/** ISO to the second. Milliseconds are noise in a submission receipt. */
const iso = (date: Date | null): string | null =>
  date ? date.toISOString().slice(0, 19) + "Z" : null;

/**
 * Deterministic JSON: keys sorted at every depth, arrays left in the order the
 * caller established (which `buildRecord` sorts explicitly).
 */
export function stableStringify(value: unknown): string {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      return Object.fromEntries(
        Object.entries(node as Record<string, unknown>)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, entry]) => [key, walk(entry)]),
      );
    }
    return node;
  };

  return JSON.stringify(walk(value));
}

/**
 * The record, with every collection in a declared order.
 *
 * Sections sort by their canonical order rather than alphabetically, because a
 * snapshot is also a document somebody may read — and "Conclusion, Future work,
 * Methodology, Problem…" is not a report.
 */
function buildRecord(input: SnapshotInput, sectionOrder: readonly $Enums.SectionKind[]) {
  const orderOf = (kind: $Enums.SectionKind) => {
    const index = sectionOrder.indexOf(kind);
    return index === -1 ? sectionOrder.length : index;
  };

  return {
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    abstract: input.abstract,
    status: input.status,
    visibility: input.visibility,
    domain: input.domain,
    department: input.department,
    subject: input.subject,
    techStack: [...input.techStack].sort(),
    keywords: [...input.keywords].sort(),
    repositoryUrl: input.repositoryUrl,
    demoUrl: input.demoUrl,
    videoUrl: input.videoUrl,
    startedOn: iso(input.startedOn),
    completedOn: iso(input.completedOn),
    embargoUntil: iso(input.embargoUntil),

    sections: [...input.sections]
      .sort((a, b) => orderOf(a.kind) - orderOf(b.kind))
      .map((section) => ({
        kind: section.kind,
        body: section.body,
        wordCount: section.wordCount,
        complete: section.complete,
      })),

    members: [...input.members]
      .sort((a, b) => (a.username ?? a.name).localeCompare(b.username ?? b.name))
      .map((member) => ({
        username: member.username,
        name: member.name,
        role: member.role,
        tier: member.tier,
      })),

    milestones: [...input.milestones]
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((milestone) => ({
        title: milestone.title,
        description: milestone.description,
        state: milestone.state,
        dueDate: iso(milestone.dueDate),
        completedAt: iso(milestone.completedAt),
      })),

    topics: [...input.topics].sort(),
    sdgs: [...input.sdgs].sort((a, b) => a.goal - b.goal),

    // Files by checksum and name, never by id: a snapshot has to remain
    // meaningful after the objects behind it are moved or re-keyed.
    files: [...input.files]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((file) => ({ name: file.name, sizeBytes: file.sizeBytes, checksum: file.checksum })),
  };
}

export function createSnapshot(
  input: SnapshotInput,
  meta: { round: number; submittedBy: string; submittedAt: Date },
  sectionOrder: readonly $Enums.SectionKind[],
): Snapshot {
  const record = buildRecord(input, sectionOrder);

  return {
    version: 1,
    round: meta.round,
    submittedBy: meta.submittedBy,
    submittedAt: iso(meta.submittedAt)!,
    // The digest covers the record only. Including the timestamp would make two
    // submissions of identical work look like different work, which defeats the
    // one question a digest is useful for: did anything actually change?
    digest: createHash("sha256").update(stableStringify(record)).digest("hex").slice(0, 16),
    record,
  };
}

/** True when two snapshots contain the same work, whenever they were taken. */
export const sameContent = (a: Snapshot, b: Snapshot): boolean => a.digest === b.digest;
