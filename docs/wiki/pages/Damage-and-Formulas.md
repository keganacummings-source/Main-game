# Damage and Formulas

The exact maths behind every hit. The **Character sheet** (**C**) shows the same factors for your own witch, using the same code.

## Your hits

### Step 1: base damage

**Base = 6 + 0.42 × verse power**, plus **0.35 × weapon damage** if the verse is melee or ranged. Spells ignore your weapon.

Weapon damage = 8 + 2 × weapon level + 6 × quality rank (Worn 0 … Legendary 5) + Whetstone. See [Gear](Gear).

### Step 2: multipliers

Every factor below multiplies the base.

| Factor | Value |
| --- | --- |
| Level | 1 + 0.045 × your level |
| Matching element gear | +0.28 if your weapon's element matches the verse, +0.08 per matching armor piece, + Typed Edge, +0.22 during a matching surge or Warmth Tonic. Spells skip this. |
| Element vs target | 2, 1, ½ or 0 from the [type chart](Elements). Spells skip this. |
| Might enchantments | 1 + Might ÷ 100 |
| Hunting skill | 1 + 0.2% per Hunting level |
| Keen Edge / Hunter's Eye | melee: 1 + Keen Edge %; ranged: 1 + Hunter's Eye % |
| Last Stand | 1 + Last Stand % while you are under 40% health |
| Execute | 1 + Execute % against foes under 35% health |
| Giant Bane | 1 + Giant Bane % against foes above your level |
| Boss Bane | 1 + Boss Bane % against bosses |
| Gloom on you | ×0.8 |
| Physical skill (melee, ranged) | 1 + 2% per level (melee) or 1.5% per level (ranged) |
| Magic skill (spells) | 1.45 × (1 + 2.5% per Magic level) |
| Spellweave and Hymn (spells) | (1 + Spellweave %) × (1 + Hymn %) |
| Melee strength | ×1.35 for melee verses |
| Target's hide | ×1.2 if your kind matches its hide (spells and channels vs ethereal, physical vs solid), otherwise ×0.8 |
| Verse shape | heavy ×1.7, channel ×1.25, blink ×0.55, lunge ×0.72, dash ×0.6, roll ×0.36 |
| Critical hit | ×1.75 × (1 + Crit Force %). Past +80% Crit Force still helps but bends and never reaches +97% |
| Verse rank | Ranks 1–5: 1 + 0.15 per rank above 1 (rank 5 = ×1.6). Each rank past 5 adds another 8% |
| Class Might / Arcana | 1 + class Might % (physical) or Arcana % (spells and channels). At or above ×0.2 this stays linear. Below that it bends toward ×0.05 |
| Element Affinity | 1 + Affinity % when the verse is your class's element |

"Levels above 1" means a skill at level 10 counts as 9.

### Melee cuts through defenses

Every melee hit, everywhere (you on foes, foes on you, ghosts, Last Man Standing rivals and arena fighters), **ignores all of the target's armor and defenses**: armor, physical resistance, Ward and Guard, plus the Warded enchant on foes and the Shell status on you. Spells already ignore armor; ranged hits face all of it. Dodges, evade windows and Echo Guard still work, because they stop a hit rather than reduce it.

### Step 3: armor, exposure and resistance

- **Armor stops melee and ranged hits; spells ignore it.** Damage × 100 ÷ (100 + armor). **Melee ignores armor completely.** A normal foe has 4 + 2 × level armor (bosses +24, bounties and witches 10 + 3 × level, most animals 2). **Armor Crack** removes armor.
- **Exposed** targets take ×1.25.
- The foe's **physical resist** (ranged only: melee ignores it) or **spell resist** is used as stored. Past 55% it bends toward 88% and never becomes immunity.
- **Warded** foes take 15% less from everything, except melee.

### Step 4: chance rolls

These are rolled in this order:

1. **Accuracy:** the hit misses if a d100 roll is above the verse's accuracy. Misses fly visibly wide.
2. **Immune:** an element that can't hurt the target (0× on the chart) does nothing (spells ignore this).
3. **Dodge:** the foe dodges with its own dodge chance, up to 35%.
4. **Crit:** chance = verse crit + Crit Edge + class Precision + any Cat's Eye or surge bonus.
5. **Double Strike:** a second full hit lands 0.1 s later. Chance = all Double Strike combined, at most 85%.
6. **Volley:** ranged verses with the *volley* style fire 3 shots at 55% each.

