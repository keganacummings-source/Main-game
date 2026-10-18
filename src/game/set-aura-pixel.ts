import type { FxId } from "./content";

/**
 * Full Gear (set bonus) FX, drawn in the game's pixel style.
 *
 * Same rules as gear-fx.ts / combat-fx.ts: everything is built from hard-edged 2-unit pixels that
 * snap to the 2x sprite grid, with a 4-shade palette (dark / mid / light / highlight) and no curves,
 * gradients or anti-aliased strokes. Each of the 10 set kinds has its own pixel-art signature, plus a
 * shared dithered ground glow and rune ring so a full set always reads as "a set" at a glance.
 *
 * Origin is the wearer's feet; y is negative going up. `sc` is the body scale (never below 0.75).
 */

type C = CanvasRenderingContext2D;
type Pal4 = readonly [string, string, string, string];

const P = 2;
const snap = (v: number) => Math.round(v / P) * P;
const TAU = Math.PI * 2;

const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function rgb(h: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}
function mix(a: string, b: string, u: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * u).toString(16).padStart(2, "0");
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
}

/** Four hard shades from one colour: dark, mid, light, highlight. */
function ramp(hex: string): Pal4 {
  return [mix(hex, "#000000", 0.66), mix(hex, "#000000", 0.28), mix(hex, "#ffffff", 0.18), mix(hex, "#ffffff", 0.78)];
}

/** One pixel (or n x n pixels) on the 2-unit grid. */
function dot(ctx: C, x: number, y: number, c: string, n = 1): void {
  ctx.fillStyle = c;
  ctx.fillRect(snap(x), snap(y), P * n, P * n);
}

/** A pixel line (Bresenham-ish by stepping), used for rays and vine stalks. */
function seg(ctx: C, x0: number, y0: number, x1: number, y1: number, c: string): void {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / P));
  for (let i = 0; i <= n; i++) dot(ctx, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
}

/** Small plus-shaped sparkle. */
function spark(ctx: C, x: number, y: number, pal: Pal4, big = false): void {
  dot(ctx, x, y, pal[3]);
  dot(ctx, x - P, y, pal[2]);
  dot(ctx, x + P, y, pal[2]);
  dot(ctx, x, y - P, pal[2]);
  dot(ctx, x, y + P, pal[2]);
  if (big) {
    dot(ctx, x - 2 * P, y, pal[1]);
    dot(ctx, x + 2 * P, y, pal[1]);
    dot(ctx, x, y - 2 * P, pal[1]);
    dot(ctx, x, y + 2 * P, pal[1]);
  }
}

/** Pixel-art bitmap. '#' mid, 'o' light, '*' highlight, 'd' dark, anything else is empty. */
function blit(ctx: C, rows: readonly string[], x: number, y: number, pal: Pal4, flip = 1): void {
  const w = rows[0]!.length;
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j]!;
    for (let i = 0; i < w; i++) {
      const ch = row[flip < 0 ? w - 1 - i : i];
      if (ch === "." || ch === " " || ch === undefined) continue;
      dot(ctx, x + (i - w / 2) * P, y + j * P, ch === "d" ? pal[0] : ch === "#" ? pal[1] : ch === "o" ? pal[2] : pal[3]);
    }
  }
}

/** Dithered ground glow: a checkerboard of dim pixels inside a flat ellipse. */
function groundGlow(ctx: C, rx: number, ry: number, pal: Pal4, t: number): void {
  ctx.globalAlpha = 0.34;
  const hx = Math.ceil(rx / P);
  const hy = Math.ceil(ry / P);
  for (let j = -hy; j <= hy; j++) {
    for (let i = -hx; i <= hx; i++) {
      if ((i + j) & 1) continue;
      const e = (i / hx) ** 2 + (j / hy) ** 2;
      if (e > 1) continue;
      dot(ctx, i * P, j * P - P, e > 0.62 ? pal[1] : pal[0]);
    }
  }
  ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 2);
  dot(ctx, 0, -P, pal[2], 1);
  ctx.globalAlpha = 1;
}

