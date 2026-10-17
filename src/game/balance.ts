/**
 * Balance patch (V6.1).
 *
 * Three ideas hold the difficulty together:
 *
 * 1. Enemies track the hunter, not their spawn. Every live foe re-reads the hunter's
 *    power a few times a second and resizes itself (level, health, damage, turn speed),
 *    so a foe that spawned at level 3 is still a fight at level 300.
 *
 * 2. Health and damage are measured against the hunter. A foe's health is "how many of
 *    your average hits it takes" and its damage is "what fraction of your health one
 *    clean hit removes". New gear still feels great because the reference the foes read
 *    is smoothed: it climbs toward your real power over a minute or two (faster in
 *    Hardcore) and falls back slowly. Upgrades give a honeymoon, then the world catches up.
 *
 *    Levels are the part the open world does not fully catch. Ordinary foes copy less of
 *    you as you climb (openWorldLevelEdge), so camps get shorter and chip less. Bosses,
 *    witches, bounties, hunters, shrines and everything inside a dungeon ignore most of
 *    that edge and measure themselves against the better of you and a hunter your level
 *    in decent gear (expectedHunterPower). Show up undergeared and they do not shrink.
 *
 * 3. Gear always starts at the hunter's level. Quality, the source (boss, bounty tier,
 *    hunter squad, market) and luck add a bounded percentage on top. Nothing compounds
 *    off the gear you already wear, which is what used to hand out level-1000 pieces.
 *
 * Every number lives in this file so balance passes can stay in one place.
 */
import { MOVES, QUALITY_LEVEL, attackForm, dropGearLevel, moveTactic, type Move, type QualityId, type Rng, type TypeId } from "./content";
import { bend } from "./overmax";

// ---------------------------------------------------------------------------
// Enemy kinds and scaling targets
// ---------------------------------------------------------------------------

export type EnemyKind = "normal" | "animal" | "minion" | "boss" | "witch" | "bounty" | "hunter";

export type EnemyTargets = {
  /** Average player hits needed to drop this foe. */
  hits: number;
  /** Fraction of the hunter's health one clean hit removes, before the hunter's own defenses. */
  frac: number;
  /** Levels above the hunter. Foes are never below the hunter. */
  levelOffset: number;
  /** Turn-order speed relative to the hunter. Positive acts first. */
  speedOffset: number;
};

export type Row = { hits: number; frac: number; lv: number; spd: number };
type Share = { knee: number; ceil: number };

/** Standard mode. Hardcore multiplies these (see HARDCORE).
 *  Bosses and witches hit for a real share of your health. Ordinary foes stay a chip.
 */
export const BASE: Record<EnemyKind, Row> = {
  animal: { hits: 2, frac: 0.04, lv: 0, spd: -2 },
  normal: { hits: 3, frac: 0.09, lv: 0, spd: -1 },
  minion: { hits: 2, frac: 0.035, lv: 1, spd: 0 },
  boss: { hits: 12, frac: 0.13, lv: 4, spd: 3 },
  witch: { hits: 11, frac: 0.14, lv: 3, spd: 2 },
  // Bounties hit hard on purpose: a fumbled fight (no dodge, ward or blink when it matters) kills you.
  bounty: { hits: 10, frac: 0.13, lv: 3, spd: 4 },
  hunter: { hits: 4, frac: 0.055, lv: 3, spd: 3 },
};

/** Where one hit bends once it passes the knee. Trash cannot delete you; bosses and witches can. */
const SHARE: Record<EnemyKind, Share> = {
  animal: { knee: 0.18, ceil: 0.32 },
  normal: { knee: 0.3, ceil: 0.46 },
  minion: { knee: 0.2, ceil: 0.34 },
  hunter: { knee: 0.28, ceil: 0.44 },
  boss: { knee: 0.38, ceil: 0.58 },
  witch: { knee: 0.38, ceil: 0.58 },
  bounty: { knee: 0.4, ceil: 0.62 },
};

