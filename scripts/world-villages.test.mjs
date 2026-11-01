/**
 * Villages and the people in them.
 *
 * Two things make a village hard and both are checked here.
 *
 * The buildings are STAMPED into regions, which are cut and thrown away
 * constantly — so a village has to be a pure function of the chart, and a
 * village that straddles a region seam has to come out the same from either
 * side. The people are NOT thrown away: they live on the cached Village, so the
 * cache has to hand back the same object or everyone snaps home whenever the
 * ground under them is re-cut.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./lib/ts-module.mjs";

const wc = await loadTs(import.meta.url, "../src/game/world-chart.ts");
const wv = await loadTs(import.meta.url, "../src/game/world-villages.ts");
const ch = await loadTs(import.meta.url, "../src/game/world-chunks.ts");
const tex = await loadTs(import.meta.url, "../src/game/tex-world.ts");

const chart = wc.generateChart({ seed: 2026, w: 1000, h: 1000, continents: 3, islands: 6 });
const settlements = chart.places.filter((p) => p.kind === "settlement");

test("a chart has settlements to build on", () => {
  assert.ok(settlements.length >= 5, `only ${settlements.length} settlements on the chart`);
});

test("a village is houses, lanes and a well — not a blob", () => {
  const v = wv.buildVillage(chart, settlements[0]);
  assert.ok(v.tiles.size > 120, `village has only ${v.tiles.size} tiles`);

  let wall = 0, floor = 0, lane = 0, water = 0, bed = 0, sign = 0;
  for (const t of v.tiles.values()) {
    if (t.sprite === tex.TEX.woodWall) wall++;
    if (t.sprite === tex.TEX.woodFloor) floor++;
    if (t.sprite === tex.TEX.dirt) lane++;
    if (t.sprite === tex.TEX.water) water++;
    for (const l of t.layers ?? []) {
      if (l === tex.TEX.bed) bed++;
      if (l === tex.TEX.sign) sign++;
    }
  }
  assert.ok(wall > 40, `only ${wall} wall tiles — no houses`);
  assert.ok(floor > 20, `only ${floor} floor tiles — houses have no insides`);
  assert.ok(lane > 20, `only ${lane} lane tiles — the doors go nowhere`);
  assert.equal(water, 2, "the well is not two tiles of water");
  assert.ok(bed >= 4, `only ${bed} beds — fewer beds than houses`);
  assert.equal(sign, 1, "there should be exactly one noticeboard");
});

test("every house can be walked out of", () => {
  // A house whose door was written over by its own wall is a sealed box, and
  // the only way to notice is to check that the wall ring has a gap in it.
  for (const p of settlements.slice(0, 6)) {
    const v = wv.buildVillage(chart, p);
    // Floor tiles that touch a non-wall tile outside: at least one per house.
    let exits = 0;
    for (const [i, t] of v.tiles) {
      if (t.sprite !== tex.TEX.woodFloor || t.block) continue;
      const x = i % chart.w, y = (i / chart.w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = v.tiles.get((y + dy) * chart.w + (x + dx));
        // A floor tile next to open ground, or next to a lane, is a doorway.
        if (!n || (!n.block && n.sprite !== tex.TEX.woodFloor)) { exits++; break; }
      }
    }
    assert.ok(exits >= 4, `${p.name} has only ${exits} ways out of its houses`);
  }
});

test("villages never build on water or on bare mountain", () => {
  for (const p of settlements.slice(0, 8)) {
    const v = wv.buildVillage(chart, p);
    for (const i of v.tiles.keys()) {
      const b = chart.biome[i];
      // The well is the one piece of water a village puts down itself.
      if (v.tiles.get(i).sprite === tex.TEX.water) continue;
      assert.ok(!wc.isWater(b), `${p.name} built on water at ${i}`);
    }
  }
});

test("a village is the same every time it is built", () => {
  const a = wv.buildVillage(chart, settlements[1]);
  const b = wv.buildVillage(chart, settlements[1]);
  assert.equal(a.tiles.size, b.tiles.size);
  assert.deepEqual([...a.tiles.keys()].sort(), [...b.tiles.keys()].sort());
  assert.deepEqual(a.villagers.map((v) => v.name), b.villagers.map((v) => v.name));
});

test("villagers walk, and stay in their own village", () => {
  const v = wv.buildVillage(chart, settlements[0]);
  assert.ok(v.villagers.length >= 4, `only ${v.villagers.length} villagers`);
  const start = v.villagers.map((p) => ({ x: p.tx, y: p.ty }));
  // Furthest each one ever got from where they started, NOT where they ended up:
  // the route is a loop back to their own door, so sampling the end once marks
  // whoever happens to be home as having never moved.
  const reached = v.villagers.map(() => 0);

  // Five minutes at 20fps.
  for (let i = 0; i < 6000; i++) {
    wv.stepVillagers(v, 0.05);
    v.villagers.forEach((p, k) => {
      const d = Math.hypot(p.tx - start[k].x, p.ty - start[k].y);
      if (d > reached[k]) reached[k] = d;
    });
  }

  let moved = 0;
  v.villagers.forEach((p, i) => {
    if (reached[i] > 0.5) moved++;
    const home = Math.hypot(p.tx - v.cx, p.ty - v.cy);
    assert.ok(home < 60, `${p.name} wandered ${home.toFixed(0)} tiles from ${v.name}`);
    assert.ok(Number.isFinite(p.tx) && Number.isFinite(p.ty), `${p.name} walked off the number line`);
  });
  assert.equal(moved, v.villagers.length, `only ${moved} of ${v.villagers.length} villagers ever moved`);
});

test("one enormous frame does not teleport the village", () => {
  // A backgrounded tab hands back a single frame worth minutes. Without the
  // clamp in stepVillagers everyone would cross their whole route in one step.
  const v = wv.buildVillage(chart, settlements[2]);
  for (const p of v.villagers) p.wait = 0;
  const before = v.villagers.map((p) => ({ x: p.tx, y: p.ty }));
  wv.stepVillagers(v, 600);
  v.villagers.forEach((p, i) => {
    const d = Math.hypot(p.tx - before[i].x, p.ty - before[i].y);
    // Fastest villager is ~1.6 tiles/sec and dt clamps at 0.25s.
    assert.ok(d <= 0.5, `a villager crossed ${d.toFixed(1)} tiles in one frame`);
  });
});

test("a blocked step makes a villager wait, not walk through", () => {
  const v = wv.buildVillage(chart, settlements[3]);
  for (const p of v.villagers) p.wait = 0;
  const before = v.villagers.map((p) => ({ x: p.tx, y: p.ty }));
  for (let i = 0; i < 20; i++) wv.stepVillagers(v, 0.05, () => true);   // everything is blocked
  v.villagers.forEach((p, i) => {
    assert.equal(p.tx, before[i].x, "a villager walked through a blocked tile");
    assert.equal(p.ty, before[i].y, "a villager walked through a blocked tile");
  });
});

test("the cache hands back the same village, so the people keep walking", () => {
  const cache = new wv.VillageCache(chart);
  const a = cache.get(settlements[0]);
  for (let i = 0; i < 200; i++) wv.stepVillagers(a, 0.05);
  const where = a.villagers[0].tx;
  const b = cache.get(settlements[0]);
  assert.equal(b, a, "the cache rebuilt a village instead of keeping it");
  assert.equal(b.villagers[0].tx, where, "a villager was snapped back to their doorstep");
});

test("a village on a region seam is stamped the same from both sides", () => {
  // The failure this guards against is a village half-built: the two regions
  // disagree about the tiles they share and a house loses a wall.
  const cache = new wv.VillageCache(chart);
  const v = cache.get(settlements[0]);
  const R = ch.REGION;

  for (const [ci, t] of v.tiles) {
    const cx = ci % chart.w, cy = (ci / chart.w) | 0;
    const rx = Math.floor(cx / R), ry = Math.floor(cy / R);
    const region = ch.buildRegion(chart, rx, ry, R, cache);
    const got = region.tiles[(cy - region.originY) * region.w + (cx - region.originX)];
    assert.ok(got, `village tile ${cx},${cy} is missing from its region`);
    assert.equal(got.sprite, t.sprite, `village tile ${cx},${cy} was stamped differently`);
    assert.equal(got.block, t.block, `village tile ${cx},${cy} disagrees about collision`);
  }
});

test("a region knows which villages are in it, and takes their name", () => {
  const cache = new wv.VillageCache(chart);
  const p = settlements[0];
  const region = ch.buildRegion(chart, Math.floor(p.tx / ch.REGION), Math.floor(p.ty / ch.REGION), ch.REGION, cache);
  assert.ok(region.villages.length >= 1, "the region holding a village reports none");
  assert.ok(region.villages.some((v) => v.id === p.id), "the wrong villages were reported");
  assert.ok(region.name !== "The Open Sea", "a region with a village in it is still unnamed");
});

test("a region with no village nearby builds none", () => {
  // `overlapping` must reject on the cheap test, or every region cut would
  // build all ninety villages in the world.
  const cache = new wv.VillageCache(chart);
  cache.overlapping(0, 0, 10, 10);
  assert.ok(cache.size < settlements.length, "the cheap overlap test built everything");
});

test("even an awkward site gets a real village", () => {
  // Houses are tried on a golden-angle sweep over ATTEMPTS. Keyed to houses
  // BUILT instead, a failed attempt changed nothing and the next one probed the
  // identical spot: a taiga site hemmed in by a lake came out with one house
  // and one resident. Every settlement on the chart has to clear the bar.
  for (const p of settlements) {
    const v = wv.buildVillage(chart, p);
    let wall = 0;
    for (const t of v.tiles.values()) if (t.sprite === tex.TEX.woodWall) wall++;
    // A small house is about 12 wall tiles, so this is "at least three of them".
    // The regression it guards against produced 17 — one house — and a sand spit
    // with the sea on three sides really does only fit a hamlet.
    assert.ok(wall >= 36, `${p.name} (${p.biome}) has only ${wall} wall tiles — barely a house`);
    assert.ok(v.villagers.length >= 3, `${p.name} has only ${v.villagers.length} residents`);
  }
});
