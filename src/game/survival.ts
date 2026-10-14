export type Campfire = { map: string; x: number; y: number };
export type SurvivalState = { hunger: number; thirst: number; rest: number; elapsed: number; campfires: Campfire[] };
const bounded = (n: unknown, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : fallback;
export function normalizeSurvival(raw?: Partial<SurvivalState>): SurvivalState {
  return { hunger: bounded(raw?.hunger, 100), thirst: bounded(raw?.thirst, 100), rest: bounded(raw?.rest, 100), elapsed: Number.isFinite(raw?.elapsed) ? Math.max(0, raw!.elapsed!) : 0,
    campfires: (Array.isArray(raw?.campfires) ? raw.campfires : []).filter(c => c && typeof c.map === 'string' && Number.isFinite(c.x) && Number.isFinite(c.y) && c.x >= 0 && c.y >= 0).slice(-100) };
}
// Full reserves last 30 / 20 / 40 minutes of active play. Empty reserves cause injury.
export function advanceSurvival(s: SurvivalState, dt: number, sleeping = false): number {
  if (!Number.isFinite(dt) || dt <= 0) return 0;
  const emptyTime = (value: number, rate: number) => Math.max(0, dt - value / rate);
  const damage = emptyTime(s.hunger, 100 / 1800) * .4 + emptyTime(s.thirst, 100 / 1200) * .8 + (sleeping ? 0 : emptyTime(s.rest, 100 / 2400) * .2);
  s.hunger = Math.max(0, s.hunger - dt * 100 / 1800);
  s.thirst = Math.max(0, s.thirst - dt * 100 / 1200);
  s.rest = sleeping ? Math.min(100, s.rest + dt * 8) : Math.max(0, s.rest - dt * 100 / 2400);
  s.elapsed += dt;
  return damage;
}
/**
 * Campfire crafting.
 *
 * To add a recipe, append one entry to CAMP_RECIPE_LIST. The crafting menu, the cost check and the
 * crafting action all read from this list, so nothing else needs to change. Rules:
 *   - `id` must be unique and must not be "fire", "water", "chop" or "sleep" (those are camp actions).
 *   - every id used in `costs` and `outputs` must exist in ITEMS (src/game/content.ts).
 *   - `skill` (optional) grants skill XP on a successful craft, e.g. { id: "alchemy", xp: 12 }.
 *
 * Example:
 *   { id: "mushroom_stew", name: "Mushroom Stew", about: "A hot, filling stew.",
 *     costs: { mushroom: 2, raw_water: 1, timber: 1 }, outputs: { mushroom_stew: 1 }, skill: { id: "alchemy", xp: 10 } },
 */
export type CampRecipe = {
  id: string;
  name: string;
  about: string;
  costs: Record<string, number>;
  outputs: Record<string, number>;
  skill?: { id: string; xp: number };
};

export const CAMP_RECIPE_LIST: CampRecipe[] = [
  { id: "cook", name: "Cook Meat", about: "Cook raw meat over the fire.", costs: { meat: 1, timber: 1 }, outputs: { cooked_meat: 1 } },
  { id: "fish", name: "Cook Fish", about: "Cook a raw fish over the fire.", costs: { fish: 1, timber: 1 }, outputs: { fish_meal: 1 } },
  { id: "purify", name: "Purify Water", about: "Boil raw water until it is safe to drink.", costs: { raw_water: 1, timber: 1 }, outputs: { drinking_water: 1 } },
];

export const CAMP_RECIPES: Record<string, CampRecipe> = Object.fromEntries(CAMP_RECIPE_LIST.map((r) => [r.id, r]));

export function consumeMaterials(bag: Record<string, number>, costs: Record<string, number>): boolean {
  if (Object.entries(costs).some(([id, n]) => !Number.isFinite(bag[id]) || bag[id]! < n)) return false;
  for (const [id, n] of Object.entries(costs)) bag[id] -= n;
  return true;
}
export function hasMaterials(bag: Record<string, number>, costs: Record<string, number>): boolean {
  return Object.entries(costs).every(([id, n]) => Number.isFinite(bag[id]) && bag[id]! >= n);
}
/** Spends the recipe's materials and adds its outputs. Returns the recipe on success, null otherwise. */
export function craftAtCamp(bag: Record<string, number>, recipe: string, nearFire: boolean): CampRecipe | null {
  const r = CAMP_RECIPES[recipe];
  if (!nearFire || !r || !consumeMaterials(bag, r.costs)) return null;
  for (const [id, n] of Object.entries(r.outputs)) bag[id] = (bag[id] ?? 0) + n;
  return r;
}
/**
 * Closest water tile within `reach` px of (x, y), or null. Water tiles are impassable, so this is
 * the tile you are standing next to when you fish.
 */
export function nearestWaterTile(world: { w: number; h: number; tiles: { floor: number }[] }, x: number, y: number, reach = 80): { x: number; y: number } | null {
  const tx = Math.floor(x / 32), ty = Math.floor(y / 32);
  const span = Math.ceil(reach / 32) + 1;
  let best: { x: number; y: number } | null = null;
  let bd = Infinity;
  for (let dy = -span; dy <= span; dy++) for (let dx = -span; dx <= span; dx++) {
    const xx = tx + dx, yy = ty + dy;
    if (xx < 0 || yy < 0 || xx >= world.w || yy >= world.h || world.tiles[yy * world.w + xx]?.floor !== 2) continue;
    const cx = xx * 32 + 16, cy = yy * 32 + 16, d = Math.hypot(cx - x, cy - y);
    if (d <= reach && d < bd) { bd = d; best = { x: cx, y: cy }; }
  }
  return best;
}
/** Closest walkable tile beside water, for walking to the shore. */
export function nearestShore(world: { w: number; h: number; tiles: { floor: number; block: number }[] }, x: number, y: number, maxTiles = 70): { x: number; y: number } | null {
  const tx = Math.floor(x / 32), ty = Math.floor(y / 32);
  const isWater = (a: number, b: number) => a >= 0 && b >= 0 && a < world.w && b < world.h && world.tiles[b * world.w + a]?.floor === 2;
  for (let r = 0; r <= maxTiles; r++) {
    let best: { x: number; y: number } | null = null, bd = Infinity;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const a = tx + dx, b = ty + dy;
      if (a < 3 || b < 3 || a >= world.w - 3 || b >= world.h - 3) continue;
      const t = world.tiles[b * world.w + a];
      if (!t || t.floor === 1 || t.floor === 2 || t.block === 1) continue;
      if (!(isWater(a + 1, b) || isWater(a - 1, b) || isWater(a, b + 1) || isWater(a, b - 1))) continue;
      const d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = { x: a * 32 + 16, y: b * 32 + 16 }; }
    }
    if (best) return best;
  }
  return null;
}
export function waterWithinReach(world: { w: number; h: number; tiles: { floor: number }[] }, x: number, y: number): boolean {
  const tx = Math.floor(x / 32), ty = Math.floor(y / 32);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const xx = tx + dx, yy = ty + dy;
    if (xx >= 0 && yy >= 0 && xx < world.w && yy < world.h && world.tiles[yy * world.w + xx]?.floor === 2 && Math.hypot(xx * 32 + 16 - x, yy * 32 + 16 - y) <= 80) return true;
  }
  return false;
}
export const FOOD: Record<string, number> = { trail_ration: 35, cooked_meat: 50, fish_meal: 40, mushroom: 8 };
