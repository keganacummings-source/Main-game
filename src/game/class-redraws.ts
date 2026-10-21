import defaultRedraws from "./default-class-redraws.json";
/**
 * Class frame redraws made in Designer Mode > Character Redesigner.
 * Stored on this device; an exported JSON pack is how a redesigned skin ships in a future update
 * that replaces the class sheet frames with these painted frames.
 *
 * Each class has 4 facings × 4 walk frames (frame 0 is the standing pose).
 * Frame keys are "facing-frame" e.g. "down-0", "right-2".
 */
export const FACINGS = ["up", "right", "down", "left"] as const;
export type Facing = typeof FACINGS[number];
export const WALK_FRAMES = 4;
export const FRAME_W = 32;
export const FRAME_H = 44;

export type ClassRedraw = {
  id: string; // class id
  /** data URL PNG for each frame. Missing keys mean "use original sheet". */
  frames: Partial<Record<`${Facing}-${number}`, string>>;
  updated: number;
};

export const REDRAW_KEY = "turbz-class-redraws-v1";

export function frameKey(facing: Facing, frame: number): `${Facing}-${number}` {
  return `${facing}-${frame}`;
}

export function loadRedraws(): ClassRedraw[] {
  // Built-in defaults (e.g. updated Radiant frames) are always available.
  // localStorage overrides win for any id that the player has customized.
  const defaults: ClassRedraw[] = Array.isArray(defaultRedraws)
    ? (defaultRedraws as ClassRedraw[]).filter((p) => p && typeof p.id === "string" && p.frames)
    : [];
  try {
    const raw = localStorage.getItem(REDRAW_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const stored: ClassRedraw[] = Array.isArray(parsed)
      ? parsed.filter((p) => p && typeof p.id === "string" && p.frames)
      : [];
    const map = new Map<string, ClassRedraw>();
    for (const d of defaults) map.set(d.id, d);
    for (const s of stored) map.set(s.id, s);
    return Array.from(map.values());
  } catch {
    return defaults;
  }
}

export function saveRedraws(list: ClassRedraw[]): boolean {
  try { localStorage.setItem(REDRAW_KEY, JSON.stringify(list)); return true; } catch { return false; }
}

export function redrawFor(classId: string): ClassRedraw | undefined {
  return loadRedraws().find((p) => p.id === classId);
}

/** Sheet origin of each class block on /sprites/class_warriors.png (4 frames × 4 facings, 32×44). */
export const CLASS_SHEET_ORIGIN: Record<string, { x: number; y: number }> = {
  warden: { x: 128, y: 0 },
  spellweaver: { x: 256, y: 0 },
  spiritbinder: { x: 384, y: 0 },
  nightblade: { x: 512, y: 0 },
  pathfinder: { x: 640, y: 0 },
  ironpalm: { x: 0, y: 176 },
  bloodrager: { x: 128, y: 176 },
  ghoulknight: { x: 256, y: 176 },
  frostblade: { x: 384, y: 176 },
  pyromancer: { x: 512, y: 176 },
  tidecaller: { x: 640, y: 176 },
  stormrider: { x: 0, y: 352 },
  briarmage: { x: 128, y: 352 },
  lightbringer: { x: 256, y: 352 },
  voidwalker: { x: 384, y: 352 },
  absolver: { x: 512, y: 352 },
  vigilant: { x: 640, y: 352 },
  coinmaster: { x: 0, y: 528 },
  hexbinder: { x: 128, y: 528 },
  corsair: { x: 256, y: 528 },
  warlord: { x: 384, y: 528 },
  nightlord: { x: 512, y: 528 },
  songweaver: { x: 640, y: 528 },
  oathkeeper: { x: 0, y: 704 },
  ronin: { x: 128, y: 704 },
  seraph: { x: 256, y: 704 },
  moonhopper: { x: 384, y: 704 },
  bladedancer: { x: 512, y: 704 },
  sovereign: { x: 640, y: 704 },
  cryinggirl: { x: 0, y: 880 },
  // Additional casters follow the same grid; extend as needed.
  embermage: { x: 128, y: 880 },
  tidewitch: { x: 256, y: 880 },
  stonecaller: { x: 384, y: 880 },
  stormwitch: { x: 512, y: 880 },
  frostweaver: { x: 640, y: 880 },
  radiant: { x: 0, y: 1056 },
  gravemage: { x: 128, y: 1056 },
  arcanist: { x: 256, y: 1056 },
  ruinmage: { x: 384, y: 1056 },
  veilsinger: { x: 512, y: 1056 },
};
