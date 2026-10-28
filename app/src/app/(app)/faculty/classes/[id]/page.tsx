import Link from "next/link";
import { notFound } from "next/navigation";

import { Avatar, Badge } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { ClassBroadcast } from "@/components/faculty/class-broadcast";
import { requireAuth } from "@/lib/auth/guards";
import { getSupervisedClass } from "@/lib/db/queries/faculty";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Class",
  description: "The roster, the groups, and the announcements and deadlines for one class.",
  index: false,
  path: "/faculty/classes",
});

/**
 * `/faculty/classes/[id]`.
 *
 * `getSupervisedClass` returns null for a class the viewer does not teach, and
 * this page turns that into a 404 rather than a refusal — the same rule as
 * everywhere else: a 403 confirms the class exists, and the existence of a
 * named class inside a named subject is itself information.
 *
 * The roster shows who is **not** in a group, which is the single most useful
 * thing on the page in week three: an unassigned student is invisible in every
 * group-oriented view precisely because they are in no group.
 */
export default async function ClassPage({ params }: PageProps<"/faculty/classes/[id]">) {
  const { id } = await params;
  const viewer = await requireAuth(`/faculty/classes/${id}`);
  const klass = await getSupervisedClass(viewer, id);

  if (!klass) notFound();

  const grouped = new Set(
    klass.groups.flatMap((group) => group.members.map((member) => member.user.id)),
  );
  const ungrouped = klass.enrolments.filter((row) => !grouped.has(row.user.id));
  const now = new Date();

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="grid content-start gap-6 lg:col-span-2">
        <header className="grid gap-1">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight">
            {klass.subject.code} {klass.subject.name}
            {klass.section ? <Badge tone="outline">{klass.section}</Badge> : null}
          </h2>
          <p className="text-sm text-fg-muted">
            {klass.term.name} · {klass.enrolments.length} enrolled · {klass.groups.length}{" "}
            {klass.groups.length === 1 ? "group" : "groups"}
          </p>
        </header>

        {ungrouped.length > 0 ? (
          <section className="grid gap-3 rounded-xl border border-warning/40 bg-warning-bg/20 p-5">
            <h3 className="font-medium">
              {ungrouped.length} {ungrouped.length === 1 ? "student is" : "students are"} not in a
              group
            </h3>
            <p className="text-xs text-fg-muted">
              They are invisible in every group-oriented view, including the health signals —
              because those are computed per group and these students are in none.
            </p>
            <ul className="flex flex-wrap gap-3">
              {ungrouped.map((row) => (
                <li key={row.user.id} className="flex items-center gap-2 text-sm">
                  <Avatar
                    name={row.user.name}
                    src={row.user.avatarUrl}
                    seed={row.user.id}
                    size="xs"
                  />
                  {row.user.name}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="grid gap-3">
          <h3 className="font-medium">Groups</h3>

          {klass.groups.length === 0 ? (
            <p className="text-sm text-fg-subtle">No groups have formed in this class yet.</p>
          ) : (
            <ul className="grid divide-y divide-border rounded-xl border border-border">
              {klass.groups.map((group) => (
                <li key={group.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <Link
                      href={`/groups/${group.id}`}
                      className="hover:text-primary truncate text-sm font-medium"
                    >
                      {group.name}
                    </Link>
                    <span className="truncate text-xs text-fg-muted">
                      {group.projects[0]?.title ?? "No project yet"}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-1">
                    {group.members.slice(0, 5).map((member) => (
                      <Avatar
                        key={member.user.id}
                        name={member.user.name}
                        src={member.user.avatarUrl}
                        seed={member.user.id}
                        size="xs"
                      />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-3">
          <h3 className="font-medium">Announcements</h3>

          {klass.announcements.length === 0 ? (
            <p className="text-sm text-fg-subtle">Nothing posted to this class yet.</p>
          ) : (
            <ul className="grid gap-3">
              {klass.announcements.map((announcement) => {
                const scheduled = announcement.publishAt > now;

                return (
                  <li
                    key={announcement.id}
                    className="grid gap-1.5 rounded-xl border border-border p-4"
                  >
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {announcement.title}
                      {scheduled ? <Badge tone="info">scheduled</Badge> : null}
                    </p>
                    <p className="text-xs text-fg-muted">
                      <time dateTime={announcement.publishAt.toISOString()}>
                        {announcement.publishAt.toLocaleString("en-IN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </time>
                    </p>
                    <p className="text-sm whitespace-pre-wrap text-fg-muted">{announcement.body}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <aside className="grid content-start gap-6">
        <ClassBroadcast classId={klass.id} groupCount={klass.groups.length} />

        <section className="grid gap-3 rounded-xl border border-border p-5">
          <h3 className="font-medium">Roster</h3>
          <ul className="grid gap-2">
            {klass.enrolments.map((row) => (
              <li key={row.user.id} className="flex items-center gap-2.5 text-sm">
                <Avatar
                  name={row.user.name}
                  src={row.user.avatarUrl}
                  seed={row.user.id}
                  size="xs"
                />
                <span className="min-w-0 flex-1 truncate">
                  {row.user.username ? (
                    <Link href={`/p/${row.user.username}`} className="hover:text-primary">
                      {row.user.name}
                    </Link>
                  ) : (
                    row.user.name
                  )}
                </span>
                {grouped.has(row.user.id) ? null : <Badge tone="warning">no group</Badge>}
              </li>
            ))}
          </ul>
        </section>

        <Button asChild variant="ghost" size="sm" className="justify-self-start">
          <Link href="/faculty/classes">All classes</Link>
        </Button>
      </aside>
    </div>
  );
}
