import type { PrismaClient } from "@prisma/client";

import { ALL_TOPICS, SDGS, TOPIC_BY_SLUG } from "../../src/config/taxonomy.ts";
import { ideas } from "../../src/content/ideas.ts";
import { projects } from "../../src/content/projects.ts";
import { seedId, step } from "./lib.ts";

/**
 * The taxonomy is NOT defined here. `src/config/taxonomy.ts` is the single
 * definition and already drives the topic hubs, the explore facets, the project
 * domain colours and (later) the teammate matcher. This module copies it into
 * the database so joins and counts are possible, and nothing more.
 *
 * One definition, five consumers. A second list would drift within a week.
 */

/**
 * Fail the seed the moment content references a taxonomy node that does not
 * exist.
 *
 * Without this the mismatch surfaces later as a missing row in a topic hub —
 * a silent under-count that nobody notices, because a page with nine projects
 * instead of ten looks perfectly fine. Better to refuse to seed.
 */
export function assertCatalogueComplete(): void {
  const problems: string[] = [];

  const knownSdgs = new Set(SDGS.map((sdg) => sdg.number));

  for (const project of projects) {
    for (const slug of project.topics) {
      if (!TOPIC_BY_SLUG[slug]) {
        problems.push(`project "${project.slug}" references unknown topic "${slug}"`);
      }
    }
    for (const goal of project.sdgs) {
      if (!knownSdgs.has(goal)) {
        problems.push(`project "${project.slug}" references unknown SDG ${goal}`);
      }
    }
  }

  for (const idea of ideas) {
    for (const slug of idea.topics) {
      if (!TOPIC_BY_SLUG[slug]) {
        problems.push(`idea "${idea.slug}" references unknown topic "${slug}"`);
      }
    }
    for (const goal of idea.sdgs) {
      if (!knownSdgs.has(goal)) {
        problems.push(`idea "${idea.slug}" references unknown SDG ${goal}`);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `The content contract and the taxonomy disagree:\n` +
        problems.map((line) => `  - ${line}`).join("\n") +
        `\n\nFix src/config/taxonomy.ts or the content fixture. Do not seed around it.`,
    );
  }
}

export const topicId = (slug: string) => seedId("topic", slug);

export async function seedTaxonomy(db: PrismaClient): Promise<void> {
  assertCatalogueComplete();

  await db.topic.createMany({
    data: ALL_TOPICS.map((topic) => ({
      id: topicId(topic.slug),
      slug: topic.slug,
      name: topic.name,
      domain: topic.domain,
      parentSlug: topic.parent ?? null,
      summary: topic.summary,
    })),
  });
  step("topics", ALL_TOPICS.length);

  await db.sdg.createMany({
    data: SDGS.map((sdg) => ({
      number: sdg.number,
      slug: sdg.slug,
      title: sdg.title,
      summary: sdg.summary,
    })),
  });
  step("sdgs", SDGS.length);
}
