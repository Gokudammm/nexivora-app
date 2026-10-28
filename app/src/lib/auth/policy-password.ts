/**
 * Password policy.
 *
 * Length first, composition rules never. NIST 800-63B is explicit that forced
 * character-class rules make passwords *worse*: people satisfy them with
 * `Password1!` and reuse it everywhere. What actually helps is a long minimum
 * and a check against passwords that are already known to attackers.
 *
 * So: ten characters, and a blocklist of the patterns that appear in every
 * breach corpus — including the ones specific to this product, because
 * `nexivora123` will otherwise be a real password on this site within a week.
 */

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

/**
 * The most-used passwords, plus terms this site invites. Not a complete
 * dictionary — a real one is megabytes, and Phase 16 can add a k-anonymity
 * check against Have I Been Pwned. This catches the careless case at zero cost.
 */
const COMMON = new Set([
  "password",
  "password1",
  "password123",
  "passw0rd",
  "p@ssword",
  "p@ssw0rd",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyuiop",
  "qwerty123",
  "1q2w3e4r",
  "iloveyou",
  "sunshine",
  "princess",
  "football",
  "baseball",
  "welcome1",
  "admin123",
  "letmein123",
  "trustno1",
  "dragon123",
  "monkey123",
  "abc123456",
  "changeme",
  "secret123",
  "master123",
  "shadow123",
  "superman",
  "batman123",
  // Terms this product invites, which is the blocklist that actually matters.
  "nexivora",
  "nexivora1",
  "nexivora123",
  "nexivora2026",
  "student123",
  "college123",
  "university",
  "project123",
  "faculty123",
  "engineering",
]);

export type PasswordCheck = { ok: true } | { ok: false; reason: string };

export function checkPassword(
  password: string,
  context: { email?: string; name?: string; username?: string } = {},
): PasswordCheck {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      reason: `Use at least ${MIN_PASSWORD_LENGTH} characters. Length matters far more than symbols — a short password with a “!” on the end is not a strong one.`,
    };
  }

  // An upper bound only because unbounded input into a deliberately slow KDF is
  // a denial-of-service lever, not because long passwords are a problem.
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, reason: `Keep it under ${MAX_PASSWORD_LENGTH} characters.` };
  }

  const normalised = password.toLowerCase().trim();

  if (COMMON.has(normalised)) {
    return { ok: false, reason: "That password appears in every breach list. Choose another." };
  }

  // Strip digits and punctuation before comparing: `nexivora2026` and
  // `password!` are the same password as far as an attacker's wordlist cares.
  const stripped = normalised.replace(/[^a-z]/g, "");
  if (stripped.length >= 6 && COMMON.has(stripped)) {
    return {
      ok: false,
      reason: "That is a common password with numbers added. Attackers try those first.",
    };
  }

  if (/^(.)\1+$/.test(normalised)) {
    return { ok: false, reason: "That is one character repeated." };
  }

  // Anything derived from the account itself is the first thing tried.
  for (const [label, value] of Object.entries(context)) {
    if (!value) continue;

    const candidate = value.toLowerCase().split("@")[0] ?? "";
    if (candidate.length >= 4 && normalised.includes(candidate)) {
      return { ok: false, reason: `Do not build your password out of your ${label}.` };
    }
  }

  return { ok: true };
}

/**
 * A rough strength hint for the register form. Advisory only — `checkPassword`
 * is what actually decides, and a meter that blocks submission on a heuristic
 * is a meter that annoys people into worse passwords.
 */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;

  let score = 0;
  if (password.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (password.length >= 16) score += 1;
  if (/\s/.test(password.trim())) score += 1; // a passphrase
  if (new Set(password).size >= 10) score += 1;

  if (COMMON.has(password.toLowerCase())) return 0;

  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}
