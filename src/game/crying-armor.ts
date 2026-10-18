/*
 * crying-armor.ts — procedural per-piece armor silhouettes for the Lidia paper-doll.
 *
 * Each slot has a kit of chunky pixel-art shapes keyed off the piece's style number, so wearing
 * mismatched pieces stacks three visibly different silhouettes on the character (Terraria-style).
 * All geometry is tuned to the actual Lidia body bounding boxes (measured on the real sheets),
 * so pauldrons sit on the shoulders, belts land on the hip, and boots cover the feet rather
 * than hovering an inch above them.
 *
 * ───── Lidia body coordinates (within a 64×64 cell, measured on base.png + layer sheets) ─────
 *   HEAD        y 11-20   x 24-40   (hair tops around y 11, forehead y 16, chin y 24)
 *   SHOULDER    y 20-28   x 18-26 (L) · x 38-46 (R)
 *   CHEST       y 22-34   x 24-40   (sigils/sashes live here)
 *   HIP/BELT    y 44-52   x 24-40
 *   LEGS        y 48-56   x 25-39
 *   FEET        y 54-61   x 23-40
 *   SHOULDERS/MANTLE  y 32-40  x 22-41 (shawl layer in-game)
 *   WRISTS      y 36-45   x 18-22 (L) · x 42-46 (R)
 * Facings: "down" is the authored front; "left" draws the side profile; "right" is the mirror
 * of left (handled by the caller). "up" (back) hides front-only details (chest sigils, buckles,
 * facial accessories like veils).
 *
 * ───── Scale behaviour ─────
 * The 64×64 overlay is drawn into a destination that's roughly 46×46 (Lidia's draw scale is
 * 0.72). Every feature uses at least 2 virtual pixels so it never sub-pixel-smudges down to
 * zero on upscale. Smoothing is off end-to-end.
 *
 * ───── How to ADD a new silhouette ─────
 *   1. Add a drawer function (anywhere in this file).
 *   2. Append it to that slot's `SHAPES_<slot>` array.
 *   3. Append a human-readable label to `SHAPE_NAMES[<slot>]`.
 * That's it — any piece whose `pieceShapeVariant` hashes to the new index will use it.
 */
import { SET_BY_ID, type SetDef } from "./content";

type Dir = "up" | "down" | "left" | "right";
type SlotName = "head" | "chest" | "legs" | "feet" | "relic" | "weapon";

/** Palette for one piece on one wearer. */
export type ArmorPalette = {
  /** Main fill colour (hex). */
  color: string;
  /** Accent colour (hex) — buckles, trim, jewels. */
  trim: string;
  /** Glow colour, or null for a plain draw. */
  glow: string | null;
};

type ShapeFn = (g: CanvasRenderingContext2D, dir: Dir, pal: ArmorPalette) => void;

const CELL = 64;

// ─────────────────────────────────────────────────────────────────────────────
// Pixel primitives at 64×64. All features are ≥2px so they survive upscale.
// ─────────────────────────────────────────────────────────────────────────────
const px = (g: CanvasRenderingContext2D, x: number, y: number, w = 1, h = 1): void => {
  g.fillRect(Math.round(x), Math.round(y), Math.max(1, w), Math.max(1, h));
};
const isFront = (dir: Dir): boolean => dir !== "up";
const isSide = (dir: Dir): boolean => dir === "left" || dir === "right";

// Body landmark constants (empirically measured on Lidia base.png, down-facing, col 0).
const HEAD_Y = 16;        // forehead
const HEAD_LEFT = 24;
const HEAD_RIGHT = 40;
const SHOULDER_Y = 22;
const SHOULDER_L = 18;
const SHOULDER_R = 42;
const CHEST_Y = 28;
const HIP_Y = 46;
const HIP_LEFT = 24;
const HIP_RIGHT = 40;
const KNEE_Y = 50;
const ANKLE_Y = 56;
const FOOT_LEFT = 23;
const FOOT_RIGHT = 40;

