# Economy

**Kyo** is the currency. Every rate below is tuned in one place (the economy section of `balance.ts`), so earning and spending move together as you level.

## Earning kyo

- **Kills:** 2 + 0.7 × foe level (×6 for bosses) × loot multiplier × (1 + Kyo Magnet %) × (1 + class Fortune %).
- **Quest Board contracts:** the best steady income. A contract pays 10 to a few hundred kills' worth, plus gear, enchantments and supplies at the top tiers. See [Quests](Quests).
- **Bounties and hunters:** big kyo rewards. See [Bounties](Bounties).
- **Selling** gear and materials (below). Selling is worth about as much as the kills themselves; it is no longer the main income.
- **Shrines:** kyo on top of the gear.

## Shops

| Where | Sells |
| --- | --- |
| **Quartermaster Holt** (near the hearth) | Potions, Big Potions, Ghost Jars, Cleanse Salt, Spirit Candy, Smoke Bombs (+ rations and cooked meat in Hardcore). Buys your material pack. |
| **Spore Broker Lise** | Opens Crafting for alchemy. |
| **Quiet Pike** (fence) and **Peddler Nessa** (armor) | Four random gear pieces at your level, rolled when you talk to them. |
| **Scribe Orien** | Opens your verse library. |
| **Black Market** (press **T** anywhere) | Gear, items, enchantments and spirits; restocks every 5 minutes. |

### Gear value

**Value = 10 + 2 × level × quality value + 3 × total enchantment power.**

| Quality | Worn | Common | Fine | Rare | Epic | Legendary |
| --- | --- | --- | --- | --- | --- | --- |
| Value | ×0.5 | ×1 | ×1.6 | ×2.6 | ×4 | ×6 |

### Sell prices

- **Gear** sells for **40%** of its value × Trading (bends toward +50%) × (1 + Merchant Tongue %). A Legendary at your level sells for about ten kills' kyo.
- **Items** sell for 50% of their list price (at least 4) × the same multiplier.
- **Locked** and **worn** gear is never sold. **Sell all unequipped** can stop at a quality you choose.

### Buy prices

**Price = list price × max(50%, 1 − 0.125% per Trading level) × (1 − Shop Charm ÷ 140)**

## The Black Market

Press **T** anywhere. The stock **restocks every 5 minutes** (or pay to restock now).

| Tab | Stock | Price |
| --- | --- | --- |
| **Gear** | 10 pieces, Fine to Legendary, at your level; ▲ marks an upgrade over what you wear | Gear value × 3.5 |
| **Items** | 6 supplies; in Hardcore at level 30+, a **Green Mushroom** 40% of the time | List price × 1.4–2.4 × (1 + 1.2% per level). Green Mushroom: 600 + 25 × level |
| **Enchantments** | 6 enchantments, rolled like an Epic drop at your level, for your stash | 120 + 8 × level + power × (40 + 2 × level) + up to 150 |
| **Spirits** | 4 spirits at your level +5 to +50 | 200 + 14 × spirit level + up to 250 |
| **Buyback** | The last 10 gear pieces you sold, until the next restock | Their sell price × 1.25 |
| **Sell** | Sell any unworn gear or bag item | as above |
| **Restock now** | A fresh stall right away | 150 + 12 × level |

Every tab has search, sorting, slot and quality filters, and an "I can afford it" filter.

## Trading skill

Trading levels up by buying (+4), buying gear (+8), selling gear (+8) and selling the material pack (+10). Sale prices bend toward +50% (half of it by about level 170), and shop prices drop 0.125% per level (down to 50%).
