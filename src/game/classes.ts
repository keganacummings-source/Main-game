import type { RaceId, SkillId, TypeId } from "./content";
import { KIT_MOVES, STARTER_KITS } from "./class-kits";

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
  stats: StatMods; immune?: ImmuneId[]; passive: string;
  /**
   * Each class's original "signature" passive. V7 keeps it as the body text for a bonus perk
   * named `base_<classId>` — searchable in the Crying Girl's builder like any other perk,
   * no "Legacy" label and no separate tab.
   */
  basePassive: string;
  gimmick: string; perks: readonly string[]; starterMoves: string[]; signature: string;
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
  { id: "warden", name: "Bulwark", type: "earth", role: "Tank", focus: "Defense", fightStyle: "melee", sprite: one("warrior:warden"), blurb: "A wall that walks.", specialty: "Takes less damage than anyone. Grinds Mining", stats: { guard: 38, hp: 10, affinity: 5, speed: -10, haste: -5 }, passive: "Iron Bastion (R): plant the shield, take 80% less damage and send half of every blow back.", basePassive: "Stands firm: heavy hits are blunted by a raised shield.", gimmick: "bastion", perks: ["iron_footing", "shield_echo"], starterMoves: STARTER_KITS.warden, signature: "shieldbash", aptitudes: { mining: 2.5 } },
  { id: "spellweaver", name: "Spellweaver", type: "electric", role: "Caster", focus: "Spell Power", fightStyle: "mixed", sprite: one("warrior:spellweaver"), blurb: "Every word is a weapon.", specialty: "The hardest-hitting spells in the veil. Grinds Magic", stats: { arcana: 42, affinity: 5, hp: -15, guard: -10 }, passive: "Overload (R): for 10s every spell forks into two extra bolts.", basePassive: "Long casts crackle harder; the body is paper.", gimmick: "overload", perks: ["arc_memory", "static_skin"], starterMoves: STARTER_KITS.spellweaver, signature: "arcbolt", aptitudes: { magic: 2.5 } },
  { id: "spiritbinder", name: "Spirit Caller", type: "spirit", role: "Support", focus: "Summoning", fightStyle: "mixed", sprite: one("warrior:spiritbinder"), blurb: "Keeps a choir of the dead at their heel.", specialty: "Six spirits out at once. Grinds Ghostkeeping", stats: { regen: 20, arcana: 5, affinity: 5, might: -15 }, immune: ["gloom"], passive: "Choir Lead (R): an aura that makes your spirits follow your mouse and pulse the foes they touch.", basePassive: "A full choir follows: six spirits out at once, and ghostkeeping comes fast.", gimmick: "spiritlead", perks: ["choir_bond", "grave_chorus"], starterMoves: STARTER_KITS.spiritbinder, signature: "soulmend", aptitudes: { ghostkeeping: 2.6 }, outMax: 6 },
  { id: "nightblade", name: "Nightblade", type: "void", role: "Mobility", focus: "Critical Hits", fightStyle: "melee", sprite: one("warrior:nightblade"), blurb: "Gone before the blade lands.", specialty: "Crits more often than any class. Grinds Evasion", stats: { crit: 22, speed: 8, affinity: 5, hp: -15, guard: -12 }, passive: "Shadow Cat (R): turn into a black cat with 4x movement speed. The first hit after you leave cat form deals double damage.", basePassive: "Every step is a feint. Armor is for the slow.", gimmick: "cat", perks: ["nine_lives", "pounce"], starterMoves: STARTER_KITS.nightblade, signature: "shadowstrike", aptitudes: { evasion: 2.5 } },
  { id: "pathfinder", name: "Pathfinder", type: "air", role: "Marksman", focus: "Marksmanship", fightStyle: "ranged", sprite: one("warrior:pathfinder"), blurb: "Reads the wind, then the throat.", specialty: "Long-range volleys that land true. Grinds Hunting", stats: { might: 22, crit: 6, affinity: 5, guard: -10 }, immune: ["root"], passive: "Hawk Volley (R): for 8s an arrow flies every half second at the foe nearest your mouse.", basePassive: "Never pinned: roots slide off a light step.", gimmick: "volley", perks: ["eagle_eye", "trail_sense"], starterMoves: STARTER_KITS.pathfinder, signature: "piercingvolley", aptitudes: { hunting: 2.5 } },
  { id: "ironpalm", name: "Ironpalm", type: "normal", role: "Bruiser", focus: "Tempo", fightStyle: "melee", sprite: one("warrior:ironpalm"), blurb: "Fists tempered by a thousand mornings.", specialty: "Verses come back faster than anyone's. Grinds Physical", stats: { haste: 22, might: 5, regen: 10, affinity: 5, arcana: -20 }, immune: ["sleep"], passive: "Hundred Fists (R): plant your feet and strike everything around you ten times a second.", basePassive: "Discipline: never dozes, always breathing.", gimmick: "flurry", perks: ["iron_breath", "palm_chain"], starterMoves: STARTER_KITS.ironpalm, signature: "hundredpalm", aptitudes: { physical: 2.5 } },
  { id: "bloodrager", name: "Bloodrager", type: "fire", role: "Bruiser", focus: "Raw Power", fightStyle: "melee", sprite: one("warrior:bloodrager"), blurb: "Pain is fuel.", specialty: "The heaviest weapon hits in the veil. Grinds Skinning", stats: { might: 42, affinity: 5, hp: 5, guard: -25 }, immune: ["gloom"], passive: "Trophy Skins (R): wear the hide of a boss you have killed. Every boss slain joins your catalog.", basePassive: "Fear never takes; every cut feeds the rage.", gimmick: "bossform", perks: ["trophy_hunger", "red_mist"], starterMoves: STARTER_KITS.bloodrager, signature: "rampage", aptitudes: { skinning: 2.5 } },
  { id: "ghoulknight", name: "Dreadknight", type: "ghoul", role: "Tank", focus: "Lifesteal", fightStyle: "melee", sprite: one("warrior:ghoulknight"), blurb: "Plate that hungers.", specialty: "Heals by hitting. Grinds Bounty Hunting", stats: { leech: 18, hp: 10, guard: 8, affinity: 5, speed: -8, regen: -18 }, passive: "Grave Tether (R): chain up to four foes and drink their health for 8s.", basePassive: "Heals by taking, not by resting.", gimmick: "tether", perks: ["grave_plate", "marrow_feast"], starterMoves: STARTER_KITS.ghoulknight, signature: "soulreap", aptitudes: { bountyhunting: 2.5 } },
  { id: "frostblade", name: "Vanguard", type: "ice", role: "Tank", focus: "Endurance", fightStyle: "melee", sprite: one("warrior:frostblade"), blurb: "The last one standing in the line.", specialty: "The deepest health pool in the veil. Grinds Survival", stats: { hp: 42, guard: 5, affinity: 5, speed: -5, arcana: -10 }, immune: ["soak"], passive: "Glacier Path (R): for 10s you leave a trail of ice that roots and cuts every foe that crosses it.", basePassive: "Cold plate: water never weighs it down.", gimmick: "trail", perks: ["frozen_line", "rime_heart"], starterMoves: STARTER_KITS.frostblade, signature: "glaciercharge", aptitudes: { survival: 2.5 } },
  { id: "pyromancer", name: "Channeler", type: "fire", role: "Caster", focus: "Channeling", fightStyle: "mixed", sprite: one("warrior:pyromancer"), blurb: "Holds a spell until it breaks the world.", specialty: "Long channels and lingering areas. Grinds Alchemy", stats: { arcana: 25, haste: 12, affinity: 5, guard: -10 }, immune: ["burn"], passive: "Living Pyre (R): become a walking bonfire for 10s that burns everything close.", basePassive: "Made of flame: burns cannot hurt it.", gimmick: "pyre", perks: ["kindling", "ember_soul"], starterMoves: STARTER_KITS.pyromancer, signature: "inferno", aptitudes: { alchemy: 2.5 } },
  { id: "tidecaller", name: "Wellspring", type: "water", role: "Support", focus: "Recovery", fightStyle: "mixed", sprite: one("warrior:tidecaller"), blurb: "Never runs dry.", specialty: "Recovers between fights faster than anyone. Grinds Survival", stats: { regen: 48, arcana: 5, affinity: 5, speed: -5 }, immune: ["soak"], passive: "Tide Pool (R): open a healing pool at your mouse. You mend inside it, foes are soaked.", basePassive: "Flows through water like it is home.", gimmick: "pool", perks: ["deep_spring", "undertow"], starterMoves: STARTER_KITS.tidecaller, signature: "maelstrom", aptitudes: { survival: 2.0 } },
  { id: "stormrider", name: "Outrider", type: "air", role: "Mobility", focus: "Speed", fightStyle: "ranged", sprite: one("warrior:stormrider"), blurb: "Already over the next hill.", specialty: "The fastest feet in the veil. Grinds Adventuring", stats: { speed: 42, affinity: 5, hp: -15, guard: -10 }, immune: ["root"], passive: "Cyclone Ride (R): become a cyclone for 6s, double speed, shredding foes you pass through.", basePassive: "Cannot be rooted. Cannot sit still.", gimmick: "cyclone", perks: ["tailwind", "storm_eye"], starterMoves: STARTER_KITS.stormrider, signature: "cyclone", aptitudes: { adventuring: 2.5 } },
  { id: "briarmage", name: "Earthshaker", type: "earth", role: "Tank", focus: "Area Slams", fightStyle: "melee", sprite: one("warrior:briarmage"), blurb: "A hill with a temper.", specialty: "Huge slams that hit everything close. Grinds Woodcutting", stats: { might: 22, hp: 18, affinity: 5, speed: -20, haste: -8 }, immune: ["root"], passive: "Meteor Leap (R): leap to your mouse and slam down, rooting everything you land near.", basePassive: "Unmovable stone. Slow to start, slower to fall.", gimmick: "leap", perks: ["landslide", "bedrock"], starterMoves: STARTER_KITS.briarmage, signature: "tectonic", aptitudes: { woodcutting: 2.5 } },
  { id: "lightbringer", name: "Beacon", type: "light", role: "Caster", focus: "Exposing", fightStyle: "mixed", sprite: one("warrior:lightbringer"), blurb: "Shows every weakness.", specialty: "Beams that expose foes for sharp crits. Grinds Magic", stats: { crit: 12, arcana: 15, affinity: 5, hp: -8 }, immune: ["gloom"], passive: "Sun Lance (R): hold a beam from you to your mouse for 6s that burns and exposes all it touches.", basePassive: "Too bright for gloom.", gimmick: "beam", perks: ["solar_flare", "dawn_sight"], starterMoves: STARTER_KITS.lightbringer, signature: "sunburst", aptitudes: { magic: 2.0 } },
  { id: "voidwalker", name: "Phasewalker", type: "void", role: "Caster", focus: "Blink Casting", fightStyle: "mixed", sprite: one("warrior:voidwalker"), blurb: "Never where you aimed.", specialty: "Casts on the move and blinks out of reach. Grinds Evasion", stats: { speed: 18, arcana: 18, affinity: 5, hp: -10, regen: -15 }, immune: ["sleep"], passive: "Rift Blink: double-click anywhere on the map to teleport there (R also blinks to your mouse).", basePassive: "Never sleeps. Never quite heals.", gimmick: "blink", perks: ["rift_echo", "null_step"], starterMoves: STARTER_KITS.voidwalker, signature: "abyssrift", aptitudes: { evasion: 2.0 } },
  { id: "absolver", name: "Absolver", type: "light", role: "Support", focus: "Healing", fightStyle: "mixed", sprite: one("warrior:absolver"), blurb: "Forgives, then mends.", specialty: "The strongest heals in the veil. Grinds Social", stats: { regen: 35, guard: 10, affinity: 5, might: -25 }, immune: ["silence"], passive: "Halo of Mercy (R): for 8s you cannot fall below 1 health and half of every hit heals you instead.", basePassive: "Prayer cannot be silenced.", gimmick: "halo", perks: ["mercy_well", "last_rites"], starterMoves: STARTER_KITS.absolver, signature: "absolution", aptitudes: { social: 2.5 } },
  { id: "vigilant", name: "Vigilant", type: "spirit", role: "Support", focus: "Warding", fightStyle: "mixed", sprite: one("warrior:vigilant"), blurb: "Keeps the night watch.", specialty: "Wards, fear and protective chants. Grinds Shroom", stats: { guard: 20, regen: 12, affinity: 5, speed: -5, crit: -4 }, immune: ["sleep"], passive: "Night Watch Lantern (R): set a lantern at your mouse that terrifies and burns foes for 12s.", basePassive: "Always awake, always warded.", gimmick: "totem", perks: ["lantern_keeper", "watchful"], starterMoves: STARTER_KITS.vigilant, signature: "vigilward", aptitudes: { shroom: 2.5 } },
  { id: "coinmaster", name: "Coinmaster", type: "normal", role: "Support", focus: "Fortune", fightStyle: "ranged", sprite: one("warrior:coinmaster"), blurb: "Every fight is a deal.", specialty: "Kills pay far more kyo. Grinds Trading", stats: { kyo: 45, affinity: 5, might: -10, hp: -5 }, passive: "Coin Rain (R): rain coins on the spot under your mouse. The more kyo you carry, the harder they hit.", basePassive: "Kills pay out a heavier purse.", gimmick: "rain", perks: ["compound", "gilded_skin"], starterMoves: STARTER_KITS.coinmaster, signature: "cointoss", aptitudes: { trading: 2.6 } },
  { id: "hexbinder", name: "Hexbinder", type: "spirit", role: "Caster", focus: "Curses", fightStyle: "mixed", sprite: one("warrior:hexbinder"), blurb: "Signs pacts in other people's blood.", specialty: "Draining hexes and summoned bells. Grinds Catching", stats: { arcana: 22, leech: 8, affinity: 5, hp: -15, regen: -15 }, passive: "Wraith Veil (R): phase into ghost mode for 20s. You can only hurt enemy ghosts and only enemy ghosts can hurt you.", basePassive: "Every hex returns a little life.", gimmick: "phase", perks: ["wraith_pact", "soul_lure"], starterMoves: STARTER_KITS.hexbinder, signature: "bloodpact", aptitudes: { catching: 2.5 } },
  { id: "corsair", name: "Corsair", type: "water", role: "Bruiser", focus: "Dirty Fighting", fightStyle: "melee", sprite: one("warrior:corsair"), blurb: "Salt, steel, and a grin.", specialty: "Flurries, grapples and plunder. Grinds Fishing", stats: { might: 15, speed: 12, kyo: 12, affinity: 5, guard: -10 }, immune: ["soak"], passive: "Grapple Hook (R): hook the spot under your mouse. A foe is yanked to you and stunned, a wall pulls you to it.", basePassive: "Sea legs: water never slows the step.", gimmick: "grapple", perks: ["boarding_party", "salt_luck"], starterMoves: STARTER_KITS.corsair, signature: "cutlass", aptitudes: { fishing: 2.5 } },
  { id: "warlord", name: "Warlord", type: "normal", role: "Bruiser", focus: "All-Rounder", fightStyle: "melee", sprite: one("warrior:warlord"), blurb: "Commands the ring.", specialty: "No weakness, no single strength. Grinds Physical", stats: { hp: 12, might: 10, guard: 10, haste: 4, affinity: 5, speed: -5 }, passive: "War Banner (R): plant a banner for 15s. Inside its ring you hit 30% harder and take 25% less.", basePassive: "Rally Cry hastens and sharpens the whole body.", gimmick: "banner", perks: ["war_drums", "iron_will"], starterMoves: STARTER_KITS.warlord, signature: "rallycry", aptitudes: { physical: 2.0 } },
  { id: "nightlord", name: "Nightlord", type: "ghoul", role: "Bruiser", focus: "Blood Magic", fightStyle: "mixed", sprite: one("warrior:nightlord"), blurb: "Old blood, older hunger.", specialty: "Spells that drink deep. Grinds Skinning", stats: { leech: 14, arcana: 20, affinity: 5, regen: -25, guard: -5 }, passive: "Blood Moon (R): for 8s every hit you land heals you for 40% of it, and bats lash the foes near you.", basePassive: "Feeds on every wound. Rest does little.", gimmick: "bloodmoon", perks: ["crimson_tide", "old_blood"], starterMoves: STARTER_KITS.nightlord, signature: "crimsondrain", aptitudes: { skinning: 2.0 } },
  { id: "songweaver", name: "Songweaver", type: "air", role: "Support", focus: "Insight", fightStyle: "mixed", sprite: one("warrior:songweaver"), blurb: "A tune that bends the fight.", specialty: "Learns from every fight: the most XP in the veil. Grinds Cooking", stats: { xp: 32, haste: 8, regen: 8, affinity: 5, might: -15, hp: -5 }, immune: ["silence"], passive: "Tempo Shift (R): for 8s foes near you stagger in place while your verses come back twice as fast.", basePassive: "A song is never silenced; learns from every verse.", gimmick: "tempo", perks: ["grace_note", "encore"], starterMoves: STARTER_KITS.songweaver, signature: "ballad", aptitudes: { cooking: 2.5 } },
  { id: "oathkeeper", name: "Oathkeeper", type: "light", role: "Tank", focus: "Retribution", fightStyle: "melee", sprite: one("warrior:oathkeeper"), blurb: "Sworn steel.", specialty: "Hits back as hard as it is hit. Grinds Building", stats: { guard: 22, might: 14, affinity: 5, speed: -15 }, immune: ["gloom"], passive: "Oath of Retribution (R): for 6s store every blow you take (you feel half), then release it twice over.", basePassive: "The oath holds against fear.", gimmick: "oath", perks: ["sworn_plate", "penance"], starterMoves: STARTER_KITS.oathkeeper, signature: "judgment", aptitudes: { building: 2.5 } },
  { id: "ronin", name: "Ronin", type: "fire", role: "Bruiser", focus: "First Strike", fightStyle: "melee", sprite: one("warrior:ronin"), blurb: "One draw, one cut.", specialty: "Lightning-fast critical openers. Grinds Hunting", stats: { crit: 14, might: 18, affinity: 5, hp: -5, guard: -10 }, passive: "Iaido Dash (R): dash in a line to your mouse and cut every foe on the path with a guaranteed crit.", basePassive: "The first cut is the deepest.", gimmick: "iaido", perks: ["first_light", "still_water"], starterMoves: STARTER_KITS.ronin, signature: "iaido", aptitudes: { hunting: 2.0 } },
  { id: "seraph", name: "Seraph", type: "light", role: "Mobility", focus: "Flight", fightStyle: "mixed", sprite: one("warrior:seraph"), blurb: "Wings that cut.", specialty: "Aerial blinks and mending on the wing. Grinds Wayfinding", stats: { speed: 24, regen: 14, affinity: 5, might: -10, guard: -10 }, immune: ["root"], passive: "Skyborne (R): take flight for 10s. Fly over walls and water, 60% faster, untouchable by melee.", basePassive: "Wings: the ground cannot hold it.", gimmick: "flight", perks: ["feather_fall", "sky_mend"], starterMoves: STARTER_KITS.seraph, signature: "wingburst", aptitudes: { wayfinding: 2.5 } },
  { id: "moonhopper", name: "Moonhopper", type: "air", role: "Mobility", focus: "Evasion", fightStyle: "ranged", sprite: one("warrior:moonhopper"), blurb: "Bounces off the moon.", specialty: "Huge hops and flips: almost impossible to pin. Grinds Wayfinding", stats: { speed: 32, crit: 8, haste: 6, affinity: 5, hp: -20, guard: -15 }, immune: ["root"], passive: "Moon Rabbit (R): turn into a rabbit with a moon aura for 15s. Hop toward your mouse and every landing thumps the foes below.", basePassive: "Too bouncy to pin down.", gimmick: "rabbit", perks: ["moon_luck", "soft_landing"], starterMoves: STARTER_KITS.moonhopper, signature: "moonhop", aptitudes: { wayfinding: 2.0 } },
  { id: "bladedancer", name: "Bladedancer", type: "spirit", role: "Mobility", focus: "Momentum", fightStyle: "melee", sprite: one("warrior:bladedancer"), blurb: "Every swing is a step.", specialty: "Spinning melee that never stops moving. Grinds Adventuring", stats: { haste: 18, speed: 18, affinity: 5, hp: -15 }, passive: "Blade Waltz (R): three blades orbit you for 8s and cut whatever they touch.", basePassive: "Moving fast keeps every verse fresh.", gimmick: "blades", perks: ["silk_flow", "dancers_edge"], starterMoves: STARTER_KITS.bladedancer, signature: "whirlingveil", aptitudes: { adventuring: 2.0 } },
  { id: "sovereign", name: "Sovereign", type: "light", role: "Support", focus: "Command", fightStyle: "mixed", sprite: one("warrior:sovereign"), blurb: "Crowned by the veil.", specialty: "Decrees that silence, and a royal purse. Grinds Looting", stats: { kyo: 18, xp: 18, guard: 10, hp: 8, affinity: 5, speed: -15, haste: -5 }, immune: ["silence"], passive: "Royal Decree (R): every foe near you kneels (sleeps) and takes 30% more damage for 6s.", basePassive: "None may silence the crown.", gimmick: "decree", perks: ["royal_purse", "divine_right"], starterMoves: STARTER_KITS.sovereign, signature: "royaldecree", aptitudes: { looting: 2.5 } },
  { id: "embermage", name: "Embermage", type: "fire", role: "Caster", focus: "Burning Spells", fightStyle: "mixed", sprite: one("warrior:embermage"), blurb: "Lit from the inside out.", specialty: "Spells that keep burning long after they land. Grinds Magic", stats: { arcana: 40, affinity: 8, haste: 8, hp: -18, guard: -15, might: -30 }, immune: ["burn"], passive: "Immolation Loop (R): for 10s every spell you land wraps the target in a second burn ring that deals 30% of the hit again over 3 seconds. Stacks.", basePassive: "Flame is home. Every cast feeds it.", gimmick: "loop", perks: ["loop_stoke", "char_focus"], starterMoves: STARTER_KITS.embermage, signature: "ck_emberblast", aptitudes: { magic: 2.8 } },
  { id: "tidewitch", name: "Tidewitch", type: "water", role: "Caster", focus: "Area Flooding", fightStyle: "mixed", sprite: one("warrior:tidewitch"), blurb: "The sea comes when she calls.", specialty: "Wide water spells that soak whole groups. Grinds Magic", stats: { arcana: 40, affinity: 8, regen: 12, hp: -12, guard: -14, might: -30 }, immune: ["soak"], passive: "Tidal Surge (R): a wave explodes outward from your feet for 10s, knocking back and soaking every foe it crosses. Each crossing deals damage.", basePassive: "Salt runs deep. The sea answers.", gimmick: "surge", perks: ["surge_pull", "brine_sight"], starterMoves: STARTER_KITS.tidewitch, signature: "ck_tidecrash", aptitudes: { magic: 2.7 } },
  { id: "stonecaller", name: "Stonecaller", type: "earth", role: "Caster", focus: "Slow and Crush", fightStyle: "mixed", sprite: one("warrior:stonecaller"), blurb: "The ground obeys.", specialty: "Root spells and crushing earth magic. Grinds Magic", stats: { arcana: 36, guard: 6, affinity: 8, hp: -10, speed: -10, might: -30 }, immune: ["root"], passive: "Earthen Throne (R): plant yourself and call six pillars of stone in a ring around your mouse. Each pillar roots whatever it hits.", basePassive: "The earth holds her steady and she holds it tighter.", gimmick: "throne", perks: ["throne_root", "stone_skin"], starterMoves: STARTER_KITS.stonecaller, signature: "ck_stonecall", aptitudes: { magic: 2.7 } },
  { id: "stormwitch", name: "Stormwitch", type: "air", role: "Caster", focus: "Volley Casting", fightStyle: "mixed", sprite: one("warrior:stormwitch"), blurb: "The wind fires when she thinks.", specialty: "Rapid volley spells that blanket the air. Grinds Magic", stats: { arcana: 36, haste: 12, speed: 4, affinity: 8, hp: -16, guard: -14, might: -30 }, immune: ["root"], passive: "Storm Crown (R): for 8s air bolts fire automatically every 0.4s toward the nearest foe while you cast freely from any range.", basePassive: "The storm moves with her, never against her.", gimmick: "crown", perks: ["crown_gust", "gale_sense"], starterMoves: STARTER_KITS.stormwitch, signature: "ck_stormvolley", aptitudes: { magic: 2.7 } },
  { id: "frostweaver", name: "Frostweaver", type: "ice", role: "Caster", focus: "Freeze Combos", fightStyle: "mixed", sprite: one("warrior:frostweaver"), blurb: "Cold has a memory.", specialty: "Spells that stack freeze — then shatter it for massive damage. Grinds Magic", stats: { arcana: 38, crit: 8, affinity: 8, hp: -14, guard: -12, might: -30 }, immune: ["soak"], passive: "Shatter (R): instantly freeze every foe near your mouse and shatter them for 3× their frozen-damage total. Crits through shatter deal 5× instead.", basePassive: "Ice remembers every crack. So does she.", gimmick: "shatter", perks: ["shatter_spread", "cold_snap"], starterMoves: STARTER_KITS.frostweaver, signature: "ck_frostweave", aptitudes: { magic: 2.8 } },
  { id: "radiant", name: "Radiant", type: "light", role: "Caster", focus: "Pure Light Magic", fightStyle: "mixed", sprite: one("warrior:radiant"), blurb: "Everything she touches is illuminated.", specialty: "High-accuracy light spells — never misses, never blocked. Grinds Magic", stats: { arcana: 40, crit: 6, affinity: 8, haste: 6, hp: -16, guard: -16, might: -30 }, immune: ["gloom"], passive: "Luminary (R): for 10s all your spells pierce ward shields and hit twice — once as light, once as the target type's weakness.", basePassive: "Gloom cannot dim what she becomes.", gimmick: "luminary", perks: ["luminary_trail", "pure_sight"], starterMoves: STARTER_KITS.radiant, signature: "ck_radiantburst", aptitudes: { magic: 2.9 } },
  { id: "gravemage", name: "Gravemage", type: "ghoul", role: "Caster", focus: "Death Magic", fightStyle: "mixed", sprite: one("warrior:gravemage"), blurb: "Spells written on the inside of coffin lids.", specialty: "Curses that devour health over time. Grinds Magic", stats: { arcana: 40, leech: 10, affinity: 8, hp: -12, regen: -30, guard: -14, might: -30 }, passive: "Grave Hunger (R): for 10s every active curse on any foe siphons 6% of their max health per second and returns half to you.", basePassive: "Death feeds death. The spells remember.", gimmick: "hunger", perks: ["hunger_chain", "grave_mind"], starterMoves: STARTER_KITS.gravemage, signature: "ck_gravecurse", aptitudes: { magic: 2.8 } },
  { id: "arcanist", name: "Arcanist", type: "electric", role: "Caster", focus: "Pure Magic", fightStyle: "mixed", sprite: one("warrior:arcanist"), blurb: "Melee is beneath them.", specialty: "Every move is a spell. Mana regenerates faster than anyone. Grinds Magic", stats: { arcana: 42, haste: 8, affinity: 8, hp: -20, guard: -18, might: -30 }, passive: "Arcane Font (R): for 12s all spell cooldowns drain to zero and mana costs drop by half. Landing a spell restores 15 mana.", basePassive: "Pure conduit: mana trickles back even mid-fight.", gimmick: "font", perks: ["font_echo", "mana_well"], starterMoves: STARTER_KITS.arcanist, signature: "ck_arcprism", aptitudes: { magic: 3.0 } },
  { id: "ruinmage", name: "Ruinmage", type: "void", role: "Caster", focus: "Catastrophic Spells", fightStyle: "mixed", sprite: one("warrior:ruinmage"), blurb: "Casts things that should not be cast.", specialty: "The single heaviest spell hits in the veil. One massive ruin every fight. Grinds Magic", stats: { arcana: 38, crit: 10, affinity: 8, hp: -20, guard: -16, speed: -8, might: -30 }, immune: ["sleep"], passive: "Cataclysm (R): load every ounce of mana into one point under your mouse. The bigger the mana pool spent, the wider the blast.", basePassive: "Too focused on destruction to notice pain.", gimmick: "cataclysm", perks: ["ruin_focus", "void_surge"], starterMoves: STARTER_KITS.ruinmage, signature: "ck_ruinstrike", aptitudes: { magic: 2.8 } },
  { id: "veilsinger", name: "Veilsinger", type: "spirit", role: "Caster", focus: "Spell Chaining", fightStyle: "mixed", sprite: one("warrior:veilsinger"), blurb: "One spell calls the next.", specialty: "Each spell cast reduces the cooldown of the next. Grinds Magic", stats: { arcana: 30, haste: 16, affinity: 8, regen: 10, hp: -12, guard: -14, might: -30 }, immune: ["silence"], passive: "Resonant Verse (R): for 10s landing any spell immediately readies your two longest-cooldown spells and amplifies their next hit by 40%.", basePassive: "The verses remember each other.", gimmick: "resonance", perks: ["veil_chain", "spirit_echo"], starterMoves: STARTER_KITS.veilsinger, signature: "ck_veilsong", aptitudes: { magic: 2.6 } },
  { id: "cryinggirl", name: "Crying Girl", type: "water", role: "Support", focus: "Custom Build", fightStyle: "mixed", sprite: one("warrior:cryinggirl"), blurb: "Every tear is a choice.", specialty: "Builds her own loadout from every perk in the veil. Grinds Social", stats: { affinity: 5 }, passive: "Tearstorm (R): a weeping storm follows her for 12s, soaking and cutting foes and mending her for each one it hits. Fully custom: choose her element, role, fight style and stat lean, then pick any 4 perks from the full pool.", basePassive: "", gimmick: "tearstorm", perks: [], starterMoves: STARTER_KITS.cryinggirl, signature: "ck_tearlance", aptitudes: { social: 2.0 } },
] as const);

