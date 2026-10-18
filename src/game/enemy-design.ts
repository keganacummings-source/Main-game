/**
 * Enemy Designer data: make brand-new enemies or replace built-in ones.
 *
 * Designs live in this device's storage (made in Designer Mode) and in
 * `src/game/enemies/custom-enemies.json` (shipped with the game for every player).
 * `installEnemyDesigns()` folds them into the monster tables before a world is built,
 * and `enemyDesignFor(species)` is read by the engine whenever a foe is made.
 */
import { ANIMAL_BY_ID, BIOME_MONSTERS, MONSTERS, MONSTER_BY_ID, MOVE_BY_ID, TYPES, type BiomeId, type MonsterDef, type TypeId, MOVES, attackForm, moveTactic } from "./content";
import { MOB_ENCHANT_IDS, type EnemyStats, type MobEnchantId } from "./balance";
import { CREATURE_CELLS, setCustomSprite, clearCustomSprites } from "./creature-sprites";
import shipped from "./enemies/custom-enemies.json";

export const ENEMY_DESIGN_KEY = "turbz-enemy-designs-v1";
export const BIOME_IDS: BiomeId[] = ["crown", "verdant", "frost", "void", "tide", "ashen", "bone"];
export const SHEET_COLS = 8;
export const SHEET_ROWS = 9;

export type EnemySprite = { kind: "sheet"; cell: [number, number] } | { kind: "pixels"; pixels: (string | null)[] };
export type EnemyBehaviour = "hunt" | "drift" | "flee";

/** What kind of foe this design is. More than one can be on (a witch who is also a world boss).
 *  World Boss and Dungeon Boss cannot both be on: a dungeon boss is the fight at the end of a dungeon,
 *  a world boss walks the wild. */
export type EnemyFlags = {
  witch: boolean;
  worldBoss: boolean;
  dungeonBoss: boolean;
  overworld: boolean;
  ghost: boolean;
  animal: boolean;
};

export const EMPTY_FLAGS: EnemyFlags = {
  witch: false, worldBoss: false, dungeonBoss: false, overworld: true, ghost: false, animal: false,
};

export type EnemyDesign = {
  version: 1;
  id: string;
  name: string;
  about: string;
  /** A built-in enemy this design replaces everywhere, or null for a brand-new enemy. */
  replaces: string | null;
  type: TypeId;
  sprite: EnemySprite;
  /** 1 = one tile, 2 = twice the size, up to 3. */
  scale: number;
  behaviour: EnemyBehaviour;
  /** True when the design is a world boss or a dungeon boss. Kept so older readers still see a boss. */
  boss: boolean;
  /** Witch, world boss, dungeon boss, overworld, ghost, animal. */
  flags: EnemyFlags;
  /** Multipliers (hp, dmg, speed) and chances (crit, dodge, resistances) on top of normal scaling. */
  stats: EnemyStats;
  /** Enchantments it always has. */
  enchants: MobEnchantId[];
  /** Extra random enchantments rolled per spawn (0-4). */
  extraEnchants: number;
  /** 1-4 verse ids it fights with. */
  moves: string[];
  /** Levels above the hunter (0-20). */
  levelBonus: number;
  /** Where it spawns in the overworld (new enemies). Replacements keep the original's places. */
  biomes: BiomeId[];
  /** How common it is in those biomes (1-5). */
  weight: number;
  /** Kyo and gear-drop multiplier (0.5-3). */
  loot: number;
};

const DEFAULT_STATS: EnemyStats = { hp: 1, dmg: 1, speed: 1, crit: 0.05, dodge: 0, physRes: 0, spellRes: 0 };