/** Hardcore gets the biggest buff: more health, harder hits, higher levels, and it keeps growing. */
export const HARDCORE = { hits: 1.2, frac: 1.35, lv: 2, spd: 1 } as const;

export type TargetOpts = {
  kind: EnemyKind;
  rarity?: number;
  hardcore?: boolean;
  /** hardcoreGrowth() or standardGrowth(). 1 = none. */
  growth?: number;
  /** Bounty tier for bounties. */
  tier?: number;
  /** Wanted level for hunter squads. */
  wanted?: number;
};

export function enemyTargets(o: TargetOpts): EnemyTargets {
  const row = BASE[o.kind] ?? BASE.normal;
  const rarity = Math.max(0, Math.min(4, o.rarity ?? 0));
  const tier = Math.max(0, o.tier ?? 0);
  const wanted = Math.max(1, o.wanted ?? 1);
  let hits = row.hits;
  let frac = row.frac;
  let lv = row.lv;
  let spd = row.spd;
  if (o.kind === "normal" || o.kind === "minion") {
    hits += rarity * (o.kind === "minion" ? 0.25 : 0.75);
    frac += rarity * (o.kind === "minion" ? 0.004 : 0.014);
    lv += rarity;
    spd += rarity;
  }
  if (o.kind === "bounty") {
    hits = Math.min(30, hits + Math.max(0, tier - 1) * 0.5);
    frac = Math.min(0.22, frac + Math.max(0, tier - 1) * 0.003);
    lv += tier;
    spd += Math.min(6, Math.floor(tier / 3));
  }
  if (o.kind === "hunter") {
    hits += (wanted - 1) * 0.5;
    frac = Math.min(0.085, frac + (wanted - 1) * 0.004);
    lv += wanted - 1;
    spd += Math.min(4, wanted - 1);
  }
  const growth = Math.max(1, o.growth ?? 1);
  if (o.hardcore) {
    hits *= HARDCORE.hits;
    frac *= HARDCORE.frac;
    lv += HARDCORE.lv;
    spd += HARDCORE.spd;
  }
  // Health climbs gently. Damage carries most of the late-game climb, and bends per kind
  // so a boss can still take a third of you while a roadside foe stays a chip.
  hits *= Math.pow(growth, 0.35);
  frac *= Math.pow(growth, 0.6);
  lv += Math.floor((growth - 1) * 10);
  const share = SHARE[o.kind] ?? SHARE.normal;
  const bite = bend(frac, share.knee, share.ceil);
  return { hits: Math.round(hits * 10) / 10, frac: bite, levelOffset: Math.max(0, Math.round(lv)), speedOffset: spd };
}

/** Hardcore difficulty climbs with level, nights survived and bounties taken. */
export function hardcoreGrowth(level: number, nights: number, bountyTier = 0): number {
  return Math.min(2.5, 1 + Math.max(0, level) * 0.0025 + Math.max(0, nights) * 0.04 + Math.max(0, bountyTier) * 0.02);
}

/** Standard keeps a real climb so late bosses, witches and dungeons stay a fight. Caps at double. */
export function standardGrowth(level: number, bountyTier = 0): number {
  return Math.min(2, 1 + Math.max(0, level) * 0.0018 + Math.max(0, bountyTier) * 0.01);
}

/**
 * Share of your level the open world fails to copy.
 * 0 at level 1, about 9% by 20, 18% by 40, and it stops at 34% so a pack of foes is
 * still a fight. Dangerous content uses only a fraction of this (see the engine).
 */
export function openWorldLevelEdge(level: number): number {
  const lv = Math.max(1, Math.floor(level) || 1);
  return Math.min(0.34, (lv - 1) * 0.0045);
}

/**
 * What a hunter of this level does in decent gear: a fine weapon, a mid verse, a little
 * Might, and the vitality two fine pieces tend to carry. Dangerous fights read the
 * better of this and your real power, so missing gear does not shrink the foe.
 */
