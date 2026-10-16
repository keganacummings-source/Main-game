/**
 * World generator for the Map Builder.
 *
 * Builds a whole designer map from a seed, good enough to be played as a main world: continents of
 * different shapes (round, long, twin-lobed, ragged) and islands split by sea, a main climate per land
 * with patches of a second one, mountain ranges, lakes and rivers, and a full spread of settlements —
 * capitals, towns, harbours, villages, hamlets, forts, abbeys, market towns, mining camps and ruined
 * towns — each laid out in its own street style (crossroads, grid, ring, high street, scattered) with
 * houses, shops, inns, smithies, temples, warehouses, gardens, wells and markets. Roads and bridges join
 * the towns; ferries cross the sea. The wilds get landmarks (ruins, standing stones, watchtowers,
 * spires, graveyards, huts, shipwrecks, craters, obelisks, old gates...), monster camps, guardians,
 * resource sites, and scattered scenery. Resource nodes are placed one at a time across the land,
 * never stamped in grids.
 *
 * NPCs get dialogue, every settlement posts quests, and (optionally) a main story visits every continent.
 * A final pass (quest-check.ts) makes sure every quest can actually be finished.
 *
 * Everything is ordinary Map Builder data, so the result can be opened and edited by hand.
 */
import { MONSTER_BY_ID, ANIMAL_BY_ID, POIS, TILE, mulberry32, type Rng } from "./content";
import { LIMITS, MAP_VERSION, type MapFile, type MapInteractable, type MapNpc, type MapQuest, type MapQuestStep, type MapRegion, type MapTile, type SpawnZone } from "./map-format";
import { repairQuests } from "./quest-check";
import type { Spawn, Tile, WorldData } from "./world";

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
const X = "/MapAssets/11_Vaults_and_Special_Areas/";
const O = "/MapAssets/12_Dungeon_Tiles_Other/";

const seq = (dir: string, fmt: (i: number) => string, from: number, to: number) => Array.from({ length: to - from + 1 }, (_, k) => dir + fmt(from + k));

/** Every sprite the generator may use. scripts/map-maker.test.mjs checks that each file exists. */
export const ART = {
  grass: seq(F, (i) => `grass_${i}_new.png`, 0, 2),
  flowers: [...seq(F, (i) => `grass_flowers_yellow_${i}_new.png`, 1, 3), ...seq(F, (i) => `grass_flowers_red_${i}_new.png`, 1, 3), ...seq(F, (i) => `grass_flowers_blue_${i}_new.png`, 1, 3)],
  dirt: [...seq(F, (i) => `dirt_${i}_new.png`, 0, 2), F + "dirt_full_new.png"],
  grassDirt: seq(F, (i) => `grass0-dirt-mix_${i}.png`, 1, 3),
  pebble: seq(F, (i) => `pebble_brown_${i}_new.png`, 0, 8),
  greyDirt: seq(F, (i) => `grey_dirt_${i}_new.png`, 0, 7),
  sand: seq(F, (i) => `sand_${i}.png`, 1, 8),
  sandstone: seq(F, (i) => `sandstone_floor_${i}.png`, 0, 9),
  sandStoneFloor: seq(F, (i) => `floor_sand_stone_${i}.png`, 0, 7),
  sandRock: seq(F, (i) => `floor_sand_rock_${i}.png`, 0, 3),
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
  etched: seq(F, (i) => `etched_${i}.png`, 0, 5),
  roughRed: seq(F, (i) => `rough_red_${i}.png`, 0, 3),
  crypt: [F + "crypt_10.png", F + "crypt_11.png"],
  sigil: [F + "sigil_circle.png", F + "circle.png"],
  lair: [...seq(F, (i) => `lair_${i}_new.png`, 0, 3)],
  // walls
  stoneBrick: seq(W, (i) => `stone_brick_${i}.png`, 1, 12),
  brickBrown: seq(W, (i) => `brick_brown_${i}.png`, 0, 7),
  vineBrick: seq(W, (i) => `brick_brown-vines_${i}.png`, 1, 4),
  brickGray: seq(W, (i) => `brick_gray_${i}.png`, 0, 3),
  brickDark: seq(W, (i) => `brick_dark_${i}.png`, 0, 6),
  sandWall: seq(W, (i) => `sandstone_wall_${i}.png`, 0, 9),
  marbleWall: seq(W, (i) => `marble_wall_${i}.png`, 1, 12),
  church: seq(W, (i) => `church_${i}.png`, 0, 4),
  stoneGray: seq(W, (i) => `stone_gray_${i}.png`, 0, 3),
  stoneDark: seq(W, (i) => `stone_dark_${i}.png`, 0, 3),
  stone2: [W + "stone_2_gray_0.png", W + "stone_2_gray_1.png", W + "stone_2_brown_0.png", W + "stone_2_brown_1.png"],
  relief: seq(W, (i) => `relief_${i}.png`, 0, 3),
  torch: seq(W, (i) => `torch_${i}.png`, 0, 4),
  banner: [W + "banner_1.png"],
  metal: [W + "metal_wall.png", W + "metal_wall_brown.png"],
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
  // props
  trees: [V + "tree_1_yellow.png", V + "tree_2_yellow.png", V + "tree_1_red.png", V + "tree_2_red.png", V + "tree_1_lightred.png", V + "tree_2_lightred.png"],
  mangrove: seq(V, (i) => `mangrove_${i}.png`, 1, 3),
  doors: [D + "closed_door.png", D + "open_door.png"],
  runedDoor: [D + "runed_door.png", D + "sealed_door.png"],
  gateOpen: [D + "gate_open_middle.png"],
  shop: {
    general: B + "shop_general.png", armor: B + "shop_armor.png", weapon: B + "shop_weapon.png", potions: B + "shop_potions.png", food: B + "shop_food.png",
    books: B + "shop_books.png", scrolls: B + "shop_scrolls.png", jewellery: B + "shop_jewellery.png", wands: B + "shop_wands.png", gadgets: B + "shop_gadgets.png",
  },
  abandonedShop: [B + "abandoned_shop.png"],
  fountain: [O + "sparkling_fountain.png", O + "blue_fountain.png", O + "blue_fountain_2.png", O + "sparkling_fountain_2.png"],
  dryFountain: [O + "dry_fountain.png"],
  bloodFountain: [O + "blood_fountain.png", O + "blood_fountain_2.png"],
  statues: [S + "statue_angel.png", S + "statue_archer.png", S + "statue_sword.png", S + "statue_princess.png", S + "statue_ancient_hero.png", S + "statue_twins.png", S + "statue_cat.png", S + "statue_dragon.png", S + "statue_dwarf.png", S + "statue_mermaid.png", S + "statue_centaur.png", S + "statue_elephant.png", S + "statue_tengu.png", S + "granite_statue.png"],
  darkStatues: [S + "statue_wraith.png", S + "statue_ancient_evil.png", S + "statue_demonic_bust.png", S + "statue_hydra.png", S + "statue_naga.png", S + "statue_imp.png"],
  dragon: [S + "statue_dragon.png"],
  ironStatue: [S + "statue_iron.png", X + "statue_iron_golem.png"],
  golden: [X + "golden_statue_1.png", X + "golden_statue_2.png", X + "statue_elephant_jade.png"],
  orb: [S + "statue_orb.png", S + "statue_orb_guardian.png", S + "statue_triangle.png"],
  columns: [S + "crumbled_column.png", ...seq(S, (i) => `crumbled_column_${i}.png`, 1, 6)],
  stones: [S + "granite_stump_new.png", S + "granite_stump_old.png", S + "orcish_idol_new.png"],
  pedestal: [S + "pedestal.png", S + "statue_bases.png"],
  altars: [A + "altar_base.png", A + "altar_shining_one.png", A + "altar_zin.png", A + "altar_vehumet.png", A + "altar_sif_muna.png", A + "altar_elyvilon.png", A + "altar_fedhas.png", A + "altar_okawaru.png"],
  darkAltars: [A + "altar_yredelemnul.png", A + "altar_kikubaaqudgha.png", A + "altar_lugonu.png", A + "altar_beogh.png"],
  boulder: [O + "boulder.png"],
  pillar: [O + "zot_pillar.png"],
  boxes: [O + "large_box.png", O + "chest.png", O + "chest_2_closed.png"],
  sarcophagus: [O + "sarcophagus_open.png", X + "sarcophagus_sealed.png"],
  mold: seq(O, (i) => `mold_large_${i}.png`, 1, 4),
  grate: [X + "grate.png"],
  arch: [G + "stone_arch.png"],
  stairs: [G + "stone_stairs_down.png", G + "rock_stairs_down.png"],
  portal: [G + "portal.png", G + "starry_portal.png"],
  crypt_: [G + "enter_crypt.png", G + "enter_tomb.png"],
  cave: [G + "enter_lair.png", G + "enter_orc.png", G + "enter_snake.png", G + "enter_spider.png"],
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
type LandmarkKind = "ruins" | "watchstone" | "altar" | "barrow" | "stones" | "tower" | "spire" | "graveyard" | "hut" | "gate" | "dragon" | "obelisk" | "wreck" | "crater" | "grove" | "statues";
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
  /** Other wall palettes for houses, so one street is never a single colour. */
  houseAlt: string[][];
  /** Road art. */
  path: string[];
  trees: string[] | null;
  /** Monsters and animals for camps, from the game's roster. */
  monsters: string[];
  animals: string[];
  shrine: string;
  lakes: boolean;
  /** Lava flows instead of rivers. */
  lavaRivers?: boolean;
  /** Landmarks this land favours (repeats weight the pick). */
  landmarks: LandmarkKind[];
  /** Words for this land's continent names. */
  epithets: string[];
};

/** A local keepsake each land hands out as a quest reward (all real items). */
const THEME_LOOT: Record<ThemeId, string> = { verdant: "blue_lantern", frost: "frost_crystal", ashen: "embercap", tide: "tide_pearl", void: "veil_dust", bone: "bone_shard", crown: "lantern_mote" };
/** What a gather step puts in the bag, so a "bring" step can follow it. */
const NODE_ITEM = { tree: "timber", ore: "ore", shroom: "mushroom", fish: "fish" } as const;

const g = (art: string[], floor: number, biome: number, accent?: string[], accentChance = 0): Ground => ({ art, floor, biome, accent, accentChance });

const THEMES: Record<ThemeId, Theme> = {
  verdant: {
    id: "verdant", label: "Verdant",
    grounds: [g(ART.dirt, FL.dirt, BI.verdant, ART.pebble, 0.2), g(ART.grass, FL.grass, BI.verdant, ART.flowers, 0.08), g(ART.moss, FL.grass, BI.verdant, ART.vines, 0.25)],
    coast: g(ART.sand, FL.sand, BI.tide), mountain: [...ART.stoneGray, ...ART.vineWall.slice(0, 3)], cityFloor: ART.limestone, cityWall: ART.stoneBrick, houseWall: ART.brickBrown,
    houseAlt: [ART.vineBrick, ART.brickGray, ART.stone2, ART.stoneBrick], path: ART.dirt,
    trees: ART.trees, monsters: ["kusa", "yanagi", "mokuzu", "umoregi", "tsuchi", "hikari"], animals: ["hare", "boar", "stag"], shrine: "earth", lakes: true,
    landmarks: ["ruins", "stones", "tower", "hut", "grove", "grove", "altar", "statues", "gate", "barrow"], epithets: ["Green", "Wild", "Old", "Deep"],
  },
  frost: {
    id: "frost", label: "Frost",
    grounds: [g(ART.greyDirt, FL.dirt, BI.frost), g(ART.snow, FL.snow, BI.frost), g(ART.ice, FL.snow, BI.frost, ART.snow, 0.3)],
    coast: g(ART.ice, FL.snow, BI.frost), mountain: [...ART.cobaltRock, ...ART.stoneGray], cityFloor: ART.whiteMarble, cityWall: ART.marbleWall, houseWall: ART.brickGray,
    houseAlt: [ART.stoneGray, ART.stone2, ART.marbleWall], path: ART.greyDirt,
    trees: null, monsters: ["yuki", "kaze", "raiju", "hikari"], animals: ["wolf", "stag", "hare"], shrine: "ice", lakes: true,
    landmarks: ["stones", "stones", "tower", "barrow", "spire", "gate", "dragon", "ruins", "hut"], epithets: ["White", "Frozen", "Pale", "High"],
  },
  ashen: {
    id: "ashen", label: "Ashen",
    grounds: [g(ART.sand, FL.sand, BI.ashen, ART.sandstone, 0.15), g(ART.volcanic, FL.ash, BI.ashen), g(ART.pebble, FL.ash, BI.ashen, ART.volcanic, 0.3)],
    coast: g(ART.sand, FL.sand, BI.ashen), mountain: ART.volcanicWall, cityFloor: ART.sandstone, cityWall: ART.sandWall, houseWall: ART.sandWall,
    houseAlt: [ART.yellowRock, ART.brickDark, ART.sandWall], path: ART.pebble,
    trees: null, monsters: ["onibi", "nobi", "hinotama", "kagaribi", "raiju"], animals: ["boar", "crow"], shrine: "fire", lakes: false, lavaRivers: true,
    landmarks: ["crater", "crater", "dragon", "obelisk", "ruins", "tower", "altar", "statues"], epithets: ["Burning", "Red", "Ashen", "Scorched"],
  },
  tide: {
    id: "tide", label: "Tide",
    grounds: [g(ART.sand, FL.sand, BI.tide), g(ART.swamp, FL.bog, BI.tide, ART.moss, 0.15), g(ART.bog, FL.bog, BI.tide, ART.mud, 0.25)],
    coast: g(ART.sand, FL.sand, BI.tide), mountain: [...ART.labRock, ...ART.stoneDark], cityFloor: ART.street, cityWall: ART.stoneBrick, houseWall: ART.brickBrown,
    houseAlt: [ART.vineBrick, ART.brickGray, ART.stone2], path: ART.mud,
    trees: ART.mangrove, monsters: ["shizuku", "nami", "uroko", "kasa", "wisp"], animals: ["crow", "hare"], shrine: "water", lakes: true,
    landmarks: ["wreck", "wreck", "hut", "grove", "ruins", "statues", "altar", "barrow"], epithets: ["Salt", "Drowned", "Grey", "Sunken"],
  },
  void: {
    id: "void", label: "Void",
    grounds: [g(ART.cobalt, FL.void, BI.void), g(ART.crystal, FL.void, BI.void, ART.cobalt, 0.2), g(ART.lair, FL.void, BI.void, ART.crystal, 0.2)],
    coast: g(ART.cobalt, FL.void, BI.void), mountain: [...ART.crystalWall, ...ART.emerald], cityFloor: ART.mosaic, cityWall: ART.crystalWall, houseWall: ART.emerald,
    houseAlt: [ART.crystalWall, ART.metal, ART.relief], path: ART.cobalt,
    trees: null, monsters: ["kage", "yomi", "naraku", "muma", "yami"], animals: ["crow", "wolf"], shrine: "light", lakes: false,
    landmarks: ["spire", "spire", "obelisk", "obelisk", "gate", "statues", "altar", "stones"], epithets: ["Hollow", "Dim", "Shattered", "Veiled"],
  },
  bone: {
    id: "bone", label: "Bone",
    grounds: [g(ART.greyDirt, FL.bone, BI.bone, ART.bones, 0.15), g(ART.tomb, FL.bone, BI.bone, ART.bones, 0.1), g(ART.bones, FL.bone, BI.bone, ART.mud, 0.2)],
    coast: g(ART.greyDirt, FL.dirt, BI.bone), mountain: [...ART.catacombs, ...ART.tombWall], cityFloor: ART.tomb, cityWall: ART.catacombs, houseWall: ART.tombWall,
    houseAlt: [ART.brickDark, ART.stoneDark, ART.catacombs], path: ART.greyDirt,
    trees: null, monsters: ["gaikotsu", "muma", "yami", "saintling"], animals: ["crow", "wolf"], shrine: "light", lakes: false,
    landmarks: ["graveyard", "graveyard", "barrow", "barrow", "dragon", "obelisk", "ruins", "altar"], epithets: ["Dead", "Silent", "Bleak", "Grave"],
  },
  crown: {
    id: "crown", label: "Crown",
    grounds: [g(ART.pebble, FL.stone, BI.crown), g(ART.grass, FL.grass, BI.crown, ART.columns, 0), g(ART.marble, FL.stone, BI.crown)],
    coast: g(ART.sand, FL.sand, BI.crown), mountain: [...ART.marbleWall, ...ART.stoneGray], cityFloor: ART.marble, cityWall: ART.marbleWall, houseWall: ART.church,
    houseAlt: [ART.marbleWall, ART.stoneBrick, ART.relief], path: ART.street,
    trees: ART.trees, monsters: ["gaikotsu", "yami", "hikari", "saintling", "kage"], animals: ["crow"], shrine: "light", lakes: false,
    landmarks: ["statues", "statues", "ruins", "gate", "tower", "altar", "obelisk", "grove"], epithets: ["Crown", "Golden", "Royal", "Broken"],
  },
};
const THEME_IDS = Object.keys(THEMES) as ThemeId[];

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

const SYL_A = ["Ash", "Bram", "Cal", "Dun", "El", "Fen", "Gal", "Hal", "Ith", "Kel", "Lor", "Mar", "Nor", "Os", "Pell", "Quen", "Ros", "Sel", "Tor", "Ul", "Vel", "Wyn", "Yar", "Zan", "Mire", "Thorn", "Rook", "Brin", "Corr", "Dray", "Eld", "Frost", "Glen", "Hart", "Iver", "Jas", "Kirk", "Lyn", "Mor", "Nes", "Orm", "Pyr", "Rav", "Stag", "Tam", "Vey", "Wold", "Ard", "Bel", "Cin"];
const SYL_B = ["ford", "mere", "hold", "wick", "stead", "gate", "haven", "moor", "fell", "crest", "vale", "spire", "watch", "barrow", "reach", "hollow", "port", "march", "rest", "brook", "by", "ton", "wall", "dale", "mouth", "field", "cairn", "heath", "bridge", "well", "keep", "fall", "shaw", "low"];
const FIRST = ["Maren", "Odile", "Tamsin", "Corwin", "Bryn", "Ilse", "Joss", "Kestrel", "Liora", "Nell", "Orrin", "Pim", "Quill", "Rhea", "Soren", "Tilda", "Ulric", "Vesna", "Wren", "Yara", "Ansel", "Beck", "Cass", "Dorian", "Edda", "Faro", "Greta", "Hollis", "Ivo", "Juno", "Kit", "Lark", "Mabel", "Nico", "Oona", "Piet", "Rosa", "Silas", "Thea", "Viggo", "Agna", "Bastian", "Cora", "Dagny", "Emrys", "Fia", "Gideon", "Hesper", "Isolde", "Jory", "Kaja", "Linus", "Mirela", "Nils", "Ottilie", "Perrin", "Runa", "Sable", "Tobin", "Una"];

function placeName(rng: Rng, used: Set<string>): string {
  for (let i = 0; i < 60; i++) {
    const n = SYL_A[Math.floor(rng() * SYL_A.length)]! + SYL_B[Math.floor(rng() * SYL_B.length)]!;
    if (!used.has(n)) { used.add(n); return n; }
  }
  const n = `Town ${used.size + 1}`;
  used.add(n);
  return n;
}

// ---------------------------------------------------------------------------
// Settlements
// ---------------------------------------------------------------------------

