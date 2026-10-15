/**
 * Quest Board: ten randomly generated contracts that refresh every 30 minutes.
 *
 * Pure logic, no engine dependency. The engine owns the calls (see the quest-board
 * methods on TurbzGame) and the board lives on the save as `save.board`, so an accepted
 * contract and its progress survive reloads and sync with the cloud save.
 *
 * Each board is generated from a seed (player + 30-minute period + reroll count), so a
 * reload shows the same ten contracts instead of a fresh roll, and a reroll shows a new set.
 */
import { MONSTERS, TYPES, mulberry32, type Rng, type TypeId } from "./content";

export const BOARD_PERIOD_MS = 30 * 60 * 1000;
export const BOARD_SLOTS = 10;

export type BoardKind =
  | "kills" // defeat any foes
  | "kill_type" // defeat foes of one element
  | "kill_species" // defeat one named monster
  | "boss" // defeat boss foes
  | "ore" // mine ore deposits
  | "tree" // fell trees
  | "shroom" // pick mushroom patches
  | "fish" // land fish
  | "catch" // befriend spirits
  | "craft"; // craft at a campfire

export type Tier = "easy" | "normal" | "hard" | "elite";

export type BoardQuest = {
  id: string;
  name: string;
  about: string;
  kind: BoardKind;
  /** Element id for kill_type, monster id for kill_species. */
  target?: string;
  need: number;
  rewardKyo: number;
  tier: Tier;
};

export type BoardState = {
  /** Which 30-minute window this board belongs to. */
  period: number;
  rerolls: number;
  quests: BoardQuest[];
  activeId: string | null;
  progress: Record<string, number>;
  /** Counts replacement contracts, so each one rolls differently. */
  serial: number;
};

/** The slice of the save the board reads and writes. */
export type BoardHost = { name: string; seed: number; level: number; kyo: number; board?: BoardState };

export type BoardView = {
  id: string;
  name: string;
  about: string;
  kind: BoardKind;
  tier: Tier;
  rewardKyo: number;
  need: number;
  progress: number;
  active: boolean;
  refreshIn: number;
};

export type BoardEventDetail = { species?: string; type?: string; boss?: boolean };

// ── Generation ──────────────────────────────────────────────────────────────

export const KIND_WEIGHT: [BoardKind, number][] = [
  ["kills", 14],
  ["kill_type", 16],
  ["kill_species", 18],
  ["boss", 5],
  ["ore", 12],
  ["tree", 12],
  ["shroom", 9],
  ["fish", 10],
  ["catch", 8],
  ["craft", 6],
];

/** Count at level 1, normal tier. */
export const BASE_NEED: Record<BoardKind, number> = {
  kills: 4,
  kill_type: 3,
  kill_species: 3,
  boss: 1,
  ore: 4,
  tree: 5,
  shroom: 3,
  fish: 4,
  catch: 1,
  craft: 2,
};

/** Kyo per unit at level 1. Bosses and catches are rare, so they pay a lot per unit. */
export const UNIT_KYO: Record<BoardKind, number> = {
  kills: 9,
  kill_type: 11,
  kill_species: 12,
  boss: 140,
  ore: 8,
  tree: 6,
  shroom: 10,
  fish: 7,
  catch: 60,
  craft: 14,
};

export const TIER_WEIGHT: [Tier, number][] = [
  ["easy", 35],
  ["normal", 40],
  ["hard", 20],
  ["elite", 5],
];
export const TIER_NEED: Record<Tier, number> = { easy: 0.6, normal: 1, hard: 1.6, elite: 2.5 };
export const TIER_PAY: Record<Tier, number> = { easy: 0.9, normal: 1, hard: 1.25, elite: 1.6 };
/** Skill XP for finishing, by tier. */
export const TIER_XP: Record<Tier, number> = { easy: 12, normal: 18, hard: 28, elite: 45 };

const NAMES: Record<BoardKind, string[]> = {
  kills: ["Cull the Wilds", "Blood Tithe", "Lantern Patrol", "Clear the Road", "Hard Day", "Border Sweep", "The Long Hunt"],
  kill_type: ["Element Purge", "Wrong Weather", "Cold Work", "Spark and Ash", "Hollow Rites", "Against the Grain"],
  kill_species: ["Wanted", "Named Quarry", "A Grudge Settled", "Bounty Slip", "The Usual Suspects", "Pest Notice"],
  boss: ["Crown Breaker", "Giant's Toll", "The Big One", "Champion's Mark", "Kill the King"],
  ore: ["Deep Vein", "Pick and Pan", "Ironwork", "Rock Bottom", "Ore Run"],
  tree: ["Timber Order", "Fell Work", "Axe Season", "Kindling Tax", "Woodcutter's Day"],
  shroom: ["Cap Collector", "Spore Run", "Damp Work", "Fairy Ring", "Herb Run"],
  fish: ["Lines Out", "Quiet Water", "The Ledger Catch", "Net Debt", "Bank Fishing"],
  catch: ["Spirit Courtship", "A New Friend", "Lantern Bait", "Gentle Hands"],
  craft: ["Camp Cooking", "Fireside Work", "Hearth Orders", "Stocking Up"],
};

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function weighted<T>(rng: Rng, table: [T, number][]): T {
  let total = 0;
  for (const [, w] of table) total += w;
  let roll = rng() * total;
  for (const [v, w] of table) {
    roll -= w;
    if (roll < 0) return v;
  }
  return table[table.length - 1]![0];
}

