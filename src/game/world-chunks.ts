/**
 * Cutting playable ground out of the world chart.
 *
 * The chart (world-chart.ts) knows what every one of 6.25 million tiles IS, in
 * typed arrays, for about 25 MB. What it does not have is a single playable
 * tile: no sprite, no collision, no decoration. Those are plain objects, and
 * six million of them would be roughly 3.6 GB.
 *
 * So terrain is cut a REGION at a time. A region is a square of chart tiles
 * around the hunter, turned into the same `WorldData` the rest of the game
 * already understands — the engine, collision, the renderer and the map
 * builder all keep working, because what they are handed is exactly what they
 * were handed before, just smaller and from a much bigger world.
 *
 * One region at the default size is about 65k tiles: a third of the old whole
 * world, and well under a tenth of the memory it took.
 */
import { BIOME, isWater, type WorldChart } from "./world-chart";
import { BI, FL, TEX } from "./tex-world";
import type { WorldData } from "./world";

/** Chart tiles across one playable region. */
export const REGION = 256;

type Look = {
  floor: number;
  biome: number;
  /** Ground art. */
  ground: string;
  /** Second ground, scattered through the first. */
  patch?: string;
  patchFloor?: number;
  /** How much of the region is patch, 0-1. */
  patchAt?: number;
  /** Art for a solid tile of this biome. */
  wall: string;
  /** Scenery laid over the ground. */
  tree?: string;
  /** How thickly, 0-1. */
  treeAt?: number;
  /** Small ground detail — rocks, bones, shrubs — laid where there is no tree. */
  scatter?: string;
  scatterAt?: number;
  /** This ground cannot be walked. */
  liquid?: boolean;
};

/**
 * How each chart biome is dressed on the ground.
 *
 * Several biomes share art deliberately — taiga and tundra are both snow, with
 * different amounts of tree — because the New Texture set has one snow tile and
 * inventing a second by recolouring it would read as a bug, not a biome.
 */
export const LOOK: Record<number, Look> = {
  [BIOME.deep]: { floor: FL.water, biome: BI.tide, ground: TEX.deep, wall: TEX.stoneWall, liquid: true },
  [BIOME.ocean]: { floor: FL.water, biome: BI.tide, ground: TEX.water, wall: TEX.stoneWall, liquid: true },
  [BIOME.lake]: { floor: FL.water, biome: BI.tide, ground: TEX.water, wall: TEX.stoneWall, liquid: true },
  [BIOME.beach]: { floor: FL.sand, biome: BI.crown, ground: TEX.sand, patch: TEX.dirt, patchFloor: FL.dirt, patchAt: 0.06, wall: TEX.sandWall },
  [BIOME.plains]: { floor: FL.grass, biome: BI.verdant, ground: TEX.grass, patch: TEX.flowers, patchFloor: FL.grass, patchAt: 0.16, wall: TEX.stoneWall, tree: TEX.treePlains, treeAt: 0.015 },
  [BIOME.forest]: { floor: FL.grass, biome: BI.verdant, ground: TEX.grass, patch: TEX.dirt, patchFloor: FL.dirt, patchAt: 0.1, wall: TEX.stoneWall, tree: TEX.treePlains, treeAt: 0.14 },
  [BIOME.savanna]: { floor: FL.dirt, biome: BI.crown, ground: TEX.grassDry, patch: TEX.grass, patchFloor: FL.grass, patchAt: 0.18, wall: TEX.sandWall, tree: TEX.treeDesert, treeAt: 0.02, scatter: TEX.decorShrub, scatterAt: 0.05 },
  [BIOME.desert]: { floor: FL.sand, biome: BI.crown, ground: TEX.sand, patch: TEX.dirt, patchFloor: FL.dirt, patchAt: 0.12, wall: TEX.sandWall, tree: TEX.treeDesert, treeAt: 0.008, scatter: TEX.decorBones, scatterAt: 0.02 },
  [BIOME.swamp]: { floor: FL.bog, biome: BI.tide, ground: TEX.swampFloor, patch: TEX.swamp, patchFloor: FL.water, patchAt: 0.2, wall: TEX.stoneWall, tree: TEX.treeSwamp, treeAt: 0.1 },
  [BIOME.jungle]: { floor: FL.bog, biome: BI.tide, ground: TEX.grassJungle, patch: TEX.swampFloor, patchFloor: FL.bog, patchAt: 0.22, wall: TEX.stoneWall, tree: TEX.treeSwamp, treeAt: 0.2, scatter: TEX.decorShrub, scatterAt: 0.07 },
  [BIOME.taiga]: { floor: FL.snow, biome: BI.frost, ground: TEX.snow, patch: TEX.dirt, patchFloor: FL.dirt, patchAt: 0.08, wall: TEX.snowWall, tree: TEX.treeSnow, treeAt: 0.13 },
  [BIOME.tundra]: { floor: FL.snow, biome: BI.frost, ground: TEX.snowTundra, patch: TEX.snow, patchFloor: FL.snow, patchAt: 0.2, wall: TEX.snowWall, tree: TEX.treeSnow, treeAt: 0.012, scatter: TEX.decorBones, scatterAt: 0.03 },
  [BIOME.glacier]: { floor: FL.snow, biome: BI.frost, ground: TEX.ice, patch: TEX.snow, patchFloor: FL.snow, patchAt: 0.2, wall: TEX.snowWall },
  [BIOME.highland]: { floor: FL.stone, biome: BI.bone, ground: TEX.stoneHighland, patch: TEX.stone, patchFloor: FL.stone, patchAt: 0.16, wall: TEX.stoneWall, scatter: TEX.decorRocks, scatterAt: 0.06 },
  [BIOME.volcanic]: { floor: FL.ash, biome: BI.ashen, ground: TEX.hellFloor, patch: TEX.lava, patchFloor: FL.lava, patchAt: 0.05, wall: TEX.hellWall, tree: TEX.treeHell, treeAt: 0.03 },
  [BIOME.void]: { floor: FL.void, biome: BI.void, ground: TEX.voidGrass, patch: TEX.voidBrick, patchFloor: FL.void, patchAt: 0.08, wall: TEX.voidRock, tree: TEX.treeVoid, treeAt: 0.06 },
};

