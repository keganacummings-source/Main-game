import { drawAtlasTile, tileImageRevision } from "./tile-atlas";
import {
  ANIMAL_BIOME,
  ANIMAL_BY_ID,
  BIOME_MONSTERS,
  MONSTER_BY_ID,
  NODE_STARTS,
  NPCS,
  POIS,
  TILE,
  WORLD_H,
  WORLD_W,
  scaleTile,
  type BiomeId,
  mulberry32,
  type Rng,
} from "./content";

export type Tile = { floor: number; biome: number; block: number; decor: number; sprite?: string; layers?: string[]; portal?: { map: string; tx?: number; ty?: number } };

export const BIOMES: BiomeId[] = ["void", "frost", "verdant", "crown", "bone", "tide", "ashen"];

export type Spawn = {
  id: string;
  kind: "mob" | "node";
  species?: string;
  node?: "ore" | "tree" | "shroom" | "fish";
  /** Legacy. Gathering requires E; walking into a node no longer collects it. */
  auto?: boolean;
  x: number;
  y: number;
  level: number;
  /** When set, the spawn's level is used as written instead of scaling to the hunter. */
  fixedLevel?: boolean;
  /** Runtime copy of the designer zone this foe came from. */
  zone?: {
    id: string;
    tx: number;
    ty: number;
    tw: number;
    th: number;
    levelMin: number;
    levelMax: number;
    species: string[];
    count: number;
    respawn: number;
  };
  boss?: boolean;
  dungeonBoss?: boolean;
  bossId?: string;
  template?: number;
  type?: string;
  animal?: boolean;
};

export type WorldData = {
  w: number;
  h: number;
  tiles: Tile[];
  spawns: Spawn[];
  cache: HTMLCanvasElement | null;
  entry?: { x: number; y: number };
};

const REGION_DESIGN: { id: BiomeId; x: number; y: number; r: number }[] = [
  { id: "void", x: 12, y: 10, r: 14 },
  { id: "frost", x: 64, y: 12, r: 16 },
  { id: "verdant", x: 42, y: 16, r: 16 },
  { id: "crown", x: 30, y: 32, r: 14 },
  { id: "bone", x: 40, y: 44, r: 9 },
  { id: "tide", x: 68, y: 34, r: 16 },
  { id: "ashen", x: 20, y: 50, r: 15 },
];

const REGION = REGION_DESIGN.map((r) => {
  const p = scaleTile(r.x, r.y);
  const span = WORLD_W / 84;
  return { id: r.id, x: p.tx, y: p.ty, r: Math.round(r.r * span * 0.93) };
});

export type Tavern = {
  id: string;
  name: string;
  biome: BiomeId;
  tx: number;
  ty: number;
  boardTx: number;
  boardTy: number;
};

const TAVERN_DESIGN: { id: string; name: string; biome: BiomeId; tx: number; ty: number }[] = [
  { id: "crown_tap", name: "Crownfall Tap", biome: "crown", tx: 27, ty: 36 },
  { id: "hollow_inn", name: "Hollow Inn", biome: "verdant", tx: 40, ty: 12 },
  { id: "march_lodge", name: "March Lodge", biome: "frost", tx: 62, ty: 8 },
  { id: "salt_house", name: "Salt House", biome: "tide", tx: 72, ty: 40 },
  { id: "kiln_bar", name: "Kiln Bar", biome: "ashen", tx: 14, ty: 52 },
  { id: "pit_rest", name: "Pit Rest", biome: "void", tx: 8, ty: 8 },
  { id: "lid_tavern", name: "Lid Tavern", biome: "bone", tx: 44, ty: 46 },
];

export const TAVERNS: Tavern[] = TAVERN_DESIGN.map((t) => {
  const p = scaleTile(t.tx, t.ty);
  return { ...t, tx: p.tx, ty: p.ty, boardTx: p.tx + 3, boardTy: p.ty + 6 };
});

