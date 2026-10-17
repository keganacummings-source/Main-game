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
const WALK_CYCLE = [0, 1, 2, 3] as const;

/** walk advances six beats per second; frame 1 is the standing pose. */
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
/** Class sheets are already ~32px wide. 1.5x keeps a body about one tile wide and tall enough to read. */
export const ACTOR_SPRITE_SCALE = 1.5;

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

export type SheetId = "core" | "second" | "third" | "fourth" | "warrior";

const SHEET_SRC: Record<SheetId, string> = {
  core: "/sprites/charsets_12_m-f_complete_by_antifarea.png",
  second: "/sprites/charsets_16x18-2.png",
  third: "/sprites/charsets_12_3rd_sheet.png",
  fourth: "/sprites/charsets_12_4th_sheet.png",
  // ?v= busts the 24h /sprites/* cache (public/_headers) when the sheet changes; bump it on each redraw.
  warrior: "/sprites/class_warriors.png?v=4",
};

/** One character block: origin of its up-row, first frame, and its frame size. */
type CharRect = { sheet: SheetId; x: number; y: number; fw: number; fh: number; chroma: [number, number, number]; frames?: number };

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


// Stripped base (warrior_base.png) with per-class gear baked on top.
// Each block is 4 walk frames x 4 facings (up, right, down, left). Frame 1 is idle.
// No sword-in-hand poses: weapons are sheathed, staves, bows, or shields.
const WARRIOR_MAGENTA: [number, number, number] = [255, 0, 255];
CHARACTERS["warrior:base"] = { sheet: "warrior", x: 0, y: 0, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:warden"] = { sheet: "warrior", x: 128, y: 0, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:spellweaver"] = { sheet: "warrior", x: 256, y: 0, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:spiritbinder"] = { sheet: "warrior", x: 384, y: 0, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:nightblade"] = { sheet: "warrior", x: 512, y: 0, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:pathfinder"] = { sheet: "warrior", x: 640, y: 0, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:ironpalm"] = { sheet: "warrior", x: 0, y: 176, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:bloodrager"] = { sheet: "warrior", x: 128, y: 176, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:ghoulknight"] = { sheet: "warrior", x: 256, y: 176, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:frostblade"] = { sheet: "warrior", x: 384, y: 176, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:pyromancer"] = { sheet: "warrior", x: 512, y: 176, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:tidecaller"] = { sheet: "warrior", x: 640, y: 176, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:stormrider"] = { sheet: "warrior", x: 0, y: 352, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:briarmage"] = { sheet: "warrior", x: 128, y: 352, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:lightbringer"] = { sheet: "warrior", x: 256, y: 352, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:voidwalker"] = { sheet: "warrior", x: 384, y: 352, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:absolver"] = { sheet: "warrior", x: 512, y: 352, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:vigilant"] = { sheet: "warrior", x: 640, y: 352, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:coinmaster"] = { sheet: "warrior", x: 0, y: 528, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:hexbinder"] = { sheet: "warrior", x: 128, y: 528, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:corsair"] = { sheet: "warrior", x: 256, y: 528, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:warlord"] = { sheet: "warrior", x: 384, y: 528, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:nightlord"] = { sheet: "warrior", x: 512, y: 528, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:songweaver"] = { sheet: "warrior", x: 640, y: 528, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:oathkeeper"] = { sheet: "warrior", x: 0, y: 704, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:ronin"] = { sheet: "warrior", x: 128, y: 704, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:seraph"] = { sheet: "warrior", x: 256, y: 704, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:moonhopper"] = { sheet: "warrior", x: 384, y: 704, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:bladedancer"] = { sheet: "warrior", x: 512, y: 704, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:sovereign"] = { sheet: "warrior", x: 640, y: 704, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };
CHARACTERS["warrior:cryinggirl"] = { sheet: "warrior", x: 0, y: 880, fw: 32, fh: 44, frames: 4, chroma: WARRIOR_MAGENTA };

export const spriteKey = (charId: string, row: number, frame: number): string => `${charId}|d${row}f${frame}`;

// Every frame of every character becomes its own atlas rect, so a draw call
// never has to do arithmetic and can never mis-slice a neighbouring frame.
function buildSpec(id: SheetId): AtlasSpec {
  const sprites: Record<string, AtlasKeyEntry> = {};
  for (const [charId, r] of Object.entries(CHARACTERS)) {
    if (r.sheet !== id) continue;
    const frames = r.frames ?? ACTOR_WALK_FRAMES;
    for (let row = 0; row < ACTOR_ROWS; row++) {
      for (let frame = 0; frame < frames; frame++) {
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
  vesper: { m: "warrior:voidwalker", f: "warrior:voidwalker" },
  cinder: { m: "warrior:pyromancer", f: "warrior:pyromancer" },
  tide: { m: "warrior:tidecaller", f: "warrior:tidecaller" },
  thorn: { m: "warrior:briarmage", f: "warrior:briarmage" },
  rime: { m: "warrior:frostblade", f: "warrior:frostblade" },
};

export const NPC_CHAR_BY_ID: Record<string, string> = {
  miret: "warrior:spellweaver", vey: "warrior:corsair", orien: "warrior:warden", holt: "warrior:ironpalm", lise: "warrior:tidecaller", bram: "warrior:warlord",
  ada: "warrior:songweaver", brask: "warrior:bloodrager", wren: "warrior:pathfinder", keel: "warrior:nightblade", pike: "warrior:corsair", nessa: "warrior:absolver",
  moss: "warrior:briarmage", brine: "warrior:tidecaller", sleet: "warrior:frostblade", cinderkin: "warrior:pyromancer",
};

export function charSheet(charId: string): SheetId | null {
  return CHARACTERS[charId]?.sheet ?? null;
}
