/**
 * New Texture Mode.
 *
 * A second world generator that paints a TURBZ wild using ONLY the textures in /MapAssets/NewTex
 * (the turbz-asset-pack art). It never touches the old DCSS pack under the other /MapAssets folders.
 *
 *   • five biomes: Plains, Desert, Jungle/Swamp, Snow, Hell — one per continent, climbing the level ladder
 *   • ocean (shallow Water + DeepWater), lava, wooden cabins with logs, temple ruins, a tree for every biome
 *   • trees and portals are 64×64 and are drawn at their full size (see drawTallArt in tile-atlas.ts)
 *
 * `retextureDungeon` re-skins a generated dungeon (rift / crypt / kiln) with the same art, so the mode
 * covers the dungeons too. Both are deterministic: the same seed always rebuilds the same world.
 */
import { ANIMAL_BY_ID, MONSTER_BY_ID, TILE, mulberry32 } from "./content";
import { MAP_VERSION, type MapFile, type MapInteractable, type MapRegion, type MapTile, type SpawnZone } from "./map-format";
import type { WorldData } from "./world";

export const TEX_DIR = "/MapAssets/NewTex/";
const T = (n: string) => `${TEX_DIR}${n}.png`;

/** Every texture this mode may use. scripts/tex-world.test.mjs checks each file exists. */
export const TEX = {
  grass: T("grass"), flowers: T("grass_flowers"), dirt: T("dirt_floor"), stone: T("stone_floor"), sand: T("sand"),
  snow: T("snow"), ice: T("ice"), swampFloor: T("swamp_floor"), hellFloor: T("hell_floor"), templeFloor: T("temple_floor"), woodFloor: T("wood_floor"),
  stoneWall: T("stone_wall"), sandWall: T("sand_wall"), snowWall: T("snow_wall"), hellWall: T("hell_wall"), templeWall: T("temple_wall"), woodWall: T("wood_wall"),
  water: T("water"), deep: T("deep_water"), swamp: T("swamp"), lava: T("lava"),
  treePlains: T("tree_plains"), treeSwamp: T("tree_swamp"), treeDesert: T("tree_desert"), treeSnow: T("tree_snow"), treeHell: T("tree_hell"), treeVoid: T("tree_void"),
  voidWall: T("void_wall"), voidFloor: T("void_floor"),
  portal: T("portal"), log: T("log"), chest: T("chest"), bed: T("bed"), ghostbox: T("ghostbox"),
} as const;
export const TEX_FILES: string[] = Object.values(TEX);

/** Floor codes the engine understands. */
const FL = { grass: 0, wall: 1, water: 2, stone: 3, dirt: 4, snow: 5, bog: 6, void: 7, bone: 8, ash: 9, sand: 10, lava: 11 } as const;
/** Biome indices (world.ts BIOMES order). */
const BI = { void: 0, frost: 1, verdant: 2, crown: 3, bone: 4, tide: 5, ashen: 6 } as const;

export type TexBiome = "plains" | "desert" | "jungle" | "snow" | "hell" | "void";

type BiomeDef = {
  label: string;
  floor: number;
  biome: number;
  ground: string;
  /** Patches of a second ground, and how much of the land they take. */
  patch: string;
  patchFloor: number;
  patchAt: number;
  wall: string;
  tree: string;
  /** Forest: noise threshold and chance per tile. */
  forest: [number, number];
  /** Monsters and animals for camps, from the game's roster. */
  monsters: string[];
  animals: string[];
  names: string[];
  word: string;
  about: string;
};

