/**
 * Ghost looks: how rarity and shiny palettes read on screen.
 *
 * Rarity (Common → Mythic) gives every ghost a colour wash over its sprite, a glow under it, its own
 * opacity, and from Rare up a gleam that sweeps across the body. Shiny ghosts trade the wash for one of
 * twelve palettes; Prism is the original rainbow lava lamp. Rarer ghosts are likelier to roll the rarer
 * palettes.
 *
 * Pure data and maths only (no DOM), so the tests and the wiki can read it.
 */
import type { Rng } from "./content";

export type RarityStyle = {
  id: number;
  name: string;
  /** Badge and text colour. */
  color: string;
  /** How strongly the colour washes over the sprite (0 = untouched). */
  wash: number;
  /** Glow under the ghost: 0 none, 1 strongest. */
  glow: number;
  /** Sprite opacity (ghosts are see-through; rarer ones are more solid). */
  alpha: number;
  /** A light band that sweeps across the body now and then. */
  gleam: boolean;
};

export const GHOST_RARITIES: readonly RarityStyle[] = [
  { id: 0, name: "Common", color: "#c8c0b0", wash: 0, glow: 0.15, alpha: 0.8, gleam: false },
  { id: 1, name: "Uncommon", color: "#6fd38a", wash: 0.2, glow: 0.3, alpha: 0.84, gleam: false },
  { id: 2, name: "Rare", color: "#5aa8ff", wash: 0.26, glow: 0.45, alpha: 0.88, gleam: true },
  { id: 3, name: "Epic", color: "#b06aff", wash: 0.32, glow: 0.6, alpha: 0.92, gleam: true },
  { id: 4, name: "Legendary", color: "#ffb341", wash: 0.36, glow: 0.78, alpha: 0.96, gleam: true },
  { id: 5, name: "Mythic", color: "#ff4d8a", wash: 0.4, glow: 1, alpha: 1, gleam: true },
];
export const MAX_GHOST_RARITY = GHOST_RARITIES.length - 1;
export const RARITY_NAMES = GHOST_RARITIES.map((r) => r.name);

export function clampRarity(r: number): number {
  return Math.max(0, Math.min(MAX_GHOST_RARITY, Math.floor(Number(r) || 0)));
}
export function rarityStyle(r: number): RarityStyle {
  return GHOST_RARITIES[clampRarity(r)]!;
}
export function rarityName(r: number): string {
  return rarityStyle(r).name;
}

/**
 * A ghost's rarity starts at the foe's (0–3). Epic ghosts can ascend to Legendary, Legendary to Mythic;
 * bosses ascend far more often, and a shiny gets one more chance to climb a tier.
 */
export function rollGhostRarity(base: number, rng: Rng, opts: { boss?: boolean; shiny?: boolean } = {}): number {
  let r = clampRarity(base);
  if (r >= 3 && rng() < (opts.boss ? 0.35 : 0.06)) r = 4;
  if (r >= 4 && rng() < (opts.boss ? 0.15 : 0.04)) r = 5;
  if (opts.shiny && rng() < 0.25) r = Math.min(MAX_GHOST_RARITY, r + 1);
  return r;
}

export type ShinyPalette = {
  id: string;
  name: string;
  /** 0 common … 3 very rare. Rarer ghosts lean towards higher tiers. */
  tier: number;
  /** "rainbow" cycles the whole hue wheel; "stops" drifts between its own colours. */
  kind: "rainbow" | "stops";
  stops: string[];
  /** Colour for badges and text. */
  badge: string;
};

