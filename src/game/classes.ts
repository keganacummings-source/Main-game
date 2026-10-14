import type { RaceId, SkillId, TypeId } from "./content";

export type StatKey = "hp" | "might" | "arcana" | "guard" | "speed" | "crit" | "haste" | "regen" | "leech" | "kyo" | "xp" | "affinity";
export type StatMods = Partial<Record<StatKey, number>>;
export type Role = "Tank" | "Bruiser" | "Mobility" | "Caster" | "Support" | "Marksman";
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
  stats: StatMods; immune?: ImmuneId[]; passive: string; starterMoves: string[]; signature: string;
  aptitudes: Partial<Record<SkillId, number>>;
};

const def = <T extends readonly ClassDef[]>(rows: T) => rows;

export const CLASSES = def([
  { id: "warden", name: "Bulwark", type: "earth", role: "Tank", sprite: g("core:m0", "core:f0"), blurb: "A wall that walks.", specialty: "Unbreakable frontline with root control", stats: { hp: 30, guard: 20, speed: -10, haste: -5 }, passive: "Stands firm: heavy hits are blunted by a raised shield.", starterMoves: ["shieldbash", "measured", "aegis", "brace", "dash"], signature: "shieldbash", aptitudes: { mining: 1.5, physical: 1.4, magic: 0.6 } },
  { id: "spellweaver", name: "Spellweaver", type: "electric", role: "Caster", sprite: g("core:m1", "core:f1"), blurb: "Threads lightning through every word.", specialty: "Burst spells and silencing interrupts", stats: { arcana: 30, haste: 5, hp: -15, guard: -10 }, passive: "Long casts crackle harder; the body is paper.", starterMoves: ["arcbolt", "jolt", "storm", "interrupt", "arcblink"], signature: "arcbolt", aptitudes: { magic: 1.5, alchemy: 1.3, physical: 0.6 } },
  { id: "spiritbinder", name: "Soulmender", type: "spirit", role: "Support", sprite: g("core:m2", "core:f2"), blurb: "Stitches the living with the dead.", specialty: "Healing and fear that keeps a party standing", stats: { regen: 50, arcana: 10, might: -20 }, immune: ["gloom"], passive: "Mending flows twice as fast between fights.", starterMoves: ["soulmend", "whisper", "halo", "packfear", "spiritglide"], signature: "soulmend", aptitudes: { alchemy: 1.5, social: 1.3, hunting: 0.7 } },
  { id: "nightblade", name: "Nightblade", type: "void", role: "Mobility", sprite: g("core:m3", "core:f3"), blurb: "Gone before the blade lands.", specialty: "Blinks behind targets for brutal crits", stats: { speed: 25, crit: 12, hp: -15, guard: -15 }, passive: "Every step is a feint. Armor is for the slow.", starterMoves: ["shadowstrike", "shadowdash", "veilstep", "widowfan", "widowtumble"], signature: "shadowstrike", aptitudes: { hunting: 1.3, physical: 1.3, trading: 0.8 } },
  { id: "pathfinder", name: "Pathfinder", type: "air", role: "Marksman", sprite: g("core:m4", "core:f4"), blurb: "Reads the wind, then the throat.", specialty: "Long range volleys and kiting", stats: { speed: 15, crit: 6, might: 10, guard: -10 }, immune: ["root"], passive: "Never pinned: roots slide off a light step.", starterMoves: ["piercingvolley", "gust", "moonhook", "crowhop", "fleetfoot"], signature: "piercingvolley", aptitudes: { hunting: 1.6, woodcutting: 1.3, fishing: 1.2, magic: 0.7 } },
  { id: "ironpalm", name: "Ironpalm", type: "normal", role: "Bruiser", sprite: g("second:m0", "second:f0"), blurb: "Fists tempered by a thousand mornings.", specialty: "Rapid strikes, counters and flowing footwork", stats: { might: 15, speed: 15, regen: 20, arcana: -25 }, immune: ["sleep"], passive: "Discipline: never dozes, always breathing.", starterMoves: ["hundredpalm", "measured", "riposte", "roll", "flowstep"], signature: "hundredpalm", aptitudes: { physical: 1.5, adventuring: 1.3, trading: 0.7 } },
  { id: "bloodrager", name: "Bloodrager", type: "fire", role: "Bruiser", sprite: g("second:m1", "second:f1"), blurb: "Pain is fuel.", specialty: "Huge heavy swings that drink the wound", stats: { might: 35, leech: 8, hp: 10, guard: -25 }, immune: ["gloom"], passive: "Fear never takes; every cut feeds the rage.", starterMoves: ["rampage", "cinder", "solarguillotine", "battlerush", "pyrelunge"], signature: "rampage", aptitudes: { physical: 1.5, hunting: 1.3, social: 0.6, alchemy: 0.7 } },
  { id: "ghoulknight", name: "Dreadknight", type: "ghoul", role: "Tank", sprite: g("second:m2", "second:f2"), blurb: "Plate that hungers.", specialty: "Draining blows and grim staying power", stats: { hp: 20, guard: 10, leech: 10, speed: -10, regen: -30 }, passive: "Heals by taking, not by resting.", starterMoves: ["soulreap", "backbite", "marrow", "rattle", "batswarm"], signature: "soulreap", aptitudes: { physical: 1.3, catching: 1.3, social: 0.7 } },
  { id: "frostblade", name: "Frostguard", type: "ice", role: "Tank", sprite: g("second:m3", "second:f3"), blurb: "A soldier of the glass march.", specialty: "Charges that freeze lines in place", stats: { guard: 15, hp: 10, crit: 4, speed: -5, arcana: -10 }, immune: ["soak"], passive: "Cold plate: water never weighs it down.", starterMoves: ["glaciercharge", "shard", "icecrown", "glassparry", "frostglide"], signature: "glaciercharge", aptitudes: { physical: 1.3, mining: 1.3, trading: 1.1, magic: 0.8 } },
  { id: "pyromancer", name: "Emberheart", type: "fire", role: "Caster", sprite: one("third:a0"), blurb: "A living coal.", specialty: "Burning channels and area fire", stats: { arcana: 25, affinity: 15, guard: -10 }, immune: ["burn"], passive: "Made of flame: burns cannot hurt it.", starterMoves: ["inferno", "ember", "kilnbreath", "ashstep", "cindertumble"], signature: "inferno", aptitudes: { magic: 1.4, alchemy: 1.2, fishing: 0.6 } },
  { id: "tidecaller", name: "Tideshaper", type: "water", role: "Support", sprite: one("third:a1"), blurb: "The sea in a body.", specialty: "Soaking control and steady self-heals", stats: { regen: 30, arcana: 15, speed: -5 }, immune: ["soak"], passive: "Flows through water like it is home.", starterMoves: ["maelstrom", "soak", "tidecourt", "tidemend", "tiderush"], signature: "maelstrom", aptitudes: { fishing: 1.6, alchemy: 1.2, mining: 0.7 } },
  { id: "stormrider", name: "Galeborn", type: "air", role: "Mobility", sprite: one("third:a2"), blurb: "A storm that learned to run.", specialty: "Fastest feet in the veil, fast cooldowns", stats: { speed: 35, haste: 10, hp: -15, guard: -10 }, immune: ["root"], passive: "Cannot be rooted. Cannot sit still.", starterMoves: ["cyclone", "gust", "bansheereel", "galedash", "crowhop"], signature: "cyclone", aptitudes: { adventuring: 1.5, hunting: 1.2, mining: 0.6 } },
  { id: "briarmage", name: "Earthshaker", type: "earth", role: "Tank", sprite: one("third:a3"), blurb: "A hill with a temper.", specialty: "Massive slams and roots", stats: { hp: 35, guard: 25, speed: -25, haste: -10 }, immune: ["root"], passive: "Unmovable stone. Slow to start, slower to fall.", starterMoves: ["tectonic", "quake", "hammer", "briarcathedral", "briaroll"], signature: "tectonic", aptitudes: { mining: 1.6, woodcutting: 1.3, shroom: 1.2, social: 0.7 } },
  { id: "lightbringer", name: "Radiant", type: "light", role: "Caster", sprite: one("third:a4"), blurb: "Dawn given legs.", specialty: "Exposing beams and mends", stats: { arcana: 20, regen: 15, guard: -5, hp: -5 }, immune: ["gloom"], passive: "Too bright for gloom.", starterMoves: ["sunburst", "flash", "dawn", "halo", "holystep"], signature: "sunburst", aptitudes: { magic: 1.3, social: 1.3 } },
  { id: "voidwalker", name: "Umbral", type: "void", role: "Caster", sprite: one("third:a5"), blurb: "The hole in the lantern light.", specialty: "Gloom channels and blinks", stats: { arcana: 20, crit: 6, hp: -10, regen: -20 }, immune: ["sleep"], passive: "Never sleeps. Never quite heals.", starterMoves: ["abyssrift", "lantern", "voidhymn", "veilstep", "shadowdash"], signature: "abyssrift", aptitudes: { magic: 1.4, catching: 1.3, trading: 0.8 } },
  { id: "absolver", name: "Absolver", type: "light", role: "Support", sprite: one("third:b0"), blurb: "Forgives, then mends.", specialty: "The strongest heals in the veil", stats: { regen: 40, guard: 10, might: -25 }, immune: ["silence"], passive: "Prayer cannot be silenced.", starterMoves: ["absolution", "lanternrain", "choirbell", "aegis", "holystep"], signature: "absolution", aptitudes: { social: 1.5, alchemy: 1.3, hunting: 0.6 } },
  { id: "vigilant", name: "Vigilant", type: "spirit", role: "Support", sprite: one("third:b1"), blurb: "Keeps the night watch.", specialty: "Wards, fear and protective chants", stats: { guard: 15, arcana: 10, speed: -5, crit: -4 }, immune: ["sleep"], passive: "Always awake, always warded.", starterMoves: ["vigilward", "whisper", "creep", "saltcathedral", "spiritglide"], signature: "vigilward", aptitudes: { alchemy: 1.4, shroom: 1.3, physical: 0.7 } },
  { id: "coinmaster", name: "Coinmaster", type: "normal", role: "Support", sprite: one("third:b2"), blurb: "Every fight is a deal.", specialty: "Richer loot and gilded tricks", stats: { kyo: 35, xp: 5, might: -10, hp: -5 }, passive: "Kills pay out a heavier purse.", starterMoves: ["cointoss", "measured", "ossuary", "roll", "grapple"], signature: "cointoss", aptitudes: { trading: 1.8, social: 1.4, physical: 0.8 } },
  { id: "hexbinder", name: "Hexbinder", type: "spirit", role: "Caster", sprite: one("third:b3"), blurb: "Signs pacts in other people's blood.", specialty: "Draining hexes and summoned bells", stats: { arcana: 25, leech: 6, hp: -15, regen: -15 }, passive: "Every hex returns a little life.", starterMoves: ["bloodpact", "hex", "hexcarousel", "summonbell", "widowtumble"], signature: "bloodpact", aptitudes: { catching: 1.5, magic: 1.3, social: 0.6 } },
  { id: "corsair", name: "Corsair", type: "water", role: "Bruiser", sprite: one("third:b4"), blurb: "Salt, steel, and a grin.", specialty: "Flurries, grapples and dirty footwork", stats: { might: 15, speed: 10, kyo: 10, guard: -10 }, immune: ["soak"], passive: "Sea legs: water never slows the step.", starterMoves: ["cutlass", "brine", "tideslip", "grapple", "riposte"], signature: "cutlass", aptitudes: { fishing: 1.4, trading: 1.3, alchemy: 0.7 } },
  { id: "warlord", name: "Warlord", type: "normal", role: "Bruiser", sprite: one("third:b5"), blurb: "Commands the ring.", specialty: "Rallying buffs and steady blows", stats: { hp: 10, might: 10, guard: 10, haste: 5, speed: -5, crit: -3 }, passive: "Rally Cry hastens and sharpens the whole body.", starterMoves: ["rallycry", "measured", "ossuary", "riposte", "battlerush"], signature: "rallycry", aptitudes: { social: 1.6, trading: 1.2, magic: 0.7 } },
  { id: "nightlord", name: "Nightlord", type: "ghoul", role: "Bruiser", sprite: one("fourth:vampire"), blurb: "Old blood, older hunger.", specialty: "Massive lifesteal spells", stats: { leech: 15, might: 10, arcana: 10, regen: -50, guard: -5 }, passive: "Feeds on every wound. Rest does little.", starterMoves: ["crimsondrain", "bite", "bloodstep", "marrowcomet", "batswarm"], signature: "crimsondrain", aptitudes: { hunting: 1.4, catching: 1.3, fishing: 0.6 } },
  { id: "songweaver", name: "Songweaver", type: "air", role: "Support", sprite: one("fourth:bard"), blurb: "A tune that bends the fight.", specialty: "Tempo, haste and dread ballads", stats: { haste: 15, regen: 15, xp: 10, might: -15, hp: -5 }, immune: ["silence"], passive: "A song is never silenced; learns from every verse.", starterMoves: ["ballad", "howl", "bansheereel", "pirouette", "fleetfoot"], signature: "ballad", aptitudes: { social: 1.7, trading: 1.2, mining: 0.6 } },
  { id: "oathkeeper", name: "Oathkeeper", type: "light", role: "Tank", sprite: one("fourth:paladin"), blurb: "Sworn steel.", specialty: "Holy heavy blows and wards", stats: { hp: 20, guard: 20, arcana: 5, speed: -15 }, immune: ["gloom"], passive: "The oath holds against fear.", starterMoves: ["judgment", "focuslance", "chapelwheel", "aegis", "holystep"], signature: "judgment", aptitudes: { physical: 1.3, social: 1.2, shroom: 0.8 } },
  { id: "ronin", name: "Ronin", type: "fire", role: "Bruiser", sprite: g("fourth:samurai_m", "fourth:samurai_f"), blurb: "One draw, one cut.", specialty: "Lightning-fast critical strikes", stats: { crit: 15, might: 15, hp: -5, guard: -10 }, passive: "The first cut is the deepest.", starterMoves: ["iaido", "grin", "ashcounter", "ashstep", "dash"], signature: "iaido", aptitudes: { physical: 1.5, woodcutting: 1.2, trading: 0.8 } },
  { id: "seraph", name: "Seraph", type: "light", role: "Mobility", sprite: g("fourth:angel_m", "fourth:angel_f"), blurb: "Wings that cut.", specialty: "Aerial blinks and radiant mends", stats: { speed: 20, arcana: 10, regen: 10, might: -10, guard: -10 }, immune: ["root"], passive: "Wings: the ground cannot hold it.", starterMoves: ["wingburst", "dawn", "lanternvault", "halo", "featherglide"], signature: "wingburst", aptitudes: { adventuring: 1.5, magic: 1.2, mining: 0.6 } },
  { id: "moonhopper", name: "Moonhopper", type: "air", role: "Mobility", sprite: one("fourth:bunny"), blurb: "Bounces off the moon.", specialty: "Huge hops, flips and evasive cuts", stats: { speed: 40, crit: 8, hp: -20, guard: -15 }, immune: ["root"], passive: "Too bouncy to pin down.", starterMoves: ["moonhop", "moonhook", "crowhop", "pirouette", "galedash"], signature: "moonhop", aptitudes: { adventuring: 1.5, fishing: 1.2, catching: 1.2, mining: 0.6 } },
  { id: "bladedancer", name: "Bladedancer", type: "spirit", role: "Mobility", sprite: one("fourth:dancer"), blurb: "Every swing is a step.", specialty: "Spinning melee with constant motion", stats: { speed: 25, haste: 10, crit: 5, hp: -15 }, passive: "Moving fast keeps every verse fresh.", starterMoves: ["whirlingveil", "gravewaltz", "bansheereel", "pirouette", "fleetfoot"], signature: "whirlingveil", aptitudes: { social: 1.4, adventuring: 1.3, mining: 0.7 } },
  { id: "sovereign", name: "Sovereign", type: "light", role: "Support", sprite: g("fourth:king", "fourth:queen"), blurb: "Crowned by the veil.", specialty: "Decrees that silence, and a royal purse", stats: { kyo: 20, xp: 10, guard: 10, hp: 10, speed: -15, haste: -5 }, immune: ["silence"], passive: "None may silence the crown.", starterMoves: ["royaldecree", "focuslance", "aegis", "summonbell", "procession"], signature: "royaldecree", aptitudes: { trading: 1.5, social: 1.5, physical: 0.8, woodcutting: 0.6 } },
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
  const s = CLASS_BY_ID[id]?.sprite;
  return !!s && s.m !== s.f;
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
  return (CLASS_BY_ID[classId]?.aptitudes as Partial<Record<SkillId, number>> | undefined)?.[skill] ?? 1;
}