const DEF: Record<TexBiome, BiomeDef> = {
  plains: {
    label: "Plains", floor: FL.grass, biome: BI.verdant, ground: TEX.grass, patch: TEX.dirt, patchFloor: FL.dirt, patchAt: 0.74, wall: TEX.stoneWall, tree: TEX.treePlains, forest: [0.6, 0.52],
    monsters: ["kusa", "yanagi", "mokuzu", "umoregi", "tsuchi", "hikari"], animals: ["hare", "boar", "stag"],
    names: ["Greenmarch", "Meadowmere", "Hearthwold", "Larkfield"], word: "Plains", about: "Rolling grass and old oak woods. The gentlest land.",
  },
  desert: {
    label: "Desert", floor: FL.sand, biome: BI.crown, ground: TEX.sand, patch: TEX.dirt, patchFloor: FL.dirt, patchAt: 0.76, wall: TEX.sandWall, tree: TEX.treeDesert, forest: [0.8, 0.3],
    monsters: ["tsuchi", "kusa", "kaze", "raiju", "hinotama"], animals: ["boar", "crow"],
    names: ["Sunscar", "Duneholm", "Ashar", "Goldwaste"], word: "Desert", about: "Dunes, dead trees and hidden oases.",
  },
  jungle: {
    label: "Jungle", floor: FL.bog, biome: BI.tide, ground: TEX.swampFloor, patch: TEX.grass, patchFloor: FL.grass, patchAt: 0.7, wall: TEX.stoneWall, tree: TEX.treeSwamp, forest: [0.46, 0.6],
    monsters: ["shizuku", "nami", "uroko", "kasa", "wisp", "mokuzu"], animals: ["crow", "hare"],
    names: ["Mirewood", "Vinereach", "Gloomfen", "Saltmire"], word: "Swamp", about: "Drowned jungle: weeping trees and black pools.",
  },
  snow: {
    label: "Snow", floor: FL.snow, biome: BI.frost, ground: TEX.snow, patch: TEX.ice, patchFloor: FL.snow, patchAt: 0.66, wall: TEX.snowWall, tree: TEX.treeSnow, forest: [0.62, 0.5],
    monsters: ["yuki", "kaze", "raiju", "hikari"], animals: ["wolf", "stag", "hare"],
    names: ["Frostveil", "Whitehollow", "Rimewatch", "Glacierhome"], word: "Tundra", about: "Drifts, ice and frozen pines.",
  },
  hell: {
    label: "Hell", floor: FL.ash, biome: BI.ashen, ground: TEX.hellFloor, patch: TEX.stone, patchFloor: FL.stone, patchAt: 0.76, wall: TEX.hellWall, tree: TEX.treeHell, forest: [0.74, 0.34],
    monsters: ["onibi", "nobi", "hinotama", "kagaribi", "raiju"], animals: ["boar", "crow"],
    names: ["Cinderfall", "Emberdeep", "Ashgrave", "Infernum"], word: "Wastes", about: "Hellbrick, lava rivers and charred trees. The deadliest land.",
  },
  void: {
    label: "Void", floor: FL.void, biome: BI.void, ground: TEX.voidFloor, patch: TEX.stone, patchFloor: FL.stone, patchAt: 0.78, wall: TEX.voidWall, tree: TEX.treeVoid, forest: [0.68, 0.4],
    monsters: ["kage", "yomi", "naraku", "muma"], animals: ["crow"],
    names: ["Starblight", "Nullgrave", "Hollowmire", "Voidbreach"], word: "Rift", about: "Starless rock and black trees. The deepest, deadliest land — drops Void Ore.",
  },
};
const ORDER: TexBiome[] = ["plains", "desert", "jungle", "snow", "hell", "void"];

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

function h2(x: number, y: number, s: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vn(x: number, y: number, s: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, s: number): number {
  let t = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < 4; i++) { t += vn(x * f, y * f, s + i * 131) * a; n += a; a *= 0.5; f *= 2; }
  return t / n;
}

/** Breadth-first distance (in tiles, capped) from every tile satisfying `src`. 255 means "further than cap". */
function distField(w: number, h: number, src: (i: number) => boolean, cap: number): Uint8Array {
  const d = new Uint8Array(w * h).fill(255);
  const q = new Int32Array(w * h);
  let qh = 0, qt = 0;
  for (let i = 0; i < w * h; i++) if (src(i)) { d[i] = 0; q[qt++] = i; }
  while (qh < qt) {
    const i = q[qh++]!, dv = d[i]!;
    if (dv >= cap) continue;
    const x = i % w, y = (i / w) | 0;
    if (x > 0 && d[i - 1] === 255) { d[i - 1] = dv + 1; q[qt++] = i - 1; }
    if (x < w - 1 && d[i + 1] === 255) { d[i + 1] = dv + 1; q[qt++] = i + 1; }
    if (y > 0 && d[i - w] === 255) { d[i - w] = dv + 1; q[qt++] = i - w; }
    if (y < h - 1 && d[i + w] === 255) { d[i + w] = dv + 1; q[qt++] = i + w; }
  }
  return d;
}

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------

