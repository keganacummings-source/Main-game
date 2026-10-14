import { useEffect, useRef, useState } from "react";
import { WitchArena, type ArenaSnap } from "@/game/arena";
import type { GraveBody } from "@/game/social-types";

export function ArenaScreen(props: {
  seed: unknown;
  onClose: () => void;
  onCloud: (save: unknown | null) => void;
  onGrave?: (body: GraveBody) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arenaRef = useRef<WitchArena | null>(null);
  const [snap, setSnap] = useState<ArenaSnap | null>(null);

  const cloudRef = useRef(props.onCloud);
  cloudRef.current = props.onCloud;
  const seedRef = useRef(props.seed);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const arena = new WitchArena(canvas);
    arena.onCloud = (save) => cloudRef.current(save);
    arena.onGrave = (body) => props.onGrave?.(body);
    arenaRef.current = arena;
    const un = arena.subscribe(() => setSnap(arena.getSnap()));
    arena.start(seedRef.current);
    const onResize = () => arena.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      un();
      arena.stop();
      arenaRef.current = null;
    };
  }, []);

  const arena = () => arenaRef.current;
  const setup = snap && snap.phase === "setup" && !snap.placing;
  const placing = snap?.placing;
  const live = snap && (snap.phase === "fight" || snap.phase === "result");

  return (
    <div className="arena-root">
      <canvas ref={canvasRef} className="arena-canvas" aria-label="TurboCircle battle" />
      {setup && snap && (
        <div className="arena-setup">
          <div className="px-panel arena-setup-card p-4">
            <p className="font-display text-xs text-blood">TURBOCIRCLE</p>
            <h2 className="font-display mt-2 text-sm text-bone">Battle simulator</h2>
            <p className="mt-2 text-dim">{snap.note}</p>
            <label className="arena-field mt-3">
              Map
              <select value={snap.mapId} onChange={(e) => arena()?.setMap(e.target.value)}>
                {snap.maps.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id === "default" ? "Default" : m.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="arena-field">
                Teams
                <input
                  type="number"
                  min={2}
                  max={8}
                  value={snap.teamCount}
                  onChange={(e) => arena()?.setTeamCount(Number(e.target.value))}
                />
              </label>
              <label className="arena-field">
                Witches each
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={snap.perTeam}
                  onChange={(e) => arena()?.setPerTeam(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="arena-modes mt-3">
              <button
                className={`px-btn ${snap.mode === "hunger" ? "arena-mode-on" : ""}`}
                type="button"
                onClick={() => arena()?.setMode("hunger")}
              >
                Hunger Games
              </button>
              <button
                className={`px-btn ${snap.mode === "classic" ? "arena-mode-on" : ""}`}
                type="button"
                onClick={() => arena()?.setMode("classic")}
              >
                Classic
              </button>
            </div>
            <p className="mt-2 text-dim">
              {snap.mode === "hunger"
                ? "Packs stay together. They roam to drill their level, or break off to hunt another pack. Follow a team, or fly the camera."
                : "Packs stay together and hunt until one pack is left."}
            </p>
            <div className="mt-3 grid gap-2">
              <button className="px-btn px-btn-kyo" type="button" onClick={() => arena()?.armPlace()}>
                Place spawn pads
              </button>
              <button className="px-btn" type="button" onClick={() => arena()?.autoZones()}>
                Scatter pads
              </button>
              <button className="px-btn px-btn-kyo" type="button" onClick={() => arena()?.launch()}>
                Start the fight
              </button>
              <button className="px-btn" type="button" onClick={props.onClose}>
                Back to the title
              </button>
            </div>
          </div>
        </div>
      )}
      {placing && snap && (
        <div className="arena-hud">
          <div className="px-panel px-3 py-2">
            <p className="font-display text-xs text-kyo">Plant the packs</p>
            <p className="mt-1">{snap.note}</p>
            <div className="arena-teams mt-2">
              {snap.teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="arena-team"
                  style={{ borderColor: t.color, color: t.color, boxShadow: t.id === snap.placeFor ? `4px 4px 0 ${t.color}` : undefined }}
                  onClick={() => arena()?.setPlace(t.id)}
                >
                  {t.name}
                  {t.placed ? " · set" : " · open"}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="px-btn" type="button" onClick={() => arena()?.zoomBy(1.15)}>
                Zoom in
              </button>
              <button className="px-btn" type="button" onClick={() => arena()?.zoomBy(0.87)}>
                Zoom out
              </button>
              <button className="px-btn" type="button" onClick={() => arena()?.autoZones()}>
                Scatter
              </button>
              <button className="px-btn px-btn-kyo" type="button" onClick={() => arena()?.launch()}>
                Start
              </button>
              <button className="px-btn" type="button" onClick={() => arena()?.backSetup()}>
                Back
              </button>
            </div>
          </div>
        </div>
      )}
      {live && snap && (
        <div className="arena-hud">
          <div className="px-panel px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-xs text-kyo">
                {snap.mode === "hunger" ? "Hunger Games" : "Classic"} · {snap.clock}
              </span>
              <span className="text-dim">{snap.mapName}</span>
              <button className="px-btn" type="button" onClick={() => arena()?.setSpeed(snap.speed >= 4 ? 1 : snap.speed === 2 ? 4 : 2)}>
                {snap.speed}×
              </button>
              <button className={`px-btn ${snap.cam === "team" ? "arena-mode-on" : ""}`} type="button" onClick={() => arena()?.setCam("team")}>
                Team
              </button>
              <button className={`px-btn ${snap.cam === "free" ? "arena-mode-on" : ""}`} type="button" onClick={() => arena()?.setCam("free")}>
                Free
              </button>
              <button className="px-btn" type="button" onClick={() => arena()?.cycleTeam(-1)}>
                Prev
              </button>
              <button className="px-btn" type="button" onClick={() => arena()?.cycleTeam(1)}>
                Next
              </button>
              <button className="px-btn" type="button" onClick={() => arena()?.zoomBy(1.15)}>
                +
              </button>
              <button className="px-btn" type="button" onClick={() => arena()?.zoomBy(0.87)}>
                −
              </button>
            </div>
            <div className="arena-teams mt-2">
              {snap.teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="arena-team"
                  style={{ borderColor: t.id === snap.focus ? t.color : "#5a4a40", color: t.color }}
                  onClick={() => {
                    arena()?.cycleTeam(t.id - snap.focus);
                  }}
                >
                  {t.name} {t.alive}/{t.count}
                  {t.level ? ` · Lv ${t.level}` : ""} · {t.intent}
                </button>
              ))}
            </div>
            <p className="mt-1 text-dim">
              {snap.cam === "free" ? "Free camera. Drag, WASD, or arrows." : "Following a pack. Q and E change team. WASD lets go of the camera."}
            </p>
          </div>
          {snap.phase === "result" && (
            <div className="px-panel mt-2 max-w-md p-3">
              <p className="font-display text-xs text-kyo">The circle stills</p>
              <p className="mt-2">{snap.winner || snap.note}</p>
              <div className="mt-3 grid gap-2">
                <button className="px-btn px-btn-kyo" type="button" onClick={() => arena()?.again()}>
                  Run it again
                </button>
                <button className="px-btn" type="button" onClick={() => arena()?.backSetup()}>
                  Change the setup
                </button>
                <button className="px-btn" type="button" onClick={props.onClose}>
                  Back to the title
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
