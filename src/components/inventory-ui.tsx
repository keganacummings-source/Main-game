import { useCallback, useEffect, useMemo, useState } from "react";
import { ENCHANT_BY_ID, GEAR_PURPOSES, PURPOSE_BY_ID, SET_BY_ID, TYPES, enchantText, equipmentStats, gearPrice, gearPurpose, gearScore, type Gear, type GearPurpose, type QualityId, type Slot, type TypeId } from "@/game/content";
import { gearSellValue } from "@/game/balance";
import { BOSS_COLOR, QUALITY_COLOR, QUALITY_ORDER as CHEST_QUALITIES, SUPPLIES_COLOR } from "@/game/chest-loot";
import { fxGene, fxGeneLabel, fxTrait, fxTraitLabel, geneSeedOf } from "@/game/fx-gene";
import { Chips, ConfirmButton, Section, StatusChips, Tabs, usePref } from "./ui-kit";
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
        {g.setId && SET_BY_ID[g.setId]?.bonus && (
          <span className="gear-card-setbonus text-dim" data-testid="gear-set-bonus">
            Set bonus: {SET_BY_ID[g.setId]!.bonus}
          </span>
        )}
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

/** A one-line row for the list view: everything a card says, in one scan line. */
function GearRow({ snap, g, selected, onPick, onEquip }: { snap: Snap; g: Gear; selected?: boolean; onPick?: () => void; onEquip?: () => void }) {
  const worn = snap.equipped.includes(g.uid);
  const locked = snap.locked.includes(g.uid);
  return (
    <button type="button" className={`gear-row q-${g.quality} ${selected ? "gear-card-on" : ""}`} onClick={onPick} onDoubleClick={onEquip} aria-pressed={selected} title={onEquip ? "Double-click to wear" : undefined}>
      <span className="gear-row-name">{g.name}{worn ? " · WORN" : ""}{locked ? " · 🔒" : ""}</span>
      <span className="text-dim">{SLOT_LABEL[g.slot]}</span>
      <span className="text-dim">Lv {g.level}</span>
      <span className={`type-${g.type}`}>{TYPES[g.type]?.name ?? g.type}</span>
      <span>{statLine(g)}</span>
      <span className="text-dim">{g.enchants.length} ench</span>
      <span className="gear-row-score">{gearScore(g)} <Delta snap={snap} g={g} /></span>
    </button>
  );
}

/** Side by side: the piece you picked against what you wear in that slot, stat by stat and enchant by enchant. */
function CompareTable({ snap, g }: { snap: Snap; g: Gear }) {
  const worn = wornIn(snap, g.slot);
  if (!worn || worn.uid === g.uid) return null;
  const a = equipmentStats(g), b = equipmentStats(worn);
  const rows: { label: string; mine: number; theirs: number; text?: [string, string] }[] = [
    { label: "Score", mine: gearScore(g), theirs: gearScore(worn) },
    { label: "Level", mine: g.level, theirs: worn.level },
    { label: "Quality", mine: QUALITY_ORDER.indexOf(g.quality), theirs: QUALITY_ORDER.indexOf(worn.quality), text: [QUALITY_LABEL[g.quality], QUALITY_LABEL[worn.quality]] },
    g.slot === "weapon" ? { label: "Damage", mine: a.damage ?? 0, theirs: b.damage ?? 0 } : { label: "Armor", mine: a.armor ?? 0, theirs: b.armor ?? 0 },
  ];
  const ids = [...new Set([...g.enchants.map((e) => e.id), ...worn.enchants.map((e) => e.id)])];
  const pow = (x: Gear, id: string) => x.enchants.filter((e) => e.id === id).reduce((n, e) => n + e.power, 0);
  const cls = (d: number) => (d > 0 ? "stat-up" : d < 0 ? "stat-down" : "text-dim");
  return (
    <div className="gear-compare" data-testid="gear-compare">
      <div className="gear-compare-head"><span>Compared with what you wear</span><span>This</span><span>Worn</span><span>±</span></div>
      <p className="gear-compare-worn text-dim">Worn: {worn.name}</p>
      {rows.map((r) => {
        const d = r.mine - r.theirs;
        return (
          <div key={r.label} className="gear-compare-row">
            <span className="text-dim">{r.label}</span><b>{r.text ? r.text[0] : r.mine}</b><span>{r.text ? r.text[1] : r.theirs}</span>
            <span className={cls(d)}>{r.text ? (d > 0 ? "▲" : d < 0 ? "▼" : "=") : d > 0 ? `+${d}` : d}</span>
          </div>
        );
      })}
      {ids.map((id) => {
        const m = pow(g, id), t = pow(worn, id), d = m - t;
        return (
          <div key={id} className="gear-compare-row">
            <span className="text-dim">{ENCHANT_BY_ID[id]?.name ?? id}</span><b>{m || "·"}</b><span>{t || "·"}</span>
            <span className={cls(d)}>{d > 0 ? `+${d}` : d || "="}</span>
          </div>
        );
      })}
    </div>
  );
}

