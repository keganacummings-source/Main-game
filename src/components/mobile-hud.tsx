/**
 * The in-game interface for mobile mode.
 *
 * This is not the desktop HUD rearranged — it replaces it. The desktop one assumes a mouse and a
 * lot of screen: eleven menu buttons in a toolbar across the bottom, a vitals panel, a foe panel, a
 * tracking column and an autoplay panel all on screen at once, hover cards, and a keyboard badge on
 * every control. On a phone that is most of the picture covered by things you cannot press.
 *
 * What is here instead:
 *
 *   - one strip across the top: who you are, your health, and the foe when there is one
 *   - a verse strip you can swipe along, with real cooldown faces
 *   - a thumb cluster bottom-right: attack, the Space item and your R skill
 *   - one ☰ button that opens every menu as a full-screen list
 *
 * Nothing is taken away. Everything the desktop dock reaches is in the ☰ sheet, and the panels
 * themselves become full-screen sheets (see float-win.tsx), so they are readable on a narrow screen
 * instead of being a draggable window with nowhere to drag to.
 */
import { memo, useState } from "react";
import { Bot, LifeBuoy, Menu, Settings, Swords, X } from "lucide-react";
import { useSnapPick } from "./use-snap";
import { Meter } from "./ui-kit";
import { MOBILE_MENUS } from "./hud";
import { TYPES } from "@/game/content";
import type { TurbzGame } from "@/game/engine";

type GameProp = { game: TurbzGame | null };

/** Health, who you are, and the foe — the only three things worth permanent screen space. */
const MobileTop = memo(function MobileTop({ game }: GameProp) {
  const s = useSnapPick(["name", "level", "hp", "maxHp", "shield", "kyo", "pools", "target", "effects", "log"] as const);
  const t = s.target;
  const low = s.hp / Math.max(1, s.maxHp) < 0.3;
  return (
    <div className={`mob-top ${low ? "mob-top-low" : ""}`} data-testid="mob-top">
      <button type="button" className="mob-top-id" onClick={() => game?.toggle("sheet")} aria-label="Character sheet">
        <span className="lv-badge">LV {s.level}</span>
        <span className="mob-top-name">{s.name}</span>
        <span className="mob-top-kyo">{s.kyo.toLocaleString()}</span>
      </button>
      <Meter kind="hp" value={s.hp} max={s.maxHp} detail={`${s.hp}/${s.maxHp}${s.shield > 0 ? ` +${s.shield}` : ""}`} small />
      {s.pools && (
        <div className="mob-pools">
          <Meter kind="void" small value={s.pools.mana} max={s.pools.maxMana} detail={`${s.pools.mana}`} />
          <Meter kind="kyo" small value={s.pools.stam} max={s.pools.maxStam} detail={`${s.pools.stam}`} />
        </div>
      )}
      {t && (
        <div className="mob-foe" data-testid="mob-foe" style={{ "--foe": TYPES[t.type]?.color } as React.CSSProperties}>
          <span className="mob-foe-name">{t.name} <span className="text-dim">lv {t.level}</span></span>
          <div className="foe-bar"><i style={{ width: `${Math.max(0, Math.min(100, (t.hp / Math.max(1, t.max)) * 100))}%` }} /></div>
        </div>
      )}
      {s.effects.length > 0 && (
        <div className="mob-effects">
          {s.effects.slice(0, 6).map((e) => (
            <span key={e.id} className={`effect-chip ${e.good ? "effect-good" : "effect-bad"}`}>{e.label.split(" (")[0]}{e.t ? ` ${e.t}` : ""}</span>
          ))}
        </div>
      )}
      {s.log[0] && <p className="mob-log">{s.log[0]}</p>}
    </div>
  );
});

/** The verses, as a strip you swipe along rather than a nine-wide bar nobody can hit. */
const MobileVerses = memo(function MobileVerses({ game }: GameProp) {
  const s = useSnapPick(["bar", "gimmick", "quick", "quickCd", "autoCombat", "autoplay"] as const);
  const q = s.quick[0];
  const smart = s.autoCombat || s.autoplay;
  return (
    <div className="mob-verses" data-testid="mob-verses">
      {s.bar.map((move, i) => {
        const cooling = move.cd > 0.05;
        const pct = cooling ? Math.min(100, (move.cd / Math.max(0.05, move.max)) * 100) : 0;
        return (
          <button
            key={`${move.id}-${i}`}
            type="button"
            data-testid={`mob-move-${move.id}`}
            className={`mob-verse hot-${move.type} ${cooling ? "mob-verse-cd" : ""}`}
            onClick={() => game?.cast(i)}
            aria-label={move.name}
          >
            <span className="mob-verse-name">{move.name}</span>
            {cooling && <span className="mob-verse-mask" style={{ height: `${pct}%` }} />}
            {cooling && <span className="mob-verse-num">{move.cd.toFixed(1)}</span>}
          </button>
        );
      })}
      {/* The Space item rides along at the end of the strip so it is never off the thumb's path. */}
      <button
        type="button"
        className={`mob-verse mob-verse-space ${q ? "" : "mob-verse-empty"}`}
        data-testid="mob-space"
        onClick={() => (q ? game?.useQuick() : game?.toggle("bag"))}
        aria-label={q ? `Use ${q.name}` : "Nothing on Space"}
      >
        <span className="mob-verse-name">{q ? q.name : "Space"}</span>
        <span className="mob-verse-tag">{q ? `×${q.count}` : "set in Bag"}</span>
        {s.quickCd > 0 && <span className="mob-verse-num">{s.quickCd}</span>}
      </button>
      <span className="mob-verse-mode text-dim">{smart ? "auto" : "manual"}</span>
    </div>
  );
});

