import type { $Enums, Prisma } from "@prisma/client";

import { belongsTo, type Viewer } from "@/lib/authz/viewer";
import { db } from "@/lib/db/client";

/**
 * Profile queries.
 *
 * **The rule that governs this whole module: hidden means absent from the
 * response, never hidden in the view.** A field that is fetched and then not
 * rendered is still in the RSC payload and still in "view source"; a field that
 * is fetched and CSS-hidden is a data leak that a crawler defeats without
 * trying. So the visibility decision happens *before* the select, and a field
 * the viewer may not see is never read from the database at all.
 *
 * The second rule: **a private profile must be indistinguishable from a
 * username that does not exist.** Any difference — a 403 rather than a 404, a
 * different page title, a different response time — turns this endpoint into a
 * username enumeration oracle. `getProfile` returns null for both.
 */

/* ----------------------------------------------------------- visibility */

export type FieldAudience = "PUBLIC" | "COLLEGE" | "PRIVATE";

/**
 * What the viewer is to this person: the internet, someone at their college, or
 * the person themselves. Resolved once, then every field decision reads it.
 */
export type ProfileRelation = "self" | "college" | "public";

function relationTo(
  viewer: Viewer,
  subject: { userId: string; collegeIds: readonly string[] },
): ProfileRelation {
  if (viewer.userId && viewer.userId === subject.userId) return "self";
  if (subject.collegeIds.some((collegeId) => belongsTo(viewer, collegeId))) return "college";
  return "public";
}

/** Whether a field set to `audience` is readable by someone in `relation`. */
export function canSeeField(audience: FieldAudience, relation: ProfileRelation): boolean {
  if (relation === "self") return true;
  if (audience === "PUBLIC") return true;
  if (audience === "COLLEGE") return relation === "college";
  return false;
}

/* --------------------------------------------------------------- lookup */

/**
 * The minimum needed to decide whether a profile is visible at all.
 *
 * Deliberately a separate query from the profile itself: the decision has to be
 * made before anything sensitive is selected, and doing it in one query would
 * mean loading the private fields to decide not to show them.
 */
async function profileGate(username: string) {
  return db.user.findFirst({
    where: { username: username.toLowerCase(), deletedAt: null },
    select: {
      id: true,
      privacy: {
        select: {
          profileVisibility: true,
          showEmail: true,
          showRollNumber: true,
          showProjects: true,
          showSkills: true,
          inCollegeDirectory: true,
          contactableByCompany: true,
        },
      },
      memberships: {
        where: { state: { in: ["ACTIVE", "ALUMNI"] } },
        select: { collegeId: true, college: { select: { verification: true } } },
      },
    },
  });
}

export type ProfileVisibility = {
  userId: string;
  relation: ProfileRelation;
  /** True when the whole profile is readable by this viewer. */
  visible: boolean;
  /** True when a crawler may index it — public profile at a verified college. */
  indexable: boolean;
  privacy: {
    showEmail: boolean;
    showRollNumber: boolean;
    showProjects: boolean;
    showSkills: boolean;
    contactableByCompany: boolean;
  };
};

/**
 * Resolve visibility without reading anything private.
 *
 * Returns null when the username does not exist **or** when the profile is not
 * visible to this viewer — the caller cannot tell which, and neither can an
 * attacker.
 */
export async function resolveProfileVisibility(
  viewer: Viewer,
  username: string,
): Promise<ProfileVisibility | null> {
  const gate = await profileGate(username);
  if (!gate) return null;

  const collegeIds = gate.memberships.map((membership) => membership.collegeId);
  const relation = relationTo(viewer, { userId: gate.id, collegeIds });

  const profileVisibility = (gate.privacy?.profileVisibility ?? "COLLEGE") as FieldAudience;
  const visible = viewer.isPlatformAdmin || canSeeField(profileVisibility, relation);

  if (!visible) return null;

  // Indexable only when the profile is public *and* at least one of the
  // person's colleges has completed verification — the same anti-abuse gate
  // that governs projects (ADR-010). An unverified college's members are not
  // publicly indexable, however public they set their own profile.
  const atVerifiedCollege = gate.memberships.some(
    (membership) => membership.college.verification === "VERIFIED",
  );

  return {
    userId: gate.id,
    relation,
    visible: true,
    indexable: profileVisibility === "PUBLIC" && atVerifiedCollege,
    privacy: {
      showEmail: gate.privacy?.showEmail ?? false,
      showRollNumber: gate.privacy?.showRollNumber ?? false,
      showProjects: gate.privacy?.showProjects ?? true,
      showSkills: gate.privacy?.showSkills ?? true,
      contactableByCompany: gate.privacy?.contactableByCompany ?? false,
    },
  };
}