export type TexWorldOptions = { id?: string; name?: string; seed: number; w?: number; h?: number };

type Site = { biome: TexBiome; x: number; y: number; r: number; levelMin: number; levelMax: number; island: boolean; name: string };

export function generateTexWorld(opts: TexWorldOptions): MapFile {
  const w = Math.max(128, Math.min(512, Math.floor(opts.w ?? 450)));
  const h = Math.max(128, Math.min(512, Math.floor(opts.h ?? 450)));
  const seed = opts.seed >>> 0 || 1;
  const rng = mulberry32(seed);
  const N = w * h;
  const at = (x: number, y: number) => y * w + x;
  const pick = <V,>(list: readonly V[]): V => list[Math.floor(rng() * list.length)]!;
  const mn = Math.min(w, h);
  const idn = { n: 0 };
  const nid = (p: string) => `${p}-${(idn.n++).toString(36)}`;

  // ---- sites: five continents on a ring (level ladder 1, 13, 25, 37, 49) and a few islands ----
  const sites: Site[] = [];
  const rot = rng() * Math.PI * 2;
  ORDER.forEach((biome, i) => {
    const a = rot + (i * 2 * Math.PI) / ORDER.length + (rng() - 0.5) * 0.25;
    const ring = mn * 0.31 * (0.95 + rng() * 0.1);
    sites.push({
      biome, x: w / 2 + Math.cos(a) * ring, y: h / 2 + Math.sin(a) * ring, r: mn * (0.145 + rng() * 0.015),
      levelMin: 1 + i * 12, levelMax: 12 + i * 12, island: false, name: `${pick(DEF[biome].names)} ${DEF[biome].word}`,
    });
  });
  // The middle of the ring: a temple isle for the brave.
  sites.push({ biome: pick(ORDER), x: w / 2, y: h / 2, r: mn * 0.05, levelMin: 40, levelMax: 55, island: true, name: "The Heart Isle" });
  for (let k = 0, tries = 0; k < 5 && tries < 200; tries++) {
    const r = mn * (0.02 + rng() * 0.018);
    const x = mn * 0.05 + 14 + rng() * (w - mn * 0.1 - 28), y = mn * 0.05 + 14 + rng() * (h - mn * 0.1 - 28);
    if (sites.some((s) => Math.hypot(s.x - x, s.y - y) < s.r * 1.5 + r * 1.6 + 6)) continue;
    const biome = pick(ORDER);
    const li = ORDER.indexOf(pick(ORDER));
    sites.push({ biome, x, y, r, levelMin: 1 + li * 12, levelMax: 12 + li * 12, island: true, name: `${pick(DEF[biome].names)} Isle` });
    k++;
  }

  // ---- land mask ----
  const land = new Uint8Array(N);
  const owner = new Int16Array(N).fill(-1);
  const elev = new Float32Array(N);
  for (let y = 3; y < h - 3; y++) {
    for (let x = 3; x < w - 3; x++) {
      const wob = fbm(x / 38, y / 38, seed + 5), wob2 = fbm(x / 11, y / 11, seed + 6);
      const k = 0.78 + 0.32 * wob + 0.08 * wob2;
      let best = -1, bv = 9;
      for (let s = 0; s < sites.length; s++) {
        const st = sites[s]!;
        const v = Math.hypot(x - st.x, y - st.y) / (st.r * k);
        if (v < bv) { bv = v; best = s; }
      }
      if (bv < 1) { const i = at(x, y); land[i] = 1; owner[i] = best; elev[i] = 1 - bv; }
    }
  }
  const landDist = distField(w, h, (i) => !!land[i], 8);
  const seaDist = distField(w, h, (i) => !land[i], 8);

  // ---- tiles ----
  const tiles: MapTile[] = new Array(N);
  const rock = new Uint8Array(N);
  const spawnSite = sites[0]!;
  const dcOf = (i: number) => { const s = sites[owner[i]!]!; return Math.hypot((i % w) - s.x, ((i / w) | 0) - s.y) / s.r; };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = at(x, y);
      if (!land[i]) {
        const near = landDist[i]! <= 4;
        tiles[i] = { floor: FL.water, biome: BI.tide, block: 0, decor: 0, sprite: near ? TEX.water : TEX.deep };
        continue;
      }
      const st = sites[owner[i]!]!;
      const def = DEF[st.biome];
      const dc = dcOf(i);
      const sea = seaDist[i]!;
      const inland = sea >= 4 && dc > 0.22;
      const noise = (sx: number, o: number) => fbm(x / sx, y / sx, seed + o);
      let t: MapTile = { floor: def.floor, biome: def.biome, block: 0, decor: 0, sprite: def.ground };

      // coast band
      if (sea <= 2) {
        if (st.biome === "plains" || st.biome === "jungle") t = { floor: FL.sand, biome: def.biome, block: 0, decor: 0, sprite: TEX.sand };
        else if (st.biome === "snow") t = { floor: FL.snow, biome: def.biome, block: 0, decor: 0, sprite: TEX.ice };
      } else {
        const patch = noise(10, 41);
        if (patch > def.patchAt) t = { floor: def.patchFloor, biome: def.biome, block: 0, decor: 0, sprite: def.patch };
        else if (st.biome === "plains" && h2(x, y, seed + 43) < 0.07) t = { floor: FL.grass, biome: def.biome, block: 0, decor: 0, sprite: TEX.flowers };
      }

      if (inland) {
        // ridges of rock
        const rockThr = { plains: 0.77, desert: 0.76, jungle: 0.8, snow: 0.75, hell: 0.73 }[st.biome];
        const m = noise(13, 21);
        if (m > rockThr && sea >= 5) {
          t = { floor: def.floor, biome: def.biome, block: 1, decor: 0, sprite: def.wall };
          rock[i] = 1;
        } else if (st.biome === "hell") {
          const pool = noise(16, 33) > 0.745;
          const river = Math.abs(noise(30, 35) - 0.5) < 0.009;
          if (pool || river) t = { floor: FL.lava, biome: def.biome, block: 1, decor: 0, sprite: TEX.lava };
        } else if (st.biome === "jungle") {
          if (noise(14, 37) > 0.62) t = { floor: FL.water, biome: def.biome, block: 0, decor: 0, sprite: TEX.swamp };
        } else if (st.biome === "desert") {
          if (noise(9, 39) > 0.86) t = { floor: FL.water, biome: def.biome, block: 0, decor: 0, sprite: TEX.water };
        } else {
          const lake = noise(18, 7);
          if (lake > 0.77) t = { floor: FL.water, biome: def.biome, block: 0, decor: 0, sprite: lake > 0.84 ? TEX.deep : TEX.water };
        }
      }
      tiles[i] = t;
    }
  }
  // Oasis and frozen-lake rims.
  for (let y = 4; y < h - 4; y++) {
    for (let x = 4; x < w - 4; x++) {
      const i = at(x, y), t = tiles[i]!;
      if (!land[i] || t.block || t.floor === FL.water || t.floor === FL.lava) continue;
      const b = sites[owner[i]!]!.biome;
      if (b !== "desert" && b !== "snow") continue;
      let wet = false;
      for (let dy = -1; dy <= 1 && !wet; dy++) for (let dx = -1; dx <= 1; dx++) {
        const n = tiles[at(x + dx, y + dy)]!;
        if (land[at(x + dx, y + dy)] && n.floor === FL.water && n.sprite !== TEX.deep) { wet = true; break; }
      }
      if (!wet) continue;
      if (b === "desert") tiles[i] = { floor: FL.grass, biome: t.biome, block: 0, decor: 0, sprite: TEX.grass };
      else tiles[i] = { floor: FL.snow, biome: t.biome, block: 0, decor: 0, sprite: TEX.ice };
    }
  }

  // ---- structures: wooden cabins and temple ruins ----
  const occupied = new Uint8Array(N);
  const open = (i: number) => !!land[i] && !tiles[i]!.block && tiles[i]!.floor !== FL.water && tiles[i]!.floor !== FL.lava;
  const spawnTile = { x: Math.round(spawnSite.x), y: Math.round(spawnSite.y) };
  // The starting clearing.
  for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
    const x = spawnTile.x + dx, y = spawnTile.y + dy, i = at(x, y);
    if (Math.hypot(dx, dy) > 7.2) continue;
    occupied[i] = 2;
    if (tiles[i]!.block || tiles[i]!.floor === FL.water || tiles[i]!.floor === FL.lava) tiles[i] = { floor: FL.grass, biome: BI.verdant, block: 0, decor: 0, sprite: TEX.grass };
  }
  const fits = (x0: number, y0: number, tw: number, th: number, si: number) => {
    for (let y = y0 - 1; y <= y0 + th; y++) for (let x = x0 - 1; x <= x0 + tw; x++) {
      if (x < 4 || y < 4 || x >= w - 4 || y >= h - 4) return false;
      const i = at(x, y);
      if (!open(i) || owner[i] !== si || seaDist[i]! < 3 || occupied[i]) return false;
    }
    return true;
  };
  const findSpot = (si: number, tw: number, th: number, tries = 400): { x: number; y: number } | null => {
    const s = sites[si]!;
    for (let k = 0; k < tries; k++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * s.r * 0.75;
      const x = Math.round(s.x + Math.cos(a) * d - tw / 2), y = Math.round(s.y + Math.sin(a) * d - th / 2);
      if (fits(x, y, tw, th, si)) return { x, y };
    }
    return null;
  };
  const mark = (x0: number, y0: number, tw: number, th: number) => { for (let y = y0 - 2; y < y0 + th + 2; y++) for (let x = x0 - 2; x < x0 + tw + 2; x++) occupied[at(x, y)] = 1; };
  const cabin = (x0: number, y0: number) => {
    const tw = 7, th = 5;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const i = at(x0 + x, y0 + y), edge = x === 0 || y === 0 || x === tw - 1 || y === th - 1;
      const door = y === th - 1 && x === 3;
      tiles[i] = edge && !door
        ? { floor: FL.stone, biome: tiles[i]!.biome, block: 1, decor: 0, sprite: TEX.woodWall }
        : { floor: FL.stone, biome: tiles[i]!.biome, block: 0, decor: 0, sprite: TEX.woodFloor };
    }
    // Logs stacked beside the door.
    const lx = x0 + 5, ly = y0 + th;
    if (open(at(lx, ly))) tiles[at(lx, ly)] = { ...tiles[at(lx, ly)]!, layers: [TEX.log] };
    if (open(at(lx - 4, ly))) tiles[at(lx - 4, ly)] = { ...tiles[at(lx - 4, ly)]!, layers: [TEX.log] };
    mark(x0, y0, tw, th);
  };
  const temple = (x0: number, y0: number) => {
    const tw = 13, th = 11;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
      const i = at(x0 + x, y0 + y), edge = x === 0 || y === 0 || x === tw - 1 || y === th - 1;
      const gate = (x === 6 && (y === 0 || y === th - 1)) || (y === 5 && (x === 0 || x === tw - 1));
      const broken = edge && !gate && h2(x0 + x, y0 + y, seed + 51) < 0.28;
      const pillar = !edge && (x === 3 || x === tw - 4) && (y === 3 || y === th - 4);
      tiles[i] = (edge && !gate && !broken) || pillar
        ? { floor: FL.stone, biome: tiles[i]!.biome, block: 1, decor: 0, sprite: TEX.templeWall }
        : { floor: FL.stone, biome: tiles[i]!.biome, block: 0, decor: 0, sprite: TEX.templeFloor };
    }
    mark(x0, y0, tw, th);
  };
  const templeAt: { x: number; y: number; si: number }[] = [];
  const cabinAt: { x: number; y: number }[] = [];
  // A cabin by the start, so a new witch has a roof and a few logs.
  {
    const x0 = spawnTile.x + 9, y0 = spawnTile.y - 8;
    for (let y = y0 - 1; y <= y0 + 5; y++) for (let x = x0 - 1; x <= x0 + 7; x++) {
      const i = at(x, y);
      if (!land[i] || tiles[i]!.floor === FL.water || tiles[i]!.floor === FL.lava || tiles[i]!.block) tiles[i] = { floor: FL.grass, biome: BI.verdant, block: 0, decor: 0, sprite: TEX.grass };
    }
    cabin(x0, y0); cabinAt.push({ x: x0, y: y0 });
  }
  sites.forEach((s, si) => {
    if (s.island) {
      const spot = findSpot(si, 13, 11, 300);
      if (spot) { temple(spot.x, spot.y); templeAt.push({ ...spot, si }); }
      return;
    }
    for (let k = 0; k < 3; k++) { const c = findSpot(si, 7, 5); if (c) { cabin(c.x, c.y); cabinAt.push(c); } }
    for (let k = 0; k < 2; k++) { const c = findSpot(si, 13, 11); if (c) { temple(c.x, c.y); templeAt.push({ ...c, si }); } }
  });

  // ---- make every open tile reachable from the start (walking, or swimming: water counts) ----
  const spawnI = at(spawnTile.x, spawnTile.y);
  {
    const seen = new Uint8Array(N);
    const stack = [spawnI];
    seen[spawnI] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w, y = (i / w) | 0;
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (j < 0 || j >= N || seen[j]) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === w - 1)) continue;
        if (tiles[j]!.block) continue;
        seen[j] = 1; stack.push(j);
      }
    }
    for (let i = 0; i < N; i++) {
      if (seen[i] || tiles[i]!.block) continue;
      const def = DEF[sites[Math.max(0, owner[i]!)]!.biome];
      tiles[i] = { floor: def.floor, biome: def.biome, block: 1, decor: 0, sprite: def.wall };
      rock[i] = 1;
    }
  }

  // ---- trees (spaced out so every 64px crown stands clear) and logs ----
  const treeAt = new Uint8Array(N);
  let treeCount = 0;
  const TREE_CAP = 6500;
  for (let y = 5; y < h - 5; y++) {
    for (let x = 5; x < w - 5; x++) {
      const i = at(x, y);
      if (!open(i) || occupied[i] || seaDist[i]! < 3 || treeCount >= TREE_CAP) continue;
      const t = tiles[i]!;
      const st = sites[owner[i]!]!, def = DEF[st.biome];
      const f = fbm(x / 9, y / 9, seed + 11);
      const scatter = st.biome === "desert" || st.biome === "hell" ? h2(x, y, seed + 13) < 0.012 : false;
      if (!((f > def.forest[0] && h2(x, y, seed + 12) < def.forest[1]) || scatter)) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (treeAt[at(x + dx, y + dy)]) { near = true; break; }
      if (near) continue;
      treeAt[i] = 1; treeCount++;
      tiles[i] = { ...t, layers: [def.tree] };
    }
  }
  // Fallen logs lie in the woods.
  for (let y = 6; y < h - 6; y++) {
    for (let x = 6; x < w - 6; x++) {
      const i = at(x, y);
      if (!treeAt[i] || h2(x, y, seed + 17) > 0.14) continue;
      const j = at(x + (h2(x, y, seed + 18) < 0.5 ? -1 : 1), y + 1);
      if (!open(j) || treeAt[j] || tiles[j]!.layers?.length || occupied[j] === 2) continue;
      tiles[j] = { ...tiles[j]!, layers: [TEX.log] };
    }
  }

  // ---- resource nodes: ore beside rock, fish beside water, mushrooms in the woods ----
  const interactables: MapInteractable[] = [];
  const nodeAt = new Uint8Array(N);
  const adjacent = (x: number, y: number, pred: (j: number) => boolean) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => pred(at(x + dx!, y + dy!)));
  const nodeOk = (x: number, y: number) => {
    const i = at(x, y);
    if (!open(i) || treeAt[i] || nodeAt[i] || occupied[i] === 2 || tiles[i]!.layers?.length) return false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (nodeAt[at(x + dx, y + dy)]) return false;
    return true;
  };
  const wantNodes: { node: "ore" | "fish" | "shroom"; per: number; test: (x: number, y: number, i: number) => boolean }[] = [
    { node: "ore", per: 16, test: (x, y) => adjacent(x, y, (j) => !!rock[j]) },
    { node: "fish", per: 14, test: (x, y) => adjacent(x, y, (j) => !!land[j] ? tiles[j]!.floor === FL.water : true) },
    { node: "shroom", per: 14, test: (x, y, i) => seaDist[i]! >= 4 && fbm(x / 9, y / 9, seed + 11) > 0.5 },
  ];
  sites.forEach((s, si) => {
    const scale = s.island ? 0.25 : 1;
    for (const want of wantNodes) {
      const target = Math.max(2, Math.round(want.per * scale));
      let placed = 0;
      for (let k = 0; k < 6000 && placed < target; k++) {
        const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * s.r * 0.95;
        const x = Math.round(s.x + Math.cos(a) * d), y = Math.round(s.y + Math.sin(a) * d);
        if (x < 5 || y < 5 || x >= w - 5 || y >= h - 5) continue;
        const i = at(x, y);
        if (owner[i] !== si || !nodeOk(x, y) || !want.test(x, y, i)) continue;
        nodeAt[i] = 1; placed++;
        interactables.push({ id: nid("node"), kind: "node", node: want.node, tx: x, ty: y });
      }
    }
  });

  // ---- camps: monsters on a level ladder, tougher the further from the coast ----
  const zones: SpawnZone[] = [];
  const keepMonsters = (list: string[]) => list.filter((s) => MONSTER_BY_ID[s] || ANIMAL_BY_ID[s]);
  const campFits = (zx: number, zy: number, tw: number, th: number) => {
    let ok = 0;
    for (let y = zy; y < zy + th; y++) for (let x = zx; x < zx + tw; x++) {
      if (x < 4 || y < 4 || x >= w - 4 || y >= h - 4) return false;
      const i = at(x, y);
      if (occupied[i]) return false;
      if (open(i)) ok++;
    }
    return ok >= tw * th * 0.85;
  };
  const CELL = 20;
  for (let cy = 6; cy < h - 16; cy += CELL) {
    for (let cx = 6; cx < w - 16; cx += CELL) {
      for (let a = 0; a < 4; a++) {
        const zx = cx + Math.floor(rng() * (CELL - 10)), zy = cy + Math.floor(rng() * (CELL - 10));
        const i = at(zx + 5, zy + 5);
        if (!land[i] || owner[i]! < 0 || !campFits(zx, zy, 10, 10)) continue;
        const st = sites[owner[i]!]!, def = DEF[st.biome];
        const far = Math.min(1, dcOf(i));
        const lo = Math.round(st.levelMin + (st.levelMax - st.levelMin) * far * 0.6);
        const hi = Math.max(lo, Math.round(st.levelMin + (st.levelMax - st.levelMin) * Math.min(1, far * 0.6 + 0.4)));
        const animal = rng() < 0.22 && def.animals.length > 0;
        const pool = keepMonsters(animal ? def.animals : def.monsters);
        const chosen = pool.length > 2 ? pool.filter(() => rng() < 0.6) : pool;
        zones.push({ id: nid("camp"), tx: zx, ty: zy, tw: 10, th: 10, levelMin: Math.max(1, lo), levelMax: Math.max(1, hi), species: (chosen.length ? chosen : pool).slice(0, 4), count: animal ? 3 : 2 + Math.floor(rng() * 2), respawn: 45 + Math.floor(rng() * 60) });
        for (let y = zy - 1; y < zy + 11; y++) for (let x = zx - 1; x < zx + 11; x++) occupied[at(x, y)] = occupied[at(x, y)] || 1;
        break;
      }
    }
  }
  // Temple ruins are infested: a tougher camp inside.
  for (const tp of templeAt) {
    const st = sites[tp.si]!, def = DEF[st.biome];
    const lv = Math.min(st.levelMax + 4, st.levelMax);
    const pool = keepMonsters(def.monsters);
    zones.push({ id: nid("ruin"), tx: tp.x + 2, ty: tp.y + 2, tw: 9, th: 7, levelMin: Math.max(1, lv - 2), levelMax: lv + 2, species: pool.slice(0, 3), count: 4, respawn: 70 });
  }

  // ---- named lands ----
  const regions: MapRegion[] = [];
  sites.forEach((s, si) => {
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let i = 0; i < N; i++) if (owner[i] === si && land[i]) { const x = i % w, y = (i / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0) return;
    regions.push({ id: nid("land"), name: s.name, kind: "region", tx: x0, ty: y0, tw: x1 - x0 + 1, th: y1 - y0 + 1, about: s.island ? "A small isle across the water." : DEF[s.biome].about, levelMin: s.levelMin, levelMax: s.levelMax });
  });

  return {
    version: MAP_VERSION,
    id: opts.id ?? "turbz",
    name: opts.name ?? "New Texture World",
    w, h, tileSize: TILE, tiles,
    spawns: [], zones, interactables, npcs: [], quests: [], regions,
    spawn: { tx: spawnTile.x, ty: spawnTile.y },
    kind: "world",
    notes: `New Texture Mode world, seed ${seed}.`,
  };
}

