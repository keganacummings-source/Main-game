import { useEffect, useRef, useState } from "react";
import { MOVE_BY_ID, SKILLS, TYPES, moveTactic, type TypeId } from "@/game/content";
import { CLASSES, CLASS_BY_ID, CLASS_RACE, CUSTOM_BUILD_MAX, GIMMICKS, PERKS, ROLES, TRAITS, buffLines, classPerks, CRY_TYPES, getCryingConfig, getCustomBuild, LEAN_BUDGET, LEAN_MAX, LEAN_MIN, LEAN_STATS, LEAN_STEP, leanSpent, setCryingConfig, setCustomBuild, STAT_LABEL, type ClassId, type Role } from "@/game/classes";
import { actorSpritesReady } from "@/game/actor-sprites";
import type { Sheet, TurbzGame } from "@/game/engine";
import { Empty, Meter, Tabs } from "./ui-kit";

const MOVEMENT = new Set(["blink", "lunge", "roll", "dash", "surge"]);
const typeClass = (t: TypeId) => `type-${t}`;

export function ClassCanvas({ classId, game, active, female }: { classId: ClassId; game: TurbzGame | null; active: boolean; female: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !game) return;
    canvas.width = 120;
    canvas.height = 110;
    let frame = 0;
    const draw = () => {
      game.preview(canvas, CLASS_RACE[classId], classId, female);
      if (active || !actorSpritesReady()) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [classId, game, active, female]);
  return <canvas ref={ref} width={120} height={110} className="h-20 w-full bg-ink" />;
}

function Lines({ buffs, debuffs }: { buffs: string[]; debuffs: string[] }) {
  return (
    <div className="grid gap-1 sm:grid-cols-2">
      <div>
        <p className="font-display text-[9px] text-kyo">BUFFS</p>
        {buffs.map((b) => <p key={b} className="stat-up">▲ {b}</p>)}
        {!buffs.length && <p className="text-dim">None</p>}
      </div>
      <div>
        <p className="font-display text-[9px] text-blood">DEBUFFS</p>
        {debuffs.map((b) => <p key={b} className="stat-down">▼ {b}</p>)}
        {!debuffs.length && <p className="text-dim">None</p>}
      </div>
    </div>
  );
}

export type Pick = { classId: ClassId; traitId: string | null; female: boolean };

