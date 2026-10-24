TURBZ — updated files (drop src/, scripts/, public/ onto your repo, keeping structure)

UPDATE 2 — Power-block UI crash fix + pipe direction control
  src/game/power-extra.ts, src/game/engine.ts, src/components/game-panels.tsx
UPDATE 3 — Missing in-world Power-block textures
  src/game/engine.ts, scripts/sprites/power-textures.py,
  public/MapAssets/NewTex/{rockminer,ghostmerger,gearforge}.png + power-pack.json
UPDATE 4 — TurboCircle World Battle Simulator
  src/game/arena.ts, src/components/arena-ui.tsx, src/styles.css,
  src/components/hub-ui.tsx, src/components/turbz-app.tsx
UPDATE 5 — Power-block + Super Ghost fixes (this batch)
  src/game/building.ts     Build-menu icons corrected: Rock Miner -> rockminer.png,
                           Ghost Merger -> ghostmerger.png, GearSet Forge -> gearforge.png
  src/game/engine.ts       * Super Ghost crash fixed: it was built as a malformed ghost
                             (missing species/template/look/move/slots/max), which crashed
                             combat/draw. It is now a complete, valid Spirit and actually
                             fights. Old saves are repaired on load (repairSuperGhost).
                           * Super Ghost now shows in the Ghost Menu (new snapshot field +
                             a SUPER GHOST card with HP and a Release button).
                           * Block labels (GEN/BAT/DUP/MERGER/FORGE/CHEST/XP/etc.) now
                             appear ONLY when you stand next to the block, so the names
                             stop overlapping on top of the machines.
  src/components/game-panels.tsx  SUPER GHOST card in the Spirits (Ghost) window.

NOTE on "Block remover": the old BlockBreaker machine was renamed to Rock Miner (it no
longer destroys tiles). The "Remove" tool (X in Build mode) still removes every placed
block/machine, including Ghost Merger and GearSet Forge. If you want a dedicated
block-BREAKING machine (the inverse of BlockGenerator) added back, say so and I'll add it.

Regenerate power textures with: python3 scripts/sprites/power-textures.py
