import { forbidden } from "next/navigation";

import { Badge } from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import { activateTerm, saveTerm } from "@/lib/admin/actions";
import { listTerms } from "@/lib/db/queries/institution";
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
  title: "Terms",
  description:
    "Academic sessions. Every project, class and report rolls up to a term, so exactly one of them is active at a time.",
  index: false,
  path: "/admin/terms",
});

const fmt = (date: Date) =>
  date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function TermsPage() {
  const context = await adminCollege();
  if (!context) forbidden();

  const terms = await listTerms(context.viewer, context.collegeId);
  const active = terms.find((term) => term.isActive);

  return (
    <div className="grid gap-6">
      {!active ? (
        <Alert tone="warning" title="No active term">
          Every project and report rolls up to a term. Until one is active, the dashboard and the
          class pickers have nothing to default to.
        </Alert>
      ) : null}

      <ResourceForm
        action={saveTerm}
        hidden={{ collegeId: context.collegeId }}
        submitLabel="Add term"
        collapsible={{ label: "Add a term" }}
        fields={[
          { name: "name", label: "Name", required: true, placeholder: "Odd 2026-27" },
          { name: "startsOn", label: "Starts", type: "date", required: true, narrow: true },
          { name: "endsOn", label: "Ends", type: "date", required: true, narrow: true },
        ]}
      />

      <ul className="grid gap-2">
        {terms.map((term) => (
          <li
            key={term.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
          >
            <div className="grid gap-0.5">
              <p className="flex items-center gap-2 text-sm font-medium">
                {term.name}
                {term.isActive ? <Badge tone="accent">active</Badge> : null}
              </p>
              <p className="text-xs text-fg-muted">
                {fmt(term.startsOn)} – {fmt(term.endsOn)} · {term._count.classes} classes ·{" "}
                {term._count.projects} projects
              </p>
            </div>

            {term.isActive ? null : (
              <ActionButton
                action={activateTerm}
                hidden={{ id: term.id, collegeId: context.collegeId }}
                label="Make active"
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
