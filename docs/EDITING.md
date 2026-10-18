# Editing TURBZ V7

A navigator for the codebase. "I want to change X — where do I go?"

## Quick lookup

| I want to change… | Edit this file | What to look for |
| --- | --- | --- |
| A class's stats, element, role, or signature R-skill | `src/game/classes.ts` | The `CLASSES` array near the top. One line per class. |
| A class's two class perks | `src/game/classes.ts` | `NEW_PERKS` array. Each perk's `cls:` says which class owns it. |
| The Crying Girl's sprite | `src/game/actor-sheets.config.ts` | `CHARACTERS["warrior:cryinggirl"]`. She uses the class sheet, same as every other class. Gear FX are drawn by `tryDrawActorSprite`. |
| An armor set's set-bonus text | `src/game/content.ts` | `SET_ROWS` — third string in each `[name, fx, bonus]` row. |
| A class's signature (ex-"legacy") passive | `src/game/classes.ts` | `basePassive:` on that class's row. |
| The Crying Girl's R-skill menu | `src/game/classes.ts` | `GIMMICKS` registry + `CRY_RSKILLS` list. |
| What a gimmick (R-skill) actually does | `src/game/class-gimmicks.ts` | Each gimmick has its own function. |
| A verse / spell / weapon ability | `src/game/class-kits.ts` + `src/game/content.ts` (`MOVES`) | `KIT_MOVES` for assignments, `MOVES` for stats. |
| Enemy stats, moves, or loot | `src/game/content.ts` | `MONSTERS`, `ENEMY_MATS`, `SCRAP_LOOT`. |
| Boss sprites or scale | `src/game/boss-sprites.ts` | `BOSS_SHEETS` map. |
| Boss who shows up as which type | `src/game/boss-sprites.ts` | `BOSS_BY_TYPE`, `BOSS_BY_ENEMY`. |
| Items, potions, consumables | `src/game/content.ts` (`ITEMS`) + `src/game/item-use.ts` | Content list and the eat/drink effect. |
| Alchemy recipes | `src/game/content.ts` | `ALCHEMY_RECIPES`. |
| Camp cooking recipes | `src/game/survival.ts` | `CAMP_RECIPES`. |
| Day/night timing | `src/game/daynight.ts` | `DAY_SECONDS`, `NIGHT`, `isNight()`. |
| Base balance numbers (XP curve, damage, drops) | `src/game/balance.ts` | Named constants at the top. |
| Dungeon generation (room shapes, loot) | `src/game/procedural-dungeon.ts` + `src/game/map-gen.ts` | — |
| The hand-made worlds (Veilreach, Green Cave) | `src/game/maps/*.json` | Edit via the in-game Map Builder, then export. |
| HUD, menus, inventory panels | `src/components/*.tsx` | One file per panel. |
| Character / class-pick screen | `src/components/character-ui.tsx` | — |
| Map Builder UI | `src/components/map-builder*.tsx` | Split across tiles / entities / quests. |
| Combat visuals (hit sparks, trails) | `src/game/combat-fx.ts` + `src/game/fx-paint.ts` | — |
| Sound effects | `src/game/sfx-bank.ts` | Synth definitions; names are strings. |
| Music tracks | `public/music/` + `MUSIC_TRACKS` in `src/game/engine.ts` | Drop in a new `.ogg`, add its filename to the array. |
| Save slot format | `src/game/account-save.ts` + `src/game/account-progress.ts` | — |

## Big engine file

`src/game/engine.ts` is the main loop (12.5k lines). It's the hot path for combat, movement, FX, input, and world ticks. Avoid editing it for pure data changes — those almost always live in `content.ts`, `classes.ts`, `balance.ts`, or `survival.ts` instead.

If you do need to edit it, the top-of-file imports show every subsystem the engine pulls from — scan them to find the right collaborator before changing the engine itself.

## Where perks live now

V7 merged the old "legacy perks" into the base perk pool.

- Every class's **class perks** are in `NEW_PERKS` (two per class).
- Every class also contributes a **signature perk** named `base_<classId>` — automatically generated from its `basePassive` text. These are available in the Crying Girl's builder, same as any other perk, with no "Legacy" tab.
- Old saves that stored `legacy_<classId>` perks are remapped to `base_<classId>` on load.

## Adding a new class

1. Add a row to `CLASSES` in `src/game/classes.ts`.
2. Add its two class perks to `NEW_PERKS` in the same file.
3. Add its R-skill to `GIMMICKS` and implement it in `src/game/class-gimmicks.ts`.
4. Add its starter kit to `STARTER_KITS` in `src/game/class-kits.ts`.
5. Pick an existing sprite id for `sprite: one("warrior:yourid")` or add one to `src/game/actor-sheets.config.ts`.

## Crying Girl's sprite

The Crying Girl uses her original class-sheet sprite (`warrior:cryinggirl` in `src/game/actor-sheets.config.ts`), the same path as every other class. Gear FX and the full-set aura draw on her through `tryDrawActorSprite` in `src/game/actor-sprites.ts`. The Lidia paper-doll and the per-piece armor silhouettes are gone.

Set bonuses live in `SET_ROWS` in `content.ts` as the third string of each row. They're displayed in three places now: the WORN block of the inventory (active set), each gear card (that gear's set), and each row of the set-progress list (name · bonus).

## Adding a new boss

1. Add a sprite entry to `BOSS_SHEETS` in `src/game/boss-sprites.ts`.
2. Drop the PNG under `public/sprites/bosses/`.
3. Add the boss's enemy row to `MONSTERS` in `src/game/content.ts`.
4. Map it to its type in `BOSS_BY_TYPE` (and `BOSS_BY_ENEMY` if a specific encounter).

## Build / verify

```bash
npm install
npm run typecheck   # TypeScript — note engine.ts has @ts-nocheck
npm test            # Unit tests
npm run map:audit   # Checks every built-in map parses
npm run dev         # Local server at http://localhost:8080
npm run build       # Static bundle in dist/
```
