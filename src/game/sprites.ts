import type { FxId, GhostLook, RaceId, TypeId } from "./content";
import { TYPES } from "./content";
import { motifOf, paintMotif, paintSetAura } from "./fx-paint";
import { drawCreatureSprite } from "./creature-sprites";
import { tryDrawActorSprite } from "./actor-sprites";

export type Pal = { d: string; m: string; l: string; h: string; a: string };

const SKIN: Record<number, Pal> = {
  0: { d: "#6a4038", m: "#c48a78", l: "#f0d2c4", h: "#fff4ee", a: "#e8b0a8" },
  1: { d: "#5a3028", m: "#d09878", l: "#f0c8a8", h: "#ffe8d4", a: "#e07050" },
  2: { d: "#4a3830", m: "#c4a090", l: "#efd8cc", h: "#fff6f0", a: "#7ec8ea" },
  3: { d: "#5a4030", m: "#c89878", l: "#f0d0b0", h: "#fff0e0", a: "#6a9a52" },
  4: { d: "#6a5868", m: "#e0c8d0", l: "#f6e6ee", h: "#ffffff", a: "#b9dcff" },
};

const HAIR: Record<number, string> = {
  0: "#241830",
  1: "#3a140c",
  2: "#163044",
  3: "#243018",
  4: "#d5ecff",
};

export function typePal(t: TypeId): Pal {
  const c = TYPES[t].color;
  return { d: shade(c, -70), m: shade(c, -25), l: c, h: "#fff6e8", a: shade(c, 40) };
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (i: number) => Math.max(0, Math.min(255, ((n >> i) & 255) + amt));
  return `#${[16, 8, 0].map((i) => ch(i).toString(16).padStart(2, "0")).join("")}`;
}

export type ActorDraw = {
  x: number;
  y: number;
  race: RaceId;
  female: boolean;
  hair: number;
  skin: number;
  facing: number;
  direction?: "up" | "right" | "down" | "left";
  moving?: boolean;
  walk: number;
  attack: number;
  hurt: number;
  tall?: number;
  pieces: { slot: string; style: number; type: TypeId; fxSeed: number; quality: number }[];
  setFx: FxId | null;
  setOn: boolean;
  scale?: number;
  ghost?: boolean;
  /** Class id, when the actor knows which class it is. */
  classId?: string;
  /** NPC id from content.NPCS: selects that NPC's sheet character. */
  npcId?: string;
  /** Enchant clock. Keeps motes moving when the body is still. */
  time?: number;
};

const WIDE = 1.28;
const SQUAT = 0.58;
const NECK = -64;
const ARM_X = 6.3;
const ARM_Y = -50;

type WornPiece = ActorDraw["pieces"][number];

function worn(pieces: WornPiece[], slot: string): WornPiece | undefined {
  return pieces.find((p) => p.slot === slot);
}

function edgeFx(
  ctx: CanvasRenderingContext2D,
  piece: WornPiece | undefined,
  t: number,
  spots: { x: number; y: number; rot: number; sc: number }[],
  unsquat: boolean,
): void {
  if (!piece) return;
  spots.forEach((spot, i) => {
    ctx.save();
    ctx.translate(spot.x, spot.y);
    ctx.rotate(spot.rot);
    paintFitted(ctx, { ...piece, fxSeed: piece.fxSeed + i * 17, style: piece.style + i * 3 }, t + i * 0.41, spot.sc, unsquat);
    ctx.restore();
  });
}
function paintFitted(ctx: CanvasRenderingContext2D, piece: WornPiece | undefined, t: number, sc: number, unsquat: boolean): void {
  if (!piece) return;
  const { motif, variant } = motifOf(piece.type, piece.style * 5 + piece.fxSeed + piece.slot.length);
  ctx.save();
  if (unsquat) ctx.scale(0.46 / WIDE, 0.46 / SQUAT);
  paintMotif(ctx, motif, variant, t, piece.fxSeed * 3 + piece.style, typePal(piece.type), sc);
  ctx.restore();
}

