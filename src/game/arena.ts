import {
  ENCHANT_BY_ID,
  MONSTERS,
  MOVE_BY_ID,
  MOVES,
  RACES,
  TYPES,
  WITCH_NAMES,
  attackForm,
  attackRange,
  gearScore,
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
import { directionFromDelta, type ActorDirection } from "./actor-sheets.config";
import { CombatFx } from "./combat-fx";
import { savedMaps, mapToWorld } from "./map-format";
import type { GraveBody } from "./social-types";
import { drawActor, drawMonster, drawShadowName } from "./sprites";
import { drawWorldSlice, type WorldData } from "./world";

const TILE = 32;
const NAMES = [
  ...WITCH_NAMES,
  "Vellum Sax",
  "Nix of Salt",
  "Sable Quill",
  "Ione Marr",
  "Cairn Hess",
  "Rue the Lid",
  "Onyx Pell",
  "Moss Ives",
  "Hester Vetch",
  "Lumen Bret",
  "Silt Ama",
  "Bram of Glass",
  "Nell Dusk",
  "Pax Yarrow",
  "Ivy Sorrow",
  "Cass of Embers",
  "Wren Holt",
  "Otter Vine",
  "Isla Thorn",
  "Quill Mare",
  "Dusk Nen",
  "Cress Vail",
  "Vetch Ora",
  "Nim of the Well",
  "Hale Mot",
  "Sera's Shadow",
  "Juniper Hex",
  "Tallow Mae",
  "Grey Pell",
  "Annis Coil",
  "Mab of Rime",
  "Kit the Toll",
  "Edda Vellum",
  "Noa of Pitch",
  "Fern Widow",
  "Lux of Bone",
  "Pim Salt",
  "Ysolde Marr",
  "Betony Vale",
  "Cressida Ash",
];

export type ArenaSpiritDef = {
  name: string;
  type: TypeId;
  template: number;
  move: string;
  look: GhostLook;
};

export type ArenaWitch = {
  uid: string;
  name: string;
  race: RaceId;
  role: "witch" | "summoner";
  level: number;
  talent: number;
  type: TypeId;
  maxHp: number;
  speed: number;
  moves: string[];
  weapon: Gear;
  gear: Gear[];
  spirits: ArenaSpiritDef[];
  hair: number;
  skin: number;
};

export type ArenaSave = {
  v: 1;
  points: number;
  tokens: number;
  wins: number;
  losses: number;
  roster: ArenaWitch[];
  party: string[];
};

export type ArenaCard = {
  uid: string;
  name: string;
  role: "witch" | "summoner";
  race: string;
  typeName: string;
  type: TypeId;
  level: number;
  power: number;
  moves: string;
  gear: string;
  enchants: string;
  spirits: string;
  marked: boolean;
};

export type CircleMode = "classic" | "hunger";
export type CamMode = "team" | "free";
export type TeamZone = { tx: number; ty: number; tw: number; th: number };
export type ArenaTeamSnap = {
  id: number;
  name: string;
  color: string;
  alive: number;
  count: number;
  level: number;
  intent: string;
  placed: boolean;
};
export type ArenaSnap = {
  phase: "setup" | "fight" | "result";
  note: string;
  speed: number;
  mode: CircleMode;
  cam: CamMode;
  mapId: string;
  mapName: string;
  maps: { id: string; name: string }[];
  teamCount: number;
  perTeam: number;
  placing: boolean;
  placeFor: number;
  focus: number;
  teams: ArenaTeamSnap[];
  clock: string;
  winner: string;
};

type Fighter = {
  id: string;
  side: number;
  xp: number;
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
  pieces: { slot: string; style: number; type: TypeId; fxSeed: number; quality: number }[];
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
  tokened: boolean;
  buried: boolean;
  grave: GraveBody | null;
  think: number;
  stuck: number;
  lastX: number;
  lastY: number;
  path: { x: number; y: number }[];
  hair: number;
  skin: number;
  tall: number;
};

type Flo = { x: number; y: number; text: string; life: number; color: string };
type Beam = { x0: number; y0: number; x1: number; y1: number; life: number; color: string };

const QUALITY = ["worn", "common", "fine", "rare", "epic", "legendary"];

export function readArena(raw: unknown): ArenaSave | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as ArenaSave;
  if (s.v !== 1 || !Array.isArray(s.roster) || s.roster.length < 6) return null;
  if (typeof s.points !== "number" || s.points <= 0) return null;
  if (!Array.isArray(s.party)) return null;
  return s;
}

function ench(gear: Gear[], id: string): number {
  let n = 0;
  for (const g of gear) for (const e of g.enchants) if (e.id === id) n += e.power;
  return n;
}

function graveOf(w: ArenaWitch): GraveBody {
  const all = [w.weapon, ...w.gear];
  return {
    mode: "arena",
    score: powerOf(w),
    name: w.name,
    race: RACES.find((r) => r.id === w.race)?.name ?? w.race,
    level: w.level,
    accountScore: 0,
    skills: [{ name: w.role === "summoner" ? "Summoning" : "Circle", level: w.level }],
    gear: all.map((g) => ({
      slot: g.slot,
      name: g.name,
      level: g.level,
      quality: g.quality,
      type: TYPES[g.type]?.name ?? g.type,
      enchants: g.enchants.map((e) => ({ name: ENCHANT_BY_ID[e.id]?.name ?? e.id, power: e.power })),
      moves: (g.moves ?? []).map((id) => MOVE_BY_ID[id]?.name ?? id),
    })),
    note: w.role === "summoner" ? `Summoner. Spirits: ${w.spirits.map((s) => s.name).join(", ") || "none"}.` : "Witch of the circle.",
  };
}

