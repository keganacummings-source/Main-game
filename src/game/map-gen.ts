/**
 * World generator for the Map Builder.
 *
 * Builds a whole designer map from a seed: several continents and islands separated by sea,
 * biomes per continent (with climate variation inside), mountain ranges, lakes, walled cities with
 * streets, plazas and buildings, port villages with ferries between continents, roads between
 * towns, resource areas (forests, mines, mushroom groves, fishing spots), landmarks, monster camps,
 * NPCs with dialogue, side quests, and (for the Veilreach preset) a main story that sends you to
 * every continent.
 *
 * Everything is ordinary Map Builder data, so the result can be opened and edited by hand.
 */
import { MONSTER_BY_ID, ANIMAL_BY_ID, TILE, mulberry32, type Rng } from "./content";
import { MAP_VERSION, type MapFile, type MapInteractable, type MapNpc, type MapQuest, type MapQuestStep, type MapRegion, type MapTile, type SpawnZone } from "./map-format";
import type { Spawn } from "./world";

// ---------------------------------------------------------------------------
// Tile art (MapAssets pack)
// ---------------------------------------------------------------------------

const F = "/MapAssets/01_Floor_and_Ground_Tiles/";
const W = "/MapAssets/02_Walls_and_Cliffs/";
const L = "/MapAssets/03_Water_and_Liquid_Tiles/";
const V = "/MapAssets/04_Trees_and_Vegetation/";
const D = "/MapAssets/05_Doors_and_Entrances/";
const G = "/MapAssets/06_Gates_and_Portals/";
const A = "/MapAssets/07_Altars_and_Shrines/";
const S = "/MapAssets/08_Statues_and_Landmarks/";
const B = "/MapAssets/10_Shops_and_Buildings/";
const O = "/MapAssets/12_Dungeon_Tiles_Other/";

const seq = (dir: string, fmt: (i: number) => string, from: number, to: number) => Array.from({ length: to - from + 1 }, (_, k) => dir + fmt(from + k));

const ART = {
  grass: seq(F, (i) => `grass_${i}_new.png`, 0, 2),
  flowers: [...seq(F, (i) => `grass_flowers_yellow_${i}_new.png`, 1, 3), ...seq(F, (i) => `grass_flowers_red_${i}_new.png`, 1, 3), ...seq(F, (i) => `grass_flowers_blue_${i}_new.png`, 1, 3)],
  dirt: [...seq(F, (i) => `dirt_${i}_new.png`, 0, 2), F + "dirt_full_new.png"],
  pebble: seq(F, (i) => `pebble_brown_${i}_new.png`, 0, 8),
  greyDirt: seq(F, (i) => `grey_dirt_${i}_new.png`, 0, 7),
  sand: seq(F, (i) => `sand_${i}.png`, 1, 8),
  sandstone: seq(F, (i) => `sandstone_floor_${i}.png`, 0, 9),
  snow: seq(F, (i) => `frozen_${i}.png`, 0, 12),
  ice: seq(F, (i) => `ice_${i}_new.png`, 0, 3),
  volcanic: seq(F, (i) => `volcanic_floor_${i}.png`, 0, 6),
  lava: seq(F, (i) => `lava_${i}.png`, 0, 3),
  swamp: seq(F, (i) => `swamp_${i}_new.png`, 0, 3),
  bog: seq(F, (i) => `bog_green_${i}_new.png`, 0, 3),
  moss: seq(F, (i) => `moss_${i}.png`, 0, 3),
  mud: seq(F, (i) => `mud_${i}.png`, 0, 3),
  vines: seq(F, (i) => `floor_vines_${i}_new.png`, 0, 6),
  crystal: seq(F, (i) => `crystal_floor_${i}.png`, 0, 5),
  cobalt: seq(F, (i) => `black_cobalt_${i}.png`, 1, 12),
  tomb: seq(F, (i) => `tomb_${i}_new.png`, 0, 3),
  bones: seq(F, (i) => `green_bones_${i}.png`, 1, 12),
  street: seq(F, (i) => `rect_gray_${i}_new.png`, 0, 3),
  limestone: seq(F, (i) => `limestone_${i}.png`, 0, 9),
  marble: seq(F, (i) => `marble_floor_${i}.png`, 1, 6),
  mosaic: seq(F, (i) => `mosaic_${i}.png`, 0, 15),
  whiteMarble: seq(F, (i) => `white_marble_${i}.png`, 0, 9),
  lair: [...seq(F, (i) => `lair_${i}_new.png`, 0, 3)],
  // walls
  stoneBrick: seq(W, (i) => `stone_brick_${i}.png`, 1, 12),
  brickBrown: seq(W, (i) => `brick_brown_${i}.png`, 0, 7),
  brickGray: seq(W, (i) => `brick_gray_${i}.png`, 0, 3),
  sandWall: seq(W, (i) => `sandstone_wall_${i}.png`, 0, 9),
  marbleWall: seq(W, (i) => `marble_wall_${i}.png`, 1, 12),
  church: seq(W, (i) => `church_${i}.png`, 0, 4),
  stoneGray: seq(W, (i) => `stone_gray_${i}.png`, 0, 3),
  stoneDark: seq(W, (i) => `stone_dark_${i}.png`, 0, 3),
  volcanicWall: seq(W, (i) => `volcanic_wall_${i}.png`, 0, 6),
  crystalWall: [...seq(W, (i) => `crystal_wall_${i}.png`, 0, 9), W + "crystal_wall_11.png", W + "crystal_wall_12.png", W + "crystal_wall_13.png"],
  emerald: seq(W, (i) => `emerald_${i}.png`, 1, 8),
  labRock: seq(W, (i) => `lab-rock_${i}.png`, 0, 3),
  yellowRock: seq(W, (i) => `wall_yellow_rock_${i}.png`, 0, 3),
  cobaltRock: seq(W, (i) => `cobalt_rock_${i}.png`, 1, 4),
  catacombs: seq(W, (i) => `catacombs_${i}.png`, 0, 15),
  tombWall: seq(W, (i) => `tomb_${i}.png`, 0, 3),
  vineWall: seq(W, (i) => `wall_vines_${i}.png`, 0, 6),
  // water
  sea: [L + "open_sea.png", L + "open_sea_2.png", ...seq(L, (i) => `shoals_deep_water_${i}.png`, 5, 11)],
  deep: [L + "deep_water.png", L + "deep_water_2.png"],
  shallow: [L + "shallow_water.png", L + "shallow_water_2.png", ...seq(L, (i) => `shoals_shallow_water_${i}.png`, 5, 11)],
  // decoration
  trees: [V + "tree_1_yellow.png", V + "tree_2_yellow.png", V + "tree_1_red.png", V + "tree_2_red.png", V + "tree_1_lightred.png", V + "tree_2_lightred.png"],
  mangrove: seq(V, (i) => `mangrove_${i}.png`, 1, 3),
  doors: [D + "closed_door.png"],
  gateOpen: [D + "gate_open_middle.png"],
  shops: [B + "shop_general.png", B + "shop_armor.png", B + "shop_weapon.png", B + "shop_potions.png", B + "shop_food.png", B + "shop_books.png", B + "shop_scrolls.png", B + "shop_jewellery.png", B + "shop_wands.png"],
  fountain: [O + "sparkling_fountain.png", O + "blue_fountain.png"],
  statues: [S + "statue_angel.png", S + "statue_archer.png", S + "statue_sword.png", S + "statue_princess.png", S + "statue_ancient_hero.png", S + "statue_twins.png", S + "statue_cat.png", S + "statue_dragon.png"],
  columns: [S + "crumbled_column.png", ...seq(S, (i) => `crumbled_column_${i}.png`, 1, 6)],
  altars: [A + "altar_base.png", A + "altar_shining_one.png", A + "altar_zin.png", A + "altar_vehumet.png", A + "altar_sif_muna.png"],
  boulder: [O + "boulder.png"],
  stairs: [G + "stone_stairs_down.png", G + "rock_stairs_down.png"],
  portal: [G + "portal.png", G + "starry_portal.png"],
  crypt: [G + "enter_crypt.png", G + "enter_tomb.png"],
  chest: [O + "chest.png", O + "large_box.png"],
};

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

/** Floor codes the engine understands (see FLOOR_COLOR). */
const FL = { grass: 0, wall: 1, water: 2, stone: 3, dirt: 4, snow: 5, bog: 6, void: 7, bone: 8, ash: 9, sand: 10, lava: 11 } as const;
/** Biome indices (world.ts BIOMES order). */
const BI = { void: 0, frost: 1, verdant: 2, crown: 3, bone: 4, tide: 5, ashen: 6 } as const;

type Ground = { art: string[]; floor: number; biome: number; accent?: string[]; accentChance?: number };
export type ThemeId = "verdant" | "frost" | "ashen" | "tide" | "void" | "bone" | "crown";
type Theme = {
  id: ThemeId;
  label: string;
  /** Sub-biomes picked by a moisture / heat noise: [dry, normal, wet]. */
  grounds: [Ground, Ground, Ground];
  coast: Ground;
  mountain: string[];
  cityFloor: string[];
  cityWall: string[];
  houseWall: string[];
  trees: string[] | null;
  /** Monsters and animals for camps, from the game's roster. */
  monsters: string[];
  animals: string[];
  shrine: string;
  lakes: boolean;
};

