/**
 * Villages, and the people in them.
 *
 * The chart already decides WHERE a settlement is — `generateChart` drops a
 * named place on every habitable stretch of the continent. What it does not do
 * is build anything there, so until now a "settlement" was a dot on the map and
 * nothing at all on the ground.
 *
 * This builds the village itself: houses with walls, floors and a door, lanes
 * between them, a well in the middle, a noticeboard, and the villagers who live
 * there and walk around all day.
 *
 * Three rules shape the whole file:
 *
 *   1. DETERMINISTIC. A village is a pure function of the chart seed and the
 *      place it grew on, so it is identical every time it is built. Nothing here
 *      is stored in a save.
 *
 *   2. FOOTPRINT ONLY. A village is a sparse Map of chart index -> tile, not a
 *      grid. A village is about 40 tiles across in a 2500-tile world; holding it
 *      as a grid would be most of a region's memory for a thousandth of its area.
 *
 *   3. THE PEOPLE ARE SEPARATE FROM THE GROUND. The buildings are stamped into a
 *      region when it is cut, and cut regions are thrown away and rebuilt all the
 *      time. Villagers are not: they live on the Village object, which is cached,
 *      so a villager keeps walking the route they were on when you looked away.
 */
import { BIOME, isWater, type ChartPlace, type WorldChart } from "./world-chart";
import { FL, TEX } from "./tex-world";

/** One tile of built village, ready to be written over the terrain under it. */
export type VillageTile = {
  floor: number;
  block: 0 | 1;
  sprite: string;
  layers?: string[];
};

/**
 * A villager.
 *
 * The first six fields are exactly `MapNpc` (map-format.ts), because the engine
 * already knows how to draw one of those and how to talk to it. Everything after
 * them is the walking, which is this file's business and nobody else's.
 *
 * `tx`/`ty` are chart tiles and deliberately FRACTIONAL while someone is walking:
 * the engine multiplies them by the tile size to get a pixel position, so a
 * fraction is a smooth step rather than a jump from tile to tile.
 */
export type Villager = {
  id: string;
  name: string;
  tx: number;
  ty: number;
  role: string;
  female: boolean;
  lines: string[];
  outfit: number;
  hair: number;
  /** Where this villager lives — the tile just outside their own door. */
  homeX: number;
  homeY: number;
  /** The round they walk, in chart tiles. */
  route: { x: number; y: number }[];
  /** Which stop they are heading for. */
  leg: number;
  /** Tiles per second. */
  speed: number;
  /** Seconds left standing still before setting off again. */
  wait: number;
};

export type Village = {
  id: string;
  name: string;
  /** Centre, in chart tiles. */
  cx: number;
  cy: number;
  /** Everything built here, keyed by chart tile index. */
  tiles: Map<number, VillageTile>;
  villagers: Villager[];
  /** Footprint, in chart tiles, inclusive. */
  x0: number; y0: number; x1: number; y1: number;
};