export function newEnemyDesign(): EnemyDesign {
  return {
    version: 1,
    id: "new-enemy",
    name: "Moss Lurker",
    about: "A patient thing in the undergrowth.",
    replaces: null,
    type: "earth",
    sprite: { kind: "sheet", cell: [0, 8] },
    scale: 1,
    behaviour: "hunt",
    boss: false,
    flags: { ...EMPTY_FLAGS },
    stats: { ...DEFAULT_STATS },
    enchants: [],
    extraEnchants: 1,
    moves: ["thorn"],
    levelBonus: 0,
    biomes: ["verdant"],
    weight: 2,
    loot: 1,
  };
}

/** Start a design from a built-in enemy (its look, element and sprite). */
export function designFromBuiltin(species: string): EnemyDesign {
  const def = MONSTER_BY_ID[species] ?? ANIMAL_BY_ID[species];
  const base = newEnemyDesign();
  if (!def) return base;
  const cell = CREATURE_CELLS[species];
  const animal = !!def.animal;
  const boss = !!def.boss;
  return {
    ...base,
    id: `${species}-remix`,
    name: def.name,
    about: def.about,
    replaces: species,
    type: def.type,
    sprite: cell ? { kind: "sheet", cell: [cell[0], cell[1]] } : base.sprite,
    behaviour: animal ? "flee" : "hunt",
    boss,
    flags: { witch: false, worldBoss: boss, dungeonBoss: false, overworld: false, ghost: false, animal },
    moves: base.moves.filter((id) => MOVE_BY_ID[id]?.type === def.type),
    biomes: [],
  };
}

const clamp = (n: unknown, lo: number, hi: number, fallback: number) => (typeof n === "number" && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback);

/** Old saves only had `boss`. A missing flag falls back to that, and to biomes for Overworld. */
function readFlags(raw: Partial<EnemyDesign> | null, biomes: BiomeId[]): EnemyFlags {
  const src: Partial<EnemyFlags> = raw?.flags && typeof raw.flags === "object" ? raw.flags : {};
  const set = (k: keyof EnemyFlags) => typeof src[k] === "boolean";
  let worldBoss = set("worldBoss") ? !!src.worldBoss : !!raw?.boss;
  const dungeonBoss = set("dungeonBoss") ? !!src.dungeonBoss : false;
  if (worldBoss && dungeonBoss) worldBoss = false;
  return {
    witch: !!src.witch,
    worldBoss,
    dungeonBoss,
    overworld: set("overworld") ? !!src.overworld : biomes.length > 0,
    ghost: !!src.ghost,
    animal: !!src.animal,
  };
}

