/**
 * Pieces made in Designer Mode > Camp & Tile Asset Builder: camp furniture and map tiles.
 * Stored on this device; an exported JSON pack is how a piece ships in a game update.
 * A map tile can name the CC0 pack tile it replaces (`replaces`) and, with `live` on, is drawn in game right away.
 *
 * Tile assets can also carry gameplay properties so unique tiles can be built and placed
 * to populate the world (hold items, spawn rules, deco flag, walk-on effects).
 */
import { setTileOverrides } from "./tile-atlas";

export const CAMP_CATEGORIES = [
  "walls", "floors", "chest", "ghostbox", "campfire", "doors", "beds",
  "decorations", "sinks", "fences", "counters", "stove", "fridge", "other",
] as const;

/** Map tile kinds. `folder` is the /MapAssets folder the pack keeps that kind in (used to find the tile to replace). */
export const TILE_CATEGORIES = [
  { id: "floor", label: "Floor tile", folder: "01_Floor_and_Ground_Tiles" },
  { id: "grass", label: "Grass / ground", folder: "01_Floor_and_Ground_Tiles" },
  { id: "wall", label: "Wall tile", folder: "02_Walls_and_Cliffs" },
  { id: "water", label: "Water", folder: "03_Water_and_Liquid_Tiles" },
  { id: "lava", label: "Lava", folder: "03_Water_and_Liquid_Tiles" },
  { id: "tree", label: "Tree / vegetation", folder: "04_Trees_and_Vegetation" },
  { id: "door", label: "Door / entrance", folder: "05_Doors_and_Entrances" },
  { id: "portal", label: "Portal / gate", folder: "06_Gates_and_Portals" },
  { id: "arena", label: "Arena / shrine / altar", folder: "07_Altars_and_Shrines" },
  { id: "statue", label: "Statue / landmark", folder: "08_Statues_and_Landmarks" },
  { id: "trap", label: "Trap / hazard", folder: "09_Traps_and_Hazards" },
  { id: "shop", label: "Shop / building", folder: "10_Shops_and_Buildings" },
  { id: "vault", label: "Vault / special area", folder: "11_Vaults_and_Special_Areas" },
  { id: "heart", label: "Heart / pickup", folder: "" },
  { id: "tile-other", label: "Other map tile", folder: "12_Dungeon_Tiles_Other" },
] as const;

export type AssetGroup = "camp" | "tile" | "power";
export type AssetSize = 16 | 32 | 64;

/** In-game blocks the Camp & Tile builder can paint. Category id is the build-piece id. */
export const POWER_TEXTURES = [
  { id: "hellgen", label: "HellStone Power Generator" },
  { id: "battery", label: "Battery" },
  { id: "wire", label: "Wire" },
  { id: "xpgen", label: "XP Producer" },
  { id: "duplicator", label: "Duplicator" },
] as const;

/** Suggested places a custom tile may spawn / appear. */
export const SPAWN_LOCATIONS = [
  "Overworld", "Dungeon", "Temple", "House", "Wilderness", "Cave", "City", "Shrine",
] as const;

/** Walk-on effects a tile can apply. */
export const WALK_EFFECTS = [
  "burn", "poison", "slow", "movementreduction", "damage", "heal", "none",
] as const;

export type Asset = {
  id: string;
  name: string;
  /** Camp pieces (old packs have no group: they are camp pieces) or map tiles. */
  group?: AssetGroup;
  category: string;
  /** PNG data URL, transparent where unpainted. */
  pixels: string;
  size: AssetSize;
  created: number;
  /** Map tiles: path of the pack tile this replaces, e.g. /MapAssets/03_Water_and_Liquid_Tiles/deep_water.png */
  replaces?: string;
  /** Map tiles: blocks movement (walls, lava, deep water). */
  solid?: boolean;
  /** Power art: draw this on the placed block in game. Defaults on for new power textures. */
  live?: boolean;

  // ─── Unique tile properties (tile group only) ───────────────────────────────────────────
  /** Can hold this many items (0 or omitted = cannot hold). */
  holdMax?: number;
  /** Item kinds / ids this tile can hold (e.g. "kyo", "ghost gear", specific item ids). Comma-separated in the UI. */
  holdItems?: string[];
  /** Places this tile is allowed / designed to spawn in. */
  spawnIn?: string[];
  /** Pure decoration — no collision, no interact, just scenery. */
  isDeco?: boolean;
  /** Effects applied when the player walks on this tile. */
  walkEffects?: string[];
};

export const ASSET_KEY = "turbz-camp-assets-v1";

export function groupOf(a: Pick<Asset, "group" | "category">): AssetGroup {
  if (a.group === "power" || a.group === "camp" || a.group === "tile") return a.group;
  if ((POWER_TEXTURES as readonly { id: string }[]).some((c) => c.id === a.category)) return "power";
  return TILE_CATEGORIES.some((c) => c.id === a.category) ? "tile" : "camp";
}

export function validAsset(a: any): a is Asset {
  if (!a || typeof a.id !== "string" || typeof a.pixels !== "string" || !a.pixels.startsWith("data:image/")) return false;
  if (typeof a.category !== "string") return false;
  const okCat = (CAMP_CATEGORIES as readonly string[]).includes(a.category)
    || TILE_CATEGORIES.some((c) => c.id === a.category)
    || (POWER_TEXTURES as readonly { id: string }[]).some((c) => c.id === a.category);
  if (!okCat) return false;
  // Optional new fields are free-form; basic type checks only.
  if (a.holdMax !== undefined && (typeof a.holdMax !== "number" || a.holdMax < 0)) return false;
  if (a.holdItems !== undefined && !Array.isArray(a.holdItems)) return false;
  if (a.spawnIn !== undefined && !Array.isArray(a.spawnIn)) return false;
  if (a.isDeco !== undefined && typeof a.isDeco !== "boolean") return false;
  if (a.walkEffects !== undefined && !Array.isArray(a.walkEffects)) return false;
  return true;
}

export function loadPack(): Asset[] {
  try {
    const raw = localStorage.getItem(ASSET_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(validAsset) : [];
  } catch { return []; }
}

export function savePack(assets: Asset[]): boolean {
  powerTexRev++;
  try { localStorage.setItem(ASSET_KEY, JSON.stringify(assets)); return true; } catch { return false; }
}

/** Bumped when the pack is saved so the game picks up new power-block art. */
let powerTexRev = 0;
let powerTexCacheRev = -1;
let powerTexCache: Record<string, string> = {};

/** Latest live pixel art for a power block (hellgen, battery, wire, xpgen, duplicator), or null. */
export function powerTexture(slot: string): string | null {
  if (powerTexCacheRev !== powerTexRev) {
    powerTexCache = {};
    powerTexCacheRev = powerTexRev;
    const list = loadPack()
      .filter((a) => groupOf(a) === "power" && a.live !== false && a.pixels.startsWith("data:image/"))
      .sort((a, b) => a.created - b.created);
    for (const a of list) powerTexCache[a.category] = a.pixels;
  }
  return powerTexCache[slot] ?? null;
}

/** Point the game's tile loader at every live replacement in the pack. */
export function syncTileOverrides(assets: Asset[] = loadPack()): void {
  const map: Record<string, string> = {};
  for (const a of assets) if (groupOf(a) === "tile" && a.live && a.replaces) map[a.replaces] = a.pixels;
  setTileOverrides(map);
}
