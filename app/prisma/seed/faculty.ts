import type { PrismaClient } from "@prisma/client";

import { SECTION_ORDER } from "../../src/config/sections.ts";
import { createSnapshot } from "../../src/lib/project/snapshot.ts";
import { daysAfter, iso, seedId, step } from "./lib.ts";
import { userId, type Cast } from "./people.ts";

/**
 * THE FACULTY DESK — Phase 9's own seed.
 *
 * Everything the faculty screens are *about* was missing from the demo world
 * until this file existed: zero projects awaiting review, zero submissions,
 * zero announcements, zero open blockers. The evaluation seed covers the past
 * tense — twelve released evaluations on completed work — and none of the
 * present tense, which is the only tense `/faculty` is about.
 *
 * The consequence of leaving it that way is the failure Phase 7 already learned
 * once with `FileAsset`: a feature built against data where it can never fire
 * gets built wrong, looks fine in every green check, and is discovered broken
 * by the first real user. A submission queue that is empty in the demo is a
 * queue nobody ever looked at.
 *
 * Four things, deliberately small:
 *
 *  1 · One project actually **awaiting review**, with its submission snapshot.
 *  2 · An **open blocker** in a supervised group, old enough to fire a signal.
 *  3 · Two announcements on a real class — one posted, one **scheduled**, so
 *      the "invisible until then" path has something behind it.
 *
 * What is deliberately *not* seeded is a draft evaluation. Criterion 9 — draft
 * feedback invisible until release — is only worth anything if the draft was
 * written through the real form, so `scripts/check-faculty.mjs` writes it.
 */

/** Meera Rao supervises this one, and it has all nine sections written. */
const AWAITING_REVIEW = "soil-moisture-irrigation-control";

