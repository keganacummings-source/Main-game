import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ALCHEMY_RECIPES, ITEM_BY_ID, TYPES, type TypeId } from "@/game/content";
import { classGendered, CLASS_BY_ID, CLASS_RACE, type ClassId } from "@/game/classes";
import { bestFood } from "@/game/item-use";
import { CAMP_RECIPE_LIST } from "@/game/survival";
import { BUILD_PIECES, BUILD_PIECE_IDS } from "@/game/building";
import { GhostCard, GhostDetailCard, GhostName } from "./ghost-ui";
import { resetLayout } from "@/game/ui-layout";
import type { BoardView } from "@/game/quest-board";
import { verseAreaNote, type Snap, type TurbzGame } from "@/game/engine";
import { onSync, syncState, type SyncState } from "@/game/account-save";
import { ClassPicker, type Pick } from "./character-ui";
import { AccountChip } from "./hub-ui";
import { useSnapPick } from "./use-snap";
import { Chips, ConfirmButton, Empty, Field, Meter, Pips, Section, Tabs } from "./ui-kit";

/** TurboHunt: kyo price of a Ghost Box without materials (matches the engine). */
const GHOST_BOX_KYO = 150;

type GameProp = { game: TurbzGame | null };
const typeClass = (t: TypeId) => `type-${t}`;

// ---------------------------------------------------------------------------
// Skills & account perks
// ---------------------------------------------------------------------------

const PERK_CATS: { id: string; label: string }[] = [
  { id: "all", label: "All" }, { id: "combat", label: "Combat" }, { id: "defense", label: "Defense" }, { id: "spirits", label: "Spirits" },
  { id: "fortune", label: "Fortune" }, { id: "gathering", label: "Gathering" }, { id: "reach", label: "Reach" }, { id: "travel", label: "Travel" },
];

