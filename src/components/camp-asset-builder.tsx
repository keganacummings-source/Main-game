import { useEffect, useRef, useState } from "react";
import {
  CAMP_CATEGORIES, TILE_CATEGORIES, POWER_TEXTURES, SPAWN_LOCATIONS, WALK_EFFECTS,
  loadPack, savePack, groupOf, type Asset, type AssetGroup, type AssetSize,
} from "@/game/camp-assets";
import { Field, Section, Tabs, Empty } from "./ui-kit";

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Simple pixel editor that stores the result as a transparent PNG data URL. */
function PixelCanvas({ size, dataUrl, onChange }: { size: AssetSize; dataUrl: string; onChange: (url: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState("#8a6a3a");
  const [erase, setErase] = useState(false);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    if (dataUrl && dataUrl.startsWith("data:image/")) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, size, size);
      img.src = dataUrl;
    } else {
      // checkerboard background so empty pixels are obvious
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        ctx.fillStyle = (x + y) % 2 ? "#2a2220" : "#3a3029";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [dataUrl, size]);

  const paint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const r = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * size);
    const y = Math.floor(((e.clientY - r.top) / r.height) * size);
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    if (erase) {
      ctx.clearRect(x, y, 1, 1);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
    onChange(canvas.toDataURL("image/png"));
  };

  return (
    <div>
      <canvas
        ref={ref}
        width={size}
        height={size}
        style={{ width: Math.min(320, size * 8), height: Math.min(320, size * 8), imageRendering: "pixelated", border: "1px solid #444", cursor: "crosshair", background: "#1c1412" }}
        onPointerDown={(e) => { drawing.current = true; paint(e); }}
        onPointerMove={(e) => { if (drawing.current) paint(e); }}
        onPointerUp={() => { drawing.current = false; }}
        onPointerLeave={() => { drawing.current = false; }}
      />
      <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <button type="button" className={`px-btn ${erase ? "px-btn-kyo" : ""}`} onClick={() => setErase(!erase)}>{erase ? "Erase on" : "Erase"}</button>
        <button type="button" className="px-btn" onClick={() => {
          const canvas = ref.current;
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.clearRect(0, 0, size, size);
          onChange(canvas.toDataURL("image/png"));
        }}>Clear</button>
      </div>
    </div>
  );
}

const EMPTY_ASSET = (group: AssetGroup): Asset => ({
  id: uid(),
  name: group === "camp" ? "New piece" : group === "power" ? "New power texture" : "New tile",
  group,
  category: group === "camp" ? "walls" : group === "power" ? "hellgen" : "floor",
  pixels: "",
  size: 32,
  created: Date.now(),
  live: group === "power" ? true : undefined,
  holdMax: 0,
  holdItems: [],
  spawnIn: [],
  isDeco: false,
  walkEffects: [],
});

