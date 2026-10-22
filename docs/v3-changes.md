# v3 — Enemy roster, NewTex merger, palette shift, void biome

Four big asks in one drop. Honest status for each is below.

## 1. New enemy roster (your 20 custom enemies replace all vanilla)

- Your `custom-enemies.json` is now the shipped file at `src/game/enemies/custom-enemies.json` (replaces the previous content).
- The engine now calls `installEnemyDesigns(allEnemyDesigns())` instead of `localEnemyDesigns()`, so the shipped file is loaded automatically on game start.
- `installEnemyDesigns()` was taught about **"custom-roster mode"**: whenever any shipped (non-replace) designs exist, `BIOME_MONSTERS` is wiped before the custom designs populate it. Vanilla enemies no longer spawn alongside your 20.
- The old `overworld: false` gating was blocking custom designs from biome tables. In custom-roster mode, the `overworld` flag is ignored and any design with a non-empty `biomes` list lands in those biome spawn pools.
- Safety: biomes left empty by your design pool get a fallback entry (the first custom enemy) so the spawn code never crashes picking from `[]`.

**v1 limitations:** boss flag is respected per enemy, but the engine's boss placement is still mostly biome-random; a dedicated boss-only placement pass would be a follow-up. Witch spawns (`witch: true`) still work through the existing witch system, untouched.

## 2. NewTex fully absorbs TURBZ (always on)

The toggle is gone — TURBZ is NewTex. Done:
- Dropped the "New Texture Mode" checkbox from the TURBZ wake screen.
- `turbz-mode.ts`: `startTurbz` now hard-codes `useNewTex = true`; the resume path forces `raw.turbzNewTex = true` on load so every current and future save migrates silently.
- `building.ts isPieceAvailable()`: the `turbz` and `turbz+newtex` gates now collapse to the same check (`mode.turbz`). The `requires` strings stay in the data for back-compat but no longer branch.
- `engine.ts placePowerPiece()`: the "NewTex off" refusal message is gone; it just checks `this.turbz`.
- Everything that used to be "TURBZ + NewTex" (power machines, custom-turbz map, new textures) now shows up on any TURBZ run.

## 3. Palette shift — any enemy as any type (the "lost mechanic")

New module `src/game/type-palettes.ts`:
- 5-shade palette per TypeId (light → dark). Lightest highlight → mid → shadow → deep → outline-adjacent.
- `retintPixels(pixels, fromType, toType)` maps each sprite pixel to its nearest slot in the source type's palette, then swaps to the same slot of the target type's palette.
- Outline-dark pixels (anywhere within RGB distance 32 of `#140e0c`) pass through unchanged — the silhouette stays crisp.

Wiring:
- `enemy-design.ts registerSprite()` now stores the base pixel data + the design's native type alongside the default canvas.
- New `typedSpriteCanvas(species, type)` returns a lazily-built retinted canvas, cached per `(species, type)`.
- `creature-sprites.ts` got a `setTypedSpriteResolver()` hook + a `customSpriteForTyped(species, type)` lookup. The render path now goes through the typed lookup, so a mob of type X with a design of type Y renders through the palette-shifted canvas.
- `enemy-design.ts` wires the resolver at module init: `setTypedSpriteResolver(typedSpriteCanvas)`. This avoids a cycle between the two modules.
- Cache clears automatically whenever `installEnemyDesigns()` reinstalls.

**Random type on spawn:** `engine.makeMob()` previously locked custom enemies to their design's native type. It now rolls a random TypeId per spawn (unless the spawner's own type-roll logic has already set one). With 20 custom enemies × 11 types, every encounter can look different.

**v1 limitations:** the palette assumes the artist drew the sprite in roughly 3-5 distinct shades of the native type's colour. If a sprite uses off-palette accent colours (e.g. a hot-pink mouth on a water enemy), those accents will be remapped by nearest match, not preserved. If a specific enemy comes out looking wrong, we can mark particular hex colours as "pass through unchanged" per enemy.

## 4. Void Biome in TURBZ NewTex

The structural work is done; **art assets are referenced but not yet in `/public/MapAssets/NewTex/`** — you'll see missing-texture fallbacks in void regions until you drop these three PNG files in:

| File | Purpose | Suggested look |
|---|---|---|
| `/public/MapAssets/NewTex/void_wall.png` | Mineable void stone | Dark purple/black stone with faint stars |
| `/public/MapAssets/NewTex/void_floor.png` | Walkable void ground | Dark purple/black ground |
| `/public/MapAssets/NewTex/tree_void.png` | Void tree | Dark twisted tree |

What's in code:
- **New `voidore` item** in `content.ts` with price 150 (vs rock_ore=10, hell_ore=18). Sells for ~15× rock ore at the Black Market.
- **Void biome added to the tex-world generator** as the 6th continent (`"void"` in `TexBiome` + `ORDER`). It gets its own BiomeDef with the void-type monsters already defined in content.ts (`kage`, `yomi`, `naraku`, `muma`), uses the three texture file names above, sits at level 61+ on the level ladder (hardest biome by position), and gets its own place on the ring (rotation now divides by 6, not 5).
- **Mining extended** (`src/game/mining.ts`): added `"void"` to `MineKind` / `MINE_XP` / `MINE_DROPS`, added `VOID_BIOME` constant (biome index 0), added `void_wall` and `void_tree` entries to the floor-after-breaking table, and added the biome check in `mineInfo()` before the hell check. Void stone drops `voidore` at **100% chance** (vs 25% for hell/rock ore) — the user's "difficult area with high reward" intent.
- **Void trees** drop VoidOre the same way (hooked via `void_tree` entry in `TEX_FLOOR`, which the mining system reads when breaking the tile).
- Mine XP for a void break is 18 (vs 16 for hell), with the usual ore-drop bonus (`ORE_BONUS_XP`).

**v1 limitations:**
- Art assets not shipped — until you drop in the three PNGs, the biome will show missing-texture fallbacks (coloured squares). Everything else — spawning, mining, VoidOre drops — works.
- No void-specific music / ambient yet.
- Void dungeons don't exist as a separate type; dungeons generated in void biome regions use the existing dungeon templates.

## Files changed in this drop

- `src/game/enemies/custom-enemies.json` — your 20 custom enemies (shipped)
- `src/game/enemy-design.ts` — custom-roster mode in `installEnemyDesigns`; typed sprite cache + resolver registration
- `src/game/type-palettes.ts` — NEW, per-type palettes + retinter
- `src/game/creature-sprites.ts` — typed-sprite resolver hook + render-path lookup
- `src/game/engine.ts` — allEnemyDesigns on install; random type on custom-mob spawn; power-piece gate simplified
- `src/game/building.ts` — isPieceAvailable collapses newtex gate
- `src/game/turbz-mode.ts` — turbzNewTex forced true (start + load)
- `src/game/content.ts` — VoidOre item
- `src/game/mining.ts` — void kind + biome drop + VoidOre pathway
- `src/game/tex-world.ts` — void biome in TEX / DEF / ORDER / ring
- `src/components/turbz-app.tsx` — NewTex checkbox removed

## Known follow-ups (deferred)

- Pipe/wire texture smartness (from v2) — still outstanding
- Super Ghost multi-type damage math + player-pickable move slate (from v2)
- Void biome art (three PNG files)
- Rock Miner art (`rockminer.png`)
- Per-enemy "preserve these hex colours" overrides for the palette shift, when a specific enemy's accent colours get mangled
