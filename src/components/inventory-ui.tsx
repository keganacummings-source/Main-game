import { useCallback, useEffect, useMemo, useState } from "react";
import { ENCHANT_BY_ID, TYPES, enchantText, equipmentStats, gearPrice, gearScore, type Gear, type QualityId, type Slot } from "@/game/content";
import { gearSellValue } from "@/game/balance";
import { fxGene, fxGeneLabel, geneSeedOf } from "@/game/fx-gene";
import { ConfirmButton } from "./ui-kit";
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

function GearCard({ snap, g, selected, onPick, children }: { snap: Snap; g: Gear; selected?: boolean; onPick?: () => void; children?: React.ReactNode }) {
  const worn = snap.equipped.includes(g.uid);
  const locked = snap.locked.includes(g.uid);
  return (
    <div className={`gear-card q-${g.quality} ${selected ? "gear-card-on" : ""}`}>
      <button type="button" className="gear-card-main" onClick={onPick} aria-pressed={selected}>
        <span className="gear-card-name">{g.name}</span>
        <span className="gear-card-meta">
          Lv {g.level} · {SLOT_LABEL[g.slot]} · <span className={`type-${g.type}`}>{TYPES[g.type]?.name ?? g.type}</span>
        </span>
        <span className="gear-card-meta">
          {statLine(g)} · {g.enchants.length} ench <Delta snap={snap} g={g} />
        </span>
        <span className="gear-card-tags">
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

type BagTab = "gear" | "items" | "stash";
type SortKey = "score" | "level" | "quality" | "price" | "new";

export function Bag({ snap, game }: Props) {
  const [tab, setTab] = useState<BagTab>("gear");
  const [slot, setSlot] = useState<Slot | "all">("all");
  const [sort, setSort] = useState<SortKey>("score");
  const [search, setSearch] = useState("");
  const [showWorn, setShowWorn] = useState(false);
  const term = search.trim().toLowerCase();
  const order = useMemo(() => new Map(snap.gear.map((g, i) => [g.uid, i])), [snap.gear]);
  const spare = snap.gear.filter((g) => !snap.equipped.includes(g.uid));
  const gear = useMemo(() => {
    const list = snap.gear.filter((g) => (showWorn || !snap.equipped.includes(g.uid)) && (slot === "all" || g.slot === slot) && (!term || `${g.name} ${g.slot} ${g.quality} ${g.type}`.toLowerCase().includes(term)));
    const by: Record<SortKey, (a: Gear, b: Gear) => number> = {
      score: (a, b) => gearScore(b) - gearScore(a),
      level: (a, b) => b.level - a.level,
      quality: (a, b) => QUALITY_ORDER.indexOf(b.quality) - QUALITY_ORDER.indexOf(a.quality) || b.level - a.level,
      price: (a, b) => gearPrice(b) - gearPrice(a),
      new: (a, b) => (order.get(b.uid) ?? 0) - (order.get(a.uid) ?? 0),
    };
    return list.sort(by[sort]);
  }, [snap.gear, snap.equipped, slot, sort, term, showWorn, order]);
  const items = snap.bag.filter((it) => !term || it.name.toLowerCase().includes(term));
  const selected = snap.gear.find((g) => g.uid === snap.selected) ?? null;
  const count = (id: string) => snap.bag.find((it) => it.id === id)?.count ?? 0;

  return (
    <div className="bag">
      <div className="bag-head">
        <div className="bag-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "gear"} className={`px-btn bag-tab ${tab === "gear" ? "px-btn-kyo" : ""}`} onClick={() => setTab("gear")}>Gear · {spare.length}</button>
          <button type="button" role="tab" aria-selected={tab === "items"} className={`px-btn bag-tab ${tab === "items" ? "px-btn-kyo" : ""}`} onClick={() => setTab("items")}>Items · {snap.bag.length}</button>
          <button type="button" role="tab" aria-selected={tab === "stash"} className={`px-btn bag-tab ${tab === "stash" ? "px-btn-kyo" : ""}`} onClick={() => setTab("stash")}>Enchants · {snap.stash.length}</button>
        </div>
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
                <input className="px-input" aria-label="Search gear" placeholder="Search name, type, quality" value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="px-input" aria-label="Sort gear" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                  <option value="score">Best first</option>
                  <option value="level">Level</option>
                  <option value="quality">Quality</option>
                  <option value="price">Sell price</option>
                  <option value="new">Newest</option>
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
              </div>
              <SellAllBar snap={snap} game={game} />
              {gear.length ? (
                <div className="gear-grid">
                  {gear.map((g) => (
                    <GearCard key={g.uid} snap={snap} g={g} selected={snap.selected === g.uid} onPick={() => game?.select(snap.selected === g.uid ? null : g.uid)} />
                  ))}
                </div>
              ) : (
                <p className="text-dim">{term || slot !== "all" ? "No gear matches." : "No spare gear. Everything you own is being worn."}</p>
              )}
            </>
          )}

          {tab === "items" && (
            <>
              <div className="bag-toolbar bag-toolbar-1">
                <input className="px-input" aria-label="Search items" placeholder="Search items" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {items.length ? (
                <div className="item-grid">
                  {items.map((it) => (
                    <div key={it.id} className="item-card">
                      <p className="item-card-name">{it.name} <span className="text-kyo">×{it.count}</span></p>
                      <p className="text-dim item-card-about">{it.useProblem ?? it.about}</p>
                      <div className="item-card-actions">
                        <button type="button" className="px-btn" disabled={!!it.useProblem} onClick={() => game?.useBag(it.id)}>Use</button>
                        <button type="button" className="px-btn" onClick={() => game?.sellItem(it.id, Infinity)}>Sell all</button>
                      </div>
                    </div>
                  ))}
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
            </>
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
          <button key={c} type="button" className={`px-btn !min-h-9 !py-1 capitalize ${cat === c ? "px-btn-kyo" : ""}`} onClick={() => setCat(c)}>
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
                    <button type="button" className="px-btn !min-h-9 !py-1" onClick={act(() => game?.toggleLock(row.uid))}>Unlock</button>
                  ) : (
                    <button type="button" className="px-btn px-btn-kyo !min-h-9 !py-1" onClick={act(() => game?.sell(row.uid))}>Sell {row.price}</button>
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
                    <button type="button" className="px-btn !min-h-9 !py-1" onClick={act(() => game?.sellItem(it.id, 1))}>Sell 1</button>
                    <button type="button" className="px-btn px-btn-kyo !min-h-9 !py-1" onClick={act(() => game?.sellItem(it.id, Infinity))}>All · {it.each * it.count}</button>
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
              <button type="button" className="px-btn !min-h-9 !py-1" disabled={snap.kyo < row.price} onClick={act(() => game?.buyGear?.(row.uid))}>{row.price} kyo</button>
            </div>
          )) : <p className="text-dim">No gear this cycle. Wait for refresh.</p>}
        </div>
      )}
      {cat === "items" && (
        <div className="bm-list">
          {stock?.items.length ? stock.items.map((it) => (
            <div key={it.id} className="bm-row">
              <span className="bm-row-name">{it.name}{it.count ? ` ×${it.count}` : ""}</span>
              <button type="button" className="px-btn !min-h-9 !py-1" disabled={snap.kyo < it.price} onClick={act(() => game?.buyItem?.(it.id))}>{it.price} kyo</button>
            </div>
          )) : <p className="text-dim">No items this cycle.</p>}
        </div>
      )}
      {cat === "enchants" && (
        <div className="bm-list">
          {stock?.enchants.length ? stock.enchants.map((e) => (
            <div key={e.id} className="bm-row">
              <span className="bm-row-name">{e.name}{e.about ? <span className="block text-dim">{e.about}</span> : null}</span>
              <button type="button" className="px-btn !min-h-9 !py-1" disabled={snap.kyo < e.price} onClick={act(() => g?.buyEnchant?.(e.id))}>{e.price} kyo</button>
            </div>
          )) : <p className="text-dim">No enchants this cycle.</p>}
        </div>
      )}
      {cat === "spirits" && (
        <div className="bm-list">
          {stock?.spirits.length ? stock.spirits.map((sp) => (
            <div key={sp.id} className="bm-row">
              <span className="bm-row-name">{sp.name}{sp.level != null ? <span className="text-dim"> · lv {sp.level}</span> : null}</span>
              <button type="button" className="px-btn !min-h-9 !py-1" disabled={snap.kyo < sp.price} onClick={act(() => g?.buySpirit?.(sp.id))}>{sp.price} kyo</button>
            </div>
          )) : <p className="text-dim">No spirits this cycle.</p>}
        </div>
      )}

      {snap.trade && (
        <div className="mt-3 grid gap-2 border-t-2 border-bone pt-2">
          <p className="text-dim">Player trade still available if someone is nearby.</p>
          <p>With {snap.trade.peer}</p>
          <p>You offer: {snap.trade.mine}</p>
          <p>They offer: {snap.trade.theirs}</p>
          <button type="button" className="px-btn" onClick={() => game?.offerSelected()}>Offer selected gear</button>
          <button type="button" className="px-btn" onClick={() => game?.lockTrade()}>
            {snap.trade.me ? "Unlock" : "Lock in"}
            {snap.trade.them ? " · they are ready" : ""}
          </button>
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