export type ClassId = (typeof CLASSES)[number]["id"];
export type ClassInfo = (typeof CLASSES)[number];
export const CLASS_BY_ID = Object.fromEntries(CLASSES.map((c) => [c.id, c])) as Record<ClassId, ClassInfo>;
export const ROLES: Role[] = ["Tank", "Bruiser", "Mobility", "Caster", "Support", "Marksman"];

const TYPE_RACE: Partial<Record<TypeId, RaceId>> = { earth: "thorn", fire: "cinder", water: "tide", ice: "rime", electric: "rime", air: "rime" };
export const CLASS_RACE = Object.fromEntries(CLASSES.map((c) => [c.id, TYPE_RACE[c.type] ?? "vesper"])) as Record<ClassId, RaceId>;

// ---------------------------------------------------------------------------
// Crying Girl: fully customisable from the class menu (element, role, fight style, stat lean).
// ---------------------------------------------------------------------------
export const CRY_TYPES = ["normal", "fire", "water", "earth", "air", "electric", "ice", "void", "light", "spirit", "ghoul"] as const satisfies readonly TypeId[];
export const LEAN_STATS: StatKey[] = ["hp", "might", "arcana", "guard", "speed", "crit", "haste", "regen", "leech", "kyo", "xp", "affinity"];
/** Points to spread. Lowering a stat (down to LEAN_MIN) gives its points back to spend elsewhere. */
export const LEAN_BUDGET = 40;
export const LEAN_MAX = 30;
export const LEAN_MIN = -20;
export const LEAN_STEP = 2;
export type CryingConfig = { type: TypeId; type2: TypeId | null; role: Role; fightStyle: FightStyle; lean: StatMods; rSkill: string };
const CRY_KEY = "turbz.cryingConfig";
const CRY_DEFAULT: CryingConfig = { type: "water", type2: "ice", role: "Support", fightStyle: "mixed", lean: { arcana: 10, regen: 10, affinity: 5 }, rSkill: "tearstorm" };

