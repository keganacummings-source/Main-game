import { Backpack, FlaskConical, Ghost, Map as MapIcon, ScrollText, User, Users } from "lucide-react";
import type { getSnap, TurbzGame } from "@/game/engine";

type Snap = ReturnType<typeof getSnap>;

function Meter({ label, value, max, kind, extra, testid }: { label: string; value: number; max: number; kind: string; extra?: string; testid?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={`meter meter-${kind}`} data-testid={testid ? `${testid}-meter` : undefined}>
      <div className="meter-fill" style={{ width: `${pct}%` }} />
      <span className="meter-label">{label}</span>
      <span className="meter-value" data-testid={testid}>
        {value}/{max}
        {extra}
      </span>
    </div>
  );
}

const ACTIONS = [
  { id: "sheet", label: "Sheet", key: "C", Icon: User, testid: "hud-sheet-btn" },
  { id: "bag", label: "Bag", key: "B", Icon: Backpack, testid: "hud-bag-btn" },
  { id: "moves", label: "Verses", key: "V", Icon: ScrollText, testid: "hud-moves-btn" },
  { id: "ghost", label: "Spirits", key: "G", Icon: Ghost, testid: "hud-spirits-btn" },
  { id: "craft", label: "Craft", key: "X", Icon: FlaskConical, testid: "hud-craft-btn" },
  { id: "map", label: "Map", key: "M", Icon: MapIcon, testid: "hud-map-btn" },
  { id: "lobby", label: "Lobby", key: "L", Icon: Users, testid: "hud-lobby-btn" },
] as const;

export function HudActions({ snap, game }: { snap: Snap; game: TurbzGame | null }) {
  return (
    <div className="hud-actions" role="toolbar" aria-label="Menus">
      {ACTIONS.map(({ id, label, key, Icon, testid }) => (
        <button
          key={id}
          type="button"
          className={`hud-icon-btn ${snap.panel === id ? "hud-icon-btn-on" : ""}`}
          data-testid={testid}
          title={`${label} (${key})`}
          aria-label={`${label} (${key})`}
          onClick={() => game?.toggle(id)}
        >
          <Icon size={18} />
          <span className="hud-icon-label">{label}</span>
          <kbd className="key-badge">{key}</kbd>
        </button>
      ))}
    </div>
  );
}

export function Vitals({ snap }: { snap: Snap }) {
  const effects = snap.sheet?.effects ?? [];
  return (
    <>
      <div className="vitals-head">
        <span className="lv-badge" data-testid="vitals-level">LV {snap.level}</span>
        <span className="truncate text-dim">{snap.region}</span>
        <span className="ml-auto whitespace-nowrap text-kyo" data-testid="vitals-kyo">{snap.kyo} kyo</span>
      </div>
      <Meter label="HP" value={snap.hp} max={snap.maxHp} kind="hp" extra={snap.shield > 0 ? ` +${snap.shield}` : ""} testid="vitals-hp" />
      <Meter label="XP" value={snap.xp} max={snap.xpNeed} kind="xp" testid="vitals-xp" />
      {effects.length > 0 && (
        <div className="effect-row" data-testid="vitals-effects">
          {effects.map((e) => (
            <span key={e.id} className={`effect-chip ${e.good ? "effect-good" : "effect-bad"}`} title={e.label}>
              {e.label.split(" (")[0]} {Math.ceil(e.t)}s
            </span>
          ))}
        </div>
      )}
    </>
  );
}

export function VerseBar({ snap, game }: { snap: Snap; game: TurbzGame | null }) {
  const manual = snap.rules === "hardcore" && !snap.autoplay;
  return (
    <div>
      {manual && <p className="vitals-line text-dim">Hardcore only swings when you press Attack.</p>}
      <div className="hotbar" data-testid="move-bar">
        <button
          type="button"
          data-testid="attack-btn"
          className="hot-slot hot-attack"
          title="Attack the nearest thing in range (Numpad 0)"
          onClick={() => game?.attack()}
        >
          <kbd className="key-badge hot-key">0</kbd>
          <span className="hot-name">Attack</span>
          <span className="hot-tag">nearest</span>
        </button>
        {snap.bar.map((move, i) => {
          const cooling = move.cd > 0.05;
          const pct = cooling ? Math.min(100, (move.cd / Math.max(0.05, move.max)) * 100) : 0;
          return (
            <button
              key={`${move.id}-${i}`}
              type="button"
              data-testid={`move-btn-${move.id}`}
              className={`hot-slot hot-${move.type} ${cooling ? "hot-slot-cd" : "hot-slot-ready"}`}
              title={`${snap.abilities.find((a) => a.id === move.id)?.about ?? move.name} · key ${i + 1} or numpad ${i + 1}`}
              onClick={() => game?.cast(i)}
            >
              {i < 9 && <kbd className="key-badge hot-key">{i + 1}</kbd>}
              <span className={`hot-name type-${move.type}`}>{move.name}</span>
              <span className="hot-tag">{move.tag.split(" · ")[0]}</span>
              {cooling && (
                <>
                  <span className="hot-cd" style={{ height: `${pct}%` }} />
                  <span className="hot-cd-num">{move.cd.toFixed(move.cd < 1 ? 1 : 0)}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
