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
import { CREATURE_CELLS, frameTwoKey, setCustomSprite, clearCustomSprites, setTypedSpriteResolver } from "./creature-sprites";
import { retintPixels, TYPE_PALETTE } from "./type-palettes";
import shipped from "./enemies/custom-enemies.json";

export const ENEMY_DESIGN_KEY = "turbz-enemy-designs-v1";
export const BIOME_IDS: BiomeId[] = ["crown", "verdant", "frost", "void", "tide", "ashen", "bone"];
export const SHEET_COLS = 8;
export const SHEET_ROWS = 9;

/**
 * A design's look.
 *
 * Drawn enemies are two-frame from this update on: `pixels` is frame 1 and `pixels2` is frame 2,
 * and the game always plays both — unlike tiles, an enemy has no animation toggle. A design made
 * before two-frame art existed gets a frame 2 generated for it (see `idleFrame`), so every enemy
 * in a player's roster starts moving without anyone having to repaint it.
 */
export type EnemySprite =
  | { kind: "sheet"; cell: [number, number] }
  | { kind: "pixels"; pixels: (string | null)[]; pixels2?: (string | null)[] };

/** A drawn sprite is this many pixels on a side. */
export const SPRITE_SIDE = 16;
export const SPRITE_CELLS = SPRITE_SIDE * SPRITE_SIDE;

/**
 * Builds a second frame from the first: a one-pixel squash that reads as the creature breathing.
 *
 * The top row and the bottom row are both kept exactly as drawn, and the body in between settles
 * down by one pixel. That way nothing is clipped off the top of a head or the bottom of a pair of
 * feet, however full the sprite is — which matters, because most sprites paint right to the edge.
 * A 1px squash has to merge one row somewhere, and it does so low in the body, where a creature's
 * base tends to repeat itself and the merge does not read.
 *
 * This is only a starting point: it exists so that every enemy already in a roster starts moving
 * without anyone repainting it. Frame 2 is fully editable in the Enemy Designer, and a hand-painted
 * one always wins.
 */
export function idleFrame(pixels: (string | null)[]): (string | null)[] {
  const out = pixels.slice();
  const last = SPRITE_SIDE - 1;
  // Rows 1..last-1 take the row above them; row 0 and the last row stay put.
  for (let y = last - 1; y >= 1; y--) {
    for (let x = 0; x < SPRITE_SIDE; x++) out[y * SPRITE_SIDE + x] = pixels[(y - 1) * SPRITE_SIDE + x] ?? null;
  }
  return out;
}

