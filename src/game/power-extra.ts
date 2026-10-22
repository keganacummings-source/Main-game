/**
 * Extra Power blocks and the Pipe item-mover (TURBZ + New Texture Mode).
 *
 * Pure data + maths. No engine, no canvas — so scripts/power-extra.test.mjs can load it.
 *
 * ─── ADDING A NEW POWER BLOCK ────────────────────────────────────────────────
 * 1. Add its id to `PowerExtraKind` and `POWER_EXTRA_KINDS`.
 * 2. If it should show up in the build menu, add it to `POWER_EXTRA_MENU` and
 *    describe it in `POWER_EXTRA_HOW`.
 * 3. Add any clamps it needs in `sanitizePowerExtra`.
 * 4. Add it as a pipe source and/or sink in `pipeStep` and `portRoom` if it
 *    moves items.
 *
 * The build-menu side (icon, cost, grouping) is in `building.ts`.
 */

export type PowerExtraKind =
  | "logburner" | "solar" | "capacitor"
  | "blockgen" | "rockminer" | "tesla" | "pipe";

export const POWER_EXTRA_KINDS: PowerExtraKind[] = ["logburner", "solar", "capacitor", "blockgen", "rockminer", "tesla", "pipe"];

export function isPowerExtra(piece: string): piece is PowerExtraKind {
  return (POWER_EXTRA_KINDS as string[]).includes(piece);
}

/** Old save files may still carry blockbreaker entries. They convert to rockminer. */
const LEGACY_KINDS: Record<string, PowerExtraKind> = { blockbreaker: "rockminer" };

/** 0=up, 1=right, 2=down, 3=left */
export const DIR_VEC: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const DIR_NAME = ["up", "right", "down", "left"];

// ---- Rates (weaker/slower than HellStone's 10 Power / 5s) ----
export const LOGBURN_SECONDS = 8;
export const LOGBURN_POWER = 6;
export const LOGBURN_FUEL_MAX = 32;

export const SOLAR_SECONDS = 4;
export const SOLAR_POWER = 1;

export const BLOCK_MACHINE_SECONDS = 1;
export const BLOCK_MACHINE_POWER = 1;
export const MACHINE_BUF_MAX = 64;

/** Rock Miner: slower than the old BlockBreaker because the source is infinite. */
export const ROCKMINER_SECONDS = 3;
export const ROCKMINER_POWER = 1;

export const TESLA_RANGE = 5 * 32;
export const TESLA_SECONDS = 1.5;
export const TESLA_POWER = 4;

export const CAP_MAX = 500;
export const BAT_MAX = 100;

export const PIPE_SECONDS = 0.75;
/** Max ore/fuel a generator will accept from a pipe before it stops taking more. */
export const PIPE_FEED_CAP = 20;

export const BLOCKGEN_ITEM: Record<"wood" | "stone", string> = { wood: "timber", stone: "rock_ore" };

export type PowerExtra = {
  kind: PowerExtraKind;
  map: string;
  tx: number;
  ty: number;
  t?: number;
  dir?: number;
  on?: boolean;
  mat?: "wood" | "stone";
  buf?: Record<string, number>;
  fuel?: number;
  power?: number;
};

