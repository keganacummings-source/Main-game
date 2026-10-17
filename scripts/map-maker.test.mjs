import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
const atlasStub = `data:text/javascript;base64,${Buffer.from("export const findAtlasTile=()=>null;").toString("base64")}`;
const idbUrl = moduleUrl("../src/game/idb-store.ts");
const formatUrl = moduleUrl("../src/game/map-format.ts", { "./content": contentUrl, "./tile-atlas": atlasStub, "./idb-store": idbUrl });
const maps = await import(formatUrl);
const quests = await import(moduleUrl("../src/game/map-quests.ts"));
const tools = await import(moduleUrl("../src/game/map-tools.ts", { "./content": contentUrl, "./map-format": formatUrl }));
const questCheckUrl = moduleUrl("../src/game/quest-check.ts", { "./content": contentUrl, "./map-format": formatUrl });
const gen = await import(moduleUrl("../src/game/map-gen.ts", { "./content": contentUrl, "./map-format": formatUrl, "./quest-check": questCheckUrl }));

function village() {
  const m = maps.emptyMap("village", "Village", 24, 16, 0);
  m.intro = "Long ago.\n\nThe hearth went out.";
  m.npcs = [
    { id: "elder", name: "Elder", tx: 4, ty: 4, lines: ["Hello."] },
    { id: "smith", name: "Smith", tx: 8, ty: 4, lines: ["Hm."] },
  ];
  m.interactables = [{ id: "tree1", kind: "node", node: "tree", tx: 6, ty: 6 }];
  m.spawns = [{ id: "e1", kind: "mob", species: "onibi", x: 10 * 32 + 16, y: 8 * 32 + 16, level: 3, fixedLevel: true }];
  m.quests = [
    { id: "q1", name: "Wood for the Smith", about: "Chop.", giver: "elder", steps: [{ type: "gather", node: "tree", count: 2 }, { type: "talk", npcId: "smith" }], reward: { kyo: 50, items: [{ itemId: "potion", count: 2 }] } },
    { id: "q2", name: "Pests", about: "Kill.", giver: "smith", requires: "q1", turnIn: "elder", steps: [{ type: "kill", count: 2, species: "onibi" }, { type: "goto", tx: 12, ty: 10, radius: 2 }] },
  ];
  return m;
}

test("a map with story, NPCs and quests survives a save/load round trip", () => {
  const m = village();
  const r = maps.parseMapJson(JSON.parse(JSON.stringify(m)));
  assert.equal(r.intro, m.intro);
  assert.deepEqual(r.quests.map((q) => q.id), ["q1", "q2"]);
  assert.deepEqual(r.quests[0].reward, { kyo: 50, items: [{ itemId: "potion", count: 2 }] });
  assert.equal(r.quests[1].requires, "q1");
  assert.equal(r.quests[1].turnIn, "elder");
  assert.equal(r.npcs.length, 2);
});

test("old files that stored one quest on the NPC are upgraded", () => {
  const m = village();
  m.quests = [];
  m.npcs[0].quest = { id: "old", name: "Old Favor", about: "x", rewardKyo: 70, steps: [{ type: "kill", count: 3 }] };
  const r = maps.parseMapJson(JSON.parse(JSON.stringify(m)));
  assert.equal(r.quests.length, 1);
  assert.equal(r.quests[0].giver, "elder");
  assert.equal(r.quests[0].reward.kyo, 70);
  assert.equal(r.npcs[0].quest, undefined);
});

test("bad quest data is rejected or clamped", () => {
  const m = village();
  m.quests.push({ ...m.quests[0] });
  assert.throws(() => maps.parseMapJson(m), /unique/i);
  const n = village();
  n.quests[0].steps = [{ type: "dance" }];
  assert.throws(() => maps.parseMapJson(n));
  const c = village();
  c.quests[0].steps = [{ type: "kill", count: 9999 }];
  assert.equal(maps.parseMapJson(c).quests[0].steps[0].count, 50);
});

const ctx = { npcName: (i) => i, itemName: (i) => i, speciesName: (i) => i };

