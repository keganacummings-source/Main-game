/**
 * The main world. Both TurboHunt and Hardcore play on Veilreach (a designer map) as their overworld
 * "world". The classic hand-placed sites (the hearth folk, taverns, shrines, the Tiny Crypt and Ash
 * Kiln doors, the three world bosses) were laid out on an 84×60 chart; here they are re-homed around
 * Veilreach's starting capital in Hearthmere, each snapped to the nearest reachable open tile.
 *
 * Veilreach is embedded in the game, so the overworld never falls back to the old generated world.
 */
import { baseWorldFile } from "./builtin-maps";
import { setTileRemap } from "./content";
import { savedMaps, type MapFile } from "./map-format";
import { reachable } from "./map-tools";
import { relocateClassicSites } from "./world";

export const MAIN_WORLD_ID = "veilreach";

let installedFor: MapFile | null = null;

const OVERRIDE_KEY = "turbz-main-world-v1";

/** The id of a saved designer world chosen to replace Veilreach as the overworld on this device, or "". */
export function mainWorldChoice(): string {
  try {
    return localStorage.getItem(OVERRIDE_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Plays a saved designer world (a generated one, usually) as the overworld on this device. Pass "" to go
 * back to Veilreach. Hunters standing in the old overworld wake at the new world's start the next time
 * they load in.
 */
export function setMainWorldChoice(id: string): void {
  try {
    if (id) localStorage.setItem(OVERRIDE_KEY, id);
    else localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    /* private mode: the choice lasts until the tab closes */
  }
}

function chosenWorld(): MapFile | null {
  const id = mainWorldChoice();
  if (!id) return null;
  const m = savedMaps().find((x) => x.id === id);
  return m && (m.kind ?? "world") === "world" && m.spawn ? m : null;
}

let lifeWorld: MapFile | null = null;

/** The current character's own world (rolled for its life), or null for Veilreach. Set by the engine on load. */
export function setLifeWorld(file: MapFile | null): void {
  lifeWorld = file;
}

/** The map file that is the overworld: this life's own world, else a Map Builder pick, else Veilreach. */
export function mainWorldFile(): MapFile | null {
  const f = lifeWorld ?? chosenWorld() ?? baseWorldFile();
  if (f && f !== installedFor) install(f);
  return f;
}

/** Where a new hunter wakes and where the hearth sends you: the main world's start tile. */
export function mainWorldHearth(): { x: number; y: number } | null {
  const f = mainWorldFile();
  if (!f?.spawn) return null;
  return { x: f.spawn.tx * 32 + 16, y: f.spawn.ty * 32 + 16 };
}

function install(file: MapFile): void {
  installedFor = file;
  const w = file.w, h = file.h;
  const reach = reachable(file);
  const s = file.spawn ?? { tx: Math.floor(w / 2), ty: Math.floor(h / 2) };
  // The starting continent bounds the classic sites.
  const home = (file.regions ?? []).filter((r) => r.kind === "region" && s.tx >= r.tx && s.ty >= r.ty && s.tx < r.tx + r.tw && s.ty < r.ty + r.th)
    .sort((a, b) => a.tw * a.th - b.tw * b.th)[0] ?? { tx: 4, ty: 4, tw: w - 8, th: h - 8 };
  const k = Math.max(1, Math.min(home.tw, home.th) / 100);
  const ix = Math.round(home.tw * 0.12), iy = Math.round(home.th * 0.12);
  const cities = (file.regions ?? []).filter((r) => r.kind === "city");
  const inCity = (x: number, y: number) => cities.some((c) => x >= c.tx && y >= c.ty && x < c.tx + c.tw && y < c.ty + c.th);
  const taken = new Set<number>();
  for (const n of file.npcs ?? []) taken.add(n.ty * w + n.tx);
  for (const it of file.interactables ?? []) taken.add(it.ty * w + it.tx);
  // The home continent: land you can walk to from the start without a ferry. Classic sites stay on it.
  const homeLand = new Uint8Array(w * h);
  {
    const open = (i: number) => { const t = file.tiles[i]!; return !t.block && t.floor !== 1 && t.floor !== 2 && !t.portal; };
    const start = s.ty * w + s.tx;
    const q = [start];
    homeLand[start] = 1;
    while (q.length) {
      const i = q.pop()!;
      const x = i % w, y = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (!homeLand[j] && open(j)) { homeLand[j] = 1; q.push(j); }
      }
    }
  }
  // Continent boxes overlap; a tile belongs to the box whose centre it is closest to (relative to size).
  const lands = (file.regions ?? []).filter((r) => r.kind === "region");
  const ownerIsHome = (x: number, y: number) => {
    let best: (typeof lands)[number] | null = null, bd = Infinity;
    for (const r of lands) {
      if (x < r.tx || y < r.ty || x >= r.tx + r.tw || y >= r.ty + r.th) continue;
      const d = Math.hypot((x - (r.tx + r.tw / 2)) / r.tw, (y - (r.ty + r.th / 2)) / r.th);
      if (d < bd) { bd = d; best = r; }
    }
    return !best || best === home;
  };
  const ok = (x: number, y: number) => {
    if (x < 3 || y < 3 || x >= w - 3 || y >= h - 3) return false;
    const i = y * w + x, t = file.tiles[i]!;
    return !!homeLand[i] && ownerIsHome(x, y) && !!reach[i] && !t.block && t.floor !== 1 && t.floor !== 2 && !t.portal && !taken.has(i);
  };
  const cache = new Map<string, { tx: number; ty: number }>();
  setTileRemap((tx, ty) => {
    const key = `${tx},${ty}`;
    const hit = cache.get(key);
    if (hit) return hit;
    // The classic hearth (30, 33) sits on the new start; everything else keeps its bearing and distance.
    const gx = Math.round(Math.max(home.tx + ix, Math.min(home.tx + home.tw - ix, s.tx + (tx - 30) * k)));
    const gy = Math.round(Math.max(home.ty + iy, Math.min(home.ty + home.th - iy, s.ty + (ty - 33) * k)));
    // Townsfolk near the hearth may stand in the capital; far sites prefer open country.
    const near = Math.hypot(tx - 30, ty - 33) < 8;
    let best: { tx: number; ty: number } | null = null;
    for (let r = 0; r < 60 && !best; r++) {
      let fallback: { tx: number; ty: number } | null = null;
      for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = gx + dx, y = gy + dy;
        if (!ok(x, y)) continue;
        if (near || !inCity(x, y)) { best = { tx: x, ty: y }; break; }
        fallback ??= { tx: x, ty: y };
      }
      if (!best && fallback && r > 20) best = fallback;
    }
    best ??= { tx: s.tx, ty: s.ty };
    taken.add(best.ty * w + best.tx);
    cache.set(key, best);
    return best;
  });
  relocateClassicSites();
}
