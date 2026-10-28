# Phase 12 — Showcase, Archive & Portfolio

> **This phase completes the MVP.** If time runs out, stop here and present 13–19 as roadmap.

| | |
| --- | --- |
| **Status** | ⬜ Not Started |
| **Depends on** | Phases 8, 9, 11 |
| **Blocks** | Phase 13, Phase 15 |
| **Estimate** | 9 focused hours |
| **Started** | — |
| **Completed** | — |

## What Phase 3 already provides

*Added 2026-09-09, when Phase 3 completed. Check these before building — the most common way to
waste a phase is to rebuild something the previous one shipped.*

- **`ProjectLineage` is a table, not a parent pointer** — a project can build on more than one
  predecessor. A **three-level chain is seeded** (`smart-irrigation-soil-moisture` →
  `irrigation-forecast-lstm` → `canal-scheduling-multi-farm`) so the tree is not a single node.
- **`db:verify` asserts the graph is acyclic** and that the deepest chain is at least three levels.
- **`Project.citationId` is assigned once at archive time and is immutable.** It goes into other
  people's reference lists — never recompute it from mutable fields.
- **An embargoed project is listed with its body withheld.** `battery-second-life-grading` is
  seeded embargoed until 2027-03-31, and `isEmbargoed()` in `queries/projects.ts` already
  decides.

## What Phase 7 already provides

*Added 2026-09-10, when Phase 7 completed.*

- **The three-tier contribution proof has its evidence layer.** The ledger records what each member
  actually did, and `scoreMembers()` turns it into a per-member share with every number traceable
  to its events via `/groups/[id]/activity`. "Workspace-evidenced" means *this*.
- **The ledger is append-only** (ADR-038), which is what makes it citable in an archived record: a
  contribution claim on an archived project cannot be revised after the fact.
- **Peer review aggregates exist per member** and are faculty-visible in detail. Whatever the
  archive surfaces, it must not surface authorship — ADR-008 does not lapse when a project is
  archived.

## What Phase 8 already provides

*Added 2026-09-10, when Phase 8 completed.*

- **The public project page already reads the database.** Phase 12's work is the archive, lineage
  rendering and the citation surface — **not the data source**. `check:seo` passed 127/127 across
  the swap, so that page is a known-good baseline to build on.
- **The citation ID is minted once at archive time** (`NEX-<code>-<year>-<sequence>`) inside the
  `ARCHIVED` transition, and is immutable. It goes into other people's reference lists.
- **`ARCHIVED` is terminal and `isEditable('ARCHIVED')` is false** — the archive's whole claim is
  that a citation points at something that cannot change. Do not add an un-archive edge.
- **`ProjectLineage` rows already render** through `lineageOf()`, which omits a private parent
  rather than showing a broken link.
- **`ProjectSubmission` snapshots are the permanent record** of what was submitted each round.

## What Phase 9 already provides

*Added 2026-09-11, when Phase 9 completed.*

- **Attestations are real, and already render publicly.** `TierBadge` with `attestedBy` is on
  `/projects/[slug]` and `/p/[username]` from Phase 6; Phase 9 is what finally writes
  `FACULTY_ATTESTED`. The showcase does not need to invent an attestation display — it needs to make
  sure the one that exists survives the archive.
- **`/verify` is live and public** (ADR-050). Every attestation carries `NX-XXXX-XXXX-XXXX`, no
  account is needed to check one, and a revoked attestation still resolves and says it was revoked.
  A showcase page that prints an attestation should print its code beside it: the code is the part
  that is worth something off-platform, and it is the only part a reader can check.
- **`verifyAttestation(code)` in `lib/evaluation/attestation-actions.ts`** returns exactly what a
  verifier needs — statement, attester, designation, college, dates, revocation. Reuse it; do not
  query `Attestation` directly, or the two will disagree about what "still valid" means.
- **`ProjectSubmission.snapshot` is the archived record.** Byte-stable (`stableStringify`, sorted
  keys at every depth), one row per round, and it is what the review screen marks. If the archive
  needs "the project as it was assessed", that is this row, not the live one.
- **`/projects/[slug]/feedback` exists** and is gated in the query, not the page (ADR-049). If the
  public showcase ever surfaces an evaluation, copy that shape: `releasedAt: { not: null }` in the
  `where`, never a filter in the render.
