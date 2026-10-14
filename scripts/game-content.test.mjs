import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Exercise the same TypeScript data and world generator used by both builds.
function moduleUrl(path, imports = {}) {
  let source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [specifier, url] of Object.entries(imports)) {
    source = source.replaceAll(`from "${specifier}"`, `from "${url}"`);
  }
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}
const classesUrl = moduleUrl("../src/game/classes.ts");
const contentUrl = moduleUrl("../src/game/content.ts", { "./classes": classesUrl });
const content = await import(contentUrl);
const world = await import(
  moduleUrl("../src/game/world.ts", {
    "./content": contentUrl,
    "./tile-atlas": moduleUrl("../src/game/tile-atlas.ts"),
  })
);
const sheets = await import(moduleUrl("../src/game/actor-sheets.config.ts"));

test("every sheet class is playable with a full moveset, traits and distinct sprites", () => {
  assert.ok(content.CLASSES.length >= 29);
  assert.equal(new Set(content.CLASSES.map((c) => c.id)).size, content.CLASSES.length);
  const sprites = [];
  for (const c of content.CLASSES) {
    assert.ok(content.RACES.some((r) => r.id === content.CLASS_RACE[c.id]));
    assert.ok(c.starterMoves.length >= 5, `${c.id}: needs a full moveset`);
    assert.ok(c.starterMoves.includes(c.signature));
    for (const id of c.starterMoves) assert.ok(content.MOVE_BY_ID[id], `${c.id}: missing ${id}`);
    assert.ok(c.starterMoves.some((id) => ["blink", "lunge", "roll", "dash", "surge"].includes(content.moveTactic(content.MOVE_BY_ID[id]))), `${c.id}: needs a movement verse`);
    for (const id of [c.sprite.m, c.sprite.f]) assert.ok(sheets.CHARACTERS[id], `${c.id}: missing sprite ${id}`);
    sprites.push(c.sprite.f);
  }
  assert.equal(new Set(sprites).size, content.CLASSES.length);
});

test("legacy races map to valid classes and required gameplay data is populated", () => {
  for (const r of content.RACES) assert.ok(content.CLASS_BY_ID[content.LEGACY_CLASS[r.id]]);
  for (const id of ["adventuring", "physical", "magic", "catching", "hunting", "trading"]) {
    assert.ok(
      content.SKILLS.some((s) => s.id === id),
      `missing ${id} skill`,
    );
  }
  assert.ok(content.QUESTS.length);
  assert.ok(content.POIS.some((p) => p.kind === "dungeon"));
  for (const npc of content.NPCS) {
    assert.ok(Number.isFinite(npc.tx) && Number.isFinite(npc.ty));
    assert.ok(sheets.CHARACTERS[sheets.NPC_CHAR_BY_ID[npc.id]], `${npc.id}: missing NPC sprite`);
  }
  assert.ok(content.ITEM_BY_ID.potion);
  assert.ok(content.ENCHANTS.length);
});

test("overworld and both dungeons generate usable terrain and enemies", () => {
  for (const seed of [0, 42]) {
    for (const map of [
      world.buildWorld(seed),
      world.buildDungeon("crypt", seed),
      world.buildDungeon("kiln", seed),
    ]) {
      assert.equal(map.tiles.length, map.w * map.h);
      assert.ok(map.tiles.some((t) => !t.block));
      assert.ok(map.spawns.length);
      for (const s of map.spawns.filter((s) => s.kind === "mob")) {
        assert.ok(
          (s.animal ? content.ANIMAL_BY_ID : content.MONSTER_BY_ID)[s.species],
          `missing ${s.species}`,
        );
        assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y));
      }
    }
  }
});

test("Antifarea front and side rows match the source sheet directions", () => {
  assert.deepEqual(sheets.ACTOR_DIRECTION_ROWS, { up: 0, right: 1, down: 2, left: 3 });
});

test("movement faces the dominant travel direction and preserves idle facing", () => {
  for (const [dx, dy, expected] of [
    [-3, 1, "left"],
    [3, -1, "right"],
    [1, -3, "up"],
    [-1, 3, "down"],
  ]) {
    assert.equal(sheets.directionFromDelta(dx, dy), expected);
  }
  for (const direction of ["up", "right", "down", "left"]) {
    assert.equal(sheets.directionFromDelta(0, 0, direction), direction);
    assert.equal(sheets.directionFromDelta(0.00001, 0, direction), direction);
  }
});

