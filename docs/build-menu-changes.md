# Build-menu cleanup + new Power machines

This drop combines:
1. The build-menu data cleanup from the first delivery
2. The build-bar overflow fix (your Power row was running into the HUD buttons)
3. BlockBreaker → Rock Miner replacement
4. New Ghost Merger machine
5. New GearSet Forge machine (with +5-enchant MegaSet mechanic)

## Build-bar overflow fix

Your screenshot showed the Machines row running off the right edge into "Combat manual / Autoplay / Unstuck". Three CSS changes together handle this:

- Bar width is now `min(1360px, calc(100vw - 180px))` instead of `min(980px, calc(100vw - 16px))` — gives the Power row the room it needs without hiding under HUD buttons on the right.
- Each sub-group's pieces (`.build-bar-pieces`) now `flex-wrap: wrap` so a long row drops to a second line instead of overflowing.
- The Power column cluster takes its own full-width row below Walls/Floors/Doors/Furniture (`.build-bar-column-power { flex: 1 1 100% }`), so narrow screens stack cleanly.

Result: all 7 Power Machines (now including Ghost Merger and GearSet Forge) fit, and the HUD stays clear.

## BlockBreaker → Rock Miner

Replaced in place:
- `blockbreaker` → `rockminer` across `building.ts`, `power-extra.ts`, `engine.ts`, and the texture-pack system.
- Behaviour: faces a natural rock, sand, dirt or hell-rock tile; every 3 seconds + 1 Power produces one ore via `rollMineDrop`. **Does not destroy the tile** — the resource trickles forever.
- Same cost, same pipe-source wiring (feeds chests), same facing/rotation controls.
- Save migration: existing BlockBreaker placements auto-convert to Rock Miner on load via `LEGACY_KINDS` in `sanitizePowerExtra`. Their buffer, direction and position are preserved.
- Texture: still uses `blockbreaker.png` as its preview art (that file is already on disk). Dropping a new `rockminer.png` into `/public/MapAssets/NewTex/` will swap the icon automatically — update the `preview: tex("blockbreaker.png")` line in `building.ts` to point at it.

## Ghost Merger

New machine. Follows the Duplicator pattern (own save array `save.powerMergers`).

- Cost: `hell_ore: 6, ore: 6, timber: 4, wire: 4`
- Press **E** to open its panel. Shows your party, your Ghost Box, the merger's queued ghosts, and the Super Ghost in progress.
- Click **Feed** on any ghost → it moves into the merger's queue (max 10).
- Every 8 seconds while powered (3 Power), consumes one queued ghost:
  - Adds its type to the super's `types[]` (dedup, cap 11 — all elements possible)
  - Grafts one of its abilities (prefers a new one; otherwise ranks up a duplicate)
  - Learns all its known moves (dedup, cap 50)
  - Super's level = max(super, input)
- After **5 fused**, the Extract button lights up.
- Extracting writes `save.superGhost` and overwrites any previous Super Ghost (confirmed via chat line).
- The Super Ghost joins `activeSpirits()` **outside the party cap** — always with you until it falls. Combat uses its first type and up to 10 active moves (from `movesKnown`).

Picking up the machine returns all queued ghosts to the Ghost Box so nothing is lost; an in-progress super is discarded with a chat warning.

### v1 limitations worth knowing
- The Super Ghost's combat uses only its primary type (first in `types[]`) for damage calcs. Multi-type damage math is a bigger engine change for a follow-up.
- The player can't yet re-pick which 10 of the 50 known moves are active — the engine takes the first 10. Add a UI picker when you want manual control.
- Overwriting an existing Super Ghost is immediate (no confirm dialog yet) — the chat line warns you after the fact.

## GearSet Forge (gearforge)

New machine. Crucible model — pour gear in, pull a better set out.

- Cost: `hell_ore: 8, ore: 10, wire: 4`
- Press **E** to open its panel. Shows pile count, cast cost, and dump buttons.
- Three dump actions:
  - "Dump 1" (not exposed in the panel — call `game.forgeDump(gear.uid)` from the Gear menu to add it)
  - **"Dump all unequipped"** — melts every gear piece in your bag that you aren't wearing
  - **"Dump EVERYTHING"** — includes equipped pieces (with a browser confirm dialog)
- Running tally: `pieces`, `levelSum`, `qualitySum`, `enchantPool`, `enchantPowerSum`, `types`.
- **Cast**: minimum 6 pieces (one for each slot). Power cost: `12 × pieces, min 50`.
- Output: 6 new gear pieces (one per slot) with shared `setId`.
  - Level = `round(avg level) + volume bonus` (0 at 6 pieces, +1 per 6 extra, capped at +10)
  - Quality = `avg quality bumped up one tier at ≥18 inputs, two tiers at ≥36`
  - Normal enchants rolled via existing `rollGear()` path
  - **+5 bonus enchants per piece** drawn from the input pool (weighted by what you fed in), powered via `rollEnchantPower()`, pushed directly onto the piece — these bypass `MAX_GEAR_ENCHANTS` (20)
- **MegaSet** at ≥36 inputs (= 6 full sets dumped):
  - `setId` prefixed `mega-`
  - Legendary quality floor
  - Each piece marked `forgeMega: true` (for future UI badge)
