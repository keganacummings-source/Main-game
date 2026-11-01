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
import { VillageCache, type Village } from "./world-villages";
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

  // --- the second wave --------------------------------------------------
  // A river is shallow water, so it uses the shallow tile rather than the deep
  // one: you are meant to be able to see you could wade it.
  [BIOME.river]: { floor: FL.water, biome: BI.tide, ground: TEX.water, wall: TEX.stoneWall, liquid: true },
  [BIOME.reef]: { floor: FL.water, biome: BI.tide, ground: TEX.water, patch: TEX.swamp, patchFloor: FL.water, patchAt: 0.3, wall: TEX.stoneWall, liquid: true },
  [BIOME.mangrove]: { floor: FL.bog, biome: BI.tide, ground: TEX.mudMangrove, patch: TEX.swamp, patchFloor: FL.water, patchAt: 0.26, wall: TEX.stoneWall, tree: TEX.treeSwamp, treeAt: 0.16 },
  // Badlands is the one biome whose walls are its own material: the ClayStone
  // wall tile is what makes a gully look cut rather than fenced.
  [BIOME.badlands]: { floor: FL.stone, biome: BI.crown, ground: TEX.clayStone, patch: TEX.sand, patchFloor: FL.sand, patchAt: 0.14, wall: TEX.clayWall, tree: TEX.treeDesert, treeAt: 0.004, scatter: TEX.decorClay, scatterAt: 0.08 },
  [BIOME.steppe]: { floor: FL.grass, biome: BI.verdant, ground: TEX.grassSteppe, patch: TEX.dirt, patchFloor: FL.dirt, patchAt: 0.12, wall: TEX.stoneWall, tree: TEX.treePlains, treeAt: 0.004, scatter: TEX.decorShrub, scatterAt: 0.04 },
  // The mushrooms ARE the biome, so they go on thick — more than any forest.
  [BIOME.sporefield]: { floor: FL.bog, biome: BI.tide, ground: TEX.mossSpore, patch: TEX.swampFloor, patchFloor: FL.bog, patchAt: 0.18, wall: TEX.stoneWall, tree: TEX.mushroom, treeAt: 0.22 },
  [BIOME.alpine]: { floor: FL.grass, biome: BI.bone, ground: TEX.grassAlpine, patch: TEX.stoneHighland, patchFloor: FL.stone, patchAt: 0.22, wall: TEX.stoneWall, tree: TEX.treeSnow, treeAt: 0.03, scatter: TEX.decorRocks, scatterAt: 0.07 },
  [BIOME.saltflats]: { floor: FL.sand, biome: BI.crown, ground: TEX.saltFlat, patch: TEX.sand, patchFloor: FL.sand, patchAt: 0.1, wall: TEX.sandWall, scatter: TEX.decorSalt, scatterAt: 0.05 },
};

/**
 * Things that stand in the world rather than carpet it.
 *
 * Trees and scatter are per-tile noise — they are the ground's texture. These
 * are landmarks: an ore node worth stopping for, an arena worth walking to.
 * They are rare enough that per-tile probability is the wrong tool (at one in
 * four thousand, rounding noise decides whether a region has any at all), so
 * each is placed on a fixed LATTICE: the world is divided into cells of `every`
 * tiles and at most one of the thing lands in each cell, at a spot the cell's
 * own hash picks. That makes them evenly spread, deterministic, independent of
 * region boundaries — a node on a region seam is cut identically from either
 * side — and countable in advance.
 */
type Feature = {
  art: string;
  /** Lattice cell size in chart tiles: one of these per cell, at most. */
  every: number;
  /** Chance a given cell actually gets one. */
  chance: number;
  /** Only on these biomes. */
  on: number[];
  /** Blocks movement (you walk up to it, not through it). */
  solid?: boolean;
  /** Salt in the hash so two features never choose the same tile. */
  salt: number;
};

