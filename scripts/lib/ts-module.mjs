/**
 * Load a TypeScript module in a plain Node test, with no build step.
 *
 * Every test here used to carry its own copy of this: transpile the file, turn it into a `data:`
 * URL, import that. The copies all had the same hole — a `data:` URL has no directory, so the
 * moment the transpiled source contained `from "./something"` Node could not resolve it. The tests
 * worked around that with a hand-written map of specifier to URL, which meant that adding one
 * ordinary import to a source file broke a test file that had never heard of it.
 *
 * That is exactly what happened: `building.ts` grew an import of `./tile-atlas`, and both
 * `survival-night.test.mjs` and `game-content.test.mjs` started failing at file level — the error
 * surfaced asynchronously, after their own assertions had already passed, so the suite reported a
 * file that failed while every test inside it was green.
 *
 * This resolves relative imports itself, recursively, so there is nothing to keep in step.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const cache = new Map();

/** Where a relative specifier actually points, allowing for an omitted or `.js` extension. */
function resolveDep(fromFile, spec) {
  const base = resolve(dirname(fromFile), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, base.replace(/\.js$/, ".ts"), `${base}/index.ts`]) {
    if (candidate.endsWith(".ts") || candidate.endsWith(".tsx")) {
      if (existsSync(candidate)) return candidate;
    }
  }
  // A .json import is data, not code; it is inlined below rather than resolved as a module.
  if (existsSync(`${base}.json`)) return `${base}.json`;
  return null;
}

/**
 * Transpile `file` and return a `data:` URL for it, rewriting every relative import to the URL of
 * its own transpiled dependency. A cycle resolves to the partially-built module, exactly as a real
 * ES module cycle would.
 */
export function tsModule(file, overrides = null) {
  const abs = resolve(file);
  // An overridden load is a one-off (a deliberate stub in one test), so it is never cached and
  // never shared with the plain load of the same file.
  if (!overrides && cache.has(abs)) return cache.get(abs);
  if (!overrides) cache.set(abs, null);       // cycle guard

  if (abs.endsWith(".json")) {
    const url = `data:text/javascript;base64,${Buffer.from(`export default ${readFileSync(abs, "utf8")};`).toString("base64")}`;
    cache.set(abs, url);
    return url;
  }

  let out = ts.transpileModule(readFileSync(abs, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  // Covers `from "./x"`, `import "./x"` and `import("./x")`.
  // An explicit override wins: that is how a test swaps one dependency for a stub.
  out = out.replace(/(from\s*|import\s*\(?\s*)"(\.[^"]*)"/g, (whole, lead, spec) => {
    const forced = overrides?.[spec];
    if (forced) return `${lead}"${forced}"`;
    const dep = resolveDep(abs, spec);
    if (!dep) return whole;
    const url = tsModule(dep);
    return url ? `${lead}"${url}"` : whole;
  });

  const url = `data:text/javascript;base64,${Buffer.from(out).toString("base64")}`;
  if (!overrides) cache.set(abs, url);
  return url;
}

/** `tsModule`, resolved against the calling test file. */
export function moduleUrlFrom(importMetaUrl, relative, overrides = null) {
  return tsModule(resolve(dirname(fileURLToPath(importMetaUrl)), relative), overrides);
}

/** Import a TypeScript module by path, relative to the calling test file. */
export function loadTs(importMetaUrl, relative) {
  return import(moduleUrlFrom(importMetaUrl, relative));
}
