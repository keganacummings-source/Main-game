TURBZ — updated files (drag the `src` folder onto your repo to overwrite)

These are ONLY the files changed across the two updates. Each sits at the same
path it has in the repo, so dropping the `src` folder on top of your project
(keeping folder structure) overwrites exactly these and nothing else.

UPDATE 1 — TurboCircle rebuilt as one Total War siege
  src/game/arena.ts            siege engine: 250x250 procgen keep, capture point,
                               attackers vs defenders, class-built armies + ghosts
  src/components/arena-ui.tsx  setup (army composition by class) + live siege HUD
  src/styles.css               siege composition/meter styles (also kept below)
  src/components/hub-ui.tsx    TurboCircle tile description
  src/components/turbz-app.tsx TurboCircle tile description

UPDATE 2 — Power blocks crash fix + pipe direction control
  src/game/power-extra.ts      pipe flow (Auto/Output/Input/Off) in pipeStep
  src/game/engine.ts           crash fix (how-text normalised) + pipe-flow cycling
  src/components/game-panels.tsx  "PIPE FLOW" control in the machine + chest panels
  src/styles.css               (shared with Update 1)

The power-block crash: the machine panel expected its "how it works" text as a
list, but the newer machines supplied a single string (or none), so opening them
threw. The text is now always normalised to a list.

Pipe direction: every item machine and the Storage Chest now has a Pipe Flow
toggle — Output pushes items out, Input only receives, Auto does both, Off
ignores pipes. Set a Duplicator (or Chest) to Output and a Generator to Input to
pipe one into the other.