const g = (art: string[], floor: number, biome: number, accent?: string[], accentChance = 0): Ground => ({ art, floor, biome, accent, accentChance });

const THEMES: Record<ThemeId, Theme> = {
  verdant: {
    id: "verdant", label: "Verdant",
    grounds: [g(ART.dirt, FL.dirt, BI.verdant, ART.pebble, 0.2), g(ART.grass, FL.grass, BI.verdant, ART.flowers, 0.08), g(ART.moss, FL.grass, BI.verdant, ART.vines, 0.25)],
    coast: g(ART.sand, FL.sand, BI.tide), mountain: [...ART.stoneGray, ...ART.vineWall.slice(0, 3)], cityFloor: ART.limestone, cityWall: ART.stoneBrick, houseWall: ART.brickBrown,
    trees: ART.trees, monsters: ["kusa", "yanagi", "mokuzu", "umoregi", "tsuchi", "hikari"], animals: ["hare", "boar", "stag"], shrine: "earth", lakes: true,
  },
  frost: {
    id: "frost", label: "Frost",
    grounds: [g(ART.greyDirt, FL.dirt, BI.frost), g(ART.snow, FL.snow, BI.frost), g(ART.ice, FL.snow, BI.frost, ART.snow, 0.3)],
    coast: g(ART.ice, FL.snow, BI.frost), mountain: [...ART.cobaltRock, ...ART.stoneGray], cityFloor: ART.whiteMarble, cityWall: ART.marbleWall, houseWall: ART.brickGray,
    trees: null, monsters: ["yuki", "kaze", "raiju", "hikari"], animals: ["wolf", "stag", "hare"], shrine: "ice", lakes: true,
  },
  ashen: {
    id: "ashen", label: "Ashen",
    grounds: [g(ART.sand, FL.sand, BI.ashen, ART.sandstone, 0.15), g(ART.volcanic, FL.ash, BI.ashen), g(ART.pebble, FL.ash, BI.ashen, ART.volcanic, 0.3)],
    coast: g(ART.sand, FL.sand, BI.ashen), mountain: ART.volcanicWall, cityFloor: ART.sandstone, cityWall: ART.sandWall, houseWall: ART.sandWall,
    trees: null, monsters: ["onibi", "nobi", "hinotama", "kagaribi", "raiju"], animals: ["boar", "crow"], shrine: "fire", lakes: false,
  },
  tide: {
    id: "tide", label: "Tide",
    grounds: [g(ART.sand, FL.sand, BI.tide), g(ART.swamp, FL.bog, BI.tide, ART.moss, 0.15), g(ART.bog, FL.bog, BI.tide, ART.mud, 0.25)],
    coast: g(ART.sand, FL.sand, BI.tide), mountain: [...ART.labRock, ...ART.stoneDark], cityFloor: ART.street, cityWall: ART.stoneBrick, houseWall: ART.brickBrown,
    trees: ART.mangrove, monsters: ["shizuku", "nami", "uroko", "kasa", "wisp"], animals: ["crow", "hare"], shrine: "water", lakes: true,
  },
  void: {
    id: "void", label: "Void",
    grounds: [g(ART.cobalt, FL.void, BI.void), g(ART.crystal, FL.void, BI.void, ART.cobalt, 0.2), g(ART.lair, FL.void, BI.void, ART.crystal, 0.2)],
    coast: g(ART.cobalt, FL.void, BI.void), mountain: [...ART.crystalWall, ...ART.emerald], cityFloor: ART.mosaic, cityWall: ART.crystalWall, houseWall: ART.emerald,
    trees: null, monsters: ["kage", "yomi", "naraku", "muma", "yami"], animals: ["crow", "wolf"], shrine: "light", lakes: false,
  },
  bone: {
    id: "bone", label: "Bone",
    grounds: [g(ART.greyDirt, FL.bone, BI.bone, ART.bones, 0.15), g(ART.tomb, FL.bone, BI.bone, ART.bones, 0.1), g(ART.bones, FL.bone, BI.bone, ART.mud, 0.2)],
    coast: g(ART.greyDirt, FL.dirt, BI.bone), mountain: [...ART.catacombs, ...ART.tombWall], cityFloor: ART.tomb, cityWall: ART.catacombs, houseWall: ART.tombWall,
    trees: null, monsters: ["gaikotsu", "muma", "yami", "saintling"], animals: ["crow", "wolf"], shrine: "light", lakes: false,
  },
  crown: {
    id: "crown", label: "Crown",
    grounds: [g(ART.pebble, FL.stone, BI.crown), g(ART.grass, FL.grass, BI.crown, ART.columns, 0), g(ART.marble, FL.stone, BI.crown)],
    coast: g(ART.sand, FL.sand, BI.crown), mountain: [...ART.marbleWall, ...ART.stoneGray], cityFloor: ART.marble, cityWall: ART.marbleWall, houseWall: ART.church,
    trees: ART.trees, monsters: ["gaikotsu", "yami", "hikari", "saintling", "kage"], animals: ["crow"], shrine: "light", lakes: false,
  },
};

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

function hash2(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  const u = s(fx), v = s(fy);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fbm(x: number, y: number, seed: number, octaves = 5): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * freq, y * freq, seed + o * 1013) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

const SYL_A = ["Ash", "Bram", "Cal", "Dun", "El", "Fen", "Gal", "Hal", "Ith", "Kel", "Lor", "Mar", "Nor", "Os", "Pell", "Quen", "Ros", "Sel", "Tor", "Ul", "Vel", "Wyn", "Yar", "Zan", "Mire", "Thorn", "Rook", "Brin", "Corr", "Dray"];
const SYL_B = ["ford", "mere", "hold", "wick", "stead", "gate", "haven", "moor", "fell", "crest", "vale", "spire", "watch", "barrow", "reach", "hollow", "port", "march", "rest", "brook"];
const FIRST = ["Maren", "Odile", "Tamsin", "Corwin", "Bryn", "Ilse", "Joss", "Kestrel", "Liora", "Nell", "Orrin", "Pim", "Quill", "Rhea", "Soren", "Tilda", "Ulric", "Vesna", "Wren", "Yara", "Ansel", "Beck", "Cass", "Dorian", "Edda", "Faro", "Greta", "Hollis", "Ivo", "Juno", "Kit", "Lark", "Mabel", "Nico", "Oona", "Piet", "Rosa", "Silas", "Thea", "Viggo"];
const ROLES_CITY = ["Elder", "Captain", "Innkeeper", "Smith", "Herbalist", "Scholar", "Merchant", "Watcher", "Priest", "Cartographer", "Fisher", "Miner", "Hunter", "Bard"];