export function expectedHunterPower(level: number): { hit: number; maxHp: number; armor: number } {
  const lv = Math.max(1, Math.floor(level) || 1);
  const weapon = 8 + lv * 2 + 12 + Math.min(40, Math.floor(lv * 0.35));
  const base = 6 + 42 * 0.42 + weapon * 0.35;
  const hit = base * (1 + lv * 0.045) * 1.35 * (1 + Math.min(0.24, lv * 0.0015));
  const vitality = 24 + lv * 1.6;
  const maxHp = 78 + lv * 12 + vitality;
  // About two fine armor pieces. Less than this and dangerous hits land harder.
  const armor = (8 + lv * 2 + 10) * 2;
  return { hit: Math.max(1, hit), maxHp: Math.max(20, maxHp), armor };
}

/**
 * XP for one kill. Ordinary foes are 10 + 4 per level, which is what the level curve
 * is tuned against. Bosses, dungeon clears, witches, shrines and bounties pay more,
 * and a dungeon boss pays more than a world boss.
 */
export function killXpAmount(level: number, kind: { boss?: boolean; dungeon?: boolean; witch?: boolean; shrine?: boolean; bounty?: boolean } = {}): number {
  const lv = Math.max(1, Math.floor(level) || 1);
  let mult = 1;
  if (kind.boss) mult = Math.max(mult, 5);
  if (kind.witch) mult = Math.max(mult, 3.5);
  if (kind.bounty) mult = Math.max(mult, 4.5);
  if (kind.dungeon) mult = Math.max(mult, kind.boss ? 8 : 2.25);
  if (kind.shrine) mult = Math.max(mult, kind.boss ? 7 : 3);
  const xp = Math.floor((10 + lv * 4) * mult);
  return Number.isFinite(xp) ? Math.max(1, xp) : 1;
}

// ---------------------------------------------------------------------------
// Enemy identity: stats, enchants and moves
// ---------------------------------------------------------------------------

export type EnemyStats = {
  /** Health multiplier. */
  hp: number;
  /** Damage multiplier. */
  dmg: number;
  /** Turn speed multiplier. */
  speed: number;
  /** Chance (0–1) for a hit to crit for 1.75x. */
  crit: number;
  /** Chance (0–1) to dodge one of your hits outright. */
  dodge: number;
  /** Fraction of melee and ranged damage ignored. */
  physRes: number;
  /** Fraction of spell damage ignored. */
  spellRes: number;
};

export type MobEnchantId =
  | "vampiric"
  | "thorned"
  | "warded"
  | "frenzied"
  | "swift"
  | "brutal"
  | "regenerating"
  | "evasive"
  | "armored"
  | "spellward"
  | "giant";

export const MOB_ENCHANTS: Record<MobEnchantId, { name: string; about: string }> = {
  vampiric: { name: "Vampiric", about: "Heals 1.5% of its health whenever it lands a hit." },
  thorned: { name: "Thorned", about: "Returns 12% of the damage it takes to you (at most 4% of your health a hit)." },
  warded: { name: "Warded", about: "Takes 15% less damage from everything." },
  frenzied: { name: "Frenzied", about: "Hits 35% harder below half health." },
  swift: { name: "Swift", about: "25% faster turns and quicker wind-ups." },
  brutal: { name: "Brutal", about: "+15% chance to crit for 1.75x damage." },
  regenerating: { name: "Regenerating", about: "Regains 0.4% of its health every second." },
  evasive: { name: "Evasive", about: "+12% chance to dodge your hits." },
  armored: { name: "Armored", about: "Takes 25% less ranged damage. Melee ignores it." },
  spellward: { name: "Spellward", about: "Takes 25% less spell damage." },
  giant: { name: "Giant", about: "30% more health, 10% slower." },
};
export const MOB_ENCHANT_IDS = Object.keys(MOB_ENCHANTS) as MobEnchantId[];