### Step 5: after the hit

- **Lifesteal:** you heal your class Lifesteal % plus Leech enchantment % of the damage.
- **Leech verses** heal you 35% of the damage. In Hardcore, only spell Leech verses heal.
- **Thorned** foes return 12% of the damage to you, at most 4% of your health per hit and three times a second.
- **Waking:** any hit wakes a sleeping foe.
- **Effects:** the verse's effect is applied (see [Status Effects](Status-Effects)).

### Worked example

A level-10 witch with no gear casts a 50-power spell at an ethereal foe, with Magic level 10:

- Base: 6 + 0.42 × 50 = **27**
- Level: × 1.45
- Magic: × 1.45 × (1 + 0.025 × 9) = × 1.776
- Hide: × 1.2

That comes to **about 83 damage**, before rank, class and enchantments.

## Cooldowns

**Cooldown = max(0.28, 0.55 + power ÷ 90 − 0.08 × priority) × (1 − Swift %). Swift used to stop at 40% off. Past that it bends toward 75%.**

That is then adjusted by kind:

| Kind | Adjustment |
| --- | --- |
| Heavy and channel | ×1.7 |
| Other spells | ×1.35 × (1 − Magic cooldown reduction) × (1 − Focus %). Magic reduction is 0.113% per level and bends past 45% toward 75%. Focus bends past 35% toward 70%. |
| Melee | ×0.8 |
| Roll | at least 2.6 s |
| Ward | at least 5.5 s |
| Heal | at least 3.2 s |
| Dash | at least 1.6 s |
| Surge | at least 8 s |

Finally × (1 − class Haste). Haste used to stop at −40%/+45%. Past that it bends toward −150%/+82%. The result is never below 0.2 s. The [Verses](Verses) table lists every verse's base cooldown.

## Enemy health

Enemies are measured against you. See [Enemies](Enemies) for the full scaling rules.

**Max health = max(floor, your average hit × hits) × health multiplier**

- **Your average hit** is your strongest equipped attack × (1 + Double Strike) × (1 + 0.75 × crit chance). It is *smoothed*: it rises toward your real power over about 5 minutes (3 in Hardcore) and falls over 15 minutes.
- **Hits** comes from the enemy's kind (the table on [Enemies](Enemies)).
- **Floor** = (20 + 8 × level), ×2.5 for bosses, bounties and witches, ×1.5 for hunters, ×0.45 for animals.
- **Health multiplier** combines the foe's own health stat, ×0.55 for witch-party members, ×0.7 for summoners, shrine rounds (+25% per round), ×2 at night (Hardcore) and ×2 when enraged.

## Enemy hits

**Damage = your smoothed max health × hit share × foe damage stat × (0.85 + move power ÷ 300)**

Then:

- **Melee:** ×1.1.
- **Element (not spells):** the matchup against your **chest armor's element** (or your weapon's if no chest). Strong ×1.3, weak ×0.75, immune ×0.35.
- **Armor (not spells):** × (100 + your smoothed armor) ÷ (100 + your armor now), held between ×0.65 and ×1.35. Melee ignores your armor, so this swing never applies to it. Gear you just put on cuts ranged damage until the foes catch up.
- **Night** ×2 (Hardcore), **enraged** ×1.6, **Frenzied** below half health ×1.35.
- **Crit:** the foe's crit chance (base 3%, Brutal +15%) for ×1.75.

Then your defenses, in order (see [Defense and Evasion](Defense-and-Evasion)):

1. Ward enchantments and Ironroot Phial (bend past 45% toward 80% off).
2. Class Guard (bends past 60% toward 90% off).
3. Echo Guard chance to ignore the hit.
4. Evade, ward and roll windows.
5. Your shield absorbs the rest first.

## Experience and kyo per kill

- **XP** = (8 + 3 × foe level):
  - ×4 for bosses;
  - × (1 + XP Boost %) × (1 + class Insight %);
  - ×3 at night (Hardcore);
  - ×0.72 in Hardcore.
- **Kyo** = (2 + foe level):
  - ×6 for bosses;
  - × the foe's loot multiplier;
  - × (1 + Kyo Magnet %) × (1 + class Fortune %).

Bounties, hunters and witches carry their own loot instead. See [Bounties](Bounties).
