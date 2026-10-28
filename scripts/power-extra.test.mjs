import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./lib/ts-module.mjs";

// Direct .ts imports only work under --experimental-strip-types, and even then Node cannot resolve
// building.ts's own extensionless `./tile-atlas` import — which is why this file was failing and,
// being absent from the npm test script, failing unnoticed. The shared loader handles both.
const px = await loadTs(import.meta.url, "../src/game/power-extra.ts");
const bld = await loadTs(import.meta.url, "../src/game/building.ts");

const port = (kind, n, key = `${Math.random()}`) => ({ kind, key, n });
const total = (o) => Object.values(o).reduce((a, v) => a + v, 0);

test("every new Power piece is a real build piece, grouped, hotkeyed and gated to TURBZ + New Textures", () => {
  for (const id of px.POWER_EXTRA_KINDS) {
    assert.ok(bld.BUILD_PIECES[id], `${id} has no build piece`);
    assert.ok(bld.BUILD_GROUPS.some((g) => g.id.startsWith("power") && g.pieces.includes(id)), `${id} missing from every Power group`);
    assert.ok(bld.BUILD_HOTKEY_ORDER.includes(id), `${id} has no hotkey slot`);
    assert.ok(bld.TURBZ_ONLY_PIECES.has(id) && bld.NEWTEX_ONLY_PIECES.has(id), `${id} is not gated`);
    assert.ok(Object.keys(bld.BUILD_PIECES[id].cost).length > 0);
  }
});

test("the LogBurning Generator is weaker and slower than the HellStone Generator (10 Power per 5 s)", () => {
  assert.ok(px.LOGBURN_POWER < 10, "less Power per burn");
  assert.ok(px.LOGBURN_SECONDS > 5, "slower burn");
  assert.ok(px.LOGBURN_POWER / px.LOGBURN_SECONDS < 10 / 5, "less Power per second");
});

test("BlockGenerator and BlockBreaker act once per second", () => {
  assert.equal(px.BLOCK_MACHINE_SECONDS, 1);
});

test("sanitizePowerExtra drops junk, keeps object identity, clamps and dedupes", () => {
  const good = { kind: "blockgen", map: "m", tx: 5, ty: 6, dir: 9, buf: { timber: 9999, junk: -3 }, mat: "lava" };
  const list = [good, { kind: "pipe", map: "m", tx: 5, ty: 6 }, { kind: "nope", map: "m", tx: 1, ty: 1 }, { kind: "pipe", map: "m", tx: -1, ty: 2 },
    null, 4, { kind: "pipe", map: 7, tx: 1, ty: 1 }, { kind: "logburner", map: "m", tx: 1, ty: 1, fuel: 1e9 }, { kind: "capacitor", map: "m", tx: 2, ty: 2, power: -5 }];
  const out = px.sanitizePowerExtra(list);
  assert.equal(out.length, 3);
  assert.equal(out[0], good, "same object");
  assert.equal(good.dir, 1, "an out-of-range facing wraps (9 % 4), it is not clamped");
  const negative = { kind: "blockgen", map: "m", tx: 9, ty: 9, dir: -1 };
  px.sanitizePowerExtra([negative]);
  assert.equal(negative.dir, 3, "a negative facing wraps to the other side");
  assert.equal(good.mat, "wood");
  assert.deepEqual(good.buf, { timber: px.MACHINE_BUF_MAX });
  assert.equal(good.on, true);
  assert.equal(out[1].fuel, px.LOGBURN_FUEL_MAX);
  assert.equal(out[2].power, 0);
  assert.deepEqual(px.sanitizePowerExtra("nope"), []);
  assert.deepEqual(px.sanitizePowerExtra(undefined), []);
});

test("battery cap: a Capacitor holds 500, anything else 100", () => {
  assert.equal(px.batteryCap({ kind: "capacitor" }), 500);
  assert.equal(px.batteryCap({}), 100);
});

test("pipe shapes follow which sides connect", () => {
  assert.equal(px.pipeShapeName(0), "lonely");
  for (const m of [1, 2, 4, 8]) assert.equal(px.pipeShapeName(m), "end");
  assert.equal(px.pipeShapeName(5), "straight");
  assert.equal(px.pipeShapeName(10), "straight");
  for (const m of [3, 6, 12, 9]) assert.equal(px.pipeShapeName(m), "corner");
  for (const m of [7, 14, 13, 11]) assert.equal(px.pipeShapeName(m), "tee");
  assert.equal(px.pipeShapeName(15), "cross");
});

test("pipeRuns joins pipes edge to edge (not diagonally) and finds the machines they touch", () => {
  const chest = port("chest", {}, "5,1");
  const gen = port("hellgen", { ore: 0 }, "5,3");
  const lonely = port("logburner", { fuel: 0 }, "9,9");
  const ports = new Map([[chest.key, chest], [gen.key, gen], [lonely.key, lonely]]);
  const runs = px.pipeRuns(["4,1", "4,2", "4,3", "8,9", "20,20", "21,21"], ports);
  assert.equal(runs.length, 4, "diagonal pipes stay separate");
  const bent = runs.find((r) => r.pipes.includes("4,2"));
  assert.equal(bent.pipes.length, 3);
  assert.deepEqual(bent.ports.map((p) => p.key).sort(), ["5,1", "5,3"]);
  assert.deepEqual(runs.find((r) => r.pipes.includes("8,9")).ports.map((p) => p.key), ["9,9"]);
});