export type Archetype = Partial<EnemyStats> & { bias?: MobEnchantId[]; forms?: ("melee" | "ranged" | "spell")[] };

/** Every element fights differently. */
export const TYPE_ARCHETYPE: Record<TypeId, Archetype> = {
  normal: { forms: ["melee", "ranged"] },
  fire: { hp: 0.9, dmg: 1.18, crit: 0.06, bias: ["brutal", "frenzied"], forms: ["spell", "ranged"] },
  water: { hp: 1.12, dmg: 0.95, bias: ["regenerating", "spellward"], forms: ["ranged", "spell"] },
  earth: { hp: 1.28, dmg: 0.92, speed: 0.9, physRes: 0.12, bias: ["armored", "giant"], forms: ["melee", "ranged"] },
  air: { hp: 0.86, speed: 1.22, dodge: 0.08, bias: ["swift", "evasive"], forms: ["ranged"] },
  electric: { dmg: 1.08, speed: 1.15, crit: 0.08, bias: ["swift", "brutal"], forms: ["spell", "ranged"] },
  ice: { hp: 1.08, speed: 0.95, physRes: 0.06, spellRes: 0.06, bias: ["warded", "armored"], forms: ["spell", "ranged"] },
  void: { hp: 0.92, dmg: 1.22, spellRes: 0.1, bias: ["frenzied", "spellward"], forms: ["spell"] },
  light: { hp: 1.0, dmg: 1.05, spellRes: 0.12, bias: ["warded", "regenerating"], forms: ["spell"] },
  spirit: { hp: 0.9, dodge: 0.1, spellRes: 0.08, bias: ["evasive", "vampiric"], forms: ["spell", "ranged"] },
  ghoul: { hp: 1.15, dmg: 1.05, bias: ["vampiric", "thorned"], forms: ["melee", "spell"] },
};

/** Per-species twists layered on the element. */
export const SPECIES_ARCHETYPE: Record<string, Archetype> = {
  onibi: { dmg: 1.1, bias: ["brutal"] },
  nobi: { hp: 0.8, speed: 1.25, bias: ["swift"] },
  hinotama: { dmg: 1.2, hp: 0.85 },
  kagaribi: { hp: 1.2, bias: ["thorned"] },
  shizuku: { hp: 1.15, bias: ["regenerating"] },
  nami: { dmg: 1.12, bias: ["frenzied"] },
  uroko: { physRes: 0.15, bias: ["armored"] },
  kasa: { dodge: 0.08, bias: ["evasive"] },
  tsuchi: { hp: 1.3, speed: 0.85, bias: ["giant"] },
  kusa: { bias: ["regenerating", "thorned"] },
  yanagi: { dodge: 0.06, bias: ["evasive"] },
  mokuzu: { dmg: 1.1, bias: ["vampiric"] },
  yuki: { spellRes: 0.12, bias: ["warded"] },
  raiju: { speed: 1.3, crit: 0.06, bias: ["swift"] },
  kaze: { speed: 1.25, dodge: 0.06 },
  hikari: { bias: ["spellward"] },
  yami: { dodge: 0.1, bias: ["evasive", "vampiric"] },
  kage: { dodge: 0.14, crit: 0.06, bias: ["evasive"] },
  yomi: { hp: 1.2, bias: ["warded"] },
  naraku: { hp: 1.35, dmg: 1.1, speed: 0.85, bias: ["giant", "frenzied"] },
  muma: { bias: ["vampiric"] },
  umoregi: { hp: 1.25, physRes: 0.15, bias: ["armored", "regenerating"] },
  gaikotsu: { physRes: 0.18, bias: ["armored", "thorned"] },
  wisp: { dodge: 0.1, bias: ["evasive"] },
  saintling: { spellRes: 0.15, bias: ["warded", "regenerating"] },
  hare: { hp: 0.6, dmg: 0.5, speed: 1.3 },
  boar: { hp: 1.4, dmg: 1.1, physRes: 0.1, bias: ["giant"] },
  stag: { hp: 0.9, dmg: 0.7, speed: 1.2 },
  wolf: { dmg: 1.2, speed: 1.2, crit: 0.08, bias: ["swift", "brutal"] },
  crow: { hp: 0.55, dmg: 0.6, speed: 1.35, dodge: 0.12 },
};

