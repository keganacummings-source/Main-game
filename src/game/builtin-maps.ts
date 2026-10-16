/**
 * Built-in maps shipped with the game.
 *
 * - Hidden maps (the Green Cave) are only reached through game mechanics.
 * - Veilreach, the base overworld, is embedded in the bundle (src/game/maps/veilreach.json). It can be
 *   opened as a copy in the Map Builder; a copy is never played as the overworld.
 */
import { parseMapJson, savedMaps, type MapFile } from "./map-format";
import { ensureEnemyCoverage } from "./map-gen";
import greenCaveJson from "./maps/greencave.json";
import veilreachJson from "./maps/veilreach.json";

/** Worlds built into the game. Veilreach is the base overworld and ships inside the bundle, so it is always there. */
export const PLAYABLE_WORLDS: { id: string; name: string; about: string }[] = [
  { id: "veilreach", name: "Veilreach", about: "A 500×500 world of seven continents, 41 towns and a main story across the sea." },
];
const playable = new Map<string, MapFile>();
let veilreach: MapFile | null = null;

/** The embedded base world (parsed once). */
export function baseWorldFile(): MapFile | null {
  if (veilreach) return veilreach;
  try {
    veilreach = parseMapJson(veilreachJson);
    // Reachable land with no camp nearby gets one (the same camps every time).
    ensureEnemyCoverage(veilreach);
    playable.set(veilreach.id || "veilreach", veilreach);
  } catch {
    veilreach = null;
  }
  return veilreach;
}

/** Kept for callers that awaited the old fetch: the world is embedded now, so this resolves at once. */
export function loadPlayableWorlds(): Promise<void> {
  baseWorldFile();
  return Promise.resolve();
}

/** Playable built-in worlds. */
export function playableWorlds(): MapFile[] {
  baseWorldFile();
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

/** Last Man Standing plays on Veilreach with every NPC, quest, story, door and ferry taken out. */
export const LMS_MAP_ID = "lms";
let lmsCache: MapFile | null = null;
export function lmsWorldFile(): MapFile | null {
  if (lmsCache) return lmsCache;
  const base = baseWorldFile();
  if (!base) return null;
  lmsCache = {
    ...base,
    id: LMS_MAP_ID,
    name: "Veilreach · Last Man Standing",
    npcs: [],
    quests: [],
    intro: "",
    tiles: base.tiles.map((t) => (t.portal ? { ...t, portal: undefined } : t)),
    // Only resource nodes stay: no boards, shrines, hearths, shops or dungeon doors.
    interactables: (base.interactables ?? []).filter((it) => it.kind === "node"),
  };
  return lmsCache;
}

/** A designer map saved on this device (wins, so your own edits of a world are what you play), a playable world, or a hidden built-in map. */
export function findMapFile(id: string): MapFile | undefined {
  if (id === "veilreach") return baseWorldFile() ?? undefined;
  if (id === LMS_MAP_ID) return lmsWorldFile() ?? undefined;
  return savedMaps().find((m) => m.id === id) ?? playable.get(id) ?? builtinMaps().find((m) => m.id === id);
}
