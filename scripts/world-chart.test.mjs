/**
 * The world chart.
 *
 * These are the properties that make a 2500 x 2500 world playable rather than
 * just large, and every one of them was broken at some point while building it:
 *
 *   - it has to FIT. Plain objects would be ~3.6 GB; typed arrays are ~25 MB.
 *   - the land ratio has to hold, or a seed drowns or floods.
 *   - land must not be mostly mountain, and must not be mostly beach.
 *   - every biome has to actually occur somewhere.
 *   - the same seed must rebuild the same world, or nothing can be shared.
 *
 * A full 2500 x 2500 build takes several seconds, so most tests run on a
 * smaller chart; the shape of the generator is identical and the one test that
 * cares about real scale builds the real thing once.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./lib/ts-module.mjs";

const wc = await loadTs(import.meta.url, "../src/game/world-chart.ts");

/** A chart small enough to build quickly but big enough to behave like the real one. */
const small = (seed = 7, extra = {}) => wc.generateChart({ seed, w: 500, h: 500, continents: 4, islands: 8, ...extra });

const share = (chart, key) => {
  const row = wc.biomeCensus(chart).find((b) => b.key === key);
  return row ? row.share : 0;
};
const landShare = (chart) => {
  let n = 0;
  for (let i = 0; i < chart.land.length; i++) if (chart.land[i]) n++;
  return n / chart.land.length;
};

test("a chart is typed arrays, one byte per tile per layer", () => {
  const c = small();
  const n = c.w * c.h;
  for (const [name, arr] of [["biome", c.biome], ["elev", c.elev], ["moist", c.moist], ["temp", c.temp], ["land", c.land]]) {
    assert.ok(arr instanceof Uint8Array, `${name} should be a Uint8Array, not ${arr?.constructor?.name}`);
    assert.equal(arr.length, n, `${name} is the wrong length`);
  }
});

test("the same seed rebuilds exactly the same world", () => {
  const a = small(1234);
  const b = small(1234);
  assert.deepEqual(a.biome, b.biome);
  assert.deepEqual(a.elev, b.elev);
  assert.deepEqual(a.land, b.land);
  assert.deepEqual(a.places, b.places);
  assert.deepEqual(a.continents, b.continents);
  // And a different seed does not.
  const other = small(1235);
  assert.notDeepEqual(a.biome, other.biome, "two seeds produced an identical world");
});

test("the land ratio is held, whatever the seed", () => {
  for (const seed of [1, 2, 3, 99, 4242]) {
    const c = small(seed);
    const got = landShare(c);
    assert.ok(Math.abs(got - 0.34) < 0.05, `seed ${seed}: ${(got * 100).toFixed(1)}% land, wanted ~34%`);
  }
  // And it follows the request rather than being a constant.
  const dry = small(5, { landRatio: 0.55 });
  assert.ok(landShare(dry) > 0.45, `asked for 55% land, got ${(landShare(dry) * 100).toFixed(1)}%`);
});

test("land is not mostly mountain, and not mostly beach", () => {
  for (const seed of [1, 77, 2026]) {
    const c = small(seed);
    const land = landShare(c);
    // Both of these were real failures: height-ranked noise made 63% of land
    // highland, and an elevation-based shore rule made 34% of it beach.
    assert.ok(share(c, "highland") / land < 0.3, `seed ${seed}: highland is ${((share(c, "highland") / land) * 100).toFixed(0)}% of land`);
    assert.ok(share(c, "beach") / land < 0.15, `seed ${seed}: shore is ${((share(c, "beach") / land) * 100).toFixed(0)}% of land`);
  }
});

test("every biome occurs somewhere, across a handful of seeds", () => {
  const seen = new Set();
  for (const seed of [1, 2, 3, 4, 5, 6]) for (const row of wc.biomeCensus(small(seed))) if (row.tiles > 0) seen.add(row.key);
  for (const b of wc.BIOMES) {
    assert.ok(seen.has(b.key), `${b.label} never appears on any seed`);
  }
});

