/**
 * Enemy Designer data: make brand-new enemies or replace built-in ones.
 *
 * Designs live in this device's storage (made in Designer Mode) and in
 * `src/game/enemies/custom-enemies.json` (shipped with the game for every player).
 * `installEnemyDesigns()` folds them into the monster tables before a world is built,
 * and `enemyDesignFor(species)` is read by the engine whenever a foe is made.
 */
import { ANIMAL_BY_ID, BIOME_MONSTERS, MONSTERS, MONSTER_BY_ID, MOVE_BY_ID, TYPES, type BiomeId, type MonsterDef, type TypeId } from "./content";
import { MOB_ENCHANT_IDS, type EnemyStats, type MobEnchantId } from "./balance";
import { CREATURE_CELLS, setCustomSprite, clearCustomSprites } from "./creature-sprites";
import shipped from "./enemies/custom-enemies.json";

export const ENEMY_DESIGN_KEY = "turbz-enemy-designs-v1";
export const BIOME_IDS: BiomeId[] = ["crown", "verdant", "frost", "void", "tide", "ashen", "bone"];
export const SHEET_COLS = 8;
export const SHEET_ROWS = 9;

export type EnemySprite = { kind: "sheet"; cell: [number, number] } | { kind: "pixels"; pixels: (string | null)[] };
export type EnemyBehaviour = "hunt" | "drift" | "flee";

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
  boss: boolean;
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
  return {
    ...base,
    id: `${species}-remix`,
    name: def.name,
    about: def.about,
    replaces: species,
    type: def.type,
    sprite: cell ? { kind: "sheet", cell: [cell[0], cell[1]] } : base.sprite,
    behaviour: def.animal ? "flee" : "hunt",
    moves: base.moves.filter((id) => MOVE_BY_ID[id]?.type === def.type),
    biomes: [],
  };
}

const clamp = (n: unknown, lo: number, hi: number, fallback: number) => (typeof n === "number" && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback);

/** Validates and repairs a design. Throws only when it cannot be repaired. */
export function parseEnemyDesign(raw: unknown): EnemyDesign {
  const d = raw as Partial<EnemyDesign> | null;
  if (!d || typeof d !== "object") throw Error("Not an enemy design.");
  if (typeof d.id !== "string" || !/^[a-z0-9_-]{1,40}$/i.test(d.id)) throw Error("Enemy ID: 1-40 letters, numbers, - or _.");
  if (typeof d.name !== "string" || !d.name.trim() || d.name.length > 40) throw Error("Enemy name: 1-40 characters.");
  if (!d.type || !Object.hasOwn(TYPES, d.type)) throw Error("Pick an element.");
  const replaces = typeof d.replaces === "string" && (MONSTER_BY_ID[d.replaces] || ANIMAL_BY_ID[d.replaces]) ? d.replaces : null;
  if (!replaces && (MONSTER_BY_ID[d.id] && !(MONSTER_BY_ID[d.id] as MonsterDef & { custom?: boolean }).custom || ANIMAL_BY_ID[d.id])) throw Error(`"${d.id}" is a built-in enemy. Use "Replaces" or a different ID.`);
  let sprite: EnemySprite;
  if (d.sprite?.kind === "pixels" && Array.isArray(d.sprite.pixels) && d.sprite.pixels.length === 256) {
    sprite = { kind: "pixels", pixels: d.sprite.pixels.map((p) => (typeof p === "string" && /^#[0-9a-f]{6}$/i.test(p) ? p : null)) };
  } else if (d.sprite?.kind === "sheet" && Array.isArray(d.sprite.cell)) {
    sprite = { kind: "sheet", cell: [Math.floor(clamp(d.sprite.cell[0], 0, SHEET_COLS - 1, 0)), Math.floor(clamp(d.sprite.cell[1], 0, SHEET_ROWS - 1, 0))] };
  } else throw Error("The enemy needs a sprite.");
  const moves = (Array.isArray(d.moves) ? d.moves : []).filter((id) => typeof id === "string" && MOVE_BY_ID[id]).slice(0, 4);
  if (!moves.length) throw Error("Give the enemy at least one move.");
  const s = (d.stats ?? {}) as Partial<EnemyStats>;
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
    boss: !!d.boss,
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
    biomes: (Array.isArray(d.biomes) ? d.biomes : []).filter((b): b is BiomeId => BIOME_IDS.includes(b as BiomeId)),
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
        const def = { ...base, name: d.name, type: d.type, about: d.about || base.about, boss: d.boss || base.boss };
        MONSTER_BY_ID[d.replaces] = def;
        const i = MONSTERS.findIndex((m) => m.id === d.replaces);
        if (i >= 0) MONSTERS[i] = def;
      }
    } else {
      const def: MonsterDef & { custom?: boolean } = { id: d.id, name: d.name, type: d.type, template: 0, about: d.about, boss: d.boss, custom: true };
      MONSTER_BY_ID[d.id] = def;
      MONSTERS.push(def);
      added.add(d.id);
      for (const b of d.biomes) for (let n = 0; n < d.weight; n++) BIOME_MONSTERS[b].push(d.id);
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
