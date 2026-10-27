/**
 * Mobile mode's rules.
 *
 * The one that matters most is the last: the player's choice has to outrank the guess forever,
 * including on a device the guess would have answered the other way. Someone who turns mobile mode
 * off on a phone must not find it back on next time they open the game.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "../src/game/mobile-mode.ts");
const code = readFileSync(SRC, "utf8");

/** A throwaway document and localStorage, so the module can be loaded more than once per test. */
function world({ store = {}, coarse = false, w = 1400, h = 900, breakStorage = false } = {}) {
  const attrs = new Map();
  globalThis.document = {
    documentElement: {
      setAttribute: (k, v) => attrs.set(k, v),
      removeAttribute: (k) => attrs.delete(k),
      getAttribute: (k) => attrs.get(k) ?? null,
    },
  };
  globalThis.localStorage = {
    getItem: (k) => { if (breakStorage) throw new Error("blocked"); return k in store ? store[k] : null; },
    setItem: (k, v) => { if (breakStorage) throw new Error("blocked"); store[k] = String(v); },
    removeItem: (k) => { if (breakStorage) throw new Error("blocked"); delete store[k]; },
  };
  globalThis.window = {
    innerWidth: w,
    innerHeight: h,
    matchMedia: (q) => ({ matches: q.includes("coarse") ? coarse : false }),
    localStorage: globalThis.localStorage,
  };
  return { attrs, store };
}

/** Load a fresh copy of the module against whatever globals are currently set. */
async function load() {
  const js = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  // A unique comment per load defeats the module cache, so each test gets its own state.
  const unique = `${js}\n//${Math.random()}`;
  return import(`data:text/javascript;base64,${Buffer.from(unique).toString("base64")}`);
}

test("a desktop with a mouse starts in the full interface", async () => {
  world({ coarse: false, w: 1400, h: 900 });
  const m = await load();
  assert.equal(m.guessMobile(), false);
  assert.equal(m.isMobileUi(), false);
  assert.equal(m.mobileUiChosen(), false, "nothing was chosen, so this is still the guess");
});

test("a phone starts in mobile mode", async () => {
  world({ coarse: true, w: 390, h: 844 });
  const m = await load();
  assert.equal(m.guessMobile(), true);
  assert.equal(m.isMobileUi(), true);
});

test("a touchscreen laptop is not a phone", async () => {
  // Coarse pointer but a big screen: the full interface is the better answer.
  world({ coarse: true, w: 1920, h: 1080 });
  const m = await load();
  assert.equal(m.guessMobile(), false);
});

test("the choice outranks the guess, in both directions", async () => {
  // Off, on a phone that would otherwise have guessed on.
  world({ store: { "turbz.mobileUi": "0" }, coarse: true, w: 390, h: 844 });
  let m = await load();
  assert.equal(m.isMobileUi(), false, "a phone ignored the player turning it off");
  assert.equal(m.mobileUiChosen(), true);

  // On, on a desktop that would otherwise have guessed off.
  world({ store: { "turbz.mobileUi": "1" }, coarse: false, w: 1400, h: 900 });
  m = await load();
  assert.equal(m.isMobileUi(), true, "a desktop ignored the player turning it on");
});

test("switching it writes the choice down and marks the document", async () => {
  const { attrs, store } = world({ coarse: false });
  const m = await load();
  assert.equal(attrs.get("data-mobile-ui"), undefined, "off should leave no attribute");

  assert.equal(m.toggleMobileUi(), true);
  assert.equal(attrs.get("data-mobile-ui"), "1", "the stylesheet has nothing to hook onto");
  assert.equal(store["turbz.mobileUi"], "1");

  assert.equal(m.toggleMobileUi(), false);
  assert.equal(attrs.get("data-mobile-ui"), undefined, "the attribute outlived the setting");
  assert.equal(store["turbz.mobileUi"], "0");
});

test("subscribers hear the switch, and only when it actually moves", async () => {
  world({ coarse: false });
  const m = await load();
  const seen = [];
  const off = m.onMobileUi((on) => seen.push(on));

  m.setMobileUi(true);
  m.setMobileUi(true);          // already on: should say nothing
  m.setMobileUi(false);
  assert.deepEqual(seen, [true, false], `heard ${JSON.stringify(seen)}`);

  off();
  m.setMobileUi(true);
  assert.deepEqual(seen, [true, false], "still hearing changes after unsubscribing");
});

test("blocked storage does not stop the mode working", async () => {
  // Private mode, or a browser with site data switched off. The setting just will not survive.
  world({ coarse: true, w: 390, h: 844, breakStorage: true });
  const m = await load();
  assert.equal(m.isMobileUi(), true, "fell over instead of falling back to the guess");
  assert.equal(m.mobileUiChosen(), false);
  assert.doesNotThrow(() => m.setMobileUi(false));
  assert.equal(m.isMobileUi(), false, "the switch should still work in the session");
});

test("with no window at all, it is off and quiet", async () => {
  // Server-side or a worker: nothing to measure and nothing to paint.
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.localStorage;
  const m = await load();
  assert.equal(m.guessMobile(), false);
  assert.equal(m.isMobileUi(), false);
});
