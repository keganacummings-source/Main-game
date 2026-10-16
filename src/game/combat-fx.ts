import type { Move, TypeId } from "./content";

/** Pixel FX that match the 2x Antifarea sprites: 2-unit pixels, hard edges, 4-shade palettes. */
export const P = 2;
type Pal = [string, string, string, string];
export const PAL: Record<TypeId, Pal> = {
  normal: ["#3a3028", "#a89880", "#e8dcc4", "#ffffff"],
  fire: ["#5a1408", "#c0381a", "#f08a24", "#ffe08a"],
  water: ["#0c2850", "#2a64b0", "#5ab0e8", "#d8f4ff"],
  earth: ["#2e1e10", "#6a4a24", "#a8823e", "#e8d098"],
  air: ["#1e4a40", "#4a9a84", "#9ad8c8", "#f0fff8"],
  electric: ["#4a3a08", "#c8a018", "#f2d43a", "#fffbe0"],
  ice: ["#183a5a", "#4a8ac8", "#9ad0ff", "#ffffff"],
  void: ["#120828", "#3a1c78", "#6a4cff", "#d8ccff"],
  light: ["#6a5418", "#d0aa3a", "#fff1a8", "#ffffff"],
  spirit: ["#2a1a40", "#7a5aa8", "#c9a6e8", "#fff0ff"],
  ghoul: ["#200c18", "#6a1a30", "#8d72a8", "#e8c8d8"],
};
const EVADE_PAL: Pal = ["#2a2050", "#7a6ad8", "#c8beff", "#ffffff"];

type C = CanvasRenderingContext2D;
const snap = (v: number) => Math.round(v / P) * P;
export function px(ctx: C, x: number, y: number, c: string, n = 1) {
  ctx.fillStyle = c;
  ctx.fillRect(snap(x), snap(y), P * n, P * n);
}
function line(ctx: C, x0: number, y0: number, x1: number, y1: number, c: string, w = 1) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / P));
  for (let i = 0; i <= steps; i++) px(ctx, x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, c, w);
}
function ring(ctx: C, x: number, y: number, r: number, c: string, squash = 1, gap = 0, rot = 0) {
  const n = Math.max(8, Math.floor((r * 6.3) / P));
  for (let i = 0; i < n; i++) {
    if (gap && i % gap === 0) continue;
    const a = (i / n) * Math.PI * 2 + rot;
    px(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r * squash, c);
  }
}
function disc(ctx: C, x: number, y: number, r: number, c: string, squash = 1) {
  for (let yy = -r; yy <= r; yy += P) for (let xx = -r; xx <= r; xx += P) if (xx * xx + (yy / squash) * (yy / squash) <= r * r) px(ctx, x + xx, y + yy * squash, c);
}
function glow(ctx: C, x: number, y: number, r: number, c: string, a: number) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  disc(ctx, x, y, r * 0.55, c);
  ctx.globalAlpha *= 0.5;
  disc(ctx, x, y, r, c);
  ctx.restore();
}
function star(ctx: C, x: number, y: number, r: number, pal: Pal, rays = 4, rot = 0) {
  for (let k = 0; k < rays; k++) {
    const a = rot + (k / rays) * Math.PI * 2;
    for (let d = 0; d < r; d += P) px(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, d < r * 0.4 ? pal[3] : d < r * 0.75 ? pal[2] : pal[1]);
  }
  px(ctx, x - P / 2, y - P / 2, pal[3], 1);
}
function zig(ctx: C, x0: number, y0: number, x1: number, y1: number, c: string, amp: number, seg = 8) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(2, Math.ceil(len / seg));
  const nx = -(y1 - y0) / (len || 1), ny = (x1 - x0) / (len || 1);
  let px0 = x0, py0 = y0;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const j = i === n ? 0 : (Math.random() - 0.5) * 2 * amp;
    const x = x0 + (x1 - x0) * t + nx * j, y = y0 + (y1 - y0) * t + ny * j;
    line(ctx, px0, py0, x, y, c);
    px0 = x;
    py0 = y;
  }
}
const SIL = ["..##..", ".####.", "..##..", ".####.", "######", "#.##.#", ".####.", ".#..#.", ".#..#."];
function silhouette(ctx: C, x: number, y: number, c: string, edge: string) {
  for (let r = 0; r < SIL.length; r++)
    for (let k = 0; k < 6; k++) if (SIL[r]![k] === "#") px(ctx, x - 6 * P + k * P * 2, y - 9 * P + r * P * 2, k === 0 || r === 0 || SIL[r]![k - 1] !== "#" ? edge : c, 2);
}
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
};
const ease = (u: number) => 1 - (1 - Math.min(1, Math.max(0, u))) ** 3;

type Shape = "comet" | "drop" | "boulder" | "gust" | "spark" | "shard" | "orb" | "lance" | "wisp" | "blob" | "star" | "coin";
type Kind = "slash" | "thrust" | "proj" | "beam" | "impact" | "ward" | "heal" | "surge" | "trail" | "roll" | "blink" | "slam" | "rune" | "evade" | "flash" | "sigCast" | "sigHit" | "status" | "orbiter"
  // Bespoke verse animations (Move.fx) and ghost-ability effects.
  | "meteor" | "chain" | "vortex" | "pillar" | "nova" | "boomerang" | "barrage" | "fissure" | "sigil" | "spectral" | "wave" | "bloom" | "bomb" | "guard";
type Fx = {
  kind: Kind; x0: number; y0: number; x1: number; y1: number; t: number; dur: number; pal: Pal; type: TypeId; seed: number;
  shape?: Shape; big?: number; dir?: number; tilt?: number; impact?: Fx; quality?: number; burst?: boolean;
  /** Live aim point. Flying FX re-read it every tick so a shot chases a moving target (or its miss spot). */
  follow?: () => [number, number] | null; fox?: number; foy?: number;
  /** Signature layer: which flourish, its accent palette, and the status it shows. */
  variant?: number; accent?: Pal; effect?: string;
  /** Area radius in pixels (novas, barrages, blasts). */
  rad?: number;
};

/** Second colours each element borrows for its signature flourishes. */
const SIG_ACCENT: Record<TypeId, TypeId[]> = {
  normal: ["light", "earth"], fire: ["light", "ghoul", "electric"], water: ["ice", "air", "spirit"], earth: ["fire", "normal", "ghoul"],
  air: ["light", "water", "spirit"], electric: ["light", "void", "air"], ice: ["water", "light", "void"], void: ["spirit", "ghoul", "electric"],
  light: ["fire", "spirit", "electric"], spirit: ["void", "light", "water"], ghoul: ["void", "fire", "earth"],
};
/** Fixed colours for status overlays so every effect reads the same everywhere. */
const STATUS_PAL: Record<string, Pal> = {
  burn: ["#5a1408", "#c0381a", "#f08a24", "#ffe08a"],
  root: ["#1c3a14", "#3f8a2a", "#7ad06a", "#d8ffb8"],
  sleep: ["#2a2050", "#6a5ad8", "#b8a8ff", "#f0eaff"],
  silence: ["#2a2420", "#7a7068", "#c8c0b0", "#ffffff"],
  soak: ["#0c2850", "#2a64b0", "#5ab0e8", "#d8f4ff"],
  gloom: ["#140c1c", "#3a2a48", "#6a5478", "#a898b8"],
  expose: ["#4a0c10", "#c4283a", "#ff5a6a", "#ffd0d6"],
  spark: ["#3a3008", "#c8a018", "#f8e048", "#ffffd0"],
  leech: ["#3a0810", "#a01830", "#e0465a", "#ffb8c0"],
  drain: ["#3a0810", "#a01830", "#e0465a", "#ffb8c0"],
  cleanse: ["#4a4430", "#c8c0a0", "#fff8d8", "#ffffff"],
  shell: ["#2a3a48", "#5a7a98", "#a8c8e8", "#ffffff"],
};

/** Gap between the shots of one volley. The engine staggers a volley's damage by the same amount. */
export const VOLLEY_GAP = 0.07;

export type CastOpts = {
  /** Live aim point for the end of the flight. Return null once the target is gone. */
  follow?: () => [number, number] | null;
  /** The attack misses: melee skips the impact burst, shots end in a small puff beside the target. */
  miss?: boolean;
  /** Force a three-shot volley so the visuals agree with a volley's three hits. */
  volley?: boolean;
  /** An extra layer from an imbued weapon (or a ghost's own FX) on top of the verse's look. */
  imbue?: { type: TypeId; accent: TypeId; style: number; quality: number } | null;
};
type MoteKind = "px" | "drop" | "spark" | "ring" | "flake";
type Mote = { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; g: number; k: MoteKind; drag: number };

const SHAPE: Record<TypeId, Shape> = {
  normal: "star", fire: "comet", water: "drop", earth: "boulder", air: "gust", electric: "spark", ice: "shard", void: "orb", light: "lance", spirit: "wisp", ghoul: "blob",
};
const RISE: Partial<Record<TypeId, number>> = { fire: -70, light: -40, spirit: -34, void: -10, air: -8, water: 160, earth: 220, ghoul: 140, normal: 120, ice: 26 };
const TRAIL: Record<TypeId, MoteKind> = { normal: "px", fire: "px", water: "ring", earth: "px", air: "spark", electric: "spark", ice: "flake", void: "px", light: "spark", spirit: "px", ghoul: "drop" };
const ARC: Partial<Record<TypeId, number>> = { earth: 0.3, ghoul: 0.14, normal: 0.08, water: 0.06 };
const WOB: Partial<Record<TypeId, number>> = { spirit: 8, air: 5, void: 2 };
const THRUST = /stab|pierce|thrust|lance|spear|jab|needle|fang|lunge|rapier|sting/;
const MULTI = /flurry|palm|cutlass|whirl|grin|frenzy|rend|claw|combo|barrage|fury/;
const VOLLEY = /volley|rain|carousel|fan|storm|court|scatter|spray|hail|swarm/;

/** Bespoke kinds drawn around x0/y0 on the foe (they track it rather than flying to it). */
const AREA_KINDS = new Set<Kind>(["vortex", "pillar", "barrage", "sigil", "spectral", "bloom"]);
/** Tactics whose verses may carry a bespoke animation (Move.fx). Movement and self verses keep theirs. */
const BESPOKE_TACTICS = new Set(["strike", "heavy", "channel"]);
/** Every bespoke animation a verse can name in Move.fx. */
export const MOVE_FX_IDS = ["meteor", "chain", "vortex", "pillar", "nova", "boomerang", "barrage", "fissure", "sigil", "spectral", "wave", "bloom"] as const;
export type MoveFxId = (typeof MOVE_FX_IDS)[number];

export class CombatFx {
  list: Fx[] = [];
  motes: Mote[] = [];
  /** Screen shake requested by big impacts; the engine drains it each tick. */
  kick = 0;

  mote(x: number, y: number, c: string, type: TypeId, spread = 40, life = 0.5, k: MoteKind = "px", vx = 0, vy = 0) {
    if (this.motes.length > 520) return;
    this.motes.push({ x, y, vx: vx + (Math.random() - 0.5) * spread, vy: vy + (Math.random() - 0.5) * spread * 0.7, life, max: life, c, g: RISE[type] ?? 0, k, drag: k === "spark" ? 0.9 : 0.95 });
  }

  /**
   * Each verse gets its own recipe from tactic, form, element, effect and an id hash.
   *
   * Returns how many seconds pass before the verse visually connects (projectile arrival, beam
   * strike, slash contact). The engine applies damage then, so numbers, hit-flashes and MISS
   * always agree with what the player sees.
   */
  cast(move: Move, form: string, tactic: string, x0: number, y0: number, x1: number, y1: number, opts: CastOpts = {}): number {
    const start = this.list.length;
    const delay = this.castBase(move, form, tactic, x0, y0, x1, y1, opts);
    this.signature(move, tactic, x0, y0, x1, y1, delay, opts, start);
    if (opts.imbue) this.imbueLayer(opts.imbue, x0, y0, x1, y1, delay, opts, start);
    return delay;
  }

