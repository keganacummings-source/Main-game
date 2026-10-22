/**
 * Per-type colour palettes + sprite retinter.
 *
 * The "lost mechanic" — any custom enemy sprite can be shown as any TypeId by remapping its
 * pixel colours through the type's palette. The retinter identifies each sprite pixel's
 * closest match in the SOURCE type's palette (the colour the artist drew it in) and swaps
 * to the same slot of the TARGET type's palette.
 *
 * Palettes are ordered **lightest to darkest** (5 shades each). A pixel at palette slot 1
 * (the lightest highlight) in Ice (#c9ebf3) maps to slot 1 of Fire (#f8c450), slot 1 of
 * Void (#8a72d8), etc. Outlines (very dark pixels close to #140e0c) are always preserved,
 * so the silhouette stays crisp.
 */
import type { TypeId } from "./content";

/** Five shades per type, light → dark. Pixels in a design's native type map to the same slot in another type. */
export const TYPE_PALETTE: Record<TypeId, string[]> = {
  normal:   ["#f0e2c8", "#dbc5a4", "#c4ac87", "#a89880", "#7a6e5c"],
  fire:     ["#f8c450", "#f2a53a", "#e25a32", "#c4473a", "#97442b"],
  water:    ["#a8e1d2", "#89d2c0", "#5aa88e", "#3a7eb8", "#24557f"],
  earth:    ["#d5b878", "#b89a56", "#8a6a3a", "#6a4a28", "#4a3220"],
  air:      ["#b2e6d8", "#9ad8c8", "#80c2b1", "#6fae9f", "#4e8878"],
  electric: ["#fde912", "#f2d43a", "#decd17", "#b9a12d", "#8c7922"],
  ice:      ["#c9ebf3", "#9ad0ff", "#5a9ad8", "#3a7eb8", "#2a5a92"],
  void:     ["#8a72d8", "#6a4cff", "#5a40dd", "#4b32c8", "#2f1943"],
  light:    ["#fff8c0", "#fff1a8", "#f0e2c8", "#d5c088", "#a89860"],
  spirit:   ["#dfc9f3", "#c9a6e8", "#a888c8", "#8a6ba8", "#5a4a78"],
  ghoul:    ["#b89cd8", "#8d72a8", "#705a85", "#5a4870", "#3a2e4a"],
};

const OUTLINE = "#140e0c";          // the universal dark outline — never remapped
const OUTLINE_RGB: [number, number, number] = [0x14, 0x0e, 0x0c];
const OUTLINE_DIST = 32;             // any pixel within this many units of the outline stays as outline

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const s = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function dist(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}
function isOutline(rgb: [number, number, number]): boolean {
  return dist(rgb, OUTLINE_RGB) < OUTLINE_DIST * OUTLINE_DIST;
}

/** Precompute each palette's parsed RGB rows so the hot loop stays cheap. */
const PARSED: Record<TypeId, [number, number, number][]> = Object.fromEntries(
  Object.entries(TYPE_PALETTE).map(([k, cols]) => [k, cols.map(parseHex)]),
) as Record<TypeId, [number, number, number][]>;

/** Nearest-slot index in a palette, 0..4. */
function nearestSlot(rgb: [number, number, number], palette: [number, number, number][]): number {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const d = dist(rgb, palette[i]);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/**
 * Return a copy of `pixels` with every colour remapped from the source type's palette to the
 * target type's. Nulls (transparent) and outline-dark pixels pass through unchanged.
 *
 * Memoised per (fromType, toType, pixel colour) in a per-call map so a sprite with the same
 * colour used in 100 places only computes it once.
 */
export function retintPixels(pixels: readonly (string | null)[], fromType: TypeId, toType: TypeId): (string | null)[] {
  if (fromType === toType) return pixels.slice();
  const from = PARSED[fromType];
  const to = TYPE_PALETTE[toType];
  if (!from || !to) return pixels.slice();
  const cache = new Map<string, string>();
  return pixels.map((p) => {
    if (!p) return null;
    const cached = cache.get(p);
    if (cached) return cached;
    const rgb = parseHex(p);
    if (isOutline(rgb)) { cache.set(p, p); return p; }
    const slot = nearestSlot(rgb, from);
    const out = to[slot] ?? p;
    cache.set(p, out);
    return out;
  });
}
