# Enemies

## In short

- Enemies **scale to you, live**. A foe is never below your level, and its health and damage are measured against **your** power. It keeps adjusting the whole time it is alive.
- Every foe rolls its **own** stat line, **traits** and **move kit**. Two Onibi can fight very differently.
- **Rarity** (common → epic) makes a foe tougher, gives it more traits, and makes it drop better loot.
- New gear gives you a **honeymoon**: enemies catch up to your new power over about 5 minutes (3 in Hardcore).

## How scaling works

Enemies don't use fixed numbers. Instead:

- **Health** = how many of *your* average hits it takes to kill.
- **Damage** = what share of *your* max health one clean hit removes.
- **Level** = your level plus an offset.

All three are re-checked four times a second. A level-3 foe that is still alive when you hit level 300 is still a fight, and its health stays at the same percentage when it resizes.

Your power is **smoothed**. When you get stronger, foes catch up over about **5 minutes** (TurboHunt) or **3 minutes** (Hardcore). When you get weaker, they take about **15 minutes** to come back down, so swapping gear in and out doesn't help. Formulas are on [Damage and Formulas](Damage-and-Formulas#enemy-health).

### By kind

<!-- gen:enemy-kinds -->

- **Rarity** adds +0.75 hits, +1% hit share, +1 level and more speed per step (minions +0.25 hits and +0.3% per step).
- **Growth** slowly raises all three over the game (see below).
- Hit share is capped at 32% of your health.

### Growth

Difficulty also climbs over a whole run. Growth multiplies health and damage by its square root, and adds a level per 0.1 of growth.

<!-- gen:growth -->

### Rarity

Each foe rolls a rarity when it spawns. Higher levels shift the odds up until the mid-hundreds:

| | Level 1 | Level 100 | Level 200+ |
| --- | --- | --- | --- |
| Epic (3) | 4% | 18% | 32% |
| Rare (2) | 10% | 22% | 34% |
| Uncommon (1) | 20% | 28% | 36% |
| Common (0) | 66% | 32% | ~0% |

Bosses are always Epic. Rarity raises toughness, trait count, gear drop chance, drop quality floor and catch chance.

## Enemy stats

Every foe has seven personal stats, rolled from its **element**, its **species** and a little randomness:

- **Health**, **Damage** and **Speed** multipliers.
- **Crit** chance (base 3%, at most 45%).
- **Dodge** chance (at most 35%).
- **Physical resist** and **Spell resist** (each at most 55%).

### By element

<!-- gen:element-archetypes -->

## Enemy traits

Foes roll traits from their species and element preferences (55% of the time), or from the whole list. Traits show as tags on the nameplate and in full on the hover card.

<!-- gen:mob-enchants -->

### How many traits

| Kind | Traits |
| --- | --- |
| Animal | 20% chance of 1 |
| Normal foe | its rarity (0–3), and a common foe has a 25% chance of 1 |
| Minion | 1, 35% chance of 2 |
| Boss | 3, 50% chance of 4 |
| Witch | 3 |
| Bounty | 3 + 1 per 3 tiers (at most 7) |
| Hunter | 2 + 1 per 2 Wanted levels (at most 5) |

Hardcore adds +1 to everything but animals. All foes get +1 more per 120 of your levels. The overall maximum is 8.

## Enemy kits

Each foe knows a short list of verses of its element:

- animals: 1 (always melee);
- normal foes and minions: 2–3;
- hunters: 3;
- bosses, witches and bounties: 4.

It favours the forms its element likes (Air prefers ranged, Void prefers spells) and always keeps its signature verse. In a fight it picks a ready move that reaches you, favouring strong ones. The hover card lists a foe's whole kit.

## Monsters

<!-- gen:monsters -->

## Animals

Animals give meat and leather for [crafting](Gathering-and-Crafting) and Hardcore food. Most flee; wolves and boars fight back.

<!-- gen:animals -->

## Respawns and spawns

- In TurboHunt, normal foes respawn **22 s** after dying and bosses **70 s** (a zone can set its own timer). In **Hardcore on the overworld**, every ordinary foe and world boss comes back in **2 minutes**, even if you walk away. Foes in dungeon rifts, shrines, bounties, witch hunts and hunter squads don't respawn.
- New spawns appear near your level: within 5 levels either way in TurboHunt, never below your level − 1 in Hardcore (plus Hardcore threat levels).
- 55% of foes are **ghost-type** spirits with their own look (eyes, horns, tails, glow). Spirit-element foes always are.

## Under the hood

- Every foe's level is at least the level it spawned at, and at least your level + its kind's offset.
- **Designed enemies** (from the [Enemy Designer](Designer-Mode)) use their designer stats, fixed traits plus random extra traits, an exact move list, a level bonus, a loot multiplier and a temperament (hunt, drift or flee). A design can replace a built-in monster everywhere it spawns.
- Foes shown to you are always computed for **your** witch.
- Out in the overworld, 45% of foes are a random kind instead of their camp's, and half of all foes roll a random element (shown in their name, e.g. "Fire Kusa"); their moves and the ghost they leave follow that element.