const abilities = await import(
  moduleUrl("../src/game/ability-progression.ts", { "./content": contentUrl })
);
const dungeons = await import(
  moduleUrl("../src/game/procedural-dungeon.ts", { "./content": contentUrl })
);
const weapons = await import(
  moduleUrl("../src/game/weapon-design.ts", { "./content": contentUrl })
);
const creatures = await import(
  moduleUrl("../src/game/creature-sprites.ts", { "./content": contentUrl })
);
const tilesStub = `data:text/javascript;base64,${Buffer.from("export const findAtlasTile=()=>null;").toString("base64")}`;
const maps = await import(
  moduleUrl("../src/game/map-format.ts", { "./content": contentUrl, "./tile-atlas": tilesStub })
);

test("skill migration grants historical level points once and preserves purchases", () => {
  const save = { level: 4, classId: "warden", known: ["ember", "bad-id"] };
  abilities.normalizeAbilities(save);
  assert.equal(save.skillPoints, 9);
  assert.equal(save.abilityRanks.ember, 1);
  assert.ok(!save.abilityRanks["bad-id"]);
  assert.equal(abilities.spendAbilityPoint(save, "shard"), true);
  assert.equal(save.abilityRanks.shard, 1);
  assert.equal(save.skillPoints, 8);
  abilities.normalizeAbilities(save);
  assert.equal(save.skillPoints, 8);
  for (let i = 0; i < 4; i++) assert.equal(abilities.spendAbilityPoint(save, "shard"), true);
  assert.equal(abilities.abilityMultiplier(save, "shard"), 1.6);
  assert.equal(abilities.spendAbilityPoint(save, "shard"), false);
  assert.equal(abilities.spendAbilityPoint(save, "bogus"), false);
  save.skillPoints = 0;
  assert.equal(abilities.spendAbilityPoint(save, "lantern"), false);
});

test("fixed equipment stats do not grant attacks or random enchantments", () => {
  for (const slot of ["weapon", "head", "chest", "legs", "feet", "relic"]) {
    const g = content.rollGear(content.mulberry32(42), { level: 12, slot });
    assert.deepEqual(g.enchants, []);
    assert.deepEqual(g.moves, []);
    const stats = content.equipmentStats(g);
    assert.ok(stats.damage + stats.armor > 0);
    assert.deepEqual(content.equipmentStats({ ...g, fxSeed: 99 }), stats);
  }
});

test("dungeon clock reaches ten minutes and round trips partial elapsed time", () => {
  const s = dungeons.normalizeDungeonState(null);
  assert.equal(dungeons.advanceDungeonClock(s, 599), false);
  const restored = dungeons.normalizeDungeonState(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.elapsed, 599);
  assert.equal(dungeons.advanceDungeonClock(restored, 1), true);
  assert.equal(restored.sequence, 1);
  assert.equal(restored.elapsed, 0);
  assert.equal(dungeons.advanceDungeonClock(restored, NaN), false);
});

test("seeded dungeons vary, have connected spawns, and end with one weakened world boss", () => {
  const hashes = new Set();
  for (let seed = 1; seed <= 24; seed++) {
    const map = dungeons.buildProceduralDungeon(seed, 10);
    assert.deepEqual(map, dungeons.buildProceduralDungeon(seed, 10));
    for (const t of map.tiles)
      assert.ok(
        readFileSync(new URL(`../public${t.sprite}`, import.meta.url)).length,
        `Missing tile ${t.sprite}`,
      );
    hashes.add(JSON.stringify(map.tiles));
    const bosses = map.spawns.filter((s) => s.boss);
    assert.equal(bosses.length, 1);
    assert.equal(bosses[0].dungeonBoss, true);
    assert.ok(content.POIS.some((p) => p.kind === "boss" && p.id === bosses[0].bossId));
    const start =
      Math.floor(map.entry.y / content.TILE) * map.w + Math.floor(map.entry.x / content.TILE);
    const reached = new Set([start]),
      queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const idx = queue[i],
        x = idx % map.w,
        y = Math.floor(idx / map.w);
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        const n = ny * map.w + nx;
        if (
          nx >= 0 &&
          ny >= 0 &&
          nx < map.w &&
          ny < map.h &&
          !map.tiles[n].block &&
          !reached.has(n)
        ) {
          reached.add(n);
          queue.push(n);
        }
      }
    }
    for (const s of map.spawns)
      assert.ok(
        reached.has(Math.floor(s.y / content.TILE) * map.w + Math.floor(s.x / content.TILE)),
        `Unreachable ${s.id}`,
      );
  }
  assert.equal(hashes.size, 24);
});

