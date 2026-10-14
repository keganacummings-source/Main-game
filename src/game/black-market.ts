/** Runtime install: Trade / KeyT open Black Market (no nearby player required). */
import {
  rollGear,
  mulberry32,
  nextUid,
  ITEM_BY_ID,
  ENCHANTS,
  MONSTERS,
  TYPES,
  gearPrice,
  type Gear,
  type Slot,
  type QualityId,
} from "./content";

type BmItem = { id: string; itemId: string; name: string; price: number; count: number };
type BmEnchant = { id: string; enchantId: string; name: string; about: string; price: number };
type BmSpirit = { id: string; species: string; name: string; level: number; price: number };

export function installBlackMarket(game: any): void {
  if (!game || game.__bmInstalled) return;
  game.__bmInstalled = true;

  game.ensureBlackMarket = function ensureBlackMarket(force = false) {
    const save = this.save;
    if (!save) return;
    const now = Date.now();
    const period = 5 * 60 * 1000;
    if (!force && this.blackMarket && this.blackMarket.until > now) return;
    const lvl = Math.max(1, save.level | 0);
    const seed = (Math.floor(now / period) * 10007 + lvl * 13 + (save.name?.length || 0)) >>> 0;
    const rng = mulberry32(seed);
    const slots: Slot[] = ["weapon", "head", "chest", "legs", "feet", "relic"];
    const floors: QualityId[] = ["fine", "rare", "epic", "legendary"];
    const gear: Gear[] = [];
    for (let i = 0; i < 8; i++) {
      const bump = 5 + Math.floor(rng() * 46);
      const g = rollGear(rng, {
        slot: slots[Math.floor(rng() * slots.length)],
        level: lvl + bump,
        luck: 20 + Math.floor(rng() * 40),
        floor: floors[Math.min(3, Math.floor(rng() * 4))],
      });
      g.uid = `bm_${seed}_${i}_${nextUid()}`;
      gear.push(g);
    }
    const itemIds = [
      "potion",
      "big_potion",
      "ghost_jar",
      "cleanse_salt",
      "spirit_candy",
      "smoke_bomb",
      "trail_ration",
      "cooked_meat",
    ];
    const items: BmItem[] = [];
    for (let i = 0; i < 6; i++) {
      const id = itemIds[Math.floor(rng() * itemIds.length)];
      const def = ITEM_BY_ID[id];
      if (!def) continue;
      items.push({
        id: `bmi_${seed}_${i}_${id}`,
        itemId: id,
        name: def.name,
        price: Math.max(5, Math.floor((def.price || 10) * (1.4 + rng()))),
        count: 1 + Math.floor(rng() * 3),
      });
    }
    const enchants: BmEnchant[] = [];
    for (let i = 0; i < 5; i++) {
      const e = ENCHANTS[Math.floor(rng() * ENCHANTS.length)];
      if (!e) continue;
      enchants.push({
        id: `bme_${seed}_${i}_${e.id}`,
        enchantId: e.id,
        name: e.name,
        about: typeof e.gear === "function" ? e.gear(1) : e.name,
        price: 80 + Math.floor(rng() * 400) + lvl * 2,
      });
    }
    const spirits: BmSpirit[] = [];
    for (let i = 0; i < 4; i++) {
      const m = MONSTERS[Math.floor(rng() * MONSTERS.length)];
      if (!m) continue;
      const sl = lvl + 5 + Math.floor(rng() * 46);
      spirits.push({
        id: `bms_${seed}_${i}_${m.id}`,
        species: m.id,
        name: m.name,
        level: sl,
        price: 120 + sl * 8 + Math.floor(rng() * 200),
      });
    }
    const until = Math.floor(now / period) * period + period;
    this.blackMarket = { gear, items, enchants, spirits, until, seed };
    this.shopStock = gear.slice();
  };

  game.blackMarketSnap = function blackMarketSnap() {
    this.ensureBlackMarket(false);
    const bm = this.blackMarket;
    if (!bm) return null;
    const refreshIn = Math.max(0, Math.floor((bm.until - Date.now()) / 1000));
    const price = (n: number) => (typeof this.price === "function" ? this.price(n) : n);
    return {
      refreshIn,
      gear: bm.gear.map((g: Gear) => ({
        uid: g.uid,
        name: g.name,
        level: g.level,
        quality: g.quality,
        type: TYPES[g.type]?.name ?? g.type,
        price: price(gearPrice(g) * 1.35),
      })),
      items: bm.items.map((it: BmItem) => ({
        id: it.id,
        name: it.name,
        price: price(it.price),
        count: it.count,
        itemId: it.itemId,
      })),
      enchants: bm.enchants.map((e: BmEnchant) => ({
        id: e.id,
        name: e.name,
        about: e.about,
        price: price(e.price),
        enchantId: e.enchantId,
      })),
      spirits: bm.spirits.map((s: BmSpirit) => ({
        id: s.id,
        name: s.name,
        level: s.level,
        price: price(s.price),
        species: s.species,
      })),
    };
  };

  game.openBlackMarket = function openBlackMarket() {
    if (!this.save || this.dead) return;
    this.ensureBlackMarket(true);
    this.toggle("trade");
    this.say?.("Black market stock. Refreshes every 5 minutes.");
    this.syncHud?.(true);
  };

  // KeyT + context-menu "Trade" both call toggleTrade — redirect here
  game.toggleTrade = function () {
    this.openBlackMarket();
  };

  const origBuyItem = game.buyItem?.bind(game);
  game.buyItem = function (id: string) {
    const save = this.save;
    if (!save) return;
    this.ensureBlackMarket(false);
    const row = this.blackMarket?.items?.find((x: BmItem) => x.id === id);
    if (row) {
      const p = this.price(row.price);
      if (save.kyo < p) return this.say("Need more Kyo.");
      save.kyo -= p;
      this.giveItem(row.itemId, row.count || 1);
      this.blackMarket.items = this.blackMarket.items.filter((x: BmItem) => x.id !== id);
      this.gainSkill?.("trading", 4);
      this.say(`Bought ${row.name}.`);
      this.persist?.();
      this.syncHud?.(true);
      return;
    }
    return origBuyItem?.(id);
  };

  game.buyEnchant = function (id: string) {
    const save = this.save;
    if (!save) return;
    this.ensureBlackMarket(false);
    const row = this.blackMarket?.enchants?.find((e: BmEnchant) => e.id === id);
    if (!row) return this.say("That enchant is gone.");
    const p = this.price(row.price);
    if (save.kyo < p) return this.say("Need more Kyo.");
    save.kyo -= p;
    save.stash = save.stash || [];
    save.stash.push({ id: row.enchantId, power: 1 + Math.floor(Math.random() * 3) });
    this.blackMarket.enchants = this.blackMarket.enchants.filter((e: BmEnchant) => e.id !== id);
    this.gainSkill?.("trading", 6);
    this.say(`Bought ${row.name}.`);
    this.persist?.();
    this.syncHud?.(true);
  };

  game.buySpirit = function (id: string) {
    const save = this.save;
    if (!save) return;
    this.ensureBlackMarket(false);
    const row = this.blackMarket?.spirits?.find((s: BmSpirit) => s.id === id);
    if (!row) return this.say("That spirit is gone.");
    const p = this.price(row.price);
    if (save.kyo < p) return this.say("Need more Kyo.");
    save.kyo -= p;
    if (Array.isArray(save.box)) {
      save.box.push({ species: row.species, level: row.level, uid: nextUid() });
    }
    this.blackMarket.spirits = this.blackMarket.spirits.filter((s: BmSpirit) => s.id !== id);
    this.gainSkill?.("trading", 8);
    this.say(`Bound ${row.name}.`);
    this.persist?.();
    this.syncHud?.(true);
  };
}
