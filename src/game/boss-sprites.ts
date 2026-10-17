// boss-sprites.ts
// Full-size, directional, animated sprites for every world boss and dungeon boss.
//
// Each sheet is a 3-frame walk cycle across 4 facing rows of equal cells. Two row
// orders show up in the source art, measured from the PNGs rather than assumed:
//   - sheepmen & dragons: row 0 up, 1 left, 2 down, 3 right
//   - googon & arachne (RPG-Maker "SWEN"): row 0 down, 1 left, 2 right, 3 up
//
// Bosses are drawn much larger than ordinary foes (which are 16px creature cells
// scaled 2x). These sheets give them real presence and a proper walk.

export type BossDir = "down" | "left" | "right" | "up";

type BossLook = {
  src: string;
  /** Source cell size. */
  fw: number;
  fh: number;
  /** direction -> sheet row. */
  rows: Record<BossDir, number>;
  /** Native-pixel multiplier when drawn. */
  scale: number;
  /** Extra downward nudge (px) so the feet meet the ground line at m.y. */
  lift: number;
  /** Flyers hover and flap even while idle. */
  fly?: boolean;
};

// row 0 up, 1 left, 2 down, 3 right (sheepmen, dragons)
const ULDR: Record<BossDir, number> = { up: 0, left: 3, down: 2, right: 1 };
// row 0 down, 1 left, 2 right, 3 up (googon, arachne — RPG Maker SWEN)
const SWEN: Record<BossDir, number> = { down: 0, left: 1, right: 2, up: 3 };

const BASE = "/sprites/bosses/";

export const BOSS_LOOKS: Record<string, BossLook> = {
  dragon_red: { src: BASE + "dragon_red.png", fw: 144, fh: 128, rows: ULDR, scale: 0.85, lift: 8, fly: true },
  dragon_gold: { src: BASE + "dragon_gold.png", fw: 144, fh: 128, rows: ULDR, scale: 0.85, lift: 8, fly: true },
  dragon_blue: { src: BASE + "dragon_blue.png", fw: 144, fh: 128, rows: ULDR, scale: 0.85, lift: 8, fly: true },
  sheepman: { src: BASE + "sheepman.png", fw: 48, fh: 64, rows: ULDR, scale: 1.15, lift: 2 },
  sheepman_armored: { src: BASE + "sheepman_armored.png", fw: 48, fh: 64, rows: ULDR, scale: 1.18, lift: 2 },
  sheepman_elite: { src: BASE + "sheepman_elite.png", fw: 48, fh: 64, rows: ULDR, scale: 1.22, lift: 2 },
  sheepman_elder: { src: BASE + "sheepman_elder.png", fw: 48, fh: 64, rows: ULDR, scale: 1.22, lift: 2 },
  googon: { src: BASE + "googon.png", fw: 48, fh: 64, rows: SWEN, scale: 1.2, lift: 2 },
  arachne: { src: BASE + "arachne.png", fw: 48, fh: 64, rows: SWEN, scale: 1.22, lift: 2 },
};

/** The five named bosses get a hand-picked look; rift bosses inherit their world-boss id, so they hit this too. */
const LOOK_BY_BOSS_ID: Record<string, string> = {
  ash_regent: "dragon_red",
  tide_tyrant: "dragon_blue",
  void_cantor: "googon",
  marrow_saint: "sheepman_elder",
  bone_king: "arachne",
};

/** Every other boss (procedural dungeons) is themed by its element so each one reads consistently. */
const LOOK_BY_TYPE: Record<string, string> = {
  fire: "dragon_red",
  water: "dragon_blue",
  air: "dragon_gold",
  electric: "dragon_gold",
  void: "googon",
  ghoul: "arachne",
  earth: "sheepman_armored",
  light: "sheepman_elder",
  ice: "sheepman_elite",
  poison: "arachne",
};

export function bossLookId(b: { bossId?: string | null; type?: string | null }): string {
  if (b.bossId && LOOK_BY_BOSS_ID[b.bossId]) return LOOK_BY_BOSS_ID[b.bossId]!;
  if (b.type && LOOK_BY_TYPE[b.type]) return LOOK_BY_TYPE[b.type]!;
  return "sheepman";
}

const images = new Map<string, HTMLImageElement>();
function imgFor(src: string): HTMLImageElement {
  let im = images.get(src);
  if (!im) { im = new Image(); im.src = src; images.set(src, im); }
  return im;
}
function readyImg(src: string): HTMLImageElement | null {
  const im = imgFor(src);
  return im.complete && im.naturalWidth ? im : null;
}

/** Warm the boss sheets at boot so a boss is dressed on its first frame. */
export function initBossSprites(): void {
  for (const look of Object.values(BOSS_LOOKS)) imgFor(look.src);
}

export type BossDraw = {
  x: number;
  y: number;
  bossId?: string | null;
  type?: string | null;
  direction?: BossDir | null;
  facing?: number;
  moving?: boolean;
  walk?: number;
  hurt?: number;
  enraged?: boolean;
  time?: number;
};

// Walk cycle: stand on the centre frame, step out to each side.
const WALK_SEQ = [1, 0, 1, 2] as const;

/**
 * Draws a boss from its sheet. Returns false if the sheet has not loaded yet, so the
 * caller can fall back to the old creature sprite for the first frames.
 */
export function drawBossSprite(ctx: CanvasRenderingContext2D, m: BossDraw): boolean {
  const look = BOSS_LOOKS[bossLookId(m)];
  if (!look) return false;
  const im = readyImg(look.src);
  if (!im) return false;

  const dir: BossDir = (m.direction as BossDir) ?? ((m.facing ?? 1) < 0 ? "left" : "down");
  const row = look.rows[dir] ?? look.rows.down;
  const t = m.time ?? 0;
  // Flyers always flap; walkers step when moving and settle on the idle frame otherwise.
  const anim = look.fly || m.moving !== false;
  const phase = Math.floor(t * (look.fly ? 7 : 6) + m.x * 0.02);
  const frame = anim ? WALK_SEQ[((phase % WALK_SEQ.length) + WALK_SEQ.length) % WALK_SEQ.length]! : 1;

  const dw = Math.round(look.fw * look.scale);
  const dh = Math.round(look.fh * look.scale);
  const hover = look.fly ? Math.round(Math.sin(t * 2.3 + m.x * 0.03) * 3) : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(m.x), Math.round(m.y));
  // Ground shadow (a flyer casts a smaller, detached one).
  ctx.save();
  ctx.fillStyle = look.fly ? "rgba(0,0,0,.22)" : "rgba(0,0,0,.30)";
  ctx.beginPath();
  ctx.ellipse(0, look.fly ? 2 : 0, dw * (look.fly ? 0.24 : 0.3), Math.max(4, dh * 0.07), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.globalAlpha = (m.hurt ?? 0) > 0 ? 0.6 : 1;
  const sx = frame * look.fw;
  const sy = row * look.fh;
  const dx = -Math.round(dw / 2);
  const dy = -dh + look.lift - hover;
  // Enraged bosses get a pulsing hot rim so the state reads at a glance (glows only the sprite's own pixels).
  if (m.enraged) {
    ctx.shadowColor = "#ff5a2a";
    ctx.shadowBlur = 6 + 4 * (0.5 + 0.5 * Math.sin(t * 6));
  } else if ((m.hurt ?? 0) > 0) {
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 5;
  }
  ctx.drawImage(im, sx, sy, look.fw, look.fh, dx, dy, dw, dh);
  ctx.restore();
  return true;
}
