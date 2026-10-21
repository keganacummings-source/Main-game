// actor-sprites.ts
// Draws actors from the Antifarea charset sheets. Falls back to the procedural
// actor in sprites.ts for the first frames, while the sheets are still loading.

import type { ActorDraw } from "./sprites";
import { drawSetAura } from "./sprites";
import { loadAtlas, drawAtlasSprite, type Atlas } from "./sprite-atlas";
import {
  ACTOR_ATLASES,
  ACTOR_SPRITE_SCALE,
  actorWalkFrame,
  ACTOR_DIRECTION_ROWS,
  charSheet,
  NPC_CHAR_BY_ID,
  RACE_CHARS,
  spriteKey,
  type SheetId,
} from "./actor-sheets.config";
import { CLASS_BY_ID, type ClassId } from "./classes";
import { drawGearFx } from "./gear-fx";
import { WITCH_SIZE } from "./actor-metrics";
import { loadRedraws, FACINGS, WALK_FRAMES, frameKey, FRAME_W, FRAME_H } from "./class-redraws";
import { stripBakedChecker } from "./pixel-edit";

/** Gear effects were tuned for an 18-unit body; class sprites are ~27px tall (27 / 19). */
const GEAR_FIT = 1.4;

let atlases: Partial<Record<SheetId, Atlas>> = {};
let ready = false;

let loading: Promise<void> | null = null;

