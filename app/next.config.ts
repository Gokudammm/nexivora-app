import type { NextConfig } from "next";

/**
 * Security headers. Verified against a running instance in Phase 16 with
 * `curl -I`, and set again at Nginx in Phase 17 (belt and braces — a header
 * dropped by a proxy misconfiguration is a silent failure).
 *
 * The full policy and its reasoning live in docs/SECURITY.md §5.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Vercel builds its own function bundles; standalone is for self-hosted Node.
  output: process.env.VERCEL === "1" ? undefined : "standalone",

  // Fail the production build on a type error rather than shipping it.
  // Next 16 removed the `eslint` config key along with `next lint`; linting is
  // now a separate step and runs in `npm run check` and in CI.
  typescript: { ignoreBuildErrors: false },

  poweredByHeader: false,

  // `forbidden()` and `unauthorized()` are still behind this flag in Next 16.
  // Twenty-one guards across admin and faculty call `forbidden()`; without the
  // flag every one of them throws "forbidden() is experimental" and the person
  // who hit a permission boundary gets a 500 instead of a 403. The failure is
  // invisible in a happy-path test — the guard only runs for a user who is
  // actually denied, which is never the user a check signs in as.
  experimental: {
    authInterrupts: true,
    serverActions: { bodySizeLimit: "3mb" },
  },

  // Static asset caching is deliberately NOT set here. Next already sends
  // immutable Cache-Control for its own hashed /_next/static output, and
  // overriding it warns at build time and can break dev behaviour. Production
  // edge caching is handled by Vercel or Nginx.
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
