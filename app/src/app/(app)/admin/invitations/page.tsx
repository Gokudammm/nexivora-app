import { forbidden } from "next/navigation";

import { Badge } from "@/components/ui/display";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { ROLE_LABEL } from "@/config/roles";
import { issueInvitations, revokeInvitation } from "@/lib/admin/actions";
import { db } from "@/lib/db/client";
import { env } from "@/lib/env";
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
  title: "Invitations",
  description:
    "Invite people into your college by email, with the role they will hold. Invitations expire after fourteen days.",
  index: false,
  path: "/admin/invitations",
});

/**
 * Loaded here rather than in the component body: "has this expired" is a fact
 * about the moment the data was read, and React's purity rule is right that a
 * render is not that moment.
 */
async function loadInvitations(collegeId: string) {
  const now = Date.now();

  const rows = await db.invitation.findMany({
    where: { collegeId },
    select: {
      id: true,
      email: true,
      role: true,
      state: true,
      expiresAt: true,
      createdAt: true,
      inviter: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return rows.map((row) => ({
    ...row,
    expired: row.state === "PENDING" && row.expiresAt.getTime() < now,
  }));
}

export default async function InvitationsPage() {
  const context = await adminCollege();
  if (!context) forbidden();

  const invitations = await loadInvitations(context.collegeId);

  return (
    <div className="grid gap-6">
      {env.EMAIL_TRANSPORT === "console" ? (
        <Alert tone="info" title="Development mode">
          Invitation emails print to the terminal running <code>npm run dev</code> rather than being
          sent. The join link is in there.
        </Alert>
      ) : null}

      <ResourceForm
        action={issueInvitations}
        hidden={{ collegeId: context.collegeId }}
        submitLabel="Send invitations"
        fields={[
          {
            name: "emails",
            label: "Email addresses",
            required: true,
            hint: "One or many, separated by commas, spaces or new lines.",
            placeholder: "ananya@nit.edu.in, rohit@nit.edu.in",
          },
          {
            name: "role",
            label: "Role they will hold",
            required: true,
            options: Object.entries(ROLE_LABEL)
              .filter(([value]) => value !== "PLATFORM_ADMIN")
              .map(([value, label]) => ({ value, label })),
          },
        ]}
      />

      {invitations.length === 0 ? (
        <EmptyState
          title="No invitations yet"
          description="Invite people by email, or let them register on one of your college's email domains — that association happens automatically."
          action={null}
        />
      ) : (
        <ul className="grid gap-2">
          {invitations.map((invitation) => {
            const expired = invitation.expired;

            return (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
              >
                <div className="grid gap-0.5">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {invitation.email}
                    <Badge tone="outline">{ROLE_LABEL[invitation.role]}</Badge>
                    <Badge
                      tone={
                        invitation.state === "ACCEPTED"
                          ? "accent"
                          : expired || invitation.state !== "PENDING"
                            ? "neutral"
                            : "outline"
                      }
                    >
                      {expired ? "expired" : invitation.state.toLowerCase()}
                    </Badge>
                  </p>
                  <p className="text-xs text-fg-muted">
                    Invited by {invitation.inviter.name} ·{" "}
                    {invitation.createdAt.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </div>

                {invitation.state === "PENDING" && !expired ? (
                  <ActionButton
                    action={revokeInvitation}
                    hidden={{ id: invitation.id, collegeId: context.collegeId }}
                    label="Revoke"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