// ---------------------------------------------------------------------------
// Dungeons
// ---------------------------------------------------------------------------

const treeForFloor = (floor: number): string =>
  floor === FL.sand ? TEX.treeDesert : floor === FL.bog ? TEX.treeSwamp : floor === FL.snow ? TEX.treeSnow : floor === FL.ash ? TEX.treeHell : TEX.treePlains;

function wallForFloor(floor: number, n: number): string {
  switch (floor) {
    case FL.ash: return TEX.hellWall;
    case FL.snow: return TEX.snowWall;
    case FL.sand: return TEX.sandWall;
    case FL.bog: return n % 3 === 0 ? TEX.woodWall : TEX.stoneWall;
    case FL.bone: return TEX.templeWall;
    case FL.stone: return n % 2 === 0 ? TEX.stoneWall : TEX.templeWall;
    default: return TEX.stoneWall;
  }
}

function floorForCode(floor: number, n: number, old: string | undefined): string {
  switch (floor) {
    case FL.grass: return n % 9 === 0 ? TEX.flowers : TEX.grass;
    case FL.dirt: return TEX.dirt;
    case FL.snow: return old && /ice/.test(old) ? TEX.ice : TEX.snow;
    case FL.bog: return TEX.swampFloor;
    case FL.bone: return TEX.templeFloor;
    case FL.ash: return TEX.hellFloor;
    case FL.sand: return TEX.sand;
    case FL.stone: return n % 3 === 0 ? TEX.templeFloor : TEX.stone;
    case FL.void: return TEX.stone;
    default: return TEX.stone;
  }
}