// ─────────────────────────────────────────────────────────────────────────────
// HEAD (hairband layer) — crowns, horns, veils, tiaras. Sits atop y ~11-16.
// ─────────────────────────────────────────────────────────────────────────────
const SHAPES_HEAD: ShapeFn[] = [
  // 0: thin circlet
  (g, _d, p) => {
    g.fillStyle = p.color; px(g, HEAD_LEFT, HEAD_Y - 3, HEAD_RIGHT - HEAD_LEFT, 2);
    g.fillStyle = p.trim; px(g, 31, HEAD_Y - 3, 2, 2);
  },
  // 1: three-point crown
  (g, dir, p) => {
    g.fillStyle = p.color;
    px(g, HEAD_LEFT, HEAD_Y - 3, HEAD_RIGHT - HEAD_LEFT, 2);
    if (isFront(dir)) { px(g, 25, HEAD_Y - 6, 2, 3); px(g, 31, HEAD_Y - 8, 2, 5); px(g, 37, HEAD_Y - 6, 2, 3); }
    g.fillStyle = p.trim; if (isFront(dir)) px(g, 31, HEAD_Y - 6, 2, 2);
  },
  // 2: tall five-point crown
  (g, dir, p) => {
    g.fillStyle = p.color;
    px(g, HEAD_LEFT - 1, HEAD_Y - 3, HEAD_RIGHT - HEAD_LEFT + 2, 2);
    if (isFront(dir)) {
      px(g, 24, HEAD_Y - 6, 2, 3); px(g, 28, HEAD_Y - 9, 2, 6); px(g, 31, HEAD_Y - 11, 2, 8);
      px(g, 35, HEAD_Y - 9, 2, 6); px(g, 39, HEAD_Y - 6, 2, 3);
    }
    g.fillStyle = p.trim; if (isFront(dir)) px(g, 31, HEAD_Y - 8, 2, 2);
  },
  // 3: curved horns
  (g, _d, p) => {
    g.fillStyle = p.color;
    // Left horn
    px(g, 23, HEAD_Y - 3, 2, 2); px(g, 22, HEAD_Y - 5, 2, 2); px(g, 21, HEAD_Y - 7, 2, 2);
    // Right horn (mirrored)
    px(g, 39, HEAD_Y - 3, 2, 2); px(g, 40, HEAD_Y - 5, 2, 2); px(g, 41, HEAD_Y - 7, 2, 2);
    g.fillStyle = p.trim; px(g, 21, HEAD_Y - 8, 2, 2); px(g, 41, HEAD_Y - 8, 2, 2);
  },
  // 4: antlers
  (g, _d, p) => {
    g.fillStyle = p.color;
    for (let i = 0; i < 5; i++) { px(g, 23 - Math.floor(i / 2), HEAD_Y - 4 - i, 2, 2); px(g, 39 + Math.floor(i / 2), HEAD_Y - 4 - i, 2, 2); }
    px(g, 20, HEAD_Y - 8, 2, 2); px(g, 42, HEAD_Y - 8, 2, 2);
  },
  // 5: veil (falls past hair)
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, HEAD_LEFT, HEAD_Y - 3, HEAD_RIGHT - HEAD_LEFT, 2);
    if (isFront(dir)) {
      // Short veil behind sides of head
      px(g, 21, HEAD_Y - 1, 2, 7); px(g, 41, HEAD_Y - 1, 2, 7);
    }
    g.fillStyle = p.trim; px(g, 31, HEAD_Y - 3, 2, 2);
  },
  // 6: tiara with centre jewel
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, 25, HEAD_Y - 3, 14, 2); px(g, 28, HEAD_Y - 4, 8, 2);
    g.fillStyle = p.trim; if (isFront(dir)) px(g, 31, HEAD_Y - 5, 2, 2);
  },
  // 7: laurel wreath
  (g, _d, p) => {
    g.fillStyle = p.color;
    // Left side leaves
    px(g, 23, HEAD_Y - 2, 2, 2); px(g, 22, HEAD_Y - 4, 2, 2); px(g, 24, HEAD_Y - 6, 2, 2);
    // Right side leaves
    px(g, 39, HEAD_Y - 2, 2, 2); px(g, 40, HEAD_Y - 4, 2, 2); px(g, 38, HEAD_Y - 6, 2, 2);
  },
  // 8: wrap/turban
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, 22, HEAD_Y - 5, 20, 5);
    g.fillStyle = p.trim; if (isFront(dir)) { px(g, 22, HEAD_Y - 3, 20, 2); px(g, 31, HEAD_Y - 2, 2, 2); }
  },
  // 9: feathered band
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, HEAD_LEFT, HEAD_Y - 3, HEAD_RIGHT - HEAD_LEFT, 2);
    if (isFront(dir)) { px(g, 25, HEAD_Y - 6, 2, 3); px(g, 31, HEAD_Y - 8, 2, 5); px(g, 37, HEAD_Y - 6, 2, 3); }
    g.fillStyle = p.trim; if (isFront(dir)) { px(g, 25, HEAD_Y - 5); px(g, 31, HEAD_Y - 6); px(g, 37, HEAD_Y - 5); }
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CHEST (suit layer) — necklines, pauldrons, sigils. Shoulders at y 22, torso y 28-34.
// ─────────────────────────────────────────────────────────────────────────────
const SHAPES_CHEST: ShapeFn[] = [
  // 0: plain round neck trim
  (g, dir, p) => { if (isFront(dir)) { g.fillStyle = p.trim; px(g, 29, CHEST_Y - 2, 6, 2); } },
  // 1: V-neck
  (g, dir, p) => {
    if (!isFront(dir)) return;
    g.fillStyle = p.trim;
    px(g, 28, CHEST_Y - 2, 2, 2); px(g, 30, CHEST_Y, 2, 2); px(g, 32, CHEST_Y + 2, 2, 2); px(g, 34, CHEST_Y, 2, 2); px(g, 36, CHEST_Y - 2, 2, 2);
  },
  // 2: round pauldrons
  (g, _d, p) => {
    g.fillStyle = p.color;
    px(g, SHOULDER_L, SHOULDER_Y, 4, 3); px(g, SHOULDER_R, SHOULDER_Y, 4, 3);
    px(g, SHOULDER_L + 1, SHOULDER_Y - 1, 2, 1); px(g, SHOULDER_R + 1, SHOULDER_Y - 1, 2, 1);
    g.fillStyle = p.trim; px(g, SHOULDER_L + 1, SHOULDER_Y + 3, 2, 1); px(g, SHOULDER_R + 1, SHOULDER_Y + 3, 2, 1);
  },
  // 3: spiked pauldrons
  (g, _d, p) => {
    g.fillStyle = p.color;
    px(g, SHOULDER_L - 1, SHOULDER_Y, 5, 3); px(g, SHOULDER_R, SHOULDER_Y, 5, 3);
    px(g, SHOULDER_L - 1, SHOULDER_Y - 2, 2, 2); px(g, SHOULDER_L + 2, SHOULDER_Y - 3, 2, 2);
    px(g, SHOULDER_R + 3, SHOULDER_Y - 2, 2, 2); px(g, SHOULDER_R, SHOULDER_Y - 3, 2, 2);
  },
  // 4: winged pauldrons
  (g, _d, p) => {
    g.fillStyle = p.color;
    px(g, SHOULDER_L - 2, SHOULDER_Y, 6, 2); px(g, SHOULDER_R, SHOULDER_Y, 6, 2);
    px(g, SHOULDER_L - 4, SHOULDER_Y + 2, 2, 1); px(g, SHOULDER_R + 4, SHOULDER_Y + 2, 2, 1);
    g.fillStyle = p.trim; px(g, SHOULDER_L, SHOULDER_Y - 1, 2, 1); px(g, SHOULDER_R + 2, SHOULDER_Y - 1, 2, 1);
  },
  // 5: high collar + chest medallion
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, 29, CHEST_Y - 3, 6, 2);
    if (isFront(dir)) {
      g.fillStyle = p.trim;
      px(g, 30, CHEST_Y + 3, 4, 3); // medallion
      px(g, 31, CHEST_Y + 6, 2, 2); // pendant tail
    }
  },
  // 6: sash across chest
  (g, dir, p) => {
    if (!isFront(dir)) return;
    g.fillStyle = p.trim;
    for (let i = 0; i < 8; i++) px(g, 25 + i, CHEST_Y - 1 + Math.floor(i / 2), 2, 2);
  },
  // 7: chest sigil (diamond)
  (g, dir, p) => {
    if (!isFront(dir)) return;
    g.fillStyle = p.trim;
    px(g, 31, CHEST_Y + 2, 2, 2);
    px(g, 30, CHEST_Y + 3, 4, 2);
    px(g, 29, CHEST_Y + 4, 6, 2);
    px(g, 30, CHEST_Y + 6, 4, 2);
    px(g, 31, CHEST_Y + 7, 2, 2);
    g.fillStyle = p.color; px(g, 31, CHEST_Y + 4, 2, 2);
  },
  // 8: open coat with clasps
  (g, dir, p) => {
    if (!isFront(dir)) return;
    g.fillStyle = p.trim;
    for (let y = CHEST_Y - 1; y < CHEST_Y + 10; y += 3) { px(g, 29, y, 2, 2); px(g, 33, y, 2, 2); }
  },
  // 9: crossed sashes (X)
  (g, dir, p) => {
    if (!isFront(dir)) return;
    g.fillStyle = p.trim;
    for (let i = 0; i < 8; i++) {
      px(g, 25 + i, CHEST_Y - 1 + Math.floor(i / 2), 2, 2);
      px(g, 39 - i, CHEST_Y - 1 + Math.floor(i / 2), 2, 2);
    }
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// LEGS (belt layer) — belts, buckles, tassets. Belt sits at y 44-52.
// ─────────────────────────────────────────────────────────────────────────────
const SHAPES_LEGS: ShapeFn[] = [
  // 0: thin belt
  (g, _d, p) => {
    g.fillStyle = p.color; px(g, HIP_LEFT, HIP_Y, HIP_RIGHT - HIP_LEFT, 2);
    g.fillStyle = p.trim; px(g, 31, HIP_Y, 2, 2);
  },
  // 1: wide belt + round buckle
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, HIP_LEFT, HIP_Y - 1, HIP_RIGHT - HIP_LEFT, 3);
    if (isFront(dir)) {
      g.fillStyle = p.trim;
      px(g, 30, HIP_Y - 1, 4, 3); // round-ish buckle
      g.fillStyle = p.color; px(g, 31, HIP_Y, 2, 1);
    }
  },
  // 2: wide belt + diamond buckle
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, HIP_LEFT, HIP_Y - 1, HIP_RIGHT - HIP_LEFT, 3);
    if (isFront(dir)) {
      g.fillStyle = p.trim;
      px(g, 31, HIP_Y - 2, 2, 2); px(g, 30, HIP_Y, 4, 2); px(g, 31, HIP_Y + 2, 2, 2);
    }
  },
  // 3: belt + side pouch
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, HIP_LEFT, HIP_Y, HIP_RIGHT - HIP_LEFT, 2);
    if (dir === "left") px(g, HIP_LEFT - 2, HIP_Y + 2, 3, 4);
    else if (dir === "right") px(g, HIP_RIGHT - 1, HIP_Y + 2, 3, 4);
    else { px(g, HIP_RIGHT, HIP_Y + 2, 3, 4); px(g, HIP_LEFT - 1, HIP_Y + 2, 3, 4); }
  },
  // 4: double crossed belts
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, HIP_LEFT, HIP_Y - 1, HIP_RIGHT - HIP_LEFT, 2); px(g, HIP_LEFT, HIP_Y + 2, HIP_RIGHT - HIP_LEFT, 2);
    if (isFront(dir)) { g.fillStyle = p.trim; px(g, 31, HIP_Y - 1, 2, 5); }
  },
  // 5: tasset plates (hanging)
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, HIP_LEFT, HIP_Y, HIP_RIGHT - HIP_LEFT, 2);
    if (!isSide(dir)) {
      px(g, 25, HIP_Y + 2, 4, 5); px(g, 30, HIP_Y + 2, 4, 5); px(g, 35, HIP_Y + 2, 4, 5);
      g.fillStyle = p.trim; px(g, 26, HIP_Y + 4, 2, 1); px(g, 31, HIP_Y + 4, 2, 1); px(g, 36, HIP_Y + 4, 2, 1);
    }
  },
  // 6: belt + hanging chain
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, HIP_LEFT, HIP_Y, HIP_RIGHT - HIP_LEFT, 2);
    if (isFront(dir)) { g.fillStyle = p.trim; for (let y = HIP_Y + 2; y < HIP_Y + 10; y += 2) px(g, 36 + ((y >> 1) & 1) * 2, y, 2, 1); }
  },
  // 7: broad obi/sash
  (g, _d, p) => {
    g.fillStyle = p.color; px(g, HIP_LEFT - 1, HIP_Y - 2, HIP_RIGHT - HIP_LEFT + 2, 5);
    g.fillStyle = p.trim; px(g, HIP_LEFT - 1, HIP_Y + 2, HIP_RIGHT - HIP_LEFT + 2, 2);
  },
  // 8: studded belt
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, HIP_LEFT, HIP_Y, HIP_RIGHT - HIP_LEFT, 2);
    if (!isSide(dir)) { g.fillStyle = p.trim; for (let x = HIP_LEFT + 1; x < HIP_RIGHT; x += 3) px(g, x, HIP_Y + 1, 2, 1); }
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FEET (boot layer) — boot heights, toecaps, cuffs. Feet at y 54-61, legs above.
// ─────────────────────────────────────────────────────────────────────────────
const SHAPES_FEET: ShapeFn[] = [
  // 0: ankle boot cuff
  (g, _d, p) => {
    g.fillStyle = p.color; px(g, FOOT_LEFT, ANKLE_Y, FOOT_RIGHT - FOOT_LEFT, 3);
    g.fillStyle = p.trim; px(g, FOOT_LEFT, ANKLE_Y - 1, FOOT_RIGHT - FOOT_LEFT, 2);
  },
  // 1: mid-calf boot (up to y 48)
  (g, _d, p) => {
    g.fillStyle = p.color; px(g, FOOT_LEFT, 50, FOOT_RIGHT - FOOT_LEFT, 11);
    g.fillStyle = p.trim; px(g, FOOT_LEFT, 50, FOOT_RIGHT - FOOT_LEFT, 2);
  },
  // 2: knee-high (up to y 44)
  (g, _d, p) => {
    g.fillStyle = p.color; px(g, FOOT_LEFT + 1, 44, FOOT_RIGHT - FOOT_LEFT - 2, 17);
    g.fillStyle = p.trim; px(g, FOOT_LEFT + 1, 44, FOOT_RIGHT - FOOT_LEFT - 2, 2); px(g, FOOT_LEFT + 1, 51, FOOT_RIGHT - FOOT_LEFT - 2, 1);
  },
  // 3: thigh-high (up to y 38, overlaps the hip area)
  (g, _d, p) => {
    g.fillStyle = p.color; px(g, FOOT_LEFT + 1, 38, FOOT_RIGHT - FOOT_LEFT - 2, 23);
    g.fillStyle = p.trim; px(g, FOOT_LEFT + 1, 38, FOOT_RIGHT - FOOT_LEFT - 2, 2);
  },
  // 4: pointed toe
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, FOOT_LEFT, ANKLE_Y, FOOT_RIGHT - FOOT_LEFT, 5);
    if (isSide(dir)) px(g, dir === "right" ? FOOT_RIGHT : FOOT_LEFT - 2, ANKLE_Y + 3, 3, 2);
  },
  // 5: fur cuff
  (g, _d, p) => {
    g.fillStyle = p.color; px(g, FOOT_LEFT, ANKLE_Y - 3, FOOT_RIGHT - FOOT_LEFT, 7);
    g.fillStyle = p.trim;
    for (let x = FOOT_LEFT; x < FOOT_RIGHT; x += 2) { px(g, x, ANKLE_Y - 4, 2, 2); }
  },
  // 6: strap boots (wraps)
  (g, _d, p) => {
    g.fillStyle = p.color; px(g, FOOT_LEFT, ANKLE_Y - 3, FOOT_RIGHT - FOOT_LEFT, 8);
    g.fillStyle = p.trim; px(g, FOOT_LEFT, ANKLE_Y - 1, FOOT_RIGHT - FOOT_LEFT, 2); px(g, FOOT_LEFT, ANKLE_Y + 2, FOOT_RIGHT - FOOT_LEFT, 1);
  },
  // 7: armoured greaves (plated front)
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, FOOT_LEFT + 1, 48, FOOT_RIGHT - FOOT_LEFT - 2, 13);
    if (isFront(dir)) { g.fillStyle = p.trim; px(g, 30, 48, 4, 11); }
  },
  // 8: ribbon-tied boots
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, FOOT_LEFT, 50, FOOT_RIGHT - FOOT_LEFT, 11);
    if (isFront(dir)) { g.fillStyle = p.trim; for (let y = 51; y < 60; y += 2) px(g, 31, y, 2, 1); }
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// RELIC (shawl layer) — capes, mantles, cowls. Lives on shoulders y 32-40.
// ─────────────────────────────────────────────────────────────────────────────
const SHAPES_RELIC: ShapeFn[] = [
  // 0: short shoulder cape
  (g, dir, p) => {
    g.fillStyle = p.color;
    if (dir === "up") px(g, 22, 32, 20, 10);
    else { px(g, 22, 32, 4, 8); px(g, 38, 32, 4, 8); }
    g.fillStyle = p.trim; if (dir === "up") px(g, 22, 32, 20, 2);
  },
  // 1: cape to waist
  (g, dir, p) => {
    g.fillStyle = p.color;
    if (dir === "up") px(g, 21, 30, 22, 18);
    else { px(g, 20, 30, 4, 16); px(g, 40, 30, 4, 16); }
    g.fillStyle = p.trim; if (dir === "up") px(g, 21, 30, 22, 2);
  },
  // 2: long cape to feet
  (g, dir, p) => {
    g.fillStyle = p.color;
    if (dir === "up") px(g, 21, 30, 22, 28);
    else { px(g, 20, 30, 3, 28); px(g, 41, 30, 3, 28); }
    g.fillStyle = p.trim;
    if (dir === "up") { px(g, 21, 30, 22, 2); px(g, 31, 32, 2, 26); }
  },
  // 3: hooded cowl
  (g, dir, p) => {
    g.fillStyle = p.color;
    px(g, 23, 10, 18, 10); // hood over the head
    if (dir === "up") px(g, 22, 20, 20, 14);
    g.fillStyle = p.trim; px(g, 23, 10, 18, 2);
  },
  // 4: shoulder pads only
  (g, _d, p) => {
    g.fillStyle = p.color; px(g, 20, SHOULDER_Y - 1, 6, 4); px(g, 38, SHOULDER_Y - 1, 6, 4);
    g.fillStyle = p.trim; px(g, 20, SHOULDER_Y - 1, 6, 2); px(g, 38, SHOULDER_Y - 1, 6, 2);
  },
  // 5: wing mantle
  (g, _d, p) => {
    g.fillStyle = p.color;
    for (let i = 0; i < 5; i++) { px(g, 22 - i, SHOULDER_Y + Math.floor(i / 2) * 2, 2, 3); px(g, 40 + i, SHOULDER_Y + Math.floor(i / 2) * 2, 2, 3); }
    g.fillStyle = p.trim; px(g, 17, SHOULDER_Y + 4, 2, 2); px(g, 45, SHOULDER_Y + 4, 2, 2);
  },
  // 6: single-side mantle
  (g, dir, p) => {
    g.fillStyle = p.color;
    if (dir === "right") px(g, 38, 30, 5, 16);
    else px(g, 21, 30, 5, 16);
    g.fillStyle = p.trim; if (dir === "right") px(g, 38, 30, 5, 2); else px(g, 21, 30, 5, 2);
  },
  // 7: beaded shawl (across shoulders)
  (g, dir, p) => {
    g.fillStyle = p.color;
    if (!isSide(dir)) { px(g, 22, 32, 20, 2); px(g, 24, 34, 16, 2); }
    g.fillStyle = p.trim;
    if (!isSide(dir)) for (let x = 24; x < 40; x += 3) px(g, x, 36, 2, 2);
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// WEAPON (glove layer) — bracers, gauntlets, claws. Wrists at y 36-44.
// ─────────────────────────────────────────────────────────────────────────────
const WRIST_Y = 38;
const SHAPES_WEAPON: ShapeFn[] = [
  // 0: wrist cuff
  (g, _d, p) => {
    g.fillStyle = p.color; px(g, 18, WRIST_Y, 3, 3); px(g, 43, WRIST_Y, 3, 3);
    g.fillStyle = p.trim; px(g, 18, WRIST_Y, 3, 1); px(g, 43, WRIST_Y, 3, 1);
  },
  // 1: forearm bracer
  (g, _d, p) => {
    g.fillStyle = p.color; px(g, 18, WRIST_Y - 4, 3, 8); px(g, 43, WRIST_Y - 4, 3, 8);
    g.fillStyle = p.trim; px(g, 18, WRIST_Y - 4, 3, 2); px(g, 43, WRIST_Y - 4, 3, 2);
  },
  // 2: full gauntlet
  (g, _d, p) => {
    g.fillStyle = p.color; px(g, 18, WRIST_Y - 4, 3, 10); px(g, 43, WRIST_Y - 4, 3, 10);
    g.fillStyle = p.trim; px(g, 18, WRIST_Y + 4, 3, 2); px(g, 43, WRIST_Y + 4, 3, 2);
    px(g, 19, WRIST_Y - 4, 2, 1); px(g, 44, WRIST_Y - 4, 2, 1);
  },
  // 3: claws (3 tips off the back of the hand)
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, 18, WRIST_Y - 2, 3, 4); px(g, 43, WRIST_Y - 2, 3, 4);
    if (isFront(dir)) {
      g.fillStyle = p.trim;
      for (let i = 0; i < 3; i++) { px(g, 16 - i, WRIST_Y + 2 + i, 2, 2); px(g, 46 + i, WRIST_Y + 2 + i, 2, 2); }
    }
  },
  // 4: wrapped bandages
  (g, _d, p) => {
    g.fillStyle = p.color;
    for (let y = WRIST_Y - 4; y < WRIST_Y + 4; y += 3) { px(g, 18, y, 3, 2); px(g, 43, y, 3, 2); }
    g.fillStyle = p.trim;
    for (let y = WRIST_Y - 2; y < WRIST_Y + 3; y += 3) { px(g, 18, y, 3, 1); px(g, 43, y, 3, 1); }
  },
  // 5: ringed knuckles
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, 18, WRIST_Y, 3, 3); px(g, 43, WRIST_Y, 3, 3);
    if (isFront(dir)) { g.fillStyle = p.trim; for (let i = 0; i < 3; i++) { px(g, 17 - i, WRIST_Y + 3, 2, 2); px(g, 46 + i, WRIST_Y + 3, 2, 2); } }
  },
  // 6: scaled gauntlet (patterned)
  (g, _d, p) => {
    g.fillStyle = p.color; px(g, 18, WRIST_Y - 2, 3, 7); px(g, 43, WRIST_Y - 2, 3, 7);
    g.fillStyle = p.trim;
    for (let y = WRIST_Y - 2; y < WRIST_Y + 5; y += 2) { px(g, 18, y, 2, 1); px(g, 43, y, 2, 1); }
  },
  // 7: fingerless with cuff
  (g, _d, p) => {
    g.fillStyle = p.color; px(g, 18, WRIST_Y - 2, 3, 6); px(g, 43, WRIST_Y - 2, 3, 6);
    g.fillStyle = p.trim; px(g, 18, WRIST_Y - 2, 3, 2); px(g, 43, WRIST_Y - 2, 3, 2);
  },
];

