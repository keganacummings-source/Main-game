import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as RPointerEvent } from "react";
import { loadTileCatalog, type TileCatalog } from "@/game/tile-atlas";
import {
  CAMP_CATEGORIES, TILE_CATEGORIES, groupOf, loadPack, savePack, syncTileOverrides, validAsset,
  type Asset, type AssetGroup, type AssetSize,
} from "@/game/camp-assets";

type Tool = "pen" | "erase" | "fill" | "pick";
const SHOW = 320; // on-screen size of the editing canvas, in CSS pixels
/** A ready-made palette, grouped so it is quick to find a colour: greens, earth, stone, water, fire, magic, light/dark. */
const PALETTE: { name: string; colors: string[] }[] = [
  { name: "Greens", colors: ["#1f3d1c", "#2d5a2a", "#4f9a45", "#7cc35a", "#a8dc7a", "#d4f0a0"] },
  { name: "Earth", colors: ["#2b1a0e", "#4a2e1a", "#6b3e26", "#9a6a3c", "#c79a5e", "#e4c48e"] },
  { name: "Stone", colors: ["#141214", "#2a2226", "#3d3338", "#6e6258", "#a08478", "#cfc3b4"] },
  { name: "Water", colors: ["#0c2a4a", "#14507e", "#2a78b0", "#4ea4d8", "#7ec8ff", "#cdeeff"] },
  { name: "Fire", colors: ["#4a0f0a", "#8a1c10", "#c8341c", "#ff4d2e", "#ff8a2e", "#ffc45b"] },
  { name: "Magic", colors: ["#2a1648", "#4c3a6e", "#7d62c8", "#a98af0", "#d2486e", "#ff9ac0"] },
  { name: "Light & dark", colors: ["#000000", "#26211e", "#7a726a", "#bdb5a8", "#e8dcc4", "#ffffff"] },
];
const ALL_PALETTE = new Set(PALETTE.flatMap((g) => g.colors));
const COLORS_KEY = "turbz-asset-colors-v1";
const GRID_KEY = "turbz-asset-grid-v1";
const GRID_N = 6;
const MAX_CUSTOM = 36;

function loadColors(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(COLORS_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)).slice(0, MAX_CUSTOM) : [];
  } catch { return []; }
}
function saveColors(list: string[]) { try { localStorage.setItem(COLORS_KEY, JSON.stringify(list)); } catch { /* private mode */ } }
function loadGrid(): (string | null)[] {
  const blank = Array<string | null>(GRID_N * GRID_N).fill(null);
  try {
    const raw = JSON.parse(localStorage.getItem(GRID_KEY) ?? "null");
    if (!Array.isArray(raw)) return blank;
    return blank.map((_, i) => (typeof raw[i] === "string" ? raw[i] : null));
  } catch { return blank; }
}
function saveGrid(g: (string | null)[]) { try { localStorage.setItem(GRID_KEY, JSON.stringify(g)); } catch { /* storage full: the grid is a scratchpad */ } }

const CANVAS_BRUSH = "__canvas";
const CHECKER = "repeating-conic-gradient(#2a2a2a 0% 25%, #3a3a3a 0% 50%) 0 0 / 32px 32px";

function hexToRgba(hex: string): [number, number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0, 255];
}
function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}
function download(name: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
}