export const SkillsPanel = memo(function SkillsPanel({ game }: GameProp) {
  const s = useSnapPick(["accountLevel", "accountXp", "accountNeed", "perkPoints", "perks", "accountScore", "skills", "skillPoints"] as const);
  const [tab, setTab] = useState<"perks" | "skills">("perks");
  const [cat, setCat] = useState("all");
  const earned = Math.max(0, s.accountLevel - 1) * 5;
  const spent = Math.max(0, earned - s.perkPoints);
  const cats = PERK_CATS.filter((c) => c.id === "all" || s.perks.some((p) => p.cat === c.id));
  const shown = s.perks.filter((p) => cat === "all" || p.cat === cat);
  return (
    <div className="ui-stack">
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "perks", label: `Account perks · ${s.perkPoints}` }, { id: "skills", label: "Skills" }]} />
      {tab === "perks" && (
        <>
          <div className="ui-card ui-stack-sm" data-testid="account-card">
            <div className="ui-row">
              <span>Account <span className="text-kyo">{s.accountLevel}</span></span>
              <span className="text-dim">Score {s.accountScore.toLocaleString()}</span>
            </div>
            <Meter value={s.accountXp} max={s.accountNeed} label="XP" small detail={`${s.accountXp.toLocaleString()}/${s.accountNeed.toLocaleString()} → ${s.accountLevel + 1}`} />
            <div className="ui-row">
              <span><span className="text-kyo" data-testid="perk-points">{s.perkPoints}</span> perk points to spend</span>
              <span className="text-dim">{earned} earned · {spent} spent</span>
            </div>
            <p className="text-dim">Every account level gives 5 perk points. Account XP comes from all the XP your witches earn. Perks, points and skills stay on the account: death, a new witch and Hardcore all keep them.</p>
          </div>
          <Chips value={cat} onChange={setCat} label="Perk kind" options={cats.map((c) => ({ id: c.id, label: c.id === "all" ? c.label : `${c.label} ${s.perks.filter((p) => p.cat === c.id).length}` }))} />
          <div className="ui-grid" style={{ "--min": "230px" } as React.CSSProperties}>
            {shown.map((p) => (
              <div key={p.id} className={`ui-card perk-card ${p.power >= p.max ? "ui-card-done" : ""}`} data-testid={`perk-${p.id}`}>
                <div className="ui-row">
                  <span className="text-kyo">{p.name}</span>
                  <span className="text-dim">{p.power > p.max ? `${p.power} overmax` : `${p.power}/${p.max}`}</span>
                </div>
                <Meter value={Math.min(p.power, p.max)} max={Math.max(1, p.max)} small detail={p.power > p.max ? `${p.power} overmax` : `${p.power}/${p.max}`} />
                <p className="ui-card-about">{p.about.split(". You have")[0]}.</p>
                <button type="button" className="px-btn ui-btn-sm" disabled={s.perkPoints < 1} onClick={() => game?.spendPerk(p.id)}>
                  {p.power >= p.max ? `Overmax +${p.step}` : `+${p.step} · 1 point`}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "skills" && (
        <>
          <p className="text-dim">Skills stay on the account and do not cap. Chance bonuses bend before they can break a fight. {s.skillPoints} skill points to spend in Verses.</p>
          <div className="ui-list">
            {s.skills.map((sk) => (
              <div key={sk.id} className="ui-card skill-row">
                <div className="ui-row">
                  <span className="text-kyo">{sk.name}</span>
                  <span>{sk.level}</span>
                </div>
                <Meter value={sk.xp} max={sk.need} small />
                <p className="ui-card-about">{sk.line}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Verses
// ---------------------------------------------------------------------------

const MAX_BAR = 9;
export const VersesPanel = memo(function VersesPanel({ game }: GameProp) {
  const s = useSnapPick(["bar", "abilities", "skillPoints"] as const);
  const [tab, setTab] = useState<"loadout" | "library">("loadout");
  const [filter, setFilter] = useState("");
  const [type, setType] = useState<TypeId | "all">("all");
  const [sort, setSort] = useState<"type" | "name" | "power" | "rank">("type");
  const [show, setShow] = useState<"all" | "owned" | "locked" | "aura" | "new">("all");
  const equipped = useMemo(() => new Set(s.bar.map((m) => m.id)), [s.bar]);
  const [picked, setPicked] = useState<number | null>(null);
  const [moving, setMoving] = useState<number | null>(null);
  const pickedMove = picked !== null ? s.bar[picked] : undefined;
  const pickedInfo = pickedMove ? s.abilities.find((a) => a.id === pickedMove.id) : undefined;
  const unlocked = useMemo(() => s.abilities.filter((m) => m.rank > 0), [s.abilities]);
  const catalog = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return s.abilities
      .filter((m) => (type === "all" || m.type === type) && (show === "all" || (show === "aura" ? !!m.aura : show === "new" ? !!m.fx : show === "owned" ? m.rank > 0 : m.rank === 0)))
      .filter((m) => !f || m.name.toLowerCase().includes(f) || m.effect.includes(f) || m.about.toLowerCase().includes(f))
      .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "power" ? b.power - a.power : sort === "rank" ? b.rank - a.rank || a.name.localeCompare(b.name) : a.type.localeCompare(b.type) || a.name.localeCompare(b.name)));
  }, [s.abilities, filter, type, sort, show]);
  return (
    <div className="ui-stack">
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "loadout", label: `Loadout · ${s.bar.length}/${MAX_BAR}` }, { id: "library", label: `Library · ${s.skillPoints} pts` }]} />
      {tab === "loadout" && (
        <>
          <Section title={moving !== null ? "MOVE · TAP THE SLOT (KEY) TO PUT IT ON" : "EQUIPPED · TAP A VERSE FOR OPTIONS · DRAG TO REORDER"}>
            <div className="verse-slots">
              {Array.from({ length: MAX_BAR }, (_, i) => {
                const m = s.bar[i];
                const drop = {
                  onDragOver: (e: React.DragEvent) => e.preventDefault(),
                  onDrop: (e: React.DragEvent) => { e.preventDefault(); const from = Number(e.dataTransfer.getData("text/verse-slot")); if (Number.isInteger(from)) { game?.moveBar(from, i); setPicked(null); setMoving(null); } },
                };
                const click = () => {
                  if (moving !== null) { game?.moveBar(moving, i); setMoving(null); setPicked(null); return; }
                  if (m) setPicked(picked === i ? null : i);
                };
                return m ? (
                  <button key={i} type="button" data-testid={`verse-slot-${i}`} draggable onDragStart={(e) => e.dataTransfer.setData("text/verse-slot", String(i))} {...drop}
                    className={`verse-slot hot-${m.type} ${picked === i ? "verse-slot-picked" : ""} ${moving !== null && moving !== i ? "verse-slot-target" : ""}`} onClick={click} title={moving !== null ? "Put it here" : "Options"}>
                    <span className="key-badge">{i + 1}</span>
                    <span className={`verse-slot-name ${typeClass(m.type)}`}>{m.name}</span>
                    <span className="hot-tag">{m.tag.split(" · ")[0]}</span>
                  </button>
                ) : (
                  <div key={i} {...drop} role={moving !== null ? "button" : undefined} tabIndex={moving !== null ? 0 : undefined} onClick={moving !== null ? click : undefined}
                    className={`verse-slot verse-slot-empty ${moving !== null ? "verse-slot-target" : ""}`}><span className="key-badge">{i + 1}</span><span className="text-dim">Empty</span></div>
                );
              })}
            </div>
            {pickedMove && picked !== null && (
              <div className="verse-actions" data-testid="verse-actions">
                <span className="ui-row"><span className={typeClass(pickedMove.type)}>Key {picked + 1} · {pickedMove.name}</span>{pickedInfo && (pickedInfo.rank > 5 ? <span className="text-dim">Rank {pickedInfo.rank}</span> : <Pips value={pickedInfo.rank} max={5} />)}</span>
                {pickedInfo && <VerseNums m={pickedInfo} />}
                <div className="ui-row-gap">
                  <button type="button" className="px-btn px-btn-kyo ui-btn-sm" data-testid="verse-upgrade-btn" disabled={!pickedInfo || s.skillPoints < 1} onClick={() => game?.spendAbility(pickedMove.id)}>
                    {pickedInfo && pickedInfo.rank >= 5 ? `Overmax · 1 pt (${s.skillPoints})` : `Upgrade · 1 pt (${s.skillPoints})`}
                  </button>
                  <button type="button" className="px-btn ui-btn-sm" data-testid="verse-move-btn" onClick={() => setMoving(picked)}>Move</button>
                  <button type="button" className="px-btn ui-btn-sm" data-testid="verse-unequip-btn" onClick={() => { game?.setBar(picked, ""); setPicked(null); }}>Unequip</button>
                  <button type="button" className="px-btn ui-btn-sm" onClick={() => { setPicked(null); setMoving(null); }}>Cancel</button>
                </div>
                {moving !== null && <span className="text-dim">Now tap the key slot to move it to. A slot that already has a verse swaps with it.</span>}
              </div>
            )}
          </Section>
          <Section title={`UNLOCKED · ${unlocked.length} · TAP TO EQUIP`}>
            {unlocked.length ? (
              <div className="ui-grid" style={{ "--min": "190px" } as React.CSSProperties}>
                {unlocked.map((m) => (
                  <button key={m.id} type="button" className={`ui-card verse-pick ${equipped.has(m.id) ? "ui-card-done" : ""}`} disabled={equipped.has(m.id) || s.bar.length >= MAX_BAR} onClick={() => game?.setBar(s.bar.length, m.id)}>
                    <span className={typeClass(m.type)}>{m.name}</span>
                    <span className="ui-row">{m.rank > 5 ? <span className="text-dim">Rank {m.rank}</span> : <Pips value={m.rank} max={5} />}<span className="text-dim">{equipped.has(m.id) ? "equipped" : m.effect}</span></span>
                  </button>
                ))}
              </div>
            ) : (
              <Empty>Unlock verses in the Library first.</Empty>
            )}
          </Section>
        </>
      )}
      {tab === "library" && (
        <>
          <p className="text-dim">Auras: slot one and cast it to switch it on or off. While on it holds back part of your max health (up to 3 auras, never more than 60%). 1 point unlocks a verse or adds a rank. Ranks 1–5 add 15% each (rank 5 is ×1.6). Further ranks still stack at +8% each.</p>
          <div className="bag-toolbar">
            <input className="px-input" aria-label="Search verses" placeholder="Search name, effect, words" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <select className="px-input" aria-label="Sort verses" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="type">By element</option>
              <option value="name">By name</option>
              <option value="power">By power</option>
              <option value="rank">By rank</option>
            </select>
          </div>
          <Chips value={show} onChange={setShow} options={[{ id: "all", label: "All" }, { id: "owned", label: "Unlocked" }, { id: "locked", label: "Locked" }, { id: "aura", label: "Auras" }, { id: "new", label: "✦ Starfall" }]} />
          <Chips value={type} onChange={setType} label="Element" options={[{ id: "all" as const, label: "Any element" }, ...(Object.keys(TYPES) as TypeId[]).map((t) => ({ id: t, label: <span className={typeClass(t)}>{TYPES[t].name}</span> }))]} />
          <div className="ui-grid" style={{ "--min": "240px" } as React.CSSProperties}>
            {catalog.map((m) => (
              <div key={m.id} className={`ui-card verse-card2 ${m.rank ? "" : "verse-locked"}`}>
                <div className="ui-row">
                  <span className={typeClass(m.type)}>{m.name}{m.fx && <span className="text-kyo" title="Starfall batch: an animation of its own"> ✦</span>}</span>
                  {m.rank > 5 ? <span className="text-dim">Rank {m.rank}</span> : <Pips value={m.rank} max={5} />}
                </div>
                <p className="ui-card-about">{m.about}</p>
                <VerseNums m={m} crit />
                <div className="ui-row-gap">
                  <button type="button" className="px-btn ui-btn-sm" disabled={s.skillPoints < 1} onClick={() => game?.spendAbility(m.id)}>
                    {m.rank >= 5 ? "Overmax · 1" : m.rank ? "Upgrade · 1" : "Unlock · 1"}
                  </button>
                  {m.rank > 0 && !equipped.has(m.id) && (
                    <button type="button" className="px-btn px-btn-kyo ui-btn-sm" disabled={s.bar.length >= MAX_BAR} onClick={() => game?.setBar(s.bar.length, m.id)}>Equip</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!catalog.length && <Empty>No verses match.</Empty>}
        </>
      )}
    </div>
  );
});

/** A verse's numbers at its current rank, and what the next rank gives. */
function VerseNums({ m, crit }: { m: Snap["abilities"][number]; crit?: boolean }) {
  const main = (v: typeof m.now) => (v.heal ? `Heal ${v.heal}` : v.shield ? `Ward ${v.shield}` : `Pow ${v.power}`);
  return (
    <span className="verse-nums">
      <span className="text-dim verse-stats">
        {m.aura
          ? `Aura · ${m.aura.label} · costs ${Math.round(m.aura.reserve * 100)}% max HP while on`
          : <>{main(m.now)} · Acc {m.accuracy}%{crit ? ` · Crit ${m.crit}%` : ""} · Rng {m.reachNow ?? m.range} · CD {m.cdNow != null ? `${m.cdNow}s` : "—"}{m.effect !== "none" ? ` · ${m.effect}` : ""}</>}
        {m.rank > 0 && ` · ×${m.now.mult.toFixed(2)}`}
      </span>
      {!m.aura && verseAreaNote(m) && <span className="text-kyo verse-stats" data-testid="verse-area">{verseAreaNote(m)}</span>}
      <span className="verse-next">
        {m.rank > 0 ? `Next rank ${m.rank + 1}: ${main(m.next)} (×${m.next.mult.toFixed(2)})` : `Unlock: ${main(m.now)}`}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

const TIER_LABEL: Record<BoardView["tier"], string> = { easy: "EASY", normal: "NORMAL", hard: "HARD", elite: "ELITE" };

export const QuestsPanel = memo(function QuestsPanel({ game }: GameProp) {
  const s = useSnapPick(["mapQuests", "questName", "questAbout", "setLabel", "setBonus", "unlocked"] as const);
  const [board, setBoard] = useState<BoardView[]>([]);
  useEffect(() => {
    const pull = () => setBoard(game?.questBoardSnap() ?? []);
    pull();
    const id = window.setInterval(pull, 1000);
    return () => window.clearInterval(id);
  }, [game]);
  const secs = board[0]?.refreshIn ?? 0;
  const active = board.find((q) => q.active);
  return (
    <div className="ui-stack">
      <Section
        title="CONTRACT BOARD"
        right={<span className="text-dim">refresh {Math.floor(secs / 60)}:{String(Math.floor(secs % 60)).padStart(2, "0")}</span>}
      >
        <div className="ui-row-gap">
          {active && <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.abandonQuest()}>Drop contract</button>}
          <ConfirmButton className="ui-btn-sm" label={`New board · ${game?.questBoardRerollCost() ?? 0} kyo`} confirm="Tap again to reroll" onConfirm={() => game?.rerollQuestBoard()} />
        </div>
        <div className="ui-grid" style={{ "--min": "220px" } as React.CSSProperties}>
          {board.map((q) => (
            <div key={q.id} className={`ui-card quest-card tier-${q.tier} ${q.active ? "ui-card-hl" : ""}`}>
              <div className="ui-row">
                <span className="text-kyo">{q.name}</span>
                <span className={`quest-tier tier-${q.tier}`}>{TIER_LABEL[q.tier]}</span>
              </div>
              <p className="ui-card-about">{q.about}</p>
              {q.active ? (
                <Meter value={q.progress} max={q.need} small label="DONE" />
              ) : (
                <div className="ui-row">
                  <span className="text-dim">{q.rewardKyo} kyo</span>
                  <button type="button" className="px-btn ui-btn-sm" disabled={!!active} onClick={() => game?.acceptQuest(q.id)}>Accept</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
      {s.mapQuests.length > 0 && (
        <Section title="THIS MAP">
          <div className="ui-list" data-testid="map-quest-log">
            {s.mapQuests.map((q) => (
              <div key={q.id} className="ui-card">
                <p className="text-kyo">{q.name}{q.ready ? ` · report to ${q.turnIn}` : ""}</p>
                {q.lines.map((l, i) => <p key={i} className="text-dim">{l}</p>)}
              </div>
            ))}
          </div>
        </Section>
      )}
      <Section title="STORY">
        <div className="ui-card">
          <p className="text-kyo">{s.questName}</p>
          <p>{s.questAbout}</p>
        </div>
        <p className="text-dim">Set: {s.setLabel} · {s.setBonus} · {s.unlocked.length} sets unlocked</p>
      </Section>
    </div>
  );
});

// ---------------------------------------------------------------------------
// World map
// ---------------------------------------------------------------------------

type MapView = { cx: number; cy: number; s: number };
type MapLayers = { areas: boolean; people: boolean; places: boolean; foes: boolean; resources: boolean };
const MAP_LAYER_LABEL: Record<keyof MapLayers, string> = { areas: "Areas", people: "People", places: "Places", foes: "Foes", resources: "Resources" };
const PLACE_KIND_LABEL: Record<string, string> = { region: "Land", city: "Town", resource: "Resource", landmark: "Landmark", dungeon: "Dungeon", water: "Water", npc: "Person", boss: "Boss" };

/**
 * The world map: drag to pan, wheel or pinch to zoom, hover to read a spot, click to drop a pin
 * (an arrow in the world points to it). Layers and a place finder sit beside it.
 */
export const MapPanel = memo(function MapPanel({ game }: GameProp) {
  const s = useSnapPick(["map", "region", "dungeonCountdown", "dungeonPortals", "rules"] as const);
  const ref = useRef<HTMLCanvasElement>(null);
  const view = useRef<MapView | null>(null);
  // Hardcore: clicking a town you have visited offers to fast travel there.
  const [travel, setTravel] = useState<{ id: string; name: string; tx: number; ty: number } | null>(null);
  const [follow, setFollow] = useState(true);
  const followRef = useRef(follow);
  followRef.current = follow;
  const [layers, setLayers] = useState<MapLayers>(() => {
    try { return { areas: true, people: true, places: true, foes: true, resources: true, ...JSON.parse(localStorage.getItem("turbz-map-layers") ?? "{}") }; } catch { return { areas: true, people: true, places: true, foes: true, resources: true }; }
  });
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const [hover, setHover] = useState<{ x: number; y: number; lines: string[] } | null>(null);
  const [find, setFind] = useState("");
  const [zoomLabel, setZoomLabel] = useState(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean; pinch?: number; s0?: number } | null>(null);

  const info = () => game?.mapInfo() ?? null;
  const clampView = (v: MapView) => {
    const i = info();
    if (!i) return v;
    const c = ref.current;
    const minS = c ? Math.min(c.clientWidth / i.w, c.clientHeight / i.h) * 0.9 : 0.5;
    v.s = Math.max(Math.min(minS, 1), Math.min(24, v.s));
    v.cx = Math.max(0, Math.min(i.w, v.cx));
    v.cy = Math.max(0, Math.min(i.h, v.cy));
    return v;
  };
  const ensureView = () => {
    if (!view.current) {
      const i = info();
      if (!i) return null;
      view.current = clampView({ cx: i.px, cy: i.py, s: i.w * i.h > 120000 ? 3 : 4 });
    }
    return view.current;
  };
  const fitAll = () => {
    const i = info(), c = ref.current;
    if (!i || !c) return;
    setFollow(false);
    view.current = clampView({ cx: i.w / 2, cy: i.h / 2, s: Math.min(c.clientWidth / i.w, c.clientHeight / i.h) * 0.95 });
  };
  const centerMe = () => {
    const i = info();
    if (!i) return;
    setFollow(true);
    const v = ensureView();
    if (v) { v.cx = i.px; v.cy = i.py; if (v.s < 2) v.s = 4; }
  };
  const zoomBy = (f: number, sx?: number, sy?: number) => {
    const v = ensureView(), c = ref.current;
    if (!v || !c) return;
    const W = c.clientWidth, H = c.clientHeight;
    const px = sx ?? W / 2, py = sy ?? H / 2;
    const tx = v.cx + (px - W / 2) / v.s, ty = v.cy + (py - H / 2) / v.s;
    v.s *= f;
    clampView(v);
    v.cx = tx - (px - W / 2) / v.s;
    v.cy = ty - (py - H / 2) / v.s;
    clampView(v);
    if (sx !== undefined) setFollow(false);
  };
  const jump = (tx: number, ty: number, s?: number) => {
    const v = ensureView();
    if (!v) return;
    setFollow(false);
    v.cx = tx; v.cy = ty;
    if (s) v.s = Math.max(v.s, s);
    clampView(v);
  };
  const toTile = (clientX: number, clientY: number) => {
    const v = ensureView(), c = ref.current;
    if (!v || !c) return null;
    const r = c.getBoundingClientRect();
    return { tx: v.cx + (clientX - r.left - r.width / 2) / v.s, ty: v.cy + (clientY - r.top - r.height / 2) / v.s, x: clientX - r.left, y: clientY - r.top };
  };

  // Draw loop: about 12 frames a second while the window is open.
  useEffect(() => {
    let raf = 0, last = 0, live = true;
    const tick = (t: number) => {
      if (!live) return;
      raf = requestAnimationFrame(tick);
      if (t - last < 80) return;
      last = t;
      const c = ref.current, v = ensureView(), i = info();
      if (!c || !v || !game || !i) return;
      if (followRef.current) { v.cx += (i.px - v.cx) * 0.35; v.cy += (i.py - v.cy) * 0.35; }
      game.drawWorldMap(c, v, layersRef.current);
      setZoomLabel(Math.round(v.s * 10) / 10);
    };
    raf = requestAnimationFrame(tick);
    return () => { live = false; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);
  // A new map (entering a dungeon, a designer map) resets the view.
  useEffect(() => { view.current = null; setFollow(true); setTravel(null); }, [s.map]);
  useEffect(() => { try { localStorage.setItem("turbz-map-layers", JSON.stringify(layers)); } catch { /* per-viewer convenience only */ } }, [layers]);

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = ensureView();
    if (!v) return;
    const pts = [...pointers.current.values()];
    if (pts.length === 2) drag.current = { x: 0, y: 0, cx: v.cx, cy: v.cy, moved: true, pinch: Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y), s0: v.s };
    else drag.current = { x: e.clientX, y: e.clientY, cx: v.cx, cy: v.cy, moved: false };
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toTile(e.clientX, e.clientY);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current, v = view.current;
    if (d && v) {
      const pts = [...pointers.current.values()];
      if (d.pinch && pts.length === 2) {
        const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
        v.s = (d.s0 ?? v.s) * (dist / d.pinch);
        clampView(v);
        setFollow(false);
      } else if (!d.pinch) {
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (Math.hypot(dx, dy) > 4) { d.moved = true; setFollow(false); }
        if (d.moved) { v.cx = d.cx - dx / v.s; v.cy = d.cy - dy / v.s; clampView(v); }
      }
      setHover(null);
      return;
    }
    if (p && game) setHover({ x: p.x, y: p.y, lines: game.mapPick(p.tx, p.ty, Math.max(1.5, 10 / (v?.s ?? 4))) });
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (pointers.current.size === 0) drag.current = null;
    if (d && !d.moved && !d.pinch) {
      const p = toTile(e.clientX, e.clientY);
      if (p && game) {
        const town = game.fastTravelTownAt(Math.floor(p.tx), Math.floor(p.ty));
        if (town) setTravel({ id: town.id, name: town.name, tx: p.tx, ty: p.ty });
        else { setTravel(null); game.setMapPin(p.tx - 0.5, p.ty - 0.5); }
      }
    }
  };
  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const p = toTile(e.clientX, e.clientY);
    if (!p) return;
    zoomBy(e.deltaY < 0 ? 1.25 : 0.8, p.x, p.y);
  };
  // The canvas wheel must not scroll the window behind it.
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    c.addEventListener("wheel", stop, { passive: false });
    return () => c.removeEventListener("wheel", stop);
  }, []);

  const places = useMemo(() => {
    const q = find.trim().toLowerCase();
    if (q.length < 2 || !game) return [];
    return game.mapPlaces().filter((p) => p.name.toLowerCase().includes(q)).slice(0, 30);
  }, [find, game, s.map]);
  const custom = s.map.startsWith("custom-");
  const rifts = s.dungeonPortals.filter((p) => !p.cleared);
  const pin = game?.mapInfo()?.pin ?? null;
  return (
    <div className="world-map" data-testid="world-map">
      <div className="world-map-bar">
        <span className="text-kyo" data-testid={custom ? "custom-map-label" : undefined}>{s.region}</span>
        {(s.map === "world" || s.map === "custom-turbz") && <span className="text-dim">Next rift {Math.floor(s.dungeonCountdown / 60)}:{String(s.dungeonCountdown % 60).padStart(2, "0")}</span>}
        <span className="world-map-tools">
          <button type="button" className="px-btn ui-btn-sm" aria-label="Zoom out" onClick={() => zoomBy(0.7)}>−</button>
          <span className="text-dim">×{zoomLabel}</span>
          <button type="button" className="px-btn ui-btn-sm" aria-label="Zoom in" onClick={() => zoomBy(1.4)}>+</button>
          <button type="button" className={`px-btn ui-btn-sm ${follow ? "px-btn-kyo" : ""}`} data-testid="map-me-btn" onClick={centerMe}>Me</button>
          <button type="button" className="px-btn ui-btn-sm" data-testid="map-fit-btn" onClick={fitAll}>Whole map</button>
          {pin && <button type="button" className="px-btn ui-btn-sm" onClick={() => jump(pin.tx, pin.ty)}>Pin</button>}
        </span>
      </div>
      <div className="world-map-body">
        <div className="world-map-stage">
          <canvas ref={ref} className="world-map-canvas" aria-label="World map" data-testid="world-map-canvas"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={() => setHover(null)}
            onWheel={onWheel} onDoubleClick={(e) => { const p = toTile(e.clientX, e.clientY); if (p) zoomBy(1.8, p.x, p.y); }} />
          {hover && hover.lines.length > 0 && (
            <div className="world-map-tip" style={{ left: Math.min(hover.x + 14, 9999), top: hover.y + 14 }}>
              {hover.lines.map((l, i) => <div key={i} className={i === 0 ? "text-kyo" : "text-dim"}>{l}</div>)}
            </div>
          )}
          {travel && (
            <div className="world-map-tip" style={{ left: 12, top: 12, pointerEvents: "auto" }} data-testid="map-travel-prompt">
              <div className="text-kyo">Fast travel to {travel.name}?</div>
              <div className="ui-row-gap" style={{ marginTop: 4 }}>
                <button type="button" className="px-btn ui-btn-sm px-btn-kyo" data-testid="map-travel-go" onClick={() => { if (game?.fastTravelTo(travel.id)) game.toggle("map"); setTravel(null); }}>Travel</button>
                <button type="button" className="px-btn ui-btn-sm" onClick={() => { game?.setMapPin(travel.tx - 0.5, travel.ty - 0.5); setTravel(null); }}>Pin instead</button>
                <button type="button" className="px-btn ui-btn-sm" aria-label="Cancel" onClick={() => setTravel(null)}>×</button>
              </div>
            </div>
          )}
          <p className="world-map-hint text-dim">Drag to pan · wheel or pinch to zoom · click to pin{s.rules === "hardcore" ? " · click a visited town to fast travel" : ""}</p>
        </div>
        <aside className="world-map-side">
          <input className="px-input" placeholder="Find a town, place, person…" aria-label="Find on the map" value={find} onChange={(e) => setFind(e.target.value)} data-testid="map-find" />
          {places.length > 0 && (
            <div className="world-map-results">
              {places.map((p, i) => (
                <button key={i} type="button" className="world-map-result" onClick={() => jump(p.tx, p.ty, 4)}>
                  <span>{p.name}</span><span className="text-dim">{PLACE_KIND_LABEL[p.kind] ?? p.kind}{p.levels ? ` · ${p.levels}` : ""}</span>
                </button>
              ))}
            </div>
          )}
          {find.trim().length >= 2 && !places.length && <Empty>Nothing by that name here.</Empty>}
          <Section title="SHOW">
            <div className="world-map-layers">
              {(Object.keys(MAP_LAYER_LABEL) as (keyof MapLayers)[]).map((k) => (
                <label key={k}><input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} /> {MAP_LAYER_LABEL[k]}</label>
              ))}
            </div>
          </Section>
          <Section title="KEY">
            <div className="world-map-key">
              <span><i style={{ background: "#fff6e8" }} />You</span>
              <span><i style={{ background: "#e6c15a" }} />Town · board</span>
              {s.rules === "hardcore" && <span><i style={{ background: "#fff6e8" }} />Ringed town · fast travel</span>}
              <span><i style={{ background: "#ffe08a" }} />! quest · ? hand in · ring = goal</span>
              <span><i style={{ background: "#ff4a3a" }} />Boss · bounty</span>
              <span><i style={{ background: "#b4a6ff" }} />Door · rift</span>
              <span><i style={{ background: "#8fd0ff" }} />Shrine · arena</span>
              <span><i style={{ background: "#ff6a4a" }} />Your pin</span>
            </div>
          </Section>
          {rifts.length > 0 && (
            <Section title={`OPEN RIFTS · ${rifts.length}`}>
              <div className="ui-row-gap">
                {rifts.map((p) => (
                  <button key={p.id} type="button" className="px-btn ui-btn-sm" disabled={s.map !== "world"} onClick={() => { game?.trackRift(p.id); jump(p.x / 32, p.y / 32, 3); }}>Dungeon {p.id.slice(5)}</button>
                ))}
              </div>
            </Section>
          )}
        </aside>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Lingering ghost: a fallen foe's ghost, waiting for you to decide
// ---------------------------------------------------------------------------

export const WildGhostPanel = memo(function WildGhostPanel({ game }: GameProp) {
  const { wildGhost: g } = useSnapPick(["wildGhost"] as const);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  useEffect(() => { setName(g?.name ?? ""); setEditing(false); }, [g?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!g) return <Empty>The ghost is gone.</Empty>;
  const partyFull = g.party >= g.partyMax;
  const boxFull = g.store >= g.storeMax;
  const mins = Math.floor(g.t / 60), secs = String(g.t % 60).padStart(2, "0");
  const commit = () => { if (name.trim() && name.trim() !== g.name) game?.renameWild(g.id, name); setEditing(false); };
  const head = editing ? (
    <span className="ui-row-gap">
      <input className="px-input" data-testid="wild-name" maxLength={20} autoFocus value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }} aria-label="Ghost name" />
      <button type="button" className="px-btn ui-btn-sm" onClick={commit}>Save</button>
    </span>
  ) : (
    <span className="ui-row-gap">
      <GhostName g={g} />
      <button type="button" className="px-btn ui-btn-sm wild-rename" data-testid="wild-rename" onClick={() => setEditing(true)}>Rename</button>
    </span>
  );
  return (
    <div className="ui-stack" data-testid="wild-ghost-panel">
      <div className="ui-row">
        <span className="text-dim">A fallen foe's ghost waits for you to decide.</span>
        <span className={g.t < 60 ? "text-bad" : "text-dim"}>Fades in {mins}:{secs}</span>
      </div>
      <GhostDetailCard g={g} head={head} testid="wild-detail"
        actions={
          <div className="ui-stack-sm">
            <p className="text-dim">Party {g.party}/{g.partyMax} · out {g.out}/{g.outMax} · Ghost Box {g.boxPlaced ? `${g.store}/${g.storeMax}` : "not built"}</p>
            <div className="gear-actions">
              <button type="button" className="px-btn px-btn-kyo" data-testid="wild-party" disabled={partyFull || !g.near} onClick={() => game?.keepWild(g.id, "party")}>
                {partyFull ? "Party full" : g.out < g.outMax ? "Add to party · follows" : "Add to party"}
              </button>
              <button type="button" className="px-btn" data-testid="wild-box" disabled={!g.boxPlaced || boxFull || !g.near} onClick={() => game?.keepWild(g.id, "box")}>
                {!g.boxPlaced ? "Send to Box (build one)" : boxFull ? "Box full" : "Send to Ghost Box"}
              </button>
              <ConfirmButton plain label="Dismiss" confirm="Tap again to let it go" onConfirm={() => game?.dismissWild(g.id)} />
            </div>
            {!g.near && <p className="text-dim">Walk back to the ghost to decide.</p>}
          </div>
        }
      />
    </div>
  );
});

// ---------------------------------------------------------------------------
// Spirits
// ---------------------------------------------------------------------------

type SpiritTab = "party" | "box" | "bonus";

export const SpiritsPanel = memo(function SpiritsPanel({ game }: GameProp) {
  const s = useSnapPick(["spirits", "spiritSlots", "spiritCap", "jarLeft", "ghostStore", "ghostBox", "ghostInspect", "ghostBonus", "rules", "bag", "kyo"] as const);
  const [tab, setTab] = useState<SpiritTab>("party");
  const [open, setOpen] = useState<string | null>(null);
  const [swap, setSwap] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "tagged" | "shiny">("all");
  const following = s.spirits.filter((x) => x.active).length;
  const sel = s.spirits.find((x) => x.uid === open) ?? null;
  const hc = s.rules === "hardcore";
  const TASKS = [["fish", "Go Fishing"], ["chop", "Go Chopping"], ["level", "Go Leveling"]] as const;
  const taskName = (t: string | null) => TASKS.find(([id]) => id === t)?.[1] ?? "";
  const boxCost = Object.entries(BUILD_PIECES.ghostbox.cost).map(([id, n]) => `${n} ${ITEM_BY_ID[id]?.name ?? id}`).join(", ");
  const haveBoxMats = Object.entries(BUILD_PIECES.ghostbox.cost).every(([id, n]) => (s.bag.find((it) => it.id === id)?.count ?? 0) >= n);
  const tagged = s.ghostStore.filter((g) => g.tagged).length;
  const shown = s.ghostStore.filter((g) => filter === "all" || (filter === "tagged" ? g.tagged : g.shiny)).slice().sort((a, b) => Number(b.tagged) - Number(a.tagged) || Number(b.shiny) - Number(a.shiny) || b.rarity - a.rarity || b.level - a.level);
  const inspect = s.ghostInspect;
  const inspectRow = inspect ? s.ghostStore.find((g) => g.uid === inspect.uid) ?? null : null;
  useEffect(() => { if (open && !sel) setOpen(null); }, [open, sel]);
  const tasks = hc && sel ? (
    <div className="ui-stack-sm" data-testid="ghost-tasks">
      <p className="text-dim">
        {sel.task
          ? `${taskName(sel.task)}: ${sel.task === "level" ? `hunting alone for 2x XP · ${sel.xp}/${sel.xpNeed} XP to Lv ${sel.level + 1}` : "its catch goes straight into your bag"}.`
          : "Send this ghost off to work. Fishing and chopping drop into your bag; leveling hunts alone for 2x XP (only this ghost earns it)."}
      </p>
      <div className="gear-actions">
        {TASKS.map(([id, label]) => (
          <button key={id} type="button" data-testid={`task-${id}`} className={`px-btn ${sel.task === id ? "px-btn-kyo" : ""}`} onClick={() => game?.setGhostTask(sel.uid, sel.task === id ? null : id)}>{sel.task === id ? `${label} ✓` : label}</button>
        ))}
      </div>
    </div>
  ) : undefined;
  return (
    <div className="ui-stack" data-testid="spirit-panel">
      <div className="ui-row">
        <span>Out <span className="text-kyo">{following}/{s.spiritSlots}</span> · Party <span className="text-kyo">{s.spirits.length}/{s.spiritCap}</span> · Ghost Box <span className="text-kyo">{s.ghostStore.length}</span> · Tiny <span className="text-kyo">{tagged}/20</span></span>
        {s.jarLeft > 0 && <span className="text-kyo">Ghost jar · {s.jarLeft}s</span>}
      </div>
      <Tabs value={tab} onChange={setTab} label="Spirits" tabs={[
        { id: "party", label: `Party ${s.spirits.length}/${s.spiritCap}` },
        { id: "box", label: `Ghost Box ${s.ghostStore.length}` },
        { id: "bonus", label: `Bonuses ${s.ghostBonus.passive.length + s.ghostBonus.timed.length}` },
      ]} />

      {tab === "party" && (
        <div className="ui-stack" data-testid="spirit-party">
          <p className="text-dim">Up to {s.spiritSlots} ghosts go out with you and {s.spiritCap} ride in your party. Ghosts out with you fight, earn XP from every kill, and their abilities work.</p>
          {!s.spirits.length && <Empty>No spirits yet. A fallen foe may stay and join you; a ghost jar raises the odds for a minute.</Empty>}
          {sel && (
            <GhostDetailCard g={sel} onClose={() => setOpen(null)} onToggleMove={(id) => game?.toggleSpiritMove(sel.uid, id)} tasks={tasks}
              actions={
                <div className="gear-actions">
                  <button type="button" className="px-btn px-btn-kyo" data-testid="spirit-toggle-out" onClick={() => game?.setSpiritActive(sel.uid, !sel.active)}>{sel.active ? "Call back" : sel.task ? "Call home" : "Send out"}</button>
                  {s.ghostBox.near && <button type="button" className="px-btn" onClick={() => { game?.storeSpirit(sel.uid); setOpen(null); }}>Put in Ghost Box</button>}
                  <ConfirmButton plain label="Dismiss" confirm="Tap again" onConfirm={() => { game?.dismissSpirit(sel.uid); setOpen(null); }} />
                </div>
              }
            />
          )}
          <div className="ui-grid" style={{ "--min": "200px" } as React.CSSProperties}>
            {s.spirits.map((sp) => (
              <GhostCard key={sp.uid} g={sp} on={sp.active} selected={open === sp.uid} testid={`spirit-${sp.uid}`} onClick={() => setOpen(open === sp.uid ? null : sp.uid)}>
                <Meter value={sp.hp} max={sp.max} small kind={sp.hp / sp.max < 0.3 ? "bad" : "good"} />
                <Meter value={sp.level >= sp.levelCap ? 1 : sp.xp} max={sp.level >= sp.levelCap ? 1 : sp.xpNeed} small kind="xp" />
                <span className="text-dim">{sp.task ? `${taskName(sp.task)}` : sp.active ? "Out" : "In party"} · {sp.known.filter((m) => m.slotted).length}/3 ready · {sp.abilities.length} abilit{sp.abilities.length === 1 ? "y" : "ies"}</span>
              </GhostCard>
            ))}
          </div>
        </div>
      )}

      {tab === "box" && (
        <div className="ui-stack" data-testid="spirit-box">
          <Section title="GHOST BOX" right={<span className={s.ghostBox.near ? "text-kyo" : "text-dim"}>{!s.ghostBox.placed ? "Not built" : s.ghostBox.near ? "Open" : "At your camp"} · {s.ghostStore.length}/{s.ghostBox.max}</span>}>
            {!s.ghostBox.placed && (
              <div className="ui-stack-sm">
                <p className="text-dim">{hc ? `Build a Ghost Box inside a camp (${boxCost}) from Survival & Camp → Build, or stand in a camp and place it here.` : `Place a Ghost Box anywhere in the overworld: it keeps every ghost your party has no room for. Costs ${boxCost}, or ${GHOST_BOX_KYO} kyo. You can also right-click the ground → Place Ghost Box here.`}</p>
                <div className="gear-actions">
                  <button type="button" className="px-btn px-btn-kyo" data-testid="place-ghostbox" disabled={!haveBoxMats} onClick={() => game?.placeGhostBoxHere()}>Place Ghost Box here{haveBoxMats ? "" : ` (need ${boxCost})`}</button>
                  {!hc && <button type="button" className="px-btn" data-testid="buy-ghostbox" disabled={s.kyo < GHOST_BOX_KYO} onClick={() => game?.placeGhostBoxHere(true)}>Buy &amp; place · {GHOST_BOX_KYO} kyo</button>}
                </div>
              </div>
            )}
            {s.ghostBox.placed && !s.ghostBox.near && (
              <div className="ui-stack-sm">
                <p className="text-dim">Walk to your Ghost Box to take or release ghosts{hc ? "." : ", or bring it to you."} Tagging works from anywhere.</p>
                {!hc && <div className="gear-actions"><button type="button" className="px-btn" data-testid="move-ghostbox" onClick={() => game?.moveGhostBoxHere()}>Move Ghost Box here</button></div>}
              </div>
            )}
            {s.ghostBox.placed && s.ghostBox.near && (
              <div className="ui-stack-sm" data-testid="ghostbox-open">
                {s.spirits.length >= s.spiritCap && (
                  <Field label="Party full: swap out" hint="Pick a party ghost to trade places with, then Take.">
                    <select className="px-input" aria-label="Swap out" value={swap ?? ""} onChange={(e) => setSwap(e.target.value || null)}>
                      <option value="">Swap with…</option>
                      {s.spirits.map((sp) => <option key={sp.uid} value={sp.uid}>{sp.name} Lv {sp.level}</option>)}
                    </select>
                  </Field>
                )}
                {!hc && <div className="gear-actions"><button type="button" className="px-btn" onClick={() => game?.pickUpGhostBox()}>Pack up the Ghost Box</button></div>}
              </div>
            )}
          </Section>
          {inspect && (
            <GhostDetailCard g={inspect} onClose={() => game?.inspectGhost(null)} testid="box-detail"
              actions={
                <div className="gear-actions">
                  <button type="button" className={`px-btn ${inspectRow?.tagged ? "px-btn-kyo" : ""}`} data-testid="detail-tag" disabled={!inspectRow?.tagged && tagged >= 20} onClick={() => game?.tagGhost(inspect.uid)}>{inspectRow?.tagged ? "★ Untag" : "☆ Tag to follow"}</button>
                  <button type="button" className="px-btn px-btn-kyo" disabled={!s.ghostBox.near || (s.spirits.length >= s.spiritCap && !swap)} onClick={() => { game?.takeSpirit(inspect.uid, swap); setSwap(null); game?.inspectGhost(null); }}>Take into party</button>
                  <ConfirmButton plain label="Release" confirm="Sure?" disabled={!s.ghostBox.near} onConfirm={() => { game?.releaseStored(inspect.uid); game?.inspectGhost(null); }} />
                </div>
              }
            />
          )}
          <Section title="STORED GHOSTS" right={<Chips value={filter} onChange={setFilter} label="Filter" options={[{ id: "all", label: "All" }, { id: "tagged", label: `Tagged ${tagged}` }, { id: "shiny", label: "Shiny" }]} />}>
            <p className="text-dim">Tag up to 20 Ghost Box ghosts to float along with you as tiny followers. They never fight, but they earn XP from your kills and their abilities work. Timed abilities start recharging the moment you tag.</p>
            {!s.ghostStore.length && <Empty>The box is empty. Open a party ghost and choose "Put in Ghost Box".</Empty>}
            {s.ghostStore.length > 0 && !shown.length && <Empty>No ghosts match this filter.</Empty>}
            <div className="ui-grid" style={{ "--min": "200px" } as React.CSSProperties} data-testid="tiny-tags">
              {shown.map((g) => (
                <GhostCard key={g.uid} g={g} on={g.tagged} selected={inspect?.uid === g.uid} testid={`box-${g.uid}`}>
                  <span className="text-dim">{g.abilities.length ? g.abilities.join(" · ") : "No abilities"}</span>
                  <div className="gear-actions">
                    <button type="button" className="px-btn ui-btn-sm" data-testid={`inspect-${g.uid}`} onClick={() => game?.inspectGhost(inspect?.uid === g.uid ? null : g.uid)}>{inspect?.uid === g.uid ? "Close" : "Details"}</button>
                    <button type="button" data-testid={`tag-${g.uid}`} className={`px-btn ui-btn-sm ${g.tagged ? "px-btn-kyo" : ""}`} disabled={!g.tagged && tagged >= 20} onClick={() => game?.tagGhost(g.uid)} title={g.tagged ? "Untag" : "Tag to follow"}>{g.tagged ? "★ Tagged" : "☆ Tag"}</button>
                    {s.ghostBox.near && <button type="button" className="px-btn ui-btn-sm px-btn-kyo" disabled={s.spirits.length >= s.spiritCap && !swap} onClick={() => { game?.takeSpirit(g.uid, swap); setSwap(null); }}>Take</button>}
                    {s.ghostBox.near && <ConfirmButton plain className="ui-btn-sm" label="Release" confirm="Sure?" onConfirm={() => game?.releaseStored(g.uid)} />}
                  </div>
                </GhostCard>
              ))}
            </div>
          </Section>
        </div>
      )}

      {tab === "bonus" && (
        <div className="ui-stack" data-testid="spirit-bonus">
          <p className="text-dim">{s.ghostBonus.working} ghost{s.ghostBonus.working === 1 ? "" : "s"} working (out with you or tagged). Bonuses from many ghosts stack up to each ability's cap; a timed ability shared by several ghosts uses one timer that runs faster.</p>
          <Section title="PASSIVE">
            {!s.ghostBonus.passive.length && <Empty>No passive bonuses. Send ghosts out or tag Ghost Box ghosts.</Empty>}
            <div className="ghost-stats">
              {s.ghostBonus.passive.map((b) => <span key={b.id} className="ghost-stat"><span className="text-dim">{b.label}</span><span className="text-kyo">+{b.value}{b.id === "ward" || b.id === "thorns" || b.id === "swift" || b.id === "catch_boost" || b.id === "loot_find" ? "" : "%"}</span></span>)}
            </div>
          </Section>
          <Section title="TIMED">
            {!s.ghostBonus.timed.length && <Empty>No timed abilities working.</Empty>}
            <div className="ui-grid" style={{ "--min": "200px" } as React.CSSProperties}>
              {s.ghostBonus.timed.map((t) => (
                <div key={t.id} className="ui-card">
                  <span className="ui-row"><span className="text-kyo">{t.label}</span><span className="text-dim">×{t.n}</span></span>
                  <span>{t.unit === "dmg" ? `${t.value} damage` : t.unit === "pct-hp" ? `${t.value}% health` : "Blocks one hit"} · every {t.cd}s</span>
                  <Meter value={t.cd - Math.min(t.cd, t.left)} max={t.cd} small kind={t.left > 0 ? "void" : "good"} detail={t.left > 0 ? `${t.left}s` : "Ready"} />
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Crafting
// ---------------------------------------------------------------------------

export const CraftPanel = memo(function CraftPanel({ game }: GameProp) {
  const { bag } = useSnapPick(["bag"] as const);
  const count = (id: string) => bag.find((it) => it.id === id)?.count ?? 0;
  return (
    <div className="ui-stack" data-testid="craft-panel">
      <p className="text-dim">Combine what you gathered. Meals cook at a campfire; potions are mixed here.</p>
      <div className="ui-grid" style={{ "--min": "230px" } as React.CSSProperties}>
        {ALCHEMY_RECIPES.map((r) => {
          const have = Object.entries(r.costs).every(([id, n]) => count(id) >= n);
          return (
            <div key={r.id} className={`ui-card ${have ? "ui-card-hl" : ""}`}>
              <div className="ui-row">
                <span className="text-kyo">{r.name}</span>
                <span className="text-dim">→ {ITEM_BY_ID[r.output]?.name ?? r.output}{r.n > 1 ? ` ×${r.n}` : ""}</span>
              </div>
              <p className="ui-card-about">{r.about}</p>
              <div className="cost-row">
                {Object.entries(r.costs).map(([id, n]) => (
                  <span key={id} className={`cost-chip ${count(id) >= n ? "cost-ok" : "cost-miss"}`}>{ITEM_BY_ID[id]?.name ?? id} {count(id)}/{n}</span>
                ))}
              </div>
              <button type="button" className="px-btn ui-btn-sm" disabled={!have} onClick={() => game?.brew(r.id)}>Brew</button>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Survival & camp (Hardcore)
// ---------------------------------------------------------------------------

export const SurvivalPanel = memo(function SurvivalPanel({ game }: GameProp) {
  const s = useSnapPick(["survival", "bag", "clock", "nearTree", "nearWater", "nearCamp", "nearBed", "sleeping", "build"] as const);
  if (!s.survival) return <Empty>Survival is a Hardcore system.</Empty>;
  const bag = Object.fromEntries(s.bag.map((it) => [it.id, it.count]));
  const count = (id: string) => bag[id] ?? 0;
  const food = bestFood(bag, s.survival.hunger);
  const night = s.clock.phase === "night" && s.clock.active;
  return (
    <div className="ui-stack">
      {s.clock.active && (
        <div className={`ui-card ${night ? "ui-card-danger" : ""}`} data-testid="clock-line">
          <p className={night ? "text-blood" : "text-kyo"}>{night ? "☾" : "☀"} {s.clock.label} · {s.clock.left} until {night ? "dawn" : "dusk"}</p>
          <p className="text-dim">{night ? "Foes have twice the health and damage and give three times the experience. Sleep at a campfire to skip to dawn." : "Day lasts 10 minutes, night 15."}</p>
        </div>
      )}
      <div className="surv-meters">
        <Meter kind={s.survival.hunger < 15 ? "bad" : "good"} label="HUNGER" value={s.survival.hunger} max={100} detail={Math.ceil(s.survival.hunger)} />
        <Meter kind={s.survival.thirst < 15 ? "bad" : "good"} label="THIRST" value={s.survival.thirst} max={100} detail={Math.ceil(s.survival.thirst)} />
        <Meter kind={s.survival.rest < 15 ? "bad" : "good"} label="SLEEP" value={s.survival.rest} max={100} detail={Math.ceil(s.survival.rest)} />
      </div>
      <div className="gear-actions">
        <button type="button" className="px-btn" disabled={!food} onClick={() => game?.eatFood()}>{food ? `Eat ${s.bag.find((it) => it.id === food)?.name}` : "Not hungry / no food"}</button>
        <button type="button" className="px-btn" disabled={!count("drinking_water") || s.survival.thirst >= 100} onClick={() => game?.useBag("drinking_water")}>Drink · {count("drinking_water")}</button>
        <button type="button" className="px-btn" disabled={!s.sleeping && !s.nearCamp && !s.nearBed} title="Sleep by a campfire, or in a bed you built (rest comes half again as fast)" onClick={() => game?.survivalAction("sleep")}>{s.sleeping ? "Wake up" : s.nearBed ? (night ? "Sleep in bed to dawn" : "Sleep in bed") : night ? "Sleep to dawn" : "Sleep"}</button>
      </div>
      <p className="text-dim">Wounds do not heal by themselves in Hardcore: no regeneration, and sleep and hearths do not mend you. Healing spells, potions (¾ strength) and meals do.</p>
      <Section title="GATHER" right={<span className="text-dim">Logs {count("timber")} · Meat {count("meat")} · Fish {count("fish")} · Raw water {count("raw_water")}</span>}>
        <div className="gear-actions">
          <button type="button" className="px-btn" disabled={!s.nearTree} onClick={() => game?.survivalAction("chop")}>Chop tree</button>
          <button type="button" className="px-btn" disabled={!s.nearWater} onClick={() => game?.survivalAction("water")}>Collect water</button>
          <button type="button" className="px-btn" disabled={!s.nearWater} onClick={() => game?.startFishing()}>Fish</button>
        </div>
      </Section>
      <Section title="CAMP" right={<span className={s.nearCamp ? "text-kyo" : "text-dim"}>{s.nearCamp ? "Campfire in reach" : "No campfire near"}</span>}>
        <div className="gear-actions">
          <button type="button" className="px-btn" disabled={s.nearCamp || count("timber") < 3} onClick={() => game?.survivalAction("fire")}>Build campfire · 3 logs</button>
          <button type="button" className="px-btn" data-testid="build-toggle-btn" onClick={() => game?.toggleBuild()}>{s.build.on ? "Stop building (F)" : "Build (F)"}</button>
          <button type="button" className="px-btn" data-testid="hold-followers-btn" disabled={!s.build.holding && !s.build.beds} onClick={() => game?.holdFollowers(!s.build.holding)}>{s.build.holding ? "Call followers back" : "Send followers to bed"}</button>
        </div>
        <div className="ui-grid" style={{ "--min": "190px" } as React.CSSProperties} data-testid="build-pieces">
          {BUILD_PIECE_IDS.map((id) => {
            const def = BUILD_PIECES[id];
            const have = Object.entries(def.cost).every(([k, n]) => count(k) >= n);
            const on = s.build.on && s.build.piece === id;
            return (
              <button key={id} type="button" className={`ui-card ${on ? "ui-card-hl" : ""}`} title={def.about} disabled={id === "ghostbox" && s.build.ghostBox} onClick={() => game?.setBuildPiece(id)}>
                <span className="text-kyo">{def.name}{id === "ghostbox" && s.build.ghostBox ? " · placed" : ""}</span>
                <span className="cost-row">
                  {Object.entries(def.cost).map(([k, n]) => (
                    <span key={k} className={`cost-chip ${count(k) >= n ? "cost-ok" : "cost-miss"}`}>{ITEM_BY_ID[k]?.name ?? k} {count(k)}/{n}</span>
                  ))}
                </span>
                <span className="text-dim">{have ? def.about : "Missing materials"}</span>
              </button>
            );
          })}
        </div>
        <p className="text-dim">A campfire makes a 15×15 safe zone. Walls go anywhere; beds and the Ghost Box go inside a camp. Click a placed piece in build mode to pick it up. Walls placed: {s.build.placed} · Beds: {s.build.beds}.{s.build.inZone ? " You are inside a safe zone." : ""}{s.build.holding ? " Your followers are in bed at camp." : ""}</p>
      </Section>
      <Section title="CAMPFIRE CRAFTING">
        <div className="ui-grid" style={{ "--min": "210px" } as React.CSSProperties}>
          {CAMP_RECIPE_LIST.map((r) => {
            const have = Object.entries(r.costs).every(([id, n]) => count(id) >= n);
            const outs = Object.entries(r.outputs).map(([id, n]) => `${ITEM_BY_ID[id]?.name ?? id} ×${n}`).join(", ");
            return (
              <div key={r.id} className={`ui-card ${have && s.nearCamp ? "ui-card-hl" : ""}`} title={r.about}>
                <span className="text-kyo">{r.name}</span>
                <span className="text-dim">→ {outs}</span>
                <div className="cost-row">
                  {Object.entries(r.costs).map(([id, n]) => (
                    <span key={id} className={`cost-chip ${count(id) >= n ? "cost-ok" : "cost-miss"}`}>{ITEM_BY_ID[id]?.name ?? id} {count(id)}/{n}</span>
                  ))}
                </div>
                <button type="button" className="px-btn ui-btn-sm" disabled={!s.nearCamp || !have} onClick={() => game?.survivalAction(r.id)}>Make</button>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Pause
// ---------------------------------------------------------------------------

const CONTROLS: [string, string][] = [
  ["WASD", "Move"], ["E", "Gather · talk"], ["1-9", "Cast verse"], ["0", "Attack"], ["I", "Gear"], ["B", "Bag"], ["V", "Verses"], ["K", "Skills"], ["G", "Spirits"],
  ["C", "Sheet"], ["X", "Crafting"], ["Q", "Quests"], ["M", "Map"], ["T", "Market"], ["H", "Camp (HC)"], ["F", "Build (HC)"], ["Esc", "Close · pause"],
];

/** Where your progress stands: always on this device, and whether the cloud copy has caught up. */
export function SaveStatus({ game }: GameProp) {
  const [s, setS] = useState<SyncState>(syncState());
  const [, tick] = useState(0);
  useEffect(() => onSync(setS), []);
  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 5000); return () => window.clearInterval(t); }, []);
  const ago = s.at ? Math.max(0, Math.round((Date.now() - s.at) / 1000)) : 0;
  const text = s.state === "synced" ? `Cloud save up to date · ${ago < 5 ? "just now" : `${ago}s ago`}`
    : s.state === "saving" ? "Saving to the cloud…"
    : s.state === "failed" ? `Cloud save failed ${s.fails}× · retrying. Your progress is safe on this device.`
    : "Saved on this device · cloud sync starts after sign-in.";
  return (
    <div className="ui-row-gap" data-testid="save-status">
      <span className={s.state === "failed" ? "text-bad" : s.state === "synced" ? "text-good" : "text-dim"}>● {text}</span>
      <button type="button" className="px-btn ui-btn-sm" data-testid="save-now-btn" onClick={() => game?.flushCloud()}>Save now</button>
    </div>
  );
}

export const PausePanel = memo(function PausePanel({ game }: GameProp) {
  const { map, unstuck } = useSnapPick(["map", "unstuck"] as const);
  const maps = game?.customMaps() ?? [];
  return (
    <div className="ui-stack">
      <div className="ui-row-gap">
        <button type="button" className="px-btn px-btn-kyo" onClick={() => game?.closePanel()}>Resume</button>
        <button type="button" className="px-btn" data-testid="unstuck-menu-btn" onClick={() => game?.beginUnstuck()}>{unstuck ? `Unstuck ${unstuck}` : "Unstuck · 3s"}</button>
        <button type="button" className="px-btn" onClick={() => game?.toggle("skills")}>Skills (K)</button>
      </div>
      <SaveStatus game={game} />
      <Section title="CONTROLS">
        <div className="controls-grid">
          {CONTROLS.map(([k, v]) => (
            <span key={k} className="controls-row"><kbd className="key-badge">{k}</kbd> {v}</span>
          ))}
        </div>
        <p className="text-dim">Right-click for more actions. Drag windows by their title bar, resize from the corner, pin to keep them open.</p>
      </Section>
      <Section title="WORLDS & DESIGNER MAPS">
        <div className="ui-list" data-testid="designer-maps">
          {map.startsWith("custom-") && <button type="button" className="px-btn px-btn-kyo" data-testid="leave-custom-map-btn" onClick={() => game?.leaveCustom()}>Return to the overworld</button>}
          {maps.map((m) => (
            <button key={m.id} type="button" className={`px-btn text-left ${map === `custom-${m.id}` ? "map-btn-active" : ""}`} data-testid={`enter-map-${m.id}`} disabled={map === `custom-${m.id}`} onClick={() => game?.enterCustom(m.id)}>
              {map === `custom-${m.id}` ? `▶ ${m.name}` : `Enter ${m.name}`} <span className="text-dim">· {m.builtin ? "world" : m.kind}</span>
            </button>
          ))}
          {!maps.length && <Empty>Build and save maps in Designer Mode, then enter them here.</Empty>}
        </div>
      </Section>
      <div className="ui-row-gap">
        <button type="button" className="px-btn ui-btn-sm" data-testid="reset-layout-btn" onClick={() => resetLayout()}>Reset window layout</button>
        <AccountChip />
        <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.toTitle()}>Return to title</button>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// NPC talk
// ---------------------------------------------------------------------------

export const TalkWindow = memo(function TalkWindow({ game }: GameProp) {
  const { talk, wares, stock, selected } = useSnapPick(["talk", "wares", "stock", "selected"] as const);
  if (!talk) return null;
  return (
    <div className="ui-stack">
      <p className="talk-line">{talk.line}</p>
      <div className="ui-row-gap">
        {talk.more !== false && <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.nextLine()}>More</button>}
        {talk.shrine && <button type="button" className="px-btn px-btn-kyo ui-btn-sm" onClick={() => game?.startShrine(talk.shrine!)}>Enter shrine</button>}
        {talk.id === "orien" && <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.teach()}>Learn verses</button>}
        {talk.id === "holt" && <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.turnSalt()}>Turn in salt</button>}
        {talk.id === "bram" && <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.brew("meal")}>Cook a fish</button>}
        {talk.shop === "alchemy" && <button type="button" className="px-btn px-btn-kyo ui-btn-sm" onClick={() => game?.toggle("craft")}>Open crafting</button>}
        <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.closePanel()}>Leave</button>
      </div>
      {talk.shop === "general" && (
        <div className="bm-list">
          {wares.map((w) => (
            <div key={w.id} className="bm-row">
              <span className="bm-row-name">{w.name}</span>
              <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.buyItem(w.id)}>{w.price} kyo</button>
            </div>
          ))}
        </div>
      )}
      {(talk.shop === "armor" || talk.shop === "fence") && (
        <div className="bm-list">
          {stock.map((it) => (
            <div key={it.uid} className="bm-row">
              <span className="bm-row-name">{it.name}<span className="block text-dim">{it.type}</span></span>
              <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.buyGear(it.uid)}>{it.price} kyo</button>
            </div>
          ))}
          {talk.shop === "fence" && <button type="button" className="px-btn" disabled={!selected} onClick={() => selected && game?.sell(selected)}>Sell selected gear</button>}
        </div>
      )}
      {talk.quests && (talk.quests.offers.length > 0 || talk.quests.active.length > 0) && (
        <div className="ui-list" data-testid="map-quest-talk">
          {talk.quests.active.map((q) => (
            <div key={q.id} className="ui-card ui-card-hl">
              <p className="text-kyo">{q.ready ? "READY TO HAND IN" : "IN PROGRESS"} · {q.name}</p>
              {q.lines.map((l, i) => <p key={i} className="text-dim">{l}</p>)}
            </div>
          ))}
          {talk.quests.offers.map((q) => (
            <div key={q.id} className="ui-card">
              <p className="text-kyo">QUEST · {q.name}</p>
              <p>{q.about}</p>
              {q.steps.map((l, i) => <p key={i} className="text-dim">{i + 1}. {l}</p>)}
              {q.reward && <p className="text-dim">Reward: {q.reward}</p>}
              <button type="button" className="px-btn px-btn-kyo ui-btn-sm" data-testid={`accept-map-quest-${q.id}`} onClick={() => game?.acceptMapQuestById(q.id)}>Accept</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Right-click menu
// ---------------------------------------------------------------------------

export const ContextMenu = memo(function ContextMenu({ game }: GameProp) {
  const { menu } = useSnapPick(["menu"] as const);
  if (!menu) return null;
  const left = Math.max(8, Math.min(menu.sx, window.innerWidth - 340));
  const top = Math.max(8, Math.min(menu.sy, window.innerHeight - 280));
  return (
    <div className="ctx-menu px-panel" style={{ left, top }} role="menu">
      <p className="ctx-title">{menu.title}</p>
      {menu.lines.map((line) => <p key={line} className="ctx-line">{line}</p>)}
      <div className="ctx-actions">
        {menu.actions.map((a) => (
          <button key={a.id} type="button" role="menuitem" className="px-btn ui-btn-sm" onClick={() => game?.menuAct(a.id)}>{a.label}</button>
        ))}
        <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.clearMenu()}>Close</button>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// You Died
// ---------------------------------------------------------------------------

export function DiedOverlay({ game }: GameProp) {
  const { died, keepWorld } = useSnapPick(["died", "keepWorld"] as const);
  if (!died) return null;
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-3 border-b border-bone/20 py-0.5"><span className="text-dim">{label}</span><span>{value}</span></div>
  );
  return (
    <div className="loot-overlay died-overlay" role="dialog" aria-label="You died" data-testid="died-screen">
      <div className="died-panel">
        <h2 className="died-title">YOU DIED</h2>
        <p className="died-sub">{died.name} · {died.className}{died.focus ? ` (${died.focus})` : ""} · Level {died.level}{died.mode === "turbz" ? " · TURBZ" : died.mode === "hardcore" ? " · Hardcore" : ""}</p>
        {died.cause && <p className="text-blood">{died.cause}</p>}
        <div className="px-panel died-stats">
          {row("Level reached", died.level)}
          {row("Foes defeated", died.kills.toLocaleString())}
          {row("Survived", died.survived)}
          {died.mode !== "turbz" && row("Kyo carried", died.kyo.toLocaleString())}
          {row("Spirits in party", `${died.spirits}${died.shinies ? ` (✦ ${died.shinies} shiny)` : ""}`)}
          {died.mode !== "turbz" && row("Account Score gained", <span className="text-kyo">+{died.score.toLocaleString()}</span>)}
          {died.mode !== "turbz" && row("Account Score total", died.accountScore.toLocaleString())}
          {died.mode === "turbz" && row("Life score", died.score.toLocaleString())}
          {died.skills.length > 0 && row("Best skills", died.skills.map((k) => `${k.name} ${k.level}`).join(" · "))}
          {died.gear.length > 0 && row("Wore", died.gear.join(", "))}
        </div>
        <p className="text-dim">{died.mode === "turbz"
          ? "Play again to start a new witch. Worn gear and party ghosts return at level 1, enchants kept. This run's skills, account level and pockets are wiped. Hunt and Hardcore are not."
          : "Skills, account level and permanent bonuses stay with you."}</p>
        {died.mode !== "turbz" && (
        <div className="px-panel died-stats" data-testid="died-world">
          <p>World: <span className="text-kyo">{died.world}</span>{died.seed ? <span className="text-dim"> · seed {died.seed}</span> : null}</p>
          <p className="text-dim">{keepWorld ? "Your next life wakes in this same world." : "Your next life wakes in a brand-new world, unless you keep this one."}</p>
          <button type="button" className={`px-btn ${keepWorld ? "px-btn-kyo" : ""}`} data-testid="keep-world-btn" aria-pressed={keepWorld} onClick={() => game?.setKeepWorld(!keepWorld)}>
            {keepWorld ? "✓ Keeping Current World" : "Keep Current World"}
          </button>
        </div>
        )}
        <div className="screen-actions">
          <button type="button" className="px-btn" data-testid="died-menu-btn" onClick={() => game?.toTitle()}>Go to menu</button>
          <button type="button" className="px-btn px-btn-kyo" data-testid="died-again-btn" onClick={() => game?.toRebirth()}>Play again</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The veil: choose the next witch
// ---------------------------------------------------------------------------

function RebirthWorldNote({ game }: GameProp) {
  const { keepWorld, died } = useSnapPick(["keepWorld", "died"] as const);
  return (
    <p className="ui-row-gap" data-testid="rebirth-world">
      <span className={keepWorld ? "text-kyo" : "text-dim"}>{keepWorld ? `Keeping ${died?.world ?? "this world"}.` : "A new world will be rolled for this life."}</span>
      <button type="button" className={`px-btn ui-btn-sm ${keepWorld ? "px-btn-kyo" : ""}`} onClick={() => game?.setKeepWorld(!keepWorld)}>{keepWorld ? "✓ Keep Current World" : "Keep Current World"}</button>
    </p>
  );
}

export function RebirthOverlay({ game }: GameProp) {
  const { unlocked, classId: lastClass, died } = useSnapPick(["unlocked", "classId", "died"] as const);
  const turbz = died?.mode === "turbz";
  const [name, setName] = useState("Mira");
  // Start on the class that just died: that is where its finished sets live.
  const [pick, setPick] = useState<Pick>(() => ({ classId: (CLASS_BY_ID[lastClass as ClassId] ? lastClass : "warden") as ClassId, traitId: null, female: true }));
  const race = CLASS_RACE[pick.classId];
  const owned = unlocked.filter((s) => s.classId === pick.classId);
  const [setId, setSetId] = useState<string | null>(() => owned[0]?.id ?? null);
  const counts = unlocked.reduce<Record<string, number>>((m, s) => ((m[s.classId] = (m[s.classId] ?? 0) + 1), m), {});
  const others = Object.keys(counts).filter((c) => c !== pick.classId && CLASS_BY_ID[c as ClassId]);
  return (
    <div className="loot-overlay">
      <div className="px-panel loot-panel" data-testid="rebirth-screen">
        <p className="screen-kicker">THE VEIL</p>
        <h2 className="screen-title">Choose the next witch</h2>
        <p className="text-dim">{turbz
          ? "A new witch, level 1, on a new wild. The gear you were wearing and the ghosts in your party come with you at level 1, enchants kept. Skills from this run are gone. Hunt and Hardcore skills stay where they were."
          : "This body is gone. Account Score, skills, perks, finished sets and every ghost stay. In TurboHunt you wake at a tavern; in Hardcore, at the world's starting point."}</p>
        {!turbz && <RebirthWorldNote game={game} />}
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value.slice(0, 16))} className="px-input" /></Field>
        <ClassPicker
          pick={pick}
          badge={(id) => (counts[id] ? `${counts[id]} set${counts[id] > 1 ? "s" : ""}` : null)}
          setPick={(p) => {
            setPick(p);
            if (p.classId !== pick.classId) setSetId(unlocked.find((s) => s.classId === p.classId)?.id ?? null);
          }}
          game={game}
        />
        {!turbz && (
        <Section title={`SPAWN GEAR · ${CLASS_BY_ID[pick.classId]?.name ?? ""}`}>
          <div className="ui-grid" style={{ "--min": "220px" } as React.CSSProperties}>
            <button type="button" className={`ui-card verse-pick ${setId === null ? "ui-card-hl" : ""}`} onClick={() => setSetId(null)}>Default witch robes</button>
            {owned.map((s) => (
              <button key={s.id} type="button" data-testid={`rebirth-set-${s.id}`} className={`ui-card verse-pick ${setId === s.id ? "ui-card-hl" : ""}`} onClick={() => setSetId(s.id)}>
                {s.name} <span className="text-kyo">· level 1 set</span><span className="text-dim">{s.bonus}</span>
              </button>
            ))}
          </div>
          {owned.length === 0 && <Empty>No finished set for this class yet. Collect all five pieces (helm, raiment, skirt, boots, relic) of one set while playing it.</Empty>}
          {others.length > 0 && <p className="text-dim">Sets are saved on: {others.map((c) => `${CLASS_BY_ID[c as ClassId].name} (${counts[c]})`).join(", ")}.</p>}
        </Section>
        )}
        <button type="button" className="px-btn px-btn-kyo" data-testid="rebirth-go-btn" onClick={() => game?.rebirth(name, race, setId, pick.classId, pick.traitId, classGendered(pick.classId) ? pick.female : true)}>
          Wake as this witch
        </button>
      </div>
    </div>
  );
}

