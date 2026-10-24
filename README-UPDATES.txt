TURBZ — updated files (drop src/, scripts/, public/ onto your repo, keeping structure)

Every file sits at its real repo path. These are the only files changed.

UPDATE 1 — TurboCircle, first pass (now superseded by Update 4)
UPDATE 2 — Power-block UI crash fix + pipe direction control
  src/game/power-extra.ts        pipe flow (Auto/Output/Input/Off) in pipeStep
  src/game/engine.ts             crash fix + pipe-flow cycling
  src/components/game-panels.tsx "PIPE FLOW" control in machine + chest panels
UPDATE 3 — Missing in-world Power-block textures
  src/game/engine.ts             draw loops for Ghost Merger + GearSet Forge
  scripts/sprites/power-textures.py          rockminer / ghostmerger / gearforge art
  public/MapAssets/NewTex/rockminer.png      NEW
  public/MapAssets/NewTex/ghostmerger.png    NEW
  public/MapAssets/NewTex/gearforge.png      NEW
  public/MapAssets/NewTex/power-pack.json    now lists the three new slots

UPDATE 4 — TurboCircle becomes a WORLD BATTLE SIMULATOR
  src/game/arena.ts              one 450x450 TURBZ-textured continent (no islands,
                                 single landmass). Named factions each hold named
                                 Regions anchored on Objectives; combat witches
                                 march out and fight (1v1 up to 10v10) all over the
                                 map at once; non-combat witches harvest materials
                                 and carry them home to recruit more witches. Win
                                 when one faction holds the whole continent.
                                 Includes a full-continent minimap (click to pan)
                                 since the map is far too big to show at once.
  src/components/arena-ui.tsx    observer HUD: faction standings (regions / combat /
                                 harvesters / materials), event log, follow-faction,
                                 jump-to-battle, speed up to 6x, setup sliders.
  src/styles.css                 world-sim standings + log styles
  src/components/hub-ui.tsx      TurboCircle description
  src/components/turbz-app.tsx   TurboCircle description

Regenerate power textures any time with: python3 scripts/sprites/power-textures.py