function placeName(rng: Rng, used: Set<string>): string {
  for (let i = 0; i < 40; i++) {
    const n = SYL_A[Math.floor(rng() * SYL_A.length)]! + SYL_B[Math.floor(rng() * SYL_B.length)]!;
    if (!used.has(n)) { used.add(n); return n; }
  }
  const n = `Town ${used.size + 1}`;
  used.add(n);
  return n;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export type ContinentSpec = { name: string; theme: ThemeId; x: number; y: number; r: number; levelMin: number; levelMax: number; about?: string };
export type WorldGenOptions = {
  id: string;
  name: string;
  seed: number;
  w: number;
  h: number;
  /** Number of continents when `continents` is not given (2–8). */
  continentCount?: number;
  /** Exact continents (positions as 0–1 fractions of the map, radius in tiles). */
  continents?: ContinentSpec[];
  /** Small islands sprinkled in the sea. */
  islands?: number;
  /** Cities per continent (1–5). */
  citiesPerContinent?: number;
  /** Build the Veilreach main story on top. */
  story?: boolean;
  intro?: string;
};

type City = { id: string; name: string; cont: number; x: number; y: number; w: number; h: number; kind: "capital" | "town" | "port" | "village"; plaza: { x: number; y: number }; gates: { x: number; y: number }[]; dock?: { x: number; y: number; arrive: { x: number; y: number } } ; npcs: string[] };
type Place = { id: string; name: string; cont: number; x: number; y: number; kind: "landmark" | "resource"; node?: "tree" | "ore" | "shroom" | "fish" };

export function generateWorld(opts: WorldGenOptions): MapFile {
  const w = Math.max(64, Math.min(512, Math.floor(opts.w)));
  const h = Math.max(64, Math.min(512, Math.floor(opts.h)));
  const seed = opts.seed >>> 0 || 1;
  const rng = mulberry32(seed);
  const N = w * h;
  const at = (x: number, y: number) => y * w + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const usedNames = new Set<string>();

  // ---- continents --------------------------------------------------------------------------
  const themeCycle: ThemeId[] = ["verdant", "tide", "frost", "ashen", "void", "bone", "crown", "verdant"];
  let conts: ContinentSpec[] = opts.continents ?? [];
  if (!conts.length) {
    const n = Math.max(2, Math.min(8, opts.continentCount ?? 5));
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      let best = { x: 0.5, y: 0.5 }, bd = -1;
      for (let k = 0; k < 40; k++) {
        const p = { x: 0.18 + rng() * 0.64, y: 0.18 + rng() * 0.64 };
        const d = Math.min(...pts.map((q) => Math.hypot(q.x - p.x, q.y - p.y)), 9);
        if (d > bd) { bd = d; best = p; }
      }
      pts.push(best);
    }
    const r = Math.min(w, h) * (0.5 / Math.sqrt(n)) * 0.95;
    conts = pts.map((p, i) => ({ name: placeName(rng, usedNames), theme: themeCycle[i % themeCycle.length]!, x: p.x, y: p.y, r: r * (0.85 + rng() * 0.3), levelMin: 1 + i * 12, levelMax: 10 + i * 12 }));
  } else for (const c of conts) usedNames.add(c.name);
  const sites = conts.map((c) => ({ x: c.x * w, y: c.y * h, r: c.r, island: false }));
  const islandCount = opts.islands ?? Math.round((w * h) / 22000);
  for (let i = 0; i < islandCount; i++) {
    for (let k = 0; k < 60; k++) {
      const x = 20 + rng() * (w - 40), y = 20 + rng() * (h - 40);
      if (sites.every((s) => Math.hypot(s.x - x, s.y - y) > s.r + 14)) { sites.push({ x, y, r: 7 + rng() * 9, island: true }); break; }
    }
  }

  // ---- land, owner, mountains, lakes ------------------------------------------------------
  const owner = new Int16Array(N).fill(-1); // index into sites, -1 = sea
  const land = new Uint8Array(N);
  const mountain = new Uint8Array(N);
  const lake = new Uint8Array(N);
  const moist = new Float32Array(N);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      // Domain warp so coasts wiggle.
      const wx = x + (fbm(x / 40, y / 40, seed + 7) - 0.5) * 36;
      const wy = y + (fbm(x / 40, y / 40, seed + 9) - 0.5) * 36;
      let d1 = Infinity, d2 = Infinity, i1 = -1;
      for (let i = 0; i < sites.length; i++) {
        const s = sites[i]!;
        const d = Math.hypot(wx - s.x, wy - s.y) / s.r;
        if (d < d1) { d2 = d1; d1 = d; i1 = i; } else if (d < d2) d2 = d;
      }
      const s = sites[i1]!;
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      const n = fbm(x / 55, y / 55, seed + 3);
      const body = 1 - d1 + (n - 0.5) * 0.7;
      // A sea channel between neighbouring landmasses keeps them separate.
      const gap = (d2 - d1) * s.r;
      const channel = s.island ? 3 : 7 + fbm(x / 30, y / 30, seed + 5) * 8;
      const isLand = body > 0.06 && gap > channel && edge > 10;
      const i = at(x, y);
      moist[i] = fbm(x / 70, y / 70, seed + 11);
      if (!isLand) continue;
      land[i] = 1;
      owner[i] = i1;
      if (!s.island) {
        const ridge = 1 - Math.abs(fbm(x / 34, y / 34, seed + 13) * 2 - 1);
        if (ridge > 0.88 && body > 0.34) mountain[i] = 1;
        if (THEMES[conts[i1]!.theme].lakes && fbm(x / 26, y / 26, seed + 17) > 0.74 && body > 0.4) lake[i] = 1;
      }
    }
  // Distance to sea (BFS) for coasts and city placement.
  const coastDist = new Int16Array(N).fill(9999);
  {
    const q: number[] = [];
    for (let i = 0; i < N; i++) if (!land[i]) { coastDist[i] = 0; q.push(i); }
    for (let k = 0; k < q.length; k++) {
      const i = q[k]!;
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (!inside(nx, ny)) continue;
        const j = at(nx, ny);
        if (coastDist[j]! > coastDist[i]! + 1) { coastDist[j] = coastDist[i]! + 1; q.push(j); }
      }
    }
  }

  // ---- paint base tiles --------------------------------------------------------------------
  const pickArt = (art: string[], x: number, y: number, salt: number) => art[Math.floor(valueNoise(x / 5, y / 5, seed + salt) * art.length * 0.999 + (hash2(x, y, seed + salt) < 0.15 ? 1 : 0)) % art.length]!;
  const tiles: MapTile[] = new Array(N);
  const contOf = (i: number) => {
    const o = owner[i]!;
    if (o < 0) return -1;
    if (o < conts.length) return o;
    // islands borrow the theme of the nearest continent
    const s = sites[o]!;
    let best = 0, bd = Infinity;
    conts.forEach((c, k) => { const d = Math.hypot(c.x * w - s.x, c.y * h - s.y); if (d < bd) { bd = d; best = k; } });
    return best;
  };
  const contAt = new Int8Array(N).fill(-1);
  for (let i = 0; i < N; i++) contAt[i] = contOf(i);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = at(x, y);
      if (!land[i]) {
        const shallow = coastDist[i] === 0 && hasLandNear(x, y, 3);
        tiles[i] = { floor: FL.water, biome: BI.tide, block: 1, decor: 0, sprite: pickArt(shallow ? ART.shallow : ART.sea, x, y, 1) };
        continue;
      }
      const th = THEMES[conts[contAt[i]!]!.theme];
      if (lake[i]) { tiles[i] = { floor: FL.water, biome: th.grounds[1].biome, block: 1, decor: 0, sprite: pickArt(ART.deep, x, y, 2) }; continue; }
      if (mountain[i]) { tiles[i] = { floor: FL.stone, biome: th.grounds[1].biome, block: 1, decor: 0, sprite: pickArt(th.mountain, x, y, 3) }; continue; }
      let gr: Ground = coastDist[i]! <= 2 ? th.coast : th.grounds[moist[i]! < 0.42 ? 0 : moist[i]! < 0.58 ? 1 : 2];
      if (th.id === "ashen" && moist[i]! > 0.66 && fbm(x / 12, y / 12, seed + 19) > 0.7) gr = g(ART.lava, FL.lava, BI.ashen);
      const t: MapTile = { floor: gr.floor, biome: gr.biome, block: gr.floor === FL.lava ? 1 : 0, decor: 0, sprite: pickArt(gr.art, x, y, 4) };
      if (gr.accent && hash2(x, y, seed + 21) < (gr.accentChance ?? 0)) t.sprite = pickArt(gr.accent, x, y, 5);
      // Forest decoration: trees on the wet side (block where dense).
      if (th.trees && moist[i]! > 0.55 && coastDist[i]! > 3) {
        const dens = fbm(x / 9, y / 9, seed + 23);
        if (dens > 0.62 && hash2(x, y, seed + 25) < 0.55) { t.layers = [pickArt(th.trees, x, y, 6)]; t.block = dens > 0.7 ? 1 : 0; }
      }
      tiles[i] = t;
    }
  function hasLandNear(x: number, y: number, r: number): boolean {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inside(x + dx, y + dy) && land[at(x + dx, y + dy)]) return true;
    return false;
  }
  // Lake shores get shallow water so you can fish.
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = at(x, y);
    if (!lake[i]) continue;
    if (!lake[at(x + 1, y)] || !lake[at(x - 1, y)] || !lake[at(x, y + 1)] || !lake[at(x, y - 1)]) tiles[i] = { ...tiles[i]!, sprite: pickArt(ART.shallow, x, y, 7) };
  }

  // ---- helpers for structures --------------------------------------------------------------
  const set = (x: number, y: number, t: Partial<MapTile> & { sprite?: string }) => {
    if (!inside(x, y)) return;
    const i = at(x, y);
    const old = tiles[i]!;
    const next: MapTile = { floor: t.floor ?? old.floor, biome: t.biome ?? old.biome, block: t.block ?? old.block, decor: 0, sprite: t.sprite ?? old.sprite };
    if (t.layers) next.layers = t.layers;
    tiles[i] = next;
    if (t.block === 0) { mountain[i] = 0; lake[i] = 0; land[i] = 1; }
  };
  const ground = (x: number, y: number, art: string[], floor: number, salt = 30) => set(x, y, { floor, sprite: pickArt(art, x, y, salt), block: 0, layers: undefined });
  const walkable = (x: number, y: number) => inside(x, y) && !tiles[at(x, y)]!.block && tiles[at(x, y)]!.floor !== FL.water;

  const regions: MapRegion[] = [];
  const interactables: MapInteractable[] = [];
  const npcs: MapNpc[] = [];
  const quests: MapQuest[] = [];
  const zones: SpawnZone[] = [];
  const spawns: Spawn[] = [];
  const occupied = new Uint8Array(N); // cities, landmarks: no camps or trees here
  const occupy = (x: number, y: number, ww: number, hh: number, pad = 0) => { for (let yy = y - pad; yy < y + hh + pad; yy++) for (let xx = x - pad; xx < x + ww + pad; xx++) if (inside(xx, yy)) occupied[at(xx, yy)] = 1; };
  const freeRect = (x: number, y: number, ww: number, hh: number, cont: number, minCoast = 4) => {
    for (let yy = y; yy < y + hh; yy++) for (let xx = x; xx < x + ww; xx++) {
      if (!inside(xx, yy)) return false;
      const i = at(xx, yy);
      if (!land[i] || occupied[i] || contAt[i] !== cont || coastDist[i]! < minCoast) return false;
    }
    return true;
  };
  let uid = 0;
  const id = (p: string) => `${p}-${(uid++).toString(36)}`;

  // ---- cities --------------------------------------------------------------------------------
  const cities: City[] = [];
  const perCont = Math.max(1, Math.min(5, opts.citiesPerContinent ?? 3));
  conts.forEach((c, ci) => {
    const th = THEMES[c.theme];
    const small = c.r < 50;
    const kinds: City["kind"][] = ["capital", ...Array.from({ length: (small ? 1 : perCont) - 1 }, (_, k) => (k === 0 ? "port" : "town") as City["kind"]), ...Array.from({ length: small ? 1 : Math.max(1, perCont - 1) }, () => "village" as City["kind"])];
    for (const kind of kinds) {
      const cw = kind === "capital" ? 40 : kind === "town" ? 30 : kind === "port" ? 24 : 16;
      const chh = kind === "capital" ? 30 : kind === "town" ? 22 : kind === "port" ? 18 : 12;
      let best: { x: number; y: number } | null = null, bs = -Infinity;
      for (let k = 0; k < 500; k++) {
        const x = Math.floor(c.x * w - c.r + rng() * c.r * 2), y = Math.floor(c.y * h - c.r + rng() * c.r * 2);
        if (!freeRect(x - 3, y - 3, cw + 6, chh + 6, ci, kind === "port" ? 3 : 5)) continue;
        const cx = x + cw / 2, cy = y + chh / 2;
        const spread = Math.min(999, ...cities.filter((o) => o.cont === ci).map((o) => Math.hypot(o.x + o.w / 2 - cx, o.y + o.h / 2 - cy)));
        const coast = coastDist[at(Math.floor(cx), Math.floor(cy))]!;
        const score = kind === "port" ? -Math.abs(coast - 16) * 4 + Math.min(spread, 80) : kind === "capital" ? -Math.hypot(cx - c.x * w, cy - c.y * h) : Math.min(spread, kind === "village" ? 70 : 90);
        if (score > bs) { bs = score; best = { x, y }; }
      }
      if (!best) continue;
      const name = kind === "capital" && c.name ? c.name : placeName(rng, usedNames);
      const city = buildCity(ci, th, best.x, best.y, cw, chh, kind, name);
      cities.push(city);
    }
  });

  function buildCity(ci: number, th: Theme, x0: number, y0: number, cw: number, chh: number, kind: City["kind"], name: string): City {
    occupy(x0, y0, cw, chh, 3);
    const floor = FL.stone;
    for (let y = y0; y < y0 + chh; y++) for (let x = x0; x < x0 + cw; x++) ground(x, y, th.cityFloor, floor, 40);
    // Outer wall with four gates.
    const gates: { x: number; y: number }[] = [];
    const midX = x0 + Math.floor(cw / 2), midY = y0 + Math.floor(chh / 2);
    const walled = kind !== "village";
    if (walled) {
      for (let x = x0; x < x0 + cw; x++) for (const y of [y0, y0 + chh - 1]) set(x, y, { floor: FL.stone, block: 1, sprite: pickArt(th.cityWall, x, y, 41), layers: undefined });
      for (let y = y0; y < y0 + chh; y++) for (const x of [x0, x0 + cw - 1]) set(x, y, { floor: FL.stone, block: 1, sprite: pickArt(th.cityWall, x, y, 41), layers: undefined });
    } else {
      // Villages sit on their own ground with a dirt square.
      for (let y = y0; y < y0 + chh; y++) for (let x = x0; x < x0 + cw; x++) ground(x, y, th.grounds[0].art, th.grounds[0].floor, 40);
    }
    for (const [gx, gy] of [[midX, y0], [midX, y0 + chh - 1], [x0, midY], [x0 + cw - 1, midY]] as const) {
      for (let k = -1; k <= 1; k++) {
        const tx = gy === midY ? gx : gx + k, ty = gy === midY ? gy + k : gy;
        ground(tx, ty, ART.street, FL.stone, 42);
      }
      gates.push({ x: gx, y: gy });
    }
    // Streets: a cross through the gates, plus a ring road.
    for (let x = x0 + 1; x < x0 + cw - 1; x++) for (let k = -1; k <= 1; k++) ground(x, midY + k, ART.street, FL.stone, 43);
    for (let y = y0 + 1; y < y0 + chh - 1; y++) for (let k = -1; k <= 1; k++) ground(midX + k, y, ART.street, FL.stone, 43);
    if (walled) {
      for (let x = x0 + 2; x < x0 + cw - 2; x++) for (const y of [y0 + 2, y0 + chh - 3]) ground(x, y, ART.street, FL.stone, 43);
      for (let y = y0 + 2; y < y0 + chh - 2; y++) for (const x of [x0 + 2, x0 + cw - 3]) ground(x, y, ART.street, FL.stone, 43);
    }
    // Plaza with a fountain and statues.
    const pr = kind === "capital" ? 5 : kind === "village" ? 2 : 3;
    for (let y = midY - pr; y <= midY + pr; y++) for (let x = midX - pr; x <= midX + pr; x++) ground(x, y, kind === "capital" ? ART.mosaic : ART.marble, FL.stone, 44);
    set(midX, midY, { block: 1, layers: [pickArt(ART.fountain, midX, midY, 45)] });
    if (kind === "capital") for (const [dx, dy] of [[-pr, -pr], [pr, -pr], [-pr, pr], [pr, pr]] as const) set(midX + dx, midY + dy, { block: 1, layers: [ART.statues[Math.floor(rng() * ART.statues.length)]!] });
    // Buildings in the four quarters.
    const m0 = walled ? 4 : 1;
    const quarters = [
      [x0 + m0, y0 + m0, midX - 2 - (x0 + m0), midY - 2 - (y0 + m0)],
      [midX + 3, y0 + m0, x0 + cw - m0 - (midX + 3), midY - 2 - (y0 + m0)],
      [x0 + m0, midY + 3, midX - 2 - (x0 + m0), y0 + chh - m0 - (midY + 3)],
      [midX + 3, midY + 3, x0 + cw - m0 - (midX + 3), y0 + chh - m0 - (midY + 3)],
    ] as const;
    let shopN = 0;
    for (const [qx, qy, qw, qh] of quarters) {
      let bx = qx;
      while (bx < qx + qw - 3) {
        const bw = Math.min(qx + qw - bx, 4 + Math.floor(rng() * 4));
        if (bw < 3) break;
        const bh = Math.max(3, Math.min(qh, 3 + Math.floor(rng() * 3)));
        // Skip some plots near the plaza to keep space around it.
        if (Math.abs(bx + bw / 2 - midX) < pr + 3 && Math.abs(qy + bh / 2 - midY) < pr + 3) { bx += bw + 1; continue; }
        const facingDown = qy < midY;
        const by = facingDown ? qy : qy + qh - bh;
        for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) set(x, y, { floor: FL.stone, block: 1, sprite: pickArt(th.houseWall, x, y, 46), layers: undefined });
        const dx = bx + Math.floor(bw / 2), dy = facingDown ? by + bh - 1 : by;
        const shop = rng() < 0.45;
        set(dx, dy, { layers: [shop ? ART.shops[(shopN++ + Math.floor(rng() * 3)) % ART.shops.length]! : ART.doors[0]!] });
        bx += bw + 1;
      }
    }
    const city: City = { id: id("city"), name, cont: ci, x: x0, y: y0, w: cw, h: chh, kind, plaza: { x: midX, y: midY }, gates, npcs: [] };
    regions.push({ id: city.id, name, kind: "city", tx: x0, ty: y0, tw: cw, th: chh, about: kind === "capital" ? `Capital of ${conts[ci]!.name}.` : kind === "port" ? `Harbour town of ${conts[ci]!.name}. Ferries leave from the docks.` : kind === "village" ? `A village of ${conts[ci]!.name}.` : `A town of ${conts[ci]!.name}.`, levelMin: conts[ci]!.levelMin, levelMax: conts[ci]!.levelMax });
    // Places in town.
    interactables.push({ id: id("hearth"), kind: "hearth", tx: midX + 2, ty: midY + pr + 1 });
    if (walled) interactables.push({ id: id("bounty"), kind: "bounty", tx: gates[1]!.x + 3, ty: gates[1]!.y - 2, label: `${name} Bounty Board` });
    if (kind === "capital") {
      interactables.push({ id: id("shrine"), kind: "shrine", type: th.shrine, tx: midX - pr - 2, ty: midY - 3, name: `${name} Shrine` });
      interactables.push({ id: id("arena"), kind: "arena", tx: midX + pr + 2, ty: midY - 3, label: `${name} Proving Ring` });
    }
    return city;
  }

  // ---- docks and ferries -----------------------------------------------------------------
  const ports = cities.filter((c) => c.kind === "port" || (c.kind === "capital" && !cities.some((o) => o.cont === c.cont && o.kind === "port")));
  for (const p of ports) {
    // Walk from the nearest gate toward the sea and build a pier.
    let bestGate = p.gates[0]!, bd = Infinity;
    for (const gt of p.gates) { const d = coastDist[at(gt.x, gt.y)]!; if (d < bd) { bd = d; bestGate = gt; } }
    const dir = bestGate.y === p.y ? [0, -1] : bestGate.y === p.y + p.h - 1 ? [0, 1] : bestGate.x === p.x ? [-1, 0] : [1, 0];
    let x = bestGate.x, y = bestGate.y, steps = 0;
    while (inside(x, y) && land[at(x, y)] && steps < 120) {
      ground(x, y, ART.street, FL.stone, 47);
      if (dir[0] === 0) { ground(x - 1, y, ART.street, FL.stone, 47); ground(x + 1, y, ART.street, FL.stone, 47); } else { ground(x, y - 1, ART.street, FL.stone, 47); ground(x, y + 1, ART.street, FL.stone, 47); }
      x += dir[0]!; y += dir[1]!; steps++;
    }
    // Pier into the water.
    for (let k = 0; k < 5 && inside(x, y); k++) {
      set(x, y, { floor: FL.stone, block: 0, sprite: pickArt(ART.pebble, x, y, 48) });
      x += dir[0]!; y += dir[1]!;
    }
    const end = { x: x - dir[0]!, y: y - dir[1]! };
    const arrive = { x: end.x - dir[0]! * 2, y: end.y - dir[1]! * 2 };
    p.dock = { x: end.x, y: end.y, arrive };
    regions.push({ id: id("docks"), name: `${p.name} Docks`, kind: "landmark", tx: Math.min(end.x, arrive.x) - 2, ty: Math.min(end.y, arrive.y) - 2, tw: Math.abs(end.x - arrive.x) + 5, th: Math.abs(end.y - arrive.y) + 5, about: "Step onto the end of the pier to take the ferry." });
  }

  // ---- roads between cities of each continent ---------------------------------------------
  function road(ax: number, ay: number, bx: number, by: number, art: string[]) {
    // A* on land; mountains and forests cost more and are carved through.
    const open = new MinHeap();
    const cost = new Float32Array(N).fill(Infinity);
    const from = new Int32Array(N).fill(-1);
    const s = at(ax, ay), e = at(bx, by);
    cost[s] = 0;
    open.push(s, 0);
    const cellCost = (i: number) => (!land[i] && !(tiles[i]!.floor === FL.stone && !tiles[i]!.block) ? Infinity : tiles[i]!.sprite && art.includes(tiles[i]!.sprite!) ? 0.4 : mountain[i] ? 9 : lake[i] ? Infinity : tiles[i]!.block ? 4 : 1);
    let guard = 0;
    while (open.size && guard++ < 400000) {
      const i = open.pop();
      if (i === e) break;
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (!inside(nx, ny)) continue;
        const j = at(nx, ny);
        const occ = occupied[j] && j !== e ? 6 : 0;
        const c = cost[i]! + cellCost(j) + occ;
        if (c < cost[j]!) { cost[j] = c; from[j] = i; open.push(j, c + Math.abs(nx - bx) + Math.abs(ny - by)); }
      }
    }
    if (from[e] === -1) return false;
    for (let i = e; i !== s && i >= 0; i = from[i]!) {
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]] as const) {
        const tx = x + dx, ty = y + dy;
        if (!inside(tx, ty)) continue;
        const j = at(tx, ty);
        if (occupied[j] && tiles[j]!.floor === FL.stone && !mountain[j]) continue; // keep city art
        if (!land[j]) continue;
        ground(tx, ty, art, tiles[j]!.floor === FL.snow ? FL.snow : FL.dirt, 49);
      }
    }
    return true;
  }
  conts.forEach((c, ci) => {
    const list = cities.filter((x) => x.cont === ci);
    const cap = list.find((x) => x.kind === "capital") ?? list[0];
    if (!cap) return;
    const art = c.theme === "frost" ? ART.greyDirt : c.theme === "ashen" ? ART.pebble : c.theme === "void" ? ART.cobalt : c.theme === "bone" ? ART.greyDirt : ART.dirt;
    for (const other of list) {
      if (other === cap) continue;
      const ga = nearestGate(cap, other), gb = nearestGate(other, cap);
      road(ga.x, ga.y, gb.x, gb.y, art);
    }
  });
  function nearestGate(a: City, b: City) {
    let best = a.gates[0]!, bd = Infinity;
    for (const gt of a.gates) { const d = Math.hypot(gt.x - (b.x + b.w / 2), gt.y - (b.y + b.h / 2)); if (d < bd) { bd = d; best = gt; } }
    // Step one tile outside the gate.
    const dx = best.x === a.x ? -1 : best.x === a.x + a.w - 1 ? 1 : 0, dy = best.y === a.y ? -1 : best.y === a.y + a.h - 1 ? 1 : 0;
    return { x: best.x + dx, y: best.y + dy };
  }

  // Ferry routes: every port links to the next port (a ring), so every continent is reachable.
  const portTiles: { city: City; tile: { x: number; y: number } }[] = ports.filter((p) => p.dock).map((p) => ({ city: p, tile: p.dock!.arrive }));
  const ferryTargets = new Map<City, City[]>();
  for (let k = 0; k < portTiles.length; k++) {
    const a = portTiles[k]!.city, b = portTiles[(k + 1) % portTiles.length]!.city;
    if (a === b) continue;
    ferryTargets.set(a, [...(ferryTargets.get(a) ?? []), b]);
    ferryTargets.set(b, [...(ferryTargets.get(b) ?? []), a]);
  }
  for (const [a, list] of ferryTargets) {
    const d = a.dock!;
    // One portal tile per destination, side by side at the end of the pier.
    list.forEach((b, k) => {
      const ox = d.x + (d.arrive.x === d.x ? (k === 0 ? 0 : k % 2 ? 1 : -1) : 0);
      const oy = d.y + (d.arrive.y === d.y ? (k === 0 ? 0 : k % 2 ? 1 : -1) : 0);
      set(ox, oy, { floor: FL.stone, block: 0, sprite: pickArt(ART.pebble, ox, oy, 50), layers: [ART.portal[1]!] });
      tiles[at(ox, oy)]!.portal = { map: opts.id, tx: b.dock!.arrive.x, ty: b.dock!.arrive.y };
      regions.push({ id: id("ferry"), name: `Ferry to ${b.name}`, kind: "landmark", tx: ox, ty: oy, tw: 1, th: 1, about: `Step here to sail to ${b.name}.` });
    });
  }

  // ---- landmarks and resource areas ---------------------------------------------------------
  const places: Place[] = [];
  const findSpot = (ci: number, ww: number, hh: number, pred: (x: number, y: number) => boolean, tries = 400) => {
    const c = conts[ci]!;
    for (let k = 0; k < tries; k++) {
      const x = Math.floor(c.x * w - c.r * 1.1 + rng() * c.r * 2.2), y = Math.floor(c.y * h - c.r * 1.1 + rng() * c.r * 2.2);
      if (freeRect(x, y, ww, hh, ci, 2) && pred(x, y)) return { x, y };
    }
    return null;
  };
  const LANDMARK_KINDS = [
    { word: "Ruins", art: ART.columns }, { word: "Watchstone", art: ART.statues }, { word: "Altar", art: ART.altars }, { word: "Barrow", art: ART.crypt },
  ];
  conts.forEach((c, ci) => {
    const th = THEMES[c.theme];
    // Landmarks
    for (let k = 0; k < 3; k++) {
      const spot = findSpot(ci, 9, 9, () => true);
      if (!spot) continue;
      const lk = LANDMARK_KINDS[(k + ci) % LANDMARK_KINDS.length]!;
      const name = `${placeName(rng, usedNames)} ${lk.word}`;
      occupy(spot.x, spot.y, 9, 9, 2);
      for (let y = spot.y; y < spot.y + 9; y++) for (let x = spot.x; x < spot.x + 9; x++) {
        const d = Math.hypot(x - spot.x - 4, y - spot.y - 4);
        if (d <= 4.2) ground(x, y, lk.word === "Barrow" ? ART.tomb : ART.marble, FL.stone, 51);
        if (d > 3.2 && d <= 4.2 && hash2(x, y, seed + 52) < 0.35) set(x, y, { block: 1, layers: [pickArt(lk.art, x, y, 53)] });
      }
      set(spot.x + 4, spot.y + 4, { block: 1, layers: [pickArt(lk.art, spot.x, spot.y, 54)] });
      places.push({ id: id("lm"), name, cont: ci, x: spot.x + 4, y: spot.y + 6, kind: "landmark" });
      regions.push({ id: places[places.length - 1]!.id, name, kind: "landmark", tx: spot.x, ty: spot.y, tw: 9, th: 9, about: `An old ${lk.word.toLowerCase()} of ${c.name}.` });
      if (lk.word === "Altar") interactables.push({ id: id("shrine"), kind: "shrine", type: th.shrine, tx: spot.x + 4, ty: spot.y + 6, name });
    }
    // Resource areas
    const res: { node: "tree" | "ore" | "shroom" | "fish"; word: string; n: number }[] = [
      { node: th.trees ? "tree" : "ore", word: th.trees ? "Wood" : "Quarry", n: 2 },
      { node: "ore", word: "Mine", n: 2 },
      { node: "shroom", word: "Grove", n: 1 },
      { node: "fish", word: "Fishery", n: 2 },
    ];
    for (const r of res) for (let k = 0; k < r.n; k++) {
      const near = (x: number, y: number) => r.node === "ore" ? anyNear(x + 5, y + 5, 10, (i) => !!mountain[i]) : r.node === "fish" ? anyNear(x + 5, y + 5, 7, (i) => tiles[i]!.floor === FL.water) : r.node === "tree" ? moist[at(x + 5, y + 5)]! > 0.5 : true;
      const spot = findSpot(ci, 11, 11, near);
      if (!spot) continue;
      const name = `${placeName(rng, usedNames)} ${r.word}`;
      const rid = id("res");
      regions.push({ id: rid, name, kind: "resource", tx: spot.x, ty: spot.y, tw: 11, th: 11, about: r.node === "tree" ? "Good timber." : r.node === "ore" ? "Rich ore veins." : r.node === "shroom" ? "Mushrooms and alchemy reagents." : "Good fishing.", levelMin: c.levelMin, levelMax: c.levelMax });
      places.push({ id: rid, name, cont: ci, x: spot.x + 5, y: spot.y + 5, kind: "resource", node: r.node });
      occupy(spot.x, spot.y, 11, 11, 0);
      let placed = 0;
      for (let t = 0; t < 80 && placed < (r.node === "fish" ? 5 : 9); t++) {
        const x = spot.x + Math.floor(rng() * 11), y = spot.y + Math.floor(rng() * 11);
        if (!walkable(x, y)) continue;
        if (r.node === "fish" && !anyNear(x, y, 1, (i) => tiles[i]!.floor === FL.water)) continue;
        if (interactables.some((it) => it.tx === x && it.ty === y)) continue;
        interactables.push({ id: id("node"), kind: "node", node: r.node, tx: x, ty: y });
        if (r.node === "ore") set(x, y, { sprite: pickArt(ART.pebble, x, y, 55) });
        placed++;
      }
    }
  });
  function anyNear(x: number, y: number, r: number, f: (i: number) => boolean) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inside(x + dx, y + dy) && f(at(x + dx, y + dy))) return true;
    return false;
  }

  // ---- monster camps ------------------------------------------------------------------------
  const cell = 20;
  for (let cy = 0; cy < h; cy += cell) for (let cx = 0; cx < w; cx += cell) {
    const mx = cx + Math.floor(cell / 2), my = cy + Math.floor(cell / 2);
    if (!inside(mx, my)) continue;
    const mi = at(mx, my);
    if (!land[mi] || occupied[mi] || contAt[mi]! < 0) continue;
    let landCount = 0;
    for (let y = cy; y < cy + cell && y < h; y += 3) for (let x = cx; x < cx + cell && x < w; x += 3) if (land[at(x, y)] && !occupied[at(x, y)]) landCount++;
    if (landCount < 18) continue;
    const ci = contAt[mi]!;
    const c = conts[ci]!, th = THEMES[c.theme];
    // Further from the capital = tougher.
    const cap = cities.find((x) => x.cont === ci && x.kind === "capital");
    const far = cap ? Math.min(1, Math.hypot(mx - cap.plaza.x, my - cap.plaza.y) / c.r) : 0.5;
    const lo = Math.round(c.levelMin + (c.levelMax - c.levelMin) * far * 0.6);
    const hi = Math.max(lo, Math.round(c.levelMin + (c.levelMax - c.levelMin) * Math.min(1, far * 0.6 + 0.4)));
    const animal = rng() < 0.22 && th.animals.length;
    const pool = (animal ? th.animals : th.monsters).filter((s) => MONSTER_BY_ID[s] || ANIMAL_BY_ID[s]);
    const pick = pool.length > 2 ? pool.filter(() => rng() < 0.6) : pool;
    if (zones.length >= 420) continue;
    zones.push({ id: id("camp"), tx: Math.max(1, mx - 6), ty: Math.max(1, my - 6), tw: 12, th: 12, levelMin: Math.max(1, lo), levelMax: Math.max(1, hi), species: (pick.length ? pick : pool).slice(0, 4), count: animal ? 3 : 2 + Math.floor(rng() * 2), respawn: 45 + Math.floor(rng() * 60) });
  }

  // ---- continent bosses ---------------------------------------------------------------------
  const BOSS_SPECIES: Record<ThemeId, string> = { verdant: "umoregi", frost: "yuki", ashen: "kagaribi", tide: "nami", void: "naraku", bone: "gaikotsu", crown: "saintling" };
  const bossOf = new Map<number, { species: string; place: Place }>();
  conts.forEach((c, ci) => {
    const lm = places.filter((p) => p.cont === ci && p.kind === "landmark");
    const p = lm[lm.length - 1];
    if (!p) return;
    const species = BOSS_SPECIES[c.theme];
    const spot = nearestWalkable(p.x + 2, p.y - 2);
    spawns.push({ id: id("boss"), kind: "mob", species, x: (spot.x + 0.5) * TILE, y: (spot.y + 0.5) * TILE, level: c.levelMax, fixedLevel: true, boss: true } as Spawn);
    bossOf.set(ci, { species, place: p });
  });
  function nearestWalkable(x: number, y: number) {
    for (let r = 0; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (walkable(x + dx, y + dy)) return { x: x + dx, y: y + dy };
    return { x, y };
  }

  // ---- NPCs ---------------------------------------------------------------------------------
  const npcIndex = new Map<string, MapNpc>();
  const addNpc = (city: City, role: string, lines: string[], female: boolean) => {
    const first = FIRST[Math.floor(rng() * FIRST.length)]!;
    const n: MapNpc = { id: id("npc"), name: `${role} ${first}`, role: `${role} of ${city.name}`, tx: 0, ty: 0, female, lines, outfit: Math.floor(rng() * 8), hair: Math.floor(rng() * 6) };
    // Stand on a street near the plaza, spread out.
    const k = city.npcs.length;
    const ang = (k / 7) * Math.PI * 2 + 0.4;
    const spot = nearestWalkable(Math.round(city.plaza.x + Math.cos(ang) * (city.kind === "capital" ? 7 : 5)), Math.round(city.plaza.y + Math.sin(ang) * 3));
    n.tx = spot.x;
    n.ty = spot.y;
    npcs.push(n);
    npcIndex.set(n.id, n);
    city.npcs.push(n.id);
    return n;
  };
  const contName = (ci: number) => conts[ci]!.name;
  for (const city of cities) {
    const c = conts[city.cont]!;
    const others = cities.filter((o) => o.cont === city.cont && o !== city).map((o) => o.name);
    const resHere = places.filter((p) => p.cont === city.cont && p.kind === "resource");
    const lmHere = places.filter((p) => p.cont === city.cont && p.kind === "landmark");
    const roles = city.kind === "capital" ? ["Elder", "Captain", "Scholar", "Merchant", "Smith", "Cartographer"] : city.kind === "port" ? ["Harbourmaster", "Fisher", "Innkeeper"] : city.kind === "village" ? ["Reeve", "Herbalist"] : ["Reeve", "Hunter", "Herbalist", "Innkeeper"];
    for (const role of roles) {
      const lines: string[] = [];
      if (role === "Elder" || role === "Reeve") lines.push(`Welcome to ${city.name}, in ${c.name}.`, c.about ?? `${c.name} is ${THEMES[c.theme].label.toLowerCase()} country.`);
      if (role === "Captain" || role === "Hunter") lines.push(`Foes grow tougher the further you get from ${cities.find((x) => x.cont === city.cont && x.kind === "capital")?.name ?? city.name}.`, `Expect levels ${c.levelMin} to ${c.levelMax} out there.`);
      if (role === "Cartographer" || role === "Scholar") {
        if (others.length) lines.push(`Other towns of ${c.name}: ${others.join(", ")}. Follow the roads.`);
        if (lmHere.length) lines.push(`Old places worth a look: ${lmHere.map((p) => p.name).join(", ")}.`);
      }
      if (role === "Harbourmaster") lines.push(`Ferries leave from the end of the pier. Step on the glowing tile.`, `From here you can sail to ${(ferryTargets.get(city) ?? []).map((b) => b.name).join(" or ") || "nowhere yet"}.`);
      if (role === "Merchant" || role === "Innkeeper") lines.push(`The bounty board is by the south gate. The hearth by the plaza mends you.`);
      if (role === "Smith" || role === "Herbalist" || role === "Fisher") if (resHere.length) lines.push(`For materials, try ${resHere.slice(0, 3).map((p) => p.name).join(", ")}.`);
      if (!lines.length) lines.push(`Safe travels.`);
      addNpc(city, role, lines.slice(0, 4), rng() < 0.5);
    }
  }

  // ---- side quests (two per town) -----------------------------------------------------------
  const questIds = new Set<string>();
  const qid = (base: string) => { let q = base.replace(/[^a-z0-9_-]/gi, "-").slice(0, 34); while (questIds.has(q)) q += "x"; questIds.add(q); return q; };
  const reward = (ci: number, mult = 1) => ({ kyo: Math.round((40 + conts[ci]!.levelMin * 12) * mult), xp: Math.round((30 + conts[ci]!.levelMin * 10) * mult) });
  for (const city of cities) {
    const ci = city.cont;
    const giver = city.npcs[1] ?? city.npcs[0];
    if (!giver) continue;
    const res = places.filter((p) => p.cont === ci && p.kind === "resource");
    const r = res[Math.floor(rng() * Math.max(1, res.length))];
    const th = THEMES[conts[ci]!.theme];
    const sp = th.monsters[Math.floor(rng() * th.monsters.length)]!;
    quests.push({
      id: qid(`${city.name}-pests`), name: `${city.name}: Clear the Roads`, about: `${MONSTER_BY_ID[sp]?.name ?? "Monsters"} prowl the roads around ${city.name}. Thin them out.`,
      giver, steps: [{ type: "kill", count: 6, species: sp, hint: `They camp in the wilds of ${contName(ci)}.` }], reward: reward(ci),
      offer: `The ${MONSTER_BY_ID[sp]?.name ?? "monsters"} are getting bold. Six of them, and the roads are safe again.`, progress: "Still too many out there.", done: "The carts are moving again. Thank you.",
    });
    if (r) {
      const giver2 = city.npcs[city.npcs.length - 1] ?? giver;
      quests.push({
        id: qid(`${city.name}-supply`), name: `${city.name}: Supply Run`, about: `Gather at ${r.name} for the town stores.`, giver: giver2,
        steps: [{ type: "goto", tx: r.x, ty: r.y, radius: 6, hint: `${r.name}.` }, { type: "gather", node: r.node!, count: 4, hint: `At ${r.name}.` }], reward: reward(ci, 0.8),
        offer: `We are short on supplies. ${r.name} has what we need.`, progress: `${r.name} is not far.`, done: "That will see us through the season.",
      });
    }
    // Courier: talk to someone in a sister town.
    const sister = cities.find((o) => o.cont === ci && o !== city && o.npcs.length);
    if (sister) {
      const to = sister.npcs[0]!;
      quests.push({
        id: qid(`${city.name}-letter`), name: `${city.name}: A Letter for ${sister.name}`, about: `Carry a sealed letter to ${npcIndex.get(to)?.name} in ${sister.name}.`, giver: city.npcs[0]!,
        steps: [{ type: "talk", npcId: to, hint: `In ${sister.name}.` }], turnIn: to, reward: reward(ci, 0.6),
        offer: `Could you carry this to ${npcIndex.get(to)?.name} in ${sister.name}? Follow the road.`, progress: `${sister.name} is down the road.`, done: "A letter from home. Bless you, traveller.",
      });
    }
  }

  // ---- main story (Veilreach) -------------------------------------------------------------
  if (opts.story) buildStory();
  function buildStory() {
    const capitals = conts.map((_, ci) => cities.find((c) => c.cont === ci && c.kind === "capital")).filter((c): c is City => !!c);
    if (!capitals.length) return;
    const home = capitals[0]!;
    const elder = home.npcs[0]!;
    const elderName = npcIndex.get(elder)!.name;
    let prev: string | undefined;
    const add = (q: MapQuest) => { quests.push({ ...q, ...(prev ? { requires: prev } : {}) }); prev = q.id; };
    // Chapter 1: at home.
    const lm0 = places.find((p) => p.cont === 0 && p.kind === "landmark");
    add({
      id: qid("story-1-sundered"), name: "I · The Sundered Crown", about: `${elderName} tells of the Crown that once held Veilreach together, and of the five Wardens who keep its shards.`,
      giver: elder, steps: [{ type: "talk", npcId: home.npcs[1]!, hint: `The captain of ${home.name}.` }, ...(lm0 ? [{ type: "goto", tx: lm0.x, ty: lm0.y, radius: 5, hint: `${lm0.name}, outside ${home.name}.` } as MapQuestStep] : [])],
      reward: { kyo: 80, xp: 120, items: [{ itemId: "potion", count: 3 }] },
      offer: "When the Veil tore, the Crown broke into shards and the land broke with it. Speak to our captain, then see the old stones for yourself.", progress: "The stones remember. Go and look.", done: "You felt it, didn't you? The land wants to be whole. The Wardens across the sea hold the shards.",
    });
    // One chapter per other continent: reach its capital, do the Warden's trial.
    const numerals = ["II", "III", "IV", "V", "VI", "VII", "VIII"];
    capitals.slice(1).forEach((cap, k) => {
      const ci = cap.cont;
      const c = conts[ci]!;
      const warden = cap.npcs[0]!;
      const wardenName = npcIndex.get(warden)!.name;
      const th = THEMES[c.theme];
      const res = places.find((p) => p.cont === ci && p.kind === "resource" && p.node !== "fish");
      const lm = places.find((p) => p.cont === ci && p.kind === "landmark");
      const boss = bossOf.get(ci);
      const scholar = cities.find((x) => x.cont === ci && x !== cap && x.npcs.length);
      const trial: MapQuestStep[] = [];
      if (scholar) trial.push({ type: "talk", npcId: scholar.npcs[0]!, hint: `In ${scholar.name}.` });
      if (res && k % 2 === 0) trial.push({ type: "gather", node: res.node!, count: 5, hint: `${res.name}.` });
      trial.push({ type: "kill", count: 8, species: th.monsters[0]!, hint: `In the wilds of ${c.name}.` });
      if (lm) trial.push({ type: "goto", tx: lm.x, ty: lm.y, radius: 5, hint: `${lm.name}.` });
      if (boss && k >= 2) trial.push({ type: "kill", count: 1, species: boss.species, hint: `The guardian at ${boss.place.name}.` });
      add({
        id: qid(`story-${k + 2}-${c.name}`), name: `${numerals[k] ?? k + 2} · The ${c.name} Shard`, about: `Sail to ${c.name} and earn the shard held by ${wardenName} in ${cap.name}.`,
        giver: k === 0 ? elder : capitals[k]!.npcs[0]!, turnIn: warden,
        steps: [{ type: "talk", npcId: warden, hint: `${cap.name}, capital of ${c.name}. Take a ferry from a harbour.` }, ...trial],
        reward: { ...reward(ci, 2), items: [{ itemId: "big_potion", count: 2 }, { itemId: "ghost_jar", count: 1 }] },
        offer: k === 0 ? `The nearest shard is in ${c.name}. Find ${wardenName} in ${cap.name}. The harbour can take you.` : `The next shard lies in ${c.name}. ${wardenName} keeps it in ${cap.name}.`,
        progress: `${wardenName} will not part with the shard cheaply.`, done: `You have earned it. Take the ${c.name} shard, and carry word to the next Warden.`,
      });
    });
    // Finale: back home, then the throne.
    const throne = places.find((p) => p.kind === "landmark" && p.cont === conts.length - 1) ?? places.find((p) => p.kind === "landmark");
    const finalBoss = bossOf.get(conts.length - 1);
    add({
      id: qid("story-final-crown"), name: "Finale · The Crown Remade", about: `Bring the shards home to ${elderName}, then face what waits at the old throne.`,
      giver: capitals[capitals.length - 1]!.npcs[0]!, turnIn: elder,
      steps: [
        { type: "talk", npcId: elder, hint: `${home.name}.` },
        ...(throne ? [{ type: "goto", tx: throne.x, ty: throne.y, radius: 5, hint: `${throne.name}.` } as MapQuestStep] : []),
        ...(finalBoss ? [{ type: "kill", count: 1, species: finalBoss.species, hint: "The guardian of the throne." } as MapQuestStep] : []),
      ],
      reward: { kyo: 2500, xp: 3000, items: [{ itemId: "big_potion", count: 5 }, { itemId: "ghost_jar", count: 3 }, { itemId: "cleanse_salt", count: 5 }] },
      offer: "Every shard is gathered. Take them home, and finish what the Veil began.", progress: "The throne waits.", done: "The Crown is whole. Veilreach will remember your name.",
    });
  }

  // ---- regions for continents ----------------------------------------------------------------
  conts.forEach((c, ci) => {
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (owner[at(x, y)] === ci) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (x1 < x0) return;
    regions.push({ id: id("cont"), name: c.name, kind: "region", tx: x0, ty: y0, tw: x1 - x0 + 1, th: y1 - y0 + 1, about: c.about ?? `${THEMES[c.theme].label} lands. Foes level ${c.levelMin}–${c.levelMax}.`, levelMin: c.levelMin, levelMax: c.levelMax });
  });

  const home = cities.find((c) => c.kind === "capital" && c.cont === 0) ?? cities[0];
  const spawn = home ? nearestWalkable(home.plaza.x, home.plaza.y + 3) : nearestWalkable(Math.floor(w / 2), Math.floor(h / 2));

  // ---- connectivity: everything important must be reachable on foot or by ferry ----------
  const passable = (x: number, y: number) => x > 1 && y > 1 && x < w - 2 && y < h - 2 && !tiles[at(x, y)]!.block && tiles[at(x, y)]!.floor !== FL.water && tiles[at(x, y)]!.floor !== FL.wall;
  const reachFrom = (sx: number, sy: number) => {
    const seen = new Uint8Array(N);
    const q = [at(sx, sy)];
    seen[q[0]!] = 1;
    for (let k = 0; k < q.length; k++) {
      const i = q[k]!, x = i % w, y = (i / w) | 0;
      const next: [number, number][] = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      const pt = tiles[i]!.portal;
      if (pt && pt.map === opts.id && pt.tx !== undefined) next.push([pt.tx, pt.ty!]);
      for (const [nx, ny] of next) {
        if (!passable(nx, ny)) continue;
        const j = at(nx, ny);
        if (!seen[j]) { seen[j] = 1; q.push(j); }
      }
    }
    return seen;
  };
  /** Clears (or bridges) the cheapest way from (x, y) to anything already reachable. */
  const carveTo = (x: number, y: number, seen: Uint8Array) => {
    const prev = new Int32Array(N).fill(-1);
    const dist = new Float32Array(N).fill(Infinity);
    const heap = new MinHeap();
    const s0 = at(x, y);
    dist[s0] = 0;
    heap.push(s0, 0);
    let goal = -1;
    while (heap.size) {
      const i = heap.pop();
      if (seen[i]) { goal = i; break; }
      const cx = i % w, cy = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + dx, ny = cy + dy;
        if (nx <= 1 || ny <= 1 || nx >= w - 2 || ny >= h - 2) continue;
        const j = at(nx, ny), t = tiles[j]!;
        const c = dist[i]! + (passable(nx, ny) ? 1 : t.floor === FL.water ? 12 : 4);
        if (c < dist[j]!) { dist[j] = c; prev[j] = i; heap.push(j, c); }
      }
    }
    if (goal < 0) return;
    for (let i = goal; i >= 0 && i !== s0; i = prev[i]!) {
      const cx = i % w, cy = (i / w) | 0;
      if (passable(cx, cy)) continue;
      const t = tiles[i]!;
      if (t.floor === FL.water) set(cx, cy, { floor: FL.stone, block: 0, sprite: pickArt(ART.pebble, cx, cy, 60), layers: undefined });
      else set(cx, cy, { floor: t.floor === FL.lava || t.floor === FL.wall ? FL.dirt : t.floor, block: 0, sprite: t.floor === FL.lava ? pickArt(ART.volcanic, cx, cy, 61) : mountain[i] ? pickArt(ART.pebble, cx, cy, 62) : t.sprite, layers: undefined });
    }
    if (!passable(x, y)) set(x, y, { block: 0, layers: undefined });
  };
  const targets: { x: number; y: number }[] = [
    ...npcs.map((n) => ({ x: n.tx, y: n.ty })),
    ...interactables.map((i) => ({ x: i.tx, y: i.ty })),
    ...places.map((p) => ({ x: p.x, y: p.y })),
    ...cities.map((c) => c.plaza).map((p) => ({ x: p.x, y: p.y + 2 })),
  ];
  let reach = reachFrom(spawn.x, spawn.y);
  for (const t of targets) {
    if (reach[at(t.x, t.y)]) continue;
    carveTo(t.x, t.y, reach);
    reach = reachFrom(spawn.x, spawn.y);
  }
  // Camps only where they can be reached (at least a few reachable tiles inside).
  for (let k = zones.length - 1; k >= 0; k--) {
    const z = zones[k]!;
    let n = 0;
    for (let y = z.ty; y < z.ty + z.th; y++) for (let x = z.tx; x < z.tx + z.tw; x++) if (reach[at(x, y)]) n++;
    if (n < 12) zones.splice(k, 1);
  }
  // Quest destinations snap to the nearest reachable tile.
  const nearestReach = (x: number, y: number) => {
    for (let r = 0; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inside(x + dx, y + dy) && reach[at(x + dx, y + dy)]) return { x: x + dx, y: y + dy };
    return { x, y };
  };
  for (const q of quests) for (const st of q.steps) if (st.type === "goto") { const p = nearestReach(st.tx, st.ty); st.tx = p.x; st.ty = p.y; }
  // Map edges are always solid.
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) tiles[at(x, y)] = { ...tiles[at(x, y)]!, block: 1 };
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) tiles[at(x, y)] = { ...tiles[at(x, y)]!, block: 1 };
  for (const t of tiles) if (!t.layers) delete t.layers;

  return {
    version: MAP_VERSION, id: opts.id, name: opts.name, w, h, tileSize: TILE, tiles, kind: "world",
    spawns, zones, interactables, npcs, quests, regions, spawn: { tx: spawn.x, ty: spawn.y },
    intro: opts.intro ?? `Welcome to ${opts.name}.\n\nThe roads lead between towns; the ferries cross the sea. Talk to the people you meet: they know where to go next.`,
    notes: `Generated with seed ${seed}. Edit freely in the Map Builder.`,
  };
}

