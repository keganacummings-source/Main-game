/**
 * The chart world: the world chart turned into ground a hunter can walk on, with enemies on it.
 *
 * The thing most worth proving here is that FOES STILL WORK. A region is only terrain, so unless camps are laid
 * on it the new world would be empty, and unless the engine's list of spawn points follows the regions as they
 * come and go, foes would either never appear or would be left standing on ground that is no longer there.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTs } from "./lib/ts-module.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const here = import.meta.url;
const wc = await loadTs(here, "../src/game/world-chart.ts");
const cwm = await loadTs(here, "../src/game/chart-world.ts");
const chunks = await loadTs(here, "../src/game/world-chunks.ts");
const worldMod = await loadTs(here, "../src/game/world.ts");
const content = await loadTs(here, "../src/game/content.ts");

const SIZE = 1000; // a quarter the area of the real chart: the same code, a fraction of the time
const chart = wc.generateChart({ seed: 2026, w: SIZE, h: SIZE, continents: 3, islands: 6 });
const make = () => cwm.createChartWorld(chart, "life-test");
const TILE = 32;

/** Everything foe-shaped in the world right now. */
const mobsOf = (cw) => cw.world.spawns.filter((s) => s.kind === "mob");
const nodesOf = (cw) => cw.world.spawns.filter((s) => s.kind === "node");
const tileOf = (s) => ({ tx: Math.floor(s.x / TILE), ty: Math.floor(s.y / TILE) });

test("the world is chart-sized but only the ground near the hunter is built", () => {
  const cw = make();
  assert.equal(cw.world.w, SIZE);
  assert.equal(cw.world.h, SIZE);
  assert.equal(cw.world.tiles.length, SIZE * SIZE, "indexes must be chart indexes, so no position ever needs translating");
  assert.ok(cw.world.tiles.every((t) => t === undefined), "nothing is built until the hunter is somewhere");

  const r = cwm.streamChartWorld(cw, cw.start.tx, cw.start.ty);
  assert.ok(r.changed && r.built.length >= 1 && r.built.length <= 4, `built ${r.built.length} regions at the start`);
  assert.ok(cwm.builtTiles(cw) <= 4 * 256 * 256);
  assert.ok(cwm.builtAt(cw, cw.start.tx, cw.start.ty), "the hunter's own tile exists");
  assert.equal(cwm.builtAt(cw, 5, 5) && cw.start.tx > 300, false, "ground far away is not built");

  // Standing still costs nothing.
  const again = cwm.streamChartWorld(cw, cw.start.tx, cw.start.ty);
  assert.equal(again.changed, false);
});

test("unbuilt ground is solid, built ground at the start can be stood on", () => {
  const cw = make();
  cwm.streamChartWorld(cw, cw.start.tx, cw.start.ty);
  const open = (tx, ty) => !worldMod.blocked(cw.world, tx * TILE + 16, ty * TILE + 16);
  assert.ok(open(cw.start.tx, cw.start.ty), "the hearth tile is open");
  // Find a tile that is definitely not built and make sure asking about it neither throws nor lets anyone in.
  let far = null;
  for (let tx = 10; tx < SIZE && !far; tx += 37) if (!cwm.builtAt(cw, tx, 400)) far = { tx, ty: 400 };
  assert.ok(far, "some ground is unbuilt");
  assert.equal(worldMod.blocked(cw.world, far.tx * TILE + 16, far.ty * TILE + 16), true);
  assert.doesNotThrow(() => worldMod.biomeNameAt(cw.world, far.tx * TILE + 16, far.ty * TILE + 16));
});

