import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // The local PostgreSQL distribution unpacked by `npm run db:up` (ADR-021).
    // It is roughly 300 MB and ships a bundled pgAdmin, so linting it exhausts
    // Node's heap outright — `npm run lint` died with an OOM until this was
    // listed. It is generated, it is gitignored, and it is not our code.
    ".postgres/**",

    // Local upload storage and generated migration SQL.
    ".uploads/**",
    "prisma/migrations/**",

    // Screenshot output, and the throwaway Chrome profiles the visual and auth
    // checks create — the profile ships bundled extension JavaScript, which
    // ESLint will happily spend a minute reporting `this`-aliasing in.
    ".screenshots/**",
  ]),
]);

export default eslintConfig;
