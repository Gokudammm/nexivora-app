import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * A module resolve hook for `node --test`.
 *
 * Node 24 runs TypeScript directly, which removes the need for a build step or
 * a test-runner dependency — but it resolves specifiers the way Node does, and
 * this codebase writes them the way a bundler does. Two gaps:
 *
 *   · `@/lib/...` — the tsconfig path alias, which Node knows nothing about
 *   · `./similarity` — extensionless, which ESM does not permit
 *
 * Bridging them here keeps the source honest: no test-only import style leaking
 * into application files, and no dependency added to run a unit test.
 */

const SRC = path.resolve(import.meta.dirname, "..", "src");
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs"];

function resolveFile(base) {
  if (path.extname(base) && existsSync(base)) return base;

  for (const extension of EXTENSIONS) {
    const candidate = base + extension;
    if (existsSync(candidate)) return candidate;
  }

  for (const extension of EXTENSIONS) {
    const candidate = path.join(base, `index${extension}`);
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  let target = null;

  if (specifier.startsWith("@/")) {
    target = path.join(SRC, specifier.slice(2));
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const parent = context.parentURL;
    if (parent?.startsWith("file:")) {
      target = path.resolve(path.dirname(fileURLToPath(parent)), specifier);
    }
  }

  const resolved = target ? resolveFile(target) : null;
  if (resolved) {
    return { url: pathToFileURL(resolved).href, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}
