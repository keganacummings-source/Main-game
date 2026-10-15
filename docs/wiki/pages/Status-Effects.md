# Status Effects

Verses can leave effects on whoever they hit. The same rules apply to you and to every enemy.

## In short

- **Nothing stacks.** Hitting someone with the same effect again only refreshes it.
- **Hard control** (sleep, root, silence) is short and **can't be chained**. When it ends, the target is **immune** to that effect for a while.
- **Bosses, bounties, witches and hunters** shake off hard control twice as fast.
- **Counters:**
  - any hit wakes a sleeper;
  - blink breaks roots;
  - mashing keys shakes off sleep and roots;
  - Cleanse clears everything.

## All effects

<!-- gen:status-table -->

## Immunity

When **sleep**, **root** or **silence** ends, the target becomes immune to that effect. Your effects bar shows "Sleep immune" with a timer. Ways it can end:

- it runs out;
- it is broken (a hit wakes a sleeper, a blink breaks a root);
- it is cleansed.

| Effect | Longest it can last | Immunity after |
| --- | --- | --- |
| Sleep | 2.5 s | 7 s |
| Root | 2.5 s | 5 s |
| Silence | 3 s | 6 s |

While immune, new attempts show **RESIST**.

Other rules:

- A hard-control effect that is already on someone cannot be extended.
- Tough foes (bosses, bounties, witches, hunters) get **half** the duration and **30% longer** immunity.

## Counters

| Effect | Counter |
| --- | --- |
| **Sleep** | Any damage wakes you (**AWAKE**). Each key press while asleep shaves 0.3 s off. Unshakable trait = immune. |
| **Root** | Any **blink** breaks it (**BREAK FREE**). Each key press shaves 0.18 s off. You can still cast. |
| **Silence** | Priority-2 verses and mends still work. |
| **Burn** | Cleanse; shields soak burn damage; Survivor trait = immune. A new flame does not restart one already burning. |
| **Soak** | Blink clears it; Survivor trait = immune. |
| **Everything** | **Cleanse Salt** (item) or a **Cleanse** verse clears every harmful effect, and the hard-control ones leave immunity behind. Spirits with Cleanse use it on you 70% of the time when you have an effect. |

## Under the hood

- **Effect duration** from a verse is 3.2 s + 0.3 s × priority, then capped as above.
- Each class can be **immune** to some effects (shown on the class card), and so can some traits. See [Classes](Classes) and [Races and Traits](Races-and-Traits).
- **Burn on foes** deals max(6, 1% of max health) per second.
- **Sleeping foes** don't move or attack. Your own hits wake them, so open with sleep and then reposition, rather than hitting straight away.
- **Silenced foes** drop every spell from their kit until silence ends. Silence is strongest on spell-heavy foes (Void, Light, Fire, Electric).
- **Spirit cleanse:** see [Spirits](Spirits).
