import Link from "next/link";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/lib/auth/actions";
import { buildMetadata } from "@/lib/seo/metadata";

import { AuthForm } from "../_components/auth-form";

export const metadata = buildMetadata({
  title: "Reset your password",
  description:
    "Send yourself a link to choose a new Nexivora password. The link works only once and expires after thirty minutes.",
  index: false,
  path: "/forgot-password",
});

export default function ForgotPasswordPage() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-fg-muted">
          Tell us your address and we will send a link to choose a new password.
        </p>
      </div>

      <AuthForm
        action={requestPasswordReset}
        submitLabel="Send the link"
        pendingLabel="Sending…"
        footer={
          <p className="text-center text-sm text-fg-muted">
            <Link href="/login" className="font-medium text-fg underline underline-offset-4">
              Back to sign in
            </Link>
          </p>
        }
      >
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
      </AuthForm>
    </div>
  );
}
