/**
 * Editing helpers for the Map Builder: resize, flood fill, and a checker that finds mistakes
 * (a quest nobody gives, a kill step with no enemies, a door to nowhere...) before a map is shared.
 */
import { ANIMAL_BY_ID, MONSTER_BY_ID, TILE } from "./content";
import type { MapFile, MapTile } from "./map-format";

export const blankTile = (floor = 0, biome = 3): MapTile => ({ floor, biome, block: 0, decor: 0 });

/** Crop or grow a map, keeping the top-left corner. New ground copies `floor`. Entities outside are dropped. */
export function resizeMap(map: MapFile, w: number, h: number, floor = 0): MapFile {
  w = Math.max(4, Math.min(512, Math.floor(w)));
  h = Math.max(4, Math.min(512, Math.floor(h)));
  const tiles: MapTile[] = new Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) tiles[y * w + x] = x < map.w && y < map.h ? map.tiles[y * map.w + x]! : blankTile(floor);
  const inside = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < w && ty < h;
  const spawn = map.spawn && inside(map.spawn.tx, map.spawn.ty) ? map.spawn : { tx: Math.min(w - 2, 1), ty: Math.min(h - 2, 1) };
  return {
    ...map,
    w,
    h,
    tiles,
    spawn,
    spawns: (map.spawns ?? []).filter((s) => inside(Math.floor(s.x / TILE), Math.floor(s.y / TILE))),
    zones: (map.zones ?? []).filter((z) => z.tx + z.tw <= w && z.ty + z.th <= h),
    interactables: (map.interactables ?? []).filter((i) => inside(i.tx, i.ty)),
    npcs: (map.npcs ?? []).filter((n) => inside(n.tx, n.ty)),
    regions: (map.regions ?? []).filter((r) => r.tx + r.tw <= w && r.ty + r.th <= h),
  };
}

/** Indices reached by a 4-way flood fill from (tx, ty) over tiles where `same` is true. Capped for safety. */
export function floodIndices(map: MapFile, tx: number, ty: number, same: (t: MapTile) => boolean, cap = 200000): number[] {
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return [];
  const start = ty * map.w + tx;
  if (!same(map.tiles[start]!)) return [];
  const seen = new Uint8Array(map.w * map.h);
  const out: number[] = [];
  const stack = [start];
  seen[start] = 1;
  while (stack.length && out.length < cap) {
    const i = stack.pop()!;
    out.push(i);
    const x = i % map.w, y = (i / map.w) | 0;
    const next = [x > 0 ? i - 1 : -1, x < map.w - 1 ? i + 1 : -1, y > 0 ? i - map.w : -1, y < map.h - 1 ? i + map.w : -1];
    for (const n of next) if (n >= 0 && !seen[n] && same(map.tiles[n]!)) { seen[n] = 1; stack.push(n); }
  }
  return out;
}

/** Tiles the hunter can walk to from the start tile (4-way, plus portals within the same map). Water and blocked tiles stop the walk. */
export function reachable(map: MapFile): Uint8Array {
  const seen = new Uint8Array(map.w * map.h);
  const s = map.spawn;
  if (!s) return seen;
  const ok = (t: MapTile) => !t.block && t.floor !== 2;
  const start = s.ty * map.w + s.tx;
  if (!map.tiles[start] || !ok(map.tiles[start]!)) return seen;
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % map.w, y = (i / map.w) | 0;
    const next = [x > 0 ? i - 1 : -1, x < map.w - 1 ? i + 1 : -1, y > 0 ? i - map.w : -1, y < map.h - 1 ? i + map.w : -1];
    // Portals to another spot on this same map (ferries) count as a way through.
    const p = map.tiles[i]!.portal;
    if (p && p.map === map.id && p.tx !== undefined && p.ty !== undefined && p.tx >= 0 && p.ty >= 0 && p.tx < map.w && p.ty < map.h) next.push(p.ty * map.w + p.tx);
    for (const n of next) {
      if (n >= 0 && !seen[n] && ok(map.tiles[n]!)) { seen[n] = 1; stack.push(n); }
    }
  }
  return seen;
}

export type Issue = { level: "error" | "warn"; text: string };

