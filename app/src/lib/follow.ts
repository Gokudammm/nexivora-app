"use server";

import { revalidatePath } from "next/cache";

import type { $Enums } from "@prisma/client";

import { currentViewer } from "@/lib/auth/session";
import { can } from "@/lib/authz/policy";
import { belongsTo, type Viewer } from "@/lib/authz/viewer";
import { db } from "@/lib/db/client";

/**
 * FOLLOWING.
 *
 * Polymorphic over `USER · PROJECT · TOPIC · COLLEGE · GROUP`, which is what
 * makes the three feed tabs one query shape rather than five.
 *
 * `Follow.targetId` carries **no foreign key** (ADR from Phase 3): it points
 * into five tables depending on `targetType`, so a constraint to any one of
 * them would reject the other four. That means this module is the only thing
 * standing between a typo and a dangling row — every follow is verified against
 * the real table before it is written, and `db:verify` asserts none dangle.
 */

export type FollowTarget = { type: $Enums.FollowTargetType; id: string };

export type FollowResult =
  { ok: true; following: boolean; count: number } | { ok: false; error: string };

/**
 * Confirm the target exists **and** that this viewer may see it.
 *
 * Existence alone is not enough: following a private project would otherwise be
 * a way to learn that it exists, and the follower count would leak activity on
 * it. So the check is the same visibility predicate the rest of the product
 * uses, not a bare row lookup.
 */
async function targetIsFollowable(viewer: Viewer, target: FollowTarget): Promise<boolean> {
  switch (target.type) {
    case "USER": {
      if (target.id === viewer.userId) return false;

      const user = await db.user.findFirst({
        where: {
          id: target.id,
          deletedAt: null,
          OR: [
            { privacy: { profileVisibility: "PUBLIC" } },
            {
              privacy: { profileVisibility: "COLLEGE" },
              memberships: {
                some: {
                  collegeId: { in: [...new Set(viewer.memberships.map((m) => m.collegeId))] },
                },
              },
            },
          ],
        },
        select: { id: true },
      });

      return user !== null;
    }

    case "PROJECT": {
      const { visibleTo } = await import("@/lib/db/queries/projects");
      const project = await db.project.findFirst({
        where: { AND: [visibleTo(viewer), { id: target.id }] },
        select: { id: true },
      });

      return project !== null;
    }

    case "TOPIC": {
      const topic = await db.topic.findUnique({ where: { id: target.id }, select: { id: true } });
      return topic !== null;
    }

    case "COLLEGE": {
      const college = await db.college.findFirst({
        where: {
          id: target.id,
          OR: [
            { verification: "VERIFIED" },
            { id: { in: viewer.memberships.map((m) => m.collegeId) } },
          ],
        },
        select: { id: true },
      });

      return college !== null;
    }

    case "GROUP": {
      // A group is working material. Only its own college can follow it, and
      // only when the group is college-visible.
      const group = await db.group.findFirst({
        where: { id: target.id, visibility: { in: ["COLLEGE", "PUBLIC"] } },
        select: { id: true, collegeId: true },
      });

      return group !== null && belongsTo(viewer, group.collegeId);
    }
  }
}

export async function toggleFollow(
  _previous: FollowResult | null,
  formData: FormData,
): Promise<FollowResult> {
  const viewer = await currentViewer();
  if (!viewer.userId) return { ok: false, error: "Sign in to follow." };

  if (!can(viewer, "follow:create")) {
    return { ok: false, error: "Confirm your email address first." };
  }

  const type = String(formData.get("targetType") ?? "") as $Enums.FollowTargetType;
  const id = String(formData.get("targetId") ?? "");

  if (!id || !["USER", "PROJECT", "TOPIC", "COLLEGE", "GROUP"].includes(type)) {
    return { ok: false, error: "Nothing to follow." };
  }

  const target: FollowTarget = { type, id };

  if (!(await targetIsFollowable(viewer, target))) {
    // Same message whether it does not exist or is not visible — otherwise
    // this endpoint reports the existence of private work.
    return { ok: false, error: "That is not something you can follow." };
  }

  const existing = await db.follow.findUnique({
    where: {
      followerId_targetType_targetId: { followerId: viewer.userId, targetType: type, targetId: id },
    },
    select: { id: true },
  });

  if (existing) {
    await db.follow.delete({ where: { id: existing.id } });
  } else {
    await db.follow.create({
      data: { followerId: viewer.userId, targetType: type, targetId: id },
    });
  }

  const count = await db.follow.count({ where: { targetType: type, targetId: id } });

  if (type === "USER") {
    const user = await db.user.findUnique({ where: { id }, select: { username: true } });
    if (user) revalidatePath(`/p/${user.username}`);
  }

  return { ok: true, following: !existing, count };
}

/* ----------------------------------------------------------------- reads */

