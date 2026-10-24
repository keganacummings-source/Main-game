/**
 * Log building (Hardcore).
 *
 * Players spend one Log (item id "timber") to place a log tile on the world. Log tiles are solid
 * for everyone (player, followers and foes), so they can be used to build small walls. Picking a
 * log back up refunds the Log.
 *
 * A campfire makes a 15x15 tile safe zone centered on its own tile. Inside it foes cannot enter
 * or attack, the player takes no damage from foes, and followers told to wait there are protected.
 *
 * Everything here is pure data + maths so it can be unit tested without the engine.
 *
 * ─── ADDING A NEW BUILD PIECE ────────────────────────────────────────────────
 * This whole file reads from ONE list: `BUILD_PIECE_DEFS`. To add a piece:
 *
 *   1. Add its id to the `BuildPiece` union below.
 *   2. Append one object to `BUILD_PIECE_DEFS` with its `group`, `name`, `cost`
 *      and `about`. Add `kind` for a structural tile, `requires` for a mode
 *      lock, `singleton: true` for one-per-world pieces, and `preview` for
 *      a New-Textures preview URL.
 *
 * Both menus (the floating build bar and the campfire panel) pick it up with
 * no further edits — groups, hotkey order, mode filtering, cost chips and the
 * "already placed" state are all derived from the def.
 */
import { NEWTEX_DIR } from "./tile-atlas";

export const TILE_PX = 32;
export const SAFE_ZONE_TILES = 15;
const HALF = Math.floor(SAFE_ZONE_TILES / 2);
export const MAX_LOG_TILES = 800;
/** How far from the player (pixels) a log can be placed or picked up. */
export const BUILD_REACH = 112;
export const LOG_COST = { timber: 1 } as const;

/** A placed tile. Walls and closed doors are solid; floors are decorative. `open` tracks a door. */
export type TileKind = "wood" | "brick" | "stone" | "woodfloor" | "stonefloor" | "door";
export type LogTile = { map: string; tx: number; ty: number; kind?: TileKind; open?: boolean };
/** Camp furniture: beds for followers and the Ghost Box. Not solid. */
export type Furniture = { map: string; tx: number; ty: number };

export type BuildPiece =
  | "wood" | "stone" | "woodfloor" | "stonefloor" | "door"
  | "bed" | "ghostbox" | "turbzchest"
  | "hellgen" | "logburner" | "solar"
  | "battery" | "capacitor"
  | "wire" | "pipe"
  | "blockgen" | "rockminer" | "tesla" | "xpgen" | "duplicator"
  | "ghostmerger" | "gearforge";

/** Which column/section a piece sits in. Power is split so it can keep growing. */
export type BuildGroup =
  | "walls" | "floors" | "doors" | "furniture"
  | "power.gen" | "power.store" | "power.wiring" | "power.machines";

/** Mode a piece needs to appear in the menu. Missing = always available. */
export type BuildRequires = "turbz" | "turbz+newtex";

export type BuildPieceDef = {
  id: BuildPiece;
  name: string;
  about: string;
  cost: Record<string, number>;
  group: BuildGroup;
  /** Tile kind for structural pieces (walls, floors, doors). */
  kind?: TileKind;
  /** Mode gate — leave blank for base-game pieces. */
  requires?: BuildRequires;
  /** One-per-world: the Ghost Box and the Storage Chest. */
  singleton?: boolean;
  /** Preview art shown on the button when New Textures is on. */
  preview?: string;
};

/** Kinds that block movement (floors never do; a door blocks only while closed). */
export const SOLID_KINDS = new Set<TileKind>(["wood", "brick", "stone"]);
export const FLOOR_KINDS = new Set<TileKind>(["woodfloor", "stonefloor"]);
/** Every block now costs a flat 100 kyo. Beds and the Ghost Box keep their own material cost. */
export const BLOCK_KYO = 100;

const tex = (name: string) => NEWTEX_DIR + name;

// ─── THE ONE LIST TO EDIT ────────────────────────────────────────────────────
/**
 * Every build piece in the game. Order here is the hotkey order (1-9) and the
 * order pieces appear within their group in the menus.
 */