/** Re-skins a generated dungeon with the New Texture Mode art. Floors, walls, liquids, trees, portals and chests change; the layout, foes and pads do not. */
export function retextureDungeon(world: WorldData): void {
  const flagged = world as WorldData & { texMode?: boolean };
  if (flagged.texMode) return;
  flagged.texMode = true;
  const w = world.w;
  for (let i = 0; i < world.tiles.length; i++) {
    const t = world.tiles[i]!;
    const x = i % w, y = (i / w) | 0;
    const n = (Math.imul(x + 11, 73856093) ^ Math.imul(y + 7, 19349663)) >>> 0;
    if (t.decor > 0 && !t.sprite) continue; // hand-painted scenery with no art: leave it be
    // 1) liquids
    if (t.floor === FL.lava) { t.sprite = TEX.lava; t.layers = undefined; continue; }
    if (t.floor === FL.water) {
      t.sprite = t.sprite && /shallow|shoal|shore/.test(t.sprite) ? TEX.water : TEX.deep;
      t.layers = undefined;
      continue;
    }
    // 2) layers: trees, portals and chests stand over the tile; doors and scenery do not
    let turnsToWall = false;
    let layers: string[] | undefined;
    for (const l of t.layers ?? []) {
      if (/tree_|mangrove/.test(l)) (layers ??= []).push(treeForFloor(t.floor));
      else if (/06_Gates_and_Portals\//.test(l)) (layers ??= []).push(TEX.portal);
      else if (/chest|large_box/.test(l)) (layers ??= []).push(TEX.chest);
      else if (t.block) turnsToWall = true;
    }
    // 3) the ground itself
    if (t.block || turnsToWall) {
      t.sprite = wallForFloor(t.floor, n);
      t.block = 1;
      layers = undefined;
    } else {
      t.sprite = floorForCode(t.floor, n, t.sprite);
    }
    t.layers = layers;
    if (!t.layers) delete t.layers;
  }
}
