/**
 * Quest rules for designer maps. Pure data + maths so the engine, the editor and the tests share them.
 *
 * Flow: a quest is OFFERED by its giver NPC (once its `requires` quest is done), the hunter accepts it,
 * works through the steps in order, and hands it in to `turnIn` (default: the giver) for the reward.
 */
import type { MapFile, MapNpc, MapQuest, MapQuestStep } from "./map-format";

export type QuestState = { status: "active" | "ready" | "done"; step: number; n: number };
export type QuestStates = Record<string, QuestState>;

export type QuestEvent =
  | { t: "kill"; species: string }
  | { t: "gather"; node: string }
  | { t: "goto"; tx: number; ty: number }
  | { t: "talk"; npcId: string };

export const qkey = (mapId: string, questId: string) => `${mapId}:${questId}`;

export function sanitizeQuestStates(raw: unknown): QuestStates {
  const out: QuestStates = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, Partial<QuestState>>)) {
    if (!v || typeof k !== "string" || k.length > 140) continue;
    if (v.status !== "active" && v.status !== "ready" && v.status !== "done") continue;
    out[k] = { status: v.status, step: Math.max(0, Math.floor(Number(v.step)) || 0), n: Math.max(0, Math.floor(Number(v.n)) || 0) };
  }
  return out;
}

export const turnInOf = (q: MapQuest) => q.turnIn || q.giver;

export function stateOf(states: QuestStates, mapId: string, q: MapQuest): QuestState | undefined {
  return states[qkey(mapId, q.id)];
}

export function isDone(states: QuestStates, mapId: string, questId: string): boolean {
  return states[qkey(mapId, questId)]?.status === "done";
}

/** Quests this NPC can hand out right now. */
export function offerable(map: MapFile, npcId: string, states: QuestStates): MapQuest[] {
  return (map.quests ?? []).filter((q) => q.giver === npcId && !stateOf(states, map.id, q) && (!q.requires || isDone(states, map.id, q.requires)));
}

/** Quests being worked on (not yet handed in), optionally only those this NPC is involved in. */
export function openQuests(map: MapFile, states: QuestStates, npcId?: string): MapQuest[] {
  return (map.quests ?? []).filter((q) => {
    const s = stateOf(states, map.id, q);
    if (!s || s.status === "done") return false;
    return !npcId || q.giver === npcId || turnInOf(q) === npcId || q.steps.some((st) => (st.type === "talk" && st.npcId === npcId) || (st.type === "bring" && (st.npcId || turnInOf(q)) === npcId));
  });
}

export function accept(map: MapFile, questId: string, states: QuestStates): boolean {
  const q = map.quests?.find((x) => x.id === questId);
  if (!q || stateOf(states, map.id, q)) return false;
  if (q.requires && !isDone(states, map.id, q.requires)) return false;
  states[qkey(map.id, q.id)] = { status: q.steps.length ? "active" : "ready", step: 0, n: 0 };
  return true;
}

export type Ctx = { npcName: (id: string) => string; itemName: (id: string) => string; speciesName: (id: string) => string; placeName?: (tx: number, ty: number) => string | null };

export function stepText(step: MapQuestStep, q: MapQuest, c: Ctx, n = 0): string {
  const hint = step.hint ? ` ${step.hint}` : "";
  switch (step.type) {
    case "talk": return `Talk to ${c.npcName(step.npcId)}.${hint}`;
    case "bring": return `Bring ${step.count} ${c.itemName(step.itemId)} to ${c.npcName(step.npcId || turnInOf(q))}.${hint}`;
    case "kill": return `Defeat ${step.species ? c.speciesName(step.species) : "foes"}: ${Math.min(n, step.count)}/${step.count}.${hint}`;
    case "gather": return `Gather from ${step.node === "tree" ? "trees" : step.node === "ore" ? "ore veins" : step.node === "fish" ? "fishing spots" : "mushroom patches"}: ${Math.min(n, step.count)}/${step.count}.${hint}`;
    case "goto": {
      const place = c.placeName?.(step.tx, step.ty);
      return place ? `Travel to ${place} (${step.tx}, ${step.ty}).${hint}` : `Travel to tile ${step.tx}, ${step.ty}.${hint}`;
    }
  }
}

/** One line per step with a marker, for the quest log. */
export function progressLines(q: MapQuest, s: QuestState, c: Ctx): string[] {
  const lines = q.steps.map((st, i) => `${i < s.step || s.status !== "active" ? "[x]" : i === s.step ? "[ ]" : "[-]"} ${stepText(st, q, c, i === s.step ? s.n : 0)}`);
  if (s.status === "ready") lines.push(`[ ] Report to ${c.npcName(turnInOf(q))}.`);
  return lines;
}

export type Advance = { changed: boolean; ready: boolean; consumed: { itemId: string; count: number } | null };

/** Applies one event to one active quest. Returns what happened. `bag` is only read (bring steps). */
export function advance(q: MapQuest, s: QuestState, ev: QuestEvent, bag: Record<string, number> = {}): Advance {
  const none: Advance = { changed: false, ready: false, consumed: null };
  if (s.status !== "active") return none;
  const step = q.steps[s.step];
  if (!step) return none;
  let done = false;
  let consumed: Advance["consumed"] = null;
  let changed = false;
  if (step.type === "talk" && ev.t === "talk" && ev.npcId === step.npcId) done = true;
  else if (step.type === "bring" && ev.t === "talk" && ev.npcId === (step.npcId || turnInOf(q)) && (bag[step.itemId] ?? 0) >= step.count) {
    done = true;
    consumed = { itemId: step.itemId, count: step.count };
  } else if (step.type === "kill" && ev.t === "kill" && (!step.species || step.species === ev.species)) {
    s.n++;
    changed = true;
    done = s.n >= step.count;
  } else if (step.type === "gather" && ev.t === "gather" && ev.node === step.node) {
    s.n++;
    changed = true;
    done = s.n >= step.count;
  } else if (step.type === "goto" && ev.t === "goto" && Math.hypot(ev.tx - step.tx, ev.ty - step.ty) <= (step.radius ?? 2)) done = true;
  if (!done) return { changed, ready: false, consumed: null };
  s.step++;
  s.n = 0;
  if (s.step >= q.steps.length) s.status = "ready";
  return { changed: true, ready: s.status === "ready", consumed };
}

/** Marks a ready quest as handed in when `npcId` is its turn-in. Returns the quest for rewards, or null. */
export function turnIn(map: MapFile, npcId: string, states: QuestStates, questId?: string): MapQuest | null {
  for (const q of map.quests ?? []) {
    if (questId && q.id !== questId) continue;
    const s = stateOf(states, map.id, q);
    if (s?.status === "ready" && turnInOf(q) === npcId) {
      s.status = "done";
      return q;
    }
  }
  return null;
}

/** Marker over an NPC's head: "!" has a quest to give, "?" has one to hand in. */
export function marker(map: MapFile, npc: MapNpc, states: QuestStates): "!" | "?" | "" {
  if ((map.quests ?? []).some((q) => stateOf(states, map.id, q)?.status === "ready" && turnInOf(q) === npc.id)) return "?";
  if (offerable(map, npc.id, states).length) return "!";
  return "";
}
