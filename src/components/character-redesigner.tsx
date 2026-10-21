import { useEffect, useRef, useState, useCallback } from "react";
import { CLASSES, CLASS_BY_ID, type ClassId } from "@/game/classes";
import {
  FACINGS, WALK_FRAMES, FRAME_W, FRAME_H, frameKey,
  loadRedraws, saveRedraws, type ClassRedraw, type Facing,
  CLASS_SHEET_ORIGIN,
} from "@/game/class-redraws";
import { Section, Empty } from "./ui-kit";

const PALETTE = [
  "#140e0c", "#f0e2c8", "#a89880", "#c4473a", "#e6c15a", "#6a4cff",
  "#e25a32", "#3a7eb8", "#8a6a3a", "#9ad8c8", "#f2d43a", "#9ad0ff",
  "#fff1a8", "#c9a6e8", "#5aa88e", "#ffffff", "#000000", "#c48a78",
  "#6a4038", "#f0d2c4", "#241830", "#3a140c", "#6a9a52", "#7ec8ea",
];

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function cropFrame(classId: string, facing: Facing, frame: number): Promise<string | null> {
  const origin = CLASS_SHEET_ORIGIN[classId];
  if (!origin) return null;
  const facingIdx = FACINGS.indexOf(facing);
  if (facingIdx < 0) return null;
  const sx = origin.x + frame * FRAME_W;
  const sy = origin.y + facingIdx * FRAME_H;
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = "/sprites/class_warriors.png"; });
  const c = document.createElement("canvas");
  c.width = FRAME_W; c.height = FRAME_H;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, sx, sy, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
  return c.toDataURL("image/png");
}

type Tool = "paint" | "erase" | "pick";

function FrameCanvas({
  dataUrl, color, tool, brush, mirror, zoom, onChange, onPick,
}: {
  dataUrl?: string;
  color: string;
  tool: Tool;
  brush: number;
  mirror: boolean;
  zoom: number;
  onChange: (url: string) => void;
  onPick: (hex: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const history = useRef<string[]>([]);

  const paintAt = useCallback((x: number, y: number, pushHistory = false) => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (pushHistory) history.current.push(canvas.toDataURL());
    const stamp = (px: number, py: number) => {
      if (tool === "erase") ctx.clearRect(px, py, brush, brush);
      else { ctx.fillStyle = color; ctx.fillRect(px, py, brush, brush); }
    };
    stamp(x, y);
    if (mirror) stamp(FRAME_W - 1 - x - (brush - 1), y);
    onChange(canvas.toDataURL("image/png"));
  }, [tool, color, brush, mirror, onChange]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, FRAME_W, FRAME_H);
    for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) {
      ctx.fillStyle = (x + y) % 2 ? "#2a2220" : "#3a3029";
      ctx.fillRect(x, y, 1, 1);
    }
    if (dataUrl && dataUrl.startsWith("data:image/")) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, FRAME_W, FRAME_H);
      img.src = dataUrl;
    }
  }, [dataUrl]);

  const coord = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = ref.current!;
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.floor(((e.clientX - r.left) / r.width) * FRAME_W),
      y: Math.floor(((e.clientY - r.top) / r.height) * FRAME_H),
    };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y } = coord(e);
    if (x < 0 || y < 0 || x >= FRAME_W || y >= FRAME_H) return;
    if (tool === "pick") {
      const canvas = ref.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
      if (a < 40) return;
      onPick("#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join(""));
      return;
    }
    drawing.current = true;
    paintAt(x, y, true);
  };

  return (
    <div className="cr-canvas-wrap">
      <canvas
        ref={ref}
        width={FRAME_W}
        height={FRAME_H}
        style={{ width: FRAME_W * zoom, height: FRAME_H * zoom, imageRendering: "pixelated", cursor: tool === "pick" ? "crosshair" : "cell" }}
        onPointerDown={onDown}
        onPointerMove={(e) => { if (drawing.current && tool !== "pick") { const { x, y } = coord(e); if (x >= 0 && y >= 0 && x < FRAME_W && y < FRAME_H) paintAt(x, y); } }}
        onPointerUp={() => { drawing.current = false; }}
        onPointerLeave={() => { drawing.current = false; }}
      />
    </div>
  );
}

