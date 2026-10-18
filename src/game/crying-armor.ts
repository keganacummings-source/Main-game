/*
 * crying-armor.ts — procedural per-set armor silhouettes.
 *
 * The Lidia paper-doll (`crying-lady.ts`) uses tinted greyscale clothing sheets, so every set
 * looked like a recolour of the same outfit. This module adds a second pass on top: pixel-art
 * detail (crown shapes, pauldrons, belt buckles, boot cuffs, mantles, bracers) that is UNIQUE
 * per set. All 177 sets × 6 slots → ~1,000 visually distinct piece silhouettes without new PNGs.
 *
 * Each slot has a kit of ~8 "shape" variants. From a set's deterministic `variant` number we
 * derive one shape per slot, plus a palette (color + accent + optional glow). The resulting
 * overlay is cached per (variant, slot, facing) so blitting is one `drawImage`.
 *
 * ───── Coordinate system ─────
 * Every shape is drawn into a 64×64 canvas matching one Lidia cell. The body sits roughly:
 *   head  y 10-22   chest  y 22-36   waist  y 36-44
 *   legs  y 44-58   feet   y 58-62   center x = 32
 * Facings: "down" (front), "left" and "right" (side profiles), "up" (back; many front
 * features are hidden, capes read as fuller). "right" draws the mirror of "left".
 *
 * ───── How to ADD a new armor silhouette ─────
 *   1. Add a drawer function below the slot's "shape kit" list (e.g. `drawHairband_horns`).
 *   2. Append it to that slot's `SHAPES.<slot>` array.
 *   3. That's it — the next time a set hashes to that index it will use the new shape.
 * A shape is just arithmetic + fillRect calls into a 64×64 canvas; keep it readable, nothing
 * clever. The palette is passed in — only use `pal.color`, `pal.trim`, `pal.glow`.
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

/** One drawer takes a 2D context already clipped/translated so (0,0) is the cell corner. */
type ShapeFn = (g: CanvasRenderingContext2D, dir: Dir, pal: ArmorPalette) => void;

