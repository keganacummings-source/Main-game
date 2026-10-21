/**
 * Pure pixel-buffer helpers for the Character Redesigner (no DOM, so they can be unit tested).
 * A buffer is a flat RGBA array: 4 bytes per pixel, row by row.
 */
export type Pix = Uint8ClampedArray;
export type Rgba = readonly [number, number, number, number];

export function newPix(w: number, h: number): Pix {
  return new Uint8ClampedArray(w * h * 4);
}

export function hexToRgba(hex: string): Rgba {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0, 255];
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

export function rgbaToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function setPx(p: Pix, w: number, h: number, x: number, y: number, c: Rgba): void {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const i = (y * w + x) * 4;
  p[i] = c[0]; p[i + 1] = c[1]; p[i + 2] = c[2]; p[i + 3] = c[3];
}

export function getPx(p: Pix, w: number, h: number, x: number, y: number): Rgba | null {
  if (x < 0 || y < 0 || x >= w || y >= h) return null;
  const i = (y * w + x) * 4;
  return [p[i]!, p[i + 1]!, p[i + 2]!, p[i + 3]!];
}

/** Every cell on the straight line between two points, both ends included (Bresenham). */
export function lineCells(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (let guard = 0; guard < 10000; guard++) {
    out.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return out;
}

/** Paint bucket: fills the connected region (4-way) that matches the clicked pixel. Returns true if anything changed. */
export function floodFill(p: Pix, w: number, h: number, x: number, y: number, c: Rgba): boolean {
  const start = getPx(p, w, h, x, y);
  if (!start) return false;
  const same = (i: number) => (start[3] === 0 ? p[i + 3] === 0 : p[i] === start[0] && p[i + 1] === start[1] && p[i + 2] === start[2] && p[i + 3] === start[3]);
  if (start[3] === c[3] && (c[3] === 0 || (start[0] === c[0] && start[1] === c[1] && start[2] === c[2]))) return false;
  const stack: number[] = [y * w + x];
  const seen = new Uint8Array(w * h);
  while (stack.length) {
    const idx = stack.pop()!;
    if (seen[idx]) continue;
    seen[idx] = 1;
    const i = idx * 4;
    if (!same(i)) continue;
    p[i] = c[0]; p[i + 1] = c[1]; p[i + 2] = c[2]; p[i + 3] = c[3];
    const px = idx % w, py = (idx - px) / w;
    if (px > 0) stack.push(idx - 1);
    if (px < w - 1) stack.push(idx + 1);
    if (py > 0) stack.push(idx - w);
    if (py < h - 1) stack.push(idx + w);
  }
  return true;
}

export function flipH(p: Pix, w: number, h: number): Pix {
  const out = newPix(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = (y * w + x) * 4, b = (y * w + (w - 1 - x)) * 4;
    out[b] = p[a]!; out[b + 1] = p[a + 1]!; out[b + 2] = p[a + 2]!; out[b + 3] = p[a + 3]!;
  }
  return out;
}

export function isBlank(p: Pix): boolean {
  for (let i = 3; i < p.length; i += 4) if (p[i] !== 0) return false;
  return true;
}

/**
 * Older versions of the redesigner baked its dark checkerboard background into saved frames.
 * If a frame is mostly those two colours, turn them back into transparent pixels.
 */
export function stripBakedChecker(p: Pix): boolean {
  const A = [0x2a, 0x22, 0x20], B = [0x3a, 0x30, 0x29];
  const isC = (i: number, c: number[]) => p[i + 3] === 255 && p[i] === c[0] && p[i + 1] === c[1] && p[i + 2] === c[2];
  let hits = 0;
  const total = p.length / 4;
  for (let i = 0; i < p.length; i += 4) if (isC(i, A) || isC(i, B)) hits++;
  if (hits < total * 0.5) return false;
  for (let i = 0; i < p.length; i += 4) if (isC(i, A) || isC(i, B)) { p[i] = p[i + 1] = p[i + 2] = p[i + 3] = 0; }
  return true;
}

// ─── Shape, transform and palette helpers used by the Tile Builder (Camp & Tile Asset Builder) ───

export function clonePix(p: Pix): Pix {
  return new Uint8ClampedArray(p);
}

export function pixEqual(a: Pix, b: Pix): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Corners of a box in any order → normalised so x0 <= x1 and y0 <= y1. */
function norm(x0: number, y0: number, x1: number, y1: number): [number, number, number, number] {
  return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
}

/** Cells of a rectangle between two corners: the whole box when `filled`, otherwise just its border. */
export function rectCells(x0: number, y0: number, x1: number, y1: number, filled: boolean): Array<[number, number]> {
  const [ax, ay, bx, by] = norm(x0, y0, x1, y1);
  const out: Array<[number, number]> = [];
  for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) {
    if (filled || x === ax || x === bx || y === ay || y === by) out.push([x, y]);
  }
  return out;
}

