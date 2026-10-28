# Phase 19 — Launch & Pitch Pack

| | |
| --- | --- |
| **Status** | ⬜ Not Started |
| **Depends on** | Phases 0–18 |
| **Blocks** | Nothing — this is the last phase |
| **Estimate** | 5 focused hours |
| **Started** | — |
| **Completed** | — |

## Objective

Turn a working product into something that can be **shown, explained and sold**. A product nobody
can demo convincingly does not get adopted, and the difference between a good demo and a bad one is
preparation, not the product.

References: `docs/PITCH.md`, `docs/BUSINESS-MODEL.md`.

## In scope

- The narrative demo dataset
- The demo script, timed
- The pitch deck
- Diagrams, screenshots and the landing page launch copy
- The pilot proposal document
- The post-MVP roadmap

## Deliverables

### The demo dataset
- [ ] A polished production of the Phase 3 seed, tuned to be **shown**, not just to be complete
- [ ] A believable college with a real-sounding name, departments and subjects
- [ ] **Named students with distinct, believable stories:**
      - one strong student with a genuinely impressive project and three attestations
      - one struggling group with a visibly silent member — so the health signal has a live example
      - one project that formally built on a previous batch's work, three levels deep
      - one project deliberately similar to an archived one, so the duplicate check fires live
      - one embargoed project, so the IP control is demonstrable
- [ ] Every screen has content — no empty state visible during the demo unless it is the point
- [ ] `npm run demo:reset` rebuilds this exact state in under 20 seconds, so a mistake mid-demo is
      recoverable
- [ ] Screenshots taken at every key screen for the deck and the landing page

### The demo script
- [ ] Timed to the slot, with a shorter variant. Two versions:
      - **5 minutes** — the problem, the workspace, the ledger, the archive
      - **12 minutes** — the full journey, student to faculty to public
- [ ] Written as a click-by-click script with the exact words to say
- [ ] **The order matters.** Open on the problem, not on a feature. The ledger is the moment that
      lands — build to it and pause on it.
- [ ] A fallback: recorded video and screenshots, in case anything fails live
- [ ] **The demo runs on localhost.** No network dependency, nothing on venue wifi to fail.
- [ ] Rehearsed end to end at least three times, timed

### The pitch deck
Built from `docs/PITCH.md`, 12–15 slides.
- [ ] Title · The problem (the three questions) · Why it persists · The solution and the four
      layers · The Contribution Ledger (its own slide — it is the differentiator) · The archive and
      lineage · Live demo · Market · Business model · Competition · Traction plan · The moat ·
      Roadmap · The ask
- [ ] All diagrams as SVG, in the design system's visual language
- [ ] **An honest "what is not built yet" slide.** Naming your own gaps is more credible than
      hoping nobody asks, and it pre-empts the hostile question.
- [ ] A one-page executive summary
- [ ] A version tailored to a faculty audience, and one to an investor audience — they need
      different second halves

### Diagrams (all SVG)
- [ ] System architecture
- [ ] The academic hierarchy
- [ ] The project lifecycle state machine
- [ ] How the Contribution Ledger works — this is the diagram that has to be excellent
- [ ] The lineage graph concept
- [ ] The data model at a readable altitude (**not** all 60 models — pick the ten that matter)
- [ ] The user journey, per role

### Launch materials
- [ ] Landing page final copy, with real screenshots replacing every placeholder
- [ ] `/about` finalised with the real story
- [ ] `/changelog` with the actual build history
- [ ] `/roadmap` published — public roadmaps build credibility with academic users
- [ ] Social profiles claimed: `@nexivora` everywhere
- [ ] An announcement post and a launch email
- [ ] A 90-second demo video, screen recording with captions (no voiceover needed)

### The pilot proposal
The document that goes to the first college.
- [ ] One page: what Nexivora is, what the pilot includes, what it costs (nothing), what is needed
      from them, and what they get
- [ ] Data handling and privacy commitments stated explicitly — **this is the first question an
      institution asks**, and having the answer written down is a credibility signal in itself
- [ ] Setup timeline and support commitment
- [ ] Success criteria agreed in advance, so the pilot has a defined end and a decision
- [ ] A pilot agreement template

### The roadmap
- [ ] Post-MVP priorities with reasoning
- [ ] Everything in `PROGRESS.md`'s deferred table, with a decision on each: build, drop, or later
- [ ] The mobile app decision (PWA versus native) with reasoning
- [ ] Integration roadmap: LMS, SIS, GitHub, ORCID, DigiLocker
- [ ] Internationalisation plan and what it would take
- [ ] The scaling plan and its first real bottleneck (be specific — it is the database, and it is
      the feed ranking query)

## Acceptance criteria

1. **The full demo runs in the allotted time without a single off-script keystroke**, three times in
   a row.
2. `npm run demo:reset` recovers a clean demo state in under 20 seconds.
3. Every screen shown in the demo has real, believable content.
4. The deck stands alone — someone who did not see the demo understands the product from it.
5. All diagrams are SVG and readable when projected.
6. The pilot proposal is one page and answers the privacy question without being asked.
7. The landing page uses real screenshots, not mockups.
8. The demo video is under 90 seconds and needs no explanation.

## Notes & risks

- **Open on the problem, not the product.** The three questions in `docs/PITCH.md` do more work than
  any feature tour, because everyone in an academic room already knows the answers and is nodding
  before you have shown anything.
- **The ledger is the moment.** Everything before it is context; everything after it is
  consequence. Build to it, show it slowly, and stop talking while people look at it.
- **Demo on localhost.** Venue wifi fails, and a failed demo is unrecoverable in a way that a
  missing feature is not.
- **Rehearse with the reset script.** Knowing you can recover from a mistake in twenty seconds
  changes how you present — you stop being careful and start being confident.
- **The honest gaps slide is a strength.** Naming what is not built pre-empts the hostile question
  and buys credibility for everything you did claim.
- The seed data is the demo. A generic project called "Test Project 1" undoes an hour of good
  presentation in two seconds.
- For the faculty conversation, lead with the dashboard and the ledger. For the investor
  conversation, lead with the archive and the accreditation export. **Same product, different
  second half.**

---

## Phase Summary

*Fill this in when the phase is complete.*

**What was produced.**

**Key decisions made.**

**Demo timing achieved.**

**Deviations from the spec above, and why.**

**What comes next.**

**Verified by.**

| Check | Result |
| --- | --- |
| | |