/** Dashed rune ring on the ground with a few bright nodes riding it. */
function runeRing(ctx: C, r: number, rot: number, pal: Pal4, gap: number): void {
  const flat = 0.34;
  const n = Math.max(16, Math.floor((r * TAU) / P));
  for (let i = 0; i < n; i++) {
    if (Math.floor(i / gap) % 2) continue;
    const a = (i / n) * TAU + rot;
    const back = Math.sin(a) < 0;
    dot(ctx, Math.cos(a) * r, Math.sin(a) * r * flat - P, back ? pal[1] : pal[2]);
  }
  for (let k = 0; k < 4; k++) {
    const a = rot * 1.6 + (k / 4) * TAU;
    dot(ctx, Math.cos(a) * r, Math.sin(a) * r * flat - P, pal[3], 1);
  }
}

// ---------------------------------------------------------------------------
// Bitmaps
// ---------------------------------------------------------------------------

const CRESCENT = [
  "...*oo#d...",
  "..*oo#d....",
  ".*oo#d.....",
  ".*oo#d.....",
  "*oo#d......",
  "*oo#d......",
  "*oo#d......",
  ".*oo#d.....",
  ".*oo##d....",
  "..*oo##dd..",
  "...*ooo##d.",
  ".....**ood.",
];

const LANTERN = [
  "..dd..",
  ".d##d.",
  "d#oo#d",
  "d#**#d",
  "d#oo#d",
  ".d##d.",
  "..dd..",
];

const FEATHER = [
  "...*o",
  "..*oo",
  ".*oo#",
  "*oo#d",
  "oo#d.",
  "o#d..",
  "#d...",
];

const DROP = [
  ".*.",
  ".o.",
  "o#o",
  "###",
  ".d.",
];

const SKULL = [
  ".ooo.",
  "o*o*o",
  "ooooo",
  ".o#o.",
];

// ---------------------------------------------------------------------------
// Per-kind signatures
// ---------------------------------------------------------------------------

type K = { ctx: C; t: number; sc: number; pal: Pal4; acc: Pal4 };

function solarnova({ ctx, t, sc, pal, acc }: K): void {
  const cy = -30 * sc;
  // Eight pixel rays that pulse in length, alternating bright and warm.
  for (let i = 0; i < 8; i++) {
    const a = t * 0.45 + (i / 8) * TAU;
    const len = (16 + (i % 2 ? 4 : 10) + Math.sin(t * 3 + i) * 4) * sc;
    const r0 = 11 * sc;
    seg(ctx, Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.9, Math.cos(a) * len, cy + Math.sin(a) * len * 0.9, i % 2 ? pal[2] : acc[3]);
    dot(ctx, Math.cos(a) * (len + P), cy + Math.sin(a) * (len + P) * 0.9, pal[3]);
  }
  // Flickering core.
  const f = Math.floor(t * 8) % 3;
  dot(ctx, 0, cy, acc[3], 2);
  dot(ctx, -2 * P, cy, pal[2]);
  dot(ctx, 2 * P, cy, pal[2]);
  dot(ctx, 0, cy - 2 * P - f * P, pal[2]);
  dot(ctx, 0, cy + 2 * P, pal[1]);
  // Embers climbing off the shoulders.
  for (let i = 0; i < 5; i++) {
    const life = (t * 0.7 + i / 5) % 1;
    const x = (hash(i * 3 + 1) - 0.5) * 30 * sc;
    ctx.globalAlpha = 1 - life;
    dot(ctx, x, -6 * sc - life * 50 * sc, life < 0.4 ? acc[3] : pal[2]);
    dot(ctx, x, -6 * sc - life * 50 * sc + P, pal[1]);
  }
  ctx.globalAlpha = 1;
}

