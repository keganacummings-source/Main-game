/**
 * New Texture Mode.
 *
 * A second world generator that paints a TURBZ wild using ONLY the textures in /MapAssets/NewTex
 * (the turbz-asset-pack art). It never touches the old DCSS pack under the other /MapAssets folders.
 *
 *   • six biomes: Plains, Desert, Jungle/Swamp, Snow, Hell, Void — one per continent, climbing the level ladder
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
  voidGrass: T("voidgrass"), voidRock: T("voidwall"), voidBrick: T("voidbrick"), voidHeart: T("voidheart"),
  portal: T("portal"), log: T("log"), chest: T("chest"), bed: T("bed"), ghostbox: T("ghostbox"),
  // Derived for the bigger world's extra biomes (scripts/sprites/world-decor.py).
  // Each one exists because the biome it dresses was otherwise indistinguishable
  // from a biome it is meant to contrast with.
  grassDry: T("grass_dry"), grassJungle: T("grass_jungle"),
  stoneHighland: T("stone_highland"), snowTundra: T("snow_tundra"),
  decorRocks: T("decor_rocks"), decorBones: T("decor_bones"), decorShrub: T("decor_shrub"),
} as const;
export const TEX_FILES: string[] = Object.values(TEX);
/** The same list as a set, for the per-tile checks in retextureDungeon. */
const TEX_FILE_SET = new Set<string>(TEX_FILES);

/** Floor codes the engine understands. Shared with world-chunks.ts. */
export const FL = { grass: 0, wall: 1, water: 2, stone: 3, dirt: 4, snow: 5, bog: 6, void: 7, bone: 8, ash: 9, sand: 10, lava: 11 } as const;
/** Biome indices (world.ts BIOMES order). Shared with world-chunks.ts. */
export const BI = { void: 0, frost: 1, verdant: 2, crown: 3, bone: 4, tide: 5, ashen: 6 } as const;

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
    label: "Void", floor: FL.void, biome: BI.void, ground: TEX.voidGrass, patch: TEX.voidGrass, patchFloor: FL.void, patchAt: 2, wall: TEX.voidRock, tree: TEX.treeVoid, forest: [0.68, 0.4],
    monsters: ["kage", "yomi", "naraku", "muma"], animals: ["crow"],
    names: ["Starblight", "Nullgrave", "Hollowmire", "Voidbreach"], word: "Rift", about: "Violet grass, starry rock and black trees. Void Hearts glow in the stone. The deepest, deadliest land — drops Void Ore.",
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