function powerOf(w: ArenaWitch): number {
  const gear = gearScore(w.weapon) + w.gear.reduce((s, g) => s + gearScore(g), 0);
  const moves = w.moves.reduce((s, id) => s + (MOVE_BY_ID[id]?.power ?? 0), 0);
  return Math.round(w.level * 16 + w.talent * 40 + gear * 0.22 + moves + (w.role === "summoner" ? 24 : 0));
}

function cardOf(w: ArenaWitch, marked: boolean): ArenaCard {
  const all = [w.weapon, ...w.gear];
  const enchants = all
    .flatMap((g) => g.enchants)
    .slice(0, 4)
    .map((e) => `${ENCHANT_BY_ID[e.id]?.name ?? e.id} ${e.power}`);
  return {
    uid: w.uid,
    name: w.name,
    role: w.role,
    race: RACES.find((r) => r.id === w.race)?.name ?? w.race,
    typeName: TYPES[w.type].name,
    type: w.type,
    level: w.level,
    power: powerOf(w),
    moves: w.moves.map((id) => MOVE_BY_ID[id]?.name ?? id).join(" · "),
    gear: w.weapon.name,
    enchants: enchants.length ? enchants.join(" · ") : "Bare. No enchant.",
    spirits: w.role === "summoner" ? w.spirits.map((s) => s.name).join(", ") : "",
    marked,
  };
}

function rollMoves(rng: Rng, type: TypeId, strong: boolean): string[] {
  const pool = MOVES.filter((m) => m.power > 0 || m.effect === "mend" || m.effect === "shell");
  const biased = pool.filter((m) => m.type === type || m.type === "normal");
  const source = biased.length > 4 ? biased : pool;
  const count = strong ? 3 + irand(rng, 3) : 2 + irand(rng, 2);
  const out: string[] = [];
  const bag = [...(strong && rng() < 0.55 ? source : pool)];
  for (let i = 0; i < count && bag.length; i++) {
    const idx = irand(rng, bag.length);
    const m = bag.splice(idx, 1)[0]!;
    if (!out.includes(m.id)) out.push(m.id);
  }
  if (!out.length) out.push("measured");
  return out;
}

export function rollWitch(rng: Rng, forcedLevel?: number): ArenaWitch {
  const fortune = rng();
  const level =
    forcedLevel ??
    (fortune < 0.18 ? 1 + irand(rng, 8) : fortune > 0.84 ? 22 + irand(rng, 18) : 4 + irand(rng, 20));
  const talent = fortune < 0.14 ? 0.48 + rng() * 0.22 : fortune > 0.9 ? 1.35 + rng() * 0.55 : 0.72 + rng() * 0.55;
  const race = pick(rng, RACES);
  const role: "witch" | "summoner" = rng() < 0.22 ? "summoner" : "witch";
  const strong = talent > 1.15 || level >= 24;
  const weak = talent < 0.7 || level <= 4;
  const luck = weak ? irand(rng, 8) : strong ? 28 + irand(rng, 50) : 8 + irand(rng, 28);
  const floor = strong && rng() < 0.35 ? (rng() < 0.18 ? "legendary" : "epic") : weak ? "worn" : null;
  const gearLevel = Math.max(1, Math.round(level * (weak ? 0.45 + rng() * 0.3 : strong ? 0.9 + rng() * 0.45 : 0.6 + rng() * 0.5)));
  const weapon = rollGear(rng, {
    level: gearLevel,
    slot: "weapon",
    luck,
    floor,
    raceBias: race.id,
    typeBias: rng() < 0.7 ? race.type : null,
  });
  const slots = weak ? (["chest"] as const) : (["head", "chest", "legs", "feet", "relic"] as const);
  const gear = slots.map((slot) =>
    rollGear(rng, {
      level: Math.max(1, gearLevel - irand(rng, 3)),
      slot,
      luck: Math.max(0, luck - 6),
      floor: weak ? "worn" : floor && rng() < 0.4 ? floor : null,
      raceBias: race.id,
      typeBias: rng() < 0.45 ? race.type : null,
    }),
  );
  const moves = rollMoves(rng, race.type, strong);
  for (const id of weapon.moves ?? []) if (!moves.includes(id) && moves.length < 6) moves.push(id);
  if (role === "summoner" && !moves.some((id) => MOVE_BY_ID[id]?.effect === "mend" || MOVE_BY_ID[id]?.effect === "shell")) {
    moves.push(rng() < 0.5 ? "tidemend" : "aegis");
  }
  const spirits: ArenaSpiritDef[] = [];
  if (role === "summoner") {
    const pool = MONSTERS.filter((m) => m.type === "spirit" || m.type === "void" || m.template === 23 || m.template === 16);
    for (let i = 0; i < 3; i++) {
      const spec = pick(rng, pool);
      const bag = MOVES.filter((m) => m.type === spec.type && m.power > 0 && m.power < 56);
      const move = (bag.length ? pick(rng, bag) : MOVES[0]!).id;
      spirits.push({
        name: spec.name,
        type: spec.type,
        template: spec.template,
        move,
        look: rollGhostLook(rng, 1, move, "hunt"),
      });
    }
  }
  const used = new Set<string>();
  let name = pick(rng, NAMES);
  for (let i = 0; i < 6 && used.has(name); i++) name = pick(rng, NAMES);
  if (rng() < 0.08) name = `${name} II`;
  const baseline = 78 + level * 16;
  return {
    uid: nextUid(),
    name,
    race: race.id,
    role,
    level,
    talent,
    type: race.type,
    maxHp: Math.floor(baseline * talent * (role === "summoner" ? 1.08 : 1)),
    speed: Math.floor((role === "summoner" ? 62 : 74) + level * 0.35 + (strong ? 8 : 0)),
    moves,
    weapon,
    gear,
    spirits,
    hair: race.hair,
    skin: irand(rng, 5),
  };
}

