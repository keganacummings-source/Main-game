/**
 * Ghost abilities. Every ghost rolls abilities when it is made: 1 at Common and Uncommon, 2 at Rare and
 * Epic, 3 at Legendary and Mythic. Each roll has its own quality (0–100%), and its strength grows with
 * the ghost's level and rarity.
 *
 * Abilities only work while the ghost is out with you or tagged as a tiny follower. Passive abilities
 * feed the same enchantment numbers gear and auras do (the engine's chan()); timed ones fire on their own
 * cooldowns and start on a full cooldown the moment they switch on, so swapping ghosts gives no free use.
 *
 * Bonuses from many ghosts stack, but every ability has a cap. Two abilities are shiny-only.
 *
 * Pure data and maths (no engine, no DOM), so tests, the UI and the wiki read the same numbers.
 */
import type { Rng } from "./content";
import { clampRarity } from "./ghost-style";

export type GhostAbilityRoll = { id: string; q: number };
export type AbilityKind = "passive" | "timed";

export type GhostAbilityDef = {
  id: string;
  name: string;
  kind: AbilityKind;
  /** Only shiny ghosts can roll it. */
  shiny?: boolean;
  /** Passive: the enchantment channel it adds to (see engine chan()). */
  chan?: string;
  /** Value at quality 50%, Common, level 1 (before growth). Timed damage adds `perLevel` per ghost level. */
  base: number;
  perLevel?: number;
  /** Most all your ghosts together can give. */
  cap: number;
  /** Timed: seconds between uses at Common rarity, mid quality. */
  cd?: number;
  /** How much faster a timed ability recharges per rarity tier (0.04 = 4%). */
  cdRarity?: number;
  unit: "%" | "dmg" | "pct-hp" | "block";
  /** Plain words, with {v} for the value and {cd} for the cooldown. */
  about: string;
  /** Short tag for badges. */
  tag: string;
};

