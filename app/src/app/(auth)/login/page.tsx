import Link from "next/link";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth/actions";
import { buildMetadata } from "@/lib/seo/metadata";

import { AuthForm } from "../_components/auth-form";

export const metadata = buildMetadata({
  title: "Sign in",
  description:
    "Sign in to Nexivora to reach your project workspace, your college archive and the people you are building with this term.",
  // A sign-in page has nothing for a search engine and every reason not to
  // compete with the pages that do.
  index: false,
  path: "/login",
});

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-fg-muted">
          Your work, your team and your college — where you left them.
        </p>
      </div>

      <AuthForm
        action={signIn}
        submitLabel="Sign in"
        pendingLabel="Checking…"
        footer={
          <p className="text-center text-sm text-fg-muted">
            New here?{" "}
            <Link href="/register" className="font-medium text-fg underline underline-offset-4">
              Create an account
            </Link>
          </p>
        }
      >
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <Field label="Email">
          <Input
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus
            placeholder="you@college.edu.in"
          />
        </Field>

        <Field label="Password">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>

        <p className="-mt-1 text-sm">
          <Link
            href="/forgot-password"
            className="text-fg-muted underline underline-offset-4 hover:text-fg"
          >
            Forgotten your password?
          </Link>
        </p>
      </AuthForm>
    </div>
  );
}
