/**
 * Deep-dive copy for the three feature pages that carry the differentiators.
 *
 * These exist as separate pages rather than sections of `/features` because
 * they are the pages an evaluating institution actually reads, and because
 * "contribution ledger" and "project archive" are the queries this product
 * should own.
 */

export type FeatureDeepDive = {
  slug: string;
  eyebrow: string;
  title: string;
  lead: string;
  /** The problem, stated before the solution. */
  problem: string;
  /** Sections of the explanation. */
  sections: { heading: string; body: string }[];
  /** The design decisions worth defending, and why. */
  decisions: { title: string; body: string }[];
  keywords: string[];
  description: string;
};

export const featureDeepDives: FeatureDeepDive[] = [
  {
    slug: "workspace",
    eyebrow: "Feature",
    title: "The group workspace",
    description:
      "Tasks, versioned files, threaded discussion, meetings and deadlines in one place — private to the group, and the source of the contribution record.",
    lead: "The place the work actually happens. It is useful to five students on day one with nobody else on the platform, which is what makes adopting Nexivora possible at all.",
    problem:
      "Student project work is scattered across a WhatsApp group, someone's Drive folder, an email thread and a laptop. Nothing is connected, nothing is searchable, and at the end there is no record of how any of it happened.",
    sections: [
      {
        heading: "Tasks",
        body: "A board with assignees, due dates, priorities and labels, plus a list view as an equal alternative. Drag-and-drop for speed, and a full keyboard path through an explicit move menu — drag-only would be an accessibility failure, and the keyboard path also means the board works before any drag library loads.\n\nClosing a task writes a ledger event in the same database transaction. Not afterwards, not in a background job — together, or neither.",
      },
      {
        heading: "Files",
        body: "Versioned as separate records rather than overwritten, so a project's history is recoverable and 'who contributed this' is answerable months later.\n\nFiles are validated by magic bytes rather than file extension, stored outside the web root, and served only through an authorisation-checked route. There is no static path to a student's file.",
      },
      {
        heading: "Discussion",
        body: "Threads with a type — general, question, decision or blocker — and one level of replies. Deeper threading helps nobody.\n\nDecision threads matter more than they look: they are the record of why the group chose one approach over another, which is exactly the thing a report cannot reconstruct four months later.",
      },
      {
        heading: "Meetings",
        body: "Scheduling with an agenda, notes, attendance and action items that convert to tasks in one click.\n\n**We do not host video.** We store a join link. Hosting video is a different company, and pretending otherwise would produce a worse version of something that already works.",
      },
    ],
    decisions: [
      {
        title: "Faculty access is read-only, and visible",
        body: "A faculty member who can silently edit a group's files destroys the evidentiary value of the ledger, which is the entire feature. They can comment, set tasks and schedule meetings; they cannot rewrite the record.",
      },
      {
        title: "Every mutation is optimistic",
        body: "A task board that waits 300ms per drag feels broken, and a workspace that feels broken loses to WhatsApp on day one. Cards move at 0ms and the server reconciles.",
      },
      {
        title: "We did not build chat",
        body: "Students already have chat and it is not a battle worth fighting. Threaded discussion serves decision-making; chat can stay where it is. Saying so is more useful than half-building it.",
      },
    ],
    keywords: [
      "group workspace",
      "student project management",
      "task board",
      "academic collaboration",
    ],
  },

  {
    slug: "contribution-ledger",
    eyebrow: "The differentiator",
    title: "The contribution ledger",
    description:
      "An automatic, append-only record of who actually did what inside a group — written with the work itself, and visible to the whole group.",
    lead: "Almost every student has been in a group where one person did very little and received the same grade. It is the most universally felt problem in coursework and the least often addressed. This is the answer.",
    problem:
      "Contribution is invisible. Work happens in a chat and a shared folder, so by submission there is no record of who did what. Reporting it feels like betrayal, and by the time it is obvious it is too late for anyone to do anything.",
    sections: [
      {
        heading: "What it records",
        body: "Tasks closed, files added and revised, discussion threads started and answered, meetings attended, milestones owned, and linked commits where a group connects a repository.\n\nEach event carries a weight. The weights are configuration rather than hard-coded values, because they will need tuning against real usage and that should not require a migration.",
      },
      {
        heading: "Why it can be trusted",
        body: "Every ledger event is written **inside the same database transaction** as the action that produced it. Closing a task writes the task update and the ledger event together, or neither happens.\n\nThe ledger is append-only. There is no update path and no delete path — corrections are new compensating events, the same discipline accounting uses, for the same reason. A record that can drift from the actions that produced it is worse than no record, because it looks authoritative.",
      },
      {
        heading: "Peer review",
        body: "At each milestone close, members rate each other on contribution, reliability and communication, with a required comment.\n\n**A member sees only the aggregate about themselves, and never who said what.** Faculty see the full detail. People do not answer honestly when the person they are rating will read it tomorrow, and that asymmetry is what makes honest review possible at all.",
      },
      {
        heading: "What faculty do with it",
        body: "On the review screen, the ledger sits directly beside the per-member score inputs. Differentiating a mark becomes a two-second, evidence-backed decision rather than a judgement a faculty member has to reconstruct and defend from memory.\n\nA per-member adjustment requires a stated reason.",
      },
    ],
    decisions: [
      {
        title: "It is visible to the whole group, not only to faculty",
        body: "This is the decision that matters most. A ledger visible only to faculty is surveillance, and students would be right to resent it. A ledger visible to the group changes behaviour *during* the project — a member who can see in week three that they have contributed little usually corrects it without anyone escalating. The same information in week fourteen is only useful for allocating blame.",
      },
      {
        title: "It is not a score and not a grade",
        body: "It is evidence a human uses. A member who did the hardest thinking may have fewer events than one who closed many small tasks — which is exactly why a person makes the judgement and the ledger does not.",
      },
      {
        title: "Group health signals are shown to the group too",
        body: "A silent member, a slipped milestone, no activity in fourteen days. Faculty see them ranked by severity; so does the group. A hidden warning about a student is surveillance; a visible one is feedback.",
      },
    ],
    keywords: [
      "contribution tracking",
      "group project free riding",
      "peer review",
      "student contribution evidence",
    ],
  },

  {
    slug: "archive",
    eyebrow: "The compounding asset",
    title: "The academic archive and project lineage",
    description:
      "Completed projects get a permanent citation ID and a public page, and a future group can formally build on one — so the archive compounds.",
    lead: "Ask a department for the best project it produced four years ago. In most institutions the answer involves a hard drive, a former colleague, and eventually a shrug.",
    problem:
      "Projects die at grading. Students rebuild things earlier groups already solved, nothing compounds between batches, and every accreditation cycle becomes an archaeology exercise reconstructing evidence from email attachments.",
    sections: [
      {
        heading: "A permanent, citable record",
        body: "An archived project gets a citation ID — for example `NXV-NITP-2026-2P9WL4` — assigned once and never regenerated. It resolves at a stable address even if the project's title or URL is later corrected, which is why it is what goes into a printed report or a reference list.\n\nAn archived project is read-only. Corrections are appended as an erratum rather than edited in.",
      },
      {
        heading: "Build on",
        body: "A group can formally build on any project they can read. They state what they are extending and why, the original team's faculty member is notified, and the relationship is recorded on both pages with a kind — builds on, extends, replicates or forks.\n\nThe parent's content is **never copied** into the child. Copying would muddy authorship, defeat the similarity check, and produce plagiarism-shaped data. The child references the parent, which is how research actually works.",
      },
      {
        heading: "Lineage as a visible tree",
        body: "The chain renders as a graph, with a text-list equivalent carrying the same information for screen readers and for anyone who prefers it.\n\nA parent that is private is omitted rather than shown as a broken link — the lineage is real, but a visitor has no business learning that a private project exists.",
      },
      {
        heading: "Why this changes what a project is",
        body: "A group can start from an existing result rather than from nothing, so the semester is spent on the new part instead of rebuilding a sensing rig that already exists.\n\nThe demonstration case in our own archive is three levels deep: a soil-moisture irrigation controller, extended a year later into demand forecasting, extended again into multi-farm canal scheduling. The third project would not have been feasible in one semester without the two beneath it.",
      },
    ],
    decisions: [
      {
        title: "Publication requires two parties",
        body: "A group requests it and a faculty member approves it. Nothing is published on anyone's behalf, and nothing from an unverified college is publicly visible at all.",
      },
      {
        title: "Embargo, for patentable work",
        body: "An embargoed project shows its title, team, abstract and citation ID, and withholds everything else until a date the group sets. The work can be **cited without being disclosed**, which is the actual requirement when a patent filing is pending.",
      },
      {
        title: "'N groups have built on this' is the real metric",
        body: "Not views, not likes. The number of groups who took a project forward is the strongest available signal that it mattered, and it is the one we surface.",
      },
    ],
    keywords: [
      "project archive",
      "institutional memory",
      "project lineage",
      "citable student projects",
    ],
  },
];

export const featureBySlug = Object.fromEntries(featureDeepDives.map((f) => [f.slug, f])) as Record<
  string,
  FeatureDeepDive
>;
