import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

/**
 * PASSWORD HASHING.
 *
 * scrypt from `node:crypto`, at OWASP's recommended parameters. Three decisions
 * worth stating, because each one is a trap if reversed.
 *
 * **1. scrypt, not bcrypt.** The Phase 4 spec said bcrypt cost 12, written
 * before Phase 3 existed. Phase 3 seeded 87 accounts with scrypt, and switching
 * now would lock every one of them out. That alone is not a reason to keep a
 * weaker algorithm — but scrypt is not weaker. It is memory-hard, which bcrypt
 * is not, and OWASP lists it as an acceptable choice where Argon2id is
 * unavailable. Argon2id would need a native module; scrypt ships with Node.
 * The spec is superseded deliberately, not sidestepped (ADR-026).
 *
 * **2. Asynchronous, always.** A synchronous hash at these parameters blocks
 * the event loop for ~400ms — every other request on the server waits for one
 * login. `scryptSync` must never appear in a request path. The async form runs
 * on libuv's thread pool, so concurrency is bounded by `UV_THREADPOOL_SIZE`
 * (4 by default) rather than by memory: 4 × 128 MB, not unbounded.
 *
 * **3. The parameters live inside the hash.** `scrypt$N$r$p$salt$hash`. This is
 * what makes the cost tunable later without a migration and without stranding
 * existing users: `needsRehash()` reports when a stored hash was made with
 * weaker parameters, and the login path silently upgrades it. Phase 3's seeded
 * hashes use N=2^14 and will be upgraded on first sign-in.
 */

// promisify() picks scrypt's three-argument overload and drops the options one,
// so the signature is restated here rather than casting at each call site.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * OWASP Password Storage Cheat Sheet: scrypt with a minimum CPU/memory cost of
 * 2^17, block size 8, parallelisation 1.
 *
 * Measured on the development machine: 128 MB, ~400ms. That latency is
 * deliberate — it is the whole point of a password KDF — and it is bounded by
 * the rate limiter, which stops an attacker from using it as a DoS lever.
 */
export const SCRYPT_PARAMS = { N: 1 << 17, r: 8, p: 1 } as const;

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

/** scrypt needs explicit headroom; Node's default cap is 32 MB. */
const maxmemFor = (N: number, r: number) => 256 * N * r + 64 * 1024 * 1024;

export type PasswordParams = { N: number; r: number; p: number };

function encode(params: PasswordParams, salt: Buffer, derived: Buffer): string {
  return [
    "scrypt",
    params.N,
    params.r,
    params.p,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

type ParsedHash = { params: PasswordParams; salt: Buffer; hash: Buffer };

function decode(stored: string): ParsedHash | null {
  const parts = stored.split("$");

  // Phase 3 wrote a four-field form (`scrypt$N$salt$hash`) with r and p implied.
  // Reading it is what lets the seeded accounts sign in and be upgraded rather
  // than reset.
  if (parts.length === 4 && parts[0] === "scrypt") {
    const [, n, salt, hash] = parts;
    if (!n || !salt || !hash) return null;

    return {
      params: { N: Number(n), r: 8, p: 1 },
      salt: Buffer.from(salt, "base64url"),
      hash: Buffer.from(hash, "base64url"),
    };
  }

  if (parts.length === 6 && parts[0] === "scrypt") {
    const [, n, r, p, salt, hash] = parts;
    if (!n || !r || !p || !salt || !hash) return null;

    return {
      params: { N: Number(n), r: Number(r), p: Number(p) },
      salt: Buffer.from(salt, "base64url"),
      hash: Buffer.from(hash, "base64url"),
    };
  }

  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = (await scryptAsync(password.normalize("NFKC"), salt, KEY_LENGTH, {
    ...SCRYPT_PARAMS,
    maxmem: maxmemFor(SCRYPT_PARAMS.N, SCRYPT_PARAMS.r),
  })) as Buffer;

  return encode(SCRYPT_PARAMS, salt, derived);
}

/**
 * Verify a password against a stored hash.
 *
 * Returns false rather than throwing on a malformed hash: a corrupted row must
 * fail the login, not crash the endpoint. The comparison is constant-time,
 * because a byte-by-byte `===` on a hash leaks how much of a guess was right.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = decode(stored);
  if (!parsed) return false;

  const { params, salt, hash } = parsed;

  // Reject absurd stored parameters rather than allocating gigabytes because a
  // row was tampered with.
  if (!Number.isInteger(params.N) || params.N < 1024 || params.N > 1 << 20) return false;
  if (!Number.isInteger(params.r) || params.r < 1 || params.r > 32) return false;
  if (!Number.isInteger(params.p) || params.p < 1 || params.p > 16) return false;

  let derived: Buffer;
  try {
    derived = (await scryptAsync(password.normalize("NFKC"), salt, hash.length, {
      ...params,
      maxmem: maxmemFor(params.N, params.r),
    })) as Buffer;
  } catch {
    return false;
  }

  if (derived.length !== hash.length) return false;

  return timingSafeEqual(derived, hash);
}

/**
 * True when a stored hash was produced with weaker parameters than we now use.
 *
 * The login path calls this after a successful verification and rehashes in the
 * background. Without it, tuning the cost only ever protects new accounts, and
 * the oldest passwords — which have had the longest exposure — stay the weakest.
 */
export function needsRehash(stored: string): boolean {
  const parsed = decode(stored);
  if (!parsed) return true;

  const { params } = parsed;

  return params.N < SCRYPT_PARAMS.N || params.r < SCRYPT_PARAMS.r || params.p < SCRYPT_PARAMS.p;
}
