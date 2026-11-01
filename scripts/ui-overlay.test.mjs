/**
 * The hover/menu overlay's rules.
 *
 * These are the parts that fail quietly: a card placed off-screen looks exactly like a card that
 * never opened, and a hint drawn under an open menu looks like a rendering bug. Both are pure
 * functions over a tiny store, so both can be checked here without a browser.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "../src/components/ui-overlay-core.ts");
const js = ts.transpileModule(readFileSync(SRC, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

const VW = 1000;
const VH = 800;
const menu = (actions = [{ id: "a", label: "A", onPick() {} }]) => ({ title: "Thing", actions });
const hint = { body: "words" };

test("a card sits down-right of the cursor when there is room", () => {
  core.resetOverlay();
  const { left, top } = core.place(100, 100, 200, 120, VW, VH);
  assert.ok(left > 100, "should be right of the cursor");
  assert.ok(top > 100, "should be below the cursor");
});

test("a card near an edge flips to the other side instead of running off", () => {
  const right = core.place(950, 100, 300, 120, VW, VH);
  assert.ok(right.left + 300 <= VW, `ran off the right edge: ${right.left + 300} > ${VW}`);
  const bottom = core.place(100, 780, 200, 200, VW, VH);
  assert.ok(bottom.top + 200 <= VH, `ran off the bottom edge: ${bottom.top + 200} > ${VH}`);
  const corner = core.place(995, 795, 300, 200, VW, VH);
  assert.ok(corner.left + 300 <= VW && corner.top + 200 <= VH, "the corner case escaped both edges");
});

test("a card bigger than the screen is pinned on, not pushed off", () => {
  const { left, top } = core.place(500, 400, 2000, 2000, VW, VH);
  assert.equal(left, 10);
  assert.equal(top, 10);
  // Never negative, whatever it is handed.
  for (const [x, y] of [[0, 0], [-50, -50], [VW * 2, VH * 2]]) {
    const p = core.place(x, y, 300, 200, VW, VH);
    assert.ok(p.left >= 10 && p.top >= 10, `placed off the top-left from ${x},${y}`);
  }
});

test("opening a menu takes the hint down", () => {
  core.resetOverlay();
  core.openHint(hint, 10, 10);
  assert.ok(core.readHint(), "hint should be up");
  core.openMenu(menu(), 20, 20);
  assert.equal(core.readHint(), null, "the hint should have gone when the menu opened");
  assert.ok(core.readMenu());
});

test("a hint cannot open over an open menu, and cannot be nudged open", () => {
  core.resetOverlay();
  core.openMenu(menu(), 20, 20);
  core.openHint(hint, 40, 40);
  assert.equal(core.readHint(), null, "a hint opened on top of a menu");
  core.moveHint(60, 60);
  assert.equal(core.readHint(), null, "moveHint created a hint out of nothing");
  core.closeMenu();
  core.openHint(hint, 40, 40);
  assert.ok(core.readHint(), "a hint should open once the menu is gone");
});

test("moving a hint follows the cursor without reopening it", () => {
  core.resetOverlay();
  core.openHint(hint, 10, 10);
  core.moveHint(55, 66);
  assert.equal(core.readHint().x, 55);
  assert.equal(core.readHint().y, 66);
  core.closeHint();
  core.moveHint(70, 70);
  assert.equal(core.readHint(), null, "a closed hint came back on a move");
});

test("subscribers hear every change and stop hearing once dropped", () => {
  core.resetOverlay();
  let beats = 0;
  const off = core.subscribe(() => { beats++; });
  core.openHint(hint, 1, 1);
  core.openMenu(menu(), 2, 2);
  core.closeMenu();
  assert.ok(beats >= 3, `heard ${beats} changes, wanted at least 3`);
  const sofar = beats;
  off();
  core.openHint(hint, 3, 3);
  assert.equal(beats, sofar, "still hearing changes after unsubscribing");
});

test("closing something already closed is quiet", () => {
  core.resetOverlay();
  let beats = 0;
  const off = core.subscribe(() => { beats++; });
  core.closeMenu();
  core.closeHint();
  assert.equal(beats, 0, "closing nothing told everyone about it");
  off();
});
