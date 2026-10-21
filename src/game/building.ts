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
 */
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

export type BuildPiece = "wood" | "stone" | "woodfloor" | "stonefloor" | "door" | "bed" | "ghostbox" | "turbzchest" | "hellgen" | "battery";
/** Kinds that block movement (floors never do; a door blocks only while closed). */
export const SOLID_KINDS = new Set<TileKind>(["wood", "brick", "stone"]);
export const FLOOR_KINDS = new Set<TileKind>(["woodfloor", "stonefloor"]);
/** Every block now costs a flat 100 kyo. Beds and the Ghost Box keep their own material cost. */
export const BLOCK_KYO = 100;
/** What each camp piece costs. Walls/doors are solid; beds and the Ghost Box must stand inside a safe zone. */
export const BUILD_PIECES: Record<BuildPiece, { name: string; cost: Record<string, number>; about: string; kind?: TileKind }> = {
  wood: { name: "Wooden Wall", cost: { kyo: BLOCK_KYO }, kind: "wood", about: "A solid wooden wall. Blocks everyone." },
  stone: { name: "Stone Wall", cost: { kyo: BLOCK_KYO }, kind: "stone", about: "A solid stone wall. Blocks everyone." },
  woodfloor: { name: "Wooden Floor", cost: { kyo: BLOCK_KYO }, kind: "woodfloor", about: "Wooden flooring. Decorative — you can walk on it." },
  stonefloor: { name: "Stone Floor", cost: { kyo: BLOCK_KYO }, kind: "stonefloor", about: "Stone flooring. Decorative — you can walk on it." },
  door: { name: "Door", cost: { kyo: BLOCK_KYO }, kind: "door", about: "A door. Press E beside it to open or close it." },
  bed: { name: "Bed", cost: { leather: 3, timber: 2 }, about: "Hide over a log frame. Followers you send home rest here." },
  ghostbox: { name: "Ghost Box", cost: { timber: 4, ore: 4 }, about: "Stores, manages and releases the ghosts you are not carrying. One per hunter." },
  turbzchest: { name: "Storage Chest", cost: { kyo: 10000 }, about: "Stores any items safely. Its contents survive death — rebuild your camp and they are still inside. TURBZ only." },
  hellgen: { name: "HellStone Power Generator", cost: { kyo: 500, hell_ore: 4 }, about: "TURBZ + New Textures only. Insert Hell Ore; produces 10 Power every 5 seconds. Power dissipates unless a Battery is placed beside it." },
  battery: { name: "Battery", cost: { kyo: 300, ore: 6 }, about: "TURBZ + New Textures only. Place beside a HellStone Generator to automatically store its Power (up to 100)." },
};
/** TURBZ-only camp pieces (hidden from the build menu in other modes). Hellgen/Battery also require New Texture Mode. */
export const TURBZ_ONLY_PIECES = new Set<BuildPiece>(["turbzchest", "hellgen", "battery"]);
export const BUILD_PIECE_IDS = Object.keys(BUILD_PIECES) as BuildPiece[];
/** How the build menu and the build bar group the pieces. */
export const BUILD_GROUPS: { id: "walls" | "floors" | "doors" | "furniture" | "power"; label: string; pieces: BuildPiece[] }[] = [
  { id: "walls", label: "Walls", pieces: ["wood", "stone"] },
  { id: "floors", label: "Floors", pieces: ["woodfloor", "stonefloor"] },
  { id: "doors", label: "Doors", pieces: ["door"] },
  { id: "furniture", label: "Furniture", pieces: ["bed", "ghostbox", "turbzchest"] },
  { id: "power", label: "Power", pieces: ["hellgen", "battery"] },
];
/** Build-mode hotkeys: 1-8 pick these pieces in order (TURBZ-only pieces are skipped outside TURBZ). X is the Remove tool. */
export const BUILD_HOTKEY_ORDER: BuildPiece[] = ["wood", "stone", "woodfloor", "stonefloor", "door", "bed", "ghostbox", "turbzchest", "hellgen", "battery"];
/** The piece a digit key picks in build mode (1-based), or null. */
export function buildHotkeyPiece(digit: number, turbz: boolean): BuildPiece | null {
  const list = BUILD_HOTKEY_ORDER.filter((id) => turbz || !TURBZ_ONLY_PIECES.has(id));
  return list[digit - 1] ?? null;
}
/** The name of whatever a placed camp tile is, for the build bar ("Click to pick up a Door"). */
export function pieceNameForKind(kind: TileKind | undefined): string {
  if (!kind) return "Log";
  if (kind === "brick") return "Brick Wall";
  return BUILD_PIECE_IDS.map((id) => BUILD_PIECES[id]).find((d) => d.kind === kind)?.name ?? "Block";
}
/** The placeable blocks (not furniture), for the campfire build menu. */
export const BLOCK_PIECE_IDS: BuildPiece[] = ["wood", "stone", "woodfloor", "stonefloor", "door"];
export const MAX_BEDS = 12;
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
    const label: Record<string, string> = { timber: "log", ore: "ore", leather: "hide" };
    return { ok: false, reason: `You need ${missing.map(([id, n]) => `${n} ${label[id] ?? id}`).join(" and ")}${missing.length === 1 && missing[0]![0] === "timber" && missing[0]![1] === 1 ? ". Chop a tree first." : "."}` };
  }
  return { ok: true };
}

export function tileAt(x: number, y: number): { tx: number; ty: number } {
  return { tx: tileOf(x), ty: tileOf(y) };
}
