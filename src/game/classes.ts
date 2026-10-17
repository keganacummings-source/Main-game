import type { RaceId, SkillId, TypeId } from "./content";
import { STARTER_KITS } from "./class-kits";

export type StatKey = "hp" | "might" | "arcana" | "guard" | "speed" | "crit" | "haste" | "regen" | "leech" | "kyo" | "xp" | "affinity";
export type StatMods = Partial<Record<StatKey, number>>;
export type Role = "Tank" | "Bruiser" | "Mobility" | "Caster" | "Support" | "Marksman";
/** Whether a class is built around close melee, long-range attacks, or a mix of both. */
export type FightStyle = "melee" | "ranged" | "mixed";
export type ImmuneId = "burn" | "soak" | "root" | "sleep" | "gloom" | "silence" | "spark" | "expose";

export const STAT_LABEL: Record<StatKey, { name: string; unit: string; about: string }> = {
  hp: { name: "Vitality", unit: "%", about: "Maximum health" },
  might: { name: "Might", unit: "%", about: "Melee, ranged and weapon damage" },
  arcana: { name: "Arcana", unit: "%", about: "Spell and channel damage" },
  guard: { name: "Guard", unit: "%", about: "Damage taken reduction" },
  speed: { name: "Agility", unit: "%", about: "Movement speed" },
  crit: { name: "Precision", unit: " crit", about: "Critical hit chance" },
  haste: { name: "Haste", unit: "%", about: "Cooldown reduction" },
  regen: { name: "Recovery", unit: "%", about: "Out-of-combat healing" },
  leech: { name: "Lifesteal", unit: "%", about: "Damage returned as health" },
  kyo: { name: "Fortune", unit: "%", about: "Kyo from kills" },
  xp: { name: "Insight", unit: "%", about: "Experience gained" },
  affinity: { name: "Affinity", unit: "%", about: "Damage with your element" },
};

export const IMMUNE_LABEL: Record<ImmuneId, string> = {
  burn: "Burn", soak: "Soak", root: "Root", sleep: "Sleep", gloom: "Gloom", silence: "Silence", spark: "Spark", expose: "Expose",
};

type Sprite = { m: string; f: string };
const g = (m: string, f: string): Sprite => ({ m, f });
const one = (id: string): Sprite => ({ m: id, f: id });

type ClassDef = {
  id: string; name: string; type: TypeId; role: Role; sprite: Sprite; blurb: string; specialty: string;
  /** The one thing this class is built around. Its element (`type`) is only a side flavour. */
  focus: string;
  /** Whether this class fights up close, at range, or both. Used by the character select screen. */
  fightStyle: FightStyle;
  stats: StatMods; immune?: ImmuneId[]; passive: string; starterMoves: string[]; signature: string;
  /** One major skill this class is built to grind. Other skills stay at ×1. */
  aptitudes: Partial<Record<SkillId, number>>;
  /** Spirits that can follow at once. Everyone else is capped at 3. */
  outMax?: number;
};

const def = <T extends readonly ClassDef[]>(rows: T) => rows;

/*
 * Every class is built around ONE focus: the thing it is best at, carried by one big stat (or one big
 * rule, like the Spirit Caller's choir). Its element is a side note: it flavours the moves and gives a
 * small Affinity bonus to verses of that element, but no class is "the fire one" any more.
 */
