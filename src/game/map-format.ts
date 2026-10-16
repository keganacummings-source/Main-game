import type { Spawn, Tile as WorldTile, WorldData } from "./world";
import { TILE, WORLD_H, WORLD_W, MONSTER_BY_ID, ANIMAL_BY_ID, MONSTERS } from "./content";
import { findAtlasTile } from "./tile-atlas";
import { idbAll, idbAvailable, idbDelete, idbGet, idbPut, STORE_DRAFTS, STORE_MAPS } from "./idb-store";

export const MAP_VERSION = 1;

export type Portal = { map: string; tx?: number; ty?: number };
export type SpawnZone = {
  id: string;
  tx: number;
  ty: number;
  tw: number;
  th: number;
  levelMin: number;
  levelMax: number;
  species: string[];
  count: number;
  respawn: number;
};

/** Designer-placed gathering nodes, boards, arenas, shrines, etc. */
export type MapInteractable =
  | { id: string; kind: "node"; node: "ore" | "tree" | "shroom" | "fish"; tx: number; ty: number }
  | { id: string; kind: "bounty"; tx: number; ty: number; label?: string }
  | { id: string; kind: "arena"; tx: number; ty: number; label?: string }
  | { id: string; kind: "shrine"; type: string; tx: number; ty: number; name?: string }
  | { id: string; kind: "hearth"; tx: number; ty: number }
  | { id: string; kind: "dungeon"; mapId: string; tx: number; ty: number; name?: string };

export type MapQuestStep =
  | { type: "talk"; npcId: string; hint?: string }
  /** Hand items to `npcId` (default: whoever turns the quest in). The items are taken from the bag. */
  | { type: "bring"; itemId: string; count: number; npcId?: string; hint?: string }
  | { type: "kill"; count: number; species?: string; hint?: string }
  | { type: "goto"; tx: number; ty: number; radius?: number; hint?: string }
  | { type: "gather"; node: "ore" | "tree" | "shroom" | "fish"; count: number; hint?: string };

export type MapQuestReward = { kyo?: number; xp?: number; items?: { itemId: string; count: number }[] };

/**
 * A quest or story chapter. Anyone can give it (`giver`), steps run in order, and it is handed in to
 * `turnIn` (defaults to the giver). `requires` chains quests into a storyline.
 */
export type MapQuest = {
  id: string;
  name: string;
  about: string;
  giver: string;
  turnIn?: string;
  requires?: string;
  steps: MapQuestStep[];
  reward?: MapQuestReward;
  /** What the giver says when offering the quest. */
  offer?: string;
  /** What they say while it is unfinished. */
  progress?: string;
  /** What they say when it is handed in. */
  done?: string;
};

/** Legacy single-quest shape (older map files). Migrated into MapFile.quests on load. */
type LegacyNpcQuest = { id: string; name: string; about: string; rewardKyo?: number; steps: MapQuestStep[] };

/** Custom NPC for quest maps: dialogue lines and a look. Quests live in MapFile.quests. */
export type MapNpc = {
  id: string;
  name: string;
  tx: number;
  ty: number;
  role?: string;
  female?: boolean;
  lines: string[];
  /** Appearance. */
  outfit?: number;
  hair?: number;
  /** @deprecated read-only: old files stored one quest here. */
  quest?: LegacyNpcQuest;
};

export type MapTile = WorldTile & {
  sprite?: string;
  layers?: string[];
  portal?: Portal;
};
export const MAX_LAYERS = 4;
/** Most things one map may hold. Big enough for a 512×512 world with dozens of towns. */
export const LIMITS = { interactables: 8000, npcs: 500, zones: 1500, quests: 400, regions: 800 } as const;
export const DESIGNER_KEY = "turbz-designer-maps-v1";

/**
 * Designer maps saved on this device.
 *
 * Maps live in IndexedDB (no practical size limit) and are mirrored in an in-memory cache so the
 * rest of the game can read them synchronously. Older builds kept them in localStorage; those are
 * moved into IndexedDB the first time the store starts. Call initDesignerStore() once at startup.
 */
let mapCache: Map<string, MapFile> | null = null;
let idbReady = false;
const storeListeners = new Set<(event: { error?: string }) => void>();

/** Hear about saves finishing or failing in the background (the Map Builder shows these). */
export function onDesignerStore(fn: (event: { error?: string }) => void): () => void {
  storeListeners.add(fn);
  return () => storeListeners.delete(fn);
}
const emitStore = (event: { error?: string }) => { for (const fn of storeListeners) fn(event); };

