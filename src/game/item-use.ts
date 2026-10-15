import type { ItemDef } from "./content";
import { FOOD } from "./survival";

export type ItemUseState = { hardcore: boolean; hp: number; maxHp: number; hunger?: number; thirst?: number; level?: number };

/** Level needed to eat a Green Mushroom (Hardcore only). */
export const GREEN_MUSHROOM_LEVEL = 30;
export function itemUseProblem(item: ItemDef, state: ItemUseState): string | null {
  if (item.id === "ghost_jar" || item.id === "smoke_bomb" || item.id === "cleanse_salt") return null;
  if (item.id === "green_mushroom") {
    if (!state.hardcore) return "The Green Cave only opens in Hardcore.";
    return (state.level ?? 1) < GREEN_MUSHROOM_LEVEL ? `Too strong for you. Reach level ${GREEN_MUSHROOM_LEVEL} first.` : null;
  }
  if (state.hardcore && FOOD[item.id]) return (state.hunger ?? 100) >= 100 ? "You are already full." : null;
  if (state.hardcore && item.id === "drinking_water") return (state.thirst ?? 100) >= 100 ? "You are already hydrated." : null;
  if (item.buff) return null;
  if (item.heal) {
    if (state.hardcore) return item.id === "meat" || item.id === "fish" ? "Cook this at a campfire before eating." : "Only healing spells mend lasting injuries.";
    return state.hp >= state.maxHp ? "Your health is already full." : null;
  }
  return "Crafting resource. Use it in a recipe or at a campfire.";
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