export type TexWorldOptions = { id?: string; name?: string; seed: number; w?: number; h?: number; single?: boolean };

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

  // ---- sites ----
  const sites: Site[] = [];
  const rot = rng() * Math.PI * 2;
  if (opts.single) {
    // ONE continent: the biome sites are packed near the centre and given big radii so their land
    // masks overlap into a single landmass with biome regions. No outer continents, no islands.
    const core = pick(ORDER);
    sites.push({ biome: core, x: w / 2, y: h / 2, r: mn * (0.185 + rng() * 0.02), levelMin: 1, levelMax: 14, island: false, name: `${pick(DEF[core].names)} Heartland` });
    ORDER.forEach((biome, i) => {
      const a = rot + (i * 2 * Math.PI) / ORDER.length + (rng() - 0.5) * 0.2;
      const ring = mn * 0.17 * (0.9 + rng() * 0.14);
      sites.push({
        biome, x: w / 2 + Math.cos(a) * ring, y: h / 2 + Math.sin(a) * ring, r: mn * (0.17 + rng() * 0.02),
        levelMin: 1 + i * 9, levelMax: 12 + i * 9, island: false, name: `${pick(DEF[biome].names)} ${DEF[biome].word}`,
      });
    });
  } else {
    // five continents on a ring (level ladder 1, 13, 25, 37, 49) and a few islands
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
        const rockThr = { plains: 0.77, desert: 0.76, jungle: 0.8, snow: 0.75, hell: 0.73, void: 0.74 }[st.biome];
        const m = noise(13, 21);
        if (m > rockThr && sea >= 5) {
          t = { floor: def.floor, biome: def.biome, block: 1, decor: 0, sprite: def.wall };
          // Void Hearts: crystal clusters grown into the rock (mineable like the stone they sit on).
          if (st.biome === "void" && h2(x, y, seed + 61) < 0.07) t.layers = [TEX.voidHeart];
          rock[i] = 1;
        } else if (st.biome === "hell") {
          const pool = noise(16, 33) > 0.745;
          const river = Math.abs(noise(30, 35) - 0.5) < 0.009;
          if (pool || river) t = { floor: FL.lava, biome: def.biome, block: 1, decor: 0, sprite: TEX.lava };
        } else if (st.biome === "jungle") {
          if (noise(14, 37) > 0.62) t = { floor: FL.water, biome: def.biome, block: 0, decor: 0, sprite: TEX.swamp };
        } else if (st.biome === "desert") {
          if (noise(9, 39) > 0.86) t = { floor: FL.water, biome: def.biome, block: 0, decor: 0, sprite: TEX.water };
        } else if (st.biome !== "void") {
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
      const door = y === th - 1 && x === 6;
      tiles[i] = edge && !door
        ? { floor: FL.stone, biome: tiles[i]!.biome, block: 1, decor: 0, sprite: tiles[i]!.biome === BI.void ? TEX.voidBrick : TEX.templeWall }
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

  // ---- villages: small clusters of houses so the wild has places to visit ----
  /** Wall / floor art that fits the biome. */
  const villageArt = (biome: TexBiome) => {
    if (biome === "desert") return { wall: TEX.sandWall, floor: TEX.sand, street: TEX.dirt };
    if (biome === "snow") return { wall: TEX.snowWall, floor: TEX.ice, street: TEX.snow };
    if (biome === "hell") return { wall: TEX.hellWall, floor: TEX.hellFloor, street: TEX.stone };
    if (biome === "void") return { wall: TEX.voidBrick, floor: TEX.voidFloor, street: TEX.voidGrass };
    // plains / jungle / swamp
    return { wall: TEX.woodWall, floor: TEX.woodFloor, street: TEX.dirt };
  };
  /**
   * Lays down a small village: a central plaza, dirt/stone streets, and 4–7 houses.
   * Returns true if it fitted.
   */
  const placeVillage = (si: number): boolean => {
    const s = sites[si]!;
    const art = villageArt(s.biome);
    // Look for a 22×18 clear-ish patch (plus margin).
    const vw = 22, vh = 18;
    const spot = findSpot(si, vw, vh, 600);
    if (!spot) return false;
    const x0 = spot.x, y0 = spot.y;
    // Clear and stamp streets + plaza first.
    for (let y = y0; y < y0 + vh; y++) for (let x = x0; x < x0 + vw; x++) {
      const i = at(x, y);
      if (!open(i) && tiles[i]!.floor !== FL.water) continue;
      const cx = x0 + Math.floor(vw / 2), cy = y0 + Math.floor(vh / 2);
      const isStreet = (x - x0) % 6 === 0 || (y - y0) % 5 === 0 || (Math.abs(x - cx) <= 2 && Math.abs(y - cy) <= 2);
      tiles[i] = {
        floor: FL.dirt,
        biome: tiles[i]!.biome,
        block: 0,
        decor: 0,
        sprite: isStreet ? art.street : (s.biome === "plains" ? TEX.grass : art.floor),
      };
    }
    // Houses: small 5×4 wooden (or themed) buildings with a door.
    const houseSpots: [number, number][] = [
      [1, 1], [7, 1], [13, 1],
      [1, 7], [13, 7],
      [1, 13], [7, 13], [13, 13],
    ];
    const nHouses = 4 + Math.floor(rng() * 4);
    for (let h = 0; h < nHouses && h < houseSpots.length; h++) {
      const [hx, hy] = houseSpots[h]!;
      const hx0 = x0 + hx, hy0 = y0 + hy;
      const tw = 5, th = 4;
      for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
        const i = at(hx0 + x, hy0 + y);
        if (hx0 + x >= w - 2 || hy0 + y >= h - 2) continue;
        const edge = x === 0 || y === 0 || x === tw - 1 || y === th - 1;
        const door = y === th - 1 && x === 2;
        tiles[i] = edge && !door
          ? { floor: FL.stone, biome: tiles[i]!.biome, block: 1, decor: 0, sprite: art.wall }
          : { floor: FL.stone, biome: tiles[i]!.biome, block: 0, decor: 0, sprite: art.floor };
      }
    }
    // A couple of logs / a chest near the plaza for flavour.
    const chestX = x0 + Math.floor(vw / 2), chestY = y0 + Math.floor(vh / 2) + 1;
    if (chestX > 2 && chestY > 2) {
      const ci = at(chestX, chestY);
      if (open(ci)) tiles[ci] = { ...tiles[ci]!, decor: 1, sprite: TEX.chest };
    }
    mark(x0, y0, vw, vh);
    return true;
  };

  // One or two villages on every mainland continent.
  sites.forEach((s, si) => {
    if (s.island) return;
    const count = 1 + (rng() < 0.65 ? 1 : 0); // usually 2
    for (let v = 0; v < count; v++) placeVillage(si);
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
      for (const n of [i + 1, i - 1, i + w, i - w]) {
        if (n < 0 || n >= N || seen[n]) continue;
        const nx = n % w, ny = (n / w) | 0;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        if (!open(n) && tiles[n]!.floor !== FL.water) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    /*
     * Seal whatever the walk could not reach.
     *
     * This used to turn unreachable land into a lake "so the world stays one piece", which did not
     * work: water is walkable (world.ts `blocked` lets you swim), so a sealed pocket turned into a
     * sealed pond and stayed exactly as cut off as it was. It also never looked at water pockets in
     * the first place, so small ponds ringed by rock survived untouched — and a fishing node
     * rolled into one was a node no hunter could ever reach.
     */
    for (let i = 0; i < N; i++) if (land[i] && !seen[i]) {
      tiles[i] = { floor: FL.stone, biome: tiles[i]!.biome, block: 1, decor: 0, sprite: TEX.stoneWall };
      rock[i] = 1;
    }
  }

  // ---- trees, rocks, and other scenery ----
  const treeAt: { x: number; y: number; si: number }[] = [];
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = at(x, y);
      if (!open(i) || occupied[i]) continue;
      const st = sites[owner[i]!]!;
      const def = DEF[st.biome];
      const sea = seaDist[i]!;
      if (sea < 3) continue;
      const n = noise(7, 51);
      if (n > def.forest[0] && h2(x, y, seed + 53) < def.forest[1]) {
        tiles[i] = { ...tiles[i]!, layers: [def.tree] };
        treeAt.push({ x, y, si: owner[i]! });
        occupied[i] = 1;
      } else if (h2(x, y, seed + 55) < 0.04) {
        tiles[i] = { ...tiles[i]!, layers: [TEX.decorRocks] };
      } else if (st.biome === "hell" && h2(x, y, seed + 57) < 0.03) {
        tiles[i] = { ...tiles[i]!, layers: [TEX.decorBones] };
      } else if ((st.biome === "plains" || st.biome === "jungle") && h2(x, y, seed + 59) < 0.05) {
        tiles[i] = { ...tiles[i]!, layers: [TEX.decorShrub] };
      }
    }
  }

  // ---- portals (one per continent, near a temple or cabin) ----
  const portalAt: { x: number; y: number }[] = [];
  sites.forEach((s, si) => {
    if (s.island) return;
    const near = templeAt.find((t) => t.si === si) ?? cabinAt[si % cabinAt.length];
    if (!near) return;
    for (let tries = 0; tries < 40; tries++) {
      const a = rng() * Math.PI * 2, d = 4 + rng() * 8;
      const x = Math.round(near.x + Math.cos(a) * d), y = Math.round(near.y + Math.sin(a) * d);
      const i = at(x, y);
      if (open(i) && !occupied[i]) {
        tiles[i] = { ...tiles[i]!, layers: [TEX.portal] };
        portalAt.push({ x, y });
        occupied[i] = 1;
        break;
      }
    }
  });

  // ---- camps and resource nodes (simplified from the classic generator) ----
  const interactables: MapInteractable[] = [];
  const regions: MapRegion[] = [];
  const zones: SpawnZone[] = [];
  // A few monster camps per continent.
  sites.forEach((s, si) => {
    if (s.island) return;
    const def = DEF[s.biome];
    for (let k = 0; k < 4; k++) {
      const spot = findSpot(si, 5, 5, 200);
      if (!spot) continue;
      const mon = pick(def.monsters);
      zones.push({
        id: nid("camp"), name: `${def.label} Camp`, x: spot.x, y: spot.y, w: 5, h: 5,
        spawns: [{ monster: mon, level: s.levelMin + Math.floor(rng() * 6), count: 2 + Math.floor(rng() * 3) }],
      });
      mark(spot.x, spot.y, 5, 5);
    }
  });
  // Resource nodes: trees, rocks, etc.
  treeAt.slice(0, 80).forEach((t) => {
    interactables.push({
      id: nid("node"), kind: "tree", x: t.x, y: t.y, name: "Tree",
    });
  });

  // ---- assemble the map ----
  const file: MapFile = {
    version: MAP_VERSION,
    id: opts.id ?? "turbz",
    name: opts.name ?? "TURBZ",
    w, h,
    tiles,
    interactables,
    npcs: [],
    quests: [],
    regions,
    zones,
    intro: "",
  };
  return file;
}