export function leanSpent(lean: StatMods): number {
  return Object.values(lean).reduce((n: number, v) => n + (v ?? 0), 0);
}
function cleanCry(raw: Partial<CryingConfig> | null | undefined): CryingConfig {
  const type = CRY_TYPES.includes(raw?.type as never) ? raw!.type! : CRY_DEFAULT.type;
  // Second element: a different valid element, or null for a single-element build.
  const type2 = CRY_TYPES.includes(raw?.type2 as never) && raw!.type2 !== type ? raw!.type2! : null;
  const role = ROLES.includes(raw?.role as Role) ? raw!.role! : CRY_DEFAULT.role;
  const fightStyle = (["melee", "ranged", "mixed"] as const).includes(raw?.fightStyle as never) ? raw!.fightStyle! : CRY_DEFAULT.fightStyle;
  const lean: StatMods = {};
  for (const k of LEAN_STATS) {
    const v = Math.round(Number(raw?.lean?.[k] ?? 0));
    if (Number.isFinite(v) && v) lean[k] = Math.max(LEAN_MIN, Math.min(LEAN_MAX, v));
  }
  // rSkill is validated against the gimmick registry lazily (GIMMICKS is defined later in this module),
  // so here we only coerce to a non-empty string; an unknown id simply yields no R skill at use time.
  const rSkill = typeof raw?.rSkill === "string" && raw.rSkill ? raw.rSkill : CRY_DEFAULT.rSkill;
  return { type, type2, role, fightStyle, lean: leanSpent(lean) <= LEAN_BUDGET && raw?.lean ? lean : { ...CRY_DEFAULT.lean }, rSkill };
}