/** A zig-zag lightning bolt, redrawn at a few discrete frames per second for a crackling feel. */
function bolt(ctx: C, x: number, y0: number, len: number, seed: number, pal: Pal4): void {
  let x0 = x;
  for (let y = 0; y < len; y += P) {
    const step = Math.floor(hash(seed + y * 0.37) * 3) - 1;
    x0 += step * P;
    dot(ctx, x0, y0 + y, y % 6 === 0 ? pal[3] : pal[2]);
    if (y % 8 === 0) dot(ctx, x0 + P, y0 + y, pal[1]);
  }
}

function stormcrown({ ctx, t, sc, pal, acc }: K): void {
  const fr = Math.floor(t * 9);
  const topY = -64 * sc;
  // A crown of three bolts hanging off a ring of cloud pixels above the head.
  for (let i = -2; i <= 2; i++) {
    dot(ctx, i * 5 * sc, topY - (Math.abs(i) === 2 ? 0 : P), pal[1]);
    dot(ctx, i * 5 * sc, topY - P * 2 - (Math.abs(i) === 2 ? 0 : P), pal[0]);
  }
  for (let i = -1; i <= 1; i++) {
    if ((fr + i * 3) % 4 === 0) continue; // each bolt blinks out on its own beat
    bolt(ctx, i * 7 * sc, topY, (14 + Math.abs(i) * 4) * sc, fr * 9 + i * 31, acc);
  }
  // Crackles orbiting the body.
  for (let i = 0; i < 4; i++) {
    const a = t * 2.4 + (i / 4) * TAU;
    if ((fr + i) % 3 === 0) spark(ctx, Math.cos(a) * 19 * sc, -26 * sc + Math.sin(a) * 9 * sc, acc);
    else dot(ctx, Math.cos(a) * 19 * sc, -26 * sc + Math.sin(a) * 9 * sc, pal[2]);
  }
}

function tidalsurge({ ctx, t, sc, pal, acc }: K): void {
  // A rolling wave of pixels around the ankles.
  const w = 26 * sc;
  for (let x = -w; x <= w; x += P) {
    const y = -4 * sc - Math.round(Math.sin(x * 0.28 + t * 4) * 2) * P * 0.5;
    const edge = Math.abs(x) > w - 4 * P;
    dot(ctx, x, y, edge ? pal[1] : pal[2]);
    if (!edge && Math.floor(x / P + t * 5) % 6 === 0) dot(ctx, x, y - P, acc[3]);
    dot(ctx, x, y + P, pal[0]);
  }
  // Droplets thrown up and falling back, and bubbles drifting off the body.
  for (let i = 0; i < 4; i++) {
    const u = (t * 0.9 + i / 4) % 1;
    const x = (i - 1.5) * 9 * sc;
    const y = -6 * sc - Math.sin(u * Math.PI) * 34 * sc;
    blit(ctx, DROP, x, y, pal);
  }
  for (let i = 0; i < 4; i++) {
    const life = (t * 0.5 + i * 0.27) % 1;
    const bx = Math.sin(t * 2 + i * 2) * 14 * sc;
    ctx.globalAlpha = 1 - life * 0.8;
    dot(ctx, bx, -10 * sc - life * 50 * sc, acc[3]);
    dot(ctx, bx + P, -10 * sc - life * 50 * sc, pal[2]);
  }
  ctx.globalAlpha = 1;
}

