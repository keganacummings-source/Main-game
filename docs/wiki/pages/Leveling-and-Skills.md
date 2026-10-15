# Leveling and Skills

TURBZ has three kinds of progress:

| | Belongs to | Kept when your witch dies? |
| --- | --- | --- |
| **Character level** (no cap) | This witch | No, a new witch starts at 1 |
| **Skills** (32 of them, no cap) | Your account | Yes |
| **Account level** (no cap) and **perks** | Your account | Yes |

## Character level

Kill foes for experience. Each level:

- **+12 max health** (before multipliers);
- **+4.5% damage**;
- **3 skill points** to spend on verses;
- a **full heal** in TurboHunt.

There is no level cap. Experience keeps paying out, and each level still gives the bonuses above.

<!-- gen:xp-need -->

The curve grows 17% per level up to level 20, then slowly after that.

### Skill points and verse ranks

Spend skill points in **Verses** (**V**, Library tab):

- **Unlock** a new verse for 1 point. **Any verse in the game** can be unlocked by any class. It goes straight onto your bar if there is room.
- **Rank up** a verse for 1 point. Ranks 1–5 are **+15%** each (rank 5 = ×1.6). Ranks past 5 keep stacking at **+8%** each.
- Ghost slots are gone: 3 ghosts go out with you, 6 ride in your party, and a Ghost Box holds the rest. Points spent on ghost slots were refunded. See [Spirits](Spirits).

Your **loadout** holds up to **9** equipped verses, and only those are used. Reorder or swap them in the Loadout tab. Hotkeys 1–9 follow that order.

## Skills

Skills are **account-wide** and stay through every death and both modes. Each gives a bonus per level, and **no skill has a cap or a curve that flattens it**. Bonuses that could not sensibly pass 100% use a system that keeps paying:

- **Extra-roll chances** (Cooking, Alchemy, Shroom, Skinning, Building, Looting) climb past 100%. Every full 100% is a guaranteed extra and the rest is a roll: 250% means two extras and a 50% chance of a third.
- **Speed-ups** (Fishing bites, Magic and Mastery cooldowns, Survival drain, Trading prices) are rates: +100% is twice as fast (or half the price), +300% four times. They improve forever and never reach zero.
- **Catching** past a sure catch raises the odds of a shiny and gives the ghost more health.
- **Evasion** is a rating: 100 rating is a 50% chance to slip a hit, 300 is 75%, and it keeps climbing.

Damage, sell price, wayfinding speed, mining and woodcutting stay linear. Train them by doing the thing. Your class's **aptitude** speeds up or slows down each one, and **Hardcore gives 2.4× skill experience**.

**Wayfinding**, **Survival** and **Cooking** are the exploration and camp skills. Wayfinding works in both modes. Survival and Cooking only pay off in Hardcore, because only Hardcore has hunger, thirst, rest and campfire recipes. You can still train them there and keep them if you go back to TurboHunt, the same way Adventuring's healing only works in TurboHunt.

**Element masteries.** Every element has its own skill: Normal, Fire, Water, Earth, Air, Electric, Ice, Void, Light, Spirit and Ghoul Mastery. Casting a verse trains the mastery of its element (your ghosts' casts train it a little too). Each level gives +0.6% damage with that element's verses, yours and your ghosts', and a small cooldown cut.

**Activity skills.** Building (camp pieces may refund a material), Ghostkeeping (ghost damage and health; trained by your ghosts fighting), Evasion (a chance to slip hits; trained by dodging), Bounty Hunting (damage against bounties, witches and hunters), Skinning (extra meat and hide) and Looting (Hardcore chests hold more and last longer).

<!-- gen:skills -->

### Skill experience curve

<!-- gen:skill-need -->

## Account level and perks

Every point of character experience you earn also goes to your **account**. Each account level gives **5 perk points**. There is no account-level cap. Spend perks in **Skills** (**K**, Account perks tab). Perks are permanent copies of gear enchantments that stack with your gear. A perk can be bought past its old maximum; those extra points still add their effect, and chance or reduction effects bend before they can break a fight.

<!-- gen:account-need -->

### Perks

<!-- gen:perks -->

## Under the hood

- **Max health** = (78 + 12 × level + Spark of Life + Vitality) × (1 + Vitality class stat %), never below 20.
- **Movement speed** = 118 px/s × class Agility (linear at or above ×0.5; below that it bends toward ×0.05) × 1.45 while Swift × (1 + Swift Step %, bending past +45% toward +85%) × (1 + 0.075% × Wayfinding levels above 1, no cap). Soak ×0.62. Hardcore exhaustion (rest under 15) ×0.7.
- **Survival** gives +0.4% endurance per level above 1. Hunger, thirst and rest drain at 1 ÷ (1 + endurance): +100% endurance halves the drain. The bars slow forever and never stop.
- **Cooking** gives a campfire recipe a (0.15% × Cooking levels above 1) chance to make an extra portion. Every full 100% is a guaranteed extra portion.
- **Out-of-combat healing** (TurboHunt) = (1.2 + 0.15 × Adventuring level) per second × (1 + class Recovery %).
- The **Afterglow** enchantment heals 0.4 health per point whenever a foe falls (TurboHunt).
- Levels and skills do not stop. A huge experience dump settles over several frames so the game cannot freeze.
