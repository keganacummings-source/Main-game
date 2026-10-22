import { memo, type CSSProperties, type ReactNode } from "react";
import { ITEM_BY_ID } from "@/game/content";
import { BUILD_PIECES, piecePreview, type BuildPiece } from "@/game/building";
import { powerTexture } from "@/game/camp-assets";

/**
 * Shared bits for the build menus (the floating BuildBar and the campfire panel).
 *
 * One source of truth for how a piece button looks: name, hotkey, preview art, cost chips,
 * "selected" / "already placed" / "can't afford" states. Both menus render the same button.
 *
 * To change how any of this reads — material labels, chip colours, affordability styling —
 * do it here once.
 */

// ─── Material metadata ───────────────────────────────────────────────────────
/**
 * Short code + colour for each build material. Lets costs render as compact
 * "LOG×4 HIDE×3" chips instead of "4 Logs, 3 Hide Leather", so a piece with 3
 * materials still fits a toolbar button.
 */
type MatMeta = { code: string; color: string };
const MATERIAL_META: Record<string, MatMeta> = {
  kyo:      { code: "KYO",  color: "var(--color-kyo)" },
  timber:   { code: "LOG",  color: "#c38a3a" },
  leather:  { code: "HIDE", color: "#b88054" },
  ore:      { code: "ORE",  color: "#9aa0a8" },
  hell_ore: { code: "HELL", color: "#d04631" },
  rock_ore: { code: "ROCK", color: "#8a8a8a" },
  dirt:     { code: "DIRT", color: "#6b4a30" },
  sand:     { code: "SAND", color: "#d8be7a" },
  wire:     { code: "WIRE", color: "#e6c22a" },
};

/** Short code + colour for any material; falls back to the item's name truncated. */
export function materialMeta(id: string): MatMeta {
  const m = MATERIAL_META[id];
  if (m) return m;
  const name = id === "kyo" ? "Kyo" : (ITEM_BY_ID[id]?.name ?? id);
  return { code: name.slice(0, 4).toUpperCase(), color: "var(--color-bone)" };
}

/** Full display name for a material (used in tooltips). */
export function materialName(id: string): string {
  if (id === "kyo") return "Kyo";
  return ITEM_BY_ID[id]?.name ?? id;
}

// ─── Cost chip ───────────────────────────────────────────────────────────────
type CostChipProps = {
  id: string;
  need: number;
  have: number;
  /** When true, shows "have/need" instead of just "×need". Used in the big campfire menu. */
  showProgress?: boolean;
};

export const CostChip = memo(function CostChip({ id, need, have, showProgress }: CostChipProps) {
  const meta = materialMeta(id);
  const ok = have >= need;
  const title = `${materialName(id)} · ${have.toLocaleString()}/${need.toLocaleString()}`;
  return (
    <span
      className={`cost-chip ${ok ? "cost-ok" : "cost-miss"}`}
      style={{ "--mat": meta.color } as CSSProperties}
      title={title}
      aria-label={title}
    >
      <span className="cost-chip-code">{meta.code}</span>
      <span className="cost-chip-num">
        {showProgress ? `${have.toLocaleString()}/${need.toLocaleString()}` : `×${need.toLocaleString()}`}
      </span>
    </span>
  );
});

/** A row of cost chips for a piece. */
export const CostChips = memo(function CostChips({
  cost, have, showProgress,
}: { cost: Record<string, number>; have: (id: string) => number; showProgress?: boolean }) {
  return (
    <span className="cost-row">
      {Object.entries(cost).map(([id, n]) => (
        <CostChip key={id} id={id} need={n} have={have(id)} showProgress={showProgress} />
      ))}
    </span>
  );
});

// ─── Shared piece button ─────────────────────────────────────────────────────
type Variant = "bar" | "card";

type PieceButtonProps = {
  id: BuildPiece;
  /** How many of each material the bag holds; `count("kyo")` returns kyo. */
  have: (id: string) => number;
  /** Is this piece currently selected? */
  selected: boolean;
  /** Is this piece a singleton that's already been placed? */
  placed: boolean;
  /** Hotkey digit (1..9) if assigned, otherwise 0. */
  hotkey: number;
  /** Is New Texture Mode on? Decides whether to show preview art. */
  newTex: boolean;
  /** Compact bar button or the larger ui-card used in the campfire panel. */
  variant: Variant;
  /** Extra line of context shown in the card variant (e.g. "3 here", "Missing materials"). */
  footnote?: ReactNode;
  onClick: () => void;
};

export const BuildPieceButton = memo(function BuildPieceButton({
  id, have, selected, placed, hotkey, newTex, variant, footnote, onClick,
}: PieceButtonProps) {
  const def = BUILD_PIECES[id];
  if (!def) return null;
  const afford = Object.entries(def.cost).every(([k, n]) => have(k) >= n);
  const preview = powerTexture(id) || (newTex ? piecePreview(id) : undefined);
  // Only show the hotkey badge for 1..9 — the only digits a player can press.
  const showHotkey = hotkey >= 1 && hotkey <= 9;

  if (variant === "bar") {
    return (
      <button
        type="button"
        data-testid={`build-piece-${id}`}
        className={`build-piece ${selected ? "build-piece-on" : ""} ${afford ? "" : "build-piece-poor"}`}
        disabled={placed}
        aria-pressed={selected}
        title={def.about}
        onClick={onClick}
      >
        {showHotkey && <kbd className="build-piece-key">{hotkey}</kbd>}
        {preview && (
          <img
            src={preview}
            alt=""
            className="build-piece-preview"
            style={{ width: 24, height: 24, imageRendering: "pixelated", marginRight: 4, verticalAlign: "middle" }}
          />
        )}
        <span className="build-piece-name">{def.name}{placed ? " ✓" : ""}</span>
        <CostChips cost={def.cost} have={have} />
      </button>
    );
  }

  // Card variant for the campfire panel.
  return (
    <button
      type="button"
      data-testid={`camp-piece-${id}`}
      className={`ui-card build-card ${selected ? "ui-card-hl" : ""}`}
      disabled={placed}
      title={def.about}
      onClick={onClick}
    >
      <span className="ui-row">
        <span className="build-card-head">
          {preview && (
            <img
              src={preview}
              alt=""
              className="build-card-preview"
              style={{ width: 32, height: 32, imageRendering: "pixelated" }}
            />
          )}
          <span className="text-kyo build-card-name">
            {def.name}{placed ? " · placed" : ""}
          </span>
        </span>
        {showHotkey && <kbd className="key-badge">{hotkey}</kbd>}
      </span>
      <CostChips cost={def.cost} have={have} showProgress />
      <span className="text-dim build-card-foot">
        {afford ? def.about : "Missing materials"}{footnote ? ` · ${footnote}` : ""}
      </span>
    </button>
  );
});
