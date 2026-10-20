/**
 * The Shiny collection GIF: every shiny ghost the account has picked up, bobbing in a grid with its name.
 * Made in the browser (the ghosts are drawn procedurally) and uploaded for the Discord bot's /shiny.
 */
import { drawMonster, drawActor } from "./sprites";
import { drawGhostFx } from "./ghost-fx";
import { drawSpectralActor } from "./witch-ghost";
import { tryDrawActorSprite } from "./actor-sprites";
import { bytesToBase64, encodeGif, type GifFrame } from "./gif-encode";
import type { GhostLook, TypeId } from "./content";
import type { ShinyEntry } from "./account-save";

const CELL_W = 56, CELL_H = 60, COLS = 6, MAX_ROWS = 5, FRAMES = 14, DELAY_CS = 9, SCALE = 2;

/** Anything the shiny record, death GIF, or leaderboard needs to redraw a ghost with the live sprite systems. */
export type RecordGhost = {
  uid?: string;
  name?: string;
  type: string;
  template?: number;
  rarity?: number;
  level?: number;
  speed?: number;
  max?: number;
  shiny?: boolean;
  palette?: string | null;
  species?: string;
  skin?: string | null;
  types?: string[] | null;
  look?: unknown;
  classId?: string;
  race?: string | null;
  female?: boolean;
  pieces?: { slot: string; style: number; type: string; fxSeed: number; quality: number; gene?: number }[];
};

/** Draws one ghost (shiny or not) centred at (x, y), using class sheets, skins, and element tints. */
export function drawRecordGhost(ctx: CanvasRenderingContext2D, g: RecordGhost, x: number, y: number, t: number): void {
  const shiny = !!g.shiny;
  const fx = { x, y, type: g.type as TypeId, rarity: g.rarity ?? 0, level: g.level ?? 1, speed: g.speed ?? 10, max: g.max ?? 20, shiny, seed: g.uid ?? g.name ?? "ghost", palette: g.palette };
  drawGhostFx(ctx, fx, t, "back");
  if (g.classId) {
    const actor: any = {
      x, y, race: g.race ?? "vesper", female: g.female !== false, hair: 0, skin: 2,
      facing: 1, direction: "down", walk: t, attack: 0, hurt: 0, moving: true,
      classId: g.classId, time: t, pieces: g.pieces ?? [], setFx: null, setOn: false, scale: 1,
    };
    // Witch ghosts get the ghost treatment (see-through, washed, glowing), same as in the world.
    drawSpectralActor(ctx, actor, { type: g.type, rarity: g.rarity ?? 0, shiny, palette: g.palette, seed: g.uid ?? g.name }, t, (c, a) => { if (!tryDrawActorSprite(c, a)) drawActor(c, a); });
  } else {
    drawMonster(ctx, {
      x, y, template: g.template ?? 0, type: g.type as TypeId, facing: 1, walk: t * 3, hurt: 0, boss: false, rarity: g.rarity ?? 0,
      ghost: true, shiny, palette: g.palette, spin: 0, species: g.species,
      skin: g.skin ?? null, types: (g.types ?? null) as TypeId[] | null, look: (g.look as GhostLook | null) ?? null, time: t,
    });
  }
  drawGhostFx(ctx, fx, t, "front");
}

/** Draws one shiny ghost centred at (x, y). Shared by the GIF and the Shinys Seen screen. */
export function drawShiny(ctx: CanvasRenderingContext2D, s: ShinyEntry, x: number, y: number, t: number): void {
  drawRecordGhost(ctx, { ...s, shiny: true }, x, y, t);
}

