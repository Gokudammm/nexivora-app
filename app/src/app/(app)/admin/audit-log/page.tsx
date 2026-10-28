import { forbidden } from "next/navigation";

import { EmptyState } from "@/components/ui/feedback";
import { readAudit } from "@/lib/audit";
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
  title: "Audit log",
  description:
    "Every administrative change, who made it and what it changed. Append-only, so it can answer a question rather than reflect one.",
  index: false,
  path: "/admin/audit-log",
});

export default async function AuditLogPage({ searchParams }: PageProps<"/admin/audit-log">) {
  const context = await adminCollege();
  if (!context) forbidden();

  const params = await searchParams;
  const action = typeof params.action === "string" ? params.action : undefined;

  const entries = await readAudit({ collegeId: context.collegeId, action, take: 100 });

  return (
    <div className="grid gap-4">
      <p className="text-fg-muted">
        Append-only. Nothing here can be edited or removed, which is the only thing that makes it
        worth consulting.
      </p>

      {entries.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description="Administrative changes appear here as they happen."
          action={null}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs tracking-wide text-fg-subtle uppercase">
                <th className="py-2 pr-4 font-medium">When</th>
                <th className="py-2 pr-4 font-medium">Who</th>
                <th className="py-2 pr-4 font-medium">Action</th>
                <th className="py-2 pr-4 font-medium">Subject</th>
                <th className="py-2 font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border/60 align-top">
                  <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap text-fg-subtle">
                    {entry.createdAt.toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">{entry.actor?.name ?? "system"}</td>
                  <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap">{entry.action}</td>
                  <td className="py-2 pr-4 text-fg-muted">{entry.subjectType}</td>
                  <td className="py-2 text-xs text-fg-muted">
                    {entry.reason ? (
                      <span>{entry.reason}</span>
                    ) : entry.after ? (
                      <code className="break-all">{JSON.stringify(entry.after).slice(0, 160)}</code>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
