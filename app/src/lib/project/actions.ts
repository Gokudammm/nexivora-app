"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { SECTION_BY_KIND, SECTION_LOCK_MINUTES, countWords } from "@/config/sections";
import { currentViewer } from "@/lib/auth/session";
import { can } from "@/lib/authz/policy";
import type { Viewer } from "@/lib/authz/viewer";
import { db } from "@/lib/db/client";
import {
  capabilities,
  requireEditableProject,
  type EditableProject,
} from "@/lib/db/queries/project-edit";
import { isEditable } from "@/lib/project/lifecycle";
import { recomputeSkills } from "@/lib/profile/actions";

/**
 * PROJECT MUTATIONS — the record itself.
 *
 * Lifecycle transitions live in `transitions.ts`; this file is the content:
 * sections, metadata, milestones, visibility. The split is deliberate, because
 * the two have different invariants. A section save is frequent, cheap and
 * autosaved; a transition is rare, gated and audited.
 *
 * One rule holds across both and is checked in `guard()`: **a project that is
 * not editable cannot be edited.** `UNDER_REVIEW` and `ARCHIVED` are locked
 * (acceptance criterion 7), and the check is here rather than in the pages
 * because a Server Action reached directly does not pass through a page.
 */

export type ProjectResult =
  | { ok: true; message: string; id?: string; slug?: string }
  | { ok: false; error: string; field?: string };

const fail = (error: unknown): ProjectResult => ({
  ok: false,
  error: error instanceof Error ? error.message : "Something went wrong.",
});

async function actor(): Promise<Viewer & { userId: string }> {
  const viewer = await currentViewer();
  if (!viewer.userId) throw new Error("Sign in first.");
  return viewer as Viewer & { userId: string };
}

/**
 * Load a project this viewer may change, or refuse.
 *
 * `requireWrite` distinguishes the two kinds of caller: a section save needs a
 * project that is *editable by the group*, while a faculty status change acts
 * on one that is deliberately locked. Passing `false` is how a reviewer reaches
 * a submitted project without the lock refusing them.
 */
export async function loadForEdit(
  viewer: Viewer & { userId: string },
  slug: string,
  { requireWrite = true } = {},
): Promise<{ project: EditableProject; caps: ReturnType<typeof capabilities> }> {
  const project = await requireEditableProject(viewer, slug);
  if (!project) throw new Error("That project is not available.");

  const caps = capabilities(viewer, project);

  if (requireWrite) {
    if (!caps.edit) throw new Error("You are not on this project's team.");

    if (!isEditable(project.status)) {
      throw new Error(
        project.status === "UNDER_REVIEW"
          ? "This project is with your faculty guide for review. It unlocks if they request changes."
          : "This project is archived. The record is permanent and cannot be changed.",
      );
    }
  }

  return { project, caps };
}

const refresh = (slug: string) => {
  revalidatePath(`/projects/${slug}/edit`);
  revalidatePath(`/projects/${slug}`);
  revalidatePath("/my/projects");
};

/* --------------------------------------------------------------- creation */

const createSchema = z.object({
  groupId: z.string().min(1, "Choose the group this project belongs to."),
  title: z.string().trim().min(4, "Give the project a title.").max(160),
  summary: z.string().trim().min(10, "One line describing what it is.").max(240),
  domain: z.string().min(1, "Choose a domain."),
});

/**
 * A slug that is stable once assigned.
 *
 * Derived from the title at creation and **never regenerated**, because a slug
 * is a public URL the moment the project is published and other people cite it.
 * A title fixed in week three would otherwise silently break every link.
 */
async function uniqueSlug(title: string): Promise<string> {
  const base =
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "project";

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await db.project.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }

  return `${base}-${Date.now().toString(36).slice(-5)}`;
}