function enchantCount(o: KitOpts, rng: Rng): number {
  const rarity = Math.max(0, Math.min(4, o.rarity ?? 0));
  const tier = Math.max(0, o.tier ?? 0);
  const wanted = Math.max(1, o.wanted ?? 1);
  let n = 0;
  switch (o.kind) {
    case "animal":
      n = rng() < 0.2 ? 1 : 0;
      break;
    case "normal":
      n = rarity + (rarity === 0 && rng() < 0.25 ? 1 : 0);
      break;
    case "minion":
      n = 1 + (rng() < 0.35 ? 1 : 0);
      break;
    case "boss":
      n = 3 + (rng() < 0.5 ? 1 : 0);
      break;
    case "witch":
      n = 3;
      break;
    case "bounty":
      n = Math.min(7, 3 + Math.floor(tier / 3));
      break;
    case "hunter":
      n = Math.min(5, 2 + Math.floor((wanted - 1) / 2));
      break;
  }
  if (o.hardcore && o.kind !== "animal") n += 1;
  n += Math.floor(Math.max(0, o.playerLevel ?? 1) / 120);
  return Math.max(0, Math.min(8, n));
}

export type KitOpts = {
  species: string;
  type: TypeId;
  kind: EnemyKind;
  rarity?: number;
  playerLevel?: number;
  hardcore?: boolean;
  tier?: number;
  wanted?: number;
  /** A move the foe should always know (signature). */
  signature?: string;
  /** Enemy Designer: exact stats, fixed enchantments plus N random ones, and an exact move list. */
  design?: { stats: EnemyStats; enchants: MobEnchantId[]; extraEnchants: number; moves: string[] };
};

export type EnemyKit = { stats: EnemyStats; enchants: MobEnchantId[]; moves: string[] };

const OFFENSE_BLOCK = new Set(["dash", "surge", "heal", "ward", "roll"]);
function offensive(m: Move): boolean {
  return m.effect !== "mend" && m.effect !== "shell" && !OFFENSE_BLOCK.has(moveTactic(m)) && m.target !== "player";
}

