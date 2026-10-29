/**
 * The world chart as ground a hunter can walk on.
 *
 * The chart (world-chart.ts) is a 2500 x 2500 picture of what the world IS, and
 * world-chunks.ts can cut any 256 x 256 square of it into ordinary playable
 * tiles. This module is the part that makes those squares into a world the
 * ENGINE can live in:
 *
 *   - ONE `WorldData` the size of the whole chart, so every position in the game
 *     (the hunter, foes, campfires, nodes, saves, the chart menu) is a chart
 *     position and nothing ever has to be translated between a region and the
 *     world. Only the tiles near the hunter are real objects; the rest of
 *     `tiles` is `undefined`, which the engine reads as solid.
 *   - ENEMIES. A region is only terrain, so it brings no foes with it. Camps are
 *     laid on every region as it is built, the same shape the Map Builder's spawn
 *     zones expand to (`expandZones`), so the engine's proximity spawning, level
 *     handling and respawn timers treat them exactly like any other camp.
 *   - RESOURCE NODES. Trees, ore, mushrooms and fishing spots, as the node spawns
 *     the gathering code already expects.
 *   - SITES. The hearth, the townsfolk, shrines, taverns, dungeon doors and the
 *     three world bosses were laid out on an 84 x 60 grid. They are re-homed
 *     around the start the same way Veilreach does it (see main-world.ts).
 *
 * Everything is a pure function of the chart, so a region that is dropped and
 * cut again comes back identical, camps included.
 */
import { BIOME, startSpot, type WorldChart } from "./world-chart";
import { REGION, buildRegion, walkableAt } from "./world-chunks";
import { MONSTER_BY_ID, ANIMAL_BY_ID, NPCS, POIS, TILE, mulberry32, scaleTile, setTileRemap } from "./content";
import { MAP_VERSION, isChopTreeArt, type MapFile, type MapRegion } from "./map-format";
import { TAVERNS, relocateClassicSites, type Spawn, type Tile, type WorldData } from "./world";

/** Chart tiles around the hunter that are always built. Wider than any screen, so the edge is never seen. */
export const STREAM_RADIUS = 96;
/** A built region stays until it is this far away, so walking back and forth over a seam does not rebuild it. */
export const KEEP_RADIUS = 160;
/** No camp within this many tiles of the start: a new hunter wakes in peace. */
export const START_SAFE = 22;
/** No camp this close to a town, shrine, tavern or door. */
export const SITE_SAFE = 8;

const CAMP_CELL = 22;
const CAMP_SIZE = 10;
/** Tree nodes per region. The rest stay scenery, which keeps the node list (walked every frame) small. */
const TREE_CAP = 320;

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

/**
 * How tough foes are this far from the start.
 *
 * The old generator had one continent per tier, so the tiers came from which
 * continent you were on. There is one continent now, so distance from the start
 * does that job: level 1-4 at the hearth, climbing to about 70-105 at the far
 * edge of the land, the same span the old seven continents covered.
 */
export function levelBand(distance: number): { lo: number; hi: number } {
  const t = Math.max(0, Math.min(1, distance / 1200));
  const mid = 1 + 88 * Math.pow(t, 1.15);
  const lo = Math.max(1, Math.round(mid * 0.8 - 1));
  const hi = Math.max(lo + 2, Math.round(mid * 1.15 + 3));
  return { lo, hi };
}

// ---------------------------------------------------------------------------
// What lives where
// ---------------------------------------------------------------------------

type Theme = { monsters: string[]; animals: string[] };