function briarburst({ ctx, t, sc, pal, acc }: K): void {
  // Six thorny vines rise from the ring and sway, with thorns and a bloom at the tip.
  for (let v = 0; v < 6; v++) {
    const base = (v / 6) * TAU;
    const x0 = Math.cos(base) * 17 * sc;
    const grow = 0.55 + 0.45 * Math.sin(t * 1.3 + v * 1.7) ** 2;
    const h = (20 + (v % 3) * 8) * sc * grow;
    let lastX = x0;
    for (let y = 0; y < h; y += P) {
      const sway = Math.round(Math.sin(y * 0.16 + t * 1.8 + v) * 2) * P * 0.5 + (y / h) * Math.cos(base) * 4;
      lastX = x0 + sway;
      dot(ctx, lastX, -2 * sc - y, y % 8 < 4 ? pal[1] : pal[2]);
      if (y > 6 && y % 10 === 4) dot(ctx, lastX + (v % 2 ? P : -P), -2 * sc - y - P, pal[3]);
      if (y > 4 && y % 14 === 8) {
        dot(ctx, lastX + (v % 2 ? -P : P), -2 * sc - y, pal[2]);
        dot(ctx, lastX + (v % 2 ? -2 * P : 2 * P), -2 * sc - y - P, pal[1]);
      }
    }
    // Bloom.
    const by = -2 * sc - h - P;
    dot(ctx, lastX, by, acc[3]);
    dot(ctx, lastX - P, by, acc[2]);
    dot(ctx, lastX + P, by, acc[2]);
    dot(ctx, lastX, by - P, acc[2]);
  }
  // Pollen / spores.
  for (let i = 0; i < 5; i++) {
    const life = (t * 0.4 + i * 0.21) % 1;
    ctx.globalAlpha = 1 - life;
    dot(ctx, Math.sin(t + i * 2.3) * 22 * sc, -12 * sc - life * 44 * sc, acc[3]);
  }
  ctx.globalAlpha = 1;
}

function cloudBlob(ctx: C, x: number, y: number, pal: Pal4): void {
  dot(ctx, x - P, y, pal[2]);
  dot(ctx, x, y, pal[3]);
  dot(ctx, x + P, y, pal[2]);
  dot(ctx, x - 2 * P, y + P, pal[1]);
  dot(ctx, x - P, y + P, pal[2]);
  dot(ctx, x, y + P, pal[2]);
  dot(ctx, x + P, y + P, pal[2]);
  dot(ctx, x + 2 * P, y + P, pal[1]);
  dot(ctx, x, y - P, pal[2]);
}

function whitestorm({ ctx, t, sc, pal, acc }: K): void {
  // Small storm clouds circling at head height; the far side is drawn dimmer.
  for (let i = 0; i < 3; i++) {
    const a = t * 0.9 + (i / 3) * TAU;
    const far = Math.sin(a) < 0;
    ctx.globalAlpha = far ? 0.55 : 1;
    cloudBlob(ctx, Math.cos(a) * 22 * sc, -44 * sc + Math.sin(a) * 6 * sc, pal);
    ctx.globalAlpha = 1;
    // Flash under a cloud now and then.
    if (!far && Math.floor(t * 6 + i * 2) % 5 === 0) bolt(ctx, Math.cos(a) * 22 * sc, -40 * sc + Math.sin(a) * 6 * sc, 10 * sc, i * 17 + Math.floor(t * 6), acc);
  }
  // Wind streaks sweeping around the waist: a bright head and a fading tail behind it.
  for (let i = 0; i < 6; i++) {
    const a = -t * 2.2 + (i / 6) * TAU;
    if (Math.sin(a) < 0.15) continue; // only the near side
    const x = Math.cos(a) * 18 * sc;
    const y = -22 * sc + Math.sin(a) * 6 * sc + (i % 3) * 4 * sc;
    const tail = -Math.sign(Math.sin(a - 0.4) - Math.sin(a)) || 1;
    dot(ctx, x, y, pal[3]);
    dot(ctx, x + tail * P, y, pal[2]);
    dot(ctx, x + tail * 2 * P, y, pal[1]);
  }
  // Snow.
  for (let i = 0; i < 6; i++) {
    const life = (t * 0.45 + i / 6) % 1;
    dot(ctx, (hash(i + 4) - 0.5) * 36 * sc + Math.sin(t * 2 + i) * 3, -46 * sc + life * 46 * sc, pal[3]);
  }
}

