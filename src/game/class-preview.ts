// class-preview.ts
// The character-select portrait: one class drawn in its own clothes, fitted to the card, with no gear FX,
// no set aura and no stretching. The engine's preview() and the picker cards both use this.

import { RACES, type RaceId } from "./content";
import type { ClassId } from "./classes";
import { drawActor } from "./sprites";

/** Class sprites are 44px frames fitted to one 32px tile; this is their on-screen height at scale 1. */
const BODY_PX = 32;

/**
 * Draws `classId` standing (or gently walking when `walking`) on `canvas`, scaled so the body fills
 * about nine tenths of the canvas height, centred, feet a few pixels above the bottom edge.
 */
export function drawClassPreview(canvas: HTMLCanvasElement, race: RaceId, classId: ClassId | undefined, female = true, walking = false): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#1c1412";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // A soft floor shadow so the figure stands on something.
  const foot = canvas.height - Math.round(canvas.height * 0.05);
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, foot, canvas.width * 0.22, canvas.height * 0.025, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.imageSmoothingEnabled = false;
  const r = RACES.find((x) => x.id === race) ?? RACES[0]!;
  const scale = (canvas.height * 0.9) / BODY_PX;
  drawActor(ctx, {
    x: canvas.width / 2,
    y: foot,
    race: r.id,
    classId,
    female,
    hair: r.hair,
    skin: Math.max(0, RACES.findIndex((x) => x.id === r.id)),
    facing: 1,
    direction: "down",
    walk: walking ? performance.now() / 400 : 0,
    moving: walking,
    attack: 0,
    hurt: 0,
    tall: 1,
    scale,
    // No pieces, no set aura: the select screen shows the class, not a gear loadout.
    pieces: [],
    setOn: false,
  } as never);
}
