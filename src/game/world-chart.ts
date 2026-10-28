/**
 * The world chart: TURBZ at 2500 x 2500 tiles.
 *
 * ── why this is not just a bigger tex-world ────────────────────────────────
 *
 * The old generator builds one plain object per tile. At 450 x 450 that is
 * 202,500 objects and about 118 MB of heap. At 2500 x 2500 it would be
 * 6,250,000 objects — roughly 3.6 GB — which no browser tab survives.
 *
 * So the chart stores the whole world in a handful of typed arrays instead,
 * one byte per tile per layer. The same 6.25M tiles come to about 25 MB, it
 * builds in a couple of seconds, and it is cheap to scan, draw and export.
 *
 * Nothing here is a playable tile. The chart says what the world IS — where
 * the continents are, which biome a spot belongs to, how high and how wet it
 * is. Playable terrain is cut from it a region at a time (world-chunks.ts),
 * so only the ground near the hunter is ever a real object.
 *
 * ── how a world is built ───────────────────────────────────────────────────
 *
 *   1. CONTINENTS   a few big landmasses, each an irregular blob, plus
 *                   scattered islands. Every land tile remembers which one it
 *                   belongs to, so a continent can be named and charted.
 *   2. ELEVATION    ridged noise, highest inland and at the continent's spine.
 *   3. MOISTURE     its own noise, plus a bonus for being near a coast.
 *   4. TEMPERATURE  latitude, cooled by height. Poles are cold, the middle is
 *                   hot, and a tall mountain is cold wherever it stands.
 *   5. BIOME        chosen from those three. Biomes therefore form bands and
 *                   patches WITHIN a continent rather than being painted on.
 *
 * Everything is driven by one seed and is deterministic: the same seed always
 * produces the same world, which is what makes a world shareable and what lets
 * the export carry a seed instead of 6 million tiles.
 */

export const CHART_W = 2500;
export const CHART_H = 2500;
export const CHART_N = CHART_W * CHART_H;

/** Sea level, on the 0-255 elevation scale. */
const SEA = 112;
/** Above this, land is bare rock and snow regardless of what else it wanted to be. */
const ALPINE = 232;
const HIGHLAND = 196;
/**
 * How land height is spread.
 *
 * Raw fractal noise clusters hard around its own middle, so a naive map of
 * noise to height made 63% of ALL land come out as mountain and left no beach
 * at all. Land elevation is therefore assigned by RANK — the lowest land tile
 * on the chart gets SEA, the highest gets 255 — pushed through this curve.
 * Above 1 it keeps most ground low and lets only the top slice reach alpine.
 */
const HEIGHT_CURVE = 3.4;
/** Stretch a 0-1 fractal value away from its middle so it uses its whole range. */
const stretch = (v: number, k = 2.1) => Math.max(0, Math.min(1, (v - 0.5) * k + 0.5));

// ---------------------------------------------------------------------------
// Biomes
// ---------------------------------------------------------------------------

/**
 * Every biome a chart tile can be. The first three are water; the rest are land.
 *
 * Ids are stored in a Uint8Array and in exported world files, so they are
 * append-only — never renumber one.
 */
export const BIOME = {
  deep: 0,
  ocean: 1,
  lake: 2,
  beach: 3,
  plains: 4,
  forest: 5,
  savanna: 6,
  desert: 7,
  swamp: 8,
  jungle: 9,
  taiga: 10,
  tundra: 11,
  glacier: 12,
  highland: 13,
  volcanic: 14,
  void: 15,
} as const;
export type BiomeId = (typeof BIOME)[keyof typeof BIOME];

export type ChartBiome = {
  id: BiomeId;
  key: string;
  label: string;
  /** Water is never walked on the chart and never grows anything. */
  water: boolean;
  /** Colour used by the chart menu and the exported PNG. */
  colour: string;
  /** Words the place namer draws on for this kind of ground. */
  words: string[];
  about: string;
};

export const BIOMES: readonly ChartBiome[] = [
  { id: BIOME.deep, key: "deep", label: "Deep Ocean", water: true, colour: "#12325e", words: ["Deep", "Abyss", "Trench"], about: "Open black water. Nothing stands here." },
  { id: BIOME.ocean, key: "ocean", label: "Ocean", water: true, colour: "#1d5c94", words: ["Sea", "Sound", "Strait"], about: "Shallower sea between the lands." },
  { id: BIOME.lake, key: "lake", label: "Lake", water: true, colour: "#2f86b8", words: ["Lake", "Mere", "Tarn"], about: "Fresh water held inland." },
  { id: BIOME.beach, key: "beach", label: "Shore", water: false, colour: "#d9c38a", words: ["Shore", "Strand", "Landing"], about: "Sand and shingle where the sea stops." },
  { id: BIOME.plains, key: "plains", label: "Plains", water: false, colour: "#7fb05a", words: ["March", "Meadow", "Field", "Wold"], about: "Rolling grass. The gentlest land." },
  { id: BIOME.forest, key: "forest", label: "Forest", water: false, colour: "#3f7a3a", words: ["Wood", "Holt", "Thicket"], about: "Close old woodland." },
  { id: BIOME.savanna, key: "savanna", label: "Savanna", water: false, colour: "#c2b26a", words: ["Flat", "Veld", "Dryfield"], about: "Dry grass and lone trees." },
  { id: BIOME.desert, key: "desert", label: "Desert", water: false, colour: "#e0c489", words: ["Waste", "Dune", "Scar"], about: "Dunes, dead trees and hidden water." },
  { id: BIOME.swamp, key: "swamp", label: "Swamp", water: false, colour: "#5c6b3f", words: ["Mire", "Fen", "Marsh"], about: "Black pools under weeping trees." },
  { id: BIOME.jungle, key: "jungle", label: "Jungle", water: false, colour: "#2f6b34", words: ["Reach", "Tangle", "Green"], about: "Drowned heat and vines." },
  { id: BIOME.taiga, key: "taiga", label: "Taiga", water: false, colour: "#4a6b5c", words: ["Pine", "Longwood", "Coldholt"], about: "Frozen pines on hard ground." },
  { id: BIOME.tundra, key: "tundra", label: "Tundra", water: false, colour: "#b9c9c4", words: ["Veil", "Hollow", "Watch"], about: "Drifts and bare frozen stone." },
  { id: BIOME.glacier, key: "glacier", label: "Glacier", water: false, colour: "#e2f0f5", words: ["Ice", "Glacier", "White"], about: "Standing ice that never goes." },
  { id: BIOME.highland, key: "highland", label: "Highland", water: false, colour: "#8a8275", words: ["Crag", "Peak", "Spine", "Tor"], about: "Bare rock above the treeline." },
  { id: BIOME.volcanic, key: "volcanic", label: "Volcanic", water: false, colour: "#8c3a2a", words: ["Cinder", "Ember", "Ashgrave"], about: "Hellbrick, lava rivers and charred trees." },
  { id: BIOME.void, key: "void", label: "Void", water: false, colour: "#6a4cff", words: ["Blight", "Nullgrave", "Breach"], about: "Violet grass and starry rock. The deepest, deadliest land." },
];

export const BIOME_BY_ID: Record<number, ChartBiome> = Object.fromEntries(BIOMES.map((b) => [b.id, b]));
/** True for the three water biomes. */
export const isWater = (b: number): boolean => b === BIOME.deep || b === BIOME.ocean || b === BIOME.lake;

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