function voidring({ ctx, t, sc, pal, acc }: K): void {
  // Two orbiting rifts: a ring of pixels with a black core and bright inner edge.
  const rift = (cx: number, cy: number, r: number, phase: number) => {
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + t * 1.6 * phase;
      const rr = r + (Math.floor(t * 8 + i) % 5 === 0 ? P : 0);
      dot(ctx, cx + Math.cos(a) * rr * 0.62, cy + Math.sin(a) * rr, i % 4 === 0 ? acc[3] : pal[2]);
    }
    for (let j = -r + P; j < r; j += P) for (let i = -r * 0.5; i < r * 0.5; i += P) {
      if ((i / (r * 0.5)) ** 2 + (j / r) ** 2 < 0.55) dot(ctx, cx + i, cy + j, pal[0]);
    }
    dot(ctx, cx, cy, pal[1]);
  };
  rift(-14 * sc, -30 * sc, 10 * sc, 1);
  rift(14 * sc, -36 * sc, 8 * sc, -1.3);
  // Motes spiral into the rifts.
  for (let i = 0; i < 6; i++) {
    const life = (t * 0.6 + i / 6) % 1;
    const a = i * 1.7 + life * 5;
    const r = (1 - life) * 24 * sc;
    ctx.globalAlpha = 0.4 + life * 0.6;
    dot(ctx, Math.cos(a) * r, -30 * sc + Math.sin(a) * r * 0.55, life > 0.8 ? acc[3] : pal[2]);
  }
  ctx.globalAlpha = 1;
}

function gravepulse({ ctx, t, sc, pal, acc }: K): void {
  // Expanding grave rings fading outward.
  for (let k = 0; k < 2; k++) {
    const u = (t * 0.5 + k * 0.5) % 1;
    const r = (6 + u * 26) * sc;
    const n = Math.max(12, Math.floor((r * TAU) / P / 1.5));
    ctx.globalAlpha = 1 - u;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      dot(ctx, Math.cos(a) * r, Math.sin(a) * r * 0.34 - P, u < 0.4 ? pal[3] : pal[2]);
    }
  }
  ctx.globalAlpha = 1;
  // Souls rising in S-curves, one wearing a tiny skull face.
  for (let i = 0; i < 4; i++) {
    const life = (t * 0.32 + i / 4) % 1;
    const x = (i - 1.5) * 10 * sc;
    ctx.globalAlpha = Math.min(1, (1 - life) * 1.6);
    for (let j = 0; j < 7; j++) {
      const f = life + j * 0.02;
      dot(ctx, x + Math.sin(f * 9 + i) * 4 * sc, -6 * sc - f * 52 * sc, j === 0 ? pal[3] : j < 3 ? pal[2] : pal[1]);
    }
    if (i === 1) blit(ctx, SKULL, x + Math.sin((life + 0) * 9 + i) * 4 * sc, -6 * sc - life * 52 * sc - 8 * P, pal);
  }
  ctx.globalAlpha = 1;
  void acc;
}

function lanternwake({ ctx, t, sc, pal, acc }: K): void {
  // Three paper lanterns floating around her at different heights, each trailing warm sparks.
  for (let i = 0; i < 3; i++) {
    const a = t * 0.8 + (i / 3) * TAU;
    const x = Math.cos(a) * (20 + i * 3) * sc;
    const y = (-26 - i * 11) * sc + Math.sin(a) * 5 * sc + Math.sin(t * 3 + i) * P;
    const far = Math.sin(a) < 0;
    ctx.globalAlpha = far ? 0.6 : 1;
    // Glow halo (dither).
    dot(ctx, x - 4 * P, y + 3 * P, pal[0]);
    dot(ctx, x + 4 * P, y + 3 * P, pal[0]);
    blit(ctx, LANTERN, x, y, pal);
    if (Math.floor(t * 6 + i) % 2 === 0) dot(ctx, x, y + 3 * P, acc[3]);
    ctx.globalAlpha = 1;
    // A cord up and a short spark trail behind the lantern.
    dot(ctx, x, y - P, pal[1]);
    const behind = Math.sin(a) > 0 ? -1 : 1;
    for (let j = 1; j <= 3; j++) {
      ctx.globalAlpha = (1 - j / 4) * (far ? 0.4 : 0.8);
      dot(ctx, x + behind * j * P, y + 3 * P + j * P, j === 1 ? acc[3] : pal[2]);
    }
    ctx.globalAlpha = 1;
  }
  // Rising light motes.
  for (let i = 0; i < 4; i++) {
    const life = (t * 0.3 + i / 4) % 1;
    ctx.globalAlpha = 1 - life;
    dot(ctx, Math.sin(i * 2.1 + t * 0.7) * 14 * sc, -4 * sc - life * 56 * sc, acc[3]);
  }
  ctx.globalAlpha = 1;
}

