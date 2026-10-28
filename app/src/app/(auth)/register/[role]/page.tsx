import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ROLE_BY_SLUG, ROLE_CHOICES } from "@/config/roles";
import { register } from "@/lib/auth/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/policy-password";
import { buildMetadata } from "@/lib/seo/metadata";

import { AuthForm } from "../../_components/auth-form";

export function generateStaticParams() {
  return ROLE_CHOICES.map((choice) => ({ role: choice.slug }));
}

export async function generateMetadata({ params }: PageProps<"/register/[role]">) {
  const { role } = await params;
  const choice = ROLE_BY_SLUG[role];

  return buildMetadata({
    title: choice ? `Join as ${choice.label.toLowerCase()}` : "Create an account",
    description:
      "Create your Nexivora account. Registering with your institutional address associates you with your college automatically.",
    index: false,
    path: `/register/${role}`,
  });
}

export default async function RegisterRolePage({ params }: PageProps<"/register/[role]">) {
  const { role } = await params;
  const choice = ROLE_BY_SLUG[role];

  if (!choice) notFound();

  const needsVerification = choice.role === "COMPANY" || choice.role === "COLLEGE_ADMIN";

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <p className="text-sm font-medium text-fg-muted">
          <Link href="/register" className="underline underline-offset-4 hover:text-fg">
            ← Choose a different role
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Join as {choice.label.toLowerCase()}
        </h1>
        <p className="text-fg-muted">{choice.blurb}</p>
      </div>

      {needsVerification ? (
        <Alert tone="info" title="This account needs verifying">
          {choice.role === "COMPANY"
            ? "You can create a profile straight away. Posting an opportunity or contacting a student needs verification first — that gate is what keeps fake listings off the platform."
            : "You can set up your college straight away. Publishing it, and appearing in inter-college surfaces, needs verification first."}
        </Alert>
      ) : null}

      <AuthForm
        action={register}
        submitLabel="Create account"
        pendingLabel="Creating your account…"
        footer={
          <p className="text-center text-sm text-fg-muted">
            By continuing you agree to our{" "}
            <Link href="/legal/terms" className="underline underline-offset-4 hover:text-fg">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="underline underline-offset-4 hover:text-fg">
              privacy policy
            </Link>
            .
          </p>
        }
      >
        <input type="hidden" name="role" value={choice.role} />

        <Field label={choice.role === "COMPANY" ? "Organisation name" : "Full name"}>
          <Input name="name" autoComplete="name" required autoFocus />
        </Field>

        <Field
          label="Email"
          hint={
            choice.role === "COMPANY"
              ? "Use your work address."
              : "Use your institutional address if you have one — it connects you to your college automatically."
          }
        >
          <Input name="email" type="email" autoComplete="email" required />
        </Field>

        <Field
          label="Password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters. A short phrase you will remember beats a short password with symbols in it.`}
        >
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
        </Field>
      </AuthForm>
    </div>
  );
}
