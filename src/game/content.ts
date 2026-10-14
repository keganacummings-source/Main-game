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

/** POIs were laid out on the old 84×60 chart. The live map stretches them. */
export function scaleTile(tx: number, ty: number): { tx: number; ty: number } {
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
};

export type Tactic = "strike" | "blink" | "ward" | "lunge" | "heavy" | "channel" | "heal" | "roll" | "dash" | "surge";

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
  if (tactic === "ward") return "guard";
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
  { id: "soulmend", name: "Soul Mend", type: "spirit", power: 34, accuracy: 100, crit: 0, priority: 2, effect: "mend", anim: ["orbit", "shield"], range: 40, about: "Soulmender signature. Borrowed spirits knit your wounds.", tactic: "heal", react: "heal" },
  { id: "shadowstrike", name: "Shadow Strike", type: "void", power: 34, accuracy: 96, crit: 30, priority: 3, effect: "expose", anim: ["orbit", "slash", "burst"], range: 170, about: "Nightblade signature. Blink behind them and open the guard.", tactic: "blink", react: "move", fail: 18 },
  { id: "piercingvolley", name: "Piercing Volley", type: "air", power: 46, accuracy: 94, crit: 14, priority: 1, effect: "expose", anim: ["beam", "slash"], range: 190, about: "Pathfinder signature. Arrows that punch through armor.", tactic: "strike", form: "ranged" },
  { id: "hundredpalm", name: "Hundred Palm", type: "normal", power: 52, accuracy: 96, crit: 14, priority: 2, effect: "none", anim: ["slash", "burst", "slash"], range: 48, about: "Ironpalm signature. A blur of open-hand strikes.", tactic: "strike", form: "melee" },
  { id: "rampage", name: "Rampage", type: "fire", power: 82, accuracy: 80, crit: 14, priority: 0, effect: "burn", anim: ["burst", "spark", "slash"], range: 60, about: "Bloodrager signature. An unhinged overhead that sets them alight.", tactic: "heavy" },
  { id: "soulreap", name: "Soul Reap", type: "ghoul", power: 70, accuracy: 86, crit: 10, priority: 0, effect: "leech", anim: ["slash", "orbit", "burst"], range: 60, about: "Dreadknight signature. A scything blow that drinks deep.", tactic: "heavy" },
  { id: "glaciercharge", name: "Glacier Charge", type: "ice", power: 40, accuracy: 92, crit: 14, priority: 1, effect: "root", anim: ["prism", "slash"], range: 150, about: "Frostguard signature. Charge in and freeze their feet.", tactic: "lunge", react: "move", fail: 18 },
  { id: "inferno", name: "Inferno", type: "fire", power: 76, accuracy: 86, crit: 10, priority: 0, effect: "burn", anim: ["burst", "spark", "pulse"], range: 160, about: "Emberheart signature. Become the fire for a heartbeat.", tactic: "channel" },
  { id: "maelstrom", name: "Maelstrom", type: "water", power: 68, accuracy: 88, crit: 8, priority: 0, effect: "soak", anim: ["rain", "spiral", "pulse"], range: 160, about: "Tideshaper signature. A whirlpool that drowns their stride.", tactic: "channel" },
  { id: "cyclone", name: "Cyclone", type: "air", power: 50, accuracy: 94, crit: 14, priority: 2, effect: "none", anim: ["spiral", "slash", "spiral"], range: 150, about: "Galeborn signature. A fast tearing wind.", tactic: "strike", form: "ranged" },
  { id: "tectonic", name: "Tectonic Slam", type: "earth", power: 86, accuracy: 78, crit: 8, priority: 0, effect: "root", anim: ["pulse", "burst"], range: 70, about: "Earthshaker signature. The ground breaks under them.", tactic: "heavy" },
  { id: "sunburst", name: "Sunburst", type: "light", power: 70, accuracy: 90, crit: 12, priority: 0, effect: "expose", anim: ["prism", "burst", "beam"], range: 160, about: "Radiant signature. A noon that burns through shadow.", tactic: "channel" },
  { id: "abyssrift", name: "Abyss Rift", type: "void", power: 74, accuracy: 86, crit: 14, priority: 0, effect: "gloom", anim: ["orbit", "pulse", "burst"], range: 170, about: "Umbral signature. Tear a hole and let it stare.", tactic: "channel" },
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
];