/** Rolls one foe's personal stat line, enchantments and move list. */
export function rollEnemyKit(rng: Rng, o: KitOpts): EnemyKit {
  if (o.design) return designKit(rng, o);
  const t = TYPE_ARCHETYPE[o.type] ?? TYPE_ARCHETYPE.normal;
  const s = SPECIES_ARCHETYPE[o.species] ?? {};
  const jitter = () => 0.9 + rng() * 0.2;
  const stats: EnemyStats = {
    hp: (t.hp ?? 1) * (s.hp ?? 1) * jitter(),
    dmg: (t.dmg ?? 1) * (s.dmg ?? 1) * jitter(),
    speed: (t.speed ?? 1) * (s.speed ?? 1) * (0.95 + rng() * 0.1),
    crit: (t.crit ?? 0.03) + (s.crit ?? 0),
    dodge: (t.dodge ?? 0) + (s.dodge ?? 0),
    physRes: (t.physRes ?? 0) + (s.physRes ?? 0),
    spellRes: (t.spellRes ?? 0) + (s.spellRes ?? 0),
  };
  // Enchantments lean on the species and element, then fill from the whole list.
  const want = enchantCount(o, rng);
  const bias = [...(s.bias ?? []), ...(t.bias ?? [])];
  const enchants: MobEnchantId[] = [];
  let guard = 0;
  while (enchants.length < want && guard++ < 60) {
    const fromBias = bias.length && rng() < 0.55;
    const id = fromBias ? bias[Math.floor(rng() * bias.length)]! : MOB_ENCHANT_IDS[Math.floor(rng() * MOB_ENCHANT_IDS.length)]!;
    if (!enchants.includes(id)) enchants.push(id);
  }
  for (const id of enchants) {
    if (id === "giant") { stats.hp *= 1.3; stats.speed *= 0.9; }
    if (id === "swift") stats.speed *= 1.25;
    if (id === "brutal") stats.crit += 0.15;
    if (id === "evasive") stats.dodge += 0.12;
    if (id === "armored") stats.physRes += 0.25;
    if (id === "spellward") stats.spellRes += 0.25;
  }
  // Dodge, crit and resists are stored raw, including overmax from enchantments.
  // Combat bends them so a stack still matters but cannot reach certainty or immunity.

  // Moves: a short kit of the foe's element, preferring the forms its archetype likes.
  const size = o.kind === "animal" ? 1 : o.kind === "normal" || o.kind === "minion" ? 2 + (rng() < 0.4 ? 1 : 0) : o.kind === "hunter" ? 3 : 4;
  const forms = s.forms ?? t.forms ?? ["melee", "ranged", "spell"];
  let pool = MOVES.filter((m) => m.type === o.type && offensive(m));
  if (o.kind === "animal") pool = pool.filter((m) => attackForm(m) === "melee");
  if (!pool.length) pool = MOVES.filter((m) => (o.kind === "animal" ? attackForm(m) === "melee" : true) && offensive(m) && (m.type === "normal" || m.type === o.type));
  const moves: string[] = [];
  if (o.signature && MOVES.some((m) => m.id === o.signature)) moves.push(o.signature);
  const ranked = [...pool].sort((a, b) => {
    const fa = forms.indexOf(attackForm(a) as "melee");
    const fb = forms.indexOf(attackForm(b) as "melee");
    return (fa < 0 ? 9 : fa) - (fb < 0 ? 9 : fb) + (rng() - 0.5) * 1.5;
  });
  for (const m of ranked) {
    if (moves.length >= size) break;
    if (!moves.includes(m.id)) moves.push(m.id);
  }
  if (!moves.length) moves.push(o.kind === "animal" ? "measured" : (MOVES.find(offensive)?.id ?? "measured"));
  return { stats, enchants, moves };
}

/** A designed enemy: its own stats and moves, its fixed enchantments, then a few random extras. */
function designKit(rng: Rng, o: KitOpts): EnemyKit {
  const d = o.design!;
  const jitter = () => 0.95 + rng() * 0.1;
  const stats: EnemyStats = { ...d.stats, hp: d.stats.hp * jitter(), dmg: d.stats.dmg * jitter() };
  const enchants: MobEnchantId[] = [...new Set(d.enchants)];
  const extra = Math.max(0, Math.min(12, d.extraEnchants)) + (o.hardcore && o.kind !== "animal" ? 1 : 0);
  let guard = 0;
  for (let n = 0; n < extra && guard++ < 40; ) {
    const id = MOB_ENCHANT_IDS[Math.floor(rng() * MOB_ENCHANT_IDS.length)]!;
    if (!enchants.includes(id)) { enchants.push(id); n++; }
  }
  for (const id of enchants) {
    if (id === "giant") { stats.hp *= 1.3; stats.speed *= 0.9; }
    if (id === "swift") stats.speed *= 1.25;
    if (id === "brutal") stats.crit += 0.15;
    if (id === "evasive") stats.dodge += 0.12;
    if (id === "armored") stats.physRes += 0.25;
    if (id === "spellward") stats.spellRes += 0.25;
  }
  const moves = d.moves.filter((id) => MOVES.some((m) => m.id === id)).slice(0, 4);
  return { stats, enchants, moves: moves.length ? moves : ["measured"] };
}

