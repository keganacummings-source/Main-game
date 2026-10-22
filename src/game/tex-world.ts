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
    label: "Void", floor: FL.void, biome: BI.void, ground: TEX.voidGrass, patch: TEX.voidFloor, patchFloor: FL.void, patchAt: 0.6, wall: TEX.voidRock, tree: TEX.treeVoid, forest: [0.55, 0.5],
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
      const gate = (x === 6 && (y === 0 || y === th - 1)) || (y === 5 && (x === 0 || x === tw - 1));
      const broken = edge && !gate && h2(x0 + x, y0 + y, seed + 51) < 0.28;
      const pillar = !edge && (x === 3 || x === tw - 4) && (y === 3 || y === th - 4);
      tiles[i] = (edge && !gate && !broken) || pillar
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
    // Any unreachable open land is turned into a lake so the world stays one piece.
    for (let i = 0; i < N; i++) if (land[i] && !seen[i] && open(i)) {
      tiles[i] = { floor: FL.water, biome: tiles[i]!.biome, block: 0, decor: 0, sprite: TEX.water };
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
      for (let k = 0; k < target * 40 && placed < target; k++) {
        const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * s.r * 0.8;
        const x = Math.round(s.x + Math.cos(a) * d), y = Math.round(s.y + Math.sin(a) * d);
        if (x < 4 || y < 4 || x >= w - 4 || y >= h - 4) continue;
        const i = at(x, y);
        if (!nodeOk(x, y) || !want.test(x, y, i)) continue;
        nodeAt[i] = 1; placed++;
        interactables.push({ id: nid(want.node), node: want.node, tx: x, ty: y, level: s.levelMin });
      }
    }
  });

  // ---- portals, beds, ghostboxes in the structures ----
  const portals: MapInteractable[] = [];
  templeAt.forEach((t, i) => {
    const x = t.x + 6, y = t.y + 5, i2 = at(x, y);
    if (open(i2)) {
      tiles[i2] = { ...tiles[i2]!, layers: [TEX.portal] };
      portals.push({ id: nid("portal"), node: "portal", tx: x, ty: y, level: sites[t.si]!.levelMin });
    }
  });
  cabinAt.forEach((c) => {
    const x = c.x + 3, y = c.y + 2, i = at(x, y);
    if (open(i)) tiles[i] = { ...tiles[i]!, layers: [TEX.bed] };
    const gx = c.x + 1, gy = c.y + 1, gi = at(gx, gy);
    if (open(gi)) tiles[gi] = { ...tiles[gi]!, layers: [TEX.ghostbox] };
  });

  // ---- spawn zones and regions ----
  const zones: SpawnZone[] = [];
  const regions: MapRegion[] = [];
  sites.forEach((s, si) => {
    const def = DEF[s.biome];
    regions.push({
      id: nid("region"), name: s.name, kind: "region", tx: Math.max(0, Math.floor(s.x - s.r)), ty: Math.max(0, Math.floor(s.y - s.r)),
      tw: Math.min(w, Math.ceil(s.r * 2)), th: Math.min(h, Math.ceil(s.r * 2)), levelMin: s.levelMin, levelMax: s.levelMax, about: def.about,
    });
    const count = s.island ? 3 : 8;
    for (let k = 0; k < count; k++) {
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * s.r * 0.6;
      const x = Math.round(s.x + Math.cos(a) * d), y = Math.round(s.y + Math.sin(a) * d);
      if (x < 8 || y < 8 || x >= w - 8 || y >= h - 8) continue;
      zones.push({
        id: nid("zone"), tx: x - 4, ty: y - 4, tw: 8, th: 8, levelMin: s.levelMin, levelMax: s.levelMax,
        species: def.monsters, count: 2 + Math.floor(rng() * 3), respawn: 40,
      });
    }
  });

  return {
    version: MAP_VERSION,
    id: opts.id ?? "custom-turbz",
    name: opts.name ?? "TURBZ Wild",
    w, h, tileSize: TILE,
    spawn: spawnTile,
    tiles,
    interactables: [...interactables, ...portals],
    zones,
    regions,
    seed,
  };
}

/** Re-skin a generated dungeon with New Texture Mode art, keeping the layout. */
export function retextureDungeon(world: WorldData): void {
  const art = {
    floor: [TEX.stone, TEX.dirt, TEX.templeFloor],
    wall: [TEX.stoneWall, TEX.templeWall],
    rock: [TEX.stoneWall],
  };
  for (let i = 0; i < world.tiles.length; i++) {
    const t = world.tiles[i]!;
    const n = (i * 7 + 13) % 100;
    if (t.block && t.floor !== 2) {
      t.sprite = t.floor === 1 ? art.wall[n % art.wall.length] : art.rock[n % art.rock.length];
    } else if (t.floor === 2) {
      t.sprite = n > 40 ? TEX.deep : TEX.water;
    } else {
      t.sprite = art.floor[n % art.floor.length];
    }
    if (t.portal) t.layers = [TEX.portal];
  }
}
