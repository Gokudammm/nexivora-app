import Link from "next/link";

import { ServerErrorScene } from "@/components/illustrations";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Container } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";

/**
 * 403.
 *
 * Rendered by `forbidden()`, which the admin and faculty guards call when a
 * signed-in person reaches a route they are not entitled to. It returns a real
 * 403 status for the same reason `not-found.tsx` returns a real 404.
 *
 * **A 403 and a 404 are not interchangeable, and choosing between them is a
 * privacy decision.** This page says "you are signed in and this is not yours",
 * which is safe for a route whose existence is not itself information —
 * `/admin`, `/faculty`, `/platform`. Anything addressed by an id somebody could
 * guess at uses `notFound()` instead, because a 403 there confirms the thing
 * exists. That rule is why `/faculty/classes/[id]` 404s while this page exists
 * at all.
 */
export default function Forbidden() {
  return (
    <>
      <Header />
      <main id="main" className="flex flex-1 items-center">
        <Container width="reading" className="py-16 text-center md:py-24">
          <ServerErrorScene width={260} className="mx-auto" />
          <h1 className="mt-8 font-display text-3xl font-bold md:text-4xl">
            This area is not yours
          </h1>
          <p className="mx-auto mt-4 max-w-md text-fg-muted">
            You are signed in, but this section needs a role you do not hold at this college —
            teaching a subject, or administering the college. If that looks wrong, your college
            administrator is the person who assigns it.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/dashboard">Your dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact">Contact us</Link>
            </Button>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
