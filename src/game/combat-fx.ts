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
type Kind = "slash" | "thrust" | "proj" | "beam" | "impact" | "ward" | "heal" | "surge" | "trail" | "roll" | "blink" | "slam" | "rune" | "evade" | "flash";
type Fx = {
  kind: Kind; x0: number; y0: number; x1: number; y1: number; t: number; dur: number; pal: Pal; type: TypeId; seed: number;
  shape?: Shape; big?: number; dir?: number; tilt?: number; impact?: Fx; quality?: number; burst?: boolean;
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

export class CombatFx {
  list: Fx[] = [];
  motes: Mote[] = [];
  /** Screen shake requested by big impacts; the engine drains it each tick. */
  kick = 0;

  mote(x: number, y: number, c: string, type: TypeId, spread = 40, life = 0.5, k: MoteKind = "px", vx = 0, vy = 0) {
    if (this.motes.length > 520) return;
    this.motes.push({ x, y, vx: vx + (Math.random() - 0.5) * spread, vy: vy + (Math.random() - 0.5) * spread * 0.7, life, max: life, c, g: RISE[type] ?? 0, k, drag: k === "spark" ? 0.9 : 0.95 });
  }

  /** Each verse gets its own recipe from tactic, form, element, effect and an id hash. */
  cast(move: Move, form: string, tactic: string, x0: number, y0: number, x1: number, y1: number) {
    const type = move.type;
    const pal = PAL[type] ?? PAL.normal;
    const seed = hash(move.id);
    const big = 0.75 + Math.min(1.1, move.power / 60);
    const tilt = 0.5 + ((seed * 7) % 1) * 0.5;
    const base = { x0, y0, x1, y1, t: 0, pal, type, seed, big, tilt };
    const impact: Fx = { ...base, kind: "impact", dur: 0.38 + big * 0.1, x0: x1, y0: y1 };
    const key = (move.id + " " + move.name).toLowerCase();
    const add = (f: Fx) => this.list.push(f);
    if (tactic === "ward") return add({ ...base, kind: "ward", dur: 1 });
    if (tactic === "heal" || move.effect === "mend") return add({ ...base, kind: "heal", dur: 1 });
    if (tactic === "surge") return add({ ...base, kind: "surge", dur: 0.85 });
    if (tactic === "dash") return add({ ...base, kind: "trail", dur: 0.5 });
    if (tactic === "roll") return add({ ...base, kind: "roll", dur: 0.5 });
    if (tactic === "blink") {
      add({ ...base, kind: "blink", dur: 0.45 });
      return add({ ...impact, t: -0.06, big: big * 0.8 });
    }
    if (tactic === "heavy") {
      add({ ...base, kind: "slash", dur: 0.26, dir: seed > 0.5 ? 1 : -1, big: big * 1.35, tilt: 0.45 });
      return add({ ...base, kind: "slam", dur: 0.7, x0: x1, y0: y1, t: -0.12 });
    }
    if (tactic === "channel") {
      add({ ...base, kind: "rune", dur: 1, x1: x0, y1: y0 + 20 });
      if (type === "light" || type === "electric" || type === "void" || seed > 0.55) return add({ ...base, kind: "beam", dur: 0.5, t: -0.4, impact: { ...impact, big: big * 1.35, burst: true } });
      return add({ ...base, kind: "proj", shape: SHAPE[type], dur: 0.34, t: -0.4, big: big * 1.5, impact: { ...impact, big: big * 1.45, burst: true } });
    }
    if (form === "melee" || tactic === "lunge") {
      if (THRUST.test(key)) {
        add({ ...base, kind: "thrust", dur: 0.22 });
        return add({ ...impact, t: -0.06, big: big * 0.85 });
      }
      const count = MULTI.test(key) ? 3 : seed > 0.66 ? 2 : 1;
      for (let i = 0; i < count; i++) add({ ...base, kind: "slash", dur: 0.22, t: -i * 0.09, dir: i % 2 ? -1 : 1, tilt: i % 2 ? tilt * 0.7 : tilt, big: big * (1 - i * 0.08) });
      return add({ ...impact, t: -0.06, big: big * 0.8 });
    }
    if (type === "electric" || move.id === "dawn" || move.id === "focuslance") return add({ ...base, kind: "beam", dur: 0.32, impact });
    const shape: Shape = move.id === "cointoss" ? "coin" : SHAPE[type];
    const n = VOLLEY.test(key) ? 3 : 1;
    const dist = Math.hypot(x1 - x0, y1 - y0);
    add({ ...base, kind: "flash", dur: 0.14, x1: x0, y1: y0 });
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 16;
      add({ ...base, kind: "proj", shape, dur: Math.max(0.14, dist / (type === "earth" ? 420 : 600)), t: -i * 0.07, x1: x1 + off * 0.3, y1: y1 + off, impact: { ...impact, x0: x1 + off * 0.3, y0: y1 + off, big: big * (n > 1 ? 0.6 : 1) } });
    }
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
      if (f.t >= f.dur) done.push(f);
      else if (f.t > 0 && f.kind === "proj") {
        const [x, y] = this.pos(f, f.t / f.dur);
        const back = Math.atan2(f.y0 - f.y1, f.x0 - f.x1);
        const k = TRAIL[f.type];
        for (let i = 0; i < 2; i++) this.mote(x, y, f.pal[1 + ((i + Math.floor(f.t * 30)) % 3)], f.type, k === "spark" ? 30 : 22, k === "flake" ? 0.6 : 0.35, k, Math.cos(back) * 40, Math.sin(back) * 40);
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
    for (const f of this.list) if (f.t >= 0 && (f.kind === "impact" || f.kind === "flash" || f.kind === "beam" || f.kind === "slam")) this.glowFx(ctx, f);
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
