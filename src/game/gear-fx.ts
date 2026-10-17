import type { TypeId } from "./content";
import { P, PAL, px } from "./combat-fx";
import { fxGene, fxTrait, type FxGene, type FxShape, type FxTrait } from "./fx-gene";

type Piece = { slot: string; style: number; type: TypeId; fxSeed: number; quality: number; gene?: number };
type Actor = { x: number; y: number; pieces: Piece[]; walk: number; facing: number };
type Layer = "back" | "front";
type C = CanvasRenderingContext2D;
type Pal4 = readonly [string, string, string, string];

// Sprite-local anchors (bottom-center origin, before scale). drawGearFx is called with a scale already
// fitted to the 27px class sprites (see GEAR_FIT in actor-sprites.ts): head top ~-19, hands ~-6.5, hips ~-6.
const ANCHOR: Record<string, [number, number]> = {
  head: [0, -16], chest: [0, -10], legs: [0, -5], feet: [0, -1], weapon: [5, -6.5], relic: [-5, -7],
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
    // -----------------------------------------------------------------------
    // NEW PATTERNS
    // -----------------------------------------------------------------------
    case "nova": {
      // Expanding burst rings that fade out from the body.
      if (!front) break;
      const bursts = 3;
      for (let b = 0; b < bursts; b++) {
        const life = (Math.abs(T) * 0.4 + b / bursts) % 1;
        const r = life * R * 1.8;
        const alpha = 1 - life;
        if (alpha < 0.1) continue;
        const dots = 8 + n;
        for (let i = 0; i < dots; i++) {
          if (life > 0.6 && i % 3 !== 0) continue;
          const a = (i / dots) * Math.PI * 2;
          px(ctx, Math.cos(a) * r, -10 * k + lift + Math.sin(a) * r * 0.34,
            palFor(c, i)[life < 0.25 ? 3 : life < 0.5 ? 2 : 1]!);
        }
      }
      break;
    }
    case "tendrils": {
      // Slow sinuous lines that grow upward like roots or vines.
      if (!front) break;
      const arms = Math.max(2, Math.round(n / 2));
      for (let i = 0; i < arms; i++) {
        const phase = hash(c.seed + i * 11);
        const life = (Math.abs(T) * 0.28 + phase) % 1;
        const baseX = (hash(c.seed + i * 7) - 0.5) * R * 1.4;
        const steps = 8;
        for (let j = 0; j < steps; j++) {
          const u = (j / steps) * life;
          const wx = baseX + Math.sin(t * 1.4 + i * 2.3 + u * 5) * 3 * k;
          const wy = lift - u * H * 1.1;
          px(ctx, wx, wy, palFor(c, i)[u > 0.7 ? 3 : u > 0.35 ? 2 : 1]!);
        }
      }
      break;
    }
    case "rune": {
      // A slowly rotating runic character drawn on the ground plane, back layer only.
      if (front) break;
      const rot2 = T * 0.45;
      const r = R * 1.1;
      // Draw three concentric geometric lines for a rune feel.
      for (let ring = 0; ring < 3; ring++) {
        const rr = r * (0.4 + ring * 0.3);
        const sides2 = 3 + ring + g.sides % 3;
        for (let s = 0; s < sides2; s++) {
          const a0 = rot2 + (s / sides2) * Math.PI * 2;
          const a1 = rot2 + ((s + 0.5) / sides2) * Math.PI * 2;
          const steps = 5;
          for (let j = 0; j <= steps; j++) {
            const u = j / steps;
            const x = Math.cos(a0 + (a1 - a0) * u) * rr;
            const y = Math.sin(a0 + (a1 - a0) * u) * rr * 0.3;
            px(ctx, x, y, palFor(c, s)[ring === 2 ? 3 : ring === 1 ? 2 : 1]!);
          }
        }
      }
      break;
    }
    case "swarm": {
      // Many tiny particles that cluster and scatter erratically.
      if (!front) break;
      for (let i = 0; i < n; i++) {
        const ox = Math.sin(t * (1.1 + hash(c.seed + i) * 0.8) + i * 1.9) * R * 0.9;
        const oy = Math.cos(t * (0.9 + hash(c.seed + i * 3) * 0.6) + i * 2.7) * R * 0.55;
        const flicker = Math.floor(t * 14 + i * 3) % 5;
        if (flicker === 0) continue;
        px(ctx, ox, -10 * k + oy + lift, palFor(c, i)[flicker === 1 ? 3 : 2]!);
      }
      break;
    }
    case "ribbons": {
      // Flowing horizontal bands that weave through the body.
      if (!front) break;
      const bands = Math.max(2, Math.round(n / 3));
      for (let b = 0; b < bands; b++) {
        const baseY = -6 * k - (b / bands) * H * 0.7 + lift;
        const steps = 10;
        for (let j = 0; j < steps; j++) {
          const u = j / steps;
          const x = (u - 0.5) * R * 2.2;
          const y = baseY + Math.sin(u * Math.PI * 2 * (1 + b * 0.5) + T * 1.8) * 3 * k;
          px(ctx, x, y, palFor(c, b)[j === 0 || j === steps - 1 ? 1 : b % 2 === 0 ? 3 : 2]!);
        }
      }
      break;
    }
    case "flicker": {
      // Rapid random pixel bursts like static electricity.
      if (!front) break;
      const frame = Math.floor(t * 20);
      for (let i = 0; i < n * 2; i++) {
        if (hash(c.seed + i + frame * 17) > 0.38) continue;
        const x = (hash(c.seed + i * 5 + frame) - 0.5) * R * 2;
        const y = -hash(c.seed + i * 9 + frame) * H + lift;
        px(ctx, x, y, palFor(c, i)[hash(c.seed + i * 3 + frame) > 0.5 ? 3 : 2]!);
      }
      break;
    }
    case "aurora": {
      // Soft curtain of light columns, front layer, drifting sideways.
      if (!front) break;
      const cols = Math.max(3, n);
      for (let i = 0; i < cols; i++) {
        const drift = Math.sin(t * 0.7 + i * 1.4) * 4 * k;
        const baseX = ((i / cols) - 0.5) * R * 2.4 + drift;
        const colH = (0.5 + hash(c.seed + i) * 0.5) * H;
        const steps = 7;
        for (let j = 0; j < steps; j++) {
          const u = j / steps;
          const flicker2 = (Math.sin(t * 3.2 + i + u * 2) + 1) / 2;
          if (flicker2 < 0.3) continue;
          px(ctx, baseX + Math.sin(u * 4 + t + i) * P, lift - u * colH, palFor(c, i)[u < 0.2 ? 1 : u < 0.6 ? 2 : 3]!);
        }
      }
      break;
    }
    case "void_rift": {
      // Inward-pulling streaks converging on the actor's center, back layer.
      if (front) break;
      const spokes = Math.max(4, n);
      for (let i = 0; i < spokes; i++) {
        const a = T * 0.8 + (i / spokes) * Math.PI * 2;
        const life2 = (Math.abs(T) * 0.5 + hash(c.seed + i * 7)) % 1;
        const outerR = R * 1.4 * (1 - life2 * 0.6);
        const steps = 5;
        for (let j = 0; j < steps; j++) {
          const u = (j / steps) * life2;
          px(ctx, Math.cos(a) * outerR * (1 - u * 0.85), Math.sin(a) * outerR * 0.3 * (1 - u * 0.85) - 9 * k + lift,
            palFor(c, i)[j === 0 ? 2 : j >= steps - 1 ? 3 : 1]!);
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

const COUNT_BY_QUALITY = [0, 0, 2, 3, 4, 6];

// ---------------------------------------------------------------------------
// Signatures: wings, tails, trails, crowns and familiars
// ---------------------------------------------------------------------------

type Sig = { ctx: C; t: number; s: number; pal: Pal4; alt: Pal4; g: FxGene; tr: FxTrait; flip: number; q: number };

function seg(ctx: C, x0: number, y0: number, x1: number, y1: number, c: string) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / P));
  for (let i = 0; i <= n; i++) px(ctx, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
}

/**
 * Wings — six styles total (styles 0-3 original, 4-5 new).
 * Drawn behind the body on the back layer.
 */
function drawWings(c: Sig) {
  const { ctx, t, s, pal, alt, g, tr } = c;
  const flap = Math.sin(t * (2.2 + g.speed * 1.4) + g.phase * 6);
  const size = tr.size * s;
  const rootY = -12 * s;
  const angles = [-1.15, -0.62, -0.12];
  const lengths = [11, 15, 10.5];
  for (const side of [-1, 1]) {
    const rx = side * 2 * s;
    const tips = angles.map((a, i) => {
      const ang = a - flap * 0.22 * (1 - i * 0.25);
      const L = lengths[i]! * size;
      return [rx + Math.cos(ang) * L * side, rootY + Math.sin(ang) * L] as const;
    });
    switch (tr.style) {
      case 0: {
        // Feathered — long quills with barbs; tip and accent colour on every other barb.
        for (let i = 0; i < tips.length; i++) {
          const [tx, ty] = tips[i]!;
          const n = Math.ceil(Math.hypot(tx - rx, ty - rootY) / P);
          for (let j = 0; j <= n; j++) {
            const u = j / n;
            const x = rx + (tx - rx) * u, y = rootY + (ty - rootY) * u;
            px(ctx, x, y, pal[u > 0.8 ? 3 : u > 0.4 ? 2 : 1]);
            if (j % 2 === 0 && u > 0.2) px(ctx, x, y + P, (i % 2 && g.accent ? alt : pal)[u > 0.7 ? 2 : 1]);
          }
          // Extra tip highlight for feathered — glinting pixel at the very end.
          const [ftx, fty] = tips[tips.length - 1]!;
          if (i === tips.length - 1) {
            const glit = (Math.floor(t * 8) % 4 === 0);
            if (glit) px(ctx, ftx, fty - P, pal[3]);
          }
        }
        break;
      }
      case 1: {
        // Demon — dark bone spars with a scalloped membrane; now with a pulsing vein line.
        for (let i = 0; i < tips.length - 1; i++) {
          const [ax, ay] = tips[i]!, [bx, by] = tips[i + 1]!;
          for (let u = 0.15; u < 1; u += 0.12) for (let v = 0.1; v < 1; v += 0.18) {
            const x = rx + ((ax - rx) * (1 - v) + (bx - rx) * v) * u;
            const y = rootY + ((ay - rootY) * (1 - v) + (by - rootY) * v) * u + Math.sin(v * Math.PI) * 2 * u;
            px(ctx, x, y, u > 0.85 ? pal[2] : pal[1]);
          }
        }
        for (const [tx, ty] of tips) { seg(ctx, rx, rootY, tx, ty, pal[0]); px(ctx, tx, ty - P, pal[3]); }
        // Vein pulse along the primary spar.
        {
          const [tx, ty] = tips[0]!;
          const veinPulse = (t * 1.8 + g.phase * 4) % 1;
          const vn = Math.ceil(Math.hypot(tx - rx, ty - rootY) / (P * 2));
          for (let j = 0; j <= vn; j++) {
            const u = j / vn;
            const lit = Math.abs(u - veinPulse) < 0.1;
            if (lit) px(ctx, rx + (tx - rx) * u, rootY + (ty - rootY) * u, pal[3]);
          }
        }
        break;
      }
      case 2: {
        // Crystal — floating shards fanned along the wing; each shard bobs independently.
        tips.forEach(([tx, ty], i) => {
          for (let u = 0.35; u <= 1; u += 0.32) {
            const bob = Math.sin(t * 3 + i + u * 4) * P;
            shape(ctx, "diamond", rx + (tx - rx) * u, rootY + (ty - rootY) * u + bob, i % 2 && g.accent ? alt : pal, u > 0.9 ? 3 : 2, 2);
          }
        });
        // Crystal lattice connector lines between shard positions.
        for (let i = 0; i < tips.length - 1; i++) {
          const [ax, ay] = tips[i]!, [bx, by] = tips[i + 1]!;
          const steps = 4;
          for (let j = 0; j <= steps; j++) {
            const u = j / steps;
            px(ctx, ax + (bx - ax) * u, ay + (by - ay) * u, pal[1]);
          }
        }
        break;
      }
      case 3: {
        // Spirit — glowing dotted outline that pulses from root to tip.
        const pulse = (t * 1.4 + g.phase) % 1;
        const pts = [[rx, rootY], ...tips, [rx + side * 3 * s, -7 * s]] as const;
        for (let i = 0; i < pts.length - 1; i++) {
          const [x0, y0] = pts[i]!, [x1, y1] = pts[i + 1]!;
          const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (P * 2));
          for (let j = 0; j <= n; j++) {
            const u = (i + j / n) / (pts.length - 1);
            const lit = Math.abs(u - pulse) < 0.12;
            px(ctx, x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n, lit ? alt[3] : pal[2]);
          }
        }
        // Spirit: add soft scattered motes drifting upward from wing tips.
        for (let i = 0; i < tips.length; i++) {
          const [tx, ty] = tips[i]!;
          const mLife = (t * 0.9 + i * 0.4 + g.phase) % 1;
          if (mLife < 0.7) px(ctx, tx + (hash(i * 13 + Math.floor(t)) - 0.5) * 4,
            ty - mLife * 8 * s, pal[mLife < 0.3 ? 3 : 2]);
        }
        break;
      }
      case 4: {
        // NEW — Moth Wings: broad rounded membrane with a dusted scale pattern.
        const outerAngles = [-1.4, -0.85, -0.35, 0.05];
        const outerLens = [10, 14.5, 14, 9];
        const mothTips = outerAngles.map((a, i) => {
          const ang = a - flap * 0.18 * (1 - i * 0.2);
          const L = (outerLens[i]!) * size;
          return [rx + Math.cos(ang) * L * side, rootY + Math.sin(ang) * L] as const;
        });
        // Fill membrane between each pair of spars with scattered dots (scales).
        for (let i = 0; i < mothTips.length - 1; i++) {
          const [ax, ay] = mothTips[i]!, [bx, by] = mothTips[i + 1]!;
          for (let u = 0.1; u < 1; u += 0.11) {
            for (let v = 0.08; v < 1; v += 0.15) {
              const x = rx + ((ax - rx) * (1 - v) + (bx - rx) * v) * u;
              const y = rootY + ((ay - rootY) * (1 - v) + (by - rootY) * v) * u;
              const scaleFlick = hash(i * 31 + Math.floor(u * 7) + Math.floor(v * 5));
              px(ctx, x, y, (scaleFlick > 0.7 && g.accent ? alt : pal)[scaleFlick > 0.85 ? 3 : u > 0.6 ? 2 : 1]);
            }
          }
        }
        // Outline spars.
        for (const [tx, ty] of mothTips) seg(ctx, rx, rootY, tx, ty, pal[0]);
        // Eyespot on the lower wing: a ring + center dot.
        const [ex, ey] = mothTips[2]!;
        const eyeX = rx + (ex - rx) * 0.6, eyeY = rootY + (ey - rootY) * 0.6;
        const eyeR = 2.5 * size;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          px(ctx, eyeX + Math.cos(a) * eyeR, eyeY + Math.sin(a) * eyeR * 0.55, pal[3]);
        }
        px(ctx, eyeX, eyeY, alt[3]);
        break;
      }
      case 5: {
        // NEW — Void Wings: inky black membranes with drifting rifts of light bleeding through.
        for (let i = 0; i < tips.length - 1; i++) {
          const [ax, ay] = tips[i]!, [bx, by] = tips[i + 1]!;
          for (let u = 0.08; u < 1; u += 0.1) for (let v = 0.06; v < 1; v += 0.14) {
            const x = rx + ((ax - rx) * (1 - v) + (bx - rx) * v) * u;
            const y = rootY + ((ay - rootY) * (1 - v) + (by - rootY) * v) * u;
            px(ctx, x, y, pal[0]); // dark fill
          }
        }
        // Rifts: short bright streaks that drift along the membrane.
        const rifts = 4;
        for (let r = 0; r < rifts; r++) {
          const riftPhase = (t * 0.6 + r / rifts + g.phase) % 1;
          const wi = Math.floor(riftPhase * (tips.length - 1));
          if (wi >= tips.length - 1) continue;
          const [ax, ay] = tips[wi]!, [bx, by] = tips[wi + 1]!;
          const u = 0.2 + (riftPhase % (1 / (tips.length - 1))) * (tips.length - 1) * 0.6;
          const cx2 = rx + ((ax - rx) * 0.5 + (bx - rx) * 0.5) * u;
          const cy2 = rootY + ((ay - rootY) * 0.5 + (by - rootY) * 0.5) * u;
          for (let j = 0; j < 3; j++) {
            px(ctx, cx2 + j * P * side, cy2, (g.accent ? alt : pal)[j === 0 ? 3 : 2]);
          }
        }
        // Spar outlines with highlight tips.
        for (const [tx, ty] of tips) { seg(ctx, rx, rootY, tx, ty, pal[1]); px(ctx, tx, ty, pal[3]); }
        break;
      }
    }
  }
}

