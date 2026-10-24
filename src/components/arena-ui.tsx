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
    arena.onCloud = (save) => cloudRef.current(save as unknown | null);
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
  const setup = snap && snap.phase === "setup";
  const live = snap && (snap.phase === "run" || snap.phase === "result");

  return (
    <div className="arena-root">
      <canvas ref={canvasRef} className="arena-canvas" aria-label="TurboCircle world simulator" />

      {setup && snap && (
        <div className="arena-setup">
          <div className="px-panel arena-setup-card p-4">
            <p className="font-display text-xs text-blood">TURBOCIRCLE</p>
            <h2 className="font-display mt-2 text-sm text-bone">World Battle Simulator</h2>
            <p className="mt-2 text-dim">
              One 450×450 continent. Several factions each hold Regions anchored on Objectives. Combat witches march
              out to take ground — battles from 1v1 to 10v10 break out all over at once. Non-combat witches harvest the
              land and carry materials home; a full stockpile recruits another witch. Set it up, then watch who wins.
            </p>

            <label className="arena-field mt-3">
              Factions: {snap.factionCount}
              <input type="range" min={2} max={8} step={1} value={snap.factionCount} onChange={(e) => arena()?.setFactionCount(Number(e.target.value))} />
            </label>
            <label className="arena-field mt-3">
              Objectives / Regions: {snap.objectiveCount}
              <input type="range" min={Math.max(snap.factionCount, 6)} max={28} step={1} value={snap.objectiveCount} onChange={(e) => arena()?.setObjectiveCount(Number(e.target.value))} />
            </label>
            <p className="mt-2 text-dim">Each faction starts on one Region; the rest are neutral and up for grabs.</p>

            <div className="mt-3 grid gap-2">
              <button className="px-btn px-btn-kyo" type="button" onClick={() => arena()?.begin()}>Begin the war</button>
              <div className="flex gap-2">
                <button className="px-btn flex-1" type="button" onClick={() => arena()?.newWorld()}>New continent</button>
                <button className="px-btn flex-1" type="button" onClick={props.onClose}>Back to the title</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {live && snap && (
        <div className="arena-hud">
          <div className="px-panel px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-xs text-kyo">WORLD WAR · {snap.clock}</span>
              <span className="text-dim">{snap.battles} battle{snap.battles === 1 ? "" : "s"} raging</span>
              <button className="px-btn" type="button" onClick={() => arena()?.setSpeed(snap.speed >= 6 ? 1 : snap.speed === 3 ? 6 : snap.speed === 2 ? 3 : 2)}>{snap.speed}×</button>
              <button className={`px-btn ${snap.cam === "follow" ? "arena-mode-on" : ""}`} type="button" onClick={() => arena()?.setCam(snap.cam === "follow" ? "free" : "follow")}>{snap.cam === "follow" ? "Following" : "Follow"}</button>
              <button className="px-btn" type="button" onClick={() => arena()?.jumpBattle()}>Jump to battle</button>
              <button className="px-btn" type="button" onClick={() => arena()?.cycleFocus(-1)}>Prev</button>
              <button className="px-btn" type="button" onClick={() => arena()?.cycleFocus(1)}>Next</button>
              <button className="px-btn" type="button" onClick={() => arena()?.zoomBy(1.15)}>+</button>
              <button className="px-btn" type="button" onClick={() => arena()?.zoomBy(0.87)}>−</button>
            </div>

            <div className="sim-standings mt-2">
              {snap.factions.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="sim-faction"
                  style={{ borderColor: f.id === snap.focus ? f.color : "#5a4a40", opacity: f.alive ? 1 : 0.45 }}
                  onClick={() => arena()?.followFaction(f.id)}
                  title={`${f.name}: ${f.objectives} regions, ${f.combat} combat, ${f.harvesters} harvesters, ${f.materials} materials`}
                >
                  <span className="sim-swatch" style={{ background: f.color }} />
                  <span className="sim-name" style={{ color: f.color }}>{f.name}{f.alive ? "" : " ✕"}</span>
                  <span className="sim-stat">◧ {f.objectives}/{snap.objectiveTotal}</span>
                  <span className="sim-stat">⚔ {f.combat}</span>
                  <span className="sim-stat">⛏ {f.harvesters}</span>
                  <span className="sim-stat">◆ {f.materials}</span>
                </button>
              ))}
            </div>

            <p className="mt-1 text-dim">
              {snap.cam === "follow" ? "Following a faction. Q / E change faction, WASD frees the camera." : "Free camera: drag, WASD, scroll. Click the minimap to jump. B = biggest battle."}
            </p>
          </div>

          {snap.events.length > 0 && (
            <div className="px-panel sim-log mt-2 px-3 py-2">
              {snap.events.map((e, i) => (
                <p key={`${i}-${e}`} className="text-dim" style={{ opacity: 1 - i * 0.1 }}>· {e}</p>
              ))}
            </div>
          )}

          {snap.phase === "result" && (
            <div className="px-panel mt-2 max-w-md p-3">
              <p className="font-display text-xs" style={{ color: snap.winFaction >= 0 ? snap.factions.find((f) => f.id === snap.winFaction)?.color : "#e6c15a" }}>
                The continent is decided
              </p>
              <p className="mt-2">{snap.winner || snap.note}</p>
              <div className="mt-3 grid gap-2">
                <button className="px-btn px-btn-kyo" type="button" onClick={() => arena()?.again()}>Run it again</button>
                <button className="px-btn" type="button" onClick={() => arena()?.newWorld()}>New continent</button>
                <button className="px-btn" type="button" onClick={() => arena()?.backSetup()}>Change the setup</button>
                <button className="px-btn" type="button" onClick={props.onClose}>Back to the title</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