function legacyMaps(): MapFile[] {
  try {
    const list = JSON.parse(localStorage.getItem(DESIGNER_KEY) ?? "[]");
    return Array.isArray(list) ? list.flatMap((m) => { try { return [parseMapJson(m)]; } catch { return []; } }) : [];
  } catch {
    return [];
  }
}

function cache(): Map<string, MapFile> {
  if (!mapCache) {
    mapCache = new Map();
    for (const m of legacyMaps()) mapCache.set(m.id, m);
  }
  return mapCache;
}

/** Loads every saved map into memory (and moves old localStorage maps into IndexedDB). Safe to call twice. */
export async function initDesignerStore(): Promise<void> {
  const c = cache();
  if (idbReady || !idbAvailable()) return;
  try {
    const rows = await idbAll<unknown>(STORE_MAPS);
    for (const row of rows) {
      try {
        const m = parseMapJson(row);
        c.set(m.id, m);
      } catch { /* skip a damaged map */ }
    }
    const legacy = legacyMaps();
    for (const m of legacy) {
      if (!rows.some((r) => (r as { id?: string })?.id === m.id)) await idbPut(STORE_MAPS, m.id, packMap(m));
    }
    if (legacy.length) localStorage.removeItem(DESIGNER_KEY);
    idbReady = true;
  } catch {
    /* IndexedDB unavailable (private mode): fall back to localStorage */
  }
}

function writeLegacy(): string | null {
  try {
    localStorage.setItem(DESIGNER_KEY, JSON.stringify([...cache().values()].map(packMap)));
    return null;
  } catch (err) {
    if (err instanceof DOMException && (err.name === "QuotaExceededError" || err.code === 22)) return "This device has no room left for the map. Export it as a JSON file instead, or delete other saved maps.";
    return err instanceof Error ? err.message : "Save failed.";
  }
}

/** Saves (or replaces) a designer map on this device. Returns an error message, or null on success. */
export function saveDesignerMap(map: MapFile): string | null {
  let clean: MapFile;
  try {
    clean = parseMapJson(map);
  } catch (err) {
    return err instanceof Error ? err.message : "Save failed.";
  }
  cache().set(clean.id, clean);
  if (idbReady) {
    idbPut(STORE_MAPS, clean.id, packMap(clean)).then(() => emitStore({}), (err) => emitStore({ error: `Saving to this device failed: ${err instanceof Error ? err.message : "unknown error"}. Export the map as a file to keep it.` }));
    return null;
  }
  const err = writeLegacy();
  if (err) cache().delete(clean.id);
  return err;
}

export function deleteDesignerMap(id: string): void {
  cache().delete(id);
  if (idbReady) void idbDelete(STORE_MAPS, id).catch(() => undefined);
  else writeLegacy();
}

/** Designer maps saved on this device. Treat the returned maps as read-only; copy one before editing it. */
export function savedMaps(): MapFile[] {
  return [...cache().values()];
}

/** The Map Builder's unsaved work, kept between visits. */
export async function saveDraft(map: MapFile): Promise<void> {
  const packed = packMap(map);
  if (idbAvailable()) {
    try {
      await idbPut(STORE_DRAFTS, "current", packed);
      return;
    } catch { /* fall back below */ }
  }
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(packed)); } catch { /* the draft is a convenience only */ }
}

export async function loadDraft(): Promise<MapFile | null> {
  if (idbAvailable()) {
    try {
      const raw = await idbGet(STORE_DRAFTS, "current");
      if (raw) return parseMapJson(raw);
    } catch { /* try the old place */ }
  }
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return parseMapJson(JSON.parse(raw));
  } catch { /* nothing usable */ }
  return null;
}
const DRAFT_KEY = "turbz-designer-draft-v1";

/** A named area: shown in the Map Builder, announced in game when you walk in, and labelled on the map. */
export type MapRegion = {
  id: string;
  name: string;
  kind: "region" | "city" | "resource" | "landmark" | "dungeon" | "water";
  tx: number;
  ty: number;
  tw: number;
  th: number;
  /** Shown under the name when announced and on hover. */
  about?: string;
  /** Suggested level range (for players and quest makers). */
  levelMin?: number;
  levelMax?: number;
};
export const REGION_KINDS: MapRegion["kind"][] = ["region", "city", "resource", "landmark", "dungeon", "water"];