function noise(x: number, y: number, seed: number): number {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function biomeIndex(x: number, y: number, seed: number): number {
  const n = noise(Math.floor(x / 24), Math.floor(y / 24), seed);
  let best = 3;
  let bestD = 99;
  REGION.forEach((r, i) => {
    const d = Math.hypot(x - r.x, y - r.y) / r.r + (n - 0.5) * 0.45;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

export function idx(x: number, y: number, w = WORLD_W): number {
  return y * w + x;
}

export function buildWorld(seed: number, hardcore = false): WorldData {
  // The frontier has its own seed, river basin, lakes, forests and regional layout.
  seed = (seed ^ (hardcore ? 0x6a09e667 : 0x3c6ef372)) >>> 0;
  const terrain = (x: number, y: number) => {
    const gx = Math.floor(x / 20), gy = Math.floor(y / 20);
    const fx = (x / 20 - gx), fy = (y / 20 - gy);
    const a = noise(gx, gy, seed), b = noise(gx + 1, gy, seed), c = noise(gx, gy + 1, seed), d = noise(gx + 1, gy + 1, seed);
    return (a * (1-fx) + b * fx) * (1-fy) + (c * (1-fx) + d * fx) * fy;
  };
  const w = WORLD_W;
  const h = WORLD_H;
  const tiles: Tile[] = new Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = x <= 1 || y <= 1 || x >= w - 2 || y >= h - 2;
      const b = biomeIndex(hardcore ? WORLD_W - x : x, hardcore ? WORLD_H - y : y, seed);
      const biome = BIOMES[b]!;
      let floor = 0;
      let block = 0;
      let decor = 0;
      if (edge) block = 1;
      else if (x > w - 14 - Math.round(terrain(x, y) * 12) ||
        Math.abs(x - ((hardcore ? .43 : .61) * w + Math.sin(y / (hardcore ? 23 : 37) + (seed % 19)) * (hardcore ? 32 : 20))) < (hardcore ? 3 : 2) ||
        terrain(x, y) < (hardcore ? .16 : .11)) {
        floor = 2; block = 1;
      } else {
        floor =
          biome === "tide" ? 4 : biome === "frost" ? 5 : biome === "ashen" ? 6 : biome === "void" ? 7 : biome === "bone" ? 8 : biome === "crown" ? 9 : 0;
        const n = terrain(x, y);
        if (biome !== "crown" && biome !== "bone" && n > (hardcore ? .52 : .62)) {
          decor = biome === "verdant" || biome === "tide" ? 1 : 2;
        } else if (n > .55) decor = biome === "verdant" ? 3 : biome === "bone" ? 4 : 5;
      }
      tiles[idx(x, y)] = { floor, biome: b, block, decor };
    }
  }
  carveRoad(tiles, w, ...ends(30, 32, 42, 16));
  carveRoad(tiles, w, ...ends(30, 32, 68, 34));
  carveRoad(tiles, w, ...ends(30, 32, 20, 50));
  carveRoad(tiles, w, ...ends(30, 32, 12, 10));
  carveRoad(tiles, w, ...ends(42, 16, 64, 12));
  carveRoad(tiles, w, ...ends(30, 32, 40, 44));
  carveRoad(tiles, w, ...ends(64, 12, 68, 34));
  // Streets connect every keeper to the central hearth; frontier tracks connect shelters.
  for (const n of NPCS) if (n.map === "world") {
    const p = scaleTile(n.tx, n.ty), home = scaleTile(30, 32);
    carveRoad(tiles, w, home.tx, home.ty, p.tx, p.ty);
  }
  if (!hardcore) buildings(tiles, w);
  const taverns = stampTaverns(tiles, w);
  const clear = (tx: number, ty: number) => {
    const t = tiles[idx(tx, ty)];
    if (!t) return;
    t.block = 0;
    t.decor = 0;
    if (t.floor === 2 || t.floor === 1) t.floor = 9;
  };
  for (const p of POIS) {
    if ("tx" in p) {
      const s = scaleTile(p.tx, p.ty);
      const span = p.kind === "shrine" || p.kind === "dungeon" ? 3 : 1;
      for (let dy = -1; dy <= span; dy++) {
        for (let dx = -span; dx <= span; dx++) clear(s.tx + dx, s.ty + dy);
      }
    }
  }
  for (const n of NPCS) {
    if (n.map === "world") {
      const p = scaleTile(n.tx, n.ty);
      clear(p.tx, p.ty);
    }
  }
  for (const t of taverns) {
    clear(t.boardTx, t.boardTy);
    clear(t.boardTx, t.boardTy - 1);
    clear(t.boardTx, t.boardTy + 1);
    clear(t.boardTx, t.boardTy + 2);
  }
  for (const t of tiles) {
    if (t.floor !== 1 && t.floor !== 2) t.block = 0;
  }
  const reached = linkMainland(tiles, w, h);
  const rng = mulberry32(seed);
  const spawns = spawnMobs(rng, tiles, w, h, reached);
  // Resource groves sit on connected ground, including a starter grove and pond.
  const home = scaleTile(30, 32);
  for (let y = 8; y < h - 8; y += 18) for (let x = 8; x < w - 8; x += 21) {
    const t = tiles[idx(x, y, w)]!;
    if (!reached[idx(x, y, w)] || t.block || t.floor === 3 || t.floor === 9 || t.floor === 2) continue;
    if (terrain(x, y) < .4) continue;
    t.decor = 0; // node trees are drawn live so they can be cut down
    spawns.push({ id: `tree-${x}-${y}`, kind: "node", node: "tree", x: x * TILE + 16, y: y * TILE + 16, level: 1 });
  }
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const t = tiles[idx(home.tx + dx, home.ty + dy, w)]!;
    t.block = 0; t.floor = 9; t.decor = 0;
  }
  tiles[idx(home.tx + 2, home.ty + 1, w)]!.decor = 0;
  spawns.push({ id: "starter-tree", kind: "node", node: "tree", x: (home.tx + 2) * TILE + 16, y: (home.ty + 1) * TILE + 16, level: 1 });
  // Small protected well pond within walking distance of the hearth.
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const t = tiles[idx(home.tx - 6 + dx, home.ty + 5 + dy, w)]!;
    t.floor = 2; t.block = 1; t.decor = 0;
  }
  // Fixed starting ore, tree and mushroom nodes. They live in `spawns` like every other node so
  // harvesting removes them and the engine respawns them elsewhere.
  for (const n of NODE_STARTS) {
    const at = scaleTile(n.tx, n.ty);
    const open = nearestOpenTile(tiles, w, h, at.tx, at.ty);
    if (!open) continue;
    tiles[open.ty * w + open.tx]!.decor = 0;
    spawns.push({ id: n.id, kind: "node", node: n.node, auto: true, x: open.tx * TILE + 16, y: open.ty * TILE + 16, level: 1 });
  }
  const ground = ["grass_0_new.png", "ice_0_new.png", "grass_0_new.png", "dirt_full_new.png", "limestone_0.png", "sand_1.png", "volcanic_floor_0.png"];
  for (const t of tiles) {
    if (t.floor === 1) continue; // Existing settlement walls keep their architectural renderer.
    t.sprite = t.floor === 2 ? "/MapAssets/03_Water_and_Liquid_Tiles/shoals_shallow_water_0.png" :
      `/MapAssets/01_Floor_and_Ground_Tiles/${t.floor === 3 ? "dirt_full_new.png" : t.floor === 4 || t.floor === 9 ? "sandstone_floor_0.png" : ground[t.biome]}`;
  }
  return { w, h, tiles, spawns, cache: null };

}

