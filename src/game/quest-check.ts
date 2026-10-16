/**
 * Quest playability: can every quest on a map actually be finished?
 *
 * `questIssues` lists anything that would leave a hunter stuck (a giver behind a wall, a kill step for a
 * foe that never spawns, a gather step with too few nodes, a trip to a tile nobody can reach, a chain
 * that waits on a missing quest...). `repairQuests` fixes what it can in place and removes the rest, so
 * a generated (or hand-made) map never ships a quest that cannot be done.
 *
 * Pure data, so the generator, the Map Builder and the tests all share it.
 */
import { ANIMAL_BY_ID, MONSTER_BY_ID, TILE } from "./content";
import type { MapFile, MapInteractable, MapQuest, MapQuestStep } from "./map-format";

type NodeKind = "ore" | "tree" | "shroom" | "fish";
const FLOOR_WATER = 2;
const FLOOR_WALL = 1;

/** Items a gather step can put in the bag (so a "bring" step after it is possible). */
export const GATHER_YIELD: Record<string, NodeKind> = {
  timber: "tree", ore: "ore", ironroot: "ore", mushroom: "shroom", dreamspore: "shroom", embercap: "shroom", blue_lantern: "shroom", fish: "fish",
};

export type QuestIssue = { questId: string; quest: string; step: number; text: string; fatal: boolean };

type Ctx = {
  reach: Uint8Array;
  npcAt: Map<string, { tx: number; ty: number; name: string }>;
  nodes: Record<NodeKind, number>;
  shore: boolean;
  species: Set<string>;
  anyFoe: boolean;
};

/** Walkable from the start (4-way), with same-map portals (ferries) counted as a way across. */
export function questReach(map: MapFile): Uint8Array {
  const { w, h } = map;
  const seen = new Uint8Array(w * h);
  const s = map.spawn;
  if (!s) return seen;
  const ok = (i: number) => { const t = map.tiles[i]; return !!t && !t.block && t.floor !== FLOOR_WATER && t.floor !== FLOOR_WALL; };
  const start = s.ty * w + s.tx;
  if (!ok(start)) return seen;
  const stack = [start];
  seen[start] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w, y = (i / w) | 0;
    const next = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    const p = map.tiles[i]!.portal;
    if (p && p.map === map.id && p.tx !== undefined && p.ty !== undefined && p.tx >= 0 && p.ty >= 0 && p.tx < w && p.ty < h) next.push(p.ty * w + p.tx);
    for (const n of next) if (n >= 0 && !seen[n] && ok(n)) { seen[n] = 1; stack.push(n); }
  }
  return seen;
}

/** True if the tile, or a tile beside it, is one the hunter can stand on. Nodes and NPCs are used from next door. */
function touchable(map: MapFile, reach: Uint8Array, tx: number, ty: number): boolean {
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const x = tx + dx, y = ty + dy;
    if (x >= 0 && y >= 0 && x < map.w && y < map.h && reach[y * map.w + x]) return true;
  }
  return false;
}

function context(map: MapFile): Ctx {
  const reach = questReach(map);
  const npcAt = new Map<string, { tx: number; ty: number; name: string }>();
  for (const n of map.npcs ?? []) if (touchable(map, reach, n.tx, n.ty)) npcAt.set(n.id, { tx: n.tx, ty: n.ty, name: n.name });
  const nodes: Record<NodeKind, number> = { ore: 0, tree: 0, shroom: 0, fish: 0 };
  for (const it of map.interactables ?? []) if (it.kind === "node" && touchable(map, reach, it.tx, it.ty)) nodes[it.node]++;
  for (const s of map.spawns ?? []) if (s.kind === "node" && s.node && touchable(map, reach, Math.floor(s.x / TILE), Math.floor(s.y / TILE))) nodes[s.node]++;
  // Fishing works from any shore you can stand on.
  let shore = false;
  for (let i = 0; i < reach.length && !shore; i++) {
    if (!reach[i]) continue;
    const x = i % map.w, y = (i / map.w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const t = map.tiles[(y + dy) * map.w + (x + dx)];
      if (t && t.floor === FLOOR_WATER && x + dx >= 0 && x + dx < map.w) { shore = true; break; }
    }
  }
  const species = new Set<string>();
  let anyFoe = false;
  for (const z of map.zones ?? []) {
    let open = false;
    for (let y = z.ty; y < z.ty + z.th && !open; y++) for (let x = z.tx; x < z.tx + z.tw; x++) if (x >= 0 && y >= 0 && x < map.w && y < map.h && reach[y * map.w + x]) { open = true; break; }
    if (!open) continue;
    anyFoe = true;
    for (const sp of z.species) species.add(sp);
  }
  for (const s of map.spawns ?? []) {
    if (s.kind !== "mob") continue;
    if (!touchable(map, reach, Math.floor(s.x / TILE), Math.floor(s.y / TILE))) continue;
    anyFoe = true;
    if (s.species) species.add(s.species);
  }
  return { reach, npcAt, nodes, shore, species, anyFoe };
}