export type SettlementKind = "capital" | "town" | "port" | "village" | "hamlet" | "fort" | "abbey" | "market" | "minetown" | "ruin";
type Style = "cross" | "grid" | "ring" | "row" | "scatter";
type KindSpec = { w: [number, number]; h: [number, number]; walled: number; styles: Style[]; coast: number; plaza: number; houses: [number, number]; word: string };
const KIND: Record<SettlementKind, KindSpec> = {
  capital: { w: [36, 44], h: [28, 34], walled: 1, styles: ["cross", "grid", "ring"], coast: 5, plaza: 5, houses: [14, 24], word: "Capital" },
  town: { w: [26, 32], h: [20, 24], walled: 0.75, styles: ["cross", "grid", "row"], coast: 5, plaza: 3, houses: [8, 14], word: "Town" },
  port: { w: [22, 26], h: [16, 20], walled: 0.85, styles: ["cross", "row"], coast: 3, plaza: 3, houses: [6, 11], word: "Harbour" },
  village: { w: [14, 18], h: [12, 14], walled: 0, styles: ["scatter", "row"], coast: 4, plaza: 2, houses: [4, 7], word: "Village" },
  hamlet: { w: [11, 13], h: [10, 12], walled: 0, styles: ["scatter"], coast: 4, plaza: 1, houses: [2, 4], word: "Hamlet" },
  fort: { w: [16, 19], h: [16, 19], walled: 1, styles: ["cross"], coast: 4, plaza: 2, houses: [3, 5], word: "Fort" },
  abbey: { w: [18, 22], h: [14, 17], walled: 1, styles: ["cross"], coast: 5, plaza: 2, houses: [3, 5], word: "Abbey" },
  market: { w: [24, 28], h: [18, 22], walled: 0.4, styles: ["grid", "cross"], coast: 4, plaza: 4, houses: [6, 11], word: "Market" },
  minetown: { w: [18, 22], h: [14, 16], walled: 0, styles: ["row", "scatter"], coast: 6, plaza: 2, houses: [4, 7], word: "Mine" },
  ruin: { w: [20, 26], h: [16, 20], walled: 1, styles: ["cross", "grid", "ring"], coast: 4, plaza: 3, houses: [6, 10], word: "Ruin" },
};
/** Extra settlements a continent can have beyond its capital, harbour, towns and villages. */
const EXTRA_KINDS: SettlementKind[] = ["hamlet", "hamlet", "fort", "abbey", "market", "minetown", "ruin", "ruin"];

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
  /** Number of continents when `continents` is not given (2–8). Left out, the seed picks 3–7. */
  continentCount?: number;
  /** Exact continents (positions as 0–1 fractions of the map, radius in tiles). */
  continents?: ContinentSpec[];
  /** Small islands sprinkled in the sea. */
  islands?: number;
  /** Cities per continent (1–5). */
  citiesPerContinent?: number;
  /** Build the main story on top. */
  story?: boolean;
  intro?: string;
};

type City = {
  id: string; name: string; cont: number; x: number; y: number; w: number; h: number; kind: SettlementKind; style: Style; walled: boolean;
  plaza: { x: number; y: number }; gates: { x: number; y: number }[]; dock?: { x: number; y: number; arrive: { x: number; y: number } }; npcs: string[];
};
type Place = { id: string; name: string; cont: number; x: number; y: number; kind: "landmark" | "resource"; node?: "tree" | "ore" | "shroom" | "fish"; lk?: LandmarkKind };
type Site = { x: number; y: number; r: number; island: boolean; cont: number; sx: number; sy: number; ang: number };