function ends(x0: number, y0: number, x1: number, y1: number): [number, number, number, number] {
  const a = scaleTile(x0, y0);
  const b = scaleTile(x1, y1);
  return [a.tx, a.ty, b.tx, b.ty];
}

function carveRoad(tiles: Tile[], w: number, x0: number, y0: number, x1: number, y1: number) {
  let x = x0;
  let y = y0;
  const stamp = (tx: number, ty: number) => {
    if (tx <= 1 || ty <= 1 || tx >= w - 2 || ty >= WORLD_H - 2) return;
    const t = tiles[idx(tx, ty, w)];
    if (!t) return;
    const water = t.floor === 2;
    if (t.floor === 1 && !water) return;
    t.floor = water ? 4 : 3;
    t.block = 0;
    t.decor = 0;
  };
  for (let i = 0; i < 4000; i++) {
    const t = tiles[idx(x, y, w)];
    const water = t?.floor === 2;
    stamp(x, y);
    if (water) {
      stamp(x + 1, y);
      stamp(x - 1, y);
      stamp(x, y + 1);
      stamp(x, y - 1);
    }
    if (x === x1 && y === y1) break;
    if (x !== x1) x += Math.sign(x1 - x);
    else if (y !== y1) y += Math.sign(y1 - y);
  }
}

function openTile(tiles: Tile[], w: number, h: number, x: number, y: number): boolean {
  if (x <= 1 || y <= 1 || x >= w - 2 || y >= h - 2) return false;
  const t = tiles[idx(x, y, w)];
  if (!t || t.floor === 1 || t.floor === 2 || t.block) return false;
  return true;
}

function floodLand(tiles: Tile[], w: number, h: number, seen: Uint8Array, sx: number, sy: number) {
  if (!openTile(tiles, w, h, sx, sy) || seen[idx(sx, sy, w)]) return;
  const stack = [sy * w + sx];
  seen[sy * w + sx] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i / w) | 0;
    for (const n of [i + 1, i - 1, i + w, i - w]) {
      if (n < 0 || n >= seen.length || seen[n]) continue;
      const nx = n % w;
      const ny = (n / w) | 0;
      if (nx <= 1 || ny <= 1 || nx >= w - 2 || ny >= h - 2) continue;
      if (!openTile(tiles, w, h, nx, ny)) continue;
      seen[n] = 1;
      stack.push(n);
    }
  }
}

function dock(tiles: Tile[], w: number, h: number, x: number, y: number) {
  if (x <= 1 || y <= 1 || x >= w - 2 || y >= h - 2) return;
  const t = tiles[idx(x, y, w)];
  if (!t) return;
  if (t.floor === 1 || t.floor === 2 || t.block) {
    t.floor = t.floor === 2 ? 4 : 3;
    t.block = 0;
    t.decor = 0;
  }
}

/** Every tavern, shrine, and shore camp gets a walkable road back to Crownfall. */
function linkMainland(tiles: Tile[], w: number, h: number): Uint8Array {
  const seen = new Uint8Array(w * h);
  const crown = TAVERNS[0]!;
  floodLand(tiles, w, h, seen, crown.tx + 3, crown.ty + 2);
  if (!seen.some((v) => v === 1)) {
    for (let y = 2; y < h - 2 && !seen.some((v) => v === 1); y++) {
      for (let x = 2; x < w - 2; x++) {
        if (openTile(tiles, w, h, x, y)) {
          floodLand(tiles, w, h, seen, x, y);
          break;
        }
      }
    }
  }
  const goals: { x: number; y: number }[] = [];
  for (const t of TAVERNS) goals.push({ x: t.boardTx, y: t.boardTy });
  for (const p of POIS) {
    if ("tx" in p && "ty" in p) {
      const s = scaleTile(p.tx, p.ty);
      goals.push({ x: s.tx, y: s.ty });
    }
  }
  for (const n of NPCS) {
    if (n.map === "world") {
      const s = scaleTile(n.tx, n.ty);
      goals.push({ x: s.tx, y: s.ty });
    }
  }
  for (const g of goals) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) dock(tiles, w, h, g.x + dx, g.y + dy);
    if (seen[idx(g.x, g.y, w)]) {
      floodLand(tiles, w, h, seen, g.x, g.y);
      continue;
    }
    const prev = new Int32Array(w * h);
    prev.fill(-1);
    const start = g.y * w + g.x;
    prev[start] = start;
    const q = [start];
    let hit = -1;
    for (let qi = 0; qi < q.length && hit < 0; qi++) {
      const i = q[qi]!;
      const x = i % w;
      const y = (i / w) | 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx <= 1 || ny <= 1 || nx >= w - 2 || ny >= h - 2) continue;
        const ni = ny * w + nx;
        if (prev[ni] !== -1) continue;
        prev[ni] = i;
        if (seen[ni]) {
          hit = ni;
          break;
        }
        q.push(ni);
      }
    }
    if (hit < 0) continue;
    let i = hit;
    for (let steps = 0; steps < w * h; steps++) {
      const x = i % w;
      const y = (i / w) | 0;
      dock(tiles, w, h, x, y);
      dock(tiles, w, h, x + 1, y);
      dock(tiles, w, h, x - 1, y);
      dock(tiles, w, h, x, y + 1);
      dock(tiles, w, h, x, y - 1);
      if (i === start) break;
      const n = prev[i]!;
      if (n < 0) break;
      i = n;
    }
    floodLand(tiles, w, h, seen, g.x, g.y);
  }
  return seen;
}

function buildings(tiles: Tile[], w: number) {
  const halls = [
    [24, 26, 8, 5],
    [33, 26, 7, 5],
    [26, 35, 10, 4],
  ];
  for (const hall of halls) {
    const origin = scaleTile(hall[0]!, hall[1]!);
    stampHall(tiles, w, origin.tx, origin.ty, Math.max(6, hall[2]!), Math.max(4, hall[3]!));
  }
}

