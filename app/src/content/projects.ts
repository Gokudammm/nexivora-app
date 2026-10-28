import type { Project, ProjectSection, SectionKind } from "@/content/types";

/**
 * Demo projects.
 *
 * These are written, not generated. They are simultaneously:
 *   - the SEO thesis under test (docs/CONTEXT.md §5) — a real, documented
 *     student project page is better content than anything currently ranking
 *     for the enormous Indian query space around student projects;
 *   - the demo; and
 *   - the contract Phase 3's schema must satisfy.
 *
 * Deliberate structure, so later phases have something real to work against:
 *
 *   - **A three-level lineage chain**: `smart-irrigation-soil-moisture` →
 *     `irrigation-forecast-lstm` → `canal-scheduling-multi-farm`. The Phase 12
 *     lineage tree is not a single node.
 *   - **A near-duplicate** (`soil-moisture-irrigation-control`) of the archived
 *     root, so Phase 8's similarity check demonstrably fires rather than being
 *     taken on trust. It is `proposed` and unapproved, so it is not public.
 *   - **An embargoed project** (`battery-second-life-grading`) — listed and
 *     citable, body withheld. A patentable project cannot be public before filing.
 *   - **A private project** (`attendance-face-recognition`) that must never
 *     reach the sitemap.
 *   - **A project at an unverified college** (`microplastic-optical-detection`)
 *     that must never reach any public surface.
 *
 * `scripts/check-seo.mjs` asserts the last three stay out of the sitemap.
 */

const s = (kind: SectionKind, body: string): ProjectSection => ({ kind, body });

