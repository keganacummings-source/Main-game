# Game Modes

From the hub you can pick:

| Mode | What it is |
| --- | --- |
| **TurboHunt** | TURBZ on easy mode. The same wild, camp, build mode, Storage Chest, Ghost Box, power blocks, dungeons and world bosses as TURBZ, but with 3 to 4 calm rival witches, half damage taken, 20% less foe health and faster mana and stamina. Falling only knocks you out. It has its own save, separate from TURBZ. |
| **Hardcore** | One life. Hunger, thirst and rest, nights that double enemy strength, camp building, loot chests and the Green Cave. Enemies hit harder and keep growing. |
| **Last Man Standing** | You against 99 rival witches on Veilreach in an endless night. Everyone starts at level 1 under Hardcore rules; the last one alive wins. |
| **TurboCircle Classic** | A battle simulator — 6 v 6 on any map. |
| **TurboCircle War** | Two armies of 10–100 a side (slider) on the large Battlefield map. Armies march in formation, then break into individual fights. 100 v 100 runs at ~40 fps. |
| **Leaderboards** | The grave ledger: the top 100 fallen witches in Hunt and Hardcore, ranked by life score. Search, sort, open a name for the kit. |
| **Designer Mode** | The Map Builder and the Enemy Designer. See [Designer Mode](Designer-Mode). |
| **Options** | Account and friends. |

TurboHunt and Hardcore keep **separate saves**. Your account-wide progress (skills, account level, perks and Account Score) is shared. See [Death and Account](Death-and-Account).

> **Multiplayer removed.** There are no lobbies, P2P play, party chat or player trading. Accounts, cloud saves, leaderboards, the Shiny collection and the Discord bot are unaffected.

## Last Man Standing

- **Setup:** pick a name and class. You and 99 rivals spawn evenly spread across Veilreach. Townsfolk, quests and portals are gone; only resource nodes remain.
- **Rules:** Hardcore (one life, hunger, thirst, rest, no auto-equip, loot chests). It is **always night** and the only enemies are ghosts. Sleeping restores rest but never skips to day. You can swim.
- **Rivals** level up, spend skill points (heal → ward → dodge → attacks), gather, cook, brew potions and gear up from drops. Once a rival has a full set and is level 14+ it starts hunting other witches; after **18 minutes** everyone hunts.
- **Fighting a rival:** they kite at their best range, heal and ward when hurt, drink potions, dodge and flee to recover. A fallen rival leaves a **loot chest**.
- **HUD:** witches remaining, your kills, match time, how many are hunting, nearest rival.
- **Winning:** be the last witch standing. A typical match runs 30–40 minutes.
- **Map:** always Veilreach. In the Map Builder, **Use for my next life** can queue a custom world for your next LMS run instead.

## TurboHunt (TURBZ easy)

TurboHunt now launches the TURBZ ruleset with an `easy` flag. Every number lives in `EASY_TUNE` in `src/game/turbz-mode.ts`.

- **Camp:** press H at a campfire for the Camp menu and F for build mode: walls, floors, beds, Storage Chest, Ghost Box and power blocks, exactly as in TURBZ. Pack up camp moves it.
- **Witches:** 3 to 4 rivals (TURBZ: 10 to 15). They only go for you inside 520 px and give up past 1100 px. No secret hunter witches at level milestones.
- **Damage and health:** you take 50% damage, foes have 80% health, world bosses notice you from 900 px.
- **Mana and stamina:** refill 1.6× faster.
- **Death:** you wake at your campfire with 60% health and lose 10% of your kyo. Level, gear, skills, ghosts and camp are kept.
- **Saves:** separate from TURBZ (`turbz-easy-run-v1`, heirloom and camp keys too).

The older forgiving Hunt rules (`rules === "hunt"`) are still in the code but no longer have a hub tile.

## TurboHunt (classic) vs Hardcore

| | TurboHunt | Hardcore |
| --- | --- | --- |
| Lives | Infinite (dungeon deaths knock out, not kill) | One — death ends the witch |
| Out-of-combat healing | Yes, scales with Adventuring skill | No |
| Potions heal | Yes, in full | Yes, at ¾ strength (4 s potion cooldown in both) |
| Gear auto-equip | Yes | No — double-click to wear |
| Hunger / thirst / rest | No | Yes |
| Night | No | 15 min night, 10 min day |
| Loot chests | No — drops go straight to bag | Yes — all drops land in chests |
| Building | No | Yes (walls, beds, Ghost Box) |
| Campfire safe zones | No | Yes |
| Fast travel | No (wake at random tavern) | Yes (ringed towns on Map) |
| Skill XP rate | ×1.0 | ×2.4 |
| Enemy health/damage | Base | +20% health, +35% damage |
| Enemy traits | Base | +1 trait per foe |
| Enemy growth cap | Lower | ×2.5 |
| Bounty hunter waves | Every 90 s | Every 60 s |
| Green Cave | No | Yes (level 30+) |

Full Hardcore rules are on [Hardcore Survival](Hardcore-Survival).
