import { useEffect, useMemo, useRef, useState } from "react";
import { ANIMALS, MONSTERS, MOVES, TYPES, attackForm, moveTactic, type BiomeId, type TypeId } from "@/game/content";
import { MOB_ENCHANTS, MOB_ENCHANT_IDS, enemyTargets, type EnemyStats, type MobEnchantId } from "@/game/balance";
import { drawCreatureSprite } from "@/game/creature-sprites";
import { BIOME_LABEL } from "@/game/world";
import {
  BIOME_IDS, SHEET_COLS, SHEET_ROWS, SPRITE_CELLS, SPRITE_SIDE, allEnemyDesigns, designFromBuiltin, framesDiffer, idleFrame, installEnemyDesigns, localEnemyDesigns, newEnemyDesign, parseEnemyDesign, registerSprite, saveLocalEnemyDesigns, autoPickMoves, autoPickStats, STAT_OPTIONS,
  type EnemyBehaviour, type EnemyDesign, type EnemyFlags, type StatOption,
} from "@/game/enemy-design";
import { Chips, ConfirmButton, Empty, Field, Section, Tabs } from "./ui-kit";

const PREVIEW_ID = "__designer_preview";
const SHEET_URL = "/sprites/creatures_roguelike.png";
const PALETTE = ["#140e0c", "#f0e2c8", "#a89880", "#c4473a", "#e6c15a", "#6a4cff", "#e25a32", "#3a7eb8", "#8a6a3a", "#9ad8c8", "#f2d43a", "#9ad0ff", "#fff1a8", "#c9a6e8", "#8d72a8", "#5aa88e"];
const OFFENSIVE = MOVES.filter((m) => m.effect !== "mend" && m.effect !== "shell" && !["heal", "ward", "roll", "dash", "surge"].includes(moveTactic(m)) && m.target !== "player");
const BUILTINS = [...MONSTERS.filter((m) => !(m as { custom?: boolean }).custom), ...ANIMALS];

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Animated preview of the design at in-game scale. */
function Preview({ design }: { design: EnemyDesign }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    registerSprite(PREVIEW_ID, design);
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#1d2a18";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#26361f";
      for (let y = 0; y < canvas.height; y += 32) for (let x = (y / 32) % 2 ? 0 : 32; x < canvas.width; x += 64) ctx.fillRect(x, y, 32, 32);
      ctx.scale(2, 2);
      drawCreatureSprite(ctx, { x: canvas.width / 4, y: canvas.height / 4 + 22, template: 0, type: design.type, facing: Math.sin(t * 0.6) > 0 ? 1 : -1, walk: t, hurt: 0, boss: !!(design.flags?.worldBoss || design.flags?.dungeonBoss || design.boss), ghost: !!design.flags?.ghost, animal: !!design.flags?.animal, rarity: 0, species: PREVIEW_ID, time: t });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [design]);
  return <canvas ref={ref} width={256} height={200} className="enemy-preview" aria-label="Enemy preview" />;
}

function SheetPicker({ cell, onPick }: { cell: [number, number] | null; onPick: (c: [number, number]) => void }) {
  return (
    <div className="sheet-picker" style={{ backgroundImage: `url(${SHEET_URL})` }} role="grid" aria-label="Sprite sheet">
      {Array.from({ length: SHEET_ROWS * SHEET_COLS }, (_, i) => {
        const c: [number, number] = [i % SHEET_COLS, Math.floor(i / SHEET_COLS)];
        const on = cell && cell[0] === c[0] && cell[1] === c[1];
        return <button key={i} type="button" className={`sheet-cell ${on ? "sheet-cell-on" : ""}`} aria-label={`Cell ${c[0]},${c[1]}`} onClick={() => onPick(c)} />;
      })}
    </div>
  );
}

const CELL = 16;
const SIDE = SPRITE_SIDE;
const CANVAS_PX = SIDE * CELL;
type PixelTool = "pencil" | "eraser" | "fill" | "pick";

/** Flood-fills from (x, y) across every touching cell of the same colour. */
function floodFill(pixels: (string | null)[], x: number, y: number, to: string | null): (string | null)[] {
  const from = pixels[y * SIDE + x] ?? null;
  if (from === to) return pixels;
  const out = pixels.slice();
  const stack = [[x, y] as const];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= SIDE || cy >= SIDE) continue;
    const i = cy * SIDE + cx;
    if ((out[i] ?? null) !== from) continue;
    out[i] = to;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return out;
}

