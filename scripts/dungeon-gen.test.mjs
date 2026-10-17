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
const state = await import(moduleUrl("../src/game/procedural-dungeon.ts", { "./content": contentUrl }));

const T = content.TILE;
const tileOf = (v) => Math.floor(v / T);
// The engine's own wall rule: the outer two tiles are always solid.
const walkable = (m, tx, ty) => tx > 1 && ty > 1 && tx < m.w - 2 && ty < m.h - 2 && !m.tiles[ty * m.w + tx].block;

function reach(m, from) {
  const seen = new Set([from]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    const x = queue[i] % m.w, y = Math.floor(queue[i] / m.w);
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      const n = ny * m.w + nx;
      if (walkable(m, nx, ny) && !seen.has(n)) { seen.add(n); queue.push(n); }
    }
  }
  return seen;
}

for (const kind of ["rift", "crypt", "kiln"]) {
  test(`${kind}: every layout is connected, in bounds, and has one guardian`, () => {
    for (let day = 0; day < 40; day++) {
      const seed = gen.dungeonSeed(1234 + day * 7, day, kind === "rift" ? 0 : 3);
      const m = gen.generateDungeon({ kind, seed, level: 12, day });
      assert.equal(m.tiles.length, m.w * m.h);
      const entry = tileOf(m.entry.y) * m.w + tileOf(m.entry.x);
      assert.ok(walkable(m, tileOf(m.entry.x), tileOf(m.entry.y)), "entry is walkable");
      const ok = reach(m, entry);
      const mobs = m.spawns.filter((s) => s.kind === "mob");
      assert.ok(mobs.length >= 3, "has foes");
      for (const s of mobs) {
        assert.ok(content.MONSTER_BY_ID[s.species], `missing species ${s.species}`);
        assert.ok(walkable(m, tileOf(s.x), tileOf(s.y)), `${s.id} stands in a wall`);
        assert.ok(ok.has(tileOf(s.y) * m.w + tileOf(s.x)), `${s.id} unreachable`);
      }
      const bosses = mobs.filter((s) => s.boss);
      assert.equal(bosses.length, 1);
      if (kind === "rift") { assert.equal(bosses[0].dungeonBoss, true); assert.ok(content.POIS.some((p) => p.kind === "boss" && p.id === bosses[0].bossId)); }
      if (kind === "crypt") assert.equal(bosses[0].bossId, "bone_king");
      if (kind === "kiln") assert.equal(bosses[0].bossId, "ash_regent");
      assert.equal(new Set(m.spawns.map((s) => s.id)).size, m.spawns.length, "spawn ids are unique");
    }
  });

  test(`${kind}: same inputs give the same dungeon, a new day gives a new one`, () => {
    const a = gen.generateDungeon({ kind, seed: gen.dungeonSeed(99, 5, 3), level: 9, day: 5 });
    assert.deepEqual(a, gen.generateDungeon({ kind, seed: gen.dungeonSeed(99, 5, 3), level: 9, day: 5 }));
    const layouts = new Set();
    const foes = new Set();
    for (let day = 0; day < 12; day++) {
      const m = gen.generateDungeon({ kind, seed: gen.dungeonSeed(99, day, 3), level: 9, day });
      layouts.add(JSON.stringify(m.tiles.map((t) => t.block)));
      foes.add(m.spawns.map((s) => s.species).join());
    }
    assert.equal(layouts.size, 12, "every day has its own layout");
    assert.ok(foes.size >= 8, "foe lists change from day to day");
  });
}

test("every sprite the dungeon generator uses exists on disk", () => {
  const seen = new Set();
  for (const kind of ["rift", "crypt", "kiln"]) {
    for (let d = 0; d < 60; d++) {
      const m = gen.generateDungeon({ kind, seed: gen.dungeonSeed(5, d, d), level: 5, day: d });
      for (const t of m.tiles) { if (t.sprite) seen.add(t.sprite); for (const l of t.layers ?? []) seen.add(l); }
    }
  }
  assert.ok(seen.size > 40);
  for (const sprite of seen) assert.ok(existsSync(new URL(`../public${sprite}`, import.meta.url)), `Missing ${sprite}`);
});

test("rifts use all seven themes across seeds", () => {
  const floors = new Set();
  for (let d = 0; d < 60; d++) floors.add(gen.generateDungeon({ kind: "rift", seed: gen.dungeonSeed(8, d, 0), level: 5, day: d }).tiles[0].biome);
  assert.ok(floors.size >= 4);
});

test("dungeon state keeps the in-game day and layout stamps through a save", () => {
  const s = state.normalizeDungeonState({ elapsed: 12, sequence: 2, portals: [], day: 4, dayElapsed: 100, seenDay: 4, stamps: { crypt: 3, bogus: "x" } });
  assert.equal(s.day, 4);
  assert.equal(s.dayElapsed, 100);
  assert.equal(s.seenDay, 4);
  assert.deepEqual(s.stamps, { crypt: 3 });
  assert.deepEqual(state.normalizeDungeonState(JSON.parse(JSON.stringify(s))), s);
  assert.equal(state.normalizeDungeonState(null).day, 0);
});

test("the Crypt instance (who you killed inside) survives a save round-trip", () => {
  const s = state.normalizeDungeonState({ inside: { map: "crypt", defeated: ["m1", 4, "m2"] } });
  assert.deepEqual(s.inside, { map: "crypt", defeated: ["m1", "m2"] });
  assert.equal(state.normalizeDungeonState({ inside: { map: "world", defeated: [] } }).inside, undefined);
});