- **Attested skills reach the profile as `source: "ATTESTED"`**, and `recomputeSkills` never
  overwrites one. Only the faculty member who signed it can withdraw it.
- Careful with `Attestation.subjectId`: it holds a project id but is **not** a foreign key, so an
  attestation outlives the record it describes — deliberately. `listAttestations()` resolves titles
  separately and falls back to naming the absence rather than rendering "a project".

## Objective

Make student work **permanent, citable, verifiable and public** — the differentiator that turns a
college's project output from a graveyard into a compounding asset, and turns a student's four
years into something they can actually show someone.

## In scope

- The public project page, wired to real data
- The Academic Archive with permanent citation IDs
- The **Build On** flow and the lineage tree
- Contribution-proof badges rendered everywhere
- The student and group portfolio
- PDF export for portfolios and project reports
- The public verification page

## Out of scope

- Companies consuming portfolios (Phase 13) · Analytics (Phase 15)

## Deliverables

### The public project page — `/projects/[slug]`
- [ ] The Phase 2 template wired to real data
- [ ] Slug generated once at publication and **immutable thereafter** (`docs/SEO-CHECKLIST.md` §4)
- [ ] All nine sections as real `<h2>` blocks; embargoed projects show abstract only
- [ ] Team with roles and contribution-proof tier badges
- [ ] Tech stack, domains, SDG marks, college, term, faculty guide
- [ ] Attachments, repository, demo and video links (`rel="ugc"` on outbound)
- [ ] Lineage: parents and children, with the full tree one click away
- [ ] Citation block with copy buttons (plain, APA, IEEE, BibTeX)
- [ ] Engagement: react, comment, save, follow, share
- [ ] Related projects from Phase 11
- [ ] `CreativeWork` + `BreadcrumbList` + `Person` JSON-LD, **matching the visible text**
- [ ] Generated OG image per project
- [ ] `revalidatePath` on publish and on edit, so a new project is crawlable within seconds

### The Academic Archive
- [ ] Archiving a completed project: faculty-triggered or automatic at term close
- [ ] **Permanent citation ID**, assigned once, immutable: `NXV-{collegeCode}-{year}-{base32}` —
      human-readable, printable, stable forever
- [ ] `/archive/[citationId]` — a stable resolver URL that never breaks, even if the slug changes
- [ ] An archived project is **read-only**: no edits, ever. Corrections are an appended erratum.
- [ ] `/colleges/[slug]/archive` — browsable and filterable by year, department and domain
- [ ] The archive is the institutional memory. Say so on the page, because that framing is the
      pitch to a college.

### Build On & lineage — *the compounding mechanism*
- [ ] "Build on this project" from any readable project
- [ ] The flow: choose or create a group → state what you are extending and why → the parent's
      faculty is notified → a `ProjectLineage` row is created with kind
      `BUILDS_ON · EXTENDS · REPLICATES · FORKS`
- [ ] The new project starts with the parent's problem context available as reference, **never
      copied** — copying would defeat the similarity check and the point
- [ ] The parent is credited on the child's page, and the child is listed on the parent's
- [ ] `/projects/[slug]/lineage` — the tree rendered as **SVG**, pan and zoom, keyboard navigable,
      with a text-list fallback that carries the same information
- [ ] Lineage depth and descendant count shown on the parent — *"3 groups have built on this"* is
      the strongest possible signal that a project mattered
- [ ] Cycle prevention enforced at write time, not only checked in the verify script

### Contribution proof, rendered
- [ ] `TierBadge` used consistently everywhere a contribution appears
- [ ] `SELF` — grey outline · `WORKSPACE_EVIDENCED` — iris, links to the ledger evidence ·
      `ATTESTED` — teal, **names the attesting faculty member and links to the attestation**
- [ ] `/verify/[attestationCode]` — a public page confirming an attestation: what, who attested it,
      their designation, the college, the date, and whether it is still valid. `noindex` (it is a
      personal record) but publicly reachable.
- [ ] QR code on the exported PDF resolving to that verification page
- [ ] An `attested-only` filter on explore and on portfolios — this is what makes the tier
      meaningful to an employer