export const BUILD_PIECE_DEFS: BuildPieceDef[] = [
  // Walls
  { id: "wood", group: "walls", name: "Wooden Wall", kind: "wood", cost: { kyo: BLOCK_KYO }, about: "A solid wooden wall. Blocks everyone.", preview: tex("wood_wall.png") },
  { id: "stone", group: "walls", name: "Stone Wall", kind: "stone", cost: { kyo: BLOCK_KYO }, about: "A solid stone wall. Blocks everyone.", preview: tex("stone_wall.png") },

  // Floors
  { id: "woodfloor", group: "floors", name: "Wooden Floor", kind: "woodfloor", cost: { kyo: BLOCK_KYO }, about: "Wooden flooring. Decorative — you can walk on it.", preview: tex("wood_floor.png") },
  { id: "stonefloor", group: "floors", name: "Stone Floor", kind: "stonefloor", cost: { kyo: BLOCK_KYO }, about: "Stone flooring. Decorative — you can walk on it.", preview: tex("stone_floor.png") },

  // Doors
  { id: "door", group: "doors", name: "Door", kind: "door", cost: { kyo: BLOCK_KYO }, about: "A door. Press E beside it to open or close it.", preview: tex("wood_wall.png") },

  // Furniture
  { id: "bed", group: "furniture", name: "Bed", cost: { leather: 3, timber: 2 }, about: "Hide over a log frame. Followers you send home rest here.", preview: tex("bed.png") },
  { id: "ghostbox", group: "furniture", name: "Ghost Box", cost: { timber: 4, ore: 4 }, singleton: true, about: "Stores, manages and releases the ghosts you are not carrying. One per hunter.", preview: tex("ghostbox.png") },
  { id: "turbzchest", group: "furniture", name: "Storage Chest", cost: { kyo: 10000 }, singleton: true, requires: "turbz", about: "Stores any items safely. Its contents survive death — rebuild your camp and they are still inside. TURBZ only.", preview: tex("chest.png") },

  // Power · Generators
  { id: "hellgen", group: "power.gen", name: "HellStone Power Generator", cost: { hell_ore: 4, timber: 4 }, requires: "turbz+newtex", about: "Press E to stack Hell Ore. Burns one every 5 seconds for 10 Power on a wired Battery. Unstored Power fades.", preview: tex("hellgen.png") },
  { id: "logburner", group: "power.gen", name: "LogBurning Generator", cost: { timber: 6, rock_ore: 2 }, requires: "turbz+newtex", about: "Burns Logs for Power. Slower and weaker than the HellStone Generator (6 Power every 8s). Press E to load Logs.", preview: tex("logburner.png") },
  { id: "solar", group: "power.gen", name: "Solar Panel", cost: { sand: 8, rock_ore: 4, wire: 2 }, requires: "turbz+newtex", about: "Makes 1 Power every 4 seconds in daylight, no fuel. Nothing at night. Wire it to a Battery.", preview: tex("solar.png") },

  // Power · Storage
  { id: "battery", group: "power.store", name: "Battery", cost: { dirt: 2, sand: 2 }, requires: "turbz+newtex", about: "Stores up to 100 Power from a Generator on the same wire network.", preview: tex("battery.png") },
  { id: "capacitor", group: "power.store", name: "Capacitor", cost: { dirt: 8, sand: 8, rock_ore: 4 }, requires: "turbz+newtex", about: "A big Battery: stores up to 500 Power from Generators on the same wire network.", preview: tex("capacitor.png") },

  // Power · Wiring
  { id: "wire", group: "power.wiring", name: "Wire", cost: { wire: 1 }, requires: "turbz+newtex", about: "Carries Power between a Generator, Batteries, and machines. Craft Wire at a campfire (1 Rock Ore).", preview: tex("wire.png") },
  { id: "pipe", group: "power.wiring", name: "Pipe", cost: { rock_ore: 1 }, requires: "turbz+newtex", about: "Moves items between machines on its own: a Duplicator or Rock Miner into a Chest, a Chest into a Generator or BlockGenerator. It bends, forks and caps itself to match its neighbours. Drag to lay a line.", preview: tex("pipe.png") },

  // Power · Machines
  { id: "blockgen", group: "power.machines", name: "BlockGenerator", cost: { rock_ore: 6, timber: 6, wire: 2 }, requires: "turbz+newtex", about: "Places a Wood or Stone block on the tile in front of it every second while it has Power and material. Feed it by hand or with a Pipe. Press E to rotate or switch it off.", preview: tex("blockgen.png") },
  { id: "rockminer", group: "power.machines", name: "Rock Miner", cost: { rock_ore: 6, timber: 4, wire: 2 }, requires: "turbz+newtex", about: "Pulls one ore from the natural rock, sand or dirt tile in front of it every 3 seconds for 1 Power. Does NOT destroy the tile — infinite slow trickle. Pipe the haul into a chest.", preview: tex("rockminer.png") },
  { id: "tesla", group: "power.machines", name: "Tesla Coil", cost: { hell_ore: 3, rock_ore: 6, wire: 3 }, requires: "turbz+newtex", about: "Zaps the nearest foe within 5 tiles every 1.5 seconds for 4 Power. Wire it to a Battery.", preview: tex("tesla.png") },
  { id: "xpgen", group: "power.machines", name: "XP Producer", cost: { kyo: 10000 }, requires: "turbz+newtex", about: "Press E to spend 200 Power for the XP of about 50 kills at your level.", preview: tex("xpgen.png") },
  { id: "duplicator", group: "power.machines", name: "Duplicator", cost: { hell_ore: 6, ore: 6, timber: 6 }, requires: "turbz+newtex", about: "Press E and load any bag item. Every 5 seconds it spends 2 Power and stores one copy. Wire it to a Battery.", preview: tex("duplicator.png") },
  { id: "ghostmerger", group: "power.machines", name: "Ghost Merger", cost: { hell_ore: 6, ore: 6, timber: 4, wire: 4 }, requires: "turbz+newtex", about: "Compresses stored ghosts into a Super Ghost. Press E to shove a ghost in from your party or Ghost Box. Every 8s it burns one for 3 Power and folds its type, an ability and its known moves into the super slot. Extract the finished Super Ghost (max one worn at a time).", preview: tex("ghostmerger.png") },
  { id: "gearforge", group: "power.machines", name: "GearSet Forge", cost: { hell_ore: 8, ore: 10, wire: 4 }, requires: "turbz+newtex", about: "Melts a pile of gear into a brand-new 6-piece set with +5 enchants per piece (bypassing the normal cap). Dump ONE piece, ALL of a slot, or ALL your gear. Cast at 12 Power per piece fed (min 50). Dump 36+ pieces to roll a MegaSet.", preview: tex("gearforge.png") },
];