const SHAPES: Record<SlotName, ShapeFn[]> = {
  head: SHAPES_HEAD, chest: SHAPES_CHEST, legs: SHAPES_LEGS, feet: SHAPES_FEET,
  relic: SHAPES_RELIC, weapon: SHAPES_WEAPON,
};

/** Different large primes per slot so (variant, slot) pairs spread well across the shape list. */
const SLOT_PRIME: Record<SlotName, number> = {
  head: 11, chest: 13, legs: 17, feet: 19, relic: 23, weapon: 29,
};

export function pieceShapeIndex(variant: number, slot: SlotName): number {
  const list = SHAPES[slot];
  if (!list.length) return 0;
  const h = Math.abs(Math.imul(variant | 0, SLOT_PRIME[slot])) + SLOT_PRIME[slot];
  return h % list.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay cache: one 64×64 canvas per (variant | slot | dir | palette).
// ─────────────────────────────────────────────────────────────────────────────
const overlayCache = new Map<string, HTMLCanvasElement>();

function buildOverlay(variant: number, slot: SlotName, dir: Dir, pal: ArmorPalette): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const key = `${variant}|${slot}|${dir}|${pal.color}|${pal.trim}|${pal.glow ?? ""}`;
  const hit = overlayCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = CELL; c.height = CELL;
  const g = c.getContext("2d");
  if (!g) return null;
  g.imageSmoothingEnabled = false;
  const idx = pieceShapeIndex(variant, slot);
  const fn = SHAPES[slot]?.[idx];
  if (!fn) return null;
  fn(g, dir, pal);
  if (overlayCache.size > 400) overlayCache.clear();
  overlayCache.set(key, c);
  return c;
}

