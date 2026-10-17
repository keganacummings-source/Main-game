/**
 * What a person would do next: stay alive, take a fair fight, gather what is short,
 * craft, catch a spirit, or step into a dungeon they can survive.
 * Autoplay and the TURBZ witches both use this. Other modes borrow the fight pick.
 */
import { TYPES, type TypeId } from "./content";

export type PlayOrders = {
  combat: boolean;
  mining: boolean;
  woodcutting: boolean;
  fishing: boolean;
  shroom: boolean;
  crafting: boolean;
  spirits: boolean;
  dungeon: boolean;
};

export const ALL_ORDERS: PlayOrders = {
  combat: true, mining: true, woodcutting: true, fishing: true, shroom: true, crafting: true, spirits: true, dungeon: true,
};

export type FoeSense = {
  id: string;
  x: number;
  y: number;
  level: number;
  type: string;
  d: number;
  boss?: boolean;
  dungeonBoss?: boolean;
  hunter?: boolean;
  witch?: boolean;
  animal?: boolean;
  ghost?: boolean;
};

export type NodeSense = { id: string; node: string; x: number; y: number; d: number };
export type Spot = { x: number; y: number };

export type PlayAct =
  | { kind: "flee"; x: number; y: number }
  | { kind: "potion" }
  | { kind: "eat" }
  | { kind: "drink" }
  | { kind: "sleep"; x: number; y: number }
  | { kind: "fight"; id: string; x: number; y: number }
  | { kind: "gather"; node: string; id: string; x: number; y: number }
  | { kind: "fish"; x: number; y: number }
  | { kind: "craft" }
  | { kind: "brew" }
  | { kind: "rift"; id: string; x: number; y: number }
  | { kind: "leave"; x: number; y: number }
  | { kind: "wander"; x: number; y: number };

export type PlayInput = {
  x: number;
  y: number;
  level: number;
  hpPct: number;
  type: string;
  bag: Record<string, number>;
  orders: PlayOrders;
  inDungeon: boolean;
  needs: { eat: boolean; drink: boolean; sleep: boolean };
  foes: FoeSense[];
  nodes: NodeSense[];
  shore: Spot | null;
  rift: { id: string; x: number; y: number; level: number; d: number } | null;
  exit: Spot | null;
  bed: Spot | null;
  wander: number;
};

export function typeEdge(atk: string, def: string): number {
  const A = TYPES[atk as TypeId];
  const D = TYPES[def as TypeId];
  if (!A || !D) return 1;
  if (D.immune.includes(atk as TypeId)) return 0;
  if (A.strong.includes(def as TypeId)) return 2;
  if (A.weak.includes(def as TypeId)) return 0.5;
  return 1;
}

/** The fight a player would actually take. Bosses only when healthy and close in level. */
export function pickFight(p: Pick<PlayInput, "level" | "hpPct" | "type" | "orders">, foes: FoeSense[]): FoeSense | null {
  if (!p.orders.combat) return null;
  let best: FoeSense | null = null;
  let bs = Infinity;
  for (const f of foes) {
    if (f.d > 780) continue;
    const gap = f.level - p.level;
    const big = !!(f.boss || f.dungeonBoss || f.hunter || (f.witch && f.id !== "player"));
    if (big && (gap > 1 || p.hpPct < 0.82)) continue;
    if (gap > 6) continue;
    if (f.animal && gap > 4) continue;
    const adv = typeEdge(p.type, f.type);
    let score = f.d * (adv > 1 ? 0.62 : adv < 1 ? 1.4 : 1) + Math.max(0, gap) * 68;
    if (f.ghost && p.orders.spirits) score *= 0.5;
    if (big) score += 80;
    if (score < bs) { bs = score; best = f; }
  }
  return best;
}

export function thinkLikePlayer(p: PlayInput): PlayAct {
  const threat = p.foes.filter((f) => f.d < 170).sort((a, b) => a.d - b.d)[0] ?? null;
  if (p.hpPct < 0.34 && threat) {
    const a = Math.atan2(p.y - threat.y, p.x - threat.x);
    return { kind: "flee", x: p.x + Math.cos(a) * 200, y: p.y + Math.sin(a) * 200 };
  }
  if (p.hpPct < 0.46 && ((p.bag.potion ?? 0) > 0 || (p.bag.big_potion ?? 0) > 0)) return { kind: "potion" };
  if (p.needs.drink) return { kind: "drink" };
  if (p.needs.eat) return { kind: "eat" };
  if (p.needs.sleep && !threat) {
    return p.bed ? { kind: "sleep", x: p.bed.x, y: p.bed.y } : { kind: "sleep", x: p.x, y: p.y };
  }
  if (p.inDungeon && p.hpPct < 0.42 && !threat && p.exit) return { kind: "leave", x: p.exit.x, y: p.exit.y };

  const foe = pickFight(p, p.foes);
  if (foe && (p.hpPct > 0.4 || foe.d < 80)) return { kind: "fight", id: foe.id, x: foe.x, y: foe.y };

  if (p.orders.crafting && (p.bag.timber ?? 0) >= 3 && (p.bag.ore ?? 0) >= 2) return { kind: "craft" };
  if (p.orders.crafting && (p.bag.mushroom ?? 0) >= 2 && (p.bag.potion ?? 0) < 2) return { kind: "brew" };

  const want: { node: string; have: number; need: number; on: boolean }[] = [
    { node: "tree", have: p.bag.timber ?? 0, need: 4, on: p.orders.woodcutting },
    { node: "ore", have: p.bag.ore ?? 0, need: 3, on: p.orders.mining },
    { node: "shroom", have: p.bag.mushroom ?? 0, need: 3, on: p.orders.shroom },
  ];
  const short = want.filter((w) => w.on && w.have < w.need).sort((a, b) => a.have / a.need - b.have / b.need);
  for (const w of short) {
    const node = p.nodes.filter((n) => n.node === w.node).sort((a, b) => a.d - b.d)[0];
    if (node) return { kind: "gather", node: w.node, id: node.id, x: node.x, y: node.y };
  }
  if (p.orders.fishing && (p.bag.fish ?? 0) < 2 && p.shore) return { kind: "fish", x: p.shore.x, y: p.shore.y };

  if (p.orders.dungeon && !p.inDungeon && p.rift && p.hpPct > 0.78 && p.rift.level <= p.level + 1 && p.rift.d < 1400) {
    return { kind: "rift", id: p.rift.id, x: p.rift.x, y: p.rift.y };
  }

  const ang = p.wander;
  return { kind: "wander", x: p.x + Math.cos(ang) * 200, y: p.y + Math.sin(ang) * 200 };
}