export function validateMap(map: MapFile, knownItems?: Set<string>, knownMaps?: Set<string>): Issue[] {
  const out: Issue[] = [];
  const err = (text: string) => out.push({ level: "error", text });
  const warn = (text: string) => out.push({ level: "warn", text });
  const reach = reachable(map);
  const at = (tx: number, ty: number) => ty * map.w + tx;
  if (!map.spawn || map.tiles[at(map.spawn.tx, map.spawn.ty)]?.block) err("The start tile is blocked or missing.");
  const npcs = new Map((map.npcs ?? []).map((n) => [n.id, n]));
  const quests = new Map((map.quests ?? []).map((q) => [q.id, q]));
  for (const n of map.npcs ?? []) {
    if (map.tiles[at(n.tx, n.ty)]?.block) warn(`${n.name} stands on a blocked tile.`);
    else if (!reach[at(n.tx, n.ty)]) warn(`${n.name} cannot be reached from the start tile.`);
  }
  const nodes = new Set<string>((map.interactables ?? []).flatMap((i) => (i.kind === "node" ? [i.node] : [])));
  const hasWater = map.tiles.some((t) => t.floor === 2);
  const species = new Set<string>([...(map.spawns ?? []).flatMap((s) => (s.kind === "mob" && s.species ? [s.species] : [])), ...(map.zones ?? []).flatMap((z) => z.species)]);
  const anyFoe = (map.spawns ?? []).some((s) => s.kind === "mob") || (map.zones ?? []).length > 0;
  for (const i of map.interactables ?? []) {
    if (map.tiles[at(i.tx, i.ty)]?.block) warn(`A ${i.kind} sits on a blocked tile (${i.tx}, ${i.ty}).`);
    if (i.kind === "dungeon" && knownMaps && i.mapId !== "world" && !knownMaps.has(i.mapId)) warn(`Door to "${i.mapId}": that map is not saved on this device yet.`);
  }
  for (const [idx, t] of map.tiles.entries()) {
    if (t.portal && knownMaps && t.portal.map !== "world" && !knownMaps.has(t.portal.map)) { warn(`A portal at ${idx % map.w}, ${(idx / map.w) | 0} leads to "${t.portal.map}", which is not saved yet.`); break; }
  }
  for (const q of map.quests ?? []) {
    const L = `Quest "${q.name}"`;
    if (!npcs.has(q.giver)) err(`${L} has no giver. Pick an NPC.`);
    if (q.turnIn && !npcs.has(q.turnIn)) err(`${L} hands in to an NPC that does not exist.`);
    if (q.requires && !quests.has(q.requires)) err(`${L} requires a quest that does not exist.`);
    if (q.requires === q.id) err(`${L} requires itself.`);
    if (!q.steps.length) warn(`${L} has no steps, so it finishes the moment it is accepted.`);
    // a chain that loops back never becomes available
    const seen = new Set([q.id]);
    for (let r = q.requires; r && quests.has(r); r = quests.get(r)!.requires) {
      if (seen.has(r)) { err(`${L} is stuck in a requirement loop.`); break; }
      seen.add(r);
    }
    for (const [n, s] of q.steps.entries()) {
      const S = `${L}, step ${n + 1}`;
      if (s.type === "talk" && !npcs.has(s.npcId)) err(`${S}: talk target does not exist.`);
      if (s.type === "bring") {
        if (s.npcId && !npcs.has(s.npcId)) err(`${S}: the NPC to hand items to does not exist.`);
        if (!s.itemId) err(`${S}: pick an item.`);
        else if (knownItems && !knownItems.has(s.itemId)) err(`${S}: unknown item "${s.itemId}".`);
      }
      if (s.type === "kill") {
        if (s.species && !(MONSTER_BY_ID[s.species] || ANIMAL_BY_ID[s.species])) err(`${S}: unknown enemy "${s.species}".`);
        else if (!anyFoe) warn(`${S}: this map has no enemies or spawn zones to defeat.`);
        else if (s.species && !species.has(s.species)) warn(`${S}: no spawn on this map produces ${s.species}.`);
      }
      if (s.type === "gather" && !(s.node === "fish" ? hasWater || nodes.has("fish") : nodes.has(s.node))) warn(`${S}: no ${s.node} node on this map.`);
      if (s.type === "goto") {
        if (s.tx < 0 || s.ty < 0 || s.tx >= map.w || s.ty >= map.h) err(`${S}: the destination is outside the map.`);
        else if (!reach[at(s.tx, s.ty)]) warn(`${S}: the destination cannot be reached from the start tile.`);
      }
    }
    for (const it of q.reward?.items ?? []) if (knownItems && !knownItems.has(it.itemId)) err(`${L}: reward item "${it.itemId}" is unknown.`);
  }
  if (!anyFoe) warn("No enemies yet. Add enemy spawns or a spawn zone.");
  if (!(map.quests ?? []).length && (map.npcs ?? []).length) warn("You have NPCs but no quests. They only chat.");
  return out;
}
