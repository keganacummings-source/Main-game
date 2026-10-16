import { useState } from "react";
import { ANIMALS, ITEMS, MONSTERS } from "@/game/content";
import type { MapFile, MapQuest, MapQuestStep } from "@/game/map-format";
import { questIssues } from "@/game/quest-check";

const NODES = ["ore", "tree", "shroom", "fish"] as const;
const input = "border-2 border-bone bg-ink px-1";
const STEP_LABEL: Record<MapQuestStep["type"], string> = { talk: "Talk to", bring: "Bring items", kill: "Defeat foes", goto: "Go to a place", gather: "Gather" };

function newStep(type: MapQuestStep["type"], map: MapFile, giver: string): MapQuestStep {
  const first = map.npcs?.find((n) => n.id !== giver)?.id ?? giver;
  if (type === "talk") return { type, npcId: first };
  if (type === "bring") return { type, itemId: "potion", count: 1 };
  if (type === "kill") return { type, count: 3 };
  if (type === "goto") return { type, tx: map.spawn?.tx ?? 1, ty: map.spawn?.ty ?? 1, radius: 2 };
  return { type, node: "tree", count: 3 };
}

/** The quest and story editor: who gives it, the steps, the rewards, and what everyone says. */
export function QuestEditor({
  map,
  selected,
  onSelect,
  onChange,
  onPickTile,
  onFix,
}: {
  map: MapFile;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onChange: (quests: MapQuest[]) => void;
  onPickTile: (cb: (tx: number, ty: number) => void) => void;
  onFix?: () => void;
}) {
  const quests = map.quests ?? [];
  const npcs = map.npcs ?? [];
  const q = quests.find((x) => x.id === selected) ?? null;
  const [openStep, setOpenStep] = useState<number | null>(null);
  const [checked, setChecked] = useState<ReturnType<typeof questIssues> | null>(null);
  const patch = (id: string, p: Partial<MapQuest>) => onChange(quests.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const setStep = (qq: MapQuest, i: number, s: MapQuestStep) => patch(qq.id, { steps: qq.steps.map((x, j) => (j === i ? s : x)) });
  const add = () => {
    let n = quests.length + 1;
    while (quests.some((x) => x.id === `quest${n}`)) n++;
    const id = `quest${n}`;
    onChange([...quests, { id, name: `New Quest ${n}`, about: "", giver: npcs[0]?.id ?? "", steps: [], reward: { kyo: 40 } }]);
    onSelect(id);
  };
  const move = (i: number, d: number) => {
    const to = i + d;
    if (!q || to < 0 || to >= q.steps.length) return;
    const steps = [...q.steps];
    [steps[i], steps[to]] = [steps[to]!, steps[i]!];
    patch(q.id, { steps });
  };
  const npcSelect = (value: string, onPick: (v: string) => void, blank?: string) => (
    <select className={input} value={value} onChange={(e) => onPick(e.target.value)}>
      {blank !== undefined && <option value="">{blank}</option>}
      {!blank && !npcs.some((n) => n.id === value) && <option value={value}>(pick an NPC)</option>}
      {npcs.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
    </select>
  );

  return (
    <div className="grid gap-2" data-testid="quest-editor">
      <p className="font-display text-xs text-blood">QUESTS &amp; STORY</p>
      <p className="text-dim">Place NPCs first (the NPC tool), then make quests here. Each quest has a giver, steps done in order, and a reward. Use "Needs quest" to chain quests into a storyline.</p>
      <div className="flex flex-wrap gap-1">
        <button type="button" className="px-btn px-btn-kyo ui-btn-sm" data-testid="add-quest-btn" onClick={add} disabled={!npcs.length} title={npcs.length ? "" : "Place an NPC first"}>+ New quest</button>
        <button type="button" className="px-btn ui-btn-sm" data-testid="check-quests-btn" onClick={() => setChecked(questIssues(map))} disabled={!quests.length}>Check quests</button>
        {onFix && <button type="button" className="px-btn ui-btn-sm" data-testid="fix-quests-btn" onClick={() => { onFix(); setChecked(null); }} disabled={!quests.length} title="Snap trips to reachable ground, retarget foes that never spawn, add nodes for gather steps, and remove quests that can never be done">Fix quests</button>}
        {quests.map((x) => (
          <button key={x.id} type="button" className={`px-btn ui-btn-sm ${selected === x.id ? "px-btn-kyo" : ""}`} onClick={() => { onSelect(x.id); setOpenStep(null); }}>{x.name}</button>
        ))}
      </div>
      {!npcs.length && <p className="text-blood">No NPCs yet. Pick the NPC tool and click the map.</p>}
      {checked && (
        <div className="grid max-h-40 gap-0.5 overflow-auto border border-bone/40 p-1" data-testid="quest-check">
          {!checked.length && <p className="text-kyo">Every quest can be finished.</p>}
          {checked.map((i, k) => (
            <button key={k} type="button" className={`text-left ${i.fatal ? "text-blood" : "text-dim"}`} onClick={() => onSelect(i.questId)}>
              {i.quest}{i.step >= 0 ? ` · step ${i.step + 1}` : ""}: {i.text}
            </button>
          ))}
        </div>
      )}
      {q && (
        <div className="grid gap-1 border-2 border-bone p-2">
          <label className="grid text-dim">Name<input className={input} value={q.name} maxLength={60} onChange={(e) => patch(q.id, { name: e.target.value })} /></label>
          <label className="grid text-dim">Summary (shown in the quest log)<textarea className={`${input} min-h-12`} maxLength={400} value={q.about} onChange={(e) => patch(q.id, { about: e.target.value })} /></label>
          <div className="flex flex-wrap gap-2">
            <label className="grid text-dim">Given by{npcSelect(q.giver, (v) => patch(q.id, { giver: v }))}</label>
            <label className="grid text-dim">Handed in to{npcSelect(q.turnIn ?? "", (v) => patch(q.id, { turnIn: v || undefined }), "Same as giver")}</label>
            <label className="grid text-dim">Needs quest
              <select className={input} value={q.requires ?? ""} onChange={(e) => patch(q.id, { requires: e.target.value || undefined })}>
                <option value="">Available from the start</option>
                {quests.filter((x) => x.id !== q.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
          </div>
          <p className="font-display text-xs text-kyo">STEPS (in order)</p>
          {q.steps.length === 0 && <p className="text-dim">No steps. The quest is done the moment it is accepted.</p>}
          {q.steps.map((s, i) => (
            <div key={i} className="grid gap-1 border border-bone/40 p-1">
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-kyo">{i + 1}.</span>
                <select className={input} value={s.type} onChange={(e) => setStep(q, i, { ...newStep(e.target.value as MapQuestStep["type"], map, q.giver), hint: s.hint })}>
                  {(Object.keys(STEP_LABEL) as MapQuestStep["type"][]).map((t) => <option key={t} value={t}>{STEP_LABEL[t]}</option>)}
                </select>
                {s.type === "talk" && npcSelect(s.npcId, (v) => setStep(q, i, { ...s, npcId: v }))}
                {s.type === "bring" && (
                  <>
                    <input className={`${input} w-14`} type="number" min={1} max={99} value={s.count} onChange={(e) => setStep(q, i, { ...s, count: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })} />
                    <select className={input} value={s.itemId} onChange={(e) => setStep(q, i, { ...s, itemId: e.target.value })}>
                      {!ITEMS.some((it) => it.id === s.itemId) && <option value={s.itemId}>{s.itemId || "(pick an item)"}</option>}
                      {ITEMS.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                    </select>
                    <span className="text-dim">to</span>
                    {npcSelect(s.npcId ?? "", (v) => setStep(q, i, { ...s, npcId: v || undefined }), "the quest's turn-in NPC")}
                  </>
                )}
                {s.type === "kill" && (
                  <>
                    <input className={`${input} w-14`} type="number" min={1} max={50} value={s.count} onChange={(e) => setStep(q, i, { ...s, count: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })} />
                    <select className={input} value={s.species ?? ""} onChange={(e) => setStep(q, i, { ...s, species: e.target.value || undefined })}>
                      <option value="">any foe</option>
                      {[...MONSTERS, ...ANIMALS].map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </>
                )}
                {s.type === "gather" && (
                  <>
                    <input className={`${input} w-14`} type="number" min={1} max={20} value={s.count} onChange={(e) => setStep(q, i, { ...s, count: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} />
                    <select className={input} value={s.node} onChange={(e) => setStep(q, i, { ...s, node: e.target.value as (typeof NODES)[number] })}>
                      {NODES.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </>
                )}
                {s.type === "goto" && (
                  <>
                    <span className="text-dim">tile {s.tx}, {s.ty} · within</span>
                    <input className={`${input} w-12`} type="number" min={1} max={12} value={s.radius ?? 2} onChange={(e) => setStep(q, i, { ...s, radius: Math.max(1, Math.min(12, Number(e.target.value) || 2)) })} />
                    <button type="button" className="px-btn ui-btn-sm" onClick={() => onPickTile((tx, ty) => setStep(q, i, { ...s, tx, ty }))}>Pick on map</button>
                  </>
                )}
                <span className="ml-auto flex gap-1">
                  <button type="button" className="px-btn ui-btn-sm" aria-label="Move up" onClick={() => move(i, -1)}>↑</button>
                  <button type="button" className="px-btn ui-btn-sm" aria-label="Move down" onClick={() => move(i, 1)}>↓</button>
                  <button type="button" className="px-btn ui-btn-sm" aria-label="Remove step" onClick={() => patch(q.id, { steps: q.steps.filter((_, j) => j !== i) })}>×</button>
                </span>
              </div>
              {openStep === i ? (
                <input className={input} placeholder="Hint shown in the quest log (optional)" maxLength={120} value={s.hint ?? ""} onChange={(e) => setStep(q, i, { ...s, hint: e.target.value || undefined })} />
              ) : (
                <button type="button" className="text-left text-dim underline" onClick={() => setOpenStep(i)}>{s.hint ? `Hint: ${s.hint}` : "+ add a hint"}</button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-1">
            {(Object.keys(STEP_LABEL) as MapQuestStep["type"][]).map((t) => (
              <button key={t} type="button" className="px-btn ui-btn-sm" onClick={() => patch(q.id, { steps: [...q.steps, newStep(t, map, q.giver)] })}>+ {STEP_LABEL[t]}</button>
            ))}
          </div>
          <p className="font-display text-xs text-kyo">REWARD</p>
          <div className="flex flex-wrap gap-2">
            <label className="grid text-dim">Kyo<input className={`${input} w-20`} type="number" min={0} max={99999} value={q.reward?.kyo ?? 0} onChange={(e) => patch(q.id, { reward: { ...q.reward, kyo: Math.max(0, Number(e.target.value) || 0) } })} /></label>
            <label className="grid text-dim">XP<input className={`${input} w-20`} type="number" min={0} max={99999} value={q.reward?.xp ?? 0} onChange={(e) => patch(q.id, { reward: { ...q.reward, xp: Math.max(0, Number(e.target.value) || 0) } })} /></label>
          </div>
          {(q.reward?.items ?? []).map((it, i) => (
            <div key={i} className="flex flex-wrap gap-1">
              <input className={`${input} w-14`} type="number" min={1} max={99} value={it.count} onChange={(e) => patch(q.id, { reward: { ...q.reward, items: q.reward!.items!.map((x, j) => (j === i ? { ...x, count: Math.max(1, Number(e.target.value) || 1) } : x)) } })} />
              <select className={input} value={it.itemId} onChange={(e) => patch(q.id, { reward: { ...q.reward, items: q.reward!.items!.map((x, j) => (j === i ? { ...x, itemId: e.target.value } : x)) } })}>
                {ITEMS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
              <button type="button" className="px-btn ui-btn-sm" onClick={() => patch(q.id, { reward: { ...q.reward, items: q.reward!.items!.filter((_, j) => j !== i) } })}>×</button>
            </div>
          ))}
          <button type="button" className="px-btn ui-btn-sm justify-self-start" onClick={() => patch(q.id, { reward: { ...q.reward, items: [...(q.reward?.items ?? []), { itemId: "potion", count: 1 }] } })}>+ Item reward</button>
          <p className="font-display text-xs text-kyo">WHAT THEY SAY</p>
          <label className="grid text-dim">When offering it<textarea className={`${input} min-h-10`} maxLength={300} value={q.offer ?? ""} onChange={(e) => patch(q.id, { offer: e.target.value || undefined })} /></label>
          <label className="grid text-dim">While you are working on it<textarea className={`${input} min-h-10`} maxLength={300} value={q.progress ?? ""} onChange={(e) => patch(q.id, { progress: e.target.value || undefined })} /></label>
          <label className="grid text-dim">When you hand it in<textarea className={`${input} min-h-10`} maxLength={300} value={q.done ?? ""} onChange={(e) => patch(q.id, { done: e.target.value || undefined })} /></label>
          <button type="button" className="px-btn" onClick={() => { onChange(quests.filter((x) => x.id !== q.id).map((x) => (x.requires === q.id ? { ...x, requires: undefined } : x))); onSelect(null); }}>Delete quest</button>
        </div>
      )}
    </div>
  );
}
