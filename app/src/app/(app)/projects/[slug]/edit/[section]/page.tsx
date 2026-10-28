import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons";
import { SectionEditor } from "@/components/project/section-editor";
import { RestoreVersion } from "@/components/project/restore-version";
import { ProjectDetailsForm } from "@/components/project/project-details-form";
import { SECTION_BY_KIND, SECTION_ORDER } from "@/config/sections";
import { requireAuth } from "@/lib/auth/guards";
import { capabilities, getSection, requireEditableProject } from "@/lib/db/queries/project-edit";
import { db } from "@/lib/db/client";
import { isEditable } from "@/lib/project/lifecycle";
import { activeEditorId } from "@/lib/project/lock";
import { buildMetadata } from "@/lib/seo/metadata";
import { DOMAINS, SDGS, ALL_TOPICS } from "@/config/taxonomy";

export const metadata = buildMetadata({
  title: "Edit section",
  description: "One section of a project record, with guidance on what belongs in it.",
  index: false,
  path: "/projects",
});

/**
 * One section, or the metadata form.
 *
 * `details` shares this route rather than having its own because it is the same
 * thing from the user's point of view — a tab in the editor — and giving it a
 * sibling route would mean two layouts to keep in step. The segment is matched
 * against the section enum first, so a future section named `details` would be
 * a conflict rather than a silent shadow. There is no such section.
 */
export default async function SectionPage({
  params,
}: PageProps<"/projects/[slug]/edit/[section]">) {
  const { slug, section: segment } = await params;
  const viewer = await requireAuth(`/projects/${slug}/edit`);
  const project = await requireEditableProject(viewer, slug);

  if (!project) notFound();

  const caps = capabilities(viewer, project);
  const readOnly = !caps.edit || !isEditable(project.status);

  /* --------------------------------------------------------- the details tab */

  if (segment === "details") {
    return (
      <ProjectDetailsForm
        slug={project.slug}
        readOnly={readOnly}
        project={{
          title: project.title,
          summary: project.summary,
          abstract: project.abstract,
          domain: project.domain,
          department: project.department,
          techStack: project.techStack,
          keywords: project.keywords,
          repositoryUrl: project.repositoryUrl,
          demoUrl: project.demoUrl,
          videoUrl: project.videoUrl,
          coverUrl: project.coverUrl,
          startedOn: project.startedOn,
          completedOn: project.completedOn,
          visibility: project.visibility,
          embargoUntil: project.embargoUntil,
          approved: project.approved,
          topics: project.topics.map((entry) => entry.topic.slug),
          sdgs: project.sdgs.map((entry) => entry.goal),
          primarySdg: project.sdgs.find((entry) => entry.primary)?.goal ?? null,
          members: project.members.map((member) => ({
            id: member.user.id,
            name: member.user.name,
            avatarUrl: member.user.avatarUrl,
            role: member.role,
            tier: member.tier,
          })),
        }}
        groupMembers={(project.group?.members ?? []).map((member) => ({
          id: member.user.id,
          name: member.user.name,
        }))}
        canSetVisibility={caps.visibility}
        domains={DOMAINS.map((domain) => ({ key: domain.key, label: domain.name }))}
        topics={ALL_TOPICS.map((topic) => ({ slug: topic.slug, name: topic.name }))}
        sdgs={SDGS.map((sdg) => ({ number: sdg.number, title: sdg.title }))}
      />
    );
  }

  /* ------------------------------------------------------------- a section */

  const kind = SECTION_ORDER.find((candidate) => candidate.toLowerCase() === segment);
  if (!kind) notFound();

  const spec = SECTION_BY_KIND[kind];
  const section = await getSection(project, kind);
  if (!section) notFound();

  const index = SECTION_ORDER.indexOf(kind);
  const previous = SECTION_ORDER[index - 1];
  const next = SECTION_ORDER[index + 1];

  // Resolve the other editor's *name*, not their id — a lock indicator saying
  // "cm3x9…is editing this" is worse than no indicator.
  const otherId = activeEditorId(section, viewer.userId);
  const other = otherId
    ? await db.user.findUnique({ where: { id: otherId }, select: { name: true } })
    : null;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-0.5">
          <h2 className="text-lg font-semibold tracking-tight">{spec.label}</h2>
          <p className="text-xs text-fg-muted">
            Section {index + 1} of {SECTION_ORDER.length}
            {spec.required ? "" : " · optional"}
          </p>
        </div>

        <nav aria-label="Move between sections" className="flex gap-2">
          {previous ? (
            <Link
              href={`/projects/${project.slug}/edit/${previous.toLowerCase()}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-fg-muted hover:text-fg"
            >
              <ArrowLeftIcon />
              {SECTION_BY_KIND[previous].label}
            </Link>
          ) : null}

          {next ? (
            <Link
              href={`/projects/${project.slug}/edit/${next.toLowerCase()}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-fg-muted hover:text-fg"
            >
              {SECTION_BY_KIND[next].label}
              <ArrowRightIcon />
            </Link>
          ) : null}
        </nav>
      </div>

      <SectionEditor
        slug={project.slug}
        spec={spec}
        initialBody={section.body}
        initialComplete={section.complete}
        versions={section.versions}
        activeEditorName={other?.name ?? null}
        readOnly={readOnly}
        onRestore={
          readOnly ? null : (
            <RestoreVersion
              slug={project.slug}
              versions={section.versions.map((version) => ({
                id: version.id,
                version: version.version,
                editorName: version.editor?.name ?? "Someone",
              }))}
            />
          )
        }
      />
    </div>
  );
}
