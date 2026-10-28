/**
 * Usernames nobody may take.
 *
 * A username is a top-level URL — `/p/ananya-sharma` today, but the reserved
 * list also covers the case where a future route moves a handle to the root.
 * More immediately: a username that matches a route segment produces links that
 * look right and go somewhere else, and there is no way to fix it afterwards
 * without breaking somebody's public URL.
 *
 * Three categories, and each is here for a different reason:
 *
 *  · **Routes**, present and plausible. `admin`, `settings`, `explore`.
 *  · **Impersonation risks.** `support`, `security`, `billing`, `noreply` — a
 *    message from `nexivora-support` is a phishing vector whoever sends it.
 *  · **Infrastructure conventions.** `www`, `api`, `cdn`, `static`, `.well-known`.
 *
 * Acceptance criterion 6: a username cannot be taken that would shadow an
 * existing route. `username.test.ts` asserts this against the real route list
 * rather than against this file, so a route added later without a reservation
 * fails the test instead of shipping.
 */

export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  // Existing routes and route groups.
  "about",
  "admin",
  "api",
  "auth",
  "changelog",
  "colleges",
  "contact",
  "dashboard",
  "explore",
  "faq",
  "features",
  "feed",
  "for-alumni",
  "for-colleges",
  "for-companies",
  "for-faculty",
  "for-students",
  "forgot-password",
  "groups",
  "help",
  "how-it-works",
  "ideas",
  "join",
  "knowledge",
  "legal",
  "login",
  "my",
  "logout",
  "onboarding",
  "opportunities",
  "p",
  "platform",
  "pricing",
  "privacy",
  "projects",
  "register",
  "reset-password",
  "roadmap",
  "sdg",
  "search",
  "settings",
  "signin",
  "signout",
  "signup",
  "style-guide",
  "terms",
  "topics",
  "verify",
  "verify-email",
  "workspace",

  // Files and conventions served from the root.
  "favicon",
  "favicon.ico",
  "icon",
  "manifest",
  "robots",
  "robots.txt",
  "sitemap",
  "sitemap.xml",
  "opengraph-image",
  "well-known",
  ".well-known",
  "_next",
  "static",
  "assets",
  "public",
  "cdn",
  "www",
  "mail",
  "smtp",
  "ftp",
  "ns",
  "mx",

  // Impersonation. A message from any of these reads as official.
  "abuse",
  "accounts",
  "admin-team",
  "administrator",
  "billing",
  "compliance",
  "help-desk",
  "helpdesk",
  "info",
  "legal-team",
  "moderator",
  "moderation",
  "nexivora",
  "nexivora-admin",
  "nexivora-support",
  "nexivora-team",
  "no-reply",
  "noreply",
  "official",
  "operations",
  "postmaster",
  "root",
  "security",
  "security-team",
  "staff",
  "support",
  "sysadmin",
  "system",
  "team",
  "trust",
  "verification",
  "verified",
  "webmaster",

  // Reserved for future use, so they are not taken first.
  "alumni",
  "companies",
  "company",
  "faculty",
  "mentors",
  "people",
  "profile",
  "profiles",
  "researchers",
  "students",
  "u",
  "user",
  "users",
]);

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/**
 * How long a new account may still change its handle.
 *
 * The public URL is a real asset — it gets cited, shared and linked. Letting it
 * change forever means every link to a profile is provisional; locking it
 * immediately means a typo at signup is permanent. Thirty days is long enough
 * to notice and short enough that a settled URL stays settled.
 */
export const USERNAME_LOCK_DAYS = 30;

export type UsernameCheck = { ok: true } | { ok: false; reason: string };

/**
 * Fold a typed handle into its canonical form.
 *
 * Separate from validation on purpose. When `checkUsername` lowercased its own
 * input, "Ananya" passed and the *unnormalised* string could reach the database
 * — colliding case-insensitively with an existing "ananya" while passing a
 * uniqueness check that is case-sensitive. Normalise first, then validate what
 * will actually be stored.
 */
export function normaliseUsername(candidate: string): string {
  return candidate.trim().toLowerCase();
}

/**
 * Validate a username's *shape and availability rules*. Uniqueness needs the
 * database and is checked by the caller — keeping this pure is what lets the
 * test run the whole route list through it without one.
 */
export function checkUsername(candidate: string): UsernameCheck {
  // Deliberately NOT normalised here — see normaliseUsername above. This checks
  // the string as it would be stored.
  const value = candidate;

  if (value !== value.trim()) {
    return { ok: false, reason: "Usernames cannot start or end with a space." };
  }

  if (value !== value.toLowerCase()) {
    return { ok: false, reason: "Usernames are lowercase, because URLs are compared that way." };
  }

  if (value.length < USERNAME_MIN) {
    return { ok: false, reason: `Usernames are at least ${USERNAME_MIN} characters.` };
  }

  if (value.length > USERNAME_MAX) {
    return { ok: false, reason: `Usernames are at most ${USERNAME_MAX} characters.` };
  }

  if (!/^[a-z0-9-]+$/.test(value)) {
    return {
      ok: false,
      reason: "Use lowercase letters, numbers and hyphens only — it has to work in a URL.",
    };
  }

  if (value.startsWith("-") || value.endsWith("-")) {
    return { ok: false, reason: "Usernames cannot start or end with a hyphen." };
  }

  if (value.includes("--")) {
    return { ok: false, reason: "Usernames cannot contain two hyphens in a row." };
  }

  if (RESERVED_USERNAMES.has(value)) {
    return { ok: false, reason: "That name is reserved. Choose another." };
  }

  // A handle that is only digits reads as an id and invites confusion with one.
  if (/^\d+$/.test(value)) {
    return { ok: false, reason: "A username needs at least one letter." };
  }

  return { ok: true };
}

/** True while the handle is still changeable. */
export function usernameIsChangeable(lockedAt: Date | null, now = new Date()): boolean {
  if (!lockedAt) return true;
  return now.getTime() < lockedAt.getTime();
}

/** When a handle created now stops being changeable. */
export function usernameLockDate(createdAt: Date): Date {
  return new Date(createdAt.getTime() + USERNAME_LOCK_DAYS * 24 * 60 * 60 * 1000);
}
