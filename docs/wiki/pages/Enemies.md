# Enemies

## In short

- Enemies **scale to you, live**. A foe is never below your level, and its health and damage are measured against **your** power. It keeps adjusting the whole time it is alive.
- Every foe rolls its **own** stat line, **traits** and **move kit**. Two Onibi can fight very differently.
- **Rarity** (common → epic) makes a foe tougher, gives it more traits, and makes it drop better loot.
- New gear gives you a **honeymoon**: enemies catch up to your new power over about 5 minutes (3 in Hardcore).
- On the overworld, **45%** of foes roll a random kind and **half** roll a random element (shown in their name, e.g. "Fire Kusa"). Their moves, colours and dropped ghost all follow that element.

## How scaling works

Enemies don't use fixed numbers. Instead:

- **Health** = how many of *your* average hits it takes to kill.
- **Damage** = what share of *your* max health one clean hit removes.
- **Level** = your level plus an offset.

All three are re-checked four times a second. A level-3 foe that is still alive when you hit level 300 is still a fight, and its health stays at the same percentage when it resizes.

Your power is **smoothed**. When you get stronger, foes catch up over about **5 minutes** (TurboHunt) or **3 minutes** (Hardcore). When you get weaker, they take about **15 minutes** to come back down.

### By kind

| Kind | Hits to kill | Hit share | Level offset |
| --- | --- | --- | --- |
| Normal foe | 5 | 6% → 8.5% | 0 |
| Boss | 18 | 7.5% → 10.5% | +3 |
| Witch | 10 | 6.5% → 9% | +3 |
| Bounty | 12 | 5% → 7% | +3 + tier |
| Hunter | 6 | 3% → 4.2% | +3 |
| Animal | 3 | 3.5% → 5% | 0 |
| Minion | 3 | 2.5% → 3.5% | 0 |

*(Arrows show old → new base damage values from the V6.1 balance patch.)*

- **Rarity** adds +0.75 hits, +1% hit share, +1 level and more speed per step (minions +0.25 hits and +0.3% per step).
- **Growth** slowly raises all three over the whole run.
- Hit share is hard-capped at 32% of your health.

### Growth

Difficulty climbs over a whole run. Growth multiplies health and damage by its square root, and adds a level per 0.1 of growth.

| Factor | Contribution |
| --- | --- |
| Your level | +0.25% per level |
| Nights survived (Hardcore) | +4% per night |
| Bounty tier | +2% per tier |
| Maximum | ×2.5 |

### Rarity

Each foe rolls a rarity when it spawns. Higher levels shift the odds up:

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
- **Physical resist** and **Spell resist** (each at most 55%; bends toward 88% past 55%, never reaches immunity).

### By element

| Element | Leans toward | Prefers |
| --- | --- | --- |
| Fire | High damage | Melee / spell |
| Water | High health | Ranged / spell |
| Earth | High armor | Melee |
| Air | High speed, dodge | Ranged |
| Electric | High crit | Ranged / spell |
| Ice | Control (root/soak) | Spell |
| Void | Spell resist | Spell |
| Light | Balanced | Spell |
| Spirit | Heal/ward | Mixed |
| Ghoul | Lifesteal | Melee |
| Normal | Variable | Mixed |

## Enemy traits

Foes roll traits from their species and element preferences (55% of the time), or from the whole list. Traits show as short tags on the nameplate and in full on the hover card.

| Trait | Tag | Effect |
| --- | --- | --- |
| Vampiric | VAMP | Heals on hit. |
| Thorned | THRN | Returns 12% of damage dealt to attacker (capped at 4% of your health / hit, 3×/s). |
| Warded | WARD | Takes 15% less from everything. |
| Frenzied | FRNZ | Deals 35% more damage below half health. |
| Swift | SWFT | Attacks 15% faster; moves faster. |
| Brutal | BRUT | +15% crit chance. |
| Regenerating | REGN | Slowly heals over time. |
| Evasive | EVAD | Higher dodge chance. |
| Armored | ARMR | Higher physical resist against ranged hits. Melee ignores it. |
| Spellward | SPLW | Higher spell resist. |
| Giant | GINT | More health and damage; larger sprite. |
| Unshakable | UNSH | Immune to sleep. |

