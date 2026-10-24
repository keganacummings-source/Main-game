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
import type { GraveBody } from "./social-types";
import { drawActor, drawMonster, drawShadowName } from "./sprites";
import { geneSeedOf } from "./fx-gene";
import { drawWorldSlice, type WorldData } from "./world";

const TILE = 32;

/* ----------------------------------------------------------------------------
 * TurboCircle — Total War style siege.
 *
 * One 250×250 procedurally generated battlefield with a fortified stronghold at
 * its heart. Two armies: ATTACKERS, who smart-push the keep to seize the capture
 * point, and DEFENDERS, who hold it. Each army is built out of CLASSES the player
 * picks — tanks, casters, marksmen, ghost-callers — so you decide what your army
 * is made of. Ghost-caller classes bring spirits onto the field with them.
 * ------------------------------------------------------------------------- */

const ATTACKER = 0;
const DEFENDER = 1;

type SideDef = { id: number; key: "attackers" | "defenders"; name: string; color: string };
const SIDES: SideDef[] = [
  { id: ATTACKER, key: "attackers", name: "Attackers", color: "#c4473a" },
  { id: DEFENDER, key: "defenders", name: "Defenders", color: "#5ab0e8" },
];

/** How many ghosts a class leads onto the field. Ties the ghost roster to the class you pick. */
const GHOSTS_BY_CLASS: Partial<Record<ClassId, number>> = {
  spiritbinder: 3,
  hexbinder: 2,
  gravemage: 2,
  veilsinger: 1,
  vigilant: 1,
  nightlord: 1,
};

const NAMES = [
  ...WITCH_NAMES,
  "Vellum Sax", "Nix of Salt", "Sable Quill", "Ione Marr", "Cairn Hess", "Rue the Lid",
  "Onyx Pell", "Moss Ives", "Hester Vetch", "Lumen Bret", "Silt Ama", "Bram of Glass",
  "Nell Dusk", "Pax Yarrow", "Ivy Sorrow", "Cass of Embers", "Wren Holt", "Otter Vine",
  "Isla Thorn", "Quill Mare", "Dusk Nen", "Cress Vail", "Vetch Ora", "Nim of the Well",
  "Hale Mot", "Sera's Shadow", "Juniper Hex", "Tallow Mae", "Grey Pell", "Annis Coil",
  "Mab of Rime", "Kit the Toll", "Edda Vellum", "Noa of Pitch", "Fern Widow", "Lux of Bone",
  "Pim Salt", "Ysolde Marr", "Betony Vale", "Cressida Ash",
];

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
  /** Combat bonuses from the class, folded onto the body at spawn. */
  mods: { might: number; ward: number; crit: number; swift: number; dmg: number };
};

export type CamMode = "team" | "free";

/** What a side's army is made of: a size and the classes to fill it from. */
export type ArmyPlan = { size: number; classes: ClassId[] };

export type ClassOption = { id: ClassId; name: string; role: Role; type: TypeId; typeName: string; ghosts: number; about: string };

export type ArmySnap = {
  id: number;
  key: "attackers" | "defenders";
  name: string;
  color: string;
  size: number;
  classes: ClassId[];
  alive: number;
  count: number;
  level: number;
  ghosts: number;
  intent: string;
};

export type ArenaSnap = {
  phase: "setup" | "fight" | "result";
  note: string;
  speed: number;
  cam: CamMode;
  focus: number;
  clock: string;
  timeLeft: string;
  /** Attacker control of the point, 0 (fully held) … 100 (seized). */
  control: number;
  held: "attackers" | "defenders" | "contested";
  armies: ArmySnap[];
  classOptions: ClassOption[];
  winner: string;
  winSide: number;
};

type Fighter = {
  id: string;
  side: number;
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
  trap: number;
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
  squad: number;
  rank: number;
  hair: number;
  skin: number;
};

type Flo = { x: number; y: number; text: string; life: number; color: string };
type Beam = { x0: number; y0: number; x1: number; y1: number; life: number; color: string };

const QUALITY = ["worn", "common", "fine", "rare", "epic", "legendary"];

/** Classes you can field. The Crying Girl is left out — she is a build-your-own, not an army unit. */
const FIELD_CLASSES = CLASSES.filter((c) => c.id !== "cryinggirl");

function classOptions(): ClassOption[] {
  return FIELD_CLASSES.map((c) => ({
    id: c.id as ClassId,
    name: c.name,
    role: c.role,
    type: c.type,
    typeName: TYPES[c.type]?.name ?? c.type,
    ghosts: GHOSTS_BY_CLASS[c.id as ClassId] ?? 0,
    about: `${c.role} · ${c.focus}`,
  }));
}

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

/** Build one soldier of a given class. Modern witch, kitted and stat-leaned to match the class. */
export function witchFromClass(rng: Rng, classId: ClassId, level: number): ArenaWitch {
  const c = CLASS_BY_ID[classId] as unknown as { name: string; type: TypeId; role: Role; stats: StatMods };
  const race = CLASS_RACE[classId] ?? "vesper";
  const raceInfo = RACES.find((r) => r.id === race) ?? RACES[0]!;
  const stats = c.stats ?? {};
  const ghosts = GHOSTS_BY_CLASS[classId] ?? 0;
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
    // The ghost's element matches the class, so a Spirit Caller's choir reads as hers.
    const pool = MONSTERS.filter((m) => m.type === c.type || m.type === "spirit" || m.type === "void");
    const spec = pool.length ? pick(rng, pool) : MONSTERS[0]!;
    const bag = MOVES.filter((m) => m.type === c.type && m.power > 0 && m.power < 56);
    const move = (bag.length ? pick(rng, bag) : MOVES[0]!).id;
    spirits.push({ name: spec.name, type: c.type, template: spec.template, move, look: rollGhostLook(rng, 1, move, "hunt") });
  }

  const name = pick(rng, NAMES);
  const roleHp = c.role === "Tank" ? 1.22 : c.role === "Caster" ? 0.9 : c.role === "Support" ? 1.02 : 1;
  const hpMul = 1 + (stats.hp ?? 0) / 100 + (stats.guard ?? 0) / 340;
  const baseline = 82 + level * 16;
  const maxHp = Math.floor(baseline * roleHp * hpMul);
  const speed = Math.max(44, Math.floor(70 + level * 0.3 + (stats.speed ?? 0) * 0.55 - (stats.guard ?? 0) * 0.12));

  const mods = {
    might: stats.might ?? 0,
    ward: stats.guard ?? 0,
    crit: stats.crit ?? 0,
    swift: stats.haste ?? 0,
    // Casters hit harder with spells via Arcana; a touch of leech never hurts a damage read.
    dmg: 1 + (stats.arcana ?? 0) * 0.004 + (stats.leech ?? 0) * 0.002,
  };

  return {
    uid: nextUid(),
    name,
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
    mods,
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
      const tmp = a[p]!;
      a[p] = a[n]!;
      a[n] = tmp;
      n = p;
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
        const l = n * 2 + 1;
        const r = l + 1;
        let m = n;
        if (l < a.length && a[l]!.c < a[m]!.c) m = l;
        if (r < a.length && a[r]!.c < a[m]!.c) m = r;
        if (m === n) break;
        const tmp = a[m]!;
        a[m] = a[n]!;
        a[n] = tmp;
        n = m;
      }
    }
    return top;
  }
}