/** Her element list: primary, plus the second element when she has one. */
export function cryingElements(): TypeId[] {
  return cryConfig.type2 ? [cryConfig.type, cryConfig.type2] : [cryConfig.type];
}
let cryConfig: CryingConfig = (() => {
  try { return cleanCry(typeof localStorage !== "undefined" ? JSON.parse(localStorage.getItem(CRY_KEY) ?? "null") : null); } catch { return cleanCry(null); }
})();
function applyCry() {
  const c = CLASS_BY_ID.cryinggirl as unknown as { type: TypeId; role: Role; fightStyle: FightStyle; stats: StatMods; gimmick: string };
  c.type = cryConfig.type;
  c.role = cryConfig.role;
  c.fightStyle = cryConfig.fightStyle;
  c.stats = { ...cryConfig.lean };
  // Her R skill is whatever gimmick she chose (classGimmick reads this live).
  c.gimmick = cryConfig.rSkill || "tearstorm";
  (CLASS_RACE as Record<string, RaceId>).cryinggirl = TYPE_RACE[cryConfig.type] ?? "vesper";
  // Her verses take her element(s), and her attacks take her style (melee cuts, ranged shots or spells).
  // With two elements, her kit alternates between them, so she is sent into the wild carrying both.
  const form = cryConfig.fightStyle === "melee" ? "melee" : cryConfig.fightStyle === "ranged" ? "ranged" : "spell";
  const elems = cryConfig.type2 ? [cryConfig.type, cryConfig.type2] : [cryConfig.type];
  let ei = 0;
  for (const m of KIT_MOVES) {
    if (m.cls !== "cryinggirl") continue;
    const base = (m as { base?: { type: string; form?: string; reach?: number; fx?: string } }).base ??= { type: m.type, form: m.form, reach: m.reach, fx: m.fx };
    m.type = elems[ei % elems.length]!;
    ei++;
    const attack = ["strike", "heavy", "channel"].includes(m.tactic);
    if (!attack) continue;
    if (cryConfig.fightStyle === "mixed") { m.form = base.form; m.reach = base.reach; m.fx = base.fx; continue; }
    m.form = form;
    // Melee stays close. A melee verse turned into a shot gets a real ranged reach instead of its old 52.
    m.reach = form === "melee"
      ? Math.min(60, base.form === "melee" ? (base.reach ?? 52) : (m.nova ?? base.reach ?? 56))
      : form === "ranged" && base.form === "melee"
        ? Math.max(96, base.reach ?? 52)
        : base.reach;
    m.fx = form === "melee" ? undefined : base.fx;
  }
}
export function getCryingConfig(): CryingConfig {
  return cryConfig;
}
export function setCryingConfig(next: Partial<CryingConfig>): void {
  cryConfig = cleanCry({ ...cryConfig, ...next, lean: next.lean ?? cryConfig.lean });
  applyCry();
  try { if (typeof localStorage !== "undefined") localStorage.setItem(CRY_KEY, JSON.stringify(cryConfig)); } catch { /* storage full */ }
}