export const CLASSES = def([
  { id: "warden", name: "Bulwark", type: "earth", role: "Tank", focus: "Defense", fightStyle: "melee", sprite: one("warrior:warden"), blurb: "A wall that walks.", specialty: "Takes less damage than anyone. Grinds Mining", stats: { guard: 38, hp: 10, affinity: 5, speed: -10, haste: -5 }, passive: "Stands firm: heavy hits are blunted by a raised shield.", starterMoves: STARTER_KITS.warden, signature: "shieldbash", aptitudes: { mining: 2.5 } },
  { id: "spellweaver", name: "Spellweaver", type: "electric", role: "Caster", focus: "Spell Power", fightStyle: "mixed", sprite: one("warrior:spellweaver"), blurb: "Every word is a weapon.", specialty: "The hardest-hitting spells in the veil. Grinds Magic", stats: { arcana: 42, affinity: 5, hp: -15, guard: -10 }, passive: "Long casts crackle harder; the body is paper.", starterMoves: STARTER_KITS.spellweaver, signature: "arcbolt", aptitudes: { magic: 2.5 } },
  { id: "spiritbinder", name: "Spirit Caller", type: "spirit", role: "Support", focus: "Summoning", fightStyle: "mixed", sprite: one("warrior:spiritbinder"), blurb: "Keeps a choir of the dead at their heel.", specialty: "Six spirits out at once. Grinds Ghostkeeping", stats: { regen: 20, arcana: 5, affinity: 5, might: -15 }, immune: ["gloom"], passive: "A full choir follows: six spirits out at once, and ghostkeeping comes fast.", starterMoves: STARTER_KITS.spiritbinder, signature: "soulmend", aptitudes: { ghostkeeping: 2.6 }, outMax: 6 },
  { id: "nightblade", name: "Nightblade", type: "void", role: "Mobility", focus: "Critical Hits", fightStyle: "melee", sprite: one("warrior:nightblade"), blurb: "Gone before the blade lands.", specialty: "Crits more often than any class. Grinds Evasion", stats: { crit: 22, speed: 8, affinity: 5, hp: -15, guard: -12 }, passive: "Every step is a feint. Armor is for the slow.", starterMoves: STARTER_KITS.nightblade, signature: "shadowstrike", aptitudes: { evasion: 2.5 } },
  { id: "pathfinder", name: "Pathfinder", type: "air", role: "Marksman", focus: "Marksmanship", fightStyle: "ranged", sprite: one("warrior:pathfinder"), blurb: "Reads the wind, then the throat.", specialty: "Long-range volleys that land true. Grinds Hunting", stats: { might: 22, crit: 6, affinity: 5, guard: -10 }, immune: ["root"], passive: "Never pinned: roots slide off a light step.", starterMoves: STARTER_KITS.pathfinder, signature: "piercingvolley", aptitudes: { hunting: 2.5 } },
  { id: "ironpalm", name: "Ironpalm", type: "normal", role: "Bruiser", focus: "Tempo", fightStyle: "melee", sprite: one("warrior:ironpalm"), blurb: "Fists tempered by a thousand mornings.", specialty: "Verses come back faster than anyone's. Grinds Physical", stats: { haste: 28, might: 5, regen: 10, affinity: 5, arcana: -20 }, immune: ["sleep"], passive: "Discipline: never dozes, always breathing.", starterMoves: STARTER_KITS.ironpalm, signature: "hundredpalm", aptitudes: { physical: 2.5 } },
  { id: "bloodrager", name: "Bloodrager", type: "fire", role: "Bruiser", focus: "Raw Power", fightStyle: "melee", sprite: one("warrior:bloodrager"), blurb: "Pain is fuel.", specialty: "The heaviest weapon hits in the veil. Grinds Skinning", stats: { might: 42, affinity: 5, hp: 5, guard: -25 }, immune: ["gloom"], passive: "Fear never takes; every cut feeds the rage.", starterMoves: STARTER_KITS.bloodrager, signature: "rampage", aptitudes: { skinning: 2.5 } },
  { id: "ghoulknight", name: "Dreadknight", type: "ghoul", role: "Tank", focus: "Lifesteal", fightStyle: "melee", sprite: one("warrior:ghoulknight"), blurb: "Plate that hungers.", specialty: "Heals by hitting. Grinds Bounty Hunting", stats: { leech: 18, hp: 10, guard: 5, affinity: 5, speed: -8, regen: -30 }, passive: "Heals by taking, not by resting.", starterMoves: STARTER_KITS.ghoulknight, signature: "soulreap", aptitudes: { bountyhunting: 2.5 } },
  { id: "frostblade", name: "Vanguard", type: "ice", role: "Tank", focus: "Endurance", fightStyle: "melee", sprite: one("warrior:frostblade"), blurb: "The last one standing in the line.", specialty: "The deepest health pool in the veil. Grinds Survival", stats: { hp: 42, guard: 5, affinity: 5, speed: -5, arcana: -10 }, immune: ["soak"], passive: "Cold plate: water never weighs it down.", starterMoves: STARTER_KITS.frostblade, signature: "glaciercharge", aptitudes: { survival: 2.5 } },
  { id: "pyromancer", name: "Channeler", type: "fire", role: "Caster", focus: "Channeling", fightStyle: "mixed", sprite: one("warrior:pyromancer"), blurb: "Holds a spell until it breaks the world.", specialty: "Long channels and lingering areas. Grinds Alchemy", stats: { arcana: 25, haste: 12, affinity: 5, guard: -10 }, immune: ["burn"], passive: "Made of flame: burns cannot hurt it.", starterMoves: STARTER_KITS.pyromancer, signature: "inferno", aptitudes: { alchemy: 2.5 } },
  { id: "tidecaller", name: "Wellspring", type: "water", role: "Support", focus: "Recovery", fightStyle: "mixed", sprite: one("warrior:tidecaller"), blurb: "Never runs dry.", specialty: "Recovers between fights faster than anyone. Grinds Survival", stats: { regen: 48, arcana: 5, affinity: 5, speed: -5 }, immune: ["soak"], passive: "Flows through water like it is home.", starterMoves: STARTER_KITS.tidecaller, signature: "maelstrom", aptitudes: { survival: 2.0 } },
  { id: "stormrider", name: "Outrider", type: "air", role: "Mobility", focus: "Speed", fightStyle: "ranged", sprite: one("warrior:stormrider"), blurb: "Already over the next hill.", specialty: "The fastest feet in the veil. Grinds Adventuring", stats: { speed: 42, affinity: 5, hp: -15, guard: -10 }, immune: ["root"], passive: "Cannot be rooted. Cannot sit still.", starterMoves: STARTER_KITS.stormrider, signature: "cyclone", aptitudes: { adventuring: 2.5 } },
  { id: "briarmage", name: "Earthshaker", type: "earth", role: "Tank", focus: "Area Slams", fightStyle: "melee", sprite: one("warrior:briarmage"), blurb: "A hill with a temper.", specialty: "Huge slams that hit everything close. Grinds Woodcutting", stats: { might: 22, hp: 18, affinity: 5, speed: -20, haste: -8 }, immune: ["root"], passive: "Unmovable stone. Slow to start, slower to fall.", starterMoves: STARTER_KITS.briarmage, signature: "tectonic", aptitudes: { woodcutting: 2.5 } },
  { id: "lightbringer", name: "Beacon", type: "light", role: "Caster", focus: "Exposing", fightStyle: "mixed", sprite: one("warrior:lightbringer"), blurb: "Shows every weakness.", specialty: "Beams that expose foes for sharp crits. Grinds Magic", stats: { crit: 12, arcana: 15, affinity: 5, hp: -8 }, immune: ["gloom"], passive: "Too bright for gloom.", starterMoves: STARTER_KITS.lightbringer, signature: "sunburst", aptitudes: { magic: 2.0 } },
  { id: "voidwalker", name: "Phasewalker", type: "void", role: "Caster", focus: "Blink Casting", fightStyle: "mixed", sprite: one("warrior:voidwalker"), blurb: "Never where you aimed.", specialty: "Casts on the move and blinks out of reach. Grinds Evasion", stats: { speed: 18, arcana: 18, affinity: 5, hp: -10, regen: -15 }, immune: ["sleep"], passive: "Never sleeps. Never quite heals.", starterMoves: STARTER_KITS.voidwalker, signature: "abyssrift", aptitudes: { evasion: 2.0 } },
  { id: "absolver", name: "Absolver", type: "light", role: "Support", focus: "Healing", fightStyle: "mixed", sprite: one("warrior:absolver"), blurb: "Forgives, then mends.", specialty: "The strongest heals in the veil. Grinds Social", stats: { regen: 35, guard: 10, affinity: 5, might: -25 }, immune: ["silence"], passive: "Prayer cannot be silenced.", starterMoves: STARTER_KITS.absolver, signature: "absolution", aptitudes: { social: 2.5 } },
  { id: "vigilant", name: "Vigilant", type: "spirit", role: "Support", focus: "Warding", fightStyle: "mixed", sprite: one("warrior:vigilant"), blurb: "Keeps the night watch.", specialty: "Wards, fear and protective chants. Grinds Shroom", stats: { guard: 20, regen: 12, affinity: 5, speed: -5, crit: -4 }, immune: ["sleep"], passive: "Always awake, always warded.", starterMoves: STARTER_KITS.vigilant, signature: "vigilward", aptitudes: { shroom: 2.5 } },
  { id: "coinmaster", name: "Coinmaster", type: "normal", role: "Support", focus: "Fortune", fightStyle: "ranged", sprite: one("warrior:coinmaster"), blurb: "Every fight is a deal.", specialty: "Kills pay far more kyo. Grinds Trading", stats: { kyo: 45, affinity: 5, might: -10, hp: -5 }, passive: "Kills pay out a heavier purse.", starterMoves: STARTER_KITS.coinmaster, signature: "cointoss", aptitudes: { trading: 2.6 } },
  { id: "hexbinder", name: "Hexbinder", type: "spirit", role: "Caster", focus: "Curses", fightStyle: "mixed", sprite: one("warrior:hexbinder"), blurb: "Signs pacts in other people's blood.", specialty: "Draining hexes and summoned bells. Grinds Catching", stats: { arcana: 22, leech: 8, affinity: 5, hp: -15, regen: -15 }, passive: "Every hex returns a little life.", starterMoves: STARTER_KITS.hexbinder, signature: "bloodpact", aptitudes: { catching: 2.5 } },
  { id: "corsair", name: "Corsair", type: "water", role: "Bruiser", focus: "Dirty Fighting", fightStyle: "melee", sprite: one("warrior:corsair"), blurb: "Salt, steel, and a grin.", specialty: "Flurries, grapples and plunder. Grinds Fishing", stats: { might: 15, speed: 12, kyo: 12, affinity: 5, guard: -10 }, immune: ["soak"], passive: "Sea legs: water never slows the step.", starterMoves: STARTER_KITS.corsair, signature: "cutlass", aptitudes: { fishing: 2.5 } },
  { id: "warlord", name: "Warlord", type: "normal", role: "Bruiser", focus: "All-Rounder", fightStyle: "melee", sprite: one("warrior:warlord"), blurb: "Commands the ring.", specialty: "No weakness, no single strength. Grinds Physical", stats: { hp: 12, might: 12, guard: 12, haste: 6, affinity: 5, speed: -5 }, passive: "Rally Cry hastens and sharpens the whole body.", starterMoves: STARTER_KITS.warlord, signature: "rallycry", aptitudes: { physical: 2.0 } },
  { id: "nightlord", name: "Nightlord", type: "ghoul", role: "Bruiser", focus: "Blood Magic", fightStyle: "mixed", sprite: one("warrior:nightlord"), blurb: "Old blood, older hunger.", specialty: "Spells that drink deep. Grinds Skinning", stats: { leech: 12, arcana: 18, affinity: 5, regen: -45, guard: -5 }, passive: "Feeds on every wound. Rest does little.", starterMoves: STARTER_KITS.nightlord, signature: "crimsondrain", aptitudes: { skinning: 2.0 } },
  { id: "songweaver", name: "Songweaver", type: "air", role: "Support", focus: "Insight", fightStyle: "mixed", sprite: one("warrior:songweaver"), blurb: "A tune that bends the fight.", specialty: "Learns from every fight: the most XP in the veil. Grinds Cooking", stats: { xp: 32, haste: 8, regen: 8, affinity: 5, might: -15, hp: -5 }, immune: ["silence"], passive: "A song is never silenced; learns from every verse.", starterMoves: STARTER_KITS.songweaver, signature: "ballad", aptitudes: { cooking: 2.5 } },
  { id: "oathkeeper", name: "Oathkeeper", type: "light", role: "Tank", focus: "Retribution", fightStyle: "melee", sprite: one("warrior:oathkeeper"), blurb: "Sworn steel.", specialty: "Hits back as hard as it is hit. Grinds Building", stats: { guard: 22, might: 14, affinity: 5, speed: -15 }, immune: ["gloom"], passive: "The oath holds against fear.", starterMoves: STARTER_KITS.oathkeeper, signature: "judgment", aptitudes: { building: 2.5 } },
  { id: "ronin", name: "Ronin", type: "fire", role: "Bruiser", focus: "First Strike", fightStyle: "melee", sprite: one("warrior:ronin"), blurb: "One draw, one cut.", specialty: "Lightning-fast critical openers. Grinds Hunting", stats: { crit: 14, might: 18, affinity: 5, hp: -5, guard: -10 }, passive: "The first cut is the deepest.", starterMoves: STARTER_KITS.ronin, signature: "iaido", aptitudes: { hunting: 2.0 } },
  { id: "seraph", name: "Seraph", type: "light", role: "Mobility", focus: "Flight", fightStyle: "mixed", sprite: one("warrior:seraph"), blurb: "Wings that cut.", specialty: "Aerial blinks and mending on the wing. Grinds Wayfinding", stats: { speed: 24, regen: 14, affinity: 5, might: -10, guard: -10 }, immune: ["root"], passive: "Wings: the ground cannot hold it.", starterMoves: STARTER_KITS.seraph, signature: "wingburst", aptitudes: { wayfinding: 2.5 } },
  { id: "moonhopper", name: "Moonhopper", type: "air", role: "Mobility", focus: "Evasion", fightStyle: "ranged", sprite: one("warrior:moonhopper"), blurb: "Bounces off the moon.", specialty: "Huge hops and flips: almost impossible to pin. Grinds Wayfinding", stats: { speed: 32, crit: 8, haste: 6, affinity: 5, hp: -20, guard: -15 }, immune: ["root"], passive: "Too bouncy to pin down.", starterMoves: STARTER_KITS.moonhopper, signature: "moonhop", aptitudes: { wayfinding: 2.0 } },
  { id: "bladedancer", name: "Bladedancer", type: "spirit", role: "Mobility", focus: "Momentum", fightStyle: "melee", sprite: one("warrior:bladedancer"), blurb: "Every swing is a step.", specialty: "Spinning melee that never stops moving. Grinds Adventuring", stats: { haste: 18, speed: 18, affinity: 5, hp: -15 }, passive: "Moving fast keeps every verse fresh.", starterMoves: STARTER_KITS.bladedancer, signature: "whirlingveil", aptitudes: { adventuring: 2.0 } },
  { id: "sovereign", name: "Sovereign", type: "light", role: "Support", focus: "Command", fightStyle: "mixed", sprite: one("warrior:sovereign"), blurb: "Crowned by the veil.", specialty: "Decrees that silence, and a royal purse. Grinds Looting", stats: { kyo: 18, xp: 18, guard: 10, hp: 8, affinity: 5, speed: -15, haste: -5 }, immune: ["silence"], passive: "None may silence the crown.", starterMoves: STARTER_KITS.sovereign, signature: "royaldecree", aptitudes: { looting: 2.5 } },
] as const);

