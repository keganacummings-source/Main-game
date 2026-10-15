# Leveling and Skills

TURBZ has three kinds of progress:

| | Belongs to | Kept when your witch dies? |
| --- | --- | --- |
| **Character level** (1–400) | This witch | No, a new witch starts at 1 |
| **Skills** (12 of them, 1–400) | Your account | Yes |
| **Account level** (1–40) and **perks** | Your account | Yes |

## Character level

Kill foes for experience. Each level:

- **+12 max health** (before multipliers);
- **+4.5% damage**;
- **3 skill points** to spend on verses;
- a **full heal** in TurboHunt.

The cap is **level 400**.

<!-- gen:xp-need -->

The curve grows 17% per level up to level 20, then slowly after that.

### Skill points and verse ranks

Spend skill points in **Verses** (**V**, Library tab):

- **Unlock** a new verse for 1 point. **Any verse in the game** can be unlocked by any class. It goes straight onto your bar if there is room.
- **Rank up** a verse for 1 point, up to rank 5. Each rank is **+15%** to that verse's damage, heals and shields (rank 5 = ×1.6).
- **Ghost slot:** 1 point lets one more spirit follow you (up to 7 extra). See [Spirits](Spirits).

Your **loadout** holds up to **9** equipped verses, and only those are used. Reorder or swap them in the Loadout tab. Hotkeys 1–9 follow that order.

## Skills

Skills are **account-wide** and stay through every death and both modes. Each gives a small bonus per level with no cap until level 400. Train them by doing the thing. Your class's **aptitude** speeds up or slows down each one, and **Hardcore gives 2.4× skill experience**.

<!-- gen:skills -->

### Skill experience curve

<!-- gen:skill-need -->

## Account level and perks

Every point of character experience you earn also goes to your **account**. Each account level gives **5 perk points** (account level cap 40). Spend them in **Skills** (**K**, Account perks tab). Perks are permanent copies of gear enchantments that stack with your gear.

<!-- gen:account-need -->

### Perks

<!-- gen:perks -->

## Under the hood

- **Max health** = (78 + 12 × level + Spark of Life + Vitality) × (1 + Vitality class stat %), never below 20.
- **Movement speed** = 118 px/s × class Agility (never below ×0.5) × 1.45 while Swift × (1 + Swift Step %, at most +45%). Soak ×0.62. Hardcore exhaustion (rest under 15) ×0.7.
- **Out-of-combat healing** (TurboHunt) = (1.2 + 0.15 × Adventuring level) per second × (1 + class Recovery %).
- The **Afterglow** enchantment heals 0.4 health per point whenever a foe falls (TurboHunt).
- At level 400 experience stops; skills keep going.