/**
 * Create a project inside a group.
 *
 * Creates all nine section rows immediately, empty. The alternative —
 * creating them lazily on first edit — means the navigator has to invent rows
 * that do not exist, progress has to count against a list rather than the
 * table, and a section's id is unstable until somebody types in it. Nine empty
 * rows cost nothing and make everything downstream simpler.
 */
export async function createProject(
  _previous: ProjectResult | null,
  formData: FormData,
): Promise<ProjectResult> {
  try {
    const input = createSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();

    const group = await db.group.findFirst({
      where: { id: input.groupId, archivedAt: null },
      select: {
        id: true,
        collegeId: true,
        classId: true,
        class: { select: { subjectId: true, term: { select: { id: true } } } },
      },
    });
    if (!group) return { ok: false, error: "That group is not available.", field: "groupId" };

    if (
      !can(viewer, "project:create", {
        kind: "group",
        collegeId: group.collegeId,
        groupId: group.id,
        classId: group.classId,
        subjectId: group.class?.subjectId ?? null,
      })
    ) {
      return { ok: false, error: "You are not in that group." };
    }

    const slug = await uniqueSlug(input.title);

    const project = await db.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          collegeId: group.collegeId,
          groupId: group.id,
          termId: group.class?.term.id ?? null,
          slug,
          title: input.title,
          summary: input.summary,
          abstract: "",
          domain: input.domain,
          department: "",
          // Explicit empty arrays. A Prisma scalar list left unset stores NULL,
          // which every raw SQL query then has to remember to COALESCE — and
          // the one that forgot is what broke the similarity check.
          techStack: [],
          keywords: [],
          status: "DRAFT",
          visibility: "GROUP",
          startedOn: new Date(),
          sections: {
            create: Object.values(SECTION_BY_KIND).map((section) => ({ kind: section.kind })),
          },
          members: { create: [{ userId: viewer.userId, role: "Lead" }] },
        },
        select: { id: true, slug: true },
      });

      await tx.projectStatusEvent.create({
        data: { projectId: created.id, actorId: viewer.userId, to: "DRAFT", reason: "Created" },
      });

      return created;
    });

    revalidatePath("/my/projects");
    return { ok: true, message: `${input.title} is ready.`, id: project.id, slug: project.slug };
  } catch (error) {
    return fail(error);
  }
}

/* ---------------------------------------------------------------- sections */

const sectionSchema = z.object({
  slug: z.string().min(1),
  kind: z.enum([
    "PROBLEM",
    "RESEARCH",
    "SOLUTION",
    "METHODOLOGY",
    "PROTOTYPE",
    "TESTING",
    "RESULTS",
    "CONCLUSION",
    "FUTURE_WORK",
  ]),
  body: z.string().max(60_000),
  complete: z.string().optional(),
});

/**
 * Save one section.
 *
 * Two things happen alongside the write, and both are the reason this is not a
 * bare `update`:
 *
 * **A version row per save, but only when the body actually changed.** An
 * autosave that fires on blur with no edit would otherwise fill the history
 * with identical rows and make "restore a previous version" useless.
 *
 * **The lock is refreshed, not acquired.** Whoever is typing holds it; it
 * expires on its own so a closed tab cannot obstruct a teammate.
 */