function nodeSupply(c: Ctx, kind: NodeKind): number {
  return kind === "fish" ? (c.shore || c.nodes.fish > 0 ? Infinity : 0) : c.nodes[kind];
}

/** Everything that would stop a quest from being finished. `fatal` issues make the quest impossible. */
export function questIssues(map: MapFile): QuestIssue[] {
  const c = context(map);
  const out: QuestIssue[] = [];
  const quests = map.quests ?? [];
  const byId = new Map(quests.map((q) => [q.id, q]));
  for (const q of quests) {
    const add = (step: number, text: string, fatal = true) => out.push({ questId: q.id, quest: q.name, step, text, fatal });
    if (!c.npcAt.has(q.giver)) add(-1, map.npcs?.some((n) => n.id === q.giver) ? "the quest giver cannot be reached" : "the quest giver does not exist");
    const turn = q.turnIn || q.giver;
    if (!c.npcAt.has(turn)) add(-1, "the hand-in NPC cannot be reached");
    if (q.requires) {
      if (!byId.has(q.requires)) add(-1, "it needs a quest that does not exist");
      const seen = new Set([q.id]);
      for (let r: string | undefined = q.requires; r && byId.has(r); r = byId.get(r)!.requires) {
        if (seen.has(r)) { add(-1, "its chain of required quests loops"); break; }
        seen.add(r);
      }
    }
    q.steps.forEach((st, i) => {
      if (st.type === "talk" && !c.npcAt.has(st.npcId)) add(i, "the person to talk to cannot be reached");
      if (st.type === "bring") {
        if (!c.npcAt.has(st.npcId || turn)) add(i, "the person to hand items to cannot be reached");
        const kind = GATHER_YIELD[st.itemId];
        if (kind && nodeSupply(c, kind) < 1) add(i, `nothing on this map gives ${st.itemId}`);
      }
      if (st.type === "kill") {
        if (!c.anyFoe) add(i, "no foe can be reached on this map");
        else if (st.species && !(MONSTER_BY_ID[st.species] || ANIMAL_BY_ID[st.species])) add(i, `unknown foe "${st.species}"`);
        else if (st.species && !c.species.has(st.species)) add(i, `no reachable spawn produces ${st.species}`);
      }
      if (st.type === "gather") {
        const have = nodeSupply(c, st.node);
        if (have < st.count) add(i, `needs ${st.count} ${st.node} nodes you can reach, the map has ${have}`);
      }
      if (st.type === "goto") {
        if (st.tx < 0 || st.ty < 0 || st.tx >= map.w || st.ty >= map.h) add(i, "the destination is off the map");
        else if (!nearReach(map, c.reach, st.tx, st.ty, Math.max(0, (st.radius ?? 2)))) add(i, "the destination cannot be reached");
      }
    });
  }
  return out;
}

function nearReach(map: MapFile, reach: Uint8Array, tx: number, ty: number, r: number): { x: number; y: number } | null {
  for (let d = 0; d <= r; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
    const x = tx + dx, y = ty + dy;
    if (x >= 0 && y >= 0 && x < map.w && y < map.h && reach[y * map.w + x] && Math.hypot(dx, dy) <= r + 0.01) return { x, y };
  }
  return null;
}

