import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Backpack, Compass, FlaskConical, Ghost, Map as MapIcon, Menu, ScrollText, Store, Swords, Tent, User, Shield } from "lucide-react";
import { TYPES } from "@/game/content";
import type { TurbzGame } from "@/game/engine";
import type { GimmickView } from "@/game/class-gimmicks";
import { useSnapPick } from "./use-snap";
import { Meter } from "./ui-kit";

type GameProp = { game: TurbzGame | null };

/** Top-left: who you are, health, experience, effects and the latest line of the log. */
export const HudVitals = memo(function HudVitals({ game: _game }: GameProp) {
  const s = useSnapPick(["name", "className", "level", "kyo", "hp", "maxHp", "shield", "xp", "xpNeed", "region", "effects", "log", "rules", "pools", "turbz"] as const);
  const low = s.hp / Math.max(1, s.maxHp) < 0.3;
  return (
    <div className={`hud-vitals px-panel ${low ? "hud-vitals-low" : ""}`} data-testid="vitals-dock">
      <div className="hud-vitals-head">
        <span className="lv-badge" data-testid="vitals-level">LV {s.level}</span>
        <span className="hud-vitals-name">{s.name}<span className="text-dim"> · {s.className}</span></span>
        <span className="hud-vitals-kyo" data-testid="vitals-kyo">{s.kyo.toLocaleString()} kyo</span>
      </div>
      <Meter kind="hp" label="HP" value={s.hp} max={s.maxHp} detail={`${s.hp}/${s.maxHp}${s.shield > 0 ? ` +${s.shield}` : ""}`} />
      {s.pools && (
        <>
          <Meter kind="void" small label={s.pools.manaSlow > 0 ? "MANA · SLOW" : "MANA"} value={s.pools.mana} max={s.pools.maxMana} detail={`${s.pools.mana}/${s.pools.maxMana}`} />
          <Meter kind="kyo" small label={s.pools.stamSlow > 0 ? "STAMINA · SLOW" : "STAMINA"} value={s.pools.stam} max={s.pools.maxStam} detail={`${s.pools.stam}/${s.pools.maxStam}`} />
        </>
      )}
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
      <p className="hud-vitals-region text-dim">{s.region}{s.turbz ? " · TURBZ" : s.rules === "hardcore" ? " · Hardcore" : ""}</p>
      {s.log[0] && <p className="hud-log" data-testid="vitals-log">{s.log[0]}</p>}
    </div>
  );
});

const TRAIT_TAG: Record<string, string> = {
  vampiric: "VAMP", thorned: "THRN", warded: "WARD", frenzied: "FRNZ", swift: "SWFT", brutal: "BRUT",
  regenerating: "REGN", evasive: "EVAS", armored: "ARMR", spellward: "SPWD", giant: "GIAN",
};
const TRAIT_ID: Record<string, string> = Object.fromEntries(Object.keys(TRAIT_TAG).map((id) => [id.charAt(0).toUpperCase() + id.slice(1), id]));

function dangerClass(level: number, you: number): string {
  const d = level - you;
  return d >= 6 ? "danger-4" : d >= 3 ? "danger-3" : d >= 0 ? "danger-2" : "danger-1";
}

