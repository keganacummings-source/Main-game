/**
 * On-screen combat text and enemy nameplates, drawn in screen space so they stay crisp and
 * readable at any zoom. Pixel font, hard 1px outlines and flat panels to match the sprites.
 */

export type FloatKind = "dmg" | "crit" | "hurt" | "heal" | "word" | "miss" | "big";
export type FloatText = {
  x: number;
  y: number;
  text: string;
  color: string;
  kind: FloatKind;
  life: number;
  max: number;
  /** Horizontal drift (screen px over its life) so stacked numbers fan out. */
  drift: number;
  /** Lane: extra lift so text spawned on the same spot does not overlap. */
  lane: number;
};

const NUM = /^[+-]?\d+!?$/;
const WARN = new Set(["#c4473a", "#ff6a4a", "#ffb15e"]);

/** Works out what kind of text a float is from its words and colour, so old call sites need no change. */
export function classifyFloat(text: string, color: string, onPlayer: boolean): FloatKind {
  const t = text.trim();
  if (t.startsWith("+") && NUM.test(t)) return "heal";
  if (NUM.test(t)) {
    if (onPlayer) return "hurt";
    if (t.endsWith("!")) return "crit";
    return "dmg";
  }
  if (t === "MISS" || t === "DODGE" || t === "IMMUNE" || t === "WAIT" || t === "GRAZE" || t === "CLIP") return "miss";
  if (t.includes("★") || t === "BREAK FREE" || t === "STAGGER") return "big";
  if (onPlayer && WARN.has(color)) return "hurt";
  return "word";
}

const LIFE: Record<FloatKind, number> = { dmg: 0.9, crit: 1.15, hurt: 1.0, heal: 1.0, word: 1.05, miss: 0.75, big: 1.6 };