test("map import round trip preserves art, collision and entities; invalid maps are rejected", () => {
  const map = maps.emptyMap("example", "Example", 16, 12, 8);
  map.kind = "bossroom";
  map.tiles[2 * 16 + 2].sprite = "/MapAssets/01_Floors/stone.png";
  map.spawns = [
    {
      id: "boss",
      kind: "mob",
      species: "gaikotsu",
      boss: true,
      x: 3.5 * content.TILE,
      y: 3.5 * content.TILE,
      level: 10,
    },
  ];
  const round = maps.parseMapJson(JSON.parse(JSON.stringify(map)));
  assert.deepEqual(round.tiles, map.tiles);
  assert.deepEqual(round.spawns, map.spawns);
  assert.equal(round.kind, "bossroom");
  for (const change of [
    { w: Infinity },
    { w: 16.5 },
    { w: 513 },
    { tileSize: 64 },
    { version: 999 },
    { spawn: { tx: 0, ty: 0 } },
    { tiles: [null] },
  ])
    assert.throws(() => maps.parseMapJson({ ...map, ...change }));
  const bad = structuredClone(map);
  bad.tiles[0].sprite = "https://example.com/evil.png";
  assert.throws(() => maps.parseMapJson(bad));
  bad.tiles[0].sprite = "/MapAssets/../evil.png";
  assert.throws(() => maps.parseMapJson(bad));
  assert.throws(() => maps.parseMapJson({ ...map, spawns: [...map.spawns, ...map.spawns] }));
});

test("weapon design round trip validates pixels and stat bounds", () => {
  const w = weapons.newWeaponDesign();
  assert.deepEqual(weapons.parseWeaponDesign(JSON.parse(JSON.stringify(w))), w);
  for (const change of [
    { damage: NaN },
    { range: -1 },
    { speed: 0 },
    { pixels: ["red"] },
    { type: "bogus" },
  ])
    assert.throws(() => weapons.parseWeaponDesign({ ...w, ...change }));
});

test("every enemy and animal has a supplied pixel sprite", () => {
  for (const m of [...content.MONSTERS, ...content.ANIMALS])
    assert.ok(creatures.CREATURE_CELLS[m.id], `Missing sprite for ${m.id}`);
});

test("equipment migration retains legacy rolls for recovery without reactivating them", () => {
  const g = content.rollGear(content.mulberry32(1), { level: 5, slot: "weapon" });
  g.enchants = [{ id: "might", power: 8 }];
  g.moves = ["ember"];
  content.migrateEquipment(g);
  assert.deepEqual(g.previousEquipment, {
    enchants: [{ id: "might", power: 8 }],
    moves: ["ember"],
  });
  assert.deepEqual(g.enchants, []);
  assert.deepEqual(g.moves, []);
  content.migrateEquipment(g);
  assert.deepEqual(g.previousEquipment.moves, ["ember"]);
});

