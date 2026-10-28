import Link from "next/link";
import { notFound } from "next/navigation";

import { CheckCircleIcon } from "@/components/icons";
import { Badge } from "@/components/ui/display";
import { Progress } from "@/components/ui/feedback";
import { LifecyclePanel } from "@/components/project/lifecycle-panel";
import { SECTION_BY_KIND } from "@/config/sections";
import { requireAuth } from "@/lib/auth/guards";
import {
  capabilities,
  projectProgress,
  requireEditableProject,
  sectionSummary,
} from "@/lib/db/queries/project-edit";
import { LABEL, transitionsFrom } from "@/lib/project/lifecycle";
import { buildMetadata } from "@/lib/seo/metadata";
import { cn } from "@/lib/utils/cn";

export const metadata = buildMetadata({
  title: "Edit project",
  description:
    "The nine-section project record, with completion state per section and computed progress.",
  index: false,
  path: "/projects",
});

/**
 * The section navigator.
 *
 * The one number on this page that matters is **computed** — from sections
 * written, milestones closed and tasks finished. A self-reported percentage is
 * meaningless and every faculty member knows it, which is the entire reason
 * Phase 9's dashboard will be worth opening.
 */
export default async function ProjectEditPage({ params }: PageProps<"/projects/[slug]/edit">) {
  const { slug } = await params;
  const viewer = await requireAuth(`/projects/${slug}/edit`);
  const project = await requireEditableProject(viewer, slug);

  if (!project) notFound();

  const caps = capabilities(viewer, project);
  const [progress, sections] = await Promise.all([
    projectProgress(project),
    Promise.resolve(sectionSummary(project)),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="grid content-start gap-6 lg:col-span-2">
        <section className="grid gap-3 rounded-xl border border-border p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-medium">Progress</h2>
            <p className="text-sm text-fg-muted">{progress.percent}% complete</p>
          </div>

          <Progress value={progress.percent} label="Project progress" />

          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-fg-muted">
            <li>
              <span className="font-medium text-fg">
                {progress.sections.done}/{progress.sections.total}
              </span>{" "}
              required sections
            </li>
            <li>
              <span className="font-medium text-fg">
                {progress.milestones.done}/{progress.milestones.total}
              </span>{" "}
              milestones
            </li>
            <li>
              <span className="font-medium text-fg">
                {progress.tasks.done}/{progress.tasks.total}
              </span>{" "}
              tasks
            </li>
          </ul>

          <p className="text-xs text-fg-subtle">
            Computed from what is actually written and closed — never typed in. Sections weigh most
            because the written record is the deliverable.
          </p>
        </section>

        <section className="grid gap-3">
          <h2 className="font-medium">Sections</h2>

          <ul className="grid divide-y divide-border rounded-xl border border-border">
            {sections.map((section) => {
              const spec = SECTION_BY_KIND[section.kind];

              return (
                <li key={section.kind}>
                  <Link
                    href={`/projects/${project.slug}/edit/${section.kind.toLowerCase()}`}
                    className="focus-visible:outline-primary flex flex-wrap items-center gap-3 px-4 py-3.5 hover:bg-surface-sunken focus-visible:outline-2 focus-visible:-outline-offset-2"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "shrink-0",
                        section.complete ? "text-success" : "text-fg-subtle",
                      )}
                    >
                      {section.complete ? <CheckCircleIcon /> : "○"}
                    </span>

                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {spec.label}
                        {spec.required ? null : <Badge tone="neutral">optional</Badge>}
                      </span>
                      <span className="truncate text-xs text-fg-muted">{spec.prompt}</span>
                    </span>

                    <span className="shrink-0 text-xs text-fg-subtle">
                      {section.started ? `${section.wordCount} words` : "Not started"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <aside className="grid content-start gap-6">
        <LifecyclePanel
          slug={project.slug}
          status={project.status}
          transitions={transitionsFrom(project.status)}
          canLead={caps.lead}
          canFaculty={caps.faculty}
          canEdit={caps.edit}
        />

        <section className="grid gap-3 rounded-xl border border-border p-5">
          <h2 className="font-medium">History</h2>

          {project.statusEvents.length === 0 ? (
            <p className="text-sm text-fg-subtle">Nothing yet.</p>
          ) : (
            <ol className="grid gap-3">
              {project.statusEvents.slice(0, 8).map((event) => (
                <li key={event.id} className="grid gap-0.5 border-l-2 border-border pl-3">
                  <p className="text-sm">
                    {event.from ? `${LABEL[event.from]} → ` : ""}
                    <span className="font-medium">{LABEL[event.to]}</span>
                  </p>
                  <p className="text-xs text-fg-muted">
                    {event.actor?.name ?? "System"} ·{" "}
                    <time dateTime={event.createdAt.toISOString()}>
                      {event.createdAt.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </time>
                  </p>
                  {event.reason ? (
                    <p className="text-xs text-fg-muted italic">&ldquo;{event.reason}&rdquo;</p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </section>
      </aside>
    </div>
  );
}
