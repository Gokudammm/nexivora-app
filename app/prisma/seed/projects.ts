import type { $Enums, Prisma, PrismaClient } from "@prisma/client";

import { projects } from "../../src/content/projects.ts";
import { collegeId, termId } from "./hierarchy.ts";
import { groupId } from "./groups.ts";
import { PROJECT_STATUS, PROOF_TIER, iso, daysAfter, seedId, step, type Rng } from "./lib.ts";
import { userId, type Cast } from "./people.ts";
import { topicId } from "./taxonomy.ts";

/**
 * Projects, imported from the Phase 2 fixtures without alteration.
 *
 * These fourteen are what the public site renders today. When Phase 5 switches
 * the pages from `@/content/projects` to `@/lib/db/queries/projects`, every
 * public page must render identically — so anything the seed changes here is a
 * bug that will show up as a diff on a live page.
 *
 * The fixtures include several deliberately awkward cases, and they are seeded
 * exactly as awkward as they are: an embargoed project, a private one, a
 * proposed-but-unapproved near-duplicate, and one at an unverified college.
 * They exist so the visibility rules are exercised by real rows rather than
 * asserted in a comment.
 */

export const projectId = (slug: string) => seedId("project", slug);

export type Projects = {
  /** project slug → id. */
  idBySlug: Map<string, string>;
  /** project slug → milestone ids, in order. */
  milestonesByProject: Map<string, string[]>;
};

const MILESTONE_PLAN = [
  { title: "Problem definition and scope", offset: 14 },
  { title: "Literature and prior work review", offset: 35 },
  { title: "First working prototype", offset: 80 },
  { title: "Field testing and iteration", offset: 130 },
  { title: "Final report and handover", offset: 170 },
];