export type ClassId = (typeof CLASSES)[number]["id"];
export type ClassInfo = (typeof CLASSES)[number];
export const CLASS_BY_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c])) as Record<ClassId, ClassInfo>;
export const ROLES: Role[] = ["Tank", "Bruiser", "Mobility", "Caster", "Support", "Marksman"];

const TYPE_RACE: Partial<Record<TypeId, RaceId>> = { earth: "thorn", fire: "cinder", water: "tide", ice: "rime", electric: "rime", air: "rime" };
export const CLASS_RACE = Object.fromEntries(CLASSES.map((c) => [c.id, TYPE_RACE[c.type] ?? "vesper"])) as Record<ClassId, RaceId>;
export const LEGACY_CLASS: Record<RaceId, ClassId> = {
  vesper: "voidwalker", cinder: "pyromancer", tide: "tidecaller", thorn: "briarmage", rime: "frostblade",
};

export function classGendered(id: ClassId): boolean {
  return false;
}

export const TRAITS = [
  { id: "hardy", name: "Hardy", about: "Thick bones.", stats: { hp: 15, speed: -5 } },
  { id: "fleetfoot", name: "Fleet of Foot", about: "Always a step ahead.", stats: { speed: 15, hp: -8 } },
  { id: "keeneye", name: "Keen Eye", about: "Sees the gap in the armor.", stats: { crit: 8, guard: -5 } },
  { id: "arcaneblood", name: "Arcane Blood", about: "Magic runs in the veins.", stats: { arcana: 15, might: -8 } },
  { id: "brawler", name: "Brawler", about: "Hits first, thinks later.", stats: { might: 15, arcana: -8 } },
  { id: "thickskin", name: "Thick Skin", about: "Shrugs off blows, slow to react.", stats: { guard: 15, haste: -6 } },
  { id: "quickhands", name: "Quick Hands", about: "Verses come back sooner.", stats: { haste: 12, guard: -5 } },
  { id: "vampiric", name: "Vampiric", about: "Drinks from wounds; rest tastes of ash.", stats: { leech: 8, regen: -30 } },
  { id: "fortunate", name: "Fortunate", about: "Coins find you.", stats: { kyo: 20, crit: -2 } },
  { id: "scholar", name: "Scholar", about: "Learns from every fight.", stats: { xp: 15, might: -5 } },
  { id: "restless", name: "Restless Heart", about: "Recovers fast between fights.", stats: { regen: 40, hp: -5 } },
  { id: "attuned", name: "Elemental Attuned", about: "Your element sings louder.", stats: { affinity: 20, crit: -4 } },
  { id: "unshakable", name: "Unshakable", about: "Fear and sleep cannot take hold.", stats: { speed: -5 }, immune: ["sleep", "gloom"] },
  { id: "survivor", name: "Survivor", about: "Fire and flood do not stick.", stats: { arcana: -5 }, immune: ["burn", "soak"] },
] as const satisfies readonly { id: string; name: string; about: string; stats: StatMods; immune?: readonly ImmuneId[] }[];