export function makeFloat(x: number, y: number, text: string, color: string, onPlayer: boolean, recent: FloatText[]): FloatText {
  const kind = classifyFloat(text, color, onPlayer);
  // Count live floats near this spot; each one pushes the new text a lane higher and to the side.
  let lane = 0;
  for (const f of recent) if (f.life > f.max - 0.35 && Math.abs(f.x - x) < 26 && Math.abs(f.y - y) < 30) lane += 1;
  const side = lane % 2 ? 1 : -1;
  return {
    x,
    y,
    text: kind === "crit" ? text.replace(/!$/, "") : text,
    color,
    kind,
    life: LIFE[kind],
    max: LIFE[kind],
    drift: kind === "word" || kind === "big" ? 0 : side * (6 + (lane % 4) * 7),
    lane: Math.min(lane, 5),
  };
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

const INK = "#140e0c";

/** Text with a hard 1px outline in all eight directions (crisp, readable on any ground). */
export function outlineText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, px: number, ink = INK): void {
  ctx.fillStyle = ink;
  for (let dx = -px; dx <= px; dx += px) for (let dy = -px; dy <= px; dy += px) if (dx || dy) ctx.fillText(text, x + dx, y + dy);
  ctx.fillText(text, x + px, y + px * 2);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

const ease = (u: number) => 1 - (1 - u) ** 3;

type ToScreen = (x: number, y: number) => { x: number; y: number };

/** Combat text in screen space. `k` is the device pixel ratio. */
export function drawFloats(ctx: CanvasRenderingContext2D, floats: FloatText[], toScreen: ToScreen, k: number): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  for (const f of floats) {
    const u = 1 - f.life / f.max; // 0 → 1 over its life
    const at = toScreen(f.x, f.y);
    const rise = ease(Math.min(1, u * 1.4)) * (f.kind === "big" ? 34 : 40) + f.lane * 15;
    const x = at.x + f.drift * ease(u) * k;
    const y = at.y - rise * k;
    // Pop: start large, settle. Crits pop harder and shake for a moment.
    const pop = f.kind === "crit" ? 1 + Math.max(0, 0.6 - u * 3) : f.kind === "big" ? 1 + Math.max(0, 0.35 - u * 2) : 1 + Math.max(0, 0.3 - u * 2.5);
    const shake = f.kind === "crit" && u < 0.18 ? Math.round(Math.sin(u * 140)) * 2 * k : 0;
    const alpha = u > 0.7 ? Math.max(0, 1 - (u - 0.7) / 0.3) : 1;
    ctx.globalAlpha = alpha;
    let size: number, font: string, fill = f.color;
    switch (f.kind) {
      case "crit":
        size = 16; font = "Press Start 2P"; fill = "#ffe08a"; break;
      case "dmg":
        size = 12; font = "Press Start 2P"; break;
      case "hurt":
        size = 12; font = "Press Start 2P"; fill = "#ff5a4a"; break;
      case "heal":
        size = 12; font = "Press Start 2P"; fill = "#7ee8a8"; break;
      case "big":
        size = 12; font = "Press Start 2P"; break;
      case "miss":
        size = 22; font = "VT323"; fill = "#b8b0a0"; break;
      default:
        size = 24; font = "VT323";
    }
    const s = Math.round(size * pop) * k;
    ctx.font = `${s}px "${font}", monospace`;
    const ol = Math.max(1, Math.round(k * (font === "VT323" ? 1.5 : 1)));
    if (f.kind === "crit") {
      // Burst behind a crit, in the number's own colour.
      const r = (10 + 8 * (1 - u)) * k;
      ctx.fillStyle = "#ff6a4a";
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + u * 2;
        ctx.fillRect(Math.round(x + shake + Math.cos(a) * r * 1.6), Math.round(y - s * 0.45 + Math.sin(a) * r), 2 * k, 2 * k);
      }
    }
    outlineText(ctx, f.text, Math.round(x + shake), Math.round(y), fill, ol);
    if (f.kind === "crit") {
      ctx.font = `${8 * k}px "Press Start 2P", monospace`;
      outlineText(ctx, "CRIT", Math.round(x + shake), Math.round(y - s - 2 * k), "#ff8a5a", Math.max(1, k));
    }
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Enemy nameplates
// ---------------------------------------------------------------------------

export type PlateRank = "normal" | "elite" | "boss" | "bounty" | "hunter" | "witch";
export type Plate = {
  id: string;
  x: number;
  y: number;
  name: string;
  level: number;
  rank: PlateRank;
  tier?: number;
  typeColor: string;
  typeName: string;
  hp: number;
  max: number;
  /** Health shown on the lag bar (what it was a moment ago). */
  ghostHp: number;
  traits: { short: string; color: string }[];
  /** Full detail: hovered, targeted, or a big threat. */
  focus: boolean;
  /** 0–1: fades plates of far-off foes. */
  fade: number;
  enraged?: boolean;
  /** Player level, to tint the level badge by danger. */
  you: number;
};

const RANK: Record<PlateRank, { edge: string; tag: string | null; tagFill: string }> = {
  normal: { edge: "#5a4a3a", tag: null, tagFill: "" },
  elite: { edge: "#c9a6e8", tag: null, tagFill: "" },
  boss: { edge: "#e6c15a", tag: "BOSS", tagFill: "#e6c15a" },
  bounty: { edge: "#ff4d6a", tag: "BOUNTY", tagFill: "#ff4d6a" },
  hunter: { edge: "#ff4d6a", tag: "HUNTER", tagFill: "#ff4d6a" },
  witch: { edge: "#c4473a", tag: "WITCH", tagFill: "#c4473a" },
};

function dangerColor(level: number, you: number): string {
  const d = level - you;
  if (d >= 6) return "#ff4d4d";
  if (d >= 3) return "#ff9a4a";
  if (d >= 0) return "#e6c15a";
  return "#9ad8c8";
}

/** Short trait tags for nameplates: VAMP, THRN, WARD… */
export const TRAIT_SHORT: Record<string, { short: string; color: string }> = {
  vampiric: { short: "VAMP", color: "#e0566a" },
  thorned: { short: "THRN", color: "#7ad06a" },
  warded: { short: "WARD", color: "#fff1a8" },
  frenzied: { short: "FRNZ", color: "#ff7a4a" },
  swift: { short: "SWFT", color: "#9ad8f0" },
  brutal: { short: "BRUT", color: "#ff5a4a" },
  regenerating: { short: "REGN", color: "#7ee8a8" },
  evasive: { short: "EVAS", color: "#c8d8ff" },
  armored: { short: "ARMR", color: "#c8b8a0" },
  spellward: { short: "SPWD", color: "#b48cff" },
  giant: { short: "GIAN", color: "#e8a86a" },
};

type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Draws every plate in screen space. Focused and dangerous plates go last (on top) and always
 * show in full; ordinary ones collapse to a slim bar when they would overlap another plate.
 */
export function drawPlates(ctx: CanvasRenderingContext2D, plates: Plate[], toScreen: ToScreen, k: number): void {
  const order = plates.slice().sort((a, b) => Number(a.focus) - Number(b.focus) || (a.rank === "normal" ? 0 : 1) - (b.rank === "normal" ? 0 : 1) || a.y - b.y);
  const taken: Rect[] = [];
  // Reserve space for important plates first so the ordinary ones yield to them.
  const important = order.filter((p) => p.focus || p.rank !== "normal").reverse();
  const rest = order.filter((p) => !(p.focus || p.rank !== "normal"));
  const draw: [Plate, boolean][] = [];
  for (const p of [...important, ...rest]) {
    const at = toScreen(p.x, p.y);
    const w = (p.rank === "normal" || p.rank === "elite" ? 92 : 124) * k;
    const full: Rect = { x: at.x - w / 2, y: at.y - 40 * k, w, h: 40 * k };
    const compact = !p.focus && p.rank === "normal" && taken.some((r) => overlaps(r, full));
    taken.push(compact ? { x: at.x - 24 * k, y: at.y - 8 * k, w: 48 * k, h: 8 * k } : full);
    draw.push([p, compact]);
  }
  for (const [p, compact] of draw.reverse()) drawPlate(ctx, p, toScreen(p.x, p.y), k, compact);
  ctx.globalAlpha = 1;
}

function drawPlate(ctx: CanvasRenderingContext2D, p: Plate, at: { x: number; y: number }, k: number, compact: boolean): void {
  const r = RANK[p.rank];
  const big = !(p.rank === "normal" || p.rank === "elite");
  const w = Math.round((compact ? 44 : big ? 120 : 88) * k);
  const barH = Math.round((big ? 6 : 5) * k);
  const x = Math.round(at.x - w / 2);
  const by = Math.round(at.y - barH);
  ctx.globalAlpha = p.focus ? 1 : Math.max(0.35, p.fade);
  const pct = Math.max(0, Math.min(1, p.hp / Math.max(1, p.max)));
  const ghost = Math.max(pct, Math.min(1, p.ghostHp / Math.max(1, p.max)));
  // Bar: ink frame, rank edge, lag trail, type-coloured fill with a highlight row.
  ctx.fillStyle = INK;
  ctx.fillRect(x - 2 * k, by - 2 * k, w + 4 * k, barH + 4 * k);
  ctx.fillStyle = p.enraged ? "#ff4d6a" : r.edge;
  ctx.fillRect(x - k, by - k, w + 2 * k, barH + 2 * k);
  ctx.fillStyle = "#2a1c1c";
  ctx.fillRect(x, by, w, barH);
  ctx.fillStyle = "#f0e2c8";
  ctx.fillRect(x, by, Math.round(w * ghost), barH);
  ctx.fillStyle = p.typeColor;
  ctx.fillRect(x, by, Math.round(w * pct), barH);
  ctx.fillStyle = "rgba(255,255,255,.28)";
  ctx.fillRect(x, by, Math.round(w * pct), k);
  // Quarter ticks so you can read health at a glance.
  ctx.fillStyle = "rgba(20,14,12,.55)";
  for (let i = 1; i < 4; i++) ctx.fillRect(x + Math.round((w * i) / 4), by, k, barH);
  if (compact) return;
  // Name row: level badge, name, element dot.
  const ny = by - 5 * k;
  ctx.textBaseline = "alphabetic";
  ctx.font = `${8 * k}px "Press Start 2P", monospace`;
  const lv = String(p.level);
  const lvW = Math.round(ctx.measureText(lv).width + 6 * k);
  ctx.font = `${(big ? 17 : 15) * k}px "VT323", monospace`;
  const name = p.name.length > 22 ? `${p.name.slice(0, 21)}…` : p.name;
  const nameW = ctx.measureText(name).width;
  const rowW = lvW + 4 * k + nameW + 9 * k;
  let cx = Math.round(at.x - rowW / 2);
  ctx.fillStyle = INK;
  ctx.fillRect(cx - k, ny - 10 * k, lvW + 2 * k, 11 * k);
  ctx.fillStyle = dangerColor(p.level, p.you);
  ctx.fillRect(cx, ny - 9 * k, lvW, 9 * k);
  ctx.fillStyle = INK;
  ctx.font = `${8 * k}px "Press Start 2P", monospace`;
  ctx.textAlign = "left";
  ctx.fillText(lv, cx + 3 * k, ny - k);
  cx += lvW + 4 * k;
  ctx.font = `${(big ? 17 : 15) * k}px "VT323", monospace`;
  outlineText(ctx, name, cx, ny, big ? r.edge : "#fff6e8", Math.max(1, Math.round(k * 1.2)));
  cx += nameW + 4 * k;
  ctx.fillStyle = INK;
  ctx.fillRect(cx - k, ny - 7 * k, 6 * k, 6 * k);
  ctx.fillStyle = p.typeColor;
  ctx.fillRect(cx, ny - 6 * k, 4 * k, 4 * k);
  // Rank tag above the name (BOSS / ★3 BOUNTY / HUNTER).
  let top = ny - 12 * k;
  if (r.tag) {
    const tag = p.rank === "bounty" ? `★${p.tier ?? 1} ${r.tag}` : r.tag;
    ctx.font = `${7 * k}px "Press Start 2P", monospace`;
    const tw = Math.round(ctx.measureText(tag).width + 6 * k);
    const tx = Math.round(at.x - tw / 2);
    ctx.fillStyle = INK;
    ctx.fillRect(tx - k, top - 9 * k, tw + 2 * k, 10 * k);
    ctx.fillStyle = r.tagFill;
    ctx.fillRect(tx, top - 8 * k, tw, 8 * k);
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.fillText(tag, tx + 3 * k, top - k);
    top -= 11 * k;
  }
  // Trait chips: always shown, short form, so you can read a foe before you are close.
  if (p.traits.length) {
    ctx.font = `${6 * k}px "Press Start 2P", monospace`;
    const chips = p.traits.slice(0, 4);
    const ws = chips.map((t) => Math.round(ctx.measureText(t.short).width + 4 * k));
    const total = ws.reduce((a, b) => a + b, 0) + (chips.length - 1) * 2 * k;
    let tx = Math.round(at.x - total / 2);
    chips.forEach((t, i) => {
      ctx.fillStyle = INK;
      ctx.fillRect(tx, top - 8 * k, ws[i]!, 8 * k);
      ctx.fillStyle = t.color;
      ctx.fillRect(tx, top - 8 * k, ws[i]!, k);
      ctx.textAlign = "left";
      ctx.fillText(t.short, tx + 2 * k, top - 1.5 * k);
      tx += ws[i]! + 2 * k;
    });
  }
  // Focus: exact health under the bar.
  if (p.focus) {
    ctx.font = `${7 * k}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    outlineText(ctx, `${Math.ceil(p.hp)}/${Math.ceil(p.max)}`, Math.round(at.x), Math.round(by + barH + 10 * k), "#fff6e8", Math.max(1, k));
  }
  ctx.textAlign = "center";
}