/** True when the two frames differ, i.e. the enemy visibly moves. */
export function framesDiffer(a: (string | null)[], b: (string | null)[] | undefined): boolean {
  if (!b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return true;
  return false;
}
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
  if (typeof d.id !== "string" || !/^[a-z0-9_-]{1,40}$/i.test(d.id)) throw Error("Enemy ID: 1-40 letters, numbers, - or _.");
  if (typeof d.name !== "string" || !d.name.trim() || d.name.length > 40) throw Error("Enemy name: 1-40 characters.");
  if (!d.type || !Object.hasOwn(TYPES, d.type)) throw Error("Pick an element.");
  const replaces = typeof d.replaces === "string" && (MONSTER_BY_ID[d.replaces] || ANIMAL_BY_ID[d.replaces]) ? d.replaces : null;
  if (!replaces && (MONSTER_BY_ID[d.id] && !(MONSTER_BY_ID[d.id] as MonsterDef & { custom?: boolean }).custom || ANIMAL_BY_ID[d.id])) throw Error(`"${d.id}" is a built-in enemy. Use "Replaces" or a different ID.`);
  let sprite: EnemySprite;
  if (d.sprite?.kind === "pixels" && Array.isArray(d.sprite.pixels) && d.sprite.pixels.length === SPRITE_CELLS) {
    const cell = (p: unknown) => (typeof p === "string" && /^#[0-9a-f]{6}$/i.test(p) ? p : null);
    const frame1 = d.sprite.pixels.map(cell);
    // Frame 2: the designer's own if it is there, otherwise one generated so the enemy animates.
    const raw2 = (d.sprite as { pixels2?: unknown }).pixels2;
    const frame2 = Array.isArray(raw2) && raw2.length === SPRITE_CELLS ? raw2.map(cell) : idleFrame(frame1);
    sprite = { kind: "pixels", pixels: frame1, pixels2: frame2 };
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

/**
 * Side-table: species → { pixels, baseType, scale }. Used by typedSpriteCanvas() to
 * build a retinted canvas on demand when the mob's current type differs from the
 * design's native type. Populated by registerSprite() alongside the default canvas
 * so the one-type look still renders if no retint is requested.
 */
type PixelsBase = { pixels: (string | null)[]; baseType: TypeId; scale?: number };
const basePixels = new Map<string, PixelsBase>();

/** Per-(species, type) retinted canvas cache. First access builds + caches. */
const typedCanvasCache = new Map<string, HTMLCanvasElement | null>();

/**
 * Return a canvas for `species` rendered as `type`. If no custom pixel sprite was registered
 * (or the type matches the base), returns null — caller falls back to the default canvas.
 */
/**
 * A palette-shifted copy of a custom sprite, or null when no shift applies.
 *
 * `type` is a plain string, not a TypeId, because that is what reaches it: the resolver is called
 * from creature-sprites with `String(m.type ?? "normal")` off live mob data, which can be anything
 * a designed enemy carries. Declaring it as TypeId made this unsound — tsc flagged it — so unknown
 * types are turned away here instead, which is the same answer as "this needs no retint".
 */
export function typedSpriteCanvas(species: string, type: string): HTMLCanvasElement | null {
  const base = basePixels.get(species);
  if (!base || base.baseType === type) return null;
  if (!(type in TYPE_PALETTE)) return null;
  const key = `${species}:${type}`;
  if (typedCanvasCache.has(key)) return typedCanvasCache.get(key) ?? null;
  const retinted = retintPixels(base.pixels, base.baseType, type as TypeId);
  const canvas = spriteCanvas(retinted);
  typedCanvasCache.set(key, canvas);
  return canvas;
}

/** Register a design's look with the sprite renderer under a species id, both frames. */
export function registerSprite(species: string, d: Pick<EnemyDesign, "sprite" | "scale" | "type">): void {
  if (d.sprite.kind === "sheet") setCustomSprite(species, { cell: d.sprite.cell, scale: d.scale });
  else {
    const frame2 = d.sprite.pixels2;
    // Only register a second frame when it actually differs, so a held-still design costs nothing.
    const animated = framesDiffer(d.sprite.pixels, frame2);
    setCustomSprite(species, {
      canvas: spriteCanvas(d.sprite.pixels),
      canvas2: animated ? spriteCanvas(frame2!) : null,
      scale: d.scale,
    });
    basePixels.set(species, { pixels: d.sprite.pixels, baseType: d.type, scale: d.scale });
    // Frame 2 goes in under its own key so the per-element retint can find it too.
    if (animated) basePixels.set(frameTwoKey(species), { pixels: frame2!, baseType: d.type, scale: d.scale });
  }
}

/** Clear the per-type canvas cache (called when designs are reinstalled). */
export function clearTypedSprites(): void {
  typedCanvasCache.clear();
  basePixels.clear();
}

/**
 * Puts every design into the monster tables. Safe to call again after designs change.
 *
 * When any shipped (non-replace) designs are present, the custom roster FULLY replaces vanilla
 * biome spawns: BIOME_MONSTERS is wiped and only the shipped designs populate it. This is what
 * makes "replace all vanilla enemies with my 20" work by just dropping the JSON in. The `overworld`
 * flag is no longer gating biome placement — any non-empty `biomes` list on a design puts it in
 * those biome tables (bosses and animals included).
 */
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
  // Restore originals first — then we may wipe them again below if a custom roster is active.
  for (const [k, v] of Object.entries(originalBiomes)) BIOME_MONSTERS[k as BiomeId] = [...v];
  clearCustomSprites();
  clearTypedSprites();
  active = new Map();

  const addedDesigns = list.filter((d) => !d.replaces);
  const customRosterActive = addedDesigns.length > 0;
  if (customRosterActive) {
    // Full replacement mode: start every biome empty and let the shipped designs populate it.
    for (const b of Object.keys(BIOME_MONSTERS) as BiomeId[]) BIOME_MONSTERS[b] = [];
  }

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
      // In custom-roster mode, every design with biomes populates them (overworld flag no longer
      // gates). Bosses are added too — the engine's spawn code already respects boss flags separately.
      const putInBiomes = customRosterActive ? d.biomes.length > 0 : d.flags.overworld;
      if (putInBiomes) for (const b of d.biomes) for (let n = 0; n < d.weight; n++) BIOME_MONSTERS[b].push(d.id);
    }
    registerSprite(species, d);
    active.set(species, d);
  }
  // Safety: if a biome ended up empty because no design listed it, drop in a reasonable default so
  // the engine doesn't crash picking from an empty list. Use the first custom enemy as the fallback.
  if (customRosterActive) {
    const fallback = addedDesigns[0]?.id;
    if (fallback) for (const b of Object.keys(BIOME_MONSTERS) as BiomeId[]) {
      if (BIOME_MONSTERS[b].length === 0) BIOME_MONSTERS[b].push(fallback);
    }
  }
  return list.length;
}