const survival = await import(moduleUrl('../src/game/survival.ts'));
test('survival drains only active time, is frame independent, and sleep never restores food or water', () => {
  const a = survival.normalizeSurvival(), b = survival.normalizeSurvival();
  const da = survival.advanceSurvival(a, 2500);
  let db = 0;
  for (let i = 0; i < 2500; i++) db += survival.advanceSurvival(b, 1);
  for (const id of ['hunger', 'thirst', 'rest']) assert.ok(Math.abs(a[id] - b[id]) < 1e-8);
  assert.ok(Math.abs(da - db) < 1e-8);
  const before = structuredClone(b); survival.advanceSurvival(b, 0); survival.advanceSurvival(b, NaN); assert.deepEqual(before, b);
  b.rest = 0; b.hunger = b.thirst = 100; survival.advanceSurvival(b, 13, true);
  assert.equal(b.rest, 100); assert.ok(b.hunger < 100 && b.thirst < 100);
  const saved = survival.normalizeSurvival(JSON.parse(JSON.stringify(b))); assert.deepEqual(saved, b);
  assert.equal(survival.normalizeSurvival({ hunger: NaN, thirst: -7 }).hunger, 100);
});
test('campfire recipes require proximity, consume exact materials atomically, and produce food or safe water', () => {
  const bag = { meat: 1, timber: 1, raw_water: 1 };
  assert.equal(survival.craftAtCamp(bag, 'cook', false), false); assert.equal(bag.meat, 1);
  assert.equal(survival.craftAtCamp(bag, 'cook', true), true);
  assert.equal(bag.cooked_meat, 1); assert.equal(bag.meat, 0); assert.equal(bag.timber, 0);
  assert.equal(survival.craftAtCamp(bag, 'purify', true), false); assert.equal(bag.raw_water, 1);
  bag.timber = 1; assert.equal(survival.craftAtCamp(bag, 'purify', true), true);
  assert.equal(bag.drinking_water, 1); assert.equal(bag.raw_water, 0);
  assert.equal(survival.craftAtCamp(bag, 'unknown', true), false);
});
test('water can only be harvested beside a water tile, with bounds checked', () => {
  const map = { w: 8, h: 8, tiles: Array.from({length: 64}, () => ({ floor: 0 })) };
  map.tiles[3 * 8 + 4].floor = 2;
  assert.equal(survival.waterWithinReach(map, 3 * 32 + 16, 3 * 32 + 16), true);
  assert.equal(survival.waterWithinReach(map, 16, 16), false);
  assert.equal(survival.waterWithinReach(map, -100, -100), false);
});
test('rebuilt worlds are deterministic, distinct, and connect all landmarks and resource groves', () => {
  for (const seed of [1, 42, 793]) for (const hard of [false, true]) {
    const map = world.buildWorld(seed, hard), repeat = world.buildWorld(seed, hard);
    assert.deepEqual(map.tiles, repeat.tiles); assert.deepEqual(map.spawns, repeat.spawns);
    const home = content.scaleTile(30, 32), start = home.ty * map.w + home.tx;
    const seen = new Set([start]), queue = [start];
    for (let k = 0; k < queue.length; k++) {
      const i = queue[k], x = i % map.w, y = Math.floor(i / map.w);
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const xx = x + dx, yy = y + dy, j = yy * map.w + xx;
        if (xx < 0 || yy < 0 || xx >= map.w || yy >= map.h || seen.has(j) || map.tiles[j].block) continue;
        seen.add(j); queue.push(j);
      }
    }
    for (const p of [...content.POIS.filter(p => 'tx' in p), ...content.NPCS.filter(n => n.map === 'world')]) {
      const at = content.scaleTile(p.tx, p.ty); assert.ok(seen.has(at.ty * map.w + at.tx), `unreachable ${p.id ?? p.kind}`);
    }
    const trees = map.spawns.filter(s => s.kind === 'node' && s.node === 'tree'); assert.ok(trees.length > 50);
    for (const t of trees) assert.ok(seen.has(Math.floor(t.y / 32) * map.w + Math.floor(t.x / 32)), t.id);
    assert.ok(map.tiles.filter(t => t.floor === 2).length > 1000);
    for (const sprite of new Set(map.tiles.map(t => t.sprite).filter(Boolean))) assert.doesNotThrow(() => readFileSync(new URL(`../public${sprite}`, import.meta.url)));
  }
  const normal = world.buildWorld(42), hard = world.buildWorld(42, true);
  assert.ok(normal.tiles.filter((t, i) => t.floor !== hard.tiles[i].floor || t.biome !== hard.tiles[i].biome).length > normal.tiles.length / 2);
});

