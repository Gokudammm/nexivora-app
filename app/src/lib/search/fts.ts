import { Prisma } from "@prisma/client";

import { SIMILARITY_CANDIDATE_LIMIT, SIMILARITY_SHORTLIST_FLOOR } from "@/config/search";
import { db } from "@/lib/db/client";

import { normaliseForTrigrams } from "./similarity";

/**
 * Full-text search against the trigger-maintained `searchVector` columns.
 *
 * Prisma cannot express `tsquery`, so these are raw queries — which makes
 * parameterisation the whole safety story. Every value below is bound through
 * `Prisma.sql`'s tagged template, never interpolated. There is deliberately no
 * helper here that takes a table name or an ORDER BY as a string: that is how
 * a "safe" raw-SQL layer grows an injection point six months later.
 */

/* ------------------------------------------------------------------ tsquery */

/**
 * Turn arbitrary user input into a valid `tsquery`.
 *
 * Users type apostrophes, ampersands, unbalanced quotes and emoji. Passing any
 * of that straight to `to_tsquery` raises a syntax error, so search would 500
 * on input that is completely reasonable to type.
 *
 * `websearch_to_tsquery` would sanitise it for us, but it cannot express prefix
 * matching — and the trailing-prefix behaviour ("mach" finding "machine") is
 * what makes search-as-you-type feel instant. So the query is assembled here
 * instead: reduce to safe tokens through the same normaliser the trigram index
 * uses, then join with `&` and mark the last token `:*`.
 *
 * Because every token is stripped to `[a-z0-9]` by `normalise()`, no tsquery
 * operator can survive the trip — the output is safe by construction rather
 * than by escaping.
 */
export function toTsQuery(raw: string, { prefixLast = true } = {}): string | null {
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  if (!cleaned) return null;

  const tokens = normaliseForTrigrams(cleaned).split(" ").filter(Boolean);
  if (tokens.length === 0) return null;

  const terms = tokens.map((token, index) =>
    prefixLast && index === tokens.length - 1 ? `${token}:*` : token,
  );

  return terms.join(" & ");
}

export type SearchHit = {
  id: string;
  slug: string;
  title: string;
  rank: number;
};

/**
 * `ts_rank_cd` rather than `ts_rank`: cover density accounts for how close the
 * matched terms are to each other, so "soil moisture sensor" ranks a project
 * using that exact phrase above one that mentions soil in the abstract and
 * moisture in the appendix.
 */
export async function searchProjects(
  query: string,
  { limit = 20, collegeId }: { limit?: number; collegeId?: string } = {},
): Promise<SearchHit[]> {
  const tsquery = toTsQuery(query);
  if (!tsquery) return [];

  return db.$queryRaw<SearchHit[]>(Prisma.sql`
    SELECT p."id", p."slug", p."title",
           ts_rank_cd(p."searchVector", to_tsquery('english', ${tsquery})) AS rank
      FROM "Project" p
     WHERE p."searchVector" @@ to_tsquery('english', ${tsquery})
       AND p."deletedAt" IS NULL
       ${collegeId ? Prisma.sql`AND p."collegeId" = ${collegeId}` : Prisma.empty}
     ORDER BY rank DESC, p."publishedOn" DESC NULLS LAST
     LIMIT ${limit}
  `);
}

export async function searchIdeas(
  query: string,
  { limit = 20, collegeId }: { limit?: number; collegeId?: string } = {},
): Promise<SearchHit[]> {
  const tsquery = toTsQuery(query);
  if (!tsquery) return [];

  return db.$queryRaw<SearchHit[]>(Prisma.sql`
    SELECT i."id", i."slug", i."title",
           ts_rank_cd(i."searchVector", to_tsquery('english', ${tsquery})) AS rank
      FROM "Idea" i
     WHERE i."searchVector" @@ to_tsquery('english', ${tsquery})
       AND i."deletedAt" IS NULL
       ${collegeId ? Prisma.sql`AND i."collegeId" = ${collegeId}` : Prisma.empty}
     ORDER BY rank DESC, i."createdAt" DESC
     LIMIT ${limit}
  `);
}

/**
 * People search. Matches the trigram index too, so a misremembered spelling
 * still finds the person — the mention picker depends on that.
 */
export async function searchPeople(
  query: string,
  { limit = 20 }: { limit?: number } = {},
): Promise<Array<{ id: string; username: string; name: string; rank: number }>> {
  const tsquery = toTsQuery(query);
  if (!tsquery) return [];

  const fuzzy = normaliseForTrigrams(query);

  return db.$queryRaw(Prisma.sql`
    SELECT u."id", u."username", u."name",
           GREATEST(
             ts_rank_cd(u."searchVector", to_tsquery('english', ${tsquery})),
             similarity(u."name", ${fuzzy})
           ) AS rank
      FROM "User" u
     WHERE (u."searchVector" @@ to_tsquery('english', ${tsquery})
            OR similarity(u."name", ${fuzzy}) > 0.3)
       AND u."deletedAt" IS NULL
     ORDER BY rank DESC
     LIMIT ${limit}
  `);
}

/* --------------------------------------------------------------- shortlist */

export type SimilarityCandidate = {
  id: string;
  slug: string;
  title: string;
  problemNormalised: string;
  topics: string[];
  techStack: string[];
  trigramScore: number;
};

/**
 * The first half of duplicate detection: let the trigram index cheaply reduce
 * every project in the corpus to a couple of dozen candidates. The exact
 * weighted score is then computed in `similarity.ts`, which is pure and tested.
 *
 * Splitting it this way is what keeps the scorer honest — the part that decides
 * has no database in it, so it can be tested against known pairs.
 */
export async function shortlistSimilarProjects(
  problem: string,
  {
    excludeProjectId,
    limit = SIMILARITY_CANDIDATE_LIMIT,
  }: {
    excludeProjectId?: string;
    limit?: number;
  } = {},
): Promise<SimilarityCandidate[]> {
  const normalised = normaliseForTrigrams(problem);
  if (!normalised) return [];

  return db.$queryRaw<SimilarityCandidate[]>(Prisma.sql`
    SELECT p."id", p."slug", p."title",
           COALESCE(p."problemNormalised", '') AS "problemNormalised",
           COALESCE(ARRAY(SELECT t."slug"
                            FROM "ProjectTopic" pt
                            JOIN "Topic" t ON t."id" = pt."topicId"
                           WHERE pt."projectId" = p."id"), ARRAY[]::text[]) AS "topics",
           -- COALESCE, like topics above. A Prisma scalar list has no database
           -- default, so a row created without one holds NULL: the client
           -- normalises that to [] and raw SQL does not. Phase 8 found this the
           -- hard way, when the first project created through the UI made the
           -- scorer throw reading a property of null.
           COALESCE(p."techStack", ARRAY[]::text[]) AS "techStack",
           similarity(p."problemNormalised", ${normalised}) AS "trigramScore"
      FROM "Project" p
     WHERE p."deletedAt" IS NULL
       AND p."problemNormalised" IS NOT NULL
       ${excludeProjectId ? Prisma.sql`AND p."id" <> ${excludeProjectId}` : Prisma.empty}
       AND similarity(p."problemNormalised", ${normalised}) > ${SIMILARITY_SHORTLIST_FLOOR}
     ORDER BY "trigramScore" DESC
     LIMIT ${limit}
  `);
}