export type MapFile = {
  version: number;
  id: string;
  name: string;
  w: number;
  h: number;
  tileSize: number;
  tiles: MapTile[];
  spawns?: Spawn[];
  /** Enemy camps. Foes of the chosen types appear inside the rectangle. */
  zones?: SpawnZone[];
  spawn?: { tx: number; ty: number };
  notes?: string;
  kind?: "bossroom" | "dungeon" | "world";
  /** Resource nodes, bounty boards, arenas, shrines, hearths, dungeon doors. */
  interactables?: MapInteractable[];
  /** Quest / dialogue NPCs placed on this map. */
  npcs?: MapNpc[];
  /** Quests and story chapters. */
  quests?: MapQuest[];
  /** Story text shown the first time a hunter enters. Blank line = new page. */
  intro?: string;
  /** Named areas: continents, cities, forests, mines… */
  regions?: MapRegion[];
};

export const FLOOR_COLOR: Record<number, string> = {
  0: "#3d5a3a",
  1: "#2a2220",
  2: "#2a5a7a",
  3: "#6a5a48",
  4: "#8a7048",
  5: "#c8d8e8",
  6: "#5a4038",
  7: "#2a1840",
  8: "#b8a890",
  9: "#6a6870",
  10: "#c8b070",
  11: "#c04018",
};

export function emptyMap(id: string, name: string, w: number, h: number, floor = 0, biome = 3): MapFile {
  const tiles: MapTile[] = Array.from({ length: w * h }, () => ({
    floor,
    biome,
    block: 0,
    decor: 0,
  }));
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const t = tiles[y * w + x]!;
      t.block = 1;
      t.floor = 1;
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const t = tiles[y * w + x]!;
      t.block = 1;
      t.floor = 1;
    }
  }
  return {
    version: MAP_VERSION,
    id,
    name,
    w,
    h,
    tileSize: TILE,
    tiles,
    spawns: [],
    zones: [],
    interactables: [],
    npcs: [],
    spawn: { tx: Math.floor(w / 2), ty: Math.floor(h / 2) },
  };
}

/** Tree and mangrove art. These are never scenery: a tile that wears one is a tree you can chop. */
export function isChopTreeArt(sprite: string | undefined): boolean {
  if (!sprite) return false;
  return sprite.includes("/04_Trees_and_Vegetation/tree_") || sprite.includes("/04_Trees_and_Vegetation/mangrove_");
}

export function mapToWorld(map: MapFile): WorldData {
  const tiles = map.tiles.map((t) => ({
    floor: t.floor,
    biome: t.biome,
    block: t.block,
    decor: t.decor,
    sprite: t.sprite,
    layers: t.layers ? [...t.layers] : undefined,
    portal: t.portal,
  })) as WorldTile[];
  const nodeSpawns = (map.interactables ?? [])
    .filter((it): it is Extract<MapInteractable, { kind: "node" }> => it.kind === "node")
    .map((it) => ({
      id: it.id,
      kind: "node" as const,
      node: it.node,
      x: (it.tx + 0.5) * TILE,
      y: (it.ty + 0.5) * TILE,
      level: 1,
    }));
  const taken = new Set<string>();
  for (const s of [...(map.spawns ?? []), ...nodeSpawns]) {
    if (s.kind !== "node") continue;
    taken.add(`${Math.floor(s.x / TILE)},${Math.floor(s.y / TILE)}`);
  }
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i]!;
    const layers = t.layers ?? [];
    const trees = layers.filter((l) => isChopTreeArt(l));
    const decorTree = t.decor === 1;
    if (!trees.length && !decorTree) continue;
    if (trees.length) {
      const rest = layers.filter((l) => !isChopTreeArt(l));
      t.layers = rest.length ? rest : undefined;
    }
    if (decorTree) t.decor = 0;
    if (t.block && t.floor !== 1 && t.floor !== 2 && t.floor !== 11) t.block = 0;
    const x = i % map.w, y = (i / map.w) | 0;
    const key = `${x},${y}`;
    if (taken.has(key)) continue;
    taken.add(key);
    nodeSpawns.push({ id: `tiletree-${x}-${y}`, kind: "node", node: "tree", x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, level: 1 });
  }
  return {
    w: map.w,
    h: map.h,
    tiles,
    spawns: [...(map.spawns ? map.spawns.map((s) => ({ ...s })) : []), ...nodeSpawns],
    cache: null,
  };
}

export function tileSlow(world: WorldData, x: number, y: number): number {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) return 1;
  const t = world.tiles[ty * world.w + tx] as MapTile | undefined;
  if (!t) return 1;
  if (t.sprite) {
    const a = findAtlasTile(t.sprite);
    if (a) return a.slow;
  }
  if (t.floor === 2) return 0.45;
  if (t.floor === 5) return 0.85;
  if (t.floor === 6) return 0.9;
  if (t.floor === 10) return 0.8;
  if (t.floor === 3) return 1.1;
  return 1;
}