export type RepairReport = { fixed: number; removed: string[]; nodesAdded: number; notes: string[] };

/**
 * Makes every quest finishable, in place: snaps destinations to reachable ground, swaps a kill target for
 * a foe that really spawns nearby, plants extra resource nodes (one at a time, spread out) when a gather
 * step needs more than the map has, drops steps that can never work, and removes quests that cannot be
 * saved (re-linking any chain that waited on them).
 */
export function repairQuests(map: MapFile, opts: { idPrefix?: string; maxPasses?: number } = {}): RepairReport {
  const report: RepairReport = { fixed: 0, removed: [], nodesAdded: 0, notes: [] };
  map.quests = map.quests ?? [];
  map.interactables = map.interactables ?? [];
  let seq = 0;
  const nodeId = () => { let id: string; do id = `${opts.idPrefix ?? "qn"}-${(seq++).toString(36)}`; while (map.interactables!.some((i) => i.id === id)); return id; };
  for (let pass = 0; pass < (opts.maxPasses ?? 4); pass++) {
    const c = context(map);
    const taken = new Set<number>();
    for (const it of map.interactables) taken.add(it.ty * map.w + it.tx);
    for (const n of map.npcs ?? []) taken.add(n.ty * map.w + n.tx);
    const byId = new Map(map.quests.map((q) => [q.id, q]));
    const doomed = new Set<string>();
    const zoneCentres = (map.zones ?? []).map((z) => ({ x: z.tx + z.tw / 2, y: z.ty + z.th / 2, species: z.species }))
      .filter((z) => z.species.length && nearReach(map, c.reach, Math.floor(z.x), Math.floor(z.y), 6));
    let changed = false;
    for (const q of map.quests) {
      const giver = c.npcAt.get(q.giver);
      const turn = c.npcAt.get(q.turnIn || q.giver);
      if (!giver) { doomed.add(q.id); continue; }
      if (!turn) { q.turnIn = undefined; report.fixed++; changed = true; }
      if (q.requires && (!byId.has(q.requires) || q.requires === q.id)) { q.requires = undefined; report.fixed++; changed = true; }
      // Where the quest "happens": the last place a step sent you, else the giver.
      let anchor = { x: giver.tx, y: giver.ty };
      const had = q.steps.length;
      const keep: MapQuestStep[] = [];
      for (const st of q.steps) {
        if (st.type === "talk") {
          if (!c.npcAt.has(st.npcId)) { report.fixed++; changed = true; continue; }
          const n = c.npcAt.get(st.npcId)!;
          anchor = { x: n.tx, y: n.ty };
        } else if (st.type === "bring") {
          if (st.npcId && !c.npcAt.has(st.npcId)) { st.npcId = undefined; report.fixed++; changed = true; }
          const kind = GATHER_YIELD[st.itemId];
          if (kind && nodeSupply(c, kind) < 1) {
            const added = plant(map, c, kind, Math.max(3, st.count), anchor, taken, nodeId);
            report.nodesAdded += added;
            if (added) changed = true;
            else { report.fixed++; changed = true; continue; }
          }
        } else if (st.type === "kill") {
          if (!c.anyFoe) { report.fixed++; changed = true; continue; }
          if (st.species && (!(MONSTER_BY_ID[st.species] || ANIMAL_BY_ID[st.species]) || !c.species.has(st.species))) {
            const near = zoneCentres.slice().sort((a, b) => Math.hypot(a.x - anchor.x, a.y - anchor.y) - Math.hypot(b.x - anchor.x, b.y - anchor.y))[0];
            st.species = near ? near.species[0] : undefined;
            if (st.species && !c.species.has(st.species)) st.species = undefined;
            report.fixed++; changed = true;
          }
        } else if (st.type === "gather") {
          const have = nodeSupply(c, st.node);
          if (have < st.count) {
            if (st.node === "fish") {
              // No shore at all: the step cannot work. Turn it into a smaller ore/tree job if one exists.
              report.fixed++; changed = true; continue;
            }
            const added = plant(map, c, st.node, st.count - have + 2, anchor, taken, nodeId);
            report.nodesAdded += added;
            c.nodes[st.node] += added;
            if (added) changed = true;
            if (c.nodes[st.node] < st.count) {
              if (c.nodes[st.node] >= 1) { st.count = c.nodes[st.node]; report.fixed++; changed = true; }
              else { report.fixed++; changed = true; continue; }
            }
          }
        } else if (st.type === "goto") {
          const p = st.tx >= 0 && st.ty >= 0 && st.tx < map.w && st.ty < map.h ? nearReach(map, c.reach, st.tx, st.ty, Math.max(st.radius ?? 2, 0)) : null;
          if (!p) {
            const far = st.tx >= 0 && st.ty >= 0 && st.tx < map.w && st.ty < map.h ? nearReach(map, c.reach, st.tx, st.ty, 30) : null;
            if (!far) { report.fixed++; changed = true; continue; }
            st.tx = far.x; st.ty = far.y; report.fixed++; changed = true;
          }
          anchor = { x: st.tx, y: st.ty };
        }
        keep.push(st);
      }
      if (keep.length !== q.steps.length) q.steps = keep;
      // Every step was impossible: nothing is left to do, so the quest goes.
      if (had && !keep.length) doomed.add(q.id);
    }
    if (doomed.size) {
      changed = true;
      for (const id of doomed) report.removed.push(byId.get(id)?.name ?? id);
      const parentOf = new Map(map.quests.map((q) => [q.id, q.requires]));
      const resolve = (r: string | undefined): string | undefined => { const seen = new Set<string>(); while (r && doomed.has(r) && !seen.has(r)) { seen.add(r); r = parentOf.get(r); } return r && doomed.has(r) ? undefined : r; };
      map.quests = map.quests.filter((q) => !doomed.has(q.id)).map((q) => (q.requires && doomed.has(q.requires) ? { ...q, requires: resolve(q.requires) } : q));
    }
    // Break any loop in the requirement chain.
    const ids = new Map(map.quests.map((q) => [q.id, q]));
    for (const q of map.quests) {
      const seen = new Set([q.id]);
      for (let r = q.requires; r && ids.has(r); r = ids.get(r)!.requires) {
        if (seen.has(r)) { q.requires = undefined; report.fixed++; changed = true; break; }
        seen.add(r);
      }
    }
    if (!changed) break;
  }
  const left = questIssues(map).filter((i) => i.fatal);
  if (left.length) report.notes.push(...left.slice(0, 10).map((i) => `${i.quest}: ${i.text}`));
  return report;
}

