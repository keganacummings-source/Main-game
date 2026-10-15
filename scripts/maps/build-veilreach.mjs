#!/usr/bin/env node
/**
 * Regenerates src/game/maps/veilreach.json (embedded as the base world) from src/game/map-gen.ts (the Veilreach preset).
 *   node --import ./scripts/wiki/register.mjs scripts/maps/build-veilreach.mjs
 * Only run this to start over: hand edits made in the Map Builder live in the exported file.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const gen = await import(pathToFileURL(join(ROOT, "src/game/map-gen.ts")).href);
const fmt = await import(pathToFileURL(join(ROOT, "src/game/map-format.ts")).href);
const t0 = Date.now();
const map = gen.buildVeilreach();
const clean = fmt.parseMapJson(map);
const packed = fmt.packMap(clean);
mkdirSync(join(ROOT, "src/game/maps"), { recursive: true });
const out = join(ROOT, "src/game/maps/veilreach.json");
writeFileSync(out, JSON.stringify(packed));
const n = (k) => (clean[k] ?? []).length;
console.log(`Veilreach ${clean.w}×${clean.h}: ${n("regions")} regions, ${n("npcs")} NPCs, ${n("quests")} quests, ${n("zones")} camps, ${n("interactables")} places, ${n("spawns")} spawns · ${(JSON.stringify(packed).length / 1e6).toFixed(2)} MB · ${Date.now() - t0} ms`);
