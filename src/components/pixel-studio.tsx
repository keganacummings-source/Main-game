import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clonePix, ellipseCells, floodFill, flipH, flipV, hexToRgba, lineCells, newPix, paletteOf, pixEqual, rectCells,
  resizeNearest, rgbaToHex, rotate90, seamScore, setPx, shiftWrap, type Pix, type Rgba,
} from "@/game/pixel-edit";
import { NEWTEX_DIR } from "@/game/tile-atlas";

/**
 * The painting surface for the Tile Builder.
 *
 * The art lives in one RGBA buffer (see pixel-edit.ts). Strokes change the buffer directly and the canvas is
 * redrawn from it, so painting never waits on an image decode. The parent only hears about the art (as a PNG data URL)
 * when a stroke or edit is finished, which keeps dragging smooth and undo exact.
 */

type Tool = "pencil" | "eraser" | "fill" | "line" | "rect" | "ellipse" | "pick";

const TOOLS: { id: Tool; label: string; key: string; hint: string }[] = [
  { id: "pencil", label: "Pencil", key: "P", hint: "Paint pixels. Drag to draw. Right-click erases." },
  { id: "eraser", label: "Eraser", key: "E", hint: "Make pixels transparent." },
  { id: "fill", label: "Fill", key: "G", hint: "Fill the connected area of one colour." },
  { id: "line", label: "Line", key: "L", hint: "Drag a straight line." },
  { id: "rect", label: "Box", key: "R", hint: "Drag a rectangle." },
  { id: "ellipse", label: "Oval", key: "O", hint: "Drag an oval." },
  { id: "pick", label: "Pick", key: "I", hint: "Click a pixel to take its colour. Alt+click works with any tool." },
];

/** Colours drawn from the game's own art so new pieces sit in the same world. */
const GAME_PALETTE = [
  "#141214", "#2b1a0e", "#2a2226", "#3d3338", "#50444a", "#6a5861", "#7a726a", "#9aa0a6", "#e8ecef", "#f1e8d5",
  "#4a2e1a", "#8a6a3a", "#c4a35a", "#e8c878", "#ffc45b", "#fff3a8",
  "#a8281a", "#c0392b", "#e25a32", "#ff8a3a", "#ff7a4a", "#6b2a1a",
  "#1a3a6b", "#2f6fc4", "#4aa0ff", "#8fd0ff",
  "#1b0e2f", "#2a1648", "#5a3a8a", "#7a4ac8", "#a678e8", "#c9a6e8",
  "#143028", "#1f5a46", "#3dff9a", "#7dffb3", "#2d5a2a", "#5a8a3a",
];

const BACKDROPS = [
  { id: "dark", label: "Dark", src: "" },
  { id: "stone", label: "Stone floor", src: NEWTEX_DIR + "stone_floor.png" },
  { id: "grass", label: "Grass", src: NEWTEX_DIR + "grass.png" },
  { id: "hell", label: "Hell floor", src: NEWTEX_DIR + "hell_floor.png" },
  { id: "temple", label: "Temple floor", src: NEWTEX_DIR + "temple_floor.png" },
] as const;

