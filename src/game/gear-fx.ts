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
    case "spark":
      px(ctx, x, y, hi);
      px(ctx, x + P, y - P, main); px(ctx, x - P, y + P, main); px(ctx, x + P, y + P, low); px(ctx, x - P, y - P, low);
      break;
    case "arc": {
      const a = ang || 0;
      for (let i = -1; i <= 1; i++) {
        const aa = a + i * 0.7;
        px(ctx, x + Math.round(Math.cos(aa)) * P, y + Math.round(Math.sin(aa)) * P, i === 0 ? hi : main);
      }
      break;
    }
    case "arrow": {
      const dx = Math.round(Math.cos(ang)) * P, dy = Math.round(Math.sin(ang)) * P;
      px(ctx, x, y, hi); px(ctx, x - dx, y - dy, main);
      px(ctx, x - dx + dy, y - dy - dx, low); px(ctx, x - dx - dy, y - dy + dx, low);
      break;
    }
    case "crystal":
      px(ctx, x, y - P, hi); px(ctx, x, y, main); px(ctx, x - P, y, low); px(ctx, x + P, y, low); px(ctx, x, y + P, main);
      if (big > 1) { px(ctx, x, y - 2 * P, hi); px(ctx, x, y + 2 * P, low); }
      break;
    case "bolt":
      px(ctx, x, y - P, hi); px(ctx, x + P, y, main); px(ctx, x, y + P, main); px(ctx, x + P, y + 2 * P, low);
      break;
    case "orb":
      px(ctx, x, y, main, 2);
      px(ctx, x, y, hi);
      if (big > 1) { px(ctx, x - P, y - P, low); px(ctx, x + P, y + P, low); }
      break;
    case "petal": {
      const dx = Math.round(Math.cos(ang - Math.PI / 2)) * P, dy = Math.round(Math.sin(ang - Math.PI / 2)) * P;
      px(ctx, x, y, hi); px(ctx, x + dx, y + dy, main); px(ctx, x + 2 * dx, y + 2 * dy, low);
      px(ctx, x + dx + dy, y + dy - dx, main); px(ctx, x + dx - dy, y + dy + dx, main);
      break;
    }
    case "ember":
      px(ctx, x, y, hi); px(ctx, x, y + P, main); px(ctx, x, y + 2 * P, low);
      if (big > 1) px(ctx, x + (hash(x + y) > 0.5 ? P : -P), y + P, main);
      break;
    case "splash":
      px(ctx, x, y, hi);
      px(ctx, x + 2 * P, y, low); px(ctx, x - 2 * P, y, low); px(ctx, x, y - 2 * P, low); px(ctx, x, y + 2 * P, low);
      px(ctx, x + P, y + P, main); px(ctx, x - P, y - P, main);
      break;
    case "runedot":
      px(ctx, x, y, hi);
      px(ctx, x + P, y, main); px(ctx, x - P, y, main); px(ctx, x, y + P, main); px(ctx, x, y - P, main);
      px(ctx, x + P, y + P, low); px(ctx, x - P, y - P, low); px(ctx, x + P, y - P, low); px(ctx, x - P, y + P, low);
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
  const R = 13 * k * g.radius;
  const lift = g.lift * 20 * k;
  const H = (28 + 6 * big) * k;
  const front = layer === "front";
  const L = g.shade;
  switch (g.pattern) {
    case "orbit": {
      for (let i = 0; i < n; i++) {
        const a = T * 1.6 + (i / n) * Math.PI * 2;
        const depth = Math.sin(a);
        if ((depth >= 0) !== front) continue;
        // Thin elegant orbiters with a faint trailing spark
        shape(ctx, g.shape === "block" || g.shape === "orb" ? "dot" : g.shape, Math.cos(a) * R * 0.85, -10 * k + lift + depth * R * 0.28, palFor(c, i), L, 1);
        if (i % 2 === 0) px(ctx, Math.cos(a - 0.2) * R * 0.7, -10 * k + lift + depth * R * 0.2, palFor(c, i)[Math.max(1, L-1)]!);
      }
      break;
    }
    case "embers":
    case "motes": {
      if (!front) break;
      const slow = g.pattern === "motes" ? 0.45 : 1;
      for (let i = 0; i < n; i++) {
        const life = (Math.abs(T) * (0.3 + hash(c.seed + i) * 0.4) * slow + hash(c.seed + i * 3)) % 1;
        const x = (hash(c.seed + i * 5) - 0.5) * 1.6 * R + Math.sin(t * 2.5 + i) * (g.pattern === "motes" ? 3 : 1) * k;
        if (life > 0.75 && Math.floor(t * 16 + i) % 3) continue;
        // Prefer small elegant shapes
        const elegant = g.shape === "block" || g.shape === "diamond" ? "dot" : g.shape;
        shape(ctx, elegant, x, lift - life * H * 0.85, palFor(c, i), life < 0.25 ? 3 : L, 1, -Math.PI / 2);
      }
      break;
    }
    case "rain":
    case "petals": {
      if (!front) break;
      for (let i = 0; i < n; i++) {
        const life = (Math.abs(T) * (0.35 + hash(c.seed + i) * 0.3) + hash(c.seed + i * 7)) % 1;
        const sway = g.pattern === "petals" ? Math.sin(t * 2 + i * 1.7) * 4 * k : 0;
        const x = (hash(c.seed + i * 11) - 0.5) * 1.8 * R + sway;
        const y = -H * 0.8 - 4 * k + life * (H * 0.8 + 4 * k) + lift;
        if (life > 0.85) continue;
        shape(ctx, g.pattern === "petals" ? "petal" : (g.shape === "block" ? "dot" : g.shape), x, y, palFor(c, i), L, 1, Math.PI / 2);
      }
      break;
    }
    case "spiral": {
      for (let i = 0; i < n; i++) {
        const life = (Math.abs(T) * 0.45 + i / n) % 1;
        const a = life * Math.PI * 4 * g.dir + i;
        const depth = Math.sin(a);
        if ((depth >= 0) !== front) continue;
        const r = (0.3 + 0.55 * (1 - life)) * R;
        shape(ctx, g.shape === "block" ? "dot" : g.shape, Math.cos(a) * r, lift - life * H * 0.9 + depth * r * 0.25, palFor(c, i), life < 0.25 ? 3 : L, 1);
      }
      break;
    }
    case "ring":
    case "pulse": {
      if (front !== (g.pattern === "pulse")) break;
      const waves = g.pattern === "pulse" ? 1 : 2;
      for (let w = 0; w < waves; w++) {
        const life = (Math.abs(T) * 0.5 + w / waves) % 1;
        const r = life * R * 1.2;
        const dots = 8 + Math.floor(n * 0.7);
        const cy = g.pattern === "pulse" ? -10 * k + lift : 0;
        for (let i = 0; i < dots; i++) {
          if (life > 0.65 && i % 2) continue;
          const a = (i / dots) * Math.PI * 2;
          // Thin ring points instead of chunky
          px(ctx, Math.cos(a) * r, cy + Math.sin(a) * r * (g.pattern === "pulse" ? 0.9 : 0.28), palFor(c, i)[life < 0.35 ? 3 : L]!);
        }
      }
      break;
    }
    case "sparkle": {
      if (!front) break;
      for (let i = 0; i < n; i++) {
        const cyc = Math.floor(Math.abs(T) * 1.5 + hash(c.seed + i));
        const ph = (Math.abs(T) * 1.5 + hash(c.seed + i)) % 1;
        if (ph > 0.45) continue;
        const x = (hash(c.seed + i * 13 + cyc * 7) - 0.5) * 1.7 * R;
        const y = -hash(c.seed + i * 17 + cyc * 3) * H * 0.85 + lift;
        shape(ctx, ph < 0.2 ? "star" : "dot", x, y, palFor(c, i), 3, 1);
      }
      break;
    }
    case "wisps": {
      if (!front) break;
      const heads = Math.max(2, Math.round(n / 2));
      for (let i = 0; i < heads; i++) {
        const life = (Math.abs(T) * 0.35 + i / heads) % 1;
        for (let j = 0; j < 5; j++) {
          const lj = Math.max(0, life - j * 0.035);
          const x = Math.sin(lj * 9 + i * 2.1) * R * 0.7;
          const y = lift - lj * H * 0.9;
          px(ctx, x, y, palFor(c, i)[j === 0 ? 3 : Math.max(1, L - j + 1)]!);
        }
      }
      break;
    }
    case "halo": {
      const dots = 7 + Math.floor(n * 0.6);
      for (let i = 0; i < dots; i++) {
        const a = T * 1.2 + (i / dots) * Math.PI * 2;
        const depth = Math.sin(a);
        if ((depth >= 0) !== front) continue;
        const rx = 6 * k * g.radius;
        px(ctx, Math.cos(a) * rx, -20 * k + lift * 0.3 + depth * rx * 0.22, palFor(c, i)[i % 3 === 0 ? 3 : L]!);
      }
      break;
    }
    case "sigil": {
      if (front) break;
      const sides = g.sides;
      const r = R * 0.95;
      const rot = T * 0.7;
      for (let s = 0; s < sides; s++) {
        const a0 = rot + (s / sides) * Math.PI * 2;
        const a1 = rot + ((s + 1) / sides) * Math.PI * 2;
        const steps = 7;
        for (let j = 0; j <= steps; j++) {
          const u = j / steps;
          const x = Math.cos(a0) * r * (1 - u) + Math.cos(a1) * r * u;
          const y = (Math.sin(a0) * (1 - u) + Math.sin(a1) * u) * r * 0.28;
          px(ctx, x, y, palFor(c, s)[j === 0 || j === steps ? 3 : L]!);
        }
      }
      break;
    }
    case "shards": {
      const m = Math.max(2, Math.round(n * 0.5));
      for (let i = 0; i < m; i++) {
        const a = T * 0.9 + (i / m) * Math.PI * 2;
        const depth = Math.sin(a);
        if ((depth >= 0) !== front) continue;
        const bob = Math.sin(t * 3 + i * 1.3) * 1.5 * k;
        // Smaller, sharper diamonds
        shape(ctx, "diamond", Math.cos(a) * R * 0.9, -11 * k + lift + bob + depth * R * 0.25, palFor(c, i), L, 1);
      }
      break;
    }
    case "comet": {
      const m = 1;
      const tail = 3 + g.sides;
      for (let i = 0; i < m; i++) {
        for (let j = tail; j >= 0; j--) {
          const a = T * 2.2 + (i / m) * Math.PI * 2 - j * 0.14 * g.dir;
          const depth = Math.sin(a);
          if ((depth >= 0) !== front) continue;
          const pal = palFor(c, i);
          const x = Math.cos(a) * R * 0.9, y = -10 * k + lift + depth * R * 0.32;
          if (j === 0) shape(ctx, g.shape === "streak" || g.shape === "block" ? "star" : g.shape, x, y, pal, 3, 1);
          else if (j < 4) px(ctx, x, y, pal[Math.max(1, 3 - Math.ceil((j / tail) * 2))]!);
        }
      }
      break;
    }
    case "helix": {
      const steps = 8 + Math.floor(n * 0.7);
      for (let strand = 0; strand < 2; strand++) {
        for (let j = 0; j < steps; j++) {
          const u = j / steps;
          const a = T * 2 + u * Math.PI * 3 + strand * Math.PI;
          const depth = Math.sin(a);
          if ((depth >= 0) !== front) continue;
          px(ctx, Math.cos(a) * R * 0.65, lift - u * H * 0.85, palFor(c, strand)[u > 0.65 ? 3 : L]!);
        }
      }
      break;
    }
    case "chevrons": {
      if (!front) break;
      const m = Math.max(2, Math.round(n / 2.5));
      for (let i = 0; i < m; i++) {
        const life = (Math.abs(T) * 0.5 + i / m) % 1;
        const y = -16 * k - life * 14 * k + lift;
        const pal = palFor(c, i);
        // Thinner chevrons
        px(ctx, -P, y + P, pal[3]!);
        px(ctx, 0, y, pal[L]!);
        px(ctx, P, y + P, pal[3]!);
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
          px(ctx, Math.cos(a) * outerR * (1 - u), -8 * k + Math.sin(a) * outerR * (1 - u) * 0.3, palFor(c, i)[u < 0.3 ? 1 : u < 0.7 ? 2 : 3]!);
        }
      }
      break;
    }
    case "blossom": {
      if (!front) break;
      const petals = 5 + Math.floor(g.sides / 2);
      for (let i = 0; i < petals; i++) {
        const a = T * 0.6 + (i / petals) * Math.PI * 2;
        const life = (Math.abs(T) * 0.3 + i * 0.15) % 1;
        const r = (0.4 + life * 0.6) * R;
        shape(ctx, "petal", Math.cos(a) * r, -12 * k + lift + Math.sin(a) * r * 0.4, palFor(c, i), life < 0.4 ? 3 : L, big, a);
      }
      break;
    }
    case "cyclone": {
      const layers = 3;
      for (let Lr = 0; Lr < layers; Lr++) {
        const rr = R * (0.5 + Lr * 0.3);
        const steps = 8 + n / 2;
        for (let j = 0; j < steps; j++) {
          const u = j / steps;
          const a = T * (1.2 + Lr * 0.3) + u * Math.PI * 4;
          const depth = Math.sin(a);
          if ((depth >= 0) !== front) continue;
          px(ctx, Math.cos(a) * rr * (1 - u * 0.3), lift - u * H * 0.7 + depth * 2, palFor(c, Lr)[u > 0.6 ? 3 : 2]!);
        }
      }
      break;
    }
    case "meteor": {
      if (!front) break;
      const m = 2 + Math.floor(big);
      for (let i = 0; i < m; i++) {
        const a = T * 1.8 + (i / m) * Math.PI * 2;
        const life = (Math.abs(T) * 0.6 + i * 0.2) % 1;
        const r = R * (1.2 - life * 0.4);
        shape(ctx, "streak", Math.cos(a) * r, -10 * k + lift + Math.sin(a) * r * 0.3, palFor(c, i), 3, big, a);
      }
      break;
    }
    case "fireflies": {
      if (!front) break;
      for (let i = 0; i < n; i++) {
        const life = (Math.abs(T) * 0.25 + hash(c.seed + i)) % 1;
        const x = Math.sin(t * 0.8 + i * 1.3) * R * 0.9;
        const y = -8 * k + Math.cos(t * 0.6 + i * 1.7) * R * 0.5 + lift;
        if (Math.floor(t * 12 + i) % 4 === 0) shape(ctx, "dot", x, y, palFor(c, i), 3, 1);
      }
      break;
    }
    case "lattice": {
      if (front) break;
      const grid = 4 + Math.floor(n / 2);
      for (let ix = 0; ix < grid; ix++) for (let iy = 0; iy < grid; iy++) {
        const x = (ix / (grid - 1) - 0.5) * R * 2;
        const y = (iy / (grid - 1) - 0.5) * R * 0.8;
        if ((ix + iy) % 2 === 0) px(ctx, x, y, palFor(c, ix + iy)[2]!);
      }
      break;
    }
    case "fountain": {
      if (!front) break;
      for (let i = 0; i < n; i++) {
        const life = (Math.abs(T) * 0.4 + hash(c.seed + i)) % 1;
        const ang = (hash(c.seed + i * 5) - 0.5) * 0.8;
        const x = Math.sin(ang) * life * R * 1.2;
        const y = lift - life * H * 0.8 + Math.sin(life * Math.PI) * 4 * k;
        shape(ctx, g.shape, x, y, palFor(c, i), life < 0.3 ? 3 : L, 1);
      }
      break;
    }
    case "crescents": {
      const m = 3;
      for (let i = 0; i < m; i++) {
        const a = T * 0.9 + (i / m) * Math.PI * 2;
        const depth = Math.sin(a);
        if ((depth >= 0) !== front) continue;
        const r = R * 0.9;
        for (let j = -2; j <= 2; j++) {
          const aa = a + j * 0.15;
          px(ctx, Math.cos(aa) * r, -10 * k + lift + Math.sin(aa) * r * 0.3, palFor(c, i)[Math.abs(j) === 0 ? 3 : 2]!);
        }
      }
      break;
    }
    case "vortex": {
      const steps = 12 + n;
      for (let j = 0; j < steps; j++) {
        const u = j / steps;
        const a = T * 1.5 + u * Math.PI * 6;
        const depth = Math.sin(a);
        if ((depth >= 0) !== front) continue;
        const r = R * (1 - u * 0.7);
        px(ctx, Math.cos(a) * r, lift - u * H * 0.5 + depth * r * 0.2, palFor(c, j)[u > 0.7 ? 3 : 2]!);
      }
      break;
    }
    case "static_fuzz": {
      if (!front) break;
      const frame = Math.floor(t * 24);
      for (let i = 0; i < n * 3; i++) {
        if (hash(c.seed + i + frame) > 0.55) continue;
        const x = (hash(c.seed + i * 3 + frame) - 0.5) * R * 1.8;
        const y = -hash(c.seed + i * 7 + frame) * H * 0.8 + lift;
        px(ctx, x, y, palFor(c, i)[3]!);
      }
      break;
    }
    case "bloom_rings": {
      if (front) break;
      for (let w = 0; w < 3; w++) {
        const life = (Math.abs(T) * 0.35 + w / 3) % 1;
        const r = life * R * 1.6;
        const dots = 12 + n;
        for (let i = 0; i < dots; i++) {
          if (life > 0.65 && i % 2) continue;
          const a = (i / dots) * Math.PI * 2 + T * 0.2;
          px(ctx, Math.cos(a) * r, Math.sin(a) * r * 0.3, palFor(c, i)[life < 0.3 ? 3 : 2]!);
        }
      }
      break;
    }
    case "snowfall": {
      if (!front) break;
      for (let i = 0; i < n; i++) {
        const life = (Math.abs(T) * 0.2 + hash(c.seed + i)) % 1;
        const x = (hash(c.seed + i * 9) - 0.5) * 2.4 * R + Math.sin(t * 0.5 + i) * 3 * k;
        const y = -H + life * (H + 8 * k) + lift;
        if (life > 0.85) continue;
        shape(ctx, "dot", x, y, palFor(c, i), L, 1);
      }
      break;
    }
    case "emberstorm": {
      if (!front) break;
      for (let i = 0; i < n; i++) {
        const life = (Math.abs(T) * 0.55 + hash(c.seed + i)) % 1;
        const x = (hash(c.seed + i * 13) - 0.5) * R * 1.6 + Math.sin(t * 3 + i) * 2 * k;
        const y = lift - life * H * 1.1;
        shape(ctx, "ember", x, y, palFor(c, i), life < 0.4 ? 3 : L, big);
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Ground ring, set auras, and the rare signature shapes
// ---------------------------------------------------------------------------

function ring(ctx: C, r: number, cy: number, c: string, gap = 0, rot = 0) {
  const n = Math.max(8, Math.floor((r * 6.3) / P));
  for (let i = 0; i < n; i++) {
    if (gap && i % gap === 0) continue;
    const a = (i / n) * Math.PI * 2 + rot;
    px(ctx, Math.cos(a) * r, cy + Math.sin(a) * r * 0.34, c);
  }
}

/** The strongest piece's ground ring (and the second/third for epic+). */
function drawRings(ctx: C, t: number, k: number, pieces: Piece[], lead: Piece, g: FxGene, pal: Pal4): void {
  const power = gearPower(pieces);
  const r0 = (8 + Math.min(power, 8) * 1.4) * k * g.radius;
  const cy = 1;
  ring(ctx, r0, cy, pal[1], g.sides, t * 0.4 * g.dir);
  if (lead.quality >= 4) ring(ctx, r0 * 0.62, cy, pal[2], 0, -t * 0.6 * g.dir);
  if (lead.quality >= 5) ring(ctx, r0 * 1.35, cy, pal[0], g.sides + 1, t * 0.25 * g.dir);
}

function motif(ctx: C, type: TypeId, t: number, k: number, quality: number): void {
  // Element signature motif drawn at the feet for epic+.
  const pal = PAL[type] ?? PAL.normal;
  const m = quality >= 5 ? 5 : 3;
  for (let i = 0; i < m; i++) {
    const a = t * 0.8 + (i / m) * Math.PI * 2;
    const r = 6 * k;
    px(ctx, Math.cos(a) * r, 2 + Math.sin(a) * r * 0.3, pal[i % 2 ? 3 : 2]);
  }
}

// ---------------------------------------------------------------------------
// Signature traits
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
          for (let u = 0.15; u < 1; u += 0.09) for (let v = 0.1; v < 1; v += 0.12) {
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
        break;
      }
      case 4: {
        // NEW — Moth Wings: broad rounded membrane with a dusted scale pattern.
        for (let i = 0; i < tips.length - 1; i++) {
          const [ax, ay] = tips[i]!, [bx, by] = tips[i + 1]!;
          for (let u = 0.2; u < 1; u += 0.08) for (let v = 0.15; v < 1; v += 0.1) {
            const x = rx + ((ax - rx) * (1 - v) + (bx - rx) * v) * u;
            const y = rootY + ((ay - rootY) * (1 - v) + (by - rootY) * v) * u + Math.sin(v * Math.PI) * 3 * u;
            const scale = hash(i * 17 + Math.floor(u * 10) + Math.floor(v * 10)) > 0.6;
            px(ctx, x, y, scale ? (i % 2 ? alt[2] : pal[2]) : pal[1]);
          }
        }
        // Eyespot on lower wing
        const [ltx, lty] = tips[tips.length - 1]!;
        px(ctx, ltx, lty, pal[3], 2);
        px(ctx, ltx + side * P, lty - P, alt[3]);
        break;
      }
      case 5: {
        // NEW — Void Wings: inky black membranes with drifting rifts of light bleeding through.
        for (let i = 0; i < tips.length - 1; i++) {
          const [ax, ay] = tips[i]!, [bx, by] = tips[i + 1]!;
          for (let u = 0.1; u < 1; u += 0.07) for (let v = 0.1; v < 1; v += 0.08) {
            const x = rx + ((ax - rx) * (1 - v) + (bx - rx) * v) * u;
            const y = rootY + ((ay - rootY) * (1 - v) + (by - rootY) * v) * u;
            const rift = hash(i * 31 + Math.floor(t * 3 + u * 5 + v * 7)) > 0.82;
            px(ctx, x, y, rift ? alt[3] : pal[0]);
          }
        }
        break;
      }
      case 6: {
        // NEW — Insect Wings: two narrow fast-fluttering pairs with dotted veins.
        const flutter = Math.sin(t * 12 + g.phase * 8);
        for (const [tx, ty] of tips) {
          const n = Math.ceil(Math.hypot(tx - rx, ty - rootY) / P);
          for (let j = 0; j <= n; j += 2) {
            const u = j / n;
            const x = rx + (tx - rx) * u + flutter * P * (1 - u);
            const y = rootY + (ty - rootY) * u;
            px(ctx, x, y, u > 0.7 ? pal[3] : pal[2]);
          }
        }
        break;
      }
      default: {
        // NEW — Prism Wings (style 7+): fanned translucent shards cycling through the accent.
        tips.forEach(([tx, ty], i) => {
          const hueShift = Math.floor(t * 4 + i) % 3;
          const useAlt = hueShift === 1 && g.accent;
          for (let u = 0.3; u <= 1; u += 0.25) {
            shape(ctx, "crystal", rx + (tx - rx) * u, rootY + (ty - rootY) * u, useAlt ? alt : pal, u > 0.8 ? 3 : 2, 2);
          }
        });
        break;
      }
    }
  }
}

