import type { Prisma, PrismaClient } from "@prisma/client";

import { projects } from "../../src/content/projects.ts";
import { groupId, type Groups } from "./groups.ts";
import { collegeId } from "./hierarchy.ts";
import { daysAfter, iso, seedId, step, type Rng } from "./lib.ts";
import { userId, type Cast } from "./people.ts";
import type { Projects } from "./projects.ts";

/**
 * Evaluation, attestation and peer review.
 *
 * Two invariants are modelled here rather than described:
 *
 *   · A rubric is versioned, never edited. An edited rubric that retroactively
 *     changes past evaluations is a serious academic integrity problem.
 *   · An attestation is issued by a named human and revoked without being
 *     deleted. Its whole value is that someone put their name to it, so the
 *     record of a withdrawal has to survive the withdrawal.
 */

const CRITERIA = [
  {
    name: "Problem framing",
    weight: 20,
    descriptor: "Is the problem real, specific and worth solving?",
  },
  {
    name: "Technical execution",
    weight: 30,
    descriptor: "Does the implementation work, and is it sound?",
  },
  {
    name: "Evidence and testing",
    weight: 25,
    descriptor: "Are the claims backed by data the team actually collected?",
  },
  {
    name: "Communication",
    weight: 15,
    descriptor: "Can a reader outside the team follow what was done and why?",
  },
  {
    name: "Individual contribution",
    weight: 10,
    descriptor: "Scored per member against the workspace record.",
  },
];

const PEER_COMMENTS = [
  "Reliable — picked up the hardware work nobody else wanted and finished it.",
  "Strong on the analysis. Could communicate blockers earlier rather than absorbing them.",
  "Did the unglamorous integration work that made the demo possible.",
  "Good ideas, but commitments slipped more than once and the rest of us absorbed it.",
  "Kept the documentation current throughout, which saved us during the write-up.",
];

