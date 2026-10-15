import type { MonsterDraw } from "./sprites";
import { TYPES } from "./content";
// Measured 8-column × 9-row, 16px cells. The supplied creature sheet has alpha.
export const CREATURE_CELLS: Record<string, [number, number]> = {
  onibi: [2, 5],
  nobi: [1, 3],
  hinotama: [3, 5],
  kagaribi: [3, 4],
  shizuku: [0, 5],
  nami: [1, 5],
  uroko: [4, 5],
  kasa: [5, 5],
  tsuchi: [4, 4],
  kusa: [0, 8],
  yanagi: [1, 8],
  mokuzu: [3, 8],
  yuki: [6, 5],
  raiju: [7, 5],
  kaze: [0, 4],
  hikari: [7, 7],
  yami: [5, 4],
  kage: [6, 4],
  yomi: [7, 4],
  naraku: [4, 7],
  muma: [1, 1],
  umoregi: [2, 8],
  gaikotsu: [0, 1],
  wisp: [5, 5],
  saintling: [6, 7],
  hare: [0, 4],
  fox: [1, 4],
  boar: [2, 4],
  crow: [5, 4],
  stag: [3, 4],
  wolf: [1, 4],
};
/** Enemies are drawn 2x: a 16px cell becomes exactly one 32px tile, so they fit 1x1 hallways. */
export const CREATURE_SPRITE_SCALE = 2;
/** Bosses are one tile too. Raise this (e.g. 3) if you want them to tower over the map. */
export const BOSS_SPRITE_SCALE = 2;
let image: HTMLImageElement | null = null;

/** Looks registered by the Enemy Designer: a sheet cell or a drawn 16×16 canvas, plus a size. */
export type CustomSprite = { cell?: [number, number]; canvas?: HTMLCanvasElement | null; scale?: number };
const customSprites = new Map<string, CustomSprite>();
export function setCustomSprite(species: string, sprite: CustomSprite): void {
  customSprites.set(species, sprite);
}
export function clearCustomSprites(): void {
  customSprites.clear();
}
export function customSpriteFor(species: string): CustomSprite | undefined {
  return customSprites.get(species);
}
const fallback = new Map<string, HTMLCanvasElement>();
function pixelSpirit(type: string): HTMLCanvasElement {
  const cached = fallback.get(type);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 18;
  const ctx = c.getContext("2d")!;
  const pattern = [
    "      ####      ",
    "    ########    ",
    "   ##########   ",
    "  ############  ",
    "  ###..##..###  ",
    "  ###..##..###  ",
    "  ############  ",
    "   ##########   ",
    "    ########    ",
    "   ##########   ",
    "  ## ###### ##  ",
    "  #  ######  #  ",
    "     ##  ##     ",
    "    ##    ##    ",
  ];
  pattern.forEach((row, y) =>
    [...row].forEach((p, x) => {
      if (p === "#") {
        ctx.fillStyle = TYPES[type as keyof typeof TYPES]?.color ?? "#b4a6ff";
        ctx.fillRect(x, y + 2, 1, 1);
      } else if (p === ".") {
        ctx.fillStyle = "#120e0c";
        ctx.fillRect(x, y + 2, 1, 1);
      }
    }),
  );
  fallback.set(type, c);
  return c;
}
/** Scratch canvas for tinting one sprite at a time (shiny lava-lamp colours). */
let scratch: HTMLCanvasElement | null = null;
function scratchCanvas(w: number, h: number): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  scratch = scratch ?? document.createElement("canvas");
  if (scratch.width < w || scratch.height < h) {
    scratch.width = Math.max(scratch.width, w);
    scratch.height = Math.max(scratch.height, h);
  }
  const c = scratch.getContext("2d");
  if (!c) return null;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "source-over";
  c.globalAlpha = 1;
  c.clearRect(0, 0, scratch.width, scratch.height);
  c.imageSmoothingEnabled = false;
  return c;
}