export const LEGACY_CLASS: Record<RaceId, ClassId> = {
  vesper: "voidwalker", cinder: "pyromancer", tide: "tidecaller", thorn: "briarmage", rime: "frostblade",
};
applyCry();


// ---------------------------------------------------------------------------
// Class perks. Every class has two of its own (NEW_PERKS below). On top of
// that, each class contributes one "base" perk — its original signature
// passive — that any Crying Girl build can pick up. All perks share one pool
// here, searched the same way; nothing is tagged "legacy" anymore.
// ---------------------------------------------------------------------------
export type PerkHook =
  | "standStill" | "thorns" | "critHaste" | "sparkBack" | "gimmickTime" | "killHeal" | "dodge" | "firstStrike" | "farPower"
  | "combatSpeed" | "hitHaste" | "echoHit" | "bossPower" | "lowHpPower" | "killShield" | "execute" | "rootOnHit" | "burnOnHit"
  | "gimmickPower" | "soakOnHit" | "critHeal" | "gimmickHaste" | "lowHpGuard" | "gloomOnHit" | "kyoOnHit" | "ghostPower" | "formSpeed";
export type PerkDef = { id: string; name: string; cls: string; about: string; stats: StatMods; immune?: readonly ImmuneId[]; hook?: { kind: PerkHook; v: number; form?: "melee" | "spell" | "ranged" } };

