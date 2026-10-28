/**
 * Cutting playable ground out of the chart.
 *
 * The point of regions is that a 2500 x 2500 world never exists as objects at
 * once. So these check the two things that would quietly undo that: a region
 * must stay small, and the cache must actually drop what it is done with.
 *
 * The rest is making sure what comes out is a real `WorldData` — the engine,
 * collision and renderer are handed exactly what they always were.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./lib/ts-module.mjs";

const wc = await loadTs(import.meta.url, "../src/game/world-chart.ts");
const ch = await loadTs(import.meta.url, "../src/game/world-chunks.ts");
const tex = await loadTs(import.meta.url, "../src/game/tex-world.ts");

const chart = wc.generateChart({ seed: 2026, w: 1000, h: 1000, continents: 3, islands: 6 });
const allowed = new Set(tex.TEX_FILES);

test("a region is a normal WorldData the rest of the game understands", () => {
  const r = ch.buildRegion(chart, 1, 1);
  assert.equal(r.w, ch.REGION);
  assert.equal(r.h, ch.REGION);
  assert.equal(r.tiles.length, r.w * r.h);
  assert.ok(Array.isArray(r.spawns));
  assert.equal(r.cache, null);
  assert.equal(r.originX, ch.REGION);
  assert.equal(r.originY, ch.REGION);
  for (const t of r.tiles) {
    assert.ok(Number.isInteger(t.floor) && Number.isInteger(t.block), "a tile is missing its basics");
    assert.ok(t.block === 0 || t.block === 1, `block should be 0 or 1, got ${t.block}`);
  }
});

test("a region only ever uses New Texture art", () => {
  for (const [rx, ry] of [[0, 0], [1, 1], [2, 2], [3, 1]]) {
    for (const t of ch.buildRegion(chart, rx, ry).tiles) {
      assert.ok(t.sprite && allowed.has(t.sprite), `${rx},${ry}: ${t.sprite} is not New Texture art`);
      for (const l of t.layers ?? []) assert.ok(allowed.has(l), `${rx},${ry}: layer ${l} is not New Texture art`);
    }
  }
});

test("the same region is cut the same way every time", () => {
  const a = ch.buildRegion(chart, 2, 1);
  const b = ch.buildRegion(chart, 2, 1);
  assert.deepEqual(a.tiles, b.tiles);
  // A region is a pure function of the chart, which is what makes it safe to
  // throw away and re-cut when the hunter walks back.
  const other = ch.buildRegion(chart, 2, 2);
  assert.notDeepEqual(a.tiles, other.tiles, "two different regions came out identical");
});

test("water is never walkable ground and solid rock is never decorated", () => {
  for (const [rx, ry] of [[0, 0], [1, 2], [3, 3]]) {
    for (const t of ch.buildRegion(chart, rx, ry).tiles) {
      if (t.block) assert.ok(!t.layers?.length, "a solid tile is carrying scenery");
      if (t.floor === tex.FL.water) assert.equal(t.block, 0, "water was marked solid");
    }
  }
});

test("a region is named after the land it holds, not its top-left corner", () => {
  // Most coastal regions have open water in the corner, so naming from that one
  // tile called half the world "The Open Sea".
  const named = [];
  for (let rx = 0; rx < 4; rx++) for (let ry = 0; ry < 4; ry++) named.push(ch.buildRegion(chart, rx, ry).name);
  assert.ok(named.some((n) => n !== "The Open Sea"), "every region came out as open sea");
  for (const n of named) assert.ok(typeof n === "string" && n.length > 0, "a region has no name");
});

test("a region stays small, and the cache drops what it is done with", () => {
  // The whole reason regions exist: 6.25M tiles as objects would be ~3.6 GB.
  assert.ok(ch.REGION_TILES <= 70000, `a region is ${ch.REGION_TILES} tiles`);

  const cache = new ch.RegionCache(chart, 3);
  for (let i = 0; i < 10; i++) cache.get(i % 5, 0);
  assert.ok(cache.size <= 3, `cache grew to ${cache.size}, should keep at most 3`);

  // What it still holds is correct, not just present.
  const fresh = ch.buildRegion(chart, 0, 0);
  assert.deepEqual(cache.get(0, 0).tiles, fresh.tiles);

  cache.clear();
  assert.equal(cache.size, 0);
});

test("every chart biome knows how to dress itself", () => {
  for (const b of wc.BIOMES) {
    const look = ch.LOOK[b.id];
    assert.ok(look, `${b.label} has no ground art`);
    assert.ok(allowed.has(look.ground), `${b.label}: ground ${look.ground} is not New Texture art`);
    assert.ok(allowed.has(look.wall), `${b.label}: wall ${look.wall} is not New Texture art`);
    if (look.patch) assert.ok(allowed.has(look.patch), `${b.label}: patch ${look.patch} is not New Texture art`);
    if (look.tree) assert.ok(allowed.has(look.tree), `${b.label}: tree ${look.tree} is not New Texture art`);
  }
});

test("a region at the edge of the chart is clipped, not overrun", () => {
  const last = Math.floor((chart.w - 1) / ch.REGION);
  const r = ch.buildRegion(chart, last, last);
  assert.ok(r.w > 0 && r.h > 0);
  assert.ok(r.originX + r.w <= chart.w, "a region ran off the right of the chart");
  assert.ok(r.originY + r.h <= chart.h, "a region ran off the bottom of the chart");
  assert.equal(r.tiles.length, r.w * r.h);
  for (const t of r.tiles) assert.ok(t && t.sprite, "a clipped region has holes in it");
});
