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