export function generateWorld(opts: WorldGenOptions): MapFile {
  const w = Math.max(64, Math.min(512, Math.floor(opts.w)));
  const h = Math.max(64, Math.min(512, Math.floor(opts.h)));
  const seed = opts.seed >>> 0 || 1;
  const rng = mulberry32(seed);
  const N = w * h;
  const at = (x: number, y: number) => y * w + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const usedNames = new Set<string>();
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;
  const between = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
  const shuffle = <T,>(list: T[]): T[] => { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [list[i], list[j]] = [list[j]!, list[i]!]; } return list; };

  // ---- continents --------------------------------------------------------------------------
  let conts: ContinentSpec[] = opts.continents ?? [];
  if (!conts.length) {
    const auto = Math.round(3 + rng() * Math.min(4, (w * h) / 40000));
    const n = Math.max(2, Math.min(8, opts.continentCount ?? auto));
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < n; i++) {
      let best = { x: 0.5, y: 0.5 }, bd = -1;
      for (let k = 0; k < 40; k++) {
        const p = { x: 0.16 + rng() * 0.68, y: 0.16 + rng() * 0.68 };
        const d = Math.min(...pts.map((q) => Math.hypot(q.x - p.x, q.y - p.y)), 9);
        if (d > bd) { bd = d; best = p; }
      }
      pts.push(best);
    }
    // Every world gets its own climates: the first land is a gentle one to start in, the rest are shuffled.
    const starters: ThemeId[] = ["verdant", "verdant", "tide", "frost", "crown"];
    const first = pick(starters);
    const rest = shuffle(THEME_IDS.filter((t) => t !== first));
    const themes = [first, ...rest, ...shuffle([...THEME_IDS])];
    // Levels rise with distance from the first land, so the danger has a direction.
    const order = pts.map((p, i) => ({ i, d: Math.hypot(p.x - pts[0]!.x, p.y - pts[0]!.y) })).sort((a, b) => a.d - b.d).map((o) => o.i);
    const sorted = order.map((i) => pts[i]!);
    const baseR = Math.min(w, h) * (0.5 / Math.sqrt(n)) * 0.95;
    conts = sorted.map((p, i) => {
      const theme = themes[i]!;
      const name = rng() < 0.55 ? placeName(rng, usedNames) : `${pick(THEMES[theme].epithets)} ${placeName(rng, usedNames)}`;
      const span = 9 + Math.floor(rng() * 5);
      return { name, theme, x: p.x, y: p.y, r: baseR * (0.78 + rng() * 0.44), levelMin: 1 + i * 12, levelMax: 1 + i * 12 + span };
    });
  } else for (const c of conts) usedNames.add(c.name);
  const sites: Site[] = conts.map((c, ci) => {
    // Shape: round, long, or squashed, at a random angle.
    const shape = rng();
    const stretch = shape < 0.35 ? 1 : shape < 0.7 ? 1.25 + rng() * 0.35 : 0.8 + rng() * 0.15;
    return { x: c.x * w, y: c.y * h, r: c.r, island: false, cont: ci, sx: stretch, sy: 1 / Math.sqrt(stretch), ang: rng() * Math.PI };
  });
  // Lobes: some continents are two or three blobs fused together.
  conts.forEach((c, ci) => {
    if (c.r < 40 || rng() < 0.45) return;
    const lobes = rng() < 0.6 ? 1 : 2;
    for (let k = 0; k < lobes; k++) {
      const a = rng() * Math.PI * 2;
      const off = c.r * (0.45 + rng() * 0.3);
      const x = c.x * w + Math.cos(a) * off, y = c.y * h + Math.sin(a) * off;
      if (x < 20 || y < 20 || x > w - 20 || y > h - 20) continue;
      sites.push({ x, y, r: c.r * (0.45 + rng() * 0.2), island: false, cont: ci, sx: 1, sy: 1, ang: 0 });
    }
  });
  const islandCount = opts.islands ?? Math.round((w * h) / 22000);
  for (let i = 0; i < islandCount; i++) {
    for (let k = 0; k < 60; k++) {
      const x = 20 + rng() * (w - 40), y = 20 + rng() * (h - 40);
      if (sites.every((s) => Math.hypot(s.x - x, s.y - y) > s.r * Math.max(s.sx, 1) + 14)) { sites.push({ x, y, r: 7 + rng() * 9, island: true, cont: -1, sx: 1, sy: 1, ang: 0 }); break; }
    }
  }
  /** Group a site belongs to: its continent, or 1000+index for an island. */
  const groupOf = (i: number) => (sites[i]!.cont >= 0 ? sites[i]!.cont : 1000 + i);
  // Per-continent character: how rugged, how wet.
  const rugged = conts.map(() => 0.84 + rng() * 0.08);
  const wetness = conts.map(() => 0.66 + rng() * 0.14);
  const secondary = conts.map((c) => (rng() < 0.65 ? pick(THEME_IDS.filter((t) => t !== c.theme)) : null));

  // ---- land, owner, mountains, lakes ------------------------------------------------------
  const owner = new Int16Array(N).fill(-1); // continent index, or site index of an island; -1 = sea
  const land = new Uint8Array(N);
  const mountain = new Uint8Array(N);
  const lake = new Uint8Array(N);
  const river = new Uint8Array(N);
  const moist = new Float32Array(N);
  const isle = new Uint8Array(N);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      // Domain warp so coasts wiggle.
      const wx = x + (fbm(x / 40, y / 40, seed + 7) - 0.5) * 36;
      const wy = y + (fbm(x / 40, y / 40, seed + 9) - 0.5) * 36;
      let d1 = Infinity, d2 = Infinity, g1 = -1, s1 = -1;
      for (let i = 0; i < sites.length; i++) {
        const s = sites[i]!;
        let dx = wx - s.x, dy = wy - s.y;
        if (s.ang) { const c = Math.cos(s.ang), sn = Math.sin(s.ang); const rx = dx * c + dy * sn, ry = -dx * sn + dy * c; dx = rx / s.sx; dy = ry / s.sy; }
        const d = Math.hypot(dx, dy) / s.r;
        const gi = groupOf(i);
        if (gi === g1) { if (d < d1) { d1 = d; s1 = i; } }
        else if (d < d1) { d2 = d1; d1 = d; g1 = gi; s1 = i; }
        else if (d < d2) d2 = d;
      }
      const s = sites[s1]!;
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
      owner[i] = g1 >= 1000 ? g1 - 1000 : g1;
      if (s.island) { isle[i] = 1; continue; }
      const ci = s.cont;
      const ridge = 1 - Math.abs(fbm(x / 34, y / 34, seed + 13 + ci) * 2 - 1);
      if (ridge > rugged[ci]! && body > 0.34) mountain[i] = 1;
      const sec = secondary[ci];
      const lakesOk = THEMES[conts[ci]!.theme].lakes || (!!sec && THEMES[sec].lakes);
      if (lakesOk && fbm(x / 26, y / 26, seed + 17) > 0.74 && body > 0.4) lake[i] = 1;
    }
  // Distance to sea (BFS) for coasts, rivers and city placement.
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
  const contAt = new Int8Array(N).fill(-1);
  {
    const islandCont = new Map<number, number>();
    for (let i = 0; i < N; i++) {
      const o = owner[i]!;
      if (o < 0) continue;
      if (!isle[i]) { contAt[i] = o; continue; }
      let best = islandCont.get(o);
      if (best === undefined) {
        const s = sites[o]!;
        let bd = Infinity;
        best = 0;
        conts.forEach((c, k) => { const d = Math.hypot(c.x * w - s.x, c.y * h - s.y); if (d < bd) { bd = d; best = k; } });
        islandCont.set(o, best);
      }
      contAt[i] = best;
    }
  }

  // ---- rivers ------------------------------------------------------------------------------
  // Each larger land gets a few rivers that start in the hills and run downhill (toward the coast) to the sea.
  conts.forEach((c, ci) => {
    const th = THEMES[c.theme];
    if (c.theme === "void" || c.theme === "bone") return;
    const count = c.r < 45 ? (rng() < 0.4 ? 1 : 0) : 1 + Math.floor(rng() * (c.r > 85 ? 3 : 2));
    for (let k = 0; k < count; k++) {
      let src = -1;
      for (let t = 0; t < 400 && src < 0; t++) {
        const x = Math.floor(c.x * w - c.r + rng() * c.r * 2), y = Math.floor(c.y * h - c.r + rng() * c.r * 2);
        if (!inside(x, y)) continue;
        const i = at(x, y);
        if (!land[i] || isle[i] || contAt[i] !== ci || mountain[i] || coastDist[i]! < 14) continue;
        let hill = false;
        for (let dy = -2; dy <= 2 && !hill; dy++) for (let dx = -2; dx <= 2; dx++) if (inside(x + dx, y + dy) && mountain[at(x + dx, y + dy)]) { hill = true; break; }
        if (hill) src = i;
      }
      if (src < 0) continue;
      let x = src % w, y = (src / w) | 0, steps = 0;
      const wide = rng() < 0.4;
      const path: number[] = [];
      while (steps++ < 400) {
        const i = at(x, y);
        if (!land[i] || coastDist[i] === 0) break;
        path.push(i);
        if (lake[i] && steps > 4) break;
        // Downhill: closer to the sea, with a meander from noise.
        let best = -1, bs = Infinity;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx, ny = y + dy;
          if (!inside(nx, ny)) continue;
          const j = at(nx, ny);
          if (path.includes(j)) continue;
          const score = coastDist[j]! + (mountain[j] ? 6 : 0) + (fbm(nx / 9, ny / 9, seed + 81 + k) - 0.5) * 3.2;
          if (score < bs) { bs = score; best = j; }
        }
        if (best < 0) break;
        x = best % w; y = (best / w) | 0;
      }
      if (path.length < 12) continue;
      path.forEach((i, n) => {
        const px = i % w, py = (i / w) | 0;
        const cells = wide && n > path.length * 0.5 ? [[0, 0], [1, 0], [0, 1]] : [[0, 0]];
        for (const [dx, dy] of cells) {
          if (!inside(px + dx!, py + dy!)) continue;
          const j = at(px + dx!, py + dy!);
          if (!land[j]) continue;
          river[j] = 1;
          mountain[j] = 0;
        }
      });
      void th;
    }
  });

  // ---- paint base tiles --------------------------------------------------------------------
  const pickArt = (art: string[], x: number, y: number, salt: number) => art[Math.floor(valueNoise(x / 5, y / 5, seed + salt) * art.length * 0.999 + (hash2(x, y, seed + salt) < 0.15 ? 1 : 0)) % art.length]!;
  const tiles: MapTile[] = new Array(N);
  /** Theme in effect on a tile: the continent's, or its second climate in patches. */
  const themeAt = new Int8Array(N).fill(-1);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = at(x, y);
      if (!land[i]) {
        const shallow = coastDist[i] === 0 && hasLandNear(x, y, 3);
        tiles[i] = { floor: FL.water, biome: BI.tide, block: 1, decor: 0, sprite: pickArt(shallow ? ART.shallow : ART.sea, x, y, 1) };
        continue;
      }
      const ci = contAt[i]!;
      const sec = secondary[ci];
      const useSec = !!sec && fbm(x / 45, y / 45, seed + 31 + ci * 7) > 0.6 && coastDist[i]! > 3;
      const tid = useSec ? sec! : conts[ci]!.theme;
      themeAt[i] = THEME_IDS.indexOf(tid);
      const th = THEMES[tid];
      if (river[i]) {
        if (THEMES[conts[ci]!.theme].lavaRivers) tiles[i] = { floor: FL.lava, biome: BI.ashen, block: 1, decor: 0, sprite: pickArt(ART.lava, x, y, 2) };
        else tiles[i] = { floor: FL.water, biome: th.grounds[1].biome, block: 1, decor: 0, sprite: pickArt(ART.shallow, x, y, 2) };
        continue;
      }
      if (lake[i]) { tiles[i] = { floor: FL.water, biome: th.grounds[1].biome, block: 1, decor: 0, sprite: pickArt(ART.deep, x, y, 2) }; continue; }
      if (mountain[i]) { tiles[i] = { floor: FL.stone, biome: th.grounds[1].biome, block: 1, decor: 0, sprite: pickArt(th.mountain, x, y, 3) }; continue; }
      let gr: Ground = coastDist[i]! <= 2 ? th.coast : th.grounds[moist[i]! < 0.42 ? 0 : moist[i]! < 0.58 ? 1 : 2];
      if (th.id === "ashen" && moist[i]! > wetness[ci]! && fbm(x / 12, y / 12, seed + 19) > 0.7) gr = g(ART.lava, FL.lava, BI.ashen);
      const t: MapTile = { floor: gr.floor, biome: gr.biome, block: gr.floor === FL.lava ? 1 : 0, decor: 0, sprite: pickArt(gr.art, x, y, 4) };
      if (gr.accent && hash2(x, y, seed + 21) < (gr.accentChance ?? 0)) t.sprite = pickArt(gr.accent, x, y, 5);
      // Trees are never painted onto tiles. Every tree is a choppable node, placed one by one later.
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
  const themeOf = (i: number): Theme => THEMES[THEME_IDS[themeAt[i]!] ?? (contAt[i]! >= 0 ? conts[contAt[i]!]!.theme : "verdant")]!;

  // ---- helpers for structures --------------------------------------------------------------
  const set = (x: number, y: number, t: Partial<MapTile> & { sprite?: string }) => {
    if (!inside(x, y)) return;
    const i = at(x, y);
    const old = tiles[i]!;
    const next: MapTile = { floor: t.floor ?? old.floor, biome: t.biome ?? old.biome, block: t.block ?? old.block, decor: 0, sprite: t.sprite ?? old.sprite };
    if ("layers" in t) { if (t.layers) next.layers = t.layers; }
    else if (old.layers) next.layers = old.layers;
    if (old.portal) next.portal = old.portal;
    tiles[i] = next;
    if (t.block === 0) { mountain[i] = 0; lake[i] = 0; river[i] = 0; land[i] = 1; }
  };
  const ground = (x: number, y: number, art: string[], floor: number, salt = 30) => set(x, y, { floor, sprite: pickArt(art, x, y, salt), block: 0, layers: undefined });
  const walkable = (x: number, y: number) => inside(x, y) && !tiles[at(x, y)]!.block && tiles[at(x, y)]!.floor !== FL.water;
  /** A prop that blocks its tile. */
  const prop = (x: number, y: number, art: string) => set(x, y, { block: 1, layers: [art] });
  /** A prop you can walk over (moss, grates, rubble). */
  const flat = (x: number, y: number, art: string) => set(x, y, { block: 0, layers: [art] });

  const regions: MapRegion[] = [];
  const interactables: MapInteractable[] = [];
  const npcs: MapNpc[] = [];
  const quests: MapQuest[] = [];
  const zones: SpawnZone[] = [];
  const spawns: Spawn[] = [];
  const occupied = new Uint8Array(N); // settlements, landmarks: no camps or wild nodes here
  const roadMask = new Uint8Array(N);
  const nodeMask = new Uint8Array(N);
  const occupy = (x: number, y: number, ww: number, hh: number, pad = 0) => { for (let yy = y - pad; yy < y + hh + pad; yy++) for (let xx = x - pad; xx < x + ww + pad; xx++) if (inside(xx, yy)) occupied[at(xx, yy)] = 1; };
  /**
   * True when the whole rectangle is plain, free ground of continent `cont`: no mountain, lake, river,
   * lava, wall, town or earlier area. With `allowWater` (fisheries) lake and sea tiles are fine, so a rect
   * can sit on a shore. Mountains and lava are never allowed, so nothing is ever cut out of a range.
   */
  const freeRect = (x: number, y: number, ww: number, hh: number, cont: number, minCoast = 4, allowWater = false, terrain: "flat" | "hills" | "any" = "flat") => {
    for (let yy = y; yy < y + hh; yy++) for (let xx = x; xx < x + ww; xx++) {
      if (xx < 1 || yy < 1 || xx >= w - 1 || yy >= h - 1) return false;
      const i = at(xx, yy);
      const t = tiles[i]!;
      if (terrain === "any") { if (!land[i] || occupied[i] || contAt[i] !== cont || coastDist[i]! < minCoast) return false; continue; }
      if (river[i] && !allowWater) return false;
      // "hills": mountains are allowed (a town can sit in a valley), lakes and lava are not.
      if (terrain === "hills") { if (!land[i] || occupied[i] || lake[i] || t.floor === FL.lava || contAt[i] !== cont || coastDist[i]! < minCoast) return false; continue; }
      if (mountain[i] || t.floor === FL.lava) return false;
      if (occupied[i]) return false;
      if (allowWater && (!land[i] || lake[i] || river[i])) continue;
      if (!land[i] || lake[i] || contAt[i] !== cont || coastDist[i]! < minCoast || t.block) return false;
    }
    return true;
  };
  let uid = 0;
  const id = (p: string) => `${p}-${(uid++).toString(36)}`;
  function anyNear(x: number, y: number, r: number, f: (i: number) => boolean) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inside(x + dx, y + dy) && f(at(x + dx, y + dy))) return true;
    return false;
  }

  // ---- settlements -------------------------------------------------------------------------
  const cities: City[] = [];
  /** Fields and orchards planted next to settlements once every settlement exists. */
  const outskirts: { city: City; what: "orchard" | "farm" | "graves" }[] = [];
  const perCont = Math.max(1, Math.min(5, opts.citiesPerContinent ?? 3));
  conts.forEach((c, ci) => {
    const th = THEMES[c.theme];
    const small = c.r < 50;
    const plan: SettlementKind[] = ["capital"];
    if (perCont >= 2 || small) plan.push("port");
    for (let k = 0; k < (small ? 0 : perCont - 2); k++) plan.push("town");
    for (let k = 0; k < (small ? 1 : Math.max(1, perCont - 1)); k++) plan.push("village");
    // Extras make every land different: some get forts and abbeys, some markets, mines or ruins.
    const extras = small ? (rng() < 0.6 ? 1 : 0) : 1 + Math.floor(rng() * 3) + Math.floor(c.r / 70);
    const pool = shuffle([...EXTRA_KINDS]);
    if (!th.trees) pool.push("minetown");
    for (let k = 0; k < extras && pool.length; k++) {
      const kind = pool.shift()!;
      if ((kind === "market" || kind === "abbey" || kind === "fort") && plan.includes(kind)) continue;
      plan.push(kind);
    }
    for (const kind of plan) {
      const spec = KIND[kind];
      const style = pick(spec.styles);
      let cw = between(spec.w[0], spec.w[1]);
      let chh = between(spec.h[0], spec.h[1]);
      if (style === "ring") chh = Math.max(spec.h[0], Math.round(cw * 0.82));
      if (small) { cw = Math.max(12, Math.round(cw * 0.85)); chh = Math.max(10, Math.round(chh * 0.85)); }
      let best: { x: number; y: number } | null = null, bs = -Infinity;
      // A crowded or rugged land gets a smaller version rather than none at all.
      for (let shrink = 0; shrink < 3 && !best; shrink++) {
      if (shrink) { cw = Math.max(11, Math.round(cw * 0.84)); chh = Math.max(10, Math.round(chh * 0.84)); }
      for (let k = 0; k < (kind === "capital" ? 900 : 450); k++) {
        const x = Math.floor(c.x * w - c.r * 1.1 + rng() * c.r * 2.2), y = Math.floor(c.y * h - c.r * 1.1 + rng() * c.r * 2.2);
        // The town itself needs flat, dry ground. Its outer margin may lean against hills, so towns
        // nestle into valleys instead of being rare.
        if (!freeRect(x - 1, y - 1, cw + 2, chh + 2, ci, kind === "port" ? 3 : spec.coast, false, "hills")) continue;
        if (!freeRect(x - 3, y - 3, cw + 6, chh + 6, ci, kind === "port" ? 3 : spec.coast, false, "any")) continue;
        const cx = x + cw / 2, cy = y + chh / 2;
        const others = cities.filter((o) => o.cont === ci);
        const spread = Math.min(999, ...others.map((o) => Math.hypot(o.x + o.w / 2 - cx, o.y + o.h / 2 - cy)));
        const coast = coastDist[at(Math.floor(cx), Math.floor(cy))]!;
        let hill = 0, cells = 0;
        for (let yy = y; yy < y + chh; yy += 2) for (let xx = x; xx < x + cw; xx += 2) { cells++; if (mountain[at(xx, yy)]) hill++; }
        const hillShare = hill / cells;
        if (hillShare > 0.5) continue; // never bury a town in rock
        const cap = others.find((o) => o.kind === "capital");
        const fromCap = cap ? Math.hypot(cap.x + cap.w / 2 - cx, cap.y + cap.h / 2 - cy) : 0;
        let score: number;
        if (kind === "port") score = -Math.abs(coast - 16) * 4 + Math.min(spread, 80);
        else if (kind === "capital") score = -Math.hypot(cx - c.x * w, cy - c.y * h);
        else if (kind === "minetown") score = Math.min(spread, 60) + (anyNear(Math.floor(cx), Math.floor(cy), Math.floor(Math.max(cw, chh) / 2) + 6, (i) => !!mountain[i]) ? 80 : 0);
        else if (kind === "ruin" || kind === "fort") score = Math.min(spread, 70) + Math.min(fromCap, 120) * 0.5;
        else if (kind === "abbey") score = Math.min(spread, 70) + moist[at(Math.floor(cx), Math.floor(cy))]! * 40;
        else score = Math.min(spread, kind === "village" || kind === "hamlet" ? 70 : 90);
        score -= hillShare * 80;
        if (score > bs) { bs = score; best = { x, y }; }
      }
      }
      if (!best) continue;
      const name = kind === "capital" && c.name ? c.name : placeName(rng, usedNames);
      const city = buildCity(ci, th, best.x, best.y, cw, chh, kind, style, name);
      cities.push(city);
    }
  });

  /**
   * Opens a valley around a town that sits in hills: mountain tiles near the town become ordinary
   * ground along a wobbly outline, so the range parts around it instead of having a box bored through it.
   */
  function openValley(th: Theme, x0: number, y0: number, cw: number, chh: number) {
    const R = 6;
    for (let y = y0 - R; y < y0 + chh + R; y++) for (let x = x0 - R; x < x0 + cw + R; x++) {
      if (!inside(x, y)) continue;
      const i = at(x, y);
      if (!mountain[i]) continue;
      const dx = Math.max(x0 - x, 0, x - (x0 + cw - 1)), dy = Math.max(y0 - y, 0, y - (y0 + chh - 1));
      if (Math.hypot(dx, dy) + (fbm(x / 5, y / 5, seed + 71) - 0.5) * 6 > R - 1) continue;
      mountain[i] = 0;
      const gr = th.grounds[1];
      tiles[i] = { floor: gr.floor, biome: gr.biome, block: 0, decor: 0, sprite: pickArt(gr.art, x, y, 4) };
    }
  }

  /**
   * Lays out one settlement. A local mask tracks what each tile is (street, wall, building, plaza,
   * reserved), so buildings are packed along streets with an alley round each one and nothing can wall
   * off a pocket of the town.
   */
  function buildCity(ci: number, th: Theme, x0: number, y0: number, cw: number, chh: number, kind: SettlementKind, style: Style, name: string): City {
    const spec = KIND[kind];
    openValley(th, x0, y0, cw, chh);
    occupy(x0, y0, cw, chh, 3);
    const walled = rng() < spec.walled;
    const ruined = kind === "ruin";
    const M = { open: 0, street: 1, wall: 2, building: 3, plaza: 4, reserved: 5, outside: 6 } as const;
    const mask = new Uint8Array(cw * chh);
    const mi = (x: number, y: number) => (y - y0) * cw + (x - x0);
    const inC = (x: number, y: number) => x >= x0 && y >= y0 && x < x0 + cw && y < y0 + chh;
    const mget = (x: number, y: number) => (inC(x, y) ? mask[mi(x, y)]! : M.outside);
    const mset = (x: number, y: number, v: number) => { if (inC(x, y)) mask[mi(x, y)] = v; };
    const midX = x0 + Math.floor(cw / 2), midY = y0 + Math.floor(chh / 2);
    const rx = (cw - 1) / 2, ry = (chh - 1) / 2, ccx = x0 + rx, ccy = y0 + ry;
    const ring = style === "ring";
    const inEllipse = (x: number, y: number, pad = 0) => ((x - ccx) / (rx - pad)) ** 2 + ((y - ccy) / (ry - pad)) ** 2 <= 1;
    // Ground.
    const groundArt = walled ? th.cityFloor : th.grounds[0].art;
    const groundFloor = walled ? FL.stone : th.grounds[0].floor;
    for (let y = y0; y < y0 + chh; y++) for (let x = x0; x < x0 + cw; x++) {
      if (ring && !inEllipse(x, y)) { mset(x, y, M.outside); continue; }
      ground(x, y, groundArt, groundFloor, 40);
    }
    // Walls with four gates (unwalled places just have their lanes run to the edge).
    const wallArt = ruined ? [...th.cityWall, ...ART.stoneDark] : th.cityWall;
    const putWall = (x: number, y: number) => {
      if (ruined && hash2(x, y, seed + 401) < 0.3) { if (hash2(x, y, seed + 402) < 0.4) flat(x, y, pick(ART.columns)); mset(x, y, M.reserved); return; }
      set(x, y, { floor: FL.stone, block: 1, sprite: pickArt(wallArt, x, y, 41), layers: undefined });
      mset(x, y, M.wall);
    };
    if (walled) {
      if (ring) {
        for (let y = y0; y < y0 + chh; y++) for (let x = x0; x < x0 + cw; x++) if (inEllipse(x, y) && !inEllipse(x, y, 1)) putWall(x, y);
      } else {
        for (let x = x0; x < x0 + cw; x++) for (const y of [y0, y0 + chh - 1]) putWall(x, y);
        for (let y = y0; y < y0 + chh; y++) for (const x of [x0, x0 + cw - 1]) putWall(x, y);
      }
    }
    const gateAt = [[midX, y0], [midX, y0 + chh - 1], [x0, midY], [x0 + cw - 1, midY]] as const;
    const gates: { x: number; y: number }[] = [];
    const streetArt = walled || kind === "market" ? ART.street : th.path;
    const street = (x: number, y: number) => { if (!inC(x, y) || mget(x, y) === M.outside) return; ground(x, y, streetArt, walled ? FL.stone : th.grounds[0].floor, 43); mset(x, y, M.street); };
    for (const [gx, gy] of gateAt) {
      for (let k = -1; k <= 1; k++) {
        const tx = gy === midY ? gx : gx + k, ty = gy === midY ? gy + k : gy;
        street(tx, ty);
      }
      gates.push({ x: gx, y: gy });
    }
    // Streets.
    const lane = walled ? 1 : style === "scatter" ? 0 : 1; // half-width of the main lanes
    const hLine = (y: number, half: number, xa = x0, xb = x0 + cw - 1) => { for (let x = xa; x <= xb; x++) for (let k = -half; k <= half; k++) if (mget(x, y + k) !== M.wall) street(x, y + k); };
    const vLine = (x: number, half: number, ya = y0, yb = y0 + chh - 1) => { for (let y = ya; y <= yb; y++) for (let k = -half; k <= half; k++) if (mget(x + k, y) !== M.wall) street(x + k, y); };
    if (style === "row") {
      hLine(midY, 1);
      vLine(midX, 0);
      if (chh >= 16) { hLine(y0 + 3, 0, x0 + 2, x0 + cw - 3); hLine(y0 + chh - 4, 0, x0 + 2, x0 + cw - 3); }
    } else if (style === "scatter") {
      hLine(midY, 0);
      vLine(midX, 0);
    } else {
      hLine(midY, lane);
      vLine(midX, lane);
      if (style === "grid") {
        const step = between(6, 8);
        for (let y = midY + step; y < y0 + chh - 3; y += step) hLine(y, 0, x0 + 1, x0 + cw - 2);
        for (let y = midY - step; y > y0 + 2; y -= step) hLine(y, 0, x0 + 1, x0 + cw - 2);
        for (let x = midX + step; x < x0 + cw - 3; x += step) vLine(x, 0, y0 + 1, y0 + chh - 2);
        for (let x = midX - step; x > x0 + 2; x -= step) vLine(x, 0, y0 + 1, y0 + chh - 2);
      } else if (ring) {
        for (let y = y0; y < y0 + chh; y++) for (let x = x0; x < x0 + cw; x++) {
          const d = ((x - ccx) / (rx * 0.62)) ** 2 + ((y - ccy) / (ry * 0.62)) ** 2;
          if (d > 0.84 && d <= 1.16) street(x, y);
        }
      } else if (walled) {
        // A ring road just inside the walls.
        for (let x = x0 + 2; x < x0 + cw - 2; x++) for (const y of [y0 + 2, y0 + chh - 3]) street(x, y);
        for (let y = y0 + 2; y < y0 + chh - 2; y++) for (const x of [x0 + 2, x0 + cw - 3]) street(x, y);
      }
    }
    // Plaza and its centrepiece.
    const pr = Math.max(1, Math.min(spec.plaza, Math.floor(Math.min(cw, chh) / 2) - 4));
    const plazaArt = kind === "capital" ? ART.mosaic : kind === "abbey" ? ART.whiteMarble : kind === "ruin" ? ART.crypt : walled ? ART.marble : th.cityFloor;
    for (let y = midY - pr; y <= midY + pr; y++) for (let x = midX - pr; x <= midX + pr; x++) { if (mget(x, y) === M.outside || mget(x, y) === M.wall) continue; ground(x, y, plazaArt, FL.stone, 44); mset(x, y, M.plaza); }
    const centre = kind === "ruin" ? pick([...ART.dryFountain, ...ART.darkStatues]) : kind === "abbey" ? pick(ART.altars) : kind === "fort" ? pick(ART.ironStatue) : kind === "market" ? pick(ART.golden) : kind === "minetown" ? pick(ART.stones) : kind === "hamlet" ? pick(ART.dryFountain) : rng() < 0.65 ? pick(ART.fountain) : pick(ART.statues);
    prop(midX, midY, centre);
    if (kind === "capital") for (const [dx, dy] of [[-pr, -pr], [pr, -pr], [-pr, pr], [pr, pr]] as const) prop(midX + dx, midY + dy, pick(ART.statues));
    // Reserve the tiles for the hearth, board, shrine and arena (with a free tile round each).
    const reserveAround = (x: number, y: number) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (mget(x + dx, y + dy) === M.open) mset(x + dx, y + dy, M.reserved); };
    const hearthAt = { x: midX + 2, y: Math.min(y0 + chh - 3, midY + pr + 1) };
    const boardAt = { x: gates[1]!.x + 3, y: gates[1]!.y - 2 };
    const shrineAt = { x: Math.max(x0 + 3, midX - pr - 2), y: Math.max(y0 + 3, midY - 3) };
    const arenaAt = { x: Math.min(x0 + cw - 4, midX + pr + 2), y: Math.max(y0 + 3, midY - 3) };
    for (const p of [hearthAt, boardAt, shrineAt, arenaAt]) reserveAround(p.x, p.y);
    for (const gt of gates) reserveAround(gt.x + (gt.x === x0 ? 1 : gt.x === x0 + cw - 1 ? -1 : 0), gt.y + (gt.y === y0 ? 1 : gt.y === y0 + chh - 1 ? -1 : 0));

    // Buildings, packed along the streets with their door on the street.
    type BType = "house" | "shop" | "inn" | "smithy" | "temple" | "manor" | "warehouse" | "barracks" | "tower" | "hut" | "ruin";
    const typeWeights: Record<SettlementKind, [BType, number][]> = {
      capital: [["house", 5], ["shop", 4], ["inn", 1], ["smithy", 1], ["temple", 1], ["manor", 2]],
      town: [["house", 6], ["shop", 3], ["inn", 1], ["smithy", 1], ["temple", 1]],
      port: [["house", 4], ["shop", 3], ["warehouse", 3], ["inn", 1]],
      village: [["house", 6], ["hut", 3], ["shop", 1], ["inn", 1]],
      hamlet: [["hut", 4], ["house", 2]],
      fort: [["barracks", 3], ["tower", 2], ["smithy", 1]],
      abbey: [["temple", 2], ["house", 3], ["hut", 1]],
      market: [["shop", 7], ["warehouse", 2], ["inn", 1], ["house", 2]],
      minetown: [["hut", 4], ["house", 2], ["smithy", 2], ["warehouse", 1]],
      ruin: [["ruin", 1]],
    };
    const roll = (list: [BType, number][]) => { const total = list.reduce((s, [, n]) => s + n, 0); let r = rng() * total; for (const [t, n] of list) { r -= n; if (r <= 0) return t; } return list[0]![0]; };
    const sizeOf = (t: BType): [number, number] => {
      switch (t) {
        case "manor": return [between(6, 8), between(4, 5)];
        case "temple": return [between(5, 7), between(4, 6)];
        case "inn": return [between(5, 6), between(4, 5)];
        case "warehouse": return [between(5, 7), between(3, 4)];
        case "barracks": return [between(5, 7), between(3, 4)];
        case "tower": return [3, 3];
        case "hut": return [3, between(3, 4)];
        default: return [between(4, 5), between(3, 4)];
      }
    };
    const shopArt = Object.values(ART.shop);
    const doorFor = (t: BType): string => {
      switch (t) {
        case "shop": return pick(shopArt);
        case "inn": return ART.shop.food;
        case "smithy": return pick([ART.shop.weapon, ART.shop.armor]);
        case "temple": return pick(ART.altars);
        case "manor": return pick(ART.runedDoor);
        case "warehouse": return ART.shop.general;
        case "ruin": return pick([...ART.abandonedShop, ...ART.doors]);
        default: return pick(ART.doors);
      }
    };
    const wallFor = (t: BType): string[] => {
      if (t === "temple") return ART.church;
      if (t === "tower" || t === "barracks") return th.cityWall;
      if (t === "manor") return th.cityWall;
      if (t === "ruin") return pick([th.houseWall, ...th.houseAlt]);
      return rng() < 0.55 ? th.houseWall : pick(th.houseAlt);
    };
    const wantHouses = between(spec.houses[0], spec.houses[1]);
    let built = 0;
    const streets: { x: number; y: number }[] = [];
    for (let y = y0; y < y0 + chh; y++) for (let x = x0; x < x0 + cw; x++) if (mget(x, y) === M.street || mget(x, y) === M.plaza) streets.push({ x, y });
    shuffle(streets);
    const canHold = (bx: number, by: number, bw: number, bh: number) => {
      for (let y = by - 1; y <= by + bh; y++) for (let x = bx - 1; x <= bx + bw; x++) {
        const v = mget(x, y);
        const edge = x < bx || y < by || x >= bx + bw || y >= by + bh;
        if (!edge) { if (v !== M.open) return false; }
        else if (v === M.building || v === M.wall || v === M.outside) return false;
      }
      return true;
    };
    const doors: { x: number; y: number; t: BType }[] = [];
    // Three passes: the planned mix first, then smaller houses to fill the gaps the big ones left.
    for (let pass = 0; pass < 3 && built < wantHouses; pass++) for (const st of streets) {
      if (built >= wantHouses) break;
      const t = pass === 0 ? roll(typeWeights[kind]) : kind === "ruin" ? "ruin" : pass === 1 ? (rng() < 0.5 ? "house" : roll(typeWeights[kind])) : kind === "fort" ? "tower" : "hut";
      const [bw, bh] = pass === 2 ? [3, 3] as [number, number] : sizeOf(t);
      for (const [dx, dy] of shuffle([[0, 1], [0, -1], [1, 0], [-1, 0]] as [number, number][])) {
        const fx = st.x + dx, fy = st.y + dy; // first building tile (the door)
        if (mget(fx, fy) !== M.open) continue;
        let bx: number, by: number, rw = bw, rh = bh;
        if (dx !== 0) { rw = bh; rh = bw; } // buildings beside a north-south street turn sideways
        if (dy === 1) { bx = fx - between(1, Math.max(1, rw - 2)); by = fy; }
        else if (dy === -1) { bx = fx - between(1, Math.max(1, rw - 2)); by = fy - rh + 1; }
        else if (dx === 1) { bx = fx; by = fy - between(1, Math.max(1, rh - 2)); }
        else { bx = fx - rw + 1; by = fy - between(1, Math.max(1, rh - 2)); }
        if (!canHold(bx, by, rw, rh)) continue;
        const art = wallFor(t);
        for (let y = by; y < by + rh; y++) for (let x = bx; x < bx + rw; x++) {
          mset(x, y, M.building);
          if (t === "ruin" && hash2(x, y, seed + 403) < 0.22 && (x === bx || y === by || x === bx + rw - 1 || y === by + rh - 1) && !(x === fx && y === fy)) {
            ground(x, y, ART.pebble, FL.dirt, 46);
            if (hash2(x, y, seed + 404) < 0.5) flat(x, y, pick(ART.columns));
            continue;
          }
          set(x, y, { floor: FL.stone, block: 1, sprite: pickArt(art, x, y, 46), layers: undefined });
        }
        set(fx, fy, { layers: [doorFor(t)] });
        // A torch or banner by the better doors.
        if ((t === "inn" || t === "manor" || t === "temple" || t === "barracks") && rng() < 0.7) {
          const side = dx === 0 ? { x: fx + (fx + 1 < bx + rw ? 1 : -1), y: fy } : { x: fx, y: fy + (fy + 1 < by + rh ? 1 : -1) };
          if (mget(side.x, side.y) === M.building) set(side.x, side.y, { sprite: pick(t === "barracks" ? ART.banner : ART.torch) });
        }
        doors.push({ x: fx, y: fy, t });
        built++;
        break;
      }
    }
    // Things in the open: gardens, wells, crates, statues, market stalls, trees and graves.
    const isolatedOpen = (x: number, y: number) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const v = mget(x + dx, y + dy);
        if (dx === 0 && dy === 0) { if (v !== M.open) return false; continue; }
        if (v !== M.open && v !== M.street && v !== M.plaza) return false;
        const t = tiles[at(x + dx, y + dy)]!;
        if (t.block) return false;
      }
      return true;
    };
    const opens: { x: number; y: number }[] = [];
    for (let y = y0 + 1; y < y0 + chh - 1; y++) for (let x = x0 + 1; x < x0 + cw - 1; x++) if (mget(x, y) === M.open) opens.push({ x, y });
    shuffle(opens);
    let decor = 0;
    const decorWant = Math.round(opens.length * (kind === "ruin" ? 0.07 : 0.03));
    const decorArt = (): string => {
      switch (kind) {
        case "port": return pick([...ART.boxes, ...ART.boxes, ...ART.fountain]);
        case "market": return pick([...ART.boxes, ...shopArt, ...ART.fountain]);
        case "fort": return pick([...ART.ironStatue, ...ART.boxes, ...ART.stones]);
        case "abbey": return pick([...ART.altars, ...ART.statues, ...ART.columns]);
        case "minetown": return pick([...ART.boxes, ...ART.stones, ...ART.boulder]);
        case "ruin": return pick([...ART.columns, ...ART.columns, ...ART.darkStatues, ...ART.boulder]);
        case "capital": return pick([...ART.statues, ...ART.fountain, ...ART.boxes]);
        default: return pick([...ART.fountain, ...ART.boxes, ...ART.stones, ...ART.statues]);
      }
    };
    for (const p of opens) {
      if (decor >= decorWant) break;
      if (!isolatedOpen(p.x, p.y)) continue;
      prop(p.x, p.y, decorArt());
      mset(p.x, p.y, M.building); // keeps the next prop from touching it
      decor++;
    }
    // Gardens and rubble: walkable ground art in the leftover open ground.
    for (const p of opens) {
      if (mget(p.x, p.y) !== M.open) continue;
      const n = fbm(p.x / 4, p.y / 4, seed + 405);
      if (kind === "ruin") { if (n > 0.55) ground(p.x, p.y, hash2(p.x, p.y, seed + 406) < 0.5 ? ART.bones : ART.pebble, FL.dirt, 47); if (hash2(p.x, p.y, seed + 407) < 0.05) flat(p.x, p.y, pick(ART.mold)); }
      else if (th.trees && n > 0.62) ground(p.x, p.y, ART.flowers, FL.grass, 47);
      else if (!walled && n > 0.7) ground(p.x, p.y, th.grounds[1].art, th.grounds[1].floor, 47);
    }
    // A few trees in villages, hamlets and abbey gardens: single choppable nodes, never a grove.
    if ((kind === "village" || kind === "hamlet" || kind === "abbey") && th.trees) {
      let n = 0;
      for (const p of opens) {
        if (n >= 4) break;
        if (mget(p.x, p.y) !== M.open || !isolatedOpen(p.x, p.y) || nodeMask[at(p.x, p.y)]) continue;
        interactables.push({ id: id("node"), kind: "node", node: "tree", tx: p.x, ty: p.y });
        nodeMask[at(p.x, p.y)] = 1;
        mset(p.x, p.y, M.reserved);
        n++;
      }
    }
    // Fort: towers in the corners.
    if (kind === "fort" && walled && !ring) {
      for (const [cx, cy] of [[x0, y0], [x0 + cw - 3, y0], [x0, y0 + chh - 3], [x0 + cw - 3, y0 + chh - 3]] as const) {
        for (let y = cy; y < cy + 3; y++) for (let x = cx; x < cx + 3; x++) {
          if (mget(x, y) !== M.wall && mget(x, y) !== M.open) continue;
          // Only fill corner tiles that touch the wall, so no alley is closed.
          if (x > x0 + 1 && x < x0 + cw - 2 && y > y0 + 1 && y < y0 + chh - 2) continue;
          set(x, y, { floor: FL.stone, block: 1, sprite: pickArt(th.cityWall, x, y, 48), layers: undefined });
          mset(x, y, M.wall);
        }
      }
    }
    const city: City = { id: (kind === "ruin" ? "ruin-" : "") + id("city"), name, cont: ci, x: x0, y: y0, w: cw, h: chh, kind, style, walled, plaza: { x: midX, y: midY }, gates, npcs: [] };
    const contName = conts[ci]!.name;
    const about: Record<SettlementKind, string> = {
      capital: `Capital of ${contName}.`,
      town: `A ${walled ? "walled " : ""}town of ${contName}.`,
      port: `Harbour town of ${contName}. Ferries leave from the docks.`,
      village: `A village of ${contName}.`,
      hamlet: `A few farms on the edge of ${contName}.`,
      fort: `A garrison that watches the wilds of ${contName}.`,
      abbey: `A quiet abbey of ${contName}. Pilgrims rest here.`,
      market: `A market town. Every road in ${contName} passes through it.`,
      minetown: `A mining camp dug into the hills of ${contName}.`,
      ruin: `A fallen town of ${contName}. Something nests in it now.`,
    };
    regions.push({ id: city.id, name: kind === "ruin" ? `Ruins of ${name}` : name, kind: "city", tx: x0, ty: y0, tw: cw, th: chh, about: about[kind], levelMin: conts[ci]!.levelMin, levelMax: conts[ci]!.levelMax });
    // Places in town.
    if (kind !== "ruin") interactables.push({ id: id("hearth"), kind: "hearth", tx: hearthAt.x, ty: hearthAt.y });
    if (walled && kind !== "ruin" && kind !== "abbey") interactables.push({ id: id("bounty"), kind: "bounty", tx: boardAt.x, ty: boardAt.y, label: `${name} Bounty Board` });
    if (kind === "capital" || kind === "abbey") interactables.push({ id: id("shrine"), kind: "shrine", type: th.shrine, tx: shrineAt.x, ty: shrineAt.y, name: `${name} Shrine` });
    if (kind === "capital" || kind === "fort") interactables.push({ id: id("arena"), kind: "arena", tx: arenaAt.x, ty: arenaAt.y, label: `${name} Proving Ring` });
    for (const it of interactables.slice(-4)) if (it.kind !== "node") nodeMask[at(it.tx, it.ty)] = 0;
    if (kind === "village" || kind === "hamlet") outskirts.push({ city, what: th.trees && rng() < 0.4 ? "orchard" : "farm" });
    else if (kind === "capital" || kind === "town" || kind === "port") { if (th.trees) outskirts.push({ city, what: "orchard" }); }
    else if (kind === "abbey") outskirts.push({ city, what: "graves" });
    return city;
  }

  // Outskirts: farm fields, orchards (single trees in rows with gaps) and graveyards, in free ground beside
  // their settlement. A settlement with no room simply goes without.
  for (const o of outskirts) {
    const city = o.city;
    const ow = o.what === "graves" ? 7 : 9, oh = o.what === "graves" ? 7 : 7;
    const cands: { x: number; y: number }[] = [];
    for (let gap = 2; gap <= 9; gap++) {
      cands.push({ x: city.plaza.x + 4, y: city.y + city.h + gap }, { x: city.plaza.x - ow - 3, y: city.y + city.h + gap }, { x: city.x + city.w + gap, y: city.plaza.y - 3 }, { x: city.x - gap - ow, y: city.plaza.y - 3 }, { x: city.plaza.x + 4, y: city.y - gap - oh }, { x: city.plaza.x - ow - 3, y: city.y - gap - oh });
    }
    const spot = cands.find((c) => freeRect(c.x - 1, c.y - 1, ow + 2, oh + 2, city.cont, 3));
    if (!spot) continue;
    occupy(spot.x, spot.y, ow, oh, 1);
    const th = THEMES[conts[city.cont]!.theme];
    if (o.what === "farm") {
      // Crop rows: tilled earth and green rows, all walkable.
      for (let y = spot.y; y < spot.y + oh; y++) for (let x = spot.x; x < spot.x + ow; x++) ground(x, y, y % 2 ? ART.grassDirt : ART.dirt, FL.dirt, 52);
      prop(spot.x + Math.floor(ow / 2), spot.y + Math.floor(oh / 2), pick(ART.stones));
      regions.push({ id: id("farm"), name: `${city.name} Fields`, kind: "landmark", tx: spot.x, ty: spot.y, tw: ow, th: oh, about: "Farmland. Somebody works these rows at dawn." });
    } else if (o.what === "orchard") {
      let n = 0;
      // Each tree is placed on its own at a random free spot, never touching another.
      for (let t = 0; t < 80 && n < 7; t++) {
        const x = spot.x + Math.floor(rng() * ow), y = spot.y + Math.floor(rng() * oh);
        if (!walkable(x, y) || anyNear(x, y, 1, (j) => !!nodeMask[j])) continue;
        interactables.push({ id: id("node"), kind: "node", node: "tree", tx: x, ty: y });
        nodeMask[at(x, y)] = 1;
        n++;
      }
      if (n) regions.push({ id: id("orchard"), name: `${city.name} Orchard`, kind: "resource", tx: spot.x, ty: spot.y, tw: ow, th: oh, about: "Town timber. Every tree can be chopped.", levelMin: conts[city.cont]!.levelMin, levelMax: conts[city.cont]!.levelMax });
      void th;
    } else {
      for (let y = spot.y; y < spot.y + oh; y++) for (let x = spot.x; x < spot.x + ow; x++) ground(x, y, ART.tomb, FL.bone, 53);
      for (let y = spot.y + 1; y < spot.y + oh - 1; y += 2) for (let x = spot.x + 1; x < spot.x + ow - 1; x += 2) if (hash2(x, y, seed + 54) < 0.75) prop(x, y, pick([...ART.sarcophagus, ...ART.columns, ...ART.stones]));
      regions.push({ id: id("graves"), name: `${city.name} Graves`, kind: "landmark", tx: spot.x, ty: spot.y, tw: ow, th: oh, about: "The abbey keeps its dead close." });
    }
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
      roadMask[at(x, y)] = 1;
      if (dir[0] === 0) { ground(x - 1, y, ART.street, FL.stone, 47); ground(x + 1, y, ART.street, FL.stone, 47); } else { ground(x, y - 1, ART.street, FL.stone, 47); ground(x, y + 1, ART.street, FL.stone, 47); }
      x += dir[0]!; y += dir[1]!; steps++;
    }
    // Pier into the water.
    for (let k = 0; k < 5 && inside(x, y); k++) {
      set(x, y, { floor: FL.stone, block: 0, sprite: pickArt(ART.pebble, x, y, 48) });
      roadMask[at(x, y)] = 1;
      x += dir[0]!; y += dir[1]!;
    }
    const end = { x: x - dir[0]!, y: y - dir[1]! };
    const arrive = { x: end.x - dir[0]! * 2, y: end.y - dir[1]! * 2 };
    p.dock = { x: end.x, y: end.y, arrive };
    regions.push({ id: id("docks"), name: `${p.name} Docks`, kind: "landmark", tx: Math.min(end.x, arrive.x) - 2, ty: Math.min(end.y, arrive.y) - 2, tw: Math.abs(end.x - arrive.x) + 5, th: Math.abs(end.y - arrive.y) + 5, about: "Step onto the end of the pier to take the ferry." });
  }

  // ---- roads between settlements, with bridges over rivers --------------------------------
  function road(ax: number, ay: number, bx: number, by: number, art: string[], width = 2) {
    // A* on land; mountains cost more and are carved through, rivers get a bridge.
    const open = new MinHeap();
    const cost = new Float32Array(N).fill(Infinity);
    const from = new Int32Array(N).fill(-1);
    const s = at(ax, ay), e = at(bx, by);
    cost[s] = 0;
    open.push(s, 0);
    const cellCost = (i: number) => (!land[i] && !(tiles[i]!.floor === FL.stone && !tiles[i]!.block) ? Infinity : roadMask[i] ? 0.35 : river[i] ? 6 : mountain[i] ? 9 : lake[i] ? Infinity : tiles[i]!.floor === FL.lava ? 14 : tiles[i]!.block ? 4 : 1);
    let guard = 0;
    while (open.size && guard++ < 400000) {
      const i = open.pop();
      if (i === e) break;
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (!inside(nx, ny)) continue;
        const j = at(nx, ny);
        const occ = occupied[j] && j !== e ? 18 : 0;
        const c = cost[i]! + cellCost(j) + occ;
        if (c < cost[j]!) { cost[j] = c; from[j] = i; open.push(j, c + Math.abs(nx - bx) + Math.abs(ny - by)); }
      }
    }
    if (from[e] === -1) return false;
    const cells = width >= 2 ? [[0, 0], [1, 0], [0, 1]] as const : [[0, 0]] as const;
    for (let i = e; i !== s && i >= 0; i = from[i]!) {
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of cells) {
        const tx = x + dx, ty = y + dy;
        if (!inside(tx, ty)) continue;
        const j = at(tx, ty);
        if (occupied[j] && tiles[j]!.floor === FL.stone && !mountain[j]) continue; // keep city art
        if (!land[j]) continue;
        if (river[j] || tiles[j]!.floor === FL.lava) { set(tx, ty, { floor: FL.stone, block: 0, sprite: pickArt(ART.street, tx, ty, 50), layers: undefined }); roadMask[j] = 1; continue; }
        if (tiles[j]!.layers?.length && tiles[j]!.block && occupied[j]) continue;
        ground(tx, ty, art, tiles[j]!.floor === FL.snow ? FL.snow : FL.dirt, 49);
        roadMask[j] = 1;
      }
    }
    return true;
  }
  function nearestGate(a: City, b: { x: number; y: number }) {
    let best = a.gates[0]!, bd = Infinity;
    for (const gt of a.gates) { const d = Math.hypot(gt.x - b.x, gt.y - b.y); if (d < bd) { bd = d; best = gt; } }
    // Step one tile outside the gate.
    const dx = best.x === a.x ? -1 : best.x === a.x + a.w - 1 ? 1 : 0, dy = best.y === a.y ? -1 : best.y === a.y + a.h - 1 ? 1 : 0;
    return { x: best.x + dx, y: best.y + dy };
  }
  const centreOf = (c: City) => ({ x: c.x + c.w / 2, y: c.y + c.h / 2 });
  conts.forEach((c, ci) => {
    const list = cities.filter((x) => x.cont === ci);
    const cap = list.find((x) => x.kind === "capital") ?? list[0];
    if (!cap) return;
    const art = THEMES[c.theme].path;
    // Join each settlement to the nearest one already on the network, nearest first: a branching road web.
    const joined: City[] = [cap];
    const rest = list.filter((x) => x !== cap).sort((a, b) => Math.hypot(centreOf(a).x - centreOf(cap).x, centreOf(a).y - centreOf(cap).y) - Math.hypot(centreOf(b).x - centreOf(cap).x, centreOf(b).y - centreOf(cap).y));
    for (const other of rest) {
      const near = joined.slice().sort((a, b) => Math.hypot(centreOf(a).x - centreOf(other).x, centreOf(a).y - centreOf(other).y) - Math.hypot(centreOf(b).x - centreOf(other).x, centreOf(b).y - centreOf(other).y))[0]!;
      const ga = nearestGate(near, centreOf(other)), gb = nearestGate(other, centreOf(near));
      road(ga.x, ga.y, gb.x, gb.y, art, other.kind === "hamlet" || other.kind === "ruin" ? 1 : 2);
      joined.push(other);
    }
  });

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

  // ---- landmarks and resource sites ---------------------------------------------------------
  const places: Place[] = [];
  /** A free rectangle with a one-tile margin of plain ground all round it (so it never touches a range). */
  const findSpot = (ci: number, ww: number, hh: number, pred: (x: number, y: number) => boolean, tries = 700, allowWater = false, minCoast = 2) => {
    const c = conts[ci]!;
    for (let k = 0; k < tries; k++) {
      const x = Math.floor(c.x * w - c.r * 1.2 + rng() * c.r * 2.4), y = Math.floor(c.y * h - c.r * 1.2 + rng() * c.r * 2.4);
      if (freeRect(x - 1, y - 1, ww + 2, hh + 2, ci, allowWater ? 0 : minCoast, allowWater) && pred(x, y)) {
        if (allowWater) { let dry = 0; for (let yy = y; yy < y + hh; yy++) for (let xx = x; xx < x + ww; xx++) if (land[at(xx, yy)] && !lake[at(xx, yy)] && !river[at(xx, yy)]) dry++; if (dry < ww * hh * 0.4) continue; }
        return { x, y };
      }
    }
    return null;
  };
  const LANDMARK_WORD: Record<LandmarkKind, string[]> = {
    ruins: ["Ruins", "Remnant"], watchstone: ["Watchstone"], altar: ["Altar", "Sanctum"], barrow: ["Barrow", "Tomb"], stones: ["Stones", "Henge", "Circle"],
    tower: ["Watchtower", "Tower"], spire: ["Spire"], graveyard: ["Graveyard", "Boneyard"], hut: ["Hut", "Cottage"], gate: ["Gate", "Arch"],
    dragon: ["Dragon's Rest", "Wyrm Bones"], obelisk: ["Obelisk", "Needle"], wreck: ["Wreck"], crater: ["Crater", "Scar"], grove: ["Grove", "Glade"], statues: ["Gallery", "Plinths"],
  };
  /** Builds one landmark in a 9×9 (or 11×11) square. Walls here are props on layers, never bare rock. */
  function buildLandmark(lk: LandmarkKind, x0: number, y0: number, sz: number, th: Theme) {
    const c = Math.floor(sz / 2), cx = x0 + c, cy = y0 + c;
    const disc = (r: number, art: string[], floor: number, salt: number) => { for (let y = y0; y < y0 + sz; y++) for (let x = x0; x < x0 + sz; x++) if (Math.hypot(x - cx, y - cy) <= r) ground(x, y, art, floor, salt); };
    /** A blocker on a ring, with gaps so it can never wall anything in. */
    const ringProps = (r: number, art: string[], chance: number, salt: number) => {
      for (let y = y0; y < y0 + sz; y++) for (let x = x0; x < x0 + sz; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r - 0.5 && d <= r + 0.5 && (x + y) % 2 === 0 && hash2(x, y, seed + salt) < chance) prop(x, y, pickArt(art, x, y, salt));
      }
    };
    const building = (bx: number, by: number, bw: number, bh: number, wall: string[], door: string) => {
      for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) set(x, y, { block: 1, layers: [pickArt(wall, x, y, 58)] });
      set(bx + Math.floor(bw / 2), by + bh - 1, { block: 1, layers: [door] });
    };
    switch (lk) {
      case "ruins": disc(c - 0.2, ART.marble, FL.stone, 51); ringProps(c - 0.8, ART.columns, 0.7, 53); prop(cx, cy, pick(ART.columns)); break;
      case "watchstone": disc(c - 0.2, ART.limestone, FL.stone, 51); prop(cx, cy, pick(ART.statues)); ringProps(c - 1.5, ART.stones, 0.5, 53); break;
      case "altar": disc(c - 0.2, ART.whiteMarble, FL.stone, 51); prop(cx, cy, pick(ART.altars)); ringProps(c - 1, ART.columns, 0.4, 53); break;
      case "barrow": disc(c - 0.2, ART.tomb, FL.stone, 51); prop(cx, cy, pick(ART.crypt_)); ringProps(c - 1, ART.stones, 0.5, 53); break;
      case "stones": disc(c - 0.2, th.grounds[1].art, th.grounds[1].floor, 51); ringProps(c - 1, ART.stones, 0.95, 53); prop(cx, cy, pick(ART.altars)); break;
      case "tower": disc(c - 0.2, ART.pebble, FL.dirt, 51); building(cx - 1, cy - 2, 3, 3, th.cityWall, pick(ART.doors)); prop(cx + 2, cy + 2, pick(ART.boxes)); break;
      case "spire": disc(c - 0.2, ART.crystal, FL.void, 51); building(cx - 1, cy - 2, 3, 3, ART.crystalWall, pick(ART.runedDoor)); ringProps(c - 0.6, ART.orb, 0.3, 53); break;
      case "graveyard":
        disc(c - 0.2, ART.tomb, FL.bone, 51);
        for (let y = y0 + 1; y < y0 + sz - 1; y += 2) for (let x = x0 + 1; x < x0 + sz - 1; x += 2) if (Math.hypot(x - cx, y - cy) < c - 1 && hash2(x, y, seed + 59) < 0.7) prop(x, y, pick([...ART.sarcophagus, ...ART.columns, ...ART.stones]));
        break;
      case "hut": disc(c - 0.2, ART.grassDirt, FL.dirt, 51); building(cx - 1, cy - 2, 3, 3, pick([th.houseWall, ...th.houseAlt]), pick(ART.doors)); for (let x = cx - 2; x <= cx + 2; x++) if (th.trees) ground(x, cy + 2, ART.flowers, FL.grass, 52); break;
      case "gate": disc(c - 0.2, ART.etched, FL.stone, 51); prop(cx - 2, cy, pick(ART.arch)); prop(cx + 2, cy, pick(ART.arch)); flat(cx, cy, pick(ART.sigil)); break;
      case "dragon": disc(c - 0.2, ART.bones, FL.bone, 51); prop(cx, cy, pick(ART.dragon)); ringProps(c - 1.5, ART.boulder, 0.4, 53); break;
      case "obelisk": disc(c - 0.2, ART.etched, FL.stone, 51); prop(cx, cy, pick(ART.pillar)); for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]] as const) flat(cx + dx, cy + dy, pick(ART.sigil)); break;
      case "wreck": disc(c - 0.2, ART.sand, FL.sand, 51); for (let k = 0; k < 4; k++) { const x = cx + between(-2, 2), y = cy + between(-2, 2); if ((x + y) % 2 === 0) prop(x, y, pick(ART.boxes)); } prop(cx, cy, pick(ART.columns)); break;
      case "crater": disc(c - 0.2, ART.volcanic, FL.ash, 51); disc(1.2, ART.roughRed, FL.ash, 52); prop(cx, cy, pick(ART.boulder)); ringProps(c - 1, ART.boulder, 0.35, 53); break;
      case "grove": disc(c - 0.2, ART.moss, FL.grass, 51); prop(cx, cy, pick(ART.altars)); for (let y = y0; y < y0 + sz; y++) for (let x = x0; x < x0 + sz; x++) if (Math.hypot(x - cx, y - cy) > 2 && Math.hypot(x - cx, y - cy) < c - 0.5 && hash2(x, y, seed + 55) < 0.3) ground(x, y, ART.flowers, FL.grass, 56); break;
      case "statues": disc(c - 0.2, ART.marble, FL.stone, 51); for (let y = y0 + 1; y < y0 + sz - 1; y += 3) for (let x = x0 + 1; x < x0 + sz - 1; x += 3) if (Math.hypot(x - cx, y - cy) < c - 0.5) prop(x, y, pick([...ART.statues, ...ART.pedestal])); break;
    }
  }
  conts.forEach((c, ci) => {
    const th = THEMES[c.theme];
    // Landmarks: more on bigger lands, each picked from what this land favours.
    const want = 3 + Math.floor(c.r / 35) + (rng() < 0.5 ? 1 : 0);
    const kinds = shuffle([...th.landmarks]);
    for (let k = 0; k < want; k++) {
      const lk = kinds[k % kinds.length]!;
      const sz = lk === "graveyard" || lk === "statues" ? 11 : 9;
      const pred = lk === "wreck" ? (x: number, y: number) => coastDist[at(x + 4, y + 4)]! <= 6 : () => true;
      const spot = findSpot(ci, sz, sz, pred, 700, false, lk === "wreck" ? 1 : 2);
      if (!spot) continue;
      const word = pick(LANDMARK_WORD[lk]);
      const name = lk === "dragon" ? `${placeName(rng, usedNames)}'s ${word.replace("'s Rest", "")} Rest`.replace("  ", " ") : `${placeName(rng, usedNames)} ${word}`;
      occupy(spot.x, spot.y, sz, sz, 2);
      buildLandmark(lk, spot.x, spot.y, sz, th);
      const half = Math.floor(sz / 2);
      const p: Place = { id: id("lm"), name, cont: ci, x: spot.x + half, y: spot.y + half + 2, kind: "landmark", lk };
      places.push(p);
      regions.push({ id: p.id, name, kind: "landmark", tx: spot.x, ty: spot.y, tw: sz, th: sz, about: landmarkAbout(lk, c.name) });
      if (lk === "altar" || lk === "grove") interactables.push({ id: id("shrine"), kind: "shrine", type: th.shrine, tx: spot.x + half, ty: spot.y + half + 2, name });
    }
    // Resource sites: named places where a handful of nodes stand apart from each other.
    const res: { node: "tree" | "ore" | "shroom" | "fish"; word: string; n: number }[] = [
      { node: th.trees ? "tree" : "ore", word: th.trees ? pick(["Woodlot", "Copse", "Timberland"]) : pick(["Quarry", "Diggings"]), n: th.trees ? 2 : 1 },
      { node: "ore", word: pick(["Mine", "Lode", "Seam"]), n: 2 },
      { node: "shroom", word: pick(["Hollow", "Fungal Dell", "Mushroom Ring"]), n: 2 },
      { node: "fish", word: pick(["Fishery", "Fishing Hole", "Weir"]), n: 1 },
    ];
    for (const r of res) for (let k = 0; k < r.n; k++) {
      const near = (x: number, y: number) => r.node === "ore" ? anyNear(x + 5, y + 5, 13, (i) => !!mountain[i]) : r.node === "fish" ? anyNear(x + 5, y + 5, 7, (i) => tiles[i]!.floor === FL.water) : r.node === "tree" ? moist[at(x + 5, y + 5)]! > 0.5 : true;
      const spot = findSpot(ci, 11, 11, near, 700, r.node === "fish");
      if (!spot) continue;
      const name = `${placeName(rng, usedNames)} ${r.word}`;
      const rid = id("res");
      regions.push({ id: rid, name, kind: "resource", tx: spot.x, ty: spot.y, tw: 11, th: 11, about: r.node === "tree" ? "Good timber. Every tree here can be chopped." : r.node === "ore" ? "Rich ore veins." : r.node === "shroom" ? "Mushrooms and alchemy reagents." : "Good fishing.", levelMin: c.levelMin, levelMax: c.levelMax });
      places.push({ id: rid, name, cont: ci, x: spot.x + 5, y: spot.y + 5, kind: "resource", node: r.node });
      occupy(spot.x, spot.y, 11, 11, 3);
      if (r.node !== "fish") {
        for (let y = spot.y + 1; y < spot.y + 10; y++) for (let x = spot.x + 1; x < spot.x + 10; x++) {
          if (!inside(x, y) || !land[at(x, y)] || tiles[at(x, y)]!.floor === FL.water || river[at(x, y)]) continue;
          if (Math.hypot(x - spot.x - 5, y - spot.y - 5) + (fbm(x / 3, y / 3, seed + 57) - 0.5) * 3 > 5) continue;
          const art = r.node === "ore" ? ART.pebble : r.node === "shroom" ? ART.moss : th.grounds[1].art;
          const floor = r.node === "ore" ? FL.dirt : th.grounds[1].floor;
          ground(x, y, art, floor, 55);
        }
      }
      // Individually placed: random free spots, never touching another node.
      const want = r.node === "fish" ? between(3, 5) : between(5, 8);
      let placed = 0;
      for (let t = 0; t < 120 && placed < want; t++) {
        const x = spot.x + 1 + Math.floor(rng() * 9), y = spot.y + 1 + Math.floor(rng() * 9);
        if (!walkable(x, y) || anyNear(x, y, 1, (i) => !!nodeMask[i])) continue;
        if (r.node === "fish" && !anyNear(x, y, 1, (i) => tiles[i]!.floor === FL.water)) continue;
        interactables.push({ id: id("node"), kind: "node", node: r.node, tx: x, ty: y });
        nodeMask[at(x, y)] = 1;
        if (r.node === "ore") set(x, y, { sprite: pickArt(ART.pebble, x, y, 55) });
        placed++;
      }
      if (r.node === "ore" && rng() < 0.5) { const ex = spot.x + 5, ey = spot.y + 1; if (walkable(ex, ey) && !nodeMask[at(ex, ey)]) flat(ex, ey, pick(ART.stairs)); }
    }
  });
  function landmarkAbout(lk: LandmarkKind, land: string): string {
    const t: Record<LandmarkKind, string> = {
      ruins: `Broken columns of an older ${land}.`, watchstone: "A statue that once watched the roads.", altar: "An old altar. Some still pray here.", barrow: "A burial mound. The door is sealed.",
      stones: "A ring of standing stones that hums at dusk.", tower: "An old watchtower, long abandoned.", spire: "A crystal spire. The air tastes of the Veil.", graveyard: "Rows of the forgotten dead.",
      hut: "A lonely cottage at the edge of the wild.", gate: "Two arches with nothing between them. Or so it seems.", dragon: "Bones too big for anything alive today.", obelisk: "A black needle carved with warnings.",
      wreck: "A ship the sea gave back.", crater: "Something fell here, long ago.", grove: "A quiet glade with a mossy shrine.", statues: "A gallery of heroes nobody remembers.",
    };
    return t[lk];
  }

  // ---- monster camps: open hunt grounds, never on a node or inside a town -------------
  const cell = 22;
  for (let cy = 0; cy < h; cy += cell) for (let cx = 0; cx < w; cx += cell) {
    const tw = 10, thh = 10;
    let mx = 0, my = 0, zx = 0, zy = 0, found = false;
    // Try the cell centre, then a few nudged spots, and take the first clean square.
    for (let a = 0; a < 7 && !found; a++) {
      mx = cx + Math.floor(cell / 2) + (a === 0 ? 0 : Math.floor((rng() - 0.5) * 12));
      my = cy + Math.floor(cell / 2) + (a === 0 ? 0 : Math.floor((rng() - 0.5) * 12));
      if (!inside(mx, my)) continue;
      const mi0 = at(mx, my);
      if (!land[mi0] || contAt[mi0]! < 0 || occupied[mi0] || nodeMask[mi0]) continue;
      zx = mx - 5; zy = my - 5;
      let o = 0, c = 0;
      for (let y = zy; y < zy + thh; y++) for (let x = zx; x < zx + tw; x++) {
        if (!inside(x, y)) { c++; continue; }
        const i = at(x, y);
        if (nodeMask[i] || occupied[i]) c++;
        else if (!mountain[i] && !lake[i] && !river[i] && land[i] && !tiles[i]!.block && tiles[i]!.floor !== FL.water && tiles[i]!.floor !== FL.lava) o++;
      }
      if (c === 0 && o >= tw * thh * 0.8) found = true;
    }
    if (!found) continue;
    const mi = at(mx, my);
    const ci = contAt[mi]!;
    const c = conts[ci]!, th = themeOf(mi);
    const cap = cities.find((x) => x.cont === ci && x.kind === "capital");
    const far = cap ? Math.min(1, Math.hypot(mx - cap.plaza.x, my - cap.plaza.y) / c.r) : 0.5;
    const lo = Math.round(c.levelMin + (c.levelMax - c.levelMin) * far * 0.6);
    const hi = Math.max(lo, Math.round(c.levelMin + (c.levelMax - c.levelMin) * Math.min(1, far * 0.6 + 0.4)));
    const animal = rng() < 0.22 && th.animals.length;
    const pool = (animal ? th.animals : th.monsters).filter((s) => MONSTER_BY_ID[s] || ANIMAL_BY_ID[s]);
    const chosen = pool.length > 2 ? pool.filter(() => rng() < 0.6) : pool;
    if (zones.length >= LIMITS.zones - 40) continue;
    zones.push({ id: id("camp"), tx: Math.max(1, zx), ty: Math.max(1, zy), tw, th: thh, levelMin: Math.max(1, lo), levelMax: Math.max(1, hi), species: (chosen.length ? chosen : pool).slice(0, 4), count: animal ? 3 : 2 + Math.floor(rng() * 2), respawn: 45 + Math.floor(rng() * 60) });
    occupy(zx, zy, tw, thh, 1);
  }
  // Ruined towns are infested: a camp right in the streets, a little tougher than the land around it.
  for (const city of cities.filter((x) => x.kind === "ruin")) {
    if (zones.length >= LIMITS.zones - 10) break;
    const c = conts[city.cont]!, th = THEMES[c.theme];
    const pool = th.monsters.filter((s) => MONSTER_BY_ID[s]);
    if (!pool.length) continue;
    const lv = Math.round(c.levelMin + (c.levelMax - c.levelMin) * 0.75);
    zones.push({ id: `ruin-${id("camp")}`, tx: city.x + 2, ty: city.y + 2, tw: city.w - 4, th: city.h - 4, levelMin: Math.max(1, lv - 2), levelMax: Math.max(1, lv + 2), species: shuffle([...pool]).slice(0, 3), count: 4 + Math.floor(rng() * 3), respawn: 60 + Math.floor(rng() * 40) });
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
  /** Like nearestWalkable, but skips tiles that already hold an NPC, board, shrine or node, and claims the one it picks. */
  const taken = new Set<number>();
  for (const it of interactables) taken.add(at(it.tx, it.ty));
  function freeSpot(x: number, y: number) {
    for (let r = 0; r < 14; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (walkable(x + dx, y + dy) && !taken.has(at(x + dx, y + dy))) { taken.add(at(x + dx, y + dy)); return { x: x + dx, y: y + dy }; }
    }
    return nearestWalkable(x, y);
  }

  // ---- NPCs ---------------------------------------------------------------------------------
  const npcIndex = new Map<string, MapNpc>();
  const addNpc = (city: City, role: string, lines: string[], female: boolean) => {
    const first = FIRST[Math.floor(rng() * FIRST.length)]!;
    const n: MapNpc = { id: id("npc"), name: `${role} ${first}`, role: `${role} of ${city.name}`, tx: 0, ty: 0, female, lines, outfit: Math.floor(rng() * 8), hair: Math.floor(rng() * 6) };
    // Stand on a street near the plaza, spread out.
    const k = city.npcs.length;
    const ang = (k / 7) * Math.PI * 2 + 0.4;
    const spot = freeSpot(Math.round(city.plaza.x + Math.cos(ang) * (city.kind === "capital" ? 7 : 4)), Math.round(city.plaza.y + Math.sin(ang) * 3));
    n.tx = spot.x;
    n.ty = spot.y;
    npcs.push(n);
    npcIndex.set(n.id, n);
    city.npcs.push(n.id);
    return n;
  };
  const ROLES: Record<SettlementKind, string[]> = {
    capital: ["Elder", "Captain", "Scholar", "Merchant", "Smith", "Cartographer"],
    town: ["Reeve", "Hunter", "Herbalist", "Innkeeper"],
    port: ["Harbourmaster", "Fisher", "Innkeeper"],
    village: ["Reeve", "Herbalist"],
    hamlet: ["Farmer"],
    fort: ["Commander", "Quartermaster"],
    abbey: ["Abbot", "Herbalist"],
    market: ["Merchant", "Trader", "Innkeeper"],
    minetown: ["Foreman", "Smith"],
    ruin: [],
  };
  for (const city of cities) {
    if (npcs.length >= LIMITS.npcs - 40) break;
    const c = conts[city.cont]!;
    const others = cities.filter((o) => o.cont === city.cont && o !== city && o.kind !== "ruin").map((o) => o.name);
    const resHere = places.filter((p) => p.cont === city.cont && p.kind === "resource");
    const lmHere = places.filter((p) => p.cont === city.cont && p.kind === "landmark");
    const ruinsHere = cities.filter((o) => o.cont === city.cont && o.kind === "ruin");
    for (const role of ROLES[city.kind]) {
      const lines: string[] = [];
      if (role === "Elder" || role === "Reeve" || role === "Farmer" || role === "Abbot") lines.push(`Welcome to ${city.name}, in ${c.name}.`, c.about ?? `${c.name} is ${THEMES[c.theme].label.toLowerCase()} country.`);
      if (role === "Captain" || role === "Hunter" || role === "Commander") lines.push(`Foes grow tougher the further you get from ${cities.find((x) => x.cont === city.cont && x.kind === "capital")?.name ?? city.name}.`, `Expect levels ${c.levelMin} to ${c.levelMax} out there.`);
      if (role === "Commander" && ruinsHere.length) lines.push(`The ruins of ${ruinsHere[0]!.name} are crawling. We could use a blade.`);
      if (role === "Cartographer" || role === "Scholar" || role === "Trader") {
        if (others.length) lines.push(`Other towns of ${c.name}: ${others.slice(0, 5).join(", ")}. Follow the roads.`);
        if (lmHere.length) lines.push(`Old places worth a look: ${lmHere.slice(0, 4).map((p) => p.name).join(", ")}.`);
      }
      if (role === "Harbourmaster") lines.push(`Ferries leave from the end of the pier. Step on the glowing tile.`, `From here you can sail to ${(ferryTargets.get(city) ?? []).map((b) => b.name).join(" or ") || "nowhere yet"}.`);
      if (role === "Merchant" || role === "Innkeeper" || role === "Quartermaster") lines.push(city.walled ? `The bounty board is by the south gate. The hearth by the plaza mends you.` : `The hearth by the square mends you. Rest a while.`);
      if (role === "Innkeeper" || role === "Merchant" || role === "Harbourmaster" || role === "Trader") { const gb = bossOf.get(city.cont); if (gb) lines.push(`They say something old guards ${gb.place.name}. Nobody goes alone.`); }
      if (role === "Smith" || role === "Herbalist" || role === "Fisher" || role === "Foreman") if (resHere.length) lines.push(`For materials, try ${resHere.slice(0, 3).map((p) => p.name).join(", ")}.`);
      if (!lines.length) lines.push(`Safe travels.`);
      addNpc(city, role, lines.slice(0, 4), rng() < 0.5);
    }
  }

  // ---- side quests ---------------------------------------------------------------------------
  const questIds = new Set<string>();
  const qid = (base: string) => { let q = base.replace(/[^a-z0-9_-]/gi, "-").slice(0, 34); while (questIds.has(q)) q += "x"; questIds.add(q); return q; };
  const questCont = new Map<string, number>();
  /** Respects the file limit, so a huge world can never produce a map that will not load. */
  const addQuest = (q: MapQuest, ci: number) => {
    if (quests.length >= LIMITS.quests - 30) return false;
    quests.push(q);
    questCont.set(q.id, ci);
    return true;
  };
  /** Quest rewards: a solid share of a level at the land's level, so questing is worth the walk. */
  const xpAt = (lv: number) => Math.floor(30 * Math.pow(1.17, Math.min(Math.max(1, lv) - 1, 20)) * (1 + Math.max(0, lv - 20) * 0.055));
  const reward = (ci: number, mult = 1, loot = 0) => {
    const c = conts[ci]!;
    const mid = Math.round((c.levelMin + c.levelMax) / 2);
    return {
      kyo: Math.round((40 + c.levelMin * 12) * mult),
      xp: Math.round((60 + xpAt(mid) * 0.45) * mult),
      ...(loot ? { items: [{ itemId: THEME_LOOT[c.theme], count: loot }] } : {}),
    };
  };
  const monName = (sp: string) => MONSTER_BY_ID[sp]?.name ?? ANIMAL_BY_ID[sp]?.name ?? "monsters";
  /** Species that really spawn on a continent (from the camps just placed). */
  const foesIn = (ci: number): string[] => {
    const out: string[] = [];
    for (const z of zones) {
      const o = contAt[at(Math.min(w - 1, z.tx + 5), Math.min(h - 1, z.ty + 5))];
      if (o === ci) for (const sp of z.species) if (!out.includes(sp)) out.push(sp);
    }
    return out.length ? out : THEMES[conts[ci]!.theme].monsters.filter((s) => MONSTER_BY_ID[s]);
  };
  const pickFoe = (ci: number, k: number) => { const f = foesIn(ci); return f[k % f.length]!; };

  // Wilderness folk: a hermit at each ruin, a prospector at a mine, an angler at a fishery.
  const wildNpc = (p: Place, role: string, first: string[], female: boolean) => {
    if (npcs.length >= LIMITS.npcs - 10) return null;
    const spot = freeSpot(p.x, p.y);
    const n: MapNpc = { id: id("npc"), name: `${role} ${FIRST[Math.floor(rng() * FIRST.length)]!}`, role: `${role} near ${p.name}`, tx: spot.x, ty: spot.y, female, lines: first.slice(0, 4), outfit: Math.floor(rng() * 8), hair: Math.floor(rng() * 6) };
    npcs.push(n);
    npcIndex.set(n.id, n);
    return n;
  };
  conts.forEach((c, ci) => {
    const lms = places.filter((p) => p.cont === ci && p.kind === "landmark");
    const mines = places.filter((p) => p.cont === ci && p.kind === "resource" && p.node === "ore");
    const fish = places.filter((p) => p.cont === ci && p.kind === "resource" && p.node === "fish");
    const shrooms = places.filter((p) => p.cont === ci && p.kind === "resource" && p.node === "shroom");
    const boss = bossOf.get(ci);
    lms.slice(0, 3).forEach((lm, k) => {
      const other = lms[(k + 1) % lms.length]!;
      const npc = wildNpc(lm, "Hermit", [`Few come out to ${lm.name} any more.`, `The stones hum at night. Something is stirring in ${c.name}.`, ...(boss && boss.place === lm ? [`Do not linger. A guardian sleeps here.`] : [])], k % 2 === 0);
      if (!npc || other === lm) return;
      addQuest({
        id: qid(`${lm.name}-relics`), name: `${lm.name}: Old Echoes`, about: `The hermit of ${lm.name} wants you to read the stones at ${other.name} and drive off what haunts them.`,
        giver: npc.id, steps: [{ type: "goto", tx: other.x, ty: other.y, radius: 5, hint: `${other.name}.` }, { type: "kill", count: 5, species: pickFoe(ci, k + 1), hint: `Near the stones of ${c.name}.` }], reward: reward(ci, 1.1, 2),
        offer: `Walk to ${other.name} for me, and clear whatever lurks there. I will make it worth your while.`, progress: "The stones are not quiet yet.", done: "The hum has settled. Take this.",
      }, ci);
    });
    mines.slice(0, 1).forEach((m) => {
      const npc = wildNpc(m, "Prospector", [`Good seams here, if the ${monName(pickFoe(ci, 0))} would leave us be.`, "Bring me ore and I will pay fair."], false);
      if (!npc) return;
      addQuest({
        id: qid(`${m.name}-ore`), name: `${m.name}: Rock and Stone`, about: `Fill the prospector's order with ore from ${m.name}.`, giver: npc.id,
        steps: [{ type: "gather", node: "ore", count: 5, hint: `At ${m.name}.` }, { type: "bring", itemId: NODE_ITEM.ore, count: 5, hint: "Hand it to the prospector." }], reward: reward(ci, 0.9, 1),
        offer: "Five pieces of ore, fresh out of the seam. That is all I ask.", progress: "I am still short of ore.", done: "Clean cut. Here is your share.",
      }, ci);
    });
    fish.slice(0, 1).forEach((f) => {
      const npc = wildNpc(f, "Angler", ["The big ones bite at dusk.", `${f.name} has never failed me.`], true);
      if (!npc) return;
      addQuest({
        id: qid(`${f.name}-catch`), name: `${f.name}: The Big Catch`, about: `Land five fish for the angler at ${f.name}.`, giver: npc.id,
        steps: [{ type: "gather", node: "fish", count: 5, hint: `At ${f.name}.` }, { type: "bring", itemId: NODE_ITEM.fish, count: 5, hint: "Hand them to the angler." }], reward: reward(ci, 0.8, 1),
        offer: "Five fish. My arms are too sore to cast.", progress: "The line is still quiet.", done: "A fine haul. Share some with the town.",
      }, ci);
    });
    shrooms.slice(0, 1).forEach((s) => {
      if (rng() < 0.4) return;
      const npc = wildNpc(s, "Forager", ["Caps, stems and spores. The Hollow gives if you ask nicely.", "Mind the purple ones."], true);
      if (!npc) return;
      addQuest({
        id: qid(`${s.name}-caps`), name: `${s.name}: Caps and Spores`, about: `The forager at ${s.name} needs mushrooms for the season's remedies.`, giver: npc.id,
        steps: [{ type: "gather", node: "shroom", count: 4, hint: `At ${s.name}.` }, { type: "bring", itemId: NODE_ITEM.shroom, count: 4, hint: "Hand them to the forager." }], reward: reward(ci, 0.85, 1),
        offer: "Four good mushrooms. I will brew you something in return... or pay, if you prefer.", progress: "Still not enough for a brew.", done: "Lovely. These will save a few lives.",
      }, ci);
    });
  });

  for (const city of cities) {
    if (city.kind === "ruin" || !city.npcs.length) continue;
    const ci = city.cont;
    const c = conts[ci]!;
    const giver = city.npcs[1] ?? city.npcs[0]!;
    const res = places.filter((p) => p.cont === ci && p.kind === "resource");
    const lms = places.filter((p) => p.cont === ci && p.kind === "landmark");
    const r = res.slice().sort((a, b) => Math.hypot(a.x - city.plaza.x, a.y - city.plaza.y) - Math.hypot(b.x - city.plaza.x, b.y - city.plaza.y))[Math.floor(rng() * Math.min(2, res.length))];
    const sp = pickFoe(ci, Math.floor(rng() * 6));
    const pestsId = qid(`${city.name}-pests`);
    addQuest({
      id: pestsId, name: `${city.name}: Clear the Roads`, about: `${monName(sp)} prowl the roads around ${city.name}. Thin them out.`,
      giver, steps: [{ type: "kill", count: 6, species: sp, hint: `They camp in the wilds of ${c.name}.` }], reward: reward(ci),
      offer: `The ${monName(sp)} are getting bold. Six of them, and the roads are safe again.`, progress: "Still too many out there.", done: "The carts are moving again. Thank you.",
    }, ci);
    // Settlement-specific work.
    if (city.kind === "fort") {
      const ruin = cities.filter((o) => o.cont === ci && o.kind === "ruin").sort((a, b) => Math.hypot(a.x - city.x, a.y - city.y) - Math.hypot(b.x - city.x, b.y - city.y))[0];
      const target = ruin ? { x: ruin.plaza.x, y: ruin.plaza.y + 2, name: `the ruins of ${ruin.name}` } : lms[0] ? { x: lms[0].x, y: lms[0].y, name: lms[0].name } : null;
      if (target) {
        const ruinZone = ruin ? zones.find((z) => z.tx === ruin.x + 2 && z.ty === ruin.y + 2) : undefined;
        const foe = ruinZone?.species[0] ?? pickFoe(ci, 2);
        addQuest({
          id: qid(`${city.name}-sortie`), name: `${city.name}: Sortie`, requires: pestsId, about: `The commander wants ${target.name} retaken.`, giver: city.npcs[0]!,
          steps: [{ type: "goto", tx: target.x, ty: target.y, radius: 6, hint: `${target.name}.` }, { type: "kill", count: 8, species: foe, hint: `In ${target.name}.` }], reward: reward(ci, 1.6, 2),
          offer: `Scouts say ${target.name} is crawling with ${monName(foe)}. Take it back.`, progress: "The banner is not raised yet.", done: "The garrison drinks to you tonight.",
        }, ci);
      }
    }
    if (city.kind === "abbey") {
      const lm = lms[Math.floor(rng() * lms.length)];
      if (lm) addQuest({
        id: qid(`${city.name}-pilgrim`), name: `${city.name}: A Pilgrim's Road`, about: `Walk the pilgrim's road to ${lm.name} and back.`, giver: city.npcs[0]!,
        steps: [{ type: "goto", tx: lm.x, ty: lm.y, radius: 5, hint: `${lm.name}.` }, { type: "talk", npcId: city.npcs[0]!, hint: `Back at ${city.name}.` }], reward: reward(ci, 1.1, 1),
        offer: `Every novice walks to ${lm.name} once. Will you walk it for one too sick to go?`, progress: "The road is long, but kind.", done: "You walked it well. Go in peace.",
      }, ci);
    }
    if (city.kind === "minetown" || city.kind === "market" || city.kind === "hamlet") {
      const node: "ore" | "tree" | "shroom" = city.kind === "minetown" ? "ore" : city.kind === "hamlet" && THEMES[c.theme].trees ? "tree" : "shroom";
      const who = city.npcs[city.npcs.length - 1]!;
      addQuest({
        id: qid(`${city.name}-haul`), name: `${city.name}: ${node === "ore" ? "Pick and Shovel" : node === "tree" ? "Firewood" : "Market Day"}`, about: `${npcIndex.get(who)?.name} needs ${NODE_ITEM[node]} for the ${city.kind === "market" ? "stalls" : "season"}.`, giver: who,
        steps: [{ type: "gather", node, count: 5 }, { type: "bring", itemId: NODE_ITEM[node], count: 5, hint: `Hand it to ${npcIndex.get(who)?.name}.` }], reward: reward(ci, 1, 1),
        offer: `Five loads of ${NODE_ITEM[node]} and we are square.`, progress: "Not enough yet.", done: "That will do nicely.",
      }, ci);
    }
    let supplyId = "";
    if (r && city.kind !== "fort" && city.kind !== "abbey") {
      const giver2 = city.npcs[city.npcs.length - 1] ?? giver;
      supplyId = qid(`${city.name}-supply`);
      addQuest({
        id: supplyId, name: `${city.name}: Supply Run`, about: `Gather at ${r.name} for the town stores.`, giver: giver2,
        steps: [{ type: "goto", tx: r.x, ty: r.y, radius: 6, hint: `${r.name}.` }, { type: "gather", node: r.node!, count: 4, hint: `At ${r.name}.` }], reward: reward(ci, 0.8),
        offer: `We are short on supplies. ${r.name} has what we need.`, progress: `${r.name} is not far.`, done: "That will see us through the season.",
      }, ci);
      // Second half of the chain: a bigger order that actually takes the goods back to the NPC.
      if ((city.kind === "capital" || city.kind === "town" || city.kind === "port") && r.node !== "fish") {
        const smith = city.npcs[Math.min(2, city.npcs.length - 1)] ?? giver2;
        addQuest({
          id: qid(`${city.name}-order`), name: `${city.name}: The Big Order`, requires: supplyId, about: `Deliver a full order of ${r.node === "tree" ? "timber" : r.node === "ore" ? "ore" : "mushrooms"} to ${npcIndex.get(smith)?.name}.`, giver: smith,
          steps: [{ type: "gather", node: r.node!, count: 8, hint: `Try ${r.name}.` }, { type: "bring", itemId: NODE_ITEM[r.node!], count: 8, hint: `Hand it over to ${npcIndex.get(smith)?.name}.` }], reward: reward(ci, 1.3, 1),
          offer: "That first haul was good. Can you manage eight more?", progress: "Not enough yet.", done: "Now that is a proper delivery.",
        }, ci);
      }
    }
    // Courier: talk to someone in a sister town.
    const sister = cities.filter((o) => o.cont === ci && o !== city && o.npcs.length).sort((a, b) => Math.hypot(a.x - city.x, a.y - city.y) - Math.hypot(b.x - city.x, b.y - city.y))[Math.floor(rng() * 2)] ?? cities.find((o) => o.cont === ci && o !== city && o.npcs.length);
    if (sister) {
      const to = sister.npcs[0]!;
      addQuest({
        id: qid(`${city.name}-letter`), name: `${city.name}: A Letter for ${sister.name}`, about: `Carry a sealed letter to ${npcIndex.get(to)?.name} in ${sister.name}.`, giver: city.npcs[0]!,
        steps: [{ type: "talk", npcId: to, hint: `In ${sister.name}.` }], turnIn: to, reward: reward(ci, 0.7),
        offer: `Could you carry this to ${npcIndex.get(to)?.name} in ${sister.name}? Follow the road.`, progress: `${sister.name} is down the road.`, done: "A letter from home. Bless you, traveller.",
      }, ci);
    }
    if (city.kind === "village" || city.kind === "hamlet" || city.kind === "minetown") continue;
    // Elite hunt, unlocked once the roads are clear.
    const elite = pickFoe(ci, Math.floor(rng() * 6) + 2);
    addQuest({
      id: qid(`${city.name}-elite`), name: `${city.name}: Wanted, Dead or Fled`, requires: pestsId, about: `A pack leader of ${monName(elite)} has been stalking travellers near ${city.name}.`,
      giver: city.npcs[0]!, steps: [{ type: "kill", count: 10, species: elite, hint: `Deeper in ${c.name}.` }], reward: reward(ci, 1.4, 2),
      offer: `The roads are quiet, but their leaders are not. Ten ${monName(elite)} will break the pack.`, progress: "The pack still hunts.", done: "No more screams on the road. Well done.",
    }, ci);
    // Look into an old place nearby.
    const lm = lms.slice().sort((a, b) => Math.hypot(a.x - city.plaza.x, a.y - city.plaza.y) - Math.hypot(b.x - city.plaza.x, b.y - city.plaza.y))[0];
    if (lm) {
      addQuest({
        id: qid(`${city.name}-rumour`), name: `${city.name}: Rumours of ${lm.name}`, about: `Travellers report strange lights at ${lm.name}. See what is there.`, giver: city.npcs[city.npcs.length - 1] ?? giver,
        steps: [{ type: "goto", tx: lm.x, ty: lm.y, radius: 5, hint: `${lm.name}.` }, { type: "kill", count: 4, species: pickFoe(ci, 3), hint: `Around ${lm.name}.` }], reward: reward(ci, 1, 1),
        offer: `Folk speak of lights at ${lm.name}. Look into it, and bring back word.`, progress: `${lm.name} is waiting.`, done: "So the rumours were true. Thank you.",
      }, ci);
    }
    // The capital's captain posts a bounty on the continent's guardian.
    const boss = bossOf.get(ci);
    if (city.kind === "capital" && boss) {
      addQuest({
        id: qid(`${city.name}-guardian`), name: `${city.name}: The Guardian's Bounty`, requires: pestsId, about: `The council offers a bounty on the guardian at ${boss.place.name}.`, giver: city.npcs[1] ?? city.npcs[0]!,
        steps: [{ type: "goto", tx: boss.place.x, ty: boss.place.y, radius: 6, hint: `${boss.place.name}.` }, { type: "kill", count: 1, species: boss.species, hint: `The guardian at ${boss.place.name}.` }], reward: { ...reward(ci, 2.5, 3), items: [{ itemId: "big_potion", count: 2 }, { itemId: "ghost_jar", count: 1 }, { itemId: THEME_LOOT[c.theme], count: 3 }] },
        offer: `Our scouts say a guardian holds ${boss.place.name}. Bring it down and the council pays well.`, progress: "The guardian still stands.", done: "The council will sing of this.",
      }, ci);
    }
  }

  // ---- main story -------------------------------------------------------------------------
  if (opts.story) buildStory();
  function buildStory() {
    const capitals = conts.map((_, ci) => cities.find((c) => c.cont === ci && c.kind === "capital")).filter((c): c is City => !!c && c.npcs.length >= 2);
    if (!capitals.length) return;
    const home = capitals[0]!;
    const elder = home.npcs[0]!;
    const elderName = npcIndex.get(elder)!.name;
    let prev: string | undefined;
    const add = (q: MapQuest) => { quests.push({ ...q, ...(prev ? { requires: prev } : {}) }); questCont.set(q.id, 0); prev = q.id; };
    const xpScale = (ci: number) => Math.round(150 + xpAt(conts[ci]!.levelMax) * 0.9);
    // Chapter 1: at home.
    const lm0 = places.find((p) => p.cont === home.cont && p.kind === "landmark");
    add({
      id: qid("story-1-sundered"), name: "I · The Sundered Crown", about: `${elderName} tells of the Crown that once held ${opts.name} together, and of the Wardens who keep its shards.`,
      giver: elder, steps: [{ type: "talk", npcId: home.npcs[1]!, hint: `The captain of ${home.name}.` }, ...(lm0 ? [{ type: "goto", tx: lm0.x, ty: lm0.y, radius: 5, hint: `${lm0.name}, outside ${home.name}.` } as MapQuestStep] : [])],
      reward: { kyo: 80, xp: 220, items: [{ itemId: "potion", count: 3 }] },
      offer: "When the Veil tore, the Crown broke into shards and the land broke with it. Speak to our captain, then see the old stones for yourself.", progress: "The stones remember. Go and look.", done: "You felt it, didn't you? The land wants to be whole. The Wardens across the sea hold the shards.",
    });
    // One chapter per other continent: reach its capital, do the Warden's trial.
    const numerals = ["II", "III", "IV", "V", "VI", "VII", "VIII"];
    capitals.slice(1).forEach((cap, k) => {
      const ci = cap.cont;
      const c = conts[ci]!;
      const warden = cap.npcs[0]!;
      const wardenName = npcIndex.get(warden)!.name;
      const res = places.find((p) => p.cont === ci && p.kind === "resource" && p.node !== "fish");
      const lm = places.find((p) => p.cont === ci && p.kind === "landmark");
      const boss = bossOf.get(ci);
      const scholar = cities.find((x) => x.cont === ci && x !== cap && x.npcs.length);
      const trial: MapQuestStep[] = [];
      if (scholar) trial.push({ type: "talk", npcId: scholar.npcs[0]!, hint: `In ${scholar.name}.` });
      if (res && k % 2 === 0) trial.push({ type: "gather", node: res.node!, count: 5, hint: `${res.name}.` });
      trial.push({ type: "kill", count: 8, species: pickFoe(ci, 0), hint: `In the wilds of ${c.name}.` });
      if (lm) trial.push({ type: "goto", tx: lm.x, ty: lm.y, radius: 5, hint: `${lm.name}.` });
      if (boss && k >= 2) trial.push({ type: "kill", count: 1, species: boss.species, hint: `The guardian at ${boss.place.name}.` });
      add({
        id: qid(`story-${k + 2}-${c.name}`), name: `${numerals[k] ?? k + 2} · The ${c.name} Shard`, about: `Sail to ${c.name} and earn the shard held by ${wardenName} in ${cap.name}.`,
        giver: k === 0 ? elder : capitals[k]!.npcs[0]!, turnIn: warden,
        steps: [{ type: "talk", npcId: warden, hint: `${cap.name}, capital of ${c.name}. Take a ferry from a harbour.` }, ...trial],
        reward: { kyo: reward(ci, 2).kyo, xp: xpScale(ci), items: [{ itemId: "big_potion", count: 2 }, { itemId: "ghost_jar", count: 1 }] },
        offer: k === 0 ? `The nearest shard is in ${c.name}. Find ${wardenName} in ${cap.name}. The harbour can take you.` : `The next shard lies in ${c.name}. ${wardenName} keeps it in ${cap.name}.`,
        progress: `${wardenName} will not part with the shard cheaply.`, done: `You have earned it. Take the ${c.name} shard, and carry word to the next Warden.`,
      });
    });
    // Finale: back home, then the throne.
    const lastCont = capitals[capitals.length - 1]!.cont;
    const throne = places.filter((p) => p.kind === "landmark" && p.cont === lastCont).pop() ?? places.find((p) => p.kind === "landmark");
    const finalBoss = bossOf.get(lastCont);
    add({
      id: qid("story-final-crown"), name: "Finale · The Crown Remade", about: `Bring the shards home to ${elderName}, then face what waits at the old throne.`,
      giver: capitals[capitals.length - 1]!.npcs[0]!, turnIn: elder,
      steps: [
        { type: "talk", npcId: elder, hint: `${home.name}.` },
        ...(throne ? [{ type: "goto", tx: throne.x, ty: throne.y, radius: 5, hint: `${throne.name}.` } as MapQuestStep] : []),
        ...(finalBoss ? [{ type: "kill", count: 1, species: finalBoss.species, hint: "The guardian of the throne." } as MapQuestStep] : []),
      ],
      reward: { kyo: 2500, xp: Math.max(4000, xpScale(lastCont) * 3), items: [{ itemId: "big_potion", count: 5 }, { itemId: "ghost_jar", count: 3 }, { itemId: "cleanse_salt", count: 5 }] },
      offer: "Every shard is gathered. Take them home, and finish what the Veil began.", progress: "The throne waits.", done: `The Crown is whole. ${opts.name} will remember your name.`,
    });
  }

  // ---- regions for continents ----------------------------------------------------------------
  conts.forEach((c, ci) => {
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) { const i = at(x, y); if (owner[i] === ci && !isle[i]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }
    if (x1 < x0) return;
    regions.push({ id: id("cont"), name: c.name, kind: "region", tx: x0, ty: y0, tw: x1 - x0 + 1, th: y1 - y0 + 1, about: c.about ?? `${THEMES[c.theme].label} lands${secondary[ci] ? `, with ${THEMES[secondary[ci]!].label.toLowerCase()} country inland` : ""}. Foes level ${c.levelMin}–${c.levelMax}.`, levelMin: c.levelMin, levelMax: c.levelMax });
  });

  const home = cities.find((c) => c.kind === "capital" && c.cont === 0) ?? cities.find((c) => c.kind !== "ruin") ?? cities[0];
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
        const c = dist[i]! + (passable(nx, ny) ? 1 : t.floor === FL.water ? 12 : t.layers?.length ? 30 : 4);
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
    ...cities.flatMap((c) => c.gates),
  ];
  let reach = reachFrom(spawn.x, spawn.y);
  for (const t of targets) {
    if (!inside(t.x, t.y) || reach[at(t.x, t.y)]) continue;
    // Gates and nodes are used from beside them; only carve when no neighbour is reachable either.
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(t.x + dx!, t.y + dy!) && reach[at(t.x + dx!, t.y + dy!)]) && !walkable(t.x, t.y)) continue;
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
  // Fill the gaps: any reachable wild land far from a camp gets one of its own.
  ensureCoverage({ id: opts.id, w, h, tiles, zones, regions, spawn: { tx: spawn.x, ty: spawn.y } }, seed);
  // Kill quests must name something that really spawns here.
  const spawned = new Set<string>([...zones.flatMap((z) => z.species), ...spawns.flatMap((s) => (s.kind === "mob" && s.species ? [s.species] : []))]);
  for (const q of quests) for (const st of q.steps) {
    if (st.type !== "kill" || !st.species || spawned.has(st.species)) continue;
    const ci = questCont.get(q.id);
    const near = ci === undefined ? undefined : zones.find((z) => contAt[at(Math.min(w - 1, z.tx + 5), Math.min(h - 1, z.ty + 5))] === ci);
    st.species = near?.species[0];
  }
  // Quest destinations snap to the nearest reachable tile.
  const nearestReach = (x: number, y: number) => {
    for (let r = 0; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inside(x + dx, y + dy) && reach[at(x + dx, y + dy)]) return { x: x + dx, y: y + dy };
    return { x, y };
  };
  for (const q of quests) for (const st of q.steps) if (st.type === "goto") { const p = nearestReach(st.tx, st.ty); st.tx = p.x; st.ty = p.y; }

  // ---- resource nodes, one at a time ---------------------------------------------------------
  // Every reachable patch of wild land is a candidate. Candidates are visited in random order and each
  // becomes a node only if nothing else stands within two tiles, so nodes are spread out singly instead of
  // stamped in blocks. What grows depends on the ground: trees in wet green country, ore near rock,
  // mushrooms in bog, bone and void, fishing spots on shores. A noise field makes some areas richer.
  const inZone = new Uint8Array(N);
  for (const z of zones) for (let y = z.ty; y < z.ty + z.th; y++) for (let x = z.tx; x < z.tx + z.tw; x++) if (inside(x, y)) inZone[at(x, y)] = 1;
  for (const it of interactables) if (it.kind === "node") nodeMask[at(it.tx, it.ty)] = 1;
  const nearMountain = new Uint8Array(N);
  for (let i = 0; i < N; i++) if (mountain[i]) { const x = i % w, y = (i / w) | 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (inside(x + dx, y + dy)) nearMountain[at(x + dx, y + dy)] = 1; }
  const npcTile = new Set<number>(npcs.map((n) => at(n.tx, n.ty)));
  const gotoTile = new Set<number>();
  for (const q of quests) for (const st of q.steps) if (st.type === "goto") for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inside(st.tx + dx, st.ty + dy)) gotoTile.add(at(st.tx + dx, st.ty + dy));
  const freeForNode = (i: number) => !!reach[i] && !occupied[i] && !roadMask[i] && !inZone[i] && !npcTile.has(i) && !gotoTile.has(i) && !tiles[i]!.portal && !tiles[i]!.layers?.length && contAt[i]! >= 0;
  const nodeClear = (x: number, y: number, r: number) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inside(x + dx, y + dy) && nodeMask[at(x + dx, y + dy)]) return false; return true; };
  {
    const cand: number[] = [];
    for (let y = 3; y < h - 3; y++) for (let x = 3; x < w - 3; x++) { const i = at(x, y); if (freeForNode(i)) cand.push(i); }
    shuffle(cand);
    const budget = Math.min(LIMITS.interactables - 600 - interactables.length, Math.round(cand.length / 50));
    let made = 0;
    for (const i of cand) {
      if (made >= budget) break;
      const x = i % w, y = (i / w) | 0;
      const th = themeOf(i);
      const t = tiles[i]!;
      const rich = 0.25 + 1.5 * fbm(x / 18, y / 18, seed + 91);
      // Weights by ground.
      let wTree = 0, wOre = 0, wShroom = 0, wFish = 0;
      if (th.trees) wTree = moist[i]! > 0.56 ? 4 : moist[i]! > 0.46 ? 1.6 : 0.4;
      if (nearMountain[i]) wOre += 3.5;
      if (t.floor === FL.stone || t.floor === FL.ash || t.floor === FL.sand || t.floor === FL.snow) wOre += 0.7;
      if (t.floor === FL.bog || t.floor === FL.bone || t.floor === FL.void) wShroom += 2.2;
      if (moist[i]! > 0.6) wShroom += 0.9;
      if (anyNear(x, y, 1, (j) => tiles[j]!.floor === FL.water)) wFish += 1.2;
      const total = wTree + wOre + wShroom + wFish;
      if (total <= 0) continue;
      if (rng() > Math.min(1, rich * (total / 3))) continue;
      if (!nodeClear(x, y, 2)) continue;
      let r = rng() * total;
      const kind: "tree" | "ore" | "shroom" | "fish" = (r -= wTree) < 0 ? "tree" : (r -= wOre) < 0 ? "ore" : (r -= wShroom) < 0 ? "shroom" : "fish";
      interactables.push({ id: id("node"), kind: "node", node: kind, tx: x, ty: y });
      nodeMask[i] = 1;
      made++;
    }
  }

  // ---- wilderness scenery: boulders, statues, stumps, ponds, bones and blooms -------------
  // Anything that blocks keeps a full ring of open, reachable ground round it, so it can never cut a path.
  {
    const reserved = new Uint8Array(N);
    const clearRing = (x0: number, y0: number, ww: number, hh: number) => {
      for (let y = y0 - 1; y <= y0 + hh; y++) for (let x = x0 - 1; x <= x0 + ww; x++) {
        if (!inside(x, y)) return false;
        const i = at(x, y);
        if (!reach[i] || tiles[i]!.block || reserved[i] || nodeMask[i] || roadMask[i] || occupied[i] || npcTile.has(i) || gotoTile.has(i) || tiles[i]!.portal || tiles[i]!.layers?.length) return false;
      }
      return true;
    };
    const claim = (x0: number, y0: number, ww: number, hh: number) => { for (let y = y0 - 1; y <= y0 + hh; y++) for (let x = x0 - 1; x <= x0 + ww; x++) reserved[at(x, y)] = 1; };
    const tries = Math.round((w * h) / 120);
    for (let k = 0; k < tries; k++) {
      const x = 4 + Math.floor(rng() * (w - 8)), y = 4 + Math.floor(rng() * (h - 8));
      const i = at(x, y);
      if (!land[i] || contAt[i]! < 0) continue;
      const th = themeOf(i);
      const roll = rng();
      if (roll < 0.12) {
        // A small pond (fishable shore all round).
        const pw = between(2, 3), ph = 2;
        if (!clearRing(x, y, pw, ph) || inZone[i]) continue;
        for (let yy = y; yy < y + ph; yy++) for (let xx = x; xx < x + pw; xx++) set(xx, yy, { floor: FL.water, block: 1, sprite: pickArt(ART.shallow, xx, yy, 63), layers: undefined });
        claim(x, y, pw, ph);
      } else if (roll < 0.55) {
        if (!clearRing(x, y, 1, 1)) continue;
        const art = th.id === "bone" ? pick([...ART.sarcophagus, ...ART.columns, ...ART.stones]) : th.id === "void" ? pick([...ART.orb, ...ART.pillar, ...ART.boulder]) : th.id === "ashen" ? pick([...ART.boulder, ...ART.boulder, ...ART.stones]) : th.id === "crown" ? pick([...ART.columns, ...ART.statues]) : pick([...ART.boulder, ...ART.boulder, ...ART.stones, ...ART.columns]);
        prop(x, y, art);
        claim(x, y, 1, 1);
      } else {
        // Ground detail you can walk over.
        if (tiles[i]!.block || roadMask[i] || occupied[i] || nodeMask[i]) continue;
        const art = th.id === "bone" ? ART.bones : th.id === "void" ? ART.crystal : th.id === "ashen" ? ART.roughRed : th.trees ? ART.flowers : th.grounds[2].art;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy, j = at(xx, yy);
          if (!inside(xx, yy) || tiles[j]!.block || roadMask[j] || occupied[j] || tiles[j]!.layers?.length || hash2(xx, yy, seed + 64) < 0.4) continue;
          tiles[j] = { ...tiles[j]!, sprite: pickArt(art, xx, yy, 65) };
        }
        if (th.id !== "frost" && rng() < 0.25 && !nodeMask[i] && !npcTile.has(i) && !tiles[i]!.portal) flat(x, y, pick(ART.mold));
      }
    }
  }

  // Map edges are always solid.
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) tiles[at(x, y)] = { ...tiles[at(x, y)]!, block: 1 };
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) tiles[at(x, y)] = { ...tiles[at(x, y)]!, block: 1 };
  for (const t of tiles) if (!t.layers) delete t.layers;

  const counts = cities.reduce<Record<string, number>>((m, c) => ((m[c.kind] = (m[c.kind] ?? 0) + 1), m), {});
  const map: MapFile = {
    version: MAP_VERSION, id: opts.id, name: opts.name, w, h, tileSize: TILE, tiles, kind: "world",
    spawns, zones, interactables, npcs, quests, regions, spawn: { tx: spawn.x, ty: spawn.y },
    intro: opts.intro ?? `Welcome to ${opts.name}.\n\n${conts.length} lands lie across the sea: ${conts.map((c) => c.name).join(", ")}.\n\nYou wake in ${home?.name ?? "the first town"}. The roads lead between towns; the ferries cross the sea. Talk to the people you meet: they know where to go next.`,
    notes: `Generated with seed ${seed}. ${Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(", ")}. Edit freely in the Map Builder.`,
  };
  // Last word: every quest must be finishable. Fixes what it can, drops what it cannot.
  repairQuests(map, { idPrefix: id("qfix") });
  return map;
}