/** A tail swings out behind the hips, opposite the way you face. */
function drawTail(c: Sig) {
  const { ctx, t, s, pal, alt, g, tr, flip } = c;
  const back = -flip;
  const n = 9;
  const len = 2.1 * s * tr.size;
  let x = back * 3 * s, y = -6 * s;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const ang = 0.35 + u * 0.9 + Math.sin(t * (2 + g.speed) - u * 3.2 + g.phase * 5) * 0.55 * u;
    x += back * Math.cos(ang - 0.6) * len;
    y += -Math.sin(ang - 0.4) * len * 0.8;
    pts.push([x, y]);
  }
  pts.forEach(([px0, py0], i) => {
    const u = i / n;
    switch (tr.style) {
      case 0: // Demon tail: thick base thinning to a spade.
        px(ctx, px0, py0, pal[u > 0.6 ? 2 : 1], u < 0.4 ? 2 : 1);
        break;
      case 1: { // Flame whip: flickering segments with sparks.
        const flick = Math.floor(t * 16 + i) % 3;
        px(ctx, px0, py0, pal[flick === 0 ? 3 : 2], u < 0.3 ? 2 : 1);
        if (flick === 0 && u > 0.5) px(ctx, px0, py0 - 2 * P, pal[3]);
        break;
      }
      case 2: // Wisp tail: fading dots.
        if (Math.floor(t * 10 + i) % 4) px(ctx, px0, py0, (u > 0.5 ? alt : pal)[u > 0.7 ? 3 : 2]);
        break;
      default: // Orb chain.
        if (i % 2 === 0) shape(ctx, "ring", px0, py0, i % 4 ? pal : alt, 2, u > 0.7 ? 2 : 1);
    }
  });
  const [ex, ey] = pts[pts.length - 1]!;
  if (tr.style === 0) { // Spade tip.
    px(ctx, ex, ey, pal[3]); px(ctx, ex + back * P, ey - P, pal[2]); px(ctx, ex + back * P, ey + P, pal[2]); px(ctx, ex + back * 2 * P, ey, pal[3]); px(ctx, ex - back * P, ey - 2 * P, pal[2]); px(ctx, ex - back * P, ey + 2 * P, pal[2]);
  } else if (tr.style === 1) {
    for (let j = 0; j < 3; j++) px(ctx, ex + (hash(Math.floor(t * 12) + j) - 0.5) * 6, ey - j * P * 2 - ((t * 20) % 4), pal[3 - (j % 2)]);
  }
}

