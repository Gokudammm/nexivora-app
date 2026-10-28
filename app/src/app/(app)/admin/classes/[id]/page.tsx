import Link from "next/link";
import { forbidden, notFound } from "next/navigation";

import { Avatar, Badge, Card, CardBody, CardHeader, CardTitle } from "@/components/ui/display";
import { getClass, listPeople } from "@/lib/db/queries/institution";
import { assignFaculty } from "@/lib/admin/actions";
import { buildMetadata } from "@/lib/seo/metadata";

import { ResourceForm } from "../../_components/resource-form";

import { requireAuth } from "@/lib/auth/guards";
import { administeredCollegeIds } from "@/lib/db/queries/institution";

async function adminCollege() {
  const viewer = await requireAuth("/admin");
  const collegeId = administeredCollegeIds(viewer)[0];
  if (!collegeId) return null;
  return { viewer, collegeId };
}

export const metadata = buildMetadata({
  title: "Class",
  description:
    "The roster for one class: who is enrolled, who teaches it, which groups have formed and what they are building.",
  index: false,
  path: "/admin/classes",
});

export default async function ClassDetailPage({ params }: PageProps<"/admin/classes/[id]">) {
  const context = await adminCollege();
  if (!context) forbidden();

  const { id } = await params;
  const klass = await getClass(context.viewer, context.collegeId, id);
  if (!klass) notFound();

  const faculty = await listPeople(context.viewer, context.collegeId, {
    role: { equals: "FACULTY" },
    take: 200,
  });

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <p className="text-sm">
          <Link
            href="/admin/classes"
            className="text-fg-muted underline underline-offset-4 hover:text-fg"
          >
            ← All classes
          </Link>
        </p>
        <h2 className="text-xl font-semibold">
          {klass.subject.name} · Section {klass.section}
        </h2>
        <p className="text-fg-muted">
          {klass.subject.department.name} · {klass.term.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Faculty</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4">
          {klass.assignments.length === 0 ? (
            <p className="text-fg-muted">
              Nobody is assigned. Faculty scope is per subject, so this is what decides who can
              approve and evaluate this class&rsquo;s projects.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-3">
              {klass.assignments.map((assignment) => (
                <li
                  key={assignment.id}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <Avatar name={assignment.user.name} seed={assignment.user.username} size="sm" />
                  <span className="text-sm">{assignment.user.name}</span>
                </li>
              ))}
            </ul>
          )}

          <ResourceForm
            action={assignFaculty}
            hidden={{ collegeId: context.collegeId, classId: klass.id }}
            submitLabel="Assign"
            collapsible={{ label: "Assign a faculty member" }}
            fields={[
              {
                name: "userId",
                label: "Faculty member",
                required: true,
                options: faculty.map((member) => ({
                  value: member.user.id,
                  label: member.user.name,
                })),
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Roster ({klass.enrolments.length})</CardTitle>
        </CardHeader>
        <CardBody>
          {klass.enrolments.length === 0 ? (
            <p className="text-fg-muted">
              Nobody is enrolled yet. Import a roster from{" "}
              <Link href="/admin/people/import" className="underline underline-offset-4">
                People → Import
              </Link>
              .
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {klass.enrolments.map((enrolment) => (
                <li key={enrolment.id} className="flex items-center gap-2 text-sm">
                  <Avatar name={enrolment.user.name} seed={enrolment.user.username} size="sm" />
                  <span>{enrolment.user.name}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Groups ({klass.groups.length})</CardTitle>
        </CardHeader>
        <CardBody>
          {klass.groups.length === 0 ? (
            <p className="text-fg-muted">No groups have formed in this class yet.</p>
          ) : (
            <ul className="grid gap-2">
              {klass.groups.map((group) => (
                <li key={group.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{group.name}</span>
                  <Badge tone="outline">{group._count.members} members</Badge>
                  <Badge tone="outline">{group._count.projects} projects</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
