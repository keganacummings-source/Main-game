import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ITEMS, TILE } from "@/game/content";
import {
  MAX_LAYERS,
  FLOOR_COLOR,
  deleteDesignerMap,
  downloadMapFile,
  emptyMap,
  initDesignerStore,
  loadDraft,
  onDesignerStore,
  parseMapJson,
  saveDesignerMap,
  saveDraft,
  savedMaps,
  type MapFile,
  type MapQuest,
  type MapTile,
} from "@/game/map-format";
import { blankTile, floodIndices, resizeMap, validateMap, type Issue } from "@/game/map-tools";
import { drawAtlasTile, findAtlasTile, loadTileCatalog, tileImage, tileImageRevision } from "@/game/tile-atlas";
import { REGION_KINDS, type MapRegion } from "@/game/map-format";
import { generateWorld, mainWorldOptions, type WorldGenOptions } from "@/game/map-gen";
import { nextWorldChoice, setNextWorldChoice } from "@/game/life-world";
import { questIssues, repairQuests } from "@/game/quest-check";
import { PLAYABLE_WORLDS, loadPlayableWorlds, playableWorlds } from "@/game/builtin-maps";
import { DEFAULT_OPTS, Inspector, PlaceSettings, type PlaceOpts, type Sel } from "@/components/map-builder-entities";
import { QuestEditor } from "@/components/map-builder-quests";
import { TilePalette, type Brush } from "@/components/map-builder-tiles";
import type { Spawn } from "@/game/world";
import { ConfirmButton } from "./ui-kit";

type Tool =
  | "pan" | "select" | "remove"
  | "paint" | "overlay" | "peel" | "rect" | "line" | "fill" | "scatter" | "pick" | "erase" | "wall" | "walk"
  | "copy" | "stamp"
  | "portal" | "unportal"
  | "start" | "enemy" | "boss" | "zone" | "region" | "node" | "npc" | "bounty" | "arena" | "shrine" | "hearth" | "dungeon";
type Tab = "map" | "tiles" | "place" | "areas" | "quests" | "files";

const TOOL_GROUPS: { label: string; tools: [Tool, string, string][] }[] = [
  { label: "View", tools: [["pan", "Pan", "Drag to move the view. Right-drag or middle-drag does this with any tool."], ["select", "Select", "Click something to edit it. Drag to move it."], ["remove", "Remove", "Click a placed thing to delete it."]] },
  { label: "Terrain", tools: [["paint", "Paint", "Paint the selected tile or ground."], ["rect", "Rectangle", "Drag a rectangle and fill it."], ["line", "Line", "Drag a straight line with the brush: roads, rivers, walls."], ["fill", "Fill", "Fill a connected area."], ["overlay", "Overlay", "Add a decoration layer on top (up to 4)."], ["scatter", "Scatter", "Drag a rectangle to sprinkle the brush tile as decoration (trees, rocks, flowers)."], ["peel", "Peel", "Remove the top layer."], ["pick", "Pick", "Copy a tile's look into the brush."], ["erase", "Erase", "Reset to bare ground."], ["wall", "Block", "Make tiles solid."], ["walk", "Open", "Make tiles walkable."]] },
  { label: "Edit", tools: [["copy", "Copy", "Drag a rectangle to copy its tiles (a house, a town block…)."], ["stamp", "Stamp", "Click to paste the copied tiles; the click is the top-left corner."]] },
  { label: "Links", tools: [["portal", "Portal", "Make tiles portals to another map."], ["unportal", "No portal", "Remove portals."]] },
  { label: "Place", tools: [["start", "Start", "Where hunters arrive."], ["enemy", "Enemy", "A single enemy spawn."], ["boss", "Boss", "A boss spawn."], ["zone", "Spawn zone", "A rectangle that keeps spawning enemies."], ["region", "Area", "Drag a rectangle to name an area: a town, forest, continent… Announced in game."], ["node", "Node", "Tree, ore, mushrooms or fishing spot."], ["npc", "NPC", "A person who talks and gives quests."], ["bounty", "Bounty board", "Bounty hunts."], ["arena", "Arena", "A fight against a saint."], ["shrine", "Shrine", "An elemental shrine fight."], ["hearth", "Hearth", "Heals when used."], ["dungeon", "Door", "A door to another map."]] },
];

const ENTITY_TOOLS: Tool[] = ["node", "npc", "bounty", "arena", "shrine", "hearth", "dungeon"];
const HISTORY = 60;

type Meta = Pick<MapFile, "spawns" | "zones" | "interactables" | "npcs" | "quests" | "spawn" | "intro" | "regions">;
type Entry = { tiles?: Map<number, MapTile>; meta?: Meta; full?: MapFile };

const metaOf = (m: MapFile): Meta => ({ spawns: m.spawns, zones: m.zones, interactables: m.interactables, npcs: m.npcs, quests: m.quests, spawn: m.spawn, intro: m.intro, regions: m.regions });
const REGION_COLOR: Record<MapRegion["kind"], string> = { region: "#f0e2c8", city: "#e6c15a", resource: "#8fd06a", landmark: "#c9a6e8", dungeon: "#ff7a5a", water: "#7ec8ea" };
/** Tiles that differ only by their number are variants of one look (grass_0, grass_1…). */
const familyOf = (path: string) => path.replace(/(_?\d+)?(_old|_new)?\.png$/, "");
type Clip = { w: number; h: number; tiles: MapTile[] };
const spriteRgb = new Map<string, readonly [number, number, number] | null>();
/** Average colour of a tile picture, for the zoomed-out view and minimap. Null until it has loaded. */
function spriteColor(path: string): readonly [number, number, number] | null {
  const hit = spriteRgb.get(path);
  if (hit !== undefined) return hit;
  const img = tileImage(path);
  if (!img.complete || img.naturalWidth <= 0) return null;
  let col: readonly [number, number, number] | null = null;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data;
    col = d[3]! < 40 ? null : [d[0]!, d[1]!, d[2]!];
  } catch { col = null; }
  spriteRgb.set(path, col);
  return col;
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "map";
const uid = () => Math.random().toString(36).slice(2, 10);