type GroupKey = "none" | "slot" | "quality" | "set" | "element" | "purpose";
type ViewKey = "cards" | "list";
function readPref<T extends string>(key: string, ok: readonly T[], fallback: T): T {
  try { const v = localStorage.getItem(key) as T | null; return v && ok.includes(v) ? v : fallback; } catch { return fallback; }
}
function writePref(key: string, v: string) {
  try { localStorage.setItem(key, v); } catch { /* private mode */ }
}
/** Spare pieces that beat what is worn in their slot, best first per slot. */
function upgradesOf(snap: Snap): Map<string, Gear> {
  const best = new Map<string, Gear>();
  for (const g of snap.gear) {
    if (snap.equipped.includes(g.uid)) continue;
    const worn = wornIn(snap, g.slot);
    const beat = worn ? gearScore(g) > gearScore(worn) : true;
    if (!beat) continue;
    const cur = best.get(g.slot);
    if (!cur || gearScore(g) > gearScore(cur)) best.set(g.slot, g);
  }
  return best;
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
  const [cat, setCat] = usePref("turbz-bag-cat", ["all", "use", "food", "material"] as const, "all");
  const [sort, setSort] = usePref("turbz-bag-sort", ["name", "count", "value", "stack"] as const, "name");
  const [compact, setCompact] = usePref("turbz-bag-view", ["cards", "list"] as const, "cards");
  const term = search.trim().toLowerCase();
  const kindOf = (it: Snap["bag"][number]) => it.kind ?? (it.quickable ? "use" : "material");
  const items = snap.bag
    .filter((it) => (cat === "all" || kindOf(it) === cat) && (!term || it.name.toLowerCase().includes(term) || it.about.toLowerCase().includes(term)))
    .slice()
    .sort((a, b) => sort === "count" ? b.count - a.count : sort === "value" ? (b.sell ?? 0) - (a.sell ?? 0) : sort === "stack" ? (b.sell ?? 0) * b.count - (a.sell ?? 0) * a.count : a.name.localeCompare(b.name));
  const count = (id: string) => snap.bag.find((it) => it.id === id)?.count ?? 0;
  const total = snap.bag.reduce((a, it) => a + it.count, 0);
  const worth = snap.bag.reduce((a, it) => a + (it.sell ?? 0) * it.count, 0);
  const mats = snap.bag.filter((it) => kindOf(it) === "material");
  const matWorth = mats.reduce((a, it) => a + (it.sell ?? 0) * it.count, 0);
  const n = (k: string) => snap.bag.filter((it) => kindOf(it) === k).length;
  return (
    <div className="bag" data-testid="bag-items">
      <div className="bag-head">
        <div className="bag-tabs">
          <span className="font-display text-[9px] text-kyo">ITEMS · {snap.bag.length}</span>
          <button type="button" className="px-btn bag-tab" data-testid="open-gear-btn" onClick={() => game?.toggle("gear")}>Gear inventory (I) · {snap.gear.length}</button>
        </div>
        <span className="bag-kyo">{snap.kyo.toLocaleString()} kyo</span>
      </div>
      <StatusChips items={[
        { label: `${total.toLocaleString()} items · ${snap.bag.length} kinds`, tone: "kyo" },
        { label: `Worth ${worth.toLocaleString()} kyo` },
        snap.quick.length > 0 && { label: `Space: ${snap.quick[0]!.name}`, tone: "on" },
        snap.quickCd > 0 && { label: `Potion cooldown ${snap.quickCd}s`, tone: "bad" },
      ]} />
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
      <div className="menu-toolbar">
        <input className="px-input" aria-label="Search items" placeholder="Search items" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="bag-search" />
        <select className="px-input" aria-label="Sort items" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} data-testid="bag-sort">
          <option value="name">By name</option><option value="count">Most first</option><option value="value">Best price each</option><option value="stack">Most valuable stack</option>
        </select>
        <button type="button" className="px-btn ui-btn-sm" onClick={() => setCompact(compact === "cards" ? "list" : "cards")}>{compact === "cards" ? "List view" : "Card view"}</button>
        {mats.length > 0 && <ConfirmButton className="ui-btn-sm" label={`Sell materials · ${matWorth.toLocaleString()}`} confirm="Tap again" onConfirm={() => { for (const it of mats) game?.sellItem(it.id, Infinity); }} />}
      </div>
      <Chips value={cat} onChange={setCat} label="Item kind" options={[{ id: "all", label: `All ${snap.bag.length}` }, { id: "use", label: `Usable ${n("use")}` }, { id: "food", label: `Food & water ${n("food")}` }, { id: "material", label: `Materials ${n("material")}` }]} />
      {items.length && compact === "list" ? (
        <div className="bm-list" data-testid="bag-list">
          {items.map((it) => (
            <div key={it.id} className="bm-row" data-testid={`item-${it.id}`}>
              <span className="bm-row-name">{it.name} <span className="text-kyo">×{it.count}</span><span className="block text-dim">{it.sell ?? 0} kyo each · {kindOf(it) === "use" ? "usable" : kindOf(it) === "food" ? "food" : "material"}</span></span>
              <span className="bm-row-actions">
                {it.quickable && <button type="button" className="px-btn ui-btn-sm" disabled={!!it.useProblem} title={it.useProblem ?? undefined} onClick={() => game?.useBag(it.id)}>Use</button>}
                <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.sellItem(it.id, 1)}>Sell 1</button>
                <button type="button" className="px-btn ui-btn-sm" onClick={() => game?.sellItem(it.id, Infinity)}>All · {((it.sell ?? 0) * it.count).toLocaleString()}</button>
              </span>
            </div>
          ))}
        </div>
      ) : items.length ? (
        <div className="item-grid">
          {items.map((it) => {
            const at = snap.quick.findIndex((q) => q.id === it.id);
            return (
              <div key={it.id} className="item-card" data-testid={`item-${it.id}`}>
                <p className="item-card-name">{it.name} <span className="text-kyo">×{it.count}</span> <span className="text-dim">· {it.sell ?? 0} kyo</span>{at >= 0 && <span className="text-good"> · {at === 0 ? "Space" : `Space queue ${at + 1}`}</span>}</p>
                <p className="text-dim item-card-about">{it.about}</p>
                {it.quickable && it.useProblem && <p className="item-card-problem">{it.useProblem}</p>}
                {it.effect && <p className="item-card-effect">{it.effect}</p>}
                <div className="item-card-actions">
                  {it.quickable && <button type="button" className="px-btn" disabled={!!it.useProblem} onClick={() => game?.useBag(it.id)}>Use</button>}
                  {it.quickable && at !== 0 && <button type="button" className="px-btn" data-testid={`set-space-${it.id}`} onClick={() => game?.setQuick(it.id, "set")}>Set to Space</button>}
                  {it.quickable && at < 0 && snap.quick.length > 0 && <button type="button" className="px-btn" data-testid={`queue-space-${it.id}`} disabled={snap.quick.length >= 3} onClick={() => game?.setQuick(it.id, "queue")}>Queue</button>}
                  <button type="button" className="px-btn" onClick={() => game?.sellItem(it.id, Infinity)}>Sell all · {((it.sell ?? 0) * it.count).toLocaleString()}</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-dim">{term || cat !== "all" ? "No matching items." : "Your bag is empty."}</p>
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
  const [upgradesOnly, setUpgradesOnly] = useState(false);
  const [group, setGroupRaw] = useState<GroupKey>(() => readPref<GroupKey>("turbz-gear-group", ["none", "slot", "quality", "set", "element", "purpose"], "none"));
  const [view, setViewRaw] = useState<ViewKey>(() => readPref<ViewKey>("turbz-gear-view", ["cards", "list"], "cards"));
  const setGroup = (v: GroupKey) => { setGroupRaw(v); writePref("turbz-gear-group", v); };
  const setView = (v: ViewKey) => { setViewRaw(v); writePref("turbz-gear-view", v); };
  const term = search.trim().toLowerCase();
  const upgrades = useMemo(() => upgradesOf(snap), [snap.gear, snap.equipped]);
  const upgradeIds = useMemo(() => new Set([...snap.gear.filter((g) => { const w = wornIn(snap, g.slot); return !snap.equipped.includes(g.uid) && (!w || gearScore(g) > gearScore(w)); }).map((g) => g.uid)]), [snap.gear, snap.equipped]);
  const filtersOn = (term ? 1 : 0) + (slot !== "all" ? 1 : 0) + (purpose !== "all" ? 1 : 0) + (minQ !== "worn" ? 1 : 0) + (element !== "all" ? 1 : 0) + (lockedOnly ? 1 : 0) + (upgradesOnly ? 1 : 0);
  const clearFilters = () => { setSearch(""); setSlot("all"); setPurpose("all"); setMinQ("worn"); setElement("all"); setLockedOnly(false); setUpgradesOnly(false); };
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
      && QUALITY_ORDER.indexOf(g.quality) >= qMin && (element === "all" || g.type === element) && (!lockedOnly || snap.locked.includes(g.uid)) && (!upgradesOnly || upgradeIds.has(g.uid)) && (!term || text(g).includes(term)));
    const by: Record<SortKey, (a: Gear, b: Gear) => number> = {
      score: (a, b) => gearScore(b) - gearScore(a),
      level: (a, b) => b.level - a.level,
      quality: (a, b) => QUALITY_ORDER.indexOf(b.quality) - QUALITY_ORDER.indexOf(a.quality) || b.level - a.level,
      price: (a, b) => gearPrice(b) - gearPrice(a),
      new: (a, b) => (order.get(b.uid) ?? 0) - (order.get(a.uid) ?? 0),
      purpose: (a, b) => purposePower(b, purpose === "all" ? gearPurpose(b) : purpose) - purposePower(a, purpose === "all" ? gearPurpose(a) : purpose),
    };
    return list.sort(by[sort]);
  }, [snap.gear, snap.equipped, snap.locked, slot, purpose, minQ, element, lockedOnly, upgradesOnly, upgradeIds, sort, term, showWorn, order]);
  /** The filtered list cut into labelled groups (one unnamed group when grouping is off). */
  const groups = useMemo(() => {
    if (group === "none") return [{ key: "all", label: "", list: gear }];
    const keyOf = (g: Gear): [string, string, number] => {
      if (group === "slot") return [g.slot, SLOT_LABEL[g.slot], SLOTS.indexOf(g.slot)];
      if (group === "quality") return [g.quality, QUALITY_LABEL[g.quality], -QUALITY_ORDER.indexOf(g.quality)];
      if (group === "element") return [g.type, TYPES[g.type]?.name ?? g.type, 0];
      if (group === "purpose") { const p = gearPurpose(g); return [p, `${PURPOSE_ICON[p]} ${PURPOSE_BY_ID[p].name}`, GEAR_PURPOSES.findIndex((x) => x.id === p)]; }
      const set = g.setId ? SET_BY_ID[g.setId] : null;
      return set ? [g.setId!, set.name, 0] : ["~none", "No set", 1];
    };
    const m = new Map<string, { key: string; label: string; rank: number; list: Gear[] }>();
    for (const g of gear) {
      const [key, label, rank] = keyOf(g);
      if (!m.has(key)) m.set(key, { key, label, rank, list: [] });
      m.get(key)!.list.push(g);
    }
    return [...m.values()].sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label));
  }, [gear, group]);
  const wornList = SLOTS.map((sl) => wornIn(snap, sl)).filter((g): g is Gear => !!g);
  const wornTotals = {
    score: wornList.reduce((n, g) => n + gearScore(g), 0),
    damage: wornList.reduce((n, g) => n + (equipmentStats(g).damage ?? 0), 0),
    armor: wornList.reduce((n, g) => n + (equipmentStats(g).armor ?? 0), 0),
    level: wornList.length ? Math.round(wornList.reduce((n, g) => n + g.level, 0) / wornList.length) : 0,
    enchants: wornList.reduce((n, g) => n + g.enchants.length, 0),
  };
  const wearUpgrades = () => { for (const g of upgrades.values()) game?.equip(g.uid); };
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
        {snap.turbz && (
          <label className={`chip chip-check ${snap.autoEquip ? "chip-on" : ""}`} title="When on, a pickup that beats what you wear is equipped automatically. When off, pickups wait in your bag to wear yourself.">
            <input type="checkbox" checked={snap.autoEquip} onChange={(e) => game?.toggleAutoEquip(e.target.checked)} data-testid="toggle-autoequip" />
            Auto-equip
          </label>
        )}
      </div>

      <div className="bag-body">
        <aside className="bag-worn" aria-label="Equipped">
          <p className="font-display text-[9px] text-kyo">WORN · {snap.setLabel}</p>
          <div className="worn-totals" data-testid="worn-totals">
            <span><b>{wornTotals.score}</b> score</span>
            <span><b>{wornTotals.damage}</b> damage</span>
            <span><b>{wornTotals.armor}</b> armor</span>
            <span><b>{wornTotals.level || "–"}</b> avg lv</span>
            <span><b>{wornTotals.enchants}</b> enchants</span>
          </div>
          {snap.setBonus && <p className="set-bonus-active" data-testid="worn-set-bonus"><span className="text-kyo">Set bonus:</span> {snap.setBonus}</p>}
          <div className="worn-grid">
            {SLOTS.map((s) => {
              const g = wornIn(snap, s);
              return (
                <button key={s} type="button" className={`worn-slot ${g ? `q-${g.quality}` : ""} ${g && snap.selected === g.uid ? "gear-card-on" : ""}`} onClick={() => g && game?.select(g.uid)} disabled={!g}>
                  <span className="worn-slot-label">{SLOT_LABEL[s]}{upgrades.has(s) && <span className="stat-up" title={`Upgrade in your bag: ${upgrades.get(s)!.name}`}> ▲</span>}</span>
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
                {snap.setProgress.map((row) => {
                  const def = SET_BY_ID[row.id];
                  return (
                    <div key={row.id} className="set-progress-row">
                      <span className="set-progress-name">
                        <span>{row.name}</span>
                        {def?.bonus && <span className="text-dim set-progress-bonus">· {def.bonus}</span>}
                      </span>
                      <span className="set-progress-pips">
                        {(["head", "chest", "legs", "feet", "relic"] as const).map((sl) => (
                          <i key={sl} title={SLOT_LABEL[sl]} className={row.slots.includes(sl) ? "on" : ""} />
                        ))}
                      </span>
                      <span className={row.have >= 5 ? "text-kyo" : "text-dim"}>{row.have >= 5 ? "Unlocked" : `${row.have}/5`}</span>
                    </div>
                  );
                })}
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
              <CompareTable snap={snap} g={selected} />
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
              <div className="bag-toolbar gear-toolbar-2">
                <select className="px-input" aria-label="Group gear" value={group} onChange={(e) => setGroup(e.target.value as GroupKey)} data-testid="gear-group">
                  <option value="none">No grouping</option>
                  <option value="slot">Group by slot</option>
                  <option value="quality">Group by quality</option>
                  <option value="set">Group by set</option>
                  <option value="element">Group by element</option>
                  <option value="purpose">Group by use</option>
                </select>
                <Tabs value={view} onChange={setView} label="Gear view" tabs={[{ id: "cards", label: "Cards" }, { id: "list", label: "List", testid: "gear-view-list" }]} />
              </div>
              {upgrades.size > 0 && (
                <div className="gear-upgrades" data-testid="gear-upgrades">
                  <span className="stat-up">▲ {upgrades.size} upgrade{upgrades.size === 1 ? "" : "s"} in your bag: {[...upgrades.values()].map((g) => SLOT_LABEL[g.slot]).join(", ")}</span>
                  <button type="button" className="px-btn px-btn-kyo ui-btn-sm" data-testid="wear-upgrades" onClick={wearUpgrades}>Wear all upgrades</button>
                </div>
              )}
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
                <label className={`chip chip-check ${upgradesOnly ? "chip-on" : ""}`} data-testid="gear-upgrades-only">
                  <input type="checkbox" checked={upgradesOnly} onChange={(e) => setUpgradesOnly(e.target.checked)} /> Upgrades only · {upgradeIds.size}
                </label>
                {filtersOn > 0 && <button type="button" className="chip" data-testid="gear-clear-filters" onClick={clearFilters}>✕ Clear {filtersOn} filter{filtersOn === 1 ? "" : "s"}</button>}
              </div>
              <SellAllBar snap={snap} game={game} />
              <p className="text-dim">Showing {gear.length} of {showWorn ? snap.gear.length : spare.length}. Click a piece to read and compare it. Double-click to wear it.</p>
              {gear.length ? (
                groups.map((grp) => (
                  <div key={grp.key} className="gear-group">
                    {grp.label && <p className="gear-group-head"><span>{grp.label}</span><span className="text-dim">{grp.list.length}</span></p>}
                    {view === "list" ? (
                      <div className="gear-list" data-testid="gear-list">
                        {grp.list.map((g) => (
                          <GearRow key={g.uid} snap={snap} g={g} selected={snap.selected === g.uid} onPick={() => game?.select(g.uid)} onEquip={() => { if (!snap.equipped.includes(g.uid)) game?.equip(g.uid); }} />
                        ))}
                      </div>
                    ) : (
                      <div className="gear-grid">
                        {grp.list.map((g) => (
                          <GearCard key={g.uid} snap={snap} g={g} selected={snap.selected === g.uid} onPick={() => game?.select(g.uid)} onEquip={() => { if (!snap.equipped.includes(g.uid)) game?.equip(g.uid); }} />
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-dim">{filtersOn ? "No gear matches these filters." : "No spare gear. Everything you own is being worn."}</p>
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

type SellRow = { uid: string; name: string; level: number; quality: QualityId; slot: Slot; locked: boolean; price: number; delta?: number };
type SellItem = { id: string; name: string; count: number; each: number };
type Stock = {
  refreshIn: number;
  restockCost?: number;
  buyback?: { uid: string; name: string; level: number; quality: QualityId; slot: Slot; price: number }[];
  sell: { gear: SellRow[]; items: SellItem[] };
  gear: { uid: string; name: string; level: number; quality: QualityId; price: number; type?: string; slot?: Slot; enchants?: number; delta?: number }[];
  items: { id: string; name: string; price: number; count?: number }[];
  enchants: { id: string; name: string; price: number; about?: string; power?: number }[];
  spirits: { id: string; name: string; price: number; level?: number }[];
};
type BmGame = TurbzGame & {
  blackMarketSnap?: () => Stock | null; ensureBlackMarket?: (f?: boolean) => void; buyEnchant?: (id: string) => void; buySpirit?: (id: string) => void;
  restockBlackMarket?: () => void; buyBack?: (uid: string) => void;
};
const BM_TABS = ["sell", "gear", "items", "enchants", "spirits", "buyback"] as const;
type BmTab = (typeof BM_TABS)[number];

type MarketRow = { price: number; name: string; level?: number; delta?: number };
function marketOrder<T extends MarketRow>(list: T[], sort: string): T[] {
  return list.slice().sort((a, b) =>
    sort === "cheap" ? a.price - b.price : sort === "level" ? (b.level ?? 0) - (a.level ?? 0) : sort === "upgrade" ? (b.delta ?? -1e9) - (a.delta ?? -1e9) : sort === "name" ? a.name.localeCompare(b.name) : b.price - a.price);
}
/** ▲ +n / ▼ −n against what you wear in that slot. */
function MarketDelta({ d }: { d?: number }) {
  if (d == null) return null;
  return d > 0 ? <span className="text-good"> ▲ +{d}</span> : d < 0 ? <span className="text-bad"> ▼ {d}</span> : <span className="text-dim"> = worn</span>;
}

export function BlackMarket({ snap, game }: Props) {
  const g = game as BmGame | null;
  const [cat, setCat] = usePref<BmTab>("turbz-bm-tab", BM_TABS, "sell");
  const [stock, setStock] = useState<Stock | null>(null);
  const [q, setQ] = useState("");
  const [slot, setSlot] = useState<Slot | "all">("all");
  const [minQ, setMinQ] = useState<QualityId | "all">("all");
  const [sort, setSort] = usePref("turbz-bm-sort", ["price", "cheap", "level", "upgrade", "name"] as const, "price");
  const [afford, setAfford] = useState(false);
  const pull = useCallback(() => setStock(g?.blackMarketSnap?.() ?? null), [g]);
  useEffect(() => {
    pull();
    const id = window.setInterval(pull, 1000);
    return () => window.clearInterval(id);
  }, [pull]);
  // Re-read the stall the moment the bag changes (a sale or a purchase).
  useEffect(pull, [snap.gear, snap.bag, snap.kyo, pull]);
  const act = (fn: () => void) => () => { fn(); pull(); };
  const secs = stock?.refreshIn ?? 0;
  const term = q.trim().toLowerCase();
  const textOk = (name: string, extra = "") => !term || `${name} ${extra}`.toLowerCase().includes(term);
  const gearOk = (r: { name: string; slot?: Slot; quality: QualityId; price: number }) =>
    textOk(r.name) && (slot === "all" || r.slot === slot) && (minQ === "all" || QUALITY_ORDER.indexOf(r.quality) >= QUALITY_ORDER.indexOf(minQ)) && (!afford || cat === "sell" || snap.kyo >= r.price);
  const sellGear = marketOrder((stock?.sell.gear ?? []).filter((r) => gearOk(r)), sort);
  const buyGear = marketOrder((stock?.gear ?? []).filter((r) => gearOk(r)), sort);
  const upgrades = (stock?.gear ?? []).filter((r) => (r.delta ?? 0) > 0).length;
  const itemsWorth = (stock?.sell.items ?? []).reduce((a, it) => a + it.each * it.count, 0);
  const label: Record<BmTab, string> = {
    sell: `Sell · ${stock?.sell.gear.length ?? 0}`, gear: `Gear · ${stock?.gear.length ?? 0}${upgrades ? ` ▲${upgrades}` : ""}`, items: `Items · ${stock?.items.length ?? 0}`,
    enchants: `Enchants · ${stock?.enchants.length ?? 0}`, spirits: `Spirits · ${stock?.spirits.length ?? 0}`, buyback: `Buyback · ${stock?.buyback?.length ?? 0}`,
  };
  const gearFilters = cat === "sell" || cat === "gear";
  return (
    <div className="ui-stack" data-testid="black-market">
      <div className="bag-head">
        <p className="font-display text-xs text-blood">BLACK MARKET</p>
        <span className="bag-kyo">{snap.kyo.toLocaleString()} kyo</span>
      </div>
      <StatusChips items={[
        { label: `Restock in ${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}` },
        upgrades > 0 && { label: `${upgrades} upgrade${upgrades === 1 ? "" : "s"} on the stall`, tone: "on" },
        { label: `Sell rate ×${(snap.sellMult ?? 1).toFixed(2)}`, tone: "kyo" },
      ]} />
      <div className="ui-row-gap">
        <ConfirmButton className="ui-btn-sm" label={`Restock now · ${(stock?.restockCost ?? 0).toLocaleString()} kyo`} confirm="Tap again to pay" disabled={snap.kyo < (stock?.restockCost ?? Infinity)} onConfirm={act(() => g?.restockBlackMarket?.())} />
        <span className="text-dim">Stall gear starts at your level and shows ▲ when it beats what you wear. Sold gear can be bought back until the next restock.</span>
      </div>
      <Tabs value={cat} onChange={setCat} label="Market sections" tabs={BM_TABS.map((t) => ({ id: t, label: label[t], testid: `bm-tab-${t}` }))} />
      <div className="menu-toolbar">
        <input className="px-input" aria-label="Search the market" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} data-testid="bm-search" />
        <select className="px-input" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="price">Priciest first</option><option value="cheap">Cheapest first</option><option value="level">Highest level</option><option value="upgrade">Biggest upgrade</option><option value="name">By name</option>
        </select>
        {gearFilters && (
          <>
            <select className="px-input" aria-label="Slot" value={slot} onChange={(e) => setSlot(e.target.value as Slot | "all")}>
              <option value="all">Any slot</option>
              {(Object.keys(SLOT_LABEL) as Slot[]).map((sl) => <option key={sl} value={sl}>{SLOT_LABEL[sl]}</option>)}
            </select>
            <select className="px-input" aria-label="Quality at least" value={minQ} onChange={(e) => setMinQ(e.target.value as QualityId | "all")}>
              <option value="all">Any quality</option>
              {QUALITY_ORDER.map((qq) => <option key={qq} value={qq}>{QUALITY_LABEL[qq]}+</option>)}
            </select>
          </>
        )}
        {cat !== "sell" && <label className="chip chip-check"><input type="checkbox" checked={afford} onChange={(e) => setAfford(e.target.checked)} /> I can afford it</label>}
      </div>

      {cat === "sell" && (
        <div className="ui-stack">
          <SellAllBar snap={snap} game={game} />
          <Section title={`SPARE GEAR · ${sellGear.length}`}>
            {sellGear.length ? (
              <div className="bm-list">
                {sellGear.map((row) => (
                  <div key={row.uid} className={`bm-row q-${row.quality}`}>
                    <span className="bm-row-name">
                      {row.name}<MarketDelta d={row.delta} />
                      <span className="block text-dim">Lv {row.level} · {SLOT_LABEL[row.slot]} · {QUALITY_LABEL[row.quality]}</span>
                    </span>
                    {row.locked
                      ? <button type="button" className="px-btn ui-btn-sm" onClick={act(() => game?.toggleLock(row.uid))}>Unlock</button>
                      : <button type="button" className="px-btn px-btn-kyo ui-btn-sm" onClick={act(() => game?.sell(row.uid))}>Sell {row.price.toLocaleString()}</button>}
                  </div>
                ))}
              </div>
            ) : <p className="text-dim">{stock?.sell.gear.length ? "No spare gear matches." : "No spare gear. Worn pieces cannot be sold."}</p>}
          </Section>
          <Section title={`BAG ITEMS · ${stock?.sell.items.length ?? 0}`} right={itemsWorth > 0 && <span className="text-dim">worth {itemsWorth.toLocaleString()}</span>}>
            {stock?.sell.items.filter((it) => textOk(it.name)).length ? (
              <div className="bm-list">
                {marketOrder(stock.sell.items.filter((it) => textOk(it.name)).map((it) => ({ ...it, price: it.each * it.count })), sort).map((it) => (
                  <div key={it.id} className="bm-row">
                    <span className="bm-row-name">{it.name} <span className="text-kyo">×{it.count}</span><span className="block text-dim">{it.each} kyo each</span></span>
                    <span className="bm-row-actions">
                      <button type="button" className="px-btn ui-btn-sm" onClick={act(() => game?.sellItem(it.id, 1))}>Sell 1</button>
                      <button type="button" className="px-btn px-btn-kyo ui-btn-sm" onClick={act(() => game?.sellItem(it.id, Infinity))}>All · {(it.each * it.count).toLocaleString()}</button>
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className="text-dim">Nothing in the bag to sell.</p>}
          </Section>
        </div>
      )}

      {cat === "gear" && (
        <div className="bm-list">
          {buyGear.length ? buyGear.map((row) => (
            <div key={row.uid} className={`bm-row q-${row.quality}`}>
              <span className="bm-row-name">{row.name}<MarketDelta d={row.delta} /><span className="block text-dim">Lv {row.level} · {row.slot ? SLOT_LABEL[row.slot] : ""} · {QUALITY_LABEL[row.quality] ?? row.quality}{row.type ? ` · ${row.type}` : ""}{row.enchants ? ` · ${row.enchants} enchant${row.enchants === 1 ? "" : "s"}` : ""}</span></span>
              <button type="button" className="px-btn ui-btn-sm" disabled={snap.kyo < row.price} onClick={act(() => game?.buyGear?.(row.uid))}>{row.price.toLocaleString()} kyo</button>
            </div>
          )) : <p className="text-dim">{stock?.gear.length ? "No stall gear matches." : "No gear this cycle. Wait for the restock."}</p>}
        </div>
      )}
      {cat === "items" && (
        <div className="bm-list">
          {stock?.items.filter((it) => textOk(it.name) && (!afford || snap.kyo >= it.price)).length ? marketOrder(stock.items.filter((it) => textOk(it.name) && (!afford || snap.kyo >= it.price)), sort).map((it) => (
            <div key={it.id} className="bm-row">
              <span className="bm-row-name">{it.name}{it.count ? ` ×${it.count}` : ""}</span>
              <button type="button" className="px-btn ui-btn-sm" disabled={snap.kyo < it.price} onClick={act(() => game?.buyItem?.(it.id))}>{it.price.toLocaleString()} kyo</button>
            </div>
          )) : <p className="text-dim">No items match this cycle.</p>}
        </div>
      )}
      {cat === "enchants" && (
        <div className="bm-list">
          {stock?.enchants.filter((e) => textOk(e.name, e.about) && (!afford || snap.kyo >= e.price)).length ? marketOrder(stock.enchants.filter((e) => textOk(e.name, e.about) && (!afford || snap.kyo >= e.price)), sort).map((e) => (
            <div key={e.id} className="bm-row">
              <span className="bm-row-name">{e.name}{e.power ? <span className="text-kyo"> · power {e.power}</span> : null}{e.about ? <span className="block text-dim">{e.about}</span> : null}</span>
              <button type="button" className="px-btn ui-btn-sm" disabled={snap.kyo < e.price} onClick={act(() => g?.buyEnchant?.(e.id))}>{e.price.toLocaleString()} kyo</button>
            </div>
          )) : <p className="text-dim">No enchants match this cycle.</p>}
          <p className="text-dim">Bought enchantments go to your stash (Gear → Stash) to apply to any piece.</p>
        </div>
      )}
      {cat === "spirits" && (
        <div className="bm-list">
          {stock?.spirits.filter((sp) => textOk(sp.name) && (!afford || snap.kyo >= sp.price)).length ? marketOrder(stock.spirits.filter((sp) => textOk(sp.name) && (!afford || snap.kyo >= sp.price)), sort).map((sp) => (
            <div key={sp.id} className="bm-row">
              <span className="bm-row-name">{sp.name}{sp.level != null ? <span className="text-dim"> · lv {sp.level}</span> : null}</span>
              <button type="button" className="px-btn ui-btn-sm" disabled={snap.kyo < sp.price} onClick={act(() => g?.buySpirit?.(sp.id))}>{sp.price.toLocaleString()} kyo</button>
            </div>
          )) : <p className="text-dim">No spirits match this cycle.</p>}
        </div>
      )}
      {cat === "buyback" && (
        <div className="bm-list">
          {stock?.buyback?.filter((r) => textOk(r.name)).length ? stock.buyback.filter((r) => textOk(r.name)).map((row) => (
            <div key={row.uid} className={`bm-row q-${row.quality}`}>
              <span className="bm-row-name">{row.name}<span className="block text-dim">Lv {row.level} · {SLOT_LABEL[row.slot]} · {QUALITY_LABEL[row.quality]}</span></span>
              <button type="button" className="px-btn ui-btn-sm" disabled={snap.kyo < row.price} onClick={act(() => g?.buyBack?.(row.uid))}>Buy back · {row.price.toLocaleString()}</button>
            </div>
          )) : <p className="text-dim">Nothing to buy back. Gear you sell shows up here until the next restock (the last 10 pieces).</p>}
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