/** Compact form for storage: a palette of distinct tiles plus [paletteIndex, runLength] pairs. */
export type PackedMap = Omit<MapFile, "tiles"> & { tiles?: undefined; tilesPacked: { palette: MapTile[]; runs: number[] } };

export function packMap(map: MapFile): PackedMap {
  const palette: MapTile[] = [];
  const index = new Map<string, number>();
  const runs: number[] = [];
  let last = -1;
  for (const t of map.tiles) {
    const key = JSON.stringify(t);
    let i = index.get(key);
    if (i === undefined) { i = palette.length; palette.push(t); index.set(key, i); }
    if (i === last) runs[runs.length - 1]!++;
    else { runs.push(i, 1); last = i; }
  }
  const { tiles: _drop, ...rest } = map;
  return { ...rest, tilesPacked: { palette, runs } };
}

/** Accepts a normal map or a packed one and returns a normal-looking object for parseMapJson. */
export function unpackMap(raw: unknown): unknown {
  const m = raw as { tilesPacked?: { palette?: MapTile[]; runs?: number[] }; tiles?: unknown; w?: number; h?: number } | null;
  const p = m?.tilesPacked;
  if (!m || !p) return raw;
  if (!Array.isArray(p.palette) || !Array.isArray(p.runs) || p.runs.length % 2 || !Number.isInteger(m.w) || !Number.isInteger(m.h) || m.w! > 512 || m.h! > 512) throw new Error("Packed map is damaged.");
  const tiles: MapTile[] = [];
  for (let i = 0; i < p.runs.length; i += 2) {
    const t = p.palette[p.runs[i]!];
    const n = p.runs[i + 1]!;
    if (!t || !Number.isInteger(n) || n < 1 || tiles.length + n > m.w! * m.h!) throw new Error("Packed map is damaged.");
    for (let k = 0; k < n; k++) tiles.push(t);
  }
  const { tilesPacked: _drop, ...rest } = m as Record<string, unknown>;
  return { ...rest, tiles };
}

