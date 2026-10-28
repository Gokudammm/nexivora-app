import type { Metadata } from "next";
import Link from "next/link";

import { ExternalIcon, LockIcon } from "@/components/icons";
import { Container } from "@/components/layout/primitives";
import { ProjectCard } from "@/components/project/project-card";
import { Avatar, Badge, Card, Divider, TierBadge } from "@/components/ui/display";
import { Breadcrumbs } from "@/components/ui/navigation";
import { ANONYMOUS } from "@/lib/authz/viewer";
import { currentViewer } from "@/lib/auth/session";
import { toContentProjectCard } from "@/lib/db/queries/adapters";
import { getProfile, publicProfileUsernames } from "@/lib/db/queries/profile";
import { listProjects } from "@/lib/db/queries/projects";
import { mergeSkills } from "@/lib/skills/infer";
import { JsonLd, breadcrumbList, personProfile } from "@/lib/seo/jsonld";
import { buildMetadata, ensureDescription } from "@/lib/seo/metadata";

/**
 * The public academic profile. Database-backed as of Phase 6.
 *
 * Two privacy properties matter more than anything else here, and both are
 * enforced by **not fetching** rather than by hiding:
 *
 *  1. **Hidden means absent from the HTML.** `getProfile` omits a field the
 *     viewer may not see from the *query*, so it is not in the markup, not in
 *     the RSC payload, and not in "view source". Rendering a private field and
 *     hiding it with CSS is a leak that any crawler defeats without trying.
 *  2. **A private profile is indistinguishable from a username that does not
 *     exist.** Both render the same page, with the same title and the same
 *     status. Any difference turns this route into a username enumeration
 *     oracle.
 *
 * Contact details are additionally wrapped in `data-nosnippet`, so they cannot
 * surface in a search snippet even when the person has made them public.
 */

/**
 * Dynamic, unlike the fixture version.
 *
 * A profile's visibility is now something its owner changes at runtime, so the
 * set of valid paths is not knowable at build time. Public profiles are still
 * prerendered; anything else is resolved per request and answers identically
 * whether it is private or absent.
 */
export async function generateStaticParams() {
  const usernames = await publicProfileUsernames();
  return usernames.map((username) => ({ username }));
}

export async function generateMetadata(props: PageProps<"/p/[username]">): Promise<Metadata> {
  const { username } = await props.params;
  const profile = await getProfile(ANONYMOUS, username);

  // Same metadata for private and non-existent. Deliberately not "Ananya's
  // profile is private" — that would confirm Ananya has an account.
  if (!profile) {
    return buildMetadata({
      title: "Profile not available",
      description:
        "This profile is private or does not exist. People on Nexivora choose who can see their work, and most keep it within their college.",
      path: `/p/${username}`,
      index: false,
    });
  }

  const college = profile.memberships[0]?.college;
  const projects = profile.privacy.showProjects ? await listProjects(ANONYMOUS, { take: 100 }) : [];

  const own = projects.filter((project) =>
    project.members.some((member) => member.user.username === profile.username),
  );

  return buildMetadata({
    title: profile.name,
    description: ensureDescription(
      `${profile.headline ?? profile.name}. ${own.length} published ${own.length === 1 ? "project" : "projects"} at ${college?.shortName ?? "a verified college"}.`,
      "Skills backed by project evidence and faculty attestation, not by self-declaration.",
    ),
    path: `/p/${username}`,
    type: "profile",
    index: profile.indexable,
    og: {
      eyebrow: profile.facultyProfile ? "Faculty" : "Student",
      chips: [college?.shortName ?? ""].filter(Boolean),
    },
  });
}