/** Moves the whole sprite by one cell; anything pushed off the edge is dropped. */
function shiftPixels(pixels: (string | null)[], dx: number, dy: number): (string | null)[] {
  const out: (string | null)[] = Array(SPRITE_CELLS).fill(null);
  for (let y = 0; y < SIDE; y++) {
    for (let x = 0; x < SIDE; x++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= SIDE || ny >= SIDE) continue;
      out[ny * SIDE + nx] = pixels[y * SIDE + x] ?? null;
    }
  }
  return out;
}

function PixelEditor({ pixels, other, onChange }: {
  pixels: (string | null)[];
  /** The frame not being edited, shown faintly underneath so the two line up. */
  other?: (string | null)[];
  onChange: (p: (string | null)[]) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState("#e6c15a");
  const [tool, setTool] = useState<PixelTool>("pencil");
  const [mirror, setMirror] = useState(true);
  const [onion, setOnion] = useState(true);
  const [history, setHistory] = useState<(string | null)[][]>([]);
  const [future, setFuture] = useState<(string | null)[][]>([]);
  const drawing = useRef(false);
  const live = useRef(pixels);
  live.current = pixels;

  /** Remember the art before a change so Undo has somewhere to go, and drop any redo branch. */
  const mark = () => { setHistory((h) => [...h.slice(-39), live.current]); setFuture([]); };
  const apply = (next: (string | null)[]) => onChange(next);
  const edit = (fn: (p: (string | null)[]) => (string | null)[]) => { mark(); apply(fn(live.current)); };

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
    for (let i = 0; i < SPRITE_CELLS; i++) {
      const x = i % SIDE, y = Math.floor(i / SIDE);
      ctx.fillStyle = (x + y) % 2 ? "#2a2220" : "#3a3029";
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
    }
    // Onion skin: the other frame, ghosted, so you can see exactly how far things move.
    if (onion && other) {
      ctx.globalAlpha = 0.28;
      for (let i = 0; i < SPRITE_CELLS; i++) {
        const p = other[i];
        if (!p) continue;
        ctx.fillStyle = p;
        ctx.fillRect((i % SIDE) * CELL, Math.floor(i / SIDE) * CELL, CELL, CELL);
      }
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < SPRITE_CELLS; i++) {
      const p = pixels[i];
      if (!p) continue;
      ctx.fillStyle = p;
      ctx.fillRect((i % SIDE) * CELL, Math.floor(i / SIDE) * CELL, CELL, CELL);
    }
    ctx.strokeStyle = "#ffffff14";
    for (let i = 0; i <= SIDE; i++) {
      ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, CANVAS_PX); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(CANVAS_PX, i * CELL); ctx.stroke();
    }
  }, [pixels, other, onion]);

  const cellAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * SIDE);
    const y = Math.floor(((e.clientY - r.top) / r.height) * SIDE);
    return x < 0 || y < 0 || x >= SIDE || y >= SIDE ? null : { x, y };
  };

  const paint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const at = cellAt(e);
    if (!at) return;
    const { x, y } = at;
    if (tool === "pick") {
      const picked = live.current[y * SIDE + x];
      if (picked) { setColor(picked); setTool("pencil"); }
      return;
    }
    if (tool === "fill") { apply(floodFill(live.current, x, y, color)); return; }
    const next = [...live.current];
    const v = tool === "eraser" ? null : color;
    next[y * SIDE + x] = v;
    if (mirror) next[y * SIDE + (SIDE - 1 - x)] = v;
    apply(next);
  };

  const toolBtn = (id: PixelTool, label: string, title: string) => (
    <button key={id} type="button" className={`px-btn ui-btn-sm ${tool === id ? "px-btn-kyo" : ""}`} title={title} onClick={() => setTool(id)}>{label}</button>
  );

  return (
    <div className="ui-stack-sm">
      <canvas
        ref={ref}
        width={CANVAS_PX}
        height={CANVAS_PX}
        className="weapon-pixel-canvas"
        aria-label="Enemy pixel canvas"
        onPointerDown={(e) => {
          // A fill or a pick is one action, not a drag, so only strokes capture the pointer.
          if (tool !== "pick") mark();
          drawing.current = tool === "pencil" || tool === "eraser";
          if (drawing.current) e.currentTarget.setPointerCapture(e.pointerId);
          paint(e);
        }}
        onPointerMove={(e) => { if (drawing.current) paint(e); }}
        onPointerUp={() => { drawing.current = false; }}
        onPointerCancel={() => { drawing.current = false; }}
      />
      <div className="palette">
        {PALETTE.map((c) => (
          <button key={c} type="button" className={`swatch ${color === c && tool !== "eraser" ? "swatch-on" : ""}`} style={{ background: c }} aria-label={`Colour ${c}`} onClick={() => { setColor(c); if (tool === "eraser") setTool("pencil"); }} />
        ))}
        <input type="color" aria-label="Custom colour" value={color} onChange={(e) => { setColor(e.target.value); if (tool === "eraser") setTool("pencil"); }} />
      </div>
      <div className="ui-row-gap">
        {toolBtn("pencil", "Pencil", "Draw single pixels")}
        {toolBtn("eraser", "Eraser", "Clear single pixels")}
        {toolBtn("fill", "Fill", "Flood-fill a touching area of one colour")}
        {toolBtn("pick", "Pick", "Take a colour from the canvas")}
      </div>
      <div className="ui-row-gap">
        <button type="button" className={`px-btn ui-btn-sm ${mirror ? "px-btn-kyo" : ""}`} title="Draw both sides at once" onClick={() => setMirror(!mirror)}>Mirror {mirror ? "on" : "off"}</button>
        {other && (
          <button type="button" className={`px-btn ui-btn-sm ${onion ? "px-btn-kyo" : ""}`} title="Show the other frame faintly underneath" onClick={() => setOnion(!onion)}>Onion {onion ? "on" : "off"}</button>
        )}
        <button
          type="button"
          className="px-btn ui-btn-sm"
          disabled={!history.length}
          onClick={() => { const prev = history.at(-1)!; setFuture((f) => [...f, live.current]); setHistory(history.slice(0, -1)); apply(prev); }}
        >Undo</button>
        <button
          type="button"
          className="px-btn ui-btn-sm"
          disabled={!future.length}
          onClick={() => { const nxt = future.at(-1)!; setHistory((h) => [...h, live.current]); setFuture(future.slice(0, -1)); apply(nxt); }}
        >Redo</button>
      </div>
      <div className="ui-row-gap">
        <span className="text-dim" style={{ fontSize: 10 }}>Nudge</span>
        <button type="button" className="px-btn ui-btn-sm" title="Move the art left" onClick={() => edit((p) => shiftPixels(p, -1, 0))}>←</button>
        <button type="button" className="px-btn ui-btn-sm" title="Move the art right" onClick={() => edit((p) => shiftPixels(p, 1, 0))}>→</button>
        <button type="button" className="px-btn ui-btn-sm" title="Move the art up" onClick={() => edit((p) => shiftPixels(p, 0, -1))}>↑</button>
        <button type="button" className="px-btn ui-btn-sm" title="Move the art down" onClick={() => edit((p) => shiftPixels(p, 0, 1))}>↓</button>
        <ConfirmButton plain className="ui-btn-sm" label="Clear" confirm="Tap again" onConfirm={() => { mark(); apply(Array(SPRITE_CELLS).fill(null)); }} />
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <label className="ui-slider">
      <span className="ui-row"><span className="ui-field-label">{label}</span><span className="text-kyo">{fmt(value)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

/** Past the old design knee the number still counts. Combat bends chances so they cannot become immunity. */
function overFmt(knee: number, text: (v: number) => string) {
  return (v: number) => (v > knee + 1e-6 ? `${text(v)} overmax` : text(v));
}

const ROLE_FLAGS: { id: keyof EnemyFlags; label: string; hint: string }[] = [
  { id: "witch", label: "Witch", hint: "Fights like a witch and always leaves a ghost that matches her." },
  { id: "worldBoss", label: "World Boss", hint: "A long fight on the wild. Legendary drop, and she always leaves a matching ghost." },
  { id: "dungeonBoss", label: "Dungeon Boss", hint: "The fight at the end of a dungeon. Chunkier than a world boss, epic drop." },
  { id: "overworld", label: "Overworld", hint: "Spawns in the biomes you pick. Off means it only appears where a map places it." },
  { id: "ghost", label: "Ghost", hint: "Already a ghost while it walks. It is not a solid body that becomes one on death." },
  { id: "animal", label: "Animal", hint: "A beast. Less health, and it drops meat and hide." },
];

function roleText(x: EnemyDesign): string {
  const f = x.flags;
  if (!f) return x.boss ? "boss" : "";
  return [
    f.witch && "witch",
    f.worldBoss && "world boss",
    f.dungeonBoss && "dungeon boss",
    f.overworld && "overworld",
    f.ghost && "ghost",
    f.animal && "animal",
  ].filter(Boolean).join(" · ");
}

export function EnemyDesigner({ onBack }: { onBack: () => void }) {
  const [d, setD] = useState<EnemyDesign>(newEnemyDesign);
  const [saved, setSaved] = useState<EnemyDesign[]>(() => localEnemyDesigns());
  const [shippedIds] = useState(() => new Set(allEnemyDesigns().map((x) => x.id).filter((id) => !localEnemyDesigns().some((l) => l.id === id))));
  const [status, setStatus] = useState("Make a new enemy, or start from a built-in one to replace it.");
  const [spriteTab, setSpriteTab] = useState<"sheet" | "pixels">(d.sprite.kind);
  /** Which animation frame the pixel canvas is painting, 0 or 1. */
  const [frame, setFrame] = useState(0);
  const [moveFilter, setMoveFilter] = useState("");
  const [onlyType, setOnlyType] = useState(true);
  const [tab, setTab] = useState<"identity" | "combat" | "spawn">("identity");
  const [statOpts, setStatOpts] = useState<StatOption[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<EnemyDesign>) => setD((x) => ({ ...x, ...patch }));
  const setStat = (k: keyof EnemyStats, v: number) => setD((x) => ({ ...x, stats: { ...x.stats, [k]: v } }));
  const toggleFlag = (id: keyof EnemyFlags, on: boolean) => setD((x) => {
    const flags: EnemyFlags = { ...(x.flags ?? { witch: false, worldBoss: !!x.boss, dungeonBoss: false, overworld: x.biomes.length > 0, ghost: false, animal: false }), [id]: on };
    if (id === "worldBoss" && on) flags.dungeonBoss = false;
    if (id === "dungeonBoss" && on) flags.worldBoss = false;
    return { ...x, flags, boss: flags.worldBoss || flags.dungeonBoss, behaviour: id === "animal" && on ? "flee" : x.behaviour };
  });
  useEffect(() => () => { try { installEnemyDesigns(); } catch { /* ignore */ } }, []);

  const moves = useMemo(() => {
    const f = moveFilter.trim().toLowerCase();
    return OFFENSIVE.filter((m) => (!onlyType || m.type === d.type || m.type === "normal") && (!f || m.name.toLowerCase().includes(f))).slice(0, 60);
  }, [moveFilter, onlyType, d.type]);

  const sample = (hardcore: boolean) => {
    const kind = d.flags?.witch ? "witch" : d.flags?.worldBoss || d.flags?.dungeonBoss || d.boss ? "boss" : d.flags?.animal ? "animal" : "normal";
    const t = enemyTargets({ kind, hardcore });
    return { hits: t.hits * d.stats.hp, pct: t.frac * d.stats.dmg * 100, lv: t.levelOffset + d.levelBonus };
  };
  const std = sample(false), hc = sample(true);

  const commit = (list: EnemyDesign[], msg: string) => {
    saveLocalEnemyDesigns(list);
    setSaved(list);
    installEnemyDesigns();
    setStatus(msg);
  };
  const save = () => {
    try {
      const clean = parseEnemyDesign(d);
      const clash = saved.find((x) => x.id !== clean.id && clean.replaces && x.replaces === clean.replaces);
      if (clash) throw Error(`"${clash.name}" already replaces that enemy. Delete it first.`);
      setD(clean);
      commit([...saved.filter((x) => x.id !== clean.id), clean], clean.replaces ? `Saved. ${clean.name} now replaces ${BUILTINS.find((b) => b.id === clean.replaces)?.name ?? clean.replaces} in new games and on the next load.` : `Saved. ${clean.name} now spawns in ${clean.biomes.length ? clean.biomes.map((b) => BIOME_LABEL[b]).join(", ") : "map zones you place it in"}.`);
    } catch (e) {
      setStatus((e as Error).message);
    }
  };

  return (
    <section className="designer-screen">
      <header className="designer-header">
        <div>
          <p className="screen-kicker">DESIGNER MODE</p>
          <h1 className="screen-title">Enemy Designer</h1>
        </div>
        <button type="button" className="px-btn" onClick={onBack}>Back to Designer Mode</button>
      </header>
      <div className="enemy-workspace">
        <aside className="px-panel enemy-library ui-stack-sm">
          <span className="ui-section-title">YOUR ENEMIES · {saved.length}</span>
          <button type="button" className="px-btn px-btn-kyo ui-btn-sm" onClick={() => { setD(newEnemyDesign()); setSpriteTab("sheet"); setStatus("New enemy."); }}>+ New enemy</button>
          <Field label="Start from a built-in">
            <select className="px-input" value="" onChange={(e) => { if (!e.target.value) return; const next = designFromBuiltin(e.target.value); setD(next); setSpriteTab(next.sprite.kind); setStatus(`Copied ${next.name}. Saving replaces the original everywhere; change "Replaces" to make it a new enemy instead.`); }}>
              <option value="">Choose…</option>
              {BUILTINS.map((m) => <option key={m.id} value={m.id}>{m.name}{m.animal ? " (beast)" : ""}</option>)}
            </select>
          </Field>
          <div className="ui-list enemy-list">
            {saved.map((x) => (
              <button key={x.id} type="button" className={`ui-card verse-pick ${x.id === d.id ? "ui-card-hl" : ""}`} onClick={() => { setD(structuredClone(x)); setSpriteTab(x.sprite.kind); setStatus(`Editing ${x.name}.`); }}>
                <span className={`type-${x.type}`}>{x.name}</span>
                <span className="text-dim">{x.replaces ? `replaces ${BUILTINS.find((b) => b.id === x.replaces)?.name ?? x.replaces}` : "new"}{roleText(x) ? ` · ${roleText(x)}` : ""}</span>
              </button>
            ))}
            {!saved.length && <Empty>Nothing saved yet.</Empty>}
            {[...shippedIds].length > 0 && <p className="text-dim">{shippedIds.size} more ship with the game (custom-enemies.json).</p>}
          </div>
          <div className="ui-list">
            <button type="button" className="px-btn ui-btn-sm" onClick={() => input.current?.click()}>Import JSON</button>
            <button type="button" className="px-btn ui-btn-sm" disabled={!saved.length} onClick={() => { download("custom-enemies.json", saved); setStatus("Exported every enemy. Put this file at src/game/enemies/custom-enemies.json to ship them to all players."); }}>Export all</button>
          </div>
          <input
            ref={input}
            type="file"
            hidden
            accept=".json,application/json"
            aria-label="Import enemy file"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                if (file.size > 2_000_000) throw Error("That file is too large.");
                const raw = JSON.parse(await file.text());
                const list = (Array.isArray(raw) ? raw : [raw]).map(parseEnemyDesign);
                const byId = new Map(saved.map((x) => [x.id, x]));
                for (const x of list) byId.set(x.id, x);
                commit([...byId.values()], `Imported ${list.length} enem${list.length === 1 ? "y" : "ies"}.`);
                if (list[0]) { setD(list[0]); setSpriteTab(list[0].sprite.kind); }
              } catch (err) {
                setStatus((err as Error).message);
              }
            }}
          />
        </aside>

        <div className="px-panel enemy-art ui-stack">
          <Preview design={d} />
          <div className="enemy-sample">
            <p><span className="text-kyo">Standard</span> · ≈{std.hits.toFixed(1)} of your hits · {std.pct.toFixed(1)}% of your HP a hit · +{std.lv} lv</p>
            <p><span className="text-blood">Hardcore</span> · ≈{hc.hits.toFixed(1)} of your hits · {hc.pct.toFixed(1)}% of your HP a hit · +{hc.lv} lv</p>
          </div>
          <Tabs value={spriteTab} onChange={(t) => { setSpriteTab(t); if (t === "pixels" && d.sprite.kind !== "pixels") set({ sprite: { kind: "pixels", pixels: Array(SPRITE_CELLS).fill(null), pixels2: Array(SPRITE_CELLS).fill(null) } }); if (t === "sheet" && d.sprite.kind !== "sheet") set({ sprite: { kind: "sheet", cell: [0, 0] } }); }} tabs={[{ id: "sheet", label: "From sprite sheet" }, { id: "pixels", label: "Draw pixels" }]} />
          {spriteTab === "sheet" && d.sprite.kind === "sheet" && <SheetPicker cell={d.sprite.cell} onPick={(cell) => set({ sprite: { kind: "sheet", cell } })} />}
          {spriteTab === "pixels" && d.sprite.kind === "pixels" && (() => {
            const sprite = d.sprite;
            const f1 = sprite.pixels;
            const f2 = sprite.pixels2 ?? idleFrame(f1);
            const editingF2 = frame === 1;
            const moves = framesDiffer(f1, f2);
            const setFrames = (a: (string | null)[], b: (string | null)[]) => set({ sprite: { kind: "pixels", pixels: a, pixels2: b } });
            return (
              <div className="ui-stack-sm">
                <Tabs
                  value={editingF2 ? "f2" : "f1"}
                  onChange={(id) => setFrame(id === "f2" ? 1 : 0)}
                  tabs={[{ id: "f1", label: "Frame 1" }, { id: "f2", label: "Frame 2" }]}
                />
                <p className="ui-field-hint">
                  {moves
                    ? "Both frames are drawn, so this enemy animates in game. Every enemy animates — there is no toggle."
                    : "Frame 2 matches frame 1, so this enemy will hold still. Nudge or repaint frame 2 to give it life."}
                </p>
                <PixelEditor
                  // One undo stack per frame: undoing on frame 2 must not reach into frame 1.
                  key={editingF2 ? "f2" : "f1"}
                  pixels={editingF2 ? f2 : f1}
                  other={editingF2 ? f1 : f2}
                  onChange={(p) => (editingF2 ? setFrames(f1, p) : setFrames(p, f2))}
                />
                <div className="ui-row-gap">
                  <button
                    type="button"
                    className="px-btn ui-btn-sm"
                    title="Build frame 2 from frame 1 as a one-pixel breath"
                    onClick={() => { setFrames(f1, idleFrame(f1)); setFrame(1); }}
                  >Auto idle</button>
                  <button
                    type="button"
                    className="px-btn ui-btn-sm"
                    title="Make frame 2 an exact copy of frame 1, to edit by hand"
                    onClick={() => { setFrames(f1, f1.slice()); setFrame(1); }}
                  >Copy 1 → 2</button>
                  <button type="button" className="px-btn ui-btn-sm" title="Swap the two frames" onClick={() => setFrames(f2, f1)}>Swap</button>
                </div>
              </div>
            );
          })()}
          <Slider label="Size" value={d.scale} min={0.5} max={6} step={0.25} onChange={(v) => set({ scale: v })} fmt={overFmt(3, (v) => `${v}×`)} />
        </div>

        <div className="px-panel enemy-form ui-stack">
          <Tabs value={tab} onChange={setTab} tabs={[{ id: "identity", label: "Identity" }, { id: "combat", label: "Combat" }, { id: "spawn", label: "Spawn & loot" }]} />
          {tab === "identity" && (
            <>
              <Field label="Name"><input className="px-input" value={d.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} /></Field>
              <Field label="ID (file name)" hint="Letters, numbers, - and _."><input className="px-input" value={d.id} onChange={(e) => set({ id: e.target.value.replace(/[^a-z0-9_-]/gi, "-").slice(0, 40) })} /></Field>
              <Field label="Replaces" hint="Replace a built-in enemy everywhere it appears, or make a brand-new one.">
                <select className="px-input" value={d.replaces ?? ""} onChange={(e) => set({ replaces: e.target.value || null })}>
                  <option value="">Nothing · a new enemy</option>
                  {BUILTINS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </Field>
              <Field label="Element">
                <select className="px-input" value={d.type} onChange={(e) => set({ type: e.target.value as TypeId })}>
                  {(Object.keys(TYPES) as TypeId[]).map((t) => <option key={t} value={t}>{TYPES[t].name}</option>)}
                </select>
              </Field>
              <Field label="Behaviour">
                <Chips value={d.behaviour} onChange={(v: EnemyBehaviour) => set({ behaviour: v })} options={[{ id: "hunt", label: "Hunts you" }, { id: "drift", label: "Only if provoked" }, { id: "flee", label: "Flees" }]} />
              </Field>
              <Section title="FLAGS">
                <div className="ench-grid">
                  {ROLE_FLAGS.map((f) => (
                    <label key={f.id} className={`chip chip-check ${d.flags?.[f.id] ? "chip-on" : ""}`} title={f.hint}>
                      <input type="checkbox" checked={!!d.flags?.[f.id]} onChange={(e) => toggleFlag(f.id, e.target.checked)} />
                      {f.label}
                    </label>
                  ))}
                </div>
                <p className="text-dim">World Boss and Dungeon Boss cannot both be on. Witch, Ghost and Animal can stack with either.</p>
              </Section>
              <Field label="Description"><textarea className="px-input" rows={3} maxLength={200} value={d.about} onChange={(e) => set({ about: e.target.value })} /></Field>
            </>
          )}
          {tab === "combat" && (
            <>
              <Section title="AUTO STAT PICKER">
                <div className="ench-grid">
                  {STAT_OPTIONS.map((o) => (
                    <label key={o.id} className={`chip chip-check ${statOpts.includes(o.id) ? "chip-on" : ""}`} title={o.hint}>
                      <input type="checkbox" checked={statOpts.includes(o.id)} onChange={(e) => setStatOpts(e.target.checked ? [...statOpts, o.id] : statOpts.filter((x) => x !== o.id))} />
                      {o.label}
                    </label>
                  ))}
                </div>
                <button type="button" className="px-btn ui-btn-sm" onClick={() => set({ stats: autoPickStats(d, statOpts) })}>Apply AutoStats</button>
                <p className="text-dim">Pick combat styles, then apply. Role flags (boss, witch, animal) also influence the result.</p>
              </Section>
              <Section title="STATS · ON TOP OF NORMAL SCALING">
                <Slider label="Health" value={d.stats.hp} min={0.05} max={50} step={0.05} onChange={(v) => setStat("hp", v)} fmt={overFmt(5, (v) => `${v.toFixed(2)}×`)} />
                <Slider label="Damage" value={d.stats.dmg} min={0.05} max={50} step={0.05} onChange={(v) => setStat("dmg", v)} fmt={overFmt(5, (v) => `${v.toFixed(2)}×`)} />
                <Slider label="Turn speed" value={d.stats.speed} min={0.1} max={20} step={0.05} onChange={(v) => setStat("speed", v)} fmt={overFmt(2, (v) => `${v.toFixed(2)}×`)} />
                <Slider label="Crit chance" value={d.stats.crit} min={0} max={3} step={0.01} onChange={(v) => setStat("crit", v)} fmt={overFmt(0.45, (v) => `${Math.round(v * 100)}%`)} />
                <Slider label="Dodge" value={d.stats.dodge} min={0} max={3} step={0.01} onChange={(v) => setStat("dodge", v)} fmt={overFmt(0.35, (v) => `${Math.round(v * 100)}%`)} />
                <Slider label="Physical resist" value={d.stats.physRes} min={0} max={3} step={0.01} onChange={(v) => setStat("physRes", v)} fmt={overFmt(0.55, (v) => `${Math.round(v * 100)}%`)} />
                <Slider label="Spell resist" value={d.stats.spellRes} min={0} max={3} step={0.01} onChange={(v) => setStat("spellRes", v)} fmt={overFmt(0.55, (v) => `${Math.round(v * 100)}%`)} />
                <Slider label="Levels above you" value={d.levelBonus} min={0} max={200} step={1} onChange={(v) => set({ levelBonus: v })} fmt={overFmt(20, (v) => `+${v}`)} />
              </Section>
              <Section title={`ENCHANTMENTS · ${d.enchants.length} ALWAYS`}>
                <div className="ench-grid">
                  {MOB_ENCHANT_IDS.map((id) => (
                    <label key={id} className={`chip chip-check ${d.enchants.includes(id) ? "chip-on" : ""}`} title={MOB_ENCHANTS[id].about}>
                      <input type="checkbox" checked={d.enchants.includes(id)} onChange={(e) => set({ enchants: e.target.checked ? [...d.enchants, id] : d.enchants.filter((x) => x !== id) as MobEnchantId[] })} />
                      {MOB_ENCHANTS[id].name}
                    </label>
                  ))}
                </div>
                <Slider label="Random extra enchants per spawn" value={d.extraEnchants} min={0} max={12} step={1} onChange={(v) => set({ extraEnchants: v })} fmt={overFmt(4, (v) => String(v))} />
              </Section>
              <Section title={`MOVES · ${d.moves.length}/4`}>
                <div className="cost-row">
                  {d.moves.map((id) => {
                    const m = MOVES.find((x) => x.id === id);
                    return <button key={id} type="button" className={`chip chip-on`} onClick={() => set({ moves: d.moves.filter((x) => x !== id) })}>{m?.name ?? id} ×</button>;
                  })}
                  {!d.moves.length && <span className="text-blood">Pick at least one move.</span>}
                </div>
                <div className="bag-toolbar">
                  <input className="px-input" placeholder="Search moves" value={moveFilter} onChange={(e) => setMoveFilter(e.target.value)} />
                  <label className="chip chip-check"><input type="checkbox" checked={onlyType} onChange={(e) => setOnlyType(e.target.checked)} /> Its element</label>
                </div>
                <button type="button" className="px-btn ui-btn-sm" onClick={() => set({ moves: autoPickMoves(d, statOpts) })}>AutoMove Picker</button>
                <div className="move-pick">
                  {moves.map((m) => (
                    <button key={m.id} type="button" className={`ui-card verse-pick ${d.moves.includes(m.id) ? "ui-card-hl" : ""}`} disabled={!d.moves.includes(m.id) && d.moves.length >= 4} onClick={() => set({ moves: d.moves.includes(m.id) ? d.moves.filter((x) => x !== m.id) : [...d.moves, m.id] })}>
                      <span className={`type-${m.type}`}>{m.name}</span>
                      <span className="text-dim">{attackForm(m)} · pow {m.power}{m.effect !== "none" ? ` · ${m.effect}` : ""}</span>
                    </button>
                  ))}
                </div>
              </Section>
            </>
          )}
          {tab === "spawn" && (
            <>
              <Section title="WHERE IT SPAWNS">
                {d.replaces ? (
                  <p className="text-dim">It replaces {BUILTINS.find((b) => b.id === d.replaces)?.name}, so it appears wherever that enemy did. The flags still change how that enemy fights.</p>
                ) : d.flags?.overworld ? (
                  <>
                    <div className="ench-grid">
                      {BIOME_IDS.map((b: BiomeId) => (
                        <label key={b} className={`chip chip-check ${d.biomes.includes(b) ? "chip-on" : ""}`}>
                          <input type="checkbox" checked={d.biomes.includes(b)} onChange={(e) => set({ biomes: e.target.checked ? [...d.biomes, b] : d.biomes.filter((x) => x !== b) })} />
                          {BIOME_LABEL[b]}
                        </label>
                      ))}
                    </div>
                    <Slider label="How common" value={d.weight} min={1} max={20} step={1} onChange={(v) => set({ weight: v })} fmt={overFmt(5, (v) => ["", "Rare", "Uncommon", "Common", "Very common", "Everywhere"][v] ?? String(v))} />
                    <p className="text-dim">Overworld is on. It can also be placed in Map Builder spawn zones. With no biome ticked it only appears where you place it.</p>
                  </>
                ) : (
                  <p className="text-dim">Overworld is off, so this enemy does not wander the wild. Place it in Map Builder, or turn Overworld on and pick biomes.</p>
                )}
              </Section>
              <Section title="LOOT">
                <Slider label="Kyo and gear drop" value={d.loot} min={0.1} max={40} step={0.1} onChange={(v) => set({ loot: v })} fmt={overFmt(3, (v) => `${v.toFixed(1)}×`)} />
              </Section>
            </>
          )}
          <div className="screen-actions">
            {saved.some((x) => x.id === d.id) && <ConfirmButton plain className="ui-btn-sm" label="Delete" confirm="Tap again to delete" onConfirm={() => commit(saved.filter((x) => x.id !== d.id), `Deleted ${d.name}.`)} />}
            <button type="button" className="px-btn ui-btn-sm" onClick={() => { try { download(`${parseEnemyDesign(d).id}.enemy.json`, parseEnemyDesign(d)); setStatus("Exported this enemy."); } catch (e) { setStatus((e as Error).message); } }}>Export</button>
            <button type="button" className="px-btn px-btn-kyo" onClick={save}>Save enemy</button>
          </div>
        </div>
      </div>
      <p role="status" className="designer-status">{status}</p>
    </section>
  );
}