export const FEATURES: Feature[] = [
  /*
   * The rates below are the ones that survived a world-wide count, and the
   * count is the only way to set them: a cell only produces its feature if the
   * ONE tile its hash picked happens to be a listed biome, so the real rate is
   * the cell rate times that biome's share of the world. At the first numbers
   * I tried, ore came out at 348 nodes and arenas at 8 — for a whole continent.
   */
  { // ~1,000 nodes: enough that a prospector always has somewhere to go.
    art: TEX.oreNode, every: 20, chance: 0.85, salt: 101, solid: true,
    on: [BIOME.highland, BIOME.badlands, BIOME.alpine, BIOME.volcanic, BIOME.tundra, BIOME.void],
  },
  // Mushrooms grow outside the sporefield too, just sparsely — damp shade.
  {
    art: TEX.mushroom, every: 18, chance: 0.5, salt: 211,
    on: [BIOME.forest, BIOME.swamp, BIOME.jungle, BIOME.taiga, BIOME.mangrove],
  },
  // Arenas are the rarest thing in the world and the only reason to cross it.
  // Rare, but not so rare that a hunter can cross the map without meeting one.
  {
    art: TEX.arena, every: 150, chance: 0.85, salt: 317,
    on: [BIOME.plains, BIOME.savanna, BIOME.desert, BIOME.steppe, BIOME.saltflats, BIOME.badlands, BIOME.highland, BIOME.volcanic, BIOME.void, BIOME.glacier],
  },
];

/** A deterministic hash per tile, so a region is identical every time it is cut. */
function h2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Whether a chart tile is solid rock.
 *
 * Highland above the treeline is solid, not walkable ground: that is what makes
 * mountain ranges read as barriers rather than grey meadows. This is the single
 * place that decides it, so the terrain a region is cut with, the enemies placed
 * on it and the sites laid out across it can never disagree about where the
 * walls are.
 */
export function rockAt(chart: WorldChart, cx: number, cy: number): boolean {
  const ci = cy * chart.w + cx;
  // A solid world feature — an ore node — is as solid as the mountain is, and
  // this is the place that has to say so. It was not here at first, and the
  // camp placer, which trusts this function completely, duly pitched tents on
  // top of ore nodes and spawned foes inside them.
  if (featureAt(chart.seed, cx, cy, chart.biome[ci]!)?.solid) return true;
  if (chart.biome[ci] !== BIOME.highland || chart.elev[ci]! <= 214) return false;
  return h2(cx, cy, chart.seed + 23) < 0.72;
}

/**
 * Ground a hunter or a foe can stand on: on the chart, not water, not solid rock.
 *
 * `villages` is optional because most callers ask about ground the villages
 * have no opinion on, and building one costs more than the question is worth.
 * Anything PLACING something — a camp, a site — must pass it, or it can put
 * what it is placing inside somebody's house.
 */
export function walkableAt(chart: WorldChart, cx: number, cy: number, villages?: VillageCache): boolean {
  if (cx < 2 || cy < 2 || cx >= chart.w - 2 || cy >= chart.h - 2) return false;
  if (isWater(chart.biome[cy * chart.w + cx]!)) return false;
  if (rockAt(chart, cx, cy)) return false;
  if (!villages) return true;
  for (const v of villages.overlapping(cx, cy, cx, cy)) {
    const t = v.tiles.get(cy * chart.w + cx);
    // Any built tile at all, not just the walls: a camp pitched on the village
    // green is still a camp in the middle of a village.
    if (t) return false;
  }
  return true;
}

/**
 * Whether a world feature stands on this chart tile.
 *
 * Pure function of the tile and the seed — no region, no neighbours — which is
 * what lets the same node be cut identically from either side of a seam.
 */
export function featureAt(seed: number, cx: number, cy: number, b: number): Feature | null {
  for (const f of FEATURES) {
    if (!f.on.includes(b)) continue;
    const gx = Math.floor(cx / f.every);
    const gy = Math.floor(cy / f.every);
    if (h2(gx, gy, seed + f.salt) >= f.chance) continue;
    // Where in the cell it stands. Two more hashes, so the lattice never shows.
    const ox = Math.floor(h2(gx, gy, seed + f.salt + 1) * f.every);
    const oy = Math.floor(h2(gx, gy, seed + f.salt + 2) * f.every);
    if (gx * f.every + ox === cx && gy * f.every + oy === cy) return f;
  }
  return null;
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
  /** Villages whose buildings reach into this region. */
  villages: Village[];
};

