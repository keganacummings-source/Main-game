/**
 * Quest Board: the game's only quest system. Ten generated contracts that refresh every 30 minutes.
 *
 * Pure logic, no engine dependency. The engine owns the calls (see the quest-board methods on
 * TurbzGame) and the board lives on the save as `save.board`, so accepted contracts and their
 * progress survive reloads and sync with the cloud save.
 *
 * A contract has one to three objectives that all count at once (kill 20 fire foes AND mine 10 ore),
 * some with a condition (at night, inside a dungeon, elite foes only). You can run up to
 * MAX_ACTIVE contracts at a time. Rewards are paid in "kills' worth" of kyo at your level, a share
 * of a level's XP, and, from Hard up, gear, enchantments and supplies.
 *
 * Each board is generated from a seed (player + 30-minute period + reroll count), so a reload
 * shows the same ten contracts and a reroll shows a new set.
 */
import { MONSTERS, TYPES, mulberry32, type Rng, type TypeId } from "./content";

export const BOARD_VERSION = 2;
export const BOARD_PERIOD_MS = 30 * 60 * 1000;
export const BOARD_SLOTS = 10;
export const MAX_ACTIVE = 3;

export type BoardKind =
  | "kills" // defeat any foes
  | "kill_type" // defeat foes of one element
  | "kill_species" // defeat one named monster
  | "elite" // defeat rare-or-better foes (rarity 2+)
  | "boss" // defeat boss foes
  | "dungeon" // clear a dungeon (defeat its guardian)
  | "witch" // defeat rival witches
  | "ore" // mine ore deposits
  | "tree" // fell trees
  | "shroom" // pick mushroom patches
  | "fish" // land fish
  | "catch" // befriend spirits
  | "craft"; // craft at a campfire

/** A condition on a kill objective. */
export type BoardCond = "night" | "dungeon" | null;
export type Tier = "easy" | "normal" | "hard" | "elite" | "legend";

export type BoardStep = { kind: BoardKind; target?: string; need: number; cond?: BoardCond };

/** What finishing pays. Kyo and XP are fixed when the contract is posted; gear rolls at your level when paid. */
export type BoardReward = {
  kyo: number;
  /** Share of the XP needed for your current level. */
  xpShare: number;
  /** A gear piece of at least this quality, rolled at your level. */
  gear?: "fine" | "rare" | "epic" | "legendary" | null;
  /** Enchantment(s) added to your stash, rolled at your level. */
  enchants?: number;
  items?: Record<string, number>;
};

export type BoardQuest = {
  id: string;
  name: string;
  about: string;
  tier: Tier;
  steps: BoardStep[];
  reward: BoardReward;
  /** Back-compat for old UI and logs: the first objective's kind and the total count. */
  kind: BoardKind;
  target?: string;
  need: number;
  rewardKyo: number;
};

export type BoardState = {
  version: number;
  /** Which 30-minute window this board belongs to. */
  period: number;
  rerolls: number;
  quests: BoardQuest[];
  /** Accepted contracts, oldest first (up to MAX_ACTIVE). */
  active: string[];
  /** Progress per contract id, one number per objective. */
  progress: Record<string, number[]>;
  /** Counts replacement contracts, so each one rolls differently. */
  serial: number;
  /** Lifetime contracts finished (drives the streak bonus). */
  done?: number;
};

/** The slice of the save the board reads and writes. */
export type BoardHost = { name: string; seed: number; level: number; kyo: number; board?: BoardState; hardcore?: boolean };

export type BoardStepView = BoardStep & { label: string; progress: number; done: boolean };
export type BoardView = {
  id: string;
  name: string;
  about: string;
  kind: BoardKind;
  tier: Tier;
  rewardKyo: number;
  reward: BoardReward;
  rewardLines: string[];
  steps: BoardStepView[];
  need: number;
  progress: number;
  active: boolean;
  refreshIn: number;
};

export type BoardEventDetail = { species?: string; type?: string; boss?: boolean; rarity?: number; night?: boolean; dungeon?: boolean; dungeonBoss?: boolean; witch?: boolean };

// ── Tables ──────────────────────────────────────────────────────────────────

export const KIND_WEIGHT: [BoardKind, number][] = [
  ["kills", 10],
  ["kill_type", 16],
  ["kill_species", 14],
  ["elite", 10],
  ["boss", 6],
  ["dungeon", 5],
  ["witch", 4],
  ["ore", 9],
  ["tree", 9],
  ["shroom", 7],
  ["fish", 7],
  ["catch", 5],
  ["craft", 5],
];

