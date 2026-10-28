-- AlterTable
ALTER TABLE "Idea" ADD COLUMN     "problemNormalised" TEXT,
ADD COLUMN     "searchVector" tsvector;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "searchVector" tsvector;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "problemNormalised" TEXT,
ADD COLUMN     "searchVector" tsvector;

-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "searchVector" tsvector;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "searchVector" tsvector;

-- ═══════════════════════════════════════════════════════════════════════════
-- HAND-WRITTEN. Everything below this line is SQL Prisma cannot express:
-- check constraints, trigger functions, triggers and GIN indexes.
--
-- EXTENSIONS. This block has to satisfy three different databases:
--
--   · the dev database, where `npm run db:up` already installed them;
--   · Prisma's SHADOW database, which is created empty for every `migrate dev`
--     and therefore has no extensions at all — a migration that only asserts
--     would make `migrate dev` permanently unusable;
--   · production, where the migration role is deliberately NOT superuser
--     (docs/SECURITY.md §9) and a DBA installed them by hand per
--     DEPLOYMENT.md §3.3.
--
-- So: try to create, swallow only a privilege error, then assert. Production
-- reaches the assert with the extensions already present, because
-- `IF NOT EXISTS` short-circuits before the privilege check. A genuinely
-- missing extension still fails with an instruction rather than a stack trace.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE EXTENSION IF NOT EXISTS unaccent;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    RAISE EXCEPTION 'pg_trgm is not installed in this database. Run: npm run db:up';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'unaccent') THEN
    RAISE EXCEPTION 'unaccent is not installed in this database. Run: npm run db:up';
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 1 · INVARIANTS AS CHECK CONSTRAINTS
--
-- These are rules the product cannot be allowed to break. Enforced here rather
-- than in application code, because application code has many entry points and
-- a table has one.
-- ───────────────────────────────────────────────────────────────────────────

-- ADR-006: every post is ABOUT something. Exactly one anchor, never zero, never
-- two. Without this the feed degrades into status updates the first time some
-- route handler forgets.
ALTER TABLE "Post" ADD CONSTRAINT "Post_exactly_one_anchor" CHECK (
  ( ("projectId"  IS NOT NULL)::int
  + ("ideaId"     IS NOT NULL)::int
  + ("questionId" IS NOT NULL)::int
  + ("resourceId" IS NOT NULL)::int ) = 1
);

-- ADR-010: indexability is derived, never set by hand. A publicly visible
-- project that no faculty member approved must not be representable.
ALTER TABLE "Project" ADD CONSTRAINT "Project_public_requires_approval"
  CHECK ("visibility" <> 'PUBLIC' OR "approved" = true);

ALTER TABLE "Project" ADD CONSTRAINT "Project_approved_has_timestamp"
  CHECK ("approved" = false OR "approvedAt" IS NOT NULL);

ALTER TABLE "Project" ADD CONSTRAINT "Project_completed_after_started"
  CHECK ("completedOn" IS NULL OR "completedOn" >= "startedOn");

-- A project cannot build on itself. Longer cycles need a graph walk and are
-- asserted by scripts/verify-db.mjs; the trivial case is free to catch here.
ALTER TABLE "ProjectLineage" ADD CONSTRAINT "ProjectLineage_no_self_parent"
  CHECK ("parentId" <> "childId");

-- Peer review only means anything about other people.
ALTER TABLE "PeerReview" ADD CONSTRAINT "PeerReview_not_self"
  CHECK ("authorId" <> "subjectId");
ALTER TABLE "PeerReview" ADD CONSTRAINT "PeerReview_scores_in_range" CHECK (
  "contribution"  BETWEEN 1 AND 5 AND
  "reliability"   BETWEEN 1 AND 5 AND
  "communication" BETWEEN 1 AND 5
);

ALTER TABLE "MentorshipRequest" ADD CONSTRAINT "MentorshipRequest_not_self"
  CHECK ("mentorId" <> "menteeId");
ALTER TABLE "CollaborationRequest" ADD CONSTRAINT "CollaborationRequest_not_self"
  CHECK ("senderId" <> "recipientId");
ALTER TABLE "CollegePartnership" ADD CONSTRAINT "CollegePartnership_not_self"
  CHECK ("aId" <> "bId");

-- Following yourself produces a self-referential feed. The other four target
-- types have no such constraint available, which is why Follow carries no FK.
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_not_self"
  CHECK (NOT ("targetType" = 'USER' AND "targetId" = "followerId"));

