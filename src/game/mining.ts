/**
 * Mining (TURBZ overworld, New Texture Mode only; the engine checks that before calling in here).
 *
 * Click a solid block twice and it breaks. The block turns into its matching floor tile (stone wall → stone
 * floor, hell wall → hell floor, ...) or, when it has no matching floor, plain dirt. Breaking can drop:
 *
 *   • Hell Ore (25%)  from stone-type blocks in a hell (ashen) biome
 *   • Rock Ore (25%)  from stone-type blocks everywhere else
 *   • Dirt            from dirt ground (dug once; the tile becomes grass)
 *   • Sand            from sandstone / sand walls
 *   • Logs            from wooden blocks
 *
 * Every block that breaks also pays Mining skill XP (MINE_XP; harder rock pays more, and an ore drop pays a bonus).
 *
 * Hell / Rock Ore, Dirt and Sand only ever come from mining.
 * This file is pure (no engine, no canvas) so scripts/mining.test.mjs can check it directly.
 */
/** Same folder as NEWTEX_DIR in tile-atlas.ts (kept local so this file has no imports). */
const NEWTEX_DIR = "/MapAssets/NewTex/";

/** Floor codes the engine understands (same table as tex-world.ts / world.ts). */
const FLOOR = { stone: 3, dirt: 4, snow: 5, ash: 9, sand: 10 } as const;
/** Biome index of the hell biome (world.ts BIOMES order: void, frost, verdant, crown, bone, tide, ashen). */
export const HELL_BIOME = 6;

/** Clicks needed to break a block. */
export const MINE_HITS = 2;
/** The second click has to land within this long (ms) of the first, or the block heals back. */
export const MINE_WINDOW_MS = 5000;
/** How close (pixels from the block's centre) the hunter must stand. */
export const MINE_REACH = 3.2 * 32;
/** Drop chance for the ores. */
export const ORE_CHANCE = 0.25;

export type MineKind = "hell" | "stone" | "dirt" | "sand" | "wood";

/**
 * Mining skill XP for breaking one block, by kind. For scale, harvesting an ore node pays 14.
 * Class aptitude (e.g. the Bulwark's Mining ×2.5) and hardcore's XP boost are applied by the engine's gainSkill.
 */
export const MINE_XP: Record<MineKind, number> = { hell: 16, stone: 10, sand: 6, wood: 5, dirt: 3 };
/** Extra Mining XP when the break also drops an ore. */
export const ORE_BONUS_XP = 6;

export type MineInfo = {
  kind: MineKind;
  /** Mining skill XP this block pays when it breaks (before aptitude). */
  xp: number;
  /** Item id dropped, and the chance (0..1) of getting it. */
  drop: string;
  chance: number;
  /** What the block becomes once broken. */
  floor: { floor: number; sprite: string };
};
export type MineTile = { floor: number; biome: number; block: number; decor?: number; sprite?: string; layers?: string[]; portal?: unknown };

export const MINE_DROPS = { hell: "hell_ore", stone: "rock_ore", dirt: "dirt", sand: "sand", wood: "timber" } as const;

const NT = (n: string) => `${NEWTEX_DIR}${n}.png`;
/** New Texture Mode: each wall and the floor it leaves behind. Anything not listed falls back to dirt. */
const TEX_FLOOR: Record<string, { floor: number; sprite: string }> = {
  stone_wall: { floor: FLOOR.stone, sprite: NT("stone_floor") },
  sand_wall: { floor: FLOOR.sand, sprite: NT("sand") },
  snow_wall: { floor: FLOOR.snow, sprite: NT("snow") },
  hell_wall: { floor: FLOOR.ash, sprite: NT("hell_floor") },
  temple_wall: { floor: FLOOR.stone, sprite: NT("temple_floor") },
  wood_wall: { floor: FLOOR.stone, sprite: NT("wood_floor") },
};

const baseName = (sprite: string): string => (sprite.split("/").pop() ?? "").replace(/\.png$/i, "").toLowerCase();

