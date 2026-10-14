import { TYPES, type FxId, type TypeId } from "./content";
import type { Pal } from "./sprites";

export type Motif =
  | "flame"
  | "bolt"
  | "root"
  | "drop"
  | "cloud"
  | "frost"
  | "rift"
  | "ray"
  | "ribbon"
  | "ichor"
  | "ember"
  | "thorn";

const BANK: Record<TypeId, Motif[]> = {
  fire: ["flame", "ember", "flame"],
  water: ["drop", "cloud", "drop"],
  earth: ["root", "thorn", "root"],
  air: ["cloud", "ribbon", "cloud"],
  electric: ["bolt", "bolt", "ray"],
  ice: ["frost", "frost", "ray"],
  void: ["rift", "ribbon", "rift"],
  light: ["ray", "flame", "ray"],
  spirit: ["ribbon", "cloud", "ribbon"],
  ghoul: ["ichor", "ember", "rift"],
  normal: ["ember", "ribbon", "thorn"],
};

export function motifOf(type: TypeId, n: number): { motif: Motif; variant: number } {
  const list = BANK[type] ?? BANK.normal;
  const i = Math.abs(n) % list.length;
  return { motif: list[i] ?? "flame", variant: Math.abs(n * 3 + 1) % 3 };
}

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function tongue(ctx: CanvasRenderingContext2D, h: number, w: number, outer: string, inner: string): void {
  ctx.beginPath();
  ctx.moveTo(-w, 0);
  ctx.quadraticCurveTo(-w * 0.2, -h * 0.58, w * 0.15, -h);
  ctx.quadraticCurveTo(w * 0.7, -h * 0.46, w, 0);
  ctx.closePath();
  ctx.fillStyle = outer;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-w * 0.4, 0);
  ctx.quadraticCurveTo(-w * 0.05, -h * 0.5, w * 0.08, -h * 0.7);
  ctx.quadraticCurveTo(w * 0.35, -h * 0.28, w * 0.45, 0);
  ctx.closePath();
  ctx.fillStyle = inner;
  ctx.fill();
}

function teardrop(ctx: CanvasRenderingContext2D, s: number, fill: string): void {
  ctx.beginPath();
  ctx.moveTo(0, -s * 2.1);
  ctx.bezierCurveTo(s * 0.55, -s * 0.7, s * 0.72, s * 0.15, 0, s * 0.55);
  ctx.bezierCurveTo(-s * 0.72, s * 0.15, -s * 0.55, -s * 0.7, 0, -s * 2.1);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.moveTo(-s * 0.05, -s * 0.85);
  ctx.lineTo(s * 0.16, -s * 0.35);
  ctx.lineTo(-s * 0.02, -s * 0.05);
  ctx.closePath();
  ctx.fill();
}

function streak(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, pal: Pal): void {
  ctx.strokeStyle = pal.l;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.fillStyle = "#fff6d8";
  ctx.beginPath();
  ctx.moveTo(x1, y1 - 3);
  ctx.lineTo(x1 + 2.2, y1);
  ctx.lineTo(x1, y1 + 3);
  ctx.lineTo(x1 - 2.2, y1);
  ctx.closePath();
  ctx.fill();
}

function spike(ctx: CanvasRenderingContext2D, len: number, w: number, pal: Pal): void {
  ctx.beginPath();
  ctx.moveTo(-w * 0.45, 0);
  ctx.lineTo(w * 0.2, -len * 0.42);
  ctx.lineTo(0, -len);
  ctx.lineTo(-w * 0.15, -len * 0.38);
  ctx.closePath();
  ctx.fillStyle = pal.l;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-w * 0.12, -len * 0.12);
  ctx.lineTo(w * 0.08, -len * 0.4);
  ctx.lineTo(0, -len * 0.78);
  ctx.closePath();
  ctx.fillStyle = pal.h;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function wedge(ctx: CanvasRenderingContext2D, len: number, spread: number, pal: Pal): void {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.sin(spread) * len, -len);
  ctx.lineTo(-Math.sin(spread) * len * 0.35, -len * 0.92);
  ctx.closePath();
  ctx.fillStyle = pal.a;
  ctx.globalAlpha = 0.88;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#fff6d0";
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -len);
  ctx.stroke();
}