class Heap {
  private a: { i: number; c: number }[] = [];
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

function buildMap(rng: Rng): { grid: Uint8Array; w: number; h: number } {
  const w = 42;
  const h = 28;
  for (let attempt = 0; attempt < 10; attempt++) {
    const grid = new Uint8Array(w * h);
    const at = (x: number, y: number) => y * w + x;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) if (x === 0 || y === 0 || x === w - 1 || y === h - 1) grid[at(x, y)] = 1;
    }
    const clusters = 9 + irand(rng, 7);
    for (let i = 0; i < clusters; i++) {
      const x = 6 + irand(rng, w - 12);
      const y = 3 + irand(rng, h - 6);
      grid[at(x, y)] = 1;
      if (rng() < 0.55 && x + 1 < w - 1) grid[at(x + 1, y)] = 1;
      if (rng() < 0.4 && y + 1 < h - 1) grid[at(x, y + 1)] = 1;
      if (rng() < 0.25 && x + 1 < w - 1 && y + 1 < h - 1) grid[at(x + 1, y + 1)] = 1;
    }
    for (let i = 0; i < 12 + irand(rng, 8); i++) {
      const x = 3 + irand(rng, w - 6);
      const y = 2 + irand(rng, h - 4);
      if (grid[at(x, y)] === 0) grid[at(x, y)] = 2;
    }
    for (let i = 0; i < 7 + irand(rng, 6); i++) {
      const x = 3 + irand(rng, w - 6);
      const y = 2 + irand(rng, h - 4);
      if (grid[at(x, y)] === 0) grid[at(x, y)] = 3;
    }
    const pads = [4, 8, 12, 16, 20, 23];
    for (const y of pads) {
      for (const x of [2, 3, w - 3, w - 4]) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx > 0 && yy > 0 && xx < w - 1 && yy < h - 1) grid[at(xx, yy)] = 0;
          }
        }
      }
    }
    if (reachable(grid, w, h, 2, 4, w - 3, 4)) return { grid, w, h };
  }
  const grid = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x === 0 || y === 0 || x === w - 1 || y === h - 1) grid[y * w + x] = 1;
  return { grid, w, h };
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
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
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

