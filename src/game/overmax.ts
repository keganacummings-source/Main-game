/**
 * Stats are not hard-capped. A value at or under its knee is used as-is (the old
 * maximum). Past that knee — overmax — it still stacks, but it bends toward a
 * ceiling it never quite reaches, so dodge, resist, haste and similar stats
 * cannot hit 100% immunity, a free shop, or a zero-second cooldown.
 *
 *   result = knee + (ceiling - knee) * excess / (excess + (ceiling - knee))
 */
export function bend(value: number, knee: number, ceiling: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= knee) return value;
  if (!(ceiling > knee)) return knee;
  const excess = value - knee;
  const span = ceiling - knee;
  return knee + (span * excess) / (excess + span);
}

/** Below `knee` the value bends toward `floor` and never reaches it. At or above the knee it is unchanged, so bonuses stay linear. */
export function bendDown(value: number, knee: number, floor: number): number {
  if (!Number.isFinite(value)) return knee;
  if (value >= knee) return value;
  if (!(knee > floor)) return knee;
  const deficit = knee - value;
  const span = knee - floor;
  return knee - (span * deficit) / (deficit + span);
}

/** Positive and negative sides each have a knee and a ceiling (guard, haste). */
export function bendSigned(value: number, negCeil: number, negKnee: number, posKnee: number, posCeil: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value >= 0) return bend(value, posKnee, posCeil);
  return -bend(-value, -negKnee, -negCeil);
}

/** A probability: overmax still counts, but it cannot exceed 1. */
export function bendChance(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value >= 1 ? 1 : value;
}
