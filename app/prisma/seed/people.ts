import type { $Enums, Prisma, PrismaClient } from "@prisma/client";

import { colleges } from "../../src/content/colleges.ts";
import { people } from "../../src/content/people.ts";
import { projects } from "../../src/content/projects.ts";
import { collegeId, departmentId, programmeId } from "./hierarchy.ts";
import { DEMO_PASSWORD_HASH, PROOF_TIER, iso, seedId, step, type Rng } from "./lib.ts";

/**
 * The cast.
 *
 * The twelve people in `src/content/people.ts` are rendered by the public site
 * and are imported verbatim — their pages must look identical after Phase 5
 * swaps the imports from fixtures to queries. Everyone else here is cohort
 * filler: they populate class lists, group rosters and the ledger, and no
 * public page renders them.
 *
 * Names are drawn from a pool rather than invented per row, because a demo
 * where every student is "Test User 47" is a demo nobody believes — and
 * believability is the entire point of the seed (docs/phases/phase-03).
 */

export const userId = (username: string) => seedId("user", username);
const skillId = (name: string) => seedId("skill", name.toLowerCase());

const FIRST_NAMES = [
  "Aarav",
  "Aditi",
  "Advait",
  "Ananya",
  "Anirudh",
  "Anjali",
  "Arnav",
  "Bhavya",
  "Chirag",
  "Devika",
  "Dhruv",
  "Esha",
  "Gaurav",
  "Harini",
  "Ishaan",
  "Ishita",
  "Jatin",
  "Kavya",
  "Kabir",
  "Lavanya",
  "Manav",
  "Meghna",
  "Naveen",
  "Neha",
  "Nikita",
  "Om",
  "Pallavi",
  "Pranav",
  "Rhea",
  "Rithik",
  "Sanjana",
  "Shaurya",
  "Simran",
  "Tanvi",
  "Tushar",
  "Vaishnavi",
  "Varun",
  "Yash",
  "Zara",
  "Aditya",
  "Krishna",
  "Nandini",
  "Rahul",
  "Swara",
  "Vihaan",
  "Aisha",
  "Farhan",
  "Imran",
  "Reema",
  "Sameer",
  "Ayesha",
  "Kunal",
];

const LAST_NAMES = [
  "Agarwal",
  "Banerjee",
  "Chauhan",
  "Desai",
  "Fernandes",
  "Gupta",
  "Hegde",
  "Iyengar",
  "Jain",
  "Kulkarni",
  "Lal",
  "Malhotra",
  "Nadkarni",
  "Oberoi",
  "Pillai",
  "Qureshi",
  "Reddy",
  "Sharma",
  "Thakur",
  "Upadhyay",
  "Varma",
  "Wadhwa",
  "Yadav",
  "Zutshi",
  "Bhatt",
  "Chatterjee",
  "Dutta",
  "Ghosh",
  "Krishnan",
  "Menon",
  "Nair",
  "Rao",
  "Saxena",
  "Trivedi",
];

const HEADLINES = [
  "Third-year student, curious about systems that survive contact with users",
  "Building things that work offline first",
  "Interested in embedded work and the physics underneath it",
  "Data pipelines, and the boring parts that make them reliable",
  "Trying to write less code that does more",
  "Front-end, accessibility, and arguing about form validation",
  "Prefers a working prototype to a perfect proposal",
  "Sensors, calibration drift, and field testing",
];

const FACULTY_NAMES = [
  {
    name: "Dr Anand Krishnan",
    designation: "Professor",
    department: "Computer Science & Engineering",
  },
  {
    name: "Dr Rekha Sundaram",
    designation: "Associate Professor",
    department: "Computer Science & Engineering",
  },
  {
    name: "Prof. Vikram Bose",
    designation: "Assistant Professor",
    department: "Electronics & Communication",
  },
  { name: "Dr Shalini Gupta", designation: "Professor", department: "Biotechnology" },
  {
    name: "Dr Prakash Nayak",
    designation: "Associate Professor",
    department: "Mechanical Engineering",
  },
  { name: "Prof. Nandita Sen", designation: "Assistant Professor", department: "Applied Sciences" },
  {
    name: "Dr Ravi Shankar",
    designation: "Professor",
    department: "Computer Science & Engineering",
  },
  {
    name: "Dr Kavitha Balan",
    designation: "Associate Professor",
    department: "Electronics & Communication",
  },
  {
    name: "Prof. Imtiaz Ahmed",
    designation: "Assistant Professor",
    department: "Mechanical Engineering",
  },
];

