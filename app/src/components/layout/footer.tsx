import Link from "next/link";

import { Logo } from "@/components/Logo";
import { Container } from "@/components/layout/primitives";
import { footerNav, liveGroups } from "@/config/navigation";
import { siteConfig } from "@/config/site";

/**
 * The site footer. One instance, used everywhere.
 *
 * Like the Header it reads `config/navigation.ts` and renders only routes that
 * actually exist. Until Phase 2 lands the marketing pages, the link columns are
 * empty by design and the footer collapses to the brand and copyright — which
 * is correct, and much better than a wall of links to 404s.
 */
export function Footer() {
  const groups = liveGroups(footerNav);
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-surface-raised">
      <Container className="py-12 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_1fr]">
          <div>
            <Link
              href="/"
              className="inline-flex rounded-md focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none"
              aria-label={`${siteConfig.name} home`}
            >
              <Logo variant="lockup" size="md" />
            </Link>
            <p className="mt-4 max-w-xs text-sm text-fg-muted">{siteConfig.positioning}</p>
            <p className="mt-4 text-sm text-fg-subtle">
              <a
                href={`mailto:${siteConfig.contact.general}`}
                className="underline-offset-4 hover:text-fg hover:underline"
              >
                {siteConfig.contact.general}
              </a>
            </p>
          </div>

          {groups.length > 0 ? (
            <nav
              aria-label="Footer"
              className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4"
            >
              {groups.map((group) => (
                <div key={group.title}>
                  <h2 className="text-sm font-semibold text-fg">{group.title}</h2>
                  <ul className="mt-3 grid gap-2">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="rounded-sm text-sm text-fg-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          ) : null}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-fg-subtle">
            © {year} {siteConfig.legalName}. {siteConfig.tagline}
          </p>
          <p className="text-sm text-fg-subtle">Built for academic work that deserves to last.</p>
        </div>
      </Container>
    </footer>
  );
}
