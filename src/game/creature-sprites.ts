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
export function drawCreatureSprite(ctx: CanvasRenderingContext2D, m: MonsterDraw): void {
  if (!image) {
    image = new Image();
    image.src = "/sprites/creatures_roguelike.png";
  }
  const cell = m.species ? CREATURE_CELLS[m.species] : undefined;
  const scale = m.boss ? BOSS_SPRITE_SCALE : CREATURE_SPRITE_SCALE,
    bob = Math.round(Math.sin(m.walk * 5) * 1);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(m.x), Math.round(m.y));
  ctx.scale(m.facing < 0 ? -1 : 1, 1);
  ctx.globalAlpha = m.hurt > 0 ? 0.65 : 1;
  if (cell && image.complete && image.naturalWidth)
    ctx.drawImage(
      image,
      cell[0] * 16,
      cell[1] * 16,
      16,
      16,
      -8 * scale,
      -16 * scale + bob,
      16 * scale,
      16 * scale,
    );
  else ctx.drawImage(pixelSpirit(m.type), -8 * scale, -18 * scale + bob, 16 * scale, 18 * scale);
  ctx.restore();
}