function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]!;
}

const MONSTER_TYPES: TypeId[] = Array.from(new Set(MONSTERS.map((m) => m.type)));

function describe(kind: BoardKind, need: number, target?: string): string {
  const s = need === 1 ? "" : "s";
  switch (kind) {
    case "kills":
      return `Defeat ${need} foe${s} anywhere.`;
    case "kill_type":
      return `Defeat ${need} ${TYPES[target as TypeId]?.name ?? target}-type foe${s}.`;
    case "kill_species": {
      const name = MONSTERS.find((m) => m.id === target)?.name ?? target;
      return need === 1 ? `Defeat 1 ${name}.` : `Defeat ${need} ${name}.`;
    }
    case "boss":
      return need === 1 ? "Defeat a boss." : `Defeat ${need} bosses.`;
    case "ore":
      return `Mine ${need} ore deposit${s}.`;
    case "tree":
      return `Fell ${need} tree${s}.`;
    case "shroom":
      return `Pick ${need} mushroom patch${need === 1 ? "" : "es"}.`;
    case "fish":
      return `Land ${need} catch${need === 1 ? "" : "es"} at the water.`;
    case "catch":
      return `Befriend ${need} spirit${s}.`;
    case "craft":
      return `Craft ${need} item${s} at a campfire.`;
  }
}

/** One quest. `key` (kind + target) is used by the caller to keep a board varied. */
function rollQuest(rng: Rng, level: number, id: string, kind: BoardKind): BoardQuest {
  const lv = Math.max(1, Math.min(60, level | 0));
  const tier = weighted(rng, TIER_WEIGHT);
  let target: string | undefined;
  if (kind === "kill_type") target = pick(rng, MONSTER_TYPES);
  if (kind === "kill_species") target = pick(rng, MONSTERS).id;

  const scale = 1 + lv * 0.03;
  let need = Math.max(1, Math.round(BASE_NEED[kind] * TIER_NEED[tier] * scale));
  if (kind === "boss") need = tier === "elite" ? 2 : 1;
  if (kind === "catch") need = Math.min(3, need);

  const jitter = 0.9 + rng() * 0.2;
  const reward = UNIT_KYO[kind] * need * (1 + lv * 0.04) * TIER_PAY[tier] * jitter;
  return {
    id,
    name: pick(rng, NAMES[kind]),
    about: describe(kind, need, target),
    kind,
    target,
    need,
    rewardKyo: Math.max(5, Math.round(reward / 5) * 5),
    tier,
  };
}

/**
 * Ten contracts, no repeats of the same kind+target. `carry` is a contract the player
 * already accepted; it keeps its slot across a refresh.
 */
