# Combat Overview

Combat in TURBZ is **real time**. You, your spirits and every enemy act on your own clocks. Nobody waits for a turn.

## In short

- Walk toward foes. A fight starts when they notice you or when you hit them.
- **TurboHunt:** your witch casts on her own, picking the best verse that reaches the nearest foe. You can still cast any verse yourself with **1–9**.
- **Hardcore:** you cast everything yourself (or turn on **Autogrind**).
- Enemies **wind up** before every attack (a red **!**). Move away, or out of the spot they aimed at, and it misses.
- Hits land **when the effect visually arrives**, so what you see is what happens.
- Out of combat for 3 seconds, your health starts coming back (TurboHunt only).

## When a fight starts

Most monsters notice you when you come within **168 px** (about 5 tiles). Bosses notice you within 240 px, animals within 110 px. Once a foe is hurt or angry it chases you within 240 px (280 px for bosses).

Monsters have a temperament:

- **Hunters** come for you as soon as they see you.
- **Drifters** wander and ignore you until you hit them.
- **Fleeing** creatures (hares, stags, crows and some designed enemies) run away and never start a fight.

Wolves and boars fight back. See [Enemies](Enemies).

## Your side of the fight

Every **0.3 seconds** your witch gets a chance to act. In TurboHunt she picks, in this order:

1. A **heal** verse if you are under 50% health.
2. A **ward** verse if you are under 75%, have no ward up and almost no shield.
3. A **roll** if you are under 48% and a foe is within 78 px.
4. Otherwise the **best attack** that can reach the target.

"Best" scores each ready verse:

- its power, plus 6 per priority point;
- **+28** if its kind (spell or physical) matches the target's hide;
- **+18 per step** of element advantage;
- bonuses when the distance suits it: +20 for a blink beyond 48 px, +16 for a lunge between 40 and 150 px, +14 for a heavy under 60 px, +10 for a channel in range.

Your **spirits** act between your turns, every 0.2 seconds. See [Spirits](Spirits).

A verse can be cast when:

- it is **equipped** (up to 9 verses);
- it is off **cooldown**;
- something is in **reach**, unless it is a self verse like a heal, ward, roll, dash or surge;
- you are not **asleep**;
- you are not **silenced**, or it is a priority-2 verse or a mend;
- you are not locked into a **heavy** or **channel** cast.

Heavies lock you for 0.62 s and channels for 1.15 s.

## The enemy's side

Every foe has its own **kit** of 1–4 verses and attacks like a player would:

- When you are in reach and its cooldown is ready, it picks a move. Strong moves are favoured, and it only uses moves that reach you.
- It shows a **!** and winds up: 0.34 s for melee, 0.42 s for ranged, 0.55 s for spells. Bosses wind up 15% faster, **Swift** foes 20% faster, and Hardcore foes up to 30% faster at high levels.
- **Ranged and spell** attacks fly to where you stood when the wind-up began. Be more than 46 px from that spot when it lands and it misses (**DODGED**).
- **Melee** attacks miss if you are more than 62 px away when they land.
- **28%** of attacks go at one of your spirits instead of you.

Time between a foe's attacks is the **same base cooldown a hunter gets for that verse** (see [Cooldowns](Damage-and-Formulas#cooldowns)): max(0.28, 0.55 + power ÷ 90 − 0.08 × priority), then ×1.7 for heavy and channel verses, ×1.35 for other spells and ×0.8 for melee. A quick power-40 bite comes about every 0.8 s; a power-90 spell about every 2 s.

Each verse in a foe's kit also goes on that cooldown after use, so a foe with several moves rotates through them. **Swift** and **enraged** foes attack 15% faster each, and there is a random ±5%. A foe that just noticed you waits 0.3–0.8 s before its first strike.

## Leaving a fight

Each hit you deal or take sets a 3-second **combat timer**. When it runs out you are out of combat:

- **Health regenerates** (TurboHunt only), at 1.2 + 0.15 × Adventuring level per second, adjusted by your class's Recovery stat.
- Spirits recover 6 health per second.

Foes that go more than 1200 px from you pause until you come back.

## Where to go next

- [Damage and Formulas](Damage-and-Formulas): exactly how much each hit does.
- [Defense and Evasion](Defense-and-Evasion): wards, rolls, blinks and what reduces damage.
- [Status Effects](Status-Effects): burn, sleep, root, silence and immunity.
- [Verses](Verses): every attack and spell in the game.
