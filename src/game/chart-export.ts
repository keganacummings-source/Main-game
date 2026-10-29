/**
 * Taking a world out of the game.
 *
 * Two shapes, because they answer different questions:
 *
 *   PNG   what the hunter has charted, as a picture. Unexplored ground is not
 *         drawn — the whole point of the chart menu is that it shows where you
 *         have actually been.
 *
 *   JSON  the world itself: the seed, its continents, its biome census and
 *         every place discovered so far. It is a few kilobytes rather than the
 *         25 MB the chart occupies, because the seed rebuilds the rest exactly.
 *
 * Both are pure: they take a chart and a fog and give back data. Nothing here
 * touches the DOM, so it can all be tested.
 */
import { BIOME_BY_ID, biomeCensus, type ChartPlace, type WorldChart } from "./world-chart";
import { FOG_CELL, exploredShare, seenCell, type Explored } from "./explored";

/** Unexplored ground, in the chart's own colour scheme. */
const UNSEEN = [14, 11, 18] as const;

export type ChartPixels = { w: number; h: number; rgba: Uint8ClampedArray };

/**
 * Draw the explored world into raw pixels, one pixel per fog cell.
 *
 * One pixel per CELL rather than per tile on purpose: the fog is only known per
 * cell, so a per-tile image would be eight times larger while carrying exactly
 * the same information.
 */
export function chartPixels(chart: WorldChart, fog: Explored | null, opts: { all?: boolean } = {}): ChartPixels {
  const w = Math.ceil(chart.w / FOG_CELL);
  const h = Math.ceil(chart.h / FOG_CELL);
  const rgba = new Uint8ClampedArray(w * h * 4);
  const cache = new Map<number, [number, number, number]>();

  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      const o = (cy * w + cx) * 4;
      rgba[o + 3] = 255;
      if (!opts.all && (!fog || !seenCell(fog, cx, cy))) {
        rgba[o] = UNSEEN[0]; rgba[o + 1] = UNSEEN[1]; rgba[o + 2] = UNSEEN[2];
        continue;
      }
      // The middle of the cell stands for the whole of it.
      const tx = Math.min(chart.w - 1, cx * FOG_CELL + (FOG_CELL >> 1));
      const ty = Math.min(chart.h - 1, cy * FOG_CELL + (FOG_CELL >> 1));
      const b = chart.biome[ty * chart.w + tx]!;
      let col = cache.get(b);
      if (!col) {
        const hex = BIOME_BY_ID[b]?.colour ?? "#ff00ff";
        col = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
        cache.set(b, col);
      }
      rgba[o] = col[0]; rgba[o + 1] = col[1]; rgba[o + 2] = col[2];
    }
  }
  return { w, h, rgba };
}

/** Which named places the hunter has actually found. */
export function discoveredPlaces(chart: WorldChart, fog: Explored | null): ChartPlace[] {
  if (!fog) return [];
  return chart.places.filter((p) => seenCell(fog, Math.floor(p.tx / FOG_CELL), Math.floor(p.ty / FOG_CELL)));
}

export type WorldExport = {
  format: "turbz-world";
  version: 1;
  seed: number;
  size: { w: number; h: number };
  explored: number;
  continents: { name: string; tiles: number; island: boolean; biomes: string[]; cx: number; cy: number }[];
  biomes: { key: string; label: string; tiles: number; share: number }[];
  places: { name: string; tx: number; ty: number; kind: string; biome: string; favourite: boolean }[];
  exportedAt: string;
};

/**
 * The world as data.
 *
 * Only DISCOVERED places are listed: a chart is a record of what you found, and
 * exporting one that already names everywhere you have not been would give the
 * rest of the world away.
 *
 * Continents and the biome census are whole-world facts, because the seed makes
 * them recoverable anyway — anyone with the seed can rebuild the chart exactly.
 */
export function exportWorld(
  chart: WorldChart,
  fog: Explored | null,
  favourites: readonly string[] = [],
  now: Date = new Date(),
): WorldExport {
  const fav = new Set(favourites);
  return {
    format: "turbz-world",
    version: 1,
    seed: chart.seed,
    size: { w: chart.w, h: chart.h },
    explored: fog ? Number(exploredShare(fog).toFixed(4)) : 0,
    continents: chart.continents.map((c) => ({ name: c.name, tiles: c.tiles, island: c.island, biomes: c.biomes.slice(0, 6), cx: c.cx, cy: c.cy })),
    biomes: biomeCensus(chart).map((b) => ({ ...b, share: Number(b.share.toFixed(4)) })),
    places: discoveredPlaces(chart, fog).map((p) => ({
      name: p.name, tx: p.tx, ty: p.ty, kind: p.kind, biome: p.biome, favourite: fav.has(p.id),
    })),
    exportedAt: now.toISOString(),
  };
}

/** A filename that says which world and how far in. */
export function exportName(chart: WorldChart, ext: string): string {
  return `turbz-world-${chart.seed}.${ext}`;
}
