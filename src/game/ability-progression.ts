import { CLASS_BY_ID, MOVE_BY_ID, type ClassId } from "./content";
export const POINTS_PER_LEVEL = 3;
/** Ranks past this still upgrade. It is only the old full-strength knee, not a stop. */
export const RANK_KNEE = 5;
/** Stored ranks cannot run away into infinity and break a save. Gameplay does not stop at the knee. */
export const RANK_STORE_CAP = 9999;
/**
 * The highest rank a verse can reach. Past the knee each rank adds less (see abilityMultiplier), and by
 * rank 60 a verse is within a few percent of its ceiling (x3), so points past it are refunded.
 */
export const RANK_MAX = 60;
/** The most a single verse's ranks can multiply it by. Dumping every point in one verse used to reach x70+. */
export const RANK_CEILING = 3;
export type AbilityProgress = {
  skillPoints?: number;
  abilityRanks?: Record<string, number>;
  progressionVersion?: number;
  level: number;
  classId?: ClassId;
  known?: string[];
  innate?: string[];
};
export function normalizeAbilities(save: AbilityProgress): void {
  if (save.progressionVersion !== 1) {
    const starter = save.classId ? (CLASS_BY_ID[save.classId]?.starterMoves ?? []) : ["measured"];
    const learned = [...starter, ...(save.known ?? []), ...(save.innate ?? [])].filter((id) =>
      Object.hasOwn(MOVE_BY_ID, id),
    );
    save.abilityRanks = Object.fromEntries(learned.map((id) => [id, 1]));
    save.skillPoints =
      Math.max(0, Math.floor(save.level || 1) - 1) * POINTS_PER_LEVEL;
    save.progressionVersion = 1;
  }
  save.skillPoints = Number.isFinite(save.skillPoints)
    ? Math.max(0, Math.floor(save.skillPoints!))
    : 0;
  save.abilityRanks = Object.fromEntries(
    Object.entries(save.abilityRanks ?? {}).filter(
      ([id, rank]) =>
        Object.hasOwn(MOVE_BY_ID, id) &&
        Number.isInteger(rank) &&
        rank >= 1 &&
        rank <= RANK_STORE_CAP,
    ),
  );
  // Overmax rebalance: ranks past RANK_MAX hand their points back.
  let refund = 0;
  for (const [id, rank] of Object.entries(save.abilityRanks)) {
    if (rank > RANK_MAX) { refund += rank - RANK_MAX; save.abilityRanks[id] = RANK_MAX; }
  }
  if (refund) save.skillPoints = (save.skillPoints ?? 0) + refund;
}
export function spendAbilityPoint(save: AbilityProgress, id: string): boolean {
  if (
    !Object.hasOwn(MOVE_BY_ID, id) ||
    !save.abilityRanks ||
    !Number.isFinite(save.skillPoints) ||
    save.skillPoints! < 1
  )
    return false;
  const rank = save.abilityRanks[id] ?? 0;
  if (rank >= RANK_MAX) return false;
  save.abilityRanks[id] = rank + 1;
  save.skillPoints = save.skillPoints! - 1;
  return true;
}
export function abilityMultiplier(save: AbilityProgress, id: string): number {
  const rank = Math.max(1, Math.min(RANK_STORE_CAP, Math.floor(save.abilityRanks?.[id] ?? 1)));
  const steps = rank - 1;
  // Ranks 1–5: +15% each (rank 5 = ×1.6), same as before.
  // Overmax ranks bend toward RANK_CEILING: the first few still add about +7% each, then less and less
  // (rank 10 ≈ ×1.9, rank 20 ≈ ×2.3, rank 40 ≈ ×2.75, rank 60 ≈ ×2.9). Spreading points pays more.
  const knee = 1 + (RANK_KNEE - 1) * 0.15;
  if (steps <= RANK_KNEE - 1) return knee;
  const over = Math.min(rank, RANK_MAX) - RANK_KNEE;
  return knee + (RANK_CEILING - knee) * (1 - Math.exp(-over / 20));
}

/**
 * Healing verses restore a share of your maximum health (they used to heal a flat 40-60 and were
 * worthless at high level): 9% + 0.1% per point of power, times the rank multiplier, plus a little flat.
 */
export function healAmount(power: number, mult: number, maxHp: number): number {
  const p = Math.max(8, power || 0);
  if (!(maxHp > 0)) return Math.floor((18 + p * 0.45) * mult);
  return Math.floor((maxHp * (0.09 + p * 0.001) + 12) * mult);
}
/** Ward verses: a shield worth 7% + 0.08% per power of your maximum health, times the rank multiplier. */
export function shieldAmount(power: number, mult: number, maxHp: number): number {
  const p = Math.max(8, power || 0);
  if (!(maxHp > 0)) return Math.floor((12 + p) * mult);
  return Math.floor((maxHp * (0.07 + p * 0.0008) + 10) * mult);
}

/** What a verse actually does at a given rank: the numbers the UI shows. Rank 0 (locked) reads as rank 1. */
export type VerseValues = { mult: number; power: number; heal: number; shield: number };
export function verseValues(move: { id: string; power: number; effect?: string }, rank: number, tactic = "", maxHp = 0): VerseValues {
  const mult = abilityMultiplier({ level: 1, abilityRanks: { [move.id]: Math.max(1, rank) } }, move.id);
  const heals = tactic === "heal" || move.effect === "mend";
  const wards = tactic === "ward";
  return {
    mult,
    power: Math.round(move.power * mult),
    heal: heals ? healAmount(move.power, mult, maxHp) : 0,
    shield: wards ? shieldAmount(move.power, mult, maxHp) : 0,
  };
}