test("a quest runs offer -> steps in order -> ready -> turn-in -> unlocks the next", () => {
  const m = maps.parseMapJson(village());
  const st = {};
  assert.deepEqual(quests.offerable(m, "elder", st).map((q) => q.id), ["q1"]);
  assert.deepEqual(quests.offerable(m, "smith", st), [], "q2 waits for q1");
  assert.equal(quests.marker(m, m.npcs[0], st), "!");
  assert.ok(quests.accept(m, "q1", st));
  assert.equal(quests.accept(m, "q1", st), false, "cannot take it twice");
  const q1 = m.quests[0];
  const s = st["village:q1"];
  assert.equal(quests.advance(q1, s, { t: "kill", species: "onibi" }).changed, false, "wrong event ignored");
  assert.equal(quests.advance(q1, s, { t: "gather", node: "tree" }).changed, true);
  assert.equal(s.step, 0);
  quests.advance(q1, s, { t: "gather", node: "tree" });
  assert.equal(s.step, 1, "gather done");
  quests.advance(q1, s, { t: "talk", npcId: "elder" });
  assert.equal(s.step, 1, "wrong NPC");
  const a = quests.advance(q1, s, { t: "talk", npcId: "smith" });
  assert.ok(a.ready);
  assert.equal(s.status, "ready");
  assert.equal(quests.marker(m, m.npcs[0], st), "?");
  assert.equal(quests.turnIn(m, "smith", st), null, "only the turn-in NPC takes it");
  assert.equal(quests.turnIn(m, "elder", st).id, "q1");
  assert.equal(s.status, "done");
  assert.deepEqual(quests.offerable(m, "smith", st).map((q) => q.id), ["q2"]);
  assert.ok(quests.progressLines(q1, s, ctx).every((l) => l.startsWith("[x]")));
});

test("kill, goto and bring steps", () => {
  const m = maps.parseMapJson(village());
  const st = {};
  quests.accept(m, "q1", st);
  st["village:q1"] = { status: "done", step: 2, n: 0 };
  quests.accept(m, "q2", st);
  const q2 = m.quests[1];
  const s = st["village:q2"];
  quests.advance(q2, s, { t: "kill", species: "nobi" });
  assert.equal(s.n, 0, "other species do not count");
  quests.advance(q2, s, { t: "kill", species: "onibi" });
  quests.advance(q2, s, { t: "kill", species: "onibi" });
  assert.equal(s.step, 1);
  assert.equal(quests.advance(q2, s, { t: "goto", tx: 20, ty: 10 }).changed, false);
  assert.ok(quests.advance(q2, s, { t: "goto", tx: 13, ty: 11 }).ready);
  const bring = { id: "b", name: "B", about: "", giver: "elder", steps: [{ type: "bring", itemId: "potion", count: 2 }] };
  const bs = { status: "active", step: 0, n: 0 };
  assert.equal(quests.advance(bring, bs, { t: "talk", npcId: "elder" }, { potion: 1 }).changed, false, "not enough items");
  const done = quests.advance(bring, bs, { t: "talk", npcId: "elder" }, { potion: 3 });
  assert.deepEqual(done.consumed, { itemId: "potion", count: 2 });
  assert.equal(bs.status, "ready");
});

test("saved quest progress is cleaned", () => {
  const s = quests.sanitizeQuestStates({ "a:b": { status: "active", step: 2.7, n: -4 }, bad: { status: "weird" }, x: null });
  assert.deepEqual(s, { "a:b": { status: "active", step: 2, n: 0 } });
  assert.deepEqual(quests.sanitizeQuestStates("nope"), {});
});

test("the checker finds broken quests and unreachable places", () => {
  const m = maps.parseMapJson(village());
  assert.deepEqual(tools.validateMap(m, new Set(["potion"])).filter((i) => i.level === "error"), []);
  m.quests[0].giver = "ghost";
  m.quests[1].requires = "q2";
  m.quests[0].steps[1] = { type: "talk", npcId: "nobody" };
  m.quests[0].reward.items = [{ itemId: "nonsense", count: 1 }];
  const errs = tools.validateMap(m, new Set(["potion"])).filter((i) => i.level === "error").map((i) => i.text).join("|");
  assert.match(errs, /no giver/);
  assert.match(errs, /itself/);
  assert.match(errs, /talk target/);
  assert.match(errs, /nonsense/);
  const walled = maps.parseMapJson(village());
  for (let y = 0; y < walled.h; y++) walled.tiles[y * walled.w + 6].block = 1;
  assert.ok(tools.validateMap(walled).some((i) => /cannot be reached/.test(i.text)));
});

