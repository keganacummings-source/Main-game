import { useEffect, useRef, useState } from "react";
import { Tile } from "./ui-kit";

const CATEGORIES = [
  "walls", "floors", "chest", "ghostbox", "campfire", "doors", "beds",
  "decorations", "sinks", "fences", "counters", "stove", "fridge", "other"
] as const;
type Category = typeof CATEGORIES[number];

type Asset = {
  id: string;
  name: string;
  category: Category;
  pixels: string; // base64 or dataURL of 32x32 or 16x16 canvas
  size: 16 | 32;
  created: number;
};

const KEY = "turbz-camp-assets-v1";

function loadPack(): Asset[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePack(assets: Asset[]) {
  try { localStorage.setItem(KEY, JSON.stringify(assets)); } catch { /* private */ }
}

export function CampAssetBuilder({ onBack }: { onBack: () => void }) {
  const [assets, setAssets] = useState<Asset[]>(loadPack);
  const [category, setCategory] = useState<Category>("walls");
  const [name, setName] = useState("New Piece");
  const [size, setSize] = useState<16 | 32>(32);
  const [color, setColor] = useState("#6b3e26");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, size, size);
  }, [size]);

  function getPos(e: React.MouseEvent) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * size);
    const y = Math.floor(((e.clientY - r.top) / r.height) * size);
    return { x: Math.max(0, Math.min(size - 1, x)), y: Math.max(0, Math.min(size - 1, y)) };
  }

  function paint(x: number, y: number) {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }

  function onDown(e: React.MouseEvent) {
    setDrawing(true);
    const p = getPos(e);
    paint(p.x, p.y);
  }
  function onMove(e: React.MouseEvent) {
    if (!drawing) return;
    const p = getPos(e);
    paint(p.x, p.y);
  }
  function onUp() { setDrawing(false); }

  function saveAsset() {
    const c = canvasRef.current;
    if (!c) return;
    const data = c.toDataURL("image/png");
    const asset: Asset = {
      id: `ca-${Date.now().toString(36)}`,
      name: name.trim() || "Untitled",
      category,
      pixels: data,
      size,
      created: Date.now(),
    };
    const next = [...assets, asset];
    setAssets(next);
    savePack(next);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(assets, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "camp-asset-pack.json";
    a.click();
  }

  function importJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (Array.isArray(parsed)) {
          setAssets(parsed);
          savePack(parsed);
        }
      } catch { /* bad file */ }
    };
    reader.readAsText(file);
  }

  function clearCanvas() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, size, size);
  }

  const filtered = assets.filter((a) => a.category === category);

  return (
    <div className="designer-screen">
      <header className="designer-header">
        <div>
          <p className="screen-kicker">DESIGNER MODE</p>
          <h1 className="screen-title">Camp Asset Builder</h1>
        </div>
        <button type="button" className="px-btn" onClick={onBack}>Back</button>
      </header>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: 16 }}>
        <div>
          <label>Category<br />
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <br />
          <label>Name<br />
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: 160 }} />
          </label>
          <br />
          <label>Size<br />
            <select value={size} onChange={(e) => setSize(Number(e.target.value) as 16 | 32)}>
              <option value={16}>16×16</option>
              <option value={32}>32×32</option>
            </select>
          </label>
          <br />
          <label>Color<br />
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
          <br /><br />
          <button type="button" className="px-btn" onClick={clearCanvas}>Clear canvas</button>
          <br />
          <button type="button" className="px-btn" onClick={saveAsset}>Save piece</button>
          <br />
          <button type="button" className="px-btn" onClick={exportJSON}>Export pack JSON</button>
          <br />
          <label className="px-btn" style={{ display: "inline-block", marginTop: 8 }}>
            Import pack JSON
            <input type="file" accept="application/json" onChange={importJSON} style={{ display: "none" }} />
          </label>
        </div>

        <div>
          <canvas
            ref={canvasRef}
            width={size}
            height={size}
            style={{ width: 256, height: 256, imageRendering: "pixelated", border: "2px solid #666", background: "#111", cursor: "crosshair" }}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={onUp}
          />
          <p style={{ fontSize: 12, opacity: 0.7 }}>Click/drag to paint. Saved pieces appear below.</p>
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <h3>Saved in {category} ({filtered.length})</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 400, overflow: "auto" }}>
            {filtered.map((a) => (
              <div key={a.id} style={{ textAlign: "center", fontSize: 11 }}>
                <img src={a.pixels} alt={a.name} style={{ width: 64, height: 64, imageRendering: "pixelated", border: "1px solid #444" }} />
                <div>{a.name}</div>
              </div>
            ))}
            {!filtered.length && <em>None yet</em>}
          </div>
        </div>
      </div>

      <p className="designer-status">Designs stay on this device. Export a JSON pack to include new camp pieces in a future update.</p>
    </div>
  );
}
