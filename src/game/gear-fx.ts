import type { TypeId } from "./content";
import { P, PAL, px } from "./combat-fx";

type Piece = { slot: string; style: number; type: TypeId; fxSeed: number; quality: number };
type Actor = { x: number; y: number; pieces: Piece[]; walk: number; facing: number };

// Sprite-local anchors on the 16x18 frame (bottom-center origin, before scale).
const ANCHOR: Record<string, [number, number]> = {
  head: [0, -16], chest: [0, -10], legs: [0, -5], feet: [0, -1], weapon: [7, -8], relic: [-7, -9],
};
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Gear power: rarer, stronger pieces stack into a bigger aura. */
export function gearPower(pieces: Piece[]): number {
  return pieces.reduce((n, p) => n + Math.max(0, p.quality - 1) ** 1.6, 0);
}

function dotRing(ctx: CanvasRenderingContext2D, r: number, c: string, rot: number, gap: number) {
  const n = Math.max(10, Math.floor((r * 6.3) / P));
  for (let i = 0; i < n; i++) {
    if (gap && Math.floor(i / gap) % 2) continue;
    const a = (i / n) * Math.PI * 2 + rot;
    px(ctx, Math.cos(a) * r, Math.sin(a) * r * 0.38, c);
  }
}

/** Element signature around the wearer, driven by the strongest piece. */
function motif(ctx: CanvasRenderingContext2D, type: TypeId, t: number, k: number, q: number) {
  const [d, m, l, h] = PAL[type] ?? PAL.normal;
  const n = q >= 5 ? 6 : q >= 4 ? 4 : 3;
  for (let i = 0; i < n; i++) {
    const ph = (t * 0.8 + hash(i * 7 + 1)) % 1;
    const ox = (hash(i * 3 + 2) - 0.5) * 22 * k;
    const ang = t * 1.8 + (i / n) * Math.PI * 2;
    switch (type) {
      case "fire": {
        const hgt = (2 + ((Math.floor(t * 14) + i) % 3)) * P;
        for (let j = 0; j < hgt; j += P) px(ctx, ox, -j, j >= hgt - P ? h : j > P ? l : m);
        break;
      }
      case "water":
        if (ph < 0.8) { const y = -ph * 34 * k; px(ctx, ox - P, y, l); px(ctx, ox + P, y, l); px(ctx, ox, y - P, h); px(ctx, ox, y + P, m); }
        break;
      case "earth": {
        const y = -10 * k + Math.sin(t * 2 + i) * 3;
        px(ctx, Math.cos(ang * 0.5) * 14 * k, y, m, 2);
        px(ctx, Math.cos(ang * 0.5) * 14 * k, y, l);
        break;
      }
      case "air": {
        const r = 12 * k;
        px(ctx, Math.cos(ang * 1.6) * r, -6 * k - ph * 20 * k, ph < 0.5 ? h : l);
        px(ctx, Math.cos(ang * 1.6 - 0.3) * r, -6 * k - ph * 20 * k + P, m);
        break;
      }
      case "electric":
        if (Math.floor(t * 18 + i * 5) % 7 === 0) {
          const x = ox, y = -hash(i + Math.floor(t * 18)) * 30 * k;
          px(ctx, x, y, h); px(ctx, x + P, y + P, l); px(ctx, x, y + P * 2, h); px(ctx, x + P, y + P * 3, m);
        }
        break;
      case "ice":
        if (ph < 0.85) { const x = ox + Math.sin(t * 3 + i) * 3, y = -36 * k + ph * 36 * k; px(ctx, x, y, h); if (i % 2) { px(ctx, x - P, y, l); px(ctx, x + P, y, l); } }
        break;
      case "void": {
        const r = (1 - ph) * 18 * k;
        px(ctx, Math.cos(ang) * r, -9 * k + Math.sin(ang) * r * 0.5, ph > 0.7 ? h : d);
        break;
      }
      case "light":
        if (i === 0) for (let j = 0; j < 8; j++) { const a = (j / 8) * Math.PI * 2 + t; px(ctx, Math.cos(a) * 6 * k, -22 * k + Math.sin(a) * 2 * k, j % 2 ? l : h); }
        break;
      case "spirit": {
        const y = -ph * 30 * k;
        px(ctx, ox + Math.sin(t * 5 + i) * 3, y, ph < 0.4 ? h : l);
        px(ctx, ox + Math.sin(t * 5 + i - 0.6) * 3, y + P * 2, m);
        break;
      }
      case "ghoul":
        if (ph < 0.6) px(ctx, ox * 0.6, -14 * k + ph * 16 * k, ph < 0.3 ? m : d);
        break;
      default:
        if (ph < 0.3) px(ctx, ox, -ph * 40 * k, h);
    }
  }
}