/** Clean a saved list so a bad file never crashes a tick. Keeps object identity for the survivors. */
export function sanitizePowerExtra(raw: unknown): PowerExtra[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: PowerExtra[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as any;
    // Migrate legacy kinds (blockbreaker → rockminer) silently so a current player's
    // save keeps its placements across this update.
    if (typeof o.kind === "string" && LEGACY_KINDS[o.kind]) o.kind = LEGACY_KINDS[o.kind];
    if (!isPowerExtra(o.kind) || typeof o.map !== "string" || !Number.isInteger(o.tx) || !Number.isInteger(o.ty) || o.tx < 0 || o.ty < 0) continue;
    const key = `${o.map}|${o.tx},${o.ty}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // clamp
    if (o.dir != null) o.dir = ((Math.floor(Number(o.dir)) % 4) + 4) % 4;
    if (o.kind === "blockgen" || o.kind === "rockminer") {
      o.on = o.on !== false;
      if (o.kind === "blockgen" && o.mat !== "stone") o.mat = "wood";
    }
    if (o.kind === "tesla") o.on = o.on !== false;
    if (o.kind === "logburner") o.fuel = Math.max(0, Math.min(LOGBURN_FUEL_MAX, Math.floor(Number(o.fuel) || 0)));
    if (o.kind === "capacitor") o.power = Math.max(0, Math.min(CAP_MAX, Math.floor(Number(o.power) || 0)));
    if (o.buf && typeof o.buf === "object") {
      const clean: Record<string, number> = {};
      let total = 0;
      for (const [id, n] of Object.entries(o.buf)) {
        const c = Math.floor(Number(n));
        if (id && c > 0) { clean[id] = c; total += c; }
      }
      if (total > MACHINE_BUF_MAX) {
        // clamp total
        let left = MACHINE_BUF_MAX;
        for (const id of Object.keys(clean)) {
          if (left <= 0) { delete clean[id]; continue; }
          clean[id] = Math.min(clean[id], left);
          left -= clean[id];
        }
      }
      o.buf = clean;
    }
    out.push(o);
  }
  return out;
}

export function batteryCap(n: { kind?: string }): number {
  return n?.kind === "capacitor" ? CAP_MAX : BAT_MAX;
}

export function bufTotal(buf: Record<string, number> | undefined): number {
  if (!buf) return 0;
  return Object.values(buf).reduce((a, v) => a + (v || 0), 0);
}

/** Bit mask for connected sides: 1=up, 2=right, 4=down, 8=left. */
export function pipeShapeName(mask: number): "lonely" | "end" | "straight" | "corner" | "tee" | "cross" {
  const bits = [1, 2, 4, 8].filter((b) => mask & b).length;
  if (bits === 0) return "lonely";
  if (bits === 1) return "end";
  if (bits === 4) return "cross";
  if (bits === 3) return "tee";
  if (bits === 2) {
    if ((mask & 5) === 5 || (mask & 10) === 10) return "straight";
    return "corner";
  }
  return "lonely";
}

export type PipePort = { kind: string; key: string; n: any };

/** Group connected pipes into runs and attach the machines/chests they touch. */
export function pipeRuns(pipeKeys: Iterable<string>, ports: Map<string, PipePort>): { pipes: string[]; ports: PipePort[] }[] {
  const pipes = new Set(pipeKeys);
  const seen = new Set<string>();
  const runs: { pipes: string[]; ports: PipePort[] }[] = [];
  for (const start of pipes) {
    if (seen.has(start)) continue;
    const runPipes: string[] = [];
    const runPorts = new Map<string, PipePort>();
    const q = [start];
    seen.add(start);
    while (q.length) {
      const cur = q.pop()!;
      runPipes.push(cur);
      const [sx, sy] = cur.split(",").map(Number);
      for (let k = 0; k < 4; k++) {
        const nx = sx + DIR_VEC[k][0], ny = sy + DIR_VEC[k][1];
        const nk = `${nx},${ny}`;
        if (pipes.has(nk) && !seen.has(nk)) { seen.add(nk); q.push(nk); }
        else if (ports.has(nk)) runPorts.set(nk, ports.get(nk)!);
      }
    }
    runs.push({ pipes: runPipes, ports: [...runPorts.values()] });
  }
  return runs;
}

/** One step of item flow on a pipe run. Mutates ports and the chest bag. Returns how many items moved. */
export function pipeStep(ports: PipePort[], chest: Record<string, number>): { moved: number; chestMoved: boolean } {
  let moved = 0;
  let chestMoved = false;
  if (ports.length < 2) return { moved, chestMoved };

  // Sources first (machines that produce), then chest as source for sinks.
  const sources = ports.filter((p) => p.kind === "dup" || p.kind === "rockminer");
  const sinks = ports.filter((p) => p.kind === "hellgen" || p.kind === "logburner" || p.kind === "blockgen" || p.kind === "chest");

  const takeFrom = (src: PipePort, id: string, n = 1): boolean => {
    if (src.kind === "dup") {
      if (!src.n.item || src.n.item !== id || (src.n.stored ?? 0) < n) return false;
      src.n.stored -= n;
      if ((src.n.stored ?? 0) <= 0 && !src.n.seed) src.n.item = "";
      return true;
    }
    if (src.kind === "rockminer") {
      if ((src.n.buf?.[id] ?? 0) < n) return false;
      src.n.buf[id] -= n;
      if (src.n.buf[id] <= 0) delete src.n.buf[id];
      return true;
    }
    return false;
  };

  const giveTo = (dst: PipePort, id: string, n = 1): boolean => {
    if (dst.kind === "chest") {
      chest[id] = (chest[id] ?? 0) + n;
      chestMoved = true;
      return true;
    }
    if (dst.kind === "hellgen") {
      if (id !== "hell_ore") return false;
      if ((dst.n.ore ?? 0) >= PIPE_FEED_CAP) return false;
      if ((dst.n.ore ?? 0) === 0) dst.n.t = 0;
      dst.n.ore = (dst.n.ore ?? 0) + n;
      return true;
    }
    if (dst.kind === "logburner") {
      if (id !== "timber") return false;
      if ((dst.n.fuel ?? 0) >= LOGBURN_FUEL_MAX) return false;
      if ((dst.n.fuel ?? 0) === 0) dst.n.t = 0;
      dst.n.fuel = (dst.n.fuel ?? 0) + n;
      return true;
    }
    if (dst.kind === "blockgen") {
      const want = BLOCKGEN_ITEM[dst.n.mat === "stone" ? "stone" : "wood"];
      if (id !== want) return false;
      if (bufTotal(dst.n.buf) >= MACHINE_BUF_MAX) return false;
      dst.n.buf = dst.n.buf ?? {};
      dst.n.buf[id] = (dst.n.buf[id] ?? 0) + n;
      return true;
    }
    return false;
  };

  // Prefer feeding machines over dumping into the chest.
  const machineSinks = sinks.filter((s) => s.kind !== "chest");
  const chestSink = sinks.find((s) => s.kind === "chest");

  for (const src of sources) {
    // what can this source give?
    let id: string | null = null;
    if (src.kind === "dup" && src.n.item && (src.n.stored ?? 0) > 0) id = src.n.item;
    else if (src.kind === "rockminer") {
      const keys = Object.keys(src.n.buf ?? {}).filter((k) => (src.n.buf[k] ?? 0) > 0);
      id = keys[0] ?? null;
    }
    if (!id) continue;

    let delivered = false;
    for (const sink of machineSinks) {
      if (giveTo(sink, id)) { takeFrom(src, id); moved++; delivered = true; break; }
    }
    if (!delivered && chestSink) {
      if (giveTo(chestSink, id)) { takeFrom(src, id); moved++; }
    }
  }

  // Chest can feed sinks (generators / blockgens).
  if (chestSink) {
    for (const sink of machineSinks) {
      let id: string | null = null;
      if (sink.kind === "hellgen") id = "hell_ore";
      else if (sink.kind === "logburner") id = "timber";
      else if (sink.kind === "blockgen") id = BLOCKGEN_ITEM[sink.n.mat === "stone" ? "stone" : "wood"];
      if (!id || (chest[id] ?? 0) < 1) continue;
      if (giveTo(sink, id)) {
        chest[id] -= 1;
        if (chest[id] <= 0) delete chest[id];
        chestMoved = true;
        moved++;
      }
    }
  }

  return { moved, chestMoved };
}

export function portRoom(port: PipePort, id: string): boolean {
  if (port.kind === "blockgen") {
    const want = BLOCKGEN_ITEM[port.n.mat === "stone" ? "stone" : "wood"];
    return id === want && bufTotal(port.n.buf) < MACHINE_BUF_MAX;
  }
  if (port.kind === "hellgen") return id === "hell_ore" && (port.n.ore ?? 0) < PIPE_FEED_CAP;
  if (port.kind === "logburner") return id === "timber" && (port.n.fuel ?? 0) < LOGBURN_FUEL_MAX;
  if (port.kind === "chest") return true;
  return false;
}

export const POWER_EXTRA_HOW: Record<PowerExtraKind, string> = {
  logburner: "Burns Logs for Power. Slower and weaker than the HellStone Generator.",
  solar: "Makes a little Power in daylight. Nothing at night. No fuel.",
  capacitor: "Stores a lot of Power (500). Wire it like a Battery.",
  blockgen: "Places a Wood or Stone block on the tile it faces every second. Needs Power and material.",
  rockminer: "Pulls one ore from the natural rock, sand or dirt tile in front of it, without destroying it. Infinite slow trickle; pipes the haul into a chest.",
  tesla: "Zaps the nearest foe in range. Needs Power.",
  pipe: "Moves items between connected machines and the Storage Chest. Shapes itself to its neighbours.",
};

export const POWER_EXTRA_MENU: PowerExtraKind[] = ["logburner", "solar", "capacitor", "blockgen", "rockminer", "tesla"];

// ─── Ghost Merger ────────────────────────────────────────────────────────────
/** A ghost shrunk to just the data the merger needs to feed it in. */
export type StoredGhost = {
  uid: string;
  name: string;
  type: string;              // TypeId as a string (power-extra stays type-free)
  level: number;
  rarity: number;
  abilities: { id: string; rank: number }[];
  moves: string[];
};
/** The in-progress Super Ghost the merger is building. */
export type PartialSuperGhost = {
  level: number;
  types: string[];           // up to GHOSTMERGER_TYPES_MAX
  abilities: { id: string; rank: number }[]; // up to GHOSTMERGER_ABILITIES_MAX
  movesKnown: string[];      // up to GHOSTMERGER_MOVES_KNOWN_MAX
  fed: number;               // how many ghosts have gone in
};
/** One Ghost Merger machine on the map. */
export type GhostMergerNode = {
  map: string;
  tx: number;
  ty: number;
  t?: number;
  stored: StoredGhost[];
  super: PartialSuperGhost | null;
};

export const GHOSTMERGER_SECONDS = 8;
export const GHOSTMERGER_POWER = 3;
export const GHOSTMERGER_STORED_MAX = 10;
export const GHOSTMERGER_TYPES_MAX = 11;        // every TypeId
export const GHOSTMERGER_ABILITIES_MAX = 10;
export const GHOSTMERGER_MOVES_KNOWN_MAX = 50;
export const GHOSTMERGER_EXTRACT_MIN = 5;       // how many fed before the player can extract

export function sanitizeGhostMergers(raw: unknown): GhostMergerNode[] {
  if (!Array.isArray(raw)) return [];
  const out: GhostMergerNode[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as any;
    if (typeof o.map !== "string" || !Number.isInteger(o.tx) || !Number.isInteger(o.ty)) continue;
    const key = `${o.map}|${o.tx},${o.ty}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const stored: StoredGhost[] = Array.isArray(o.stored)
      ? o.stored.slice(0, GHOSTMERGER_STORED_MAX).map(sanitizeStoredGhost).filter(Boolean) as StoredGhost[]
      : [];
    const sup = sanitizePartialSuper(o.super);
    out.push({ map: o.map, tx: o.tx, ty: o.ty, t: Number(o.t) || 0, stored, super: sup });
  }
  return out;
}

