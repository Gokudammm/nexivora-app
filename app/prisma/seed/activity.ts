import type { $Enums, Prisma, PrismaClient } from "@prisma/client";

import { ideas } from "../../src/content/ideas.ts";
import { projects } from "../../src/content/projects.ts";
import { collegeId } from "./hierarchy.ts";
import { groupId, type Groups } from "./groups.ts";
import { ideaId } from "./ideas.ts";
import { daysAfter, iso, seedId, step, type Rng } from "./lib.ts";
import { userId, type Cast } from "./people.ts";
import { projectId, type Projects } from "./projects.ts";

/**
 * THE FEED, GENERATED FROM WHAT HAPPENED.
 *
 * Not a single post here is hand-written, and that is the point (ADR-006 and
 * the Phase 3 acceptance criteria). Every post is derived from a real row —
 * a project that reached a milestone, an idea that was posted, a question that
 * was asked. If the feed could be populated by writing post text directly, the
 * seed would be demonstrating the exact failure mode the product exists to
 * avoid: a timeline of status updates about nothing.
 *
 * Every post therefore carries exactly one anchor, which the database enforces
 * with a check constraint. Trying to write an unanchored post here fails the
 * seed rather than producing a row.
 */

type PostRow = {
  id: string;
  authorId: string;
  collegeId: string | null;
  groupId: string | null;
  kind: $Enums.PostKind;
  source: $Enums.PostSource;
  visibility: $Enums.Visibility;
  body: string;
  projectId: string | null;
  ideaId: string | null;
  questionId: string | null;
  resourceId: string | null;
  reactionCount: number;
  commentCount: number;
  saveCount: number;
  createdAt: Date;
};

const COMMENTS = [
  "How did you handle the calibration drift? We hit the same thing and ended up compensating in software.",
  "This is genuinely useful. Is the dataset shareable?",
  "Have you compared against the naive baseline? That comparison usually decides whether the model is earning its keep.",
  "We are working on something adjacent — would be good to talk before we duplicate effort.",
  "The write-up is unusually clear about limitations. More projects should do this.",
  "Which sensor did you settle on in the end?",
];

const REACTION_KINDS = [
  "INSIGHTFUL",
  "USEFUL",
  "IMPRESSIVE",
  "SUPPORT",
] as const satisfies readonly $Enums.ReactionKind[];

