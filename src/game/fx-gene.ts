import type { TypeId } from "./content";

/**
 * Every gear piece carries an FX gene: one number that decides how its effect looks.
 * Pattern, particle shape, accent element, speed, spin, size, density, height and shade
 * all come from it, so two pieces of the same element rarely look alike.
 */
export const FX_PATTERNS = [
  "orbit",
  "embers",
  "rain",
  "spiral",
  "ring",
  "sparkle",
  "wisps",
  "halo",
  "sigil",
  "shards",
  "comet",
  "helix",
  "petals",
  "chevrons",
  "pulse",
  "motes",
  // New patterns:
  "nova",
  "tendrils",
  "rune",
  "swarm",
  "ribbons",
  "flicker",
  "aurora",
  "void_rift",
] as const;
export type FxPattern = (typeof FX_PATTERNS)[number];

export const FX_SHAPES = ["dot", "plus", "diamond", "block", "streak", "star", "cross", "ring"] as const;
export type FxShape = (typeof FX_SHAPES)[number];

/** Elements that read well as a second colour next to each element. */
const ACCENTS: Record<TypeId, TypeId[]> = {
  normal: ["light", "earth", "spirit"],
  fire: ["light", "ghoul", "electric", "earth"],
  water: ["ice", "air", "spirit", "light"],
  earth: ["fire", "normal", "water", "ghoul"],
  air: ["light", "water", "spirit", "electric"],
  electric: ["light", "void", "air", "fire"],
  ice: ["water", "light", "air", "void"],
  void: ["spirit", "ghoul", "electric", "ice"],
  light: ["fire", "spirit", "electric", "air"],
  spirit: ["void", "light", "water", "ghoul"],
  ghoul: ["void", "fire", "earth", "spirit"],
};

export type FxGene = {
  pattern: FxPattern;
  shape: FxShape;
  accent: TypeId | null;
  /** 0.55–1.65: how fast the pattern moves. */
  speed: number;
  /** 1 or -1: spin direction. */
  dir: 1 | -1;
  /** 0.75–1.3: size of the pattern around the body. */
  radius: number;
  /** 0.7–1.35: how many particles. */
  density: number;
  /** -0.25–0.25: vertical offset as a share of body height. */
  lift: number;
  /** Which palette shade leads (1 mid, 2 light, 3 highlight). */
  shade: 1 | 2 | 3;
  /** 0–1: phase offset so matching pieces do not move in lockstep. */
  phase: number;
  /** 3–6: polygon sides for sigils, petals per bloom, comet tail length… */
  sides: number;
  /** A pulsing glow on top (fine and up roll it rarely, legendary often). */
  flare: boolean;
};

/** A stable 31-bit hash of a string (gear uid → gene for old saves). */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) & 0x7fffffff;
}

/** The gene stored on a piece, or one derived from its uid for gear rolled before genes existed. */
export function geneSeedOf(g: { fxGene?: number; uid?: string; fxSeed?: number; style?: number; slot?: string }): number {
  if (typeof g.fxGene === "number" && g.fxGene > 0) return g.fxGene;
  if (g.uid) return hashString(g.uid) || 1;
  return ((g.fxSeed ?? 0) * 7919 + (g.style ?? 0) * 104729 + (g.slot?.length ?? 0) * 31) || 1;
}

