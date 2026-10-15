import { CLASS_BY_ID, MOVE_BY_ID, type ClassId } from "./content";
export const POINTS_PER_LEVEL = 3;
/** Ranks past this still upgrade. It is only the old full-strength knee, not a stop. */
export const RANK_KNEE = 5;
/** Stored ranks cannot run away into infinity and break a save. Gameplay does not stop at the knee. */
export const RANK_STORE_CAP = 9999;
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
  if (rank >= RANK_STORE_CAP) return false;
  save.abilityRanks[id] = rank + 1;
  save.skillPoints = save.skillPoints! - 1;
  return true;
}
export function abilityMultiplier(save: AbilityProgress, id: string): number {
  const rank = Math.max(1, Math.min(RANK_STORE_CAP, Math.floor(save.abilityRanks?.[id] ?? 1)));
  const steps = rank - 1;
  // Ranks 1–5: +15% each (rank 5 = ×1.6), same as before.
  // Overmax ranks keep stacking at +8% each so a deep rank still matters without a hard stop.
  if (steps <= RANK_KNEE - 1) return 1 + steps * 0.15;
  return 1 + (RANK_KNEE - 1) * 0.15 + (steps - (RANK_KNEE - 1)) * 0.08;
}

/** What a verse actually does at a given rank: the numbers the UI shows. Rank 0 (locked) reads as rank 1. */
export type VerseValues = { mult: number; power: number; heal: number; shield: number };
export function verseValues(move: { id: string; power: number; effect?: string }, rank: number, tactic = ""): VerseValues {
  const mult = abilityMultiplier({ level: 1, abilityRanks: { [move.id]: Math.max(1, rank) } }, move.id);
  const heals = tactic === "heal" || move.effect === "mend";
  const wards = tactic === "ward";
  return {
    mult,
    power: Math.round(move.power * mult),
    heal: heals ? Math.floor((18 + Math.max(8, move.power) * 0.45) * mult) : 0,
    shield: wards ? Math.floor((12 + move.power) * mult) : 0,
  };
}