export async function saveSection(
  _previous: ProjectResult | null,
  formData: FormData,
): Promise<ProjectResult> {
  try {
    const input = sectionSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();
    const { project } = await loadForEdit(viewer, input.slug);

    const spec = SECTION_BY_KIND[input.kind];
    const body = input.body.trim();
    const wordCount = countWords(body);
    const wantsComplete = input.complete === "true";

    if (wantsComplete && wordCount < spec.minWords) {
      return {
        ok: false,
        field: "complete",
        error: `${spec.label} needs at least ${spec.minWords} words before it can be marked complete — it has ${wordCount}. The floor is there so "complete" means something when progress is computed.`,
      };
    }

    const existing = await db.projectSection.findUnique({
      where: { projectId_kind: { projectId: project.id, kind: input.kind } },
      select: { id: true, body: true, complete: true },
    });
    if (!existing) return { ok: false, error: "That section no longer exists." };

    const changed = existing.body !== body;

    await db.$transaction(async (tx) => {
      if (changed) {
        const last = await tx.projectSectionVersion.findFirst({
          where: { sectionId: existing.id },
          orderBy: { version: "desc" },
          select: { version: true },
        });

        // The version records what the section looked like BEFORE this save, so
        // "restore" restores a state that actually existed. Snapshotting the new
        // body would make the newest version a duplicate of the live row.
        await tx.projectSectionVersion.create({
          data: {
            sectionId: existing.id,
            projectId: project.id,
            kind: input.kind,
            body: existing.body,
            wordCount: countWords(existing.body),
            editorId: viewer.userId,
            version: (last?.version ?? 0) + 1,
          },
        });
      }

      await tx.projectSection.update({
        where: { id: existing.id },
        data: {
          body,
          wordCount,
          complete: wantsComplete,
          lastEditorId: viewer.userId,
          lockedById: viewer.userId,
          lockedAt: new Date(),
        },
      });
    });

    refresh(project.slug);
    return {
      ok: true,
      message: changed ? `${spec.label} saved.` : "No changes to save.",
    };
  } catch (error) {
    return fail(error);
  }
}

