/**
 * Crying Lady — revamped character model (TEST / prototype for Visible Armor Sets).
 *
 * Built entirely in the in-game sprite-maker format: every part is a 16×16 pixel grid, the exact
 * same `(string|null)[256]` canvas the Enemy Designer draws with. A readable char grid compiles to
 * that format at load.
 *
 * The model is a layered paper-doll:
 *   - a nude BASE body (modest chibi, crying face), authored for 4 facings (down / up / side, with
 *     side flipped for left↔right) and animated with a stepping walk;
 *   - CLOTHING layers per gear slot (head, chest, legs, feet, + relic accessory), authored neutral
 *     and tinted at draw time by the piece's ELEMENT (its colour) and RARITY (trim + glow):
 *       worn/common : flat element colour, no trim
 *       fine/rare   : brighter shading + a metallic trim line
 *       epic/legend : trim + a glowing element-coloured edge/aura
 *   - each slot is coloured independently from its own equipped piece.
 *
 * This is wired in as the `cryinggirl` class model (see sprites.ts drawActor). Equip gear of
 * different elements/rarities and each slot recolours on its own.
 */
import type { TypeId } from "./content";
import { TYPES } from "./content";

type Dir = "down" | "up" | "side";
type Px = (string | null)[]; // 256, row-major 16×16

const W = 16;
const H = 16;

// --- fixed body palette -----------------------------------------------------
const SKIN = { d: "#b5764f", m: "#d89a6a", l: "#f0c196" };
const HAIR = { d: "#2a1d2e", m: "#3d2b42" };
const EYE = "#2a1d2e";
const TEAR = "#9ad0ff";
const MOUTH = "#9a4a4a";
const LINE = "#201018";

/** Compile a char grid (rows) into a 256-length pixel array using a colour map. */
function grid(rows: string[], map: Record<string, string>): Px {
  const px: Px = new Array(256).fill(null);
  for (let y = 0; y < H; y++) {
    const row = (rows[y] ?? "").padEnd(W, ".").slice(0, W);
    for (let x = 0; x < W; x++) {
      const ch = row[x]!;
      if (ch === "." || ch === " ") continue;
      const col = map[ch];
      if (col) px[y * W + x] = col;
    }
  }
  return px;
}

const BODY_MAP: Record<string, string> = {
  H: HAIR.d, h: HAIR.m, d: SKIN.d, s: SKIN.m, S: SKIN.l, e: EYE, t: TEAR, m: MOUTH, o: LINE,
};

// --- BASE BODY (upper 12 rows; legs drawn separately so they can step) ------
// DOWN — facing the viewer, crying.
const BASE_DOWN = grid([
  "......HHHH......",
  ".....HhhhhH.....",
  "....HhssssHH....",
  "....HsssssSH....",
  "....HeSsseSH....",
  "....dstssst d...",
  ".....dsmsd  ....",
  "......dssd......",
  ".....ssssss.....",
  "....ssssssss....",
  "....dssssssd....",
  ".....dssssd.....",
], BODY_MAP);

// UP — facing away, hair covers the head.
const BASE_UP = grid([
  "......HHHH......",
  ".....HHHHHH.....",
  "....HHHHHHHH....",
  "....HHHHHHHH....",
  "....HHHHHHHH....",
  ".....HHHHHH.....",
  "......dssd......",
  ".....ssssss.....",
  "....ssssssss....",
  "....ssssssss....",
  "....dssssssd....",
  ".....dssssd.....",
], BODY_MAP);

// SIDE — profile (drawn facing right; flipped for left). One eye, one tear.
const BASE_SIDE = grid([
  ".....HHHH.......",
  "....HhhhhH......",
  "....HhsssH......",
  "....HssssS......",
  "....Hesss.......",
  "....dstss.......",
  ".....dsm d......",
  "......dssd......",
  ".....sssss......",
  ".....ssssss.....",
  ".....dsssd......",
  ".....dssd.......",
], BODY_MAP);

const BASE: Record<Dir, Px> = { down: BASE_DOWN, up: BASE_UP, side: BASE_SIDE };

