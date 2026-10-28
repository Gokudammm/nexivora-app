import Link from "next/link";
import { notFound } from "next/navigation";

import { AvatarGroup, Badge } from "@/components/ui/display";
import { WorkspaceTabs } from "@/components/workspace/workspace-tabs";
import { requireAuth } from "@/lib/auth/guards";
import { isLead, requireWorkspace } from "@/lib/db/queries/group";

/**
 * THE WORKSPACE SHELL.
 *
 * `requireWorkspace()` runs here, once, and **every child page calls it again**.
 * That is not redundant: a layout does not protect the pages beneath it in any
 * way a request can rely on — a page is its own entry point, and Next may render
 * one without re-running a parent layout's logic in a way the page can observe.
 * The layout's copy exists to render the header and to fail fast; the page's
 * copy is the one that actually guards the data.
 *
 * `notFound()` rather than `forbidden()`, always. A 403 confirms the group
 * exists, and the existence of a named group inside a named class is itself
 * information — the same rule as ADR-034 for private profiles.
 */
export default async function WorkspaceLayout({ children, params }: LayoutProps<"/groups/[id]">) {
  const { id } = await params;
  const viewer = await requireAuth(`/groups/${id}`);
  const workspace = await requireWorkspace(viewer, id);

  if (!workspace) notFound();

  const lead = isLead(workspace, viewer.userId);
  const project = workspace.projects[0];

  return (
    <div className="grid gap-6">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{workspace.name}</h1>
              {lead ? <Badge tone="outline">you lead this</Badge> : null}
              {workspace.archivedAt ? <Badge tone="neutral">archived</Badge> : null}
            </div>

            <p className="text-sm text-fg-muted">
              {workspace.class ? (
                <>
                  {workspace.class.subject.code} · {workspace.class.subject.name}
                  {workspace.class.section ? ` (${workspace.class.section})` : ""}
                </>
              ) : (
                workspace.college.shortName
              )}
              {project ? (
                <>
                  {" · "}
                  <Link
                    href={`/projects/${project.slug}`}
                    className="underline underline-offset-4 hover:text-fg"
                  >
                    {project.title}
                  </Link>
                </>
              ) : null}
            </p>
          </div>

          <AvatarGroup
            max={6}
            size="md"
            people={workspace.members.map((member) => ({
              name: member.user.name,
              src: member.user.avatarUrl,
              seed: member.user.id,
            }))}
          />
        </div>

        <WorkspaceTabs groupId={workspace.id} canManage={lead} />
      </header>

      {children}
    </div>
  );
}