const NEW_PERKS: PerkDef[] = [
  { id: "iron_footing", name: "Iron Footing", cls: "warden", about: "Standing still cuts damage taken by 20%.", stats: { guard: 6 }, hook: { kind: "standStill", v: 20 } },
  { id: "shield_echo", name: "Shield Echo", cls: "warden", about: "12% of damage taken is thrown back at the nearest foe.", stats: { hp: 5 }, hook: { kind: "thorns", v: 12 } },
  { id: "arc_memory", name: "Arc Memory", cls: "spellweaver", about: "Crits refund 8% of your gimmick cooldown and hit 15% harder.", stats: { crit: 4 }, hook: { kind: "critHaste", v: 8 } },
  { id: "static_skin", name: "Static Skin", cls: "spellweaver", about: "Foes that hit you have a 25% chance to be sparked.", stats: { guard: 4 }, hook: { kind: "sparkBack", v: 25 } },
  { id: "choir_bond", name: "Choir Bond", cls: "spiritbinder", about: "Your gimmick lasts 30% longer.", stats: { regen: 8 }, hook: { kind: "gimmickTime", v: 30 } },
  { id: "grave_chorus", name: "Grave Chorus", cls: "spiritbinder", about: "Each kill heals you for 4% of your health.", stats: { arcana: 4 }, hook: { kind: "killHeal", v: 4 } },
  { id: "nine_lives", name: "Nine Lives", cls: "nightblade", about: "14% chance to slip any hit entirely.", stats: { speed: 4 }, hook: { kind: "dodge", v: 14 } },
  { id: "pounce", name: "Ambush", cls: "nightblade", about: "+35% damage against foes at full health.", stats: { crit: 4 }, hook: { kind: "firstStrike", v: 35 } },
  { id: "eagle_eye", name: "Eagle Eye", cls: "pathfinder", about: "+25% damage to foes more than 120px away.", stats: { crit: 3 }, hook: { kind: "farPower", v: 25 } },
  { id: "trail_sense", name: "Trail Sense", cls: "pathfinder", about: "+15% movement speed while in a fight.", stats: { might: 4 }, hook: { kind: "combatSpeed", v: 15 } },
  { id: "iron_breath", name: "Iron Breath", cls: "ironpalm", about: "Every hit you land trims 0.15s off all verse cooldowns.", stats: { haste: 4 }, hook: { kind: "hitHaste", v: 15 } },
  { id: "palm_chain", name: "Palm Chain", cls: "ironpalm", about: "Melee hits have a 20% chance to strike again at half power.", stats: { might: 4 }, hook: { kind: "echoHit", v: 20, form: "melee" } },
  { id: "trophy_hunger", name: "Trophy Hunger", cls: "bloodrager", about: "+30% damage to bosses, and boss forms last 25% longer.", stats: { might: 5 }, hook: { kind: "bossPower", v: 30 } },
  { id: "red_mist", name: "Red Mist", cls: "bloodrager", about: "Below 40% health you deal 35% more damage.", stats: { hp: 5 }, hook: { kind: "lowHpPower", v: 35 } },
  { id: "grave_plate", name: "Grave Plate", cls: "ghoulknight", about: "Each kill wraps you in a shield worth 6% of your health.", stats: { guard: 5 }, hook: { kind: "killShield", v: 6 } },
  { id: "marrow_feast", name: "Marrow Feast", cls: "ghoulknight", about: "+30% damage to foes under 35% health.", stats: { leech: 3 }, hook: { kind: "execute", v: 30 } },
  { id: "frozen_line", name: "Frozen Line", cls: "frostblade", about: "Hits have a 15% chance to root.", stats: { hp: 6 }, hook: { kind: "rootOnHit", v: 15 } },
  { id: "rime_heart", name: "Rime Heart", cls: "frostblade", about: "Standing still cuts damage taken by 15%.", stats: { guard: 4 }, hook: { kind: "standStill", v: 15 } },
  { id: "kindling", name: "Kindling", cls: "pyromancer", about: "Hits have a 20% chance to set foes alight.", stats: { arcana: 4 }, hook: { kind: "burnOnHit", v: 20 } },
  { id: "ember_soul", name: "Ember Soul", cls: "pyromancer", about: "Your gimmick deals 30% more damage.", stats: { haste: 3 }, hook: { kind: "gimmickPower", v: 30 } },
  { id: "deep_spring", name: "Deep Spring", cls: "tidecaller", about: "Each kill heals you for 6% of your health.", stats: { regen: 10 }, hook: { kind: "killHeal", v: 6 } },
  { id: "undertow", name: "Undertow", cls: "tidecaller", about: "Hits have a 25% chance to soak.", stats: { arcana: 3 }, hook: { kind: "soakOnHit", v: 25 } },
  { id: "tailwind", name: "Tailwind", cls: "stormrider", about: "+20% movement speed while in a fight.", stats: { speed: 4 }, hook: { kind: "combatSpeed", v: 20 } },
  { id: "storm_eye", name: "Storm Eye", cls: "stormrider", about: "10% chance to slip any hit entirely.", stats: { crit: 3 }, hook: { kind: "dodge", v: 10 } },
  { id: "landslide", name: "Landslide", cls: "briarmage", about: "Your gimmick deals 35% more damage.", stats: { might: 4 }, hook: { kind: "gimmickPower", v: 35 } },
  { id: "bedrock", name: "Bedrock", cls: "briarmage", about: "Standing still cuts damage taken by 25%.", stats: { hp: 5 }, hook: { kind: "standStill", v: 25 } },
  { id: "solar_flare", name: "Solar Flare", cls: "lightbringer", about: "Crits heal you for 3% of your health.", stats: { crit: 4 }, hook: { kind: "critHeal", v: 3 } },
  { id: "dawn_sight", name: "Dawn Sight", cls: "lightbringer", about: "+20% damage to foes at full health.", stats: { arcana: 4 }, hook: { kind: "firstStrike", v: 20 } },
  { id: "rift_echo", name: "Rift Echo", cls: "voidwalker", about: "Your gimmick comes back 35% sooner.", stats: { arcana: 4 }, hook: { kind: "gimmickHaste", v: 35 } },
  { id: "null_step", name: "Null Step", cls: "voidwalker", about: "12% chance to slip any hit entirely.", stats: { speed: 4 }, hook: { kind: "dodge", v: 12 } },
  { id: "mercy_well", name: "Mercy Well", cls: "absolver", about: "Each kill heals you for 8% of your health.", stats: { regen: 8 }, hook: { kind: "killHeal", v: 8 } },
  { id: "last_rites", name: "Last Rites", cls: "absolver", about: "Below 40% health you take 20% less damage.", stats: { guard: 4 }, hook: { kind: "lowHpGuard", v: 20 } },
  { id: "lantern_keeper", name: "Lantern Keeper", cls: "vigilant", about: "Your gimmick lasts 40% longer.", stats: { guard: 4 }, hook: { kind: "gimmickTime", v: 40 } },
  { id: "watchful", name: "Watchful", cls: "vigilant", about: "Hits have a 20% chance to fill the foe with gloom.", stats: { regen: 6 }, hook: { kind: "gloomOnHit", v: 20 } },
  { id: "compound", name: "Compound Interest", cls: "coinmaster", about: "Hits have a 30% chance to shake loose 1-3 kyo.", stats: { kyo: 8 }, hook: { kind: "kyoOnHit", v: 30 } },
  { id: "gilded_skin", name: "Gilded Skin", cls: "coinmaster", about: "Each kill wraps you in a shield worth 5% of your health.", stats: { guard: 4 }, hook: { kind: "killShield", v: 5 } },
  { id: "wraith_pact", name: "Wraith Pact", cls: "hexbinder", about: "+40% damage to enemy ghosts and spirits.", stats: { arcana: 4 }, hook: { kind: "ghostPower", v: 40 } },
  { id: "soul_lure", name: "Soul Lure", cls: "hexbinder", about: "Each kill heals you for 5% of your health.", stats: { leech: 2 }, hook: { kind: "killHeal", v: 5 } },
  { id: "boarding_party", name: "Boarding Party", cls: "corsair", about: "+30% damage to foes at full health.", stats: { might: 4 }, hook: { kind: "firstStrike", v: 30 } },
  { id: "salt_luck", name: "Salt Luck", cls: "corsair", about: "Hits have a 25% chance to shake loose 1-3 kyo.", stats: { speed: 4 }, hook: { kind: "kyoOnHit", v: 25 } },
  { id: "war_drums", name: "War Drums", cls: "warlord", about: "Every hit you land trims 0.1s off all verse cooldowns.", stats: { haste: 3 }, hook: { kind: "hitHaste", v: 10 } },
  { id: "iron_will", name: "Iron Will", cls: "warlord", about: "Below 40% health you take 25% less damage.", stats: { hp: 5 }, hook: { kind: "lowHpGuard", v: 25 } },
  { id: "crimson_tide", name: "Crimson Tide", cls: "nightlord", about: "Crits heal you for 4% of your health.", stats: { leech: 3 }, hook: { kind: "critHeal", v: 4 } },
  { id: "old_blood", name: "Old Blood", cls: "nightlord", about: "Below 40% health you deal 30% more damage.", stats: { arcana: 4 }, hook: { kind: "lowHpPower", v: 30 } },
  { id: "grace_note", name: "Grace Note", cls: "songweaver", about: "Your gimmick comes back 30% sooner.", stats: { haste: 4 }, hook: { kind: "gimmickHaste", v: 30 } },
  { id: "encore", name: "Encore", cls: "songweaver", about: "Spells have a 20% chance to echo at half power.", stats: { xp: 6 }, hook: { kind: "echoHit", v: 20, form: "spell" } },
  { id: "sworn_plate", name: "Sworn Plate", cls: "oathkeeper", about: "18% of damage taken is thrown back at the nearest foe.", stats: { guard: 5 }, hook: { kind: "thorns", v: 18 } },
  { id: "penance", name: "Penance", cls: "oathkeeper", about: "+30% damage to foes under 35% health.", stats: { might: 4 }, hook: { kind: "execute", v: 30 } },
  { id: "first_light", name: "First Light", cls: "ronin", about: "+45% damage against foes at full health.", stats: { crit: 4 }, hook: { kind: "firstStrike", v: 45 } },
  { id: "still_water", name: "Still Water", cls: "ronin", about: "Crits refund 10% of your gimmick cooldown.", stats: { might: 4 }, hook: { kind: "critHaste", v: 10 } },
  { id: "feather_fall", name: "Feather Fall", cls: "seraph", about: "10% chance to slip any hit entirely.", stats: { regen: 6 }, hook: { kind: "dodge", v: 10 } },
  { id: "sky_mend", name: "Sky Mend", cls: "seraph", about: "Each kill heals you for 5% of your health.", stats: { speed: 4 }, hook: { kind: "killHeal", v: 5 } },
  { id: "moon_luck", name: "Moon Luck", cls: "moonhopper", about: "Transformed, you move 25% faster still.", stats: { crit: 4 }, hook: { kind: "formSpeed", v: 25 } },
  { id: "soft_landing", name: "Soft Landing", cls: "moonhopper", about: "15% chance to slip any hit entirely.", stats: { speed: 4 }, hook: { kind: "dodge", v: 15 } },
  { id: "silk_flow", name: "Silk Flow", cls: "bladedancer", about: "+20% movement speed while in a fight.", stats: { haste: 4 }, hook: { kind: "combatSpeed", v: 20 } },
  { id: "dancers_edge", name: "Dancer's Edge", cls: "bladedancer", about: "Melee hits have a 20% chance to strike again at half power.", stats: { crit: 3 }, hook: { kind: "echoHit", v: 20, form: "melee" } },
  { id: "royal_purse", name: "Royal Purse", cls: "sovereign", about: "Hits have a 25% chance to shake loose 1-3 kyo.", stats: { kyo: 6 }, hook: { kind: "kyoOnHit", v: 25 } },
  { id: "divine_right", name: "Divine Right", cls: "sovereign", about: "Your gimmick lasts 30% longer.", stats: { guard: 4 }, hook: { kind: "gimmickTime", v: 30 } },
];

/**
 * One extra perk per class, derived from that class's `basePassive`. These were the
 * old "signature" passives; they now live alongside new perks in a single pool, so the
 * Crying Girl's builder can pick from everything in one list.
 *
 * The stats on these are the class's own stat line at half strength — small but real.
 */
const BASE_PERKS: PerkDef[] = CLASSES.filter((c) => c.basePassive).map((c) => ({
  id: `base_${c.id}`, name: `${c.name}'s Signature`, cls: c.id, about: c.basePassive,
  stats: Object.fromEntries(Object.entries(c.stats).map(([k, v]) => [k, Math.round((v ?? 0) * 0.5)])) as StatMods,
  immune: (c as { immune?: readonly ImmuneId[] }).immune,
}));

