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
const dn = await import(moduleUrl("../src/game/daynight.ts"));
const bld = await import(moduleUrl("../src/game/building.ts"));
const buildingUrl = moduleUrl("../src/game/building.ts");
const surv = await import(moduleUrl("../src/game/survival.ts", { "./building": buildingUrl }));
const fx = await import(moduleUrl("../src/game/combat-fx.ts"));
const kitsUrl = moduleUrl("../src/game/class-kits.ts");
const classesUrl = moduleUrl("../src/game/classes.ts", { "./class-kits": kitsUrl });
const overmaxUrl = moduleUrl("../src/game/overmax.ts");
const content = await import(moduleUrl("../src/game/content.ts", { "./classes": classesUrl, "./overmax": overmaxUrl, "./class-kits": kitsUrl }));

test("day is 10 minutes, night is 15 minutes, and standard mode never has night", () => {
  assert.equal(dn.DAY_SECONDS, 600);
  assert.equal(dn.NIGHT_SECONDS, 900);
  assert.equal(dn.CYCLE_SECONDS, 1500);
  assert.equal(dn.NIGHT.strength, 2);
  assert.equal(dn.NIGHT.xp, 3);
  assert.equal(dn.NIGHT_IN_STANDARD_MODE, false);
});

test("the clock flips at dusk and dawn and counts nights", () => {
  const s = dn.freshDayNight();
  assert.equal(dn.isNight(s), false);
  assert.equal(dn.advanceDayNight(s, 599), null);
  assert.equal(dn.advanceDayNight(s, 2), "dusk");
  assert.equal(dn.isNight(s), true);
  assert.equal(dn.clockLabel(s).label, "Night 1");
  assert.equal(dn.advanceDayNight(s, 900), "dawn");
  assert.equal(dn.isNight(s), false);
  assert.equal(s.nights, 1);
  assert.equal(dn.clockLabel(s).label, "Day 2");
  assert.equal(dn.advanceDayNight(s, -5), null);
  assert.equal(dn.advanceDayNight(s, NaN), null);
});

test("sleeping skips only the night, never the day", () => {
  const s = dn.freshDayNight();
  assert.equal(dn.skipRate(s, true), 1);
  s.t = dn.DAY_SECONDS + 10;
  assert.equal(dn.skipRate(s, false), 1);
  assert.ok(dn.skipRate(s, true) > 60);
  let flip = null;
  for (let i = 0; i < 60 * 30 && !flip; i++) flip = dn.advanceDayNight(s, (1 / 60) * dn.skipRate(s, true));
  assert.equal(flip, "dawn");
});

test("a saved clock is repaired and darkness eases in and out", () => {
  assert.deepEqual(dn.normalizeDayNight(null), { t: 0, nights: 0 });
  assert.deepEqual(dn.normalizeDayNight({ t: -5, nights: 2.9 }), { t: 1495, nights: 2 });
  assert.equal(dn.darkness({ t: 0, nights: 0 }), 0);
  assert.equal(dn.darkness({ t: dn.DAY_SECONDS + 500, nights: 0 }), 1);
  const mid = dn.darkness({ t: dn.DAY_SECONDS, nights: 0 });
  assert.ok(mid > 0.4 && mid < 0.6);
  assert.ok(dn.darkness({ t: dn.CYCLE_SECONDS - 45, nights: 0 }) > 0 && dn.darkness({ t: dn.CYCLE_SECONDS - 45, nights: 0 }) < 1);
});

const camp = { map: "world", x: 100 * 32 + 16, y: 80 * 32 + 16 };
test("a campfire safe zone is exactly 15 by 15 tiles", () => {
  assert.equal(bld.SAFE_ZONE_TILES, 15);
  const at = (dx, dy) => bld.safeZoneAt([camp], "world", camp.x + dx * 32, camp.y + dy * 32);
  assert.ok(at(0, 0));
  assert.ok(at(7, 7));
  assert.ok(at(-7, -7));
  assert.equal(at(8, 0), null);
  assert.equal(at(0, -8), null);
  assert.equal(bld.safeZoneAt([camp], "crypt", camp.x, camp.y), null);
  const r = bld.zoneRect(camp);
  assert.equal((r.x1 - r.x0) / 32, 15);
  assert.equal((r.y1 - r.y0) / 32, 15);
});

