import { memo, useEffect, useState } from "react";
import { Backpack, Compass, FlaskConical, Ghost, Map as MapIcon, Menu, ScrollText, Store, Swords, Tent, User, Users } from "lucide-react";
import { TYPES } from "@/game/content";
import type { TurbzGame } from "@/game/engine";
import { useSnapPick } from "./use-snap";
import { Meter } from "./ui-kit";

type GameProp = { game: TurbzGame | null };

/** Top-left: who you are, health, experience, effects and the latest line of the log. */
export const HudVitals = memo(function HudVitals({ game: _game }: GameProp) {
  const s = useSnapPick(["name", "className", "level", "kyo", "hp", "maxHp", "shield", "xp", "xpNeed", "region", "effects", "log", "rules"] as const);
  const low = s.hp / Math.max(1, s.maxHp) < 0.3;
  return (
    <div className={`hud-vitals px-panel ${low ? "hud-vitals-low" : ""}`} data-testid="vitals-dock">
      <div className="hud-vitals-head">
        <span className="lv-badge" data-testid="vitals-level">LV {s.level}</span>
        <span className="hud-vitals-name">{s.name}<span className="text-dim"> · {s.className}</span></span>
        <span className="hud-vitals-kyo" data-testid="vitals-kyo">{s.kyo.toLocaleString()} kyo</span>
      </div>
      <Meter kind="hp" label="HP" value={s.hp} max={s.maxHp} detail={`${s.hp}/${s.maxHp}${s.shield > 0 ? ` +${s.shield}` : ""}`} />
      <Meter kind="xp" small label="XP" value={s.xp} max={s.xpNeed} />
      {s.effects.length > 0 && (
        <div className="effect-row" data-testid="vitals-effects">
          {s.effects.map((e) => (
            <span key={e.id} className={`effect-chip ${e.good ? "effect-good" : "effect-bad"}`} title={e.label}>
              {e.label.split(" (")[0]}{e.t ? ` ${e.t}s` : ""}
            </span>
          ))}
        </div>
      )}
      <p className="hud-vitals-region text-dim">{s.region}{s.rules === "hardcore" ? " · Hardcore" : ""}</p>
      {s.log[0] && <p className="hud-log" data-testid="vitals-log">{s.log[0]}</p>}
    </div>
  );
});

/** Top-centre: the foe you are fighting, only while you fight. */
export const HudTarget = memo(function HudTarget() {
  const { target, turn } = useSnapPick(["target", "turn"] as const);
  if (!target) return null;
  const tag = target.bounty ? `★${target.tier} BOUNTY` : target.hunter ? "HUNTER" : target.boss ? "BOSS" : "";
  return (
    <div className={`hud-target px-panel ${target.boss || target.bounty || target.hunter ? "hud-target-elite" : ""}`} data-testid="vitals-foe">
      <div className="hud-target-head">
        {tag && <span className="hud-target-tag">{tag}</span>}
        <span className="hud-target-name">{target.name}</span>
        <span className="text-dim">Lv {target.level}</span>
        <span className={`type-${target.type}`}>{TYPES[target.type]?.name}</span>
      </div>
      <Meter kind="bad" value={target.hp} max={target.max} />
      <div className="hud-target-foot">
        <span className="text-dim">{target.hint}</span>
        {turn && <span className={turn === "Your turn" || turn === "Your verse" ? "text-kyo" : "text-dim"}>{turn}</span>}
      </div>
      {target.enchants.length > 0 && <p className="hud-target-ench">{target.enchants.join(" · ")}</p>}
    </div>
  );
});

const TRACK_KEY = "turbz-hud-tracker-open";

