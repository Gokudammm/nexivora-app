import Link from "next/link";

import { Logo } from "@/components/Logo";

/**
 * The authentication shell.
 *
 * Deliberately not the site Header and Footer. A sign-in page with full
 * navigation invites people to wander off mid-task, and the nav is useless to
 * someone whose only goal right now is to get in. What stays is the wordmark —
 * linked home, so nobody is trapped — and a single line of reassurance about
 * what this place is.
 *
 * One column, centred, max ~26rem. Wider measures make a four-field form look
 * like an obstacle course.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="bg-bg-subtle flex min-h-dvh flex-col">
      <header className="px-6 py-6">
        <Link
          href="/"
          className="focus-visible:outline-primary inline-flex rounded-md focus-visible:outline-2 focus-visible:outline-offset-4"
          aria-label="Nexivora — home"
        >
          <Logo variant="lockup" size="md" />
        </Link>
      </header>

      <main id="main" className="flex flex-1 items-start justify-center px-6 pt-4 pb-20 sm:pt-10">
        <div className="w-full max-w-[26rem]">{children}</div>
      </main>

      <footer className="px-6 pb-8 text-center text-sm text-fg-muted">
        <p>
          <Link href="/legal/privacy" className="underline underline-offset-4 hover:text-fg">
            Privacy
          </Link>
          <span aria-hidden="true" className="px-2">
            ·
          </span>
          <Link href="/legal/terms" className="underline underline-offset-4 hover:text-fg">
            Terms
          </Link>
          <span aria-hidden="true" className="px-2">
            ·
          </span>
          <Link href="/help" className="underline underline-offset-4 hover:text-fg">
            Help
          </Link>
        </p>
      </footer>
    </div>
  );
}
