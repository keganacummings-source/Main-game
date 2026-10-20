/**
 * Witch ghosts: a witch's ghost (a spirit with a classId) wears her class sprite, so it used to draw
 * as a solid, ordinary witch. This gives her the same treatment as every other ghost:
 *   - a floor glow in her element colour (or her shiny palette) and a pulsing rarity aura;
 *   - a slow hover;
 *   - see-through, washed in her element colour (shinies flow through their palette);
 *   - a light gleam that sweeps across rare-and-up ghosts.
 * The ghost-fx layers (drawGhostFx back/front) are still drawn by the caller around this.
 */
import { TYPES, type TypeId } from "./content";
import { paletteColor, rarityStyle, shinyPalette } from "./ghost-style";

export type SpectralInfo = { type: TypeId | string; rarity?: number; shiny?: boolean; palette?: string | null; seed?: string | number };
type ActorLike = { x: number; y: number; hurt?: number; [k: string]: unknown };

const W = 112, H = 136, FOOT = 14;
let buf: HTMLCanvasElement | null = null;

function buffer(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  buf = buf ?? document.createElement("canvas");
  if (buf.width !== W) { buf.width = W; buf.height = H; }
  return buf.getContext("2d");
}

/** Draws `actor` (via `draw`, e.g. drawActor) as a ghost. Falls back to a plain see-through draw without a DOM. */
export function drawSpectralActor(ctx: CanvasRenderingContext2D, actor: ActorLike, g: SpectralInfo, t: number, draw: (c: CanvasRenderingContext2D, a: any) => unknown): void {
  const style = rarityStyle(g.rarity ?? 0);
  const pal = g.shiny ? shinyPalette(g.palette ?? null) : null;
  const col = TYPES[g.type as TypeId]?.color ?? "#b4a6ff";
  const seed = typeof g.seed === "number" ? g.seed : String(g.seed ?? "").length;
  const hover = Math.round(Math.sin(t * 2.4 + actor.x * 0.05) * 2) - 2;
  const x = actor.x, y = actor.y;
  ctx.save();
  // Floor glow and the rarity aura, like a monster ghost's.
  ctx.fillStyle = pal ? paletteColor(pal, t, 0, 0.35) : `${col}44`;
  ctx.beginPath();
  ctx.ellipse(x, y + 1, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (style.glow > 0.2) {
    const pulse = 0.75 + 0.25 * Math.sin(t * 3 + seed);
    ctx.globalAlpha = style.glow * 0.4 * pulse;
    ctx.fillStyle = pal ? paletteColor(pal, t, 2) : style.color;
    ctx.globalCompositeOperation = "lighter";
    ctx.beginPath();
    ctx.ellipse(x, y - 32, 18 + style.glow * 6, 30 + style.glow * 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // A ghost is never quite solid, even a Mythic one.
  const alpha = Math.min(0.82, pal ? 0.9 : style.alpha - 0.1) * ((actor.hurt ?? 0) > 0 ? 0.65 : 1);
  const b = buffer();
  if (!b) {
    ctx.save();
    ctx.globalAlpha = alpha;
    draw(ctx, { ...actor, y: y + hover });
    ctx.restore();
    return;
  }
  b.setTransform(1, 0, 0, 1, 0, 0);
  b.clearRect(0, 0, W, H);
  b.imageSmoothingEnabled = false;
  draw(b, { ...actor, x: W / 2, y: H - FOOT });
  // Wash the body in her element colour (shiny: the palette flowing through it).
  b.globalCompositeOperation = "source-atop";
  if (pal) {
    const grad = b.createLinearGradient(0, 0, 0, H);
    for (let i = 0; i < 4; i++) grad.addColorStop(i / 3, paletteColor(pal, t * 1.4, i, 1));
    b.globalAlpha = 0.5;
    b.fillStyle = grad;
  } else {
    b.globalAlpha = 0.28 + style.wash * 0.45;
    b.fillStyle = col;
  }
  b.fillRect(0, 0, W, H);
  // A pale band sweeps across rare-and-up ghosts every few seconds.
  if (style.gleam || pal) {
    const u = ((t * 0.45 + seed * 0.13) % 1.6) - 0.3;
    if (u >= 0 && u <= 1) {
      b.globalAlpha = 0.35;
      b.fillStyle = "#ffffff";
      const gx = u * (W + 40) - 20;
      b.beginPath();
      b.moveTo(gx, 0); b.lineTo(gx + 10, 0); b.lineTo(gx - 20, H); b.lineTo(gx - 30, H);
      b.closePath();
      b.fill();
    }
  }
  b.globalCompositeOperation = "source-over";
  b.globalAlpha = 1;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;
  ctx.drawImage(buf!, x - W / 2, y - (H - FOOT) + hover);
  ctx.restore();
}