// ---------------------------------------------------------------------------
// The hunter's power reference
// ---------------------------------------------------------------------------

/** Seconds for the reference to close most of the gap when you get stronger, and when you get weaker. */
export const ADAPT = { upStandard: 300, upHardcore: 180, down: 900 } as const;

/** Moves `ref` toward `now`. Rises fast, falls slow, so swapping gear in and out is not a trick. */
export function adaptToward(ref: number, now: number, dt: number, hardcore: boolean): number {
  if (!Number.isFinite(ref) || ref <= 0) return now;
  if (!Number.isFinite(now) || now <= 0 || dt <= 0) return ref;
  const tau = now > ref ? (hardcore ? ADAPT.upHardcore : ADAPT.upStandard) : ADAPT.down;
  const k = 1 - Math.exp(-dt / tau);
  return ref + (now - ref) * k;
}

/** How hard one clean hit lands, after the type matchup and the hunter's armor relative to the reference. */
/**
 * Melee ignores defenses: every melee hit, from anyone on anyone (you, foes, ghosts, rivals, arena
 * fighters), ignores ALL of the target's armor and defense stats (armor, physical resistance, ward, guard).
 * 1 = ignored completely. Ranged hits face everything; spells already skip armor.
 */
export const MELEE_ARMOR_PIERCE = 1;
export function defenseVs(form: string, value: number): number {
  return form === "melee" ? value * (1 - MELEE_ARMOR_PIERCE) : value;
}

export function enemyHitDamage(o: {
  maxHpRef: number;
  frac: number;
  dmgMult: number;
  movePower: number;
  form: "melee" | "ranged" | "spell";
  typeMult: number;
  armor: number;
  armorRef: number;
  night: number;
  enraged: boolean;
  frenzied: boolean;
}): number {
  let dmg = Math.max(1, o.maxHpRef) * o.frac * o.dmgMult;
  dmg *= 0.85 + Math.max(0, Math.min(120, o.movePower)) / 300;
  if (o.form === "melee") dmg *= 1.1;
  if (o.form !== "spell") {
    const tm = o.typeMult === 0 ? 0.35 : o.typeMult < 1 ? 0.75 : o.typeMult > 1 ? 1.3 : 1;
    dmg *= tm;
    // Melee ignores armor entirely, so the "foes adapt to your armor" swing does not apply to it.
    if (o.form !== "melee") dmg *= Math.max(0.65, Math.min(1.35, (100 + Math.max(0, o.armorRef)) / (100 + Math.max(0, defenseVs(o.form, o.armor)))));
  }
  dmg *= o.night;
  if (o.enraged) dmg *= 1.6;
  if (o.frenzied) dmg *= 1.35;
  return Math.max(1, dmg);
}

// ---------------------------------------------------------------------------
// Gear levels
// ---------------------------------------------------------------------------

// QUALITY_LEVEL and dropGearLevel live in content.ts (rollGear uses them); re-exported here.
export { QUALITY_LEVEL, dropGearLevel };

/** Where a drop came from. Bounty tiers keep climbing, which is the long road to level-1000 gear. */
export const SOURCE_BONUS = {
  mob: (rarity: number) => Math.max(0, rarity) * 0.01,
  boss: 0.06,
  witch: 0.08,
  shrine: 0.05,
  hunter: (wanted: number) => 0.05 + Math.max(0, wanted - 1) * 0.01,
  bounty: (tier: number) => 0.05 + Math.max(0, tier) * 0.02,
  market: (roll: number) => Math.max(0, Math.min(1, roll)) * 0.1,
} as const;

/** Quality floor for a bounty's kit by tier. */
export function bountyQuality(tier: number, roll: number): QualityId {
  if (tier >= 15) return "legendary";
  if (tier >= 10) return roll < 0.5 ? "legendary" : "epic";
  if (tier >= 5) return roll < 0.15 ? "legendary" : "epic";
  if (tier >= 2) return roll < 0.45 ? "epic" : "rare";
  return roll < 0.2 ? "epic" : "rare";
}