const ALUMNI_NAMES = [
  { name: "Shreya Kapoor", role: "Data Engineer", organisation: "HydroSense Systems", year: 2022 },
  { name: "Aman Bhatia", role: "Firmware Engineer", organisation: "TerraVolt Energy", year: 2021 },
  {
    name: "Divya Raghavan",
    role: "Product Manager",
    organisation: "Lumen Learning Technologies",
    year: 2020,
  },
  {
    name: "Tarun Shetty",
    role: "Research Associate",
    organisation: "Centre for Applied Water Research",
    year: 2023,
  },
  {
    name: "Fatima Sheikh",
    role: "Backend Engineer",
    organisation: "BrightPath Consulting",
    year: 2022,
  },
];

const ADMIN_NAMES = [
  { name: "Rajesh Kumar", title: "Registrar", college: "nexivora-institute-of-technology" },
  { name: "Sudha Ramesh", title: "Dean of Academics", college: "nexivora-institute-of-technology" },
  { name: "Mohan Pillai", title: "Registrar", college: "meridian-college-of-engineering" },
];

export type Cast = {
  /** username → college slug, for every seeded person. */
  collegeOf: Map<string, string>;
  /** username → department name. */
  departmentOf: Map<string, string>;
  studentsByCollege: Map<string, string[]>;
  facultyByCollege: Map<string, string[]>;
  /** The fixture people, who are the ones the public site renders. */
  fixtureUsernames: string[];
  /** Full name → username, for resolving `facultyGuide` and `attestedBy`. */
  usernameByName: Map<string, string>;
  allUsernames: string[];
};

const emailDomain: Record<string, string> = {
  "nexivora-institute-of-technology": "nit.edu.in",
  "meridian-college-of-engineering": "meridian.ac.in",
  "greenfield-institute": "greenfield.edu.in",
};

type UserRow = {
  id: string;
  email: string;
  passwordHash: string;
  emailVerified: Date | null;
  username: string;
  name: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  createdAt: Date;
};