// ---------------------------------------------------------------------------
// Enemy coverage
// ---------------------------------------------------------------------------

/** No reachable stretch of wild land should be further than this (in tiles) from a monster camp. */
export const COVERAGE_RADIUS = 18;
const FL_WALL = 1, FL_WATER = 2, FL_LAVA = 11;
type CoverageMap = Pick<MapFile, "id" | "w" | "h" | "tiles" | "zones" | "regions" | "spawn">;
const NUDGES: [number, number][] = [];
for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) NUDGES.push([x, y]);
NUDGES.sort((a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2));

/**
 * Adds monster camps wherever reachable land has none nearby. Camps are only placed where a clean
 * 10×10 square fits (8×8 or 6×6 in tight spots), so sparse worlds still had big empty stretches; this pass
 * walks the reachable land and drops a camp into every gap. Each new camp borrows its kinds of foe and
 * its levels from the nearest existing camp, so the land keeps its character. Deterministic for a map
 * (same map, same camps), safe to run again (it adds nothing to a covered map), and it never touches
 * towns, resource sites, landmarks or other camps. Returns how many camps it added.
 */
export function ensureEnemyCoverage(map: CoverageMap): number {
  let h = 2166136261;
  for (const c of map.id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ensureCoverage(map, h >>> 0);
}

function ensureCoverage(map: CoverageMap, seed: number): number {
  const { w, h, tiles } = map;
  const zones = (map.zones = map.zones ?? []);
  if (!w || !h || tiles.length < w * h || !map.spawn) return 0;
  const N = w * h;
  const at = (x: number, y: number) => y * w + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  const open = (i: number) => { const t = tiles[i]; return !!t && !t.block && t.floor !== FL_WATER && t.floor !== FL_WALL && t.floor !== FL_LAVA; };
  // Reachable from the spawn on foot or by ferry (portals within this map).
  const reach = new Uint8Array(N);
  const s0 = at(Math.max(0, Math.min(w - 1, map.spawn.tx)), Math.max(0, Math.min(h - 1, map.spawn.ty)));
  const q = [s0];
  reach[s0] = 1;
  for (let k = 0; k < q.length; k++) {
    const i = q[k]!, x = i % w, y = (i / w) | 0;
    const next: [number, number][] = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    const pt = tiles[i]!.portal;
    if (pt && pt.map === map.id && pt.tx !== undefined && pt.ty !== undefined) next.push([pt.tx, pt.ty]);
    for (const [nx, ny] of next) {
      if (!inside(nx, ny)) continue;
      const j = at(nx, ny);
      if (reach[j] || !open(j)) continue;
      reach[j] = 1;
      q.push(j);
    }
  }
  // Towns, resource sites and landmarks stay clear, as do existing camps (with a one-tile gap).
  const blocked = new Uint8Array(N);
  const stamp = (r: { tx: number; ty: number; tw: number; th: number }, pad: number) => {
    for (let y = r.ty - pad; y < r.ty + r.th + pad; y++) for (let x = r.tx - pad; x < r.tx + r.tw + pad; x++) if (inside(x, y)) blocked[at(x, y)] = 1;
  };
  for (const r of map.regions ?? []) if (r.kind === "city" || r.kind === "resource" || r.kind === "landmark" || r.kind === "dungeon") stamp(r, 1);
  for (const z of zones) stamp(z, 1);
  const covered = new Uint8Array(N);
  const R = COVERAGE_RADIUS;
  const cover = (cx: number, cy: number) => {
    for (let y = cy - R; y <= cy + R; y++) for (let x = cx - R; x <= cx + R; x++) if (inside(x, y) && (x - cx) ** 2 + (y - cy) ** 2 <= R * R) covered[at(x, y)] = 1;
  };
  for (const z of zones) cover(z.tx + (z.tw >> 1), z.ty + (z.th >> 1));
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0 || 1);
  const cand: number[] = [];
  for (let y = 2; y < h - 2; y += 5) for (let x = 2; x < w - 2; x += 5) { const i = at(x, y); if (reach[i] && !covered[i]) cand.push(i); }
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = cand[i]!; cand[i] = cand[j]!; cand[j] = t; }
  const ids = new Set(zones.map((z) => z.id));
  const base = zones.filter((z) => !z.id.startsWith("ruin-") && z.species.length);
  const nearest = (x: number, y: number) => {
    let best: SpawnZone | null = null, bd = Infinity;
    for (const z of base) { const d = (z.tx + z.tw / 2 - x) ** 2 + (z.ty + z.th / 2 - y) ** 2; if (d < bd) { bd = d; best = z; } }
    return best;
  };
  const fits = (zx: number, zy: number, size: number) => {
    if (zx < 1 || zy < 1 || zx + size >= w - 1 || zy + size >= h - 1) return false;
    let ok = 0, rch = 0;
    for (let y = zy; y < zy + size; y++) for (let x = zx; x < zx + size; x++) {
      const i = at(x, y);
      if (blocked[i]) return false;
      if (open(i)) ok++;
      if (reach[i]) rch++;
    }
    return ok >= size * size * 0.75 && rch >= Math.max(10, size * size * 0.5);
  };
  let added = 0;
  const budget = Math.max(0, LIMITS.zones - zones.length - 10);
  for (const i of cand) {
    if (added >= budget) break;
    if (covered[i]) continue;
    const cx = i % w, cy = (i / w) | 0;
    let spot: { x: number; y: number; size: number } | null = null;
    // Every nudge within 6 tiles, nearest first, so a second run finds nothing the first one missed.
    for (const size of [10, 8, 6]) {
      for (const [ox, oy] of NUDGES) {
        const zx = cx + ox - (size >> 1), zy = cy + oy - (size >> 1);
        if (fits(zx, zy, size)) { spot = { x: zx, y: zy, size }; break; }
      }
      if (spot) break;
    }
    if (!spot) continue;
    const near = nearest(cx, cy);
    const species = near?.species.length ? near.species.slice() : ["wisp", "onibi"];
    const lo = near?.levelMin ?? 1, hi = Math.max(lo, near?.levelMax ?? 5);
    const animals = species.every((sp) => !!ANIMAL_BY_ID[sp]);
    let n = 0, id = "";
    do id = `cover-${n++}`; while (ids.has(id));
    ids.add(id);
    const z: SpawnZone = { id, tx: spot.x, ty: spot.y, tw: spot.size, th: spot.size, levelMin: lo, levelMax: hi, species, count: animals ? 3 : spot.size >= 8 ? 2 + Math.floor(rng() * 2) : 2, respawn: 45 + Math.floor(rng() * 60) };
    zones.push(z);
    stamp(z, 1);
    cover(spot.x + (spot.size >> 1), spot.y + (spot.size >> 1));
    added++;
  }
  return added;
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

