import type { $Enums, Prisma, PrismaClient } from "@prisma/client";

import { opportunities } from "../../src/content/opportunities.ts";
import { collegeId } from "./hierarchy.ts";
import {
  DEMO_PASSWORD_HASH,
  OPPORTUNITY_TYPE,
  daysAfter,
  iso,
  seedId,
  step,
  type Rng,
} from "./lib.ts";
import { userId, type Cast } from "./people.ts";

/**
 * The outward-facing half: companies, opportunities, events, mentorship, and
 * the question-and-resource surfaces the feed anchors to.
 *
 * The verification gate is the important part. An unverified company cannot
 * post, cannot contact a student and does not appear in search — and one such
 * company is seeded so that rule is visibly enforced rather than assumed. Fake
 * internship listings that charge a "certificate fee" are a real scam aimed at
 * exactly these students.
 */

const companySlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const companyUserId = (name: string) => seedId("user", `company-${companySlug(name)}`);
const companyProfileId = (name: string) => seedId("company", companySlug(name));

const EVENTS: Array<{
  slug: string;
  title: string;
  kind: $Enums.EventKind;
  days: number;
  description: string;
}> = [
  {
    slug: "sustainability-demo-day-2026",
    title: "Sustainability Demo Day",
    kind: "DEMO_DAY",
    days: 21,
    description:
      "Eight teams present water, energy and agriculture projects to a panel of alumni and two municipal engineers. Fifteen minutes each, questions welcome.",
  },
  {
    slug: "embedded-systems-workshop",
    title: "Hands-on Embedded Systems Workshop",
    kind: "WORKSHOP",
    days: 9,
    description:
      "Bring a laptop. We will go from a blank ESP32 to a calibrated sensor logging over MQTT in three hours.",
  },
  {
    slug: "guest-lecture-applied-nlp",
    title: "Guest Lecture: Applied NLP for Indian Languages",
    kind: "GUEST_LECTURE",
    days: 34,
    description:
      "What actually works for low-resource Indian languages, and what the benchmarks do not tell you.",
  },
  {
    slug: "inter-college-hackathon-2026",
    title: "Inter-college Hackathon 2026",
    kind: "HACKATHON",
    days: 52,
    description:
      "Thirty-six hours, mixed teams across three colleges, judged on whether the thing runs.",
  },
];

const QUESTIONS = [
  {
    slug: "choosing-between-esp32-and-stm32",
    title: "How do you choose between an ESP32 and an STM32 for a battery-powered sensor?",
    body: "Our node needs to run for a season on a single charge and sample every fifteen minutes. The ESP32 is what the lab has, but the deep-sleep numbers look worse than the STM32 datasheet. Has anyone measured this in the field rather than on paper?",
    tags: ["embedded", "power", "iot"],
  },
  {
    slug: "how-much-field-data-is-defensible",
    title: "How much field data is enough to make a defensible claim?",
    body: "We have three weeks of readings from four sensors. The guide says that is thin. What is the argument for or against, and how do you write about the limitation honestly rather than hiding it?",
    tags: ["methodology", "research"],
  },
  {
    slug: "ethics-approval-for-classroom-data",
    title: "Does a classroom attendance study need ethics approval?",
    body: "We want to record attendance patterns for a semester. Nobody is identifiable in the output but the collection is. What is the process here and who signs off?",
    tags: ["ethics", "research"],
  },
];

const RESOURCES = [
  {
    slug: "soil-moisture-sensor-calibration-guide",
    title: "Field calibration guide for capacitive soil moisture sensors",
    url: "https://example.org/soil-moisture-calibration",
    kind: "GUIDE",
    summary:
      "The two-point calibration procedure, plus the temperature compensation step almost every student project skips and then spends a month debugging.",
    tags: ["iot", "agritech", "sensors"],
  },
  {
    slug: "writing-a-limitations-section",
    title: "How to write a limitations section that helps you",
    url: "https://example.org/limitations",
    kind: "ARTICLE",
    summary:
      "Being specific about what you did not test makes the work more credible, not less. Worked examples from three student reports.",
    tags: ["writing", "research"],
  },
  {
    slug: "open-indian-language-datasets",
    title: "Open datasets for Indian language NLP",
    url: "https://example.org/indic-datasets",
    kind: "DATASET",
    summary:
      "A maintained list with licence terms spelled out, which is the part that usually bites you three months in.",
    tags: ["nlp", "datasets"],
  },
];

