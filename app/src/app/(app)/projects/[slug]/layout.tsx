import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import { ProjectEditTabs } from "@/components/project/project-edit-tabs";
import { requireAuth } from "@/lib/auth/guards";
import { hasReleasedFeedback } from "@/lib/db/queries/feedback";
import { capabilities, requireEditableProject } from "@/lib/db/queries/project-edit";
import { LABEL, isEditable } from "@/lib/project/lifecycle";

/**
 * THE PROJECT SHELL.
 *
 * At `[slug]`, not `[slug]/edit`, so the tabs it renders actually appear on the
 * pages they link to. The first version sat under `edit/` and every link to
 * Milestones, Proposal or Submit navigated the user out of the navigation —
 * caught by looking at a screenshot, not by any check.
 *
 * The public project page is unaffected: it lives in the `(site)` group, and a
 * layout in `(app)` does not wrap it.
 *
 * Loads the project once for the header and the tabs; every page beneath it
 * loads it again, because a layout does not protect the pages under it in any
 * way a request can rely on — the same reasoning as Phase 7's workspace shell.
 *
 * The banner when a project is locked is doing real work. `UNDER_REVIEW` and
 * `ARCHIVED` refuse every write at the action layer, and a form that silently
 * fails is the worst version of that. Saying so at the top, with the way out,
 * is the difference between "broken" and "waiting on somebody".
 */
export default async function ProjectEditLayout({
  children,
  params,
}: LayoutProps<"/projects/[slug]">) {
  const { slug } = await params;
  const viewer = await requireAuth(`/projects/${slug}/edit`);
  const project = await requireEditableProject(viewer, slug);

  if (!project) notFound();

  const caps = capabilities(viewer, project);
  const locked = !isEditable(project.status);
  const feedback = await hasReleasedFeedback(project.id);

  return (
    <div className="grid gap-6">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
              <Badge tone={project.status === "ARCHIVED" ? "neutral" : "outline"}>
                {LABEL[project.status].toLowerCase()}
              </Badge>
              {project.citationId ? <Badge tone="accent">{project.citationId}</Badge> : null}
            </div>

            <p className="text-sm text-fg-muted">
              {project.group ? (
                <Link
                  href={`/groups/${project.group.id}`}
                  className="underline underline-offset-4 hover:text-fg"
                >
                  {project.group.name}
                </Link>
              ) : (
                project.college.shortName
              )}
              {project.group?.class ? ` · ${project.group.class.subject.code}` : ""}
            </p>
          </div>
        </div>

        {locked ? (
          <Alert
            tone={project.status === "ARCHIVED" ? "info" : "warning"}
            title={
              project.status === "ARCHIVED"
                ? "This record is permanent"
                : "This project is with your faculty guide"
            }
          >
            {project.status === "ARCHIVED"
              ? "An archived project is read-only for good. That is what makes its citation ID worth citing."
              : "Editing is locked while it is under review. It unlocks the moment they request changes."}
          </Alert>
        ) : null}

        <ProjectEditTabs
          slug={project.slug}
          canSubmit={caps.lead}
          isFaculty={caps.faculty}
          hasFeedback={feedback}
        />
      </header>

      {children}
    </div>
  );
}
