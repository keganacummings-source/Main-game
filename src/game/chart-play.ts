/**
 * The live TURBZ wild, cut from the world chart.
 *
 * The chart is 2500×2500 tiles of typed arrays. The engine still walks one
 * WorldData, so only a window around the hunter is ever turned into tiles.
 * Walking to the edge slides that window and shifts everything that lives in
 * world space by the same amount, which is what makes the continent one place
 * instead of a stack of rooms.
 *
 * Four calls, and this file is all of them:
 *   beginChart      world creation — generateChart + setActiveChart + start tile
 *   presentChart    terrain — the window the engine collides with and draws
 *   tickChartPlay   movement — fog, and a slide when the hunter nears the edge
 *   stampChartSave  save — fog, chart position, mined tiles
 */
import { TILE } from "./content";
import { fogForSave, noteVisited, setActiveChart } from "./chart-store";
import { isChopTreeArt } from "./map-format";
import { FL } from "./tex-world";
import { BIOME, generateChart, isWater, startSpot, type WorldChart } from "./world-chart";
import { buildWindow, chartTileSolid, type RegionWorld } from "./world-chunks";

/** Tiles on a side of the live window. Small enough to stay cheap, large enough that a slide is rare. */
export const CHART_WIN = 176;
/** Slide before the engine's hard border (the outer two tiles are always walls). */
const EDGE = 34;

export type ChartPlay = {
  chart: WorldChart;
  originX: number;
  originY: number;
  w: number;
  h: number;
  /** Mined chart tiles, "cx,cy". The save's local indices are rebuilt from this. */
  mined: Set<string>;
};

export function windowAround(chart: WorldChart, tx: number, ty: number, win = CHART_WIN): { ox: number; oy: number; w: number; h: number } {
  const w = Math.min(win, chart.w);
  const h = Math.min(win, chart.h);
  const ox = Math.max(0, Math.min(chart.w - w, tx - Math.floor(w / 2)));
  const oy = Math.max(0, Math.min(chart.h - h, ty - Math.floor(h / 2)));
  return { ox, oy, w, h };
}

function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Trees become choppable nodes (the same pass mapToWorld does) and a few ore
 * and mushroom nodes are scattered by biome. Ids are chart coordinates, so a
 * node you used up stays used up when the window slides away and back.
 */
export function dressWindow(chart: WorldChart, world: RegionWorld): void {
  const spawns: RegionWorld["spawns"] = [];
  for (let y = 0; y < world.h; y++) {
    for (let x = 0; x < world.w; x++) {
      const t = world.tiles[y * world.w + x]!;
      const cx = world.originX + x;
      const cy = world.originY + y;
      const layers = t.layers ?? [];
      const trees = layers.filter((l) => isChopTreeArt(l));
      if (t.decor === 1 || trees.length) {
        if (trees.length) {
          const rest = layers.filter((l) => !isChopTreeArt(l));
          t.layers = rest.length ? rest : undefined;
        }
        if (t.decor === 1) t.decor = 0;
        spawns.push({
          id: `tree-${cx}-${cy}`, kind: "node", node: "tree",
          x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, level: 1,
          ...(trees[0] ? { art: trees[0] } : {}),
        });
        continue;
      }
      if (t.block || t.floor === FL.water || t.floor === FL.lava) continue;
      const b = chart.biome[cy * chart.w + cx]!;
      const r = hash(cx, cy, chart.seed + 91);
      const px = (x + 0.5) * TILE;
      const py = (y + 0.5) * TILE;
      if ((b === BIOME.highland || b === BIOME.volcanic || b === BIOME.desert) && r < 0.012) {
        spawns.push({ id: `ore-${cx}-${cy}`, kind: "node", node: "ore", x: px, y: py, level: 1 });
      } else if ((b === BIOME.swamp || b === BIOME.jungle || b === BIOME.forest) && r < 0.008) {
        spawns.push({ id: `shroom-${cx}-${cy}`, kind: "node", node: "shroom", x: px, y: py, level: 1 });
      }
    }
  }
  world.spawns = spawns;
}