const CELL = 64;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: tiny pixel-art primitives at 64×64 cell resolution.
// ─────────────────────────────────────────────────────────────────────────────
const px = (g: CanvasRenderingContext2D, x: number, y: number, w = 1, h = 1): void => {
  g.fillRect(Math.round(x), Math.round(y), Math.max(1, w), Math.max(1, h));
};
const line = (g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number): void => {
  // Bresenham-ish — fine for short runs; we only draw a few per piece per frame.
  const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  let x = x1, y = y1;
  for (let i = 0; i < 32; i++) {
    px(g, x, y);
    if (x === x2 && y === y2) return;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
};
const diamond = (g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void => {
  for (let dy = -r; dy <= r; dy++) {
    const w = r - Math.abs(dy);
    px(g, cx - w, cy + dy, w * 2 + 1, 1);
  }
};
const circle = (g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void => {
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    px(g, cx - w, cy + dy, w * 2 + 1, 1);
  }
};
const star = (g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void => {
  px(g, cx, cy - r, 1, r * 2 + 1);
  px(g, cx - r, cy, r * 2 + 1, 1);
  px(g, cx - r + 1, cy - r + 1); px(g, cx + r - 1, cy - r + 1);
  px(g, cx - r + 1, cy + r - 1); px(g, cx + r - 1, cy + r - 1);
};
/** Front-facing feature? Hide if dir === "up" (back). */
const isFront = (dir: Dir): boolean => dir !== "up";
/** Pure side profile (left/right)? */
const isSide = (dir: Dir): boolean => dir === "left" || dir === "right";

// ─────────────────────────────────────────────────────────────────────────────
// HEAD (hairband layer) — crowns, horns, veils, tiaras.
// ─────────────────────────────────────────────────────────────────────────────
const SHAPES_HEAD: ShapeFn[] = [
  // 0: thin circlet
  (g, _d, p) => { g.fillStyle = p.color; px(g, 24, 15, 16, 1); g.fillStyle = p.trim; px(g, 31, 15); },
  // 1: three-point crown
  (g, dir, p) => {
    g.fillStyle = p.color;
    px(g, 24, 14, 16, 2);
    if (isFront(dir)) { px(g, 26, 11, 2, 3); px(g, 31, 10, 2, 4); px(g, 36, 11, 2, 3); }
    g.fillStyle = p.trim;
    if (isFront(dir)) { px(g, 31, 11); px(g, 32, 11); }
  },
  // 2: tall five-point crown
  (g, dir, p) => {
    g.fillStyle = p.color;
    px(g, 23, 14, 18, 2);
    if (isFront(dir)) { px(g, 24, 10, 2, 4); px(g, 28, 8, 2, 6); px(g, 31, 7, 2, 7); px(g, 35, 8, 2, 6); px(g, 39, 10, 2, 4); }
    g.fillStyle = p.trim;
    if (isFront(dir)) px(g, 31, 11, 2, 2);
  },
  // 3: curved horns
  (g, _d, p) => {
    g.fillStyle = p.color;
    px(g, 24, 13, 2, 2); px(g, 23, 11, 2, 2); px(g, 22, 9, 2, 2);
    px(g, 38, 13, 2, 2); px(g, 39, 11, 2, 2); px(g, 40, 9, 2, 2);
    g.fillStyle = p.trim; px(g, 22, 8); px(g, 40, 8);
  },
  // 4: antlers (branching)
  (g, _d, p) => {
    g.fillStyle = p.color;
    for (let i = 0; i < 6; i++) { px(g, 23 - Math.floor(i / 2), 14 - i); px(g, 40 + Math.floor(i / 2), 14 - i); }
    px(g, 21, 10); px(g, 20, 9); px(g, 42, 10); px(g, 43, 9);
    px(g, 20, 8); px(g, 43, 8);
  },
  // 5: veil (hangs to shoulders)
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, 24, 14, 16, 2);
    if (isFront(dir)) { for (let y = 16; y < 25; y++) px(g, 23 + ((y) & 1), y, 18 - ((y) & 1), 1); }
    g.fillStyle = p.trim; if (isFront(dir)) px(g, 31, 15, 2, 1);
  },
  // 6: tiara with centre jewel
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, 25, 14, 14, 2); px(g, 28, 13, 8, 1);
    g.fillStyle = p.trim; if (isFront(dir)) diamond(g, 31, 13, 2);
  },
  // 7: laurel wreath
  (g, _d, p) => {
    g.fillStyle = p.color;
    px(g, 24, 14, 2, 1); px(g, 22, 13, 2, 1); px(g, 23, 11, 2, 1); px(g, 25, 10, 2, 1);
    px(g, 38, 14, 2, 1); px(g, 40, 13, 2, 1); px(g, 39, 11, 2, 1); px(g, 37, 10, 2, 1);
    px(g, 28, 10, 2, 1); px(g, 34, 10, 2, 1);
  },
  // 8: wrap/turban (full-band)
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, 22, 11, 20, 5);
    g.fillStyle = p.trim; if (isFront(dir)) { px(g, 22, 13, 20, 1); diamond(g, 31, 13, 1); }
  },
  // 9: feathered band
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, 24, 14, 16, 2);
    if (isFront(dir)) { px(g, 25, 11, 1, 3); px(g, 28, 10, 1, 4); px(g, 31, 9, 1, 5); px(g, 34, 10, 1, 4); px(g, 37, 11, 1, 3); }
    g.fillStyle = p.trim; if (isFront(dir)) px(g, 31, 10);
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CHEST (suit layer) — necklines, pauldrons, sigils.
// ─────────────────────────────────────────────────────────────────────────────
const SHAPES_CHEST: ShapeFn[] = [
  // 0: plain round neck
  (g, dir, p) => { if (isFront(dir)) { g.fillStyle = p.trim; px(g, 29, 24, 6, 1); } },
  // 1: V-neck
  (g, dir, p) => { if (isFront(dir)) { g.fillStyle = p.trim; px(g, 29, 24); px(g, 31, 25); px(g, 32, 26); px(g, 33, 25); px(g, 34, 24); } },
  // 2: round pauldrons
  (g, _d, p) => { g.fillStyle = p.color; circle(g, 23, 26, 3); circle(g, 41, 26, 3); g.fillStyle = p.trim; px(g, 23, 25); px(g, 41, 25); },
  // 3: spiked pauldrons
  (g, _d, p) => {
    g.fillStyle = p.color;
    px(g, 21, 24, 4, 3); px(g, 39, 24, 4, 3);
    px(g, 20, 23); px(g, 22, 22); px(g, 24, 23);
    px(g, 42, 23); px(g, 40, 22); px(g, 38, 23);
  },
  // 4: winged pauldrons
  (g, _d, p) => {
    g.fillStyle = p.color;
    px(g, 20, 25, 5, 2); px(g, 39, 25, 5, 2);
    px(g, 18, 26, 2, 1); px(g, 44, 26, 2, 1);
    g.fillStyle = p.trim; px(g, 20, 24); px(g, 43, 24);
  },
  // 5: high collar + chest medallion
  (g, dir, p) => {
    g.fillStyle = p.color;
    px(g, 29, 23, 6, 2);
    if (isFront(dir)) { g.fillStyle = p.trim; circle(g, 32, 30, 2); px(g, 32, 32, 1, 2); }
  },
  // 6: sash across chest
  (g, dir, p) => {
    if (!isFront(dir)) return;
    g.fillStyle = p.trim;
    for (let i = 0; i < 10; i++) px(g, 26 + i, 25 + Math.floor(i / 2), 1, 2);
  },
  // 7: chest sigil (diamond)
  (g, dir, p) => { if (isFront(dir)) { g.fillStyle = p.trim; diamond(g, 32, 30, 3); g.fillStyle = p.color; px(g, 32, 30); } },
  // 8: open coat with clasps
  (g, dir, p) => {
    if (!isFront(dir)) return;
    g.fillStyle = p.trim;
    for (let y = 25; y < 36; y += 3) { px(g, 29, y, 2, 1); px(g, 33, y, 2, 1); }
  },
  // 9: shoulder sashes (both sides, X)
  (g, dir, p) => {
    if (!isFront(dir)) return;
    g.fillStyle = p.trim;
    for (let i = 0; i < 10; i++) { px(g, 26 + i, 25 + Math.floor(i / 2), 1, 1); px(g, 38 - i, 25 + Math.floor(i / 2), 1, 1); }
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// LEGS (belt layer) — belts, buckles, sashes, tassets.
// ─────────────────────────────────────────────────────────────────────────────
const SHAPES_LEGS: ShapeFn[] = [
  // 0: thin belt
  (g, _d, p) => { g.fillStyle = p.color; px(g, 26, 40, 12, 1); g.fillStyle = p.trim; px(g, 31, 40, 2, 1); },
  // 1: wide belt + round buckle
  (g, dir, p) => { g.fillStyle = p.color; px(g, 25, 39, 14, 3); if (isFront(dir)) { g.fillStyle = p.trim; circle(g, 32, 40, 2); } },
  // 2: wide belt + diamond buckle
  (g, dir, p) => { g.fillStyle = p.color; px(g, 25, 39, 14, 3); if (isFront(dir)) { g.fillStyle = p.trim; diamond(g, 32, 40, 2); } },
  // 3: belt + side pouch
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, 25, 40, 14, 2);
    if (!isSide(dir)) px(g, 39, 41, 3, 4);
    else px(g, 38, 41, 3, 4);
  },
  // 4: double crossed belts
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, 25, 39, 14, 2); px(g, 25, 42, 14, 2);
    if (isFront(dir)) { g.fillStyle = p.trim; px(g, 32, 39, 1, 5); }
  },
  // 5: tasset plates (hanging squares)
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, 25, 40, 14, 2);
    if (!isSide(dir)) {
      px(g, 26, 43, 3, 4); px(g, 31, 43, 3, 4); px(g, 36, 43, 3, 4);
      g.fillStyle = p.trim; px(g, 27, 45); px(g, 32, 45); px(g, 37, 45);
    }
  },
  // 6: belt + hanging chain
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, 26, 40, 12, 2);
    if (isFront(dir)) { g.fillStyle = p.trim; for (let y = 42; y < 50; y += 2) px(g, 36 + ((y >> 1) & 1), y); }
  },
  // 7: broad obi/sash
  (g, _d, p) => { g.fillStyle = p.color; px(g, 24, 38, 16, 5); g.fillStyle = p.trim; px(g, 24, 42, 16, 1); },
  // 8: studded belt
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, 25, 40, 14, 2);
    if (!isSide(dir)) { g.fillStyle = p.trim; for (let x = 26; x < 39; x += 2) px(g, x, 41); }
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FEET (boot layer) — boot heights, toecaps, cuffs.
// ─────────────────────────────────────────────────────────────────────────────
const SHAPES_FEET: ShapeFn[] = [
  // 0: ankle boot — a cuff
  (g, _d, p) => { g.fillStyle = p.color; px(g, 27, 56, 10, 2); g.fillStyle = p.trim; px(g, 27, 55, 10, 1); },
  // 1: mid-calf boot
  (g, _d, p) => { g.fillStyle = p.color; px(g, 27, 50, 10, 8); g.fillStyle = p.trim; px(g, 27, 50, 10, 1); },
  // 2: knee-high
  (g, _d, p) => { g.fillStyle = p.color; px(g, 27, 44, 10, 14); g.fillStyle = p.trim; px(g, 27, 44, 10, 1); px(g, 27, 50, 10, 1); },
  // 3: thigh-high
  (g, _d, p) => { g.fillStyle = p.color; px(g, 27, 38, 10, 20); g.fillStyle = p.trim; px(g, 27, 38, 10, 1); },
  // 4: pointed toe (longer forward on side views)
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, 27, 54, 10, 4);
    if (isSide(dir)) { px(g, dir === "right" ? 37 : 25, 57, 2, 1); }
  },
  // 5: fur cuff
  (g, _d, p) => {
    g.fillStyle = p.color; px(g, 27, 52, 10, 6);
    g.fillStyle = p.trim; for (let x = 26; x < 38; x += 2) { px(g, x, 51); px(g, x + 1, 52); }
  },
  // 6: strap boots (wrapped)
  (g, _d, p) => {
    g.fillStyle = p.color; px(g, 27, 50, 10, 8);
    g.fillStyle = p.trim; px(g, 27, 52, 10, 1); px(g, 27, 55, 10, 1);
  },
  // 7: armoured greaves (plated)
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, 27, 46, 10, 12);
    if (isFront(dir)) { g.fillStyle = p.trim; px(g, 31, 48, 2, 10); }
  },
  // 8: ribbon-tied boots
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, 27, 50, 10, 8);
    if (isFront(dir)) { g.fillStyle = p.trim; for (let y = 51; y < 57; y += 2) px(g, 31, y, 2, 1); }
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// RELIC (shawl layer) — capes, mantles, cowls.
// ─────────────────────────────────────────────────────────────────────────────
const SHAPES_RELIC: ShapeFn[] = [
  // 0: short cape (over shoulders)
  (g, dir, p) => {
    g.fillStyle = p.color;
    if (dir === "up") px(g, 23, 24, 18, 12);
    else { px(g, 22, 24, 4, 10); px(g, 38, 24, 4, 10); }
    g.fillStyle = p.trim; if (dir === "up") px(g, 23, 24, 18, 1);
  },
  // 1: full cape to waist
  (g, dir, p) => {
    g.fillStyle = p.color;
    if (dir === "up") px(g, 22, 24, 20, 18);
    else { px(g, 20, 24, 4, 16); px(g, 40, 24, 4, 16); }
    g.fillStyle = p.trim; if (dir === "up") px(g, 22, 24, 20, 2);
  },
  // 2: long cape to feet
  (g, dir, p) => {
    g.fillStyle = p.color;
    if (dir === "up") { px(g, 22, 24, 20, 32); for (let y = 56; y < 60; y++) px(g, 23, y, 18, 1); }
    else { px(g, 20, 24, 3, 32); px(g, 41, 24, 3, 32); }
    g.fillStyle = p.trim; if (dir === "up") { px(g, 22, 24, 20, 2); px(g, 32, 24, 1, 32); }
  },
  // 3: hooded cowl
  (g, dir, p) => {
    g.fillStyle = p.color;
    px(g, 24, 10, 16, 10);
    if (dir === "up") px(g, 23, 20, 18, 14);
    g.fillStyle = p.trim; px(g, 24, 10, 16, 1);
  },
  // 4: shoulder pads only
  (g, _d, p) => { g.fillStyle = p.color; px(g, 22, 23, 5, 4); px(g, 37, 23, 5, 4); g.fillStyle = p.trim; px(g, 22, 23, 5, 1); px(g, 37, 23, 5, 1); },
  // 5: wing-form shoulders
  (g, _d, p) => {
    g.fillStyle = p.color;
    for (let i = 0; i < 6; i++) { px(g, 22 - i, 24 + Math.floor(i / 2), 1, 2); px(g, 41 + i, 24 + Math.floor(i / 2), 1, 2); }
    g.fillStyle = p.trim; px(g, 16, 27); px(g, 47, 27);
  },
  // 6: single-side mantle (left shoulder cloak)
  (g, dir, p) => {
    g.fillStyle = p.color;
    if (dir === "right") px(g, 38, 24, 5, 16);
    else px(g, 21, 24, 5, 16);
    g.fillStyle = p.trim;
    if (dir === "right") px(g, 38, 24, 5, 1); else px(g, 21, 24, 5, 1);
  },
  // 7: beaded shawl
  (g, dir, p) => {
    g.fillStyle = p.color;
    if (!isSide(dir)) { px(g, 23, 24, 18, 2); px(g, 23, 26, 18, 1); }
    g.fillStyle = p.trim;
    if (!isSide(dir)) for (let x = 24; x < 40; x += 2) px(g, x, 27);
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// WEAPON (glove layer) — bracers, gauntlets, claws, wraps.
// ─────────────────────────────────────────────────────────────────────────────
const SHAPES_WEAPON: ShapeFn[] = [
  // 0: wrist cuff
  (g, _d, p) => { g.fillStyle = p.color; px(g, 20, 36, 3, 2); px(g, 41, 36, 3, 2); g.fillStyle = p.trim; px(g, 20, 36, 3, 1); px(g, 41, 36, 3, 1); },
  // 1: forearm bracer
  (g, _d, p) => { g.fillStyle = p.color; px(g, 20, 32, 3, 7); px(g, 41, 32, 3, 7); g.fillStyle = p.trim; px(g, 20, 32, 3, 1); px(g, 41, 32, 3, 1); },
  // 2: full gauntlet (hand plate)
  (g, _d, p) => {
    g.fillStyle = p.color; px(g, 20, 32, 3, 9); px(g, 41, 32, 3, 9);
    g.fillStyle = p.trim; px(g, 20, 40, 3, 1); px(g, 41, 40, 3, 1); px(g, 21, 32); px(g, 42, 32);
  },
  // 3: claws (3 tips off the back of the hand)
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, 20, 36, 3, 3); px(g, 41, 36, 3, 3);
    if (isFront(dir)) {
      g.fillStyle = p.trim;
      for (let i = 0; i < 3; i++) { px(g, 18 - i, 37 + i); px(g, 45 + i, 37 + i); }
    }
  },
  // 4: wrapped bandage
  (g, _d, p) => {
    g.fillStyle = p.color;
    for (let y = 33; y < 39; y += 2) { px(g, 20, y, 3, 1); px(g, 41, y, 3, 1); }
    g.fillStyle = p.trim; for (let y = 34; y < 39; y += 2) { px(g, 20, y, 3, 1); px(g, 41, y, 3, 1); }
  },
  // 5: ringed knuckles
  (g, dir, p) => {
    g.fillStyle = p.color; px(g, 20, 36, 3, 2); px(g, 41, 36, 3, 2);
    if (isFront(dir)) { g.fillStyle = p.trim; for (let i = 0; i < 3; i++) { px(g, 19 - i, 38); px(g, 45 + i, 38); } }
  },
  // 6: scaled gauntlet
  (g, _d, p) => {
    g.fillStyle = p.color; px(g, 20, 34, 3, 6); px(g, 41, 34, 3, 6);
    g.fillStyle = p.trim;
    for (let y = 34; y < 40; y++) if ((y & 1) === 0) { px(g, 21, y); px(g, 42, y); }
  },
  // 7: fingerless gloves with cuff
  (g, _d, p) => {
    g.fillStyle = p.color; px(g, 20, 34, 3, 5); px(g, 41, 34, 3, 5);
    g.fillStyle = p.trim; px(g, 20, 34, 3, 1); px(g, 41, 34, 3, 1); px(g, 20, 38, 3, 1); px(g, 41, 38, 3, 1);
  },
];

