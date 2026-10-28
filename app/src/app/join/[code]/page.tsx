import Link from "next/link";

import { Logo } from "@/components/Logo";
import { Alert } from "@/components/ui/feedback";
import { ROLE_LABEL } from "@/config/roles";
import { db } from "@/lib/db/client";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Join your college",
  description:
    "You have been invited to a college on Nexivora. Confirm what you are joining, then create an account or sign in.",
  index: false,
  path: "/join",
});

/**
 * The invitation landing page.
 *
 * Public, because the invitee has no account yet. It resolves the code and
 * **shows what is being joined before asking for anything** — an invite link
 * that leads straight to a signup form, with no indication of who invited you
 * or to what, is indistinguishable from a phishing page.
 *
 * The code is not consumed here. Accepting happens when the account is created
 * or signed into, so a previewed link is not a spent one.
 */
/**
 * Loaded here rather than in the component body.
 *
 * "Has this expired" is a fact about the moment the data was read, not about
 * the moment React happened to render — which is what React's purity rule is
 * getting at, and it is right.
 */
async function loadInvitation(code: string) {
  const now = Date.now();

  const invitation = await db.invitation.findUnique({
    where: { code },
    select: {
      email: true,
      role: true,
      state: true,
      expiresAt: true,
      college: { select: { name: true, city: true, state: true, verification: true } },
      inviter: { select: { name: true } },
    },
  });

  const expired = invitation ? invitation.expiresAt.getTime() < now : false;

  return {
    invitation,
    expired,
    usable: Boolean(invitation && invitation.state === "PENDING" && !expired),
  };
}

export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const { invitation, expired, usable } = await loadInvitation(code);

  return (
    <div className="bg-bg-subtle flex min-h-dvh flex-col">
      <header className="px-6 py-6">
        <Link href="/" aria-label="Nexivora — home" className="inline-flex">
          <Logo variant="lockup" size="md" />
        </Link>
      </header>

      <main id="main" className="flex flex-1 items-start justify-center px-6 pt-4 pb-20 sm:pt-10">
        <div className="grid w-full max-w-[26rem] gap-6">
          {!invitation ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">This link does not work</h1>
              <Alert tone="danger">
                We could not find that invitation. Ask whoever invited you to send a new one.
              </Alert>
            </>
          ) : !usable ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">
                {expired ? "This invitation has expired" : "This invitation is no longer valid"}
              </h1>
              <Alert tone="warning">
                {expired
                  ? "Invitations last fourteen days. Ask for a new one."
                  : "It has already been used or was withdrawn."}
              </Alert>
            </>
          ) : (
            <>
              <div className="grid gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Join {invitation.college.name}
                </h1>
                <p className="text-fg-muted">
                  {invitation.inviter.name} invited{" "}
                  <strong className="text-fg">{invitation.email}</strong> to join as{" "}
                  {ROLE_LABEL[invitation.role].toLowerCase()}.
                </p>
              </div>

              <dl className="bg-bg grid gap-2 rounded-xl border border-border p-4 text-sm">
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 text-fg-subtle">College</dt>
                  <dd>{invitation.college.name}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 text-fg-subtle">Where</dt>
                  <dd>
                    {invitation.college.city}, {invitation.college.state}
                  </dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 text-fg-subtle">Your role</dt>
                  <dd>{ROLE_LABEL[invitation.role]}</dd>
                </div>
              </dl>

              {invitation.college.verification !== "VERIFIED" ? (
                <Alert tone="info">
                  This college has not completed verification yet. You can use everything
                  internally; nothing from it is publicly visible until it does.
                </Alert>
              ) : null}

              <div className="grid gap-3">
                <Link
                  href={`/register?invite=${code}`}
                  className="rounded-md bg-primary-fill px-4 py-3 text-center font-medium text-fg-on-primary"
                >
                  Create an account
                </Link>
                <Link
                  href={`/login?next=${encodeURIComponent(`/join/${code}`)}`}
                  className="text-center text-sm underline underline-offset-4"
                >
                  I already have an account
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