/* -------------------------------------------------------------- profile */

export type ProfileSkill = {
  name: string;
  slug: string;
  source: $Enums.SkillSource;
  projectSlugs: string[];
};

export type PublicProfile = Awaited<ReturnType<typeof getProfile>>;

/**
 * The profile, with every field the viewer may not see **never read from the
 * database** rather than filtered afterwards.
 *
 * The sensitive fields are separate queries, run only when permitted, rather
 * than conditional spreads inside one select. Two reasons, and the second is
 * why it ended up this way:
 *
 *  · It makes the guarantee literal — an unentitled field is not fetched, so it
 *    cannot reach the markup, the RSC payload or "view source" by any route.
 *  · Prisma cannot infer a conditionally-spread select. The first version
 *    compiled to the *full* model type, which is exactly the shape that invites
 *    somebody to render a field the query was supposed to have withheld.
 *
 * The cost is two or three small queries instead of one. That is a cheap price
 * for a privacy rule that holds by construction.
 */
export async function getProfile(viewer: Viewer, username: string) {
  const gate = await resolveProfileVisibility(viewer, username);
  if (!gate) return null;

  const { relation, privacy } = gate;

  const user = await db.user.findUnique({
    where: { id: gate.userId },
    select: {
      id: true,
      username: true,
      name: true,
      headline: true,
      bio: true,
      pronouns: true,
      location: true,
      avatarUrl: true,
      createdAt: true,

      links: { select: { label: true, url: true } },
      achievements: {
        select: { title: true, year: true, detail: true },
        orderBy: { year: "desc" },
      },

      memberships: {
        where: { state: { in: ["ACTIVE", "ALUMNI"] } },
        select: {
          role: true,
          state: true,
          title: true,
          college: {
            select: { slug: true, name: true, shortName: true, verification: true },
          },
        },
      },

      studentProfile: {
        select: { year: true, interests: true, availableForTeams: true },
      },
      facultyProfile: {
        select: {
          designation: true,
          qualifications: true,
          expertise: true,
          researchInterests: true,
          officeHours: true,
          mentorshipAvailable: true,
        },
      },
      alumniProfile: {
        select: {
          graduationYear: true,
          programme: true,
          currentRole: true,
          organisation: true,
          industry: true,
          mentorshipAvailable: true,
        },
      },
      researcherProfile: {
        select: { affiliation: true, field: true, orcid: true, interests: true },
      },
      companyProfile: {
        select: {
          slug: true,
          name: true,
          industry: true,
          size: true,
          website: true,
          description: true,
          focusAreas: true,
          verification: true,
        },
      },
    },
  });

  if (!user) return null;

  /*
   * The entitled-only reads. Each runs only when the person opted in and the
   * viewer qualifies, so an unentitled field is null because it was never
   * queried — not because something filtered it out afterwards.
   */

  const skills = privacy.showSkills
    ? await db.userSkill.findMany({
        where: { userId: gate.userId },
        select: { source: true, projectIds: true, skill: { select: { name: true, slug: true } } },
      })
    : [];

  // An email is only ever shown to someone inside the college or to the person
  // themselves — never to the open internet, whatever the toggle says.
  const contact =
    privacy.showEmail && relation !== "public"
      ? await db.user.findUnique({ where: { id: gate.userId }, select: { email: true } })
      : null;

  // A roll number is institutional data, held to the same rule.
  const rollNumber =
    privacy.showRollNumber && relation !== "public"
      ? ((
          await db.studentProfile.findUnique({
            where: { userId: gate.userId },
            select: { rollNumber: true },
          })
        )?.rollNumber ?? null)
      : null;

  return {
    ...user,
    skills,
    email: contact?.email ?? null,
    rollNumber,
    relation,
    indexable: gate.indexable,
    privacy,
  };
}

/**
 * Usernames for `generateStaticParams` and the sitemap.
 *
 * Public **and** at a verified college. A private profile is absent from the
 * sitemap by construction rather than by a filter someone has to remember
 * (acceptance criterion 3).
 */
export async function publicProfileUsernames(): Promise<string[]> {
  const rows = await db.user.findMany({
    where: {
      deletedAt: null,
      privacy: { profileVisibility: "PUBLIC" },
      memberships: {
        some: {
          state: { in: ["ACTIVE", "ALUMNI"] },
          college: { verification: "VERIFIED" },
        },
      },
    },
    select: { username: true },
    orderBy: { username: "asc" },
  });

  return rows.map((row) => row.username);
}

