

import { KIT_MOVES } from "./class-kits";

export type TypeId =
  | "normal"
  | "fire"
  | "water"
  | "earth"
  | "air"
  | "electric"
  | "ice"
  | "void"
  | "light"
  | "spirit"
  | "ghoul";

export type Slot = "weapon" | "head" | "chest" | "legs" | "feet" | "relic";
export type QualityId = "worn" | "common" | "fine" | "rare" | "epic" | "legendary";
export type RaceId = "vesper" | "cinder" | "tide" | "thorn" | "rime";
export type MapId = "world" | "crypt" | "kiln" | `rift-${number}`;
export type FxId =
  | "voidring"
  | "solarnova"
  | "tidalsurge"
  | "briarburst"
  | "whitestorm"
  | "gravepulse"
  | "stormcrown"
  | "lanternwake"
  | "featherfall"
  | "bloodmoon";

export const TILE = 32;
export const WORLD_W = 420;
export const WORLD_H = 288;

let tileRemap: ((tx: number, ty: number) => { tx: number; ty: number }) | null = null;
/** Installs where classic chart positions land on the main world (see main-world.ts). Null restores stretching. */
export function setTileRemap(fn: ((tx: number, ty: number) => { tx: number; ty: number }) | null): void {
  tileRemap = fn;
}

/** POIs were laid out on the old 84×60 chart. The live map stretches them (or the main world re-homes them). */
export function scaleTile(tx: number, ty: number): { tx: number; ty: number } {
  if (tileRemap) return tileRemap(tx, ty);
  return {
    tx: Math.max(3, Math.min(WORLD_W - 4, Math.round(tx * (WORLD_W / 84)))),
    ty: Math.max(3, Math.min(WORLD_H - 4, Math.round(ty * (WORLD_H / 60)))),
  };
}

/** Spawn level sits on the hunter, five levels either side. */
export function levelNearHunter(hunter: number, roll: number): number {
  const delta = Math.floor(roll * 11) - 5;
  return Math.max(1, Math.floor(hunter) + delta);
}

/** 0 common, 1 uncommon, 2 rare, 3 epic. The shift keeps climbing until the mid hundreds. */
export function rarityForLevel(level: number, roll: number, boss = false): number {
  if (boss) return 3;
  const t = Math.max(0, Math.min(1, (level - 1) / 200));
  const epic = 0.04 + t * 0.28;
  const rare = 0.1 + t * 0.24;
  const uncommon = 0.2 + t * 0.16;
  if (roll < epic) return 3;
  if (roll < epic + rare) return 2;
  if (roll < epic + rare + uncommon) return 1;
  return 0;
}

export const TYPES: Record<
  TypeId,
  { name: string; color: string; strong: TypeId[]; weak: TypeId[]; immune: TypeId[] }
> = {
  normal: { name: "Normal", color: "#c8c0b0", strong: [], weak: ["earth", "spirit"], immune: [] },
  fire: { name: "Fire", color: "#e25a32", strong: ["ice", "void"], weak: ["water", "earth"], immune: [] },
  water: { name: "Water", color: "#3a7eb8", strong: ["fire", "earth"], weak: ["electric", "ice"], immune: [] },
  earth: { name: "Earth", color: "#8a6a3a", strong: ["fire", "electric"], weak: ["water", "air"], immune: ["electric"] },
  air: { name: "Air", color: "#9ad8c8", strong: ["earth", "spirit"], weak: ["electric", "ice"], immune: ["earth"] },
  electric: { name: "Electric", color: "#f2d43a", strong: ["water", "air"], weak: ["earth", "void"], immune: [] },
  ice: { name: "Ice", color: "#9ad0ff", strong: ["air", "earth"], weak: ["fire", "light"], immune: [] },
  void: { name: "Void", color: "#6a4cff", strong: ["spirit", "normal"], weak: ["light"], immune: [] },
  light: { name: "Light", color: "#fff1a8", strong: ["void", "spirit"], weak: ["fire", "earth"], immune: [] },
  spirit: { name: "Spirit", color: "#c9a6e8", strong: ["spirit", "ice"], weak: ["void"], immune: ["normal"] },
  ghoul: { name: "Ghoul", color: "#8d72a8", strong: ["spirit", "void"], weak: ["light", "fire"], immune: [] },
};

export const TYPE_IDS = Object.keys(TYPES) as TypeId[];

export function typeMult(atk: TypeId, def: TypeId): number {
  if (TYPES[def].immune.includes(atk)) return 0;
  if (TYPES[atk].strong.includes(def)) return 2;
  if (TYPES[atk].weak.includes(def)) return 0.5;
  return 1;
}

export type AttackForm = "melee" | "ranged" | "spell";

export type ReactKind = "strike" | "counter" | "move" | "roll" | "guard" | "heal";

export type Move = {
  id: string;
  name: string;
  type: TypeId;
  power: number;
  accuracy: number;
  crit: number;
  priority: number;
  effect: string;
  anim: string[];
  range: number;
  about: string;
  tactic?: Tactic;
  /** How the verse answers an incoming blow in a duel. */
  react?: ReactKind;
  /** Base slip chance for counters, steps, and rolls. Fatigue stacks on top. */
  fail?: number;
  /** Overrides the derived attack form. */
  form?: AttackForm;
  /** Spirit aid verses land on the witch instead of a foe. */
  target?: "foe" | "player";
  /** Exact reach in pixels (overrides the reach worked out from form, style and power). */
  reach?: number;
  /** Cooldown multiplier on top of the worked-out base (signature verses get a shape of their own). */
  cdMult?: number;
  /** Aura verses: toggled on from the bar, they stay up while slotted and reserve a share of max health. */
  aura?: AuraDef;
  /** A bespoke animation of its own (combat-fx.ts) instead of the one worked out from tactic and element. */
  fx?: MoveFx;
  /** Area: foes within `radius` px of the target also take `mult` of the hit. */
  splash?: { radius: number; mult: number };
  /** Hits every foe within this many px of the caster (the target takes the full hit). */
  nova?: number;
  /** Leaps to up to `jumps` more foes within `range` px, each hit `mult` of the one before. */
  chain?: { jumps: number; range: number; mult: number };
  /** Comes back for a second hit on the same foe at `echo` of the damage (boomerangs). */
  echo?: number;
  /** Multi-hit: the target is struck `hits` times in all, `gap` seconds apart, each extra hit at `mult`. */
  multi?: { hits: number; gap: number; mult: number };
  /** A status the caster gains when the verse lands (swift, shell). */
  selfBuff?: string;
  /** The class whose signature batch this verse belongs to. */
  cls?: string;
};
/** Bespoke verse animations (see combat-fx.ts MOVE_FX_IDS). */
export type MoveFx = "meteor" | "chain" | "vortex" | "pillar" | "nova" | "boomerang" | "barrage" | "fissure" | "sigil" | "spectral" | "wave" | "bloom";

/**
 * An aura: while it is up it reserves `reserve` (0–1) of your maximum health and adds its bonuses.
 * `chan` adds to gear enchantment totals (the same numbers gear and perks feed); `mod` adds to class stats.
 */
export type AuraDef = { reserve: number; chan?: Record<string, number>; mod?: Record<string, number>; label: string; role: "combat" | "defense" | "farming" | "spirits" | "travel" | "fortune" };
/** At most this many auras can be up at once. */
export const MAX_AURAS = 3;

export type Tactic = "strike" | "blink" | "ward" | "lunge" | "heavy" | "channel" | "heal" | "roll" | "dash" | "surge" | "aura";

export function moveTactic(m: Move): Tactic {
  if (m.tactic) return m.tactic;
  if (m.effect === "mend") return "heal";
  if (m.effect === "shell") return "ward";
  return "strike";
}

export function reactOf(m: Move): ReactKind {
  if (m.react) return m.react;
  const tactic = moveTactic(m);
  if (tactic === "roll" || tactic === "dash") return "roll";
  if (tactic === "surge") return "guard";
  if (tactic === "blink" || tactic === "lunge") return "move";
  if (tactic === "ward" || tactic === "aura") return "guard";
  if (tactic === "heal") return "heal";
  return "strike";
}

/** Slip chance. Strikes, guards, and heals do not slip. Fatigue is stacked defensive answers. */
export function defenseFail(m: Move, fatigue: number): number {
  const kind = reactOf(m);
  if (kind === "strike" || kind === "guard" || kind === "heal") return 0;
  const base = m.fail ?? (kind === "counter" ? 36 : kind === "move" ? 24 : 14);
  return Math.min(82, Math.round(base + Math.max(0, fatigue) * 14));
}

/** 0 eats the blow. 1 is clear of it. Reach is the incoming attack. */
export function rollCover(traveled: number, reach: number): number {
  const need = Math.max(40, reach * 0.38);
  return Math.max(0, Math.min(1, traveled / need));
}

