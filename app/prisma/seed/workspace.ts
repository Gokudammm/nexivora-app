import type { $Enums, Prisma, PrismaClient } from "@prisma/client";

import { LEDGER_WEIGHTS } from "../../src/config/ledger.ts";
import { projects } from "../../src/content/projects.ts";
import { SILENT_MEMBER_INDEX, STRUGGLING_GROUP_SLUG, groupId, type Groups } from "./groups.ts";
import { seedFileObjects } from "./files.ts";
import { daysAfter, iso, seedId, step, type Rng } from "./lib.ts";
import { userId } from "./people.ts";
import type { Projects } from "./projects.ts";

/**
 * The workspace: tasks, files, threads, messages, meetings — and the ledger
 * derived from them.
 *
 * The ledger is the reason this module is careful. Every `LedgerEvent` written
 * here points at a row that also exists, because that is the invariant the
 * whole feature rests on: a contribution record that can drift from the actions
 * that produced it is worse than no record, since it still looks authoritative.
 * `scripts/verify-db.mjs` asserts exactly this, and it should be impossible to
 * satisfy it by accident.
 */

type LedgerRow = {
  id: string;
  groupId: string;
  userId: string;
  kind: keyof typeof LEDGER_WEIGHTS;
  subjectType: string;
  subjectId: string;
  weight: number;
  createdAt: Date;
};

const TASK_TITLES = [
  "Write the problem statement",
  "Survey existing approaches",
  "Draft the system diagram",
  "Order the sensor components",
  "Set up the development environment",
  "Build the data ingestion script",
  "Calibrate the sensors against a reference",
  "Write the first integration test",
  "Collect a week of field data",
  "Clean and label the dataset",
  "Train the baseline model",
  "Compare against the naive baseline",
  "Design the dashboard layout",
  "Wire the API to the front end",
  "Run the pilot with two users",
  "Write up the results section",
  "Prepare the demo script",
  "Fix the reconnection bug",
  "Document the deployment steps",
  "Prepare slides for the review",
];

const THREAD_SEEDS: Array<{ kind: $Enums.ThreadKind; title: string; body: string }> = [
  {
    kind: "DECISION",
    title: "Which microcontroller do we standardise on?",
    body: "We have ESP32 boards in the lab already and the power budget works out. The alternative is an STM32, which is better on precision but nobody here has used one. Proposing ESP32 unless someone objects by Friday.",
  },
  {
    kind: "BLOCKER",
    title: "Sensor readings drift after about six hours",
    body: "Calibrated at 09:00, by 15:00 the moisture readings are off by roughly 12%. Temperature compensation is the obvious suspect but I have not confirmed it. Has anyone seen the datasheet note on this?",
  },
  {
    kind: "QUESTION",
    title: "How much field data do we actually need?",
    body: "Before we commit three weeks to collection — what is the smallest dataset that would let us say anything defensible?",
  },
  {
    kind: "GENERAL",
    title: "Review slot confirmed for the 14th",
    body: "Dr Rao can see us at 15:00 on the 14th. Everything in the results section needs to be at least drafted by the 12th so there is time to read it.",
  },
];

const MESSAGE_BODIES = [
  "Agreed. I will pick this up tomorrow morning.",
  "Confirmed against the datasheet — it is temperature compensation. Section 7.3.",
  "I pushed a fix for this, but it needs a second pair of eyes before we merge.",
  "Can we park this until after the review? It is not blocking anything right now.",
  "Tried that. It works for the first three readings and then fails the same way.",
  "I have the field data uploaded. It is messier than we hoped — about 8% of rows are missing timestamps.",
  "Good catch. That would have bitten us during the demo.",
  "I will bring this up with the guide on Thursday and report back.",
];

