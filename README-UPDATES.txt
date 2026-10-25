TURBZ — updated files (drop src/, scripts/, public/ onto your repo, keeping structure)

LATEST — two things:

A) TurboCircle world sim: fiercer + self-renewing
  src/game/arena.ts
   * Thin garrisons; everyone else attacks as SQUADS hitting many objectives at once.
   * Squad cohesion (units march in a clump) + wide engagement (460px) so field
     battles happen all over, not just on points.
   * Bigger starting forces, cheaper/faster recruiting = a busier war.
   * Every 5 minutes a fresh neutral objective rises on random reachable land,
     so the fighting never stalls.

B) TURBZ2 (Stage 1 of the staged plan): the playable war world
  src/game/turbz-mode.ts   startTurbz2 + nations: each of 5 witch nations gets a
                           City; every rival witch is sworn to her nearest nation.
                           Same nation = allies, different = enemies, so the powers
                           war on each other around you. Resume supported.
  src/game/engine.ts       draws the nation Cities on the map. A city's banner is
                           grey ("CITY") until you walk up to it (within ~220px),
                           then it reveals the nation's name and colour.
  src/components/hub-ui.tsx + turbz-app.tsx   new "TURBZ2" main-menu tile + start
                           screen (shares the hard TURBZ save slot). Plain TURBZ is
                           unchanged and still there.

  Stage 1 = nations, cities, allegiances (and hidden identity at range). NEXT:
  Stage 2 = per-nation hostility toward YOU (attacked on sight by hostile nations,
            talk to friendly ones, identity hidden until you visit their city).
  Stage 3 = nations deliberately war + besiege each other's cities; you can join.

Earlier batches are included unchanged (power-extra, game-panels, building, arena-ui,
styles, power textures + PNGs).
