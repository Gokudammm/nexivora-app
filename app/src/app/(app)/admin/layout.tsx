import Link from "next/link";
import { forbidden } from "next/navigation";

import { Badge } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import { requireAuth } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { administeredCollegeIds } from "@/lib/db/queries/institution";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/departments", label: "Departments" },
  { href: "/admin/subjects", label: "Subjects" },
  { href: "/admin/terms", label: "Terms" },
  { href: "/admin/classes", label: "Classes" },
  { href: "/admin/people", label: "People" },
  { href: "/admin/invitations", label: "Invitations" },
  { href: "/admin/college", label: "College" },
  { href: "/admin/audit-log", label: "Audit log" },
] as const;

/**
 * The admin console.
 *
 * Resolves the administered college **once**, here, so no child page has to
 * ask "which college am I administering" and none of them can get a different
 * answer. An administrator has exactly one; the rare person with two picks one
 * and the rest of the console follows.
 */
export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const viewer = await requireAuth("/admin");
  const collegeIds = administeredCollegeIds(viewer);

  if (collegeIds.length === 0) forbidden();

  const college = await db.college.findUnique({
    where: { id: collegeIds[0] },
    select: { id: true, name: true, shortName: true, verification: true },
  });

  if (!college) forbidden();

  return (
    <div className="grid gap-8">
      <header className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{college.shortName}</h1>
          <Badge tone={college.verification === "VERIFIED" ? "accent" : "neutral"}>
            {college.verification.toLowerCase()}
          </Badge>
        </div>

        {college.verification !== "VERIFIED" ? (
          <Alert tone="info" title="Not yet verified">
            Everything here works for your own members. Until verification completes, nothing from
            this college is publicly listed or indexable — that gate is what keeps the archive worth
            trusting.{" "}
            <Link href="/admin/college" className="font-medium underline underline-offset-4">
              Request verification
            </Link>
            .
          </Alert>
        ) : null}

        <nav aria-label="Admin sections" className="overflow-x-auto">
          <ul className="flex min-w-max gap-1 border-b border-border">
            {TABS.map((tab) => (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className="focus-visible:outline-primary -mb-px inline-block border-b-2 border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap text-fg-muted hover:border-border hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {children}
    </div>
  );
}
