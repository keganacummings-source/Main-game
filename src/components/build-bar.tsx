import { memo } from "react";
import { ITEM_BY_ID } from "@/game/content";
import { BUILD_GROUPS, BUILD_HOTKEY_ORDER, BUILD_PIECES, TURBZ_ONLY_PIECES, NEWTEX_ONLY_PIECES, type BuildPiece } from "@/game/building";
import type { TurbzGame } from "@/game/engine";
import { useSnapPick } from "./use-snap";
import { NEWTEX_DIR } from "@/game/tile-atlas";
import { powerTexture } from "@/game/camp-assets";

type GameProp = { game: TurbzGame | null };

const NEWTEX_PREVIEW: Partial<Record<BuildPiece, string>> = {
  wood: NEWTEX_DIR + "wood_wall.png",
  stone: NEWTEX_DIR + "stone_wall.png",
  woodfloor: NEWTEX_DIR + "wood_floor.png",
  stonefloor: NEWTEX_DIR + "stone_floor.png",
  door: NEWTEX_DIR + "wood_wall.png",
  bed: NEWTEX_DIR + "bed.png",
  ghostbox: NEWTEX_DIR + "ghostbox.png",
  turbzchest: NEWTEX_DIR + "chest.png",
};

/**
 * The build-mode toolbar (F). Docked along the bottom while you build: every camp piece grouped into
 * walls, floors, doors and furniture, each with its hotkey and its cost, a Remove tool, a live line that
 * says what a click on the tile under the cursor will do (or why it can't), and what your camp holds.
 */
export const BuildBar = memo(function BuildBar({ game }: GameProp) {
  const s = useSnapPick(["build", "kyo", "bag", "turbz"] as const);
  if (!s.build.on) return null;
  const bag = Object.fromEntries(s.bag.map((it) => [it.id, it.count]));
  const count = (id: string) => (id === "kyo" ? (s.kyo ?? 0) : (bag[id] ?? 0));
  const newTex = !!(game && (game as any).save?.turbzNewTex);
  const shown = (id: BuildPiece) => (s.turbz || !TURBZ_ONLY_PIECES.has(id)) && (!NEWTEX_ONLY_PIECES.has(id) || newTex);
  const hotkeys = BUILD_HOTKEY_ORDER.filter(shown);
  const c = s.build.counts;
  const placedAlready = (id: BuildPiece) => (id === "ghostbox" && s.build.ghostBox) || (id === "turbzchest" && c.chest);
  const hover = s.build.hover;
  const erase = s.build.piece === "erase";
  return (
    <div className="build-bar px-panel" data-testid="build-bar" role="toolbar" aria-label="Build mode">
      <div className="build-bar-head">
        <span className="font-display text-[9px] text-kyo">BUILD MODE · world paused</span>
        <span className="build-bar-stats text-dim">
          Walls {c.walls} · Floors {c.floors} · Doors {c.doors} · Beds {c.beds}{c.ghostBox ? " · Ghost Box" : ""}{c.chest ? " · Chest" : ""} · <span className="text-kyo">{(s.kyo ?? 0).toLocaleString()} kyo</span>
        </span>
        <button type="button" className="px-btn ui-btn-sm" data-testid="build-bar-stop" onClick={() => game?.toggleBuild(false)}>Done (F)</button>
      </div>
      <div className="build-bar-groups">
        {BUILD_GROUPS.map((g) => {
          const pieces = g.pieces.filter(shown);
          if (!pieces.length) return null;
          return (
            <div key={g.id} className="build-bar-group">
              <span className="build-bar-group-label">{g.label}</span>
              <div className="build-bar-pieces">
                {pieces.map((id) => {
                  const def = BUILD_PIECES[id];
                  const afford = Object.entries(def.cost).every(([k, n]) => count(k) >= n);
                  const key = hotkeys.indexOf(id) + 1;
                  const on = s.build.piece === id;
                  const done = placedAlready(id);
                  const preview = powerTexture(id) || (newTex ? NEWTEX_PREVIEW[id] : undefined);
                  return (
                    <button key={id} type="button" data-testid={`build-piece-${id}`}
                      className={`build-piece ${on ? "build-piece-on" : ""} ${afford ? "" : "build-piece-poor"}`}
                      disabled={!!done} title={def.about} aria-pressed={on}
                      onClick={() => game?.setBuildPiece(id)}>
                      {key > 0 && <kbd className="build-piece-key">{key}</kbd>}
                      {preview && <img src={preview} alt="" className="build-piece-preview" style={{ width: 24, height: 24, imageRendering: "pixelated", marginRight: 4, verticalAlign: "middle" }} />}
                      <span className="build-piece-name">{def.name}{done ? " ✓" : ""}</span>
                      <span className={`build-piece-cost ${afford ? "cost-ok" : "cost-miss"}`}>
                        {Object.entries(def.cost).map(([k, n]) => `${n.toLocaleString()} ${k === "kyo" ? "kyo" : ITEM_BY_ID[k]?.name ?? k}`).join(" + ")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="build-bar-group">
          <span className="build-bar-group-label">Tools</span>
          <div className="build-bar-pieces">
            <button type="button" data-testid="build-piece-erase" className={`build-piece build-piece-erase ${erase ? "build-piece-on" : ""}`} aria-pressed={erase} title="Click placed pieces to pick them up for a refund, without placing anything." onClick={() => game?.setBuildPiece("erase")}>
              <kbd className="build-piece-key">X</kbd>
              <span className="build-piece-name">Remove</span>
              <span className="build-piece-cost text-dim">refunds</span>
            </button>
          </div>
        </div>
      </div>
      <p className={`build-bar-hint ${hover ? (hover.ok ? (hover.pickup ? "text-kyo" : "text-good") : "text-bad") : "text-dim"}`} data-testid="build-bar-hint">
        {hover ? hover.text : "Point at a tile within reach (the dashed ring)."}
        <span className="text-dim"> · 1–{hotkeys.length} pick · X remove · F / Esc done</span>
      </p>
    </div>
  );
});