export function parseMapJson(input: unknown): MapFile {
  const raw = unpackMap(input);
  if (!raw || typeof raw !== "object") throw new Error("Map file is empty or invalid.");
  const m = raw as Partial<MapFile>;
  if (typeof m.id !== "string" || !/^[a-z0-9_-]{1,80}$/i.test(m.id) || typeof m.name !== "string" || !m.name.trim()) throw new Error("Map needs a name and a file ID using letters, numbers, dashes or underscores.");
  if (m.version !== MAP_VERSION) throw new Error("Unsupported map version.");
  if (!Number.isInteger(m.w) || !Number.isInteger(m.h) || m.w! < 4 || m.h! < 4 || m.w! > 512 || m.h! > 512) throw new Error("Map dimensions must be whole numbers from 4 to 512.");
  if (m.tileSize !== TILE) throw new Error(`Tile size must be ${TILE}.`);
  if (!Array.isArray(m.tiles) || m.tiles.length !== m.w! * m.h!) throw new Error("Tile count must match the map dimensions.");
  const tiles = m.tiles.map((t) => {
    if (!t || !Number.isInteger(t.floor) || t.floor < 0 || t.floor > 11 || !Number.isInteger(t.biome) || t.biome < 0 || t.biome > 6 || ![0, 1].includes(t.block) || !Number.isInteger(t.decor) || t.decor < 0 || t.decor > 100) throw new Error("Invalid map tile.");
    if (t.sprite && (typeof t.sprite !== "string" || !/^\/MapAssets\/[A-Za-z0-9_/-]+\.png$/.test(t.sprite) || t.sprite.includes(".."))) throw new Error("Tile sprite must come from MapAssets.");
    const asset = (v: unknown) => typeof v === "string" && /^\/MapAssets\/[A-Za-z0-9_/-]+\.png$/.test(v) && !v.includes("..");
    if (t.layers !== undefined && (!Array.isArray(t.layers) || t.layers.length > MAX_LAYERS || !t.layers.every(asset))) throw new Error("Tile layers must be up to 4 MapAssets sprites.");
    if (t.portal !== undefined && (!t.portal || typeof t.portal.map !== "string" || !/^[a-z0-9_-]{1,80}$/i.test(t.portal.map) || (t.portal.tx !== undefined && !Number.isInteger(t.portal.tx)) || (t.portal.ty !== undefined && !Number.isInteger(t.portal.ty)))) throw new Error("Invalid portal.");
    return {
      floor: t.floor, biome: t.biome, block: t.block, decor: t.decor,
      ...(t.sprite ? { sprite: t.sprite } : {}),
      ...(t.layers?.length ? { layers: [...t.layers] } : {}),
      ...(t.portal ? { portal: { map: t.portal.map, ...(t.portal.tx !== undefined ? { tx: t.portal.tx, ty: t.portal.ty } : {}) } } : {}),
    };
  });
  const spawn = m.spawn ?? { tx: 1, ty: 1 };
  if (!Number.isInteger(spawn.tx) || !Number.isInteger(spawn.ty) || spawn.tx < 0 || spawn.ty < 0 || spawn.tx >= m.w! || spawn.ty >= m.h! || tiles[spawn.ty * m.w! + spawn.tx]!.block) throw new Error("Start tile must be walkable and on the map.");
  if (m.notes !== undefined && typeof m.notes !== "string") throw new Error("Notes must be text.");
  if (m.kind !== undefined && !["bossroom", "dungeon", "world"].includes(m.kind)) throw new Error("Map kind must be world, dungeon, or bossroom.");
  const ids = new Set<string>();
  const spawns = (Array.isArray(m.spawns) ? m.spawns : []).map((s) => {
    if (!s || typeof s.id !== "string" || !s.id || ids.has(s.id) || !["mob", "node"].includes(s.kind) || !Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isInteger(s.level) || s.level < 1 || s.level > 1000 || tiles[Math.floor(s.y / TILE) * m.w! + Math.floor(s.x / TILE)]!.block) throw new Error("Invalid or blocked entity spawn.");
    if (s.kind === "mob" && (!s.species || !(MONSTER_BY_ID[s.species] || ANIMAL_BY_ID[s.species]))) throw new Error("Unknown enemy species.");
    if (s.kind === "node" && !["ore", "tree", "shroom", "fish"].includes(s.node ?? "")) throw new Error("Unknown resource node.");
    if (s.boss !== undefined && typeof s.boss !== "boolean") throw new Error("Invalid boss flag.");
    ids.add(s.id);
    return { ...s };
  });
  return {
    version: MAP_VERSION,
    id: typeof m.id === "string" ? m.id.slice(0, 80) : "custom",
    name: typeof m.name === "string" ? m.name.slice(0, 100) : "Custom Map",
    w: m.w!,
    h: m.h!,
    tileSize: TILE,
    tiles,
    spawns,
    zones: parseZones(m.zones, m.w!, m.h!),
    interactables: parseInteractables(m.interactables, m.w!, m.h!),
    ...questsAndNpcs(m, m.w!, m.h!),
    regions: parseRegions(m.regions, m.w!, m.h!),
    spawn,
    ...(typeof m.intro === "string" && m.intro.trim() ? { intro: m.intro.slice(0, 4000) } : {}),
    notes: typeof m.notes === "string" ? m.notes.slice(0, 2000) : undefined,
    kind: ["bossroom", "dungeon", "world"].includes(m.kind ?? "") ? m.kind : "world",
  };
}

const NODE_KINDS = ["ore", "tree", "shroom", "fish"];
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : undefined);

function parseStep(s: unknown): MapQuestStep {
  if (!s || typeof s !== "object") throw new Error("Invalid quest step.");
  const step = s as MapQuestStep;
  const hint = clip(step.hint, 120);
  if (step.type === "talk") return { type: "talk", npcId: String(step.npcId || "").slice(0, 40), hint };
  if (step.type === "bring") return { type: "bring", itemId: String(step.itemId || "").slice(0, 40), count: Math.max(1, Math.min(99, Math.floor(Number(step.count)) || 1)), ...(step.npcId ? { npcId: String(step.npcId).slice(0, 40) } : {}), hint };
  if (step.type === "kill") return { type: "kill", count: Math.max(1, Math.min(50, Math.floor(Number(step.count)) || 1)), species: step.species ? String(step.species).slice(0, 40) : undefined, hint };
  if (step.type === "goto") return { type: "goto", tx: Math.floor(Number(step.tx)) || 0, ty: Math.floor(Number(step.ty)) || 0, radius: Math.max(1, Math.min(12, Math.floor(Number(step.radius)) || 2)), hint };
  if (step.type === "gather") return { type: "gather", node: (NODE_KINDS.includes(step.node) ? step.node : "ore") as "ore", count: Math.max(1, Math.min(20, Math.floor(Number(step.count)) || 1)), hint };
  throw new Error("Unknown quest step type.");
}