  /**
   * Imbue: an imbued weapon (or a ghost) adds its own element to every verse it casts.
   * Echo: a twin spirals each shot. Burst: a second, bigger impact. Sigil: a rune at both ends.
   * Comet: a smaller copy of each shot chases the first. Melee and self verses get an extra slash or flourish.
   */
  private imbueLayer(im: NonNullable<CastOpts["imbue"]>, x0: number, y0: number, x1: number, y1: number, delay: number, opts: CastOpts, start: number) {
    const pal = PAL[im.type] ?? PAL.normal;
    const accent = PAL[im.accent] ?? pal;
    const big = 0.7 + im.quality * 0.12;
    const seed = (im.style * 0.17 + im.quality * 0.07) % 1;
    const base = { x0, y0, x1, y1, pal, type: im.type, seed, big, tilt: 0.6, accent };
    const chase = opts.follow ? { follow: opts.follow, fox: 0, foy: 0 } : {};
    const shots = this.list.slice(start).filter((f) => f.kind === "proj" || f.kind === "beam");
    const slashes = this.list.slice(start).filter((f) => f.kind === "slash" || f.kind === "thrust");
    if (im.style === 2 || (!shots.length && !slashes.length)) this.list.push({ ...base, kind: "sigCast", t: 0, dur: 0.45, variant: (im.quality + 3) % 6, x1: x0, y1: y0 });
    if (slashes.length) {
      const f = slashes[0]!;
      this.list.push({ ...f, pal, accent, kind: "slash", t: (f.t ?? 0) - 0.06, dir: -(f.dir ?? 1), big: (f.big ?? 1) * 0.9 });
    }
    for (const f of shots) {
      if (im.style === 0 && f.kind === "proj") this.list.push({ ...f, pal, kind: "orbiter", impact: undefined, variant: im.quality % 3, accent, seed });
      if (im.style === 3 && f.kind === "proj") this.list.push({ ...f, pal, accent, kind: "proj", t: (f.t ?? 0) - 0.07, big: (f.big ?? 1) * 0.6, impact: undefined });
    }
    if (opts.miss) return;
    const hitAt = Math.max(0, delay);
    if (im.style === 1) this.list.push({ ...base, ...chase, kind: "impact", t: -hitAt - 0.05, dur: 0.45, x0: x1, y0: y1, big: big * 1.3, burst: true });
    else this.list.push({ ...base, ...chase, kind: "sigHit", t: -hitAt - 0.03, dur: 0.45, variant: (im.style * 2 + im.quality) % 7, x0: x1, y0: y1, x1: x0, y1: y0 });
  }

  /**
   * Signature layer, added on top of the base recipe without changing it: every verse gets its own
   * cast flourish, impact flourish and accent colour from its id, a status overlay that shows what it
   * does (sleep Zs, roots, silence rune…), and some projectiles gain a companion that spirals round them.
   */
  private signature(move: Move, tactic: string, x0: number, y0: number, x1: number, y1: number, delay: number, opts: CastOpts, start: number) {
    const type = move.type;
    const pal = PAL[type] ?? PAL.normal;
    const s1 = hash(`${move.id}#sig`);
    const s2 = hash(`sig2:${move.id}`);
    const accents = SIG_ACCENT[type] ?? SIG_ACCENT.normal;
    const accent = PAL[accents[Math.floor(s2 * accents.length) % accents.length]!] ?? pal;
    const big = 0.75 + Math.min(1.1, move.power / 60);
    const base = { x0, y0, x1, y1, pal, type, seed: s1, big, tilt: 0.5, accent };
    const self = tactic === "ward" || tactic === "heal" || tactic === "surge" || tactic === "dash" || tactic === "roll" || move.effect === "mend";
    this.list.push({ ...base, kind: "sigCast", t: 0, dur: self ? 0.7 : 0.34, variant: Math.floor(s1 * 6), x1: self ? x0 : x1, y1: self ? y0 : y1 });
    if (self) {
      if (move.effect === "shell" || move.effect === "cleanse") this.list.push({ ...base, kind: "status", t: -0.05, dur: 0.9, effect: move.effect, x0, y0: y0 + 6, x1: x0, y1: y0 });
      return;
    }
    if (opts.miss) return;
    const hitAt = Math.max(0, delay);
    const chase = opts.follow ? { follow: opts.follow, fox: 0, foy: 0 } : {};
    this.list.push({ ...base, ...chase, kind: "sigHit", t: -hitAt, dur: 0.5, variant: Math.floor(s2 * 7), x0: x1, y0: y1, x1: x0, y1: y0 });
    const eff = move.effect;
    if (eff && eff !== "none" && STATUS_PAL[eff]) this.list.push({ ...base, ...chase, kind: "status", t: -hitAt - 0.04, dur: eff === "leech" || eff === "drain" ? 0.7 : 1.05, effect: eff, x0: x1, y0: y1, x1: x0, y1: y0 });
    // Per-verse size and trail accent on its projectiles, so same-element shots read differently.
    for (const f of this.list.slice(start)) {
      if (f.kind !== "proj") continue;
      f.big = (f.big ?? 1) * (0.85 + s2 * 0.4);
      if (s1 < 0.75) f.accent = accent;
    }
    // Companion orbiters on some projectiles: helix twin, trailing satellite or a spinning ring.
    if (s1 > 0.42) {
      const mode = Math.floor(s2 * 3);
      for (const f of this.list.slice(start)) {
        if (f.kind !== "proj") continue;
        this.list.push({ ...f, kind: "orbiter", impact: undefined, variant: mode, accent, seed: s1 });
      }
    }
  }

