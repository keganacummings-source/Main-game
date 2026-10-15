import type { TypeId } from "./content";
import { P, PAL, px } from "./combat-fx";
import { fxGene, type FxGene, type FxShape } from "./fx-gene";

type Piece = { slot: string; style: number; type: TypeId; fxSeed: number; quality: number; gene?: number };
type Actor = { x: number; y: number; pieces: Piece[]; walk: number; facing: number };
type Layer = "back" | "front";
type C = CanvasRenderingContext2D;
type Pal4 = readonly [string, string, string, string];

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

function seedOf(p: Piece): number {
  return p.gene && p.gene > 0 ? p.gene : (p.fxSeed + 1) * 7919 + p.style * 104729 + p.slot.length * 31;
}

// ---------------------------------------------------------------------------
// Particle shapes (all hard-edged pixels to match the sprites)
// ---------------------------------------------------------------------------

function shape(ctx: C, kind: FxShape, x: number, y: number, pal: Pal4, lead: number, big: number, ang = 0): void {
  const hi = pal[3], main = pal[lead]!, low = pal[Math.max(1, lead - 1)]!;
  switch (kind) {
    case "dot":
      px(ctx, x, y, main, big > 1 ? 2 : 1);
      break;
    case "plus":
      px(ctx, x, y, hi);
      px(ctx, x + P, y, main); px(ctx, x - P, y, main); px(ctx, x, y + P, main); px(ctx, x, y - P, main);
      if (big > 1) { px(ctx, x + 2 * P, y, low); px(ctx, x - 2 * P, y, low); px(ctx, x, y + 2 * P, low); px(ctx, x, y - 2 * P, low); }
      break;
    case "cross":
      px(ctx, x, y, hi);
      px(ctx, x + P, y + P, main); px(ctx, x - P, y - P, main); px(ctx, x + P, y - P, main); px(ctx, x - P, y + P, main);
      break;
    case "diamond":
      px(ctx, x, y - P, hi); px(ctx, x - P, y, main); px(ctx, x + P, y, main); px(ctx, x, y + P, low);
      if (big > 1) { px(ctx, x, y - 2 * P, main); px(ctx, x, y + 2 * P, low); px(ctx, x, y, main); }
      break;
    case "block":
      px(ctx, x, y, main, 2);
      px(ctx, x, y, hi);
      break;
    case "streak": {
      const dx = Math.round(Math.cos(ang)) * P, dy = Math.round(Math.sin(ang)) * P;
      px(ctx, x, y, hi); px(ctx, x - dx, y - dy, main); px(ctx, x - 2 * dx, y - 2 * dy, low);
      if (big > 1) px(ctx, x - 3 * dx, y - 3 * dy, pal[0]);
      break;
    }
    case "star":
      px(ctx, x, y, hi);
      px(ctx, x, y - P, main); px(ctx, x, y + P, main); px(ctx, x - P, y, main); px(ctx, x + P, y, main);
      px(ctx, x, y - 2 * P, low); px(ctx, x, y + 2 * P, low);
      break;
    case "ring":
      px(ctx, x - P, y, main); px(ctx, x + P, y, main); px(ctx, x, y - P, main); px(ctx, x, y + P, main);
      if (big > 1) px(ctx, x, y, low);
      break;
  }
}

// ---------------------------------------------------------------------------
// Patterns: each piece draws one, shaped by its gene
// ---------------------------------------------------------------------------

type Ctx = { ctx: C; t: number; k: number; g: FxGene; pal: Pal4; alt: Pal4; n: number; big: number; layer: Layer; seed: number; ax: number; ay: number };

const palFor = (c: Ctx, i: number): Pal4 => (c.g.accent && i % 2 ? c.alt : c.pal);

