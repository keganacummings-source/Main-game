TURBZ — updated files (drop src/, scripts/, public/ onto your repo, keeping structure)

FIXES THIS BATCH

1) TurboCircle froze on "Begin the war"  —  src/game/arena.ts
   * Root cause: an infinite loop in faction setup (the class-pick index didn't
     advance when it hit a duplicate). Fixed; begin() now completes instantly.
   * Also fixed: the war wasn't actually happening — the garrison step was holding
     EVERY unit at home, so nobody attacked. Now only a thin garrison stays; the
     rest march out. Verified in a headless sim: squads attack, objectives change
     hands, factions grow and die, and the 5-minute objective respawn fires.

2) TURBZ2 "was just a copy of TURBZ"  —  it was actually running, but invisible.
   src/game/turbz-mode.ts  * each nation now garrisons its City with 3 of its own
                             witches (so nations have a real, visible home force;
                             ~4-7 witches per nation in play).
   src/game/engine.ts      * nation Cities now show on the MAP (M): triangular
                             markers + names (grey "City" until you visit one),
                             searchable in Find, and in hover info.
                           * in the world, each City casts a tall light BEACON so
                             you can spot it from across the open wild.
   Start message now points you to the Map (M) to find the cities. Verified by
   running startTurbz2 in a headless engine: 5 nations, cities placed, 28 witches
   sworn to teams 1-5, cities on the map.

   TURBZ2 is still Stage 1 (nations, cities, allegiances, hidden identity at range).
   Stage 2 (hostility toward YOU, talking, attacked on sight) and Stage 3 (nations
   besiege each other's cities, you can join) are next.

Everything else from earlier batches is included unchanged.