test("biomes answer to height, warmth and wet", () => {
  const { biomeFor, BIOME } = wc;
  assert.equal(biomeFor(40, 150, 150), BIOME.deep, "far below sea level is deep ocean");
  assert.equal(biomeFor(100, 150, 150), BIOME.ocean, "just below sea level is ocean");
  assert.equal(biomeFor(250, 200, 150), BIOME.highland, "a peak in the tropics is still bare rock");
  assert.equal(biomeFor(250, 40, 150), BIOME.glacier, "a cold peak is ice");
  assert.equal(biomeFor(130, 30, 40), BIOME.tundra, "cold and dry is tundra");
  assert.equal(biomeFor(130, 220, 30), BIOME.desert, "hot and dry is desert");
  assert.equal(biomeFor(130, 220, 230), BIOME.jungle, "hot and wet is jungle");
  assert.equal(biomeFor(130, 150, 220), BIOME.swamp, "temperate and soaking is swamp");
  // Shore is geography, not height: it must never come out of this function.
  for (let e = 112; e < 140; e++) {
    for (const t of [40, 120, 200]) for (const m of [20, 120, 240]) {
      assert.notEqual(biomeFor(e, t, m), BIOME.beach, `biomeFor still invents a beach at elev ${e}`);
    }
  }
});

test("continents are real landmasses, and every place stands on one", () => {
  const c = small(2026);
  assert.ok(c.continents.length >= 3, `only ${c.continents.length} landmasses`);
  assert.ok(c.continents.some((k) => !k.island), "no major continent at all");
  assert.ok(c.continents.every((k, i, all) => i === 0 || all[i - 1].tiles >= k.tiles), "continents are not ordered by size");

  for (const k of c.continents) {
    assert.ok(k.tiles > 0 && k.name, `continent ${k.id} is empty or unnamed`);
    assert.ok(k.x0 <= k.cx && k.cx <= k.x1 && k.y0 <= k.cy && k.cy <= k.y1, `${k.name}: centre is outside its own bounds`);
    assert.ok(k.biomes.length > 0, `${k.name} has no biomes`);
  }

  assert.ok(c.places.length > 0, "a whole world and nowhere is named");
  for (const p of c.places) {
    const i = p.ty * c.w + p.tx;
    assert.ok(c.land[i], `${p.name} is in the sea`);
    assert.ok(!wc.isWater(c.biome[i]), `${p.name} stands on water`);
    assert.ok(c.continents.some((k) => k.id === p.continent), `${p.name} belongs to no continent`);
  }
  assert.equal(new Set(c.places.map((p) => p.id)).size, c.places.length, "duplicate place ids");
});

test("the start spot is somewhere you can actually stand", () => {
  for (const seed of [1, 2, 3, 99]) {
    const c = small(seed);
    const s = wc.startSpot(c);
    const i = s.ty * c.w + s.tx;
    assert.ok(Number.isInteger(s.tx) && Number.isInteger(s.ty), `seed ${seed}: start is not a tile`);
    assert.ok(s.tx >= 0 && s.tx < c.w && s.ty >= 0 && s.ty < c.h, `seed ${seed}: start is off the chart`);
    assert.ok(c.land[i], `seed ${seed}: start is in the sea`);
    assert.ok(!wc.isWater(c.biome[i]), `seed ${seed}: start is on water`);
  }
});

test("lakes are inland water, not a single stranded puddle", () => {
  // The first version asked whether all four neighbours were land, which is only
  // ever true for a one-tile puddle: the whole world came out with one lake.
  let lakes = 0;
  for (const seed of [1, 2, 3]) lakes += Math.round(share(small(seed), "lake") * 500 * 500);
  assert.ok(lakes > 50, `only ${lakes} lake tiles across three worlds`);
});

test("a full 2500 x 2500 world fits in memory and holds together", { timeout: 120000 }, () => {
  const t0 = Date.now();
  const c = wc.generateChart({ seed: 2026 });
  const secs = (Date.now() - t0) / 1000;
  assert.equal(c.w, 2500);
  assert.equal(c.h, 2500);
  assert.equal(c.biome.length, 6_250_000);
  // Five one-byte layers. Plain objects would be about 3.6 GB.
  const bytes = c.biome.length + c.elev.length + c.moist.length + c.temp.length + c.land.length;
  assert.ok(bytes < 40e6, `the chart itself is ${(bytes / 1e6).toFixed(0)} MB`);
  assert.ok(secs < 60, `took ${secs.toFixed(1)}s to build`);
  assert.ok(c.continents.filter((k) => !k.island).length >= 2, "a full world needs more than one continent");
  assert.ok(c.places.length >= 10, `only ${c.places.length} named places in a whole world`);
});