- This is the only path in the game that produces gear over the enchant cap.

### v1 limitations worth knowing
- Dumping one specific piece needs a UI hook in the Gear (I) menu — the engine method `game.forgeDump(uid)` exists; the Gear UI button isn't wired yet.
- Enchants on `forgeMega` pieces don't have a visual badge yet in the Gear tooltip.

## Where every change landed

| File | Why |
|---|---|
| `src/game/building.ts` | BlockBreaker def removed, Rock Miner + Ghost Merger + GearSet Forge defs added |
| `src/game/power-extra.ts` | New `rockminer` kind, legacy migration, new `GhostMergerNode` + `GearForgeNode` types, sanitizers, merge/pick helpers |
| `src/game/engine.ts` | runBlockBreaker → runRockMiner (new behavior), place/remove routing, tick methods, open/feed/extract/dump/cast methods, powerView extension, activeSpirits injects Super Ghost |
| `src/components/game-panels.tsx` | PowerPanel renders Ghost Merger and GearSet Forge sections; blockbreaker branch renamed to rockminer with updated copy |
| `src/components/camp-asset-builder.tsx` | Custom-texture slot list updated for rockminer + new machines |
| `src/game/camp-assets.ts` | Power texture slot renamed from "BlockBreaker" to "Rock Miner" |
| `src/styles.css` | Build-bar width + wrap fixes (your overflow bug) |

## Save compatibility

- Existing BlockBreaker placements auto-convert to Rock Miner on load. No data loss.
- `save.powerMergers`, `save.powerForges`, `save.superGhost` are new optional fields. Old saves without them continue to work; they're lazily created when the player first places/extracts.

## Camp persistence on TURBZ death

**Found a pre-existing bug while adding the new machines:** `turbzCampBlueprint()` only serialized logs, beds, chest, ghostBox and ghostStore. **Every power machine was being dropped on TURBZ death** — HellStone Generators, Batteries, Wires, Duplicators, XP Producers, and all the "extras" (LogBurner, Solar, Capacitor, BlockGen, Rock Miner / BlockBreaker, Tesla, Pipes). Not just the new Ghost Merger / GearSet Forge.

Fixed in `src/game/turbz-mode.ts`:
- `turbzCampBlueprint()` now serializes every power-machine save array with relative-to-fire offsets, carrying each piece's full internal state (ore in generators, items in duplicators, the merger's queue and super-in-progress, the forge's pile tally, the pipe network's wire layout).
- `packTurbzCamp()` now lifts every power machine off the world (same as it does for logs, beds and chests), so nothing is double-placed when the camp drops back.
- `restoreTurbzCamp()` puts each power piece back relative to the new fire, with the same bounds + duplicate-tile checks the other items use.
- `stashTurbzKit()` now preserves `save.superGhost` through death as part of the heirloom (reset to level 1, maxHp quartered — follows the same pattern as party ghosts).
- `giveTurbzHeirloom()` restores the Super Ghost at full HP on the new life.

So: **once built, your camp (campfire + walls + floors + doors + beds + chest + Ghost Box + every Power machine) persists through TURBZ death**, same as the chest contents already did. The Super Ghost also returns at level 1 with its types/abilities/known-moves intact.

## Known follow-ups

- **Pipe & Wire textures: straight-lines-and-corners-only mode.** You asked for pipes/wires to pick cleaner textures so there are no "offshoots into nothing" from tees and crosses. The current `pipeShapeName()` returns `lonely | end | straight | corner | tee | cross` and `paintPipe()` draws arms for every connection. I didn't change this blind — the right heuristic (do tees collapse to straights visually, or should the pipe network auto-route to never form tees?) is easier to decide once you can see the current look. One-session fix once we agree on the behaviour; most-likely approach is: when a pipe has 3 or 4 connections, render it as a straight through whichever opposite pair exists, and skip the "stub" arms (while keeping the actual item-flow connectivity intact — so items still flow through all branches, just the visual drops the stubs).
- **Super Ghost combat extensions.** v1 uses the primary type for damage calcs and takes the first 10 of 50 known moves as active. Multi-type damage and a player-pickable move slate are follow-ups.
- **Rock Miner texture.** Still uses `blockbreaker.png`. Drop a `rockminer.png` into `/public/MapAssets/NewTex/` and change one line in `building.ts` to swap.

## Adding more machines later

Same pattern as `ghostmerger` and `gearforge`:
1. One object in `BUILD_PIECE_DEFS` (`building.ts`) — groups/hotkey/menu pick up automatically.
2. One `save.powerXxx[]` array (follow Duplicator pattern) OR add to `powerExtra[]` (follow BlockGen/Tesla pattern) depending on how much state it carries.
3. Routing in `setBuildPiece`/`placePowerPiece`/`removePowerPiece` + the two `extraAt`-adjacent remove blocks.
4. A tick method, called from the main power tick alongside `tickDuplicators`.
5. Open/interact methods, routed through `powerOpen` + `powerNode()` + `powerView()`.
6. A section in `PowerPanel` keyed to `p.kind === "xxx"`.
