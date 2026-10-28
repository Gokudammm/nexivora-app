import { forbidden } from "next/navigation";

import { FacultyTabs } from "@/components/faculty/faculty-tabs";
import { requireAuth } from "@/lib/auth/guards";
import { isFaculty, supervisedSubjectIds } from "@/lib/db/queries/faculty";
import { db } from "@/lib/db/client";

/**
 * THE FACULTY AREA.
 *
 * Gated on teaching something, not on holding a role. A person can be `FACULTY`
 * at a college and teach nothing this term, and a dashboard of empty panels is
 * worse than an honest refusal — so the gate is `supervisedSubjectIds().length`,
 * which is the same predicate every query beneath composes.
 *
 * The counts in the header are the answer to "what am I responsible for", and
 * they are read once here rather than per page.
 */
export default async function FacultyLayout({ children }: LayoutProps<"/faculty">) {
  const viewer = await requireAuth("/faculty");

  if (!isFaculty(viewer)) forbidden();

  const subjectIds = supervisedSubjectIds(viewer);
  const subjects = await db.subject.findMany({
    where: { id: { in: subjectIds } },
    select: { name: true, code: true },
    orderBy: { code: "asc" },
  });

  return (
    <div className="grid gap-6">
      <header className="grid gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Teaching</h1>
          <p className="text-sm text-fg-muted">
            {subjects.length === 0
              ? "No subjects assigned this term."
              : subjects.map((subject) => `${subject.code} ${subject.name}`).join(" · ")}
          </p>
        </div>

        <FacultyTabs />
      </header>

      {children}
    </div>
  );
}