function parseQuests(raw: unknown, legacy: { giver: string; quest: LegacyNpcQuest }[]): MapQuest[] {
  if (raw != null && (!Array.isArray(raw) || raw.length > LIMITS.quests)) throw new Error(`Invalid quests (maximum ${LIMITS.quests}).`);
  const ids = new Set<string>();
  const out: MapQuest[] = [];
  const add = (q: Partial<MapQuest> & { id?: unknown; name?: unknown }) => {
    if (typeof q.id !== "string" || !/^[a-z0-9_-]{1,40}$/i.test(q.id) || ids.has(q.id)) throw new Error("Quests need unique ids (letters, numbers, dashes).");
    if (typeof q.name !== "string" || !q.name.trim()) throw new Error("Every quest needs a name.");
    ids.add(q.id);
    const steps = (Array.isArray(q.steps) ? q.steps.slice(0, 16) : []).map(parseStep);
    const r = q.reward;
    const items = Array.isArray(r?.items) ? r!.items!.slice(0, 6).filter((i) => i && typeof i.itemId === "string" && i.itemId).map((i) => ({ itemId: i.itemId.slice(0, 40), count: Math.max(1, Math.min(99, Math.floor(Number(i.count)) || 1)) })) : [];
    const kyo = Math.max(0, Math.min(99999, Math.floor(Number(r?.kyo)) || 0));
    const xp = Math.max(0, Math.min(99999, Math.floor(Number(r?.xp)) || 0));
    out.push({
      id: q.id,
      name: q.name.slice(0, 60),
      about: clip(q.about, 400) ?? "",
      giver: clip(q.giver, 40) ?? "",
      ...(q.turnIn ? { turnIn: clip(q.turnIn, 40) } : {}),
      ...(q.requires ? { requires: clip(q.requires, 40) } : {}),
      steps,
      ...(kyo || xp || items.length ? { reward: { ...(kyo ? { kyo } : {}), ...(xp ? { xp } : {}), ...(items.length ? { items } : {}) } } : {}),
      ...(q.offer ? { offer: clip(q.offer, 300) } : {}),
      ...(q.progress ? { progress: clip(q.progress, 300) } : {}),
      ...(q.done ? { done: clip(q.done, 300) } : {}),
    });
  };
  for (const q of (raw ?? []) as MapQuest[]) {
    if (!q || typeof q !== "object") throw new Error("Invalid quest.");
    add(q);
  }
  for (const { giver, quest } of legacy) {
    let id = quest.id;
    while (ids.has(id)) id += "_";
    add({ id, name: quest.name, about: quest.about, giver, steps: quest.steps, reward: quest.rewardKyo ? { kyo: quest.rewardKyo } : undefined });
  }
  return out;
}

function questsAndNpcs(m: Partial<MapFile>, w: number, h: number): { npcs: MapNpc[]; quests: MapQuest[] } {
  const legacy: { giver: string; quest: LegacyNpcQuest }[] = [];
  const npcs = parseNpcs(m.npcs, w, h, legacy);
  return { npcs, quests: parseQuests(m.quests, legacy) };
}

function parseInteractables(raw: unknown, w: number, h: number): MapInteractable[] {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > LIMITS.interactables) throw new Error(`Invalid interactables (maximum ${LIMITS.interactables}).`);
  const ids = new Set<string>();
  const inMap = (tx: number, ty: number) => Number.isInteger(tx) && Number.isInteger(ty) && tx >= 0 && ty >= 0 && tx < w && ty < h;
  return raw.map((row) => {
    if (!row || typeof row !== "object") throw new Error("Invalid interactable.");
    const it = row as MapInteractable;
    if (typeof it.id !== "string" || !it.id || ids.has(it.id)) throw new Error("Interactables need unique ids.");
    ids.add(it.id);
    if (!inMap(it.tx, it.ty)) throw new Error("Interactable is outside the map.");
    if (it.kind === "node") {
      if (!["ore", "tree", "shroom", "fish"].includes(it.node)) throw new Error("Unknown resource node kind.");
      return { id: it.id, kind: "node", node: it.node, tx: it.tx, ty: it.ty };
    }
    if (it.kind === "bounty") return { id: it.id, kind: "bounty", tx: it.tx, ty: it.ty, label: typeof it.label === "string" ? it.label.slice(0, 40) : undefined };
    if (it.kind === "arena") return { id: it.id, kind: "arena", tx: it.tx, ty: it.ty, label: typeof it.label === "string" ? it.label.slice(0, 40) : undefined };
    if (it.kind === "shrine") return { id: it.id, kind: "shrine", type: String(it.type || "light").slice(0, 20), tx: it.tx, ty: it.ty, name: typeof it.name === "string" ? it.name.slice(0, 40) : undefined };
    if (it.kind === "hearth") return { id: it.id, kind: "hearth", tx: it.tx, ty: it.ty };
    if (it.kind === "dungeon") {
      if (typeof it.mapId !== "string" || !/^[a-z0-9_-]{1,80}$/i.test(it.mapId)) throw new Error("Dungeon needs a valid target map id.");
      return { id: it.id, kind: "dungeon", mapId: it.mapId, tx: it.tx, ty: it.ty, name: typeof it.name === "string" ? it.name.slice(0, 40) : undefined };
    }
    throw new Error("Unknown interactable kind.");
  });
}

