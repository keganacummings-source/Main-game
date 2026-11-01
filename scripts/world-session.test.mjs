/**
 * Standing in the big world, and walking off the edge of a region.
 *
 * The region swap is the one piece of this that can put the hunter somewhere
 * she should not be: the terrain under her is replaced and her coordinates have
 * to shift by exactly one region in the same instant. Off by a tile and she
 * lands in a wall; off by a region and she is in the sea.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./lib/ts-module.mjs";

const wc = await loadTs(import.meta.url, "../src/game/world-chart.ts");
const ch = await loadTs(import.meta.url, "../src/game/world-chunks.ts");
const ws = await loadTs(import.meta.url, "../src/game/world-session.ts");
const store = await loadTs(import.meta.url, "../src/game/chart-store.ts");

const chart = wc.generateChart({ seed: 2026, w: 1000, h: 1000, continents: 3, islands: 6 });
const SPAN = ch.REGION * ws.TILE_PX;

test("entering the world lands on real ground, in the right region", () => {
  const { session, x, y } = ws.enterWorld(chart);
  assert.ok(session.world, "no terrain was cut");
  assert.equal(session.world.rx, session.rx);
  assert.equal(session.world.ry, session.ry);
  assert.ok(x >= 0 && x < SPAN && y >= 0 && y < SPAN, `start position ${x},${y} is outside its region`);

  // And the tile she is standing on is the one the chart's start spot named.
  const spot = wc.startSpot(chart);
  const at = ws.chartTileAt(session, x, y);
  assert.deepEqual(at, { tx: spot.tx, ty: spot.ty }, "the hunter is not where the chart put her");
  assert.ok(!wc.isWater(chart.biome[at.ty * chart.w + at.tx]), "the hunter started in the sea");
});

test("a chart tile and a region-local pixel agree both ways", () => {
  const { session } = ws.enterWorld(chart, { tx: 400, ty: 400 });
  for (const [x, y] of [[0, 0], [16, 16], [SPAN - 1, SPAN - 1], [1000, 2000]]) {
    const { tx, ty } = ws.chartTileAt(session, x, y);
    assert.equal(tx, session.rx * ch.REGION + Math.floor(x / ws.TILE_PX));
    assert.equal(ty, session.ry * ch.REGION + Math.floor(y / ws.TILE_PX));
  }
});

test("walking off a region edge swaps the ground and shifts the hunter with it", () => {
  const { session } = ws.enterWorld(chart, { tx: 400, ty: 400 });
  const was = { rx: session.rx, ry: session.ry };

  // One pixel past the right edge.
  const out = ws.crossRegions(session, SPAN + 4, 100);
  assert.ok(out.moved, "walking off the edge did not swap the region");
  assert.equal(session.rx, was.rx + 1, "swapped to the wrong region");
  assert.equal(session.ry, was.ry);
  assert.equal(out.x, 4, "the hunter was not shifted by exactly one region");
  assert.equal(out.y, 100, "the hunter moved on the axis she did not cross");
  assert.equal(session.world.rx, session.rx, "the terrain is not the region she is in");
});

test("crossing does not move the hunter on the chart", () => {
  // The real invariant: her CHART tile is the same before and after the swap.
  // Everything else is bookkeeping.
  const { session } = ws.enterWorld(chart, { tx: 400, ty: 400 });
  const before = ws.chartTileAt(session, SPAN + 70, SPAN + 30);
  const after = ws.crossRegions(session, SPAN + 70, SPAN + 30);
  const now = ws.chartTileAt(session, after.x, after.y);
  assert.deepEqual(now, before, "the region swap teleported the hunter");
});

test("one huge step can cross more than one region", () => {
  const { session } = ws.enterWorld(chart, { tx: 100, ty: 100 });
  const start = session.rx;
  const out = ws.crossRegions(session, SPAN * 2 + 50, 50);
  assert.ok(out.moved);
  assert.equal(session.rx, start + 2, "a two-region step only moved one region");
  assert.equal(out.x, 50);
});

test("the edge of the world is a wall, not a wrap", () => {
  const { session } = ws.enterWorld(chart, { tx: 10, ty: 10 });
  assert.equal(session.rx, 0);
  const out = ws.crossRegions(session, -200, -200);
  assert.equal(session.rx, 0, "walking off the left of the chart wrapped around");
  assert.equal(session.ry, 0);
  assert.ok(out.x >= 0 && out.y >= 0, "the hunter was left at a negative position");
});

test("staying put costs nothing and changes nothing", () => {
  const { session, x, y } = ws.enterWorld(chart, { tx: 400, ty: 400 });
  const out = ws.crossRegions(session, x, y);
  assert.equal(out.moved, false);
  assert.equal(out.x, x);
  assert.equal(out.y, y);
});

test("a frame of the world lifts the fog and walks the villagers", () => {
  store.resetChartStore();
  const { session, x, y } = ws.enterWorld(chart);
  store.setActiveChart(chart);

  const before = store.activeExplored();
  assert.ok(before, "no fog to lift");
  ws.stepWorld(session, x, y, 0.05);
  assert.ok(store.fogForSave(), "the fog did not survive a frame");

  // Somewhere near a village, so there is somebody to walk.
  const p = chart.places.find((q) => q.kind === "settlement");
  const near = ws.enterWorld(chart, { tx: p.tx, ty: p.ty });
  const v = near.session.regions.villages.get(p);
  for (const n of v.villagers) n.wait = 0;
  const start = v.villagers.map((n) => ({ x: n.tx, y: n.ty }));
  for (let i = 0; i < 200; i++) ws.stepWorld(near.session, near.x, near.y, 0.05);
  const moved = v.villagers.filter((n, i) => Math.hypot(n.tx - start[i].x, n.ty - start[i].y) > 0.2).length;
  assert.ok(moved > 0, "nobody in the village moved during a frame of the world");
  store.resetChartStore();
});

test("villagers are handed to the renderer in region pixels", () => {
  const p = chart.places.find((q) => q.kind === "settlement");
  const { session } = ws.enterWorld(chart, { tx: p.tx, ty: p.ty });
  const seen = ws.visibleVillagers(session);
  assert.ok(seen.length > 0, "a region holding a village shows no villagers");
  for (const { npc, x, y } of seen) {
    assert.equal(x, (npc.tx - session.rx * ch.REGION) * ws.TILE_PX + ws.TILE_PX / 2);
    assert.equal(y, (npc.ty - session.ry * ch.REGION) * ws.TILE_PX + ws.TILE_PX / 2);
  }
});

test("you can only talk to a villager who is actually next to you", () => {
  const p = chart.places.find((q) => q.kind === "settlement");
  const { session } = ws.enterWorld(chart, { tx: p.tx, ty: p.ty });
  const someone = ws.visibleVillagers(session)[0];
  assert.ok(someone, "nobody to talk to");
  assert.equal(ws.villagerNear(session, someone.x, someone.y), someone.npc);
  assert.equal(ws.villagerNear(session, someone.x + 5000, someone.y + 5000), null, "talked to somebody a region away");
});

test("the save carries enough to come back to the same place", () => {
  const { session } = ws.enterWorld(chart, { tx: 400, ty: 400 });
  const saved = ws.sessionSave(session);
  assert.equal(saved.seed, chart.seed);
  const back = ws.enterWorld(chart, { tx: 400, ty: 400 });
  assert.deepEqual(ws.sessionSave(back.session), saved);
});
