import type { Faq } from "@/content/types";

/**
 * FAQ content.
 *
 * Only genuine question/answer pairs that are **visible on the page** get
 * `FAQPage` markup — marking up an FAQ the reader cannot see is exactly the
 * structured-data/visible-text mismatch the guidance warns against, and it is
 * the fastest way to lose rich-result eligibility.
 *
 * Written as answers to questions people actually ask, including the awkward
 * ones. An FAQ that only asks flattering questions is marketing copy.
 */

export const generalFaqs: Faq[] = [
  {
    question: "What is Nexivora, in one sentence?",
    answer:
      "Nexivora is the system of record for academic project work — where a student group plans and does the work, a faculty member reviews and attests it, and the finished project becomes a permanent, citable record.",
  },
  {
    question: "Is this just LinkedIn for students?",
    answer:
      "No. LinkedIn is person-first: the profile is the object and the work is a line on it. Nexivora is project-first: the project is the object, and people, colleges and opportunities hang off it. The practical difference is that a Nexivora claim points at evidence — the tasks you closed, the files you contributed, and a named faculty member who attested it.",
  },
  {
    question: "How is it different from an LMS like Moodle or Google Classroom?",
    answer:
      "An LMS delivers courses — content, quizzes and grades. Nexivora is about what students build, and about what survives afterwards. They coexist; we are not replacing anyone's LMS.",
  },
  {
    question: "What does it cost?",
    answer:
      "Free for students, faculty and alumni, permanently. Institutions pay for administration, analytics and accreditation reporting, starting with a free one-semester pilot. Companies pay above a free tier for talent discovery and posting. There are no ads and we do not sell data.",
  },
  {
    question: "Who owns the projects students publish?",
    answer:
      "The students, always. The institution gets a licence to use the work for evaluation and accreditation reporting. Groups can keep patentable work under embargo — listed and citable, but not disclosed — until a filing is made. This is written into the IP policy rather than left to a support email.",
  },
  {
    question: "Where is the AI?",
    answer:
      "Deliberately last. Everything the product does — matching, search, similarity, ranking — is deterministic and explainable, which is what a faculty member evaluating a student actually needs. An AI assistant is added on top, and the product is complete without it. That is a design decision, not a limitation.",
  },
];

export const studentFaqs: Faq[] = [
  {
    question: "What do I actually get out of this?",
    answer:
      "Two things. During the project, a workspace where the work is organised and where your contribution is visible rather than assumed. After it, a portfolio of documented work with faculty attestation behind it — which is something you can show an employer and they can verify.",
  },
  {
    question: "Will my work be public?",
    answer:
      "Only if you choose. Projects default to private, and publishing requires both your group and your faculty supervisor to agree. You can also publish under an embargo, which lists the project and withholds the detail.",
  },
  {
    question: "Can companies contact me?",
    answer:
      "Only if you opt in, and you can turn it off at any time. That setting is off by default. A verified company that you have not opted into contact from cannot message you.",
  },
  {
    question: "What happens to my projects after I graduate?",
    answer:
      "They stay yours. Your account becomes an alumni account, workspace access to current groups ends, and your authorship and portfolio persist permanently. Losing your own work on graduation would be the single worst bug this product could have.",
  },
];

export const facultyFaqs: Faq[] = [
  {
    question: "Is this more work for me?",
    answer:
      "It should be less. The dashboard shows every group's progress without you having to ask, and the contribution ledger gives you evidence for differentiating individual marks rather than a judgement you have to defend. The setup cost is real — one subject's rubric and class list — and it is paid once.",
  },
  {
    question: "Can I see what students are doing without them knowing?",
    answer:
      "No, and that is deliberate. Faculty access to a workspace is read-only and visible. Group health signals — a silent member, a slipped milestone — are shown to the group as well as to you. A hidden warning about a student is surveillance; a visible one is feedback, and it changes behaviour during the project, which is the only outcome that helps.",
  },
  {
    question: "What is an attestation, and why does it matter?",
    answer:
      "It is you, by name, vouching for a specific contribution or outcome — pre-filled from the workspace evidence, then edited by you. It is never issued automatically, because its entire value is that a named human signed it. It is revocable, and a revocation is preserved rather than deleted.",
  },
  {
    question: "Can I grade group members differently?",
    answer:
      "Yes, and the contribution ledger sits beside the score input so the differentiation is evidence-based rather than a guess. A per-member adjustment requires a stated reason.",
  },
];

export const collegeFaqs: Faq[] = [
  {
    question: "What is the actual return for the institution?",
    answer:
      "Accreditation evidence. Every NAAC, NBA, NIRF and AICTE cycle requires compiling project, research and student-activity data, and it is done manually by a faculty committee over weeks. Nexivora already holds that data, structured, because the platform generated it as a by-product of ordinary use. It becomes an export.",
  },
  {
    question: "Where is our data stored, and who can see it?",
    answer:
      "Your institution's data is isolated from every other institution's — enforced in the query layer, not only in the interface, and tested. Nothing from your college is publicly visible unless a student and a faculty member both choose to publish it. Self-hosting on your own infrastructure is available.",
  },
  {
    question: "How do we start?",
    answer:
      "One department, one semester, free. No purchase decision, no procurement process. If faculty are not opening the dashboard by week six, it has not worked and you should stop — we would rather learn that in month two than in year two.",
  },
  {
    question: "What if we stop using it?",
    answer:
      "You export everything. Projects, evidence, evaluations and reports, in open formats. There is no data hostage clause, and an archive you cannot take with you would defeat the purpose of building one.",
  },
];

export const companyFaqs: Faq[] = [
  {
    question: "How is this better than a résumé?",
    answer:
      "A résumé is a claim. Here you see the project, the methodology, the results, who did which part, and whether a named faculty member attested it. You can filter to faculty-attested work only.",
  },
  {
    question: "Why do we have to be verified before posting?",
    answer:
      "Because fake internship listings that charge a certificate fee are a real and widespread scam targeting exactly these students. Verification is a one-time business check. Until it completes, a company cannot post, cannot contact a student, and does not appear in search.",
  },
  {
    question: "Can we contact any student we find?",
    answer:
      "No. A student appears in talent search only if they opted into being discoverable, and can be contacted only if they separately opted into contact. That line is what keeps the surface useful — the moment students start receiving unsolicited recruiter mail, they make their profiles private and everyone loses.",
  },
];