export async function seedActivity(
  db: PrismaClient,
  rng: Rng,
  cast: Cast,
  groups: Groups,
  projectIndex: Projects,
): Promise<void> {
  const posts: PostRow[] = [];

  const emit = (
    key: string,
    row: Omit<PostRow, "id" | "reactionCount" | "commentCount" | "saveCount">,
  ) => {
    const anchors = [row.projectId, row.ideaId, row.questionId, row.resourceId].filter(Boolean);
    if (anchors.length !== 1) {
      throw new Error(
        `Seed: post "${key}" has ${anchors.length} anchors; exactly one is required (ADR-006)`,
      );
    }

    posts.push({
      id: seedId("post", key),
      ...row,
      reactionCount: 0,
      commentCount: 0,
      saveCount: 0,
    });
  };

  /* ------------------------------------------ projects reaching a state */

  for (const project of projects) {
    // Nothing about a private or unapproved project reaches a feed.
    if (project.visibility === "PRIVATE" || !project.approved) continue;

    const author = project.members[0]?.username;
    if (!author) continue;

    const college = collegeId(project.collegeSlug);
    const group = groupId(project.slug);
    const startedOn = iso(project.startedOn);

    if (project.publishedOn) {
      emit(`published-${project.slug}`, {
        authorId: userId(author),
        collegeId: college,
        groupId: group,
        kind: "PROJECT_PUBLISHED",
        source: "GENERATED",
        visibility: project.visibility,
        body: `${project.title} is now published. ${project.summary}`,
        projectId: projectId(project.slug),
        ideaId: null,
        questionId: null,
        resourceId: null,
        createdAt: iso(project.publishedOn),
      });
    }

    // A milestone post per completed milestone, attributed to the member who
    // owned the work rather than to the team in the abstract.
    const milestones = projectIndex.milestonesByProject.get(project.slug) ?? [];
    const members = groups.membersByGroup.get(group) ?? [author];

    milestones.slice(0, project.status === "progress" ? 2 : 3).forEach((milestoneId, index) => {
      emit(`milestone-${project.slug}-${index}`, {
        authorId: userId(members[index % members.length] ?? author),
        collegeId: college,
        groupId: group,
        kind: "MILESTONE",
        source: "GENERATED",
        visibility: project.visibility,
        body: milestoneBody(index, project.title),
        projectId: projectId(project.slug),
        ideaId: null,
        questionId: null,
        resourceId: null,
        createdAt: daysAfter(startedOn, 20 + index * 40),
      });
    });

    // Metrics are results worth announcing, and they are already recorded.
    const headline = project.metrics?.[0];
    if (headline && (project.status === "completed" || project.status === "archived")) {
      emit(`result-${project.slug}`, {
        authorId: userId(author),
        collegeId: college,
        groupId: group,
        kind: "RESEARCH_FINDING",
        source: "GENERATED",
        visibility: project.visibility,
        body: `Final numbers are in for ${project.title} — ${headline.label.toLowerCase()}: ${headline.value}.`,
        projectId: projectId(project.slug),
        ideaId: null,
        questionId: null,
        resourceId: null,
        createdAt: iso(project.completedOn ?? project.startedOn),
      });
    }
  }

  /* -------------------------------------------------------- ideas posted */

  for (const idea of ideas) {
    emit(`idea-${idea.slug}`, {
      authorId: userId(idea.postedBy),
      collegeId: collegeId(idea.collegeSlug),
      groupId: null,
      kind: "IDEA_POSTED",
      source: "GENERATED",
      visibility: "COLLEGE",
      body: `${idea.title} — ${idea.summary}`,
      projectId: null,
      ideaId: ideaId(idea.slug),
      questionId: null,
      resourceId: null,
      createdAt: iso(idea.postedOn),
    });
  }

  await db.post.createMany({ data: posts });
  step("posts (all generated)", posts.length);

  /* ------------------------------------------ engagement on those posts */

  const audience = cast.studentsByCollege.get("nexivora-institute-of-technology") ?? [];
  const commentRows: Array<Prisma.CommentCreateManyInput & { id: string; createdAt: Date }> = [];
  const reactionRows: Prisma.ReactionCreateManyInput[] = [];
  const saveRows: Prisma.SaveCreateManyInput[] = [];
  const counters = new Map<string, { reactions: number; comments: number; saves: number }>();

  for (const post of posts) {
    const stats = { reactions: 0, comments: 0, saves: 0 };

    for (const username of rng.sample(audience, rng.int(0, 9))) {
      if (userId(username) === post.authorId) continue;

      reactionRows.push({
        id: seedId("reaction", post.id, username),
        postId: post.id,
        userId: userId(username),
        kind: rng.pick(REACTION_KINDS),
        createdAt: daysAfter(post.createdAt, rng.int(0, 4)),
      });
      stats.reactions += 1;
    }

    for (const username of rng.sample(audience, rng.int(0, 3))) {
      if (userId(username) === post.authorId) continue;

      commentRows.push({
        id: seedId("comment", post.id, username),
        postId: post.id,
        authorId: userId(username),
        body: rng.pick(COMMENTS),
        createdAt: daysAfter(post.createdAt, rng.int(0, 6)),
      });
      stats.comments += 1;
    }

    for (const username of rng.sample(audience, rng.int(0, 3))) {
      saveRows.push({
        id: seedId("save", post.id, username),
        postId: post.id,
        userId: userId(username),
        collection: rng.chance(0.3) ? "Read later" : "Saved",
        createdAt: daysAfter(post.createdAt, rng.int(0, 10)),
      });
      stats.saves += 1;
    }

    counters.set(post.id, stats);
  }

  await db.reaction.createMany({ data: reactionRows, skipDuplicates: true });
  await db.comment.createMany({ data: commentRows, skipDuplicates: true });
  await db.save.createMany({ data: saveRows, skipDuplicates: true });

  // The denormalised counters have to match the rows behind them. Counting per
  // render does not survive a real feed, and a counter that disagrees with its
  // rows is the kind of small dishonesty that makes a demo feel fake.
  await db.$transaction(
    [...counters].map(([id, stats]) =>
      db.post.update({
        where: { id },
        data: {
          reactionCount: stats.reactions,
          commentCount: stats.comments,
          saveCount: stats.saves,
        },
      }),
    ),
  );
  step("reactions, comments, saves", reactionRows.length + commentRows.length + saveRows.length);

  /* ------------------------------------------------------------- follows */

  const followRows: Prisma.FollowCreateManyInput[] = [];
  const publicProjects = projects.filter(
    (project) => project.visibility === "PUBLIC" && project.approved,
  );

  for (const username of audience) {
    for (const target of rng.sample(cast.fixtureUsernames, rng.int(1, 4))) {
      if (target === username) continue;
      followRows.push({
        id: seedId("follow", username, "USER", target),
        followerId: userId(username),
        targetType: "USER",
        targetId: userId(target),
      });
    }

    for (const project of rng.sample(publicProjects, rng.int(0, 3))) {
      followRows.push({
        id: seedId("follow", username, "PROJECT", project.slug),
        followerId: userId(username),
        targetType: "PROJECT",
        targetId: projectId(project.slug),
      });
    }
  }

  await db.follow.createMany({ data: followRows, skipDuplicates: true });
  step("follows", followRows.length);

  /* ------------------------------------------------------- notifications */

  const notificationRows: Prisma.NotificationCreateManyInput[] = commentRows
    .slice(0, 40)
    .map((comment, index) => {
      const post = posts.find((row) => row.id === comment.postId);

      return {
        id: seedId("notification", comment.id),
        userId: post?.authorId ?? comment.authorId,
        category: "COMMENT" as const,
        title: "New comment on your update",
        body: comment.body.slice(0, 120),
        href: "/feed",
        actorId: comment.authorId,
        readAt: index % 3 === 0 ? daysAfter(comment.createdAt, 1) : null,
        createdAt: comment.createdAt,
      };
    });

  await db.notification.createMany({ data: notificationRows, skipDuplicates: true });
  step("notifications", notificationRows.length);
}

function milestoneBody(index: number, title: string): string {
  const bodies = [
    `Scope is locked for ${title}. We spent longer than planned narrowing the problem and it was worth it — the first version was three projects wearing a trench coat.`,
    `Prior work review done for ${title}. Two papers do most of what we planned, which changed the plan: we are extending rather than rebuilding.`,
    `First working prototype for ${title}. It is ugly and it drifts, but it produces real readings from a real field.`,
    `Field testing under way for ${title}. Early data is messier than the lab suggested, mostly missing timestamps on reconnect.`,
    `Final report submitted for ${title}. Everything including the failed approaches is in the repository.`,
  ];

  return bodies[index] ?? bodies[0] ?? title;
}
