import { useEffect, useRef, useState } from "react";
import { WitchArena, type ArenaSnap, type ArmySnap, type ClassOption } from "@/game/arena";
import type { GraveBody } from "@/game/social-types";
import type { ClassId, Role } from "@/game/classes";

const ROLE_ORDER: Role[] = ["Tank", "Bruiser", "Marksman", "Caster", "Mobility", "Support"];

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
  const live = snap && (snap.phase === "fight" || snap.phase === "result");

  return (
    <div className="arena-root">
      <canvas ref={canvasRef} className="arena-canvas" aria-label="TurboCircle siege" />

      {setup && snap && (
        <div className="arena-setup">
          <div className="px-panel arena-setup-card siege-setup p-4">
            <p className="font-display text-xs text-blood">TURBOCIRCLE</p>
            <h2 className="font-display mt-2 text-sm text-bone">Siege of the Keep</h2>
            <p className="mt-2 text-dim">
              One 250×250 battlefield, one walled keep, one point to hold. Build both armies out of classes, then loose
              the attack. Attackers smart-push the gates to seize the point; defenders dig in and hold.
            </p>

            <div className="siege-armies mt-3">
              {snap.armies.map((army) => (
                <ArmyBuilder key={army.id} army={army} options={snap.classOptions} arena={arena} />
              ))}
            </div>

            <div className="mt-3 grid gap-2">
              <button className="px-btn px-btn-kyo" type="button" onClick={() => arena()?.launch()}>
                Loose the attack
              </button>
              <div className="flex gap-2">
                <button className="px-btn flex-1" type="button" onClick={() => arena()?.newBattlefield()}>
                  New battlefield
                </button>
                <button className="px-btn flex-1" type="button" onClick={props.onClose}>
                  Back to the title
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {live && snap && (
        <div className="arena-hud">
          <div className="px-panel px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-xs text-kyo">SIEGE · {snap.clock}</span>
              <span className="text-dim">Defenders hold in {snap.timeLeft}</span>
              <button className="px-btn" type="button" onClick={() => arena()?.setSpeed(snap.speed >= 4 ? 1 : snap.speed === 2 ? 4 : 2)}>
                {snap.speed}×
              </button>
              <button className={`px-btn ${snap.cam === "team" ? "arena-mode-on" : ""}`} type="button" onClick={() => arena()?.setCam("team")}>
                Follow
              </button>
              <button className={`px-btn ${snap.cam === "free" ? "arena-mode-on" : ""}`} type="button" onClick={() => arena()?.setCam("free")}>
                Free
              </button>
              <button className="px-btn" type="button" onClick={() => arena()?.cycleTeam(1)}>
                Switch side
              </button>
              <button className="px-btn" type="button" onClick={() => arena()?.zoomBy(1.15)}>+</button>
              <button className="px-btn" type="button" onClick={() => arena()?.zoomBy(0.87)}>−</button>
            </div>

            <div className="siege-meter mt-2" aria-label={`Capture ${snap.control}%`}>
              <div className="siege-meter-fill" style={{ width: `${snap.control}%` }} />
              <span className="siege-meter-label">
                {snap.held === "attackers" ? "Point taken" : snap.held === "contested" ? "Point contested" : "Point held"} · {snap.control}%
              </span>
            </div>

            <div className="arena-teams mt-2">
              {snap.armies.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="arena-team"
                  style={{ borderColor: t.id === snap.focus ? t.color : "#5a4a40", color: t.color }}
                  onClick={() => arena()?.cycleTeam(t.id - snap.focus)}
                >
                  {t.name} {t.alive}/{t.count}
                  {t.level ? ` · Lv ${t.level}` : ""} · {t.intent}
                </button>
              ))}
            </div>
            <p className="mt-1 text-dim">
              {snap.cam === "free" ? "Free camera. Drag, WASD, or arrows." : "Following a side. Q and E switch; WASD frees the camera."}
            </p>
          </div>

          {snap.phase === "result" && (
            <div className="px-panel mt-2 max-w-md p-3">
              <p className="font-display text-xs" style={{ color: snap.winSide >= 0 ? snap.armies[snap.winSide]?.color : "#e6c15a" }}>
                {snap.winSide === 0 ? "The keep falls" : "The line holds"}
              </p>
              <p className="mt-2">{snap.winner || snap.note}</p>
              <div className="mt-3 grid gap-2">
                <button className="px-btn px-btn-kyo" type="button" onClick={() => arena()?.again()}>
                  Run it again
                </button>
                <button className="px-btn" type="button" onClick={() => arena()?.newBattlefield()}>
                  New battlefield
                </button>
                <button className="px-btn" type="button" onClick={() => arena()?.backSetup()}>
                  Change the armies
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

function ArmyBuilder(props: { army: ArmySnap; options: ClassOption[]; arena: () => WitchArena | null }) {
  const { army, options, arena } = props;
  const picked = new Set(army.classes);
  const byRole = ROLE_ORDER.map((role) => ({ role, list: options.filter((o) => o.role === role) })).filter((g) => g.list.length);
  return (
    <div className="siege-army px-panel p-3" style={{ borderColor: army.color }}>
      <div className="flex items-center justify-between">
        <span className="font-display text-xs" style={{ color: army.color }}>{army.name}</span>
        <span className="text-dim">{army.ghosts > 0 ? `${army.ghosts} ghost kinds` : "no ghosts"}</span>
      </div>
      <label className="arena-field mt-2">
        Army size: {army.size}
        <input
          type="range"
          min={4}
          max={60}
          step={2}
          value={army.size}
          onChange={(e) => arena()?.setSize(army.id, Number(e.target.value))}
        />
      </label>
      <p className="mt-2 text-dim">Tap classes to set what this army is made of. Ghost-callers bring their own spirits.</p>
      <div className="siege-classes mt-2">
        {byRole.map((group) => (
          <div key={group.role} className="siege-class-group">
            <span className="siege-class-role">{group.role}</span>
            <div className="siege-class-chips">
              {group.list.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`siege-chip ${picked.has(o.id) ? "siege-chip-on" : ""}`}
                  style={picked.has(o.id) ? { borderColor: army.color, boxShadow: `3px 3px 0 ${army.color}` } : undefined}
                  title={`${o.name} · ${o.typeName} · ${o.about}${o.ghosts ? ` · brings ${o.ghosts} ghosts` : ""}`}
                  onClick={() => arena()?.toggleClass(army.id, o.id as ClassId)}
                >
                  {o.name}
                  {o.ghosts ? " ✦" : ""}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
