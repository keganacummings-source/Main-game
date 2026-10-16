# Hardcore Survival

**Hardcore** is TURBZ with teeth: one life, survival needs, nights, and enemies that keep growing. Everything here applies to Hardcore only. For the full rule comparison see [Game Modes](Game-Modes).

## In short

- **One life.** Any death ends the witch (your account progress stays).
- **Healing is scarce.** No regeneration and level-ups don't heal. Healing verses, potions (at three quarters strength) and meals mend you.
- **You attack yourself.** Your witch doesn't auto-fight unless you turn on **Grind nodes** (Autogrind).
- **Hunger, thirst and rest** drain over time. Empty bars hurt.
- **Night** lasts 15 minutes and doubles enemy health and damage (and triples experience).
- **Campfires** are safe zones. Build them, cook at them, sleep at them.
- Enemies hit harder, have more health and traits, and **keep growing** with your level and every night you survive.

## Survival bars

Open **Survival** (**H**). All three start full (100).

| Bar | Empties in | When empty |
| --- | --- | --- |
| **Hunger** | 30 min | −0.4 health per second |
| **Thirst** | 20 min | −0.8 health per second |
| **Rest** | 40 min | −0.2 health per second; under 15 rest you move 30% slower |

The **Survival** skill slows all three bars. The old knee is half speed. Past that it still slows them, bending toward 82% slower, and the bars never stop draining. See [Leveling and Skills](Leveling-and-Skills#skills).

### Food and water

<!-- gen:food -->

- Raw meat and fish must be **cooked** at a campfire first.
- Water: stand beside water and **collect raw water** (2 s), then **purify** it at a campfire.
- The **Eat** action picks the smallest meal that fills you up.

## Campfires

**Build a campfire** from the Survival panel with **3 logs**. You can't build one within 80 px of another.

- **Safe zone:** nothing can enter the **15 × 15 tiles** around a campfire. Foes inside are pushed out, and their attacks on you there do nothing (**SAFE**).
- **Cooking:** each recipe uses 1 log and trains the **Cooking** skill, which can give a free second portion. See [Gathering and Crafting](Gathering-and-Crafting#campfire-recipes-hardcore).
- **Sleeping:** sleep beside a campfire, or in a **bed** you built (walk up and press **E**, click the bed, or use Survival & Camp), with no foes near. In a bed you are tucked in and rest comes **half again as fast**. Sleeping restores rest, and at night it **skips to dawn** (a whole night in about 14 seconds). Food and water still drain. Being hit wakes you.
- **Followers:** send your spirits and companions to **wait at a campfire**. Nothing can reach them there.

Up to 100 campfires are remembered.

## Building

Press **F** for **build mode**:

- Click a tile to place a **log wall** (1 log each, within 112 px of you).
- Click a placed log to pick it back up (you get the log back).
- Walls block movement for you and foes.

Up to 800 logs can be placed.

## Day and night

- A day lasts **10 minutes**, a night **15 minutes**. The tracker shows the time left and the screen darkens at dusk.
- At **night**, foes have **2× health** and deal **2× damage**, but give **3× experience**.
- Nights survived raise the difficulty for the rest of the run (see Growth below).

## Growth

Hardcore enemies grow stronger as the run goes on:

**Growth = 1 + 0.25% × your level + 4% × nights survived + 2% × bounty tier**, at most ×2.5.

It multiplies enemy health and damage by its square root, and adds levels. See [Enemies](Enemies#growth).

## Other Hardcore rules

- Experience ×0.72; **skill experience ×2.4**.
- Foes are 2 levels higher, with 20% more health, 35% harder hits and +1 trait.
- They attack 15% more often, and wind up faster at high levels.
- Foes catch up to new gear in about **3 minutes** instead of 5.
- Bounty hunter waves every **60 s** instead of 90.
- Spawns are never below your level − 1, and get extra levels as you level up (1 per 6 levels) and go deeper into rifts.
- No evil witches.

## Fast travel

A new Hardcore witch always wakes at the **world's starting point**, not in a random tavern. To get back out to the towns you have already discovered, open the **Map** (**M**) and click a **ringed town** (the capital you start in, plus every town you have walked into). Confirm **Travel** and you arrive in that town. Full steps are under [Fast travel](World-and-Regions#fast-travel-hardcore) on the map page.

- Only towns you have **visited** on this save are offered. Visited towns are kept when a witch dies.
- Works on the overworld only, and not while you are in a fight or a duel.
- Click **Pin instead** to drop a map pin in a town rather than travel.

## The Green Cave

At **level 30+**, the Black Market sometimes (40% of refreshes) sells a **Green Mushroom** for 300 + 15 × your level kyo. Eat it to wake in a **fresh copy** of the Green Cave: its own map, foes, nodes and quest, all reset each time. Find the door marked **Wake up** to return to where you were.

## Camp building

Press **F** (or **Survival & Camp → Build**) and pick a piece. Click a tile to place it; click a placed piece to pick it up and get its materials back.

| Piece | Cost | Notes |
| --- | --- | --- |
| Wooden Wall | 2 Logs, 1 Vein Ore | Solid for everyone |
| Brick Wall | 1 Log, 3 Vein Ore | Solid for everyone |
| Bed | 3 Hide Leather, 2 Logs | Inside a camp only |
| Ghost Box | 4 Logs, 4 Vein Ore | Inside a camp only; one per hunter. See [Spirits](Spirits) |

**Send followers to bed** (Survival & Camp) sends your ghosts and companions home to the beds in the camp you stand in. They stay there, safe, even when you leave the map, until you call them back. You need at least one bed.

## Loot chests

In Hardcore, anything a foe drops goes into a **chest** where it fell: ordinary foes, animals, witches, hunters, world bosses and bounties.

- Walk up and press **E**, or click the chest. The game does **not** pause.
- **Click** an item to read it (gear shows its stats, enchantments and how it compares to what you wear). **Shift+click** to take it straight away, or use **Take everything**.
- A chest vanishes after **5 minutes**, or as soon as it is empty. Its label turns red and the chest blinks in the last 30 seconds.
- **Drops close together share one chest.** A foe that falls within 3 tiles of a chest adds its loot to that chest instead of making a new one, and the chest hops. A number on the chest shows how many drops are in the pile; it lasts as long as its newest drop.

### Reading a chest from afar

| What you see | What is inside |
| --- | --- |
| Plain chest, no light, label **SUPPLIES** | Items only (potions, meat, ore...) |
| Beam of light and a ring on the ground, label **RARE GEAR ×2** | Gear. The colour is the best piece inside: grey worn, white common, green fine, blue rare, purple epic, orange legendary. Better gear has a taller beam. |
| Gold sparkles circling it, label **BOSS LOOT** | A world boss, bounty or rival witch's drop |

The chest window repeats this at the top (how much gear, how many items, how many drops merged) and has a **Reading chests** key.
- Hardcore never puts gear on you by itself. **Double-click** a piece in the Bag to wear it.

## Resource nodes

Trees, ore and mushrooms grow back **in the same spot** when you finish a sleep or a new day dawns. They never move or multiply.