test("camps are laid on every region, in the shape the engine's spawn zones expand to", () => {
  const cw = make();
  cwm.streamChartWorld(cw, cw.start.tx, cw.start.ty);
  const mobs = mobsOf(cw);
  assert.ok(mobs.length > 150, `only ${mobs.length} foes around the start: the world would be empty`);
  const ids = new Set();
  for (const m of mobs) {
    assert.ok(!ids.has(m.id), `duplicate spawn id ${m.id}`);
    ids.add(m.id);
    assert.ok(content.MONSTER_BY_ID[m.species] || content.ANIMAL_BY_ID[m.species], `unknown species ${m.species}`);
    assert.equal(m.fixedLevel, true, "camp foes keep the level the zone gave them");
    assert.ok(m.zone, "the engine reads respawn time and the camp's species off the zone");
    const z = m.zone;
    const { tx, ty } = tileOf(m);
    assert.ok(tx >= z.tx && tx < z.tx + z.tw && ty >= z.ty && ty < z.ty + z.th, "a foe stands inside its own camp");
    assert.ok(m.level >= z.levelMin && m.level <= z.levelMax, "level inside the camp's range");
    assert.ok(z.respawn >= 5 && z.respawn <= 600, "respawn time is one the Map Builder would accept");
    assert.ok(z.species.includes(m.species), "the foe is one of the camp's species");
    assert.ok(z.count >= 2 && z.count <= 3);
    // Standing room: on the chart, not in the sea, not inside a mountain.
    assert.ok(chunks.walkableAt(chart, tx, ty), `foe ${m.id} is on unwalkable ground at ${tx},${ty}`);
    assert.equal(worldMod.blocked(cw.world, m.x, m.y), false, "and the engine agrees it is open");
  }
});

test("a new hunter wakes in peace: no camp near the start, none on a town or door", () => {
  const cw = make();
  cwm.streamChartWorld(cw, cw.start.tx, cw.start.ty);
  for (const m of mobsOf(cw)) {
    const { tx, ty } = tileOf(m);
    assert.ok(Math.max(Math.abs(tx - cw.start.tx), Math.abs(ty - cw.start.ty)) > cwm.START_SAFE, `foe ${m.id} is ${tx - cw.start.tx},${ty - cw.start.ty} from the hearth`);
    for (const s of cw.sites.slice(1)) {
      assert.ok(Math.max(Math.abs(tx - s.tx), Math.abs(ty - s.ty)) > cwm.SITE_SAFE - 1, `foe ${m.id} is on top of a site at ${s.tx},${s.ty}`);
    }
  }
});

test("foes get tougher the further you walk from the start", () => {
  assert.ok(cwm.levelBand(0).hi <= 5, "level 1 country at the hearth");
  let last = 0;
  for (let d = 0; d <= 1400; d += 100) {
    const b = cwm.levelBand(d);
    assert.ok(b.lo >= 1 && b.hi > b.lo);
    assert.ok(b.lo >= last, "the band never drops as you go outward");
    last = b.lo;
  }
  assert.ok(cwm.levelBand(1200).hi >= 90, "the far edge reaches the old top tier");

  // And the spawns really carry it: walk out and the camps there are stronger than the ones at home.
  const cw = make();
  cwm.streamChartWorld(cw, cw.start.tx, cw.start.ty);
  const home = mobsOf(cw).map((m) => m.level);
  const near = Math.max(...home);
  const out = { tx: cw.start.tx < SIZE / 2 ? cw.start.tx + 360 : cw.start.tx - 360, ty: cw.start.ty };
  cwm.streamChartWorld(cw, out.tx, out.ty);
  const away = mobsOf(cw).filter((m) => Math.hypot(tileOf(m).tx - cw.start.tx, tileOf(m).ty - cw.start.ty) > 300).map((m) => m.level);
  assert.ok(away.length, "there are foes out there");
  assert.ok(Math.min(...away) > Math.min(...home), `far foes (${Math.min(...away)}+) should outlevel home foes (${Math.min(...home)}+)`);
  assert.ok(near < Math.max(...away));
});