/**
 * Cut one region of the chart into playable terrain.
 *
 * Everything is derived from the chart plus the world seed, so the same region
 * always comes back the same — it can be thrown away and re-cut whenever the
 * hunter walks away and back, which is what keeps memory flat.
 */
export function buildRegion(chart: WorldChart, rx: number, ry: number, size = REGION, villages?: VillageCache): RegionWorld {
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

      // Solid rock is decided in rockAt, shared with everything that has to agree
      // about it — which now includes the solid world features, so a tile can be
      // solid because an ore node is standing on it.
      const feat = featureAt(chart.seed, cx, cy, b);
      const block = rockAt(chart, cx, cy) ? 1 : 0;

      /*
       * A solid feature IS the tile, not something laid over it.
       *
       * Scenery goes in `layers`, which the renderer draws on top of the ground
       * — but a solid tile draws its own sprite and nothing else, so a layer on
       * one is invisible. The ore art is an opaque 32x32 tile, so it stands on
       * its own as the sprite. This has now been got wrong twice in opposite
       * directions: first as a solid tile wearing a layer it could never show,
       * then — once `rockAt` learned about features — as a solid tile that fell
       * through to the mountain's wall art, so the nodes vanished from the world
       * entirely. It is decided here, before the tile is built, for that reason.
       */
      const solidFeature = feat?.solid ? feat : null;

      const tile: Record<string, unknown> = {
        floor: look.liquid ? FL.water : block ? FL.wall : floor,
        biome: look.biome,
        block,
        decor: 0,
        sprite: solidFeature ? solidFeature.art : block ? look.wall : sprite,
      };

      // Scenery. Water and solid rock never carry any, and a tile gets either a
      // tree or small ground detail — never both stacked on one tile.
      if (!block && !look.liquid) {
        // A landmark beats the scenery: an ore node is not something to hide in
        // a tree, and the lattice has already decided this tile is special.
        if (feat) {
          tile.layers = [feat.art];
          tile.decor = 1;
        } else if (look.tree && look.treeAt && h2(cx, cy, chart.seed + 41) < look.treeAt) {
          tile.layers = [look.tree];
          tile.decor = 1;
        } else if (look.scatter && look.scatterAt && h2(cx, cy, chart.seed + 59) < look.scatterAt) {
          tile.layers = [look.scatter];
        }
      }
      tiles[y * w + x] = tile;
    }
  }

  /*
   * Villages are stamped over the finished terrain rather than grown into it.
   *
   * Order matters and this is the right way round: the biome under a village
   * still decides its surroundings — a village in the taiga has pines right up
   * to its fence — but nothing the terrain pass rolled can put a tree through
   * somebody's roof, because the roof is written last.
   */
  const here: Village[] = villages
    ? villages.overlapping(originX, originY, originX + w - 1, originY + h - 1)
    : [];
  for (const v of here) {
    for (const [ci, t] of v.tiles) {
      const cx = ci % chart.w;
      const cy = (ci / chart.w) | 0;
      const x = cx - originX;
      const y = cy - originY;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;   // the rest of it is in the next region
      const tile: Record<string, unknown> = { floor: t.floor, biome: BI.verdant, block: t.block, decor: 0, sprite: t.sprite };
      if (t.layers) { tile.layers = t.layers; tile.decor = 1; }
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
    villages: here,
    // A village you are standing in is a better answer to "where am I" than the
    // continent it is on.
    name: here[0]?.name ?? home?.name ?? "The Open Sea",
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
  /**
   * Shared by every region this cache cuts.
   *
   * It has to be shared: a village straddles region seams, and the villagers
   * live on the Village object. One cache per region would give the two halves
   * of a border village two different sets of people.
   */
  readonly villages: VillageCache;
  constructor(private chart: WorldChart, private keep = 4) {
    this.villages = new VillageCache(chart);
  }

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
    const built = buildRegion(this.chart, rx, ry, REGION, this.villages);
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