const CAMP: Record<number, { pool: string[]; lo: number; hi: number }> = {
  [BIOME.beach]: { pool: ["hare", "crow", "kusa"], lo: 1, hi: 2 },
  [BIOME.plains]: { pool: ["hare", "boar", "kusa", "yanagi"], lo: 1, hi: 3 },
  [BIOME.forest]: { pool: ["boar", "stag", "mokuzu", "umoregi", "tsuchi"], lo: 2, hi: 5 },
  [BIOME.savanna]: { pool: ["boar", "hare", "kusa", "kaze"], lo: 2, hi: 5 },
  [BIOME.desert]: { pool: ["boar", "crow", "tsuchi", "hinotama"], lo: 3, hi: 7 },
  [BIOME.swamp]: { pool: ["crow", "shizuku", "nami", "wisp"], lo: 2, hi: 6 },
  [BIOME.jungle]: { pool: ["boar", "uroko", "kasa", "mokuzu"], lo: 3, hi: 7 },
  [BIOME.taiga]: { pool: ["wolf", "stag", "yuki", "kaze"], lo: 3, hi: 7 },
  [BIOME.tundra]: { pool: ["wolf", "hare", "yuki", "hikari"], lo: 4, hi: 8 },
  [BIOME.glacier]: { pool: ["wolf", "yuki", "kaze"], lo: 5, hi: 9 },
  [BIOME.highland]: { pool: ["wolf", "stag", "gaikotsu", "yami"], lo: 5, hi: 10 },
  [BIOME.volcanic]: { pool: ["boar", "onibi", "nobi", "hinotama"], lo: 6, hi: 12 },
  [BIOME.void]: { pool: ["crow", "kage", "yomi", "muma"], lo: 8, hi: 14 },
};

/**
 * Wildlife camps on open ground. Ids are chart coordinates, so a camp is the
 * same camp when the window slides away and back, and the engine's dormancy
 * only wakes the ones near the hunter.
 */
export function seedWildlife(chart: WorldChart, world: RegionWorld, avoid?: { tx: number; ty: number }): void {
  // One camp every few screens, not a fight on every other tile. The engine
  // only wakes the camp nearest the hunter, so this spacing is what she meets.
  const step = 36;
  for (let y = 8; y < world.h - 8; y += step) {
    for (let x = 8; x < world.w - 8; x += step) {
      const jx = Math.floor(hash(x, y, chart.seed + 3) * 11) - 5;
      const jy = Math.floor(hash(y, x, chart.seed + 5) * 11) - 5;
      const tx = Math.max(4, Math.min(world.w - 5, x + jx));
      const ty = Math.max(4, Math.min(world.h - 5, y + jy));
      if (avoid && (tx - avoid.tx) ** 2 + (ty - avoid.ty) ** 2 < 22 * 22) continue;
      const t = world.tiles[ty * world.w + tx];
      if (!t || t.block || t.floor === FL.water || t.floor === FL.lava) continue;
      const cx = world.originX + tx;
      const cy = world.originY + ty;
      if (isWater(chart.biome[cy * chart.w + cx]!) || chartTileSolid(chart, cx, cy)) continue;
      const roll = hash(cx, cy, chart.seed + 17);
      if (roll > 0.55) continue;
      const spec = CAMP[chart.biome[cy * chart.w + cx]!] ?? CAMP[BIOME.plains]!;
      const level = spec.lo + Math.floor(hash(cx, cy, chart.seed + 23) * (spec.hi - spec.lo + 1));
      const species = spec.pool[Math.floor(hash(cx, cy, chart.seed + 19) * spec.pool.length)]!;
      world.spawns.push({
        id: `foe-${cx}-${cy}-0`,
        kind: "mob",
        species,
        x: (tx + 0.5) * TILE,
        y: (ty + 0.5) * TILE,
        level,
        fixedLevel: true,
        zone: {
          id: `camp-${cx}-${cy}`,
          tx, ty, tw: 3, th: 3,
          levelMin: spec.lo, levelMax: spec.hi,
          species: spec.pool,
          count: 1,
          respawn: 90,
        },
      });
    }
  }
}