/**
 * Draw the procedural armor overlay for one piece onto the actor's current cell.
 * Right-facing mirrors horizontally. The glow (epic+) is a soft shadowBlur rim.
 */
export function drawArmorOverlay(
  ctx: CanvasRenderingContext2D,
  variant: number,
  slot: SlotName,
  dir: Dir,
  pal: ArmorPalette,
  cx: number,
  cy: number,
  cellW: number,
  cellH: number,
): void {
  const srcDir: Dir = dir === "right" ? "left" : dir;
  const overlay = buildOverlay(variant, slot, srcDir, pal);
  if (!overlay) return;
  const mirror = dir === "right";
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (pal.glow) {
    ctx.shadowColor = pal.glow;
    ctx.shadowBlur = Math.max(3, cellW / 10);
  }
  if (mirror) {
    ctx.translate(cx + cellW, cy);
    ctx.scale(-1, 1);
    ctx.drawImage(overlay, 0, 0, CELL, CELL, 0, 0, cellW, cellH);
  } else {
    ctx.drawImage(overlay, 0, 0, CELL, CELL, cx, cy, cellW, cellH);
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// Human-readable shape names, used by the inventory UI (and docs/EDITING.md).
// ─────────────────────────────────────────────────────────────────────────────
const SHAPE_NAMES: Record<SlotName, readonly string[]> = {
  head: ["Circlet", "Three-point crown", "Tall five-point crown", "Horns", "Antlers", "Veil", "Jewelled tiara", "Laurel wreath", "Turban wrap", "Feathered band"],
  chest: ["Plain neck", "V-neck", "Round pauldrons", "Spiked pauldrons", "Winged pauldrons", "High collar + medallion", "Chest sash", "Diamond sigil", "Open coat clasps", "Crossed sashes"],
  legs: ["Thin belt", "Round-buckle belt", "Diamond-buckle belt", "Belt + pouch", "Double-crossed belts", "Tasset plates", "Chain belt", "Broad obi", "Studded belt"],
  feet: ["Ankle boot", "Mid-calf boot", "Knee-high boot", "Thigh-high boot", "Pointed toe", "Fur cuff", "Strap boots", "Armoured greaves", "Ribbon-tied boots"],
  relic: ["Short cape", "Waist cape", "Long cape", "Hooded cowl", "Shoulder pads", "Wing mantle", "Side mantle", "Beaded shawl"],
  weapon: ["Wrist cuff", "Forearm bracer", "Full gauntlet", "Clawed gauntlet", "Bandage wrap", "Ringed knuckles", "Scaled gauntlet", "Fingerless gloves"],
};

export function describeSetSilhouette(set: Pick<SetDef, "id" | "name"> & { style?: number }, variant: number): string[] {
  void set;
  const parts: string[] = [];
  for (const slot of ["head", "chest", "legs", "feet", "relic", "weapon"] as const) {
    const idx = pieceShapeIndex(variant, slot);
    const name = SHAPE_NAMES[slot]?.[idx];
    if (name) parts.push(`${slotLabel(slot)}: ${name}`);
  }
  return parts;
}

function slotLabel(s: SlotName): string {
  return { head: "Head", chest: "Chest", legs: "Legs", feet: "Feet", relic: "Mantle", weapon: "Hands" }[s];
}

/** Look up a set by id — defensive helper for callers that only hold a string. */
export function setById(id: string | null | undefined): SetDef | null {
  if (!id) return null;
  return SET_BY_ID[id] ?? null;
}
