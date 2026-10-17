import assert from "node:assert/strict";
import test from "node:test";
import {
  breakMelee,
  commitMelee,
  commitSpell,
  freshMelee,
  freshWeave,
  pickRushTargets,
  planMelee,
  planSpell,
  schoolMult,
  shatterWeave,
  tickMelee,
} from "../src/game/fight-depth.ts";

test("melee chain wants a different verse, then a finisher, then a breath", () => {
  let chain = freshMelee();
  const open = planMelee(chain, "cut", "strike", 20, 64);
  assert.equal(open.step, 1);
  assert.ok(open.mult > 1, "a clinch hits harder than a neutral swing");
  chain = commitMelee(chain, open, "cut");
  const repeat = planMelee(chain, "cut", "strike", 40, 64);
  const link = planMelee(chain, "jab", "strike", 40, 64);
  assert.equal(repeat.label, "REPEAT");
  assert.equal(link.label, "LINK");
  assert.ok(link.mult > repeat.mult);
  chain = commitMelee(chain, link, "jab");
  const fin = planMelee(chain, "cleave", "strike", 40, 64);
  assert.equal(fin.step, 3);
  assert.equal(fin.cleave, true);
  assert.ok(fin.mult > link.mult);
  chain = commitMelee(chain, fin, "cleave");
  assert.ok(chain.recover > 0 && chain.n === 0);
  const tired = planMelee(chain, "cut", "strike", 40, 64);
  assert.equal(tired.label, "RECOVER");
  assert.ok(tired.mult < 1);
  const tip = planMelee(freshMelee(), "cut", "strike", 60, 64);
  assert.equal(tip.label, "TIP");
  assert.ok(tip.mult < 1);
});

test("a heavy after two cuts is a crush, and a hit drops the chain", () => {
  let chain = commitMelee(freshMelee(), planMelee(freshMelee(), "a", "strike", 40, 64), "a");
  chain = commitMelee(chain, planMelee(chain, "b", "strike", 40, 64), "b");
  const crush = planMelee(chain, "hammer", "heavy", 40, 64);
  assert.equal(crush.label, "CRUSH");
  assert.equal(crush.cleave, true);
  chain = tickMelee(chain, 3);
  assert.equal(chain.n, 0);
  chain = commitMelee(freshMelee(), planMelee(freshMelee(), "a", "strike", 40, 64), "a");
  assert.equal(breakMelee(chain).n, 0);
});

test("spells resonate, chord on a third element, and overcast when focus is full", () => {
  let weave = freshWeave();
  const first = planSpell(weave, "fire", "strike", 1);
  assert.equal(first.label, "");
  weave = commitSpell(weave, "fire", first);
  const echo = planSpell(weave, "fire", "strike", 1);
  assert.equal(echo.label, "RESONANCE");
  assert.ok(echo.mult > 1);
  weave = commitSpell(weave, "fire", echo);
  weave = commitSpell(weave, "ice", planSpell(weave, "ice", "strike", 1));
  const chord = planSpell({ ...weave, types: ["fire", "ice"], t: 5, focus: weave.focus }, "earth", "strike", 1);
  assert.equal(chord.label, "CHORD");
  assert.ok(chord.splash > 0 && chord.refund > 0);
  const full = { types: ["fire"], t: 5, focus: 100 };
  const loud = planSpell(full, "void", "strike", 1);
  assert.equal(loud.label, "OVERCAST");
  assert.equal(loud.focusAfter, 0);
  assert.equal(loud.overcast, true);
  const hymn = planSpell({ types: ["fire", "ice", "earth"], t: 5, focus: 40 }, "light", "channel", 0);
  assert.equal(hymn.label, "HYMN");
  assert.equal(hymn.consume, true);
  assert.ok(hymn.mult > 1.4);
  const spent = commitSpell(weave, "light", hymn);
  assert.deepEqual(spent.types, []);
});

test("a rush picks three foes inside its radius and leaves the far one", () => {
  const from = { x: 0, y: 0 };
  const foes = [
    { id: "a", x: 40, y: 0 },
    { id: "b", x: 80, y: 30 },
    { id: "c", x: 20, y: 70 },
    { id: "far", x: 400, y: 0 },
  ];
  const picked = pickRushTargets(from, foes, 120, 3, foes[1]);
  assert.deepEqual(picked.map((f) => f.id), ["b", "a", "c"]);
  assert.equal(pickRushTargets(from, foes, 120, 3).length, 3);
  assert.equal(pickRushTargets(from, [foes[3]], 120, 3).length, 0);
});

test("a school pays off the status already on the foe, and a falter keeps part of the focus", () => {
  assert.equal(schoolMult("fire", []).mult, 1);
  assert.ok(schoolMult("fire", ["burn"]).mult > 1);
  assert.equal(schoolMult("fire", ["burn"]).label, "FEED");
  assert.equal(schoolMult("light", ["expose"]).label, "JUDGE");
  assert.equal(schoolMult("ice", ["sleep"]).label, "SHATTER");
  const left = shatterWeave({ types: ["fire", "void"], t: 4, focus: 80 });
  assert.deepEqual(left.types, []);
  assert.equal(left.focus, 32);
});
