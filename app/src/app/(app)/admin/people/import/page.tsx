import { forbidden } from "next/navigation";

import { Alert } from "@/components/ui/feedback";
import { db } from "@/lib/db/client";
import { importTemplateCsv } from "@/lib/import/people";
import { listClasses } from "@/lib/db/queries/institution";
import { buildMetadata } from "@/lib/seo/metadata";

import { ImportWizard } from "./_wizard";

import { requireAuth } from "@/lib/auth/guards";
import { administeredCollegeIds } from "@/lib/db/queries/institution";

async function adminCollege() {
  const viewer = await requireAuth("/admin");
  const collegeId = administeredCollegeIds(viewer)[0];
  if (!collegeId) return null;
  return { viewer, collegeId };
}

export const metadata = buildMetadata({
  title: "Import a roster",
  description:
    "Upload a CSV, match the columns, and see exactly what will be created, updated and skipped before anything is written.",
  index: false,
  path: "/admin/people/import",
});

export default async function ImportPage() {
  const context = await adminCollege();
  if (!context) forbidden();

  const [members, classes] = await Promise.all([
    db.membership.findMany({
      where: { collegeId: context.collegeId },
      select: {
        userId: true,
        role: true,
        state: true,
        user: {
          select: {
            email: true,
            name: true,
            studentProfile: { select: { rollNumber: true } },
          },
        },
      },
    }),
    listClasses(context.viewer, context.collegeId),
  ]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h2 className="text-xl font-semibold">Import a roster</h2>
        <p className="text-fg-muted">
          Nothing is written until you have seen exactly what would change.
        </p>
      </div>

      <Alert tone="info" title="Nothing commits from this preview">
        The preview runs in your browser so it is instant. When you commit, the whole plan is
        recomputed on the server from the same file — a preview the page could edit before saving
        would not be worth showing.
      </Alert>

      <ImportWizard
        collegeId={context.collegeId}
        templateCsv={importTemplateCsv()}
        classes={classes.map((klass) => ({
          id: klass.id,
          label: `${klass.subject.code} ${klass.subject.name} · ${klass.term.name} · ${klass.section}`,
        }))}
        existing={members.map((member) => ({
          userId: member.userId,
          email: member.user.email,
          name: member.user.name,
          rollNumber: member.user.studentProfile?.rollNumber ?? null,
          role: member.role,
          state: member.state,
        }))}
      />
    </div>
  );
}