function sanitizeStoredGhost(g: any): StoredGhost | null {
  if (!g || typeof g !== "object") return null;
  if (typeof g.uid !== "string" || typeof g.name !== "string") return null;
  return {
    uid: g.uid,
    name: g.name,
    type: typeof g.type === "string" ? g.type : "normal",
    level: Math.max(1, Math.floor(Number(g.level) || 1)),
    rarity: Math.max(0, Math.floor(Number(g.rarity) || 0)),
    abilities: Array.isArray(g.abilities)
      ? g.abilities.filter((a: any) => a && typeof a.id === "string").map((a: any) => ({ id: String(a.id), rank: Math.max(0, Math.floor(Number(a.rank) || 0)) }))
      : [],
    moves: Array.isArray(g.moves) ? g.moves.filter((m: any) => typeof m === "string") : [],
  };
}

function sanitizePartialSuper(s: any): PartialSuperGhost | null {
  if (!s || typeof s !== "object") return null;
  return {
    level: Math.max(1, Math.floor(Number(s.level) || 1)),
    types: Array.isArray(s.types)
      ? Array.from(new Set(s.types.filter((t: any) => typeof t === "string"))).slice(0, GHOSTMERGER_TYPES_MAX) as string[]
      : [],
    abilities: Array.isArray(s.abilities)
      ? s.abilities.slice(0, GHOSTMERGER_ABILITIES_MAX).filter((a: any) => a && typeof a.id === "string").map((a: any) => ({ id: String(a.id), rank: Math.max(0, Math.floor(Number(a.rank) || 0)) }))
      : [],
    movesKnown: Array.isArray(s.movesKnown)
      ? Array.from(new Set(s.movesKnown.filter((m: any) => typeof m === "string"))).slice(0, GHOSTMERGER_MOVES_KNOWN_MAX) as string[]
      : [],
    fed: Math.max(0, Math.floor(Number(s.fed) || 0)),
  };
}

