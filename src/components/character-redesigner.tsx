import { useEffect, useRef, useState } from "react";
import { CLASSES, CLASS_BY_ID, type ClassId } from "@/game/classes";
import {
  FACINGS, WALK_FRAMES, FRAME_W, FRAME_H, frameKey,
  loadRedraws, saveRedraws, type ClassRedraw, type Facing,
  CLASS_SHEET_ORIGIN,
} from "@/game/class-redraws";
import { Field, Section, Empty } from "./ui-kit";

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Pixel canvas for one 32×44 frame. */
function FrameCanvas({ dataUrl, onChange }: { dataUrl?: string; onChange: (url: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState("#c48a78");
  const [erase, setErase] = useState(false);
  const drawing = useRef(false);
  const zoom = 6;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, FRAME_W, FRAME_H);
    // checkerboard
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

  const paint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const r = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * FRAME_W);
    const y = Math.floor(((e.clientY - r.top) / r.height) * FRAME_H);
    if (x < 0 || y < 0 || x >= FRAME_W || y >= FRAME_H) return;
    if (erase) ctx.clearRect(x, y, 1, 1);
    else { ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1); }
    onChange(canvas.toDataURL("image/png"));
  };

  return (
    <div>
      <canvas
        ref={ref}
        width={FRAME_W}
        height={FRAME_H}
        style={{ width: FRAME_W * zoom, height: FRAME_H * zoom, imageRendering: "pixelated", border: "1px solid #555", cursor: "crosshair", background: "#1c1412" }}
        onPointerDown={(e) => { drawing.current = true; paint(e); }}
        onPointerMove={(e) => { if (drawing.current) paint(e); }}
        onPointerUp={() => { drawing.current = false; }}
        onPointerLeave={() => { drawing.current = false; }}
      />
      <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <button type="button" className={`px-btn ui-btn-sm ${erase ? "px-btn-kyo" : ""}`} onClick={() => setErase(!erase)}>{erase ? "Erase on" : "Erase"}</button>
        <button type="button" className="px-btn ui-btn-sm" onClick={() => {
          const canvas = ref.current;
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.clearRect(0, 0, FRAME_W, FRAME_H);
          onChange(canvas.toDataURL("image/png"));
        }}>Clear frame</button>
      </div>
    </div>
  );
}

/** Crop one frame from the class sheet into a data URL. */
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