/** Head pieces sit on or above the head. */
function drawCrown(c: Sig, front: boolean) {
  const { ctx, t, s, pal, alt, g, tr } = c;
  const top = -19 * s;
  switch (tr.style) {
    case 0: { // Halo: a tilted ring above the head.
      const n = 16;
      for (let i = 0; i < n; i++) {
        const a = t * 1.1 * g.dir + (i / n) * Math.PI * 2;
        const depth = Math.sin(a);
        if ((depth >= 0) !== front) continue;
        px(ctx, Math.cos(a) * 5 * s * tr.size, top - 2 * s + depth * 1.4 * s, pal[i % 4 === 0 ? 3 : 2]);
      }
      break;
    }
    case 1: { // Horns.
      if (!front) break;
      for (const side of [-1, 1]) for (let j = 0; j < 5; j++) {
        const u = j / 4;
        px(ctx, side * (3 * s + u * 2.4 * s * tr.size), -16 * s - u * 3.5 * s * tr.size + u * u * 1.6 * s, pal[u > 0.7 ? 3 : u > 0.3 ? 2 : 1]);
      }
      break;
    }
    case 2: { // Shard crown: small diamonds circling above the head.
      const m = 5;
      for (let i = 0; i < m; i++) {
        const a = t * 0.9 * g.dir + (i / m) * Math.PI * 2;
        const depth = Math.sin(a);
        if ((depth >= 0) !== front) continue;
        shape(ctx, "diamond", Math.cos(a) * 5 * s, top - 3 * s + depth * s + Math.sin(t * 3 + i) * P, i % 2 && g.accent ? alt : pal, 2, 1);
      }
      break;
    }
    default: { // Third eye.
      if (!front) break;
      const open = (Math.sin(t * 1.3 + g.phase * 6) + 1) / 2;
      shape(ctx, "diamond", 0, -14 * s, pal, open > 0.5 ? 3 : 2, open > 0.7 ? 2 : 1);
    }
  }
}