function drawPattern(c: Ctx): void {
  const { ctx, t, k, g, n, big, layer } = c;
  const T = (t * g.speed + g.phase * 7) * g.dir;
  const R = 12 * k * g.radius;
  const lift = g.lift * 20 * k;
  const H = (30 + 6 * big) * k;
  const front = layer === "front";
  const L = g.shade;
  switch (g.pattern) {
    case "orbit": {
      for (let i = 0; i < n; i++) {
        const a = T * 1.6 + (i / n) * Math.PI * 2;
        const depth = Math.sin(a);
        if ((depth >= 0) !== front) continue;
        shape(ctx, g.shape, Math.cos(a) * R, -10 * k + lift + depth * R * 0.36, palFor(c, i), L, big);
      }
      break;
    }
    case "embers":
    case "motes": {
      if (!front) break;
      const slow = g.pattern === "motes" ? 0.45 : 1;
      for (let i = 0; i < n; i++) {
        const life = (Math.abs(T) * (0.3 + hash(c.seed + i) * 0.4) * slow + hash(c.seed + i * 3)) % 1;
        const x = (hash(c.seed + i * 5) - 0.5) * 2 * R + Math.sin(t * 2.5 + i) * (g.pattern === "motes" ? 4 : 1.5) * k;
        if (life > 0.8 && Math.floor(t * 18 + i) % 2) continue;
        shape(ctx, g.shape, x, lift - life * H, palFor(c, i), life < 0.3 ? 3 : L, life < 0.5 ? big : 1, -Math.PI / 2);
      }
      break;
    }
    case "rain":
    case "petals": {
      if (!front) break;
      for (let i = 0; i < n; i++) {
        const life = (Math.abs(T) * (0.35 + hash(c.seed + i) * 0.3) + hash(c.seed + i * 7)) % 1;
        const sway = g.pattern === "petals" ? Math.sin(t * 2 + i * 1.7) * 6 * k : 0;
        const x = (hash(c.seed + i * 11) - 0.5) * 2.2 * R + sway;
        const y = -H - 6 * k + life * (H + 6 * k) + lift;
        if (life > 0.9) continue;
        shape(ctx, g.pattern === "petals" ? "diamond" : g.shape, x, y, palFor(c, i), L, 1, Math.PI / 2);
      }
      break;
    }
    case "spiral": {
      for (let i = 0; i < n; i++) {
        const life = (Math.abs(T) * 0.45 + i / n) % 1;
        const a = life * Math.PI * 4 * g.dir + i;
        const depth = Math.sin(a);
        if ((depth >= 0) !== front) continue;
        const r = (0.35 + 0.65 * (1 - life)) * R;
        shape(ctx, g.shape, Math.cos(a) * r, lift - life * H + depth * r * 0.3, palFor(c, i), life < 0.3 ? 3 : L, big);
      }
      break;
    }
    case "ring":
    case "pulse": {
      if (front !== (g.pattern === "pulse")) break;
      const waves = g.pattern === "pulse" ? 1 : 2;
      for (let w = 0; w < waves; w++) {
        const life = (Math.abs(T) * 0.5 + w / waves) % 1;
        const r = life * R * 1.5;
        const dots = 10 + n;
        const cy = g.pattern === "pulse" ? -10 * k + lift : 0;
        for (let i = 0; i < dots; i++) {
          if (life > 0.7 && i % 2) continue;
          const a = (i / dots) * Math.PI * 2;
          px(ctx, Math.cos(a) * r, cy + Math.sin(a) * r * (g.pattern === "pulse" ? 1 : 0.34), palFor(c, i)[life < 0.4 ? 3 : L]!);
        }
      }
      break;
    }
    case "sparkle": {
      if (!front) break;
      for (let i = 0; i < n; i++) {
        const cyc = Math.floor(Math.abs(T) * 1.5 + hash(c.seed + i));
        const ph = (Math.abs(T) * 1.5 + hash(c.seed + i)) % 1;
        if (ph > 0.5) continue;
        const x = (hash(c.seed + i * 13 + cyc * 7) - 0.5) * 2 * R;
        const y = -hash(c.seed + i * 17 + cyc * 3) * H + lift;
        shape(ctx, ph < 0.25 ? g.shape : "dot", x, y, palFor(c, i), 3, ph < 0.2 ? big : 1);
      }
      break;
    }
    case "wisps": {
      if (!front) break;
      const heads = Math.max(2, Math.round(n / 2));
      for (let i = 0; i < heads; i++) {
        const life = (Math.abs(T) * 0.35 + i / heads) % 1;
        for (let j = 0; j < 4; j++) {
          const lj = Math.max(0, life - j * 0.04);
          const x = Math.sin(lj * 9 + i * 2.1) * R * 0.8;
          const y = lift - lj * H;
          px(ctx, x, y, palFor(c, i)[j === 0 ? 3 : Math.max(0, L - j + 1)]!);
        }
      }
      break;
    }
    case "halo": {
      const dots = 6 + n;
      for (let i = 0; i < dots; i++) {
        const a = T * 1.2 + (i / dots) * Math.PI * 2;
        const depth = Math.sin(a);
        if ((depth >= 0) !== front) continue;
        const rx = 7 * k * g.radius;
        px(ctx, Math.cos(a) * rx, -21 * k + lift * 0.3 + depth * rx * 0.28, palFor(c, i)[i % 3 === 0 ? 3 : L]!);
      }
      break;
    }
    case "sigil": {
      if (front) break;
      const sides = g.sides;
      const r = R * 1.15;
      const rot = T * 0.7;
      for (let s = 0; s < sides; s++) {
        const a0 = rot + (s / sides) * Math.PI * 2;
        const a1 = rot + ((s + 1) / sides) * Math.PI * 2;
        const steps = 6;
        for (let j = 0; j <= steps; j++) {
          const u = j / steps;
          const x = Math.cos(a0) * r * (1 - u) + Math.cos(a1) * r * u;
          const y = (Math.sin(a0) * (1 - u) + Math.sin(a1) * u) * r * 0.34;
          px(ctx, x, y, palFor(c, s)[j === 0 ? 3 : L]!);
        }
      }
      break;
    }
    case "shards": {
      const m = Math.max(2, Math.round(n * 0.6));
      for (let i = 0; i < m; i++) {
        const a = T * 0.9 + (i / m) * Math.PI * 2;
        const depth = Math.sin(a);
        if ((depth >= 0) !== front) continue;
        const bob = Math.sin(t * 3 + i * 1.3) * 2 * k;
        shape(ctx, "diamond", Math.cos(a) * R * 1.1, -12 * k + lift + bob + depth * R * 0.3, palFor(c, i), L, 2);
      }
      break;
    }
    case "comet": {
      const m = big > 1 ? 2 : 1;
      const tail = 2 + g.sides;
      for (let i = 0; i < m; i++) {
        for (let j = tail; j >= 0; j--) {
          const a = T * 2.2 + (i / m) * Math.PI * 2 - j * 0.16 * g.dir;
          const depth = Math.sin(a);
          if ((depth >= 0) !== front) continue;
          const pal = palFor(c, i);
          const x = Math.cos(a) * R * 1.05, y = -11 * k + lift + depth * R * 0.4;
          if (j === 0) shape(ctx, g.shape === "streak" ? "star" : g.shape, x, y, pal, 3, 2);
          else px(ctx, x, y, pal[Math.max(0, 3 - Math.ceil((j / tail) * 3))]!);
        }
      }
      break;
    }
    case "helix": {
      const steps = 6 + n;
      for (let strand = 0; strand < 2; strand++) {
        for (let j = 0; j < steps; j++) {
          const u = j / steps;
          const a = T * 2 + u * Math.PI * 3 + strand * Math.PI;
          const depth = Math.sin(a);
          if ((depth >= 0) !== front) continue;
          px(ctx, Math.cos(a) * R * 0.75, lift - u * H, palFor(c, strand)[u > 0.7 ? 3 : L]!);
        }
      }
      break;
    }
    case "chevrons": {
      if (!front) break;
      const m = Math.max(2, Math.round(n / 2));
      for (let i = 0; i < m; i++) {
        const life = (Math.abs(T) * 0.5 + i / m) % 1;
        const y = -18 * k - life * 18 * k + lift;
        const w = 3 + Math.floor(big);
        const pal = palFor(c, i);
        for (let j = 0; j < w; j++) {
          px(ctx, -j * P, y + j * P, pal[j === 0 ? 3 : L]!);
          px(ctx, j * P, y + j * P, pal[j === 0 ? 3 : L]!);
        }
      }
      break;
    }
  }
  // Flare: a slow glow pulse at the piece's own anchor.
  if (g.flare && front) {
    const ph = (Math.abs(T) * 0.6) % 1;
    if (ph < 0.45) shape(ctx, "star", c.ax, c.ay, c.pal, 3, ph < 0.2 ? 2 : 1);
  }
}