### How many traits

| Kind | Traits |
| --- | --- |
| Animal | 20% chance of 1 |
| Normal foe | Rarity (0–3); common foes have 25% chance of 1 |
| Minion | 1, 35% chance of 2 |
| Boss | 3, 50% chance of 4 |
| Witch | 3 |
| Bounty | 3 + 1 per 3 tiers (at most 7) |
| Hunter | 2 + 1 per 2 Wanted levels (at most 5) |

Hardcore adds +1 to everything but animals. All foes get +1 more per 120 of your levels. Maximum is 8 traits.

## Enemy kits

Each foe knows a short list of verses of its element:

- animals: 1 (always melee);
- normal foes and minions: 2–3;
- hunters: 3;
- bosses, witches and bounties: 4.

It favours the forms its element likes (Air prefers ranged, Void prefers spells) and always keeps its signature verse. In a fight it picks a ready move that reaches you, favouring strong ones. The **hover card** lists a foe's whole kit.

A foe's time between attacks is the same base cooldown a player gets for that verse. Swift and enraged foes attack 15% faster each. A foe that just noticed you waits 0.3–0.8 s before its first strike.

## Enemy nameplates

Every foe on screen shows a nameplate:

- **Level badge** coloured by danger: teal (below you), gold (your level or ≤ +2), orange (+3 to +5), red (+6 or more).
- **Name** and an **element dot**.
- **Tags**: BOSS, ★ BOUNTY (with tier number), HUNTER, WITCH.
- **Trait chips**: VAMP, THRN, SWFT, etc.
- **Health bar** in segments with a pale lag trail.

Far plates fade. Crowded ordinary foes collapse to a slim bar. The foe you are targeting and the one under your cursor also show exact HP.

Hover any foe for the full **mouse-over card**: level, element, HP bar, what hits it harder, every trait with its description, its whole move kit and bounty details.

## Monsters

<!-- gen:monsters -->

## Animals

<!-- gen:animals -->

## Respawns and spawns

- **TurboHunt:** normal foes respawn **22 s** after dying; bosses **70 s** (a zone can set its own timer).
- **Hardcore overworld:** every ordinary foe and world boss comes back in **2 minutes**, even if you walk away. Rifts, shrines, bounties, witch hunts and hunter squads don't respawn.
- **Proximity spawning.** Foes from spawn points are only created when you come within about a screen (never less than 900 px). They are packed away again when you are far off. Time away still counts toward respawns. Bosses, witches, bounties and hunters are always live.
- New spawns appear near your level: within 5 levels either way in TurboHunt, never below your level − 1 in Hardcore.
- **55%** of foes are ghost-type spirits with their own look (eyes, horns, tails, glow). Spirit-element foes always are. Ghost foes wear their rarity's colour wash and glow (see [Spirits](Spirits#rarity)).
- **Camps everywhere.** Generated worlds put a monster camp on every stretch of reachable land: after the usual camps are laid out, any reachable ground more than 18 tiles from a camp gets one of its own, borrowing its kinds of foe and levels from the nearest camp. Worlds made by older builds (and Veilreach) are topped up the same way when they load.

## Under the hood

- Every foe's level is at least the level it spawned at, and at least your level + its kind's offset.
- **Designed enemies** (from the [Enemy Designer](Designer-Mode)) use their designer stats, fixed traits plus random extra traits, an exact move list, a level bonus, a loot multiplier and a temperament (hunt, drift or flee). A design can replace a built-in monster everywhere it spawns.
- **Random overworld foes:** 45% of camp and spawn-point foes roll a random kind. Half of all foes roll a random element (shown in their name). Bosses, dungeons and rifts keep their set kinds.
- Foes shown to you are always computed for **your** witch.
