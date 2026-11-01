import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import * as px from "../src/game/pixel-edit.ts";
import * as ca from "../src/game/camp-assets.ts";

const rgba = (r, g, b, a = 255) => [r, g, b, a];
const get = (p, w, x, y) => Array.from(p.slice((y * w + x) * 4, (y * w + x) * 4 + 4));

test("shipped power textures exist, are 32x32 RGBA and actually painted", () => {
  for (const slot of ["hellgen", "battery", "wire", "xpgen", "duplicator", "logburner", "solar", "capacitor", "blockgen", "blockbreaker", "tesla", "pipe"]) {
    const f = new URL(`../public/MapAssets/NewTex/${slot}.png`, import.meta.url);
    assert.ok(existsSync(f), `${slot}.png is missing`);
    const b = readFileSync(f);
    assert.equal(b.readUInt32BE(16), 32, `${slot} width`);
    assert.equal(b.readUInt32BE(20), 32, `${slot} height`);
    assert.equal(b[25], 6, `${slot} is RGBA`);
    assert.ok(b.length > 200, `${slot} looks empty`);
    assert.equal(ca.powerDefaultArt(slot), `/MapAssets/NewTex/${slot}.png`);
  }
});

test("the importable power pack is valid and covers every power block", () => {
  const text = readFileSync(new URL("../public/MapAssets/NewTex/power-pack.json", import.meta.url), "utf8");
  const parsed = ca.parsePack(text);
  assert.ok(parsed);
  assert.equal(parsed.skipped, 0);
  // The pack covers every power block the builder can paint. BlockBreaker was retired (power-extra.ts
  // migrates old saves to the Rock Miner), and the Ghost Merger and GearSet Forge are current pieces
  // that were missing from POWER_TEXTURES, so the pack lost them on import.
  assert.deepEqual(parsed.assets.map((a) => a.category).sort(), ["battery", "blockgen", "capacitor", "duplicator", "gearforge", "ghostmerger", "hellgen", "logburner", "rockminer", "solar", "tesla", "wire", "xpgen"]);
  for (const a of parsed.assets) { assert.equal(ca.groupOf(a), "power"); assert.equal(a.live, true); }
});

test("parsePack accepts arrays and {assets}, drops bad entries, and rejects junk", () => {
  const good = { id: "a", name: "x", category: "floor", pixels: "data:image/png;base64,AAAA", size: 32, created: 1 };
  assert.equal(ca.parsePack("not json"), null);
  assert.equal(ca.parsePack("{\"a\":1}"), null);
  assert.equal(ca.parsePack(JSON.stringify([good, { id: "b" }, { ...good, id: "c", category: "nope" }])).assets.length, 1);
  assert.equal(ca.parsePack(JSON.stringify([good, { id: "b" }])).skipped, 1);
  assert.equal(ca.parsePack(JSON.stringify({ assets: [good] })).assets.length, 1);
  assert.equal(ca.parsePack(JSON.stringify([{ ...good, size: 7 }])).assets[0].size, 32, "odd sizes fall back to 32");
});

test("mergePack replaces by id and adds the rest", () => {
  const mk = (id, name) => ({ id, name, category: "floor", pixels: "data:image/png;base64,AA", size: 32, created: 1 });
  const r = ca.mergePack([mk("a", "old"), mk("b", "keep")], [mk("a", "new"), mk("c", "add")]);
  assert.equal(r.added, 1);
  assert.equal(r.replaced, 1);
  assert.deepEqual(r.assets.map((a) => `${a.id}:${a.name}`).sort(), ["a:new", "b:keep", "c:add"]);
});

test("rectCells and ellipseCells", () => {
  assert.equal(px.rectCells(1, 1, 4, 3, true).length, 12);
  assert.equal(px.rectCells(1, 1, 4, 3, false).length, 10, "border of a 4x3 box");
  assert.equal(px.rectCells(4, 3, 1, 1, true).length, 12, "corners in any order");
  const disc = px.ellipseCells(0, 0, 6, 6, true);
  assert.ok(disc.length > 25 && disc.length < 49);
  const ring = px.ellipseCells(0, 0, 6, 6, false);
  assert.ok(ring.length < disc.length && ring.length > 10);
  assert.equal(px.ellipseCells(2, 2, 2, 2, true).length, 1);
});

test("flip, rotate and shift move pixels where they should", () => {
  const w = 4;
  const p = px.newPix(w, w);
  px.setPx(p, w, w, 0, 0, rgba(255, 0, 0));
  assert.deepEqual(get(px.flipH(p, w, w), w, 3, 0), rgba(255, 0, 0));
  assert.deepEqual(get(px.flipV(p, w, w), w, 0, 3), rgba(255, 0, 0));
  assert.deepEqual(get(px.rotate90(p, w), w, 3, 0), rgba(255, 0, 0), "top-left goes to top-right clockwise");
  assert.deepEqual(get(px.rotate90(p, w, true), w, 0, 3), rgba(255, 0, 0), "top-left goes to bottom-left counter-clockwise");
  const four = px.rotate90(px.rotate90(px.rotate90(px.rotate90(p, w), w), w), w);
  assert.ok(px.pixEqual(four, p), "four quarter turns is the identity");
  assert.deepEqual(get(px.shiftWrap(p, w, w, -1, 0), w, 3, 0), rgba(255, 0, 0), "wraps around the left edge");
  assert.deepEqual(get(px.shiftWrap(p, w, w, 1, 1), w, 1, 1), rgba(255, 0, 0));
});

test("resizeNearest keeps pixel art crisp and round-trips 16 -> 32 -> 16", () => {
  const p = px.newPix(16, 16);
  px.setPx(p, 16, 16, 3, 5, rgba(10, 20, 30));
  const big = px.resizeNearest(p, 16, 16, 32, 32);
  assert.deepEqual(get(big, 32, 6, 10), rgba(10, 20, 30));
  assert.deepEqual(get(big, 32, 7, 11), rgba(10, 20, 30));
  assert.ok(px.pixEqual(px.resizeNearest(big, 32, 32, 16, 16), p));
  assert.equal(px.resizeNearest(p, 16, 16, 16, 16) === p, false, "returns a copy");
});

test("paletteOf ranks colours and seamScore spots seams", () => {
  const p = px.newPix(4, 4);
  for (let i = 0; i < 16; i++) px.setPx(p, 4, 4, i % 4, Math.floor(i / 4), i < 12 ? rgba(1, 2, 3) : rgba(9, 9, 9));
  assert.deepEqual(px.paletteOf(p, 2), ["#010203", "#090909"]);
  assert.equal(px.seamScore(px.newPix(8, 8), 8, 8), 1, "an empty tile has no seam");
  const flat = px.newPix(8, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) px.setPx(flat, 8, 8, x, y, rgba(100, 100, 100));
  assert.equal(px.seamScore(flat, 8, 8), 1);
  px.setPx(flat, 8, 8, 0, 3, rgba(255, 255, 255));
  assert.ok(px.seamScore(flat, 8, 8) < 1, "a bright pixel on one edge only is a seam");
});