export const SHINY_PALETTES: readonly ShinyPalette[] = [
  { id: "ember", name: "Ember", tier: 0, kind: "stops", stops: ["#ff5a1f", "#ffb03a", "#ffe08a", "#d8381f"], badge: "#ff9a3a" },
  { id: "tidal", name: "Tidal", tier: 0, kind: "stops", stops: ["#1fb5ff", "#3a7eff", "#9af0ff", "#1a62d0"], badge: "#5ac8ff" },
  { id: "verdant", name: "Verdant", tier: 0, kind: "stops", stops: ["#3fd36a", "#a8f05a", "#1f8a4a", "#e0ff9a"], badge: "#7ae07a" },
  { id: "rose", name: "Rosequartz", tier: 1, kind: "stops", stops: ["#ff7ab8", "#ffc0dc", "#e0407a", "#fff0f6"], badge: "#ff8ac4" },
  { id: "frost", name: "Frostbite", tier: 1, kind: "stops", stops: ["#bff6ff", "#7ad0ff", "#ffffff", "#5a8aff"], badge: "#a8e8ff" },
  { id: "gilded", name: "Gilded", tier: 1, kind: "stops", stops: ["#ffd84a", "#fff3b0", "#c8901a", "#ffeaa0"], badge: "#ffd84a" },
  { id: "toxic", name: "Toxic", tier: 2, kind: "stops", stops: ["#a8ff1f", "#3aff8a", "#e8ff5a", "#1fae3a"], badge: "#b8ff3a" },
  { id: "abyss", name: "Abyssal", tier: 2, kind: "stops", stops: ["#7a4aff", "#3a1f9a", "#c05aff", "#4a2fe0"], badge: "#9a6aff" },
  { id: "sunset", name: "Sunset", tier: 2, kind: "stops", stops: ["#ff5a7a", "#ffa04a", "#8a3aff", "#ffd06a"], badge: "#ff8a6a" },
  { id: "aurora", name: "Aurora", tier: 3, kind: "stops", stops: ["#3affc8", "#5a8aff", "#c05aff", "#8aff8a"], badge: "#5affd0" },
  { id: "eclipse", name: "Eclipse", tier: 3, kind: "stops", stops: ["#2b1b45", "#ffd84a", "#5a3a8a", "#fff1a8"], badge: "#e8c85a" },
  { id: "prism", name: "Prism", tier: 3, kind: "rainbow", stops: [], badge: "#ff7ae0" },
];
export const PALETTE_BY_ID: Record<string, ShinyPalette> = Object.fromEntries(SHINY_PALETTES.map((p) => [p.id, p]));
/** Ghosts from before palettes keep the rainbow they always had. */
export const DEFAULT_PALETTE = "prism";

export function shinyPalette(id: string | undefined | null): ShinyPalette {
  return (id && PALETTE_BY_ID[id]) || PALETTE_BY_ID[DEFAULT_PALETTE]!;
}

/** Odds weight of a palette for a ghost of this rarity. Common palettes fade as rarity climbs. */
export function paletteWeight(p: ShinyPalette, rarity: number): number {
  const r = clampRarity(rarity);
  const base = [8, 5, 3, 1.6][p.tier] ?? 1;
  return base * (1 + r * p.tier * 0.45) / (1 + r * (p.tier === 0 ? 0.25 : 0));
}

export function rollShinyPalette(rng: Rng, rarity: number): string {
  const total = SHINY_PALETTES.reduce((n, p) => n + paletteWeight(p, rarity), 0);
  let roll = rng() * total;
  for (const p of SHINY_PALETTES) {
    roll -= paletteWeight(p, rarity);
    if (roll <= 0) return p.id;
  }
  return SHINY_PALETTES[SHINY_PALETTES.length - 1]!.id;
}

/** Chance (0–1) a ghost of this rarity rolls this palette, for the UI and wiki. */
export function paletteOdds(id: string, rarity: number): number {
  const p = PALETTE_BY_ID[id];
  if (!p) return 0;
  const total = SHINY_PALETTES.reduce((n, x) => n + paletteWeight(x, rarity), 0);
  return paletteWeight(p, rarity) / total;
}

/** The colour a palette shows at time t (seconds), offset by i for blobs. */
export function paletteColor(p: ShinyPalette, t: number, i = 0, alpha = 1): string {
  if (p.kind === "rainbow" || !p.stops.length) return `hsla(${(t * 40 + i * 85) % 360}, 90%, 60%, ${alpha})`;
  const n = p.stops.length;
  const x = ((t * 0.35 + i * 0.37) % n + n) % n;
  const a = hexRgb(p.stops[Math.floor(x) % n]!), b = hexRgb(p.stops[(Math.floor(x) + 1) % n]!);
  const f = x - Math.floor(x);
  const mix = (k: number) => Math.round(a[k]! + (b[k]! - a[k]!) * f);
  return `rgba(${mix(0)},${mix(1)},${mix(2)},${alpha})`;
}

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