// --- LEGS (rows 12–15). Left cols <8, right cols ≥8; animated by lifting each in turn. ---
const LEG_DOWN = grid([
  "....ss..ss....",
  "....ss..ss....",
  "....ds..sd....",
  "....dd..dd....",
].map((r) => r), { s: SKIN.m, d: SKIN.d });
const LEG_UP = LEG_DOWN;
const LEG_SIDE = grid([
  ".....sss......",
  ".....sss......",
  ".....dsd......",
  ".....ddd......",
], { s: SKIN.m, d: SKIN.d });
const LEGS: Record<Dir, Px> = { down: LEG_DOWN, up: LEG_UP, side: LEG_SIDE };

// ---------------------------------------------------------------------------
// Clothing. Authored neutral: D dark / M mid / L light / R trim. Tinted per element & rarity.
// Each garment is {y, rows} occupying part of the 16×16 grid, with 2 style variants per slot.
// ---------------------------------------------------------------------------
type Garment = { y: number; rows: string[] };
type SlotArt = { down: Garment[]; up: Garment[]; side: Garment[] };

const HEAD: SlotArt = {
  // style 0: hood, style 1: circlet
  down: [
    { y: 1, rows: ["....MDDDDDDM....", "...MDLLLLLLDM...", "...MD......DM..."] },
    { y: 2, rows: ["....RMLLLLMR...."] },
  ],
  up: [
    { y: 1, rows: ["....MDDDDDDM....", "...MDDDDDDDDM..", "...MDDDDDDDDM.."] },
    { y: 2, rows: ["....RMLLLLMR...."] },
  ],
  side: [
    { y: 1, rows: ["....MDDDDM.....", "...MDLLLLDM....", "...MD...DM....."] },
    { y: 2, rows: ["....RMLLMR....."] },
  ],
};

const CHEST: SlotArt = {
  // style 0: robe top, style 1: tunic with belt
  down: [
    { y: 7, rows: ["......DMMD......", ".....DMLLMD....", "....DMLLLLMD...", "....DMLLLLMD...", "....RMLLLLMR..."] },
    { y: 7, rows: ["......MMMM......", ".....MLLLLM....", "....MLLLLLLM...", "....DDRRRRDD...", "....MLLLLLLM..."] },
  ],
  up: [
    { y: 7, rows: ["......DMMD......", ".....DMMMMD....", "....DMMMMMMD...", "....DMMMMMMD...", "....RMMMMMMR..."] },
    { y: 7, rows: ["......MMMM......", ".....MMMMMM....", "....MMMMMMMM...", "....DDRRRRDD...", "....MMMMMMMM.."] },
  ],
  side: [
    { y: 7, rows: [".....DMMD......", ".....DMLMD.....", ".....DMLLM.....", ".....DMLLM.....", ".....RMLLR....."] },
    { y: 7, rows: [".....MMMM......", ".....MLLM......", ".....MLLLM.....", ".....DRRRD.....", ".....MLLLM....."] },
  ],
};

const LEGSWEAR: SlotArt = {
  // style 0: skirt, style 1: trousers
  down: [
    { y: 11, rows: [".....DMMMMD....", "....DMLLLLMD...", "...DMLLLLLLMD..", "...RM......MR.."] },
    { y: 12, rows: ["....MM..MM....", "....ML..LM....", "....DR..RD...."] },
  ],
  up: [
    { y: 11, rows: [".....DMMMMD....", "....DMMMMMMD...", "...DMMMMMMMMD..", "...RM......MR.."] },
    { y: 12, rows: ["....MM..MM....", "....MM..MM....", "....DR..RD...."] },
  ],
  side: [
    { y: 11, rows: [".....DMMMD.....", "....DMLLLMD....", "....RMLLLMR....", "....R.....R...."] },
    { y: 12, rows: [".....MMM......", ".....MLM......", ".....DRD......"] },
  ],
};

const FEET: SlotArt = {
  // boots
  down: [{ y: 14, rows: ["....DD..DD....", "....RL..LR...."] }],
  up: [{ y: 14, rows: ["....DD..DD....", "....DR..RD...."] }],
  side: [{ y: 14, rows: [".....DDD......", ".....RLR......"] }],
};

