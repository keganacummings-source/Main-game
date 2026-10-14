// actor-sheets.config.ts
// Character textures come from the Antifarea 16x18 charset sheets in /public/sprites.
//
// Sheet anatomy, measured from the source PNGs rather than assumed:
//   - every character is a 48x72 block
//   - the block is 3 walk frames wide (16px) and 4 facing rows tall (18px)
//   - blocks start at x = 16, sit edge to edge, six per band
//   - two bands per sheet, y = 180 and y = 306
//       core / second : band 180 male art, band 306 female art
//       third         : band 180 elementals, band 306 npc art
//   - each band has its own flat background color, chroma-keyed per frame
// Antifarea rows run 0 up, 1 right, 2 down, 3 left.

import type { AtlasSpec, AtlasKeyEntry } from "./sprite-atlas";

export const ACTOR_FRAME_W = 16;
export const ACTOR_FRAME_H = 18;
export const ACTOR_WALK_FRAMES = 3;
const WALK_CYCLE = [1, 0, 1, 2] as const;

/** walk advances six beats per second; the center frame is the standing pose. */
export function actorWalkFrame(walk: number, moving = true): number {
  if (!moving) return 1;
  return WALK_CYCLE[Math.floor(Math.abs(walk)) % WALK_CYCLE.length]!;
}
export const ACTOR_ROWS = 4;

const BLOCK_W = ACTOR_FRAME_W * ACTOR_WALK_FRAMES; // 48
const ORIGIN_X = 16;
const BAND_TOP = 180;
const BAND_BOTTOM = 306;

export const ACTOR_BG: [number, number, number] = [239, 208, 116];
export const ACTOR_TOLERANCE = 0;
/** Characters are drawn 2x: a 16px frame becomes exactly one 32px tile wide, so they fit 1x1 hallways. */
export const ACTOR_SPRITE_SCALE = 2;

export const ROW_UP = 0;
export const ROW_RIGHT = 1;
export const ROW_DOWN = 2;
export const ROW_LEFT = 3;

export const ACTOR_DIRECTION_ROWS = { up: ROW_UP, right: ROW_RIGHT, down: ROW_DOWN, left: ROW_LEFT } as const;

export type ActorDirection = keyof typeof ACTOR_DIRECTION_ROWS;

/** Keep the last facing when stopped; use actual movement after collision. */
export function directionFromDelta(dx: number, dy: number, previous: ActorDirection = "down"): ActorDirection {
  if (Math.hypot(dx, dy) < 0.001) return previous;
  return Math.abs(dx) >= Math.abs(dy)
    ? (dx < 0 ? "left" : "right")
    : (dy < 0 ? "up" : "down");
}

export type SheetId = "core" | "second" | "third" | "fourth";

const SHEET_SRC: Record<SheetId, string> = {
  core: "/sprites/charsets_12_m-f_complete_by_antifarea.png",
  second: "/sprites/charsets_16x18-2.png",
  third: "/sprites/charsets_12_3rd_sheet.png",
  fourth: "/sprites/charsets_12_4th_sheet.png",
};

/** One character block: origin of its up-row, first frame, and its frame size. */
type CharRect = { sheet: SheetId; x: number; y: number; fw: number; fh: number; chroma: [number, number, number] };

const BLUE: [number, number, number] = [123, 213, 254];
const PINK: [number, number, number] = [246, 139, 205];
const ROSE: [number, number, number] = [254, 197, 197];

export const CHARACTERS: Record<string, CharRect> = {};
for (const sheet of ["core", "second", "third"] as const) {
  const bands = sheet === "third" ? (["a", "b"] as const) : (["m", "f"] as const);
  for (const band of bands) {
    for (let i = 0; i < 6; i++) {
      CHARACTERS[`${sheet}:${band}${i}`] = {
        sheet, x: ORIGIN_X + i * BLOCK_W, y: band === "a" || band === "m" ? BAND_TOP : BAND_BOTTOM,
        fw: ACTOR_FRAME_W, fh: ACTOR_FRAME_H, chroma: sheet === "third" ? ROSE : band === "m" ? BLUE : PINK,
      };
    }
  }
}
// The 4th sheet is hand-laid; rects measured from the PNG.
const FOURTH: [string, number, number, number, number][] = [
  ["vampire", 144, 126, 16, 18], ["bard", 208, 126, 16, 18], ["paladin", 272, 126, 16, 18],
  ["samurai_m", 13, 252, 16, 18], ["samurai_f", 62, 252, 16, 18], ["child_m", 111, 252, 16, 18], ["child_f", 160, 252, 16, 18],
  ["angel_m", 210, 252, 20, 21], ["angel_f", 271, 252, 20, 21],
  ["bunny", 0, 372, 20, 20], ["dancer", 63, 378, 16, 18], ["king", 113, 378, 16, 18], ["queen", 162, 378, 16, 18],
  ["oldman", 211, 378, 16, 18], ["oldwoman", 260, 378, 16, 18],
];
for (const [id, x, y, fw, fh] of FOURTH) CHARACTERS[`fourth:${id}`] = { sheet: "fourth", x, y, fw, fh, chroma: ROSE };

export const spriteKey = (charId: string, row: number, frame: number): string => `${charId}|d${row}f${frame}`;

// Every frame of every character becomes its own atlas rect, so a draw call
// never has to do arithmetic and can never mis-slice a neighbouring frame.
function buildSpec(id: SheetId): AtlasSpec {
  const sprites: Record<string, AtlasKeyEntry> = {};
  for (const [charId, r] of Object.entries(CHARACTERS)) {
    if (r.sheet !== id) continue;
    for (let row = 0; row < ACTOR_ROWS; row++) {
      for (let frame = 0; frame < ACTOR_WALK_FRAMES; frame++) {
        sprites[spriteKey(charId, row, frame)] = { x: r.x + frame * r.fw, y: r.y + row * r.fh, w: r.fw, h: r.fh, chromaKey: r.chroma };
      }
    }
  }
  return { src: SHEET_SRC[id], chromaKey: ACTOR_BG, tolerance: ACTOR_TOLERANCE, sprites };
}

export const ACTOR_ATLASES: { id: SheetId; spec: AtlasSpec }[] = (
  Object.keys(SHEET_SRC) as SheetId[]
).map((id) => ({ id, spec: buildSpec(id) }));

// The five legacy races each get their own sheet character.
export const RACE_CHARS: Record<string, { m: string; f: string }> = {
  vesper: { m: "core:m0", f: "core:f0" },
  cinder: { m: "core:m1", f: "core:f1" },
  tide: { m: "core:m2", f: "core:f2" },
  thorn: { m: "core:m4", f: "core:f4" },
  rime: { m: "second:m3", f: "second:f3" },
};

export const NPC_CHAR_BY_ID: Record<string, string> = {
  miret: "third:b1", vey: "third:b4", orien: "third:b0", holt: "third:b2", lise: "third:b3", bram: "third:b4",
  ada: "third:b1", brask: "third:b4", wren: "third:b5", keel: "third:b0", pike: "third:b3", nessa: "third:b2",
  moss: "third:b1", brine: "third:b0", sleet: "third:b4", cinderkin: "third:b3",
};

export function charSheet(charId: string): SheetId | null {
  return CHARACTERS[charId]?.sheet ?? null;
}