export function initActorSprites(): Promise<void> {
  if (ready) return Promise.resolve();
  if (loading) return loading;
  loading = Promise.all(
    ACTOR_ATLASES.map(async ({ id, spec }) => [id, await loadAtlas(spec)] as const),
  ).then(async (loaded) => {
    const next: Partial<Record<SheetId, Atlas>> = {};
    for (const [id, atlas] of loaded) next[id] = atlas;
    atlases = next;
    // Frames redrawn in Designer Mode go in before the first draw, so there is no flash of the old art.
    await applyClassRedraws();
    ready = true;
  }).catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

export function actorSpritesReady(): boolean {
  return ready;
}

function decodeRedrawFrame(url: string): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = FRAME_W; c.height = FRAME_H;
        const cx = c.getContext("2d", { willReadFrequently: true });
        if (!cx) return resolve(null);
        cx.imageSmoothingEnabled = false;
        cx.drawImage(img, 0, 0, FRAME_W, FRAME_H);
        const data = cx.getImageData(0, 0, FRAME_W, FRAME_H);
        if (stripBakedChecker(data.data)) cx.putImageData(data, 0, 0);
        resolve(c);
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Paints the frames drawn in Designer Mode > Character Redesigner over the class sheet (this device only).
 * Safe to call again any time: it rebuilds the class-sheet cache, so a reset class goes back to the sheet art.
 */
export async function applyClassRedraws(): Promise<void> {
  const atlas = atlases.warrior;
  if (!atlas) return;
  const overrides: [string, HTMLCanvasElement][] = [];
  for (const entry of loadRedraws()) {
    const charId = `warrior:${entry.id}`;
    if (charSheet(charId) !== "warrior") continue;
    for (const facing of FACINGS) {
      for (let i = 0; i < WALK_FRAMES; i++) {
        const url = entry.frames[frameKey(facing, i)];
        if (!url || !url.startsWith("data:image/")) continue;
        const canvas = await decodeRedrawFrame(url);
        if (canvas) overrides.push([spriteKey(charId, ACTOR_DIRECTION_ROWS[facing], i), canvas]);
      }
    }
  }
  atlas.cache.clear();
  for (const [key, canvas] of overrides) atlas.cache.set(key, canvas);
}

let applyTimer: ReturnType<typeof setTimeout> | undefined;
/** Debounced applyClassRedraws, for the designer to call after every stroke. */
export function applyClassRedrawsSoon(ms = 300): void {
  clearTimeout(applyTimer);
  applyTimer = setTimeout(() => { void applyClassRedraws().catch(() => {}); }, ms);
}

type ActorExtras = { classId?: string; npcId?: string };

function resolveActorChar(a: ActorDraw): string | null {
  const extra = a as ActorDraw & ActorExtras;
  const npc = extra.npcId ? NPC_CHAR_BY_ID[extra.npcId] : undefined;
  if (npc) return npc;
  const cls = extra.classId ? CLASS_BY_ID[extra.classId as ClassId]?.sprite : undefined;
  if (cls) return a.female ? cls.f : cls.m;
  const race = RACE_CHARS[a.race];
  return race ? (a.female ? race.f : race.m) : null;
}

export function tryDrawActorSprite(ctx: CanvasRenderingContext2D, a: ActorDraw): boolean {
  if (!ready) return false;
  const charId = resolveActorChar(a);
  const sheet = charId ? charSheet(charId) : null;
  if (!charId || !sheet) return false;
  const atlas = atlases[sheet];
  if (!atlas) return false;

  // Class/witch frames (32×44) are fitted to one tile, then drawn WITCH_SIZE bigger.
  // 44 * ACTOR_SPRITE_SCALE * WARRIOR_TILE_FIT === 32 * WITCH_SIZE when scale and tall are 1.
  const WARRIOR_TILE_FIT = (32 / 44) / ACTOR_SPRITE_SCALE * WITCH_SIZE;
  const s = (a.scale ?? 1) * (a.tall ?? 1) * ACTOR_SPRITE_SCALE * (sheet === "warrior" ? WARRIOR_TILE_FIT : 1);
  const fxT = a.time ?? a.walk;

  // Gear effects are authored for a ~18 unit body; the class sprites are taller, so scale them to fit.
  // Both this and the aura hang off `s`, so her size (WITCH_SIZE) moves her body and its effects together.
  const gs = s * (sheet === "warrior" ? GEAR_FIT : 1);

  if (a.setOn && a.setFx) drawSetAura(ctx, a.x, a.y, a.setFx, fxT, s / ACTOR_SPRITE_SCALE, a.setVariant ?? 0);
  const dir = a.direction ?? "down";
  // Rows are real facings now: take left/right from the row, and draw "behind the body" effects
  // (wings, tail, ground ring) over the sprite when we are looking at the wearer's back.
  const gearActor = dir === "left" || dir === "right" ? { ...a, facing: dir === "left" ? -1 : 1 } : a;
  if (a.pieces?.length && dir !== "up") drawGearFx(ctx, gearActor, fxT, gs, "back");
  const step = actorWalkFrame(a.walk, a.moving ?? a.walk > 0.2);
  const key = spriteKey(charId, ACTOR_DIRECTION_ROWS[a.direction ?? "down"], Math.abs(step));

  ctx.save();
  ctx.translate(a.x, a.y);
  const bob = a.moving === false ? 0 : Math.sin(a.walk * Math.PI / 2) * 0.5;
  ctx.translate(0, bob);
  // The attack lunge goes the way she faces (it always went right before, even facing left).
  if (a.attack > 0) {
    const d = a.direction ?? "down";
    const lx = d === "left" ? -1 : d === "right" ? 1 : 0, ly = d === "up" ? -1 : d === "down" ? 1 : 0;
    ctx.translate(4 * a.attack * lx, 3 * a.attack * ly);
  }

  const drawn = drawAtlasSprite(ctx, atlas, key, {
    dx: 0,
    dy: 0,
    scale: s,
    // Directional rows already contain the correct orientation.
    flipX: false,
    anchor: "bottom-center",
  });

  if (!drawn) {
    ctx.restore();
    return false;
  }

  if (a.hurt > 0) {
    ctx.globalAlpha = a.hurt * 0.55;
    ctx.fillStyle = "#fff";
    ctx.fillRect(-7 * s, -29 * s, 14 * s, 28 * s);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
  if (a.pieces?.length) {
    if (dir === "up") drawGearFx(ctx, gearActor, fxT, gs, "back");
    drawGearFx(ctx, gearActor, fxT, gs, "front");
  }
  return true;
}