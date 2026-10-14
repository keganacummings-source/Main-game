import { useEffect, useRef, useState } from "react";
import { TYPES, type TypeId } from "@/game/content";
import { newWeaponDesign, parseWeaponDesign, type WeaponDesign } from "@/game/weapon-design";
const KEY = "turbz-designer-weapons-v1";
export function WeaponDesigner({ onBack }: { onBack: () => void }) {
  const [weapon, setWeapon] = useState<WeaponDesign>(newWeaponDesign),
    [color, setColor] = useState("#e6c15a"),
    [erase, setErase] = useState(false),
    [status, setStatus] = useState("Draw a 16 × 16 pixel weapon, then set its stats."),
    [saved, setSaved] = useState<WeaponDesign[]>([]),
    [selected, setSelected] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null),
    input = useRef<HTMLInputElement>(null),
    drawing = useRef(false);
  const [history, setHistory] = useState<WeaponDesign[]>([]);
  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      setSaved(Array.isArray(list) ? list.map(parseWeaponDesign) : []);
    } catch {
      setStatus("Saved weapon library could not be read. Import a backup to recover it.");
    }
  }, []);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 256, 256);
    weapon.pixels.forEach((p, i) => {
      const x = i % 16,
        y = Math.floor(i / 16);
      ctx.fillStyle = (x + y) % 2 ? "#2a2220" : "#3a3029";
      ctx.fillRect(x * 16, y * 16, 16, 16);
      if (p) {
        ctx.fillStyle = p;
        ctx.fillRect(x * 16, y * 16, 16, 16);
      }
      ctx.strokeStyle = "#ffffff18";
      ctx.strokeRect(x * 16, y * 16, 16, 16);
    });
  }, [weapon]);
  function paint(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect(),
      x = Math.floor(((e.clientX - r.left) / r.width) * 16),
      y = Math.floor(((e.clientY - r.top) / r.height) * 16);
    if (x < 0 || y < 0 || x > 15 || y > 15) return;
    setWeapon((w) => {
      const pixels = [...w.pixels];
      pixels[y * 16 + x] = erase ? null : color;
      return { ...w, pixels };
    });
  }
  function run(fn: () => void) {
    try {
      fn();
    } catch (e) {
      setStatus((e as Error).message);
    }
  }
  return (
    <section className="designer-screen">
      <header className="designer-header">
        <div>
          <p className="font-display text-xs text-blood">BUILDER TOOLS</p>
          <h1 className="font-display text-lg">Weapon Designer</h1>
        </div>
        <button className="px-btn" onClick={onBack}>
          Back to Designer Mode
        </button>
      </header>
      <div className="weapon-workspace px-panel">
        <div>
          <canvas
            ref={canvas}
            width={256}
            height={256}
            className="weapon-pixel-canvas"
            aria-label="Weapon pixel canvas"
            onPointerDown={(e) => {
              setHistory((h) => [...h.slice(-19), structuredClone(weapon)]);
              drawing.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              paint(e);
            }}
            onPointerMove={(e) => {
              if (drawing.current) paint(e);
            }}
            onPointerUp={() => {
              drawing.current = false;
            }}
            onPointerCancel={() => {
              drawing.current = false;
            }}
          />
          <div className="designer-toolbar">
            <label>
              Pixel color
              <input
                type="color"
                aria-label="Pixel color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
            <button className="px-btn" aria-pressed={erase} onClick={() => setErase(!erase)}>
              {erase ? "Eraser on" : "Paint pixels"}
            </button>
            <button
              className="px-btn"
              disabled={!history.length}
              onClick={() => {
                setWeapon(history.at(-1)!);
                setHistory(history.slice(0, -1));
              }}
            >
              Undo
            </button>
          </div>
        </div>
        <div className="grid gap-3">
          <label>
            Name
            <input
              className="px-input"
              aria-label="Weapon name"
              value={weapon.name}
              maxLength={100}
              onChange={(e) => setWeapon({ ...weapon, name: e.target.value })}
            />
          </label>
          <label>
            File ID
            <input
              className="px-input"
              aria-label="Weapon ID"
              value={weapon.id}
              onChange={(e) =>
                setWeapon({ ...weapon, id: e.target.value.replace(/[^a-z0-9_-]/gi, "-") })
              }
            />
          </label>
          <label>
            Element
            <select
              value={weapon.type}
              onChange={(e) => setWeapon({ ...weapon, type: e.target.value as TypeId })}
            >
              {Object.entries(TYPES).map(([id, t]) => (
                <option key={id} value={id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ["damage", 1, 500],
              ["speed", 0.2, 5],
              ["range", 16, 500],
            ] as const
          ).map(([key, min, max]) => (
            <label key={key}>
              {key}
              <input
                className="px-input"
                type="number"
                aria-label={`Weapon ${key}`}
                min={min}
                max={max}
                step={key === "speed" ? 0.1 : 1}
                value={weapon[key]}
                onChange={(e) => setWeapon({ ...weapon, [key]: Number(e.target.value) })}
              />
            </label>
          ))}
          <p className="text-dim">
            Equipment supplies combat stats. Abilities use character skill points.
          </p>
        </div>
      </div>
      <div className="designer-toolbar">
        <button
          className="px-btn"
          onClick={() =>
            run(() => {
              const w = parseWeaponDesign(weapon),
                list = [...saved.filter((x) => x.id !== w.id), w];
              localStorage.setItem(KEY, JSON.stringify(list));
              setSaved(list);
              setSelected(w.id);
              setStatus("Saved on this device. Export a backup to share.");
            })
          }
        >
          Save weapon
        </button>
        <button
          className="px-btn"
          onClick={() =>
            run(() => {
              const w = parseWeaponDesign(weapon),
                url = URL.createObjectURL(
                  new Blob([JSON.stringify(w, null, 2)], { type: "application/json" }),
                ),
                a = document.createElement("a");
              a.href = url;
              a.download = `${w.id}.weapon.json`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              setStatus("Exported weapon for a future update.");
            })
          }
        >
          Export JSON
        </button>
        <button className="px-btn" onClick={() => input.current?.click()}>
          Import JSON
        </button>
        <input
          ref={input}
          type="file"
          aria-label="Import weapon file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              if (file.size > 100000) throw Error("Weapon file is too large.");
              setWeapon(parseWeaponDesign(JSON.parse(await file.text())));
              setStatus("Imported weapon.");
            } catch (err) {
              setStatus((err as Error).message);
            }
          }}
        />
        <label>
          Saved weapons
          <select
            aria-label="Saved weapons"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose a weapon</option>
            {saved.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="px-btn"
          disabled={!selected}
          onClick={() => {
            const w = saved.find((w) => w.id === selected);
            if (w) setWeapon(structuredClone(w));
          }}
        >
          Load saved
        </button>
      </div>
      <p role="status" className="designer-status">
        {status}
      </p>
    </section>
  );
}