const RELIC: SlotArt = {
  // shoulder cape / pauldron accent
  down: [{ y: 7, rows: ["....L......L...", "...DL......LD.."] }],
  up: [{ y: 7, rows: ["...DLLLLLLLLD..", "...DL......LD.."] }],
  side: [{ y: 7, rows: ["....LD........", "....LDD......."] }],
};

const SLOT_ART: Record<string, SlotArt> = { head: HEAD, chest: CHEST, legs: LEGSWEAR, feet: FEET, relic: RELIC };

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Element + rarity → the four garment colours (dark / mid / light / trim) and a glow flag. */
function garmentPalette(type: TypeId, rarity: number): { D: string; M: string; L: string; R: string | null; glow: string | null } {
  const base = TYPES[type]?.color ?? "#c8c0b0";
  const bright = rarity >= 2; // fine+
  const D = shade(base, -70);
  const M = shade(base, bright ? -10 : -25);
  const L = shade(base, bright ? 55 : 25);
  // Trim: only fine+ shows it; epic+ trims in near-white metallic.
  const R = rarity >= 4 ? "#fff6e8" : rarity >= 2 ? shade(base, 80) : null;
  const glow = rarity >= 4 ? base : null; // epic/legendary: glowing edge
  return { D, M, L, R, glow };
}

function stampPx(ctx: CanvasRenderingContext2D, px: Px, ox: number, oy: number, cell: number, flip: boolean, dyRows = 0): void {
  for (let i = 0; i < 256; i++) {
    const col = px[i];
    if (!col) continue;
    const x = i % W, y = Math.floor(i / W) + dyRows;
    const dx = flip ? (W - 1 - x) : x;
    ctx.fillStyle = col;
    ctx.fillRect(ox + dx * cell, oy + y * cell, cell, cell);
  }
}

function stampGarment(ctx: CanvasRenderingContext2D, g: Garment, pal: ReturnType<typeof garmentPalette>, ox: number, oy: number, cell: number, flip: boolean, dyRows = 0): void {
  const map: Record<string, string | null> = { D: pal.D, M: pal.M, L: pal.L, R: pal.R };
  const draw = (pass: "glow" | "body") => {
    g.rows.forEach((row, ry) => {
      const r = row.padEnd(W, ".").slice(0, W);
      for (let x = 0; x < W; x++) {
        const ch = r[x]!;
        if (ch === "." || ch === " ") continue;
        let col = map[ch] ?? pal.M;
        if (ch === "R" && !pal.R) col = pal.L; // no trim at low rarity → fall back to light
        if (!col) continue;
        const dx = flip ? (W - 1 - x) : x;
        const px = ox + dx * cell, py = oy + (g.y + ry + dyRows) * cell;
        if (pass === "glow") {
          if (!pal.glow) return;
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = pal.glow;
          ctx.fillRect(px - cell, py, cell, cell);
          ctx.fillRect(px + cell, py, cell, cell);
          ctx.fillRect(px, py - cell, cell, cell);
          ctx.fillRect(px, py + cell, cell, cell);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = col;
          ctx.fillRect(px, py, cell, cell);
        }
      }
    });
  };
  if (pal.glow) draw("glow");
  draw("body");
}

type Piece = { slot: string; type: TypeId; quality: number };