/** Top-centre: the foe you are fighting, only while you fight. */
export const HudTarget = memo(function HudTarget() {
  const { target, turn, level } = useSnapPick(["target", "turn", "level"] as const);
  if (!target) return null;
  const tag = target.bounty ? `★${target.tier} BOUNTY` : target.hunter ? "HUNTER" : target.boss ? "BOSS" : "";
  const pct = Math.round((target.hp / Math.max(1, target.max)) * 100);
  return (
    <div className={`hud-target px-panel ${target.boss || target.bounty || target.hunter ? "hud-target-elite" : ""}`} data-testid="vitals-foe" style={{ "--foe": TYPES[target.type]?.color } as React.CSSProperties}>
      <div className="hud-target-head">
        <span className={`foe-lv ${dangerClass(target.level, level)}`}>{target.level}</span>
        {tag && <span className="hud-target-tag">{tag}</span>}
        <span className="hud-target-name">{target.name}</span>
        <span className={`foe-type type-${target.type}`}>{TYPES[target.type]?.name}</span>
      </div>
      <div className="foe-bar"><i style={{ width: `${pct}%` }} /><span>{target.hp.toLocaleString()} / {target.max.toLocaleString()}</span></div>
      <div className="hud-target-foot">
        <span className="text-dim">{target.hint}</span>
        {turn && <span className={turn === "Your turn" || turn === "Your verse" ? "text-kyo" : "text-dim"}>{turn}</span>}
      </div>
      {target.enchants.length > 0 && (
        <div className="trait-row">
          {target.enchants.map((n) => <span key={n} className={`trait-chip trait-${TRAIT_ID[n] ?? "x"}`}>{n}</span>)}
        </div>
      )}
    </div>
  );
});

/** Mouse-over card: follows the cursor smoothly; the engine only supplies what to show. */
export const HudHover = memo(function HudHover() {
  const { hover, panel, menu, level } = useSnapPick(["hover", "panel", "menu", "level"] as const);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const place = (x: number, y: number) => {
      const el = ref.current;
      if (!el) return;
      const w = el.offsetWidth, h = el.offsetHeight;
      const left = x + 18 + w > window.innerWidth - 8 ? x - w - 14 : x + 18;
      const top = Math.min(Math.max(8, y - h / 2), window.innerHeight - h - 8);
      el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    };
    const move = (e: PointerEvent) => place(e.clientX, e.clientY);
    window.addEventListener("pointermove", move, { passive: true });
    if (hover) {
      const canvas = document.querySelector("canvas");
      const r = canvas?.getBoundingClientRect();
      place(hover.x + (r?.left ?? 0), hover.y + (r?.top ?? 0));
    }
    return () => window.removeEventListener("pointermove", move);
  }, [hover]);
  if (!hover || panel || menu) return null;
  if (hover.kind === "info") {
    return (
      <div ref={ref} className="hover-card hover-card-info px-panel" data-testid="hover-card">
        <p className="hover-name">{hover.name}</p>
        {hover.lines.map((l) => <p key={l} className="text-dim">{l}</p>)}
      </div>
    );
  }
  const pct = Math.round(((hover.hp ?? 0) / Math.max(1, hover.max ?? 1)) * 100);
  return (
    <div ref={ref} className={`hover-card px-panel ${hover.tag ? "hover-card-elite" : ""}`} data-testid="hover-card" style={{ "--foe": hover.type ? TYPES[hover.type]?.color : undefined } as React.CSSProperties}>
      <div className="hover-head">
        <span className={`foe-lv ${dangerClass(hover.level ?? 1, hover.you ?? level)}`}>{hover.level}</span>
        <span className="hover-name">{hover.name}</span>
        {hover.type && <span className={`foe-type type-${hover.type}`}>{TYPES[hover.type]?.name}</span>}
      </div>
      {hover.tag && <span className="hud-target-tag">{hover.tag}</span>}
      <div className="foe-bar"><i style={{ width: `${pct}%` }} /><span>{hover.hp?.toLocaleString()} / {hover.max?.toLocaleString()}</span></div>
      <p className="hover-favor">{hover.favor}</p>
      {(hover.traits ?? []).length > 0 && (
        <ul className="hover-traits">
          {hover.traits!.map((t) => (
            <li key={t.id}><span className={`trait-chip trait-${t.id}`}>{TRAIT_TAG[t.id] ?? t.name}</span> <b>{t.name}</b> <span className="text-dim">{t.about}</span></li>
          ))}
        </ul>
      )}
      {(hover.moves ?? []).length > 0 && <p className="hover-moves"><span className="text-dim">Moves </span>{hover.moves!.join(" · ")}</p>}
      {hover.lines.map((l) => <p key={l} className="text-kyo">{l}</p>)}
    </div>
  );
});