/** A small fast hash → [0,1). Deterministic for a given x, y and seed. */
function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Value noise, smoothly interpolated. */
function noise2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = smooth(xf), v = smooth(yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** Fractal noise: several octaves of value noise, each finer and quieter. */
function fbm(x: number, y: number, seed: number, octaves = 5, gain = 0.5, lacunarity = 2): number {
  let sum = 0, amp = 1, norm = 0, fx = x, fy = y;
  for (let o = 0; o < octaves; o++) {
    sum += noise2(fx, fy, seed + o * 1013) * amp;
    norm += amp;
    amp *= gain;
    fx *= lacunarity;
    fy *= lacunarity;
  }
  return sum / norm;
}

/** Ridged noise, for mountain spines: folds the noise so its peaks become ridges. */
function ridge(x: number, y: number, seed: number, octaves = 4): number {
  let sum = 0, amp = 1, norm = 0, fx = x, fy = y;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(noise2(fx, fy, seed + o * 2017) * 2 - 1);
    sum += n * n * amp;
    norm += amp;
    amp *= 0.5;
    fx *= 2;
    fy *= 2;
  }
  return sum / norm;
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// The chart
// ---------------------------------------------------------------------------

export type Continent = {
  id: number;
  name: string;
  /** Centre, in chart tiles. */
  cx: number;
  cy: number;
  /** How many land tiles it ended up with. */
  tiles: number;
  /** Bounding box of its land, in chart tiles. */
  x0: number; y0: number; x1: number; y1: number;
  /** The biomes it actually contains, commonest first. */
  biomes: string[];
  island: boolean;
};

export type ChartPlace = {
  id: string;
  name: string;
  /** Chart tile. */
  tx: number;
  ty: number;
  kind: "settlement" | "landmark" | "peak" | "water";
  biome: string;
  continent: number;
};

export type WorldChart = {
  seed: number;
  w: number;
  h: number;
  /** Biome id per tile. */
  biome: Uint8Array;
  /** 0-255. Sea level is SEA. */
  elev: Uint8Array;
  /** 0-255. */
  moist: Uint8Array;
  /** 0-255, already cooled by elevation. */
  temp: Uint8Array;
  /** Continent id per tile; 0 means open water. */
  land: Uint8Array;
  continents: Continent[];
  places: ChartPlace[];
};

const NAME_HEAD = [
  "Vel", "Kor", "Ash", "Mur", "Tes", "Bran", "Dun", "Fen", "Gal", "Hal", "Isk", "Jor",
  "Kel", "Lun", "Mar", "Nor", "Orn", "Pel", "Quor", "Rin", "Sel", "Tor", "Umb", "Vor", "Wyn", "Zel",
];
const NAME_TAIL = ["reach", "mark", "hold", "fell", "vale", "gard", "moor", "crest", "wick", "barrow", "haven", "spire"];

/** A stable, pronounceable name from a roll. */
function placeName(rng: () => number, tail?: string): string {
  const head = NAME_HEAD[Math.floor(rng() * NAME_HEAD.length)]!;
  const end = tail ?? NAME_TAIL[Math.floor(rng() * NAME_TAIL.length)]!;
  return head + end;
}

/**
 * Which biome a spot wants to be, from its height, warmth and wet.
 *
 * Read as a table: cold things first, then dry things, then the rest by how wet
 * they are. Height overrides everything at the top, which is why a mountain in
 * the tropics is still bare rock and ice.
 *
 * Water is returned for anything below sea level, but SHORE is not decided here
 * — see the note inside.
 */
export function biomeFor(elev: number, temp: number, moist: number): BiomeId {
  if (elev < SEA - 26) return BIOME.deep;
  if (elev < SEA) return BIOME.ocean;
  // No beach band here on purpose. Shore is geography — land within a couple of
  // tiles of water — and the generator decides it before calling this. Judging
  // it by height instead made a third of the chart shore, because rank-mapped
  // land piles up just above sea level by design.

  if (elev > ALPINE) return temp < 96 ? BIOME.glacier : BIOME.highland;
  if (elev > HIGHLAND) return BIOME.highland;

  // The hottest, driest, highest ground turns volcanic — the old "hell" land.
  if (temp > 212 && moist < 70 && elev > SEA + 40) return BIOME.volcanic;

  if (temp < 58) return moist > 120 ? BIOME.glacier : BIOME.tundra;
  if (temp < 96) return moist > 110 ? BIOME.taiga : BIOME.tundra;

  if (temp > 188) {
    if (moist < 60) return BIOME.desert;
    if (moist < 110) return BIOME.savanna;
    if (moist > 190) return BIOME.jungle;
    return BIOME.forest;
  }

  if (moist < 58) return BIOME.desert;
  if (moist < 96) return BIOME.savanna;
  if (moist > 196) return BIOME.swamp;
  if (moist > 140) return BIOME.forest;
  return BIOME.plains;
}

export type ChartOpts = {
  seed?: number;
  w?: number;
  h?: number;
  /** How many large landmasses to aim for. */
  continents?: number;
  /** How many small islands to scatter. */
  islands?: number;
  /** Roughly how much of the chart should be land, 0-1. */
  landRatio?: number;
};

/**
 * Build a whole world.
 *
 * Deliberately one pass per layer over the tile array rather than one pass
 * doing everything: each loop stays in cache and the typed arrays keep the
 * whole thing to about 25 MB. A 2500 x 2500 chart takes a couple of seconds.
 */
export function generateChart(opts: ChartOpts = {}): WorldChart {
  const w = opts.w ?? CHART_W;
  const h = opts.h ?? CHART_H;
  const n = w * h;
  const seed = (opts.seed ?? 1) >>> 0 || 1;
  const rng = mulberry32(seed);
  const wantLand = opts.landRatio ?? 0.34;

  const biome = new Uint8Array(n);
  /*
   * Two separate fields, and keeping them separate is the whole point.
   *
   *   mass  — continent blobs plus noise. Decides ONLY land or sea.
   *   relief— ridged mountain belts. Decides ONLY how high land is.
   *
   * They used to be one field, so height peaked wherever continent mass peaked:
   * dead centre of every landmass. Every continent charted as a ring of green
   * around a round grey core, and no amount of belt masking could move it,
   * because the blob falloff outweighed the ridge everywhere.
   */
  const mass = new Uint16Array(n);
  const relief = new Uint16Array(n);
  const owner = new Uint8Array(n);
  const elev = new Uint8Array(n);
  const moist = new Uint8Array(n);
  const temp = new Uint8Array(n);
  const land = new Uint8Array(n);

  /*
   * ---- 1. one central continent -------------------------------------------
   *
   * The world is a single landmass in the middle of an ocean, not a ring of
   * separate blobs. It used to be the latter — five masses spaced around a wide
   * ring — which gave a scattered, archipelago-ish chart with no centre to it
   * and no sense of a homeland.
   *
   * The mass is built from a big core at the middle plus a handful of LOBES
   * overlapping it. Because the lobes sit inside the core's reach they fuse
   * with it rather than standing apart, and what they add is shape: headlands,
   * bays, peninsulas and the occasional near-separated limb.
   *
   * `continents` is how many lobes to hang off the core.
   */
  const lobeN = Math.max(2, opts.continents ?? 5);
  // No scattered islets by default. They cluttered the chart, split the land
  // into dozens of specks in the LANDS list, and gave the place namer a crowd of
  // one-settlement "isles" to name. Ask for them explicitly if you want them.
  const smallN = opts.islands ?? 0;
  type Blob = { x: number; y: number; r: number; id: number; island: boolean; name: string };
  const blobs: Blob[] = [];
  const span = Math.min(w, h);
  const margin = span * 0.1;

  // The core: broad, central, and by far the largest contributor.
  blobs.push({ x: w / 2, y: h / 2, r: span * 0.30, id: 1, island: false, name: placeName(rng) });

  // Lobes: close enough in to merge with the core, uneven enough to shape it.
  for (let i = 0; i < lobeN; i++) {
    const a = (i / lobeN) * Math.PI * 2 + rng() * 0.8;
    const d = (0.16 + rng() * 0.16) * span;
    blobs.push({
      x: w / 2 + Math.cos(a) * d, y: h / 2 + Math.sin(a) * d,
      r: span * (0.10 + rng() * 0.08),
      id: i + 2, island: false, name: placeName(rng),
    });
  }

  for (let i = 0; i < smallN; i++) {
    blobs.push({
      x: margin + rng() * (w - margin * 2), y: margin + rng() * (h - margin * 2),
      r: span * (0.012 + rng() * 0.022),
      id: lobeN + i + 2, island: true, name: placeName(rng, "isle"),
    });
  }

  /*
   * How quickly land gives out toward the edge of the chart.
   *
   * Without this the warp and the noise can push ground right to the border, so
   * the continent runs off the map instead of sitting in an ocean. 0 at the
   * very edge, 1 across the middle half.
   */
  const edgeFade = (x: number, y: number): number => {
    const nx = Math.abs(x / (w - 1) - 0.5) * 2;
    const ny = Math.abs(y / (h - 1) - 0.5) * 2;
    const d = Math.max(nx, ny);
    if (d < 0.52) return 1;
    return Math.max(0, 1 - (d - 0.52) / 0.40);
  };

  // ---- 2. elevation --------------------------------------------------------
  // Every tile takes the strongest continent influence over it, warped by noise
  // so coastlines are ragged instead of circular.
  const scale = 1 / 190;
  const warpScale = 1 / 320;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const wx = x + (fbm(x * warpScale, y * warpScale, seed + 71) - 0.5) * 150;
      const wy = y + (fbm(x * warpScale + 13, y * warpScale + 7, seed + 97) - 0.5) * 150;

      let best = 0, bestId = 0;
      for (const b of blobs) {
        const dx = (wx - b.x) / b.r, dy = (wy - b.y) / b.r;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d >= 1.35) continue;
        // 1 at the centre, easing to 0 at the rim.
        const fall = Math.max(0, 1 - d / 1.35);
        const v = fall * fall * (b.island ? 0.82 : 1);
        if (v > best) { best = v; bestId = b.id; }
      }

      const base = fbm(x * scale, y * scale, seed + 3, 5);
      const ridged = ridge(x * scale * 1.7, y * scale * 1.7, seed + 29, 4);
      // Continent mass decides land or sea; the ridge only sculpts what is land.
      // The fade keeps the sea at the margins, so the continent sits IN an
      // ocean rather than running off the side of the chart.
      const massed = (best * 0.78 + stretch(base) * 0.22) * edgeFade(x, y);
      mass[i] = Math.max(0, Math.min(65535, Math.round(massed * 65535)));

      // Where ranges are allowed to run at all: broad belts across the world,
      // unrelated to where any one continent happens to be centred.
      const belt = stretch(fbm(x / 520, y / 520, seed + 311, 3), 2.6);
      const rough = ridged * belt;
      // A gentle lift away from the rim so coasts sit lower than interiors —
      // enough to be believable, far too small to re-create the bullseye.
      const lift = Math.min(1, Math.max(0, massed - 0.30) * 2.2) * 0.22;
      relief[i] = Math.max(0, Math.min(65535, Math.round((rough * 0.78 + stretch(base, 1.4) * 0.22 + lift) / 1.22 * 65535)));
      owner[i] = bestId;
    }
  }

  /*
   * ---- 2b. sea level and the shape of the land ---------------------------
   *
   * Fractal noise gives no promise about how much land it will make, nor how
   * that land is spread between beach and mountain. Both are decided here, by
   * rank rather than by threshold:
   *
   *   - a histogram of the raw height field finds the exact cut that leaves
   *     `wantLand` of the chart above water, so every seed gets a real sea;
   *   - land is then mapped by its rank within the land, through HEIGHT_CURVE,
   *     so the low ground is wide and the peaks are rare.
   *
   * An earlier version shifted every elevation by a constant instead. It could
   * only ever take land away — a tile pushed back above the water kept its old
   * "this is sea" mark — so the world came out at 19% land when it was asked
   * for 34%, and almost all of that land was mountain.
   */
  {
    const BINS = 65536;
    // Sea level: the cut in CONTINENT MASS that leaves the asked-for land.
    const massHist = new Int32Array(BINS);
    for (let i = 0; i < n; i++) massHist[mass[i]!]++;
    const wantLandTiles = Math.round(n * wantLand);
    let cut = BINS - 1, acc = 0;
    while (cut > 0 && acc + massHist[cut]! <= wantLandTiles) { acc += massHist[cut]!; cut--; }

    for (let i = 0; i < n; i++) land[i] = mass[i]! > cut ? 1 : 0;

    // Height: the rank of RELIEF among land tiles only, so the tallest ground
    // is wherever the ranges run, not wherever a blob was centred.
    const reliefHist = new Int32Array(BINS);
    let landTiles = 0;
    for (let i = 0; i < n; i++) if (land[i]) { reliefHist[relief[i]!]++; landTiles++; }
    landTiles = Math.max(1, landTiles);
    const rankAbove = new Int32Array(BINS);
    let seen = 0;
    for (let b = BINS - 1; b >= 0; b--) { rankAbove[b] = seen; seen += reliefHist[b]!; }

    for (let i = 0; i < n; i++) {
      if (!land[i]) {
        // Water: deepest well out to sea, just under the surface near the cut.
        elev[i] = Math.max(0, Math.min(SEA - 1, Math.round((mass[i]! / Math.max(1, cut)) * (SEA - 1))));
        continue;
      }
      const r = 1 - rankAbove[relief[i]!]! / landTiles;   // 0 lowest land, 1 highest
      const shaped = Math.pow(Math.max(0, Math.min(1, r)), HEIGHT_CURVE);
      elev[i] = Math.max(SEA, Math.min(255, Math.round(SEA + shaped * (255 - SEA))));
    }
  }

  /*
   * ---- 2b-ii. smooth the coastline ---------------------------------------
   *
   * Thresholded fractal noise does not make a coast, it makes a fringe: single
   * tiles of sea poked into the land and vice versa, everywhere. The band
   * within two tiles of water therefore covered a THIRD of all land, so the
   * whole world charted as beach.
   *
   * A few majority passes fix it — a tile joins whichever side most of its
   * neighbours are on. Bays and headlands survive; one-tile fjords do not.
   */
  {
    const SMOOTH_PASSES = 3;
    let cur = land;
    let next = new Uint8Array(n);
    for (let pass = 0; pass < SMOOTH_PASSES; pass++) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          let count = 0, seen = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= h) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx;
              if (xx < 0 || xx >= w) continue;
              seen++;
              if (cur[yy * w + xx]) count++;
            }
          }
          next[i] = count * 2 > seen ? 1 : 0;
        }
      }
      const swap = cur; cur = next; next = swap;
    }
    if (cur !== land) land.set(cur);
    // Keep the height field honest about which side of the water a tile is on.
    for (let i = 0; i < n; i++) {
      if (land[i] && elev[i]! < SEA) elev[i] = SEA;
      else if (!land[i] && elev[i]! >= SEA) elev[i] = SEA - 1;
    }
  }

  /*
   * ---- 2c. real landmasses ------------------------------------------------
   *
   * Everything above the cut is "land" at this point, including the specks of
   * noise scattered across open ocean. Those specks are tiny but there are a
   * great many of them, and every one carries its own coastline: with them in,
   * a THIRD of all land sat within two tiles of water and the whole world came
   * out as beach.
   *
   * So the land is labelled into connected masses here. Anything smaller than a
   * real islet is given back to the sea, and what survives gets a continent id
   * — which means `land` now names an actual landmass rather than whichever
   * blob happened to be nearest.
   */
  /*
   * The smallest thing that counts as land.
   *
   * At 90 tiles a world came out with fifty-odd "landmasses", nearly all of
   * them coastal crumbs a few tiles across, and every one of them took a line
   * in the chart's LANDS list. A landmass has to be big enough to walk around.
   */
  const MIN_ISLAND = 400;
  const comp = new Int32Array(n).fill(-1);
  const compSize: number[] = [];
  {
    const stack: number[] = [];
    for (let start = 0; start < n; start++) {
      if (!land[start] || comp[start] !== -1) continue;
      const id = compSize.length;
      let size = 0;
      comp[start] = id;
      stack.push(start);
      while (stack.length) {
        const i = stack.pop()!;
        size++;
        const x = i % w;
        if (x > 0 && land[i - 1] && comp[i - 1] === -1) { comp[i - 1] = id; stack.push(i - 1); }
        if (x < w - 1 && land[i + 1] && comp[i + 1] === -1) { comp[i + 1] = id; stack.push(i + 1); }
        if (i >= w && land[i - w] && comp[i - w] === -1) { comp[i - w] = id; stack.push(i - w); }
        if (i < n - w && land[i + w] && comp[i + w] === -1) { comp[i + w] = id; stack.push(i + w); }
      }
      compSize.push(size);
    }
    // Rank the survivors by size; ids 1.. are handed out largest first.
    const keep = compSize.map((size, id) => ({ id, size })).filter((c) => c.size >= MIN_ISLAND).sort((a, b) => b.size - a.size);
    const idOf = new Int32Array(compSize.length).fill(0);
    keep.forEach((c, k) => { idOf[c.id] = Math.min(255, k + 1); });
    for (let i = 0; i < n; i++) {
      if (!land[i]) continue;
      const give = idOf[comp[i]!]!;
      if (give) { land[i] = give; continue; }
      land[i] = 0;                               // too small to be anywhere: back to the sea
      elev[i] = SEA - 1;
    }
  }

  /*
   * ---- 2d. inland water ---------------------------------------------------
   *
   * Lakes used to be whatever the coastline happened to strand, which on a
   * single central continent is almost nothing — a whole world came out with a
   * few hundred lake tiles. A continent this size should have real water in it,
   * so a handful of basins are carved on each landmass.
   *
   * Carved HERE, before the distance fields, so everything downstream sees them
   * as water: lakeshores get the damp they should, and the ocean flood fill
   * later cannot reach them, which is what marks them as lakes rather than sea.
   */
  {
    const lrng = mulberry32(seed ^ 0x3c6ef372);
    const bySize = new Map<number, number>();
    for (let i = 0; i < n; i++) if (land[i]) bySize.set(land[i]!, (bySize.get(land[i]!) ?? 0) + 1);

    for (const [id, tiles] of bySize) {
      if (tiles < 8000) continue;
      // Enough basins that a walk across the continent keeps meeting water,
      // not one inland sea a day's travel from everything else.
      const want = Math.max(6, Math.min(160, Math.round(tiles / 14000)));
      const baseR = Math.max(7, Math.sqrt(tiles) * 0.016);
      const centers: { x: number; y: number; r: number }[] = [];
      let made = 0;
      for (let attempt = 0; attempt < want * 80 && made < want; attempt++) {
        const x = Math.floor(lrng() * w);
        const y = Math.floor(lrng() * h);
        if (land[y * w + x] !== id) continue;
        const r = baseR * (0.55 + lrng() * 1.25);
        if (centers.some((c) => (c.x - x) ** 2 + (c.y - y) ** 2 < (c.r + r + 10) ** 2)) continue;
        // Inland only: a ring outside the basin must still be this landmass,
        // or the "lake" opens onto the sea and is just a bay.
        let inland = true;
        const guard = r + 8;
        for (let k = 0; k < 16 && inland; k++) {
          const a = (k / 16) * Math.PI * 2;
          const rx = Math.round(x + Math.cos(a) * guard);
          const ry = Math.round(y + Math.sin(a) * guard);
          if (rx < 1 || ry < 1 || rx >= w - 1 || ry >= h - 1 || land[ry * w + rx] !== id) inland = false;
        }
        if (!inland) continue;

        for (let yy = Math.max(1, Math.floor(y - r - 2)); yy <= Math.min(h - 2, Math.ceil(y + r + 2)); yy++) {
          for (let xx = Math.max(1, Math.floor(x - r - 2)); xx <= Math.min(w - 2, Math.ceil(x + r + 2)); xx++) {
            const i = yy * w + xx;
            if (land[i] !== id) continue;
            const d = Math.hypot(xx - x, yy - y) / r;
            // A solid basin with a wobbling shore, not a hole-punched disc.
            const edge = 0.78 + (fbm(xx / 18, yy / 18, seed + 907 + made, 3) - 0.5) * 0.36;
            if (d > edge) continue;
            land[i] = 0;
            elev[i] = SEA - 1 - Math.round((1 - Math.min(1, d)) * 18);
          }
        }
        centers.push({ x, y, r });
        made++;
      }

      // Smaller tarns in the ground between the big lakes.
      const tarns = Math.max(4, Math.min(48, Math.round(tiles / 42000)));
      let tarnMade = 0;
      for (let attempt = 0; attempt < tarns * 60 && tarnMade < tarns; attempt++) {
        const x = Math.floor(lrng() * w);
        const y = Math.floor(lrng() * h);
        if (land[y * w + x] !== id) continue;
        const r = 4 + lrng() * 5.5;
        if (centers.some((c) => (c.x - x) ** 2 + (c.y - y) ** 2 < (c.r + r + 6) ** 2)) continue;
        let inland = true;
        for (let k = 0; k < 8 && inland; k++) {
          const a = (k / 8) * Math.PI * 2;
          const rx = Math.round(x + Math.cos(a) * (r + 7));
          const ry = Math.round(y + Math.sin(a) * (r + 7));
          if (rx < 1 || ry < 1 || rx >= w - 1 || ry >= h - 1 || land[ry * w + rx] !== id) inland = false;
        }
        if (!inland) continue;
        for (let yy = Math.max(1, Math.floor(y - r)); yy <= Math.min(h - 2, Math.ceil(y + r)); yy++) {
          for (let xx = Math.max(1, Math.floor(x - r)); xx <= Math.min(w - 2, Math.ceil(x + r)); xx++) {
            const i = yy * w + xx;
            if (land[i] !== id) continue;
            if (Math.hypot(xx - x, yy - y) > r) continue;
            land[i] = 0;
            elev[i] = SEA - 2;
          }
        }
        centers.push({ x, y, r });
        tarnMade++;
      }
    }

    /*
     * Rivers. High ground sheds water downhill until it finds a lake or the sea.
     *
     * The course is walked FIRST, one tile at a time, and only widened afterwards.
     * Widening as you go looks like a finished lake to the next step, so the
     * river steps into water it just dug and stops — which is how a whole
     * continent used to get a handful of ponds on the peaks and no rivers at all.
     *
     * A river that reaches the ocean stays ocean; one that pools inland is
     * classified as a lake by the flood fill afterwards. Fords are left in the
     * course so a stream is something you cross, not a wall across the land.
     */
    const flow = new Uint8Array(n);
    let gen = 1;
    const DIRS: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    const carveDisc = (x: number, y: number, rad: number) => {
      const r2 = rad * rad;
      const y0 = Math.max(1, Math.floor(y - rad));
      const y1 = Math.min(h - 2, Math.ceil(y + rad));
      const x0 = Math.max(1, Math.floor(x - rad));
      const x1 = Math.min(w - 2, Math.ceil(x + rad));
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          const dx = xx - x, dy = yy - y;
          if (dx * dx + dy * dy > r2) continue;
          const i = yy * w + xx;
          if (!land[i]) continue;
          land[i] = 0;
          elev[i] = SEA - 1;
        }
      }
    };
    const course = (sx: number, sy: number, maxStep: number): number[] => {
      if (gen === 255) { flow.fill(0); gen = 1; } else gen++;
      const path: number[] = [];
      let x = sx, y = sy, px = 0, py = 0;
      for (let step = 0; step < maxStep; step++) {
        const here = y * w + x;
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) break;
        if (flow[here] === gen) break;
        if (!land[here]) break;
        flow[here] = gen;
        path.push(here);
        let bx = x, by = y, best = Infinity;
        const aim = (fbm(x / 28, y / 28, seed + 90 + gen, 2) - 0.5) * Math.PI * 2;
        const curE = elev[here]!;
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy;
          if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) continue;
          if (dx === -px && dy === -py) continue;
          const ni = ny * w + nx;
          if (flow[ni] === gen) continue;
          const water = !land[ni];
          const ahead = dx === px && dy === py ? -6 : 0;
          const climb = !water && elev[ni]! > curE + 1 ? (elev[ni]! - curE) * 10 : 0;
          const align = Math.cos(aim) * dx + Math.sin(aim) * dy;
          const score = (water ? -4000 : elev[ni]!) + climb - align * 12 + ahead;
          if (score < best) { best = score; bx = nx; by = ny; }
        }
        if (bx === x && by === y) break;
        const ni = by * w + bx;
        if (!land[ni]) break;                 // joined a lake, a river or the sea
        px = bx - x; py = by - y;
        x = bx; y = by;
      }
      return path;
    };
    const lay = (path: number[], width: number, pools: boolean) => {
      if (path.length < 8) return;
      for (let p = 0; p < path.length; p++) {
        // A ford, rarely: one gap you can walk through, not a dashed line.
        const slot = p % 120;
        if (p > 24 && p < path.length - 12 && slot >= 54 && slot <= 60) continue;
        const i = path[p]!;
        const xx = i % w, yy = (i / w) | 0;
        carveDisc(xx, yy, width);
        if (pools && p % 70 === 35) carveDisc(xx, yy, width + 2.4 + lrng() * 2);
      }
      // The end that never reached water becomes a pond, so a dead river
      // still reads as a lake rather than a ditch that stops.
      const end = path[path.length - 1]!;
      if (land[end]) carveDisc(end % w, (end / w) | 0, width + 3.2);
    };
    for (const [id, tiles] of bySize) {
      if (tiles < 12000) continue;
      const rivers = Math.max(6, Math.min(64, Math.round(tiles / 32000)));
      const brooks = Math.max(4, Math.min(72, Math.round(tiles / 26000)));
      const sources: { x: number; y: number; e: number }[] = [];
      const stride = Math.max(6, Math.round(Math.sqrt(tiles) / 26));
      for (let y = stride; y < h - stride; y += stride) {
        for (let x = stride; x < w - stride; x += stride) {
          const i = y * w + x;
          if (land[i] !== id || elev[i]! < SEA + 22) continue;
          let coastal = false;
          for (let k = 0; k < 8 && !coastal; k++) {
            const a = (k / 8) * Math.PI * 2;
            const rx = Math.round(x + Math.cos(a) * 14);
            const ry = Math.round(y + Math.sin(a) * 14);
            if (rx < 0 || ry < 0 || rx >= w || ry >= h || !land[ry * w + rx]) coastal = true;
          }
          if (!coastal) sources.push({ x, y, e: elev[i]! });
        }
      }
      sources.sort((a, b) => b.e - a.e);
      const picked: { x: number; y: number }[] = [];
      for (const s of sources) {
        if (picked.length >= rivers) break;
        if (picked.some((p) => (p.x - s.x) ** 2 + (p.y - s.y) ** 2 < 64 * 64)) continue;
        picked.push(s);
      }
      for (const src of picked) {
        const width = 1.35 + lrng() * 0.85;
        lay(course(src.x, src.y, 1800), width, true);
      }
      // Shorter brooks from lower hills, so the plains between the big rivers
      // are not a dry march.
      let laid = 0;
      for (const s of sources) {
        if (laid >= brooks) break;
        if (s.e < SEA + 18) continue;
        if (lrng() < 0.35) continue;
        if (picked.some((p) => (p.x - s.x) ** 2 + (p.y - s.y) ** 2 < 28 * 28)) continue;
        const width = 1.05 + lrng() * 0.45;
        const path = course(s.x, s.y, 700);
        if (path.length < 24) continue;
        lay(path, width, false);
        picked.push(s);
        laid++;
      }
    }
  }

  // ---- 3. coast distance, moisture, temperature ---------------------------
  // One cheap two-pass chamfer gives every tile its distance from water, which
  // feeds both the moisture and where the beaches go.
  /*
   * Distance from every land tile to the nearest water (and, below, the mirror
   * of it for the sea).
   *
   * A 3-4 chamfer, not a plain four-neighbour one: stepping only up/down/left/
   * right measures Manhattan distance, whose contours are diamonds, and that
   * showed on the chart as an angular edge where the shallows gave out. An
   * orthogonal step of 3 and a diagonal of 4 approximates true distance closely
   * enough for the contours to come out round. Divided back to tiles at the end.
   */
  const coast = new Int32Array(n);
  const FAR = 1 << 28;
  const ORTH = 3, DIAG = 4;
  for (let i = 0; i < n; i++) coast[i] = land[i] ? FAR : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!coast[i]) continue;
      let best = coast[i]!;
      if (x > 0) best = Math.min(best, coast[i - 1]! + ORTH);
      if (y > 0) best = Math.min(best, coast[i - w]! + ORTH);
      if (x > 0 && y > 0) best = Math.min(best, coast[i - w - 1]! + DIAG);
      if (x < w - 1 && y > 0) best = Math.min(best, coast[i - w + 1]! + DIAG);
      coast[i] = best;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!coast[i]) continue;
      let best = coast[i]!;
      if (x < w - 1) best = Math.min(best, coast[i + 1]! + ORTH);
      if (y < h - 1) best = Math.min(best, coast[i + w]! + ORTH);
      if (x < w - 1 && y < h - 1) best = Math.min(best, coast[i + w + 1]! + DIAG);
      if (x > 0 && y < h - 1) best = Math.min(best, coast[i + w - 1]! + DIAG);
      coast[i] = best;
    }
  }
  for (let i = 0; i < n; i++) if (coast[i]! < FAR) coast[i] = Math.round(coast[i]! / ORTH);
  const sea = new Int32Array(n);
  for (let i = 0; i < n; i++) sea[i] = land[i] ? 0 : FAR;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!sea[i]) continue;
      let best = sea[i]!;
      if (x > 0) best = Math.min(best, sea[i - 1]! + ORTH);
      if (y > 0) best = Math.min(best, sea[i - w]! + ORTH);
      if (x > 0 && y > 0) best = Math.min(best, sea[i - w - 1]! + DIAG);
      if (x < w - 1 && y > 0) best = Math.min(best, sea[i - w + 1]! + DIAG);
      sea[i] = best;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!sea[i]) continue;
      let best = sea[i]!;
      if (x < w - 1) best = Math.min(best, sea[i + 1]! + ORTH);
      if (y < h - 1) best = Math.min(best, sea[i + w]! + ORTH);
      if (x < w - 1 && y < h - 1) best = Math.min(best, sea[i + w + 1]! + DIAG);
      if (x > 0 && y < h - 1) best = Math.min(best, sea[i + w - 1]! + DIAG);
      sea[i] = best;
    }
  }
  for (let i = 0; i < n; i++) if (sea[i]! < FAR) sea[i] = Math.round(sea[i]! / ORTH);

  /*
   * Climate is measured across the LAND, not across the chart.
   *
   * With one central continent the land only occupies the middle band of the
   * chart — which, on chart latitude, is all tropics. The result was a world
   * with 22 tiles of taiga and 249 of glacier: the cold biomes existed only
   * because the guarantee pass forced them in.
   *
   * Stretching the gradient over the continent's own north-south span gives it
   * the full range instead: poles at its top and bottom edges, equator across
   * its middle. Ocean beyond the land simply clamps to polar.
   */
  let landY0 = h, landY1 = 0;
  for (let i = 0; i < n; i++) {
    if (!land[i]) continue;
    const y = (i / w) | 0;
    if (y < landY0) landY0 = y;
    if (y > landY1) landY1 = y;
  }
  if (landY1 < landY0) { landY0 = 0; landY1 = h - 1; }      // a world with no land at all
  const midY = (landY0 + landY1) / 2;
  const halfSpan = Math.max(1, (landY1 - landY0) / 2);

  const mScale = 1 / 150;
  for (let y = 0; y < h; y++) {
    // Cold at the continent's top and bottom, hottest across its middle.
    const lat = Math.min(1, Math.abs(y - midY) / halfSpan);
    const warmth = (1 - lat * lat) * 255;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const e = elev[i]!;
      // Stretched: raw fbm huddles around 0.5, which left nowhere on the chart
      // dry enough to be desert and nowhere wet enough to be jungle.
      const wet = stretch(fbm(x * mScale, y * mScale, seed + 17, 4), 2.4);
      // Near the sea is wetter; deep inland dries out.
      const near = Math.max(0, 1 - Math.min(coast[i]!, 220) / 220);
      moist[i] = Math.max(0, Math.min(255, Math.round(wet * 200 + near * 55)));
      // Height cools: about 70 points from sea level to the top of the scale.
      const cool = Math.max(0, e - SEA) * 0.62;
      const jitter = (fbm(x * mScale * 2, y * mScale * 2, seed + 41, 3) - 0.5) * 40;
      temp[i] = Math.max(0, Math.min(255, Math.round(warmth - cool + jitter)));
    }
  }

  /*
   * ---- 4. biomes ---------------------------------------------------------
   *
   * Shore and shallow sea are decided by DISTANCE TO THE COAST, not by height.
   * Deriving them from elevation made a third of all land a beach, because the
   * rank-mapped land piles up just above sea level by design.
   */
  const SHORE = 2;          // land tiles this close to water are shore
  /*
   * Where the shallows end.
   *
   * With one continent in a wide ocean, a narrow shelf left the sea as one flat
   * expanse of deep blue right up to the shore. A broader one gives the chart a
   * readable edge to the land.
   */
  const SHELF = 150;
  for (let i = 0; i < n; i++) {
    if (!land[i]) { biome[i] = sea[i]! <= SHELF ? BIOME.ocean : BIOME.deep; continue; }
    if (coast[i]! <= SHORE) { biome[i] = BIOME.beach; continue; }
    biome[i] = biomeFor(elev[i]!, temp[i]!, moist[i]!);
  }

  /*
   * ---- 4b. lakes ---------------------------------------------------------
   *
   * Water that cannot be reached from the edge of the chart is inland water.
   * The first version of this asked whether all four neighbours were land,
   * which is only ever true for a single-tile puddle — the whole world came
   * out with exactly one lake. A flood fill from the border is the real test.
   */
  {
    const reached = new Uint8Array(n);
    const stack: number[] = [];
    const push = (i: number) => { if (!land[i] && !reached[i]) { reached[i] = 1; stack.push(i); } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (i >= w) push(i - w);
      if (i < n - w) push(i + w);
    }
    for (let i = 0; i < n; i++) if (!land[i] && !reached[i]) biome[i] = BIOME.lake;
  }

  /*
   * River banks and lake shores were taking the same two-tile beach as the
   * ocean. A continent cut by rivers then charted as mostly sand. The sea keeps
   * its beach; inland water keeps a single tile of shore and the rest goes
   * back to whatever climate it actually has.
   */
  {
    const FAR = 255;
    const od = new Uint8Array(n);
    od.fill(FAR);
    const relax = (from: number, to: number) => {
      const d = od[from]!;
      if (d < FAR && d + 1 < od[to]!) od[to] = d + 1;
    };
    for (let i = 0; i < n; i++) if (biome[i] === BIOME.ocean || biome[i] === BIOME.deep) od[i] = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (x > 0) relax(i - 1, i);
        if (y > 0) relax(i - w, i);
      }
    }
    for (let y = h - 1; y >= 0; y--) {
      for (let x = w - 1; x >= 0; x--) {
        const i = y * w + x;
        if (x < w - 1) relax(i + 1, i);
        if (y < h - 1) relax(i + w, i);
      }
    }
    for (let i = 0; i < n; i++) {
      if (biome[i] !== BIOME.beach) continue;
      if (od[i]! <= SHORE) continue;
      if (coast[i]! <= 1) continue;
      biome[i] = biomeFor(elev[i]!, temp[i]!, moist[i]!);
    }
  }

  /*
   * ---- 4c. every land has every biome ------------------------------------
   *
   * Climate alone leaves a continent with whatever its latitude and rainfall
   * happen to give it. In practice that meant one landmass had seven of the
   * thirteen land biomes and another had twelve: a hunter could spend a whole
   * life on the wrong continent and never see a desert, and volcanic and void
   * ground — which need hot/dry/high and nowhere respectively — barely existed
   * at all.
   *
   * So after the climate has had its say, each landmass is checked and whatever
   * it is missing is PLACED on it, at the spot whose own climate is closest to
   * that biome's. A desert lands on that continent's driest, hottest ground and
   * a taiga on its coldest damp ground, so the patches sit where they would
   * have grown anyway rather than being dropped at random.
   *
   * Shore is not in the list: it is geography, and every landmass has a coast.
   */
  {
    /** Where each biome wants to be: elevation, warmth, wet. */
    const IDEAL: { id: BiomeId; elev: number; temp: number; moist: number; lift?: number }[] = [
      { id: BIOME.plains, elev: SEA + 25, temp: 140, moist: 115 },
      { id: BIOME.forest, elev: SEA + 30, temp: 140, moist: 170 },
      { id: BIOME.savanna, elev: SEA + 25, temp: 200, moist: 80 },
      { id: BIOME.desert, elev: SEA + 20, temp: 215, moist: 30 },
      { id: BIOME.swamp, elev: SEA + 10, temp: 140, moist: 225 },
      { id: BIOME.jungle, elev: SEA + 20, temp: 210, moist: 215 },
      { id: BIOME.taiga, elev: SEA + 40, temp: 80, moist: 160 },
      { id: BIOME.tundra, elev: SEA + 35, temp: 45, moist: 70 },
      { id: BIOME.glacier, elev: ALPINE + 10, temp: 25, moist: 180, lift: ALPINE + 12 },
      { id: BIOME.highland, elev: 245, temp: 110, moist: 110, lift: HIGHLAND + 14 },
      // These two have no climate of their own — they are scars. Put them on
      // high, dry inland ground, which is where they read best.
      { id: BIOME.volcanic, elev: HIGHLAND, temp: 220, moist: 40, lift: HIGHLAND - 10 },
      { id: BIOME.void, elev: SEA + 60, temp: 120, moist: 100 },
    ];

    /*
     * One pass to learn every landmass: how big it is, what it already has, and
     * a sample of its tiles to choose from.
     *
     * The sample is the important part. Searching the whole chart for the best
     * spot, once per landmass per missing biome, is twenty-odd landmasses times
     * a dozen biomes times 6.25 million tiles — about 1.6 billion reads, which
     * took the build from 8 seconds to minutes. Each landmass now carries a few
     * thousand candidate tiles and the search only ever looks at those.
     */
    const SAMPLE_MAX = 4000;
    const have = new Map<number, Set<number>>();
    const size = new Map<number, number>();
    const sample = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const id = land[i]!;
      if (!id) continue;
      size.set(id, (size.get(id) ?? 0) + 1);
      let set = have.get(id);
      if (!set) { set = new Set(); have.set(id, set); }
      set.add(biome[i]!);
    }
    {
      // Stride per landmass so each one contributes about SAMPLE_MAX tiles.
      const stride = new Map<number, number>();
      for (const [id, tiles] of size) stride.set(id, Math.max(1, Math.floor(tiles / SAMPLE_MAX)));
      const seen = new Map<number, number>();
      for (let i = 0; i < n; i++) {
        const id = land[i]!;
        if (!id || biome[i] === BIOME.beach) continue;
        const k = (seen.get(id) ?? 0) + 1;
        seen.set(id, k);
        if (k % stride.get(id)!) continue;
        let list = sample.get(id);
        if (!list) { list = []; sample.set(id, list); }
        list.push(i);
      }
    }

    /*
     * Tiles this pass has already painted.
     *
     * Without it a later biome's patch could land on top of an earlier one and
     * wipe it out — which is exactly what happened: a 9,000-tile continent came
     * out still missing savanna and swamp because the patches placed for them
     * were overwritten by the ones placed after.
     */
    const placed = new Uint8Array(n);
    for (const [id, tiles] of size) {
      // Too small to hold thirteen biomes without becoming a patchwork.
      if (tiles < 4000) continue;
      const got = have.get(id)!;
      // Patch radius scales with the landmass: a big continent gets big regions.
      const r = Math.max(6, Math.min(Math.sqrt(tiles) * 0.17, Math.min(w, h) * 0.05));

      for (const want of IDEAL) {
        if (got.has(want.id)) continue;
        // Find this landmass's most suitable spot, among its own sampled tiles.
        let bestI = -1, bestScore = Infinity;
        for (const i of sample.get(id) ?? []) {
          const de = (elev[i]! - want.elev) / 255;
          const dt = (temp[i]! - want.temp) / 255;
          const dm = (moist[i]! - want.moist) / 255;
          // Climate counts for more than height: a desert in the wrong hills is
          // still a desert, a desert in the wrong climate is nonsense.
          const score = dt * dt * 1.5 + dm * dm * 1.5 + de * de;
          if (score < bestScore) { bestScore = score; bestI = i; }
        }
        if (bestI < 0) continue;

        const bx = bestI % w, by = (bestI / w) | 0;
        const jitter = seed + want.id * 733;
        let painted = 0;
        for (let y = Math.max(0, Math.floor(by - r)); y < Math.min(h, Math.ceil(by + r)); y++) {
          for (let x = Math.max(0, Math.floor(bx - r)); x < Math.min(w, Math.ceil(bx + r)); x++) {
            const i = y * w + x;
            if (land[i] !== id || biome[i] === BIOME.beach) continue;
            const d = Math.hypot(x - bx, y - by) / r;
            if (d > 1) continue;
            // A ragged edge, so a placed region does not read as a stamped disc.
            if (placed[i]) continue;                  // another guaranteed biome owns this ground
            if (fbm(x / 22, y / 22, jitter, 3) < 0.22 + d * 0.62) continue;
            biome[i] = want.id;
            placed[i] = 1;
            if (want.lift && elev[i]! < want.lift) elev[i] = want.lift;
            painted++;
          }
        }
        // A ragged edge can eat the whole patch on an awkward spot; make sure the
        // biome exists at all rather than silently skipping it.
        if (!painted) {
          // A small solid block, with no mask to eat it.
          const fr = Math.max(2, Math.floor(r * 0.35));
          for (let y = Math.max(0, by - fr); y <= Math.min(h - 1, by + fr); y++) {
            for (let x = Math.max(0, bx - fr); x <= Math.min(w - 1, bx + fr); x++) {
              const i = y * w + x;
              if (land[i] !== id || biome[i] === BIOME.beach || placed[i]) continue;
              biome[i] = want.id;
              placed[i] = 1;
              if (want.lift && elev[i]! < want.lift) elev[i] = want.lift;
              painted++;
            }
          }
          if (!painted) { biome[bestI] = want.id; placed[bestI] = 1; }
        }
        got.add(want.id);
      }
    }

    /*
     * Check, do not assume.
     *
     * Everything above is best-effort on awkward ground, so the landmasses are
     * recounted here and anything genuinely still missing is forced. Without
     * this the generator could quietly promise a biome it had not placed.
     */
    {
      const actual = new Map<number, Set<number>>();
      for (let i = 0; i < n; i++) {
        const id = land[i]!;
        if (!id) continue;
        let set = actual.get(id);
        if (!set) { set = new Set(); actual.set(id, set); }
        set.add(biome[i]!);
      }
      for (const [id, tiles] of size) {
        if (tiles < 4000) continue;
        const set = actual.get(id);
        if (!set) continue;
        for (const want of IDEAL) {
          if (set.has(want.id)) continue;
          // Any inland tile of this landmass will do at this point.
          for (const i of sample.get(id) ?? []) {
            if (placed[i]) continue;
            biome[i] = want.id;
            placed[i] = 1;
            if (want.lift && elev[i]! < want.lift) elev[i] = want.lift;
            set.add(want.id);
            break;
          }
        }
      }
    }
  }

  // ---- 5. continents, measured from what actually landed ------------------
  const tally = new Map<number, { tiles: number; sx: number; sy: number; x0: number; y0: number; x1: number; y1: number; biomes: Map<number, number> }>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const id = land[i]!;
      if (!id) continue;
      let t = tally.get(id);
      if (!t) { t = { tiles: 0, sx: 0, sy: 0, x0: w, y0: h, x1: 0, y1: 0, biomes: new Map() }; tally.set(id, t); }
      t.tiles++; t.sx += x; t.sy += y;
      if (x < t.x0) t.x0 = x;
      if (y < t.y0) t.y0 = y;
      if (x > t.x1) t.x1 = x;
      if (y > t.y1) t.y1 = y;
      t.biomes.set(biome[i]!, (t.biomes.get(biome[i]!) ?? 0) + 1);
    }
  }
  const continents: Continent[] = [];
  const crng = mulberry32(seed ^ 0x1b873593);
  const big = Math.max(...[...tally.values()].map((t) => t.tiles), 1);
  for (const [id, t] of [...tally.entries()].sort((a, b) => b[1].tiles - a[1].tiles)) {
    // Islands only exist in a world that asked for them. Calling every smaller
    // landmass an "isle" by default named a 54,000-tile continent "Branisle".
    const island = smallN > 0 && t.tiles < big * 0.12;
    continents.push({
      id, name: placeName(crng, island ? "isle" : undefined),
      cx: Math.round(t.sx / t.tiles), cy: Math.round(t.sy / t.tiles),
      tiles: t.tiles, x0: t.x0, y0: t.y0, x1: t.x1, y1: t.y1, island,
      biomes: [...t.biomes.entries()].sort((p, q) => q[1] - p[1]).map(([bid]) => BIOME_BY_ID[bid]?.key ?? "?"),
    });
  }

  // ---- 6. named places -----------------------------------------------------
  const places: ChartPlace[] = [];
  const nrng = mulberry32(seed ^ 0x5bf03635);
  let placeN = 0;
  for (const c of continents) {
    /*
     * Settlements scale with AREA, not with its square root.
     *
     * The old formula was tuned when a world had five separate continents and
     * the places were shared out between them. With one central landmass it
     * gave nineteen settlements for the entire world — a two-million-tile
     * continent with almost nothing on it. One per ~18,000 tiles puts them a
     * reasonable walk apart.
     */
    const want = c.island
      ? 1 + Math.floor(nrng() * 2)
      : Math.max(4, Math.min(140, Math.round(c.tiles / 18000)));
    let tries = 0;
    let made = 0;
    while (made < want && tries < want * 220) {
      tries++;
      const x = c.x0 + Math.floor(nrng() * (c.x1 - c.x0 + 1));
      const y = c.y0 + Math.floor(nrng() * (c.y1 - c.y0 + 1));
      const i = y * w + x;
      if (land[i] !== c.id) continue;
      const b = BIOME_BY_ID[biome[i]!];
      if (!b || b.water) continue;
      // Keep them apart so the chart does not end up with a cluster of pins.
      // Spacing scales with how many are wanted, so a crowded continent still
      // spreads them out instead of failing to place most of them.
      const apart = Math.max(14, Math.min(w, h) * 0.035 * Math.sqrt(12 / Math.max(4, want)));
      if (places.some((p) => Math.hypot(p.tx - x, p.ty - y) < apart)) continue;
      const word = b.words[Math.floor(nrng() * b.words.length)]!;
      places.push({
        id: `pl${placeN++}`, name: placeName(nrng, word.toLowerCase()), tx: x, ty: y,
        kind: biome[i] === BIOME.highland || biome[i] === BIOME.glacier ? "peak" : "settlement",
        biome: b.key, continent: c.id,
      });
      made++;
    }
  }

  return { seed, w, h, biome, elev, moist, temp, land, continents, places };
}

