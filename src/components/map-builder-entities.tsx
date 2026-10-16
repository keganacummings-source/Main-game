import { ANIMALS, MONSTERS, TYPES } from "@/game/content";
import type { MapFile, MapInteractable, MapNpc, SpawnZone } from "@/game/map-format";
import type { Spawn } from "@/game/world";

export type Sel = { kind: "npc" | "it" | "spawn" | "zone"; id: string } | null;

export type PlaceOpts = {
  node: "ore" | "tree" | "shroom" | "fish";
  shrine: string;
  door: string;
  species: string;
  level: number;
  zone: { species: string[]; levelMin: number; levelMax: number; count: number; respawn: number };
  portal: { map: string; tx?: number; ty?: number };
};

export const DEFAULT_OPTS: PlaceOpts = {
  node: "tree",
  shrine: "light",
  door: "world",
  species: "onibi",
  level: 5,
  zone: { species: [], levelMin: 3, levelMax: 6, count: 6, respawn: 45 },
  portal: { map: "world" },
};

const input = "border-2 border-bone bg-ink px-1";
const FOES = [...MONSTERS, ...ANIMALS];
const num = (v: string, min: number, max: number, d: number) => Math.max(min, Math.min(max, Math.floor(Number(v)) || d));

/** Settings for whichever placing tool is active. */
export function PlaceSettings({ tool, opts, set, savedIds }: { tool: string; opts: PlaceOpts; set: (o: PlaceOpts) => void; savedIds: string[] }) {
  const species = (value: string, onPick: (v: string) => void) => (
    <select className={input} value={value} onChange={(e) => onPick(e.target.value)}>
      {FOES.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.type})</option>)}
    </select>
  );
  if (tool === "enemy" || tool === "boss")
    return (
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid text-dim">{tool === "boss" ? "Boss" : "Enemy"}{species(opts.species, (v) => set({ ...opts, species: v }))}</label>
        <label className="grid text-dim">Level<input className={`${input} w-16`} type="number" min={1} max={1000} value={opts.level} onChange={(e) => set({ ...opts, level: num(e.target.value, 1, 1000, 5) })} /></label>
        <span className="text-dim">Click a walkable tile. A boss has far more health and always drops loot.</span>
      </div>
    );
  if (tool === "zone")
    return (
      <div className="grid gap-1">
        <p className="text-dim">Drag a rectangle on the map. Foes of the chosen kinds appear inside it and come back after they are defeated.</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid text-dim">Level from<input className={`${input} w-16`} type="number" min={1} max={1000} value={opts.zone.levelMin} onChange={(e) => { const v = num(e.target.value, 1, 1000, 3); set({ ...opts, zone: { ...opts.zone, levelMin: v, levelMax: Math.max(v, opts.zone.levelMax) } }); }} /></label>
          <label className="grid text-dim">to<input className={`${input} w-16`} type="number" min={1} max={1000} value={opts.zone.levelMax} onChange={(e) => set({ ...opts, zone: { ...opts.zone, levelMax: Math.max(opts.zone.levelMin, num(e.target.value, 1, 1000, 6)) } })} /></label>
          <label className="grid text-dim">How many<input className={`${input} w-16`} type="number" min={1} max={40} value={opts.zone.count} onChange={(e) => set({ ...opts, zone: { ...opts.zone, count: num(e.target.value, 1, 40, 6) } })} /></label>
          <label className="grid text-dim">Respawn (s)<input className={`${input} w-16`} type="number" min={5} max={600} value={opts.zone.respawn} onChange={(e) => set({ ...opts, zone: { ...opts.zone, respawn: num(e.target.value, 5, 600, 45) } })} /></label>
        </div>
        <ZoneSpecies value={opts.zone.species} onChange={(v) => set({ ...opts, zone: { ...opts.zone, species: v } })} />
      </div>
    );
  if (tool === "node")
    return (
      <label className="text-dim">Resource{" "}
        <select className={input} value={opts.node} onChange={(e) => set({ ...opts, node: e.target.value as PlaceOpts["node"] })}>
          {(["ore", "tree", "shroom", "fish"] as const).map((k) => <option key={k} value={k}>{k === "tree" ? "tree (timber)" : k === "ore" ? "ore vein" : k === "shroom" ? "mushroom patch" : "fishing spot"}</option>)}
        </select>
      </label>
    );
  if (tool === "shrine")
    return (
      <label className="text-dim">Element{" "}
        <select className={input} value={opts.shrine} onChange={(e) => set({ ...opts, shrine: e.target.value })}>
          {Object.keys(TYPES).map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </label>
    );
  if (tool === "dungeon")
    return (
      <label className="text-dim">Door leads to{" "}
        <select className={input} value={opts.door} onChange={(e) => set({ ...opts, door: e.target.value })}>
          <option value="world">the overworld</option>
          {savedIds.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
      </label>
    );
  if (tool === "portal")
    return (
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid text-dim">Portal leads to
          <select className={input} value={opts.portal.map} onChange={(e) => set({ ...opts, portal: { map: e.target.value } })}>
            <option value="world">the overworld</option>
            {savedIds.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </label>
        {opts.portal.map !== "world" && (
          <>
            <label className="grid text-dim">Arrive at x<input className={`${input} w-16`} type="number" min={0} placeholder="start" value={opts.portal.tx ?? ""} onChange={(e) => set({ ...opts, portal: { ...opts.portal, tx: e.target.value === "" ? undefined : num(e.target.value, 0, 511, 0), ty: opts.portal.ty ?? 0 } })} /></label>
            <label className="grid text-dim">y<input className={`${input} w-16`} type="number" min={0} placeholder="start" value={opts.portal.ty ?? ""} onChange={(e) => set({ ...opts, portal: { ...opts.portal, ty: e.target.value === "" ? undefined : num(e.target.value, 0, 511, 0), tx: opts.portal.tx ?? 0 } })} /></label>
          </>
        )}
        <span className="text-dim">Click tiles to make them portals. Stepping on one travels.</span>
      </div>
    );
  return null;
}

function ZoneSpecies({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <details>
      <summary className="cursor-pointer text-dim">Enemy kinds: {value.length ? value.map((id) => FOES.find((m) => m.id === id)?.name ?? id).join(", ") : "any (leave empty for a mix)"}</summary>
      <div className="mt-1 flex max-h-40 flex-wrap gap-1 overflow-auto">
        {FOES.map((m) => (
          <label key={m.id} className={`cursor-pointer border px-1 ${value.includes(m.id) ? "border-kyo text-kyo" : "border-bone/40 text-dim"}`}>
            <input type="checkbox" className="sr-only" checked={value.includes(m.id)} onChange={(e) => onChange(e.target.checked ? [...value, m.id] : value.filter((x) => x !== m.id))} />
            {m.name}
          </label>
        ))}
      </div>
    </details>
  );
}

/** Lists everything placed on the map and edits the selected thing. */
export function Inspector({
  map,
  sel,
  onSelect,
  onPatchNpc,
  onPatchIt,
  onPatchSpawn,
  onPatchZone,
  onDelete,
  onJump,
  openQuest,
  savedIds,
}: {
  map: MapFile;
  sel: Sel;
  onSelect: (s: Sel) => void;
  onPatchNpc: (id: string, p: Partial<MapNpc>) => void;
  onPatchIt: (id: string, p: Partial<MapInteractable>) => void;
  onPatchSpawn: (id: string, p: Partial<Spawn>) => void;
  onPatchZone: (id: string, p: Partial<SpawnZone>) => void;
  onDelete: (s: NonNullable<Sel>) => void;
  onJump: (tx: number, ty: number) => void;
  openQuest: (id: string) => void;
  savedIds: string[];
}) {
  const npc = sel?.kind === "npc" ? map.npcs?.find((n) => n.id === sel.id) : undefined;
  const it = sel?.kind === "it" ? map.interactables?.find((n) => n.id === sel.id) : undefined;
  const sp = sel?.kind === "spawn" ? map.spawns?.find((n) => n.id === sel.id) : undefined;
  const zone = sel?.kind === "zone" ? map.zones?.find((n) => n.id === sel.id) : undefined;
  const chip = (kind: NonNullable<Sel>["kind"], id: string, label: string, tx: number, ty: number) => (
    <button key={`${kind}${id}`} type="button" className={`px-btn ui-btn-sm mr-1 mt-1 ${sel?.kind === kind && sel.id === id ? "px-btn-kyo" : ""}`} onClick={() => { onSelect({ kind, id }); onJump(tx, ty); }}>{label}</button>
  );
  const T = 32;
  return (
    <div className="grid gap-2" data-testid="inspector">
      <p className="font-display text-xs text-blood">PLACED ON THIS MAP</p>
      <div className="max-h-36 overflow-auto">
        {(map.npcs ?? []).map((n) => chip("npc", n.id, n.name, n.tx, n.ty))}
        {(map.interactables ?? []).map((x) => chip("it", x.id, `${x.kind === "node" ? x.node : x.kind} ${x.tx},${x.ty}`, x.tx, x.ty))}
        {(map.spawns ?? []).filter((s) => s.kind === "mob").map((s) => chip("spawn", s.id, `${s.boss ? "boss " : ""}${s.species} L${s.level}`, Math.floor(s.x / T), Math.floor(s.y / T)))}
        {(map.zones ?? []).map((z) => chip("zone", z.id, `zone ${z.tw}x${z.th}`, z.tx, z.ty))}
        {!((map.npcs?.length ?? 0) + (map.interactables?.length ?? 0) + (map.spawns?.length ?? 0) + (map.zones?.length ?? 0)) && <p className="text-dim">Nothing yet. Pick a placing tool and click the map, or use Select to click things.</p>}
      </div>
      {npc && (
        <div className="grid gap-1 border-2 border-bone p-2">
          <p className="text-kyo">NPC · tile {npc.tx}, {npc.ty}</p>
          <input className={input} value={npc.name} maxLength={40} onChange={(e) => onPatchNpc(npc.id, { name: e.target.value })} placeholder="Name" />
          <input className={input} value={npc.role ?? ""} maxLength={40} onChange={(e) => onPatchNpc(npc.id, { role: e.target.value })} placeholder="Role (Blacksmith, Elder…)" />
          <label className="text-dim"><input type="checkbox" checked={!!npc.female} onChange={(e) => onPatchNpc(npc.id, { female: e.target.checked })} /> Female look</label>
          <div className="flex gap-2">
            <label className="grid text-dim">Outfit<input className={`${input} w-16`} type="number" min={0} max={11} value={npc.outfit ?? 0} onChange={(e) => onPatchNpc(npc.id, { outfit: num(e.target.value, 0, 11, 0) })} /></label>
            <label className="grid text-dim">Hair<input className={`${input} w-16`} type="number" min={0} max={11} value={npc.hair ?? 0} onChange={(e) => onPatchNpc(npc.id, { hair: num(e.target.value, 0, 11, 0) })} /></label>
          </div>
          <p className="text-dim">What they say (one line per page)</p>
          <textarea className={`${input} min-h-20`} value={npc.lines.join("\n")} onChange={(e) => onPatchNpc(npc.id, { lines: e.target.value.split("\n").map((l) => l.slice(0, 200)).slice(0, 12) })} onBlur={(e) => onPatchNpc(npc.id, { lines: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 12) })} />
          {(map.quests ?? []).filter((q) => q.giver === npc.id || q.turnIn === npc.id).map((q) => (
            <button key={q.id} type="button" className="px-btn ui-btn-sm justify-self-start" onClick={() => openQuest(q.id)}>Quest: {q.name} →</button>
          ))}
          <button type="button" className="px-btn" onClick={() => onDelete(sel!)}>Delete NPC</button>
        </div>
      )}
      {it && (
        <div className="grid gap-1 border-2 border-bone p-2">
          <p className="text-kyo">{it.kind} · tile {it.tx}, {it.ty}</p>
          {(it.kind === "bounty" || it.kind === "arena") && <input className={input} value={it.label ?? ""} maxLength={40} onChange={(e) => onPatchIt(it.id, { label: e.target.value } as Partial<MapInteractable>)} placeholder="Sign text" />}
          {(it.kind === "shrine" || it.kind === "dungeon") && <input className={input} value={it.name ?? ""} maxLength={40} onChange={(e) => onPatchIt(it.id, { name: e.target.value } as Partial<MapInteractable>)} placeholder="Name" />}
          {it.kind === "shrine" && (
            <select className={input} value={it.type} onChange={(e) => onPatchIt(it.id, { type: e.target.value } as Partial<MapInteractable>)}>
              {Object.keys(TYPES).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          )}
          {it.kind === "dungeon" && (
            <select className={input} value={it.mapId} onChange={(e) => onPatchIt(it.id, { mapId: e.target.value } as Partial<MapInteractable>)}>
              <option value="world">the overworld</option>
              {!savedIds.includes(it.mapId) && it.mapId !== "world" && <option value={it.mapId}>{it.mapId} (not saved yet)</option>}
              {savedIds.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          )}
          {it.kind === "node" && (
            <select className={input} value={it.node} onChange={(e) => onPatchIt(it.id, { node: e.target.value } as Partial<MapInteractable>)}>
              {(["ore", "tree", "shroom", "fish"] as const).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          )}
          <button type="button" className="px-btn" onClick={() => onDelete(sel!)}>Delete</button>
        </div>
      )}
      {sp && (
        <div className="grid gap-1 border-2 border-bone p-2">
          <p className="text-kyo">{sp.boss ? "Boss" : "Enemy"} · tile {Math.floor(sp.x / T)}, {Math.floor(sp.y / T)}</p>
          <select className={input} value={sp.species} onChange={(e) => onPatchSpawn(sp.id, { species: e.target.value })}>
            {FOES.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <label className="grid text-dim">Level<input className={`${input} w-20`} type="number" min={1} max={1000} value={sp.level} onChange={(e) => onPatchSpawn(sp.id, { level: num(e.target.value, 1, 1000, 1) })} /></label>
          <label className="text-dim"><input type="checkbox" checked={!!sp.boss} onChange={(e) => onPatchSpawn(sp.id, { boss: e.target.checked })} /> Boss</label>
          <input className={input} value={sp.name ?? ""} maxLength={40} placeholder="Custom name (optional)" onChange={(e) => onPatchSpawn(sp.id, { name: e.target.value || undefined })} />
          <button type="button" className="px-btn" onClick={() => onDelete(sel!)}>Delete</button>
        </div>
      )}
      {zone && (
        <div className="grid gap-1 border-2 border-bone p-2">
          <p className="text-kyo">Spawn zone · {zone.tw}×{zone.th} at {zone.tx}, {zone.ty}</p>
          <div className="flex flex-wrap gap-2">
            <label className="grid text-dim">Level from<input className={`${input} w-16`} type="number" value={zone.levelMin} onChange={(e) => { const v = num(e.target.value, 1, 1000, 1); onPatchZone(zone.id, { levelMin: v, levelMax: Math.max(v, zone.levelMax) }); }} /></label>
            <label className="grid text-dim">to<input className={`${input} w-16`} type="number" value={zone.levelMax} onChange={(e) => onPatchZone(zone.id, { levelMax: Math.max(zone.levelMin, num(e.target.value, 1, 1000, 1)) })} /></label>
            <label className="grid text-dim">Count<input className={`${input} w-16`} type="number" value={zone.count} onChange={(e) => onPatchZone(zone.id, { count: num(e.target.value, 1, 40, 1) })} /></label>
            <label className="grid text-dim">Respawn s<input className={`${input} w-16`} type="number" value={zone.respawn} onChange={(e) => onPatchZone(zone.id, { respawn: num(e.target.value, 5, 600, 45) })} /></label>
          </div>
          <ZoneSpecies value={zone.species} onChange={(v) => onPatchZone(zone.id, { species: v })} />
          <button type="button" className="px-btn" onClick={() => onDelete(sel!)}>Delete zone</button>
        </div>
      )}
    </div>
  );
}
