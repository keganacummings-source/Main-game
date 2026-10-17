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

const SHEET_COLS = 9;
const SHEET_ROWS = 4;
const CELL = 64;

// Row per facing. (Row 0 is the back/up view; row 3 is the front/down view.)
const DIR_ROW: Record<"down" | "up" | "left" | "right", number> = { up: 0, left: 1, right: 2, down: 3 };

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

/**
 * Per-SET unique outfit palette (only for this character). A worn set's `variant` seeds a distinct
 * two-tone scheme, and each slot takes a slightly different shade of it, so all 100 sets read as
 * their own cohesive, hunt-worthy design rather than a recolour of one element.
 */
const SLOT_ORDER = ["suit", "belt", "boot", "glove", "shawl", "hairband"];
function setLayerTint(variant: number, layer: LayerName): { color: string; glow: string | null; amt: number } {
  const hue = (variant * 47) % 360;
  const accent = (hue + 150) % 360; // complementary accent for trims/accessories
  const idx = Math.max(0, SLOT_ORDER.indexOf(layer));
  const accessory = layer === "shawl" || layer === "hairband" || layer === "glove";
  const h = accessory ? accent : hue;
  const sat = 55 + ((variant >> 2) % 25);
  const light = 48 + ((idx * 6 + (variant % 3) * 4) % 22) - 8; // spread slots across a tonal range
  return { color: hslHex(h, sat, Math.max(30, Math.min(70, light))), glow: hslHex(h, 90, 62), amt: 0.92 };
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

type Piece = { slot: string; type: TypeId; quality: number };

export function drawCryingLady(ctx: CanvasRenderingContext2D, a: any): void {
  const dir = ((a.direction ?? "down") as "up" | "down" | "left" | "right");
  const row = DIR_ROW[dir] ?? 3;
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
    // Clothing layer: only when its slot is worn. A full set gets its own unique per-set palette;
    // otherwise each piece is tinted by its element + rarity.
    const slot = slotForLayer(name);
    const piece = slot ? worn.get(slot) : undefined;
    if (!piece) continue;
    const { color, glow, amt } = (a.setOn && a.setVariant)
      ? setLayerTint(a.setVariant, name)
      : tintParams(piece.type, piece.quality);
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
}
