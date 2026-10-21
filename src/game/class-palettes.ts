/**
 * Class palette overrides made in Designer Mode > Character Redesigner.
 * Stored on this device; an exported JSON pack is how a redesigned skin ships in a future update
 * that switches old procedural skins (or recolors the Antifarea class sheets) to use these colours.
 */
export type ClassPalette = {
  id: string; // class id
  skin: string;      // main skin
  skinDark: string;
  skinLight: string;
  hair: string;
  clothes: string;
  clothesDark: string;
  accent: string;
  updated: number;
};

export const PALETTE_KEY = "turbz-class-palettes-v1";

export function loadPalettes(): ClassPalette[] {
  try {
    const raw = localStorage.getItem(PALETTE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((p) => p && typeof p.id === "string") : [];
  } catch { return []; }
}

export function savePalettes(list: ClassPalette[]): boolean {
  try { localStorage.setItem(PALETTE_KEY, JSON.stringify(list)); return true; } catch { return false; }
}

export function paletteFor(classId: string): ClassPalette | undefined {
  return loadPalettes().find((p) => p.id === classId);
}