function fileFor(play: ChartPlay, world: RegionWorld) {
  const regions: { id: string; name: string; kind: string; tx: number; ty: number; tw: number; th: number; about?: string }[] = [];
  for (const c of play.chart.continents) {
    const x0 = Math.max(c.x0, play.originX);
    const y0 = Math.max(c.y0, play.originY);
    const x1 = Math.min(c.x1, play.originX + world.w - 1);
    const y1 = Math.min(c.y1, play.originY + world.h - 1);
    if (x1 < x0 || y1 < y0) continue;
    regions.push({
      id: `land-${c.id}`, name: c.name, kind: "region",
      tx: x0 - play.originX, ty: y0 - play.originY, tw: x1 - x0 + 1, th: y1 - y0 + 1,
      about: c.island ? "An island off the continent" : "The continent",
    });
  }
  for (const p of play.chart.places) {
    if (p.tx < play.originX || p.ty < play.originY || p.tx >= play.originX + world.w || p.ty >= play.originY + world.h) continue;
    regions.push({
      id: p.id, name: p.name, kind: p.kind === "settlement" ? "city" : "landmark",
      tx: p.tx - play.originX, ty: p.ty - play.originY, tw: 5, th: 5, about: p.biome,
    });
  }
  return {
    version: 1, id: "turbz", name: world.name || "TURBZ", w: world.w, h: world.h, tileSize: TILE,
    tiles: [] as unknown[], regions, npcs: [] as unknown[], quests: [] as unknown[], interactables: [] as unknown[], zones: [] as unknown[],
  };
}

function cut(play: ChartPlay, avoid?: { tx: number; ty: number }): RegionWorld {
  const world = buildWindow(play.chart, play.originX, play.originY, play.w, play.h);
  dressWindow(play.chart, world);
  seedWildlife(play.chart, world, avoid);
  world.swim = true;
  return world;
}

/** Fold the window's local mined indices into chart coordinates. */
export function absorbMines(play: ChartPlay, local: number[] | undefined, worldW: number): void {
  if (!local?.length || worldW <= 0) return;
  for (const i of local) {
    if (!Number.isInteger(i) || i < 0) continue;
    const lx = i % worldW;
    const ly = Math.floor(i / worldW);
    play.mined.add(`${play.originX + lx},${play.originY + ly}`);
  }
}

function minedLocal(play: ChartPlay, world: RegionWorld): number[] {
  const out: number[] = [];
  for (const key of play.mined) {
    const cutAt = key.indexOf(",");
    const cx = Number(key.slice(0, cutAt));
    const cy = Number(key.slice(cutAt + 1));
    const lx = cx - play.originX;
    const ly = cy - play.originY;
    if (lx >= 0 && ly >= 0 && lx < world.w && ly < world.h) out.push(ly * world.w + lx);
  }
  return out;
}

/** Hand the engine the current window. Does not move the hunter. */
export function presentChart(game: any): void {
  const play = game.chartPlay as ChartPlay | undefined;
  const save = game.save;
  if (!play || !save) return;
  // Only fold local indices when the live world is this window. A dungeon, or the
  // previous mode's map, uses the same index space for something else.
  if (game.world?.originX === play.originX && game.world?.originY === play.originY) {
    absorbMines(play, save.mined?.[save.map], game.world.w);
  }
  const tx = Math.floor((save.x ?? 0) / TILE);
  const ty = Math.floor((save.y ?? 0) / TILE);
  const world = cut(play, { tx, ty });
  game.world = world;
  game.turbzWorld = world;
  game.customFile = fileFor(play, world);
  game.mapNpcs = [];
  save.mined = save.mined ?? {};
  save.mined[save.map ?? "custom-turbz"] = minedLocal(play, world);
  world.cache = null;
  reconcileChartFoes(game);
}

