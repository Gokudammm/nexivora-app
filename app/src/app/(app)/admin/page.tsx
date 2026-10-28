import Link from "next/link";
import { forbidden } from "next/navigation";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/display";
import { readAudit } from "@/lib/audit";
import { db } from "@/lib/db/client";
import { buildMetadata } from "@/lib/seo/metadata";

import { requireAuth } from "@/lib/auth/guards";
import { administeredCollegeIds } from "@/lib/db/queries/institution";

async function adminCollege() {
  const viewer = await requireAuth("/admin");
  const collegeId = administeredCollegeIds(viewer)[0];
  if (!collegeId) return null;
  return { viewer, collegeId };
}

export const metadata = buildMetadata({
  title: "College administration",
  description:
    "Manage your college's departments, subjects, terms, classes and roster, and review everything that has been changed.",
  index: false,
  path: "/admin",
});

export default async function AdminOverviewPage() {
  const context = await adminCollege();
  if (!context) forbidden();

  const { collegeId } = context;

  const [departments, subjects, classes, students, faculty, pendingInvites, recent] =
    await Promise.all([
      db.department.count({ where: { collegeId, archivedAt: null } }),
      db.subject.count({ where: { collegeId, archivedAt: null } }),
      db.class.count({ where: { collegeId, archivedAt: null } }),
      db.membership.count({ where: { collegeId, role: "STUDENT", state: "ACTIVE" } }),
      db.membership.count({ where: { collegeId, role: "FACULTY", state: "ACTIVE" } }),
      db.invitation.count({ where: { collegeId, state: "PENDING" } }),
      readAudit({ collegeId, take: 8 }),
    ]);

  const stats = [
    { label: "Departments", value: departments, href: "/admin/departments" },
    { label: "Subjects", value: subjects, href: "/admin/subjects" },
    { label: "Classes", value: classes, href: "/admin/classes" },
    { label: "Students", value: students, href: "/admin/people" },
    { label: "Faculty", value: faculty, href: "/admin/people" },
    { label: "Pending invitations", value: pendingInvites, href: "/admin/invitations" },
  ];

  return (
    <div className="grid gap-8">
      <section>
        <ul className="grid gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <li key={stat.label}>
              <Link
                href={stat.href}
                className="focus-visible:outline-primary block rounded-xl border border-border p-5 transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <p className="text-xs tracking-wide text-fg-subtle uppercase">{stat.label}</p>
                <p className="mt-1 font-display text-2xl font-bold">{stat.value}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent changes</CardTitle>
        </CardHeader>
        <CardBody>
          {recent.length === 0 ? (
            <p className="text-fg-muted">Nothing has been changed yet.</p>
          ) : (
            <ul className="grid gap-2">
              {recent.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm"
                >
                  <span className="font-mono text-xs text-fg-subtle">
                    {entry.createdAt.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <span className="font-medium">{entry.action}</span>
                  <span className="text-fg-muted">{entry.subjectType}</span>
                  <span className="text-fg-subtle">{entry.actor?.name ?? "system"}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm">
            <Link href="/admin/audit-log" className="underline underline-offset-4">
              The full audit log
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