test("resize keeps the corner and drops what falls off", () => {
  const m = maps.parseMapJson(village());
  m.tiles[3 * m.w + 3].sprite = "/MapAssets/a/b.png";
  const small = tools.resizeMap(m, 8, 8);
  assert.equal(small.w, 8);
  assert.equal(small.tiles.length, 64);
  assert.equal(small.tiles[3 * 8 + 3].sprite, "/MapAssets/a/b.png");
  assert.deepEqual(small.npcs.map((n) => n.id), ["elder"]);
  assert.equal(small.spawns.length, 0);
  assert.doesNotThrow(() => maps.parseMapJson(small));
  const big = tools.resizeMap(m, 40, 30, 0);
  assert.equal(big.tiles.length, 1200);
  assert.doesNotThrow(() => maps.parseMapJson(big));
});

test("flood fill stays inside the matching region", () => {
  const m = maps.emptyMap("f", "F", 10, 10, 0);
  for (let y = 0; y < 10; y++) m.tiles[y * 10 + 5].block = 1;
  const left = tools.floodIndices(m, 2, 2, (t) => !t.block);
  assert.ok(left.every((i) => i % 10 < 5));
  assert.equal(left.length, 4 * 8, "x 1-4 by y 1-8");
  assert.deepEqual(tools.floodIndices(m, 5, 5, (t) => !t.block), []);
});

test("packed maps are small and unpack to exactly the same map", () => {
  const m = maps.parseMapJson(village());
  m.tiles[5 * m.w + 5] = { floor: 3, biome: 2, block: 1, decor: 0, sprite: "/MapAssets/a/b.png" };
  const packed = maps.packMap(m);
  assert.equal(packed.tiles, undefined);
  assert.ok(JSON.stringify(packed).length < JSON.stringify(m).length / 2);
  const back = maps.parseMapJson(JSON.parse(JSON.stringify(packed)));
  assert.deepEqual(back.tiles, m.tiles);
  assert.deepEqual(back.quests, m.quests);
  assert.throws(() => maps.parseMapJson({ ...packed, tilesPacked: { palette: [], runs: [3, 1] } }), /damaged/);
  assert.throws(() => maps.parseMapJson({ ...packed, tilesPacked: { ...packed.tilesPacked, runs: [0, 999999] } }), /damaged/);
});

test("named areas survive a round trip and the smallest one wins", () => {
  const m = village();
  m.regions = [
    { id: "land", name: "Hearthmere", kind: "region", tx: 0, ty: 0, tw: 24, th: 16, levelMin: 1, levelMax: 12 },
    { id: "town", name: "Ashford", kind: "city", tx: 2, ty: 2, tw: 6, th: 5, about: "A quiet town." },
    { id: "bad", name: "", kind: "nonsense", tx: 0, ty: 0, tw: 0, th: 0 },
  ];
  const r = maps.parseMapJson(JSON.parse(JSON.stringify(m)));
  assert.deepEqual(r.regions.map((x) => x.id), ["land", "town", "bad"]);
  assert.deepEqual([r.regions[2].name, r.regions[2].kind, r.regions[2].tw], ["Unnamed area", "region", 1], "bad rows are repaired, not fatal");
  assert.equal(maps.regionAt(r, 3, 3).name, "Ashford");
  assert.equal(maps.regionAt(r, 20, 12).name, "Hearthmere");
  const back = maps.parseMapJson(JSON.parse(JSON.stringify(maps.packMap(r))));
  assert.deepEqual(back.regions, r.regions);
});

