import { CLASS_BY_ID, MOVE_BY_ID, type ClassId } from "./content";
export const POINTS_PER_LEVEL = 3;
export const MAX_ABILITY_RANK = 5;
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
      Math.max(0, Math.min(49, Math.floor(save.level || 1) - 1)) * POINTS_PER_LEVEL;
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
        rank <= MAX_ABILITY_RANK,
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
  if (rank >= MAX_ABILITY_RANK) return false;
  save.abilityRanks[id] = rank + 1;
  save.skillPoints = save.skillPoints! - 1;
  return true;
}
export function abilityMultiplier(save: AbilityProgress, id: string): number {
  return 1 + Math.max(0, Math.min(MAX_ABILITY_RANK, save.abilityRanks?.[id] ?? 1) - 1) * 0.15;
}
