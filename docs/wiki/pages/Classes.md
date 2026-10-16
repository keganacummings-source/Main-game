# Classes

Your class decides your **element**, your **stats**, a **passive**, any **immunities**, your **starting verses** and how fast you learn each **skill**. Every class has one **Focus** — a primary role carried by one big stat — and the element is a secondary bonus (+5% Affinity with its verses).

## In short

- **Tanks** take hits. **Bruisers** hit hard up close. **Mobility** classes dart in and out. **Casters** nuke with spells. **Support** heals and buffs. **Marksmen** fight from range.
- Stats are percentages added on top of everything else (see the stat list below).
- Each class belongs to a **race** (from its element). That race's armor sets are more likely to drop for you.
- Finished armor sets unlock **per class**. See [Sets](Sets).
- Class names were updated in V6: Frostguard → **Vanguard**, Emberheart → **Channeler**, Tideshaper → **Wellspring**, Galeborn → **Outrider**, Radiant → **Beacon**, Umbral → **Phasewalker**.

## Stats

| Stat | What it does |
| --- | --- |
| **Might** | Multiplies physical (melee/ranged) damage. Linear at or above ×0.2; bends toward ×0.05 below that, never zero. |
| **Arcana** | Multiplies spell and channel damage. Same curve as Might. |
| **Guard** | Damage reduction. Old knee: 60% off. Past that bends toward 90%. Negative Guard bends toward 80% more taken. |
| **Haste** | Shorter cooldowns. Old stop: −40%/+45%. Past that bends toward −150%/+82%. Never below 0.2 s cooldown. |
| **Agility** | Multiplies movement speed. Linear at or above ×0.5; bends toward ×0.05 below that. |
| **Recovery** | Multiplies out-of-combat healing rate (TurboHunt). |
| **Lifesteal** | Heals that share of the damage you deal. |
| **Fortune** | Multiplies kyo from kills. Linear at or above ×0.2. |
| **Insight** | Multiplies XP from kills. Linear at or above ×0.2. |
| **Affinity** | +% damage to verses of your class's element. |
| **Precision** | +% critical hit chance. |

All of these bend past their old caps — they never stop stacking, but diminishing returns prevent immunity, infinite speed or a zero-cooldown. See [Overmax](Damage-and-Formulas#cooldowns).

### Skill aptitudes

Aptitudes multiply the experience you earn in a skill. ×1.5 Hunting means every Hunting gain is 50% bigger; ×0.6 Mining means 40% smaller. Explorer classes (Adventuring aptitude 1.3 or more) learn Wayfinding faster.

## Roles

| Role | Focus | Play style |
| --- | --- | --- |
| **Tank** | Defense / Guard | High health, high Guard; soaks hits and holds the line. |
| **Bruiser** | Raw Power / Might | High melee damage, medium durability; fights in close. |
| **Mobility** | Speed / Tempo | Fast, with dash/blink verses built in; darts in and out. |
| **Caster** | Spell Power / Arcana | High spell damage; range-dominant. |
| **Support** | Healing / Summoning | Strong heals and wards; boosts ghosts and companions. |
| **Marksman** | Critical Hits / Hunter's Eye | Ranged-focused; crits and double strikes. |

## All classes

<!-- gen:classes -->

## Starter sets per class

Collecting all 5 pieces (helm, raiment, skirt, boots, relic) of an armor set **while playing a specific class** unlocks that set for that class. When that class dies, the rebirth screen offers the set as level-1 spawn gear with its full bonus.

- Any race's set works, as long as *that class* collected it.
- Class cards show how many sets each class has unlocked.
- Old saves keep their finished sets: each goes to every class of that set's race.

## Under the hood

- **Max health** = (78 + 12 × level + Spark of Life + Vitality) × (1 + Vitality class stat %), never below 20.
- Class stats stack with trait stats and then feed into the formulas on [Damage and Formulas](Damage-and-Formulas).
- Each class can be **immune** to some status effects (shown on the class card). See also [Races and Traits](Races-and-Traits).
- The full class list with exact numbers is generated from the game's content and shown on the class selection screen.