export async function seedFacultyDesk(db: PrismaClient, cast: Cast): Promise<void> {
  const evaluator = cast.usernameByName.get("Dr Meera Rao") ?? "meera-rao";

  /* ------------------------------------------------- 1 · awaiting review */

  const project = await db.project.findUnique({
    where: { slug: AWAITING_REVIEW },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      abstract: true,
      status: true,
      visibility: true,
      domain: true,
      department: true,
      subject: true,
      techStack: true,
      keywords: true,
      repositoryUrl: true,
      demoUrl: true,
      videoUrl: true,
      startedOn: true,
      completedOn: true,
      embargoUntil: true,
      groupId: true,
      topics: { select: { topic: { select: { slug: true } } } },
      sdgs: { select: { goal: true, primary: true } },
      sections: { select: { kind: true, body: true, wordCount: true, complete: true } },
      members: {
        select: {
          userId: true,
          role: true,
          tier: true,
          user: { select: { name: true, username: true } },
        },
      },
      milestones: {
        select: {
          title: true,
          description: true,
          state: true,
          dueDate: true,
          completedAt: true,
        },
      },
    },
  });

  if (!project) {
    // A rename upstream should be loud rather than quietly leaving the queue
    // empty again — the whole point of this file is that an empty queue is a
    // defect, not a state.
    throw new Error(`seedFacultyDesk: no project with slug "${AWAITING_REVIEW}"`);
  }

  const submittedBy = project.members[0]?.userId ?? userId(evaluator);
  const submittedAt = iso("2026-09-04");

  const files = project.groupId
    ? await db.fileAsset.findMany({
        where: { groupId: project.groupId, deletedAt: null },
        select: { name: true, sizeBytes: true, checksum: true },
      })
    : [];

  const snapshot = createSnapshot(
    {
      slug: project.slug,
      title: project.title,
      summary: project.summary,
      abstract: project.abstract,
      // `UNDER_REVIEW`, matching what `transitions.ts` writes — the snapshot is
      // the record as it entered review, so the status it carries is the one it
      // is entering, not the one it is leaving.
      status: "UNDER_REVIEW",
      visibility: project.visibility,
      domain: project.domain,
      department: project.department,
      subject: project.subject,
      techStack: project.techStack,
      keywords: project.keywords,
      repositoryUrl: project.repositoryUrl,
      demoUrl: project.demoUrl,
      videoUrl: project.videoUrl,
      startedOn: project.startedOn,
      completedOn: project.completedOn,
      embargoUntil: project.embargoUntil,
      sections: project.sections,
      members: project.members.map((member) => ({
        username: member.user.username,
        name: member.user.name,
        role: member.role,
        tier: member.tier,
      })),
      milestones: project.milestones,
      topics: project.topics.map((entry) => entry.topic.slug),
      sdgs: project.sdgs,
      files,
    },
    { round: 1, submittedBy, submittedAt },
    SECTION_ORDER,
  );

  await db.projectSubmission.create({
    data: {
      id: seedId("submission", project.slug, 1),
      projectId: project.id,
      submittedById: submittedBy,
      round: 1,
      // Round-trips through JSON for the same reason `transitions.ts` does: the
      // Snapshot type is structurally richer than Prisma's InputJsonValue, and
      // a cast would hide a shape mismatch rather than fix one.
      snapshot: JSON.parse(JSON.stringify(snapshot)) as object,
      createdAt: submittedAt,
    },
  });

  await db.projectStatusEvent.create({
    data: {
      id: seedId("status-event", project.slug, "under-review"),
      projectId: project.id,
      actorId: submittedBy,
      from: project.status,
      to: "UNDER_REVIEW",
      reason: "Submitted for mid-term review.",
      createdAt: submittedAt,
    },
  });

  await db.project.update({
    where: { id: project.id },
    data: { status: "UNDER_REVIEW", updatedAt: submittedAt },
  });

  step("project awaiting review", 1);

  /* -------------------------------------------------- 2 · an open blocker */

  if (project.groupId) {
    await db.thread.create({
      data: {
        id: seedId("thread", "blocker", project.slug),
        groupId: project.groupId,
        authorId: submittedBy,
        kind: "BLOCKER",
        title: "Soil probes read 0% after the firmware update",
        body:
          "Three of the four probes have returned 0% since we flashed 1.4.2, and rolling back " +
          "does not fix it. We cannot collect a week of field data until this is resolved, which " +
          "puts the calibration milestone at risk.",
        // Older than the blocker threshold in config/health.ts, so the signal
        // this seeds is actually reachable rather than theoretically reachable.
        createdAt: daysAfter(submittedAt, -11),
      },
    });

    step("open blocker", 1);
  }

  /* ------------------------------------------------- 3 · announcements */

  const klass = await db.subjectAssignment.findFirst({
    where: { userId: userId(evaluator) },
    select: { classId: true, class: { select: { collegeId: true } } },
    orderBy: { classId: "asc" },
  });

  if (klass) {
    await db.announcement.createMany({
      data: [
        {
          id: seedId("announcement", "mid-term-review"),
          collegeId: klass.class.collegeId,
          authorId: userId(evaluator),
          classId: klass.classId,
          title: "Mid-term reviews: 18–20 September",
          body:
            "Twenty minutes per group in Lab 3. Bring the prototype, not slides about the " +
            "prototype. I will be reading your project record beforehand, so what is written " +
            "there is what I will ask about.",
          publishAt: iso("2026-09-06"),
          createdAt: iso("2026-09-06"),
        },
        {
          // Future `publishAt` — invisible to the class until then. There is no
          // job runner and none is needed: the query filters on the timestamp.
          id: seedId("announcement", "final-submission"),
          collegeId: klass.class.collegeId,
          authorId: userId(evaluator),
          classId: klass.classId,
          title: "Final submission window opens",
          body:
            "The submission window opens on the 1st and closes at 23:59 on the 14th. Late " +
            "submissions need a written reason from your department, not from me.",
          publishAt: iso("2026-10-01"),
          createdAt: iso("2026-09-06"),
        },
      ],
    });

    step("announcements", 2);
  }
}
