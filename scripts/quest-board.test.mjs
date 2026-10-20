import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

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
const contentUrl = moduleUrl("../src/game/content.ts", { "./classes": classesUrl, "./overmax": moduleUrl("../src/game/overmax.ts"), "./class-kits": kitsUrl });
const qb = await import(moduleUrl("../src/game/quest-board.ts", { "./content": contentUrl }));
const content = await import(contentUrl);

const host = (over = {}) => ({ name: "Mina", seed: 4242, level: 1, kyo: 0, ...over });
const T0 = 1_800_000_000_000;

const allSteps = (st) => st.quests.flatMap((q) => q.steps);
const boards = (h, n) => Array.from({ length: n }, (_, i) => qb.ensureBoard({ ...h, board: undefined }, T0 + i * qb.BOARD_PERIOD_MS));

test("a board has ten distinct contracts with 1-3 real objectives and a real payout", () => {
  const st = qb.ensureBoard(host({ level: 30 }), T0);
  assert.equal(st.version, qb.BOARD_VERSION);
  assert.equal(st.quests.length, qb.BOARD_SLOTS);
  assert.equal(new Set(st.quests.map((q) => q.id)).size, st.quests.length);
  for (const q of st.quests) {
    assert.ok(q.steps.length >= 1 && q.steps.length <= 3, JSON.stringify(q));
    assert.ok(q.name && q.about && q.reward.kyo >= 10 && q.reward.xpShare > 0, JSON.stringify(q));
    for (const s of q.steps) {
      assert.ok(s.need >= 1);
      if (s.kind === "kill_type") assert.ok(content.TYPES[s.target], `bad type ${s.target}`);
      if (s.kind === "kill_species") assert.ok(content.MONSTERS.some((m) => m.id === s.target), `bad species ${s.target}`);
    }
    assert.deepEqual(new Set(q.steps.map((s) => `${s.kind}:${s.target ?? ""}`)).size, q.steps.length, "no duplicate objectives");
  }
});

test("the same player in the same window always sees the same board; windows and players differ", () => {
  const a = qb.ensureBoard(host(), T0).quests.map((q) => q.id + q.about);
  const b = qb.ensureBoard(host(), T0 + 60_000).quests.map((q) => q.id + q.about);
  assert.deepEqual(a, b);
  const later = qb.ensureBoard(host(), T0 + qb.BOARD_PERIOD_MS).quests.map((q) => q.about);
  assert.notDeepEqual(later, qb.ensureBoard(host(), T0).quests.map((q) => q.about));
  const other = qb.ensureBoard(host({ name: "Rook" }), T0).quests.map((q) => q.about);
  assert.notDeepEqual(other, qb.ensureBoard(host(), T0).quests.map((q) => q.about));
});

test("boards are varied: many kinds, multi-objective contracts, conditions and every tier", () => {
  const kinds = new Set(), tiers = new Set(), conds = new Set();
  let multi = 0;
  for (const st of boards(host({ level: 40 }), 40)) for (const q of st.quests) {
    tiers.add(q.tier);
    if (q.steps.length > 1) multi++;
    for (const s of q.steps) { kinds.add(s.kind); if (s.cond) conds.add(s.cond); }
  }
  assert.ok(kinds.size >= 12, `only ${kinds.size} kinds`);
  assert.deepEqual([...tiers].sort(), ["easy", "elite", "hard", "legend", "normal"]);
  assert.ok(conds.has("night") && conds.has("dungeon"));
  assert.ok(multi > 120, `only ${multi} multi-objective contracts`);
});

test("level gates: no bosses before 5, dungeons before 8, witches before 10, legends before 15", () => {
  for (const st of boards(host({ level: 3 }), 40)) for (const q of st.quests) {
    assert.ok(!q.steps.some((s) => ["boss", "dungeon", "witch"].includes(s.kind)));
    assert.notEqual(q.tier, "legend");
  }
});

test("rewards are worth it: kyo scales with level and difficulty, top tiers pay gear and enchants", () => {
  const avgKyo = (level, tier) => {
    let sum = 0, n = 0;
    for (const st of boards(host({ level }), 40)) for (const q of st.quests) if (!tier || q.tier === tier) { sum += q.reward.kyo; n++; }
    return sum / Math.max(1, n);
  };
  assert.ok(avgKyo(100) > avgKyo(10) * 5, "pay grows with level");
  assert.ok(avgKyo(60, "legend") > avgKyo(60, "easy") * 6, "legend pays far more than easy");
  // An easy contract is worth at least ten kills; a legend at least a hundred.
  assert.ok(avgKyo(60, "easy") >= qb.boardKillKyo(60) * 10);
  assert.ok(avgKyo(60, "legend") >= qb.boardKillKyo(60) * 100);
  for (const st of boards(host({ level: 50 }), 20)) for (const q of st.quests) {
    if (q.tier === "hard") assert.equal(q.reward.gear, "rare");
    if (q.tier === "elite") { assert.equal(q.reward.gear, "epic"); assert.equal(q.reward.enchants, 1); }
    if (q.tier === "legend") { assert.equal(q.reward.gear, "legendary"); assert.equal(q.reward.enchants, 2); }
    assert.ok(qb.rewardLines(q.reward).length >= 2);
  }
});