/** Binary min-heap of tile indices by priority (for road A*). */
class MinHeap {
  private ids: number[] = [];
  private pri: number[] = [];
  get size() { return this.ids.length; }
  push(id: number, p: number) {
    const a = this.ids, b = this.pri;
    a.push(id); b.push(p);
    let i = a.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (b[j]! <= p) break;
      a[i] = a[j]!; b[i] = b[j]!; i = j;
    }
    a[i] = id; b[i] = p;
  }
  pop(): number {
    const a = this.ids, b = this.pri;
    const top = a[0]!;
    const id = a.pop()!, p = b.pop()!;
    if (a.length) {
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i, mp = p;
        if (l < a.length && b[l]! < mp) { m = l; mp = b[l]!; }
        if (r < a.length && b[r]! < mp) { m = r; mp = b[r]!; }
        if (m === i) break;
        a[i] = a[m]!; b[i] = b[m]!; i = m;
      }
      a[i] = id; b[i] = p;
    }
    return top;
  }
}

// ---------------------------------------------------------------------------
// Veilreach: the 500×500 preset
// ---------------------------------------------------------------------------

export const VEILREACH_ID = "veilreach";

export const VEILREACH_CONTINENTS: ContinentSpec[] = [
  { name: "Hearthmere", theme: "verdant", x: 0.26, y: 0.42, r: 104, levelMin: 1, levelMax: 12, about: "Green meadows and old forests. Where every hunter starts." },
  { name: "Saltmire", theme: "tide", x: 0.6, y: 0.72, r: 92, levelMin: 10, levelMax: 24, about: "Marsh, mangrove and long white beaches." },
  { name: "Frostmarch", theme: "frost", x: 0.52, y: 0.15, r: 92, levelMin: 20, levelMax: 36, about: "Snowfields and frozen lakes under a white sky." },
  { name: "Emberwaste", theme: "ashen", x: 0.17, y: 0.82, r: 84, levelMin: 32, levelMax: 48, about: "Ash plains, red sand and rivers of lava." },
  { name: "Hollowdeep", theme: "void", x: 0.84, y: 0.36, r: 86, levelMin: 45, levelMax: 62, about: "Crystal wastes where the Veil runs thin." },
  { name: "Bonereach", theme: "bone", x: 0.88, y: 0.86, r: 66, levelMin: 60, levelMax: 78, about: "A continent of tombs. The dead walk here." },
  { name: "Crownfall Isle", theme: "crown", x: 0.53, y: 0.45, r: 44, levelMin: 75, levelMax: 90, about: "The broken heart of the old kingdom. The throne still stands." },
];

export function buildVeilreach(): MapFile {
  return generateWorld({
    id: VEILREACH_ID,
    name: "Veilreach",
    seed: 1771,
    w: 500,
    h: 500,
    continents: VEILREACH_CONTINENTS,
    islands: 12,
    citiesPerContinent: 4,
    story: true,
    intro: "Veilreach.\n\nOnce one kingdom under one Crown. When the Veil tore, the Crown shattered and the land split into seven: green Hearthmere, the marshes of Saltmire, the white Frostmarch, the burning Emberwaste, crystal Hollowdeep, the tombs of Bonereach, and the isle where the throne still stands.\n\nYou wake in Hearthmere. Find the Elder by the fountain. Roads join the towns; ferries cross the sea from every harbour.",
  });
}