export const MOVES: Move[] = [
  { id: "wail", name: "First Wail", type: "fire", power: 30, accuracy: 100, crit: 6, priority: 2, effect: "none", anim: ["beam", "spark"], range: 120, about: "A thin cry that still burns." },
  { id: "ember", name: "Ember Trail", type: "fire", power: 42, accuracy: 95, crit: 12, priority: 1, effect: "burn", anim: ["beam", "spark", "burst"], range: 130, about: "Leaves a burning stitch." },
  { id: "cinder", name: "Cinder Bite", type: "fire", power: 55, accuracy: 85, crit: 18, priority: 0, effect: "burn", anim: ["slash", "spark", "burst"], range: 48, about: "Close, cruel, and hot." },
  { id: "grin", name: "Glass Grin", type: "fire", power: 48, accuracy: 90, crit: 28, priority: 1, effect: "expose", anim: ["slash", "prism"], range: 52, about: "A smiling cut that opens guard." },
  { id: "foam", name: "Pale Foam", type: "water", power: 30, accuracy: 100, crit: 4, priority: 2, effect: "none", anim: ["rain", "pulse"], range: 110, about: "Soft water, perfect tempo." },
  { id: "soak", name: "Drip Hex", type: "water", power: 32, accuracy: 100, crit: 6, priority: 1, effect: "soak", anim: ["rain", "spiral"], range: 120, about: "Soaks the joints." },
  { id: "brine", name: "Brine Lash", type: "water", power: 52, accuracy: 86, crit: 14, priority: 0, effect: "soak", anim: ["slash", "rain"], range: 70, about: "Salt that bites twice in memory." },
  { id: "leech", name: "Sip Vein", type: "water", power: 36, accuracy: 95, crit: 8, priority: 1, effect: "leech", anim: ["beam", "orbit"], range: 100, about: "Drinks a little life back." },
  { id: "tide", name: "Rising Dirge", type: "water", power: 44, accuracy: 92, crit: 10, priority: 1, effect: "none", anim: ["rain", "spiral"], range: 140, about: "The hymn of the reach." },
  { id: "spore", name: "Crypt Spore", type: "earth", power: 28, accuracy: 95, crit: 6, priority: 1, effect: "sleep", anim: ["orbit", "rain"], range: 110, about: "Dust that makes eyelids heavy." },
  { id: "root", name: "Grave Root", type: "earth", power: 34, accuracy: 100, crit: 4, priority: 0, effect: "root", anim: ["spiral", "shield"], range: 90, about: "Pins feet to the barrow." },
  { id: "thorn", name: "Coffin Thorn", type: "earth", power: 46, accuracy: 90, crit: 10, priority: 1, effect: "none", anim: ["slash", "burst"], range: 56, about: "A thorn from the lid." },
  { id: "quake", name: "Grave Quake", type: "earth", power: 50, accuracy: 88, crit: 10, priority: 0, effect: "expose", anim: ["pulse", "burst"], range: 80, about: "The floor takes a side." },
  { id: "vine", name: "Widow Vine", type: "earth", power: 50, accuracy: 88, crit: 12, priority: 0, effect: "root", anim: ["spiral", "slash"], range: 78, about: "Binds, then tightens." },
  { id: "gust", name: "Ghost Gust", type: "air", power: 38, accuracy: 96, crit: 14, priority: 3, effect: "none", anim: ["spiral", "slash"], range: 130, about: "A fast cutting gust." },
  { id: "howl", name: "Banshee Howl", type: "air", power: 46, accuracy: 90, crit: 10, priority: 2, effect: "gloom", anim: ["orbit", "pulse"], range: 150, about: "Fear in a clean note." },
  { id: "jolt", name: "Grave Jolt", type: "electric", power: 36, accuracy: 97, crit: 12, priority: 3, effect: "spark", anim: ["spark", "beam"], range: 140, about: "A precise electrical jab." },
  { id: "storm", name: "Storm Wail", type: "electric", power: 50, accuracy: 86, crit: 8, priority: 1, effect: "spark", anim: ["spark", "burst"], range: 150, about: "The sky answers back." },
  { id: "shard", name: "Ice Shard", type: "ice", power: 36, accuracy: 100, crit: 16, priority: 2, effect: "none", anim: ["prism", "beam"], range: 130, about: "A clean frozen needle." },
  { id: "frost", name: "Frost Bite", type: "ice", power: 44, accuracy: 92, crit: 12, priority: 1, effect: "sleep", anim: ["rain", "prism"], range: 110, about: "Cold enough to dream." },
  { id: "whiteout", name: "Whiteout", type: "ice", power: 48, accuracy: 90, crit: 8, priority: 0, effect: "silence", anim: ["rain", "pulse"], range: 100, about: "Steals the next word." },
  { id: "lantern", name: "Void Lantern", type: "void", power: 33, accuracy: 100, crit: 6, priority: 2, effect: "gloom", anim: ["orbit", "beam"], range: 120, about: "A light that eats light." },
  { id: "shroud", name: "Widow Shroud", type: "void", power: 38, accuracy: 94, crit: 12, priority: 1, effect: "gloom", anim: ["orbit", "spiral"], range: 100, about: "Wraps the rhythm." },
  { id: "dirge", name: "Hollow Dirge", type: "void", power: 54, accuracy: 84, crit: 18, priority: 0, effect: "sleep", anim: ["orbit", "rain", "pulse"], range: 130, about: "The long note under the floor." },
  { id: "hex", name: "Chain Hex", type: "void", power: 40, accuracy: 92, crit: 16, priority: 1, effect: "spark", anim: ["spark", "beam"], range: 125, about: "Hexes leap once." },
  { id: "halo", name: "Halo Mend", type: "light", power: 22, accuracy: 100, crit: 4, priority: 2, effect: "mend", anim: ["spiral", "shield"], range: 40, about: "Mends the caster." },
  { id: "flash", name: "Holy Flash", type: "light", power: 46, accuracy: 90, crit: 14, priority: 2, effect: "expose", anim: ["prism", "burst"], range: 120, about: "A lance of chapel-light." },
  { id: "dawn", name: "Dawn Lance", type: "light", power: 40, accuracy: 100, crit: 10, priority: 2, effect: "none", anim: ["beam", "spark"], range: 145, about: "Focused and unkind to void." },
  { id: "creep", name: "Shadow Creep", type: "spirit", power: 42, accuracy: 94, crit: 12, priority: 1, effect: "gloom", anim: ["orbit", "spiral"], range: 100, about: "Arrives before the body does." },
  { id: "bite", name: "Night Bite", type: "spirit", power: 52, accuracy: 86, crit: 18, priority: 1, effect: "leech", anim: ["slash", "orbit"], range: 48, about: "Teeth with a receipt." },
  { id: "whisper", name: "Grave Whisper", type: "spirit", power: 30, accuracy: 100, crit: 6, priority: 3, effect: "gloom", anim: ["orbit", "beam"], range: 140, about: "A low chill." },
  { id: "rattle", name: "Bone Rattle", type: "normal", power: 40, accuracy: 95, crit: 10, priority: 1, effect: "spark", anim: ["slash", "burst"], range: 52, about: "Knuckles on a lid." },
  { id: "marrow", name: "Marrow Drain", type: "normal", power: 34, accuracy: 95, crit: 6, priority: 1, effect: "leech", anim: ["beam", "orbit"], range: 70, about: "Takes the warmth out of a rib." },
  { id: "measured", name: "Measured Strike", type: "normal", power: 30, accuracy: 100, crit: 5, priority: 2, effect: "none", anim: ["slash"], range: 48, about: "Clean tempo. Nothing wasted." },
  { id: "shell", name: "Urn Shell", type: "water", power: 18, accuracy: 100, crit: 0, priority: 2, effect: "shell", anim: ["shield", "rain"], range: 40, about: "A wet ward.", tactic: "ward" },
  { id: "veilstep", name: "Veil Step", type: "void", power: 16, accuracy: 100, crit: 10, priority: 3, effect: "none", anim: ["orbit", "slash"], range: 170, about: "A short blink and a nick. It slips if you spam it.", tactic: "blink", react: "move", fail: 24 },
  { id: "backbite", name: "Backbite", type: "ghoul", power: 18, accuracy: 96, crit: 18, priority: 2, effect: "leech", anim: ["slash", "orbit"], range: 160, about: "A sip from the spine. Not a feast.", tactic: "blink", react: "move", fail: 28 },
  { id: "aegis", name: "Three-Ward", type: "light", power: 0, accuracy: 100, crit: 0, priority: 3, effect: "shell", anim: ["shield"], range: 40, about: "No incoming harm for three seconds.", tactic: "ward", react: "guard" },
  { id: "icecrown", name: "Ice Crown", type: "ice", power: 0, accuracy: 100, crit: 0, priority: 3, effect: "shell", anim: ["prism", "shield"], range: 40, about: "Three seconds of glass.", tactic: "ward", react: "guard" },
  { id: "lunge", name: "Reed Lunge", type: "air", power: 26, accuracy: 90, crit: 12, priority: 2, effect: "none", anim: ["slash"], range: 130, about: "Dash in, nick, spring back. It can snag.", tactic: "lunge", react: "move", fail: 20 },
  { id: "pyrelunge", name: "Pyre Lunge", type: "fire", power: 30, accuracy: 86, crit: 14, priority: 1, effect: "burn", anim: ["slash", "spark"], range: 140, about: "A burning step that only chips.", tactic: "lunge", react: "move", fail: 22 },
  { id: "hammer", name: "Grave Hammer", type: "earth", power: 78, accuracy: 78, crit: 8, priority: 0, effect: "root", anim: ["burst", "pulse"], range: 52, about: "A heavy windup. You cannot weave through it.", tactic: "heavy" },
  { id: "hymn", name: "Chapel Hymn", type: "light", power: 66, accuracy: 90, crit: 8, priority: 0, effect: "expose", anim: ["beam", "prism"], range: 160, about: "A cast. Other verses wait.", tactic: "channel" },
  { id: "voidhymn", name: "Void Hymn", type: "void", power: 72, accuracy: 84, crit: 12, priority: 0, effect: "gloom", anim: ["orbit", "pulse"], range: 170, about: "The long note. Your hands are busy.", tactic: "channel" },
  { id: "roll", name: "Salt Roll", type: "normal", power: 0, accuracy: 100, crit: 0, priority: 3, effect: "none", anim: ["spiral"], range: 80, about: "Distance decides the blow. Spam and you trip.", tactic: "roll", react: "roll", fail: 16 },
  { id: "briaroll", name: "Briar Roll", type: "earth", power: 10, accuracy: 100, crit: 6, priority: 3, effect: "none", anim: ["spiral", "slash"], range: 90, about: "A thorn nick on the way through. Not a kill.", tactic: "roll", react: "roll", fail: 18 },
  { id: "tidemend", name: "Tide Mend", type: "water", power: 28, accuracy: 100, crit: 0, priority: 2, effect: "mend", anim: ["rain", "shield"], range: 40, about: "Drink the fight back.", tactic: "heal", react: "heal" },
  { id: "riposte", name: "Salt Riposte", type: "normal", power: 24, accuracy: 100, crit: 16, priority: 3, effect: "none", anim: ["slash", "spark"], range: 48, about: "Catch the blade and return a chip. It slips often.", tactic: "strike", react: "counter", fail: 36 },
  { id: "glassparry", name: "Glass Parry", type: "ice", power: 22, accuracy: 100, crit: 20, priority: 3, effect: "expose", anim: ["prism", "slash"], range: 52, about: "A cold answer. Fail and the glass is yours.", tactic: "strike", react: "counter", fail: 38 },
  { id: "thornanswer", name: "Thorn Answer", type: "earth", power: 26, accuracy: 96, crit: 10, priority: 2, effect: "root", anim: ["spiral", "slash"], range: 56, about: "Roots bite the striker if you do not slip.", tactic: "strike", react: "counter", fail: 34 },
  { id: "ashcounter", name: "Ash Counter", type: "fire", power: 28, accuracy: 94, crit: 14, priority: 2, effect: "burn", anim: ["spark", "burst"], range: 60, about: "A cinder flicked back. Small, mean, unreliable.", tactic: "strike", react: "counter", fail: 40 },
  { id: "voidrebuke", name: "Void Rebuke", type: "void", power: 20, accuracy: 100, crit: 12, priority: 3, effect: "gloom", anim: ["orbit", "pulse"], range: 70, about: "Turn their note inside out.", tactic: "strike", react: "counter", fail: 36 },
  { id: "lanternvault", name: "Lantern Vault", type: "light", power: 14, accuracy: 100, crit: 8, priority: 3, effect: "none", anim: ["beam", "spiral"], range: 150, about: "Leap the blow and tap them with the lantern.", tactic: "blink", react: "move", fail: 22 },
  { id: "tideslip", name: "Tide Slip", type: "water", power: 12, accuracy: 100, crit: 6, priority: 3, effect: "soak", anim: ["rain", "spiral"], range: 120, about: "Slide under the swing. Salt on the way out.", tactic: "lunge", react: "move", fail: 20 },
  { id: "crowhop", name: "Crow Hop", type: "air", power: 14, accuracy: 100, crit: 12, priority: 3, effect: "none", anim: ["spiral", "slash"], range: 140, about: "A bird-step. The nick is a feather.", tactic: "blink", react: "move", fail: 18 },
  { id: "gravepounce", name: "Grave Pounce", type: "ghoul", power: 22, accuracy: 88, crit: 16, priority: 2, effect: "leech", anim: ["slash", "orbit"], range: 130, about: "In, bite, out. The bite is a sip.", tactic: "lunge", react: "move", fail: 26 },
  { id: "ashstep", name: "Ash Step", type: "fire", power: 16, accuracy: 92, crit: 10, priority: 2, effect: "burn", anim: ["spark", "spiral"], range: 136, about: "Leave a coal where you were.", tactic: "blink", react: "move", fail: 24 },
  { id: "cindertumble", name: "Cinder Tumble", type: "fire", power: 8, accuracy: 100, crit: 4, priority: 3, effect: "none", anim: ["spark", "spiral"], range: 88, about: "Roll through coals. Distance or a scorch.", tactic: "roll", react: "roll", fail: 16 },
  { id: "frostskate", name: "Frost Skate", type: "ice", power: 6, accuracy: 100, crit: 8, priority: 3, effect: "none", anim: ["prism", "spiral"], range: 110, about: "Skate the length of the blow.", tactic: "roll", react: "roll", fail: 12 },
  { id: "widowtumble", name: "Widow Tumble", type: "void", power: 8, accuracy: 100, crit: 6, priority: 3, effect: "gloom", anim: ["orbit", "spiral"], range: 96, about: "A black roll. Far enough and the hymn misses.", tactic: "roll", react: "roll", fail: 18 },
  { id: "brace", name: "Bone Brace", type: "normal", power: 0, accuracy: 100, crit: 0, priority: 3, effect: "shell", anim: ["shield"], range: 40, about: "Eat the hit on purpose. No slip. No chip.", tactic: "ward", react: "guard" },
  { id: "choirbell", name: "Choir Bell", type: "light", power: 58, accuracy: 88, crit: 10, priority: 1, effect: "expose", anim: ["pulse", "prism", "burst"], range: 150, about: "A bell that staggers the ring.", tactic: "channel" },
  { id: "marrowcomet", name: "Marrow Comet", type: "ghoul", power: 62, accuracy: 82, crit: 14, priority: 0, effect: "leech", anim: ["beam", "burst", "orbit"], range: 160, about: "A rib torn into a comet.", tactic: "channel" },
  { id: "stormlattice", name: "Storm Lattice", type: "electric", power: 48, accuracy: 90, crit: 12, priority: 2, effect: "spark", anim: ["spark", "beam", "burst"], range: 155, about: "A cage of lightning. It jumps.", tactic: "strike" },
  { id: "briarcathedral", name: "Briar Cathedral", type: "earth", power: 54, accuracy: 86, crit: 8, priority: 0, effect: "root", anim: ["spiral", "burst", "slash"], range: 90, about: "The garden stands up and grabs.", tactic: "heavy" },
  { id: "solarguillotine", name: "Solar Guillotine", type: "fire", power: 70, accuracy: 76, crit: 18, priority: 0, effect: "burn", anim: ["slash", "burst", "spark"], range: 64, about: "One bright cut. The windup is honest.", tactic: "heavy" },
  { id: "tidecourt", name: "Tide Court", type: "water", power: 46, accuracy: 92, crit: 8, priority: 1, effect: "soak", anim: ["rain", "spiral", "pulse"], range: 140, about: "A court of waves sits on them.", tactic: "strike" },
  { id: "whiteprocession", name: "White Procession", type: "ice", power: 44, accuracy: 94, crit: 10, priority: 1, effect: "sleep", anim: ["prism", "rain", "orbit"], range: 130, about: "Saints of frost walk through the lane.", tactic: "strike" },
  { id: "hexcarousel", name: "Hex Carousel", type: "void", power: 42, accuracy: 90, crit: 16, priority: 1, effect: "spark", anim: ["orbit", "spark", "beam"], range: 135, about: "Hexes ride a wheel and hop once.", tactic: "strike" },
  { id: "bansheereel", name: "Banshee Reel", type: "air", power: 40, accuracy: 96, crit: 12, priority: 3, effect: "gloom", anim: ["spiral", "slash", "orbit"], range: 145, about: "A dancing cut that arrives early.", tactic: "strike" },
  { id: "gravewaltz", name: "Grave Waltz", type: "spirit", power: 38, accuracy: 94, crit: 14, priority: 2, effect: "leech", anim: ["orbit", "slash", "pulse"], range: 100, about: "Three steps, one sip.", tactic: "lunge", react: "move", fail: 22 },
  { id: "lanternrain", name: "Lantern Rain", type: "light", power: 36, accuracy: 100, crit: 8, priority: 1, effect: "expose", anim: ["beam", "rain", "spark"], range: 150, about: "Votives fall in a line.", tactic: "strike" },
  { id: "kilnbreath", name: "Kiln Breath", type: "fire", power: 50, accuracy: 88, crit: 10, priority: 1, effect: "burn", anim: ["burst", "spark", "beam"], range: 120, about: "The kiln exhales.", tactic: "strike" },
  { id: "saltcathedral", name: "Salt Cathedral", type: "water", power: 18, accuracy: 100, crit: 0, priority: 2, effect: "mend", anim: ["rain", "shield", "pulse"], range: 40, about: "A chapel of brine knits you.", tactic: "heal", react: "heal" },
  { id: "focuslance", name: "Focus Lance", type: "light", power: 36, accuracy: 100, crit: 22, priority: 3, effect: "expose", anim: ["beam", "spark"], range: 150, about: "A fast lance. It can speak before theirs.", tactic: "strike" },
  { id: "interrupt", name: "Veil Interrupt", type: "void", power: 22, accuracy: 100, crit: 8, priority: 4, effect: "silence", anim: ["orbit", "beam"], range: 130, about: "Cut their verse. Yours is small on purpose.", tactic: "strike" },
  { id: "packfear", name: "Pack Fear", type: "spirit", power: 18, accuracy: 100, crit: 4, priority: 2, effect: "gloom", anim: ["orbit", "pulse"], range: 160, about: "The ring flinches. Little damage, long chill.", tactic: "strike" },
  { id: "summonbell", name: "Summon Bell", type: "void", power: 12, accuracy: 100, crit: 4, priority: 1, effect: "none", anim: ["orbit", "pulse", "spark"], range: 80, about: "A bell for things that should stay buried.", tactic: "channel" },
  { id: "bloodstep", name: "Blood Step", type: "ghoul", power: 20, accuracy: 92, crit: 14, priority: 2, effect: "leech", anim: ["slash", "orbit", "burst"], range: 110, about: "Step through them and keep a drop.", tactic: "blink", react: "move", fail: 26 },
  { id: "mirrorward", name: "Mirror Ward", type: "ice", power: 8, accuracy: 100, crit: 6, priority: 3, effect: "shell", anim: ["prism", "shield", "spark"], range: 70, about: "A pane that answers with a shard.", tactic: "ward", react: "counter", fail: 32 },
  { id: "hearthline", name: "Hearth Line", type: "fire", power: 34, accuracy: 96, crit: 8, priority: 1, effect: "burn", anim: ["beam", "spark"], range: 125, about: "A straight road of coals.", tactic: "strike" },
  { id: "moonhook", name: "Moon Hook", type: "air", power: 32, accuracy: 94, crit: 18, priority: 2, effect: "none", anim: ["slash", "spiral"], range: 78, about: "A hooked cut that lifts them.", tactic: "strike" },
  { id: "ossuary", name: "Ossuary Drum", type: "normal", power: 44, accuracy: 90, crit: 8, priority: 0, effect: "spark", anim: ["burst", "pulse", "slash"], range: 88, about: "The floor keeps time and then hits.", tactic: "heavy" },
  { id: "rimespire", name: "Rime Spire", type: "ice", power: 52, accuracy: 84, crit: 16, priority: 1, effect: "root", anim: ["prism", "beam", "burst"], range: 120, about: "A spire from under their heel.", tactic: "strike" },
  { id: "widowfan", name: "Widow Fan", type: "void", power: 30, accuracy: 100, crit: 10, priority: 2, effect: "gloom", anim: ["orbit", "slash", "rain"], range: 100, about: "A fan of black silk. It touches twice in the eye.", tactic: "strike" },
  { id: "chapelwheel", name: "Chapel Wheel", type: "light", power: 40, accuracy: 92, crit: 12, priority: 1, effect: "expose", anim: ["prism", "spiral", "burst"], range: 110, about: "A wheel of saints. Pretty, and unkind.", tactic: "strike" },
  { id: "brinecloak", name: "Brine Cloak", type: "water", power: 0, accuracy: 100, crit: 0, priority: 3, effect: "shell", anim: ["rain", "shield"], range: 40, about: "Salt on the shoulders. The next blow is smaller.", tactic: "ward", react: "guard" },
  // Class signatures
  { id: "shieldbash", name: "Shield Bash", type: "earth", power: 58, accuracy: 92, crit: 6, priority: 1, effect: "root", anim: ["burst", "shield"], range: 52, about: "Bulwark signature. A shield to the face roots them in place.", tactic: "heavy" },
  { id: "arcbolt", name: "Arc Bolt", type: "electric", power: 64, accuracy: 90, crit: 12, priority: 0, effect: "spark", anim: ["spark", "beam", "burst"], range: 170, about: "Spellweaver signature. A long-charged bolt that chains sparks.", tactic: "channel" },
  { id: "soulmend", name: "Soul Mend", type: "spirit", power: 34, accuracy: 100, crit: 0, priority: 2, effect: "mend", anim: ["orbit", "shield"], range: 40, about: "Spirit Caller signature. Borrowed spirits knit your wounds.", tactic: "heal", react: "heal" },
  { id: "shadowstrike", name: "Shadow Strike", type: "void", power: 34, accuracy: 96, crit: 30, priority: 3, effect: "expose", anim: ["orbit", "slash", "burst"], range: 170, about: "Nightblade signature. Blink behind them and open the guard.", tactic: "blink", react: "move", fail: 18 },
  { id: "piercingvolley", name: "Piercing Volley", type: "air", power: 46, accuracy: 94, crit: 14, priority: 1, effect: "expose", anim: ["beam", "slash"], range: 190, about: "Pathfinder signature. Arrows that punch through armor.", tactic: "strike", form: "ranged" },
  { id: "hundredpalm", name: "Hundred Palm", type: "normal", power: 52, accuracy: 96, crit: 14, priority: 2, effect: "none", anim: ["slash", "burst", "slash"], range: 48, about: "Ironpalm signature. A blur of open-hand strikes.", tactic: "strike", form: "melee" },
  { id: "rampage", name: "Rampage", type: "fire", power: 82, accuracy: 80, crit: 14, priority: 0, effect: "burn", anim: ["burst", "spark", "slash"], range: 60, about: "Bloodrager signature. An unhinged overhead that sets them alight.", tactic: "heavy" },
  { id: "soulreap", name: "Soul Reap", type: "ghoul", power: 70, accuracy: 86, crit: 10, priority: 0, effect: "leech", anim: ["slash", "orbit", "burst"], range: 60, about: "Dreadknight signature. A scything blow that drinks deep.", tactic: "heavy" },
  { id: "glaciercharge", name: "Glacier Charge", type: "ice", power: 40, accuracy: 92, crit: 14, priority: 1, effect: "root", anim: ["prism", "slash"], range: 150, about: "Vanguard signature. Charge in and freeze their feet.", tactic: "lunge", react: "move", fail: 18 },
  { id: "inferno", name: "Inferno", type: "fire", power: 76, accuracy: 86, crit: 10, priority: 0, effect: "burn", anim: ["burst", "spark", "pulse"], range: 160, about: "Channeler signature. Become the fire for a heartbeat.", tactic: "channel" },
  { id: "maelstrom", name: "Maelstrom", type: "water", power: 68, accuracy: 88, crit: 8, priority: 0, effect: "soak", anim: ["rain", "spiral", "pulse"], range: 160, about: "Wellspring signature. A whirlpool that drowns their stride.", tactic: "channel" },
  { id: "cyclone", name: "Cyclone", type: "air", power: 50, accuracy: 94, crit: 14, priority: 2, effect: "none", anim: ["spiral", "slash", "spiral"], range: 150, about: "Outrider signature. A fast tearing wind.", tactic: "strike", form: "ranged" },
  { id: "tectonic", name: "Tectonic Slam", type: "earth", power: 86, accuracy: 78, crit: 8, priority: 0, effect: "root", anim: ["pulse", "burst"], range: 70, about: "Earthshaker signature. The ground breaks under them.", tactic: "heavy" },
  { id: "sunburst", name: "Sunburst", type: "light", power: 70, accuracy: 90, crit: 12, priority: 0, effect: "expose", anim: ["prism", "burst", "beam"], range: 160, about: "Beacon signature. A noon that burns through shadow.", tactic: "channel" },
  { id: "abyssrift", name: "Abyss Rift", type: "void", power: 74, accuracy: 86, crit: 14, priority: 0, effect: "gloom", anim: ["orbit", "pulse", "burst"], range: 170, about: "Phasewalker signature. Tear a hole and let it stare.", tactic: "channel" },
  { id: "absolution", name: "Absolution", type: "light", power: 40, accuracy: 100, crit: 0, priority: 2, effect: "mend", anim: ["spiral", "shield", "prism"], range: 40, about: "Absolver signature. A full prayer of mending.", tactic: "heal", react: "heal" },
  { id: "vigilward", name: "Vigil Ward", type: "spirit", power: 10, accuracy: 100, crit: 0, priority: 3, effect: "shell", anim: ["shield", "orbit"], range: 40, about: "Vigilant signature. Spirits stand guard for three seconds.", tactic: "ward", react: "guard" },
  { id: "cointoss", name: "Gilded Toss", type: "normal", power: 38, accuracy: 98, crit: 20, priority: 2, effect: "expose", anim: ["spark", "beam"], range: 160, about: "Coinmaster signature. A coin to the eye. Rude and effective.", tactic: "strike", form: "ranged" },
  { id: "bloodpact", name: "Blood Pact", type: "spirit", power: 60, accuracy: 88, crit: 12, priority: 0, effect: "leech", anim: ["orbit", "beam", "pulse"], range: 150, about: "Hexbinder signature. A signed curse that pays you back.", tactic: "channel" },
  { id: "cutlass", name: "Cutlass Flurry", type: "water", power: 50, accuracy: 94, crit: 16, priority: 2, effect: "soak", anim: ["slash", "rain", "slash"], range: 48, about: "Corsair signature. Three salted cuts.", tactic: "strike", form: "melee" },
  { id: "rallycry", name: "Rally Cry", type: "normal", power: 0, accuracy: 100, crit: 0, priority: 3, effect: "none", anim: ["pulse", "shield"], range: 40, about: "Warlord signature. Hasten your step and sharpen your crits.", tactic: "surge" },
  { id: "crimsondrain", name: "Crimson Drain", type: "ghoul", power: 48, accuracy: 94, crit: 10, priority: 1, effect: "leech", anim: ["beam", "orbit"], range: 140, about: "Nightlord signature. Pull their blood across the air.", tactic: "strike", form: "spell" },
  { id: "ballad", name: "Dread Ballad", type: "air", power: 54, accuracy: 92, crit: 8, priority: 1, effect: "gloom", anim: ["orbit", "spiral", "pulse"], range: 160, about: "Songweaver signature. A verse that unsettles the ring.", tactic: "channel" },
  { id: "judgment", name: "Judgment", type: "light", power: 80, accuracy: 84, crit: 12, priority: 0, effect: "expose", anim: ["prism", "burst", "slash"], range: 60, about: "Oathkeeper signature. A sentence carried out in steel.", tactic: "heavy" },
  { id: "iaido", name: "Iaido Draw", type: "fire", power: 58, accuracy: 94, crit: 32, priority: 3, effect: "burn", anim: ["slash", "spark"], range: 52, about: "Ronin signature. Draw and cut before they blink.", tactic: "strike", form: "melee" },
  { id: "wingburst", name: "Wingburst", type: "light", power: 30, accuracy: 96, crit: 14, priority: 3, effect: "none", anim: ["prism", "spiral", "burst"], range: 180, about: "Seraph signature. Fly to them on a burst of feathers.", tactic: "blink", react: "move", fail: 16 },
  { id: "moonhop", name: "Moon Hop", type: "air", power: 24, accuracy: 98, crit: 18, priority: 3, effect: "none", anim: ["spiral", "slash"], range: 190, about: "Moonhopper signature. A huge hop that lands on their head.", tactic: "blink", react: "move", fail: 12 },
  { id: "whirlingveil", name: "Whirling Veil", type: "spirit", power: 46, accuracy: 94, crit: 16, priority: 2, effect: "gloom", anim: ["spiral", "slash", "orbit"], range: 52, about: "Bladedancer signature. A spinning dance of silk and steel.", tactic: "strike", form: "melee" },
  { id: "royaldecree", name: "Royal Decree", type: "normal", power: 56, accuracy: 92, crit: 10, priority: 1, effect: "silence", anim: ["pulse", "beam"], range: 160, about: "Sovereign signature. By order of the crown, be quiet.", tactic: "channel" },
  // Movement
  { id: "dash", name: "Quickstep", type: "normal", power: 0, accuracy: 100, crit: 0, priority: 3, effect: "none", anim: ["spiral"], range: 40, about: "Dash where you are moving. Brief evasion.", tactic: "dash", fail: 10 },
  { id: "galedash", name: "Gale Dash", type: "air", power: 14, accuracy: 100, crit: 10, priority: 3, effect: "none", anim: ["spiral", "slash"], range: 40, about: "Ride the wind forward and nick anything you pass.", tactic: "dash", fail: 8 },
  { id: "shadowdash", name: "Shadow Dash", type: "void", power: 12, accuracy: 100, crit: 12, priority: 3, effect: "gloom", anim: ["orbit", "spiral"], range: 40, about: "Slip through the dark and leave dread behind.", tactic: "dash", fail: 12 },
  { id: "tiderush", name: "Tide Rush", type: "water", power: 16, accuracy: 100, crit: 6, priority: 3, effect: "soak", anim: ["rain", "spiral"], range: 40, about: "Surf forward on a wave.", tactic: "dash", fail: 14 },
  { id: "holystep", name: "Hallowed Step", type: "light", power: 10, accuracy: 100, crit: 6, priority: 3, effect: "none", anim: ["prism", "spiral"], range: 40, about: "A step of light. Untouchable for a heartbeat.", tactic: "dash", fail: 12 },
  { id: "flowstep", name: "Flowing Step", type: "normal", power: 8, accuracy: 100, crit: 8, priority: 3, effect: "none", anim: ["spiral", "slash"], range: 40, about: "Water-smooth footwork. Rarely slips.", tactic: "dash", fail: 6 },
  { id: "fleetfoot", name: "Fleetfoot", type: "air", power: 0, accuracy: 100, crit: 0, priority: 3, effect: "none", anim: ["spiral"], range: 40, about: "Run far faster for four seconds.", tactic: "surge" },
  { id: "battlerush", name: "Battle Rush", type: "fire", power: 0, accuracy: 100, crit: 0, priority: 3, effect: "none", anim: ["spark", "pulse"], range: 40, about: "Adrenaline: faster feet and sharper crits.", tactic: "surge" },
  { id: "frostglide", name: "Frost Glide", type: "ice", power: 0, accuracy: 100, crit: 0, priority: 3, effect: "none", anim: ["prism", "spiral"], range: 40, about: "Skate on your own ice for four seconds.", tactic: "surge" },
  { id: "spiritglide", name: "Spirit Glide", type: "spirit", power: 0, accuracy: 100, crit: 0, priority: 3, effect: "none", anim: ["orbit", "spiral"], range: 40, about: "Drift like a ghost. Faster for four seconds.", tactic: "surge" },
  { id: "featherglide", name: "Feather Glide", type: "light", power: 0, accuracy: 100, crit: 0, priority: 3, effect: "none", anim: ["prism", "spiral"], range: 40, about: "Spread the wings and glide.", tactic: "surge" },
  { id: "procession", name: "Royal Procession", type: "light", power: 0, accuracy: 100, crit: 0, priority: 3, effect: "none", anim: ["pulse", "prism"], range: 40, about: "Make way. Faster stride for four seconds.", tactic: "surge" },
  { id: "grapple", name: "Grapple Hook", type: "normal", power: 20, accuracy: 94, crit: 10, priority: 2, effect: "none", anim: ["beam", "slash"], range: 190, about: "Hook them and pull yourself in.", tactic: "lunge", react: "move", fail: 18 },
  { id: "pirouette", name: "Pirouette", type: "air", power: 10, accuracy: 100, crit: 10, priority: 3, effect: "none", anim: ["spiral", "slash"], range: 96, about: "Spin out of the blow with a flick of steel.", tactic: "roll", react: "roll", fail: 10 },
  { id: "batswarm", name: "Bat Swarm", type: "ghoul", power: 18, accuracy: 96, crit: 12, priority: 3, effect: "leech", anim: ["orbit", "slash"], range: 170, about: "Burst into bats and reform beside them.", tactic: "blink", react: "move", fail: 20 },
  { id: "arcblink", name: "Arc Blink", type: "electric", power: 18, accuracy: 100, crit: 10, priority: 3, effect: "spark", anim: ["spark", "beam"], range: 170, about: "Ride a lightning arc to their side.", tactic: "blink", react: "move", fail: 18 },
  { id: "spiritmend", name: "Spirit Mend", type: "spirit", power: 36, accuracy: 100, crit: 0, priority: 2, effect: "mend", anim: ["orbit", "shield"], range: 40, about: "Knit the witch's wounds from the veil.", tactic: "heal", target: "player" },
  { id: "lanternguard", name: "Lantern Guard", type: "light", power: 0, accuracy: 100, crit: 0, priority: 3, effect: "shell", anim: ["shield", "prism"], range: 40, about: "A lantern ward around the witch.", tactic: "ward", target: "player" },
  { id: "keenwhisper", name: "Keen Whisper", type: "spirit", power: 0, accuracy: 100, crit: 0, priority: 2, effect: "expose", anim: ["orbit", "spark"], range: 40, about: "Sharpen the witch's next cuts.", tactic: "surge", target: "player" },
  { id: "ghoststep", name: "Ghost Step", type: "air", power: 0, accuracy: 100, crit: 0, priority: 3, effect: "none", anim: ["orbit", "spiral"], range: 40, about: "The witch moves like a haunt for a few seconds.", tactic: "surge", target: "player" },
  { id: "unhex", name: "Unhex", type: "light", power: 0, accuracy: 100, crit: 0, priority: 3, effect: "cleanse", anim: ["prism", "shield"], range: 40, about: "Pull a hex off the witch.", tactic: "heal", target: "player" },
  { id: "emberheart", name: "Ember Heart", type: "fire", power: 18, accuracy: 100, crit: 0, priority: 2, effect: "mend", anim: ["spark", "shield"], range: 40, about: "A warm coal of mending for the witch.", tactic: "heal", target: "player" },
  { id: "brinebless", name: "Brine Blessing", type: "water", power: 22, accuracy: 100, crit: 0, priority: 2, effect: "mend", anim: ["rain", "shield"], range: 40, about: "Salt water that closes a cut.", tactic: "heal", target: "player" },
  { id: "rootward", name: "Root Ward", type: "earth", power: 0, accuracy: 100, crit: 0, priority: 2, effect: "shell", anim: ["spiral", "shield"], range: 40, about: "Roots stand between the witch and the blow.", tactic: "ward", target: "player" },
  { id: "frostmail", name: "Frost Mail", type: "ice", power: 0, accuracy: 100, crit: 0, priority: 3, effect: "shell", anim: ["prism", "shield"], range: 40, about: "A coat of rime on the witch.", tactic: "ward", target: "player" },
  { id: "voidshelter", name: "Void Shelter", type: "void", power: 0, accuracy: 100, crit: 0, priority: 2, effect: "shell", anim: ["orbit", "shield"], range: 40, about: "The dark leans over the witch.", tactic: "ward", target: "player" },
  { id: "sparkhaste", name: "Spark Haste", type: "electric", power: 0, accuracy: 100, crit: 0, priority: 3, effect: "none", anim: ["spark", "spiral"], range: 40, about: "Lightning in the witch's heels.", tactic: "surge", target: "player" },
  { id: "ghoulgift", name: "Ghoul Gift", type: "ghoul", power: 16, accuracy: 100, crit: 0, priority: 1, effect: "mend", anim: ["orbit", "slash"], range: 40, about: "A sip of stolen life, offered back.", tactic: "heal", target: "player" },
  // The Starfall batch: verses with animations of their own, and area, chain and boomerang hits.
  { id: "starfall", name: "Starfall", type: "fire", power: 64, accuracy: 84, crit: 10, priority: 0, effect: "burn", anim: ["burst", "spark"], range: 160, about: "Pull a burning star down on them. Everything close burns too.", tactic: "channel", fx: "meteor", splash: { radius: 70, mult: 0.5 }, cdMult: 1.2 },
  { id: "chainbolt", name: "Chain Bolt", type: "electric", power: 38, accuracy: 95, crit: 10, priority: 2, effect: "spark", anim: ["spark", "beam"], range: 150, about: "A bolt that leaps to three more foes, weaker each jump.", tactic: "strike", form: "spell", fx: "chain", chain: { jumps: 3, range: 150, mult: 0.65 }, cdMult: 1.1 },
  { id: "galevortex", name: "Gale Vortex", type: "air", power: 40, accuracy: 92, crit: 8, priority: 1, effect: "root", anim: ["spiral", "orbit"], range: 140, about: "A whirlwind that pins everything near the target.", tactic: "strike", form: "spell", fx: "vortex", splash: { radius: 60, mult: 0.45 }, cdMult: 1.15 },
  { id: "sunpillar", name: "Sun Pillar", type: "light", power: 60, accuracy: 90, crit: 12, priority: 0, effect: "expose", anim: ["beam", "prism"], range: 160, about: "A column of noon bursts from the ground under them.", tactic: "channel", fx: "pillar", splash: { radius: 44, mult: 0.5 } },
  { id: "frostobelisk", name: "Frost Obelisk", type: "ice", power: 68, accuracy: 82, crit: 12, priority: 0, effect: "root", anim: ["prism", "burst"], range: 120, about: "An obelisk of ice spears up and freezes their feet.", tactic: "heavy", fx: "pillar", splash: { radius: 40, mult: 0.45 } },
  { id: "gravenova", name: "Grave Nova", type: "spirit", power: 34, accuracy: 100, crit: 6, priority: 2, effect: "gloom", anim: ["pulse", "orbit"], range: 90, about: "A ring of grave-chill rolls out and hits every foe around you.", tactic: "strike", form: "spell", fx: "nova", nova: 90, reach: 90, cdMult: 1.25 },
  { id: "embernova", name: "Ember Ring", type: "fire", power: 30, accuracy: 100, crit: 8, priority: 2, effect: "burn", anim: ["pulse", "spark"], range: 80, about: "You flare. Every foe close to you catches.", tactic: "strike", form: "spell", fx: "nova", nova: 80, reach: 80, cdMult: 1.25 },
  { id: "moonrang", name: "Moon Boomerang", type: "air", power: 32, accuracy: 94, crit: 16, priority: 2, effect: "none", anim: ["spiral", "slash"], range: 180, about: "A crescent that cuts on the way out and again on the way back.", tactic: "strike", form: "ranged", fx: "boomerang", echo: 0.6 },
  { id: "bonerang", name: "Bone Boomerang", type: "normal", power: 30, accuracy: 96, crit: 12, priority: 2, effect: "spark", anim: ["spiral", "burst"], range: 170, about: "A thrown rib that rattles back to your hand.", tactic: "strike", form: "ranged", fx: "boomerang", echo: 0.5 },
  { id: "hailbarrage", name: "Hail Barrage", type: "ice", power: 40, accuracy: 90, crit: 8, priority: 1, effect: "sleep", anim: ["rain", "prism"], range: 160, about: "Hail pours onto them and everything beside them.", tactic: "strike", form: "ranged", fx: "barrage", splash: { radius: 56, mult: 0.4 } },
  { id: "riftfissure", name: "Rift Fissure", type: "earth", power: 62, accuracy: 86, crit: 8, priority: 0, effect: "root", anim: ["pulse", "burst"], range: 130, about: "Split the ground to them. Spikes come up along the crack.", tactic: "heavy", fx: "fissure", splash: { radius: 44, mult: 0.5 } },
  { id: "hexsigil", name: "Hex Sigil", type: "void", power: 56, accuracy: 88, crit: 14, priority: 0, effect: "silence", anim: ["orbit", "pulse"], range: 160, about: "A circle of runes draws itself under them, then goes off.", tactic: "channel", fx: "sigil", splash: { radius: 64, mult: 0.5 } },
  { id: "phantomhands", name: "Phantom Hands", type: "spirit", power: 44, accuracy: 94, crit: 10, priority: 1, effect: "leech", anim: ["orbit", "slash"], range: 140, about: "The dead reach up through the floor and take a sip.", tactic: "strike", form: "spell", fx: "spectral" },
  { id: "gravegrasp", name: "Grave Grasp", type: "ghoul", power: 46, accuracy: 92, crit: 12, priority: 1, effect: "root", anim: ["slash", "orbit"], range: 140, about: "Cold hands close on their ankles and hold.", tactic: "strike", form: "spell", fx: "spectral" },
  { id: "undertow", name: "Undertow", type: "water", power: 46, accuracy: 92, crit: 8, priority: 1, effect: "soak", anim: ["rain", "spiral"], range: 160, about: "A wave rolls out and drags at everyone it reaches.", tactic: "strike", form: "spell", fx: "wave", splash: { radius: 50, mult: 0.5 } },
  { id: "thornbloom", name: "Thorn Bloom", type: "earth", power: 40, accuracy: 94, crit: 8, priority: 1, effect: "root", anim: ["spiral", "burst"], range: 150, about: "A thorn flower opens under them and grabs the ring.", tactic: "strike", form: "spell", fx: "bloom", splash: { radius: 50, mult: 0.4 } },
  { id: "prismbloom", name: "Prism Bloom", type: "light", power: 38, accuracy: 98, crit: 16, priority: 2, effect: "expose", anim: ["prism", "burst"], range: 150, about: "Shards of light unfold like petals and open their guard.", tactic: "strike", form: "spell", fx: "bloom" },
  // The Reaver batch: 30 melee verses. Melee ignores all armor and defenses, so these cut through anything.
  { id: "boneclub", name: "Bone Club", type: "normal", power: 36, accuracy: 96, crit: 8, priority: 2, effect: "none", anim: ["slash", "burst"], range: 44, about: "A thigh bone swung like it is owed money.", tactic: "strike", form: "melee", reach: 44 },
  { id: "coffinnail", name: "Coffin Nail", type: "normal", power: 28, accuracy: 100, crit: 22, priority: 3, effect: "none", anim: ["slash"], range: 36, about: "One quick jab with a rusted nail. Fast and mean.", tactic: "strike", form: "melee", reach: 36, cdMult: 0.8 },
  { id: "gravedigger", name: "Gravedigger's Swing", type: "normal", power: 68, accuracy: 82, crit: 8, priority: 0, effect: "expose", anim: ["slash", "burst", "pulse"], range: 60, about: "A spade through the guard. The windup is honest.", tactic: "heavy", form: "melee", reach: 60 },
  { id: "ribrush", name: "Rib Rush", type: "normal", power: 34, accuracy: 90, crit: 14, priority: 2, effect: "none", anim: ["slash", "burst"], range: 130, about: "Shoulder in with the ribcage and nick them on the way.", tactic: "lunge", form: "melee", react: "move", fail: 20 },
  { id: "embercleave", name: "Ember Cleave", type: "fire", power: 48, accuracy: 90, crit: 14, priority: 1, effect: "burn", anim: ["slash", "spark", "burst"], range: 56, about: "A burning arc that licks the foes beside the target.", tactic: "strike", form: "melee", reach: 56, splash: { radius: 44, mult: 0.5 } },
  { id: "ashmaul", name: "Ash Maul", type: "fire", power: 74, accuracy: 80, crit: 10, priority: 0, effect: "burn", anim: ["burst", "spark", "pulse"], range: 64, about: "A hammer packed with embers. It lands like a verdict.", tactic: "heavy", form: "melee", reach: 64 },
  { id: "coalrush", name: "Coal Rush", type: "fire", power: 36, accuracy: 90, crit: 12, priority: 1, effect: "burn", anim: ["slash", "spark"], range: 140, about: "Charge through the coals and leave a scorch.", tactic: "lunge", form: "melee", react: "move", fail: 22 },
  { id: "tidebreaker", name: "Tidebreaker", type: "water", power: 66, accuracy: 84, crit: 10, priority: 0, effect: "soak", anim: ["burst", "rain", "pulse"], range: 64, about: "A club of wave-worn timber. The splash soaks the ring.", tactic: "heavy", form: "melee", reach: 64, splash: { radius: 48, mult: 0.45 } },
  { id: "saltgash", name: "Salt Gash", type: "water", power: 42, accuracy: 94, crit: 18, priority: 1, effect: "soak", anim: ["slash", "rain"], range: 52, about: "A salted cut that never quite closes.", tactic: "strike", form: "melee", reach: 52 },
  { id: "barrowmaul", name: "Barrow Maul", type: "earth", power: 78, accuracy: 78, crit: 8, priority: 0, effect: "root", anim: ["burst", "pulse"], range: 60, about: "A stone mallet that pins them to the barrow.", tactic: "heavy", form: "melee", reach: 60 },
  { id: "rootcleave", name: "Root Cleave", type: "earth", power: 44, accuracy: 92, crit: 10, priority: 1, effect: "root", anim: ["slash", "spiral"], range: 56, about: "A cleaver of black root. It binds as it cuts.", tactic: "strike", form: "melee", reach: 56 },
  { id: "stonefist", name: "Stone Knuckle", type: "earth", power: 40, accuracy: 96, crit: 12, priority: 2, effect: "expose", anim: ["burst", "slash"], range: 40, about: "A fist wrapped in grave stone. It cracks the guard.", tactic: "strike", form: "melee", reach: 40 },
  { id: "reedslash", name: "Reed Slash", type: "air", power: 34, accuracy: 98, crit: 20, priority: 3, effect: "none", anim: ["slash", "spiral"], range: 60, about: "A whip-fast cut. Always first.", tactic: "strike", form: "melee", reach: 60 },
  { id: "windscythe", name: "Wind Scythe", type: "air", power: 44, accuracy: 92, crit: 16, priority: 1, effect: "none", anim: ["slash", "spiral", "slash"], range: 72, about: "A wide reaping arc that catches the neighbours.", tactic: "strike", form: "melee", reach: 72, splash: { radius: 50, mult: 0.4 } },
  { id: "gullrush", name: "Gull Rush", type: "air", power: 30, accuracy: 94, crit: 14, priority: 2, effect: "none", anim: ["spiral", "slash"], range: 130, about: "Dive in on a screech, clip them, wheel out.", tactic: "lunge", form: "melee", react: "move", fail: 18 },
  { id: "sparkjab", name: "Spark Jab", type: "electric", power: 32, accuracy: 98, crit: 14, priority: 3, effect: "spark", anim: ["spark", "slash"], range: 40, about: "A knuckle full of static.", tactic: "strike", form: "melee", reach: 40 },
  { id: "archook", name: "Arc Hook", type: "electric", power: 46, accuracy: 90, crit: 12, priority: 1, effect: "spark", anim: ["spark", "slash", "beam"], range: 56, about: "A hooked blade that arcs to two more foes.", tactic: "strike", form: "melee", reach: 56, chain: { jumps: 2, range: 90, mult: 0.6 } },
  { id: "rimeedge", name: "Rime Edge", type: "ice", power: 40, accuracy: 96, crit: 20, priority: 2, effect: "expose", anim: ["slash", "prism"], range: 60, about: "A frosted edge that opens the guard.", tactic: "strike", form: "melee", reach: 60 },
  { id: "iciclethrust", name: "Icicle Thrust", type: "ice", power: 36, accuracy: 96, crit: 24, priority: 2, effect: "sleep", anim: ["slash", "prism"], range: 72, about: "A long thin stab. Cold enough to dream.", tactic: "strike", form: "melee", reach: 72 },
  { id: "hollowcut", name: "Hollow Cut", type: "void", power: 42, accuracy: 94, crit: 18, priority: 1, effect: "gloom", anim: ["slash", "orbit"], range: 52, about: "A cut that leaves a quiet hole.", tactic: "strike", form: "melee", reach: 52 },
  { id: "nullcleave", name: "Null Cleave", type: "void", power: 74, accuracy: 80, crit: 12, priority: 0, effect: "silence", anim: ["orbit", "slash", "burst"], range: 64, about: "A black cleaver that steals the next word from everyone near.", tactic: "heavy", form: "melee", reach: 64, splash: { radius: 40, mult: 0.4 } },
  { id: "umbralunge", name: "Umbra Lunge", type: "void", power: 38, accuracy: 90, crit: 14, priority: 1, effect: "gloom", anim: ["orbit", "slash"], range: 140, about: "Slip across the gap in shadow and cut.", tactic: "lunge", form: "melee", react: "move", fail: 22 },
  { id: "dawnblade", name: "Dawnblade", type: "light", power: 46, accuracy: 94, crit: 14, priority: 2, effect: "expose", anim: ["slash", "prism", "burst"], range: 64, about: "A blade of first light.", tactic: "strike", form: "melee", reach: 64 },
  { id: "censerswing", name: "Censer Swing", type: "light", power: 34, accuracy: 96, crit: 10, priority: 1, effect: "expose", anim: ["pulse", "prism"], range: 64, about: "Swing the chapel censer. Every foe in reach is blessed and blinded.", tactic: "strike", form: "melee", reach: 64, nova: 64, cdMult: 1.25 },
  { id: "smitingrod", name: "Smiting Rod", type: "light", power: 70, accuracy: 84, crit: 12, priority: 0, effect: "expose", anim: ["prism", "burst", "slash"], range: 60, about: "A sentence carried out with a rod.", tactic: "heavy", form: "melee", reach: 60 },
  { id: "wraithclaw", name: "Wraith Claw", type: "spirit", power: 44, accuracy: 94, crit: 16, priority: 2, effect: "gloom", anim: ["slash", "orbit"], range: 52, about: "Cold fingers that arrive before the hand.", tactic: "strike", form: "melee", reach: 52 },
  { id: "veilrend", name: "Veil Rend", type: "spirit", power: 52, accuracy: 88, crit: 22, priority: 1, effect: "gloom", anim: ["slash", "orbit", "burst"], range: 56, about: "Tears the veil, and whoever stands behind it.", tactic: "strike", form: "melee", reach: 56 },
  { id: "ghoulmaw", name: "Ghoul Maw", type: "ghoul", power: 48, accuracy: 90, crit: 16, priority: 1, effect: "leech", anim: ["slash", "orbit"], range: 44, about: "Teeth first, manners never.", tactic: "strike", form: "melee", reach: 44 },
  { id: "carrionrend", name: "Carrion Rend", type: "ghoul", power: 40, accuracy: 94, crit: 20, priority: 2, effect: "leech", anim: ["slash", "burst"], range: 48, about: "Claws that remember the last meal.", tactic: "strike", form: "melee", reach: 48 },
  { id: "doublerake", name: "Double Rake", type: "ghoul", power: 36, accuracy: 98, crit: 12, priority: 2, effect: "leech", anim: ["slash", "slash", "orbit"], range: 44, about: "Two drags of the claws. The second follows a heartbeat later.", tactic: "strike", form: "melee", reach: 44, echo: 0.5 },

  // ── Treatment Update: Movement-Melee Verses ───────────────────────────────
  // These attacks are built around movement. You go TO the hits, not the other
  // way around. Three classes: Tri-Lunge (shoot into 3 separate targets),
  // Orbit Strike (circle an enemy for a crit), Slam-Dash (charge + heavy).
  // ─────────────────────────────────────────────────────────────────────────

  // Tri-Lunge class — fires you into 3 different enemies, one hit per target.
  // Uses chain with jumps:2 (hits the primary + 2 more), lunge tactic carries
  // the movement feel. High priority, moderate power per hit.
  { id: "triblitz", name: "Tri Blitz", type: "normal", power: 34, accuracy: 96, crit: 14, priority: 2, effect: "none", anim: ["slash", "burst", "slash"], range: 130, about: "Shoot into three enemies in a row — one hit apiece, no stopping.", tactic: "lunge", form: "melee", react: "move", fail: 20, chain: { jumps: 2, range: 120, mult: 1.0 } },
  { id: "voidprowl", name: "Void Prowl", type: "void", power: 30, accuracy: 94, crit: 20, priority: 2, effect: "gloom", anim: ["orbit", "slash", "orbit"], range: 150, about: "Blink between three foes and leave dread in each one. Full damage each time.", tactic: "blink", form: "melee", react: "move", fail: 22, chain: { jumps: 2, range: 130, mult: 1.0 } },
  { id: "bloodbound", name: "Blood Bound", type: "ghoul", power: 28, accuracy: 96, crit: 12, priority: 2, effect: "leech", anim: ["slash", "orbit", "slash"], range: 140, about: "The hunger carries you through three targets. Each sip is its own drink.", tactic: "lunge", form: "melee", react: "move", fail: 24, chain: { jumps: 2, range: 120, mult: 1.0 } },

  // Orbit Strike class — circle an enemy for a chance at a guaranteed crit.
  // Mechanically: very high crit stat, aura-ish risk/reward. Uses vortex fx
  // to show the circling motion. Slow priority (you're committing to the circle).
  { id: "orbitstrike", name: "Orbit Strike", type: "air", power: 54, accuracy: 90, crit: 40, priority: 0, effect: "expose", anim: ["spiral", "slash", "burst"], range: 72, about: "Circle the enemy in a tight arc. Land the full loop undamaged and the finishing cut always crits.", tactic: "strike", form: "melee", reach: 72, fx: "vortex" },
  { id: "gravecircle", name: "Grave Circle", type: "spirit", power: 50, accuracy: 88, crit: 38, priority: 0, effect: "gloom", anim: ["orbit", "spiral", "slash"], range: 68, about: "Walk a slow ring around them. An unbroken orbit seals the curse and crits.", tactic: "strike", form: "melee", reach: 68, fx: "vortex" },
  { id: "emberspin", name: "Ember Spin", type: "fire", power: 52, accuracy: 88, crit: 36, priority: 0, effect: "burn", anim: ["spark", "spiral", "slash"], range: 64, about: "Spin a burning path around the target. Complete the ring and ignite — guaranteed.", tactic: "strike", form: "melee", reach: 64, fx: "vortex" },

  // Slam-Dash class — charge at a target and deliver a heavy blow on arrival.
  // Feels like a committed dash that ends in an explosion of force. Lunge tactic
  // with heavy-tier damage on landing.
  { id: "crashdown", name: "Crash Down", type: "earth", power: 72, accuracy: 82, crit: 10, priority: 1, effect: "root", anim: ["burst", "slash", "pulse"], range: 160, about: "Sprint at them and land like a stone dropped from height. The ground cracks.", tactic: "lunge", form: "melee", react: "move", fail: 18 },
  { id: "stormcleave", name: "Storm Cleave", type: "electric", power: 66, accuracy: 84, crit: 14, priority: 1, effect: "spark", anim: ["spark", "slash", "burst"], range: 165, about: "Close the gap in a bolt and cleave on arrival. The charge sparks everything near the landing.", tactic: "lunge", form: "melee", react: "move", fail: 20, splash: { radius: 44, mult: 0.4 } },
  { id: "tidecrasher", name: "Tide Crasher", type: "water", power: 68, accuracy: 82, crit: 10, priority: 1, effect: "soak", anim: ["rain", "slash", "burst"], range: 155, about: "Ride a wave of water at the target and break over them like a shore.", tactic: "lunge", form: "melee", react: "move", fail: 20, splash: { radius: 48, mult: 0.45 } },
  ...KIT_MOVES as Move[],
];
/** The Reaver batch: 30 melee verses (strikes, heavies and lunges across every element). */
export const REAVER_BATCH: string[] = ["boneclub", "coffinnail", "gravedigger", "ribrush", "embercleave", "ashmaul", "coalrush", "tidebreaker", "saltgash", "barrowmaul", "rootcleave", "stonefist", "reedslash", "windscythe", "gullrush", "sparkjab", "archook", "rimeedge", "iciclethrust", "hollowcut", "nullcleave", "umbralunge", "dawnblade", "censerswing", "smitingrod", "wraithclaw", "veilrend", "ghoulmaw", "carrionrend", "doublerake"];
/** The Treatment batch: 9 movement-melee verses. Tri-Lunges, Orbit Strikes, and Slam-Dashes. */
export const TREATMENT_BATCH: string[] = ["triblitz", "voidprowl", "bloodbound", "orbitstrike", "gravecircle", "emberspin", "crashdown", "stormcleave", "tidecrasher"];
/** The Starfall batch: verses with animations of their own. */
export const STARFALL_BATCH = MOVES.filter((m) => !!m.fx).map((m) => m.id);

