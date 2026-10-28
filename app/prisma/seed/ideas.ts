import type { Prisma, PrismaClient } from "@prisma/client";

import { ideas } from "../../src/content/ideas.ts";
import { collegeId } from "./hierarchy.ts";
import { iso, seedId, step, type Rng } from "./lib.ts";
import { userId, type Cast } from "./people.ts";
import { projectId } from "./projects.ts";
import { topicId } from "./taxonomy.ts";

/**
 * The Idea Hub.
 *
 * Ideas are seeded at every status including one that became a project, because
 * the hub's credibility rests on showing outcomes rather than intentions. A
 * board of ten permanently-open ideas reads as a graveyard; one that shows
 * "this one shipped" reads as a place worth posting to.
 */

export const ideaId = (slug: string) => seedId("idea", slug);

export async function seedIdeas(db: PrismaClient, rng: Rng, cast: Cast): Promise<void> {
  const ideaRows: Prisma.IdeaCreateManyInput[] = [];
  const topicRows: Prisma.IdeaTopicCreateManyInput[] = [];
  const sdgRows: Prisma.IdeaSdgCreateManyInput[] = [];
  const interestRows: Prisma.IdeaInterestCreateManyInput[] = [];

  for (const idea of ideas) {
    const id = ideaId(idea.slug);
    const postedOn = iso(idea.postedOn);

    ideaRows.push({
      id,
      collegeId: collegeId(idea.collegeSlug),
      authorId: userId(idea.postedBy),
      slug: idea.slug,
      title: idea.title,
      summary: idea.summary,
      problem: idea.problem,
      approach: idea.approach,
      status: idea.status,
      domain: idea.domain,
      skillsNeeded: idea.skillsNeeded,
      teamSizeWanted: idea.teamSizeWanted,
      commitment: idea.commitment,
      interestedCount: idea.interestedCount,
      becameProjectId: idea.becameProject ? projectId(idea.becameProject) : null,
      createdAt: postedOn,
    });

    for (const slug of idea.topics) {
      topicRows.push({ id: seedId("itopic", idea.slug, slug), ideaId: id, topicId: topicId(slug) });
    }

    for (const goal of idea.sdgs) {
      sdgRows.push({ id: seedId("isdg", idea.slug, goal), ideaId: id, goal });
    }

    /* -------------------------------------------------------- interests */

    // `interestedCount` on the fixture is what the public page renders, so the
    // rows here have to add up to it — a counter that disagrees with the rows
    // behind it is the kind of detail that quietly destroys trust in a demo.
    const candidates = (cast.studentsByCollege.get(idea.collegeSlug) ?? []).filter(
      (username) => username !== idea.postedBy,
    );

    for (const username of rng.sample(candidates, idea.interestedCount)) {
      interestRows.push({
        id: seedId("iinterest", idea.slug, username),
        ideaId: id,
        userId: userId(username),
        message: rng.chance(0.4)
          ? "I have worked with this stack before and would like to take the data side."
          : null,
        createdAt: postedOn,
      });
    }
  }

  await db.idea.createMany({ data: ideaRows });
  await db.ideaTopic.createMany({ data: topicRows });
  await db.ideaSdg.createMany({ data: sdgRows });
  await db.ideaInterest.createMany({ data: interestRows });
  step("ideas", ideaRows.length);
  step("idea interests", interestRows.length);
}
