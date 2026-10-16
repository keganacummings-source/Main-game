# Verses

**Verses** are your attacks, spells, heals and movement skills. There are dozens across 11 elements, covering every fighting style.

## In short

- You start with your class's verses. Each level gives **3 skill points**: open **Verses** (**V**) to unlock more or rank up the ones you have.
- **Ranks** start at 1. Ranks 1–5 each add **+15%** to damage, heals and shields (rank 5 = ×1.6). Ranks past 5 keep stacking at **+8%** each. There is no rank cap.
- Equip up to **9** verses. Only equipped verses are used, by you and by auto-battle.
- Every verse has an **element**, a **tactic** (how it plays), a **form** (melee, ranged or spell), a **reach** and a **base cooldown**.
- Tapping an equipped verse on the bar opens **Upgrade**, **Move**, **Unequip** and **Cancel**. Drag slots to reorder them; Move + tap another slot swaps the two.

## Reading a verse

| Stat | Meaning |
| --- | --- |
| **Power** | Size of the hit (base damage 6 + 0.42 × power). Also lengthens the cooldown. |
| **Accuracy** | Chance to hit. |
| **Crit** | Base critical chance. |
| **Priority** | Speeds up the cooldown (0.08 s per point). Priority-2 verses can be cast while **silenced**. |
| **Effect** | Status left on the target. See [Status Effects](Status-Effects). |
| **Reach** | How far the verse reaches, in pixels (32 px = 1 tile). Foes can never reach past 240 px. |
| **Base cooldown** | Seconds between casts with no Swift, Focus, Magic skill or Haste. See [Damage and Formulas](Damage-and-Formulas#cooldowns). |

### Forms

- **Melee**: close quarters only. It works **within 2 tiles (64 px) or less** of the foe, never farther; the reach is set by the verse alone (32–64 px), blinks and lunges included. Long Reach, Far Sight and other range bonuses never stretch it. ×1.35 damage, 20% shorter cooldown, adds your weapon, and **ignores all of the target's armor and defenses** (see [Damage and Formulas](Damage-and-Formulas#step-3-armor-exposure-and-resistance)).
- **Ranged**: always beyond melee, at least **96 px (3 tiles)** and up to 340 px, adds your weapon, reduced by armor. Each ranged verse has a style:
  - **volley** fires 3 shots at 55% each;
  - **fast** is the plain style;
  - **long** adds +48 px of reach.
- **Spell**: always beyond melee, at least **96 px (3 tiles)** and typically 140–290 px, pure damage. Ignores the type chart, gear elements and armor. Scales with Magic skill (×1.45, +2.5% per level). Cooldown ×1.35, shortened by Magic and Focus.

### Tactics

| Tactic | Shape | Notes |
| --- | --- | --- |
| **Strike** | Fast hit in front | The plain attack. |
| **Heavy** | Slow, powerful hit | ×1.7 damage, ×1.7 cooldown. Locks you for 0.62 s. |
| **Channel** | Sustained beam | ×1.25 damage, ×1.7 cooldown. Locks you for 1.15 s. |
| **Blink** | Teleport 96 px | Steered by movement keys. Hops walls, hits within 72 px of landing for 0.55×. Breaks root and soak. Evade window 0.45 s. |
| **Lunge** | Charge 104 px | Steered by movement keys. Hits within 64 px, then springs back. Evade window 0.42 s. |
| **Dash** | Burst ~96 px | Steered by movement keys. Evade window 0.42 s. Clips the nearest foe for 0.6×. |
| **Roll** | Roll 48–88 px | Evade window 0.45 s. Partial cover reduces damage by distance. |
| **Heal** | Self | Restores (18 + 0.45 × power) × rank bonus. Cooldown ≥ 3.2 s. |
| **Ward** | Self | Invulnerable for 3 s + a shield of (12 + power) × rank bonus. Cooldown ≥ 5.5 s. |
| **Surge** | Self | Speed and crit buff. Cooldown ≥ 8 s. |
| **Aura** | Self toggle | Slot one, cast to switch on/off. Holds back 8–18% of your max health while active. Up to 3 at once, total cost capped at 60%. |

### Move shapes and reach bands

Verses vary much more than their tactic alone. Each has a shape with its own reach and ±20% twist:

| Shape | Reach band |
| --- | --- |
| Melee jab | 36–72 px |
| Blink / Lunge | 96–104 px travel + hit zone |
| Spell | 140–290 px |
| Ranged / Volley | 130–340 px |

Longer reach means a longer base cooldown (`moveCdFactor`). Signature verses have hand-set values. The Verses panel shows each verse's live reach and cooldown at your current ranks.

### Move signatures

Every verse has its own visual layer:

- a **cast flourish** and an **impact flourish** (pillar, shockwave, shards, cross, sigil, implosion, spike crown);
- an **accent colour**, per-verse projectile size and trail tint;
- sometimes a **companion** that spirals around the shot;
- a **status overlay** showing what it does: sleep Zs, rising roots, silence rune, flame ring, splash, gloom smoke, exposed reticle, sparks, drain motes.

A **weapon imbue** (from Legendary gear with the weapon's signature FX) adds an extra layer to every verse you cast.

### Auras

Slot an Aura verse and cast it to toggle it on or off. While on, it reserves a share of your max health (8–18% per aura; combined total capped at 60%). Up to 3 auras at once. The **Aura Ease** enchantment cuts the cost.

| Aura | Effect |
| --- | --- |
| **Aegis** | Flat damage reduction while active. |
| **Thorns** | Returns a share of damage taken to the nearest foe. |
| **Bloom** | Slow health regen while out of combat (TurboHunt). |
| **Fury** | +% damage bonus. |
| **Farsight** | Increases the reach of ranged verses and spells (melee reach is fixed). |
| **Spirit Lure** | +% catch chance. |
| **Harvest** | +% gathering yield. |
| **Gold** | +% kyo from kills. |
| *(and more)* | Each costs 8–18% of your max health. |

## The Starfall batch

Seventeen verses with animations of their own — falling stars, leaping lightning, whirlwinds, pillars, shockwave rings, boomerangs, hail, ground fissures, rune circles, grasping hands, waves and blooms. Many hit more than one foe:

- **Splash:** foes near the target take part of the hit.
- **Nova:** every foe within reach of *you* is hit (85%).
- **Chain:** the verse leaps from foe to foe, weaker each jump.
- **Boomerang:** it cuts on the way out and again on the way back.

The verse's card in the Loadout shows the exact area numbers. Ghosts that know these verses use them the same way.

<!-- gen:verse-batch -->

## All verses

<!-- gen:verses -->

## Verse ranks

The Loadout and Library show each verse's live power (or heal/ward amount) at its current rank, the rank multiplier, and what the next rank gives. Ranking up shows the new value.

- Ranks 1–5: ×1.15 per rank (rank 5 = ×1.6 total).
- Ranks past 5: +8% each, no cap.

## Under the hood

- Auto-battle (TurboHunt) picks verses every 0.3 s: heal if under 50% health → ward if under 75% with no shield → roll if under 48% and close → best attack in reach (scored by power, element advantage, form bonus, distance). See [Combat Overview](Combat-Overview).
- A verse can only be cast when it is equipped, off cooldown, something is in reach (except self-verses), you are not asleep, not silenced (unless priority-2 or a mend), and not locked into a heavy or channel.
- **Fatigue** accrues from chaining blinks, dashes, rolls and lunges. Each adds 0.45–0.75 fatigue; fatigue fades at 0.35/s. High fatigue raises the slip chance (up to 82%). See [Defense and Evasion](Defense-and-Evasion#slips-and-fatigue).
