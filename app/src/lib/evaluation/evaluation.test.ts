import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEVIATION_TOLERANCE,
  canRelease,
  deviates,
  deviation,
  prefillMemberScores,
  totalFor,
  type Criterion,
  type Score,
} from "./score";
import {
  RUBRIC_TEMPLATES,
  SCORE_MAX,
  requiresNewVersion,
  validateRubric,
  versionNotice,
  type CriterionDraft,
} from "./rubric";
import {
  CODE_PATTERN,
  attestationCode,
  attributionLine,
  isAttestationCode,
  prefillContributionStatement,
  prefillProjectStatement,
  validateRevocation,
  validateStatement,
} from "./attestation";

/**
 * A mark is the most disputable number this product produces and an attestation
 * is the most consequential sentence. These tests are written against the ways
 * each could be quietly wrong — a rubric that silently caps at 94%, a partial
 * evaluation that reads as a fail, an attestation issued with nobody's words in
 * it.
 */

/* ------------------------------------------------------------- rubrics */

describe("validateRubric", () => {
  const criteria = (...weights: number[]): CriterionDraft[] =>
    weights.map((weight, index) => ({ name: `Criterion ${index + 1}`, weight }));

  it("POSITIVE CONTROL — accepts weights summing to 100", () => {
    assert.deepEqual(validateRubric("Major project", criteria(40, 30, 30)), { ok: true });
  });

  it("refuses weights that sum to less than 100, saying what the cap would be", () => {
    // The failure mode this prevents: a rubric whose maximum achievable mark is
    // 94, which nobody notices until two students compare totals.
    const result = validateRubric("Short", criteria(40, 30, 24));

    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.error, /sum to 94/);
    assert.match(result.ok ? "" : result.error, /highest achievable mark is 94/);
  });

  it("refuses weights that sum to more than 100", () => {
    const result = validateRubric("Long", criteria(50, 40, 30));

    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.error, /Remove 20/);
  });

  it("refuses a rubric with no criteria", () => {
    assert.equal(validateRubric("Empty", []).ok, false);
  });

  it("refuses two criteria with the same name", () => {
    const result = validateRubric("Duplicated", [
      { name: "Implementation", weight: 50 },
      { name: "implementation", weight: 50 },
    ]);

    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.error, /same name/);
  });

  it("refuses a fractional or zero weight", () => {
    assert.equal(
      validateRubric("Fractional", [
        { name: "A", weight: 99.5 },
        { name: "B", weight: 0.5 },
      ]).ok,
      false,
    );
    assert.equal(
      validateRubric("Zero", [
        { name: "A", weight: 100 },
        { name: "B", weight: 0 },
      ]).ok,
      false,
    );
  });

  it("refuses more criteria than anybody marks consistently", () => {
    const many = Array.from({ length: 13 }, (_, i) => ({
      name: `C${i}`,
      weight: i === 0 ? 88 : 1,
    }));
    const result = validateRubric("Too many", many);

    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.error, /Twelve criteria/);
  });

  it("refuses an unnamed rubric", () => {
    assert.equal(validateRubric("", criteria(100)).ok, false);
  });
});

describe("rubric versioning", () => {
  it("allows editing in place while no evaluation exists", () => {
    assert.equal(requiresNewVersion(0), false);
  });

  it("requires a new version once ONE evaluation exists", () => {
    // One is enough: that evaluation's total came from these weights, and
    // changing them changes a mark that has already been given.
    assert.equal(requiresNewVersion(1), true);
  });

  it("explains the versioning rule with the actual numbers", () => {
    const notice = versionNotice(2);

    assert.match(notice, /creates version 3/);
    assert.match(notice, /rather than changing version 2/);
    assert.doesNotMatch(notice, /\{next\}|\{current\}/);
  });
});