### Portfolio
- [ ] `/p/[username]/projects` — the full public project list
- [ ] The portfolio view: header, summary, skills with evidence, featured projects, all projects,
      attestations, achievements, contribution highlights
- [ ] Ordering and featuring controlled by the student
- [ ] Per-item visibility, honouring the underlying project's visibility (a private project is
      never listed, even by its own author's portfolio)
- [ ] A group portfolio at `/groups/[id]/portfolio` for a team's collective work
- [ ] Shareable link with a generated OG image

### PDF export
- [ ] `@react-pdf/renderer`, server-side only
- [ ] **Portfolio PDF** — clean, ATS-readable, single column, real text (never an image of text),
      with tier badges that survive greyscale printing and a QR to the online profile
- [ ] **Project report PDF** — full record, all sections, team, references, citation ID, QR to the
      archive page. This is the artefact many colleges still require on paper, and generating it
      automatically is a concrete, immediately understood win.
- [ ] Both generated in under three seconds
- [ ] Consistent with the design system: same fonts, same tokens, same logo

## Acceptance criteria

1. A completed project is published, appears at a stable public URL, and is in the sitemap within
   seconds of publication.
2. The citation ID resolves at `/archive/[id]` and the citation block copies correctly in all four
   formats.
3. The seeded three-level lineage renders as a readable tree, and the text fallback carries the
   same information.
4. A cycle cannot be created — attempting one is refused at write time.
5. An attestation's `/verify/[code]` page shows the attesting faculty member, and a revoked
   attestation shows as revoked rather than 404.
6. A recruiter can filter explore to attested-only and gets a correct result set.
7. The portfolio PDF generates in under three seconds, is selectable text, and its tier badges are
   distinguishable when printed in greyscale.
8. A private project never appears in any portfolio, archive listing or sitemap.
9. An archived project cannot be edited through any route.
10. The public project page passes the Rich Results Test and renders with JavaScript disabled.

## Key files this phase creates

```
src/app/(public)/projects/[slug]/page.tsx     Wired to real data — the highest-value template
src/app/(public)/projects/[slug]/lineage/     SVG lineage tree
src/app/(public)/archive/[citationId]/
src/app/(public)/verify/[code]/
src/app/(public)/p/[username]/projects/
src/lib/archive/{citation,archive}.ts
src/lib/lineage/{create,tree}.ts
src/lib/pdf/{portfolio,report}.tsx            Server-only PDF generation
src/components/project/LineageTree.tsx        SVG, pan/zoom, keyboard, text fallback
```

## Notes & risks

- **The citation ID must be permanent and must never be recomputed.** It goes on printed reports and
  into other people's references. Assign once, store, never derive it again from mutable fields.
- **Build On is the compounding mechanism and it is the hardest thing here to get people to use.**
  Surface it prominently on every completed project, and make the parent's credit visible and
  flattering — the incentive to allow it has to be there for the original team too.
- **Do not copy the parent's content into the child.** It defeats the similarity check, muddies
  authorship, and produces plagiarism-shaped data. Reference, never copy.
- **The lineage tree needs a text fallback.** An SVG graph is inaccessible to a screen reader
  without one, and a text list of parents and children is genuinely as useful for most purposes.
- **PDFs must contain real text.** An image-based PDF is invisible to an ATS, which defeats the
  entire purpose of the portfolio export. Test by selecting text in the output.
- Tier badges must survive greyscale. People print these. Desaturate a screenshot and check.
- `revalidatePath` on publish is what makes a new project crawlable immediately rather than at the
  next ISR interval. It is a one-line call that is easy to forget and expensive to notice.
- **This is the MVP boundary.** Before starting Phase 13, run the full end-to-end story once:
  register → join a class → form a group → run the workspace → build the project → get reviewed and
  attested → publish → archive → export the portfolio. If any step is awkward, fix it now. Phase 13
  onward assumes this path is solid.

---

## Phase Summary

*Fill this in when the phase is complete.*

**What was built.**

**Key decisions made.**

**The end-to-end MVP walkthrough — what worked, what needed fixing.**

**Deviations from the spec above, and why.**

**Anything the next phase must know.**

**Verified by.**

| Check | Result |
| --- | --- |
| | |