test("ferry portals on the same map count as a way across the sea", () => {
  const m = maps.emptyMap("isle", "Isle", 30, 12, 0);
  for (let y = 0; y < 12; y++) m.tiles[y * 30 + 15] = { ...m.tiles[y * 30 + 15], floor: 2 };
  m.npcs = [{ id: "far", name: "Far", tx: 24, ty: 6, lines: ["Hi."] }];
  m.spawn = { tx: 4, ty: 6 };
  assert.ok(!tools.reachable(m)[6 * 30 + 24]);
  m.tiles[6 * 30 + 6].portal = { map: "isle", tx: 22, ty: 6 };
  assert.ok(tools.reachable(m)[6 * 30 + 24]);
});

test("the world generator makes a connected world with several continents, cities and quests", async () => {
  const m = gen.generateWorld({ id: "t", name: "T", seed: 42, w: 200, h: 200, continentCount: 3, citiesPerContinent: 2, islands: 3, story: true });
  const r = maps.parseMapJson(JSON.parse(JSON.stringify(maps.packMap(m))));
  assert.equal(r.tiles.length, 200 * 200);
  assert.equal(r.regions.filter((x) => x.kind === "region").length >= 3, true, "continents are named areas");
  assert.ok(r.regions.filter((x) => x.kind === "city").length >= 6);
  assert.ok(r.npcs.length >= 10 && r.quests.length >= 10);
  assert.ok(r.quests.some((q) => q.requires), "the story is a chain");
  const reach = tools.reachable(r);
  for (const n of r.npcs) assert.ok(reach[n.ty * r.w + n.tx], `NPC ${n.name} can be reached`);
  const content = await import(contentUrl);
  const errors = tools.validateMap(r, new Set(content.ITEMS.map((i) => i.id)), new Set()).filter((i) => i.level === "error");
  assert.deepEqual(errors, []);
  assert.equal(JSON.stringify(gen.generateWorld({ id: "t", name: "T", seed: 42, w: 120, h: 120, continentCount: 2 }).tiles.slice(0, 500)), JSON.stringify(gen.generateWorld({ id: "t", name: "T", seed: 42, w: 120, h: 120, continentCount: 2 }).tiles.slice(0, 500)), "same seed, same world");
});

// ---------------------------------------------------------------------------
// World generator: nothing overlaps, nothing is cut out of a mountain, quests are playable
// ---------------------------------------------------------------------------
const rectsHit = (a, b) => a.tx < b.tx + b.tw && b.tx < a.tx + a.tw && a.ty < b.ty + b.th && b.ty < a.ty + a.th;

for (const [seed, cont] of [[1, 4], [77, 5], [2024, 6]]) {
  test(`generated world (seed ${seed}) has no overlapping areas and nothing cut out of mountains`, () => {
    const m = gen.generateWorld({ id: `g${seed}`, name: "G", w: 300, h: 300, seed, continentCount: cont, citiesPerContinent: 3, islands: 4, story: true });
    const areas = m.regions.filter((r) => ["city", "resource", "landmark"].includes(r.kind) && !/Docks|Ferry/.test(r.name));
    for (let i = 0; i < areas.length; i++) for (let j = i + 1; j < areas.length; j++) assert.equal(rectsHit(areas[i], areas[j]), false, `${areas[i].name} overlaps ${areas[j].name}`);
    for (const z of m.zones) for (const a of areas) if (!(z.id.startsWith("ruin-") && a.id.startsWith("ruin-"))) assert.equal(rectsHit(z, a), false, `camp ${z.id} overlaps ${a.name}`);
    // resource areas and landmarks never have wall/mountain tiles inside them
    for (const r of areas.filter((a) => a.kind !== "city")) {
      let walls = 0;
      for (let y = r.ty; y < r.ty + r.th; y++) for (let x = r.tx; x < r.tx + r.tw; x++) { const t = m.tiles[y * m.w + x]; if (t.block && !t.layers && t.floor !== 2) walls++; }
      assert.equal(walls, 0, `${r.name} has ${walls} wall tiles inside it`);
    }
  });
}

