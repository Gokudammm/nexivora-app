# Data Model

The authoritative definition is `app/prisma/schema.prisma`. This document explains the shape and,
more importantly, the reasoning — the parts a schema file cannot tell you.

**Built in Phase 3 (2026-09-09): 90 models, 29 enums, 16 check constraints, 6 triggers, 10 GIN
indexes.** The model-group counts below were pre-build estimates and read low, mostly because they
did not count join tables. `scripts/verify-db.mjs` asserts the invariants described here; if this
document and that script ever disagree, the script is right.

---

## The spine

```
College
  └── Department
        └── Programme            (B.Tech CSE, Integrated M.Tech AI/ML, …)
              └── Subject        (offered in a Term)
                    └── Class    (a section taking that subject in that term)
                          └── Group
                                └── Project
Student  ──membership──►  Class,  Group
Faculty  ──assignment──►  Subject, Class
```

Every row that belongs to an institution carries `collegeId`, denormalised deliberately, so that
the cross-college isolation check is a single indexed predicate rather than a four-table join.
This is the single most important performance and security decision in the schema.

---

## Model groups

### 1. Identity & access (~10 models)

`User` · `Account` · `Session` · `VerificationToken` · `Role` (enum) · `UserRole` ·
`Membership` · `Invitation` · `AuditLog` · `PrivacySetting`

- `User` holds identity only. Everything academic lives on `StudentProfile` / `FacultyProfile` /
  `AlumniProfile` / `CompanyProfile`, so a user can legitimately be an alumnus of one college and
  an employee of a company without contorting one table.
- `Membership` is the join between a user, a college and a role, with a state
  (`INVITED · ACTIVE · SUSPENDED · ALUMNI · GUEST`). **A user's role is not global — it is
  per-membership.** This is what allows the alumni transition to be a state change rather than a new
  account.
- **`GUEST` is how cross-college collaboration works** (ADR-022). A student working on a partner
  college's project holds a real membership there, so every "is this user a member of this college"
  check keeps working unchanged — but the state keeps them out of that college's directory and
  statistics. It requires an accepted `CollegePartnership`, and `db:verify` asserts both halves.
  The alternative — a group member with no membership at the group's college — would turn one
  predicate into a special case in every authorisation check, and the check that forgot would leak.
- `AuditLog` is append-only: actor, action, subject type and id, before/after diff, IP, timestamp.
  Every administrative and evaluative action writes one.

### 2. Institution hierarchy (~9 models)

`College` · `Department` · `Programme` · `Subject` · `Term` · `Class` · `ClassEnrolment` ·
`SubjectAssignment` · `CollegeVerification`

- `Term` (academic session) is a first-class model, not a string field. Every class, group, project
  and analytic rolls up to a term. Without this, "projects this semester" is unanswerable and every
  accreditation report is impossible.
- `Class` is the pairing of a `Subject`, a `Term` and a section. Students enrol into classes;
  faculty are assigned to them.

### 3. Profiles & the social graph (~9 models)

`StudentProfile` · `FacultyProfile` · `AlumniProfile` · `CompanyProfile` · `ResearcherProfile` ·
`Skill` · `UserSkill` · `Follow` · `Connection`

- `UserSkill` carries a `source` (`SELF` / `PROJECT_INFERRED` / `ATTESTED`) and, when inferred, the
  project ids that produced it. **A skill on Nexivora points at evidence.**
- `Follow` is polymorphic over `USER · PROJECT · TOPIC · COLLEGE · GROUP` with a target id, which is
  what makes the three feed tabs a single query shape rather than five.

### 4. Groups & the workspace (~14 models) — the heart

`Group` · `GroupMember` · `Task` · `TaskComment` · `TaskLabel` · `FileAsset` · `FileVersion` ·
`Thread` · `Message` · `Mention` · `Meeting` · `MeetingAttendance` · `LedgerEvent` · `PeerReview`