/** Count at level 1 for a single-objective Normal contract. */
export const BASE_NEED: Record<BoardKind, number> = {
  kills: 12, kill_type: 8, kill_species: 6, elite: 4, boss: 1, dungeon: 1, witch: 1,
  ore: 8, tree: 10, shroom: 6, fish: 6, catch: 2, craft: 4,
};

/** How many ordinary kills one unit is worth (sets the pay). */
export const UNIT_WORTH: Record<BoardKind, number> = {
  kills: 1, kill_type: 1.4, kill_species: 1.8, elite: 4, boss: 35, dungeon: 45, witch: 30,
  ore: 1.3, tree: 1, shroom: 1.6, fish: 1.5, catch: 12, craft: 2.5,
};

/** Which kinds need a level before they show up. */
export const KIND_MIN_LEVEL: Partial<Record<BoardKind, number>> = { boss: 5, dungeon: 8, witch: 10, elite: 4 };

export const TIER_WEIGHT: [Tier, number][] = [
  ["easy", 26],
  ["normal", 34],
  ["hard", 24],
  ["elite", 12],
  ["legend", 4],
];
export const TIER_STEPS: Record<Tier, [number, number]> = { easy: [1, 1], normal: [1, 2], hard: [2, 2], elite: [2, 3], legend: [3, 3] };
export const TIER_NEED: Record<Tier, number> = { easy: 0.6, normal: 1, hard: 1.4, elite: 1.9, legend: 2.6 };
/** Pay multiplier on the kills' worth: harder contracts pay much more than their size. */
export const TIER_PAY: Record<Tier, number> = { easy: 1.6, normal: 2, hard: 2.6, elite: 3.3, legend: 4.5 };
/** Share of the current level's XP. */
export const TIER_XP_SHARE: Record<Tier, number> = { easy: 0.08, normal: 0.15, hard: 0.28, elite: 0.45, legend: 0.75 };
/** Skill XP for finishing, by tier. */
export const TIER_XP: Record<Tier, number> = { easy: 12, normal: 18, hard: 28, elite: 45, legend: 70 };
/** Guaranteed gear quality by tier (Normal is a coin flip for a Fine piece). */
export const TIER_GEAR: Record<Tier, BoardReward["gear"]> = { easy: null, normal: null, hard: "rare", elite: "epic", legend: "legendary" };
export const TIER_ENCHANTS: Record<Tier, number> = { easy: 0, normal: 0, hard: 0, elite: 1, legend: 2 };
/** Condition multipliers: harder to do, so it pays more. */
export const COND_PAY: Record<string, number> = { night: 1.35, dungeon: 1.5 };

const KIND_LEAD: Record<BoardKind, string[]> = {
  kills: ["Cull", "Blood Tithe", "Lantern Patrol", "Border Sweep", "The Long Hunt"],
  kill_type: ["Element Purge", "Wrong Weather", "Spark and Ash", "Against the Grain"],
  kill_species: ["Wanted", "Named Quarry", "A Grudge Settled", "Pest Notice"],
  elite: ["Big Game", "Trophy Work", "The Strong Ones", "Cream of the Wild"],
  boss: ["Crown Breaker", "Giant's Toll", "Kill the King", "Champion's Mark"],
  dungeon: ["Deep Delve", "Into the Rift", "Clear the Dark", "Guardian's End"],
  witch: ["Witch Hunt", "Rival's Ruin", "Coven Breaker", "The Other Witch"],
  ore: ["Deep Vein", "Ironwork", "Ore Run"],
  tree: ["Timber Order", "Axe Season", "Woodcutter's Day"],
  shroom: ["Spore Run", "Fairy Ring", "Herb Run"],
  fish: ["Lines Out", "Quiet Water", "Net Debt"],
  catch: ["Spirit Courtship", "Lantern Bait", "Gentle Hands"],
  craft: ["Fireside Work", "Hearth Orders", "Stocking Up"],
};
const TIER_TAIL: Record<Tier, string[]> = {
  easy: [""], normal: ["", " II"], hard: [": Hard Road", ": Full Ledger", " III"], elite: [": Elite Writ", ": Black Seal", ": Iron Writ"], legend: [": Legend", ": The Last Page", ": Crowned"],
};

// ── Helpers ─────────────────────────────────────────────────────────────────

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
const KILL_KINDS = new Set<BoardKind>(["kills", "kill_type", "kill_species", "elite"]);

/** The kyo a normal kill pays at this level. Mirrors balance.killKyo (kept local so this module stays pure). */
export function boardKillKyo(level: number): number {
  return 2 + Math.max(1, level) * 0.7;
}

