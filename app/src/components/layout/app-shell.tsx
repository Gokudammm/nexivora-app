"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Logo } from "@/components/Logo";
import {
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LogoutIcon,
  MenuIcon,
  SearchIcon,
  SettingsIcon,
  UserIcon,
} from "@/components/icons";
import { ThemeToggle } from "@/components/layout/header";
import { useCommandPalette } from "@/components/layout/command-palette";
import { Avatar, Badge, Kbd } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetTrigger,
  Tooltip,
} from "@/components/ui/overlay";
import { cn } from "@/lib/utils/cn";

/**
 * The authenticated application shell.
 *
 * Sidebar behaviour, which is the part worth getting right once:
 *   - `lg` and up: full sidebar, collapsible to an icon rail
 *   - `md`: icon rail, with labels in tooltips
 *   - below `md`: a drawer, opened from the topbar
 *
 * The content region owns its own scroll so the sidebar and topbar stay put,
 * which is what makes a long task board or feed usable.
 */

export type NavEntry = {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Rendered as a small count next to the label. */
  badge?: number;
};

export function AppShell({
  nav,
  user,
  children,
}: {
  nav: NavEntry[];
  user: { name: string; role: string; avatarUrl?: string | null; id: string };
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const { setOpen: setCommandOpen } = useCommandPalette();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar — md and up */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface-raised md:flex",
          collapsed ? "w-16" : "w-16 lg:w-60",
        )}
      >
        <div
          className={cn("flex h-16 items-center px-3", collapsed ? "justify-center" : "lg:px-4")}
        >
          <Link href="/feed" aria-label="Nexivora home" className="flex items-center">
            <Logo variant="mark" size="md" className={cn(!collapsed && "lg:hidden")} />
            {!collapsed ? <Logo variant="lockup" size="md" className="hidden lg:block" /> : null}
          </Link>
        </div>

        <nav aria-label="Application" className="flex-1 space-y-1 overflow-y-auto p-2 lg:p-3">
          {nav.map((entry) => {
            const active = isActive(entry.href);
            const link = (
              <Link
                key={entry.href}
                href={entry.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none",
                  active
                    ? "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-600"
                    : "text-fg-muted hover:bg-surface-sunken hover:text-fg",
                  collapsed && "justify-center px-0",
                )}
              >
                <span className="shrink-0">{entry.icon}</span>
                <span
                  className={cn(
                    "flex-1 truncate",
                    collapsed ? "sr-only" : "sr-only lg:not-sr-only",
                  )}
                >
                  {entry.label}
                </span>
                {entry.badge && entry.badge > 0 ? (
                  <Badge
                    tone="primary"
                    className={cn(collapsed ? "sr-only" : "hidden lg:inline-flex")}
                  >
                    {entry.badge}
                  </Badge>
                ) : null}
              </Link>
            );

            // At the icon rail the label is invisible, so a tooltip carries it.
            return collapsed ? (
              <Tooltip key={entry.href} content={entry.label} side="right">
                {link}
              </Tooltip>
            ) : (
              <div key={entry.href} className="lg:contents">
                <Tooltip content={entry.label} side="right">
                  <span className="lg:hidden">{link}</span>
                </Tooltip>
                <span className="hidden lg:block">{link}</span>
              </div>
            );
          })}
        </nav>

        <div className="hidden border-t border-border p-3 lg:block">
          <Button
            variant="ghost"
            size="sm"
            fullWidth
            onClick={() => setCollapsed((c) => !c)}
            className="justify-start gap-2"
          >
            {collapsed ? <ChevronRightIcon size={16} /> : <ChevronLeftIcon size={16} />}
            <span className={collapsed ? "sr-only" : ""}>Collapse</span>
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-[var(--z-sticky)] flex h-16 items-center gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur-md md:px-6">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
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
            <SheetContent title="Menu" side="left">
              <nav aria-label="Application" className="grid gap-1">
                {nav.map((entry) => (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    onClick={() => setDrawerOpen(false)}
                    aria-current={isActive(entry.href) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium",
                      isActive(entry.href)
                        ? "bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-600"
                        : "text-fg-muted hover:bg-surface-sunken",
                    )}
                  >
                    {entry.icon}
                    {entry.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <Logo variant="mark" size="sm" className="md:hidden" />

          {/* Search opens the palette rather than being a second search box —
              one entry point, one mental model. */}
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="flex h-9 max-w-md flex-1 items-center gap-2 rounded-md border border-border px-3 text-sm text-fg-subtle transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:outline-none"
          >
            <SearchIcon size={16} />
            <span className="flex-1 text-left">Search…</span>
            <Kbd>⌘K</Kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" iconOnly aria-label="Notifications" asChild>
              <Link href="/notifications">
                <BellIcon />
              </Link>
            </Button>

            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Account menu"
                  className="rounded-full focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <Avatar name={user.name} seed={user.id} src={user.avatarUrl} size="sm" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
                <p className="px-2.5 pb-1.5 text-xs text-fg-subtle">{user.role}</p>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings/profile">
                    <UserIcon size={16} />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings/account">
                    <SettingsIcon size={16} />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/logout">
                    <LogoutIcon size={16} />
                    Sign out
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main id="main" className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