const itemUse = await import(moduleUrl('../src/game/item-use.ts', { './survival': moduleUrl('../src/game/survival.ts') }));
test('items protect full reserves, distinguish buffs from healing, and keep resources for recipes', () => {
  const full = { hardcore: false, hp: 90, maxHp: 90 };
  assert.match(itemUse.itemUseProblem(content.ITEM_BY_ID.potion, full), /full/);
  assert.equal(itemUse.itemUseProblem(content.ITEM_BY_ID.potion, {...full, hp: 20}), null);
  const hard = {...full, hardcore: true, hp: 20, hunger: 100, thirst: 100};
  assert.match(itemUse.itemUseProblem(content.ITEM_BY_ID.potion, hard), /healing spells/);
  assert.match(itemUse.itemUseProblem(content.ITEM_BY_ID.meat, hard), /Cook/);
  assert.match(itemUse.itemUseProblem(content.ITEM_BY_ID.fish, hard), /Cook/);
  assert.match(itemUse.itemUseProblem(content.ITEM_BY_ID.cooked_meat, hard), /full/);
  assert.match(itemUse.itemUseProblem(content.ITEM_BY_ID.drinking_water, hard), /hydrated/);
  assert.equal(itemUse.itemUseProblem(content.ITEM_BY_ID.cooked_meat, {...hard, hunger: 20}), null);
  assert.equal(itemUse.itemUseProblem(content.ITEM_BY_ID.drinking_water, {...hard, thirst: 20}), null);
  for (const id of ['cats_eye', 'ironroot_phial', 'warmth_tonic']) assert.equal(itemUse.itemUseProblem(content.ITEM_BY_ID[id], hard), null);
  assert.match(itemUse.itemUseProblem(content.ITEM_BY_ID.timber, hard), /resource/);
});
test('quick meal chooses the smallest sufficient portion or largest available without wasting full reserves', () => {
  const bag = { cooked_meat: 2, trail_ration: 1, mushroom: 5 };
  assert.equal(itemUse.bestFood(bag, 100), null);
  assert.equal(itemUse.bestFood(bag, 95), 'mushroom');
  assert.equal(itemUse.bestFood(bag, 70), 'trail_ration');
  assert.equal(itemUse.bestFood(bag, 45), 'cooked_meat');
  assert.equal(itemUse.bestFood({}, 0), null);
  assert.equal(bag.cooked_meat, 2);
});


test("actor walk cycle uses both steps and returns to standing without rapid frame skipping", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(n => sheets.actorWalkFrame(n)), [1, 0, 1, 2, 1]);
  assert.equal(sheets.actorWalkFrame(0.99), 1);
  assert.equal(sheets.actorWalkFrame(1.01), 0);
  assert.equal(sheets.actorWalkFrame(7.5, false), 1);
});

test("terrain window reuses paint, refreshes at edges and asset loads, and bounds memory", () => {
  const previous = { document: globalThis.document, Image: globalThis.Image };
  let paints = 0, blits = 0, canvases = 0;
  const images = [];
  const context = () => new Proxy({}, {
    get: (target, key) => key in target ? target[key] : (...args) => { paints++; },
  });
  globalThis.Image = class {
    complete = false; naturalWidth = 0;
    constructor() { images.push(this); }
  };
  globalThis.document = { createElement: () => {
    canvases++;
    const ctx = context();
    return { width: 0, height: 0, getContext: () => ctx };
  }};
  const ctx = context();
  ctx.drawImage = () => { blits++; };
  const map = { w: 64, h: 64, tiles: Array.from({ length: 4096 }, () => ({ floor: 0, biome: 2, block: 0, decor: 0, sprite: "/qa/terrain.png" })), spawns: [], cache: null };
  const draw = (x = 512, width = 320, zoom = 2) => world.drawWorldSlice(ctx, map, x, 512, width, 240, zoom);
  try {
    draw();
    const first = paints;
    assert.ok(first > 0);
    draw(); draw(520);
    assert.equal(paints, first, "stationary / nearby views repaint no terrain");
    assert.equal(blits, 3);
    draw(800);
    assert.ok(paints > first, "moving beyond cached edge repaints");
    const edge = paints;
    images[0].onload();
    draw(800);
    assert.ok(paints > edge, "newly loaded art replaces cached placeholders");
    const loaded = paints;
    map.tiles = [...map.tiles];
    draw(800);
    assert.ok(paints > loaded, "replacement terrain invalidates the cache");
    draw(800, 640);
    assert.equal(canvases, 1, "resize reuses the bounded bitmap");
    const before = paints;
    draw(800, 4000, 0.2);
    assert.ok(paints > before);
    assert.equal(canvases, 1, "far zoom uses direct painting instead of a huge bitmap");
    const other = { ...map };
    world.drawWorldSlice(ctx, other, 512, 512, 320, 240, 2);
    assert.equal(canvases, 2, "worlds have independent caches");
  } finally {
    globalThis.document = previous.document;
    globalThis.Image = previous.Image;
  }
});
