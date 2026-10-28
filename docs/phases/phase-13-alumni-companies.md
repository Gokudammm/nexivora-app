# Phase 13 — Alumni & Company Network

| | |
| --- | --- |
| **Status** | ⬜ Not Started |
| **Depends on** | Phase 12 (portfolios are what companies and alumni consume) |
| **Blocks** | Phase 14 |
| **Estimate** | 9 focused hours |
| **Started** | — |
| **Completed** | — |

## What Phase 3 already provides

*Added 2026-09-09, when Phase 3 completed. Check these before building — the most common way to
waste a phase is to rebuild something the previous one shipped.*

- **Modelled and seeded**: `AlumniProfile`, `CompanyProfile`, `Opportunity`, `Application`,
  `ApplicationStageEvent`, `MentorshipRequest`, `MentorshipSession`, `Event`,
  `EventRegistration`, `CollegePartnership`.
- **Company verification is the anti-abuse gate.** An unverified company cannot post, cannot contact
  a student and is not listed. One is seeded unverified so the rule is visibly enforced. Fake
  internships charging a "certificate fee" are a real scam aimed at exactly these students.
- **`MentorshipRequest.goal` is required.** "Be my mentor" produces nothing useful for either side.
- **`Opportunity.validThrough` is constrained to be after `postedOn`** and must be honoured —
  an expired posting left in the index is a quality signal Google acts on.
- **Contactability is opt-in** and off by default in `PrivacySetting` (DPDP).

## Objective

Turn the archive into **opportunity**. Alumni return as mentors; companies discover students by
what they have actually built and what a faculty member has actually attested. This is the third
word in *Projects → People → Opportunities*, and it only works because Phases 7–12 made the first
two real.

## In scope

- Verified alumni profiles and the college relationship
- Mentorship: request, match, sessions, feedback
- Company profiles with a verification gate
- The opportunity board with `JobPosting` structured data
- Talent discovery filtered by verified work
- A simple applicant pipeline

## Out of scope

- Payments · Contracts · Interview scheduling · Video · A full ATS (this is a pipeline, not Greenhouse)

## Deliverables

### Alumni
- [ ] Alumni profile: graduation year, programme, current organisation and role, industry,
      expertise, mentorship availability and capacity
- [ ] Verification: the transition from `STUDENT` (Phase 5) is automatically verified; an external
      alumnus claims a college and is confirmed by a college admin
- [ ] Follow your college; a college feed of student work
- [ ] View and comment on public student projects, with an alumni badge on the comment
- [ ] `/colleges/[slug]/alumni` — the directory, privacy-respecting
- [ ] Alumni can post to the feed: opportunities they know of, guidance, achievements
- [ ] Guest session offers: topic, format, availability, target audience

### Mentorship
- [ ] `/mentorship` — for a student: find a mentor; for a mentor: requests and active mentees
- [ ] **Deterministic mentor matching**: domain overlap, skills sought vs. offered, same college
      (weighted, not required), industry, availability, current load. Explanation shown, exactly as
      in Phase 11.
- [ ] Request with a message and a specific goal — **a goal is required.** "Be my mentor" produces
      nothing useful for either side.
- [ ] Accept, decline with an optional reason, or propose an alternative time
- [ ] `/mentorship/[id]` — the relationship: goals, sessions, notes, resources, status
- [ ] Sessions: schedule, agenda, notes, action items that become tasks, attendance
- [ ] Completion with mutual feedback and an optional public testimonial
- [ ] Mentor capacity limits so a willing mentor is not buried
- [ ] Group mentorship — one mentor to one project team, which is the common academic case

### Companies
- [ ] Company profile: name, logo, industry, size, locations, description, focus areas, culture,
      links
- [ ] **Verification before anything is visible or actionable**: business evidence submitted →
      platform admin review → verified or rejected with a reason
- [ ] **Unverified companies cannot post, cannot contact and do not appear in search.** This is the
      anti-scam gate and it must actually work.
- [ ] `/companies/[slug]` — the public profile, `Organization` structured data
- [ ] Company follows a college; a college feed of relevant student work

### Opportunities
- [ ] `/company/opportunities` — post internships, jobs, research positions, hackathon sponsorships,
      live projects, guest sessions
