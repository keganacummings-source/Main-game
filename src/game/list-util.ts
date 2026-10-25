/**
 * Small list helpers for the per-frame systems.
 *
 * Particles, floating numbers, beams and combat FX are all "live for a while, then go away" lists
 * that every frame walks, ages and prunes. Pruning them with `.filter()` builds a fresh array each
 * frame for each list — in the busy modes (TURBZ2's battlefield, TurboCircle's six hundred
 * fighters) that is a steady stream of garbage for the collector to pick up, which shows up as
 * stutter rather than a lower average frame rate. These compact in place instead.
 */

/**
 * Drops entries whose `life` has run out, in place, and returns the same array.
 *
 * With `cap`, keeps at most that many and drops the oldest — the entries at the front — which is
 * what `list.filter(alive).slice(-cap)` did.
 */
export function pruneByLife<T extends { life: number }>(list: T[], cap = 0): T[] {
  return pruneInPlace(list, aliveByLife as (e: T) => boolean, cap);
}

const aliveByLife = (e: { life: number }) => e.life > 0;

/**
 * Drops entries that `keep` rejects, in place, and returns the same array. With `cap`, keeps at
 * most that many, dropping the oldest first.
 */
export function pruneInPlace<T>(list: T[], keep: (e: T) => boolean, cap = 0): T[] {
  let w = 0;
  for (let i = 0; i < list.length; i++) {
    const e = list[i]!;
    if (keep(e)) list[w++] = e;
  }
  if (cap > 0 && w > cap) {
    const drop = w - cap;
    for (let i = 0; i < cap; i++) list[i] = list[i + drop]!;
    w = cap;
  }
  list.length = w;
  return list;
}

/**
 * Fills `out` with the members of `list` that `keep` accepts and returns the count written.
 *
 * For the draw order: the caller hands in the same scratch array every frame, so the visible set is
 * gathered without allocating. Entries past the returned count are leftovers from an earlier frame
 * and must be ignored.
 */
export function gatherInto<T>(list: readonly T[], keep: (e: T) => boolean, out: T[]): number {
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const e = list[i]!;
    if (keep(e)) out[n++] = e;
  }
  // Let go of anything held from a longer frame so the entries cannot be kept alive by the scratch.
  if (out.length > n) out.length = n;
  return n;
}