const SHAPES: Record<SlotName, ShapeFn[]> = {
  head: SHAPES_HEAD,
  chest: SHAPES_CHEST,
  legs: SHAPES_LEGS,
  feet: SHAPES_FEET,
  relic: SHAPES_RELIC,
  weapon: SHAPES_WEAPON,
};

/** Different large primes per slot so (variant, slot) pairs spread well across the shape list. */
const SLOT_PRIME: Record<SlotName, number> = {
  head: 11, chest: 13, legs: 17, feet: 19, relic: 23, weapon: 29,
};

/** The feature index chosen for one slot of one set. Deterministic in `variant`. */
export function pieceShapeIndex(variant: number, slot: SlotName): number {
  const list = SHAPES[slot];
  if (!list.length) return 0;
  const h = Math.abs(Math.imul(variant | 0, SLOT_PRIME[slot])) + SLOT_PRIME[slot];
  return h % list.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay cache: one 64×64 canvas per (variant | slot | dir).
// ─────────────────────────────────────────────────────────────────────────────
const overlayCache = new Map<string, HTMLCanvasElement>();

function buildOverlay(variant: number, slot: SlotName, dir: Dir, pal: ArmorPalette): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const key = `${variant}|${slot}|${dir}|${pal.color}|${pal.trim}|${pal.glow ?? ""}`;
  const hit = overlayCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = CELL;
  c.height = CELL;
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
 * Draw the procedural armor overlay for one piece onto an actor's current frame.
 *
 * - `cx, cy, cellW, cellH` describe where the Lidia cell is being drawn on the main canvas.
 * - `dir` is the facing. The function mirrors horizontally for "right".
 * - If the piece has a glow (epic+), a soft shadowBlur rim is drawn around the overlay.
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
  const srcDir: Dir = dir === "right" ? "left" : dir; // right = mirror of left
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

/**
 * Human-readable summary of the shape indices this set uses, for the inventory UI
 * ("Horned crown · Spiked pauldrons · Diamond-buckle belt · …").
 */
const SHAPE_NAMES: Record<SlotName, readonly string[]> = {
  head: ["Circlet", "Three-point crown", "Tall five-point crown", "Horns", "Antlers", "Veil", "Jewelled tiara", "Laurel wreath", "Turban wrap", "Feathered band"],
  chest: ["Plain neck", "V-neck", "Round pauldrons", "Spiked pauldrons", "Winged pauldrons", "High collar + medallion", "Chest sash", "Diamond sigil", "Open coat clasps", "Crossed sashes"],
  legs: ["Thin belt", "Round-buckle belt", "Diamond-buckle belt", "Belt + pouch", "Double-crossed belts", "Tasset plates", "Chain belt", "Broad obi", "Studded belt"],
  feet: ["Ankle boot", "Mid-calf boot", "Knee-high boot", "Thigh-high boot", "Pointed toe", "Fur cuff", "Strap boots", "Armoured greaves", "Ribbon-tied boots"],
  relic: ["Short cape", "Waist cape", "Long cape", "Hooded cowl", "Shoulder pads", "Wing mantle", "Side mantle", "Beaded shawl"],
  weapon: ["Wrist cuff", "Forearm bracer", "Full gauntlet", "Clawed gauntlet", "Bandage wrap", "Ringed knuckles", "Scaled gauntlet", "Fingerless gloves"],
};

/** Short textual description of a set's silhouette, by slot. */
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