test("foes pushed out of a zone end up outside it", () => {
  for (const [dx, dy] of [[0, 0], [3, -5], [-7, 2], [6, 7]]) {
    const p = bld.pushOut(camp, camp.x + dx * 32, camp.y + dy * 32);
    assert.equal(bld.safeZoneAt([camp], "world", p.x, p.y), null);
  }
});

function fakeWorld() {
  const w = 40, h = 40;
  const tiles = Array.from({ length: w * h }, () => ({ floor: 0, block: 0, decor: 0 }));
  tiles[20 * w + 25] = { floor: 2, block: 0, decor: 0 };
  tiles[22 * w + 22] = { floor: 0, block: 1, decor: 0 };
  return { w, h, tiles, spawns: [{ kind: "node", x: 23 * 32 + 16, y: 20 * 32 + 16 }] };
}
test("log placement rules", () => {
  const world = fakeWorld();
  const player = { x: 20 * 32 + 16, y: 20 * 32 + 16 };
  const base = { world, map: "world", logs: [], camps: [], player, bag: { timber: 2 }, terrainBlocked: (x, y) => world.tiles[Math.floor(y / 32) * world.w + Math.floor(x / 32)].block === 1 };
  assert.deepEqual(bld.checkPlaceLog({ ...base, tx: 21, ty: 20 }), { ok: true });
  assert.equal(bld.checkPlaceLog({ ...base, tx: 20, ty: 20 }).ok, false, "not under your feet");
  assert.equal(bld.checkPlaceLog({ ...base, tx: 25, ty: 20 }).ok, false, "not on water");
  assert.equal(bld.checkPlaceLog({ ...base, tx: 22, ty: 22 }).ok, false, "not on solid ground");
  assert.equal(bld.checkPlaceLog({ ...base, tx: 23, ty: 20 }).ok, false, "not on a resource");
  assert.equal(bld.checkPlaceLog({ ...base, tx: 35, ty: 20 }).ok, false, "out of reach");
  assert.equal(bld.checkPlaceLog({ ...base, tx: 1, ty: 1 }).ok, false, "world edge");
  assert.equal(bld.checkPlaceLog({ ...base, tx: 21, ty: 20, bag: { timber: 0 } }).ok, false, "needs a log");
  assert.equal(bld.checkPlaceLog({ ...base, tx: 21, ty: 20, logs: [{ map: "world", tx: 21, ty: 20 }] }).ok, false, "already placed");
  assert.equal(bld.checkPlaceLog({ ...base, tx: 21, ty: 20, camps: [{ map: "world", x: 21 * 32 + 5, y: 20 * 32 + 5 }] }).ok, false, "not on the fire");
  assert.equal(bld.checkPlaceLog({ ...base, tx: 21, ty: 20, keepClear: [{ x: 21 * 32 + 3, y: 20 * 32 + 3 }] }).ok, false, "not on a creature");
});

test("placed logs and the follower hold survive save cleaning", () => {
  const s = surv.normalizeSurvival({ logs: [{ map: "world", tx: 5, ty: 6 }, { map: "world", tx: 5, ty: 6 }, { map: "world", tx: -1, ty: 2 }, { map: 4, tx: 1, ty: 1 }, null], hold: { map: "world", x: 10, y: 20 } });
  assert.deepEqual(s.logs, [{ map: "world", tx: 5, ty: 6 }]);
  assert.deepEqual(s.hold, { map: "world", x: 10, y: 20 });
  assert.deepEqual(surv.normalizeSurvival().logs, []);
  assert.equal(surv.normalizeSurvival().hold, null);
  assert.equal(surv.normalizeSurvival({ hold: { map: "w", x: "a", y: 1 } }).hold, null);
  const big = surv.normalizeSurvival({ logs: Array.from({ length: 2000 }, (_, i) => ({ map: "world", tx: i % 300, ty: Math.floor(i / 300) })) });
  assert.equal(big.logs.length, bld.MAX_LOG_TILES);
  const set = bld.solidsFor([{ map: "world", tx: 3, ty: 2 }, { map: "crypt", tx: 1, ty: 1 }], "world", 10);
  assert.deepEqual([...set], [23]);
});

