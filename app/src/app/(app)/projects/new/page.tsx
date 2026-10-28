import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { NewProjectForm } from "@/components/project/new-project-form";
import { DOMAINS } from "@/config/taxonomy";
import { requireVerified } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "New project",
  description: "Start a project inside one of your groups.",
  index: false,
  path: "/projects/new",
});

/**
 * `/projects/new`.
 *
 * A project belongs to a group, and the group list comes from the viewer's own
 * memberships — so there is no id field anybody could edit, and no way to
 * create a project somewhere you are not. `can(viewer, 'project:create')` backs
 * it on the server regardless.
 */
export default async function NewProjectPage() {
  const viewer = await requireVerified("/projects/new");

  const groups = await db.group.findMany({
    where: { id: { in: viewer.groups.map((group) => group.groupId) }, archivedAt: null },
    select: {
      id: true,
      name: true,
      class: { select: { subject: { select: { code: true, name: true } } } },
      _count: { select: { projects: { where: { deletedAt: null } } } },
    },
    orderBy: { name: "asc" },
  });

  if (groups.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          title="You need a group first"
          description="Every project belongs to a group — that is where its tasks, files, discussion and contribution ledger live. Create one, or ask a classmate to add you to theirs."
          action={
            <Button asChild>
              <Link href="/groups/new">Create a group</Link>
            </Button>
          }
          secondaryAction={
            <Button asChild variant="secondary">
              <Link href="/groups">See your groups</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">New project</h1>
        <p className="text-sm text-fg-muted">
          It starts as a draft, visible only to your group. Everything here can be changed later
          except the group it belongs to.
        </p>
      </header>

      <NewProjectForm
        groups={groups.map((group) => ({
          id: group.id,
          label: group.class ? `${group.name} — ${group.class.subject.code}` : group.name,
          projectCount: group._count.projects,
        }))}
        domains={DOMAINS.map((domain) => ({ key: domain.key, label: domain.name }))}
      />
    </div>
  );
}
