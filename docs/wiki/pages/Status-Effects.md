# Status Effects

Verses can leave effects on whoever they hit. The same rules apply to you and to every enemy.

## In short

- **Nothing stacks.** Hitting someone with the same effect again only refreshes it.
- **Hard control** (sleep, root, silence) is short and **can't be chained**. When it ends, the target is **immune** to that effect for a while.
- **Bosses, bounties, witches and hunters** shake off hard control twice as fast.
- **Counters:**
  - any hit wakes a sleeper;
  - blink breaks roots and soak;
  - mashing keys shakes off sleep and roots;
  - Cleanse clears everything and grants immunity.

## All effects

| Effect | What it does | Duration |
| --- | --- | --- |
| **Burn** 🔥 | Deals max(6, 1% of max health) per second. Does not refresh itself — a new flame does nothing while one is already burning. Cleanse Salt puts it out. Shields soak burn damage. Survivor trait = immune. | 15 s |
| **Sleep** 💤 | Target can't move or attack. Any damage wakes them (**AWAKE**). Mashing keys shaves 0.3 s off. Unshakable trait = immune. | Up to 2.5 s |
| **Root** 🌿 | Target can't move, but can still cast. Blink breaks it (**BREAK FREE**). Mashing keys shaves 0.18 s off. | Up to 2.5 s |
| **Silence** 🔇 | Target can't cast spells. Priority-2 verses and mends still work while silenced. Silenced foes drop every spell from their kit. | Up to 3 s |
| **Soak** 💧 | Slows movement to 62% of normal. Blink clears it. Survivor trait = immune. | Varies by verse |
| **Gloom** 🌑 | Target deals 20% less damage. | Varies by verse |
| **Exposed** 🎯 | Target takes 25% more damage from all sources. | Varies by verse |
| **Shell** 🛡️ | Grants a small shield and a 1.2 s ward window. | Instant |

## Immunity

When **sleep**, **root** or **silence** ends — however it ends — the target becomes immune to that effect for a window. Your effects bar shows "Sleep immune" with a countdown. Any new attempt shows **RESIST**.

| Effect | Max duration | Immunity after |
| --- | --- | --- |
| Sleep | 2.5 s | 7 s |
| Root | 2.5 s | 5 s |
| Silence | 3 s | 6 s |

Other rules:

- A hard-control effect already on someone **cannot be extended** by a second hit.
- **Tough foes** (bosses, bounties, witches, hunters) get **half** the duration and **30% longer** immunity.
- Effect duration from a verse is 3.2 s + 0.3 s × priority, then capped as above.

## Counters

| Effect | Counter |
| --- | --- |
| **Sleep** | Any damage wakes you (**AWAKE**). Mash keys to shave it off. Unshakable trait = immune. |
| **Root** | **Blink** breaks it instantly (**BREAK FREE**). Mash keys to shave it off. You can still cast. |
| **Silence** | Priority-2 verses and mends still work. |
| **Burn** | Cleanse or Cleanse Salt; shields soak burn damage; Survivor trait = immune. A new flame does not restart one already burning. |
| **Soak** | Blink clears it; Survivor trait = immune. |
| **Everything** | **Cleanse Salt** (item) or a **Cleanse** verse clears every harmful effect. Hard-control effects that are cleansed leave their full immunity behind. Spirits with Cleanse use it on you 70% of the time when you have an effect. |

## Under the hood

- Each class can be **immune** to some effects (shown on the class card), and so can some traits. See [Classes](Classes) and [Races and Traits](Races-and-Traits).
- **Sleeping foes** don't move or attack. Your own hits wake them, so open with sleep and then reposition rather than hitting straight away.
- **Silenced foes** drop every spell from their kit until silence ends. Silence is strongest on spell-heavy foes (Void, Light, Fire, Electric).
- **Spirit cleanse:** spirits with a Cleanse verse will use it on you (70% of the time) when you have any harmful effect.
- **Burn on foes** deals max(6, 1% of max health) per second for 15 seconds. It no longer refreshes itself.