export function CharacterRedesigner({ onBack }: { onBack: () => void }) {
  const [list, setList] = useState<ClassRedraw[]>(() => loadRedraws());
  const [selected, setSelected] = useState<ClassId | null>(CLASSES[0]?.id ?? null);
  const [facing, setFacing] = useState<Facing>("down");
  const [frame, setFrame] = useState(0);
  const [draft, setDraft] = useState<ClassRedraw | null>(null);
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState("");
  const [color, setColor] = useState("#c48a78");
  const [tool, setTool] = useState<Tool>("paint");
  const [brush, setBrush] = useState(1);
  const [mirror, setMirror] = useState(false);
  const [zoom, setZoom] = useState(6);
  const [recent, setRecent] = useState<string[]>([]);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(6);

  useEffect(() => {
    if (!selected) return;
    const existing = list.find((p) => p.id === selected);
    setDraft(existing ? { ...existing, frames: { ...existing.frames } } : { id: selected, frames: {}, updated: 0 });
    setDirty(false);
  }, [selected, list]);

  const current = selected ? CLASS_BY_ID[selected] : null;
  const key = frameKey(facing, frame);
  const currentUrl = draft?.frames[key];

  const setFrameUrl = (url: string) => {
    if (!draft) return;
    setDraft({ ...draft, frames: { ...draft.frames, [key]: url } });
    setDirty(true);
  };

  const pickColor = (hex: string) => {
    setColor(hex);
    setTool("paint");
    setRecent((r) => [hex, ...r.filter((c) => c !== hex)].slice(0, 8));
  };

  const save = useCallback(() => {
    if (!draft) return;
    const next = { ...draft, updated: Date.now() };
    const others = list.filter((p) => p.id !== next.id);
    const updated = [...others, next];
    setList(updated);
    saveRedraws(updated);
    setDirty(false);
  }, [draft, list]);

  const remove = () => {
    if (!selected) return;
    const updated = list.filter((p) => p.id !== selected);
    setList(updated);
    saveRedraws(updated);
    setDirty(false);
  };

  const loadOriginal = async () => {
    if (!selected || !draft) return;
    const url = await cropFrame(selected, facing, frame);
    if (url) setFrameUrl(url);
  };

  const loadAllOriginal = async () => {
    if (!selected || !draft) return;
    const frames = { ...draft.frames };
    for (const f of FACINGS) {
      for (let i = 0; i < WALK_FRAMES; i++) {
        const url = await cropFrame(selected, f, i);
        if (url) frames[frameKey(f, i)] = url;
      }
    }
    setDraft({ ...draft, frames });
    setDirty(true);
  };

  const copyFrameToFacing = () => {
    if (!draft || !currentUrl) return;
    const frames = { ...draft.frames };
    for (let i = 0; i < WALK_FRAMES; i++) frames[frameKey(facing, i)] = currentUrl;
    setDraft({ ...draft, frames });
    setDirty(true);
  };

  const copyFrameToAll = () => {
    if (!draft || !currentUrl) return;
    const frames = { ...draft.frames };
    for (const f of FACINGS) for (let i = 0; i < WALK_FRAMES; i++) frames[frameKey(f, i)] = currentUrl;
    setDraft({ ...draft, frames });
    setDirty(true);
  };

  const clearFrame = () => setFrameUrl("");

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "e") setTool((t) => (t === "erase" ? "paint" : "erase"));
      if (e.key === "m") setMirror((v) => !v);
      if (e.key === "i") setTool("pick");
      if (e.key === "b") setTool("paint");
      if (e.key === "[" ) setBrush((b) => Math.max(1, b - 1));
      if (e.key === "]" ) setBrush((b) => Math.min(4, b + 1));
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); }
      if (e.key === "ArrowLeft") setFrame((f) => (f + WALK_FRAMES - 1) % WALK_FRAMES);
      if (e.key === "ArrowRight") setFrame((f) => (f + 1) % WALK_FRAMES);
      if (e.key === "ArrowUp") setFacing((f) => FACINGS[(FACINGS.indexOf(f) + FACINGS.length - 1) % FACINGS.length]!);
      if (e.key === "ArrowDown") setFacing((f) => FACINGS[(FACINGS.indexOf(f) + 1) % FACINGS.length]!);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // Preview
  const previewRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !draft) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      const step = playing ? Math.floor(t * speed) % WALK_FRAMES : frame;
      const url = draft.frames[frameKey(facing, step)];
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#1c1412";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (url) {
        const img = new Image();
        img.onload = () => {
          ctx.imageSmoothingEnabled = false;
          const sc = 2;
          ctx.drawImage(img, (canvas.width - FRAME_W * sc) / 2, (canvas.height - FRAME_H * sc) / 2, FRAME_W * sc, FRAME_H * sc);
        };
        img.src = url;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [draft, facing, playing, speed, frame]);

  const painted = draft ? Object.values(draft.frames).filter((u) => u && u.startsWith("data:")).length : 0;
  const filtered = CLASSES.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.id.includes(query.toLowerCase()));

  const importPack = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) return;
        const merged = [...list];
        for (const item of parsed) {
          if (!item || typeof item.id !== "string" || !item.frames) continue;
          const i = merged.findIndex((p) => p.id === item.id);
          if (i >= 0) merged[i] = item;
          else merged.push(item);
        }
        setList(merged);
        saveRedraws(merged);
      } catch { /* ignore bad file */ }
    };
    reader.readAsText(file);
  };

  return (
    <div className="designer-screen">
      <header className="designer-header">
        <div>
          <p className="screen-kicker">CHARACTER REDESIGNER</p>
          <h1 className="screen-title">Redraw frames</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className={`cr-status ${dirty ? "cr-dirty" : ""}`}>{dirty ? "UNSAVED" : "SAVED"} · {painted}/16 frames</span>
          <button type="button" className="px-btn px-btn-kyo" onClick={save} disabled={!dirty}>Save</button>
          <button type="button" className="px-btn" onClick={onBack}>Back</button>
        </div>
      </header>
      <p className="designer-status">
        Redraw every frame a class needs. 4 facings × 4 walk frames (frame 0 = idle).
        Shortcuts: arrows change frame/facing · E erase · B paint · I eyedropper · M mirror · [ ] brush size · Ctrl+S save.
      </p>

      <div className="cr-layout">
        <div className="cr-classlist">
          <input className="px-input" placeholder="Search classes…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {filtered.map((c) => {
            const has = list.some((p) => p.id === c.id);
            return (
              <button
                key={c.id}
                type="button"
                className={`px-btn ${selected === c.id ? "px-btn-kyo" : ""}`}
                style={{ textAlign: "left" }}
                onClick={() => setSelected(c.id)}
              >
                {c.name} {has ? "●" : ""}
              </button>
            );
          })}
          {!filtered.length && <Empty>No classes match.</Empty>}
        </div>

        <div className="cr-main">
          {current && draft && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h2 style={{ margin: 0 }}>{current.name} <span className="text-dim">({current.type} · {current.role})</span></h2>
                  <p className="text-dim" style={{ margin: "2px 0 0" }}>{current.blurb}</p>
                </div>
                <div className="cr-status">{facing} · frame {frame}{frame === 0 ? " (idle)" : ""}</div>
              </div>

              <div className="cr-toolbar">
                {FACINGS.map((f) => (
                  <button key={f} type="button" className={`px-btn ui-btn-sm ${facing === f ? "px-btn-kyo" : ""}`} onClick={() => setFacing(f)}>{f}</button>
                ))}
                <span className="text-dim">·</span>
                {Array.from({ length: WALK_FRAMES }, (_, i) => (
                  <button key={i} type="button" className={`px-btn ui-btn-sm ${frame === i ? "px-btn-kyo" : ""}`} onClick={() => setFrame(i)}>
                    {i}{i === 0 ? " idle" : ""}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                <FrameCanvas dataUrl={currentUrl} color={color} tool={tool} brush={brush} mirror={mirror} zoom={zoom} onChange={setFrameUrl} onPick={pickColor} />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="cr-toolbar" style={{ margin: 0 }}>
                    <button type="button" className={`px-btn ui-btn-sm ${tool === "paint" ? "px-btn-kyo" : ""}`} onClick={() => setTool("paint")}>Paint</button>
                    <button type="button" className={`px-btn ui-btn-sm ${tool === "erase" ? "px-btn-kyo" : ""}`} onClick={() => setTool("erase")}>Erase</button>
                    <button type="button" className={`px-btn ui-btn-sm ${tool === "pick" ? "px-btn-kyo" : ""}`} onClick={() => setTool("pick")}>Pick</button>
                    <button type="button" className={`px-btn ui-btn-sm ${mirror ? "px-btn-kyo" : ""}`} onClick={() => setMirror(!mirror)}>Mirror</button>
                  </div>
                  <label className="text-dim" style={{ fontSize: 14 }}>
                    Brush {brush}
                    <input type="range" min={1} max={4} value={brush} onChange={(e) => setBrush(Number(e.target.value))} />
                  </label>
                  <label className="text-dim" style={{ fontSize: 14 }}>
                    Zoom {zoom}x
                    <input type="range" min={3} max={10} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
                  </label>
                  <div className="cr-swatches">
                    {PALETTE.map((c) => (
                      <button key={c} type="button" className={`cr-swatch ${color === c ? "on" : ""}`} style={{ background: c }} title={c} onClick={() => pickColor(c)} />
                    ))}
                    <input type="color" value={color} onChange={(e) => pickColor(e.target.value)} title="Custom colour" />
                  </div>
                  {recent.length > 0 && (
                    <div>
                      <div className="text-dim" style={{ fontSize: 12 }}>Recent</div>
                      <div className="cr-swatches">
                        {recent.map((c) => (
                          <button key={c} type="button" className={`cr-swatch ${color === c ? "on" : ""}`} style={{ background: c }} onClick={() => pickColor(c)} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="cr-framegrid" aria-label="All frames">
                {FACINGS.map((f) => Array.from({ length: WALK_FRAMES }, (_, i) => {
                  const u = draft.frames[frameKey(f, i)];
                  const on = f === facing && i === frame;
                  return (
                    <button key={`${f}-${i}`} type="button" className={`cr-framecell ${on ? "on" : ""}`} onClick={() => { setFacing(f); setFrame(i); }}>
                      {u && u.startsWith("data:") ? <img src={u} alt="" /> : <div className="empty" />}
                      <div className="text-dim" style={{ fontSize: 11 }}>{f[0]}{i}</div>
                    </button>
                  );
                }))}
              </div>
            </>
          )}
          {!current && <Empty>Select a class.</Empty>}
        </div>

        <div className="cr-tools">
          <Section title="Preview">
            <canvas ref={previewRef} width={140} height={160} style={{ background: "#1c1412", imageRendering: "pixelated", width: "100%" }} />
            <div className="cr-toolbar" style={{ marginTop: 8 }}>
              <button type="button" className="px-btn ui-btn-sm" onClick={() => setPlaying(!playing)}>{playing ? "Pause" : "Play"}</button>
              <label className="text-dim" style={{ fontSize: 14 }}>
                Speed
                <input type="range" min={2} max={12} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
              </label>
            </div>
          </Section>

          <Section title="Design tools">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button type="button" className="px-btn ui-btn-sm" onClick={loadOriginal}>Load original (this frame)</button>
              <button type="button" className="px-btn ui-btn-sm" onClick={loadAllOriginal}>Load all originals</button>
              <button type="button" className="px-btn ui-btn-sm" onClick={copyFrameToFacing} disabled={!currentUrl}>Copy frame → this facing</button>
              <button type="button" className="px-btn ui-btn-sm" onClick={copyFrameToAll} disabled={!currentUrl}>Copy frame → all frames</button>
              <button type="button" className="px-btn ui-btn-sm" onClick={clearFrame}>Clear this frame</button>
            </div>
          </Section>

          <Section title="Pack">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button type="button" className="px-btn ui-btn-sm" onClick={() => download("class-redraws.json", list)}>Export all JSON</button>
              <label className="px-btn ui-btn-sm" style={{ textAlign: "center" }}>
                Import JSON
                <input type="file" accept="application/json" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) importPack(f); e.target.value = ""; }} />
              </label>
              <button type="button" className="px-btn ui-btn-sm" onClick={remove}>Clear this class</button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