function shiftBy(game: any, dtx: number, dty: number): void {
  const dx = dtx * TILE;
  const dy = dty * TILE;
  const save = game.save;
  const map = save?.map;
  const nudge = (o: any, xk = "x", yk = "y") => {
    if (!o) return;
    if (typeof o[xk] === "number") o[xk] += dx;
    if (typeof o[yk] === "number") o[yk] += dy;
  };
  nudge(save);
  nudge(game.cam);
  nudge(game.dest);
  if (Array.isArray(game.path)) for (const p of game.path) nudge(p);
  for (const mate of game.mates ?? []) nudge(mate);
  if (game.lastWalk && game.lastWalk.map === map) nudge(game.lastWalk);
  if (game.turbzPVLast && game.turbzPVLast.map === map) nudge(game.turbzPVLast);
  for (const m of game.mobs ?? []) {
    nudge(m);
    if (typeof m.homeX === "number") m.homeX += dx;
    if (typeof m.homeY === "number") m.homeY += dy;
    if (m.dest) nudge(m.dest);
  }
  for (const d of game.dormant ?? []) nudge(d);
  for (const f of game.floats ?? []) nudge(f);
  for (const c of save?.chests ?? []) if (!c.map || c.map === map) nudge(c);
  for (const p of save?.dungeons?.portals ?? []) nudge(p);
  for (const n of save?.nations ?? []) nudge(n);
  for (const g of save?.wildGhosts ?? []) if (!g.map || g.map === map) nudge(g);
  for (const f of save?.survival?.campfires ?? []) if (f.map === map) nudge(f);
  for (const l of save?.survival?.logs ?? []) if (l.map === map) { l.tx += dtx; l.ty += dty; }
  for (const b of save?.survival?.beds ?? []) if (b.map === map) { b.tx += dtx; b.ty += dty; }
  if (save?.ghostBox?.map === map) { save.ghostBox.tx += dtx; save.ghostBox.ty += dty; }
  if (save?.turbzChest?.map === map) { save.turbzChest.tx += dtx; save.turbzChest.ty += dty; }
  for (const rect of save?.campGround?.[map] ?? []) {
    rect[0] += dtx; rect[1] += dty; rect[2] += dtx; rect[3] += dty;
  }
}

/**
 * Enter the charted wild.
 *
 * `at` is a chart tile to wake on (a resumed run). Without it the hunter starts
 * on habitable ground of the main continent. Writes local x/y onto the save so
 * boot and loadMap land in the window.
 */
export function beginChart(game: any, seed: number, save: any, at?: { tx: number; ty: number }): ChartPlay {
  const seedN = (seed >>> 0) || 1;
  const chart = game.chartPlay?.chart?.seed === seedN ? game.chartPlay.chart as WorldChart : generateChart({ seed: seedN });
  const spot = at ?? startSpot(chart);
  const win = windowAround(chart, spot.tx, spot.ty, CHART_WIN);
  const mined = new Set<string>();
  if (Array.isArray(save?.chartMined)) {
    for (const k of save.chartMined) if (typeof k === "string") mined.add(k);
  }
  const play: ChartPlay = { chart, originX: win.ox, originY: win.oy, w: win.w, h: win.h, mined };
  game.chartPlay = play;
  setActiveChart(chart, save?.fog);
  if (save) {
    save.x = (spot.tx - win.ox) * TILE + TILE / 2;
    save.y = (spot.ty - win.oy) * TILE + TILE / 2;
    save.map = "custom-turbz";
    save.turbzSeed = seedN;
  }
  return play;
}

/** Fog, chart position and mined tiles, ready to drop into the TURBZ save. */
export function stampChartSave(game: any): void {
  const play = game.chartPlay as ChartPlay | undefined;
  const save = game.save;
  if (!play || !save || save.map !== "custom-turbz") return;
  if (game.world?.originX === play.originX && game.world?.originY === play.originY) {
    absorbMines(play, save.mined?.[save.map], game.world.w);
  }
  save.fog = fogForSave();
  save.chartX = play.originX * TILE + save.x;
  save.chartY = play.originY * TILE + save.y;
  save.chartMined = [...play.mined];
}

/**
 * Reveal fog under the hunter and slide the window when she nears its edge.
 * Returns true when the ground under her was rebuilt.
 */
