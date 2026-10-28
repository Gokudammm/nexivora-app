import { NextResponse, type NextRequest } from "next/server";

/**
 * ROUTE GATING.
 *
 * **This is a convenience, not the security boundary.** It exists so a signed-out
 * visitor lands on the sign-in page instead of a broken dashboard, and so they
 * come back where they were going afterwards. It is not what protects data.
 *
 * The data is protected by `visibleTo(viewer)` in the query layer and `can()`
 * in the policy, both of which run whether or not this file did. That ordering
 * is deliberate and Phase 4's acceptance criterion 3 tests it directly: a
 * cross-college read must return null **with this disabled**.
 *
 * Next 16 renamed Middleware to Proxy (ADR-014). The file is `proxy.ts` and the
 * export is `proxy`. A `middleware.ts` here would be *silently ignored* — no
 * error, no warning, just an ungated application — which is exactly the kind of
 * failure worth a comment.
 *
 * Proxy runs on every matched request and may be deployed to a CDN edge, so it
 * does no database work and reads only the cookie's presence. Whether the
 * session is *valid* is decided by `currentViewer()` on the server, where a
 * database is available.
 */

const SESSION_COOKIE = "nexivora_session";

/** Signed-in areas. A signed-out visitor is redirected to sign in and returned. */
const PROTECTED = [
  "/dashboard",
  "/onboarding",
  "/settings",
  "/groups",
  "/my",
  "/admin",
  "/faculty",
  "/platform",
];

/** Sign-in and register: pointless once you are signed in. */
const GUEST_ONLY = ["/login", "/register", "/forgot-password"];

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession && PROTECTED.some((prefix) => pathname.startsWith(prefix))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Carry the intended destination so sign-in returns them to it rather than
    // dumping everyone on the dashboard. `signIn` validates this is a local
    // path before redirecting — an open redirect here would turn our own login
    // page into a phishing launch pad.
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (hasSession && GUEST_ONLY.some((prefix) => pathname === prefix)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  /**
   * Everything except static assets, the image optimiser and the files that
   * must be served to crawlers unconditionally.
   */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