/** Cells of the ellipse that fits in the box between two corners (filled, or just the ring). */
export function ellipseCells(x0: number, y0: number, x1: number, y1: number, filled: boolean): Array<[number, number]> {
  const [ax, ay, bx, by] = norm(x0, y0, x1, y1);
  const cx = (ax + bx) / 2, cy = (ay + by) / 2;
  const rx = (bx - ax) / 2 + 0.5, ry = (by - ay) / 2 + 0.5;
  const inside = (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const out: Array<[number, number]> = [];
  for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) {
    if (!inside(x, y)) continue;
    if (filled || !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) out.push([x, y]);
  }
  return out;
}

export function flipV(p: Pix, w: number, h: number): Pix {
  const out = newPix(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = (y * w + x) * 4, b = ((h - 1 - y) * w + x) * 4;
    out[b] = p[a]!; out[b + 1] = p[a + 1]!; out[b + 2] = p[a + 2]!; out[b + 3] = p[a + 3]!;
  }
  return out;
}

/** Rotates a square buffer a quarter turn clockwise (or counter-clockwise). */
export function rotate90(p: Pix, s: number, ccw = false): Pix {
  const out = newPix(s, s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const nx = ccw ? y : s - 1 - y;
    const ny = ccw ? s - 1 - x : x;
    const a = (y * s + x) * 4, b = (ny * s + nx) * 4;
    out[b] = p[a]!; out[b + 1] = p[a + 1]!; out[b + 2] = p[a + 2]!; out[b + 3] = p[a + 3]!;
  }
  return out;
}

/** Slides the art by (dx, dy) pixels; whatever leaves one edge comes back on the other (handy for seamless tiles). */
export function shiftWrap(p: Pix, w: number, h: number, dx: number, dy: number): Pix {
  const out = newPix(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = (((x + dx) % w) + w) % w, ny = (((y + dy) % h) + h) % h;
    const a = (y * w + x) * 4, b = (ny * w + nx) * 4;
    out[b] = p[a]!; out[b + 1] = p[a + 1]!; out[b + 2] = p[a + 2]!; out[b + 3] = p[a + 3]!;
  }
  return out;
}

/** Nearest-neighbour resample, so pixel art stays crisp when the canvas size changes (16 ⇄ 32 ⇄ 64). */
export function resizeNearest(p: Pix, w: number, h: number, nw: number, nh: number): Pix {
  if (w === nw && h === nh) return clonePix(p);
  const out = newPix(nw, nh);
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    const sx = Math.min(w - 1, Math.floor((x * w) / nw)), sy = Math.min(h - 1, Math.floor((y * h) / nh));
    const a = (sy * w + sx) * 4, b = (y * nw + x) * 4;
    out[b] = p[a]!; out[b + 1] = p[a + 1]!; out[b + 2] = p[a + 2]!; out[b + 3] = p[a + 3]!;
  }
  return out;
}

/** The most-used opaque colours in the art (hex), most common first. */
export function paletteOf(p: Pix, max = 16): string[] {
  const counts = new Map<string, number>();
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3]! < 128) continue;
    const k = rgbaToHex(p[i]!, p[i + 1]!, p[i + 2]!);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([k]) => k);
}

/**
 * How well the left edge matches the right edge and the top matches the bottom, 0..1 (1 = seamless).
 * Only opaque pixels count; used to hint whether a floor tile will show seams when it repeats.
 */
export function seamScore(p: Pix, w: number, h: number): number {
  let total = 0, diff = 0;
  const cmp = (a: number, b: number) => {
    const aa = p[a + 3]!, ba = p[b + 3]!;
    total++;
    if ((aa === 0) !== (ba === 0)) { diff += 255; return; }
    if (aa === 0) return;
    diff += (Math.abs(p[a]! - p[b]!) + Math.abs(p[a + 1]! - p[b + 1]!) + Math.abs(p[a + 2]! - p[b + 2]!)) / 3;
  };
  for (let y = 0; y < h; y++) cmp((y * w) * 4, (y * w + (w - 1)) * 4);
  for (let x = 0; x < w; x++) cmp(x * 4, ((h - 1) * w + x) * 4);
  return total ? Math.max(0, 1 - diff / (total * 255)) : 1;
}