/** Restore a previous version. An append, like everything else that undoes. */
export async function restoreSectionVersion(
  _previous: ProjectResult | null,
  formData: FormData,
): Promise<ProjectResult> {
  try {
    const input = z
      .object({ slug: z.string().min(1), versionId: z.string().min(1) })
      .parse(Object.fromEntries(formData));

    const viewer = await actor();
    const { project } = await loadForEdit(viewer, input.slug);

    const version = await db.projectSectionVersion.findFirst({
      where: { id: input.versionId, projectId: project.id },
      select: { id: true, body: true, kind: true, version: true, sectionId: true },
    });
    if (!version) return { ok: false, error: "That version no longer exists." };

    const section = await db.projectSection.findUnique({
      where: { id: version.sectionId },
      select: { id: true, body: true },
    });
    if (!section) return { ok: false, error: "That section no longer exists." };

    await db.$transaction(async (tx) => {
      const last = await tx.projectSectionVersion.findFirst({
        where: { sectionId: section.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      // Restoring is itself a change, so the version it replaces is kept. The
      // history reads "v1, v2, v3 (restored from v1)" rather than losing v2 —
      // same discipline as the ledger's compensating events.
      await tx.projectSectionVersion.create({
        data: {
          sectionId: section.id,
          projectId: project.id,
          kind: version.kind,
          body: section.body,
          wordCount: countWords(section.body),
          editorId: viewer.userId,
          version: (last?.version ?? 0) + 1,
        },
      });

      await tx.projectSection.update({
        where: { id: section.id },
        data: {
          body: version.body,
          wordCount: countWords(version.body),
          lastEditorId: viewer.userId,
          // Restoring an older body does not assert it is finished.
          complete: false,
        },
      });
    });

    refresh(project.slug);
    return { ok: true, message: `Restored version ${version.version}.` };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Claim the soft lock on a section.
 *
 * A courtesy, not a mutex — it says "somebody else is in here right now" and
 * expires after `SECTION_LOCK_MINUTES` so a closed browser tab cannot hold a
 * section hostage. The spec is explicit that this is the honest answer and CRDT
 * merge is out of scope; saying so is better than half-doing it.
 */
export async function claimSectionLock(
  _previous: ProjectResult | null,
  formData: FormData,
): Promise<ProjectResult> {
  try {
    const input = sectionSchema
      .pick({ slug: true, kind: true })
      .parse(Object.fromEntries(formData));

    const viewer = await actor();
    const { project } = await loadForEdit(viewer, input.slug);

    const expiry = new Date(Date.now() - SECTION_LOCK_MINUTES * 60_000);

    await db.projectSection.updateMany({
      where: {
        projectId: project.id,
        kind: input.kind,
        OR: [{ lockedById: null }, { lockedById: viewer.userId }, { lockedAt: { lt: expiry } }],
      },
      data: { lockedById: viewer.userId, lockedAt: new Date() },
    });

    return { ok: true, message: "" };
  } catch (error) {
    return fail(error);
  }
}

/* --------------------------------------------------------------- metadata */

const metadataSchema = z.object({
  slug: z.string().min(1),
  title: z.string().trim().min(4).max(160),
  summary: z.string().trim().min(10).max(240),
  abstract: z.string().trim().max(2000).optional(),
  domain: z.string().min(1),
  department: z.string().trim().max(120).optional(),
  techStack: z.string().trim().max(400).optional(),
  keywords: z.string().trim().max(400).optional(),
  repositoryUrl: z.string().trim().max(300).optional(),
  demoUrl: z.string().trim().max(300).optional(),
  videoUrl: z.string().trim().max(300).optional(),
  startedOn: z.string().optional(),
  completedOn: z.string().optional(),
  topics: z.string().optional(),
  sdgs: z.string().optional(),
  primarySdg: z.string().optional(),
});

const csv = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

/** An https URL, or nothing. A `javascript:` href on a public page is the concern. */
const httpsOrNull = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return /^https:\/\//i.test(trimmed) ? trimmed : null;
};

const parseDate = (value: string | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

export async function saveProjectMetadata(
  _previous: ProjectResult | null,
  formData: FormData,
): Promise<ProjectResult> {
  try {
    const input = metadataSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();
    const { project } = await loadForEdit(viewer, input.slug);

    for (const [field, value] of [
      ["repositoryUrl", input.repositoryUrl],
      ["demoUrl", input.demoUrl],
      ["videoUrl", input.videoUrl],
    ] as const) {
      if (value?.trim() && !httpsOrNull(value)) {
        return { ok: false, field, error: "Links must start with https://" };
      }
    }

    const topicSlugs = csv(input.topics);
    const sdgGoals = csv(input.sdgs)
      .map(Number)
      .filter((goal) => Number.isInteger(goal) && goal >= 1 && goal <= 17);
    const primary = Number(input.primarySdg);

    const topics = topicSlugs.length
      ? await db.topic.findMany({ where: { slug: { in: topicSlugs } }, select: { id: true } })
      : [];

    await db.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: project.id },
        data: {
          title: input.title,
          summary: input.summary,
          abstract: input.abstract ?? "",
          domain: input.domain,
          department: input.department ?? "",
          techStack: csv(input.techStack),
          keywords: csv(input.keywords),
          repositoryUrl: httpsOrNull(input.repositoryUrl),
          demoUrl: httpsOrNull(input.demoUrl),
          videoUrl: httpsOrNull(input.videoUrl),
          startedOn: parseDate(input.startedOn) ?? project.startedOn,
          completedOn: parseDate(input.completedOn),
        },
      });

      // Replaced rather than diffed: the form sends the complete set, and a diff
      // of two small sets is more code and one more thing to get wrong.
      await tx.projectTopic.deleteMany({ where: { projectId: project.id } });
      if (topics.length > 0) {
        await tx.projectTopic.createMany({
          data: topics.map((topic) => ({ projectId: project.id, topicId: topic.id })),
        });
      }

      await tx.projectSdg.deleteMany({ where: { projectId: project.id } });
      if (sdgGoals.length > 0) {
        await tx.projectSdg.createMany({
          data: sdgGoals.map((goal) => ({
            projectId: project.id,
            goal,
            primary: goal === primary,
          })),
        });
      }
    });

    refresh(project.slug);
    return { ok: true, message: "Saved." };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------- membership */

const memberSchema = z.object({
  slug: z.string().min(1),
  userId: z.string().min(1),
  role: z.string().trim().min(2, "What did they do on this project?").max(60),
});

/**
 * Credit somebody on the project.
 *
 * Restricted to members of the owning group: a project's credited team and its
 * workspace membership must not diverge, because the ledger — the evidence
 * behind `WORKSPACE_EVIDENCED` — only exists for people in the workspace.
 *
 * The tier is always `SELF` here. Promotion to evidenced is derived from the
 * ledger, and only Phase 9 may write `FACULTY_ATTESTED`.
 */
export async function addProjectMember(
  _previous: ProjectResult | null,
  formData: FormData,
): Promise<ProjectResult> {
  try {
    const input = memberSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();
    const { project } = await loadForEdit(viewer, input.slug);

    const inGroup = project.group?.members.some((member) => member.user.id === input.userId);
    if (!inGroup) {
      return {
        ok: false,
        error: "Only people in the owning group can be credited. Add them to the group first.",
      };
    }

    await db.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: input.userId } },
      create: { projectId: project.id, userId: input.userId, role: input.role },
      update: { role: input.role },
    });

    await recomputeSkills(input.userId);

    refresh(project.slug);
    return { ok: true, message: "Team updated." };
  } catch (error) {
    return fail(error);
  }
}

