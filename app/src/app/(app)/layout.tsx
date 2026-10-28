import { redirect } from "next/navigation";

import { AppShell, type NavEntry } from "@/components/layout/app-shell";
import {
  FacultyIcon,
  FeedIcon,
  GroupIcon,
  HomeIcon,
  ProjectIcon,
  SettingsIcon,
} from "@/components/icons";
import { ROLE_LABEL } from "@/config/roles";
import { currentViewer } from "@/lib/auth/session";
import { db } from "@/lib/db/client";

/**
 * The signed-in shell.
 *
 * The navigation is built from the viewer's memberships, not from a stored
 * preference, because roles are per-membership: a person who is faculty at one
 * college and alumni at another should see both sets of entries, and a
 * suspended member should see the same navigation as everyone else but find the
 * write actions unavailable when they get there — hiding the door is not the
 * same as locking it, and only the second is a permission.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const viewer = await currentViewer();

  // The proxy already redirects a request with no session cookie. This is the
  // check that actually holds: a forged or expired cookie gets past the proxy
  // and stops here, where a database is available.
  if (!viewer.userId) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: viewer.userId },
    select: { id: true, name: true, avatarUrl: true },
  });

  if (!user) redirect("/login");

  const roles = [...new Set(viewer.memberships.map((membership) => membership.role))];
  const primaryRole = roles[0] ?? "STUDENT";

  const nav: NavEntry[] = [
    { label: "Dashboard", href: "/dashboard", icon: <HomeIcon /> },
    { label: "Feed", href: "/feed", icon: <FeedIcon /> },
    { label: "Projects", href: "/my/projects", icon: <ProjectIcon /> },
    { label: "Groups", href: "/groups", icon: <GroupIcon /> },
    // Faculty only: the proposal queue is scoped to subjects they teach, so an
    // entry for anybody else would lead to an empty page.
    ...(viewer.teaches.length > 0
      ? [{ label: "Proposals", href: "/faculty/proposals", icon: <FacultyIcon /> }]
      : []),
    { label: "Settings", href: "/settings/account", icon: <SettingsIcon /> },
  ];

  return (
    <AppShell
      nav={nav}
      user={{
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: ROLE_LABEL[primaryRole],
      }}
    >
      {children}
    </AppShell>
  );
}