// ---------------------------------------------------------------------------
// Bounties
// ---------------------------------------------------------------------------

/** Postings on the board at once. */
export const BOUNTY_BOARD_SIZE = 3;
/** Seconds before a posted mark gives up waiting, doubles and hunts you. */
export const BOUNTY_HUNT_SECONDS = 300;
/** Once the timer runs out a bounty enrages. These multiply on top of the usual enrage. */
export const BOUNTY_ENRAGE = { hp: 1.3, dmg: 1.3, speed: 1.16, gap: 0.8, crit: 0.12, dodge: 0.08 } as const;
/** A bounty's Death Mark: a telegraphed blow you must dodge, ward or blink out of. */
export const DEATH_MARK = { every: 7, everyEnraged: 4.5, wind: 1.15, windEnraged: 0.9, mult: 3.2, radius: 64 } as const;
/** Stars that put a price on your own head. */
export const BOUNTY_STARS_NEEDED = 10;
/** Hunters sent per wave once you are wanted. */
export const HUNTER_SQUAD = 5;
/** Seconds between hunter waves while wanted. */
export const HUNTER_WAVE_GAP = { standard: 90, hardcore: 60 } as const;

/** Chance one kill drops a Bounty Star. Only after your first bounty. */
export function bountyStarChance(kind: EnemyKind, rarity: number, hardcore: boolean): number {
  if (kind === "bounty" || kind === "hunter") return 0;
  const base = kind === "boss" ? 0.25 : kind === "witch" ? 0.2 : kind === "animal" ? 0.01 : 0.045;
  return Math.min(0.5, (base + Math.max(0, rarity) * 0.008) * (hardcore ? 1.3 : 1));
}

/** Kyo it costs to clear your name at a bounty board. */
export function clearNameCost(playerLevel: number, wanted: number): number {
  return Math.floor((150 + Math.max(1, playerLevel) * 40) * Math.max(1, wanted));
}

/** Kyo a bounty carries. */
export function bountyKyo(playerLevel: number, tier: number): number {
  return Math.floor(60 + Math.max(1, playerLevel) * 22 * (1 + tier * 0.15) + tier * 40);
}

/** A full inventory for a bounty mark. Everything here is handed over on the kill. */
export function bountyInventory(rng: Rng, tier: number, hardcore: boolean): Record<string, number> {
  const r = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  const t = Math.min(10, Math.max(0, tier));
  const bag: Record<string, number> = {
    potion: r(2, 4) + Math.floor(t / 3),
    big_potion: r(1, 2) + Math.floor(t / 4),
    cleanse_salt: r(1, 3),
    spirit_candy: r(1, 3),
    ghost_jar: r(0, 2),
    smoke_bomb: r(0, 2),
    leather: r(3, 8),
    mushroom: r(3, 8),
    ore: r(2, 6),
    timber: r(2, 6),
    blue_lantern: r(0, 3),
    embercap: r(0, 3),
    ironroot: r(0, 3),
  };
  if (hardcore) {
    bag.trail_ration = r(2, 4);
    bag.cooked_meat = r(1, 3);
    bag.drinking_water = r(1, 3);
  }
  for (const k of Object.keys(bag)) if (bag[k]! <= 0) delete bag[k];
  return bag;
}

/** What a gear piece sells for. Shared by the bag, the market and Sell All. */
export function gearSellValue(price: number, mult: number): number {
  return Math.max(1, Math.floor(Math.max(0, price) * 0.45 * Math.max(0, mult)));
}

/** What a bag item sells for. Quest salt and unpriced crafts still fetch a little. */
export function itemSellValue(price: number, mult: number): number {
  return Math.max(1, Math.floor(Math.max(4, price) * 0.5 * Math.max(0, mult)));
}