export function CampAssetBuilder({ onBack }: { onBack: () => void }) {
  const [assets, setAssets] = useState<Asset[]>(loadPack);
  const [group, setGroup] = useState<AssetGroup>("tile");
  const [category, setCategory] = useState<string>("floor");
  const [name, setName] = useState("New Piece");
  const [size, setSize] = useState<AssetSize>(32);
  const [color, setColor] = useState("#6b3e26");
  const [tool, setTool] = useState<Tool>("pen");
  const [solid, setSolid] = useState(false);
  const [live, setLive] = useState(false);
  const [replaces, setReplaces] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<TileCatalog | null>(null);
  const [pickFolder, setPickFolder] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState("");
  const [mirrorX, setMirrorX] = useState(false);
  const [mirrorY, setMirrorY] = useState(false);
  const [custom, setCustom] = useState<string[]>(loadColors);
  const [grid, setGrid] = useState<(string | null)[]>(loadGrid);
  const [brush, setBrush] = useState<string | null>(null);
  const [gridErase, setGridErase] = useState(false);
  const [gridLines, setGridLines] = useState(true);
  const [libFilter, setLibFilter] = useState<"tile" | "camp" | "all">("tile");
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const undo = useRef<ImageData[]>([]);

  useEffect(() => { void loadTileCatalog().then(setCatalog); }, []);

  function ctx2d() { return canvasRef.current!.getContext("2d", { willReadFrequently: true })!; }
  function refreshPreview() { try { setPreview(canvasRef.current!.toDataURL("image/png")); } catch { setPreview(""); } }

  // Changing the size resets the canvas (a new, transparent one).
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = size;
    c.height = size;
    undo.current = [];
    refreshPreview();
  }, [size]);

  function snapshot() {
    undo.current.push(ctx2d().getImageData(0, 0, size, size));
    if (undo.current.length > 40) undo.current.shift();
  }
  function undoLast() {
    const prev = undo.current.pop();
    if (!prev) return;
    ctx2d().putImageData(prev, 0, 0);
    refreshPreview();
  }

  function getPos(e: RPointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * size);
    const y = Math.floor(((e.clientY - r.top) / r.height) * size);
    return { x: Math.max(0, Math.min(size - 1, x)), y: Math.max(0, Math.min(size - 1, y)) };
  }

  /** Remember a colour you used so it is one click away next time. Palette colours are not duplicated. */
  function rememberColor(hex: string) {
    const c = hex.toLowerCase();
    if (ALL_PALETTE.has(c)) return;
    setCustom((prev) => {
      const next = [c, ...prev.filter((x) => x !== c)].slice(0, MAX_CUSTOM);
      saveColors(next);
      return next;
    });
  }
  function chooseColor(hex: string) {
    setColor(hex);
    if (tool === "erase" || tool === "pick") setTool("pen");
  }

  /** The point plus its mirror images, without repeats. */
  function mirrored(x: number, y: number) {
    const pts = [{ x, y }];
    if (mirrorX) pts.push({ x: size - 1 - x, y });
    if (mirrorY) pts.push({ x, y: size - 1 - y });
    if (mirrorX && mirrorY) pts.push({ x: size - 1 - x, y: size - 1 - y });
    return pts.filter((p, i) => pts.findIndex((q) => q.x === p.x && q.y === p.y) === i);
  }

  function floodFill(sx: number, sy: number) {
    const g = ctx2d();
    const img = g.getImageData(0, 0, size, size);
    const d = img.data;
    const at = (x: number, y: number) => (y * size + x) * 4;
    const i0 = at(sx, sy);
    const target = [d[i0]!, d[i0 + 1]!, d[i0 + 2]!, d[i0 + 3]!];
    const fill = tool === "erase" ? [0, 0, 0, 0] : hexToRgba(color);
    if (target.every((v, k) => v === fill[k])) return;
    const stack: number[] = [sx, sy];
    while (stack.length) {
      const y = stack.pop()!, x = stack.pop()!;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const i = at(x, y);
      if (d[i] !== target[0] || d[i + 1] !== target[1] || d[i + 2] !== target[2] || d[i + 3] !== target[3]) continue;
      d[i] = fill[0]!; d[i + 1] = fill[1]!; d[i + 2] = fill[2]!; d[i + 3] = fill[3]!;
      stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }
    g.putImageData(img, 0, 0);
  }

  function dot(x: number, y: number) {
    const g = ctx2d();
    for (const p of mirrored(x, y)) {
      if (tool === "erase") g.clearRect(p.x, p.y, 1, 1);
      else { g.fillStyle = color; g.fillRect(p.x, p.y, 1, 1); }
    }
  }
  /** A straight run of pixels between two points, so a fast drag leaves no gaps. */
  function line(x0: number, y0: number, x1: number, y1: number) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    for (let guard = 0; guard < 400; guard++) {
      dot(x, y);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  function onDown(e: RPointerEvent) {
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    const p = getPos(e);
    if (tool === "pick") {
      const px = ctx2d().getImageData(p.x, p.y, 1, 1).data;
      if (px[3]) { const hex = rgbToHex(px[0]!, px[1]!, px[2]!); setColor(hex); rememberColor(hex); }
      setTool("pen");
      return;
    }
    snapshot();
    if (tool === "fill") {
      for (const q of mirrored(p.x, p.y)) floodFill(q.x, q.y);
      rememberColor(color);
      refreshPreview();
      return;
    }
    if (tool === "pen") rememberColor(color);
    drawing.current = true;
    lastPt.current = p;
    dot(p.x, p.y);
    refreshPreview();
  }
  function onMove(e: RPointerEvent) {
    if (!drawing.current) return;
    const p = getPos(e);
    const l = lastPt.current ?? p;
    if (l.x !== p.x || l.y !== p.y) { line(l.x, l.y, p.x, p.y); lastPt.current = p; refreshPreview(); }
  }
  function onUp() { drawing.current = false; lastPt.current = null; }

  /** Flip or turn the whole piece. */
  function transform(kind: "flipH" | "flipV" | "rotate") {
    const c = canvasRef.current;
    if (!c) return;
    snapshot();
    const copy = document.createElement("canvas");
    copy.width = size; copy.height = size;
    copy.getContext("2d")!.drawImage(c, 0, 0);
    const g = ctx2d();
    g.clearRect(0, 0, size, size);
    g.save();
    g.imageSmoothingEnabled = false;
    if (kind === "flipH") { g.translate(size, 0); g.scale(-1, 1); }
    else if (kind === "flipV") { g.translate(0, size); g.scale(1, -1); }
    else { g.translate(size, 0); g.rotate(Math.PI / 2); }
    g.drawImage(copy, 0, 0);
    g.restore();
    refreshPreview();
  }

  function clearCanvas() { snapshot(); ctx2d().clearRect(0, 0, size, size); refreshPreview(); }

  function pickGroup(g: AssetGroup) {
    setGroup(g);
    setCategory(g === "tile" ? "floor" : "walls");
    setReplaces("");
    setLive(false);
  }

  const tileCat = TILE_CATEGORIES.find((c) => c.id === category);
  const folderId = pickFolder || tileCat?.folder || "";
  const folderTiles = catalog?.categories.find((c) => c.id === folderId)?.tiles ?? [];

  /** Copy a pack tile into the editor so it can be redrawn or traced. */
  function loadPackTile(path: string) {
    if (!path) return;
    const img = new Image();
    img.onload = () => {
      const n = img.naturalWidth;
      const next: AssetSize = n <= 16 ? 16 : n <= 32 ? 32 : 64;
      const paint = () => {
        const g = ctx2d();
        g.clearRect(0, 0, next, next);
        g.imageSmoothingEnabled = false;
        g.drawImage(img, 0, 0, next, next);
        undo.current = [];
        refreshPreview();
      };
      if (next !== size) { setSize(next); setTimeout(paint, 0); } else paint();
    };
    img.onerror = () => setNote("Could not load that tile.");
    img.src = path;
  }

  function newPiece() {
    setEditingId(null);
    setName("New Piece");
    setReplaces("");
    setLive(false);
    setSolid(false);
    clearCanvas();
  }

  function saveAsset() {
    const c = canvasRef.current;
    if (!c) return;
    const asset: Asset = {
      id: editingId ?? `ca-${Date.now().toString(36)}`,
      name: name.trim() || "Untitled",
      group,
      category,
      pixels: c.toDataURL("image/png"),
      size,
      created: Date.now(),
      ...(group === "tile" ? { solid, replaces: replaces || undefined, live: !!(live && replaces) } : {}),
    };
    const next = editingId && assets.some((a) => a.id === editingId) ? assets.map((a) => (a.id === editingId ? asset : a)) : [...assets, asset];
    setAssets(next);
    if (!savePack(next)) setNote("Could not save on this device (storage full or blocked). Export the pack to keep it.");
    else setNote(editingId ? "Updated." : "Saved.");
    syncTileOverrides(next);
    setEditingId(asset.id);
  }

  function editAsset(a: Asset) {
    const img = new Image();
    img.onload = () => {
      setGroup(groupOf(a));
      setCategory(a.category);
      setName(a.name);
      setSolid(!!a.solid);
      setLive(!!a.live);
      setReplaces(a.replaces ?? "");
      setEditingId(a.id);
      const paint = () => { const g = ctx2d(); g.clearRect(0, 0, a.size, a.size); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0); undo.current = []; refreshPreview(); };
      if (a.size !== size) { setSize(a.size); setTimeout(paint, 0); } else paint();
    };
    img.src = a.pixels;
  }

  function removeAsset(id: string) {
    const next = assets.filter((a) => a.id !== id);
    setAssets(next);
    savePack(next);
    syncTileOverrides(next);
    if (editingId === id) setEditingId(null);
  }

  function exportJSON() {
    const body = { format: "turbz-asset-pack", version: 2, exported: new Date().toISOString(), assets };
    const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
    download("turbz-asset-pack.json", URL.createObjectURL(blob));
  }

  function importJSON(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so importing the same file twice still fires
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.assets) ? parsed.assets : null;
        if (!list) { setNote("That file is not an asset pack."); return; }
        const ok: Asset[] = list.filter(validAsset);
        const byId = new Map<string, Asset>(assets.map((a): [string, Asset] => [a.id, a]));
        for (const a of ok) byId.set(a.id, a);
        const next: Asset[] = Array.from(byId.values()) as Asset[];
        setAssets(next);
        savePack(next);
        syncTileOverrides(next);
        setNote(`Imported ${ok.length} piece${ok.length === 1 ? "" : "s"}.`);
      } catch { setNote("That file could not be read."); }
    };
    reader.readAsText(file);
  }

  const byId = new Map<string, Asset>(assets.map((a): [string, Asset] => [a.id, a]));
  /** What a grid cell shows: a saved piece (follows later edits) or a snapshot of the canvas. */
  function cellSrc(v: string | null): string | null {
    if (!v) return null;
    if (v.startsWith("data:")) return v;
    return byId.get(v)?.pixels ?? null;
  }
  function placeCell(i: number) {
    const next = grid.slice();
    if (gridErase) next[i] = null;
    else if (brush === CANVAS_BRUSH) next[i] = preview || null;
    else if (brush && byId.has(brush)) next[i] = brush;
    else { setNote("Pick a tile from the list first (or choose Current canvas)."); return; }
    setGrid(next);
    saveGrid(next);
  }
  function setAllCells(v: string | null) {
    const next = Array<string | null>(GRID_N * GRID_N).fill(v);
    setGrid(next);
    saveGrid(next);
  }
  function fillGrid() {
    if (brush === CANVAS_BRUSH) return setAllCells(preview || null);
    if (brush && byId.has(brush)) return setAllCells(brush);
    setNote("Pick a tile from the list first.");
  }
  async function exportGridPng() {
    const cell = 32;
    const out = document.createElement("canvas");
    out.width = GRID_N * cell; out.height = GRID_N * cell;
    const g = out.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    await Promise.all(grid.map((v, i) => new Promise<void>((done) => {
      const src = cellSrc(v);
      if (!src) return done();
      const img = new Image();
      img.onload = () => { g.drawImage(img, (i % GRID_N) * cell, Math.floor(i / GRID_N) * cell, cell, cell); done(); };
      img.onerror = () => done();
      img.src = src;
    })));
    download("tile-test-grid.png", out.toDataURL("image/png"));
  }

  // Keyboard: B pen, E eraser, G fill, I pick, H / V mirror, Ctrl+Z undo. Ignored while typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undoLast(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "b") setTool("pen");
      else if (k === "e") setTool("erase");
      else if (k === "g") setTool("fill");
      else if (k === "i") setTool("pick");
      else if (k === "h") setMirrorX((v) => !v);
      else if (k === "v") setMirrorY((v) => !v);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const library = assets.filter((a) => libFilter === "all" || groupOf(a) === libFilter);
  const cats: { id: string; label: string }[] = group === "tile" ? TILE_CATEGORIES.map((c) => ({ id: c.id, label: c.label })) : CAMP_CATEGORIES.map((c) => ({ id: c, label: c }));
  const tileUrl = preview ? `url(${preview})` : "none";
  const on = (v: boolean) => (v ? { outline: "3px solid #ffc45b" } : undefined);
  const brushAsset = brush && brush !== CANVAS_BRUSH ? byId.get(brush) ?? null : null;
  const cellPx = 48;

  return (
    <div className="designer-screen">
      <header className="designer-header">
        <div>
          <p className="screen-kicker">DESIGNER MODE</p>
          <h1 className="screen-title">Camp &amp; Tile Asset Builder</h1>
        </div>
        <button type="button" className="px-btn" onClick={onBack}>Back</button>
      </header>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 16px" }}>
        <button type="button" className="px-btn" onClick={() => pickGroup("tile")} style={on(group === "tile")}>Map tiles</button>
        <button type="button" className="px-btn" onClick={() => pickGroup("camp")} style={on(group === "camp")}>Camp pieces</button>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: 16, alignItems: "flex-start" }}>
        {/* ---- Left: settings ---- */}
        <div style={{ display: "grid", gap: 8, minWidth: 220, maxWidth: 300 }}>
          <label>Kind
            <select value={category} onChange={(e) => { setCategory(e.target.value); setPickFolder(""); }}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label>Name
            <input className="px-input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>Size
            <select value={size} onChange={(e) => setSize(Number(e.target.value) as AssetSize)}>
              <option value={16}>16×16</option>
              <option value={32}>32×32 (pack tile size)</option>
              <option value={64}>64×64</option>
            </select>
          </label>

          {group === "tile" && (
            <>
              <label>Pack folder to pick from
                <select value={folderId} onChange={(e) => setPickFolder(e.target.value)}>
                  <option value="">(choose a folder)</option>
                  {(catalog?.categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.label} ({c.count})</option>)}
                </select>
              </label>
              <label>Pack tile to replace
                <select value={replaces} onChange={(e) => setReplaces(e.target.value)} disabled={!folderTiles.length}>
                  <option value="">(none — a brand-new tile)</option>
                  {folderTiles.map((t) => <option key={t.id} value={t.path}>{t.file}</option>)}
                  {replaces && !folderTiles.some((t) => t.path === replaces) && <option value={replaces}>{replaces.split("/").pop()}</option>}
                </select>
              </label>
              <button type="button" className="px-btn" disabled={!replaces} onClick={() => loadPackTile(replaces)}>Load that tile into the editor</button>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={solid} onChange={(e) => setSolid(e.target.checked)} style={{ minHeight: 0 }} /> Blocks movement
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={live} disabled={!replaces} onChange={(e) => setLive(e.target.checked)} style={{ minHeight: 0 }} /> Use in game now (replaces that tile)
              </label>
            </>
          )}

          <button type="button" className="px-btn" onClick={saveAsset}>{editingId ? "Update piece" : "Save piece"}</button>
          <button type="button" className="px-btn" onClick={newPiece}>New piece</button>
          <button type="button" className="px-btn" onClick={() => preview && download(`${(name.trim() || "piece").replace(/\W+/g, "_")}.png`, preview)}>Download this as PNG</button>
          {note && <p style={{ fontSize: 12, color: "#ffc45b" }}>{note}</p>}
        </div>

        {/* ---- Middle: the editor ---- */}
        <div style={{ maxWidth: SHOW + 8 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {(["pen", "erase", "fill", "pick"] as Tool[]).map((t) => (
              <button key={t} type="button" className="px-btn" onClick={() => setTool(t)} style={on(tool === t)} title={`Shortcut: ${t === "pen" ? "B" : t === "erase" ? "E" : t === "fill" ? "G" : "I"}`}>
                {t === "pen" ? "Pen" : t === "erase" ? "Eraser" : t === "fill" ? "Fill" : "Pick"}
              </button>
            ))}
            <button type="button" className="px-btn" onClick={undoLast} title="Ctrl+Z">Undo</button>
            <button type="button" className="px-btn" onClick={clearCanvas}>Clear</button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            <button type="button" className="px-btn" onClick={() => setMirrorX((v) => !v)} style={on(mirrorX)} title="Shortcut: H">Mirror ↔</button>
            <button type="button" className="px-btn" onClick={() => setMirrorY((v) => !v)} style={on(mirrorY)} title="Shortcut: V">Mirror ↕</button>
            <button type="button" className="px-btn" onClick={() => transform("flipH")}>Flip ↔</button>
            <button type="button" className="px-btn" onClick={() => transform("flipV")}>Flip ↕</button>
            <button type="button" className="px-btn" onClick={() => transform("rotate")}>Rotate ⟳</button>
          </div>

          <div style={{ position: "relative", width: SHOW, height: SHOW }}>
            <canvas
              ref={canvasRef}
              width={size}
              height={size}
              style={{ width: SHOW, height: SHOW, imageRendering: "pixelated", border: "2px solid #666", background: CHECKER, cursor: tool === "pick" ? "copy" : "crosshair", touchAction: "none", boxSizing: "content-box" }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            />
            {/* Centre lines show where mirroring folds the drawing. */}
            {mirrorX && <div style={{ position: "absolute", left: SHOW / 2 + 1, top: 2, width: 0, height: SHOW, borderLeft: "1px dashed #ffc45b", pointerEvents: "none" }} />}
            {mirrorY && <div style={{ position: "absolute", top: SHOW / 2 + 1, left: 2, height: 0, width: SHOW, borderTop: "1px dashed #ffc45b", pointerEvents: "none" }} />}
          </div>
          <p style={{ fontSize: 12, opacity: 0.7 }}>Click, drag or touch to paint. Keys: B pen, E eraser, G fill, I pick, H / V mirror, Ctrl+Z undo.</p>

          {/* Palette */}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <input type="color" value={color} aria-label="Pick any colour" onChange={(e) => chooseColor(e.target.value)} style={{ width: 44, height: 32, padding: 0 }} />
              <code style={{ fontSize: 12 }}>{color}</code>
              <button type="button" className="px-btn" onClick={() => rememberColor(color)}>Save colour</button>
            </div>
            {PALETTE.map((grp) => (
              <div key={grp.name} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                <span style={{ fontSize: 10, opacity: 0.6, width: 64 }}>{grp.name}</span>
                {grp.colors.map((c) => (
                  <button key={c} type="button" aria-label={c} title={c} onClick={() => chooseColor(c)} style={{ width: 26, height: 26, background: c, border: c === color.toLowerCase() ? "3px solid #ffc45b" : "2px solid #555", padding: 0, cursor: "pointer" }} />
                ))}
              </div>
            ))}
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 3 }}>Your colours ({custom.length}) — saved automatically as you paint</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxWidth: SHOW }}>
                {custom.map((c) => (
                  <button key={c} type="button" aria-label={c} title={`${c} (shift-click to remove)`} onClick={(e) => {
                    if (e.shiftKey) { const next = custom.filter((x) => x !== c); setCustom(next); saveColors(next); } else chooseColor(c);
                  }} style={{ width: 26, height: 26, background: c, border: c === color.toLowerCase() ? "3px solid #ffc45b" : "2px solid #555", padding: 0, cursor: "pointer" }} />
                ))}
                {!custom.length && <em style={{ fontSize: 12, opacity: 0.6 }}>None yet</em>}
              </div>
              {custom.length > 0 && <button type="button" className="px-btn" style={{ marginTop: 6 }} onClick={() => { setCustom([]); saveColors([]); }}>Clear my colours</button>}
            </div>
          </div>

          {group === "tile" && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 12, opacity: 0.7 }}>Seamless check (3×3 repeat) and actual size:</p>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 96, height: 96, backgroundImage: tileUrl, backgroundSize: "32px 32px", imageRendering: "pixelated", border: "1px solid #444", backgroundColor: "#222" }} />
                {preview && <img src={preview} alt="actual size" width={size} height={size} style={{ imageRendering: "pixelated", border: "1px solid #444" }} />}
              </div>
            </div>
          )}
        </div>

        {/* ---- Right: your tiles + 6x6 test grid ---- */}
        <div style={{ flex: 1, minWidth: 260, maxWidth: 340, display: "grid", gap: 10 }}>
          <div>
            <h3>Your tiles ({library.length})</h3>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              {(["tile", "camp", "all"] as const).map((f) => (
                <button key={f} type="button" className="px-btn" onClick={() => setLibFilter(f)} style={on(libFilter === f)}>{f === "tile" ? "Tiles" : f === "camp" ? "Camp" : "All"}</button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))", gap: 6, maxHeight: 250, overflowY: "auto", padding: 4, border: "2px solid #444" }}>
              <button type="button" onClick={() => { setBrush(CANVAS_BRUSH); setGridErase(false); }} title="Place what you are drawing right now" style={{ padding: 2, background: "#222", border: brush === CANVAS_BRUSH ? "3px solid #ffc45b" : "2px solid #555", cursor: "pointer", color: "inherit", fontSize: 10 }}>
                <div style={{ width: "100%", aspectRatio: "1", backgroundImage: tileUrl, backgroundSize: "100% 100%", imageRendering: "pixelated", backgroundColor: "#111" }} />
                Current
              </button>
              {library.map((a) => (
                <button key={a.id} type="button" onClick={() => { setBrush(a.id); setGridErase(false); }} title={a.name} style={{ padding: 2, background: "#222", border: brush === a.id ? "3px solid #ffc45b" : a.live ? "2px solid #4f9a45" : "2px solid #555", cursor: "pointer", color: "inherit", fontSize: 10, overflow: "hidden" }}>
                  <div style={{ width: "100%", aspectRatio: "1", imageRendering: "pixelated", background: `url(${a.pixels}) center / 100% 100% no-repeat, ${CHECKER}` }} />
                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                </button>
              ))}
            </div>
            {!library.length && <p style={{ fontSize: 12, opacity: 0.6 }}>Nothing saved here yet. Draw something and press Save piece.</p>}
            {brushAsset && (
              <div style={{ marginTop: 6, fontSize: 12 }}>
                <strong>{brushAsset.name}</strong> · {TILE_CATEGORIES.find((c) => c.id === brushAsset.category)?.label ?? brushAsset.category}{brushAsset.live ? " · live in game" : ""}
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <button type="button" className="px-btn" onClick={() => editAsset(brushAsset)}>Edit</button>
                  <button type="button" className="px-btn" onClick={() => { removeAsset(brushAsset.id); setBrush(null); }}>Delete</button>
                </div>
              </div>
            )}
          </div>

          <div>
            <h3>6×6 test grid</h3>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              <button type="button" className="px-btn" onClick={() => setGridErase((v) => !v)} style={on(gridErase)}>{gridErase ? "Erasing" : "Place"}</button>
              <button type="button" className="px-btn" onClick={fillGrid}>Fill all</button>
              <button type="button" className="px-btn" onClick={() => setAllCells(null)}>Clear</button>
              <button type="button" className="px-btn" onClick={() => setGridLines((v) => !v)} style={on(gridLines)}>Lines</button>
              <button type="button" className="px-btn" onClick={() => void exportGridPng()}>PNG</button>
            </div>
            <div
              style={{ display: "grid", gridTemplateColumns: `repeat(${GRID_N}, ${cellPx}px)`, width: GRID_N * cellPx, border: "2px solid #666", background: "#1a1a1a", touchAction: "manipulation", userSelect: "none" }}
              onContextMenu={(e) => e.preventDefault()}
            >
              {grid.map((v, i) => {
                const src = cellSrc(v);
                return (
                  <div
                    key={i}
                    onPointerDown={() => placeCell(i)}
                    onPointerEnter={(e) => { if (e.buttons === 1 && e.pointerType === "mouse") placeCell(i); }}
                    style={{ width: cellPx, height: cellPx, boxSizing: "border-box", border: gridLines ? "1px solid rgba(255,255,255,.12)" : "none", background: src ? `url(${src}) center / 100% 100% no-repeat` : undefined, imageRendering: "pixelated", cursor: "pointer" }}
                  />
                );
              })}
            </div>
            <p style={{ fontSize: 12, opacity: 0.7 }}>Pick a tile above, then click or drag across the grid to see how it tiles next to your others. Edits to a saved tile show up here too.</p>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="px-btn" onClick={exportJSON}>Export pack JSON</button>
            <label className="px-btn" style={{ display: "inline-block" }}>
              Import pack JSON
              <input type="file" accept="application/json,.json" onChange={importJSON} style={{ display: "none" }} />
            </label>
          </div>
        </div>
      </div>

      <p className="designer-status">Pieces, colours and the grid stay on this device. Tiles marked "use in game now" replace the pack art in your game right away. Export the pack JSON to ship them in a game update.</p>
    </div>
  );
}