function starterMap(): MapFile {
  const m = emptyMap("my-world", "My World", 96, 64, 0, 3);
  m.kind = "world";
  m.intro = "";
  return m;
}


export function MapBuilder({ onBack }: { onBack: () => void }) {
  const [map, setMapState] = useState<MapFile>(starterMap);
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
  const [mix, setMix] = useState(true);
  const [density, setDensity] = useState(12);
  const [regionKind, setRegionKind] = useState<MapRegion["kind"]>("city");
  const [showAreas, setShowAreas] = useState(true);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [find, setFind] = useState("");
  const [genForm, setGenForm] = useState({ name: "New World", id: "new-world", w: 300, h: 300, seed: 1234, continents: 4, cities: 3, islands: 8, story: false });
  const [families, setFamilies] = useState<Map<string, string[]> | null>(null);
  const clip = useRef<Clip | null>(null);
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const overview = useRef<{ key: unknown; ver: number; rev: number; canvas: HTMLCanvasElement } | null>(null);
  const tilesVer = useRef(0);
  const lastOverview = useRef(0);
  const mini = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    void loadTileCatalog().then((c) => {
      if (!live || !c) return;
      const f = new Map<string, string[]>();
      for (const cat of c.categories) for (const t of cat.tiles) { const k = familyOf(t.path); f.set(k, [...(f.get(k) ?? []), t.path]); }
      setFamilies(f);
    });
    return () => { live = false; };
  }, []);

  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const cam = useRef({ x: 0, y: 0 });
  const undo = useRef<Entry[]>([]);
  const redo = useRef<Entry[]>([]);
  const stroke = useRef<Entry | null>(null);
  const drag = useRef<{ kind: "pan" | "paint" | "rect" | "line" | "move" | "mini"; sx: number; sy: number; ox: number; oy: number; a?: { tx: number; ty: number }; b?: { tx: number; ty: number } } | null>(null);
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
  const doUndo = () => { const e = undo.current.pop(); if (!e) return; applyEntry(e, redo.current); tilesVer.current++; setDirty(true); setSel(null); bump(); };
  const doRedo = () => { const e = redo.current.pop(); if (!e) return; applyEntry(e, undo.current); tilesVer.current++; setDirty(true); setSel(null); bump(); };
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
      void saveDraft(mapRef.current);
    }, 2500);
    return () => clearTimeout(t);
  });
  // Restore the unsaved draft from last time (IndexedDB; can be a full 512×512 world).
  useEffect(() => {
    let live = true;
    void loadDraft().then((m) => { if (live && m && !dirtyRef.current) { loadRef.current(m); setStatus(`Restored your draft "${m.name}".`); } });
    void initDesignerStore().then(() => { if (live) setSaved(savedMaps()); });
    const off = onDesignerStore((e) => { if (e.error) setStatus(e.error); });
    return () => { live = false; off(); };
  }, []);

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
    // "Mix variants": paint a random sibling of the chosen tile so ground does not look stamped.
    const sibs = mix ? families?.get(familyOf(brush.tile.path)) : undefined;
    const path = sibs && sibs.length > 1 ? sibs[Math.floor(Math.random() * sibs.length)]! : brush.tile.path;
    if (mode === "overlay") {
      const layers = [...(old.layers ?? [])];
      if (layers.length >= MAX_LAYERS || layers[layers.length - 1] === path) return old;
      layers.push(path);
      return { ...old, layers, block: solid ? 1 : old.block };
    }
    const { layers: _l, ...rest } = old;
    return { ...rest, sprite: path, floor: brush.liquid ? 2 : old.floor === 2 || old.floor === 1 ? 0 : old.floor, block: solid };
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
    tilesVer.current++;
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
    if (tool === "rect" || tool === "zone" || tool === "scatter" || tool === "copy" || tool === "region") { drag.current = { kind: "rect", sx: 0, sy: 0, ox: 0, oy: 0, a: { tx, ty }, b: { tx, ty } }; bump(); return; }
    if (tool === "line") { drag.current = { kind: "line", sx: 0, sy: 0, ox: 0, oy: 0, a: { tx, ty }, b: { tx, ty } }; bump(); return; }
    if (tool === "stamp") {
      const c = clip.current;
      if (!c) return setStatus("Copy something first: pick Copy and drag a rectangle.");
      stroke.current = { tiles: new Map() };
      for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
        const X = tx + x, Y = ty + y;
        if (X < 0 || Y < 0 || X >= m.w || Y >= m.h) continue;
        setTileAt(Y * m.w + X, { ...c.tiles[y * c.w + x]! });
      }
      endStroke();
      return setStatus(`Stamped ${c.w}×${c.h} tiles.`);
    }
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
    if (d.kind === "rect" || d.kind === "line") { d.b = { tx: Math.max(0, Math.min(m.w - 1, tx)), ty: Math.max(0, Math.min(m.h - 1, ty)) }; bump(); return; }
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
    if (d.kind === "line" && d.a && d.b) {
      // Bresenham with the brush size: roads, rivers and walls in one drag.
      stroke.current = { tiles: new Map() };
      let x = d.a.tx, y = d.a.ty;
      const dx = Math.abs(d.b.tx - x), dy = -Math.abs(d.b.ty - y), sx = x < d.b.tx ? 1 : -1, sy = y < d.b.ty ? 1 : -1;
      let err = dx + dy, n = 0;
      for (;;) {
        applyTerrain(x, y); n++;
        if (x === d.b.tx && y === d.b.ty) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
      }
      endStroke();
      setStatus(`Drew a line of ${n} tiles.`);
    }
    if (d.kind === "rect" && d.a && d.b) {
      const x0 = Math.min(d.a.tx, d.b.tx), x1 = Math.max(d.a.tx, d.b.tx), y0 = Math.min(d.a.ty, d.b.ty), y1 = Math.max(d.a.ty, d.b.ty);
      if (tool === "copy") {
        const w = x1 - x0 + 1, h = y1 - y0 + 1;
        clip.current = { w, h, tiles: Array.from({ length: w * h }, (_, i) => ({ ...m.tiles[(y0 + Math.floor(i / w)) * m.w + x0 + (i % w)]! })) };
        setTool("stamp");
        setStatus(`Copied ${w}×${h} tiles. Click to stamp them (top-left corner).`);
        return;
      }
      if (tool === "scatter") {
        if (brush.mode !== "sprite") { setStatus("Pick a tile from the tile pack to scatter."); return; }
        stroke.current = { tiles: new Map() };
        let n = 0;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const t = m.tiles[y * m.w + x]!;
          if (t.block || t.floor === 2 || Math.random() * 100 >= density) continue;
          setTileAt(y * m.w + x, paintTile(t, "overlay")); n++;
        }
        endStroke();
        setStatus(`Scattered ${n} tiles.`);
        return;
      }
      if (tool === "region") {
        const id = `area-${uid()}`;
        edit((mm) => { mm.regions = [...(mm.regions ?? []), { id, name: regionKind === "city" ? "New Town" : regionKind === "resource" ? "New Grove" : regionKind === "region" ? "New Land" : "New Place", kind: regionKind, tx: x0, ty: y0, tw: x1 - x0 + 1, th: y1 - y0 + 1 }]; });
        setRegionId(id);
        setTab("areas");
        setStatus("Area added. Name it on the Areas tab.");
        return;
      }
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
    const next = Math.max(2, Math.min(56, zoom + (e.deltaY < 0 ? (zoom < 6 ? 1 : 2) : zoom <= 6 ? -1 : -2)));
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

  // ---- overview (1 pixel per tile) for zoomed-out view and the minimap --------------------------
  const getOverview = (): HTMLCanvasElement => {
    const m = mapRef.current;
    const o = overview.current;
    const rev = tileImageRevision();
    if (o && o.key === m.tiles && o.ver === tilesVer.current && (o.rev === rev || performance.now() - lastOverview.current < 1500)) return o.canvas;
    lastOverview.current = performance.now();
    const cv = o?.canvas ?? document.createElement("canvas");
    cv.width = m.w; cv.height = m.h;
    const g = cv.getContext("2d")!;
    const img = g.createImageData(m.w, m.h);
    const rgb = (f: number) => { const n = parseInt((FLOOR_COLOR[f] ?? "#3d5a3a").slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const; };
    for (let i = 0; i < m.tiles.length; i++) {
      const t = m.tiles[i]!;
      let [r, gg, b] = (t.sprite && spriteColor(t.sprite)) || rgb(t.floor);
      const top = t.layers?.length ? spriteColor(t.layers[t.layers.length - 1]!) : null;
      if (top) { r = (r + top[0]) >> 1; gg = (gg + top[1]) >> 1; b = (b + top[2]) >> 1; }
      const k = t.block ? 0.55 : 1;
      img.data[i * 4] = r * k; img.data[i * 4 + 1] = gg * k; img.data[i * 4 + 2] = b * k; img.data[i * 4 + 3] = 255;
      if (t.portal) { img.data[i * 4] = 201; img.data[i * 4 + 1] = 166; img.data[i * 4 + 2] = 232; }
    }
    g.putImageData(img, 0, 0);
    overview.current = { key: m.tiles, ver: tilesVer.current, rev, canvas: cv };
    return cv;
  };

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
      const far = z < 6;
      if (far) ctx.drawImage(getOverview(), px(0), py(0), m.w * z, m.h * z);
      if (!far) for (let y = y0; y < y1; y++)
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
      if (showAreas) for (const r of m.regions ?? []) {
        const rx = px(r.tx), ry = py(r.ty), rw = r.tw * z, rh = r.th * z;
        if (rx > c.width || ry > c.height || rx + rw < 0 || ry + rh < 0) continue;
        const col = REGION_COLOR[r.kind] ?? "#f0e2c8";
        const on = regionId === r.id;
        if (on) { ctx.fillStyle = col + "22"; ctx.fillRect(rx, ry, rw, rh); }
        ctx.strokeStyle = on ? "#ffe08a" : col; ctx.globalAlpha = on ? 1 : r.kind === "region" ? 0.45 : 0.8; ctx.setLineDash(r.kind === "region" ? [10, 6] : []); ctx.lineWidth = on ? 3 : 2;
        ctx.strokeRect(rx + 0.5, ry + 0.5, rw, rh); ctx.setLineDash([]); ctx.lineWidth = 1; ctx.globalAlpha = 1;
        const big = r.kind === "region";
        if (rw > 40 && (z >= 4 || big || r.kind === "city")) {
          ctx.font = `bold ${big ? 14 : 11}px monospace`;
          const tw = ctx.measureText(r.name).width;
          const lx = Math.max(rx + 4, Math.min(rx + rw - tw - 4, 4)), ly = Math.max(ry + 14, 16);
          if (ly < ry + rh) { ctx.fillStyle = "rgba(14,10,9,0.75)"; ctx.fillRect(lx - 2, ly - 11, tw + 4, 14); ctx.fillStyle = col; ctx.fillText(r.name, lx, ly); }
        }
      }
      const label = (text: string, tx: number, ty: number, color: string, fill = true) => {
        const sx = px(tx), sy = py(ty);
        if (sx < -z || sy < -z || sx > c.width || sy > c.height) return;
        if (far) { ctx.fillStyle = color; ctx.fillRect(sx, sy, Math.max(2, z), Math.max(2, z)); return; }
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
      const ln = drag.current?.kind === "line" ? drag.current : null;
      if (ln?.a && ln.b) {
        ctx.strokeStyle = "#ffe08a"; ctx.lineWidth = Math.max(2, z * size * 0.6); ctx.globalAlpha = 0.55; ctx.beginPath();
        ctx.moveTo(px(ln.a.tx) + z / 2, py(ln.a.ty) + z / 2); ctx.lineTo(px(ln.b.tx) + z / 2, py(ln.b.ty) + z / 2); ctx.stroke();
        ctx.globalAlpha = 1; ctx.lineWidth = 1;
        ctx.fillStyle = "#ffe08a"; ctx.font = "11px monospace"; ctx.fillText(`${Math.max(Math.abs(ln.a.tx - ln.b.tx), Math.abs(ln.a.ty - ln.b.ty)) + 1} tiles`, px(ln.b.tx) + z + 4, py(ln.b.ty));
      }
      if (hover && !drag.current && tool === "stamp" && clip.current) {
        const cl = clip.current;
        ctx.globalAlpha = 0.6;
        if (!far) for (let y = 0; y < cl.h; y++) for (let x = 0; x < cl.w; x++) {
          const t = cl.tiles[y * cl.w + x]!, sx = px(hover.tx + x), sy = py(hover.ty + y);
          ctx.fillStyle = FLOOR_COLOR[t.floor] ?? "#3d5a3a"; ctx.fillRect(sx, sy, z + 1, z + 1);
          if (t.sprite) drawAtlasTile(ctx, t.sprite, sx, sy, z + 1);
          if (t.layers) for (const l of t.layers) drawAtlasTile(ctx, l, sx, sy, z + 1);
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#ffe08a"; ctx.lineWidth = 2; ctx.strokeRect(px(hover.tx), py(hover.ty), cl.w * z, cl.h * z); ctx.lineWidth = 1;
      }
      // minimap
      const mc = mini.current, mg = mc?.getContext("2d");
      if (mc && mg) {
        const sc = Math.min(mc.width / m.w, mc.height / m.h);
        mg.imageSmoothingEnabled = false;
        mg.fillStyle = "#0e0a09"; mg.fillRect(0, 0, mc.width, mc.height);
        mg.drawImage(getOverview(), 0, 0, m.w * sc, m.h * sc);
        if (showAreas) for (const r of m.regions ?? []) if (r.kind === "city" || r.kind === "region") { mg.strokeStyle = REGION_COLOR[r.kind]; mg.globalAlpha = r.kind === "region" ? 0.5 : 0.9; mg.strokeRect(r.tx * sc, r.ty * sc, Math.max(2, r.tw * sc), Math.max(2, r.th * sc)); }
        mg.globalAlpha = 1;
        mg.fillStyle = "#c9a6e8"; for (const n of m.npcs ?? []) mg.fillRect(n.tx * sc - 0.5, n.ty * sc - 0.5, 1.5, 1.5);
        if (m.spawn) { mg.fillStyle = "#8fd06a"; mg.fillRect(m.spawn.tx * sc - 2, m.spawn.ty * sc - 2, 4, 4); }
        mg.strokeStyle = "#ffe08a"; mg.lineWidth = 2;
        mg.strokeRect(cam.current.x * sc, cam.current.y * sc, (c.width / z) * sc, (c.height / z) * sc); mg.lineWidth = 1;
      }
      if (hover && !drag.current && tool !== "stamp") {
        const n = ["paint", "overlay", "peel", "erase", "wall", "walk", "portal", "unportal", "line"].includes(tool) ? size : 1;
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
    for (const q of questIssues(mapRef.current)) if (q.fatal) found.push({ level: "error", text: `Quest "${q.quest}"${q.step >= 0 ? `, step ${q.step + 1}` : ""} cannot be finished: ${q.text}. Use Fix quests on the Quests tab.` });
    setIssues(found);
    setTab("map");
    setStatus(found.some((f) => f.level === "error") ? "Problems found." : found.length ? "No errors, a few things to look at." : "All clear.");
  };

  const load = (m: MapFile) => {
    undo.current = []; redo.current = [];
    setMap(m); setSel(null); setQuestId(null); setIssues(null); setDirty(false);
    setForm({ name: m.name, id: m.id, w: m.w, h: m.h, kind: m.kind ?? "world", floor: 0 });
    setRegionId(null);
    if (m.w * m.h > 40000) setZoom(8);
    cam.current = { x: Math.max(0, (m.spawn?.tx ?? 0) - 30), y: Math.max(0, (m.spawn?.ty ?? 0) - 20) };
    bump();
  };
  const loadRef = useRef(load);
  loadRef.current = load;

  const onMini = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.type === "pointermove" && e.buttons !== 1) return;
    const mc = mini.current, m = mapRef.current;
    if (!mc) return;
    const r = mc.getBoundingClientRect();
    const sc = Math.min(mc.width / m.w, mc.height / m.h);
    jump(((e.clientX - r.left) * (mc.width / r.width)) / sc, ((e.clientY - r.top) * (mc.height / r.height)) / sc);
  };

  const generate = (preset?: WorldGenOptions) => {
    if (dirty && !window.confirm("Generate a new world? Unsaved changes to the current map will be lost.")) return;
    const f = genForm;
    setStatus("Generating… big worlds take a few seconds.");
    setTimeout(() => {
      try {
        const n = Math.max(2, Math.min(8, Math.floor(f.continents) || 4));
        const w = Math.max(96, Math.min(512, Math.floor(f.w) || 300)), h = Math.max(96, Math.min(512, Math.floor(f.h) || 300));
        const m = generateWorld(preset ?? {
          id: slug(f.id || f.name), name: f.name.trim() || "New World", w, h, seed: Math.floor(f.seed) || 1,
          continentCount: n,
          citiesPerContinent: Math.max(1, Math.min(5, Math.floor(f.cities) || 3)), islands: Math.max(0, Math.min(40, Math.floor(f.islands) || 0)), story: f.story,
        });
        load(m);
        setDirty(true);
        const towns = (m.regions ?? []).filter((r) => r.kind === "city").length;
        const nodes = (m.interactables ?? []).filter((i) => i.kind === "node").length;
        setStatus(`Generated "${m.name}": ${(m.regions ?? []).filter((r) => r.kind === "region").length} lands, ${towns} settlements, ${nodes} resource nodes, ${(m.npcs ?? []).length} NPCs, ${(m.quests ?? []).length} quests (all checked finishable). Save it, or Play as main world.`);
      } catch (err) {
        setStatus(err instanceof Error ? `Generation failed: ${err.message}` : "Generation failed.");
      }
    }, 30);
  };

  /** Random everything: size, lands, towns, islands, seed. */
  const surprise = () => {
    const r = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
    const side = r(220, 512);
    setGenForm({ ...genForm, w: side, h: Math.max(160, Math.min(512, side + r(-60, 60))), continents: r(3, 8), cities: r(2, 5), islands: r(0, 24), seed: Math.floor(Math.random() * 999999), story: Math.random() < 0.7 });
  };
  /** A full-size world with a story, ready to replace Veilreach. */
  const newMainWorld = () => {
    const seed = Math.floor(Math.random() * 999999);
    const name = genForm.name.trim() && genForm.name !== "New World" ? genForm.name.trim() : `World ${seed}`;
    setGenForm({ ...genForm, seed, w: 500, h: 500, story: true });
    generate(mainWorldOptions(seed, name, slug(genForm.id && genForm.id !== "new-world" ? genForm.id : name)));
  };
  const fixQuests = () => {
    let report: ReturnType<typeof repairQuests> | null = null;
    edit((m) => { report = repairQuests(m); });
    setDirty(true);
    const r = report as ReturnType<typeof repairQuests> | null;
    if (!r) return;
    setStatus(r.fixed || r.removed.length || r.nodesAdded
      ? `Quests fixed: ${r.fixed} step${r.fixed === 1 ? "" : "s"} repaired, ${r.nodesAdded} resource node${r.nodesAdded === 1 ? "" : "s"} added${r.removed.length ? `, removed ${r.removed.length} impossible quest${r.removed.length === 1 ? "" : "s"} (${r.removed.slice(0, 3).join(", ")}${r.removed.length > 3 ? "…" : ""})` : ""}.${r.notes.length ? ` Still stuck: ${r.notes[0]}` : ""}`
      : "Every quest can already be finished.");
  };
  const [mainChoice, setMainChoice] = useState(() => nextWorldChoice());
  const playAsMain = () => {
    const m = mapRef.current;
    if ((m.kind ?? "world") !== "world" || !m.spawn) return setStatus("Only a world map with a start tile can be the main world.");
    if (m.id === "veilreach") return setStatus("Give this world its own File ID (Map tab) first, so Veilreach stays safe.");
    if (!window.confirm(`Use "${m.name}" for your next new life?\n\nNormally every new character (or new life after a death) wakes in a freshly rolled world. Your next one will wake in this map instead.`)) return;
    repairQuests(m);
    const err = saveDesignerMap(m);
    if (err) return setStatus(err);
    setSaved(savedMaps());
    setDirty(false);
    setNextWorldChoice(m.id);
    setMainChoice(m.id);
    setStatus(`"${m.name}" is queued: your next new character (or next life after a death) wakes in it.`);
  };
  const restoreVeilreach = () => {
    setNextWorldChoice("");
    setMainChoice("");
    setStatus("Your next life rolls a random world again.");
  };

  const openWorldCopy = async (id: string) => {
    if (dirty && !window.confirm("Open a copy? Unsaved changes to the current map will be lost.")) return;
    setStatus("Loading the world…");
    await loadPlayableWorlds();
    const w = playableWorlds().find((x) => x.id === id);
    if (!w) return setStatus("Could not load that world. Check your connection and try again.");
    load(parseMapJson(w));
    setStatus(`Opened an editable copy of "${w.name}". Saving keeps the id "${w.id}", so your version replaces the built-in one on this device. Change the File ID on the Map tab to keep both.`);
  };

  const findHits = useMemo(() => {
    const q = find.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: { label: string; tx: number; ty: number; act: () => void }[] = [];
    for (const r of map.regions ?? []) if (r.name.toLowerCase().includes(q)) out.push({ label: `Area · ${r.name}`, tx: r.tx + r.tw / 2, ty: r.ty + r.th / 2, act: () => { setRegionId(r.id); setTab("areas"); } });
    for (const n of map.npcs ?? []) if (n.name.toLowerCase().includes(q)) out.push({ label: `NPC · ${n.name}`, tx: n.tx, ty: n.ty, act: () => { setSel({ kind: "npc", id: n.id }); setTab("place"); } });
    for (const qq of map.quests ?? []) if (qq.name.toLowerCase().includes(q)) { const g = map.npcs?.find((n) => n.id === qq.giver); out.push({ label: `Quest · ${qq.name}`, tx: g?.tx ?? 0, ty: g?.ty ?? 0, act: () => { setQuestId(qq.id); setTab("quests"); } }); }
    for (const z of map.zones ?? []) if (z.species.some((sp) => sp.toLowerCase().includes(q))) out.push({ label: `Zone · ${z.species.join(", ")} L${z.levelMin}-${z.levelMax}`, tx: z.tx + z.tw / 2, ty: z.ty + z.th / 2, act: () => { setSel({ kind: "zone", id: z.id }); setTab("place"); } });
    return out.slice(0, 40);
  }, [find, map]);

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
  const brushTool = ["paint", "line", "overlay", "portal", "unportal", "erase", "peel", "wall", "walk"].includes(tool);
  const tabBtn = (id: Tab, label: string) => (
    <button key={id} type="button" role="tab" aria-selected={tab === id} className={`px-btn ui-tab ${tab === id ? "px-btn-kyo" : ""}`} onClick={() => setTab(id)}>{label}</button>
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
              <button key={id} type="button" title={help} aria-pressed={tool === id} className={`px-btn ui-btn-sm ${tool === id ? "px-btn-kyo" : ""}`} onClick={() => { setTool(id); if (id === "zone" || id === "enemy" || id === "boss" || id === "portal") setTab("place"); if (["paint", "rect", "fill", "overlay", "line", "scatter"].includes(id)) setTab("tiles"); if (id === "region") setTab("areas"); }}>{label}</button>
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
        {["paint", "rect", "fill", "line", "overlay", "scatter"].includes(tool) && <label className="flex items-center gap-1" title="Paint random variants of the chosen tile (grass_0, grass_1…) so ground does not look stamped."><input type="checkbox" checked={mix} onChange={(e) => setMix(e.target.checked)} /> Mix variants</label>}
        {tool === "scatter" && (
          <label className="flex items-center gap-1">Density
            <input type="range" min={2} max={60} value={density} onChange={(e) => setDensity(Number(e.target.value))} /> {density}%
          </label>
        )}
        {tool === "region" && (
          <label className="flex items-center gap-1">Area kind
            <select className="border-2 border-bone bg-ink !min-h-8 px-1" value={regionKind} onChange={(e) => setRegionKind(e.target.value as MapRegion["kind"])}>
              {REGION_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
        )}
        {tool === "stamp" && <span>{clip.current ? `Stamp ${clip.current.w}×${clip.current.h}` : "Nothing copied yet"}</span>}
        <label className="flex items-center gap-1"><input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} /> Grid</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={showAreas} onChange={(e) => setShowAreas(e.target.checked)} /> Areas</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={collision} onChange={(e) => setCollision(e.target.checked)} /> Show solid tiles</label>
        <button type="button" className="px-btn ui-btn-sm" onClick={() => setZoom(zoom <= 6 ? Math.max(2, zoom - 2) : Math.max(6, zoom - 4))} aria-label="Zoom out">−</button>
        <span>{Math.round((zoom / 24) * 100)}%</span>
        <button type="button" className="px-btn ui-btn-sm" onClick={() => setZoom(Math.min(56, zoom + 4))} aria-label="Zoom in">+</button>
        {hover && <span>tile {hover.tx}, {hover.ty}</span>}
        <span>{spawnCount} enemies · {(map.zones ?? []).length} zones · {(map.npcs ?? []).length} NPCs · {(map.quests ?? []).length} quests · {(map.regions ?? []).length} areas</span>
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
          <div className="flex items-start gap-2">
            <canvas ref={mini} width={150} height={150} data-testid="builder-minimap" title="Overview: click or drag to jump" className="shrink-0 cursor-pointer border-2 border-bone" style={{ width: 150, height: 150, imageRendering: "pixelated", touchAction: "none" }} onPointerDown={onMini} onPointerMove={onMini} />
            <div className="grid min-w-0 flex-1 gap-1">
              <input className="border-2 border-bone bg-ink px-1" placeholder="Find a place, NPC, quest…" value={find} onChange={(e) => setFind(e.target.value)} aria-label="Find on map" />
              <div className="grid max-h-28 gap-0.5 overflow-auto">
                {findHits.map((h, i) => <button key={i} type="button" className="truncate text-left text-dim hover:text-bone" onClick={() => { jump(h.tx, h.ty); h.act(); }}>{h.label}</button>)}
                {find.trim().length >= 2 && findHits.length === 0 && <span className="text-dim">No matches.</span>}
              </div>
            </div>
          </div>
          <div role="tablist" className="flex flex-wrap gap-1">
            {tabBtn("tiles", "Tiles")}
            {tabBtn("place", "Places")}
            {tabBtn("areas", "Areas")}
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
            {tab === "areas" && (
              <AreasPanel
                map={map}
                selected={regionId}
                onSelect={(id) => { setRegionId(id); const r = map.regions?.find((x) => x.id === id); if (r) jump(r.tx + r.tw / 2, r.ty + r.th / 2); }}
                onPatch={(id, p) => edit((mm) => { mm.regions = (mm.regions ?? []).map((r) => (r.id === id ? { ...r, ...p } : r)); })}
                onDelete={(id) => { edit((mm) => { mm.regions = (mm.regions ?? []).filter((r) => r.id !== id); }); setRegionId(null); }}
                kind={regionKind}
                onKind={setRegionKind}
                onDraw={() => setTool("region")}
                show={showAreas}
                onShow={setShowAreas}
              />
            )}
            {tab === "quests" && <QuestEditor map={map} selected={questId} onSelect={setQuestId} onChange={setQuests} onFix={fixQuests} onPickTile={(cb) => { setPick(() => cb); setStatus("Click the map to choose the tile."); }} />}
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
                    <button type="button" className="px-btn ui-btn-sm" onClick={() => { if (!dirty || window.confirm("Open it? Unsaved changes to the current map will be lost.")) { load(parseMapJson(s)); setStatus(`Opened "${s.name}".`); } }}>Open</button>
                    <button type="button" className="px-btn ui-btn-sm" onClick={() => downloadMapFile(s)}>Export</button>
                    <ConfirmButton plain className="ui-btn-sm" label="Delete" confirm="Tap again to delete" onConfirm={() => { deleteDesignerMap(s.id); setSaved(savedMaps()); }} />
                  </div>
                ))}
                <button type="button" className="px-btn" onClick={() => downloadMapFile(parseMapJson(mapRef.current))}>Export this map (.json)</button>
                <p className="font-display text-xs text-kyo">BUILT-IN WORLDS</p>
                {PLAYABLE_WORLDS.map((w) => (
                  <div key={w.id} className="flex flex-wrap items-center gap-1 border border-bone/40 p-1">
                    <span className="min-w-0 flex-1 truncate">{w.name} <span className="text-dim">{w.about}</span></span>
                    <button type="button" className="px-btn ui-btn-sm" data-testid={`open-world-${w.id}`} onClick={() => void openWorldCopy(w.id)}>Open a copy to edit</button>
                  </div>
                ))}
                <p className="font-display text-xs text-kyo">GENERATE A WORLD</p>
                <p className="text-dim">Builds continents split by sea, islands, mountains, lakes, walled cities with shops, ports with ferries, roads, resource groves, enemy camps, NPCs and quests. Then edit anything by hand.</p>
                <div className="grid grid-cols-2 gap-2 [&_input]:w-full [&_input]:min-w-0 [&_label]:min-w-0 [&_select]:w-full">
                  <label className="grid text-dim">Name<input className="border-2 border-bone bg-ink px-1" value={genForm.name} onChange={(e) => setGenForm({ ...genForm, name: e.target.value, id: slug(e.target.value) })} /></label>
                  <label className="grid text-dim">File ID<input className="border-2 border-bone bg-ink px-1" value={genForm.id} onChange={(e) => setGenForm({ ...genForm, id: slug(e.target.value) })} /></label>
                  <label className="grid text-dim">Width<input className="border-2 border-bone bg-ink px-1" type="number" min={96} max={512} value={genForm.w} onChange={(e) => setGenForm({ ...genForm, w: Number(e.target.value) })} /></label>
                  <label className="grid text-dim">Height<input className="border-2 border-bone bg-ink px-1" type="number" min={96} max={512} value={genForm.h} onChange={(e) => setGenForm({ ...genForm, h: Number(e.target.value) })} /></label>
                  <label className="grid text-dim">Continents (2–8)<input className="border-2 border-bone bg-ink px-1" type="number" min={2} max={8} value={genForm.continents} onChange={(e) => setGenForm({ ...genForm, continents: Number(e.target.value) })} /></label>
                  <label className="grid text-dim">Cities each (1–5)<input className="border-2 border-bone bg-ink px-1" type="number" min={1} max={5} value={genForm.cities} onChange={(e) => setGenForm({ ...genForm, cities: Number(e.target.value) })} /></label>
                  <label className="grid text-dim">Islands<input className="border-2 border-bone bg-ink px-1" type="number" min={0} max={40} value={genForm.islands} onChange={(e) => setGenForm({ ...genForm, islands: Number(e.target.value) })} /></label>
                  <label className="grid text-dim">Seed<input className="border-2 border-bone bg-ink px-1" type="number" value={genForm.seed} onChange={(e) => setGenForm({ ...genForm, seed: Number(e.target.value) })} /></label>
                </div>
                <label className="flex items-center gap-1 text-dim"><input type="checkbox" checked={genForm.story} onChange={(e) => setGenForm({ ...genForm, story: e.target.checked })} /> Add a main story that visits every continent</label>
                <div className="flex flex-wrap gap-1">
                  <button type="button" className="px-btn px-btn-kyo" data-testid="generate-world-btn" onClick={() => generate()}>Generate</button>
                  <button type="button" className="px-btn" onClick={() => setGenForm({ ...genForm, seed: Math.floor(Math.random() * 99999) })}>New seed</button>
                  <button type="button" className="px-btn" data-testid="surprise-world-btn" onClick={surprise}>Surprise me</button>
                </div>
                <p className="font-display text-xs text-kyo">A NEW MAIN WORLD</p>
                <p className="text-dim">One click: a fresh 500×500 world with 5–8 lands, every kind of settlement, a story across the sea, and quests that are all checked to be finishable. Every seed is a different world.</p>
                <div className="flex flex-wrap gap-1">
                  <button type="button" className="px-btn px-btn-kyo" data-testid="new-main-world-btn" onClick={newMainWorld}>New main world</button>
                  <button type="button" className="px-btn" data-testid="play-as-main-btn" onClick={playAsMain} title="Save this map; your next new life wakes in it instead of a random world">Use for my next life</button>
                  {mainChoice && <button type="button" className="px-btn" onClick={restoreVeilreach}>Roll a random world instead</button>}
                </div>
                <p className="text-dim">Every new life rolls its own world. Next life: <span className="text-kyo">{mainChoice ? (saved.find((x) => x.id === mainChoice)?.name ?? mainChoice) : "a random world"}</span></p>
                <p className="font-display text-xs text-kyo">OPEN A FILE</p>
                <input type="file" accept=".json,application/json" className="text-dim" onChange={async (e) => { const f = e.target.files?.[0]; if (f) importJson(await f.text()); e.target.value = ""; }} />
                <textarea className="min-h-16 border-2 border-bone bg-ink px-1" placeholder="…or paste map JSON here" value={importText} onChange={(e) => setImportText(e.target.value)} />
                <button type="button" className="px-btn" disabled={!importText.trim()} onClick={() => importJson(importText)}>Open pasted JSON</button>
                <p className="font-display text-xs text-kyo">NEW MAP</p>
                <div className="grid grid-cols-2 gap-2 [&_input]:w-full [&_input]:min-w-0 [&_label]:min-w-0 [&_select]:w-full">
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

