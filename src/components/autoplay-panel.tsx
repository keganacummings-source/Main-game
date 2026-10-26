import { memo, useEffect, useState } from "react";
import { useSnapPick } from "./use-snap";

type GameProp = { game: { toggleAutoplay?: () => void; setOrder?: (id: string) => void; moveTask?: (id: string, dir: number) => void } | null };

const PANEL_KEY = "turbz-autoplay-open";

/**
 * The autoplay panel.
 *
 * Autoplay used to be a row of small unlabelled buttons wedged into the TRACKING list between a
 * ghost-jar timer and a witch count, with a single "Autoplay · looking" line underneath. You could
 * not tell what it was doing, why it was standing still, or what order it would do things in.
 *
 * So it has its own panel: a switch, a line saying what it is on and why, and the task list in
 * YOUR order — each one switchable, each one movable, and the one being worked right now marked.
 */
export const AutoplayPanel = memo(function AutoplayPanel({ game }: GameProp) {
  const s = useSnapPick(["auto"] as const);
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(PANEL_KEY);
      return saved === null ? window.innerWidth > 760 : saved !== "0";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(PANEL_KEY, open ? "1" : "0"); } catch { /* private mode */ }
  }, [open]);

  const auto = s.auto;
  if (!auto) return null;

  const offCount = auto.tasks.filter((t) => !t.on).length;

  return (
    <div className="hud-auto px-panel" data-testid="autoplay-panel">
      <button type="button" className="hud-tracker-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="ui-section-title">AUTOPLAY · {auto.on ? "ON" : "OFF"}</span>
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>

      {/* Folded away, the one thing worth knowing is still on screen. */}
      {!open && auto.on && <p className="text-dim hud-auto-doing">{auto.why}</p>}

      {open && (
        <div className="hud-tracker-body">
          <button
            type="button"
            className={`px-btn ui-btn-sm ${auto.on ? "px-btn-kyo" : ""}`}
            data-testid="autoplay-toggle"
            onClick={() => game?.toggleAutoplay?.()}
          >
            {auto.on ? "Autoplay on — stop" : "Autoplay off — start"}
          </button>

          {auto.on && <p className="text-kyo hud-auto-doing" data-testid="autoplay-why">{auto.why}</p>}

          <p className="ui-section-title hud-auto-head">
            TASKS {offCount ? <span className="text-dim">· {offCount} off</span> : null}
          </p>
          <p className="ui-field-hint">
            Worked from the top down: autoplay takes the first task it can do right now. Move one up to
            prefer it.
          </p>

          <ul className="hud-auto-list" data-testid="autoplay-tasks">
            {auto.tasks.map((t, i) => (
              <li key={t.id} className={`hud-auto-task ${t.active ? "hud-auto-task-on" : ""}`} data-testid={`autoplay-task-${t.id}`}>
                <span className="hud-auto-rank text-dim" aria-hidden="true">{i + 1}</span>
                <button
                  type="button"
                  className={`px-btn ui-btn-sm hud-auto-name ${t.on ? "px-btn-kyo" : ""}`}
                  title={t.about}
                  aria-pressed={t.on}
                  onClick={() => game?.setOrder?.(t.id)}
                >
                  {t.label}
                </button>
                <span className="hud-auto-state text-dim">{t.active ? "doing this" : t.on ? "" : "off"}</span>
                <span className="hud-auto-move">
                  <button
                    type="button"
                    className="px-btn ui-btn-sm"
                    disabled={i === 0}
                    aria-label={`Move ${t.label} up`}
                    onClick={() => game?.moveTask?.(t.id, -1)}
                  >↑</button>
                  <button
                    type="button"
                    className="px-btn ui-btn-sm"
                    disabled={i === auto.tasks.length - 1}
                    aria-label={`Move ${t.label} down`}
                    onClick={() => game?.moveTask?.(t.id, 1)}
                  >↓</button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});
