/**
 * What the hunter has actually seen of the world.
 *
 * The chart menu only draws ground you have been near, so the world reveals
 * itself as you walk it rather than arriving as a finished atlas. That needs a
 * record of where you have been, and that record has to live in a save.
 *
 * Per-tile would be 6,250,000 bits — 780 KB raw, over a megabyte once it is
 * base64 for storage, every time the game saves. So it is kept per CELL: an
 * 8 x 8 block of chart tiles is either seen or not. A 2500 x 2500 world becomes
 * 313 x 313 cells, 97,969 bits, a hair under 12 KB — and about 16 KB as text.
 *
 * Eight tiles is invisible at chart scale. The whole world draws into a few
 * hundred pixels, so one cell is well under a pixel; nobody can tell that the
 * fog lifts in blocks rather than circles.
 */

/** Chart tiles per fog cell, on each axis. */
export const FOG_CELL = 8;

export type Explored = {
  /** Cells across and down. */
  cw: number;
  ch: number;
  /** One bit per cell, row-major. */
  bits: Uint8Array;
};

const cellsAcross = (tiles: number) => Math.ceil(tiles / FOG_CELL);

export function freshExplored(chartW: number, chartH: number): Explored {
  const cw = cellsAcross(chartW);
  const ch = cellsAcross(chartH);
  return { cw, ch, bits: new Uint8Array(Math.ceil((cw * ch) / 8)) };
}

/** Has this chart tile been seen? */
export function seenAt(ex: Explored, tx: number, ty: number): boolean {
  const cx = Math.floor(tx / FOG_CELL);
  const cy = Math.floor(ty / FOG_CELL);
  if (cx < 0 || cy < 0 || cx >= ex.cw || cy >= ex.ch) return false;
  const bit = cy * ex.cw + cx;
  return (ex.bits[bit >> 3]! & (1 << (bit & 7))) !== 0;
}

/** Has this CELL been seen? Used by the chart drawing, which works in cells. */
export function seenCell(ex: Explored, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= ex.cw || cy >= ex.ch) return false;
  const bit = cy * ex.cw + cx;
  return (ex.bits[bit >> 3]! & (1 << (bit & 7))) !== 0;
}

function mark(ex: Explored, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= ex.cw || cy >= ex.ch) return false;
  const bit = cy * ex.cw + cx;
  const byte = bit >> 3;
  const m = 1 << (bit & 7);
  if (ex.bits[byte]! & m) return false;
  ex.bits[byte]! |= m;
  return true;
}

/**
 * Reveal everything within `radius` chart tiles of where the hunter is standing.
 *
 * Returns how many new cells were uncovered, so a caller can tell "you found
 * something" from "you walked back across your own tracks" without rescanning.
 */
export function reveal(ex: Explored, tx: number, ty: number, radius: number): number {
  const r = Math.max(0, radius);
  const c0x = Math.floor((tx - r) / FOG_CELL);
  const c1x = Math.floor((tx + r) / FOG_CELL);
  const c0y = Math.floor((ty - r) / FOG_CELL);
  const c1y = Math.floor((ty + r) / FOG_CELL);
  const rr = r * r;
  let fresh = 0;
  for (let cy = c0y; cy <= c1y; cy++) {
    for (let cx = c0x; cx <= c1x; cx++) {
      // Measure to the middle of the cell: a cell is seen once you can see most of it.
      const mx = cx * FOG_CELL + FOG_CELL / 2;
      const my = cy * FOG_CELL + FOG_CELL / 2;
      const dx = mx - tx, dy = my - ty;
      if (dx * dx + dy * dy > rr) continue;
      if (mark(ex, cx, cy)) fresh++;
    }
  }
  return fresh;
}

/** How much of the world has been uncovered, 0-1. */
export function exploredShare(ex: Explored): number {
  let on = 0;
  for (let i = 0; i < ex.bits.length; i++) {
    let b = ex.bits[i]!;
    while (b) { on += b & 1; b >>= 1; }
  }
  return on / Math.max(1, ex.cw * ex.ch);
}

/** How many cells are uncovered. */
export function exploredCells(ex: Explored): number {
  return Math.round(exploredShare(ex) * ex.cw * ex.ch);
}

// ---------------------------------------------------------------------------
// Save and load
// ---------------------------------------------------------------------------

/*
 * Base64, written out rather than borrowed.
 *
 * This file is browser code, so it cannot reach for Node's Buffer — referring to
 * it does not even typecheck against the DOM library. It also runs in tests
 * under Node, where `btoa` exists but is easy to misuse: it takes a string, and
 * spreading a 12 KB array into String.fromCharCode overflows the call stack.
 *
 * Sixty lines of plain base64 work everywhere and have no such edges.
 */
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = (() => {
  const t = new Int16Array(256).fill(-1);
  for (let i = 0; i < CHARS.length; i++) t[CHARS.charCodeAt(i)] = i;
  return t;
})();

function toBase64(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out += CHARS[(n >>> 18) & 63]! + CHARS[(n >>> 12) & 63]! + CHARS[(n >>> 6) & 63]! + CHARS[n & 63]!;
  }
  const left = bytes.length - i;
  if (left === 1) {
    const n = bytes[i]! << 16;
    out += CHARS[(n >>> 18) & 63]! + CHARS[(n >>> 12) & 63]! + "==";
  } else if (left === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out += CHARS[(n >>> 18) & 63]! + CHARS[(n >>> 12) & 63]! + CHARS[(n >>> 6) & 63]! + "=";
  }
  return out;
}

/** Throws on anything that is not valid base64, so the caller can fall back. */
function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/[\n\r\t ]/g, "");
  const body = clean.replace(/=+$/, "");
  for (let i = 0; i < body.length; i++) if (LOOKUP[body.charCodeAt(i)]! < 0) throw new Error("not base64");
  if (body.length % 4 === 1) throw new Error("truncated base64");
  const out = new Uint8Array(Math.floor((body.length * 3) / 4));
  let o = 0, buf = 0, bits = 0;
  for (let i = 0; i < body.length; i++) {
    buf = (buf << 6) | LOOKUP[body.charCodeAt(i)]!;
    bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (buf >>> bits) & 255; }
  }
  return out.subarray(0, o);
}

export type ExploredSave = { cw: number; ch: number; bits: string };

export function packExplored(ex: Explored): ExploredSave {
  return { cw: ex.cw, ch: ex.ch, bits: toBase64(ex.bits) };
}

/**
 * Read a saved fog back.
 *
 * Anything that does not fit the world it is being loaded into — a save from a
 * chart of a different size, truncated text, junk — gives a blank fog rather
 * than throwing or, worse, a bit pattern offset by one that would draw as
 * nonsense.
 */
export function unpackExplored(raw: unknown, chartW: number, chartH: number): Explored {
  const fresh = freshExplored(chartW, chartH);
  const s = raw as Partial<ExploredSave> | null | undefined;
  if (!s || typeof s.bits !== "string") return fresh;
  if (s.cw !== fresh.cw || s.ch !== fresh.ch) return fresh;
  try {
    const bytes = fromBase64(s.bits);
    if (bytes.length !== fresh.bits.length) return fresh;
    fresh.bits.set(bytes);
  } catch {
    return fresh;                     // not valid base64
  }
  return fresh;
}
