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

// ---------------------------------------------------------------------------
// Skills have no caps. These turn "past 100%" into something that still pays.
// ---------------------------------------------------------------------------

/**
 * A proc chance with no ceiling. Every full 100% is a guaranteed proc and the remainder is a roll:
 * 250% gives 2 procs and a 50% chance of a third.
 */
export function procs(pct: number, roll: number = Math.random()): number {
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  const whole = Math.floor(pct / 100);
  return whole + (roll * 100 < pct - whole * 100 ? 1 : 0);
}

/**
 * A speed bonus with no ceiling, as a time multiplier: +100% is twice as fast (half the time),
 * +300% four times as fast. It keeps improving forever and never reaches zero.
 */
export function rateMult(pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0) return 1;
  return 1 / (1 + pct / 100);
}

/** A rating with no cap turned into a chance: rating / (rating + 100). 100 rating is 50%, 300 is 75%. */
export function ratingChance(rating: number): number {
  if (!Number.isFinite(rating) || rating <= 0) return 0;
  return rating / (rating + 100);
}
