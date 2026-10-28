# Phase 14 — Inter-College Network, Events & Global Collaboration

| | |
| --- | --- |
| **Status** | ⬜ Not Started |
| **Depends on** | Phase 13 |
| **Blocks** | Phase 15 |
| **Estimate** | 8 focused hours |
| **Started** | — |
| **Completed** | — |

## Objective

Turn a set of isolated college installations into a **network** — while keeping the cross-college
isolation rule intact. This is where "The Global Academic Collaboration Network" stops being a
tagline and becomes a feature.

It is deliberately late. Building it before there are multiple real colleges would be building for
users who do not exist (ADR-013).

## In scope

- Verified college profiles and the college-to-college graph
- Cross-college project collaboration with a correct permissions model
- Cross-college discovery
- Events: workshops, guest lectures, conferences
- Hackathons and challenges with team formation, submission and judging
- Public leaderboards and showcases

## Out of scope

- Payments for paid events · Live streaming · Certificates for event participation (Phase 15 scope)

## Deliverables

### College network
- [ ] `/colleges/[slug]` extended: profile, departments, public projects, faculty expertise,
      achievements, alumni count, SDG contribution
- [ ] `/colleges` — a directory with filters (state, type, focus areas, size)
- [ ] College follows college; a partnership request and acceptance flow
- [ ] `CollegePartnership` — scope, start date, contact people, status
- [ ] A college dashboard panel for partnerships and cross-college activity
- [ ] Only **verified** colleges appear in the network. Unverified ones remain internal-only.

### Cross-college collaboration — the careful part
- [ ] Invite a group or an individual from a partner college onto a project
- [ ] **A guest membership**, not a relaxation of the isolation rule (`docs/ROLES-PERMISSIONS.md`)
- [ ] A guest gets access to exactly that project and its workspace, and nothing else in the host
      college — verified by test, not by inspection
- [ ] Both colleges' faculty can view and jointly evaluate; the evaluation records both
- [ ] Both colleges count the project in their own reporting, with the collaboration noted
- [ ] The project page names both colleges
- [ ] Either college's admin can end the collaboration; access ends, the record persists
- [ ] Cross-college search and explore — public projects only, unless a partnership exists

### Events
- [ ] `/events` — public listing with filters (type, date, mode, college, domain, open-to)
- [ ] `/events/[slug]` — full detail with `Event` structured data
- [ ] Types: workshop · guest lecture · seminar · conference · exhibition · demo day
- [ ] Create: title, description, type, datetime, duration, mode (online / offline / hybrid), venue
      or link, capacity, audience (own college / partner colleges / open), registration deadline,
      speakers
- [ ] Registration with a capacity cap and a waitlist
- [ ] Reminders, calendar `.ics`, attendance marking
- [ ] Post-event: materials, recording link, feedback form
- [ ] Faculty, alumni, companies and college admins can host; students can host with faculty
      approval

### Hackathons & challenges
- [ ] `/challenges` and `/challenges/[slug]`, `Event` structured data
- [ ] Create: theme, problem statements, timeline (registration → submission → judging → results),
      eligibility, team size, prizes, sponsor, judging criteria
- [ ] **Team formation inside the challenge**, using the Phase 11 matcher — including cross-college
      teams, which is the whole point
- [ ] Submission: project link, repository, demo, presentation, description. A submission **creates
      a real Project** in the system rather than a detached form entry, so it carries into the
      archive and the portfolio.
- [ ] Judging: assign judges, score against the criteria, aggregate, break ties, publish results
- [ ] Public leaderboard, winners showcase, participation records on profiles
- [ ] Sponsored challenges: a company sponsor, branding, and their own view of submissions

### Global showcase
- [ ] `/showcase` — the innovation wall: the best public projects across the network, editorially
      curated plus algorithmically surfaced
- [ ] Filters: domain, SDG, college, year, most built-on
- [ ] College leaderboards: projects published, SDG coverage, cross-college collaboration,
      build-on count — **framed as visibility, never as a ranking of institutions.** A league table
      of colleges would be actively harmful and would make every college defensive.
- [ ] `/sdg/[n]` extended with network-wide impact

## Acceptance criteria

1. Two colleges form a partnership and collaborate on one project; a guest from college B can access
   exactly that project and **nothing else** in college A — proven by attempting the other routes.
2. Ending a collaboration revokes access immediately while preserving the project record and
   authorship.
3. An event is created, registered for, attended and closed, with reminders arriving.
4. A challenge runs from announcement through cross-college team formation, submission and judging
   to published results.
5. A challenge submission exists as a real project and appears in the participants' portfolios.
6. Event and challenge pages pass the Rich Results Test as valid `Event`.
7. Unverified colleges do not appear anywhere in the network surfaces.
8. Cross-college search returns only public projects, unless a partnership exists.
9. `npm run check` clean.

## Key files this phase creates

```
src/app/(public)/{colleges,events,challenges,showcase}/*
src/app/(app)/events/*                    Hosting and management
src/lib/db/queries/{college,event,challenge}.ts
src/lib/collaboration/guest.ts            Guest membership — the isolation-safe mechanism
src/lib/challenge/{judging,leaderboard}.ts
```

## Notes & risks

- **Guest membership is the only correct mechanism.** The tempting shortcut is to relax the
  `collegeId` predicate for partnered colleges. Do not: it converts a narrow, auditable grant into a
  broad, invisible one, and it is exactly the kind of change that looks fine and leaks everything.
  Grant per project, per person, with an expiry.
- **Test the negative case explicitly.** A guest with correct access to project X must be denied
  every other route in that college — the feed, the directory, other groups, search. Write that test
  before writing the feature.
- **Do not build a college league table.** Rankings make institutions defensive and competitive in
  ways that reduce sharing, which is the opposite of what the network needs. Showcase, do not rank.
- Challenge submissions must create real projects. A detached submission form produces work that
  vanishes after the event, which is precisely the problem this whole product exists to solve.
- Cross-college evaluation needs both colleges' faculty recorded on the evaluation, or the
  accreditation reporting in Phase 15 will attribute the project to one side only.
- Event capacity and waitlists are simple to build and immediately obviously useful. Do not skip
  the waitlist; it is the difference between a feature and a working feature.

---

## Phase Summary

*Fill this in when the phase is complete.*

**What was built.**

**Key decisions made.**

**How guest access was proven safe.**

**Deviations from the spec above, and why.**

**Anything the next phase must know.**

**Verified by.**

| Check | Result |
| --- | --- |
| | |
