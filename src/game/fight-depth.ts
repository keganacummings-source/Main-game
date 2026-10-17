/**
 * Melee tempo and spell weaving. Pure rules so the fight can be tested without the engine.
 *
 * Melee: stand in the right place, and don't mash one verse. A clinch hits harder than a tip.
 * Two different cuts set up a finisher (or a heavy crush). The finisher cleaves, opens their
 * guard, then you need a breath. Taking a hit drops the chain.
 *
 * Spells: the last few elements hang in the air. Repeating one resonates. A third, new element
 * is a chord that spills onto neighbours. A channel spends whatever you have stored. Fill the
 * focus bar and the next verse overcasts — louder, and you are briefly brittle. A hit while
 * you are still casting shatters the weave.
 */

export const MELEE_CHAIN_WINDOW = 2.6;
export const MELEE_RECOVER = 0.75;
export const WEAVE_WINDOW = 7;
export const FOCUS_CAP = 100;

export type MeleeChain = { n: number; t: number; last: string; recover: number };
export type Weave = { types: string[]; t: number; focus: number };

export type MeleePlan = {
  /** Multiplier on top of the verse's own tactic multiplier. */
  mult: number;
  /** 1 opener, 2 link, 3 finisher, 0 while recovering. */
  step: number;
  label: string;
  /** Finisher and crush also nick foes beside the target. */
  cleave: boolean;
  /** How much poise this blow puts on the foe. Three poise opens their guard. */
  poise: number;
};

export type SpellPlan = {
  mult: number;
  label: string;
  /** Extra splash radius. 0 if the verse does not spill. */
  splash: number;
  splashMult: number;
  /** Fraction of the cooldown handed back. */
  refund: number;
  /** A channel spends the stored elements. */
  consume: boolean;
  focusAfter: number;
  /** The bar was full: this verse is the loud one, and the hunter is brittle after. */
  overcast: boolean;
};

export function freshMelee(): MeleeChain {
  return { n: 0, t: 0, last: "", recover: 0 };
}

export function freshWeave(): Weave {
  return { types: [], t: 0, focus: 0 };
}

export function tickMelee(c: MeleeChain, dt: number): MeleeChain {
  const recover = Math.max(0, c.recover - dt);
  const t = c.t - dt;
  if (t <= 0) return { n: 0, t: 0, last: "", recover };
  return { n: c.n, t, last: c.last, recover };
}

/** Out of the weave window the elements fade. Focus leaks slowly so a pause is not a full reset. */
export function tickWeave(w: Weave, dt: number): Weave {
  if (w.t - dt <= 0) {
    return { types: [], t: 0, focus: Math.max(0, w.focus - dt * 6) };
  }
  return { types: w.types, t: w.t - dt, focus: w.focus };
}

function bandOf(dist: number, reach: number): { mult: number; label: string } {
  const ratio = dist / Math.max(32, reach);
  if (ratio <= 0.4) return { mult: 1.16, label: "CLINCH" };
  if (ratio >= 0.82) return { mult: 0.86, label: "TIP" };
  return { mult: 1, label: "" };
}

/** What this melee verse will do, before it lands. A miss does not commit it. */
export function planMelee(c: MeleeChain, moveId: string, tactic: string, dist: number, reach: number): MeleePlan {
  const band = bandOf(dist, reach);
  if (c.recover > 0) {
    return { mult: band.mult * 0.82, step: 0, label: "RECOVER", cleave: false, poise: 0 };
  }
  const same = c.n > 0 && c.last === moveId;
  if (tactic === "heavy") {
    if (c.n >= 2) return { mult: band.mult * 1.22, step: 3, label: "CRUSH", cleave: true, poise: 2 };
    return { mult: band.mult, step: 1, label: band.label || "HEAVY", cleave: false, poise: 1 };
  }
  const step = c.n <= 0 ? 1 : Math.min(3, c.n + 1);
  if (step === 1) return { mult: band.mult, step, label: band.label || "CUT", cleave: false, poise: 1 };
  if (step === 2) {
    return { mult: band.mult * (same ? 1.04 : 1.14), step, label: same ? "REPEAT" : "LINK", cleave: false, poise: 1 };
  }
  return { mult: band.mult * (same ? 1.16 : 1.34), step, label: "FINISHER", cleave: true, poise: 2 };
}

export function commitMelee(c: MeleeChain, plan: MeleePlan, moveId: string): MeleeChain {
  if (plan.step <= 0) return { n: 0, t: 0, last: "", recover: Math.max(0.15, c.recover) };
  if (plan.step >= 3) return { n: 0, t: 0, last: "", recover: MELEE_RECOVER };
  return { n: plan.step, t: MELEE_CHAIN_WINDOW, last: moveId, recover: 0 };
}