function featherfall({ ctx, t, sc, pal, acc }: K): void {
  // Pixel feathers drifting down in a gentle sway; each alternates light and soft violet.
  for (let i = 0; i < 6; i++) {
    const life = (t * 0.24 + i * 0.167) % 1;
    const x = Math.sin(t * 0.9 + i * 1.4) * 16 * sc + (i - 2.5) * 3 * sc;
    const y = -58 * sc + life * 56 * sc;
    ctx.globalAlpha = Math.min(1, (1 - life) * 2.2, life * 6);
    blit(ctx, FEATHER, x, y, i % 2 ? pal : acc, Math.sin(t * 2 + i) > 0 ? 1 : -1);
  }
  ctx.globalAlpha = 1;
  // Down fluff at the shoulders.
  for (let i = 0; i < 4; i++) {
    const life = (t * 0.5 + i / 4) % 1;
    ctx.globalAlpha = 1 - life;
    dot(ctx, (i % 2 ? 1 : -1) * 13 * sc + Math.sin(t * 3 + i) * 2, -38 * sc + life * 20 * sc, acc[3]);
  }
  ctx.globalAlpha = 1;
}

function bloodmoon({ ctx, t, sc, pal, acc }: K): void {
  // A pixel crescent moon hanging over her head, pulsing.
  const pulse = Math.floor(t * 2) % 2;
  blit(ctx, CRESCENT, 0, -82 * sc - pulse * P, pal);
  dot(ctx, 8 * P, -80 * sc - P * 2, acc[3]);
  // Blood drips falling from the moon and a red mist at the feet.
  for (let i = 0; i < 4; i++) {
    const life = (t * 0.55 + i / 4) % 1;
    const x = (i - 1.5) * 4 * sc;
    ctx.globalAlpha = 1 - life * 0.7;
    dot(ctx, x, -52 * sc + life * 46 * sc, pal[2]);
    dot(ctx, x, -52 * sc + life * 46 * sc - P, pal[1]);
  }
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 8; i++) {
    const a = t * 0.6 + (i / 8) * TAU;
    dot(ctx, Math.cos(a) * 17 * sc, -6 * sc + Math.sin(a) * 4 * sc - Math.floor(t * 3 + i) % 3 * P, pal[1]);
  }
  ctx.globalAlpha = 1;
}

const KINDS: Record<FxId, (k: K) => void> = {
  solarnova,
  stormcrown,
  tidalsurge,
  briarburst,
  whitestorm,
  voidring,
  gravepulse,
  lanternwake,
  featherfall,
  bloodmoon,
};

/** Bright second colour per kind, for highlights and accents. */
const ACCENT: Record<FxId, string> = {
  solarnova: "#fff1a8",
  stormcrown: "#fffbe0",
  tidalsurge: "#d8f4ff",
  briarburst: "#ffb0d8",
  whitestorm: "#ffffff",
  voidring: "#e0d4ff",
  gravepulse: "#9aff9a",
  lanternwake: "#ffffff",
  featherfall: "#c9a6e8",
  bloodmoon: "#ffd0d8",
};

// ---------------------------------------------------------------------------
// Crests: the extra flourish each set variant adds (7 kinds, 0 = none)
// ---------------------------------------------------------------------------