describe("rubric templates", () => {
  it("every template's weights sum to 100", () => {
    // A shipped template that fails our own validator would be the worst
    // possible starting point.
    for (const template of RUBRIC_TEMPLATES) {
      const result = validateRubric(template.name, [...template.criteria]);
      assert.equal(result.ok, true, `${template.key}: ${result.ok ? "" : result.error}`);
    }
  });

  it("every criterion has one descriptor per score level", () => {
    for (const template of RUBRIC_TEMPLATES) {
      for (const criterion of template.criteria) {
        assert.equal(
          criterion.descriptors.length,
          SCORE_MAX,
          `${template.key}/${criterion.name} has ${criterion.descriptors.length} descriptors`,
        );
      }
    }
  });
});

/* -------------------------------------------------------------- scoring */

describe("totalFor", () => {
  const criteria: Criterion[] = [
    { id: "c1", name: "Problem", weight: 20 },
    { id: "c2", name: "Approach", weight: 50 },
    { id: "c3", name: "Results", weight: 30 },
  ];

  const score = (criterionId: string, value: number, memberId: string | null = null): Score => ({
    criterionId,
    memberId,
    score: value,
  });

  it("weights criteria rather than averaging them", () => {
    // Full marks on the 50-weight criterion, nothing on the others.
    const total = totalFor(criteria, [score("c1", 0), score("c2", SCORE_MAX), score("c3", 0)]);

    assert.equal(total.percent, 50);
    assert.equal(total.complete, true);
  });

  it("is 100 for full marks everywhere", () => {
    const total = totalFor(
      criteria,
      criteria.map((criterion) => score(criterion.id, SCORE_MAX)),
    );

    assert.equal(total.percent, 100);
  });

  it("normalises a partial evaluation by what has been scored", () => {
    // The failure this prevents: a half-marked evaluation showing 38% reads as
    // a fail rather than as unfinished, and somebody eventually releases one.
    const total = totalFor(criteria, [score("c2", SCORE_MAX)]);

    assert.equal(total.percent, 100);
    assert.equal(total.complete, false);
    assert.equal(total.scored, 1);
    assert.equal(total.of, 3);
  });

  it("is 0 with nothing scored, and not complete", () => {
    const total = totalFor(criteria, []);

    assert.equal(total.percent, 0);
    assert.equal(total.complete, false);
  });

  it("keeps a member's scores separate from the group's", () => {
    const scores: Score[] = [
      ...criteria.map((c) => score(c.id, SCORE_MAX)),
      ...criteria.map((c) => score(c.id, 1, "u1")),
    ];

    assert.equal(totalFor(criteria, scores, null).percent, 100);
    assert.equal(totalFor(criteria, scores, "u1").percent, 20);
  });
});

describe("deviation", () => {
  it("is positive when a member is above the group", () => {
    assert.equal(deviation(70, 82), 12);
  });

  it("ignores a rounding-sized difference", () => {
    // Two weighted totals rounded to whole percents produce one-point gaps out
    // of nothing. Demanding a justification for that teaches faculty to write
    // "n/a", which makes every real reason look like boilerplate.
    assert.equal(deviates(70, 71), false);
    assert.equal(deviates(70, 70 - DEVIATION_TOLERANCE), false);
  });

  it("catches a real difference in either direction", () => {
    assert.equal(deviates(70, 78), true);
    assert.equal(deviates(70, 62), true);
  });
});

describe("prefillMemberScores", () => {
  it("starts a member identical to the group", () => {
    // The opposite default — blank, fill in five sets — makes differentiating
    // expensive and identical marks free, which produces exactly the
    // undifferentiated marking the ledger exists to fix.
    const group: Score[] = [
      { criterionId: "c1", memberId: null, score: 4 },
      { criterionId: "c2", memberId: null, score: 3 },
    ];

    assert.deepEqual(prefillMemberScores(group, "u1"), [
      { criterionId: "c1", memberId: "u1", score: 4 },
      { criterionId: "c2", memberId: "u1", score: 3 },
    ]);
  });

  it("ignores other members' scores", () => {
    const scores: Score[] = [
      { criterionId: "c1", memberId: null, score: 4 },
      { criterionId: "c1", memberId: "u2", score: 1 },
    ];

    assert.equal(prefillMemberScores(scores, "u1").length, 1);
  });
});

