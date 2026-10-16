// sprite-atlas.ts
// ---------------------------------------------------------------------------
// Sprite-atlas loader + slicer for the TURBZ3 character/equipment sheet.
//
// The attached sheet ships as a flat PNG with a solid black background and no
// alpha channel, an inconsistent grid, and tight, bleeding neighbours. These
// three problems are fixed here so the rest of the game can treat sprites as
// clean, transparent, individually-addressable images:
//
//   1. Chroma-key transparency  — pixels within `tolerance` of `chromaKey`
//      (default pure black #000000) are made transparent once, at load time,
//      and the result is cached. This replaces the missing alpha channel.
//
//   2. Bleed-proof slicing      — every source rect is snapped to integers,
//      image smoothing is disabled, and an optional `inset` margin trims each
//      slice so adjacent sprites can never leak into one another.
//
//   3. Auto-tighten             — because the grid alignment drifts, each grid
//      cell is scanned for its non-background bounding box and shrunk to fit
//      the actual art, so a misaligned cell can't crop a sprite.
//
// This module has no TURBZ3 coupling; it only depends on the DOM canvas API.
// ---------------------------------------------------------------------------

export type AtlasRect = { x: number; y: number; w: number; h: number };

export type AtlasGrid = {
  cellW: number;
  cellH: number;
  cols: number;
  rows: number;
  originX?: number;
  originY?: number;
  gapX?: number;
  gapY?: number;
  inset?: number; // px trimmed off every slice edge to stop bleeding
  tighten?: boolean; // shrink each cell to the non-background bbox
};

// A sprite is either a grid cell (col,row) resolved against `AtlasSpec.grid`,
// or an explicit pixel rect. `frames` > 1 treats the cell as a horizontal
// strip of animation frames (used for walk cycles).
export type AtlasKeyEntry =
  | ({ col: number; row: number } & { frames?: number; chromaKey?: [number, number, number] })
  | (AtlasRect & { frames?: number; chromaKey?: [number, number, number] });

export type AtlasSpec = {
  src: string;
  grid?: AtlasGrid;
  chromaKey?: [number, number, number]; // default [0,0,0] (pure black)
  tolerance?: number; // default 16
  sprites: Record<string, AtlasKeyEntry>;
};

export type Atlas = {
  image: HTMLImageElement;
  rects: Record<string, AtlasRect>;
  frames: Record<string, number>;
  chromaKey: [number, number, number];
  chromaKeys: Record<string, [number, number, number]>;
  tolerance: number;
  cache: Map<string, HTMLCanvasElement>;
};

const snap = (n: number): number => Math.round(n);

function cellRect(grid: AtlasGrid, col: number, row: number): AtlasRect {
  const gapX = grid.gapX ?? 0;
  const gapY = grid.gapY ?? 0;
  const x = (grid.originX ?? 0) + col * (grid.cellW + gapX);
  const y = (grid.originY ?? 0) + row * (grid.cellH + gapY);
  return { x: snap(x), y: snap(y), w: snap(grid.cellW), h: snap(grid.cellH) };
}

