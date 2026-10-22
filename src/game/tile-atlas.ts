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

/** Tiles drawn from a designer-made image (a data URL) instead of the pack file at that path. */
let tileOverrides: Record<string, string> = {};

/** Swap in designer-made tiles for pack tiles. Cached images for any path that changed are dropped and the terrain repaints. */
export function setTileOverrides(next: Record<string, string>): void {
  const changed = new Set<string>();
  for (const k of Object.keys(tileOverrides)) if (tileOverrides[k] !== next[k]) changed.add(k);
  for (const k of Object.keys(next)) if (tileOverrides[k] !== next[k]) changed.add(k);
  tileOverrides = { ...next };
  for (const k of changed) imgCache.delete(k);
  if (changed.size) imageRevision++;
}

export function tileImage(path: string): HTMLImageElement {
  let img = imgCache.get(path);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.onload = img.onerror = () => { imageRevision++; };
    img.src = tileOverrides[path] ?? path;
    imgCache.set(path, img);
  }
  return img;
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
