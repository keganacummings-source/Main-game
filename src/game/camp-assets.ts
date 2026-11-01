/**
 * Pieces made in Designer Mode > Camp & Tile Asset Builder: camp furniture and map tiles.
 * Stored on this device; an exported JSON pack is how a piece ships in a game update.
 * A map tile can name the CC0 pack tile it replaces (`replaces`) and, with `live` on, is drawn in game right away.
 *
 * Tile assets can also carry gameplay properties so unique tiles can be built and placed
 * to populate the world (hold items, spawn rules, deco flag, walk-on effects).
 */
import { setTileOverrides, NEWTEX_DIR, type TileOverride } from "./tile-atlas";

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

/**
 * Two-frame animation.
 *
 * Every piece now has room for a second frame. A tile only plays it when `animated` is on, so a
 * tile you drew as a still picture stays a still picture; turn the toggle on and it loops. Frame 2
 * starts as a copy of frame 1, so turning animation on never changes what a tile looks like until
 * you actually paint the second frame.
 */
export const ANIM_FRAMES = 2;
/** Default loop speed. Slow on purpose: terrain that flickers is worse than terrain that sits still. */
export const ANIM_FPS_DEFAULT = 4;
export const ANIM_FPS_MIN = 1;
export const ANIM_FPS_MAX = 12;

