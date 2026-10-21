import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pencil, Eraser, PaintBucket, Pipette, FlipHorizontal2, Undo2, Redo2, Grid3x3,
  Trash2, Copy, ClipboardPaste, Download, Upload, RotateCcw, Play, Pause,
} from "lucide-react";
import { CLASSES, CLASS_BY_ID, type ClassId } from "@/game/classes";
import {
  FACINGS, WALK_FRAMES, FRAME_W, FRAME_H, frameKey,
  loadRedraws, saveRedraws, type ClassRedraw, type Facing, CLASS_SHEET_ORIGIN,
} from "@/game/class-redraws";
import {
  type Pix, newPix, hexToRgba, rgbaToHex, setPx, getPx, lineCells, floodFill, flipH, stripBakedChecker,
} from "@/game/pixel-edit";
import { Section, Empty } from "./ui-kit";

/* ───────────────────────── constants ───────────────────────── */

const SHEET_URL = "/sprites/class_warriors.png";

const PALETTE = [
  "#140e0c", "#6a4038", "#8a6a3a", "#c48a78", "#f0d2c4", "#f0e2c8", "#ffffff", "#a89880",
  "#c4473a", "#e25a32", "#e6c15a", "#f2d43a", "#fff1a8", "#6a9a52", "#5aa88e", "#9ad8c8",
  "#3a7eb8", "#7ec8ea", "#9ad0ff", "#6a4cff", "#c9a6e8", "#241830", "#3a140c", "#000000",
];

type Tool = "draw" | "erase" | "fill" | "pick";
type FramesRef = { current: Map<string, Pix> };
const FACING_LABEL: Record<Facing, string> = { up: "Up (back)", right: "Right", down: "Down (front)", left: "Left" };

/* ───────────────────────── image helpers (DOM) ───────────────────────── */

let sheetPromise: Promise<ImageData | null> | null = null;
function loadSheet(): Promise<ImageData | null> {
  if (!sheetPromise) {
    sheetPromise = new Promise<ImageData | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0);
          resolve(ctx.getImageData(0, 0, c.width, c.height));
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = SHEET_URL;
    }).then((r) => { if (!r) sheetPromise = null; return r; });
  }
  return sheetPromise;
}

/** The original art for one frame, copied out of the class sheet (null if this class has no original). */
function cropOriginal(sheet: ImageData, classId: string, facing: Facing, frame: number): Pix | null {
  const origin = CLASS_SHEET_ORIGIN[classId];
  if (!origin) return null;
  const sx = origin.x + frame * FRAME_W;
  const sy = origin.y + FACINGS.indexOf(facing) * FRAME_H;
  if (sx < 0 || sy < 0 || sx + FRAME_W > sheet.width || sy + FRAME_H > sheet.height) return null;
  const out = newPix(FRAME_W, FRAME_H);
  for (let y = 0; y < FRAME_H; y++) {
    const from = ((sy + y) * sheet.width + sx) * 4;
    out.set(sheet.data.subarray(from, from + FRAME_W * 4), y * FRAME_W * 4);
  }
  return out;
}