export async function seedProjects(db: PrismaClient, rng: Rng, cast: Cast): Promise<Projects> {
  const idBySlug = new Map<string, string>();
  const milestonesByProject = new Map<string, string[]>();

  const projectRows: Prisma.ProjectCreateManyInput[] = [];
  const sectionRows: Prisma.ProjectSectionCreateManyInput[] = [];
  const memberRows: Prisma.ProjectMemberCreateManyInput[] = [];
  const topicRows: Prisma.ProjectTopicCreateManyInput[] = [];
  const sdgRows: Prisma.ProjectSdgCreateManyInput[] = [];
  const metricRows: Prisma.ProjectMetricCreateManyInput[] = [];
  const milestoneRows: Prisma.MilestoneCreateManyInput[] = [];
  const statusRows: Prisma.ProjectStatusEventCreateManyInput[] = [];

  for (const project of projects) {
    const id = projectId(project.slug);
    idBySlug.set(project.slug, id);

    const startedOn = iso(project.startedOn);
    const approvedAt = project.approved
      ? iso(project.publishedOn ?? project.completedOn ?? project.startedOn)
      : null;

    projectRows.push({
      id,
      collegeId: collegeId(project.collegeSlug),
      groupId: groupId(project.slug),
      termId: termId(project.collegeSlug, project.term),
      slug: project.slug,
      title: project.title,
      summary: project.summary,
      abstract: project.abstract,
      status: PROJECT_STATUS[project.status],
      visibility: project.visibility,
      embargoUntil: project.embargoUntil ? iso(project.embargoUntil) : null,
      approved: project.approved,
      approvedAt,
      department: project.department,
      subject: project.subject || null,
      domain: project.domain,
      techStack: project.techStack,
      keywords: project.keywords,
      facultyGuide: project.facultyGuide || null,
      startedOn,
      completedOn: project.completedOn ? iso(project.completedOn) : null,
      publishedOn: project.publishedOn ? iso(project.publishedOn) : null,
      citationId: project.citationId ?? null,
      repositoryUrl: project.repositoryUrl ?? null,
      createdAt: startedOn,
    });

    /* --------------------------------------------------------- sections */

    // Rows, not a JSON blob (ADR-009). Per-section feedback, progress
    // computation and the public page's <h2> structure all depend on it.
    for (const section of project.sections) {
      sectionRows.push({
        id: seedId("section", project.slug, section.kind),
        projectId: id,
        kind: section.kind,
        body: section.body,
        wordCount: section.body.split(/\s+/).filter(Boolean).length,
        complete: section.body.trim().length > 0,
      });
    }

    /* ---------------------------------------------------------- members */

    for (const member of project.members) {
      memberRows.push({
        id: seedId("pmember", project.slug, member.username),
        projectId: id,
        userId: userId(member.username),
        role: member.role,
        tier: PROOF_TIER[member.tier],
      });
    }

    /* ------------------------------------------------------------- tags */

    for (const slug of project.topics) {
      topicRows.push({
        id: seedId("ptopic", project.slug, slug),
        projectId: id,
        topicId: topicId(slug),
      });
    }

    project.sdgs.forEach((goal, index) => {
      sdgRows.push({
        id: seedId("psdg", project.slug, goal),
        projectId: id,
        goal,
        // One primary goal. Over-tagging is why SDG reporting has a
        // credibility problem, and the seed should not model the bad habit.
        primary: index === 0,
      });
    });

    (project.metrics ?? []).forEach((metric, index) => {
      metricRows.push({
        id: seedId("pmetric", project.slug, index),
        projectId: id,
        label: metric.label,
        value: metric.value,
        position: index,
      });
    });

    /* ------------------------------------------------------- milestones */

    const milestoneIds: string[] = [];
    const finished = project.status === "completed" || project.status === "archived";

    MILESTONE_PLAN.forEach((plan, index) => {
      // A proposed project has not planned its milestones yet.
      if (project.status === "proposed" && index > 0) return;

      const milestoneId = seedId("milestone", project.slug, index);
      milestoneIds.push(milestoneId);

      const dueDate = daysAfter(startedOn, plan.offset);
      const complete = finished || (project.status === "progress" && index < 2);

      milestoneRows.push({
        id: milestoneId,
        projectId: id,
        title: plan.title,
        dueDate,
        state: complete
          ? "COMPLETE"
          : project.status === "progress" && index === 2
            ? "IN_PROGRESS"
            : "UPCOMING",
        position: index,
        completedAt: complete ? dueDate : null,
        createdAt: startedOn,
      });
    });

    milestonesByProject.set(project.slug, milestoneIds);

    /* ---------------------------------------------------- status history */

    // The audit trail a project page's timeline is drawn from. Written as the
    // sequence that actually occurred, not just the current value.
    const transitions: Array<{ from: $Enums.ProjectStatus | null; to: $Enums.ProjectStatus }> = [
      { from: null, to: "DRAFT" },
    ];
    // The happy-path lifecycle. REJECTED and ABANDONED are real statuses but
    // not points on this line, so they are absent by design.
    const order: readonly $Enums.ProjectStatus[] = [
      "DRAFT",
      "PROPOSED",
      "APPROVED",
      "IN_PROGRESS",
      "UNDER_REVIEW",
      "COMPLETED",
      "ARCHIVED",
    ];
    const finalIndex = order.indexOf(PROJECT_STATUS[project.status] ?? "DRAFT");

    for (let i = 1; i <= finalIndex; i += 1) {
      transitions.push({ from: order[i - 1] ?? null, to: order[i] ?? "DRAFT" });
    }

    transitions.forEach((transition, index) => {
      statusRows.push({
        id: seedId("pstatus", project.slug, index),
        projectId: id,
        actorId: userId(
          project.members[0]?.username ?? cast.fixtureUsernames[0] ?? "ananya-sharma",
        ),
        from: transition.from,
        to: transition.to,
        createdAt: daysAfter(startedOn, index * 12),
      });
    });
  }

  await db.project.createMany({ data: projectRows });
  step("projects", projectRows.length);

  await db.projectSection.createMany({ data: sectionRows });
  step("sections", sectionRows.length);

  await db.projectMember.createMany({ data: memberRows });
  await db.projectTopic.createMany({ data: topicRows });
  await db.projectSdg.createMany({ data: sdgRows });
  await db.projectMetric.createMany({ data: metricRows });
  await db.milestone.createMany({ data: milestoneRows });
  await db.projectStatusEvent.createMany({ data: statusRows });
  step("members, tags, milestones", memberRows.length + topicRows.length + milestoneRows.length);

  /* ------------------------------------------------------------ lineage */

  // The three-level chain the lineage tree needs in order to be a tree rather
  // than a single node with a caption.
  const lineageRows = projects.flatMap((project) =>
    (project.buildsOn ?? [])
      .filter((link) => idBySlug.has(link.slug))
      .map((link) => ({
        id: seedId("lineage", link.slug, project.slug),
        parentId: idBySlug.get(link.slug) ?? "",
        childId: projectId(project.slug),
        kind: link.kind,
        note: link.note,
      })),
  );

  await db.projectLineage.createMany({ data: lineageRows });
  step("lineage links", lineageRows.length);

  return { idBySlug, milestonesByProject };
}
