"use client";

import Link from "next/link";
import { useState } from "react";

import { Logo } from "@/components/Logo";
import { MenuIcon, MoonIcon, SunIcon, SystemIcon } from "@/components/icons";
import { Container } from "@/components/layout/primitives";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/overlay";
import { liveItems, primaryNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils/cn";

/**
 * The site header. One instance, used by every public page — no page builds
 * its own.
 *
 * It reads `config/navigation.ts` and renders **only routes whose `planned`
 * flag is false**, so navigation can never point at a 404 while phases are
 * still landing. Right now every route is planned, so the nav is deliberately
 * empty; Phase 2 flips the flags and the links appear with no change here.
 */
export function Header() {
  const nav = liveItems(primaryNav);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-border bg-surface/85 backdrop-blur-md">
      <Container>
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center rounded-md focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none"
            aria-label={`${siteConfig.name} home`}
          >
            <Logo variant="lockup" size="md" />
          </Link>

          {nav.length > 0 ? (
            <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}

          <div className="flex items-center gap-2">
            <ThemeToggle />

            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/login">Log in</Link>
            </Button>
            {/* The primary CTA stays visible at every width. "Log in" hides
                below sm and lives in the mobile drawer instead, but hiding the
                sign-up on a phone would leave the mobile header with nothing
                but a theme toggle. */}
            <Button asChild size="sm">
              <Link href="/register">Get started</Link>
            </Button>

            {nav.length > 0 ? (
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    className="md:hidden"
                    aria-label="Open menu"
                  >
                    <MenuIcon />
                  </Button>
                </SheetTrigger>
                <SheetContent title="Menu" side="right">
                  <nav aria-label="Mobile" className="grid gap-1">
                    {nav.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className="rounded-md px-3 py-2.5 text-base font-medium hover:bg-surface-sunken"
                      >
                        {item.label}
                        {item.description ? (
                          <span className="block text-sm font-normal text-fg-subtle">
                            {item.description}
                          </span>
                        ) : null}
                      </Link>
                    ))}
                  </nav>
                  <div className="mt-6 grid gap-2">
                    <Button asChild fullWidth>
                      <Link href="/register">Get started</Link>
                    </Button>
                    <Button asChild variant="outline" fullWidth>
                      <Link href="/login">Log in</Link>
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            ) : null}
          </div>
        </div>
      </Container>
    </header>
  );
}

/**
 * Theme toggle — light / dark / system.
 *
 * "System" is a real, selectable option rather than only an implicit default,
 * because a user who wants to follow their OS should be able to return to that
 * after choosing an explicit theme.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolved, setTheme } = useTheme();
  const Icon = theme === "system" ? SystemIcon : resolved === "dark" ? MoonIcon : SunIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          className={cn(className)}
          aria-label="Change theme"
        >
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        {(
          [
            { value: "light", label: "Light", icon: SunIcon },
            { value: "dark", label: "Dark", icon: MoonIcon },
            { value: "system", label: "System", icon: SystemIcon },
          ] as const
        ).map((option) => (
          <DropdownMenuItem
            key={option.value}
            onSelect={() => setTheme(option.value)}
            className={cn(theme === option.value && "font-medium text-primary-600")}
          >
            <option.icon size={16} />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
