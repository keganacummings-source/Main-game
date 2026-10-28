/**
 * Taking a world out of the game.
 *
 * The rule that matters: an export shows what the hunter FOUND. A chart image
 * that quietly drew the whole world, or a world file that listed every place
 * including the ones never visited, would give away the thing the fog exists to
 * protect.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./lib/ts-module.mjs";

const wc = await loadTs(import.meta.url, "../src/game/world-chart.ts");
const ex = await loadTs(import.meta.url, "../src/game/explored.ts");
const xp = await loadTs(import.meta.url, "../src/game/chart-export.ts");

const chart = wc.generateChart({ seed: 2026, w: 400, h: 400, continents: 3, islands: 5 });
const blank = () => ex.freshExplored(chart.w, chart.h);
const walked = () => {
  const f = blank();
  // Walk a corridor across the middle of the world.
  for (let x = 40; x < chart.w - 40; x += 10) ex.reveal(f, x, Math.floor(chart.h / 2), 30);
  return f;
};

test("an unexplored world draws as darkness, not as a map", () => {
  const pix = xp.chartPixels(chart, blank());
  assert.equal(pix.w, Math.ceil(chart.w / ex.FOG_CELL));
  assert.equal(pix.h, Math.ceil(chart.h / ex.FOG_CELL));
  const seen = new Set();
  for (let i = 0; i < pix.rgba.length; i += 4) seen.add(`${pix.rgba[i]},${pix.rgba[i + 1]},${pix.rgba[i + 2]}`);
  assert.equal(seen.size, 1, `an unexplored chart drew ${seen.size} colours — it is showing the world`);
  for (let i = 3; i < pix.rgba.length; i += 4) assert.equal(pix.rgba[i], 255, "a pixel is transparent");
});

test("walking somewhere puts it on the chart, and nothing else", () => {
  const fog = walked();
  const pix = xp.chartPixels(chart, fog);
  const colours = new Set();
  for (let i = 0; i < pix.rgba.length; i += 4) colours.add(`${pix.rgba[i]},${pix.rgba[i + 1]},${pix.rgba[i + 2]}`);
  assert.ok(colours.size > 2, "a walked world still drew as one colour");

  // Every drawn pixel must correspond to a cell actually seen.
  for (let cy = 0; cy < pix.h; cy++) {
    for (let cx = 0; cx < pix.w; cx++) {
      const o = (cy * pix.w + cx) * 4;
      const dark = pix.rgba[o] === 14 && pix.rgba[o + 1] === 11 && pix.rgba[o + 2] === 18;
      if (!dark) assert.ok(ex.seenCell(fog, cx, cy), `cell ${cx},${cy} was drawn but never seen`);
    }
  }
});

test("the whole world can be drawn on purpose", () => {
  const pix = xp.chartPixels(chart, blank(), { all: true });
  const colours = new Set();
  for (let i = 0; i < pix.rgba.length; i += 4) colours.add(`${pix.rgba[i]},${pix.rgba[i + 1]},${pix.rgba[i + 2]}`);
  assert.ok(colours.size > 3, "the full chart drew as darkness");
});

test("only discovered places are listed", () => {
  assert.deepEqual(xp.discoveredPlaces(chart, blank()), [], "places were listed before being found");
  assert.deepEqual(xp.discoveredPlaces(chart, null), [], "no fog at all listed places");

  const fog = walked();
  const found = xp.discoveredPlaces(chart, fog);
  assert.ok(found.length < chart.places.length, "walking one corridor found the whole world");
  for (const p of found) assert.ok(ex.seenAt(fog, p.tx, p.ty), `${p.name} was listed without being seen`);
});

test("a world file is small, re-importable, and keeps your secrets", () => {
  const fog = walked();
  const out = xp.exportWorld(chart, fog, [], new Date("2026-01-01T00:00:00Z"));
  assert.equal(out.format, "turbz-world");
  assert.equal(out.version, 1);
  assert.equal(out.seed, chart.seed);
  assert.deepEqual(out.size, { w: chart.w, h: chart.h });
  assert.equal(out.exportedAt, "2026-01-01T00:00:00.000Z");

  // The seed rebuilds the world exactly, which is why this can be kilobytes.
  const rebuilt = wc.generateChart({ seed: out.seed, w: out.size.w, h: out.size.h, continents: 3, islands: 5 });
  assert.deepEqual(rebuilt.biome, chart.biome, "the seed did not rebuild the same world");

  assert.equal(out.places.length, xp.discoveredPlaces(chart, fog).length, "the file lists places you never found");
  assert.ok(out.continents.length > 0 && out.biomes.length > 0);
  assert.ok(out.explored > 0 && out.explored < 1, `explored reads as ${out.explored}`);

  const bytes = JSON.stringify(out).length;
  assert.ok(bytes < 60000, `a world file is ${bytes} bytes`);
});

test("favourites are carried through the export", () => {
  const fog = walked();
  const found = xp.discoveredPlaces(chart, fog);
  if (!found.length) return;                       // this seed found nowhere; nothing to assert
  const out = xp.exportWorld(chart, fog, [found[0].id]);
  const marked = out.places.filter((p) => p.favourite);
  assert.equal(marked.length, 1, "the favourite did not survive the export");
  assert.equal(marked[0].name, found[0].name);
});

test("an export is named after its world", () => {
  assert.equal(xp.exportName(chart, "png"), `turbz-world-${chart.seed}.png`);
  assert.equal(xp.exportName(chart, "json"), `turbz-world-${chart.seed}.json`);
});
