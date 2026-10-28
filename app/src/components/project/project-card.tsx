import Link from "next/link";

import { GroupIcon, LineageIcon, SdgIcon } from "@/components/icons";
import { GeneratedProjectCover } from "@/components/illustrations/generated";
import { Badge, Card, StatusPill, TierBadge } from "@/components/ui/display";
import { DOMAIN_BY_KEY } from "@/config/taxonomy";
import { collegeBySlug } from "@/content/colleges";
import { descendantCount } from "@/content";
import type { Project } from "@/content/types";
import { cn } from "@/lib/utils/cn";

/**
 * The project card. Used by explore, topic hubs, SDG hubs, college pages,
 * profiles and related lists — one component, so a project looks the same
 * everywhere it appears.
 *
 * It is a **Server Component with no hydration at all**. A grid of 24 of these
 * is the single heaviest listing in the product (docs/PERFORMANCE.md, Risk 1),
 * and the way it stays cheap is by shipping no JavaScript. The cover is
 * generated SVG rather than an upload, so there is no image request either.
 */
export function ProjectCard({
  project,
  className,
  showCollege = true,
}: {
  project: Project;
  className?: string;
  showCollege?: boolean;
}) {
  const domain = DOMAIN_BY_KEY[project.domain];
  const college = collegeBySlug[project.collegeSlug];
  const builtOnCount = descendantCount(project.slug);
  const attested = project.members.filter((m) => m.tier === "attested").length;

  return (
    <Card interactive className={cn("group flex flex-col overflow-hidden", className)}>
      <Link href={`/projects/${project.slug}`} className="focus-visible:outline-none">
        <div className="border-b border-border">
          <GeneratedProjectCover
            seed={project.slug}
            title={project.title}
            domain={project.domain}
            sdgs={project.sdgs}
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <span
            className="text-xs font-semibold tracking-wide uppercase"
            style={{ color: `var(${domain.colorVar})` }}
          >
            {domain.name}
          </span>
          <StatusPill status={project.status} />
        </div>

        <h3 className="font-display text-lg leading-snug font-semibold">
          {/* The whole card is clickable via this link's ::after overlay, which
              keeps one link per card rather than several competing ones. */}
          <Link
            href={`/projects/${project.slug}`}
            className="after:absolute after:inset-0 focus-visible:underline"
          >
            {project.title}
          </Link>
        </h3>

        <p className="mt-2 line-clamp-3 text-sm text-fg-muted">{project.summary}</p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-fg-subtle">
          <span className="inline-flex items-center gap-1.5">
            <GroupIcon size={14} />
            {project.members.length} {project.members.length === 1 ? "member" : "members"}
          </span>
          {project.sdgs.length > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <SdgIcon size={14} />
              SDG {project.sdgs.join(", ")}
            </span>
          ) : null}
          {builtOnCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-accent-700">
              <LineageIcon size={14} />
              {builtOnCount} built on this
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 pt-0">
          {attested > 0 ? <TierBadge tier="attested" /> : null}
          {project.techStack.slice(0, 2).map((tech) => (
            <Badge key={tech} tone="outline">
              {tech}
            </Badge>
          ))}
        </div>

        {showCollege && college ? (
          <p className="mt-4 text-xs text-fg-subtle">
            {college.shortName} · {project.term}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

/** A compact row, for sidebars and related lists where a full card is too much. */
export function ProjectRow({ project }: { project: Project }) {
  const domain = DOMAIN_BY_KEY[project.domain];
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group -mx-3 flex gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none"
    >
      <span className="w-20 shrink-0 overflow-hidden rounded-md border border-border">
        <GeneratedProjectCover
          seed={project.slug}
          title={project.title}
          domain={project.domain}
          sdgs={project.sdgs}
        />
      </span>
      <span className="min-w-0">
        <span
          className="block text-xs font-semibold tracking-wide uppercase"
          style={{ color: `var(${domain.colorVar})` }}
        >
          {domain.name}
        </span>
        <span className="mt-0.5 block text-sm leading-snug font-medium">{project.title}</span>
        <span className="mt-1 line-clamp-2 block text-xs text-fg-subtle">{project.summary}</span>
      </span>
    </Link>
  );
}