  private castBase(move: Move, form: string, tactic: string, x0: number, y0: number, x1: number, y1: number, opts: CastOpts = {}): number {
    const type = move.type;
    const pal = PAL[type] ?? PAL.normal;
    const seed = hash(move.id);
    const big = 0.75 + Math.min(1.1, move.power / 60);
    const tilt = 0.5 + ((seed * 7) % 1) * 0.5;
    const base = { x0, y0, x1, y1, t: 0, pal, type, seed, big, tilt };
    const miss = !!opts.miss;
    const impact: Fx = { ...base, kind: "impact", dur: 0.38 + big * 0.1, x0: x1, y0: y1 };
    const key = (move.id + " " + move.name).toLowerCase();
    const add = (f: Fx) => { this.list.push(f); };
    const chase = (dx = 0, dy = 0): Partial<Fx> => (opts.follow ? { follow: opts.follow, fox: dx, foy: dy } : {});
    if (move.fx && BESPOKE_TACTICS.has(tactic)) return this.bespoke(move, tactic, base, impact, miss, chase);
    if (tactic === "ward") { add({ ...base, kind: "ward", dur: 1 }); return 0; }
    if (tactic === "heal" || move.effect === "mend") { add({ ...base, kind: "heal", dur: 1 }); return 0; }
    if (tactic === "surge") { add({ ...base, kind: "surge", dur: 0.85 }); return 0; }
    if (tactic === "dash") { add({ ...base, kind: "trail", dur: 0.5 }); return 0; }
    if (tactic === "roll") { add({ ...base, kind: "roll", dur: 0.5 }); return 0; }
    if (tactic === "blink") {
      add({ ...base, kind: "blink", dur: 0.45 });
      if (!miss) add({ ...impact, t: -0.06, big: big * 0.8 });
      return 0.06;
    }
    if (tactic === "heavy") {
      add({ ...base, kind: "slash", dur: 0.26, dir: seed > 0.5 ? 1 : -1, big: big * 1.35, tilt: 0.45 });
      if (!miss) add({ ...base, kind: "slam", dur: 0.7, x0: x1, y0: y1, t: -0.12 });
      return 0.14;
    }
    if (tactic === "channel") {
      add({ ...base, kind: "rune", dur: 1, x1: x0, y1: y0 + 20 });
      const spill = { ...impact, big: big * (miss ? 0.8 : 1.35), burst: !miss };
      if (type === "light" || type === "electric" || type === "void" || seed > 0.55) {
        add({ ...base, ...chase(), kind: "beam", dur: 0.5, t: -0.4, impact: spill });
        return 0.4;
      }
      add({ ...base, ...chase(), kind: "proj", shape: SHAPE[type], dur: 0.34, t: -0.4, big: big * 1.5, impact: { ...spill, big: big * (miss ? 0.8 : 1.45) } });
      return 0.74;
    }
    if (form === "melee" || tactic === "lunge") {
      if (THRUST.test(key)) {
        add({ ...base, kind: "thrust", dur: 0.22 });
        if (!miss) add({ ...impact, t: -0.06, big: big * 0.85 });
        return 0.1;
      }
      const count = MULTI.test(key) ? 3 : seed > 0.66 ? 2 : 1;
      for (let i = 0; i < count; i++) add({ ...base, kind: "slash", dur: 0.22, t: -i * 0.09, dir: i % 2 ? -1 : 1, tilt: i % 2 ? tilt * 0.7 : tilt, big: big * (1 - i * 0.08) });
      if (!miss) add({ ...impact, t: -0.06, big: big * 0.8 });
      return 0.08;
    }
    if (type === "electric" || move.id === "dawn" || move.id === "focuslance") {
      add({ ...base, ...chase(), kind: "beam", dur: 0.32, impact: miss ? { ...impact, big: big * 0.7 } : impact });
      return 0.05;
    }
    const shape: Shape = move.id === "cointoss" ? "coin" : SHAPE[type];
    const n = opts.volley ? 3 : VOLLEY.test(key) ? 3 : 1;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const flight = Math.max(0.14, dist / (type === "earth" ? 420 : 600));
    add({ ...base, kind: "flash", dur: 0.14, x1: x0, y1: y0 });
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 16;
      add({
        ...base, ...chase(off * 0.3, off), kind: "proj", shape, dur: flight, t: -i * VOLLEY_GAP, x1: x1 + off * 0.3, y1: y1 + off,
        impact: { ...impact, x0: x1 + off * 0.3, y0: y1 + off, big: big * (n > 1 ? 0.6 : 1) * (miss ? 0.7 : 1) },
      });
    }
    return flight;
  }

  /**
   * Bespoke verse animations. Each returns the seconds until the verse lands (the engine applies damage
   * then). Heavy and channelled verses wind up first: a rune for channels, a short crouch for heavies.
   */
  private bespoke(move: Move, tactic: string, base: Omit<Fx, "kind" | "dur">, impact: Fx, miss: boolean, chase: (dx?: number, dy?: number) => Partial<Fx>): number {
    const add = (f: Fx) => { this.list.push(f); };
    const { x0, y0, x1, y1 } = base;
    const big = base.big ?? 1;
    const wind = tactic === "channel" ? 0.4 : tactic === "heavy" ? 0.16 : 0;
    if (tactic === "channel") add({ ...base, kind: "rune", dur: 1, x1: x0, y1: y0 + 20 });
    if (tactic === "heavy") add({ ...base, kind: "sigCast", dur: 0.3, variant: 0, x1: x0, y1: y0 });
    const rad = move.splash?.radius ?? move.nova ?? 50;
    const hit = (at: number, b = 1): Fx => ({ ...impact, ...chase(), t: -at, big: big * b * (miss ? 0.6 : 1), burst: !miss && b >= 1.2 });
    switch (move.fx) {
      case "meteor": {
        const fall = 0.5;
        const sx = x1 - (x1 >= x0 ? 70 : -70), sy = y1 - 170;
        add({ ...base, ...chase(), kind: "meteor", dur: fall, t: -wind, x0: sx, y0: sy, impact: { ...hit(0, 1.5), t: 0 } });
        if (!miss) add({ ...base, ...chase(), kind: "nova", dur: 0.5, t: -(wind + fall), x0: x1, y0: y1 + 8, rad });
        return wind + fall;
      }
      case "chain":
        add({ ...base, kind: "flash", dur: 0.14, t: -wind, x1: x0, y1: y0 });
        add({ ...base, ...chase(), kind: "chain", dur: 0.32, t: -wind, impact: { ...hit(0), t: 0 } });
        return wind + 0.05;
      case "vortex":
        add({ ...base, kind: "flash", dur: 0.14, t: -wind, x1: x0, y1: y0 });
        add({ ...base, ...chase(), kind: "vortex", dur: 0.95, t: -wind, x0: x1, y0: y1, rad });
        if (!miss) add(hit(wind + 0.55, 1.1));
        return wind + 0.55;
      case "pillar":
        add({ ...base, ...chase(0, 10), kind: "pillar", dur: 0.85, t: -wind, x0: x1, y0: y1 + 10, rad });
        if (!miss) add(hit(wind + 0.32, 1.25));
        return wind + 0.32;
      case "nova":
        add({ ...base, kind: "nova", dur: 0.6, t: -wind, x1: x0, y1: y0, y0: y0 + 12, rad: move.nova ?? rad });
        return wind + 0.16;
      case "boomerang": {
        const out = 0.36;
        add({ ...base, ...chase(), kind: "boomerang", dur: out * 2, t: -wind });
        if (!miss) { add(hit(wind + out, 0.9)); if (move.echo) add(hit(wind + out * 2 - 0.02, 0.7)); }
        return wind + out;
      }
      case "barrage":
        add({ ...base, ...chase(), kind: "barrage", dur: 0.75, t: -wind, x0: x1, y0: y1, rad });
        if (!miss) add(hit(wind + 0.36, 1.1));
        return wind + 0.36;
      case "fissure":
        add({ ...base, ...chase(), kind: "fissure", dur: 0.85, t: -wind, y0: y0 + 16, y1: y1 + 10 });
        if (!miss) add({ ...base, ...chase(), kind: "slam", dur: 0.7, x0: x1, y0: y1, t: -(wind + 0.34) });
        return wind + 0.34;
      case "sigil":
        add({ ...base, ...chase(0, 10), kind: "sigil", dur: 0.95, t: -wind, x0: x1, y0: y1 + 10, rad });
        if (!miss) add(hit(wind + 0.55, 1.4));
        return wind + 0.55;
      case "spectral":
        add({ ...base, ...chase(0, 12), kind: "spectral", dur: 0.7, t: -wind, x0: x1, y0: y1 + 12 });
        if (!miss) add(hit(wind + 0.28, 0.9));
        return wind + 0.28;
      case "wave": {
        const dist = Math.hypot(x1 - x0, y1 - y0);
        const travel = Math.max(0.22, dist / 380);
        add({ ...base, ...chase(), kind: "wave", dur: travel + 0.25, t: -wind, rad, variant: Math.round(travel * 1000) });
        if (!miss) add(hit(wind + travel, 1.2));
        return wind + travel;
      }
      case "bloom":
        add({ ...base, kind: "flash", dur: 0.14, t: -wind, x1: x0, y1: y0 });
        add({ ...base, ...chase(), kind: "bloom", dur: 0.8, t: -wind, x0: x1, y0: y1, rad });
        if (!miss) add(hit(wind + 0.22, 1));
        return wind + 0.22;
    }
    return 0;
  }

  /** A chain verse leaping from one foe to the next (the engine calls this per jump). */
  link(x0: number, y0: number, x1: number, y1: number, type: TypeId, delay = 0) {
    const pal = PAL[type] ?? PAL.normal;
    const base = { x0, y0, x1, y1, pal, type, seed: Math.random(), big: 0.8, tilt: 0.5 };
    this.list.push({ ...base, kind: "chain", t: -delay, dur: 0.26 });
    this.list.push({ ...base, kind: "impact", t: -delay - 0.04, dur: 0.32, x0: x1, y0: y1, big: 0.7 });
  }
  /** Ghost Soul Bomb: an orb lobbed in an arc that bursts over an area. Returns seconds until it lands. */
  bomb(x0: number, y0: number, x1: number, y1: number, type: TypeId, rad = 70): number {
    const pal = PAL[type] ?? PAL.normal;
    const base = { x0, y0, x1, y1, pal, type, seed: Math.random(), big: 1.2, tilt: 0.5 };
    const dur = 0.5;
    this.list.push({ ...base, kind: "bomb", t: 0, dur, impact: { ...base, kind: "impact", t: 0, dur: 0.5, x0: x1, y0: y1, big: 1.5, burst: true } });
    this.list.push({ ...base, kind: "nova", t: -dur, dur: 0.55, x0: x1, y0: y1 + 8, rad });
    return dur;
  }
  /** An expanding shockwave ring of radius `rad` (Radiant Surge, nova verses). */
  nova(x: number, y: number, rad: number, type: TypeId) {
    const pal = PAL[type] ?? PAL.normal;
    this.list.push({ kind: "nova", x0: x, y0: y + 12, x1: x, y1: y, t: 0, dur: 0.6, pal, type, seed: Math.random(), big: 1.2, rad });
    this.kick = Math.max(this.kick, 3);
  }
  /** A quick protective bubble on the hunter (Spirit Guard, Soul Mend, Second Wind). */
  guard(x: number, y: number, type: TypeId) {
    const pal = PAL[type] ?? PAL.normal;
    this.list.push({ kind: "guard", x0: x, y0: y, x1: x, y1: y, t: 0, dur: 0.55, pal, type, seed: Math.random(), big: 1 });
  }

  /** Weapon swing: crescent in the weapon's element; rarer weapons leave more behind. */
  swing(type: TypeId, quality: number, x0: number, y0: number, x1: number, y1: number) {
    const pal = PAL[type] ?? PAL.normal;
    const dir = Math.random() > 0.5 ? 1 : -1;
    const base = { x0, y0, x1, y1, t: 0, pal, type, seed: Math.random(), big: 0.8 + quality * 0.12, quality, tilt: 0.55 + Math.random() * 0.4 };
    this.list.push({ ...base, kind: "slash", dur: 0.2, dir });
    if (quality >= 4) this.list.push({ ...base, kind: "slash", dur: 0.2, dir: -dir, t: -0.08, big: base.big * 0.85, tilt: base.tilt * 0.7 });
    this.list.push({ ...base, kind: "impact", dur: 0.28, x0: x1, y0: y1, big: 0.55 + quality * 0.12, burst: quality >= 5 });
  }

  /** Dodge feedback: a lilac afterimage pop where the hit would have landed. */
  evade(x: number, y: number) {
    this.list.push({ kind: "evade", x0: x, y0: y, x1: x, y1: y, t: 0, dur: 0.4, pal: EVADE_PAL, type: "spirit", seed: Math.random(), big: 1 });
  }

  private pos(f: Fx, u: number): [number, number] {
    const dx = f.x1 - f.x0, dy = f.y1 - f.y0, len = Math.hypot(dx, dy) || 1;
    const w = (WOB[f.type] ?? 0) * Math.sin(u * Math.PI * 3 + f.seed * 6) * (1 - u);
    const arc = (ARC[f.type] ?? 0) * len * 4 * u * (1 - u);
    return [f.x0 + dx * u - (dy / len) * w, f.y0 + dy * u + (dx / len) * w - arc];
  }

  tick(dt: number) {
    const done: Fx[] = [];
    for (const f of this.list) {
      f.t += dt;
      if (f.follow && AREA_KINDS.has(f.kind)) {
        // Area verses sit on the foe: they follow it until they land, then stay put.
        const p = f.t < f.dur * 0.6 ? f.follow() : null;
        if (p) { f.x0 = p[0] + (f.fox ?? 0); f.y0 = p[1] + (f.foy ?? 0); }
      } else if (f.follow && (f.kind === "sigHit" || f.kind === "status")) {
        // Signature layers sit on the target: track it until the hit lands.
        const p = f.t <= 0.05 ? f.follow() : null;
        if (p) { f.x0 = p[0]; f.y0 = p[1]; }
      } else if (f.follow && f.t < f.dur) {
        const p = f.follow();
        if (p) {
          f.x1 = p[0] + (f.fox ?? 0);
          f.y1 = p[1] + (f.foy ?? 0);
          if (f.impact) { f.impact.x0 = f.x1; f.impact.y0 = f.y1; }
        }
      }
      if (f.t >= f.dur) done.push(f);
      else if (f.t > 0 && f.kind === "orbiter") {
        const [x, y] = this.orbitPos(f, f.t / f.dur);
        if (Math.floor(f.t * 40) % 2 === 0) this.mote(x, y, (f.accent ?? f.pal)[2], f.type, 10, 0.25, "px");
      }
      else if (f.t > 0 && f.kind === "proj") {
        const [x, y] = this.pos(f, f.t / f.dur);
        const back = Math.atan2(f.y0 - f.y1, f.x0 - f.x1);
        const k = TRAIL[f.type];
        for (let i = 0; i < 2; i++) this.mote(x, y, f.accent && i === 1 && Math.floor(f.t * 30) % 2 ? f.accent[2] : f.pal[1 + ((i + Math.floor(f.t * 30)) % 3)], f.type, k === "spark" ? 30 : 22, k === "flake" ? 0.6 : 0.35, k, Math.cos(back) * 40, Math.sin(back) * 40);
      }
    }
    for (const f of done) {
      if (!f.impact) continue;
      this.list.push(f.impact);
      if (f.impact.burst) this.kick = Math.max(this.kick, 4);
    }
    this.list = this.list.filter((f) => f.t < f.dur);
    for (const m of this.motes) {
      m.life -= dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.vy += m.g * dt;
      m.vx *= m.drag;
      if (m.k === "flake") m.x += Math.sin(m.life * 9) * 0.4;
    }
    this.motes = this.motes.filter((m) => m.life > 0);
  }

  draw(ctx: C, clock: number) {
    ctx.globalAlpha = 1;
    for (const f of this.list) if (f.t >= 0 && (f.kind === "impact" || f.kind === "flash" || f.kind === "beam" || f.kind === "slam" || f.kind === "meteor" || f.kind === "pillar" || f.kind === "sigil" || f.kind === "bomb")) this.glowFx(ctx, f);
    for (const m of this.motes) {
      if (m.life / m.max < 0.35 && Math.floor(m.life * 30) % 2) continue;
      if (m.k === "drop") { px(ctx, m.x, m.y, m.c); px(ctx, m.x, m.y - P, m.c); }
      else if (m.k === "spark") line(ctx, m.x, m.y, m.x - m.vx * 0.04, m.y - m.vy * 0.04, m.c);
      else if (m.k === "ring") { px(ctx, m.x - P, m.y, m.c); px(ctx, m.x + P, m.y, m.c); px(ctx, m.x, m.y - P, m.c); px(ctx, m.x, m.y + P, m.c); }
      else if (m.k === "flake") { px(ctx, m.x, m.y, m.c); if (Math.floor(m.life * 12) % 2) { px(ctx, m.x - P, m.y, m.c); px(ctx, m.x + P, m.y, m.c); } }
      else px(ctx, m.x, m.y, m.c);
    }
    for (const f of this.list) if (f.t >= 0) this.drawFx(ctx, f, clock);
    ctx.globalAlpha = 1;
  }

  private glowFx(ctx: C, f: Fx) {
    const u = f.t / f.dur;
    const big = f.big ?? 1;
    if (f.kind === "impact" && u < 0.4) glow(ctx, f.x0, f.y0, (12 + 10 * big) * (1 - u), f.pal[2], 0.35 * (1 - u / 0.4));
    else if (f.kind === "flash") glow(ctx, f.x0, f.y0, 10, f.pal[2], 0.4 * (1 - u));
    else if (f.kind === "slam" && u < 0.3) glow(ctx, f.x0, f.y0, 30 * big, f.pal[2], 0.3 * (1 - u / 0.3));
    else if (f.kind === "beam" && u > 0 && u < 0.8) glow(ctx, f.x1, f.y1, 9 * big, f.pal[2], 0.2);
    else if (f.kind === "meteor") { const [x, y] = this.meteorPos(f, u); glow(ctx, x, y, 14 * big, f.pal[2], 0.3); }
    else if (f.kind === "pillar" && u > 0.3 && u < 0.8) glow(ctx, f.x0, f.y0 - 30, 22 * big, f.pal[2], 0.25);
    else if (f.kind === "sigil" && u > 0.5 && u < 0.75) glow(ctx, f.x0, f.y0, (f.rad ?? 50) * 0.8, f.pal[2], 0.3);
    else if (f.kind === "bomb") { const [x, y] = this.arcPos(f, u, 70); glow(ctx, x, y, 10, f.pal[2], 0.3); }
  }

  private drawFx(ctx: C, f: Fx, clock: number) {
    const u = f.t / f.dur;
    const [d, m, l, h] = f.pal;
    const big = f.big ?? 1;
    const ang = Math.atan2(f.y1 - f.y0, f.x1 - f.x0);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    switch (f.kind) {
      case "slash": return this.slash(ctx, f, u, ang);
      case "thrust": {
        const reach = 34 * big * ease(u * 1.8);
        const sx = f.x0 + ca * 6, sy = f.y0 + sa * 6;
        const tx = sx + ca * reach, ty = sy + sa * reach;
        if (u < 0.75) {
          line(ctx, sx - sa * P, sy + ca * P, tx, ty, m);
          line(ctx, sx + sa * P, sy - ca * P, tx, ty, m);
          line(ctx, sx, sy, tx, ty, l);
          line(ctx, tx - ca * 8, ty - sa * 8, tx, ty, h);
          star(ctx, tx, ty, 6 + 6 * big * (1 - u), f.pal, 4, ang);
        }
        for (let k = 1; k <= 2; k++) if (u > k * 0.18) ring(ctx, sx + ca * reach * (k / 3), sy + sa * reach * (k / 3), 4 + (u - k * 0.18) * 30, k === 1 ? l : m, 1.6, 2, ang);
        return;
      }
      case "proj": return this.proj(ctx, f, u, ang, clock);
      case "flash":
        star(ctx, f.x0, f.y0, 8 * (1 - u) + 2, f.pal, 4, Math.PI / 4);
        ring(ctx, f.x0, f.y0, 3 + u * 10, l, 1, 2);
        return;
      case "beam": return this.beam(ctx, f, u, ang, clock);
      case "impact": return this.impact(ctx, f, u, clock);
      case "slam": return this.slam(ctx, f, u);
      case "rune": {
        const r = 16 + Math.sin(u * Math.PI) * 5;
        const on = u < 0.85 || Math.floor(clock * 24) % 2 === 0;
        if (!on) return;
        ring(ctx, f.x1, f.y1, r, l, 0.4, 0, clock * 2);
        ring(ctx, f.x1, f.y1, r - 6, m, 0.4, 3, -clock * 3);
        for (let k = 0; k < 6; k++) {
          const a = clock * 1.5 + (k * Math.PI) / 3;
          const gx = f.x1 + Math.cos(a) * (r - 3), gy = f.y1 + Math.sin(a) * (r - 3) * 0.4;
          px(ctx, gx, gy - P, h); px(ctx, gx - P, gy, l); px(ctx, gx + P, gy, l);
        }
        for (let k = 0; k < 3; k++) {
          const yy = f.y1 - ((u * 60 + k * 18) % 50);
          px(ctx, f.x1 + Math.sin(clock * 6 + k * 2) * r * 0.6, yy, k % 2 ? l : h);
        }
        if (Math.random() < 0.7) this.mote(f.x1 + (Math.random() - 0.5) * r * 2, f.y1, l, f.type, 8, 0.6, TRAIL[f.type] === "drop" ? "px" : TRAIL[f.type], 0, -40);
        return;
      }
      case "ward": {
        const r = 20 + Math.sin(clock * 8) * 1;
        const on = u < 0.8 || Math.floor(clock * 20) % 2 === 0;
        if (!on) return;
        ctx.globalAlpha = 0.25;
        disc(ctx, f.x0, f.y0, r - 2, l, 1.1);
        ctx.globalAlpha = 1;
        for (let k = 0; k < 6; k++) {
          const a0 = (k * Math.PI) / 3 + clock * 0.8, a1 = a0 + Math.PI / 3;
          line(ctx, f.x0 + Math.cos(a0) * r, f.y0 + Math.sin(a0) * r * 1.1, f.x0 + Math.cos(a1) * r, f.y0 + Math.sin(a1) * r * 1.1, k % 2 ? l : h);
        }
        const sy = f.y0 - r + ((u * 3) % 1) * r * 2;
        const half = Math.sqrt(Math.max(0, r * r - (sy - f.y0) ** 2 / 1.21));
        line(ctx, f.x0 - half, sy, f.x0 + half, sy, h);
        if (u < 0.15) ring(ctx, f.x0, f.y0, r + u * 60, h, 1.1, 2);
        return;
      }
      case "heal": {
        for (let k = 0; k < 6; k++) {
          const yy = f.y0 + 12 - ((u * 46 + k * 9) % 46);
          const xx = f.x0 + (k - 2.5) * 7 + Math.sin(clock * 4 + k) * 2;
          if ((u * 46 + k * 9) % 46 > 40) continue;
          px(ctx, xx, yy, h); px(ctx, xx - P, yy, l); px(ctx, xx + P, yy, l); px(ctx, xx, yy - P, l); px(ctx, xx, yy + P, l);
        }
        ring(ctx, f.x0, f.y0 + 20, 8 + u * 14, l, 0.4, 2, clock);
        ring(ctx, f.x0, f.y0 + 20, 4 + u * 8, h, 0.4, 3, -clock);
        if (Math.random() < 0.5) this.mote(f.x0 + (Math.random() - 0.5) * 26, f.y0 + 16, Math.random() > 0.5 ? h : l, "light", 6, 0.6, "px", 0, -30);
        return;
      }
      case "surge": {
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          const fx = f.x0 + Math.cos(a) * 12, fy = f.y0 + 14 + Math.sin(a) * 4;
          const hgt = 6 + ((Math.floor(clock * 20) + k * 3) % 5) * 3;
          if (u > 0.85 && k % 2) continue;
          for (let j = 0; j < hgt; j += P) px(ctx, fx, fy - j, j > hgt * 0.6 ? h : j > hgt * 0.3 ? l : m);
        }
        for (let k = 0; k < 5; k++) {
          const yy = f.y0 - 14 + k * 7;
          const len = 8 + ((k * 37 + f.seed * 50) % 12);
          const xx = f.x0 - 16 - u * 26;
          line(ctx, xx - len, yy, xx, yy, k % 2 ? l : m);
          line(ctx, f.x0 + 16 + u * 26, yy, f.x0 + 16 + u * 26 + len, yy, k % 2 ? m : l);
        }
        ring(ctx, f.x0, f.y0 + 18, 6 + u * 18, h, 0.35, 2);
        return;
      }
      case "trail": {
        if (f.t < 0.03) {
          for (let i = 0; i < 12; i++) this.mote(f.x0, f.y0 + 14, i % 2 ? "#a89880" : "#6a5a48", "earth", 70, 0.45, "px", -ca * 50, -20);
          this.kick = Math.max(this.kick, 1.5);
        }
        for (let k = 1; k <= 4; k++) {
          const t = k / 5;
          if (u > t * 0.6 + 0.35) continue;
          ctx.globalAlpha = 0.18 + t * 0.4;
          silhouette(ctx, f.x0 + (f.x1 - f.x0) * t, f.y0 + (f.y1 - f.y0) * t, k % 2 ? m : l, h);
        }
        ctx.globalAlpha = 1;
        if (u < 0.6) for (let k = -2; k <= 2; k++) {
          const ox = -sa * k * 6, oy = ca * k * 6;
          const s0 = 0.1 + Math.abs(k) * 0.12 + u;
          line(ctx, f.x0 + (f.x1 - f.x0) * s0 + ox, f.y0 + (f.y1 - f.y0) * s0 + oy, f.x0 + (f.x1 - f.x0) * Math.min(1, s0 + 0.3) + ox, f.y0 + (f.y1 - f.y0) * Math.min(1, s0 + 0.3) + oy, k ? l : h);
        }
        return;
      }
      case "roll": {
        const side = f.x1 >= f.x0 ? 1 : -1;
        for (let k = 0; k < 3; k++) {
          const t = k / 3;
          if (u > t + 0.5) continue;
          const cx = f.x0 - side * (8 + k * 12), cy = f.y0 + 16;
          ring(ctx, cx, cy, 3 + (u - t) * 14, k ? "#a89880" : "#e8dcc4", 0.6, 2);
        }
        if (u < 0.5) for (let k = 0; k < 3; k++) {
          const a = u * 14 + k * 2.1;
          const r = 14;
          px(ctx, f.x0 + Math.cos(a) * r, f.y0 + 4 + Math.sin(a) * r * 0.8, k ? l : h);
          px(ctx, f.x0 + Math.cos(a - 0.3) * r, f.y0 + 4 + Math.sin(a - 0.3) * r * 0.8, m);
        }
        if (f.t < 0.03) for (let i = 0; i < 8; i++) this.mote(f.x0, f.y0 + 16, i % 2 ? "#a89880" : "#6a5a48", "earth", 50, 0.4, "px", -side * 30, -30);
        return;
      }
      case "blink": {
        if (u < 0.45) {
          const c = 1 - u / 0.45;
          for (let k = 0; k < 10; k++) {
            const a = k * 0.628 + u * 6;
            px(ctx, f.x0 + Math.cos(a) * (2 + c * 22), f.y0 + Math.sin(a) * (2 + c * 22) * 0.8, k % 2 ? l : h);
          }
          ctx.globalAlpha = c * 0.7;
          silhouette(ctx, f.x0, f.y0 + 4, d, m);
          ctx.globalAlpha = 1;
        }
        if (u < 0.6) {
          const n = Math.ceil(Math.hypot(f.x1 - f.x0, f.y1 - f.y0) / 10);
          for (let i = 0; i < n; i++) if ((i + Math.floor(clock * 30)) % 3 === 0) px(ctx, f.x0 + ((f.x1 - f.x0) * i) / n, f.y0 + ((f.y1 - f.y0) * i) / n, i % 2 ? l : m);
        }
        if (u > 0.15 && u < 0.7) {
          ring(ctx, f.x0, f.y0 + 20, 10 + (u - 0.15) * 20, l, 0.35, 2, clock * 4);
          star(ctx, f.x0, f.y0, 14 * (1 - u), f.pal, 8, clock * 3);
        }
        if (f.t < 0.03) this.kick = Math.max(this.kick, 2);
        return;
      }
      case "sigCast": return this.sigCast(ctx, f, u, clock);
      case "sigHit": return this.sigHit(ctx, f, u, clock);
      case "meteor": case "chain": case "vortex": case "pillar": case "nova": case "boomerang": case "barrage":
      case "fissure": case "sigil": case "spectral": case "wave": case "bloom": case "bomb": case "guard":
        return this.drawBespoke(ctx, f, u, clock);
      case "status": return this.statusFx(ctx, f, u, clock);
      case "orbiter": {
        const [x, y] = this.orbitPos(f, u);
        const a = f.accent ?? f.pal;
        px(ctx, x, y, a[3], 2);
        px(ctx, x - P, y, a[2]); px(ctx, x + 2 * P, y, a[2]); px(ctx, x, y - P, a[1]); px(ctx, x, y + 2 * P, a[1]);
        return;
      }
      case "evade": {
        const r = 6 + ease(u) * 22;
        ctx.globalAlpha = 1 - u;
        silhouette(ctx, f.x0 + (f.seed > 0.5 ? 1 : -1) * u * 14, f.y0, m, l);
        ctx.globalAlpha = 1;
        ring(ctx, f.x0, f.y0 + 14, r, u < 0.5 ? h : l, 0.9, 2, clock * 5);
        if (f.t < 0.03) for (let i = 0; i < 10; i++) this.mote(f.x0, f.y0 + 14, i % 2 ? h : l, "spirit", 120, 0.35, "spark");
        return;
      }
    }
  }

  private meteorPos(f: Fx, u: number): [number, number] {
    const e = Math.min(1, u * u * 1.15 + u * 0.1);
    return [f.x0 + (f.x1 - f.x0) * e, f.y0 + (f.y1 - f.y0) * e];
  }
  private arcPos(f: Fx, u: number, lift: number): [number, number] {
    return [f.x0 + (f.x1 - f.x0) * u, f.y0 + (f.y1 - f.y0) * u - Math.sin(u * Math.PI) * lift];
  }

  /** Draws the bespoke verse animations and ghost-ability effects. */
  private drawBespoke(ctx: C, f: Fx, u: number, clock: number) {
    const [d, m, l, h] = f.pal;
    const a = f.accent ?? f.pal;
    const big = f.big ?? 1;
    const rad = f.rad ?? 50;
    const born = f.t < 0.025;
    const ang = Math.atan2(f.y1 - f.y0, f.x1 - f.x0);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    switch (f.kind) {
      case "meteor": {
        // A burning rock drops out of the sky at a slant, trailing fire, its shadow growing below.
        const [x, y] = this.meteorPos(f, u);
        const sh = 4 + u * 14 * big;
        ctx.globalAlpha = 0.25 + u * 0.4;
        disc(ctx, f.x1, f.y1 + 10, sh, d, 0.35);
        ctx.globalAlpha = 1;
        const back = Math.atan2(f.y0 - f.y1, f.x0 - f.x1);
        for (let k = 1; k <= 7; k++) {
          const tx = x + Math.cos(back) * k * 6, ty = y + Math.sin(back) * k * 6;
          const w = Math.max(1, 4 - Math.floor(k / 2));
          px(ctx, tx - P, ty, k < 3 ? h : k < 5 ? l : m, w);
        }
        disc(ctx, x, y, 6 * big, m);
        disc(ctx, x - P, y - P, 4 * big, l);
        px(ctx, x - 2 * P, y - 2 * P, h, 2);
        for (let i = 0; i < 2; i++) this.mote(x, y, i ? h : l, f.type, 30, 0.45, "px", Math.cos(back) * 60, Math.sin(back) * 60);
        if (u > 0.94 && !(f as Fx & { landed?: boolean }).landed) {
          (f as Fx & { landed?: boolean }).landed = true;
          this.kick = Math.max(this.kick, 6);
          for (let i = 0; i < 18; i++) this.mote(f.x1, f.y1 + 6, i % 3 ? m : h, "earth", 200, 0.7, "px", 0, -90);
        }
        return;
      }
      case "chain": {
        // A jagged bolt that re-forks every frame, with a bright core and sparks along it.
        if (u > 0.85 && Math.floor(clock * 40) % 2) return;
        const amp = 6 + (1 - u) * 6;
        zig(ctx, f.x0, f.y0, f.x1, f.y1, m, amp + 3, 10);
        zig(ctx, f.x0, f.y0, f.x1, f.y1, l, amp, 8);
        zig(ctx, f.x0, f.y0, f.x1, f.y1, h, amp * 0.4, 6);
        if (Math.random() < 0.6) {
          const t = Math.random();
          this.mote(f.x0 + (f.x1 - f.x0) * t, f.y0 + (f.y1 - f.y0) * t, h, f.type, 80, 0.25, "spark");
        }
        star(ctx, f.x1, f.y1, 8 * (1 - u) + 3, f.pal, 6, clock * 5);
        return;
      }
      case "vortex": {
        // Spiral arms whirl inward and tighten, pulling motes into the eye; it pinches shut at the end.
        const close = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
        const R = rad * (0.55 + 0.45 * Math.min(1, u * 3)) * close;
        for (let arm = 0; arm < 4; arm++) {
          for (let k = 0; k < 14; k++) {
            const t = k / 14;
            const aa = clock * 7 + arm * (Math.PI / 2) + t * 4.2;
            const r = R * (1 - t);
            px(ctx, f.x0 + Math.cos(aa) * r, f.y0 + Math.sin(aa) * r * 0.5, t < 0.3 ? m : t < 0.7 ? l : h);
          }
        }
        ring(ctx, f.x0, f.y0, Math.max(2, R * 0.25), h, 0.5, 2, clock * 9);
        if (Math.random() < 0.8) {
          const aa = Math.random() * Math.PI * 2;
          this.mote(f.x0 + Math.cos(aa) * R, f.y0 + Math.sin(aa) * R * 0.5, l, "air", 4, 0.3, "spark", -Math.cos(aa) * R * 3, -Math.sin(aa) * R * 1.5);
        }
        return;
      }
      case "pillar": {
        // A glyph opens on the ground, then a column of the element erupts out of it and fades upward.
        const glyphR = rad * 0.55 * Math.min(1, u * 3);
        ring(ctx, f.x0, f.y0, glyphR, u < 0.35 ? h : l, 0.35, 0, clock * 2);
        ring(ctx, f.x0, f.y0, glyphR * 0.6, m, 0.35, 3, -clock * 3);
        if (u > 0.3) {
          const p = (u - 0.3) / 0.7;
          const hgt = 110 * big * Math.min(1, p * 3);
          const w = Math.max(2, (14 * big) * (1 - p * 0.7));
          for (let j = 0; j < hgt; j += P) {
            const fade = j / hgt;
            const ww = w * (1 - fade * 0.3) + Math.sin(clock * 20 + j * 0.3) * 1.5;
            px(ctx, f.x0 - ww, f.y0 - j, m);
            px(ctx, f.x0 + ww, f.y0 - j, m);
            if (j % (P * 2) === 0) line(ctx, f.x0 - ww + P, f.y0 - j, f.x0 + ww - P, f.y0 - j, fade < 0.5 ? l : h);
          }
          if (born || Math.random() < 0.4) this.mote(f.x0 + (Math.random() - 0.5) * w * 2, f.y0 - Math.random() * hgt, h, f.type, 20, 0.5, "spark", 0, -120);
          if (p < 0.08) this.kick = Math.max(this.kick, 3);
        }
        return;
      }
      case "nova": {
        // A double shockwave ring that rolls out to the verse's reach, kicking dust at its edge.
        const r = 6 + ease(u) * rad;
        if (u > 0.8 && Math.floor(clock * 30) % 2) return;
        ring(ctx, f.x0, f.y0, r, u < 0.4 ? h : l, 0.45, 0, clock);
        ring(ctx, f.x0, f.y0, r * 0.82, m, 0.45, 2, -clock);
        if (u < 0.5) ring(ctx, f.x0, f.y0, r * 0.6, l, 0.45, 3, clock * 2);
        if (born) this.kick = Math.max(this.kick, 2.5);
        if (Math.random() < 0.9) {
          const aa = Math.random() * Math.PI * 2;
          this.mote(f.x0 + Math.cos(aa) * r, f.y0 + Math.sin(aa) * r * 0.45, Math.random() < 0.5 ? l : h, f.type, 20, 0.35, "px", Math.cos(aa) * 40, -30);
        }
        return;
      }
      case "boomerang": {
        // A spinning crescent arcs out to the foe and curls back to the caster.
        const out = u < 0.5 ? u * 2 : 2 - u * 2;
        const side = Math.sin(u * Math.PI) * 26;
        const x = f.x0 + (f.x1 - f.x0) * ease(out) - sa * side;
        const y = f.y0 + (f.y1 - f.y0) * ease(out) + ca * side;
        const spin = clock * 26;
        for (let k = 0; k < 12; k++) {
          const t = spin + (k / 12) * Math.PI * 1.25;
          px(ctx, x + Math.cos(t) * 11 * big, y + Math.sin(t) * 11 * big, k < 4 ? h : k < 8 ? l : m, 2);
          px(ctx, x + Math.cos(t) * 7 * big, y + Math.sin(t) * 7 * big, m);
        }
        // A faint afterimage one spin behind.
        ctx.globalAlpha = 0.35;
        for (let k = 0; k < 8; k++) { const t = spin - 0.9 + (k / 8) * Math.PI; px(ctx, x - ca * 8 + Math.cos(t) * 10 * big, y - sa * 8 + Math.sin(t) * 10 * big, l); }
        ctx.globalAlpha = 1;
        this.mote(x, y, a[2], f.type, 10, 0.25, "px");
        return;
      }
      case "barrage": {
        // Shards rain from above onto a patch around the target, one after another, each with a splash.
        const n = 9;
        for (let i = 0; i < n; i++) {
          const start = (i / n) * 0.45;
          const lu = (u - start) / 0.25;
          if (lu < 0 || lu > 1.6) continue;
          const sx = f.x0 + (Math.sin(i * 12.9898 + f.seed * 7) * 0.5) * rad * 1.5;
          const sy = f.y0 + (Math.sin(i * 78.233 + f.seed * 3) * 0.5) * rad * 0.6;
          if (lu <= 1) {
            const y = sy - 120 * (1 - lu);
            line(ctx, sx + 6 * (1 - lu), y - 10, sx, y, l);
            px(ctx, sx, y, h, 2);
          } else {
            ring(ctx, sx, sy + 4, 3 + (lu - 1) * 14, lu < 1.3 ? h : m, 0.4, 2);
            if (lu < 1.05) for (let k = 0; k < 3; k++) this.mote(sx, sy, l, f.type, 60, 0.3, TRAIL[f.type] ?? "px", 0, -40);
          }
        }
        return;
      }
      case "fissure": {
        // A crack races along the ground to the foe, then rock spikes punch up along it.
        const reach = Math.min(1, u / 0.4);
        const n = Math.max(4, Math.ceil(Math.hypot(f.x1 - f.x0, f.y1 - f.y0) / 8));
        let lx = f.x0, ly = f.y0;
        for (let i = 1; i <= n * reach; i++) {
          const t = i / n;
          const j = Math.sin(i * 2.3 + f.seed * 9) * 4;
          const x = f.x0 + (f.x1 - f.x0) * t - sa * j, y = f.y0 + (f.y1 - f.y0) * t + ca * j;
          line(ctx, lx, ly, x, y, i % 3 ? d : m);
          lx = x; ly = y;
          if (u > 0.35) {
            const pu = (u - 0.35 - t * 0.2) / 0.4;
            if (pu > 0 && pu < 1 && i % 2 === 0) {
              const hh = (8 + (i % 4) * 4) * big * Math.sin(pu * Math.PI);
              for (let k = 0; k < hh; k += P) px(ctx, x, y - k, k > hh - 2 * P ? h : k > hh / 2 ? l : m);
              px(ctx, x - P, y - hh * 0.4, m);
            }
          }
        }
        if (u > 0.35 && u < 0.4) this.kick = Math.max(this.kick, 3);
        return;
      }
      case "sigil": {
        // A rotating circle of runes draws itself under the foe, glows hot, then detonates.
        const draw = Math.min(1, u / 0.5);
        const R = rad * 0.7;
        const segs = 28;
        for (let k = 0; k < segs * draw; k++) {
          const t = (k / segs) * Math.PI * 2 + clock * 1.5;
          px(ctx, f.x0 + Math.cos(t) * R, f.y0 + Math.sin(t) * R * 0.4, k % 4 ? l : h);
        }
        for (let k = 0; k < 5; k++) {
          const t0 = clock * -1 + (k / 5) * Math.PI * 2, t1 = t0 + (Math.PI * 4) / 5;
          if (k / 5 > draw) continue;
          line(ctx, f.x0 + Math.cos(t0) * R * 0.9, f.y0 + Math.sin(t0) * R * 0.36, f.x0 + Math.cos(t1) * R * 0.9, f.y0 + Math.sin(t1) * R * 0.36, a[2]);
        }
        if (u > 0.5 && u < 0.62) {
          const p = (u - 0.5) / 0.12;
          for (let k = 0; k < 12; k++) {
            const t = (k / 12) * Math.PI * 2;
            line(ctx, f.x0, f.y0 - 10, f.x0 + Math.cos(t) * R * p * 1.4, f.y0 - 10 + Math.sin(t) * R * p * 0.8, k % 2 ? h : l);
          }
          if (u < 0.53) this.kick = Math.max(this.kick, 5);
        }
        if (u > 0.55) ring(ctx, f.x0, f.y0, R * (1 + (u - 0.55) * 1.6), m, 0.4, 2);
        return;
      }
      case "spectral": {
        // Three ghostly hands claw up out of the ground around the foe and close on it.
        for (let k = 0; k < 3; k++) {
          const off = (k - 1) * 16;
          const rise = Math.sin(Math.min(1, u * 1.6) * Math.PI);
          const hx = f.x0 + off * (1 - Math.min(1, u * 1.4) * 0.5), hy = f.y0 - rise * (26 + k * 4);
          ctx.globalAlpha = 0.85 * rise;
          for (let j = 0; j < 22 * rise; j += P) px(ctx, hx + Math.sin(j * 0.3 + clock * 6 + k) * 1.5, f.y0 - j, j > 16 ? l : m);
          for (let fgr = 0; fgr < 4; fgr++) {
            const fa = -Math.PI / 2 + (fgr - 1.5) * 0.35 + (k - 1) * 0.3 * (1 - u);
            const len = 6 + (fgr % 2) * 3;
            line(ctx, hx, hy, hx + Math.cos(fa) * len, hy + Math.sin(fa) * len, fgr % 2 ? h : l);
          }
          ctx.globalAlpha = 1;
        }
        if (Math.random() < 0.5) this.mote(f.x0 + (Math.random() - 0.5) * 40, f.y0, l, "spirit", 10, 0.5, "px", 0, -40);
        return;
      }
      case "wave": {
        // A curling wall of water sweeps from the caster to the foe, foam spraying from its crest.
        const travel = (f.variant ?? 300) / 1000;
        const p = Math.min(1, f.t / travel);
        const x = f.x0 + (f.x1 - f.x0) * p, y = f.y0 + (f.y1 - f.y0) * p + 8;
        const wide = 14 + rad * 0.35;
        const fade = f.t > travel ? 1 - (f.t - travel) / 0.25 : 1;
        if (fade <= 0) return;
        ctx.globalAlpha = Math.max(0, fade);
        const depth = 18;
        for (let k = -wide; k <= wide; k += P) {
          // Each slice of the wall is a wedge: tallest at the front, curling forward at the top.
          const edge = Math.cos((k / wide) * Math.PI * 0.5);
          const hh = (14 + edge * 16) * big * (0.75 + 0.25 * Math.sin(clock * 10 + k * 0.25));
          const fx0 = x - sa * k, fy0 = y + ca * k * 0.45;
          for (let dd = 0; dd < depth; dd += P) {
            const col = hh * (1 - dd / (depth * 1.15));
            const bx = fx0 - ca * dd, by = fy0 - sa * dd * 0.45;
            for (let j = 0; j < col; j += P) {
              const curl = j > col * 0.7 ? ((j - col * 0.7) / (col * 0.3)) ** 2 * 6 : 0;
              px(ctx, bx + ca * curl, by - j, dd < P ? (j > col - 2 * P ? h : l) : j > col - 2 * P ? l : dd > depth * 0.6 ? d : m);
            }
          }
          if (Math.random() < 0.05) this.mote(fx0, fy0 - hh, h, f.type, 40, 0.4, "drop", ca * 40, -50);
        }
        ctx.globalAlpha = 1;
        return;
      }
      case "bloom": {
        // Petals (or thorns, shards, feathers) unfurl outward from the foe like a flower opening.
        const petals = 8;
        const open = ease(Math.min(1, u * 1.5));
        for (let k = 0; k < petals; k++) {
          const t = (k / petals) * Math.PI * 2 + u * 1.2;
          const r0 = 4, r1 = 4 + rad * 0.55 * open;
          const mx = f.x0 + Math.cos(t) * (r0 + r1) * 0.5, my = f.y0 + Math.sin(t) * (r0 + r1) * 0.25;
          if (u > 0.75 && (k + Math.floor(clock * 20)) % 2) continue;
          line(ctx, f.x0 + Math.cos(t) * r0, f.y0 + Math.sin(t) * r0 * 0.5, mx + Math.cos(t + 0.6) * 4, my, k % 2 ? l : a[2]);
          line(ctx, mx + Math.cos(t + 0.6) * 4, my, f.x0 + Math.cos(t) * r1, f.y0 + Math.sin(t) * r1 * 0.5, h);
          line(ctx, f.x0 + Math.cos(t) * r0, f.y0 + Math.sin(t) * r0 * 0.5, mx + Math.cos(t - 0.6) * 4, my, m);
        }
        px(ctx, f.x0 - P, f.y0 - P, h, 2);
        if (born) for (let i = 0; i < 10; i++) this.mote(f.x0, f.y0, i % 2 ? l : h, f.type, 90, 0.6, "flake");
        return;
      }
      case "bomb": {
        const [x, y] = this.arcPos(f, u, 70);
        disc(ctx, x, y, 6, m);
        disc(ctx, x - P, y - P, 3, l);
        px(ctx, x - P, y - 2 * P, h);
        ring(ctx, x, y, 8 + Math.sin(clock * 20) * 2, l, 1, 2, clock * 6);
        this.mote(x, y, l, f.type, 12, 0.35, "px");
        return;
      }
      case "guard": {
        const r = 18 + ease(u) * 10;
        if (u > 0.7 && Math.floor(clock * 30) % 2) return;
        ctx.globalAlpha = 0.25 * (1 - u);
        disc(ctx, f.x0, f.y0, r, l, 1.1);
        ctx.globalAlpha = 1;
        ring(ctx, f.x0, f.y0, r, h, 1.1, 0, clock * 3);
        ring(ctx, f.x0, f.y0, r - 4, m, 1.1, 3, -clock * 4);
        if (born) for (let i = 0; i < 12; i++) this.mote(f.x0, f.y0, i % 2 ? h : l, f.type, 100, 0.4, "spark");
        return;
      }
    }
  }

  private orbitPos(f: Fx, u: number): [number, number] {
    const [x, y] = this.pos(f, u);
    const dx = f.x1 - f.x0, dy = f.y1 - f.y0, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const mode = f.variant ?? 0;
    if (mode === 0) { const o = Math.sin(u * Math.PI * 6 + f.seed * 9) * 9; return [x + nx * o, y + ny * o]; }
    if (mode === 1) { const back = Math.max(0, u - 0.12); const [bx, by] = this.pos(f, back); const o = Math.sin(u * 20) * 4; return [bx + nx * o, by + ny * o - 6]; }
    const a = u * Math.PI * 8 + f.seed * 6;
    return [x + Math.cos(a) * 8, y + Math.sin(a) * 5];
  }

  /** Cast flourish at the caster (or around them for self verses). */
  private sigCast(ctx: C, f: Fx, u: number, clock: number) {
    const a = f.accent ?? f.pal;
    const [, m, l, h] = f.pal;
    const x = f.x0, y = f.y0;
    const big = f.big ?? 1;
    const ang = Math.atan2(f.y1 - f.y0, f.x1 - f.x0);
    const fade = u > 0.7 && Math.floor(clock * 30) % 2 === 0;
    if (fade) return;
    switch (f.variant) {
      case 0: ring(ctx, x, y + 10, 4 + ease(u) * 16 * big, u < 0.5 ? a[3] : a[2], 0.4, 2, clock * 4); break;
      case 1: star(ctx, x, y, (6 + 6 * big) * (1 - u * 0.6), a, 4, u * 3 + Math.PI / 4); break;
      case 2:
        for (let k = 0; k < 4; k++) {
          const t = clock * 3 + (k * Math.PI) / 2;
          const r = 10 + 4 * big;
          px(ctx, x + Math.cos(t) * r, y + Math.sin(t) * r * 0.5 + 6, k % 2 ? a[3] : l, 2);
        }
        ring(ctx, x, y + 6, 10 + 4 * big, a[1], 0.5, 3, -clock * 2);
        break;
      case 3:
        for (let k = 0; k < 6; k++) {
          const t = (k / 6) * Math.PI * 2 + f.seed * 4;
          const r0 = 4 + u * 10, r1 = r0 + 6 * big * (1 - u);
          line(ctx, x + Math.cos(t) * r0, y + Math.sin(t) * r0, x + Math.cos(t) * r1, y + Math.sin(t) * r1, k % 2 ? a[2] : h);
        }
        break;
      case 4:
        for (let k = 0; k < 2; k++) {
          const d = 6 + k * 7 + u * 12;
          const cx = x + Math.cos(ang) * d, cy = y + Math.sin(ang) * d;
          const nx = -Math.sin(ang), ny = Math.cos(ang);
          line(ctx, cx - Math.cos(ang) * 4 + nx * 5, cy - Math.sin(ang) * 4 + ny * 5, cx, cy, k ? a[2] : h);
          line(ctx, cx - Math.cos(ang) * 4 - nx * 5, cy - Math.sin(ang) * 4 - ny * 5, cx, cy, k ? a[2] : h);
        }
        break;
      default:
        for (let k = 0; k < 8; k++) {
          const t = clock * 6 + (k / 8) * Math.PI * 2;
          const r = (1 - u) * 18 * big;
          px(ctx, x + Math.cos(t) * r, y + Math.sin(t) * r * 0.6, k % 2 ? a[2] : m);
        }
    }
  }

  /** Impact flourish on top of the element's impact: a pillar, shockwave, shards, cross, sigil, implosion or spike crown. */
  private sigHit(ctx: C, f: Fx, u: number, clock: number) {
    const a = f.accent ?? f.pal;
    const [d, , l, h] = f.pal;
    const x = f.x0, y = f.y0;
    const big = f.big ?? 1;
    const born = f.t < 0.025;
    switch (f.variant) {
      case 0: {
        const hgt = 40 * big * (u < 0.3 ? u / 0.3 : 1 - (u - 0.3) / 0.7);
        for (let j = 0; j < hgt; j += P) { px(ctx, x - P, y + 8 - j, j > hgt * 0.7 ? a[3] : a[2]); px(ctx, x + P, y + 8 - j, l); }
        break;
      }
      case 1:
        ring(ctx, x, y + 8, 6 + ease(u) * 26 * big, u < 0.4 ? a[3] : a[1], 0.35, 3, 0);
        if (u > 0.15) ring(ctx, x, y + 8, 4 + ease(u - 0.15) * 18 * big, l, 0.35, 2, 0);
        break;
      case 2:
        if (born) for (let i = 0; i < 8 + big * 4; i++) this.mote(x, y, i % 2 ? a[3] : a[2], f.type, 150 * big, 0.45, "spark");
        break;
      case 3:
        if (u < 0.6) {
          const r = 10 * big * (0.6 + u);
          line(ctx, x - r, y - r, x + r, y + r, u < 0.3 ? h : a[2]);
          line(ctx, x - r, y + r, x + r, y - r, u < 0.3 ? h : a[2]);
        }
        break;
      case 4: {
        const sides = 6, r = 16 * big;
        for (let k = 0; k < sides; k++) {
          const t0 = clock + (k / sides) * Math.PI * 2, t1 = clock + ((k + 1) / sides) * Math.PI * 2;
          if (u > 0.6 && k % 2) continue;
          line(ctx, x + Math.cos(t0) * r, y + 8 + Math.sin(t0) * r * 0.35, x + Math.cos(t1) * r, y + 8 + Math.sin(t1) * r * 0.35, k % 2 ? a[2] : l);
        }
        break;
      }
      case 5:
        for (let k = 0; k < 10; k++) {
          const t = (k / 10) * Math.PI * 2 + f.seed * 5;
          const r = (1 - ease(u)) * 28 * big;
          px(ctx, x + Math.cos(t) * r, y + Math.sin(t) * r * 0.7, k % 2 ? a[3] : l);
        }
        break;
      default:
        for (let k = 0; k < 5; k++) {
          const sx = x + (k - 2) * 6 * big;
          const hgt = (k === 2 ? 18 : 10 + (k % 2) * 4) * big * (u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 0.75);
          for (let j = 0; j < hgt; j += P) px(ctx, sx, y + 10 - j, j > hgt - 2 * P ? a[3] : j > hgt / 2 ? a[2] : d);
        }
    }
  }

  /** Shows what the verse does to its target: sleep Zs, roots, silence rune, burn, soak, gloom, exposed reticle, sparks, drain. */
  private statusFx(ctx: C, f: Fx, u: number, clock: number) {
    const eff = f.effect ?? "";
    const p = STATUS_PAL[eff];
    if (!p) return;
    const [d, m, l, h] = p;
    const x = f.x0, y = f.y0;
    const born = f.t < 0.025;
    const blink = u > 0.75 && Math.floor(clock * 24) % 2 === 0;
    if (blink) return;
    switch (eff) {
      case "sleep":
        for (let k = 0; k < 3; k++) {
          const v = (u * 1.2 + k * 0.28) % 1;
          const zx = x + 8 + k * 5 + Math.sin(clock * 3 + k) * 2, zy = y - 14 - v * 26;
          const c = v < 0.5 ? h : l;
          for (let i = 0; i < 3; i++) { px(ctx, zx + i * P, zy, c); px(ctx, zx + i * P, zy + 4 * P, c); }
          px(ctx, zx + 2 * P, zy + P, c); px(ctx, zx + P, zy + 2 * P, c); px(ctx, zx, zy + 3 * P, c);
        }
        ring(ctx, x, y - 2, 12, m, 0.5, 3, clock * 2);
        break;
      case "root":
        for (let k = 0; k < 5; k++) {
          const sx = x - 12 + k * 6;
          const hgt = 18 * Math.min(1, u * 4) * (0.6 + (k % 3) * 0.2);
          for (let j = 0; j < hgt; j += P) px(ctx, sx + Math.sin(j * 0.3 + k) * 3, y + 12 - j, j > hgt - 2 * P ? l : j % (3 * P) === 0 ? m : d);
        }
        if (born) for (let i = 0; i < 6; i++) this.mote(x, y + 10, i % 2 ? l : m, "earth", 70, 0.4, "px", 0, -40);
        break;
      case "silence": {
        const r = 11;
        ring(ctx, x, y - 22, r, l, 1, 0, 0);
        line(ctx, x - r * 0.7, y - 22 + r * 0.7, x + r * 0.7, y - 22 - r * 0.7, h);
        ring(ctx, x, y - 22, r - 4, m, 1, 2, clock * 3);
        break;
      }
      case "burn":
        for (let k = 0; k < 6; k++) {
          const t = clock * 4 + (k / 6) * Math.PI * 2;
          const fx = x + Math.cos(t) * 12, fy = y + 6 + Math.sin(t) * 4;
          const hgt = (4 + ((k * 7 + Math.floor(clock * 20)) % 3) * 2) * (1 - u * 0.5);
          for (let j = 0; j < hgt; j += P) px(ctx, fx, fy - j, j > hgt - 2 * P ? h : j > P ? l : m);
        }
        break;
      case "soak":
        ring(ctx, x, y + 10, 6 + ease(u) * 16, u < 0.5 ? h : l, 0.35, 2);
        if (born) for (let i = 0; i < 8; i++) this.mote(x, y - 10, i % 2 ? l : h, "water", 60, 0.5, "drop", 0, 20);
        break;
      case "gloom":
        for (let k = 0; k < 6; k++) {
          const v = (u + k / 6) % 1;
          const gx = x + Math.sin(k * 2.3 + clock) * 12, gy = y + 4 - v * 22;
          disc(ctx, gx, gy, 3 + (1 - v) * 3, v < 0.5 ? m : d);
        }
        break;
      case "expose": {
        const r = 22 - ease(u) * 10;
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          const cx = x + sx * r, cy = y - 6 + sy * r * 0.8;
          line(ctx, cx, cy, cx - sx * 6, cy, u < 0.5 ? h : l);
          line(ctx, cx, cy, cx, cy - sy * 6, u < 0.5 ? h : l);
        }
        px(ctx, x, y - 6, m, 2);
        break;
      }
      case "spark":
        if (Math.floor(clock * 20) % 3 !== 0) for (let k = 0; k < 2; k++) {
          const t = clock * 7 + k * Math.PI;
          zig(ctx, x + Math.cos(t) * 14, y - 4 + Math.sin(t) * 10, x - Math.cos(t) * 10, y - 10 - Math.sin(t) * 8, k ? l : h, 3, 5);
        }
        break;
      case "leech":
      case "drain":
        // Red motes stream from the target back to the caster.
        for (let k = 0; k < 6; k++) {
          const v = Math.min(1, Math.max(0, u * 1.4 - k * 0.08));
          if (v <= 0 || v >= 1) continue;
          const bx = x + (f.x1 - x) * ease(v), by = y + (f.y1 - y) * ease(v) - Math.sin(v * Math.PI) * 16;
          px(ctx, bx, by, k % 2 ? l : h, 2);
        }
        break;
      case "cleanse":
        for (let k = 0; k < 8; k++) {
          const v = (u + k / 8) % 1;
          star(ctx, x + Math.sin(k * 2.1) * 14, y - v * 30, 3 + (1 - v) * 2, p, 4, clock * 2);
        }
        break;
      case "shell": {
        const r = 18 + Math.sin(u * Math.PI) * 3;
        for (let k = 0; k < 6; k++) {
          const t0 = (k / 6) * Math.PI * 2 + Math.PI / 6, t1 = ((k + 1) / 6) * Math.PI * 2 + Math.PI / 6;
          line(ctx, x + Math.cos(t0) * r, y - 14 + Math.sin(t0) * r, x + Math.cos(t1) * r, y - 14 + Math.sin(t1) * r, k % 2 ? l : h);
        }
        break;
      }
    }
  }

  private slash(ctx: C, f: Fx, u: number, ang: number) {
    const [d, m, l, h] = f.pal;
    const big = f.big ?? 1;
    const dir = f.dir ?? 1;
    const tilt = f.tilt ?? 0.8;
    const r = (16 + f.seed * 6) * big;
    const span = 2.1 + f.seed * 0.7;
    const head = ease(u * 1.5) * span;
    const tail = Math.max(0, head - 1.3 - (u > 0.65 ? (u - 0.65) * 6 : 0));
    const cx = f.x0 + Math.cos(ang) * 8, cy = f.y0 + Math.sin(ang) * 8;
    const steps = 18;
    const at = (a: number, rr: number): [number, number] => {
      const lx = Math.cos(a) * rr, ly = Math.sin(a) * rr * tilt;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      return [cx + lx * ca - ly * sa, cy + lx * sa + ly * ca];
    };
    if (head <= tail) return;
    for (let k = 0; k <= steps; k++) {
      const s = k / steps;
      const a = dir * (-span / 2 + tail + (head - tail) * s);
      const thick = Math.max(1, Math.round(1 + s * 3 * big));
      for (let j = 0; j < thick; j++) {
        const [x, y] = at(a, r - j * P);
        px(ctx, x, y, j === 0 ? (s > 0.75 ? h : s > 0.4 ? l : m) : j === thick - 1 ? d : s > 0.6 ? l : m);
      }
    }
    const [hx, hy] = at(dir * (-span / 2 + head), r);
    if (u < 0.7) {
      px(ctx, hx - P / 2, hy - P / 2, h, 2);
      if (f.type === "fire" && Math.random() < 0.8) this.mote(hx, hy, Math.random() > 0.5 ? l : h, "fire", 30, 0.35);
      else if (f.type === "ice" && Math.random() < 0.5) this.mote(hx, hy, h, "ice", 20, 0.6, "flake");
      else if (f.type === "electric" && Math.random() < 0.6) zig(ctx, hx, hy, hx + (Math.random() - 0.5) * 18, hy + (Math.random() - 0.5) * 18, h, 3, 5);
      else if (f.type === "void") px(ctx, hx + (Math.random() - 0.5) * 8, hy + (Math.random() - 0.5) * 8, d, 2);
      else if ((f.quality ?? 0) >= 3 && Math.random() < 0.5) this.mote(hx, hy, l, f.type, 30, 0.3, "spark");
    }
  }

  private proj(ctx: C, f: Fx, u: number, ang: number, clock: number) {
    const [d, m, l, h] = f.pal;
    const s = f.big ?? 1;
    const [x, y] = this.pos(f, u);
    const [bx, by] = this.pos(f, Math.max(0, u - 0.06));
    const a = Math.atan2(y - by, x - bx) || ang;
    const ca = Math.cos(a), sa = Math.sin(a);
    const fl = Math.floor(clock * 30);
    switch (f.shape) {
      case "comet": {
        for (let k = 6; k >= 1; k--) {
          const w = Math.sin(clock * 40 + k * 1.7) * k * 0.6;
          const tx = x - ca * k * 4 * s - sa * w, ty = y - sa * k * 4 * s + ca * w;
          px(ctx, tx, ty, k > 4 ? d : k > 2 ? m : l, k > 3 ? 1 : 2);
        }
        disc(ctx, x, y, 3 * s + 1, m);
        disc(ctx, x, y, 2 * s + 1, l);
        px(ctx, x - P / 2, y - P / 2, h, 2);
        return;
      }
      case "drop": {
        disc(ctx, x, y, 3 * s + 1, m);
        disc(ctx, x + ca * P, y + sa * P, 2 * s, l);
        px(ctx, x - P, y - P * 1.5, h);
        for (let k = 1; k <= 3; k++) px(ctx, x - ca * (k * 4 + 3), y - sa * (k * 4 + 3), k === 1 ? l : m);
        return;
      }
      case "boulder": {
        const rot = clock * 10 + f.seed * 6;
        const r = 4 * s + 2;
        disc(ctx, x, y, r, d);
        disc(ctx, x, y, r - P, m);
        px(ctx, x + Math.cos(rot) * (r - 3), y + Math.sin(rot) * (r - 3), l, 2);
        px(ctx, x + Math.cos(rot + 2.4) * (r - 3), y + Math.sin(rot + 2.4) * (r - 3), d);
        px(ctx, x - P, y - r + P, h);
        return;
      }
      case "gust": {
        for (let k = 0; k < 3; k++) {
          const off = k * 6;
          const cx = x - ca * off, cy = y - sa * off;
          const rr = 6 * s - k;
          for (let i = -3; i <= 3; i++) {
            const t = (i / 3) * 1.1;
            px(ctx, cx + Math.cos(a + Math.PI + t) * -rr * 0.5 - sa * Math.sin(t) * rr, cy + Math.sin(a + Math.PI + t) * -rr * 0.5 + ca * Math.sin(t) * rr, k === 0 ? (Math.abs(i) < 2 ? h : l) : k === 1 ? l : m);
          }
        }
        return;
      }
      case "spark": {
        px(ctx, x - P / 2, y - P / 2, h, 2);
        for (let k = 0; k < 3; k++) {
          const aa = Math.random() * Math.PI * 2;
          zig(ctx, x, y, x + Math.cos(aa) * 10 * s, y + Math.sin(aa) * 10 * s, k ? l : h, 2, 4);
        }
        return;
      }
      case "shard": {
        const len = 12 * s, wid = 3 * s;
        for (let t = -len * 0.4; t <= len; t += P) {
          const half = wid * (1 - Math.abs((t - len * 0.3) / (len * 0.7)));
          for (let w = -half; w <= half; w += P) px(ctx, x + ca * t - sa * w, y + sa * t + ca * w, Math.abs(w) < P ? h : w < 0 ? l : m);
        }
        if (fl % 6 < 2) star(ctx, x + ca * len, y + sa * len, 6, f.pal, 4, Math.PI / 4);
        return;
      }
      case "orb": {
        disc(ctx, x, y, 4 * s + 1, m);
        disc(ctx, x, y, 3 * s, d);
        for (let k = 0; k < 3; k++) {
          const aa = clock * 9 + (k * Math.PI * 2) / 3;
          px(ctx, x + Math.cos(aa) * (6 * s + 2), y + Math.sin(aa) * (4 * s + 1), k ? l : h);
        }
        px(ctx, x - P / 2, y - P / 2, l);
        return;
      }
      case "lance": {
        line(ctx, x - ca * 18 * s, y - sa * 18 * s, x, y, l);
        line(ctx, x - ca * 12 * s - sa * P, y - sa * 12 * s + ca * P, x, y, m);
        line(ctx, x - ca * 12 * s + sa * P, y - sa * 12 * s - ca * P, x, y, m);
        star(ctx, x, y, 7 + (fl % 4), f.pal, 4, Math.PI / 4 * (fl % 2));
        return;
      }
      case "wisp": {
        for (let k = 7; k >= 0; k--) {
          const tx = x - ca * k * 3 + Math.sin(clock * 16 + k * 0.9) * k * 0.7 * -sa, ty = y - sa * k * 3 + Math.sin(clock * 16 + k * 0.9) * k * 0.7 * ca;
          px(ctx, tx, ty, k === 0 ? h : k < 3 ? l : k < 5 ? m : d);
        }
        disc(ctx, x, y, 2 * s + 1, l);
        px(ctx, x - P, y - P, d); px(ctx, x + P, y - P, d);
        return;
      }
      case "blob": {
        disc(ctx, x, y, 3 * s + 2, d);
        disc(ctx, x, y - P, 3 * s, m);
        px(ctx, x - P, y - P * 2, l); px(ctx, x + P, y - P * 2, l);
        if (fl % 3 === 0) this.mote(x + (Math.random() - 0.5) * 6, y + 4, m, "ghoul", 4, 0.4, "drop");
        return;
      }
      case "coin":
        px(ctx, x - P / 2, y - P / 2, fl % 4 < 2 ? h : l, 2);
        if (fl % 4 < 2) px(ctx, x - P, y - P, m, 1);
        return;
      default: {
        const rot = clock * 20;
        for (let k = 0; k < 4; k++) {
          const aa = rot + (k * Math.PI) / 2;
          line(ctx, x, y, x + Math.cos(aa) * 5 * s, y + Math.sin(aa) * 5 * s, k % 2 ? m : l);
        }
        px(ctx, x - P / 2, y - P / 2, h);
      }
    }
  }

  private beam(ctx: C, f: Fx, u: number, ang: number, clock: number) {
    const [d, m, l, h] = f.pal;
    const w = u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 0.75;
    const sa = Math.sin(ang), ca = Math.cos(ang);
    if (f.type === "electric") {
      zig(ctx, f.x0, f.y0, f.x1, f.y1, h, 6 * w + 2, 10);
      if (w > 0.4) zig(ctx, f.x0, f.y0, f.x1, f.y1, l, 9, 12);
      for (let b = 0; b < 2; b++) {
        const t = 0.3 + Math.random() * 0.5;
        const bx = f.x0 + (f.x1 - f.x0) * t, by = f.y0 + (f.y1 - f.y0) * t;
        const ba = ang + (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.6);
        zig(ctx, bx, by, bx + Math.cos(ba) * 18, by + Math.sin(ba) * 18, b ? m : l, 3, 5);
      }
    } else {
      const len = Math.hypot(f.x1 - f.x0, f.y1 - f.y0);
      const steps = Math.ceil(len / P);
      const core = f.type === "void" ? d : h;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const pulse = Math.sin(i * 0.5 - clock * 30) > 0.6;
        const x = f.x0 + (f.x1 - f.x0) * t, y = f.y0 + (f.y1 - f.y0) * t;
        px(ctx, x, y, core);
        if (w > 0.3) { px(ctx, x - sa * P, y + ca * P, pulse ? h : l); px(ctx, x + sa * P, y - ca * P, pulse ? h : l); }
        if (w > 0.65) { px(ctx, x - sa * P * 2, y + ca * P * 2, m); px(ctx, x + sa * P * 2, y - ca * P * 2, m); }
        if (f.type === "light" && w > 0.6 && i % 14 === Math.floor(clock * 40) % 14) ring(ctx, x, y, 6, h, 1.4, 2, ang);
      }
    }
    star(ctx, f.x0, f.y0, 6 + 6 * w, f.pal, 4, clock * 4);
    if (Math.random() < 0.7) this.mote(f.x1, f.y1, l, f.type, 90, 0.3, "spark");
  }

  private impact(ctx: C, f: Fx, u: number, clock: number) {
    const [d, m, l, h] = f.pal;
    const big = f.big ?? 1;
    const x = f.x0, y = f.y0;
    const r = (6 + ease(u) * 16) * big;
    const born = f.t < 0.025;
    if (u < 0.3) star(ctx, x, y, (10 + 8 * big) * (1 - u), f.pal, f.type === "electric" || f.type === "ice" ? 6 : f.type === "light" ? 8 : 4, f.seed * 3);
    switch (f.type) {
      case "fire":
        for (let k = 0; k < 7; k++) {
          const fx = x + (k - 3) * 4 * big;
          const hgt = (8 + ((k * 13 + Math.floor(clock * 24)) % 5) * 3) * big * (1 - u);
          for (let j = 0; j < hgt; j += P) px(ctx, fx + Math.sin(clock * 30 + j) * 1.5, y + 6 - j, j > hgt * 0.65 ? h : j > hgt * 0.3 ? l : m);
        }
        if (born) for (let i = 0; i < 10 + big * 6; i++) this.mote(x, y, i % 3 ? l : h, "fire", 120 * big, 0.55, i % 4 ? "px" : "spark", 0, -50);
        break;
      case "water":
        ring(ctx, x, y + 8, r * 1.2, u < 0.5 ? h : l, 0.3, u > 0.6 ? 2 : 0);
        ring(ctx, x, y + 8, r * 0.7, m, 0.3, 2);
        if (born) for (let i = 0; i < 12 + big * 4; i++) this.mote(x, y, i % 2 ? h : l, "water", 80 * big, 0.6, "drop", 0, -90 - Math.random() * 60);
        break;
      case "earth":
        for (let k = 0; k < 5; k++) {
          const a = k * 1.26 + f.seed * 6;
          line(ctx, x, y + 8, x + Math.cos(a) * r * 1.1, y + 8 + Math.sin(a) * r * 0.4, d);
        }
        ring(ctx, x, y + 6, r, u < 0.5 ? l : m, 0.45, 2);
        if (born) { for (let i = 0; i < 10 + big * 4; i++) this.mote(x, y, i % 3 ? m : l, "earth", 110 * big, 0.6, "px", 0, -100); this.kick = Math.max(this.kick, 2.5 * big); }
        break;
      case "air":
        for (let k = 0; k < 3; k++) ring(ctx, x, y, r * (0.5 + k * 0.3), k ? l : h, 0.7, 3, clock * (6 + k * 2) * (k % 2 ? -1 : 1));
        if (born) for (let i = 0; i < 8; i++) this.mote(x, y, i % 2 ? l : m, "air", 140, 0.45, "spark");
        break;
      case "electric":
        if (u < 0.7) for (let k = 0; k < 4; k++) {
          const a = Math.random() * Math.PI * 2;
          zig(ctx, x, y, x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r, k % 2 ? l : h, 3, 5);
        }
        if (born) for (let i = 0; i < 10; i++) this.mote(x, y, h, "electric", 180, 0.3, "spark");
        break;
      case "ice":
        for (let k = 0; k < 6; k++) {
          const sx = x + (k - 2.5) * 5 * big;
          const hgt = (6 + ((k * 7) % 4) * 4) * big * Math.min(1, u * 5) * (u > 0.7 ? (1 - u) / 0.3 : 1);
          for (let j = 0; j < hgt; j += P) px(ctx, sx + (j > hgt * 0.7 ? 0 : (k % 2 ? P : -P) * 0.5), y + 8 - j, j > hgt - P * 2 ? h : k % 2 ? l : m);
        }
        if (born) for (let i = 0; i < 10; i++) this.mote(x, y, i % 2 ? h : l, "ice", 90, 0.8, "flake", 0, -40);
        break;
      case "void": {
        const rr = (1 - ease(u * 1.4)) * 24 * big + 2;
        ring(ctx, x, y, rr, u < 0.6 ? l : h, 0.8, 0, clock * 6);
        ring(ctx, x, y, rr * 0.6, m, 0.8, 2, -clock * 8);
        if (u > 0.6) disc(ctx, x, y, (u - 0.6) * 30 * big, d);
        if (u > 0.7 && u < 0.78) for (let i = 0; i < 8; i++) this.mote(x, y, i % 2 ? h : l, "void", 160, 0.4, "spark");
        break;
      }
      case "light":
        if (u < 0.6) {
          const hh = 40 * big * (1 - u);
          for (let j = 0; j < hh; j += P) { px(ctx, x, y - j, j % 4 ? h : l); if (u < 0.3) { px(ctx, x - P, y - j, l); px(ctx, x + P, y - j, l); } }
        }
        ring(ctx, x, y + 6, r, h, 0.4, 2, clock * 3);
        if (born) for (let i = 0; i < 8; i++) this.mote(x, y, h, "light", 80, 0.6, "spark", 0, -60);
        break;
      case "spirit":
        ring(ctx, x, y, r, u < 0.5 ? h : l, 0.7, 3, clock * 2);
        for (let k = 0; k < 4; k++) {
          const a = clock * 5 + k * 1.57;
          const rr = r * (1 - u * 0.5);
          px(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6 - u * 20, k % 2 ? l : h, 2);
        }
        if (born) for (let i = 0; i < 8; i++) this.mote(x, y, l, "spirit", 60, 0.7, "px", 0, -30);
        break;
      case "ghoul":
        disc(ctx, x, y + 8, Math.max(P, (1 - u) * 8 * big), m, 0.4);
        for (let k = 0; k < 6; k++) {
          const a = k * 1.05 + f.seed * 3;
          px(ctx, x + Math.cos(a) * r, y + 6 + Math.sin(a) * r * 0.4, k % 2 ? d : m, 2);
        }
        if (born) for (let i = 0; i < 10; i++) this.mote(x, y, i % 2 ? m : l, "ghoul", 100, 0.6, "drop", 0, -80);
        break;
      default:
        ring(ctx, x, y, r, u < 0.5 ? l : m, 0.7, u > 0.6 ? 2 : 0, clock);
        if (u > 0.2 && u < 0.6) ring(ctx, x, y, r * 0.6, h, 0.7, 3);
        if (born) for (let i = 0; i < 6 + big * 4; i++) this.mote(x, y, i % 3 ? l : m, f.type, 120 * big, 0.45);
    }
    if (f.burst && u < 0.5) ring(ctx, x, y, 8 + ease(u * 2) * 36 * big, h, 0.6, 2, -clock);
  }

  private slam(ctx: C, f: Fx, u: number) {
    const [d, m, l, h] = f.pal;
    const big = f.big ?? 1;
    const x = f.x0, y = f.y0 + 6;
    const r = 8 + ease(u) * 40 * big;
    ring(ctx, x, y, r, u < 0.5 ? h : l, 0.42);
    ring(ctx, x, y, r * 0.72, m, 0.42, 2);
    if (u < 0.15) star(ctx, x, y - 10, 24 * big, f.pal, 8);
    for (let k = 0; k < 7; k++) {
      const a = k * 0.9 + f.seed * 6;
      line(ctx, x, y, x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.35, d);
    }
    const n = 6;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + f.seed;
      const sx = x + Math.cos(a) * r * 0.8, sy = y + Math.sin(a) * r * 0.32;
      const life = Math.max(0, 1 - Math.abs(u - 0.35) / 0.3);
      const hgt = (f.type === "fire" ? 18 : f.type === "ice" ? 16 : f.type === "earth" ? 12 : 8) * big * life;
      for (let j = 0; j < hgt; j += P) {
        const c = j > hgt - P * 2 ? h : j > hgt * 0.5 ? l : m;
        if (f.type === "earth") { px(ctx, sx - P, sy - j, c); px(ctx, sx, sy - j, j > hgt - P * 2 ? l : m); px(ctx, sx + P, sy - j, d); }
        else px(ctx, sx + (f.type === "fire" ? Math.sin(j + u * 40) * 1.5 : 0), sy - j, c);
      }
    }
    if (f.t < 0.03) {
      for (let i = 0; i < 18; i++) this.mote(x, y, i % 2 ? l : d, f.type, 200, 0.65, TRAIL[f.type] === "ring" ? "drop" : "px", 0, -90);
      this.kick = Math.max(this.kick, 5 * big);
    }
  }
}
