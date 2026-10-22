/**
 * Extra Power blocks and the Pipe item-mover (TURBZ + New Texture Mode).
 *
 * Pure data + maths. No engine, no canvas — so scripts/power-extra.test.mjs can load it.
 */

export type PowerExtraKind = "logburner" | "solar" | "capacitor" | "blockgen" | "blockbreaker" | "tesla" | "pipe";

export const POWER_EXTRA_KINDS: PowerExtraKind[] = ["logburner", "solar", "capacitor", "blockgen", "blockbreaker", "tesla", "pipe"];

export function isPowerExtra(piece: string): piece is PowerExtraKind {
  return (POWER_EXTRA_KINDS as string[]).includes(piece);
}

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
    if (!isPowerExtra(o.kind) || typeof o.map !== "string" || !Number.isInteger(o.tx) || !Number.isInteger(o.ty) || o.tx < 0 || o.ty < 0) continue;
    const key = `${o.map}|${o.tx},${o.ty}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // clamp
    if (o.dir != null) o.dir = ((Math.floor(Number(o.dir)) % 4) + 4) % 4;
    if (o.kind === "blockgen" || o.kind === "blockbreaker") {
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
  const sources = ports.filter((p) => p.kind === "dup" || p.kind === "blockbreaker");
  const sinks = ports.filter((p) => p.kind === "hellgen" || p.kind === "logburner" || p.kind === "blockgen" || p.kind === "chest");

  const takeFrom = (src: PipePort, id: string, n = 1): boolean => {
    if (src.kind === "dup") {
      if (!src.n.item || src.n.item !== id || (src.n.stored ?? 0) < n) return false;
      src.n.stored -= n;
      if ((src.n.stored ?? 0) <= 0 && !src.n.seed) src.n.item = "";
      return true;
    }
    if (src.kind === "blockbreaker") {
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
    else if (src.kind === "blockbreaker") {
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
  blockbreaker: "Breaks the block it faces every second. Walls give back material; natural rock mines normally.",
  tesla: "Zaps the nearest foe in range. Needs Power.",
  pipe: "Moves items between connected machines and the Storage Chest. Shapes itself to its neighbours.",
};

export const POWER_EXTRA_MENU: PowerExtraKind[] = ["logburner", "solar", "capacitor", "blockgen", "blockbreaker", "tesla"];
