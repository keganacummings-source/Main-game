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
  ).then((loaded) => {
    const next: Partial<Record<SheetId, Atlas>> = {};
    for (const [id, atlas] of loaded) next[id] = atlas;
    atlases = next;
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

  // The chibi class template is ~27px tall (old class art was ~35px), so class sheets draw a bit larger.
  const s = (a.scale ?? 1) * (a.tall ?? 1) * ACTOR_SPRITE_SCALE * (sheet === "warrior" ? 1.3 : 1);
  const fxT = a.time ?? a.walk;

  if (a.setOn && a.setFx) drawSetAura(ctx, a.x, a.y, a.setFx, fxT, s / ACTOR_SPRITE_SCALE, a.setVariant ?? 0);

  // Gear effects are authored for a ~18 unit body; the class sprites are ~27px tall, so scale them to fit.
  const gs = s * (sheet === "warrior" ? GEAR_FIT : 1);
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
  if (a.attack > 0) ctx.translate(4 * a.attack, 0);

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