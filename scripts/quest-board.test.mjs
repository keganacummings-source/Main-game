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

test("a board has ten distinct contracts, none of the same kind and target", () => {
  const st = qb.ensureBoard(host(), T0);
  assert.equal(st.quests.length, qb.BOARD_SLOTS);
  const keys = st.quests.map((q) => `${q.kind}:${q.target ?? ""}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(new Set(st.quests.map((q) => q.id)).size, st.quests.length);
  for (const q of st.quests) {
    assert.ok(q.need >= 1 && q.rewardKyo >= 5 && q.name && q.about, JSON.stringify(q));
    if (q.kind === "kill_type") assert.ok(content.TYPES[q.target], `bad type ${q.target}`);
    if (q.kind === "kill_species") assert.ok(content.MONSTERS.some((m) => m.id === q.target), `bad species ${q.target}`);
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

test("boards are actually random: many windows produce many different contracts", () => {
  const seen = new Set();
  const kinds = new Set();
  for (let i = 0; i < 40; i++) {
    for (const q of qb.ensureBoard(host(), T0 + i * qb.BOARD_PERIOD_MS).quests) {
      seen.add(q.about);
      kinds.add(q.kind);
    }
  }
  assert.ok(seen.size > 60, `only ${seen.size} distinct contracts across 40 boards`);
  assert.ok(kinds.size >= 8, `only ${kinds.size} kinds appeared`);
});

test("difficulty scales with level, bosses wait for level 5, and rewards are paid in proportion", () => {
  const avg = (level, field) => {
    let sum = 0, n = 0;
    for (let i = 0; i < 30; i++) {
      for (const q of qb.ensureBoard(host({ level }), T0 + i * qb.BOARD_PERIOD_MS).quests) { sum += q[field]; n++; }
    }
    return sum / n;
  };
  assert.ok(avg(40, "need") > avg(1, "need"));
  assert.ok(avg(40, "rewardKyo") > avg(1, "rewardKyo") * 2);
  for (let i = 0; i < 60; i++) {
    const bosses = qb.ensureBoard(host({ level: 3 }), T0 + i * qb.BOARD_PERIOD_MS).quests.filter((q) => q.kind === "boss");
    assert.equal(bosses.length, 0);
  }
  let sawBoss = false;
  for (let i = 0; i < 60 && !sawBoss; i++) {
    sawBoss = qb.ensureBoard(host({ level: 20 }), T0 + i * qb.BOARD_PERIOD_MS).quests.some((q) => q.kind === "boss");
  }
  assert.ok(sawBoss);
});

test("kills advance the right contracts; finishing one pays out and posts a replacement", () => {
  const h = host({ level: 8 });
  const st = qb.ensureBoard(h, T0);
  const target = st.quests.find((q) => q.kind === "kill_species");
  assert.ok(target, "expected a species contract on this board");
  qb.acceptContract(st, target.id);

  // wrong species / wrong event does nothing
  assert.equal(qb.applyBoardEvent(h, st, "kills", { species: "not-this", type: "x" }), null);
  assert.equal(qb.applyBoardEvent(h, st, "ore"), null);

  let last = null;
  for (let i = 0; i < target.need; i++) last = qb.applyBoardEvent(h, st, "kills", { species: target.target, type: "x" });
  assert.equal(last.complete, true);
  assert.equal(st.activeId, null);
  assert.equal(st.quests.length, qb.BOARD_SLOTS, "board is topped back up to ten");
  assert.ok(!st.quests.some((q) => q.id === target.id), "finished contract is gone");
  const keys = st.quests.map((q) => `${q.kind}:${q.target ?? ""}`);
  assert.equal(new Set(keys).size, keys.length, "replacement does not duplicate a contract");
});

test("generic kill, element, boss and gathering contracts match only what they should", () => {
  const h = host({ level: 30 });
  const mk = (kind, target, need = 2) => ({ id: "t", name: "t", about: "t", kind, target, need, rewardKyo: 10, tier: "normal" });
  const run = (q, kind, detail) => {
    const st = { period: 1, rerolls: 0, quests: [q], activeId: q.id, progress: {}, serial: 0 };
    return qb.applyBoardEvent(h, st, kind, detail);
  };
  assert.ok(run(mk("kills"), "kills", { species: "a", type: "fire" }));
  assert.ok(run(mk("kill_type", "fire"), "kills", { type: "fire" }));
  assert.equal(run(mk("kill_type", "fire"), "kills", { type: "water" }), null);
  assert.ok(run(mk("boss"), "kills", { boss: true }));
  assert.equal(run(mk("boss"), "kills", { boss: false }), null);
  for (const k of ["ore", "tree", "shroom", "fish", "catch", "craft"]) {
    assert.ok(run(mk(k), k), k);
    assert.equal(run(mk(k), "kills", { species: "a", type: "fire" }), null, `${k} must not advance on kills`);
  }
});

test("an accepted contract and its progress survive the 30-minute refresh and a reroll resets the rest", () => {
  const h = host({ level: 6 });
  const st = qb.ensureBoard(h, T0);
  const q = st.quests.find((x) => x.need >= 2) ?? st.quests[0];
  qb.acceptContract(st, q.id);
  qb.applyBoardEvent(h, st, q.kind, { species: q.target, type: q.target });
  const progress = st.progress[q.id] ?? 0;

  const next = qb.ensureBoard(h, T0 + qb.BOARD_PERIOD_MS);
  assert.equal(next.quests.length, qb.BOARD_SLOTS);
  if (progress > 0) {
    assert.equal(next.activeId, q.id);
    assert.equal(next.progress[q.id], progress);
    assert.ok(next.quests.some((x) => x.id === q.id));
  }

  const before = next.quests.map((x) => x.about).join("|");
  const rerolled = qb.rerollBoard(h, T0 + qb.BOARD_PERIOD_MS);
  assert.equal(rerolled.activeId, null);
  assert.notEqual(rerolled.quests.map((x) => x.about).join("|"), before);
  assert.ok(qb.rerollCost(20) > qb.rerollCost(1));
});

test("old or damaged saves without a board are given a fresh one", () => {
  for (const bad of [undefined, null, {}, { period: "x" }, { period: 1, quests: "no", progress: {} }]) {
    const h = host({ board: bad });
    assert.equal(qb.ensureBoard(h, T0).quests.length, qb.BOARD_SLOTS);
  }
});
