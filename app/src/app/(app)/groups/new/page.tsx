import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { NewGroupForm } from "@/components/workspace/new-group-form";
import { requireVerified } from "@/lib/auth/guards";
import { listClassesForGroupCreation } from "@/lib/db/queries/group";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "New group",
  description:
    "Create a group inside one of your classes. A group is where tasks, files, discussion and the contribution ledger live.",
  index: false,
  path: "/groups/new",
});

/**
 * `/groups/new`.
 *
 * A group always belongs to a class, and the class list comes from the viewer's
 * own enrolments — so there is no way to create a group somewhere you are not,
 * and no id field anybody could edit. That is the cheapest possible version of
 * the authorisation check, and it is backed by `can(viewer, 'group:create')` on
 * the server regardless.
 */
export default async function NewGroupPage() {
  const viewer = await requireVerified("/groups/new");
  const classes = await listClassesForGroupCreation(viewer);

  if (classes.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          title="You are not enrolled in a class yet"
          description="Groups form inside a class, so your college needs to enrol you before you can create one. Your administrator does that from the admin console."
          action={
            <Button asChild variant="secondary">
              <Link href="/groups">Back to groups</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">New group</h1>
        <p className="text-sm text-fg-muted">
          You will be its lead. Everything about it can be changed afterwards except the class it
          belongs to.
        </p>
      </header>

      <NewGroupForm
        classes={classes.map((klass) => ({
          id: klass.id,
          label: `${klass.subject.code} · ${klass.subject.name}${klass.section ? ` (${klass.section})` : ""} — ${klass.term.name}`,
        }))}
      />
    </div>
  );
}
