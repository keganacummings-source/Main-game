TURBZ — updated files (drop these onto your repo, keeping folder structure)

Every file sits at its real repo path, so dropping src/, scripts/ and public/
on top of your project overwrites exactly these and nothing else.

UPDATE 1 — TurboCircle rebuilt as one Total War siege
  src/game/arena.ts              250x250 procgen keep, capture point, attackers
                                 vs defenders, class-built armies + ghosts
  src/components/arena-ui.tsx    army composition by class + live siege HUD
  src/styles.css                 siege composition/meter styles
  src/components/hub-ui.tsx      TurboCircle tile description
  src/components/turbz-app.tsx   TurboCircle tile description

UPDATE 2 — Power-block UI crash fix + pipe direction control
  src/game/power-extra.ts        pipe flow (Auto/Output/Input/Off) in pipeStep
  src/game/engine.ts             crash fix + pipe-flow cycling   (see Update 3 too)
  src/components/game-panels.tsx "PIPE FLOW" control in machine + chest panels
  Opening a newer machine's panel threw because its "how it works" text was a
  string (or missing) where a list was expected; it is now always a list.
  Each item machine and the Storage Chest has a Pipe Flow toggle so you can
  route, e.g., a Duplicator (Output) into a Generator (Input).

UPDATE 3 — Missing in-world Power-block textures
  src/game/engine.ts             added the draw loops for the Ghost Merger and
                                 GearSet Forge (they were stored but never drawn,
                                 so they were invisible once placed)
  scripts/sprites/power-textures.py          added rockminer / ghostmerger /
                                 gearforge art + re-registered the slots
  public/MapAssets/NewTex/rockminer.png      NEW — Rock Miner drew from a file
                                 that never shipped (only blockbreaker.png did)
  public/MapAssets/NewTex/ghostmerger.png    NEW — Ghost Merger art
  public/MapAssets/NewTex/gearforge.png      NEW — GearSet Forge art
  public/MapAssets/NewTex/power-pack.json    now lists the three new slots
  (The other NewTex PNGs are unchanged and are NOT included here.)
  Regenerate any time with:  python3 scripts/sprites/power-textures.py