function reachable(grid: Uint8Array, w: number, h: number, x0: number, y0: number, x1: number, y1: number): boolean {
  const q = [y0 * w + x0];
  const seen = new Uint8Array(w * h);
  seen[q[0]!] = 1;
  let qi = 0;
  const goal = y1 * w + x1;
  while (qi < q.length) {
    const cur = q[qi++]!;
    if (cur === goal) return true;
    const x = cur % w;
    const y = (cur / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const k = ny * w + nx;
      if (seen[k] || grid[k] === 1) continue;
      seen[k] = 1;
      q.push(k);
    }
  }
  return false;
}

function los(grid: Uint8Array, w: number, h: number, x0: number, y0: number, x1: number, y1: number): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 10));
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) return false;
    if (grid[ty * w + tx] === 1) return false;
  }
  return true;
}

export type SiegeMap = {
  grid: Uint8Array;
  w: number;
  h: number;
  world: WorldData;
  /** Capture point, in tiles. */
  point: { tx: number; ty: number };
  /** Open deploy tiles for each side. */
  deploy: { tx: number; ty: number }[][];
};

/**
 * One 250×250 battlefield: grass and forest and water, with a walled stronghold at the centre whose
 * courtyard holds the capture point. Attackers deploy in a wide ring at the map's edge; defenders
 * deploy inside and just outside the keep. Gates are carved so the keep is always reachable.
 */
export function buildSiegeMap(rng: Rng): SiegeMap {
  const w = 250;
  const h = 250;
  const grid = new Uint8Array(w * h);
  const at = (x: number, y: number) => y * w + x;
  const inb = (x: number, y: number) => x > 0 && y > 0 && x < w - 1 && y < h - 1;

  // Border wall.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x === 0 || y === 0 || x === w - 1 || y === h - 1) grid[at(x, y)] = 1;

  const cx = (w >> 1) + irand(rng, 21) - 10;
  const cy = (h >> 1) + irand(rng, 21) - 10;
  const keepR = 26 + irand(rng, 8); // outer keep radius, tiles
  const courtR = keepR - 6;

  // Forests and rock clusters — cover, kept clear of the keep interior and the capture lane.
  const clusters = 150 + irand(rng, 70);
  for (let i = 0; i < clusters; i++) {
    const gx = 4 + irand(rng, w - 8);
    const gy = 4 + irand(rng, h - 8);
    const dk = Math.hypot(gx - cx, gy - cy);
    if (dk < keepR + 6) continue; // never grow walls over the keep ring
    const r = 1 + irand(rng, 3);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = gx + dx;
      const y = gy + dy;
      if (!inb(x, y)) continue;
      if (dx * dx + dy * dy <= r * r && rng() < 0.82) grid[at(x, y)] = 1;
    }
  }

  // A winding river of mud (slow terrain), with a couple of fords.
  const ry = 30 + irand(rng, h - 60);
  for (let x = 1; x < w - 1; x++) {
    const wob = Math.round(Math.sin(x * 0.05 + rng() * 0.3) * 10 + Math.sin(x * 0.17) * 4);
    for (let dy = -3; dy <= 3; dy++) {
      const y = ry + wob + dy;
      if (!inb(x, y)) continue;
      if (Math.hypot(x - cx, y - cy) < keepR + 4) continue;
      if (grid[at(x, y)] !== 1) grid[at(x, y)] = 3;
    }
  }

  // Scattered hazards (spike pits) out in the field.
  for (let i = 0; i < 90; i++) {
    const x = 6 + irand(rng, w - 12);
    const y = 6 + irand(rng, h - 12);
    if (Math.hypot(x - cx, y - cy) < keepR + 3) continue;
    if (grid[at(x, y)] === 0) grid[at(x, y)] = 2;
  }

  // The keep: a ring wall around an open courtyard.
  for (let y = cy - keepR; y <= cy + keepR; y++) {
    for (let x = cx - keepR; x <= cx + keepR; x++) {
      if (!inb(x, y)) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d <= courtR) grid[at(x, y)] = 0; // clear courtyard
      else if (d <= keepR && d > keepR - 2.2) grid[at(x, y)] = 1; // the wall itself
      else if (d < keepR - 2.2 && d > courtR) grid[at(x, y)] = 0; // inner bailey, open
    }
  }
  // Gates: carve openings through the wall at a few angles.
  const gates = 3 + irand(rng, 2);
  for (let g = 0; g < gates; g++) {
    const ang = (g / gates) * Math.PI * 2 + rng() * 0.6;
    for (let r = courtR - 1; r <= keepR + 3; r++) {
      for (let s = -2; s <= 2; s++) {
        const px = Math.round(cx + Math.cos(ang) * r - Math.sin(ang) * s);
        const py = Math.round(cy + Math.sin(ang) * r + Math.cos(ang) * s);
        if (inb(px, py)) grid[at(px, py)] = 0;
      }
    }
  }
  // Clear a small plaza right on the point.
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (inb(cx + dx, cy + dy)) grid[at(cx + dx, cy + dy)] = 0;

  // Deploy zones. Defenders: a ring just inside the wall + the courtyard. Attackers: the open ground
  // near the border, spread around the whole map so they converge from every side.
  const defenders: { tx: number; ty: number }[] = [];
  for (let y = cy - courtR + 1; y <= cy + courtR - 1; y++) {
    for (let x = cx - courtR + 1; x <= cx + courtR - 1; x++) {
      if (inb(x, y) && grid[at(x, y)] === 0) defenders.push({ tx: x, ty: y });
    }
  }
  const attackers: { tx: number; ty: number }[] = [];
  const band = 18;
  for (let ring = 0; ring < band; ring++) {
    const m = 4 + ring;
    for (let x = m; x < w - m; x += 3) {
      for (const y of [m, h - 1 - m]) if (inb(x, y) && grid[at(x, y)] === 0) attackers.push({ tx: x, ty: y });
    }
    for (let y = m; y < h - m; y += 3) {
      for (const x of [m, w - 1 - m]) if (inb(x, y) && grid[at(x, y)] === 0) attackers.push({ tx: x, ty: y });
    }
  }

  // Guarantee the point is reachable from a sample of attacker spawns; widen a gate if not.
  const sample = attackers.length ? attackers[Math.floor(attackers.length / 2)]! : { tx: 4, ty: 4 };
  if (!reachable(grid, w, h, sample.tx, sample.ty, cx, cy)) {
    for (let r = courtR - 1; r <= keepR + 4; r++) {
      for (let s = -3; s <= 3; s++) {
        const px = cx + r;
        const py = cy + s;
        if (inb(px, py)) grid[at(px, py)] = 0;
      }
    }
  }

  const tiles = Array.from(grid, (c, i) => {
    const x = i % w;
    const y = (i / w) | 0;
    const nearKeep = Math.hypot(x - cx, y - cy) <= keepR + 1;
    if (c === 1) return { floor: nearKeep ? 1 : 1, biome: nearKeep ? 4 : 4, block: 1, decor: 0 };
    if (c === 2) return { floor: 7, biome: 6, block: 0, decor: 0 };
    if (c === 3) return { floor: 6, biome: 5, block: 0, decor: 0 };
    return { floor: 0, biome: 2, block: 0, decor: 0 };
  });
  const world: WorldData = { w, h, tiles, spawns: [], cache: null };

  return { grid, w, h, world, point: { tx: cx, ty: cy }, deploy: [attackers, defenders] };
}

type Squad = { intent: "advance" | "hold"; gx: number; gy: number };