export const GHOST_ABILITIES: readonly GhostAbilityDef[] = [
  // Passive
  { id: "ghost_fang", name: "Ghost Fang", kind: "passive", chan: "might", base: 4, cap: 30, unit: "%", about: "+{v}% damage on every hit you land.", tag: "Damage" },
  { id: "phantom_hide", name: "Phantom Hide", kind: "passive", chan: "ward", base: 8, cap: 60, unit: "%", about: "+{v} Ward: you take less damage from every blow.", tag: "Defense" },
  { id: "haunt_step", name: "Haunt Step", kind: "passive", chan: "swift_step", base: 4, cap: 30, unit: "%", about: "+{v}% movement speed.", tag: "Speed" },
  { id: "grave_lore", name: "Grave Lore", kind: "passive", chan: "xp_boost", base: 5, cap: 40, unit: "%", about: "+{v}% XP from kills.", tag: "XP" },
  { id: "coin_whisper", name: "Coin Whisper", kind: "passive", chan: "kyo_find", base: 6, cap: 50, unit: "%", about: "+{v}% kyo from kills.", tag: "Kyo" },
  { id: "lucky_wisp", name: "Lucky Wisp", kind: "passive", chan: "loot_find", base: 5, cap: 40, unit: "%", about: "+{v} loot luck: more gear drops, and better ones.", tag: "Loot" },
  { id: "echo_strike", name: "Echo Strike", kind: "passive", chan: "double_strike", base: 3, cap: 20, unit: "%", about: "{v}% chance your hits strike twice.", tag: "Double hit" },
  { id: "keen_eye", name: "Keen Eye", kind: "passive", chan: "crit_edge", base: 2, cap: 15, unit: "%", about: "+{v}% critical hit chance.", tag: "Crit" },
  { id: "life_sip", name: "Life Sip", kind: "passive", chan: "leech_edge", base: 1.5, cap: 10, unit: "%", about: "Heal {v}% of the damage you deal.", tag: "Lifesteal" },
  { id: "ghost_lure", name: "Ghost Lure", kind: "passive", chan: "catch_boost", base: 10, cap: 80, unit: "%", about: "+{v} ghost lure: fallen foes linger as ghosts more often.", tag: "Catch" },
  { id: "quick_verse", name: "Quick Verse", kind: "passive", chan: "swift", base: 3, cap: 25, unit: "%", about: "+{v} Swift: your verses recharge faster.", tag: "Cooldowns" },
  { id: "thorn_veil", name: "Thorn Veil", kind: "passive", chan: "thorns", base: 4, cap: 30, unit: "%", about: "+{v} Thorns: foes that hit you take some back.", tag: "Thorns" },
  { id: "kindred_bond", name: "Kindred Bond", kind: "passive", chan: "spirit_bond", base: 6, cap: 50, unit: "%", about: "+{v}% damage from every ghost fighting beside you.", tag: "Ghost damage" },
  { id: "ember_touch", name: "Ember Touch", kind: "passive", chan: "ghost_burn", base: 3, cap: 20, unit: "%", about: "{v}% chance your hits set the foe burning.", tag: "Burn" },
  { id: "mana_font", name: "Mana Font", kind: "passive", chan: "mana_well", base: 6, cap: 40, unit: "%", about: "+{v}% maximum mana.", tag: "Mana" },
  { id: "steady_breath", name: "Steady Breath", kind: "passive", chan: "stam_well", base: 6, cap: 40, unit: "%", about: "+{v}% maximum stamina.", tag: "Stamina" },
  { id: "font_tide", name: "Font Tide", kind: "passive", chan: "mana_flow", base: 5, cap: 35, unit: "%", about: "Mana recovers +{v}% faster.", tag: "Mana regen" },
  { id: "second_lung", name: "Second Lung", kind: "passive", chan: "stam_flow", base: 5, cap: 35, unit: "%", about: "Stamina recovers +{v}% faster.", tag: "Stamina regen" },
  { id: "shared_body", name: "Shared Body", kind: "passive", chan: "body_tide", base: 4, cap: 24, unit: "%", about: "+{v}% health. Mana and stamina rise with it.", tag: "Body" },
  // Timed
  { id: "spirit_guard", name: "Spirit Guard", kind: "timed", base: 1, cap: 1, cd: 60, cdRarity: 0.04, unit: "block", about: "Blocks one hit completely, once every {cd}s.", tag: "Block" },
  { id: "soul_bomb", name: "Soul Bomb", kind: "timed", base: 18, perLevel: 3.5, cap: 0, cd: 16, cdRarity: 0.03, unit: "dmg", about: "In a fight, throws a soul bomb every {cd}s: {v} damage to every foe in the blast.", tag: "Area damage" },
  { id: "soul_mend", name: "Soul Mend", kind: "timed", base: 2.5, cap: 12, cd: 12, cdRarity: 0.03, unit: "pct-hp", about: "Heals you for {v}% of your health every {cd}s.", tag: "Healing" },
  { id: "second_wind", name: "Second Wind", kind: "timed", base: 18, cap: 50, cd: 150, cdRarity: 0.04, unit: "pct-hp", about: "When a hit drops you under 25% health, heals {v}% of your health. Once every {cd}s.", tag: "Emergency heal" },
  { id: "well_gift", name: "Well Gift", kind: "timed", base: 18, cap: 40, cd: 22, cdRarity: 0.03, unit: "pct-hp", about: "Refills {v}% of your mana and {v}% of your stamina every {cd}s.", tag: "Pools" },
  // Shiny only
  { id: "shiny_charm", name: "Shiny Charm", kind: "passive", shiny: true, chan: "shiny_luck", base: 15, cap: 100, unit: "%", about: "+{v}% shiny odds on every ghost you find.", tag: "Shiny odds" },
  { id: "radiant_surge", name: "Radiant Surge", kind: "timed", shiny: true, base: 24, perLevel: 4.5, cap: 0, cd: 40, cdRarity: 0.04, unit: "dmg", about: "In a fight, bursts with light every {cd}s: {v} damage to every foe near you and a small heal.", tag: "Nova" },
];
export const GHOST_ABILITY_BY_ID: Record<string, GhostAbilityDef> = Object.fromEntries(GHOST_ABILITIES.map((a) => [a.id, a]));
export const GHOST_ABILITY_COUNT = GHOST_ABILITIES.length;

