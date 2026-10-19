/**
 * Enemy skins & random identity.
 *
 * Every non-witch foe now wears a random "skin" — one of the uploaded pixel sprites in
 * `enemies/replacement-sprites.json`, drawn in full colour exactly as supplied. This is the
 * player's own sprite set replacing every enemy look in the world (witches keep their bodies).
 *
 * A foe also rolls:
 *   - a silly random name (Jeff, Bubbles, Oreo…),
 *   - one to four random elements (shown on the nameplate and real in combat).
 *
 * Ghosts keep whatever skin, elements and name their source foe had (see spiritFrom), so a
 * ghost looks and reads exactly like the thing it came from.
 */
import { TYPE_IDS, TYPES, type TypeId, type Rng } from "./content";
import { setEnemySkin, clearEnemySkins } from "./creature-sprites";
// The skin pool is the player's uploaded sprite set: every non-witch foe wears one of these,
// drawn in full colour (see installEnemySkins). Replaces the old greyscale-tinted pool.
import pool from "./enemies/replacement-sprites.json";

type PoolSkin = { id: string; type?: string; scale?: number; boss?: boolean; pixels?: (string | null)[] };

/** Ids of the skins available in the pool, in install order. */
export const ENEMY_SKIN_IDS: string[] = [];

/** Prefix used for the synthetic "species" key a skin registers under. */
export const SKIN_KEY = (id: string) => `skin:${id}`;

/**
 * Silly given names. The player asked for names like Jeff, Bubbles, Oreo, Mamomsa, Joker, Obi —
 * short, daft, memorable. Each foe draws one at random.
 */
export const ENEMY_NAMES: string[] = [
  "Jeff", "Bubbles", "Oreo", "Mamomsa", "Joker", "Obi", "Pickles", "Noodle", "Gizmo", "Waffles",
  "Biscuit", "Tater", "Mochi", "Pogo", "Snickers", "Dumpling", "Cheddar", "Kevin", "Gary", "Larry",
  "Beans", "Nugget", "Pumpkin", "Taco", "Fizz", "Mungo", "Doodle", "Squish", "Blinky", "Goober",
  "Snuffles", "Wobble", "Pip", "Zonk", "Muffin", "Gravy", "Chonk", "Bork", "Yeet", "Boop",
  "Crumb", "Sprout", "Toot", "Wiggles", "Flapjack", "Mister Bones", "Lil Guy", "Big Steve",
  "Gorbo", "Zippy", "Marbles", "Dingus", "Pumba", "Sir Reginald", "Clyde", "Momo", "Pesto",
  "Tofu", "Scampi", "Nacho", "Biff", "Gnocchi", "Twinkie", "Smores", "Churro", "Ravioli", "Bongo",
];

export function rollEnemyName(rng: Rng = Math.random): string {
  return ENEMY_NAMES[Math.floor(rng() * ENEMY_NAMES.length)] ?? "Jeff";
}

/**
 * One to four distinct random elements. Weighted toward one or two so the nameplate stays
 * readable, with the occasional three- or four-element monster as a rare, nasty surprise.
 */
export function rollEnemyTypes(rng: Rng = Math.random): TypeId[] {
  const roll = rng();
  const count = roll < 0.42 ? 1 : roll < 0.78 ? 2 : roll < 0.93 ? 3 : 4;
  const bag = [...TYPE_IDS];
  const out: TypeId[] = [];
  for (let i = 0; i < count && bag.length; i++) {
    const j = Math.floor(rng() * bag.length);
    out.push(bag.splice(j, 1)[0]!);
  }
  return out.length ? out : ["normal"];
}

/** A skin id at random from the pool (falls back to none when the pool is empty). */
export function rollEnemySkin(rng: Rng = Math.random): string | null {
  if (!ENEMY_SKIN_IDS.length) return null;
  return SKIN_KEY(ENEMY_SKIN_IDS[Math.floor(rng() * ENEMY_SKIN_IDS.length)]!);
}

/** The element colours for a foe's type list — used by the sprite tint and the nameplate dots. */
export function typeColors(types: TypeId[] | undefined, fallback: TypeId): string[] {
  const list = types && types.length ? types : [fallback];
  return list.map((t) => TYPES[t]?.color ?? "#c8c0b0");
}

/**
 * Combined element matchup against a multi-type foe. Multiplies the single-element result for
 * every element the foe carries (so a fire bolt is doubly good against a foe weak to fire twice,
 * and resisted by its other elements). An outright immunity becomes a heavy resist rather than a
 * hard zero, so a four-element monster is never unkillable. Clamped to a sane band.
 */
export function typeChartMulti(atk: TypeId, defTypes: TypeId[] | undefined, fallback: TypeId): number {
  const list = defTypes && defTypes.length ? defTypes : [fallback];
  let mult = 1;
  for (const d of list) {
    const def = TYPES[d];
    if (!def) continue;
    if (def.immune.includes(atk)) mult *= 0.35;
    else if (TYPES[atk].strong.includes(d)) mult *= 2;
    else if (TYPES[atk].weak.includes(d)) mult *= 0.5;
  }
  return Math.max(0.3, Math.min(3, mult));
}

// ---------------------------------------------------------------------------
// Greyscale canvas building + install
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Build a 16×16 full-colour canvas from a 256-length pixel array, exactly as supplied. */
function colorCanvas(pixels: (string | null)[]): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const g = c.getContext("2d");
  if (!g) return null;
  for (let i = 0; i < 256; i++) {
    const p = pixels[i];
    if (!p || !hexToRgb(p)) continue;
    g.fillStyle = p;
    g.fillRect(i % 16, Math.floor(i / 16), 1, 1);
  }
  return c;
}

/**
 * Builds the skin pool from the uploaded sprite set and registers each as a full-colour skin.
 * Every non-witch foe rolls one of these and wears it as-is (no element tint), so the player's
 * own art is what shows in the world.
 */
export function installEnemySkins(): number {
  clearEnemySkins();
  ENEMY_SKIN_IDS.length = 0;
  const list = Array.isArray(pool) ? (pool as PoolSkin[]) : [];
  for (const d of list) {
    const px = d?.pixels;
    if (!Array.isArray(px) || px.length !== 256) continue;
    const canvas = colorCanvas(px);
    if (!canvas) {
      // No DOM (e.g. SSR): still record the id so rolls work; the renderer falls back gracefully.
      ENEMY_SKIN_IDS.push(d.id);
      continue;
    }
    // Normalise scale: as a shared skin pool every foe should read at a consistent tile size, so the
    // per-sprite design scale (which ranged from tiny to boss-huge) is ignored here.
    setEnemySkin(SKIN_KEY(d.id), { canvas, scale: 1, noTint: true });
    ENEMY_SKIN_IDS.push(d.id);
  }
  return ENEMY_SKIN_IDS.length;
}
