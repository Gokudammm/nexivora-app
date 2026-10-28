import { forbidden } from "next/navigation";

import { Badge } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { saveSubject } from "@/lib/admin/actions";
import { listDepartments, listSubjects } from "@/lib/db/queries/institution";
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
  title: "Subjects",
  description:
    "The subjects your college teaches. A subject is what a class runs, what faculty are assigned to, and what a project belongs under.",
  index: false,
  path: "/admin/subjects",
});

export default async function SubjectsPage() {
  const context = await adminCollege();
  if (!context) forbidden();

  const [subjects, departments] = await Promise.all([
    listSubjects(context.viewer, context.collegeId),
    listDepartments(context.viewer, context.collegeId),
  ]);

  const departmentOptions = departments
    .filter((department) => !department.archivedAt)
    .map((department) => ({ value: department.id, label: department.name }));

  return (
    <div className="grid gap-6">
      <ResourceForm
        action={saveSubject}
        hidden={{ collegeId: context.collegeId }}
        submitLabel="Add subject"
        collapsible={{ label: "Add a subject" }}
        fields={[
          { name: "name", label: "Name", required: true, placeholder: "Embedded Systems" },
          { name: "code", label: "Code", required: true, narrow: true, placeholder: "ECE105" },
          { name: "departmentId", label: "Department", required: true, options: departmentOptions },
          { name: "credits", label: "Credits", type: "number", narrow: true, defaultValue: 3 },
          { name: "semester", label: "Semester", type: "number", narrow: true },
        ]}
      />

      {subjects.length === 0 ? (
        <EmptyState
          title="No subjects yet"
          description="Add the subjects this college teaches. Classes and projects both hang from them."
          action={null}
        />
      ) : (
        <ul className="grid gap-2">
          {subjects.map((subject) => (
            <li
              key={subject.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
            >
              <div className="grid gap-0.5">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {subject.name}
                  <Badge tone="outline">{subject.code}</Badge>
                  {subject.archivedAt ? <Badge tone="neutral">archived</Badge> : null}
                </p>
                <p className="text-xs text-fg-muted">
                  {subject.department.name}
                  {subject.semester ? ` · semester ${subject.semester}` : ""} · {subject.credits}{" "}
                  credit{subject.credits === 1 ? "" : "s"} · {subject._count.classes} class
                  {subject._count.classes === 1 ? "" : "es"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
