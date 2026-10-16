# Controls and Interface

## Keyboard and mouse

| Key | Action |
| --- | --- |
| **W A S D** / **arrow keys** | Move |
| **Left click** | Walk there; click a foe to go to it; click an NPC to talk |
| **Right click** | Inspect menu: details and actions for whatever is under the cursor |
| **Mouse over** | Hover card: a foe's level, health, traits, moves and what hits it harder |
| **Mouse wheel** | Zoom in and out |
| **1–9** (or numpad 1–9) | Cast the verse in that slot |
| **Numpad 0** / **Numpad Enter** | Attack the nearest foe in range with your best verse |
| **Space** | Use the item on Space (set and queue up to 3 in the Bag) |
| **E** | Interact: talk, gather a node, fish, enter a dungeon or rift, use a bounty board, open a loot chest (Hardcore), inspect a lingering ghost |
| **B** | Bag (items and materials) |
| **I** | Gear Inventory (all gear, sets, stash) |
| **V** | Verses (loadout and library) |
| **C** | Character sheet |
| **K** | Skills and account perks |
| **Q** | Quests (story, contract board, map quests) |
| **M** | World map: drag, zoom, hover, click to pin; in Hardcore, click a ringed town to fast travel |
| **G** | Spirits |
| **X** | Crafting |
| **T** | Black Market (buy and sell anywhere) |
| **H** | Survival panel (Hardcore) |
| **F** | Build mode (Hardcore) |
| **Esc** | Close a window or pause |

**Mashing keys** while asleep or rooted shakes the effect off faster. See [Status Effects](Status-Effects).

On phones and tablets a virtual stick appears for movement, and the HUD buttons open every window. The HUD restacks for narrow screens; the menu row scrolls sideways.

## The HUD

- **Top left, vitals:** level, name and class, kyo, health (with shield), experience bar, active effects with timers, your region and the latest log line.
- **Top centre, target:** the foe you are fighting — level, element, HP bar with lag trail, and trait chips.
- **Top right, tracker (foldable):** day/night clock (Hardcore), survival bars (Hardcore), live bounties and tier, Bounty Stars and Wanted level, map quest progress, lobby. Fold it with the arrow.
- **Bottom dock:** your 9 verse slots with cooldown overlays, plus buttons for every window (keys shown on each button).
- **Autoplay / Grind nodes:** your witch plays herself. In TurboHunt she grinds and fights; in Hardcore she gathers and fights.
- **Unstuck:** if you are wedged in a wall, press it, point the cursor at open ground and after 3 seconds you land there.

The engine refreshes fast HUD fields (health, target, effects) every **120 ms** and everything else only on a real change or once per second, so the page never re-renders as a whole several times a second.

## Verse bar

Tapping (or right-clicking) an equipped verse slot opens:

- **Upgrade** — spend a skill point to rank it up.
- **Move** — then tap another slot to swap the two.
- **Unequip** — remove it from the bar.
- **Cancel**

Drag slots to reorder them freely. Hotkeys 1–9 follow that order.

## Windows

All windows share one design kit (cards, tabs, meters, chips):

- **Skills & Perks (K)**: character skills and account perk spending.
- **Verses (V)**: loadout (equip, reorder) and searchable library (unlock, rank up).
- **Gear Inventory (I)**: filter by purpose/quality/element/slot; search; sort; Sets tab; Stash tab.
- **Bag (B)**: items only — potions, materials, food, ghost jars, etc.
- **Quests (Q)**: story quests, contract board and map quests in tabs.
- **Map (M)**: full world map — drag, zoom, hover, pin, find, layers.
- **Spirits (G)**: ghost party, Ghost Box, tiny followers.
- **Crafting (X)**: alchemy and stitching.
- **Survival & Camp (H)**: Hardcore survival bars, food, building.
- **Black Market (T)**: Gear, Items, Enchantments, Spirits, Sell tabs.
- **Character Sheet (C)**: all stats, formulas and gear FX details.

## Nameplates and hover cards

Every foe on screen shows a nameplate, near or far:

- **Level badge** coloured by danger: teal (below you), gold (your level or ≤ +2 above), orange (+3 to +5), red (+6 or more).
- **Name** and an **element dot**.
- **Rank tag**: BOSS, ★ BOUNTY (with tier number), HUNTER, WITCH.
- **Trait chips**: short codes like VAMP, THRN, SWFT, GINT. See [Enemies](Enemies) for the full list.
- **Health bar** in segments, with a pale lag trail that shows each hit.

Far-away plates fade. Crowded ordinary foes collapse to a slim bar so the important ones stay readable. The foe you are targeting and the one under your cursor show exact HP.

Hover over anything for a card:

- **Foes**: level, element, HP bar, what form of attack hits harder (spells vs physical), every trait with its full description, its move kit, and bounty/wanted details.
- **NPCs, resource nodes, water**: what you can do with them.

## Combat text

| Text | Meaning |
| --- | --- |
| White number | Damage you dealt |
| Big yellow number with **CRIT** | A critical hit (bigger font, brief burst) |
| Red number | Damage you took |
| Green **+number** | Healing |
| Grey MISS / DODGE / IMMUNE | Your hit missed, the foe dodged, or the element can't hurt it |
| DODGED / EVADE / CLEAR / GRAZE / CLIP | You avoided all or part of an incoming hit |
| RESIST | An effect was blocked by immunity |
| SLEEP / ROOT / SILENCE / WAKE / AWAKE | Hard-control effects starting and ending |
| SNAG / SLIP / TRIP | A defensive verse failed (see [Defense and Evasion](Defense-and-Evasion)) |
| SAFE | Hit landed inside your campfire safe zone (Hardcore) |
| ECHO | Echo Guard proc — hit ignored |
| ★ BOUNTY STAR | You earned a Bounty Star (see [Bounties](Bounties)) |

Numbers that appear on the same spot fan out in lanes instead of stacking. Text is drawn in screen space in a pixel font with hard outlines, so it stays sharp at any zoom.