/** Plain dirt floor: NewTex dirt in New Texture Mode, the classic dirt tiles otherwise. */
export function dirtFloor(sprite: string | undefined, tx: number, ty: number): { floor: number; sprite: string } {
  if (sprite && sprite.startsWith(NEWTEX_DIR)) return { floor: FLOOR.dirt, sprite: NT("dirt_floor") };
  return { floor: FLOOR.dirt, sprite: `/MapAssets/01_Floor_and_Ground_Tiles/dirt_${Math.abs(tx * 7 + ty * 13) % 3}_new.png` };
}

const WOOD = /(^|[_\W])(wood|wooden|plank|planks|log|logs|timber)([_\W\d]|$)/;
const SAND = /(sandstone|sand)/;
const DIRT = /(dirt|mud|clay)/;
/** Never mineable: liquids and anything that is really a doorway. */
const NOT_ROCK = /(lava|water|deep|swamp|ocean|shallow|portal|gate|door|stairs)/;

/**
 * What mining this tile does, or null when it cannot be mined (open ground, water, lava, portals, the world edge).
 * `tx`/`ty`/`w`/`h` are the tile position and the map size.
 */
export function mineInfo(t: MineTile | undefined, tx: number, ty: number, w: number, h: number): MineInfo | null {
  if (!t) return null;
  if (tx < 3 || ty < 3 || tx >= w - 3 || ty >= h - 3) return null;
  if (t.floor === 2 || t.floor === 11 || t.portal) return null; // water / lava
  const sprite = t.sprite ?? "";
  const name = baseName(sprite);
  if (NOT_ROCK.test(name) || t.layers?.some((l) => /portal/.test(l))) return null;
  // Dirt ground is not a wall, but it can be dug once for Dirt. It becomes grass.
  if (t.block !== 1) {
    if (DIRT.test(name)) return { kind: "dirt", xp: MINE_XP.dirt, drop: MINE_DROPS.dirt, chance: 1, floor: { floor: 0, sprite: NT("grass") } };
    return null;
  }

  const tex = TEX_FLOOR[name];
  const floor = tex ?? dirtFloor(sprite, tx, ty);
  if (WOOD.test(name)) return { kind: "wood", xp: MINE_XP.wood, drop: MINE_DROPS.wood, chance: 1, floor };
  if (SAND.test(name)) return { kind: "sand", xp: MINE_XP.sand, drop: MINE_DROPS.sand, chance: 1, floor };
  if (DIRT.test(name)) return { kind: "dirt", xp: MINE_XP.dirt, drop: MINE_DROPS.dirt, chance: 1, floor };
  if (t.biome === HELL_BIOME) return { kind: "hell", xp: MINE_XP.hell, drop: MINE_DROPS.hell, chance: ORE_CHANCE, floor };
  return { kind: "stone", xp: MINE_XP.stone, drop: MINE_DROPS.stone, chance: ORE_CHANCE, floor };
}

/** The item a break yields (or null). `roll` is a 0..1 random number. */
export function rollMineDrop(info: MineInfo, roll: number): string | null {
  return roll < info.chance ? info.drop : null;
}

/**
 * Mining skill XP for one break: the block's own XP, plus ORE_BONUS_XP when the drop is an ore
 * (`dropped` is what rollMineDrop returned).
 */
export function mineXp(info: MineInfo, dropped: string | null): number {
  return info.xp + (dropped && (info.kind === "hell" || info.kind === "stone") ? ORE_BONUS_XP : 0);
}

/** Turns a block into its floor, in place. */
export function breakBlock(t: MineTile, info: MineInfo): void {
  t.block = 0;
  t.decor = 0;
  t.floor = info.floor.floor;
  t.sprite = info.floor.sprite;
  delete t.layers;
}

/** Progress of the block currently being cracked. One at a time: cracking another block resets it. */
export type MineProgress = { map: string; i: number; hits: number; at: number };

/**
 * Registers one click on block `i`. Returns the new progress and whether this click broke it.
 * A click on a different block, or one after MINE_WINDOW_MS, starts a fresh crack.
 */
export function mineClick(prev: MineProgress | null, map: string, i: number, now: number): { progress: MineProgress | null; broke: boolean } {
  const hits = prev && prev.map === map && prev.i === i && now - prev.at <= MINE_WINDOW_MS ? prev.hits + 1 : 1;
  if (hits >= MINE_HITS) return { progress: null, broke: true };
  return { progress: { map, i, hits, at: now }, broke: false };
}