export async function removeProjectMember(
  _previous: ProjectResult | null,
  formData: FormData,
): Promise<ProjectResult> {
  try {
    const input = z
      .object({ slug: z.string().min(1), userId: z.string().min(1) })
      .parse(Object.fromEntries(formData));

    const viewer = await actor();
    const { project } = await loadForEdit(viewer, input.slug);

    await db.projectMember.deleteMany({
      where: { projectId: project.id, userId: input.userId },
    });

    await recomputeSkills(input.userId);

    refresh(project.slug);
    return { ok: true, message: "Removed from the project." };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------- visibility & IP */

const visibilitySchema = z.object({
  slug: z.string().min(1),
  visibility: z.enum(["PRIVATE", "GROUP", "CLASS", "COLLEGE", "PUBLIC"]),
  embargoUntil: z.string().optional(),
});

/**
 * Set visibility and the IP embargo.
 *
 * **PUBLIC is not settable by the group.** A group requests publication by
 * submitting; a faculty member grants it, and only that grant sets `approved`.
 * The database enforces the same rule with a check constraint (ADR-010), so
 * this is the friendly version of a refusal that would otherwise be a 500.
 */
export async function saveVisibility(
  _previous: ProjectResult | null,
  formData: FormData,
): Promise<ProjectResult> {
  try {
    const input = visibilitySchema.parse(Object.fromEntries(formData));
    const viewer = await actor();
    const { project, caps } = await loadForEdit(viewer, input.slug);

    if (!caps.visibility) {
      return { ok: false, error: "Only the group lead or your faculty guide can change this." };
    }

    if (input.visibility === "PUBLIC" && !project.approved && !caps.faculty) {
      return {
        ok: false,
        field: "visibility",
        error:
          "Publishing needs your faculty guide's approval. Submit the project for review and they can grant it.",
      };
    }

    const embargoUntil = parseDate(input.embargoUntil);
    if (embargoUntil && embargoUntil < new Date()) {
      return { ok: false, field: "embargoUntil", error: "An embargo date must be in the future." };
    }

    await db.project.update({
      where: { id: project.id },
      data: { visibility: input.visibility, embargoUntil },
    });

    refresh(project.slug);
    revalidatePath("/explore");
    return { ok: true, message: "Visibility updated." };
  } catch (error) {
    return fail(error);
  }
}

/* -------------------------------------------------------------- milestones */

const milestoneSchema = z.object({
  slug: z.string().min(1),
  milestoneId: z.string().optional(),
  title: z.string().trim().min(3, "Give the milestone a title.").max(160),
  description: z.string().trim().max(1000).optional(),
  dueDate: z.string().optional(),
  ownerId: z.string().optional(),
});

export async function saveMilestone(
  _previous: ProjectResult | null,
  formData: FormData,
): Promise<ProjectResult> {
  try {
    const input = milestoneSchema.parse(Object.fromEntries(formData));
    const viewer = await actor();
    const { project } = await loadForEdit(viewer, input.slug);

    const owner = input.ownerId?.trim() || null;
    if (owner && !project.group?.members.some((member) => member.user.id === owner)) {
      return { ok: false, field: "ownerId", error: "That person is not in the group." };
    }

    const data = {
      title: input.title,
      description: input.description || null,
      dueDate: parseDate(input.dueDate),
      ownerId: owner,
    };

    if (input.milestoneId) {
      const existing = await db.milestone.findFirst({
        where: { id: input.milestoneId, projectId: project.id },
        select: { id: true },
      });
      if (!existing) return { ok: false, error: "That milestone no longer exists." };

      await db.milestone.update({ where: { id: existing.id }, data });
    } else {
      const last = await db.milestone.findFirst({
        where: { projectId: project.id },
        orderBy: { position: "desc" },
        select: { position: true },
      });

      await db.milestone.create({
        data: { ...data, projectId: project.id, position: (last?.position ?? 0) + 1 },
      });
    }

    revalidatePath(`/projects/${project.slug}/milestones`);
    refresh(project.slug);
    return { ok: true, message: "Milestone saved." };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteMilestone(
  _previous: ProjectResult | null,
  formData: FormData,
): Promise<ProjectResult> {
  try {
    const input = z
      .object({ slug: z.string().min(1), milestoneId: z.string().min(1) })
      .parse(Object.fromEntries(formData));

    const viewer = await actor();
    const { project } = await loadForEdit(viewer, input.slug);

    const milestone = await db.milestone.findFirst({
      where: { id: input.milestoneId, projectId: project.id },
      select: { id: true, state: true },
    });
    if (!milestone) return { ok: false, error: "That milestone no longer exists." };

    if (milestone.state === "COMPLETE") {
      return {
        ok: false,
        error:
          "A completed milestone cannot be removed — its peer reviews and ledger events point at it.",
      };
    }

    // Tasks survive; only the grouping goes. A task that vanishes with its
    // milestone would take its ledger event's subject with it.
    await db.$transaction([
      db.task.updateMany({ where: { milestoneId: milestone.id }, data: { milestoneId: null } }),
      db.milestone.delete({ where: { id: milestone.id } }),
    ]);

    revalidatePath(`/projects/${project.slug}/milestones`);
    return { ok: true, message: "Milestone removed." };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------------ cover */

export async function saveProjectCover(
  _previous: ProjectResult | null,
  formData: FormData,
): Promise<ProjectResult> {
  try {
    const slug = z.string().min(1).parse(formData.get("slug"));
    const viewer = await actor();
    const { project } = await loadForEdit(viewer, slug);

    const { forgetImage, storeImage } = await import("@/lib/storage/images");
    const file = formData.get("file");
    const previous = project.coverUrl;

    if (!(file instanceof File) || file.size === 0) {
      if (formData.get("remove") !== "true") {
        return { ok: false, error: "Choose an image to upload." };
      }

      await db.project.update({ where: { id: project.id }, data: { coverUrl: null } });
      await forgetImage(previous);

      refresh(project.slug);
      return { ok: true, message: "Cover removed." };
    }

    const stored = await storeImage("cover", project.id, file);
    if (!stored.ok) return { ok: false, error: stored.error, field: "file" };

    await db.project.update({ where: { id: project.id }, data: { coverUrl: stored.url } });
    await forgetImage(previous);

    refresh(project.slug);
    return { ok: true, message: "Cover updated." };
  } catch (error) {
    return fail(error);
  }
}
