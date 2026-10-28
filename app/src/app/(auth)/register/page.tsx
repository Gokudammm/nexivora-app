import Link from "next/link";

import { ROLE_CHOICES } from "@/config/roles";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Create an account",
  description:
    "Join Nexivora as a student, faculty member, alumnus, company or researcher. Your role decides what you see and what you can do.",
  index: false,
  path: "/register",
});

/**
 * The role chooser.
 *
 * Asking first, rather than collecting a name and email and then asking, is
 * deliberate: the role changes which fields the next screen needs, and a form
 * that grows extra fields after you have started filling it in feels like a
 * trick. It also sets expectations — a company arriving here should understand
 * immediately that this is an academic network, not a job board.
 */
export default function RegisterPage() {
  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Create an account</h1>
        <p className="text-fg-muted">Start by telling us who you are.</p>
      </div>

      <ul className="grid gap-3">
        {ROLE_CHOICES.map((choice) => (
          <li key={choice.role}>
            <Link
              href={`/register/${choice.slug}`}
              className="group bg-bg hover:border-primary hover:bg-bg-subtle focus-visible:outline-primary flex items-start gap-4 rounded-xl border border-border p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span
                aria-hidden="true"
                className="bg-bg-subtle group-hover:bg-bg mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg text-lg"
              >
                {choice.glyph}
              </span>
              <span className="grid gap-1">
                <span className="font-medium">{choice.label}</span>
                <span className="text-sm text-fg-muted">{choice.blurb}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-center text-sm text-fg-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-fg underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
