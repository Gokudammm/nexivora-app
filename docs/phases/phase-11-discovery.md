# Phase 11 — Discovery, Idea Hub & Collaboration

| | |
| --- | --- |
| **Status** | ⬜ Not Started |
| **Depends on** | Phase 6, Phase 8, Phase 10 |
| **Blocks** | Phases 12, 13, 14 |
| **Estimate** | 9 focused hours |
| **Started** | — |
| **Completed** | — |

## What Phase 3 already provides

*Added 2026-09-09, when Phase 3 completed. Check these before building — the most common way to
waste a phase is to rebuild something the previous one shipped.*

- **Full-text search is built.** `lib/search/fts.ts` has `searchProjects`, `searchIdeas` and
  `searchPeople`, all parameterised. Vectors are trigger-maintained on Project, Idea, Post, User
  and Resource with A/B/C/D weighting, and `db:verify` asserts the ranking behaves.
- **`toTsQuery()` already handles hostile input** and adds trailing-prefix matching for
  search-as-you-type. Every token is stripped to `[a-z0-9]`, so the output is safe by construction.
- **Trigram indexes cover titles and names**, so a misspelling still finds the right thing.
- **`src/config/taxonomy.ts` is seeded into `Topic` and `Sdg`** — 24 topics, 17 goals. It
  remains the single definition; the tables exist for joins and counts.

## What Phase 8 already provides

*Added 2026-09-10, when Phase 8 completed.*

- **The public project corpus reads the database** (`queries/public-projects.ts`), and the derived
  views are pure functions over it in `content/derive.ts` (ADR-042).
- **`relatedTo()` is the function to replace.** It scores shared topics, SDGs and domain today;
  swapping in trigram similarity changes **one function in one file**, and both the fixture and
  database paths get it. The signature stays.
- **`shortlistSimilarProjects()` + `scoreSimilarity()` are already wired** to the proposal flow and
  asserted against the seeded near-duplicate. Discovery reuses them rather than re-deriving.
- **Any raw query over a scalar list needs `COALESCE`** (ADR-043) — the client and raw SQL disagree
  about `NULL`.

## Objective

Make everything on the platform findable, and make forming a team a solved problem rather than a
WhatsApp broadcast. **Every recommendation in this phase is deterministic and shows its reasoning**
— which is both an AI-credits constraint and a genuinely better design for an academic context
(ADR-012).

## In scope

- Global search across every entity type, on Postgres FTS
- Faceted explore, now database-backed
- The Idea Hub with its status ladder
- Deterministic teammate matching with visible explanations
- Collaboration requests
- Related projects and saved searches

## Out of scope

- Semantic / embedding search (Phase 18, layered on top of this) · Cross-college discovery (Phase 14)

## Deliverables

### Search — `/search` and the topbar
- [ ] `lib/search/query.ts` — parameterised full-text queries against the Phase 3 `tsvector`
      columns, ranked with `ts_rank_cd` and the A/B/C/D weighting
- [ ] Entity types: projects, people, groups, ideas, posts, topics, colleges, resources
- [ ] Tabbed results with per-type counts; "everything" as the default tab
- [ ] Typeahead in the topbar via `/api/search`, debounced, with keyboard navigation
- [ ] Query features: quoted phrases, `-exclusion`, `tag:` and `domain:` prefixes
- [ ] Highlighted match snippets from `ts_headline`
- [ ] Trigram fallback for misspellings — "did you mean"
- [ ] Recent searches (local) and saved searches (persisted)
- [ ] **Every result is authorisation-filtered at the query**, so search can never reveal the
      existence of something the viewer cannot see
- [ ] Empty state suggesting broader terms and popular topics

### Explore — `/explore`, database-backed
- [ ] Replaces the Phase 2 fixtures with real queries
- [ ] Facets: domain, sub-domain, SDG, status, year, college, tech stack, has-prototype,
      attested-only
- [ ] Facet counts computed alongside the results, not with a query per facet
- [ ] Sort: relevance, recent, most engaged, most built-on
- [ ] **Filter state in query parameters**, indexability per `docs/SEO-CHECKLIST.md` §5 — single
      facet canonicalises to its hub, multi-facet is `noindex, follow`
- [ ] Real paginated `<a href>` links; infinite scroll only as an enhancement on top
- [ ] Grid and list views; grid uses the Phase 1 generated project covers
- [ ] `/topics/[slug]` and `/sdg/[n]` now read from the database, keeping their editorial content

### The Idea Hub — `/ideas`
- [ ] Post an idea: title, description, problem it addresses, domain, tags, SDGs, skills needed,
      team size wanted, commitment level, timeline
- [ ] Status ladder: `IDEA → LOOKING_FOR_TEAM → IN_DEVELOPMENT → TESTING → COMPLETED`
- [ ] **An idea that reaches `IN_DEVELOPMENT` links to the project it became**, so the hub shows
      outcomes rather than only intentions