export async function seedPeople(db: PrismaClient, rng: Rng): Promise<Cast> {
  const users: UserRow[] = [];
  const memberships: Prisma.MembershipCreateManyInput[] = [];
  const privacy: Prisma.PrivacySettingCreateManyInput[] = [];

  const collegeOf = new Map<string, string>();
  const departmentOf = new Map<string, string>();
  const studentsByCollege = new Map<string, string[]>();
  const facultyByCollege = new Map<string, string[]>();
  const usernameByName = new Map<string, string>();

  for (const college of colleges) {
    studentsByCollege.set(college.slug, []);
    facultyByCollege.set(college.slug, []);
  }

  const enrolAt = iso("2025-07-20");

  const addUser = (
    username: string,
    name: string,
    collegeSlug: string,
    department: string,
    role: $Enums.Role,
    options: {
      headline?: string;
      bio?: string;
      title?: string;
      state?: $Enums.MembershipState;
      contactable?: boolean;
      profileVisibility?: $Enums.Visibility;
      discoverable?: boolean;
    } = {},
  ) => {
    const id = userId(username);

    users.push({
      id,
      email: `${username}@${emailDomain[collegeSlug] ?? "nexivora.com"}`,
      passwordHash: DEMO_PASSWORD_HASH,
      emailVerified: enrolAt,
      username,
      name,
      headline: options.headline ?? null,
      bio: options.bio ?? null,
      location: colleges.find((c) => c.slug === collegeSlug)?.city ?? null,
      createdAt: enrolAt,
    });

    memberships.push({
      id: seedId("membership", username, collegeSlug, role),
      userId: id,
      collegeId: collegeId(collegeSlug),
      role,
      state: options.state ?? "ACTIVE",
      title: options.title ?? null,
      joinedAt: enrolAt,
    });

    privacy.push({
      id: seedId("privacy", username),
      userId: id,
      // Everything defaults to the most private useful setting; the fixtures
      // opt individuals out of that, never the other way round.
      profileVisibility: options.profileVisibility ?? "COLLEGE",
      contactableByCompany: options.contactable ?? false,
      discoverableInSearch: options.discoverable ?? false,
      inCollegeDirectory: true,
    });

    collegeOf.set(username, collegeSlug);
    departmentOf.set(username, department);
    usernameByName.set(name, username);

    if (role === "STUDENT") studentsByCollege.get(collegeSlug)?.push(username);
    if (role === "FACULTY") facultyByCollege.get(collegeSlug)?.push(username);

    return id;
  };

  /* ------------------------------------------------- the fixture twelve */

  const ROLE_FOR: Record<string, $Enums.Role> = {
    student: "STUDENT",
    faculty: "FACULTY",
    alumni: "ALUMNI",
    researcher: "RESEARCHER",
  };

  for (const person of people) {
    addUser(
      person.username,
      person.name,
      person.collegeSlug,
      person.department,
      ROLE_FOR[person.role] ?? "STUDENT",
      {
        headline: person.headline,
        bio: person.bio,
        title: person.designation,
        contactable: person.contactable,
        profileVisibility: person.visibility,
        // A public profile is the one case where search discovery is intended.
        discoverable: person.visibility === "PUBLIC",
      },
    );
  }

  /* ------------------------------------------------------ generated cast */

  const used = new Set(people.map((person) => person.username));
  const nextUsername = (name: string) => {
    const base = name
      .toLowerCase()
      .replace(/[^a-z]+/g, "-")
      .replace(/^-|-$/g, "");
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) candidate = `${base}-${suffix++}`;
    used.add(candidate);
    return candidate;
  };

  // Faculty first — projects reference them as guides.
  for (const faculty of FACULTY_NAMES) {
    const username = nextUsername(faculty.name);
    addUser(
      username,
      faculty.name,
      "nexivora-institute-of-technology",
      faculty.department,
      "FACULTY",
      {
        headline: `${faculty.designation}, ${faculty.department}`,
        title: faculty.designation,
        profileVisibility: "COLLEGE",
      },
    );
  }

  for (const admin of ADMIN_NAMES) {
    const username = nextUsername(admin.name);
    addUser(username, admin.name, admin.college, "Administration", "COLLEGE_ADMIN", {
      headline: admin.title,
      title: admin.title,
    });
  }

  for (const alumnus of ALUMNI_NAMES) {
    const username = nextUsername(alumnus.name);
    addUser(
      username,
      alumnus.name,
      "nexivora-institute-of-technology",
      "Computer Science & Engineering",
      "ALUMNI",
      {
        headline: `${alumnus.role} at ${alumnus.organisation}`,
        // An alumnus is the same account in a new state, not a new account.
        state: "ALUMNI",
        contactable: true,
        profileVisibility: "COLLEGE",
      },
    );
  }

  addUser(
    "nexivora-admin",
    "Platform Operations",
    "nexivora-institute-of-technology",
    "Administration",
    "PLATFORM_ADMIN",
    {
      headline: "Nexivora platform operations",
    },
  );

  // The student cohort. Weighted towards the main college, because that is the
  // one the demo walks through.
  const cohortPlan: Array<{ college: string; count: number }> = [
    { college: "nexivora-institute-of-technology", count: 40 },
    { college: "meridian-college-of-engineering", count: 8 },
    { college: "greenfield-institute", count: 4 },
  ];

  for (const plan of cohortPlan) {
    const college = colleges.find((item) => item.slug === plan.college);
    const departments = college?.departments ?? ["Computer Science & Engineering"];

    for (let i = 0; i < plan.count; i += 1) {
      const name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
      const username = nextUsername(name);
      const department = rng.pick(departments);

      addUser(username, name, plan.college, department, "STUDENT", {
        headline: rng.pick(HEADLINES),
        // Cohort filler stays college-visible: the public directory should show
        // the people who chose to be there, not everyone who has an account.
        profileVisibility: "COLLEGE",
      });
    }
  }

  await db.user.createMany({ data: users });
  step("users", users.length);

  await db.membership.createMany({ data: memberships });
  await db.privacySetting.createMany({ data: privacy });
  step("memberships + privacy", memberships.length);

  /* ------------------------------------------------------------ profiles */

  const studentProfiles = [];
  const facultyProfiles = [];
  const alumniProfiles = [];

  for (const person of people) {
    if (person.role === "student") {
      studentProfiles.push({
        id: seedId("sprofile", person.username),
        userId: userId(person.username),
        collegeId: collegeId(person.collegeSlug),
        departmentId: departmentId(person.collegeSlug, person.department),
        programmeId: null,
        year: person.year ?? null,
        rollNumber: `NIT${2200 + rng.int(1, 99)}`,
        interests: person.interests,
      });
    } else if (person.role === "faculty") {
      facultyProfiles.push({
        id: seedId("fprofile", person.username),
        userId: userId(person.username),
        collegeId: collegeId(person.collegeSlug),
        departmentId: departmentId(person.collegeSlug, person.department),
        designation: person.designation ?? null,
        expertise: person.expertise ?? [],
        researchInterests: person.interests,
        mentorshipAvailable: true,
        mentorshipCapacity: 3,
      });
    } else if (person.role === "alumni") {
      alumniProfiles.push({
        id: seedId("aprofile", person.username),
        userId: userId(person.username),
        collegeId: collegeId(person.collegeSlug),
        graduationYear: person.graduationYear ?? 2021,
        currentRole: person.currentRole ?? null,
        organisation: person.organisation ?? null,
        mentorshipAvailable: true,
        mentorshipCapacity: 2,
      });
    }
  }

  for (const faculty of FACULTY_NAMES) {
    const username = usernameByName.get(faculty.name);
    if (!username) continue;

    facultyProfiles.push({
      id: seedId("fprofile", username),
      userId: userId(username),
      collegeId: collegeId("nexivora-institute-of-technology"),
      departmentId: departmentId("nexivora-institute-of-technology", faculty.department),
      designation: faculty.designation,
      expertise: [],
      researchInterests: [],
      mentorshipAvailable: rng.chance(0.6),
      mentorshipCapacity: 2,
    });
  }

  for (const alumnus of ALUMNI_NAMES) {
    const username = usernameByName.get(alumnus.name);
    if (!username) continue;

    alumniProfiles.push({
      id: seedId("aprofile", username),
      userId: userId(username),
      collegeId: collegeId("nexivora-institute-of-technology"),
      graduationYear: alumnus.year,
      currentRole: alumnus.role,
      organisation: alumnus.organisation,
      mentorshipAvailable: true,
      mentorshipCapacity: 2,
    });
  }

  for (const [username, collegeSlug] of collegeOf) {
    const isFixture = people.some((person) => person.username === username);
    const isGenerated = !isFixture;
    const membership = memberships.find((row) => row.userId === userId(username));

    if (!isGenerated || membership?.role !== "STUDENT") continue;

    const department = departmentOf.get(username) ?? "Computer Science & Engineering";
    const programme = programmeId(collegeSlug, "BTECH-CSE");

    studentProfiles.push({
      id: seedId("sprofile", username),
      userId: userId(username),
      collegeId: collegeId(collegeSlug),
      departmentId: departmentId(collegeSlug, department),
      programmeId: department === "Computer Science & Engineering" ? programme : null,
      year: rng.int(2, 4),
      rollNumber: `${collegeSlug.slice(0, 3).toUpperCase()}${rng.int(22000, 22999)}`,
      interests: [],
    });
  }

  await db.studentProfile.createMany({ data: studentProfiles });
  await db.facultyProfile.createMany({ data: facultyProfiles });
  await db.alumniProfile.createMany({ data: alumniProfiles });
  step("profiles", studentProfiles.length + facultyProfiles.length + alumniProfiles.length);

  /* -------------------------------------------------------------- skills */

  const skillNames = [
    ...new Set(people.flatMap((person) => person.skills.map((skill) => skill.name))),
  ];

  await db.skill.createMany({
    data: skillNames.map((name) => ({
      id: skillId(name),
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name,
    })),
  });

  // The project count behind an inferred skill has to be real: the whole claim
  // of the profile is that it is evidence, not assertion.
  const projectsByMember = new Map<string, number>();
  for (const project of projects) {
    for (const member of project.members) {
      projectsByMember.set(member.username, (projectsByMember.get(member.username) ?? 0) + 1);
    }
  }

  await db.userSkill.createMany({
    data: people.flatMap((person) =>
      person.skills.map((skill) => ({
        id: seedId("uskill", person.username, skill.name),
        userId: userId(person.username),
        skillId: skillId(skill.name),
        source:
          PROOF_TIER[skill.tier] === "SELF"
            ? "SELF"
            : PROOF_TIER[skill.tier] === "FACULTY_ATTESTED"
              ? "ATTESTED"
              : "PROJECT_INFERRED",
        projectIds: [],
      })),
    ),
  });
  step("skills", skillNames.length);

  await db.userLink.createMany({
    data: people.flatMap((person) =>
      (person.links ?? []).map((link, index) => ({
        id: seedId("ulink", person.username, index),
        userId: userId(person.username),
        label: link.label,
        url: link.url,
      })),
    ),
  });

  await db.achievement.createMany({
    data: people.flatMap((person) =>
      (person.achievements ?? []).map((achievement, index) => ({
        id: seedId("achv", person.username, index),
        userId: userId(person.username),
        title: achievement.title,
        year: achievement.year,
        detail: achievement.detail ?? null,
      })),
    ),
  });

  return {
    collegeOf,
    departmentOf,
    studentsByCollege,
    facultyByCollege,
    fixtureUsernames: people.map((person) => person.username),
    usernameByName,
    allUsernames: [...collegeOf.keys()],
  };
}