/** One companion that orbits wide around you, with a short tail. */
function drawFamiliar(c: Sig, front: boolean) {
  const { ctx, t, s, pal, alt, g, tr } = c;
  const R = 15 * s * tr.size;
  for (let j = 5; j >= 0; j--) {
    const a = t * (0.9 + g.speed * 0.5) * g.dir + g.phase * 6 - j * 0.09 * g.dir;
    const depth = Math.sin(a);
    if ((depth >= 0) !== front) continue;
    const x = Math.cos(a) * R, y = -11 * s + depth * R * 0.32 + Math.sin(t * 2.4) * 2 * s;
    if (j > 0) { px(ctx, x, y, (g.accent ? alt : pal)[Math.max(0, 3 - j)]); continue; }
    if (tr.style === 0) shape(ctx, "block", x, y, pal, 3, 2);
    else if (tr.style === 1) shape(ctx, "star", x, y, pal, 3, 2);
    else { px(ctx, x, y, pal[3], 2); px(ctx, x + 2 * P, y, pal[0]); px(ctx, x + P * 2, y + P, pal[0]); }
  }
}

/** Trails need where the wearer was: a short position history per trail piece. */
type TrailPt = { x: number; y: number; t: number };
const trails = new Map<number, TrailPt[]>();
function trackTrail(key: number, x: number, y: number, t: number, keep: number): TrailPt[] {
  let list = trails.get(key);
  if (!list) { list = []; trails.set(key, list); if (trails.size > 64) trails.delete(trails.keys().next().value as number); }
  const last = list[list.length - 1];
  if (last && last.t > t + 1) list.length = 0; // clock reset
  if (!last || Math.hypot(last.x - x, last.y - y) > 5) list.push({ x, y, t });
  while (list.length && t - list[0]!.t > keep) list.shift();
  return list;
}
function drawTrail(c: Sig, ax: number, ay: number, key: number) {
  const { ctx, t, s, pal, alt, tr } = c;
  const keep = tr.style === 1 ? 1.6 : 0.55;
  const list = trackTrail(key, ax, ay, t, keep);
  list.forEach((p, i) => {
    const age = (t - p.t) / keep;
    if (age >= 1) return;
    const x = p.x - ax, y = p.y - ay;
    switch (tr.style) {
      case 0: // Afterimages: a fading body-shaped column.
        if (i % 2) break;
        for (let h = 0; h < 16; h += 2) if (hash(i * 31 + h) > age) px(ctx, x + (h % 4 ? P : -P), y - h * s * 0.55 - 4, pal[age < 0.3 ? 3 : 2]);
        break;
      case 1: // Footprints.
        if (i % 2) break;
        px(ctx, x + (i % 4 ? 3 : -3), y - 1, pal[age < 0.4 ? 2 : 1]);
        break;
      case 2: // Ribbon at the waist.
        px(ctx, x, y - 8 * s + Math.sin(p.t * 9) * 2, (i % 2 ? alt : pal)[age < 0.4 ? 3 : 2]);
        break;
      default: // Spark wake.
        if (hash(i * 7 + Math.floor(t * 10)) > 0.45) px(ctx, x + (hash(i) - 0.5) * 8, y - 2 - age * 14, pal[age < 0.3 ? 3 : 2]);
    }
  });
}

