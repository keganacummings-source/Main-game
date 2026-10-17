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
const kitsUrl = moduleUrl("../src/game/class-kits.ts");
const classesUrl = moduleUrl("../src/game/classes.ts", { "./class-kits": kitsUrl });
const overmaxUrl = moduleUrl("../src/game/overmax.ts");
const contentUrl = moduleUrl("../src/game/content.ts", { "./classes": classesUrl, "./overmax": overmaxUrl, "./class-kits": kitsUrl });
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
const ghostStyleUrl = moduleUrl("../src/game/ghost-style.ts");
const creaturesUrl = moduleUrl("../src/game/creature-sprites.ts", { "./content": contentUrl, "./ghost-style": ghostStyleUrl });
const creatures = await import(creaturesUrl);
const balanceUrl = moduleUrl("../src/game/balance.ts", { "./content": contentUrl, "./overmax": overmaxUrl });
const shippedEnemies = `data:text/javascript;base64,${Buffer.from("export default [];").toString("base64")}`;
const enemies = await import(
  moduleUrl("../src/game/enemy-design.ts", { "./content": contentUrl, "./balance": balanceUrl, "./creature-sprites": creaturesUrl, "./enemies/custom-enemies.json": shippedEnemies })
);
const tilesStub = `data:text/javascript;base64,${Buffer.from("export const findAtlasTile=()=>null;").toString("base64")}`;
const maps = await import(
  moduleUrl("../src/game/map-format.ts", { "./content": contentUrl, "./tile-atlas": tilesStub, "./idb-store": moduleUrl("../src/game/idb-store.ts") })
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
  assert.equal(abilities.spendAbilityPoint(save, "shard"), true);
  assert.equal(save.abilityRanks.shard, 6);
  assert.ok(Math.abs(abilities.abilityMultiplier(save, "shard") - 1.68) < 1e-9);
  assert.equal(abilities.spendAbilityPoint(save, "bogus"), false);
  save.skillPoints = 0;
  assert.equal(abilities.spendAbilityPoint(save, "lantern"), false);
});

