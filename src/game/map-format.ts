import type { Spawn, Tile as WorldTile, WorldData } from "./world";
import { TILE, WORLD_H, WORLD_W, MONSTER_BY_ID, ANIMAL_BY_ID, MONSTERS } from "./content";
import { findAtlasTile } from "./tile-atlas";

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
  | { type: "bring"; itemId: string; count: number; hint?: string }
  | { type: "kill"; count: number; species?: string; hint?: string }
  | { type: "goto"; tx: number; ty: number; radius?: number; hint?: string }
  | { type: "gather"; node: "ore" | "tree" | "shroom" | "fish"; count: number; hint?: string };

/** Custom NPC for quest maps: dialogue, optional multi-step quest. */
export type MapNpc = {
  id: string;
  name: string;
  tx: number;
  ty: number;
  role?: string;
  female?: boolean;
  lines: string[];
  quest?: {
    id: string;
    name: string;
    about: string;
    rewardKyo?: number;
    steps: MapQuestStep[];
  };
};

export type MapTile = WorldTile & {
  sprite?: string;
  layers?: string[];
  portal?: Portal;
};
export const MAX_LAYERS = 4;
export const DESIGNER_KEY = "turbz-designer-maps-v1";

/** Designer maps saved on this device, keyed by id. */
export function savedMaps(): MapFile[] {
  try {
    const list = JSON.parse(localStorage.getItem(DESIGNER_KEY) ?? "[]");
    return Array.isArray(list) ? list.flatMap((m) => { try { return [parseMapJson(m)]; } catch { return []; } }) : [];
  } catch {
    return [];
  }
}

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

export function mapToWorld(map: MapFile): WorldData {
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
  return {
    w: map.w,
    h: map.h,
    tiles: map.tiles.map((t) => ({
      floor: t.floor,
      biome: t.biome,
      block: t.block,
      decor: t.decor,
      sprite: t.sprite,
      layers: t.layers,
      portal: t.portal,
    })) as WorldTile[],
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

export function parseMapJson(raw: unknown): MapFile {
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
    npcs: parseNpcs(m.npcs, m.w!, m.h!),
    spawn,
    notes: typeof m.notes === "string" ? m.notes.slice(0, 2000) : undefined,
    kind: ["bossroom", "dungeon", "world"].includes(m.kind ?? "") ? m.kind : "world",
  };
}

function parseInteractables(raw: unknown, w: number, h: number): MapInteractable[] {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > 200) throw new Error("Invalid interactables (maximum 200).");
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

function parseNpcs(raw: unknown, w: number, h: number): MapNpc[] {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > 80) throw new Error("Invalid NPCs (maximum 80).");
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
    let quest: MapNpc["quest"] | undefined;
    if (n.quest && typeof n.quest === "object") {
      const q = n.quest;
      if (typeof q.id !== "string" || typeof q.name !== "string") throw new Error("NPC quest needs id and name.");
      const steps = Array.isArray(q.steps) ? q.steps.slice(0, 12).map((s) => {
        if (!s || typeof s !== "object") throw new Error("Invalid quest step.");
        const step = s as MapQuestStep;
        if (step.type === "talk") return { type: "talk" as const, npcId: String(step.npcId || "").slice(0, 40), hint: typeof step.hint === "string" ? step.hint.slice(0, 120) : undefined };
        if (step.type === "bring") return { type: "bring" as const, itemId: String(step.itemId || "").slice(0, 40), count: Math.max(1, Math.min(99, Number(step.count) || 1)), hint: typeof step.hint === "string" ? step.hint.slice(0, 120) : undefined };
        if (step.type === "kill") return { type: "kill" as const, count: Math.max(1, Math.min(50, Number(step.count) || 1)), species: typeof step.species === "string" ? step.species.slice(0, 40) : undefined, hint: typeof step.hint === "string" ? step.hint.slice(0, 120) : undefined };
        if (step.type === "goto") return { type: "goto" as const, tx: Number(step.tx) || 0, ty: Number(step.ty) || 0, radius: Math.max(1, Math.min(12, Number(step.radius) || 2)), hint: typeof step.hint === "string" ? step.hint.slice(0, 120) : undefined };
        if (step.type === "gather") return { type: "gather" as const, node: (["ore", "tree", "shroom", "fish"].includes(step.node) ? step.node : "ore") as "ore" | "tree" | "shroom" | "fish", count: Math.max(1, Math.min(20, Number(step.count) || 1)), hint: typeof step.hint === "string" ? step.hint.slice(0, 120) : undefined };
        throw new Error("Unknown quest step type.");
      }) : [];
      quest = {
        id: q.id.slice(0, 40),
        name: q.name.slice(0, 60),
        about: typeof q.about === "string" ? q.about.slice(0, 240) : "",
        rewardKyo: typeof q.rewardKyo === "number" ? Math.max(0, Math.min(99999, Math.floor(q.rewardKyo))) : undefined,
        steps,
      };
    }
    return {
      id: n.id,
      name: n.name.slice(0, 40),
      tx: n.tx,
      ty: n.ty,
      role: typeof n.role === "string" ? n.role.slice(0, 40) : undefined,
      female: !!n.female,
      lines: lines.length ? lines : ["…"],
      ...(quest ? { quest } : {}),
    };
  });
}

function parseZones(raw: unknown, w: number, h: number): SpawnZone[] {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > 80) throw new Error("Invalid spawn zones (maximum 80).");
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