/** Validates and repairs a design. Throws only when it cannot be repaired. */
export function parseEnemyDesign(raw: unknown): EnemyDesign {
  const d = raw as Partial<EnemyDesign> | null;
  if (!d || typeof d !== "object") throw Error("Not an enemy design.");
  if (typeof d.id !== "string" || !/^[a-z0-9_-]{1,40}$/i.test(d.id)) throw Error("Enemy ID: 1-40 letters, numbers, - or _. ");
  if (typeof d.name !== "string" || !d.name.trim() || d.name.length > 40) throw Error("Enemy name: 1-40 characters.");
  if (!d.type || !Object.hasOwn(TYPES, d.type)) throw Error("Pick an element.");
  const replaces = typeof d.replaces === "string" && (MONSTER_BY_ID[d.replaces] || ANIMAL_BY_ID[d.replaces]) ? d.replaces : null;
  if (!replaces && (MONSTER_BY_ID[d.id] && !(MONSTER_BY_ID[d.id] as MonsterDef & { custom?: boolean }).custom || ANIMAL_BY_ID[d.id])) throw Error(`\"${d.id}\" is a built-in enemy. Use \"Replaces\" or a different ID.`);
  let sprite: EnemySprite;
  if (d.sprite?.kind === "pixels" && Array.isArray(d.sprite.pixels) && d.sprite.pixels.length === 256) {
    sprite = { kind: "pixels", pixels: d.sprite.pixels.map((p) => (typeof p === "string" && /^#[0-9a-f]{6}$/i.test(p) ? p : null)) };
  } else if (d.sprite?.kind === "sheet" && Array.isArray(d.sprite.cell)) {
    sprite = { kind: "sheet", cell: [Math.floor(clamp(d.sprite.cell[0], 0, SHEET_COLS - 1, 0)), Math.floor(clamp(d.sprite.cell[1], 0, SHEET_ROWS - 1, 0))] };
  } else throw Error("The enemy needs a sprite.");
  const moves = (Array.isArray(d.moves) ? d.moves : []).filter((id) => typeof id === "string" && MOVE_BY_ID[id]).slice(0, 4);
  if (!moves.length) throw Error("Give the enemy at least one move.");
  const s = (d.stats ?? {}) as Partial<EnemyStats>;
  const biomes = (Array.isArray(d.biomes) ? d.biomes : []).filter((b): b is BiomeId => BIOME_IDS.includes(b as BiomeId));
  const flags = readFlags(d, biomes);
  return {
    version: 1,
    id: d.id,
    name: d.name.trim(),
    about: typeof d.about === "string" ? d.about.slice(0, 200) : "",
    replaces,
    type: d.type,
    sprite,
    scale: clamp(d.scale, 0.5, 6, 1),
    behaviour: d.behaviour === "drift" || d.behaviour === "flee" ? d.behaviour : "hunt",
    boss: flags.worldBoss || flags.dungeonBoss,
    flags,
    stats: {
      hp: clamp(s.hp, 0.05, 50, 1),
      dmg: clamp(s.dmg, 0.05, 50, 1),
      speed: clamp(s.speed, 0.1, 20, 1),
      crit: clamp(s.crit, 0, 3, 0.05),
      dodge: clamp(s.dodge, 0, 3, 0),
      physRes: clamp(s.physRes, 0, 3, 0),
      spellRes: clamp(s.spellRes, 0, 3, 0),
    },
    enchants: [...new Set((Array.isArray(d.enchants) ? d.enchants : []).filter((e): e is MobEnchantId => MOB_ENCHANT_IDS.includes(e as MobEnchantId)))],
    extraEnchants: Math.round(clamp(d.extraEnchants, 0, 12, 0)),
    moves,
    levelBonus: Math.round(clamp(d.levelBonus, 0, 200, 0)),
    biomes,
    weight: Math.round(clamp(d.weight, 1, 20, 2)),
    loot: clamp(d.loot, 0.1, 40, 1),
  };
}

function parseList(raw: unknown): EnemyDesign[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((d) => {
    try {
      return [parseEnemyDesign(d)];
    } catch {
      return [];
    }
  });
}

/** Designs made on this device. */
export function localEnemyDesigns(): EnemyDesign[] {
  try {
    return parseList(JSON.parse(localStorage.getItem(ENEMY_DESIGN_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function saveLocalEnemyDesigns(list: EnemyDesign[]): void {
  localStorage.setItem(ENEMY_DESIGN_KEY, JSON.stringify(list));
}

/** Shipped designs first, then this device's (a local design with the same ID wins). */
export function allEnemyDesigns(): EnemyDesign[] {
  const byId = new Map<string, EnemyDesign>();
  for (const d of parseList(shipped)) byId.set(d.id, d);
  for (const d of localEnemyDesigns()) byId.set(d.id, d);
  return [...byId.values()];
}

// ---------------------------------------------------------------------------
// Installing into the game
// ---------------------------------------------------------------------------

const originals = new Map<string, MonsterDef>();
const originalBiomes: Record<string, string[]> = Object.fromEntries(Object.entries(BIOME_MONSTERS).map(([k, v]) => [k, [...v]]));
const added = new Set<string>();
let active = new Map<string, EnemyDesign>();

function spriteCanvas(pixels: (string | null)[]): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const g = c.getContext("2d");
  if (!g) return null;
  pixels.forEach((p, i) => {
    if (!p) return;
    g.fillStyle = p;
    g.fillRect(i % 16, Math.floor(i / 16), 1, 1);
  });
  return c;
}

/** Register a design's look with the sprite renderer under a species id. */
export function registerSprite(species: string, d: Pick<EnemyDesign, "sprite" | "scale">): void {
  if (d.sprite.kind === "sheet") setCustomSprite(species, { cell: d.sprite.cell, scale: d.scale });
  else setCustomSprite(species, { canvas: spriteCanvas(d.sprite.pixels), scale: d.scale });
}

/** Puts every design into the monster tables. Safe to call again after designs change. */
export function installEnemyDesigns(list: EnemyDesign[] = allEnemyDesigns()): number {
  // Undo the previous install.
  for (const [id, def] of originals) {
    MONSTER_BY_ID[id] = def;
    const i = MONSTERS.findIndex((m) => m.id === id);
    if (i >= 0) MONSTERS[i] = def;
  }
  originals.clear();
  for (const id of added) {
    delete MONSTER_BY_ID[id];
    const i = MONSTERS.findIndex((m) => m.id === id);
    if (i >= 0) MONSTERS.splice(i, 1);
  }
  added.clear();
  for (const [k, v] of Object.entries(originalBiomes)) BIOME_MONSTERS[k as BiomeId] = [...v];
  clearCustomSprites();
  active = new Map();

  for (const d of list) {
    const species = d.replaces ?? d.id;
    if (d.replaces) {
      const base = MONSTER_BY_ID[d.replaces];
      if (base) {
        originals.set(d.replaces, base);
        const def = { ...base, name: d.name, type: d.type, about: d.about || base.about, boss: d.boss || base.boss, animal: d.flags.animal || base.animal };
        MONSTER_BY_ID[d.replaces] = def;
        const i = MONSTERS.findIndex((m) => m.id === d.replaces);
        if (i >= 0) MONSTERS[i] = def;
      }
    } else {
      const def: MonsterDef & { custom?: boolean } = { id: d.id, name: d.name, type: d.type, template: 0, about: d.about, boss: d.boss, animal: d.flags.animal, custom: true };
      MONSTER_BY_ID[d.id] = def;
      MONSTERS.push(def);
      added.add(d.id);
      if (d.flags.overworld) for (const b of d.biomes) for (let n = 0; n < d.weight; n++) BIOME_MONSTERS[b].push(d.id);
    }
    registerSprite(species, d);
    active.set(species, d);
  }
  return list.length;
}

/** The design that controls this species, if any. */
export function enemyDesignFor(species: string): EnemyDesign | null {
  return active.get(species) ?? null;
}

/**
 * AutoMove Picker — similar to how the Crying Girl / CryingWitch kit is built.
 * Picks 1-4 moves based on the design's element, stats, and assigned role (witch, boss, tanky, etc.).
 */
export function autoPickMoves(d: EnemyDesign): string[] {
  const pool = MOVES.filter((m) => m.type === d.type || m.type === "normal" || (d.flags.witch && (m.type === "spirit" || m.type === "water")));
  const score = (m: typeof MOVES[number]): number => {
    let s = m.power * 0.4;
    if (d.stats.dmg > 1.3 && attackForm(m) !== "melee") s += 12;
    if (d.stats.hp > 1.4 && (moveTactic(m) === "ward" || m.effect === "shell")) s += 18;
    if (d.flags.witch && (moveTactic(m) === "heal" || m.effect === "mend")) s += 22;
    if (d.flags.dungeonBoss || d.flags.worldBoss) s += m.power > 40 ? 10 : 0;
    if (d.stats.crit > 0.12 && m.crit > 10) s += 8;
    if (d.stats.speed > 1.2 && (moveTactic(m) === "dash" || moveTactic(m) === "blink")) s += 10;
    if (d.flags.animal && attackForm(m) === "melee") s += 6;
    return s;
  };
  const ranked = [...pool].sort((a, b) => score(b) - score(a));
  const want = d.flags.witch || d.flags.dungeonBoss || d.flags.worldBoss ? 4 : 3;
  const picked: string[] = [];
  for (const m of ranked) {
    if (picked.length >= want) break;
    if (!picked.includes(m.id)) picked.push(m.id);
  }
  return picked.length ? picked : ["thorn"];
}

/** Options for the AutoStat Picker. */
export type StatOption = "melee" | "ranged" | "spell" | "fast" | "slow" | "highDamage" | "tanky" | "physical" | "spellResist" | "crit" | "dodge";

export const STAT_OPTIONS: { id: StatOption; label: string; hint: string }[] = [
  { id: "melee", label: "Melee", hint: "Prefers close combat. A bit tankier." },
  { id: "ranged", label: "Ranged", hint: "Keeps distance. Slightly faster and harder-hitting." },
  { id: "spell", label: "Magic", hint: "Spell-focused. Better spell resistance." },
  { id: "fast", label: "Fast", hint: "High turn speed, lower health." },
  { id: "slow", label: "Slow", hint: "Low speed, higher health." },
  { id: "highDamage", label: "High Damage", hint: "Hits much harder, a bit squishier." },
  { id: "tanky", label: "Tanky", hint: "Lots of health, a bit slower." },
  { id: "physical", label: "Physical", hint: "Higher physical resistance." },
  { id: "spellResist", label: "Spell Resist", hint: "Higher spell resistance." },
  { id: "crit", label: "Crit", hint: "Higher crit chance." },
  { id: "dodge", label: "Dodge", hint: "Higher dodge chance." },
];

/**
 * AutoStat Picker. Builds a stats line from selected combat styles.
 * Role flags (boss, witch, animal) also influence the result.
 */
export function autoPickStats(d: EnemyDesign, options: StatOption[]): EnemyStats {
  const has = (o: StatOption) => options.includes(o);
  const s: EnemyStats = { hp: 1, dmg: 1, speed: 1, crit: 0.05, dodge: 0, physRes: 0, spellRes: 0 };

  if (has("tanky")) { s.hp *= 1.65; s.speed *= 0.82; }
  if (has("highDamage")) { s.dmg *= 1.55; s.hp *= 0.82; }
  if (has("fast")) { s.speed *= 1.45; s.hp *= 0.88; }
  if (has("slow")) { s.speed *= 0.68; s.hp *= 1.25; }
  if (has("physical")) { s.physRes += 0.18; s.hp *= 1.08; }
  if (has("spellResist")) { s.spellRes += 0.18; }
  if (has("crit")) { s.crit += 0.14; s.dmg *= 1.08; }
  if (has("dodge")) { s.dodge += 0.12; s.speed *= 1.08; }

  if (has("melee")) { s.physRes += 0.06; s.hp *= 1.1; }
  if (has("ranged")) { s.speed *= 1.06; s.dmg *= 1.06; }
  if (has("spell")) { s.spellRes += 0.08; s.dmg *= 1.05; }

  // Role influence
  if (d.flags?.worldBoss || d.flags?.dungeonBoss || d.boss) {
    s.hp *= 1.45;
    s.dmg *= 1.25;
    s.levelBonus = Math.max(d.levelBonus, 4);
  }
  if (d.flags?.witch) {
    s.spellRes += 0.1;
    s.dmg *= 1.12;
    s.hp *= 1.1;
  }
  if (d.flags?.animal) {
    s.hp *= 0.75;
    s.speed *= 1.12;
    s.dmg *= 0.9;
  }

  // Soft clamps so values stay in the useful range
  s.hp = Math.max(0.4, Math.min(6, s.hp));
  s.dmg = Math.max(0.5, Math.min(5, s.dmg));
  s.speed = Math.max(0.4, Math.min(2.5, s.speed));
  s.crit = Math.max(0, Math.min(0.45, s.crit));
  s.dodge = Math.max(0, Math.min(0.35, s.dodge));
  s.physRes = Math.max(0, Math.min(0.55, s.physRes));
  s.spellRes = Math.max(0, Math.min(0.55, s.spellRes));

  return s;
}