ALTER TABLE "Term" ADD CONSTRAINT "Term_ends_after_start" CHECK ("endsOn" > "startsOn");
ALTER TABLE "Group" ADD CONSTRAINT "Group_size_limit_positive" CHECK ("sizeLimit" > 0);
ALTER TABLE "RubricCriterion" ADD CONSTRAINT "RubricCriterion_weight_range"
  CHECK ("weight" > 0 AND "weight" <= 100);

-- An expired posting still in the search index is a quality signal Google acts
-- on. The dates have to be coherent for the honouring logic to mean anything.
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_valid_through_after_posted"
  CHECK ("validThrough" > "postedOn");
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_stipend_range"
  CHECK ("stipendMin" IS NULL OR "stipendMax" IS NULL OR "stipendMax" >= "stipendMin");

-- The three-tier proof model is only meaningful if the top tier requires a
-- signature. FACULTY_ATTESTED without an attestation is exactly the kind of
-- quiet inflation this platform exists to prevent, so it is asserted in
-- verify-db against the Attestation table (a check constraint cannot join).

-- ───────────────────────────────────────────────────────────────────────────
-- 2 · TEXT NORMALISATION
--
-- STABLE, not IMMUTABLE. unaccent() depends on a dictionary and is only STABLE;
-- the usual trick is to lie about it so it can go in an index expression. We do
-- not need to: every use below writes into a stored column maintained by a
-- trigger, and the indexes are on plain columns.
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION nexivora_normalise(txt text) RETURNS text AS $$
  SELECT lower(public.unaccent(coalesce(txt, '')));
$$ LANGUAGE sql STABLE;

-- ───────────────────────────────────────────────────────────────────────────
-- 3 · SEARCH VECTORS
--
-- Weighting, per entity. The spec's shape is title A / tags B / sections C /
-- body D. For Project we deliberately swap C and D: the abstract is a curated
-- summary written for a reader, and raw section prose is not. A term in the
-- abstract is a stronger signal than the same term buried in a methodology
-- paragraph, and ranking them the other way makes search feel arbitrary.
-- Acceptance criterion 3 (a methodology-only term still matches, ranked below a
-- title match) holds either way.
-- ───────────────────────────────────────────────────────────────────────────

-- Takes the field values rather than reading the row: in a BEFORE trigger the
-- new values exist only in NEW, so a function that SELECTed from "Project"
-- would silently index the previous version of every edit. Only the section
-- bodies are read from the table, and those are not what is being updated.
CREATE OR REPLACE FUNCTION nexivora_project_search(
  p_id         text,
  p_title      text,
  p_keywords   text[],
  p_tech       text[],
  p_domain     text,
  p_department text,
  p_summary    text,
  p_abstract   text
) RETURNS tsvector AS $$
  SELECT setweight(to_tsvector('english', nexivora_normalise(p_title)), 'A')
      || setweight(to_tsvector('english', nexivora_normalise(
           concat_ws(' ', array_to_string(coalesce(p_keywords, ARRAY[]::text[]), ' '),
                          array_to_string(coalesce(p_tech, ARRAY[]::text[]), ' '),
                          p_domain, p_department))), 'B')
      || setweight(to_tsvector('english', nexivora_normalise(
           concat_ws(' ', p_summary, p_abstract))), 'C')
      || setweight(to_tsvector('english', nexivora_normalise(
           coalesce((SELECT string_agg(s."body", ' ')
                       FROM "ProjectSection" s
                      WHERE s."projectId" = p_id), ''))), 'D');
$$ LANGUAGE sql STABLE;

-- Reads only ProjectSection, so it is correct from both triggers below.
CREATE OR REPLACE FUNCTION nexivora_project_problem(p_id text) RETURNS text AS $$
  SELECT nexivora_normalise(coalesce(
    (SELECT s."body" FROM "ProjectSection" s
      WHERE s."projectId" = p_id AND s."kind" = 'PROBLEM'), ''));
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION nexivora_project_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" := nexivora_project_search(
    NEW."id", NEW."title", NEW."keywords", NEW."techStack",
    NEW."domain", NEW."department", NEW."summary", NEW."abstract");
  NEW."problemNormalised" := nexivora_project_problem(NEW."id");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Project_tsv"
  BEFORE INSERT OR UPDATE ON "Project"
  FOR EACH ROW EXECUTE FUNCTION nexivora_project_tsv_trigger();

-- A project's vector includes its section bodies, so editing a section has to
-- refresh the parent. This UPDATE fires the BEFORE trigger above, which
-- recomputes the identical values -- idempotent, one level deep, and it cannot
-- recurse because that trigger issues no statements of its own.
CREATE OR REPLACE FUNCTION nexivora_project_section_tsv_trigger() RETURNS trigger AS $$
DECLARE
  target text := COALESCE(NEW."projectId", OLD."projectId");
