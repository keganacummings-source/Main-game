import type { ItemDef } from "./content";
import { FOOD } from "./survival";

export type ItemUseState = { hardcore: boolean; hp: number; maxHp: number; hunger?: number; thirst?: number; level?: number };

/** Level needed to eat a Green Mushroom (Hardcore only). */
export const GREEN_MUSHROOM_LEVEL = 30;

/**
 * What healing items do. Heals are a share of maximum health, so a potion stays worth carrying at every
 * level: `pct` lands at once, `regen` more trickles in over `sec` seconds, and `ghost` mends the ghosts
 * out with you. Potions share a short cooldown (POTION_CD) so they cannot be chugged in one breath;
 * meals do not. Hardcore heals are a quarter weaker (HARDCORE_HEAL) — rest and healing spells still matter.
 */
export type Healing = { pct: number; regen?: number; sec?: number; ghost?: number; potion?: boolean };
export const HEALING: Record<string, Healing> = {
  potion: { pct: 0.28, regen: 0.12, sec: 6, potion: true },
  big_potion: { pct: 0.5, regen: 0.2, sec: 8, potion: true },
  spirit_candy: { pct: 0.15, ghost: 0.4, potion: true },
  warmth_tonic: { pct: 0.3, regen: 0.1, sec: 5, potion: true },
  pearl_salve: { pct: 0.3, potion: true },
  spark_flask: { pct: 0.12, potion: true },
  spirit_lamp: { pct: 0.2, ghost: 0.2, potion: true },
  fish_meal: { pct: 0.18 },
  cooked_meat: { pct: 0.1 },
  trail_ration: { pct: 0.05 },
  mushroom_stew: { pct: 0.12, regen: 0.08, sec: 10 },
  hearty_skewer: { pct: 0.15, regen: 0.1, sec: 10 },
  fish_stew: { pct: 0.14, regen: 0.08, sec: 10 },
  bone_broth: { pct: 0.08, regen: 0.08, sec: 10 },
  resin_jerky: { pct: 0.1 },
  fish: { pct: 0.06 },
  meat: { pct: 0.07 },
};
export const POTION_CD = 4;
export const HARDCORE_HEAL = 0.75;

/** Health a healing item gives right now (instant part, trickle part) for this maximum health. */
export function healingOf(id: string, maxHp: number, hardcore: boolean, sip = 0): { now: number; regen: number; sec: number; ghost: number; potion: boolean } | null {
  const h = HEALING[id];
  if (!h) return null;
  const k = (hardcore ? HARDCORE_HEAL : 1) * (1 + Math.max(0, sip) / 100);
  const max = Math.max(1, maxHp);
  return { now: Math.max(1, Math.floor(max * h.pct * k)), regen: Math.floor(max * (h.regen ?? 0) * k), sec: h.sec ?? 0, ghost: h.ghost ?? 0, potion: !!h.potion };
}

/** One line on what a healing item does, for the Bag. */
export function healingLine(id: string, maxHp: number, hardcore: boolean, sip = 0): string {
  const h = healingOf(id, maxHp, hardcore, sip);
  if (!h) return "";
  const bits = [`Heals ${h.now}`];
  if (h.regen) bits.push(`+${h.regen} over ${h.sec}s`);
  if (h.ghost) bits.push(`mends your ghosts ${Math.round(h.ghost * 100)}%`);
  if (h.potion) bits.push(`${POTION_CD}s potion cooldown`);
  return bits.join(" · ") + (hardcore ? " (Hardcore: ¾ strength)" : "");
}

/** Things worth a key: potions, meals, buffs and the handful of tools. Materials are not. */
export function isConsumable(item: ItemDef): boolean {
  return !!(HEALING[item.id] || item.buff || FOOD[item.id] || ["ghost_jar", "smoke_bomb", "cleanse_salt", "drinking_water", "green_mushroom"].includes(item.id));
}

export function itemUseProblem(item: ItemDef, state: ItemUseState): string | null {
  if (item.id === "ghost_jar" || item.id === "smoke_bomb" || item.id === "cleanse_salt") return null;
  if (item.id === "green_mushroom") {
    if (!state.hardcore) return "The Green Cave only opens in Hardcore.";
    return (state.level ?? 1) < GREEN_MUSHROOM_LEVEL ? `Too strong for you. Reach level ${GREEN_MUSHROOM_LEVEL} first.` : null;
  }
  if (state.hardcore && (item.id === "meat" || item.id === "fish")) return "Cook this at a campfire before eating.";
  if (state.hardcore && FOOD[item.id]) return (state.hunger ?? 100) >= 100 ? "You are already full." : null;
  if (state.hardcore && item.id === "drinking_water") return (state.thirst ?? 100) >= 100 ? "You are already hydrated." : null;
  if (item.id === "drinking_water") return "Drinking water is for Hardcore thirst.";
  if (item.buff) return null;
  if (HEALING[item.id] || item.heal) {
    if (HEALING[item.id]?.ghost) return null;
    return state.hp >= state.maxHp ? "Your health is already full." : null;
  }
  if (FOOD[item.id]) return "Food fills hunger in Hardcore.";
  return "A material: it goes into recipes, building or selling, not used on its own.";
}

export function bestFood(bag: Record<string, number>, hunger: number): string | null {
  if (hunger >= 100) return null;
  const missing = 100 - hunger;
  const available = Object.keys(FOOD).filter(id => (bag[id] ?? 0) > 0);
  // Pick the smallest meal that fills the gap; otherwise use the largest available.
  available.sort((a, b) => {
    const aFills = FOOD[a]! >= missing, bFills = FOOD[b]! >= missing;
    if (aFills !== bFills) return aFills ? -1 : 1;
    return aFills ? FOOD[a]! - FOOD[b]! : FOOD[b]! - FOOD[a]!;
  });
  return available[0] ?? null;
}

/** Up to this many items wait on the Space bar; when the first runs out the next takes over. */
export const QUICK_MAX = 3;

/** Keeps the Space queue tidy: known consumables only, no repeats, at most QUICK_MAX, none you have run out of. */
export function cleanQuick(queue: unknown, bag: Record<string, number>, known: (id: string) => boolean): string[] {
  const out: string[] = [];
  for (const id of Array.isArray(queue) ? queue : []) {
    if (typeof id !== "string" || out.includes(id) || !known(id) || (bag[id] ?? 0) <= 0) continue;
    out.push(id);
    if (out.length >= QUICK_MAX) break;
  }
  return out;
}
