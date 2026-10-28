import Link from "next/link";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { resetPassword } from "@/lib/auth/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/policy-password";
import { buildMetadata } from "@/lib/seo/metadata";

import { AuthForm } from "../../_components/auth-form";

export const metadata = buildMetadata({
  title: "Choose a new password",
  description:
    "Choose a new password for your Nexivora account. Every other signed-in device will be signed out once it is set.",
  index: false,
  path: "/reset-password",
});

export default async function ResetPasswordPage({ params }: PageProps<"/reset-password/[token]">) {
  const { token } = await params;

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-fg-muted">
          Setting it signs out every device that is currently signed in, including any that should
          not be.
        </p>
      </div>

      <AuthForm
        action={resetPassword}
        submitLabel="Set new password"
        pendingLabel="Setting…"
        footer={
          <p className="text-center text-sm text-fg-muted">
            <Link href="/login" className="font-medium text-fg underline underline-offset-4">
              Back to sign in
            </Link>
          </p>
        }
      >
        <input type="hidden" name="token" value={token} />

        <Field label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}>
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            autoFocus
            minLength={MIN_PASSWORD_LENGTH}
          />
        </Field>

        <Field label="Confirm new password">
          <Input name="confirm" type="password" autoComplete="new-password" required />
        </Field>
      </AuthForm>
    </div>
  );
}