function crest(ctx: C, kind: number, t: number, sc: number, pal: Pal4): void {
  if (kind === 1) {
    // Orbiting glyphs: little diamonds circling above the head.
    for (let i = 0; i < 5; i++) {
      const a = t * 1.4 + (i / 5) * TAU;
      const x = Math.cos(a) * 20 * sc;
      const y = -26 * sc + Math.sin(a) * 7 * sc;
      ctx.globalAlpha = Math.sin(a) < 0 ? 0.55 : 1;
      dot(ctx, x, y - P, pal[3]);
      dot(ctx, x - P, y, pal[2]);
      dot(ctx, x + P, y, pal[2]);
      dot(ctx, x, y + P, pal[1]);
    }
    ctx.globalAlpha = 1;
  } else if (kind === 2) {
    // Ground rune: a second ring with tick marks and a small inner triangle.
    const r = 22 * sc;
    for (let i = 0; i < 24; i++) {
      if (i % 4 === 3) continue;
      const a = t * -0.5 + (i / 24) * TAU;
      dot(ctx, Math.cos(a) * r, Math.sin(a) * r * 0.34 - P, i % 8 === 0 ? pal[3] : pal[2]);
    }
    for (let i = 0; i < 3; i++) {
      const a = t * -0.5 + (i / 3) * TAU;
      dot(ctx, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55 * 0.34 - P, pal[3], 1);
    }
  } else if (kind === 3) {
    // Rising sparks.
    for (let i = 0; i < 7; i++) {
      const life = (t * 0.6 + i / 7) % 1;
      ctx.globalAlpha = 1 - life;
      dot(ctx, Math.sin(i * 2.3) * 16 * sc, -life * 56 * sc, life < 0.3 ? pal[3] : pal[2]);
    }
    ctx.globalAlpha = 1;
  } else if (kind === 4) {
    // Twin halos stacked over the head.
    for (const [y, w, dir] of [[-58, 9, 1], [-64, 6, -1.4]] as const) {
      for (let i = 0; i < 14; i++) {
        const a = t * dir + (i / 14) * TAU;
        const back = Math.sin(a) < 0;
        dot(ctx, Math.cos(a) * w * sc, y * sc + Math.sin(a) * 2 * sc, back ? pal[1] : pal[3]);
      }
    }
  } else if (kind === 5) {
    // A crown of points flickering over the head.
    for (let i = -2; i <= 2; i++) {
      const h = (i === 0 ? 4 : Math.abs(i) === 1 ? 3 : 2) + (Math.floor(t * 3 + i) % 2);
      for (let j = 0; j < h; j++) dot(ctx, i * 2 * P * sc * 0.9, (-60 * sc) - j * P, j === h - 1 ? pal[3] : pal[2]);
    }
  } else if (kind === 6) {
    // Falling motes.
    for (let i = 0; i < 8; i++) {
      const life = (t * 0.35 + i / 8) % 1;
      dot(ctx, Math.sin(t + i * 1.9) * 22 * sc, (-62 + life * 62) * sc, life < 0.2 ? pal[3] : pal[2]);
    }
  }
}

/**
 * Draws a full set's aura around a wearer standing at the current origin. `color` is the set's own
 * tint (see setAuraColor), `variant` the set's variant number (spin, size and crest).
 */
export function paintPixelSetAura(ctx: C, fx: FxId, t: number, scale: number, color: string, variant = 0): void {
  const sc = Math.max(0.75, scale);
  const pal = ramp(color);
  const acc = ramp(ACCENT[fx] ?? "#ffffff");
  const draw = KINDS[fx];
  if (!draw) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // Shared: dithered ground glow and a dashed rune ring in the set's colour.
  groundGlow(ctx, 20 * sc, 6.5 * sc, pal, t);
  runeRing(ctx, 17 * sc, t * 0.9, pal, 2 + (variant % 3));
  draw({ ctx, t, sc, pal, acc });
  ctx.restore();
}

/** The extra crest for a set variant, drawn on top of the kind. */
export function paintPixelCrest(ctx: C, kind: number, t: number, scale: number, color: string): void {
  if (!kind) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  crest(ctx, kind, t, scale, ramp(color));
  ctx.restore();
}

/** Four-shade ramp of a set colour, for particle bursts and UI to share the same look. */
export function setAuraRamp(color: string): Pal4 {
  return ramp(color);
}