test("up to three contracts at once; every matching objective advances; finishing pays out and posts a replacement", () => {
  const h = host({ level: 30 });
  const st = qb.ensureBoard(h, T0);
  const q = { id: "x1", name: "Test", about: "", tier: "normal", kind: "kills", need: 3, rewardKyo: 50, reward: { kyo: 50, xpShare: 0.1 },
    steps: [{ kind: "kill_type", target: "fire", need: 2 }, { kind: "ore", need: 1 }] };
  st.quests[0] = q;
  assert.ok(qb.acceptContract(st, "x1"));
  assert.equal(qb.acceptContract(st, "x1"), null, "cannot take the same contract twice");
  qb.acceptContract(st, st.quests[1].id); qb.acceptContract(st, st.quests[2].id);
  assert.equal(st.active.length, 3);
  assert.equal(qb.acceptContract(st, st.quests[3].id), null, "a fourth is refused");
  assert.equal(qb.applyBoardEvent(h, st, "kills", { type: "water" }).filter((x) => x.quest.id === "x1").length, 0);
  qb.applyBoardEvent(h, st, "kills", { type: "fire" });
  qb.applyBoardEvent(h, st, "kills", { type: "fire" });
  qb.applyBoardEvent(h, st, "kills", { type: "fire" }); // objective already full: no overflow
  assert.deepEqual(st.progress.x1, [2, 0]);
  const done = qb.applyBoardEvent(h, st, "ore").find((x) => x.quest.id === "x1");
  assert.equal(done.complete, true);
  assert.ok(!st.active.includes("x1") && !st.quests.some((x) => x.id === "x1"));
  assert.equal(st.quests.length, qb.BOARD_SLOTS, "board is topped back up to ten");
  assert.equal(st.done, 1);
  assert.ok(qb.abandonContract(st, st.active[0]));
  assert.equal(st.active.length, 1);
});

test("objective matching: elites, bosses, dungeons, witches and conditions", () => {
  const m = qb.stepMatches;
  assert.ok(m({ kind: "elite", need: 1 }, "kills", { rarity: 2 }));
  assert.ok(!m({ kind: "elite", need: 1 }, "kills", { rarity: 1 }));
  assert.ok(m({ kind: "boss", need: 1 }, "kills", { boss: true }));
  assert.ok(!m({ kind: "dungeon", need: 1 }, "kills", { boss: true }));
  assert.ok(m({ kind: "dungeon", need: 1 }, "kills", { boss: true, dungeonBoss: true }));
  assert.ok(m({ kind: "witch", need: 1 }, "kills", { witch: true }));
  assert.ok(!m({ kind: "kills", need: 1, cond: "night" }, "kills", { night: false }));
  assert.ok(m({ kind: "kills", need: 1, cond: "night" }, "kills", { night: true }));
  assert.ok(!m({ kind: "kills", need: 1, cond: "dungeon" }, "kills", {}));
  for (const k of ["ore", "tree", "shroom", "fish", "catch", "craft"]) {
    assert.ok(m({ kind: k, need: 1 }, k), k);
    assert.ok(!m({ kind: k, need: 1 }, "kills", { type: "fire" }), `${k} must not advance on kills`);
  }
});

test("accepted contracts and their progress survive the refresh and a reroll", () => {
  const h = host({ level: 12 });
  const st = qb.ensureBoard(h, T0);
  const q = st.quests[0];
  qb.acceptContract(st, q.id);
  st.progress[q.id][0] = 1;
  const next = qb.ensureBoard(h, T0 + qb.BOARD_PERIOD_MS);
  assert.ok(next.active.includes(q.id) && next.progress[q.id][0] === 1 && next.quests.length === qb.BOARD_SLOTS);
  const rerolled = qb.rerollBoard(h, T0 + qb.BOARD_PERIOD_MS);
  assert.ok(rerolled.active.includes(q.id), "a reroll keeps what you accepted");
  assert.ok(qb.rerollCost(60) > qb.rerollCost(1));
});

test("old (v1) or damaged boards are replaced with a fresh one", () => {
  const v1 = { period: 1, rerolls: 0, quests: [{ id: "a", kind: "kills", need: 3, rewardKyo: 10, tier: "easy", name: "a", about: "a" }], activeId: "a", progress: { a: 1 }, serial: 0 };
  for (const bad of [undefined, null, {}, { period: "x" }, v1]) {
    const h = host({ board: bad });
    const st = qb.ensureBoard(h, T0);
    assert.equal(st.quests.length, qb.BOARD_SLOTS);
    assert.equal(st.version, qb.BOARD_VERSION);
  }
});