describe("canRelease", () => {
  const criteria: Criterion[] = [
    { id: "c1", name: "Problem", weight: 50 },
    { id: "c2", name: "Results", weight: 50 },
  ];

  const full = (memberId: string | null = null, value = 4): Score[] =>
    criteria.map((criterion) => ({ criterionId: criterion.id, memberId, score: value }));

  const base = {
    criteria,
    scores: full(),
    members: [{ id: "u1", name: "Ananya Sharma" }],
    reasons: {},
    outcome: "ACCEPT" as string | null,
    comments: "Solid work throughout." as string | null,
  };

  it("POSITIVE CONTROL — releases a complete evaluation", () => {
    assert.deepEqual(canRelease(base), { ok: true });
  });

  it("names every unscored criterion", () => {
    const result = canRelease({ ...base, scores: [full()[0]!] });

    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.problems[0]!, /1 criterion is unscored: Results/);
  });

  it("requires an outcome", () => {
    const result = canRelease({ ...base, outcome: null });

    assert.equal(result.ok, false);
    assert.ok(result.ok || result.problems.some((p) => /Choose an outcome/.test(p)));
  });

  it("refuses to request changes without specifics", () => {
    // "Needs improvement" as an outcome helps nobody, and the spec names it as
    // the most likely failure mode if the form permits it.
    const result = canRelease({ ...base, outcome: "CHANGES", comments: "Needs improvement" });

    assert.equal(result.ok, false);
    assert.ok(result.ok || result.problems.some((p) => /needs specifics/.test(p)));
  });

  it("requires a reason when a member's mark deviates, naming the gap", () => {
    const result = canRelease({
      ...base,
      scores: [...full(), ...full("u1", 1)],
    });

    assert.equal(result.ok, false);
    assert.ok(
      result.ok || result.problems.some((p) => /Ananya Sharma's mark is 60 points below/.test(p)),
    );
  });

  it("requires a reason for raising a member too, not only for lowering", () => {
    // A form that only demanded justification for a penalty would quietly
    // encourage inflating everybody else.
    const result = canRelease({
      ...base,
      scores: [...full(null, 2), ...full("u1", 5)],
    });

    assert.equal(result.ok, false);
    assert.ok(result.ok || result.problems.some((p) => /points above/.test(p)));
  });

  it("accepts a deviation once a reason is given", () => {
    const result = canRelease({
      ...base,
      scores: [...full(), ...full("u1", 1)],
      reasons: {
        u1: "Contributed 4% of recorded activity and did not attend the last three meetings.",
      },
    });

    assert.deepEqual(result, { ok: true });
  });

  it("reports every problem at once, not the first", () => {
    const result = canRelease({
      ...base,
      scores: [full()[0]!],
      outcome: null,
    });

    assert.equal(result.ok, false);
    assert.ok(
      !result.ok && result.problems.length >= 2,
      "a release blocked one reason at a time is the shape people give up on",
    );
  });
});

/* ---------------------------------------------------------- attestation */

describe("attestationCode", () => {
  it("matches the printable pattern", () => {
    for (let i = 0; i < 50; i += 1) {
      const code = attestationCode();
      assert.match(code, CODE_PATTERN, `${code} is not a valid code`);
      assert.equal(isAttestationCode(code), true);
    }
  });

  it("contains no character that can be misread off a printed CV", () => {
    // Crockford's alphabet without I, L, O and U — no character confusable with
    // a digit, and none of them can accidentally spell anything.
    for (let i = 0; i < 50; i += 1) {
      assert.doesNotMatch(attestationCode(), /[ILOU]/);
    }
  });

  it("does not collide across many issues", () => {
    const codes = new Set(Array.from({ length: 2000 }, () => attestationCode()));
    assert.equal(codes.size, 2000);
  });

  it("rejects a malformed code", () => {
    assert.equal(isAttestationCode("NX-1234-5678"), false);
    assert.equal(isAttestationCode("hello"), false);
    assert.equal(isAttestationCode("NX-IIII-1111-2222"), false);
  });
});