// ─── Derived (do not edit) ───────────────────────────────────────────────────

/** Keyed lookup. Kept as a Record for backwards compat with callers like BUILD_PIECES[piece].cost. */
export const BUILD_PIECES: Record<BuildPiece, BuildPieceDef> =
  Object.fromEntries(BUILD_PIECE_DEFS.map((d) => [d.id, d])) as Record<BuildPiece, BuildPieceDef>;

export const BUILD_PIECE_IDS: BuildPiece[] = BUILD_PIECE_DEFS.map((d) => d.id);

const GROUP_LABELS: Record<BuildGroup, string> = {
  "walls": "Walls",
  "floors": "Floors",
  "doors": "Doors",
  "furniture": "Furniture",
  "power.gen": "Power · Generators",
  "power.store": "Power · Storage",
  "power.wiring": "Power · Wiring",
  "power.machines": "Power · Machines",
};

/** Order groups appear in the menu, left-to-right / top-to-bottom. */
export const BUILD_GROUP_ORDER: BuildGroup[] = [
  "walls", "floors", "doors", "furniture",
  "power.gen", "power.store", "power.wiring", "power.machines",
];

/** How the build menu groups the pieces. Derived from BUILD_PIECE_DEFS. */
export const BUILD_GROUPS: { id: BuildGroup; label: string; pieces: BuildPiece[] }[] =
  BUILD_GROUP_ORDER.map((g) => ({
    id: g,
    label: GROUP_LABELS[g],
    pieces: BUILD_PIECE_DEFS.filter((d) => d.group === g).map((d) => d.id),
  })).filter((g) => g.pieces.length > 0);

