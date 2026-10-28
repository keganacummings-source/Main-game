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
import { BIOME, generateChart, startSpot, type ChartPlace, type WorldChart } from "./world-chart";
import { buildWindow, type RegionWorld } from "./world-chunks";

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

function cut(play: ChartPlay): RegionWorld {
  const world = buildWindow(play.chart, play.originX, play.originY, play.w, play.h);
  dressWindow(play.chart, world);
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
  const world = cut(play);
  game.world = world;
  game.turbzWorld = world;
  game.customFile = fileFor(play, world);
  game.mapNpcs = [];
  save.mined = save.mined ?? {};
  save.mined[save.map ?? "custom-turbz"] = minedLocal(play, world);
  world.cache = null;
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

/** Spread points across the chart's named places, in the current window's coordinates. */
export function chartAnchors(play: ChartPlay, n: number): { x: number; y: number }[] {
  const places = play.chart.places.filter((p) => p.kind === "settlement" || p.kind === "peak" || p.kind === "landmark");
  const picked: ChartPlace[] = [];
  if (places.length) {
    picked.push(places[Math.floor(hash(play.chart.seed, 1, 3) * places.length)]!);
    while (picked.length < Math.min(n, places.length)) {
      let best = places[0]!;
      let bestD = -1;
      for (const p of places) {
        if (picked.includes(p)) continue;
        let d = Infinity;
        for (const q of picked) d = Math.min(d, (p.tx - q.tx) ** 2 + (p.ty - q.ty) ** 2);
        if (d > bestD) { bestD = d; best = p; }
      }
      picked.push(best);
    }
  }
  const out = picked.map((p) => ({
    x: (p.tx - play.originX) * TILE + TILE / 2,
    y: (p.ty - play.originY) * TILE + TILE / 2,
  }));
  while (out.length < n) {
    const spot = startSpot(play.chart);
    out.push({
      x: (spot.tx - play.originX) * TILE + TILE / 2 + out.length * 48,
      y: (spot.ty - play.originY) * TILE + TILE / 2,
    });
  }
  return out;
}