/** Rarity multiplier on strength. */
export const RARITY_POWER = [1, 1.15, 1.3, 1.5, 1.75, 2.1] as const;

/** 1 ability at Common/Uncommon, 2 at Rare/Epic, 3 at Legendary/Mythic. */
export function abilityCount(rarity: number): number {
  const r = clampRarity(rarity);
  return r >= 4 ? 3 : r >= 2 ? 2 : 1;
}

/** Rolls a fresh ghost's abilities. Shiny ghosts have an even chance their first roll is shiny-only. */
export function rollGhostAbilities(rng: Rng, rarity: number, shiny = false): GhostAbilityRoll[] {
  const out: GhostAbilityRoll[] = [];
  const n = abilityCount(rarity);
  const normal = GHOST_ABILITIES.filter((a) => !a.shiny);
  const special = GHOST_ABILITIES.filter((a) => a.shiny);
  let guard = 0;
  while (out.length < n && guard++ < 60) {
    const pool = shiny && out.length === 0 && rng() < 0.5 ? special : shiny && rng() < 0.08 ? special : normal;
    const def = pool[Math.floor(rng() * pool.length)]!;
    if (out.some((r) => r.id === def.id)) continue;
    // Quality leans a little higher on rarer ghosts.
    const q = Math.min(1, Math.max(0, rng() * 0.85 + rng() * 0.15 + clampRarity(rarity) * 0.02));
    out.push({ id: def.id, q: Math.round(q * 100) / 100 });
  }
  return out;
}

/** Makes sure a ghost has a valid ability list (old saves, damaged data, rarity changes). */
export function normalizeAbilities(list: unknown, rng: Rng, rarity: number, shiny: boolean): GhostAbilityRoll[] {
  const clean: GhostAbilityRoll[] = [];
  if (Array.isArray(list)) {
    for (const row of list) {
      const id = String((row as GhostAbilityRoll)?.id ?? "");
      const def = GHOST_ABILITY_BY_ID[id];
      if (!def || clean.some((r) => r.id === id) || (def.shiny && !shiny)) continue;
      const q = Number((row as GhostAbilityRoll).q);
      clean.push({ id, q: Number.isFinite(q) ? Math.max(0, Math.min(1, q)) : 0.5 });
    }
  }
  const want = abilityCount(rarity);
  if (clean.length > want) clean.length = want;
  if (clean.length < want) {
    for (const r of rollGhostAbilities(rng, rarity, shiny)) {
      if (clean.length >= want) break;
      if (!clean.some((c) => c.id === r.id)) clean.push(r);
    }
  }
  return clean;
}

/** How much a ghost's level grows its abilities: ×1.06 at level 1, ×1.6 at 100, ×2.2 at 400. */
export function levelGrowth(level: number): number {
  return 1 + Math.sqrt(Math.max(1, Math.min(1000, level || 1))) * 0.06;
}
export function qualityMult(q: number): number {
  return 0.75 + 0.5 * Math.max(0, Math.min(1, q));
}

export type GhostLike = { level: number; rarity: number };

/** The ability's number for this ghost (percent, damage or share of health, by `unit`). */
export function abilityValue(roll: GhostAbilityRoll, g: GhostLike): number {
  const def = GHOST_ABILITY_BY_ID[roll.id];
  if (!def) return 0;
  const r = clampRarity(g.rarity);
  const lv = Math.max(1, g.level || 1);
  if (def.unit === "block") return 1;
  if (def.unit === "dmg") return Math.round((def.base + lv * (def.perLevel ?? 0)) * qualityMult(roll.q) * RARITY_POWER[r]!);
  const v = def.base * qualityMult(roll.q) * RARITY_POWER[r]! * levelGrowth(lv);
  return Math.round(Math.min(def.cap, v) * 10) / 10;
}