// Scan a rect for the bounding box of pixels that are NOT the chroma key.
function tightenRect(
  image: HTMLImageElement,
  rect: AtlasRect,
  key: [number, number, number],
  tol: number,
): AtlasRect {
  const c = document.createElement("canvas");
  c.width = rect.w;
  c.height = rect.h;
  const cx = c.getContext("2d", { willReadFrequently: true });
  if (!cx) return rect;
  cx.imageSmoothingEnabled = false;
  cx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  const { data } = cx.getImageData(0, 0, rect.w, rect.h);
  let minX = rect.w,
    minY = rect.h,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < rect.h; y++) {
    for (let x = 0; x < rect.w; x++) {
      const i = (y * rect.w + x) * 4;
      if (
        Math.abs(data[i] - key[0]) <= tol &&
        Math.abs(data[i + 1] - key[1]) <= tol &&
        Math.abs(data[i + 2] - key[2]) <= tol
      )
        continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { ...rect, w: 0, h: 0 }; // empty cell
  return {
    x: snap(rect.x + minX),
    y: snap(rect.y + minY),
    w: snap(maxX - minX + 1),
    h: snap(maxY - minY + 1),
  };
}

// Bake one slice into a transparent-background canvas (chroma key applied).
function bakeSlice(
  image: HTMLImageElement,
  rect: AtlasRect,
  key: [number, number, number],
  tol: number,
): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, rect.w);
  c.height = Math.max(1, rect.h);
  const cx = c.getContext("2d", { willReadFrequently: true });
  if (!cx) return c;
  cx.imageSmoothingEnabled = false;
  cx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  const img = cx.getImageData(0, 0, rect.w, rect.h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (
      Math.abs(d[i] - key[0]) <= tol &&
      Math.abs(d[i + 1] - key[1]) <= tol &&
      Math.abs(d[i + 2] - key[2]) <= tol
    ) {
      d[i + 3] = 0;
    }
  }
  cx.putImageData(img, 0, 0);
  return c;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load atlas: ${src}`));
    img.src = src;
  });
}

export async function loadAtlas(spec: AtlasSpec): Promise<Atlas> {
  const image = await loadImage(spec.src);
  const chromaKey = spec.chromaKey ?? [0, 0, 0];
  const tolerance = spec.tolerance ?? 16;
  const inset = spec.grid?.inset ?? 0;
  const rects: Record<string, AtlasRect> = {};
  const frames: Record<string, number> = {};
  const chromaKeys: Record<string, [number, number, number]> = {};
  for (const [k, entry] of Object.entries(spec.sprites)) {
    const keyColor = entry.chromaKey ?? chromaKey;
    chromaKeys[k] = keyColor;
    let rect: AtlasRect;
    if ("col" in entry) {
      if (!spec.grid) throw new Error(`Atlas sprite "${k}" uses col/row but no grid is defined`);
      rect = cellRect(spec.grid, entry.col, entry.row);
    } else {
      rect = { x: snap(entry.x), y: snap(entry.y), w: snap(entry.w), h: snap(entry.h) };
    }
    if (spec.grid?.tighten && rect.w > 0 && rect.h > 0) {
      rect = tightenRect(image, rect, keyColor, tolerance);
    }
    if (inset > 0 && rect.w > 0 && rect.h > 0) {
      rect = {
        x: rect.x + inset,
        y: rect.y + inset,
        w: rect.w - inset * 2,
        h: rect.h - inset * 2,
      };
    }
    rects[k] = rect;
    frames[k] = entry.frames ?? 1;
  }
  return { image, rects, frames, chromaKey, chromaKeys, tolerance, cache: new Map() };
}

export function getRect(atlas: Atlas, key: string): AtlasRect | null {
  const r = atlas.rects[key];
  if (!r || r.w <= 0 || r.h <= 0) return null;
  return r;
}

export type DrawOpts = {
  dx: number; // anchor point in destination space
  dy: number;
  scale?: number; // default 1
  flipX?: boolean; // mirror horizontally (facing left)
  anchor?: "bottom-center" | "center" | "top-left";
  frame?: number; // animation frame index (walk cycle)
  alpha?: number;
};

export function drawAtlasSprite(
  ctx: CanvasRenderingContext2D,
  atlas: Atlas,
  key: string,
  opts: DrawOpts,
): boolean {
  const rect = getRect(atlas, key);
  if (!rect) return false;
  const totalFrames = Math.max(1, atlas.frames[key] ?? 1);
  const frame = (((opts.frame ?? 0) % totalFrames) + totalFrames) % totalFrames;
  const fw = Math.floor(rect.w / totalFrames);
  if (fw < 1) return false;
  const src: AtlasRect = { x: rect.x + frame * fw, y: rect.y, w: fw, h: rect.h };

  const cacheKey = totalFrames > 1 ? `${key}#${frame}` : key;
  let canvas = atlas.cache.get(cacheKey);
  if (!canvas) {
    canvas = bakeSlice(atlas.image, src, atlas.chromaKeys[key] ?? atlas.chromaKey, atlas.tolerance);
    atlas.cache.set(cacheKey, canvas);
  }

  const scale = opts.scale ?? 1;
  const dw = canvas.width * scale;
  const dh = canvas.height * scale;
  let ox = opts.dx;
  let oy = opts.dy;
  const anchor = opts.anchor ?? "bottom-center";
  if (anchor === "bottom-center") {
    ox -= dw / 2;
    oy -= dh;
  } else if (anchor === "center") {
    ox -= dw / 2;
    oy -= dh / 2;
  }

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
  if (opts.flipX) {
    ctx.translate(ox + dw, oy);
    ctx.scale(-1, 1);
    ctx.drawImage(canvas, 0, 0, dw, dh);
  } else {
    ctx.drawImage(canvas, ox, oy, dw, dh);
  }
  ctx.restore();
  return true;
}

// Assign a list of sprite keys to grid cells in row-major order. Handy when the
// sheet packs sprites left-to-right, top-to-bottom and you know the order but
// not the exact pixel coords.
export function buildKeyMap(
  keys: string[],
  grid: AtlasGrid,
): Record<string, { col: number; row: number }> {
  const out: Record<string, { col: number; row: number }> = {};
  keys.forEach((k, i) => {
    const col = i % grid.cols;
    const row = Math.floor(i / grid.cols);
    if (row < grid.rows) out[k] = { col, row };
  });
  return out;
}
