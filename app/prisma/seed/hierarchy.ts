import type { PrismaClient } from "@prisma/client";

import { colleges } from "../../src/content/colleges.ts";
import { projects } from "../../src/content/projects.ts";
import { iso, seedId, step } from "./lib.ts";

/**
 * College → Department → Programme → Subject → Term → Class.
 *
 * The hierarchy is the spine of the whole permission model: almost every
 * authorisation question resolves to "is this row inside the viewer's college".
 * Getting it wrong here makes every later phase leak or over-block.
 */

export const collegeId = (slug: string) => seedId("college", slug);
export const departmentId = (college: string, name: string) => seedId("dept", college, name);
export const programmeId = (college: string, code: string) => seedId("prog", college, code);
export const subjectId = (college: string, code: string) => seedId("subject", college, code);
export const termId = (college: string, name: string) => seedId("term", college, name);
export const classId = (college: string, subject: string, term: string, section: string) =>
  seedId("class", college, subject, term, section);

const EMAIL_DOMAIN: Record<string, string[]> = {
  "nexivora-institute-of-technology": ["nit.edu.in"],
  "meridian-college-of-engineering": ["meridian.ac.in"],
  "greenfield-institute": ["greenfield.edu.in"],
};

/** A stable short code from a department name: "Computer Science & Engineering" → "CSE". */
function departmentCode(name: string): string {
  const words = name.replace(/&/g, " ").split(/\s+/).filter(Boolean);
  const code = words.map((word) => word[0]?.toUpperCase() ?? "").join("");
  return code.slice(0, 5);
}

/**
 * Academic terms in the Indian convention: an Odd term runs July–December, an
 * Even term January–May of the following calendar year. Parsed from the label
 * the content fixtures already use, rather than maintained as a second list.
 */
function termDates(name: string): { startsOn: Date; endsOn: Date } {
  const match = /^(Odd|Even)\s+(\d{4})-(\d{2})$/.exec(name);
  if (!match) throw new Error(`Seed: cannot parse term "${name}"`);

  const [, parity, startYear] = match;
  const year = Number(startYear);

  return parity === "Odd"
    ? { startsOn: iso(`${year}-07-15`), endsOn: iso(`${year}-12-20`) }
    : { startsOn: iso(`${year + 1}-01-05`), endsOn: iso(`${year + 1}-05-25`) };
}

/** Subjects every engineering department runs, plus the two project subjects. */
const SUBJECT_CATALOGUE: Record<
  string,
  Array<{ name: string; credits: number; semester: number }>
> = {
  "Computer Science & Engineering": [
    { name: "Data Structures & Algorithms", credits: 4, semester: 3 },
    { name: "Database Management Systems", credits: 4, semester: 4 },
    { name: "Machine Learning", credits: 4, semester: 6 },
    { name: "Software Engineering", credits: 3, semester: 5 },
    { name: "Computer Networks", credits: 4, semester: 5 },
  ],
  "Electronics & Communication": [
    { name: "Embedded Systems", credits: 4, semester: 5 },
    { name: "Signal Processing", credits: 4, semester: 4 },
    { name: "VLSI Design", credits: 3, semester: 6 },
  ],
  "Mechanical Engineering": [
    { name: "Thermodynamics", credits: 4, semester: 3 },
    { name: "Machine Design", credits: 4, semester: 5 },
    { name: "Manufacturing Processes", credits: 3, semester: 4 },
  ],
  Biotechnology: [
    { name: "Molecular Biology", credits: 4, semester: 4 },
    { name: "Bioprocess Engineering", credits: 4, semester: 5 },
    { name: "Bioinformatics", credits: 3, semester: 6 },
  ],
  "Applied Sciences": [
    { name: "Applied Physics", credits: 3, semester: 1 },
    { name: "Engineering Mathematics", credits: 4, semester: 2 },
  ],
  "Civil Engineering": [
    { name: "Structural Analysis", credits: 4, semester: 4 },
    { name: "Environmental Engineering", credits: 3, semester: 6 },
  ],
  "Information Technology": [
    { name: "Web Technologies", credits: 3, semester: 4 },
    { name: "Cloud Computing", credits: 3, semester: 6 },
  ],
};

/** Every department runs these two, and they are what projects are attached to. */
const PROJECT_SUBJECTS = [
  { name: "Minor Project", credits: 2, semester: 6 },
  { name: "Major Project", credits: 6, semester: 8 },
];

const PROGRAMME_FOR: Record<string, { name: string; code: string; degreeType: string }> = {
  "Computer Science & Engineering": {
    name: "B.Tech Computer Science & Engineering",
    code: "BTECH-CSE",
    degreeType: "B.Tech",
  },
  "Electronics & Communication": {
    name: "B.Tech Electronics & Communication",
    code: "BTECH-ECE",
    degreeType: "B.Tech",
  },
  "Mechanical Engineering": {
    name: "B.Tech Mechanical Engineering",
    code: "BTECH-ME",
    degreeType: "B.Tech",
  },
  Biotechnology: { name: "B.Tech Biotechnology", code: "BTECH-BT", degreeType: "B.Tech" },
  "Applied Sciences": { name: "B.Sc Applied Sciences", code: "BSC-AS", degreeType: "B.Sc" },
  "Civil Engineering": { name: "B.Tech Civil Engineering", code: "BTECH-CE", degreeType: "B.Tech" },
  "Information Technology": {
    name: "B.Tech Information Technology",
    code: "BTECH-IT",
    degreeType: "B.Tech",
  },
};

