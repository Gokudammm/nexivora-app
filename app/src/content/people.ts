import type { Person } from "@/content/types";

/**
 * Demo people.
 *
 * Named, with believable strengths and gaps, because random data produces a
 * demo nobody believes. Two deliberate inclusions:
 *
 *  - **Karan Mehta** is the visibly under-contributing group member. He exists
 *    so the Phase 9 group-health signal and the Phase 7 ledger have something
 *    real to surface rather than a synthetic warning.
 *  - **Zoya Khan's profile is PRIVATE.** She must never appear in the sitemap,
 *    in listings, or in structured data — `scripts/check-seo.mjs` asserts it.
 *
 * Skill tiers follow the three-tier proof model (docs/CONTEXT.md §4): `self` is
 * a claim, `evidenced` is derived from workspace activity, `attested` is signed
 * by a named faculty member.
 */
export const people: Person[] = [
  {
    username: "ananya-sharma",
    name: "Ananya Sharma",
    role: "student",
    headline: "Final-year CSE · applied ML for water and agriculture",
    bio: "I build things that measure something real. Most of my work sits where sensing meets modelling — if a model cannot be checked against a physical reading, I am not very interested in it. Currently working on soil-moisture forecasting and looking for people who like field testing as much as notebooks.",
    collegeSlug: "nexivora-institute-of-technology",
    department: "Computer Science & Engineering",
    programme: "B.Tech Computer Science & Engineering",
    year: 4,
    skills: [
      { name: "Python", tier: "evidenced", fromProjects: 4 },
      { name: "TensorFlow", tier: "attested", fromProjects: 2 },
      { name: "Time-series forecasting", tier: "attested", fromProjects: 2 },
      { name: "Sensor calibration", tier: "evidenced", fromProjects: 2 },
      { name: "Technical writing", tier: "evidenced", fromProjects: 3 },
      { name: "Rust", tier: "self" },
    ],
    interests: ["Agriculture technology", "Remote sensing", "Water systems"],
    links: [{ label: "GitHub", url: "https://github.com/example-ananya" }],
    achievements: [
      {
        title: "Best Project, Department Showcase",
        year: 2026,
        detail: "Smart irrigation, CSE department",
      },
      { title: "Runner-up, Inter-college Hackathon", year: 2025 },
    ],
    visibility: "PUBLIC",
    contactable: true,
  },
  {
    username: "rohit-verma",
    name: "Rohit Verma",
    role: "student",
    headline: "Third-year ECE · embedded systems and low-power sensing",
    bio: "Embedded developer. I care about the part of a project that has to survive being left outside for six months. Comfortable with board bring-up, power budgets and the unglamorous debugging that follows.",
    collegeSlug: "nexivora-institute-of-technology",
    department: "Electronics & Communication",
    programme: "B.Tech Electronics & Communication",
    year: 3,
    skills: [
      { name: "Embedded C", tier: "attested", fromProjects: 3 },
      { name: "ESP32 / LoRa", tier: "evidenced", fromProjects: 3 },
      { name: "PCB design", tier: "evidenced", fromProjects: 2 },
      { name: "Power management", tier: "evidenced", fromProjects: 2 },
      { name: "Python", tier: "self" },
    ],
    interests: ["IoT", "Low-power design", "Field deployment"],
    visibility: "PUBLIC",
    contactable: true,
  },
  {
    username: "priya-nair",
    name: "Priya Nair",
    role: "student",
    headline: "Final-year Biotechnology · diagnostics and health data",
    bio: "Biotech student working on low-cost diagnostics. My interest is the gap between a method that works in a lab and one that works in a district hospital with intermittent power.",
    collegeSlug: "nexivora-institute-of-technology",
    department: "Biotechnology",
    programme: "B.Tech Biotechnology",
    year: 4,
    skills: [
      { name: "Assay design", tier: "attested", fromProjects: 2 },
      { name: "Laboratory protocol", tier: "evidenced", fromProjects: 3 },
      { name: "Statistical analysis", tier: "evidenced", fromProjects: 2 },
      { name: "R", tier: "self" },
    ],
    interests: ["Point-of-care diagnostics", "Public health", "Bioinformatics"],
    achievements: [{ title: "Published abstract, State Biotech Conference", year: 2026 }],
    visibility: "PUBLIC",
    contactable: false,
  },
  {
    username: "karan-mehta",
    name: "Karan Mehta",
    role: "student",
    headline: "Third-year CSE",
    bio: "Computer science student, interested in web development and design.",
    collegeSlug: "nexivora-institute-of-technology",
    department: "Computer Science & Engineering",
    programme: "B.Tech Computer Science & Engineering",
    year: 3,
    skills: [
      { name: "HTML & CSS", tier: "self" },
      { name: "Figma", tier: "self" },
      { name: "JavaScript", tier: "evidenced", fromProjects: 1 },
    ],
    interests: ["Web development", "UI design"],
    visibility: "PUBLIC",
    contactable: false,
  },
  {
    username: "zoya-khan",
    name: "Zoya Khan",
    role: "student",
    headline: "Second-year CSE",
    bio: "Private profile — used to verify that privacy settings actually exclude a person from every public surface.",
    collegeSlug: "nexivora-institute-of-technology",
    department: "Computer Science & Engineering",
    programme: "B.Tech Computer Science & Engineering",
    year: 2,
    skills: [{ name: "Java", tier: "self" }],
    interests: ["Systems"],
    visibility: "PRIVATE",
    contactable: false,
  },
  {
    username: "dev-patel",
    name: "Dev Patel",
    role: "student",
    headline: "Final-year Mechanical · robotics and mechanism design",
    bio: "Mechanical engineering student working on assistive mechanisms. I like problems where the constraint is cost rather than capability.",
    collegeSlug: "nexivora-institute-of-technology",
    department: "Mechanical Engineering",
    programme: "B.Tech Mechanical Engineering",
    year: 4,
    skills: [
      { name: "CAD (SolidWorks)", tier: "attested", fromProjects: 2 },
      { name: "3D printing", tier: "evidenced", fromProjects: 3 },
      { name: "Mechanism design", tier: "evidenced", fromProjects: 2 },
      { name: "FEA", tier: "self" },
    ],
    interests: ["Assistive technology", "Prosthetics", "Manufacturing"],
    visibility: "PUBLIC",
    contactable: true,
  },
  {
    username: "sneha-iyer",
    name: "Sneha Iyer",
    role: "student",
    headline: "Third-year CSE · accessibility and language technology",
    bio: "Working on Indic-language accessibility. Most tools assume English input and a fast connection; a lot of India has neither.",
    collegeSlug: "nexivora-institute-of-technology",
    department: "Computer Science & Engineering",
    programme: "B.Tech Computer Science & Engineering",
    year: 3,
    skills: [
      { name: "NLP", tier: "evidenced", fromProjects: 2 },
      { name: "React", tier: "evidenced", fromProjects: 3 },
      { name: "Accessibility (WCAG)", tier: "attested", fromProjects: 1 },
      { name: "Speech processing", tier: "self" },
    ],
    interests: ["Accessibility", "Indic NLP", "Offline-first design"],
    visibility: "PUBLIC",
    contactable: true,
  },
  {
    username: "arjun-rao",
    name: "Arjun Rao",
    role: "student",
    headline: "Final-year Information Science, Meridian · distributed systems",
    bio: "Backend and distributed systems. Currently working across two colleges on a shared air-quality network, which has been an education in coordination as much as engineering.",
    collegeSlug: "meridian-college-of-engineering",
    department: "Information Science",
    programme: "B.E. Information Science",
    year: 4,
    skills: [
      { name: "Go", tier: "evidenced", fromProjects: 2 },
      { name: "PostgreSQL", tier: "evidenced", fromProjects: 3 },
      { name: "Distributed systems", tier: "attested", fromProjects: 1 },
      { name: "Kubernetes", tier: "self" },
    ],
    interests: ["Distributed systems", "Air quality", "Open data"],
    visibility: "PUBLIC",
    contactable: true,
  },
  {
    username: "meera-rao",
    name: "Dr Meera Rao",
    role: "faculty",
    headline: "Associate Professor, Computer Science & Engineering",
    bio: "I supervise final-year projects in applied machine learning and have spent more of my career than I would like reconstructing what students actually did from a report submitted on the last day. I care about project work that is documented while it happens.",
    collegeSlug: "nexivora-institute-of-technology",
    department: "Computer Science & Engineering",
    designation: "Associate Professor",
    expertise: ["Applied machine learning", "Time-series analysis", "Research methodology"],
    skills: [
      { name: "Applied machine learning", tier: "attested" },
      { name: "Research supervision", tier: "attested" },
      { name: "Statistical methods", tier: "attested" },
    ],
    interests: ["Project-based learning", "Assessment design", "Remote sensing"],
    achievements: [
      { title: "18 years supervising final-year projects", year: 2026 },
      { title: "Department coordinator, project-based learning", year: 2024 },
    ],
    visibility: "PUBLIC",
    contactable: true,
  },
  {
    username: "sunil-deshpande",
    name: "Prof. Sunil Deshpande",
    role: "faculty",
    headline: "Professor, Electronics & Communication",
    bio: "Electronics and embedded systems. My students build things that go outside, which means most of my supervision is about power, enclosure and what happens in the monsoon.",
    collegeSlug: "nexivora-institute-of-technology",
    department: "Electronics & Communication",
    designation: "Professor",
    expertise: ["Embedded systems", "Sensor networks", "Instrumentation"],
    skills: [
      { name: "Embedded systems", tier: "attested" },
      { name: "Sensor networks", tier: "attested" },
    ],
    interests: ["Field instrumentation", "Low-power design"],
    visibility: "PUBLIC",
    contactable: true,
  },
  {
    username: "lakshmi-menon",
    name: "Dr Lakshmi Menon",
    role: "faculty",
    headline: "Assistant Professor, Biotechnology",
    bio: "Diagnostics and public health. I am interested in student work that is honest about its limitations — a method with a stated failure mode is worth more than one with an impressive headline number.",
    collegeSlug: "nexivora-institute-of-technology",
    department: "Biotechnology",
    designation: "Assistant Professor",
    expertise: ["Diagnostics", "Public health", "Assay validation"],
    skills: [
      { name: "Diagnostics", tier: "attested" },
      { name: "Assay validation", tier: "attested" },
    ],
    interests: ["Point-of-care testing", "Rural health"],
    visibility: "PUBLIC",
    contactable: true,
  },
  {
    username: "nikhil-joshi",
    name: "Nikhil Joshi",
    role: "alumni",
    headline: "Data engineer · NIT Pune, class of 2021",
    bio: "Graduated in 2021, now a data engineer. I mentor two project groups a semester, mostly on the unglamorous part — how to structure a dataset so the model you want to train is even possible.",
    collegeSlug: "nexivora-institute-of-technology",
    department: "Computer Science & Engineering",
    graduationYear: 2021,
    currentRole: "Senior Data Engineer",
    organisation: "Fictional Analytics Pvt Ltd",
    skills: [
      { name: "Data engineering", tier: "self" },
      { name: "Python", tier: "self" },
      { name: "Mentorship", tier: "attested" },
    ],
    interests: ["Mentoring", "Data infrastructure"],
    visibility: "PUBLIC",
    contactable: true,
  },
];

export const personByUsername = Object.fromEntries(people.map((p) => [p.username, p])) as Record<
  string,
  Person
>;

/** Only public profiles reach any public surface. */
export const publicPeople = people.filter((p) => p.visibility === "PUBLIC");

export function displayName(username: string): string {
  return personByUsername[username]?.name ?? username;
}