export function stepLabel(st: BoardStep): string {
  const n = st.need;
  const s = n === 1 ? "" : "s";
  const cond = st.cond === "night" ? " at night" : st.cond === "dungeon" ? " inside a dungeon" : "";
  switch (st.kind) {
    case "kills": return `Defeat ${n} foe${s}${cond}`;
    case "kill_type": return `Defeat ${n} ${TYPES[st.target as TypeId]?.name ?? st.target}-type foe${s}${cond}`;
    case "kill_species": { const name = MONSTERS.find((m) => m.id === st.target)?.name ?? st.target; return `Defeat ${n} ${name}${cond}`; }
    case "elite": return `Defeat ${n} rare-or-better foe${s}${cond}`;
    case "boss": return n === 1 ? `Defeat a boss${cond}` : `Defeat ${n} bosses${cond}`;
    case "dungeon": return n === 1 ? "Clear a dungeon (defeat its guardian)" : `Clear ${n} dungeons`;
    case "witch": return n === 1 ? "Defeat a rival witch" : `Defeat ${n} rival witches`;
    case "ore": return `Mine ${n} ore deposit${s}`;
    case "tree": return `Fell ${n} tree${s}`;
    case "shroom": return `Pick ${n} mushroom patch${n === 1 ? "" : "es"}`;
    case "fish": return `Land ${n} catch${n === 1 ? "" : "es"}`;
    case "catch": return `Befriend ${n} spirit${s}`;
    case "craft": return `Craft ${n} item${s} at a campfire`;
  }
}

export function rewardLines(r: BoardReward): string[] {
  const out = [`${r.kyo.toLocaleString()} kyo`, `${Math.round(r.xpShare * 100)}% of a level`];
  if (r.gear) out.push(`${r.gear[0]!.toUpperCase()}${r.gear.slice(1)}+ gear piece`);
  if (r.enchants) out.push(`${r.enchants} enchantment${r.enchants === 1 ? "" : "s"}`);
  for (const [id, n] of Object.entries(r.items ?? {})) if (n > 0) out.push(`${n}× ${id.replace(/_/g, " ")}`);
  return out;
}

function rollStep(rng: Rng, lv: number, kind: BoardKind, tier: Tier, share: number): BoardStep {
  const step: BoardStep = { kind, need: 1 };
  if (kind === "kill_type") step.target = pick(rng, MONSTER_TYPES);
  if (kind === "kill_species") step.target = pick(rng, MONSTERS).id;
  const scale = 1 + Math.min(lv, 150) * 0.012;
  let need = Math.max(1, Math.round(BASE_NEED[kind] * TIER_NEED[tier] * scale * share * (0.85 + rng() * 0.3)));
  if (kind === "boss") need = tier === "legend" ? 3 : tier === "elite" ? 2 : 1;
  if (kind === "dungeon") need = tier === "legend" ? 2 : 1;
  if (kind === "witch") need = tier === "legend" ? 3 : tier === "elite" ? 2 : 1;
  if (kind === "catch") need = Math.min(4, need);
  step.need = need;
  // Hard and up: kill objectives may need to be done at night or inside a dungeon.
  if (KILL_KINDS.has(kind) && (tier === "hard" || tier === "elite" || tier === "legend") && rng() < 0.4) step.cond = rng() < 0.55 ? "night" : "dungeon";
  return step;
}