/* --------------------------------------------------------------- editing */

/** The profile as its owner edits it — everything, because it is theirs. */
export async function getOwnProfile(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      usernameLockedAt: true,
      name: true,
      email: true,
      headline: true,
      bio: true,
      pronouns: true,
      location: true,
      timezone: true,
      avatarUrl: true,
      createdAt: true,
      privacy: true,
      links: { select: { id: true, label: true, url: true } },
      achievements: { select: { id: true, title: true, year: true, detail: true } },
      skills: {
        select: {
          id: true,
          source: true,
          projectIds: true,
          skill: { select: { name: true, slug: true } },
        },
      },
      studentProfile: true,
      facultyProfile: true,
      alumniProfile: true,
      researcherProfile: true,
      companyProfile: true,
      memberships: {
        select: {
          role: true,
          state: true,
          collegeId: true,
          college: { select: { name: true, shortName: true } },
        },
      },
    },
  });
}

/**
 * Profile completeness.
 *
 * Returns **the next specific thing to do**, not just a percentage. A bare
 * number tells somebody they are incomplete without telling them how to stop
 * being incomplete, which is the difference between a nudge and a nag.
 */
export type Completeness = {
  percent: number;
  done: string[];
  next: { label: string; href: string } | null;
};

export function profileCompleteness(profile: {
  headline: string | null;
  bio: string | null;
  location: string | null;
  avatarUrl: string | null;
  links: unknown[];
  skills: unknown[];
  studentProfile: { interests: string[] } | null;
  privacy: { profileVisibility: string } | null;
}): Completeness {
  const steps: Array<{ key: string; label: string; href: string; done: boolean }> = [
    {
      key: "headline",
      label: "Add a headline — one line on what you work on",
      href: "/settings/profile",
      done: Boolean(profile.headline?.trim()),
    },
    {
      key: "bio",
      label: "Write a short bio",
      href: "/settings/profile",
      done: Boolean(profile.bio && profile.bio.trim().length > 40),
    },
    {
      key: "skills",
      label: "Claim a few skills — projects will add evidence to them later",
      href: "/settings/profile",
      done: profile.skills.length > 0,
    },
    {
      key: "interests",
      label: "Add your interests, so we can suggest teammates",
      href: "/settings/profile",
      done: (profile.studentProfile?.interests.length ?? 0) > 0,
    },
    {
      key: "links",
      label: "Link something — a repository, a site, a paper",
      href: "/settings/profile",
      done: profile.links.length > 0,
    },
    {
      key: "location",
      label: "Add where you are",
      href: "/settings/profile",
      done: Boolean(profile.location?.trim()),
    },
    {
      key: "visibility",
      label: "Decide who can see your profile — it is private until you choose",
      href: "/settings/privacy",
      done: profile.privacy?.profileVisibility !== undefined,
    },
  ];

  const done = steps.filter((step) => step.done);
  const next = steps.find((step) => !step.done) ?? null;

  return {
    percent: Math.round((done.length / steps.length) * 100),
    done: done.map((step) => step.key),
    next: next ? { label: next.label, href: next.href } : null,
  };
}

/* ---------------------------------------------------------------- search */

/**
 * The people directory for a college. Honours the same three gates as
 * `publicDirectory` in `institution.ts`, and is scoped to what the viewer may
 * see rather than to what exists.
 */
export async function listProfiles(
  viewer: Viewer,
  options: { collegeId?: string; role?: $Enums.Role; take?: number } = {},
) {
  const { collegeId, role, take = 24 } = options;

  const audienceFilter: Prisma.UserWhereInput =
    viewer.userId === null
      ? { privacy: { profileVisibility: "PUBLIC", discoverableInSearch: true } }
      : {
          OR: [
            { privacy: { profileVisibility: "PUBLIC" } },
            {
              privacy: { profileVisibility: "COLLEGE" },
              memberships: {
                some: {
                  collegeId: { in: [...new Set(viewer.memberships.map((m) => m.collegeId))] },
                },
              },
            },
          ],
        };

  return db.user.findMany({
    where: {
      deletedAt: null,
      ...audienceFilter,
      memberships: {
        some: {
          state: { in: ["ACTIVE", "ALUMNI"] },
          ...(collegeId ? { collegeId } : {}),
          ...(role ? { role } : {}),
        },
      },
    },
    select: {
      id: true,
      username: true,
      name: true,
      headline: true,
      avatarUrl: true,
      memberships: {
        select: { role: true, college: { select: { shortName: true, slug: true } } },
      },
    },
    orderBy: { name: "asc" },
    take,
  });
}