/** TURBZ-only camp pieces (hidden from the build menu in other modes). */
export const TURBZ_ONLY_PIECES: Set<BuildPiece> = new Set(
  BUILD_PIECE_DEFS.filter((d) => d.requires === "turbz" || d.requires === "turbz+newtex").map((d) => d.id),
);

/** Hidden unless New Texture Mode is on (still also TURBZ-only). */
export const NEWTEX_ONLY_PIECES: Set<BuildPiece> = new Set(
  BUILD_PIECE_DEFS.filter((d) => d.requires === "turbz+newtex").map((d) => d.id),
);

/** True when this piece should appear in the menu for the current mode.
 * NOTE: NewTex is now always on in TURBZ, so "turbz+newtex" is equivalent to "turbz" here. */
export function isPieceAvailable(id: BuildPiece, mode: { turbz: boolean; newTex: boolean }): boolean {
  const req = BUILD_PIECES[id]?.requires;
  if (!req) return true;
  // Both gates now collapse to "turbz is on". `mode.newTex` is still passed for backwards compat
  // with older callers but is effectively redundant.
  if (req === "turbz" || req === "turbz+newtex") return mode.turbz;
  return true;
}

/** Default preview art (used when New Textures is on). Custom textures are resolved by the caller. */
export function piecePreview(id: BuildPiece): string | undefined {
  return BUILD_PIECES[id]?.preview;
}

/** True when a piece can only exist once per world. */
export function isSingleton(id: BuildPiece): boolean {
  return !!BUILD_PIECES[id]?.singleton;
}

/**
 * Build-mode hotkeys: digits 1–9 pick the first nine pieces visible in the current mode.
 * TURBZ-only / NewTex-only pieces are skipped outside their mode. X is the Remove tool.
 */
export const BUILD_HOTKEY_ORDER: BuildPiece[] = BUILD_PIECE_IDS.slice();

/** The piece a digit key picks in build mode (1-based), or null. */
export function buildHotkeyPiece(digit: number, turbz: boolean, newTex: boolean = true): BuildPiece | null {
  const list = BUILD_HOTKEY_ORDER.filter((id) => isPieceAvailable(id, { turbz, newTex }));
  return list[digit - 1] ?? null;
}

/** The name of whatever a placed camp tile is, for the build bar ("Click to pick up a Door"). */
export function pieceNameForKind(kind: TileKind | undefined): string {
  if (!kind) return "Log";
  if (kind === "brick") return "Brick Wall";
  return BUILD_PIECE_DEFS.find((d) => d.kind === kind)?.name ?? "Block";
}

/** The placeable blocks (not furniture), for the campfire build menu. */
export const BLOCK_PIECE_IDS: BuildPiece[] = BUILD_PIECE_DEFS
  .filter((d) => d.group === "walls" || d.group === "floors" || d.group === "doors")
  .map((d) => d.id);

export const MAX_BEDS = 12;
/** Duplicator: seconds between copies, Power spent on each copy, and how many copies it will hold. */
export const DUP_SECONDS = 5;
export const DUP_POWER_COST = 2;
export const DUP_STORE_MAX = 999;
export type Camp = { map: string; x: number; y: number };
export type HoldPoint = { map: string; x: number; y: number };

export const tileOf = (v: number) => Math.floor(v / TILE_PX);