function stampHall(tiles: Tile[], w: number, x: number, y: number, bw: number, bh: number) {
  for (let yy = y; yy < y + bh; yy++) {
    for (let xx = x; xx < x + bw; xx++) {
      const edge = xx === x || yy === y || xx === x + bw - 1 || yy === y + bh - 1;
      const door = yy === y + bh - 1 && xx === x + Math.floor(bw / 2);
      const t = tiles[idx(xx, yy, w)];
      if (!t) continue;
      if (edge && !door) {
        t.block = 1;
        t.floor = 1;
        t.decor = 0;
      } else {
        t.block = 0;
        t.floor = 9;
        t.decor = 0;
      }
    }
  }
}

function stampTaverns(tiles: Tile[], w: number): Tavern[] {
  return TAVERNS.map((tavern) => {
    stampHall(tiles, w, tavern.tx, tavern.ty, 7, 5);
    const board = tiles[idx(tavern.boardTx, tavern.boardTy, w)];
    if (board) {
      board.block = 0;
      board.floor = 4;
      board.decor = 6;
    }
    return tavern;
  });
}

function spawnMobs(rng: Rng, tiles: Tile[], w: number, h: number, reached?: Uint8Array): Spawn[] {
  const out: Spawn[] = [];
  let n = 0;
  for (let y = 4; y < h - 4; y += 11) {
    for (let x = 4; x < w - 4; x += 13) {
      const t = tiles[idx(x, y, w)]!;
      const biome = BIOMES[t.biome] ?? "verdant";
      if (t.block || t.floor === 1 || t.floor === 2 || t.floor === 3 || t.floor === 9) continue;
      if (reached && !reached[idx(x, y, w)]) continue;
      if (rng() > 0.48) continue;
      const list = BIOME_MONSTERS[biome];
      const species = list[Math.floor(rng() * list.length)]!;
      const def = MONSTER_BY_ID[species]!;
      const level = 2 + Math.floor(Math.hypot(x - w / 2, y - h / 2) / 8) + Math.floor(rng() * 3);
      out.push({
        id: `m${n++}`,
        kind: "mob",
        species,
        x: x * TILE + TILE / 2,
        y: y * TILE + TILE / 2,
        level,
        template: def.template,
        type: def.type,
      });
    }
  }
  for (let y = 6; y < h - 6; y += 15) {
    for (let x = 6; x < w - 6; x += 17) {
      const t = tiles[idx(x, y, w)]!;
      const biome = BIOMES[t.biome] ?? "verdant";
      if (t.block || t.floor === 1 || t.floor === 2 || t.floor === 3 || t.floor === 9) continue;
      if (reached && !reached[idx(x, y, w)]) continue;
      if (rng() > 0.62) continue;
      const list = ANIMAL_BIOME[biome];
      if (!list?.length) continue;
      const species = list[Math.floor(rng() * list.length)]!;
      const def = ANIMAL_BY_ID[species]!;
      out.push({
        id: `a${n++}`,
        kind: "mob",
        species,
        x: x * TILE + TILE / 2,
        y: y * TILE + TILE / 2,
        level: 1 + Math.floor(rng() * 4),
        template: def.template,
        type: def.type,
        animal: true,
      });
    }
  }
  for (const p of POIS) {
    if (p.kind === "boss") {
      const at = scaleTile(p.tx, p.ty);
      out.push({
        id: p.id,
        kind: "mob",
        species: "saintling",
        boss: true,
        bossId: p.id,
        x: at.tx * TILE + 16,
        y: at.ty * TILE + 16,
        level: p.level,
        template: p.template,
        type: p.type,
      });
    }
  }
  return out;
}

const FLOOR_COLOR = ["#4f9a45", "#6e6258", "#2a78b0", "#cbb89a", "#e4d2a4", "#e7f3fb", "#c56a3c", "#7d62c8", "#a08478", "#c6b18e"];

export function paintWorld(world: WorldData): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = world.w * TILE;
  c.height = world.h * TILE;
  const g = c.getContext("2d")!;
  for (let y = 0; y < world.h; y++) {
    for (let x = 0; x < world.w; x++) {
      const t = world.tiles[idx(x, y, world.w)]!;
      if (t.sprite && drawAtlasTile(g, t.sprite, x * TILE, y * TILE, TILE)) {
        if (t.layers) for (const l of t.layers) drawAtlasTile(g, l, x * TILE, y * TILE, TILE);
        continue;
      }
      g.fillStyle = FLOOR_COLOR[t.floor] ?? "#333";
      g.fillRect(x * TILE, y * TILE, TILE, TILE);
      if ((x + y) % 2 === 0) {
        g.fillStyle = "rgba(0,0,0,0.08)";
        g.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
      if (t.floor === 1) {
        g.fillStyle = "#3a322c";
        g.fillRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4);
        g.fillStyle = "#1a1412";
        g.fillRect(x * TILE + 4, y * TILE + 6, TILE - 8, 6);
      }
      if (t.floor === 3) {
        g.fillStyle = "#4a4038";
        g.fillRect(x * TILE + 6, y * TILE + 14, 6, 4);
        g.fillRect(x * TILE + 18, y * TILE + 14, 6, 4);
      }
      if (t.decor === 1) {
        /* Trees are painted after the floor so the canopy is not stamped out. */
      } else if (t.decor === 2) {
        g.fillStyle = "#3a3430";
        g.beginPath();
        g.ellipse(x * TILE + 16, y * TILE + 18, 10, 7, 0, 0, Math.PI * 2);
        g.fill();
      } else if (t.decor === 3) {
        g.fillStyle = "#8fd06a";
        g.fillRect(x * TILE + 14, y * TILE + 16, 2, 8);
        g.fillRect(x * TILE + 18, y * TILE + 14, 2, 10);
      } else if (t.decor === 4) {
        g.fillStyle = "#e8dcc4";
        g.fillRect(x * TILE + 14, y * TILE + 16, 4, 8);
        g.fillRect(x * TILE + 12, y * TILE + 14, 8, 3);
      } else if (t.decor === 5 && BIOMES[t.biome] === "ashen") {
        g.fillStyle = "#e25a32";
        g.fillRect(x * TILE + 15, y * TILE + 18, 2, 6);
      }
      if (t.floor === 2) {
        g.fillStyle = "rgba(180,220,255,0.25)";
        g.fillRect(x * TILE, y * TILE + 8 + ((x * 3) % 6), TILE, 2);
      }
    }
  }
  for (let y = 0; y < world.h; y++) {
    for (let x = 0; x < world.w; x++) {
      const t = world.tiles[idx(x, y, world.w)]!;
      if (t.decor === 1) paintTree(g, x * TILE + 16, y * TILE + 28);
    }
  }
  for (const p of POIS) {
    if (p.kind !== "shrine" && p.kind !== "dungeon") continue;
    const at = scaleTile(p.tx, p.ty);
    const x = at.tx * TILE + 16;
    const y = at.ty * TILE + 28;
    if (p.kind === "shrine") paintArena(g, x, y);
    else paintRift(g, x, y);
  }
  world.cache = c;
  return c;
}