- [ ] Fields: title, type, description, responsibilities, required and preferred skills,
      eligibility, location and remote status, duration, stipend or salary, application deadline,
      openings
- [ ] `/opportunities` and `/opportunities/[slug]` — public, indexable, with **complete `JobPosting`
      structured data**: title, description, datePosted, validThrough, employmentType,
      hiringOrganization, jobLocation, baseSalary, skills, educationRequirements. This makes
      listings eligible for Google's job experience, which is a real, nameable distribution
      advantage.
- [ ] Faceted search: type, domain, skills, location, remote, stipend, deadline
- [ ] Save, follow a company, alert on new matching postings
- [ ] Expired postings return 410 or are `noindex` — a stale job listing is a ranking liability

### Applications & pipeline
- [ ] Apply with a portfolio: selected projects, a message, and an optional PDF
- [ ] **The application carries the verified project work**, which is the entire point — a company
      is looking at attested evidence, not a self-written résumé
- [ ] Stages: applied → reviewed → shortlisted → interview → offered → accepted / rejected
- [ ] `/company/pipeline` — a board view, bulk actions, notes per candidate
- [ ] Student view: applications with live status; a rejection carries an optional coded reason
- [ ] Notifications on every stage change — silence after applying is the single worst part of the
      existing experience and it is free to fix

### Talent discovery
- [ ] `/company/talent` — search students by skill, domain, project work, college, year, graduation
- [ ] **Filter to faculty-attested work only** — the differentiator that makes this trustworthy
- [ ] Results show the projects, not a CV summary
- [ ] **A student appears only if they opted into being discoverable** (Phase 6), and a company can
      contact them only if they opted into being contactable. Non-negotiable.
- [ ] Saved searches and talent pools
- [ ] Contact through the platform, rate-limited, with the student able to block

## Acceptance criteria

1. An alumnus is verified, mentors a group through a full cycle — request, goal, three sessions,
   completion, feedback — and it is all recorded.
2. An unverified company cannot post an opportunity, cannot contact a student, and does not appear
   in search. Verified by attempting each directly.
3. An opportunity page passes the Rich Results Test as a valid `JobPosting`.
4. A student applies with their portfolio; the company sees the attested project work; the
   candidate moves through every pipeline stage with a notification at each.
5. Talent search returns only students who opted into discoverability.
6. A company cannot message a student who has not opted into contact.
7. Mentor matching produces ranked suggestions each with a stated reason.
8. An expired opportunity is no longer indexable.
9. `npm run check` clean.

## Key files this phase creates

```
src/app/(app)/mentorship/*
src/app/(app)/company/*                   Opportunities, talent, pipeline
src/app/(public)/opportunities/*          JobPosting structured data
src/app/(public)/companies/[slug]/
src/lib/matching/mentor.ts                Deterministic, explained
src/lib/db/queries/{mentorship,opportunity,application}.ts
src/lib/verification/company.ts           The anti-scam gate
```

## Notes & risks

- **Company verification is not a formality.** Fake internship listings that charge a "certificate
  fee" are a real and widespread scam targeting exactly these students. An unverified company that
  can post is a reputational catastrophe for the platform and a genuine harm to users. Gate it hard,
  and make the gate visible so students know what the badge means.
- **Opt-in contact is the line between a talent platform and a spam channel.** Do not soften it, do
  not add a "verified companies can contact anyone" exception. The moment students start receiving
  unsolicited recruiter mail, they stop making their profiles public and the whole surface dies.
- **A required goal on a mentorship request** is a small constraint with a large effect. Open-ended
  mentorship requests get ignored; a specific ask gets answered.
- Mentor capacity limits matter. The most willing mentors get buried first, and burying them loses
  them permanently.
- `JobPosting` structured data is the single highest-value schema type available to this product.
  Complete every field, and set `validThrough` accurately — an expired posting still in the index is
  a quality problem Google will notice.
- Notify on every pipeline change. Applying into silence is the universally hated part of the
  existing experience, and fixing it costs nothing.
- Do not build a full ATS. A pipeline board with stages and notes is enough; anything more competes
  with products that have a hundred engineers.

---

## Phase Summary

*Fill this in when the phase is complete.*

**What was built.**

**Key decisions made.**

**Deviations from the spec above, and why.**

**Anything the next phase must know.**

**Verified by.**

| Check | Result |
| --- | --- |
| | |