export const PERKS: PerkDef[] = [...NEW_PERKS, ...BASE_PERKS];
export const PERK_BY_ID: Record<string, PerkDef> = Object.fromEntries(PERKS.map((p) => [p.id, p]));
export const CUSTOM_BUILD_MAX = 4;
const BUILD_KEY = "turbz.cryingBuild";

/** V6 → V7 perk-id compatibility: old saves stored `legacy_<cls>`; V7 renamed those to `base_<cls>`. */
function remapPerkId(id: string): string {
  return typeof id === "string" && id.startsWith("legacy_") ? `base_${id.slice(7)}` : id;
}

let customBuild: string[] = (() => {
  try {
    const raw = typeof localStorage !== "undefined" ? JSON.parse(localStorage.getItem(BUILD_KEY) ?? "[]") : [];
    return Array.isArray(raw) ? raw.map(remapPerkId).filter((id: string) => PERK_BY_ID[id]).slice(0, CUSTOM_BUILD_MAX) : [];
  } catch { return []; }
})();

export function getCustomBuild(): string[] {
  return customBuild;
}
export function setCustomBuild(ids: string[]): void {
  customBuild = [...new Set(ids.map(remapPerkId))].filter((id) => PERK_BY_ID[id]).slice(0, CUSTOM_BUILD_MAX);
  try { if (typeof localStorage !== "undefined") localStorage.setItem(BUILD_KEY, JSON.stringify(customBuild)); } catch { /* storage full */ }
}

/** The perks a class is playing with right now (the Crying Girl's come from her build). */
export function classPerks(classId: string | null | undefined): PerkDef[] {
  if (!classId) return [];
  const ids = classId === "cryinggirl" ? customBuild : ((CLASS_BY_ID[classId as ClassId] as { perks?: readonly string[] } | undefined)?.perks ?? []);
  return ids.map((id) => PERK_BY_ID[id]).filter(Boolean) as PerkDef[];
}

// ---------------------------------------------------------------------------
// Gimmicks: one real playstyle trick per class, on R.
// ---------------------------------------------------------------------------
export type GimmickDef = { id: string; name: string; cd: number; dur: number; tags: readonly string[] };
export const GIMMICKS: Record<string, GimmickDef> = {
  bastion: { id: "bastion", name: "Iron Bastion", cd: 22, dur: 6, tags: ["guard", "reflect"] },
  overload: { id: "overload", name: "Overload", cd: 26, dur: 10, tags: ["spark", "chain"] },
  spiritlead: { id: "spiritlead", name: "Choir Lead", cd: 20, dur: 15, tags: ["summon", "aura"] },
  cat: { id: "cat", name: "Shadow Cat", cd: 18, dur: 12, tags: ["transform", "speed"] },
  volley: { id: "volley", name: "Hawk Volley", cd: 22, dur: 8, tags: ["projectile"] },
  flurry: { id: "flurry", name: "Hundred Fists", cd: 18, dur: 4, tags: ["multi-hit", "area"] },
  bossform: { id: "bossform", name: "Trophy Skins", cd: 30, dur: 20, tags: ["transform"] },
  tether: { id: "tether", name: "Grave Tether", cd: 24, dur: 8, tags: ["drain", "leech"] },
  trail: { id: "trail", name: "Glacier Path", cd: 22, dur: 10, tags: ["freeze", "root"] },
  pyre: { id: "pyre", name: "Living Pyre", cd: 24, dur: 10, tags: ["burn", "aura"] },
  pool: { id: "pool", name: "Tide Pool", cd: 24, dur: 10, tags: ["heal", "soak"] },
  cyclone: { id: "cyclone", name: "Cyclone Ride", cd: 20, dur: 6, tags: ["speed", "area"] },
  leap: { id: "leap", name: "Meteor Leap", cd: 14, dur: 0.6, tags: ["teleport", "root", "area"] },
  beam: { id: "beam", name: "Sun Lance", cd: 22, dur: 6, tags: ["expose", "beam"] },
  blink: { id: "blink", name: "Rift Blink", cd: 4, dur: 0, tags: ["teleport"] },
  halo: { id: "halo", name: "Halo of Mercy", cd: 40, dur: 8, tags: ["heal", "guard"] },
  totem: { id: "totem", name: "Night Watch Lantern", cd: 24, dur: 12, tags: ["gloom", "summon"] },
  rain: { id: "rain", name: "Coin Rain", cd: 20, dur: 5, tags: ["area", "fortune"] },
  phase: { id: "phase", name: "Wraith Veil", cd: 45, dur: 20, tags: ["ghost"] },
  grapple: { id: "grapple", name: "Grapple Hook", cd: 9, dur: 0.4, tags: ["teleport", "stun"] },
  banner: { id: "banner", name: "War Banner", cd: 30, dur: 15, tags: ["aura", "buff"] },
  bloodmoon: { id: "bloodmoon", name: "Blood Moon", cd: 30, dur: 8, tags: ["leech", "aura"] },
  tempo: { id: "tempo", name: "Tempo Shift", cd: 28, dur: 8, tags: ["root", "haste"] },
  oath: { id: "oath", name: "Oath of Retribution", cd: 26, dur: 6, tags: ["reflect", "area"] },
  iaido: { id: "iaido", name: "Iaido Dash", cd: 12, dur: 0.3, tags: ["teleport", "crit"] },
  flight: { id: "flight", name: "Skyborne", cd: 30, dur: 10, tags: ["speed", "flight"] },
  rabbit: { id: "rabbit", name: "Moon Rabbit", cd: 22, dur: 15, tags: ["transform", "speed", "area"] },
  blades: { id: "blades", name: "Blade Waltz", cd: 20, dur: 8, tags: ["multi-hit", "summon"] },
  decree: { id: "decree", name: "Royal Decree", cd: 30, dur: 6, tags: ["sleep", "expose"] },
  tearstorm: { id: "tearstorm", name: "Tearstorm", cd: 24, dur: 12, tags: ["soak", "heal", "aura"] },
};
export function classGimmick(classId: string | null | undefined): GimmickDef | null {
  const id = classId ? (CLASS_BY_ID[classId as ClassId] as { gimmick?: string } | undefined)?.gimmick : undefined;
  return id ? GIMMICKS[id] ?? null : null;
}

/** Every R skill the Crying Girl can equip, with its source class and a plain description. */
export const CRY_RSKILLS: { id: string; name: string; from: string; tags: readonly string[]; about: string }[] =
  Object.values(GIMMICKS).map((g) => {
    const owner = CLASSES.find((c) => c.gimmick === g.id);
    // Strip the "Name (R): " lead from the class passive so we show just the effect.
    const about = (owner?.passive ?? "").replace(/^[^:]*\(R\):\s*/, "");
    return { id: g.id, name: g.name, from: owner?.name ?? "", tags: g.tags, about };
  });

// ---------------------------------------------------------------------------
// Crying Lady preset builds (TURBZ): save/load named configurations on this device.
// ---------------------------------------------------------------------------
const CRY_PRESET_KEY = "turbz.cryPresets";
export type CryPreset = { name: string; config: CryingConfig };
export function getCryPresets(): CryPreset[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CRY_PRESET_KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter((p) => p && typeof p.name === "string" && p.config).map((p) => ({ name: String(p.name).slice(0, 24), config: cleanCry(p.config) }));
  } catch { return []; }
}
function writeCryPresets(list: CryPreset[]): void {
  try { localStorage.setItem(CRY_PRESET_KEY, JSON.stringify(list.slice(0, 24))); } catch { /* storage full */ }
}
/** Save the current build under a name (replacing one with the same name). */
export function saveCryPreset(name: string): CryPreset[] {
  const nm = (name || "Build").trim().slice(0, 24) || "Build";
  const list = getCryPresets().filter((p) => p.name !== nm);
  list.unshift({ name: nm, config: { ...cryConfig, lean: { ...cryConfig.lean } } });
  writeCryPresets(list);
  return list;
}
export function loadCryPreset(name: string): void {
  const p = getCryPresets().find((x) => x.name === name);
  if (p) setCryingConfig(p.config);
}
export function deleteCryPreset(name: string): CryPreset[] {
  const list = getCryPresets().filter((p) => p.name !== name);
  writeCryPresets(list);
  return list;
}

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
  const perks = classPerks(classId);
  for (const src of [c?.stats, t?.stats, ...perks.map((p) => p.stats)]) for (const [k, v] of Object.entries(src ?? {})) stats[k as StatKey] += v ?? 0;
  const immune = [...new Set([...((c as { immune?: readonly ImmuneId[] })?.immune ?? []), ...((t as { immune?: readonly ImmuneId[] })?.immune ?? []), ...perks.flatMap((p) => p.immune ?? [])])];
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

