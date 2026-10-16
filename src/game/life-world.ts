/**
 * Life worlds: every new character (and every new life after a death, unless "Keep Current World" is
 * chosen) wakes in a freshly rolled 500×500 world — its own seed, number of lands, towns and islands.
 *
 * Only the seed travels with the save (it is tiny, so it syncs to the cloud with everything else). The
 * world itself is rebuilt from that seed — the generator is deterministic — and cached in IndexedDB, so
 * it opens instantly and stays exactly the same every time the hunter comes back, on this device. It is
 * never re-rolled on load: only when a character is made, or after a death.
 */
import { ensureEnemyCoverage, generateWorld, mainWorldOptions } from "./map-gen";
import { packMap, parseMapJson, savedMaps, type MapFile } from "./map-format";
import { idbAll, idbAvailable, idbDelete, idbPut, STORE_WORLDS } from "./idb-store";

/** Bumped when the generator changes in a way that would make an old seed build a different world. */
export const WORLD_GEN = 1;
/** Worlds kept in the device cache (the rest are rebuilt from their seed if ever needed again). */
const KEEP = 6;

export type LifeWorld = {
  seed: number;
  id: string;
  name: string;
  gen: number;
  /** A Map Builder world chosen for this life instead of a rolled one. */
  map?: string;
};

const cache = new Map<string, { map: MapFile; at: number }>();
/** Cached worlds already checked for enemy coverage this session. */
const toppedUp = new Set<string>();
let ready = false;

/** Loads cached worlds from IndexedDB (call once at startup, alongside the designer map store). */
export async function initLifeWorlds(): Promise<void> {
  if (ready || !idbAvailable()) return;
  try {
    const rows = await idbAll<{ at?: number; map?: unknown }>(STORE_WORLDS);
    for (const row of rows) {
      try {
        const map = parseMapJson(row?.map);
        cache.set(map.id, { map, at: Number(row?.at) || 0 });
      } catch { /* a damaged cache entry is rebuilt from its seed */ }
    }
    ready = true;
  } catch {
    /* no IndexedDB: worlds are rebuilt from their seed each session */
  }
}

const NEXT_KEY = "turbz-next-world-v1";

/** A saved Map Builder world to use for the next new life instead of rolling one (or "" for none). */
export function nextWorldChoice(): string {
  try { return localStorage.getItem(NEXT_KEY) ?? ""; } catch { return ""; }
}
export function setNextWorldChoice(id: string): void {
  try { if (id) localStorage.setItem(NEXT_KEY, id); else localStorage.removeItem(NEXT_KEY); } catch { /* private mode */ }
}

/** Rolls the world for a new life: a random seed, or the Map Builder world queued for it. */
export function rollLifeWorld(): LifeWorld {
  const queued = nextWorldChoice();
  if (queued) {
    const m = savedMaps().find((x) => x.id === queued && (x.kind ?? "world") === "world" && x.spawn);
    setNextWorldChoice("");
    if (m) return { seed: 0, id: m.id, name: m.name, gen: WORLD_GEN, map: m.id };
  }
  const seed = 1 + Math.floor(Math.random() * 2_000_000_000);
  return { seed, id: `life-${seed.toString(36)}`, name: "", gen: WORLD_GEN };
}

/** The map for a life world: the cached copy, a Map Builder world, or rebuilt from the seed. */
export function lifeWorldFile(w: LifeWorld): MapFile | null {
  if (w.map) return savedMaps().find((x) => x.id === w.map) ?? null;
  const hit = cache.get(w.id);
  if (hit) {
    hit.at = Date.now();
    // Worlds cached by older builds had empty stretches with no camps: top them up once (and re-cache).
    if (!toppedUp.has(w.id)) {
      toppedUp.add(w.id);
      if (ensureEnemyCoverage(hit.map) > 0) remember(hit.map);
    }
    return hit.map;
  }
  const map = generateWorld(mainWorldOptions(w.seed, w.name || "New World", w.id));
  // Named after its first land, so every world has a name of its own.
  if (!w.name) {
    const first = (map.regions ?? []).find((r) => r.kind === "region")?.name;
    w.name = first ? `The ${first} Reaches` : `World ${w.seed.toString(36).toUpperCase()}`;
  }
  map.name = w.name;
  toppedUp.add(map.id);
  remember(map);
  return map;
}

function remember(map: MapFile): void {
  cache.set(map.id, { map, at: Date.now() });
  if (idbAvailable()) void idbPut(STORE_WORLDS, map.id, { at: Date.now(), map: packMap(map) }).catch(() => undefined);
  const old = [...cache.entries()].sort((a, b) => b[1].at - a[1].at).slice(KEEP);
  for (const [id] of old) {
    cache.delete(id);
    if (idbAvailable()) void idbDelete(STORE_WORLDS, id).catch(() => undefined);
  }
}

/** Marks the worlds still in use so the cache keeps them (both mode saves can point at one). */
export function touchLifeWorld(id: string | undefined): void {
  const hit = id ? cache.get(id) : undefined;
  if (hit) hit.at = Date.now();
}