export function sanitizeLogs(raw: unknown): LogTile[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: LogTile[] = [];
  for (const r of raw) {
    if (!r || typeof r.map !== "string" || !Number.isInteger(r.tx) || !Number.isInteger(r.ty) || r.tx < 0 || r.ty < 0) continue;
    const k = `${r.map}|${r.tx},${r.ty}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const valid: TileKind[] = ["wood", "brick", "stone", "woodfloor", "stonefloor", "door"];
    const kind = valid.includes(r.kind) ? (r.kind as TileKind) : undefined;
    out.push(kind ? { map: r.map, tx: r.tx, ty: r.ty, kind, ...(kind === "door" ? { open: !!r.open } : {}) } : { map: r.map, tx: r.tx, ty: r.ty });
  }
  return out.slice(-MAX_LOG_TILES);
}

/** True when a placed tile blocks movement (walls, old logs/bricks, and closed doors). */
export function tileSolid(l: LogTile): boolean {
  if (!l.kind) return true; // bare legacy logs were solid
  if (l.kind === "door") return !l.open;
  return SOLID_KINDS.has(l.kind);
}

export function sanitizeFurniture(raw: unknown, max = MAX_BEDS): Furniture[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Furniture[] = [];
  for (const r of raw) {
    if (!r || typeof r.map !== "string" || !Number.isInteger(r.tx) || !Number.isInteger(r.ty) || r.tx < 0 || r.ty < 0) continue;
    const k = `${r.map}|${r.tx},${r.ty}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ map: r.map, tx: r.tx, ty: r.ty });
  }
  return out.slice(-max);
}

/** True when the bag holds every material in `cost`. */
export function canAfford(bag: Record<string, number>, cost: Record<string, number>): boolean {
  return Object.entries(cost).every(([id, n]) => (bag[id] ?? 0) >= n);
}

/** "2 Logs, 1 Ore"-style text for a cost. */
export function costText(cost: Record<string, number>, names: Record<string, string> = {}): string {
  return Object.entries(cost).map(([id, n]) => `${n} ${names[id] ?? id}`).join(", ");
}

export function sanitizeHold(raw: unknown): HoldPoint | null {
  const h = raw as Partial<HoldPoint> | null | undefined;
  if (!h || typeof h.map !== "string" || !Number.isFinite(h.x) || !Number.isFinite(h.y)) return null;
  return { map: h.map, x: h.x as number, y: h.y as number };
}

/** Set of tile indices (ty * width + tx) that are solid because of placed blocks on `map`. */
export function solidsFor(logs: LogTile[], map: string, width: number): Set<number> {
  const s = new Set<number>();
  for (const l of logs) if (l.map === map && tileSolid(l)) s.add(l.ty * width + l.tx);
  return s;
}

/** The campfire whose safe zone covers (x, y) on `map`, or null. Square, measured in tiles. */
export function safeZoneAt(camps: readonly Camp[], map: string, x: number, y: number): Camp | null {
  const tx = tileOf(x), ty = tileOf(y);
  for (const c of camps) {
    if (c.map !== map) continue;
    if (Math.abs(tx - tileOf(c.x)) <= HALF && Math.abs(ty - tileOf(c.y)) <= HALF) return c;
  }
  return null;
}

export function zoneRect(c: Camp): { x0: number; y0: number; x1: number; y1: number } {
  const tx = tileOf(c.x), ty = tileOf(c.y);
  return { x0: (tx - HALF) * TILE_PX, y0: (ty - HALF) * TILE_PX, x1: (tx + HALF + 1) * TILE_PX, y1: (ty + HALF + 1) * TILE_PX };
}

/** Nearest point just outside a zone for something standing inside it. */
export function pushOut(c: Camp, x: number, y: number, margin = 6): { x: number; y: number } {
  const r = zoneRect(c);
  const dl = x - r.x0, dr = r.x1 - x, dt = y - r.y0, db = r.y1 - y;
  const m = Math.min(dl, dr, dt, db);
  if (m === dl) return { x: r.x0 - margin, y };
  if (m === dr) return { x: r.x1 + margin, y };
  if (m === dt) return { x, y: r.y0 - margin };
  return { x, y: r.y1 + margin };
}

export type PlaceCheck = { ok: true } | { ok: false; reason: string };