/** How many spirits this class can have out at once (the Choir of Six passive raises it to six). */
export function classSpiritOut(classId: string | null | undefined): number {
  if (hasPassive(classId, "choir_six")) return 6;
  const n = classId ? (CLASS_BY_ID[classId as ClassId] as { outMax?: number } | undefined)?.outMax : undefined;
  return n && n > 0 ? n : 3;
}

// ---------------------------------------------------------------------------
// Class passives: one always-on rule per class that changes how it plays (not just a stat).
// The Crying Girl has none of her own; she borrows up to CRY_PASSIVE_MAX from other classes.
// The rules themselves run in class-gimmicks.ts (and a few engine hooks noted in each `about`).
// ---------------------------------------------------------------------------
export type ClassPassive = { id: string; cls: ClassId; name: string; about: string };
export const CLASS_PASSIVES: ClassPassive[] = [
  { id: "shield_wall", cls: "warden", name: "Shield Wall", about: "Hits from foes in front of you deal 40% less damage." },
  { id: "storm_chain", cls: "spellweaver", name: "Storm Chain", about: "Every 4th spell you land arcs to two more foes nearby for half damage." },
  { id: "choir_six", cls: "spiritbinder", name: "Choir of Six", about: "Six spirits can follow you at once instead of three." },
  { id: "killing_edge", cls: "nightblade", name: "Killing Edge", about: "Crits deal 50% more, and every crit lets you slip the next hit that comes within 3s." },
  { id: "hybrid_arrows", cls: "pathfinder", name: "Hybrid Arrows", about: "Every verse deals half physical and half magic damage: armor, spell resistance and element immunity only stop their own half." },
  { id: "flowing_strikes", cls: "ironpalm", name: "Flowing Strikes", about: "Each hit has a 20% chance to reset that verse's cooldown." },
  { id: "hunting_cat", cls: "bloodrager", name: "Hunting Cat", about: "A pet cat follows you and harvests trees, ore and mushrooms near you every few seconds." },
  { id: "grave_bargain", cls: "ghoulknight", name: "Grave Bargain", about: "Once every 90s, a killing blow leaves you at 1 health and you heal 30% over 3s." },
  { id: "last_stand", cls: "frostblade", name: "Unbroken", about: "Below 30% health you regenerate 3% of your health every second." },
  { id: "smoulder", cls: "pyromancer", name: "Smoulder", about: "Burning foes take 20% more from you, and a burning foe that dies sets the nearest foe alight." },
  { id: "tidal_rest", cls: "tidecaller", name: "Tidal Rest", about: "Out of combat you heal 5% of your health every second." },
  { id: "slipstream", cls: "stormrider", name: "Slipstream", about: "While moving you deal 25% more damage." },
  { id: "aftershock", cls: "briarmage", name: "Aftershock", about: "Melee hits quake the ground: every other foe within 60px takes 35% of the hit." },
  { id: "searing_light", cls: "lightbringer", name: "Searing Light", about: "Every hit exposes the foe; exposed foes take 15% more from you." },
  { id: "rift_step", cls: "voidwalker", name: "Rift Step", about: "Blink verses have no cooldown." },
  { id: "absolution", cls: "absolver", name: "Absolution", about: "Every kill heals you and every spirit with you for 10% of their health." },
  { id: "watchful_ward", cls: "vigilant", name: "Watchful Ward", about: "Every 8s a ward forms that blocks the next hit completely." },
  { id: "golden_touch", cls: "coinmaster", name: "Golden Touch", about: "Every kill pays a bonus of 5% of the kyo you carry (up to 200)." },
  { id: "lingering_hex", cls: "hexbinder", name: "Lingering Hex", about: "Hits curse the foe with gloom; hitting a foe already in gloom heals you for 15% of the damage." },
  { id: "plunder", cls: "corsair", name: "Plunder", about: "Hits on rooted, sleeping or soaked foes deal 40% more and steal 1-4 kyo." },
  { id: "battle_rhythm", cls: "warlord", name: "Battle Rhythm", about: "Each foe within 150px gives +6% damage and -4% damage taken (up to five foes)." },
  { id: "sanguine_spells", cls: "nightlord", name: "Sanguine Spells", about: "Spells heal you for 12% of the damage they deal." },
  { id: "ballad", cls: "songweaver", name: "Ballad of Ten", about: "Every 10th kill resets every verse cooldown." },
  { id: "vengeance", cls: "oathkeeper", name: "Vengeance", about: "After you take a hit, your next hit within 3s deals 60% more." },
  { id: "iaijutsu", cls: "ronin", name: "Iaijutsu", about: "Your first hit on every foe is a guaranteed crit." },
  { id: "guardian_wings", cls: "seraph", name: "Guardian Wings", about: "A hit worth more than 25% of your health is halved (once every 10s)." },
  { id: "lunar_grace", cls: "moonhopper", name: "Lunar Grace", about: "12% chance to slip any hit; after a slip your next hit is a crit." },
  { id: "momentum", cls: "bladedancer", name: "Momentum", about: "Each hit within 2s of the last stacks +5% damage, up to +50%." },
  { id: "royal_guard", cls: "sovereign", name: "Royal Guard", about: "Your spirits deal 35% more damage." },
  { id: "wildfire", cls: "embermage", name: "Wildfire", about: "Burning foes that die explode, hurting every foe within 80px." },
  { id: "rising_tide", cls: "tidewitch", name: "Rising Tide", about: "Spells soak foes 30% of the time, and soaked foes take 25% more from your spells." },
  { id: "crushing_weight", cls: "stonecaller", name: "Crushing Weight", about: "Rooted foes take 60% more damage from you." },
  { id: "static_volley", cls: "stormwitch", name: "Static Volley", about: "Every spell you land fires a free bolt at another foe nearby for 30%." },
  { id: "shatter_point", cls: "frostweaver", name: "Shatter Point", about: "Hitting a rooted foe breaks the ice for 80% more damage (and frees it)." },
  { id: "perfect_aim", cls: "radiant", name: "Perfect Aim", about: "Your verses never miss and cannot be dodged." },
  { id: "soul_harvest", cls: "gravemage", name: "Soul Harvest", about: "Each kill within 8s of the last stacks +8% damage, up to six stacks." },
  { id: "mana_font", cls: "arcanist", name: "Mana Font", about: "Spells cool down 15% faster and cost half the mana (TURBZ)." },
  { id: "cataclysm", cls: "ruinmage", name: "Cataclysm", about: "Every 12s, your next spell deals triple damage." },
  { id: "resonance", cls: "veilsinger", name: "Resonance", about: "Each spell you land cuts 0.4s off your other verses' cooldowns." },
];
export const CLASS_PASSIVE_BY_ID: Record<string, ClassPassive> = Object.fromEntries(CLASS_PASSIVES.map((p) => [p.id, p]));
/** The passive a class plays with natively (null for the Crying Girl). */
export function classPassiveOf(classId: string | null | undefined): ClassPassive | null {
  return CLASS_PASSIVES.find((p) => p.cls === classId) ?? null;
}
/** How many other classes' passives the Crying Girl may borrow. */
export const CRY_PASSIVE_MAX = 2;
const CRY_PASSIVE_KEY = "turbz.cryingPassives";
let cryPassives: string[] = (() => {
  try {
    const raw = typeof localStorage !== "undefined" ? JSON.parse(localStorage.getItem(CRY_PASSIVE_KEY) ?? "[]") : [];
    return Array.isArray(raw) ? raw.filter((id: string) => CLASS_PASSIVE_BY_ID[id]).slice(0, CRY_PASSIVE_MAX) : [];
  } catch { return []; }
})();
export function getCryPassives(): string[] { return cryPassives; }
export function setCryPassives(ids: string[]): void {
  cryPassives = [...new Set(ids)].filter((id) => CLASS_PASSIVE_BY_ID[id]).slice(0, CRY_PASSIVE_MAX);
  try { if (typeof localStorage !== "undefined") localStorage.setItem(CRY_PASSIVE_KEY, JSON.stringify(cryPassives)); } catch { /* storage full */ }
}
/** The passives a class has on right now: its own, or the Crying Girl's borrowed picks. */
export function activePassives(classId: string | null | undefined): string[] {
  if (!classId) return [];
  if (classId === "cryinggirl") return cryPassives;
  const own = classPassiveOf(classId);
  return own ? [own.id] : [];
}
export function hasPassive(classId: string | null | undefined, id: string): boolean {
  return activePassives(classId).includes(id);
}
