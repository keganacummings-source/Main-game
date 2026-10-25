import { gatherInto, pruneByLife } from "./list-util";
import {
  MONSTERS,
  MOVE_BY_ID,
  MOVES,
  RACES,
  TYPES,
  WITCH_NAMES,
  attackForm,
  attackRange,
  irand,
  moveTactic,
  mulberry32,
  nextUid,
  pick,
  rollGear,
  rollGhostLook,
  type Gear,
  type GhostLook,
  type Move,
  type RaceId,
  type Rng,
  type TypeId,
  typeMult,
} from "./content";
import { CLASSES, CLASS_BY_ID, CLASS_RACE, type ClassId, type Role, type StatMods } from "./classes";
import { directionFromDelta, type ActorDirection } from "./actor-sheets.config";
import { CombatFx } from "./combat-fx";
import { defenseVs } from "./balance";
import { TEX } from "./tex-world";
import type { GraveBody } from "./social-types";
import { drawActor, drawMonster, drawShadowName } from "./sprites";
import { geneSeedOf } from "./fx-gene";
import { drawWorldSlice, type Tile, type WorldData } from "./world";

const TILE = 32;

/* ============================================================================
 * TurboCircle — World Battle Simulator.
 *
 * One 450×450 single-continent, TURBZ-textured map. Several named factions each
 * hold Regions anchored on Objectives. Combat witches march out to take enemy
 * and neutral Objectives — battles of every size (1v1 up to 10v10) break out all
 * over the map at once. Non-combat witches HARVEST materials from the land and
 * carry them home; a full stockpile recruits a fresh combat witch. You watch and
 * see which faction swallows the continent.
 * ========================================================================== */

// --- factions ----------------------------------------------------------------

const FACTION_NAMES = [
  "Crimson Host", "Pale Court", "Ash Legion", "Tide Circle",
  "Green Compact", "Gold Pact", "Void Choir", "Rime Watch",
];
const FACTION_COLORS = [
  "#d8524a", "#c9a6e8", "#f08a24", "#5ab0e8",
  "#7dcea0", "#e6c15a", "#9a6ad8", "#cfe6ff",
];

const GHOST_CLASSES: ClassId[] = ["spiritbinder", "hexbinder", "gravemage", "veilsinger", "vigilant", "nightlord"];
const GHOSTS_BY_CLASS: Partial<Record<ClassId, number>> = {
  spiritbinder: 3, hexbinder: 2, gravemage: 2, veilsinger: 1, vigilant: 1, nightlord: 1,
};

const FIELD_CLASSES = CLASSES.filter((c) => c.id !== "cryinggirl").map((c) => c.id as ClassId);

const NAMES = [
  ...WITCH_NAMES,
  "Vellum Sax", "Nix of Salt", "Sable Quill", "Ione Marr", "Cairn Hess", "Rue the Lid",
  "Onyx Pell", "Moss Ives", "Hester Vetch", "Lumen Bret", "Silt Ama", "Bram of Glass",
  "Nell Dusk", "Pax Yarrow", "Ivy Sorrow", "Cass of Embers", "Wren Holt", "Otter Vine",
  "Isla Thorn", "Quill Mare", "Dusk Nen", "Cress Vail", "Vetch Ora", "Nim of the Well",
];

const REGION_NAMES = [
  "Ashford", "Larkfield", "Greymarch", "Thornwall", "Saltmere", "Duskhollow", "Irongate",
  "Rookspire", "Fenwatch", "Oldcairn", "Mistvale", "Hollowreach", "Blackcross", "Windmoor",
  "Stonewick", "Palehaven", "Emberlot", "Rimehold", "Gloamfen", "Highcroft", "Sorrow's End",
  "Vellacre", "Northgate", "Redmire", "Thistledown", "Crowfell", "Marrowdeep", "Wyrmrest",
];

// --- economy / pacing --------------------------------------------------------

const RECRUIT_COST = 30;          // materials to recruit one combat witch
const HARVEST_PER_TRIP = 12;      // a harvester carries this much back
const HARVEST_SECONDS = 2.8;      // time to fill a node bite
const POINT_R = TILE * 4;         // objective capture/region radius (pixels)
const POINT_R_SQ = POINT_R * POINT_R;
/** Painter's depth order: lower on the screen draws later. Hoisted out of the draw pass. */
const byDepth = (a: { y: number }, b: { y: number }) => a.y - b.y;
const CAP_RATE = 8;               // control gained per second per net attacker
const CAP_RETAKE = 9;             // owner reclaim rate
const UNIT_CAP = 190;             // hard cap on living units for performance
const PARTY_MAX = 10;             // biggest war party
const ENGAGE_R = 460;             // how far a combatant will peel off to fight a foe it meets
const SQUAD_MIN = 3;              // squads range small (skirmish) to large (siege)
const SQUAD_MAX = 7;
const COMBAT_MIN = 4;            // a faction drafts harvesters into fighters below this army size
const HARVEST_MIN = 2;          // a faction demobilizes fighters into harvesters below this many
const RESPAWN_SECONDS = 300;      // every 5 minutes a fresh objective rises somewhere reachable

// --- types -------------------------------------------------------------------

export type ArenaSpiritDef = { name: string; type: TypeId; template: number; move: string; look: GhostLook };

export type ArenaWitch = {
  uid: string;
  name: string;
  race: RaceId;
  classId: ClassId;
  cls: string;
  role: "witch" | "summoner";
  level: number;
  type: TypeId;
  maxHp: number;
  speed: number;
  moves: string[];
  weapon: Gear;
  gear: Gear[];
  spirits: ArenaSpiritDef[];
  hair: number;
  skin: number;
  mods: { might: number; ward: number; crit: number; swift: number; dmg: number };
};

export type CamMode = "free" | "follow";

type Faction = { id: number; name: string; color: string; classes: ClassId[]; alive: boolean };

type ResNode = { x: number; y: number; amount: number; cd: number };

type Objective = {
  id: number;
  name: string;
  tx: number;
  ty: number;
  x: number;
  y: number;
  owner: number;      // faction id, or -1 neutral
  control: number;    // 0..100, how far a contender has pushed
  contender: number;  // faction pushing control, or -1
  stock: number;      // materials toward the next recruit
  nodes: ResNode[];
  neighbors: number[]; // nearest objective ids, for marching targets
};

export type FactionSnap = {
  id: number;
  name: string;
  color: string;
  objectives: number;
  combat: number;
  harvesters: number;
  materials: number;
  alive: boolean;
};

export type ArenaSnap = {
  phase: "setup" | "run" | "result";
  note: string;
  speed: number;
  cam: CamMode;
  focus: number;
  clock: string;
  factionCount: number;
  objectiveCount: number;
  objectiveTotal: number;
  factions: FactionSnap[];
  events: string[];
  battles: number;
  winner: string;
  winFaction: number;
};

type Order = "defend" | "attack" | "harvest" | "return" | "muster";

type Fighter = {
  id: string;
  faction: number;
  job: "combat" | "harvester";
  role: "witch" | "summoner" | "spirit";
  name: string;
  race: RaceId | null;
  type: TypeId;
  level: number;
  x: number;
  y: number;
  hp: number;
  max: number;
  speed: number;
  facing: number;
  direction: ActorDirection;
  walk: number;
  hurt: number;
  cd: number;
  shield: number;
  root: number;
  sleep: number;
  burn: number;
  moveIds: string[];
  weapon: Gear | null;
  pieces: { slot: string; style: number; type: TypeId; fxSeed: number; quality: number; gene?: number }[];
  template: number;
  look: GhostLook | null;
  master: string;
  alive: boolean;
  dmgMul: number;
  might: number;
  ward: number;
  crit: number;
  swift: number;
  echo: number;
  double: number;
  second: boolean;
  usedSecond: boolean;
  think: number;
  stuck: number;
  lastX: number;
  lastY: number;
  path: { x: number; y: number }[];
  hair: number;
  skin: number;
  // orders
  home: number;      // objective id this unit belongs to
  order: Order;
  target: number;    // objective id the order points at
  squad: number;     // combat: which assault squad (its target objective id), -1 = none
  carry: number;     // harvester: materials held
  node: ResNode | null; // harvester: the node it is working
  harvestT: number;
};

type Flo = { x: number; y: number; text: string; life: number; color: string };
type Beam = { x0: number; y0: number; x1: number; y1: number; life: number; color: string };

const QUALITY = ["worn", "common", "fine", "rare", "epic", "legendary"];

function ench(gear: Gear[], id: string): number {
  let n = 0;
  for (const g of gear) for (const e of g.enchants) if (e.id === id) n += e.power;
  return n;
}

function rollMovesFor(classId: ClassId): string[] {
  const c = CLASS_BY_ID[classId] as { signature?: string; starterMoves?: string[] };
  const want = [c.signature ?? "", ...(c.starterMoves ?? [])].filter((id) => id && MOVE_BY_ID[id]);
  const out: string[] = [];
  for (const id of want) if (!out.includes(id) && out.length < 6) out.push(id);
  if (!out.length) out.push("measured");
  return out;
}

/** Build one modern witch of a class, kitted and stat-leaned to match it. */
export function witchFromClass(rng: Rng, classId: ClassId, level: number, ghosts = GHOSTS_BY_CLASS[classId] ?? 0): ArenaWitch {
  const c = CLASS_BY_ID[classId] as unknown as { name: string; type: TypeId; role: Role; stats: StatMods };
  const race = CLASS_RACE[classId] ?? "vesper";
  const raceInfo = RACES.find((r) => r.id === race) ?? RACES[0]!;
  const stats = c.stats ?? {};
  const role: "witch" | "summoner" = ghosts > 0 ? "summoner" : "witch";

  const gearLevel = Math.max(1, Math.round(level * (0.7 + rng() * 0.4)));
  const luck = 10 + irand(rng, 30);
  const weapon = rollGear(rng, { level: gearLevel, slot: "weapon", luck, raceBias: race, typeBias: rng() < 0.75 ? c.type : null });
  const slots = ["head", "chest", "legs", "feet", "relic"] as const;
  const gear = slots.map((slot) =>
    rollGear(rng, { level: Math.max(1, gearLevel - irand(rng, 2)), slot, luck: Math.max(0, luck - 5), raceBias: race, typeBias: rng() < 0.5 ? c.type : null }),
  );
  const moves = rollMovesFor(classId);

  const spirits: ArenaSpiritDef[] = [];
  for (let i = 0; i < ghosts; i++) {
    const pool = MONSTERS.filter((m) => m.type === c.type || m.type === "spirit" || m.type === "void");
    const spec = pool.length ? pick(rng, pool) : MONSTERS[0]!;
    const bag = MOVES.filter((m) => m.type === c.type && m.power > 0 && m.power < 56);
    const move = (bag.length ? pick(rng, bag) : MOVES[0]!).id;
    spirits.push({ name: spec.name, type: c.type, template: spec.template, move, look: rollGhostLook(rng, 1, move, "hunt") });
  }

  const roleHp = c.role === "Tank" ? 1.22 : c.role === "Caster" ? 0.9 : c.role === "Support" ? 1.02 : 1;
  const hpMul = 1 + (stats.hp ?? 0) / 100 + (stats.guard ?? 0) / 340;
  const maxHp = Math.floor((82 + level * 16) * roleHp * hpMul);
  const speed = Math.max(44, Math.floor(70 + level * 0.3 + (stats.speed ?? 0) * 0.55 - (stats.guard ?? 0) * 0.12));

  return {
    uid: nextUid(),
    name: pick(rng, NAMES),
    race,
    classId,
    cls: c.name,
    role,
    level,
    type: c.type,
    maxHp,
    speed,
    moves,
    weapon,
    gear,
    spirits,
    hair: raceInfo.hair,
    skin: irand(rng, 5),
    mods: {
      might: stats.might ?? 0,
      ward: stats.guard ?? 0,
      crit: stats.crit ?? 0,
      swift: stats.haste ?? 0,
      dmg: 1 + (stats.arcana ?? 0) * 0.004 + (stats.leech ?? 0) * 0.002,
    },
  };
}