function bits(seed: number, salt: number): number {
  let x = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

const cache = new Map<string, FxGene>();

export function fxGene(seed: number, type: TypeId, quality: number): FxGene {
  const key = `${seed}|${type}|${quality}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pick = <T,>(list: readonly T[], salt: number) => list[Math.floor(bits(seed, salt) * list.length) % list.length]!;
  const accents = ACCENTS[type] ?? ACCENTS.normal;
  const gene: FxGene = {
    pattern: pick(FX_PATTERNS, 1),
    shape: pick(FX_SHAPES, 2),
    accent: bits(seed, 3) < 0.25 + quality * 0.06 ? pick(accents, 4) : null,
    speed: 0.55 + bits(seed, 5) * 1.1,
    dir: bits(seed, 6) < 0.5 ? 1 : -1,
    radius: 0.75 + bits(seed, 7) * 0.55,
    density: 0.7 + bits(seed, 8) * 0.65,
    lift: (bits(seed, 9) - 0.5) * 0.5,
    shade: (1 + Math.floor(bits(seed, 10) * 3)) as 1 | 2 | 3,
    phase: bits(seed, 11),
    sides: 3 + Math.floor(bits(seed, 12) * 4),
    flare: bits(seed, 13) < (quality >= 5 ? 0.7 : quality >= 4 ? 0.35 : quality >= 3 ? 0.12 : 0),
  };
  if (cache.size > 512) cache.clear();
  cache.set(key, gene);
  return gene;
}

/** A short player-facing name for a piece's effect, e.g. "Comet · Void accent". */
export function fxGeneLabel(gene: FxGene, accentName?: string): string {
  const name = gene.pattern.charAt(0).toUpperCase() + gene.pattern.slice(1).replace("_", " ");
  return accentName ? `${name} · ${accentName} accent` : name;
}

// ---------------------------------------------------------------------------
// Traits: where on the body a piece shows its effect, and the rare signature shapes
// ---------------------------------------------------------------------------

/**
 * Each slot owns a part of the body, so a full outfit spreads out instead of piling onto the chest.
 * Rare and better pieces may roll a signature in their slot: wings (chest), a tail (legs), a trail
 * (feet), a crown (head), a familiar (relic), or an imbue that adds a layer to your verses (weapon).
 * Everything else shows a small pattern at the piece's own spot.
 */
export type FxTraitKind = "aura" | "wings" | "tail" | "trail" | "crown" | "familiar" | "imbue";
export type FxTrait = { kind: FxTraitKind; style: number; size: number };

const SIGNATURE: Record<string, FxTraitKind> = { chest: "wings", legs: "tail", feet: "trail", head: "crown", relic: "familiar", weapon: "imbue" };
export const TRAIT_STYLES: Record<Exclude<FxTraitKind, "aura">, readonly string[]> = {
  wings: ["Feathered Wings", "Demon Wings", "Crystal Wings", "Spirit Wings", "Moth Wings", "Void Wings"],
  tail: ["Demon Tail", "Flame Whip", "Wisp Tail", "Orb Chain"],
  trail: ["Afterimage Trail", "Footprint Trail", "Ribbon Trail", "Spark Wake"],
  crown: ["Halo", "Horns", "Shard Crown", "Third Eye"],
  familiar: ["Orb Familiar", "Star Familiar", "Moon Familiar"],
  imbue: ["Echo Imbue", "Burst Imbue", "Sigil Imbue", "Comet Imbue"],
};
/** Chance that a piece of this quality rolls its slot's signature. Rare 45%, Epic 75%, Legendary always. */
export function signatureChance(quality: number): number {
  return quality >= 5 ? 1 : quality >= 4 ? 0.75 : quality >= 3 ? 0.45 : 0;
}

export function fxTrait(seed: number, slot: string, quality: number): FxTrait {
  const kind = SIGNATURE[slot];
  if (kind && bits(seed, 21) < signatureChance(quality)) {
    const styles = TRAIT_STYLES[kind as Exclude<FxTraitKind, "aura">];
    return { kind, style: Math.floor(bits(seed, 22) * styles.length) % styles.length, size: 0.85 + bits(seed, 23) * 0.35 + (quality >= 5 ? 0.15 : 0) };
  }
  return { kind: "aura", style: 0, size: 1 };
}

export function fxTraitLabel(t: FxTrait): string {
  if (t.kind === "aura") return "";
  return TRAIT_STYLES[t.kind][t.style] ?? "";
}
