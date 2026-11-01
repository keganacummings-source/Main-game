/**
 * The V4 class contract.
 *
 * The class update made three promises that are easy to break by hand later, so they are pinned
 * here rather than left to memory:
 *
 *   1. Every class starts with exactly four verses.
 *   2. The fixed roster is split evenly between fighting up close and fighting at range, and a
 *      class's attacking starters actually reach the distance its fight style claims.
 *   3. The Engineer's grip on the Power grid is a doubling, and her Overclock doubles it again.
 *
 * The Crying Girl is excluded from the split: her fight style is whatever the player builds.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const HERE = dirname(fileURLToPath(import.meta.url));
const cache = new Map();
/** Transpile a .ts module to a data: URL, following its relative imports. */
function moduleUrl(rel) {
  const abs = resolve(HERE, rel);
  if (cache.has(abs)) return cache.get(abs);
  cache.set(abs, null);
  let out = ts.transpileModule(readFileSync(abs, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  out = out.replace(/from\s+"(\.[^"]+)"/g, (m, spec) => {
    const dep = resolve(dirname(abs), spec) + ".ts";
    const u = moduleUrl(dep);
    return u ? `from "${u}"` : m;
  });
  const url = `data:text/javascript;base64,${Buffer.from(out).toString("base64")}`;
  cache.set(abs, url);
  return url;
}

const classes = await import(moduleUrl("../src/game/classes.ts"));
const kits = await import(moduleUrl("../src/game/class-kits.ts"));
const content = await import(moduleUrl("../src/game/content.ts"));

const KIT_BY_ID = Object.fromEntries(kits.KIT_MOVES.map((m) => [m.id, m]));
const move = (id) => KIT_BY_ID[id] ?? content.MOVE_BY_ID[id];
/** The verses that are an actual attack, as opposed to a ward, a mend or a step. */
const ATTACKS = new Set(["strike", "heavy", "channel"]);
const FIXED = classes.CLASSES.filter((c) => c.id !== "cryinggirl");

test("every class starts with exactly four verses, and they all exist", () => {
  for (const c of classes.CLASSES) {
    assert.equal(c.starterMoves.length, 4, `${c.id}: ${c.starterMoves.length} starters, wanted 4`);
    assert.equal(new Set(c.starterMoves).size, 4, `${c.id}: duplicate starter`);
    for (const id of c.starterMoves) assert.ok(move(id), `${c.id}: unknown verse ${id}`);
    assert.ok(c.starterMoves.includes(c.signature), `${c.id}: does not start with its own signature`);
  }
});

test("the fixed roster is an even split between close quarters and range", () => {
  const melee = FIXED.filter((c) => c.fightStyle === "melee");
  const ranged = FIXED.filter((c) => c.fightStyle === "ranged");
  assert.equal(melee.length + ranged.length, FIXED.length, "a fixed class is still 'mixed'");
  assert.equal(melee.length, ranged.length, `split is ${melee.length} melee / ${ranged.length} ranged`);
  // The Crying Girl is the one exception, and it is deliberate: she picks her own.
  assert.equal(classes.CLASS_BY_ID.cryinggirl.starterMoves.length, 4);
});

test("a class's attacking starters reach as far as its fight style claims", () => {
  for (const c of FIXED) {
    const attacks = c.starterMoves.map(move).filter((m) => ATTACKS.has(content.moveTactic(m)));
    assert.ok(attacks.length >= 1, `${c.id}: no attacking verse to start with`);
    for (const m of attacks) {
      const form = content.attackForm(m);
      if (c.fightStyle === "melee") assert.equal(form, "melee", `${c.id}: ${m.id} is ${form} on a melee class`);
      else assert.ok(form === "ranged" || form === "spell", `${c.id}: ${m.id} is ${form} on a ranged class`);
    }
  }
});

test("every class can still move, and leads with a grind of its own", () => {
  const steps = new Set(["blink", "lunge", "roll", "dash", "surge"]);
  for (const c of classes.CLASSES) {
    assert.ok(c.starterMoves.some((id) => steps.has(content.moveTactic(move(id)))), `${c.id}: no way to move`);
    const apt = Object.entries(c.aptitudes ?? {});
    assert.equal(apt.length, 2, `${c.id}: wanted one main grind and one second, got ${apt.length}`);
    const [, main] = apt[0];
    const [, second] = apt[1];
    assert.ok(main > second, `${c.id}: its second grind is not second`);
    assert.ok(main >= 1.9, `${c.id}: main grind ${main} is not an accelerated one`);
  }
});

test("the Engineer is a melee class built on the Power grid", () => {
  const eng = classes.CLASS_BY_ID.engineer;
  assert.ok(eng, "no Engineer class");
  assert.equal(eng.fightStyle, "melee");
  assert.ok(classes.GIMMICKS[eng.gimmick], "Overclock is not a registered gimmick");
  assert.equal(classes.aptitudeOf("engineer", "building"), 2.6);
  // Her two perks are hers, and both are real entries in the shared pool.
  for (const id of eng.perks) {
    assert.ok(classes.PERK_BY_ID[id], `missing perk ${id}`);
    assert.equal(classes.PERK_BY_ID[id].cls, "engineer");
  }
});

test("the Engineer's grid runs doubled, and Overclock doubles it again", () => {
  // machineMult() lives on the engine class, which is far too large to import headlessly, so the
  // rule is read straight out of the source. If the shape of it changes, this fails loudly.
  const src = readFileSync(resolve(HERE, "../src/game/engine.ts"), "utf8");
  const body = src.slice(src.indexOf("machineMult() {"), src.indexOf("batCapFor(b) {"));
  assert.match(body, /classId !== "engineer"\) return 1;/, "someone other than the Engineer gets the bonus");
  assert.match(body, /ENGINEER_MACHINE_MULT \* 2/, "Overclock no longer doubles the grid");
  assert.match(src, /const ENGINEER_MACHINE_MULT = 2;/, "the doubling is no longer a doubling");

  // Everything on the grid has to read it, or part of the class quietly stops working.
  for (const site of [
    /const room = Math\.max\(0, this\.batCapFor\(b\)/,          // battery and capacitor capacity
    /addNetworkPower\(g, 10 \* this\.machineMult\(\)\)/,        // HellStone generators
    /LOGBURN_POWER \* this\.machineMult\(\)/,                   // log burners
    /SOLAR_POWER \* this\.machineMult\(\)/,                     // solar panels
    /Math\.min\(this\.machineMult\(\), DUP_STORE_MAX/,          // duplicator copies per cycle
    /50 \* mult \* this\.machineMult\(\)/,                      // the XP Producer
  ]) assert.match(src, site, `a Power machine stopped reading machineMult(): ${site}`);
});

test("stored Power survives a reload at the Engineer's capacity", () => {
  // A capacitor on her grid holds several times its nominal 500. Sanitising to 500 on load would
  // silently empty it, so the ceiling is the largest multiplier any class can apply.
  const power = readFileSync(resolve(HERE, "../src/game/power-extra.ts"), "utf8");
  assert.match(power, /export const MAX_MACHINE_MULT = 4;/);
  assert.match(power, /Math\.min\(CAP_MAX \* MAX_MACHINE_MULT,/);
});
