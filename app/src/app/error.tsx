"use client";

import { useEffect } from "react";

import { ServerErrorScene } from "@/components/illustrations";
import { Container } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

/**
 * The route error boundary.
 *
 * Two things it does that a default error page does not: it offers a real
 * recovery action (`reset()` re-renders the segment without a full reload), and
 * it shows the digest — which is the only identifier a user can quote when
 * reporting the problem, and the one that ties their report to a server log.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Phase 17 replaces this with the structured logger and an alert on the
    // 5xx rate. Until then the console is the honest answer.
    console.error("[nexivora] route error", error);
  }, [error]);

  return (
    <main id="main" className="flex flex-1 items-center">
      <Container width="reading" className="py-16 text-center md:py-24">
        <ServerErrorScene width={240} className="mx-auto" />
        <h1 className="mt-8 font-display text-3xl font-bold md:text-4xl">Something went wrong</h1>
        <p className="mx-auto mt-4 max-w-md text-fg-muted">
          This is on us, not you. Try again — and if it keeps happening, tell us and include the
          reference below.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <a href={`mailto:${siteConfig.contact.support}`}>Report it</a>
          </Button>
        </div>

        {error.digest ? (
          <p className="mt-8 font-mono text-xs text-fg-subtle">Reference: {error.digest}</p>
        ) : null}
      </Container>
    </main>
  );
}