function parseNpcs(raw: unknown, w: number, h: number, legacy: { giver: string; quest: LegacyNpcQuest }[]): MapNpc[] {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > LIMITS.npcs) throw new Error(`Invalid NPCs (maximum ${LIMITS.npcs}).`);
  const ids = new Set<string>();
  const inMap = (tx: number, ty: number) => Number.isInteger(tx) && Number.isInteger(ty) && tx >= 0 && ty >= 0 && tx < w && ty < h;
  return raw.map((row) => {
    if (!row || typeof row !== "object") throw new Error("Invalid NPC.");
    const n = row as MapNpc;
    if (typeof n.id !== "string" || !/^[a-z0-9_-]{1,40}$/i.test(n.id) || ids.has(n.id)) throw new Error("NPCs need unique ids (letters, numbers, dashes).");
    ids.add(n.id);
    if (typeof n.name !== "string" || !n.name.trim()) throw new Error("NPC needs a name.");
    if (!inMap(n.tx, n.ty)) throw new Error("NPC is outside the map.");
    const lines = Array.isArray(n.lines) ? n.lines.filter((l) => typeof l === "string").map((l) => l.slice(0, 200)).slice(0, 12) : [];
    const quest = n.quest && typeof n.quest === "object" ? n.quest : undefined;
    legacy.push(...(quest ? [{ giver: n.id, quest }] : []));
    return {
      id: n.id,
      name: n.name.slice(0, 40),
      tx: n.tx,
      ty: n.ty,
      role: typeof n.role === "string" ? n.role.slice(0, 40) : undefined,
      female: !!n.female,
      lines: lines.length ? lines : ["…"],
      ...(Number.isInteger(n.outfit) ? { outfit: Math.max(0, Math.min(11, n.outfit!)) } : {}),
      ...(Number.isInteger(n.hair) ? { hair: Math.max(0, Math.min(11, n.hair!)) } : {}),
    };
  });
}

function parseRegions(raw: unknown, w: number, h: number): MapRegion[] {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > LIMITS.regions) throw new Error(`Invalid regions (maximum ${LIMITS.regions}).`);
  const ids = new Set<string>();
  const out: MapRegion[] = [];
  for (const row of raw) {
    const r = row as MapRegion;
    if (!r || typeof r.id !== "string" || !r.id || ids.has(r.id)) throw new Error("Areas need a unique id.");
    ids.add(r.id);
    const tx = Math.max(0, Math.min(w - 1, Math.floor(Number(r.tx)) || 0));
    const ty = Math.max(0, Math.min(h - 1, Math.floor(Number(r.ty)) || 0));
    const tw = Math.max(1, Math.min(w - tx, Math.floor(Number(r.tw)) || 1));
    const th = Math.max(1, Math.min(h - ty, Math.floor(Number(r.th)) || 1));
    const lv = (v: unknown) => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 1000 ? (v as number) : undefined);
    out.push({
      id: r.id.slice(0, 60), name: (typeof r.name === "string" && r.name.trim() ? r.name : "Unnamed area").slice(0, 60), kind: REGION_KINDS.includes(r.kind) ? r.kind : "region", tx, ty, tw, th,
      ...(typeof r.about === "string" && r.about.trim() ? { about: r.about.slice(0, 200) } : {}),
      ...(lv(r.levelMin) ? { levelMin: lv(r.levelMin) } : {}),
      ...(lv(r.levelMax) ? { levelMax: lv(r.levelMax) } : {}),
    });
  }
  return out;
}

