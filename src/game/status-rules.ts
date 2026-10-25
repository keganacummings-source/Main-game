/**
 * Status rules shared by the hunter and every foe.
 *
 * - Nothing stacks: a second copy of an effect refreshes the first (never longer than its cap).
 * - Hard control (sleep, root, silence) cannot be extended while it is on, is capped short,
 *   and when it ends — runs out, is broken or cleansed — the target is immune to that effect
 *   for a few seconds. Control cannot be chained.
 * - Tough foes (bosses, bounties, witches, hunters) shake hard control off twice as fast.
 */

export type Status = { id: string; t: number; tick?: number };
export type ApplyResult = "applied" | "refreshed" | "resisted" | "ignored";

export const HARD_CC: Record<string, { cap: number; immune: number; name: string }> = {
  sleep: { cap: 2.5, immune: 7, name: "Sleep" },
  root: { cap: 2.5, immune: 5, name: "Root" },
  silence: { cap: 3, immune: 6, name: "Silence" },
};

/** Soft effects refresh up to these caps (seconds) instead of stacking. */
export const SOFT_CAP: Record<string, number> = { soak: 4.5, gloom: 5, expose: 5, spark: 4.5, leech: 4.5, swift: 8, shell: 8 };

export const IMMUNE_PREFIX = "immune:";
export const immuneId = (id: string) => `${IMMUNE_PREFIX}${id}`;
export const isImmuneEntry = (s: Status) => s.id.startsWith(IMMUNE_PREFIX);

// `hasStatus` and `isImmune` are asked several times per actor per frame by the mob and combat
// loops, so they walk the list by index: same answer as `.some()`, without allocating a closure.
export function hasStatus(list: Status[], id: string): boolean {
  for (let i = 0; i < list.length; i++) {
    const s = list[i]!;
    if (s.id === id && s.t > 0) return true;
  }
  return false;
}

export function isImmune(list: Status[], id: string): boolean {
  const want = immuneId(id);
  for (let i = 0; i < list.length; i++) {
    const s = list[i]!;
    if (s.id === want && s.t > 0) return true;
  }
  return false;
}

function grantImmunity(list: Status[], id: string, tough = false): void {
  const rule = HARD_CC[id];
  if (!rule) return;
  const t = rule.immune * (tough ? 1.3 : 1);
  const have = list.find((s) => s.id === immuneId(id));
  if (have) have.t = Math.max(have.t, t);
  else list.push({ id: immuneId(id), t });
}

/** Applies an effect in place. Returns what happened so callers can show RESIST etc. */
export function applyStatus(list: Status[], id: string, t: number, opts: { tough?: boolean } = {}): ApplyResult {
  if (!id || id === "none" || !(t > 0)) return "ignored";
  const hard = HARD_CC[id];
  if (hard) {
    if (isImmune(list, id)) return "resisted";
    // Already held: hard control is never extended, so it cannot be chained.
    if (hasStatus(list, id)) return "ignored";
    list.push({ id, t: Math.min(t, hard.cap) * (opts.tough ? 0.5 : 1) });
    return "applied";
  }
  const cap = SOFT_CAP[id] ?? 6;
  const have = list.find((s) => s.id === id);
  if (have) {
    have.t = Math.max(have.t, Math.min(t, cap));
    return "refreshed";
  }
  list.push({ id, t: Math.min(t, cap) });
  return "applied";
}

/** Ends an effect early (broken, woken, cleansed). Hard control leaves immunity behind. */
export function endStatus(list: Status[], id: string, tough = false): boolean {
  const before = list.length;
  for (let i = list.length - 1; i >= 0; i--) if (list[i]!.id === id) list.splice(i, 1);
  const ended = list.length !== before;
  if (ended) grantImmunity(list, id, tough);
  return ended;
}

/** Clears every harmful effect (Cleanse). Immunity windows stay, and new ones are granted. */
export function cleanseStatuses(list: Status[], keep: Set<string>): Status[] {
  const out: Status[] = [];
  const cleared: string[] = [];
  for (const s of list) {
    if (isImmuneEntry(s) || keep.has(s.id)) out.push(s);
    else cleared.push(s.id);
  }
  for (const id of cleared) grantImmunity(out, id);
  return out;
}

/** Counts every effect down; hard control that runs out leaves its immunity window. */
export function tickStatuses(list: Status[], dt: number, tough = false): Status[] {
  let expired: string[] | null = null;
  let anyExpired = false;
  for (let i = 0; i < list.length; i++) {
    const s = list[i]!;
    s.t -= dt;
    if (s.t <= 0) {
      anyExpired = true;
      if (HARD_CC[s.id]) (expired ??= []).push(s.id);
    }
  }
  // Nothing ran out this frame (the common case), so hand back the same list rather than
  // allocating a copy of it for every actor on every frame.
  if (!anyExpired) return list;
  const out = list.filter((s) => s.t > 0);
  if (expired) for (const id of expired) grantImmunity(out, id, tough);
  return out;
}

/** Struggle: each button press while asleep or rooted shaves time off. */
export function struggle(list: Status[], amount = 0.3): string | null {
  const s = list.find((x) => (x.id === "sleep" || x.id === "root") && x.t > 0);
  if (!s) return null;
  s.t = Math.max(0.01, s.t - amount);
  return s.id;
}