function dataUrlToPix(url: string): Promise<Pix | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = FRAME_W; c.height = FRAME_H;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, FRAME_W, FRAME_H);
        const pix = new Uint8ClampedArray(ctx.getImageData(0, 0, FRAME_W, FRAME_H).data);
        stripBakedChecker(pix);
        resolve(pix);
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function pixToDataUrl(pix: Pix): string {
  const c = document.createElement("canvas");
  c.width = FRAME_W; c.height = FRAME_H;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(FRAME_W, FRAME_H);
  img.data.set(pix);
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

function paintPix(ctx: CanvasRenderingContext2D, pix: Pix | undefined) {
  const img = ctx.createImageData(FRAME_W, FRAME_H);
  if (pix) img.data.set(pix);
  ctx.putImageData(img, 0, 0);
}

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ───────────────────────── the drawing surface ───────────────────────── */

type CanvasProps = {
  pix: Pix | undefined;
  version: number;
  zoom: number;
  grid: boolean;
  tool: Tool;
  color: string;
  brush: number;
  mirror: boolean;
  onStrokeStart: () => void;
  onStrokeEnd: () => void;
  onPick: (hex: string) => void;
  onFill: (x: number, y: number) => void;
};

function PixelCanvas({ pix, version, zoom, grid, tool, color, brush, mirror, onStrokeStart, onStrokeEnd, onPick, onFill }: CanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stroking = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const rgba = useMemo(() => (tool === "erase" ? ([0, 0, 0, 0] as const) : hexToRgba(color)), [tool, color]);

  const redraw = useCallback(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) paintPix(ctx, pix);
  }, [pix]);
  useEffect(() => { redraw(); }, [redraw, version]);

  const cell = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.floor(((e.clientX - r.left) / r.width) * FRAME_W),
      y: Math.floor(((e.clientY - r.top) / r.height) * FRAME_H),
    };
  };
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < FRAME_W && y < FRAME_H;

  const stamp = (x: number, y: number) => {
    if (!pix) return;
    const o = Math.floor(brush / 2);
    for (let dy = 0; dy < brush; dy++) for (let dx = 0; dx < brush; dx++) {
      const px = x - o + dx, py = y - o + dy;
      setPx(pix, FRAME_W, FRAME_H, px, py, rgba);
      if (mirror) setPx(pix, FRAME_W, FRAME_H, FRAME_W - 1 - px, py, rgba);
    }
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pix) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    const { x, y } = cell(e);
    if (!inside(x, y)) return;
    if (tool === "pick") {
      const c = getPx(pix, FRAME_W, FRAME_H, x, y);
      if (c && c[3] > 40) onPick(rgbaToHex(c[0], c[1], c[2]));
      return;
    }
    if (tool === "fill") { onFill(x, y); return; }
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
    onStrokeStart();
    stroking.current = true;
    last.current = { x, y };
    stamp(x, y);
    redraw();
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = cell(e);
    setHover(inside(x, y) ? { x, y } : null);
    if (!stroking.current || !last.current) return;
    for (const [cx, cy] of lineCells(last.current.x, last.current.y, x, y)) stamp(cx, cy);
    last.current = { x, y };
    redraw();
  };

  const finish = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!stroking.current) return;
    stroking.current = false;
    last.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    onStrokeEnd();
  };

  const showBrush = tool === "draw" || tool === "erase";
  const size = showBrush ? brush : 1;
  const off = showBrush ? Math.floor(brush / 2) : 0;

  return (
    <div className="cr-stage" style={{ width: FRAME_W * zoom, height: FRAME_H * zoom, backgroundSize: `${zoom * 2}px ${zoom * 2}px` }}>
      <canvas
        ref={ref}
        width={FRAME_W}
        height={FRAME_H}
        className="cr-canvas"
        style={{ width: FRAME_W * zoom, height: FRAME_H * zoom, cursor: tool === "pick" ? "copy" : "crosshair" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onPointerLeave={() => setHover(null)}
        onContextMenu={(e) => e.preventDefault()}
      />
      {grid && <div className="cr-grid" style={{ backgroundSize: `${zoom}px ${zoom}px` }} />}
      {mirror && <div className="cr-mirror-line" style={{ left: (FRAME_W * zoom) / 2 }} />}
      {hover && (
        <div
          className="cr-hover"
          style={{ left: (hover.x - off) * zoom, top: (hover.y - off) * zoom, width: size * zoom, height: size * zoom }}
        />
      )}
      <div className="cr-coords">{hover ? `${hover.x}, ${hover.y}` : "\u00a0"}</div>
    </div>
  );
}

/* ───────────────────────── small pieces ───────────────────────── */

function Thumb({ pix, version }: { pix: Pix | undefined; version: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) paintPix(ctx, pix);
  }, [pix, version]);
  return <canvas ref={ref} width={FRAME_W} height={FRAME_H} className="cr-thumb" />;
}