const move = (extra = {}) => ({ id: "testbolt", name: "Test Bolt", type: "fire", power: 30, accuracy: 100, crit: 5, priority: 1, effect: "none", range: 200, about: "", anim: ["burst"], ...extra });

test("a flying shot reports the time it lands, and a volley lands shot by shot", () => {
  const f = new fx.CombatFx();
  const one = f.cast(move(), "ranged", "strike", 0, 0, 300, 0);
  assert.ok(Math.abs(one - 0.5) < 0.01, `300px at 600px/s is half a second, got ${one}`);
  const proj = f.list.filter((x) => x.kind === "proj");
  assert.equal(proj.length, 1);
  assert.equal(proj[0].dur, one);
  const g = new fx.CombatFx();
  g.cast(move(), "ranged", "strike", 0, 0, 300, 0, { volley: true });
  const shots = g.list.filter((x) => x.kind === "proj");
  assert.equal(shots.length, 3);
  assert.ok(shots[1].t < shots[0].t && shots[2].t < shots[1].t, "later shots start later");
  assert.equal(fx.VOLLEY_GAP, 0.07);
});

test("a shot chases a moving target and its impact lands where the target is", () => {
  const f = new fx.CombatFx();
  let at = [300, 0];
  f.cast(move(), "ranged", "strike", 0, 0, 300, 0, { follow: () => at });
  at = [300, 120];
  f.tick(0.1);
  const p = f.list.find((x) => x.kind === "proj");
  assert.equal(p.y1, 120);
  assert.equal(p.impact.y0, 120);
  at = null;
  f.tick(0.1);
  assert.equal(f.list.find((x) => x.kind === "proj").y1, 120, "if the target is gone the shot keeps its last aim");
});

test("a missed melee swing shows no impact burst", () => {
  const hit = new fx.CombatFx();
  hit.cast(move(), "melee", "strike", 0, 0, 30, 0);
  const miss = new fx.CombatFx();
  miss.cast(move(), "melee", "strike", 0, 0, 30, 0, { miss: true });
  assert.ok(hit.list.some((x) => x.kind === "impact"));
  assert.ok(!miss.list.some((x) => x.kind === "impact"));
});

test("non-attack verses land instantly", () => {
  const f = new fx.CombatFx();
  for (const tactic of ["ward", "heal", "surge", "dash", "roll"]) assert.equal(f.cast(move(), "spell", tactic, 0, 0, 0, 0), 0);
});

test("world collision includes placed logs", async () => {
  const world = await import(moduleUrl("../src/game/world.ts", {
    "./content": moduleUrl("../src/game/content.ts", { "./classes": moduleUrl("../src/game/classes.ts", { "./class-kits": kitsUrl }), "./overmax": moduleUrl("../src/game/overmax.ts"), "./class-kits": kitsUrl }),
    "./tile-atlas": moduleUrl("../src/game/tile-atlas.ts"),
  }));
  const w = fakeWorld();
  assert.equal(world.blocked(w, 10 * 32 + 16, 10 * 32 + 16), false);
  w.solids = new Set([10 * w.w + 10]);
  assert.equal(world.blocked(w, 10 * 32 + 16, 10 * 32 + 16), true);
});

test("wayfinding, survival and cooking are skills with effect text, and the cooking recipes train cooking", () => {
  for (const id of ["wayfinding", "survival", "cooking"]) {
    assert.ok(content.SKILLS.some((k) => k.id === id), `missing ${id} skill`);
    assert.match(content.skillLine(id, 1), /^\+?0\.0%/, `${id} gives no bonus at level 1`);
    assert.notEqual(content.skillLine(id, 100), content.skillLine(id, 1), `${id} grows with level`);
  }
  assert.match(content.skillLine("survival", 400), /^\+159\.6% endurance/, "survival has no cap");
  assert.match(content.skillLine("cooking", 400), /^59\.[89]% chance/, "cooking has no cap");
  assert.match(content.skillLine("cooking", 2000), /^299\.[89]% chance/, "cooking goes past 100%");
  assert.match(content.skillLine("wayfinding", 400), /^\+29\.9% movement speed/);
  for (const id of ["cook", "fish", "purify"]) assert.equal(surv.CAMP_RECIPES[id].skill?.id, "cooking", `${id} trains cooking`);
  for (const c of content.CLASSES) for (const id of Object.keys(c.aptitudes ?? {})) assert.ok(content.SKILLS.some((k) => k.id === id), `${c.id}: unknown aptitude ${id}`);
});

