import type { TypeId } from "./content";
import { P, PAL, px } from "./combat-fx";
import { hashString } from "./fx-gene";
import { MAX_GHOST_RARITY, paletteColor, rarityStyle, shinyPalette } from "./ghost-style";

/**
 * Ghost FX. Every ghost (yours, and the ghosts witches and bounties bring) wears its own effect,
 * read from what it is rather than from gear:
 *
 * - Element: the particles themselves (embers, droplets, pebbles, gusts, sparks, flakes, void motes,
 *   light rays, wisps, drips, glints).
 * - Rarity: how many particles, plus a crest above the head at rare and a pulsing glow at epic.
 * - Level: how far the effect spreads.
 * - Speed: how fast it moves, and a streak left behind fast ghosts.
 * - Health: sturdy ghosts carry a slow guard ring at their feet.
 * - Shiny: everything cycles through the rainbow.
 */
export type GhostFxInput = {
  x: number; y: number; type: TypeId; rarity: number; level: number; speed: number; max: number;
  shiny?: boolean; seed: string;
  /** Shiny palette id; missing means the Prism rainbow. */
  palette?: string | null;
};
type C = CanvasRenderingContext2D;
type Pal = readonly [string, string, string, string];

const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Second colours for a ghost's imbue and accents. */
const GHOST_ACCENT: Record<TypeId, TypeId> = {
  normal: "light", fire: "light", water: "ice", earth: "fire", air: "water", electric: "light",
  ice: "water", void: "spirit", light: "fire", spirit: "void", ghoul: "void",
};

function rainbow(t: number, i: number): Pal {
  const h = (t * 70 + i * 50) % 360;
  return [`hsl(${h},80%,22%)`, `hsl(${h},85%,45%)`, `hsl(${h},95%,62%)`, `hsl(${h},100%,85%)`];
}

export type GhostTraits = { count: number; spread: number; pace: number; fast: number; sturdy: boolean; crest: boolean; glow: boolean; seed: number };

/** What a ghost's stats turn into on screen. Exported so the Spirits window can describe it. */
export function ghostTraits(g: Pick<GhostFxInput, "rarity" | "level" | "speed" | "max" | "seed">): GhostTraits {
  const rarity = Math.max(0, Math.min(MAX_GHOST_RARITY, g.rarity | 0));
  const level = Math.max(1, g.level || 1);
  // Speed and health are read against what is normal for the ghost's level.
  const fast = Math.max(0, Math.min(1, ((g.speed || 8) / (10 + level) - 0.85) * 2.5));
  const sturdy = (g.max || 0) > 24 + level * 9;
  return {
    count: 2 + rarity * 2,
    spread: 1 + Math.min(1, level / 300) * 0.6,
    pace: 0.8 + fast * 0.9,
    fast,
    sturdy,
    crest: rarity >= 2,
    glow: rarity >= 3,
    seed: hashString(g.seed || "ghost") % 9973,
  };
}

/** One-line description of a ghost's FX for the Spirits window. */
export function ghostFxLabel(g: Pick<GhostFxInput, "type" | "rarity" | "level" | "speed" | "max" | "seed" | "shiny" | "palette">): string {
  const tr = ghostTraits(g);
  const motif: Record<TypeId, string> = { normal: "glints", fire: "embers", water: "droplets", earth: "pebbles", air: "gusts", electric: "sparks", ice: "snowflakes", void: "void motes", light: "light rays", spirit: "wisps", ghoul: "drips" };
  const bits = [`${tr.count} ${motif[g.type] ?? "motes"}`];
  if (tr.crest) bits.push("crest");
  if (tr.glow) bits.push("glow");
  if (tr.fast > 0.35) bits.push("speed streak");
  if (tr.sturdy) bits.push("guard ring");
  if ((g.rarity | 0) >= 2) bits.push("imbued verses");
  if (g.shiny) bits.push(`${shinyPalette(g.palette).name.toLowerCase()} shimmer`);
  else if (rarityStyle(g.rarity).gleam) bits.push(`${rarityStyle(g.rarity).name.toLowerCase()} gleam`);
  return `FX: ${bits.join(" · ")}`;
}

