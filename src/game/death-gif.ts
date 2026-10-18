/**
 * The death GIF posted to Discord: the fallen witch in her real gear, with her gear FX (wings, tails,
 * crowns…), her set aura and her ghosts circling her, walking in place for about two seconds.
 */
import type { ActorDraw } from "./sprites";
import { drawActor } from "./sprites";
import { drawRecordGhost, type RecordGhost } from "./shiny-gif";
import { bytesToBase64, encodeGif, type GifFrame } from "./gif-encode";
import type { GhostLook, TypeId } from "./content";

export type DeathLook = Omit<ActorDraw, "x" | "y" | "walk" | "attack" | "hurt" | "facing" | "time">;
export type DeathGhost = RecordGhost & { type: TypeId; look: GhostLook | null };

const W = 120, H = 112, SCALE = 2, FRAMES = 24, DELAY_CS = 7;

/** Renders and encodes the GIF. Returns base64, or null if the browser cannot draw it. */
export function captureDeathGif(look: DeathLook, ghosts: DeathGhost[]): string | null {
  if (typeof document === "undefined") return null;
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
  const cx = W / 2, cy = H - 30;
  for (let f = 0; f < FRAMES; f++) {
    const t = f * (DELAY_CS / 100);
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.fillStyle = "#140e0c";
    sctx.fillRect(0, 0, W, H);
    sctx.fillStyle = "#241814";
    sctx.beginPath();
    sctx.ellipse(cx, cy + 2, 34, 9, 0, 0, Math.PI * 2);
    sctx.fill();
    // Ghosts hover at her sides and behind her shoulder, bobbing, so none covers her.
    const spots = [[-36, -6], [36, -6], [0, -44]];
    const loop = (Math.PI * 2) / (FRAMES * DELAY_CS / 100);
    const orbit = ghosts.slice(0, 3).map((g, i) => ({
      g,
      x: cx + spots[i]![0]! + Math.sin(t * loop + i) * 3,
      y: cy + spots[i]![1]! + Math.sin(t * loop * 2 + i * 2) * 3,
      depth: i === 2 ? -1 : 1,
    }));
    const ghost = (o: (typeof orbit)[number]) => {
      drawRecordGhost(sctx, o.g, o.x, o.y, t);
    };
    for (const o of orbit) if (o.depth < 0) ghost(o);
    drawActor(sctx, { ...look, scale: 1.25, x: cx, y: cy, walk: t * 4, moving: true, attack: 0, hurt: 0, facing: 1, direction: look.direction ?? "down", time: t });
    for (const o of orbit) if (o.depth >= 0) ghost(o);
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