export const projects: Project[] = [
  /* ------------------------------------------------ lineage root (level 1) */
  {
    slug: "smart-irrigation-soil-moisture",
    title: "Smart irrigation using soil-moisture sensing",
    summary:
      "A solar-powered sensor node that waters a field only when the soil actually needs it, cutting water use by a third.",
    abstract:
      "Field irrigation on the campus farm ran on a fixed timer, watering regardless of rainfall or soil condition. This project built a low-cost soil-moisture node that triggers a solenoid valve from live readings. Over one season it reduced water use by 34% with no measurable effect on yield.",
    status: "archived",
    visibility: "PUBLIC",
    approved: true,
    collegeSlug: "nexivora-institute-of-technology",
    department: "Computer Science & Engineering",
    subject: "Minor Project",
    term: "Odd 2024-25",
    domain: "sustainability",
    topics: ["sustainability", "agritech", "iot"],
    sdgs: [6, 2, 13],
    techStack: ["ESP32", "Capacitive soil sensor", "LoRa", "Python", "SQLite"],
    keywords: [
      "smart irrigation",
      "soil moisture sensor",
      "water conservation",
      "agritech project",
    ],
    members: [
      {
        username: "ananya-sharma",
        role: "Data & firmware",
        tier: "attested",
        attestedBy: "Dr Meera Rao",
      },
      {
        username: "rohit-verma",
        role: "Hardware & deployment",
        tier: "attested",
        attestedBy: "Prof. Sunil Deshpande",
      },
    ],
    facultyGuide: "Dr Meera Rao",
    startedOn: "2024-08-05",
    completedOn: "2024-12-18",
    publishedOn: "2025-01-09",
    citationId: "NXV-NITP-2024-4K7QA2",
    repositoryUrl: "https://github.com/example-ananya/smart-irrigation",
    metrics: [
      { label: "Water saved", value: "34%" },
      { label: "Deployment", value: "1 season, 0.4 ha" },
      { label: "Node cost", value: "₹2,150" },
    ],
    sections: [
      s(
        "PROBLEM",
        "The campus farm irrigates on a fixed timer: forty minutes, twice a day, every day. It runs during rainfall and it runs when the soil is already saturated.\n\nThe farm supervisor estimated the waste at a third of total water use but had no measurement to support it. Commercial soil-moisture controllers exist and start around ₹40,000 per zone, which is not a realistic purchase for a teaching farm.\n\n- No feedback between soil condition and the valve\n- No record of how much water is actually used\n- Existing controllers priced for commercial agriculture, not for a 0.4 ha plot",
      ),
      s(
        "RESEARCH",
        "We reviewed capacitive versus resistive soil-moisture sensing. Resistive probes are cheaper but corrode within weeks in wet soil; every field report we found described drift within a single season. Capacitive probes cost more and last.\n\nOn communication, we compared Wi-Fi, GSM and LoRa. The farm has no Wi-Fi coverage and a GSM module would need a recurring SIM cost. LoRa reaches the department building 380 m away and costs nothing to run.\n\nWe also read the FAO guidance on irrigation scheduling, which sets field capacity and permanent wilting point as the practical bounds — that gave us the thresholds rather than us inventing them.",
      ),
      s(
        "SOLUTION",
        "A battery-and-solar sensor node buried at root depth, reporting soil moisture every fifteen minutes over LoRa to a gateway in the department building. When moisture drops below the configured threshold, the gateway opens a solenoid valve until the reading recovers.\n\nThe design priority was survivability, not sophistication. It has to work unattended through a monsoon, so the enclosure and the power budget received more attention than the control logic — which is deliberately a simple threshold with hysteresis.",
      ),
      s(
        "METHODOLOGY",
        "1. Calibrated three candidate capacitive sensors against oven-dried soil samples from the plot itself, because generic calibration curves assume a soil composition we do not have.\n2. Built the node on ESP32 with a 2 W solar panel and an 18650 cell, targeting a 30-day reserve with no sun.\n3. Deployed two nodes at 20 cm and 40 cm depth in a single zone, plus a control zone left on the existing timer.\n4. Logged both zones for a full rabi season, measuring water at the inlet with an inline flow meter.\n5. Recorded crop yield per zone at harvest with the farm supervisor.",
      ),
      s(
        "PROTOTYPE",
        "Three revisions.\n\nRevision 1 failed in week two: the first enclosure was IP54 and water reached the board during the first heavy rain. Revision 2 moved to a potted IP67 enclosure with a breathable vent, which held.\n\nRevision 3 addressed power. The original firmware kept the LoRa radio awake between transmissions and drained the cell in nine days. Deep-sleep between readings took idle draw from 78 mA to 0.9 mA and the 30-day target became comfortable.",
      ),
      s(
        "TESTING",
        "Sensor accuracy was validated against gravimetric sampling: twelve paired readings across the moisture range, mean absolute error 2.4% volumetric water content.\n\nThe communication link was tested at range with the gateway in place — 380 m through one building line-of-sight obstruction, 100% packet delivery over 6,200 transmissions with a spreading factor of 9.\n\nThe control loop ran unattended for 104 days. Two interventions were needed, both to clear silt from the valve inlet, neither caused by the electronics.",
      ),
      s(
        "RESULTS",
        "Over the season the sensed zone used **34% less water** than the timer-controlled control zone (measured at the inlet: 61,200 L versus 92,700 L).\n\nYield differed by 1.8% in favour of the sensed zone, which is inside the variation the farm supervisor sees between plots anyway — so the honest claim is *no measurable yield penalty*, not an improvement.\n\nTotal node cost was ₹2,150 against roughly ₹40,000 for the cheapest commercial controller we could find.",
      ),
      s(
        "CONCLUSION",
        "Threshold-based moisture control is enough to capture most of the available saving. The engineering that mattered was not the algorithm — it was the enclosure, the power budget and the site-specific calibration.\n\nThe main limitation is that one node represents one zone. Soil varies across the plot and we did not characterise that variation; a single sensor in a heterogeneous field will over- or under-water parts of it.",
      ),
      s(
        "FUTURE_WORK",
        "- Forecast demand rather than reacting to a threshold, so the valve opens ahead of stress rather than after it\n- Characterise spatial variation across the plot before adding nodes\n- Integrate a rainfall forecast so the system does not water hours before predicted rain",
      ),
    ],
  },

  /* ---------------------------------------------------- lineage (level 2) */
  {
    slug: "irrigation-forecast-lstm",
    title: "Forecasting irrigation demand from soil and weather data",
    summary:
      "Extends the campus irrigation node from reacting to a threshold to forecasting demand 24 hours ahead.",
    abstract:
      "The 2024 smart-irrigation project reacted to soil moisture after it crossed a threshold, which means the crop is already under mild stress when watering begins. This project adds a 24-hour forecast from soil, weather and evapotranspiration data, moving the valve decision ahead of the stress event.",
    status: "completed",
    visibility: "PUBLIC",
    approved: true,
    collegeSlug: "nexivora-institute-of-technology",
    department: "Computer Science & Engineering",
    subject: "Major Project",
    term: "Odd 2025-26",
    domain: "sustainability",
    topics: ["sustainability", "agritech", "predictive-modelling"],
    sdgs: [6, 2, 13],
    techStack: ["Python", "PyTorch", "Pandas", "ESP32", "FastAPI"],
    keywords: ["irrigation forecasting", "LSTM", "evapotranspiration", "agritech machine learning"],
    members: [
      {
        username: "ananya-sharma",
        role: "Modelling & evaluation",
        tier: "attested",
        attestedBy: "Dr Meera Rao",
      },
      { username: "rohit-verma", role: "Data pipeline & firmware", tier: "evidenced" },
    ],
    facultyGuide: "Dr Meera Rao",
    startedOn: "2025-07-21",
    completedOn: "2025-12-05",
    publishedOn: "2025-12-20",
    citationId: "NXV-NITP-2025-8M2XR7",
    buildsOn: [
      {
        slug: "smart-irrigation-soil-moisture",
        kind: "EXTENDS",
        note: "Uses the same deployed nodes and the season of logged data they produced. The hardware is unchanged; the control decision is what this project replaces.",
      },
    ],
    metrics: [
      { label: "Forecast MAE", value: "3.1% VWC" },
      { label: "Additional water saved", value: "11%" },
      { label: "Training data", value: "1 season, 14k readings" },
    ],
    sections: [
      s(
        "PROBLEM",
        "Threshold control is reactive by definition: the valve opens once moisture has already fallen below the comfortable range, so the crop spends some hours under mild stress on every cycle.\n\nIt also cannot anticipate rain. During the 2024 deployment the system watered on three occasions within six hours of significant rainfall, which is pure waste.",
      ),
      s(
        "RESEARCH",
        "We reviewed the standard FAO-56 Penman-Monteith reference evapotranspiration method, which is the established way to estimate crop water demand from weather variables. It is well-validated but needs inputs we do not measure directly on site.\n\nOn the modelling side we compared ARIMA, gradient boosting and an LSTM. Published work on soil-moisture forecasting reports LSTMs performing well at 24–72 hour horizons where the series has strong daily periodicity, which ours does.",
      ),
      s(
        "SOLUTION",
        "A 24-hour soil-moisture forecast, trained on the season of node data from the 2024 project combined with the nearest IMD weather station and a computed reference evapotranspiration term.\n\nThe valve decision moves from *is moisture below threshold now* to *is moisture predicted to fall below threshold within the next 24 hours, and is rain not forecast*.",
      ),
      s(
        "METHODOLOGY",
        "1. Assembled 14,000 fifteen-minute readings from the two 2024 nodes with matched hourly weather.\n2. Computed reference evapotranspiration per FAO-56 from temperature, humidity, wind and solar radiation.\n3. Trained a two-layer LSTM on a 72-hour input window predicting 24 hours ahead.\n4. Held out the final 20% of the season chronologically — **not** a random split, because a random split on a time series leaks future information into training and produces a flattering, meaningless score.\n5. Compared against two baselines: persistence, and the 2024 threshold controller replayed on the same data.",
      ),
      s(
        "PROTOTYPE",
        "The model runs on the gateway rather than the node, as a FastAPI service polled every hour. The node firmware is unchanged from 2024 — it still reports moisture and accepts a valve command, which is what made building on the previous project practical rather than a rewrite.",
      ),
      s(
        "TESTING",
        "On the held-out period the forecast achieved a mean absolute error of 3.1% volumetric water content at 24 hours, against 5.8% for persistence.\n\nReplaying the season, the forecast controller would have avoided all three rain-adjacent watering events and would have started each cycle a mean of 4.2 hours earlier.\n\nWe also tested degradation: with the weather feed unavailable the model falls back to soil-only input, where MAE rises to 4.6% — worse, but still better than persistence, so a feed outage does not break the system.",
      ),
      s(
        "RESULTS",
        "Simulated over the held-out period, forecast-driven control used **11% less water** than the 2024 threshold controller, which was itself 34% below the fixed timer.\n\nWe are careful about this number: it is a replay against logged data, not a second field season. A live deployment is the honest test and it has not happened yet.",
      ),
      s(
        "CONCLUSION",
        "Forecasting adds a real but second-order saving on top of sensing. The larger gain was already captured by measuring the soil at all.\n\nThe most useful outcome was structural rather than numerical: because the previous group documented their calibration and left a clean season of data, this project spent its time on the model instead of rebuilding the sensing.",
      ),
      s(
        "FUTURE_WORK",
        "- A live field season to replace the replay evaluation\n- Extend from one zone to a multi-zone schedule under a shared water budget\n- Test whether a simpler gradient-boosted model matches the LSTM, which would be far cheaper to run on the gateway",
      ),
    ],
  },

  /* ---------------------------------------------------- lineage (level 3) */
  {
    slug: "canal-scheduling-multi-farm",
    title: "Scheduling canal water across multiple farms",
    summary:
      "Takes single-plot irrigation forecasting to a village scale, allocating a fixed canal release across eleven farms.",
    abstract:
      "Where the previous two projects optimised water on one plot, this one addresses allocation: a canal release is fixed and shared, so saving water on one farm is only useful if the schedule reallocates it. This project builds a constrained scheduler over per-farm demand forecasts and tests it against a village canal committee's existing rota.",
    status: "completed",
    visibility: "PUBLIC",
    approved: true,
    collegeSlug: "nexivora-institute-of-technology",
    department: "Computer Science & Engineering",
    subject: "Major Project",
    term: "Even 2025-26",
    domain: "sustainability",
    topics: ["sustainability", "water", "predictive-modelling"],
    sdgs: [6, 2, 11],
    techStack: ["Python", "OR-Tools", "PostgreSQL", "React"],
    keywords: [
      "canal scheduling",
      "water allocation",
      "irrigation optimisation",
      "shared water budget",
    ],
    members: [
      {
        username: "ananya-sharma",
        role: "Optimisation & evaluation",
        tier: "attested",
        attestedBy: "Dr Meera Rao",
      },
      { username: "sneha-iyer", role: "Interface & field interviews", tier: "evidenced" },
      { username: "dev-patel", role: "Flow measurement", tier: "evidenced" },
    ],
    facultyGuide: "Dr Meera Rao",
    startedOn: "2026-01-12",
    completedOn: "2026-05-08",
    publishedOn: "2026-05-22",
    citationId: "NXV-NITP-2026-2P9WL4",
    buildsOn: [
      {
        slug: "irrigation-forecast-lstm",
        kind: "BUILDS_ON",
        note: "Uses the demand forecast directly as the per-farm input. Without a forecast there is nothing to schedule against, so this project starts where that one stopped.",
      },
    ],
    metrics: [
      { label: "Farms scheduled", value: "11" },
      { label: "Unmet demand reduced", value: "23%" },
      { label: "Committee adoption", value: "Trial, 1 season" },
    ],
    sections: [
      s(
        "PROBLEM",
        "A canal release is a fixed volume on a fixed day. The village committee allocates it by a rota that has not changed in years: each farm gets a slot by position on the canal, regardless of what its crop currently needs.\n\nFarms at the tail of the canal reported receiving less than their allocation, and nobody had measurement to confirm or refute it. Saving water on one plot is meaningless here unless the schedule reallocates the saving to a farm that needs it.",
      ),
      s(
        "RESEARCH",
        "We interviewed the canal committee and seven farmers. The most useful finding was social rather than technical: any schedule that cannot be explained in one sentence to the affected farmer will not be accepted, regardless of how optimal it is.\n\nWe reviewed water-allocation literature, which mostly models this as a linear program with fairness constraints. The published work assumes metering we do not have, so a large part of this project became estimating flow rather than optimising it.",
      ),
      s(
        "SOLUTION",
        "A constrained scheduler that takes the fixed release volume, a 24-hour demand forecast per farm, and the canal's physical transit times, and produces a slot allocation.\n\nCrucially it produces a **reason** per allocation — 'your slot moved later because your soil is wetter than the plot below you' — because the interviews said an unexplainable schedule is an unused schedule.",
      ),
      s(
        "METHODOLOGY",
        "1. Installed low-cost flow sensors at four points along the canal to establish real transit times and losses.\n2. Extended the Phase-2 forecast to eleven farms using soil type and crop stage as per-farm parameters.\n3. Modelled allocation as a mixed-integer program in OR-Tools: maximise met demand, subject to total release, transit time and a per-farm minimum fairness floor.\n4. Compared the generated schedule against the committee's existing rota replayed over the same forecast period.\n5. Ran one advisory season where the committee saw both and chose.",
      ),
      s(
        "PROTOTYPE",
        "A web interface for the committee showing the proposed rota, the reason per farm, and an override. The override is important — it was the condition on which the committee agreed to trial it at all, and it turned out to be used four times in the season, each time for a reason the model had no way to know.",
      ),
      s(
        "TESTING",
        "Flow measurement showed a 19% transit loss between head and tail, which had never been quantified and which validated the tail farmers' complaint.\n\nAgainst the existing rota over the same forecast period, the optimised schedule reduced unmet demand by 23% with no farm receiving less than its fairness floor.\n\nThe fairness floor was not optional: an unconstrained optimum starved two farms almost entirely, which is a correct solution to the stated objective and an unusable one in practice.",
      ),
      s(
        "RESULTS",
        "Unmet demand across eleven farms fell 23% in simulation against the existing rota.\n\nIn the advisory season the committee followed the generated schedule on 27 of 31 release days. The four overrides were all cases the model could not see — a wedding, a broken pump, and two instances of a farmer having already sown a different crop from the one recorded.\n\nThe measured 19% transit loss is arguably the more valuable output. It is a fact about the canal that nobody had established, and it is actionable independently of any scheduling.",
      ),
      s(
        "CONCLUSION",
        "Optimisation at the village scale is limited less by the model than by the quality of the inputs and by whether the affected people accept the output. The fairness floor and the per-farm explanation were what made it adoptable.\n\nThis project would not have been feasible in one semester without the two projects it builds on. The forecast, the calibration and the sensor design were all inherited rather than rebuilt.",
      ),
      s(
        "FUTURE_WORK",
        "- Model the transit loss explicitly rather than as a flat 19%\n- Let farmers update crop stage themselves, since two of four overrides were stale records\n- Extend to a second canal to test whether the parameters generalise",
      ),
    ],
  },

  /* ------------------------------------------------------------ healthcare */
  {
    slug: "low-cost-anaemia-screening",
    title: "Low-cost anaemia screening from conjunctival images",
    summary:
      "A smartphone screening aid that estimates haemoglobin from an eyelid photograph, for settings without a lab.",
    abstract:
      "Anaemia screening needs a blood draw and a lab. In rural primary care neither is reliably available, so screening does not happen. This project tests whether a smartphone photograph of the palpebral conjunctiva can flag likely anaemia well enough to be worth a referral, and is explicit that it is a triage aid rather than a diagnostic.",
    status: "completed",
    visibility: "PUBLIC",
    approved: true,
    collegeSlug: "nexivora-institute-of-technology",
    department: "Biotechnology",
    subject: "Major Project",
    term: "Odd 2025-26",
    domain: "healthcare",
    topics: ["healthcare", "health-data", "computer-vision"],
    sdgs: [3, 10, 5],
    techStack: ["Python", "OpenCV", "scikit-learn", "Android"],
    keywords: ["anaemia screening", "conjunctiva", "point of care", "haemoglobin estimation"],
    members: [
      {
        username: "priya-nair",
        role: "Study design & validation",
        tier: "attested",
        attestedBy: "Dr Lakshmi Menon",
      },
      { username: "sneha-iyer", role: "Application & image pipeline", tier: "evidenced" },
    ],
    facultyGuide: "Dr Lakshmi Menon",
    startedOn: "2025-07-14",
    completedOn: "2025-12-11",
    publishedOn: "2026-01-06",
    citationId: "NXV-NITP-2025-6H3TN8",
    metrics: [
      { label: "Sensitivity", value: "82%" },
      { label: "Specificity", value: "71%" },
      { label: "Participants", value: "94" },
    ],
    sections: [
      s(
        "PROBLEM",
        "Anaemia is common and cheap to treat, and it goes undetected because detection needs a venous sample and a haematology analyser.\n\nAt the primary health centre we worked with, screening happened only when a patient presented with symptoms severe enough to prompt it — by which point the intervention is later and less effective than it needs to be.",
      ),
      s(
        "RESEARCH",
        "Clinical examination of conjunctival pallor is a long-established bedside method, with reported sensitivity in the 60–80% range depending on examiner experience. It is subjective and it varies between clinicians.\n\nSeveral published studies have attempted to quantify it from photographs. Their common weakness is uncontrolled illumination: colour under an LED tube light and under daylight are not comparable, and a model trained under one fails under the other.",
      ),
      s(
        "SOLUTION",
        "An Android application that captures the everted lower eyelid alongside a printed colour reference card in the same frame. The card is the key element — it lets the pipeline white-balance each image against a known reference rather than trusting the phone's automatic correction.\n\nThe output is a three-band flag (unlikely / possible / likely anaemia) rather than a haemoglobin number, because the evidence does not support reporting a number.",
      ),
      s(
        "METHODOLOGY",
        "1. Obtained institutional ethics approval and informed consent from all participants.\n2. Recruited 94 participants at a primary health centre, each with a concurrent standard haemoglobin measurement as ground truth.\n3. Captured three images per participant under differing available light.\n4. Segmented the conjunctival region, white-balanced against the reference card, and extracted colour features in CIELAB.\n5. Trained a gradient-boosted classifier with participant-level cross-validation, so images of the same person never appeared in both training and test folds.",
      ),
      s(
        "PROTOTYPE",
        "The application guides capture with an on-screen outline and rejects a frame where the reference card is not fully visible or is over-exposed. Roughly 20% of first attempts were rejected, which is a usability cost we accepted deliberately — a bad frame produces a confident wrong answer, which is worse than asking again.",
      ),
      s(
        "TESTING",
        "Against the laboratory haemoglobin, the classifier reached **82% sensitivity and 71% specificity** at the anaemia threshold, on participant-level held-out folds.\n\nPerformance varied with skin tone: sensitivity was 86% in the lighter half of our sample and 77% in the darker half. We report this rather than the average alone, because a screening tool that works less well for part of the population it serves has a real problem, and hiding it in a mean would be dishonest.\n\nThe sample is also too small and too geographically narrow to support a general claim.",
      ),
      s(
        "RESULTS",
        "The method flags likely anaemia at a rate useful for triage in a setting where the alternative is no screening at all.\n\nIt is **not** a diagnostic and the application says so on every result screen. Specificity of 71% means roughly three in ten flagged people will not be anaemic, which is acceptable for a referral prompt and unacceptable for a diagnosis.",
      ),
      s(
        "CONCLUSION",
        "Controlled illumination via an in-frame reference card is what made the approach work at all; without it the same pipeline was barely above chance across lighting conditions.\n\nThe honest position is that this is a promising triage aid with a demonstrated performance gap across skin tones and a sample too small to generalise from.",
      ),
      s(
        "FUTURE_WORK",
        "- A substantially larger and more diverse sample, powered specifically to test the skin-tone gap\n- Multi-site validation, since a single health centre's population and lighting are not representative\n- Prospective evaluation of whether flagged referrals actually lead to treatment",
      ),
    ],
  },

  /* -------------------------------------------------------- social impact */
  {
    slug: "indic-screen-reader-extension",
    title: "Offline screen reading for Indic-language web content",
    summary:
      "A browser extension that reads Devanagari and Tamil web content aloud without a network connection.",
    abstract:
      "Screen readers handle English well and Indic scripts poorly, and the cloud services that do handle them need a connection that many users do not have. This project packages an on-device text-to-speech pipeline for Hindi and Tamil into a browser extension that works entirely offline.",
    status: "completed",
    visibility: "PUBLIC",
    approved: true,
    collegeSlug: "nexivora-institute-of-technology",
    department: "Computer Science & Engineering",
    subject: "Minor Project",
    term: "Even 2025-26",
    domain: "social",
    topics: ["social-impact", "assistive-tech", "nlp"],
    sdgs: [4, 10, 9],
    techStack: ["TypeScript", "WebAssembly", "Piper TTS", "Chrome Extensions API"],
    keywords: ["screen reader", "Indic languages", "accessibility", "offline text to speech"],
    members: [
      {
        username: "sneha-iyer",
        role: "Pipeline & extension",
        tier: "attested",
        attestedBy: "Dr Meera Rao",
      },
      { username: "karan-mehta", role: "Interface", tier: "self" },
    ],
    facultyGuide: "Dr Meera Rao",
    startedOn: "2026-01-19",
    completedOn: "2026-04-30",
    publishedOn: "2026-05-14",
    citationId: "NXV-NITP-2026-9C4BV1",
    metrics: [
      { label: "Latency", value: "310 ms / sentence" },
      { label: "Model size", value: "23 MB" },
      { label: "Languages", value: "Hindi, Tamil" },
    ],
    sections: [
      s(
        "PROBLEM",
        "A visually impaired user reading a Hindi government-services page with a standard screen reader hears the text spelled character by character, or read with English phonetics, or skipped.\n\nCloud text-to-speech handles these languages well, but it requires a connection on every sentence. For a user on intermittent rural connectivity that is not a workable dependency, and it sends everything they read to a third party.",
      ),
      s(
        "RESEARCH",
        "We tested three existing screen readers against ten Indic-language government and news pages and documented the failure modes. The most common was not silence but *wrong* pronunciation delivered confidently, which is harder for a user to detect than an obvious failure.\n\nOn synthesis, we evaluated available open models and found Piper's VITS-based voices small enough to run in the browser and good enough to be intelligible, which ruled out the larger and better-sounding options as impractical.",
      ),
      s(
        "SOLUTION",
        "A browser extension bundling a quantised on-device voice per language, compiled to WebAssembly. It detects script per text block, applies a grapheme-to-phoneme step, and synthesises locally.\n\nNothing leaves the device, which is a privacy property as much as an availability one.",
      ),
      s(
        "METHODOLOGY",
        "1. Documented failure modes across three screen readers and ten pages, as a baseline.\n2. Built a script-detection step per DOM text node, since Indic pages routinely mix English inline.\n3. Integrated a grapheme-to-phoneme converter for Devanagari and Tamil.\n4. Quantised the voice models to int8 and compiled the inference runtime to WebAssembly.\n5. Evaluated with six users, four of whom use a screen reader daily.",
      ),
      s(
        "PROTOTYPE",
        "The extension adds a keyboard-driven reading mode that follows document structure — headings, then paragraphs — rather than raw DOM order, because raw order on a modern page is unusable.\n\nMixed-script handling proved the hardest part. A sentence containing an English product name inside Hindi text needs to switch voice mid-sentence, and the first version switched too eagerly, producing a stutter at every transition.",
      ),
      s(
        "TESTING",
        "Median synthesis latency was 310 ms per sentence on a mid-range Android device — noticeable, but below the threshold at which our testers described it as disruptive.\n\nOn intelligibility, testers transcribed synthesised sentences with 94% word accuracy in Hindi and 89% in Tamil. The Tamil gap tracks the smaller training data behind the available voice, not anything in our pipeline.\n\nAll six testers preferred it to the existing options for Indic content. All six also said they would keep their current screen reader for English, which we take as the correct outcome — this complements rather than replaces.",
      ),
      s(
        "RESULTS",
        "Intelligible offline reading of Hindi and Tamil web content, at 23 MB per voice and with no network dependency and no data leaving the device.\n\nThe honest limitation is coverage: two languages out of twenty-two scheduled ones, and the approach needs a trained voice per language.",
      ),
      s(
        "CONCLUSION",
        "On-device synthesis for Indic scripts is practical on current hardware. The engineering difficulty was concentrated in mixed-script handling and in following document structure, not in the model.\n\nThe user testing was the most valuable part and the part we nearly cut for time. It is what told us mixed-script stuttering mattered more than raw latency.",
      ),
      s(
        "FUTURE_WORK",
        "- Bengali and Telugu next, on the same pipeline\n- User-adjustable speaking rate, requested by four of six testers\n- Publish the mixed-script segmentation separately, since it is useful independent of synthesis",
      ),
    ],
  },

  /* ---------------------------------------------- hardware, cross-college */
  {
    slug: "campus-air-quality-mesh",
    title: "A low-cost air-quality mesh across two campuses",
    summary:
      "Twenty-four PM2.5 nodes across two cities, built jointly by teams at two colleges, publishing open hourly data.",
    abstract:
      "Official air-quality monitoring in both cities is a single reference station, which cannot represent the variation across a campus, let alone a city. This project deploys twenty-four low-cost calibrated PM2.5 nodes across two campuses and publishes the data openly. It is the platform's cross-college collaboration test case.",
    status: "progress",
    visibility: "PUBLIC",
    approved: true,
    collegeSlug: "nexivora-institute-of-technology",
    department: "Electronics & Communication",
    subject: "Major Project",
    term: "Even 2025-26",
    domain: "hardware",
    topics: ["hardware-iot", "iot", "civic-tech"],
    sdgs: [11, 3, 13],
    techStack: ["ESP32", "PMS7003", "LoRaWAN", "Go", "PostgreSQL", "Grafana"],
    keywords: [
      "air quality monitoring",
      "PM2.5",
      "low-cost sensor network",
      "open environmental data",
    ],
    members: [
      { username: "rohit-verma", role: "Node hardware & calibration", tier: "evidenced" },
      { username: "arjun-rao", role: "Backend & data platform", tier: "evidenced" },
      { username: "dev-patel", role: "Enclosure & mounting", tier: "evidenced" },
    ],
    facultyGuide: "Prof. Sunil Deshpande",
    startedOn: "2026-01-08",
    metrics: [
      { label: "Nodes deployed", value: "24 of 30" },
      { label: "Colleges", value: "2" },
      { label: "Data published", value: "Hourly, open" },
    ],
    sections: [
      s(
        "PROBLEM",
        "Each city has one reference-grade monitoring station. A single point cannot describe a city, and it certainly cannot tell a student whether the route they walk daily is worse than the one beside it.\n\nLow-cost PM sensors are affordable but drift and are sensitive to humidity, so raw readings from them are not trustworthy without correction.",
      ),
      s(
        "RESEARCH",
        "We reviewed published co-location studies of low-cost PM sensors against reference instruments. The consistent finding is that they track relative changes well and absolute values poorly, and that humidity correction recovers a large part of the error.\n\nWe also reviewed how other city-scale networks handle calibration, and adopted the common approach: co-locate every node with the reference station before deployment, and rotate nodes back periodically.",
      ),
      s(
        "SOLUTION",
        "Thirty nodes — currently twenty-four deployed — each with a PMS7003 particulate sensor, temperature and humidity, reporting over LoRaWAN to a shared backend that both colleges write to.\n\nEach node is co-located against the reference station for seven days before deployment to derive its own correction curve, because the curves differ measurably between individual sensors of the same model.",
      ),
      s(
        "METHODOLOGY",
        "1. Co-locate each node at the reference station for seven days and fit a humidity-corrected linear correction.\n2. Deploy at 3 m height, away from direct exhaust sources, at surveyed points across both campuses.\n3. Report hourly averages, with raw readings retained alongside corrected values.\n4. Rotate four nodes back to co-location each month to measure drift.\n5. Publish the corrected series openly, with the correction parameters, so anyone can recompute.",
      ),
      s(
        "PROTOTYPE",
        "Two enclosure revisions. The first drew air through a horizontal inlet and accumulated dust on the sensor optics within three weeks. The second uses a downward-facing shielded inlet and has held for eleven weeks so far.\n\nThe cross-college element has been more procedural than technical: both institutions needed to agree on data ownership before either would allow deployment, which took longer than the hardware did.",
      ),
      s(
        "TESTING",
        "Post-correction, deployed nodes track the reference station with a mean absolute error of 6.2 µg/m³ across the co-location period.\n\nThe monthly rotation has completed twice. Measured drift so far is small — under 4% — but two months is not enough to characterise it, and we say so rather than projecting.\n\nOne node has failed, from water ingress at a cable gland rather than the enclosure itself.",
      ),
      s(
        "RESULTS",
        "In progress. Twenty-four of thirty nodes are live and publishing hourly.\n\nThe early finding worth reporting is spatial: readings vary by up to 40% across a single campus at the same hour, which is exactly the variation a single city station cannot show and the reason the project exists.",
      ),
      s(
        "CONCLUSION",
        "Not yet concluded — this project is still running. The interim position is that per-node calibration is essential rather than optional, and that the institutional agreement was the real critical path.",
      ),
      s(
        "FUTURE_WORK",
        "- Complete the remaining six nodes\n- A full year of rotation data to characterise drift properly\n- Publish the correction methodology so other campuses can replicate it",
      ),
    ],
  },

  /* ------------------------------------------- healthcare / assistive tech */
  {
    slug: "printed-prosthetic-hand",
    title: "A 3D-printed body-powered prosthetic hand under ₹5,000",
    summary:
      "A body-powered partial-hand prosthesis printable on a school-grade printer, designed for growing users.",
    abstract:
      "Commercial paediatric prostheses cost more than most families can bear and are outgrown within two years. This project designs a body-powered partial-hand prosthesis printable on a consumer FDM printer, parametrised so a new size is a regenerated model rather than a new design.",
    status: "completed",
    visibility: "PUBLIC",
    approved: true,
    collegeSlug: "nexivora-institute-of-technology",
    department: "Mechanical Engineering",
    subject: "Major Project",
    term: "Odd 2025-26",
    domain: "healthcare",
    topics: ["healthcare", "medical-devices", "assistive-tech"],
    sdgs: [3, 10],
    techStack: ["SolidWorks", "OpenSCAD", "PETG", "FDM printing"],
    keywords: [
      "3d printed prosthetic",
      "body powered prosthesis",
      "assistive device",
      "low cost prosthetics",
    ],
    members: [
      {
        username: "dev-patel",
        role: "Design & testing",
        tier: "attested",
        attestedBy: "Prof. Sunil Deshpande",
      },
      { username: "priya-nair", role: "Fit assessment & user liaison", tier: "evidenced" },
    ],
    facultyGuide: "Prof. Sunil Deshpande",
    startedOn: "2025-08-01",
    completedOn: "2025-12-20",
    publishedOn: "2026-01-15",
    citationId: "NXV-NITP-2025-3D8KQ5",
    metrics: [
      { label: "Material cost", value: "₹4,180" },
      { label: "Print time", value: "22 h" },
      { label: "Grip force", value: "18 N" },
    ],
    sections: [
      s(
        "PROBLEM",
        "A paediatric partial-hand prosthesis costs upward of ₹80,000 and a growing child outgrows it in eighteen to twenty-four months. The result is that many children go without, or wear one that no longer fits.\n\nOpen-source printable designs exist and are a genuine contribution, but most are sized for a specific published model with no straightforward path to resizing.",
      ),
      s(
        "RESEARCH",
        "We reviewed the established open designs and printed two to understand their failure modes first-hand. The common weak points were the finger joint pins and the tensioning cord anchor.\n\nWe also reviewed anthropometric data for hand dimensions by age, which is what makes parametrisation possible rather than guesswork.",
      ),
      s(
        "SOLUTION",
        "A parametric model driven by four measurements. Changing them regenerates the whole assembly, so fitting a growing user is a reprint rather than a redesign.\n\nThe mechanism is body-powered — wrist flexion tensions a cord that closes the fingers. No electronics, no battery, nothing to charge or fail.",
      ),
      s(
        "METHODOLOGY",
        "1. Printed and stress-tested two existing open designs to locate their failure points.\n2. Redesigned the finger joint to use a printed living hinge in PETG instead of a pin, removing the most common failure.\n3. Parametrised the assembly in OpenSCAD against four measurements taken from anthropometric tables.\n4. Cycle-tested the mechanism to failure.\n5. Fitted one volunteer user through the university's rehabilitation department, with consent and supervision.",
      ),
      s(
        "PROTOTYPE",
        "Six iterations. Iterations one to three failed at the living hinge between 400 and 1,900 cycles — PETG at the wrong layer orientation delaminates.\n\nRotating the hinge 90° relative to the print bed so the layer lines run across rather than along the flex axis took it past 12,000 cycles. That single orientation change was the most consequential decision in the project and it was found by failure, not by analysis.",
      ),
      s(
        "TESTING",
        "The final design reached **12,400 open-close cycles** before hinge failure, against a 10,000-cycle target derived from roughly one year of typical use.\n\nMeasured grip force was 18 N, sufficient for the everyday tasks in our task list — holding a bottle, a bag handle, a cricket bat.\n\nOne user wore it for three weeks. The feedback that mattered was not mechanical: the socket edge caused irritation after about two hours, which no bench test would have surfaced.",
      ),
      s(
        "RESULTS",
        "A working parametric prosthesis at ₹4,180 in materials and 22 hours of print time on a consumer printer.\n\nOne user, three weeks. That is a demonstration, not a clinical result, and we are explicit about the distinction. Comfort over a full day is untested.",
      ),
      s(
        "CONCLUSION",
        "Parametrisation is the useful contribution here rather than the mechanism itself — resizing for a growing user is the actual unmet need, and it is what the existing designs do not address.\n\nThe socket comfort issue is unresolved and is the thing standing between this and real use.",
      ),
      s(
        "FUTURE_WORK",
        "- Redesign the socket edge with a compliant lip; this is the blocking issue\n- Longer wear trials with more users, through the rehabilitation department\n- Publish the parametric model openly with the fitting measurements documented",
      ),
    ],
  },

  /* ------------------------------------------------------------------- AI */
  {
    slug: "offline-lecture-transcription",
    title: "Offline transcription and search for recorded lectures",
    summary:
      "Transcribes recorded lectures on a department machine, making three years of recordings searchable.",
    abstract:
      "The department recorded lectures through the pandemic and afterwards, accumulating roughly 1,400 hours that nobody could search. This project runs on-premise speech recognition over the archive and builds a search interface, deliberately avoiding cloud transcription for cost and for the privacy of recorded classrooms.",
    status: "completed",
    visibility: "PUBLIC",
    approved: true,
    collegeSlug: "nexivora-institute-of-technology",
    department: "Computer Science & Engineering",
    subject: "Minor Project",
    term: "Even 2025-26",
    domain: "ai",
    topics: ["ai-ml", "nlp", "learning-tools"],
    sdgs: [4, 10],
    techStack: ["Python", "Whisper", "PostgreSQL", "Next.js", "FFmpeg"],
    keywords: ["lecture transcription", "speech recognition", "offline ASR", "searchable lectures"],
    members: [
      { username: "sneha-iyer", role: "Pipeline & search", tier: "evidenced" },
      { username: "karan-mehta", role: "Interface", tier: "evidenced" },
      { username: "ananya-sharma", role: "Evaluation", tier: "evidenced" },
    ],
    facultyGuide: "Dr Meera Rao",
    startedOn: "2026-01-15",
    completedOn: "2026-04-25",
    publishedOn: "2026-05-05",
    citationId: "NXV-NITP-2026-7R2FJ9",
    metrics: [
      { label: "Archive processed", value: "1,412 h" },
      { label: "Word error rate", value: "14.2%" },
      { label: "Cloud cost avoided", value: "~₹1.1L" },
    ],
    sections: [
      s(
        "PROBLEM",
        "Roughly 1,400 hours of recorded lectures sat on a department server with filenames as the only metadata. A student wanting the ten minutes where a specific topic was explained had no way to find it short of scrubbing through recordings.\n\nCommercial transcription of that archive was quoted at over a lakh, and it would mean uploading recordings of identifiable students and staff to a third party.",
      ),
      s(
        "RESEARCH",
        "We compared open speech-recognition models on a sample of our own recordings rather than on published benchmarks, because our audio is the hard case: a lecture hall with reverberation, a lapel microphone, and heavily code-mixed English and Hindi.\n\nPublished word error rates on clean read speech told us very little. On our sample the ranking of models was different from the published ranking, which is the reason we tested locally.",
      ),
      s(
        "SOLUTION",
        "An on-premise pipeline: segment audio on silence, transcribe with a medium Whisper model on the department's single GPU machine, index the result with Postgres full-text search, and serve a search interface that deep-links to the timestamp.\n\nNothing leaves the department network.",
      ),
      s(
        "METHODOLOGY",
        "1. Hand-transcribed 90 minutes of representative audio as ground truth, across three lecturers and two rooms.\n2. Benchmarked four model sizes against it, measuring word error rate and processing time.\n3. Selected the medium model as the point where accuracy gains flattened against a steep time cost.\n4. Processed the full archive over eleven days of GPU time.\n5. Indexed transcripts with timestamps and built the search interface.",
      ),
      s(
        "PROTOTYPE",
        "Search returns a snippet with the surrounding sentence and a link that opens the recording at that second, which is what makes it useful — a transcript without a timestamp link is a wall of text.\n\nCode-mixing was the persistent difficulty. Sentences that switch between English and Hindi mid-clause are transcribed worst, and they are common in exactly the explanatory passages students most want to find.",
      ),
      s(
        "TESTING",
        "Word error rate on held-out ground truth was **14.2%** overall — 11.8% on predominantly English passages and 23.1% on heavily code-mixed passages.\n\nWe evaluated search rather than only transcription, because that is what users do: for 40 topic queries with known correct locations, the right passage was in the top three results 82% of the time. Search tolerates transcription errors better than reading does.\n\nTotal processing was eleven days on one GPU, against an estimated ₹1.1 lakh for commercial transcription.",
      ),
      s(
        "RESULTS",
        "1,412 hours searchable, at the cost of eleven days of an otherwise idle machine and no data leaving the department.\n\nA 14.2% word error rate is not good enough to read as a transcript. It is good enough to search, which was the actual requirement.",
      ),
      s(
        "CONCLUSION",
        "Evaluating on our own audio rather than on published benchmarks changed the model choice, and evaluating search rather than transcription changed how we judged whether the result was good enough.\n\nCode-mixed speech remains the weak point and is not something we solved.",
      ),
      s(
        "FUTURE_WORK",
        "- Fine-tune on code-mixed Indian classroom speech, which is the largest available gain\n- Speaker diarisation to separate lecturer from student questions\n- Automatic topic segmentation so a recording has chapters",
      ),
    ],
  },

  /* -------------------------------------------------------------- software */
  {
    slug: "lab-slot-booking-system",
    title: "Laboratory slot booking for shared department equipment",
    summary:
      "Replaces a paper register for eleven shared instruments, cutting idle time on the most contended machine by 38%.",
    abstract:
      "Shared laboratory instruments were booked on a paper register at the lab door, which meant nobody could see availability without walking there. This project replaces it with a booking system that enforces access rules, records usage, and surfaced a scheduling problem nobody had quantified.",
    status: "completed",
    visibility: "PUBLIC",
    approved: true,
    collegeSlug: "nexivora-institute-of-technology",
    department: "Computer Science & Engineering",
    subject: "Minor Project",
    term: "Odd 2025-26",
    domain: "software",
    topics: ["software", "web-platforms", "learning-tools"],
    sdgs: [4, 9],
    techStack: ["Next.js", "PostgreSQL", "Prisma", "TypeScript"],
    keywords: [
      "lab booking system",
      "equipment scheduling",
      "college software project",
      "resource booking",
    ],
    members: [
      { username: "karan-mehta", role: "Interface", tier: "evidenced" },
      {
        username: "arjun-rao",
        role: "Backend & data model",
        tier: "attested",
        attestedBy: "Dr Meera Rao",
      },
    ],
    facultyGuide: "Dr Meera Rao",
    startedOn: "2025-08-12",
    completedOn: "2025-11-28",
    publishedOn: "2025-12-10",
    citationId: "NXV-NITP-2025-5T6YH3",
    metrics: [
      { label: "Instruments", value: "11" },
      { label: "Idle time reduced", value: "38%" },
      { label: "Active users", value: "210" },
    ],
    sections: [
      s(
        "PROBLEM",
        "Eleven shared instruments were booked on a paper register kept in the lab. Checking availability meant walking to the lab, and a booking could be overwritten by anyone with a pen.\n\nThe two most contended instruments had a reputation for being permanently unavailable, which nobody could verify because there was no usage record.",
      ),
      s(
        "RESEARCH",
        "We shadowed the lab for a week and logged what actually happened: 34% of booked slots went unused with no cancellation, and two instruments accounted for most of the contention.\n\nWe reviewed off-the-shelf booking tools. The blocker in each case was the access rule — some instruments require a trained user or supervision, and none of the general-purpose tools model that without heavy customisation.",
      ),
      s(
        "SOLUTION",
        "A booking system with per-instrument access rules — training required, supervision required, or open — enforced at booking time, with a check-in step that releases a slot automatically if nobody arrives within fifteen minutes.\n\nThe automatic release is the feature that addressed the actual problem, which was unused bookings rather than genuine over-demand.",
      ),
      s(
        "METHODOLOGY",
        "1. Shadowed the lab for a week and quantified the no-show rate.\n2. Interviewed the lab technician and three faculty on access rules, which were previously unwritten.\n3. Modelled instruments, qualifications, slots and bookings, with the access rule as data rather than code.\n4. Built check-in with automatic release.\n5. Ran alongside the paper register for three weeks before the register was retired.",
      ),
      s(
        "PROTOTYPE",
        "The parallel-running period was the most useful design decision. It surfaced two access rules nobody had mentioned in interviews, both of which only appeared when a booking was refused and the person objected.",
      ),
      s(
        "TESTING",
        "Over eight weeks of live use, idle time on the most contended instrument fell **38%**, almost entirely from automatic release of no-show bookings rather than from any change in demand.\n\nWe load-tested to 500 concurrent users, well beyond the 210 who actually use it, and the system was comfortable.\n\nThe access-rule engine was unit-tested against the eighteen documented rules, which matters because a wrong refusal blocks someone's practical work.",
      ),
      s(
        "RESULTS",
        "The paper register is gone. Eleven instruments, 210 users, and a usage record that did not previously exist.\n\nThe measured 38% idle-time reduction is the headline, but the more interesting result is that the two instruments believed to be over-subscribed were not — they were over-booked and under-used, which is a different problem with a different fix.",
      ),
      s(
        "CONCLUSION",
        "The valuable part of this project was the week of shadowing before any code was written. Without it we would have built a scheduling optimiser for a demand problem that did not exist.\n\nEncoding access rules as data rather than logic is what let the two undiscovered rules be added without a deployment.",
      ),
      s(
        "FUTURE_WORK",
        "- Extend to the other three departments, which have asked\n- Waiting list with automatic offer when a slot releases\n- Usage reporting for the annual equipment utilisation return",
      ),
    ],
  },

  /* ------------------------------------------------------------- education */
  {
    slug: "peer-feedback-rubric-tool",
    title: "Structured peer feedback for studio-based courses",
    summary:
      "A rubric-driven peer review tool for design studio courses, tested across two semesters and 96 students.",
    abstract:
      "Peer feedback in studio courses was verbal, unstructured and unrecorded, so students could not act on it and faculty could not see it. This project builds a rubric-driven peer review flow and measures whether structure improves the usefulness of the feedback students give each other.",
    status: "completed",
    visibility: "PUBLIC",
    approved: true,
    collegeSlug: "nexivora-institute-of-technology",
    department: "Computer Science & Engineering",
    subject: "Minor Project",
    term: "Even 2025-26",
    domain: "education",
    topics: ["education", "learning-tools"],
    sdgs: [4],
    techStack: ["Next.js", "PostgreSQL", "TypeScript"],
    keywords: [
      "peer feedback",
      "rubric assessment",
      "studio course",
      "education technology project",
    ],
    members: [
      { username: "sneha-iyer", role: "Design & study", tier: "evidenced" },
      { username: "karan-mehta", role: "Interface", tier: "evidenced" },
    ],
    facultyGuide: "Dr Meera Rao",
    startedOn: "2026-01-20",
    completedOn: "2026-05-02",
    publishedOn: "2026-05-16",
    citationId: "NXV-NITP-2026-1G5DM6",
    metrics: [
      { label: "Students", value: "96" },
      { label: "Actionable feedback", value: "+41%" },
      { label: "Semesters", value: "2" },
    ],
    sections: [
      s(
        "PROBLEM",
        "In studio review sessions students give each other feedback verbally. It is not recorded, so a student cannot revisit it, and the faculty member cannot see whether useful critique is happening at all.\n\nWhen we sampled written feedback from an existing informal channel, most of it was evaluative rather than actionable — 'looks good', 'needs work' — which tells the recipient nothing they can do.",
      ),
      s(
        "RESEARCH",
        "The education literature on peer assessment is consistent: structure improves quality, and prompts that ask for a specific observation plus a suggestion outperform open-ended requests.\n\nWe also found consistent warnings about reciprocity — students trade favourable reviews when ratings are visible and attributed. That shaped the visibility model more than anything else we read.",
      ),
      s(
        "SOLUTION",
        "A rubric-driven flow: for each criterion the reviewer must record one specific observation and one suggestion. Free-text-only submission is not accepted.\n\nReviews are anonymous to the recipient and attributed to the faculty member, which follows the same one-directional privacy model the platform uses for group peer review — honest review requires that the person being rated cannot identify the rater.",
      ),
      s(
        "METHODOLOGY",
        "1. Coded 240 samples of existing informal feedback as evaluative, descriptive or actionable, to establish a baseline.\n2. Designed a four-criterion rubric with the studio faculty.\n3. Ran the tool for two semesters across 96 students.\n4. Coded the resulting feedback with the same scheme, by two independent coders.\n5. Measured inter-coder agreement so the headline number means something.",
      ),
      s(
        "PROTOTYPE",
        "The first version allowed skipping a criterion, and 60% of reviews skipped at least one. Making each criterion required lifted completion but also produced padding on criteria reviewers had nothing to say about — so the final version requires a response but accepts an explicit 'not enough information to judge'.",
      ),
      s(
        "TESTING",
        "Feedback coded **actionable** rose from 31% at baseline to 72% — a 41 percentage point improvement.\n\nInter-coder agreement was Cohen's κ = 0.78, which is substantial and means the coding is reproducible rather than one person's impression.\n\nStudents rated the received feedback more useful (3.9 versus 2.7 on a five-point scale), and simultaneously rated giving feedback as more effortful (3.4 versus 2.1). Both are true and we report both.",
      ),
      s(
        "RESULTS",
        "Structure substantially improves the usefulness of peer feedback, at a real cost in reviewer effort.\n\nThe study is not controlled — the same cohort was not randomised between conditions, and the baseline came from a different, informal channel. It is a before-and-after within one department, and it should be read that way.",
      ),
      s(
        "CONCLUSION",
        "Requiring an observation and a suggestion per criterion is a small design decision with a large effect. The 'not enough information to judge' option mattered more than expected — without it, forced completion produced padding, which looks like feedback and is not.",
      ),
      s(
        "FUTURE_WORK",
        "- A controlled comparison, randomising within a cohort\n- Test whether the effect persists after novelty, across four semesters\n- Whether reviewers improve at giving feedback over time, which the current design cannot show",
      ),
    ],
  },

  /* -------------------------------------------------------------- embargo */
  {
    slug: "battery-second-life-grading",
    title: "Rapid grading of retired EV cells for second-life use",
    summary:
      "A fast electrochemical grading method for retired lithium cells. Under embargo pending a patent filing.",
    abstract:
      "Retired electric-vehicle cells retain substantial capacity but grading them for reuse conventionally takes hours per cell, which is the economic barrier to second-life applications. This project develops a rapid impedance-based grading method. The full record is under embargo until the patent application is filed.",
    status: "completed",
    visibility: "PUBLIC",
    approved: true,
    embargoUntil: "2027-03-31",
    collegeSlug: "nexivora-institute-of-technology",
    department: "Electronics & Communication",
    subject: "Major Project",
    term: "Even 2025-26",
    domain: "sustainability",
    topics: ["sustainability", "renewable-energy"],
    sdgs: [7, 12, 13],
    techStack: ["Embedded C", "Python", "Impedance spectroscopy"],
    keywords: ["battery second life", "cell grading", "impedance spectroscopy", "energy storage"],
    members: [
      { username: "rohit-verma", role: "Instrumentation", tier: "evidenced" },
      { username: "ananya-sharma", role: "Classification", tier: "evidenced" },
    ],
    facultyGuide: "Prof. Sunil Deshpande",
    startedOn: "2026-01-06",
    completedOn: "2026-05-15",
    publishedOn: "2026-05-30",
    citationId: "NXV-NITP-2026-4B7ZE2",
    metrics: [
      { label: "Grading time", value: "Under embargo" },
      { label: "Status", value: "Patent pending" },
    ],
    sections: [
      s(
        "PROBLEM",
        "Retired EV cells commonly retain 70–80% of original capacity, which is ample for stationary storage. Grading them conventionally requires a full charge-discharge cycle — several hours per cell — and at that cost the economics of reuse do not work.",
      ),
      s("RESEARCH", "Withheld until the embargo lifts on 31 March 2027."),
      s("SOLUTION", "Withheld until the embargo lifts on 31 March 2027."),
      s("METHODOLOGY", "Withheld until the embargo lifts on 31 March 2027."),
      s("PROTOTYPE", "Withheld until the embargo lifts on 31 March 2027."),
      s("TESTING", "Withheld until the embargo lifts on 31 March 2027."),
      s("RESULTS", "Withheld until the embargo lifts on 31 March 2027."),
      s(
        "CONCLUSION",
        "The project met its objective. Details are withheld pending a patent application; the record exists and is citable now, and the body becomes readable when the embargo lifts.",
      ),
      s("FUTURE_WORK", "Withheld until the embargo lifts on 31 March 2027."),
    ],
  },

  /* ------------------------------- near-duplicate: fires similarity check */
  {
    slug: "soil-moisture-irrigation-control",
    title: "Automated irrigation control using soil moisture sensors",
    summary:
      "A proposal to control field irrigation from soil-moisture readings. Flagged as closely similar to an archived project.",
    abstract:
      "A proposed system that reads soil moisture and opens an irrigation valve when readings fall below a threshold, to reduce water waste from timer-based irrigation. Submitted as a proposal; the similarity check flagged it against an archived 2024 project.",
    status: "proposed",
    visibility: "COLLEGE",
    approved: false,
    collegeSlug: "nexivora-institute-of-technology",
    department: "Computer Science & Engineering",
    subject: "Minor Project",
    term: "Odd 2026-27",
    domain: "sustainability",
    topics: ["sustainability", "agritech", "iot"],
    sdgs: [6, 2],
    techStack: ["ESP32", "Soil moisture sensor", "Python"],
    keywords: ["soil moisture", "automated irrigation", "water saving"],
    members: [{ username: "karan-mehta", role: "Proposer", tier: "self" }],
    startedOn: "2026-08-10",
    sections: [
      s(
        "PROBLEM",
        "Field irrigation runs on a fixed timer and waters regardless of rainfall or how wet the soil already is, wasting a significant share of the water used.",
      ),
      s(
        "RESEARCH",
        "Capacitive soil-moisture sensors are more durable than resistive ones. Commercial irrigation controllers are expensive for small plots.",
      ),
      s(
        "SOLUTION",
        "A sensor node that measures soil moisture and opens a solenoid valve when the reading falls below a set threshold.",
      ),
      s(
        "METHODOLOGY",
        "Calibrate the sensor, deploy in one zone, compare water use against a timer-controlled zone over a season.",
      ),
      s("PROTOTYPE", "Not yet built — this is a proposal."),
      s("TESTING", "Planned: compare inlet water volume between the sensed and control zones."),
      s("RESULTS", "Not yet available."),
      s("CONCLUSION", "Not yet available."),
      s("FUTURE_WORK", "Add rainfall forecasting."),
    ],
  },

  /* ------------------------------------------- private: must never be public */
  {
    slug: "attendance-face-recognition",
    title: "Classroom attendance from face recognition",
    summary: "A private project record. Must never appear on any public surface.",
    abstract:
      "An internal project exploring automated attendance capture. Kept private: it processes biometric data of identifiable students, and publishing the record would be inappropriate regardless of the technical outcome.",
    status: "completed",
    visibility: "PRIVATE",
    approved: false,
    collegeSlug: "nexivora-institute-of-technology",
    department: "Computer Science & Engineering",
    term: "Odd 2025-26",
    domain: "ai",
    topics: ["ai-ml", "computer-vision"],
    sdgs: [4],
    techStack: ["Python", "OpenCV"],
    keywords: ["attendance", "face recognition"],
    members: [{ username: "zoya-khan", role: "Developer", tier: "self" }],
    startedOn: "2025-08-01",
    completedOn: "2025-12-01",
    sections: [
      s("PROBLEM", "Manual attendance takes time at the start of every class."),
      s(
        "RESEARCH",
        "Reviewed face-recognition approaches and their accuracy under classroom lighting.",
      ),
      s("SOLUTION", "A camera at the front of the room matching faces against an enrolled set."),
      s("METHODOLOGY", "Enrol students, capture at class start, match and record."),
      s("PROTOTYPE", "Built and tested in one classroom."),
      s("TESTING", "Accuracy measured across three lighting conditions."),
      s("RESULTS", "Withheld — this record is private."),
      s(
        "CONCLUSION",
        "The project raised biometric-privacy questions that were not resolved, which is why the record is private rather than published.",
      ),
      s("FUTURE_WORK", "None planned. A consent and retention model would be a prerequisite."),
    ],
  },

  /* --------------------- unverified college: must never reach a public surface */
  {
    slug: "microplastic-optical-detection",
    title: "Optical detection of microplastics in freshwater samples",
    summary:
      "A project at an unverified college. Excluded from every public surface until the college completes verification.",
    abstract:
      "An optical method for counting microplastic particles in freshwater samples. This project belongs to a college that has registered but not completed verification, so nothing from it is publicly indexable — the anti-abuse gate working as designed.",
    status: "completed",
    visibility: "PUBLIC",
    approved: true,
    collegeSlug: "greenfield-institute",
    department: "Applied Sciences",
    term: "Odd 2025-26",
    domain: "research",
    topics: ["research", "materials", "water"],
    sdgs: [6, 14, 12],
    techStack: ["Python", "OpenCV", "Optical microscopy"],
    keywords: ["microplastics", "water quality", "optical detection"],
    members: [{ username: "arjun-rao", role: "Analysis", tier: "self" }],
    startedOn: "2025-07-01",
    completedOn: "2025-12-15",
    sections: [
      s(
        "PROBLEM",
        "Microplastic quantification requires spectroscopy that most laboratories do not have.",
      ),
      s(
        "RESEARCH",
        "Reviewed staining and optical counting methods and their known false-positive rates.",
      ),
      s("SOLUTION", "Nile-red staining with automated particle counting from microscope images."),
      s(
        "METHODOLOGY",
        "Filter samples, stain, image, count automatically, validate against manual counts.",
      ),
      s("PROTOTYPE", "Built on a standard laboratory microscope with a phone camera adapter."),
      s("TESTING", "Compared automated counts against manual counting on 40 samples."),
      s("RESULTS", "Automated counts correlated well with manual counts on the tested range."),
      s(
        "CONCLUSION",
        "A workable low-cost screening method, with a known false-positive rate from organic material.",
      ),
      s("FUTURE_WORK", "Reduce false positives from organic particles."),
    ],
  },
];

export const projectBySlug = Object.fromEntries(projects.map((p) => [p.slug, p])) as Record<
  string,
  Project
>;

/** Children of a project, for the lineage tree. */
export function childrenOf(slug: string) {
  return projects.filter((p) => p.buildsOn?.some((b) => b.slug === slug));
}

export function sectionOf(project: Project, kind: SectionKind): ProjectSection | undefined {
  return project.sections.find((section) => section.kind === kind);
}
