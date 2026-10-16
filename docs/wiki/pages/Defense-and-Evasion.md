# Defense and Evasion

Not getting hit is as important as hitting. This page covers every way to avoid or reduce damage.

## In short

- Watch for the **!** wind-up and move. Ranged attacks and spells go where you **were**; melee needs you close.
- **Dash, roll, blink and lunge** give a short window where hits can't touch you, and wipe incoming melee hits.
- **Ward** verses make you untouchable for 3 seconds and give a shield.
- **Armor** matters more than you think: foes adapt to it slowly, so new armor is a real upgrade for a while.

## Dodging by moving

Every enemy attack has a wind-up (see [Combat Overview](Combat-Overview)).

- **Ranged and spells** are aimed at the spot you stood on when the wind-up began. Be more than **46 px** from that spot when it lands and you dodge it.
- **Melee** misses if you are more than **62 px** away when it lands.
- An attack started while you were out of its reach always misses.
- Every dodge gives a little Adventuring experience.

## Defensive verses

Movement verses are **free**: they go where you steer, not onto a foe. Hold a direction while you cast. With no direction held they follow your click-to-move path or the way you face. Auto-battle aims them toward its target.

| Verse type | What you get | Slip chance |
| --- | --- | --- |
| **Dash** | Burst ~96 px (more with speed) where you are moving. 0.42 s evade window. Wipes incoming melee hits that are not right on top of you. Clips the nearest foe for 0.6×. Can't be used while rooted. | 14% |
| **Roll** | Roll 48–88 px. 0.45 s evade window. Wipes incoming melee. Damage taken during the roll is cut by how far you got. | 14% |
| **Blink** | Teleport 96 px the way you steer (movement keys or stick), or the way you face. It can hop over a wall. It hits the nearest foe within 72 px of where you land for 0.55×. Breaks **root** and **soak**. 0.45 s evade window. Wipes incoming melee. | 24% (only with a foe in range) |
| **Lunge** | Lunge 104 px the way you steer or face (stops at walls), hit the nearest foe within 64 px for 0.72×, then spring back. 0.42 s evade window. | 24% |
| **Ward** | 3 s where no hit hurts you (**WARD**), plus a shield of (12 + power) × rank bonus. | — |
| **Shell** effect | Shield of 20 + power and a 1.2 s ward. | — |
| **Heal** | Restore (18 + 0.45 × power) × rank bonus. | — |

### Slips and fatigue

Rolls, dashes, blinks and lunges can **slip**:

- A slipped **roll** is a **TRIP**: you barely move and take **24% more** damage.
- A slipped **dash** is a **SLIP**: you move 18 px with no evade.
- A slipped **blink** is a **SNAG**: you only travel 36 px, with no evade, and the hit lands at 0.24×.
- A slipped **lunge** is a **SNAG**: you only travel 40 px, and the hit lands at 0.22×.

The chance rises with **fatigue**: chaining defensive verses stacks it, at +14% slip chance per point, up to 82% total.

| Action | Fatigue |
| --- | --- |
| Dash | +0.5 (+1 if it slips) |
| Roll | +0.75 (+1.15 if it slips) |
| Lunge | +0.45 (+1 if it slips) |
| Clean blink | −0.2 |
| Snagged blink | +1 |

Fatigue fades at 0.35 per second. Space your dodges out.

### Roll cover

How much of a blow a roll avoids depends on distance travelled versus the attacker's reach. You need to cover at least 40 px, or 38% of the reach.

- **Full cover:** the hit is cleared (**CLEAR**).
- **Partial cover:** damage × (1 − 0.85 × cover). This shows as **GRAZE** above 55% cover, **CLIP** below.

## Damage reduction, in order

Against a **melee** hit, Ward, Guard and the Shell status are ignored completely (melee ignores all defenses). Items 3 to 7 still apply.

1. **Ward** enchantment: damage × (1 − Ward ÷ 160). An **Ironroot Phial** adds 20%. Together they used to stop at **45%** off. Past that the reduction still grows but bends toward **80%** and never reaches it.
2. **Guard** (class and trait stat): the old knee is **60%** off. Past that it bends toward **90%**. A negative Guard bends toward **80%** more damage taken (the old knee was 50% more).
3. **Echo Guard**: a chance to ignore the whole hit (**ECHO**). The old knee is **40%**. Past that it bends toward **75%** and never becomes certain.
4. **Evade window** (dash, roll, blink, lunge): the hit is ignored (**EVADE**).
5. **Ward window**: the hit is ignored (**WARD**).
6. **Roll**: partial or full cover, as above.
7. **Shield** soaks what is left first.

### Armor

Your armor is the sum of your head, chest, legs, feet and relic. Each armor piece gives 8 + 2 × level + 5 × quality rank, plus Plating. A relic gives 3 + level ÷ 2, plus Plating.

Foes compare your armor **now** with a **smoothed** copy that catches up over about 5 minutes (3 in Hardcore). New armor reduces physical damage by up to 35% until they catch up. Armor never stops spells.

### Your armor's element

Enemy melee and ranged hits are checked against your **chest piece's element** (your weapon's if you have no chest). Choose a chest that resists the area you are fighting in. See [Elements](Elements).

## Last-ditch saves

- **Second Chance**: once per life, a killing blow leaves you at 1 health. It also puts out burning.
- **Thorns**: returns up to 35% of damage taken to the nearest foe.
- **Smoke Bomb**: steps you back out of a fight.
- **Campfire safe zone** (Hardcore): nothing can enter a 15×15-tile zone around your campfires, and hits inside it are **SAFE**.
