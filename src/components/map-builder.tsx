import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ITEMS, TILE } from "@/game/content";
import {
  MAX_LAYERS,
  FLOOR_COLOR,
  deleteDesignerMap,
  downloadMapFile,
  emptyMap,
  packMap,
  parseMapJson,
  saveDesignerMap,
  savedMaps,
  type MapFile,
  type MapQuest,
  type MapTile,
} from "@/game/map-format";
import { blankTile, floodIndices, resizeMap, validateMap, type Issue } from "@/game/map-tools";
import { drawAtlasTile, findAtlasTile, tileImageRevision } from "@/game/tile-atlas";
import { DEFAULT_OPTS, Inspector, PlaceSettings, type PlaceOpts, type Sel } from "@/components/map-builder-entities";
import { QuestEditor } from "@/components/map-builder-quests";
import { TilePalette, type Brush } from "@/components/map-builder-tiles";
import type { Spawn } from "@/game/world";

type Tool =
  | "pan" | "select" | "remove"
  | "paint" | "overlay" | "peel" | "rect" | "fill" | "pick" | "erase" | "wall" | "walk"
  | "portal" | "unportal"
  | "start" | "enemy" | "boss" | "zone" | "node" | "npc" | "bounty" | "arena" | "shrine" | "hearth" | "dungeon";
type Tab = "map" | "tiles" | "place" | "quests" | "files";

const TOOL_GROUPS: { label: string; tools: [Tool, string, string][] }[] = [
  { label: "View", tools: [["pan", "Pan", "Drag to move the view. Right-drag or middle-drag does this with any tool."], ["select", "Select", "Click something to edit it. Drag to move it."], ["remove", "Remove", "Click a placed thing to delete it."]] },
  { label: "Terrain", tools: [["paint", "Paint", "Paint the selected tile or ground."], ["rect", "Rectangle", "Drag a rectangle and fill it."], ["fill", "Fill", "Fill a connected area."], ["overlay", "Overlay", "Add a decoration layer on top (up to 4)."], ["peel", "Peel", "Remove the top layer."], ["pick", "Pick", "Copy a tile's look into the brush."], ["erase", "Erase", "Reset to bare ground."], ["wall", "Block", "Make tiles solid."], ["walk", "Open", "Make tiles walkable."]] },
  { label: "Links", tools: [["portal", "Portal", "Make tiles portals to another map."], ["unportal", "No portal", "Remove portals."]] },
  { label: "Place", tools: [["start", "Start", "Where hunters arrive."], ["enemy", "Enemy", "A single enemy spawn."], ["boss", "Boss", "A boss spawn."], ["zone", "Spawn zone", "A rectangle that keeps spawning enemies."], ["node", "Node", "Tree, ore, mushrooms or fishing spot."], ["npc", "NPC", "A person who talks and gives quests."], ["bounty", "Bounty board", "Bounty hunts."], ["arena", "Arena", "A fight against a saint."], ["shrine", "Shrine", "An elemental shrine fight."], ["hearth", "Hearth", "Heals when used."], ["dungeon", "Door", "A door to another map."]] },
];

const ENTITY_TOOLS: Tool[] = ["node", "npc", "bounty", "arena", "shrine", "hearth", "dungeon"];
const DRAFT_KEY = "turbz-designer-draft-v1";
const HISTORY = 60;

type Meta = Pick<MapFile, "spawns" | "zones" | "interactables" | "npcs" | "quests" | "spawn" | "intro">;
type Entry = { tiles?: Map<number, MapTile>; meta?: Meta; full?: MapFile };

const metaOf = (m: MapFile): Meta => ({ spawns: m.spawns, zones: m.zones, interactables: m.interactables, npcs: m.npcs, quests: m.quests, spawn: m.spawn, intro: m.intro });
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "map";
const uid = () => Math.random().toString(36).slice(2, 10);

function starterMap(): MapFile {
  const m = emptyMap("my-world", "My World", 96, 64, 0, 3);
  m.kind = "world";
  m.intro = "";
  return m;
}

function loadDraft(): MapFile {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return parseMapJson(JSON.parse(raw));
  } catch { /* fall through to a fresh map */ }
  return starterMap();
}