test("fixed equipment stats keep rolled enchantments and grant no verse attacks", () => {
  for (const slot of ["weapon", "head", "chest", "legs", "feet", "relic"]) {
    const g = content.rollGear(content.mulberry32(42), { level: 12, slot });
    assert.ok(g.enchants.every((e) => content.ENCHANT_BY_ID[e.id] && e.power > 0));
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

test("enemy design round trip validates identity, sprite and moves, and clamps stats", () => {
  const d = enemies.newEnemyDesign();
  assert.deepEqual(enemies.parseEnemyDesign(JSON.parse(JSON.stringify(d))), d);
  for (const change of [{ id: "bad id!" }, { name: "" }, { type: "bogus" }, { moves: [] }, { sprite: null }, { id: "onibi", replaces: null }])
    assert.throws(() => enemies.parseEnemyDesign({ ...d, ...change }));
  const wild = enemies.parseEnemyDesign({ ...d, stats: { hp: 99, dmg: -1, speed: 9, crit: 2, dodge: 2, physRes: 2, spellRes: 2 }, scale: 9, weight: 99, loot: 99 });
  assert.equal(wild.stats.hp, 50);
  assert.equal(wild.stats.dmg, 0.05);
  assert.equal(wild.stats.speed, 9);
  assert.equal(wild.stats.dodge, 2);
  assert.equal(wild.stats.physRes, 2);
  assert.equal(wild.scale, 6);
  assert.equal(wild.weight, 20);
  assert.equal(wild.loot, 40);
  const remix = enemies.designFromBuiltin("onibi");
  assert.equal(remix.replaces, "onibi");
  assert.deepEqual(remix.sprite, { kind: "sheet", cell: creatures.CREATURE_CELLS.onibi });
});

test("every enemy and animal has a supplied pixel sprite", () => {
  for (const m of [...content.MONSTERS, ...content.ANIMALS])
    assert.ok(creatures.CREATURE_CELLS[m.id], `Missing sprite for ${m.id}`);
});

test("equipment migration keeps enchantments and can restore a stripped piece", () => {
  const g = content.rollGear(content.mulberry32(1), { level: 5, slot: "weapon" });
  g.enchants = [{ id: "might", power: 8 }];
  g.moves = ["ember"];
  content.migrateEquipment(g);
  assert.deepEqual(g.enchants, [{ id: "might", power: 8 }]);
  assert.deepEqual(g.moves, []);
  g.enchants = [];
  g.previousEquipment = { enchants: [{ id: "might", power: 8 }], moves: ["ember"] };
  content.migrateEquipment(g);
  assert.deepEqual(g.enchants, [{ id: "might", power: 8 }]);
  assert.deepEqual(g.moves, []);
});

const survival = await import(moduleUrl("../src/game/survival.ts", { "./building": moduleUrl("../src/game/building.ts") }));
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
  assert.equal(survival.craftAtCamp(bag, 'cook', false), null); assert.equal(bag.meat, 1);
  assert.equal(survival.craftAtCamp(bag, 'cook', true)?.id, 'cook');
  assert.equal(bag.cooked_meat, 1); assert.equal(bag.meat, 0); assert.equal(bag.timber, 0);
  assert.equal(survival.craftAtCamp(bag, 'purify', true), null); assert.equal(bag.raw_water, 1);
  bag.timber = 1; assert.equal(survival.craftAtCamp(bag, 'purify', true)?.id, 'purify');
  assert.equal(bag.drinking_water, 1); assert.equal(bag.raw_water, 0);
  assert.equal(survival.craftAtCamp(bag, 'unknown', true), null);
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

const itemUse = await import(moduleUrl('../src/game/item-use.ts', { './survival': moduleUrl('../src/game/survival.ts', { './building': moduleUrl('../src/game/building.ts') }) }));
test('items protect full reserves, distinguish buffs from healing, and keep resources for recipes', () => {
  const full = { hardcore: false, hp: 90, maxHp: 90 };
  assert.match(itemUse.itemUseProblem(content.ITEM_BY_ID.potion, full), /full/);
  assert.equal(itemUse.itemUseProblem(content.ITEM_BY_ID.potion, {...full, hp: 20}), null);
  const hard = {...full, hardcore: true, hp: 20, hunger: 100, thirst: 100};
  assert.equal(itemUse.itemUseProblem(content.ITEM_BY_ID.potion, hard), null, "potions work in Hardcore now");
  assert.match(itemUse.itemUseProblem(content.ITEM_BY_ID.potion, { ...hard, hp: 90 }), /full/);
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

// ---------------------------------------------------------------------------
// Ghost rarity, palettes and abilities
// ---------------------------------------------------------------------------
const ghostStyle = await import(ghostStyleUrl);
const ghostAbilities = await import(moduleUrl("../src/game/ghost-abilities.ts", { "./ghost-style": ghostStyleUrl }));
const seeded = (n) => content.mulberry32(n);

test("ghost rarities run Common to Mythic and only climb from Epic", () => {
  assert.deepEqual(ghostStyle.RARITY_NAMES, ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"]);
  for (const r of ghostStyle.GHOST_RARITIES) assert.ok(r.alpha > 0 && r.alpha <= 1 && r.glow >= 0 && r.glow <= 1);
  assert.equal(ghostStyle.clampRarity(9), 5);
  assert.equal(ghostStyle.clampRarity(-2), 0);
  const rng = seeded(4);
  for (let i = 0; i < 400; i++) assert.ok(ghostStyle.rollGhostRarity(1, rng) <= 1, "an Uncommon foe never leaves a Legendary ghost without a shiny");
  let legendary = 0, mythic = 0;
  for (let i = 0; i < 4000; i++) { const r = ghostStyle.rollGhostRarity(3, rng, { boss: true }); if (r === 4) legendary++; if (r === 5) mythic++; }
  assert.ok(legendary > 800 && legendary < 2000, `bosses climb to Legendary about 30% of the time, got ${legendary}`);
  assert.ok(mythic > 60 && mythic < 400, `bosses reach Mythic about 5% of the time, got ${mythic}`);
});

test("twelve shiny palettes; Prism is the default and rarer ghosts lean to rarer palettes", () => {
  assert.equal(ghostStyle.SHINY_PALETTES.length, 12);
  assert.equal(ghostStyle.shinyPalette(undefined).id, "prism");
  assert.equal(ghostStyle.shinyPalette("nope").id, "prism");
  for (const r of [0, 3, 5]) {
    const total = ghostStyle.SHINY_PALETTES.reduce((n, p) => n + ghostStyle.paletteOdds(p.id, r), 0);
    assert.ok(Math.abs(total - 1) < 1e-9);
  }
  assert.ok(ghostStyle.paletteOdds("prism", 5) > ghostStyle.paletteOdds("prism", 0) * 2, "Prism is much likelier on a Mythic");
  assert.ok(ghostStyle.paletteOdds("ember", 5) < ghostStyle.paletteOdds("ember", 0), "Ember is likelier on a Common");
  const rng = seeded(7);
  for (let i = 0; i < 200; i++) assert.ok(ghostStyle.PALETTE_BY_ID[ghostStyle.rollShinyPalette(rng, i % 6)]);
  assert.match(ghostStyle.paletteColor(ghostStyle.shinyPalette("ember"), 1.3), /^rgba\(/);
});

test("ghost abilities, two shiny-only, and the count follows rarity", () => {
  assert.equal(ghostAbilities.GHOST_ABILITIES.length, 26);
  assert.deepEqual(ghostAbilities.GHOST_ABILITIES.filter((a) => a.shiny).map((a) => a.id).sort(), ["radiant_surge", "shiny_charm"]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(ghostAbilities.abilityCount), [1, 1, 2, 2, 3, 3]);
  const rng = seeded(11);
  for (let i = 0; i < 300; i++) {
    const r = i % 6, shiny = i % 5 === 0;
    const list = ghostAbilities.rollGhostAbilities(rng, r, shiny);
    assert.equal(list.length, ghostAbilities.abilityCount(r));
    assert.equal(new Set(list.map((a) => a.id)).size, list.length, "no repeats");
    for (const a of list) {
      assert.ok(a.q >= 0 && a.q <= 1);
      if (!shiny) assert.ok(!ghostAbilities.GHOST_ABILITY_BY_ID[a.id].shiny, "only shinies roll shiny-only abilities");
    }
  }
  for (const a of ghostAbilities.GHOST_ABILITIES) {
    assert.ok(a.about.includes("{v}") || a.unit === "block", `${a.id} shows its number`);
    if (a.kind === "timed") assert.ok(a.cd > 0 && a.about.includes("{cd}"), `${a.id} has a cooldown`);
    else assert.ok(a.chan, `${a.id} feeds a channel`);
  }
});

test("abilities grow with level, rarity and quality, and recharge faster when rarer", () => {
  const roll = { id: "ghost_fang", q: 0.5 };
  const v = (lv, r, q = 0.5) => ghostAbilities.abilityValue({ ...roll, q }, { level: lv, rarity: r });
  assert.ok(v(100, 0) > v(1, 0));
  assert.ok(v(1, 5) > v(1, 0));
  assert.ok(v(1, 0, 1) > v(1, 0, 0));
  assert.ok(v(1000, 5, 1) <= 30, "one ghost never passes the cap");
  const guard = { id: "spirit_guard", q: 0.5 };
  assert.ok(ghostAbilities.abilityCooldown(guard, { level: 1, rarity: 5 }) < ghostAbilities.abilityCooldown(guard, { level: 1, rarity: 0 }));
  assert.ok(Math.abs(ghostAbilities.abilityCooldown(guard, { level: 1, rarity: 0 }) - 60) < 0.01, "Spirit Guard is a minute at Common, mid quality");
  const bomb = { id: "soul_bomb", q: 0.5 };
  assert.ok(ghostAbilities.abilityValue(bomb, { level: 50, rarity: 2 }) > ghostAbilities.abilityValue(bomb, { level: 5, rarity: 2 }));
  assert.match(ghostAbilities.abilityText(guard, { level: 1, rarity: 0 }), /every 60s/);
});

test("many ghosts stack up to each cap, and timed abilities share one faster timer", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ level: 200, rarity: 5, name: `G${i}`, abilities: [{ id: "ghost_fang", q: 1 }, { id: "soul_bomb", q: 1 }] }));
  const agg = ghostAbilities.aggregateGhostAbilities(many);
  assert.equal(agg.chan.might, 30);
  const one = ghostAbilities.aggregateGhostAbilities(many.slice(0, 1));
  assert.ok(agg.timed.soul_bomb.value <= one.timed.soul_bomb.value * 2 + 1e-9, "damage stacks to at most twice the best");
  assert.ok(agg.timed.soul_bomb.cd < one.timed.soul_bomb.cd, "more ghosts recharge faster");
  assert.ok(agg.timed.soul_bomb.cd >= one.timed.soul_bomb.cd * 0.6 - 0.1, "but at most 40% faster");
  assert.equal(agg.timed.soul_bomb.n, 12);
  assert.deepEqual(ghostAbilities.aggregateGhostAbilities([]), { chan: {}, timed: {} });
});

test("old ghosts are repaired: bad rows dropped, shiny-only removed from non-shinies, count filled", () => {
  const rng = seeded(3);
  const fixed = ghostAbilities.normalizeAbilities([{ id: "nope" }, { id: "shiny_charm", q: 2 }, { id: "keen_eye", q: "x" }, { id: "keen_eye", q: 0.2 }], rng, 4, false);
  assert.equal(fixed.length, 3);
  assert.ok(!fixed.some((a) => a.id === "shiny_charm" || a.id === "nope"));
  assert.equal(fixed[0].id, "keen_eye");
  assert.equal(fixed[0].q, 0.5, "a broken quality reads as 50%");
  assert.equal(ghostAbilities.normalizeAbilities(undefined, rng, 0, false).length, 1);
});

// ---------------------------------------------------------------------------
// The Starfall verse batch
// ---------------------------------------------------------------------------
test("the Starfall batch: every new verse has its own animation and sane area numbers", () => {
  const batch = content.MOVES.filter((m) => m.fx);
  assert.ok(batch.length >= 12, `expected a batch of new verses, got ${batch.length}`);
  const fxIds = new Set(["meteor", "chain", "vortex", "pillar", "nova", "boomerang", "barrage", "fissure", "sigil", "spectral", "wave", "bloom"]);
  const used = new Set(batch.map((m) => m.fx));
  assert.equal(used.size, fxIds.size, "every animation is used by at least one verse");
  const ids = new Set();
  for (const m of batch) {
    assert.ok(fxIds.has(m.fx), `${m.id} names a real animation`);
    assert.ok(!ids.has(m.id)); ids.add(m.id);
    assert.ok(content.MOVE_BY_ID[m.id] === m);
    assert.ok(["strike", "heavy", "channel"].includes(content.moveTactic(m)), `${m.id} is an attack`);
    assert.ok(m.power > 0 && m.power <= 90);
    if (m.splash) assert.ok(m.splash.radius >= 30 && m.splash.radius <= 90 && m.splash.mult > 0 && m.splash.mult < 1);
    if (m.chain) assert.ok(m.chain.jumps >= 1 && m.chain.jumps <= 4 && m.chain.mult < 1);
    if (m.nova) assert.equal(content.attackRange(m), m.nova, "a nova reaches exactly as far as its ring");
    if (m.echo) assert.ok(m.echo > 0 && m.echo < 1);
  }
  // Ghosts and foes of the element can roll them.
  const rng = seeded(5);
  const seen = new Set();
  for (let i = 0; i < 400; i++) for (const id of content.rollSpiritKit(content.TYPE_IDS[i % content.TYPE_IDS.length], rng).known) seen.add(id);
  assert.ok(batch.some((m) => seen.has(m.id)), "ghost kits draw from the new verses");
});

// ---------------------------------------------------------------------------
// The Reaver verse batch: 30 melee verses
// ---------------------------------------------------------------------------
test("the Reaver batch: 30 new melee verses with real reach, valid effects and every element covered", () => {
  const ids = content.REAVER_BATCH;
  assert.equal(ids.length, 30, "thirty new melee verses");
  assert.equal(new Set(ids).size, 30, "no repeated ids");
  const all = content.MOVES.map((m) => m.id);
  assert.equal(new Set(all).size, all.length, "every verse id in the game is unique");
  const effects = new Set(["none", "burn", "soak", "root", "sleep", "expose", "gloom", "leech", "spark", "silence"]);
  const types = new Set();
  const tactics = new Set();
  for (const id of ids) {
    const m = content.MOVE_BY_ID[id];
    assert.ok(m, `${id} exists`);
    assert.equal(content.attackForm(m), "melee", `${id} is melee`);
    assert.equal(m.form, "melee", `${id} says so itself`);
    assert.ok(content.TYPES[m.type], `${id} has a real element`);
    assert.ok(["strike", "heavy", "lunge"].includes(content.moveTactic(m)), `${id} is a strike, heavy or lunge`);
    assert.ok(effects.has(m.effect), `${id} effect ${m.effect}`);
    assert.ok(m.power >= 20 && m.power <= 90, `${id} power`);
    assert.ok(m.accuracy >= 70 && m.accuracy <= 100 && m.crit >= 0 && m.crit <= 40, `${id} accuracy and crit`);
    assert.ok(!m.fx, `${id} leaves the Starfall animations alone`);
    const r = content.attackRange(m);
    assert.ok(r >= content.MELEE_MIN_REACH && r <= content.MELEE_MAX_REACH, `${id} reach ${r} is 1-2 tiles`);
    assert.ok(content.formTag(m).includes("ignores all armor"), `${id} says it ignores all armor`);
    assert.ok(content.formTag(m).includes("within 2 tiles"), `${id} says it works within 2 tiles`);
    if (m.nova) assert.equal(r, m.nova, `${id} nova reaches exactly as far as its ring`);
    if (m.splash) assert.ok(m.splash.radius >= 30 && m.splash.radius <= 90 && m.splash.mult > 0 && m.splash.mult < 1);
    if (m.chain) assert.ok(m.chain.jumps >= 1 && m.chain.jumps <= 4 && m.chain.mult < 1);
    if (m.echo) assert.ok(m.echo > 0 && m.echo < 1);
    types.add(m.type);
    tactics.add(content.moveTactic(m));
  }
  assert.equal(types.size, content.TYPE_IDS.length, "every element gets a new melee verse");
  assert.equal(tactics.size, 3, "strikes, heavies and lunges are all in the batch");
  assert.ok(content.formTag(content.MOVE_BY_ID.cutlass).includes("ignores all armor"));
  // Ghosts of the element can roll them.
  const rng = seeded(11);
  const seen = new Set();
  for (let i = 0; i < 600; i++) for (const id of content.rollSpiritKit(content.TYPE_IDS[i % content.TYPE_IDS.length], rng).known) seen.add(id);
  assert.ok(ids.some((id) => seen.has(id)), "ghost kits draw from the new verses");
});

// ---------------------------------------------------------------------------
// Account progress: perk points, and joining two copies of the account
// ---------------------------------------------------------------------------
const accountProgress = await import(moduleUrl("../src/game/account-progress.ts", { "./content": contentUrl }));

test("every account level gives 5 perk points, and every perk bought spends one", () => {
  const ap = accountProgress;
  assert.equal(ap.PERK_POINTS_PER_LEVEL, 5);
  assert.equal(ap.perkPointsEarned(1), 0);
  assert.equal(ap.perkPointsEarned(2), 5);
  assert.equal(ap.perkPointsEarned(11), 50);
  assert.equal(ap.perkPointsSpent({ might: 3, spark_life: 4 }), 5, "Spark of Life adds 2 per point, so 4 is two purchases");
  assert.equal(ap.perkPointsAvailable(11, { might: 3, spark_life: 4 }), 45);
  assert.equal(ap.perkPointsAvailable(2, { might: 30 }), 0, "never negative");
  assert.equal(ap.perkPointsAvailable(NaN, null), 0);
});

test("a stale copy of the account can never roll progress back", () => {
  const ap = accountProgress;
  const local = { accountLevel: 9, accountXp: 40, perks: { might: 6, ward: 2 }, skills: { mining: { level: 12, xp: 5 }, fishing: { level: 3, xp: 90 } }, accountScore: 900, savedAt: 2000, shinies: [{ uid: "a" }] };
  const cloud = { accountLevel: 7, accountXp: 900, perks: { might: 2, crit_edge: 1 }, perkPoints: 99, skills: { mining: { level: 10, xp: 400 }, fishing: { level: 3, xp: 120 } }, accountScore: 1200, savedAt: 1000, shinies: [{ uid: "b" }, { uid: "a" }] };
  const m = ap.mergeAccountMeta(local, cloud);
  assert.equal(m.accountLevel, 9);
  assert.equal(m.accountXp, 40, "XP goes with the level it belongs to");
  assert.deepEqual(m.perks, { might: 6, ward: 2, crit_edge: 1 });
  assert.equal(m.perkPoints, ap.perkPointsAvailable(9, m.perks), "points are recomputed, never copied");
  assert.deepEqual(m.skills.mining, { level: 12, xp: 5 });
  assert.deepEqual(m.skills.fishing, { level: 3, xp: 120 });
  assert.equal(m.accountScore, 1200);
  assert.equal(m.shinies.length, 2);
  const flip = ap.mergeAccountMeta(cloud, local);
  assert.deepEqual({ ...flip, shinies: flip.shinies.map((x) => x.uid).sort() }, { ...m, shinies: m.shinies.map((x) => x.uid).sort() }, "order does not matter");
  // A later Ascension wins outright.
  const wiped = ap.mergeAccountMeta(local, { ascensions: 1, shinies: [{ uid: "c" }] });
  assert.equal(wiped.accountLevel, undefined);
  assert.equal(wiped.ascensions, 1);
  assert.equal(wiped.shinies.length, 2, "the Shiny collection is a record and survives");
  assert.equal(ap.mergeAccountMeta(null, cloud).accountLevel, 7);
  assert.equal(ap.mergeAccountMeta(local, null).accountLevel, 9);
});

test("the newer of two witch saves wins", () => {
  const ap = accountProgress;
  assert.equal(ap.newerSave({ name: "c", savedAt: 5 }, { name: "l", savedAt: 9 }).name, "l");
  assert.equal(ap.newerSave({ name: "c", savedAt: 9 }, { name: "l", savedAt: 5 }).name, "c");
  assert.equal(ap.newerSave({ name: "c" }, { name: "l" }).name, "c", "without stamps the cloud copy is kept, as before");
  assert.equal(ap.newerSave(null, { name: "l" }).name, "l");
  assert.equal(ap.newerSave({ name: "c" }, null).name, "c");
});

test("the new perks exist and every perk has a sensible step and maximum", () => {
  const perks = content.ENCHANTS.filter((e) => e.perk);
  for (const id of ["shiny_luck", "ghost_xp", "ghost_power", "area_power", "swift_step", "thorns", "focus", "aura_ease", "leech_edge"]) assert.ok(perks.some((e) => e.id === id), `${id} can be bought as a perk`);
  for (const e of perks) {
    assert.ok(e.perk.step >= 1 && e.perk.max >= e.perk.step, `${e.id}`);
    assert.ok(e.cat, `${e.id} has a category for the perk list`);
  }
  assert.match(content.skillLine("ghostkeeping", 11), /XP/);
});

test("healing items heal a share of max health; potions share a cooldown; Hardcore heals at three quarters", () => {
  const big = itemUse.healingOf("big_potion", 1000, false);
  const pot = itemUse.healingOf("potion", 1000, false);
  assert.ok(big.now > pot.now && pot.now >= 250, `potion ${pot.now}, big ${big.now}`);
  assert.ok(pot.regen > 0 && pot.sec > 0 && pot.potion);
  assert.equal(itemUse.healingOf("potion", 1000, true).now, Math.floor(1000 * 0.28 * itemUse.HARDCORE_HEAL));
  assert.ok(itemUse.healingOf("potion", 1000, false, 20).now > pot.now, "Deep Sip adds to every heal");
  assert.ok(itemUse.healingOf("spirit_candy", 1000, false).ghost > 0);
  assert.equal(itemUse.healingOf("hearty_skewer", 1000, false).potion, false, "meals have no cooldown");
  assert.equal(itemUse.healingOf("timber", 1000, false), null);
  for (const id of Object.keys(itemUse.HEALING)) assert.ok(content.ITEM_BY_ID[id], `${id} is a real item`);
  assert.match(itemUse.healingLine("potion", 500, true), /Heals 105/);
  // Trail rations and cooked meat used to count as "crafting resources" in TurboHunt.
  assert.equal(itemUse.itemUseProblem(content.ITEM_BY_ID.cooked_meat, { hardcore: false, hp: 10, maxHp: 90 }), null);
});

test("the Space queue holds three consumables in order and drops the ones you ran out of", () => {
  const known = (id) => !!content.ITEM_BY_ID[id] && itemUse.isConsumable(content.ITEM_BY_ID[id]);
  const bag = { potion: 2, big_potion: 0, cleanse_salt: 1, timber: 9, smoke_bomb: 3, ghost_jar: 1 };
  assert.deepEqual(itemUse.cleanQuick(["potion", "big_potion", "cleanse_salt", "smoke_bomb", "ghost_jar"], bag, known), ["potion", "cleanse_salt", "smoke_bomb"]);
  assert.deepEqual(itemUse.cleanQuick(["timber", "potion", "potion", 5, "nope"], bag, known), ["potion"], "materials, repeats and junk are dropped");
  assert.deepEqual(itemUse.cleanQuick(undefined, bag, known), []);
  bag.potion = 0;
  assert.deepEqual(itemUse.cleanQuick(["potion", "cleanse_salt"], bag, known), ["cleanse_salt"], "an empty first item hands Space to the next");
  assert.equal(itemUse.QUICK_MAX, 3);
  assert.ok(!itemUse.isConsumable(content.ITEM_BY_ID.ore));
});

test("cloud payloads round-trip through gzip, and plain JSON still reads", async () => {
  const save = await import(moduleUrl("../src/game/account-save.ts", { "./account-progress": moduleUrl("../src/game/account-progress.ts", { "./content": contentUrl }) }));
  const json = JSON.stringify({ kind: "turbz-bundle", v: 3, hunt: { name: "W", gear: Array.from({ length: 400 }, (_, i) => ({ uid: `g${i}`, name: "Blade of the Pit", enchants: [{ id: "might", power: 12 }] })) }, meta: { accountLevel: 9 } });
  const packed = await save.packCloud(json);
  assert.match(packed, /^gz1:[A-Za-z0-9+/]+={0,2}$/);
  assert.ok(packed.length < json.length / 5, `${packed.length} vs ${json.length}`);
  assert.equal(await save.unpackCloud(packed), json);
  assert.equal(await save.unpackCloud(json), json);
});
