import { z } from "zod";

/**
 * Validated environment access.
 *
 * Every variable is parsed at module load. A missing or malformed value fails
 * the boot with a message naming it, rather than producing a mystery runtime
 * error three screens into the app.
 *
 * Client-visible variables (NEXT_PUBLIC_*) are validated separately, because
 * `process.env` is not fully populated in the browser — only the inlined
 * NEXT_PUBLIC_ values are, so they must be referenced literally.
 */

const serverSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    /**
     * Postgres. Required as of Phase 3 — the schema, the seed and every query
     * depend on it, so a missing value should fail the boot rather than surface
     * as a null client three screens in. `npm run db:up` provisions it locally
     * with nothing to install (ADR-021).
     */
    DATABASE_URL: z
      .string()
      .url("DATABASE_URL must be a valid postgresql:// connection string — run: npm run db:up")
      .startsWith(
        "postgresql://",
        "DATABASE_URL must be a postgresql:// URL (not SQLite — see ADR-003)",
      ),
    DIRECT_DATABASE_URL: z
      .string()
      .url("DIRECT_DATABASE_URL must be a valid postgresql:// connection string")
      .startsWith("postgresql://", "DIRECT_DATABASE_URL must be a postgresql:// URL")
      .optional(),

    /** Auth.js. Required from Phase 4 onward. */
    AUTH_SECRET: z
      .string()
      .min(
        32,
        "AUTH_SECRET must be at least 32 characters — generate with: openssl rand -base64 32",
      )
      .optional(),
    AUTH_URL: z.string().url().optional(),

    /** Email. `console` prints the message to the terminal — the dev default. */
    EMAIL_TRANSPORT: z.enum(["console", "smtp"]).default("console"),
    EMAIL_FROM: z.string().email().default("no-reply@nexivora.com"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),

    /** File storage. Phase 7. */
    STORAGE_DRIVER: z.enum(["local", "blob"]).default("local"),
    UPLOAD_DIR: z.string().default("./.uploads"),
    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(26_214_400), // 25 MB

    /** Abuse controls. Off in dev so local iteration is not throttled. */
    RATE_LIMIT_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),

    /**
     * AI. Phase 18, and off until then.
     * With AI_ENABLED=false the product must be fully functional — see ADR-012.
     */
    AI_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    ANTHROPIC_API_KEY: z.string().optional(),
    AI_MODEL: z.string().default("claude-sonnet-5"),
    AI_MONTHLY_BUDGET_USD: z.coerce.number().nonnegative().default(0),
  })
  .superRefine((value, context) => {
    if (value.EMAIL_TRANSPORT !== "smtp") return;

    for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"] as const) {
      if (!value[key]) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: `${key} is required when EMAIL_TRANSPORT=smtp`,
        });
      }
    }
  });

const clientSchema = z.object({
  /**
   * Load-bearing: canonicals, sitemap entries, OG image URLs and auth callbacks
   * all derive from this. Wrong in production means every canonical points at
   * localhost — the most damaging single SEO mistake available.
   */
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
});

/**
 * Treat an empty variable as unset.
 *
 * `.env` files cannot express "absent" — `AUTH_SECRET=` loads as `""`, not as
 * undefined. Without this, copying `.env.example` and filling in only the
 * variables the current phase needs fails the boot on a later phase's blank
 * line, with an error about a variable the developer was right to leave empty.
 * Zod's `.optional()` accepts undefined, not `""`, so the normalisation has to
 * happen before parsing.
 */
function withoutBlanks(input: NodeJS.ProcessEnv | Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== "" && value !== undefined),
  );
}

function parseOrDie<T extends z.ZodType>(schema: T, input: unknown, label: string): z.infer<T> {
  const result = schema.safeParse(
    typeof input === "object" && input !== null
      ? withoutBlanks(input as Record<string, unknown>)
      : input,
  );

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `\n[nexivora] Invalid ${label} environment.\n${issues}\n\n` +
        `Copy .env.example to .env and fill in the values.\n`,
    );
  }

  return result.data;
}

export const env = parseOrDie(serverSchema, process.env, "server");

export const clientEnv = parseOrDie(
  clientSchema,
  { NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL },
  "client",
);

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";

/**
 * Variables that are optional today but become required in a later phase.
 * Call this from the code that needs them, so the failure names the phase.
 */
export function requireEnv<K extends keyof typeof env>(
  key: K,
  phase: string,
): NonNullable<(typeof env)[K]> {
  const value = env[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(`[nexivora] ${String(key)} is required for ${phase}. Set it in .env.`);
  }
  return value as NonNullable<(typeof env)[K]>;
}
