import Link from "next/link";
import { forbidden } from "next/navigation";

import { Avatar, Badge } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { ROLE_LABEL } from "@/config/roles";
import { countPeople, listPeople } from "@/lib/db/queries/institution";
import { buildMetadata } from "@/lib/seo/metadata";

import { MemberControls } from "./_controls";

import { requireAuth } from "@/lib/auth/guards";
import { administeredCollegeIds } from "@/lib/db/queries/institution";

async function adminCollege() {
  const viewer = await requireAuth("/admin");
  const collegeId = administeredCollegeIds(viewer)[0];
  if (!collegeId) return null;
  return { viewer, collegeId };
}

export const metadata = buildMetadata({
  title: "People",
  description:
    "The roster for your college: who is here, what role they hold, and the controls for changing it.",
  index: false,
  path: "/admin/people",
});

export default async function PeoplePage({ searchParams }: PageProps<"/admin/people">) {
  const context = await adminCollege();
  if (!context) forbidden();

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const role = typeof params.role === "string" ? params.role : undefined;

  const filter = {
    q,
    ...(role ? { role: { equals: role as never } } : {}),
    take: 100,
  };

  const [people, total] = await Promise.all([
    listPeople(context.viewer, context.collegeId, filter),
    countPeople(context.viewer, context.collegeId, filter),
  ]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <form className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search name or email"
            className="bg-bg focus-visible:outline-primary h-9 rounded-md border border-border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          <select
            name="role"
            defaultValue={role ?? ""}
            className="bg-bg h-9 rounded-md border border-border px-3 text-sm"
          >
            <option value="">Every role</option>
            {Object.entries(ROLE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="hover:bg-bg-subtle h-9 rounded-md border border-border px-3 text-sm font-medium"
          >
            Filter
          </button>
        </form>

        <Link
          href="/admin/people/import"
          className="h-9 rounded-md bg-primary-fill px-4 text-sm leading-9 font-medium text-fg-on-primary"
        >
          Import a roster
        </Link>
      </div>

      <p className="text-sm text-fg-muted">{total} in this college</p>

      {people.length === 0 ? (
        <EmptyState
          title="Nobody here yet"
          description="Invite people by email, or import a roster from a spreadsheet."
          action={
            <Link href="/admin/people/import" className="font-medium underline underline-offset-4">
              Import a roster
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-2">
          {people.map((membership) => (
            <li
              key={membership.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={membership.user.name} seed={membership.user.username} size="sm" />
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {membership.user.name}
                    <Badge tone="outline">{ROLE_LABEL[membership.role]}</Badge>
                    {membership.state !== "ACTIVE" ? (
                      <Badge tone={membership.state === "SUSPENDED" ? "danger" : "neutral"}>
                        {membership.state.toLowerCase()}
                      </Badge>
                    ) : null}
                    {!membership.user.emailVerified ? (
                      <Badge tone="neutral">unconfirmed</Badge>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-fg-muted">{membership.user.email}</p>
                </div>
              </div>

              <MemberControls
                collegeId={context.collegeId}
                membershipId={membership.id}
                role={membership.role}
                suspended={membership.state === "SUSPENDED"}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
