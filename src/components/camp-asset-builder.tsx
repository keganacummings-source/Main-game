import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as RPointerEvent } from "react";
import { loadTileCatalog, type TileCatalog } from "@/game/tile-atlas";
import {
  CAMP_CATEGORIES, TILE_CATEGORIES, groupOf, loadPack, savePack, syncTileOverrides, validAsset,
  type Asset, type AssetGroup, type AssetSize,
} from "@/game/camp-assets";

type Tool = "pen" | "erase" | "fill" | "pick";
const SHOW = 320; // on-screen size of the editing canvas, in CSS pixels
const SWATCHES = ["#000000", "#ffffff", "#6b3e26", "#9a6a3c", "#4f9a45", "#2d5a2a", "#6e6258", "#3a322c", "#2a78b0", "#7ec8ff", "#c56a3c", "#ff4d2e", "#ffc45b", "#e8dcc4", "#7d62c8", "#d2486e"];
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

  function apply(x: number, y: number, first: boolean) {
    const g = ctx2d();
    if (tool === "pick") {
      const p = g.getImageData(x, y, 1, 1).data;
      if (p[3]) setColor(rgbToHex(p[0]!, p[1]!, p[2]!));
      setTool("pen");
      return;
    }
    if (tool === "fill") { if (first) { snapshot(); floodFill(x, y); refreshPreview(); } return; }
    if (tool === "erase") g.clearRect(x, y, 1, 1);
    else { g.fillStyle = color; g.fillRect(x, y, 1, 1); }
  }

  function onDown(e: RPointerEvent) {
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    const p = getPos(e);
    if (tool === "pen" || tool === "erase") snapshot();
    drawing.current = tool === "pen" || tool === "erase";
    apply(p.x, p.y, true);
    if (!drawing.current) return;
    refreshPreview();
  }
  function onMove(e: RPointerEvent) {
    if (!drawing.current) return;
    const p = getPos(e);
    apply(p.x, p.y, false);
    refreshPreview();
  }
  function onUp() { drawing.current = false; }

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
        const byId = new Map(assets.map((a) => [a.id, a] as const));
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

  const shown = assets.filter((a) => groupOf(a) === group);
  const cats: { id: string; label: string }[] = group === "tile" ? TILE_CATEGORIES.map((c) => ({ id: c.id, label: c.label })) : CAMP_CATEGORIES.map((c) => ({ id: c, label: c }));
  const tileUrl = preview ? `url(${preview})` : "none";

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
        <button type="button" className="px-btn" onClick={() => pickGroup("tile")} style={group === "tile" ? { outline: "3px solid #ffc45b" } : undefined}>Map tiles</button>
        <button type="button" className="px-btn" onClick={() => pickGroup("camp")} style={group === "camp" ? { outline: "3px solid #ffc45b" } : undefined}>Camp pieces</button>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: 16 }}>
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

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["pen", "erase", "fill", "pick"] as Tool[]).map((t) => (
              <button key={t} type="button" className="px-btn" onClick={() => setTool(t)} style={tool === t ? { outline: "3px solid #ffc45b" } : undefined}>
                {t === "pen" ? "Pen" : t === "erase" ? "Eraser" : t === "fill" ? "Fill" : "Pick colour"}
              </button>
            ))}
          </div>
          <label>Colour
            <input type="color" value={color} onChange={(e) => { setColor(e.target.value); if (tool === "erase" || tool === "pick") setTool("pen"); }} />
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {SWATCHES.map((s) => (
              <button key={s} type="button" aria-label={s} onClick={() => { setColor(s); if (tool === "erase" || tool === "pick") setTool("pen"); }} style={{ width: 24, height: 24, background: s, border: s === color ? "3px solid #ffc45b" : "2px solid #666", padding: 0, cursor: "pointer" }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" className="px-btn" onClick={undoLast}>Undo</button>
            <button type="button" className="px-btn" onClick={clearCanvas}>Clear</button>
            <button type="button" className="px-btn" onClick={newPiece}>New piece</button>
          </div>
          <button type="button" className="px-btn" onClick={saveAsset}>{editingId ? "Update piece" : "Save piece"}</button>
          <button type="button" className="px-btn" onClick={() => preview && download(`${(name.trim() || "piece").replace(/\W+/g, "_")}.png`, preview)}>Download this as PNG</button>
          {note && <p style={{ fontSize: 12, color: "#ffc45b" }}>{note}</p>}
        </div>

        <div>
          <canvas
            ref={canvasRef}
            width={size}
            height={size}
            style={{ width: SHOW, height: SHOW, imageRendering: "pixelated", border: "2px solid #666", background: CHECKER, cursor: tool === "pick" ? "copy" : "crosshair", touchAction: "none" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
          <p style={{ fontSize: 12, opacity: 0.7, maxWidth: SHOW }}>Click, drag or touch to paint. Unpainted pixels stay see-through.</p>
          {group === "tile" && (
            <div>
              <p style={{ fontSize: 12, opacity: 0.7 }}>Seamless check (3×3 repeat) and actual size:</p>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 96, height: 96, backgroundImage: tileUrl, backgroundSize: "32px 32px", imageRendering: "pixelated", border: "1px solid #444", backgroundColor: "#222" }} />
                {preview && <img src={preview} alt="actual size" width={size} height={size} style={{ imageRendering: "pixelated", border: "1px solid #444" }} />}
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <h3>Saved {group === "tile" ? "map tiles" : "camp pieces"} ({shown.length})</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 440, overflow: "auto" }}>
            {shown.map((a) => (
              <div key={a.id} style={{ textAlign: "center", fontSize: 11, maxWidth: 96 }}>
                <img src={a.pixels} alt={a.name} style={{ width: 64, height: 64, imageRendering: "pixelated", border: a.live ? "2px solid #4f9a45" : "1px solid #444", background: CHECKER }} />
                <div>{a.name}</div>
                <div style={{ opacity: 0.6 }}>{TILE_CATEGORIES.find((c) => c.id === a.category)?.label ?? a.category}{a.live ? " · live" : ""}</div>
                <button type="button" className="px-btn" onClick={() => editAsset(a)}>Edit</button>
                <button type="button" className="px-btn" onClick={() => removeAsset(a.id)}>Delete</button>
              </div>
            ))}
            {!shown.length && <em>None yet</em>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button type="button" className="px-btn" onClick={exportJSON}>Export pack JSON</button>
            <label className="px-btn" style={{ display: "inline-block" }}>
              Import pack JSON
              <input type="file" accept="application/json,.json" onChange={importJSON} style={{ display: "none" }} />
            </label>
          </div>
        </div>
      </div>

      <p className="designer-status">Pieces stay on this device. Tiles marked "use in game now" replace the pack art in your game right away. Export the pack JSON to ship them in a game update.</p>
    </div>
  );
}
