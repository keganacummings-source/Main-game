/**
 * Health, mana and stamina are one body.
 * Max health is the body. Mana and stamina are shares of it, so a bigger body
 * (level, vitality, class health, Body Tide) lifts all three, and the class
 * decides which share is the deep one.
 */
export type RoleName = "Tank" | "Bruiser" | "Mobility" | "Caster" | "Support" | "Marksman";
export type StyleName = "melee" | "ranged" | "mixed";

export type PoolBias = { mana: number; stam: number };

const ROLE_BIAS: Record<RoleName, PoolBias> = {
  Tank: { mana: 0.32, stam: 0.72 },
  Bruiser: { mana: 0.34, stam: 0.86 },
  Marksman: { mana: 0.4, stam: 0.64 },
  Caster: { mana: 0.96, stam: 0.36 },
  Support: { mana: 0.74, stam: 0.44 },
  Mobility: { mana: 0.5, stam: 0.7 },
};

/** Melee classes live in stamina. Casters and mixed kits lean on mana. */
export function poolBias(role: string, fightStyle: string): PoolBias {
  const base = ROLE_BIAS[(role as RoleName)] ?? ROLE_BIAS.Bruiser;
  const mana = base.mana * (fightStyle === "melee" ? 0.9 : fightStyle === "ranged" ? 1.08 : 1.06);
  const stam = base.stam * (fightStyle === "melee" ? 1.12 : fightStyle === "ranged" ? 0.92 : 1.04);
  return { mana, stam };
}

export type PoolInput = {
  hp: number;
  role: string;
  fightStyle: string;
  manaSkill: number;
  stamSkill: number;
  magic: number;
  physical: number;
  survival: number;
  manaWell: number;
  stamWell: number;
  manaFlow: number;
  stamFlow: number;
};

export type PoolCaps = {
  hp: number;
  maxMana: number;
  maxStam: number;
  /** Mana restored per second while fresh and out of combat. */
  manaRate: number;
  stamRate: number;
};

export function derivePools(input: PoolInput): PoolCaps {
  const hp = Math.max(20, Math.floor(input.hp) || 20);
  const bias = poolBias(input.role, input.fightStyle);
  const endure = 1 + Math.max(0, input.survival) * 0.0015;
  const manaMult = endure
    * (1 + Math.max(0, input.manaSkill) * 0.01)
    * (1 + Math.max(0, input.magic) * 0.0025)
    * (1 + Math.max(0, input.manaWell) / 100);
  const stamMult = endure
    * (1 + Math.max(0, input.stamSkill) * 0.01)
    * (1 + Math.max(0, input.physical) * 0.0025)
    * (1 + Math.max(0, input.stamWell) / 100);
  const maxMana = Math.max(12, Math.round(hp * bias.mana * manaMult));
  const maxStam = Math.max(12, Math.round(hp * bias.stam * stamMult));
  const manaFlow = 1 + Math.max(0, input.manaFlow) / 100;
  const stamFlow = 1 + Math.max(0, input.stamFlow) / 100;
  return {
    hp,
    maxMana,
    maxStam,
    manaRate: maxMana * 0.12 * manaFlow,
    stamRate: maxStam * 0.12 * stamFlow,
  };
}

/** In a fight the wells refill at a third of the resting rate. */
export function combatRate(resting: number, inCombat: boolean): number {
  return resting * (inCombat ? 1 / 3 : 1);
}