export function CampAssetBuilder({ onBack }: { onBack: () => void }) {
  const [assets, setAssets] = useState<Asset[]>(() => loadPack());
  const [editing, setEditing] = useState<Asset | null>(null);
  const [group, setGroup] = useState<AssetGroup>("camp");

  const persist = (next: Asset[]) => {
    setAssets(next);
    savePack(next);
  };

  const startNew = (g: AssetGroup) => {
    const a = EMPTY_ASSET(g);
    setEditing(a);
    setGroup(g);
  };

  const saveEditing = () => {
    if (!editing) return;
    if (!editing.pixels.startsWith("data:image/")) {
      alert("Paint something first (the canvas must produce a data URL).");
      return;
    }
    const next = assets.some((a) => a.id === editing.id)
      ? assets.map((a) => (a.id === editing.id ? editing : a))
      : [...assets, editing];
    persist(next);
    setEditing(null);
  };

  const remove = (id: string) => {
    persist(assets.filter((a) => a.id !== id));
    if (editing?.id === id) setEditing(null);
  };

  const categories = group === "camp"
    ? CAMP_CATEGORIES.map((id) => ({ id, label: id }))
    : group === "power"
      ? POWER_TEXTURES.map((c) => ({ id: c.id, label: c.label }))
      : TILE_CATEGORIES.map((c) => ({ id: c.id, label: c.label }));

  return (
    <div className="designer-screen">
      <header className="designer-header">
        <div>
          <p className="screen-kicker">CAMP & TILE ASSET BUILDER</p>
          <h1 className="screen-title">Pixel packs</h1>
        </div>
        <button type="button" className="px-btn" onClick={onBack}>Back</button>
      </header>
      <p className="designer-status">
        Paint camp pieces, map tiles, and the Power blocks (HellStone Generator, Battery, Wire, XP Producer, Duplicator).
        A power texture marked Live replaces that block's art in game. Saved on this device. Export JSON to ship in an update.
      </p>

      {!editing && (
        <>
          <div style={{ margin: "12px 0", display: "flex", gap: 8 }}>
            <button type="button" className="px-btn px-btn-kyo" onClick={() => startNew("camp")}>New camp piece</button>
            <button type="button" className="px-btn" onClick={() => startNew("tile")}>New map tile</button>
            <button type="button" className="px-btn" onClick={() => startNew("power")}>New power texture</button>
            <button type="button" className="px-btn" onClick={() => download("camp-tile-pack.json", assets)}>Export pack</button>
          </div>
          {assets.length === 0 && <Empty>No assets yet. Create a camp piece or map tile.</Empty>}
          <div className="tile-grid" style={{ marginTop: 12 }}>
            {assets.map((a) => (
              <div key={a.id} className="px-panel" style={{ padding: 8, minWidth: 140 }}>
                {a.pixels ? <img src={a.pixels} alt="" style={{ width: 64, height: 64, imageRendering: "pixelated", background: "#1c1412" }} /> : <div style={{ width: 64, height: 64, background: "#2a2220" }} />}
                <div style={{ fontWeight: 600 }}>{a.name}</div>
                <div className="text-dim" style={{ fontSize: 12 }}>{groupOf(a)} · {a.category}</div>
                <div style={{ marginTop: 4 }}>
                  <button type="button" className="px-btn ui-btn-sm" onClick={() => { setEditing(a); setGroup(groupOf(a)); }}>Edit</button>
                  <button type="button" className="px-btn ui-btn-sm" style={{ marginLeft: 4 }} onClick={() => remove(a.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {editing && (
        <div style={{ marginTop: 12 }}>
          <Section title={editing.name || "Editing"}>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div>
                <Field label="Size">
                  <select value={editing.size} onChange={(e) => setEditing({ ...editing, size: Number(e.target.value) as AssetSize })}>
                    <option value={16}>16</option>
                    <option value={32}>32</option>
                    <option value={64}>64</option>
                  </select>
                </Field>
                <PixelCanvas size={editing.size} dataUrl={editing.pixels} onChange={(pixels) => setEditing({ ...editing, pixels })} />
              </div>
              <div style={{ flex: 1, minWidth: 280 }}>
                <Field label="Name">
                  <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </Field>
                <Field label="Group">
                  <Tabs value={group} onChange={(g) => {
                    const category = g === "camp" ? "walls" : g === "power" ? "hellgen" : "floor";
                    setGroup(g);
                    setEditing({ ...editing, group: g, category, live: g === "power" ? (editing.live ?? true) : editing.live });
                  }} tabs={[{ id: "camp", label: "Camp" }, { id: "tile", label: "Map tile" }, { id: "power", label: "Power" }]} />
                </Field>
                <Field label="Category">
                  <select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </Field>

                {group === "power" && (
                  <Field label="Live in game">
                    <label><input type="checkbox" checked={editing.live !== false} onChange={(e) => setEditing({ ...editing, live: e.target.checked })} /> Draw this on the placed block</label>
                  </Field>
                )}

                {group === "tile" && (
                  <>
                    <Field label="Replaces path (optional)" hint="e.g. /MapAssets/03_Water_and_Liquid_Tiles/deep_water.png">
                      <input value={editing.replaces ?? ""} onChange={(e) => setEditing({ ...editing, replaces: e.target.value || undefined })} />
                    </Field>
                    <Field label="Live override">
                      <label><input type="checkbox" checked={!!editing.live} onChange={(e) => setEditing({ ...editing, live: e.target.checked })} /> Draw in game now</label>
                    </Field>
                    <Field label="Solid">
                      <label><input type="checkbox" checked={!!editing.solid} onChange={(e) => setEditing({ ...editing, solid: e.target.checked })} /> Blocks movement</label>
                    </Field>
                    <Field label="Hold max">
                      <input type="number" min={0} value={editing.holdMax ?? 0} onChange={(e) => setEditing({ ...editing, holdMax: Number(e.target.value) })} />
                    </Field>
                    <Field label="Hold items (comma-separated)">
                      <input value={(editing.holdItems ?? []).join(", ")} onChange={(e) => setEditing({ ...editing, holdItems: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                    </Field>
                    <Field label="Spawn in">
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {SPAWN_LOCATIONS.map((loc) => {
                          const on = (editing.spawnIn ?? []).includes(loc);
                          return (
                            <button key={loc} type="button" className={`px-btn ui-btn-sm ${on ? "px-btn-kyo" : ""}`} onClick={() => {
                              const cur = editing.spawnIn ?? [];
                              setEditing({ ...editing, spawnIn: on ? cur.filter((x) => x !== loc) : [...cur, loc] });
                            }}>{loc}</button>
                          );
                        })}
                      </div>
                    </Field>
                    <Field label="Deco">
                      <label><input type="checkbox" checked={!!editing.isDeco} onChange={(e) => setEditing({ ...editing, isDeco: e.target.checked })} /> Pure decoration</label>
                    </Field>
                    <Field label="Walk effects">
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {WALK_EFFECTS.map((eff) => {
                          const on = (editing.walkEffects ?? []).includes(eff);
                          return (
                            <button key={eff} type="button" className={`px-btn ui-btn-sm ${on ? "px-btn-kyo" : ""}`} onClick={() => {
                              const cur = editing.walkEffects ?? [];
                              setEditing({ ...editing, walkEffects: on ? cur.filter((x) => x !== eff) : [...cur, eff] });
                            }}>{eff}</button>
                          );
                        })}
                      </div>
                    </Field>
                  </>
                )}

                <div style={{ marginTop: 16 }}>
                  <button type="button" className="px-btn px-btn-kyo" onClick={saveEditing}>Save asset</button>
                  <button type="button" className="px-btn" style={{ marginLeft: 8 }} onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