/** The biome key at a chart tile, or null off the chart. */
export function biomeAt(chart: WorldChart, tx: number, ty: number): string | null {
  if (tx < 0 || ty < 0 || tx >= chart.w || ty >= chart.h) return null;
  return BIOME_BY_ID[chart.biome[ty * chart.w + tx]!]?.key ?? null;
}

/** How much of the chart is each biome, as tile counts, commonest first. */
export function biomeCensus(chart: WorldChart): { key: string; label: string; colour: string; tiles: number; share: number }[] {
  const counts = new Map<number, number>();
  for (let i = 0; i < chart.biome.length; i++) counts.set(chart.biome[i]!, (counts.get(chart.biome[i]!) ?? 0) + 1);
  const total = chart.biome.length;
  return [...counts.entries()]
    .map(([id, tiles]) => {
      const b = BIOME_BY_ID[id];
      // The colour rides along so callers can draw a swatch without having to
      // map a key back to a biome themselves.
      return { key: b?.key ?? "?", label: b?.label ?? "?", colour: b?.colour ?? "#ff00ff", tiles, share: tiles / total };
    })
    .sort((a, b) => b.tiles - a.tiles);
}

/** Biomes by their key, for callers that have a key and want the rest. */
export const BIOME_BY_KEY: Record<string, ChartBiome> = Object.fromEntries(BIOMES.map((b) => [b.key, b]));

/** Somewhere sensible for a hunter to wake: habitable, coastal-ish, on the biggest land. */
export function startSpot(chart: WorldChart): { tx: number; ty: number } {
  const home = chart.continents.find((c) => !c.island) ?? chart.continents[0];
  if (!home) return { tx: Math.floor(chart.w / 2), ty: Math.floor(chart.h / 2) };
  const rng = mulberry32(chart.seed ^ 0x2545f491);
  const kind = (b: number) => b === BIOME.plains || b === BIOME.forest || b === BIOME.savanna;
  let fallback: { tx: number; ty: number } | null = null;
  for (let t = 0; t < 40000; t++) {
    const x = home.x0 + Math.floor(rng() * (home.x1 - home.x0 + 1));
    const y = home.y0 + Math.floor(rng() * (home.y1 - home.y0 + 1));
    const i = y * chart.w + x;
    if (chart.land[i] !== home.id) continue;
    if (!fallback) fallback = { tx: x, ty: y };
    if (kind(chart.biome[i]!)) return { tx: x, ty: y };
  }
  return fallback ?? { tx: home.cx, ty: home.cy };
}