export async function isFollowing(viewer: Viewer, target: FollowTarget): Promise<boolean> {
  if (!viewer.userId) return false;

  const row = await db.follow.findUnique({
    where: {
      followerId_targetType_targetId: {
        followerId: viewer.userId,
        targetType: target.type,
        targetId: target.id,
      },
    },
    select: { id: true },
  });

  return row !== null;
}

export async function followCounts(
  userId: string,
): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    db.follow.count({ where: { targetType: "USER", targetId: userId } }),
    db.follow.count({ where: { followerId: userId } }),
  ]);

  return { followers, following };
}

/**
 * Who follows this person, respecting their own privacy.
 *
 * A follower whose profile the viewer cannot see is counted but not listed —
 * the count is public information about the followed person, the identity is
 * private information about the follower.
 */
export async function listFollowers(viewer: Viewer, userId: string, take = 24) {
  const collegeIds = [...new Set(viewer.memberships.map((m) => m.collegeId))];

  const follows = await db.follow.findMany({
    where: { targetType: "USER", targetId: userId },
    select: { followerId: true },
    take: 200,
  });

  if (follows.length === 0) return [];

  return db.user.findMany({
    where: {
      id: { in: follows.map((follow) => follow.followerId) },
      deletedAt: null,
      OR: [
        { privacy: { profileVisibility: "PUBLIC" } },
        ...(viewer.userId
          ? [
              {
                privacy: { profileVisibility: "COLLEGE" as const },
                memberships: { some: { collegeId: { in: collegeIds } } },
              },
            ]
          : []),
      ],
    },
    select: { id: true, username: true, name: true, headline: true, avatarUrl: true },
    orderBy: { name: "asc" },
    take,
  });
}

/**
 * Suggested follows — deterministic and explainable.
 *
 * Every suggestion carries the reason it was made, because "people you may
 * know" with no explanation is the pattern that makes a social product feel
 * like it is watching you. Nothing here uses behaviour: it is classmates, the
 * faculty who teach you, and the projects in your own college.
 */
export type Suggestion = {
  username: string;
  name: string;
  headline: string | null;
  avatarUrl: string | null;
  reason: string;
};

export async function suggestedFollows(viewer: Viewer, take = 6): Promise<Suggestion[]> {
  if (!viewer.userId) return [];

  const classIds = [...viewer.enrolledIn.map((k) => k.classId)];
  const collegeIds = [...new Set(viewer.memberships.map((m) => m.collegeId))];

  const alreadyFollowing = await db.follow.findMany({
    where: { followerId: viewer.userId, targetType: "USER" },
    select: { targetId: true },
  });

  const exclude = new Set([viewer.userId, ...alreadyFollowing.map((follow) => follow.targetId)]);

  const [classmates, faculty] = await Promise.all([
    classIds.length > 0
      ? db.user.findMany({
          where: {
            id: { notIn: [...exclude] },
            deletedAt: null,
            enrolments: { some: { classId: { in: classIds } } },
            privacy: { profileVisibility: { in: ["PUBLIC", "COLLEGE"] } },
          },
          select: { username: true, name: true, headline: true, avatarUrl: true },
          take,
        })
      : Promise.resolve([]),

    db.user.findMany({
      where: {
        id: { notIn: [...exclude] },
        deletedAt: null,
        subjectAssignments: { some: { classId: { in: classIds } } },
        privacy: { profileVisibility: { in: ["PUBLIC", "COLLEGE"] } },
      },
      select: { username: true, name: true, headline: true, avatarUrl: true },
      take: 3,
    }),
  ]);

  const suggestions: Suggestion[] = [
    ...faculty.map((person) => ({ ...person, reason: "Teaches one of your classes" })),
    ...classmates.map((person) => ({ ...person, reason: "In one of your classes" })),
  ];

  if (suggestions.length < take && collegeIds.length > 0) {
    const sameCollege = await db.user.findMany({
      where: {
        id: { notIn: [...exclude] },
        deletedAt: null,
        memberships: { some: { collegeId: { in: collegeIds }, state: "ACTIVE" } },
        privacy: { profileVisibility: { in: ["PUBLIC", "COLLEGE"] } },
      },
      select: { username: true, name: true, headline: true, avatarUrl: true },
      orderBy: { name: "asc" },
      take: take - suggestions.length,
    });

    suggestions.push(...sameCollege.map((person) => ({ ...person, reason: "At your college" })));
  }

  // De-duplicate, keeping the most specific reason — which is the first, since
  // faculty and classmates are pushed before the college-wide fallback.
  const seen = new Set<string>();
  return suggestions
    .filter((suggestion) => {
      if (seen.has(suggestion.username)) return false;
      seen.add(suggestion.username);
      return true;
    })
    .slice(0, take);
}