type TerrainWindow = {
  canvas: HTMLCanvasElement;
  left: number;
  top: number;
  revision: number;
  tiles: Tile[];
};
// One bounded window per world; abandoned worlds and their canvases can be collected.
const terrainWindows = new WeakMap<WorldData, TerrainWindow>();

/** Reuse static terrain until the camera approaches its edge or new art loads. */
export function drawWorldSlice(
  ctx: CanvasRenderingContext2D,
  world: WorldData,
  camX: number,
  camY: number,
  viewW: number,
  viewH: number,
  zoom: number,
): void {
  const z = Math.max(0.2, zoom);
  const w = viewW / z;
  const h = viewH / z;
  const pad = 150;
  const width = Math.ceil((w + pad * 2) / TILE) * TILE;
  const height = Math.ceil((h + pad * 2) / TILE) * TILE;
  // Bound bitmap memory for extremely large displays / far zooms.
  if (width * height > 4 * 1024 * 1024) {
    paintWorldSlice(ctx, world, camX, camY, viewW, viewH, zoom);
    return;
  }
  const revision = tileImageRevision();
  let cached = terrainWindows.get(world);
  const inset = 80; // Retain room for canopies, shrines and screen shake.
  if (!cached || cached.revision !== revision || cached.tiles !== world.tiles ||
      cached.canvas.width !== width || cached.canvas.height !== height ||
      camX - w / 2 < cached.left + inset ||
      camY - h / 2 < cached.top + inset ||
      camX + w / 2 > cached.left + width - inset ||
      camY + h / 2 > cached.top + height - inset) {
    const canvas = cached?.canvas ?? document.createElement("canvas");
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const g = canvas.getContext("2d")!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, width, height);
    const left = Math.floor((camX - w / 2 - pad) / TILE) * TILE;
    const top = Math.floor((camY - h / 2 - pad) / TILE) * TILE;
    g.imageSmoothingEnabled = false;
    g.translate(-left, -top);
    paintWorldSlice(g, world, left + width / 2, top + height / 2, width, height, 1);
    cached = { canvas, left, top, revision, tiles: world.tiles };
    terrainWindows.set(world, cached);
  }
  ctx.drawImage(cached.canvas, cached.left, cached.top);
}

/** Paint only the camera window. The overworld is too large for one bitmap. */
function paintWorldSlice(
  ctx: CanvasRenderingContext2D,
  world: WorldData,
  camX: number,
  camY: number,
  viewW: number,
  viewH: number,
  zoom: number,
): void {
  const z = Math.max(0.2, zoom);
  const pad = 150;
  const left = camX - viewW / (2 * z) - pad;
  const top = camY - viewH / (2 * z) - pad;
  const right = camX + viewW / (2 * z) + pad;
  const bottom = camY + viewH / (2 * z) + pad;
  const x0 = Math.max(0, Math.floor(left / TILE));
  const y0 = Math.max(0, Math.floor(top / TILE));
  const x1 = Math.min(world.w - 1, Math.ceil(right / TILE));
  const y1 = Math.min(world.h - 1, Math.ceil(bottom / TILE));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = world.tiles[idx(x, y, world.w)]!;
      if (t.sprite && drawAtlasTile(ctx, t.sprite, x * TILE, y * TILE, TILE)) {
        if (t.layers) for (const l of t.layers) drawAtlasTile(ctx, l, x * TILE, y * TILE, TILE);
        continue;
      }
      ctx.fillStyle = FLOOR_COLOR[t.floor] ?? "#333";
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      if ((x + y) % 2 === 0) {
        ctx.fillStyle = "rgba(0,0,0,0.08)";
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
      if (t.floor === 1) {
        ctx.fillStyle = "#3a322c";
        ctx.fillRect(x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = "#1a1412";
        ctx.fillRect(x * TILE + 4, y * TILE + 6, TILE - 8, 6);
      }
      if (t.floor === 3) {
        ctx.fillStyle = "#4a4038";
        ctx.fillRect(x * TILE + 6, y * TILE + 14, 6, 4);
        ctx.fillRect(x * TILE + 18, y * TILE + 14, 6, 4);
      }
      if (t.decor === 2) {
        ctx.fillStyle = "#3a3430";
        ctx.beginPath();
        ctx.ellipse(x * TILE + 16, y * TILE + 18, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (t.decor === 3) {
        ctx.fillStyle = "#8fd06a";
        ctx.fillRect(x * TILE + 14, y * TILE + 16, 2, 8);
        ctx.fillRect(x * TILE + 18, y * TILE + 14, 2, 10);
      } else if (t.decor === 4) {
        ctx.fillStyle = "#e8dcc4";
        ctx.fillRect(x * TILE + 14, y * TILE + 16, 4, 8);
        ctx.fillRect(x * TILE + 12, y * TILE + 14, 8, 3);
      } else if (t.decor === 5 && BIOMES[t.biome] === "ashen") {
        ctx.fillStyle = "#e25a32";
        ctx.fillRect(x * TILE + 15, y * TILE + 18, 2, 6);
      }
      if (t.floor === 2) {
        ctx.fillStyle = "rgba(180,220,255,0.25)";
        ctx.fillRect(x * TILE, y * TILE + 8 + ((x * 3) % 6), TILE, 2);
      }
      if (t.decor === 6) {
        ctx.fillStyle = "#e6c15a";
        ctx.fillRect(x * TILE + 10, y * TILE + 8, 12, 16);
      }
    }
  }
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = world.tiles[idx(x, y, world.w)]!;
      if (t.decor === 1) paintTree(ctx, x * TILE + 16, y * TILE + 28);
    }
  }
  for (const p of POIS) {
    if (p.kind !== "shrine" && p.kind !== "dungeon") continue;
    const at = scaleTile(p.tx, p.ty);
    if (at.tx < x0 - 2 || at.tx > x1 + 2 || at.ty < y0 - 2 || at.ty > y1 + 2) continue;
    const x = at.tx * TILE + 16;
    const y = at.ty * TILE + 28;
    if (p.kind === "shrine") paintArena(ctx, x, y);
    else paintRift(ctx, x, y);
  }
}