- **`LedgerEvent` is append-only and written inside the same transaction as the action it
  records.** Closing a task writes the task update and the ledger event together or neither
  happens. This is what makes the Contribution Ledger trustworthy rather than decorative.
  Event kinds: `TASK_CLOSED · FILE_ADDED · FILE_REVISED · THREAD_STARTED · MESSAGE_POSTED ·
  MEETING_ATTENDED · MILESTONE_OWNED · COMMIT_LINKED · REVIEW_GIVEN`. Each carries a weight from
  `config/ledger.ts` — weights are configuration, never hard-coded at the call site, because they
  will need tuning against real usage.
- `PeerReview` closes a milestone: each member rates each other member on contribution,
  reliability and communication, with a required comment. Individual ratings are **never** shown to
  the rated member; only the aggregate is, and only to faculty in full detail. This is the design
  that makes honest peer review possible.
- `FileAsset` / `FileVersion` — versioning is a separate table, not a mutated row, so a project's
  history is recoverable and "who contributed this" is answerable.

### 5. Projects (~13 models)

`Project` · `ProjectSection` · `ProjectMember` · `Milestone` · `ProjectStatusEvent` ·
`ProjectTag` · `ProjectDomain` · `ProjectSDG` · `TechStackItem` · `ProjectLink` ·
`ProjectLineage` · `ProjectSubmission` · `SimilarityCheck`

- **`ProjectSection` is a row per section, not a blob of JSON.** Sections are
  `PROBLEM · RESEARCH · SOLUTION · METHODOLOGY · PROTOTYPE · TESTING · RESULTS · CONCLUSION ·
  FUTURE_WORK`. A row per section means: faculty can leave feedback on one section, a section has
  its own edit history and word count, the public page renders real `<h2>` blocks (which matters
  for snippets), and a half-finished project is a partially-populated set of rows rather than an
  unparseable object.
- `ProjectLineage` is `(parentProjectId, childProjectId, kind, note)` where kind is
  `BUILDS_ON · EXTENDS · REPLICATES · FORKS`. This is the lineage graph. It is a table, not a
  parent pointer, because a project can legitimately build on two predecessors.
- `Project.visibility` — `PRIVATE · GROUP · CLASS · COLLEGE · PUBLIC` — plus `embargoUntil` for
  IP protection. **Indexability is derived from these two fields**, never set independently, so a
  private project can never accidentally reach the sitemap.
- `Project.citationId` is assigned once at archive time, immutable, and formatted
  `NXV-{collegeCode}-{year}-{base32 sequence}` — human-readable, printable, and stable forever.
- `SimilarityCheck` stores the result of the duplicate scan at proposal time: the top matches, the
  scores, and whether faculty overrode it. Storing the check (not just running it) means the
  decision is auditable.

### 6. Feed & engagement (~8 models)

`Post` · `PostAttachment` · `Comment` · `Reaction` · `Save` · `Notification` ·
`NotificationPreference` · `ActivityEvent`

- **A `Post` must reference an anchor** — `projectId`, `ideaId`, `questionId` or `resourceId`.
  This is enforced by a check constraint, not by convention. It is the rule that keeps the feed
  from becoming a status-update wasteland.
- `Post.source` is `AUTHORED` or `GENERATED`. Generated posts come from domain events (milestone
  closed, project published) and are attributed to the group with the acting user named.
- `ActivityEvent` is the raw, internal, unranked stream. `Post` is the public, rankable
  presentation. Keeping them separate means we can change what generates a post without losing
  history.

### 7. Ideas & collaboration (~6 models)

`Idea` · `IdeaInterest` · `CollaborationRequest` · `SavedSearch` · `TeammateSuggestion` ·
`Question` + `Answer`

- `Idea.status` — `IDEA · LOOKING_FOR_TEAM · IN_DEVELOPMENT · TESTING · COMPLETED`, exactly the
  brief's ladder. An idea that reaches `IN_DEVELOPMENT` links to the `Project` it became, so the
  hub shows outcomes, not just intentions.

