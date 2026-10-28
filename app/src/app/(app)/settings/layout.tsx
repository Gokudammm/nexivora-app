import Link from "next/link";

const TABS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/privacy", label: "Privacy" },
  { href: "/settings/account", label: "Account" },
  { href: "/settings/security", label: "Security" },
] as const;

export default function SettingsLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-8">
      <header className="grid gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

        <nav aria-label="Settings sections">
          <ul className="flex gap-1 border-b border-border">
            {TABS.map((tab) => (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className="focus-visible:outline-primary aria-[current=page]:border-primary -mb-px inline-block border-b-2 border-transparent px-3 py-2 text-sm font-medium text-fg-muted hover:border-border hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 aria-[current=page]:text-fg"
                >
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {children}
    </div>
  );
}
