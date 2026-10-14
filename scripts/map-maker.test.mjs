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
const contentUrl = moduleUrl("../src/game/content.ts", { "./classes": moduleUrl("../src/game/classes.ts") });
const atlasStub = `data:text/javascript;base64,${Buffer.from("export const findAtlasTile=()=>null;").toString("base64")}`;
const formatUrl = moduleUrl("../src/game/map-format.ts", { "./content": contentUrl, "./tile-atlas": atlasStub });
const maps = await import(formatUrl);
const quests = await import(moduleUrl("../src/game/map-quests.ts"));
const tools = await import(moduleUrl("../src/game/map-tools.ts", { "./content": contentUrl, "./map-format": formatUrl }));

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