### 8. Evaluation (~6 models)

`Rubric` · `RubricCriterion` · `Evaluation` · `CriterionScore` · `Feedback` · `Attestation`

- `Evaluation` carries both a group score and per-member scores, because the whole point of the
  Contribution Ledger is that a group grade and an individual grade can legitimately differ.
- `Attestation` is `(facultyId, subjectType, subjectId, statement, issuedAt, revokedAt)`.
  It is the thing that converts a workspace-evidenced claim into a faculty-attested one, and it is
  revocable — with the revocation preserved, not deleted.

### 9. Network & opportunities (~10 models, Phases 13–14)

`MentorshipRequest` · `MentorshipSession` · `Opportunity` · `Application` · `ApplicationStage` ·
`Event` · `EventRegistration` · `Challenge` · `ChallengeSubmission` · `CollegePartnership`

### 10. Knowledge & taxonomy (~7 models)

`Topic` · `SDG` · `Resource` · `ResourceCollection` · `Article` · `Tag` · `Report`

`Topic` is hierarchical (two levels: domain → sub-domain) and is the same data that drives
`/topics/[slug]`, the explore facets, the project domain colour and the teammate matcher. **One
taxonomy, four consumers** — defined in `config/taxonomy.ts` and seeded from it.

---

## Search and similarity

Three Postgres features do work that would otherwise need a paid service:

| Need | Mechanism |
| --- | --- |
| Global search across projects, people, ideas, posts | A `searchVector tsvector` column per searchable model, maintained by a trigger, with a GIN index. Weighted: title A, tags B, sections C, body D. |
| Duplicate project detection | `pg_trgm` similarity over a normalised problem statement, combined with Jaccard overlap of tag and tech-stack sets. Deterministic, explainable, and tuned against the seed. |
| "Projects like this" | The same similarity score, limited to public projects, excluding the same group. |

The similarity scorer lives in `lib/search/similarity.ts` and is unit-tested against fixture pairs
with known expected outcomes — because "is this a duplicate" is a decision that affects a student's
grade and must not be a black box.

---

## Conventions

1. **`cuid2` ids everywhere.** Not auto-increment (leaks volume and enumerates), not UUIDv4
   (poor index locality).
2. **`createdAt` / `updatedAt` on every model.** No exceptions — analytics and accreditation
   reports both depend on it.
3. **Soft delete (`deletedAt`) on user-authored content**, hard delete on join tables. A DPDP
   erasure request is a hard delete plus an anonymisation pass, handled explicitly in Phase 16, not
   by a cascade.
4. **Enums for every closed set.** A status as a string is a bug waiting for a typo.
5. **`collegeId` on every institution-scoped model**, indexed, and included in every scoped query.
6. **Every foreign key has an index.** Prisma does not always create one.
7. **Composite indexes for the real access patterns**, not for every column:
   `(collegeId, termId, status)` on Project, `(groupId, status, dueDate)` on Task,
   `(userId, readAt)` on Notification, `(visibility, publishedAt)` on Project.
8. **Money and marks are `Decimal`**, never `Float`.
9. **Timestamps are stored UTC**, rendered in the college's timezone.

---

## Seed data — what Phase 3 must produce

The seed is not filler; it is the demo, and it must tell a story.

- One college — *Nexivora Institute of Technology* — with 4 departments, 6 programmes,
  ~18 subjects, 2 terms, 8 classes.
- ~60 students, 12 faculty, 2 college admins, 6 alumni, 3 companies, 1 platform admin.
- ~14 groups across various states: one just formed, one mid-sprint with a healthy ledger, **one
  with a visibly silent member** (so the faculty health signal has something real to show), one
  under review, three completed and archived.
