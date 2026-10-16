# Leveling and Skills

TURBZ has three kinds of progress:

| | Belongs to | Kept when your witch dies? |
| --- | --- | --- |
| **Character level** (no cap) | This witch | No — a new witch starts at 1 |
| **Skills** (32 of them, no cap) | Your account | Yes |
| **Account level** (no cap) and **perks** | Your account | Yes |

## Character level

Kill foes for experience. Each level:

- **+12 max health** (before multipliers);
- **+4.5% damage**;
- **3 skill points** to spend on verses;
- a **full heal** in TurboHunt.

There is no level cap. Experience keeps paying out and each level still gives the bonuses above. A large experience dump settles over several frames so the game cannot freeze.

### Skill points and verse ranks

Spend skill points in **Verses** (**V**, Library tab):

- **Unlock** a new verse for 1 point. **Any verse in the game** can be unlocked by any class.
- **Rank up** a verse for 1 point. Ranks 1–5 are **+15%** each (rank 5 = ×1.6). Ranks past 5 keep stacking at **+8%** each.
- **No rank cap** — ranks go as high as you push them.

Your **loadout** holds up to **9** equipped verses. Reorder or swap them in the Loadout tab or by tapping a verse on the bar. Hotkeys 1–9 follow that order.

Ghost slots are gone. 3 ghosts go out with you and 6 ride in your party; the rest live in your Ghost Box. Any points spent on old ghost slots were refunded. See [Spirits](Spirits).

## Skills

Skills are **account-wide** and stay through every death and both modes. Each gives a bonus per level, and **no skill has a cap or a curve that flattens it**. Bonuses that could not sensibly pass 100% use an overflow system:

- **Extra-roll chances** (Cooking, Alchemy, Shroom, Skinning, Building, Looting) climb past 100%. Every full 100% is a guaranteed extra and the remainder is a roll: 250% means two extras and a 50% chance of a third.
- **Speed-ups** (Fishing bites, Magic and Mastery cooldowns, Survival drain, Trading prices) are rates: +100% is twice as fast (or half the price), +300% is four times.
- **Catching** past a sure catch raises the odds of a shiny ghost and gives it more health.
- **Evasion** is a rating: 100 rating = 50% chance to slip a hit, 300 = 75%, climbing forever.

Damage, sell price, Wayfinding speed, Mining and Woodcutting stay linear.

Train them by doing the thing. Your class's **aptitude** speeds up or slows down each one. **Hardcore gives 2.4× skill experience.**

### All 32 skills

#### Combat skills
| Skill | Bonus | Trained by |
| --- | --- | --- |
| **Hunting** | +0.2% physical damage per level | Killing foes |
| **Physical** | +2% melee damage, +1.5% ranged damage per level | Melee / ranged hits |
| **Magic** | +2.5% spell damage, −0.113% spell cooldown per level (bends past 45% toward 75%) | Casting spells |
| **Catching** | +0.12% catch chance per level; past sure-catch, raises shiny odds and ghost health | Keeping ghosts |
| **Evasion** | Evasion rating; 100 = 50% slip chance, 300 = 75% | Dodging attacks |
| **Bounty Hunting** | +% damage against bounties, witches and hunters | Killing bounties, witches, hunters |

#### Gathering skills
| Skill | Bonus | Trained by |
| --- | --- | --- |
| **Woodcutting** | +0.3% timber yield per level | Chopping trees (+14 XP) |
| **Mining** | +0.3% ore yield per level | Mining veins (+14 XP) |
| **Shroom** | 0.2%-per-level chance of +1 shroom + reagent | Gathering mushrooms (+16 XP) |
| **Fishing** | 0.175%-per-level shorter bite wait (up to 70%) | Fishing (+16 XP per bite) |
| **Skinning** | Extra meat and hide from animals | Killing animals |

#### Crafting skills
| Skill | Bonus | Trained by |
| --- | --- | --- |
| **Alchemy** | 0.125%-per-level chance of a second brew dose | Brewing potions (+18 XP) |
| **Cooking** (Hardcore) | 0.15%-per-level chance of a second campfire portion | Cooking (+8–10 XP) |
| **Looting** (Hardcore) | Chests hold more and last longer | Opening Hardcore loot chests |
| **Building** (Hardcore) | Camp pieces may refund a material | Placing camp pieces |

#### Economy & social skills
| Skill | Bonus | Trained by |
| --- | --- | --- |
| **Trading** | +0.2% sell price, −0.125% buy price per level (floor: 50% off) | Buying/selling at shops |
| **Adventuring** | Faster out-of-combat health regen (TurboHunt) | Quests, dodging, first visits |
| **Social** | *(passive)* | Talking to NPCs for the first time |

#### Exploration skills
| Skill | Bonus | Trained by |
| --- | --- | --- |
| **Wayfinding** | +0.075% movement speed per level (no cap); works in both modes | Walking (1 XP / 10 tiles); first town visit +30, first continent +20 |
| **Ghostkeeping** | +% ghost damage and health | Your ghosts fighting |

#### Hardcore survival skills
| Skill | Bonus | Trained by |
| --- | --- | --- |
| **Survival** | Hunger, thirst and rest drain 0.2% slower per level (cap: 50%; bends past 50% toward 82%) | Eating (+3), drinking (+3), building a campfire (+12), waking rested (+15), surviving a night (+40) |

#### Element mastery skills (11 total)
One per element: Normal, Fire, Water, Earth, Air, Electric, Ice, Void, Light, Spirit, Ghoul.

| Bonus | Trained by |
| --- | --- |
| +0.6% damage with that element's verses (yours and your ghosts'); small cooldown cut | Casting that element's verses (+0.6% from your casts, a little from ghost casts) |

#### Activity skills
| Skill | Bonus | Trained by |
| --- | --- | --- |
| **Evasion** | Evasion rating (see above) | Dodging |
| **Bounty Hunting** | +% damage against bounties, witches, hunters | Bounty/witch/hunter kills |
| **Skinning** | Extra meat and hide | Killing animals |
| **Looting** | Longer chest timers and more slots (Hardcore) | Opening chests |
| **Building** | Material refund chance (Hardcore) | Placing camp pieces |

Explorer classes (Adventuring aptitude 1.3 or more) also earn Wayfinding experience faster.

### Skill experience curve

The XP needed per level grows slowly. Old saves get the new skills (Wayfinding, Survival, Cooking, and the six activity skills) at level 1 with no loss.

## Account level and perks

Every point of character XP also goes to your **account**. Each account level gives **5 perk points**. There is no cap.

Spend perks in **Skills** (**K**, Account perks tab). Perks are permanent copies of gear enchantments that stack with your gear. A perk can be bought past its old maximum, and chance or reduction effects bend before they can break a fight.

### Perks

<!-- gen:perks -->

### Under the hood

- **Max health** = (78 + 12 × level + Spark of Life + Vitality) × (1 + Vitality class stat %), never below 20.
- **Movement speed** = 118 px/s × class Agility × 1.45 while Swift × (1 + Swift Step %, bending past +45% toward +85%) × (1 + 0.075% × Wayfinding levels above 1). Soak ×0.62. Hardcore exhaustion (rest under 15) ×0.7.
- **Survival drain** = 1 ÷ (1 + endurance), where endurance = +0.4% per Survival level above 1. +100% endurance halves drain. Never stops.
- **Out-of-combat healing** (TurboHunt) = (1.2 + 0.15 × Adventuring level) per second × (1 + class Recovery %).
- **Afterglow** enchantment heals 0.4 health per enchantment power whenever a foe falls (TurboHunt).
- Levels, skills and account level do not stop. There is no ceiling anywhere.