function tear(ctx: CanvasRenderingContext2D, h: number, pal: Pal): void {
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(4.2, -h * 0.22);
  ctx.lineTo(-2.4, -h * 0.46);
  ctx.lineTo(5, -h * 0.7);
  ctx.lineTo(0.4, -h);
  ctx.lineTo(-4, -h * 0.66);
  ctx.lineTo(2.2, -h * 0.4);
  ctx.lineTo(-3.4, -h * 0.16);
  ctx.closePath();
  ctx.fillStyle = "#140816";
  ctx.fill();
  ctx.strokeStyle = pal.l;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.strokeStyle = pal.h;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function puff(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, pal: Pal): void {
  ctx.fillStyle = pal.m;
  ctx.globalAlpha = 0.72;
  ctx.beginPath();
  ctx.ellipse(x, y + w * 0.22, w * 0.95, w * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.l;
  ctx.globalAlpha = 0.88;
  ctx.beginPath();
  ctx.ellipse(x - w * 0.38, y, w * 0.46, w * 0.34, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.34, y - w * 0.02, w * 0.4, w * 0.3, 0, 0, Math.PI * 2);
  ctx.ellipse(x - w * 0.02, y - w * 0.28, w * 0.42, w * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.ellipse(x - w * 0.08, y - w * 0.38, w * 0.18, w * 0.1, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function feather(ctx: CanvasRenderingContext2D, ang: number, sc: number, pal: Pal): void {
  ctx.save();
  ctx.rotate(ang);
  ctx.fillStyle = pal.l;
  ctx.beginPath();
  ctx.moveTo(0, -9 * sc);
  ctx.quadraticCurveTo(4.2 * sc, -2 * sc, 1.1 * sc, 7 * sc);
  ctx.quadraticCurveTo(0, 2 * sc, -1.3 * sc, 7 * sc);
  ctx.quadraticCurveTo(-4.4 * sc, -1 * sc, 0, -9 * sc);
  ctx.fill();
  ctx.strokeStyle = pal.h;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -7 * sc);
  ctx.lineTo(0, 5 * sc);
  ctx.stroke();
  ctx.restore();
}

function ribbon(ctx: CanvasRenderingContext2D, t: number, seed: number, len: number, pal: Pal): void {
  const amp = 3.5 + (Math.abs(seed) % 3);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let i = 1; i <= 8; i++) {
    const u = i / 8;
    ctx.lineTo(Math.sin(t * 3.2 + seed + u * 6) * amp * (0.4 + u), -len * u);
  }
  ctx.lineCap = "round";
  ctx.strokeStyle = pal.m;
  ctx.lineWidth = 4.2;
  ctx.globalAlpha = 0.8;
  ctx.stroke();
  ctx.strokeStyle = pal.l;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.95;
  ctx.stroke();
  ctx.strokeStyle = pal.h;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function rootCurve(ctx: CanvasRenderingContext2D, t: number, seed: number, len: number, side: number, pal: Pal, thorns: boolean): void {
  const curl = Math.sin(t * 1.8 + seed) * 5 * side;
  ctx.lineCap = "round";
  ctx.strokeStyle = pal.d;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(side * 7, -len * 0.2, side * -4 + curl, -len * 0.55, side * 3 + curl, -len);
  ctx.stroke();
  ctx.strokeStyle = pal.l;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (!thorns) return;
  ctx.fillStyle = pal.a;
  for (let i = 0; i < 3; i++) {
    const y = -len * (0.28 + i * 0.24);
    const x = side * (2 + i * 1.4) + Math.sin(seed + i) * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + side * 6, y - 2.5);
    ctx.lineTo(x + side * 1.2, y + 2.4);
    ctx.closePath();
    ctx.fill();
  }
}

function bolt(ctx: CanvasRenderingContext2D, t: number, seed: number, len: number, jag: number, pal: Pal): void {
  const flick = Math.floor(t * 18 + seed * 0.17);
  const pts: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  const segs = 6;
  for (let i = 1; i <= segs; i++) {
    const u = i / segs;
    pts.push({
      x: (hash(flick * 9 + i * 5 + seed) - 0.5) * jag * (1.2 - u),
      y: -len * u,
    });
  }
  const stroke = (width: number, color: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  stroke(4.2, pal.m);
  stroke(2.1, pal.l);
  stroke(0.9, "#fffef6");
  const branchAt = pts[3];
  if (!branchAt) return;
  const dir = hash(flick + seed) > 0.5 ? 1 : -1;
  ctx.beginPath();
  ctx.moveTo(branchAt.x, branchAt.y);
  ctx.lineTo(branchAt.x + dir * jag * 0.85, branchAt.y - len * 0.18);
  ctx.lineTo(branchAt.x + dir * jag * 0.35, branchAt.y - len * 0.38);
  ctx.strokeStyle = "#fffef6";
  ctx.lineWidth = 1.1;
  ctx.stroke();
}

function paintFlame(ctx: CanvasRenderingContext2D, t: number, seed: number, pal: Pal, variant: number, sc: number): void {
  const n = variant === 1 ? 5 : 3;
  const fan = variant === 1 ? 0.42 : 0.16;
  for (let i = 0; i < n; i++) {
    const k = i - (n - 1) / 2;
    const flick = 0.72 + Math.sin(t * (variant === 2 ? 14 : 9) + seed + i) * 0.28;
    const h = (variant === 2 ? 18 : 13) * sc * flick + (i % 2) * 3 * sc;
    const w = (variant === 1 ? 2.2 : 3.4) * sc;
    ctx.save();
    ctx.rotate(k * fan);
    ctx.translate(k * 1.2 * sc, 0);
    tongue(ctx, h, w, i % 2 ? pal.l : pal.m, variant === 2 ? "#fff4c8" : pal.h);
    ctx.restore();
  }
  if (variant === 2) {
    for (let i = 0; i < 3; i++) {
      const life = (t * 0.7 + i * 0.33) % 1;
      streak(ctx, (i - 1) * 3 * sc, -2, (i - 1) * 5 * sc, -8 * sc - life * 14 * sc, pal);
    }
  }
}

function paintBolt(ctx: CanvasRenderingContext2D, t: number, seed: number, pal: Pal, variant: number, sc: number): void {
  const n = variant === 1 ? 2 : 3;
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.rotate((i - (n - 1) / 2) * (variant === 2 ? 0.15 : 0.48));
    bolt(ctx, t, seed + i * 19, (variant === 2 ? 22 : 16) * sc, (variant === 1 ? 14 : 9) * sc, pal);
    ctx.restore();
  }
}

function paintRoot(ctx: CanvasRenderingContext2D, t: number, seed: number, pal: Pal, variant: number, sc: number): void {
  const n = variant === 1 ? 4 : 3;
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    ctx.save();
    ctx.rotate((i - (n - 1) / 2) * 0.35);
    rootCurve(ctx, t, seed + i, (14 + variant * 3) * sc, side, pal, variant !== 0);
    ctx.restore();
  }
}

function paintDrop(ctx: CanvasRenderingContext2D, t: number, seed: number, pal: Pal, variant: number, sc: number): void {
  if (variant === 1) {
    ctx.beginPath();
    ctx.moveTo(-12 * sc, 1);
    for (let i = 0; i <= 10; i++) {
      const x = -12 * sc + (i / 10) * 24 * sc;
      const y = Math.sin(t * 4 + i + seed) * 2.4 * sc - 3 * sc;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(12 * sc, 6 * sc);
    ctx.lineTo(-12 * sc, 6 * sc);
    ctx.closePath();
    ctx.fillStyle = pal.l;
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal.h;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const x = -12 * sc + (i / 10) * 24 * sc;
      const y = Math.sin(t * 4 + i + seed) * 2.4 * sc - 3 * sc;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  const drops = variant === 2 ? 5 : 4;
  for (let i = 0; i < drops; i++) {
    const life = (t * (0.45 + (i % 3) * 0.08) + i * 0.27 + seed * 0.01) % 1;
    const x = (i - (drops - 1) / 2) * 4.2 * sc + Math.sin(t * 2 + i) * 1.5 * sc;
    const y = -life * (16 + variant * 4) * sc;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = life < 0.15 || life > 0.9 ? 0.35 : 0.95;
    teardrop(ctx, (2.1 + (i % 2) * 0.6) * sc, i % 2 ? pal.a : pal.l);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function paintCloud(ctx: CanvasRenderingContext2D, t: number, seed: number, pal: Pal, variant: number, sc: number): void {
  const drift = Math.sin(t * 0.8 + seed) * 3 * sc;
  puff(ctx, drift - 4 * sc, -6 * sc, 7 * sc, pal);
  if (variant !== 2) puff(ctx, drift + 6 * sc, -11 * sc, 5.5 * sc, pal);
  if (variant === 1) {
    ctx.save();
    ctx.translate(0, -4 * sc);
    ribbon(ctx, t, seed, 12 * sc, pal);
    ctx.restore();
  }
  if (variant === 2) {
    for (let i = 0; i < 3; i++) {
      const life = (t * 0.6 + i * 0.3) % 1;
      ctx.save();
      ctx.translate((i - 1) * 4 * sc, -2 * sc - life * 10 * sc);
      teardrop(ctx, 1.8 * sc, pal.a);
      ctx.restore();
    }
  }
}

function paintFrost(ctx: CanvasRenderingContext2D, t: number, seed: number, pal: Pal, variant: number, sc: number): void {
  const n = variant === 1 ? 1 : 4;
  if (variant !== 1) {
    for (let i = 0; i < n; i++) {
      const grow = 0.75 + Math.sin(t * 2.4 + i + seed) * 0.25;
      ctx.save();
      ctx.rotate((i - (n - 1) / 2) * 0.4);
      spike(ctx, 14 * sc * grow, 3.2 * sc, pal);
      ctx.restore();
    }
  }
  if (variant === 1 || variant === 2) {
    ctx.save();
    ctx.translate(Math.sin(t + seed) * 3 * sc, -8 * sc + Math.cos(t * 0.7) * 2);
    ctx.rotate(t * 0.6);
    ctx.strokeStyle = pal.h;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -7 * sc);
      ctx.moveTo(0, -4 * sc);
      ctx.lineTo(2 * sc, -5.5 * sc);
      ctx.moveTo(0, -4 * sc);
      ctx.lineTo(-2 * sc, -5.5 * sc);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function paintRift(ctx: CanvasRenderingContext2D, t: number, seed: number, pal: Pal, variant: number, sc: number): void {
  tear(ctx, (16 + variant * 3) * sc, pal);
  if (variant === 1) {
    ctx.save();
    ctx.rotate(0.8);
    tear(ctx, 12 * sc, pal);
    ctx.restore();
  }
  ctx.save();
  ctx.translate(2, -4 * sc);
  ribbon(ctx, t * 1.4, seed, 12 * sc, pal);
  ctx.restore();
  for (let i = 0; i < 3; i++) {
    const life = (t * 0.8 + i * 0.31) % 1;
    const ang = -0.8 + i * 0.7;
    const dist = (1 - life) * 12 * sc;
    ctx.save();
    ctx.translate(Math.sin(ang) * dist, -8 * sc - Math.cos(ang) * dist * 0.3);
    ctx.rotate(ang);
    ctx.fillStyle = pal.h;
    ctx.fillRect(-1.2, -2.4, 2.2, 4);
    ctx.restore();
  }
}

function paintRay(ctx: CanvasRenderingContext2D, t: number, seed: number, pal: Pal, variant: number, sc: number): void {
  const n = variant === 1 ? 3 : 5;
  ctx.save();
  ctx.rotate(variant === 0 ? t * 0.35 : 0);
  for (let i = 0; i < n; i++) {
    const flick = 0.65 + Math.sin(t * 5 + i + seed) * 0.35;
    ctx.save();
    ctx.rotate((i - (n - 1) / 2) * (variant === 1 ? 0.22 : 0.38));
    wedge(ctx, (12 + variant * 3) * sc * flick, 0.14, pal);
    ctx.restore();
  }
  ctx.restore();
  if (variant === 1) {
    const life = (t * 0.9) % 1;
    ctx.fillStyle = "#fff";
    ctx.globalAlpha = 1 - life;
    ctx.fillRect(-1.2, -life * 18 * sc, 2.4, 3);
    ctx.globalAlpha = 1;
  }
}

function paintRibbon(ctx: CanvasRenderingContext2D, t: number, seed: number, pal: Pal, variant: number, sc: number): void {
  if (variant === 1) {
    for (let i = 0; i < 3; i++) {
      const life = (t * 0.35 + i * 0.33) % 1;
      ctx.save();
      ctx.translate((i - 1) * 6 * sc + Math.sin(t + i) * 2, -life * 16 * sc);
      ctx.rotate(-0.4 + i * 0.35 + Math.sin(t * 2 + i) * 0.2);
      feather(ctx, 0, sc, pal);
      ctx.restore();
    }
    return;
  }
  ribbon(ctx, t, seed, (14 + variant * 4) * sc, pal);
  if (variant === 2) {
    ctx.save();
    ctx.rotate(0.5);
    ribbon(ctx, t + 1.2, seed + 4, 11 * sc, pal);
    ctx.restore();
  }
}

function paintIchor(ctx: CanvasRenderingContext2D, t: number, seed: number, pal: Pal, variant: number, sc: number): void {
  const n = 3 + variant;
  for (let i = 0; i < n; i++) {
    const life = (t * (0.55 + i * 0.05) + i * 0.2) % 1;
    const x = (i - (n - 1) / 2) * 3.6 * sc;
    ctx.save();
    ctx.translate(x, 0);
    ctx.strokeStyle = pal.m;
    ctx.lineWidth = 1.6 + life;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(Math.sin(seed + i) * 2, -life * 6 * sc, 0, -life * (12 + variant * 3) * sc);
    ctx.stroke();
    ctx.translate(0, -life * (12 + variant * 3) * sc);
    teardrop(ctx, (1.8 + life) * sc, pal.l);
    ctx.restore();
  }
  if (variant === 1) {
    ctx.strokeStyle = pal.a;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-6 * sc, -2);
    ctx.quadraticCurveTo(0, -8 * sc, 7 * sc, -3 * sc + Math.sin(t * 6) * 2);
    ctx.stroke();
  }
}

function paintEmber(ctx: CanvasRenderingContext2D, t: number, seed: number, pal: Pal, variant: number, sc: number): void {
  if (variant === 1) {
    ctx.strokeStyle = pal.l;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8 * sc, 0);
    ctx.lineTo(-3 * sc, -3 * sc);
    ctx.lineTo(1 * sc, -1 * sc);
    ctx.lineTo(6 * sc, -5 * sc);
    ctx.lineTo(9 * sc, -2 * sc);
    ctx.stroke();
    ctx.strokeStyle = "#fff1c4";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  const n = 4 + variant;
  for (let i = 0; i < n; i++) {
    const life = (t * (0.8 + (i % 2) * 0.2) + i * 0.17 + seed * 0.02) % 1;
    const spread = (i - (n - 1) / 2) * (variant === 2 ? 0.55 : 0.22);
    const len = life * (12 + variant * 4) * sc;
    streak(ctx, Math.sin(spread) * 2, -1, Math.sin(spread) * len * 0.8, -len, pal);
  }
}

function paintThorn(ctx: CanvasRenderingContext2D, t: number, seed: number, pal: Pal, variant: number, sc: number): void {
  const n = variant === 2 ? 5 : 3;
  for (let i = 0; i < n; i++) {
    const grow = variant === 0 ? 0.55 + (Math.sin(t * 4 + i) * 0.5 + 0.5) * 0.6 : 1;
    ctx.save();
    ctx.rotate((i - (n - 1) / 2) * 0.42);
    spike(ctx, 12 * sc * grow, 2.4 * sc, pal);
    ctx.restore();
  }
  if (variant !== 0) rootCurve(ctx, t, seed, 12 * sc, 1, pal, true);
}

export function paintMotif(
  ctx: CanvasRenderingContext2D,
  motif: Motif,
  variant: number,
  t: number,
  seed: number,
  pal: Pal,
  sc: number,
): void {
  ctx.save();
  ctx.scale(1.55, 1.55);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.globalCompositeOperation = "source-over";
  const v = ((variant % 3) + 3) % 3;
  if (motif === "flame") paintFlame(ctx, t, seed, pal, v, sc);
  else if (motif === "bolt") paintBolt(ctx, t, seed, pal, v, sc);
  else if (motif === "root") paintRoot(ctx, t, seed, pal, v, sc);
  else if (motif === "drop") paintDrop(ctx, t, seed, pal, v, sc);
  else if (motif === "cloud") paintCloud(ctx, t, seed, pal, v, sc);
  else if (motif === "frost") paintFrost(ctx, t, seed, pal, v, sc);
  else if (motif === "rift") paintRift(ctx, t, seed, pal, v, sc);
  else if (motif === "ray") paintRay(ctx, t, seed, pal, v, sc);
  else if (motif === "ribbon") paintRibbon(ctx, t, seed, pal, v, sc);
  else if (motif === "ichor") paintIchor(ctx, t, seed, pal, v, sc);
  else if (motif === "ember") paintEmber(ctx, t, seed, pal, v, sc);
  else paintThorn(ctx, t, seed, pal, v, sc);
  ctx.restore();
}

export type WornFxActor = {
  x: number;
  y: number;
  facing: number;
  walk: number;
  attack: number;
  tall?: number;
  scale?: number;
  pieces: { slot: string; style: number; type: TypeId; fxSeed: number; quality: number }[];
};

function piecePal(type: TypeId): Pal {
  const c = TYPES[type].color;
  return { d: c, m: c, l: c, h: "#fff6e8", a: c };
}

function slotKey(slot: string): number {
  if (slot === "head") return 1;
  if (slot === "chest") return 2;
  if (slot === "legs") return 3;
  if (slot === "feet") return 4;
  if (slot === "weapon") return 5;
  return 6;
}

export function drawWornFx(ctx: CanvasRenderingContext2D, a: WornFxActor, t: number): void {
  if (a.pieces.length === 0) return;
  const s = (a.scale ?? 1) * (a.tall ?? 1);
  const facing = a.facing < 0 ? -1 : 1;
  const wide = 1.28;
  const squat = 0.58;
  const bob = Math.sin(a.walk * 8) * (a.walk > 0.2 ? 1.2 : 0.25);
  const nudge = a.attack > 0 ? 4 * a.attack : 0;
  const R = -0.95 - a.attack * 0.9;
  const world = (lx: number, ly: number) => ({
    x: a.x + (lx + nudge) * facing * s * wide,
    y: a.y + (ly + bob) * s * squat,
  });
  const blade = Math.atan2(-Math.cos(R) * squat, Math.sin(R) * facing * wide);
  for (const p of a.pieces) {
    let lx = 0;
    let ly = -30;
    if (p.slot === "head") ly = -88;
    else if (p.slot === "chest") ly = -48;
    else if (p.slot === "legs") ly = -14;
    else if (p.slot === "feet") ly = 0;
    else if (p.slot === "relic") {
      lx = -8;
      ly = -30;
    } else if (p.slot === "weapon") {
      const py = -18;
      lx = 12 - py * Math.sin(R);
      ly = -40 + py * Math.cos(R);
    }
    const at = world(lx, ly);
    const n = p.style * 5 + p.fxSeed + slotKey(p.slot) * 3;
    const { motif, variant } = motifOf(p.type, n);
    const slotSc =
      (p.slot === "weapon" ? 1.08 : p.slot === "chest" ? 0.95 : p.slot === "head" ? 0.8 : p.slot === "relic" ? 0.72 : 0.62) *
      (0.88 + Math.max(0, p.quality) * 0.05) *
      Math.max(0.85, s);
    let aim = -Math.PI / 2;
    if (p.slot === "weapon") aim = blade;
    else if (
      (p.slot === "feet" || p.slot === "legs") &&
      (motif === "drop" || motif === "ichor" || motif === "root" || motif === "thorn")
    ) {
      aim = Math.PI / 2;
    }
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(aim + Math.PI / 2);
    paintMotif(ctx, motif, variant, t, n, piecePal(p.type), slotSc);
    ctx.restore();
  }
}

function auraPal(hex: string): Pal {
  return { d: hex, m: hex, l: hex, h: "#fff6e8", a: hex };
}

export function paintSetAura(
  ctx: CanvasRenderingContext2D,
  fx: FxId,
  t: number,
  scale: number,
  color: string,
): void {
  const sc = Math.max(0.75, scale);
  const pal = auraPal(color);
  ctx.save();
  if (fx === "solarnova") {
    ctx.save();
    ctx.translate(0, -30 * sc);
    ctx.rotate(t * 0.45);
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      wedge(ctx, (26 + Math.sin(t * 3 + i) * 6) * sc, 0.22, pal);
    }
    ctx.restore();
    ctx.save();
    ctx.translate(0, -22 * sc);
    paintMotif(ctx, "flame", 1, t, 2, pal, sc * 0.95);
    ctx.restore();
  } else if (fx === "stormcrown") {
    ctx.save();
    ctx.translate(0, -46 * sc);
    paintMotif(ctx, "bolt", 0, t, 8, pal, sc);
    ctx.restore();
  } else if (fx === "tidalsurge") {
    ctx.save();
    ctx.translate(0, -2 * sc);
    paintMotif(ctx, "drop", 1, t, 3, pal, sc * 1.35);
    ctx.restore();
  } else if (fx === "briarburst") {
    ctx.save();
    ctx.translate(0, -4 * sc);
    ctx.rotate(Math.PI);
    paintMotif(ctx, "root", 1, t, 6, pal, sc * 1.15);
    ctx.restore();
    ctx.save();
    ctx.translate(0, -16 * sc);
    paintMotif(ctx, "thorn", 2, t, 9, pal, sc * 0.8);
    ctx.restore();
  } else if (fx === "whitestorm") {
    ctx.save();
    ctx.translate(-14 * sc, -40 * sc);
    paintMotif(ctx, "cloud", 0, t, 1, pal, sc);
    ctx.restore();
    ctx.save();
    ctx.translate(12 * sc, -46 * sc);
    paintMotif(ctx, "cloud", 2, t, 5, pal, sc * 0.8);
    ctx.restore();
    ctx.save();
    ctx.translate(0, -36 * sc);
    ctx.rotate(Math.PI);
    paintMotif(ctx, "bolt", 2, t, 11, pal, sc * 0.85);
    ctx.restore();
  } else if (fx === "voidring") {
    ctx.save();
    ctx.translate(-12 * sc, -28 * sc);
    paintMotif(ctx, "rift", 0, t, 4, pal, sc);
    ctx.restore();
    ctx.save();
    ctx.translate(12 * sc, -34 * sc);
    paintMotif(ctx, "rift", 1, t + 0.6, 12, pal, sc * 0.85);
    ctx.restore();
  } else if (fx === "gravepulse") {
    ctx.save();
    ctx.translate(0, -38 * sc);
    ctx.rotate(Math.PI);
    paintMotif(ctx, "ichor", 1, t, 7, pal, sc);
    ctx.restore();
    ctx.save();
    ctx.translate(0, -20 * sc);
    paintMotif(ctx, "ribbon", 2, t, 3, pal, sc * 0.7);
    ctx.restore();
  } else if (fx === "lanternwake") {
    ctx.save();
    ctx.translate(0, -50 * sc);
    paintMotif(ctx, "ray", 1, t, 2, pal, sc);
    paintMotif(ctx, "flame", 0, t, 5, pal, sc * 0.7);
    ctx.restore();
  } else if (fx === "featherfall") {
    for (let i = 0; i < 6; i++) {
      const life = (t * 0.22 + i * 0.16) % 1;
      ctx.save();
      ctx.translate(Math.sin(t * 0.8 + i * 1.4) * 16 * sc, -8 * sc - (1 - life) * 40 * sc);
      ctx.rotate(0.4 + Math.sin(t * 2 + i) * 0.5);
      feather(ctx, 0, sc * 0.85, pal);
      ctx.restore();
    }
  } else if (fx === "bloodmoon") {
    ctx.save();
    ctx.translate(0, -54 * sc);
    const r = 14 * sc;
    ctx.fillStyle = pal.l;
    ctx.beginPath();
    ctx.arc(-r * 0.15, 0, r, 0, Math.PI * 2);
    ctx.arc(r * 0.55, -r * 0.05, r * 0.86, 0, Math.PI * 2, true);
    ctx.fill("evenodd");
    ctx.restore();
    ctx.save();
    ctx.translate(0, -24 * sc);
    paintMotif(ctx, "flame", 2, t, 9, pal, sc * 0.85);
    ctx.restore();
  }
  ctx.restore();
}