/** Top-right: everything you are tracking. Folds to one line. */
export const HudTracker = memo(function HudTracker({ game }: GameProp) {
  const s = useSnapPick(["clock", "survival", "sleeping", "build", "bounties", "hunt", "mapQuests", "shrine", "roomCode", "lobby", "jarLeft", "autoplay", "grind", "rules", "unstuck"] as const);
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(TRACK_KEY);
      return saved === null ? window.innerWidth > 760 : saved !== "0";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(TRACK_KEY, open ? "1" : "0");
    } catch {
      /* private mode */
    }
  }, [open]);
  const rows: React.ReactNode[] = [];
  if (s.clock.active) rows.push(<p key="clock" className={s.clock.phase === "night" ? "text-blood" : "text-kyo"} data-testid="hud-clock">{s.clock.phase === "night" ? "☾" : "☀"} {s.clock.label} · {s.clock.left}</p>);
  if (s.survival) {
    rows.push(
      <div key="surv" className="hud-surv">
        <Meter small kind={s.survival.hunger < 15 ? "bad" : "good"} label="FOOD" value={s.survival.hunger} max={100} detail={Math.ceil(s.survival.hunger)} />
        <Meter small kind={s.survival.thirst < 15 ? "bad" : "good"} label="WATER" value={s.survival.thirst} max={100} detail={Math.ceil(s.survival.thirst)} />
        <Meter small kind={s.survival.rest < 15 ? "bad" : "good"} label="SLEEP" value={s.survival.rest} max={100} detail={Math.ceil(s.survival.rest)} />
      </div>,
    );
    if (s.sleeping) rows.push(<button key="wake" type="button" className="px-btn ui-btn-sm" onClick={() => game?.survivalAction("sleep")}>Sleeping · wake up</button>);
    if (s.build.on) rows.push(<button key="build" type="button" className="px-btn px-btn-kyo ui-btn-sm" onClick={() => game?.toggleBuild(false)}>Building · {s.build.logs} logs · stop</button>);
  }
  s.bounties.forEach((line, i) => rows.push(<p key={`b${i}`} className="text-blood" data-testid={i === 0 ? "vitals-bounty" : undefined}>{line}</p>));
  if (s.hunt.wanted > 0) rows.push(<p key="wanted" className="text-blood">WANTED {s.hunt.wanted} · {s.hunt.hunters ? `${s.hunt.hunters} hunters on you` : `squad in ${s.hunt.waveIn}s`}</p>);
  else if (s.hunt.starsOn && s.hunt.stars > 0) rows.push(<p key="stars" className="text-kyo">Bounty Stars {"★".repeat(s.hunt.stars)}<span className="text-dim">{"☆".repeat(Math.max(0, s.hunt.need - s.hunt.stars))}</span></p>);
  const mq = s.mapQuests?.[0];
  if (mq) rows.push(<p key="mq" className="text-kyo" data-testid="vitals-map-quest">◆ {mq.name}: <span className="text-bone">{mq.ready ? `report to ${mq.turnIn}` : (mq.lines.find((l) => l.startsWith("[ ]")) ?? "").slice(4)}</span></p>);
  if (s.shrine) rows.push(<p key="shrine" className="text-kyo">{s.shrine}</p>);
  if (s.jarLeft > 0) rows.push(<p key="jar" className="text-kyo">Ghost jar · {s.jarLeft}s</p>);
  if (s.autoplay) rows.push(<p key="auto" className="text-kyo">{s.rules === "hardcore" ? "Grinding" : "Autoplay"} · {s.grind || "looking"}</p>);
  if (s.roomCode) rows.push(<p key="lobby" className="text-kyo" data-testid="vitals-lobby">Lobby {s.roomCode} · {s.lobby.members.length} in party</p>);
  if (s.unstuck) rows.push(<p key="unstuck" className="text-kyo">Unstuck in {s.unstuck}</p>);
  if (!rows.length) return null;
  return (
    <div className="hud-tracker px-panel" data-testid="hud-tracker">
      <button type="button" className="hud-tracker-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="ui-section-title">TRACKING · {rows.length}</span>
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open && <div className="hud-tracker-body">{rows}</div>}
    </div>
  );
});

const MENUS = [
  { id: "sheet", label: "Sheet", key: "C", Icon: User, testid: "hud-sheet-btn" },
  { id: "bag", label: "Bag", key: "B", Icon: Backpack, testid: "hud-bag-btn" },
  { id: "moves", label: "Verses", key: "V", Icon: ScrollText, testid: "hud-moves-btn" },
  { id: "ghost", label: "Spirits", key: "G", Icon: Ghost, testid: "hud-spirits-btn" },
  { id: "craft", label: "Craft", key: "X", Icon: FlaskConical, testid: "hud-craft-btn" },
  { id: "quests", label: "Quests", key: "Q", Icon: Compass, testid: "hud-quests-btn" },
  { id: "bounty", label: "Bounty", key: "", Icon: Swords, testid: "hud-bounty-btn" },
  { id: "trade", label: "Market", key: "T", Icon: Store, testid: "hud-market-btn" },
  { id: "survival", label: "Camp", key: "H", Icon: Tent, testid: "hud-survival-btn", hardcore: true },
  { id: "map", label: "Map", key: "M", Icon: MapIcon, testid: "hud-map-btn" },
  { id: "lobby", label: "Lobby", key: "L", Icon: Users, testid: "hud-lobby-btn" },
] as const;