test("a region that is dropped and built again comes back exactly the same, camps included", () => {
  const cw = make();
  cwm.streamChartWorld(cw, cw.start.tx, cw.start.ty);
  const before = JSON.stringify(mobsOf(cw).map((m) => [m.id, m.species, m.x, m.y, m.level]).sort());
  // Walk far enough away that everything is dropped, then come home.
  const away = { tx: cw.start.tx < SIZE / 2 ? cw.start.tx + 480 : cw.start.tx - 480, ty: cw.start.ty };
  const gone = cwm.streamChartWorld(cw, away.tx, away.ty);
  assert.ok(gone.dropped.length > 0, "the home regions were dropped");
  assert.ok(!cwm.builtAt(cw, cw.start.tx, cw.start.ty), "and their ground went with them");
  cwm.streamChartWorld(cw, cw.start.tx, cw.start.ty);
  const after = JSON.stringify(mobsOf(cw).map((m) => [m.id, m.species, m.x, m.y, m.level]).sort());
  assert.equal(after, before);
});

test("walking over a seam changes the spawn list by exactly the regions that came and went", () => {
  const cw = make();
  let r = cwm.streamChartWorld(cw, 300, 300);
  const have = new Set(cw.world.spawns.map((s) => s.id));
  assert.equal(have.size, cw.world.spawns.length, "spawn ids are unique across regions");
  // March east across several regions, checking every step's bookkeeping.
  let live = new Set(have);
  for (let tx = 300; tx < 900; tx += 20) {
    r = cwm.streamChartWorld(cw, tx, 300);
    if (!r.changed) continue;
    for (const id of r.removed) assert.ok(live.delete(id), `removed ${id} that was never there`);
    for (const s of r.added) { assert.ok(!live.has(s.id), `added ${s.id} twice`); live.add(s.id); }
    const now = new Set(cw.world.spawns.map((s) => s.id));
    assert.deepEqual([...live].sort(), [...now].sort(), "the reported changes add up to the actual list");
    // Nothing is left standing on ground that is gone.
    for (const s of cw.world.spawns) assert.ok(cwm.builtAt(cw, tileOf(s).tx, tileOf(s).ty), `${s.id} is on ground that is not built`);
  }
  assert.ok(cwm.builtTiles(cw) <= 9 * 256 * 256, "memory stays bounded however far you walk");
});

test("the classic sites land on ground that can be reached from the start", () => {
  const cw = make();
  cw.activate();
  const hearth = content.scaleTile(30, 33);
  assert.deepEqual(hearth, cw.start, "the hearth is the start");
  const seen = new Set();
  for (const n of content.NPCS) {
    const p = content.scaleTile(n.tx, n.ty);
    assert.ok(chunks.walkableAt(chart, p.tx, p.ty), `${n.name ?? n.id} stands on unwalkable ground`);
    // Townsfolk drawn around the hearth stay a short walk from it; the ones who lived out on the coast or in the
    // hills keep their bearing and are a journey away.
    const design = Math.hypot(n.tx - 30, n.ty - 33);
    const d = Math.hypot(p.tx - cw.start.tx, p.ty - cw.start.ty);
    if (design <= 8) assert.ok(d < 20, `${n.name ?? n.id} lives in town but is ${Math.round(d)} tiles from the hearth`);
    else assert.ok(d < 450, `${n.name ?? n.id} is ${Math.round(d)} tiles away`);
    seen.add(`${p.tx},${p.ty}`);
  }
  assert.equal(seen.size, content.NPCS.length, "no two townsfolk share a tile");
  for (const p of content.POIS) {
    if (!("tx" in p) || p.kind === "hearth") continue;
    const a = content.scaleTile(p.tx, p.ty);
    assert.ok(chunks.walkableAt(chart, a.tx, a.ty), `${p.id} is on unwalkable ground`);
  }
  for (const t of worldMod.TAVERNS) assert.ok(chunks.walkableAt(chart, t.tx, t.ty), `${t.name} is on unwalkable ground`);
  // The far sites are a real walk away rather than all crowded round the hearth.
  const boss = content.POIS.filter((p) => p.kind === "boss").map((p) => content.scaleTile(p.tx, p.ty));
  assert.ok(boss.some((b) => Math.hypot(b.tx - cw.start.tx, b.ty - cw.start.ty) > 100), "the world bosses are out in the wilds");
});

