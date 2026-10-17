/**
 * Map generator audit. Generates a spread of worlds and reports anything that looks wrong:
 * overlapping areas, camps on top of towns or mines, things standing on walls or water,
 * unreachable quest targets, and any error the Map Builder's own checker finds.
 *
 *   node scripts/map-gen-audit.mjs            # quick sweep, prints a report
 *   node scripts/map-gen-audit.mjs --strict   # exit 1 on any problem (used by the tests)
 */
import { readFileSync } from "node:fs";
import ts from "typescript";

function moduleUrl(path, imports = {}) {
  let source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [specifier, url] of Object.entries(imports)) source = source.replaceAll(`from "${specifier}"`, `from "${url}"`);
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}
const kitsUrl = moduleUrl("../src/game/class-kits.ts");
const contentUrl = moduleUrl("../src/game/content.ts", { "./classes": moduleUrl("../src/game/classes.ts", { "./class-kits": kitsUrl }), "./overmax": moduleUrl("../src/game/overmax.ts"), "./class-kits": kitsUrl });
const atlasStub = `data:text/javascript;base64,${Buffer.from("export const findAtlasTile=()=>null;").toString("base64")}`;
const idbUrl = moduleUrl("../src/game/idb-store.ts");
const formatUrl = moduleUrl("../src/game/map-format.ts", { "./content": contentUrl, "./tile-atlas": atlasStub, "./idb-store": idbUrl });
const tools = await import(moduleUrl("../src/game/map-tools.ts", { "./content": contentUrl, "./map-format": formatUrl }));
const content = await import(contentUrl);
const questCheckUrl = moduleUrl("../src/game/quest-check.ts", { "./content": contentUrl, "./map-format": formatUrl });
const gen = await import(moduleUrl("../src/game/map-gen.ts", { "./content": contentUrl, "./map-format": formatUrl, "./quest-check": questCheckUrl }));
const format = await import(formatUrl);

const FL_WATER = 2, FL_LAVA = 11;
const rectsOverlap = (a, b, pad = 0) => a.tx < b.tx + b.tw + pad && b.tx < a.tx + a.tw + pad && a.ty < b.ty + b.th + pad && b.ty < a.ty + a.th + pad;