test("a generated world's quests and NPCs are all valid, with chains, deliveries and wilderness givers", () => {
  const m = gen.generateWorld({ id: "q", name: "Q", w: 300, h: 300, seed: 5, continentCount: 4, citiesPerContinent: 3, islands: 3, story: true });
  const parsed = maps.parseMapJson(JSON.parse(JSON.stringify(m)));
  const known = new Set(["potion", "big_potion", "ghost_jar", "cleanse_salt", "blue_lantern", "frost_crystal", "embercap", "tide_pearl", "veil_dust", "bone_shard", "lantern_mote", "timber", "ore", "mushroom", "fish"]);
  const errs = tools.validateMap(parsed, known).filter((i) => i.level === "error");
  assert.deepEqual(errs, []);
  assert.ok(parsed.quests.some((q) => q.requires && !q.id.startsWith("story")), "side quests are chained");
  assert.ok(parsed.quests.some((q) => q.steps.some((s) => s.type === "bring")), "there are delivery quests");
  assert.ok(parsed.npcs.some((n) => /^(Hermit|Prospector|Angler)/.test(n.name)), "there are wilderness quest givers");
  const spots = new Set(parsed.npcs.map((n) => `${n.tx},${n.ty}`));
  assert.equal(spots.size, parsed.npcs.length, "no two NPCs share a tile");
});

// ---------------------------------------------------------------------------
// World generator: art exists, worlds vary, every quest can be finished, nodes stand alone
// ---------------------------------------------------------------------------
const questCheck = await import(questCheckUrl);

test("every sprite the world generator can paint exists in public/MapAssets", async () => {
  const { existsSync } = await import("node:fs");
  const all = [];
  const walk = (v) => { if (typeof v === "string") all.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
  walk(gen.ART);
  assert.ok(all.length > 200);
  const missing = all.filter((p) => !existsSync(new URL(`../public${p}`, import.meta.url)));
  assert.deepEqual(missing, []);
});

for (const seed of [11, 404, 9001]) {
  test(`a random main world (seed ${seed}) has every kind of place, playable quests and lone nodes`, () => {
    const m = gen.generateWorld(gen.mainWorldOptions(seed, "M", `m${seed}`));
    const parsed = maps.parseMapJson(JSON.parse(JSON.stringify(maps.packMap(m))));
    assert.deepEqual(questCheck.questIssues(parsed).filter((i) => i.fatal), [], "every quest can be finished");
    const kinds = new Set(m.regions.filter((r) => r.kind === "city").map((r) => r.about.split(" ").slice(0, 3).join(" ")));
    assert.ok(kinds.size >= 6, `settlements vary (${[...kinds].join(" | ")})`);
    assert.ok(m.regions.filter((r) => r.kind === "landmark").length >= 15, "plenty of landmarks");
    const nodes = m.interactables.filter((i) => i.kind === "node");
    assert.ok(nodes.length > 400, "the land is full of resources");
    const at = new Set(nodes.map((n) => `${n.tx},${n.ty}`));
    let touching = 0;
    for (const n of nodes) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) if (at.has(`${n.tx + dx},${n.ty + dy}`)) touching++;
    assert.equal(touching, 0, "no two nodes touch: every node is placed on its own");
    const reach = tools.reachable(parsed);
    for (const n of parsed.npcs) assert.ok(reach[n.ty * parsed.w + n.tx], `${n.name} can be reached`);
  });
}

test("two seeds make two different worlds", () => {
  const a = gen.generateWorld({ id: "a", name: "A", seed: 1, w: 200, h: 200 });
  const b = gen.generateWorld({ id: "b", name: "B", seed: 2, w: 200, h: 200 });
  assert.notEqual(a.regions.filter((r) => r.kind === "region").map((r) => r.name).join(), b.regions.filter((r) => r.kind === "region").map((r) => r.name).join());
});

