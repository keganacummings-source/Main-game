import { useEffect, useRef, useState } from "react";
import { ANIMALS, MONSTERS, TILE } from "@/game/content";
import {
  downloadMapFile,
  emptyMap,
  FLOOR_COLOR,
  parseMapJson,
  DESIGNER_KEY,
  MAX_LAYERS,
  type MapFile,
  type MapTile,
  type SpawnZone,
  type MapInteractable,
  type MapNpc,
  type MapQuestStep,
} from "@/game/map-format";
import { loadTileCatalog, tileImage, type AtlasTile, type TileCatalog } from "@/game/tile-atlas";
import { EntityPanel } from "@/components/map-builder-entities";

/** Temporary thin builder until full paint tools load — re-export entities panel usage. */
export { EntityPanel };

const KEY = DESIGNER_KEY;
type Tool =
  | "pan"
  | "paint"
  | "overlay"
  | "peel"
  | "fill"
  | "pick"
  | "erase"
  | "wall"
  | "walk"
  | "block"
  | "portal"
  | "unportal"
  | "start"
  | "enemy"
  | "boss"
  | "remove"
  | "zone"
  | "node"
  | "bounty"
  | "arena"
  | "shrine"
  | "hearth"
  | "npc"
  | "dungeon";

export function MapBuilder({ onBack }: { onBack: () => void }) {
  const [map, setMap] = useState(() => ({
    ...emptyMap("new-dungeon", "New Dungeon", 48, 32, 8),
    kind: "dungeon" as const,
  }));
  const [tool, setTool] = useState<Tool>("paint");
  const [entityId, setEntityId] = useState<string | null>(null);
  const [nodeKind, setNodeKind] = useState<"ore" | "tree" | "shroom" | "fish">("ore");
  const [shrineType, setShrineType] = useState("light");
  const [dungeonTarget, setDungeonTarget] = useState("world");
  const [status, setStatus] = useState("Use tools to place nodes, boards, arenas, and quest NPCs.");
  const [zoom] = useState(24);
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewport = useRef<HTMLDivElement>(null);

  function placeAt(tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return;
    const idx = ty * map.w + tx;
    if (map.tiles[idx]?.block) return setStatus("Need a walkable tile.");
    const next = { ...map, interactables: [...(map.interactables ?? [])], npcs: [...(map.npcs ?? [])] };
    const id = crypto.randomUUID().slice(0, 12);
    if (tool === "node") {
      next.interactables.push({ id, kind: "node", node: nodeKind, tx, ty });
      setEntityId(id);
      setStatus("Node placed.");
    } else if (tool === "bounty") {
      next.interactables.push({ id, kind: "bounty", tx, ty, label: "Bounty Board" });
      setEntityId(id);
    } else if (tool === "arena") {
      next.interactables.push({ id, kind: "arena", tx, ty, label: "Arena" });
      setEntityId(id);
    } else if (tool === "shrine") {
      next.interactables.push({ id, kind: "shrine", type: shrineType, tx, ty, name: "Shrine" });
      setEntityId(id);
    } else if (tool === "hearth") {
      next.interactables.push({ id, kind: "hearth", tx, ty });
      setEntityId(id);
    } else if (tool === "dungeon") {
      next.interactables.push({ id, kind: "dungeon", mapId: dungeonTarget || "world", tx, ty, name: "Door" });
      setEntityId(id);
    } else if (tool === "npc") {
      const nid = `npc_${id}`;
      next.npcs.push({
        id: nid,
        name: "New Villager",
        tx,
        ty,
        role: "Quest giver",
        lines: ["Hello, traveler.", "I have work if you will listen."],
        quest: {
          id: `q_${nid}`,
          name: "A Favor",
          about: "Talk to someone, or bring me something.",
          rewardKyo: 40,
          steps: [{ type: "talk", npcId: "", hint: "Speak to the named person." }],
        },
      });
      setEntityId(nid);
      setStatus("NPC placed — edit dialogue and quest steps below.");
    } else if (tool === "remove") {
      next.interactables = next.interactables.filter((it) => it.tx !== tx || it.ty !== ty);
      next.npcs = next.npcs.filter((n) => n.tx !== tx || n.ty !== ty);
    } else if (tool === "start") {
      next.spawn = { tx, ty };
    }
    setMap(next);
  }

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    c.width = Math.min(900, map.w * zoom);
    c.height = Math.min(520, map.h * zoom);
    ctx.fillStyle = "#1a1214";
    ctx.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < map.h; y++)
      for (let x = 0; x < map.w; x++) {
        const t = map.tiles[y * map.w + x]!;
        ctx.fillStyle = FLOOR_COLOR[t.floor] ?? "#3d5a3a";
        ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
        if (t.block) {
          ctx.fillStyle = "rgba(196,71,58,0.35)";
          ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
        }
      }
    for (const it of map.interactables ?? []) {
      ctx.strokeStyle = "#ffe08a";
      ctx.strokeRect(it.tx * zoom + 2, it.ty * zoom + 2, zoom - 4, zoom - 4);
      ctx.fillStyle = "#e8dcc4";
      ctx.font = "9px sans-serif";
      ctx.fillText(it.kind.slice(0, 6).toUpperCase(), it.tx * zoom + 3, it.ty * zoom + 12);
    }
    for (const n of map.npcs ?? []) {
      ctx.fillStyle = "#c9a6e8";
      ctx.fillRect(n.tx * zoom + 4, n.ty * zoom + 4, zoom - 8, zoom - 8);
      ctx.fillStyle = "#140e0c";
      ctx.fillText("NPC", n.tx * zoom + 5, n.ty * zoom + 14);
    }
    if (map.spawn) {
      ctx.fillStyle = "#8fd06a";
      ctx.font = "bold 12px monospace";
      ctx.fillText("S", map.spawn.tx * zoom + 6, map.spawn.ty * zoom + 16);
    }
  }, [map, zoom]);

  return (
    <section className="designer-screen p-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-xs text-blood">QUEST MAP BUILDER</p>
          <h1 className="font-display text-lg">Places &amp; NPCs</h1>
        </div>
        <button className="px-btn" type="button" onClick={onBack}>
          Back
        </button>
      </header>
      <p className="text-dim mt-2">{status}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {(
          [
            ["node", "Node"],
            ["bounty", "Bounty"],
            ["arena", "Arena"],
            ["shrine", "Shrine"],
            ["hearth", "Hearth"],
            ["dungeon", "Door"],
            ["npc", "NPC"],
            ["start", "Start"],
            ["remove", "Erase"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`px-btn !min-h-9 !py-1 ${tool === id ? "px-btn-kyo" : ""}`}
            onClick={() => setTool(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        ref={viewport}
        className="mt-2 overflow-auto border-2 border-bone"
        style={{ maxHeight: 520 }}
      >
        <canvas
          ref={canvas}
          className="cursor-crosshair"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const tx = Math.floor((e.clientX - rect.left) / zoom);
            const ty = Math.floor((e.clientY - rect.top) / zoom);
            placeAt(tx, ty);
          }}
        />
      </div>
      <EntityPanel
        map={map}
        entityId={entityId}
        nodeKind={nodeKind}
        setNodeKind={setNodeKind}
        shrineType={shrineType}
        setShrineType={setShrineType}
        dungeonTarget={dungeonTarget}
        setDungeonTarget={setDungeonTarget}
        onSelect={setEntityId}
        onPatchInteractable={(id, patch) =>
          setMap({
            ...map,
            interactables: (map.interactables ?? []).map((it) =>
              it.id === id ? ({ ...it, ...patch } as typeof it) : it,
            ),
          })
        }
        onPatchNpc={(id, patch) =>
          setMap({
            ...map,
            npcs: (map.npcs ?? []).map((n) => (n.id === id ? { ...n, ...patch } : n)),
          })
        }
        onDelete={(id) => {
          setMap({
            ...map,
            interactables: (map.interactables ?? []).filter((it) => it.id !== id),
            npcs: (map.npcs ?? []).filter((n) => n.id !== id),
          });
          setEntityId(null);
        }}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="px-btn"
          onClick={() => {
            try {
              localStorage.setItem(KEY, JSON.stringify([...(JSON.parse(localStorage.getItem(KEY) ?? "[]") as MapFile[]).filter((m) => m.id !== map.id), parseMapJson(map)]));
              setStatus("Saved on this device.");
            } catch (err) {
              setStatus(err instanceof Error ? err.message : "Save failed");
            }
          }}
        >
          Save
        </button>
        <button type="button" className="px-btn" onClick={() => downloadMapFile(parseMapJson(map))}>
          Export JSON
        </button>
      </div>
    </section>
  );
}
