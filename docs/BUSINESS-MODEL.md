# Business Model & Go-To-Market

---

## 1. The honest starting position

Nexivora has a **severe cold-start problem**. A social network is worthless to its first user, and
every network feature — feed, discovery, matching, alumni, companies — is worth exactly nothing on
day one. Pretending otherwise is how student-network startups die.

**So we do not launch as a network.** (ADR-013.)

> **We launch as a tool that one class uses for one semester.**
> The group workspace and the faculty dashboard are valuable to five students and one faculty
> member with nobody else on the platform. The network is what accumulates.

Everything below follows from that sentence.

---

## 2. Who pays, and who never does

| Segment | Pays? | Why |
| --- | --- | --- |
| **Students** | **Never.** Free forever, all features. | Students are the content and the network. Charging them kills both, and no student pays for a tool their college chose. |
| **Faculty** | Never. | Faculty are the adoption channel. A faculty member who has to expense a tool will not adopt it. |
| **Colleges / institutions** | **Yes — this is the revenue.** | They get administration, oversight, analytics, and the accreditation export that saves them weeks of manual work. |
| **Companies** | Yes, above a free tier. | Talent discovery and opportunity posting. Free to post a limited number; paid for search, pipeline and analytics. |
| **Alumni** | Never. | Alumni are supply-side value. Charging mentors is backwards. |

---

## 3. The institutional value proposition — and why accreditation is the wedge

Every Indian institution goes through **NAAC**, **NBA**, **NIRF** and **AICTE** reporting. Each
cycle requires compiling evidence of student projects, research output, innovation activity, SDG
alignment, industry engagement and student outcomes. Today this is done by a committee of faculty,
manually, from email attachments and printed reports, over several weeks, every single year.

**Nexivora already holds every one of those data points, structured, because the platform generated
them as a by-product of ordinary use.**

That is the entire pitch to a college, and it is not a feature comparison — it is a line item they
already pay for in faculty time.

| What they do today | What Nexivora does |
| --- | --- |
| Weeks of faculty time compiling project evidence for NAAC Criterion III | A one-click export |
| No visibility into project progress until submission | A live dashboard |
| No institutional memory — every batch starts from zero | A permanent, searchable archive with lineage |
| No way to evidence SDG alignment of student work | An SDG report generated from tagged projects |
| Placement cell has no record of what students actually built | Verified project portfolios |

---

## 4. Pricing

Deliberately simple, priced in rupees, and low enough that a Head of Department can approve it
without a tender process. **That last point is the design constraint** — a price that requires a
procurement committee adds a year to the sales cycle.

### Institutions

| Tier | Price | For | Includes |
| --- | --- | --- | --- |
| **Pilot** | **Free, one semester** | One department | Full product, up to 300 students. No card. The whole go-to-market runs through this tier. |
| **Department** | ₹25,000 / year | One department | Up to 500 students, full workspace, faculty dashboards, department analytics |
| **Institution** | ₹1,50,000 / year | Whole college | Unlimited students, all departments, **accreditation exports**, college branding, admin console, priority support |
| **Institution+** | ₹3,00,000 / year | Multi-campus | Everything, plus multi-campus rollup, API access, SSO, a dedicated success contact |

At ₹1.5L for a 3,000-student college, that is **₹50 per student per year** — less than a single
printed project report, and a rounding error against the faculty time the accreditation export
alone saves.

### Companies

| Tier | Price | Includes |
| --- | --- | --- |
| **Free** | ₹0 | Company profile, 3 active opportunities, respond to applicants |
| **Recruiter** | ₹15,000 / year | Unlimited postings, talent search filtered by verified project work, pipeline management |
| **Partner** | ₹75,000 / year | Everything, plus sponsored challenges, campus analytics, priority placement, employer branding |

### Never

No ads. No selling student data. No pay-to-rank on the feed. No charging a student to see who
viewed their profile. These are stated publicly because they are a differentiator against every
adjacent product, and because breaking them once destroys the institutional trust that is the
entire moat.

---

## 5. Go-to-market — the actual sequence

### Stage 1 — One class (weeks 1–12)

Your own college. One faculty member, one subject, one semester. Five to ten groups.

**The pitch to that faculty member is not "join my platform".** It is: *"you will be able to see
what every group is actually doing, and who in each group is actually doing it, without asking."*
That is a genuine pain and it is felt weekly.

**Success looks like:** groups use the workspace instead of WhatsApp, and the faculty member checks
the dashboard without being reminded.

### Stage 2 — One department (semester 2)

The first faculty member introduces the second. Free pilot tier. Now the archive has one semester
of real projects, the feed has real content, and the department dashboard shows something.