export function CharacterRedesigner({ onBack }: { onBack: () => void }) {
  const [list, setList] = useState<ClassRedraw[]>(() => loadRedraws());
  const [selected, setSelected] = useState<ClassId | null>(CLASSES[0]?.id ?? null);
  const [facing, setFacing] = useState<Facing>("down");
  const [frame, setFrame] = useState(0);
  const [draft, setDraft] = useState<ClassRedraw | null>(null);

  useEffect(() => {
    if (!selected) return;
    const existing = list.find((p) => p.id === selected);
    setDraft(existing ? { ...existing, frames: { ...existing.frames } } : { id: selected, frames: {}, updated: 0 });
  }, [selected, list]);

  const current = selected ? CLASS_BY_ID[selected] : null;
  const key = frameKey(facing, frame);
  const currentUrl = draft?.frames[key];

  const setFrameUrl = (url: string) => {
    if (!draft) return;
    setDraft({ ...draft, frames: { ...draft.frames, [key]: url } });
  };

  const save = () => {
    if (!draft) return;
    const next = { ...draft, updated: Date.now() };
    const others = list.filter((p) => p.id !== next.id);
    const updated = [...others, next];
    setList(updated);
    saveRedraws(updated);
  };

  const remove = () => {
    if (!selected) return;
    const updated = list.filter((p) => p.id !== selected);
    setList(updated);
    saveRedraws(updated);
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
  };

  // Simple walk preview
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
      const step = Math.floor(t * 6) % WALK_FRAMES;
      const url = draft.frames[frameKey(facing, step)];
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#1c1412";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (url) {
        const img = new Image();
        img.onload = () => {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, (canvas.width - FRAME_W * 2) / 2, (canvas.height - FRAME_H * 2) / 2, FRAME_W * 2, FRAME_H * 2);
        };
        img.src = url;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [draft, facing]);

  return (
    <div className="designer-screen">
      <header className="designer-header">
        <div>
          <p className="screen-kicker">CHARACTER REDESIGNER</p>
          <h1 className="screen-title">Redraw frames</h1>
        </div>
        <button type="button" className="px-btn" onClick={onBack}>Back</button>
      </header>
      <p className="designer-status">
        Redraw any class's frames. Each class needs 4 facings × 4 walk frames (frame 0 is the standing pose).
        Load the original sheet art as a starting point, paint over it, then export the JSON pack for a future update.
      </p>

      <div className="flex gap-4" style={{ marginTop: 12 }}>
        <div style={{ flex: "0 0 200px", maxHeight: "70vh", overflow: "auto" }}>
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
          {current && draft && (
            <>
              <h2>{current.name} <span className="text-dim">({current.type})</span></h2>
              <p className="text-dim">{current.blurb}</p>

              <div style={{ margin: "12px 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
                {FACINGS.map((f) => (
                  <button key={f} type="button" className={`px-btn ${facing === f ? "px-btn-kyo" : ""}`} onClick={() => setFacing(f)}>
                    {f}
                  </button>
                ))}
                <span className="text-dim" style={{ alignSelf: "center" }}>·</span>
                {Array.from({ length: WALK_FRAMES }, (_, i) => (
                  <button key={i} type="button" className={`px-btn ${frame === i ? "px-btn-kyo" : ""}`} onClick={() => setFrame(i)}>
                    frame {i}{i === 0 ? " (idle)" : ""}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div>
                  <Section title={`${facing} · frame ${frame}`}>
                    <FrameCanvas dataUrl={currentUrl} onChange={setFrameUrl} />
                    <div style={{ marginTop: 8 }}>
                      <button type="button" className="px-btn ui-btn-sm" onClick={loadOriginal}>Load original for this frame</button>
                      <button type="button" className="px-btn ui-btn-sm" style={{ marginLeft: 6 }} onClick={loadAllOriginal}>Load all originals</button>
                    </div>
                  </Section>
                </div>

                <div>
                  <Section title="Walk preview">
                    <canvas ref={previewRef} width={120} height={140} style={{ background: "#1c1412", imageRendering: "pixelated" }} />
                    <p className="text-dim" style={{ fontSize: 12 }}>Cycles the current facing's 4 frames.</p>
                  </Section>

                  <div style={{ marginTop: 12 }}>
                    <button type="button" className="px-btn px-btn-kyo" onClick={save}>Save redraw</button>
                    <button type="button" className="px-btn" style={{ marginLeft: 8 }} onClick={remove}>Clear class</button>
                    <button type="button" className="px-btn" style={{ marginLeft: 8 }} onClick={() => download("class-redraws.json", list)}>Export all JSON</button>
                  </div>
                  <p className="text-dim" style={{ fontSize: 12, marginTop: 8 }}>
                    {Object.keys(draft.frames).length} frames painted for this class.
                  </p>
                </div>
              </div>

              {/* Thumbnail strip of all frames for the current facing */}
              <div style={{ marginTop: 16 }}>
                <div className="text-dim" style={{ fontSize: 12, marginBottom: 4 }}>{facing} frames</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {Array.from({ length: WALK_FRAMES }, (_, i) => {
                    const u = draft.frames[frameKey(facing, i)];
                    return (
                      <button key={i} type="button" onClick={() => setFrame(i)} style={{ border: frame === i ? "2px solid #e6c15a" : "1px solid #444", padding: 2, background: "#1c1412" }}>
                        {u ? <img src={u} alt="" style={{ width: 48, height: 66, imageRendering: "pixelated" }} /> : <div style={{ width: 48, height: 66, background: "#2a2220" }} />}
                        <div className="text-dim" style={{ fontSize: 10 }}>{i}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
          {!current && <Empty>Select a class.</Empty>}
        </div>
      </div>
    </div>
  );
}
