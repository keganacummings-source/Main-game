# Gathering and Crafting

## Resource nodes

Trees, ore veins and mushroom patches dot the world. Stand beside one and press **E** (or click it in the inspect menu) to gather.

- Gathering takes **max(0.45, 1.15 − 0.008 × skill level)** seconds. Moving more than 64 px away cancels it.
- A gathered node is **used up where it stands**. It grows back **in the same spot**, never somewhere new, when the land regrows:
  - **Hardcore:** when you finish a sleep at camp, or when a new day dawns.
  - **TurboHunt:** once every in-game day (10 minutes of play).
- Used-up nodes are saved, so reloading or walking through a door does not bring them back early.

| Node | You get | Skill |
| --- | --- | --- |
| **Tree** | 1–2 **Logs** × (1 + Harvest %) × (1 + 0.3% per Woodcutting level) | Woodcutting +14 |
| **Ore vein** | 1–2 **Vein Ore** (same formula with Mining), plus a 45% chance of **Ironroot** | Mining +14 |
| **Mushroom patch** | 1 **Shroom** and 1 reagent: 34% Dreamspore, otherwise Embercap or Blue Lantern | Shroom +16 |

Mushroom patch bonuses:

- **Shroom Sense** above 20 gives +1 reagent.
- Your **Shroom** skill gives a 0.2%-per-level chance (at most 80%) of +1 shroom and +1 reagent.

## Fishing

Any water tile is a fishing spot. Stand beside water and press **E**.

- A bite comes after **1–10 seconds**, shortened by **Fish Luck** (up to 75%) and the **Fishing** skill (0.175% per level, up to 70%).
- Each bite gives **1 Raw Fish** (2 with more than 25 Fish Luck) and 16 Fishing experience.
- Walking more than 40 px away reels the line in.
- Cook a fish into a **Fish Meal** by talking to Fisher Bram (**Cook a fish**) or at a campfire (Hardcore).

In Hardcore you can also **collect raw water** beside water (2 seconds). See [Hardcore Survival](Hardcore-Survival).

## Alchemy

Open **Crafting** (**X**) or talk to Spore Broker Lise. Each brew gives 18 Alchemy experience. The **Alchemy** skill gives a 0.125%-per-level chance (at most 50%) of a **second dose**.

<!-- gen:alchemy -->

## Stitching gear

In **Crafting**: **10 Hide Leather + 10 Shroom** stitch a random gear piece at **your level**, with luck from your account level (12 + 2 × account level). Gives 22 Alchemy experience. Hunt animals for leather.

## Campfire recipes (Hardcore)

Build a campfire (3 logs), then cook at it:

<!-- gen:camp-recipes -->

See [Hardcore Survival](Hardcore-Survival).

## Selling materials

Talk to Quartermaster Holt to **sell the pack**: meat, leather, mushrooms, ore, logs and fish (only leather and ore in Hardcore). You get **85%** of each item's base price × (1 + Merchant Tongue % + 0.2% per Trading level).

## Autoplay and Autogrind

The **Autoplay** button (TurboHunt) and **Grind nodes** button (Hardcore) let your witch play herself:

- She walks between nodes, gathers, fishes and fights whatever is nearest in range.
- She rotates skills: fishing stops after 75 seconds so other skills get a turn.
- She backs off when under 34% health with a foe close.