/** Fold one ghost into a partial super. Returns the (possibly updated) super. */
export function mergeGhostInto(sup: PartialSuperGhost | null, g: StoredGhost): PartialSuperGhost {
  const next: PartialSuperGhost = sup ?? { level: 1, types: [], abilities: [], movesKnown: [], fed: 0 };
  next.level = Math.max(next.level, g.level);
  if (!next.types.includes(g.type) && next.types.length < GHOSTMERGER_TYPES_MAX) next.types.push(g.type);
  // Pick one ability from the input to graft on (prefer novel ones).
  const own = new Set(next.abilities.map((a) => a.id));
  const novel = g.abilities.find((a) => !own.has(a.id));
  const grafted = novel ?? g.abilities[0];
  if (grafted && next.abilities.length < GHOSTMERGER_ABILITIES_MAX) next.abilities.push({ id: grafted.id, rank: grafted.rank });
  else if (grafted) {
    // All slots full — bump the rank of whatever matches (if any) to reward feeding.
    const match = next.abilities.find((a) => a.id === grafted.id);
    if (match) match.rank += 1;
  }
  // Learn the input's known moves (deduped, capped).
  for (const m of g.moves) {
    if (next.movesKnown.length >= GHOSTMERGER_MOVES_KNOWN_MAX) break;
    if (!next.movesKnown.includes(m)) next.movesKnown.push(m);
  }
  next.fed += 1;
  return next;
}