export type TraitId = (typeof TRAITS)[number]["id"];
export const TRAIT_BY_ID = Object.fromEntries(TRAITS.map((t) => [t.id, t])) as Record<TraitId, (typeof TRAITS)[number]>;

export type Profile = { stats: Required<StatMods>; immune: ImmuneId[] };

export function classProfile(classId: ClassId, traitId?: string | null): Profile {
  const stats = Object.fromEntries(Object.keys(STAT_LABEL).map((k) => [k, 0])) as Required<StatMods>;
  const c = CLASS_BY_ID[classId];
  const t = traitId ? TRAIT_BY_ID[traitId as TraitId] : undefined;
  for (const src of [c?.stats, t?.stats]) for (const [k, v] of Object.entries(src ?? {})) stats[k as StatKey] += v ?? 0;
  const immune = [...new Set([...((c as { immune?: readonly ImmuneId[] })?.immune ?? []), ...((t as { immune?: readonly ImmuneId[] })?.immune ?? [])])];
  return { stats, immune };
}

export function statLine(k: StatKey, v: number): string {
  const l = STAT_LABEL[k];
  return `${v > 0 ? "+" : ""}${v}${l.unit} ${l.name}`;
}

export function buffLines(mods: StatMods, immune: readonly ImmuneId[] = []): { buffs: string[]; debuffs: string[] } {
  const buffs: string[] = [];
  const debuffs: string[] = [];
  for (const [k, v] of Object.entries(mods)) {
    if (!v) continue;
    (v > 0 ? buffs : debuffs).push(statLine(k as StatKey, v));
  }
  for (const id of immune) buffs.push(`Immune to ${IMMUNE_LABEL[id]}`);
  return { buffs, debuffs };
}

export function aptitudeOf(classId: ClassId, skill: SkillId): number {
  const c = CLASS_BY_ID[classId];
  const listed = (c?.aptitudes as Partial<Record<SkillId, number>> | undefined)?.[skill];
  if (listed) return listed;
  if (!c) return 1;
  if (skill === "mana" && (c.role === "Caster" || c.role === "Support")) return 2.2;
  if (skill === "stamina" && (c.fightStyle === "melee" || c.role === "Tank" || c.role === "Bruiser")) return 2.1;
  if (skill === "mana" && c.fightStyle !== "melee") return 1.35;
  return 1;
}

/** How many spirits this class can have out at once. */
export function classSpiritOut(classId: string | null | undefined): number {
  const n = classId ? (CLASS_BY_ID[classId as ClassId] as { outMax?: number } | undefined)?.outMax : undefined;
  return n && n > 0 ? n : 3;
}
