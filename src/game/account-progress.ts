/**
 * Account progress: account level, account XP, perk points, perks and skills. They live on the account
 * (shared by TurboHunt and Hardcore, kept through death) and are copied into each witch's save.
 *
 * Perk points are worked out, never stored on their own: every account level past 1 earns
 * PERK_POINTS_PER_LEVEL, and every perk bought spends one. So points can never be lost when one copy of
 * the account is behind another, and buying a perk in one mode can no longer be undone (or doubled) by
 * the other mode's older copy.
 *
 * mergeAccountMeta joins two copies of the account record (this device's and the cloud's) field by field,
 * keeping the most progress in each, so a stale copy can never roll the account back.
 */
import { ENCHANT_BY_ID } from "./content";

export const PERK_POINTS_PER_LEVEL = 5;

type Perks = Record<string, number>;
type SkillRec = Record<string, { level: number; xp: number }>;

const num = (v: unknown, min = 0) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(min, n) : min;
};

/** Perk points every account level has paid out so far. */
export function perkPointsEarned(accountLevel: number): number {
  return Math.max(0, num(accountLevel, 1) - 1) * PERK_POINTS_PER_LEVEL;
}

/** Points the bought perks cost (one per purchase; a perk's step is how much one purchase adds). */
export function perkPointsSpent(perks: Perks | null | undefined): number {
  let n = 0;
  for (const [id, v] of Object.entries(perks ?? {})) {
    const step = ENCHANT_BY_ID[id]?.perk?.step ?? 1;
    n += Math.ceil(num(v) / Math.max(1, step));
  }
  return n;
}

/** Points left to spend. */
export function perkPointsAvailable(accountLevel: number, perks: Perks | null | undefined): number {
  return Math.max(0, perkPointsEarned(accountLevel) - perkPointsSpent(perks));
}

/** The further along of two (level, xp) pairs: level first, then XP. */
export function furtherLevel(a: { level: number; xp: number }, b: { level: number; xp: number }): { level: number; xp: number } {
  const al = num(a.level, 1), bl = num(b.level, 1);
  if (al !== bl) return al > bl ? { level: al, xp: num(a.xp) } : { level: bl, xp: num(b.xp) };
  return { level: al, xp: Math.max(num(a.xp), num(b.xp)) };
}

function mergePerks(a: unknown, b: unknown): Perks {
  const out: Perks = {};
  for (const src of [a, b]) {
    if (!src || typeof src !== "object") continue;
    for (const [id, v] of Object.entries(src as Perks)) out[id] = Math.max(out[id] ?? 0, num(v));
  }
  return out;
}

function mergeSkills(a: unknown, b: unknown): SkillRec {
  const out: SkillRec = {};
  for (const src of [a, b]) {
    if (!src || typeof src !== "object") continue;
    for (const [id, v] of Object.entries(src as SkillRec)) {
      if (!v || typeof v !== "object") continue;
      out[id] = out[id] ? furtherLevel(out[id]!, v) : furtherLevel(v, v);
    }
  }
  return out;
}

function mergeShinies(a: unknown, b: unknown): unknown[] | undefined {
  if (!Array.isArray(a) && !Array.isArray(b)) return undefined;
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const list of [a, b]) {
    if (!Array.isArray(list)) continue;
    for (const s of list) {
      const uid = (s as { uid?: unknown })?.uid;
      if (typeof uid !== "string" || seen.has(uid)) continue;
      seen.add(uid);
      out.push(s);
    }
  }
  return out;
}

/**
 * Joins two copies of the account record. A copy from a later Ascension wins outright (Ascension wipes
 * progress on purpose). Otherwise every field keeps the most progress: the further account level, each
 * skill's further level, each perk's higher rank, the higher score, and every shiny either copy has.
 * Perk points are recomputed from the result.
 */
export function mergeAccountMeta(local: unknown, cloud: unknown): Record<string, unknown> | null {
  const a = local && typeof local === "object" ? (local as Record<string, unknown>) : null;
  const b = cloud && typeof cloud === "object" ? (cloud as Record<string, unknown>) : null;
  if (!a) return b ? { ...b } : null;
  if (!b) return { ...a };
  const asc = (m: Record<string, unknown>) => num(m.ascensions);
  if (asc(a) !== asc(b)) {
    const win = asc(a) > asc(b) ? a : b;
    const out = { ...win };
    const shinies = mergeShinies(a.shinies, b.shinies);
    if (shinies) out.shinies = shinies;
    return out;
  }
  const newer = num(a.savedAt) >= num(b.savedAt) ? a : b;
  const lv = furtherLevel({ level: num(a.accountLevel, 1), xp: num(a.accountXp) }, { level: num(b.accountLevel, 1), xp: num(b.accountXp) });
  const perks = mergePerks(a.perks, b.perks);
  const out: Record<string, unknown> = {
    ...newer,
    accountLevel: lv.level,
    accountXp: lv.xp,
    perks,
    perkPoints: perkPointsAvailable(lv.level, perks),
    skills: mergeSkills(a.skills, b.skills),
    accountScore: Math.max(num(a.accountScore), num(b.accountScore)),
    savedAt: Math.max(num(a.savedAt), num(b.savedAt)),
  };
  const shinies = mergeShinies(a.shinies, b.shinies);
  if (shinies) out.shinies = shinies;
  return out;
}

/** The newer of two saves of the same mode, by their savedAt stamp (the cloud's copy when neither has one). */
export function newerSave(cloud: unknown, local: unknown): unknown {
  const c = cloud && typeof cloud === "object" ? (cloud as { savedAt?: unknown; name?: unknown }) : null;
  const l = local && typeof local === "object" ? (local as { savedAt?: unknown; name?: unknown }) : null;
  if (!c) return l ?? null;
  if (!l) return c;
  return num(l.savedAt) > num(c.savedAt) ? l : c;
}