- ~20 projects spanning every domain, every lifecycle state, and a **real lineage chain three
  levels deep** so the lineage tree is not a single node.
- One project deliberately similar to an archived one, so the duplicate check demonstrably fires.
- A populated feed generated from the above activity, not hand-written.
- Ideas at every status, including one that became a project.
- One evaluation completed with a rubric, two attestations issued, one attestation revoked.

`npm run db:reset` must rebuild all of this in under twenty seconds, and `npm run db:verify` must
assert the integrity rules — no public project from an unapproved proposal, no ledger event without
a corresponding action, no post without an anchor, no project outside its college's hierarchy.

---

## As built — what Phase 3 actually produced

### Beyond the groups above

Four models the plan implied but did not name:

| Model | Why it exists |
| --- | --- |
| `Question` · `Answer` | `PostKind` includes `QUESTION`. The "exactly one anchor" constraint is meaningless if an anchor column points at a table that does not exist. |
| `Resource` | Same, for `RESOURCE` — a shared paper, dataset or tool, stored as a link plus the annotation saying why it matters. |
| `ActivityEvent` | The raw internal stream, separate from the rankable `Post`, so what generates a post can change without losing history. |

### Invariants enforced by the database, not by convention

```
Post_exactly_one_anchor                 exactly one of projectId/ideaId/questionId/resourceId
Project_public_requires_approval        visibility PUBLIC implies approved              (ADR-010)
Project_approved_has_timestamp          approved implies approvedAt is set
Project_completed_after_started         completedOn >= startedOn
ProjectLineage_no_self_parent           a project cannot build on itself
PeerReview_not_self / _scores_in_range  no self-review; 1..5
MentorshipRequest_not_self              mentor <> mentee
CollaborationRequest_not_self           sender <> recipient
CollegePartnership_not_self             a <> b
Follow_not_self                         no following yourself
Term_ends_after_start                   endsOn > startsOn
Group_size_limit_positive               sizeLimit > 0
RubricCriterion_weight_range            0 < weight <= 100
Opportunity_valid_through_after_posted  an expiry after the posting date
Opportunity_stipend_range               max >= min
```

Rules a check constraint cannot express — because they need a join or a graph walk — are asserted by
`scripts/verify-db.mjs` instead: the ledger pointing only at actions that exist, the lineage graph
being acyclic, cross-college guests having a partnership, and `FACULTY_ATTESTED` contributions
having an actual attestation behind them.

### `Follow` deliberately has no foreign key

`targetId` points into five different tables depending on `targetType`, so a constraint to any
one of them would reject the other four. A fake FK that holds for a fifth of the rows is worse than
none; `db:verify` asserts every follow resolves instead.

### Full-text search

`searchVector` columns on **Project, Idea, Post, User, Resource**, maintained by triggers and never
written by application code. Weighting per entity, A → D:

| Entity | A | B | C | D |
| --- | --- | --- | --- | --- |
| Project | title | keywords, stack, domain, dept | summary + abstract | section bodies |
| Idea | title | skills needed, domain | summary | problem + approach |
| User | name | username | headline | bio + location |
| Resource | title | tags, kind | summary | — |
| Post | body | — | — | — |

Editing a project section refreshes its parent project's vector — a separate trigger, asserted
separately, because a trigger that fires on insert but not on update serves stale results silently.

Trigram (`gin_trgm_ops`) indexes additionally cover `Project.problemNormalised`,
`Idea.problemNormalised`, `Project.title`, `User.name` and `User.username`, so a misspelled
search still finds the right thing.

### Reading the data

Never query `db` directly from a page. `src/lib/db/queries/` takes a **`Viewer`** as its first
argument, always — including for the logged-out public, where `ANONYMOUS` is a real viewer rather
than a null. `visibleTo(viewer)` is the database-side visibility predicate, written once and
composed by every query, and `db:verify` asserts it selects exactly the same public projects as
the Phase 2 fixtures do.
