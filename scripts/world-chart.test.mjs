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
  // A world is ONE central continent in an ocean, not a scatter of landmasses.
  assert.ok(c.continents.length >= 1, "no land at all");
  assert.ok(c.continents.some((k) => !k.island), "no major continent at all");
  const home = c.continents[0];
  assert.ok(home.tiles > c.w * c.h * 0.15, `the main continent is only ${home.tiles} tiles — the world is not centred on it`);
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
  // Left to the coastline alone, a single central continent strands almost no
  // water: a whole world came out with a few hundred lake tiles. Basins are
  // carved on purpose now.
  const c = wc.generateChart({ seed: 2026, w: 1200, h: 1200, continents: 4 });
  const lakeTiles = Math.round(share(c, "lake") * 1200 * 1200);
  assert.ok(lakeTiles > 500, `only ${lakeTiles} lake tiles in a whole world`);

  // And they are INLAND: a lake must not touch the edge of the chart, which is
  // where the open sea is.
  const n = c.w * c.h;
  for (let i = 0; i < n; i++) {
    if (c.biome[i] !== wc.BIOME.lake) continue;
    const x = i % c.w, y = (i / c.w) | 0;
    assert.ok(x > 0 && y > 0 && x < c.w - 1 && y < c.h - 1, "a lake reached the edge of the chart");
  }
});

test("a world has no islands unless it is asked for them", () => {
  // "Island" used to be a size heuristic, which named a 54,000-tile continent
  // "Branisle" in a world that was never given any islands to begin with.
  const plain = wc.generateChart({ seed: 7, w: 700, h: 700, continents: 4 });
  assert.ok(plain.continents.length > 0);
  assert.ok(plain.continents.every((k) => !k.island), "a world with no islands reported islands");
  assert.ok(plain.continents.every((k) => !/isle$/i.test(k.name)), "a landmass was named an isle");

  // Ask for them and they come back.
  const isles = wc.generateChart({ seed: 7, w: 700, h: 700, continents: 4, islands: 14 });
  assert.ok(isles.continents.some((k) => k.island), "islands were asked for and none appeared");
});

test("a landmass is big enough to walk around", () => {
  // At the old floor of 90 tiles a world listed fifty-odd "landmasses", nearly
  // all of them coastal crumbs, and each took a line in the chart's LANDS list.
  const c = wc.generateChart({ seed: 2026, w: 900, h: 900, continents: 4 });
  for (const k of c.continents) assert.ok(k.tiles >= 400, `${k.name} is only ${k.tiles} tiles`);
});

test("every real landmass carries every land biome", () => {
  // Climate alone left one continent with seven of the thirteen land biomes, so
  // a hunter could spend a life on the wrong one and never see a desert.
  const land = wc.BIOMES.filter((b) => !b.water).map((b) => b.key);
  const c = wc.generateChart({ seed: 2026, w: 1200, h: 1200, continents: 4 });
  const big = c.continents.filter((k) => k.tiles >= 4000);
  assert.ok(big.length >= 1, `only ${big.length} landmasses big enough to test`);
  for (const k of big) {
    const missing = land.filter((b) => !k.biomes.includes(b));
    assert.deepEqual(missing, [], `${k.name} (${k.tiles} tiles) is missing: ${missing.join(", ")}`);
  }
});

test("placed biomes sit where their climate fits, not at random", () => {
  const c = wc.generateChart({ seed: 11, w: 900, h: 900, continents: 3 });
  const n = c.w * c.h;
  const avg = (want) => {
    let t = 0, m = 0, k = 0;
    for (let i = 0; i < n; i++) if (c.biome[i] === want) { t += c.temp[i]; m += c.moist[i]; k++; }
    return k ? { temp: t / k, moist: m / k, tiles: k } : null;
  };
  const desert = avg(wc.BIOME.desert);
  const jungle = avg(wc.BIOME.jungle);
  const tundra = avg(wc.BIOME.tundra);
  assert.ok(desert && jungle && tundra, "a biome that should be guaranteed is missing");
  assert.ok(desert.moist < jungle.moist, `desert (${desert.moist.toFixed(0)}) is not drier than jungle (${jungle.moist.toFixed(0)})`);
  assert.ok(tundra.temp < jungle.temp, `tundra (${tundra.temp.toFixed(0)}) is not colder than jungle (${jungle.temp.toFixed(0)})`);
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
  // One central continent, and it should dominate the chart's land.
  const main = c.continents[0];
  assert.ok(main && !main.island, "a full world has no central continent");
  assert.ok(main.tiles > 1_000_000, `the central continent is only ${main.tiles.toLocaleString()} tiles`);
  assert.ok(c.places.length >= 10, `only ${c.places.length} named places in a whole world`);
});