/** Paints the sprite's own pixels with slow, drifting blobs of colour, like a lava lamp. */
function lavaLamp(c: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  c.globalCompositeOperation = "source-atop";
  c.globalAlpha = 1;
  const base = (t * 40) % 360;
  c.fillStyle = `hsl(${base}, 85%, 55%)`;
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 4; i++) {
    const hue = (base + 70 + i * 85) % 360;
    const bx = w * (0.5 + 0.42 * Math.sin(t * (0.7 + i * 0.23) + i * 1.7));
    const by = h * (0.5 + 0.42 * Math.cos(t * (0.55 + i * 0.31) + i * 2.3));
    const r = Math.max(w, h) * (0.32 + 0.1 * Math.sin(t * 1.3 + i));
    const g = c.createRadialGradient(bx, by, 0, bx, by, r);
    g.addColorStop(0, `hsla(${hue}, 95%, 62%, 0.95)`);
    g.addColorStop(1, `hsla(${hue}, 95%, 62%, 0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }
  c.globalCompositeOperation = "source-over";
}

export function drawCreatureSprite(ctx: CanvasRenderingContext2D, m: MonsterDraw): void {
  if (!image) {
    image = new Image();
    image.src = "/sprites/creatures_roguelike.png";
  }
  const custom = m.species ? customSprites.get(m.species) : undefined;
  const cell = custom?.cell ?? (m.species ? CREATURE_CELLS[m.species] : undefined);
  const scale = (m.boss ? BOSS_SPRITE_SCALE : CREATURE_SPRITE_SCALE) * (custom?.scale ?? 1),
    bob = Math.round(Math.sin(m.walk * 5) * 1);
  const t = m.time ?? 0;
  // Ghosts float: a slow hover on top of the walk bob.
  const hover = m.ghost ? Math.round(Math.sin(t * 2.4 + m.x * 0.05) * 2) - 2 : 0;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(m.x), Math.round(m.y));
  if (m.ghost) {
    // A soft glow under every ghost, in its element colour (rainbow when shiny).
    const col = m.shiny ? `hsla(${(t * 40) % 360}, 90%, 60%, 0.35)` : `${TYPES[m.type as keyof typeof TYPES]?.color ?? "#b4a6ff"}44`;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(0, 1, 9 * scale / 2, 3 * scale / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (m.spin) ctx.rotate(Math.sin(m.spin) * 0.6);
  ctx.scale(m.facing < 0 ? -1 : 1, 1);
  ctx.globalAlpha = (m.hurt > 0 ? 0.65 : 1) * (m.ghost && !m.shiny ? 0.86 : 1);
  const draw = (target: CanvasRenderingContext2D, ox: number, oy: number) => {
    if (custom?.canvas) target.drawImage(custom.canvas, ox, oy, 16 * scale, 16 * scale);
    else if (cell && image!.complete && image!.naturalWidth) target.drawImage(image!, cell[0] * 16, cell[1] * 16, 16, 16, ox, oy, 16 * scale, 16 * scale);
    else target.drawImage(pixelSpirit(m.type), ox, oy, 16 * scale, 18 * scale);
  };
  const usesSheet = !!custom?.canvas || !!(cell && image.complete && image.naturalWidth);
  const w = 16 * scale, h = (usesSheet ? 16 : 18) * scale;
  const x0 = -8 * scale, y0 = (usesSheet ? -16 : -18) * scale + bob + hover;
  if (m.shiny) {
    const c = scratchCanvas(w, h);
    if (c) {
      draw(c, 0, 0);
      // Keep a little of the original shading under the colour so the creature still reads.
      c.globalCompositeOperation = "source-atop";
      lavaLamp(c, w, h, t);
      ctx.drawImage(scratch!, 0, 0, w, h, x0, y0, w, h);
      ctx.globalAlpha *= 0.35;
      draw(ctx, x0, y0);
      ctx.globalAlpha = 1;
      // Sparkles.
      for (let i = 0; i < 3; i++) {
        const a = t * 2 + i * 2.1;
        ctx.fillStyle = `hsl(${(t * 90 + i * 120) % 360}, 100%, 80%)`;
        ctx.fillRect(Math.round(Math.cos(a) * w * 0.55) - 1, Math.round(y0 + h * 0.5 + Math.sin(a) * h * 0.45) - 1, 2, 2);
      }
    } else draw(ctx, x0, y0);
  } else draw(ctx, x0, y0);
  ctx.restore();
}