/**
 * Aura verses. Learned in the Library like any verse; slot one and cast it to raise it (cast again to drop
 * it). While up it reserves part of your maximum health. Kept out of MOVES so foes, ghosts and rivals
 * never roll them.
 */
const aura = (id: string, name: string, type: TypeId, about: string, a: AuraDef): Move => ({ id, name, type, power: 0, accuracy: 100, crit: 0, priority: 0, effect: "none", anim: ["shield", "orbit"], range: 0, about, tactic: "aura", form: "spell", aura: a });
export const AURAS: Move[] = [
  aura("aegisaura", "Aegis Aura", "light", "A standing shield of light. Less damage taken and a chance to shrug off whole hits.", { reserve: 0.16, chan: { ward: 22, echo_guard: 5 }, label: "Shield", role: "defense" }),
  aura("thornaura", "Bramble Aura", "earth", "Thorns grow from your shadow and bite back.", { reserve: 0.14, chan: { thorns: 9, plating: 60 }, label: "Thorns", role: "defense" }),
  aura("bloomaura", "Lifebloom", "water", "A slow tide of healing that never stops.", { reserve: 0.12, mod: { regen: 60 }, chan: { regen: 10 }, label: "Regeneration", role: "defense" }),
  aura("furyaura", "War Fury", "fire", "Every blow lands heavier while the fury burns.", { reserve: 0.18, chan: { might: 16 }, label: "Damage", role: "combat" }),
  aura("edgeaura", "Keen Aura", "void", "The world slows just enough to find the gap.", { reserve: 0.14, chan: { crit_edge: 9, crit_force: 10 }, label: "Crits", role: "combat" }),
  aura("farsight", "Far Sight", "air", "The wind carries your ranged verses and spells further.", { reserve: 0.12, chan: { reach: 28 }, label: "Range", role: "combat" }),
  aura("tempoaura", "Tempo Aura", "electric", "A humming rhythm that hurries every verse.", { reserve: 0.15, chan: { swift: 10, focus: 6 }, label: "Cooldowns", role: "combat" }),
  aura("spiritlure", "Spirit Lure", "spirit", "A lantern for the lost. Fallen foes linger as ghosts far more often.", { reserve: 0.12, chan: { catch_boost: 60, spirit_bond: 10 }, label: "Ghost rate", role: "spirits" }),
  aura("harvestaura", "Harvest Song", "earth", "Roots and seams answer your hum. Gather faster and bring home more.", { reserve: 0.1, chan: { harvest: 30, quick_hands: 25, shroom_sense: 10 }, label: "Gathering", role: "farming" }),
  aura("tideaura", "Angler's Calm", "water", "Still water, quick bites.", { reserve: 0.08, chan: { fish_luck: 35 }, label: "Fishing", role: "farming" }),
  aura("galeaura", "Tailwind", "air", "The road runs downhill wherever you walk.", { reserve: 0.1, chan: { swift_step: 12, wayfarer: 15 }, label: "Speed", role: "travel" }),
  aura("goldaura", "Gilded Aura", "normal", "Coins and treasure drift your way.", { reserve: 0.1, chan: { kyo_find: 30, loot_find: 18, sell_boost: 12 }, label: "Fortune", role: "fortune" }),
  aura("sageaura", "Sage's Aura", "light", "Every fight teaches a little more.", { reserve: 0.1, chan: { xp_boost: 22 }, label: "Experience", role: "fortune" }),
  aura("wellspringaura", "Wellspring Aura", "water", "The mana well runs deeper, and it refills faster.", { reserve: 0.12, chan: { mana_well: 22, mana_flow: 16 }, label: "Mana", role: "combat" }),
  aura("ironlung", "Iron Lung", "earth", "A deeper stamina well, and breath that comes back faster.", { reserve: 0.12, chan: { stam_well: 22, stam_flow: 16 }, label: "Stamina", role: "combat" }),
  aura("trinityaura", "Trinity", "light", "Health, mana and stamina are one body, and this makes the body larger.", { reserve: 0.14, chan: { body_tide: 16, vitality: 36 }, label: "Body", role: "defense" }),
];
export const AURA_IDS = new Set(AURAS.map((m) => m.id));
export const MOVE_BY_ID: Record<string, Move> = Object.fromEntries([...MOVES, ...AURAS].map((m) => [m.id, m]));