export function drawActor(ctx: CanvasRenderingContext2D, a: ActorDraw): void {
  if (tryDrawActorSprite(ctx, a)) return;
  const s = (a.scale ?? 1) * (a.tall ?? 1);
  const skin = SKIN[a.skin] ?? SKIN[0]!;
  const hair = HAIR[a.hair] ?? "#241830";
  const fxT = a.time ?? a.walk;
  if (a.setOn && a.setFx) drawSetAura(ctx, a.x, a.y, a.setFx, fxT, s);
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.scale(a.facing < 0 ? -s * WIDE : s * WIDE, s * SQUAT);
  const bob = Math.sin(a.walk * 8) * (a.walk > 0.2 ? 1.2 : 0.25);
  ctx.translate(0, bob);
  if (a.attack > 0) ctx.translate(4 * a.attack, 0);
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.beginPath();
  ctx.ellipse(0, 3, 11, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();

  const chest = worn(a.pieces, "chest");
  const legs = worn(a.pieces, "legs");
  const feet = worn(a.pieces, "feet");
  const helm = worn(a.pieces, "head");
  const relic = worn(a.pieces, "relic");
  const weapon = worn(a.pieces, "weapon");
  const sleeve = chest ? typePal(chest.type) : null;

  drawArm(ctx, skin, 0, false, sleeve);
  const leg = Math.sin(a.walk * 8) * (a.walk > 0.2 ? 4 : 0.35);
  drawLegs(ctx, skin, leg, a.female, legs, feet);
  if (legs && ((legs.style % 4) + 4) % 4 !== 3) {
    const skirt = ((legs.style % 20) + 20) % 20;
    drawSkirt(ctx, skirt, typePal(legs.type));
    const flare = 8.2 + (skirt % 3) * 0.8;
    edgeFx(
      ctx,
      legs,
      fxT,
      [
        { x: -flare - 1.5, y: -3.2, rot: Math.PI - 0.55, sc: 0.16 },
        { x: flare + 1.5, y: -3.2, rot: -(Math.PI - 0.55), sc: 0.16 },
      ],
      true,
    );
  } else if (legs) {
    edgeFx(
      ctx,
      legs,
      fxT,
      [
        { x: -8.4, y: -6, rot: Math.PI - 0.35, sc: 0.14 },
        { x: 8.4, y: -6, rot: -(Math.PI - 0.35), sc: 0.14 },
      ],
      true,
    );
  }
  if (chest) drawChestArmor(ctx, ((chest.style % 20) + 20) % 20, typePal(chest.type), a.female, chest.fxSeed);
  else {
    drawTorso(ctx, skin, a.female);
    drawRobes(ctx, a.race, a.female);
  }
  if (chest) {
    edgeFx(
      ctx,
      chest,
      fxT,
      [
        { x: -12.4, y: -50, rot: -Math.PI / 2, sc: 0.15 },
        { x: 12.4, y: -50, rot: Math.PI / 2, sc: 0.15 },
      ],
      true,
    );
  }
  if (relic) {
    drawRelicArmor(ctx, ((relic.style % 20) + 20) % 20, typePal(relic.type));
    edgeFx(ctx, relic, fxT, [{ x: -22, y: -30, rot: -Math.PI / 2, sc: 0.13 }], true);
  }
  drawArm(ctx, skin, a.attack, true, sleeve);

  ctx.save();
  ctx.translate(0, NECK);
  ctx.scale(1, WIDE / SQUAT);
  ctx.translate(0, -NECK);
  drawHead(ctx, skin, hair, a.female, a.hair, a.race);
  if (helm) {
    drawHelm(ctx, helm.style, typePal(helm.type));
    edgeFx(
      ctx,
      helm,
      fxT,
      [
        { x: 0, y: -88, rot: 0, sc: 0.13 },
        { x: -12.5, y: -74, rot: -Math.PI / 2, sc: 0.11 },
        { x: 12.5, y: -74, rot: Math.PI / 2, sc: 0.11 },
      ],
      false,
    );
  }
  ctx.restore();

  if (weapon) {
    ctx.save();
    placeFrontHand(ctx, a.attack);
    drawWeapon(ctx, weapon.style, typePal(weapon.type), a.attack, fxT);
    edgeFx(ctx, weapon, fxT, [{ x: 0, y: weaponTip(weapon.style), rot: 0, sc: 0.15 }], false);
    ctx.restore();
  }

  if (feet) {
    edgeFx(
      ctx,
      feet,
      fxT,
      [
        { x: -11.2, y: 1.4, rot: Math.PI - 0.4, sc: 0.12 },
        { x: 11.6, y: 1.4, rot: -(Math.PI - 0.4), sc: 0.12 },
      ],
      true,
    );
  }

  if (a.hurt > 0) {
    ctx.globalAlpha = a.hurt * 0.55;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(0, -36, 12, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function placeFrontHand(ctx: CanvasRenderingContext2D, attack: number): void {
  ctx.translate(ARM_X, ARM_Y);
  ctx.rotate(-0.42 - attack * 1.05);
  ctx.translate(0.2, 9);
  ctx.rotate(0.35 + attack * 0.3);
  ctx.translate(0.2, 16.4);
  ctx.scale(1 / WIDE, 1 / SQUAT);
  ctx.rotate(Math.PI - 1.05);
  ctx.scale(0.74, 0.74);
}

function drawLegs(
  ctx: CanvasRenderingContext2D,
  skin: Pal,
  leg: number,
  female: boolean,
  pants: WornPiece | undefined,
  boots: WornPiece | undefined,
): void {
  const swing = female ? leg * 0.85 : leg * 0.55;
  const hip = female ? 4.2 : 4.5;
  const trousers = !!pants && ((pants.style % 4) + 4) % 4 === 3;
  const cloth = pants ? typePal(pants.type) : null;
  const boot = boots ? typePal(boots.type) : null;
  const drawLeg = (side: number, swingAmt: number) => {
    ctx.save();
    ctx.translate(side * hip, -30);
    ctx.rotate(swingAmt * 0.09);
    ctx.fillStyle = skin.m;
    ctx.beginPath();
    ctx.moveTo(-3.6, 0);
    ctx.quadraticCurveTo(-3.8, 5, -2.8, 9);
    ctx.lineTo(3, 9);
    ctx.quadraticCurveTo(3.8, 5, 3.5, 0);
    ctx.closePath();
    ctx.fill();
    if (trousers && cloth) {
      ctx.fillStyle = cloth.m;
      ctx.beginPath();
      ctx.moveTo(-4.2, -2);
      ctx.lineTo(-3.6, 9.2);
      ctx.lineTo(3.6, 9.2);
      ctx.lineTo(4.1, -2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = cloth.l;
      ctx.fillRect(-2.2, 1, 1.4, 6);
    }
    ctx.fillStyle = skin.l;
    ctx.beginPath();
    ctx.ellipse(0, 9.2, 3.1, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(0, 9);
    ctx.rotate(-swingAmt * 0.06);
    ctx.fillStyle = skin.d;
    ctx.beginPath();
    ctx.moveTo(-2.9, 0);
    ctx.lineTo(-2.4, 18);
    ctx.lineTo(2.7, 18);
    ctx.lineTo(3.1, 0);
    ctx.closePath();
    ctx.fill();
    if (trousers && cloth) {
      ctx.fillStyle = cloth.d;
      ctx.beginPath();
      ctx.moveTo(-3.5, -0.4);
      ctx.lineTo(-3.1, 17.2);
      ctx.lineTo(3.2, 17.2);
      ctx.lineTo(3.6, -0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = cloth.h;
      ctx.fillRect(-3.2, 15.4, 6.4, 1.3);
    }
    const footY = 19.2;
    if (boot) {
      ctx.fillStyle = boot.d;
      ctx.beginPath();
      ctx.ellipse(side > 0 ? 1.5 : 1.2, footY, 5.1, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = boot.m;
      ctx.fillRect(-2.6, 14.4, 5.2, 4.4);
      ctx.fillStyle = boot.h;
      ctx.fillRect(-2.4, 15.2, 4.8, 1.1);
      ctx.fillStyle = boot.a;
      ctx.fillRect(side > 0 ? 2.2 : 0.2, footY - 0.4, 3.2, 1.1);
    } else {
      ctx.fillStyle = skin.m;
      ctx.beginPath();
      ctx.ellipse(side > 0 ? 1.6 : 1.3, footY, 4.6, 2.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };
  drawLeg(-1, swing);
  drawLeg(1, -swing);
}

function drawSkirt(ctx: CanvasRenderingContext2D, s: number, pal: Pal): void {
  const flare = 7.4 + (s % 3) * 0.8;
  const hem = -5;
  ctx.fillStyle = pal.m;
  ctx.beginPath();
  ctx.moveTo(-6.4, -34);
  ctx.lineTo(6.4, -34);
  ctx.lineTo(flare, hem);
  if (s === 14 || s === 18) {
    ctx.lineTo(3.2, hem + 3);
    ctx.lineTo(0, hem - 1);
    ctx.lineTo(-3.4, hem + 3.2);
  }
  ctx.lineTo(-flare, hem);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = pal.h;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = pal.l;
  if (s % 3 === 0) ctx.fillRect(-1.1, -32, 2.2, 22);
  else if (s % 3 === 1) {
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.lineTo(4.2, hem + 1);
    ctx.lineTo(-4.2, hem + 1);
    ctx.fill();
  } else {
    for (let i = 0; i < 4; i++) ctx.fillRect(-6 + i * 3.2, -28, 1, 16);
  }
  ctx.fillStyle = pal.d;
  ctx.fillRect(-flare, hem - 1.4, flare * 2, 1.5);
}

function drawTorso(ctx: CanvasRenderingContext2D, skin: Pal, female: boolean): void {
  ctx.fillStyle = skin.d;
  ctx.beginPath();
  ctx.moveTo(female ? -7 : -8, -32);
  ctx.quadraticCurveTo(0, -24, female ? 7 : 8, -32);
  ctx.lineTo(female ? 5.5 : 6.5, -36);
  ctx.lineTo(female ? -5.5 : -6.5, -36);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = skin.l;
  ctx.beginPath();
  if (female) {
    ctx.moveTo(-5.2, -54);
    ctx.quadraticCurveTo(-8.4, -44, -6.6, -34);
    ctx.lineTo(6.6, -34);
    ctx.quadraticCurveTo(8.4, -44, 5.2, -54);
  } else {
    ctx.moveTo(-8, -54);
    ctx.lineTo(-7, -32);
    ctx.lineTo(7, -32);
    ctx.lineTo(8, -54);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = skin.d;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-5, -51);
  ctx.quadraticCurveTo(0, -47.5, 5, -51);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (female) {
    ctx.fillStyle = skin.m;
    ctx.beginPath();
    ctx.ellipse(-2.6, -44, 2.8, 2.3, -0.15, 0, Math.PI * 2);
    ctx.ellipse(2.6, -44, 2.8, 2.3, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.a;
    ctx.beginPath();
    ctx.ellipse(-2.6, -43.6, 0.7, 0.7, 0, 0, Math.PI * 2);
    ctx.ellipse(2.6, -43.6, 0.7, 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = skin.m;
    ctx.fillRect(-6, -48, 12, 4);
  }
  ctx.fillStyle = skin.l;
  ctx.fillRect(-1.8, -58, 3.6, 12);
}

function drawArm(ctx: CanvasRenderingContext2D, skin: Pal, attack: number, front: boolean, sleeve: Pal | null): void {
  ctx.save();
  ctx.fillStyle = skin.l;
  if (front) {
    ctx.translate(ARM_X, ARM_Y);
    ctx.rotate(-0.42 - attack * 1.05);
  } else {
    ctx.translate(-ARM_X - 0.2, ARM_Y);
    ctx.rotate(0.5);
  }
  ctx.beginPath();
  ctx.moveTo(-2.6, 0);
  ctx.quadraticCurveTo(-3, 5, -2.1, 9);
  ctx.lineTo(2.3, 9);
  ctx.quadraticCurveTo(3, 5, 2.6, 0);
  ctx.closePath();
  ctx.fill();
  if (sleeve) {
    ctx.fillStyle = sleeve.d;
    ctx.beginPath();
    ctx.moveTo(-3.5, 0.2);
    ctx.lineTo(-3.9, 8.4);
    ctx.lineTo(3.7, 8.4);
    ctx.lineTo(3.3, 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = sleeve.m;
    ctx.fillRect(-3.1, 0.6, 6.2, 2.2);
    ctx.fillStyle = sleeve.l;
    ctx.fillRect(-3.3, 6.8, 6.6, 1.4);
  }
  ctx.translate(0.2, 9);
  ctx.rotate(front ? 0.35 + attack * 0.3 : -0.25);
  ctx.fillStyle = skin.m;
  ctx.fillRect(-2.1, 0, 4.2, 14);
  ctx.fillStyle = skin.l;
  ctx.beginPath();
  ctx.ellipse(0.2, 16.2, 2.2, 2.3, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHead(ctx: CanvasRenderingContext2D, skin: Pal, hair: string, female: boolean, hairId: number, race: RaceId): void {
  ctx.fillStyle = skin.l;
  ctx.beginPath();
  ctx.ellipse(0, -68, female ? 7.4 : 7.8, female ? 8.4 : 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin.m;
  ctx.beginPath();
  ctx.ellipse(0, -63.5, 2.2, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff6f0";
  ctx.beginPath();
  ctx.ellipse(-2.7, -69.4, 2.3, 1.7, 0, 0, Math.PI * 2);
  ctx.ellipse(2.8, -69.4, 2.3, 1.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1214";
  ctx.beginPath();
  ctx.ellipse(-2.5, -69.2, 1.05, 1.35, 0, 0, Math.PI * 2);
  ctx.ellipse(3.05, -69.2, 1.05, 1.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillRect(-2.9, -70, 0.8, 0.8);
  ctx.fillRect(2.7, -70, 0.8, 0.8);
  if (female) {
    ctx.strokeStyle = "#1a1214";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-4.6, -70.6);
    ctx.quadraticCurveTo(-2.6, -71.6, -0.8, -70.2);
    ctx.moveTo(0.9, -70.2);
    ctx.quadraticCurveTo(2.8, -71.6, 4.7, -70.6);
    ctx.stroke();
  }
  ctx.fillStyle = skin.a;
  ctx.fillRect(-1.1, -64.4, 2.2, 1.1);
  ctx.strokeStyle = skin.d;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(-1.6, -61.6);
  ctx.quadraticCurveTo(0, -60.6, 1.6, -61.6);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = hair;
  if (!female) {
    ctx.beginPath();
    ctx.ellipse(0, -73, 8.2, 5.2, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-8, -72, 3, 8);
    ctx.fillRect(5.2, -72, 3, 6);
  } else if (race === "vesper" || hairId === 0) {
    ctx.beginPath();
    ctx.ellipse(0, -74, 9, 6.5, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-10.5, -70, 5.5, 14);
    ctx.fillRect(6.2, -70, 4.6, 11);
    ctx.fillStyle = shade(hair, 36);
    ctx.fillRect(-9, -74, 4, 6);
  } else if (race === "cinder" || hairId === 1) {
    ctx.beginPath();
    ctx.moveTo(-8, -66);
    ctx.lineTo(-6, -76);
    ctx.lineTo(-1, -68);
    ctx.lineTo(2, -78);
    ctx.lineTo(7, -66);
    ctx.lineTo(8, -66);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffb15e";
    ctx.fillRect(-5, -76, 2, 5);
    ctx.fillRect(2, -78, 2, 6);
  } else if (race === "tide" || hairId === 2) {
    ctx.fillRect(-9, -76, 18, 8);
    ctx.beginPath();
    ctx.moveTo(6, -68);
    ctx.quadraticCurveTo(16, -52, 6, -46);
    ctx.lineTo(4, -46);
    ctx.quadraticCurveTo(12, -54, 4, -66);
    ctx.fill();
    ctx.fillStyle = "#7ec8ea";
    ctx.beginPath();
    ctx.moveTo(-7, -66);
    ctx.lineTo(-15, -64);
    ctx.lineTo(-7, -60);
    ctx.fill();
  } else if (race === "rime" || hairId === 4) {
    ctx.fillRect(-8.5, -78, 17, 10);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-4, -86, 2, 10);
    ctx.fillRect(3, -84, 2, 8);
    ctx.fillStyle = hair;
    ctx.fillRect(-9, -70, 4, 12);
    ctx.fillRect(6, -70, 3, 9);
  } else {
    ctx.fillRect(-8.5, -77, 17, 9);
    ctx.fillRect(-11, -70, 4.5, 10);
    ctx.fillRect(6.5, -70, 4.5, 10);
    ctx.fillStyle = "#6a9a52";
    ctx.fillRect(7.5, -58, 3, 12);
    ctx.fillRect(-12, -54, 3, 10);
  }
}

function drawRobes(ctx: CanvasRenderingContext2D, race: RaceId, female: boolean): void {
  const ink = race === "cinder" ? "#4a2218" : race === "tide" ? "#163044" : race === "thorn" ? "#243018" : race === "rime" ? "#243044" : "#2a1840";
  const trim = race === "cinder" ? "#e07050" : race === "tide" ? "#7ec8ea" : race === "thorn" ? "#6a9a52" : race === "rime" ? "#b9dcff" : "#b4a6ff";
  ctx.fillStyle = ink;
  ctx.beginPath();
  if (female) {
    ctx.moveTo(-6.2, -55);
    ctx.quadraticCurveTo(-8.6, -44, -7.4, -33);
  } else {
    ctx.moveTo(-8.6, -55);
    ctx.lineTo(-7.6, -33);
  }
  ctx.lineTo(-8.6, -5);
  ctx.lineTo(8.6, -5);
  if (female) {
    ctx.lineTo(7.4, -33);
    ctx.quadraticCurveTo(8.6, -44, 6.2, -55);
  } else {
    ctx.lineTo(7.6, -33);
    ctx.lineTo(8.6, -55);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = trim;
  ctx.fillRect(-6.4, -55, 12.8, 2);
  ctx.fillRect(-1.4, -53, 2.8, 30);
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(0, -40, 2.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillRect(-8.6, -6.4, 17.2, 1.5);
}

function torsoShell(ctx: CanvasRenderingContext2D, female: boolean, pad: number): void {
  const top = -55 - pad * 0.2;
  const bot = -32 + pad * 0.15;
  if (female) {
    ctx.moveTo(-5.6 - pad, top);
    ctx.quadraticCurveTo(-8.8 - pad, -44, -7.2 - pad, bot);
    ctx.lineTo(7.2 + pad, bot);
    ctx.quadraticCurveTo(8.8 + pad, -44, 5.6 + pad, top);
  } else {
    ctx.moveTo(-8.2 - pad, top);
    ctx.lineTo(-7.4 - pad, bot);
    ctx.lineTo(7.4 + pad, bot);
    ctx.lineTo(8.2 + pad, top);
  }
  ctx.closePath();
}

function drawChestArmor(ctx: CanvasRenderingContext2D, s: number, pal: Pal, female: boolean, fx: number): void {
  ctx.save();
  ctx.beginPath();
  torsoShell(ctx, female, 1.15);
  ctx.fillStyle = pal.d;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  torsoShell(ctx, female, -1.1);
  ctx.fillStyle = pal.m;
  ctx.fill();
  if (s === 1 || s === 15 || s === 7) {
    ctx.fillStyle = pal.l;
    for (let i = 0; i < 3; i++) ctx.fillRect(-7, -50 + i * 5, 14, 1.7);
  } else if (s === 2 || s === 11 || s === 16) {
    ctx.fillStyle = pal.h;
    ctx.beginPath();
    ctx.arc(0, -44, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.a;
    ctx.beginPath();
    ctx.arc(0, -44, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (s === 3 || s === 12 || s === 6) {
    ctx.fillStyle = pal.h;
    ctx.beginPath();
    ctx.moveTo(-7.4, -50);
    ctx.lineTo(-4.2, -42);
    ctx.lineTo(-7.4, -36);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(7.4, -50);
    ctx.lineTo(4.2, -42);
    ctx.lineTo(7.4, -36);
    ctx.fill();
  } else if (s === 5 || s === 10) {
    ctx.strokeStyle = pal.h;
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(-3.2 + (i % 2) * 6.4, -50 + i * 4, 2.4, 0, Math.PI);
      ctx.stroke();
    }
  } else if (s === 9 || s === 13) {
    ctx.fillStyle = pal.l;
    ctx.beginPath();
    ctx.moveTo(-6, -50);
    ctx.quadraticCurveTo(-8.4, -42, -5, -34);
    ctx.lineTo(-3.2, -40);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6, -50);
    ctx.quadraticCurveTo(8.4, -42, 5, -34);
    ctx.lineTo(3.2, -40);
    ctx.fill();
  } else if (s === 14 || s === 18) {
    ctx.strokeStyle = pal.h;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-5, -51);
    ctx.lineTo(-3, -34);
    ctx.moveTo(5, -51);
    ctx.lineTo(3, -34);
    ctx.moveTo(0, -52);
    ctx.lineTo(-4.5, -40);
    ctx.lineTo(4.5, -40);
    ctx.closePath();
    ctx.stroke();
  } else if (s === 4 || s === 8 || s === 19) {
    ctx.fillStyle = pal.l;
    ctx.fillRect(-7.2, -55, 14.4, 3.2);
    ctx.fillRect(-2.2, -51, 4.4, 14);
  } else {
    ctx.fillStyle = pal.l;
    ctx.beginPath();
    ctx.moveTo(0, -52);
    ctx.lineTo(5.2, -34);
    ctx.lineTo(-5.2, -34);
    ctx.fill();
  }
  mark(ctx, pal, 0, -43, s);
  ctx.fillStyle = pal.a;
  ctx.beginPath();
  ctx.arc(s % 2 ? -2.4 : 2.4, -46, 1.4 + (fx % 3) * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = pal.h;
  ctx.lineWidth = 1;
  ctx.beginPath();
  torsoShell(ctx, female, 1.15);
  ctx.stroke();
  ctx.fillStyle = pal.d;
  ctx.beginPath();
  ctx.ellipse(-9.4, -50, 3.6, 2.3, -0.35, 0, Math.PI * 2);
  ctx.ellipse(9.4, -50, 3.6, 2.3, 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.h;
  ctx.fillRect(-11.6, -51.1, 3.4, 1.15);
  ctx.fillRect(8.2, -51.1, 3.4, 1.15);
  ctx.restore();
}

function drawRelicArmor(ctx: CanvasRenderingContext2D, s: number, pal: Pal): void {
  ctx.save();
  ctx.strokeStyle = pal.d;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-2, -50);
  ctx.quadraticCurveTo(-10, -42, -14, -32);
  ctx.stroke();
  ctx.fillStyle = pal.l;
  ctx.translate(-14, -30);
  if (s % 5 === 0) {
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (s % 5 === 1) {
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 4);
    ctx.lineTo(-5, 4);
    ctx.fill();
  } else if (s % 5 === 2) {
    ctx.fillRect(-5, -5, 10, 10);
  } else if (s % 5 === 3) {
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 6);
    ctx.lineTo(-6, 0);
    ctx.fill();
  } else {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 4, Math.sin(a) * 4, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = pal.a;
  ctx.beginPath();
  ctx.arc(0, 0, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function mark(ctx: CanvasRenderingContext2D, pal: Pal, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = pal.h;
  ctx.strokeStyle = pal.h;
  ctx.lineWidth = 1.1;
  if (s % 6 === 0) ctx.fillRect(-1, -4, 2, 8);
  else if (s % 6 === 1) {
    ctx.beginPath();
    ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
    ctx.stroke();
  } else if (s % 6 === 2) {
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.lineTo(3, 2);
    ctx.lineTo(-3, 2);
    ctx.fill();
  } else if (s % 6 === 3) ctx.fillRect(-4, -1, 8, 2);
  else if (s % 6 === 4) {
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.lineTo(0, -3);
    ctx.lineTo(3, 0);
    ctx.lineTo(0, 3);
    ctx.stroke();
  } else {
    ctx.fillRect(-3, -3, 2, 2);
    ctx.fillRect(1, 1, 2, 2);
  }
  ctx.restore();
}

function drawHelm(ctx: CanvasRenderingContext2D, style: number, pal: Pal): void {
  ctx.save();
  ctx.translate(0, -70);
  const s = ((style % 20) + 20) % 20;
  ctx.fillStyle = pal.m;
  ctx.strokeStyle = pal.h;
  ctx.lineWidth = 1.1;
  if (s % 5 === 0) {
    ctx.beginPath();
    ctx.moveTo(-6.4, 6);
    ctx.lineTo(0, -10);
    ctx.lineTo(6.4, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (s % 5 === 1) {
    ctx.beginPath();
    ctx.arc(0, 6, 7.6, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = pal.d;
    ctx.fillRect(-6.4, 2, 12.8, 3.2);
  } else if (s % 5 === 2) {
    ctx.fillRect(-7.4, 0, 14.8, 4);
    ctx.fillRect(-8.2, 2, 3.2, 6);
    ctx.fillRect(5, 2, 3.2, 6);
  } else if (s % 5 === 3) {
    ctx.beginPath();
    ctx.moveTo(-6.6, 6);
    ctx.lineTo(-3.2, -4);
    ctx.lineTo(0, 0);
    ctx.lineTo(3.2, -7);
    ctx.lineTo(6.6, 6);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.strokeRect(-6.2, -2, 12.4, 9);
    ctx.fillStyle = pal.a;
    ctx.fillRect(-5, 0, 10, 2.4);
  }
  mark(ctx, pal, 0, s % 5 === 0 ? -2 : -4, s);
  ctx.restore();
}

function weaponTip(style: number): number {
  const kind = ((style % 8) + 8) % 8;
  if (kind === 0) return -17;
  if (kind === 1) return -19;
  if (kind === 2) return -20;
  if (kind === 3) return -24;
  if (kind === 4) return -31;
  if (kind === 5) return -21;
  if (kind === 7) return -19;
  return -23;
}

function drawWeapon(ctx: CanvasRenderingContext2D, style: number, pal: Pal, attack: number, time = 0): void {
  ctx.save();
  const kind = ((style % 8) + 8) % 8;
  const pulse = 0.65 + Math.sin(time * 6) * 0.35;
  ctx.fillStyle = "#4a4038";
  if (kind === 0) {
    ctx.fillRect(-1.2, 0, 2.4, 12);
    ctx.strokeStyle = pal.d;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-7, -16);
    ctx.lineTo(0, -2);
    ctx.lineTo(7, -16);
    ctx.stroke();
    ctx.strokeStyle = pal.h;
    ctx.beginPath();
    ctx.moveTo(-6, -14);
    ctx.quadraticCurveTo(0, -6 - attack * 4, 6, -14);
    ctx.stroke();
    const spark = (Math.sin(time * 7) + 1) / 2;
    ctx.fillStyle = pal.a;
    ctx.beginPath();
    const sx = -6 + spark * 12;
    ctx.moveTo(sx, -16);
    ctx.lineTo(sx + 2.2, -13);
    ctx.lineTo(sx, -10);
    ctx.lineTo(sx - 2.2, -13);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 1) {
    ctx.fillRect(-2, -2, 4, 16);
    ctx.fillStyle = pal.m;
    ctx.fillRect(-10, -6, 20, 3);
    ctx.fillStyle = pal.l;
    ctx.fillRect(-1, -18 - attack * 4, 2, 12);
    ctx.fillStyle = pal.h;
    ctx.fillRect(-9, -7, 3, 5);
    ctx.fillRect(6, -7, 3, 5);
  } else if (kind === 2) {
    ctx.strokeStyle = pal.m;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(-2, -8, 12, -1.15, 1.15);
    ctx.stroke();
    ctx.strokeStyle = pal.h;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2, -19);
    ctx.lineTo(-2 + attack * 3, -8);
    ctx.lineTo(-2, 3);
    ctx.stroke();
    ctx.strokeStyle = pal.l;
    ctx.beginPath();
    ctx.moveTo(-2, -16);
    ctx.lineTo(8, -8);
    ctx.stroke();
    ctx.fillStyle = pal.a;
    ctx.beginPath();
    ctx.moveTo(8, -8);
    ctx.lineTo(4, -6);
    ctx.lineTo(4, -10);
    ctx.fill();
  } else if (kind === 3) {
    ctx.fillRect(-1.4, -2, 2.8, 16);
    ctx.fillStyle = pal.l;
    ctx.beginPath();
    ctx.moveTo(-2, -4);
    ctx.quadraticCurveTo(-16, -18, -4, -24);
    ctx.quadraticCurveTo(2, -16, 3, -4);
    ctx.fill();
    ctx.fillStyle = pal.h;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.moveTo(-4, -8);
    ctx.lineTo(-12, -16);
    ctx.lineTo(-6, -10);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (kind === 4) {
    ctx.fillStyle = pal.d;
    ctx.fillRect(-1.6, -4, 3.2, 18);
    ctx.fillStyle = pal.l;
    ctx.beginPath();
    ctx.moveTo(0, -30 - pulse * 3);
    ctx.lineTo(6.5, -16);
    ctx.lineTo(0, -5);
    ctx.lineTo(-6.5, -16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.h;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(2.1, -16);
    ctx.lineTo(0, -9);
    ctx.lineTo(-2.1, -16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.a;
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + (i - 1.5) * 0.55;
      const len = 7 + Math.sin(time * 8 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 3, -16 + Math.sin(a) * 3);
      ctx.lineTo(Math.cos(a) * len, -16 + Math.sin(a) * len);
      ctx.stroke();
    }
  } else if (kind === 5) {
    ctx.fillStyle = pal.d;
    ctx.fillRect(-8, -16, 16, 12);
    ctx.fillStyle = pal.l;
    const page = Math.sin(time * 4) * 3;
    ctx.beginPath();
    ctx.moveTo(-7, -15);
    ctx.quadraticCurveTo(0, -20 - page, 7, -15);
    ctx.lineTo(7, -6);
    ctx.lineTo(-7, -6);
    ctx.fill();
    ctx.fillStyle = pal.h;
    ctx.fillRect(-5, -13, 4, 1);
    ctx.fillRect(-5, -10, 6, 1);
    ctx.strokeStyle = pal.a;
    ctx.globalAlpha = 0.5 + pulse * 0.5;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-2, -20);
    ctx.lineTo(1, -16 - pulse * 3);
    ctx.lineTo(4, -21);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (kind === 7) {
    ctx.strokeStyle = pal.l;
    ctx.lineWidth = 2.2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 3, 2);
      ctx.quadraticCurveTo(i * 6, -8, i * 4 + Math.sin(time * 8 + i) * 1.5, -18 - attack * 4);
      ctx.stroke();
    }
    ctx.strokeStyle = pal.d;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-4, 3);
    ctx.quadraticCurveTo(0, 6, 4, 3);
    ctx.stroke();
    ctx.fillStyle = pal.a;
    ctx.fillRect(-1.4, 2, 2.8, 3);
  } else {
    ctx.fillRect(-1.3, 0, 2.6, 14);
    ctx.fillStyle = pal.h;
    ctx.fillRect(-2.4, -1, 4.8, 2);
    ctx.fillStyle = pal.l;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(2.6, -2);
    ctx.lineTo(-2.6, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.a;
    ctx.globalAlpha = pulse;
    ctx.fillRect(-1, -16, 2, 8);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function drawSetAura(ctx: CanvasRenderingContext2D, x: number, y: number, fx: FxId, t: number, scale = 1): void {
  ctx.save();
  ctx.translate(x, y);
  paintSetAura(ctx, fx, t, scale, fxColor(fx));
  ctx.restore();
}

export function fxColor(fx: FxId): string {
  switch (fx) {
    case "voidring":
      return "#6a4cff";
    case "solarnova":
      return "#ffb15e";
    case "tidalsurge":
      return "#3a7eb8";
    case "briarburst":
      return "#6ecf6a";
    case "whitestorm":
      return "#d6ecff";
    case "gravepulse":
      return "#c4473a";
    case "stormcrown":
      return "#f2d43a";
    case "lanternwake":
      return "#fff1a8";
    case "featherfall":
      return "#e7d9ff";
    case "bloodmoon":
      return "#ff4d6a";
    default:
      return "#fff";
  }
}

export type MonsterDraw = {
  x: number;
  y: number;
  template: number;
  type: TypeId;
  facing: number;
  walk: number;
  hurt: number;
  boss: boolean;
  rarity: number;
  ghost?: boolean;
  animal?: boolean;
  species?: string;
  look?: GhostLook | null;
  time?: number;
};

const SHAPE: { body: number; legs: number; wings: number; horns: number; tail: number; eyes: number; crown: number }[] = [
  { body: 0, legs: 0, wings: 0, horns: 0, tail: 1, eyes: 2, crown: 0 },
  { body: 1, legs: 2, wings: 0, horns: 2, tail: 1, eyes: 2, crown: 0 },
  { body: 0, legs: 0, wings: 0, horns: 0, tail: 0, eyes: 1, crown: 0 },
  { body: 2, legs: 0, wings: 0, horns: 0, tail: 0, eyes: 2, crown: 1 },
  { body: 3, legs: 0, wings: 0, horns: 0, tail: 0, eyes: 2, crown: 0 },
  { body: 4, legs: 0, wings: 0, horns: 0, tail: 1, eyes: 2, crown: 0 },
  { body: 5, legs: 0, wings: 1, horns: 0, tail: 1, eyes: 2, crown: 0 },
  { body: 2, legs: 2, wings: 0, horns: 0, tail: 0, eyes: 1, crown: 1 },
  { body: 6, legs: 2, wings: 0, horns: 0, tail: 0, eyes: 2, crown: 0 },
  { body: 1, legs: 2, wings: 1, horns: 1, tail: 0, eyes: 2, crown: 0 },
  { body: 7, legs: 0, wings: 0, horns: 0, tail: 2, eyes: 2, crown: 0 },
  { body: 5, legs: 4, wings: 0, horns: 0, tail: 1, eyes: 3, crown: 0 },
  { body: 1, legs: 2, wings: 0, horns: 0, tail: 0, eyes: 2, crown: 1 },
  { body: 5, legs: 4, wings: 0, horns: 2, tail: 1, eyes: 2, crown: 0 },
  { body: 8, legs: 0, wings: 2, horns: 1, tail: 1, eyes: 2, crown: 0 },
  { body: 0, legs: 0, wings: 1, horns: 0, tail: 0, eyes: 1, crown: 2 },
  { body: 7, legs: 0, wings: 0, horns: 2, tail: 1, eyes: 4, crown: 0 },
  { body: 1, legs: 2, wings: 0, horns: 2, tail: 1, eyes: 2, crown: 0 },
  { body: 2, legs: 0, wings: 0, horns: 0, tail: 0, eyes: 1, crown: 2 },
  { body: 6, legs: 4, wings: 0, horns: 3, tail: 0, eyes: 5, crown: 0 },
  { body: 1, legs: 2, wings: 1, horns: 0, tail: 0, eyes: 2, crown: 1 },
  { body: 6, legs: 2, wings: 0, horns: 1, tail: 2, eyes: 2, crown: 0 },
  { body: 9, legs: 2, wings: 0, horns: 0, tail: 0, eyes: 2, crown: 0 },
  { body: 0, legs: 0, wings: 2, horns: 0, tail: 1, eyes: 1, crown: 0 },
  { body: 1, legs: 2, wings: 2, horns: 2, tail: 0, eyes: 2, crown: 2 },
];

function drawGhost(ctx: CanvasRenderingContext2D, m: MonsterDraw, pal: Pal, sc: number): void {
  const look = m.look ?? {
    body: m.template % 6,
    horns: m.rarity % 3,
    tails: 1 + (m.rarity % 3),
    eyes: 2,
    trail: m.template % 6,
    skin: m.type.length % 5,
    aggression: "hunt" as const,
    move: "",
  };
  const t = m.time ?? m.walk;
  const wave = Math.sin(t * 5);
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.scale((m.facing < 0 ? -1 : 1) * sc, sc);
  ctx.translate(0, Math.sin(t * 3) * (2 + look.body));
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 6, 14 + look.tails * 2, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = m.hurt > 0 ? 1 : 0.9;
  if (look.skin === 0) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = pal.h;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-16, -10 - i * 10 + ((t * 20) % 10));
      ctx.lineTo(16, -14 - i * 10 + ((t * 20) % 10));
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.fillStyle = pal.l;
  if (look.body === 1) {
    ctx.beginPath();
    ctx.arc(0, -28, 16 + look.eyes, 0, Math.PI * 2);
    ctx.fill();
  } else if (look.body === 2) {
    ctx.fillRect(-8, -58, 16, 40);
    ctx.beginPath();
    ctx.arc(0, -60, 10, 0, Math.PI * 2);
    ctx.fill();
  } else if (look.body === 3) {
    ctx.beginPath();
    ctx.ellipse(0, -24, 20, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.d;
    ctx.beginPath();
    ctx.ellipse(0, -20, 10, 5 + wave, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = pal.l;
  } else if (look.body === 4) {
    ctx.beginPath();
    ctx.arc(-8, -30, 10, 0, Math.PI * 2);
    ctx.arc(8, -26, 9, 0, Math.PI * 2);
    ctx.fill();
  } else if (look.body === 5) {
    ctx.strokeStyle = pal.l;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-6, 2);
    ctx.quadraticCurveTo(16, -10, 4, -28);
    ctx.quadraticCurveTo(-14, -40, 0, -52);
    ctx.stroke();
    ctx.fillStyle = pal.l;
    ctx.beginPath();
    ctx.arc(0, -54, 8, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.quadraticCurveTo(-18, -36, -8, -58);
    ctx.quadraticCurveTo(0, -70, 9, -58);
    ctx.quadraticCurveTo(18, -36, 14, -8);
    for (let i = 0; i < look.tails + 2; i++) {
      const x = -12 + i * (24 / (look.tails + 2));
      ctx.lineTo(x + 4, -2 + wave * 3 * (i % 2 ? 1 : -1));
      ctx.lineTo(x, -12);
    }
    ctx.closePath();
    ctx.fill();
  }
  if (look.skin === 1) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = pal.h;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-10 + i * 8, -8);
      ctx.quadraticCurveTo(-6 + i * 5, -28 + wave * 5, -2 + i * 3, -50);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.fillStyle = pal.d;
  for (let i = 0; i < look.horns; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(side * 4, -52);
    ctx.quadraticCurveTo(side * (10 + i * 3), -70 - i * 2, side * (4 + i), -78 - (look.horns > 2 ? 6 : 0));
    ctx.lineTo(side * 2, -50);
    ctx.fill();
  }
  ctx.strokeStyle = pal.a;
  ctx.lineWidth = 2;
  for (let i = 0; i < look.tails; i++) {
    const spread = (i - (look.tails - 1) / 2) * 8;
    ctx.beginPath();
    ctx.moveTo(spread, -8);
    ctx.quadraticCurveTo(spread + 16, 4 + wave * 4, spread + 8, 12 + Math.sin(t * 4 + i) * 4);
    ctx.stroke();
  }
  const eyes = Math.max(1, look.eyes);
  for (let i = 0; i < eyes; i++) {
    const ex = (i - (eyes - 1) / 2) * 6;
    ctx.fillStyle = "#140e0c";
    ctx.beginPath();
    ctx.ellipse(ex, -44, 2.2, 3.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.h;
    ctx.fillRect(ex - 0.6, -45, 1.2, 1.4);
  }
  ctx.save();
  ctx.translate(0, -34);
  const cast = motifOf(m.type, look.trail + m.template);
  paintMotif(ctx, cast.motif, cast.variant, t, m.template * 5 + look.trail, pal, 0.78 + m.rarity * 0.06);
  ctx.restore();
  if (look.aggression === "hunt") {
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#ff4d6a";
    ctx.fillRect(-2, -66, 4, 4);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function limb(ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, w: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.lineTo(x, y1);
  ctx.stroke();
}

function hoof(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, 3.2, 1.8, 0, 0, Math.PI * 2);
  ctx.fill();
}

const BEAST_W: Record<string, number> = { hare: 52, boar: 76, stag: 84, wolf: 78, crow: 46 };
const beastCache: Record<string, HTMLImageElement[]> = {};

function beastFrames(id: string): HTMLImageElement[] | null {
  if (typeof Image === "undefined") return null;
  if (!beastCache[id]) {
    beastCache[id] = [0, 1, 2, 3].map((i) => {
      const img = new Image();
      img.decoding = "async";
      img.src = `/beasts/${id}-${i}.png`;
      return img;
    });
  }
  const set = beastCache[id];
  if (!set.every((img) => img.complete && img.naturalWidth > 0)) return null;
  return set;
}

function drawBeast(ctx: CanvasRenderingContext2D, m: MonsterDraw): void {
  const id = m.species ?? "hare";
  const sc = (m.boss ? 1.35 : 1) * (1 + Math.min(0.18, m.rarity * 0.03));
  const frames = beastFrames(id);
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.scale((m.facing < 0 ? -1 : 1) * sc, sc);
  ctx.fillStyle = "rgba(20,14,12,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 2, id === "stag" || id === "boar" ? 18 : 12, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (frames) {
    const fr = frames[Math.abs(Math.floor(m.walk * 2.4)) % frames.length]!;
    const dw = BEAST_W[id] ?? 64;
    const dh = dw * (fr.naturalHeight / fr.naturalWidth);
    const foot = (5 / fr.naturalHeight) * dh;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fr, -dw * 0.42, 3 - dh + foot, dw, dh);
  } else {
    const gait = Math.sin(m.walk * 9);
    if (id === "hare") drawHare(ctx, gait);
    else if (id === "boar") drawBoar(ctx, gait);
    else if (id === "stag") drawStag(ctx, gait);
    else if (id === "wolf") drawWolf(ctx, gait);
    else drawCrow(ctx, gait);
  }
  if (m.hurt > 0) {
    ctx.globalAlpha = m.hurt * 0.4;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(0, -16, 20, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHare(ctx: CanvasRenderingContext2D, gait: number): void {
  const fur = "#c4a06a";
  const dark = "#8a623c";
  const belly = "#f3e2c4";
  limb(ctx, -8, -12, -1 + gait * 2, 2.4, dark);
  limb(ctx, -2, -11, 0 - gait * 2, 2.2, dark);
  limb(ctx, 8, -12, 0 - gait * 2, 2.2, fur);
  limb(ctx, 13, -11, -1 + gait * 2, 2, fur);
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(-1, -16, 13, 8, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = belly;
  ctx.beginPath();
  ctx.ellipse(1, -13, 8, 4.2, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f7f1e6";
  ctx.beginPath();
  ctx.arc(-12, -16, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(12, -20, 7, 6.2, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(8, -30, 2.1, 8, -0.25, 0, Math.PI * 2);
  ctx.ellipse(12, -31, 2.1, 9, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e7b4b0";
  ctx.beginPath();
  ctx.ellipse(8.4, -30, 0.8, 5, -0.25, 0, Math.PI * 2);
  ctx.ellipse(11.6, -31, 0.8, 5.4, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1210";
  ctx.beginPath();
  ctx.ellipse(15.5, -21, 1.3, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c46a6a";
  ctx.beginPath();
  ctx.ellipse(18.2, -18.5, 1.3, 0.9, 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoar(ctx: CanvasRenderingContext2D, gait: number): void {
  const hide = "#6a4030";
  const dark = "#3e261c";
  limb(ctx, -12, -12, 1 + gait * 1.5, 3.4, dark);
  limb(ctx, -4, -12, 1 - gait * 1.5, 3.4, dark);
  limb(ctx, 8, -12, 1 - gait, 3.2, hide);
  limb(ctx, 15, -11, 1 + gait, 3.2, hide);
  hoof(ctx, -12, 2 + gait * 1.5, "#2a1c14");
  hoof(ctx, 15, 2 + gait, "#2a1c14");
  ctx.fillStyle = hide;
  ctx.beginPath();
  ctx.ellipse(0, -16, 18, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, -24);
  ctx.lineTo(-4, -20);
  ctx.lineTo(2, -25);
  ctx.lineTo(8, -20);
  ctx.lineTo(14, -24);
  ctx.stroke();
  ctx.fillStyle = "#8a5840";
  ctx.beginPath();
  ctx.ellipse(16, -15, 9, 7, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c4a070";
  ctx.beginPath();
  ctx.ellipse(24, -13, 4.2, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f0e2c4";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(18, -12);
  ctx.quadraticCurveTo(24, -6, 22, -10);
  ctx.moveTo(16, -11);
  ctx.quadraticCurveTo(21, -4, 19, -9);
  ctx.stroke();
  ctx.fillStyle = "#1a1210";
  ctx.beginPath();
  ctx.ellipse(20, -17, 1.2, 1.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-16, -14, 3.5, 0.4, 5);
  ctx.stroke();
}

function drawStag(ctx: CanvasRenderingContext2D, gait: number): void {
  const hide = "#8d5a32";
  const dark = "#5c3a22";
  limb(ctx, -10, -20, 1 + gait * 3, 2.2, dark);
  limb(ctx, -3, -20, 1 - gait * 3, 2.2, dark);
  limb(ctx, 8, -20, 1 - gait * 3, 2.1, hide);
  limb(ctx, 14, -19, 1 + gait * 3, 2.1, hide);
  hoof(ctx, -10, 2 + gait * 3, "#2a1c14");
  hoof(ctx, 14, 2 + gait * 3, "#2a1c14");
  ctx.fillStyle = hide;
  ctx.beginPath();
  ctx.ellipse(-1, -24, 16, 7, -0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f4efe4";
  ctx.beginPath();
  ctx.ellipse(-14, -22, 2.4, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hide;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(10, -26);
  ctx.quadraticCurveTo(16, -30, 18, -38);
  ctx.stroke();
  ctx.fillStyle = hide;
  ctx.beginPath();
  ctx.ellipse(20, -40, 5.5, 4.2, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#d8c4a4";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(18, -43);
  ctx.lineTo(14, -52);
  ctx.moveTo(16, -48);
  ctx.lineTo(12, -50);
  ctx.moveTo(20, -44);
  ctx.lineTo(24, -54);
  ctx.moveTo(22, -49);
  ctx.lineTo(26, -51);
  ctx.stroke();
  ctx.fillStyle = "#1a1210";
  ctx.beginPath();
  ctx.ellipse(22.5, -40.5, 1.1, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1210";
  ctx.beginPath();
  ctx.ellipse(24.5, -38.5, 1.1, 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawWolf(ctx: CanvasRenderingContext2D, gait: number): void {
  const fur = "#7a7e86";
  const dark = "#3e424a";
  limb(ctx, -10, -16, 1 + gait * 2.4, 2.6, dark);
  limb(ctx, -3, -16, 1 - gait * 2.4, 2.6, dark);
  limb(ctx, 8, -15, 1 - gait * 2.4, 2.4, fur);
  limb(ctx, 14, -14, 1 + gait * 2.4, 2.4, fur);
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(-1, -20, 16, 8, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c8ccd2";
  ctx.beginPath();
  ctx.ellipse(2, -16, 8, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-14, -18);
  ctx.quadraticCurveTo(-26, -28 + gait * 2, -22, -12);
  ctx.stroke();
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(16, -26, 7, 5.5, 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(18, -24);
  ctx.lineTo(28, -22);
  ctx.lineTo(18, -20);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(12, -30);
  ctx.lineTo(14, -36);
  ctx.lineTo(17, -29);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(16, -30);
  ctx.lineTo(19, -37);
  ctx.lineTo(21, -28);
  ctx.fill();
  ctx.fillStyle = "#1a1210";
  ctx.beginPath();
  ctx.ellipse(19, -27, 1.15, 1.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1210";
  ctx.beginPath();
  ctx.ellipse(26.5, -21.6, 1.1, 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrow(ctx: CanvasRenderingContext2D, gait: number): void {
  const ink = "#1c1a22";
  const sheen = "#3a3a48";
  limb(ctx, 2, -8, 1, 1.4, ink);
  limb(ctx, 7, -8, 1, 1.4, ink);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(1, 1);
  ctx.lineTo(-1, 3);
  ctx.moveTo(8, 1);
  ctx.lineTo(10, 3);
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.ellipse(0, -16, 12, 7, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.ellipse(-2, -18, 7, 3.2, -0.4, 0, Math.PI * 2);
  ctx.fill();
  const flap = gait * 6;
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(-2, -16);
  ctx.quadraticCurveTo(-16, -24 - flap, -8, -10);
  ctx.quadraticCurveTo(-10, -14, 2, -12);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(-10, -14);
  ctx.lineTo(-20, -12 + gait);
  ctx.lineTo(-16, -8);
  ctx.lineTo(-8, -10);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(10, -20, 5.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e6c15a";
  ctx.beginPath();
  ctx.moveTo(14, -20);
  ctx.lineTo(22, -18.5);
  ctx.lineTo(14, -17);
  ctx.fill();
  ctx.fillStyle = "#f2d43a";
  ctx.beginPath();
  ctx.arc(12.2, -21.2, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#140e0c";
  ctx.beginPath();
  ctx.arc(12.4, -21.2, 0.45, 0, Math.PI * 2);
  ctx.fill();
}

export function drawMonster(ctx: CanvasRenderingContext2D, m: MonsterDraw): void {
  drawCreatureSprite(ctx, m);
}

export function drawShadowName(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  ctx.font = "16px VT323, monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "#140e0c";
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

const GEAR_TYPES = ["fire", "water", "earth", "ice", "light", "void", "electric", "air"] as const;

/** Contact sheet used to check that each worn piece sits on its body region. */
export function paintGearCatalog(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = "#140e0c";
  ctx.fillRect(0, 0, w, h);
  const slots = ["head", "chest", "legs", "feet", "relic", "weapon"] as const;
  const cols = 4;
  const cellW = w / cols;
  const cellH = h / (slots.length + 1);
  ctx.font = "14px VT323, monospace";
  ctx.textAlign = "left";
  slots.forEach((slot, row) => {
    for (let col = 0; col < cols; col++) {
      const style = col * 5 + row;
      ctx.save();
      ctx.translate(col * cellW + cellW * 0.5, row * cellH + cellH * 0.86);
      ctx.scale(1.15, 1.15);
      drawActor(ctx, {
        x: 0,
        y: 0,
        race: "vesper",
        female: true,
        hair: 0,
        skin: 1,
        facing: 1,
        walk: 0.15,
        attack: slot === "weapon" ? 0.35 : 0,
        hurt: 0,
        pieces: [{ slot, style, type: GEAR_TYPES[(col + row) % GEAR_TYPES.length]!, fxSeed: style * 3 + 2, quality: 4 }],
        setFx: null,
        setOn: false,
        time: 0.8 + col * 0.4,
      });
      ctx.restore();
      ctx.fillStyle = "#e6c15a";
      ctx.fillText(`${slot} ${style}`, col * cellW + 8, row * cellH + 16);
    }
  });
  for (let col = 0; col < cols; col++) {
    const row = slots.length;
    ctx.save();
    ctx.translate(col * cellW + cellW * 0.5, row * cellH + cellH * 0.86);
    ctx.scale(1.15, 1.15);
    drawActor(ctx, {
      x: 0,
      y: 0,
      race: "cinder",
      female: true,
      hair: 1,
      skin: 2,
      facing: 1,
      walk: 0.2,
      attack: 0.2,
      hurt: 0,
      pieces: slots.map((slot, i) => ({
        slot,
        style: col * 3 + i * 2,
        type: GEAR_TYPES[(col + i) % GEAR_TYPES.length]!,
        fxSeed: 4 + i * 5 + col,
        quality: 4,
      })),
      setFx: null,
      setOn: false,
      time: 1.4,
    });
    ctx.restore();
    ctx.fillStyle = "#fff6e8";
    ctx.fillText(`full kit ${col + 1}`, col * cellW + 8, row * cellH + 16);
  }
}

if (typeof window !== "undefined") {
  const hook = window as unknown as { __paintGear?: typeof paintGearCatalog; __paintFit?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void };
  hook.__paintGear = paintGearCatalog;
  hook.__paintFit = (ctx, w, h) => {
    ctx.fillStyle = "#140e0c";
    ctx.fillRect(0, 0, w, h);
    for (let col = 0; col < 3; col++) {
      ctx.save();
      ctx.translate((col + 0.5) * (w / 3), h * 0.86);
      ctx.scale(2.4, 2.4);
      drawActor(ctx, {
        x: 0,
        y: 0,
        race: col === 1 ? "cinder" : "vesper",
        female: true,
        hair: col,
        skin: col,
        facing: 1,
        walk: 0.2,
        attack: 0.15,
        hurt: 0,
        pieces: (["head", "chest", "legs", "feet", "relic", "weapon"] as const).map((slot, i) => ({
          slot,
          style: col * 4 + i * 3,
          type: GEAR_TYPES[(col * 2 + i) % GEAR_TYPES.length]!,
          fxSeed: 9 + i * 4 + col * 7,
          quality: 5,
        })),
        setFx: null,
        setOn: false,
        time: 1.1 + col,
      });
      ctx.restore();
    }
  };
}