/** Nearest walkable, non-water tile to (tx, ty), searching outward in rings. */
function nearestOpenTile(tiles: Tile[], w: number, h: number, tx: number, ty: number): { tx: number; ty: number } | null {
  const ok = (x: number, y: number) => {
    if (x <= 2 || y <= 2 || x >= w - 3 || y >= h - 3) return false;
    const t = tiles[y * w + x]!;
    return t.floor !== 1 && t.floor !== 2 && t.block !== 1;
  };
  if (ok(tx, ty)) return { tx, ty };
  for (let r = 1; r <= 10; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (ok(tx + dx, ty + dy)) return { tx: tx + dx, ty: ty + dy };
    }
  }
  return null;
}

/** Tiles the player can walk to from (x, y), by flood fill. Used so respawned nodes are never stranded. */
export function reachableFrom(world: WorldData, x: number, y: number): Uint8Array {
  const seen = new Uint8Array(world.w * world.h);
  const sx = Math.floor(x / TILE), sy = Math.floor(y / TILE);
  if (sx < 0 || sy < 0 || sx >= world.w || sy >= world.h) return seen;
  const stack: number[] = [sy * world.w + sx];
  seen[stack[0]!] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const cx = i % world.w, cy = (i / world.w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= world.w || ny >= world.h) continue;
      const ni = ny * world.w + nx;
      if (seen[ni] || blocked(world, nx * TILE + 16, ny * TILE + 16)) continue;
      seen[ni] = 1;
      stack.push(ni);
    }
  }
  return seen;
}

/**
 * Pick a spot for a respawned resource node: walkable, reachable, off roads/settlements,
 * clear of other nodes and scenery, and well away from the player so it really is "elsewhere".
 */
export function pickNodeSpot(
  world: WorldData,
  reach: Uint8Array,
  from: { x: number; y: number },
  minDist = 320,
  rng: () => number = Math.random,
): { x: number; y: number } | null {
  const keepClear: { x: number; y: number }[] = [];
  for (const n of world.spawns) if (n.kind === "node") keepClear.push({ x: n.x, y: n.y });
  for (const p of POIS) if ("tx" in p) { const a = scaleTile(p.tx, p.ty); keepClear.push({ x: a.tx * TILE + 16, y: a.ty * TILE + 16 }); }
  for (const n of NPCS) { const a = scaleTile(n.tx, n.ty); keepClear.push({ x: a.tx * TILE + 16, y: a.ty * TILE + 16 }); }
  for (let pass = 0; pass < 2; pass++) {
    for (let tries = 0; tries < 600; tries++) {
      const tx = 4 + Math.floor(rng() * (world.w - 8));
      const ty = 4 + Math.floor(rng() * (world.h - 8));
      const i = ty * world.w + tx;
      if (!reach[i]) continue;
      const t = world.tiles[i]!;
      if (t.block === 1 || t.floor === 1 || t.floor === 2 || t.floor === 3 || t.floor === 9) continue;
      if (pass === 0 && t.decor !== 0) continue;
      const x = tx * TILE + 16, y = ty * TILE + 16;
      if (blocked(world, x, y)) continue;
      if (Math.hypot(x - from.x, y - from.y) < (pass === 0 ? minDist : 128)) continue;
      if (keepClear.some((k) => Math.hypot(k.x - x, k.y - y) < TILE * 3)) continue;
      return { x, y };
    }
  }
  return null;
}

