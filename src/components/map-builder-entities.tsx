import type { MapFile, MapInteractable, MapNpc, MapQuestStep } from "@/game/map-format";

export function EntityPanel({
  map,
  entityId,
  nodeKind,
  setNodeKind,
  shrineType,
  setShrineType,
  dungeonTarget,
  setDungeonTarget,
  onSelect,
  onPatchInteractable,
  onPatchNpc,
  onDelete,
}: {
  map: MapFile;
  entityId: string | null;
  nodeKind: "ore" | "tree" | "shroom" | "fish";
  setNodeKind: (v: "ore" | "tree" | "shroom" | "fish") => void;
  shrineType: string;
  setShrineType: (v: string) => void;
  dungeonTarget: string;
  setDungeonTarget: (v: string) => void;
  onSelect: (id: string | null) => void;
  onPatchInteractable: (id: string, patch: Partial<MapInteractable>) => void;
  onPatchNpc: (id: string, patch: Partial<MapNpc>) => void;
  onDelete: (id: string) => void;
}) {
  const npc = map.npcs?.find((n) => n.id === entityId) ?? null;
  const it = map.interactables?.find((x) => x.id === entityId) ?? null;
  return (
    <div className="mt-3 border-2 border-bone p-2">
      <p className="font-display text-xs text-kyo">QUEST &amp; PLACES</p>
      <p className="text-dim">Place nodes, bounty boards, arenas, shrines, doors, and NPCs. Select one to edit dialogue and quest steps.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <label className="text-dim">
          Node type{" "}
          <select className="border-2 border-bone bg-ink px-1" value={nodeKind} onChange={(e) => setNodeKind(e.target.value as typeof nodeKind)}>
            {(["ore", "tree", "shroom", "fish"] as const).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className="text-dim">
          Shrine{" "}
          <select className="border-2 border-bone bg-ink px-1" value={shrineType} onChange={(e) => setShrineType(e.target.value)}>
            {["light", "fire", "water", "earth", "ice", "air", "void", "spirit"].map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className="text-dim">
          Door →{" "}
          <input className="w-24 border-2 border-bone bg-ink px-1" value={dungeonTarget} onChange={(e) => setDungeonTarget(e.target.value.replace(/[^a-z0-9_-]/gi, "-"))} />
        </label>
      </div>
      <div className="mt-2 max-h-28 overflow-auto">
        {(map.interactables ?? []).map((x) => (
          <button key={x.id} type="button" className={`px-btn mr-1 mt-1 !min-h-8 !py-0 ${entityId === x.id ? "px-btn-kyo" : ""}`} onClick={() => onSelect(x.id)}>
            {x.kind}@{x.tx},{x.ty}
          </button>
        ))}
        {(map.npcs ?? []).map((n) => (
          <button key={n.id} type="button" className={`px-btn mr-1 mt-1 !min-h-8 !py-0 ${entityId === n.id ? "px-btn-kyo" : ""}`} onClick={() => onSelect(n.id)}>
            {n.name}
          </button>
        ))}
      </div>
      {it && (
        <div className="mt-2 grid gap-1">
          <p className="text-kyo">{it.kind} · {it.tx},{it.ty}</p>
          {"label" in it && (
            <input className="border-2 border-bone bg-ink px-1" value={it.label ?? ""} onChange={(e) => onPatchInteractable(it.id, { label: e.target.value.slice(0, 40) } as Partial<MapInteractable>)} placeholder="Label" />
          )}
          {"name" in it && it.kind !== "node" && (
            <input className="border-2 border-bone bg-ink px-1" value={(it as { name?: string }).name ?? ""} onChange={(e) => onPatchInteractable(it.id, { name: e.target.value.slice(0, 40) } as Partial<MapInteractable>)} placeholder="Name" />
          )}
          {it.kind === "dungeon" && (
            <input className="border-2 border-bone bg-ink px-1" value={it.mapId} onChange={(e) => onPatchInteractable(it.id, { mapId: e.target.value.replace(/[^a-z0-9_-]/gi, "-") } as Partial<MapInteractable>)} placeholder="Target map id" />
          )}
          {it.kind === "node" && (
            <select className="border-2 border-bone bg-ink px-1" value={it.node} onChange={(e) => onPatchInteractable(it.id, { node: e.target.value as "ore" | "tree" | "shroom" | "fish" } as Partial<MapInteractable>)}>
              {(["ore", "tree", "shroom", "fish"] as const).map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          )}
          <button type="button" className="px-btn" onClick={() => onDelete(it.id)}>Delete place</button>
        </div>
      )}
      {npc && (
        <div className="mt-2 grid gap-1">
          <p className="text-kyo">NPC · {npc.tx},{npc.ty}</p>
          <input className="border-2 border-bone bg-ink px-1" value={npc.name} onChange={(e) => onPatchNpc(npc.id, { name: e.target.value.slice(0, 40) })} placeholder="Name" />
          <input className="border-2 border-bone bg-ink px-1" value={npc.role ?? ""} onChange={(e) => onPatchNpc(npc.id, { role: e.target.value.slice(0, 40) })} placeholder="Role" />
          <label className="text-dim">
            <input type="checkbox" checked={!!npc.female} onChange={(e) => onPatchNpc(npc.id, { female: e.target.checked })} /> Female sprite
          </label>
          <p className="text-dim">Dialogue lines (one per line)</p>
          <textarea
            className="min-h-16 border-2 border-bone bg-ink px-1"
            value={npc.lines.join("\n")}
            onChange={(e) => onPatchNpc(npc.id, { lines: e.target.value.split("\n").map((l) => l.slice(0, 200)).filter(Boolean).slice(0, 12) })}
          />
          <p className="font-display text-xs text-blood">Quest</p>
          <input className="border-2 border-bone bg-ink px-1" value={npc.quest?.name ?? ""} onChange={(e) => onPatchNpc(npc.id, { quest: { ...(npc.quest ?? { id: `q_${npc.id}`, name: "", about: "", steps: [] }), name: e.target.value.slice(0, 60) } })} placeholder="Quest name" />
          <input className="border-2 border-bone bg-ink px-1" value={npc.quest?.about ?? ""} onChange={(e) => onPatchNpc(npc.id, { quest: { ...(npc.quest ?? { id: `q_${npc.id}`, name: "Quest", about: "", steps: [] }), about: e.target.value.slice(0, 240) } })} placeholder="Quest description" />
          <input className="border-2 border-bone bg-ink px-1" type="number" value={npc.quest?.rewardKyo ?? 40} onChange={(e) => onPatchNpc(npc.id, { quest: { ...(npc.quest ?? { id: `q_${npc.id}`, name: "Quest", about: "", steps: [] }), rewardKyo: Number(e.target.value) || 0 } })} placeholder="Reward kyo" />
          <p className="text-dim">Steps: talk to NPCs, bring items, kill, go to tiles, gather nodes.</p>
          {(npc.quest?.steps ?? []).map((step, i) => (
            <div key={i} className="border border-bone/40 p-1 text-dim">
              <span className="text-kyo">{step.type}</span>{" "}
              {step.type === "talk" && (
                <input className="w-28 border border-bone bg-ink px-1" value={step.npcId} onChange={(e) => {
                  const steps = [...(npc.quest?.steps ?? [])];
                  steps[i] = { ...step, npcId: e.target.value.slice(0, 40) };
                  onPatchNpc(npc.id, { quest: { ...npc.quest!, steps } });
                }} placeholder="Target NPC id" />
              )}
              {step.type === "bring" && (
                <>
                  <input className="w-24 border border-bone bg-ink px-1" value={step.itemId} onChange={(e) => {
                    const steps = [...(npc.quest?.steps ?? [])];
                    steps[i] = { ...step, itemId: e.target.value.slice(0, 40) };
                    onPatchNpc(npc.id, { quest: { ...npc.quest!, steps } });
                  }} placeholder="item id" />
                  <input className="w-12 border border-bone bg-ink px-1" type="number" value={step.count} onChange={(e) => {
                    const steps = [...(npc.quest?.steps ?? [])];
                    steps[i] = { ...step, count: Number(e.target.value) || 1 };
                    onPatchNpc(npc.id, { quest: { ...npc.quest!, steps } });
                  }} />
                </>
              )}
              {step.type === "kill" && (
                <input className="w-12 border border-bone bg-ink px-1" type="number" value={step.count} onChange={(e) => {
                  const steps = [...(npc.quest?.steps ?? [])];
                  steps[i] = { ...step, count: Number(e.target.value) || 1 };
                  onPatchNpc(npc.id, { quest: { ...npc.quest!, steps } });
                }} />
              )}
              {step.type === "goto" && (
                <>
                  <input className="w-12 border border-bone bg-ink px-1" type="number" value={step.tx} onChange={(e) => {
                    const steps = [...(npc.quest?.steps ?? [])];
                    steps[i] = { ...step, tx: Number(e.target.value) || 0 };
                    onPatchNpc(npc.id, { quest: { ...npc.quest!, steps } });
                  }} />
                  <input className="w-12 border border-bone bg-ink px-1" type="number" value={step.ty} onChange={(e) => {
                    const steps = [...(npc.quest?.steps ?? [])];
                    steps[i] = { ...step, ty: Number(e.target.value) || 0 };
                    onPatchNpc(npc.id, { quest: { ...npc.quest!, steps } });
                  }} />
                </>
              )}
              {step.type === "gather" && (
                <>
                  <select className="border border-bone bg-ink" value={step.node} onChange={(e) => {
                    const steps = [...(npc.quest?.steps ?? [])];
                    steps[i] = { ...step, node: e.target.value as "ore" | "tree" | "shroom" | "fish" };
                    onPatchNpc(npc.id, { quest: { ...npc.quest!, steps } });
                  }}>
                    {(["ore", "tree", "shroom", "fish"] as const).map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <input className="w-12 border border-bone bg-ink px-1" type="number" value={step.count} onChange={(e) => {
                    const steps = [...(npc.quest?.steps ?? [])];
                    steps[i] = { ...step, count: Number(e.target.value) || 1 };
                    onPatchNpc(npc.id, { quest: { ...npc.quest!, steps } });
                  }} />
                </>
              )}
              <button type="button" className="px-btn !min-h-7 !py-0" onClick={() => {
                const steps = (npc.quest?.steps ?? []).filter((_, j) => j !== i);
                onPatchNpc(npc.id, { quest: { ...npc.quest!, steps } });
              }}>×</button>
            </div>
          ))}
          <div className="flex flex-wrap gap-1">
            {(["talk", "bring", "kill", "goto", "gather"] as const).map((type) => (
              <button
                key={type}
                type="button"
                className="px-btn !min-h-8 !py-0"
                onClick={() => {
                  const base = npc.quest ?? { id: `q_${npc.id}`, name: "A Favor", about: "", rewardKyo: 40, steps: [] as MapQuestStep[] };
                  const step: MapQuestStep =
                    type === "talk" ? { type, npcId: "", hint: "Talk to them." }
                    : type === "bring" ? { type, itemId: "potion", count: 1, hint: "Bring the item." }
                    : type === "kill" ? { type, count: 3, hint: "Defeat foes." }
                    : type === "goto" ? { type, tx: npc.tx, ty: npc.ty, radius: 2, hint: "Reach the place." }
                    : { type, node: "ore", count: 2, hint: "Gather resources." };
                  onPatchNpc(npc.id, { quest: { ...base, steps: [...base.steps, step] } });
                }}
              >
                + {type}
              </button>
            ))}
          </div>
          <button type="button" className="px-btn" onClick={() => onDelete(npc.id)}>Delete NPC</button>
        </div>
      )}
    </div>
  );
}
