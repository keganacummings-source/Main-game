import { memo } from "react";
import {
  BUILD_GROUPS, BUILD_HOTKEY_ORDER, isPieceAvailable, isSingleton,
  type BuildPiece, type BuildGroup,
} from "@/game/building";
import type { TurbzGame } from "@/game/engine";
import { useSnapPick } from "./use-snap";
import { BuildPieceButton } from "./build-piece-button";

type GameProp = { game: TurbzGame | null };

/**
 * The build-mode toolbar (F). Docked along the bottom while you build.
 *
 * Groups come straight from BUILD_GROUPS; each piece renders through the shared
 * <BuildPieceButton>, so adding a piece or a new sub-group only means editing
 * `building.ts`. Power is split (Generators / Storage / Wiring / Machines)
 * so the toolbar stays legible as that section expands.
 */
export const BuildBar = memo(function BuildBar({ game }: GameProp) {
  const s = useSnapPick(["build", "kyo", "bag", "turbz"] as const);
  if (!s.build.on) return null;

  const bag = Object.fromEntries(s.bag.map((it) => [it.id, it.count]));
  const have = (id: string) => (id === "kyo" ? (s.kyo ?? 0) : (bag[id] ?? 0));
  const newTex = !!(game && (game as any).save?.turbzNewTex);
  const mode = { turbz: !!s.turbz, newTex };
  const shown = (id: BuildPiece) => isPieceAvailable(id, mode);

  const visibleHotkeys = BUILD_HOTKEY_ORDER.filter(shown);
  const hotkeyFor = (id: BuildPiece) => visibleHotkeys.indexOf(id) + 1;

  const c = s.build.counts;
  const isPlaced = (id: BuildPiece): boolean => {
    if (!isSingleton(id)) return false;
    if (id === "ghostbox") return !!s.build.ghostBox;
    if (id === "turbzchest") return !!c.chest;
    return false;
  };

  const hover = s.build.hover;
  const erase = s.build.piece === "erase";
  const hotkeyCount = Math.min(visibleHotkeys.length, 9);

  // Group the groups by their top-level section so Power sub-groups cluster side-by-side.
  const topOf = (g: BuildGroup) => (g.startsWith("power.") ? "power" : g);
  const columns: { top: string; groups: typeof BUILD_GROUPS }[] = [];
  for (const g of BUILD_GROUPS) {
    const pieces = g.pieces.filter(shown);
    if (!pieces.length) continue;
    const top = topOf(g.id);
    const last = columns[columns.length - 1];
    if (last && last.top === top) last.groups.push(g);
    else columns.push({ top, groups: [g] });
  }

  return (
    <div className="build-bar px-panel" data-testid="build-bar" role="toolbar" aria-label="Build mode">
      <div className="build-bar-head">
        <span className="font-display text-[9px] text-kyo">BUILD MODE · world paused</span>
        <span className="build-bar-stats text-dim">
          Walls {c.walls} · Floors {c.floors} · Doors {c.doors} · Beds {c.beds}
          {c.ghostBox ? " · Ghost Box" : ""}{c.chest ? " · Chest" : ""} · <span className="text-kyo">{(s.kyo ?? 0).toLocaleString()} kyo</span>
        </span>
        <button type="button" className="px-btn ui-btn-sm" data-testid="build-bar-stop" onClick={() => game?.toggleBuild(false)}>Done (F)</button>
      </div>

      <div className="build-bar-groups">
        {columns.map((col, i) => (
          <div key={col.top + i} className={`build-bar-column build-bar-column-${col.top}`}>
            {col.groups.map((g) => {
              const pieces = g.pieces.filter(shown);
              return (
                <div key={g.id} className="build-bar-group">
                  <span className="build-bar-group-label">{g.label}</span>
                  <div className="build-bar-pieces">
                    {pieces.map((id) => (
                      <BuildPieceButton
                        key={id}
                        id={id}
                        have={have}
                        selected={s.build.piece === id}
                        placed={isPlaced(id)}
                        hotkey={hotkeyFor(id)}
                        newTex={newTex}
                        variant="bar"
                        onClick={() => game?.setBuildPiece(id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        <div className="build-bar-column build-bar-column-tools">
          <div className="build-bar-group">
            <span className="build-bar-group-label">Tools</span>
            <div className="build-bar-pieces">
              <button
                type="button"
                data-testid="build-piece-erase"
                className={`build-piece build-piece-erase ${erase ? "build-piece-on" : ""}`}
                aria-pressed={erase}
                title="Click placed pieces to pick them up for a refund, without placing anything."
                onClick={() => game?.setBuildPiece("erase")}
              >
                <kbd className="build-piece-key">X</kbd>
                <span className="build-piece-name">Remove</span>
                <span className="build-piece-cost text-dim">refunds</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <p className={`build-bar-hint ${hover ? (hover.ok ? (hover.pickup ? "text-kyo" : "text-good") : "text-bad") : "text-dim"}`} data-testid="build-bar-hint">
        {hover ? hover.text : "Point at a tile within reach (the dashed ring)."}
        <span className="text-dim"> · 1–{hotkeyCount} pick · X remove · F / Esc done</span>
      </p>
    </div>
  );
});