function route(grid: Uint8Array, w: number, h: number, sx: number, sy: number, gx: number, gy: number, fear: boolean): { x: number; y: number }[] {
  sx = Math.max(1, Math.min(w - 2, sx));
  sy = Math.max(1, Math.min(h - 2, sy));
  gx = Math.max(1, Math.min(w - 2, gx));
  gy = Math.max(1, Math.min(h - 2, gy));
  if (grid[gy * w + gx] === 1) {
    let found = false;
    for (let r = 1; r <= 4 && !found; r++) {
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = gx + dx;
          const ny = gy + dy;
          if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) continue;
          if (grid[ny * w + nx] !== 1) {
            gx = nx;
            gy = ny;
            found = true;
            break;
          }
        }
      }
    }
  }
  const start = sy * w + sx;
  const goal = gy * w + gx;
  const dist = new Float32Array(w * h);
  dist.fill(1e9);
  dist[start] = 0;
  const prev = new Int32Array(w * h);
  prev.fill(-1);
  const heap = new Heap();
  heap.push(start, 0);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  const hcost = (i: number) => Math.abs((i % w) - gx) + Math.abs(((i / w) | 0) - gy);
  let best = start;
  let bestH = hcost(start);
  let guard = 0;
  const budget = Math.min(w * h, 7000);
  while (guard++ < budget) {
    const cur = heap.pop();
    if (!cur) break;
    if (cur.c > dist[cur.i]! + 0.01) continue;
    const h = hcost(cur.i);
    if (h < bestH) {
      bestH = h;
      best = cur.i;
    }
    if (cur.i === goal) break;
    const x = cur.i % w;
    const y = (cur.i / w) | 0;
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const k = ny * w + nx;
      if (grid[k] === 1) continue;
      const step = grid[k] === 2 ? (fear ? 7 : 2.2) : grid[k] === 3 ? 2.4 : 1;
      const next = dist[cur.i]! + step;
      if (next + 0.01 < dist[k]!) {
        dist[k] = next;
        prev[k] = cur.i;
        heap.push(k, next);
      }
    }
  }
  const end = prev[goal] !== -1 || goal === start ? goal : best;
  if (end === start) return [{ x: gx * TILE + TILE / 2, y: gy * TILE + TILE / 2 }];
  const raw: { x: number; y: number }[] = [];
  let c = end;
  let safety = 0;
  while (c !== -1 && safety++ < 800) {
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
  const sees = (a: { x: number; y: number }, b: { x: number; y: number }) => {
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
    while (j > i + 1 && !sees(raw[i]!, raw[j]!)) j--;
    slim.push(raw[j]!);
    i = j;
  }
  return slim;
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

const SQUADS = [
  { name: "Gold", color: "#e6c15a" },
  { name: "Crimson", color: "#c4473a" },
  { name: "Tide", color: "#5ab0e8" },
  { name: "Moss", color: "#7dcea0" },
  { name: "Violet", color: "#c9a6e8" },
  { name: "Ember", color: "#f08a24" },
  { name: "Rime", color: "#d7ecff" },
  { name: "Ash", color: "#d2c4b0" },
] as const;

type Squad = { intent: "hunt" | "train"; until: number; gx: number; gy: number; told: boolean };

export class WitchArena {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  phase: ArenaSnap["phase"] = "setup";
  note = "Pick a map, plant the packs, and let them fight.";
  speed = 1;
  mode: CircleMode = "hunger";
  camMode: CamMode = "team";
  mapId = "default";
  mapName = "Default circle";
  teamCount = 4;
  perTeam = 3;
  zones: (TeamZone | null)[] = [];
  placing = false;
  placeFor = 0;
  focus = 0;
  world: WorldData | null = null;
  fighters: Fighter[] = [];
  grid: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  gw = 42;
  gh = 28;
  camX = 600;
  camY = 400;
  zoom = 0.8;
  wantX = 600;
  wantY = 400;
  wantZ = 0.8;
  floats: Flo[] = [];
  beams: Beam[] = [];
  cfx = new CombatFx();
  squads: Squad[] = [];
  winner = "";
  age = 0;
  clock = 0;
  onCloud: (save: ArenaSave | null) => void = () => {};
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
  private listeners = new Set<() => void>();
  private snap: ArenaSnap = {
    phase: "setup",
    note: "",
    speed: 1,
    mode: "hunger",
    cam: "team",
    mapId: "default",
    mapName: "Default circle",
    maps: [],
    teamCount: 4,
    perTeam: 3,
    placing: false,
    placeFor: 0,
    focus: 0,
    teams: [],
    clock: "0:00",
    winner: "",
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    this.ctx = ctx;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    fn();
    return () => this.listeners.delete(fn);
  }

  getSnap(): ArenaSnap {
    return this.snap;
  }

  start(_seed: unknown): void {
    this.running = true;
    this.lastT = performance.now();
    this.resize();
    this.loadMap("default");
    this.note = "Pick a map, or keep the default circle. Then choose the packs.";
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
        this.pubAt = 0.45;
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

  setMap(id: string): void {
    this.loadMap(id);
    this.phase = "setup";
    this.placing = false;
    this.fighters = [];
    this.note = `${this.mapName}. Plant where each pack appears.`;
    this.publish();
  }

  setTeamCount(n: number): void {
    this.teamCount = Math.max(2, Math.min(SQUADS.length, Math.round(n) || 2));
    this.zones = Array.from({ length: this.teamCount }, (_, i) => this.zones[i] ?? null);
    if (this.placeFor >= this.teamCount) this.placeFor = 0;
    if (this.focus >= this.teamCount) this.focus = 0;
    this.publish();
  }

  setPerTeam(n: number): void {
    this.perTeam = Math.max(1, Math.min(6, Math.round(n) || 1));
    this.publish();
  }

  setMode(mode: CircleMode): void {
    this.mode = mode;
    this.note = mode === "hunger"
      ? "Hunger Games. Packs roam, drill, or hunt. You can follow a team or fly the camera."
      : "Classic. Packs stay together and hunt until one is left.";
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
    this.focus = (this.focus + dir + this.teamCount) % this.teamCount;
    this.camMode = "team";
    this.frame();
    this.camX = this.wantX;
    this.camY = this.wantY;
    this.publish();
  }

  zoomBy(factor: number): void {
    this.zoom = Math.max(0.22, Math.min(2.6, this.zoom * factor));
    if (this.phase === "fight" || this.phase === "result") this.camMode = "free";
    this.publish();
  }

  armPlace(): void {
    if (!this.world) this.loadMap(this.mapId);
    this.phase = "setup";
    this.placing = true;
    this.fighters = [];
    const empty = this.zones.findIndex((z) => !z);
    this.placeFor = empty >= 0 ? empty : 0;
    this.fitMap();
    this.note = `Click the ground for ${SQUADS[this.placeFor]!.name}. Drag to pan. Scroll or the buttons to zoom.`;
    this.publish();
  }

  setPlace(i: number): void {
    if (i < 0 || i >= this.teamCount) return;
    this.placeFor = i;
    this.placing = true;
    this.phase = "setup";
    this.note = `Plant ${SQUADS[i]!.name}.`;
    this.publish();
  }

  autoZones(): void {
    if (!this.world) this.loadMap(this.mapId);
    const n = this.teamCount;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      const cx = Math.round(this.gw / 2 + Math.cos(ang) * this.gw * 0.32);
      const cy = Math.round(this.gh / 2 + Math.sin(ang) * this.gh * 0.32);
      this.zones[i] = this.clampZone(cx, cy);
    }
    this.note = "Pads scattered around the map. Move any of them, or start.";
    this.publish();
  }

  launch(): void {
    if (!this.world) this.loadMap(this.mapId);
    this.ensureZones();
    const rng = mulberry32((Date.now() ^ ((Math.random() * 1e9) | 0)) >>> 0 || 9);
    this.fighters = [];
    this.floats = [];
    this.beams = [];
    this.cfx = new CombatFx();
    this.age = 0;
    this.winner = "";
    this.squads = [];
    for (let t = 0; t < this.teamCount; t++) {
      const zone = this.zones[t]!;
      const spots = this.spotsIn(zone, this.perTeam);
      this.squads.push({
        intent: this.mode === "classic" ? "hunt" : "train",
        until: 3 + Math.random() * 4,
        gx: (zone.tx + zone.tw / 2) * TILE,
        gy: (zone.ty + zone.th / 2) * TILE,
        told: false,
      });
      for (let i = 0; i < this.perTeam; i++) {
        const level = this.mode === "hunger" ? 6 + irand(rng, 8) : 10 + irand(rng, 14);
        const w = rollWitch(rng, level);
        const spot = spots[i % spots.length]!;
        this.spawnWitch(w, t, spot.tx, spot.ty, rng);
      }
    }
    this.phase = "fight";
    this.placing = false;
    this.camMode = "team";
    this.focus = 0;
    this.frame();
    this.camX = this.wantX;
    this.camY = this.wantY;
    this.zoom = this.wantZ;
    this.note = this.mode === "hunger"
      ? "Packs will drill or hunt. Follow a team, or fly free."
      : "Last pack standing.";
    this.publish();
    this.resize();
  }

  again(): void {
    this.launch();
  }

  backSetup(): void {
    this.phase = "setup";
    this.placing = false;
    this.fighters = [];
    this.squads = [];
    this.winner = "";
    this.cfx = new CombatFx();
    this.beams = [];
    this.floats = [];
    this.fitMap();
    this.note = "Same map. Change the packs or run it again.";
    this.publish();
  }

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
    const look = this.camMode === "free" || this.placing || this.phase === "setup";
    if (this.drag.moved && look) {
      this.camX = this.drag.camX - dx / this.zoom;
      this.camY = this.drag.camY - dy / this.zoom;
      this.clampCam();
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.drag) return;
    const p = this.local(e);
    const moved = this.drag.moved;
    this.drag = null;
    if (!moved && this.placing) this.dropZone(p.x, p.y);
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.zoomBy(e.deltaY > 0 ? 0.9 : 1.1);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.typing(e)) return;
    const k = e.key.toLowerCase();
    if (k === "q") {
      this.cycleTeam(-1);
      e.preventDefault();
      return;
    }
    if (k === "e") {
      this.cycleTeam(1);
      e.preventDefault();
      return;
    }
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

  private screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.viewW / 2) / this.zoom + this.camX,
      y: (sy - this.viewH / 2) / this.zoom + this.camY,
    };
  }

  private dropZone(sx: number, sy: number): void {
    const w = this.screenToWorld(sx, sy);
    const tx = Math.floor(w.x / TILE);
    const ty = Math.floor(w.y / TILE);
    if (tx < 0 || ty < 0 || tx >= this.gw || ty >= this.gh) return;
    const i = Math.max(0, Math.min(this.teamCount - 1, this.placeFor));
    this.zones[i] = this.clampZone(tx, ty);
    const next = this.zones.findIndex((z, idx) => idx !== i && !z);
    this.placeFor = next >= 0 ? next : (i + 1) % this.teamCount;
    this.note = `${SQUADS[i]!.name} is planted. ${this.zones.every(Boolean) ? "All pads are set." : `Next: ${SQUADS[this.placeFor]!.name}.`}`;
    this.publish();
  }

  private clampZone(tx: number, ty: number): TeamZone {
    const span = Math.max(3, Math.min(6, Math.floor(Math.min(this.gw, this.gh) / 8)));
    const x = Math.max(1, Math.min(this.gw - span - 1, tx - Math.floor(span / 2)));
    const y = Math.max(1, Math.min(this.gh - span - 1, ty - Math.floor(span / 2)));
    return { tx: x, ty: y, tw: span, th: span };
  }

  private ensureZones(): void {
    let missing = false;
    for (let i = 0; i < this.teamCount; i++) if (!this.zones[i]) missing = true;
    if (missing || this.zones.length < this.teamCount) this.autoZones();
  }

  private loadMap(id: string): void {
    const file = id === "default" ? null : savedMaps().find((m) => m.id === id) ?? null;
    const useDefault = !file;
    this.mapId = useDefault ? "default" : file.id;
    if (useDefault) {
      const built = buildMap(mulberry32(0xc1ec1e));
      this.grid = built.grid;
      this.gw = built.w;
      this.gh = built.h;
      const tiles = Array.from(built.grid, (c) => {
        if (c === 1) return { floor: 1, biome: 4, block: 1, decor: 0 };
        if (c === 2) return { floor: 7, biome: 6, block: 0, decor: 0 };
        if (c === 3) return { floor: 6, biome: 5, block: 0, decor: 0 };
        return { floor: 0, biome: 2, block: 0, decor: 0 };
      });
      this.world = { w: built.w, h: built.h, tiles, spawns: [], cache: null };
      this.mapName = "Default circle";
    } else {
      const world = mapToWorld(file);
      this.world = world;
      this.gw = world.w;
      this.gh = world.h;
      this.grid = new Uint8Array(world.tiles.length);
      world.tiles.forEach((t, i) => {
        this.grid[i] = t.block ? 1 : t.floor === 11 || t.floor === 7 ? 2 : t.floor === 2 || t.floor === 5 ? 3 : 0;
      });
      this.mapName = file.name;
    }
    this.zones = Array.from({ length: this.teamCount }, () => null);
    this.fitMap();
  }

  private fitMap(): void {
    if (this.viewW < 8 || this.viewH < 8 || this.gw < 2) return;
    const mw = this.gw * TILE;
    const mh = this.gh * TILE;
    this.camX = mw / 2;
    this.camY = mh / 2;
    this.zoom = Math.max(0.18, Math.min(1.5, Math.min(this.viewW / mw, this.viewH / mh) * 0.92));
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

  private spotsIn(zone: TeamZone, n: number): { tx: number; ty: number }[] {
    const open: { tx: number; ty: number }[] = [];
    for (let y = zone.ty; y < zone.ty + zone.th; y++) {
      for (let x = zone.tx; x < zone.tx + zone.tw; x++) {
        if ((this.grid[y * this.gw + x] ?? 1) !== 1) open.push({ tx: x, ty: y });
      }
    }
    if (!open.length) {
      const cx = zone.tx + (zone.tw >> 1);
      const cy = zone.ty + (zone.th >> 1);
      for (let r = 1; r < 40 && !open.length; r++) {
        for (let y = cy - r; y <= cy + r; y++) {
          for (let x = cx - r; x <= cx + r; x++) {
            if (x < 1 || y < 1 || x >= this.gw - 1 || y >= this.gh - 1) continue;
            if (this.grid[y * this.gw + x] !== 1) open.push({ tx: x, ty: y });
          }
        }
      }
    }
    if (!open.length) open.push({ tx: Math.min(this.gw - 2, 2), ty: Math.min(this.gh - 2, 2) });
    const out: { tx: number; ty: number }[] = [];
    for (let i = 0; i < n; i++) out.push(open[Math.min(open.length - 1, Math.floor((i * open.length) / n))]!);
    return out;
  }

  private color(side: number): string {
    return SQUADS[side]?.color ?? "#f0e2c8";
  }

  private publish(): void {
    const maps = [{ id: "default", name: "Default circle" }, ...savedMaps().map((m) => ({ id: m.id, name: m.name }))];
    const fighting = this.phase === "fight" || this.phase === "result";
    const teams: ArenaTeamSnap[] = Array.from({ length: this.teamCount }, (_, id) => {
      const pack = this.fighters.filter((f) => f.side === id && f.role !== "spirit");
      const alive = pack.filter((f) => f.alive);
      const level = alive.length ? Math.round(alive.reduce((s, f) => s + f.level, 0) / alive.length) : 0;
      const intent = fighting ? (this.squads[id]?.intent === "train" ? "Drilling" : "Hunting") : this.zones[id] ? "Placed" : "No pad";
      return {
        id,
        name: SQUADS[id]!.name,
        color: SQUADS[id]!.color,
        alive: fighting ? alive.length : 0,
        count: this.perTeam,
        level,
        intent,
        placed: !!this.zones[id],
      };
    });
    const s = Math.max(0, Math.floor(this.age));
    this.snap = {
      phase: this.phase,
      note: this.note,
      speed: this.speed,
      mode: this.mode,
      cam: this.camMode,
      mapId: this.mapId,
      mapName: this.mapName,
      maps,
      teamCount: this.teamCount,
      perTeam: this.perTeam,
      placing: this.placing,
      placeFor: this.placeFor,
      focus: this.focus,
      teams,
      clock: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`,
      winner: this.winner,
    };
    this.listeners.forEach((fn) => fn());
  }

  private spawnWitch(w: ArenaWitch, side: number, tx: number, ty: number, rng: Rng): void {
    const gear = [w.weapon, ...w.gear];
    const id = nextUid();
    const body = this.makeBody(w, side, tx, ty, id, "", w.role, w.talent * (w.role === "summoner" ? 0.2 : 1));
    body.moveIds = w.moves;
    body.might = ench(gear, "might");
    body.ward = ench(gear, "ward");
    body.crit = ench(gear, "crit_edge");
    body.swift = ench(gear, "swift");
    body.echo = ench(gear, "echo_guard");
    body.double = ench(gear, "double_strike");
    body.second = ench(gear, "second_chance") > 0;
    this.fighters.push(body);
    if (w.role !== "summoner") return;
    w.spirits.forEach((s, i) => {
      const spot = this.openNear(tx, ty, i);
      const spirit = this.makeBody(
        {
          name: s.name,
          race: w.race,
          type: s.type,
          level: w.level,
          maxHp: Math.floor((78 + w.level * 16) * 0.2),
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
        w.talent * 0.34,
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
    const opts = [
      [tx + 1, ty],
      [tx - 1, ty],
      [tx, ty + 1],
      [tx, ty - 1],
      [tx + 1, ty + 1],
      [tx - 1, ty - 1],
    ];
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
      tokened: false,
      buried: false,
      grave: null,
      think: Math.random() * 0.3,
      stuck: 0,
      lastX: tx * TILE,
      lastY: ty * TILE,
      path: [],
      hair: w.hair,
      skin: w.skin,
      tall: 1,
      xp: 0,
    };
  }

  private step(dt: number): void {
    this.age += dt;
    this.clock += dt;
    this.drill(dt);
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
        f.think = 0.32 + Math.random() * 0.16;
        this.think(f);
      }
      if (f.root <= 0) this.follow(f, dt, cell === 3);
      this.strike(f);
    }
    this.cfx.tick(dt);
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);
    for (const fl of this.floats) fl.life -= dt;
    this.floats = this.floats.filter((fl) => fl.life > 0);
    if (this.age > 1.2) this.maybeEnd();
  }

  private drill(dt: number): void {
    if (this.mode !== "hunger") return;
    for (let s = 0; s < this.squads.length; s++) {
      const squad = this.squads[s]!;
      if (squad.intent !== "train") continue;
      const pack = this.fighters.filter((f) => f.alive && f.side === s && f.role !== "spirit");
      if (!pack.length) continue;
      let cx = 0;
      let cy = 0;
      for (const f of pack) {
        cx += f.x;
        cy += f.y;
      }
      cx /= pack.length;
      cy /= pack.length;
      if (Math.hypot(cx - squad.gx, cy - squad.gy) > 78) continue;
      for (const f of pack) {
        f.xp += dt * 16;
        f.hp = Math.min(f.max, f.hp + dt * 4);
        if (f.xp < 32) continue;
        f.xp = 0;
        f.level += 1;
        f.max = Math.round(f.max + 8 + f.level * 0.35);
        f.hp = Math.min(f.max, f.hp + 16);
        f.dmgMul *= 1.05;
        f.speed += 1;
        this.float(f.x, f.y - 36, `Lv ${f.level}`, this.color(s));
      }
    }
  }

  private think(f: Fighter): void {
    const allies = this.fighters.filter((o) => o.alive && o.side === f.side);
    const foes = this.fighters.filter((o) => o.alive && o.side !== f.side && o.role !== "spirit");
    const anyFoe = this.fighters.filter((o) => o.alive && o.side !== f.side);
    const pool = foes.length ? foes : anyFoe;
    if (f.role === "spirit") {
      const master = allies.find((a) => a.id === f.master);
      if (master) {
        const ang = Math.atan2(f.y - master.y, f.x - master.x) || 0;
        this.seek(f, master.x + Math.cos(ang) * 26, master.y + Math.sin(ang) * 20);
      }
      return;
    }
    const witches = allies.filter((o) => o.role !== "spirit");
    const leader = witches[0];
    if (!leader) return;
    if (f.id !== leader.id) {
      const idx = Math.max(1, witches.indexOf(f));
      const ang = (idx / Math.max(2, witches.length)) * Math.PI * 2;
      const radius = 28 + (idx % 3) * 12;
      this.seek(f, leader.x + Math.cos(ang) * radius, leader.y + Math.sin(ang) * radius * 0.82);
      return;
    }
    const squad = this.squads[f.side];
    if (!squad) return;
    if (this.age >= squad.until) this.retarget(f, squad, pool);
    if (!pool.length) {
      this.seek(f, squad.gx, squad.gy);
      return;
    }
    if (this.mode === "classic" || squad.intent === "hunt") {
      const target = this.pickTarget(f, pool);
      const move = this.bestMove(f, target, false);
      const reach = attackRange(move);
      const d = Math.hypot(target.x - f.x, target.y - f.y);
      const form = attackForm(move);
      if (form !== "melee" && d <= reach * 0.88 && this.sees(f.x, f.y, target.x, target.y)) {
        f.path = [];
        return;
      }
      const ang = Math.atan2(f.y - target.y, f.x - target.x);
      const hold = form === "melee" ? 26 : Math.min(reach * 0.7, 108);
      this.seek(f, target.x + Math.cos(ang) * hold, target.y + Math.sin(ang) * hold);
      return;
    }
    this.seek(f, squad.gx, squad.gy);
  }

  private retarget(leader: Fighter, squad: Squad, foes: Fighter[]): void {
    const near = foes.length ? nearest(foes, leader.x, leader.y) : null;
    const nd = near ? Math.hypot(near.x - leader.x, near.y - leader.y) : 1e9;
    if (this.mode === "classic") {
      squad.intent = "hunt";
      squad.until = this.age + 2.2;
      return;
    }
    const hurt = leader.hp / leader.max < 0.4;
    if (hurt) squad.intent = "train";
    else if (nd < 220) squad.intent = Math.random() < 0.74 ? "hunt" : "train";
    else squad.intent = Math.random() < 0.42 ? "hunt" : "train";
    squad.until = this.age + 7 + Math.random() * 8;
    squad.told = false;
    if (squad.intent === "train" || !near) {
      const spot = this.roamSpot(leader);
      squad.gx = spot.x;
      squad.gy = spot.y;
    }
    this.float(leader.x, leader.y - 42, squad.intent === "train" ? "drill" : "hunt", this.color(leader.side));
  }

  private roamSpot(f: Fighter): { x: number; y: number } {
    for (let i = 0; i < 16; i++) {
      const tx = 2 + Math.floor(Math.random() * Math.max(1, this.gw - 4));
      const ty = 2 + Math.floor(Math.random() * Math.max(1, this.gh - 4));
      if ((this.grid[ty * this.gw + tx] ?? 1) === 1) continue;
      const x = tx * TILE + TILE / 2;
      const y = ty * TILE + TILE / 2;
      if (Math.hypot(x - f.x, y - f.y) > 180 || i > 10) return { x, y };
    }
    return { x: f.x, y: f.y };
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
    const direct = this.gw * this.gh > 8000 ? 520 : 240;
    if (d < direct && this.sees(f.x, f.y, x, y)) {
      f.path = [{ x, y }];
      return;
    }
    this.pathTo(f, x, y, f.hp / f.max > 0.35);
  }

  private sees(x0: number, y0: number, x1: number, y1: number): boolean {
    return los(this.grid, this.gw, this.gh, x0, y0, x1, y1);
  }

  private pickTarget(f: Fighter, foes: Fighter[]): Fighter {
    let best = foes[0]!;
    let score = 1e9;
    for (const o of foes) {
      const d = Math.hypot(o.x - f.x, o.y - f.y);
      const low = o.hp / o.max < 0.34 ? 0.62 : 1;
      const s = d * low;
      if (s < score) {
        score = s;
        best = o;
      }
    }
    return best;
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
    f.path = route(this.grid, this.gw, this.gh, sx, sy, gx, gy, fear);
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
    if (target.shield > 0) dmg *= 0.55;
    dmg *= 1 - Math.min(0.45, target.ward / 140);
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
    const living = new Set<number>();
    for (const f of this.fighters) if (f.alive && f.role !== "spirit") living.add(f.side);
    const cap = this.mode === "classic" ? 480 : 360;
    if (living.size > 1 && this.age < cap) return;
    if (living.size === 0) {
      this.finish("No one left standing.");
      return;
    }
    if (living.size === 1) {
      const id = [...living][0]!;
      this.finish(`${SQUADS[id]!.name} holds the field.`);
      return;
    }
    let best = 0;
    let bestS = -1;
    for (const id of living) {
      const score = this.fighters.filter((f) => f.alive && f.side === id && f.role !== "spirit").reduce((s, f) => s + f.hp / f.max, 0);
      if (score > bestS) {
        bestS = score;
        best = id;
      }
    }
    this.finish(`Time. ${SQUADS[best]!.name} still has the most life.`);
  }

  private finish(note: string): void {
    this.winner = note;
    this.phase = "result";
    this.note = note;
    this.publish();
  }

  private frame(): void {
    const pack = this.fighters.filter((f) => f.alive && f.side === this.focus && f.role !== "spirit");
    const focus = pack.length ? pack : this.fighters.filter((f) => f.alive && f.role !== "spirit");
    const use = focus.length ? focus : this.fighters.filter((f) => f.alive);
    if (!use.length) return;
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
    const span = Math.max(maxX - minX, maxY - minY, 150);
    const fit = Math.min(this.viewW, this.viewH) / (span + 240);
    this.wantX = (minX + maxX) / 2;
    this.wantY = (minY + maxY) / 2 - 8;
    this.wantZ = Math.max(0.85, Math.min(1.5, fit));
    const k = Math.min(1, 0.12);
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
    const pan = this.camMode === "free" || this.placing || this.phase === "setup" || this.phase === "result";
    if ((x || y) && pan && !(this.camMode === "team" && this.phase === "result")) {
      const m = Math.hypot(x, y) || 1;
      const sp = 520 / Math.max(0.35, this.zoom);
      this.camX += (x / m) * sp * dt;
      this.camY += (y / m) * sp * dt;
      this.clampCam();
      return;
    }
    if ((this.phase === "fight" || this.phase === "result") && this.camMode === "team") this.frame();
  }

  private float(x: number, y: number, text: string, color: string): void {
    if (this.floats.length > 80) this.floats.shift();
    this.floats.push({ x, y, text, life: 0.9, color });
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
    if (this.phase !== "fight") this.drawZones(ctx, false);
    else this.drawZones(ctx, true);
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
      const bar = f.role === "spirit" ? 28 : 46;
      const by = f.y - (f.role === "spirit" ? 36 : 44);
      ctx.fillStyle = "#1a1214";
      ctx.fillRect(f.x - bar / 2 - 1, by - 1, bar + 2, 6);
      ctx.fillStyle = this.color(f.side);
      ctx.fillRect(f.x - bar / 2, by, bar * Math.max(0, f.hp / f.max), 4);
      if (f.role !== "spirit") drawShadowName(ctx, `${f.name} ${f.level}`, f.x, by - 12, this.color(f.side));
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

  private drawZones(ctx: CanvasRenderingContext2D, faint: boolean): void {
    this.zones.forEach((z, i) => {
      if (!z) return;
      const x = z.tx * TILE;
      const y = z.ty * TILE;
      const w = z.tw * TILE;
      const h = z.th * TILE;
      ctx.save();
      ctx.fillStyle = this.color(i);
      ctx.globalAlpha = faint ? 0.07 : i === this.placeFor && this.placing ? 0.28 : 0.16;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = faint ? 0.45 : 1;
      ctx.strokeStyle = this.color(i);
      ctx.lineWidth = !faint && i === this.placeFor && this.placing ? 3 : 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      ctx.restore();
      if (!faint) drawShadowName(ctx, SQUADS[i]!.name, x + w / 2, y + 16, this.color(i));
    });
  }
}

function nearest(list: Fighter[], x: number, y: number): Fighter {
  let best = list[0]!;
  let bd = 1e9;
  for (const f of list) {
    const d = Math.hypot(f.x - x, f.y - y);
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return best;
}