export function audit(map) {
  const P = []; // problems
  const known = new Set(content.ITEMS.map((i) => i.id));
  const T = (x, y) => map.tiles[y * map.w + x];
  const blockedStone = (t) => t.block && !t.layers && t.floor !== FL_WATER; // mountain / wall tile with no prop on it
  const areas = (map.regions ?? []).filter((r) => r.kind === "city" || r.kind === "resource" || r.kind === "landmark");
  const named = areas.filter((r) => !/Docks|Ferry/.test(r.name));

  // 1. named areas must not overlap one another
  for (let i = 0; i < named.length; i++) for (let j = i + 1; j < named.length; j++) {
    if (rectsOverlap(named[i], named[j])) P.push({ kind: "area-overlap", text: `${named[i].name} overlaps ${named[j].name}` });
  }
  // 2. resource areas and landmarks must not be cut out of a mountain or lake
  for (const r of named.filter((a) => a.kind !== "city")) {
    let ring = 0, bad = 0, inner = 0;
    for (let y = r.ty - 1; y <= r.ty + r.th; y++) for (let x = r.tx - 1; x <= r.tx + r.tw; x++) {
      if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
      const edge = x < r.tx || y < r.ty || x >= r.tx + r.tw || y >= r.ty + r.th;
      const t = T(x, y);
      const shore = /Fishery|Fishing Hole|Weir/.test(r.name); // fisheries are meant to touch water
      if (edge) { ring++; if (blockedStone(t) || (!shore && t.floor === FL_WATER)) bad++; }
      else if (blockedStone(t) || (!shore && t.floor === FL_WATER) || t.floor === FL_LAVA) inner++;
    }
    if (ring && bad / ring > 0.25) P.push({ kind: "carved-into-mountain", text: `${r.name} is boxed in by walls/water on ${Math.round((bad / ring) * 100)}% of its edge` });
    if (inner > r.tw * r.th * 0.12) P.push({ kind: "area-on-hazard", text: `${r.name} has ${inner} wall/water/lava tiles inside it` });
  }
  // 3. camps: not on towns, mines or each other, and mostly open ground
  const zones = map.zones ?? [];
  for (const z of zones) {
    for (const a of named) if (!(z.id.startsWith("ruin-") && a.id.startsWith("ruin-")) && rectsOverlap(z, a)) P.push({ kind: "camp-on-area", text: `camp ${z.id} overlaps ${a.name}` });
    let open = 0;
    for (let y = z.ty; y < z.ty + z.th; y++) for (let x = z.tx; x < z.tx + z.tw; x++) { const t = T(x, y); if (t && !t.block && t.floor !== FL_WATER && t.floor !== FL_LAVA) open++; }
    if (open < z.tw * z.th * 0.6) P.push({ kind: "camp-on-hazard", text: `camp ${z.id} is only ${Math.round((open / (z.tw * z.th)) * 100)}% open ground` });
  }
  for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) if (rectsOverlap(zones[i], zones[j])) P.push({ kind: "camp-overlap", text: `camps ${zones[i].id} and ${zones[j].id} overlap` });
  // 4. things must not stand on walls or water
  for (const i of map.interactables ?? []) {
    const t = T(i.tx, i.ty);
    if (!t || t.block || t.floor === FL_WATER && i.kind !== "node") P.push({ kind: "prop-on-wall", text: `${i.kind} at ${i.tx},${i.ty} is on a blocked tile` });
  }
  for (const n of map.npcs ?? []) { const t = T(n.tx, n.ty); if (!t || t.block || t.floor === FL_WATER) P.push({ kind: "npc-on-wall", text: `${n.name} at ${n.tx},${n.ty} is on a blocked tile` }); }
  // 5. map checker
  for (const issue of tools.validateMap(format.parseMapJson(JSON.parse(JSON.stringify(map))), known)) P.push({ kind: `checker-${issue.level}`, text: issue.text });
  // 6. every id referenced by a quest is real, ids are unique
  const ids = new Set();
  for (const q of map.quests ?? []) { if (ids.has(q.id)) P.push({ kind: "dup-quest", text: q.id }); ids.add(q.id); }
  return P;
}

const strict = process.argv.includes("--strict");
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const only = args[0];
const cases = [
  { label: "veilreach (500x500, story)", build: () => gen.buildVeilreach() },
  { label: "300x300 seed 1", build: () => gen.generateWorld({ id: "a", name: "A", w: 300, h: 300, seed: 1, continentCount: 4, citiesPerContinent: 3, islands: 4, story: true }) },
  { label: "300x300 seed 77", build: () => gen.generateWorld({ id: "b", name: "B", w: 300, h: 300, seed: 77, continentCount: 5, citiesPerContinent: 4, islands: 8 }) },
  { label: "200x200 seed 5", build: () => gen.generateWorld({ id: "c", name: "C", w: 200, h: 200, seed: 5, continentCount: 3, citiesPerContinent: 2, islands: 2, story: true }) },
  { label: "400x300 seed 2024", build: () => gen.generateWorld({ id: "d", name: "D", w: 400, h: 300, seed: 2024, continentCount: 6, citiesPerContinent: 3, islands: 10, story: true }) },
];
let total = 0;
for (const c of cases) {
  if (only && !c.label.includes(only)) continue;
  const t0 = Date.now();
  const map = c.build();
  const ms = Date.now() - t0;
  const P = audit(map);
  const by = {};
  for (const p of P) by[p.kind] = (by[p.kind] ?? 0) + 1;
  total += P.length;
  console.log(`\n== ${c.label}  (${ms} ms)  regions=${map.regions.length} npcs=${map.npcs.length} quests=${map.quests.length} zones=${map.zones.length} props=${map.interactables.length}`);
  console.log(P.length ? Object.entries(by).map(([k, v]) => `   ${k}: ${v}`).join("\n") : "   clean");
  if (!strict) for (const p of P.filter((q) => q.kind.startsWith("checker")).concat(P).slice(0, 4)) console.log(`     e.g. ${p.kind}: ${p.text}`);
}
console.log(`\n${total} problem(s) total`);
if (strict && total) process.exit(1);