/** The design that controls this species, if any. */
export function enemyDesignFor(species: string): EnemyDesign | null {
  return active.get(species) ?? null;
}

/** A tiny deterministic PRNG so a given design always rolls the same kit, but different designs differ. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * AutoMove Picker — builds a kit that fits the design's *actual* stat line, element, role and chosen
 * combat styles, not a fixed table per element. Every move is scored by a continuous function of the
 * stats (a heavy hitter favours big spells, a fast dodger favours mobility verses, a tank favours wards),
 * then the kit is filled across attack forms so it is not three near-identical nukes. A deterministic
 * per-design seed means two monsters of the same element with different stats get genuinely different
 * movesets, while any one design stays stable between presses.
 */
export function autoPickMoves(d: EnemyDesign, options: StatOption[] = []): string[] {
  const s = d.stats;
  const has = (o: StatOption) => options.includes(o);
  const pool = MOVES.filter((m) => m.type === d.type || m.type === "normal" || (d.flags.witch && (m.type === "spirit" || m.type === "water")));
  if (!pool.length) return ["thorn"];

  const seed = hashStr(`${d.id}|${d.name}|${d.type}|${s.hp.toFixed(2)}|${s.dmg.toFixed(2)}|${s.speed.toFixed(2)}|${s.crit.toFixed(2)}|${s.dodge.toFixed(2)}|${s.physRes.toFixed(2)}|${s.spellRes.toFixed(2)}|${options.join(",")}|${d.flags.witch}${d.flags.worldBoss}${d.flags.dungeonBoss}${d.flags.animal}`);
  const rng = mulberry32(seed);

  // Continuous affinity: how well a move suits THIS stat line.
  const affinity = (m: typeof MOVES[number]): number => {
    const f = attackForm(m), t = moveTactic(m);
    let v = 6 + m.power * 0.5;
    // Attackers scale with the design's damage; the form that fits the build is rewarded.
    if (f !== "melee") v += (s.dmg - 1) * 22;
    if (f === "melee") v += 4 + (s.physRes + Math.max(0, s.hp - 1) * 0.5) * 20;
    if (f === "spell") v += s.spellRes * 16 + (s.dmg - 1) * 8;
    // Mobility verses suit fast, dodgy builds; heavy windups suit slow heavy hitters.
    if (t === "dash" || t === "blink" || t === "lunge" || t === "roll") v += (s.speed - 1) * 26 + s.dodge * 22;
    if (t === "heavy") v += (s.dmg - 1) * 18 + (1 - s.speed) * 14;
    // Defensive verses suit tanks, wardens and casters.
    if (t === "ward" || m.effect === "shell") v += Math.max(0, s.hp - 1) * 20 + s.spellRes * 30 + (has("warden") || has("juggernaut") ? 18 : 0);
    if (t === "heal" || m.effect === "mend") v += (d.flags.witch ? 26 : 4) + Math.max(0, s.hp - 1) * 8;
    if (t === "aura" || t === "channel") v += s.spellRes * 18 + (s.speed < 1 ? 10 : 0);
    // Crit and priority.
    v += s.crit * (m.crit ?? 0) * 1.2;
    if (s.crit > 0.1 && (m.crit ?? 0) > 8) v += 8;
    v += (m.priority ?? 0) * (1 + s.speed) * 1.5;
    // Role nudges.
    if (d.flags.worldBoss || d.flags.dungeonBoss || d.boss) v += m.power > 45 ? 14 : m.power > 30 ? 6 : 0;
    if (d.flags.animal && f === "melee") v += 8;
    // Chosen combat styles bias the kit toward their attack form.
    if (has("melee") || has("bruiser") || has("juggernaut") || has("berserker")) v += f === "melee" ? 10 : 0;
    if (has("ranged") || has("skirmisher")) v += f === "ranged" ? 10 : 0;
    if (has("spell") || has("warden")) v += f === "spell" ? 10 : 0;
    if (has("assassin") || has("lethal")) v += (m.crit ?? 0) > 8 ? 10 : 0;
    // Deterministic jitter, unique to this design — breaks ties and separates similar builds.
    v += (rng() - 0.5) * 18;
    return v;
  };

  const scored = pool.map((m) => ({ m, v: affinity(m) })).sort((a, b) => b.v - a.v);
  const want = d.flags.witch || d.flags.dungeonBoss || d.flags.worldBoss ? 4 : 3;
  const picked: string[] = [];
  // Weighted pick among the strongest few, so near-equal designs still diverge.
  const takeFrom = (cands: { m: typeof MOVES[number]; v: number }[]): void => {
    const top = cands.filter((c) => !picked.includes(c.m.id)).slice(0, 5);
    if (!top.length) return;
    const total = top.reduce((a, c) => a + Math.max(0.01, c.v), 0);
    let r = rng() * total;
    for (const c of top) { r -= Math.max(0.01, c.v); if (r <= 0) { picked.push(c.m.id); return; } }
    picked.push(top[top.length - 1]!.m.id);
  };

  // A primary attacker first, then fill across attack forms so the kit is varied, not stacked.
  takeFrom(scored.filter((c) => attackForm(c.m) !== "spell" || c.m.power > 0));
  while (picked.length < want) {
    const remaining = scored.filter((c) => !picked.includes(c.m.id));
    if (!remaining.length) break;
    const haveForms = new Set(picked.map((id) => (MOVE_BY_ID[id] ? attackForm(MOVE_BY_ID[id]!) : "")));
    const fresh = remaining.filter((c) => !haveForms.has(attackForm(c.m)));
    takeFrom(fresh.length ? fresh : remaining);
  }
  return picked.length ? picked.slice(0, want) : [pool[0]!.id];
}

