/**
 * Autoplay tasks: what autoplay is allowed to do, and in what order it prefers to do it.
 *
 * The old system had eight on/off flags that were matched against a handful of skill ids by hand.
 * Two things went wrong with that. Skills nobody had mapped — magic, evasion, looting, every
 * element mastery — fell through to "walk at the nearest foe and hit it", so turning **Fight** off
 * barely changed anything: autoplay simply trained one of the unmapped skills and fought anyway.
 * And nothing covered trading or talking to townsfolk at all, so those could not be switched off.
 *
 * Here every skill belongs to exactly one task, and a task is the thing you switch on and off, so
 * "off" really means off. Order is yours too: autoplay works down your priority list and takes the
 * first task it can actually do right now, instead of always grinding whichever skill happened to
 * be the lowest level.
 */

export type AutoTaskId =
  | "combat" | "dungeon" | "spirits" | "mining" | "woodcutting"
  | "shroom" | "fishing" | "crafting" | "trading" | "social";

export type AutoTask = { id: AutoTaskId; label: string; about: string };

/** Every task, in the order a fresh character prefers them. */
export const AUTO_TASKS: readonly AutoTask[] = [
  { id: "combat", label: "Fight", about: "Hunt foes. Trains weapons, magic, evasion, looting and the element masteries." },
  { id: "dungeon", label: "Dungeons", about: "Travel to shrines and dungeon doors." },
  { id: "spirits", label: "Seek spirits", about: "Catch ghosts and keep the party." },
  { id: "mining", label: "Mine ore", about: "Work ore nodes." },
  { id: "woodcutting", label: "Chop wood", about: "Work trees." },
  { id: "shroom", label: "Forage", about: "Pick mushrooms and herbs." },
  { id: "fishing", label: "Fish", about: "Fish any shore it can reach." },
  { id: "crafting", label: "Craft", about: "Brew potions and cook food." },
  { id: "trading", label: "Trade", about: "Sell gathered materials." },
  { id: "social", label: "Talk", about: "Visit townsfolk." },
];

export const AUTO_TASK_IDS: readonly AutoTaskId[] = AUTO_TASKS.map((t) => t.id);
export const AUTO_TASK_BY_ID: Record<string, AutoTask> = Object.fromEntries(AUTO_TASKS.map((t) => [t.id, t]));

/**
 * Which task trains which skill.
 *
 * Anything not named here is trained by fighting — which is what the game already did, except now
 * it is written down, so turning Fight off genuinely stops all of it.
 */
const SKILL_TASK: Record<string, AutoTaskId> = {
  mining: "mining",
  woodcutting: "woodcutting",
  fishing: "fishing",
  shroom: "shroom",
  alchemy: "crafting",
  cooking: "crafting",
  catching: "spirits",
  ghostkeeping: "spirits",
  adventuring: "dungeon",
  trading: "trading",
  social: "social",
};

/** The task that trains this skill. Unmapped skills are trained by fighting. */
export function taskOfSkill(skillId: string): AutoTaskId {
  return SKILL_TASK[skillId] ?? "combat";
}

/** Every task switched on: what autoplay does before you tell it otherwise. */
export function allTasksOn(): Record<AutoTaskId, boolean> {
  return Object.fromEntries(AUTO_TASK_IDS.map((id) => [id, true])) as Record<AutoTaskId, boolean>;
}

/**
 * Cleans up a stored priority list: keeps the order you set, drops anything unknown, and adds any
 * task that is missing (a save made before a task existed) at the end in the default order.
 */
export function normalizePriority(raw: unknown): AutoTaskId[] {
  const seen = new Set<AutoTaskId>();
  const out: AutoTaskId[] = [];
  if (Array.isArray(raw)) {
    for (const v of raw) {
      const id = String(v) as AutoTaskId;
      if (AUTO_TASK_BY_ID[id] && !seen.has(id)) { seen.add(id); out.push(id); }
    }
  }
  for (const id of AUTO_TASK_IDS) if (!seen.has(id)) out.push(id);
  return out;
}

/** Moves a task one place up or down the list. Returns a new list; out-of-range moves change nothing. */
export function movePriority(list: AutoTaskId[], id: AutoTaskId, dir: -1 | 1): AutoTaskId[] {
  const from = list.indexOf(id);
  if (from < 0) return list;
  const to = from + dir;
  if (to < 0 || to >= list.length) return list;
  const out = list.slice();
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item!);
  return out;
}