/**
 * Signature verses get a shape of their own: exact reach and a cooldown multiplier. Everything else gets
 * a reach and cooldown worked out from its form, style and power, with a stable per-verse twist (see
 * attackRange and moveCdFactor), so no two verses feel quite the same.
 */
const SIGNATURE_SHAPE: Record<string, { reach?: number; cd?: number }> = {
  piercingvolley: { reach: 330, cd: 1.5 }, arcbolt: { reach: 210, cd: 0.6 }, storm: { reach: 240, cd: 1.3 }, jolt: { reach: 170, cd: 0.7 },
  shieldbash: { reach: 40, cd: 0.9 }, hundredpalm: { reach: 36, cd: 0.45 }, rampage: { reach: 60, cd: 1.25 }, cutlass: { reach: 48, cd: 0.55 },
  iaido: { reach: 210, cd: 1.3 }, glaciercharge: { reach: 190 }, moonhop: { reach: 250, cd: 1.1 }, wingburst: { reach: 220 }, shadowstrike: { reach: 200, cd: 1.2 },
  inferno: { reach: 150, cd: 1.1 }, tectonic: { reach: 120, cd: 1.2 }, maelstrom: { reach: 190 }, sunburst: { reach: 270, cd: 1.2 }, abyssrift: { reach: 230 },
  cyclone: { reach: 180, cd: 0.8 }, whirlingveil: { reach: 90, cd: 0.8 }, crimsondrain: { reach: 170 }, bloodpact: { reach: 190 }, ballad: { reach: 220, cd: 0.9 },
  royaldecree: { reach: 290, cd: 1.35 }, judgment: { reach: 64, cd: 1.15 }, cointoss: { reach: 160, cd: 0.7 }, soulreap: { reach: 60 }, gust: { reach: 260, cd: 0.8 },
  moonhook: { reach: 280 }, ember: { reach: 200, cd: 0.8 }, wail: { reach: 240, cd: 0.7 }, quake: { reach: 130, cd: 1.15 }, flash: { reach: 230 }, hex: { reach: 210 },
};
for (const m of MOVES) {
  const shape = SIGNATURE_SHAPE[m.id];
  if (!shape) continue;
  if (shape.reach !== undefined) m.reach = shape.reach;
  if (shape.cd !== undefined) m.cdMult = shape.cd;
}