/** Re-skin a generated dungeon with New Texture Mode art, keeping the layout. */
export function retextureDungeon(world: WorldData): void {
  const tiles = world.tiles;
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i]!;
    if (t.sprite && TEX_FILE_SET.has(t.sprite)) continue;
    // Map old art to NewTex equivalents by floor / block.
    if (t.block) {
      t.sprite = TEX.stoneWall;
      if (t.floor === FL.lava) t.sprite = TEX.lava;
    } else if (t.floor === FL.water) {
      t.sprite = TEX.water;
    } else if (t.floor === FL.lava) {
      t.sprite = TEX.lava;
    } else if (t.floor === FL.snow) {
      t.sprite = TEX.snow;
    } else if (t.floor === FL.sand) {
      t.sprite = TEX.sand;
    } else if (t.floor === FL.bog) {
      t.sprite = TEX.swampFloor;
    } else if (t.floor === FL.void) {
      t.sprite = TEX.voidFloor;
    } else {
      t.sprite = TEX.stone;
    }
    if (t.layers) {
      t.layers = t.layers.map((l) => {
        if (TEX_FILE_SET.has(l)) return l;
        if (l.includes("tree")) return TEX.treePlains;
        if (l.includes("portal")) return TEX.portal;
        return TEX.decorRocks;
      });
    }
  }
}
