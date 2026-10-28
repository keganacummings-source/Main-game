/**
 * Fog of war.
 *
 * The thing that matters most here is size: this rides along in every save, so
 * a 2500 x 2500 world's fog has to stay in kilobytes, not megabytes. The rest
 * is making sure a save that does not match the world is refused rather than
 * loaded at the wrong offset, which would draw as nonsense instead of failing.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./lib/ts-module.mjs";

const ex = await loadTs(import.meta.url, "../src/game/explored.ts");
const W = 2500, H = 2500;

test("a whole world's fog is kilobytes, not megabytes", () => {
  const f = ex.freshExplored(W, H);
  assert.equal(f.cw, Math.ceil(W / ex.FOG_CELL));
  assert.equal(f.ch, Math.ceil(H / ex.FOG_CELL));
  // Per tile this would be 6.25M bits (~780 KB). Per 8x8 cell it is ~12 KB.
  assert.ok(f.bits.length < 16000, `fog is ${f.bits.length} bytes`);
  const text = ex.packExplored(f).bits;
  assert.ok(text.length < 24000, `fog is ${text.length} characters once saved`);
});

test("nothing is seen until it is walked near", () => {
  const f = ex.freshExplored(W, H);
  assert.equal(ex.exploredShare(f), 0);
  assert.equal(ex.seenAt(f, 1200, 1200), false);
  ex.reveal(f, 1200, 1200, 40);
  assert.equal(ex.seenAt(f, 1200, 1200), true, "standing somewhere did not reveal it");
  assert.equal(ex.seenAt(f, 1200, 1800), false, "somewhere far away was revealed too");
});

test("revealing is a circle, and walking your own tracks uncovers nothing new", () => {
  const f = ex.freshExplored(W, H);
  const first = ex.reveal(f, 500, 500, 60);
  assert.ok(first > 0, "the first step revealed nothing");
  const again = ex.reveal(f, 500, 500, 60);
  assert.equal(again, 0, "walking the same spot reported new ground");

  // Inside the radius is seen, well outside is not.
  assert.equal(ex.seenAt(f, 500 + 40, 500), true);
  assert.equal(ex.seenAt(f, 500 + 200, 500), false);
  // Roughly circular: a corner at the radius distance diagonally is NOT seen.
  assert.equal(ex.seenAt(f, 500 + 55, 500 + 55), false, "the reveal is a square, not a circle");
});

test("the edges of the world do not wrap or crash", () => {
  const f = ex.freshExplored(W, H);
  assert.doesNotThrow(() => ex.reveal(f, 0, 0, 50));
  assert.doesNotThrow(() => ex.reveal(f, W - 1, H - 1, 50));
  assert.doesNotThrow(() => ex.reveal(f, -500, -500, 50));
  assert.doesNotThrow(() => ex.reveal(f, W + 500, H + 500, 50));
  assert.equal(ex.seenAt(f, 0, 0), true);
  assert.equal(ex.seenAt(f, W - 1, H - 1), true);
  // A corner reveal must not light up the opposite corner.
  assert.equal(ex.seenAt(f, W - 1, 0), false, "the fog wrapped around the world");
  assert.equal(ex.seenAt(f, -5, -5), false, "off-chart counts as seen");
});

test("fog survives a save and a load exactly", () => {
  const f = ex.freshExplored(W, H);
  for (const [x, y] of [[100, 100], [2400, 90], [1250, 1250], [80, 2400]]) ex.reveal(f, x, y, 70);
  const share = ex.exploredShare(f);

  const back = ex.unpackExplored(ex.packExplored(f), W, H);
  assert.deepEqual(back.bits, f.bits, "the fog changed on the way through a save");
  assert.equal(ex.exploredShare(back), share);
  for (const [x, y] of [[100, 100], [2400, 90], [1250, 1250], [80, 2400]]) {
    assert.equal(ex.seenAt(back, x, y), true, `${x},${y} was forgotten`);
  }
});

test("a fog that does not fit this world is refused, not loaded crooked", () => {
  const f = ex.freshExplored(W, H);
  ex.reveal(f, 1000, 1000, 100);
  const saved = ex.packExplored(f);

  // A save from a different-sized world would load at the wrong offset and draw
  // as noise, which is worse than losing it.
  assert.equal(ex.exploredShare(ex.unpackExplored(saved, 1000, 1000)), 0, "a mismatched fog was accepted");
  assert.equal(ex.exploredShare(ex.unpackExplored({ ...saved, bits: "not base64 !!" }, W, H)), 0);
  assert.equal(ex.exploredShare(ex.unpackExplored({ ...saved, bits: "AAAA" }, W, H)), 0, "a truncated fog was accepted");
  for (const junk of [null, undefined, 7, "x", {}, { cw: 1 }]) {
    assert.equal(ex.exploredShare(ex.unpackExplored(junk, W, H)), 0, `junk ${JSON.stringify(junk)} was accepted`);
  }
});

test("exploring the whole world reads as the whole world", () => {
  const f = ex.freshExplored(200, 200);
  for (let y = 0; y < 200; y += ex.FOG_CELL) for (let x = 0; x < 200; x += ex.FOG_CELL) ex.reveal(f, x, y, ex.FOG_CELL);
  assert.ok(ex.exploredShare(f) > 0.99, `only ${(ex.exploredShare(f) * 100).toFixed(1)}% after walking everywhere`);
  assert.equal(ex.exploredCells(f), f.cw * f.ch);
});
