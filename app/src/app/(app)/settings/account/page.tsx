import Link from "next/link";

import {
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/display";
import { Alert } from "@/components/ui/feedback";
import { ROLE_LABEL } from "@/config/roles";
import { requireAuth } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { buildMetadata } from "@/lib/seo/metadata";

import { SignOutButton } from "./_components";

export const metadata = buildMetadata({
  title: "Account",
  description:
    "Your Nexivora account details, the colleges you belong to, and the controls for signing out or leaving.",
  index: false,
  path: "/settings/account",
});

export default async function AccountPage() {
  const viewer = await requireAuth("/settings/account");

  const user = await db.user.findUnique({
    where: { id: viewer.userId },
    select: {
      name: true,
      email: true,
      username: true,
      emailVerified: true,
      createdAt: true,
      memberships: {
        select: { role: true, state: true, college: { select: { name: true, slug: true } } },
      },
    },
  });

  if (!user) return null;

  return (
    <div className="grid gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>How you appear and how we reach you.</CardDescription>
        </CardHeader>
        <CardBody className="grid gap-4">
          <Detail label="Name" value={user.name} />
          <Detail
            label="Email"
            value={user.email}
            note={
              user.emailVerified ? undefined : (
                <Link href="/verify-email" className="underline underline-offset-4">
                  Not confirmed — confirm it
                </Link>
              )
            }
          />
          <Detail
            label="Profile URL"
            value={`/p/${user.username}`}
            note="Your username becomes fixed 30 days after you join, because it is a public link other people cite."
          />
          <Detail
            label="Joined"
            value={user.createdAt.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Colleges</CardTitle>
          <CardDescription>
            Your role is per college, not global — you can hold a different one at each.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {user.memberships.length === 0 ? (
            <p className="text-fg-muted">
              You are not attached to a college yet. Register with an institutional address, or
              accept an invitation.
            </p>
          ) : (
            <ul className="grid gap-2">
              {user.memberships.map((membership) => (
                <li
                  key={`${membership.college.slug}-${membership.role}`}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-4 py-3"
                >
                  <span className="font-medium">{membership.college.name}</span>
                  <Badge>{ROLE_LABEL[membership.role]}</Badge>
                  {membership.state !== "ACTIVE" ? (
                    <Badge tone="neutral">{membership.state.toLowerCase()}</Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Leaving</CardTitle>
          <CardDescription>What happens to your work if you delete your account.</CardDescription>
        </CardHeader>
        <CardBody className="grid gap-4">
          <Alert tone="info">
            Work you made alone is deleted. Work that is part of a group&rsquo;s shared record is
            anonymised rather than removed — deleting it would take away your teammates&rsquo;
            evidence of what they did. Account deletion lands in Phase 16 with the rest of the data
            controls.
          </Alert>

          <div>
            <SignOutButton />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Detail({ label, value, note }: { label: string; value: string; note?: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:items-baseline sm:gap-4">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="grid gap-0.5">
        <span className="font-medium">{value}</span>
        {note ? <span className="text-sm text-fg-muted">{note}</span> : null}
      </dd>
    </div>
  );
}
