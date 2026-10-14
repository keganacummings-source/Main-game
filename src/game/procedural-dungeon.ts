import { MONSTER_BY_ID, POIS, TILE, mulberry32 } from "./content";
import type { Spawn, Tile, WorldData } from "./world";
export const DUNGEON_INTERVAL = 600;
export type DungeonPortal = {
  id: `rift-${number}`;
  seed: number;
  level: number;
  x: number;
  y: number;
  cleared: boolean;
  defeated: string[];
};
export type DungeonState = { elapsed: number; sequence: number; portals: DungeonPortal[] };
export function normalizeDungeonState(raw: unknown): DungeonState {
  const s = raw as DungeonState | undefined;
  let sequence = Number.isSafeInteger(s?.sequence) && s!.sequence >= 0 ? s!.sequence : 0;
  const portals = Array.isArray(s?.portals)
    ? s!.portals
        .filter(
          (p) =>
            p &&
            /^rift-\d+$/.test(p.id) &&
            Number.isSafeInteger(Number(p.id.slice(5))) &&
            Number.isSafeInteger(p.seed) &&
            Number.isInteger(p.level) &&
            p.level >= 1 &&
            p.level <= 50 &&
            Number.isFinite(p.x) &&
            Number.isFinite(p.y) &&
            p.x >= 0 &&
            p.y >= 0,
        )
        .map((p) => ({
          ...p,
          cleared: !!p.cleared,
          defeated: Array.isArray(p.defeated)
            ? p.defeated.filter((id) => typeof id === "string")
            : [],
        }))
    : [];
  sequence = Math.max(sequence, ...portals.map((p) => Number(p.id.slice(5))));
  return {
    elapsed: Number.isFinite(s?.elapsed) ? Math.max(0, s!.elapsed) % DUNGEON_INTERVAL : 0,
    sequence,
    portals,
  };
}
export function advanceDungeonClock(state: DungeonState, dt: number): boolean {
  if (!Number.isFinite(dt) || dt <= 0) return false;
  state.elapsed += dt;
  if (state.elapsed < DUNGEON_INTERVAL) return false;
  state.elapsed -= DUNGEON_INTERVAL;
  state.sequence++;
  return true;
}
export function buildProceduralDungeon(seed: number, level: number): WorldData {
  const rng = mulberry32(seed),
    w = 64,
    h = 48;
  const themes = [
    { floor: 8, biome: 4 },
    { floor: 6, biome: 6 },
    { floor: 5, biome: 1 },
  ];
  const theme = themes[Math.floor(rng() * themes.length)]!;
  const tiles: Tile[] = Array.from({ length: w * h }, () => ({ ...theme, block: 1, decor: 0 }));
  const rooms: { x: number; y: number; w: number; h: number }[] = [];
  // Each grid cell holds a differently sized and offset room; every room is joined to the next.
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 4; col++) {
      const cw = 8 + Math.floor(rng() * 5),
        ch = 7 + Math.floor(rng() * 5);
      rooms.push({
        x: col * 15 + 2 + Math.floor(rng() * 2),
        y: row * 15 + 2 + Math.floor(rng() * 2),
        w: cw,
        h: ch,
      });
    }
  const carve = (x: number, y: number) => {
    if (x > 0 && y > 0 && x < w - 1 && y < h - 1) tiles[y * w + x]!.block = 0;
  };
  for (const r of rooms)
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) carve(x, y);
  const center = (r: (typeof rooms)[number]) => ({
    x: r.x + Math.floor(r.w / 2),
    y: r.y + Math.floor(r.h / 2),
  });
  for (let i = 1; i < rooms.length; i++) {
    const a = center(rooms[i - 1]!),
      b = center(rooms[i]!);
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) {
      carve(x, a.y);
      carve(x, a.y + 1);
    }
    for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) {
      carve(b.x, y);
      carve(b.x + 1, y);
    }
  }
  const bosses = POIS.filter((p) => p.kind === "boss");
  const boss = bosses[Math.floor(rng() * bosses.length)]!;
  if (boss.kind !== "boss") throw Error("Missing world boss");
  const def =
    Object.values(MONSTER_BY_ID).find((m) => m.template === boss.template) ?? MONSTER_BY_ID.onibi!;
  const species = def.id;
  const pool = Object.values(MONSTER_BY_ID).filter((m) => m.type === def.type);
  const spawns: Spawn[] = [];
  rooms.slice(1, -1).forEach((r, i) => {
    for (let k = 0; k < 2; k++) {
      const m = pool[Math.floor(rng() * pool.length)] ?? def;
      spawns.push({
        id: `d-${seed}-${i}-${k}`,
        kind: "mob",
        species: m.id,
        level: Math.max(1, level),
        x: (r.x + 2 + k * 3 + 0.5) * TILE,
        y: (r.y + 3 + 0.5) * TILE,
      });
    }
  });
  const end = center(rooms.at(-1)!);
  spawns.push({
    id: `d-${seed}-boss`,
    kind: "mob",
    species,
    boss: true,
    bossId: boss.id,
    level: Math.max(1, level),
    x: (end.x + 0.5) * TILE,
    y: (end.y + 0.5) * TILE,
    dungeonBoss: true,
  });
  tiles.forEach((t, i) => {
    t.sprite = t.block
      ? `/MapAssets/02_Walls_and_Cliffs/brick_dark_${i % 7}.png`
      : `/MapAssets/01_Floor_and_Ground_Tiles/sandstone_floor_${i % 10}.png`;
  });
  const entry = center(rooms[0]!);
  return {
    w,
    h,
    tiles,
    spawns,
    cache: null,
    entry: { x: (entry.x + 0.5) * TILE, y: (entry.y + 0.5) * TILE },
  };
}
