import Link from "next/link";

import { PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { GroupCardList } from "@/components/workspace/group-card";
import { JoinableGroups } from "@/components/workspace/joinable-groups";
import { requireAuth } from "@/lib/auth/guards";
import { listJoinableGroups, listMyGroups } from "@/lib/db/queries/group";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "My groups",
  description:
    "Every group you work in, with what is due next and how much of it is waiting on you. Your workspaces, in one place.",
  index: false,
  path: "/groups",
});

/**
 * `/groups` — the list.
 *
 * Ordered by what needs attention rather than alphabetically: an archived group
 * sinks, and the next deadline is on the card rather than a click away. The
 * point of this page is answering "what do I owe anybody this week" without
 * opening five workspaces.
 */
export default async function GroupsPage() {
  const viewer = await requireAuth("/groups");

  const [groups, joinable] = await Promise.all([listMyGroups(viewer), listJoinableGroups(viewer)]);

  const active = groups.filter((group) => !group.archivedAt);
  const archived = groups.filter((group) => group.archivedAt);

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
          <p className="text-sm text-fg-muted">
            {active.length === 0
              ? "A group is where the work actually happens — tasks, files, discussion and the contribution ledger."
              : `${active.length} active ${active.length === 1 ? "group" : "groups"}.`}
          </p>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link href="/groups/my-tasks">My tasks</Link>
          </Button>
          <Button asChild>
            <Link href="/groups/new">
              <PlusIcon />
              New group
            </Link>
          </Button>
        </div>
      </header>

      {active.length === 0 ? (
        <EmptyState
          title="You are not in a group yet"
          description="Create one inside a class you are enrolled in, or ask a classmate to add you to theirs. Everything else in the product hangs off a group."
          action={
            <Button asChild>
              <Link href="/groups/new">Create a group</Link>
            </Button>
          }
        />
      ) : (
        <GroupCardList groups={active} />
      )}

      {joinable.length > 0 ? <JoinableGroups groups={joinable} /> : null}

      {archived.length > 0 ? (
        <section className="grid gap-4">
          <h2 className="text-sm font-medium text-fg-muted">Archived</h2>
          <GroupCardList groups={archived} />
        </section>
      ) : null}
    </div>
  );
}