function Preview({ framesRef, facing, frame, playing, speed }: {
  framesRef: FramesRef; facing: Facing; frame: number; playing: boolean; speed: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const tmp = document.createElement("canvas");
    tmp.width = FRAME_W; tmp.height = FRAME_H;
    const tctx = tmp.getContext("2d");
    if (!tctx) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const step = playing ? Math.floor(((now - t0) / 1000) * speed) % WALK_FRAMES : frame;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#3a4a32";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const pix = framesRef.current.get(frameKey(facing, step));
      if (pix) {
        paintPix(tctx, pix);
        const sc = 3;
        ctx.drawImage(tmp, Math.round((canvas.width - FRAME_W * sc) / 2), Math.round((canvas.height - FRAME_H * sc) / 2), FRAME_W * sc, FRAME_H * sc);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [framesRef, facing, frame, playing, speed]);
  return <canvas ref={ref} width={140} height={160} className="cr-preview" />;
}

/* ───────────────────────── the editor ───────────────────────── */

export function CharacterRedesigner({ onBack }: { onBack: () => void }) {
  const [list, setList] = useState<ClassRedraw[]>(() => loadRedraws());
  const listRef = useRef(list);
  const [selected, setSelected] = useState<ClassId | null>(CLASSES[0]?.id ?? null);
  const [facing, setFacing] = useState<Facing>("down");
  const [frame, setFrame] = useState(0);
  const [query, setQuery] = useState("");

  const [tool, setTool] = useState<Tool>("draw");
  const [color, setColor] = useState("#c48a78");
  const [recent, setRecent] = useState<string[]>([]);
  const [brush, setBrush] = useState(1);
  const [mirror, setMirror] = useState(false);
  const [grid, setGrid] = useState(true);
  const [zoom, setZoom] = useState(10);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(6);

  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [version, setVersion] = useState(0);
  const [saveState, setSaveState] = useState<"saved" | "error">("saved");

  // Pixel data lives in refs (fast, mutated while drawing); `version` tells React to repaint.
  const framesRef = useRef<Map<string, Pix>>(new Map());
  const undoRef = useRef<Map<string, Pix[]>>(new Map());
  const redoRef = useRef<Map<string, Pix[]>>(new Map());
  const clipRef = useRef<Pix | null>(null);
  const prevTool = useRef<Tool>("draw");
  const bump = () => setVersion((v) => v + 1);

  const key = frameKey(facing, frame);
  const current = selected ? CLASS_BY_ID[selected] : null;
  const pix = framesRef.current.get(key);
  const hasOriginal = selected ? !!CLASS_SHEET_ORIGIN[selected] : false;
  const savedEntry = list.find((p) => p.id === selected);
  const editedCount = savedEntry ? Object.values(savedEntry.frames).filter((u) => u && u.startsWith("data:")).length : 0;

  /* ── load a class: saved frames if you have them, otherwise the original art ── */
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    framesRef.current = new Map();
    undoRef.current = new Map();
    redoRef.current = new Map();
    setLoading(true);
    (async () => {
      const sheet = await loadSheet();
      const saved = listRef.current.find((p) => p.id === selected);
      const map = new Map<string, Pix>();
      for (const f of FACINGS) for (let i = 0; i < WALK_FRAMES; i++) {
        const k = frameKey(f, i);
        const url = saved?.frames[k];
        let p: Pix | null = null;
        if (url && url.startsWith("data:")) p = await dataUrlToPix(url);
        if (!p && sheet) p = cropOriginal(sheet, selected, f, i);
        map.set(k, p ?? newPix(FRAME_W, FRAME_H));
      }
      if (cancelled) return;
      framesRef.current = map;
      undoRef.current = new Map();
      redoRef.current = new Map();
      setLoading(false);
      bump();
    })();
    return () => { cancelled = true; };
  }, [selected, reloadTick]);

  /* ── saving (automatic, after every stroke / action) ── */
  const persist = useCallback((k: string) => {
    const p = framesRef.current.get(k);
    if (!selected || !p) return;
    const cur = listRef.current;
    const existing = cur.find((e) => e.id === selected);
    const entry: ClassRedraw = {
      id: selected,
      frames: { ...(existing?.frames ?? {}), [k]: pixToDataUrl(p) } as ClassRedraw["frames"],
      updated: Date.now(),
    };
    const next = existing ? cur.map((e) => (e.id === selected ? entry : e)) : [...cur, entry];
    listRef.current = next;
    setList(next);
    setSaveState(saveRedraws(next) ? "saved" : "error");
  }, [selected]);

  /* ── undo / redo (per frame) ── */
  const pushUndo = (k: string) => {
    const cur = framesRef.current.get(k);
    if (!cur) return;
    const st = undoRef.current.get(k) ?? [];
    st.push(cur.slice());
    if (st.length > 60) st.shift();
    undoRef.current.set(k, st);
    redoRef.current.delete(k);
  };
  const undo = () => {
    const st = undoRef.current.get(key);
    const cur = framesRef.current.get(key);
    if (!st?.length || !cur) return;
    const rs = redoRef.current.get(key) ?? [];
    rs.push(cur.slice());
    redoRef.current.set(key, rs);
    framesRef.current.set(key, st.pop()!);
    persist(key); bump();
  };
  const redo = () => {
    const rs = redoRef.current.get(key);
    const cur = framesRef.current.get(key);
    if (!rs?.length || !cur) return;
    const st = undoRef.current.get(key) ?? [];
    st.push(cur.slice());
    undoRef.current.set(key, st);
    framesRef.current.set(key, rs.pop()!);
    persist(key); bump();
  };
  const canUndo = !!undoRef.current.get(key)?.length;
  const canRedo = !!redoRef.current.get(key)?.length;

  /* ── drawing callbacks ── */
  const chooseColor = (hex: string) => {
    setColor(hex);
    if (tool === "erase" || tool === "pick") setTool(tool === "pick" ? prevTool.current : "draw");
    setRecent((r) => [hex, ...r.filter((c) => c !== hex)].slice(0, 10));
  };
  const chooseTool = (t: Tool) => {
    if (t === "pick" && tool !== "pick") prevTool.current = tool === "erase" ? "draw" : tool;
    setTool(t);
  };
  const onStrokeStart = () => pushUndo(key);
  const onStrokeEnd = () => { persist(key); bump(); };
  const onFill = (x: number, y: number) => {
    const cur = framesRef.current.get(key);
    if (!cur) return;
    pushUndo(key);
    if (floodFill(cur, FRAME_W, FRAME_H, x, y, hexToRgba(color))) { persist(key); bump(); }
    else undoRef.current.get(key)?.pop();
  };

  /* ── whole-frame actions ── */
  const replaceFrame = (k: string, p: Pix) => {
    pushUndo(k);
    framesRef.current.set(k, p);
    persist(k); bump();
  };
  const copyFrame = () => { if (pix) clipRef.current = pix.slice(); };
  const pasteFrame = () => { if (clipRef.current) replaceFrame(key, clipRef.current.slice()); };
  const flipFrame = () => { if (pix) replaceFrame(key, flipH(pix, FRAME_W, FRAME_H)); };
  const clearFrame = () => { replaceFrame(key, newPix(FRAME_W, FRAME_H)); };
  const copyToAllWalk = () => {
    if (!pix) return;
    for (let i = 0; i < WALK_FRAMES; i++) { if (i !== frame) replaceFrame(frameKey(facing, i), pix.slice()); }
  };
  const copyToOtherSide = () => {
    if (!pix || (facing !== "left" && facing !== "right")) return;
    const otherFacing: Facing = facing === "left" ? "right" : "left";
    replaceFrame(frameKey(otherFacing, frame), flipH(pix, FRAME_W, FRAME_H));
  };
  const resetFrame = async () => {
    if (!selected) return;
    const sheet = await loadSheet();
    const orig = sheet ? cropOriginal(sheet, selected, facing, frame) : null;
    replaceFrame(key, orig ?? newPix(FRAME_W, FRAME_H));
  };
  const resetClass = () => {
    if (!selected) return;
    if (!window.confirm(`Throw away all your changes to ${current?.name ?? selected} and go back to the original art?`)) return;
    const next = listRef.current.filter((e) => e.id !== selected);
    listRef.current = next;
    setList(next);
    setSaveState(saveRedraws(next) ? "saved" : "error");
    setReloadTick((n) => n + 1);
  };

  /* ── import / export ── */
  const importPack = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) { window.alert("That file isn't a character pack."); return; }
        const merged = [...listRef.current];
        let n = 0;
        for (const item of parsed) {
          if (!item || typeof item.id !== "string" || !item.frames || typeof item.frames !== "object") continue;
          const clean: ClassRedraw = { id: item.id, frames: item.frames, updated: Number(item.updated) || Date.now() };
          const i = merged.findIndex((p) => p.id === clean.id);
          if (i >= 0) merged[i] = clean; else merged.push(clean);
          n++;
        }
        listRef.current = merged;
        setList(merged);
        setSaveState(saveRedraws(merged) ? "saved" : "error");
        setReloadTick((t) => t + 1);
        window.alert(`Imported ${n} class${n === 1 ? "" : "es"}.`);
      } catch { window.alert("Couldn't read that file."); }
    };
    reader.readAsText(file);
  };

  /* ── keyboard shortcuts ── */
  const act = useRef({ undo, redo, chooseTool });
  act.current = { undo, redo, chooseTool };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && t.type !== "range" && t.type !== "color") return;
      if (t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); if (e.shiftKey) act.current.redo(); else act.current.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === "y") { e.preventDefault(); act.current.redo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === "b" || k === "d") act.current.chooseTool("draw");
      else if (k === "e") act.current.chooseTool("erase");
      else if (k === "g") act.current.chooseTool("fill");
      else if (k === "i") act.current.chooseTool("pick");
      else if (k === "m") setMirror((v) => !v);
      else if (k === "[") setBrush((b) => Math.max(1, b - 1));
      else if (k === "]") setBrush((b) => Math.min(4, b + 1));
      else if (k === "arrowleft") { e.preventDefault(); setFrame((f) => (f + WALK_FRAMES - 1) % WALK_FRAMES); }
      else if (k === "arrowright") { e.preventDefault(); setFrame((f) => (f + 1) % WALK_FRAMES); }
      else if (k === "arrowup") { e.preventDefault(); setFacing((f) => FACINGS[(FACINGS.indexOf(f) + FACINGS.length - 1) % FACINGS.length]!); }
      else if (k === "arrowdown") { e.preventDefault(); setFacing((f) => FACINGS[(FACINGS.indexOf(f) + 1) % FACINGS.length]!); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = CLASSES.filter((c) => c.name.toLowerCase().includes(q) || c.id.includes(q));

  const toolBtn = (t: Tool, icon: React.ReactNode, label: string, hint: string) => (
    <button type="button" className={`px-btn ui-btn-sm cr-btn ${tool === t ? "px-btn-kyo" : ""}`} onClick={() => chooseTool(t)} title={hint} aria-pressed={tool === t}>
      {icon}<span>{label}</span>
    </button>
  );

  return (
    <div className="designer-screen">
      <header className="designer-header">
        <div>
          <p className="screen-kicker">CHARACTER REDESIGNER</p>
          <h1 className="screen-title">Redraw a class</h1>
        </div>
        <div className="cr-headright">
          <span className={`cr-status ${saveState === "error" ? "cr-dirty" : ""}`}>
            {saveState === "error" ? "COULD NOT SAVE: STORAGE FULL. EXPORT JSON NOW" : "SAVES AUTOMATICALLY"} · {editedCount}/16 frames redrawn
          </span>
          <button type="button" className="px-btn ui-btn-sm cr-btn" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"><Undo2 size={16} /><span>Undo</span></button>
          <button type="button" className="px-btn ui-btn-sm cr-btn" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)"><Redo2 size={16} /><span>Redo</span></button>
          <button type="button" className="px-btn" onClick={onBack}>Back</button>
        </div>
      </header>

      <ol className="cr-steps">
        <li><b>1.</b> Pick a class on the left.</li>
        <li><b>2.</b> Pick a frame on the right (direction × step). Its original art is already loaded.</li>
        <li><b>3.</b> Click and drag on the big canvas to draw. Everything saves by itself.</li>
      </ol>

      <div className="cr-layout">
        {/* ── classes ── */}
        <div className="cr-classlist">
          <input className="px-input" placeholder="Search classes…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {filtered.map((c) => {
            const entry = list.find((p) => p.id === c.id);
            const n = entry ? Object.values(entry.frames).filter((u) => u && u.startsWith("data:")).length : 0;
            return (
              <button key={c.id} type="button" className={`px-btn ui-btn-sm cr-classbtn ${selected === c.id ? "px-btn-kyo" : ""}`} onClick={() => setSelected(c.id)}>
                <span>{c.name}</span>
                {n > 0 && <span className="cr-count">{n}/16</span>}
              </button>
            );
          })}
          {!filtered.length && <Empty>No classes match.</Empty>}
        </div>

        {/* ── canvas ── */}
        <div className="cr-main">
          {!current && <Empty>Select a class.</Empty>}
          {current && (
            <>
              <div className="cr-title">
                <h2>{current.name} <span className="text-dim">({current.role})</span></h2>
                <span className="cr-status">{FACING_LABEL[facing]} · step {frame}{frame === 0 ? " (standing)" : ""}</span>
              </div>

              <div className="cr-toolbar">
                {toolBtn("draw", <Pencil size={16} />, "Draw", "Draw (B)")}
                {toolBtn("erase", <Eraser size={16} />, "Erase", "Erase (E)")}
                {toolBtn("fill", <PaintBucket size={16} />, "Fill", "Fill an area (G)")}
                {toolBtn("pick", <Pipette size={16} />, "Pick color", "Copy a color from the drawing (I)")}
                <span className="cr-sep" />
                <button type="button" className={`px-btn ui-btn-sm cr-btn ${mirror ? "px-btn-kyo" : ""}`} onClick={() => setMirror(!mirror)} title="Draw on both sides at once (M)" aria-pressed={mirror}>
                  <FlipHorizontal2 size={16} /><span>Mirror</span>
                </button>
                <button type="button" className={`px-btn ui-btn-sm cr-btn ${grid ? "px-btn-kyo" : ""}`} onClick={() => setGrid(!grid)} title="Show pixel grid" aria-pressed={grid}>
                  <Grid3x3 size={16} /><span>Grid</span>
                </button>
              </div>

              <div className="cr-toolbar">
                <label className="cr-slider">Brush {brush}px
                  <input type="range" min={1} max={4} value={brush} onChange={(e) => setBrush(Number(e.target.value))} />
                </label>
                <label className="cr-slider">Zoom {zoom}x
                  <input type="range" min={5} max={16} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
                </label>
              </div>

              <div className="cr-work">
                {loading ? (
                  <div className="cr-loading" style={{ width: FRAME_W * zoom, height: FRAME_H * zoom }}>Loading frames…</div>
                ) : (
                  <PixelCanvas
                    pix={pix}
                    version={version}
                    zoom={zoom}
                    grid={grid}
                    tool={tool}
                    color={color}
                    brush={brush}
                    mirror={mirror}
                    onStrokeStart={onStrokeStart}
                    onStrokeEnd={onStrokeEnd}
                    onPick={chooseColor}
                    onFill={onFill}
                  />
                )}

                <div className="cr-palette">
                  <div className="cr-current">
                    <span className="cr-swatch big" style={{ background: tool === "erase" ? "transparent" : color }} />
                    <input type="color" value={color} onChange={(e) => chooseColor(e.target.value)} title="Pick any color" />
                  </div>
                  <div className="cr-swatches">
                    {PALETTE.map((c) => (
                      <button key={c} type="button" className={`cr-swatch ${color.toLowerCase() === c ? "on" : ""}`} style={{ background: c }} title={c} onClick={() => chooseColor(c)} />
                    ))}
                  </div>
                  {recent.length > 0 && (
                    <>
                      <div className="text-dim cr-small">Recent</div>
                      <div className="cr-swatches">
                        {recent.map((c) => (
                          <button key={c} type="button" className={`cr-swatch ${color.toLowerCase() === c.toLowerCase() ? "on" : ""}`} style={{ background: c }} title={c} onClick={() => chooseColor(c)} />
                        ))}
                      </div>
                    </>
                  )}
                  {!hasOriginal && <p className="text-dim cr-small">This class has no original art on the sheet, so you're starting from a blank canvas.</p>}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── side panel ── */}
        <div className="cr-tools">
          <Section title="Frames">
            <div className="cr-framegrid" aria-label="All frames">
              <span />
              {Array.from({ length: WALK_FRAMES }, (_, i) => <span key={i} className="cr-colhead">{i === 0 ? "stand" : `step ${i}`}</span>)}
              {FACINGS.map((f) => (
                <FrameRow key={f} facing={f} activeFacing={facing} activeFrame={frame} framesRef={framesRef} version={version} edited={savedEntry?.frames} onPick={(fa, fr) => { setFacing(fa); setFrame(fr); }} />
              ))}
            </div>
          </Section>

          <Section title="Preview">
            <Preview framesRef={framesRef} facing={facing} frame={frame} playing={playing} speed={speed} />
            <div className="cr-toolbar" style={{ marginBottom: 0 }}>
              <button type="button" className="px-btn ui-btn-sm cr-btn" onClick={() => setPlaying(!playing)}>
                {playing ? <Pause size={16} /> : <Play size={16} />}<span>{playing ? "Pause" : "Walk"}</span>
              </button>
              <label className="cr-slider">Speed
                <input type="range" min={2} max={12} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
              </label>
            </div>
          </Section>

          <Section title="This frame">
            <div className="cr-actions">
              <button type="button" className="px-btn ui-btn-sm cr-btn" onClick={copyFrame}><Copy size={16} /><span>Copy</span></button>
              <button type="button" className="px-btn ui-btn-sm cr-btn" onClick={pasteFrame}><ClipboardPaste size={16} /><span>Paste</span></button>
              <button type="button" className="px-btn ui-btn-sm cr-btn" onClick={flipFrame}><FlipHorizontal2 size={16} /><span>Flip</span></button>
              <button type="button" className="px-btn ui-btn-sm cr-btn" onClick={clearFrame}><Trash2 size={16} /><span>Clear</span></button>
              <button type="button" className="px-btn ui-btn-sm cr-btn cr-wide" onClick={copyToAllWalk}>Copy to all 4 steps facing {facing}</button>
              {(facing === "left" || facing === "right") && (
                <button type="button" className="px-btn ui-btn-sm cr-btn cr-wide" onClick={copyToOtherSide}>Flip-copy to {facing === "left" ? "right" : "left"} side</button>
              )}
              <button type="button" className="px-btn ui-btn-sm cr-btn cr-wide" onClick={() => void resetFrame()}><RotateCcw size={16} /><span>Reset to original</span></button>
            </div>
          </Section>

          <Section title="Save / share">
            <div className="cr-actions">
              <button type="button" className="px-btn ui-btn-sm cr-btn cr-wide" onClick={() => download("class-redraws.json", list)}><Download size={16} /><span>Export JSON</span></button>
              <label className="px-btn ui-btn-sm cr-btn cr-wide">
                <Upload size={16} /><span>Import JSON</span>
                <input type="file" accept="application/json,.json" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) importPack(f); e.target.value = ""; }} />
              </label>
              <button type="button" className="px-btn ui-btn-sm cr-btn cr-wide" onClick={resetClass}><RotateCcw size={16} /><span>Reset this class</span></button>
            </div>
          </Section>

          <p className="text-dim cr-small">
            Shortcuts: B draw · E erase · G fill · I pick color · M mirror · [ ] brush size · arrows change frame · Ctrl+Z undo · Ctrl+Y redo
          </p>
        </div>
      </div>
    </div>
  );
}

function FrameRow({ facing, activeFacing, activeFrame, framesRef, version, edited, onPick }: {
  facing: Facing; activeFacing: Facing; activeFrame: number;
  framesRef: FramesRef; version: number;
  edited: ClassRedraw["frames"] | undefined;
  onPick: (f: Facing, i: number) => void;
}) {
  return (
    <>
      <span className="cr-rowhead">{facing}</span>
      {Array.from({ length: WALK_FRAMES }, (_, i) => {
        const k = frameKey(facing, i);
        const on = facing === activeFacing && i === activeFrame;
        const mine = !!edited?.[k];
        return (
          <button key={k} type="button" className={`cr-framecell ${on ? "on" : ""} ${mine ? "mine" : ""}`} onClick={() => onPick(facing, i)} title={`${facing}, ${i === 0 ? "standing" : `step ${i}`}${mine ? " (redrawn)" : " (original)"}`}>
            <Thumb pix={framesRef.current.get(k)} version={version} />
          </button>
        );
      })}
    </>
  );
}