export type PlaceWorld = {
  w: number;
  h: number;
  tiles: { floor: number; block: number; decor: number }[];
  spawns: { kind: string; x: number; y: number }[];
};

export function checkPlaceLog(args: {
  world: PlaceWorld;
  map: string;
  logs: LogTile[];
  camps: readonly Camp[];
  tx: number;
  ty: number;
  player: { x: number; y: number };
  bag: Record<string, number>;
  terrainBlocked: (x: number, y: number) => boolean;
  keepClear?: { x: number; y: number }[];
  /** Materials this piece needs. Defaults to one log. */
  cost?: Record<string, number>;
  /** Furniture already standing (beds, the Ghost Box): nothing else can go on those tiles. */
  furniture?: Furniture[];
  /** Beds and the Ghost Box must stand inside a campfire's safe zone. */
  needZone?: boolean;
  /** Floors may be laid on the campfire's own tile (the fire draws on top); other pieces may not. */
  allowCampfireTile?: boolean;
  /** Allow this piece to be placed on top of an existing floor tile. */
  allowOnFloor?: boolean;
}): PlaceCheck {
  const { world, map, logs, camps, tx, ty, player, bag, terrainBlocked } = args;
  if (tx < 3 || ty < 3 || tx >= world.w - 3 || ty >= world.h - 3) return { ok: false, reason: "Too close to the edge of the world." };
  const cx = tx * TILE_PX + TILE_PX / 2, cy = ty * TILE_PX + TILE_PX / 2;
  if (Math.hypot(cx - player.x, cy - player.y) > BUILD_REACH) return { ok: false, reason: "Too far away. Move closer to build." };
  const existing = logs.find((l) => l.map === map && l.tx === tx && l.ty === ty);
  if (existing) {
    const existingFloor = existing.kind && FLOOR_KINDS.has(existing.kind);
    if (!existingFloor || !args.allowOnFloor) return { ok: false, reason: "There is already a log there." };
  }
  if (terrainBlocked(cx, cy)) return { ok: false, reason: "Something solid is already there." };
  const tile = world.tiles[ty * world.w + tx];
  if (!tile || tile.floor === 1 || tile.floor === 2) return { ok: false, reason: "You cannot build on water." };
  if (tileOf(player.x) === tx && tileOf(player.y) === ty) return { ok: false, reason: "You are standing there." };
  for (const n of world.spawns) if (n.kind === "node" && Math.hypot(n.x - cx, n.y - cy) < 26) return { ok: false, reason: "A resource is in the way." };
  if (!args.allowCampfireTile) for (const c of camps) if (c.map === map && tileOf(c.x) === tx && tileOf(c.y) === ty) return { ok: false, reason: "That is the campfire." };
  for (const p of args.keepClear ?? []) if (tileOf(p.x) === tx && tileOf(p.y) === ty) return { ok: false, reason: "Something is standing there." };
  for (const f of args.furniture ?? []) if (f.map === map && f.tx === tx && f.ty === ty) return { ok: false, reason: "Something is already built there." };
  if (args.needZone && !safeZoneAt(camps, map, cx, cy)) return { ok: false, reason: "Build this inside a campfire's safe zone." };
  const cost = args.cost ?? LOG_COST;
  const missing = Object.entries(cost).filter(([id, n]) => (bag[id] ?? 0) < n);
  if (missing.length) {
    const label: Record<string, string> = { timber: "log", ore: "ore", leather: "hide", hell_ore: "Hell Ore", rock_ore: "Rock Ore", dirt: "Dirt", sand: "Sand", wire: "Wire" };
    return { ok: false, reason: `You need ${missing.map(([id, n]) => `${n} ${label[id] ?? id}`).join(" and ")}${missing.length === 1 && missing[0]![0] === "timber" && missing[0]![1] === 1 ? ". Chop a tree first." : "."}` };
  }
  return { ok: true };
}

export function tileAt(x: number, y: number): { tx: number; ty: number } {
  return { tx: tileOf(x), ty: tileOf(y) };
}
