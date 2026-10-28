/**
 * The route registry.
 *
 * Every navigable route is declared here with a `planned` flag. Header, Footer
 * and the command palette all read from this file and **never render a link to
 * a route whose `planned` flag is true** — which is what stops navigation from
 * pointing at a 404 while phases are still landing.
 *
 * Each phase flips its own routes to `planned: false` as they ship.
 */

export type NavItem = {
  label: string;
  href: string;
  /** True until the route actually exists. Links are suppressed while true. */
  planned: boolean;
  description?: string;
  /** The phase that builds it — for the plan, and for grepping. */
  phase: number;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

/** Primary header navigation. */
export const primaryNav: NavItem[] = [
  {
    label: "Explore",
    href: "/explore",
    planned: true,
    phase: 2,
    description: "Real student projects, published and documented",
  },
  {
    label: "Ideas",
    href: "/ideas",
    planned: true,
    phase: 2,
    description: "Project ideas looking for teams",
  },
  { label: "Topics", href: "/topics", planned: true, phase: 2, description: "Browse by domain" },
  { label: "How it works", href: "/how-it-works", planned: true, phase: 2 },
  { label: "Pricing", href: "/pricing", planned: true, phase: 2 },
];

/** Audience landing pages. */
export const audienceNav: NavItem[] = [
  { label: "For students", href: "/for-students", planned: true, phase: 2 },
  { label: "For faculty", href: "/for-faculty", planned: true, phase: 2 },
  { label: "For colleges", href: "/for-colleges", planned: true, phase: 2 },
  { label: "For companies", href: "/for-companies", planned: true, phase: 2 },
  { label: "For alumni", href: "/for-alumni", planned: true, phase: 2 },
];

/** Footer, grouped. */
export const footerNav: NavGroup[] = [
  {
    title: "Product",
    items: [
      { label: "Features", href: "/features", planned: true, phase: 2 },
      { label: "The workspace", href: "/features/workspace", planned: true, phase: 2 },
      {
        label: "Contribution ledger",
        href: "/features/contribution-ledger",
        planned: true,
        phase: 2,
      },
      { label: "Academic archive", href: "/features/archive", planned: true, phase: 2 },
      { label: "Pricing", href: "/pricing", planned: true, phase: 2 },
      { label: "Roadmap", href: "/roadmap", planned: true, phase: 2 },
      { label: "Changelog", href: "/changelog", planned: true, phase: 2 },
    ],
  },
  {
    title: "Discover",
    items: [
      { label: "Explore projects", href: "/explore", planned: true, phase: 2 },
      { label: "Idea hub", href: "/ideas", planned: true, phase: 2 },
      { label: "Topics", href: "/topics", planned: true, phase: 2 },
      { label: "SDG showcase", href: "/sdg", planned: true, phase: 2 },
      { label: "Colleges", href: "/colleges", planned: true, phase: 2 },
      { label: "Opportunities", href: "/opportunities", planned: true, phase: 2 },
      { label: "Knowledge hub", href: "/knowledge", planned: true, phase: 2 },
      { label: "Events", href: "/events", planned: true, phase: 14 },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "About", href: "/about", planned: true, phase: 2 },
      { label: "Contact", href: "/contact", planned: true, phase: 2 },
      { label: "FAQ", href: "/faq", planned: true, phase: 2 },
      { label: "Help centre", href: "/help", planned: true, phase: 2 },
    ],
  },
  {
    title: "Legal",
    items: [
      { label: "Privacy", href: "/legal/privacy", planned: true, phase: 2 },
      { label: "Terms", href: "/legal/terms", planned: true, phase: 2 },
      {
        label: "Community guidelines",
        href: "/legal/community-guidelines",
        planned: true,
        phase: 2,
      },
      { label: "Academic integrity", href: "/legal/academic-integrity", planned: true, phase: 2 },
      { label: "IP policy", href: "/legal/ip-policy", planned: true, phase: 2 },
      { label: "Accessibility", href: "/legal/accessibility", planned: true, phase: 2 },
      { label: "Grievance officer", href: "/legal/grievance", planned: true, phase: 2 },
    ],
  },
];

/** Authenticated application navigation, gated by role in Phase 4. */
export const appNav: NavItem[] = [
  { label: "Feed", href: "/feed", planned: true, phase: 10 },
  { label: "My groups", href: "/groups", planned: true, phase: 7 },
  { label: "Search", href: "/search", planned: true, phase: 11 },
  { label: "Notifications", href: "/notifications", planned: true, phase: 10 },
  { label: "Assistant", href: "/assistant", planned: true, phase: 18 },
  { label: "Settings", href: "/settings/profile", planned: true, phase: 6 },
];

/** Only ever render links that actually resolve. */
export function liveItems(items: NavItem[]): NavItem[] {
  return items.filter((item) => !item.planned);
}

export function liveGroups(groups: NavGroup[]): NavGroup[] {
  return groups
    .map((group) => ({ ...group, items: liveItems(group.items) }))
    .filter((group) => group.items.length > 0);
}