describe("statement drafting", () => {
  const evidence = {
    memberName: "Ananya Sharma",
    projectTitle: "Scheduling canal water across multiple farms",
    role: "hardware lead",
    share: 0.41,
    tasksClosed: 12,
    filesContributed: 4,
    skills: ["Embedded C", "LoRaWAN", "Sensor calibration"],
  };

  it("states only what the record supports", () => {
    const draft = prefillContributionStatement(evidence);

    assert.match(draft, /12 closed tasks and 4 files contributed/);
    assert.match(draft, /41% of the group's recorded activity/);
  });

  it("uses no evaluative adjective the faculty member did not choose", () => {
    const draft = prefillContributionStatement(evidence);

    assert.doesNotMatch(draft, /excellent|outstanding|strong|impressive|exceptional|diligent/i);
  });

  it("says outright that it is a starting point", () => {
    assert.match(prefillContributionStatement(evidence), /an attestation is what you know/);
    assert.match(
      prefillProjectStatement({
        projectTitle: "A project",
        memberCount: 4,
        completeSections: 7,
        totalSections: 9,
        milestonesClosed: 3,
        hasPrototype: true,
        hasResults: true,
      }),
      /what you personally observed/,
    );
  });

  it("gets the article right for a vowel-initial role", () => {
    assert.match(
      prefillContributionStatement({ ...evidence, role: "embedded engineer" }),
      /as an embedded engineer/,
    );
    assert.match(prefillContributionStatement(evidence), /as a hardware lead/);
  });

  it("omits the activity line when there is nothing recorded", () => {
    const draft = prefillContributionStatement({
      ...evidence,
      tasksClosed: 0,
      filesContributed: 0,
    });

    assert.doesNotMatch(draft, /The workspace records/);
  });
});

describe("validateStatement", () => {
  it("POSITIVE CONTROL — accepts a real sentence", () => {
    assert.deepEqual(
      validateStatement(
        "Ananya designed and implemented the sensor calibration routine, which I saw demonstrated in the lab on 12 March.",
      ),
      { ok: true },
    );
  });

  it("refuses a statement that is still the draft", () => {
    // The precise failure the spec warns about: an automatically generated
    // attestation wearing a human's name.
    const draft = prefillContributionStatement({
      memberName: "Ananya Sharma",
      projectTitle: "A project",
      role: "lead",
      share: 0.4,
      tasksClosed: 5,
      filesContributed: 2,
      skills: [],
    });

    const result = validateStatement(draft);
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.error, /draft prompt is still in the text/);
  });

  it("refuses a one-word attestation", () => {
    assert.equal(validateStatement("Good.").ok, false);
  });

  it("refuses an essay", () => {
    assert.equal(validateStatement("a".repeat(2001)).ok, false);
  });
});

describe("validateRevocation", () => {
  it("requires a reason, because the record is kept rather than deleted", () => {
    assert.equal(validateRevocation("").ok, false);
    assert.equal(validateRevocation("oops").ok, false);
    assert.equal(validateRevocation("Issued against the wrong member of the group.").ok, true);
  });
});

describe("attributionLine", () => {
  const issued = new Date("2026-03-12T00:00:00Z");

  it("names the attester, their designation and the date", () => {
    const line = attributionLine({
      attesterName: "Dr Anand Krishnan",
      designation: "Associate Professor",
      collegeName: "NIT Pune",
      issuedAt: issued,
      revokedAt: null,
    });

    assert.match(
      line,
      /Attested by Dr Anand Krishnan, Associate Professor, NIT Pune on 12 March 2026/,
    );
  });

  it("works without a designation", () => {
    const line = attributionLine({
      attesterName: "Dr Anand Krishnan",
      designation: null,
      collegeName: "NIT Pune",
      issuedAt: issued,
      revokedAt: null,
    });

    assert.match(line, /Dr Anand Krishnan, NIT Pune/);
  });

  it("says so when revoked, rather than hiding it", () => {
    const line = attributionLine({
      attesterName: "Dr Anand Krishnan",
      designation: null,
      collegeName: "NIT Pune",
      issuedAt: issued,
      revokedAt: new Date("2026-06-01T00:00:00Z"),
    });

    assert.match(line, /revoked 1 June 2026/);
  });
});
