/**
 * The Hardcore loot chest, a 16×16 pixel sprite drawn in the Enemy Designer (not a foe).
 * Each letter is a colour from CHEST_PALETTE; "." is empty.
 */
export const CHEST_PALETTE: Record<string, string> = {
  a: "#140e0c",
  b: "#fead34",
  c: "#47351a",
  d: "#604c2e",
  e: "#f2d43a",
  f: "#876026",
  g: "#9e7333",
  h: "#976e30",
  i: "#8a6a3a",
  j: "#845815",
};
export const CHEST_PIXELS: readonly string[] = [
  "................",
  "....aaabbaaa....",
  "...acccccccca...",
  "...adddddddda...",
  "...acddddddca...",
  "...aceeeeeeca...",
  "....aaaaaaaa....",
  "...afggbbggfa...",
  "...afghhhhgfa...",
  "...afghiihgfa...",
  "...ajgghhggja...",
  "...ajffffffja...",
  "...aaaaaaaaaa...",
  "................",
  "................",
  "................",
];

let cached: HTMLCanvasElement | null = null;
/** The chest painted once onto a 16×16 canvas. */
export function chestCanvas(): HTMLCanvasElement | null {
  if (cached) return cached;
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  CHEST_PIXELS.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = CHEST_PALETTE[row[x]!];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  cached = c;
  return c;
}
/** Lowest painted row, so the chest can stand on the ground. */
export const CHEST_BOTTOM = 12;