/** In-game blocks the Camp & Tile builder can paint. Category id is the build-piece id. */
export const POWER_TEXTURES = [
  { id: "hellgen", label: "HellStone Power Generator" },
  { id: "battery", label: "Battery" },
  { id: "wire", label: "Wire" },
  { id: "xpgen", label: "XP Producer" },
  { id: "duplicator", label: "Duplicator" },
  { id: "logburner", label: "LogBurning Generator" },
  { id: "solar", label: "Solar Panel" },
  { id: "capacitor", label: "Capacitor" },
  { id: "blockgen", label: "BlockGenerator" },
  { id: "rockminer", label: "Rock Miner" },
  { id: "tesla", label: "Tesla Coil" },
  // Both of these are current build pieces (building.ts BUILD_PIECE_DEFS). They were missing here,
  // so the Camp & Tile builder refused their textures and the shipped power pack lost them on import.
  { id: "ghostmerger", label: "Ghost Merger" },
  { id: "gearforge", label: "GearSet Forge" },
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
  /** PNG data URL, transparent where unpainted. Frame 1 of the animation. */
  pixels: string;
  /** Frame 2, as a PNG data URL. Absent on pieces drawn before two-frame art existed. */
  pixels2?: string;
  /** Tiles: play frame 1 and frame 2 in game. Off unless you turn it on. */
  animated?: boolean;
  /** Loop speed in frames per second (ANIM_FPS_MIN..ANIM_FPS_MAX); ANIM_FPS_DEFAULT when unset. */
  animFps?: number;
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

/** Frame 2 if the piece has one, otherwise frame 1 — so a one-frame piece reads as a still loop. */
export function frameTwo(a: Pick<Asset, "pixels" | "pixels2">): string {
  return a.pixels2 && a.pixels2.startsWith("data:image/") ? a.pixels2 : a.pixels;
}

/** This piece's loop speed, clamped into range. */
export function animFpsOf(a: Pick<Asset, "animFps">): number {
  const fps = a.animFps;
  if (typeof fps !== "number" || !Number.isFinite(fps)) return ANIM_FPS_DEFAULT;
  return Math.min(ANIM_FPS_MAX, Math.max(ANIM_FPS_MIN, fps));
}

/** True when this piece should actually play in game: animation turned on and a real second frame drawn. */
export function playsAnimation(a: Pick<Asset, "animated" | "pixels" | "pixels2">): boolean {
  return !!a.animated && !!a.pixels2 && a.pixels2.startsWith("data:image/") && a.pixels2 !== a.pixels;
}

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
  // Two-frame art: a bad second frame drops back to a one-frame piece rather than failing the whole piece.
  if (a.pixels2 !== undefined && (typeof a.pixels2 !== "string" || !a.pixels2.startsWith("data:image/"))) delete a.pixels2;
  if (a.animated !== undefined && typeof a.animated !== "boolean") return false;
  if (a.animFps !== undefined && (typeof a.animFps !== "number" || !Number.isFinite(a.animFps))) return false;
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
  try {
    localStorage.setItem(ASSET_KEY, JSON.stringify(assets));
  } catch { return false; }
  // Live tile replacements start drawing right away, no reload needed.
  try { syncTileOverrides(assets); } catch { /* art must never break a save */ }
  return true;
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

/**
 * Point the game's tile loader at every live replacement in the pack.
 *
 * A tile with animation on hands over both frames and its speed; everything else hands over one
 * frame, which the loader treats exactly as it always did.
 */
export function syncTileOverrides(assets: Asset[] = loadPack()): void {
  const map: Record<string, TileOverride> = {};
  for (const a of assets) {
    if (groupOf(a) !== "tile" || !a.live || !a.replaces) continue;
    map[a.replaces] = playsAnimation(a)
      ? { a: a.pixels, b: frameTwo(a), fps: animFpsOf(a) }
      : a.pixels;
  }
  setTileOverrides(map);
}

/** The art shipped with the game for each Power block (made by scripts/sprites/power-textures.py). */
export function powerDefaultArt(slot: string): string {
  return `${NEWTEX_DIR}${slot}.png`;
}

/** What the game draws for a Power block: your live texture from the Tile Builder, else the shipped art. */
export function powerArt(slot: string): string {
  return powerTexture(slot) ?? powerDefaultArt(slot);
}

/** Where the importable copy of the shipped power art lives (Tile Builder → "Import built-in power art"). */
export const POWER_PACK_URL = `${NEWTEX_DIR}power-pack.json`;

export type PackParse = { assets: Asset[]; skipped: number };

/** Reads a pack file: a bare array of assets, or `{ assets: [...] }`. Entries that fail validation are counted and dropped. */
export function parsePack(text: string): PackParse | null {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  const list = Array.isArray(raw) ? raw : (raw && typeof raw === "object" && Array.isArray((raw as any).assets) ? (raw as any).assets : null);
  if (!list) return null;
  const assets: Asset[] = [];
  let skipped = 0;
  for (const a of list) {
    if (!validAsset(a)) { skipped++; continue; }
    assets.push({
      ...a,
      name: typeof a.name === "string" && a.name.trim() ? a.name.slice(0, 60) : "Imported",
      size: a.size === 16 || a.size === 64 ? a.size : 32,
      created: typeof a.created === "number" && Number.isFinite(a.created) ? a.created : Date.now(),
    });
  }
  return { assets, skipped };
}

/**
 * Adds `incoming` to `current`. A piece with the same id replaces the old one; everything else is added.
 * Returns the new list and how many were added or replaced.
 */
export function mergePack(current: Asset[], incoming: Asset[]): { assets: Asset[]; added: number; replaced: number } {
  const byId = new Map(current.map((a) => [a.id, a] as const));
  let added = 0, replaced = 0;
  for (const a of incoming) {
    if (byId.has(a.id)) replaced++; else added++;
    byId.set(a.id, a);
  }
  return { assets: [...byId.values()], added, replaced };
}

/** Rough size of the pack in localStorage (browsers allow about 5 MB for the whole site). */
export function packBytes(assets: Asset[]): number {
  try { return JSON.stringify(assets).length; } catch { return 0; }
}

/** Which Power block slots have a live custom texture. */
export function customPowerSlots(assets: Asset[] = loadPack()): Set<string> {
  const out = new Set<string>();
  for (const a of assets) if (groupOf(a) === "power" && a.live !== false) out.add(a.category);
  return out;
}