export type Hierarchy = {
  /** Department names present at each college, in a stable order. */
  departmentsByCollege: Map<string, string[]>;
  /** Every subject row, so people.ts and groups.ts can attach to real ones. */
  subjects: Array<{
    id: string;
    collegeSlug: string;
    department: string;
    name: string;
    code: string;
  }>;
  classes: Array<{
    id: string;
    collegeSlug: string;
    subjectId: string;
    termName: string;
    section: string;
  }>;
  termNames: string[];
};

export async function seedHierarchy(db: PrismaClient): Promise<Hierarchy> {
  /* ------------------------------------------------------------ colleges */

  await db.college.createMany({
    data: colleges.map((college) => ({
      id: collegeId(college.slug),
      slug: college.slug,
      name: college.name,
      shortName: college.shortName,
      code: college.code,
      city: college.city,
      state: college.state,
      website: college.website ?? null,
      description: college.description,
      foundingDate: college.foundingDate ?? null,
      // The gate everything else hangs off: an unverified college is never
      // publicly indexable and never appears in inter-college surfaces.
      verification: college.verified ? "VERIFIED" : "UNVERIFIED",
      verifiedAt: college.verified ? iso("2025-06-01") : null,
      emailDomains: EMAIL_DOMAIN[college.slug] ?? [],
    })),
  });
  step("colleges", colleges.length);

  /* --------------------------------------------------------- departments */

  // A department the fixtures forgot to list but a project belongs to is a real
  // gap — take the union rather than dropping the project's home.
  const departmentsByCollege = new Map<string, string[]>();

  for (const college of colleges) {
    const fromProjects = projects
      .filter((project) => project.collegeSlug === college.slug)
      .map((project) => project.department);

    departmentsByCollege.set(college.slug, [...new Set([...college.departments, ...fromProjects])]);
  }

  const departmentRows = [...departmentsByCollege].flatMap(([slug, names]) =>
    names.map((name) => ({
      id: departmentId(slug, name),
      collegeId: collegeId(slug),
      name,
      code: departmentCode(name),
    })),
  );

  await db.department.createMany({ data: departmentRows });
  step("departments", departmentRows.length);

  /* ---------------------------------------------------------- programmes */

  const programmeRows = [...departmentsByCollege].flatMap(([slug, names]) =>
    names
      .map((name) => {
        const programme = PROGRAMME_FOR[name];
        if (!programme) return null;

        return {
          id: programmeId(slug, programme.code),
          collegeId: collegeId(slug),
          departmentId: departmentId(slug, name),
          name: programme.name,
          code: programme.code,
          degreeType: programme.degreeType,
          durationYears: programme.degreeType === "B.Sc" ? 3 : 4,
        };
      })
      .filter((row) => row !== null),
  );

  await db.programme.createMany({ data: programmeRows });
  step("programmes", programmeRows.length);

  /* ------------------------------------------------------------ subjects */

  const subjects: Hierarchy["subjects"] = [];

  for (const [slug, names] of departmentsByCollege) {
    for (const department of names) {
      const catalogue = [...(SUBJECT_CATALOGUE[department] ?? []), ...PROJECT_SUBJECTS];
      const prefix = departmentCode(department);

      catalogue.forEach((subject, index) => {
        const code = `${prefix}${String(index + 101).padStart(3, "0")}`;
        subjects.push({
          id: subjectId(slug, code),
          collegeSlug: slug,
          department,
          name: subject.name,
          code,
        });
      });
    }
  }

  await db.subject.createMany({
    data: subjects.map((subject) => {
      const programme = PROGRAMME_FOR[subject.department];
      const catalogue = [...(SUBJECT_CATALOGUE[subject.department] ?? []), ...PROJECT_SUBJECTS];
      const entry = catalogue.find((item) => item.name === subject.name);

      return {
        id: subject.id,
        collegeId: collegeId(subject.collegeSlug),
        departmentId: departmentId(subject.collegeSlug, subject.department),
        programmeId: programme ? programmeId(subject.collegeSlug, programme.code) : null,
        name: subject.name,
        code: subject.code,
        credits: entry?.credits ?? 3,
        semester: entry?.semester ?? null,
      };
    }),
  });
  step("subjects", subjects.length);

  /* --------------------------------------------------------------- terms */

  const termNames = [...new Set(projects.map((project) => project.term))].sort();

  const termRows = colleges.flatMap((college) =>
    termNames.map((name) => {
      const { startsOn, endsOn } = termDates(name);
      return {
        id: termId(college.slug, name),
        collegeId: collegeId(college.slug),
        name,
        startsOn,
        endsOn,
        // The term the demo is "currently" in.
        isActive: name === "Odd 2026-27",
      };
    }),
  );

  await db.term.createMany({ data: termRows });
  step("terms", termRows.length);

  /* ------------------------------------------------------------- classes */

  const classes: Hierarchy["classes"] = [];

  for (const subject of subjects) {
    // Only the current and previous term run classes — seeding a class for
    // every subject in every term produces thousands of rows no phase reads.
    for (const termName of ["Even 2025-26", "Odd 2026-27"]) {
      const section = subject.name.includes("Project") ? "A" : "A";
      classes.push({
        id: classId(subject.collegeSlug, subject.code, termName, section),
        collegeSlug: subject.collegeSlug,
        subjectId: subject.id,
        termName,
        section,
      });
    }
  }

  await db.class.createMany({
    data: classes.map((klass) => ({
      id: klass.id,
      collegeId: collegeId(klass.collegeSlug),
      subjectId: klass.subjectId,
      termId: termId(klass.collegeSlug, klass.termName),
      section: klass.section,
    })),
  });
  step("classes", classes.length);

  return { departmentsByCollege, subjects, classes, termNames };
}