// ---------------------------------------------------------------------------
// Pet: a custom-sprite companion that wanders near the player.
// Spawns with ~5% chance on Rare+ gear rolls (checked once per piece at equip
// time, stored as petSeed on the actor). Uses the player's own custom sprite.
// ---------------------------------------------------------------------------

/** Per-actor wandering state, keyed by a stable actor id derived from piece seeds. */
type PetState = { ox: number; oy: number; tx: number; ty: number; lastStep: number };
const petStates = new Map<number, PetState>();

const PET_SPAWN_CHANCE = 0.05; // 5% — keep it rare

/**
 * Returns true if this gear set should show a pet right now.
 * Evaluated from the combined seed of all Rare+ pieces so it's stable
 * across frames but can change when gear changes.
 */
export function shouldSpawnPet(pieces: Piece[]): boolean {
  const eligible = pieces.filter((p) => p.quality >= 3);
  if (!eligible.length) return false;
  const combinedSeed = eligible.reduce((acc, p) => acc ^ seedOf(p), 0);
  // One stable float from the combined seed — no per-frame randomness.
  const x = Math.sin(combinedSeed * 127.1 + 311.7) * 43758.5453;
  const roll = x - Math.floor(x);
  return roll < PET_SPAWN_CHANCE;
}

/**
 * Draw a pet companion that slowly wanders near the player using their
 * custom sprite colours. The pet is rendered as a small (half-scale)
 * pixel character using the palette of the lead piece.
 */
