// Node module hooks: lets the wiki builder import the game's TypeScript files directly.
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

export async function resolve(specifier, context, next) {
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.endsWith(".ts") && !/\.[a-z]+$/i.test(specifier)) {
    const url = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  // The game imports JSON the way Vite allows (`import data from "./x.json"`, no `with { type: "json" }`).
  // Node refuses that (ERR_IMPORT_ATTRIBUTE_MISSING), so hand JSON over as a plain module with a default export.
  if (url.startsWith("file:") && url.endsWith(".json")) {
    const source = await readFile(new URL(url), "utf8");
    return { format: "module", source: `export default ${JSON.stringify(JSON.parse(source))};`, shortCircuit: true };
  }
  if (url.endsWith(".ts")) {
    const source = await readFile(new URL(url), "utf8");
    const out = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: fileURLToPath(url) });
    return { format: "module", source: out.outputText, shortCircuit: true };
  }
  return next(url, context);
}
export { pathToFileURL };