export default async function ProfilePage(props: PageProps<"/p/[username]">) {
  const { username } = await props.params;

  // The signed-in viewer, so a classmate sees a college-visible profile that
  // the public cannot. The *page* is still safe for either.
  const viewer = await currentViewer();
  const profile = await getProfile(viewer, username);

  if (!profile) return <ProfileUnavailable />;

  const membership = profile.memberships[0];
  const college = membership?.college;

  const projectRows = profile.privacy.showProjects ? await listProjects(viewer, { take: 200 }) : [];

  const projects = projectRows
    .filter((project) =>
      project.members.some((member) => member.user.username === profile.username),
    )
    .map((project) => toContentProjectCard(project));

  // Skills arrive already carrying their source; `mergeSkills` orders them so
  // the evidenced half of the list is what a reader meets first.
  const skills = mergeSkills(
    profile.skills.map((entry) => ({
      name: entry.skill.name,
      slug: entry.skill.slug,
      source: entry.source,
    })),
    [],
  ).map((skill) => {
    const stored = profile.skills.find((entry) => entry.skill.slug === skill.slug);
    return { ...skill, projectSlugs: stored?.projectIds ?? skill.projectSlugs };
  });

  const attested = skills.filter((skill) => skill.source === "ATTESTED");
  const evidenced = skills.filter((skill) => skill.source === "PROJECT_INFERRED");
  const claimed = skills.filter((skill) => skill.source === "SELF");

  const crumbs = [
    ...(college ? [{ label: college.shortName, href: `/colleges/${college.slug}` }] : []),
    { label: profile.name, href: `/p/${username}` },
  ];

  const isFaculty = Boolean(profile.facultyProfile);

  return (
    <>
      <JsonLd
        data={[
          ...personProfile({
            name: profile.name,
            username: profile.username,
            headline: profile.headline ?? "",
            bio: profile.bio ?? "",
            college: college ? { name: college.name, slug: college.slug } : undefined,
            // Matches the visible content exactly — structured data that
            // describes fields the page does not show is a mismatch Google acts on.
            skills: skills.map((skill) => skill.name),
            links: profile.links.map((link) => link.url),
            role:
              profile.facultyProfile?.designation ??
              profile.alumniProfile?.currentRole ??
              undefined,
          }),
          breadcrumbList(crumbs),
        ]}
      />

      <Container className="py-10 md:py-12">
        <Breadcrumbs crumbs={crumbs} className="mb-6" />

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0">
            <header className="flex flex-wrap items-start gap-5">
              <Avatar name={profile.name} seed={profile.username} size="xl" verified={isFaculty} />
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-3xl font-bold md:text-4xl">{profile.name}</h1>
                {profile.headline ? (
                  <p className="mt-2 text-base text-fg-muted md:text-lg">{profile.headline}</p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {membership ? (
                    <Badge tone="primary" className="capitalize">
                      {membership.role.replace("_", " ").toLowerCase()}
                    </Badge>
                  ) : null}
                  {college ? (
                    <Link href={`/colleges/${college.slug}`}>
                      <Badge tone="outline">{college.shortName}</Badge>
                    </Link>
                  ) : null}
                  {profile.pronouns ? <Badge tone="outline">{profile.pronouns}</Badge> : null}
                  {profile.location ? <Badge tone="outline">{profile.location}</Badge> : null}
                </div>
              </div>
            </header>

            {profile.bio ? (
              <section className="mt-8">
                <h2 className="font-display text-xl font-bold">About</h2>
                <p className="mt-3 text-fg-muted">{profile.bio}</p>
              </section>
            ) : null}

            {/* ------------------------------------------------------ skills */}

            {skills.length > 0 ? (
              <section className="mt-10">
                <h2 className="font-display text-xl font-bold">Skills</h2>
                <p className="mt-2 text-sm text-fg-muted">
                  Evidenced skills come from finished projects. Self-declared ones do not, and are
                  marked so — the difference is the point.
                </p>

                {attested.length > 0 ? (
                  <SkillGroup
                    title="Attested by faculty"
                    description="A named supervisor put their signature to this."
                    skills={attested}
                  />
                ) : null}

                {evidenced.length > 0 ? (
                  <SkillGroup
                    title="From project work"
                    description="Derived from what these projects actually used."
                    skills={evidenced}
                  />
                ) : null}

                {claimed.length > 0 ? (
                  <SkillGroup
                    title="Self-declared"
                    description="Claimed, with no project evidence behind it yet."
                    skills={claimed}
                  />
                ) : null}
              </section>
            ) : null}

            {/* ---------------------------------------------------- projects */}

            {profile.privacy.showProjects && projects.length > 0 ? (
              <section className="mt-12">
                <h2 className="font-display text-xl font-bold">Projects ({projects.length})</h2>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  {projects.map((project) => (
                    <ProjectCard key={project.slug} project={project} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* ------------------------------------------------ achievements */}

            {profile.achievements.length > 0 ? (
              <section className="mt-12">
                <h2 className="font-display text-xl font-bold">Achievements</h2>
                <ul className="mt-4 grid gap-3">
                  {profile.achievements.map((achievement) => (
                    <li key={`${achievement.title}-${achievement.year}`} className="flex gap-3">
                      <span className="font-mono text-sm text-fg-subtle">{achievement.year}</span>
                      <span>
                        <span className="font-medium">{achievement.title}</span>
                        {achievement.detail ? (
                          <span className="block text-sm text-fg-muted">{achievement.detail}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          {/* ------------------------------------------------------- sidebar */}

          <aside className="grid content-start gap-6">
            {profile.studentProfile ? (
              <Card className="p-5">
                <h2 className="font-display text-base font-semibold">Studying</h2>
                <dl className="mt-3 grid gap-2 text-sm">
                  {profile.studentProfile.year ? (
                    <Row label="Year" value={`Year ${profile.studentProfile.year}`} />
                  ) : null}
                  {/* Only present when the student opted in AND the viewer is
                      entitled — the query omitted it otherwise. */}
                  {profile.rollNumber ? (
                    <Row label="Roll number" value={profile.rollNumber} sensitive />
                  ) : null}
                  {profile.studentProfile.availableForTeams ? (
                    <Row label="Teams" value="Open to joining a team" />
                  ) : null}
                </dl>

                {profile.studentProfile.interests.length > 0 ? (
                  <>
                    <Divider className="my-4" />
                    <div className="flex flex-wrap gap-1.5">
                      {profile.studentProfile.interests.map((interest) => (
                        <Badge key={interest} tone="outline" size="sm">
                          {interest}
                        </Badge>
                      ))}
                    </div>
                  </>
                ) : null}
              </Card>
            ) : null}

            {profile.facultyProfile ? (
              <Card className="p-5">
                <h2 className="font-display text-base font-semibold">Teaching</h2>
                <dl className="mt-3 grid gap-2 text-sm">
                  {profile.facultyProfile.designation ? (
                    <Row label="Designation" value={profile.facultyProfile.designation} />
                  ) : null}
                  {profile.facultyProfile.officeHours ? (
                    <Row label="Office hours" value={profile.facultyProfile.officeHours} />
                  ) : null}
                  {profile.facultyProfile.mentorshipAvailable ? (
                    <Row label="Mentorship" value="Open to mentoring" />
                  ) : null}
                </dl>

                {profile.facultyProfile.expertise.length > 0 ? (
                  <>
                    <Divider className="my-4" />
                    <div className="flex flex-wrap gap-1.5">
                      {profile.facultyProfile.expertise.map((area) => (
                        <Badge key={area} tone="outline" size="sm">
                          {area}
                        </Badge>
                      ))}
                    </div>
                  </>
                ) : null}
              </Card>
            ) : null}

            {profile.alumniProfile ? (
              <Card className="p-5">
                <h2 className="font-display text-base font-semibold">Since graduating</h2>
                <dl className="mt-3 grid gap-2 text-sm">
                  <Row label="Class of" value={String(profile.alumniProfile.graduationYear)} />
                  {profile.alumniProfile.currentRole ? (
                    <Row label="Role" value={profile.alumniProfile.currentRole} />
                  ) : null}
                  {profile.alumniProfile.organisation ? (
                    <Row label="At" value={profile.alumniProfile.organisation} />
                  ) : null}
                </dl>
              </Card>
            ) : null}

            {profile.links.length > 0 ? (
              <Card className="p-5">
                <h2 className="font-display text-base font-semibold">Links</h2>
                <ul className="mt-3 grid gap-2 text-sm">
                  {profile.links.map((link) => (
                    <li key={link.url}>
                      <a
                        href={link.url}
                        rel="ugc noopener"
                        className="inline-flex items-center gap-1.5 underline underline-offset-4 hover:text-fg"
                      >
                        {link.label}
                        <ExternalIcon size={14} />
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {/* Present only when opted in and the viewer is entitled — and even
                then withheld from search snippets. */}
            {profile.email ? (
              <Card className="p-5" data-nosnippet>
                <h2 className="font-display text-base font-semibold">Contact</h2>
                <p className="mt-2 text-sm break-all">{profile.email}</p>
              </Card>
            ) : null}
          </aside>
        </div>
      </Container>
    </>
  );
}

/* ------------------------------------------------------------- fragments */

function Row({ label, value, sensitive }: { label: string; value: string; sensitive?: boolean }) {
  return (
    <div className="flex gap-3" {...(sensitive ? { "data-nosnippet": "" } : {})}>
      <dt className="w-28 shrink-0 text-fg-subtle">{label}</dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  );
}

function SkillGroup({
  title,
  description,
  skills,
}: {
  title: string;
  description: string;
  skills: Array<{
    name: string;
    slug: string;
    source: string;
    projectSlugs: string[];
    reason: string;
  }>;
}) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-fg-subtle">{description}</p>

      <ul className="mt-3 grid gap-2">
        {skills.map((skill) => (
          <li
            key={skill.slug}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2"
          >
            <span className="font-medium">{skill.name}</span>
            <TierBadge
              tier={
                skill.source === "ATTESTED"
                  ? "attested"
                  : skill.source === "PROJECT_INFERRED"
                    ? "evidenced"
                    : "self"
              }
            />
            <span className="text-xs text-fg-muted">{skill.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The page for a profile that is private **or does not exist**.
 *
 * Identical for both, on purpose. It explains the product's position rather
 * than reporting a failure, because for most visitors this is not an error —
 * it is somebody exercising a setting that is private by default.
 */
function ProfileUnavailable() {
  return (
    <Container className="py-20">
      <div className="mx-auto grid max-w-md gap-4 text-center">
        <span className="bg-bg-subtle mx-auto grid size-12 place-items-center rounded-full text-fg-muted">
          <LockIcon size={22} />
        </span>
        <h1 className="font-display text-2xl font-bold">This profile is not available</h1>
        <p className="text-fg-muted">
          Profiles on Nexivora are private until someone chooses otherwise, and most people keep
          theirs within their own college. There may be no account with this name at all.
        </p>
        <p className="text-sm">
          <Link href="/explore" className="underline underline-offset-4">
            Explore published project work instead
          </Link>
        </p>
      </div>
    </Container>
  );
}