export function tickChartPlay(game: any): boolean {
  const play = game.chartPlay as ChartPlay | undefined;
  const save = game.save;
  const world = game.world;
  if (!play || !save || !world || save.map !== "custom-turbz") return false;
  const tx = Math.floor(save.x / TILE);
  const ty = Math.floor(save.y / TILE);
  noteVisited(play.originX + tx, play.originY + ty);
  if (world.w < EDGE * 2 + 8 || world.h < EDGE * 2 + 8) return false;
  if (tx >= EDGE && ty >= EDGE && tx < world.w - EDGE && ty < world.h - EDGE) return false;
  const cx = play.originX + tx;
  const cy = play.originY + ty;
  const next = windowAround(play.chart, cx, cy, CHART_WIN);
  if (next.ox === play.originX && next.oy === play.originY) return false;
  const dtx = play.originX - next.ox;
  const dty = play.originY - next.oy;
  absorbMines(play, save.mined?.[save.map], world.w);
  shiftBy(game, dtx, dty);
  play.originX = next.ox;
  play.originY = next.oy;
  play.w = next.w;
  play.h = next.h;
  presentChart(game);
  const map = save.map;
  game.applyTakenNodes?.(map);
  game.applyCampGround?.(map);
  game.applyMined?.(map);
  game.syncSolids?.(map);
  game.refreshTerrain?.();
  return true;
}

/** Spread points across open ground in the live window, not across the whole chart. */
export function chartAnchors(play: ChartPlay, n: number, avoid?: { x: number; y: number }): { x: number; y: number }[] {
  const cand: { x: number; y: number }[] = [];
  const step = 6;
  for (let y = 8; y < play.h - 8; y += step) {
    for (let x = 8; x < play.w - 8; x += step) {
      const cx = play.originX + x;
      const cy = play.originY + y;
      const b = play.chart.biome[cy * play.chart.w + cx]!;
      if (isWater(b) || chartTileSolid(play.chart, cx, cy)) continue;
      const px = (x + 0.5) * TILE;
      const py = (y + 0.5) * TILE;
      if (avoid && Math.hypot(px - avoid.x, py - avoid.y) < 860) continue;
      cand.push({ x: px, y: py });
    }
  }
  if (!cand.length) {
    return Array.from({ length: n }, (_, i) => ({
      x: Math.min(play.w - 4, 10 + (i % 5) * 8) * TILE,
      y: Math.min(play.h - 4, 10 + Math.floor(i / 5) * 8) * TILE,
    }));
  }
  const out = [cand[Math.floor(hash(play.chart.seed, n, 1) * cand.length)]!];
  while (out.length < n && out.length < cand.length) {
    let best = cand[0]!;
    let bestD = -1;
    for (const p of cand) {
      let d = Infinity;
      for (const q of out) d = Math.min(d, (p.x - q.x) ** 2 + (p.y - q.y) ** 2);
      if (d > bestD) { bestD = d; best = p; }
    }
    if (bestD < 1) break;
    out.push(best);
  }
  while (out.length < n) out.push({ ...out[out.length % out.length]! });
  return out;
}

/**
 * Keep wildlife in step with the window. Camps that slid off are packed away
 * unless they are in a fight. Camps on ground that just streamed in are added.
 */
export function reconcileChartFoes(game: any): void {
  const world = game.world as RegionWorld | undefined;
  if (!world || !game.chartPlay) return;
  const maxX = world.w * TILE;
  const maxY = world.h * TILE;
  const inside = (x: number, y: number) => x > -TILE && y > -TILE && x < maxX + TILE && y < maxY + TILE;
  const kept: any[] = [];
  for (const d of game.dormant ?? []) {
    const x = d?.x ?? d?.mob?.x ?? 0;
    const y = d?.y ?? d?.mob?.y ?? 0;
    const mob = d?.mob;
    const fighting = !!(mob?.alive && (mob.aggro || (mob.hurt ?? 0) > 0));
    if (inside(x, y) || fighting) kept.push(d);
  }
  game.dormant = kept;
  const have = new Set<string>();
  for (const m of game.mobs ?? []) if (m?.id && String(m.id).startsWith("foe-")) have.add(m.id);
  for (const d of game.dormant) {
    const id = d?.spec?.id ?? d?.mob?.id;
    if (id) have.add(id);
  }
  for (const s of world.spawns ?? []) {
    if (s.kind !== "mob" || have.has(s.id)) continue;
    game.dormant.push({ spec: s, x: s.x, y: s.y, at: game.clock ?? 0 });
  }
}