test("the survival drain multiplier slows every bar, never stops them, and defaults to normal", () => {
  const normal = surv.normalizeSurvival(), slow = surv.normalizeSurvival(), floor = surv.normalizeSurvival(), dflt = surv.normalizeSurvival();
  surv.advanceSurvival(normal, 600);
  surv.advanceSurvival(dflt, 600, false, 1);
  surv.advanceSurvival(slow, 600, false, 0.5);
  surv.advanceSurvival(floor, 600, false, 0.01);
  for (const id of ["hunger", "thirst", "rest"]) {
    assert.ok(Math.abs(normal[id] - dflt[id]) < 1e-8, `${id}: drain 1 is normal`);
    assert.ok(Math.abs((100 - slow[id]) * 2 - (100 - normal[id])) < 1e-8, `${id} drains at half speed`);
    assert.ok(Math.abs((100 - floor[id]) * 50 - (100 - slow[id])) < 1e-6, `${id} has no floor: 0.01 drains at 1/100 speed`);
    assert.ok(floor[id] < 100, `${id} never stops`);
  }
  const a = surv.normalizeSurvival({ hunger: 0, thirst: 0, rest: 0 }), b = surv.normalizeSurvival({ hunger: 0, thirst: 0, rest: 0 });
  assert.ok(Math.abs(surv.advanceSurvival(a, 10) - surv.advanceSurvival(b, 10, false, 0.5)) < 1e-8, "empty bars hurt the same");
});


test("skills have no caps: past 100% turns into guaranteed extras, speed-ups never reach zero", async () => {
  const om = await import(moduleUrl("../src/game/overmax.ts"));
  assert.equal(om.procs(0), 0);
  assert.equal(om.procs(250, 0.4), 3, "250% with a good roll is three");
  assert.equal(om.procs(250, 0.6), 2, "250% with a bad roll is two");
  assert.equal(om.procs(100, 0.999), 1, "100% is always one");
  assert.equal(om.rateMult(100), 0.5);
  assert.ok(om.rateMult(1e6) > 0 && om.rateMult(1e6) < om.rateMult(1e5), "keeps improving, never zero");
  assert.ok(om.ratingChance(1e6) < 1 && om.ratingChance(300) === 0.75);
  for (const sk of content.SKILLS) assert.ok(content.skillLine(sk.id, 5000).length > 0, `${sk.id} has text at level 5000`);
});

test("bespoke verse animations land when they say they do and leave nothing behind", () => {
  for (const m of content.MOVES.filter((x) => x.fx)) {
    const f = new fx.CombatFx();
    let at = [200, 40];
    const delay = f.cast(m, content.attackForm(m), content.moveTactic(m), 0, 0, 200, 40, { follow: () => at });
    assert.ok(delay >= 0 && delay < 1.5, `${m.id} lands in time (${delay})`);
    assert.ok(f.list.some((x) => x.kind === m.fx || (m.fx === "nova" && x.kind === "nova")), `${m.id} plays its ${m.fx} animation`);
    at = [210, 60];
    for (let t = 0; t < 3; t += 1 / 30) f.tick(1 / 30);
    assert.equal(f.list.length, 0, `${m.id} finishes`);
  }
  const g = new fx.CombatFx();
  const landed = g.bomb(0, 0, 100, 0, "spirit", 70);
  assert.ok(landed > 0);
  g.nova(0, 0, 120, "light");
  g.guard(0, 0, "spirit");
  g.link(0, 0, 50, 50, "electric", 0.1);
  for (let t = 0; t < 2; t += 1 / 30) g.tick(1 / 30);
  assert.equal(g.list.length, 0);
});
