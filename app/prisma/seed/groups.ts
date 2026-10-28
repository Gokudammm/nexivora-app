import type { Prisma, PrismaClient } from "@prisma/client";

import { projects } from "../../src/content/projects.ts";
import type { Hierarchy } from "./hierarchy.ts";
import { collegeId } from "./hierarchy.ts";
import { iso, seedId, step, type Rng } from "./lib.ts";
import { userId, type Cast } from "./people.ts";

/**
 * Groups are where the work actually happens, so almost every later phase reads
 * this table. Each project team gets a group; a handful of groups exist without
 * a project because that is a real state (a team that formed and has not scoped
 * anything yet), and the empty-state screens need something to render.
 */

export const groupId = (slug: string) => seedId("group", slug);

/**
 * The group deliberately seeded with a member who does nothing.
 *
 * Phase 9's health signal is supposed to surface a team where the work is
 * landing on two people out of four. If the seed has no such team, that feature
 * gets built against data where it can never fire — and ships broken.
 */
export const STRUGGLING_GROUP_SLUG = "canal-scheduling-multi-farm";

/** In that group, this member's ledger stays deliberately near-empty. */
export const SILENT_MEMBER_INDEX = 2;

export type Groups = {
  /** project slug → group id, for the groups that back a project. */
  groupByProject: Map<string, string>;
  /** group id → member usernames, in a stable order. */
  membersByGroup: Map<string, string[]>;
  /** group id → college slug. */
  collegeByGroup: Map<string, string>;
  standaloneGroupIds: string[];
};

const STANDALONE_GROUPS = [
  {
    slug: "open-hardware-circle",
    name: "Open Hardware Circle",
    description:
      "Weekly build sessions. No project scoped yet — we are still surveying what is worth doing.",
  },
  {
    slug: "campus-data-collective",
    name: "Campus Data Collective",
    description: "Collecting and publishing open datasets about the campus itself.",
  },
  {
    slug: "accessibility-working-group",
    name: "Accessibility Working Group",
    description: "Auditing campus systems against WCAG and filing what we find.",
  },
  {
    slug: "reading-group-distributed-systems",
    name: "Distributed Systems Reading Group",
    description: "One paper a fortnight, with someone presenting.",
  },
];