/** Bottom-centre: verses and every menu, in one place. */
export const HudDock = memo(function HudDock({ game }: GameProp) {
  const s = useSnapPick(["bar", "abilities", "rules", "autoplay", "panel"] as const);
  const manual = s.rules === "hardcore" && !s.autoplay;
  return (
    <div className="hud-dock">
      <div className="hud-menu" role="toolbar" aria-label="Menus">
        {MENUS.filter((m) => !("hardcore" in m) || s.rules === "hardcore").map(({ id, label, key, Icon, testid }) => (
          <button
            key={id}
            type="button"
            className={`hud-menu-btn ${s.panel === id ? "hud-menu-btn-on" : ""}`}
            data-testid={testid}
            title={key ? `${label} (${key})` : label}
            aria-label={key ? `${label} (${key})` : label}
            onClick={() => (id === "trade" ? game?.toggleTrade() : game?.toggle(id))}
          >
            <Icon size={17} />
            <span className="hud-menu-label">{label}</span>
            {key && <kbd className="key-badge">{key}</kbd>}
          </button>
        ))}
        <button type="button" className={`hud-menu-btn ${s.panel === "pause" ? "hud-menu-btn-on" : ""}`} title="Menu (Esc)" aria-label="Menu (Esc)" onClick={() => game?.toggle("pause")}>
          <Menu size={17} />
          <span className="hud-menu-label">Menu</span>
          <kbd className="key-badge">Esc</kbd>
        </button>
      </div>
      <div className="hotbar px-panel" data-testid="move-bar">
        <button type="button" data-testid="attack-btn" className="hot-slot hot-attack" title={manual ? "Hardcore only swings when you press Attack (Numpad 0)" : "Attack the nearest thing in range (Numpad 0)"} onClick={() => game?.attack()}>
          <kbd className="key-badge hot-key">0</kbd>
          <span className="hot-name">Attack</span>
          <span className="hot-tag">{manual ? "manual" : "nearest"}</span>
        </button>
        {s.bar.map((move, i) => {
          const cooling = move.cd > 0.05;
          const pct = cooling ? Math.min(100, (move.cd / Math.max(0.05, move.max)) * 100) : 0;
          return (
            <button
              key={`${move.id}-${i}`}
              type="button"
              data-testid={`move-btn-${move.id}`}
              className={`hot-slot hot-${move.type} ${cooling ? "hot-slot-cd" : "hot-slot-ready"}`}
              title={`${s.abilities.find((a) => a.id === move.id)?.about ?? move.name} · key ${i + 1}`}
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
        {s.bar.length === 0 && <span className="hot-empty text-dim">Equip verses in Verses (V)</span>}
      </div>
    </div>
  );
});

/** Bottom-right: autoplay and unstuck. */
export const HudFabs = memo(function HudFabs({ game }: GameProp) {
  const s = useSnapPick(["autoplay", "unstuck", "rules"] as const);
  return (
    <div className="hud-fabs">
      <button type="button" className={`px-btn ui-btn-sm ${s.autoplay ? "px-btn-kyo" : ""}`} onClick={() => game?.toggleAutoplay()}>
        {s.autoplay ? (s.rules === "hardcore" ? "Stop grind" : "Stop auto") : s.rules === "hardcore" ? "Grind nodes" : "Autoplay"}
      </button>
      <button type="button" className={`px-btn ui-btn-sm ${s.unstuck ? "px-btn-kyo" : ""}`} data-testid="unstuck-btn" onClick={() => game?.beginUnstuck()}>
        {s.unstuck ? `Unstuck ${s.unstuck}` : "Unstuck"}
      </button>
    </div>
  );
});