/** Seconds between uses (timed abilities). Higher rarity and quality recharge a little faster. */
export function abilityCooldown(roll: GhostAbilityRoll, g: GhostLike): number {
  const def = GHOST_ABILITY_BY_ID[roll.id];
  if (!def?.cd) return 0;
  const r = clampRarity(g.rarity);
  return Math.round(def.cd * (1 - r * (def.cdRarity ?? 0.03)) * (1.1 - 0.2 * Math.max(0, Math.min(1, roll.q))) * 10) / 10;
}

export function abilityText(roll: GhostAbilityRoll, g: GhostLike): string {
  const def = GHOST_ABILITY_BY_ID[roll.id];
  if (!def) return "";
  const v = abilityValue(roll, g);
  return def.about.replace("{v}", String(v)).replace("{cd}", String(abilityCooldown(roll, g)));
}

export type AbilityView = {
  id: string; name: string; kind: AbilityKind; shiny: boolean; tag: string;
  quality: number; value: number; unit: GhostAbilityDef["unit"]; cd: number; cap: number; text: string;
};
export function describeAbilities(list: GhostAbilityRoll[] | undefined, g: GhostLike): AbilityView[] {
  return (list ?? []).flatMap((roll) => {
    const def = GHOST_ABILITY_BY_ID[roll.id];
    if (!def) return [];
    return [{
      id: def.id, name: def.name, kind: def.kind, shiny: !!def.shiny, tag: def.tag,
      quality: Math.round(roll.q * 100), value: abilityValue(roll, g), unit: def.unit,
      cd: abilityCooldown(roll, g), cap: def.cap, text: abilityText(roll, g),
    }];
  });
}

export type TimedTotal = { value: number; cd: number; n: number; names: string[] };
export type GhostAggregate = {
  /** Passive totals per enchantment channel, already capped. */
  chan: Record<string, number>;
  /** Timed abilities: one shared timer each, value and cooldown from every ghost that has it. */
  timed: Record<string, TimedTotal>;
};

/**
 * Totals for every working ghost. Passives add up to their cap. A timed ability takes its best value,
 * plus half of every other ghost's (damage stacks to at most twice the best), and recharges 10% faster
 * per extra ghost that has it (at most 40% faster).
 */
export function aggregateGhostAbilities(ghosts: (GhostLike & { name?: string; abilities?: GhostAbilityRoll[] })[], mult = 1): GhostAggregate {
  const k = Number.isFinite(mult) && mult > 0 ? mult : 1;
  const chan: Record<string, number> = {};
  const parts: Record<string, { vals: number[]; cds: number[]; names: string[] }> = {};
  for (const g of ghosts) {
    for (const roll of g.abilities ?? []) {
      const def = GHOST_ABILITY_BY_ID[roll.id];
      if (!def) continue;
      const v = def.unit === "block" ? 1 : Math.min(def.cap > 0 ? def.cap : Infinity, abilityValue(roll, g) * k);
      if (def.kind === "passive" && def.chan) chan[def.chan] = Math.min(def.cap, (chan[def.chan] ?? 0) + v);
      else {
        const p = (parts[def.id] = parts[def.id] ?? { vals: [], cds: [], names: [] });
        p.vals.push(v);
        p.cds.push(abilityCooldown(roll, g));
        if (g.name) p.names.push(g.name);
      }
    }
  }
  for (const k of Object.keys(chan)) chan[k] = Math.round(chan[k]! * 10) / 10;
  const timed: Record<string, TimedTotal> = {};
  for (const [id, p] of Object.entries(parts)) {
    const def = GHOST_ABILITY_BY_ID[id]!;
    const vals = p.vals.slice().sort((a, b) => b - a);
    const best = vals[0] ?? 0;
    let value = best + vals.slice(1).reduce((n, v) => n + v * 0.5, 0);
    value = def.cap > 0 ? Math.min(def.cap, value) : Math.min(best * 2, value);
    const n = vals.length;
    const cd = Math.min(...p.cds) * Math.max(0.6, 1 - 0.1 * (n - 1));
    timed[id] = { value: Math.round(value * 10) / 10, cd: Math.round(cd * 10) / 10, n, names: p.names };
  }
  return { chan, timed };
}