function drawTail(c: Sig) {
  const { ctx, t, s, pal, alt, g, tr, flip } = c;
  const back = -flip;
  const n = 14;
  const len = 1.6 * s * tr.size;
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
      case 4: // Scorpion tail: thick segments that brighten toward a hooked tip.
        shape(ctx, "block", px0, py0, u > 0.75 ? alt : pal, u > 0.6 ? 3 : u > 0.3 ? 2 : 1, u < 0.4 ? 2 : 1);
        break;
      case 5: // Ribbon tail: thin wavy band alternating colours.
        px(ctx, px0, py0 + Math.sin(t * 6 + i) * P, (i % 2 ? alt : pal)[u > 0.6 ? 3 : 2]);
        break;
      case 6: // Storm tail: crackling sparks along the whip.
        if (Math.floor(t * 18 + i) % 2) px(ctx, px0 + (hash(i + Math.floor(t * 12)) - 0.5) * 4, py0, pal[u > 0.5 ? 3 : 2]);
        else shape(ctx, "bolt", px0, py0, alt, 3, 1);
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
  const top = -18 * s;
  switch (tr.style) {
    case 0: { // Halo: a tilted ring above the head.
      const n = 8;
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
      if (tr.style === 4) { // Flame crown: licking flames above the head.
        for (let i = 0; i < 5; i++) {
          const fx = (i - 2) * 2.2 * s;
          const h = (1.5 + ((Math.floor(t * 14) + i) % 3)) * P;
          for (let j = 0; j < h / P; j++) px(ctx, fx + Math.sin(t * 5 + i + j) * P, top - 2 * s - j * P, pal[j === 0 ? 3 : j === 1 ? 2 : 1]);
        }
        return;
      }
      if (tr.style === 5) { // Ring crown: a band of linked rings.
        const m = 6;
        for (let i = 0; i < m; i++) {
          const a = t * 0.7 * g.dir + (i / m) * Math.PI * 2;
          const depth = Math.sin(a);
          if ((depth >= 0) !== front) continue;
          shape(ctx, "ring", Math.cos(a) * 5 * s, top - 2 * s + depth * s, i % 2 && g.accent ? alt : pal, 2, 1);
        }
        return;
      }
      if (tr.style === 6) { // Antlers: branching horns.
        for (const side of [-1, 1]) {
          for (let j = 0; j < 5; j++) {
            const u = j / 4;
            const bx = side * (2.5 * s + u * 2 * s * tr.size);
            const by = -16 * s - u * 4 * s * tr.size;
            px(ctx, bx, by, pal[u > 0.6 ? 3 : 2]);
            if (j === 2 || j === 3) px(ctx, bx + side * 1.6 * s, by - P, pal[2]);
          }
        }
        return;
      }
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
    else if (tr.style === 3) shape(ctx, "orb", x, y, alt, 3, 2);
    else if (tr.style === 4) { shape(ctx, "block", x, y, alt, 3, 2); px(ctx, x, y, pal[3]); }
    else if (tr.style === 5) { shape(ctx, "ring", x, y, pal, 3, 2); px(ctx, x, y, alt[3]); }
    else { px(ctx, x, y, pal[3], 2); px(ctx, x + 2 * P, y, pal[0]); px(ctx, x + P * 2, y + P, pal[0]); }
  }
}

function trackTrail(key: number, x: number, y: number, t: number, keep: number) {
  const trails = (globalThis as any).__gearTrails ??= new Map();
  let list = trails.get(key);
  if (!list) { list = []; trails.set(key, list); }
  const last = list[list.length - 1];
  if (!last || Math.hypot(last.x - x, last.y - y) > 5) list.push({ x, y, t });
  while (list.length && t - list[0]!.t > keep) list.shift();
  return list;
}
function drawTrail(c: Sig, ax: number, ay: number, key: number) {
  const { ctx, t, s, pal, alt, tr } = c;
  const keep = tr.style === 1 ? 1.6 : 0.55;
  const list = trackTrail(key, ax, ay, t, keep);
  list.forEach((p: { x: number; y: number; t: number }, i: number) => {
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

  // Simple pixel character using the lead palette.
  // Body
  px(ctx, px2, py2 - 4 * ps + bob, pal[2], 2);
  px(ctx, px2 - P, py2 - 6 * ps + bob, pal[3]);
  px(ctx, px2 + P, py2 - 6 * ps + bob, pal[3]);
  // Head
  px(ctx, px2, py2 - 8 * ps + bob, pal[3], 2);
  // Feet
  px(ctx, px2 - P, py2 + bob, pal[1]);
  px(ctx, px2 + P, py2 + bob, pal[1]);
}

const COUNT_BY_QUALITY = [0, 0, 4, 6, 9, 14];

export function drawGearFx(ctx: C, a: Actor, t: number, s: number, layer: Layer): void {
  if (!a.pieces?.length) return;
  const front = layer === "front";
  ctx.save();
  ctx.translate(a.x, a.y);
  const flip = a.facing < 0 ? -1 : 1;
  const k = s;
  // Walked by index: this runs for every actor wearing gear, on every frame, and the old version
  // built a closure for the reduce and then a whole array (plus a spread) just to take a maximum.
  let lead = a.pieces[0]!;
  for (let i = 1; i < a.pieces.length; i++) if (a.pieces[i]!.quality > lead.quality) lead = a.pieces[i]!;
  const leadSeed = seedOf(lead);
  const leadGene = fxGene(leadSeed, lead.type, lead.quality);
  const leadPal = PAL[lead.type] ?? PAL.normal;
  const top = lead.quality;

  if (!front && top >= 3) drawRings(ctx, t, k, a.pieces, lead, leadGene, leadPal);

  let budget = 60;
  for (const p of a.pieces) {
    if (p.quality < 2) continue;
    const seed = seedOf(p);
    const g = fxGene(seed, p.type, p.quality);
    const tr = fxTrait(seed, p.slot, p.quality);
    const pal = PAL[p.type] ?? PAL.normal;
    const alt = g.accent ? (PAL[g.accent] ?? pal) : pal;
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
        // Each imbue style carries its own rising glyph, so the weapon aura reads differently per imbue.
        const IMBUE_SHAPES = ["spark", "splash", "runedot", "streak", "crystal", "bolt", "petal"] as const;
        const gk = IMBUE_SHAPES[tr.style % IMBUE_SHAPES.length]!;
        for (let j = 0; j < 3 + p.quality; j++) shape(ctx, gk, wx + (j % 2 ? P : 0), (-15 + u * 10) * s + j * P, j === 0 ? alt : pal, j === 0 ? 3 : 2, 1, -Math.PI / 2);
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