/** Live-drawn resource nodes (ore, mushrooms; trees reuse the world's tree art). */
export function paintNode(g: CanvasRenderingContext2D, node: "ore" | "tree" | "shroom" | "fish", x: number, y: number): void {
  if (node === "tree") return paintTree(g, x, y + 10);
  g.save();
  if (node === "ore") {
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath(); g.ellipse(x, y + 12, 13, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#5b5650";
    g.beginPath(); g.moveTo(x - 13, y + 11); g.lineTo(x - 9, y - 6); g.lineTo(x, y - 13); g.lineTo(x + 10, y - 7); g.lineTo(x + 14, y + 11); g.closePath(); g.fill();
    g.fillStyle = "#7a746c";
    g.beginPath(); g.moveTo(x - 9, y - 6); g.lineTo(x, y - 13); g.lineTo(x + 3, y - 2); g.lineTo(x - 5, y + 2); g.closePath(); g.fill();
    g.fillStyle = "#e6c15a";
    g.fillRect(x - 6, y + 2, 3, 3); g.fillRect(x + 3, y - 4, 3, 3); g.fillRect(x + 6, y + 5, 3, 3);
    g.fillStyle = "#9ad8c8";
    g.fillRect(x - 1, y + 6, 2, 2);
  } else if (node === "shroom") {
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath(); g.ellipse(x, y + 12, 12, 3.5, 0, 0, Math.PI * 2); g.fill();
    const caps: [number, number, number, string][] = [[-7, 4, 6, "#7a5cc8"], [5, 7, 5, "#c8553a"], [0, -2, 7, "#4fa7d9"]];
    for (const [cx, cy, r, c] of caps) {
      g.fillStyle = "#e8dcc4";
      g.fillRect(x + cx - 1, y + cy, 2, 8);
      g.fillStyle = c;
      g.beginPath(); g.arc(x + cx, y + cy, r, Math.PI, 0); g.closePath(); g.fill();
      g.fillStyle = "rgba(255,255,255,0.7)";
      g.fillRect(x + cx - 2, y + cy - r + 2, 2, 2);
    }
  }
  g.restore();
}

function paintTree(g: CanvasRenderingContext2D, x: number, y: number): void {
  if (drawAtlasTile(g, "/MapAssets/04_Trees_and_Vegetation/tree_1_yellow.png", x - 32, y - 64, 64)) return;
  g.fillStyle = "rgba(0,0,0,0.28)";
  g.beginPath();
  g.ellipse(x, y + 4, 34, 10, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#2a180e";
  g.fillRect(x - 7, y - 28, 14, 36);
  g.fillStyle = "#4a2c18";
  g.fillRect(x - 4, y - 46, 4, 18);
  g.fillRect(x + 2, y - 40, 4, 14);
  g.fillStyle = "#1c3e22";
  g.beginPath();
  g.arc(x, y - 58, 46, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#245c2c";
  g.beginPath();
  g.arc(x - 22, y - 70, 28, 0, Math.PI * 2);
  g.arc(x + 24, y - 62, 26, 0, Math.PI * 2);
  g.arc(x, y - 84, 24, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#8fd06a";
  g.fillRect(x - 3, y - 108, 5, 12);
  g.fillRect(x + 16, y - 88, 4, 8);
  g.fillRect(x - 20, y - 78, 4, 7);
}

export function drawRift(g: CanvasRenderingContext2D, x: number, y: number): void {
  if (drawAtlasTile(g, "/MapAssets/06_Gates_and_Portals/enter_abyss.png", x - 32, y - 56, 64)) return;
  g.fillStyle = "rgba(10, 4, 18, 0.45)";
  g.beginPath();
  g.ellipse(x, y + 8, 78, 22, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1a0e28";
  g.beginPath();
  g.moveTo(x - 28, y + 8);
  g.quadraticCurveTo(x - 54, y - 40, x - 18, y - 92);
  g.quadraticCurveTo(x, y - 118, x + 22, y - 88);
  g.quadraticCurveTo(x + 58, y - 36, x + 30, y + 10);
  g.quadraticCurveTo(x, y - 8, x - 28, y + 8);
  g.fill();
  g.fillStyle = "#3a2a88";
  g.beginPath();
  g.moveTo(x - 16, y + 4);
  g.quadraticCurveTo(x - 28, y - 36, x - 8, y - 78);
  g.quadraticCurveTo(x + 2, y - 96, x + 12, y - 74);
  g.quadraticCurveTo(x + 30, y - 30, x + 16, y + 6);
  g.quadraticCurveTo(x, y - 6, x - 16, y + 4);
  g.fill();
  g.fillStyle = "#efe6ff";
  g.beginPath();
  g.ellipse(x, y - 36, 7, 28, -0.08, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#b4a6ff";
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(x - 70, y + 6);
  g.lineTo(x - 36, y - 18);
  g.lineTo(x - 22, y + 10);
  g.moveTo(x + 74, y);
  g.lineTo(x + 34, y - 22);
  g.lineTo(x + 18, y + 8);
  g.stroke();
  g.font = "bold 16px monospace";
  g.textAlign = "center";
  g.fillStyle = "#efe6ff";
  g.fillText("RIFT", x, y - 124);
}

function paintRift(g: CanvasRenderingContext2D, x: number, y: number): void {
  drawRift(g, x, y);
}

function paintArena(g: CanvasRenderingContext2D, x: number, y: number): void {
  g.fillStyle = "rgba(0,0,0,0.28)";
  g.beginPath();
  g.ellipse(x, y + 6, 70, 16, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#8a7560";
  g.fillRect(x - 62, y - 18, 124, 28);
  g.strokeStyle = "#f0e2c8";
  g.lineWidth = 3;
  g.strokeRect(x - 62, y - 18, 124, 28);
  g.fillStyle = "#d9c6a4";
  g.fillRect(x - 54, y - 78, 12, 64);
  g.fillRect(x + 42, y - 78, 12, 64);
  g.fillRect(x - 18, y - 92, 12, 76);
  g.fillRect(x + 6, y - 92, 12, 76);
  g.fillStyle = "#c4473a";
  g.beginPath();
  g.moveTo(x - 72, y - 70);
  g.lineTo(x, y - 118);
  g.lineTo(x + 72, y - 70);
  g.closePath();
  g.fill();
  g.fillStyle = "#e6c15a";
  g.fillRect(x - 3, y - 108, 6, 16);
  g.fillStyle = "#1a1214";
  g.fillRect(x - 12, y - 16, 24, 22);
  g.fillStyle = "#6a4a32";
  g.fillRect(x - 10, y - 14, 20, 18);
  g.fillStyle = "#e6c15a";
  g.fillRect(x - 2, y - 6, 4, 8);
  g.font = "bold 15px monospace";
  g.textAlign = "center";
  g.fillStyle = "#1a1214";
  g.fillText("ARENA", x + 1, y - 123);
  g.fillStyle = "#fff1a8";
  g.fillText("ARENA", x, y - 124);
}

export function buildDungeon(kind: "crypt" | "kiln", seed: number): WorldData {
  const w = kind === "crypt" ? 34 : 30;
  const h = kind === "crypt" ? 22 : 20;
  const tiles: Tile[] = [];
  for (let i = 0; i < w * h; i++) tiles.push({ floor: kind === "crypt" ? 8 : 6, biome: kind === "crypt" ? 4 : 6, block: 1, decor: 0 });
  const rooms =
    kind === "crypt"
      ? [
          [2, 2, 8, 6],
          [14, 2, 8, 6],
          [24, 3, 8, 6],
          [4, 12, 10, 7],
          [18, 11, 13, 8],
        ]
      : [
          [2, 2, 8, 6],
          [12, 3, 8, 5],
          [20, 2, 8, 6],
          [6, 11, 10, 6],
          [16, 10, 12, 8],
        ];
  const carve = (x: number, y: number, rw: number, rh: number) => {
    for (let yy = y; yy < y + rh; yy++) {
      for (let xx = x; xx < x + rw; xx++) {
        const t = tiles[yy * w + xx];
        if (t) t.block = 0;
      }
    }
  };
  for (const r of rooms) carve(r[0]!, r[1]!, r[2]!, r[3]!);
  for (let i = 0; i < rooms.length - 1; i++) {
    const a = rooms[i]!;
    const b = rooms[i + 1]!;
    const x0 = a[0]! + Math.floor(a[2]! / 2);
    const y0 = a[1]! + Math.floor(a[3]! / 2);
    const x1 = b[0]! + Math.floor(b[2]! / 2);
    const y1 = b[1]! + Math.floor(b[3]! / 2);
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      const t = tiles[y0 * w + x];
      if (t) t.block = 0;
      const t2 = tiles[(y0 + 1) * w + x];
      if (t2) t2.block = 0;
    }
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
      const t = tiles[y * w + x1];
      if (t) t.block = 0;
    }
  }
  const rng = mulberry32(seed + (kind === "crypt" ? 3 : 9));
  const spawns: Spawn[] = [];
  const pool = kind === "crypt" ? ["gaikotsu", "muma", "yami", "kage"] : ["onibi", "nobi", "hinotama", "kagaribi"];
  rooms.slice(0, -1).forEach((r, i) => {
    for (let k = 0; k < 2; k++) {
      const species = pool[Math.floor(rng() * pool.length)]!;
      const def = MONSTER_BY_ID[species]!;
      spawns.push({
        id: `${kind}-${i}-${k}`,
        kind: "mob",
        species,
        x: (r[0]! + 2 + k * 3) * TILE,
        y: (r[1]! + 3) * TILE,
        level: (kind === "crypt" ? 8 : 7) + i,
        template: def.template,
        type: def.type,
      });
    }
  });
  const bossRoom = rooms[rooms.length - 1]!;
  spawns.push({
    id: kind === "crypt" ? "bone_king" : "ash_regent",
    kind: "mob",
    species: kind === "crypt" ? "gaikotsu" : "kagaribi",
    boss: true,
    bossId: kind === "crypt" ? "bone_king" : "ash_regent",
    x: (bossRoom[0]! + 6) * TILE,
    y: (bossRoom[1]! + 4) * TILE,
    level: kind === "crypt" ? 18 : 16,
    template: kind === "crypt" ? 22 : 3,
    type: kind === "crypt" ? "ghoul" : "fire",
  });
  return { w, h, tiles, spawns, cache: null };
}

export function blocked(world: WorldData, x: number, y: number): boolean {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) return true;
  if (tx <= 1 || ty <= 1 || tx >= world.w - 2 || ty >= world.h - 2) return true;
  const t = world.tiles[ty * world.w + tx]!;
  if (t.floor === 1 || t.floor === 2) return true;
  if (t.decor > 0) return false;
  return t.block === 1;
}

export function biomeNameAt(world: WorldData, x: number, y: number): BiomeId {
  const tx = Math.max(0, Math.min(world.w - 1, Math.floor(x / TILE)));
  const ty = Math.max(0, Math.min(world.h - 1, Math.floor(y / TILE)));
  return BIOMES[world.tiles[ty * world.w + tx]!.biome] ?? "crown";
}

export const BIOME_LABEL: Record<BiomeId, string> = {
  crown: "Crownfall Citadel",
  verdant: "Verdant Hollow",
  frost: "Frost Marches",
  void: "Void Expanse",
  tide: "Tide Reach",
  ashen: "Ashen Wastes",
  bone: "Bone Garden",
};

export function dungeonExit(): { x: number; y: number } {
  return { x: 4 * TILE, y: 4 * TILE };
}

export const WORLD_RETURN: Record<string, { x: number; y: number }> = {
  crypt: (() => {
    const p = scaleTile(41, 47);
    return { x: p.tx * TILE + 16, y: p.ty * TILE };
  })(),
  kiln: (() => {
    const p = scaleTile(18, 55);
    return { x: p.tx * TILE + 16, y: p.ty * TILE };
  })(),
};