const GREEN: Theme = { monsters: ["kusa", "yanagi", "mokuzu", "umoregi", "tsuchi", "hikari"], animals: ["hare", "boar", "stag"] };
const FROST: Theme = { monsters: ["yuki", "kaze", "raiju", "hikari"], animals: ["wolf", "stag", "hare"] };
const ASH: Theme = { monsters: ["onibi", "nobi", "hinotama", "kagaribi", "raiju"], animals: ["boar", "crow"] };
const TIDE: Theme = { monsters: ["shizuku", "nami", "uroko", "kasa", "wisp"], animals: ["crow", "hare"] };
const VOID: Theme = { monsters: ["kage", "yomi", "naraku", "muma", "yami"], animals: ["crow", "wolf"] };
const BONE: Theme = { monsters: ["gaikotsu", "muma", "yami", "saintling"], animals: ["crow", "wolf"] };

/** Which foes haunt which chart biome. Mirrors the themes the old generator gave its continents. */
const THEME: Record<number, Theme> = {
  [BIOME.beach]: TIDE,
  [BIOME.plains]: GREEN,
  [BIOME.forest]: GREEN,
  [BIOME.savanna]: { monsters: ["tsuchi", "kusa", "hinotama", "raiju"], animals: ["boar", "stag", "hare"] },
  [BIOME.desert]: ASH,
  [BIOME.swamp]: TIDE,
  [BIOME.jungle]: TIDE,
  [BIOME.taiga]: FROST,
  [BIOME.tundra]: FROST,
  [BIOME.glacier]: FROST,
  [BIOME.highland]: VOID,
  [BIOME.volcanic]: ASH,
  [BIOME.void]: BONE,
};

const known = (id: string) => !!(MONSTER_BY_ID[id] || ANIMAL_BY_ID[id]);

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

function h2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const cellRng = (seed: number, x: number, y: number) => mulberry32((Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(seed, 83492791)) >>> 0);

// ---------------------------------------------------------------------------
// The world
// ---------------------------------------------------------------------------

type Loaded = { key: string; rx: number; ry: number; prefix: string };
type Site = { tx: number; ty: number };

export type ChartWorld = {
  chart: WorldChart;
  /** Chart-sized. Only streamed regions hold tiles; every other slot is undefined (the engine reads that as solid). */
  world: WorldData;
  /** The overworld as the rest of the game sees it: regions, a start and no tiles. */
  file: MapFile;
  start: { tx: number; ty: number };
  loaded: Map<string, Loaded>;
  /** Towns, shrines, taverns and doors, in chart tiles. Camps keep clear of them. */
  sites: Site[];
  /** Makes this world's layout the one the classic sites (hearth, townsfolk, bosses) are read from. */
  activate: () => void;
};

export type StreamResult = {
  changed: boolean;
  /** Spawns that arrived with newly built regions. */
  added: Spawn[];
  /** Ids of spawns that left with regions that were dropped. */
  removed: Set<string>;
  /** Region keys built and dropped this call. */
  built: string[];
  dropped: string[];
};

const NOTHING: StreamResult = { changed: false, added: [], removed: new Set(), built: [], dropped: [] };

/** A chart-sized tile array that is entirely empty, kept as a fast packed array rather than a sparse one. */
function emptyTiles(n: number): Tile[] {
  const a: Tile[] = [];
  for (let i = 0; i < n; i++) a.push(undefined as unknown as Tile);
  return a;
}

const regionKey = (rx: number, ry: number) => `${rx},${ry}`;
const prefixOf = (rx: number, ry: number) => `cw${rx}.${ry}:`;

// ---------------------------------------------------------------------------
// Sites: where the classic hearth, townsfolk, shrines and bosses land
// ---------------------------------------------------------------------------

/** Design distance inside which a site is "the town": pulled in close to the hearth. */
const TOWN_DESIGN = 8;
/** Chart tiles per design tile inside the town, and outside it. */
const TOWN_SCALE = 1.6;
const FAR_SCALE = 10;