export function drawGearFx(ctx: CanvasRenderingContext2D, a: Actor, t: number, s: number, layer: "back" | "front"): void {
  const worn = a.pieces.filter((p) => p.quality >= 2);
  if (!worn.length) return;
  const power = gearPower(a.pieces);
  const top = worn.reduce((m, p) => Math.max(m, p.quality), 0);
  const lead = worn.slice().sort((x, y) => y.quality - x.quality)[0]!;
  const [, m, l, h] = PAL[lead.type] ?? PAL.normal;
  const k = s / 2;
  ctx.save();
  ctx.translate(Math.round(a.x / P) * P, Math.round(a.y / P) * P);
  if (layer === "back") {
    dotRing(ctx, (9 + Math.min(6, power * 0.4)) * k, m, t * 0.6, 0);
    if (top >= 4) dotRing(ctx, 13 * k, l, -t * 1.6, 3);
    if (top >= 5) {
      dotRing(ctx, 16 * k, h, t * 2.4, 2);
      for (let i = 0; i < 5; i++) {
        const u = (t * 0.9 + hash(i)) % 1;
        const x = (hash(i + 4) - 0.5) * 16 * k;
        for (let j = 0; j < 3; j++) px(ctx, x, -u * 40 * k + j * P, j ? m : l);
      }
    }
    ctx.restore();
    return;
  }
  // Twinkles on rare+ pieces, phase-shifted per slot.
  for (const p of worn) {
    if (p.quality < 3) continue;
    const pal = PAL[p.type] ?? PAL.normal;
    const [lx, ly] = ANCHOR[p.slot] ?? [0, -8];
    const ph = (t * (1.2 + p.quality * 0.3) + hash(p.fxSeed + p.slot.length)) % 1;
    if (ph > 0.55) continue;
    const x = lx * s * (a.facing < 0 ? -1 : 1), y = ly * s;
    const r = ph < 0.25 ? 1 : 2;
    px(ctx, x, y, pal[3]);
    for (let d = 1; d <= r; d++) {
      const c = d === 1 ? pal[2] : pal[1];
      px(ctx, x + d * P, y, c); px(ctx, x - d * P, y, c); px(ctx, x, y + d * P, c); px(ctx, x, y - d * P, c);
    }
  }
  // Weapon edge glint.
  const weapon = worn.find((p) => p.slot === "weapon");
  if (weapon) {
    const pal = PAL[weapon.type] ?? PAL.normal;
    const u = (t * 1.6) % 1;
    const wx = 7 * s * (a.facing < 0 ? -1 : 1);
    for (let j = 0; j < 2 + weapon.quality; j++) px(ctx, wx, (-14 + u * 10) * s + j * P, j === 0 ? pal[3] : pal[2]);
  }
  // Rising embers: count, height and brightness scale with power.
  const count = Math.min(40, Math.round(power * 2));
  for (let i = 0; i < count; i++) {
    const p = worn[i % worn.length]!;
    const pal = PAL[p.type] ?? PAL.normal;
    const life = (t * (0.35 + hash(i) * 0.45) + hash(i + 9)) % 1;
    const x = (hash(i + 3) - 0.5) * 18 * k + Math.round(Math.sin(t * 3 + i)) * P;
    const y = -life * (24 + p.quality * 5) * k;
    if (life > 0.75 && Math.floor(t * 20 + i) % 2) continue;
    px(ctx, x, y, life < 0.3 ? pal[3] : life < 0.6 ? pal[2] : pal[1]);
  }
  if (top >= 3) motif(ctx, lead.type, t, k, top);
  if (top >= 5) {
    for (let i = 0; i < 4; i++) {
      const ang = t * 2.4 + (i / 4) * Math.PI * 2;
      const x = Math.cos(ang) * 13 * k, y = -9 * k + Math.sin(ang) * 5 * k;
      if (Math.sin(ang) < -0.2) continue;
      px(ctx, x, y, h, 2);
      px(ctx, x - Math.sin(ang) * 4, y + Math.cos(ang) * 2, l);
    }
  }
  ctx.restore();
}