/** The layer this ghost adds to its own verses (rare and better ghosts). */
export function ghostImbue(g: Pick<GhostFxInput, "type" | "rarity" | "seed" | "shiny">): { type: TypeId; accent: TypeId; style: number; quality: number } | null {
  if ((g.rarity | 0) < 2 && !g.shiny) return null;
  const seed = hashString(g.seed || "ghost");
  return { type: g.type, accent: g.shiny ? (["fire", "water", "electric", "void", "light"] as TypeId[])[seed % 5]! : GHOST_ACCENT[g.type] ?? g.type, style: seed % 4, quality: Math.min(5, 2 + (g.rarity | 0)) };
}

type Pt = { x: number; y: number; t: number };
const tracks = new Map<string, Pt[]>();
function track(key: string, x: number, y: number, t: number, keep: number): Pt[] {
  let list = tracks.get(key);
  if (!list) { list = []; tracks.set(key, list); if (tracks.size > 48) tracks.delete(tracks.keys().next().value as string); }
  const last = list[list.length - 1];
  if (last && last.t > t + 1) list.length = 0;
  if (!last || Math.hypot(last.x - x, last.y - y) > 4) list.push({ x, y, t });
  while (list.length && t - list[0]!.t > keep) list.shift();
  return list;
}

export function drawGhostFx(ctx: C, g: GhostFxInput, t: number, layer: "back" | "front"): void {
  const tr = ghostTraits(g);
  const base = (PAL[g.type] ?? PAL.normal) as Pal;
  const sp = g.shiny ? shinyPalette(g.palette) : null;
  const palAt = (i: number): Pal => (!sp ? base : sp.kind === "rainbow" ? rainbow(t, i) : [paletteColor(sp, t, i + 3), paletteColor(sp, t, i + 2), paletteColor(sp, t, i + 1), paletteColor(sp, t, i)]);
  const T = t * tr.pace;
  const R = 12 * tr.spread;
  const cy = -16;
  ctx.save();
  ctx.translate(Math.round(g.x / P) * P, Math.round(g.y / P) * P);
  if (layer === "back") {
    // Speed streak: fast ghosts leave their colour behind them.
    const keep = 0.15 + tr.fast * 0.45;
    if (tr.fast > 0.2) {
      const list = track(g.seed, g.x, g.y, t, keep);
      list.forEach((p, i) => {
        const age = (t - p.t) / keep;
        if (age >= 1 || i % 2) return;
        const pal = palAt(i);
        px(ctx, p.x - g.x, p.y - g.y + cy + (hash(i + tr.seed) - 0.5) * 10, pal[age < 0.4 ? 3 : 2]);
        px(ctx, p.x - g.x, p.y - g.y + cy + 6, pal[1]);
      });
    }
    // Guard ring: sturdy ghosts.
    if (tr.sturdy) {
      const n = 12;
      for (let i = 0; i < n; i++) {
        if (i % 3 === 0) continue;
        const a = (i / n) * Math.PI * 2 + T * 0.5;
        px(ctx, Math.cos(a) * 10, 2 + Math.sin(a) * 3, palAt(i)[2]);
      }
    }
    if (tr.glow) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.18 + Math.sin(T * 2.2) * 0.08;
      ctx.fillStyle = palAt(0)[2];
      ctx.beginPath();
      ctx.ellipse(0, cy, 16, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    return;
  }
  // Front: the element's particles, then the crest.
  const n = tr.count;
  for (let i = 0; i < n; i++) {
    const pal = palAt(i);
    const h = hash(tr.seed + i * 13);
    const life = (T * (0.5 + h * 0.4) + h) % 1;
    const ang = T * 1.5 + (i / n) * Math.PI * 2;
    switch (g.type) {
      case "fire": {
        const x = (h - 0.5) * R * 1.4, y = cy + 6 - life * 26;
        if (life < 0.85) px(ctx, x + Math.sin(T * 6 + i) * 2, y, pal[life < 0.3 ? 3 : life < 0.6 ? 2 : 1]);
        break;
      }
      case "water": {
        const x = Math.cos(ang) * R, y = cy + Math.sin(ang) * R * 0.4;
        px(ctx, x, y, pal[2]); px(ctx, x, y + P, pal[1]);
        break;
      }
      case "earth": {
        const a = T * 0.7 + (i / n) * Math.PI * 2;
        px(ctx, Math.cos(a) * R * 0.9, -2 + Math.sin(a) * 3 - Math.abs(Math.sin(T * 3 + i)) * 4, pal[i % 2 ? 2 : 1], 2);
        break;
      }
      case "air": {
        for (let j = 0; j < 3; j++) {
          const a = ang * 1.3 - j * 0.18;
          px(ctx, Math.cos(a) * (R + 2), cy + Math.sin(a * 2) * 6, pal[3 - j]);
        }
        break;
      }
      case "electric": {
        if (Math.floor(t * 14 + i * 3) % 5 === 0) {
          const x = Math.cos(ang) * R * 0.9, y = cy + Math.sin(ang) * 8;
          px(ctx, x, y, pal[3]); px(ctx, x + P, y + P, pal[2]); px(ctx, x, y + 2 * P, pal[3]); px(ctx, x + P, y + 3 * P, pal[1]);
        }
        break;
      }
      case "ice": {
        const x = (h - 0.5) * R * 1.6 + Math.sin(T * 2 + i) * 2, y = cy - 12 + life * 26;
        if (life < 0.9) { px(ctx, x, y, pal[3]); if (i % 2) { px(ctx, x - P, y, pal[2]); px(ctx, x + P, y, pal[2]); } }
        break;
      }
      case "void": {
        const r = (1 - life) * R * 1.3;
        px(ctx, Math.cos(ang * 1.4) * r, cy + Math.sin(ang * 1.4) * r * 0.6, pal[life > 0.7 ? 3 : 1]);
        break;
      }
      case "light": {
        const a = (i / n) * Math.PI * 2 + T * 0.4;
        const len = 3 + Math.floor((Math.sin(T * 3 + i) + 1) * 2);
        for (let j = 0; j < len; j++) px(ctx, Math.cos(a) * (8 + j * 2), cy - 2 + Math.sin(a) * (8 + j * 2) * 0.7, pal[j < 2 ? 3 : 2]);
        break;
      }
      case "spirit": {
        for (let j = 0; j < 3; j++) {
          const lj = Math.max(0, life - j * 0.05);
          px(ctx, Math.sin(lj * 8 + i * 2) * R * 0.7, cy + 4 - lj * 24, pal[3 - j]);
        }
        break;
      }
      case "ghoul": {
        const x = (h - 0.5) * R, y = cy + 2 + life * 16;
        if (life < 0.8) px(ctx, x, y, pal[life < 0.3 ? 2 : 1]);
        break;
      }
      default: {
        const ph = (T * 1.2 + h) % 1;
        if (ph < 0.4) px(ctx, (hash(tr.seed + i + Math.floor(T * 1.2)) - 0.5) * R * 2, cy - hash(i * 3 + Math.floor(T)) * 20, pal[3]);
      }
    }
  }
  if (sp) {
    // Shiny glints: small plus-shaped stars that flash around the ghost, one more per rarity tier.
    const stars = 3 + (g.rarity | 0);
    for (let i = 0; i < stars; i++) {
      const h = hash(tr.seed + i * 29 + 5);
      const ph = (T * (0.55 + h * 0.35) + h * 3) % 1;
      if (ph > 0.55) continue;
      const k = Math.sin((ph / 0.55) * Math.PI);
      const x = (hash(tr.seed + i * 7 + Math.floor(T * 0.9 + h * 3)) - 0.5) * R * 2.3;
      const y = cy + (hash(tr.seed + i * 11 + Math.floor(T * 0.9 + h * 3)) - 0.5) * 30;
      const col = palAt(i + 4)[3];
      px(ctx, x, y, "#ffffff");
      if (k > 0.35) { px(ctx, x - P, y, col); px(ctx, x + P, y, col); px(ctx, x, y - P, col); px(ctx, x, y + P, col); }
      if (k > 0.8) { px(ctx, x - 2 * P, y, col); px(ctx, x + 2 * P, y, col); px(ctx, x, y - 2 * P, col); px(ctx, x, y + 2 * P, col); }
    }
  }
  if (tr.crest) {
    const pal = palAt(7);
    const bob = Math.sin(T * 2.5) * 2;
    const y = cy - 22 + bob;
    px(ctx, 0, y, pal[3]); px(ctx, -P, y + P, pal[2]); px(ctx, P, y + P, pal[2]); px(ctx, 0, y + 2 * P, pal[2]);
    if ((g.rarity | 0) >= 4) { px(ctx, -2 * P, y, pal[2]); px(ctx, 2 * P, y, pal[2]); }
  }
  ctx.restore();
}