// ─── GearSet Generator ───────────────────────────────────────────────────────
/** Running tally built as the player dumps gear into the forge. */
export type ForgeTally = {
  pieces: number;
  levelSum: number;
  qualitySum: number;        // sum of quality indices (worn=0 .. legendary=5)
  enchantPool: Record<string, number>; // how often each enchant id was fed in
  enchantPowerSum: number;
  types: string[];           // deduped TypeIds seen
};
/** One GearSet Generator machine on the map. */
export type GearForgeNode = {
  map: string;
  tx: number;
  ty: number;
  tally: ForgeTally;
};

export const GEARFORGE_SECONDS = 2;
export const GEARFORGE_POWER_PER_PIECE = 12;
export const GEARFORGE_POWER_MIN = 50;
export const GEARFORGE_BONUS_ENCHANTS = 5;      // the +5 that bypass MAX_GEAR_ENCHANTS
export const GEARFORGE_MIN_CAST = 6;            // one per gear slot
export const GEARFORGE_MEGASET_THRESHOLD = 36;  // 6 full sets dumped
export const GEARFORGE_PILE_MAX = 400;

export function emptyTally(): ForgeTally {
  return { pieces: 0, levelSum: 0, qualitySum: 0, enchantPool: {}, enchantPowerSum: 0, types: [] };
}

export function sanitizeGearForges(raw: unknown): GearForgeNode[] {
  if (!Array.isArray(raw)) return [];
  const out: GearForgeNode[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as any;
    if (typeof o.map !== "string" || !Number.isInteger(o.tx) || !Number.isInteger(o.ty)) continue;
    const key = `${o.map}|${o.tx},${o.ty}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const t = o.tally && typeof o.tally === "object" ? o.tally : {};
    const tally: ForgeTally = {
      pieces: Math.max(0, Math.min(GEARFORGE_PILE_MAX, Math.floor(Number(t.pieces) || 0))),
      levelSum: Math.max(0, Math.floor(Number(t.levelSum) || 0)),
      qualitySum: Math.max(0, Math.floor(Number(t.qualitySum) || 0)),
      enchantPool: {},
      enchantPowerSum: Math.max(0, Math.floor(Number(t.enchantPowerSum) || 0)),
      types: Array.isArray(t.types) ? Array.from(new Set(t.types.filter((x: any) => typeof x === "string"))) as string[] : [],
    };
    if (t.enchantPool && typeof t.enchantPool === "object") {
      for (const [id, n] of Object.entries(t.enchantPool)) {
        const c = Math.floor(Number(n));
        if (id && c > 0) tally.enchantPool[id] = c;
      }
    }
    out.push({ map: o.map, tx: o.tx, ty: o.ty, tally });
  }
  return out;
}

/** How many of a given enchant id to pick, weighted by the input pool. */
export function pickWeighted(pool: Record<string, number>, rng: () => number, n: number, exclude: Set<string>): string[] {
  const entries = Object.entries(pool).filter(([id]) => !exclude.has(id));
  const picked: string[] = [];
  for (let k = 0; k < n; k++) {
    const total = entries.reduce((a, [, v]) => a + v, 0);
    if (total <= 0) break;
    let r = rng() * total;
    let hitIdx = -1;
    for (let i = 0; i < entries.length; i++) {
      r -= entries[i][1];
      if (r <= 0) { hitIdx = i; break; }
    }
    if (hitIdx < 0) hitIdx = entries.length - 1;
    picked.push(entries[hitIdx][0]);
    entries.splice(hitIdx, 1);
  }
  return picked;
}

/** Bump a quality index up by `up` tiers, clamped to legendary. */
export function bumpedQuality(index: number, up: number, maxIndex = 5): number {
  return Math.max(0, Math.min(maxIndex, index + up));
}