/** Draws the revamped Crying Lady model. `a` is the ActorDraw (direction, walk, moving, pieces). */
export function drawCryingLady(ctx: CanvasRenderingContext2D, a: any): void {
  const dirRaw = (a.direction ?? "down") as "up" | "down" | "left" | "right";
  const dir: Dir = dirRaw === "up" ? "up" : dirRaw === "down" ? "down" : "side";
  const flip = dirRaw === "left"; // side art faces right
  const scale = (a.scale ?? 1) * (a.tall ?? 1);
  const cell = 2.2 * scale; // ~16px grid → ~35px tall body, in line with the class sprites
  const ox = Math.round(a.x - (W / 2) * cell);
  // Feet sit on the actor's origin (a.y). Grid is 16 tall.
  const oy = Math.round(a.y - H * cell + 2);

  const moving = a.moving !== false && (a.walk ?? 0) > 0.05;
  const frame = moving ? Math.floor(Math.abs(a.walk)) % 3 : 1; // 0,1,2
  const bob = moving ? (frame === 1 ? 0 : -1) : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Shadow.
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.beginPath();
  ctx.ellipse(a.x, a.y - 1, 9 * scale, 3 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  const pieces: Piece[] = (a.pieces ?? []).filter((p: Piece) => SLOT_ART[p.slot]);
  const pal = (slot: string): ReturnType<typeof garmentPalette> | null => {
    const p = pieces.find((q) => q.slot === slot);
    return p ? garmentPalette(p.type, p.quality) : null;
  };
  const styleOf = (slot: string): number => {
    const p = pieces.find((q) => q.slot === slot);
    return p ? ((p as any).style ?? 0) : 0;
  };
  const garment = (slot: string): Garment | null => {
    const art = SLOT_ART[slot];
    if (!art) return null;
    const list = art[dir];
    return list[styleOf(slot) % Math.max(1, list.length)] ?? list[0] ?? null;
  };

  // Legs step: left leg (cols<8) lifts on frame 0, right leg on frame 2.
  const legLiftLeft = moving && frame === 0 ? -1 : 0;
  const legLiftRight = moving && frame === 2 ? -1 : 0;
  const legs = LEGS[dir];
  // Split legs into halves so each can lift independently.
  for (let i = 0; i < 256; i++) {
    const col = legs[i];
    if (!col) continue;
    const x = i % W, y = Math.floor(i / W);
    const left = x < 8;
    const lift = left ? legLiftLeft : legLiftRight;
    const dx = flip ? (W - 1 - x) : x;
    ctx.fillStyle = col;
    ctx.fillRect(ox + dx * cell, oy + (y + 12 + bob + lift) * cell, cell, cell);
  }
  // Feet garment follows the legs.
  const feetG = garment("feet");
  const feetPal = pal("feet");
  if (feetG && feetPal) {
    // draw per-half with the same lift
    feetG.rows.forEach((row, ry) => {
      const r = row.padEnd(W, ".").slice(0, W);
      for (let x = 0; x < W; x++) {
        const ch = r[x]!;
        if (ch === "." || ch === " ") continue;
        const map: Record<string, string | null> = { D: feetPal.D, M: feetPal.M, L: feetPal.L, R: feetPal.R ?? feetPal.L };
        const col = map[ch] ?? feetPal.M;
        if (!col) continue;
        const lift = x < 8 ? legLiftLeft : legLiftRight;
        const dx = flip ? (W - 1 - x) : x;
        ctx.fillStyle = col;
        ctx.fillRect(ox + dx * cell, oy + (feetG.y + ry + bob + lift) * cell, cell, cell);
      }
    });
  }

  // Legs garment (skirt/trousers) over the hips.
  const legsG = garment("legs");
  const legsPal = pal("legs");
  if (legsG && legsPal) stampGarment(ctx, legsG, legsPal, ox, oy, cell, flip, bob);

  // Upper body.
  stampPx(ctx, BASE[dir], ox, oy, cell, flip, bob);

  // Chest, then relic accent, then head.
  const chestG = garment("chest");
  const chestPal = pal("chest");
  if (chestG && chestPal) stampGarment(ctx, chestG, chestPal, ox, oy, cell, flip, bob);
  const relicG = garment("relic");
  const relicPal = pal("relic");
  if (relicG && relicPal) stampGarment(ctx, relicG, relicPal, ox, oy, cell, flip, bob);
  const headG = garment("head");
  const headPal = pal("head");
  if (headG && headPal) stampGarment(ctx, headG, headPal, ox, oy, cell, flip, bob);

  // Hurt flash.
  if (a.hurt > 0) {
    ctx.globalAlpha = Math.min(0.55, a.hurt * 0.55);
    ctx.fillStyle = "#fff";
    ctx.fillRect(ox + 3 * cell, oy + bob * cell, 10 * cell, 16 * cell);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}
