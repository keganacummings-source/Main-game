/**
 * Crying Lady — "Lidia" paper-doll character model (revamped model + visible armor sets).
 *
 * Art is the hand-made Lidia sheet in /public/sprites/lidia/: a 9×4 grid of 64px cells (columns are
 * walk frames, rows are the four facings). It ships as separable layers:
 *   base.png, hair.png, brazalet.png   — drawn in their own colours
 *   suit_g / boot_g / glove_g / belt_g / shawl_g / hairband_g — greyscale, tinted at draw time
 *
 * Each gear slot maps to one clothing layer and is coloured independently by that piece's ELEMENT,
 * with RARITY escalating the look (worn = dull, fine/rare = vivid + trim, epic/legendary = glowing).
 * An empty slot hides its layer. A FULL set (all six slots worn) lights her up with an epic aura.
 */
import type { TypeId } from "./content";
import { TYPES } from "./content";
import { drawArmorOverlay, type ArmorPalette } from "./crying-armor";
import { drawGearFx } from "./gear-fx";

const SHEET_COLS = 9;
const SHEET_ROWS = 4;
const CELL = 64;

// Row per facing, matching the actual art: row 0 = back (up), row 1 = side facing left,
// row 2 = front (down), row 3 = side facing right.
const DIR_ROW: Record<"down" | "up" | "left" | "right", number> = { up: 0, left: 1, down: 2, right: 3 };

type LayerName = "base" | "hair" | "brazalet" | "suit" | "boot" | "glove" | "belt" | "shawl" | "hairband";
const COLOUR_LAYERS: LayerName[] = ["base", "hair", "brazalet"];
const GREY_LAYERS: LayerName[] = ["suit", "boot", "glove", "belt", "shawl", "hairband"];
const SRC: Record<LayerName, string> = {
  base: "/sprites/lidia/base.png",
  hair: "/sprites/lidia/hair.png",
  brazalet: "/sprites/lidia/brazalet.png",
  suit: "/sprites/lidia/suit_g.png",
  boot: "/sprites/lidia/boot_g.png",
  glove: "/sprites/lidia/glove_g.png",
  belt: "/sprites/lidia/belt_g.png",
  shawl: "/sprites/lidia/shawl_g.png",
  hairband: "/sprites/lidia/hairband_g.png",
};

// Which clothing layer each gear slot controls.
const SLOT_LAYER: Record<string, LayerName> = {
  chest: "suit", feet: "boot", weapon: "glove", legs: "belt", relic: "shawl", head: "hairband",
};
// Bottom-to-top draw order (matches the artist's layering).
const DRAW_ORDER: LayerName[] = ["base", "boot", "belt", "suit", "glove", "shawl", "brazalet", "hair", "hairband"];

