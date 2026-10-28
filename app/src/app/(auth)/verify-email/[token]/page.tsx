import Link from "next/link";

import { Alert } from "@/components/ui/feedback";
import { verifyEmail } from "@/lib/auth/actions";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Confirming your address",
  description:
    "Confirming your Nexivora email address so you can start creating work with your team and your college.",
  index: false,
  path: "/verify-email",
});

/**
 * The link target.
 *
 * The token is consumed on render rather than behind a button. That is a
 * deliberate trade: it means an email scanner that prefetches links can burn
 * the token, but requiring a click after a click is the kind of friction that
 * makes people give up on verification entirely — and an unverified account
 * cannot do anything, so giving up is worse. Resending is one button away.
 */
export default async function VerifyEmailTokenPage({ params }: PageProps<"/verify-email/[token]">) {
  const { token } = await params;
  const result = await verifyEmail(token);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {result.ok ? "Address confirmed" : "That link did not work"}
      </h1>

      {result.ok ? (
        <Alert tone="success">Everything is unlocked. Welcome to Nexivora.</Alert>
      ) : (
        <Alert tone="danger">{result.error}</Alert>
      )}

      <Link
        href={result.ok ? "/onboarding" : "/verify-email"}
        className="text-center font-medium underline underline-offset-4"
      >
        {result.ok ? "Finish setting up your account" : "Send a new link"}
      </Link>
    </div>
  );
}