export async function seedNetwork(db: PrismaClient, rng: Rng, cast: Cast): Promise<void> {
  const main = "nexivora-institute-of-technology";

  /* ----------------------------------------------------------- companies */

  const organisations = [
    ...new Map(opportunities.map((o) => [o.organisation.name, o.organisation])).values(),
  ];

  await db.user.createMany({
    data: organisations.map((org) => ({
      id: companyUserId(org.name),
      email: `talent@${companySlug(org.name)}.example.com`,
      passwordHash: DEMO_PASSWORD_HASH,
      emailVerified: iso("2026-01-10"),
      username: `company-${companySlug(org.name)}`,
      name: org.name,
      createdAt: iso("2026-01-10"),
    })),
  });

  await db.membership.createMany({
    data: organisations.map((org) => ({
      id: seedId("membership", companySlug(org.name), main, "COMPANY"),
      userId: companyUserId(org.name),
      collegeId: collegeId(main),
      role: "COMPANY",
      state: "ACTIVE",
      joinedAt: iso("2026-01-10"),
    })),
  });

  await db.companyProfile.createMany({
    data: organisations.map((org) => ({
      id: companyProfileId(org.name),
      userId: companyUserId(org.name),
      slug: companySlug(org.name),
      name: org.name,
      website: org.website ?? null,
      // The gate: unverified means it cannot post, cannot contact, is not listed.
      verification: org.verified ? "VERIFIED" : "PENDING",
      verifiedAt: org.verified ? iso("2026-01-20") : null,
    })),
  });
  step("companies", organisations.length);

  /* -------------------------------------------------------- opportunities */

  await db.opportunity.createMany({
    data: opportunities.map((opportunity) => ({
      id: seedId("opportunity", opportunity.slug),
      companyId: companyProfileId(opportunity.organisation.name),
      slug: opportunity.slug,
      title: opportunity.title,
      summary: opportunity.summary,
      description: opportunity.description,
      type: OPPORTUNITY_TYPE[opportunity.type] ?? "INTERNSHIP",
      employmentType: opportunity.employmentType,
      city: opportunity.location?.city ?? null,
      state: opportunity.location?.state ?? null,
      remote: opportunity.remote,
      openings: opportunity.openings,
      stipendMin: opportunity.stipend?.min ?? null,
      stipendMax: opportunity.stipend?.max ?? null,
      stipendUnit: opportunity.stipend?.unit ?? null,
      currency: opportunity.stipend?.currency ?? "INR",
      skills: opportunity.skills,
      eligibility: opportunity.eligibility,
      responsibilities: opportunity.responsibilities,
      postedOn: iso(opportunity.postedOn),
      validThrough: iso(opportunity.validThrough),
      createdAt: iso(opportunity.postedOn),
    })),
  });
  step("opportunities", opportunities.length);

  /* -------------------------------------------------------- applications */

  const applicants = cast.studentsByCollege.get(main) ?? [];
  const applicationRows: Prisma.ApplicationCreateManyInput[] = [];
  const stageRows: Prisma.ApplicationStageEventCreateManyInput[] = [];

  for (const opportunity of opportunities.filter((o) => o.organisation.verified)) {
    for (const username of rng.sample(applicants, rng.int(2, 5))) {
      const applicationId = seedId("application", opportunity.slug, username);
      const stage = rng.pick([
        "APPLIED",
        "APPLIED",
        "REVIEWED",
        "SHORTLISTED",
        "INTERVIEW",
        "REJECTED",
      ] as const);
      const createdAt = daysAfter(iso(opportunity.postedOn), rng.int(1, 20));

      applicationRows.push({
        id: applicationId,
        opportunityId: seedId("opportunity", opportunity.slug),
        applicantId: userId(username),
        stage,
        message: "I worked on a related project last term and can share the write-up and the code.",
        projectIds: [],
        createdAt,
      });

      stageRows.push({
        id: seedId("appstage", applicationId, 0),
        applicationId,
        from: null,
        to: "APPLIED",
        createdAt,
      });

      if (stage !== "APPLIED") {
        stageRows.push({
          id: seedId("appstage", applicationId, 1),
          applicationId,
          from: "APPLIED",
          to: stage,
          createdAt: daysAfter(createdAt, rng.int(3, 12)),
        });
      }
    }
  }

  await db.application.createMany({ data: applicationRows });
  await db.applicationStageEvent.createMany({ data: stageRows });
  step("applications", applicationRows.length);

  /* ------------------------------------------------------------- events */

  const host = cast.usernameByName.get("Dr Meera Rao") ?? "meera-rao";
  const now = iso("2026-09-09");

  await db.event.createMany({
    data: EVENTS.map((event) => ({
      id: seedId("event", event.slug),
      collegeId: collegeId(main),
      hostId: userId(host),
      slug: event.slug,
      title: event.title,
      description: event.description,
      kind: event.kind,
      startsAt: daysAfter(now, event.days),
      durationMinutes: event.kind === "HACKATHON" ? 2160 : 120,
      mode: "offline",
      venue: "Main Auditorium",
      capacity: event.kind === "HACKATHON" ? 120 : 60,
      audience: event.kind === "HACKATHON" ? "network" : "college",
      registrationDeadline: daysAfter(now, Math.max(1, event.days - 3)),
    })),
  });

  const registrationRows = EVENTS.flatMap((event) =>
    rng.sample(applicants, rng.int(8, 22)).map((username) => ({
      id: seedId("eventreg", event.slug, username),
      eventId: seedId("event", event.slug),
      userId: userId(username),
      waitlisted: false,
    })),
  );

  await db.eventRegistration.createMany({ data: registrationRows });
  step("events + registrations", EVENTS.length + registrationRows.length);

  /* ---------------------------------------------------------- mentorship */

  const mentors = [
    ...(cast.facultyByCollege.get(main) ?? []),
    ...["Shreya Kapoor", "Aman Bhatia", "Divya Raghavan"]
      .map((name) => cast.usernameByName.get(name))
      .filter((username): username is string => Boolean(username)),
  ];

  const mentorshipRows: Prisma.MentorshipRequestCreateManyInput[] = rng
    .sample(applicants, 9)
    .map((mentee, index) => {
      const mentor = mentors[index % mentors.length] ?? mentors[0] ?? host;
      const state = rng.pick(["PENDING", "ACCEPTED", "ACCEPTED", "DECLINED"] as const);

      return {
        id: seedId("mentorship", mentee, mentor),
        mentorId: userId(mentor),
        menteeId: userId(mentee),
        // Required, and required for a reason: "be my mentor" produces nothing
        // useful for either side.
        goal: rng.pick([
          "Decide whether to pursue a research path or industry after graduation",
          "Get feedback on my project write-up before I submit it",
          "Understand what an embedded systems role actually involves day to day",
          "Prepare for interviews without memorising puzzle questions",
        ]),
        state,
        declineReason:
          state === "DECLINED" ? "At capacity this term. Happy to revisit in January." : null,
        createdAt: daysAfter(now, -rng.int(5, 60)),
      };
    });

  await db.mentorshipRequest.createMany({ data: mentorshipRows, skipDuplicates: true });
  step("mentorship requests", mentorshipRows.length);

  /* ----------------------------------------------- questions & resources */

  await db.question.createMany({
    data: QUESTIONS.map((question, index) => ({
      id: seedId("question", question.slug),
      collegeId: collegeId(main),
      authorId: userId(rng.pick(applicants)),
      slug: question.slug,
      title: question.title,
      body: question.body,
      tags: question.tags,
      answerCount: index === 0 ? 3 : index === 1 ? 2 : 1,
      createdAt: daysAfter(now, -rng.int(4, 40)),
    })),
  });

  const answerRows = QUESTIONS.flatMap((question, qIndex) =>
    Array.from({ length: qIndex === 0 ? 3 : qIndex === 1 ? 2 : 1 }, (_, aIndex) => ({
      id: seedId("answer", question.slug, aIndex),
      questionId: seedId("question", question.slug),
      authorId: userId(rng.pick([...applicants, ...(cast.facultyByCollege.get(main) ?? [])])),
      body:
        aIndex === 0
          ? "Measured this last term. The deep-sleep difference is real but smaller than the datasheet suggests once you account for the regulator. Happy to share the numbers."
          : "Worth checking whether your sampling interval dominates the budget before optimising the chip choice.",
      accepted: aIndex === 0,
      createdAt: daysAfter(now, -rng.int(1, 20)),
    })),
  );

  await db.answer.createMany({ data: answerRows });

  await db.resource.createMany({
    data: RESOURCES.map((resource) => ({
      id: seedId("resource", resource.slug),
      collegeId: collegeId(main),
      authorId: userId(rng.pick(applicants)),
      slug: resource.slug,
      title: resource.title,
      url: resource.url,
      kind: resource.kind,
      summary: resource.summary,
      tags: resource.tags,
      createdAt: daysAfter(now, -rng.int(3, 50)),
    })),
  });
  step("questions, answers, resources", QUESTIONS.length + answerRows.length + RESOURCES.length);

  /* -------------------------------------------------------- partnerships */

  // Cross-college collaboration requires BOTH an accepted partnership and a
  // guest membership. The guest memberships were written in groups.ts from the
  // project teams; the partnerships are derived from them here rather than
  // hardcoded, so the two can never drift apart — a guest without a partnership
  // is a hole in isolation, and scripts/verify-db.mjs fails on exactly that.
  const guests = await db.membership.findMany({
    where: { state: "GUEST" },
    select: { userId: true, collegeId: true },
  });

  const pairs = new Map<string, { aId: string; bId: string }>();

  for (const guest of guests) {
    const home = await db.membership.findFirst({
      where: { userId: guest.userId, state: { not: "GUEST" } },
      select: { collegeId: true },
    });

    if (!home || home.collegeId === guest.collegeId) continue;

    // Sorted, so A–B and B–A are one partnership rather than two.
    const [aId, bId] = [home.collegeId, guest.collegeId].sort();
    if (!aId || !bId) continue;
    pairs.set(`${aId}:${bId}`, { aId, bId });
  }

  const SCOPES: Record<string, string> = {
    [`${collegeId(main)}:${collegeId("meridian-college-of-engineering")}`]:
      "Joint water and sustainability projects; shared demo days.",
    [`${collegeId("meridian-college-of-engineering")}:${collegeId(main)}`]:
      "Joint water and sustainability projects; shared demo days.",
  };

  await db.collegePartnership.createMany({
    data: [...pairs.values()].map(({ aId, bId }) => ({
      id: seedId("partnership", aId, bId),
      aId,
      bId,
      scope: SCOPES[`${aId}:${bId}`] ?? "Shared supervision on joint student projects.",
      state: "ACCEPTED",
      startedOn: iso("2026-02-01"),
    })),
    skipDuplicates: true,
  });
  step("college partnerships", pairs.size);
}