const TRACK_KEY = "turbz-hud-tracker-open";

/** Top-right: everything you are tracking. Folds to one line. */
export const HudTracker = memo(function HudTracker({ game }: GameProp) {
  const s = useSnapPick(["clock", "survival", "sleeping", "build", "bounties", "hunt", "mapQuests", "shrine", "jarLeft", "autoplay", "grind", "rules", "unstuck", "pools", "orders", "turbz"] as const);
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
  if (s.survival && !s.turbz) {
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
  if (s.turbz) rows.push(<p key="witches" className="text-kyo">Witches grinding · {s.turbz.witches}</p>);
  if (s.turbz && s.turbz.back > 0) rows.push(<p key="witchback" className="text-dim">Witch returns in {Math.floor(s.turbz.back / 60)}:{String(s.turbz.back % 60).padStart(2, "0")}</p>);
  if (s.orders) rows.push(
    <div key="orders" className="hud-surv" data-testid="turbz-orders">
      {s.orders.map((o) => (
        <button key={o.id} type="button" className={`px-btn ui-btn-sm ${o.on ? "px-btn-kyo" : ""}`} onClick={() => game?.setOrder?.(o.id)}>{o.label}</button>
      ))}
    </div>,
  );
  if (s.autoplay) rows.push(<p key="auto" className="text-kyo">Autoplay · {s.grind || "looking"}</p>);
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
  { id: "gear", label: "Gear", key: "I", Icon: Shield, testid: "hud-gear-btn" },
  { id: "bag", label: "Bag", key: "B", Icon: Backpack, testid: "hud-bag-btn" },
  { id: "moves", label: "Verses", key: "V", Icon: ScrollText, testid: "hud-moves-btn" },
  { id: "ghost", label: "Spirits", key: "G", Icon: Ghost, testid: "hud-spirits-btn" },
  { id: "craft", label: "Craft", key: "X", Icon: FlaskConical, testid: "hud-craft-btn" },
  { id: "quests", label: "Quests", key: "Q", Icon: Compass, testid: "hud-quests-btn" },
  { id: "bounty", label: "Bounty", key: "", Icon: Swords, testid: "hud-bounty-btn" },
  { id: "trade", label: "Market", key: "T", Icon: Store, testid: "hud-market-btn" },
  { id: "survival", label: "Camp", key: "H", Icon: Tent, testid: "hud-survival-btn", hardcore: true },
  { id: "map", label: "Map", key: "M", Icon: MapIcon, testid: "hud-map-btn" },
] as const;

/** Bottom-centre: verses and every menu, in one place. */
export const HudDock = memo(function HudDock({ game }: GameProp) {
  const s = useSnapPick(["bar", "abilities", "rules", "autoplay", "autoCombat", "panel", "quick", "quickCd", "gimmick"] as const);
  const smart = s.autoCombat || s.autoplay;
  const q = s.quick[0];
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
        <button type="button" data-testid="attack-btn" className="hot-slot hot-attack" title={smart ? "Auto combat is on. She picks the swing. Press Attack to force one (Numpad 0)." : "Auto combat is off. Press Attack (Numpad 0)."} onClick={() => game?.attack()}>
          <kbd className="key-badge hot-key">0</kbd>
          <span className="hot-name">Attack</span>
          <span className="hot-tag">{smart ? "smart" : "manual"}</span>
        </button>
        <button type="button" data-testid="space-btn" className={`hot-slot hot-space ${q ? "" : "hot-space-empty"}`}
          title={q ? `Space: ${s.quick.map((x) => `${x.name} ×${x.count}`).join(" → ")}` : "Nothing on Space. In the Bag (B), choose Set to Space on an item."}
          onClick={() => (q ? game?.useQuick() : game?.toggle("bag"))}>
          <kbd className="key-badge hot-key">Space</kbd>
          <span className="hot-name">{q ? q.name : "Space"}</span>
          <span className="hot-tag">{q ? `×${q.count}${s.quick.length > 1 ? ` · +${s.quick.length - 1} queued` : ""}` : "set in Bag"}</span>
          {s.quickCd > 0 && <span className="hot-cd-num">{s.quickCd}</span>}
        </button>
        {s.gimmick && <GimmickSlot game={game} g={s.gimmick} />}
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
  const s = useSnapPick(["autoplay", "autoCombat", "unstuck", "rules"] as const);
  return (
    <div className="hud-fabs">
      <button type="button" className={`px-btn ui-btn-sm ${s.autoCombat ? "px-btn-kyo" : ""}`} onClick={() => game?.toggleAutoCombat()}>
        {s.autoCombat ? "Combat auto" : "Combat manual"}
      </button>
      <button type="button" className={`px-btn ui-btn-sm ${s.autoplay ? "px-btn-kyo" : ""}`} onClick={() => game?.toggleAutoplay()}>
        {s.autoplay ? "Stop auto" : "Autoplay"}
      </button>
      <button type="button" className={`px-btn ui-btn-sm ${s.unstuck ? "px-btn-kyo" : ""}`} data-testid="unstuck-btn" onClick={() => game?.beginUnstuck()}>
        {s.unstuck ? `Unstuck ${s.unstuck}` : "Unstuck"}
      </button>
    </div>
  );
});

/** The class gimmick on R: cooldown, time left, and the boss-skin catalog for Trophy Skins. */
function GimmickSlot({ game, g }: { game: TurbzGame | null; g: GimmickView }) {
  const [open, setOpen] = useState(false);
  const cooling = !g.active && g.cd > 0.05;
  const pct = cooling ? Math.min(100, (g.cd / Math.max(1, g.cdMax)) * 100) : 0;
  return (
    <span className="gim-wrap">
      <button type="button" data-testid="gimmick-btn" className={`hot-slot hot-gimmick ${g.active ? "hot-gimmick-on" : cooling ? "hot-slot-cd" : "hot-slot-ready"}`} title={g.about} onClick={() => game?.gim?.activate()}>
        <kbd className="key-badge hot-key">R</kbd>
        <span className="hot-name">{g.name}</span>
        <span className="hot-tag">{g.active ? `${g.left.toFixed(0)}s left` : g.id === "blink" ? "dbl-click map" : "gimmick"}</span>
        {cooling && (<><span className="hot-cd" style={{ height: `${pct}%` }} /><span className="hot-cd-num">{g.cd.toFixed(g.cd < 1 ? 1 : 0)}</span></>)}
      </button>
      {g.id === "bossform" && (
        <button type="button" className="gim-cat-btn" data-testid="boss-catalog-btn" title="Trophy catalog: pick a boss skin" onClick={() => setOpen(!open)}>SKINS {g.catalog.length}</button>
      )}
      {open && g.id === "bossform" && createPortal(
        <div className="px-panel gim-catalog" data-testid="boss-catalog">
          <button type="button" className="px-btn ui-btn-sm" data-testid="boss-catalog-close" onClick={() => setOpen(false)}>Close</button>
          <p className="font-display text-[9px] text-kyo">TROPHY CATALOG</p>
          {g.catalog.length === 0 && <p className="text-dim">Slay a boss to take its skin.</p>}
          {g.catalog.map((b) => (
            <button key={b.key} type="button" data-testid={`boss-form-${b.key}`} className={`px-btn ui-btn-sm ${g.pick === b.key ? "px-btn-kyo" : ""}`} onClick={() => { game?.gim?.pickBoss(b.key); setOpen(false); }}>
              {b.name} · Lv {b.level}
            </button>
          ))}
        </div>, document.body,
      )}
    </span>
  );
}