BEGIN
  UPDATE "Project" p
     SET "searchVector"      = nexivora_project_search(
           p."id", p."title", p."keywords", p."techStack",
           p."domain", p."department", p."summary", p."abstract"),
         "problemNormalised" = nexivora_project_problem(p."id")
   WHERE p."id" = target;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProjectSection_tsv"
  AFTER INSERT OR UPDATE OR DELETE ON "ProjectSection"
  FOR EACH ROW EXECUTE FUNCTION nexivora_project_section_tsv_trigger();

CREATE OR REPLACE FUNCTION nexivora_idea_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
       setweight(to_tsvector('english', nexivora_normalise(NEW."title")), 'A')
    || setweight(to_tsvector('english', nexivora_normalise(
         concat_ws(' ', array_to_string(coalesce(NEW."skillsNeeded", ARRAY[]::text[]), ' '),
                        NEW."domain"))), 'B')
    || setweight(to_tsvector('english', nexivora_normalise(NEW."summary")), 'C')
    || setweight(to_tsvector('english', nexivora_normalise(
         concat_ws(' ', NEW."problem", NEW."approach"))), 'D');
  NEW."problemNormalised" := nexivora_normalise(NEW."problem");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Idea_tsv"
  BEFORE INSERT OR UPDATE ON "Idea"
  FOR EACH ROW EXECUTE FUNCTION nexivora_idea_tsv_trigger();

CREATE OR REPLACE FUNCTION nexivora_post_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" := setweight(
    to_tsvector('english', nexivora_normalise(NEW."body")), 'A');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Post_tsv"
  BEFORE INSERT OR UPDATE ON "Post"
  FOR EACH ROW EXECUTE FUNCTION nexivora_post_tsv_trigger();

CREATE OR REPLACE FUNCTION nexivora_user_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
       setweight(to_tsvector('english', nexivora_normalise(NEW."name")), 'A')
    || setweight(to_tsvector('english', nexivora_normalise(NEW."username")), 'B')
    || setweight(to_tsvector('english', nexivora_normalise(NEW."headline")), 'C')
    || setweight(to_tsvector('english', nexivora_normalise(
         concat_ws(' ', NEW."bio", NEW."location"))), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "User_tsv"
  BEFORE INSERT OR UPDATE ON "User"
  FOR EACH ROW EXECUTE FUNCTION nexivora_user_tsv_trigger();

CREATE OR REPLACE FUNCTION nexivora_resource_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
       setweight(to_tsvector('english', nexivora_normalise(NEW."title")), 'A')
    || setweight(to_tsvector('english', nexivora_normalise(
         concat_ws(' ', array_to_string(coalesce(NEW."tags", ARRAY[]::text[]), ' '),
                        NEW."kind"))), 'B')
    || setweight(to_tsvector('english', nexivora_normalise(NEW."summary")), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Resource_tsv"
  BEFORE INSERT OR UPDATE ON "Resource"
  FOR EACH ROW EXECUTE FUNCTION nexivora_resource_tsv_trigger();

-- ───────────────────────────────────────────────────────────────────────────
-- 4 · INDEXES
-- ───────────────────────────────────────────────────────────────────────────

CREATE INDEX "Project_searchVector_idx"  ON "Project"  USING GIN ("searchVector");
CREATE INDEX "Idea_searchVector_idx"     ON "Idea"     USING GIN ("searchVector");
CREATE INDEX "Post_searchVector_idx"     ON "Post"     USING GIN ("searchVector");
CREATE INDEX "User_searchVector_idx"     ON "User"     USING GIN ("searchVector");
CREATE INDEX "Resource_searchVector_idx" ON "Resource" USING GIN ("searchVector");

-- The duplicate detector. Trigram similarity over the normalised problem
-- statement is half the score; the other half is Jaccard overlap of the tag and
-- tech-stack sets, computed in src/lib/search/similarity.ts.
CREATE INDEX "Project_problemNormalised_trgm_idx"
  ON "Project" USING GIN ("problemNormalised" gin_trgm_ops);
CREATE INDEX "Idea_problemNormalised_trgm_idx"
  ON "Idea" USING GIN ("problemNormalised" gin_trgm_ops);

-- Fuzzy title match, so a search for "irigation" still finds the irrigation
-- projects. Students type fast and spell approximately.
CREATE INDEX "Project_title_trgm_idx" ON "Project" USING GIN ("title" gin_trgm_ops);

-- The mention picker and the teammate finder both need prefix-tolerant name
-- lookup at keystroke speed.
CREATE INDEX "User_name_trgm_idx"     ON "User" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "User_username_trgm_idx" ON "User" USING GIN ("username" gin_trgm_ops);