/** The same small hash the chunk builder uses, so villages agree with the ground. */
function h2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function rngFrom(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_A = ["Bren", "Cass", "Dorn", "Ellis", "Fen", "Garr", "Hale", "Ivor", "Jess", "Kel", "Lorn", "Mira", "Noll", "Orin", "Pell", "Ryn", "Sable", "Tam", "Vesh", "Wyn"];
const FIRST_B = ["a", "en", "is", "ro", "ia", "eth", "or", "ly", "ick", "ara"];
const ROLES = [
  { role: "Farmer", lines: ["The ground here gives, if you ask it right.", "Mind the ditch past the last house."] },
  { role: "Smith", lines: ["Bring me ore and I'll bring you something worth carrying.", "Everything breaks. That's the trade."] },
  { role: "Forager", lines: ["Mushrooms out past the treeline. Not all of them are food.", "I walk further than anyone here."] },
  { role: "Warden", lines: ["Nothing gets in at night that I don't see.", "Stay on the lane after dark."] },
  { role: "Trader", lines: ["I've been to three of these. This one's the quiet one.", "Roads are worse every season."] },
  { role: "Elder", lines: ["We were here before the map had a name for us.", "Ask, and I'll tell you what I remember."] },
  { role: "Fisher", lines: ["River's running high this year.", "Patience is most of it."] },
  { role: "Herder", lines: ["Lost two to something in the hills.", "They wander. So do I."] },
];

function villagerName(rng: () => number): string {
  return FIRST_A[Math.floor(rng() * FIRST_A.length)]! + FIRST_B[Math.floor(rng() * FIRST_B.length)]!;
}

/** Ground a village can stand on. Not water, not bare mountain, not lava. */
function buildable(chart: WorldChart, i: number): boolean {
  const b = chart.biome[i]!;
  if (isWater(b)) return false;
  if (b === BIOME.highland && chart.elev[i]! > 214) return false;
  return b !== BIOME.glacier && b !== BIOME.volcanic;
}

/**
 * Grow a village on a place.
 *
 * Houses are laid on a loose ring around the centre rather than a grid: a grid
 * reads as a barracks, and the places these sit on are rarely flat enough for
 * one anyway. Each house faces the middle, which is what makes the lanes make
 * sense — every door has somewhere to go.
 */
export function buildVillage(chart: WorldChart, place: ChartPlace): Village {
  const rng = rngFrom(chart.seed ^ Math.imul(place.tx, 73856093) ^ Math.imul(place.ty, 19349663));
  const cx = place.tx;
  const cy = place.ty;
  const tiles = new Map<number, VillageTile>();
  const villagers: Villager[] = [];

  const houses = 5 + Math.floor(rng() * 6);           // 5-10
  const ring = 9 + Math.floor(rng() * 7);             // how far out the houses sit
  let x0 = cx, y0 = cy, x1 = cx, y1 = cy;

  const at = (x: number, y: number) => y * chart.w + x;
  const inChart = (x: number, y: number) => x >= 1 && y >= 1 && x < chart.w - 1 && y < chart.h - 1;
  const put = (x: number, y: number, t: VillageTile) => {
    if (!inChart(x, y)) return;
    tiles.set(at(x, y), t);
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  };

  const LANE: VillageTile = { floor: FL.dirt, block: 0, sprite: TEX.dirt };
  const FLOOR: VillageTile = { floor: FL.stone, block: 0, sprite: TEX.woodFloor };
  const WALL: VillageTile = { floor: FL.wall, block: 1, sprite: TEX.woodWall };

  /*
   * The green in the middle: a well, a noticeboard and packed earth.
   *
   * Done before the houses so a house can never be placed on top of the well —
   * the overlap test below only has to look at what is already there.
   */
  const plaza = 4;
  for (let y = cy - plaza; y <= cy + plaza; y++) {
    for (let x = cx - plaza; x <= cx + plaza; x++) {
      if (Math.hypot(x - cx, y - cy) > plaza) continue;
      if (!inChart(x, y) || !buildable(chart, at(x, y))) continue;
      put(x, y, LANE);
    }
  }
  // The well. Two tiles of water you cannot walk through, which is also what
  // stops the middle of every village being an empty circle.
  put(cx, cy, { floor: FL.water, block: 1, sprite: TEX.water });
  put(cx + 1, cy, { floor: FL.water, block: 1, sprite: TEX.water });
  put(cx - 2, cy + 2, { floor: FL.dirt, block: 0, sprite: TEX.dirt, layers: [TEX.sign] });

  type House = { hx: number; hy: number; w: number; h: number; doorX: number; doorY: number };
  const built: House[] = [];

  const TRIES = houses * 12;
  const spin = rng() * Math.PI * 2;
  for (let k = 0; k < TRIES && built.length < houses; k++) {
    /*
     * Where to try next.
     *
     * The angle comes from the ATTEMPT number, not from how many houses are
     * standing. That distinction is the whole thing: keyed to the houses built,
     * a failed attempt left every number unchanged, so the next attempt probed
     * the identical spot and failed identically. A village on awkward ground —
     * a taiga site hemmed in by a lake — got one house and one resident out of
     * forty tries. A golden-angle sweep visits a new direction every time.
     */
    const ang = spin + k * 2.39996;
    // And pull in, and build smaller, the longer it takes: a cramped site gets
    // a tight little hamlet rather than nothing at all.
    const squeeze = 1 - 0.45 * (k / TRIES);
    const dist = (ring + rng() * 7) * squeeze;
    const hw = Math.max(4, Math.round((5 + Math.floor(rng() * 3)) * squeeze));
    const hh = Math.max(3, Math.round((4 + Math.floor(rng() * 3)) * squeeze));
    const hx = Math.round(cx + Math.cos(ang) * dist) - (hw >> 1);
    const hy = Math.round(cy + Math.sin(ang) * dist) - (hh >> 1);

    // Room for the house and a tile of gap, on ground that will hold it, and
    // not on anything already built.
    let ok = true;
    for (let y = hy - 1; y <= hy + hh && ok; y++) {
      for (let x = hx - 1; x <= hx + hw; x++) {
        if (!inChart(x, y) || !buildable(chart, at(x, y)) || tiles.has(at(x, y))) { ok = false; break; }
      }
    }
    if (!ok) continue;

    // The door goes on the wall facing the middle, so every lane runs inward.
    const towardX = Math.abs(Math.cos(ang)) > Math.abs(Math.sin(ang));
    const doorX = towardX ? (Math.cos(ang) > 0 ? hx : hx + hw - 1) : hx + (hw >> 1);
    const doorY = towardX ? hy + (hh >> 1) : (Math.sin(ang) > 0 ? hy : hy + hh - 1);

    for (let y = hy; y < hy + hh; y++) {
      for (let x = hx; x < hx + hw; x++) {
        const edge = x === hx || y === hy || x === hx + hw - 1 || y === hy + hh - 1;
        put(x, y, edge ? WALL : FLOOR);
      }
    }
    put(doorX, doorY, { floor: FL.stone, block: 0, sprite: TEX.woodFloor });
    // A bed, and often somewhere to put things. Inside, away from the door.
    put(hx + 1, hy + 1, { floor: FL.stone, block: 0, sprite: TEX.woodFloor, layers: [TEX.bed] });
    if (rng() < 0.55) put(hx + hw - 2, hy + 1, { floor: FL.stone, block: 0, sprite: TEX.woodFloor, layers: [TEX.chest] });

    built.push({ hx, hy, w: hw, h: hh, doorX, doorY });
  }

  /*
   * Lanes, drawn from each door to the middle.
   *
   * A straight walk rather than a path search: the ground between a door and
   * the green has nothing on it by construction, because the houses were placed
   * with a gap and nothing else is built out there.
   */
  for (const ho of built) {
    let lx = ho.doorX, ly = ho.doorY;
    for (let guard = 0; guard < 80 && (lx !== cx || ly !== cy); guard++) {
      if (Math.abs(lx - cx) > Math.abs(ly - cy)) lx += lx < cx ? 1 : -1;
      else ly += ly < cy ? 1 : -1;
      if (!inChart(lx, ly) || !buildable(chart, at(lx, ly))) break;
      if (!tiles.has(at(lx, ly))) put(lx, ly, LANE);
    }
  }

  /*
   * The people.
   *
   * One or two per house, and every route runs door -> green -> somebody else's
   * door -> green. That is what makes a village look inhabited rather than
   * decorated: the lanes are in use, and two villagers meet in the middle.
   */
  const outside = (ho: House) => {
    // The tile just beyond the door, which is where a villager stands when home.
    const ox = ho.doorX + Math.sign(ho.doorX - (ho.hx + ho.w / 2 - 0.5));
    const oy = ho.doorY + Math.sign(ho.doorY - (ho.hy + ho.h / 2 - 0.5));
    return { x: ox, y: oy };
  };

  for (let k = 0; k < built.length; k++) {
    const ho = built[k]!;
    const home = outside(ho);
    const many = 1 + (rng() < 0.4 ? 1 : 0);
    for (let p = 0; p < many; p++) {
      const pick = ROLES[Math.floor(rng() * ROLES.length)]!;
      const other = built[(k + 1 + Math.floor(rng() * Math.max(1, built.length - 1))) % built.length]!;
      const away = outside(other);
      villagers.push({
        id: `v${place.id}:${k}:${p}`,
        name: villagerName(rng),
        tx: home.x,
        ty: home.y,
        role: pick.role,
        female: rng() < 0.5,
        lines: [`${pick.role} of ${place.name}.`, ...pick.lines],
        outfit: Math.floor(rng() * 8),
        hair: Math.floor(rng() * 6),
        homeX: home.x,
        homeY: home.y,
        route: [
          { x: home.x, y: home.y },
          { x: cx - 2, y: cy + 2 },
          { x: away.x, y: away.y },
          { x: cx + 2, y: cy - 2 },
        ],
        leg: 0,
        speed: 0.9 + rng() * 0.7,
        // Stagger the start so a village does not set off as one body.
        wait: rng() * 6,
      });
    }
  }

  return { id: place.id, name: place.name, cx, cy, tiles, villagers, x0, y0, x1, y1 };
}

/**
 * Walk everybody on for `dt` seconds.
 *
 * Deliberately not a path search. Villagers walk their own lanes, which were
 * built clear, and the only thing that can be in the way is another villager or
 * the player — neither of which is worth a search. If a step is blocked they
 * wait a moment and try again, which from the outside looks like somebody
 * stepping aside.
 *
 * `dt` is clamped: a backgrounded tab hands back one enormous frame, and without
 * the clamp every villager would teleport across their whole route at once.
 */
export function stepVillagers(village: Village, dt: number, blocked?: (tx: number, ty: number) => boolean): void {
  const step = Math.max(0, Math.min(dt, 0.25));
  for (const v of village.villagers) {
    if (v.wait > 0) { v.wait -= step; continue; }
    const goal = v.route[v.leg % v.route.length]!;
    const dx = goal.x - v.tx;
    const dy = goal.y - v.ty;
    const d = Math.hypot(dx, dy);
    if (d < 0.35) {
      // Arrived. Stand about for a while — this is most of what makes them read
      // as people rather than as patrols.
      v.leg = (v.leg + 1) % v.route.length;
      v.wait = 1.5 + h2(Math.round(v.tx), Math.round(v.ty) + v.leg, 7717) * 5;
      continue;
    }
    const move = Math.min(d, v.speed * step);
    const nx = v.tx + (dx / d) * move;
    const ny = v.ty + (dy / d) * move;
    if (blocked && blocked(Math.round(nx), Math.round(ny))) { v.wait = 0.4; continue; }
    v.tx = nx;
    v.ty = ny;
  }
}

/**
 * Villages are built on demand and kept.
 *
 * Building one is cheap but not free, and a region is cut and thrown away every
 * time the hunter walks a screen's width. More to the point, the villagers' own
 * positions live on the Village — rebuilding it would snap everyone back to
 * their doorstep whenever the terrain under them was re-cut.
 */
export class VillageCache {
  private map = new Map<string, Village>();
  constructor(private chart: WorldChart) {}

  get(place: ChartPlace): Village {
    const had = this.map.get(place.id);
    if (had) return had;
    const made = buildVillage(this.chart, place);
    this.map.set(place.id, made);
    return made;
  }

  /** Every village whose buildings touch this box of chart tiles. */
  overlapping(x0: number, y0: number, x1: number, y1: number): Village[] {
    const out: Village[] = [];
    for (const p of this.chart.places) {
      if (p.kind !== "settlement") continue;
      // A village never reaches further than this from its centre, so the cheap
      // test runs on the place and only survivors are actually built.
      const REACH = 32;
      if (p.tx + REACH < x0 || p.tx - REACH > x1 || p.ty + REACH < y0 || p.ty - REACH > y1) continue;
      const v = this.get(p);
      if (v.x1 < x0 || v.x0 > x1 || v.y1 < y0 || v.y0 > y1) continue;
      out.push(v);
    }
    return out;
  }

  /** Villages close enough to the hunter to be worth animating. */
  near(tx: number, ty: number, radius = 80): Village[] {
    return this.overlapping(tx - radius, ty - radius, tx + radius, ty + radius);
  }

  get size(): number { return this.map.size; }
  clear(): void { this.map.clear(); }
}
