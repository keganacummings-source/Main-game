import { useCallback, useEffect, useMemo, useState } from "react";
import { ENCHANT_BY_ID, GEAR_PURPOSES, PURPOSE_BY_ID, SET_BY_ID, TYPES, enchantText, equipmentStats, gearPrice, gearPurpose, gearScore, type Gear, type GearPurpose, type QualityId, type Slot, type TypeId } from "@/game/content";
import { gearSellValue } from "@/game/balance";
import { BOSS_COLOR, QUALITY_COLOR, QUALITY_ORDER as CHEST_QUALITIES, SUPPLIES_COLOR } from "@/game/chest-loot";
import { fxGene, fxGeneLabel, fxTrait, fxTraitLabel, geneSeedOf } from "@/game/fx-gene";
import { ConfirmButton, Section, Tabs } from "./ui-kit";
import type { getSnap, TurbzGame } from "@/game/engine";

type Snap = ReturnType<typeof getSnap>;
type Props = { snap: Snap; game: TurbzGame | null };

const SLOTS: Slot[] = ["weapon", "head", "chest", "legs", "feet", "relic"];
const SLOT_LABEL: Record<Slot, string> = { weapon: "Weapon", head: "Head", chest: "Chest", legs: "Legs", feet: "Feet", relic: "Relic" };
const QUALITY_ORDER: QualityId[] = ["worn", "common", "fine", "rare", "epic", "legendary"];
const QUALITY_LABEL: Record<QualityId, string> = { worn: "Worn", common: "Common", fine: "Fine", rare: "Rare", epic: "Epic", legendary: "Legendary" };

function statLine(g: Gear): string {
  const s = equipmentStats(g);
  return s.damage ? `Damage ${s.damage}` : `Armor ${s.armor}`;
}

const QUALITY_RANK: Record<string, number> = { worn: 0, common: 1, fine: 2, rare: 3, epic: 4, legendary: 5 };

/** What this piece's effect looks like when worn: its own pattern and accent element. */
function fxLine(g: Gear): string {
  const q = QUALITY_RANK[g.quality] ?? 0;
  if (q < 2) return "FX: none until Fine quality.";
  const gene = fxGene(geneSeedOf(g), g.type, q);
  const trait = fxTraitLabel(fxTrait(geneSeedOf(g), g.slot, q));
  if (trait) return `FX: ${trait} in ${TYPES[g.type]?.name ?? g.type}${gene.accent ? ` with ${TYPES[gene.accent].name}` : ""}${trait.endsWith("Imbue") ? " · adds a layer to your verses" : ""}`;
  const label = fxGeneLabel(gene, gene.accent ? TYPES[gene.accent].name : undefined);
  return `FX: ${label} · ${gene.shape}${gene.flare ? " · flare" : ""}${gene.dir < 0 ? " · counter-spin" : ""}`;
}

function wornIn(snap: Snap, slot: Slot): Gear | null {
  return snap.gear.find((g) => g.slot === slot && snap.equipped.includes(g.uid)) ?? null;
}

/** Score difference against what is worn in the same slot. */
function Delta({ snap, g }: { snap: Snap; g: Gear }) {
  const worn = wornIn(snap, g.slot);
  if (!worn || worn.uid === g.uid) return null;
  const d = gearScore(g) - gearScore(worn);
  if (d === 0) return <span className="text-dim">= worn</span>;
  return <span className={d > 0 ? "stat-up" : "stat-down"}>{d > 0 ? "▲" : "▼"} {Math.abs(d)}</span>;
}

function GearCard({ snap, g, selected, onPick, onEquip, children }: { snap: Snap; g: Gear; selected?: boolean; onPick?: (e: React.MouseEvent) => void; onEquip?: () => void; children?: React.ReactNode }) {
  const worn = snap.equipped.includes(g.uid);
  const locked = snap.locked.includes(g.uid);
  return (
    <div className={`gear-card q-${g.quality} ${selected ? "gear-card-on" : ""}`}>
      <button type="button" className="gear-card-main" onClick={onPick} onDoubleClick={onEquip} title={onEquip ? "Double-click to wear" : undefined} aria-pressed={selected}>
        <span className="gear-card-name">{g.name}</span>
        <span className="gear-card-meta">
          Lv {g.level} · {SLOT_LABEL[g.slot]} · <span className={`type-${g.type}`}>{TYPES[g.type]?.name ?? g.type}</span>
        </span>
        <span className="gear-card-meta">
          {statLine(g)} · {g.enchants.length} ench <Delta snap={snap} g={g} />
        </span>
        <span className="gear-card-tags">
          <span className={`gear-tag gear-purpose gear-purpose-${gearPurpose(g)}`} title={PURPOSE_BY_ID[gearPurpose(g)].about}>{PURPOSE_ICON[gearPurpose(g)]} {PURPOSE_BY_ID[gearPurpose(g)].name}</span>
          {g.setId && SET_BY_ID[g.setId] && <span className="gear-tag" title={SET_BY_ID[g.setId]!.bonus}>{SET_BY_ID[g.setId]!.name}</span>}
          {worn && <span className="gear-tag gear-tag-worn">WORN</span>}
          {locked && <span className="gear-tag">LOCKED</span>}
          {!worn && <span className="gear-tag gear-tag-kyo">{gearSellValue(gearPrice(g), snap.sellMult)} kyo</span>}
        </span>
      </button>
      {children}
    </div>
  );
}

