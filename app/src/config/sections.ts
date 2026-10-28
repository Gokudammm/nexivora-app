import type { $Enums } from "@prisma/client";

/**
 * THE NINE SECTIONS, AND WHAT TO WRITE IN EACH.
 *
 * The phase spec calls the per-section guidance *"worth more than it looks"*,
 * and it is right for a reason that has nothing to do with software: **the
 * blank page is the real obstacle.** Most students have never written a
 * methodology section, have no model of what one contains, and produce either
 * three sentences or four pages of narrative — not because they cannot write,
 * but because nobody has ever told them what the section is *for*.
 *
 * So each one carries three things:
 *
 *  · **`prompt`** — what belongs here, in one sentence.
 *  · **`asks`** — the two or three questions a good section answers. These are
 *    the actual scaffolding; a student who answers them has written the section.
 *  · **`example`** — a real opening line. Not a template with blanks, which
 *    produces fill-in-the-blank prose, but a sentence that demonstrates the
 *    register and the level of specificity expected.
 *
 * `minWords` is a floor for *completeness*, never a target. It exists so
 * "complete" means something when progress is computed, and it is deliberately
 * low: a tight 80-word problem statement is better than a padded 300-word one,
 * and a floor that rewarded length would produce padding.
 */

export type SectionSpec = {
  kind: $Enums.SectionKind;
  label: string;
  prompt: string;
  asks: readonly string[];
  example: string;
  /** Below this, the section cannot be marked complete. */
  minWords: number;
  /**
   * Required before a project may be submitted. The four that are not required
   * are the ones a project can legitimately lack — not every project builds a
   * prototype, and future work is genuinely optional.
   */
  required: boolean;
};

export const SECTIONS: readonly SectionSpec[] = [
  {
    kind: "PROBLEM",
    label: "Problem statement",
    prompt:
      "The specific problem you are solving, who has it, and what it costs them today. Not the solution.",
    asks: [
      "Who has this problem, specifically?",
      "What do they do about it now, and why is that inadequate?",
      "How would you know if it were solved?",
    ],
    example:
      "Farmers on the Mula-Mutha canal network receive water on a rotational schedule set two weeks in advance, so an unexpected rain event means a wasted turn that cannot be reclaimed.",
    minWords: 60,
    required: true,
  },
  {
    kind: "RESEARCH",
    label: "Background research",
    prompt: "What already exists, what it gets right, and the specific gap your work addresses.",
    asks: [
      "What are the two or three closest existing approaches?",
      "Why does each one not solve the problem as you have stated it?",
      "What did you read that changed how you framed the problem?",
    ],
    example:
      "Commercial soil-moisture systems (Netafim, Rivulis) assume a pressurised drip network and cost upwards of ₹40,000 per hectare, which rules them out for the 0.4-hectare median holding in this district.",
    minWords: 80,
    required: true,
  },
  {
    kind: "SOLUTION",
    label: "Proposed solution",
    prompt: "What you built or propose to build, and why this approach rather than another.",
    asks: [
      "What is the thing, in two sentences?",
      "Which approach did you choose over which alternative, and on what grounds?",
      "What does it deliberately not do?",
    ],
    example:
      "A battery-powered sensor node reporting soil moisture over LoRaWAN to a scheduling service that reallocates unused canal turns within the same rotation block.",
    minWords: 80,
    required: true,
  },
  {
    kind: "METHODOLOGY",
    label: "Methodology",
    prompt:
      "How you did the work, in enough detail that somebody else could repeat it and get your result.",
    asks: [
      "What were the steps, in order?",
      "What data did you use, and where did it come from?",
      "What did you decide to measure, and why that?",
    ],
    example:
      "Sensors were calibrated against gravimetric samples taken at three depths on five plots, with readings logged every fifteen minutes over a nine-week period covering both irrigated and rain-fed turns.",
    minWords: 100,
    required: true,
  },
  {
    kind: "PROTOTYPE",
    label: "Prototype",
    prompt: "What you actually built: architecture, components, and the decisions that shaped it.",
    asks: [
      "What are the parts, and how do they fit together?",
      "What was harder to build than expected?",
      "What is held together with tape, and what is solid?",
    ],
    example:
      "The node is an ESP32 with a capacitive moisture probe and an RFM95 radio, running on a 3.7V 2000mAh cell with a measured 41-day duty cycle at fifteen-minute reporting.",
    minWords: 60,
    required: false,
  },
  {
    kind: "TESTING",
    label: "Testing",
    prompt: "How you tested it, what you tested against, and what failed.",
    asks: [
      "What was your baseline or control?",
      "How many trials, over what period, under what conditions?",
      "What went wrong, and what did you change?",
    ],
    example:
      "Readings were compared against gravimetric ground truth on 120 paired samples; the first calibration curve was 14% high in clay soils and was refitted per soil type.",
    minWords: 60,
    required: true,
  },
  {
    kind: "RESULTS",
    label: "Results",
    prompt: "What you found, with numbers. The honest version, including what did not work.",
    asks: [
      "What are the headline numbers, with their units and their error?",
      "How do they compare to the baseline?",
      "What result surprised you?",
    ],
    example:
      "Mean absolute error against gravimetric ground truth was 3.1% volumetric water content (n=120), against 8.4% for the uncalibrated manufacturer curve.",
    minWords: 60,
    required: true,
  },
  {
    kind: "CONCLUSION",
    label: "Conclusion",
    prompt:
      "What this work establishes, what it does not, and what you would tell somebody starting here.",
    asks: [
      "What can now be claimed that could not before?",
      "What are the honest limits of the result?",
      "Was the original problem actually addressed?",
    ],
    example:
      "Rotational reallocation recovered 11% of scheduled water volume across the trial block, which is meaningful at district scale but was measured over a single season on one soil type.",
    minWords: 60,
    required: true,
  },
  {
    kind: "FUTURE_WORK",
    label: "Future work",
    prompt: "What the next group should do. This is the section the next batch actually reads.",
    asks: [
      "What is the single most valuable next experiment?",
      "What would you do differently with the time again?",
      "What is left that you ran out of time for?",
    ],
    example:
      "Calibration drift across a full monsoon season is unmeasured and is the obvious next study; a second season on black cotton soil would test the per-soil-type curves properly.",
    minWords: 40,
    required: false,
  },
];

export const SECTION_BY_KIND = Object.fromEntries(
  SECTIONS.map((section) => [section.kind, section]),
) as Record<$Enums.SectionKind, SectionSpec>;

export const SECTION_ORDER: readonly $Enums.SectionKind[] = SECTIONS.map((s) => s.kind);

/** Sections that must be complete before a project can be submitted. */
export const REQUIRED_SECTIONS: readonly $Enums.SectionKind[] = SECTIONS.filter(
  (section) => section.required,
).map((section) => section.kind);

/** Words, counted the way a person would — whitespace-separated runs. */
export function countWords(body: string): number {
  const trimmed = body.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/**
 * How long a soft lock lasts.
 *
 * A lock is a courtesy, not a mutex: it tells the second person that somebody
 * else is in this section right now. It expires because the alternative — a
 * lock held by a closed browser tab — turns a courtesy into an obstruction,
 * and there is no unlock button anybody would find.
 */
export const SECTION_LOCK_MINUTES = 10;
