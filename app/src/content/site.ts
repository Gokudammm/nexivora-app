import type { ChangelogEntry, HelpArticle } from "@/content/types";

/**
 * Help centre and changelog.
 *
 * The changelog is honest about where the product actually is. A public
 * roadmap and an accurate changelog build more credibility with academic users
 * than a polished feature list does — and claiming shipped features that do not
 * exist is the fastest way to lose a pilot.
 */

export const helpArticles: HelpArticle[] = [
  {
    slug: "creating-your-first-group",
    title: "Creating your first group",
    description:
      "How to start a group workspace, invite your team, and set it up so the contribution ledger works from day one.",
    audience: "student",
    body: `A group is created inside a class, so your faculty member can see it. You need to be enrolled in the class first — if you are not, ask your college administrator rather than creating a group elsewhere.

## Steps

1. Open **Groups** and choose **New group**.
2. Pick the class this project belongs to.
3. Name the group after the project, not after yourselves. "Smart irrigation" is findable later; "Team Alpha" is not.
4. Set the join policy: open, request, or invite-only. Most groups want request.
5. Invite members by username or college email.

## Set it up properly in week one

The ledger records what happens in the workspace, so anything done outside it is invisible. Two habits make the difference:

- **Create tasks before you do the work**, not after. A task closed the same minute it was created records nothing useful.
- **Assign an owner per milestone.** Shared ownership of everything means nobody owns anything, and it is where contribution quietly disappears.`,
  },
  {
    slug: "understanding-the-contribution-ledger",
    title: "Understanding the contribution ledger",
    description:
      "What the ledger records, who can see it, and why it is visible to the whole group rather than only to faculty.",
    audience: "everyone",
    body: `The ledger is an automatic record of who did what inside a group workspace. It is written at the same moment as the work itself, so it cannot drift from what actually happened.

## What it records

- Tasks closed
- Files added and revised
- Discussion threads started and answered
- Meetings attended
- Milestones owned
- Linked commits, if the group connects a repository

Each event carries a weight, and the weights are configuration rather than something hard-coded — they are tuned against real usage.

## Who can see it

**Everyone in the group, and the supervising faculty member.** This is deliberate.

A ledger visible only to faculty would be surveillance, and students would be right to resent it. A ledger visible to the group changes behaviour *during* the project, which is the only outcome that actually helps anyone. A member who can see in week three that they have contributed little usually corrects it without anyone escalating.

## What it is not

It is not a score, and it is not a grade. It is evidence a faculty member can use when marks legitimately differ between members. A member who did the hardest thinking may have fewer events than one who closed many small tasks, and that is exactly why a human makes the judgement.`,
  },
  {
    slug: "project-visibility-and-embargo",
    title: "Project visibility and embargo",
    description:
      "The five visibility levels and what each one exposes, plus how an embargo protects patentable work without hiding that it exists at all.",
    audience: "everyone",
    body: `Every project has a visibility setting. It defaults to the most private option and only moves outward deliberately.

| Level | Who can read it |
| --- | --- |
| Private | The group only |
| Group | The group and the supervising faculty |
| Class | Everyone in the class |
| College | Anyone at your college |
| Public | Anyone, and search engines |

Moving to **Public** requires your faculty supervisor to approve publication. It is not a switch a group can flip alone.

## Embargo

An embargo lists the project — title, team, abstract and citation ID — while withholding the sections, files and results until a date you set.

This exists for a real reason: a patentable project cannot be publicly disclosed before a filing, but the team still needs to prove the work exists and to cite it. An embargo lets the work be **cited without being disclosed**.

## What is never public

A private project is excluded from search engines and from the sitemap, not merely hidden in the interface. Nothing from a college that has not completed verification is publicly visible at all.`,
  },
  {
    slug: "publishing-and-citing-a-project",
    title: "Publishing and citing a project",
    description:
      "What happens when a project is published, what a citation ID is, how the permanent archive works, and how to build on someone else's project.",
    audience: "student",
    body: `When a completed project is published it gets a permanent public page and a **citation ID** — for example \`NXV-NITP-2026-2P9WL4\`.

## The citation ID

It is assigned once, at archive time, and never changes. It resolves at a stable address even if the project's title or URL slug is later corrected, which is why it is what you put in a printed report or a reference list.

## What publishing means

- The project page becomes publicly readable and search-indexable
- It appears in your portfolio and in your college's archive
- Other groups can formally **build on** it, which records a lineage link
- The record becomes read-only — corrections are appended as an erratum rather than edited in

That last point matters. An archived project is permanent. Check the results section before you publish.

## Building on someone else's project

Use **Build on this project** from any project you can read. You state what you are extending and why; the original team's faculty member is notified; and the lineage is recorded on both pages.

The parent project's content is never copied into yours. You reference it, which is how research works and what keeps authorship clean.`,
  },
  {
    slug: "reviewing-and-attesting-work",
    title: "Reviewing and attesting student work",
    description:
      "How rubric evaluation works, how per-member marks are supported by ledger evidence, and what it means to attest a student's contribution.",
    audience: "faculty",
    body: `## Reviewing a submission

The review screen puts the project record on the left and the rubric on the right. Score each criterion against its descriptor; the total is computed as you go.

Below the group score is a per-member section, **with the contribution ledger displayed alongside**. That placement is the point: differentiating a mark should be a two-second evidence-backed decision, not a judgement you have to reconstruct and defend later.

A per-member adjustment requires a stated reason. Requesting changes requires specifics — "needs improvement" as an outcome helps nobody.

## Attestation

An attestation is you, by name, vouching for something specific:

- A **project outcome** — "this group built and demonstrated a working prototype"
- An **individual contribution** — "Ananya designed and implemented the classification model"

It is pre-filled from the ledger and then edited by you. **It is never issued automatically**, because its entire value is that a named human signed it.

Attested claims render distinctly wherever they appear, name you as the attester, and flow into the student's skill profile. They are revocable, and a revocation preserves the record with your reason rather than deleting it.`,
  },
  {
    slug: "setting-up-your-college",
    title: "Setting up your college",
    description:
      "Departments, programmes, subjects, terms, classes and the student roster — in the order that works, and why the CSV dry run matters most.",
    audience: "admin",
    body: `Set up in this order. Each step depends on the one before it.

1. **College profile** — name, code, and your institutional email domains. The domains matter: a registrant on one of them is auto-associated with your college.
2. **Departments** and **programmes**.
3. **Terms** — the academic session. Exactly one is active at a time. This is a real record rather than a text field, because every analytic and every accreditation report rolls up to it.
4. **Subjects**, linked to a programme and semester.
5. **Classes** — a subject in a term, with a section.
6. **Faculty**, assigned to classes.
7. **Students**, imported by CSV.

## About the CSV import

Always run the **dry run** first. It shows exactly what will be created, updated and skipped, with per-row errors, and writes nothing.

Real exports are messy — a byte-order mark from Excel, non-breaking spaces, \`Roll No.\` versus \`RollNo\`, smart quotes, trailing blank rows. The import handles these, and the preview is where you confirm it handled yours correctly. A bulk import that silently creates 500 wrong records is unrecoverable without a restore.

## Verification

Request verification once the college profile is complete. Until it is granted, your college works normally internally — but nothing from it is publicly indexable and it does not appear in inter-college surfaces. That gate is what makes the network's trust meaningful.`,
  },
  {
    slug: "privacy-and-your-data",
    title: "Privacy and your data",
    description:
      "What is public by default (nothing at all), what we collect, what we deliberately do not collect, and how to export or delete your own data.",
    audience: "everyone",
    body: `## Nothing is public by default

Your profile, your projects and your activity all start private. Every step outward is a deliberate choice, and each is separately revocable:

- Public profile
- Discoverable in search
- Contactable by companies
- Appearing in the college directory
- Email digests

## What we do not collect

We do not ask for date of birth, address, caste, religion, income or identity numbers. Nothing in the product needs them, so nothing asks.

## Export

**Settings → Data** produces everything we hold about you as JSON, plus your files, on demand.

## Deletion

Deletion is genuinely more complicated than a single switch, and the deletion screen states this plainly before you confirm:

- **Content you alone wrote** — posts, comments, ideas, your own files — is deleted.
- **Shared content** — project sections, group files, tasks — is retained with your name replaced by "Former member". Deleting it would destroy your group-mates' records and break the lineage other projects depend on.
- **Your identity** — account, email, profile, skills, avatar — is deleted.
- **Academic assessment records** are retained under a pseudonymous id, because your institution has a lawful basis to keep them.

Promising total erasure and not delivering it would be worse than explaining the limit.`,
  },
  {
    slug: "finding-a-team",
    title: "Finding a team for your idea",
    description:
      "How teammate suggestions are computed, why every one shows its reasoning rather than a score, and how collaboration requests work in practice.",
    audience: "student",
    body: `Post your idea to the Idea Hub with the skills you need, then use teammate suggestions.

## How suggestions are computed

Deterministically, from:

- **Skill complement** — do they have skills your team lacks (weighted highest)
- **Skill overlap** — enough shared context to collaborate
- **Domain interest** alignment
- **Availability** — declared, and open slots
- **Same class or department** — a proximity bonus, not a requirement
- **Past collaboration**

**Every suggestion shows its reasoning**: *"Priya matches 4 of the 5 skills you need, has built 2 IoT projects, is in your department, and has capacity this term."*

That explanation is the feature. A ranked list with no reasoning is a black box a faculty member cannot endorse and a student will not trust — and it is why this stays arithmetic rather than becoming a model.

## Sending a request

State the goal. "Be on my team" gets ignored; "I need someone who has calibrated a sensor before, for a two-month deployment" gets answered.

Requests are rate-limited so the feature cannot become a broadcast channel, and they expire after 14 days.

## Privacy

Someone who has turned off discoverability never appears in suggestions. That is not a bug.`,
  },
];