/**
 * A verification code in the real format, from the seeded RNG.
 *
 * Mirrors `attestationCode()` in `src/lib/evaluation/attestation.ts` — the same
 * Crockford alphabet without I, L, O and U — but draws from the seed's own
 * stream so the demo world stays reproducible. Importing the real generator
 * would pull `node:crypto` randomness in and make every seed run different.
 */
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function demoCode(rng: Rng): string {
  const body = Array.from({ length: 12 }, () =>
    CODE_ALPHABET.charAt(rng.int(0, CODE_ALPHABET.length - 1)),
  ).join("");
  return `NX-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

export async function seedEvaluation(
  db: PrismaClient,
  rng: Rng,
  cast: Cast,
  groups: Groups,
  projectIndex: Projects,
): Promise<void> {
  const college = "nexivora-institute-of-technology";
  const evaluator = cast.usernameByName.get("Dr Meera Rao") ?? "meera-rao";

  /* -------------------------------------------------------------- rubric */

  const rubricId = seedId("rubric", "major-project-v1");

  await db.rubric.create({
    data: {
      id: rubricId,
      collegeId: collegeId(college),
      creatorId: userId(evaluator),
      name: "Major Project Evaluation",
      version: 1,
      createdAt: iso("2025-08-01"),
      criteria: {
        createMany: {
          data: CRITERIA.map((criterion, index) => ({
            id: seedId("criterion", criterion.name),
            name: criterion.name,
            weight: criterion.weight,
            descriptors: { guidance: criterion.descriptor },
            position: index,
          })),
        },
      },
    },
  });
  step("rubric + criteria", CRITERIA.length);

  /* ---------------------------------------------------------- evaluation */

  // Completed projects are the ones that have been through review.
  const evaluated = projects.filter(
    (project) => project.status === "completed" || project.status === "archived",
  );

  const evaluationRows: Prisma.EvaluationCreateManyInput[] = [];
  const scoreRows: Prisma.CriterionScoreCreateManyInput[] = [];

  for (const project of evaluated) {
    const evaluationId = seedId("evaluation", project.slug);
    const completedOn = iso(project.completedOn ?? project.startedOn);
    const groupScore = rng.int(68, 92);

    evaluationRows.push({
      id: evaluationId,
      projectId: seedId("project", project.slug),
      rubricId,
      evaluatorId: userId(cast.usernameByName.get(project.facultyGuide ?? "") ?? evaluator),
      round: 1,
      groupScore,
      outcome: groupScore >= 80 ? "Distinction" : "Pass",
      comments:
        "Solid work overall. The evidence section is the strongest part; the discussion of " +
        "limitations could be more candid about what was not tested.",
      releasedAt: daysAfter(completedOn, 14),
      createdAt: daysAfter(completedOn, 10),
    });

    for (const criterion of CRITERIA) {
      // The group score for this criterion.
      scoreRows.push({
        id: seedId("cscore", project.slug, criterion.name),
        evaluationId,
        criterionId: seedId("criterion", criterion.name),
        memberId: null,
        score: Math.min(100, groupScore + rng.int(-6, 6)),
        createdAt: daysAfter(completedOn, 10),
      });

      // Individual contribution is scored per member — the entire reason the
      // ledger exists is that these can legitimately differ.
      if (criterion.name !== "Individual contribution") continue;

      for (const member of project.members) {
        const deviation = rng.int(-12, 8);

        scoreRows.push({
          id: seedId("cscore", project.slug, criterion.name, member.username),
          evaluationId,
          criterionId: seedId("criterion", criterion.name),
          memberId: userId(member.username),
          score: Math.max(0, Math.min(100, groupScore + deviation)),
          // Required whenever a member deviates from the group score.
          reason:
            deviation < -5
              ? "Workspace record shows materially less activity than the rest of the team."
              : deviation > 5
                ? "Carried the integration work and the write-up."
                : null,
          createdAt: daysAfter(completedOn, 10),
        });
      }
    }
  }

  await db.evaluation.createMany({ data: evaluationRows });
  await db.criterionScore.createMany({ data: scoreRows });
  step("evaluations", evaluationRows.length);

  /* -------------------------------------------------------- attestations */

  const attested = projects.flatMap((project) =>
    project.members
      .filter((member) => member.tier === "attested")
      .map((member) => ({ project, member })),
  );

  const attestationRows = attested.map(({ project, member }, index) => {
    const attester =
      cast.usernameByName.get(member.attestedBy ?? project.facultyGuide ?? "") ?? evaluator;
    const issuedAt = iso(project.completedOn ?? project.startedOn);

    return {
      id: seedId("attestation", project.slug, member.username),
      attesterId: userId(attester),
      subjectUserId: userId(member.username),
      subjectType: "ProjectMember",
      subjectId: seedId("pmember", project.slug, member.username),
      statement: `I supervised this work and confirm that ${member.username} was responsible for ${member.role.toLowerCase()} on ${project.title}.`,
      // The real format, produced deterministically. `NXV-ATT-0001` was
      // readable but `isAttestationCode()` rejects it, so every seeded
      // attestation was unverifiable at /verify — the one thing an attestation
      // code is for. Caught by looking at the page, not by a check.
      code: demoCode(rng),
      issuedAt,
      // One revoked, so the revocation path is visible in the demo rather than
      // theoretical. Revoking preserves the record; it does not delete it.
      revokedAt: index === 0 ? daysAfter(issuedAt, 45) : null,
      revokedReason:
        index === 0
          ? "Issued against the wrong project member. Reissued the following week."
          : null,
    };
  });

  await db.attestation.createMany({ data: attestationRows });
  step("attestations", attestationRows.length);

  /* --------------------------------------------------------- peer review */

  const reviewRows: Prisma.PeerReviewCreateManyInput[] = [];

  for (const project of evaluated) {
    const group = groupId(project.slug);
    const members = groups.membersByGroup.get(group) ?? [];
    const milestones = projectIndex.milestonesByProject.get(project.slug) ?? [];
    const milestone = milestones.at(-1) ?? null;
    if (members.length < 2 || !milestone) continue;

    for (const author of members) {
      for (const subject of members) {
        if (author === subject) continue;

        reviewRows.push({
          id: seedId("review", milestone, author, subject),
          groupId: group,
          milestoneId: milestone,
          authorId: userId(author),
          subjectId: userId(subject),
          contribution: rng.int(3, 5),
          reliability: rng.int(3, 5),
          communication: rng.int(3, 5),
          comment: rng.pick(PEER_COMMENTS),
          createdAt: daysAfter(iso(project.completedOn ?? project.startedOn), 7),
        });
      }
    }
  }

  await db.peerReview.createMany({ data: reviewRows });
  step("peer reviews", reviewRows.length);

  /* ------------------------------------------------------------ feedback */

  const feedbackRows = evaluated.slice(0, 4).flatMap((project) =>
    ["RESULTS", "CONCLUSION"].map((kind) => ({
      id: seedId("feedback", project.slug, kind),
      sectionId: seedId("section", project.slug, kind),
      projectId: seedId("project", project.slug),
      authorId: userId(cast.usernameByName.get(project.facultyGuide ?? "") ?? evaluator),
      body:
        kind === "RESULTS"
          ? "State the sample size and the conditions here, not in the appendix. A reader should not have to hunt for what the numbers are based on."
          : "Be more specific about what you would do differently. 'More data' is not a finding.",
      createdAt: daysAfter(iso(project.completedOn ?? project.startedOn), 8),
    })),
  );

  await db.feedback.createMany({ data: feedbackRows });
  step("section feedback", feedbackRows.length);
}
