# New Texture Mode (TURBZ)

A checkbox on the TURBZ character screen. When it is on, the run uses:

- **A new world generator** (`src/game/tex-world.ts`): 450×450, five continents in an ocean, one biome each,
  on the usual level ladder: Plains (1), Desert (13), Jungle/Swamp (25), Snow (37), Hell (49). Plus a few small
  isles and a temple isle in the middle. Ocean is shallow `Water` near land and `DeepWater` beyond; Hell has lava.
- **Only the new textures**, in `public/MapAssets/NewTex/` (the turbz-asset-pack art). The old tiles are never used.
- **Full-size trees and portals.** 64×64 art is drawn at its natural size, standing on its tile
  (`drawTallArt` in `tile-atlas.ts`), after the ground so neighbours never paint over it. Trees stay choppable.
- **Dungeons too.** Rifts, the Crypt and the Kiln are re-skinned by `retextureDungeon` when loaded.
  Layout, foes and pads are untouched; floors, walls, liquids, trees, chests and portals change.

The choice is saved with the run (`save.turbzNewTex`), so Continue rebuilds the same world from the same seed,
and a new life after death keeps the mode. Turning it off plays the classic wild.

## Art that is derived, not in the pack

The pack has one tree each for plains, swamp and desert, and no log. `tree_snow.png`, `tree_hell.png` and
`log.png` were made from the pack's own trees (recoloured / redrawn). Replace those three files with real art any time.

## Tests

`scripts/tex-world.test.mjs`: files exist, worlds are deterministic and use only new art, every open tile is reachable,
dungeons keep their layout and use only new art.

## Power block art and Mining XP

- `hellgen.png`, `battery.png`, `wire.png`, `xpgen.png` and `duplicator.png` in `public/MapAssets/NewTex/` are the default art for the Power blocks.
  They are drawn by `scripts/sprites/power-textures.py` (re-run it after editing). A Live texture painted in the Tile Builder replaces them (`powerArt` in `camp-assets.ts`).
- Breaking a block pays Mining skill XP (`MINE_XP` in `mining.ts`, bonus `ORE_BONUS_XP` when an ore drops). The engine calls `gainSkill("mining", mineXp(...))` in `tryMine`.