export const MOVE_BY_ID: Record<string, Move> = Object.fromEntries(MOVES.map((m) => [m.id, m]));

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

export function attackForm(m: Move): AttackForm {
  if (m.form) return m.form;
  const tactic = moveTactic(m);
  if (tactic === "dash" || tactic === "surge") return "melee";
  if (tactic === "channel" || tactic === "heal" || tactic === "ward") return "spell";
  if (tactic === "blink" || tactic === "lunge" || tactic === "heavy" || tactic === "roll") return "melee";
  if (m.effect === "mend" || m.effect === "shell") return "spell";
  if (MELEE_IDS.has(m.id)) return "melee";
  if (SPELL_IDS.has(m.id)) return "spell";
  return "ranged";
}

/** Melee is short. Blinks, lunges, and spells reach across a street. */
export function attackRange(m: Move): number {
  const tactic = moveTactic(m);
  if (tactic === "dash" || tactic === "surge") return 40;
  if (tactic === "blink" || tactic === "lunge") return Math.max(150, m.range);
  if (tactic === "channel" || tactic === "ward" || tactic === "heal" || tactic === "roll") return Math.max(tactic === "roll" ? 80 : 40, m.range);
  const form = attackForm(m);
  if (form === "melee") return 44;
  if (form === "spell") return Math.max(156, m.range);
  const style = rangedStyle(m);
  return Math.max(150, m.range) + (style === "reach" ? 48 : 0);
}

export function rangedStyle(m: Move): "volley" | "reload" | "reach" {
  let n = 0;
  for (const c of m.id) n += c.charCodeAt(0);
  return (["volley", "reload", "reach"] as const)[n % 3]!;
}

export function formTag(m: Move): string {
  const form = attackForm(m);
  if (form === "melee") return "melee · cuts armor";
  if (form === "spell") return "spell · pure";
  const style = rangedStyle(m);
  if (style === "volley") return "ranged · volley";
  if (style === "reload") return "ranged · fast";
  return "ranged · long";
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
  gear: (power: number) => string;
  perk?: { step: number; max: number; each: string };
};

