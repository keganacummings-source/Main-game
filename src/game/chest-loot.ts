/**
 * Hardcore loot chests: how nearby chests merge, and how a chest shows what is inside it.
 *
 * A chest tells you at a glance whether it is worth the walk:
 *  - Supplies: a plain chest, no light. Only items (potions, meat, ore...).
 *  - Gear: a beam of light in the colour of the best piece inside (white common, green fine, blue rare,
 *    purple epic, orange legendary), with a ring on the ground. Worn gear gets a dim grey beam.
 *  - Boss loot: gold sparkles circle it (world bosses, bounties, rival witches).
 * Chests that drop close together fold into one pile, with a count of how many drops it holds.
 */
import type { QualityId } from "./content";

/** Chests closer than this (pixels, same map) fold into one. Three tiles. */
export const CHEST_MERGE_RADIUS = 96;

export const QUALITY_ORDER: QualityId[] = ["worn", "common", "fine", "rare", "epic", "legendary"];
export const QUALITY_COLOR: Record<QualityId, string> = {
  worn: "#9a8d7c",
  common: "#f2ecdc",
  fine: "#6fe08a",
  rare: "#5aa8ff",
  epic: "#c77dff",
  legendary: "#ff9f2e",
};
export const SUPPLIES_COLOR = "#c8b48a";
export const BOSS_COLOR = "#ffd166";

export type ChestLike = {
  id: string;
  map: string;
  x: number;
  y: number;
  t: number;
  max: number;
  gear: { quality?: string; uid?: string }[];
  items: Record<string, number>;
  title: string;
  boss?: boolean;
  drops?: number;
};

export type ChestLook = {
  kind: "supplies" | "gear" | "boss";
  /** Best gear quality inside, or null when there is no gear. */
  best: QualityId | null;
  /** Beam / label colour. */
  color: string;
  gear: number;
  items: number;
  drops: number;
  label: string;
};

function rank(q: unknown): number {
  const i = QUALITY_ORDER.indexOf(q as QualityId);
  return i < 0 ? 1 : i;
}

/** What a chest holds, boiled down to how it should look. */
export function chestLook(c: ChestLike): ChestLook {
  let best = -1;
  for (const g of c.gear ?? []) best = Math.max(best, rank(g?.quality));
  const bestQ = best >= 0 ? QUALITY_ORDER[best]! : null;
  const items = Object.values(c.items ?? {}).reduce((n, v) => n + (v > 0 ? v : 0), 0);
  const gear = c.gear?.length ?? 0;
  const kind = c.boss ? "boss" : gear ? "gear" : "supplies";
  const color = bestQ ? QUALITY_COLOR[bestQ] : c.boss ? BOSS_COLOR : SUPPLIES_COLOR;
  const name = bestQ ? `${bestQ.toUpperCase()} GEAR${gear > 1 ? ` ×${gear}` : ""}` : c.boss ? "BOSS LOOT" : "SUPPLIES";
  return { kind, best: bestQ, color, gear, items, drops: Math.max(1, c.drops ?? 1), label: name };
}

/** Moves everything in `from` into `into`. The pile lasts as long as its longest-lived part. */
export function mergeChestInto(into: ChestLike, from: ChestLike): void {
  into.gear.push(...from.gear);
  for (const [id, n] of Object.entries(from.items)) if (n > 0) into.items[id] = (into.items[id] ?? 0) + n;
  into.t = Math.max(into.t, from.t);
  into.max = Math.max(into.max, from.max);
  into.drops = Math.max(1, into.drops ?? 1) + Math.max(1, from.drops ?? 1);
  if (from.boss && !into.boss) { into.boss = true; into.title = from.title; }
  else if (!into.boss) into.title = `Loot pile · ${into.drops} drops`;
}

/** The chest a new drop at (x, y) should join, if any: the nearest live chest on the same map in reach. */
export function chestToJoin<T extends ChestLike>(list: T[], map: string, x: number, y: number, radius = CHEST_MERGE_RADIUS): T | null {
  let best: T | null = null, bd = radius;
  for (const c of list) {
    if (c.map !== map || !(c.t > 0)) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d <= bd) { bd = d; best = c; }
  }
  return best;
}

/**
 * Folds chests that sit close together into one (older saves, or chests that drifted into reach).
 * The survivor is the one listed first. Returns the ids that were folded away, mapped to their survivor.
 */
export function mergeNearbyChests<T extends ChestLike>(list: T[], radius = CHEST_MERGE_RADIUS): { list: T[]; folded: Record<string, string> } {
  const out: T[] = [];
  const folded: Record<string, string> = {};
  for (const c of list) {
    const host = chestToJoin(out, c.map, c.x, c.y, radius);
    if (host) { mergeChestInto(host, c); folded[c.id] = host.id; }
    else out.push(c);
  }
  return { list: out, folded };
}