**Success looks like:** a second faculty member adopts it without you asking.

### Stage 3 — One college (year 2)

Convert to the paid Institution tier, and the conversation is with the Dean or the IQAC coordinator,
not with a faculty member. **The accreditation export is the conversation.** By now you have a full
year of real data to demonstrate it against.

**Success looks like:** the first paying customer, and a named reference.

### Stage 4 — Colleges 2 through 10 (year 2–3)

Two channels, and only two:

1. **Faculty who move institutions**, and faculty networks — conferences, FDPs, subject
   associations. Academic adoption travels through people, not advertising.
2. **The public archive.** By stage 4 the SEO surface is producing organic traffic from students
   searching for project ideas. Those students ask their college for it. This is the compounding
   channel and it costs nothing.

### Stage 5 — Network effects turn on (year 3+)

Only once there are multiple colleges do inter-college collaboration, alumni networks, company
talent discovery and the global network become real. **These are Phases 13–14 for exactly this
reason** — building them earlier would be building features for users who do not exist yet.

---

## 6. Unit economics

**Costs at pilot scale (one to three colleges):**

| Item | Monthly |
| --- | --- |
| Hostinger VPS KVM 2 | ~₹800 |
| Domain | ~₹100 amortised |
| Email (Brevo free tier, 300/day) | ₹0 |
| Backups (Cloudflare R2 free tier) | ₹0 |
| **Total** | **~₹900/month** |

**One Institution customer at ₹1,50,000/year covers infrastructure roughly fourteen times over.**
The product is architected specifically so this is true: no per-MAU auth billing, no managed
database, no CDN bill, no AI cost in the base product, no raster image pipeline. Every choice in
`docs/DECISIONS.md` that rejected a hosted service was also this decision.

**The one variable cost is AI (Phase 18).** It is therefore behind a per-user quota and a hard
global cap, and it is a feature of the paid tiers rather than the free one.

---

## 7. Defensibility

Ranked by how hard each is to copy:

1. **The archive and its lineage graph.** Four years of a college's documented project work with
   recorded lineage cannot be replicated by a competitor, at any price. It grows more valuable
   every semester and it is the reason a college does not switch. **This is the moat.**
2. **Institutional integration.** Once a college's hierarchy, roster, rubrics and accreditation
   workflow live in Nexivora, switching costs are a semester of disruption.
3. **The Contribution Ledger.** Easy to describe, hard to copy well — it requires the workspace to
   be the actual place work happens, which requires the workspace to be genuinely good.
4. **Verified academic identity.** A trusted graph of who is actually a student where, verified by
   the institution rather than self-declared, is slow to build and immediately valuable.
5. **The public archive as an SEO asset.** A compounding organic channel a competitor would need
   years of real usage to match.

Not defensible, and we should not pretend otherwise: the feed, the profiles, the UI.

---

## 8. Risks, honestly

| Risk | Assessment | Response |
| --- | --- | --- |
| **Colleges buy slowly** | High and certain. Academic procurement is measured in semesters. | The free pilot tier removes the purchase decision entirely from stage 1. Revenue is a year-2 expectation, not a year-1 one. |
| **Faculty do not adopt** | The single biggest existential risk. | The whole product is designed around faculty pain, not student delight. If a faculty member does not open the dashboard weekly, the product has failed and we should learn that in month two, not year two. |
| **Students keep using WhatsApp** | Likely, partially, forever. | Do not fight it. The workspace wins on tasks, files, deadlines and the ledger. Chat can stay on WhatsApp; that is fine and we should stop pretending otherwise. |
| **An LMS vendor ships this** | Moodle, Google Classroom or a local LMS could add project tracking. | They will not add the ledger, the lineage archive or the public network — those are not LMS-shaped. And their incentive is course delivery, not student portfolios. |
| **Data / privacy incident** | Low probability, severe impact. | DPDP-aligned from Phase 4, hardened in Phase 16. Privacy defaults are off. |
| **Solo founder capacity** | Certain. | The phase plan is explicitly ordered so that stopping at Phase 12 leaves a coherent, sellable product. |

---

## 9. The 18-month plan

| Quarter | Goal | Measure |
| --- | --- | --- |
| Q1 | Phases 0–12. MVP complete. | One class using it for a real semester |
| Q2 | Phases 13–17. Deployed, hardened, live at `nexivora.com`. | One department, ~200 students |
| Q3 | Phase 18–19. First paid pilot conversation. | One signed Institution customer |
| Q4 | Colleges 2 and 3. Accreditation export used in a real NAAC cycle. | ₹3–5L ARR |
| Q5–Q6 | Company tier, alumni network, inter-college. | 10 colleges, ₹15L ARR, network effects visible |
