import { collegeFaqs, companyFaqs, facultyFaqs, studentFaqs } from "@/content/faqs";
import type { Faq } from "@/content/types";

/**
 * The five audience landing pages.
 *
 * Each is written to that audience's **actual pain**, in their language, rather
 * than restating the feature list five times. The faculty page in particular is
 * the one that matters commercially — faculty are the adoption channel
 * (ADR-013), so their page leads with the thing they feel weekly.
 */

export type Audience = {
  slug: string;
  nav: string;
  eyebrow: string;
  title: string;
  lead: string;
  /** The problem, in their words. Three items, specific. */
  pains: { title: string; body: string }[];
  /** What the product does about each. */
  gains: { title: string; body: string }[];
  /** The single sentence that lands. */
  pitch: string;
  faqs: Faq[];
  cta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
};

export const audiences: Audience[] = [
  {
    slug: "for-students",
    nav: "For students",
    eyebrow: "For students",
    title: "Four years of real work, and something to show for it",
    lead: "You will build a dozen projects before you graduate. Most of them will disappear into a shared drive and a printed report nobody reads again. Nexivora is where they stop disappearing.",
    pains: [
      {
        title: "Your work vanishes at submission",
        body: "The project you spent five months on exists as a PDF on a hard drive. You cannot link to it, an employer cannot verify it, and next year nobody knows it happened.",
      },
      {
        title: "You cannot prove what you did",
        body: "In a group of five, everyone's résumé says the same thing. There is no record of who built the model, who did the field testing, and who did neither.",
      },
      {
        title: "Finding a team is a broadcast message",
        body: "You post in a WhatsApp group and hope. The person with exactly the skill you need is two departments away and never sees it.",
      },
    ],
    gains: [
      {
        title: "A permanent, citable record",
        body: "A published project gets a stable public page and a citation ID that never changes. It is something you can put in an application and someone else can actually open.",
      },
      {
        title: "Contribution backed by evidence",
        body: "The workspace records what you actually did — tasks closed, files contributed, milestones owned — and a faculty member can attest it by name. A claim becomes a fact.",
      },
      {
        title: "Teammates found by skill, with reasons",
        body: "Post an idea with the skills you need and get ranked suggestions, each with a stated reason. No black box, no AI you have to trust.",
      },
    ],
    pitch:
      "Everything you build gets recorded while you build it, so at the end you have a portfolio rather than a memory.",
    faqs: studentFaqs,
    cta: { label: "Explore student projects", href: "/explore" },
    secondaryCta: { label: "Browse project ideas", href: "/ideas" },
  },

  {
    slug: "for-faculty",
    nav: "For faculty",
    eyebrow: "For faculty",
    title: "See what every group is actually doing, without asking",
    lead: "You supervise a dozen groups. You find out a project is in trouble at the review, which is the point at which nothing can be done about it. That is the problem this was built around.",
    pains: [
      {
        title: "You are blind until submission",
        body: "Progress is whatever the group tells you in a corridor. By the time a problem is visible in the work, the semester is over.",
      },
      {
        title: "You cannot fairly differentiate marks",
        body: "You know one member did most of it. You have no evidence, so you give the group grade you can defend rather than the individual grades you believe.",
      },
      {
        title: "Reconstructing the work costs you weeks",
        body: "Every accreditation cycle you rebuild project evidence from email attachments and printed reports, for work you supervised and already know.",
      },
    ],
    gains: [
      {
        title: "A dashboard that surfaces what needs you",
        body: "Submissions waiting, proposals to approve, and at-risk groups — ranked, with the evidence attached. Open it on a Tuesday and know where to spend the next hour.",
      },
      {
        title: "The contribution ledger, beside the mark",
        body: "Per-member scoring sits next to an automatic record of who did what. Differentiating a mark becomes an evidence-backed decision rather than one you have to defend from memory.",
      },
      {
        title: "Evidence that compiles itself",
        body: "Rubric evaluations, attestations and project records accumulate as you work. The accreditation export is a button, not a committee.",
      },
    ],
    pitch:
      "You will be able to see what every group is actually doing, and who in each group is actually doing it, without having to ask.",
    faqs: facultyFaqs,
    cta: { label: "See how evaluation works", href: "/features/contribution-ledger" },
    secondaryCta: { label: "Read the faculty guide", href: "/help/reviewing-and-attesting-work" },
  },

  {
    slug: "for-colleges",
    nav: "For colleges",
    eyebrow: "For institutions",
    title: "Your students already produce this data. You are throwing it away.",
    lead: "Every year your departments produce hundreds of projects. Almost none of it survives in a form you can search, cite, or submit to an assessor. That is not a documentation problem — it is a missing system of record.",
    pains: [
      {
        title: "Accreditation is an archaeology exercise",
        body: "Every NAAC or NBA cycle, a faculty committee reconstructs project evidence from attachments and printed reports. It takes weeks of your most expensive people's time.",
      },
      {
        title: "No institutional memory",
        body: "Ask a department for its best project from four years ago. The honest answer usually involves a hard drive and a former colleague. Each batch starts from zero.",
      },
      {
        title: "No visibility into what is happening now",
        body: "You know how many projects were registered. You do not know how many are progressing, how many are stalled, or which departments are producing work worth showing anyone.",
      },
    ],
    gains: [
      {
        title: "Accreditation evidence, exported",
        body: "NAAC criteria mapping, NBA project and outcome evidence, NIRF data points and AICTE activity summaries — generated from data the platform already holds, with every figure traceable to a named query.",
      },
      {
        title: "An archive that compounds",
        body: "Completed projects become permanent, searchable and citable, and a new group can formally build on one. Your fourth-year work gets measurably better over time instead of resetting.",
      },
      {
        title: "SDG and impact reporting at project level",
        body: "Honest, specific SDG tagging per project, aggregated into a report you can actually defend rather than a claim you have to justify.",
      },
    ],
    pitch:
      "One department, one semester, free. If faculty are not opening the dashboard by week six, it has not worked and you should stop.",
    faqs: collegeFaqs,
    cta: { label: "See pricing and the pilot", href: "/pricing" },
    secondaryCta: {
      label: "Why archives matter",
      href: "/knowledge/keeping-a-project-archive-your-college-can-use",
    },
  },

  {
    slug: "for-companies",
    nav: "For companies",
    eyebrow: "For companies",
    title: "Hire on evidence, not on a résumé bullet",
    lead: "Every candidate says they built a machine learning system. Here you can read the problem statement, the methodology, the results, and see which faculty member attested which contribution.",
    pains: [
      {
        title: "Résumés are unverifiable claims",
        body: "A line saying 'built an ML pipeline' tells you nothing about whether the evaluation was sound or whether that person wrote it.",
      },
      {
        title: "Campus hiring is a filter on marks",
        body: "Aggregate percentage is a poor predictor of whether someone can do the work, and it systematically overlooks students who are strong at building things.",
      },
      {
        title: "You cannot see individual contribution",
        body: "A group project on a résumé is five identical résumés. There is no way to tell who did the hard part.",
      },
    ],
    gains: [
      {
        title: "Read the actual work",
        body: "Full project records — problem, methodology, results, limitations — with the team and their declared roles.",
      },
      {
        title: "Filter to faculty-attested only",
        body: "A named faculty member vouched for that specific contribution. It is the strongest signal available short of interviewing.",
      },
      {
        title: "Post to students who match the work",
        body: "Opportunities reach students whose published project work fits, rather than everyone with a matching keyword.",
      },
    ],
    pitch:
      "You see what a candidate actually built, and who says so. Verification before posting is required, and students control whether you can contact them.",
    faqs: companyFaqs,
    cta: { label: "Browse opportunities", href: "/opportunities" },
    secondaryCta: { label: "Explore student work", href: "/explore" },
  },

  {
    slug: "for-alumni",
    nav: "For alumni",
    eyebrow: "For alumni",
    title: "Mentor the specific thing you wish someone had told you",
    lead: "You remember the month you lost to a problem someone could have solved in ten minutes. Alumni mentorship on Nexivora is scoped to exactly that: a specific goal, a small number of sessions, and a project you can actually see.",
    pains: [
      {
        title: "Open-ended mentoring goes nowhere",
        body: "'Be my mentor' produces a first conversation and then silence, for both sides. Nobody knows what success looks like.",
      },
      {
        title: "You cannot see what they are working on",
        body: "Helping requires context, and reconstructing a student's project over a call spends the whole call.",
      },
      {
        title: "Your own work disappeared too",
        body: "The projects you built as a student are gone. There is nothing to point a current student at and say: start here, this is what I learned.",
      },
    ],
    gains: [
      {
        title: "Requests with a stated goal",
        body: "A mentorship request must state a specific goal. Vague asks do not reach you, and the ones that do can actually be answered.",
      },
      {
        title: "Full project context before you start",
        body: "You can read the project record — problem, approach, where they are stuck — before the first session.",
      },
      {
        title: "Capacity limits that protect you",
        body: "The most willing mentors get buried first. You set how many mentees you can take, and the platform respects it.",
      },
    ],
    pitch: "Scoped, specific, and time-limited — mentorship that finishes rather than fades.",
    faqs: [
      {
        question: "How much time does this actually take?",
        answer:
          "Most mentorships run three to five sessions over a semester, typically 45 minutes each. You set your capacity and the platform will not exceed it.",
      },
      {
        question: "Do I need to be at the same college?",
        answer:
          "No. Same-college is a weighting in the matching, not a requirement. Domain overlap matters more.",
      },
      {
        question: "Can I still access my own old projects?",
        answer:
          "If they were published on Nexivora, permanently. Graduating changes your role and ends workspace access to current groups; your authorship and portfolio never change.",
      },
    ],
    cta: { label: "See student projects", href: "/explore" },
    secondaryCta: { label: "How the ledger works", href: "/features/contribution-ledger" },
  },
];

export const audienceBySlug = Object.fromEntries(audiences.map((a) => [a.slug, a])) as Record<
  string,
  Audience
>;
