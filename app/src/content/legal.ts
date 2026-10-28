import { siteConfig } from "@/config/site";
import type { LegalDocument } from "@/content/types";

/**
 * The legal and trust set.
 *
 * **These must describe what the code actually does.** A privacy policy that
 * drifts from the schema is only ever discovered by someone who is already
 * unhappy, and Phase 16 has an explicit deliverable to read this against the
 * real schema line by line.
 *
 * Every document opens with a plain-language summary, because a policy nobody
 * reads protects nobody.
 *
 * These are drafted for a product that is not yet operating commercially. Before
 * a real institution signs, they need review by a qualified lawyer — that is
 * stated openly rather than implied.
 */

const UPDATED = "2026-09-09";

export const legalDocuments: LegalDocument[] = [
  {
    slug: "privacy",
    title: "Privacy policy",
    description:
      "What data Nexivora collects, why, who can see it, and how to export or delete it. Written to be accurate rather than comprehensive.",
    updatedOn: UPDATED,
    summary:
      "Nothing about you is public unless you choose it. We do not collect date of birth, address, caste, religion, income or identity numbers. We do not sell data and we do not run ads. You can export everything we hold at any time, and delete your account — with one honest limitation about shared work, explained below.",
    body: `## Who this applies to

Nexivora is operated in India and this policy is written against the **Digital Personal Data Protection Act, 2023**. If you are a student, faculty member, alumnus, company user or researcher with an account, this applies to you.

## What we collect

**When you register:** name, email address, and the role and institution you are joining as.

**When you use the product:** your profile as you complete it, the projects and groups you belong to, the tasks you close and files you contribute, your posts and comments, and technical logs needed to operate the service securely.

**We deliberately do not collect** date of birth, postal address, caste, religion, income, government identity numbers, or biometric data. Nothing in the product needs them.

## Why we collect it

| Purpose | Data used |
| --- | --- |
| Operating your account | Identity and authentication data |
| Recording project work and contribution | Workspace activity within your groups |
| Academic evaluation by your institution | Project records, submissions, evaluations |
| Accreditation reporting by your institution | Aggregated project and activity data |
| Security and abuse prevention | Access logs, IP address, moderation records |

## What is public

**Nothing, by default.** Each of these is a separate opt-in, off until you turn it on, and revocable in one click:

- A public profile at your chosen username
- Being discoverable in search
- Being contactable by verified companies
- Appearing in your college's directory
- Email digests

A project becomes public only when your group requests it **and** a faculty member approves it. Nothing from an institution that has not completed verification is publicly visible at all.

## Who can see your data

- **Your group** sees your workspace activity, including the contribution ledger.
- **Your supervising faculty** see your group's workspace, read-only, and your evaluations.
- **Your college administrators** see institution-level records and aggregate reporting.
- **Other institutions cannot see your data.** Isolation is enforced in the query layer, not only in the interface, and is tested.
- **Peer reviews you write are never shown to the person you reviewed** — only the aggregate is, and only faculty see the detail.

## Your rights

- **Access** — export everything we hold, on demand, at Settings → Data.
- **Correction** — every profile field is editable.
- **Erasure** — see the honest limits below.
- **Withdraw consent** — every optional setting is revocable.
- **Grievance** — contact our named officer at [/legal/grievance](/legal/grievance).

## Deletion, honestly

Your project work is a **shared** record. It belongs to a group, was evaluated by a faculty member, and may be cited by a later project. So deletion is not one action:

- **Content you alone authored** — posts, comments, ideas, your own uploads — is **deleted**.
- **Shared content** — project sections, group files, tasks — is **retained**, with your name replaced by "Former member". Deleting it would destroy other people's records and break lineage that other projects depend on.
- **Your identity** — account, email, profile, skills, avatar — is **deleted**.
- **Academic assessment records** are **retained under a pseudonymous identifier**, because your institution has a lawful basis to keep records of academic assessment.

You see all of this on the deletion screen before you confirm. There is a seven-day grace period during which you can cancel.

## Retention

Active accounts are retained while in use. Deleted accounts are processed as above within 30 days. Access logs are retained for 12 months for security purposes. Audit records of administrative and evaluative actions are retained by your institution.

## Children

You must be 16 or older to register. Under-18 accounts are created only through a verified institution's roster, never by self-registration.

## Changes

Material changes are notified in the product and by email at least 14 days before they take effect.

## Contact

Privacy questions: ${siteConfig.contact.privacy}`,
  },

  {
    slug: "terms",
    title: "Terms of use",
    description:
      "The agreement between you and Nexivora — what you may do, what we provide, and what happens if things go wrong.",
    updatedOn: UPDATED,
    summary:
      "Use Nexivora for genuine academic work. Do not misrepresent who you are or what you did. You keep ownership of what you create. We provide the service as it is, and we will tell you honestly when something is not working.",
    body: `## Your account

You must give accurate information when registering, and you must not create an account claiming to be at an institution you do not belong to. Institutional email verification exists for this reason.

You are responsible for activity under your account. Tell us promptly if you believe it has been accessed by someone else.

## Acceptable use

You may not:

- Misrepresent your contribution to a project, or claim work you did not do
- Upload content you do not have the right to share
- Attempt to access another institution's, group's or user's data
- Post fraudulent opportunities, or solicit payment from students for an opportunity
- Scrape the platform, or use automated access outside a documented interface
- Harass, impersonate or target another user

Academic misrepresentation is treated seriously and is covered separately in the [academic integrity policy](/legal/academic-integrity).

## Content ownership

**You own what you create.** By publishing you grant Nexivora a licence to host and display it as your visibility settings direct, and you grant your institution a licence to use it for evaluation and accreditation reporting. Details in the [IP policy](/legal/ip-policy).

## Institutional accounts

Where your account is created through an institution, that institution administers it: they can assign roles, suspend access and see institution-level records. Your authorship of your own work is not affected by any of that, including after you graduate.

## Availability

We aim for reliable service and do not guarantee uninterrupted availability. Planned maintenance is announced in advance where practical.

## Termination

You may delete your account at any time. We may suspend an account that breaches these terms, with a stated reason, and you may appeal to the grievance officer.

## Liability

The service is provided as-is. To the extent permitted by law we are not liable for indirect or consequential loss. Nothing here limits liability that cannot be limited by law.

## Governing law

These terms are governed by the laws of India, with jurisdiction in the courts of Pune, Maharashtra.

## A note on these terms

Nexivora is not yet operating commercially. These terms are drafted in good faith and will be reviewed by a qualified lawyer before any institution signs an agreement. We would rather say that than imply a review that has not happened.`,
  },

  {
    slug: "community-guidelines",
    title: "Community guidelines",
    description:
      "What good participation looks like on an academic network, what is not acceptable, and how reporting and moderation actually work here.",
    updatedOn: UPDATED,
    summary:
      "This is a professional academic space. Be accurate about your work, be constructive about other people's, and credit what you build on.",
    body: `## What this space is for

Academic work: projects, research, ideas, questions and the resources that support them. Every post is anchored to one of those, which is a deliberate design decision rather than a restriction — it is what keeps this from becoming a status-update feed.

## Be accurate

- Describe your contribution as it was. Overstating it is the one thing that damages trust here fastest.
- Report results with their conditions and limitations. A qualified result is more credible than an unqualified one.
- Credit prior work. If you built on someone's project, record the lineage — it costs you nothing and it is how the archive compounds.

## Be constructive

Feedback on someone's project should be specific and actionable. "This is wrong" helps nobody; "your validation split looks like it leaks future data into training" helps a great deal.

Disagree with the work, not the person.

## Not acceptable

- Harassment, threats or targeting an individual
- Impersonating another person or institution
- Claiming contribution you did not make
- Plagiarised or fabricated content, including fabricated results
- Fraudulent opportunities, or any request for payment from a student for an opportunity
- Spam, or automated posting at scale
- Sharing another person's private information

## Reporting

Every user-generated surface has a report action. Reports go to the queue with the appropriate scope — faculty for their subjects, college administrators for their institution, platform administrators for everything.

Every moderation action is recorded with an actor and a reason.

## Consequences

Depending on severity: a warning, content hidden or removed, suspension, or account termination. Academic misrepresentation is additionally referred to your institution, because it is their matter as much as ours.

You may appeal any action to the [grievance officer](/legal/grievance).`,
  },

  {
    slug: "academic-integrity",
    title: "Academic integrity policy",
    description:
      "How Nexivora handles duplicate work, contribution claims, AI assistance and attribution — and why we will never automate academic grading.",
    updatedOn: UPDATED,
    summary:
      "Your institution sets academic standards; we provide the record that makes them checkable. Similarity to previous work is flagged for a human to judge, never blocked automatically. AI may assist drafting; it may never be published unattended.",
    body: `## Our role

We do not set academic standards — your institution does. What we provide is a record that makes those standards checkable: what was done, when, and by whom.

## Similarity checking

When a project proposal is submitted it is checked against your college's archive and against public projects. The result shows the closest matches with a score and the reason for each.

**A similarity flag is not an accusation and does not block anything.** A project that formally builds on previous work *should* look similar — that is the point of building on it. The flag informs a faculty decision; it never makes one. A faculty member can override any flag, and the override is recorded with their justification.

We check against the archive and public projects. We do not check against the open web — that is a different service with a different cost, and claiming otherwise would be misleading.

## Contribution claims

Contribution is recorded at three tiers:

1. **Self-claimed** — you said so.
2. **Workspace-evidenced** — derived from what you actually did in the workspace: tasks closed, files contributed, milestones owned.
3. **Faculty-attested** — a named faculty member vouched for it.

Claiming a contribution the workspace record contradicts is a breach of these terms and is referred to your institution.

## Peer review

Peer reviews are one-directionally private: the person reviewed sees only the aggregate, never who said what. Faculty see the detail. This is what makes honest review possible.

Deliberately dishonest peer review — colluding on ratings, or retaliating — is a breach.

## AI assistance

AI features may **draft**. They may never **publish**.

Anything generated is presented as a draft in an editor that a human must review and accept. Nothing AI-generated is published unattended, and AI-generated content is labelled where it appears.

This is not only a policy position. Auto-publishing generated text at scale is prohibited by search engine spam policies, and it would put the archive's credibility at risk.

**We do not use AI to grade.** No AI-scored rubrics, no AI-written feedback issued under a faculty member's name. An academic assessment must be made and owned by a named human. This is an absolute line.

## Attribution

Every published project carries its authors, their declared roles, their proof tier, and its supervising faculty member. Archived projects get a permanent citation ID and a copyable citation block, so citing prior work correctly is the path of least resistance.`,
  },

  {
    slug: "ip-policy",
    title: "Intellectual property policy",
    description:
      "Who owns student project work, what licence the institution receives, and how an embargo protects patentable work while keeping it citable.",
    updatedOn: UPDATED,
    summary:
      "Students own their work. The institution gets a licence to use it for evaluation and accreditation. Patentable work can be embargoed — listed and citable, but not disclosed — until a filing is made.",
    body: `## Ownership

**Students own the work they create.** Publishing on Nexivora does not transfer ownership, and neither does the institution's use of it for evaluation.

Where your institution's own regulations assign ownership differently — which some do, particularly for funded or sponsored work — those regulations apply, and the institution is responsible for making them known to you. We are the record, not the arbiter.

## Licences granted

By publishing, you grant:

- **Nexivora** a non-exclusive licence to host and display the work according to your visibility settings, and to keep it in the archive.
- **Your institution** a non-exclusive licence to use the work for academic evaluation and for accreditation and regulatory reporting.

Both are limited to those purposes. Neither permits commercial exploitation of your work.

## Group work

Group projects are jointly owned by their contributing members. Publishing a group project requires the group lead to request it and a faculty member to approve it.

If a member later deletes their account, the shared work is retained with their name replaced — deleting it would remove their group-mates' record of their own work.

## Embargo

A patentable project cannot be publicly disclosed before a filing, but the team still needs to prove the work exists and be able to cite it.

An embargoed project shows its **title, team, abstract and citation ID**, and withholds its sections, files and results until the date you set. It can be **cited without being disclosed**.

Set an embargo before you publish, and talk to your institution's IP cell first — a disclosure cannot be undone.

## Third-party content

You are responsible for having the right to publish what you upload. Use of third-party code, datasets or media must comply with its licence and be credited.

## Takedown

If you believe content on Nexivora infringes your rights, contact the [grievance officer](/legal/grievance) with the specifics. We will respond within the statutory period.`,
  },

  {
    slug: "accessibility",
    title: "Accessibility statement",
    description:
      "What Nexivora conforms to today, what is verified by an automated audit, and which accessibility passes have not yet been done — stated honestly.",
    updatedOn: UPDATED,
    summary:
      "We are building to WCAG 2.1 Level AA. Colour contrast is verified by an automated audit that fails our build. The screen-reader, keyboard and axe audits are scheduled and have not yet been done, so we do not currently claim conformance.",
    body: `## Our target

**WCAG 2.1 Level AA.**

## What is verified today

- **Colour contrast.** Every foreground/background pairing in the design system is measured by an automated audit against the AA thresholds, in both light and dark themes. It runs in our build and **fails the build** on any pair below the requirement. It currently passes 94 of 94 measured pairs.
- **Semantic structure.** One \`h1\` per page, headings in order, real landmarks, and a skip-to-content link as the first focusable element.
- **Focus indicators.** Never removed; a visible focus ring on every interactive element, on a colour verified against every surface.
- **Motion.** \`prefers-reduced-motion\` is honoured throughout.
- **Server-rendered content.** Every public page renders fully without JavaScript.

## What is not yet verified

We are being specific rather than reassuring:

- A full **screen-reader pass** has not been completed.
- A full **keyboard-navigation audit** has not been completed.
- An **automated axe scan** across all routes has not been run.
- **Zoom and reflow at 200%** has not been formally tested.

These are scheduled work with a defined owner, not aspirations. **Until they are done we do not claim WCAG conformance**, because a false conformance claim is worse than an honest partial one.

## Known design decisions

- The task board is drag-and-drop **and** fully operable by keyboard through an explicit "move to" menu. Drag-only would be an accessibility failure.
- Every chart has a data-table equivalent.
- Every SVG diagram has a text-list equivalent carrying the same information.
- Touch targets are 44×44 CSS pixels minimum.

## Feedback

If you encounter a barrier, please tell us at ${siteConfig.contact.support}. Include the page and what you were trying to do. We treat accessibility reports as defects, not feature requests.`,
  },

  {
    slug: "cookies",
    title: "Cookie policy",
    description:
      "The two cookies Nexivora sets, what each one does, what we store in your browser, and why you have never seen a consent banner on this site.",
    updatedOn: UPDATED,
    summary:
      "We set two cookies, both strictly necessary: one for your session and one for security. We run no advertising or analytics cookies, which is why you have not seen a consent banner.",
    body: `## What we set

| Cookie | Purpose | Duration |
| --- | --- | --- |
| Session | Keeps you signed in | 30 days, or until sign-out |
| CSRF token | Prevents cross-site request forgery | Session |

Both are **strictly necessary** to operate the service. Both are \`HttpOnly\`, \`Secure\` and \`SameSite=Lax\`.

## What we do not set

- No advertising cookies
- No third-party analytics cookies
- No cross-site tracking
- No social media pixels

This is why there is no consent banner. Strictly necessary cookies do not require consent, and we do not set any others.

## Local storage

We store two things in your browser, which never reach our servers:

- Your theme preference (light, dark or system)
- Unsent drafts, so you do not lose work on a refresh

You can clear both by clearing site data in your browser.

## If this changes

If we ever add a cookie that is not strictly necessary, we will ask for consent before setting it and update this page. We will not add one quietly.`,
  },

  {
    slug: "grievance",
    title: "Grievance officer",
    description:
      "How to raise a complaint about content, privacy or conduct on Nexivora, and who is responsible for responding.",
    updatedOn: UPDATED,
    summary:
      "A named officer is responsible for complaints, as required under Indian law. Complaints are acknowledged within 24 hours and resolved within 15 days.",
    body: `## Grievance Officer

In accordance with the **Information Technology Act, 2000** and the **Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021**, and with the **Digital Personal Data Protection Act, 2023**, the following officer is responsible for grievances:

**Name:** Ayush Chaudhary
**Designation:** Grievance Officer and Data Protection Contact
**Email:** ${siteConfig.contact.grievance}
**Address:** Pune, Maharashtra, India

## What you can raise

- Content that breaches the [community guidelines](/legal/community-guidelines)
- Misuse of your personal data, or a privacy concern
- A request to exercise your rights under the DPDP Act
- Content that infringes your intellectual property
- An appeal against a moderation decision or account suspension
- Impersonation of you or your institution

## What to include

Your name and contact details, the specific URL or account concerned, what the issue is, and — for an IP complaint — the basis of your rights.

## Timelines

| Stage | Time |
| --- | --- |
| Acknowledgement | Within 24 hours |
| Resolution | Within 15 days |
| Unlawful content removal | Within 36 hours of a valid order |

## If you are not satisfied

You may escalate to the Data Protection Board of India under the DPDP Act, or to the appropriate authority under the IT Rules. We will provide our complete record of the complaint on request.`,
  },
];

export const legalBySlug = Object.fromEntries(legalDocuments.map((d) => [d.slug, d])) as Record<
  string,
  LegalDocument
>;
