import Link from "next/link";
import { forbidden } from "next/navigation";

import { Badge } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { saveClass } from "@/lib/admin/actions";
import { listClasses, listSubjects, listTerms } from "@/lib/db/queries/institution";
import { buildMetadata } from "@/lib/seo/metadata";

import { ResourceForm } from "../_components/resource-form";

import { requireAuth } from "@/lib/auth/guards";
import { administeredCollegeIds } from "@/lib/db/queries/institution";

async function adminCollege() {
  const viewer = await requireAuth("/admin");
  const collegeId = administeredCollegeIds(viewer)[0];
  if (!collegeId) return null;
  return { viewer, collegeId };
}

export const metadata = buildMetadata({
  title: "Classes",
  description:
    "A class is one subject taught in one term to one section. Faculty are assigned to it and students are enrolled in it.",
  index: false,
  path: "/admin/classes",
});

export default async function ClassesPage() {
  const context = await adminCollege();
  if (!context) forbidden();

  const [classes, subjects, terms] = await Promise.all([
    listClasses(context.viewer, context.collegeId),
    listSubjects(context.viewer, context.collegeId),
    listTerms(context.viewer, context.collegeId),
  ]);

  return (
    <div className="grid gap-6">
      <ResourceForm
        action={saveClass}
        hidden={{ collegeId: context.collegeId }}
        submitLabel="Create class"
        collapsible={{ label: "Create a class" }}
        fields={[
          {
            name: "subjectId",
            label: "Subject",
            required: true,
            options: subjects
              .filter((subject) => !subject.archivedAt)
              .map((subject) => ({
                value: subject.id,
                label: `${subject.code} — ${subject.name}`,
              })),
          },
          {
            name: "termId",
            label: "Term",
            required: true,
            options: terms.map((term) => ({
              value: term.id,
              label: term.isActive ? `${term.name} (active)` : term.name,
            })),
          },
          { name: "section", label: "Section", required: true, narrow: true, defaultValue: "A" },
        ]}
      />

      {classes.length === 0 ? (
        <EmptyState
          title="No classes yet"
          description="A class is one subject, in one term, for one section. Groups and projects form inside it."
          action={null}
        />
      ) : (
        <ul className="grid gap-2">
          {classes.map((klass) => (
            <li key={klass.id} className="rounded-lg border border-border px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="grid gap-0.5">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Link
                      href={`/admin/classes/${klass.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {klass.subject.name}
                    </Link>
                    <Badge tone="outline">{klass.subject.code}</Badge>
                    <Badge tone="outline">Section {klass.section}</Badge>
                    {klass.term.isActive ? (
                      <Badge tone="accent">{klass.term.name}</Badge>
                    ) : (
                      <Badge tone="neutral">{klass.term.name}</Badge>
                    )}
                  </p>
                  <p className="text-xs text-fg-muted">
                    {klass._count.enrolments} enrolled · {klass._count.groups} group
                    {klass._count.groups === 1 ? "" : "s"} ·{" "}
                    {klass.assignments.length > 0
                      ? klass.assignments.map((assignment) => assignment.user.name).join(", ")
                      : "no faculty assigned"}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