test("resource nodes: choppable trees, ore, mushrooms and fishing spots", () => {
  const cw = make();
  cwm.streamChartWorld(cw, cw.start.tx, cw.start.ty);
  const nodes = nodesOf(cw);
  const kinds = new Set(nodes.map((n) => n.node));
  assert.ok(kinds.has("tree"), "trees can be chopped");
  const trees = nodes.filter((n) => n.node === "tree");
  assert.ok(trees.length > 100 && trees.length <= 4 * 320, `${trees.length} tree nodes`);
  for (const t of trees) {
    assert.ok(t.art && t.art.includes("/MapAssets/NewTex/tree_"), "a tree node carries its picture");
    const { tx, ty } = tileOf(t);
    const tile = cw.world.tiles[ty * cw.world.w + tx];
    assert.ok(!tile.layers?.some((l) => l === t.art), "the picture is on the node, not also left on the tile");
    assert.ok(!tile.decor, "and the tile no longer claims to be scenery");
  }
  for (const n of nodes) {
    assert.equal(n.kind, "node");
    assert.ok(chunks.walkableAt(chart, tileOf(n).tx, tileOf(n).ty), `node ${n.id} is on unwalkable ground`);
  }
});

// ---------------------------------------------------------------------------------------------------------
// The engine's half: its list of spawn points has to follow the regions.
// The engine class is far too large to import headlessly, so the real method is cut out of the source and run
// against a stand-in `this`. If the method changes shape this fails rather than quietly testing nothing.
// ---------------------------------------------------------------------------------------------------------
const engineSrc = readFileSync(resolve(HERE, "../src/game/engine.ts"), "utf8");

function methodBody(name) {
  const start = engineSrc.indexOf(`\n\t${name}(`);
  assert.ok(start > 0, `engine.ts has no ${name}() method`);
  const open = engineSrc.indexOf("{", engineSrc.indexOf(")", start));
  let depth = 0;
  for (let i = open; i < engineSrc.length; i++) {
    if (engineSrc[i] === "{") depth++;
    else if (engineSrc[i] === "}" && --depth === 0) return { params: engineSrc.slice(engineSrc.indexOf("(", start) + 1, engineSrc.indexOf(")", start)), body: engineSrc.slice(open + 1, i) };
  }
  throw new Error(`unterminated ${name}`);
}

function engineStandIn(cw) {
  const calls = [];
  const { params, body } = methodBody("applyStream");
  const invalidateTerrain = (w) => calls.push(["invalidateTerrain", w === cw.world]);
  const applyStream = new Function("invalidateTerrain", `return function(${params}) {${body}}`)(invalidateTerrain);
  const me = {
    world: cw.world, clock: 0, mapImg: {}, mobs: [], dormant: [], calls,
    applyTakenNodes: (m) => calls.push(["applyTakenNodes", m]),
    applyCampGround: (m) => calls.push(["applyCampGround", m]),
  };
  me.applyStream = applyStream;
  return me;
}

test("engine: new ground brings its camps in as spawn points, and nothing else", () => {
  const cw = make();
  const me = engineStandIn(cw);
  // A boss is not a camp: it is built up front and never goes dormant.
  me.applyStream(cwm.streamChartWorld(cw, cw.start.tx, cw.start.ty));
  const camps = mobsOf(cw).filter((m) => !m.boss);
  assert.equal(me.dormant.length, camps.length, "every camp foe is waiting as a spawn point");
  assert.ok(me.dormant.every((d) => d.spec && d.x === d.spec.x && d.y === d.spec.y), "each waits where it belongs");
  assert.ok(me.calls.some((c) => c[0] === "applyTakenNodes" && c[1] === "world"), "used-up nodes stay used up on rebuilt ground");
  assert.ok(me.calls.some((c) => c[0] === "applyCampGround" && c[1] === "world"), "cleared camp ground stays cleared");
  assert.ok(me.calls.some((c) => c[0] === "invalidateTerrain" && c[1]), "the terrain picture is redrawn");
  assert.equal(me.mapImg, null);
});