/** Land reachable on foot from the start, within a window: the places a site may be put. */
function reachWindow(chart: WorldChart, start: { tx: number; ty: number }, radius: number) {
  const x0 = Math.max(2, start.tx - radius), y0 = Math.max(2, start.ty - radius);
  const x1 = Math.min(chart.w - 3, start.tx + radius), y1 = Math.min(chart.h - 3, start.ty + radius);
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const mask = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0, tail = 0;
  const si = (start.ty - y0) * w + (start.tx - x0);
  mask[si] = 1;
  queue[tail++] = si;
  while (head < tail) {
    const i = queue[head++]!;
    const x = i % w, y = (i / w) | 0;
    if (x > 0 && !mask[i - 1] && walkableAt(chart, x0 + x - 1, y0 + y)) { mask[i - 1] = 1; queue[tail++] = i - 1; }
    if (x < w - 1 && !mask[i + 1] && walkableAt(chart, x0 + x + 1, y0 + y)) { mask[i + 1] = 1; queue[tail++] = i + 1; }
    if (y > 0 && !mask[i - w] && walkableAt(chart, x0 + x, y0 + y - 1)) { mask[i - w] = 1; queue[tail++] = i - w; }
    if (y < h - 1 && !mask[i + w] && walkableAt(chart, x0 + x, y0 + y + 1)) { mask[i + w] = 1; queue[tail++] = i + w; }
  }
  return { x0, y0, w, h, has: (x: number, y: number) => x >= x0 && y >= y0 && x < x0 + w && y < y0 + h && mask[(y - y0) * w + (x - x0)] === 1 };
}

/**
 * Re-homes the classic 84 x 60 sites onto the chart, around the start.
 *
 * Townsfolk and the taverns near the hearth stay a short walk from it; everything
 * else keeps its bearing and is spread out so that the far shrines and bosses are
 * a real journey. Each site is snapped to ground that can actually be walked to
 * from the start, so no one is ever left on an island or inside a mountain.
 */