/** A stable 0–1 number per verse, so its worked-out reach and cooldown never change between sessions. */
export function moveHash(id: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Cooldown shape: long reach costs time, short reach is quick, and every verse gets its own ±20% twist.
 * Multiplied into the engine's base cooldown.
 */
export function moveCdFactor(m: Move): number {
  if (moveTactic(m) === "aura") return 1;
  const r = attackRange(m);
  const reachCost = r <= 60 ? 0.85 : Math.min(1.45, 0.82 + (r - 60) / 420);
  const twist = 0.8 + moveHash(m.id, 7) * 0.4;
  return reachCost * twist * (m.cdMult ?? 1);
}

/** Verses a spirit spends on the witch: heals, wards, haste, and marked aid spells. */
export function spiritAidsPlayer(m: Move): boolean {
  if (m.target === "foe") return false;
  if (m.target === "player") return true;
  const tactic = moveTactic(m);
  return m.effect === "mend" || m.effect === "shell" || m.effect === "cleanse" || tactic === "heal" || tactic === "ward" || tactic === "surge";
}

/** Up to 10 known verses from the spirit's type. Three of them start readied. */
export function rollSpiritKit(type: TypeId, rng: Rng, prefer?: string): { known: string[]; slots: string[] } {
  const attacks = MOVES.filter((m) => !spiritAidsPlayer(m) && (m.type === type || m.type === "spirit"));
  const aid = MOVES.filter((m) => spiritAidsPlayer(m) && (m.target === "player" || m.type === type || m.type === "spirit"));
  const known: string[] = [];
  const add = (id?: string) => {
    if (!id || !MOVE_BY_ID[id] || known.includes(id) || known.length >= 10) return;
    known.push(id);
  };
  if (prefer && MOVE_BY_ID[prefer] && !spiritAidsPlayer(MOVE_BY_ID[prefer]!)) add(prefer);
  if (aid.length) add(pick(rng, aid).id);
  if (aid.length > 1 && rng() < 0.5) add(pick(rng, aid).id);
  const pool = attacks.length ? attacks : MOVES.filter((m) => !spiritAidsPlayer(m));
  const want = Math.min(10, 4 + irand(rng, 7));
  let guard = 0;
  while (known.length < want && pool.length && guard++ < 48) add(pick(rng, pool).id);
  const slots: string[] = [];
  const firstAid = known.find((id) => spiritAidsPlayer(MOVE_BY_ID[id]!));
  if (firstAid) slots.push(firstAid);
  for (const id of known) {
    if (slots.length >= 3) break;
    if (!spiritAidsPlayer(MOVE_BY_ID[id]!) && !slots.includes(id)) slots.push(id);
  }
  for (const id of known) {
    if (slots.length >= 3) break;
    if (!slots.includes(id)) slots.push(id);
  }
  return { known, slots };
}

const MELEE_IDS = new Set(["cinder", "grin", "thorn", "bite", "rattle", "measured", "brine"]);
const SPELL_IDS = new Set(["dirge", "storm", "howl", "quake", "whiteout", "flash", "hex", "shroud", "dawn", "creep", "marrow", "vine", "ember", "tide"]);

/** Movement-melee verses. A rush runs through several foes. An orbit circles one. A slam charges in. */
const RUSH_IDS = new Set(["triblitz", "voidprowl", "bloodbound"]);
const ORBIT_IDS = new Set(["orbitstrike", "gravecircle", "emberspin"]);
const SLAM_IDS = new Set(["crashdown", "stormcleave", "tidecrasher"]);

export type MovementKind = "rush" | "orbit" | "slam";

export function movementKind(m: Move): MovementKind | null {
  if (RUSH_IDS.has(m.id)) return "rush";
  if (ORBIT_IDS.has(m.id)) return "orbit";
  if (SLAM_IDS.has(m.id)) return "slam";
  return null;
}

/** How far a rush or slam can start from. Standing melee stays inside two tiles. */
export function movementReach(m: Move): number | null {
  if (RUSH_IDS.has(m.id)) return m.chain?.range ?? m.range;
  if (SLAM_IDS.has(m.id)) return m.range;
  return null;
}

export function attackForm(m: Move): AttackForm {
  if (m.form) return m.form;
  const tactic = moveTactic(m);
  if (tactic === "dash" || tactic === "surge") return "melee";
  if (tactic === "channel" || tactic === "heal" || tactic === "ward" || tactic === "aura") return "spell";
  if (tactic === "blink" || tactic === "lunge" || tactic === "heavy" || tactic === "roll") return "melee";
  if (m.effect === "mend" || m.effect === "shell") return "spell";
  if (MELEE_IDS.has(m.id)) return "melee";
  if (SPELL_IDS.has(m.id)) return "spell";
  return "ranged";
}

/**
 * Melee is close quarters: a melee verse only works when the foe is within 2 tiles (64 px) or less, and range
 * bonuses never stretch it (blinks and lunges included — they can no longer start from across the screen).
 * Ranged verses and spells live strictly beyond that band: they never reach less than RANGED_MIN_REACH.
 */
export const MELEE_MIN_REACH = 32;
export const MELEE_MAX_REACH = 64;
export const RANGED_MIN_REACH = 96;
const meleeClamp = (r: number) => Math.max(MELEE_MIN_REACH, Math.min(MELEE_MAX_REACH, Math.round(r)));

/** Verses that are cast on yourself or toggled, not thrown at a foe, so neither band applies to them. */
function selfTactic(tactic: ReturnType<typeof moveTactic>): boolean {
  return tactic === "aura" || tactic === "heal" || tactic === "ward" || tactic === "roll" || tactic === "dash" || tactic === "surge";
}

/** True when the verse is a melee verse, which only works within 2 tiles of the foe. */
export function isMeleeVerse(m: Move): boolean {
  return !selfTactic(moveTactic(m)) && attackForm(m) === "melee";
}

/**
 * How far a verse reaches, in pixels. Melee runs from a dagger's 36 to a spear's 64 (2 tiles, the hard cap, blinks
 * and lunges included); ranged verses come in volleys (short), quick shots (mid) and long shots (far); spells
 * range from close storms to 290px snipes. Ranged verses and spells never reach less than 96 px, so they stay
 * clearly apart from melee. Signature verses carry an exact reach, still held inside their form's band.
 */
export function attackRange(m: Move): number {
  const tactic = moveTactic(m);
  if (tactic === "aura") return 0;
  const travel = movementReach(m);
  if (travel) return travel;
  const base = baseRange(m, tactic);
  if (attackForm(m) === "melee") return meleeClamp(base);
  // Ranged and spell attacks sit beyond melee. Self-cast verses (heal, ward, roll, dash, surge) keep their own reach.
  if (selfTactic(tactic)) return base;
  // A nova's reach is its ring, so it keeps that exact size (rings are all wider than melee's 64 px).
  const floor = m.nova ? Math.min(RANGED_MIN_REACH, m.nova) : RANGED_MIN_REACH;
  return Math.max(floor, Math.round(base));
}

function baseRange(m: Move, tactic: ReturnType<typeof moveTactic>): number {
  if (m.reach !== undefined) return m.reach;
  const h = moveHash(m.id, 3);
  if (tactic === "dash" || tactic === "surge") return 40;
  if (tactic === "blink" || tactic === "lunge") return Math.round(120 + h * 130);
  if (tactic === "roll") return Math.max(80, Math.min(140, m.range));
  if (tactic === "ward" || tactic === "heal") return Math.max(40, m.range);
  if (tactic === "channel") return Math.round(110 + h * 100);
  const form = attackForm(m);
  if (form === "melee") return [36, 44, 52, 58, 64][Math.floor(h * 5)]!;
  if (form === "spell") return Math.round(Math.max(140, Math.min(290, 150 + h * 130 + (60 - m.power) * 0.6)));
  const style = rangedStyle(m);
  if (style === "volley") return Math.round(130 + h * 50);
  if (style === "reload") return Math.round(170 + h * 60);
  return Math.round(240 + h * 100);
}

export function rangedStyle(m: Move): "volley" | "reload" | "reach" {
  let n = 0;
  for (const c of m.id) n += c.charCodeAt(0);
  return (["volley", "reload", "reach"] as const)[n % 3]!;
}

export function formTag(m: Move): string {
  if (m.aura) return `aura · ${m.aura.label.toLowerCase()} · ${Math.round(m.aura.reserve * 100)}% health`;
  const form = attackForm(m);
  if (form === "melee") return "melee · within 2 tiles · ignores all armor · clinch, link, finisher";
  if (form === "spell") return "spell · 3+ tiles · pure · weave, chord, overcast";
  const style = rangedStyle(m);
  if (style === "volley") return "ranged · 3+ tiles · volley";
  if (style === "reload") return "ranged · 3+ tiles · fast";
  return "ranged · 3+ tiles · long";
}

export function huntMove(type: TypeId): Move {
  const live = (m: Move) => m.effect !== "mend" && m.effect !== "shell";
  return (
    MOVES.find((m) => m.type === type && attackForm(m) === "spell" && live(m)) ??
    MOVES.find((m) => m.type === type && attackForm(m) === "ranged" && live(m)) ??
    MOVES.find((m) => attackForm(m) === "spell" && live(m)) ??
    MOVES[0]!
  );
}

export const RACES: {
  id: RaceId;
  name: string;
  type: TypeId;
  blurb: string;
  hair: number;
  tall: number;
}[] = [
  { id: "vesper", name: "Vesper", type: "void", blurb: "Pale chapel blood. Long dark hair, a quiet step, void in the teeth.", hair: 0, tall: 1 },
  { id: "cinder", name: "Cinder", type: "fire", blurb: "Ash-court daughters. Short flame-cut hair and a hotter basic strike.", hair: 1, tall: 1 },
  { id: "tide", name: "Tide", type: "water", blurb: "Reach-born. Wave hair, fin-tips at the ear, brine on every lash.", hair: 2, tall: 1 },
  { id: "thorn", name: "Thorn", type: "earth", blurb: "Hollow gardeners. Braided briar, wider stance, roots that answer.", hair: 3, tall: 1 },
  { id: "rime", name: "Rime", type: "ice", blurb: "March glass. Crystal bob, a cold priority, sleeps that stick.", hair: 4, tall: 1 },
];

export type SetDef = { id: string; race: RaceId; name: string; style: number; fx: FxId; bonus: string };

const SET_ROWS: Record<RaceId, [string, FxId, string][]> = {
  vesper: [
    ["Eclipse Sentinel", "voidring", "Null ring eats one hit, then throws a void pulse."],
    ["Widow Psalm", "gravepulse", "Dirge pulse sleeps nearby foes and mends you."],
    ["Lantern Nun", "lanternwake", "Lanterns orbit and hex-chain anything they touch."],
    ["Quiet Crown", "voidring", "A crown of silence lengthens enemy cooldowns."],
    ["Hexweave", "stormcrown", "Hex sparks jump to a second target."],
    ["Sable Choir", "featherfall", "Afterimage step — a echo strike copies your last hit."],
    ["Umbral Veil", "bloodmoon", "Leech aura while the set sings."],
    ["Starless Aegis", "whitestorm", "A black snow that roots and wards."],
    ["Oracle Ash", "solarnova", "Inverted sun: light damage that fears itself."],
    ["Last Vespers", "lanternwake", "On proc, a chapel bell staggers the field."],
    ["Chapel Mourning", "gravepulse", "A mourning bell sleeps the closest foe and mends you."],
    ["Black Hymnal", "voidring", "Sung notes shorten enemy casts."],
    ["Night Abbess", "bloodmoon", "Leech grows while you stand still."],
    ["Grave Lattice", "briarburst", "A lattice of graves roots the ring."],
    ["Violet Reliquary", "lanternwake", "Relics orbit and chain void."],
    ["Hollow Saint", "whitestorm", "A hollow ward that reflects one spell."],
    ["Moon Nun", "featherfall", "Moonstep leaves a striking afterimage."],
    ["Dirge Plate", "stormcrown", "Heavy dirge sparks on every third hit."],
    ["Ink Procession", "voidring", "Ink trails silence what they touch."],
    ["Final Bell", "solarnova", "One chapel sun. It fears itself."],
  ],
  cinder: [
    ["Solaris Paladin", "solarnova", "Solar nova burns and exposes everything close."],
    ["Ashen Vow", "gravepulse", "Vow-flames linger and tick harder on bosses."],
    ["Glass Grin", "bloodmoon", "Crits splatter cinders that chain once."],
    ["Kiln Regalia", "solarnova", "Standing in your own fire heals you."],
    ["Ember Shogun", "stormcrown", "A flaming arc on every third cast."],
    ["Cinder Court", "featherfall", "Dash-embers trail and re-ignite burn."],
    ["Pyre Mantle", "lanternwake", "Lanterns explode if a burned foe dies."],
    ["Scorch Saint", "voidring", "Fire ring that ignores water once per proc."],
    ["Brand Crown", "bloodmoon", "Branded foes take stab as if they were ice."],
    ["Last Lantern", "lanternwake", "A giant lantern falls on the marked foe."],
    ["Furnace Bride", "solarnova", "The aisle burns. Close foes are exposed."],
    ["Coal Coronet", "gravepulse", "Coal sleep, then a hotter wake."],
    ["Spark Regalia", "stormcrown", "Sparks jump a second target."],
    ["Hearth Tyrant", "bloodmoon", "Standing in your fire leeches."],
    ["Cinder Nun", "lanternwake", "Votive flames mend you in combat."],
    ["Magma Psalm", "briarburst", "Magma roots, then ticks."],
    ["Brand Widow", "voidring", "A brand that ignores water once."],
    ["Kiln Valkyrie", "featherfall", "A flaming gap-closer."],
    ["Ash Parade", "whitestorm", "Ash whiteout silences the pack."],
    ["Last Ember", "solarnova", "The kiln answers. One huge pulse."],
  ],
  tide: [
    ["Tidecaller", "tidalsurge", "A wave knocks foes back and soaks them."],
    ["Brine Reliquary", "tidalsurge", "Soak spreads when you leech."],
    ["Foam Cantor", "featherfall", "You skate — move faster while soaked ground is near."],
    ["Urn Admiral", "whitestorm", "Shell plus a salt burst."],
    ["Pearl Dirge", "gravepulse", "Rising dirge heals allies in the lobby too."],
    ["Kelp Regent", "briarburst", "Tide-briars root soaked targets."],
    ["Abyss Net", "voidring", "Pulls a foe into melee range."],
    ["Moonwell", "lanternwake", "Moonwater cleanses you and flashes light."],
    ["Stormfoam", "stormcrown", "Lightning rides the spray."],
    ["Drowned Choir", "bloodmoon", "Leech wave. The sea keeps a tithe."],
    ["Salt Empress", "tidalsurge", "A salt crown that soaks and knocks back."],
    ["Coral Aegis", "whitestorm", "Coral ward. The next hit is halved."],
    ["Drift Cantor", "featherfall", "You skate farther on soaked ground."],
    ["Pearl March", "lanternwake", "Pearls orbit and flash light."],
    ["Brine Widow", "bloodmoon", "Brine leech spreads soak."],
    ["Harbor Saint", "gravepulse", "A harbor dirge heals the lobby."],
    ["Wave Reliquary", "tidalsurge", "The relic is a wave."],
    ["Foam Knight", "stormcrown", "Lightning rides the spray."],
    ["Deep Choir", "voidring", "The deep pulls a foe into reach."],
    ["Last Tide", "tidalsurge", "The sea itself answers."],
  ],
  thorn: [
    ["Thorn Regalia", "briarburst", "Briars erupt, root, and bleed the circle."],
    ["Coffin Garden", "gravepulse", "Gravesprouts sleep then burst."],
    ["Moss Empress", "briarburst", "A heal-over-time thicket."],
    ["Widow Orchard", "bloodmoon", "Thorns return a cut of damage taken."],
    ["Root Sovereign", "briarburst", "One foe is pinned for a long root."],
    ["Spore Court", "lanternwake", "Spore lanterns sleep in a wide ring."],
    ["Bark Psalm", "whitestorm", "Bark ward. The next hit is halved."],
    ["Hollow Antler", "featherfall", "A leaping gore with earth stab."],
    ["Umber Relic", "gravepulse", "Quake plus expose."],
    ["Briar Nun", "voidring", "Holy thorns — light and earth together."],
    ["Vine Abbess", "briarburst", "Vines erupt and bleed the circle."],
    ["Orchard Plate", "whitestorm", "Bark plate. Half the next blow."],
    ["Mycel Crown", "gravepulse", "Spores sleep, then burst."],
    ["Green Reliquary", "lanternwake", "Spore lanterns in a wide ring."],
    ["Briar Valkyrie", "featherfall", "A leaping gore of thorns."],
    ["Root Nun", "briarburst", "One foe is pinned a long time."],
    ["Spore March", "bloodmoon", "Thorns return a cut of damage."],
    ["Bark Widow", "voidring", "A quiet thicket that silences."],
    ["Garden Psalm", "solarnova", "A green sun. It heals you a little."],
    ["Last Thicket", "briarburst", "The garden answers. Huge root."],
  ],
  rime: [
    ["Frost Coronet", "whitestorm", "Whiteout silences and slows the pack."],
    ["Glass March", "whitestorm", "Shards fan in a prism volley."],
    ["Sleeping Saint", "gravepulse", "A deeper sleep. Waking them hurts."],
    ["Rime Valkyrie", "featherfall", "Ice wings — a gap-closer of frost."],
    ["Pale Reliquary", "lanternwake", "Cold lanterns that spark on impact."],
    ["Marrow Ice", "bloodmoon", "Freeze-leech. Stillness drinks."],
    ["White Psalm", "solarnova", "A pale sun that is still ice."],
    ["Shard Empress", "stormcrown", "Crit shards splinter to neighbors."],
    ["Hush Crown", "voidring", "Silence ring. Moves lock for a breath."],
    ["Last Winter", "whitestorm", "The march itself answers. Huge storm, one pulse."],
    ["Glacier Bride", "whitestorm", "A white aisle that slows the pack."],
    ["Ice Abbess", "gravepulse", "Deeper sleep. Waking them hurts."],
    ["Crystal March", "stormcrown", "Shards fan and splinter."],
    ["Pale Choir", "lanternwake", "Cold lanterns spark on impact."],
    ["Frost Reliquary", "voidring", "A hush ring. Moves lock."],
    ["Snow Valkyrie", "featherfall", "Ice wings close the gap."],
    ["Hush Plate", "whitestorm", "Silence and slow together."],
    ["Winter Nun", "bloodmoon", "Freeze-leech. Stillness drinks."],
    ["Shard Psalm", "solarnova", "A pale sun that is still ice."],
    ["Last Frost", "whitestorm", "The year ends. One killing storm."],
  ],
};

export const SETS: SetDef[] = (Object.keys(SET_ROWS) as RaceId[]).flatMap((race) =>
  SET_ROWS[race].map((row, i) => ({
    id: `${race}-${i}`,
    race,
    name: row[0],
    style: i,
    fx: row[1],
    bonus: row[2],
  })),
);

export const SET_BY_ID: Record<string, SetDef> = Object.fromEntries(SETS.map((s) => [s.id, s]));

export const SLOT_NOUN: Record<Slot, string> = {
  weapon: "Blade",
  head: "Helm",
  chest: "Raiment",
  legs: "Skirt",
  feet: "Boots",
  relic: "Relic",
};

export const WEAPONS = [
  "Grave Needle",
  "Choir Knife",
  "Salt Hook",
  "Briar Bill",
  "Rime Pick",
  "Lantern Rod",
  "Bone Knuckle",
  "Void Spindle",
];

export const WEAPON_KINDS = ["Sling", "Crossbow", "Bow", "Axe", "Staff", "Tome", "Blade", "Claw"] as const;

export type GhostLook = {
  body: number;
  horns: number;
  tails: number;
  eyes: number;
  trail: number;
  skin: number;
  aggression: "hunt" | "drift";
  move: string;
};

export function rollGhostLook(rng: Rng, rarity: number, move: string, bias?: "hunt" | "drift"): GhostLook {
  const huntBias = bias === "hunt" ? 0.72 : bias === "drift" ? 0.18 : 0.42;
  return {
    body: irand(rng, 6),
    horns: irand(rng, 2 + Math.min(3, rarity)),
    tails: 1 + irand(rng, 2 + Math.min(3, rarity)),
    eyes: 1 + irand(rng, 1 + Math.min(4, rarity)),
    trail: irand(rng, 6),
    skin: irand(rng, 5),
    aggression: rng() < huntBias ? "hunt" : "drift",
    move,
  };
}

export const MAX_CHARACTER_LEVEL = 400;
export const MAX_SKILL_LEVEL = 400;
export const MAX_GEAR_LEVEL = 1000;
export const MAX_GEAR_ENCHANTS = 20;

export type EnchantDef = {
  id: string;
  name: string;
  /** Ceiling of one roll on a level-1000 piece. */
  max: number;
  unit: "%" | "flat";
  /** Where the roll prefers to land. Omitted enchants can appear on anything. */
  tag?: "weapon" | "armor" | "relic";
  /** What the enchantment is for: gear rolls a purpose and draws most of its enchantments from it. */
  cat?: EnchantCat;
  gear: (power: number) => string;
  perk?: { step: number; max: number; each: string };
};

export type EnchantCat = "combat" | "defense" | "reach" | "gathering" | "fortune" | "spirits" | "travel";

export const ENCHANTS: EnchantDef[] = [
  { id: "double_strike", name: "Double Strike", max: 18, cat: "combat", unit: "%", tag: "weapon", gear: (n) => `${n}% chance this piece makes the hit land a second time. All Double Strike together cannot rise above 85%.`, perk: { step: 1, max: 12, each: "+1% chance that an attack or spell hits a second time (the total chance cannot rise above 85%)" } },
  { id: "second_chance", name: "Second Chance", max: 1, cat: "defense", unit: "flat", tag: "armor", gear: () => "Once per life, a killing blow leaves you at 1 health instead of dying.", perk: { step: 1, max: 1, each: "one survival at 1 health instead of dying, once per life" } },
  { id: "loot_find", name: "Loot Find", max: 30, cat: "fortune", unit: "%", gear: (n) => `+${(n / 2).toFixed(1)}% gear drop chance (Loot Find ${n} ÷ 200).`, perk: { step: 1, max: 20, each: "+0.5% chance that a fallen foe drops gear (1 Loot Find ÷ 200)" } },
  { id: "xp_boost", name: "XP Boost", max: 30, cat: "fortune", unit: "%", gear: (n) => `+${n}% battle experience.`, perk: { step: 1, max: 20, each: "+1% experience from fights" } },
  { id: "catch_boost", name: "Catch Boost", max: 30, cat: "spirits", unit: "%", gear: (n) => `+${(n / 2.2).toFixed(1)}% chance a fallen foe stays as a spirit (Catch Boost ${n} ÷ 220).`, perk: { step: 1, max: 20, each: "+0.45% chance a fallen foe stays as a spirit (1 Catch Boost ÷ 220)" } },
  { id: "kyo_find", name: "Kyo Magnet", max: 30, cat: "fortune", unit: "%", gear: (n) => `+${n}% kyo from fights.`, perk: { step: 1, max: 20, each: "+1% kyo dropped by foes" } },
  { id: "ward", name: "Ward", max: 24, cat: "defense", unit: "%", tag: "armor", gear: (n) => `Damage taken is reduced by Ward÷160. This piece is ${n}, which is ${(n / 1.6).toFixed(1)}% less damage on its own. The reduction from all Ward cannot rise above 45%.`, perk: { step: 1, max: 16, each: "0.625% less damage taken (Ward ÷ 160, and the reduction cannot rise above 45%)" } },
  { id: "might", name: "Might", max: 24, cat: "combat", unit: "%", tag: "weapon", gear: (n) => `+${n}% damage on every attack and spell.`, perk: { step: 1, max: 20, each: "+1% damage on every attack and spell" } },
  { id: "swift", name: "Swift", max: 20, cat: "combat", unit: "%", gear: (n) => `Cooldowns are ${n}% shorter from this piece (the shortening cannot rise above 40%). Also adds ${Math.floor(n / 8)} turn-speed (1 per 8 Swift).`, perk: { step: 1, max: 16, each: "1% shorter cooldowns (cannot shorten by more than 40%) and 1 turn-speed per 8 Swift" } },
  { id: "harvest", name: "Harvest", max: 30, cat: "gathering", unit: "%", gear: (n) => `+${n}% ore, timber, and mushrooms from nodes.`, perk: { step: 1, max: 20, each: "+1% ore, timber, and mushrooms from every node" } },
  { id: "fish_luck", name: "Fish Luck", max: 30, cat: "gathering", unit: "%", gear: (n) => `Bites come ${n}% sooner from this piece. All Fish Luck together cannot make bites more than 75% sooner.`, perk: { step: 1, max: 20, each: "1% sooner bites (all Fish Luck together cannot pass 75% sooner)" } },
  { id: "shop_charm", name: "Shop Charm", max: 28, cat: "fortune", unit: "%", gear: (n) => `Shop prices are about ${(n / 1.4).toFixed(1)}% lower (Shop Charm ${n} ÷ 140).`, perk: { step: 1, max: 20, each: "about 0.7% off every shop price (Shop Charm ÷ 140)" } },
  { id: "sell_boost", name: "Merchant Tongue", max: 28, cat: "fortune", unit: "%", gear: (n) => `+${n}% kyo when you sell gear or materials.`, perk: { step: 1, max: 20, each: "+1% kyo when you sell gear or materials" } },
  { id: "crit_edge", name: "Crit Edge", max: 16, cat: "combat", unit: "%", tag: "weapon", gear: (n) => `+${n}% critical chance.`, perk: { step: 1, max: 12, each: "+1% critical chance" } },
  { id: "regen", name: "Afterglow", max: 20, cat: "defense", unit: "flat", tag: "armor", gear: (n) => `Restore ${ (n * 0.4).toFixed(1) } health when a foe falls (Afterglow ${n} × 0.4).`, perk: { step: 1, max: 16, each: "+0.4 health whenever a foe falls" } },
  { id: "boss_bane", name: "Boss Bane", max: 28, cat: "combat", unit: "%", tag: "weapon", gear: (n) => `+${n}% damage to bosses.`, perk: { step: 1, max: 20, each: "+1% damage to bosses" } },
  { id: "shroom_sense", name: "Shroom Sense", max: 30, cat: "gathering", unit: "%", gear: (n) => n >= 20 ? `Shroom Sense ${n}. At 20 or more, mushroom nodes drop one extra reagent.` : `Shroom Sense ${n}. At 20 or more, mushroom nodes drop one extra reagent. This piece is not there yet.`, perk: { step: 1, max: 24, each: "1 Shroom Sense. At 20 total, mushroom nodes drop one extra reagent" } },
  { id: "echo_guard", name: "Echo Guard", max: 12, cat: "defense", unit: "%", tag: "armor", gear: (n) => `${n}% chance to ignore an entire hit. Past 40% combined, extra Echo Guard still helps but bends and never reaches 75%.`, perk: { step: 1, max: 10, each: "+1% chance to ignore an entire hit (past 40% it still climbs, but never reaches 75%)" } },
  { id: "spark_life", name: "Spark of Life", max: 40, cat: "defense", unit: "flat", tag: "armor", gear: (n) => `+${n} maximum health.`, perk: { step: 2, max: 40, each: "+2 maximum health" } },
  { id: "type_edge", name: "Typed Edge", max: 16, cat: "combat", unit: "%", tag: "weapon", gear: (n) => `+${n}% damage when the attack type matches a worn piece (Typed Edge is added as a fraction: ${n} ÷ 100).`, perk: { step: 1, max: 12, each: "+1% damage when your attack type matches a piece you are wearing" } },
  { id: "whetstone", name: "Whetstone", max: 220, cat: "combat", unit: "flat", tag: "weapon", gear: (n) => `+${n} weapon damage, before level and skill multipliers.` },
  { id: "spellweave", name: "Spellweave", max: 22, cat: "combat", unit: "%", tag: "weapon", gear: (n) => `+${n}% spell damage.` },
  { id: "edge", name: "Keen Edge", max: 18, cat: "combat", unit: "%", tag: "weapon", gear: (n) => `+${n}% melee damage.` },
  { id: "hunter_eye", name: "Hunter's Eye", max: 18, cat: "reach", unit: "%", tag: "weapon", gear: (n) => `+${n}% ranged damage.` },
  { id: "hymn", name: "Hymn", max: 18, unit: "%", tag: "weapon", gear: (n) => `+${n}% spell damage, stacking with Spellweave.` },
  { id: "execute", name: "Execute", max: 20, cat: "combat", unit: "%", tag: "weapon", gear: (n) => `+${n}% damage to foes under 35% health.` },
  { id: "giant_bane", name: "Giant Bane", max: 20, cat: "combat", unit: "%", tag: "weapon", gear: (n) => `+${n}% damage to foes above your level.` },
  { id: "last_stand", name: "Last Stand", max: 18, cat: "combat", unit: "%", tag: "armor", gear: (n) => `+${n}% damage while you are under 40% health.` },
  { id: "crit_force", name: "Crit Force", max: 18, cat: "combat", unit: "%", tag: "weapon", gear: (n) => `Critical hits deal +${n}% extra damage. Past +80% combined, extra Crit Force still helps but bends and never reaches +97%.` },
  { id: "leech_edge", name: "Leech", max: 8, cat: "combat", unit: "%", tag: "weapon", gear: (n) => `Heal for ${n}% of the damage you deal.`, perk: { step: 1, max: 6, each: "heal for 1% of the damage you deal" } },
  { id: "armor_crack", name: "Armor Crack", max: 80, cat: "reach", unit: "flat", tag: "weapon", gear: (n) => `Ranged hits ignore ${n} armor.` },
  { id: "plating", name: "Plating", max: 160, cat: "defense", unit: "flat", tag: "armor", gear: (n) => `+${n} armor.` },
  { id: "vitality", name: "Vitality", max: 280, cat: "defense", unit: "flat", tag: "armor", gear: (n) => `+${n} maximum health.` },
  { id: "thorns", name: "Thorns", max: 10, cat: "defense", unit: "%", tag: "armor", gear: (n) => `Return ${n}% of damage taken to the nearest foe. Past 35% combined, extra Thorns still help but bend and never reach 60%.`, perk: { step: 1, max: 10, each: "+1% of damage taken returned to the nearest foe" } },
  { id: "potion_sip", name: "Deep Sip", max: 16, cat: "defense", unit: "%", tag: "relic", gear: (n) => `Potions restore ${n}% more health.` },
  { id: "swift_step", name: "Swift Step", max: 12, cat: "travel", unit: "%", gear: (n) => `+${n}% movement speed. Past +45% combined, extra Swift Step still helps but bends and never reaches +85%.`, perk: { step: 1, max: 12, each: "+1% movement speed" } },
  { id: "focus", name: "Focus", max: 12, cat: "combat", unit: "%", tag: "relic", gear: (n) => `Spell cooldowns are ${n}% shorter. Past 35% combined, extra Focus still helps but bends and never reaches 70%.`, perk: { step: 1, max: 10, each: "1% shorter spell cooldowns" } },
  { id: "fortune", name: "Fortune", max: 24, cat: "fortune", unit: "%", tag: "relic", gear: (n) => `+${(n / 2).toFixed(1)}% gear drop chance, stacking with Loot Find (Fortune ${n} ÷ 200).` },
  { id: "reach", name: "Long Reach", cat: "reach", max: 30, unit: "%", tag: "weapon", gear: (n) => `Ranged attacks and spells reach ${n}% further (melee reach is fixed by the verse). Past +60% combined, extra Long Reach still helps but bends and never reaches +100%.`, perk: { step: 1, max: 15, each: "+1% reach on ranged attacks and spells" } },
  { id: "aura_ease", name: "Aura Ease", cat: "defense", max: 30, unit: "%", tag: "relic", gear: (n) => `Auras reserve ${n}% less of your health. All Aura Ease together cannot cut it by more than half.`, perk: { step: 1, max: 15, each: "auras reserve 1% less of your health (all Aura Ease together cannot cut it by more than half)" } },
  { id: "quick_hands", name: "Quick Hands", cat: "gathering", max: 30, unit: "%", gear: (n) => `Mine, chop and forage ${n}% faster. All Quick Hands together cannot make it more than 60% faster.`, perk: { step: 1, max: 15, each: "1% faster gathering" } },
  { id: "prospector", name: "Prospector", cat: "gathering", max: 40, unit: "%", gear: (n) => `+${n}% ore from veins, and a ${Math.round(n * 0.8)}% better chance of Ironroot.` },
  { id: "lumberjack", name: "Lumberjack", cat: "gathering", max: 40, unit: "%", gear: (n) => `+${n}% timber from trees.` },
  { id: "forager", name: "Forager", cat: "gathering", max: 40, unit: "%", gear: (n) => `+${n}% mushrooms, and a ${Math.round(n * 0.6)}% chance of an extra reagent from every patch.` },
  { id: "spirit_bond", name: "Spirit Bond", cat: "spirits", max: 30, unit: "%", gear: (n) => `Your ghosts deal ${n}% more damage.`, perk: { step: 1, max: 15, each: "+1% damage from your ghosts" } },
  { id: "wayfarer", name: "Wayfarer", cat: "travel", max: 30, unit: "%", gear: (n) => `+${n}% movement speed while out of combat. Past +50% combined it bends and never reaches +90%.` },
  // Ghost and area mechanics.
  { id: "shiny_luck", name: "Shiny Charm", cat: "spirits", max: 30, unit: "%", tag: "relic", gear: (n) => `+${n}% shiny odds on every ghost you find.`, perk: { step: 1, max: 25, each: "+1% shiny odds on every ghost you find" } },
  { id: "ghost_xp", name: "Ghost Mentor", cat: "spirits", max: 40, unit: "%", gear: (n) => `Your ghosts earn ${n}% more XP from kills and lone hunts.`, perk: { step: 2, max: 40, each: "+2% XP for your ghosts (out with you, tagged, or hunting alone)" } },
  { id: "ghost_power", name: "Spirit Resonance", cat: "spirits", max: 30, unit: "%", tag: "relic", gear: (n) => `Your ghosts' abilities are ${n}% stronger (each ability's cap still holds).`, perk: { step: 1, max: 20, each: "+1% strength for every ghost ability (each ability's cap still holds)" } },
  { id: "area_power", name: "Wide Arc", cat: "combat", max: 30, unit: "%", tag: "weapon", gear: (n) => `Splash, nova, chain and boomerang hits deal ${n}% more damage.`, perk: { step: 1, max: 20, each: "+1% damage from splash, nova, chain and boomerang hits" } },
  { id: "mana_well", name: "Mana Well", max: 40, cat: "combat", unit: "%", tag: "relic", gear: (n) => `+${n}% maximum mana.`, perk: { step: 1, max: 24, each: "+1% maximum mana" } },
  { id: "stam_well", name: "Stamina Well", max: 40, cat: "combat", unit: "%", tag: "armor", gear: (n) => `+${n}% maximum stamina.`, perk: { step: 1, max: 24, each: "+1% maximum stamina" } },
  { id: "mana_flow", name: "Mana Flow", max: 30, cat: "combat", unit: "%", tag: "relic", gear: (n) => `Mana recovers ${n}% faster.`, perk: { step: 1, max: 20, each: "1% faster mana recovery" } },
  { id: "stam_flow", name: "Stamina Flow", max: 30, cat: "combat", unit: "%", tag: "armor", gear: (n) => `Stamina recovers ${n}% faster.`, perk: { step: 1, max: 20, each: "+1% faster stamina recovery" } },
  { id: "body_tide", name: "Body Tide", max: 24, cat: "defense", unit: "%", tag: "armor", gear: (n) => `+${n}% health, and mana and stamina rise with it, because they are shares of the same body.`, perk: { step: 1, max: 16, each: "+1% health, which also lifts mana and stamina" } },
  { id: "combo_core", name: "Combo Core", max: 24, cat: "combat", unit: "%", tag: "weapon", gear: (n) => `Multi-hit verses strike ${n}% harder on every extra hit.`, perk: { step: 1, max: 16, each: "+1% damage on the extra hits of multi-hit verses" } },
  { id: "gimmick_haste", name: "Trickster", max: 20, cat: "combat", unit: "%", tag: "relic", gear: (n) => `Your class gimmick (R) comes back ${n}% sooner. All Trickster together cannot pass 50%.`, perk: { step: 1, max: 15, each: "1% shorter class gimmick cooldown (cannot pass 50%)" } },
  { id: "gimmick_power", name: "Showstopper", max: 30, cat: "combat", unit: "%", tag: "weapon", gear: (n) => `Your class gimmick (R) deals ${n}% more damage.`, perk: { step: 1, max: 20, each: "+1% damage from your class gimmick" } },
  { id: "form_fury", name: "Shapeshifter", max: 24, cat: "combat", unit: "%", tag: "armor", gear: (n) => `While transformed (cat, rabbit, boss form, ghost, flight) you deal ${n}% more damage and take ${Math.round(n / 2)}% less.`, perk: { step: 1, max: 16, each: "+1% damage and 0.5% less damage taken while transformed" } },
  { id: "afterimage", name: "Afterimage", max: 20, cat: "combat", unit: "%", tag: "armor", gear: (n) => `Your gimmick lasts ${n}% longer.`, perk: { step: 1, max: 15, each: "+1% class gimmick duration" } },
];

export const ENCHANT_BY_ID: Record<string, EnchantDef> = Object.fromEntries(ENCHANTS.map((e) => [e.id, e]));

export function enchantText(roll: { id: string; power: number }): string {
  const def = ENCHANT_BY_ID[roll.id];
  if (!def) return roll.id;
  return def.gear(roll.power);
}

export function perkText(def: EnchantDef, power: number): string {
  const perk = def.perk;
  if (!perk) return def.gear(power);
  const now = Math.max(0, Math.floor(power));
  const over = now > perk.max;
  const next = now + perk.step;
  const cap = over
    ? ` Overmax ${now} (the old max was ${perk.max}). Extra points still stack. Chance and reduction bonuses bend before they can break a fight.`
    : now >= perk.max
      ? ` At the old max of ${perk.max}. Another point overmaxes it and still stacks.`
      : ` Next point raises it by ${perk.step}, to ${next}. The old max was ${perk.max}; past that, points still stack.`;
  return `Each point adds ${perk.each}. You have ${now}.${cap} Kept on the account through death, a new witch, and Hardcore. Stacks with ${def.name} on gear.`;
}

export const QUALITIES: { id: QualityId; name: string; mult: number }[] = [
  { id: "worn", name: "Worn", mult: 0.65 },
  { id: "common", name: "Common", mult: 1 },
  { id: "fine", name: "Fine", mult: 1.25 },
  { id: "rare", name: "Rare", mult: 1.6 },
  { id: "epic", name: "Epic", mult: 2.15 },
  { id: "legendary", name: "Legendary", mult: 3 },
];

export type EnchantRoll = { id: string; power: number };
/** What a piece of gear is for. Combat and defense pieces win fights; the rest make farming, fishing, ghost hunting, travel and trade better. */
export type GearPurpose = EnchantCat;
export const GEAR_PURPOSES: { id: GearPurpose; name: string; word: string; about: string }[] = [
  { id: "combat", name: "Combat", word: "", about: "Damage, crits, cooldowns." },
  { id: "defense", name: "Defense", word: "Warded", about: "Armor, health, wards and thorns." },
  { id: "reach", name: "Reach", word: "Farshot", about: "Longer reach, ranged damage, armor-cracking." },
  { id: "gathering", name: "Gathering", word: "Gatherer's", about: "Mining, chopping, foraging and fishing." },
  { id: "fortune", name: "Fortune", word: "Lucky", about: "Kyo, loot, experience and better prices." },
  { id: "spirits", name: "Spirits", word: "Spirit-bound", about: "Catch more ghosts; your ghosts hit harder." },
  { id: "travel", name: "Travel", word: "Wanderer's", about: "Move faster, out of fights especially." },
];
export const PURPOSE_BY_ID = Object.fromEntries(GEAR_PURPOSES.map((p) => [p.id, p])) as Record<GearPurpose, (typeof GEAR_PURPOSES)[number]>;
const PURPOSE_ODDS: Record<"weapon" | "armor" | "relic", [GearPurpose, number][]> = {
  weapon: [["combat", 55], ["reach", 18], ["gathering", 14], ["spirits", 7], ["fortune", 6]],
  armor: [["defense", 38], ["combat", 14], ["gathering", 14], ["fortune", 11], ["spirits", 11], ["travel", 12]],
  relic: [["combat", 22], ["fortune", 18], ["spirits", 18], ["gathering", 16], ["defense", 14], ["travel", 12]],
};
/** What a piece is for: its rolled purpose, or (older pieces) whatever most of its enchantments are. */
export function gearPurpose(g: Pick<Gear, "purpose" | "enchants">): GearPurpose {
  if (g.purpose) return g.purpose;
  const tally: Partial<Record<GearPurpose, number>> = {};
  for (const e of g.enchants ?? []) { const c = ENCHANT_BY_ID[e.id]?.cat; if (c) tally[c] = (tally[c] ?? 0) + 1; }
  let best: GearPurpose = "combat", n = 0;
  for (const [k, v] of Object.entries(tally)) if ((v ?? 0) > n) { n = v ?? 0; best = k as GearPurpose; }
  return best;
}
export type Gear = {
  uid: string;
  slot: Slot;
  setId: string | null;
  style: number;
  name: string;
  level: number;
  /** TURBZ: progress toward the next gear level. Gear climbs slower than the hunter. */
  gx?: number;
  quality: QualityId;
  type: TypeId;
  enchants: EnchantRoll[];
  fxSeed: number;
  /** FX gene: decides this piece's effect pattern, shape, accent colour, speed and size (see fx-gene.ts). */
  fxGene?: number;
  price: number;
  /** Retained for compatibility with old equipment files; abilities belong to the character. */
  moves: string[];
  /** What the piece is built for (its enchantments mostly come from this). Older pieces work it out from their enchantments. */
  purpose?: GearPurpose;
  previousEquipment?: { moves: string[]; enchants: EnchantRoll[] };
};

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function irand(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[irand(rng, arr.length)]!;
}

let uidN = 1;
export function nextUid(): string {
  uidN += 1;
  return `g${Date.now().toString(36)}${uidN.toString(36)}`;
}

function rollQuality(rng: Rng, level: number, luck: number, floor: QualityId | null): (typeof QUALITIES)[number] {
  if (floor) return QUALITIES.find((q) => q.id === floor) ?? QUALITIES[1]!;
  const boost = Math.min(1.8, level / 180) + luck / 100;
  const roll = rng() * (1 + boost * 0.35);
  if (roll > 1.22) return QUALITIES[5]!;
  if (roll > 1.05) return QUALITIES[4]!;
  if (roll > 0.82) return QUALITIES[3]!;
  if (roll > 0.55) return QUALITIES[2]!;
  if (roll > 0.28) return QUALITIES[1]!;
  return QUALITIES[0]!;
}

export function rollGear(
  rng: Rng,
  opts: {
    level: number;
    slot?: Slot;
    luck?: number;
    floor?: QualityId | null;
    raceBias?: RaceId | null;
    typeBias?: TypeId | null;
    setId?: string | null;
    /** Source bonus as a fraction of the hunter's level (boss 0.06, bounty tier…). See balance.ts SOURCE_BONUS. */
    bonus?: number;
  },
): Gear {
  const slot = opts.slot ?? pick(rng, ["head", "chest", "legs", "feet", "relic", "weapon"] as Slot[]);
  const quality = rollQuality(rng, opts.level, opts.luck ?? 0, opts.floor ?? null);
  const type = opts.typeBias && rng() < 0.55 ? opts.typeBias : pick(rng, TYPE_IDS);
  let setId: string | null = null;
  let style = irand(rng, WEAPON_KINDS.length);
  let title = `${WEAPON_KINDS[style]} of ${WEAPONS[irand(rng, WEAPONS.length)]}`;
  if (slot !== "weapon") {
    const biased = opts.raceBias ? SETS.filter((s) => s.race === opts.raceBias) : SETS;
    const set = opts.setId ? SET_BY_ID[opts.setId]! : rng() < 0.62 && biased.length ? pick(rng, biased) : pick(rng, SETS);
    setId = set.id;
    style = set.style;
    title = set.name;
  }
  const level = dropGearLevel(opts.level, quality.id, opts.bonus ?? 0, opts.luck ?? 0);
  const where = slot === "weapon" ? "weapon" : slot === "relic" ? "relic" : "armor";
  const odds = PURPOSE_ODDS[where];
  let roll = rng() * odds.reduce((n, [, w]) => n + w, 0);
  let purpose: GearPurpose = odds[0]![0];
  for (const [p, w] of odds) { roll -= w; if (roll <= 0) { purpose = p; break; } }
  const enchants = rollEnchants(rng, slot, level, quality.id, purpose);
  const word = PURPOSE_BY_ID[purpose].word;
  const gear: Gear = {
    uid: nextUid(),
    slot,
    setId,
    style,
    name: `${quality.name} ${word ? `${word} ` : ""}${TYPES[type].name} ${title}${slot === "weapon" ? "" : ` ${SLOT_NOUN[slot]}`}`,
    purpose,
    level,
    quality: quality.id,
    type,
    enchants,
    fxSeed: irand(rng, 6),
    fxGene: 1 + Math.floor(rng() * 0x7ffffffe),
    price: 0,
    moves: [],
  };
  gear.price = gearPrice(gear);
  return gear;
}

const RARITY_ENCHANTS: Record<QualityId, number> = {
  worn: 0,
  common: 1,
  fine: 2,
  rare: 4,
  epic: 6,
  legendary: 8,
};

export function clampGearLevel(level: number): number {
  return Math.max(1, Math.min(MAX_GEAR_LEVEL, Math.floor(level || 1)));
}

/** Quality pushes a drop above the hunter's level: a percentage and a few flat levels. */
export const QUALITY_LEVEL: Record<QualityId, { pct: number; flat: number }> = {
  worn: { pct: -0.04, flat: -1 },
  common: { pct: 0, flat: 0 },
  fine: { pct: 0.03, flat: 0 },
  rare: { pct: 0.06, flat: 1 },
  epic: { pct: 0.11, flat: 2 },
  legendary: { pct: 0.18, flat: 3 },
};

/**
 * A drop's level (balance patch): it starts at the hunter's level, then quality, the source
 * bonus (boss, bounty tier, market…) and luck push it up from there. It never compounds off
 * gear you already wear. Bounty tiers keep raising the source bonus, which is the long road
 * to level-1000 gear.
 */
export function dropGearLevel(playerLevel: number, quality: QualityId, bonusPct = 0, luck = 0): number {
  const base = Math.max(1, Math.floor(playerLevel || 1));
  const q = QUALITY_LEVEL[quality] ?? QUALITY_LEVEL.common;
  const luckPct = Math.min(0.05, Math.max(0, luck) / 1000);
  return clampGearLevel(Math.round(base * (1 + q.pct + Math.max(-0.2, bonusPct) + luckPct) + q.flat));
}

/** Legacy rule (pre balance patch): multiplied the source level by up to 2.35x. Kept for old callers; rollGear no longer uses it. */
export function stretchGearLevel(sourceLevel: number, quality: QualityId, luck = 0): number {
  const q = Math.max(0, QUALITIES.findIndex((x) => x.id === quality));
  const stretch = 1 + (q / 5) * 1.35;
  const luckBump = Math.min(40, Math.floor(Math.max(0, luck) / 10));
  return clampGearLevel(Math.round(Math.max(1, sourceLevel) * stretch) + luckBump);
}

/** Level contributes 0–12. Rarity contributes 0–8. Together they fill 0–20, with a little jitter. */
export function enchantCountFor(rng: Rng, level: number, quality: QualityId): number {
  const lv = clampGearLevel(level);
  const fromLevel = Math.floor(((lv - 1) / (MAX_GEAR_LEVEL - 1)) * 12);
  const jitter = rng() < 0.4 ? -1 : rng() < 0.55 ? 0 : 1;
  return Math.max(0, Math.min(MAX_GEAR_ENCHANTS, fromLevel + (RARITY_ENCHANTS[quality] ?? 0) + jitter));
}

export function rollEnchantPower(rng: Rng, def: EnchantDef, level: number, qualityIndex: number): number {
  if (def.max <= 1) return 1;
  const t = (clampGearLevel(level) - 1) / (MAX_GEAR_LEVEL - 1);
  const q = Math.max(0, qualityIndex) / 5;
  const portion = def.unit === "flat" ? 0.025 + t * t * 0.84 + q * 0.1 : 0.16 + t * 0.58 + q * 0.2;
  const variance = 0.88 + rng() * 0.24;
  return Math.max(1, Math.min(def.max, Math.round(def.max * Math.min(1, portion * variance))));
}

function rollEnchants(rng: Rng, slot: Slot, level: number, quality: QualityId, purpose: GearPurpose = "combat"): EnchantRoll[] {
  const n = enchantCountFor(rng, level, quality);
  const qIndex = Math.max(0, QUALITIES.findIndex((x) => x.id === quality));
  const prefer = slot === "weapon" ? "weapon" : slot === "relic" ? "relic" : "armor";
  // The piece's purpose comes first: most of its enchantments are drawn from it, the rest from anything.
  const fits = (e: EnchantDef) => !e.tag || e.tag === prefer;
  const own = ENCHANTS.filter((e) => e.cat === purpose && fits(e));
  const ownAny = ENCHANTS.filter((e) => e.cat === purpose && !fits(e));
  const front = [...own, ...ownAny, ...ENCHANTS.filter((e) => e.cat !== purpose && fits(e))];
  const back = ENCHANTS.filter((e) => e.cat !== purpose && !fits(e));
  const bag = [...front, ...back];
  const picked: EnchantRoll[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (picked.length < n && bag.length && guard < 80) {
    guard += 1;
    const ownLeft = bag.findIndex((e) => e.cat !== purpose);
    const span = picked.length < Math.ceil(n * 0.7) && ownLeft > 0 ? ownLeft : picked.length < Math.ceil(n * 0.85) ? Math.max(1, Math.ceil(bag.length * 0.7)) : bag.length;
    const i = irand(rng, Math.min(bag.length, span));
    const def = bag.splice(i, 1)[0];
    if (!def || used.has(def.id)) continue;
    used.add(def.id);
    picked.push({ id: def.id, power: rollEnchantPower(rng, def, level, qIndex) });
  }
  return picked;
}

export function gearPrice(g: Gear): number {
  const q = QUALITIES.findIndex((x) => x.id === g.quality) + 1;
  const ep = g.enchants.reduce((s, e) => s + e.power * 8, 0);
  return Math.max(12, Math.floor(20 + g.level * 6 * q + ep));
}

/** Restore enchantments that an older build stripped, and keep them on the piece. */
export function migrateEquipment(g: Gear): void {
  if (!Array.isArray(g.enchants)) g.enchants = [];
  if (g.enchants.length === 0 && g.previousEquipment?.enchants?.length) {
    g.enchants = g.previousEquipment.enchants
      .filter((e) => e && ENCHANT_BY_ID[e.id] && e.power > 0)
      .map((e) => ({ id: e.id, power: Math.max(1, Math.floor(e.power)) }))
      .slice(0, MAX_GEAR_ENCHANTS);
  }
  g.enchants = g.enchants.filter((e) => e && ENCHANT_BY_ID[e.id] && e.power > 0).slice(0, MAX_GEAR_ENCHANTS);
  g.moves = [];
  g.level = clampGearLevel(g.level || 1);
}

/** Weapon damage and armor from level (1–1000), quality, and flat enchantments. */
export function equipmentStats(g: Gear): { damage: number; armor: number } {
  const q = Math.max(0, QUALITIES.findIndex(x => x.id === g.quality));
  const level = clampGearLevel(g.level || 1);
  let whet = 0;
  let plate = 0;
  for (const e of g.enchants ?? []) {
    if (e.id === "whetstone") whet += e.power;
    if (e.id === "plating") plate += e.power;
  }
  return {
    damage: g.slot === "weapon" ? 8 + level * 2 + q * 6 + whet : 0,
    armor: ["head", "chest", "legs", "feet"].includes(g.slot) ? 8 + level * 2 + q * 5 + plate : g.slot === "relic" ? 3 + Math.floor(level * 0.5) + plate : 0,
  };
}
export function gearScore(g: Gear): number {
  const stats = equipmentStats(g);
  const enchant = (g.enchants ?? []).reduce((s, e) => s + e.power + 12, 0);
  return stats.damage * 4 + stats.armor * 3 + enchant;
}

export function qualityName(id: QualityId): string {
  return QUALITIES.find((q) => q.id === id)?.name ?? id;
}

export type MonsterDef = {
  id: string;
  name: string;
  type: TypeId;
  template: number;
  about: string;
  boss?: boolean;
  animal?: boolean;
};

export const MONSTERS: MonsterDef[] = [
  { id: "onibi", name: "Onibi", type: "fire", template: 0, about: "A funeral flame that learned a face." },
  { id: "nobi", name: "Nobi", type: "fire", template: 1, about: "Small, quick, and already angry." },
  { id: "hinotama", name: "Hinotama", type: "fire", template: 2, about: "A fireball with opinions." },
  { id: "kagaribi", name: "Kagaribi", type: "fire", template: 3, about: "The watchfire that left its post." },
  { id: "shizuku", name: "Shizuku", type: "water", template: 4, about: "One drop, endless patience." },
  { id: "nami", name: "Nami", type: "water", template: 5, about: "A wave that stands up." },
  { id: "uroko", name: "Uroko", type: "water", template: 6, about: "Scales without the fish." },
  { id: "kasa", name: "Kasa", type: "water", template: 7, about: "An umbrella that rains upward." },
  { id: "tsuchi", name: "Tsuchi", type: "earth", template: 8, about: "Clay that refused the grave." },
  { id: "kusa", name: "Kusa", type: "earth", template: 9, about: "Grass with a grudge." },
  { id: "yanagi", name: "Yanagi", type: "earth", template: 10, about: "Willow hair, no woman under it." },
  { id: "mokuzu", name: "Mokuzu", type: "earth", template: 11, about: "River weed that learned to hunt." },
  { id: "yuki", name: "Yuki", type: "ice", template: 12, about: "A child-shaped winter." },
  { id: "raiju", name: "Raiju", type: "electric", template: 13, about: "Thunder's pet, off the leash." },
  { id: "kaze", name: "Kaze", type: "air", template: 14, about: "Wind wearing a beak." },
  { id: "hikari", name: "Hikari", type: "light", template: 15, about: "A halo that bites." },
  { id: "yami", name: "Yami", type: "spirit", template: 16, about: "The dark between two lanterns." },
  { id: "kage", name: "Kage", type: "void", template: 17, about: "Your shadow, employed." },
  { id: "yomi", name: "Yomi", type: "void", template: 18, about: "A door that walks." },
  { id: "naraku", name: "Naraku", type: "void", template: 19, about: "The pit grew teeth." },
  { id: "muma", name: "Muma", type: "ghoul", template: 20, about: "A nun who kept the hunger." },
  { id: "umoregi", name: "Umoregi", type: "earth", template: 21, about: "Buried wood, still growing." },
  { id: "gaikotsu", name: "Gaikotsu", type: "ghoul", template: 22, about: "Bones on patrol." },
  { id: "wisp", name: "Tide Wisp", type: "spirit", template: 23, about: "Marsh-light with a hook." },
  { id: "saintling", name: "Marrow Saintling", type: "light", template: 24, about: "A small saint. Still a problem." },
];

export const MONSTER_BY_ID: Record<string, MonsterDef> = Object.fromEntries(MONSTERS.map((m) => [m.id, m]));

export const ANIMALS: MonsterDef[] = [
  { id: "hare", name: "Briar Hare", type: "earth", template: 9, about: "Quick hide. A little meat.", animal: true },
  { id: "boar", name: "Tusk Boar", type: "earth", template: 8, about: "Charges. Leather if you live.", animal: true },
  { id: "stag", name: "Glass Stag", type: "air", template: 1, about: "The good hide.", animal: true },
  { id: "wolf", name: "Marrow Wolf", type: "ghoul", template: 13, about: "Hunts back.", animal: true },
  { id: "crow", name: "Veil Crow", type: "air", template: 14, about: "Feathers, a strip of meat.", animal: true },
];

export const ANIMAL_BY_ID: Record<string, MonsterDef> = Object.fromEntries(ANIMALS.map((a) => [a.id, a]));

export const ANIMAL_BIOME: Partial<Record<BiomeId, string[]>> = {
  verdant: ["hare", "boar", "stag"],
  frost: ["stag", "wolf", "hare"],
  crown: ["hare", "crow"],
  tide: ["crow", "hare"],
  bone: ["crow", "wolf"],
  ashen: ["boar", "crow"],
  void: ["crow", "wolf"],
};

export const WITCH_NAMES = [
  "Sister Vell",
  "Moth Adel",
  "Quinn Vale",
  "Harrow Nia",
  "Pell the Quiet",
  "Ash Widow",
  "Lark of the Pit",
  "Sera Coil",
  "Brine Nun",
  "Orris Hex",
];

export type BiomeId = "crown" | "verdant" | "frost" | "void" | "tide" | "ashen" | "bone";

export const BIOME_MONSTERS: Record<BiomeId, string[]> = {
  crown: ["gaikotsu", "yami", "hikari"],
  verdant: ["kusa", "yanagi", "mokuzu", "umoregi", "tsuchi"],
  frost: ["yuki", "kaze", "hikari"],
  void: ["kage", "yomi", "naraku", "muma"],
  tide: ["shizuku", "nami", "uroko", "kasa", "wisp"],
  ashen: ["onibi", "nobi", "hinotama", "kagaribi", "raiju"],
  bone: ["gaikotsu", "muma", "yami", "saintling"],
};

export const SKILLS = [
  { id: "mining", name: "Mining" },
  { id: "woodcutting", name: "Woodcutting" },
  { id: "hunting", name: "Hunting" },
  { id: "catching", name: "Catching" },
  { id: "trading", name: "Trading" },
  { id: "fishing", name: "Fishing" },
  { id: "social", name: "Social" },
  { id: "shroom", name: "Shroom" },
  { id: "alchemy", name: "Alchemy" },
  { id: "adventuring", name: "Adventuring" },
  { id: "physical", name: "Physical" },
  { id: "magic", name: "Magic" },
  { id: "mana", name: "Mana" },
  { id: "stamina", name: "Stamina" },
  { id: "wayfinding", name: "Wayfinding" },
  { id: "survival", name: "Survival" },
  { id: "cooking", name: "Cooking" },
  { id: "building", name: "Building" },
  { id: "ghostkeeping", name: "Ghostkeeping" },
  { id: "evasion", name: "Evasion" },
  { id: "bountyhunting", name: "Bounty Hunting" },
  { id: "skinning", name: "Skinning" },
  { id: "looting", name: "Looting" },
  // One mastery per element: cast verses of that element to grind it.
  { id: "m_normal", name: "Normal Mastery" },
  { id: "m_fire", name: "Fire Mastery" },
  { id: "m_water", name: "Water Mastery" },
  { id: "m_earth", name: "Earth Mastery" },
  { id: "m_air", name: "Air Mastery" },
  { id: "m_electric", name: "Electric Mastery" },
  { id: "m_ice", name: "Ice Mastery" },
  { id: "m_void", name: "Void Mastery" },
  { id: "m_light", name: "Light Mastery" },
  { id: "m_spirit", name: "Spirit Mastery" },
  { id: "m_ghoul", name: "Ghoul Mastery" },
] as const;

/** The element mastery skill that verses of this element train. */
export function masteryOf(type: string): SkillId {
  return `m_${type}` as SkillId;
}

export type SkillId = (typeof SKILLS)[number]["id"];

export function skillNeed(level: number): number {
  const lv = Math.max(1, Math.floor(level) || 1);
  const early = 40 * Math.pow(1.12, Math.min(lv - 1, 30));
  const tail = 1 + Math.max(0, lv - 30) * 0.035;
  const need = Math.floor(early * tail);
  return Number.isFinite(need) ? Math.max(20, need) : Number.MAX_SAFE_INTEGER;
}

export function xpNeed(level: number): number {
  const lv = Math.max(1, Math.floor(level) || 1);
  // Steep early so the first levels come in a handful of kills, then a long tail
  // so the late game has weight. Tuned against kill XP of 10 + 4 per foe level.
  const early = 28 * Math.pow(1.22, Math.min(lv - 1, 18));
  const tail = 1 + Math.max(0, lv - 18) * 0.08;
  const need = Math.floor(early * tail);
  return Number.isFinite(need) ? Math.max(20, need) : Number.MAX_SAFE_INTEGER;
}

/**
 * What a skill does at a level. No skill has a cap. Chances past 100% are not wasted: every full
 * 100% is a guaranteed extra and the rest is a roll. Speed-ups are rates (+100% = twice as fast),
 * so they keep improving forever without ever hitting zero time. Evasion is a rating.
 */
export function skillLine(id: SkillId, level: number): string {
  const lv = Math.max(1, Math.floor(level) || 1);
  const n = lv - 1;
  const f = (v: number) => v.toFixed(1);
  const extra = (pct: number, what: string) => `${f(pct)}% ${what}. Every full 100% is a guaranteed one, the rest is a roll`;
  switch (id) {
    case "mining":
    case "woodcutting":
      return `+${f(n * 0.3)}% materials from each node. 0.3% per level, no cap.`;
    case "hunting":
      return `+${f(n * 0.2)}% damage against every foe. 0.2% per level, no cap.`;
    case "catching":
      return `+${f(n * 0.12)}% catch chance. 0.12% per level, no cap. Past a sure catch, the extra raises the odds of a shiny and gives the ghost more health.`;
    case "trading":
      return `Sell prices +${f(n * 0.2)}%. Buying power +${f(n * 0.25)}%: shops charge ${f(100 / (1 + n * 0.0025))}% of the list price. 0.2% and 0.25% per level, no cap; prices keep falling but never reach zero.`;
    case "fishing":
      return `Bites come +${f(n * 0.5)}% faster (waits are ${f(100 / (1 + n * 0.005))}% as long). 0.5% per level, no cap.`;
    case "social":
      return `Quest kyo +${f(n * 0.15)}%. 0.15% per level, no cap.`;
    case "shroom":
      return `${extra(n * 0.2, "chance a patch gives an extra reagent and shroom")}. 0.2% per level, no cap.`;
    case "alchemy":
      return `${extra(n * 0.125, "chance to brew an extra dose")}. 0.125% per level, no cap.`;
    case "adventuring":
      return `TurboHunt: out of combat, restore ${(1.2 + lv * 0.15).toFixed(1)} health per second (1.2 + level × 0.15, no cap). Hardcore has no natural healing.`;
    case "physical":
      return `+${(n * 2).toFixed(0)}% melee and +${f(n * 1.5)}% ranged damage, and +${f(n * 0.25)}% maximum stamina. 2%, 1.5% and 0.25% per level, no cap.`;
    case "magic":
      return `+${(n * 2.5).toFixed(0)}% spell damage, spells recharge +${f(n * 0.2)}% faster, and +${f(n * 0.25)}% maximum mana. 2.5%, 0.2% and 0.25% per level, no cap.`;
    case "mana":
      return `+${f(n * 1)}% maximum mana and +${f(n * 0.4)}% mana recovery. 1% and 0.4% per level, no cap. Trained when you cast spells.`;
    case "stamina":
      return `+${f(n * 1)}% maximum stamina and +${f(n * 0.4)}% stamina recovery. 1% and 0.4% per level, no cap. Trained when you swing or shoot.`;
    case "wayfinding":
      return `+${f(n * 0.075)}% movement speed. 0.075% per level, no cap.`;
    case "survival":
      return `+${f(n * 0.4)}% endurance: hunger, thirst and rest drain ${f(100 - 100 / (1 + n * 0.004))}% slower (Hardcore). 0.4% per level, no cap; the bars slow forever but never stop.`;
    case "cooking":
      return `${extra(n * 0.15, "chance a campfire recipe makes an extra portion")} (Hardcore). 0.15% per level, no cap.`;
    case "building":
      return `${extra(n * 0.25, "chance a wall, bed, campfire or Ghost Box refunds a material")}. 0.25% per level, no cap.`;
    case "ghostkeeping":
      return `Your ghosts deal +${f(n * 0.4)}% damage, earn +${f(n * 0.5)}% XP, and their abilities are +${f(n * 0.1)}% stronger (caps still hold). 0.4%, 0.5% and 0.1% per level, no cap.`;
    case "evasion": {
      const rating = n * 0.1;
      return `Evasion rating ${f(rating)}: ${f((rating / (rating + 100)) * 100)}% chance to slip a hit that lands on you. 0.1 rating per level, no cap (100 rating is 50%, 300 is 75%).`;
    }
    case "bountyhunting":
      return `+${f(n * 0.5)}% damage against bounties, witches and hunters. 0.5% per level, no cap.`;
    case "skinning":
      return `${extra(n * 0.3, "chance a hunted animal gives one more meat and hide")}. 0.3% per level, no cap.`;
    case "looting":
      return `${extra(n * 0.15, "chance a loot chest holds an extra supply")}, and chests last +${(n * 0.5).toFixed(0)} s. 0.15% and 0.5 s per level, no cap.`;
    default:
      if (id.startsWith("m_")) {
        const t = TYPES[id.slice(2) as TypeId];
        return `+${f(n * 0.6)}% damage with ${t?.name ?? ""} verses (yours and your ghosts'), and they recharge +${f(n * 0.1)}% faster. 0.6% and 0.1% per level, no cap.`;
      }
      return "";
  }
}

export type ItemDef = { id: string; name: string; about: string; price: number; heal?: number; buff?: string };

export const ITEMS: ItemDef[] = [
  { id: "trail_ration", name: "Trail Ration", about: "Field food. Restores 35 hunger in Hardcore and heals a little (5% of your health).", price: 12 },
  { id: "cooked_meat", name: "Cooked Meat", about: "A campfire meal. Restores 50 hunger in Hardcore and heals 10% of your health.", price: 20 },
  { id: "raw_water", name: "Raw Water", about: "Hardcore: collect it at any water tile. Purify it at a campfire (one log) before drinking.", price: 0 },
  { id: "drinking_water", name: "Drinking Water", about: "Hardcore: purified at a campfire. Restores 50 thirst.", price: 0 },
  { id: "potion", name: "Potion", about: "Heals 28% of your health at once and 12% more over 6 seconds.", price: 18, heal: 45 },
  { id: "big_potion", name: "Big Potion", about: "The good bottle. Heals 50% of your health at once and 20% more over 8 seconds.", price: 48, heal: 110 },
  { id: "ghost_jar", name: "Ghost Jar", about: "Use it and, for one minute, fallen foes are much more likely to stay behind as ghosts you can catch.", price: 26 },
  { id: "cleanse_salt", name: "Cleanse Salt", about: "Clears sleep, roots, silence and other bad effects, and keeps them off for a few seconds. Quartermaster Holt takes two for the Salt Run quest.", price: 14 },
  { id: "spirit_candy", name: "Spirit Candy", about: "A rush of spirit. Heals you 15% and mends the ghosts out with you by 40%.", price: 22, heal: 30 },
  { id: "smoke_bomb", name: "Smoke Bomb", about: "Hop a few steps back out of a fight.", price: 20 },
  { id: "blue_lantern", name: "Blue Lantern", about: "A glowing fungus from mushroom patches. Alchemy: Cat's Eye Draught, Big Potion, Spirit Candy, Spark Flask, Spirit Lamp.", price: 16 },
  { id: "dreamspore", name: "Dreamspore", about: "Sleepy spore dust from mushroom patches. Alchemy: Warmth Tonic, Cat's Eye Draught, Big Potion, Spirit Candy.", price: 20 },
  { id: "embercap", name: "Embercap", about: "A hot cap from mushroom patches. Alchemy: Potion, Warmth Tonic and other fire brews.", price: 18 },
  { id: "ironroot", name: "Ironroot", about: "A bitter root that turns up when you mine ore. Alchemy: Ironroot Phial, Big Potion, Pearl Salve.", price: 18 },
  { id: "warmth_tonic", name: "Warmth Tonic", about: "Heals 30% (+10% over 5s), and your fire verses deal +22% damage for 25 seconds.", price: 0, heal: 70, buff: "fire" },
  { id: "cats_eye", name: "Cat's Eye Draught", about: "+20% critical hit chance for 25 seconds.", price: 0, buff: "crit" },
  { id: "ironroot_phial", name: "Ironroot Phial", about: "A bark ward: you take about 20% less damage for 25 seconds.", price: 0, buff: "ward" },
  { id: "fish", name: "Raw Fish", about: "Raw. Cook it at a campfire into Fish Meal or Fish Stew; Hardcore will not let you eat it raw. In TurboHunt it heals a little.", price: 8, heal: 18 },
  { id: "fish_meal", name: "Fish Meal", about: "Cooked fish (at a campfire, or ask Fisher Bram). Restores 40 hunger in Hardcore and heals 18% of your health.", price: 0, heal: 55 },
  { id: "ore", name: "Vein Ore", about: "Mined from ore veins. Four ore and four logs build a Ghost Box. Sell spare ore from the Bag or at the Black Market (T).", price: 10 },
  { id: "timber", name: "Logs", about: "Chopped timber. Three build a campfire; one fuels a meal or water purification.", price: 8 },
  { id: "meat", name: "Raw Meat", about: "From hunted animals. Cook on a campfire before eating in Hardcore.", price: 9, heal: 22 },
  { id: "leather", name: "Hide Leather", about: "From hunted animals. Ten hides and ten mushrooms stitch a random gear piece at your level (Bag → Stitch gear). Three hides and two logs build a bed.", price: 14 },
  { id: "mushroom", name: "Shroom", about: "From mushroom patches. Used in potions, stews and gear stitching; in Hardcore you can eat one raw for 8 hunger.", price: 11 },
  { id: "bone_shard", name: "Bone Shard", about: "Dropped by ghouls and other foes. Two and a mushroom brew two Potions (Bone Tincture).", price: 7 },
  { id: "cinder_ash", name: "Cinder Ash", about: "Fire foes drop it. With an embercap it brews a Warmth Tonic (Ash Tonic).", price: 8 },
  { id: "tide_pearl", name: "Tide Pearl", about: "Water foes drop it. With ironroot it makes a Pearl Salve.", price: 12 },
  { id: "resin", name: "Heartroot Resin", about: "Earth foes drop it. With a mushroom and an embercap it brews a Potion (Resin Balm).", price: 7 },
  { id: "beast_fang", name: "Beast Fang", about: "Beasts and biters drop it. With dreamspore it brews a Cat's Eye Draught (Fang Draught).", price: 8 },
  { id: "spark_core", name: "Spark Core", about: "Electric foes drop it. With a blue lantern it makes a Spark Flask.", price: 11 },
  { id: "frost_crystal", name: "Frost Crystal", about: "Ice foes drop it. With ironroot it makes an Ironroot Phial (Rime Phial).", price: 9 },
  { id: "veil_dust", name: "Veil Dust", about: "Void foes drop it. With dreamspore and a mushroom it makes two Spirit Candy (Veil Candy).", price: 10 },
  { id: "spirit_ash", name: "Spirit Ash", about: "Spirit foes drop it. With a blue lantern it makes a Spirit Lamp.", price: 10 },
  { id: "lantern_mote", name: "Lantern Mote", about: "Light foes drop it. With an embercap it brews a Warmth Tonic (Lantern Oil).", price: 9 },
  { id: "mushroom_stew", name: "Mushroom Stew", about: "A campfire bowl. Restores 45 hunger.", price: 16, heal: 28 },
  { id: "hearty_skewer", name: "Hearty Skewer", about: "Two cuts of meat over the fire. Restores 70 hunger.", price: 24, heal: 36 },
  { id: "fish_stew", name: "Fish Stew", about: "Fish, shroom and boiled water. Restores 60 hunger.", price: 22, heal: 32 },
  { id: "bone_broth", name: "Bone Broth", about: "A thin, hot cup. Restores 35 hunger.", price: 14, heal: 20 },
  { id: "resin_jerky", name: "Resin Jerky", about: "Meat dried with heartroot. Restores 55 hunger.", price: 18, heal: 24 },
  { id: "pearl_salve", name: "Pearl Salve", about: "A tide pearl ground into a ward. Heals 30% and you take 20% less damage for 25s.", price: 0, heal: 80, buff: "ward" },
  { id: "spark_flask", name: "Spark Flask", about: "Heals 12% and +20% crit chance for 25s.", price: 0, heal: 20, buff: "crit" },
  { id: "spirit_lamp", name: "Spirit Lamp", about: "Heals 20%, mends your ghosts 20%, and your fire verses deal +22% damage for 25 seconds.", price: 0, heal: 40, buff: "fire" },
  { id: "green_mushroom", name: "Green Mushroom", about: "Hardcore, level 30+. Eat it and wake in a fresh Green Cave. Black market only.", price: 400 },
];

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

/** Material a random foe of this element is likely to drop. */
export const ENEMY_MATS: Partial<Record<TypeId, string>> = {
  fire: "cinder_ash",
  water: "tide_pearl",
  earth: "resin",
  air: "beast_fang",
  electric: "spark_core",
  ice: "frost_crystal",
  void: "veil_dust",
  spirit: "spirit_ash",
  light: "lantern_mote",
  ghoul: "bone_shard",
  normal: "beast_fang",
};

/** Extra pocket scrap any foe can drop, on top of its element material. */
export const SCRAP_LOOT = ["bone_shard", "beast_fang", "resin", "veil_dust", "cinder_ash", "spirit_ash"] as const;

export type AlchemyRecipe = {
  id: string;
  name: string;
  about: string;
  costs: Record<string, number>;
  output: string;
  n: number;
};

export const ALCHEMY_RECIPES: AlchemyRecipe[] = [
  { id: "warmth", name: "Warmth Tonic", about: "Spore and embercap. Heals, and favors fire.", costs: { dreamspore: 1, embercap: 1 }, output: "warmth_tonic", n: 1 },
  { id: "ward", name: "Ironroot Phial", about: "Root and a shroom. A bark ward.", costs: { ironroot: 1, mushroom: 1 }, output: "ironroot_phial", n: 1 },
  { id: "eye", name: "Cat's Eye Draught", about: "Spore and a blue lantern. Crits come easier.", costs: { dreamspore: 1, blue_lantern: 1 }, output: "cats_eye", n: 1 },
  { id: "potion", name: "Potion", about: "Two shrooms and an embercap. A modest mend.", costs: { mushroom: 2, embercap: 1 }, output: "potion", n: 1 },
  { id: "big", name: "Big Potion", about: "The long brew. Two roots, a spore, a lantern.", costs: { ironroot: 2, dreamspore: 1, blue_lantern: 1 }, output: "big_potion", n: 1 },
  { id: "candy", name: "Spirit Candy", about: "Spore, shroom, and lantern light. A rush of spirit.", costs: { dreamspore: 1, mushroom: 1, blue_lantern: 1 }, output: "spirit_candy", n: 1 },
  { id: "ash_tonic", name: "Ash Tonic", about: "Cinder ash and an embercap. The same fire as a warmth tonic.", costs: { cinder_ash: 1, embercap: 1 }, output: "warmth_tonic", n: 1 },
  { id: "pearl", name: "Pearl Salve", about: "A tide pearl and ironroot. A heavy mend and a bark ward.", costs: { tide_pearl: 1, ironroot: 1 }, output: "pearl_salve", n: 1 },
  { id: "fang", name: "Fang Draught", about: "A beast fang and dreamspore. Crits come easier.", costs: { beast_fang: 1, dreamspore: 1 }, output: "cats_eye", n: 1 },
  { id: "spark", name: "Spark Flask", about: "A spark core and a blue lantern.", costs: { spark_core: 1, blue_lantern: 1 }, output: "spark_flask", n: 1 },
  { id: "rime", name: "Rime Phial", about: "Frost crystal and ironroot. Another bark ward.", costs: { frost_crystal: 1, ironroot: 1 }, output: "ironroot_phial", n: 1 },
  { id: "veil", name: "Veil Candy", about: "Veil dust, spore and a shroom. Two pieces of spirit candy.", costs: { veil_dust: 1, dreamspore: 1, mushroom: 1 }, output: "spirit_candy", n: 2 },
  { id: "lamp", name: "Spirit Lamp", about: "Spirit ash in lantern light. Heals, and favors fire.", costs: { spirit_ash: 1, blue_lantern: 1 }, output: "spirit_lamp", n: 1 },
  { id: "mote", name: "Lantern Oil", about: "A lantern mote and an embercap. A warmth tonic.", costs: { lantern_mote: 1, embercap: 1 }, output: "warmth_tonic", n: 1 },
  { id: "bone", name: "Bone Tincture", about: "Two bone shards and a shroom. Two modest potions.", costs: { bone_shard: 2, mushroom: 1 }, output: "potion", n: 2 },
  { id: "resin", name: "Resin Balm", about: "Resin, a shroom and an embercap. A modest potion.", costs: { resin: 1, mushroom: 1, embercap: 1 }, output: "potion", n: 1 },
];

export type QuestDef = {
  id: string;
  name: string;
  about: string;
  giver: string;
  chapter: string;
  rewardKyo: number;
  rewardItems?: Record<string, number>;
};

export const QUESTS: QuestDef[] = [
  { id: "first_steps", name: "First Steps", about: "Win 3 fights anywhere.", giver: "Miret", chapter: "I · The Hearth", rewardKyo: 40, rewardItems: { potion: 2, ghost_jar: 2 } },
  { id: "keeper_lanterns", name: "Keeper's Lanterns", about: "Catch a Light spirit and a Fire spirit.", giver: "Keel", chapter: "II · Two Flames", rewardKyo: 70, rewardItems: { lantern_jar: 0, blue_lantern: 2, big_potion: 1 } },
  { id: "marsh_walk", name: "Marsh Walk", about: "Walk into Tide land (coast and marsh), then catch a Water spirit.", giver: "Bram", chapter: "III · Salt Road", rewardKyo: 60, rewardItems: { ghost_jar: 3 } },
  { id: "ember_hunt", name: "Ember Hunt", about: "Catch two Fire spirits while standing in Ashen land (scorched ground and lava).", giver: "Vey", chapter: "IV · Cinder Yard", rewardKyo: 80, rewardItems: { potion: 3, embercap: 2 } },
  { id: "salt_run", name: "Salt Run", about: "Bring 2 Cleanse Salt to Quartermaster Holt (Turn in salt).", giver: "Holt", chapter: "V · The Tithe", rewardKyo: 90, rewardItems: { big_potion: 1 } },
  { id: "bone_patrol", name: "Bone Patrol", about: "Lay down 2 skeletons inside the Tiny Crypt.", giver: "Wren", chapter: "VI · The Door", rewardKyo: 100, rewardItems: { spirit_candy: 2 } },
  { id: "bone_king", name: "The Bone King", about: "Enter the Tiny Crypt and break the Bone King in its last room.", giver: "Keel", chapter: "VII · The Lid", rewardKyo: 180, rewardItems: { big_potion: 2, ghost_jar: 2 } },
];

export type NpcDef = {
  id: string;
  name: string;
  role: string;
  female: boolean;
  outfit: number;
  hair: number;
  lines: string[];
  shop?: "general" | "armor" | "fence" | "alchemy" | "cook";
  shrine?: TypeId;
  map: MapId;
  tx: number;
  ty: number;
};

export const NPCS: NpcDef[] = [
  { id: "miret", name: "Caretaker Miret", role: "Hearth keeper", female: true, outfit: 0, hair: 3, map: "world", tx: 30, ty: 31, lines: ["THE HEARTH IS YOURS. SKILLS STAY WHEN THE VEIL TAKES THE REST.", "WIN THREE FIGHTS. THEN WE TALK ABOUT THE DOOR.", "EVERY LIFE WAKES IN A NEW LAND. THE HEARTH FINDS YOU ANYWAY."] },
  { id: "vey", name: "Captain Vey", role: "Hearth guard", female: false, outfit: 1, hair: 1, map: "world", tx: 26, ty: 28, lines: ["FIRE SPIRITS RUN HOT ON ASHEN GROUND. CATCH ME TWO THERE.", "IF YOU HUNT, HUNT CLEAN. BRING ME COUNTS, NOT STORIES.", "HOLT THINKS A DEBT IS PAID IN BONE. HE IS NOT ALWAYS WRONG."] },
  { id: "orien", name: "Scribe Orien", role: "Ledger scribe", female: true, outfit: 2, hair: 0, map: "world", tx: 34, ty: 28, lines: ["EVERY ARMOR PIECE ROLLS ITS OWN TYPE. MATCH IT TO THE MOVE.", "A FULL SET IS NOT FASHION. IT IS A WEATHER EVENT.", "I CAN TEACH A VERSE, IF YOU HAVE KYO."] },
  { id: "holt", name: "Quartermaster Holt", role: "Stores", female: false, outfit: 3, hair: 2, map: "world", tx: 32, ty: 34, shop: "general", lines: ["POTIONS, JARS, SALT. THE WALLS DO NOT STOCK THEMSELVES.", "BRING ME SALT IF THE LEDGER ASKS. TWO PINCHES."] },
  { id: "lise", name: "Spore Broker Lise", role: "Alchemist", female: true, outfit: 4, hair: 4, map: "world", tx: 23, ty: 33, shop: "alchemy", lines: ["DREAMSPORE AND EMBERCAP. THAT IS A WARMTH TONIC.", "IRONROOT MAKES A WARD. I JUST HOLD THE FLAME."] },
  { id: "bram", name: "Fisher Bram", role: "Tide runner", female: false, outfit: 5, hair: 2, map: "world", tx: 63, ty: 34, lines: ["ANY WATER IS A FISHING SPOT IF YOU RESPECT IT.", "CATCH ME SOMETHING THAT DRINKS. A WATER SPIRIT.", "BRING ME A RAW FISH AND I WILL COOK IT. RAW IS A RUMOR, NOT A MEAL."] },
  { id: "ada", name: "Sister Ada", role: "Light shrine sister", female: true, outfit: 0, hair: 4, map: "world", tx: 28, ty: 26, shrine: "light", lines: ["THE CHANCEL SHRINE IS A RING. THREE ROUNDS, EACH SAINT LOUDER.", "THE SHRINE WILL TEST YOU. OUTSIDE HARDCORE IT MENDS YOU BETWEEN ROUNDS.", "LIGHT IS A WEAPON HERE. DO NOT APOLOGIZE FOR IT."] },
  { id: "brask", name: "Warden Brask", role: "Shrine warden", female: false, outfit: 1, hair: 0, map: "world", tx: 36, ty: 33, lines: ["I WILL WALK YOU INTO A FIGHT AND CALL IT SETTLED.", "WORLD BOSSES DO NOT WAIT ON YOUR STORY. THEY RISE ANYWAY.", "IF YOU DIE, YOUR SKILLS AND YOUR GHOSTS STAY. THE VEIL IS GREEDY, NOT THOROUGH."] },
  { id: "wren", name: "Digger Wren", role: "Barrow digger", female: true, outfit: 6, hair: 1, map: "world", tx: 40, ty: 44, lines: ["PEOPLE WENT IN FOR THE OLD PAY CHEST AND DID NOT COME OUT.", "KEEL WILL LET THEM STAY DOWN THERE. I WILL NOT.", "THE TINY CRYPT IS ON YOUR MAP. TWO SKELETONS, THEN THE KING IN THE LAST ROOM."] },
  { id: "keel", name: "Priest Keel", role: "Barrow priest", female: false, outfit: 7, hair: 3, map: "world", tx: 37, ty: 42, lines: ["THE BARROW IS NOT A HOLE. IT IS A DOOR.", "IF YOU OPEN IT, YOU OWN WHAT COMES OUT.", "CATCH A LIGHT AND A FIRE BEFORE YOU CALL YOURSELF READY."] },
  { id: "pike", name: "Quiet Pike", role: "Fence", female: false, outfit: 5, hair: 1, map: "world", tx: 22, ty: 40, shop: "fence", lines: ["I BUY ROLLS. I SELL ROLLS. I DO NOT BUY STORIES.", "TYPE ON THE PIECE IS HALF THE BUILD. READ IT."] },
  { id: "nessa", name: "Peddler Nessa", role: "Ash peddler", female: true, outfit: 4, hair: 2, map: "world", tx: 22, ty: 50, shop: "armor", lines: ["THE KILN DROPS BETTER THAN I DO. I AM JUST CLOSER.", "FULL SETS CHANGE THE AIR. YOU WILL FEEL IT IN YOUR TEETH."] },
  { id: "moss", name: "Sister Moss", role: "Hollow shrine", female: true, outfit: 0, hair: 3, map: "world", tx: 42, ty: 14, shrine: "earth", lines: ["THE HOLLOW SHRINE. EARTH ANSWERS IF YOU BLEED A LITTLE.", "THREE ROUNDS. EACH SAINT IS LOUDER."] },
  { id: "brine", name: "Cantor Brine", role: "Tide shrine", female: false, outfit: 2, hair: 2, map: "world", tx: 70, ty: 36, shrine: "water", lines: ["STAND IN THE RING. THE TIDE KEEPS SCORE.", "SOAK THEM. THEN ASK THE WATER FOR MORE."] },
  { id: "sleet", name: "Warden Sleet", role: "Frost shrine", female: true, outfit: 6, hair: 4, map: "world", tx: 66, ty: 12, shrine: "ice", lines: ["THE MARCH SHRINE DOES NOT MELT FOR PLEADING.", "WHITEOUT IS A KINDNESS COMPARED TO THE BOSS OUT THERE."] },
  { id: "cinderkin", name: "Ash Cantor Vesper", role: "Kiln shrine", female: true, outfit: 4, hair: 1, map: "world", tx: 16, ty: 52, shrine: "fire", lines: ["FIRE SHRINE. YOU WILL LEAVE WITH A BURN OR A RELIC.", "THE ASH REGENT SLEEPS IN THE KILN, NOT IN THIS RING."] },
];

export type Poi =
  | { kind: "npc"; id: string }
  | { kind: "shrine"; id: string; type: TypeId; tx: number; ty: number; name: string }
  | { kind: "dungeon"; id: "crypt" | "kiln"; tx: number; ty: number; name: string }
  | { kind: "boss"; id: string; name: string; type: TypeId; template: number; tx: number; ty: number; level: number }
  | { kind: "node"; id: string; node: "ore" | "tree" | "shroom" | "fish"; tx: number; ty: number }
  | { kind: "hearth"; tx: number; ty: number };

/**
 * Starting positions for resource nodes (design-grid coordinates, scaled like every other POI).
 * These are no longer POIs: they are copied into `world.spawns` when the world is built so
 * they can be destroyed when harvested and respawned somewhere else. Fishing has no nodes at all:
 * every water tile is a fishing spot.
 */
export const NODE_STARTS: { id: string; node: "ore" | "tree" | "shroom"; tx: number; ty: number }[] = [
  { id: "ore1", node: "ore", tx: 24, ty: 36 },
  { id: "ore2", node: "ore", tx: 48, ty: 22 },
  { id: "ore3", node: "ore", tx: 12, ty: 18 },
  { id: "tree1", node: "tree", tx: 38, ty: 18 },
  { id: "tree2", node: "tree", tx: 46, ty: 12 },
  { id: "tree3", node: "tree", tx: 20, ty: 46 },
  { id: "sh1", node: "shroom", tx: 36, ty: 12 },
  { id: "sh2", node: "shroom", tx: 50, ty: 20 },
  { id: "sh3", node: "shroom", tx: 14, ty: 48 },
];

/** Seconds after a node is harvested before a replacement appears somewhere else. */
export const NODE_RESPAWN_SECONDS: Record<"ore" | "tree" | "shroom", number> = { tree: 15, ore: 25, shroom: 20 };

/** Fishing: seconds until a bite with no fishing perks (random in this range). */
export const FISH_BITE_MIN = 1;
export const FISH_BITE_MAX = 10;

export const POIS: Poi[] = [
  ...NPCS.map((n) => ({ kind: "npc" as const, id: n.id })),
  { kind: "shrine", id: "sh_light", type: "light", tx: 28, ty: 25, name: "Chancel Shrine" },
  { kind: "shrine", id: "sh_earth", type: "earth", tx: 44, ty: 16, name: "Hollow Shrine" },
  { kind: "shrine", id: "sh_water", type: "water", tx: 72, ty: 38, name: "Tide Shrine" },
  { kind: "shrine", id: "sh_ice", type: "ice", tx: 68, ty: 10, name: "March Shrine" },
  { kind: "shrine", id: "sh_fire", type: "fire", tx: 14, ty: 54, name: "Kiln Shrine" },
  { kind: "dungeon", id: "crypt", tx: 41, ty: 46, name: "Tiny Crypt" },
  { kind: "dungeon", id: "kiln", tx: 18, ty: 54, name: "Ash Kiln" },
  { kind: "boss", id: "tide_tyrant", name: "Tide Tyrant", type: "water", template: 5, tx: 74, ty: 30, level: 14 },
  { kind: "boss", id: "void_cantor", name: "Void Cantor", type: "void", template: 19, tx: 10, ty: 8, level: 16 },
  { kind: "boss", id: "marrow_saint", name: "Marrow Saint", type: "light", template: 24, tx: 58, ty: 8, level: 15 },
  { kind: "hearth", tx: 30, ty: 33 },
];

export const STARTER_MOVES: Record<RaceId, string[]> = {
  vesper: ["lantern", "dirge", "measured", "veilstep"],
  cinder: ["wail", "ember", "measured", "pyrelunge"],
  tide: ["foam", "tide", "measured", "tidemend"],
  thorn: ["spore", "quake", "measured", "briaroll"],
  rime: ["shard", "whiteout", "measured", "icecrown"],
};

/** Legacy starter selection for saved characters predating playable classes. */
export function rollInnate(rng: Rng): string[] {
  const must = ["measured", "halo", "roll"];
  const bag = MOVES.filter((m) => !must.includes(m.id));
  const out = [...must];
  while (out.length < 4 && bag.length) {
    const i = irand(rng, bag.length);
    out.push(bag.splice(i, 1)[0]!.id);
  }
  return out;
}

export function packMoves(rng: Rng, type: TypeId, n: number): string[] {
  const prefer = MOVES.filter((m) => m.type === type);
  const rest = MOVES.filter((m) => m.type !== type);
  const bag = [...prefer, ...rest];
  const out: string[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < n && bag.length && guard < 40) {
    guard += 1;
    const i = irand(rng, Math.min(bag.length, Math.max(6, prefer.length + 2)));
    const m = bag.splice(i, 1)[0];
    if (!m || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m.id);
  }
  return out.length ? out : ["measured"];
}

export function ensureGearMoves(g: Gear): string[] {
  if (g.moves?.length) return g.moves;
  const rng = mulberry32((g.fxSeed + 3) * 997 + g.level * 17 + g.style * 13);
  const n = g.quality === "rare" || g.quality === "epic" || g.quality === "legendary" ? 2 : 1;
  g.moves = packMoves(rng, g.type, n);
  return g.moves;
}

/** Ethereal hides shrug steel. Solid hides shrug hymns. */
export function bodyRead(type: TypeId): { kind: "magic" | "physical"; line: string } {
  const ethereal = type === "spirit" || type === "void" || type === "air" || type === "electric" || type === "light";
  if (ethereal) return { kind: "magic", line: "Ethereal hide. Magic lands cleaner than steel." };
  return { kind: "physical", line: "Solid hide. Physical cuts deeper than hymns." };
}

const COMPANION_IDS = new Set(["miret", "wren", "brask", "vey", "brine", "sleet", "ada"]);

export function npcOffers(n: NpcDef): ("Trade" | "Quest" | "Companionship")[] {
  const offers: ("Trade" | "Quest" | "Companionship")[] = [];
  if (n.shop) offers.push("Trade");
  const last = n.name.split(" ").slice(-1)[0]!.toLowerCase();
  if (n.shrine || QUESTS.some((q) => q.giver.toLowerCase().includes(last))) offers.push("Quest");
  if (COMPANION_IDS.has(n.id)) offers.push("Companionship");
  return offers;
}

export function accountNeed(level: number): number {
  const lv = Math.max(1, Math.floor(level) || 1);
  // Levels 1–40 stay on the old curve. Past that the cost grows in a straight line so it cannot explode.
  const early = 140 * Math.pow(1.32, Math.min(lv - 1, 39));
  const tail = 1 + Math.max(0, lv - 40) * 0.06;
  const need = Math.floor(early * tail);
  return Number.isFinite(need) ? Math.max(1, need) : Number.MAX_SAFE_INTEGER;
}

export function learnPool(level: number, race: RaceId): string[] {
  const type = RACES.find((r) => r.id === race)!.type;
  const all = MOVES.filter((m) => m.power <= 22 + level * 2.2 || m.type === type || m.type === "normal");
  return all.map((m) => m.id);
}

export { CLASSES, CLASS_BY_ID, CLASS_RACE, LEGACY_CLASS, type ClassId } from "./classes";

export type GemId = string;
export type Enchant = { id: string; name: string; effect: string; value?: number };
export type Gem = { id: GemId; moveId: string; name: string; type: TypeId; quality: QualityId; enchantments: Enchant[]; unlocked: boolean };
export const MAX_GEMS = 5;
export const MAX_ENCHANTS_PER_GEM = 10;
export const SKILL_POINTS_PER_LEVEL = 3;
export function gemUnlockCost(quality: QualityId): number {
  return ({ worn: 1, common: 2, fine: 3, rare: 5, epic: 8, legendary: 12 } as Record<QualityId, number>)[quality] ?? 2;
}
export function makeGem(moveId: string, quality: QualityId = "common", enchants: Enchant[] = []): Gem {
  const m = MOVE_BY_ID[moveId];
  if (!m) throw new Error("unknown move " + moveId);
  return { id: `gem_${moveId}_${Math.random().toString(36).slice(2, 8)}`, moveId, name: m.name, type: m.type, quality, enchantments: enchants.slice(0, MAX_ENCHANTS_PER_GEM), unlocked: false };
}
export function allSpellGems() {
  return MOVES.map(m => ({ moveId: m.id, name: m.name, type: m.type, effect: m.effect, about: m.about }));
}