const FILE_NAMES = [
  { name: "system-architecture.pdf", mime: "application/pdf" },
  { name: "field-data-week-1.csv", mime: "text/csv" },
  {
    name: "sensor-calibration-log.xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
  { name: "prototype-photos.zip", mime: "application/zip" },
  { name: "literature-review-notes.md", mime: "text/markdown" },
  { name: "demo-script.pdf", mime: "application/pdf" },
  { name: "results-analysis.ipynb", mime: "application/x-ipynb+json" },
];

/**
 * When a group's workspace activity happened.
 *
 * A **finished** project keeps its real dates: its record is history and should
 * read as history. An **in-flight** one is rebased onto the last ten weeks,
 * because a running project whose last recorded event is nine months old is not
 * a running project — it is a bug in the demo world.
 *
 * Phase 9 is where this started to matter. Health signals are the first feature
 * that compares seeded data against `now`, and with fixed 2025 dates every
 * group in the demo tripped the stalled threshold: four of four flagged, which
 * ranks nothing and makes the dashboard worth exactly as much as no dashboard.
 * The signal logic was right; the data aged out from under it.
 *
 * The RNG stream is untouched, so the run stays deterministic in everything
 * except the timestamps — which is the one thing that has to move.
 */
function activityAnchor(status: string, startedOn: Date): Date {
  if (status !== "proposed" && status !== "progress") return startedOn;

  const weeks = status === "proposed" ? 4 : 10;
  const anchor = new Date();
  anchor.setUTCHours(9, 0, 0, 0);
  anchor.setUTCDate(anchor.getUTCDate() - weeks * 7);

  // Never move a project forward in time — a fixture that legitimately starts
  // next term should stay where it is.
  return anchor > startedOn ? anchor : startedOn;
}

export async function seedWorkspace(
  db: PrismaClient,
  rng: Rng,
  groups: Groups,
  projectIndex: Projects,
): Promise<{ ledgerCount: number }> {
  const taskRows: Prisma.TaskCreateManyInput[] = [];
  const assigneeRows: Prisma.TaskAssigneeCreateManyInput[] = [];
  const fileRows: Prisma.FileAssetCreateManyInput[] = [];
  const versionRows: Prisma.FileVersionCreateManyInput[] = [];
  const threadRows: Prisma.ThreadCreateManyInput[] = [];
  const messageRows: Prisma.MessageCreateManyInput[] = [];
  const meetingRows: Prisma.MeetingCreateManyInput[] = [];
  const attendanceRows: Prisma.MeetingAttendanceCreateManyInput[] = [];
  const ledger: LedgerRow[] = [];

  const record = (
    kind: keyof typeof LEDGER_WEIGHTS,
    group: string,
    username: string,
    subjectType: string,
    subjectId: string,
    createdAt: Date,
  ) => {
    ledger.push({
      id: seedId("ledger", subjectType, subjectId, username, kind),
      groupId: group,
      userId: userId(username),
      kind,
      subjectType,
      subjectId,
      // Denormalised at write time so a later tuning of config/ledger.ts does
      // not retroactively change what past work was worth.
      weight: LEDGER_WEIGHTS[kind],
      createdAt,
    });
  };

  for (const project of projects) {
    const group = groupId(project.slug);
    const members = groups.membersByGroup.get(group) ?? [];
    if (members.length === 0) continue;

    const startedOn = activityAnchor(project.status, iso(project.startedOn));
    const isStruggling = project.slug === STRUGGLING_GROUP_SLUG;

    // A proposed project has a workspace but almost nothing in it yet — which
    // is itself a state the empty-state screens need to render.
    const intensity =
      project.status === "proposed" ? 0.15 : project.status === "progress" ? 0.7 : 1;

    /**
     * The one member whose ledger stays near-empty, so Phase 9's health signal
     * has a real case to fire on. Everything about this member is normal except
     * that the work never lands on them.
     */
    const silent = isStruggling ? members[SILENT_MEMBER_INDEX] : undefined;
    const workers = members.filter((username) => username !== silent);

    /* ----------------------------------------------------------- tasks */

    const taskCount = Math.round(TASK_TITLES.length * intensity);
    const milestones = projectIndex.milestonesByProject.get(project.slug) ?? [];

    for (let i = 0; i < taskCount; i += 1) {
      const title = TASK_TITLES[i % TASK_TITLES.length] ?? "Task";
      const taskId = seedId("task", project.slug, i);
      const createdAt = daysAfter(startedOn, 3 + i * 6);
      const assignee = rng.pick(workers);

      const done = i < taskCount * (project.status === "progress" ? 0.6 : 0.9);
      const closedAt = done ? daysAfter(createdAt, rng.int(2, 9)) : null;

      taskRows.push({
        id: taskId,
        groupId: group,
        creatorId: userId(members[0] ?? assignee),
        milestoneId: milestones[Math.min(Math.floor(i / 4), milestones.length - 1)] ?? null,
        title,
        status: done ? "DONE" : i === taskCount - 1 ? "IN_PROGRESS" : "TODO",
        priority: rng.pick(["LOW", "MEDIUM", "MEDIUM", "HIGH"] as const),
        dueDate: daysAfter(createdAt, 10),
        position: i,
        closedAt,
        createdAt,
      });

      assigneeRows.push({
        id: seedId("tassignee", taskId, assignee),
        taskId,
        userId: userId(assignee),
        createdAt,
      });

      if (closedAt) record("TASK_CLOSED", group, assignee, "Task", taskId, closedAt);
    }

    /* ----------------------------------------------------------- files */

    const fileCount = Math.max(1, Math.round(FILE_NAMES.length * intensity));

    for (let i = 0; i < fileCount; i += 1) {
      const spec = FILE_NAMES[i % FILE_NAMES.length];
      if (!spec) continue;

      const fileId = seedId("file", project.slug, i);
      const uploader = rng.pick(workers);
      const createdAt = daysAfter(startedOn, 10 + i * 12);

      fileRows.push({
        id: fileId,
        groupId: group,
        uploaderId: userId(uploader),
        folder: "/",
        name: spec.name,
        mimeType: spec.mime,
        sizeBytes: rng.int(24_000, 4_200_000),
        // A generated key, never the original filename: the filename is
        // metadata and must never become a path (docs/SECURITY.md §4).
        storageKey: seedId("storage", project.slug, i),
        quarantined: false,
        createdAt,
      });

      versionRows.push({
        id: seedId("fversion", fileId, 1),
        fileId,
        uploaderId: userId(uploader),
        version: 1,
        storageKey: seedId("storage", project.slug, i),
        sizeBytes: rng.int(24_000, 4_200_000),
        createdAt,
      });

      record("FILE_ADDED", group, uploader, "FileAsset", fileId, createdAt);

      // Some files get revised, which is the honest picture of project work.
      if (rng.chance(0.4)) {
        const reviser = rng.pick(workers);
        const revisedAt = daysAfter(createdAt, rng.int(3, 20));
        const versionId = seedId("fversion", fileId, 2);

        versionRows.push({
          id: versionId,
          fileId,
          uploaderId: userId(reviser),
          version: 2,
          storageKey: seedId("storage", project.slug, i, "v2"),
          sizeBytes: rng.int(24_000, 4_200_000),
          note: "Incorporated review comments",
          createdAt: revisedAt,
        });

        record("FILE_REVISED", group, reviser, "FileVersion", versionId, revisedAt);
      }
    }

    /* --------------------------------------------------------- threads */

    const threadCount = Math.max(1, Math.round(THREAD_SEEDS.length * intensity));

    for (let i = 0; i < threadCount; i += 1) {
      const spec = THREAD_SEEDS[i % THREAD_SEEDS.length];
      if (!spec) continue;

      const threadId = seedId("thread", project.slug, i);
      const author = rng.pick(workers);
      const createdAt = daysAfter(startedOn, 8 + i * 21);

      threadRows.push({
        id: threadId,
        groupId: group,
        authorId: userId(author),
        kind: spec.kind,
        title: spec.title,
        body: spec.body,
        pinned: i === 0,
        resolvedAt: spec.kind === "BLOCKER" ? daysAfter(createdAt, 4) : null,
        createdAt,
      });

      record("THREAD_STARTED", group, author, "Thread", threadId, createdAt);

      const replyCount = rng.int(2, 5);
      for (let j = 0; j < replyCount; j += 1) {
        const messageId = seedId("message", threadId, j);
        const speaker = rng.pick(workers);
        const postedAt = daysAfter(createdAt, j + 1);

        messageRows.push({
          id: messageId,
          threadId,
          authorId: userId(speaker),
          body: MESSAGE_BODIES[(i + j) % MESSAGE_BODIES.length] ?? "Noted.",
          createdAt: postedAt,
        });

        record("MESSAGE_POSTED", group, speaker, "Message", messageId, postedAt);
      }
    }

    /* -------------------------------------------------------- meetings */

    const meetingCount = Math.max(1, Math.round(4 * intensity));

    for (let i = 0; i < meetingCount; i += 1) {
      const meetingId = seedId("meeting", project.slug, i);
      const host = members[0] ?? workers[0];
      if (!host) continue;

      const startsAt = daysAfter(startedOn, 21 + i * 28);

      meetingRows.push({
        id: meetingId,
        groupId: group,
        hostId: userId(host),
        title: i === 0 ? "Kickoff and scope" : `Weekly sync ${i}`,
        agenda: "Progress since last week, blockers, what each person is picking up next.",
        startsAt,
        durationMinutes: 30,
        // We do not host video. A join link, and the interface says so.
        joinUrl: "https://meet.example.org/nexivora-demo",
        createdAt: daysAfter(startsAt, -3),
      });

      for (const username of members) {
        // The silent member is invited to everything and attends almost nothing.
        const attended = username === silent ? rng.chance(0.2) : rng.chance(0.9);

        attendanceRows.push({
          id: seedId("attendance", meetingId, username),
          meetingId,
          userId: userId(username),
          rsvp: true,
          attended,
          createdAt: startsAt,
        });

        if (attended) record("MEETING_ATTENDED", group, username, "Meeting", meetingId, startsAt);
      }
    }
  }

  await db.task.createMany({ data: taskRows });
  await db.taskAssignee.createMany({ data: assigneeRows });
  step("tasks", taskRows.length);

  // Real bytes, written before the rows. Until this existed the demo world
  // had 90 file rows and nothing behind them, so every download 404'd — the
  // route was right and the seed was lying. Sizes come from what was actually
  // written, so the quota bar and the file list agree with the disk.
  const nameByFileId = new Map(
    fileRows.map((row) => [String(row.id), { name: String(row.name), mime: String(row.mimeType) }]),
  );

  const objects = [
    ...fileRows.map((row) => ({
      storageKey: String(row.storageKey),
      name: String(row.name),
      mimeType: String(row.mimeType),
    })),
    // Version objects too. A restore points the asset at an older object, and a
    // v2 with no bytes behind it is the same 404 in a less obvious place.
    ...versionRows.map((row) => {
      const parent = nameByFileId.get(String(row.fileId));
      return {
        storageKey: String(row.storageKey),
        name: parent?.name ?? "revision.txt",
        mimeType: parent?.mime ?? "text/plain",
      };
    }),
  ];

  const written = await seedFileObjects(objects, process.env.UPLOAD_DIR ?? "./.uploads");

  const sizeByKey = new Map(written.sizes);
  for (const row of fileRows) {
    const size = sizeByKey.get(String(row.storageKey));
    if (size !== undefined) row.sizeBytes = size;
  }
  for (const row of versionRows) {
    const size = sizeByKey.get(String(row.storageKey));
    if (size !== undefined) row.sizeBytes = size;
  }

  await db.fileAsset.createMany({ data: fileRows });
  await db.fileVersion.createMany({ data: versionRows });
  step("files + versions", fileRows.length + versionRows.length);
  step("file objects on disk", written.written);

  await db.thread.createMany({ data: threadRows });
  await db.message.createMany({ data: messageRows });
  step("threads + messages", threadRows.length + messageRows.length);

  await db.meeting.createMany({ data: meetingRows });
  await db.meetingAttendance.createMany({ data: attendanceRows });
  step("meetings", meetingRows.length);

  await db.ledgerEvent.createMany({ data: ledger });
  step("ledger events", ledger.length);

  return { ledgerCount: ledger.length };
}