/**
 * Options for the AutoStat Picker. The first group are the primitives (one lever each); the second
 * group are archetypes that set a whole feel at once. They stack — pick several and they combine,
 * then the soft clamps keep the result playable.
 */
export type StatOption =
  | "melee" | "ranged" | "spell" | "fast" | "slow" | "highDamage" | "tanky" | "physical" | "spellResist" | "crit" | "dodge"
  | "glassCannon" | "bruiser" | "juggernaut" | "assassin" | "skirmisher" | "berserker" | "warden" | "evasive" | "colossus" | "lethal";

export const STAT_OPTIONS: { id: StatOption; label: string; hint: string }[] = [
  // Primitives — single levers.
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
  // Archetypes — a whole feel at once.
  { id: "glassCannon", label: "Glass Cannon", hint: "Enormous damage and crit, but very fragile." },
  { id: "bruiser", label: "Bruiser", hint: "Hits hard up close and takes a beating. Physical." },
  { id: "juggernaut", label: "Juggernaut", hint: "Huge health and physical resist, very slow." },
  { id: "assassin", label: "Assassin", hint: "Fast, crit-heavy, high damage — but squishy." },
  { id: "skirmisher", label: "Skirmisher", hint: "Fast, evasive, ranged harasser." },
  { id: "berserker", label: "Berserker", hint: "High damage and speed, no defense." },
  { id: "warden", label: "Warden", hint: "Resilient caster: spell resist and health." },
  { id: "evasive", label: "Evasive", hint: "Very high dodge and speed, low health." },
  { id: "colossus", label: "Colossus", hint: "Immense health, slow, a bit stronger." },
  { id: "lethal", label: "Lethal", hint: "Crit chance and damage focus." },
];

