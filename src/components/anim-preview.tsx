import { useEffect, useRef } from "react";

/**
 * A looping preview of two-frame art, for the Tile and Enemy editors.
 *
 * You cannot judge an animation from two still pictures side by side — you have to watch it. This
 * plays the frames at the speed the game will play them, so what you see here is what you get.
 *
 * `draw` is handed a context and which frame to paint, so each editor can keep its own art format
 * (the Tile editor has PNG data URLs, the Enemy Designer has a grid of colours) without converting
 * anything. It is called only when the frame actually changes, not every tick.
 */
export function TwoFramePreview({
  width,
  height,
  scale = 1,
  fps,
  frames = 2,
  playing = true,
  draw,
  label,
  className,
}: {
  /** Art size in pixels. */
  width: number;
  height: number;
  /** Whole-number magnification, so pixel art stays crisp. */
  scale?: number;
  fps: number;
  frames?: number;
  /** When false the preview holds on frame 1 — what the game shows for a still piece. */
  playing?: boolean;
  draw: (ctx: CanvasRenderingContext2D, frame: number) => void;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Held in a ref so a redraw mid-loop uses the latest art without restarting the animation.
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    let shown = -1;
    const start = performance.now();
    const paint = (frame: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.scale(scale, scale);
      drawRef.current(ctx, frame);
    };
    const tick = (now: number) => {
      const frame = playing && fps > 0 ? Math.floor(((now - start) / 1000) * fps) % Math.max(1, frames) : 0;
      if (frame !== shown) { shown = frame; paint(frame); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `draw` deliberately not a dependency: it comes through drawRef, so editing the art repaints
    // on the next tick instead of resetting the loop on every keystroke.
  }, [fps, frames, playing, scale, width, height]);

  return (
    <canvas
      ref={ref}
      width={Math.max(1, Math.round(width * scale))}
      height={Math.max(1, Math.round(height * scale))}
      className={className}
      aria-label={label ?? "Animation preview"}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