function AreasPanel({ map, selected, onSelect, onPatch, onDelete, kind, onKind, onDraw, show, onShow }: {
  map: MapFile;
  selected: string | null;
  onSelect: (id: string) => void;
  onPatch: (id: string, p: Partial<MapRegion>) => void;
  onDelete: (id: string) => void;
  kind: MapRegion["kind"];
  onKind: (k: MapRegion["kind"]) => void;
  onDraw: () => void;
  show: boolean;
  onShow: (v: boolean) => void;
}) {
  const [filter, setFilter] = useState<MapRegion["kind"] | "all">("all");
  const list = (map.regions ?? []).filter((r) => filter === "all" || r.kind === filter);
  const r = map.regions?.find((x) => x.id === selected);
  const num = (v: string) => (v === "" ? undefined : Math.max(1, Math.min(99, Math.floor(Number(v)) || 1)));
  return (
    <div className="grid gap-2" data-testid="areas-panel">
      <p className="text-dim">Areas name parts of the map: continents, towns, groves, dungeons. Hunters see the name when they walk in (and earn a little Adventuring XP the first time). Quests say "Travel to" the area name instead of bare coordinates.</p>
      <div className="flex flex-wrap items-center gap-1">
        <select className="border-2 border-bone bg-ink !min-h-8 px-1" value={kind} onChange={(e) => onKind(e.target.value as MapRegion["kind"])} aria-label="New area kind">
          {REGION_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <button type="button" className="px-btn px-btn-kyo ui-btn-sm" onClick={onDraw}>Draw an area</button>
        <label className="flex items-center gap-1 text-dim"><input type="checkbox" checked={show} onChange={(e) => onShow(e.target.checked)} /> Show</label>
      </div>
      {r && (
        <div className="grid gap-1 border-2 border-kyo p-2">
          <label className="grid text-dim">Name<input className="border-2 border-bone bg-ink px-1" maxLength={60} value={r.name} onChange={(e) => onPatch(r.id, { name: e.target.value })} /></label>
          <label className="grid text-dim">Kind
            <select className="border-2 border-bone bg-ink px-1" value={r.kind} onChange={(e) => onPatch(r.id, { kind: e.target.value as MapRegion["kind"] })}>
              {REGION_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label className="grid text-dim">Shown on arrival (optional)<textarea className="min-h-12 border-2 border-bone bg-ink px-1" maxLength={200} value={r.about ?? ""} onChange={(e) => onPatch(r.id, { about: e.target.value || undefined })} /></label>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid text-dim">Level from<input className="w-16 border-2 border-bone bg-ink px-1" type="number" min={1} max={99} value={r.levelMin ?? ""} onChange={(e) => onPatch(r.id, { levelMin: num(e.target.value) })} /></label>
            <label className="grid text-dim">to<input className="w-16 border-2 border-bone bg-ink px-1" type="number" min={1} max={99} value={r.levelMax ?? ""} onChange={(e) => onPatch(r.id, { levelMax: num(e.target.value) })} /></label>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {(["tx", "ty", "tw", "th"] as const).map((k) => (
              <label key={k} className="grid text-dim">{({ tx: "X", ty: "Y", tw: "Width", th: "Height" })[k]}
                <input className="w-16 border-2 border-bone bg-ink px-1" type="number" min={k === "tw" || k === "th" ? 1 : 0} value={r[k]} onChange={(e) => onPatch(r.id, { [k]: Math.max(k === "tw" || k === "th" ? 1 : 0, Math.floor(Number(e.target.value)) || 0) })} />
              </label>
            ))}
          </div>
          <div className="flex gap-1">
            <button type="button" className="px-btn ui-btn-sm" onClick={() => onSelect(r.id)}>Jump</button>
            <ConfirmButton plain className="ui-btn-sm" label="Delete" confirm="Tap again" onConfirm={() => onDelete(r.id)} />
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {(["all", ...REGION_KINDS] as const).map((k) => (
          <button key={k} type="button" className={`px-btn ui-btn-sm ${filter === k ? "px-btn-kyo" : ""}`} onClick={() => setFilter(k)}>{k}</button>
        ))}
      </div>
      {list.length === 0 && <p className="text-dim">No areas yet. Pick a kind and press Draw an area, then drag on the map.</p>}
      <div className="grid gap-0.5">
        {list.map((x) => (
          <button key={x.id} type="button" className={`flex items-center gap-2 border border-bone/30 px-1 text-left ${x.id === selected ? "border-kyo text-bone" : "text-dim"}`} onClick={() => onSelect(x.id)}>
            <span style={{ color: REGION_COLOR[x.kind] }}>■</span>
            <span className="min-w-0 flex-1 truncate">{x.name}</span>
            <span className="text-xs">{x.kind}{x.levelMin ? ` · L${x.levelMin}${x.levelMax ? `–${x.levelMax}` : ""}` : ""}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
