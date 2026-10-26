/**
 * Verse coverage.
 *
 * The game has over four hundred verses, which made it easy to miss that whole elements could not
 * do basic things: Fire had no way to drink life back at all, ten of the eleven elements had no
 * cleanse, and Electric could not mend. This file is the contract that says every element can look
 * after itself — so the next batch of verses cannot quietly leave one behind.
 *
 * It deliberately does NOT demand that every element carry every control effect. Root is Earth's,
 * Sleep is Ice's, Gloom belongs to the Void and the dead. Forcing all of them everywhere would
 * flatten the elements into one another, which is the opposite of the point.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function moduleUrl(path, imports = {}) {
  let source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [specifier, url] of Object.entries(imports)) source = source.replaceAll(`from "${specifier}"`, `from "${url}"`);
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}
const kitsUrl = moduleUrl("../src/game/class-kits.ts");
const content = await import(moduleUrl("../src/game/content.ts", {
  "./classes": moduleUrl("../src/game/classes.ts", { "./class-kits": kitsUrl }),
  "./overmax": moduleUrl("../src/game/overmax.ts"),
  "./class-kits": kitsUrl,
}));

const ELEMENTS = Object.keys(content.TYPES);
const ofType = (t) => content.MOVES.filter((m) => m.type === t);
const effectsOf = (t) => new Set(ofType(t).map((m) => m.effect));

test("every verse id is unique", () => {
  const all = content.MOVES.map((m) => m.id);
  const seen = new Set();
  const dupes = all.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
  assert.deepEqual([...new Set(dupes)], [], "duplicate verse ids");
});

test("every element can drink life back — the hole that started this", () => {
  for (const t of ELEMENTS) assert.ok(effectsOf(t).has("leech"), `${t} has no leech verse`);
  // Called out by name because Fire having none is what the whole batch came from.
  assert.ok(ofType("fire").some((m) => m.effect === "leech"), "fire can leech");
});

test("every element can mend, ward and cleanse", () => {
  for (const t of ELEMENTS) {
    const have = effectsOf(t);
    assert.ok(have.has("mend"), `${t} cannot mend`);
    assert.ok(have.has("shell"), `${t} cannot ward`);
    assert.ok(have.has("cleanse"), `${t} cannot cleanse`);
  }
  assert.ok(ofType("electric").some((m) => m.effect === "mend"), "electric can mend");
});

test("every element can close a gap or break off", () => {
  const MOVERS = new Set(["dash", "blink", "lunge", "roll", "surge"]);
  for (const t of ELEMENTS) {
    assert.ok(ofType(t).some((m) => MOVERS.has(content.moveTactic(m))), `${t} has no movement verse`);
  }
});

test("every element can still hit, and hit in both forms somewhere", () => {
  for (const t of ELEMENTS) {
    const list = ofType(t);
    assert.ok(list.some((m) => m.power > 0), `${t} has no damaging verse`);
    const forms = new Set(list.map((m) => content.attackForm(m)));
    assert.ok(forms.size >= 2, `${t} only attacks one way (${[...forms].join(", ")})`);
  }
});

test("a cleanse lands on the witch, or it does nothing at all", () => {
  const cleansers = content.MOVES.filter((m) => m.effect === "cleanse");
  assert.ok(cleansers.length >= ELEMENTS.length, "at least one cleanse per element");
  for (const m of cleansers) {
    assert.equal(m.target, "player", `${m.id} must target the witch`);
    assert.equal(content.moveTactic(m), "heal", `${m.id} must be a heal-tactic verse`);
    assert.equal(m.power, 0, `${m.id} is not an attack`);
  }
});

test("the Wellspring batch is real, whole, and says what each verse does", () => {
  const ids = content.WELLSPRING_BATCH;
  assert.ok(Array.isArray(ids) && ids.length, "the batch exists");
  assert.equal(new Set(ids).size, ids.length, "no repeats inside the batch");
  for (const id of ids) {
    const m = content.MOVE_BY_ID[id];
    assert.ok(m, `${id} is a real verse`);
    assert.ok(content.TYPES[m.type], `${id} has a real element`);
    assert.ok(m.accuracy >= 70 && m.accuracy <= 100, `${id} accuracy out of range`);
    assert.ok(m.power >= 0 && m.power <= 90, `${id} power out of range`);
    assert.ok(m.crit >= 0 && m.crit <= 40, `${id} crit out of range`);
    assert.ok((m.about ?? "").length > 20, `${id} needs a description worth reading`);
    assert.ok(Array.isArray(m.anim) && m.anim.length, `${id} needs an animation`);
  }
});

test("control effects stay signature rather than being handed to everyone", () => {
  // If this ever fails it means a control effect has been spread across most elements, which
  // would mean the elements have stopped feeling different from one another.
  for (const effect of ["root", "sleep", "silence", "gloom"]) {
    const carriers = ELEMENTS.filter((t) => effectsOf(t).has(effect));
    assert.ok(carriers.length >= 1, `nothing carries ${effect} any more`);
    assert.ok(carriers.length <= ELEMENTS.length - 2, `${effect} is on nearly every element (${carriers.join(", ")})`);
  }
});