function drawPet(ctx: C, a: Actor, t: number, s: number, pal: Pal4) {
  // Stable key from the actor's position seed.
  const stateKey = Math.round(a.x * 0.1 + a.y * 0.13) & 0xffffff;
  let pet = petStates.get(stateKey);
  if (!pet) {
    pet = { ox: 18 * s, oy: 0, tx: 18 * s, ty: 0, lastStep: t };
    petStates.set(stateKey, pet);
    if (petStates.size > 32) petStates.delete(petStates.keys().next().value as number);
  }

  // Pick a new wander target every 2–4 seconds.
  const wanderInterval = 2.5 + hash(stateKey) * 1.5;
  if (t - pet.lastStep > wanderInterval) {
    pet.tx = (hash(stateKey + Math.floor(t)) - 0.5) * 40 * s;
    pet.ty = (hash(stateKey + Math.floor(t) * 7) - 0.5) * 20 * s;
    pet.lastStep = t;
  }

  // Smoothly move offset toward target (lerp per frame, approx 60fps).
  const lerpSpeed = 0.018;
  pet.ox += (pet.tx - pet.ox) * lerpSpeed;
  pet.oy += (pet.ty - pet.oy) * lerpSpeed;

  const px2 = Math.round(pet.ox / P) * P;
  const py2 = Math.round(pet.oy / P) * P;
  const ps = s * 0.5; // half-scale

  // Bob gently.
  const bob = Math.sin(t * 2.8 + stateKey) * P;

  ctx.save();
  ctx.translate(px2, py2 + bob);

  // Body — a tiny pixel sprite: head + torso.
  const [dark, mid, light, hi] = pal;
  // Head
  px(ctx, 0, -6 * ps, light, 2);
  px(ctx, 0, -6 * ps, hi);
  // Eyes
  px(ctx, -P, -6 * ps, dark);
  px(ctx, P, -6 * ps, dark);
  // Torso
  px(ctx, 0, -3 * ps, mid, 2);
  // Legs (walk cycle)
  const step = Math.floor(t * 6) % 2;
  px(ctx, step ? -P : P, -P, dark);
  px(ctx, step ? P : -P, 0, dark);

  // Little shadow dot below.
  px(ctx, 0, P, dark);

  // Soft glow underneath the pet.
  if (Math.floor(t * 4) % 3 !== 0) px(ctx, 0, 0, mid);

  ctx.restore();
}

