import { useEffect, useState } from "react";
import { CLASSES, CLASS_BY_ID, type ClassId } from "@/game/classes";
import { loadPalettes, savePalettes, type ClassPalette } from "@/game/class-palettes";
import { drawClassPreview } from "@/game/class-preview";
import { Tile } from "./ui-kit";

const FIELDS: { key: keyof Omit<ClassPalette, "id" | "updated">; label: string }[] = [
  { key: "skin", label: "Skin" },
  { key: "skinDark", label: "Skin dark" },
  { key: "skinLight", label: "Skin light" },
  { key: "hair", label: "Hair" },
  { key: "clothes", label: "Clothes" },
  { key: "clothesDark", label: "Clothes dark" },
  { key: "accent", label: "Accent" },
];

const DEFAULT_PAL: Omit<ClassPalette, "id" | "updated"> = {
  skin: "#c48a78",
  skinDark: "#6a4038",
  skinLight: "#f0d2c4",
  hair: "#241830",
  clothes: "#3a7eb8",
  clothesDark: "#1e4060",
  accent: "#e6c15a",
};

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CharacterRedesigner({ onBack }: { onBack: () => void }) {
  const [list, setList] = useState<ClassPalette[]>(() => loadPalettes());
  const [selected, setSelected] = useState<ClassId | null>(CLASSES[0]?.id ?? null);
  const [draft, setDraft] = useState<Omit<ClassPalette, "id" | "updated">>(DEFAULT_PAL);

  useEffect(() => {
    if (!selected) return;
    const existing = list.find((p) => p.id === selected);
    setDraft(existing ? { ...DEFAULT_PAL, ...existing } : { ...DEFAULT_PAL });
  }, [selected, list]);

  const current = selected ? CLASS_BY_ID[selected] : null;

  const save = () => {
    if (!selected) return;
    const next: ClassPalette = { id: selected, ...draft, updated: Date.now() };
    const others = list.filter((p) => p.id !== selected);
    const updated = [...others, next];
    setList(updated);
    savePalettes(updated);
  };

  const remove = () => {
    if (!selected) return;
    const updated = list.filter((p) => p.id !== selected);
    setList(updated);
    savePalettes(updated);
  };

  return (
    <div className="designer-screen">
      <header className="designer-header">
        <div>
          <p className="screen-kicker">CHARACTER REDESIGNER</p>
          <h1 className="screen-title">Class palettes</h1>
        </div>
        <button type="button" className="px-btn" onClick={onBack}>Back</button>
      </header>
      <p className="designer-status">
        Edit the colour palette for any class. These override the old procedural skins and will be used to recolour class sheets in a future update.
        Designs are saved on this device. Export JSON to ship them.
      </p>
      <div className="flex gap-4" style={{ marginTop: 12 }}>
        <div style={{ flex: "0 0 220px", maxHeight: "70vh", overflow: "auto" }}>
          {CLASSES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`px-btn ${selected === c.id ? "px-btn-kyo" : ""}`}
              style={{ display: "block", width: "100%", marginBottom: 4, textAlign: "left" }}
              onClick={() => setSelected(c.id)}
            >
              {c.name} {list.some((p) => p.id === c.id) ? "●" : ""}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          {current && (
            <>
              <h2>{current.name} <span className="text-dim">({current.type})</span></h2>
              <p className="text-dim">{current.blurb}</p>
              <div className="flex gap-6" style={{ marginTop: 12 }}>
                <div>
                  {FIELDS.map((f) => (
                    <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ width: 90 }}>{f.label}</span>
                      <input
                        type="color"
                        value={draft[f.key]}
                        onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                      />
                      <span className="text-dim">{draft[f.key]}</span>
                    </label>
                  ))}
                  <div style={{ marginTop: 12 }}>
                    <button type="button" className="px-btn px-btn-kyo" onClick={save}>Save palette</button>
                    <button type="button" className="px-btn" style={{ marginLeft: 8 }} onClick={remove}>Clear</button>
                    <button type="button" className="px-btn" style={{ marginLeft: 8 }} onClick={() => download("class-palettes.json", list)}>Export all JSON</button>
                  </div>
                </div>
                <div>
                  <canvas
                    ref={(el) => {
                      if (el && selected) {
                        // Preview the current class sheet (future update will apply the palette colours).
                        drawClassPreview(el, "thorn", selected, true, false);
                      }
                    }}
                    width={160}
                    height={200}
                    style={{ background: "#1c1412", imageRendering: "pixelated" }}
                  />
                  <p className="text-dim" style={{ fontSize: 12, marginTop: 4 }}>Current sheet (palette applied in future update)</p>
                  <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
                    {FIELDS.map((f) => (
                      <div key={f.key} title={f.label} style={{ width: 20, height: 20, background: draft[f.key], border: "1px solid #444" }} />
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