class Heap {
  private a: { i: number; c: number }[] = [];
  clear(): void { this.a.length = 0; }
  push(i: number, c: number): void {
    const a = this.a;
    a.push({ i, c });
    let n = a.length - 1;
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (a[p]!.c <= a[n]!.c) break;
      const t = a[p]!; a[p] = a[n]!; a[n] = t; n = p;
    }
  }
  pop(): { i: number; c: number } | null {
    const a = this.a;
    if (!a.length) return null;
    const top = a[0]!;
    const last = a.pop();
    if (a.length && last) {
      a[0] = last;
      let n = 0;
      for (;;) {
        const l = n * 2 + 1, r = l + 1;
        let m = n;
        if (l < a.length && a[l]!.c < a[m]!.c) m = l;
        if (r < a.length && a[r]!.c < a[m]!.c) m = r;
        if (m === n) break;
        const t = a[m]!; a[m] = a[n]!; a[n] = t; n = m;
      }
    }
    return top;
  }
}

function los(grid: Uint8Array, w: number, h: number, x0: number, y0: number, x1: number, y1: number): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 12));
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const tx = Math.floor((x0 + (x1 - x0) * t) / TILE);
    const ty = Math.floor((y0 + (y1 - y0) * t) / TILE);
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) return false;
    if (grid[ty * w + tx] === 1) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// World generation: one TURBZ-textured continent, no islands.
// ---------------------------------------------------------------------------

type BiomeArt = { ground: string; patch: string; patchAt: number; tree: string; treeType: TypeId };
const CONTINENT_BIOMES: BiomeArt[] = [
  { ground: TEX.grass, patch: TEX.flowers, patchAt: 0.74, tree: TEX.treePlains, treeType: "earth" },
  { ground: TEX.swampFloor, patch: TEX.grass, patchAt: 0.7, tree: TEX.treeSwamp, treeType: "water" },
  { ground: TEX.sand, patch: TEX.dirt, patchAt: 0.78, tree: TEX.treeDesert, treeType: "air" },
  { ground: TEX.snow, patch: TEX.ice, patchAt: 0.7, tree: TEX.treeSnow, treeType: "ice" },
  { ground: TEX.hellFloor, patch: TEX.stone, patchAt: 0.78, tree: TEX.treeHell, treeType: "fire" },
];

export type SimWorld = {
  grid: Uint8Array; // 0 open land, 1 blocked (ocean/tree/mountain), 3 slow (shallows/mud)
  w: number;
  h: number;
  world: WorldData;
  land: Uint8Array; // 1 = walkable land tile
};

function valueNoise(seed: number) {
  const r = (x: number, y: number) => {
    let n = (x * 374761393 + y * 668265263 + seed * 69069) >>> 0;
    n = (n ^ (n >>> 13)) * 1274126177 >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  return (x: number, y: number, scale: number) => {
    const gx = x / scale, gy = y / scale;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = r(x0, y0), b = r(x0 + 1, y0), c = r(x0, y0 + 1), d = r(x0 + 1, y0 + 1);
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
  };
}

export function buildSimWorld(rng: Rng, size = 450): SimWorld {
  const w = size, h = size;
  const seed = (rng() * 1e9) >>> 0 || 1;
  const noise = valueNoise(seed);
  const biomeNoise = valueNoise(seed ^ 0x9e3779b1);
  const cx = w / 2, cy = h / 2;
  const maxR = Math.min(w, h) * 0.46;

  // 1) Landmask: a single blob — radial falloff plus low-frequency noise, thresholded.
  const land = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx, y - cy) / maxR;        // 0 centre … 1 edge
      const coast = noise(x, y, 60) * 0.55 + noise(x, y, 22) * 0.25;
      const v = coast + (1 - d * d) * 0.6;                // high in the middle
      if (v > 0.62) land[y * w + x] = 1;
    }
  }
  // Keep only the largest connected landmass (kills islands), then smooth edges.
  keepLargest(land, w, h);
  for (let pass = 0; pass < 2; pass++) smoothLand(land, w, h);
  keepLargest(land, w, h);

  // 2) Tiles + collision grid.
  const grid = new Uint8Array(w * h);
  const tiles: Tile[] = new Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!land[i]) {
        // ocean: deep offshore, shallow at the coast.
        const nearLand = hasLandNeighbor(land, w, h, x, y, 2);
        tiles[i] = { floor: 2, biome: 5, block: 1, decor: 0, sprite: nearLand ? TEX.water : TEX.deep };
        grid[i] = 1;
        continue;
      }
      // biome by a big smooth field so each region has a texture.
      const bn = biomeNoise(x, y, 120);
      const bi = Math.min(CONTINENT_BIOMES.length - 1, Math.floor(bn * CONTINENT_BIOMES.length));
      const art = CONTINENT_BIOMES[bi]!;
      const patch = noise(x, y, 9) > art.patchAt;
      tiles[i] = { floor: 0, biome: 2, block: 0, decor: 0, sprite: patch ? art.patch : art.ground };
      grid[i] = 0;
    }
  }

  // 3) Forests (blocking trees as 64px layers) and a few mountains, kept off the coast edge.
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      if (!land[i] || grid[i] !== 0) continue;
      const bn = biomeNoise(x, y, 120);
      const art = CONTINENT_BIOMES[Math.min(CONTINENT_BIOMES.length - 1, Math.floor(bn * CONTINENT_BIOMES.length))]!;
      const forest = noise(x, y, 7);
      if (forest > 0.80 && noise(x, y, 2) > 0.45) {
        tiles[i] = { ...tiles[i]!, layers: [art.tree], block: 1 };
        grid[i] = 1;
      }
    }
  }

  const world: WorldData = { w, h, tiles, spawns: [], cache: null };
  return { grid, w, h, world, land };
}

function keepLargest(land: Uint8Array, w: number, h: number): void {
  const comp = new Int32Array(w * h).fill(-1);
  let best = -1, bestSize = 0, id = 0;
  const q = new Int32Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (!land[s] || comp[s] !== -1) continue;
    let qi = 0, qn = 0; q[qn++] = s; comp[s] = id; let size = 0;
    while (qi < qn) {
      const cur = q[qi++]!; size++;
      const x = cur % w, y = (cur / w) | 0;
      if (x > 0) { const k = cur - 1; if (land[k] && comp[k] === -1) { comp[k] = id; q[qn++] = k; } }
      if (x < w - 1) { const k = cur + 1; if (land[k] && comp[k] === -1) { comp[k] = id; q[qn++] = k; } }
      if (y > 0) { const k = cur - w; if (land[k] && comp[k] === -1) { comp[k] = id; q[qn++] = k; } }
      if (y < h - 1) { const k = cur + w; if (land[k] && comp[k] === -1) { comp[k] = id; q[qn++] = k; } }
    }
    if (size > bestSize) { bestSize = size; best = id; }
    id++;
  }
  for (let s = 0; s < w * h; s++) land[s] = comp[s] === best ? 1 : 0;
}

function smoothLand(land: Uint8Array, w: number, h: number): void {
  const copy = land.slice();
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (copy[(y + dy) * w + (x + dx)]) n++;
      land[y * w + x] = n >= 5 ? 1 : 0;
    }
  }
  // Never let the very border be land.
  for (let x = 0; x < w; x++) { land[x] = 0; land[(h - 1) * w + x] = 0; }
  for (let y = 0; y < h; y++) { land[y * w] = 0; land[y * w + w - 1] = 0; }
}

function hasLandNeighbor(land: Uint8Array, w: number, h: number, x: number, y: number, r: number): boolean {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < w && ny < h && land[ny * w + nx]) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------

export class WitchArena {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  phase: ArenaSnap["phase"] = "setup";
  note = "Set the factions and objectives, then begin the war.";
  speed = 1;
  camMode: CamMode = "free";
  focus = 0;

  factionCount = 5;
  objectiveCount = 12;

  world: WorldData | null = null;
  grid: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  land: Uint8Array = new Uint8Array(0);
  gw = 450;
  gh = 450;

  factions: Faction[] = [];
  objectives: Objective[] = [];
  fighters: Fighter[] = [];
  events: string[] = [];
  age = 0;
  clock = 0;
  winner = "";
  winFaction = -1;
  commandT = 0;
  respawnT = RESPAWN_SECONDS;
  private squadCentroid = new Map<string, { x: number; y: number; n: number }>();
  private nextRegionName = 0;

  camX = 0;
  camY = 0;
  zoom = 0.3;
  wantX = 0;
  wantY = 0;
  wantZ = 0.3;
  floats: Flo[] = [];
  beams: Beam[] = [];
  cfx = new CombatFx();
  /** Scratch array for the draw order, reused every frame so the visible set costs no allocation. */
  private drawOrder: Fighter[] = [];
  /** The visible half-extents the draw pass is currently using, read by `isVisibleFighter`. */
  private visibleHalfW = 0;
  private visibleHalfH = 0;
  /** Bound once, so the per-frame gather does not build a new closure. */
  private isVisibleFighter = (f: Fighter): boolean =>
    f.alive && Math.abs(f.x - this.camX) < this.visibleHalfW && Math.abs(f.y - this.camY) < this.visibleHalfH;
  /** Garrison tallies per objective, refilled once per frame instead of once per objective. */
  private garrisonCount: number[] = [];

  onCloud: (save: unknown) => void = () => {};
  onGrave: (body: GraveBody) => void = () => {};

