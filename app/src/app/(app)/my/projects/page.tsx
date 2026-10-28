import Link from "next/link";

import { PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/display";
import { EmptyState, Progress } from "@/components/ui/feedback";
import { REQUIRED_SECTIONS } from "@/config/sections";
import { requireAuth } from "@/lib/auth/guards";
import { listMyProjects } from "@/lib/db/queries/project-edit";
import { LABEL, isTerminal } from "@/lib/project/lifecycle";
import { computeProgress } from "@/lib/project/progress";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "My projects",
  description: "Every project you are credited on or whose group you belong to.",
  index: false,
  path: "/my/projects",
});

/**
 * `/my/projects`.
 *
 * The progress bar here is computed without the task component — the listing
 * would otherwise need one query per project to count them. The weighting
 * redistributes automatically when a component is absent, so the number stays
 * meaningful rather than silently deflated; it is simply a coarser view than
 * the project's own page.
 */
export default async function MyProjectsPage() {
  const viewer = await requireAuth("/my/projects");
  const projects = await listMyProjects(viewer);

  const active = projects.filter((project) => !isTerminal(project.status));
  const finished = projects.filter((project) => isTerminal(project.status));

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-fg-muted">
            {projects.length === 0
              ? "The record of what you build. Everything on Nexivora hangs off one."
              : `${active.length} active${finished.length > 0 ? `, ${finished.length} archived` : ""}.`}
          </p>
        </div>

        <Button asChild>
          <Link href="/projects/new">
            <PlusIcon />
            New project
          </Link>
        </Button>
      </header>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="A project is the structured record of what your group built — problem, method, results — and the thing that becomes a permanent, citable page when it is done."
          action={
            <Button asChild>
              <Link href="/projects/new">Start one</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ProjectGrid projects={active} />

          {finished.length > 0 ? (
            <section className="grid gap-4">
              <h2 className="text-sm font-medium text-fg-muted">Archived</h2>
              <ProjectGrid projects={finished} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

type Row = Awaited<ReturnType<typeof listMyProjects>>[number];

function ProjectGrid({ projects }: { projects: Row[] }) {
  if (projects.length === 0) return null;

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => {
        const progress = computeProgress({
          sections: project.sections,
          requiredSections: REQUIRED_SECTIONS,
          milestones: project.milestones,
          tasks: [],
        });

        return (
          <li key={project.id}>
            <Link
              href={`/projects/${project.slug}/edit`}
              className="focus-visible:outline-primary group grid h-full gap-3 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <div className="grid gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="group-hover:text-primary font-medium">{project.title}</h3>
                  <Badge tone="outline">{LABEL[project.status].toLowerCase()}</Badge>
                </div>
                <p className="line-clamp-2 text-sm text-fg-muted">{project.summary}</p>
              </div>

              <Progress value={progress.percent} label={`${project.title} progress`} />

              <p className="flex flex-wrap items-center justify-between gap-2 text-xs text-fg-subtle">
                <span>{project.group?.name ?? "No group"}</span>
                <span>{progress.percent}%</span>
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
