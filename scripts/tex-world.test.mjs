import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
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
const content = await import(contentUrl);
const atlasStub = `data:text/javascript;base64,${Buffer.from("export const findAtlasTile=()=>null;").toString("base64")}`;
const idbUrl = moduleUrl("../src/game/idb-store.ts");
const formatUrl = moduleUrl("../src/game/map-format.ts", { "./content": contentUrl, "./tile-atlas": atlasStub, "./idb-store": idbUrl });
const questCheckUrl = moduleUrl("../src/game/quest-check.ts", { "./content": contentUrl, "./map-format": formatUrl });
const gen = await import(moduleUrl("../src/game/map-gen.ts", { "./content": contentUrl, "./map-format": formatUrl, "./quest-check": questCheckUrl }));
const texUrl = moduleUrl("../src/game/tex-world.ts", { "./content": contentUrl, "./map-format": formatUrl });
const tex = await import(texUrl);
const T = content.TILE;
const OLD = "/MapAssets/0";

test("every New Texture Mode file exists on disk", () => {
  for (const p of tex.TEX_FILES) assert.ok(existsSync(new URL(`../public${p}`, import.meta.url)), `${p} is missing`);
});

test("the world is deterministic, valid, and built only from the new textures", () => {
  const a = tex.generateTexWorld({ seed: 4242 });
  const b = tex.generateTexWorld({ seed: 4242 });
  assert.deepEqual(a.tiles, b.tiles);
  assert.equal(a.w, 450);
  formatParse(a);
  const allowed = new Set(tex.TEX_FILES);
  let trees = 0;
  for (const t of a.tiles) {
    assert.ok(t.sprite && allowed.has(t.sprite), `tile art ${t.sprite} is not New Texture Mode art`);
    for (const l of t.layers ?? []) { assert.ok(allowed.has(l), `${l} is old art`); assert.ok(!l.startsWith(OLD)); if (l.includes("/tree_")) trees++; }
  }
  assert.ok(trees > 500, "the lands have forests");
  const used = new Set(a.tiles.map((t) => t.sprite));
  for (const must of [tex.TEX.water, tex.TEX.deep, tex.TEX.lava, tex.TEX.sand, tex.TEX.snow, tex.TEX.swampFloor, tex.TEX.hellFloor, tex.TEX.grass]) assert.ok(used.has(must), `${must} never appears`);
  const treeArt = new Set(a.tiles.flatMap((t) => (t.layers ?? []).filter((l) => l.includes("/tree_"))));
  assert.ok(treeArt.size >= 5, "every biome has its own tree");
});

test("the start is open and every open tile can be reached", () => {
  const m = tex.generateTexWorld({ seed: 99 });
  const open = (i) => !m.tiles[i].block;
  const s = m.spawn.ty * m.w + m.spawn.tx;
  assert.ok(open(s));
  const seen = new Uint8Array(m.tiles.length); const q = [s]; seen[s] = 1;
  for (let i = 0; i < q.length; i++) for (const j of [q[i] - 1, q[i] + 1, q[i] - m.w, q[i] + m.w]) if (j >= 0 && j < seen.length && !seen[j] && open(j)) { seen[j] = 1; q.push(j); }
  for (let i = 0; i < seen.length; i++) if (open(i)) assert.ok(seen[i], `open tile ${i} is cut off`);
  assert.ok(m.zones.length > 80 && m.interactables.some((n) => n.node === "ore") && m.interactables.some((n) => n.node === "fish") && m.interactables.some((n) => n.node === "shroom"));
});

test("dungeons are re-skinned with the new textures and keep their layout", () => {
  const allowed = new Set(tex.TEX_FILES);
  for (const [kind, layout] of [["rift", "halls"], ["rift", "islands"], ["rift", "mansion"], ["rift", "portals"], ["crypt"], ["kiln"]]) {
    const world = gen.generateDungeon({ kind, layout, seed: gen.dungeonSeed(7, 2, 1), level: 8, day: 2 });
    const shape = JSON.stringify(world.tiles.map((t) => [t.floor, t.block, !!t.portal]));
    tex.retextureDungeon(world);
    assert.equal(JSON.stringify(world.tiles.map((t) => [t.floor, t.block, !!t.portal])), shape);
    for (const t of world.tiles) {
      assert.ok(t.sprite && allowed.has(t.sprite), `${kind}/${layout}: ${t.sprite}`);
      for (const l of t.layers ?? []) assert.ok(allowed.has(l), `${kind}/${layout}: layer ${l}`);
    }
  }
});

function formatParse(file) {
  assert.ok(file.tiles.length === file.w * file.h && file.spawn.tx < file.w);
  assert.equal(file.tileSize, T);
}