/** Options for a full main world: big, many lands, a story, all random from the seed. */
export function mainWorldOptions(seed: number, name = "New World", id = "newworld"): WorldGenOptions {
  const r = mulberry32((seed >>> 0) || 1);
  return { id, name, seed, w: 500, h: 500, continentCount: 4 + Math.floor(r() * 5), citiesPerContinent: 2 + Math.floor(r() * 4), islands: 4 + Math.floor(r() * 18), story: true };
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

// ---------------------------------------------------------------------------
// Dungeon generator: rifts, the Tiny Crypt and the Ash Kiln
// ---------------------------------------------------------------------------
//
// The same art pack and seeded RNG as the world generator, used for the small instanced dungeons.
// A layout is a pure function of (kind, seed, level, day): the engine feeds it the in-game day, so every
// dungeon, rift and the Crypt has a new layout and a new set of foes each day and keeps it for the day.

export type DungeonKind = "rift" | "crypt" | "kiln";
export type DungeonGenOptions = {
  kind: DungeonKind;
  seed: number;
  /** Foe level for rifts (crypt and kiln have their own level ladders). */
  level?: number;
  /** In-game day, folded into the seed by dungeonSeed(). */
  day?: number;
  /** Spawn id prefix for the rooms' foes. Rifts use `d-<seed>`. */
  idPrefix?: string;
};

/** Mixes a base seed, the in-game day and a salt into a fresh 32-bit seed. Same inputs, same dungeon. */
export function dungeonSeed(base: number, day: number | undefined, salt = 0): number {
  let h = ((base | 0) ^ 0x9e3779b9) >>> 0;
  for (const v of [(day ?? 0) | 0, salt | 0]) {
    h = Math.imul(h ^ ((v + 0x7f4a7c15) | 0), 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
  }
  return h >>> 0;
}

type DungeonTheme = {
  id: string;
  floor: string[];
  wall: string[];
  rock: string[];
  /** Floor and biome codes the engine understands (never 1 or 2: those are water). */
  floorCode: number;
  biome: number;
  /** Foe species that live here. */
  pool: string[];
  /** Props laid over the floor, and over wall faces. */
  props: string[];
};

const DUNGEON_THEMES: DungeonTheme[] = [
  { id: "catacomb", floor: [...ART.tomb, ...ART.crypt, ...ART.bones.slice(0, 6)], wall: ART.catacombs, rock: ART.stoneDark, floorCode: FL.bone, biome: BI.bone, pool: ["gaikotsu", "muma", "yami", "kage", "umoregi"], props: [...ART.sarcophagus, ...ART.columns, ...ART.darkStatues] },
  { id: "ember", floor: ART.volcanic, wall: ART.volcanicWall, rock: ART.brickDark, floorCode: FL.ash, biome: BI.ashen, pool: ["onibi", "nobi", "hinotama", "kagaribi", "tsuchi"], props: [...ART.boulder, ...ART.pillar, ...ART.darkAltars] },
  { id: "frostvault", floor: [...ART.ice, ...ART.snow.slice(0, 6)], wall: ART.stoneGray, rock: ART.cobaltRock, floorCode: FL.snow, biome: BI.frost, pool: ["yuki", "shizuku", "kaze", "hikari", "raiju"], props: [...ART.columns, ...ART.statues.slice(0, 4), ...ART.pedestal] },
  { id: "sunken", floor: [...ART.bog, ...ART.mud, ...ART.moss], wall: ART.vineWall, rock: ART.vineBrick, floorCode: FL.bog, biome: BI.tide, pool: ["shizuku", "nami", "uroko", "kasa", "mokuzu", "wisp"], props: [...ART.mold, ...ART.boulder, ...ART.mangrove] },
  { id: "crystal", floor: ART.crystal, wall: ART.crystalWall, rock: ART.cobaltRock, floorCode: FL.void, biome: BI.void, pool: ["kage", "yomi", "naraku", "yami", "hikari"], props: [...ART.orb, ...ART.pillar, ...ART.darkStatues] },
  { id: "sandvault", floor: [...ART.sandstone, ...ART.sandStoneFloor], wall: ART.sandWall, rock: ART.brickDark, floorCode: FL.sand, biome: BI.crown, pool: ["tsuchi", "kusa", "kaze", "raiju", "hinotama"], props: [...ART.columns, ...ART.statues.slice(0, 5), ...ART.boxes] },
  { id: "marblehall", floor: [...ART.marble, ...ART.etched], wall: ART.marbleWall, rock: ART.stoneBrick, floorCode: FL.stone, biome: BI.crown, pool: ["hikari", "yami", "kaze", "raiju", "tsuchi"], props: [...ART.altars, ...ART.statues, ...ART.pillar] },
];
const THEME_BY_ID = Object.fromEntries(DUNGEON_THEMES.map((t) => [t.id, t])) as Record<string, DungeonTheme>;

type DRoom = { x: number; y: number; w: number; h: number; shape: "rect" | "round" | "cross" | "notch"; cells: [number, number][]; cx: number; cy: number };

/** Builds one dungeon. Deterministic: the same options always give the same map, spawns and entry. */
export function generateDungeon(opts: DungeonGenOptions): WorldData {
  const rng = mulberry32((opts.seed >>> 0) || 1);
  const kind = opts.kind;
  const level = Math.max(1, Math.floor(opts.level ?? 1));
  const rint = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;

  const theme = kind === "crypt" ? THEME_BY_ID.catacomb! : kind === "kiln" ? THEME_BY_ID.ember! : pick(DUNGEON_THEMES);
  const w = kind === "rift" ? rint(56, 72) : kind === "crypt" ? rint(44, 54) : rint(40, 50);
  const h = kind === "rift" ? rint(42, 52) : kind === "crypt" ? rint(32, 38) : rint(30, 36);
  const want = kind === "rift" ? rint(9, 13) : kind === "crypt" ? rint(7, 10) : rint(6, 9);
  // The engine treats the outer two tiles as wall; stay well inside.
  const lo = 3, hiX = w - 4, hiY = h - 4;

  const tiles: Tile[] = Array.from({ length: w * h }, () => ({ floor: theme.floorCode, biome: theme.biome, block: 1, decor: 0 }));
  const open = (x: number, y: number) => { if (x >= lo && y >= lo && x <= hiX && y <= hiY) tiles[y * w + x]!.block = 0; };

  // --- rooms: random rectangles that do not touch, each carved in its own shape ---
  const rooms: DRoom[] = [];
  const clash = (r: { x: number; y: number; w: number; h: number }) => rooms.some((o) => r.x < o.x + o.w + 2 && r.x + r.w + 2 > o.x && r.y < o.y + o.h + 2 && r.y + r.h + 2 > o.y);
  const bigRoom = kind === "rift" ? 13 : 11;
  for (let tries = 0; tries < 600 && rooms.length < want; tries++) {
    const rw = rint(6, bigRoom), rh = rint(5, Math.max(6, bigRoom - 3));
    const r = { x: rint(lo, hiX - rw), y: rint(lo, hiY - rh), w: rw, h: rh };
    if (r.x + r.w - 1 > hiX || r.y + r.h - 1 > hiY || clash(r)) continue;
    const shape = pick(["rect", "round", "cross", "notch", "rect"] as const);
    const cells: [number, number][] = [];
    const rx = rw / 2, ry = rh / 2, ccx = r.x + rx - 0.5, ccy = r.y + ry - 0.5;
    for (let y = r.y; y < r.y + rh; y++) for (let x = r.x; x < r.x + rw; x++) {
      const dx = x - r.x, dy = y - r.y;
      let on = true;
      if (shape === "round") on = ((x - ccx) / rx) ** 2 + ((y - ccy) / ry) ** 2 <= 1.05;
      else if (shape === "cross") on = (dx >= Math.floor(rw / 3) && dx < rw - Math.floor(rw / 3)) || (dy >= Math.floor(rh / 3) && dy < rh - Math.floor(rh / 3));
      else if (shape === "notch") on = !((dx < 2 || dx >= rw - 2) && (dy < 2 || dy >= rh - 2));
      if (on) cells.push([x, y]);
    }
    rooms.push({ ...r, shape, cells, cx: r.x + Math.floor(rw / 2), cy: r.y + Math.floor(rh / 2) });
  }
  // Safety net: a plain grid of rooms if the random placement came up short.
  if (rooms.length < 4) {
    rooms.length = 0;
    const cols = 3, rows = 2, cw = Math.floor((hiX - lo) / cols), ch = Math.floor((hiY - lo) / rows);
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const rw = Math.max(5, cw - 4), rh = Math.max(5, ch - 4);
      const x = lo + col * cw + 1, y = lo + row * ch + 1;
      const cells: [number, number][] = [];
      for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) cells.push([xx, yy]);
      rooms.push({ x, y, w: rw, h: rh, shape: "rect", cells, cx: x + Math.floor(rw / 2), cy: y + Math.floor(rh / 2) });
    }
  }
  for (const r of rooms) for (const [x, y] of r.cells) open(x, y);

  // --- corridors: a spanning tree over the rooms (nearest first) plus a few loops ---
  const dist = (a: DRoom, b: DRoom) => Math.abs(a.cx - b.cx) + Math.abs(a.cy - b.cy);
  const dig = (a: DRoom, b: DRoom) => {
    const horizontalFirst = rng() < 0.5;
    const [x0, y0, x1, y1] = [a.cx, a.cy, b.cx, b.cy];
    const hRun = (y: number) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) { open(x, y); open(x, y + 1); } };
    const vRun = (x: number) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) { open(x, y); open(x + 1, y); } };
    if (horizontalFirst) { hRun(y0); vRun(x1); } else { vRun(x0); hRun(y1); }
  };
  const start = Math.floor(rng() * rooms.length);
  const joined = new Set([start]);
  const parent = new Map<number, number>();
  while (joined.size < rooms.length) {
    let best: [number, number] | null = null, bd = Infinity;
    for (const i of joined) for (let j = 0; j < rooms.length; j++) {
      if (joined.has(j)) continue;
      const d = dist(rooms[i]!, rooms[j]!) + rng() * 4;
      if (d < bd) { bd = d; best = [i, j]; }
    }
    if (!best) break;
    dig(rooms[best[0]]!, rooms[best[1]]!);
    parent.set(best[1], best[0]);
    joined.add(best[1]);
  }
  for (let k = 0, loops = rint(1, 3); k < loops; k++) {
    const a = rint(0, rooms.length - 1), b = rint(0, rooms.length - 1);
    if (a !== b) dig(rooms[a]!, rooms[b]!);
  }

  // --- entry in one room, the guardian in the room furthest from it along the tunnels ---
  const depth = new Map<number, number>([[start, 0]]);
  const depthOf = (i: number): number => {
    if (depth.has(i)) return depth.get(i)!;
    const d = depthOf(parent.get(i) ?? start) + 1;
    depth.set(i, d);
    return d;
  };
  rooms.forEach((_, i) => depthOf(i));
  let bossAt = start;
  rooms.forEach((r, i) => { if (depth.get(i)! > depth.get(bossAt)! || (depth.get(i) === depth.get(bossAt) && dist(r, rooms[start]!) > dist(rooms[bossAt]!, rooms[start]!))) bossAt = i; });
  if (bossAt === start) bossAt = (start + 1) % rooms.length;
  const entryRoom = rooms[start]!, bossRoom = rooms[bossAt]!;

  // --- art ---
  const hash = (x: number, y: number) => (Math.imul(x + 11, 73856093) ^ Math.imul(y + 7, 19349663) ^ (opts.seed | 0)) >>> 0;
  const isFloor = (x: number, y: number) => tiles[y * w + x]?.block === 0;
  tiles.forEach((t, i) => {
    const x = i % w, y = Math.floor(i / w), n = hash(x, y);
    if (t.block) {
      const face = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx! >= 0 && y + dy! >= 0 && x + dx! < w && y + dy! < h && isFloor(x + dx!, y + dy!));
      t.sprite = face ? theme.wall[n % theme.wall.length] : theme.rock[n % theme.rock.length];
    } else {
      t.sprite = theme.floor[n % theme.floor.length];
    }
  });
  // Props: a few over the floor of rooms (never on the entry, the boss tile or a tunnel mouth).
  const keep = new Set([`${entryRoom.cx},${entryRoom.cy}`, `${bossRoom.cx},${bossRoom.cy}`]);
  rooms.forEach((r, i) => {
    if (r.cells.length < 24 || i === start) return;
    const n = Math.min(4, Math.floor(r.cells.length / 22));
    for (let k = 0; k < n; k++) {
      const [x, y] = pick(r.cells);
      const edge = x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1;
      if (keep.has(`${x},${y}`) || !edge) continue;
      tiles[y * w + x]!.layers = [pick(theme.props)];
    }
  });

  // --- foes ---
  const spawns: Spawn[] = [];
  const idPrefix = opts.idPrefix ?? (kind === "rift" ? `d-${opts.seed}` : kind);
  const level0 = kind === "crypt" ? 8 : kind === "kiln" ? 7 : level;
  const bosses = POIS.filter((p) => p.kind === "boss");
  const riftBoss = kind === "rift" ? bosses[Math.floor(rng() * bosses.length)] : null;
  if (kind === "rift" && (!riftBoss || riftBoss.kind !== "boss")) throw Error("Missing world boss");
  const bossDef = kind === "rift"
    ? Object.values(MONSTER_BY_ID).find((m) => m.template === (riftBoss as { template: number }).template) ?? MONSTER_BY_ID.onibi!
    : null;
  // Everyday foes: the theme's own, plus a few drawn from another corner of the bestiary so no two days match.
  const guests = Object.values(MONSTER_BY_ID).filter((m) => !m.animal && !m.boss && m.id !== "saintling" && !theme.pool.includes(m.id));
  const pool = [...theme.pool, ...(kind === "rift" && bossDef ? Object.values(MONSTER_BY_ID).filter((m) => m.type === bossDef.type).map((m) => m.id) : [])];
  for (let g = 0; g < 2 && guests.length; g++) pool.push(pick(guests).id);
  const roomOrder = rooms.map((_, i) => i).filter((i) => i !== start && i !== bossAt).sort((a, b) => depth.get(a)! - depth.get(b)!);
  roomOrder.forEach((ri, order) => {
    const r = rooms[ri]!;
    const count = Math.min(4, 1 + Math.floor(r.cells.length / 30) + (rng() < 0.35 ? 1 : 0));
    const lvl = kind === "rift" ? level : level0 + Math.min(4, Math.floor((order * 4) / Math.max(1, roomOrder.length)));
    for (let k = 0; k < count; k++) {
      const [x, y] = pick(r.cells);
      const def = MONSTER_BY_ID[pick(pool)] ?? MONSTER_BY_ID.onibi!;
      spawns.push({ id: `${idPrefix}-${order}-${k}`, kind: "mob", species: def.id, level: lvl, x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, template: def.template, type: def.type } as Spawn);
    }
  });
  if (kind === "rift" && bossDef && riftBoss) {
    spawns.push({ id: `${idPrefix}-boss`, kind: "mob", species: bossDef.id, boss: true, bossId: (riftBoss as { id: string }).id, level, x: (bossRoom.cx + 0.5) * TILE, y: (bossRoom.cy + 0.5) * TILE, dungeonBoss: true } as Spawn);
  } else if (kind === "crypt" || kind === "kiln") {
    spawns.push({ id: kind === "crypt" ? "bone_king" : "ash_regent", kind: "mob", species: kind === "crypt" ? "gaikotsu" : "kagaribi", boss: true, bossId: kind === "crypt" ? "bone_king" : "ash_regent", level: kind === "crypt" ? 18 : 16, template: kind === "crypt" ? 22 : 3, type: kind === "crypt" ? "ghoul" : "fire", x: (bossRoom.cx + 0.5) * TILE, y: (bossRoom.cy + 0.5) * TILE } as Spawn);
  }
  return { w, h, tiles, spawns, cache: null, entry: { x: (entryRoom.cx + 0.5) * TILE, y: (entryRoom.cy + 0.5) * TILE } };
}
