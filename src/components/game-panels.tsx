import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ALCHEMY_RECIPES, attackForm, ITEM_BY_ID, moveTactic, TYPES, type TypeId } from "@/game/content";
import { classGendered, CLASSES, CLASS_BY_ID, CLASS_RACE, type ClassId } from "@/game/classes";
import { bestFood } from "@/game/item-use";
import { CAMP_RECIPE_LIST } from "@/game/survival";
import { BLOCK_KYO, BUILD_GROUPS, BUILD_HOTKEY_ORDER, BUILD_PIECES, MAX_BEDS, TURBZ_ONLY_PIECES } from "@/game/building";
import { GhostCard, GhostDetailCard, GhostName } from "./ghost-ui";
import { resetLayout } from "@/game/ui-layout";
import type { BoardView } from "@/game/quest-board";
import { verseAreaNote, type Snap, type TurbzGame } from "@/game/engine";
import { onSync, syncState, type SyncState } from "@/game/account-save";
import { ClassPicker, type Pick } from "./character-ui";
import { AccountChip } from "./hub-ui";
import { useSnapPick } from "./use-snap";
import { Chips, ConfirmButton, Empty, Field, Meter, Pips, Section, StatusChips, Tabs, usePref } from "./ui-kit";

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
  const [tab, setTab] = usePref("turbz-skills-tab", ["perks", "skills"] as const, "perks");
  const [cat, setCat] = usePref("turbz-skills-cat", PERK_CATS.map((c) => c.id), "all");
  const [show, setShow] = usePref("turbz-skills-show", ["all", "started", "fresh", "maxed"] as const, "all");
  const [sort, setSort] = usePref("turbz-skills-sort", ["default", "name", "power", "progress"] as const, "default");
  const [skillSort, setSkillSort] = usePref("turbz-skills-ssort", ["default", "level", "name", "next"] as const, "default");
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const earned = Math.max(0, s.accountLevel - 1) * 5;
  const spent = Math.max(0, earned - s.perkPoints);
  const cats = PERK_CATS.filter((c) => c.id === "all" || s.perks.some((p) => p.cat === c.id));
  const maxed = s.perks.filter((p) => p.power >= p.max).length;
  const shown = s.perks
    .filter((p) => cat === "all" || p.cat === cat)
    .filter((p) => show === "all" || (show === "maxed" ? p.power >= p.max : show === "fresh" ? p.power <= 0 : p.power > 0 && p.power < p.max))
    .filter((p) => !term || p.name.toLowerCase().includes(term) || p.about.toLowerCase().includes(term))
    .slice()
    .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "power" ? b.power - a.power : sort === "progress" ? b.power / Math.max(1, b.max) - a.power / Math.max(1, a.max) : 0);
  const skills = s.skills
    .filter((sk) => !term || sk.name.toLowerCase().includes(term) || sk.line.toLowerCase().includes(term))
    .slice()
    .sort((a, b) => skillSort === "level" ? b.level - a.level : skillSort === "name" ? a.name.localeCompare(b.name) : skillSort === "next" ? b.xp / Math.max(1, b.need) - a.xp / Math.max(1, a.need) : 0);
  const totalSkill = s.skills.reduce((a, sk) => a + sk.level, 0);
  const best = s.skills.reduce<(typeof s.skills)[number] | null>((a, sk) => (!a || sk.level > a.level ? sk : a), null);
  const resetOn = !!term || cat !== "all" || show !== "all";
  return (
    <div className="ui-stack" data-testid="skills-panel">
      <StatusChips items={[
        { label: <>Account <b>{s.accountLevel}</b></>, tone: "kyo" },
        { label: `${s.perkPoints} perk point${s.perkPoints === 1 ? "" : "s"}`, tone: s.perkPoints > 0 ? "on" : undefined },
        { label: `${maxed}/${s.perks.length} perks maxed` },
        { label: `Skills total ${totalSkill}` },
        best && { label: `Best: ${best.name} ${best.level}` },
      ]} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "perks", label: `Account perks · ${s.perkPoints}`, testid: "skills-tab-perks" }, { id: "skills", label: `Skills · ${s.skills.length}`, testid: "skills-tab-skills" }]} />
      <div className="menu-toolbar">
        <input className="px-input" aria-label={tab === "perks" ? "Search perks" : "Search skills"} placeholder={tab === "perks" ? "Search perks" : "Search skills"} value={q} onChange={(e) => setQ(e.target.value)} data-testid="skills-search" />
        {tab === "perks" ? (
          <select className="px-input" aria-label="Sort perks" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="default">Default order</option><option value="name">By name</option><option value="power">Most invested</option><option value="progress">Closest to max</option>
          </select>
        ) : (
          <select className="px-input" aria-label="Sort skills" value={skillSort} onChange={(e) => setSkillSort(e.target.value as typeof skillSort)}>
            <option value="default">Default order</option><option value="level">Highest level</option><option value="name">By name</option><option value="next">Closest to next level</option>
          </select>
        )}
        {tab === "perks" && <button type="button" className="px-btn ui-btn-sm" disabled={!resetOn} onClick={() => { setQ(""); setCat("all"); setShow("all"); }}>Clear filters</button>}
      </div>
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
          <Chips value={show} onChange={setShow} label="Progress" options={[{ id: "all", label: "Any" }, { id: "started", label: "In progress" }, { id: "fresh", label: "Not started" }, { id: "maxed", label: `Maxed ${maxed}` }]} />
          <p className="menu-count">{shown.length} of {s.perks.length} perks</p>
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
          {!shown.length && <Empty>No perks match.</Empty>}
        </>
      )}
      {tab === "skills" && (
        <>
          <p className="text-dim">Skills stay on the account and do not cap. Chance bonuses bend before they can break a fight. {s.skillPoints} skill points to spend in Verses (V).</p>
          <div className="ui-grid" style={{ "--min": "240px" } as React.CSSProperties}>
            {skills.map((sk) => (
              <div key={sk.id} className={`ui-card skill-row skill-row-top ${best && sk.id === best.id ? "menu-pinned" : ""}`} data-testid={`skill-${sk.id}`}>
                <div className="ui-row">
                  <span className="text-kyo">{sk.name}</span>
                  <span>Lv {sk.level}</span>
                </div>
                <Meter value={sk.xp} max={sk.need} small detail={`${sk.xp.toLocaleString()}/${sk.need.toLocaleString()}`} />
                <p className="ui-card-about">{sk.line}</p>
              </div>
            ))}
          </div>
          {!skills.length && <Empty>No skills match.</Empty>}
        </>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Verses
// ---------------------------------------------------------------------------

const MAX_BAR = 9;
type VerseRow = Snap["abilities"][number];
const ROLE_OF = (m: VerseRow): string => {
  if (m.aura) return "support";
  const tac = moveTactic(m);
  if (["blink", "lunge", "dash", "roll", "surge"].includes(tac)) return "movement";
  if (tac === "heal" || tac === "ward") return "support";
  const f = attackForm(m);
  return f === "melee" ? "melee" : f === "ranged" ? "ranged" : "spell";
};
const SHAPES: { id: string; label: string; has: (m: VerseRow) => boolean }[] = [
  { id: "multi", label: "Multi-hit", has: (m) => !!m.multi },
  { id: "area", label: "Area", has: (m) => !!(m.nova || m.splash) },
  { id: "chain", label: "Chain", has: (m) => !!m.chain },
  { id: "echo", label: "Echo", has: (m) => !!m.echo },
  { id: "buff", label: "Self-buff", has: (m) => !!m.selfBuff },
];
const ROLES_V = [["melee", "Melee"], ["ranged", "Ranged"], ["spell", "Magic"], ["support", "Support"], ["movement", "Movement"]] as const;
const EFFECTS_V = ["burn", "soak", "root", "sleep", "gloom", "silence", "spark", "expose", "leech", "mend", "shell"] as const;
const toggleIn = (set: string[], id: string) => (set.includes(id) ? set.filter((x) => x !== id) : [...set, id]);

function ToggleRow({ label, value, onChange, options, testid }: { label: string; value: string[]; onChange: (v: string[]) => void; options: readonly (readonly [string, React.ReactNode])[]; testid: string }) {
  return (
    <div className="verse-filter-row" role="group" aria-label={label} data-testid={testid}>
      <span className="verse-filter-label">{label}</span>
      {options.map(([id, l]) => (
        <button key={id} type="button" data-testid={`${testid}-${id}`} aria-pressed={value.includes(id)} className={`verse-chip ${value.includes(id) ? "verse-chip-on" : ""}`} onClick={() => onChange(toggleIn(value, id))}>{l}</button>
      ))}
    </div>
  );
}
export const VersesPanel = memo(function VersesPanel({ game }: GameProp) {
  const s = useSnapPick(["bar", "abilities", "skillPoints", "className"] as const);
  const myClass = useMemo(() => CLASSES.find((c) => c.name === s.className)?.id ?? "", [s.className]);
  const [roles, setRoles] = useState<string[]>([]);
  const [effects, setEffects] = useState<string[]>([]);
  const [shapes, setShapes] = useState<string[]>([]);
  const [source, setSource] = useState<"any" | "mine" | "signature" | "starfall">("any");
  const [desc, setDesc] = useState(true);
  const [tab, setTab] = useState<"loadout" | "library">("loadout");
  const [filter, setFilter] = useState("");
  const [type, setType] = useState<TypeId | "all">("all");
  const [sort, setSort] = useState<"type" | "name" | "power" | "rank" | "cd" | "reach" | "dps" | "acc" | "crit">("type");
  const [show, setShow] = useState<"all" | "owned" | "locked" | "aura" | "new">("all");
  const equipped = useMemo(() => new Set(s.bar.map((m) => m.id)), [s.bar]);
  const [picked, setPicked] = useState<number | null>(null);
  const [moving, setMoving] = useState<number | null>(null);
  const pickedMove = picked !== null ? s.bar[picked] : undefined;
  const pickedInfo = pickedMove ? s.abilities.find((a) => a.id === pickedMove.id) : undefined;
  const unlocked = useMemo(() => s.abilities.filter((m) => m.rank > 0), [s.abilities]);
  const catalog = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const num = (m: VerseRow): number => sort === "power" ? m.now.power || m.power : sort === "rank" ? m.rank : sort === "cd" ? -(m.cdNow ?? 99) : sort === "reach" ? m.reachNow ?? m.range : sort === "acc" ? m.accuracy : sort === "crit" ? m.crit : sort === "dps" ? (m.now.power || m.power) * (m.multi ? 1 + (m.multi.hits - 1) * m.multi.mult : 1) / Math.max(0.5, m.cdNow ?? 1) : 0;
    const dir = desc ? 1 : -1;
    return s.abilities
      .filter((m) => (type === "all" || m.type === type) && (show === "all" || (show === "aura" ? !!m.aura : show === "new" ? !!m.fx : show === "owned" ? m.rank > 0 : m.rank === 0)))
      .filter((m) => !roles.length || roles.includes(ROLE_OF(m)))
      // EFFECT chips: match the literal effect, and also catch heals/wards that carry the tactic
      // rather than the effect string, so "mend" shows every mending verse and "shell" every ward.
      .filter((m) => !effects.length || effects.some((e) => m.effect === e || (e === "mend" && moveTactic(m) === "heal") || (e === "shell" && moveTactic(m) === "ward")))
      .filter((m) => shapes.every((id) => SHAPES.find((x) => x.id === id)!.has(m)))
      .filter((m) => source === "any" || (source === "mine" ? (m.cls === myClass || CLASS_BY_ID[myClass as ClassId]?.starterMoves.includes(m.id)) : source === "signature" ? !!m.cls : !!m.fx))
      .filter((m) => !f || m.name.toLowerCase().includes(f) || m.effect.includes(f) || moveTactic(m).includes(f) || m.type.includes(f) || m.about.toLowerCase().includes(f))
      .sort((a, b) => sort === "name" ? (desc ? 1 : -1) * a.name.localeCompare(b.name) : sort === "type" ? (desc ? 1 : -1) * (a.type.localeCompare(b.type) || a.name.localeCompare(b.name)) : !desc && (!!a.aura !== !!b.aura) ? (a.aura ? 1 : -1) : dir * (num(b) - num(a)) || a.name.localeCompare(b.name));
  }, [s.abilities, filter, type, sort, show, roles, effects, shapes, source, desc, myClass]);
  const filtersOn = roles.length + effects.length + shapes.length + (source !== "any" ? 1 : 0) + (type !== "all" ? 1 : 0) + (show !== "all" ? 1 : 0) + (filter ? 1 : 0);
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
              <option value="dps">By damage per second</option>
              <option value="cd">By cooldown (shortest)</option>
              <option value="reach">By reach</option>
              <option value="acc">By accuracy</option>
              <option value="crit">By crit</option>
            </select>
            <button type="button" className="px-btn ui-btn-sm" data-testid="verse-sort-dir" onClick={() => setDesc(!desc)} title="Flip the order">{sort === "name" || sort === "type" ? (desc ? "A → Z" : "Z → A") : desc ? "▼ High first" : "▲ Low first"}</button>
            <button type="button" className="px-btn ui-btn-sm" data-testid="verse-filter-reset" disabled={!filtersOn} onClick={() => { setRoles([]); setEffects([]); setShapes([]); setSource("any"); setType("all"); setShow("all"); setFilter(""); }}>Reset {filtersOn || ""}</button>
          </div>
          <Chips value={source} onChange={setSource} label="Source" options={[{ id: "any", label: "Every verse" }, { id: "mine", label: "My class" }, { id: "signature", label: "★ Signature batch" }, { id: "starfall", label: "✦ Starfall" }]} />
          <ToggleRow label="ROLE" testid="verse-role" value={roles} onChange={setRoles} options={ROLES_V} />
          <ToggleRow label="EFFECT" testid="verse-effect" value={effects} onChange={setEffects} options={EFFECTS_V.map((e) => [e, e] as const)} />
          <ToggleRow label="SHAPE" testid="verse-shape" value={shapes} onChange={setShapes} options={SHAPES.map((x) => [x.id, x.label] as const)} />
          <p className="text-dim" data-testid="verse-count">{catalog.length} of {s.abilities.length} verses</p>
          <Chips value={show} onChange={setShow} options={[{ id: "all", label: "All" }, { id: "owned", label: "Unlocked" }, { id: "locked", label: "Locked" }, { id: "aura", label: "Auras" }]} />
          <Chips value={type} onChange={setType} label="Element" options={[{ id: "all" as const, label: "Any element" }, ...(Object.keys(TYPES) as TypeId[]).map((t) => ({ id: t, label: <span className={typeClass(t)}>{TYPES[t].name}</span> }))]} />
          <div className="ui-grid" style={{ "--min": "240px" } as React.CSSProperties}>
            {catalog.map((m) => (
              <div key={m.id} className={`ui-card verse-card2 ${m.rank ? "" : "verse-locked"}`}>
                <div className="ui-row">
                  <span className={typeClass(m.type)}>{m.name}{m.fx && <span className="text-kyo" title="Starfall batch: an animation of its own"> ✦</span>}</span>
                  {m.rank > 5 ? <span className="text-dim">Rank {m.rank}</span> : <Pips value={m.rank} max={5} />}
                </div>
                <p className="ui-card-about">{m.about}</p>
                <span className="verse-tags">
                  <span className="verse-tag">{ROLE_OF(m)}</span>
                  {SHAPES.filter((x) => x.has(m)).map((x) => <span key={x.id} className="verse-tag">{x.id === "multi" && m.multi ? `${m.multi.hits} hits` : x.label}</span>)}
                  {m.cls && <span className="verse-tag text-kyo">★ {CLASS_BY_ID[m.cls as ClassId]?.name}</span>}
                </span>
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

const TIER_ORDER: BoardView["tier"][] = ["easy", "normal", "hard", "elite"];
const KIND_GROUP = (k: string) => (/kill|boss/.test(k) ? "fight" : /ore|tree|shroom|fish|catch/.test(k) ? "gather" : "other");

export const QuestsPanel = memo(function QuestsPanel({ game }: GameProp) {
  const s = useSnapPick(["mapQuests", "questName", "questAbout", "setLabel", "setBonus", "unlocked", "kyo"] as const);
  const [board, setBoard] = useState<BoardView[]>([]);
  const [tab, setTab] = usePref("turbz-quests-tab", ["board", "map", "story"] as const, "board");
  const [tier, setTier] = usePref("turbz-quests-tier", ["all", ...TIER_ORDER] as const, "all");
  const [kind, setKind] = usePref("turbz-quests-kind", ["all", "fight", "gather", "other"] as const, "all");
  const [sort, setSort] = usePref("turbz-quests-sort", ["board", "reward", "tier", "short"] as const, "board");
  useEffect(() => {
    const pull = () => setBoard(game?.questBoardSnap() ?? []);
    pull();
    const id = window.setInterval(pull, 1000);
    return () => window.clearInterval(id);
  }, [game]);
  const secs = board[0]?.refreshIn ?? 0;
  const clock = `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;
  const active = board.find((q) => q.active);
  const rest = board
    .filter((q) => !q.active)
    .filter((q) => tier === "all" || q.tier === tier)
    .filter((q) => kind === "all" || KIND_GROUP(q.kind) === kind)
    .slice()
    .sort((a, b) => sort === "reward" ? b.rewardKyo - a.rewardKyo : sort === "tier" ? TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier) : sort === "short" ? a.need - b.need : 0);
  const ready = s.mapQuests.filter((q) => q.ready).length;
  const reroll = game?.questBoardRerollCost() ?? 0;
  return (
    <div className="ui-stack" data-testid="quests-panel">
      <StatusChips items={[
        active ? { label: `On contract · ${active.progress}/${active.need}`, tone: active.progress >= active.need ? "on" : "kyo" } : { label: "No contract taken" },
        { label: `Board refresh ${clock}` },
        s.mapQuests.length > 0 && { label: `${s.mapQuests.length} map quest${s.mapQuests.length === 1 ? "" : "s"}${ready ? ` · ${ready} ready` : ""}`, tone: ready ? "on" : undefined },
        { label: `${(s.kyo ?? 0).toLocaleString()} kyo` },
      ]} />
      <Tabs value={tab} onChange={setTab} label="Quest sections" tabs={[
        { id: "board", label: `Contracts · ${board.length}`, testid: "quests-tab-board" },
        { id: "map", label: ready ? `This map · ${ready}!` : `This map · ${s.mapQuests.length}`, testid: "quests-tab-map" },
        { id: "story", label: "Story", testid: "quests-tab-story" },
      ]} />
      {tab === "board" && (
        <>
          {active && (
            <div className={`ui-card quest-card tier-${active.tier} menu-pinned`} data-testid="quest-active">
              <div className="ui-row">
                <span className="text-kyo">▶ {active.name}</span>
                <span className={`quest-tier tier-${active.tier}`}>{TIER_LABEL[active.tier]}</span>
              </div>
              <p className="ui-card-about">{active.about}</p>
              <Meter value={active.progress} max={active.need} small label="DONE" detail={`${active.progress}/${active.need}`} />
              <div className="ui-row">
                <span className="text-dim">Pays {active.rewardKyo.toLocaleString()} kyo</span>
                <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.abandonQuest()}>Drop contract</button>
              </div>
            </div>
          )}
          <div className="menu-toolbar">
            <select className="px-input" aria-label="Sort contracts" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="board">Board order</option><option value="reward">Best pay</option><option value="tier">Hardest first</option><option value="short">Quickest first</option>
            </select>
            <ConfirmButton className="ui-btn-sm" label={`New board · ${reroll} kyo`} confirm="Tap again to reroll" disabled={(s.kyo ?? 0) < reroll} onConfirm={() => game?.rerollQuestBoard()} />
          </div>
          <Chips value={tier} onChange={setTier} label="Tier" options={[{ id: "all", label: "Any tier" }, ...TIER_ORDER.map((t) => ({ id: t, label: `${TIER_LABEL[t]} ${board.filter((q) => q.tier === t).length}` }))]} />
          <Chips value={kind} onChange={setKind} label="Kind" options={[{ id: "all", label: "Any kind" }, { id: "fight", label: "Fighting" }, { id: "gather", label: "Gathering" }, { id: "other", label: "Other" }]} />
          <div className="ui-grid" style={{ "--min": "220px" } as React.CSSProperties}>
            {rest.map((q) => (
              <div key={q.id} className={`ui-card quest-card tier-${q.tier}`}>
                <div className="ui-row">
                  <span className="text-kyo">{q.name}</span>
                  <span className={`quest-tier tier-${q.tier}`}>{TIER_LABEL[q.tier]}</span>
                </div>
                <p className="ui-card-about">{q.about}</p>
                <div className="ui-row">
                  <span className="text-dim">{q.rewardKyo.toLocaleString()} kyo · need {q.need}</span>
                  <button type="button" className="px-btn ui-btn-sm" disabled={!!active} title={active ? "Finish or drop your current contract first" : undefined} onClick={() => game?.acceptQuest(q.id)}>Accept</button>
                </div>
              </div>
            ))}
          </div>
          {!rest.length && <Empty>{board.length ? "No contracts match these filters." : "The board is empty right now."}</Empty>}
        </>
      )}
      {tab === "map" && (
        s.mapQuests.length ? (
          <div className="ui-list" data-testid="map-quest-log">
            {[...s.mapQuests].sort((a, b) => Number(b.ready) - Number(a.ready)).map((q) => (
              <div key={q.id} className={`ui-card ${q.ready ? "menu-pinned" : ""}`}>
                <p className="text-kyo">{q.name}{q.ready ? ` · ✓ report to ${q.turnIn}` : ""}</p>
                {q.lines.map((l, i) => <p key={i} className="text-dim">{l}</p>)}
              </div>
            ))}
          </div>
        ) : <Empty>No quests on this map. Talk to the people here (E) to find some.</Empty>
      )}
      {tab === "story" && (
        <>
          <div className="ui-card">
            <p className="text-kyo">{s.questName}</p>
            <p>{s.questAbout}</p>
          </div>
          <p className="text-dim">Set: {s.setLabel} · {s.setBonus} · {s.unlocked.length} sets unlocked</p>
        </>
      )}
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
  const [tab, setTab] = usePref<SpiritTab>("turbz-spirits-tab", ["party", "box", "bonus"], "party");
  const [gsort, setGsort] = usePref("turbz-spirits-sort", ["default", "level", "rarity", "name", "type"] as const, "default");
  const [gq, setGq] = useState("");
  const gterm = gq.trim().toLowerCase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ghostMatch = (g: any) => !gterm || g.name.toLowerCase().includes(gterm) || String(g.type ?? "").includes(gterm) || String(g.species ?? "").toLowerCase().includes(gterm) || (g.abilities ?? []).some((a: unknown) => String((a as { name?: string })?.name ?? a).toLowerCase().includes(gterm));
  const ghostSort = <G extends { name: string; level: number; rarity: number; type?: string }>(list: G[]) => gsort === "default" ? list : list.slice().sort((a, b) => gsort === "level" ? b.level - a.level : gsort === "rarity" ? b.rarity - a.rarity || b.level - a.level : gsort === "type" ? String(a.type).localeCompare(String(b.type)) || b.level - a.level : a.name.localeCompare(b.name));
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
  const shownBase = s.ghostStore.filter((g) => (filter === "all" || (filter === "tagged" ? g.tagged : g.shiny)) && ghostMatch(g)).slice().sort((a, b) => Number(b.tagged) - Number(a.tagged) || Number(b.shiny) - Number(a.shiny) || b.rarity - a.rarity || b.level - a.level);
  const shown = ghostSort(shownBase);
  const party = ghostSort(s.spirits.filter(ghostMatch));
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
      {tab !== "bonus" && (
        <div className="menu-toolbar">
          <input className="px-input" aria-label="Search ghosts" placeholder="Search name, element, ability" value={gq} onChange={(e) => setGq(e.target.value)} data-testid="spirit-search" />
          <select className="px-input" aria-label="Sort ghosts" value={gsort} onChange={(e) => setGsort(e.target.value as typeof gsort)}>
            <option value="default">Default order</option><option value="level">Highest level</option><option value="rarity">Rarest</option><option value="type">By element</option><option value="name">By name</option>
          </select>
        </div>
      )}

      {tab === "party" && (
        <div className="ui-stack" data-testid="spirit-party">
          <p className="text-dim">Up to {s.spiritSlots} ghosts go out with you and {s.spiritCap} ride in your party. Ghosts out with you fight, earn XP from every kill, and their abilities work.</p>
          {s.spirits.length > 0 && !party.length && <Empty>No party ghosts match.</Empty>}
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
            {party.map((sp) => (
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
  const [q, setQ] = useState("");
  const [show, setShow] = usePref("turbz-craft-show", ["all", "can", "missing"] as const, "all");
  const [sort, setSort] = usePref("turbz-craft-sort", ["default", "name", "most"] as const, "default");
  const term = q.trim().toLowerCase();
  const rows = ALCHEMY_RECIPES.map((r) => ({ r, n: timesCraftable(r.costs, count) }))
    .filter(({ r, n }) => (show === "all" || (show === "can" ? n > 0 : n === 0)) && (!term || r.name.toLowerCase().includes(term) || r.about.toLowerCase().includes(term) || (ITEM_BY_ID[r.output]?.name ?? r.output).toLowerCase().includes(term) || Object.keys(r.costs).some((id) => (ITEM_BY_ID[id]?.name ?? id).toLowerCase().includes(term))))
    .sort((a, b) => sort === "name" ? a.r.name.localeCompare(b.r.name) : sort === "most" ? b.n - a.n : 0);
  const canAny = ALCHEMY_RECIPES.filter((r) => timesCraftable(r.costs, count) > 0).length;
  const brewN = (id: string, n: number) => { for (let k = 0; k < n; k++) game?.brew(id); };
  return (
    <div className="ui-stack" data-testid="craft-panel">
      <StatusChips items={[{ label: `${canAny}/${ALCHEMY_RECIPES.length} recipes ready`, tone: canAny ? "on" : undefined }, { label: "Meals cook at a campfire (H → Cooking)" }]} />
      <div className="menu-toolbar">
        <input className="px-input" aria-label="Search recipes" placeholder="Search recipe, result or ingredient" value={q} onChange={(e) => setQ(e.target.value)} data-testid="craft-search" />
        <select className="px-input" aria-label="Sort recipes" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="default">Default order</option><option value="name">By name</option><option value="most">Most I can make</option>
        </select>
      </div>
      <Chips value={show} onChange={setShow} label="Show" options={[{ id: "all", label: "All" }, { id: "can", label: `Can make ${canAny}` }, { id: "missing", label: "Missing items" }]} />
      <div className="ui-grid" style={{ "--min": "230px" } as React.CSSProperties}>
        {rows.map(({ r, n }) => (
          <div key={r.id} className={`ui-card ${n > 0 ? "ui-card-hl" : ""}`} data-testid={`recipe-${r.id}`}>
            <div className="ui-row">
              <span className="text-kyo">{r.name}</span>
              <span className="text-dim">→ {ITEM_BY_ID[r.output]?.name ?? r.output}{r.n > 1 ? ` ×${r.n}` : ""}</span>
            </div>
            <p className="ui-card-about">{r.about}</p>
            <div className="cost-row">
              {Object.entries(r.costs).map(([id, need]) => (
                <span key={id} className={`cost-chip ${count(id) >= need ? "cost-ok" : "cost-miss"}`}>{ITEM_BY_ID[id]?.name ?? id} {count(id)}/{need}</span>
              ))}
            </div>
            <div className="qty-row">
              <button type="button" className="px-btn ui-btn-sm" disabled={n < 1} onClick={() => game?.brew(r.id)}>Brew</button>
              {n >= 5 && <button type="button" className="px-btn ui-btn-sm" onClick={() => brewN(r.id, 5)}>×5</button>}
              {n >= 2 && <button type="button" className="px-btn px-btn-kyo ui-btn-sm" onClick={() => brewN(r.id, n)}>All ×{n}</button>}
              <span className="text-dim">{n > 0 ? `can make ${n}` : "missing items"}</span>
            </div>
          </div>
        ))}
      </div>
      {!rows.length && <Empty>No recipes match.</Empty>}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Survival & camp (Hardcore)
// ---------------------------------------------------------------------------

type CampTab = "needs" | "camp" | "build" | "cook";
const CAMP_TAB_KEY = "turbz-camp-tab";
/** A per-viewer UI preference: remembered, but the panel works without it (private mode, cleared storage). */
function readPref<T extends string>(key: string, ok: readonly T[], fallback: T): T {
  try { const v = localStorage.getItem(key) as T | null; return v && ok.includes(v) ? v : fallback; } catch { return fallback; }
}
function writePref(key: string, v: string) {
  try { localStorage.setItem(key, v); } catch { /* private mode */ }
}
/** How many times a recipe can be made from the bag right now. */
function timesCraftable(costs: Record<string, number>, count: (id: string) => number) {
  return Math.min(...Object.entries(costs).map(([id, n]) => Math.floor(count(id) / Math.max(1, n))));
}
const MATERIALS: [string, string][] = [["timber", "Logs"], ["meat", "Meat"], ["fish", "Fish"], ["mushroom", "Shrooms"], ["raw_water", "Raw water"], ["drinking_water", "Drinking water"], ["leather", "Leather"], ["ore", "Ore"]];

/**
 * Survival & Camp (H). Four tabs:
 *   Needs   — hunger / thirst / sleep, eat, drink, sleep, and gathering.
 *   Camp    — your campfire (build, pack up / pick up), followers, the Storage Chest, and what the camp holds.
 *   Build   — every camp piece, grouped, with its cost and hotkey; picking one starts build mode (F).
 *   Cooking — campfire recipes: search, filter to what you can make, sort, Make or Make all.
 */
export const SurvivalPanel = memo(function SurvivalPanel({ game }: GameProp) {
  const s = useSnapPick(["survival", "bag", "clock", "nearTree", "nearWater", "nearCamp", "nearBed", "sleeping", "build", "kyo", "turbz", "turbzChest", "camp"] as const);
  const [tab, setTabRaw] = useState<CampTab>(() => readPref<CampTab>(CAMP_TAB_KEY, ["needs", "camp", "build", "cook"], "needs"));
  const setTab = (t: CampTab) => { setTabRaw(t); writePref(CAMP_TAB_KEY, t); };
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"all" | "ready" | "missing">("all");
  const [sort, setSort] = useState<"ready" | "name" | "xp">("ready");
  const bag = Object.fromEntries(s.bag.map((it) => [it.id, it.count]));
  // Blocks are bought with kyo, which lives outside the bag — count() resolves it so cost chips read right.
  const count = (id: string) => (id === "kyo" ? (s.kyo ?? 0) : (bag[id] ?? 0));
  const recipes = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = CAMP_RECIPE_LIST.map((r) => ({ r, n: timesCraftable(r.costs, count) }))
      .filter(({ r, n }) => (!term || `${r.name} ${r.about} ${Object.keys(r.outputs).map((id) => ITEM_BY_ID[id]?.name ?? id).join(" ")}`.toLowerCase().includes(term))
        && (show === "all" || (show === "ready" ? n > 0 : n === 0)));
    type Row = (typeof list)[number];
    const by: Record<typeof sort, (a: Row, b: Row) => number> = {
      ready: (a, b) => (b.n > 0 ? 1 : 0) - (a.n > 0 ? 1 : 0) || a.r.name.localeCompare(b.r.name),
      name: (a, b) => a.r.name.localeCompare(b.r.name),
      xp: (a, b) => (b.r.skill?.xp ?? 0) - (a.r.skill?.xp ?? 0) || a.r.name.localeCompare(b.r.name),
    };
    return list.sort(by[sort]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, show, sort, s.bag]);
  if (!s.survival) return <Empty>Survival is a Hardcore system.</Empty>;
  const food = bestFood(bag, s.turbz ? 0 : s.survival.hunger);
  const night = s.clock.phase === "night" && s.clock.active;
  const c = s.build.counts;
  const low = (v: number) => v < 15;
  const warn = s.turbz ? [] : [low(s.survival.hunger) && "hungry", low(s.survival.thirst) && "thirsty", low(s.survival.rest) && "exhausted"].filter(Boolean) as string[];
  const campLine = s.camp.near ? "Campfire in reach" : s.camp.lit ? (s.turbz ? "Your camp is elsewhere" : "No campfire in reach") : s.turbz && s.camp.packed ? `Camp packed · ${s.camp.pieces} pieces` : "No campfire yet";
  const ready = CAMP_RECIPE_LIST.filter((r) => timesCraftable(r.costs, count) > 0).length;



  return (
    <div className="ui-stack camp-panel" data-testid="camp-panel">
      <div className="camp-status">
        {s.clock.active && <span className={`chip ${night ? "chip-bad" : ""}`} data-testid="clock-line">{night ? "☾" : "☀"} {s.clock.label} · {s.clock.left} to {night ? "dawn" : "dusk"}</span>}
        <span className={`chip ${s.camp.near ? "chip-on" : ""}`}>{campLine}</span>
        {s.build.inZone && <span className="chip chip-on">Safe zone</span>}
        {warn.length > 0 && <span className="chip chip-bad">You are {warn.join(", ")}</span>}
        <span className="chip">Logs {count("timber")} · {(s.kyo ?? 0).toLocaleString()} kyo</span>
      </div>
      <Tabs value={tab} onChange={setTab} label="Camp sections" tabs={[
        { id: "needs", label: warn.length ? `Needs · ${warn.length}!` : "Needs", testid: "camp-tab-needs" },
        { id: "camp", label: "Camp", testid: "camp-tab-camp" },
        { id: "build", label: "Build", testid: "camp-tab-build" },
        { id: "cook", label: `Cooking · ${ready}`, testid: "camp-tab-cook" },
      ]} />

      {tab === "needs" && (
        <>
          {s.turbz && <p className="text-kyo">TURBZ has no hunger or thirst. Meals and water still grant experience, and sleeping at a campfire or bed after dusk skips the night and wakes you well rested (bonus XP).</p>}
          {!s.turbz && <div className="surv-meters">
            <Meter kind={low(s.survival.hunger) ? "bad" : "good"} label="HUNGER" value={s.survival.hunger} max={100} detail={Math.ceil(s.survival.hunger)} />
            <Meter kind={low(s.survival.thirst) ? "bad" : "good"} label="THIRST" value={s.survival.thirst} max={100} detail={Math.ceil(s.survival.thirst)} />
            <Meter kind={low(s.survival.rest) ? "bad" : "good"} label="SLEEP" value={s.survival.rest} max={100} detail={Math.ceil(s.survival.rest)} />
          </div>}
          <div className="gear-actions">
            <button type="button" className="px-btn" disabled={!food} onClick={() => game?.eatFood()}>{food ? `Eat ${s.bag.find((it) => it.id === food)?.name}` : s.turbz ? "No food" : "Not hungry / no food"}</button>
            <button type="button" className="px-btn" disabled={!count("drinking_water") || (!s.turbz && s.survival.thirst >= 100)} onClick={() => game?.useBag("drinking_water")}>Drink · {count("drinking_water")}</button>
            <button type="button" className="px-btn" disabled={!s.sleeping && !s.nearCamp && !s.nearBed} title="Sleep by a campfire, or in a bed you built (rest comes half again as fast)" onClick={() => game?.survivalAction("sleep")}>{s.sleeping ? "Wake up" : s.nearBed ? (night ? "Sleep in bed to dawn" : "Sleep in bed") : night ? "Sleep to dawn" : "Sleep"}</button>
          </div>
          {s.clock.active && <p className="text-dim">{night ? "Foes have twice the health and damage and give three times the experience. Sleep at a campfire to skip to dawn." : "Day lasts 10 minutes, night 15."}</p>}
          {!s.turbz && <p className="text-dim">Wounds do not heal by themselves in Hardcore. Healing spells, potions (¾ strength) and meals do.</p>}
          <Section title="GATHER">
            <div className="gear-actions">
              <button type="button" className="px-btn" disabled={!s.nearTree} onClick={() => game?.survivalAction("chop")}>Chop tree</button>
              <button type="button" className="px-btn" disabled={!s.nearWater} onClick={() => game?.survivalAction("water")}>Collect water</button>
              <button type="button" className="px-btn" disabled={!s.nearWater} onClick={() => game?.startFishing()}>Fish</button>
            </div>
            <div className="camp-mats">
              {MATERIALS.map(([id, label]) => (
                <span key={id} className={`camp-mat ${count(id) ? "" : "text-dim"}`}><span>{label}</span><b>{count(id)}</b></span>
              ))}
            </div>
          </Section>
        </>
      )}

      {tab === "camp" && (
        <>
          <Section title="CAMPFIRE" right={<span className={s.camp.near ? "text-kyo" : "text-dim"}>{campLine}</span>}>
            <div className="gear-actions">
              <button type="button" className="px-btn" data-testid="build-fire-btn" disabled={s.nearCamp || count("timber") < 3 || (s.turbz && s.camp.lit)} title={s.turbz && s.camp.lit ? "You already have a camp. Pack it up first to move it." : undefined} onClick={() => game?.survivalAction("fire")}>
                {s.turbz && s.camp.packed ? `Light campfire & unpack camp (${s.camp.pieces} pieces) · 3 logs` : "Build campfire · 3 logs"}
              </button>
              <button type="button" className="px-btn px-btn-blood" data-testid="pack-camp-btn" disabled={!s.camp.near} title={s.camp.near ? undefined : "Stand by your campfire"} onClick={() => game?.survivalAction("packcamp")}>
                {s.turbz ? "Pack up camp" : "Pick up campfire"}
              </button>
              <button type="button" className="px-btn px-btn-kyo" data-testid="build-toggle-btn" onClick={() => game?.toggleBuild()}>{s.build.on ? "Stop building (F)" : "Build mode (F)"}</button>
            </div>
            {s.turbz && <p className="text-dim">You keep one camp, out on the wild. Pack up camp (or dying) folds the fire and every piece into one bundle; lighting a campfire anywhere drops it back exactly as it was.</p>}
          </Section>
          <Section title="YOUR CAMP" right={<span className="text-dim">here on this map</span>}>
            <div className="camp-counts" data-testid="camp-counts">
              <span className="camp-count"><b>{c.walls}</b><span>Walls</span></span>
              <span className="camp-count"><b>{c.floors}</b><span>Floors</span></span>
              <span className="camp-count"><b>{c.doors}</b><span>Doors</span></span>
              <span className="camp-count"><b>{c.beds}<span className="text-dim">/{MAX_BEDS}</span></b><span>Beds</span></span>
              <span className={`camp-count ${c.ghostBox ? "" : "camp-count-off"}`}><b>{c.ghostBox ? "✓" : "–"}</b><span>Ghost Box</span></span>
              {s.turbz && <span className={`camp-count ${c.chest ? "" : "camp-count-off"}`}><b>{c.chest ? "✓" : "–"}</b><span>Storage Chest</span></span>}
            </div>
            {s.turbz && s.camp.packed && <p className="text-kyo">Packed and waiting: {s.camp.pieces} pieces. Light a campfire on the wild to drop them back.</p>}
          </Section>
          <Section title="FOLLOWERS" right={<span className="text-dim">{s.build.holding ? "In bed at camp" : "With you"}</span>}>
            <div className="gear-actions">
              <button type="button" className="px-btn" data-testid="hold-followers-btn" disabled={!s.build.holding && !s.build.beds} onClick={() => game?.holdFollowers(!s.build.holding)}>{s.build.holding ? "Call followers back" : "Send followers to bed"}</button>
            </div>
            <p className="text-dim">Followers you send home rest in the camp's beds, where nothing can reach them.{!s.build.beds ? " Build a bed first." : ""}</p>
          </Section>
          {s.turbz && (
            <Section title="STORAGE CHEST" right={<span className="text-dim">{s.turbzChest.count} stored</span>}>
              <div className="gear-actions">
                <button type="button" className="px-btn px-btn-kyo" data-testid="open-turbzchest" disabled={!s.turbzChest.near} onClick={() => game?.openTurbzChest()}>
                  {!s.turbzChest.placed ? "No chest built" : s.turbzChest.near ? "Open Storage Chest" : "Walk to the chest to open it"}
                </button>
              </div>
              <p className="text-dim">Items in the chest survive death. Build one from the Build tab (10,000 kyo).</p>
            </Section>
          )}
        </>
      )}

      {tab === "build" && (
        <div className="ui-stack" data-testid="build-pieces">
          <p className="text-dim">Pick a piece to start building (the world pauses). In build mode, 1–8 switch pieces and X is the Remove tool. Walls, floors and doors cost {BLOCK_KYO} kyo each; beds, the Ghost Box and the chest go inside a camp's safe zone.</p>
          {BUILD_GROUPS.map((g) => {
            const pieces = g.pieces.filter((id) => s.turbz || !TURBZ_ONLY_PIECES.has(id));
            if (!pieces.length) return null;
            const hot = BUILD_HOTKEY_ORDER.filter((id) => s.turbz || !TURBZ_ONLY_PIECES.has(id));
            return (
              <Section key={g.id} title={g.label.toUpperCase()}>
                <div className="ui-grid" style={{ "--min": "200px" } as React.CSSProperties}>
                  {pieces.map((id) => {
                    const def = BUILD_PIECES[id];
                    const have = Object.entries(def.cost).every(([k, n]) => count(k) >= n);
                    const on = s.build.on && s.build.piece === id;
                    const placedAlready = (id === "ghostbox" && s.build.ghostBox) || (id === "turbzchest" && s.turbzChest.placed);
                    const placed = id === "wood" || id === "stone" ? null : id === "woodfloor" || id === "stonefloor" ? null : id === "door" ? c.doors : id === "bed" ? c.beds : null;
                    return (
                      <button key={id} type="button" className={`ui-card ${on ? "ui-card-hl" : ""}`} title={def.about} disabled={!!placedAlready} onClick={() => game?.setBuildPiece(id)} data-testid={`camp-piece-${id}`}>
                        <span className="ui-row"><span className="text-kyo">{def.name}{placedAlready ? " · placed" : ""}</span><kbd className="key-badge">{hot.indexOf(id) + 1}</kbd></span>
                        <span className="cost-row">
                          {Object.entries(def.cost).map(([k, n]) => (
                            <span key={k} className={`cost-chip ${count(k) >= n ? "cost-ok" : "cost-miss"}`}>{k === "kyo" ? "Kyo" : ITEM_BY_ID[k]?.name ?? k} {count(k).toLocaleString()}/{n.toLocaleString()}</span>
                          ))}
                        </span>
                        <span className="text-dim">{have ? def.about : "Missing materials"}{placed !== null ? ` · ${placed} here` : ""}</span>
                      </button>
                    );
                  })}
                </div>
              </Section>
            );
          })}
          <div className="gear-actions">
            <button type="button" className="px-btn" data-testid="camp-piece-erase" onClick={() => game?.setBuildPiece("erase")}>Remove tool (X)</button>
            <span className="text-dim">Walls {c.walls} · Floors {c.floors} · Doors {c.doors} · Beds {c.beds}/{MAX_BEDS}</span>
          </div>
        </div>
      )}

      {tab === "cook" && (
        <>
          <div className="bag-toolbar">
            <input className="px-input" aria-label="Search recipes" placeholder="Search recipes or what they make" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="px-input" aria-label="Sort recipes" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="ready">Ready to make first</option>
              <option value="name">Name</option>
              <option value="xp">Most Cooking XP</option>
            </select>
          </div>
          <Chips value={show} onChange={setShow} label="Show recipes" options={[
            { id: "all", label: `All · ${CAMP_RECIPE_LIST.length}` },
            { id: "ready", label: `Can make · ${ready}` },
            { id: "missing", label: `Missing items · ${CAMP_RECIPE_LIST.length - ready}` },
          ]} />
          {!s.nearCamp && <p className="text-bad">Stand by a campfire to cook.</p>}
          {!recipes.length && <Empty>No recipes match.</Empty>}
          <div className="ui-grid" style={{ "--min": "220px" } as React.CSSProperties}>
            {recipes.map(({ r, n }) => {
              const outs = Object.entries(r.outputs).map(([id, k]) => `${ITEM_BY_ID[id]?.name ?? id} ×${k}`).join(", ");
              const most = Math.min(n, 20);
              return (
                <div key={r.id} className={`ui-card ${n > 0 && s.nearCamp ? "ui-card-hl" : ""}`} title={r.about}>
                  <span className="ui-row"><span className="text-kyo">{r.name}</span>{n > 0 && <span className="text-good">×{n}</span>}</span>
                  <span className="text-dim">→ {outs}{r.skill ? ` · +${r.skill.xp} Cooking XP` : ""}</span>
                  <div className="cost-row">
                    {Object.entries(r.costs).map(([id, k]) => (
                      <span key={id} className={`cost-chip ${count(id) >= k ? "cost-ok" : "cost-miss"}`}>{ITEM_BY_ID[id]?.name ?? id} {count(id)}/{k}</span>
                    ))}
                  </div>
                  <div className="gear-actions">
                    <button type="button" className="px-btn ui-btn-sm" disabled={!s.nearCamp || n < 1} onClick={() => game?.survivalAction(r.id)}>Make</button>
                    {most > 1 && <button type="button" className="px-btn ui-btn-sm" disabled={!s.nearCamp} onClick={() => { for (let i = 0; i < most; i++) game?.survivalAction(r.id); }}>Make ×{most}</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
});

/** TURBZ storage chest: stash any bag items here and they survive death. Deposit from the bag, withdraw back. */
export const TurbzChestPanel = memo(function TurbzChestPanel({ game }: GameProp) {
  const s = useSnapPick(["turbzChest", "bag"] as const);
  const [q, setQ] = useState("");
  const [sort, setSort] = usePref("turbz-chest-sort", ["name", "count"] as const, "name");
  if (!s.turbzChest.placed) return <Empty>Build a Storage Chest at your camp first (F → Furniture).</Empty>;
  if (!s.turbzChest.near) return <Empty>Walk to your Storage Chest to open it.</Empty>;
  const term = q.trim().toLowerCase();
  const order = <T extends { name: string; count: number }>(list: T[]) => list.filter((it) => !term || it.name.toLowerCase().includes(term)).sort((a, b) => sort === "count" ? b.count - a.count || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
  const stored = order([...s.turbzChest.items]);
  const bag = order(s.bag.filter((it) => it.count > 0).map((it) => ({ ...it })));
  const mats = bag.filter((it) => !it.quickable);
  const storeAll = (list: { id: string; count: number }[]) => { for (const it of list) game?.turbzChestDeposit(it.id, it.count); };
  const takeAll = () => { for (const it of stored) game?.turbzChestWithdraw(it.id, it.count); };
  const bagTotal = s.bag.reduce((a, it) => a + it.count, 0);
  return (
    <div className="ui-stack" data-testid="turbzchest-panel">
      <StatusChips items={[{ label: `${s.turbzChest.count} stored · ${s.turbzChest.items.length} kinds`, tone: "kyo" }, { label: `Bag ${bagTotal}` }, { label: "Survives death", tone: "on" }]} />
      <p className="text-dim">Anything you stash here stays safe when you die — rebuild your camp and it is still inside. Kyo and worn gear are not stored here.</p>
      <div className="menu-toolbar">
        <input className="px-input" aria-label="Search items" placeholder="Search items" value={q} onChange={(e) => setQ(e.target.value)} data-testid="turbzchest-search" />
        <select className="px-input" aria-label="Sort items" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="name">By name</option><option value="count">Most first</option>
        </select>
      </div>
      <Section title={`STORED · ${s.turbzChest.count}`} right={stored.length > 0 && <ConfirmButton className="ui-btn-sm" label="Take everything" confirm="Tap again" onConfirm={takeAll} />}>
        {s.turbzChest.items.length === 0
          ? <p className="text-dim">Empty. Deposit items from your bag below.</p>
          : !stored.length ? <Empty>Nothing stored matches.</Empty>
          : <div className="ui-grid" style={{ "--min": "190px" } as React.CSSProperties} data-testid="turbzchest-stored">
              {stored.map((it) => (
                <div key={it.id} className="ui-card">
                  <span className="ui-row"><span className="text-kyo">{it.name}</span><span className="text-dim">×{it.count}</span></span>
                  <span className="cost-row">
                    <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.turbzChestWithdraw(it.id, 1)}>Take 1</button>
                    {it.count >= 10 && <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.turbzChestWithdraw(it.id, 10)}>Take 10</button>}
                    <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.turbzChestWithdraw(it.id, it.count)}>Take all</button>
                  </span>
                </div>
              ))}
            </div>}
      </Section>
      <Section title="YOUR BAG" right={bag.length > 0 && (
        <span className="ui-row-gap">
          {mats.length > 0 && <button type="button" className="px-btn ui-btn-sm" data-testid="turbzchest-store-mats" onClick={() => storeAll(mats)}>Store materials</button>}
          <ConfirmButton className="ui-btn-sm" label="Store everything" confirm="Tap again" onConfirm={() => storeAll(bag)} />
        </span>
      )}>
        {s.bag.filter((it) => it.count > 0).length === 0
          ? <p className="text-dim">Your bag is empty.</p>
          : !bag.length ? <Empty>Nothing in your bag matches.</Empty>
          : <div className="ui-grid" style={{ "--min": "190px" } as React.CSSProperties} data-testid="turbzchest-bag">
              {bag.map((it) => (
                <div key={it.id} className="ui-card">
                  <span className="ui-row"><span className="text-kyo">{it.name}</span><span className="text-dim">×{it.count}</span></span>
                  <span className="cost-row">
                    <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.turbzChestDeposit(it.id, 1)}>Store 1</button>
                    {it.count >= 10 && <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.turbzChestDeposit(it.id, 10)}>Store 10</button>}
                    <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.turbzChestDeposit(it.id, it.count)}>Store all</button>
                  </span>
                </div>
              ))}
            </div>}
      </Section>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Pause
// ---------------------------------------------------------------------------

const CONTROLS: [string, string][] = [
  ["WASD", "Move"], ["E", "Gather · talk"], ["1-9", "Cast verse"], ["0", "Attack"], ["I", "Gear"], ["B", "Bag"], ["V", "Verses"], ["K", "Skills"], ["G", "Spirits"],
  ["C", "Sheet"], ["X", "Crafting"], ["Q", "Quests"], ["M", "Map"], ["T", "Market"], ["H", "Camp (Hardcore / TURBZ)"], ["F", "Build (Hardcore / TURBZ)"], ["R", "Class gimmick"], ["Space", "Quick item"], ["Esc", "Close · pause"],
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
  const { map, unstuck, level, className, clock } = useSnapPick(["map", "unstuck", "level", "className", "clock"] as const);
  const maps = game?.customMaps() ?? [];
  const [audio, setAudio] = useState(() => ({ ...(game?.audioPrefs ?? { master: 1, music: 0.35, musicMuted: false }) }));
  const [tab, setTab] = usePref("turbz-pause-tab", ["game", "audio", "controls", "worlds"] as const, "game");
  const [keyQ, setKeyQ] = useState("");
  const keys = CONTROLS.filter(([k, v]) => !keyQ.trim() || `${k} ${v}`.toLowerCase().includes(keyQ.trim().toLowerCase()));
  const menus: [string, string, string][] = [["gear", "Gear", "I"], ["sheet", "Character", "C"], ["moves", "Verses", "V"], ["skills", "Skills", "K"], ["ghost", "Spirits", "G"], ["bag", "Bag", "B"], ["quests", "Quests", "Q"], ["map", "Map", "M"], ["craft", "Crafting", "X"]];
  return (
    <div className="ui-stack" data-testid="pause-panel">
      <StatusChips items={[
        { label: "Paused", tone: "kyo" },
        { label: `${className} · Lv ${level}` },
        clock?.active && { label: `${clock.phase === "night" ? "☾" : "☀"} ${clock.label} · ${clock.left}` },
        map.startsWith("custom-") && { label: "On a designer map" },
      ]} />
      <div className="ui-row-gap">
        <button type="button" className="px-btn px-btn-kyo" onClick={() => game?.closePanel()}>Resume</button>
        <button type="button" className="px-btn" data-testid="unstuck-menu-btn" onClick={() => game?.beginUnstuck()}>{unstuck ? `Unstuck ${unstuck}` : "Unstuck · 3s"}</button>
      </div>
      <SaveStatus game={game} />
      <Tabs value={tab} onChange={setTab} label="Pause sections" tabs={[
        { id: "game", label: "Menus", testid: "pause-tab-game" },
        { id: "audio", label: audio.musicMuted ? "Audio · muted" : "Audio", testid: "pause-tab-audio" },
        { id: "controls", label: "Controls", testid: "pause-tab-controls" },
        { id: "worlds", label: `Worlds · ${maps.length}`, testid: "pause-tab-worlds" },
      ]} />
      {tab === "game" && (
        <div className="ui-grid" style={{ "--min": "150px" } as React.CSSProperties}>
          {menus.map(([id, label, key]) => (
            <button key={id} type="button" className="px-btn text-left" onClick={() => game?.toggle(id as Parameters<TurbzGame["toggle"]>[0])}><kbd className="key-badge">{key}</kbd> {label}</button>
          ))}
        </div>
      )}
      {tab === "audio" && (
        <div className="ui-stack">
          <label className="ui-slider">
            <span>Volume · {Math.round(audio.master * 100)}%</span>
            <input type="range" min={0} max={100} value={Math.round(audio.master * 100)} data-testid="master-volume" onChange={(e) => { const v = Number(e.target.value) / 100; game?.setMasterVolume(v); setAudio({ ...game!.audioPrefs }); }} />
          </label>
          <label className="ui-slider">
            <span>Music · {Math.round(audio.music * 100)}%{audio.musicMuted ? " (muted)" : ""}</span>
            <input type="range" min={0} max={100} value={Math.round(audio.music * 100)} data-testid="music-volume" onChange={(e) => { const v = Number(e.target.value) / 100; game?.setMusicVolume(v); setAudio({ ...game!.audioPrefs }); }} />
          </label>
          <div className="ui-row-gap">
            <button type="button" className={`px-btn ui-btn-sm ${audio.musicMuted ? "px-btn-kyo" : ""}`} data-testid="music-mute-btn" aria-pressed={audio.musicMuted} onClick={() => { game?.setMusicMuted(!audio.musicMuted); setAudio({ ...game!.audioPrefs }); }}>{audio.musicMuted ? "Unmute music" : "Mute music"}</button>
          </div>
          <p className="text-dim">A new song starts every 10 minutes.</p>
        </div>
      )}
      {tab === "controls" && (
        <>
          <div className="menu-toolbar"><input className="px-input" aria-label="Search controls" placeholder="Search keys or actions" value={keyQ} onChange={(e) => setKeyQ(e.target.value)} /></div>
          <div className="controls-grid">
            {keys.map(([k, v]) => (
              <span key={k} className="controls-row"><kbd className="key-badge">{k}</kbd> {v}</span>
            ))}
          </div>
          {!keys.length && <Empty>No controls match.</Empty>}
          <p className="text-dim">Right-click for more actions. Drag windows by their title bar, resize from the corner, pin to keep them open.</p>
        </>
      )}
      {tab === "worlds" && (
        <div className="ui-list" data-testid="designer-maps">
          {map.startsWith("custom-") && <button type="button" className="px-btn px-btn-kyo" data-testid="leave-custom-map-btn" onClick={() => game?.leaveCustom()}>Return to the overworld</button>}
          {maps.map((m) => (
            <button key={m.id} type="button" className={`px-btn text-left ${map === `custom-${m.id}` ? "map-btn-active" : ""}`} data-testid={`enter-map-${m.id}`} disabled={map === `custom-${m.id}`} onClick={() => game?.enterCustom(m.id)}>
              {map === `custom-${m.id}` ? `▶ ${m.name}` : `Enter ${m.name}`} <span className="text-dim">· {m.builtin ? "world" : m.kind}</span>
            </button>
          ))}
          {!maps.length && <Empty>Build and save maps in Designer Mode, then enter them here.</Empty>}
        </div>
      )}
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
  // Sets are account-wide now: every finished set is offered to every class.
  const owned = unlocked;
  const [setId, setSetId] = useState<string | null>(() => owned[0]?.id ?? null);
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
          badge={() => (owned.length ? `${owned.length} set${owned.length > 1 ? "s" : ""}` : null)}
          setPick={(p) => setPick(p)}
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
          {owned.length === 0 && <Empty>No finished set yet. Collect all five pieces (helm, raiment, skirt, boots, relic) of one set in any mode — once found, any class can wear it.</Empty>}
        </Section>
        )}
        <button type="button" className="px-btn px-btn-kyo" data-testid="rebirth-go-btn" onClick={() => game?.rebirth(name, race, setId, pick.classId, pick.traitId, classGendered(pick.classId) ? pick.female : true)}>
          Wake as this witch
        </button>
      </div>
    </div>
  );
}