export async function seedGroups(
  db: PrismaClient,
  rng: Rng,
  cast: Cast,
  hierarchy: Hierarchy,
): Promise<Groups> {
  const groupByProject = new Map<string, string>();
  const membersByGroup = new Map<string, string[]>();
  const collegeByGroup = new Map<string, string>();

  const groupRows: Prisma.GroupCreateManyInput[] = [];
  const memberRows: Prisma.GroupMemberCreateManyInput[] = [];

  /* --------------------------------------------------- one group per team */

  for (const project of projects) {
    const id = groupId(project.slug);
    const usernames = project.members.map((member) => member.username);

    // Find the class this project sits in, when one exists. Older terms have no
    // classes seeded, and a project can legitimately be extracurricular.
    const subject = hierarchy.subjects.find(
      (row) =>
        row.collegeSlug === project.collegeSlug &&
        row.department === project.department &&
        row.name === (project.subject || "Minor Project"),
    );

    const klass = subject
      ? hierarchy.classes.find(
          (row) => row.subjectId === subject.id && row.termName === project.term,
        )
      : undefined;

    groupRows.push({
      id,
      collegeId: collegeId(project.collegeSlug),
      classId: klass?.id ?? null,
      name: `${project.title} — team`,
      description: project.summary,
      sizeLimit: Math.max(4, usernames.length),
      joinPolicy: "INVITE_ONLY",
      // A group is at most group-visible even when its project is public: the
      // workspace is private working material, the project page is the output.
      visibility: "GROUP",
      createdAt: iso(project.startedOn),
      archivedAt:
        project.status === "archived" ? iso(project.completedOn ?? project.startedOn) : null,
    });

    groupByProject.set(project.slug, id);
    membersByGroup.set(id, usernames);
    collegeByGroup.set(id, project.collegeSlug);

    usernames.forEach((username, index) => {
      memberRows.push({
        id: seedId("gmember", project.slug, username),
        groupId: id,
        userId: userId(username),
        role: index === 0 ? "LEAD" : "MEMBER",
        joinedAt: iso(project.startedOn),
      });
    });
  }

  /* ------------------------------------------------- groups without a project */

  const standaloneGroupIds: string[] = [];
  const pool = cast.studentsByCollege.get("nexivora-institute-of-technology") ?? [];

  for (const group of STANDALONE_GROUPS) {
    const id = groupId(group.slug);
    const usernames = rng.sample(pool, rng.int(3, 5));

    groupRows.push({
      id,
      collegeId: collegeId("nexivora-institute-of-technology"),
      classId: null,
      name: group.name,
      description: group.description,
      sizeLimit: 8,
      joinPolicy: "REQUEST",
      visibility: "COLLEGE",
      createdAt: iso("2026-07-28"),
      archivedAt: null,
    });

    usernames.forEach((username, index) => {
      memberRows.push({
        id: seedId("gmember", group.slug, username),
        groupId: id,
        userId: userId(username),
        role: index === 0 ? "LEAD" : "MEMBER",
        joinedAt: iso("2026-07-28"),
      });
    });

    membersByGroup.set(id, usernames);
    collegeByGroup.set(id, "nexivora-institute-of-technology");
    standaloneGroupIds.push(id);
  }

  await db.group.createMany({ data: groupRows });
  await db.groupMember.createMany({ data: memberRows });
  step("groups", groupRows.length);

  /* --------------------------------------------------- guest memberships */

  // The fixtures deliberately contain inter-college work — the air-quality mesh
  // is built "jointly by teams at two colleges", and its backend lead is a
  // Meridian student on a Nexivora project.
  //
  // That must not be modelled as a group member with no membership at the
  // group's college: every isolation check in the product asks "is this user a
  // member of this college", and a hole there would have to be special-cased in
  // each one. Instead the guest gets a real GUEST membership — scoped, visible
  // in the audit trail, and invisible in directories and statistics.
  const guestRows: Prisma.MembershipCreateManyInput[] = [];
  const seen = new Set<string>();

  for (const [group, usernames] of membersByGroup) {
    const groupCollege = collegeByGroup.get(group);
    if (!groupCollege) continue;

    for (const username of usernames) {
      const home = cast.collegeOf.get(username);
      if (!home || home === groupCollege) continue;

      const key = `${username}:${groupCollege}`;
      if (seen.has(key)) continue;
      seen.add(key);

      guestRows.push({
        id: seedId("membership", username, groupCollege, "GUEST"),
        userId: userId(username),
        collegeId: collegeId(groupCollege),
        role: "STUDENT",
        state: "GUEST",
        title: `Guest from ${home}`,
        joinedAt: iso("2026-02-01"),
      });
    }
  }

  await db.membership.createMany({ data: guestRows, skipDuplicates: true });
  step("guest memberships", guestRows.length);

  return { groupByProject, membersByGroup, collegeByGroup, standaloneGroupIds };
}

/* -------------------------------------------------------------- enrolment */

/**
 * Class rosters. Students are enrolled in their own department's current-term
 * classes, and faculty are assigned to teach them — which is what makes the
 * "my classes" surfaces in Phase 6 non-empty.
 */
export async function seedEnrolment(
  db: PrismaClient,
  rng: Rng,
  cast: Cast,
  hierarchy: Hierarchy,
): Promise<void> {
  const enrolments = [];
  const assignments = [];

  const currentClasses = hierarchy.classes.filter((klass) => klass.termName === "Odd 2026-27");

  for (const klass of currentClasses) {
    const subject = hierarchy.subjects.find((row) => row.id === klass.subjectId);
    if (!subject) continue;

    const students = (cast.studentsByCollege.get(klass.collegeSlug) ?? []).filter(
      (username) => cast.departmentOf.get(username) === subject.department,
    );

    // Not everyone takes every elective.
    for (const username of rng.sample(students, Math.ceil(students.length * 0.7))) {
      enrolments.push({
        id: seedId("enrol", klass.id, username),
        classId: klass.id,
        userId: userId(username),
      });
    }

    const faculty = (cast.facultyByCollege.get(klass.collegeSlug) ?? []).filter(
      (username) => cast.departmentOf.get(username) === subject.department,
    );

    if (faculty.length > 0) {
      assignments.push({
        id: seedId("assign", klass.id, faculty[0] ?? ""),
        classId: klass.id,
        userId: userId(rng.pick(faculty)),
      });
    }
  }

  await db.classEnrolment.createMany({ data: enrolments, skipDuplicates: true });
  await db.subjectAssignment.createMany({ data: assignments, skipDuplicates: true });
  step("enrolments + assignments", enrolments.length + assignments.length);
}