export const ENCHANTS: EnchantDef[] = [
  { id: "double_strike", name: "Double Strike", max: 18, unit: "%", tag: "weapon", gear: (n) => `${n}% chance this piece makes the hit land a second time. All Double Strike together cannot rise above 85%.`, perk: { step: 1, max: 12, each: "+1% chance that an attack or spell hits a second time (the total chance cannot rise above 85%)" } },
  { id: "second_chance", name: "Second Chance", max: 1, unit: "flat", tag: "armor", gear: () => "Once per life, a killing blow leaves you at 1 health instead of dying.", perk: { step: 1, max: 1, each: "one survival at 1 health instead of dying, once per life" } },
  { id: "loot_find", name: "Loot Find", max: 30, unit: "%", gear: (n) => `+${(n / 2).toFixed(1)}% gear drop chance (Loot Find ${n} ÷ 200).`, perk: { step: 1, max: 20, each: "+0.5% chance that a fallen foe drops gear (1 Loot Find ÷ 200)" } },
  { id: "xp_boost", name: "XP Boost", max: 30, unit: "%", gear: (n) => `+${n}% battle experience.`, perk: { step: 1, max: 20, each: "+1% experience from fights" } },
  { id: "catch_boost", name: "Catch Boost", max: 30, unit: "%", gear: (n) => `+${(n / 2.2).toFixed(1)}% chance a fallen foe stays as a spirit (Catch Boost ${n} ÷ 220).`, perk: { step: 1, max: 20, each: "+0.45% chance a fallen foe stays as a spirit (1 Catch Boost ÷ 220)" } },
  { id: "kyo_find", name: "Kyo Magnet", max: 30, unit: "%", gear: (n) => `+${n}% kyo from fights.`, perk: { step: 1, max: 20, each: "+1% kyo dropped by foes" } },
  { id: "ward", name: "Ward", max: 24, unit: "%", tag: "armor", gear: (n) => `Damage taken is reduced by Ward÷160. This piece is ${n}, which is ${(n / 1.6).toFixed(1)}% less damage on its own. The reduction from all Ward cannot rise above 45%.`, perk: { step: 1, max: 16, each: "0.625% less damage taken (Ward ÷ 160, and the reduction cannot rise above 45%)" } },
  { id: "might", name: "Might", max: 24, unit: "%", tag: "weapon", gear: (n) => `+${n}% damage on every attack and spell.`, perk: { step: 1, max: 20, each: "+1% damage on every attack and spell" } },
  { id: "swift", name: "Swift", max: 20, unit: "%", gear: (n) => `Cooldowns are ${n}% shorter from this piece (the shortening cannot rise above 40%). Also adds ${Math.floor(n / 8)} turn-speed (1 per 8 Swift).`, perk: { step: 1, max: 16, each: "1% shorter cooldowns (cannot shorten by more than 40%) and 1 turn-speed per 8 Swift" } },
  { id: "harvest", name: "Harvest", max: 30, unit: "%", gear: (n) => `+${n}% ore, timber, and mushrooms from nodes.`, perk: { step: 1, max: 20, each: "+1% ore, timber, and mushrooms from every node" } },
  { id: "fish_luck", name: "Fish Luck", max: 30, unit: "%", gear: (n) => `Bites come ${n}% sooner from this piece. All Fish Luck together cannot make bites more than 75% sooner.`, perk: { step: 1, max: 20, each: "1% sooner bites (all Fish Luck together cannot pass 75% sooner)" } },
  { id: "shop_charm", name: "Shop Charm", max: 28, unit: "%", gear: (n) => `Shop prices are about ${(n / 1.4).toFixed(1)}% lower (Shop Charm ${n} ÷ 140).`, perk: { step: 1, max: 20, each: "about 0.7% off every shop price (Shop Charm ÷ 140)" } },
  { id: "sell_boost", name: "Merchant Tongue", max: 28, unit: "%", gear: (n) => `+${n}% kyo when you sell gear or materials.`, perk: { step: 1, max: 20, each: "+1% kyo when you sell gear or materials" } },
  { id: "crit_edge", name: "Crit Edge", max: 16, unit: "%", tag: "weapon", gear: (n) => `+${n}% critical chance.`, perk: { step: 1, max: 12, each: "+1% critical chance" } },
  { id: "regen", name: "Afterglow", max: 20, unit: "flat", tag: "armor", gear: (n) => `Restore ${ (n * 0.4).toFixed(1) } health when a foe falls (Afterglow ${n} × 0.4).`, perk: { step: 1, max: 16, each: "+0.4 health whenever a foe falls" } },
  { id: "boss_bane", name: "Boss Bane", max: 28, unit: "%", tag: "weapon", gear: (n) => `+${n}% damage to bosses.`, perk: { step: 1, max: 20, each: "+1% damage to bosses" } },
  { id: "shroom_sense", name: "Shroom Sense", max: 30, unit: "%", gear: (n) => n >= 20 ? `Shroom Sense ${n}. At 20 or more, mushroom nodes drop one extra reagent.` : `Shroom Sense ${n}. At 20 or more, mushroom nodes drop one extra reagent. This piece is not there yet.`, perk: { step: 1, max: 24, each: "1 Shroom Sense. At 20 total, mushroom nodes drop one extra reagent" } },
  { id: "echo_guard", name: "Echo Guard", max: 12, unit: "%", tag: "armor", gear: (n) => `${n}% chance to ignore an entire hit. All Echo Guard together cannot rise above 40%.`, perk: { step: 1, max: 10, each: "+1% chance to ignore an entire hit (the chance cannot rise above 40%)" } },
  { id: "spark_life", name: "Spark of Life", max: 40, unit: "flat", tag: "armor", gear: (n) => `+${n} maximum health.`, perk: { step: 2, max: 40, each: "+2 maximum health" } },
  { id: "type_edge", name: "Typed Edge", max: 16, unit: "%", tag: "weapon", gear: (n) => `+${n}% damage when the attack type matches a worn piece (Typed Edge is added as a fraction: ${n} ÷ 100).`, perk: { step: 1, max: 12, each: "+1% damage when your attack type matches a piece you are wearing" } },
  { id: "whetstone", name: "Whetstone", max: 220, unit: "flat", tag: "weapon", gear: (n) => `+${n} weapon damage, before level and skill multipliers.` },
  { id: "spellweave", name: "Spellweave", max: 22, unit: "%", tag: "weapon", gear: (n) => `+${n}% spell damage.` },
  { id: "edge", name: "Keen Edge", max: 18, unit: "%", tag: "weapon", gear: (n) => `+${n}% melee damage.` },
  { id: "hunter_eye", name: "Hunter's Eye", max: 18, unit: "%", tag: "weapon", gear: (n) => `+${n}% ranged damage.` },
  { id: "hymn", name: "Hymn", max: 18, unit: "%", tag: "weapon", gear: (n) => `+${n}% spell damage, stacking with Spellweave.` },
  { id: "execute", name: "Execute", max: 20, unit: "%", tag: "weapon", gear: (n) => `+${n}% damage to foes under 35% health.` },
  { id: "giant_bane", name: "Giant Bane", max: 20, unit: "%", tag: "weapon", gear: (n) => `+${n}% damage to foes above your level.` },
  { id: "last_stand", name: "Last Stand", max: 18, unit: "%", tag: "armor", gear: (n) => `+${n}% damage while you are under 40% health.` },
  { id: "crit_force", name: "Crit Force", max: 18, unit: "%", tag: "weapon", gear: (n) => `Critical hits deal +${n}% extra damage. All Crit Force together cannot add more than 80%.` },
  { id: "leech_edge", name: "Leech", max: 8, unit: "%", tag: "weapon", gear: (n) => `Heal for ${n}% of the damage you deal.` },
  { id: "armor_crack", name: "Armor Crack", max: 80, unit: "flat", tag: "weapon", gear: (n) => `Ranged hits ignore ${n} armor.` },
  { id: "plating", name: "Plating", max: 160, unit: "flat", tag: "armor", gear: (n) => `+${n} armor.` },
  { id: "vitality", name: "Vitality", max: 280, unit: "flat", tag: "armor", gear: (n) => `+${n} maximum health.` },
  { id: "thorns", name: "Thorns", max: 10, unit: "%", tag: "armor", gear: (n) => `Return ${n}% of damage taken to the nearest foe. All Thorns together cannot return more than 35%.` },
  { id: "potion_sip", name: "Deep Sip", max: 16, unit: "%", tag: "relic", gear: (n) => `Potions restore ${n}% more health.` },
  { id: "swift_step", name: "Swift Step", max: 12, unit: "%", gear: (n) => `+${n}% movement speed. All Swift Step together cannot rise above 45%.` },
  { id: "focus", name: "Focus", max: 12, unit: "%", tag: "relic", gear: (n) => `Spell cooldowns are ${n}% shorter. All Focus together cannot shorten spells by more than 35%.` },
  { id: "fortune", name: "Fortune", max: 24, unit: "%", tag: "relic", gear: (n) => `+${(n / 2).toFixed(1)}% gear drop chance, stacking with Loot Find (Fortune ${n} ÷ 200).` },
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
  const now = Math.max(0, Math.min(perk.max, Math.floor(power)));
  const next = Math.min(perk.max, now + perk.step);
  const cap = now >= perk.max ? ` Maxed at ${perk.max}.` : ` Next point raises it by ${perk.step}, to ${next}/${perk.max}.`;
  return `Each point adds ${perk.each}. You have ${now}/${perk.max}.${cap} Kept on the account through death, a new witch, and Hardcore. Stacks with ${def.name} on gear.`;
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
export type Gear = {
  uid: string;
  slot: Slot;
  setId: string | null;
  style: number;
  name: string;
  level: number;
  quality: QualityId;
  type: TypeId;
  enchants: EnchantRoll[];
  fxSeed: number;
  price: number;
  /** Retained for compatibility with old equipment files; abilities belong to the character. */
  moves: string[];
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
  const enchants = rollEnchants(rng, slot, opts.level, quality.id, opts.luck ?? 0);
  const level = stretchGearLevel(opts.level, quality.id, opts.luck ?? 0);
  const gear: Gear = {
    uid: nextUid(),
    slot,
    setId,
    style,
    name: slot === "weapon" ? `${quality.name} ${TYPES[type].name} ${title}` : `${quality.name} ${TYPES[type].name} ${title} ${SLOT_NOUN[slot]}`,
    level,
    quality: quality.id,
    type,
    enchants,
    fxSeed: irand(rng, 6),
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

/** Rarity stretches a drop toward the 1–1000 gear band. A level-400 legendary can reach 1000. */
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

function rollEnchants(rng: Rng, slot: Slot, sourceLevel: number, quality: QualityId, luck: number): EnchantRoll[] {
  const level = stretchGearLevel(sourceLevel, quality, luck);
  const n = enchantCountFor(rng, level, quality);
  const qIndex = Math.max(0, QUALITIES.findIndex((x) => x.id === quality));
  const prefer = slot === "weapon" ? "weapon" : slot === "relic" ? "relic" : "armor";
  const front = ENCHANTS.filter((e) => !e.tag || e.tag === prefer);
  const back = ENCHANTS.filter((e) => e.tag && e.tag !== prefer);
  const bag = [...front, ...back];
  const picked: EnchantRoll[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (picked.length < n && bag.length && guard < 80) {
    guard += 1;
    const span = picked.length < Math.ceil(n * 0.75) ? Math.max(1, Math.ceil(bag.length * 0.7)) : bag.length;
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
] as const;

export type SkillId = (typeof SKILLS)[number]["id"];

export function skillNeed(level: number): number {
  const lv = Math.max(1, Math.min(MAX_SKILL_LEVEL, level));
  const early = 40 * Math.pow(1.12, Math.min(lv - 1, 30));
  const tail = 1 + Math.max(0, lv - 30) * 0.035;
  return Math.max(20, Math.floor(early * tail));
}

export function xpNeed(level: number): number {
  const lv = Math.max(1, Math.min(MAX_CHARACTER_LEVEL, level));
  const early = 30 * Math.pow(1.17, Math.min(lv - 1, 20));
  const tail = 1 + Math.max(0, lv - 20) * 0.055;
  return Math.max(20, Math.floor(early * tail));
}

export function skillLine(id: SkillId, level: number): string {
  const lv = Math.max(1, Math.min(MAX_SKILL_LEVEL, Math.floor(level || 1)));
  const n = lv - 1;
  switch (id) {
    case "mining":
    case "woodcutting":
      return `+${(n * 0.3).toFixed(1)}% materials from each node. 0.3% per level, no cap, up to level 400.`;
    case "hunting":
      return `+${(n * 0.2).toFixed(1)}% damage against wild foes. 0.2% per level, no cap.`;
    case "catching":
      return `+${(n * 0.12).toFixed(1)}% chance a fallen foe stays as a spirit. 0.12% per level.`;
    case "trading":
      return `Sell prices +${(n * 0.2).toFixed(1)}%. Shops charge ${Math.max(50, 100 - n * 0.125).toFixed(1)}% of the list price. 0.2% sell and 0.125% off per level. Shops never go below 50%.`;
    case "fishing":
      return `Bites come ${Math.min(70, n * 0.175).toFixed(1)}% sooner. 0.175% per level, cap 70%.`;
    case "social":
      return `Quest kyo +${(n * 0.15).toFixed(1)}%. 0.15% per level.`;
    case "shroom":
      return `${Math.min(80, n * 0.2).toFixed(1)}% chance a patch drops one extra reagent. 0.2% per level, cap 80%.`;
    case "alchemy":
      return `${Math.min(50, n * 0.125).toFixed(1)}% chance to brew a second dose. 0.125% per level, cap 50%.`;
    case "adventuring":
      return `Out of combat, restore ${(1.2 + lv * 0.15).toFixed(1)} health per second. The formula is 1.2 + level × 0.15.`;
    case "physical":
      return `+${(n * 2).toFixed(0)}% damage with physical weapons. 2% per level, no cap.`;
    case "magic":
      return `+${(n * 2.5).toFixed(0)}% spell damage, and spell cooldowns are ${Math.min(45, n * 0.113).toFixed(1)}% shorter. Damage is 2.5% per level. Cooldown reduction is 0.113% per level and stops at 45%.`;
    default:
      return "";
  }
}

export type ItemDef = { id: string; name: string; about: string; price: number; heal?: number; buff?: string };

export const ITEMS: ItemDef[] = [
  { id: "trail_ration", name: "Trail Ration", about: "Eat to restore 35 hunger. Does not heal injuries.", price: 12 },
  { id: "cooked_meat", name: "Cooked Meat", about: "A campfire meal. Restores 50 hunger.", price: 20 },
  { id: "raw_water", name: "Raw Water", about: "Collected from water tiles. Purify with a log at a campfire.", price: 0 },
  { id: "drinking_water", name: "Drinking Water", about: "Purified on a campfire. Restores 50 thirst.", price: 0 },
  { id: "potion", name: "Potion", about: "Mends a modest wound.", price: 18, heal: 45 },
  { id: "big_potion", name: "Big Potion", about: "The good bottle.", price: 48, heal: 110 },
  { id: "ghost_jar", name: "Ghost Jar", about: "Crack it to raise the chance a fallen foe stays as a spirit. Lasts one minute.", price: 26 },
  { id: "cleanse_salt", name: "Cleanse Salt", about: "Clears a hex. Quest salt.", price: 14 },
  { id: "spirit_candy", name: "Spirit Candy", about: "A rush of spirit.", price: 22, heal: 30 },
  { id: "smoke_bomb", name: "Smoke Bomb", about: "Step out of a fight.", price: 20 },
  { id: "blue_lantern", name: "Blue Lantern", about: "Verdant fungus that glows.", price: 16 },
  { id: "dreamspore", name: "Dreamspore", about: "Alchemy dust. Makes sleep.", price: 20 },
  { id: "embercap", name: "Embercap", about: "A hot cap from the wastes.", price: 18 },
  { id: "ironroot", name: "Ironroot", about: "Bitter root. Good in a phial.", price: 18 },
  { id: "warmth_tonic", name: "Warmth Tonic", about: "Brewed fire. Heals and stabs fire.", price: 0, heal: 70, buff: "fire" },
  { id: "cats_eye", name: "Cat's Eye Draught", about: "Crit drips for a short while.", price: 0, buff: "crit" },
  { id: "ironroot_phial", name: "Ironroot Phial", about: "A bark ward.", price: 0, buff: "ward" },
  { id: "fish", name: "Raw Fish", about: "Better cooked. Still food.", price: 8, heal: 18 },
  { id: "fish_meal", name: "Fish Meal", about: "Bram's way.", price: 0, heal: 55 },
  { id: "ore", name: "Vein Ore", about: "Crownfall will buy this.", price: 10 },
  { id: "timber", name: "Logs", about: "Chopped timber. Three build a campfire; one fuels a meal or water purification.", price: 8 },
  { id: "meat", name: "Raw Meat", about: "From hunted animals. Cook on a campfire before eating in Hardcore.", price: 9, heal: 22 },
  { id: "leather", name: "Hide Leather", about: "Ten hides and ten mushrooms stitch a piece at your account level.", price: 14 },
  { id: "mushroom", name: "Shroom", about: "The patch was generous.", price: 11 },
];

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

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
  { id: "first_steps", name: "First Steps", about: "Win 3 battles anywhere in the wilds.", giver: "Miret", chapter: "I · The Hearth", rewardKyo: 40, rewardItems: { potion: 2, ghost_jar: 2 } },
  { id: "keeper_lanterns", name: "Keeper's Lanterns", about: "Catch a Light spirit and a Fire spirit.", giver: "Keel", chapter: "II · Two Flames", rewardKyo: 70, rewardItems: { lantern_jar: 0, blue_lantern: 2, big_potion: 1 } },
  { id: "marsh_walk", name: "Marsh Walk", about: "Visit Tide Reach, then catch a Water spirit.", giver: "Bram", chapter: "III · Salt Road", rewardKyo: 60, rewardItems: { ghost_jar: 3 } },
  { id: "ember_hunt", name: "Ember Hunt", about: "Catch two Fire spirits in the Ashen Wastes.", giver: "Vey", chapter: "IV · Cinder Yard", rewardKyo: 80, rewardItems: { potion: 3, embercap: 2 } },
  { id: "salt_run", name: "Salt Run", about: "Bring 2 Cleanse Salt to the ledger.", giver: "Holt", chapter: "V · The Tithe", rewardKyo: 90, rewardItems: { big_potion: 1 } },
  { id: "bone_patrol", name: "Bone Patrol", about: "Lay down 2 skeletons inside the Tiny Crypt.", giver: "Wren", chapter: "VI · The Door", rewardKyo: 100, rewardItems: { spirit_candy: 2 } },
  { id: "bone_king", name: "The Bone King", about: "Walk the Bone Garden path and break the Bone King.", giver: "Keel", chapter: "VII · The Lid", rewardKyo: 180, rewardItems: { big_potion: 2, ghost_jar: 2 } },
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
  { id: "miret", name: "Caretaker Miret", role: "Hearth keeper", female: true, outfit: 0, hair: 3, map: "world", tx: 30, ty: 31, lines: ["THE HEARTH IS YOURS. SKILLS STAY WHEN THE VEIL TAKES THE REST.", "WIN THREE FIGHTS. THEN WE TALK ABOUT THE DOOR.", "CROWNFALL IS DAMAGED. IT IS STILL A CITY."] },
  { id: "vey", name: "Captain Vey", role: "Citadel guard", female: false, outfit: 1, hair: 1, map: "world", tx: 26, ty: 28, lines: ["THE ASHEN YARD IS LEAKING FIRE AGAIN.", "IF YOU HUNT, HUNT CLEAN. BRING ME COUNTS, NOT STORIES.", "HOLT THINKS A DEBT IS PAID IN BONE. HE IS NOT ALWAYS WRONG."] },
  { id: "orien", name: "Scribe Orien", role: "Ledger scribe", female: true, outfit: 2, hair: 0, map: "world", tx: 34, ty: 28, lines: ["EVERY ARMOR PIECE ROLLS ITS OWN TYPE. MATCH IT TO THE MOVE.", "A FULL SET IS NOT FASHION. IT IS A WEATHER EVENT.", "I CAN TEACH A VERSE, IF YOU HAVE KYO."] },
  { id: "holt", name: "Quartermaster Holt", role: "Stores", female: false, outfit: 3, hair: 2, map: "world", tx: 32, ty: 34, shop: "general", lines: ["POTIONS, JARS, SALT. THE WALLS DO NOT STOCK THEMSELVES.", "BRING ME SALT IF THE LEDGER ASKS. TWO PINCHES."] },
  { id: "lise", name: "Spore Broker Lise", role: "Alchemist", female: true, outfit: 4, hair: 4, map: "world", tx: 23, ty: 33, shop: "alchemy", lines: ["DREAMSPORE AND EMBERCAP. THAT IS A WARMTH TONIC.", "IRONROOT MAKES A WARD. I JUST HOLD THE FLAME."] },
  { id: "bram", name: "Fisher Bram", role: "Tide runner", female: false, outfit: 5, hair: 2, map: "world", tx: 63, ty: 34, lines: ["THE REACH IS A ROAD IF YOU RESPECT THE WATER.", "CATCH ME SOMETHING THAT DRINKS. A WATER SPIRIT.", "COOK THE FISH. RAW IS A RUMOR, NOT A MEAL."] },
  { id: "ada", name: "Sister Ada", role: "Chancel sister", female: true, outfit: 0, hair: 4, map: "world", tx: 28, ty: 26, shrine: "light", lines: ["THE CHANCEL OWES THE HUSH A WALK, NOT A SLAUGHTER.", "THE SHRINE WILL HEAL YOU, THEN IT WILL TEST YOU.", "LIGHT IS A WEAPON HERE. DO NOT APOLOGIZE FOR IT."] },
  { id: "brask", name: "Warden Brask", role: "Chancel warden", female: false, outfit: 1, hair: 0, map: "world", tx: 36, ty: 33, lines: ["I WILL WALK YOU INTO A FIGHT AND CALL IT SETTLED.", "WORLD BOSSES DO NOT WAIT ON YOUR STORY. THEY RISE ANYWAY.", "IF YOU DIE, PICK ONE THING. THE VEIL IS GREEDY, NOT THOROUGH."] },
  { id: "wren", name: "Digger Wren", role: "Barrow digger", female: true, outfit: 6, hair: 1, map: "world", tx: 40, ty: 44, lines: ["PEOPLE WENT IN FOR THE OLD PAY CHEST AND DID NOT COME OUT.", "KEEL WILL LET THEM STAY DOWN THERE. I WILL NOT.", "THE CRYPT DOOR IS SOUTH OF THE GARDEN. TWO SKELETONS, THEN THE KING."] },
  { id: "keel", name: "Priest Keel", role: "Barrow priest", female: false, outfit: 7, hair: 3, map: "world", tx: 37, ty: 42, lines: ["THE BARROW IS NOT A HOLE. IT IS A DOOR.", "IF YOU OPEN IT, YOU OWN WHAT COMES OUT.", "CATCH A LIGHT AND A FIRE BEFORE YOU CALL YOURSELF READY."] },
  { id: "pike", name: "Quiet Pike", role: "Fence", female: false, outfit: 5, hair: 1, map: "world", tx: 22, ty: 40, shop: "fence", lines: ["I BUY ROLLS. I SELL ROLLS. I DO NOT BUY STORIES.", "TYPE ON THE PIECE IS HALF THE BUILD. READ IT."] },
  { id: "nessa", name: "Peddler Nessa", role: "Ash peddler", female: true, outfit: 4, hair: 2, map: "world", tx: 22, ty: 50, shop: "armor", lines: ["THE KILN DROPS BETTER THAN I DO. I AM JUST CLOSER.", "FULL SETS CHANGE THE AIR. YOU WILL FEEL IT IN YOUR TEETH."] },
  { id: "moss", name: "Sister Moss", role: "Hollow shrine", female: true, outfit: 0, hair: 3, map: "world", tx: 42, ty: 14, shrine: "earth", lines: ["VERDANT SHRINE. EARTH ANSWERS IF YOU BLEED A LITTLE.", "THREE ROUNDS. EACH SAINT IS LOUDER."] },
  { id: "brine", name: "Cantor Brine", role: "Tide shrine", female: false, outfit: 2, hair: 2, map: "world", tx: 70, ty: 36, shrine: "water", lines: ["STAND IN THE RING. THE REACH KEEPS SCORE.", "SOAK THEM. THEN ASK THE WATER FOR MORE."] },
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
  return Math.floor(140 * Math.pow(1.32, Math.max(0, level - 1)));
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