const images: Partial<Record<LayerName, HTMLImageElement>> = {};
function layerImage(name: LayerName): HTMLImageElement | null {
  if (typeof document === "undefined") return null;
  let img = images[name];
  if (!img) {
    img = new Image();
    img.src = SRC[name];
    images[name] = img;
  }
  return img.complete && img.naturalWidth ? img : null;
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Element + rarity → tint colour and glow. */
function tintParams(type: TypeId, rarity: number): { color: string; glow: string | null; amt: number } {
  const base = TYPES[type]?.color ?? "#c8c0b0";
  // worn/common dull; fine/rare vivid; epic/legendary bright + glow.
  const color = rarity >= 4 ? shade(base, 35) : rarity >= 2 ? base : shade(base, -20);
  const amt = rarity >= 2 ? 0.9 : 0.72; // low rarity keeps more of the greyscale (a washed-out look)
  const glow = rarity >= 4 ? base : null;
  return { color, glow, amt };
}

function hslHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Cache of tinted greyscale layer sheets, keyed by layer+colour+amt. */
const tintCache = new Map<string, HTMLCanvasElement>();
function tintedSheet(name: LayerName, img: HTMLImageElement, color: string, amt: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const key = `${name}|${color}|${amt}`;
  const hit = tintCache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = img.naturalWidth || 576;
  c.height = img.naturalHeight || 256;
  const g = c.getContext("2d");
  if (!g) return null;
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0);
  // Tint toward the element colour, then lay the greyscale shading back so it keeps its form.
  g.globalCompositeOperation = "source-atop";
  g.globalAlpha = amt;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = "multiply";
  g.globalAlpha = 0.55;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = "lighten";
  g.globalAlpha = 0.18;
  g.drawImage(img, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  if (tintCache.size > 300) tintCache.clear();
  tintCache.set(key, c);
  return c;
}

type Piece = { slot: string; type: TypeId; quality: number; style?: number; fxSeed?: number };

/** Shape palette for the procedural armor overlay. Terraria-style: every piece paints with its OWN
 *  element colour, no palette-sharing between pieces. The main fill is the element colour (boosted
 *  for rarity), the trim is a complementary hue, and epic+ pieces get a glow in their element colour. */
function armorPalette(piece: Piece): ArmorPalette {
  const typeHex = TYPES[piece.type]?.color ?? "#c8c0b0";
  const color = piece.quality >= 2 ? shade(typeHex, 15) : shade(typeHex, -10);
  const trim = shade(typeHex, piece.quality >= 2 ? 60 : -40);
  const glow = piece.quality >= 4 ? typeHex : null;
  return { color, trim, glow };
}

/** Per-piece shape seed. Mix (style, slot, fxSeed) so same-slot pieces from different sets look
 *  different and same-slot pieces from the same set look the same (style is per-set, not per-slot). */
function pieceShapeVariant(piece: Piece): number {
  const style = (piece.style ?? 0) | 0;
  const seed = (piece.fxSeed ?? 0) | 0;
  return (Math.abs(style) * 97 + Math.abs(seed) * 11 + 1) | 0;
}

export function drawCryingLady(ctx: CanvasRenderingContext2D, a: any): void {
  const dir = ((a.direction ?? "down") as "up" | "down" | "left" | "right");
  const row = DIR_ROW[dir] ?? 2;
  const scale = (a.scale ?? 1) * (a.tall ?? 1);
  const drawScale = 0.72 * scale;
  const destW = CELL * drawScale, destH = CELL * drawScale;

  const moving = a.moving !== false && (a.walk ?? 0) > 0.05;
  const col = moving ? Math.floor(Math.abs(a.walk)) % SHEET_COLS : 0;
  const sx = (col % SHEET_COLS) * CELL, sy = (row % SHEET_ROWS) * CELL;

  // Feet near a.y, body centred on a.x.
  const dx = Math.round(a.x - destW / 2);
  const dy = Math.round(a.y - destH + 4 * drawScale);

  const pieces: Piece[] = (a.pieces ?? []) as Piece[];
  const worn = new Map<string, Piece>();
  for (const p of pieces) if (SLOT_LAYER[p.slot]) worn.set(p.slot, p);
  const fullSet = Object.keys(SLOT_LAYER).every((slot) => worn.has(slot));

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Shadow.
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.beginPath();
  ctx.ellipse(a.x, a.y - 1, 10 * scale, 3.3 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Full-set epic aura behind her.
  if (fullSet) {
    const t = a.time ?? a.walk ?? 0;
    const auraType = worn.get("chest")?.type ?? "light";
    const auraCol = TYPES[auraType as TypeId]?.color ?? "#fff1a8";
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.18 + 0.12 * pulse;
    ctx.fillStyle = auraCol;
    ctx.beginPath();
    ctx.ellipse(a.x, a.y - destH * 0.45, destW * 0.6, destH * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Per-piece Gear FX (Fine+ pieces only). Same system other classes use — authored for
  // an ~18-unit body, so we scale by ~2.5 to match the Lidia paper-doll's visible size.
  // `drawGearFx` reads `a.facing` as ±1 for horizontal mirroring, but Lidia drives direction
  // via `.direction`; synthesise the right facing so left-facing FX don't come out backwards.
  const fxT = a.time ?? a.walk ?? 0;
  const gearScale = scale * 2.5;
  const gearActor = (dir === "left" || dir === "right")
    ? { ...a, facing: dir === "left" ? -1 : 1 }
    : a;
  if (pieces.length && dir !== "up") drawGearFx(ctx, gearActor, fxT, gearScale, "back");

  const slotForLayer = (name: LayerName): string | null => {
    for (const [slot, ly] of Object.entries(SLOT_LAYER)) if (ly === name) return slot;
    return null;
  };

  for (const name of DRAW_ORDER) {
    const img = layerImage(name);
    if (!img) continue;
    if (COLOUR_LAYERS.includes(name)) {
      // Base body, hair and bracelet always show in their own colours.
      ctx.drawImage(img, sx, sy, CELL, CELL, dx, dy, destW, destH);
      continue;
    }
    // Clothing layer: only when its slot is worn. Terraria-style: each piece is tinted by
    // its OWN element + rarity, even when the five-piece set is complete — the completed set
    // is signalled by the Full Gear FX aura (drawn behind the body) rather than a shared palette.
    const slot = slotForLayer(name);
    const piece = slot ? worn.get(slot) : undefined;
    if (!piece) continue;
    const { color, glow, amt } = tintParams(piece.type, piece.quality);
    const sheet = tintedSheet(name, img, color, amt) ?? img;
    if (glow) {
      ctx.save();
      ctx.shadowColor = glow;
      ctx.shadowBlur = 6 * drawScale;
      ctx.drawImage(sheet, sx, sy, CELL, CELL, dx, dy, destW, destH);
      ctx.restore();
    } else {
      ctx.drawImage(sheet, sx, sy, CELL, CELL, dx, dy, destW, destH);
    }

    // V7+ per-piece armor silhouette (Terraria-style). Each worn piece paints its OWN overlay
    // in its OWN element colour — no palette-sharing between pieces. Wearing a chest from one
    // set and legs from another shows both silhouettes stacked, each in its own tint. When all
    // five pieces of a set are worn, the Full Gear FX aura (drawn behind the body) signals the
    // completed set; the piece visuals themselves don't change.
    if (slot && (slot === "head" || slot === "chest" || slot === "legs" || slot === "feet" || slot === "relic" || slot === "weapon")) {
      const shapeVariant = pieceShapeVariant(piece);
      const pal = armorPalette(piece);
      drawArmorOverlay(ctx, shapeVariant, slot, dir, pal, dx, dy, destW, destH);
    }
  }

  // Hurt flash: a white wash in her silhouette (masked via the base sprite).
  if (a.hurt > 0) {
    const base = layerImage("base");
    if (base) {
      const whiteKey = "base|#ffffff|flash";
      let wc = tintCache.get(whiteKey);
      if (!wc && typeof document !== "undefined") {
        wc = document.createElement("canvas");
        wc.width = base.naturalWidth; wc.height = base.naturalHeight;
        const g = wc.getContext("2d");
        if (g) { g.drawImage(base, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = "#ffffff"; g.fillRect(0, 0, wc.width, wc.height); }
        tintCache.set(whiteKey, wc);
      }
      if (wc) { ctx.globalAlpha = Math.min(0.55, a.hurt * 0.55); ctx.drawImage(wc, sx, sy, CELL, CELL, dx, dy, destW, destH); ctx.globalAlpha = 1; }
    }
  }

  ctx.restore();

  // Front-layer Gear FX (and back-layer when facing away) go after the body so trails,
  // wings, hats and crown-glows sit on top of the sprite.
  if (pieces.length) {
    if (dir === "up") drawGearFx(ctx, gearActor, fxT, gearScale, "back");
    drawGearFx(ctx, gearActor, fxT, gearScale, "front");
  }
}