/** A deterministic hash per tile, so a region is identical every time it is cut. */
function h2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export type RegionKey = { rx: number; ry: number };

/** Which region a chart tile falls in. */
export function regionOf(tx: number, ty: number): RegionKey {
  return { rx: Math.floor(tx / REGION), ry: Math.floor(ty / REGION) };
}

export type RegionWorld = WorldData & {
  /** Where this region sits on the chart, in chart tiles. */
  originX: number;
  originY: number;
  rx: number;
  ry: number;
};

/**
 * Cut one region of the chart into playable terrain.
 *
 * Everything is derived from the chart plus the world seed, so the same region
 * always comes back the same — it can be thrown away and re-cut whenever the
 * hunter walks away and back, which is what keeps memory flat.
 */
export function buildRegion(chart: WorldChart, rx: number, ry: number, size = REGION): RegionWorld {
  const originX = rx * size;
  const originY = ry * size;
  const w = Math.min(size, chart.w - originX);
  const h = Math.min(size, chart.h - originY);
  const tiles = new Array(Math.max(0, w * h));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = originX + x;
      const cy = originY + y;
      const ci = cy * chart.w + cx;
      const b = chart.biome[ci]!;
      const look = LOOK[b] ?? LOOK[BIOME.plains]!;
      const r = h2(cx, cy, chart.seed + 7);

      let floor = look.floor;
      let sprite = look.ground;
      if (look.patch && look.patchAt && r < look.patchAt) {
        sprite = look.patch;
        floor = look.patchFloor ?? floor;
      }

      // Highland above the treeline is solid rock, not walkable ground: that is
      // what makes mountain ranges read as barriers rather than grey meadows.
      const high = b === BIOME.highland && chart.elev[ci]! > 214;
      const block = high && h2(cx, cy, chart.seed + 23) < 0.72 ? 1 : 0;

      const tile: Record<string, unknown> = {
        floor: look.liquid ? FL.water : block ? FL.wall : floor,
        biome: look.biome,
        block,
        decor: 0,
        sprite: block ? look.wall : sprite,
      };

      // Scenery. Water and solid rock never carry any, and a tile gets either a
      // tree or small ground detail — never both stacked on one tile.
      if (!block && !look.liquid) {
        if (look.tree && look.treeAt && h2(cx, cy, chart.seed + 41) < look.treeAt) {
          tile.layers = [look.tree];
          tile.decor = 1;
        } else if (look.scatter && look.scatterAt && h2(cx, cy, chart.seed + 59) < look.scatterAt) {
          tile.layers = [look.scatter];
        }
      }
      tiles[y * w + x] = tile;
    }
  }

  // Name the region after the land it actually holds, not after whatever is in
  // its top-left corner — which is open water for most coastal regions.
  const counts = new Map<number, number>();
  for (let y = 0; y < h; y += 4) {
    for (let x = 0; x < w; x += 4) {
      const id = chart.land[(originY + y) * chart.w + (originX + x)]!;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  let bestId = 0, bestN = 0;
  for (const [id, n2] of counts) if (n2 > bestN) { bestN = n2; bestId = id; }
  const home = bestId ? chart.continents.find((c) => c.id === bestId) : undefined;

  return {
    w, h, tiles: tiles as WorldData["tiles"], spawns: [], cache: null,
    originX, originY, rx, ry,
    name: home?.name ?? "The Open Sea",
  };
}

/**
 * How much a region costs, for anyone deciding how many to keep.
 *
 * A region at the default 256 is about 65k tiles. The old whole world was
 * 202,500, so three regions is roughly the memory the game used to use for all
 * of its terrain — and a 2500 x 2500 chart holds 100 of them.
 */
export const REGION_TILES = REGION * REGION;

/**
 * A small cache of cut regions.
 *
 * Keeps the few the hunter is standing in or next to and drops the rest. Cut
 * regions are pure functions of the chart, so dropping one costs nothing but
 * the time to cut it again.
 */
export class RegionCache {
  private map = new Map<string, RegionWorld>();
  constructor(private chart: WorldChart, private keep = 4) {}

  private key(rx: number, ry: number) { return `${rx},${ry}`; }

  get(rx: number, ry: number): RegionWorld {
    const k = this.key(rx, ry);
    const had = this.map.get(k);
    if (had) {
      // Freshen: re-inserting moves it to the end of the Map's order.
      this.map.delete(k);
      this.map.set(k, had);
      return had;
    }
    const built = buildRegion(this.chart, rx, ry);
    this.map.set(k, built);
    while (this.map.size > this.keep) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
    return built;
  }

  /** The region holding a chart tile. */
  at(tx: number, ty: number): RegionWorld {
    const { rx, ry } = regionOf(tx, ty);
    return this.get(rx, ry);
  }

  get size(): number { return this.map.size; }
  clear(): void { this.map.clear(); }
}