export const helpBySlug = Object.fromEntries(helpArticles.map((h) => [h.slug, h])) as Record<
  string,
  HelpArticle
>;

/* ------------------------------------------------------------- changelog */

export const changelog: ChangelogEntry[] = [
  {
    date: "2026-09-09",
    version: "0.2.0",
    title: "Public site and SEO engine",
    items: [
      {
        kind: "added",
        text: "The full public surface: explore, project pages, topic and SDG hubs, the Idea Hub, colleges, profiles, knowledge hub and opportunities.",
      },
      {
        kind: "added",
        text: "Segmented sitemaps, robots rules, and typed structured data across every public template.",
      },
      {
        kind: "added",
        text: "Generated OG images for every page type, built from the same SVG language as the brand.",
      },
      {
        kind: "added",
        text: "The complete legal set, including a named grievance officer and a DPDP-aligned privacy policy.",
      },
      {
        kind: "changed",
        text: "Content now comes from typed fixtures, which become the contract the database schema must satisfy.",
      },
    ],
  },
  {
    date: "2026-09-08",
    version: "0.1.0",
    title: "Design system and brand",
    items: [
      {
        kind: "added",
        text: "The Nexivora logo, favicon and PWA icon set, all generated from one geometry.",
      },
      {
        kind: "added",
        text: "Around 35 UI primitives, 60 inline SVG icons, 8 illustrations, and generated avatars and project covers.",
      },
      {
        kind: "added",
        text: "A contrast audit wired into the build that fails on any pair below WCAG AA, in both themes.",
      },
      {
        kind: "fixed",
        text: "Three token pairs that looked fine and measured below AA — white on accent and highlight fills, and the amber fill's own edge.",
      },
      {
        kind: "changed",
        text: "Type scale and vertical rhythm tightened after measuring rendered output at four viewport widths.",
      },
    ],
  },
];