export function drawGearFx(ctx: C, a: Actor, t: number, s: number, layer: Layer): void {
  const worn = a.pieces.filter((p) => p.quality >= 2);
  if (!worn.length) return;
  const top = worn.reduce((m, p) => Math.max(m, p.quality), 0);
  const lead = worn.slice().sort((x, y) => y.quality - x.quality)[0]!;
  const leadGene = fxGene(seedOf(lead), lead.type, lead.quality);
  const leadPal = PAL[lead.type] ?? PAL.normal;
  const k = s / 2;
  const flip = a.facing < 0 ? -1 : 1;
  const front = layer === "front";
  ctx.save();
  ctx.translate(Math.round(a.x / P) * P, Math.round(a.y / P) * P);
  // One quiet ground ring from the strongest piece, only on Epic and Legendary outfits.
  if (!front && top >= 4) {
    const gap = [0, 2, 3, 4][Math.floor(leadGene.phase * 4)]!;
    dotRing(ctx, 11 * k * leadGene.radius, leadPal[leadGene.shade]!, t * 0.6 * leadGene.dir * leadGene.speed, gap, 0.3 + leadGene.radius * 0.08);
  }
  // Each piece shows itself in its own part of the body. Signatures (wings, tail, trail, crown,
  // familiar) replace the piece's small pattern; ordinary pieces show a small pattern at their spot.
  let budget = 24;
  for (const p of worn.slice().sort((x, y) => y.quality - x.quality)) {
    const seed = seedOf(p);
    const g = fxGene(seed, p.type, p.quality);
    const tr = fxTrait(seed, p.slot, p.quality);
    const pal = PAL[p.type] ?? PAL.normal;
    const alt = g.accent ? PAL[g.accent] ?? pal : pal;
    const sig: Sig = { ctx, t, s, pal, alt, g, tr, flip, q: p.quality };
    if (tr.kind === "wings") { if (!front) drawWings(sig); continue; }
    if (tr.kind === "tail") { if (!front) drawTail(sig); continue; }
    if (tr.kind === "trail") { if (!front) drawTrail(sig, a.x, a.y, seed); continue; }
    if (tr.kind === "crown") { drawCrown(sig, front); continue; }
    if (tr.kind === "familiar") { drawFamiliar(sig, front); continue; }
    if (tr.kind === "imbue") {
      // The weapon itself glows; the rest of the imbue shows up on your verses.
      if (front) {
        const u = (t * 1.6 * g.speed + g.phase) % 1;
        const wx = 7 * s * flip;
        for (let j = 0; j < 3 + p.quality; j++) px(ctx, wx + (j % 2 ? P : 0), (-15 + u * 10) * s + j * P, j === 0 ? alt[3] : pal[2]);
        if (Math.floor(t * 6) % 3 === 0) px(ctx, wx + (hash(Math.floor(t * 6)) - 0.5) * 8, -12 * s - hash(Math.floor(t * 6) + 1) * 8, alt[3]);
      }
      continue;
    }
    if (budget <= 0) continue;
    const n = Math.min(budget, Math.max(2, Math.round(COUNT_BY_QUALITY[p.quality]! * g.density)));
    budget -= n;
    const [lx, ly] = ANCHOR[p.slot] ?? [0, -8];
    // Small and anchored: the pattern is drawn around the piece's own slot, at about half size.
    const kk = k * 0.55;
    ctx.save();
    ctx.translate(Math.round((lx * s * flip * 0.8) / P) * P, Math.round((ly * s + 10 * kk) / P) * P);
    drawPattern({ ctx, t, k: kk, g, pal, alt, n, big: p.quality >= 4 ? 2 : 1, layer, seed: seed % 9973, ax: 0, ay: -10 * kk });
    ctx.restore();
  }
  if (front && top >= 5) motif(ctx, lead.type, t, k * 0.8, top);

  // Pet: drawn on the front layer so it reads over the ground, only when the
  // gear set rolls it (stable 5% chance on Rare+ pieces).
  if (front && shouldSpawnPet(a.pieces)) {
    drawPet(ctx, a, t, s, leadPal);
  }

  ctx.restore();
}

/** The verse layer an imbued weapon adds to your casts, or null. */
export type Imbue = { type: TypeId; accent: TypeId; style: number; quality: number };
export function gearImbue(pieces: Piece[]): Imbue | null {
  for (const p of pieces) {
    if (p.quality < 3) continue;
    const seed = seedOf(p);
    const tr = fxTrait(seed, p.slot, p.quality);
    if (tr.kind !== "imbue") continue;
    const g = fxGene(seed, p.type, p.quality);
    return { type: p.type, accent: g.accent ?? p.type, style: tr.style, quality: p.quality };
  }
  return null;
}
