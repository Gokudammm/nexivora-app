import type { Prisma, PrismaClient } from "@prisma/client";

import { LEDGER_WEIGHTS, type LedgerEventKind } from "@/config/ledger";

/**
 * WRITING TO THE CONTRIBUTION LEDGER (ADR-007).
 *
 * One function, and its signature is the feature.
 *
 * **`tx` is required, and it is required first.** A ledger event written after
 * the action that produced it — in a second statement, outside the
 * transaction — produces a record that can disagree with reality the moment
 * anything fails between them. A ledger that can be wrong is worse than no
 * ledger, because it still looks authoritative and people will act on it. So
 * the type system does not offer the unsafe version: there is no overload that
 * takes the global client, and `db.$transaction` is the only way to get a value
 * of the type this parameter accepts.
 *
 * **There is no update and no delete.** Not "we do not call them" — this module
 * exports neither, and nothing else in the product may write to `LedgerEvent`.
 * Corrections are compensating events, which is the discipline accounting uses
 * and for the same reason: the record of what happened should not change when
 * somebody's opinion of it does. Acceptance criterion 8 asserts that attempting
 * an update through this wrapper is a *type* error, not a runtime one.
 *
 * **The weight is denormalised at write time.** Tuning `config/ledger.ts` must
 * change what future contribution is worth without silently rewriting what past
 * contribution was worth. A number in that file is never a migration.
 */

/**
 * A transaction client.
 *
 * Deliberately not `PrismaClient`: the interactive-transaction client is
 * missing `$transaction` and the other top-level methods, and that difference
 * is exactly what makes "you must be inside a transaction" checkable rather
 * than merely documented.
 */
export type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export type LedgerWrite = {
  groupId: string;
  userId: string;
  kind: LedgerEventKind;
  /** The row that caused this — a Task, FileAsset, Thread, Message or Meeting. */
  subjectType:
    | "Task"
    | "FileAsset"
    | "FileVersion"
    | "Thread"
    | "Message"
    | "Meeting"
    | "Milestone"
    | "PeerReview"
    | "Commit";
  subjectId: string;
  metadata?: Prisma.InputJsonValue;
  /** Overrides `now()` for backfills and tests. Never used by application code. */
  createdAt?: Date;
};

/**
 * Record one contribution.
 *
 * Called with the same `tx` as the action it describes, so the two commit or
 * roll back together. `db:verify` asserts every event points at a row that
 * exists, and that assertion is the feature's entire credibility.
 */
export async function recordLedgerEvent(tx: Tx, event: LedgerWrite): Promise<void> {
  await tx.ledgerEvent.create({
    data: {
      groupId: event.groupId,
      userId: event.userId,
      kind: event.kind,
      subjectType: event.subjectType,
      subjectId: event.subjectId,
      weight: LEDGER_WEIGHTS[event.kind],
      ...(event.metadata === undefined ? {} : { metadata: event.metadata }),
      ...(event.createdAt ? { createdAt: event.createdAt } : {}),
    },
  });
}

/**
 * Record several contributions from one action.
 *
 * A meeting marks attendance for everybody present; a milestone close credits
 * its owner and every reviewer. Same transaction, same guarantee.
 */
export async function recordLedgerEvents(tx: Tx, events: readonly LedgerWrite[]): Promise<void> {
  if (events.length === 0) return;

  await tx.ledgerEvent.createMany({
    data: events.map((event) => ({
      groupId: event.groupId,
      userId: event.userId,
      kind: event.kind,
      subjectType: event.subjectType,
      subjectId: event.subjectId,
      weight: LEDGER_WEIGHTS[event.kind],
      ...(event.metadata === undefined ? {} : { metadata: event.metadata }),
      ...(event.createdAt ? { createdAt: event.createdAt } : {}),
    })),
  });
}

/**
 * Withdraw a contribution that was recorded and then undone — a task reopened
 * after being closed, a file deleted after being uploaded.
 *
 * This is the *only* correction mechanism, and it is an append, not an edit:
 * a new event with a negative weight, pointing at the same subject. The
 * original stays exactly as it was, so "this was closed on Tuesday and reopened
 * on Wednesday" remains readable — which is the honest account, and the one a
 * mutable row would have destroyed.
 */
export async function compensateLedgerEvent(tx: Tx, event: LedgerWrite): Promise<void> {
  await tx.ledgerEvent.create({
    data: {
      groupId: event.groupId,
      userId: event.userId,
      kind: event.kind,
      subjectType: event.subjectType,
      subjectId: event.subjectId,
      weight: -LEDGER_WEIGHTS[event.kind],
      metadata: {
        ...(typeof event.metadata === "object" && event.metadata !== null
          ? (event.metadata as Record<string, unknown>)
          : {}),
        compensating: true,
      },
    },
  });
}
