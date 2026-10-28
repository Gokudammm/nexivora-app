import { forbidden } from "next/navigation";

import { Badge } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { archiveDepartment, saveDepartment } from "@/lib/admin/actions";
import { listDepartments } from "@/lib/db/queries/institution";
import { buildMetadata } from "@/lib/seo/metadata";

import { ActionButton, ResourceForm } from "../_components/resource-form";

import { requireAuth } from "@/lib/auth/guards";
import { administeredCollegeIds } from "@/lib/db/queries/institution";

async function adminCollege() {
  const viewer = await requireAuth("/admin");
  const collegeId = administeredCollegeIds(viewer)[0];
  if (!collegeId) return null;
  return { viewer, collegeId };
}

export const metadata = buildMetadata({
  title: "Departments",
  description:
    "Create and manage the departments your college teaches through, each with its programmes and subjects beneath it.",
  index: false,
  path: "/admin/departments",
});

export default async function DepartmentsPage() {
  const context = await adminCollege();
  if (!context) forbidden();

  const departments = await listDepartments(context.viewer, context.collegeId);

  return (
    <div className="grid gap-6">
      <ResourceForm
        action={saveDepartment}
        hidden={{ collegeId: context.collegeId }}
        submitLabel="Add department"
        collapsible={{ label: "Add a department" }}
        fields={[
          {
            name: "name",
            label: "Name",
            required: true,
            placeholder: "Computer Science & Engineering",
          },
          {
            name: "code",
            label: "Code",
            required: true,
            narrow: true,
            placeholder: "CSE",
            hint: "Short, and unique within the college.",
          },
        ]}
      />

      {departments.length === 0 ? (
        <EmptyState
          title="No departments yet"
          description="A department is the top of the hierarchy — programmes, subjects and classes all hang from one."
          action={null}
        />
      ) : (
        <ul className="grid gap-3">
          {departments.map((department) => (
            <li
              key={department.id}
              className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-border p-5"
            >
              <div className="grid gap-1">
                <p className="flex items-center gap-2 font-medium">
                  {department.name}
                  <Badge tone="outline">{department.code}</Badge>
                  {department.archivedAt ? <Badge tone="neutral">archived</Badge> : null}
                </p>
                <p className="text-sm text-fg-muted">
                  {department.programmes.length} programme
                  {department.programmes.length === 1 ? "" : "s"} · {department._count.subjects}{" "}
                  subject{department._count.subjects === 1 ? "" : "s"}
                </p>
              </div>

              <ActionButton
                action={archiveDepartment}
                hidden={{ id: department.id, collegeId: context.collegeId }}
                label={department.archivedAt ? "Restore" : "Archive"}
                confirmLabel={department.archivedAt ? undefined : "Confirm archive"}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