export function MapBuilder({ onBack }: { onBack: () => void }) {
  const [map, setMapState] = useState<MapFile>(loadDraft);
  const mapRef = useRef(map);
  mapRef.current = map;
  const [, redraw] = useState(0);
  const bump = useCallback(() => redraw((n) => n + 1), []);
  const [tab, setTab] = useState<Tab>("tiles");
  const [tool, setTool] = useState<Tool>("paint");
  const [brush, setBrush] = useState<Brush>({ mode: "floor", floor: 0 });
  const [size, setSize] = useState(1);
  const [opts, setOpts] = useState<PlaceOpts>(DEFAULT_OPTS);
  const [sel, setSel] = useState<Sel>(null);
  const [questId, setQuestId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(20);
  const [grid, setGrid] = useState(true);
  const [collision, setCollision] = useState(true);
  const [status, setStatus] = useState("Pick a tile on the Tiles tab and paint. Right-drag to move around, scroll to zoom.");
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [pick, setPick] = useState<((tx: number, ty: number) => void) | null>(null);
  const [hover, setHover] = useState<{ tx: number; ty: number } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState<MapFile[]>(() => savedMaps());
  const [form, setForm] = useState({ name: "My World", id: "my-world", w: 96, h: 64, kind: "world" as NonNullable<MapFile["kind"]>, floor: 0 });
  const [importText, setImportText] = useState("");

  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const cam = useRef({ x: 0, y: 0 });
  const undo = useRef<Entry[]>([]);
  const redo = useRef<Entry[]>([]);
  const stroke = useRef<Entry | null>(null);
  const drag = useRef<{ kind: "pan" | "paint" | "rect" | "move"; sx: number; sy: number; ox: number; oy: number; a?: { tx: number; ty: number }; b?: { tx: number; ty: number } } | null>(null);
  const frame = useRef(0);
  const imgRev = useRef(-1);

  const setMap = useCallback((m: MapFile) => { mapRef.current = m; setMapState(m); }, []);

  // ---- history ------------------------------------------------------------------------------
  const pushUndo = (e: Entry) => { undo.current.push(e); if (undo.current.length > HISTORY) undo.current.shift(); redo.current = []; setDirty(true); };
  const applyEntry = (e: Entry, into: Entry[]) => {
    const m = mapRef.current;
    if (e.full) { into.push({ full: m }); setMap(e.full); return; }
    const inverse: Entry = {};
    if (e.tiles) { inverse.tiles = new Map(); for (const [i, t] of e.tiles) { inverse.tiles.set(i, m.tiles[i]!); m.tiles[i] = t; } }
    if (e.meta) { inverse.meta = metaOf(m); Object.assign(m, e.meta); }
    into.push(inverse);
  };
  const doUndo = () => { const e = undo.current.pop(); if (!e) return; applyEntry(e, redo.current); setDirty(true); setSel(null); bump(); };
  const doRedo = () => { const e = redo.current.pop(); if (!e) return; applyEntry(e, undo.current); setDirty(true); setSel(null); bump(); };
  /** Change entities (anything but tiles) with undo support. */
  const edit = (fn: (m: MapFile) => void, keepRedo = false) => {
    const m = mapRef.current;
    pushUndo({ meta: metaOf(m) });
    fn(m);
    if (keepRedo) return;
    bump();
  };

  // ---- draft autosave -----------------------------------------------------------------------
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      try {
        const m = mapRef.current;
        localStorage.setItem(DRAFT_KEY, JSON.stringify(packMap(m)));
      } catch { /* draft is a convenience only */ }
    }, 1500);
    return () => clearTimeout(t);
  });

  // ---- tiles --------------------------------------------------------------------------------
  const paintTile = (old: MapTile, mode: Tool): MapTile => {
    if (mode === "erase") return blankTile(0, old.biome);
    if (mode === "wall") return { ...old, block: 1 };
    if (mode === "walk") return { ...old, block: 0 };
    if (mode === "peel") {
      if (old.layers?.length) { const layers = old.layers.slice(0, -1); const { layers: _l, ...rest } = old; return layers.length ? { ...rest, layers } : rest; }
      if (old.sprite) { const { sprite: _s, ...rest } = old; return { ...rest, block: old.floor === 1 ? 1 : 0 }; }
      return old;
    }
    if (brush.mode === "floor") {
      const { sprite: _s, layers: _l, ...rest } = old;
      return { ...rest, floor: brush.floor, block: brush.floor === 1 ? 1 : 0 };
    }
    const solid = brush.tile.solid ? 1 : 0;
    if (mode === "overlay") {
      const layers = [...(old.layers ?? [])];
      if (layers.length >= MAX_LAYERS || layers[layers.length - 1] === brush.tile.path) return old;
      layers.push(brush.tile.path);
      return { ...old, layers, block: solid ? 1 : old.block };
    }
    const { layers: _l, ...rest } = old;
    return { ...rest, sprite: brush.tile.path, floor: brush.liquid ? 2 : old.floor === 2 || old.floor === 1 ? 0 : old.floor, block: solid };
  };

  const setTileAt = (idx: number, next: MapTile) => {
    const m = mapRef.current;
    const old = m.tiles[idx]!;
    if (old === next) return;
    if (stroke.current?.tiles && !stroke.current.tiles.has(idx)) stroke.current.tiles.set(idx, old);
    m.tiles[idx] = next;
  };

  const brushCells = (tx: number, ty: number, n = size) => {
    const m = mapRef.current;
    const out: number[] = [];
    const r = Math.floor((n - 1) / 2);
    for (let y = ty - r; y < ty - r + n; y++) for (let x = tx - r; x < tx - r + n; x++) if (x >= 0 && y >= 0 && x < m.w && y < m.h) out.push(y * m.w + x);
    return out;
  };

  const applyTerrain = (tx: number, ty: number) => {
    const m = mapRef.current;
    for (const i of brushCells(tx, ty)) setTileAt(i, paintTile(m.tiles[i]!, tool));
  };

  const sameLook = (a: MapTile, b: MapTile) => a.sprite === b.sprite && a.floor === b.floor && a.block === b.block && (a.layers?.join("|") ?? "") === (b.layers?.join("|") ?? "");

  const doFill = (tx: number, ty: number) => {
    const m = mapRef.current;
    const origin = m.tiles[ty * m.w + tx];
    if (!origin) return;
    const idx = floodIndices(m, tx, ty, (t) => sameLook(t, origin));
    if (!idx.length) return;
    stroke.current = { tiles: new Map() };
    for (const i of idx) setTileAt(i, paintTile(m.tiles[i]!, "paint"));
    endStroke();
    setStatus(`Filled ${idx.length} tiles.`);
  };

  const endStroke = () => {
    const s = stroke.current;
    stroke.current = null;
    if (s?.tiles?.size) pushUndo(s);
    bump();
  };

  // ---- entities -----------------------------------------------------------------------------
  const walkable = (tx: number, ty: number) => {
    const m = mapRef.current;
    const t = m.tiles[ty * m.w + tx];
    return !!t && !t.block;
  };

  const entityAt = (tx: number, ty: number): Sel => {
    const m = mapRef.current;
    const npc = m.npcs?.find((n) => n.tx === tx && n.ty === ty);
    if (npc) return { kind: "npc", id: npc.id };
    const it = m.interactables?.find((n) => n.tx === tx && n.ty === ty);
    if (it) return { kind: "it", id: it.id };
    const sp = m.spawns?.find((s) => s.kind === "mob" && Math.floor(s.x / TILE) === tx && Math.floor(s.y / TILE) === ty);
    if (sp) return { kind: "spawn", id: sp.id };
    const z = m.zones?.find((q) => tx >= q.tx && ty >= q.ty && tx < q.tx + q.tw && ty < q.ty + q.th);
    return z ? { kind: "zone", id: z.id } : null;
  };

  const occupied = (tx: number, ty: number) => {
    const m = mapRef.current;
    return !!(m.npcs?.some((n) => n.tx === tx && n.ty === ty) || m.interactables?.some((n) => n.tx === tx && n.ty === ty) || m.spawns?.some((s) => Math.floor(s.x / TILE) === tx && Math.floor(s.y / TILE) === ty));
  };

  const place = (tx: number, ty: number) => {
    const m = mapRef.current;
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return;
    if (tool === "start") {
      if (!walkable(tx, ty)) return setStatus("The start tile must be walkable.");
      edit((mm) => { mm.spawn = { tx, ty }; });
      return setStatus(`Start moved to ${tx}, ${ty}.`);
    }
    if (tool === "portal") {
      edit(() => {}, true);
      stroke.current = { tiles: new Map() };
      for (const i of brushCells(tx, ty)) { const t = m.tiles[i]!; setTileAt(i, { ...t, portal: { map: opts.portal.map, ...(opts.portal.map !== "world" && opts.portal.tx !== undefined ? { tx: opts.portal.tx, ty: opts.portal.ty } : {}) } }); }
      undo.current.pop();
      endStroke();
      return;
    }
    if (!walkable(tx, ty)) return setStatus("That tile is solid. Place things on walkable ground.");
    if (tool !== "zone" && occupied(tx, ty)) return setStatus("Something is already on that tile.");
    const id = uid();
    if (tool === "enemy" || tool === "boss") {
      edit((mm) => { mm.spawns = [...(mm.spawns ?? []), { id, kind: "mob", species: opts.species, x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, level: opts.level, fixedLevel: true, ...(tool === "boss" ? { boss: true } : {}) } as Spawn]; });
      setSel({ kind: "spawn", id });
    } else if (tool === "npc") {
      const nid = `npc-${id}`;
      edit((mm) => { mm.npcs = [...(mm.npcs ?? []), { id: nid, name: "Villager", role: "Villager", tx, ty, lines: ["Hello, traveler."], female: Math.random() < 0.5 }]; });
      setSel({ kind: "npc", id: nid });
      setTab("place");
      setStatus("NPC placed. Name them and write their lines, then make quests on the Quests tab.");
    } else if (tool === "node") {
      edit((mm) => { mm.interactables = [...(mm.interactables ?? []), { id, kind: "node", node: opts.node, tx, ty }]; });
    } else if (tool === "bounty" || tool === "arena") {
      edit((mm) => { mm.interactables = [...(mm.interactables ?? []), { id, kind: tool, tx, ty, label: tool === "bounty" ? "Bounty Board" : "Arena" }]; });
      setSel({ kind: "it", id });
    } else if (tool === "shrine") {
      edit((mm) => { mm.interactables = [...(mm.interactables ?? []), { id, kind: "shrine", type: opts.shrine, tx, ty, name: "Shrine" }]; });
      setSel({ kind: "it", id });
    } else if (tool === "hearth") {
      edit((mm) => { mm.interactables = [...(mm.interactables ?? []), { id, kind: "hearth", tx, ty }]; });
    } else if (tool === "dungeon") {
      edit((mm) => { mm.interactables = [...(mm.interactables ?? []), { id, kind: "dungeon", mapId: opts.door, tx, ty, name: "Door" }]; });
      setSel({ kind: "it", id });
    }
  };

  const removeEntity = (s: NonNullable<Sel>) => {
    edit((m) => {
      if (s.kind === "npc") {
        m.npcs = (m.npcs ?? []).filter((n) => n.id !== s.id);
        m.quests = (m.quests ?? []).map((q) => (q.turnIn === s.id ? { ...q, turnIn: undefined } : q));
      }
      if (s.kind === "it") m.interactables = (m.interactables ?? []).filter((n) => n.id !== s.id);
      if (s.kind === "spawn") m.spawns = (m.spawns ?? []).filter((n) => n.id !== s.id);
      if (s.kind === "zone") m.zones = (m.zones ?? []).filter((n) => n.id !== s.id);
    });
    setSel(null);
  };

  // Text boxes change a lot per keystroke; only the first change in a burst makes an undo step.
  const lastTyped = useRef(0);
  const patchList = <K extends "npcs" | "interactables" | "spawns" | "zones">(key: K, id: string, p: object) => {
    const m = mapRef.current;
    const now = Date.now();
    if (now - lastTyped.current > 1200) pushUndo({ meta: metaOf(m) });
    lastTyped.current = now;
    (m as unknown as Record<string, { id: string }[]>)[key] = ((m[key] ?? []) as { id: string }[]).map((x) => (x.id === id ? { ...x, ...p } : x));
    bump();
  };

  const setQuests = (quests: MapQuest[]) => {
    const m = mapRef.current;
    const now = Date.now();
    if (now - lastTyped.current > 1200) pushUndo({ meta: metaOf(m) });
    lastTyped.current = now;
    m.quests = quests;
    bump();
  };

  // ---- view ---------------------------------------------------------------------------------
  const toTile = (clientX: number, clientY: number) => {
    const r = canvas.current!.getBoundingClientRect();
    return { tx: Math.floor(cam.current.x + (clientX - r.left) / zoom), ty: Math.floor(cam.current.y + (clientY - r.top) / zoom) };
  };
  const clampCam = () => {
    const m = mapRef.current;
    const c = canvas.current;
    const vw = (c?.width ?? 600) / zoom, vh = (c?.height ?? 400) / zoom;
    cam.current.x = Math.max(-4, Math.min(m.w - vw + 4, cam.current.x));
    cam.current.y = Math.max(-4, Math.min(m.h - vh + 4, cam.current.y));
  };
  const jump = (tx: number, ty: number) => {
    const c = canvas.current;
    if (!c) return;
    cam.current.x = tx - c.width / zoom / 2;
    cam.current.y = ty - c.height / zoom / 2;
    clampCam();
    bump();
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { tx, ty } = toTile(e.clientX, e.clientY);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    if (pick) { const cb = pick; setPick(null); cb(tx, ty); setStatus(`Picked tile ${tx}, ${ty}.`); return; }
    if (e.button === 1 || e.button === 2 || tool === "pan") { drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, ox: cam.current.x, oy: cam.current.y }; return; }
    const m = mapRef.current;
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return;
    if (tool === "select") {
      const s = entityAt(tx, ty);
      setSel(s);
      if (s?.kind === "npc" || s?.kind === "it" || s?.kind === "spawn") { pushUndo({ meta: metaOf(m) }); drag.current = { kind: "move", sx: tx, sy: ty, ox: 0, oy: 0 }; }
      if (s) setTab("place");
      return;
    }
    if (tool === "remove") {
      const s = entityAt(tx, ty);
      if (s) { removeEntity(s); return; }
      const t = m.tiles[ty * m.w + tx]!;
      if (t.portal) { stroke.current = { tiles: new Map() }; const { portal: _p, ...rest } = t; setTileAt(ty * m.w + tx, rest); endStroke(); }
      return;
    }
    if (tool === "pick") {
      const t = m.tiles[ty * m.w + tx]!;
      if (t.sprite) { const a = findAtlasTile(t.sprite); if (a) setBrush({ mode: "sprite", tile: a, liquid: t.floor === 2 }); else setStatus("That tile's art is not in the pack list yet."); }
      else setBrush({ mode: "floor", floor: t.floor });
      setTool("paint");
      return;
    }
    if (tool === "fill") return doFill(tx, ty);
    if (tool === "rect" || tool === "zone") { drag.current = { kind: "rect", sx: 0, sy: 0, ox: 0, oy: 0, a: { tx, ty }, b: { tx, ty } }; bump(); return; }
    if (["paint", "overlay", "peel", "erase", "wall", "walk", "unportal"].includes(tool)) {
      stroke.current = { tiles: new Map() };
      drag.current = { kind: "paint", sx: 0, sy: 0, ox: 0, oy: 0 };
      if (tool === "unportal") unportal(tx, ty); else applyTerrain(tx, ty);
      bump();
      return;
    }
    if (tool === "portal") { drag.current = { kind: "paint", sx: 0, sy: 0, ox: 0, oy: 0 }; place(tx, ty); return; }
    place(tx, ty);
  };

  const unportal = (tx: number, ty: number) => {
    const m = mapRef.current;
    for (const i of brushCells(tx, ty)) { const t = m.tiles[i]!; if (t.portal) { const { portal: _p, ...rest } = t; setTileAt(i, rest); } }
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { tx, ty } = toTile(e.clientX, e.clientY);
    if (!hover || hover.tx !== tx || hover.ty !== ty) setHover({ tx, ty });
    const d = drag.current;
    if (!d) return;
    const m = mapRef.current;
    if (d.kind === "pan") { cam.current.x = d.ox - (e.clientX - d.sx) / zoom; cam.current.y = d.oy - (e.clientY - d.sy) / zoom; clampCam(); bump(); return; }
    if (d.kind === "rect") { d.b = { tx: Math.max(0, Math.min(m.w - 1, tx)), ty: Math.max(0, Math.min(m.h - 1, ty)) }; bump(); return; }
    if (d.kind === "paint") {
      if (tool === "portal") place(tx, ty);
      else if (tool === "unportal") unportal(tx, ty);
      else applyTerrain(tx, ty);
      bump();
      return;
    }
    if (d.kind === "move" && sel && (d.sx !== tx || d.sy !== ty)) {
      if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h || !walkable(tx, ty) || occupied(tx, ty)) return;
      d.sx = tx; d.sy = ty;
      if (sel.kind === "npc") m.npcs = (m.npcs ?? []).map((n) => (n.id === sel.id ? { ...n, tx, ty } : n));
      if (sel.kind === "it") m.interactables = (m.interactables ?? []).map((n) => (n.id === sel.id ? { ...n, tx, ty } : n));
      if (sel.kind === "spawn") m.spawns = (m.spawns ?? []).map((n) => (n.id === sel.id ? { ...n, x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE } : n));
      bump();
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const m = mapRef.current;
    if (d.kind === "paint") endStroke();
    if (d.kind === "rect" && d.a && d.b) {
      const x0 = Math.min(d.a.tx, d.b.tx), x1 = Math.max(d.a.tx, d.b.tx), y0 = Math.min(d.a.ty, d.b.ty), y1 = Math.max(d.a.ty, d.b.ty);
      if (tool === "zone") {
        const id = `zone-${uid()}`;
        edit((mm) => { mm.zones = [...(mm.zones ?? []), { id, tx: x0, ty: y0, tw: x1 - x0 + 1, th: y1 - y0 + 1, levelMin: opts.zone.levelMin, levelMax: opts.zone.levelMax, species: [...opts.zone.species], count: opts.zone.count, respawn: opts.zone.respawn }]; });
        setSel({ kind: "zone", id });
        setTab("place");
      } else {
        stroke.current = { tiles: new Map() };
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) setTileAt(y * m.w + x, paintTile(m.tiles[y * m.w + x]!, "paint"));
        endStroke();
        setStatus(`Filled ${(x1 - x0 + 1) * (y1 - y0 + 1)} tiles.`);
      }
    }
    if (d.kind === "move") bump();
  };

  const onWheel = (e: React.WheelEvent) => {
    const before = toTile(e.clientX, e.clientY);
    const next = Math.max(6, Math.min(56, zoom + (e.deltaY < 0 ? 2 : -2)));
    if (next === zoom) return;
    const r = canvas.current!.getBoundingClientRect();
    cam.current.x = before.tx + 0.5 - (e.clientX - r.left) / next;
    cam.current.y = before.ty + 0.5 - (e.clientY - r.top) / next;
    setZoom(next);
  };

  // ---- keyboard -----------------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); }
      else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); doRedo(); }
      else if (e.key === "Escape") { setPick(null); setSel(null); }
      else if (e.key === "Delete" && sel) removeEntity(sel);
      else if (["ArrowLeft", "a"].includes(e.key) && !mod) { cam.current.x -= 3; clampCam(); bump(); }
      else if (["ArrowRight", "d"].includes(e.key)) { cam.current.x += 3; clampCam(); bump(); }
      else if (["ArrowUp", "w"].includes(e.key)) { cam.current.y -= 3; clampCam(); bump(); }
      else if (["ArrowDown", "s"].includes(e.key) && !mod) { cam.current.y += 3; clampCam(); bump(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---- drawing ------------------------------------------------------------------------------
  useEffect(() => {
    const c = canvas.current, host = box.current;
    if (!c || !host) return;
    const fit = () => { const w = Math.max(200, host.clientWidth), h = Math.max(200, host.clientHeight); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; bump(); } };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    const poll = setInterval(() => { if (imgRev.current !== tileImageRevision()) bump(); }, 500);
    return () => { ro.disconnect(); clearInterval(poll); };
  }, [bump]);

  const rectPreview = drag.current?.kind === "rect" ? drag.current : null;
  useEffect(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const c = canvas.current;
      const ctx = c?.getContext("2d");
      if (!c || !ctx) return;
      imgRev.current = tileImageRevision();
      const m = mapRef.current;
      const z = zoom;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#0e0a09";
      ctx.fillRect(0, 0, c.width, c.height);
      const x0 = Math.max(0, Math.floor(cam.current.x)), y0 = Math.max(0, Math.floor(cam.current.y));
      const x1 = Math.min(m.w, Math.ceil(cam.current.x + c.width / z)), y1 = Math.min(m.h, Math.ceil(cam.current.y + c.height / z));
      const px = (tx: number) => Math.round((tx - cam.current.x) * z);
      const py = (ty: number) => Math.round((ty - cam.current.y) * z);
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const t = m.tiles[y * m.w + x]!;
          const sx = px(x), sy = py(y);
          ctx.fillStyle = FLOOR_COLOR[t.floor] ?? "#3d5a3a";
          ctx.fillRect(sx, sy, z + 1, z + 1);
          if (t.sprite) drawAtlasTile(ctx, t.sprite, sx, sy, z + 1);
          if (t.layers) for (const l of t.layers) drawAtlasTile(ctx, l, sx, sy, z + 1);
          if (collision && t.block) {
            ctx.fillStyle = "rgba(196,71,58,0.28)";
            ctx.fillRect(sx, sy, z + 1, z + 1);
            if (z >= 10) { ctx.strokeStyle = "rgba(196,71,58,0.8)"; ctx.strokeRect(sx + 0.5, sy + 0.5, z - 1, z - 1); }
          }
          if (t.portal) { ctx.strokeStyle = "#c9a6e8"; ctx.lineWidth = 2; ctx.strokeRect(sx + 2, sy + 2, z - 4, z - 4); ctx.lineWidth = 1; if (z >= 14) { ctx.fillStyle = "#c9a6e8"; ctx.font = `bold ${Math.floor(z * 0.5)}px monospace`; ctx.fillText("P", sx + z * 0.3, sy + z * 0.7); } }
        }
      if (grid && z >= 12) {
        ctx.strokeStyle = "rgba(240,226,200,0.12)";
        ctx.beginPath();
        for (let x = x0; x <= x1; x++) { ctx.moveTo(px(x) + 0.5, py(y0)); ctx.lineTo(px(x) + 0.5, py(y1)); }
        for (let y = y0; y <= y1; y++) { ctx.moveTo(px(x0), py(y) + 0.5); ctx.lineTo(px(x1), py(y) + 0.5); }
        ctx.stroke();
      }
      const label = (text: string, tx: number, ty: number, color: string, fill = true) => {
        const sx = px(tx), sy = py(ty);
        if (sx < -z || sy < -z || sx > c.width || sy > c.height) return;
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(sx + 2, sy + 2, z - 4, z - 4); ctx.lineWidth = 1;
        if (fill) { ctx.fillStyle = color + "55"; ctx.fillRect(sx + 2, sy + 2, z - 4, z - 4); }
        if (z >= 12) { ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.max(8, Math.floor(z * 0.42))}px monospace`; ctx.fillText(text, sx + 4, sy + z * 0.65); }
      };
      for (const zn of m.zones ?? []) {
        ctx.fillStyle = "rgba(196,71,58,0.16)"; ctx.fillRect(px(zn.tx), py(zn.ty), zn.tw * z, zn.th * z);
        ctx.strokeStyle = sel?.kind === "zone" && sel.id === zn.id ? "#ffe08a" : "#c4473a"; ctx.setLineDash([6, 4]); ctx.lineWidth = 2; ctx.strokeRect(px(zn.tx), py(zn.ty), zn.tw * z, zn.th * z); ctx.setLineDash([]); ctx.lineWidth = 1;
        if (z >= 10) { ctx.fillStyle = "#ffb4a8"; ctx.font = "10px monospace"; ctx.fillText(`ZONE L${zn.levelMin}-${zn.levelMax} x${zn.count}`, px(zn.tx) + 3, py(zn.ty) + 11); }
      }
      for (const i of m.interactables ?? []) label(i.kind === "node" ? ({ ore: "O", tree: "T", shroom: "M", fish: "F" } as const)[i.node] : i.kind === "bounty" ? "B" : i.kind === "arena" ? "A" : i.kind === "shrine" ? "S" : i.kind === "hearth" ? "H" : "D", i.tx, i.ty, i.kind === "node" ? "#8fd06a" : "#ffe08a");
      for (const s of m.spawns ?? []) if (s.kind === "mob") label(s.boss ? "BOSS" : "E", Math.floor(s.x / TILE), Math.floor(s.y / TILE), s.boss ? "#ff5a4a" : "#e07a5a");
      for (const n of m.npcs ?? []) label("N", n.tx, n.ty, "#c9a6e8");
      if (m.spawn) label("START", m.spawn.tx, m.spawn.ty, "#8fd06a");
      const selTile = sel?.kind === "npc" ? m.npcs?.find((n) => n.id === sel.id) : sel?.kind === "it" ? m.interactables?.find((n) => n.id === sel.id) : null;
      const selSp = sel?.kind === "spawn" ? m.spawns?.find((n) => n.id === sel.id) : null;
      const st = selTile ? { tx: selTile.tx, ty: selTile.ty } : selSp ? { tx: Math.floor(selSp.x / TILE), ty: Math.floor(selSp.y / TILE) } : null;
      if (st) { ctx.strokeStyle = "#ffe08a"; ctx.lineWidth = 3; ctx.strokeRect(px(st.tx) - 1, py(st.ty) - 1, z + 2, z + 2); ctx.lineWidth = 1; }
      const rd = drag.current?.kind === "rect" ? drag.current : null;
      if (rd?.a && rd.b) {
        const a = Math.min(rd.a.tx, rd.b.tx), b = Math.min(rd.a.ty, rd.b.ty), w = Math.abs(rd.a.tx - rd.b.tx) + 1, h = Math.abs(rd.a.ty - rd.b.ty) + 1;
        ctx.strokeStyle = "#ffe08a"; ctx.lineWidth = 2; ctx.strokeRect(px(a), py(b), w * z, h * z); ctx.lineWidth = 1;
        ctx.fillStyle = "#ffe08a"; ctx.font = "11px monospace"; ctx.fillText(`${w}×${h}`, px(a) + 3, py(b) - 4);
      }
      if (hover && !drag.current) {
        const n = ["paint", "overlay", "peel", "erase", "wall", "walk", "portal", "unportal"].includes(tool) ? size : 1;
        const r = Math.floor((n - 1) / 2);
        ctx.strokeStyle = pick ? "#8fd06a" : "#fff"; ctx.lineWidth = 2;
        ctx.strokeRect(px(hover.tx - r), py(hover.ty - r), n * z, n * z); ctx.lineWidth = 1;
      }
    });
  });

  // ---- file actions -------------------------------------------------------------------------
  const knownMaps = useMemo(() => new Set(saved.map((s) => s.id)), [saved]);
  const savedIds = useMemo(() => saved.map((s) => s.id).filter((id) => id !== map.id), [saved, map.id]);

  const doSave = () => {
    const m = mapRef.current;
    const err = saveDesignerMap(m);
    if (err) return setStatus(err);
    setSaved(savedMaps());
    setDirty(false);
    const warn = validateMap(m, new Set(ITEMS.map((i) => i.id)), knownMaps).filter((i) => i.level === "error").length;
    setStatus(warn ? `Saved, but ${warn} problem${warn > 1 ? "s" : ""} will break quests. Open Check map.` : `Saved "${m.name}". Start the game and enter it from the Map panel.`);
  };

  const check = () => {
    const found = validateMap(mapRef.current, new Set(ITEMS.map((i) => i.id)), knownMaps);
    setIssues(found);
    setTab("map");
    setStatus(found.some((f) => f.level === "error") ? "Problems found." : found.length ? "No errors, a few things to look at." : "All clear.");
  };

  const load = (m: MapFile) => {
    undo.current = []; redo.current = [];
    setMap(m); setSel(null); setQuestId(null); setIssues(null); setDirty(false);
    setForm({ name: m.name, id: m.id, w: m.w, h: m.h, kind: m.kind ?? "world", floor: 0 });
    cam.current = { x: Math.max(0, (m.spawn?.tx ?? 0) - 10), y: Math.max(0, (m.spawn?.ty ?? 0) - 6) };
    bump();
  };

  const createNew = () => {
    if (dirty && !window.confirm("Start a new map? Unsaved changes to the current one will be lost.")) return;
    const w = Math.max(8, Math.min(512, Math.floor(form.w) || 64)), h = Math.max(8, Math.min(512, Math.floor(form.h) || 48));
    const m = emptyMap(slug(form.id || form.name), form.name.trim() || "New Map", w, h, form.floor, 3);
    m.kind = form.kind;
    if (form.kind === "dungeon" || form.kind === "bossroom") for (const t of m.tiles) if (t.floor === 0 && !t.block) t.floor = 8;
    load(m);
    setStatus(`New ${w}×${h} map. Paint terrain, then add NPCs, enemies and quests.`);
  };

  const importJson = (text: string) => {
    try {
      const m = parseMapJson(JSON.parse(text));
      if (dirty && !window.confirm("Open this file? Unsaved changes to the current map will be lost.")) return;
      load(m);
      setStatus(`Opened "${m.name}".`);
      setImportText("");
    } catch (err) {
      setStatus(err instanceof Error ? `Could not open: ${err.message}` : "Could not read that file.");
    }
  };

  const gen = (kind: "fill" | "border" | "scatter") => {
    const m = mapRef.current;
    stroke.current = { tiles: new Map() };
    for (let y = 0; y < m.h; y++)
      for (let x = 0; x < m.w; x++) {
        const i = y * m.w + x;
        const edge = x === 0 || y === 0 || x === m.w - 1 || y === m.h - 1;
        if (kind === "fill") setTileAt(i, paintTile(m.tiles[i]!, "paint"));
        else if (kind === "border" && edge) setTileAt(i, { ...m.tiles[i]!, block: 1, floor: 1, sprite: undefined, layers: undefined });
        else if (kind === "scatter" && !edge && Math.random() < 0.06 && brush.mode === "sprite" && !m.tiles[i]!.block) setTileAt(i, paintTile(m.tiles[i]!, "overlay"));
      }
    endStroke();
    setStatus(kind === "fill" ? "Filled the whole map." : kind === "border" ? "Walled the edge." : "Scattered the selected tile as decoration.");
  };

  const spawnCount = (map.spawns ?? []).filter((s) => s.kind === "mob").length;
  const isEntityTool = ENTITY_TOOLS.includes(tool);
  const optionTool = ["enemy", "boss", "zone", "node", "shrine", "dungeon", "portal"].includes(tool);
  const brushTool = ["paint", "rect", "fill", "overlay", "portal", "unportal", "erase", "peel", "wall", "walk"].includes(tool);
  const tabBtn = (id: Tab, label: string) => (
    <button key={id} type="button" role="tab" aria-selected={tab === id} className={`px-btn !min-h-9 !py-0 ${tab === id ? "px-btn-kyo" : ""}`} onClick={() => setTab(id)}>{label}</button>
  );

  return (
    <section className="designer-screen" data-testid="map-builder">
      <header className="designer-header">
        <div>
          <p className="font-display text-xs text-blood">MAP BUILDER</p>
          <h1 className="font-display text-lg">{map.name}{dirty ? " *" : ""} <span className="text-dim text-xs">{map.w}×{map.h} · {map.kind}</span></h1>
        </div>
        <div className="flex flex-wrap gap-1">
          <button type="button" className="px-btn" onClick={doUndo} disabled={!undo.current.length} aria-label="Undo">Undo</button>
          <button type="button" className="px-btn" onClick={doRedo} disabled={!redo.current.length} aria-label="Redo">Redo</button>
          <button type="button" className="px-btn px-btn-kyo" data-testid="save-map-btn" onClick={doSave}>Save</button>
          <button type="button" className="px-btn" onClick={check}>Check map</button>
          <button type="button" className="px-btn" onClick={() => { if (!dirty || window.confirm("Leave without saving?")) onBack(); }}>Back</button>
        </div>
      </header>
      <p className="designer-status !py-1" role="status" data-testid="builder-status">{pick ? "Click a tile on the map to choose it. Esc cancels." : status}</p>

      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {TOOL_GROUPS.map((g) => (
          <div key={g.label} className="flex flex-wrap items-center gap-1">
            <span className="text-dim">{g.label}</span>
            {g.tools.map(([id, label, help]) => (
              <button key={id} type="button" title={help} aria-pressed={tool === id} className={`px-btn !min-h-8 !px-2 !py-0 ${tool === id ? "px-btn-kyo" : ""}`} onClick={() => { setTool(id); if (id === "zone" || id === "enemy" || id === "boss" || id === "portal") setTab("place"); if (["paint", "rect", "fill", "overlay"].includes(id)) setTab("tiles"); }}>{label}</button>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-3 text-dim">
        {brushTool && tool !== "fill" && tool !== "rect" && (
          <label className="flex items-center gap-1">Brush
            <select className="border-2 border-bone bg-ink !min-h-8 px-1" value={size} onChange={(e) => setSize(Number(e.target.value))}>
              {[1, 2, 3, 5, 7].map((n) => <option key={n} value={n}>{n}×{n}</option>)}
            </select>
          </label>
        )}
        <label className="flex items-center gap-1"><input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} /> Grid</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={collision} onChange={(e) => setCollision(e.target.checked)} /> Show solid tiles</label>
        <button type="button" className="px-btn !min-h-7 !py-0" onClick={() => setZoom(Math.max(6, zoom - 4))} aria-label="Zoom out">−</button>
        <span>{Math.round((zoom / 24) * 100)}%</span>
        <button type="button" className="px-btn !min-h-7 !py-0" onClick={() => setZoom(Math.min(56, zoom + 4))} aria-label="Zoom in">+</button>
        {hover && <span>tile {hover.tx}, {hover.ty}</span>}
        <span>{spawnCount} enemies · {(map.zones ?? []).length} zones · {(map.npcs ?? []).length} NPCs · {(map.quests ?? []).length} quests</span>
      </div>

      <div className="mt-2 grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div ref={box} className="relative border-2 border-bone" style={{ height: "min(68vh, 640px)", minHeight: 320 }}>
          <canvas
            ref={canvas}
            data-testid="map-canvas"
            className="block h-full w-full"
            style={{ cursor: pick ? "crosshair" : tool === "pan" ? "grab" : "crosshair", touchAction: "none" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={() => setHover(null)}
            onWheel={onWheel}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>

        <div className="grid content-start gap-2">
          <div role="tablist" className="flex flex-wrap gap-1">
            {tabBtn("tiles", "Tiles")}
            {tabBtn("place", "Places")}
            {tabBtn("quests", "Quests")}
            {tabBtn("map", "Map")}
            {tabBtn("files", "Files")}
          </div>
          <div className="border-2 border-bone p-2" style={{ maxHeight: "min(64vh, 620px)", overflow: "auto" }}>
            {tab === "tiles" && <TilePalette brush={brush} onBrush={(b) => { setBrush(b); if (!["paint", "rect", "fill", "overlay"].includes(tool)) setTool("paint"); }} />}
            {tab === "place" && (
              <div className="grid gap-2">
                {optionTool && <PlaceSettings tool={tool} opts={opts} set={setOpts} savedIds={savedIds} />}
                {isEntityTool && !optionTool && <p className="text-dim">Click a walkable tile to place it.</p>}
                <Inspector
                  map={map}
                  sel={sel}
                  onSelect={setSel}
                  onPatchNpc={(id, p) => patchList("npcs", id, p)}
                  onPatchIt={(id, p) => patchList("interactables", id, p)}
                  onPatchSpawn={(id, p) => patchList("spawns", id, p)}
                  onPatchZone={(id, p) => patchList("zones", id, p)}
                  onDelete={removeEntity}
                  onJump={jump}
                  openQuest={(id) => { setQuestId(id); setTab("quests"); }}
                  savedIds={savedIds}
                />
              </div>
            )}
            {tab === "quests" && <QuestEditor map={map} selected={questId} onSelect={setQuestId} onChange={setQuests} onPickTile={(cb) => { setPick(() => cb); setStatus("Click the map to choose the tile."); }} />}
            {tab === "map" && (
              <div className="grid gap-2">
                <p className="font-display text-xs text-kyo">ABOUT THIS MAP</p>
                <label className="grid text-dim">Name<input className="border-2 border-bone bg-ink px-1" value={map.name} maxLength={100} onChange={(e) => { setMap({ ...map, name: e.target.value }); setDirty(true); }} /></label>
                <label className="grid text-dim">File ID (letters, numbers, dashes)<input className="border-2 border-bone bg-ink px-1" value={map.id} maxLength={80} onChange={(e) => { setMap({ ...map, id: slug(e.target.value) }); setDirty(true); }} /></label>
                <label className="grid text-dim">Kind
                  <select className="border-2 border-bone bg-ink px-1" value={map.kind ?? "world"} onChange={(e) => { setMap({ ...map, kind: e.target.value as MapFile["kind"] }); setDirty(true); }}>
                    <option value="world">World / town</option><option value="dungeon">Dungeon</option><option value="bossroom">Boss room</option>
                  </select>
                </label>
                <label className="grid text-dim">Opening story (shown the first time a hunter arrives; a blank line starts a new page)
                  <textarea className="min-h-24 border-2 border-bone bg-ink px-1" maxLength={4000} value={map.intro ?? ""} onChange={(e) => { const m = mapRef.current; if (Date.now() - lastTyped.current > 1200) pushUndo({ meta: metaOf(m) }); lastTyped.current = Date.now(); m.intro = e.target.value; bump(); }} />
                </label>
                <label className="grid text-dim">Notes for yourself<textarea className="min-h-12 border-2 border-bone bg-ink px-1" maxLength={2000} value={map.notes ?? ""} onChange={(e) => { setMap({ ...map, notes: e.target.value }); setDirty(true); }} /></label>
                <p className="font-display text-xs text-kyo">SIZE</p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="grid text-dim">Width<input className="w-20 border-2 border-bone bg-ink px-1" type="number" min={4} max={512} value={form.w} onChange={(e) => setForm({ ...form, w: Number(e.target.value) })} /></label>
                  <label className="grid text-dim">Height<input className="w-20 border-2 border-bone bg-ink px-1" type="number" min={4} max={512} value={form.h} onChange={(e) => setForm({ ...form, h: Number(e.target.value) })} /></label>
                  <button type="button" className="px-btn" onClick={() => { const m = mapRef.current; pushUndo({ full: m }); setMap(resizeMap(m, form.w, form.h, brush.mode === "floor" ? brush.floor : 0)); setStatus("Resized. New ground uses the current plain ground colour."); bump(); }}>Resize</button>
                </div>
                <p className="text-dim">Growing adds ground on the right and bottom. Shrinking removes what falls off the edge. Up to 512×512.</p>
                <p className="font-display text-xs text-kyo">QUICK TERRAIN</p>
                <div className="flex flex-wrap gap-1">
                  <button type="button" className="px-btn" onClick={() => gen("fill")}>Fill all with brush</button>
                  <button type="button" className="px-btn" onClick={() => gen("border")}>Wall the edge</button>
                  <button type="button" className="px-btn" onClick={() => gen("scatter")} disabled={brush.mode !== "sprite"}>Scatter brush tile</button>
                </div>
                <button type="button" className="px-btn px-btn-kyo" onClick={check}>Check map for problems</button>
                {issues && (
                  <div className="grid gap-1" data-testid="map-issues">
                    {issues.length === 0 && <p className="text-kyo">No problems found.</p>}
                    {issues.map((i, n) => <p key={n} className={i.level === "error" ? "text-blood" : "text-dim"}>{i.level === "error" ? "✖" : "•"} {i.text}</p>)}
                  </div>
                )}
              </div>
            )}
            {tab === "files" && (
              <div className="grid gap-2">
                <p className="font-display text-xs text-kyo">SAVED ON THIS DEVICE</p>
                {saved.length === 0 && <p className="text-dim">Nothing saved yet. Press Save.</p>}
                {saved.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-1 border border-bone/40 p-1">
                    <span className="min-w-0 flex-1 truncate">{s.name} <span className="text-dim">{s.w}×{s.h}</span></span>
                    <button type="button" className="px-btn !min-h-7 !py-0" onClick={() => { if (!dirty || window.confirm("Open it? Unsaved changes to the current map will be lost.")) { load(s); setStatus(`Opened "${s.name}".`); } }}>Open</button>
                    <button type="button" className="px-btn !min-h-7 !py-0" onClick={() => downloadMapFile(s)}>Export</button>
                    <button type="button" className="px-btn !min-h-7 !py-0" onClick={() => { if (window.confirm(`Delete "${s.name}" from this device?`)) { deleteDesignerMap(s.id); setSaved(savedMaps()); } }}>Delete</button>
                  </div>
                ))}
                <button type="button" className="px-btn" onClick={() => downloadMapFile(parseMapJson(mapRef.current))}>Export this map (.json)</button>
                <p className="font-display text-xs text-kyo">OPEN A FILE</p>
                <input type="file" accept=".json,application/json" className="text-dim" onChange={async (e) => { const f = e.target.files?.[0]; if (f) importJson(await f.text()); e.target.value = ""; }} />
                <textarea className="min-h-16 border-2 border-bone bg-ink px-1" placeholder="…or paste map JSON here" value={importText} onChange={(e) => setImportText(e.target.value)} />
                <button type="button" className="px-btn" disabled={!importText.trim()} onClick={() => importJson(importText)}>Open pasted JSON</button>
                <p className="font-display text-xs text-kyo">NEW MAP</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid text-dim">Name<input className="border-2 border-bone bg-ink px-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, id: slug(e.target.value) })} /></label>
                  <label className="grid text-dim">File ID<input className="border-2 border-bone bg-ink px-1" value={form.id} onChange={(e) => setForm({ ...form, id: slug(e.target.value) })} /></label>
                  <label className="grid text-dim">Width<input className="border-2 border-bone bg-ink px-1" type="number" min={8} max={512} value={form.w} onChange={(e) => setForm({ ...form, w: Number(e.target.value) })} /></label>
                  <label className="grid text-dim">Height<input className="border-2 border-bone bg-ink px-1" type="number" min={8} max={512} value={form.h} onChange={(e) => setForm({ ...form, h: Number(e.target.value) })} /></label>
                  <label className="grid text-dim">Kind
                    <select className="border-2 border-bone bg-ink px-1" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as typeof form.kind })}>
                      <option value="world">World / town</option><option value="dungeon">Dungeon</option><option value="bossroom">Boss room</option>
                    </select>
                  </label>
                  <label className="grid text-dim">Ground
                    <select className="border-2 border-bone bg-ink px-1" value={form.floor} onChange={(e) => setForm({ ...form, floor: Number(e.target.value) })}>
                      {["Grass", "Wall", "Water", "Stone", "Dirt", "Snow", "Bog", "Void", "Bone", "Ash", "Sand", "Lava"].map((n, i) => i !== 1 && <option key={n} value={i}>{n}</option>)}
                    </select>
                  </label>
                </div>
                <button type="button" className="px-btn px-btn-kyo" data-testid="new-map-btn" onClick={createNew}>Create map</button>
              </div>
            )}
          </div>
          <p className="text-dim">To play it: Save, go back to the main menu, start a game, open the Map panel and enter it. Quests and story only run on saved maps.</p>
        </div>
      </div>
    </section>
  );
}
