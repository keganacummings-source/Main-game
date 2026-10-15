import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ALCHEMY_RECIPES, ITEM_BY_ID, TYPES, type TypeId } from "@/game/content";
import { classGendered, CLASS_BY_ID, CLASS_RACE, type ClassId } from "@/game/classes";
import { bestFood } from "@/game/item-use";
import { CAMP_RECIPE_LIST } from "@/game/survival";
import { resetLayout } from "@/game/ui-layout";
import { listChat, postChat } from "@/game/social-client";
import type { ChatLine } from "@/game/social-types";
import type { BoardView } from "@/game/quest-board";
import type { TurbzGame } from "@/game/engine";
import { ClassPicker, makeLobbyCode, type Pick } from "./character-ui";
import { AccountChip } from "./hub-ui";
import { useSnapPick } from "./use-snap";
import { Chips, ConfirmButton, Empty, Field, Meter, Pips, Section, Tabs } from "./ui-kit";

type GameProp = { game: TurbzGame | null };
const typeClass = (t: TypeId) => `type-${t}`;

// ---------------------------------------------------------------------------
// Skills & account perks
// ---------------------------------------------------------------------------

export const SkillsPanel = memo(function SkillsPanel({ game }: GameProp) {
  const s = useSnapPick(["accountLevel", "accountXp", "accountNeed", "perkPoints", "perks", "accountScore", "skills", "skillPoints"] as const);
  const [tab, setTab] = useState<"perks" | "skills">("perks");
  return (
    <div className="ui-stack">
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "perks", label: `Account perks · ${s.perkPoints}` }, { id: "skills", label: "Skills" }]} />
      {tab === "perks" && (
        <>
          <div className="ui-card ui-stack-sm">
            <div className="ui-row">
              <span>Account <span className="text-kyo">{s.accountLevel}</span></span>
              <span className="text-dim">Score {s.accountScore.toLocaleString()}</span>
            </div>
            <Meter value={s.accountXp} max={s.accountNeed} label="XP" small />
            <p className="text-dim">Perks stay on every witch: death, a new body and Hardcore all keep them.</p>
          </div>
          <div className="ui-grid" style={{ "--min": "230px" } as React.CSSProperties}>
            {s.perks.map((p) => (
              <div key={p.id} className={`ui-card perk-card ${p.power >= p.max ? "ui-card-done" : ""}`}>
                <div className="ui-row">
                  <span className="text-kyo">{p.name}</span>
                  <span className="text-dim">{p.power}/{p.max}</span>
                </div>
                <Meter value={p.power} max={p.max} small detail={p.power >= p.max ? "MAX" : `${p.power}/${p.max}`} />
                <p className="ui-card-about">{p.about.split(". You have")[0]}.</p>
                <button type="button" className="px-btn ui-btn-sm" disabled={s.perkPoints < 1 || p.power >= p.max} onClick={() => game?.spendPerk(p.id)}>
                  {p.power >= p.max ? "Maxed" : "+1 point"}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "skills" && (
        <>
          <p className="text-dim">Skills cap at 400 and stay on the account. {s.skillPoints} skill points to spend in Verses.</p>
          <div className="ui-list">
            {s.skills.map((sk) => (
              <div key={sk.id} className="ui-card skill-row">
                <div className="ui-row">
                  <span className="text-kyo">{sk.name}</span>
                  <span>{sk.level}<span className="text-dim">/400</span></span>
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
  const [show, setShow] = useState<"all" | "owned" | "locked">("all");
  const equipped = useMemo(() => new Set(s.bar.map((m) => m.id)), [s.bar]);
  const unlocked = useMemo(() => s.abilities.filter((m) => m.rank > 0), [s.abilities]);
  const catalog = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return s.abilities
      .filter((m) => (type === "all" || m.type === type) && (show === "all" || (show === "owned" ? m.rank > 0 : m.rank === 0)))
      .filter((m) => !f || m.name.toLowerCase().includes(f) || m.effect.includes(f) || m.about.toLowerCase().includes(f))
      .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "power" ? b.power - a.power : sort === "rank" ? b.rank - a.rank || a.name.localeCompare(b.name) : a.type.localeCompare(b.type) || a.name.localeCompare(b.name)));
  }, [s.abilities, filter, type, sort, show]);
  return (
    <div className="ui-stack">
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "loadout", label: `Loadout · ${s.bar.length}/${MAX_BAR}` }, { id: "library", label: `Library · ${s.skillPoints} pts` }]} />
      {tab === "loadout" && (
        <>
          <Section title="EQUIPPED · TAP TO REMOVE">
            <div className="verse-slots">
              {Array.from({ length: MAX_BAR }, (_, i) => {
                const m = s.bar[i];
                return m ? (
                  <button key={i} type="button" className={`verse-slot hot-${m.type}`} onClick={() => game?.setBar(i, "")} title="Unequip">
                    <span className="key-badge">{i + 1}</span>
                    <span className={`verse-slot-name ${typeClass(m.type)}`}>{m.name}</span>
                    <span className="hot-tag">{m.tag.split(" · ")[0]}</span>
                  </button>
                ) : (
                  <div key={i} className="verse-slot verse-slot-empty"><span className="key-badge">{i + 1}</span><span className="text-dim">Empty</span></div>
                );
              })}
            </div>
          </Section>
          <Section title={`UNLOCKED · ${unlocked.length} · TAP TO EQUIP`}>
            {unlocked.length ? (
              <div className="ui-grid" style={{ "--min": "190px" } as React.CSSProperties}>
                {unlocked.map((m) => (
                  <button key={m.id} type="button" className={`ui-card verse-pick ${equipped.has(m.id) ? "ui-card-done" : ""}`} disabled={equipped.has(m.id) || s.bar.length >= MAX_BAR} onClick={() => game?.setBar(s.bar.length, m.id)}>
                    <span className={typeClass(m.type)}>{m.name}</span>
                    <span className="ui-row"><Pips value={m.rank} max={5} /><span className="text-dim">{equipped.has(m.id) ? "equipped" : m.effect}</span></span>
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
          <p className="text-dim">1 point unlocks a verse or adds a rank (max 5). Each rank adds 15% damage, healing or shield.</p>
          <div className="bag-toolbar">
            <input className="px-input" aria-label="Search verses" placeholder="Search name, effect, words" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <select className="px-input" aria-label="Sort verses" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="type">By element</option>
              <option value="name">By name</option>
              <option value="power">By power</option>
              <option value="rank">By rank</option>
            </select>
          </div>
          <Chips value={show} onChange={setShow} options={[{ id: "all", label: "All" }, { id: "owned", label: "Unlocked" }, { id: "locked", label: "Locked" }]} />
          <Chips value={type} onChange={setType} label="Element" options={[{ id: "all" as const, label: "Any element" }, ...(Object.keys(TYPES) as TypeId[]).map((t) => ({ id: t, label: <span className={typeClass(t)}>{TYPES[t].name}</span> }))]} />
          <div className="ui-grid" style={{ "--min": "240px" } as React.CSSProperties}>
            {catalog.map((m) => (
              <div key={m.id} className={`ui-card verse-card2 ${m.rank ? "" : "verse-locked"}`}>
                <div className="ui-row">
                  <span className={typeClass(m.type)}>{m.name}</span>
                  <Pips value={m.rank} max={5} />
                </div>
                <p className="ui-card-about">{m.about}</p>
                <p className="text-dim verse-stats">Pow {m.power} · Acc {m.accuracy}% · Crit {m.crit}% · Rng {m.range}{m.effect !== "none" ? ` · ${m.effect}` : ""}</p>
                <div className="ui-row-gap">
                  <button type="button" className="px-btn ui-btn-sm" disabled={s.skillPoints < 1 || m.rank >= 5} onClick={() => game?.spendAbility(m.id)}>
                    {m.rank >= 5 ? "Max rank" : m.rank ? "Upgrade · 1" : "Unlock · 1"}
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

export const MapPanel = memo(function MapPanel({ game }: GameProp) {
  const s = useSnapPick(["map", "region", "dungeonCountdown", "dungeonPortals", "mapQuests", "survival", "mapX", "mapY"] as const);
  const ref = useRef<HTMLCanvasElement>(null);
  const tx = Math.round(s.mapX / 64);
  const ty = Math.round(s.mapY / 64);
  useEffect(() => {
    const canvas = ref.current;
    if (canvas && game) game.drawMap(canvas);
  }, [game, tx, ty, s.map, s.mapQuests, s.dungeonPortals, s.survival?.campfires]);
  const custom = s.map.startsWith("custom-");
  const rifts = s.dungeonPortals.filter((p) => !p.cleared);
  return (
    <div className="ui-stack">
      <div className="ui-row">
        <span className="text-kyo" data-testid={custom ? "custom-map-label" : undefined}>{s.region}</span>
        {!custom && <span className="text-dim">Next rift {Math.floor(s.dungeonCountdown / 60)}:{String(s.dungeonCountdown % 60).padStart(2, "0")}</span>}
      </div>
      <canvas ref={ref} className="map-canvas" aria-label="World map" />
      {rifts.length > 0 && (
        <Section title={`OPEN RIFTS · ${rifts.length}`}>
          <div className="ui-row-gap">
            {rifts.map((p) => (
              <button key={p.id} type="button" className="px-btn ui-btn-sm" disabled={s.map !== "world"} onClick={() => game?.trackRift(p.id)}>Dungeon {p.id.slice(5)}</button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Spirits
// ---------------------------------------------------------------------------

export const SpiritsPanel = memo(function SpiritsPanel({ game }: GameProp) {
  const s = useSnapPick(["spirits", "spiritSlots", "spiritCap", "jarLeft", "skillPoints"] as const);
  const [open, setOpen] = useState<string | null>(null);
  const following = s.spirits.filter((x) => x.active).length;
  const sel = s.spirits.find((x) => x.uid === open) ?? null;
  return (
    <div className="ui-stack" data-testid="spirit-panel">
      <div className="ui-row">
        <span>Following <span className="text-kyo">{following}/{s.spiritSlots}</span> · Party {s.spirits.length}/{s.spiritCap}</span>
        <button type="button" className="px-btn ui-btn-sm" disabled={s.skillPoints < 1 || s.spiritSlots >= 10} onClick={() => game?.spendGhostSlot()}>
          {s.spiritSlots >= 10 ? "Slots maxed" : `+1 slot · 1 pt (${s.skillPoints})`}
        </button>
      </div>
      {s.jarLeft > 0 && <p className="text-kyo">Ghost jar humming · {s.jarLeft}s</p>}
      {!s.spirits.length && <Empty>No spirits yet. A fallen foe may stay and join you; a ghost jar raises the odds for a minute.</Empty>}
      {sel && (
        <div className="gear-detail">
          <div className="gear-detail-head">
            <div>
              <p className={typeClass(sel.type)}>{sel.name} <span className="text-dim">Lv {sel.level}</span></p>
              <p className="text-dim">{sel.known.filter((m) => m.slotted).length}/3 readied · {sel.known.length} known · tap a move to ready it</p>
            </div>
            <button type="button" className="float-win-btn" aria-label="Close" onClick={() => setOpen(null)}>×</button>
          </div>
          <div className="ui-grid" style={{ "--min": "180px" } as React.CSSProperties}>
            {sel.known.map((m) => (
              <button key={m.id} type="button" className={`ui-card verse-pick ${m.slotted ? "ui-card-hl" : ""}`} onClick={() => game?.toggleSpiritMove(sel.uid, m.id)}>
                <span className={typeClass(m.type)}>{m.slotted ? "● " : "○ "}{m.name}</span>
                <span className="text-dim">{m.player ? "Aids you" : "Strikes foes"}</span>
              </button>
            ))}
          </div>
          <div className="gear-actions">
            <button type="button" className="px-btn px-btn-kyo" onClick={() => game?.setSpiritActive(sel.uid, !sel.active)}>{sel.active ? "Call back" : "Send out"}</button>
            <ConfirmButton plain label="Dismiss" confirm="Tap again" onConfirm={() => { game?.dismissSpirit(sel.uid); setOpen(null); }} />
          </div>
        </div>
      )}
      <div className="ui-grid" style={{ "--min": "190px" } as React.CSSProperties}>
        {s.spirits.map((sp) => (
          <button key={sp.uid} type="button" className={`ui-card spirit-card ${sp.active ? "ui-card-hl" : ""} ${open === sp.uid ? "gear-card-on" : ""}`} data-testid={`spirit-${sp.uid}`} onClick={() => setOpen(open === sp.uid ? null : sp.uid)}>
            <span className="ui-row"><span className={typeClass(sp.type)}>{sp.name}</span><span className="text-dim">Lv {sp.level}</span></span>
            <Meter value={sp.hp} max={sp.max} small kind={sp.hp / sp.max < 0.3 ? "bad" : "good"} />
            <span className="text-dim">{sp.active ? "Following" : "Benched"} · {sp.known.filter((m) => m.slotted).length}/3 ready</span>
          </button>
        ))}
      </div>
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
  const s = useSnapPick(["survival", "bag", "clock", "nearTree", "nearWater", "nearCamp", "sleeping", "build"] as const);
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
        <button type="button" className="px-btn" disabled={!s.nearCamp} onClick={() => game?.survivalAction("sleep")}>{s.sleeping ? "Wake up" : night ? "Sleep to dawn" : "Sleep"}</button>
      </div>
      <p className="text-dim">Injuries persist until a healing spell is used. Meals, sleep, potions and hearths do not heal in Hardcore.</p>
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
          <button type="button" className="px-btn" data-testid="build-toggle-btn" disabled={!s.build.on && count("timber") < 1} onClick={() => game?.toggleBuild()}>{s.build.on ? "Stop building (F)" : "Build walls (F)"}</button>
          <button type="button" className="px-btn" data-testid="hold-followers-btn" onClick={() => game?.holdFollowers(!s.build.holding)}>{s.build.holding ? "Call followers back" : "Followers wait here"}</button>
        </div>
        <p className="text-dim">A campfire makes a 15×15 safe zone. Logs placed: {s.build.placed}.{s.build.inZone ? " You are inside a safe zone." : ""}</p>
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
// Lobby
// ---------------------------------------------------------------------------

export const LobbyPanel = memo(function LobbyPanel({ game }: GameProp) {
  const { lobby, mode } = useSnapPick(["lobby", "mode"] as const);
  const inGame = mode === "play";
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  if (!lobby.code) {
    return (
      <div className="ui-stack" data-testid="lobby-panel">
        <p className="text-dim">Play together. One player hosts and shares the code; up to 3 witches. A lobby only exists while its host is online.</p>
        <Field label="Lobby code">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="CODE" aria-label="Lobby code" data-testid="lobby-code-input" className="px-input font-display text-xs" />
        </Field>
        <div className="gear-actions">
          <button type="button" className="px-btn px-btn-kyo" data-testid="lobby-create-btn" disabled={!inGame} onClick={() => game?.hostLobby(code || makeLobbyCode())}>Create lobby</button>
          <button type="button" className="px-btn" data-testid="lobby-join-btn" disabled={!inGame || code.length < 3} onClick={() => game?.joinLobby(code)}>Join</button>
        </div>
      </div>
    );
  }
  return (
    <div className="ui-stack" data-testid="lobby-panel">
      <div className="ui-row">
        <span className="lobby-code" data-testid="lobby-code">{lobby.code}</span>
        <button
          type="button"
          className="px-btn ui-btn-sm"
          data-testid="lobby-copy-btn"
          onClick={() => {
            void navigator.clipboard?.writeText(lobby.code).then(() => setCopied(true)).catch(() => {});
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <p className="text-dim" data-testid="lobby-status">{lobby.role === "host" ? "You are hosting." : "You joined as a guest."} {lobby.net}</p>
      <div className="ui-list" data-testid="lobby-members">
        {lobby.members.map((m) => (
          <div key={m.id} className="ui-card" data-testid={`lobby-member-${m.self ? "self" : m.id}`}>
            <div className="ui-row">
              <span>{m.host ? "♛ " : ""}{m.name}{m.self ? " (you)" : ""}</span>
              <span className="text-dim">{m.className}{m.level ? ` · Lv ${m.level}` : ""}</span>
            </div>
            {m.max > 0 && <Meter value={m.hp} max={m.max} small kind="hp" />}
          </div>
        ))}
        {lobby.members.length <= 1 && <Empty>Waiting for others. Share the code {lobby.code}.</Empty>}
      </div>
      <button type="button" className="px-btn" data-testid="lobby-leave-btn" onClick={() => game?.leaveLobby()}>Leave lobby</button>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Pause
// ---------------------------------------------------------------------------

const CONTROLS: [string, string][] = [
  ["WASD", "Move"], ["E", "Gather · talk"], ["1-9", "Cast verse"], ["0", "Attack"], ["B / I", "Bag"], ["V", "Verses"], ["K", "Skills"], ["G", "Spirits"],
  ["C", "Sheet"], ["X", "Crafting"], ["Q", "Quests"], ["M", "Map"], ["L", "Lobby"], ["T", "Market"], ["H", "Camp (HC)"], ["F", "Build (HC)"], ["Esc", "Close · pause"],
];

export const PausePanel = memo(function PausePanel({ game }: GameProp) {
  const { map, roomCode, unstuck } = useSnapPick(["map", "roomCode", "unstuck"] as const);
  const maps = game?.customMaps() ?? [];
  return (
    <div className="ui-stack">
      <div className="ui-row-gap">
        <button type="button" className="px-btn px-btn-kyo" onClick={() => game?.closePanel()}>Resume</button>
        <button type="button" className="px-btn" data-testid="unstuck-menu-btn" onClick={() => game?.beginUnstuck()}>{unstuck ? `Unstuck ${unstuck}` : "Unstuck · 3s"}</button>
        <button type="button" className="px-btn" onClick={() => game?.toggle("skills")}>Skills (K)</button>
      </div>
      {roomCode && <p className="text-kyo">Lobby {roomCode}</p>}
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
// The veil: choose the next witch
// ---------------------------------------------------------------------------

export function RebirthOverlay({ game }: GameProp) {
  const { unlocked, classId: lastClass } = useSnapPick(["unlocked", "classId"] as const);
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
        <p className="text-dim">This body is gone. Account Score, skills, perks and finished sets stay. You wake in another tavern.</p>
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
        <Section title={`SPAWN GEAR · ${CLASS_BY_ID[pick.classId]?.name ?? ""}`}>
          <div className="ui-grid" style={{ "--min": "220px" } as React.CSSProperties}>
            <button type="button" className={`ui-card verse-pick ${setId === null ? "ui-card-hl" : ""}`} onClick={() => setSetId(null)}>Default witch robes</button>
            {owned.map((s) => (
              <button key={s.id} type="button" data-testid={`rebirth-set-${s.id}`} className={`ui-card verse-pick ${setId === s.id ? "ui-card-hl" : ""}`} onClick={() => setSetId(s.id)}>
                {s.name} <span className="text-kyo">· level 1 set</span><span className="text-dim">{s.bonus}</span>
              </button>
            ))}
          </div>
          {owned.length === 0 && <p className="text-dim">No finished set for this class yet. Collect all five pieces (helm, raiment, skirt, boots, relic) of one set while playing it.</p>}
          {others.length > 0 && <p className="text-dim">Sets are saved on: {others.map((c) => `${CLASS_BY_ID[c as ClassId].name} (${counts[c]})`).join(", ")}.</p>}
        </Section>
        <button type="button" className="px-btn px-btn-kyo" data-testid="rebirth-go-btn" onClick={() => game?.rebirth(name, race, setId, pick.classId, pick.traitId, classGendered(pick.classId) ? pick.female : true)}>
          Wake at a new tavern
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// In-game chat: party, global and friends in one window
// ---------------------------------------------------------------------------

export function GameChat({ game }: GameProp) {
  const { chat } = useSnapPick(["chat"] as const);
  const [tab, setTab] = useState<"party" | "global" | "friends">("party");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    if (tab === "party") return;
    let stop = false;
    const pull = () => void listChat().then((rows) => { if (!stop) setLines(rows); }).catch(() => {});
    pull();
    const id = window.setInterval(pull, 3000);
    return () => { stop = true; window.clearInterval(id); };
  }, [tab]);
  const shown = tab === "party" ? chat.map((c, i) => ({ id: `p${i}`, who: c.name, body: c.text, mine: false })) : lines.filter((l) => l.channel === tab).slice(-14).map((l) => ({ id: l.id, who: l.username, body: l.body, mine: l.mine }));
  async function send() {
    const body = text.trim();
    if (!body) return;
    setErr("");
    if (tab === "party") {
      game?.sendChat(body);
      setText("");
      return;
    }
    try {
      await postChat(tab, body);
      setText("");
      setLines(await listChat());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The veil refused that.");
    }
  }
  return (
    <div className="ui-stack-sm game-chat">
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "party", label: "Party" }, { id: "global", label: "Global" }, { id: "friends", label: "Friends" }]} />
      <div className="veil-log">
        {shown.length === 0 && <p className="text-dim">{tab === "party" ? "Party chat reaches your lobby." : "The channel is quiet."}</p>}
        {shown.map((l) => (
          <p key={l.id}><span className={l.mine ? "text-kyo" : "text-blood"}>{l.who}</span><span className="text-dim"> · </span>{l.body}</p>
        ))}
      </div>
      <form className="chat-form" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value.slice(0, 160))} placeholder={tab === "party" ? "Party chat" : tab === "global" ? "Speak to every witch" : "Friends only"} aria-label="Chat message" data-testid="party-chat-input" className="px-input" autoComplete="off" />
        <button type="submit" className="px-btn px-btn-kyo ui-btn-sm">Send</button>
      </form>
      {err && <p className="text-blood">{err}</p>}
    </div>
  );
}
