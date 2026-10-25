/**
 * The per-frame helpers must behave exactly like the expressions they replaced.
 *
 * The mob, draw and effect loops used to prune with `.filter()`, look things up with `.find()` and
 * rank gear with `indexOf` over a freshly built array — every frame, for every actor. Those were
 * swapped for in-place pruning and lookup tables. The point of these tests is that the swap stayed
 * a pure speed change: same answers, same order, including for misses and edge cases.
 */
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

const listUtil = await import(moduleUrl("../src/game/list-util.ts"));
const status = await import(moduleUrl("../src/game/status-rules.ts"));
const kitsUrl = moduleUrl("../src/game/class-kits.ts");
const content = await import(moduleUrl("../src/game/content.ts", {
  "./classes": moduleUrl("../src/game/classes.ts", { "./class-kits": kitsUrl }),
  "./overmax": moduleUrl("../src/game/overmax.ts"),
  "./class-kits": kitsUrl,
}));

const randomLives = (n) =>
  Array.from({ length: n }, (_, i) => ({ life: Math.random() < 0.4 ? -Math.random() : Math.random(), seq: i }));

test("pruneByLife drops spent entries exactly like filter(life > 0)", () => {
  for (let i = 0; i < 400; i++) {
    const list = randomLives((Math.random() * 30) | 0);
    assert.deepEqual(listUtil.pruneByLife(list.slice()), list.filter((e) => e.life > 0));
  }
});

test("pruneByLife with a cap keeps the newest, like filter().slice(-cap)", () => {
  for (let i = 0; i < 400; i++) {
    const list = randomLives((Math.random() * 60) | 0);
    const cap = 1 + ((Math.random() * 20) | 0);
    assert.deepEqual(listUtil.pruneByLife(list.slice(), cap), list.filter((e) => e.life > 0).slice(-cap), `cap ${cap}`);
  }
});

test("pruneByLife compacts in place rather than replacing the array", () => {
  const list = randomLives(24);
  assert.equal(listUtil.pruneByLife(list), list, "must hand back the same array object");
  const empty = [];
  assert.deepEqual(listUtil.pruneByLife(empty), []);
});

test("gatherInto fills a reused scratch array and reports how much of it is live", () => {
  const scratch = [];
  const keep = (e) => e.life > 0.2;
  for (let i = 0; i < 400; i++) {
    const list = randomLives((Math.random() * 40) | 0);
    const expected = list.filter(keep);
    const n = listUtil.gatherInto(list, keep, scratch);
    assert.equal(n, expected.length);
    assert.deepEqual(scratch.slice(0, n), expected);
    // Trimmed, so a long frame cannot keep last frame's entries alive behind the live window.
    assert.equal(scratch.length, n);
  }
});

test("hasStatus answers the same as some(id matches && t > 0)", () => {
  const ids = ["burn", "root", "sleep", "soak", "silence", "expose"];
  for (let i = 0; i < 600; i++) {
    const list = Array.from({ length: (Math.random() * 6) | 0 }, () => ({
      id: ids[(Math.random() * ids.length) | 0],
      t: Math.random() < 0.3 ? -Math.random() : Math.random() * 3,
    }));
    for (const id of ids) assert.equal(status.hasStatus(list, id), list.some((s) => s.id === id && s.t > 0), id);
  }
  assert.equal(status.hasStatus([], "burn"), false);
});

test("isImmune answers the same as the scan it replaced", () => {
  for (const id of ["root", "sleep", "silence"]) {
    const list = [{ id: status.immuneId(id), t: 2 }, { id: "burn", t: 1 }];
    assert.equal(status.isImmune(list, id), true);
    assert.equal(status.isImmune([{ id: status.immuneId(id), t: -1 }], id), false, "an expired immunity does not count");
    assert.equal(status.isImmune([], id), false);
  }
});

test("tickStatuses ages and prunes as before, and avoids a copy when nothing ran out", () => {
  for (let i = 0; i < 500; i++) {
    const list = Array.from({ length: (Math.random() * 6) | 0 }, () => ({
      id: ["burn", "root", "soak", "sleep"][(Math.random() * 4) | 0],
      t: 0.2 + Math.random() * 2,
    }));
    const reference = list.map((s) => ({ ...s }));
    const dt = Math.random() * 0.5;
    const out = status.tickStatuses(list, dt);

    // What the old filter-every-frame version produced: age, drop the spent, then grant immunity
    // for any hard crowd control that just ran out.
    for (const s of reference) s.t -= dt;
    const expired = reference.filter((s) => s.t <= 0 && status.HARD_CC[s.id]);
    const expected = reference.filter((s) => s.t > 0);
    for (const e of expired) {
      const id = status.immuneId(e.id);
      const already = expected.find((s) => s.id === id);
      if (already) already.t = Math.max(already.t, status.HARD_CC[e.id].immune);
      else expected.push({ id, t: status.HARD_CC[e.id].immune });
    }
    assert.deepEqual(
      out.map((s) => [s.id, s.t.toFixed(6)]),
      expected.map((s) => [s.id, s.t.toFixed(6)]),
    );
    if (reference.every((s) => s.t > 0)) assert.equal(out, list, "same array back when nothing expired");
  }
});

test("qualityRank ranks gear exactly like the array-and-indexOf it replaced", () => {
  const literal = ["worn", "common", "fine", "rare", "epic", "legendary"];
  assert.deepEqual(content.QUALITIES.map((q) => q.id), literal, "QUALITIES order still matches the old literal");
  for (const q of [...literal, "bogus", "", null, undefined]) {
    assert.equal(content.qualityRank(q), literal.indexOf(q), String(q));
  }
});

test("raceIndex gives the same skin index as RACES.findIndex", () => {
  for (const id of [...content.RACES.map((r) => r.id), "nope", "", null, undefined]) {
    assert.equal(content.raceIndex(id), content.RACES.findIndex((r) => r.id === id), String(id));
  }
});

test("the draw-loop lookup tables match the .find() calls they replaced, and have no collisions", () => {
  for (const r of content.RACES) assert.equal(content.RACE_BY_ID[r.id], r);
  for (const n of content.NPCS) assert.equal(content.NPC_BY_ID[n.id], n);
  assert.equal(content.RACE_BY_ID.nope, undefined);
  assert.equal(content.NPC_BY_ID.nope, undefined);
  assert.equal(Object.keys(content.RACE_BY_ID).length, content.RACES.length, "race ids are unique");
  assert.equal(Object.keys(content.NPC_BY_ID).length, content.NPCS.length, "NPC ids are unique");
});

test("removing the legacy gear rule did not take any live export with it", () => {
  assert.equal(content.stretchGearLevel, undefined, "the pre-balance-patch rule is gone");
  for (const name of ["rollGear", "rollInnate", "QUALITIES", "RACES", "NPCS", "MONSTER_BY_ID", "clampGearLevel"]) {
    assert.ok(name in content, `${name} must still be exported`);
  }
});