/** Element signature around the wearer, driven by the strongest piece. */
function motif(ctx: C, type: TypeId, t: number, k: number, q: number) {
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
      case "ghoul":
        if (ph < 0.6) px(ctx, ox * 0.6, -14 * k + ph * 16 * k, ph < 0.3 ? m : d);
        break;
      default:
        if (ph < 0.3) px(ctx, ox, -ph * 40 * k, h);
    }
  }
}

function dotRing(ctx: C, r: number, c: string, rot: number, gap: number, flat: number) {
  const n = Math.max(10, Math.floor((r * 6.3) / P));
  for (let i = 0; i < n; i++) {
    if (gap && Math.floor(i / gap) % 2) continue;
    const a = (i / n) * Math.PI * 2 + rot;
    px(ctx, Math.cos(a) * r, Math.sin(a) * r * flat, c);
  }
}

const COUNT_BY_QUALITY = [0, 0, 3, 5, 7, 10];

export function drawGearFx(ctx: C, a: Actor, t: number, s: number, layer: Layer): void {
  const worn = a.pieces.filter((p) => p.quality >= 2);
  if (!worn.length) return;
  const power = gearPower(a.pieces);
  const top = worn.reduce((m, p) => Math.max(m, p.quality), 0);
  const lead = worn.slice().sort((x, y) => y.quality - x.quality)[0]!;
  const leadGene = fxGene(seedOf(lead), lead.type, lead.quality);
  const leadPal = PAL[lead.type] ?? PAL.normal;
  const k = s / 2;
  const flip = a.facing < 0 ? -1 : 1;
  ctx.save();
  ctx.translate(Math.round(a.x / P) * P, Math.round(a.y / P) * P);
  // Ground ring: its gaps, spin, tilt and colour come from the strongest piece.
  if (layer === "back") {
    const gap = [0, 2, 3, 4][Math.floor(leadGene.phase * 4)]!;
    const flat = 0.3 + leadGene.radius * 0.08;
    dotRing(ctx, (9 + Math.min(6, power * 0.4)) * k * leadGene.radius, leadPal[leadGene.shade]!, t * 0.6 * leadGene.dir * leadGene.speed, gap, flat);
    if (top >= 4) dotRing(ctx, 13 * k * leadGene.radius, (PAL[leadGene.accent ?? lead.type] ?? leadPal)[2], -t * 1.6 * leadGene.dir, 3, flat);
    if (top >= 5) dotRing(ctx, 16 * k * leadGene.radius, leadPal[3], t * 2.4 * leadGene.dir, 2, flat);
  }
  // Each fine+ piece adds its own pattern. Budget keeps crowded outfits fast.
  let budget = 48;
  for (const p of worn.slice().sort((x, y) => y.quality - x.quality)) {
    if (budget <= 0) break;
    const seed = seedOf(p);
    const g = fxGene(seed, p.type, p.quality);
    const n = Math.min(budget, Math.max(2, Math.round(COUNT_BY_QUALITY[p.quality]! * g.density)));
    budget -= n;
    const pal = PAL[p.type] ?? PAL.normal;
    const alt = g.accent ? PAL[g.accent] ?? pal : pal;
    const [lx, ly] = ANCHOR[p.slot] ?? [0, -8];
    drawPattern({ ctx, t, k, g, pal, alt, n, big: p.quality >= 4 ? 2 : 1, layer, seed: seed % 9973, ax: lx * s * flip, ay: ly * s });
  }
  if (layer === "front") {
    // Weapon edge glint, coloured and timed by the weapon's own gene.
    const weapon = worn.find((p) => p.slot === "weapon");
    if (weapon) {
      const g = fxGene(seedOf(weapon), weapon.type, weapon.quality);
      const pal = g.accent && g.phase > 0.5 ? PAL[g.accent] ?? PAL.normal : PAL[weapon.type] ?? PAL.normal;
      const u = (t * 1.6 * g.speed + g.phase) % 1;
      const wx = 7 * s * flip;
      for (let j = 0; j < 2 + weapon.quality; j++) px(ctx, wx, (-14 + u * 10) * s + j * P, j === 0 ? pal[3] : pal[2]);
    }
    if (top >= 4) motif(ctx, lead.type, t, k, top);
  }
  ctx.restore();
}
