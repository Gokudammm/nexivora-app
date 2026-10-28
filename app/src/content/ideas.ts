import type { Idea } from "@/content/types";

/**
 * The Idea Hub.
 *
 * This is a major SEO surface, not a minor feature: *"final year project ideas
 * for CSE"* is one of the highest-volume queries in this space, and the results
 * for it today are thin listicles. A hub of **real, claimable ideas with a
 * status and a named poster** is a genuinely better answer.
 *
 * Which means these must be real ideas with a real problem statement. A thin
 * generated idea page would be exactly the doorway-page pattern the spam policy
 * prohibits (docs/SEO-CHECKLIST.md §12).
 *
 * Every status in the ladder is represented, and one idea has `becameProject`
 * set — so the hub shows outcomes, not only intentions.
 */
export const ideas: Idea[] = [
  {
    slug: "canteen-food-waste-tracking",
    title: "Measure and reduce canteen food waste",
    summary:
      "Weigh what comes back on plates, correlate it with the menu, and cut over-preparation.",
    problem:
      "The campus canteen prepares to a fixed estimate and discards what is left. Nobody measures how much, so nobody can argue for changing the estimate. Anecdotally it is a large amount on days when a particular dish is served.",
    approach:
      "A load cell under the plate-return counter logging weight per return, correlated with the day's menu. After a few weeks there is enough data to predict demand per dish and adjust preparation. The measurement alone is probably the valuable part.",
    status: "LOOKING_FOR_TEAM",
    domain: "sustainability",
    topics: ["sustainability", "iot"],
    sdgs: [12, 2],
    skillsNeeded: ["Embedded C", "Data analysis", "Basic mechanical fabrication"],
    teamSizeWanted: 3,
    commitment: "moderate",
    postedBy: "rohit-verma",
    collegeSlug: "nexivora-institute-of-technology",
    postedOn: "2026-08-14",
    interestedCount: 7,
  },
  {
    slug: "sign-language-classroom-captioning",
    title: "Live captioning for deaf students in lectures",
    summary:
      "On-device live captioning of lectures, tuned for classroom audio and code-mixed speech.",
    problem:
      "There are deaf and hard-of-hearing students in our department and no captioning provision. Existing live-captioning services need a connection and handle code-mixed English-Hindi lecturing poorly, which is how most classes here are actually taught.",
    approach:
      "Build on the offline transcription work already done in the department, but for live audio with a latency target rather than batch processing. The hard parts are latency and code-mixing, and the second is unsolved.",
    status: "LOOKING_FOR_TEAM",
    domain: "social",
    topics: ["social-impact", "assistive-tech", "nlp"],
    sdgs: [4, 10],
    skillsNeeded: ["Speech recognition", "Real-time systems", "Accessibility testing"],
    teamSizeWanted: 4,
    commitment: "intensive",
    postedBy: "sneha-iyer",
    collegeSlug: "nexivora-institute-of-technology",
    postedOn: "2026-07-30",
    interestedCount: 12,
  },
  {
    slug: "groundwater-recharge-mapping",
    title: "Map groundwater recharge potential on campus",
    summary:
      "Combine soil, slope and rainfall data to identify where recharge structures would actually help.",
    problem:
      "Recharge pits get built where there is space, not where they would recharge most. Nobody has mapped the actual potential across the campus, so siting is guesswork.",
    approach:
      "Use publicly available soil and elevation data with local rainfall records to produce a recharge-potential surface, then validate against a few test pits. Mostly a GIS and data problem rather than a hardware one.",
    status: "IDEA",
    domain: "sustainability",
    topics: ["sustainability", "water"],
    sdgs: [6, 15, 13],
    skillsNeeded: ["GIS / QGIS", "Python", "Hydrology basics"],
    teamSizeWanted: 3,
    commitment: "moderate",
    postedBy: "ananya-sharma",
    collegeSlug: "nexivora-institute-of-technology",
    postedOn: "2026-08-22",
    interestedCount: 4,
  },
  {
    slug: "affordable-spirometer",
    title: "A low-cost spirometer for rural screening",
    summary: "Turbine-based lung-function measurement at a fraction of clinical instrument cost.",
    problem:
      "Chronic respiratory disease is widespread and under-diagnosed. A clinical spirometer costs well beyond a primary health centre's budget, so lung function is rarely measured outside a hospital.",
    approach:
      "A turbine flow sensor with a calibrated pressure transducer, validated against a clinical spirometer. The engineering challenge is calibration stability and hygiene between users, not the measurement itself.",
    status: "IN_DEVELOPMENT",
    domain: "healthcare",
    topics: ["healthcare", "medical-devices"],
    sdgs: [3, 10],
    skillsNeeded: ["Sensor calibration", "Embedded C", "Clinical validation"],
    teamSizeWanted: 4,
    commitment: "intensive",
    postedBy: "priya-nair",
    collegeSlug: "nexivora-institute-of-technology",
    postedOn: "2026-02-11",
    interestedCount: 9,
  },
  {
    slug: "campus-accessibility-audit-map",
    title: "Crowd-sourced accessibility map of the campus",
    summary: "Let students record where a wheelchair user actually cannot go, and route around it.",
    problem:
      "The campus is officially accessible. In practice several routes have a step, a broken ramp or a locked lift, and a wheelchair user discovers each one by arriving at it.",
    approach:
      "A simple reporting app plus a routing layer that prefers verified-accessible paths. The routing is straightforward; getting enough reports and keeping them current is the real problem.",
    status: "LOOKING_FOR_TEAM",
    domain: "social",
    topics: ["social-impact", "civic-tech", "assistive-tech"],
    sdgs: [10, 11],
    skillsNeeded: ["Mobile development", "Mapping / routing", "User research"],
    teamSizeWanted: 3,
    commitment: "light",
    postedBy: "karan-mehta",
    collegeSlug: "nexivora-institute-of-technology",
    postedOn: "2026-08-05",
    interestedCount: 6,
  },
  {
    slug: "solar-dryer-monitoring",
    title: "Instrument a solar dryer to prove it works",
    summary:
      "Log temperature and moisture through a drying cycle so the design can actually be compared.",
    problem:
      "Several solar dryer designs are promoted for small farms and their claimed performance is rarely measured under real conditions. Without instrumentation, comparing two designs is opinion.",
    approach:
      "Instrument two dryer designs with temperature, humidity and mass logging through complete drying cycles for the same produce, and publish the comparison openly.",
    status: "IDEA",
    domain: "sustainability",
    topics: ["sustainability", "agritech", "renewable-energy"],
    sdgs: [2, 7, 12],
    skillsNeeded: ["Instrumentation", "Data logging", "Experimental design"],
    teamSizeWanted: 2,
    commitment: "light",
    postedBy: "rohit-verma",
    collegeSlug: "nexivora-institute-of-technology",
    postedOn: "2026-09-01",
    interestedCount: 3,
  },
  {
    slug: "regional-language-ocr-forms",
    title: "OCR for handwritten Devanagari forms",
    summary: "Digitise handwritten form entries so rural records stop being retyped by hand.",
    problem:
      "Village-level records are filled by hand in Devanagari and later retyped into a system by an operator, which is slow and introduces errors nobody catches.",
    approach:
      "Handwritten Devanagari recognition constrained to known form fields, which is a much easier problem than general handwriting because the field tells you what kind of value to expect.",
    status: "TESTING",
    domain: "ai",
    topics: ["ai-ml", "computer-vision", "civic-tech"],
    sdgs: [16, 10, 9],
    skillsNeeded: ["Computer vision", "Data annotation", "Python"],
    teamSizeWanted: 4,
    commitment: "intensive",
    postedBy: "sneha-iyer",
    collegeSlug: "nexivora-institute-of-technology",
    postedOn: "2026-01-28",
    interestedCount: 11,
  },
  {
    slug: "lab-equipment-booking",
    title: "Replace the paper lab register",
    summary:
      "Shared instruments booked on paper mean nobody can see availability without walking there.",
    problem:
      "Eleven shared instruments are booked on a paper register in the lab. Checking availability means going there, and there is no usage record at all.",
    approach:
      "A booking system with per-instrument access rules and automatic release of no-show slots.",
    status: "COMPLETED",
    domain: "software",
    topics: ["software", "web-platforms"],
    sdgs: [4, 9],
    skillsNeeded: ["Full-stack development", "Data modelling"],
    teamSizeWanted: 2,
    commitment: "moderate",
    postedBy: "arjun-rao",
    collegeSlug: "nexivora-institute-of-technology",
    postedOn: "2025-07-30",
    interestedCount: 8,
    becameProject: "lab-slot-booking-system",
  },
  {
    slug: "bicycle-sharing-campus",
    title: "A deposit-free bicycle share for the campus",
    summary: "Track cycles with cheap tags rather than locks, and see whether trust is enough.",
    problem:
      "The campus is large enough that walking between the far blocks costs fifteen minutes. A previous cycle-share attempt failed because cycles were not returned.",
    approach:
      "Low-cost BLE tags and reader points at each block, so a cycle's last known location is always visible. The interesting question is behavioural rather than technical: does visibility alone change return rates?",
    status: "IDEA",
    domain: "hardware",
    topics: ["hardware-iot", "iot", "civic-tech"],
    sdgs: [11, 13],
    skillsNeeded: ["BLE / embedded", "Backend", "Behavioural study design"],
    teamSizeWanted: 3,
    commitment: "moderate",
    postedBy: "dev-patel",
    collegeSlug: "nexivora-institute-of-technology",
    postedOn: "2026-08-28",
    interestedCount: 5,
  },
  {
    slug: "exam-timetable-conflict-solver",
    title: "An exam timetable with no student clashes",
    summary:
      "The current timetable is built by hand and every year some students sit two papers at once.",
    problem:
      "Exam scheduling is done manually against a spreadsheet of course registrations. Every semester a handful of students end up with two papers in the same slot and it is resolved case by case, late.",
    approach:
      "Model it as graph colouring over the actual registration data. The constraint set is the hard part — room capacity, invigilator availability and minimum gaps all matter and are currently unwritten.",
    status: "LOOKING_FOR_TEAM",
    domain: "software",
    topics: ["software", "web-platforms"],
    sdgs: [4],
    skillsNeeded: ["Constraint solving", "Python", "Data modelling"],
    teamSizeWanted: 2,
    commitment: "moderate",
    postedBy: "arjun-rao",
    collegeSlug: "meridian-college-of-engineering",
    postedOn: "2026-08-18",
    interestedCount: 6,
  },
];

export const ideaBySlug = Object.fromEntries(ideas.map((i) => [i.slug, i])) as Record<string, Idea>;

export const IDEA_STATUS_LABEL: Record<Idea["status"], string> = {
  IDEA: "Idea",
  LOOKING_FOR_TEAM: "Looking for team",
  IN_DEVELOPMENT: "In development",
  TESTING: "Testing",
  COMPLETED: "Completed",
};