function rollQuest(rng: Rng, level: number, id: string, kinds: [BoardKind, number][], hardcore: boolean): BoardQuest {
  const lv = Math.max(1, level | 0);
  const tier = weighted(rng, TIER_WEIGHT.filter(([t]) => t !== "legend" || lv >= 15));
  const [lo, hi] = TIER_STEPS[tier];
  const count = lo + Math.floor(rng() * (hi - lo + 1));
  const steps: BoardStep[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (steps.length < count && guard++ < 40) {
    const kind = weighted(rng, kinds);
    // Several objectives share the work: each is a little smaller than a lone one.
    const st = rollStep(rng, lv, kind, tier, count === 1 ? 1 : count === 2 ? 0.75 : 0.62);
    const key = `${st.kind}:${st.target ?? ""}`;
    if (used.has(key) || (st.kind === "dungeon" && steps.some((x) => x.kind === "boss"))) continue;
    used.add(key);
    steps.push(st);
  }
  const k = boardKillKyo(lv);
  const worth = steps.reduce((sum, st) => sum + st.need * UNIT_WORTH[st.kind] * (st.cond ? COND_PAY[st.cond] ?? 1 : 1), 0);
  const jitter = 0.9 + rng() * 0.2;
  const kyo = Math.max(10, Math.round((k * worth * TIER_PAY[tier] * (steps.length > 1 ? 1 + 0.15 * (steps.length - 1) : 1) * jitter) / 5) * 5);
  const items: Record<string, number> = {};
  if (tier !== "easy") items.big_potion = tier === "legend" ? 3 : tier === "elite" ? 2 : 1;
  if (tier === "elite" || tier === "legend") items.ghost_jar = tier === "legend" ? 2 : 1;
  if (hardcore && (tier === "hard" || tier === "elite" || tier === "legend")) items.trail_ration = 2;
  const reward: BoardReward = {
    kyo,
    xpShare: TIER_XP_SHARE[tier] * (steps.length > 1 ? 1 + 0.1 * (steps.length - 1) : 1),
    gear: TIER_GEAR[tier] ?? (tier === "normal" && rng() < 0.5 ? "fine" : null),
    enchants: TIER_ENCHANTS[tier] || undefined,
    items: Object.keys(items).length ? items : undefined,
  };
  const lead = pick(rng, KIND_LEAD[steps[0]!.kind]);
  const name = `${lead}${pick(rng, TIER_TAIL[tier])}`;
  const about = steps.map(stepLabel).join(" · ") + ".";
  return { id, name, about, tier, steps, reward, kind: steps[0]!.kind, target: steps[0]!.target, need: steps.reduce((a, st) => a + st.need, 0), rewardKyo: kyo };
}

function kindTable(level: number): [BoardKind, number][] {
  const lv = Math.max(1, level | 0);
  return KIND_WEIGHT.filter(([k]) => lv >= (KIND_MIN_LEVEL[k] ?? 1));
}

/**
 * Ten contracts, no two built on the same first objective. `carry` are contracts the player already
 * accepted; they keep their slots across a refresh.
 */
export function generateBoard(seed: number, level: number, idPrefix: string, carry: BoardQuest[] = [], hardcore = false): BoardQuest[] {
  const rng = mulberry32(seed);
  const out: BoardQuest[] = [...carry];
  const seen = new Set<string>(out.map((q) => `${q.kind}:${q.target ?? ""}:${q.tier}`));
  const table = kindTable(level);
  let i = 0;
  let guard = 0;
  while (out.length < BOARD_SLOTS && guard++ < 300) {
    const q = rollQuest(rng, level, `${idPrefix}_${i}`, table, hardcore);
    const key = `${q.kind}:${q.target ?? ""}:${q.tier}`;
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
  const keep = old ? old.quests.filter((q) => old.active.includes(q.id)) : [];
  const quests = generateBoard(seedFor(host, period, rerolls), host.level, `bq${period}r${rerolls}`, keep, !!host.hardcore);
  const progress: Record<string, number[]> = {};
  for (const q of keep) progress[q.id] = old?.progress[q.id] ?? q.steps.map(() => 0);
  return { version: BOARD_VERSION, period, rerolls, quests, active: keep.map((q) => q.id), progress, serial: 0, done: old?.done ?? 0 };
}

function valid(b: unknown): b is BoardState {
  const s = b as BoardState | undefined;
  return !!s && s.version === BOARD_VERSION && typeof s.period === "number" && Array.isArray(s.quests) && Array.isArray(s.active) && typeof s.progress === "object" && !!s.progress
    && s.quests.every((q) => q && Array.isArray(q.steps) && q.steps.length > 0 && !!q.reward);
}

/** The current board, generating or refreshing it when the 30-minute window has moved on. Old (v1) boards are replaced. */
export function ensureBoard(host: BoardHost, now: number): BoardState {
  const period = boardPeriod(now);
  const have = valid(host.board) ? host.board : undefined;
  if (!have) host.board = buildBoard(host, period, 0);
  else if (have.period !== period) host.board = buildBoard(host, period, 0, have);
  return host.board as BoardState;
}

/** A reroll costs about eight kills' kyo at your level. */
export function rerollCost(level: number): number {
  return Math.round((boardKillKyo(level) * 8 + 20) / 5) * 5;
}

/** Replace the whole board with a fresh random set (accepted contracts stay). The caller charges `rerollCost`. */
export function rerollBoard(host: BoardHost, now: number): BoardState {
  const cur = ensureBoard(host, now);
  host.board = buildBoard(host, cur.period, cur.rerolls + 1, cur);
  return host.board;
}

export function acceptContract(st: BoardState, id: string): BoardQuest | null {
  const q = st.quests.find((x) => x.id === id);
  if (!q || st.active.includes(id) || st.active.length >= MAX_ACTIVE) return null;
  st.active.push(id);
  st.progress[id] = st.progress[id] ?? q.steps.map(() => 0);
  return q;
}

/** Drop one accepted contract (or the oldest when no id is given). */
export function abandonContract(st: BoardState, id?: string): BoardQuest | null {
  const qid = id ?? st.active[0];
  const q = qid ? st.quests.find((x) => x.id === qid) ?? null : null;
  if (!q) return null;
  st.active = st.active.filter((x) => x !== q.id);
  delete st.progress[q.id];
  return q;
}

export function stepMatches(step: BoardStep, kind: BoardKind, d: BoardEventDetail): boolean {
  if (step.cond === "night" && !d.night) return false;
  if (step.cond === "dungeon" && !d.dungeon) return false;
  if (kind === "kills") {
    switch (step.kind) {
      case "kills": return true;
      case "kill_type": return d.type === step.target;
      case "kill_species": return d.species === step.target;
      case "elite": return (d.rarity ?? 0) >= 2 || !!d.boss;
      case "boss": return !!d.boss;
      case "dungeon": return !!d.dungeonBoss;
      case "witch": return !!d.witch;
      default: return false;
    }
  }
  return step.kind === kind;
}

/** A fresh random contract to take the place of one that was just finished. */
function replacementQuest(host: BoardHost, st: BoardState): BoardQuest | null {
  const have = new Set(st.quests.map((q) => `${q.kind}:${q.target ?? ""}:${q.tier}`));
  st.serial = (st.serial ?? 0) + 1;
  const rng = mulberry32(hashString(`${seedFor(host, st.period, st.rerolls)}|fill|${st.serial}`));
  for (let tries = 0; tries < 30; tries++) {
    const q = rollQuest(rng, host.level, `bq${st.period}r${st.rerolls}_f${st.serial}_${tries}`, kindTable(host.level), !!host.hardcore);
    if (!have.has(`${q.kind}:${q.target ?? ""}:${q.tier}`)) return q;
  }
  return null;
}

export type BoardHit = { quest: BoardQuest; progress: number[]; step: number; complete: boolean };

/**
 * Something happened in the world. Advances every accepted contract with a matching, unfinished
 * objective. Returns what changed (empty when nothing did). Finished contracts leave the board
 * and a replacement is posted.
 */
export function applyBoardEvent(host: BoardHost, st: BoardState, kind: BoardKind, detail: BoardEventDetail = {}): BoardHit[] {
  const hits: BoardHit[] = [];
  for (const id of [...st.active]) {
    const q = st.quests.find((x) => x.id === id);
    if (!q) { st.active = st.active.filter((x) => x !== id); continue; }
    const prog = st.progress[id] ?? (st.progress[id] = q.steps.map(() => 0));
    const i = q.steps.findIndex((s, k) => (prog[k] ?? 0) < s.need && stepMatches(s, kind, detail));
    if (i < 0) continue;
    prog[i] = (prog[i] ?? 0) + 1;
    const complete = q.steps.every((s, k) => (prog[k] ?? 0) >= s.need);
    hits.push({ quest: q, progress: [...prog], step: i, complete });
    if (complete) {
      st.quests = st.quests.filter((x) => x.id !== q.id);
      st.active = st.active.filter((x) => x !== q.id);
      delete st.progress[q.id];
      st.done = (st.done ?? 0) + 1;
      const fresh = replacementQuest(host, st);
      if (fresh) st.quests.push(fresh);
    }
  }
  return hits;
}

export function boardView(st: BoardState, now: number): BoardView[] {
  const refreshIn = Math.max(0, Math.floor(((st.period + 1) * BOARD_PERIOD_MS - now) / 1000));
  return st.quests.map((q) => {
    const on = st.active.includes(q.id);
    const prog = on ? st.progress[q.id] ?? [] : [];
    const steps = q.steps.map((s, k) => ({ ...s, label: stepLabel(s), progress: Math.min(s.need, prog[k] ?? 0), done: (prog[k] ?? 0) >= s.need }));
    return {
      id: q.id,
      name: q.name,
      about: q.about,
      kind: q.kind,
      tier: q.tier,
      rewardKyo: q.reward.kyo,
      reward: q.reward,
      rewardLines: rewardLines(q.reward),
      steps,
      need: steps.reduce((a, s) => a + s.need, 0),
      progress: steps.reduce((a, s) => a + s.progress, 0),
      active: on,
      refreshIn,
    };
  });
}
