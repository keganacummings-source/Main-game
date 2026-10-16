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

export function tileImage(path: string): HTMLImageElement {
  let img = imgCache.get(path);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.onload = img.onerror = () => { imageRevision++; };
    img.src = path;
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