test("engine: dropping ground drops its foes, living or waiting, and keeps everyone else", () => {
  const cw = make();
  const me = engineStandIn(cw);
  me.applyStream(cwm.streamChartWorld(cw, cw.start.tx, cw.start.ty));
  // Wake some foes (as tickDormancy would) and add a world boss that belongs to no region.
  const woken = me.dormant.splice(0, 12).map((d) => ({ id: d.spec.id, fromSpawn: true, alive: true, x: d.x, y: d.y }));
  const boss = { id: "tide_tyrant", boss: true, fromSpawn: true, alive: true, x: 1, y: 1 };
  const bounty = { id: "bounty-1", bounty: true, alive: true, x: 2, y: 2 };
  me.mobs = [...woken, boss, bounty];

  const away = { tx: cw.start.tx < SIZE / 2 ? cw.start.tx + 480 : cw.start.tx - 480, ty: cw.start.ty };
  const res = cwm.streamChartWorld(cw, away.tx, away.ty);
  me.applyStream(res);

  const stillThere = new Set(cw.world.spawns.map((s) => s.id));
  for (const d of me.dormant) assert.ok(stillThere.has(d.spec.id), `a waiting foe ${d.spec.id} outlived its ground`);
  assert.ok(!me.mobs.some((m) => woken.includes(m) && res.removed.has(m.id)), "awake foes on dropped ground are gone");
  assert.ok(me.mobs.includes(boss), "a world boss is never dropped with a region");
  assert.ok(me.mobs.includes(bounty), "a bounty hunter chasing you is not tied to any region");
  const ids = me.dormant.map((d) => d.spec.id);
  assert.equal(new Set(ids).size, ids.length, "no foe is waiting twice");
});

test("engine: a foe that died and is waiting to respawn leaves with its ground", () => {
  const cw = make();
  const me = engineStandIn(cw);
  me.applyStream(cwm.streamChartWorld(cw, cw.start.tx, cw.start.ty));
  const away = { tx: cw.start.tx < SIZE / 2 ? cw.start.tx + 480 : cw.start.tx - 480, ty: cw.start.ty };
  const res = cwm.streamChartWorld(cw, away.tx, away.ty);
  // Pick a foe from ground that is about to go, and turn it into the waiting-to-respawn form tickDormancy keeps.
  const dead = me.dormant.find((d) => res.removed.has(d.spec.id));
  assert.ok(dead, "some waiting foe stood on ground that was dropped");
  dead.mob = { id: dead.spec.id, alive: false, respawn: 30 };
  delete dead.spec;
  const survivors = me.dormant.filter((d) => d !== dead).length;
  me.applyStream(res);
  assert.ok(!me.dormant.some((d) => d.mob?.id === dead.mob.id), "its respawn timer does not keep ticking on ground that is gone");
  assert.ok(me.dormant.length < survivors + 1 + res.added.filter((s) => s.kind === "mob").length, "and only dropped ground's foes went");
});

