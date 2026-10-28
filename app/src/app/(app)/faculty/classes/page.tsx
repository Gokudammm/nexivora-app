import Link from "next/link";

import { Badge } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/auth/guards";
import { listSupervisedClasses, listSupervisedGroups } from "@/lib/db/queries/faculty";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Classes",
  description: "Every class you teach this term, with enrolment, groups and average progress.",
  index: false,
  path: "/faculty/classes",
});

/**
 * `/faculty/classes`.
 *
 * Average progress per class is computed from the groups rather than stored —
 * the same rule as everywhere else. A class average is a coarse number and is
 * labelled as one: it says whether a cohort is moving, not whether any
 * particular group is.
 */
export default async function FacultyClassesPage() {
  const viewer = await requireAuth("/faculty/classes");
  const [classes, groups] = await Promise.all([
    listSupervisedClasses(viewer),
    listSupervisedGroups(viewer),
  ]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h2 className="font-medium">Classes</h2>
        <p className="text-sm text-fg-muted">
          {classes.length === 0
            ? "No classes assigned to you this term."
            : `${classes.length} this term.`}
        </p>
      </div>

      {classes.length === 0 ? (
        <EmptyState
          title="No classes yet"
          description="Your college administrator assigns classes to subjects. Once a class is yours, its roster, groups and announcements appear here."
          action={null}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {classes.map((klass) => {
            // Groups belong to a class; average across the ones that exist.
            const own = groups.filter((group) => group.className?.startsWith(klass.subject.code));
            const average =
              own.length === 0
                ? null
                : Math.round(own.reduce((sum, group) => sum + group.progress, 0) / own.length);
            const flagged = own.filter((group) => group.level === "attention").length;

            return (
              <li key={klass.id}>
                <Link
                  href={`/faculty/classes/${klass.id}`}
                  className="focus-visible:outline-primary grid h-full gap-3 rounded-xl border border-border p-5 transition-colors hover:border-border-strong focus-visible:outline-2"
                >
                  <div className="grid gap-1">
                    <h3 className="flex flex-wrap items-center gap-2 font-medium">
                      {klass.subject.code}
                      {klass.section ? <Badge tone="outline">{klass.section}</Badge> : null}
                      {flagged > 0 ? <Badge tone="warning">{flagged} flagged</Badge> : null}
                    </h3>
                    <p className="text-sm text-fg-muted">{klass.subject.name}</p>
                    <p className="text-xs text-fg-subtle">{klass.term.name}</p>
                  </div>

                  <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-fg-muted">
                    <div className="flex gap-1">
                      <dt>Enrolled</dt>
                      <dd className="font-medium text-fg">{klass._count.enrolments}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>Groups</dt>
                      <dd className="font-medium text-fg">{klass._count.groups}</dd>
                    </div>
                    {average !== null ? (
                      <div className="flex gap-1">
                        <dt>Average progress</dt>
                        <dd className="font-medium text-fg">{average}%</dd>
                      </div>
                    ) : null}
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