export function generateBoard(seed: number, level: number, idPrefix: string, carry?: BoardQuest | null): BoardQuest[] {
  const rng = mulberry32(seed);
  const out: BoardQuest[] = carry ? [carry] : [];
  const seen = new Set<string>(out.map((q) => `${q.kind}:${q.target ?? ""}`));
  const lv = Math.max(1, level | 0);
  let i = 0;
  let guard = 0;
  while (out.length < BOARD_SLOTS && guard++ < 200) {
    // Bosses are a mid-game thing: not offered below level 5.
    const table = KIND_WEIGHT.filter(([k]) => k !== "boss" || lv >= 5);
    const q = rollQuest(rng, level, `${idPrefix}_${i}`, weighted(rng, table));
    const key = `${q.kind}:${q.target ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
    i++;
  }
  return out;
}

// ── Board state ─────────────────────────────────────────────────────────────

export function boardPeriod(now: number): number {
  return Math.floor(now / BOARD_PERIOD_MS);
}

function seedFor(host: BoardHost, period: number, rerolls: number): number {
  return hashString(`${host.name}|${host.seed}|${period}|${rerolls}`);
}

function buildBoard(host: BoardHost, period: number, rerolls: number, old?: BoardState): BoardState {
  const active = old?.activeId ? old.quests.find((q) => q.id === old.activeId) ?? null : null;
  const quests = generateBoard(seedFor(host, period, rerolls), host.level, `bq${period}r${rerolls}`, active);
  return {
    period,
    rerolls,
    quests,
    activeId: active ? active.id : null,
    progress: active && old ? { [active.id]: old.progress[active.id] ?? 0 } : {},
    serial: 0,
  };
}

function valid(b: unknown): b is BoardState {
  const s = b as BoardState | undefined;
  return !!s && typeof s.period === "number" && Array.isArray(s.quests) && typeof s.progress === "object" && !!s.progress;
}

/** The current board, generating or refreshing it when the 30-minute window has moved on. */
export function ensureBoard(host: BoardHost, now: number): BoardState {
  const period = boardPeriod(now);
  const have = valid(host.board) ? host.board : undefined;
  if (!have) {
    host.board = buildBoard(host, period, 0);
  } else if (have.period !== period) {
    host.board = buildBoard(host, period, 0, have);
  }
  return host.board as BoardState;
}

export function rerollCost(level: number): number {
  return 25 + Math.max(1, level | 0) * 3;
}

/** Replace the whole board with a fresh random set. The caller charges `rerollCost`. */
export function rerollBoard(host: BoardHost, now: number): BoardState {
  const cur = ensureBoard(host, now);
  host.board = buildBoard(host, cur.period, cur.rerolls + 1);
  return host.board;
}

export function acceptContract(st: BoardState, id: string): BoardQuest | null {
  const q = st.quests.find((x) => x.id === id);
  if (!q) return null;
  st.activeId = id;
  st.progress[id] = st.progress[id] ?? 0;
  return q;
}

export function abandonContract(st: BoardState): BoardQuest | null {
  const q = st.activeId ? st.quests.find((x) => x.id === st.activeId) ?? null : null;
  if (q) delete st.progress[q.id];
  st.activeId = null;
  return q;
}

function matches(q: BoardQuest, kind: BoardKind, d: BoardEventDetail): boolean {
  if (kind === "kills") {
    // Every kill advances the generic kill, element, species and boss contracts.
    switch (q.kind) {
      case "kills":
        return true;
      case "kill_type":
        return d.type === q.target;
      case "kill_species":
        return d.species === q.target;
      case "boss":
        return !!d.boss;
      default:
        return false;
    }
  }
  return q.kind === kind;
}

/** A fresh random contract to take the place of one that was just finished. */
function replacementQuest(host: BoardHost, st: BoardState): BoardQuest | null {
  const lv = Math.max(1, host.level | 0);
  const have = new Set(st.quests.map((q) => `${q.kind}:${q.target ?? ""}`));
  const table = KIND_WEIGHT.filter(([k]) => k !== "boss" || lv >= 5);
  st.serial = (st.serial ?? 0) + 1;
  const rng = mulberry32(hashString(`${seedFor(host, st.period, st.rerolls)}|fill|${st.serial}`));
  for (let tries = 0; tries < 30; tries++) {
    const q = rollQuest(rng, lv, `bq${st.period}r${st.rerolls}_f${st.serial}`, weighted(rng, table));
    if (!have.has(`${q.kind}:${q.target ?? ""}`)) return q;
  }
  return null;
}

/**
 * Something happened in the world. Advances the active contract if it cares.
 * Returns what changed, or null when the active contract is unaffected.
 */
export function applyBoardEvent(
  host: BoardHost,
  st: BoardState,
  kind: BoardKind,
  detail: BoardEventDetail = {},
): { quest: BoardQuest; progress: number; complete: boolean } | null {
  const q = st.activeId ? st.quests.find((x) => x.id === st.activeId) : undefined;
  if (!q || !matches(q, kind, detail)) return null;
  const progress = (st.progress[q.id] ?? 0) + 1;
  if (progress >= q.need) {
    st.quests = st.quests.filter((x) => x.id !== q.id);
    st.activeId = null;
    delete st.progress[q.id];
    // Keep ten on the board: roll a new random contract in place of the finished one.
    const fresh = replacementQuest(host, st);
    if (fresh) st.quests.push(fresh);
    return { quest: q, progress: q.need, complete: true };
  }
  st.progress[q.id] = progress;
  return { quest: q, progress, complete: false };
}

export function boardView(st: BoardState, now: number): BoardView[] {
  const refreshIn = Math.max(0, Math.floor(((st.period + 1) * BOARD_PERIOD_MS - now) / 1000));
  return st.quests.map((q) => ({
    id: q.id,
    name: q.name,
    about: q.about,
    kind: q.kind,
    tier: q.tier,
    rewardKyo: q.rewardKyo,
    need: q.need,
    progress: st.activeId === q.id ? st.progress[q.id] ?? 0 : 0,
    active: st.activeId === q.id,
    refreshIn,
  }));
}