function EnchantList({ g }: { g: Gear }) {
  if (!g.enchants.length) return <p className="text-dim">No enchantments.</p>;
  return (
    <ul className="enchant-list">
      {g.enchants.map((e) => (
        <li key={`${g.uid}-${e.id}`}>
          <span className="text-kyo">{ENCHANT_BY_ID[e.id]?.name ?? e.id} {e.power}</span> <span className="text-dim">· {enchantText(e)}</span>
        </li>
      ))}
    </ul>
  );
}

function useSellable(snap: Snap, cap: QualityId | "all") {
  return useMemo(() => {
    const max = cap === "all" ? 99 : QUALITY_ORDER.indexOf(cap);
    const list = snap.gear.filter((g) => !snap.equipped.includes(g.uid) && !snap.locked.includes(g.uid) && QUALITY_ORDER.indexOf(g.quality) <= max);
    const kyo = list.reduce((n, g) => n + gearSellValue(gearPrice(g), snap.sellMult), 0);
    return { count: list.length, kyo };
  }, [snap.gear, snap.equipped, snap.locked, snap.sellMult, cap]);
}

function SellAllBar({ snap, game }: Props) {
  const [cap, setCap] = useState<QualityId | "all">("all");
  const { count, kyo } = useSellable(snap, cap);
  return (
    <div className="sell-bar">
      <ConfirmButton
        label={count ? `Sell all unequipped · ${count} · ${kyo} kyo` : "Nothing to sell"}
        confirm={`Tap again to sell ${count} for ${kyo} kyo`}
        disabled={!count}
        onConfirm={() => game?.sellAllUnequipped(cap === "all" ? null : cap)}
      />
      <select className="px-input" aria-label="Sell up to quality" value={cap} onChange={(e) => setCap(e.target.value as QualityId | "all")}>
        <option value="all">Any quality</option>
        {QUALITY_ORDER.slice(0, 5).map((q) => (
          <option key={q} value={q}>Up to {QUALITY_LABEL[q]}</option>
        ))}
      </select>
      <span className="text-dim sell-bar-note">Worn and locked gear is always kept.</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bag
// ---------------------------------------------------------------------------

type GearTab = "gear" | "sets" | "stash";
type SortKey = "score" | "level" | "quality" | "price" | "new" | "purpose";
/** Total enchantment power on a piece that serves its purpose (for "Most purpose power" sorting). */
function purposePower(g: Gear, p: GearPurpose): number {
  return g.enchants.reduce((n, e) => n + (ENCHANT_BY_ID[e.id]?.cat === p ? e.power : 0), 0);
}
const PURPOSE_ICON: Record<GearPurpose, string> = { combat: "⚔", defense: "🛡", reach: "➶", gathering: "⛏", fortune: "✦", spirits: "👻", travel: "➹" };

/** The bag: consumables, materials and crafting. Gear has its own Inventory window (I). */
export function Bag({ snap, game }: Props) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const items = snap.bag.filter((it) => !term || it.name.toLowerCase().includes(term));
  const count = (id: string) => snap.bag.find((it) => it.id === id)?.count ?? 0;
  return (
    <div className="bag" data-testid="bag-items">
      <div className="bag-head">
        <div className="bag-tabs">
          <span className="font-display text-[9px] text-kyo">ITEMS · {snap.bag.length}</span>
          <button type="button" className="px-btn bag-tab" data-testid="open-gear-btn" onClick={() => game?.toggle("gear")}>Gear inventory (I) · {snap.gear.length}</button>
        </div>
        <span className="bag-kyo">{snap.kyo.toLocaleString()} kyo</span>
      </div>
      <Section title="SPACE BAR" right={<span className="text-dim">{snap.quick.length}/3{snap.quickCd > 0 ? ` · potion cooldown ${snap.quickCd}s` : ""}</span>}>
        <p className="text-dim">Press Space to use the first item. When it runs out, the next one in line takes over.</p>
        <div className="quick-queue" data-testid="quick-queue">
          {[0, 1, 2].map((i) => {
            const q = snap.quick[i];
            if (!q) return <div key={i} className="quick-slot quick-slot-empty">{i === 0 ? "Space · empty" : `Queue ${i + 1} · empty`}</div>;
            return (
              <div key={q.id} className={`quick-slot ${i === 0 ? "quick-slot-first" : ""}`} data-testid={`quick-${i}`}>
                <span className="ui-row"><span className={i === 0 ? "text-good" : "text-kyo"}>{i === 0 ? "Space" : `Next ${i}`} · {q.name}</span><span className="text-dim">×{q.count}</span></span>
                <span className="ui-row-gap">
                  {i > 0 && <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.setQuick(q.id, "up")} aria-label={`Move ${q.name} up`}>▲ Up</button>}
                  <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.setQuick(q.id, "remove")} aria-label={`Remove ${q.name} from Space`}>Remove</button>
                </span>
              </div>
            );
          })}
        </div>
      </Section>
      <div className="bag-toolbar bag-toolbar-1">
        <input className="px-input" aria-label="Search items" placeholder="Search items" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {items.length ? (
        <div className="item-grid">
          {items.map((it) => {
            const at = snap.quick.findIndex((q) => q.id === it.id);
            return (
              <div key={it.id} className="item-card" data-testid={`item-${it.id}`}>
                <p className="item-card-name">{it.name} <span className="text-kyo">×{it.count}</span>{at >= 0 && <span className="text-good"> · {at === 0 ? "Space" : `Space queue ${at + 1}`}</span>}</p>
                <p className="text-dim item-card-about">{it.about}</p>
                {it.quickable && it.useProblem && <p className="item-card-problem">{it.useProblem}</p>}
                {it.effect && <p className="item-card-effect">{it.effect}</p>}
                <div className="item-card-actions">
                  {it.quickable && <button type="button" className="px-btn" disabled={!!it.useProblem} onClick={() => game?.useBag(it.id)}>Use</button>}
                  {it.quickable && at !== 0 && <button type="button" className="px-btn" data-testid={`set-space-${it.id}`} onClick={() => game?.setQuick(it.id, "set")}>Set to Space</button>}
                  {it.quickable && at < 0 && snap.quick.length > 0 && <button type="button" className="px-btn" data-testid={`queue-space-${it.id}`} disabled={snap.quick.length >= 3} onClick={() => game?.setQuick(it.id, "queue")}>Queue</button>}
                  <button type="button" className="px-btn" onClick={() => game?.sellItem(it.id, Infinity)}>Sell all</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-dim">{term ? "No matching items." : "Your bag is empty."}</p>
      )}
      <div className="bag-crafts">
        <button type="button" className="px-btn px-btn-kyo" onClick={() => game?.toggle("craft")}>Crafting · potions</button>
        <button type="button" className="px-btn" disabled={count("leather") < 10 || count("mushroom") < 10} onClick={() => game?.craftGear()}>
          Stitch gear · Leather {count("leather")}/10 · Shroom {count("mushroom")}/10
        </button>
        <button type="button" className="px-btn" onClick={() => game?.sellMats()}>
          {snap.rules === "hardcore" ? "Sell hides & ore" : "Sell gathered materials"}
        </button>
      </div>
    </div>
  );
}

/**
 * Gear inventory: everything you own, filtered by what it is for (combat, defense, reach, gathering,
 * fortune, spirits, travel), slot, quality and element; sorted any way; sets grouped with their bonus;
 * and the enchantment stash.
 */
export function GearInventory({ snap, game }: Props) {
  const [tab, setTab] = useState<GearTab>("gear");
  const [slot, setSlot] = useState<Slot | "all">("all");
  const [purpose, setPurpose] = useState<GearPurpose | "all">("all");
  const [minQ, setMinQ] = useState<QualityId>("worn");
  const [element, setElement] = useState<TypeId | "all">("all");
  const [sort, setSort] = useState<SortKey>("score");
  const [search, setSearch] = useState("");
  const [showWorn, setShowWorn] = useState(false);
  const [lockedOnly, setLockedOnly] = useState(false);
  const term = search.trim().toLowerCase();
  const order = useMemo(() => new Map(snap.gear.map((g, i) => [g.uid, i])), [snap.gear]);
  const spare = snap.gear.filter((g) => !snap.equipped.includes(g.uid));
  const purposeCount = useMemo(() => {
    const m: Partial<Record<GearPurpose, number>> = {};
    for (const g of snap.gear) if (showWorn || !snap.equipped.includes(g.uid)) m[gearPurpose(g)] = (m[gearPurpose(g)] ?? 0) + 1;
    return m;
  }, [snap.gear, snap.equipped, showWorn]);
  const gear = useMemo(() => {
    const qMin = QUALITY_ORDER.indexOf(minQ);
    const text = (g: Gear) => `${g.name} ${g.slot} ${g.quality} ${g.type} ${PURPOSE_BY_ID[gearPurpose(g)].name} ${g.setId ? SET_BY_ID[g.setId]?.name ?? "" : ""} ${g.enchants.map((e) => ENCHANT_BY_ID[e.id]?.name ?? e.id).join(" ")}`.toLowerCase();
    const list = snap.gear.filter((g) =>
      (showWorn || !snap.equipped.includes(g.uid)) && (slot === "all" || g.slot === slot) && (purpose === "all" || gearPurpose(g) === purpose)
      && QUALITY_ORDER.indexOf(g.quality) >= qMin && (element === "all" || g.type === element) && (!lockedOnly || snap.locked.includes(g.uid)) && (!term || text(g).includes(term)));
    const by: Record<SortKey, (a: Gear, b: Gear) => number> = {
      score: (a, b) => gearScore(b) - gearScore(a),
      level: (a, b) => b.level - a.level,
      quality: (a, b) => QUALITY_ORDER.indexOf(b.quality) - QUALITY_ORDER.indexOf(a.quality) || b.level - a.level,
      price: (a, b) => gearPrice(b) - gearPrice(a),
      new: (a, b) => (order.get(b.uid) ?? 0) - (order.get(a.uid) ?? 0),
      purpose: (a, b) => purposePower(b, purpose === "all" ? gearPurpose(b) : purpose) - purposePower(a, purpose === "all" ? gearPurpose(a) : purpose),
    };
    return list.sort(by[sort]);
  }, [snap.gear, snap.equipped, snap.locked, slot, purpose, minQ, element, lockedOnly, sort, term, showWorn, order]);
  const sets = useMemo(() => {
    const m = new Map<string, Gear[]>();
    for (const g of snap.gear) if (g.setId && SET_BY_ID[g.setId]) m.set(g.setId, [...(m.get(g.setId) ?? []), g]);
    return [...m.entries()].map(([id, list]) => ({ id, def: SET_BY_ID[id]!, list, slots: new Set(list.map((g) => g.slot)) })).sort((a, b) => b.slots.size - a.slots.size || a.def.name.localeCompare(b.def.name));
  }, [snap.gear]);
  const selected = snap.gear.find((g) => g.uid === snap.selected) ?? null;
  const wearSet = (list: Gear[]) => {
    for (const sl of ["head", "chest", "legs", "feet", "relic"] as const) {
      const best = list.filter((g) => g.slot === sl).sort((a, b) => gearScore(b) - gearScore(a))[0];
      if (best && !snap.equipped.includes(best.uid)) game?.equip(best.uid);
    }
  };

  return (
    <div className="bag" data-testid="gear-inventory">
      <div className="bag-head">
        <Tabs className="bag-tabs" value={tab} onChange={setTab} label="Gear inventory" tabs={[
          { id: "gear", label: `Gear · ${spare.length}` },
          { id: "sets", label: `Sets · ${sets.length}`, testid: "gear-sets-tab" },
          { id: "stash", label: `Enchants · ${snap.stash.length}` },
        ]} />
        <span className="bag-kyo">{snap.kyo.toLocaleString()} kyo</span>
      </div>

      <div className="bag-body">
        <aside className="bag-worn" aria-label="Equipped">
          <p className="font-display text-[9px] text-kyo">WORN · {snap.setLabel}</p>
          <div className="worn-grid">
            {SLOTS.map((s) => {
              const g = wornIn(snap, s);
              return (
                <button key={s} type="button" className={`worn-slot ${g ? `q-${g.quality}` : ""} ${g && snap.selected === g.uid ? "gear-card-on" : ""}`} onClick={() => g && game?.select(g.uid)} disabled={!g}>
                  <span className="worn-slot-label">{SLOT_LABEL[s]}</span>
                  {g ? (
                    <>
                      <span className="worn-slot-name">{g.name}</span>
                      <span className="text-dim">Lv {g.level} · {statLine(g)}</span>
                    </>
                  ) : (
                    <span className="text-dim">Empty</span>
                  )}
                </button>
              );
            })}
          </div>
          <details className="bag-details">
            <summary>Set & enchant totals</summary>
            <p className="text-dim">{snap.setBonus}</p>
            {(snap.setProgress ?? []).length > 0 && (
              <div className="set-progress" data-testid="set-progress">
                <p className="text-dim">Sets found by this class (all 5 pieces unlocks it as level-1 spawn gear):</p>
                {snap.setProgress.map((row) => (
                  <div key={row.id} className="set-progress-row">
                    <span>{row.name}</span>
                    <span className="set-progress-pips">
                      {(["head", "chest", "legs", "feet", "relic"] as const).map((sl) => (
                        <i key={sl} title={SLOT_LABEL[sl]} className={row.slots.includes(sl) ? "on" : ""} />
                      ))}
                    </span>
                    <span className={row.have >= 5 ? "text-kyo" : "text-dim"}>{row.have >= 5 ? "Unlocked" : `${row.have}/5`}</span>
                  </div>
                ))}
              </div>
            )}
            {snap.totals.length ? (
              <ul className="enchant-list">
                {snap.totals.map((row) => (
                  <li key={row.id}>{row.name} <span className="text-kyo">{row.power}</span></li>
                ))}
              </ul>
            ) : (
              <p className="text-dim">No enchantments on what you are wearing.</p>
            )}
          </details>
        </aside>

        <section className="bag-main">
          {selected && (
            <div className={`gear-detail q-${selected.quality}`}>
              <div className="gear-detail-head">
                <div>
                  <p className="gear-card-name">{selected.name}</p>
                  <p className="text-dim">
                    Lv {selected.level} · {SLOT_LABEL[selected.slot]} · {QUALITY_LABEL[selected.quality]} · {statLine(selected)} · score {gearScore(selected)} <Delta snap={snap} g={selected} />
                  </p>
                </div>
                <button type="button" className="float-win-btn" aria-label="Close details" onClick={() => game?.select(null)}>×</button>
              </div>
              <EnchantList g={selected} />
              <p className="text-dim" data-testid="gear-fx-label">{fxLine(selected)}</p>
              <div className="gear-actions">
                <button type="button" className="px-btn px-btn-kyo" disabled={snap.equipped.includes(selected.uid)} onClick={() => game?.equip(selected.uid)}>
                  {snap.equipped.includes(selected.uid) ? "Worn" : "Wear"}
                </button>
                <button type="button" className="px-btn" disabled={snap.equipped.includes(selected.uid) || snap.locked.includes(selected.uid)} onClick={() => game?.sell(selected.uid)}>
                  Sell · {gearSellValue(gearPrice(selected), snap.sellMult)} kyo
                </button>
                <button type="button" className="px-btn" onClick={() => game?.toggleLock(selected.uid)}>
                  {snap.locked.includes(selected.uid) ? "Unlock" : "Lock"}
                </button>
                <button type="button" className="px-btn" disabled={!selected.enchants.length || snap.kyo < 80} onClick={() => game?.disenchant()}>
                  Strip enchant · 80
                </button>
              </div>
            </div>
          )}

          {tab === "gear" && (
            <>
              <div className="bag-toolbar">
                <input className="px-input" aria-label="Search gear" placeholder="Search name, set, enchantment…" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="px-input" aria-label="Sort gear" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                  <option value="score">Best first</option>
                  <option value="purpose">Most {purpose === "all" ? "purpose" : PURPOSE_BY_ID[purpose].name.toLowerCase()} power</option>
                  <option value="level">Level</option>
                  <option value="quality">Quality</option>
                  <option value="price">Sell price</option>
                  <option value="new">Newest</option>
                </select>
              </div>
              <div className="chip-row" role="group" aria-label="Filter by purpose" data-testid="gear-purpose-filter">
                <button type="button" className={`chip ${purpose === "all" ? "chip-on" : ""}`} onClick={() => setPurpose("all")}>Any use</button>
                {GEAR_PURPOSES.map((p) => (
                  <button key={p.id} type="button" title={p.about} data-testid={`gear-purpose-${p.id}`} className={`chip ${purpose === p.id ? "chip-on" : ""}`} onClick={() => setPurpose(purpose === p.id ? "all" : p.id)}>
                    {PURPOSE_ICON[p.id]} {p.name} <span className="text-dim">{purposeCount[p.id] ?? 0}</span>
                  </button>
                ))}
              </div>
              <div className="bag-toolbar">
                <select className="px-input" aria-label="Lowest quality" value={minQ} onChange={(e) => setMinQ(e.target.value as QualityId)}>
                  {QUALITY_ORDER.map((q) => <option key={q} value={q}>{q === "worn" ? "Any quality" : `${QUALITY_LABEL[q]} or better`}</option>)}
                </select>
                <select className="px-input" aria-label="Element" value={element} onChange={(e) => setElement(e.target.value as TypeId | "all")}>
                  <option value="all">Any element</option>
                  {(Object.keys(TYPES) as TypeId[]).map((t) => <option key={t} value={t}>{TYPES[t].name}</option>)}
                </select>
              </div>
              <div className="chip-row" role="group" aria-label="Filter by slot">
                {(["all", ...SLOTS] as const).map((s) => (
                  <button key={s} type="button" className={`chip ${slot === s ? "chip-on" : ""}`} onClick={() => setSlot(s)}>
                    {s === "all" ? "All" : SLOT_LABEL[s]}
                  </button>
                ))}
                <label className="chip chip-check">
                  <input type="checkbox" checked={showWorn} onChange={(e) => setShowWorn(e.target.checked)} /> Show worn
                </label>
                <label className="chip chip-check">
                  <input type="checkbox" checked={lockedOnly} onChange={(e) => setLockedOnly(e.target.checked)} /> Locked only
                </label>
              </div>
              <SellAllBar snap={snap} game={game} />
              <p className="text-dim">Click a piece to read it. Double-click to wear it.</p>
              {gear.length ? (
                <div className="gear-grid">
                  {gear.map((g) => (
                    <GearCard key={g.uid} snap={snap} g={g} selected={snap.selected === g.uid} onPick={() => game?.select(g.uid)} onEquip={() => { if (!snap.equipped.includes(g.uid)) game?.equip(g.uid); }} />
                  ))}
                </div>
              ) : (
                <p className="text-dim">{term || slot !== "all" || purpose !== "all" || element !== "all" || minQ !== "worn" || lockedOnly ? "No gear matches these filters." : "No spare gear. Everything you own is being worn."}</p>
              )}
            </>
          )}

          {tab === "sets" && (
            <div className="ui-stack" data-testid="gear-sets">
              <p className="text-dim">Armor pieces grouped by set. Wear all five pieces of one set (head, chest, legs, feet, relic) for its bonus.</p>
              {!sets.length && <p className="text-dim">No set pieces yet. Every armor drop belongs to a set.</p>}
              {sets.map((row) => (
                <div key={row.id} className="ui-card ui-stack-sm">
                  <div className="ui-row">
                    <span className="text-kyo">{row.def.name}</span>
                    <span className={row.slots.size >= 5 ? "text-kyo" : "text-dim"}>{row.slots.size}/5 pieces</span>
                  </div>
                  <p className="text-dim">{row.def.bonus}</p>
                  <span className="set-progress-pips">
                    {(["head", "chest", "legs", "feet", "relic"] as const).map((sl) => <i key={sl} title={SLOT_LABEL[sl]} className={row.slots.has(sl) ? "on" : ""} />)}
                  </span>
                  <div className="gear-grid">
                    {row.list.sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || gearScore(b) - gearScore(a)).map((g) => (
                      <GearCard key={g.uid} snap={snap} g={g} selected={snap.selected === g.uid} onPick={() => game?.select(g.uid)} onEquip={() => { if (!snap.equipped.includes(g.uid)) game?.equip(g.uid); }} />
                    ))}
                  </div>
                  <button type="button" className="px-btn ui-btn-sm" onClick={() => wearSet(row.list)}>Wear the best piece of each slot</button>
                </div>
              ))}
            </div>
          )}

          {tab === "stash" && (
            <div className="grid gap-2">
              <p className="text-dim">Stripped and bought enchantments. Select a piece of gear, then apply one to it.</p>
              {!snap.stash.length && <p className="text-dim">The stash is empty.</p>}
              <div className="item-grid">
                {snap.stash.map((line, i) => (
                  <button key={`${line}-${i}`} type="button" className="px-btn text-left" disabled={!selected} onClick={() => game?.applyStash(i)}>
                    {line}
                    <span className="block text-dim">{selected ? `Apply to ${selected.name}` : "Select gear first"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Black Market
// ---------------------------------------------------------------------------

type SellRow = { uid: string; name: string; level: number; quality: QualityId; slot: Slot; locked: boolean; price: number };
type SellItem = { id: string; name: string; count: number; each: number };
type Stock = {
  refreshIn: number;
  sell: { gear: SellRow[]; items: SellItem[] };
  gear: { uid: string; name: string; level: number; quality: QualityId; price: number; type?: string }[];
  items: { id: string; name: string; price: number; count?: number }[];
  enchants: { id: string; name: string; price: number; about?: string }[];
  spirits: { id: string; name: string; price: number; level?: number }[];
};
type BmGame = TurbzGame & { blackMarketSnap?: () => Stock | null; ensureBlackMarket?: (f?: boolean) => void; buyEnchant?: (id: string) => void; buySpirit?: (id: string) => void };

export function BlackMarket({ snap, game }: Props) {
  const g = game as BmGame | null;
  const [cat, setCat] = useState<"sell" | "items" | "gear" | "enchants" | "spirits">("sell");
  const [stock, setStock] = useState<Stock | null>(null);
  const pull = useCallback(() => setStock(g?.blackMarketSnap?.() ?? null), [g]);
  useEffect(() => {
    pull();
    const id = window.setInterval(pull, 1000);
    return () => window.clearInterval(id);
  }, [pull]);
  // Re-read the stall the moment the bag changes (a sale or a purchase).
  useEffect(pull, [snap.gear, snap.bag, snap.kyo, pull]);
  const act = (fn: () => void) => () => {
    fn();
    pull();
  };
  const secs = stock?.refreshIn ?? 0;
  const tabs = ["sell", "gear", "items", "enchants", "spirits"] as const;
  return (
    <div className="grid gap-2">
      <div className="bag-head">
        <p className="font-display text-xs text-blood">BLACK MARKET</p>
        <span className="bag-kyo">{snap.kyo.toLocaleString()} kyo</span>
      </div>
      <p className="text-dim">Sell anything here. Stock refreshes in {Math.floor(secs / 60)}:{String(Math.floor(secs % 60)).padStart(2, "0")}; gear on the stall starts at your level.</p>
      <div className="bm-tabs">
        {tabs.map((c) => (
          <button key={c} type="button" className={`px-btn ui-btn-sm capitalize ${cat === c ? "px-btn-kyo" : ""}`} onClick={() => setCat(c)}>
            {c === "sell" ? "Sell" : `Buy ${c}`}
          </button>
        ))}
      </div>

      {cat === "sell" && (
        <div className="grid gap-2">
          <SellAllBar snap={snap} game={game} />
          <p className="font-display text-[9px] text-kyo">SPARE GEAR · {stock?.sell.gear.length ?? 0}</p>
          {stock?.sell.gear.length ? (
            <div className="bm-list">
              {[...stock.sell.gear].sort((a, b) => b.price - a.price).map((row) => (
                <div key={row.uid} className={`bm-row q-${row.quality}`}>
                  <span className="bm-row-name">
                    {row.name}
                    <span className="block text-dim">Lv {row.level} · {SLOT_LABEL[row.slot]} · {QUALITY_LABEL[row.quality]}</span>
                  </span>
                  {row.locked ? (
                    <button type="button" className="px-btn ui-btn-sm" onClick={act(() => game?.toggleLock(row.uid))}>Unlock</button>
                  ) : (
                    <button type="button" className="px-btn px-btn-kyo ui-btn-sm" onClick={act(() => game?.sell(row.uid))}>Sell {row.price}</button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-dim">No spare gear. Worn pieces cannot be sold.</p>
          )}
          <p className="font-display text-[9px] text-kyo">BAG ITEMS · {stock?.sell.items.length ?? 0}</p>
          {stock?.sell.items.length ? (
            <div className="bm-list">
              {stock.sell.items.map((it) => (
                <div key={it.id} className="bm-row">
                  <span className="bm-row-name">
                    {it.name} <span className="text-kyo">×{it.count}</span>
                    <span className="block text-dim">{it.each} kyo each</span>
                  </span>
                  <span className="bm-row-actions">
                    <button type="button" className="px-btn ui-btn-sm" onClick={act(() => game?.sellItem(it.id, 1))}>Sell 1</button>
                    <button type="button" className="px-btn px-btn-kyo ui-btn-sm" onClick={act(() => game?.sellItem(it.id, Infinity))}>All · {it.each * it.count}</button>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-dim">Nothing in the bag to sell.</p>
          )}
        </div>
      )}

      {cat === "gear" && (
        <div className="bm-list">
          {stock?.gear.length ? stock.gear.map((row) => (
            <div key={row.uid} className={`bm-row q-${row.quality}`}>
              <span className="bm-row-name">{row.name}<span className="block text-dim">Lv {row.level} · {QUALITY_LABEL[row.quality] ?? row.quality}</span></span>
              <button type="button" className="px-btn ui-btn-sm" disabled={snap.kyo < row.price} onClick={act(() => game?.buyGear?.(row.uid))}>{row.price} kyo</button>
            </div>
          )) : <p className="text-dim">No gear this cycle. Wait for refresh.</p>}
        </div>
      )}
      {cat === "items" && (
        <div className="bm-list">
          {stock?.items.length ? stock.items.map((it) => (
            <div key={it.id} className="bm-row">
              <span className="bm-row-name">{it.name}{it.count ? ` ×${it.count}` : ""}</span>
              <button type="button" className="px-btn ui-btn-sm" disabled={snap.kyo < it.price} onClick={act(() => game?.buyItem?.(it.id))}>{it.price} kyo</button>
            </div>
          )) : <p className="text-dim">No items this cycle.</p>}
        </div>
      )}
      {cat === "enchants" && (
        <div className="bm-list">
          {stock?.enchants.length ? stock.enchants.map((e) => (
            <div key={e.id} className="bm-row">
              <span className="bm-row-name">{e.name}{e.about ? <span className="block text-dim">{e.about}</span> : null}</span>
              <button type="button" className="px-btn ui-btn-sm" disabled={snap.kyo < e.price} onClick={act(() => g?.buyEnchant?.(e.id))}>{e.price} kyo</button>
            </div>
          )) : <p className="text-dim">No enchants this cycle.</p>}
        </div>
      )}
      {cat === "spirits" && (
        <div className="bm-list">
          {stock?.spirits.length ? stock.spirits.map((sp) => (
            <div key={sp.id} className="bm-row">
              <span className="bm-row-name">{sp.name}{sp.level != null ? <span className="text-dim"> · lv {sp.level}</span> : null}</span>
              <button type="button" className="px-btn ui-btn-sm" disabled={snap.kyo < sp.price} onClick={act(() => g?.buySpirit?.(sp.id))}>{sp.price} kyo</button>
            </div>
          )) : <p className="text-dim">No spirits this cycle.</p>}
        </div>
      )}

    </div>
  );
}

// ---------------------------------------------------------------------------
// Bounty board
// ---------------------------------------------------------------------------

export function BountyBoard({ snap, game }: Props) {
  const h = snap.hunt;
  return (
    <div className="grid gap-2">
      <p className="font-display text-xs text-blood">BOUNTY BOARD</p>
      <p className="text-dim">
        Several marks are posted at once. Each is a playable class above your level, in a full kit, with spirits. You have five minutes to find a mark before it doubles in power and hunts you. Kill one and every kyo and item it carried is yours, then you choose one piece of its gear. A stronger mark is posted in its place.
      </p>
      <div className="grid gap-2">
        {snap.bountyBoard.map((b) => (
          <div key={b.id} className={`bounty-card ${b.active ? "bounty-card-on" : ""}`}>
            <div className="bounty-card-head">
              <span className="font-display text-[10px] text-kyo">TIER {b.tier}</span>
              <span className={b.active ? "text-blood" : "text-dim"}>{b.status}</span>
            </div>
            <p className="bounty-card-name">{b.name} <span className="text-dim">the {b.className}</span></p>
            <p className="text-dim">Level {b.level} · purse about {b.kyo.toLocaleString()} kyo · full bag · pick 1 of 6 gear</p>
            <button type="button" className="px-btn px-btn-kyo mt-1" data-testid={`take-bounty-${b.id}`} disabled={b.active} onClick={() => game?.takeBounty(b.id)}>
              {b.active ? "Being hunted" : "Accept"}
            </button>
          </div>
        ))}
        {!snap.bountyBoard.length && <p className="text-dim">The board is blank out here.</p>}
      </div>
      <div className="bounty-rep">
        <p className="font-display text-[9px] text-kyo">YOUR NAME · {h.kills} bounties · best tier {h.tier}</p>
        {h.starsOn ? (
          <p>
            <span className="bounty-stars" aria-label={`${h.stars} of ${h.need} bounty stars`}>
              {Array.from({ length: h.need }, (_, i) => (i < h.stars ? "★" : "☆")).join("")}
            </span>{" "}
            <span className="text-dim">{h.stars}/{h.need} · kills can earn stars. At {h.need}, hunters come for you.</span>
          </p>
        ) : (
          <p className="text-dim">Take your first bounty and kills start earning Bounty Stars. Ten stars put a price on your own head.</p>
        )}
        {h.wanted > 0 && (
          <div className="grid gap-1">
            <p className="text-blood">
              WANTED · level {h.wanted} · {h.hunters ? `${h.hunters} hunters on you` : `next squad of 5 in ${h.waveIn}s`}
            </p>
            <ConfirmButton
              label={`Clear your name · ${h.clearCost.toLocaleString()} kyo`}
              confirm="Tap again to pay"
              disabled={snap.kyo < h.clearCost}
              onConfirm={() => game?.clearName()}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loot pick (the world is paused while this is open)
// ---------------------------------------------------------------------------

export function LootPicker({ snap, game }: Props) {
  const loot = snap.loot;
  if (!loot) return null;
  return (
    <div className="loot-overlay" role="dialog" aria-modal="true" aria-label="Choose your bounty reward">
      <div className="px-panel loot-panel" data-testid="loot-picker">
        <p className="font-display text-xs text-blood">BOUNTY CLAIMED · GAME PAUSED</p>
        <h2 className="font-display mt-2 text-sm">{loot.title}</h2>
        <p className="mt-2">
          <span className="text-kyo">+{loot.kyo.toLocaleString()} kyo</span>
          {loot.items.length > 0 && <span className="text-dim"> · {loot.items.map((it) => `${it.name} ×${it.count}`).join(" · ")}</span>}
        </p>
        <p className="text-dim">Their kyo and bag are already yours. Choose one piece of gear to keep.</p>
        <div className="loot-grid">
          {loot.gear.map((g, i) => {
            const worn = wornIn(snap, g.slot);
            return (
              <GearCard key={g.uid} snap={snap} g={g}>
                <div className="loot-card-body">
                  <p className="text-dim">{QUALITY_LABEL[g.quality]} · score {gearScore(g)}{worn ? ` · worn: Lv ${worn.level}, score ${gearScore(worn)}` : " · slot empty"}</p>
                  <EnchantList g={g} />
                  <button type="button" className="px-btn px-btn-kyo" data-testid={`loot-pick-${i}`} onClick={() => game?.pickLoot(i)}>
                    Take this
                  </button>
                </div>
              </GearCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loot chest (Hardcore). The world keeps running while this is open.
// ---------------------------------------------------------------------------

export function ChestPanel({ snap, game }: Props) {
  const chest = snap.chest;
  const [pick, setPick] = useState<{ kind: "gear" | "item"; key: string } | null>(null);
  if (!chest) return <p className="text-dim">No chest open. Walk up to a chest and press E, or click it.</p>;
  const take = (kind: "gear" | "item", key: string) => {
    game?.takeFromChest(chest.id, kind, key);
    setPick(null);
  };
  const click = (kind: "gear" | "item", key: string) => (e: React.MouseEvent) => {
    if (e.shiftKey) take(kind, key);
    else setPick(pick?.kind === kind && pick.key === key ? null : { kind, key });
  };
  const gearPick = pick?.kind === "gear" ? chest.gear.find((g) => g.uid === pick.key) ?? null : null;
  const itemPick = pick?.kind === "item" ? chest.items.find((it) => it.id === pick.key) ?? null : null;
  const mm = Math.floor(chest.t / 60);
  const ss = String(chest.t % 60).padStart(2, "0");
  return (
    <div className="ui-stack" data-testid="chest-panel">
      <div className="ui-row">
        <span className="text-kyo">{chest.title}</span>
        <span className={chest.t < 60 ? "text-blood" : "text-dim"}>Gone in {mm}:{ss}</span>
      </div>
      <div className="chest-look" data-testid="chest-look" style={{ ["--chest" as string]: chest.look.color } as React.CSSProperties}>
        <span className="chest-look-dot" />
        <span>{chest.look.label}</span>
        <span className="text-dim">
          {chest.look.gear ? `${chest.look.gear} gear` : "no gear"} · {chest.look.items} item{chest.look.items === 1 ? "" : "s"}
          {chest.look.drops > 1 ? ` · ${chest.look.drops} drops merged` : ""}
        </span>
      </div>
      <p className="text-dim">Click to inspect · Shift+click to take · double-click or Equip to wear it · the game keeps running.{chest.near ? "" : " Walk back to the chest to take things."}</p>
      <div className="gear-actions">
        <button type="button" className="px-btn px-btn-kyo" data-testid="chest-take-all" disabled={!chest.near} onClick={() => game?.takeAllChest(chest.id)}>Take everything</button>
      </div>
      {gearPick && (
        <div className={`gear-detail q-${gearPick.quality}`} data-testid="chest-detail">
          <div className="gear-detail-head">
            <div>
              <p className="gear-card-name">{gearPick.name}</p>
              <p className="text-dim">
                Lv {gearPick.level} · {SLOT_LABEL[gearPick.slot]} · {QUALITY_LABEL[gearPick.quality]} · <span className={`type-${gearPick.type}`}>{TYPES[gearPick.type]?.name ?? gearPick.type}</span> · {statLine(gearPick)} · score {gearScore(gearPick)} <Delta snap={snap} g={gearPick} />
              </p>
              <p className="text-dim">{(() => { const w = wornIn(snap, gearPick.slot); return w ? `You wear: ${w.name}, Lv ${w.level}, score ${gearScore(w)}.` : "Nothing worn in this slot."; })()}</p>
            </div>
            <button type="button" className="float-win-btn" aria-label="Close details" onClick={() => setPick(null)}>×</button>
          </div>
          <EnchantList g={gearPick} />
          <p className="text-dim">{fxLine(gearPick)}</p>
          <div className="gear-actions">
            <button type="button" className="px-btn px-btn-kyo" data-testid="chest-equip" disabled={!chest.near} onClick={() => { game?.equipFromChest(chest.id, gearPick.uid); setPick(null); }}>Equip</button>
            <button type="button" className="px-btn" disabled={!chest.near} onClick={() => take("gear", gearPick.uid)}>Take</button>
          </div>
        </div>
      )}
      {itemPick && (
        <div className="gear-detail" data-testid="chest-detail">
          <div className="gear-detail-head">
            <div>
              <p className="gear-card-name">{itemPick.name} <span className="text-kyo">×{itemPick.count}</span></p>
              <p className="text-dim">{itemPick.about}</p>
            </div>
            <button type="button" className="float-win-btn" aria-label="Close details" onClick={() => setPick(null)}>×</button>
          </div>
          <div className="gear-actions">
            <button type="button" className="px-btn px-btn-kyo" disabled={!chest.near} onClick={() => take("item", itemPick.id)}>Take</button>
          </div>
        </div>
      )}
      {chest.gear.length > 0 && (
        <div className="gear-grid">
          {chest.gear.map((g) => (
            <GearCard key={g.uid} snap={snap} g={g} selected={gearPick?.uid === g.uid} onPick={click("gear", g.uid)} onEquip={() => { game?.equipFromChest(chest.id, g.uid); setPick(null); }} />
          ))}
        </div>
      )}
      {chest.items.length > 0 && (
        <div className="item-grid">
          {chest.items.map((it) => (
            <button key={it.id} type="button" className={`item-card text-left ${itemPick?.id === it.id ? "gear-card-on" : ""}`} onClick={click("item", it.id)}>
              <span className="item-card-name">{it.name} <span className="text-kyo">×{it.count}</span></span>
              <span className="text-dim item-card-about">{it.about}</span>
            </button>
          ))}
        </div>
      )}
      <ChestLegend />
    </div>
  );
}

/** How to read a chest from across the map. Colours come from chest-loot.ts, the same ones the world draws. */
export function ChestLegend() {
  const rows: [string, string, string][] = [
    [SUPPLIES_COLOR, "Supplies", "plain chest, no light: items only"],
    ...CHEST_QUALITIES.map((q): [string, string, string] => [QUALITY_COLOR[q], `${q[0]!.toUpperCase()}${q.slice(1)} gear`, q === "legendary" ? "tallest beam" : "beam of light"]),
    [BOSS_COLOR, "Boss loot", "gold sparkles circle it"],
  ];
  return (
    <details className="chest-legend" data-testid="chest-legend">
      <summary className="text-dim">Reading chests</summary>
      <ul>
        {rows.map(([color, name, how]) => (
          <li key={name} style={{ ["--chest" as string]: color } as React.CSSProperties}>
            <span className="chest-look-dot" />
            <span>{name}</span>
            <span className="text-dim">{how}</span>
          </li>
        ))}
        <li><span className="chest-count">3</span><span>Merged pile</span><span className="text-dim">drops close together share one chest</span></li>
      </ul>
    </details>
  );
}