const POINT_R = TILE * 3.4; // capture radius, pixels
const CAP_RATE = 8; // attacker control gained per second per net body in the point
const CAP_RETAKE = 6; // defender control regained per second when they own the point
const TIME_LIMIT = 180; // seconds before the defenders win by holding

export class WitchArena {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  phase: ArenaSnap["phase"] = "setup";
  note = "Build each army, then loose the attack.";
  speed = 1;
  camMode: CamMode = "team";
  focus = ATTACKER;

  plans: ArmyPlan[] = [
    { size: 24, classes: ["bloodrager", "nightblade", "pathfinder", "spellweaver", "spiritbinder"] },
    { size: 20, classes: ["warden", "oathkeeper", "frostblade", "absolver", "vigilant"] },
  ];

  world: WorldData | null = null;
  grid: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  gw = 250;
  gh = 250;
  point = { x: 0, y: 0 };
  deploy: { tx: number; ty: number }[][] = [[], []];

  fighters: Fighter[] = [];
  squads: Squad[] = [];
  centres: { x: number; y: number; n: number }[] = [];
  inPoint = [0, 0];
  control = 0; // attacker share, 0..100
  winner = "";
  winSide = -1;
  age = 0;
  clock = 0;

  camX = 600;
  camY = 400;
  zoom = 0.4;
  wantX = 600;
  wantY = 400;
  wantZ = 0.4;
  floats: Flo[] = [];
  beams: Beam[] = [];
  cfx = new CombatFx();

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
  private pathBudget = 12;
  private dist = new Float32Array(0);
  private prev = new Int32Array(0);
  private heap = new Heap();
  private seed = 1;
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
      phase: "setup",
      note: "",
      speed: 1,
      cam: "team",
      focus: 0,
      clock: "0:00",
      timeLeft: "3:00",
      control: 0,
      held: "defenders",
      armies: [],
      classOptions: classOptions(),
      winner: "",
      winSide: -1,
    };
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    fn();
    return () => this.listeners.delete(fn);
  }

  getSnap(): ArenaSnap {
    return this.snap;
  }

  start(seed: unknown): void {
    this.running = true;
    this.lastT = performance.now();
    this.resize();
    this.seed = (typeof seed === "number" ? seed : Date.now()) >>> 0 || 1;
    this.regen();
    this.note = "A walled keep, a point to take. Build both armies, then attack.";
    this.bind();
    this.publish();
    const loop = (t: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (t - this.lastT) / 1000);
      this.lastT = t;
      if (!this.fitted && this.viewW > 8) {
        this.resize();
        if (this.phase !== "fight") this.fitMap();
        this.fitted = true;
      }
      if (this.phase === "fight") this.step(dt * this.speed);
      else this.clock += dt;
      this.driveCam(dt);
      this.draw();
      this.pubAt -= dt;
      if (this.phase === "fight" && this.pubAt <= 0) {
        this.pubAt = 0.4;
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
  }

  // --- setup controls -------------------------------------------------------

  private regen(): void {
    const m = buildSiegeMap(mulberry32(this.seed));
    this.grid = m.grid;
    this.gw = m.w;
    this.gh = m.h;
    this.world = m.world;
    this.point = { x: m.point.tx * TILE + TILE / 2, y: m.point.ty * TILE + TILE / 2 };
    this.deploy = m.deploy;
    this.dist = new Float32Array(m.w * m.h);
    this.prev = new Int32Array(m.w * m.h);
    this.fighters = [];
    this.squads = [];
    this.fitMap();
  }

  newBattlefield(): void {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0 || 1;
    this.phase = "setup";
    this.winner = "";
    this.winSide = -1;
    this.control = 0;
    this.regen();
    this.note = "A fresh battlefield. Same armies, new ground.";
    this.publish();
  }

  setSize(side: number, n: number): void {
    const p = this.plans[side];
    if (!p) return;
    p.size = Math.max(4, Math.min(60, Math.round(n) || 4));
    this.publish();
  }

  toggleClass(side: number, id: ClassId): void {
    const p = this.plans[side];
    if (!p) return;
    const i = p.classes.indexOf(id);
    if (i >= 0) {
      if (p.classes.length > 1) p.classes.splice(i, 1);
    } else {
      p.classes.push(id);
    }
    this.publish();
  }

  setSpeed(n: number): void {
    this.speed = n >= 4 ? 4 : n >= 2 ? 2 : 1;
    this.publish();
  }

  setCam(mode: CamMode): void {
    this.camMode = mode;
    if (mode === "team") this.frame();
    this.publish();
  }

  cycleTeam(dir: number): void {
    this.focus = (this.focus + dir + SIDES.length) % SIDES.length;
    this.camMode = "team";
    this.frame();
    this.camX = this.wantX;
    this.camY = this.wantY;
    this.publish();
  }

  zoomBy(factor: number): void {
    this.zoom = Math.max(0.12, Math.min(2.4, this.zoom * factor));
    if (this.phase === "fight" || this.phase === "result") this.camMode = "free";
    this.publish();
  }

  // --- launch ---------------------------------------------------------------

  launch(): void {
    if (!this.world) this.regen();
    const rng = mulberry32((Date.now() ^ ((Math.random() * 1e9) | 0)) >>> 0 || 9);
    this.fighters = [];
    this.floats = [];
    this.beams = [];
    this.cfx = new CombatFx();
    this.age = 0;
    this.clock = 0;
    this.control = 0;
    this.winner = "";
    this.winSide = -1;
    this.squads = [];

    for (const side of SIDES) {
      const plan = this.plans[side.id]!;
      const picks = plan.classes.length ? plan.classes : (["warlord"] as ClassId[]);
      const spots = this.spotsFrom(this.deploy[side.id] ?? [], plan.size, side.id);
      this.squads.push({ intent: side.id === ATTACKER ? "advance" : "hold", gx: this.point.x, gy: this.point.y });
      for (let i = 0; i < plan.size; i++) {
        const classId = picks[i % picks.length]!;
        const level = side.id === DEFENDER ? 10 + irand(rng, 10) : 9 + irand(rng, 11);
        const w = witchFromClass(rng, classId, level);
        const spot = spots[i % spots.length]!;
        this.spawnWitch(w, side.id, spot.tx, spot.ty, rng);
        const body = this.fighters[this.fighters.length - 1 - w.spirits.length];
        if (body) { body.squad = Math.floor(i / 10); body.rank = i % 10; }
      }
    }

    this.phase = "fight";
    this.camMode = "team";
    this.focus = ATTACKER;
    this.frame();
    this.camX = this.wantX;
    this.camY = this.wantY;
    this.zoom = this.wantZ;
    this.note = "The attack is loosed. Take the point or wipe the defenders.";
    this.publish();
    this.resize();
  }

  again(): void {
    this.launch();
  }

  backSetup(): void {
    this.phase = "setup";
    this.fighters = [];
    this.squads = [];
    this.winner = "";
    this.winSide = -1;
    this.control = 0;
    this.cfx = new CombatFx();
    this.beams = [];
    this.floats = [];
    this.fitMap();
    this.note = "Change the armies, or loose the attack again.";
    this.publish();
  }

  /** Spread n soldiers across a list of open deploy tiles. Attackers cluster into arcs; defenders ring the point. */
  private spotsFrom(list: { tx: number; ty: number }[], n: number, side: number): { tx: number; ty: number }[] {
    if (!list.length) return [{ tx: Math.floor(this.gw / 2), ty: Math.floor(this.gh / 2) }];
    const sorted = side === DEFENDER
      ? [...list].sort((a, b) => Math.hypot(a.tx * TILE - this.point.x, a.ty * TILE - this.point.y) - Math.hypot(b.tx * TILE - this.point.x, b.ty * TILE - this.point.y))
      : list;
    const out: { tx: number; ty: number }[] = [];
    for (let i = 0; i < n; i++) out.push(sorted[Math.min(sorted.length - 1, Math.floor((i * sorted.length) / n))]!);
    return out;
  }

  // --- spawning -------------------------------------------------------------

  private spawnWitch(w: ArenaWitch, side: number, tx: number, ty: number, rng: Rng): void {
    const gear = [w.weapon, ...w.gear];
    const id = nextUid();
    const body = this.makeBody(w, side, tx, ty, id, "", w.role, w.mods.dmg);
    body.moveIds = w.moves;
    body.might = ench(gear, "might") + w.mods.might;
    body.ward = ench(gear, "ward") + w.mods.ward;
    body.crit = 4 + ench(gear, "crit_edge") + w.mods.crit;
    body.swift = ench(gear, "swift") + w.mods.swift;
    body.echo = ench(gear, "echo_guard");
    body.double = ench(gear, "double_strike");
    body.second = ench(gear, "second_chance") > 0;
    this.fighters.push(body);
    if (!w.spirits.length) return;
    w.spirits.forEach((s, i) => {
      const spot = this.openNear(tx, ty, i);
      const spirit = this.makeBody(
        {
          name: s.name,
          race: w.race,
          type: s.type,
          level: w.level,
          maxHp: Math.floor((78 + w.level * 16) * 0.22),
          speed: Math.floor(68 + w.level * 0.2),
          moves: [s.move],
          weapon: w.weapon,
          gear: w.gear,
          hair: w.hair,
          skin: w.skin,
        },
        side,
        spot.tx,
        spot.ty,
        nextUid(),
        id,
        "spirit",
        0.34,
      );
      spirit.template = s.template;
      spirit.look = s.look;
      spirit.race = null;
      spirit.pieces = [];
      spirit.weapon = null;
      spirit.moveIds = [s.move];
      spirit.walk = rng() * 4;
      this.fighters.push(spirit);
    });
  }

  private openNear(tx: number, ty: number, i: number): { tx: number; ty: number } {
    const opts = [[tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1], [tx + 1, ty + 1], [tx - 1, ty - 1]];
    const [x, y] = opts[i % opts.length]!;
    if (x > 0 && y > 0 && x < this.gw - 1 && y < this.gh - 1 && this.grid[y * this.gw + x] !== 1) return { tx: x, ty: y };
    return { tx, ty };
  }

  private makeBody(
    w: Pick<ArenaWitch, "name" | "race" | "type" | "level" | "maxHp" | "speed" | "moves" | "weapon" | "gear" | "hair" | "skin">,
    side: number,
    tx: number,
    ty: number,
    id: string,
    master: string,
    role: Fighter["role"],
    dmgMul: number,
  ): Fighter {
    const pieces = [w.weapon, ...w.gear].map((g) => ({
      slot: g.slot,
      style: g.style,
      type: g.type,
      fxSeed: g.fxSeed,
      gene: geneSeedOf(g),
      quality: Math.max(0, QUALITY.indexOf(g.quality)),
    }));
    return {
      id,
      side,
      role,
      name: w.name,
      race: w.race,
      type: w.type,
      level: w.level,
      x: tx * TILE + TILE / 2,
      y: ty * TILE + TILE / 2,
      hp: w.maxHp,
      max: w.maxHp,
      speed: w.speed,
      facing: 1,
      direction: "down",
      walk: 0,
      hurt: 0,
      cd: 0.25 + Math.random() * 0.45,
      shield: 0,
      root: 0,
      sleep: 0,
      burn: 0,
      trap: 0.2,
      moveIds: w.moves,
      weapon: w.weapon,
      pieces,
      template: 20,
      look: null,
      master,
      alive: true,
      dmgMul,
      might: 0,
      ward: 0,
      crit: 4,
      swift: 0,
      echo: 0,
      double: 0,
      second: false,
      usedSecond: false,
      think: Math.random() * 0.3,
      stuck: 0,
      lastX: tx * TILE,
      lastY: ty * TILE,
      path: [],
      hair: w.hair,
      skin: w.skin,
      squad: 0,
      rank: 0,
    };
  }

  // --- simulation -----------------------------------------------------------

  private step(dt: number): void {
    this.age += dt;
    this.clock += dt;
    this.pathBudget = 14;
    this.centres = [{ x: 0, y: 0, n: 0 }, { x: 0, y: 0, n: 0 }];
    this.inPoint = [0, 0];
    for (const f of this.fighters) {
      if (!f.alive || f.role === "spirit") continue;
      const c = this.centres[f.side];
      if (c) { c.x += f.x; c.y += f.y; c.n += 1; }
      if (Math.hypot(f.x - this.point.x, f.y - this.point.y) <= POINT_R) this.inPoint[f.side]! += 1;
    }
    for (const c of this.centres) if (c.n) { c.x /= c.n; c.y /= c.n; }

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
      const tx = Math.floor(f.x / TILE);
      const ty = Math.floor(f.y / TILE);
      const cell = this.grid[ty * this.gw + tx] ?? 1;
      if (cell === 2) {
        f.trap -= dt;
        if (f.trap <= 0) {
          f.trap = 0.6;
          this.hurt(f, 5 + f.level * 0.35, "#c4473a");
          this.float(f.x, f.y - 20, "trap", "#ffb4a8");
        }
      }
      if (f.sleep > 0) continue;
      f.think -= dt;
      if (f.think <= 0) {
        f.think = 0.3 + Math.random() * 0.18;
        this.think(f);
      }
      if (f.root <= 0) this.follow(f, dt, cell === 3);
      this.strike(f);
    }

    // Capture progress.
    const a = this.inPoint[ATTACKER]!;
    const d = this.inPoint[DEFENDER]!;
    if (a > 0 && a > d) this.control = Math.min(100, this.control + CAP_RATE * dt * Math.min(3, a - d));
    else if (d >= a) this.control = Math.max(0, this.control - CAP_RETAKE * dt);

    this.cfx.tick(dt);
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);
    for (const fl of this.floats) fl.life -= dt;
    this.floats = this.floats.filter((fl) => fl.life > 0);
    if (this.age > 1) this.maybeEnd();
  }

  private think(f: Fighter): void {
    const allies = this.fighters.filter((o) => o.alive && o.side === f.side);
    const foesAll = this.fighters.filter((o) => o.alive && o.side !== f.side);
    const foes = foesAll.filter((o) => o.role !== "spirit");
    const pool = foes.length ? foes : foesAll;

    if (f.role === "spirit") {
      const master = allies.find((a) => a.id === f.master);
      if (master) {
        const ang = Math.atan2(f.y - master.y, f.x - master.x) || 0;
        this.seek(f, master.x + Math.cos(ang) * 26, master.y + Math.sin(ang) * 20);
      }
      return;
    }
    if (!pool.length) {
      this.seek(f, this.point.x, this.point.y);
      return;
    }

    const near = nearest(pool, f.x, f.y);
    const nd = Math.hypot(near.x - f.x, near.y - f.y);
    const dPoint = Math.hypot(f.x - this.point.x, f.y - this.point.y);

    if (f.side === ATTACKER) {
      // Smart assault: brush aside whoever is in reach, otherwise press the point.
      if (nd < 240) return this.engage(f, pool, allies);
      if (dPoint > POINT_R * 0.7) {
        const slot = this.ringSlot(f, POINT_R * 0.6);
        this.seek(f, slot.x, slot.y);
        return;
      }
      this.engage(f, pool, allies);
      return;
    }

    // Defender: hold the point. Engage attackers that come to the walls; collapse onto the point if
    // it is being contested; otherwise fall back to a defensive ring and wait.
    const leash = POINT_R * 3.2;
    const contested = this.inPoint[ATTACKER]! > 0;
    const nearFromPoint = Math.hypot(near.x - this.point.x, near.y - this.point.y);
    if (contested) {
      // Someone is on the point — converge and fight the nearest intruder.
      if (nd < 260) return this.engage(f, pool, allies);
      this.seek(f, this.point.x, this.point.y);
      return;
    }
    if (nd < 220 && nearFromPoint < leash) return this.engage(f, pool, allies);
    const ring = POINT_R * 1.7;
    if (dPoint > ring) {
      const slot = this.ringSlot(f, ring);
      this.seek(f, slot.x, slot.y);
      return;
    }
    // Idle on the ring, facing out.
    if (nd < 240) this.engage(f, pool, allies);
  }

  /** A standing position spread around the point, keyed to the fighter so a line forms rather than a pile. */
  private ringSlot(f: Fighter, radius: number): { x: number; y: number } {
    const seed = (f.squad * 7 + f.rank) || (f.x + f.y);
    const ang = (seed * 0.61803) * Math.PI * 2 + (f.side === ATTACKER ? Math.atan2(f.y - this.point.y, f.x - this.point.x) : 0);
    return { x: this.point.x + Math.cos(ang) * radius, y: this.point.y + Math.sin(ang) * radius };
  }

  /** Approach-and-hold against the best nearby target, spreading fire so no one is mobbed alone. */
  private engage(f: Fighter, foes: Fighter[], allies: Fighter[]): void {
    const near = nearest(foes, f.x, f.y);
    const nd = Math.hypot(near.x - f.x, near.y - f.y);
    let best = near;
    let bestS = 1e9;
    for (const o of foes) {
      const d = Math.hypot(o.x - f.x, o.y - f.y);
      if (d > nd + 160) continue;
      const crowd = allies.filter((al) => al.path.length && Math.hypot(al.x - o.x, al.y - o.y) < 70).length;
      const s = d + crowd * 45 + (o.hp / o.max) * 60;
      if (s < bestS) { bestS = s; best = o; }
    }
    const move = this.bestMove(f, best, false);
    const reach = attackRange(move);
    const form = attackForm(move);
    const d = Math.hypot(best.x - f.x, best.y - f.y);
    if (form !== "melee" && d <= reach * 0.85 && d > reach * 0.35 && this.sees(f.x, f.y, best.x, best.y)) {
      f.path = [];
      return;
    }
    const ang = Math.atan2(f.y - best.y, f.x - best.x);
    const hold = form === "melee" ? 24 : Math.min(reach * 0.7, 120);
    this.seek(f, best.x + Math.cos(ang) * hold, best.y + Math.sin(ang) * hold);
  }

  private seek(f: Fighter, x: number, y: number): void {
    const moved = Math.hypot(f.x - f.lastX, f.y - f.lastY);
    if (moved < 4) f.stuck += 0.4;
    else f.stuck = 0;
    f.lastX = f.x;
    f.lastY = f.y;
    if (f.stuck > 1.15) {
      f.stuck = 0;
      const ang = Math.random() * Math.PI * 2;
      x = f.x + Math.cos(ang) * 90;
      y = f.y + Math.sin(ang) * 90;
      f.path = [];
    }
    const d = Math.hypot(x - f.x, y - f.y);
    if (d < 16) {
      f.path = [];
      return;
    }
    if (d < 560 && this.sees(f.x, f.y, x, y)) {
      f.path = [{ x, y }];
      return;
    }
    this.pathTo(f, x, y, f.hp / f.max > 0.35);
  }

  private sees(x0: number, y0: number, x1: number, y1: number): boolean {
    return los(this.grid, this.gw, this.gh, x0, y0, x1, y1);
  }

  private bestMove(f: Fighter, target: Fighter | null, commit: boolean): Move {
    const list = f.moveIds.map((id) => MOVE_BY_ID[id]).filter((m): m is Move => !!m);
    const bag = list.length ? list : [MOVES[0]!];
    if (!commit) return bag.slice().sort((a, b) => b.power - a.power)[0]!;
    const hurt = f.hp / f.max < 0.48;
    if (hurt) {
      const mend = bag.find((m) => m.effect === "mend" || moveTactic(m) === "heal");
      if (mend) {
        const ally = this.lowestFriend(f);
        if (ally && ally.hp / ally.max < 0.62) return mend;
      }
      const ward = bag.find((m) => m.effect === "shell" || moveTactic(m) === "ward");
      if (ward && f.shield <= 0) return ward;
    }
    if (f.role === "summoner") {
      const spirits = this.fighters.filter((a) => a.alive && a.master === f.id);
      const bruised = spirits.find((s) => s.hp / s.max < 0.55);
      const mend = bag.find((m) => m.effect === "mend" || moveTactic(m) === "heal");
      if (bruised && mend) return mend;
    }
    const d = target ? Math.hypot(target.x - f.x, target.y - f.y) : 999;
    const inReach = bag.filter((m) => attackRange(m) + 10 >= d);
    const use = (inReach.length ? inReach : bag).slice().sort((a, b) => b.power - a.power);
    return use[0]!;
  }

  private lowestFriend(f: Fighter): Fighter | null {
    const allies = this.fighters.filter((a) => a.alive && a.side === f.side);
    if (!allies.length) return f;
    return allies.reduce((a, b) => (a.hp / a.max < b.hp / b.max ? a : b));
  }

  private pathTo(f: Fighter, x: number, y: number, fear: boolean): void {
    const sx = Math.floor(f.x / TILE);
    const sy = Math.floor(f.y / TILE);
    const gx = Math.floor(x / TILE);
    const gy = Math.floor(y / TILE);
    if (sx === gx && sy === gy) {
      f.path = [{ x, y }];
      return;
    }
    if (this.pathBudget <= 0) {
      f.path = [{ x, y }];
      return;
    }
    this.pathBudget -= 1;
    f.path = this.route(sx, sy, gx, gy, fear);
  }

  /** A* / greedy best-first on the tile grid, reusing per-instance scratch buffers. */
  private route(sx: number, sy: number, gxIn: number, gyIn: number, fear: boolean): { x: number; y: number }[] {
    const w = this.gw;
    const h = this.gh;
    const grid = this.grid;
    sx = Math.max(1, Math.min(w - 2, sx));
    sy = Math.max(1, Math.min(h - 2, sy));
    let gx = Math.max(1, Math.min(w - 2, gxIn));
    let gy = Math.max(1, Math.min(h - 2, gyIn));
    if (grid[gy * w + gx] === 1) {
      let found = false;
      for (let r = 1; r <= 4 && !found; r++) {
        for (let dy = -r; dy <= r && !found; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = gx + dx;
            const ny = gy + dy;
            if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) continue;
            if (grid[ny * w + nx] !== 1) { gx = nx; gy = ny; found = true; break; }
          }
        }
      }
    }
    const start = sy * w + sx;
    const goal = gy * w + gx;
    const dist = this.dist;
    const prev = this.prev;
    dist.fill(1e9);
    prev.fill(-1);
    dist[start] = 0;
    this.heap.clear();
    this.heap.push(start, 0);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    const hcost = (i: number) => Math.abs((i % w) - gx) + Math.abs(((i / w) | 0) - gy);
    let best = start;
    let bestH = hcost(start);
    let guard = 0;
    const budget = Math.min(w * h, 9000);
    while (guard++ < budget) {
      const cur = this.heap.pop();
      if (!cur) break;
      if (cur.c > dist[cur.i]! + 0.01) continue;
      const hc = hcost(cur.i);
      if (hc < bestH) { bestH = hc; best = cur.i; }
      if (cur.i === goal) break;
      const x = cur.i % w;
      const y = (cur.i / w) | 0;
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx;
        if (grid[k] === 1) continue;
        const stepC = grid[k] === 2 ? (fear ? 7 : 2.2) : grid[k] === 3 ? 2.4 : 1;
        const next = dist[cur.i]! + stepC;
        if (next + 0.01 < dist[k]!) {
          dist[k] = next;
          prev[k] = cur.i;
          this.heap.push(k, next);
        }
      }
    }
    const end = prev[goal] !== -1 || goal === start ? goal : best;
    if (end === start) return [{ x: gx * TILE + TILE / 2, y: gy * TILE + TILE / 2 }];
    const raw: { x: number; y: number }[] = [];
    let c = end;
    let safety = 0;
    while (c !== -1 && safety++ < 1200) {
      raw.push({ x: (c % w) * TILE + TILE / 2, y: ((c / w) | 0) * TILE + TILE / 2 });
      if (c === start) break;
      c = prev[c] ?? -1;
    }
    raw.reverse();
    if (raw.length <= 2) return raw;
    const open = (x: number, y: number) => {
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) return false;
      return grid[ty * w + tx] !== 1;
    };
    const seesLocal = (a: { x: number; y: number }, b: { x: number; y: number }) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 12));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        if (!open(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
      }
      return true;
    };
    const slim: { x: number; y: number }[] = [];
    let i = 0;
    while (i < raw.length - 1) {
      let j = Math.min(raw.length - 1, i + 14);
      while (j > i + 1 && !seesLocal(raw[i]!, raw[j]!)) j--;
      slim.push(raw[j]!);
      i = j;
    }
    return slim;
  }

  private follow(f: Fighter, dt: number, mud: boolean): void {
    let tx = f.x;
    let ty = f.y;
    const step = f.path[0];
    if (step) {
      tx = step.x;
      ty = step.y;
      if (Math.hypot(step.x - f.x, step.y - f.y) < 10) f.path.shift();
    }
    let dx = tx - f.x;
    let dy = ty - f.y;
    const l = Math.hypot(dx, dy);
    if (l < 2) return;
    for (const o of this.fighters) {
      if (o === f || !o.alive || o.side !== f.side) continue;
      const d = Math.hypot(f.x - o.x, f.y - o.y);
      if (d < 18 && d > 0.2) {
        dx += ((f.x - o.x) / d) * 8;
        dy += ((f.y - o.y) / d) * 8;
      }
    }
    const mag = Math.hypot(dx, dy) || 1;
    const speed = f.speed * (mud ? 0.55 : 1) * (f.role === "spirit" ? 1.05 : 1);
    this.slide(f, (dx / mag) * speed * dt, (dy / mag) * speed * dt);
  }

  private slide(f: Fighter, dx: number, dy: number): void {
    const blocked = (x: number, y: number) => {
      const tx = Math.floor(x / TILE);
      const ty = Math.floor(y / TILE);
      if (tx < 0 || ty < 0 || tx >= this.gw || ty >= this.gh) return true;
      return this.grid[ty * this.gw + tx] === 1;
    };
    const x = f.x;
    const y = f.y;
    if (!blocked(f.x + dx, f.y)) f.x += dx;
    if (!blocked(f.x, f.y + dy)) f.y += dy;
    f.direction = directionFromDelta(f.x - x, f.y - y, f.direction);
    if (f.x !== x) f.facing = f.x < x ? -1 : 1;
  }

  private pickTarget(f: Fighter, foes: Fighter[]): Fighter {
    let best = foes[0]!;
    let score = 1e9;
    for (const o of foes) {
      const d = Math.hypot(o.x - f.x, o.y - f.y);
      const low = o.hp / o.max < 0.34 ? 0.62 : 1;
      const s = d * low;
      if (s < score) { score = s; best = o; }
    }
    return best;
  }

  private strike(f: Fighter): void {
    if (f.cd > 0 || f.sleep > 0) return;
    const foes = this.fighters.filter((o) => o.alive && o.side !== f.side);
    const allies = this.fighters.filter((o) => o.alive && o.side === f.side);
    const hurt = f.hp / f.max < 0.5 ? this.lowestFriend(f) : null;
    if (hurt && hurt.hp / hurt.max < 0.55) {
      const mend = f.moveIds.map((id) => MOVE_BY_ID[id]).find((m) => m && (m.effect === "mend" || moveTactic(m) === "heal"));
      if (mend && Math.hypot(hurt.x - f.x, hurt.y - f.y) < attackRange(mend) + 8) {
        this.cast(f, hurt, mend, true);
        f.cd = this.cooldown(f, mend);
        return;
      }
    }
    if (!foes.length) return;
    const witches = foes.filter((o) => o.role !== "spirit");
    const target = this.pickTarget(f, witches.length ? witches : foes);
    const move = this.bestMove(f, target, true);
    const tactic = moveTactic(move);
    if (tactic === "heal" || move.effect === "mend") {
      const ally = hurt && hurt.hp / hurt.max < 0.7 ? hurt : allies.reduce((a, b) => (a.hp / a.max < b.hp / b.max ? a : b), f);
      if (Math.hypot(ally.x - f.x, ally.y - f.y) > attackRange(move) + 8) return;
      this.cast(f, ally, move, true);
      f.cd = this.cooldown(f, move);
      return;
    }
    if ((tactic === "ward" || move.effect === "shell") && f.shield <= 0) {
      this.cast(f, f, move, true);
      f.shield = 2.6;
      f.cd = this.cooldown(f, move);
      return;
    }
    const d = Math.hypot(target.x - f.x, target.y - f.y);
    const reach = attackRange(move);
    if (tactic === "roll" && d < 78) {
      const ang = Math.atan2(f.y - target.y, f.x - target.x);
      this.slide(f, Math.cos(ang) * 54, Math.sin(ang) * 54);
      this.cfx.cast(move, attackForm(move), tactic, f.x, f.y - 16, f.x + Math.cos(ang) * 54, f.y + Math.sin(ang) * 54);
      f.cd = 0.55;
      return;
    }
    if (d > reach + 8) return;
    const form = attackForm(move);
    if (form !== "melee" && !this.sees(f.x, f.y - 8, target.x, target.y - 8)) return;
    if (tactic === "blink" && d > 46) {
      const ang = Math.atan2(target.y - f.y, target.x - f.x);
      const nx = target.x - Math.cos(ang) * 30;
      const ny = target.y - Math.sin(ang) * 30;
      if (!this.pillar(nx, ny)) {
        this.cfx.cast(move, form, tactic, f.x, f.y - 12, nx, ny - 12);
        f.x = nx;
        f.y = ny;
      }
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
    const y0 = f.y - 18;
    const y1 = target.y - 14;
    this.beams.push({ x0: f.x, y0, x1: target.x, y1, life: 0.34, color: TYPES[move.type].color });
    this.cfx.cast(move, attackForm(move), moveTactic(move), f.x, y0, target.x, y1);
    if (aid) {
      if (move.effect === "mend" || moveTactic(move) === "heal") {
        const heal = (10 + move.power * 0.7) * (0.75 + f.dmgMul);
        target.hp = Math.min(target.max, target.hp + heal);
        this.float(target.x, target.y - 28, `${Math.round(heal)}`, "#9ad8c8");
      } else this.float(f.x, f.y - 30, "ward", "#e6c15a");
      return;
    }
    const tm = typeMult(move.type, target.type);
    if (tm === 0) {
      this.float(target.x, target.y - 26, "immune", "#e7d9ff");
      return;
    }
    if (Math.random() * 100 < target.echo) {
      this.float(target.x, target.y - 26, "miss", "#f0e2c8");
      this.cfx.evade(target.x, target.y - 12);
      return;
    }
    const form = attackForm(move);
    const gear = 1 + (f.weapon?.level ?? f.level) * 0.035;
    const might = 1 + f.might / 100;
    const stab = move.type === f.type ? 1.12 : 1;
    let dmg =
      (5 + move.power * 0.34) *
      (1 + f.level * 0.045) *
      gear *
      might *
      stab *
      tm *
      f.dmgMul *
      (form === "melee" ? 1.15 : 1) *
      (moveTactic(move) === "heavy" ? 1.35 : 1);
    const crit = Math.random() * 100 < move.crit + f.crit;
    if (crit) dmg *= 1.65;
    if (target.shield > 0 && form !== "melee") dmg *= 0.55;
    dmg *= 1 - Math.min(0.45, defenseVs(form, target.ward) / 140);
    const hits = Math.random() * 100 < f.double ? 2 : 1;
    for (let i = 0; i < hits; i++) this.hurt(target, Math.max(1, dmg * (hits === 2 ? 0.8 : 1)), crit ? "#fff1a8" : "#fff6e8");
    if (move.effect === "burn") target.burn = Math.max(target.burn, 2.4);
    if (move.effect === "root") target.root = Math.max(target.root, 1.3);
    if (target.sleep > 0) target.sleep = 0;
    else if (move.effect === "sleep" && Math.random() < 0.45) target.sleep = 1.4;
    if (move.effect === "leech") f.hp = Math.min(f.max, f.hp + dmg * 0.25);
  }

  private hurt(f: Fighter, amount: number, color: string | null): void {
    if (!f.alive) return;
    f.hp -= amount;
    f.hurt = 0.35;
    if (color && amount >= 1) this.float(f.x, f.y - 24, `${Math.round(amount)}`, color);
    if (f.hp > 0) return;
    if (f.second && !f.usedSecond) {
      f.usedSecond = true;
      f.hp = Math.max(1, f.max * 0.22);
      this.float(f.x, f.y - 36, "second", "#e6c15a");
      return;
    }
    f.hp = 0;
    f.alive = false;
    if (f.role !== "spirit") {
      for (const s of this.fighters) {
        if (s.master === f.id && s.alive) {
          s.alive = false;
          s.hp = 0;
          this.float(s.x, s.y - 16, "unravels", "#b9a8d8");
        }
      }
    }
  }

  private pillar(x: number, y: number): boolean {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= this.gw || ty >= this.gh) return true;
    return this.grid[ty * this.gw + tx] === 1;
  }

  private maybeEnd(): void {
    const atkAlive = this.fighters.some((f) => f.alive && f.side === ATTACKER && f.role !== "spirit");
    const defAlive = this.fighters.some((f) => f.alive && f.side === DEFENDER && f.role !== "spirit");
    if (this.control >= 100) return this.finish(ATTACKER, "Attackers seize the stronghold.");
    if (!defAlive) return this.finish(ATTACKER, "The defenders are broken. The keep falls.");
    if (!atkAlive) return this.finish(DEFENDER, "The assault is spent. The defenders hold.");
    if (this.age >= TIME_LIMIT) return this.finish(DEFENDER, "Time. The defenders held the point.");
  }

  private finish(side: number, note: string): void {
    this.winSide = side;
    this.winner = note;
    this.phase = "result";
    this.note = note;
    this.publish();
  }

  // --- camera & render ------------------------------------------------------

  private frame(): void {
    const live = this.fighters.filter((f) => f.alive && f.role !== "spirit");
    const pack = this.phase === "fight" || this.phase === "result" ? live.filter((f) => f.side === this.focus) : live;
    const use = pack.length ? pack : live;
    if (!use.length) {
      this.wantX = this.point.x;
      this.wantY = this.point.y;
      this.wantZ = Math.max(0.2, Math.min(1.2, this.zoom));
      return;
    }
    let minX = 1e9;
    let minY = 1e9;
    let maxX = -1e9;
    let maxY = -1e9;
    for (const f of use) {
      minX = Math.min(minX, f.x);
      minY = Math.min(minY, f.y);
      maxX = Math.max(maxX, f.x);
      maxY = Math.max(maxY, f.y);
    }
    const span = Math.max(maxX - minX, maxY - minY, 200);
    const fit = Math.min(this.viewW, this.viewH) / (span + 320);
    this.wantX = (minX + maxX) / 2;
    this.wantY = (minY + maxY) / 2 - 8;
    this.wantZ = Math.max(0.22, Math.min(1.3, fit));
    const k = 0.12;
    this.camX += (this.wantX - this.camX) * k;
    this.camY += (this.wantY - this.camY) * k;
    this.zoom += (this.wantZ - this.zoom) * k;
  }

  private driveCam(dt: number): void {
    let x = 0;
    let y = 0;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) y -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y += 1;
    if ((x || y) && this.camMode === "team" && (this.phase === "fight" || this.phase === "result")) {
      this.camMode = "free";
      this.publish();
    }
    const pan = this.camMode === "free" || this.phase === "setup" || this.phase === "result";
    if ((x || y) && pan && !(this.camMode === "team" && this.phase === "result")) {
      const m = Math.hypot(x, y) || 1;
      const sp = 640 / Math.max(0.3, this.zoom);
      this.camX += (x / m) * sp * dt;
      this.camY += (y / m) * sp * dt;
      this.clampCam();
      return;
    }
    if ((this.phase === "fight" || this.phase === "result") && this.camMode === "team") this.frame();
  }

  private fitMap(): void {
    if (this.viewW < 8 || this.viewH < 8 || this.gw < 2) return;
    const mw = this.gw * TILE;
    const mh = this.gh * TILE;
    this.camX = this.point.x || mw / 2;
    this.camY = this.point.y || mh / 2;
    this.zoom = Math.max(0.12, Math.min(1, Math.min(this.viewW / mw, this.viewH / mh) * 1.6));
    this.wantX = this.camX;
    this.wantY = this.camY;
    this.wantZ = this.zoom;
    this.clampCam();
  }

  private clampCam(): void {
    const mw = this.gw * TILE;
    const mh = this.gh * TILE;
    this.camX = Math.max(0, Math.min(mw, this.camX));
    this.camY = Math.max(0, Math.min(mh, this.camY));
  }

  private float(x: number, y: number, text: string, color: string): void {
    if (this.floats.length > 90) this.floats.shift();
    this.floats.push({ x, y, text, life: 0.9, color });
  }

  private color(side: number): string {
    return SIDES[side]?.color ?? "#f0e2c8";
  }

  private draw(): void {
    const ctx = this.ctx;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#100c0a";
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    if (!this.world) return;
    ctx.save();
    ctx.translate(this.viewW / 2, this.viewH / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX, -this.camY);
    ctx.imageSmoothingEnabled = false;
    drawWorldSlice(ctx, this.world, this.camX, this.camY, this.viewW, this.viewH, this.zoom);
    this.drawPoint(ctx);
    const order = this.fighters.filter((f) => f.alive).sort((a, b) => a.y - b.y);
    for (const f of order) {
      if (f.role === "spirit" && f.look) {
        drawMonster(ctx, {
          x: f.x,
          y: f.y,
          template: f.template,
          type: f.type,
          facing: f.facing,
          walk: f.walk,
          hurt: f.hurt,
          boss: false,
          rarity: 0,
          ghost: true,
          look: f.look,
          time: this.clock,
        });
      } else if (f.race) {
        drawActor(ctx, {
          x: f.x,
          y: f.y,
          race: f.race,
          direction: f.direction,
          female: true,
          hair: f.hair,
          skin: f.skin,
          facing: f.facing,
          walk: f.walk,
          attack: f.cd > 0.55 ? 0.4 : 0,
          hurt: f.hurt,
          pieces: f.pieces,
          setFx: null,
          setOn: false,
          time: this.clock,
          scale: 1,
        });
      }
      const bar = f.role === "spirit" ? 26 : 42;
      const by = f.y - (f.role === "spirit" ? 34 : 42);
      ctx.fillStyle = "#1a1214";
      ctx.fillRect(f.x - bar / 2 - 1, by - 1, bar + 2, 6);
      ctx.fillStyle = this.color(f.side);
      ctx.fillRect(f.x - bar / 2, by, bar * Math.max(0, f.hp / f.max), 4);
      if (f.role !== "spirit" && this.zoom > 0.75) drawShadowName(ctx, `${f.name} ${f.level}`, f.x, by - 12, this.color(f.side));
    }
    for (const b of this.beams) {
      const a = Math.max(0, Math.min(1, b.life * 3));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 4 / Math.max(0.4, this.zoom);
      ctx.beginPath();
      ctx.moveTo(b.x0, b.y0);
      ctx.lineTo(b.x1, b.y1);
      ctx.stroke();
      ctx.fillStyle = "#fff6d8";
      ctx.beginPath();
      ctx.arc(b.x1, b.y1, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    this.cfx.draw(ctx, this.clock);
    for (const fl of this.floats) {
      ctx.globalAlpha = Math.max(0, Math.min(1, fl.life * 2));
      drawShadowName(ctx, fl.text, fl.x, fl.y - (0.9 - fl.life) * 22, fl.color);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private drawPoint(ctx: CanvasRenderingContext2D): void {
    const held = this.control >= 99 ? ATTACKER : this.inPoint[ATTACKER]! > this.inPoint[DEFENDER]! && this.phase === "fight" ? ATTACKER : DEFENDER;
    const col = this.control >= 99 ? this.color(ATTACKER) : this.control <= 1 ? this.color(DEFENDER) : "#e6c15a";
    ctx.save();
    // Capture disc.
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(this.point.x, this.point.y, POINT_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 3 / Math.max(0.4, this.zoom);
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.arc(this.point.x, this.point.y, POINT_R, 0, Math.PI * 2);
    ctx.stroke();
    // Control arc: how far the attackers have pushed it.
    if (this.phase === "fight" || this.phase === "result") {
      ctx.lineWidth = 6 / Math.max(0.4, this.zoom);
      ctx.strokeStyle = this.color(ATTACKER);
      ctx.beginPath();
      ctx.arc(this.point.x, this.point.y, POINT_R - 6, -Math.PI / 2, -Math.PI / 2 + (this.control / 100) * Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    drawShadowName(ctx, held === ATTACKER ? "TAKEN" : "THE POINT", this.point.x, this.point.y - POINT_R - 10, col);
    ctx.restore();
  }

  // --- input ----------------------------------------------------------------

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

  private typing(e: Event): boolean {
    const tag = (e.target as HTMLElement | null)?.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    const p = this.local(e);
    this.drag = { x: p.x, y: p.y, camX: this.camX, camY: this.camY, moved: false };
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.drag) return;
    const p = this.local(e);
    const dx = p.x - this.drag.x;
    const dy = p.y - this.drag.y;
    if (Math.hypot(dx, dy) > 5) this.drag.moved = true;
    const look = this.camMode === "free" || this.phase === "setup" || this.phase === "result";
    if (this.drag.moved && look) {
      this.camX = this.drag.camX - dx / this.zoom;
      this.camY = this.drag.camY - dy / this.zoom;
      this.clampCam();
    }
  };

  private onPointerUp = (): void => {
    this.drag = null;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.zoomBy(e.deltaY > 0 ? 0.9 : 1.1);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.typing(e)) return;
    const k = e.key.toLowerCase();
    if (k === "q") { this.cycleTeam(-1); e.preventDefault(); return; }
    if (k === "e") { this.cycleTeam(1); e.preventDefault(); return; }
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
      this.keys.add(k);
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };

  private local(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // --- snapshot -------------------------------------------------------------

  private publish(): void {
    const fighting = this.phase === "fight" || this.phase === "result";
    const armies: ArmySnap[] = SIDES.map((side) => {
      const plan = this.plans[side.id]!;
      const pack = this.fighters.filter((f) => f.side === side.id && f.role !== "spirit");
      const alive = pack.filter((f) => f.alive);
      const level = alive.length ? Math.round(alive.reduce((s, f) => s + f.level, 0) / alive.length) : 0;
      const ghosts = plan.classes.reduce((s, id) => s + (GHOSTS_BY_CLASS[id] ?? 0), 0);
      const intent = fighting
        ? side.id === ATTACKER
          ? this.inPoint[ATTACKER]! > 0 ? "On the point" : "Assaulting"
          : this.inPoint[ATTACKER]! > 0 ? "Point contested" : "Holding"
        : "Mustering";
      return {
        id: side.id,
        key: side.key,
        name: side.name,
        color: side.color,
        size: plan.size,
        classes: [...plan.classes],
        alive: fighting ? alive.length : 0,
        count: plan.size,
        level,
        ghosts,
        intent,
      };
    });
    const s = Math.max(0, Math.floor(this.age));
    const left = Math.max(0, Math.ceil(TIME_LIMIT - this.age));
    const held: ArenaSnap["held"] = this.control >= 99 ? "attackers" : this.inPoint[ATTACKER]! > 0 && this.phase === "fight" ? "contested" : "defenders";
    this.snap = {
      phase: this.phase,
      note: this.note,
      speed: this.speed,
      cam: this.camMode,
      focus: this.focus,
      clock: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`,
      timeLeft: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`,
      control: Math.round(this.control),
      held,
      armies,
      classOptions: classOptions(),
      winner: this.winner,
      winSide: this.winSide,
    };
    this.listeners.forEach((fn) => fn());
  }
}

function nearest(list: Fighter[], x: number, y: number): Fighter {
  let best = list[0]!;
  let bd = 1e9;
  for (const f of list) {
    const d = Math.hypot(f.x - x, f.y - y);
    if (d < bd) { bd = d; best = f; }
  }
  return best;
}
