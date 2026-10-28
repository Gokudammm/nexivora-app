import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/display";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { ROLE_LABEL } from "@/config/roles";
import { requireAuth } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { listProjects } from "@/lib/db/queries/projects";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Dashboard",
  description:
    "Your Nexivora dashboard — the projects you are on, the groups you belong to, and what needs your attention this week.",
  index: false,
  path: "/dashboard",
});

/**
 * The dashboard.
 *
 * One route rather than `/student`, `/faculty`, `/admin`. A person can hold
 * more than one role — faculty at one college, alumni at another — so a
 * per-role URL would force them to pick an identity before seeing anything.
 * The page composes from the memberships they actually have.
 *
 * The content here is deliberately thin: Phases 6 to 12 own the real panels.
 * What this proves is that authentication, the viewer, and the query layer's
 * viewer-scoping work end to end.
 */
export default async function DashboardPage() {
  const viewer = await requireAuth("/dashboard");

  const onboarding = await db.onboardingProgress.findUnique({
    where: { userId: viewer.userId },
    select: { completedAt: true, step: true },
  });

  // An incomplete profile goes back to the wizard rather than to a dashboard
  // that has nothing to show — the wizard is what makes the dashboard useful.
  if (onboarding && !onboarding.completedAt) redirect("/onboarding");

  const [user, projects] = await Promise.all([
    db.user.findUnique({
      where: { id: viewer.userId },
      select: { name: true, emailVerified: true },
    }),
    // Scoped by the viewer, like every query in the product.
    listProjects(viewer, { take: 6 }),
  ]);

  const memberships = viewer.memberships.filter((m) => m.state !== "INVITED");

  return (
    <div className="grid gap-8">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {user?.name ? `Hello, ${user.name.split(" ")[0]}` : "Dashboard"}
        </h1>
        <p className="text-fg-muted">
          {memberships.length > 0
            ? memberships.map((m) => ROLE_LABEL[m.role]).join(" · ")
            : "You are not attached to a college yet."}
        </p>
      </header>

      {!viewer.emailVerified ? (
        <Alert tone="warning" title="Confirm your address">
          You can look around, but you cannot post or create work until your address is confirmed.{" "}
          <Link href="/verify-email" className="font-medium underline underline-offset-4">
            Confirm it now
          </Link>
          .
        </Alert>
      ) : null}

      {memberships.length === 0 ? (
        <Alert tone="info" title="No college yet">
          Register with your institutional address, or accept an invitation, to join your college.
          Until then you can read public work but not join a group.
        </Alert>
      ) : null}

      <section className="grid gap-4">
        <h2 className="text-lg font-semibold">Projects you can see</h2>

        {projects.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            description="Once you join a group, its projects appear here alongside the public work from your college."
            action={
              <Link href="/explore" className="font-medium underline underline-offset-4">
                Explore public projects
              </Link>
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {projects.map((project) => (
              <li key={project.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      <Link
                        href={`/projects/${project.slug}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {project.title}
                      </Link>
                    </CardTitle>
                    <CardDescription>{project.summary}</CardDescription>
                  </CardHeader>
                  <CardBody>
                    <Badge>{project.college.shortName}</Badge>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">What is coming</h2>
        <p className="text-fg-muted">
          The workspace, the feed and the faculty review tools land in the phases after this one.
          What works today is the part everything else rests on: who you are, what you may see, and
          what you may change.
        </p>
      </section>
    </div>
  );
}