function planSites(chart: WorldChart, start: { tx: number; ty: number }): { remap: (tx: number, ty: number) => { tx: number; ty: number }; activate: () => void; sites: Site[] } {
  const reach = reachWindow(chart, start, 560);
  const home = chart.continents.find((c) => !c.island) ?? chart.continents[0];
  const bx0 = Math.max(16, (home?.x0 ?? 0) + 24), bx1 = Math.min(chart.w - 17, (home?.x1 ?? chart.w) - 24);
  const by0 = Math.max(16, (home?.y0 ?? 0) + 24), by1 = Math.min(chart.h - 17, (home?.y1 ?? chart.h) - 24);
  const taken = new Set<number>();
  const cache = new Map<string, { tx: number; ty: number }>();

  const remap = (tx: number, ty: number) => {
    const key = `${tx},${ty}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const dx = tx - 30, dy = ty - 33;
    const dd = Math.hypot(dx, dy);
    const mapped = dd <= TOWN_DESIGN ? dd * TOWN_SCALE : TOWN_DESIGN * TOWN_SCALE + (dd - TOWN_DESIGN) * FAR_SCALE;
    const gx = Math.round(Math.max(bx0, Math.min(bx1, start.tx + (dd ? (dx / dd) * mapped : 0))));
    const gy = Math.round(Math.max(by0, Math.min(by1, start.ty + (dd ? (dy / dd) * mapped : 0))));
    let best: { tx: number; ty: number } | null = null;
    for (let r = 0; r <= 90 && !best; r++) {
      for (let oy = -r; oy <= r && !best; oy++) for (let ox = -r; ox <= r; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
        const x = gx + ox, y = gy + oy;
        if (!reach.has(x, y) || taken.has(y * chart.w + x)) continue;
        best = { tx: x, ty: y };
        break;
      }
    }
    best ??= { tx: start.tx, ty: start.ty };
    taken.add(best.ty * chart.w + best.tx);
    cache.set(key, best);
    return best;
  };
  const activate = () => { setTileRemap(remap); relocateClassicSites(); };
  activate();

  // Every site, once the remap is in: camps are laid clear of these.
  const sites: Site[] = [{ tx: start.tx, ty: start.ty }];
  for (const n of NPCS) { const p = scaleTile(n.tx, n.ty); sites.push({ tx: p.tx, ty: p.ty }); }
  for (const p of POIS) {
    if (p.kind === "npc" || !("tx" in p)) continue;
    const a = scaleTile(p.tx, p.ty);
    sites.push({ tx: a.tx, ty: a.ty });
  }
  for (const t of TAVERNS) { sites.push({ tx: t.tx, ty: t.ty }); sites.push({ tx: t.boardTx, ty: t.boardTy }); }
  return { remap, activate, sites };
}

// ---------------------------------------------------------------------------
// The overworld file
// ---------------------------------------------------------------------------

/**
 * The overworld as a `MapFile`, minus the tiles.
 *
 * The engine asks the main world's file for its start, its named places and its
 * quests. Handing it a real file means none of that code has to know the world
 * is streamed. `tiles` is deliberately empty: anything that walked it would
 * be walking six million tiles that are not there.
 */
function overworldFile(chart: WorldChart, start: { tx: number; ty: number }, id: string, name: string): MapFile {
  const regions: MapRegion[] = [];
  const dist = (tx: number, ty: number) => Math.hypot(tx - start.tx, ty - start.ty);
  const span = (tx: number, ty: number) => levelBand(dist(tx, ty));

  for (const c of chart.continents) {
    const { lo } = span(c.x0, c.y0);
    const far = span(c.x1, c.y1).hi;
    regions.push({
      id: `cont${c.id}`, name: c.name, kind: "region",
      tx: c.x0, ty: c.y0, tw: c.x1 - c.x0 + 1, th: c.y1 - c.y0 + 1,
      about: c.island ? "An island out in the sea." : `The great land. ${c.biomes.slice(0, 3).join(", ")}.`,
      levelMin: c.island ? lo : 1, levelMax: c.island ? far : Math.max(far, 90),
    });
  }
  for (const p of chart.places) {
    const kind: MapRegion["kind"] = p.kind === "settlement" ? "city" : p.kind === "water" ? "water" : "landmark";
    const half = p.kind === "settlement" ? 5 : p.kind === "water" ? 4 : 2;
    const b = span(p.tx, p.ty);
    regions.push({
      id: p.id, name: p.name, kind,
      tx: Math.max(0, p.tx - half), ty: Math.max(0, p.ty - half), tw: half * 2 + 1, th: half * 2 + 1,
      levelMin: b.lo, levelMax: b.hi,
    });
  }

  return {
    version: MAP_VERSION, id, name, w: chart.w, h: chart.h, tileSize: TILE,
    tiles: [], spawns: [], zones: [], interactables: [], npcs: [], quests: [],
    regions, spawn: { tx: start.tx, ty: start.ty }, kind: "world", seed: chart.seed, chartSeed: chart.seed,
  };
}

/** The name a chart world goes by, after its home land. */
export function chartWorldName(chart: WorldChart): string {
  const home = chart.continents.find((c) => !c.island) ?? chart.continents[0];
  return home ? `The ${home.name} Reaches` : `World ${chart.seed.toString(36).toUpperCase()}`;
}

/** Makes the playable world for a chart. Nothing is built yet: call `streamChartWorld` with the hunter's tile. */
export function createChartWorld(chart: WorldChart, id: string, name = chartWorldName(chart)): ChartWorld {
  const start = startSpot(chart);
  const { sites, activate } = planSites(chart, start);
  const world: WorldData = {
    w: chart.w, h: chart.h, tiles: emptyTiles(chart.w * chart.h), spawns: [], cache: null,
    entry: { x: start.tx * TILE + TILE / 2, y: start.ty * TILE + TILE / 2 }, name,
  };
  return { chart, world, file: overworldFile(chart, start, id, name), start, loaded: new Map(), sites, activate };
}

// A hunter is in one world at a time, but the engine asks for "the main world's file" from many places and
// expects the same answer each time. These are the worlds made so far, by id; two are plenty.
const made = new Map<string, ChartWorld>();

/** The playable world for a chart, made once per world id. */
export function openChartWorld(chart: WorldChart, id: string, name?: string): ChartWorld {
  const have = made.get(id);
  if (have && have.chart === chart) { made.delete(id); made.set(id, have); have.activate(); return have; }
  const cw = createChartWorld(chart, id, name);
  made.delete(id);
  made.set(id, cw);
  while (made.size > 2) {
    const oldest = made.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    made.delete(oldest);
  }
  return cw;
}

/** The playable world behind an overworld file made by `openChartWorld`, or null for any other file. */
export function chartWorldForFile(file: MapFile | null | undefined): ChartWorld | null {
  if (!file || file.chartSeed === undefined) return null;
  const cw = made.get(file.id);
  return cw && cw.chart.seed === file.chartSeed ? cw : null;
}

/** Only for tests: forget every world made. */
export function resetChartWorlds(): void {
  made.clear();
}

// ---------------------------------------------------------------------------
// Foes and nodes for a region
// ---------------------------------------------------------------------------

/** Within `r` tiles (a square, not a circle) of the start, a town, a shrine, a tavern or a door. */
const nearSite = (cw: ChartWorld, tx: number, ty: number, r: number) =>
  cw.sites.some((s) => Math.abs(s.tx - tx) <= r && Math.abs(s.ty - ty) <= r);

/** Whether a camp square centred here would reach into somewhere that has to stay peaceful. */
const campTooClose = (cw: ChartWorld, tx: number, ty: number) =>
  nearSite(cw, tx, ty, SITE_SAFE + (CAMP_SIZE >> 1)) ||
  (Math.abs(cw.start.tx - tx) <= START_SAFE + (CAMP_SIZE >> 1) && Math.abs(cw.start.ty - ty) <= START_SAFE + (CAMP_SIZE >> 1));

/**
 * Enemy camps for one region.
 *
 * The same recipe as the generated worlds: a 22-tile grid, a clean 10 x 10
 * square of open ground in each cell, a pool of foes that belong to that
 * biome, two or three of them (animals come three at a time) and a level taken
 * from how far from the start the square is. The result is the camp, spelled out
 * as the spawns `expandZones` would have produced, so the engine cannot tell the
 * difference.
 */
function campsFor(cw: ChartWorld, rx: number, ry: number, w: number, h: number): Spawn[] {
  const { chart } = cw;
  const ox = rx * REGION, oy = ry * REGION;
  const out: Spawn[] = [];
  const c0x = Math.floor(ox / CAMP_CELL), c1x = Math.floor((ox + w - 1) / CAMP_CELL);
  const c0y = Math.floor(oy / CAMP_CELL), c1y = Math.floor((oy + h - 1) / CAMP_CELL);

  for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
    const centreX = cx * CAMP_CELL + (CAMP_CELL >> 1), centreY = cy * CAMP_CELL + (CAMP_CELL >> 1);
    // A cell belongs to the region its centre is in, so no camp is laid twice along a seam.
    if (centreX < ox || centreY < oy || centreX >= ox + w || centreY >= oy + h) continue;
    const rng = cellRng(chart.seed + 311, cx, cy);

    let found: { x: number; y: number } | null = null;
    let spots: { x: number; y: number }[] = [];
    for (let a = 0; a < 7 && !found; a++) {
      const mx = centreX + (a === 0 ? 0 : Math.floor((rng() - 0.5) * 12));
      const my = centreY + (a === 0 ? 0 : Math.floor((rng() - 0.5) * 12));
      const zx = mx - (CAMP_SIZE >> 1), zy = my - (CAMP_SIZE >> 1);
      // The whole square must sit inside this region, which is the part that is built.
      if (zx < Math.max(ox, 3) || zy < Math.max(oy, 3) || zx + CAMP_SIZE > ox + w - 1 || zy + CAMP_SIZE > oy + h - 1) continue;
      if (zx + CAMP_SIZE > chart.w - 4 || zy + CAMP_SIZE > chart.h - 4) continue;
      if (campTooClose(cw, mx, my)) continue;
      const open: { x: number; y: number }[] = [];
      let wet = 0;
      for (let y = zy; y < zy + CAMP_SIZE; y++) for (let x = zx; x < zx + CAMP_SIZE; x++) {
        if (walkableAt(chart, x, y)) open.push({ x, y });
        else if (chart.biome[y * chart.w + x] === BIOME.lake || chart.biome[y * chart.w + x] === BIOME.ocean || chart.biome[y * chart.w + x] === BIOME.deep) wet++;
      }
      if (wet === 0 && open.length >= CAMP_SIZE * CAMP_SIZE * 0.8) { found = { x: zx, y: zy }; spots = open; }
    }
    if (!found) continue;

    const mid = found.y + (CAMP_SIZE >> 1);
    const theme = THEME[chart.biome[mid * chart.w + found.x + (CAMP_SIZE >> 1)]!];
    if (!theme) continue;
    const animal = rng() < 0.22 && theme.animals.some(known);
    const pool = (animal ? theme.animals : theme.monsters).filter(known);
    if (!pool.length) continue;
    const chosen = pool.length > 2 ? pool.filter(() => rng() < 0.6) : pool;
    const species = (chosen.length ? chosen : pool).slice(0, 4);

    const d = Math.hypot(found.x + (CAMP_SIZE >> 1) - cw.start.tx, mid - cw.start.ty);
    const band = levelBand(d);
    const count = animal ? 3 : 2 + Math.floor(rng() * 2);
    const zone = {
      id: `camp-${cx}.${cy}`, tx: found.x, ty: found.y, tw: CAMP_SIZE, th: CAMP_SIZE,
      levelMin: band.lo, levelMax: band.hi, species, count, respawn: 45 + Math.floor(rng() * 60),
    };

    // Which tiles the foes stand on: a deterministic shuffle, so a camp is the same every time it is built.
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = spots[i]!; spots[i] = spots[j]!; spots[j] = t;
    }
    for (let i = 0; i < Math.min(count, spots.length); i++) {
      const s = spots[i]!;
      out.push({
        id: `${prefixOf(rx, ry)}${zone.id}-${i}`,
        kind: "mob",
        species: species[Math.floor(rng() * species.length)]!,
        x: (s.x + 0.5) * TILE,
        y: (s.y + 0.5) * TILE,
        level: zone.levelMin + Math.floor(rng() * (zone.levelMax - zone.levelMin + 1)),
        fixedLevel: true,
        zone: { ...zone, species: [...species] },
      });
    }
  }
  return out;
}

/**
 * Resource nodes for one region, and the scenery they replace.
 *
 * A tree that can be chopped is a node spawn, and its picture comes off the tile
 * so it is not drawn twice. Only a share of the trees become nodes (the engine
 * walks the node list every frame); the rest stay as walkable scenery.
 */
function nodesFor(cw: ChartWorld, rx: number, ry: number, tiles: Tile[], w: number, h: number): Spawn[] {
  const { chart } = cw;
  const ox = rx * REGION, oy = ry * REGION;
  const prefix = prefixOf(rx, ry);
  const out: Spawn[] = [];
  const at = (x: number, y: number) => tiles[y * w + x];

  // Trees.
  const trees: number[] = [];
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i]!;
    if (t.decor === 1 && t.layers?.some((l) => isChopTreeArt(l))) trees.push(i);
  }
  const keep = Math.min(1, TREE_CAP / Math.max(1, trees.length));
  for (const i of trees) {
    const x = i % w, y = (i / w) | 0;
    if (h2(ox + x, oy + y, chart.seed + 77) >= keep) continue;
    const t = tiles[i]!;
    const art = t.layers!.find((l) => isChopTreeArt(l))!;
    const rest = t.layers!.filter((l) => l !== art);
    t.layers = rest.length ? rest : undefined;
    t.decor = 0;
    out.push({ id: `${prefix}t${x}.${y}`, kind: "node", node: "tree", art, x: (ox + x + 0.5) * TILE, y: (oy + y + 0.5) * TILE, level: 1 });
  }

  // Ore, mushrooms and fishing spots: one chance per 32 x 32 square.
  const CELL = 32;
  for (let cy = 0; cy < h; cy += CELL) for (let cx = 0; cx < w; cx += CELL) {
    const rng = cellRng(chart.seed + 523, ox + cx, oy + cy);
    const mid = chart.biome[(oy + Math.min(h - 1, cy + 16)) * chart.w + ox + Math.min(w - 1, cx + 16)]!;
    const rocky = mid === BIOME.highland || mid === BIOME.volcanic || mid === BIOME.void;
    const cold = mid === BIOME.tundra || mid === BIOME.glacier || mid === BIOME.taiga || mid === BIOME.desert || mid === BIOME.savanna;
    const wetland = mid === BIOME.swamp || mid === BIOME.jungle;
    const woods = mid === BIOME.forest;
    const want: ("ore" | "shroom" | "fish")[] = [];
    if (rng() < (rocky ? 0.5 : cold ? 0.14 : 0)) want.push("ore");
    if (rng() < (wetland ? 0.5 : woods ? 0.18 : 0)) want.push("shroom");
    if (rng() < 0.4) want.push("fish");
    for (const node of want) {
      for (let tries = 0; tries < 12; tries++) {
        const x = cx + Math.floor(rng() * Math.min(CELL, w - cx)), y = cy + Math.floor(rng() * Math.min(CELL, h - cy));
        const t = at(x, y);
        const gx = ox + x, gy = oy + y;
        if (!t || t.block || t.decor || t.layers?.length || !walkableAt(chart, gx, gy)) continue;
        // Nodes may grow right beside a town (a new hunter's first logs are there), just not on a doorstep.
        if (nearSite(cw, gx, gy, 2)) continue;
        if (node === "fish") {
          // A fishing spot is the shore: open ground with water right beside it.
          const wet = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => {
            const nx = gx + a!, ny = gy + b!;
            if (nx < 0 || ny < 0 || nx >= chart.w || ny >= chart.h) return false;
            const bi = chart.biome[ny * chart.w + nx]!;
            return bi === BIOME.lake || bi === BIOME.ocean || bi === BIOME.deep;
          });
          if (!wet) continue;
        }
        out.push({ id: `${prefix}${node[0]}${x}.${y}`, kind: "node", node, x: (gx + 0.5) * TILE, y: (gy + 0.5) * TILE, level: 1 });
        break;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

function span(chart: WorldChart, tx: number, ty: number, radius: number) {
  const rx0 = Math.max(0, Math.floor((tx - radius) / REGION)), rx1 = Math.min(Math.floor((chart.w - 1) / REGION), Math.floor((tx + radius) / REGION));
  const ry0 = Math.max(0, Math.floor((ty - radius) / REGION)), ry1 = Math.min(Math.floor((chart.h - 1) / REGION), Math.floor((ty + radius) / REGION));
  return { rx0, rx1, ry0, ry1 };
}

function unload(cw: ChartWorld, l: Loaded): void {
  const { world, chart } = cw;
  const ox = l.rx * REGION, oy = l.ry * REGION;
  const w = Math.min(REGION, chart.w - ox), h = Math.min(REGION, chart.h - oy);
  for (let y = 0; y < h; y++) {
    const row = (oy + y) * chart.w + ox;
    for (let x = 0; x < w; x++) world.tiles[row + x] = undefined as unknown as Tile;
  }
  cw.loaded.delete(l.key);
}

/**
 * Builds the regions around a tile and drops the ones left far behind.
 *
 * Cheap when nothing changes, which is almost every call: it works out which
 * regions the hunter should have and returns at once if they are the ones already
 * built. When it does change something, the result lists the spawns that came and
 * went so the engine can keep its own lists (foes waiting to be created, mobs
 * already created) in step.
 */
export function streamChartWorld(cw: ChartWorld, tx: number, ty: number): StreamResult {
  const { chart, world, loaded } = cw;
  const want = span(chart, tx, ty, STREAM_RADIUS);
  const keep = span(chart, tx, ty, KEEP_RADIUS);

  let missing = false;
  for (let ry = want.ry0; ry <= want.ry1 && !missing; ry++) for (let rx = want.rx0; rx <= want.rx1; rx++) {
    if (!loaded.has(regionKey(rx, ry))) { missing = true; break; }
  }
  let stale = false;
  for (const l of loaded.values()) {
    if (l.rx < keep.rx0 || l.rx > keep.rx1 || l.ry < keep.ry0 || l.ry > keep.ry1) { stale = true; break; }
  }
  if (!missing && !stale) return NOTHING;

  const removed = new Set<string>();
  const dropped: string[] = [];
  const built: string[] = [];
  const added: Spawn[] = [];

  if (stale) {
    const gone: Loaded[] = [];
    for (const l of loaded.values()) {
      if (l.rx < keep.rx0 || l.rx > keep.rx1 || l.ry < keep.ry0 || l.ry > keep.ry1) gone.push(l);
    }
    const prefixes = gone.map((l) => l.prefix);
    for (const l of gone) { unload(cw, l); dropped.push(l.key); }
    world.spawns = world.spawns.filter((s) => {
      if (!prefixes.some((p) => s.id.startsWith(p))) return true;
      removed.add(s.id);
      return false;
    });
  }

  for (let ry = want.ry0; ry <= want.ry1; ry++) for (let rx = want.rx0; rx <= want.rx1; rx++) {
    const key = regionKey(rx, ry);
    if (loaded.has(key)) continue;
    const region = buildRegion(chart, rx, ry);
    const ox = rx * REGION, oy = ry * REGION;
    const prefix = prefixOf(rx, ry);

    // Foes and nodes first: laying nodes takes the tree pictures off their tiles.
    const spawns = [...campsFor(cw, rx, ry, region.w, region.h), ...nodesFor(cw, rx, ry, region.tiles, region.w, region.h)];

    for (let y = 0; y < region.h; y++) {
      const row = (oy + y) * chart.w + ox;
      for (let x = 0; x < region.w; x++) world.tiles[row + x] = region.tiles[y * region.w + x]!;
    }

    // Anything a regrowing node left behind while this region was away is replaced by the fresh set.
    if (world.spawns.some((s) => s.id.startsWith(prefix))) world.spawns = world.spawns.filter((s) => !s.id.startsWith(prefix));
    for (const s of spawns) world.spawns.push(s);
    added.push(...spawns);
    loaded.set(key, { key, rx, ry, prefix });
    built.push(key);
  }

  world.cache = null;
  return { changed: true, added, removed, built, dropped };
}

/** Drops every built region and every spawn: the world as it was before anyone walked it. */
export function resetChartWorld(cw: ChartWorld): void {
  for (const l of [...cw.loaded.values()]) unload(cw, l);
  cw.world.spawns = [];
  cw.world.cache = null;
}

/** Whether the tile under a world position has been built. The engine treats an unbuilt tile as solid. */
export function builtAt(cw: ChartWorld, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= cw.chart.w || ty >= cw.chart.h) return false;
  return !!cw.world.tiles[ty * cw.chart.w + tx];
}

/** How many tiles are built right now, for tests and for anyone watching memory. */
export function builtTiles(cw: ChartWorld): number {
  let n = 0;
  for (const l of cw.loaded.values()) {
    const ox = l.rx * REGION, oy = l.ry * REGION;
    n += Math.min(REGION, cw.chart.w - ox) * Math.min(REGION, cw.chart.h - oy);
  }
  return n;
}