/** Adds up to `n` nodes of `kind`, one at a time, on free reachable ground around `near`, at least 2 tiles apart. */
function plant(map: MapFile, c: Ctx, kind: NodeKind, n: number, near: { x: number; y: number }, taken: Set<number>, nodeId: () => string): number {
  if (kind === "fish") return 0;
  let added = 0;
  const w = map.w;
  const spots: { x: number; y: number }[] = [];
  const isNodeNear = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (taken.has((y + dy) * w + (x + dx))) return true;
    return false;
  };
  for (let r = 2; r < 40 && added < n; r++) {
    for (let dy = -r; dy <= r && added < n; dy++) for (let dx = -r; dx <= r && added < n; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if ((dx * 7 + dy * 13 + r) % 3 !== 0) continue; // spread them out instead of filling a ring
      const x = near.x + dx, y = near.y + dy;
      if (x < 2 || y < 2 || x >= map.w - 2 || y >= map.h - 2) continue;
      const i = y * w + x;
      const t = map.tiles[i]!;
      if (!c.reach[i] || t.block || t.portal || t.floor === FLOOR_WATER || t.floor === 3 || t.layers?.length) continue;
      if (taken.has(i) || isNodeNear(x, y)) continue;
      if (spots.some((s) => Math.abs(s.x - x) < 3 && Math.abs(s.y - y) < 3)) continue;
      const it: MapInteractable = { id: nodeId(), kind: "node", node: kind, tx: x, ty: y };
      map.interactables!.push(it);
      taken.add(i);
      spots.push({ x, y });
      added++;
    }
  }
  return added;
}