- [ ] Express interest, comment, save, follow
- [ ] Owner view: interested users with their skills and match scores, accept into a group
- [ ] Browse with facets: domain, status, skills needed, college, SDG
- [ ] Public and indexable — *"final year project ideas"* is one of the highest-volume queries in
      this space and this page answers it with real, claimable ideas rather than a listicle

### Teammate matching — deterministic
- [ ] `lib/matching/teammate.ts` — a scoring function over:
      - **Skill complement** — has skills the team lacks (weighted highest)
      - **Skill overlap** — shares enough context to collaborate
      - **Domain interest** alignment
      - **Availability** — declared, and open group slots
      - **Same class or department** (a proximity bonus, not a requirement)
      - **Past collaboration** signal
      - **Ledger reliability** — historical contribution consistency, opt-in and never a raw score
        shown to others
- [ ] Weights in `config/matching.ts`
- [ ] **Every suggestion renders its explanation**: "Priya matches 4 of 5 skills you need, has
      built 2 IoT projects, is in your department, and has capacity this term."
- [ ] Unit-tested against fixtures with known expected rankings
- [ ] Surfaces: `/groups/[id]` (find members), `/ideas/[slug]` (find collaborators), a
      "people to work with" module on the profile
- [ ] Respects privacy — a user not discoverable is never suggested

### Collaboration requests
- [ ] Request to join a group or an idea, with a message and a relevant-skills highlight
- [ ] Invite to join, from the matching results
- [ ] States: pending, accepted, declined, withdrawn, expired (14 days)
- [ ] Notifications on every transition
- [ ] Rate limited (20/day) so it cannot become a broadcast channel
- [ ] A request history so patterns are visible

### Related & recommended
- [ ] "Projects like this" — trigram similarity plus shared tags and domain, excluding the same
      group, public only
- [ ] "Build on this" entry point from any readable project (the flow itself is Phase 12)
- [ ] Recommended topics and people to follow, deterministic and explainable
- [ ] Saved searches with an optional weekly email of new matches

## Acceptance criteria

1. Searching a term that appears only in a project's methodology returns that project, ranked below
   one where the term is in the title.
2. Search returns nothing the viewer is not authorised to see — verified by searching, as a member
   of college B, for a term unique to a private college A project.
3. Facet counts match the actual result counts for every combination.
4. A student posts an idea, receives ranked teammate suggestions **each with a stated reason**,
   sends a request, and forms a group — with no AI involved anywhere.
5. Match scores are deterministic and the unit test asserts the expected ranking.
6. `/explore?domain=ai-ml` canonicalises to `/topics/ai-ml`; a three-facet URL is `noindex`.
7. Typeahead responds in under 150ms with the seed data.
8. A user who has disabled discoverability never appears in suggestions or search.
9. Pagination works with JavaScript disabled.
10. `npm run check` and the unit suite are clean.

## Key files this phase creates

```
src/app/(app)/search/page.tsx
src/app/(public)/explore/page.tsx        Now database-backed
src/app/(public)/ideas/*
src/app/api/search/route.ts              Typeahead
src/lib/search/{query,facets,highlight}.ts
src/lib/matching/teammate.ts             Deterministic, explained, unit tested
src/lib/db/queries/{search,idea}.ts
src/config/matching.ts                   Weights as configuration
```

## Notes & risks

- **The explanation is the feature.** A ranked list with no reasoning is a black box that a faculty
  member cannot endorse and a student will not trust. "Matches 4 of 5 skills you need" is more
  persuasive than any score, and it is what makes this defensible as the AI-free version.
- **Authorisation must be inside the search query.** Filtering results after fetching leaks
  existence through result counts and through timing. Apply the predicate in SQL.
- Facet counts are the classic N+1 trap — a query per facet value will be slow immediately. Compute
  them in one aggregate query alongside the results.
- **The Idea Hub is a major SEO surface**, not a minor feature. Make the public idea pages genuinely
  good: a real problem statement, real skills needed, a real status. Thin idea pages would be
  exactly the doorway-page pattern we prohibit.
- Postgres FTS is genuinely good to well past 100k rows. Do not reach for Elasticsearch or Algolia;
  neither is needed and both add cost and a service that can expire.
- The ledger reliability signal in matching is sensitive. It must be opt-in, must never be shown as
  a raw score to other students, and must never be the dominant term — otherwise it becomes a
  reputation system, which is a different and much more dangerous product.
- Phase 18 layers semantic search **on top of** this. Keep the lexical path as the default and the
  fallback; the AI path re-ranks a shortlist this phase produced.

---

## Phase Summary

*Fill this in when the phase is complete.*

**What was built.**

**Key decisions made.**

**Matching weights chosen, and how they were validated.**

**Deviations from the spec above, and why.**

**Anything the next phase must know.**

**Verified by.**

| Check | Result |
| --- | --- |
| | |
