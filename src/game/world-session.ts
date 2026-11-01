/**
 * Standing in the big world.
 *
 * The chart is 2500 x 2500 tiles and the game can only hold a REGION of it as
 * playable terrain at a time (world-chunks.ts). That leaves one problem, and it
 * is the whole reason this file exists: the engine addresses tiles as
 * `ty * world.w + tx`, so the hunter's position has to be RELATIVE TO THE
 * CURRENT REGION — and when she walks off the edge of one, both the terrain and
 * her coordinates have to move together, in the same instant, or she lands in a
 * wall or two hundred tiles out to sea.
 *
 * So this owns three things that have to agree with each other:
 *
 *   • which region is loaded,
 *   • where the hunter is inside it,
 *   • and the fog, the villages and the villagers, which are all addressed in
 *     CHART tiles and do not care about regions at all.
 *
 * Keeping the conversion in one place is what makes it testable without the
 * engine: everything below is arithmetic and arrays.
 */
import { REGION, RegionCache, type RegionWorld } from "./world-chunks";
import { startSpot, type WorldChart } from "./world-chart";
import { stepVillagers, type Villager } from "./world-villages";
import { noteVisited } from "./chart-store";

/** Pixels per tile. The engine's constant, repeated here so this file stands alone. */
export const TILE_PX = 32;

export type WorldSession = {
  chart: WorldChart;
  regions: RegionCache;
  /** The region currently cut into playable terrain. */
  rx: number;
  ry: number;
  world: RegionWorld;
};

/** Which region holds a chart tile, clamped to the chart. */
function regionFor(chart: WorldChart, tx: number, ty: number): { rx: number; ry: number } {
  const maxRx = Math.floor((chart.w - 1) / REGION);
  const maxRy = Math.floor((chart.h - 1) / REGION);
  return {
    rx: Math.max(0, Math.min(maxRx, Math.floor(tx / REGION))),
    ry: Math.max(0, Math.min(maxRy, Math.floor(ty / REGION))),
  };
}

/**
 * Enter the world at a chart tile, or at the chart's own start spot.
 *
 * Returns the session and the hunter's position IN PIXELS, relative to the
 * region that was loaded — which is what the engine's `save.x`/`save.y` hold.
 */
export function enterWorld(chart: WorldChart, at?: { tx: number; ty: number }): { session: WorldSession; x: number; y: number } {
  const spot = at ?? startSpot(chart);
  const { rx, ry } = regionFor(chart, spot.tx, spot.ty);
  const regions = new RegionCache(chart);
  const world = regions.get(rx, ry);
  return {
    session: { chart, regions, rx, ry, world },
    x: (spot.tx - rx * REGION) * TILE_PX + TILE_PX / 2,
    y: (spot.ty - ry * REGION) * TILE_PX + TILE_PX / 2,
  };
}

/** The chart tile under a region-local pixel position. */
export function chartTileAt(s: WorldSession, x: number, y: number): { tx: number; ty: number } {
  return {
    tx: s.rx * REGION + Math.floor(x / TILE_PX),
    ty: s.ry * REGION + Math.floor(y / TILE_PX),
  };
}

/**
 * The hunter has moved to region-local (x, y). Swap regions if she left this one.
 *
 * Returns her position again — unchanged if she is still in the same region,
 * SHIFTED by one region's width or height if she crossed. The caller must write
 * the returned values back, because the terrain under her has just been replaced
 * and the old numbers now point at somewhere else entirely.
 *
 * At the chart's edge there is nowhere to cross to, so she is held inside the
 * last region instead. The world is an ocean out there; this only ever matters
 * to something that can already swim.
 */
export function crossRegions(s: WorldSession, x: number, y: number): { x: number; y: number; moved: boolean } {
  const span = REGION * TILE_PX;
  const maxRx = Math.floor((s.chart.w - 1) / REGION);
  const maxRy = Math.floor((s.chart.h - 1) / REGION);
  let nx = x, ny = y, rx = s.rx, ry = s.ry;

  // A loop, not four ifs: one enormous step (a teleport, or a frame the browser
  // sat on) can cross more than one region at once.
  for (let guard = 0; guard < 64; guard++) {
    let again = false;
    if (nx < 0 && rx > 0) { rx--; nx += span; again = true; }
    else if (nx >= span && rx < maxRx) { rx++; nx -= span; again = true; }
    if (ny < 0 && ry > 0) { ry--; ny += span; again = true; }
    else if (ny >= span && ry < maxRy) { ry++; ny -= span; again = true; }
    if (!again) break;
  }

  /*
   * Held at the edge of the world.
   *
   * This has to be applied to what is RETURNED, not just computed: the first
   * version clamped and then, seeing the region had not changed, returned the
   * caller's original numbers — so at the chart's western edge the hunter was
   * handed back a negative position and walked off the array. Inside a region
   * the clamp does nothing, so returning it always is simply correct.
   */
  nx = Math.max(0, Math.min(span - 1, nx));
  ny = Math.max(0, Math.min(span - 1, ny));

  if (rx === s.rx && ry === s.ry) return { x: nx, y: ny, moved: false };
  s.rx = rx;
  s.ry = ry;
  s.world = s.regions.get(rx, ry);
  return { x: nx, y: ny, moved: true };
}

/**
 * One frame of the world: lift the fog where she is, and walk everybody else.
 *
 * Villagers are stepped for every village near the hunter rather than for the
 * whole world — ninety villages of a dozen people each, every frame, to animate
 * the four you could actually see.
 */
export function stepWorld(s: WorldSession, x: number, y: number, dt: number): void {
  const { tx, ty } = chartTileAt(s, x, y);
  noteVisited(tx, ty);
  for (const v of s.regions.villages.near(tx, ty, REGION)) {
    stepVillagers(v, dt, (btx, bty) => {
      // Villagers do not walk into their own walls. Everything else — the
      // hunter, each other — they step around by waiting, which is handled
      // inside stepVillagers.
      const t = v.tiles.get(bty * s.chart.w + btx);
      return !!t?.block;
    });
  }
}

/**
 * The villagers close enough to draw, with their positions converted to the
 * region-local PIXELS the renderer works in.
 *
 * The villagers themselves stay in chart tiles — they have to, because a village
 * spans regions and its people walk across the seam.
 */
export function visibleVillagers(s: WorldSession, radius = 48): { npc: Villager; x: number; y: number }[] {
  const out: { npc: Villager; x: number; y: number }[] = [];
  const cx = s.rx * REGION + REGION / 2;
  const cy = s.ry * REGION + REGION / 2;
  for (const v of s.regions.villages.near(cx, cy, REGION / 2 + radius)) {
    for (const npc of v.villagers) {
      out.push({
        npc,
        x: (npc.tx - s.rx * REGION) * TILE_PX + TILE_PX / 2,
        y: (npc.ty - s.ry * REGION) * TILE_PX + TILE_PX / 2,
      });
    }
  }
  return out;
}

/** Whichever villager is standing within `reach` pixels, for talking to. */
export function villagerNear(s: WorldSession, x: number, y: number, reach = 64): Villager | null {
  let best: Villager | null = null;
  let bd = reach;
  for (const { npc, x: vx, y: vy } of visibleVillagers(s)) {
    const d = Math.hypot(vx - x, vy - y);
    if (d < bd) { bd = d; best = npc; }
  }
  return best;
}

/** What the save needs to come back to the same spot in the same world. */
export function sessionSave(s: WorldSession): { seed: number; rx: number; ry: number } {
  return { seed: s.chart.seed, rx: s.rx, ry: s.ry };
}
