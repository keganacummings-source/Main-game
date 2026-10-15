/**
 * Built-in maps shipped with the game.
 *
 * - Hidden maps (the Green Cave) are only reached through game mechanics.
 * - Playable worlds (Veilreach) are fetched from /Maps at startup, listed in the pause menu, and can
 *   be opened as a copy in the Map Builder.
 */
import { parseMapJson, savedMaps, type MapFile } from "./map-format";
import greenCaveJson from "./maps/greencave.json";

/** Worlds fetched from public/Maps. */
export const PLAYABLE_WORLDS: { id: string; name: string; about: string }[] = [
  { id: "veilreach", name: "Veilreach", about: "A 500×500 world of seven continents, 41 towns and a main story across the sea." },
];
const playable = new Map<string, MapFile>();
let loading: Promise<void> | null = null;

/** Fetches the playable worlds (once). Safe to call many times. */
export function loadPlayableWorlds(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    if (typeof fetch === "undefined") return;
    await Promise.all(PLAYABLE_WORLDS.map(async (w) => {
      try {
        const res = await fetch(`/Maps/${w.id}.json`, { cache: "no-cache" });
        if (!res.ok) return;
        playable.set(w.id, parseMapJson(await res.json()));
      } catch { /* the world stays unavailable */ }
    }));
  })();
  return loading;
}

/** Playable built-in worlds that have loaded. */
export function playableWorlds(): MapFile[] {
  return [...playable.values()];
}

/** The Green Cave (Hardcore, level 30+). Reached only by eating a Green Mushroom. */
export const GREEN_CAVE_ID = "greencave";

let builtinCache: MapFile[] | null = null;
/** Built-in maps, parsed once. Each gets a door home at its arrival point if it has none. */
export function builtinMaps(): MapFile[] {
  if (builtinCache) return builtinCache;
  const out: MapFile[] = [];
  for (const raw of [greenCaveJson]) {
    try {
      const map = parseMapJson(raw);
      const hasExit = (map.interactables ?? []).some((it) => it.kind === "dungeon" && it.mapId === "world");
      if (!hasExit) {
        const sx = map.spawn?.tx ?? 1;
        const sy = map.spawn?.ty ?? 1;
        // Nearest open tile beside the arrival point.
        let at = { tx: sx, ty: sy };
        search: for (let r = 1; r < 6; r++) {
          for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            const tx = sx + dx! * r, ty = sy + dy! * r;
            const t = map.tiles[ty * map.w + tx];
            if (t && !t.block && t.floor !== 1 && t.floor !== 2) { at = { tx, ty }; break search; }
          }
        }
        map.interactables = [...(map.interactables ?? []), { id: `${map.id}-exit`, kind: "dungeon", mapId: "world", tx: at.tx, ty: at.ty, name: "Wake up" }];
      }
      out.push(map);
    } catch {
      /* a broken built-in map is skipped rather than breaking the game */
    }
  }
  builtinCache = out;
  return out;
}

/** Hidden built-in maps (the Green Cave). Playable worlds are not "builtin" in this sense: anyone can walk in. */
export function isBuiltinMap(id: string): boolean {
  return builtinMaps().some((m) => m.id === id);
}

/** A designer map saved on this device (wins, so your own edits of a world are what you play), a playable world, or a hidden built-in map. */
export function findMapFile(id: string): MapFile | undefined {
  return savedMaps().find((m) => m.id === id) ?? playable.get(id) ?? builtinMaps().find((m) => m.id === id);
}
