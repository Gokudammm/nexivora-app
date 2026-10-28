import Link from "next/link";

import { NotFoundScene } from "@/components/illustrations";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Container } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";

/**
 * 404.
 *
 * **Returns a real 404 status**, not a 200 with an error page — a soft 404 is
 * one of the specific failures the Google technical guidance calls out, and it
 * causes the page to be indexed as real content.
 *
 * It lives outside the `(site)` group, so it supplies its own Header, Footer and
 * `main` landmark. It also offers real routes rather than only a link home: a
 * dead end helps nobody who arrived from a stale link.
 */
export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="flex flex-1 items-center">
        <Container width="reading" className="py-16 text-center md:py-24">
          <NotFoundScene width={260} className="mx-auto" />
          <h1 className="mt-8 font-display text-3xl font-bold md:text-4xl">
            That page does not exist
          </h1>
          <p className="mx-auto mt-4 max-w-md text-fg-muted">
            The link may be stale, or the project may be private. Private projects and profiles are
            not visible publicly, and they return this page rather than confirming they exist.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/explore">Explore projects</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Home</Link>
            </Button>
          </div>

          <nav aria-label="Popular pages" className="mt-12 border-t border-border pt-8">
            <h2 className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">
              Popular pages
            </h2>
            <ul className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
              {[
                { label: "Project ideas", href: "/ideas" },
                { label: "Topics", href: "/topics" },
                { label: "SDG showcase", href: "/sdg" },
                { label: "Knowledge hub", href: "/knowledge" },
                { label: "How it works", href: "/how-it-works" },
                { label: "Help", href: "/help" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-fg-muted underline-offset-4 hover:text-fg hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </main>
      <Footer />
    </>
  );
}