/**
 * AutoStat Picker. Builds a stats line from selected combat styles. Primitives and archetypes stack
 * multiplicatively, then role flags (boss, witch, animal) nudge the result and soft clamps keep it sane.
 */
export function autoPickStats(d: EnemyDesign, options: StatOption[]): EnemyStats {
  const has = (o: StatOption) => options.includes(o);
  const s: EnemyStats = { hp: 1, dmg: 1, speed: 1, crit: 0.05, dodge: 0, physRes: 0, spellRes: 0 };

  // Primitives
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

  // Archetypes — distinct, strong feels.
  if (has("glassCannon")) { s.dmg *= 1.9; s.hp *= 0.6; s.crit += 0.1; }
  if (has("bruiser")) { s.hp *= 1.3; s.dmg *= 1.25; s.physRes += 0.1; s.speed *= 0.95; }
  if (has("juggernaut")) { s.hp *= 2.1; s.physRes += 0.24; s.spellRes += 0.08; s.speed *= 0.68; }
  if (has("assassin")) { s.speed *= 1.3; s.crit += 0.22; s.dmg *= 1.28; s.hp *= 0.7; }
  if (has("skirmisher")) { s.speed *= 1.3; s.dodge += 0.14; s.dmg *= 1.12; s.hp *= 0.9; }
  if (has("berserker")) { s.dmg *= 1.5; s.speed *= 1.2; s.hp *= 0.85; }
  if (has("warden")) { s.spellRes += 0.22; s.hp *= 1.25; s.dmg *= 1.05; }
  if (has("evasive")) { s.dodge += 0.2; s.speed *= 1.25; s.hp *= 0.8; }
  if (has("colossus")) { s.hp *= 2.6; s.speed *= 0.78; s.dmg *= 1.15; }
  if (has("lethal")) { s.crit += 0.22; s.dmg *= 1.18; }

  // Role influence
  if (d.flags?.worldBoss || d.flags?.dungeonBoss || d.boss) { s.hp *= 1.45; s.dmg *= 1.25; }
  if (d.flags?.witch) { s.spellRes += 0.1; s.dmg *= 1.12; s.hp *= 1.1; }
  if (d.flags?.animal) { s.hp *= 0.75; s.speed *= 1.12; s.dmg *= 0.9; }

  // Soft clamps so values stay in the useful range
  s.hp = Math.max(0.4, Math.min(8, s.hp));
  s.dmg = Math.max(0.5, Math.min(5, s.dmg));
  s.speed = Math.max(0.4, Math.min(2.5, s.speed));
  s.crit = Math.max(0, Math.min(0.6, s.crit));
  s.dodge = Math.max(0, Math.min(0.4, s.dodge));
  s.physRes = Math.max(0, Math.min(0.6, s.physRes));
  s.spellRes = Math.max(0, Math.min(0.6, s.spellRes));

  return s;
}

// Wire the palette-shift resolver so creature-sprites can ask for typed variants without
// importing from this module (keeps the two cycle-free).
setTypedSpriteResolver(typedSpriteCanvas);