/** The smallest named region containing a tile (cities win over the continent they sit on). */
export function regionAt(map: Pick<MapFile, "regions">, tx: number, ty: number): MapRegion | null {
  let best: MapRegion | null = null;
  for (const r of map.regions ?? []) {
    if (tx < r.tx || ty < r.ty || tx >= r.tx + r.tw || ty >= r.ty + r.th) continue;
    if (!best || r.tw * r.th < best.tw * best.th) best = r;
  }
  return best;
}

function parseZones(raw: unknown, w: number, h: number): SpawnZone[] {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > LIMITS.zones) throw new Error(`Invalid spawn zones (maximum ${LIMITS.zones}).`);
  const ids = new Set<string>();
  return raw.map((z) => {
    if (!z || typeof z !== "object") throw new Error("Invalid spawn zone.");
    const q = z as SpawnZone;
    const num = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
    if (typeof q.id !== "string" || !q.id || ids.has(q.id)) throw new Error("Spawn zones need unique ids.");
    ids.add(q.id);
    if (!num(q.tx, 0, w - 1) || !num(q.ty, 0, h - 1) || !num(q.tw, 1, w) || !num(q.th, 1, h) || q.tx + q.tw > w || q.ty + q.th > h) throw new Error("Spawn zone is outside the map.");
    if (!num(q.levelMin, 1, 1000) || !num(q.levelMax, 1, 1000) || q.levelMin > q.levelMax) throw new Error("Spawn zone levels must be from 1 to 1000.");
    if (!num(q.count, 1, 40) || !num(q.respawn, 5, 600)) throw new Error("Spawn zone count must be 1–40 and respawn 5–600 seconds.");
    if (!Array.isArray(q.species) || q.species.length > 40 || !q.species.every((id) => typeof id === "string" && !!(MONSTER_BY_ID[id] || ANIMAL_BY_ID[id]))) throw new Error("Spawn zone has an unknown enemy type.");
    return { id: q.id, tx: q.tx, ty: q.ty, tw: q.tw, th: q.th, levelMin: q.levelMin, levelMax: q.levelMax, species: [...q.species], count: q.count, respawn: q.respawn };
  });
}

/** Nodes from the designer become world spawns so gathering works. */
export function expandInteractableNodes(map: MapFile): Spawn[] {
  const out: Spawn[] = [];
  for (const it of map.interactables ?? []) {
    if (it.kind !== "node") continue;
    out.push({
      id: it.id,
      kind: "node",
      node: it.node,
      x: (it.tx + 0.5) * TILE,
      y: (it.ty + 0.5) * TILE,
      level: 1,
    });
  }
  return out;
}

/** Turn designer zones into live mob spawns on walkable tiles inside each rectangle. */
export function expandZones(map: MapFile): Spawn[] {
  const out: Spawn[] = [];
  const fallback = MONSTERS.map((m) => m.id);
  for (const z of map.zones ?? []) {
    const spots: { x: number; y: number }[] = [];
    for (let ty = z.ty; ty < z.ty + z.th; ty++) {
      for (let tx = z.tx; tx < z.tx + z.tw; tx++) {
        if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) continue;
        const t = map.tiles[ty * map.w + tx];
        if (!t || t.block || t.floor === 1 || t.floor === 2) continue;
        spots.push({ x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE });
      }
    }
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = spots[i]!;
      spots[i] = spots[j]!;
      spots[j] = tmp;
    }
    const pool = z.species.filter((id) => MONSTER_BY_ID[id] || ANIMAL_BY_ID[id]);
    const n = Math.min(z.count, spots.length);
    for (let i = 0; i < n; i++) {
      const species = (pool.length ? pool : fallback)[Math.floor(Math.random() * (pool.length || fallback.length))]!;
      const level = z.levelMin + Math.floor(Math.random() * (z.levelMax - z.levelMin + 1));
      const spot = spots[i]!;
      out.push({
        id: `${z.id}-${i}`,
        kind: "mob",
        species,
        x: spot.x,
        y: spot.y,
        level,
        fixedLevel: true,
        zone: { ...z, species: pool },
      });
    }
  }
  return out;
}

export function downloadMapFile(map: MapFile): void {
  const blob = new Blob([JSON.stringify(map, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${map.id || "map"}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function fetchMapFile(id: string): Promise<MapFile | null> {
  try {
    const res = await fetch(`/Maps/${id}.json`, { cache: "no-cache" });
    if (!res.ok) return null;
    return parseMapJson(await res.json());
  } catch {
    return null;
  }
}

export { TILE, WORLD_W, WORLD_H };