/** Renders the collection (newest first, up to 30 ghosts) as a looping GIF. Returns base64, or null. */
export function captureShinyGif(list: ShinyEntry[], title = "SHINY COLLECTION"): string | null {
  if (typeof document === "undefined" || !list.length) return null;
  const show = list.slice().sort((a, b) => b.at - a.at).slice(0, COLS * MAX_ROWS);
  const cols = Math.min(COLS, show.length);
  const rows = Math.ceil(show.length / cols);
  const W = cols * CELL_W, H = rows * CELL_H + 18;
  const small = document.createElement("canvas");
  small.width = W;
  small.height = H;
  const big = document.createElement("canvas");
  big.width = W * SCALE;
  big.height = H * SCALE;
  const sctx = small.getContext("2d");
  const bctx = big.getContext("2d", { willReadFrequently: true });
  if (!sctx || !bctx) return null;
  bctx.imageSmoothingEnabled = false;
  const frames: GifFrame[] = [];
  for (let f = 0; f < FRAMES; f++) {
    const t = (f / FRAMES) * Math.PI * 2;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.fillStyle = "#140e0c";
    sctx.fillRect(0, 0, W, H);
    sctx.fillStyle = `hsl(${(f * 26) % 360},90%,72%)`;
    sctx.font = "bold 9px monospace";
    sctx.textAlign = "center";
    sctx.fillText(`✦ ${title} · ${list.length} ✦`, W / 2, 11);
    show.forEach((s, i) => {
      const cx = (i % cols) * CELL_W + CELL_W / 2;
      const cy = 18 + Math.floor(i / cols) * CELL_H + CELL_H - 18;
      sctx.fillStyle = "#241814";
      sctx.beginPath();
      sctx.ellipse(cx, cy + 4, 14, 4, 0, 0, Math.PI * 2);
      sctx.fill();
      drawShiny(sctx, s, cx, cy - 4 + Math.sin(t + i) * 2.5, t / 2 + i);
      sctx.fillStyle = "#f0e2c8";
      sctx.font = "7px monospace";
      sctx.fillText(s.name.slice(0, 11), cx, cy + 13);
    });
    bctx.clearRect(0, 0, big.width, big.height);
    bctx.drawImage(small, 0, 0, big.width, big.height);
    frames.push({ data: bctx.getImageData(0, 0, big.width, big.height).data, delayCs: DELAY_CS });
  }
  try {
    return bytesToBase64(encodeGif(big.width, big.height, frames));
  } catch {
    return null;
  }
}

/** One shiny ghost, bobbing and sparkling, for the Discord "Shiny Ghost Seen" post. Returns base64, or null. */
export function captureShinySeenGif(s: ShinyEntry): string | null {
  if (typeof document === "undefined") return null;
  const W = 72, H = 72, S = 3, N = 16;
  const small = document.createElement("canvas");
  small.width = W;
  small.height = H;
  const big = document.createElement("canvas");
  big.width = W * S;
  big.height = H * S;
  const sctx = small.getContext("2d");
  const bctx = big.getContext("2d", { willReadFrequently: true });
  if (!sctx || !bctx) return null;
  bctx.imageSmoothingEnabled = false;
  const frames: GifFrame[] = [];
  for (let f = 0; f < N; f++) {
    const t = (f / N) * Math.PI * 2;
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.fillStyle = "#140e0c";
    sctx.fillRect(0, 0, W, H);
    // Sparkles round the ghost.
    for (let k = 0; k < 6; k++) {
      const a = t + (k * Math.PI) / 3;
      sctx.fillStyle = `hsl(${(f * 22 + k * 60) % 360},95%,72%)`;
      sctx.fillRect(Math.round(W / 2 + Math.cos(a) * 26), Math.round(H / 2 - 4 + Math.sin(a) * 22), 2, 2);
    }
    sctx.fillStyle = "#241814";
    sctx.beginPath();
    sctx.ellipse(W / 2, H - 14, 14, 4, 0, 0, Math.PI * 2);
    sctx.fill();
    drawShiny(sctx, s, W / 2, H - 22 + Math.sin(t) * 3, t);
    bctx.clearRect(0, 0, big.width, big.height);
    bctx.drawImage(small, 0, 0, big.width, big.height);
    frames.push({ data: bctx.getImageData(0, 0, big.width, big.height).data, delayCs: 8 });
  }
  try {
    return bytesToBase64(encodeGif(big.width, big.height, frames));
  } catch {
    return null;
  }
}