test("Duplicator copies flow into the chest, one per step, and the original stays put", () => {
  const dup = port("dup", { item: "ghost_jar", seed: true, stored: 3 });
  const chest = port("chest", {});
  const bag = {};
  assert.equal(px.pipeStep([dup, chest], bag).moved, 1);
  assert.equal(dup.n.stored, 2);
  assert.deepEqual(bag, { ghost_jar: 1 });
  px.pipeStep([dup, chest], bag); px.pipeStep([dup, chest], bag);
  assert.equal(dup.n.stored, 0);
  assert.equal(dup.n.item, "ghost_jar", "the loaded original keeps its item id");
  assert.equal(px.pipeStep([dup, chest], bag).moved, 0, "nothing left to move");
  assert.equal(bag.ghost_jar, 3);
  const d2 = port("dup", { item: "wire", seed: false, stored: 1 });
  px.pipeStep([d2, chest], bag);
  assert.equal(d2.n.item, "");
});

test("a chest feeds Hell Ore to a HellStone Generator and Logs to a LogBurner, and ignores everything else", () => {
  const chest = port("chest", {});
  const gen = port("hellgen", { ore: 0, t: 3 });
  const burner = port("logburner", { fuel: 0, t: 3 });
  const bag = { hell_ore: 2, timber: 2, dirt: 50, kyo: 9 };
  for (let i = 0; i < 6; i++) px.pipeStep([chest, gen, burner], bag);
  assert.equal(gen.n.ore, 2);
  assert.equal(burner.n.fuel, 2);
  assert.equal(gen.n.t, 0, "a fresh load restarts the burn timer");
  assert.deepEqual(bag, { dirt: 50, kyo: 9 }, "dirt and kyo never move");
});

test("chest to generator never loops back into the chest and never creates or loses items", () => {
  const chest = port("chest", {});
  const gen = port("hellgen", { ore: 0 });
  const bag = { hell_ore: 10 };
  const before = total(bag);
  for (let i = 0; i < 50; i++) px.pipeStep([chest, gen], bag);
  assert.equal(gen.n.ore + total(bag), before);
  assert.equal(gen.n.ore, 10);
});

test("generators stop taking ore at the pipe cap", () => {
  const chest = port("chest", {});
  const gen = port("hellgen", { ore: px.PIPE_FEED_CAP - 1 });
  const bag = { hell_ore: 5 };
  for (let i = 0; i < 10; i++) px.pipeStep([chest, gen], bag);
  assert.equal(gen.n.ore, px.PIPE_FEED_CAP);
  assert.equal(bag.hell_ore, 4);
});

test("two generators on one run are fed evenly", () => {
  const chest = port("chest", {});
  const a = port("hellgen", { ore: 0 }, "a");
  const b = port("hellgen", { ore: 0 }, "b");
  const bag = { hell_ore: 10 };
  for (let i = 0; i < 10; i++) px.pipeStep([chest, a, b], bag);
  assert.equal(a.n.ore, 5);
  assert.equal(b.n.ore, 5);
});

test("machines are fed before the chest takes the overflow", () => {
  const dup = port("dup", { item: "hell_ore", seed: true, stored: 3 });
  const chest = port("chest", {});
  const gen = port("hellgen", { ore: px.PIPE_FEED_CAP - 1 });
  const bag = {};
  for (let i = 0; i < 3; i++) px.pipeStep([dup, chest, gen], bag);
  assert.equal(gen.n.ore, px.PIPE_FEED_CAP);
  assert.deepEqual(bag, { hell_ore: 2 });
});

test("a Rock Miner hauls into the chest; a BlockGenerator only accepts the block it builds", () => {
  const breaker = port("rockminer", { buf: { timber: 2, rock_ore: 1 } });
  const gen = port("blockgen", { mat: "wood", buf: {} });
  const chest = port("chest", {});
  const bag = {};
  for (let i = 0; i < 4; i++) px.pipeStep([breaker, gen, chest], bag);
  assert.equal(gen.n.buf.timber, 2, "wood generator takes the logs");
  assert.deepEqual(bag, { rock_ore: 1 }, "rock ore goes to the chest");
  assert.deepEqual(breaker.n.buf, {});
  gen.n.mat = "stone";
  assert.equal(px.portRoom(gen, "timber"), false);
  assert.equal(px.portRoom(gen, "rock_ore"), true);
});

test("a wall engine (BlockGenerator + Rock Miner + pipe) conserves material", () => {
  const breaker = port("rockminer", { buf: { timber: 5 } });
  const gen = port("blockgen", { mat: "wood", buf: {} });
  for (let i = 0; i < 20; i++) px.pipeStep([breaker, gen], {});
  assert.equal(gen.n.buf.timber, 5);
  assert.equal(px.bufTotal(breaker.n.buf), 0);
});

test("a run with nothing to hand over moves nothing", () => {
  const gen = port("hellgen", { ore: 0 });
  const burner = port("logburner", { fuel: 0 });
  assert.equal(px.pipeStep([gen, burner], {}).moved, 0);
  assert.equal(px.pipeStep([], {}).moved, 0);
});