// ---------------------------------------------------------------------------------------------------------
// The wiring: each place the engine has to cooperate, read straight from the source.
// ---------------------------------------------------------------------------------------------------------
test("wiring: a new life, a loaded save and a rebirth all wait for the chart before touching anything", () => {
  const begin = methodBody("begin").body;
  assert.match(begin.slice(0, 400), /rolled \?\? rollLifeWorld\(\)/);
  assert.match(begin.slice(0, 600), /!this\.chartGate\(world, \(\) => this\.begin\(/, "begin waits for the chart");
  assert.ok(begin.indexOf("chartGate") < begin.indexOf("peekRuleSave"), "and does so before capturing progress or ghosts");

  const cont = methodBody("continueGame").body;
  assert.match(cont, /chartGate\(parsed\?\.world, \(\) => this\.continueGame\(\)\)/);
  assert.ok(cont.indexOf("chartGate") < cont.indexOf("this.boot("), "continueGame waits before booting");

  const reb = methodBody("rebirth").body;
  assert.match(reb, /chartGate\(nextWorld, \(\) => this\.rebirth\(/);
  assert.ok(reb.indexOf("chartGate") < reb.indexOf("save.name ="), "rebirth waits before changing the hunter");
  assert.match(reb, /save\.world = nextWorld \?\? rollLifeWorld\(\)/, "and uses the world it already rolled");
  assert.match(reb, /save\.chartFog = undefined/, "a new world starts with a blank chart");

  const gate = methodBody("chartGate").body;
  assert.match(gate, /!world\?\.chart \|\| cachedChart\(world\.seed\)\) return true/, "an ordinary or ready world never waits");
  assert.match(gate, /publish\(\{ charting: true \}\)/);
  assert.match(gate, /ensureChart\(world\.seed\)\.then\(done, done\)/, "a failed worker still resumes, building in place");
});

test("wiring: the ground is streamed before anything moves, and on every way of arriving", () => {
  const step = methodBody("step").body;
  assert.ok(step.indexOf("this.tickChartStream()") > 0);
  assert.ok(step.indexOf("this.tickChartStream()") < step.indexOf("this.tickPlayer("), "ground first, then movement");

  const load = methodBody("loadMap").body;
  assert.match(load, /if \(this\.chartWorld\) this\.reachTile\(save\.x \/ 32, save\.y \/ 32\)/, "loading the overworld builds the ground under the hunter");
  assert.match(load, /resetChartWorld\(cw\)/, "and starts from an empty world, not one left over from before");
  assert.ok(load.indexOf("this.reachTile(") < load.indexOf("this.applyTakenNodes(map)"), "ground before the node and camp fix-ups");
  assert.ok(load.indexOf("this.reachTile(") < load.indexOf("this.world.spawns.filter((s) => s.kind === \"mob\")"), "ground before the foes are listed");
  assert.match(load, /this\.syncChartStore\(map\)/);

  const fast = methodBody("fastTravelTo").body;
  assert.ok(fast.indexOf("this.reachTile(") > 0 && fast.indexOf("this.reachTile(") < fast.indexOf("nearestOpen("), "fast travel builds the destination before looking for a spot there");
});

test("wiring: the chart menu and the save follow the hunter", () => {
  assert.match(methodBody("persist").body, /fogForSave\(\)[\s\S]*chartFog = \{ seed: this\.chartWorld\.chart\.seed, fog \}/, "what she has charted is saved with the seed it belongs to");
  const sync = methodBody("syncChartStore").body;
  assert.match(sync, /seen\.seed === cw\.chart\.seed/, "another world's fog is never shown on this one");
  assert.match(sync, /clearActiveChart\(\)/, "inside a dungeon the chart menu steps aside");
  assert.match(methodBody("mapTerrainImage").body, /this\.chartWorld && world === this\.chartWorld\.world\) return null/, "no bitmap of six million tiles");
  const tick = methodBody("tickChartStream").body;
  assert.match(tick, /noteVisited\(tx, ty\)/);
  assert.match(tick, /save\.map !== "world"/, "nothing is streamed inside a dungeon");
});

test("wiring: new lives are chart worlds, old characters keep theirs", () => {
  const life = readFileSync(resolve(HERE, "../src/game/life-world.ts"), "utf8");
  assert.match(life, /gen: WORLD_GEN, chart: true/, "a freshly rolled world is a chart world");
  assert.match(life, /if \(w\.chart\) \{/, "and only a world marked as one is built from the chart");
  const main = readFileSync(resolve(HERE, "../src/game/main-world.ts"), "utf8");
  assert.match(main, /file\.chartSeed !== undefined/, "the old site layout is not applied over a chart world's");
});
