import Link from "next/link";

import { Alert } from "@/components/ui/feedback";
import { currentViewer } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { env } from "@/lib/env";
import { buildMetadata } from "@/lib/seo/metadata";

import { ResendVerification } from "../_components/resend-verification";

export const metadata = buildMetadata({
  title: "Confirm your address",
  description:
    "Confirm your email address to finish setting up your Nexivora account, then start creating work with your team and college.",
  index: false,
  path: "/verify-email",
});

export default async function VerifyEmailPage() {
  const viewer = await currentViewer();

  const user = viewer.userId
    ? await db.user.findUnique({
        where: { id: viewer.userId },
        select: { email: true, emailVerified: true },
      })
    : null;

  if (user?.emailVerified) {
    return (
      <div className="grid gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Address confirmed</h1>
        <Alert tone="success">Your address is confirmed. Everything is unlocked.</Alert>
        <Link href="/dashboard" className="text-center font-medium underline underline-offset-4">
          Go to your dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Confirm your address</h1>
        <p className="text-fg-muted">
          We sent a link to{" "}
          {user?.email ? <strong className="text-fg">{user.email}</strong> : "your inbox"}. Until it
          is confirmed you can look around, but you cannot post or create work.
        </p>
      </div>

      {env.EMAIL_TRANSPORT === "console" ? (
        <Alert tone="info" title="Development mode">
          Email is printing to the terminal running <code>npm run dev</code> rather than being sent.
          The confirmation link is in there.
        </Alert>
      ) : null}

      {viewer.userId ? <ResendVerification /> : null}

      <p className="text-center text-sm text-fg-muted">
        <Link href="/" className="underline underline-offset-4 hover:text-fg">
          Look around first
        </Link>
      </p>
    </div>
  );
}