export function ClassPicker({ pick, setPick, game, badge }: { pick: Pick; setPick: (p: Pick) => void; game: TurbzGame | null; badge?: (classId: string) => string | null }) {
  const [role, setRole] = useState<Role | "All">("All");
  const [style, setStyle] = useState<string>("all");
  const [tags, setTags] = useState<string[]>([]);
  const [, bump] = useState(0);
  const c = CLASS_BY_ID[pick.classId];
  const perks = classPerks(c.id);
  const sum: Record<string, number> = { ...c.stats };
  for (const p of perks) for (const [k, v] of Object.entries(p.stats)) sum[k] = (sum[k] ?? 0) + (v ?? 0);
  const lines = buffLines(sum, [...((c as { immune?: readonly string[] }).immune ?? []), ...perks.flatMap((p) => p.immune ?? [])] as never);
  const tagOf = (id: string) => GIMMICKS[(CLASS_BY_ID[id as ClassId] as { gimmick: string }).gimmick]?.tags ?? [];
  const allTags = [...new Set(CLASSES.flatMap((x) => tagOf(x.id)))].sort();
  const list = CLASSES.filter((x) => (role === "All" || x.role === role) && (style === "all" || x.fightStyle === style) && tags.every((t) => tagOf(x.id).includes(t)));
  return (
    <div className="grid gap-3" data-testid="class-picker">
      <div className="flex flex-wrap gap-1">
        {(["All", ...ROLES] as const).map((r) => (
          <button key={r} type="button" data-testid={`role-filter-${r.toLowerCase()}`} className={`px-btn ui-btn-sm ${role === r ? "px-btn-kyo" : ""}`} onClick={() => setRole(r)}>
            {r}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1" data-testid="style-filter">
        {["all", "melee", "ranged", "mixed"].map((st) => (
          <button key={st} type="button" data-testid={`style-filter-${st}`} className={`px-btn ui-btn-sm ${style === st ? "px-btn-kyo" : ""}`} onClick={() => setStyle(st)}>{st === "all" ? "Any style" : st}</button>
        ))}
      </div>
      <div className="verse-filter-row" data-testid="gimmick-filter">
        <span className="verse-filter-label">GIMMICK</span>
        {allTags.map((t) => (
          <button key={t} type="button" data-testid={`gimmick-filter-${t}`} className={`verse-chip ${tags.includes(t) ? "verse-chip-on" : ""}`} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}>{t}</button>
        ))}
        {tags.length > 0 && <button type="button" className="px-btn ui-btn-sm" onClick={() => setTags([])}>Clear</button>}
      </div>
      {!list.length && <Empty>No class has all of those. Clear a filter.</Empty>}
      <div className="class-grid">
        {list.map((x) => (
          <button
            key={x.id}
            type="button"
            data-testid={`class-card-${x.id}`}
            className={`class-card ${pick.classId === x.id ? "class-card-on" : ""}`}
            onClick={() => setPick({ ...pick, classId: x.id })}
          >
            <ClassCanvas classId={x.id} game={game} active={pick.classId === x.id} female={pick.female} />
            <span className="mt-1 block text-lg leading-tight">{x.name}</span>
            <span className="block text-base text-kyo">{x.focus} · {x.role}</span>
            <span className={`block text-sm ${typeClass(x.type)}`}>{TYPES[x.type].name} element</span>
            {badge?.(x.id) && <span className="class-card-badge">{badge(x.id)}</span>}
          </button>
        ))}
      </div>
      <div className="sheet-box grid gap-2" data-testid="class-details">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-display text-xs text-kyo" data-testid="class-details-name">{c.name}</p>
          <p>{c.role}</p>
        </div>
        <p data-testid="class-focus"><span className="text-kyo">Focus: {c.focus}.</span> <span className="text-dim">Side element:</span> <span className={typeClass(c.type)}>{TYPES[c.type].name}</span> <span className="text-dim">(+5% Affinity with its verses)</span></p>
        <p>{c.blurb} <span className="text-dim">{c.specialty}.</span></p>
        <p className="text-kyo" data-testid="class-gimmick">Gimmick: <span className="text-bone">{c.passive}</span></p>
        {c.id !== "cryinggirl" && (
          <div data-testid="class-perks">
            <p className="font-display text-[9px] text-kyo">CLASS PERKS</p>
            {perks.map((p) => <p key={p.id}><span className="text-kyo">{p.name}:</span> {p.about}</p>)}
            {c.legacyPassive && <p className="text-dim">Old perk (now only in the Crying Girl's build): {c.legacyPassive}</p>}
          </div>
        )}
        {c.id === "cryinggirl" && <CryingCustomizer onChange={() => bump((n) => n + 1)} />}
        {c.id === "cryinggirl" && <PerkBuilder onChange={() => bump((n) => n + 1)} />}
        <Lines buffs={lines.buffs} debuffs={lines.debuffs} />
        <div>
          <p className="font-display text-[9px] text-kyo">MOVESET</p>
          <div className="flex flex-wrap">
            {c.starterMoves.map((id) => {
              const m = MOVE_BY_ID[id]!;
              const tac = moveTactic(m);
              return (
                <span key={id} className={`chip ${typeClass(m.type)}`} title={m.about}>
                  {id === c.signature ? "★ " : MOVEMENT.has(tac) ? "» " : ""}{m.name} · {tac}
                </span>
              );
            })}
          </div>
        </div>
        <div>
          <p className="font-display text-[9px] text-kyo">SKILL APTITUDES</p>
          <div className="flex flex-wrap">
            {Object.entries(c.aptitudes).map(([id, mult]) => (
              <span key={id} className={`chip ${Number(mult) >= 1 ? "stat-up" : "stat-down"}`}>
                {SKILLS.find((s) => s.id === id)?.name} ×{Number(mult).toFixed(1)}
              </span>
            ))}
          </div>
        </div>

      </div>
      <div className="sheet-box" data-testid="trait-picker">
        <p className="font-display text-[9px] text-kyo">PICK ONE CHARACTER TRAIT</p>
        <div className="mt-2 grid gap-1 sm:grid-cols-2">
          {TRAITS.map((t) => {
            const l = buffLines(t.stats, ("immune" in t ? t.immune : []) as never);
            return (
              <button
                key={t.id}
                type="button"
                data-testid={`trait-${t.id}`}
                className={`class-card ${pick.traitId === t.id ? "class-card-on" : ""}`}
                onClick={() => setPick({ ...pick, traitId: pick.traitId === t.id ? null : t.id })}
              >
                <span className="block text-lg">{t.name}</span>
                <span className="block text-base text-dim">{t.about}</span>
                <span className="block text-base">
                  {l.buffs.map((b) => <span key={b} className="stat-up">▲ {b} </span>)}
                  {l.debuffs.map((b) => <span key={b} className="stat-down">▼ {b} </span>)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type SheetTab = "overview" | "numbers" | "bonuses" | "skills" | "verses" | "gear";
const SHEET_TABS: { id: SheetTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "numbers", label: "Real numbers" },
  { id: "bonuses", label: "Bonuses" },
  { id: "skills", label: "Skills" },
  { id: "verses", label: "Verses" },
  { id: "gear", label: "Gear" },
];
const SRC_CLASS: Record<string, string> = { gear: "src-gear", account: "src-account", class: "src-class", buff: "src-buff", skill: "src-skill", level: "src-level", base: "src-base" };


function SourceLegend() {
  return (
    <p className="text-dim sheet-legend">
      <span className="src-class">■ class / trait</span> <span className="src-gear">■ gear</span> <span className="src-account">■ account perks</span> <span className="src-skill">■ skills</span> <span className="src-buff">■ timed</span>
    </p>
  );
}

export function CharacterSheet({ sheet }: { sheet: Sheet | null }) {
  const [tab, setTab] = useState<SheetTab>("overview");
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  if (!sheet) return <Empty>No character yet.</Empty>;
  const s = sheet;
  const q = filter.trim().toLowerCase();
  return (
    <div className="grid gap-3" data-testid="character-sheet">
      <div className="sheet-box">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-display text-xs text-kyo" data-testid="sheet-name">{s.name}</p>
          <p className={typeClass(s.type)} data-testid="sheet-class">{s.className} · {TYPES[s.type].name} · {s.role}</p>
        </div>
        <div className="sheet-vitals mt-1">
          <div><span className="text-dim">Level</span> <b data-testid="sheet-level">{s.level}</b></div>
          <div><span className="text-dim">Health</span> <b data-testid="sheet-hp">{s.hp}/{s.maxHp}</b>{s.shield > 0 && <span className="stat-up"> +{s.shield}</span>}<Meter value={s.hp} max={s.maxHp} small kind="hp" detail="" /></div>
          <div><span className="text-dim">XP</span> <b>{s.xp}/{s.xpNeed}</b><Meter value={s.xp} max={s.xpNeed} small kind="xp" detail="" /></div>
          <div><span className="text-dim">Kyo</span> <b>{s.kyo}</b></div>
          <div><span className="text-dim">Skill points</span> <b>{s.skillPoints}</b></div>
          <div><span className="text-dim">Account</span> <b>Lv {s.account.level}</b> <span className="text-dim">· {s.account.perks} perks · score {s.account.score}</span></div>
        </div>
        {s.night.on && <p className={s.night.phase === "night" ? "stat-down" : "text-dim"}>{s.night.phase === "night" ? "It is night. " : "Day. "}{s.night.rules}</p>}
      </div>

      <Tabs className="sheet-tabs" value={tab} onChange={setTab} label="Character sheet sections" tabs={SHEET_TABS.map((t) => ({ ...t, testid: `sheet-tab-${t.id}` }))} />

      {tab === "overview" && (
        <>
          <div className="sheet-box" data-testid="sheet-stats">
            <p className="font-display text-[9px] text-kyo">CLASS & TRAIT ATTRIBUTES</p>
            <p className="text-dim">Passive: <span className="text-bone">{s.passive}</span></p>
            <p className="text-dim">Trait: <span className="text-kyo" data-testid="sheet-trait">{s.trait ? s.trait.name : "None"}</span>{s.trait && ` · ${s.trait.about}`}</p>
            <div className="sheet-table mt-1">
              <div className="sheet-table-head"><span>Attribute</span><span>Class</span><span>Trait</span><span>Total</span></div>
              {s.stats.filter((st) => st.mod !== 0 || st.cls !== 0 || st.trait !== 0).map((st) => (
                <div key={st.id} className="sheet-table-row" title={st.about}>
                  <span>{st.name}<span className="text-dim"> · {st.about}</span></span>
                  <span className={st.cls > 0 ? "stat-up" : st.cls < 0 ? "stat-down" : "text-dim"}>{st.cls ? (st.cls > 0 ? `+${st.cls}` : st.cls) : "·"}</span>
                  <span className={st.trait > 0 ? "stat-up" : st.trait < 0 ? "stat-down" : "text-dim"}>{st.trait ? (st.trait > 0 ? `+${st.trait}` : st.trait) : "·"}</span>
                  <b className={st.mod > 0 ? "stat-up" : st.mod < 0 ? "stat-down" : "text-dim"}>{st.value}</b>
                </div>
              ))}
            </div>
            <p className="text-dim mt-1">Gear enchants and account perks are not in this table. See Real numbers and Bonuses for the final totals.</p>
          </div>
          <div className="sheet-box">
            <p className="font-display text-[9px] text-kyo">AT A GLANCE</p>
            <div className="sheet-grid mt-1">
              {s.numbers.slice(0, 8).map((n) => (
                <div key={n.id} className="sheet-row"><span className="text-dim">{n.label}</span><b>{n.value}</b></div>
              ))}
              {s.combat.filter((r) => ["Element", "Immunities", "Set"].includes(r.label)).map((row) => (
                <div key={row.label} className="sheet-row"><span className="text-dim">{row.label}</span><span>{row.value}</span></div>
              ))}
            </div>
          </div>
          <div className="sheet-box">
            <Lines buffs={s.buffs} debuffs={s.debuffs} />
          </div>
          <div className="sheet-box" data-testid="sheet-effects">
            <p className="font-display text-[9px] text-kyo">ACTIVE EFFECTS</p>
            {!s.effects.length && <Empty>Nothing is affecting you right now.</Empty>}
            {s.effects.map((e) => (
              <p key={e.id} className={e.good ? "stat-up" : "stat-down"}>{e.good ? "▲" : "▼"} {e.label}{e.t ? ` · ${e.t}s` : ""}</p>
            ))}
          </div>
        </>
      )}

      {tab === "numbers" && (
        <div className="sheet-box" data-testid="sheet-numbers">
          <p className="font-display text-[9px] text-kyo">YOUR REAL NUMBERS</p>
          <p className="text-dim">These are the values combat uses right now. Tap a row to see every source adding up to it.</p>
          <SourceLegend />
          {s.numbers.map((n) => (
            <div key={n.id} className="sheet-calc">
              <button type="button" className="sheet-calc-head" aria-expanded={open === n.id} onClick={() => setOpen(open === n.id ? null : n.id)}>
                <span>{open === n.id ? "▾" : "▸"} {n.label}</span>
                <b className="text-kyo">{n.value}</b>
              </button>
              {open === n.id && (
                <div className="sheet-calc-body">
                  {n.parts.map((p, i) => (
                    <div key={`${p.label}-${i}`} className="sheet-row"><span className={SRC_CLASS[p.src ?? "base"]}>{p.label}</span><span>{p.value}</span></div>
                  ))}
                  {n.note && <p className="text-dim">{n.note}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "bonuses" && (
        <div className="sheet-box" data-testid="sheet-bonuses">
          <p className="font-display text-[9px] text-kyo">ENCHANTS & ACCOUNT PERKS</p>
          <p className="text-dim">Every bonus you have, with gear and account split out. Total is what the game uses.</p>
          <input className="px-input mt-1" placeholder="Search bonuses" aria-label="Search bonuses" value={filter} onChange={(e) => setFilter(e.target.value)} />
          {!s.bonuses.length && <p className="text-dim mt-2">No enchants on your gear and no perk points yet.</p>}
          <div className="sheet-table mt-2">
            <div className="sheet-table-head"><span>Bonus</span><span className="src-gear">Gear</span><span className="src-account">Account</span><span>Total</span></div>
            {s.bonuses.filter((b) => !q || b.name.toLowerCase().includes(q)).map((b) => (
              <div key={b.id} className="sheet-bonus">
                <div className="sheet-table-row">
                  <span>{b.name}</span>
                  <span className="src-gear">{b.gear || "·"}</span>
                  <span className="src-account">{b.account || "·"}</span>
                  <b className="text-kyo">{b.total}</b>
                </div>
                <p className="text-dim sheet-effect">{b.effect}</p>
                {b.slots.length > 0 && <p className="text-dim sheet-effect">On: {b.slots.map((x) => `${x.slot} ${x.power}`).join(" · ")}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "skills" && (
        <div className="sheet-box" data-testid="sheet-skills">
          <p className="font-display text-[9px] text-kyo">SKILLS · WHAT EACH ONE DOES AT YOUR LEVEL</p>
          {s.skillsFull.map((a) => (
            <div key={a.id} className="sheet-calc">
              <div className="sheet-row">
                <span>{a.name} <b>{a.level}</b></span>
                <span className={a.mult > 1 ? "stat-up" : a.mult < 1 ? "stat-down" : "text-dim"}>{a.mult > 1 ? "Excels" : a.mult < 1 ? "Weak" : "Normal"} ×{a.mult.toFixed(1)}</span>
              </div>
              <Meter value={a.xp} max={a.need} small kind="xp" />
              <p className="text-dim sheet-effect">{a.line}</p>
              <p className="text-dim sheet-effect">{a.xp}/{a.need} to next level</p>
            </div>
          ))}
        </div>
      )}

      {tab === "verses" && (
        <div className="sheet-box" data-testid="sheet-moves">
          <p className="font-display text-[9px] text-kyo">VERSES · ★ signature · » movement</p>
          <p className="text-dim">Damage shown is against a neutral target your level. Element match, target weakness and bosses change it in the fight.</p>
          {s.moves.map((m) => (
            <div key={m.id} className="sheet-calc">
              <button type="button" className="sheet-calc-head" aria-expanded={open === `m:${m.id}`} onClick={() => setOpen(open === `m:${m.id}` ? null : `m:${m.id}`)} title={m.about}>
                <span className={typeClass(m.type)}>{open === `m:${m.id}` ? "▾" : "▸"} {m.signature ? "★ " : m.movement ? "» " : ""}{m.name} <span className="text-dim">· {m.tactic} · {m.rank ? `rank ${m.rank}` : "locked"}</span></span>
                <b className="text-kyo">
                  {m.kind === "damage" ? `${m.hit}${m.critHit > m.hit ? ` / ${m.critHit}` : ""}` : m.kind === "heal" ? `+${m.heal} hp` : m.kind === "ward" ? `${m.shield} shield` : "utility"}
                </b>
              </button>
              {open === `m:${m.id}` && (
                <div className="sheet-calc-body">
                  <div className="sheet-row"><span className="text-dim">Cooldown</span><span>{m.cd}s</span></div>
                  <div className="sheet-row"><span className="text-dim">Accuracy</span><span>{m.acc}%</span></div>
                  <div className="sheet-row"><span className="text-dim">Range</span><span>{m.range}</span></div>
                  {m.kind === "damage" && <div className="sheet-row"><span className="text-dim">Crit chance</span><span>{m.critPct}% · {m.critHit} on crit</span></div>}
                  <div className="sheet-row"><span className="text-dim">Verse rank bonus</span><span>×{(m.rankMult ?? 1).toFixed(2)}</span></div>
                  {m.note && <p className="stat-up">{m.note}</p>}
                  {(m.shape ?? []).length > 0 && (
                    <>
                      <p className="text-dim mt-1">How the hit adds up</p>
                      {(m.shape ?? []).map((x, i) => <div key={`${x.label}-${i}`} className="sheet-row"><span className="text-dim">{x.label}</span><span>{x.value}</span></div>)}
                    </>
                  )}
                  <p className="text-dim mt-1">{m.about}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "gear" && (
        <div className="sheet-box" data-testid="sheet-gear">
          <p className="font-display text-[9px] text-kyo">EQUIPMENT</p>
          {s.gear.map((g) => (
            <div key={g.slot} className="sheet-row">
              <span className="text-dim capitalize">{g.slot}</span>
              <span>{g.name}{g.quality ? ` · ${g.quality}` : ""}{g.stat ? ` · ${g.stat}` : ""}</span>
            </div>
          ))}
          {s.combat.filter((r) => r.label === "Set").map((r) => <p key={r.label} className="text-dim mt-1">Set bonus: {r.value}</p>)}
        </div>
      )}
    </div>
  );
}

/** The Crying Girl's custom build: any 4 perks from every class perk plus every legacy perk. */
function PerkBuilder({ onChange }: { onChange: () => void }) {
  const [kind, setKind] = useState<"all" | "new" | "legacy">("all");
  const [q, setQ] = useState("");
  const picked = getCustomBuild();
  const f = q.trim().toLowerCase();
  const shown = PERKS.filter((p) => (kind === "all" || (kind === "legacy" ? p.legacy : !p.legacy)) && (!f || p.name.toLowerCase().includes(f) || p.about.toLowerCase().includes(f) || (CLASS_BY_ID[p.cls as ClassId]?.name ?? "").toLowerCase().includes(f)));
  const toggle = (id: string) => {
    setCustomBuild(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
    onChange();
  };
  return (
    <div className="grid gap-2" data-testid="perk-builder">
      <p className="font-display text-[9px] text-kyo">BUILD HER · {picked.length}/{CUSTOM_BUILD_MAX} PERKS</p>
      <div className="flex flex-wrap gap-1">
        {(["all", "new", "legacy"] as const).map((k) => (
          <button key={k} type="button" data-testid={`perk-kind-${k}`} className={`px-btn ui-btn-sm ${kind === k ? "px-btn-kyo" : ""}`} onClick={() => setKind(k)}>{k === "all" ? "Every perk" : k === "new" ? "New perks" : "Legacy perks"}</button>
        ))}
        <input className="px-input" data-testid="perk-search" placeholder="Search perks or class" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid gap-1 sm:grid-cols-2" style={{ maxHeight: 260, overflowY: "auto" }}>
        {shown.map((p) => {
          const on = picked.includes(p.id);
          const l = buffLines(p.stats, (p.immune ?? []) as never);
          return (
            <button key={p.id} type="button" data-testid={`perk-pick-${p.id}`} disabled={!on && picked.length >= CUSTOM_BUILD_MAX}
              className={`class-card perk-pick ${p.legacy ? "perk-pick-legacy" : ""} ${on ? "class-card-on" : ""}`} onClick={() => toggle(p.id)}>
              <span className="block text-lg">{on ? "✔ " : ""}{p.name} <span className="text-dim text-sm">· {CLASS_BY_ID[p.cls as ClassId]?.name}</span></span>
              <span className="block text-base text-dim">{p.about}</span>
              <span className="block text-sm">{l.buffs.map((b) => <span key={b} className="stat-up">▲ {b} </span>)}{l.debuffs.map((b) => <span key={b} className="stat-down">▼ {b} </span>)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The Crying Girl's own element, role, fight style and stat lean. Saved on this browser. */
function CryingCustomizer({ onChange }: { onChange: () => void }) {
  const cfg = getCryingConfig();
  const spent = leanSpent(cfg.lean);
  const set = (next: Parameters<typeof setCryingConfig>[0]) => { setCryingConfig(next); onChange(); };
  const step = (k: (typeof LEAN_STATS)[number], d: number) => {
    const cur = cfg.lean[k] ?? 0;
    const v = Math.max(LEAN_MIN, Math.min(LEAN_MAX, cur + d));
    if (v === cur || (d > 0 && spent + (v - cur) > LEAN_BUDGET)) return;
    set({ lean: { ...cfg.lean, [k]: v } });
  };
  return (
    <div className="grid gap-2" data-testid="crying-customizer">
      <p className="font-display text-[9px] text-kyo">CUSTOMISE HER</p>
      <div className="verse-filter-row" data-testid="cry-type">
        <span className="verse-filter-label">ELEMENT</span>
        {CRY_TYPES.map((t) => (
          <button key={t} type="button" data-testid={`cry-type-${t}`} className={`verse-chip ${cfg.type === t ? "verse-chip-on" : ""}`} onClick={() => set({ type: t })}><span className={cfg.type === t ? "" : typeClass(t)}>{TYPES[t].name}</span></button>
        ))}
      </div>
      <div className="verse-filter-row" data-testid="cry-role">
        <span className="verse-filter-label">ROLE</span>
        {ROLES.map((r) => (
          <button key={r} type="button" data-testid={`cry-role-${r.toLowerCase()}`} className={`verse-chip ${cfg.role === r ? "verse-chip-on" : ""}`} onClick={() => set({ role: r })}>{r}</button>
        ))}
      </div>
      <div className="verse-filter-row" data-testid="cry-style">
        <span className="verse-filter-label">STYLE</span>
        {(["melee", "ranged", "mixed"] as const).map((st) => (
          <button key={st} type="button" data-testid={`cry-style-${st}`} className={`verse-chip ${cfg.fightStyle === st ? "verse-chip-on" : ""}`} onClick={() => set({ fightStyle: st })}>{st}</button>
        ))}
      </div>
      <p className="text-dim" data-testid="cry-lean-budget">Stat lean: <span className={spent > LEAN_BUDGET ? "text-blood" : "text-kyo"}>{spent}/{LEAN_BUDGET}</span> points. Lower a stat (to {LEAN_MIN}%) to free points for another (up to +{LEAN_MAX}%).</p>
      <div className="grid gap-1 sm:grid-cols-3">
        {LEAN_STATS.map((k) => {
          const v = cfg.lean[k] ?? 0;
          return (
            <div key={k} className="verse-filter-row" data-testid={`cry-lean-${k}`}>
              <button type="button" className="px-btn ui-btn-sm" data-testid={`cry-lean-${k}-down`} disabled={v <= LEAN_MIN} onClick={() => step(k, -LEAN_STEP)}>−</button>
              <span className={`text-base ${v > 0 ? "stat-up" : v < 0 ? "stat-down" : "text-dim"}`} style={{ minWidth: 110 }} title={STAT_LABEL[k].about}>{STAT_LABEL[k].name} {v > 0 ? "+" : ""}{v}</span>
              <button type="button" className="px-btn ui-btn-sm" data-testid={`cry-lean-${k}-up`} disabled={v >= LEAN_MAX || spent + LEAN_STEP > LEAN_BUDGET} onClick={() => step(k, LEAN_STEP)}>+</button>
            </div>
          );
        })}
      </div>
      <button type="button" className="px-btn ui-btn-sm" data-testid="cry-lean-reset" onClick={() => set({ lean: {} })}>Clear stat lean</button>
    </div>
  );
}
