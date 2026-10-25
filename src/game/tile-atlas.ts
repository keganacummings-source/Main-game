/**
 * Loads /MapAssets/catalog.json (DCSS map-building pack) and caches tile images.
 */

export type AtlasTile = {
  id: string;
  file: string;
  path: string;
  category: string;
  solid: boolean;
  slow: number;
};

export type AtlasCategory = {
  id: string;
  label: string;
  count: number;
  solid: boolean;
  liquid: boolean;
  tiles: AtlasTile[];
};

export type TileCatalog = {
  version: number;
  root: string;
  categories: AtlasCategory[];
};

const imgCache = new Map<string, HTMLImageElement>();
let catalogPromise: Promise<TileCatalog | null> | null = null;
let catalog: TileCatalog | null = null;
let imageRevision = 0;

/** Invalidate terrain painted with placeholders when a tile finishes loading. */
export function tileImageRevision(): number {
  return imageRevision;
}

export function loadTileCatalog(): Promise<TileCatalog | null> {
  if (catalog) return Promise.resolve(catalog);
  if (catalogPromise) return catalogPromise;
  catalogPromise = fetch("/MapAssets/catalog.json", { cache: "force-cache" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      catalog = j as TileCatalog | null;
      return catalog;
    })
    .catch(() => null);
  return catalogPromise;
}

export function getTileCatalogSync(): TileCatalog | null {
  return catalog;
}

/**
 * A designer-made tile standing in for the pack file at a path: either one still frame (a data
 * URL) or a two-frame loop with its speed.
 */
export type TileOverride = string | { a: string; b: string; fps: number };

const stillFrame = (o: TileOverride): string => (typeof o === "string" ? o : o.a);
const sameOverride = (x: TileOverride | undefined, y: TileOverride | undefined): boolean => {
  if (x === y) return true;
  if (x === undefined || y === undefined) return false;
  if (typeof x === "string" || typeof y === "string") return x === y;
  return x.a === y.a && x.b === y.b && x.fps === y.fps;
};

/** Tiles drawn from a designer-made image instead of the pack file at that path. */
let tileOverrides: Record<string, TileOverride> = {};
/** Just the paths that animate, so the draw path can skip all of this when nothing does. */
let animatedPaths: string[] = [];
let animatedRevision = 0;

/** Swap in designer-made tiles for pack tiles. Cached images for any path that changed are dropped and the terrain repaints. */
export function setTileOverrides(next: Record<string, TileOverride>): void {
  const changed = new Set<string>();
  for (const k of Object.keys(tileOverrides)) if (!sameOverride(tileOverrides[k], next[k])) changed.add(k);
  for (const k of Object.keys(next)) if (!sameOverride(tileOverrides[k], next[k])) changed.add(k);
  tileOverrides = { ...next };
  animatedPaths = Object.keys(tileOverrides).filter((k) => typeof tileOverrides[k] !== "string");
  for (const k of changed) { imgCache.delete(k); imgCacheB.delete(k); }
  if (changed.size) { imageRevision++; animatedRevision++; }
}

/** The tile paths that currently play a two-frame loop. Empty for almost every player. */
export function animatedTilePaths(): readonly string[] {
  return animatedPaths;
}

/** Bumped whenever the set of animated tiles changes, so callers can rebuild their own indexes. */
export function animatedTileRevision(): number {
  return animatedRevision;
}

export function isAnimatedTile(path: string): boolean {
  return typeof tileOverrides[path] === "object";
}

/**
 * Which frame of `path` is showing at `clock` seconds: 0 or 1. Always 0 for a tile that does not
 * animate, so the terrain bake can ask without caring.
 */
export function tileFrameAt(path: string, clock: number): 0 | 1 {
  const o = tileOverrides[path];
  if (typeof o !== "object") return 0;
  return (Math.floor(clock * o.fps) & 1) as 0 | 1;
}

/**
 * The image for a tile path: the designer's still frame (or frame 1 of a loop) if one is live,
 * otherwise the pack file. The terrain bake uses this, so a baked tile is always frame 1 and the
 * bake does not have to be thrown away to animate.
 */
export function tileImage(path: string): HTMLImageElement {
  let img = imgCache.get(path);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.onload = img.onerror = () => { imageRevision++; };
    const o = tileOverrides[path];
    img.src = o !== undefined ? stillFrame(o) : path;
    imgCache.set(path, img);
  }
  return img;
}

/** Frame 2 images, kept apart from the frame-1 cache so a bake never picks one up by accident. */
const imgCacheB = new Map<string, HTMLImageElement>();

/**
 * Frame 2 of an animated tile, or null when `path` does not animate. Loading frame 2 deliberately
 * does NOT bump `imageRevision`: the terrain bake holds frame 1, and re-baking the whole window
 * every time a loop ticked would cost far more than the animation is worth.
 */
export function tileImageFrameB(path: string): HTMLImageElement | null {
  const o = tileOverrides[path];
  if (typeof o !== "object") return null;
  let img = imgCacheB.get(path);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.src = o.b;
    imgCacheB.set(path, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export function preloadCategory(cat: AtlasCategory): void {
  for (const t of cat.tiles) tileImage(t.path);
}

export function findAtlasTile(idOrPath: string): AtlasTile | null {
  if (!catalog) return null;
  for (const c of catalog.categories) {
    for (const t of c.tiles) {
      if (t.id === idOrPath || t.path === idOrPath) return t;
    }
  }
  return null;
}

/** New Texture Mode art lives here; see tex-world.ts. */
export const NEWTEX_DIR = "/MapAssets/NewTex/";

/** Trees and portals are 64px art. They are drawn at their full size, not squashed into one 32px tile. */
export function isTallArt(path: string): boolean {
  return path.startsWith(NEWTEX_DIR) && (path.startsWith(NEWTEX_DIR + "tree_") || path === NEWTEX_DIR + "portal.png" || path === NEWTEX_DIR + "voidheart.png");
}

/**
 * Draws art at its natural size, centred on the tile and standing on its bottom edge, so a 64×64 tree or
 * portal rises above the tile it is planted on. (px, py) is the tile's top-left corner in pixels.
 */
export function drawTallArt(ctx: CanvasRenderingContext2D, path: string, px: number, py: number, tile = 32): boolean {
  const img = tileImage(path);
  if (!img.complete || img.naturalWidth <= 0) return false;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, px + tile / 2 - img.naturalWidth / 2, py + tile - img.naturalHeight, img.naturalWidth, img.naturalHeight);
  ctx.imageSmoothingEnabled = prev;
  return true;
}

/** New Texture Mode switch for art the engine draws itself (dungeon portals, tree nodes). Set per run by TURBZ. */
let texMode = false;
export function setTexMode(on: boolean): void { texMode = on; }
export function texModeOn(): boolean { return texMode; }

export function drawAtlasTile(
  ctx: CanvasRenderingContext2D,
  path: string,
  dx: number,
  dy: number,
  size: number,
): boolean {
  const img = tileImage(path);
  if (!img.complete || img.naturalWidth <= 0) return false;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, dx, dy, size, size);
  ctx.imageSmoothingEnabled = prev;
  return true;
}