const backdropImgs = new Map<string, HTMLImageElement>();
function backdropImage(src: string, onLoad: () => void): HTMLImageElement | null {
  if (!src) return null;
  let img = backdropImgs.get(src);
  if (!img) {
    img = new Image();
    img.onload = onLoad;
    img.src = src;
    backdropImgs.set(src, img);
  } else if (!img.complete) {
    const prev = img.onload;
    img.onload = (e) => { (prev as any)?.call(img, e); onLoad(); };
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

const HISTORY_MAX = 100;
const RECENT_MAX = 14;

export type PixelStudioProps = {
  size: number;
  /** Current art as a PNG data URL ("" for a blank canvas). */
  pixels: string;
  onChange: (dataUrl: string) => void;
  /** Show the repeating 3×3 preview first (floors, walls, grass). */
  tileMode?: boolean;
};

function inField(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** Decodes a PNG data URL (or any image URL) into a size×size buffer, nearest-neighbour. */
export function decodeToPix(url: string, size: number): Promise<Pix | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = size; c.height = size;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return resolve(null);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, size, size);
      resolve(new Uint8ClampedArray(ctx.getImageData(0, 0, size, size).data));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function pixToDataUrl(p: Pix, size: number): string {
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.putImageData(new ImageData(new Uint8ClampedArray(p), size, size), 0, 0);
  return c.toDataURL("image/png");
}

export function PixelStudio({ size, pixels, onChange, tileMode }: PixelStudioProps) {
  // ─── art + history ──────────────────────────────────────────────────────────────────────────────────────────
  const bufRef = useRef<Pix>(newPix(size, size));
  const dimRef = useRef(size);
  const undoRef = useRef<Pix[]>([]);
  const redoRef = useRef<Pix[]>([]);
  const lastEmitted = useRef<string | null>(null);
  const [rev, setRev] = useState(0);
  const bump = useCallback(() => setRev((r) => r + 1), []);

  // ─── tool state ─────────────────────────────────────────────────────────────────────────────────────────────
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#8a6a3a");
  const [recent, setRecent] = useState<string[]>([]);
  const [brush, setBrush] = useState(1);
  const [filled, setFilled] = useState(false);
  const [mirrorX, setMirrorX] = useState(false);
  const [mirrorY, setMirrorY] = useState(false);
  const [grid, setGrid] = useState(true);
  const [zoom, setZoom] = useState(() => Math.max(6, Math.min(28, Math.floor(480 / size))));
  const [hover, setHover] = useState<[number, number] | null>(null);
  const [preview, setPreview] = useState<Array<[number, number]> | null>(null);
  const [backdrop, setBackdrop] = useState<(typeof BACKDROPS)[number]["id"]>("stone");
  const [bdRev, setBdRev] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const tiledRef = useRef<HTMLCanvasElement>(null);
  const actualRef = useRef<HTMLCanvasElement>(null);

  const drag = useRef<null | {
    tool: Tool; erase: boolean; start: [number, number]; last: [number, number]; before: Pix; moved: boolean; button: number;
  }>(null);

  const commitColor = useCallback((hex: string) => {
    setRecent((r) => [hex, ...r.filter((c) => c !== hex)].slice(0, RECENT_MAX));
  }, []);

  const emit = useCallback(() => {
    const url = pixToDataUrl(bufRef.current, dimRef.current);
    lastEmitted.current = url;
    onChange(url);
  }, [onChange]);

  /** Records the buffer as it was before an edit, so Undo can restore it. */
  const pushUndo = useCallback((before: Pix) => {
    undoRef.current.push(before);
    if (undoRef.current.length > HISTORY_MAX) undoRef.current.shift();
    redoRef.current = [];
  }, []);

  /** Applies a whole-buffer change (flip, rotate, shift, clear) as one undo step. */
  const applyBuffer = useCallback((next: Pix) => {
    if (pixEqual(next, bufRef.current)) return;
    pushUndo(clonePix(bufRef.current));
    bufRef.current = next;
    bump();
    emit();
  }, [bump, emit, pushUndo]);

  // ─── load art from the parent (first open, "Start from game art", imports) ────────────────────────────────────
  useEffect(() => {
    if (pixels === lastEmitted.current) return;
    let live = true;
    decodeToPix(pixels, dimRef.current).then((p) => {
      if (!live) return;
      const next = p ?? newPix(dimRef.current, dimRef.current);
      if (!pixEqual(next, bufRef.current)) {
        if (lastEmitted.current !== null) pushUndo(clonePix(bufRef.current));
        bufRef.current = next;
      }
      lastEmitted.current = pixels;
      bump();
    });
    return () => { live = false; };
  }, [pixels, bump, pushUndo]);

  // ─── canvas size changed: resample, don't stretch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (size === dimRef.current) return;
    const old = dimRef.current;
    pushUndo(clonePix(bufRef.current));
    bufRef.current = resizeNearest(bufRef.current, old, old, size, size);
    dimRef.current = size;
    undoRef.current = []; // history of another size can't be replayed
    redoRef.current = [];
    setZoom(Math.max(6, Math.min(28, Math.floor(480 / size))));
    bump();
    emit();
  }, [size, bump, emit, pushUndo]);

  // ─── drawing ──────────────────────────────────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const n = dimRef.current;
    const px = n * zoom;
    ctx.clearRect(0, 0, px, px);
    // checkerboard so empty pixels are obvious
    const cell = Math.max(1, Math.floor(zoom / 2));
    for (let y = 0; y < px; y += cell) for (let x = 0; x < px; x += cell) {
      ctx.fillStyle = ((x / cell + y / cell) & 1) ? "#2a2220" : "#3a3029";
      ctx.fillRect(x, y, cell, cell);
    }
    let off = offRef.current;
    if (!off || off.width !== n) { off = document.createElement("canvas"); off.width = n; off.height = n; offRef.current = off; }
    const octx = off.getContext("2d")!;
    octx.putImageData(new ImageData(new Uint8ClampedArray(bufRef.current), n, n), 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, px, px);
    // shape preview
    if (preview) {
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = drag.current?.erase || tool === "eraser" ? "#ffffff" : color;
      for (const [x, y] of preview) if (x >= 0 && y >= 0 && x < n && y < n) ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
      ctx.globalAlpha = 1;
    }
    // grid
    if (grid && zoom >= 8) {
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        ctx.moveTo(i * zoom + 0.5, 0); ctx.lineTo(i * zoom + 0.5, px);
        ctx.moveTo(0, i * zoom + 0.5); ctx.lineTo(px, i * zoom + 0.5);
      }
      ctx.stroke();
      if (n >= 16) {
        ctx.strokeStyle = "rgba(255,255,255,0.28)";
        ctx.beginPath();
        for (let i = 0; i <= n; i += 8) {
          ctx.moveTo(i * zoom + 0.5, 0); ctx.lineTo(i * zoom + 0.5, px);
          ctx.moveTo(0, i * zoom + 0.5); ctx.lineTo(px, i * zoom + 0.5);
        }
        ctx.stroke();
      }
    }
    // mirror axes
    ctx.strokeStyle = "rgba(230,193,90,0.9)";
    ctx.lineWidth = 2;
    if (mirrorX) { ctx.beginPath(); ctx.moveTo(px / 2, 0); ctx.lineTo(px / 2, px); ctx.stroke(); }
    if (mirrorY) { ctx.beginPath(); ctx.moveTo(0, px / 2); ctx.lineTo(px, px / 2); ctx.stroke(); }
    // hover cell
    if (hover) {
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 1;
      ctx.strokeRect(hover[0] * zoom + 0.5, hover[1] * zoom + 0.5, zoom * Math.min(brush, 3) - 1, zoom * Math.min(brush, 3) - 1);
    }
  }, [zoom, grid, preview, hover, mirrorX, mirrorY, brush, color, tool]);

  useEffect(() => { draw(); }, [draw, rev]);

  // previews (actual size and 3×3 repeat) on a chosen backdrop
  useEffect(() => {
    const off = offRef.current;
    if (!off) return;
    const n = dimRef.current;
    const bd = BACKDROPS.find((b) => b.id === backdrop)!;
    const bdImg = backdropImage(bd.src, () => setBdRev((r) => r + 1));
    const paintBackdrop = (ctx: CanvasRenderingContext2D, w: number, h: number, scale: number) => {
      ctx.imageSmoothingEnabled = false;
      if (bdImg) {
        const t = 32 * scale;
        for (let y = 0; y < h; y += t) for (let x = 0; x < w; x += t) ctx.drawImage(bdImg, x, y, t, t);
      } else { ctx.fillStyle = "#1c1412"; ctx.fillRect(0, 0, w, h); }
    };
    const a = actualRef.current;
    if (a) {
      const ctx = a.getContext("2d");
      if (ctx) {
        const scale = 3, tile = 32 * scale;
        a.width = tile * 3; a.height = tile;
        paintBackdrop(ctx, a.width, a.height, scale);
        ctx.imageSmoothingEnabled = false;
        // the piece at its in-game size (32px, shown 3×), centred on the chosen floor
        ctx.drawImage(off, tile, 0, tile, tile);
      }
    }
    const t = tiledRef.current;
    if (t) {
      const ctx = t.getContext("2d");
      if (ctx) {
        const scale = 2, tile = 32 * scale;
        t.width = tile * 3; t.height = tile * 3;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#1c1412"; ctx.fillRect(0, 0, t.width, t.height);
        for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) ctx.drawImage(off, x * tile, y * tile, tile, tile);
      }
    }
  }, [rev, backdrop, bdRev]);

  // ─── pointer input ────────────────────────────────────────────────────────────────────────────────────────────
  const cellAt = (e: { clientX: number; clientY: number }): [number, number] => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const n = dimRef.current;
    const x = Math.floor(((e.clientX - r.left) / r.width) * n);
    const y = Math.floor(((e.clientY - r.top) / r.height) * n);
    return [Math.max(-1, Math.min(n, x)), Math.max(-1, Math.min(n, y))];
  };

  /** One cell → every cell it paints: brush size and mirrors. */
  const expand = useCallback((cells: Array<[number, number]>): Array<[number, number]> => {
    const n = dimRef.current;
    const out: Array<[number, number]> = [];
    const seen = new Set<number>();
    const add = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= n || y >= n) return;
      const k = y * n + x;
      if (seen.has(k)) return;
      seen.add(k);
      out.push([x, y]);
    };
    const b = tool === "pencil" || tool === "eraser" || drag.current?.erase ? brush : 1;
    for (const [x, y] of cells) {
      for (let dy = 0; dy < b; dy++) for (let dx = 0; dx < b; dx++) {
        const cx = x + dx - Math.floor((b - 1) / 2), cy = y + dy - Math.floor((b - 1) / 2);
        add(cx, cy);
        if (mirrorX) add(n - 1 - cx, cy);
        if (mirrorY) add(cx, n - 1 - cy);
        if (mirrorX && mirrorY) add(n - 1 - cx, n - 1 - cy);
      }
    }
    return out;
  }, [brush, mirrorX, mirrorY, tool]);

  const paintCells = (cells: Array<[number, number]>, c: Rgba) => {
    const n = dimRef.current;
    for (const [x, y] of cells) setPx(bufRef.current, n, n, x, y, c);
  };

  const pickAt = (x: number, y: number) => {
    const n = dimRef.current;
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    const i = (y * n + x) * 4;
    const b = bufRef.current;
    if (b[i + 3]! === 0) { setTool("eraser"); return; }
    setColor(rgbaToHex(b[i]!, b[i + 1]!, b[i + 2]!));
    if (tool === "pick" || tool === "eraser") setTool("pencil");
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const [x, y] = cellAt(e);
    const n = dimRef.current;
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    if (e.altKey || tool === "pick") { pickAt(x, y); return; }
    const erase = tool === "eraser" || e.button === 2;
    const before = clonePix(bufRef.current);
    if (tool === "fill" && !erase) {
      const rgba = hexToRgba(color);
      if (floodFill(bufRef.current, n, n, x, y, rgba)) { pushUndo(before); commitColor(color); bump(); emit(); }
      return;
    }
    if (tool === "fill" && erase) {
      if (floodFill(bufRef.current, n, n, x, y, [0, 0, 0, 0])) { pushUndo(before); bump(); emit(); }
      return;
    }
    drag.current = { tool: erase && tool !== "eraser" ? "pencil" : tool, erase, start: [x, y], last: [x, y], before, moved: false, button: e.button };
    if (drag.current.tool === "pencil" || drag.current.tool === "eraser") {
      paintCells(expand([[x, y]]), erase ? [0, 0, 0, 0] : hexToRgba(color));
      bump();
    } else {
      setPreview(expand(shapeCells(drag.current.tool, [x, y], [x, y])));
    }
  };

  const shapeCells = (t: Tool, a: [number, number], b: [number, number]): Array<[number, number]> => {
    if (t === "line") return lineCells(a[0], a[1], b[0], b[1]);
    if (t === "rect") return rectCells(a[0], a[1], b[0], b[1], filled);
    if (t === "ellipse") return ellipseCells(a[0], a[1], b[0], b[1], filled);
    return [];
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const [x, y] = cellAt(e);
    const n = dimRef.current;
    setHover(x >= 0 && y >= 0 && x < n && y < n ? [x, y] : null);
    const d = drag.current;
    if (!d) return;
    const cx = Math.max(0, Math.min(n - 1, x)), cy = Math.max(0, Math.min(n - 1, y));
    if (cx === d.last[0] && cy === d.last[1]) return;
    d.moved = true;
    if (d.tool === "pencil" || d.tool === "eraser") {
      paintCells(expand(lineCells(d.last[0], d.last[1], cx, cy)), d.erase ? [0, 0, 0, 0] : hexToRgba(color));
      d.last = [cx, cy];
      bump();
    } else {
      d.last = [cx, cy];
      setPreview(expand(shapeCells(d.tool, d.start, [cx, cy])));
    }
  };

  const finish = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.tool !== "pencil" && d.tool !== "eraser") {
      const cells = expand(shapeCells(d.tool, d.start, d.last));
      paintCells(cells, d.erase ? [0, 0, 0, 0] : hexToRgba(color));
      setPreview(null);
    }
    if (!pixEqual(d.before, bufRef.current)) {
      pushUndo(d.before);
      if (!d.erase) commitColor(color);
      bump();
      emit();
    } else bump();
  };

  // ─── undo / redo / transforms ──────────────────────────────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    const prev = undoRef.current.pop();
    if (!prev) return;
    redoRef.current.push(clonePix(bufRef.current));
    bufRef.current = prev;
    bump(); emit();
  }, [bump, emit]);
  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(clonePix(bufRef.current));
    bufRef.current = next;
    bump(); emit();
  }, [bump, emit]);

  const n = dimRef.current;
  const transform = {
    flipH: () => applyBuffer(flipH(bufRef.current, n, n)),
    flipV: () => applyBuffer(flipV(bufRef.current, n, n)),
    rotCw: () => applyBuffer(rotate90(bufRef.current, n)),
    rotCcw: () => applyBuffer(rotate90(bufRef.current, n, true)),
    shift: (dx: number, dy: number) => applyBuffer(shiftWrap(bufRef.current, n, n, dx, dy)),
    clear: () => applyBuffer(newPix(n, n)),
  };

  // ─── keyboard ─────────────────────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (inField(e.target)) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); redo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const map: Record<string, Tool> = { p: "pencil", b: "pencil", e: "eraser", g: "fill", l: "line", r: "rect", o: "ellipse", i: "pick" };
      if (map[k]) { setTool(map[k]); e.preventDefault(); return; }
      if (k === "h") { setMirrorX((v) => !v); return; }
      if (k === "v") { setMirrorY((v) => !v); return; }
      if (k === "q") { setGrid((v) => !v); return; }
      if (k === "[") { setBrush((b) => Math.max(1, b - 1)); return; }
      if (k === "]") { setBrush((b) => Math.min(4, b + 1)); return; }
      if (k === "arrowleft") { e.preventDefault(); transform.shift(-1, 0); }
      else if (k === "arrowright") { e.preventDefault(); transform.shift(1, 0); }
      else if (k === "arrowup") { e.preventDefault(); transform.shift(0, -1); }
      else if (k === "arrowdown") { e.preventDefault(); transform.shift(0, 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const inArt = useMemo(() => paletteOf(bufRef.current, 14), [rev]);
  const seam = useMemo(() => seamScore(bufRef.current, dimRef.current, dimRef.current), [rev]);
  const canUndo = undoRef.current.length > 0, canRedo = redoRef.current.length > 0;
  const cssPx = n * zoom;

  const Swatch = ({ c }: { c: string }) => (
    <button
      type="button"
      className={`ps-swatch ${c.toLowerCase() === color.toLowerCase() ? "ps-swatch-on" : ""}`}
      style={{ background: c }}
      title={c}
      aria-label={`Colour ${c}`}
      onClick={() => { setColor(c); if (tool === "eraser" || tool === "pick") setTool("pencil"); }}
    />
  );

  return (
    <div className="ps-root">
      <div className="ps-tools" role="toolbar" aria-label="Painting tools">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" className={`px-btn ui-btn-sm ${tool === t.id ? "px-btn-kyo" : ""}`} title={`${t.hint} (${t.key})`} aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>
            {t.label}<kbd className="ps-key">{t.key}</kbd>
          </button>
        ))}
        <span className="ps-sep" />
        <button type="button" className="px-btn ui-btn-sm" disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)">Undo</button>
        <button type="button" className="px-btn ui-btn-sm" disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Y)">Redo</button>
      </div>

      <div className="ps-main">
        <div className="ps-stage">
          <div className="ps-canvas-wrap">
            <canvas
              ref={canvasRef}
              width={cssPx}
              height={cssPx}
              className="ps-canvas"
              style={{ width: cssPx, height: cssPx }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={finish}
              onPointerCancel={finish}
              onPointerLeave={() => { setHover(null); }}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Pixel canvas"
            />
          </div>
          <div className="ps-status text-dim">
            {hover ? `x ${hover[0]}, y ${hover[1]}` : "Hover the canvas"} · {n}×{n} · right-click erases · Alt+click picks a colour
          </div>
        </div>

        <div className="ps-side">
          <div className="ps-block">
            <div className="ps-label">Colour</div>
            <div className="ps-colorrow">
              <input type="color" value={color} onChange={(e) => { setColor(e.target.value); if (tool === "eraser" || tool === "pick") setTool("pencil"); }} aria-label="Colour picker" className="ps-colorinput" />
              <input
                className="px-input ps-hex"
                value={color}
                maxLength={7}
                spellCheck={false}
                aria-label="Hex colour"
                onChange={(e) => { const v = e.target.value.startsWith("#") ? e.target.value : "#" + e.target.value; if (/^#[0-9a-f]{0,6}$/i.test(v)) setColor(v.length === 7 ? v.toLowerCase() : v); }}
                onBlur={() => { if (!/^#[0-9a-f]{6}$/i.test(color)) setColor("#8a6a3a"); }}
              />
            </div>
            {recent.length > 0 && (<><div className="ps-label">Recent</div><div className="ps-swatches">{recent.map((c) => <Swatch key={"r" + c} c={c} />)}</div></>)}
            {inArt.length > 0 && (<><div className="ps-label">In this art</div><div className="ps-swatches">{inArt.map((c) => <Swatch key={"a" + c} c={c} />)}</div></>)}
            <div className="ps-label">Game palette</div>
            <div className="ps-swatches">{GAME_PALETTE.map((c) => <Swatch key={"g" + c} c={c} />)}</div>
          </div>

          <div className="ps-block">
            <div className="ps-label">Brush</div>
            <div className="ps-row">
              {[1, 2, 3, 4].map((b) => (
                <button key={b} type="button" className={`px-btn ui-btn-sm ${brush === b ? "px-btn-kyo" : ""}`} onClick={() => setBrush(b)} title="Brush size ([ and ])">{b}px</button>
              ))}
            </div>
            <div className="ps-row">
              <button type="button" className={`chip ${filled ? "chip-on" : ""}`} aria-pressed={filled} onClick={() => setFilled(!filled)} title="Fill the box and oval shapes">Filled shapes</button>
              <button type="button" className={`chip ${mirrorX ? "chip-on" : ""}`} aria-pressed={mirrorX} onClick={() => setMirrorX(!mirrorX)} title="Mirror left/right (H)">Mirror ↔</button>
              <button type="button" className={`chip ${mirrorY ? "chip-on" : ""}`} aria-pressed={mirrorY} onClick={() => setMirrorY(!mirrorY)} title="Mirror up/down (V)">Mirror ↕</button>
              <button type="button" className={`chip ${grid ? "chip-on" : ""}`} aria-pressed={grid} onClick={() => setGrid(!grid)} title="Pixel grid (Q)">Grid</button>
            </div>
            <div className="ps-row ps-zoom">
              <span className="ps-label" style={{ margin: 0 }}>Zoom</span>
              <input type="range" min={4} max={32} step={1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" />
              <span className="text-dim">{zoom}×</span>
            </div>
          </div>

          <div className="ps-block">
            <div className="ps-label">Transform</div>
            <div className="ps-row">
              <button type="button" className="px-btn ui-btn-sm" onClick={transform.flipH} title="Flip left/right">Flip ↔</button>
              <button type="button" className="px-btn ui-btn-sm" onClick={transform.flipV} title="Flip up/down">Flip ↕</button>
              <button type="button" className="px-btn ui-btn-sm" onClick={transform.rotCcw} title="Rotate 90° left">⟲ 90°</button>
              <button type="button" className="px-btn ui-btn-sm" onClick={transform.rotCw} title="Rotate 90° right">⟳ 90°</button>
            </div>
            <div className="ps-row">
              <span className="text-dim" style={{ fontSize: 16 }}>Shift (wraps; arrow keys too)</span>
              <button type="button" className="px-btn ui-btn-sm" onClick={() => transform.shift(-1, 0)} aria-label="Shift left">←</button>
              <button type="button" className="px-btn ui-btn-sm" onClick={() => transform.shift(0, -1)} aria-label="Shift up">↑</button>
              <button type="button" className="px-btn ui-btn-sm" onClick={() => transform.shift(0, 1)} aria-label="Shift down">↓</button>
              <button type="button" className="px-btn ui-btn-sm" onClick={() => transform.shift(1, 0)} aria-label="Shift right">→</button>
            </div>
            <div className="ps-row">
              <button type="button" className="px-btn ui-btn-sm" onClick={transform.clear}>Clear canvas</button>
            </div>
          </div>

          <div className="ps-block">
            <div className="ps-label">Preview in game</div>
            <div className="ps-row">
              <select value={backdrop} onChange={(e) => setBackdrop(e.target.value as any)} aria-label="Preview backdrop">
                {BACKDROPS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </div>
            <canvas ref={actualRef} className="ps-preview" style={{ imageRendering: "pixelated", width: 288, maxWidth: "100%" }} aria-label="Preview at game size" />
            <div className="ps-label" style={{ marginTop: 6 }}>Repeated 3×3 {tileMode ? "" : "(for floors and walls)"}</div>
            <canvas ref={tiledRef} className="ps-preview" style={{ imageRendering: "pixelated", width: 192, maxWidth: "100%" }} aria-label="Tiled preview" />
            {tileMode && (
              <div className={seam >= 0.9 ? "text-good" : "text-dim"} style={{ fontSize: 16 }}>
                Seams: {seam >= 0.9 ? "edges line up well" : seam >= 0.75 ? "edges are close; check the 3×3 above" : "edges differ, so you may see lines when it repeats"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