test("repairQuests fixes a broken hand-made quest instead of leaving it impossible", () => {
  const m = maps.emptyMap("fix", "Fix", 30, 20, 0);
  m.spawn = { tx: 3, ty: 3 };
  m.npcs = [{ id: "a", name: "A", tx: 5, ty: 5, lines: ["Hi."] }, { id: "walled", name: "Walled", tx: 25, ty: 15, lines: ["Help."] }];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) m.tiles[(15 + dy) * 30 + 25 + dx] = { ...m.tiles[0], block: 1 };
  m.zones = [{ id: "z", tx: 10, ty: 10, tw: 5, th: 5, levelMin: 1, levelMax: 2, species: ["kusa"], count: 2, respawn: 30 }];
  m.quests = [
    { id: "q1", name: "Q1", about: "", giver: "a", steps: [{ type: "gather", node: "ore", count: 3 }, { type: "kill", count: 2, species: "yuki" }, { type: "goto", tx: 25, ty: 15, radius: 1 }] },
    { id: "q2", name: "Q2", about: "", giver: "walled", steps: [{ type: "talk", npcId: "a" }] },
    { id: "q3", name: "Q3", about: "", giver: "a", requires: "q2", steps: [{ type: "talk", npcId: "walled" }, { type: "kill", count: 1 }] },
  ];
  assert.ok(questCheck.questIssues(m).some((i) => i.fatal));
  const r = questCheck.repairQuests(m);
  assert.deepEqual(questCheck.questIssues(m).filter((i) => i.fatal), []);
  assert.ok(r.nodesAdded >= 3, "ore nodes were planted for the gather step");
  assert.equal(m.quests.find((q) => q.id === "q1").steps.find((s) => s.type === "kill").species, "kusa");
  assert.ok(!m.quests.some((q) => q.id === "q2"), "a quest whose giver is walled in is removed");
  assert.equal(m.quests.find((q) => q.id === "q3").requires, undefined, "its follow-up no longer waits on it");
});

test("a life world's seed always rebuilds the very same world (so worlds persist by seed)", () => {
  const a = gen.generateWorld(gen.mainWorldOptions(424242, "L", "life-a"));
  const b = gen.generateWorld(gen.mainWorldOptions(424242, "L", "life-a"));
  assert.equal(JSON.stringify(maps.packMap(a)), JSON.stringify(maps.packMap(b)));
});

test("enemy coverage: every reachable stretch of a generated world has a camp nearby", () => {
  for (const seed of [11, 3333]) {
    const map = gen.generateWorld(gen.mainWorldOptions(seed, "Cover", `cover-${seed}`));
    const R = gen.COVERAGE_RADIUS + 8;
    const centres = map.zones.map((z) => [z.tx + z.tw / 2, z.ty + z.th / 2]);
    let open = 0, far = 0;
    for (let y = 0; y < map.h; y += 4) for (let x = 0; x < map.w; x += 4) {
      const t = map.tiles[y * map.w + x];
      if (!t || t.block || t.floor === 1 || t.floor === 2 || t.floor === 11) continue;
      open++;
      if (!centres.some(([cx, cy]) => (cx - x) ** 2 + (cy - y) ** 2 <= R * R)) far++;
    }
    assert.ok(far / open < 0.1, `seed ${seed}: ${Math.round((far / open) * 100)}% of open ground has no camp nearby`);
    assert.ok(maps.expandZones(map).length >= 400, `seed ${seed} spawns plenty of foes`);
    // Camps never overlap each other.
    for (let i = 0; i < map.zones.length; i++) for (let j = i + 1; j < map.zones.length; j++) assert.ok(!rectsHit(map.zones[i], map.zones[j]), `${map.zones[i].id} overlaps ${map.zones[j].id}`);
    // Running it again on a covered map adds nothing.
    assert.equal(gen.ensureEnemyCoverage(map), 0);
  }
});

test("enemy coverage tops up a sparse cached world without touching towns", () => {
  const map = gen.generateWorld(gen.mainWorldOptions(222, "Sparse", "sparse-222"));
  const towns = map.regions.filter((r) => r.kind === "city");
  map.zones = map.zones.slice(0, 5);
  const added = gen.ensureEnemyCoverage(map);
  assert.ok(added > 50, `a stripped world gets camps back (${added})`);
  for (const z of map.zones.slice(5)) {
    assert.ok(z.id.startsWith("cover-"));
    assert.ok(z.species.length > 0 && z.levelMin >= 1 && z.levelMax >= z.levelMin);
    for (const t of towns) assert.ok(!rectsHit(z, t), `${z.id} sits in ${t.name}`);
  }
  assert.ok(map.zones.length <= maps.LIMITS.zones);
});