/** Bottom-right, under the thumb: swing, R skill, menu. */
const MobileThumb = memo(function MobileThumb({ game, onMenu }: GameProp & { onMenu: () => void }) {
  const s = useSnapPick(["gimmick"] as const);
  const g = s.gimmick;
  // Same reading as the desktop slot: an active gimmick is not "cooling", it is running.
  const cooling = !!g && !g.active && g.cd > 0.05;
  return (
    <div className="mob-thumb" data-testid="mob-thumb">
      {g && (
        <button
          type="button"
          className={`mob-fab mob-fab-r ${g.active ? "mob-fab-on" : cooling ? "mob-fab-cd" : ""}`}
          data-testid="mob-gimmick"
          onClick={() => game?.gim?.activate()}
          aria-label={g.name}
        >
          <span className="mob-fab-label">{g.name.split(" ")[0]}</span>
          {g.active && <span className="mob-fab-num">{g.left.toFixed(0)}</span>}
          {cooling && <span className="mob-fab-num">{Math.ceil(g.cd)}</span>}
        </button>
      )}
      <button type="button" className="mob-fab mob-fab-hit" data-testid="mob-attack" onClick={() => game?.attack()} aria-label="Attack">
        <span className="mob-fab-label">HIT</span>
      </button>
      <button type="button" className="mob-fab mob-fab-menu" data-testid="mob-menu-btn" onClick={onMenu} aria-label="Menus">
        <Menu size={24} />
      </button>
    </div>
  );
});

/** Every menu the desktop dock reaches, as one full-screen list. */
const MobileMenuSheet = memo(function MobileMenuSheet({ game, close }: GameProp & { close: () => void }) {
  const s = useSnapPick(["rules", "panel", "autoplay", "autoCombat", "unstuck"] as const);
  const open = (id: string) => {
    close();
    if (id === "trade") game?.toggleTrade();
    else game?.toggle(id);
  };
  return (
    <div className="mob-menu" role="dialog" aria-label="Menus" data-testid="mob-menu">
      <div className="mob-menu-bar">
        <span className="mob-sheet-title">MENUS</span>
        <button type="button" className="mob-sheet-close" onClick={close} aria-label="Close menus"><X size={20} /></button>
      </div>
      <div className="mob-menu-grid">
        {MOBILE_MENUS.filter((m) => !("hardcore" in m && m.hardcore) || s.rules === "hardcore").map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`mob-menu-item ${s.panel === id ? "mob-menu-item-on" : ""}`}
            data-testid={`mob-menu-${id}`}
            onClick={() => open(id)}
          >
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
        <button type="button" className={`mob-menu-item ${s.autoplay ? "mob-menu-item-on" : ""}`} data-testid="mob-menu-auto" onClick={() => { close(); game?.toggleAutoplay?.(); }}>
          <Bot size={22} />
          <span>{s.autoplay ? "Autoplay on" : "Autoplay"}</span>
        </button>
        <button type="button" className={`mob-menu-item ${s.autoCombat ? "mob-menu-item-on" : ""}`} data-testid="mob-menu-autocombat" onClick={() => { close(); game?.toggleAutoCombat?.(); }}>
          <Swords size={22} />
          <span>{s.autoCombat ? "Combat auto" : "Combat manual"}</span>
        </button>
        <button type="button" className={`mob-menu-item ${s.unstuck ? "mob-menu-item-on" : ""}`} data-testid="mob-menu-unstuck" onClick={() => { close(); game?.beginUnstuck?.(); }}>
          <LifeBuoy size={22} />
          <span>{s.unstuck ? `Unstuck ${s.unstuck}` : "Unstuck"}</span>
        </button>
        <button type="button" className="mob-menu-item" data-testid="mob-menu-pause" onClick={() => open("pause")}>
          <Settings size={22} />
          <span>Game menu</span>
        </button>
      </div>
    </div>
  );
});

/** The whole mobile interface. Rendered instead of the desktop HUD, never beside it. */
export const MobileHud = memo(function MobileHud({ game }: GameProp) {
  const s = useSnapPick(["build"] as const);
  const [menu, setMenu] = useState(false);
  // Build mode has its own bottom bar and needs the screen; the thumb cluster would sit on top of it.
  if (s.build.on) return <MobileTop game={game} />;
  return (
    <>
      <MobileTop game={game} />
      <MobileVerses game={game} />
      <MobileThumb game={game} onMenu={() => setMenu(true)} />
      {menu && <MobileMenuSheet game={game} close={() => setMenu(false)} />}
    </>
  );
});