export function breakMelee(c: MeleeChain): MeleeChain {
  return { n: 0, t: 0, last: "", recover: c.recover };
}

/** What this spell will do. Elements already in the air change it. */
export function planSpell(w: Weave, type: string, tactic: string, priority: number): SpellPlan {
  const types = w.t > 0 ? w.types : [];
  const copies = types.filter((t) => t === type).length;
  const distinct = new Set(types);
  const channel = tactic === "channel";
  const overcast = w.focus >= FOCUS_CAP && !channel;
  let mult = overcast ? 1.38 : 1;
  let label = overcast ? "OVERCAST" : "";
  let splash = 0;
  let splashMult = 0;
  let refund = 0;
  const consume = channel && types.length > 0;
  if (channel) {
    mult *= 1 + types.length * 0.14;
    if (types.length) label = label || "HYMN";
  } else if (copies > 0) {
    mult *= 1 + Math.min(0.24, copies * 0.1);
    label = label || "RESONANCE";
  }
  const chord = !channel && copies === 0 && !distinct.has(type) && distinct.size >= 2;
  if (chord) {
    mult *= 1.12;
    splash = 56;
    splashMult = 0.42;
    refund = 0.18;
    label = "CHORD";
  }
  const gain = channel ? 6 : priority >= 2 ? 12 : 20;
  const extra = !channel && copies > 0 ? 8 : 0;
  let focusAfter = overcast ? 0 : Math.min(FOCUS_CAP, w.focus + gain + extra);
  if (consume) focusAfter = Math.max(0, focusAfter - 12);
  return { mult, label, splash, splashMult, refund, consume, focusAfter, overcast };
}

export function commitSpell(w: Weave, type: string, plan: SpellPlan): Weave {
  if (plan.consume) return { types: [], t: 0, focus: plan.focusAfter };
  const prev = w.t > 0 ? w.types : [];
  return { types: prev.concat(type).slice(-3), t: WEAVE_WINDOW, focus: plan.focusAfter };
}

/** A blow landed while the verse was still leaving the hands. */
export function shatterWeave(w: Weave): Weave {
  return { types: [], t: 0, focus: Math.max(0, Math.floor(w.focus * 0.4)) };
}

/**
 * A spell cares what is already on the foe. The verse that applies a status does not
 * benefit from it; the next one of that school does.
 */
export function schoolMult(type: string, ids: readonly string[]): { mult: number; label: string } {
  const has = (id: string) => ids.includes(id);
  switch (type) {
    case "fire":
      return has("burn") ? { mult: 1.16, label: "FEED" } : { mult: 1, label: "" };
    case "water":
      return has("soak") ? { mult: 1.12, label: "DROWN" } : { mult: 1, label: "" };
    case "ice":
      return has("root") || has("sleep") ? { mult: 1.14, label: "SHATTER" } : { mult: 1, label: "" };
    case "earth":
      return has("root") ? { mult: 1.14, label: "BURIED" } : { mult: 1, label: "" };
    case "electric":
      return has("spark") ? { mult: 1.12, label: "ARC" } : { mult: 1, label: "" };
    case "air":
      return has("spark") ? { mult: 1.12, label: "SHEAR" } : { mult: 1, label: "" };
    case "light":
      return has("expose") ? { mult: 1.14, label: "JUDGE" } : { mult: 1, label: "" };
    case "void":
      return has("gloom") || has("silence") ? { mult: 1.12, label: "HOLLOW" } : { mult: 1, label: "" };
    case "spirit":
    case "ghoul":
      return has("leech") ? { mult: 1.12, label: "HUNGER" } : { mult: 1, label: "" };
    default:
      return { mult: 1, label: "" };
  }
}

/** Up to `count` foes inside `radius` of the hunter, walked in order so a rush can hit each one. */
export function pickRushTargets<T extends { x: number; y: number }>(
  from: { x: number; y: number },
  foes: readonly T[],
  radius: number,
  count: number,
  prefer?: T | null,
): T[] {
  const left = foes.filter((f) => Math.hypot(f.x - from.x, f.y - from.y) <= radius);
  const out: T[] = [];
  let cursor = from;
  if (prefer && left.includes(prefer)) {
    left.splice(left.indexOf(prefer), 1);
    out.push(prefer);
    cursor = prefer;
  }
  while (out.length < count && left.length) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < left.length; i++) {
      const d = Math.hypot(left[i]!.x - cursor.x, left[i]!.y - cursor.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    const next = left.splice(best, 1)[0]!;
    out.push(next);
    cursor = next;
  }
  return out;
}