  private keys = new Set<string>();
  private drag: { x: number; y: number; camX: number; camY: number; moved: boolean } | null = null;
  private running = false;
  private raf = 0;
  private lastT = 0;
  private viewW = 800;
  private viewH = 600;
  private dpr = 1;
  private fitted = false;
  private pubAt = 0;
  private pathBudget = 10;
  private seed = 1;
  private minZoom = 0.3;
  private mini: HTMLCanvasElement | null = null;
  private miniRect: { x: number; y: number; w: number; h: number } | null = null;
  // route scratch with generation stamps (no O(n) fills)
  private gen = 1;
  private seen = new Int32Array(0);
  private dist = new Float32Array(0);
  private prev = new Int32Array(0);
  private heap = new Heap();
  private listeners = new Set<() => void>();
  private snap: ArenaSnap = this.blankSnap();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    this.ctx = ctx;
  }

  private blankSnap(): ArenaSnap {
    return {
      phase: "setup", note: "", speed: 1, cam: "free", focus: 0, clock: "0:00",
      factionCount: 5, objectiveCount: 12, objectiveTotal: 12, factions: [], events: [],
      battles: 0, winner: "", winFaction: -1,
    };
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    fn();
    return () => this.listeners.delete(fn);
  }

  getSnap(): ArenaSnap { return this.snap; }

  start(seed: unknown): void {
    this.running = true;
    this.lastT = performance.now();
    this.resize();
    this.seed = (typeof seed === "number" ? seed : Date.now()) >>> 0 || 1;
    this.regen();
    this.note = "One continent, many factions. Set the numbers and begin.";
    this.bind();
    this.publish();
    const loop = (t: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - this.lastT) / 1000);
      this.lastT = t;
      if (!this.fitted && this.viewW > 8) {
        this.resize();
        this.fitMap();
        this.fitted = true;
      }
      if (this.phase === "run") this.step(dt * this.speed);
      else this.clock += dt;
      this.driveCam(dt);
      this.draw();
      this.pubAt -= dt;
      if (this.phase !== "setup" && this.pubAt <= 0) {
        this.pubAt = 0.5;
        this.publish();
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.unbind();
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.viewW = Math.max(1, r.width);
    this.viewH = Math.max(1, r.height);
    this.canvas.width = Math.max(1, Math.floor(this.viewW * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(this.viewH * this.dpr));
    this.computeMinZoom();
  }

  /** Smallest zoom that keeps drawWorldSlice on its fast cached-window path (under its ~4M px cap). */
  private computeMinZoom(): void {
    const CAP = 3.9 * 1024 * 1024;
    let z = 0.12;
    for (; z < 0.9; z += 0.02) {
      const wpx = Math.ceil((this.viewW / z + 300) / TILE) * TILE;
      const hpx = Math.ceil((this.viewH / z + 300) / TILE) * TILE;
      if (wpx * hpx <= CAP) break;
    }
    this.minZoom = Math.min(0.9, Math.max(0.12, z));
    if (this.zoom < this.minZoom) this.zoom = this.minZoom;
  }

  // --- setup ----------------------------------------------------------------

  private regen(): void {
    const m = buildSimWorld(mulberry32(this.seed), 450);
    this.grid = m.grid;
    this.land = m.land;
    this.gw = m.w;
    this.gh = m.h;
    this.world = m.world;
    this.seen = new Int32Array(m.w * m.h);
    this.dist = new Float32Array(m.w * m.h);
    this.prev = new Int32Array(m.w * m.h);
    this.gen = 1;
    this.fighters = [];
    this.objectives = [];
    this.factions = [];
    this.buildMinimap();
    this.fitMap();
  }

  /** A 1px-per-tile terrain picture of the whole continent, built once, for the HUD minimap overlay. */
  private buildMinimap(): void {
    if (typeof document === "undefined" || !this.world) { this.mini = null; return; }
    const c = document.createElement("canvas");
    c.width = this.gw; c.height = this.gh;
    const g = c.getContext("2d");
    if (!g) { this.mini = null; return; }
    const img = g.createImageData(this.gw, this.gh);
    const d = img.data;
    const put = (i: number, r: number, gg: number, b: number) => { const k = i * 4; d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = 255; };
    for (let i = 0; i < this.gw * this.gh; i++) {
      if (!this.land[i]) {
        const t = this.world.tiles[i];
        if (t?.sprite === TEX.water) put(i, 36, 92, 132); else put(i, 16, 48, 78);
      } else if (this.grid[i] === 1) {
        put(i, 32, 64, 40); // forest/mountain
      } else {
        const t = this.world.tiles[i];
        const sp = t?.sprite;
        if (sp === TEX.sand) put(i, 150, 134, 92);
        else if (sp === TEX.snow || sp === TEX.ice) put(i, 170, 184, 198);
        else if (sp === TEX.hellFloor || sp === TEX.stone) put(i, 110, 78, 70);
        else if (sp === TEX.swampFloor) put(i, 72, 92, 70);
        else put(i, 86, 128, 74); // grass
      }
    }
    g.putImageData(img, 0, 0);
    this.mini = c;
  }

  newWorld(): void {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0 || 1;
    this.phase = "setup";
    this.winner = "";
    this.winFaction = -1;
    this.events = [];
    this.regen();
    this.note = "A fresh continent. Set the factions and begin.";
    this.publish();
  }

  setFactionCount(n: number): void {
    this.factionCount = Math.max(2, Math.min(FACTION_NAMES.length, Math.round(n) || 2));
    this.publish();
  }

  setObjectiveCount(n: number): void {
    this.objectiveCount = Math.max(this.factionCount, Math.min(REGION_NAMES.length, Math.round(n) || 6));
    this.publish();
  }

  setSpeed(n: number): void {
    this.speed = n >= 6 ? 6 : n >= 3 ? 3 : n >= 2 ? 2 : 1;
    this.publish();
  }

  setCam(mode: CamMode): void {
    this.camMode = mode;
    if (mode === "follow") this.frameFaction(this.focus);
    this.publish();
  }

  followFaction(id: number): void {
    this.focus = ((id % this.factions.length) + this.factions.length) % this.factions.length;
    this.camMode = "follow";
    this.frameFaction(this.focus);
    this.camX = this.wantX; this.camY = this.wantY;
    this.publish();
  }

  cycleFocus(dir: number): void {
    if (!this.factions.length) return;
    this.followFaction(this.focus + dir);
  }

  /** Jump the camera to the biggest live battle. */
  jumpBattle(): void {
    const spot = this.biggestBattle();
    if (!spot) return;
    this.camMode = "free";
    this.camX = this.wantX = spot.x;
    this.camY = this.wantY = spot.y;
    this.zoom = this.wantZ = Math.max(this.zoom, 0.8);
    this.publish();
  }

  zoomBy(factor: number): void {
    this.zoom = Math.max(this.minZoom, Math.min(2.2, this.zoom * factor));
    if (this.phase !== "setup") this.camMode = "free";
    this.publish();
  }

  // --- launch ---------------------------------------------------------------

  begin(): void {
    if (!this.world) this.regen();
    const rng = mulberry32((this.seed ^ 0xabcdef) >>> 0 || 7);
    this.fighters = [];
    this.floats = [];
    this.beams = [];
    this.cfx = new CombatFx();
    this.events = [];
    this.age = 0;
    this.clock = 0;
    this.commandT = 0;
    this.respawnT = RESPAWN_SECONDS;
    this.winner = "";
    this.winFaction = -1;

    this.buildFactions(rng);
    this.placeObjectives(rng);
    this.seedStartingForces(rng);

    this.phase = "run";
    this.camMode = "free";
    this.fitMap();
    this.note = "The war is on. Watch the continent change hands.";
    this.log("The war begins across the continent.");
    this.publish();
    this.resize();
  }

  again(): void { this.begin(); }

  backSetup(): void {
    this.phase = "setup";
    this.fighters = [];
    this.winner = "";
    this.winFaction = -1;
    this.cfx = new CombatFx();
    this.beams = [];
    this.floats = [];
    this.fitMap();
    this.note = "Change the factions or the objectives, then begin again.";
    this.publish();
  }

  private buildFactions(rng: Rng): void {
    const pool = [...FIELD_CLASSES];
    // shuffle
    for (let i = pool.length - 1; i > 0; i--) { const j = irand(rng, i + 1); const t = pool[i]!; pool[i] = pool[j]!; pool[j] = t; }
    this.factions = [];
    for (let f = 0; f < this.factionCount; f++) {
      const classes: ClassId[] = [];
      // one guaranteed ghost-caller so every faction fields ghosts
      classes.push(pick(rng, GHOST_CLASSES));
      // Walk the shuffled pool with an index that ALWAYS advances, so a duplicate can never hang this.
      for (let idx = 0; classes.length < 5 && idx < pool.length; idx++) {
        const c = pool[(f * 5 + idx) % pool.length]!;
        if (!classes.includes(c)) classes.push(c);
      }
      this.factions.push({ id: f, name: FACTION_NAMES[f]!, color: FACTION_COLORS[f]!, classes, alive: true });
    }
  }

  private placeObjectives(rng: Rng): void {
    // Collect candidate land tiles well inside the coast.
    const cand: number[] = [];
    for (let y = 6; y < this.gh - 6; y += 2) {
      for (let x = 6; x < this.gw - 6; x += 2) {
        const i = y * this.gw + x;
        if (this.grid[i] === 0 && this.land[i] && this.openAround(x, y, 3)) cand.push(i);
      }
    }
    const names = [...REGION_NAMES];
    for (let i = names.length - 1; i > 0; i--) { const j = irand(rng, i + 1); const t = names[i]!; names[i] = names[j]!; names[j] = t; }
    const objs: Objective[] = [];
    const minSep = Math.max(18, Math.floor(this.gw / (Math.sqrt(this.objectiveCount) * 2.4)));
    let guard = 0;
    while (objs.length < this.objectiveCount && cand.length && guard++ < 20000) {
      const pickIdx = irand(rng, cand.length);
      const i = cand[pickIdx]!;
      const tx = i % this.gw, ty = (i / this.gw) | 0;
      let ok = true;
      for (const o of objs) if (Math.hypot(o.tx - tx, o.ty - ty) < minSep) { ok = false; break; }
      if (!ok) continue;
      const o: Objective = {
        id: objs.length, name: names[objs.length % names.length]!,
        tx, ty, x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2,
        owner: -1, control: 0, contender: -1, stock: 0, nodes: [], neighbors: [],
      };
      this.makeNodes(o, rng);
      objs.push(o);
    }
    this.objectives = objs;
    // neighbor links (nearest 3)
    for (const o of objs) {
      o.neighbors = objs.filter((p) => p.id !== o.id).sort((a, b) => dist2(a, o) - dist2(b, o)).slice(0, 3).map((p) => p.id);
    }
    // Assign each faction a starting home objective, spread apart.
    const homes: Objective[] = [];
    for (let f = 0; f < this.factions.length; f++) {
      let best: Objective | null = null, bestScore = -1;
      for (const o of objs) {
        if (homes.includes(o)) continue;
        const near = homes.length ? Math.min(...homes.map((hh) => Math.hypot(hh.tx - o.tx, hh.ty - o.ty))) : 1e9;
        if (near > bestScore) { bestScore = near; best = o; }
      }
      if (best) { best.owner = f; best.stock = RECRUIT_COST; homes.push(best); }
    }
  }

  private makeNodes(o: Objective, rng: Rng): void {
    const want = 3 + irand(rng, 3);
    let tries = 0;
    while (o.nodes.length < want && tries++ < 80) {
      const ang = rng() * Math.PI * 2;
      const r = (1.4 + rng() * 2.4) * POINT_R;
      const x = o.x + Math.cos(ang) * r;
      const y = o.y + Math.sin(ang) * r;
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      if (tx < 2 || ty < 2 || tx >= this.gw - 2 || ty >= this.gh - 2) continue;
      if (this.grid[ty * this.gw + tx] !== 0) continue;
      o.nodes.push({ x, y, amount: 1, cd: 0 });
    }
  }

  private openAround(tx: number, ty: number, r: number): boolean {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= this.gw || y >= this.gh) return false;
      if (this.grid[y * this.gw + x] === 1) return false;
    }
    return true;
  }

  private seedStartingForces(rng: Rng): void {
    for (const o of this.objectives) {
      if (o.owner < 0) continue;
      for (let i = 0; i < 7; i++) this.recruitCombat(o, rng);
      for (let i = 0; i < 3; i++) this.recruitHarvester(o, rng);
    }
  }

  // --- unit creation --------------------------------------------------------

  private recruitCombat(o: Objective, rng: Rng): Fighter | null {
    if (this.aliveCount() >= UNIT_CAP) return null;
    const fac = this.factions[o.owner]!;
    const classId = pick(rng, fac.classes);
    const level = 8 + irand(rng, 12);
    const w = witchFromClass(rng, classId, level);
    const spot = this.openSpotNear(o.tx, o.ty, rng);
    const body = this.spawnWitch(w, o.owner, "combat", o.id, spot.tx, spot.ty, rng);
    body.order = "defend"; body.target = o.id;
    return body;
  }

  private recruitHarvester(o: Objective, rng: Rng): Fighter | null {
    if (this.aliveCount() >= UNIT_CAP) return null;
    const fac = this.factions[o.owner]!;
    const classId = pick(rng, fac.classes);
    const w = witchFromClass(rng, classId, 4 + irand(rng, 4), 0);
    const spot = this.openSpotNear(o.tx, o.ty, rng);
    const body = this.spawnWitch(w, o.owner, "harvester", o.id, spot.tx, spot.ty, rng);
    body.order = "harvest"; body.target = o.id;
    body.speed *= 1.05;
    return body;
  }

  private openSpotNear(tx: number, ty: number, rng: Rng): { tx: number; ty: number } {
    for (let r = 1; r < 10; r++) {
      for (let k = 0; k < 8; k++) {
        const a = rng() * Math.PI * 2;
        const x = Math.round(tx + Math.cos(a) * r), y = Math.round(ty + Math.sin(a) * r);
        if (x > 1 && y > 1 && x < this.gw - 1 && y < this.gh - 1 && this.grid[y * this.gw + x] === 0) return { tx: x, ty: y };
      }
    }
    return { tx, ty };
  }

  private spawnWitch(w: ArenaWitch, faction: number, job: "combat" | "harvester", home: number, tx: number, ty: number, rng: Rng): Fighter {
    const gear = [w.weapon, ...w.gear];
    const id = nextUid();
    const body = this.makeBody(w, faction, job, home, tx, ty, id, "", w.role, w.mods.dmg);
    body.moveIds = w.moves;
    body.might = ench(gear, "might") + w.mods.might;
    body.ward = ench(gear, "ward") + w.mods.ward;
    body.crit = 4 + ench(gear, "crit_edge") + w.mods.crit;
    body.swift = ench(gear, "swift") + w.mods.swift;
    body.echo = ench(gear, "echo_guard");
    body.double = ench(gear, "double_strike");
    body.second = ench(gear, "second_chance") > 0;
    this.fighters.push(body);
    if (job === "combat") {
      w.spirits.forEach((s, i) => {
        const spot = this.openNear(tx, ty, i);
        const spirit = this.makeBody(
          { name: s.name, race: w.race, type: s.type, level: w.level, maxHp: Math.floor((78 + w.level * 16) * 0.22), speed: Math.floor(68 + w.level * 0.2), moves: [s.move], weapon: w.weapon, gear: w.gear, hair: w.hair, skin: w.skin },
          faction, "combat", home, spot.tx, spot.ty, nextUid(), id, "spirit", 0.34,
        );
        spirit.template = s.template; spirit.look = s.look; spirit.race = null; spirit.pieces = []; spirit.weapon = null;
        spirit.moveIds = [s.move]; spirit.walk = rng() * 4;
        this.fighters.push(spirit);
      });
    }
    return body;
  }

  private openNear(tx: number, ty: number, i: number): { tx: number; ty: number } {
    const opts = [[tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1], [tx + 1, ty + 1], [tx - 1, ty - 1]];
    const [x, y] = opts[i % opts.length]!;
    if (x > 0 && y > 0 && x < this.gw - 1 && y < this.gh - 1 && this.grid[y * this.gw + x] !== 1) return { tx: x, ty: y };
    return { tx, ty };
  }

  private makeBody(
    w: Pick<ArenaWitch, "name" | "race" | "type" | "level" | "maxHp" | "speed" | "moves" | "weapon" | "gear" | "hair" | "skin">,
    faction: number, job: "combat" | "harvester", home: number, tx: number, ty: number, id: string, master: string, role: Fighter["role"], dmgMul: number,
  ): Fighter {
    const pieces = [w.weapon, ...w.gear].map((g) => ({ slot: g.slot, style: g.style, type: g.type, fxSeed: g.fxSeed, gene: geneSeedOf(g), quality: Math.max(0, QUALITY.indexOf(g.quality)) }));
    return {
      id, faction, job, role,
      name: w.name, race: w.race, type: w.type, level: w.level,
      x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2,
      hp: w.maxHp, max: w.maxHp, speed: w.speed, facing: 1, direction: "down",
      walk: 0, hurt: 0, cd: 0.25 + Math.random() * 0.45, shield: 0, root: 0, sleep: 0, burn: 0,
      moveIds: w.moves, weapon: w.weapon, pieces, template: 20, look: null, master,
      alive: true, dmgMul, might: 0, ward: 0, crit: 4, swift: 0, echo: 0, double: 0,
      second: false, usedSecond: false, think: Math.random() * 0.3, stuck: 0,
      lastX: tx * TILE, lastY: ty * TILE, path: [], hair: w.hair, skin: w.skin,
      home, order: "muster", target: home, squad: -1, carry: 0, node: null, harvestT: 0,
    };
  }

  // --- simulation -----------------------------------------------------------

  private aliveCount(): number {
    let n = 0;
    for (const f of this.fighters) if (f.alive && f.role !== "spirit") n++;
    return n;
  }

  private step(dt: number): void {
    this.age += dt;
    this.clock += dt;
    this.pathBudget = 12;

    // economy: harvesters refill nodes slowly so the map never runs dry
    for (const o of this.objectives) for (const nd of o.nodes) if (nd.amount < 1) { nd.cd -= dt; if (nd.cd <= 0) { nd.amount = 1; } }

    // squad centroids (so units march in a clump toward their shared target)
    this.squadCentroid.clear();
    for (const f of this.fighters) {
      if (!f.alive || f.job !== "combat" || f.role === "spirit" || f.order !== "attack") continue;
      const key = `${f.faction}:${f.squad}`;
      const c = this.squadCentroid.get(key) ?? { x: 0, y: 0, n: 0 };
      c.x += f.x; c.y += f.y; c.n++;
      this.squadCentroid.set(key, c);
    }
    for (const c of this.squadCentroid.values()) if (c.n) { c.x /= c.n; c.y /= c.n; }

    // every few minutes, a fresh neutral objective rises somewhere reachable — guarantees new battles
    this.respawnT -= dt;
    if (this.respawnT <= 0) { this.respawnT = RESPAWN_SECONDS; this.respawnObjective(); }

    // per-fighter update
    for (const f of this.fighters) {
      if (!f.alive) continue;
      f.hurt = Math.max(0, f.hurt - dt * 3);
      f.walk += dt * (f.path.length ? 5 : 1.2);
      f.cd = Math.max(0, f.cd - dt);
      f.shield = Math.max(0, f.shield - dt);
      f.root = Math.max(0, f.root - dt);
      f.sleep = Math.max(0, f.sleep - dt);
      f.burn = Math.max(0, f.burn - dt);
      if (f.burn > 0) this.hurt(f, (3 + f.level * 0.15) * dt, "#e25a32");
      const tx = Math.floor(f.x / TILE), ty = Math.floor(f.y / TILE);
      const cell = this.grid[ty * this.gw + tx] ?? 1;
      if (f.sleep > 0) continue;
      f.think -= dt;
      if (f.think <= 0) { f.think = 0.34 + Math.random() * 0.2; this.think(f, dt); }
      if (f.job === "harvester") this.harvestTick(f, dt);
      if (f.root <= 0) this.follow(f, dt, cell === 3);
      if (f.job !== "harvester") this.strike(f);
    }

    this.captureTick(dt);

    // faction command & economy tick
    this.commandT -= dt;
    if (this.commandT <= 0) { this.commandT = 1.1; this.command(); }

    this.cfx.tick(dt);
    for (const b of this.beams) b.life -= dt;
    pruneByLife(this.beams);
    for (const fl of this.floats) fl.life -= dt;
    pruneByLife(this.floats);

    // prune dead non-spirits occasionally to keep arrays small
    if (this.fighters.length > 600) this.fighters = this.fighters.filter((f) => f.alive);

    if (this.age > 1.5) this.checkWin();
  }

  private obj(id: number): Objective | null { return this.objectives[id] ?? null; }

  // ----- AI -----------------------------------------------------------------

  private think(f: Fighter, _dt: number): void {
    if (f.role === "spirit") {
      const master = this.fighters.find((a) => a.id === f.master && a.alive);
      if (master) { const ang = Math.atan2(f.y - master.y, f.x - master.x) || 0; this.seek(f, master.x + Math.cos(ang) * 26, master.y + Math.sin(ang) * 20); }
      return;
    }
    if (f.job === "harvester") { this.thinkHarvester(f); return; }
    this.thinkCombat(f);
  }

  private thinkHarvester(f: Fighter): void {
    // Flee if an enemy combatant is close.
    const threat = this.nearestEnemyCombat(f, 200);
    if (threat) {
      const home = this.obj(f.home) ?? this.ownedNearest(f.faction, f.x, f.y);
      const to = home ?? { x: f.x, y: f.y };
      this.seek(f, to.x, to.y);
      f.node = null;
      return;
    }
    if (f.carry >= HARVEST_PER_TRIP) {
      // return to home objective
      const home = this.obj(f.home)?.owner === f.faction ? this.obj(f.home) : this.ownedNearest(f.faction, f.x, f.y);
      if (!home) return;
      f.target = home.id;
      if (Math.hypot(f.x - home.x, f.y - home.y) <= POINT_R * 0.8) {
        home.stock += f.carry; f.carry = 0; f.node = null;
      } else this.seek(f, home.x, home.y);
      return;
    }
    // find a node near any owned objective
    if (!f.node || f.node.amount <= 0) f.node = this.pickNode(f);
    if (f.node) {
      if (Math.hypot(f.x - f.node.x, f.y - f.node.y) > 24) this.seek(f, f.node.x, f.node.y);
      else f.path = [];
    } else {
      const home = this.obj(f.home);
      if (home) this.seek(f, home.x, home.y);
    }
  }

  private harvestTick(f: Fighter, dt: number): void {
    if (!f.node || f.carry >= HARVEST_PER_TRIP) return;
    if (Math.hypot(f.x - f.node.x, f.y - f.node.y) > 26) return;
    f.harvestT += dt;
    if (f.harvestT >= HARVEST_SECONDS) {
      f.harvestT = 0;
      f.carry += 4;
      f.node.amount = 0; f.node.cd = 6 + Math.random() * 6;
      this.float(f.x, f.y - 26, "+mat", "#d8c48a");
      f.node = null;
    }
  }

  private pickNode(f: Fighter): ResNode | null {
    let best: ResNode | null = null, bd = 1e9;
    for (const o of this.objectives) {
      if (o.owner !== f.faction && o.owner !== -1) continue; // harvest own or neutral land
      for (const nd of o.nodes) {
        if (nd.amount <= 0) continue;
        const d = Math.hypot(nd.x - f.x, nd.y - f.y);
        if (d < bd) { bd = d; best = nd; }
      }
    }
    return best;
  }

  private thinkCombat(f: Fighter): void {
    // Peel off to fight any enemy you run into — this is what makes field battles happen everywhere.
    const foe = this.nearestEnemy(f, ENGAGE_R);
    if (foe) { this.engage(f, foe); return; }
    // No one near: move toward the order's objective.
    const o = this.obj(f.target) ?? this.obj(f.home);
    if (!o) return;
    const d = Math.hypot(f.x - o.x, f.y - o.y);
    if (f.order === "attack") {
      if (d > POINT_R * 0.7) {
        // March as a squad: steer toward a blend of the objective and the squad's centre.
        const c = this.squadCentroid.get(`${f.faction}:${f.squad}`);
        let gx = o.x, gy = o.y;
        if (c && c.n > 1) { gx = o.x * 0.68 + c.x * 0.32; gy = o.y * 0.68 + c.y * 0.32; }
        this.seek(f, gx, gy);
        return;
      }
      const s = this.ringSlot(f, o, POINT_R * 0.5);
      this.seek(f, s.x, s.y);
      return;
    }
    // defend: ring the home objective
    const ring = POINT_R * 1.2;
    if (d > ring) this.seek(f, o.x, o.y);
    else { const s = this.ringSlot(f, o, ring * 0.8); if (Math.hypot(f.x - s.x, f.y - s.y) > 20) this.seek(f, s.x, s.y); else f.path = []; }
  }

  private ringSlot(f: Fighter, o: Objective, radius: number): { x: number; y: number } {
    const seed = (f.x * 0.013 + f.y * 0.017);
    const ang = (seed % (Math.PI * 2)) + (f.id.length % 7);
    return { x: o.x + Math.cos(ang) * radius, y: o.y + Math.sin(ang) * radius };
  }

  private engage(f: Fighter, foe: Fighter): void {
    const move = this.bestMove(f, foe, false);
    const reach = attackRange(move);
    const form = attackForm(move);
    const d = Math.hypot(foe.x - f.x, foe.y - f.y);
    if (form !== "melee" && d <= reach * 0.85 && d > reach * 0.35 && this.sees(f.x, f.y, foe.x, foe.y)) { f.path = []; return; }
    const ang = Math.atan2(f.y - foe.y, f.x - foe.x);
    const hold = form === "melee" ? 24 : Math.min(reach * 0.7, 120);
    this.seek(f, foe.x + Math.cos(ang) * hold, foe.y + Math.sin(ang) * hold);
  }

  private nearestEnemy(f: Fighter, range: number): Fighter | null {
    let best: Fighter | null = null, bd = range;
    for (const o of this.fighters) {
      if (!o.alive || o.faction === f.faction) continue;
      const d = Math.hypot(o.x - f.x, o.y - f.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  private nearestEnemyCombat(f: Fighter, range: number): Fighter | null {
    let best: Fighter | null = null, bd = range;
    for (const o of this.fighters) {
      if (!o.alive || o.faction === f.faction || o.role === "spirit" || o.job !== "combat") continue;
      const d = Math.hypot(o.x - f.x, o.y - f.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  private ownedNearest(faction: number, x: number, y: number): Objective | null {
    let best: Objective | null = null, bd = 1e9;
    for (const o of this.objectives) {
      if (o.owner !== faction) continue;
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  /** Faction command: recruit from stockpiles, garrison home objectives, and send war parties. */
  private command(): void {
    // 1) recruitment from objective stockpiles
    const rng = Math.random;
    for (const o of this.objectives) {
      if (o.owner < 0) continue;
      while (o.stock >= RECRUIT_COST && this.aliveCount() < UNIT_CAP) {
        o.stock -= RECRUIT_COST;
        // mostly combat; occasionally a harvester to grow the economy
        if (Math.random() < 0.28 && this.factionHarvesters(o.owner) < this.factionObjectives(o.owner) * 3) this.recruitHarvester(o, rng);
        else this.recruitCombat(o, rng);
        this.log(`${this.factions[o.owner]!.name} musters a witch at ${o.name}.`);
      }
    }
    // 2) per faction: a thin garrison, then throw EVERYONE else at the enemy as squads, spread across
    //    many objectives so battles break out all over the map at once.
    for (const fac of this.factions) {
      if (!fac.alive) continue;
      const mine = this.objectives.filter((o) => o.owner === fac.id);
      if (!mine.length) { fac.alive = false; continue; }
      // Rebalance labour vs war so a faction is never stuck as all-harvesters or all-defenders:
      // draft harvesters when the army is too thin, demobilize fighters when the economy is starving.
      this.rebalanceJobs(fac.id);
      const combat = this.fighters.filter((f) => f.alive && f.faction === fac.id && f.job === "combat" && f.role !== "spirit");
      if (!combat.length) continue;

      const held = new Set<string>();
      // Keep only a THIN garrison per owned objective — hold just `garrisonNeed` defenders, never the
      // whole army, so everyone else is free to march out and fight.
      const garrisonNeed = 1;
      for (const o of mine) {
        const here = combat.filter((f) => f.order === "defend" && f.target === o.id);
        let kept = 0;
        for (const f of here) { if (kept >= garrisonNeed) break; held.add(f.id); kept++; }
        if (kept < garrisonNeed) {
          const free = combat.filter((f) => !held.has(f.id) && (f.order !== "attack" || this.obj(f.target)?.owner === fac.id)).sort((a, b) => dist2b(a, o) - dist2b(b, o));
          for (const f of free.slice(0, garrisonNeed - kept)) { f.order = "defend"; f.target = o.id; f.squad = -1; held.add(f.id); kept++; }
        }
      }

      // Targets: everything this faction does not own, nearest to the faction first.
      const targets = this.objectives.filter((o) => o.owner !== fac.id).sort((a, b) => this.distToFaction(a, fac.id) - this.distToFaction(b, fac.id));
      if (!targets.length) continue;

      // Attackers free to be (re)tasked: idle units, or attackers whose target is now ours.
      const free = combat.filter((f) => !held.has(f.id) && (f.order !== "attack" || this.obj(f.target)?.owner === fac.id));
      // committed attackers keep marching; only fill fresh squads from the free pool.
      let ti = 0;
      const pool = [...free];
      while (pool.length && ti < targets.length * 3) {
        const t = targets[ti % targets.length]!;
        ti++;
        // how many of this faction are already committed to t?
        const onIt = combat.filter((f) => f.order === "attack" && f.target === t.id).length;
        const size = SQUAD_MIN + ((t.id + fac.id) % (SQUAD_MAX - SQUAD_MIN + 1));
        const want = Math.max(0, size - onIt);
        if (want <= 0) continue;
        const squad = pool.splice(0, want);
        const fresh = onIt === 0 && squad.length > 0;
        for (const f of squad) { f.order = "attack"; f.target = t.id; f.squad = t.id; }
        if (fresh) this.log(`${fac.name} marches ${squad.length} on ${t.name}.`);
      }
      // any leftover free units pile onto the nearest target (reinforcements → big battles)
      if (pool.length) { const t = targets[0]!; for (const f of pool) { f.order = "attack"; f.target = t.id; f.squad = t.id; } }
    }
  }

  /**
   * Flex a faction's workforce between war and labour based on what it needs right now, so no
   * faction gets locked into a single job. Drafts harvesters into fighters when the army is too
   * thin to hold its ground; sends surplus fighters back to harvest when the economy runs dry.
   */
  private rebalanceJobs(faction: number): void {
    const combat = this.fighters.filter((f) => f.alive && f.faction === faction && f.job === "combat" && f.role !== "spirit");
    const harv = this.fighters.filter((f) => f.alive && f.faction === faction && f.job === "harvester" && f.role !== "spirit");
    if (combat.length < COMBAT_MIN && harv.length > HARVEST_MIN) {
      const n = Math.min(COMBAT_MIN - combat.length, harv.length - HARVEST_MIN);
      harv.sort((a, b) => a.carry - b.carry); // call up the least-laden harvesters first
      for (let i = 0; i < n; i++) this.reassignJob(harv[i]!, "combat");
    } else if (harv.length < HARVEST_MIN && combat.length > COMBAT_MIN) {
      const n = Math.min(HARVEST_MIN - harv.length, combat.length - COMBAT_MIN);
      combat.sort((a, b) => (a.order === "attack" ? 1 : 0) - (b.order === "attack" ? 1 : 0)); // spare the ones already fighting
      for (let i = 0; i < n; i++) this.reassignJob(combat[i]!, "harvester");
    }
  }

  /** Switch one fighter's job, resetting the state tied to the old one. Familiars never switch. */
  private reassignJob(f: Fighter, job: "combat" | "harvester"): void {
    if (f.role === "spirit") return;
    f.job = job;
    f.carry = 0; f.node = null; f.harvestT = 0; f.squad = -1;
    f.target = f.home;
    f.order = job === "harvester" ? "harvest" : "defend";
  }

  /** Distance from a faction's nearest owned objective to a target objective. */
  private distToFaction(o: Objective, faction: number): number {
    let best = 1e12;
    for (const m of this.objectives) if (m.owner === faction) { const d = (m.tx - o.tx) ** 2 + (m.ty - o.ty) ** 2; if (d < best) best = d; }
    return best;
  }

  /** Every few minutes a fresh neutral objective rises on open, reachable land to pull armies into a new fight. */
  private respawnObjective(): void {
    const rng = Math.random;
    // find an open land tile far from existing objectives
    let spot: { tx: number; ty: number } | null = null;
    for (let tries = 0; tries < 400 && !spot; tries++) {
      const tx = 6 + Math.floor(rng() * (this.gw - 12));
      const ty = 6 + Math.floor(rng() * (this.gh - 12));
      const i = ty * this.gw + tx;
      if (!this.land[i] || this.grid[i] !== 0 || !this.openAround(tx, ty, 3)) continue;
      if (this.objectives.every((o) => Math.hypot(o.tx - tx, o.ty - ty) > 16)) spot = { tx, ty };
    }
    if (!spot) return;
    const cap = this.objectiveCount + 6;
    const name = REGION_NAMES[(this.objectiveCount + this.nextRegionName++) % REGION_NAMES.length]!;
    let o: Objective;
    if (this.objectives.length >= cap) {
      // relocate a neutral objective (or the least-defended one) to the fresh spot
      const neutral = this.objectives.filter((x) => x.owner < 0);
      o = (neutral.length ? neutral : this.objectives).sort((a, b) => a.stock - b.stock)[0]!;
      o.tx = spot.tx; o.ty = spot.ty; o.x = spot.tx * TILE + TILE / 2; o.y = spot.ty * TILE + TILE / 2;
      o.owner = -1; o.control = 0; o.contender = -1; o.stock = 0; o.nodes = [];
      o.name = name;
    } else {
      o = { id: this.objectives.length, name, tx: spot.tx, ty: spot.ty, x: spot.tx * TILE + TILE / 2, y: spot.ty * TILE + TILE / 2, owner: -1, control: 0, contender: -1, stock: 0, nodes: [], neighbors: [] };
      this.objectives.push(o);
    }
    this.makeNodes(o, mulberry32((spot.tx * 131 + spot.ty * 977) >>> 0 || 1));
    for (const p of this.objectives) p.neighbors = this.objectives.filter((q) => q.id !== p.id).sort((a, b) => dist2(a, p) - dist2(b, p)).slice(0, 3).map((q) => q.id);
    this.log(`A prize rises at ${o.name}. The nations turn toward it.`);
    this.float(o.x, o.y - 40, o.name.toUpperCase(), "#ffe08a");
  }

  private weakestEnemyObjective(faction: number): Objective | null {
    let best: Objective | null = null, bestScore = 1e9;
    for (const o of this.objectives) {
      if (o.owner === faction) continue;
      const def = this.fighters.filter((f) => f.alive && f.job === "combat" && f.role !== "spirit" && f.faction === o.owner && Math.hypot(f.x - o.x, f.y - o.y) < POINT_R * 1.6).length;
      if (def < bestScore) { bestScore = def; best = o; }
    }
    return best;
  }

  private factionObjectives(id: number): number { return this.objectives.filter((o) => o.owner === id).length; }
  private factionHarvesters(id: number): number { return this.fighters.filter((f) => f.alive && f.faction === id && f.job === "harvester").length; }

  // ----- capture ------------------------------------------------------------

  private captureTick(dt: number): void {
    for (const o of this.objectives) {
      // tally combat presence per faction inside the ring
      const counts = new Map<number, number>();
      for (const f of this.fighters) {
        if (!f.alive || f.job !== "combat" || f.role === "spirit") continue;
        if (Math.hypot(f.x - o.x, f.y - o.y) > POINT_R) continue;
        counts.set(f.faction, (counts.get(f.faction) ?? 0) + 1);
      }
      const ownerN = o.owner >= 0 ? (counts.get(o.owner) ?? 0) : 0;
      // strongest non-owner present
      let topFac = -1, topN = 0;
      for (const [fac, n] of counts) { if (fac === o.owner) continue; if (n > topN) { topN = n; topFac = fac; } }

      if (topFac >= 0 && topN > ownerN) {
        if (o.contender !== topFac) { o.contender = topFac; } // a new challenger resets the push slowly
        o.control = Math.min(100, o.control + CAP_RATE * dt * Math.min(3, topN - ownerN));
        if (o.control >= 100) this.flip(o, topFac);
      } else {
        // owner (or nobody) holds — bleed control back down
        o.control = Math.max(0, o.control - CAP_RETAKE * dt);
        if (o.control <= 0) o.contender = -1;
      }
    }
  }

  private flip(o: Objective, faction: number): void {
    const from = o.owner;
    o.owner = faction;
    o.control = 0;
    o.contender = -1;
    o.stock = Math.floor(o.stock * 0.5); // spoils lost in the sack
    // units garrisoning here for the new owner stay; enemies retreat toward their nearest home
    for (const f of this.fighters) {
      if (!f.alive || f.role === "spirit") continue;
      if (f.target === o.id && f.faction === faction) { f.order = "defend"; }
    }
    const fromName = from >= 0 ? this.factions[from]!.name : "the wild";
    this.log(`${this.factions[faction]!.name} takes ${o.name} from ${fromName}.`);
    this.float(o.x, o.y - 40, o.name.toUpperCase(), this.factions[faction]!.color);
  }

  private checkWin(): void {
    const owners = new Set<number>();
    for (const o of this.objectives) if (o.owner >= 0) owners.add(o.owner);
    for (const fac of this.factions) fac.alive = owners.has(fac.id);
    if (owners.size === 1) {
      const id = [...owners][0]!;
      this.winFaction = id;
      this.winner = `${this.factions[id]!.name} controls the whole continent.`;
      this.phase = "result";
      this.note = this.winner;
      this.log(this.winner);
      this.publish();
    } else if (owners.size === 0) {
      this.winFaction = -1;
      this.winner = "The continent lies empty. No faction remains.";
      this.phase = "result";
      this.note = this.winner;
      this.publish();
    }
  }

  // ----- movement & pathfinding (generation-stamped A*) ---------------------

  private seek(f: Fighter, x: number, y: number): void {
    const moved = Math.hypot(f.x - f.lastX, f.y - f.lastY);
    if (moved < 4) f.stuck += 0.4; else f.stuck = 0;
    f.lastX = f.x; f.lastY = f.y;
    if (f.stuck > 1.3) { f.stuck = 0; const ang = Math.random() * Math.PI * 2; x = f.x + Math.cos(ang) * 110; y = f.y + Math.sin(ang) * 110; f.path = []; }
    const d = Math.hypot(x - f.x, y - f.y);
    if (d < 16) { f.path = []; return; }
    if (d < 620 && this.sees(f.x, f.y, x, y)) { f.path = [{ x, y }]; return; }
    this.pathTo(f, x, y);
  }

  private sees(x0: number, y0: number, x1: number, y1: number): boolean { return los(this.grid, this.gw, this.gh, x0, y0, x1, y1); }

  private pathTo(f: Fighter, x: number, y: number): void {
    const sx = Math.floor(f.x / TILE), sy = Math.floor(f.y / TILE);
    const gx = Math.floor(x / TILE), gy = Math.floor(y / TILE);
    if (sx === gx && sy === gy) { f.path = [{ x, y }]; return; }
    if (this.pathBudget <= 0) { f.path = [{ x, y }]; return; }
    this.pathBudget -= 1;
    f.path = this.route(sx, sy, gx, gy);
  }

  private route(sx: number, sy: number, gxIn: number, gyIn: number): { x: number; y: number }[] {
    const w = this.gw, h = this.gh, grid = this.grid;
    sx = Math.max(1, Math.min(w - 2, sx)); sy = Math.max(1, Math.min(h - 2, sy));
    let gx = Math.max(1, Math.min(w - 2, gxIn)), gy = Math.max(1, Math.min(h - 2, gyIn));
    if (grid[gy * w + gx] === 1) {
      let found = false;
      for (let r = 1; r <= 5 && !found; r++) for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r; dx++) {
        const nx = gx + dx, ny = gy + dy;
        if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) continue;
        if (grid[ny * w + nx] !== 1) { gx = nx; gy = ny; found = true; break; }
      }
    }
    const start = sy * w + sx, goal = gy * w + gx;
    const gen = ++this.gen;
    const seen = this.seen, dist = this.dist, prev = this.prev;
    seen[start] = gen; dist[start] = 0; prev[start] = -1;
    this.heap.clear(); this.heap.push(start, 0);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    const hcost = (i: number) => Math.abs((i % w) - gx) + Math.abs(((i / w) | 0) - gy);
    let best = start, bestH = hcost(start), guard = 0;
    const budget = 12000;
    while (guard++ < budget) {
      const cur = this.heap.pop();
      if (!cur) break;
      if (seen[cur.i] === gen && cur.c > dist[cur.i]! + 0.01) continue;
      const hc = hcost(cur.i);
      if (hc < bestH) { bestH = hc; best = cur.i; }
      if (cur.i === goal) break;
      const x = cur.i % w, y = (cur.i / w) | 0;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx;
        if (grid[k] === 1) continue;
        const stepC = grid[k] === 3 ? 2.4 : 1;
        const nd = (seen[cur.i] === gen ? dist[cur.i]! : 0) + stepC;
        if (seen[k] !== gen || nd + 0.01 < dist[k]!) { seen[k] = gen; dist[k] = nd; prev[k] = cur.i; this.heap.push(k, nd); }
      }
    }
    const end = (seen[goal] === gen) ? goal : best;
    if (end === start) return [{ x: gx * TILE + TILE / 2, y: gy * TILE + TILE / 2 }];
    const raw: { x: number; y: number }[] = [];
    let c = end, safety = 0;
    while (c !== -1 && safety++ < 2000) { raw.push({ x: (c % w) * TILE + TILE / 2, y: ((c / w) | 0) * TILE + TILE / 2 }); if (c === start) break; c = seen[c] === gen ? prev[c]! : -1; }
    raw.reverse();
    if (raw.length <= 2) return raw;
    const open = (x: number, y: number) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); if (tx < 0 || ty < 0 || tx >= w || ty >= h) return false; return grid[ty * w + tx] !== 1; };
    const seesLocal = (a: { x: number; y: number }, b: { x: number; y: number }) => { const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 14)); for (let s = 1; s < steps; s++) { const t = s / steps; if (!open(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false; } return true; };
    const slim: { x: number; y: number }[] = [];
    let i = 0;
    while (i < raw.length - 1) { let j = Math.min(raw.length - 1, i + 16); while (j > i + 1 && !seesLocal(raw[i]!, raw[j]!)) j--; slim.push(raw[j]!); i = j; }
    return slim;
  }

  private follow(f: Fighter, dt: number, mud: boolean): void {
    let tx = f.x, ty = f.y;
    const step = f.path[0];
    if (step) { tx = step.x; ty = step.y; if (Math.hypot(step.x - f.x, step.y - f.y) < 10) f.path.shift(); }
    let dx = tx - f.x, dy = ty - f.y;
    if (Math.hypot(dx, dy) < 2) return;
    for (const o of this.fighters) {
      if (o === f || !o.alive || o.faction !== f.faction) continue;
      const d = Math.hypot(f.x - o.x, f.y - o.y);
      if (d < 16 && d > 0.2) { dx += ((f.x - o.x) / d) * 7; dy += ((f.y - o.y) / d) * 7; }
    }
    const mag = Math.hypot(dx, dy) || 1;
    const speed = f.speed * (mud ? 0.55 : 1) * (f.role === "spirit" ? 1.05 : 1);
    this.slide(f, (dx / mag) * speed * dt, (dy / mag) * speed * dt);
  }

  private slide(f: Fighter, dx: number, dy: number): void {
    const blocked = (x: number, y: number) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); if (tx < 0 || ty < 0 || tx >= this.gw || ty >= this.gh) return true; return this.grid[ty * this.gw + tx] === 1; };
    const x = f.x, y = f.y;
    if (!blocked(f.x + dx, f.y)) f.x += dx;
    if (!blocked(f.x, f.y + dy)) f.y += dy;
    f.direction = directionFromDelta(f.x - x, f.y - y, f.direction);
    if (f.x !== x) f.facing = f.x < x ? -1 : 1;
  }

  // ----- combat -------------------------------------------------------------

  private bestMove(f: Fighter, target: Fighter | null, commit: boolean): Move {
    const list = f.moveIds.map((id) => MOVE_BY_ID[id]).filter((m): m is Move => !!m);
    const bag = list.length ? list : [MOVES[0]!];
    if (!commit) return bag.slice().sort((a, b) => b.power - a.power)[0]!;
    const hurt = f.hp / f.max < 0.48;
    if (hurt) {
      const mend = bag.find((m) => m.effect === "mend" || moveTactic(m) === "heal");
      if (mend) { const ally = this.lowestFriend(f); if (ally && ally.hp / ally.max < 0.62) return mend; }
      const ward = bag.find((m) => m.effect === "shell" || moveTactic(m) === "ward");
      if (ward && f.shield <= 0) return ward;
    }
    const d = target ? Math.hypot(target.x - f.x, target.y - f.y) : 999;
    const inReach = bag.filter((m) => attackRange(m) + 10 >= d);
    return (inReach.length ? inReach : bag).slice().sort((a, b) => b.power - a.power)[0]!;
  }

  private lowestFriend(f: Fighter): Fighter | null {
    let best: Fighter | null = null, bv = 2;
    for (const a of this.fighters) { if (!a.alive || a.faction !== f.faction) continue; const v = a.hp / a.max; if (v < bv) { bv = v; best = a; } }
    return best ?? f;
  }

  private strike(f: Fighter): void {
    if (f.cd > 0 || f.sleep > 0) return;
    const hurtAlly = f.hp / f.max < 0.5 ? this.lowestFriend(f) : null;
    if (hurtAlly && hurtAlly.hp / hurtAlly.max < 0.55) {
      const mend = f.moveIds.map((id) => MOVE_BY_ID[id]).find((m) => m && (m.effect === "mend" || moveTactic(m) === "heal"));
      if (mend && Math.hypot(hurtAlly.x - f.x, hurtAlly.y - f.y) < attackRange(mend) + 8) { this.cast(f, hurtAlly, mend, true); f.cd = this.cooldown(f, mend); return; }
    }
    const target = this.nearestEnemy(f, 420);
    if (!target) return;
    const move = this.bestMove(f, target, true);
    const tactic = moveTactic(move);
    if ((tactic === "ward" || move.effect === "shell") && f.shield <= 0) { this.cast(f, f, move, true); f.shield = 2.6; f.cd = this.cooldown(f, move); return; }
    const d = Math.hypot(target.x - f.x, target.y - f.y);
    const reach = attackRange(move);
    if (d > reach + 8) return;
    const form = attackForm(move);
    if (form !== "melee" && !this.sees(f.x, f.y - 8, target.x, target.y - 8)) return;
    if (tactic === "blink" && d > 46) {
      const ang = Math.atan2(target.y - f.y, target.x - f.x);
      const nx = target.x - Math.cos(ang) * 30, ny = target.y - Math.sin(ang) * 30;
      if (!this.pillar(nx, ny)) { this.cfx.cast(move, form, tactic, f.x, f.y - 12, nx, ny - 12); f.x = nx; f.y = ny; }
    } else if (tactic === "lunge" && d > 36) {
      const ang = Math.atan2(target.y - f.y, target.x - f.x);
      this.slide(f, Math.cos(ang) * Math.min(d - 24, 80), Math.sin(ang) * Math.min(d - 24, 80));
    }
    this.cast(f, target, move, false);
    f.cd = this.cooldown(f, move);
    f.facing = target.x < f.x ? -1 : 1;
  }

  private cooldown(f: Fighter, move: Move): number {
    const tactic = moveTactic(move);
    const base = tactic === "heavy" || tactic === "channel" ? 1.45 : tactic === "roll" ? 0.7 : 0.85;
    return Math.max(0.32, base * (1 - Math.min(0.35, f.swift / 120)) * (f.role === "spirit" ? 1.15 : 1));
  }

  private cast(f: Fighter, target: Fighter, move: Move, aid: boolean): void {
    const y0 = f.y - 18, y1 = target.y - 14;
    this.beams.push({ x0: f.x, y0, x1: target.x, y1, life: 0.3, color: TYPES[move.type].color });
    this.cfx.cast(move, attackForm(move), moveTactic(move), f.x, y0, target.x, y1);
    if (aid) {
      if (move.effect === "mend" || moveTactic(move) === "heal") { const heal = (10 + move.power * 0.7) * (0.75 + f.dmgMul); target.hp = Math.min(target.max, target.hp + heal); this.float(target.x, target.y - 28, `${Math.round(heal)}`, "#9ad8c8"); }
      return;
    }
    const tm = typeMult(move.type, target.type);
    if (tm === 0) { this.float(target.x, target.y - 26, "immune", "#e7d9ff"); return; }
    if (Math.random() * 100 < target.echo) { this.cfx.evade(target.x, target.y - 12); return; }
    const form = attackForm(move);
    const gear = 1 + (f.weapon?.level ?? f.level) * 0.035;
    const might = 1 + f.might / 100;
    const stab = move.type === f.type ? 1.12 : 1;
    let dmg = (5 + move.power * 0.34) * (1 + f.level * 0.045) * gear * might * stab * tm * f.dmgMul * (form === "melee" ? 1.15 : 1) * (moveTactic(move) === "heavy" ? 1.35 : 1);
    const crit = Math.random() * 100 < move.crit + f.crit;
    if (crit) dmg *= 1.65;
    if (target.shield > 0 && form !== "melee") dmg *= 0.55;
    dmg *= 1 - Math.min(0.45, defenseVs(form, target.ward) / 140);
    const hits = Math.random() * 100 < f.double ? 2 : 1;
    for (let i = 0; i < hits; i++) this.hurt(target, Math.max(1, dmg * (hits === 2 ? 0.8 : 1)), crit ? "#fff1a8" : "#fff6e8");
    if (move.effect === "burn") target.burn = Math.max(target.burn, 2.4);
    if (move.effect === "root") target.root = Math.max(target.root, 1.3);
    if (target.sleep > 0) target.sleep = 0; else if (move.effect === "sleep" && Math.random() < 0.45) target.sleep = 1.4;
    if (move.effect === "leech") f.hp = Math.min(f.max, f.hp + dmg * 0.25);
  }

  private hurt(f: Fighter, amount: number, color: string | null): void {
    if (!f.alive) return;
    f.hp -= amount; f.hurt = 0.35;
    if (color && amount >= 1 && this.floats.length < 110) this.float(f.x, f.y - 24, `${Math.round(amount)}`, color);
    if (f.hp > 0) return;
    if (f.second && !f.usedSecond) { f.usedSecond = true; f.hp = Math.max(1, f.max * 0.22); return; }
    f.hp = 0; f.alive = false;
    if (f.role !== "spirit") for (const s of this.fighters) if (s.master === f.id && s.alive) { s.alive = false; s.hp = 0; }
  }

  private pillar(x: number, y: number): boolean { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); if (tx < 0 || ty < 0 || tx >= this.gw || ty >= this.gh) return true; return this.grid[ty * this.gw + tx] === 1; }

  // ----- camera & render ----------------------------------------------------

  private biggestBattle(): { x: number; y: number; n: number } | null {
    let best: { x: number; y: number; n: number } | null = null;
    for (const o of this.objectives) {
      if (o.contender < 0 && o.control <= 0) continue;
      let n = 0, sx = 0, sy = 0;
      for (const f of this.fighters) { if (!f.alive || f.role === "spirit") continue; if (Math.hypot(f.x - o.x, f.y - o.y) < POINT_R * 1.3) { n++; sx += f.x; sy += f.y; } }
      if (n >= 2 && (!best || n > best.n)) best = { x: sx / n, y: sy / n, n };
    }
    return best;
  }

  private frameFaction(id: number): void {
    const units = this.fighters.filter((f) => f.alive && f.faction === id && f.role !== "spirit");
    if (!units.length) { const o = this.objectives.find((ob) => ob.owner === id); if (o) { this.wantX = o.x; this.wantY = o.y; } return; }
    let mnX = 1e9, mnY = 1e9, mxX = -1e9, mxY = -1e9;
    for (const f of units) { mnX = Math.min(mnX, f.x); mnY = Math.min(mnY, f.y); mxX = Math.max(mxX, f.x); mxY = Math.max(mxY, f.y); }
    this.wantX = (mnX + mxX) / 2; this.wantY = (mnY + mxY) / 2;
    const span = Math.max(mxX - mnX, mxY - mnY, 400);
    this.wantZ = Math.max(this.minZoom, Math.min(0.9, Math.min(this.viewW, this.viewH) / (span + 400)));
    const k = 0.1;
    this.camX += (this.wantX - this.camX) * k; this.camY += (this.wantY - this.camY) * k; this.zoom += (this.wantZ - this.zoom) * k;
  }

  private driveCam(dt: number): void {
    let x = 0, y = 0;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) y -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y += 1;
    if ((x || y) && this.camMode === "follow") { this.camMode = "free"; this.publish(); }
    if (x || y) { const m = Math.hypot(x, y) || 1; const sp = 900 / Math.max(0.3, this.zoom); this.camX += (x / m) * sp * dt; this.camY += (y / m) * sp * dt; this.clampCam(); return; }
    if (this.phase !== "setup" && this.camMode === "follow") this.frameFaction(this.focus);
  }

  private fitMap(): void {
    if (this.viewW < 8 || this.gw < 2) return;
    const mw = this.gw * TILE, mh = this.gh * TILE;
    this.camX = this.wantX = mw / 2; this.camY = this.wantY = mh / 2;
    // Open as wide as the fast render path allows; the minimap shows the whole continent.
    this.zoom = this.wantZ = this.minZoom;
    this.clampCam();
  }

  private clampCam(): void { const mw = this.gw * TILE, mh = this.gh * TILE; this.camX = Math.max(0, Math.min(mw, this.camX)); this.camY = Math.max(0, Math.min(mh, this.camY)); }

  private float(x: number, y: number, text: string, color: string): void { if (this.floats.length > 120) this.floats.shift(); this.floats.push({ x, y, text, life: 0.9, color }); }

  private color(fac: number): string { return this.factions[fac]?.color ?? "#f0e2c8"; }

  private draw(): void {
    const ctx = this.ctx, dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b1420";
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    if (!this.world) return;
    ctx.save();
    ctx.translate(this.viewW / 2, this.viewH / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX, -this.camY);
    ctx.imageSmoothingEnabled = false;
    drawWorldSlice(ctx, this.world, this.camX, this.camY, this.viewW, this.viewH, this.zoom);

    this.drawRegions(ctx);
    this.drawObjectives(ctx);
    if (this.zoom > 0.45) this.drawNodes(ctx);

    const halfW = this.viewW / this.zoom * 0.6 + 120, halfH = this.viewH / this.zoom * 0.6 + 120;
    // Gathered into a scratch array that is reused every frame and then sorted in place. With six
    // hundred fighters this used to allocate a fresh array of the visible ones on every frame.
    const order = this.drawOrder;
    this.visibleHalfW = halfW; this.visibleHalfH = halfH;
    gatherInto(this.fighters, this.isVisibleFighter, order);
    order.sort(byDepth);
    for (const f of order) {
      if (f.role === "spirit" && f.look) {
        drawMonster(ctx, { x: f.x, y: f.y, template: f.template, type: f.type, facing: f.facing, walk: f.walk, hurt: f.hurt, boss: false, rarity: 0, ghost: true, look: f.look, time: this.clock });
      } else if (f.race) {
        const scale = f.job === "harvester" ? 0.86 : 1;
        drawActor(ctx, { x: f.x, y: f.y, race: f.race, direction: f.direction, female: true, hair: f.hair, skin: f.skin, facing: f.facing, walk: f.walk, attack: f.cd > 0.55 ? 0.4 : 0, hurt: f.hurt, pieces: f.pieces, setFx: null, setOn: false, time: this.clock, scale });
      }
      // faction ring at the feet
      if (f.role !== "spirit" && this.zoom > 0.4) {
        ctx.fillStyle = this.color(f.faction);
        ctx.globalAlpha = 0.9;
        ctx.fillRect(f.x - 5, f.y + 2, 10, 2);
        ctx.globalAlpha = 1;
      }
      if (this.zoom > 0.55) {
        const bar = f.role === "spirit" ? 20 : f.job === "harvester" ? 22 : 30;
        const by = f.y - (f.role === "spirit" ? 30 : 38);
        ctx.fillStyle = "#1a1214"; ctx.fillRect(f.x - bar / 2 - 1, by - 1, bar + 2, 5);
        ctx.fillStyle = f.job === "harvester" ? "#d8c48a" : this.color(f.faction);
        ctx.fillRect(f.x - bar / 2, by, bar * Math.max(0, f.hp / f.max), 3);
      }
    }
    for (const b of this.beams) {
      const a = Math.max(0, Math.min(1, b.life * 3));
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = b.color; ctx.lineWidth = 3 / Math.max(0.4, this.zoom);
      ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke(); ctx.restore();
    }
    this.cfx.draw(ctx, this.clock);
    for (const fl of this.floats) { ctx.globalAlpha = Math.max(0, Math.min(1, fl.life * 2)); drawShadowName(ctx, fl.text, fl.x, fl.y - (0.9 - fl.life) * 22, fl.color); ctx.globalAlpha = 1; }
    ctx.restore();

    this.drawMinimap(ctx);
  }

  /** The whole-continent overview, bottom-right: terrain, faction regions, objectives, unit blips, view box. */
  private drawMinimap(ctx: CanvasRenderingContext2D): void {
    if (!this.mini || this.phase === "setup") { this.miniRect = null; return; }
    const size = Math.max(120, Math.min(220, Math.min(this.viewW, this.viewH) * 0.3));
    const pad = 12;
    const rx = this.viewW - size - pad, ry = this.viewH - size - pad;
    this.miniRect = { x: rx, y: ry, w: size, h: size };
    const sx = size / (this.gw * TILE), sy = size / (this.gh * TILE);
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "#05080c";
    ctx.fillRect(rx - 2, ry - 2, size + 4, size + 4);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mini, rx, ry, size, size);
    // faction region tints
    for (const o of this.objectives) {
      if (o.owner < 0) continue;
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = this.color(o.owner);
      ctx.beginPath();
      ctx.arc(rx + o.x * sx, ry + o.y * sy, POINT_R * 2.1 * sx, 0, Math.PI * 2);
      ctx.fill();
    }
    // objective dots
    ctx.globalAlpha = 1;
    for (const o of this.objectives) {
      ctx.fillStyle = o.owner >= 0 ? this.color(o.owner) : "#b8ad9a";
      ctx.fillRect(rx + o.x * sx - 2, ry + o.y * sy - 2, 4, 4);
      if (o.control > 0 && o.contender >= 0) { ctx.fillStyle = this.color(o.contender); ctx.fillRect(rx + o.x * sx - 1, ry + o.y * sy - 1, 2, 2); }
    }
    // unit blips (combat only, to keep it light)
    for (const f of this.fighters) {
      if (!f.alive || f.role === "spirit" || f.job !== "combat") continue;
      ctx.fillStyle = this.color(f.faction);
      ctx.fillRect(rx + f.x * sx, ry + f.y * sy, 1, 1);
    }
    // current view rectangle
    const vw = this.viewW / this.zoom, vh = this.viewH / this.zoom;
    ctx.globalAlpha = 0.9; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1;
    ctx.strokeRect(rx + (this.camX - vw / 2) * sx, ry + (this.camY - vh / 2) * sy, vw * sx, vh * sy);
    ctx.restore();
  }

  /** Faint territory tint around every owned objective, coloured by its faction. */
  private drawRegions(ctx: CanvasRenderingContext2D): void {
    for (const o of this.objectives) {
      if (o.owner < 0) continue;
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = this.color(o.owner);
      ctx.beginPath();
      ctx.arc(o.x, o.y, POINT_R * 2.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawObjectives(ctx: CanvasRenderingContext2D): void {
    // Tally every objective's garrison in ONE walk of the fighters. This used to re-scan all six
    // hundred fighters (through Math.hypot) once per objective, every frame, just for the labels.
    const counts = this.garrisonCount;
    const objs = this.objectives;
    for (let i = 0; i < objs.length; i++) counts[i] = 0;
    counts.length = objs.length;
    if (this.zoom > 0.3) for (const f of this.fighters) {
      if (!f.alive || f.role === "spirit" || f.job !== "combat") continue;
      for (let i = 0; i < objs.length; i++) {
        const o = objs[i]!;
        if (f.faction !== o.owner) continue;
        const dx = f.x - o.x, dy = f.y - o.y;
        if (dx * dx + dy * dy < POINT_R_SQ) { counts[i] = counts[i]! + 1; break; }
      }
    }
    for (let oi = 0; oi < objs.length; oi++) {
      const o = objs[oi]!;
      const col = o.owner >= 0 ? this.color(o.owner) : "#9a8f80";
      ctx.save();
      // ring
      ctx.globalAlpha = 0.85; ctx.lineWidth = 2.5 / Math.max(0.4, this.zoom); ctx.strokeStyle = col;
      ctx.beginPath(); ctx.arc(o.x, o.y, POINT_R, 0, Math.PI * 2); ctx.stroke();
      // contest arc
      if (o.control > 0 && o.contender >= 0) {
        ctx.lineWidth = 5 / Math.max(0.4, this.zoom); ctx.strokeStyle = this.color(o.contender);
        ctx.beginPath(); ctx.arc(o.x, o.y, POINT_R - 5, -Math.PI / 2, -Math.PI / 2 + (o.control / 100) * Math.PI * 2); ctx.stroke();
      }
      // banner pole
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#2a1f18"; ctx.fillRect(o.x - 1, o.y - 30, 2, 30);
      ctx.fillStyle = col; ctx.fillRect(o.x, o.y - 30, 14, 9);
      ctx.restore();
      if (this.zoom > 0.3) {
        const garr = counts[oi] ?? 0;
        drawShadowName(ctx, o.name.toUpperCase(), o.x, o.y - POINT_R - 10, col);
        if (this.zoom > 0.5) drawShadowName(ctx, o.owner >= 0 ? `${this.factions[o.owner]!.name} · ${garr}` : "neutral", o.x, o.y - POINT_R + 4, col);
      }
    }
  }

  private drawNodes(ctx: CanvasRenderingContext2D): void {
    for (const o of this.objectives) for (const nd of o.nodes) {
      ctx.globalAlpha = nd.amount > 0 ? 0.9 : 0.3;
      ctx.fillStyle = nd.amount > 0 ? "#7bd06a" : "#4a5240";
      ctx.fillRect(nd.x - 3, nd.y - 3, 6, 6);
      ctx.globalAlpha = 1;
    }
  }

  // ----- input --------------------------------------------------------------

  private bind(): void {
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }
  private unbind(): void {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.keys.clear();
  }
  private typing(e: Event): boolean { const tag = (e.target as HTMLElement | null)?.tagName; return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"; }
  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    const p = this.local(e);
    const mr = this.miniRect;
    if (mr && p.x >= mr.x && p.x <= mr.x + mr.w && p.y >= mr.y && p.y <= mr.y + mr.h) {
      // Click the minimap to re-centre the main view there.
      this.camMode = "free";
      this.camX = this.wantX = ((p.x - mr.x) / mr.w) * this.gw * TILE;
      this.camY = this.wantY = ((p.y - mr.y) / mr.h) * this.gh * TILE;
      this.clampCam();
      this.publish();
      return;
    }
    this.drag = { x: p.x, y: p.y, camX: this.camX, camY: this.camY, moved: false };
  };
  private onPointerMove = (e: PointerEvent): void => {
    if (!this.drag) return;
    const p = this.local(e); const dx = p.x - this.drag.x, dy = p.y - this.drag.y;
    if (Math.hypot(dx, dy) > 5) this.drag.moved = true;
    if (this.drag.moved) { if (this.camMode === "follow") this.camMode = "free"; this.camX = this.drag.camX - dx / this.zoom; this.camY = this.drag.camY - dy / this.zoom; this.clampCam(); }
  };
  private onPointerUp = (): void => { this.drag = null; };
  private onWheel = (e: WheelEvent): void => { e.preventDefault(); this.zoomBy(e.deltaY > 0 ? 0.9 : 1.1); };
  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.typing(e)) return;
    const k = e.key.toLowerCase();
    if (k === "q") { this.cycleFocus(-1); e.preventDefault(); return; }
    if (k === "e") { this.cycleFocus(1); e.preventDefault(); return; }
    if (k === "b") { this.jumpBattle(); e.preventDefault(); return; }
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) { this.keys.add(k); e.preventDefault(); }
  };
  private onKeyUp = (e: KeyboardEvent): void => { this.keys.delete(e.key.toLowerCase()); };
  private local(e: { clientX: number; clientY: number }): { x: number; y: number } { const r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  // ----- log & snapshot -----------------------------------------------------

  private log(text: string): void {
    this.events.unshift(text);
    if (this.events.length > 40) this.events.length = 40;
  }

  private publish(): void {
    const total = this.objectives.length || this.objectiveCount;
    const factions: FactionSnap[] = this.factions.map((fac) => {
      const objectives = this.objectives.filter((o) => o.owner === fac.id).length;
      const units = this.fighters.filter((f) => f.alive && f.faction === fac.id && f.role !== "spirit");
      const combat = units.filter((f) => f.job === "combat").length;
      const harvesters = units.filter((f) => f.job === "harvester").length;
      const materials = this.objectives.filter((o) => o.owner === fac.id).reduce((s, o) => s + o.stock, 0) + units.filter((f) => f.job === "harvester").reduce((s, f) => s + f.carry, 0);
      return { id: fac.id, name: fac.name, color: fac.color, objectives, combat, harvesters, materials: Math.round(materials), alive: fac.alive && objectives > 0 };
    }).sort((a, b) => b.objectives - a.objectives || b.combat - a.combat);

    let battles = 0;
    for (const o of this.objectives) if (o.control > 0 && o.contender >= 0) battles++;

    const s = Math.max(0, Math.floor(this.age));
    this.snap = {
      phase: this.phase, note: this.note, speed: this.speed, cam: this.camMode, focus: this.focus,
      clock: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`,
      factionCount: this.factionCount, objectiveCount: this.objectiveCount, objectiveTotal: total,
      factions, events: this.events.slice(0, 8), battles,
      winner: this.winner, winFaction: this.winFaction,
    };
    this.listeners.forEach((fn) => fn());
  }
}

function dist2(a: Objective, b: Objective): number { const dx = a.tx - b.tx, dy = a.ty - b.ty; return dx * dx + dy * dy; }
function dist2b(f: Fighter, o: Objective): number { const dx = f.x - o.x, dy = f.y - o.y; return dx * dx + dy * dy; }
